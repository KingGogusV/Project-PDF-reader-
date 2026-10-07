import type { ReaderController, ReaderState } from '../core/document-controller';
import { isTauri } from '@tauri-apps/api/core';
import { getAccount, signInPath, signOutPath, type AccountState } from '../platform/account';
import { downloadPdf } from '../platform/browser';
import { createLocalLibrary, LocalLibraryError, type LocalDocumentMetadata, type LocalLibrary } from '../platform/local-library';

export interface LibrarySession {
  id: number;
  name: string;
  file: File;
  controller: ReaderController;
  state?: ReaderState;
}

export interface DeviceLibraryHooks {
  active(): LibrarySession | undefined;
  sessions(): LibrarySession[];
  openFile(file: File): Promise<LibrarySession | undefined>;
  activate(id: number): void;
  dialog(title: string, body: HTMLElement, actions: { label: string; value: string; primary?: boolean }[], origin?: HTMLElement): Promise<string>;
  dismissDialog(): void;
  toast(message: string, error?: boolean): void;
  refreshStatus(): void;
}

interface Binding {
  session: LibrarySession;
  vault: LocalLibrary;
  record: LocalDocumentMetadata;
  savedCoreRevision: number;
  timer?: ReturnType<typeof setTimeout>;
  scheduledCoreRevision?: number;
  pending?: Promise<void>;
  closing: boolean;
  blocked?: Error;
  message: string;
}

const IDENTITY_HINT = 'folio.local-account-hint.v1';
const DEBOUNCE_MS = 650;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'The operation could not complete. Your open document is unchanged.';
const paragraph = (text: string) => { const element = document.createElement('p'); element.className = 'dialog-copy'; element.textContent = text; return element; };
const bytesLabel = (bytes: number) => bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Coordinates explicit device-storage consent and controller-validated recovery snapshots. */
export function createDeviceLibrary(hooks: DeviceLibraryHooks) {
  let owner: string | null = null;
  let vault = createLocalLibrary(null);
  let account: AccountState | undefined;
  let accountError = '';
  let offlineOwner = false;
  let offlineDisplayName = '';
  let initialized: Promise<void> | undefined;
  let operationBusy = false;
  const bindings = new Map<number, Binding>();

  function cancelScheduled(binding: Binding) {
    clearTimeout(binding.timer);
    binding.timer = undefined;
    binding.scheduledCoreRevision = undefined;
  }

  function setMessage(binding: Binding, message: string) {
    if (binding.message === message) return;
    binding.message = message;
    hooks.refreshStatus();
  }

  function rememberOwner(state: AccountState) {
    try {
      if (state.account) localStorage.setItem(IDENTITY_HINT, JSON.stringify({ accountId: state.account.accountId, displayName: state.identity?.displayName || 'Your account', checkedAt: Date.now() }));
      else localStorage.removeItem(IDENTITY_HINT);
    } catch { hooks.toast('The account preference could not be remembered. Your PDFs remain local; sign in again after reconnecting.', true); }
  }

  function cachedOwner(): { accountId: string; displayName: string } | undefined {
    try {
      const cached = JSON.parse(localStorage.getItem(IDENTITY_HINT) || 'null');
      if (cached && typeof cached.accountId === 'string' && cached.accountId.length > 0 && cached.accountId.length <= 256
        && typeof cached.displayName === 'string' && cached.displayName.length <= 200) return cached;
    } catch { /* Account hints are optional; never guess an owner when unavailable. */ }
    return undefined;
  }

  async function useOwner(nextOwner: string | null) {
    if (owner === nextOwner) return;
    await flushAll();
    for (const binding of bindings.values()) cancelScheduled(binding);
    bindings.clear();
    vault.close();
    owner = nextOwner;
    vault = createLocalLibrary(owner);
    hooks.refreshStatus();
  }

  function initialize(): Promise<void> {
    if (initialized) return initialized;
    initialized = (async () => {
      const url = new URL(location.href);
      const requestedCreation = url.searchParams.get('account') === 'create';
      try {
        if (!navigator.onLine) throw new TypeError('This browser is offline.');
        account = await getAccount(requestedCreation);
        await useOwner(account.account?.accountId || null);
        rememberOwner(account);
        if (requestedCreation && account.account) hooks.toast('Your account is ready. PDF files stay on this device.');
      } catch (error) {
        accountError = errorMessage(error);
        const networkUnavailable = !navigator.onLine || ['TypeError', 'TimeoutError', 'AccountServiceUnavailableError'].includes((error as { name?: string })?.name || '');
        const hint = networkUnavailable ? cachedOwner() : undefined;
        if (hint) {
          offlineOwner = true;
          offlineDisplayName = hint.displayName;
          await useOwner(hint.accountId);
          hooks.toast('Offline: showing the last account library on this device. Account sign-in has not been verified.');
        }
      } finally {
        if (requestedCreation) { url.searchParams.delete('account'); history.replaceState(history.state, '', url.pathname + url.search + url.hash); }
      }
      try {
        const recoveries = await vault.list({ recoveryOnly: true });
        if (recoveries.length) hooks.toast(`${recoveries.length} local recovery ${recoveries.length === 1 ? 'copy is' : 'copies are'} available. Open My library to continue.`);
      } catch (error) { hooks.toast(errorMessage(error), true); }
      hooks.refreshStatus();
    })();
    return initialized;
  }

  function schedule(binding: Binding) {
    if (binding.closing || binding.blocked || binding.pending) { cancelScheduled(binding); return; }
    const state = binding.session.controller.state;
    if (state.checkpointPending) { cancelScheduled(binding); setMessage(binding, 'Recovery pending - finish the current annotation'); return; }
    if (state.revision === binding.savedCoreRevision) { cancelScheduled(binding); return; }
    // Page, zoom, search and render updates must not keep postponing a content save.
    if (binding.timer !== undefined && binding.scheduledCoreRevision === state.revision) return;
    cancelScheduled(binding);
    setMessage(binding, 'Recovery pending');
    binding.scheduledCoreRevision = state.revision;
    binding.timer = setTimeout(() => {
      binding.timer = undefined; binding.scheduledCoreRevision = undefined;
      void checkpoint(binding).catch(error => { if ((error as Error).name !== 'CheckpointDeferredError') hooks.toast(errorMessage(error), true); });
    }, DEBOUNCE_MS);
  }

  async function checkpoint(binding: Binding, force = false): Promise<void> {
    cancelScheduled(binding);
    while (binding.pending) await binding.pending;
    if (binding.blocked) throw binding.blocked;
    if (!force && binding.session.controller.state.revision === binding.savedCoreRevision) return;
    const job = (async () => {
      setMessage(binding, 'Saving recovery copy...');
      const snapshot = await binding.session.controller.createCheckpoint();
      binding.record = await binding.vault.saveRevision(binding.record.id, { bytes: snapshot.bytes, expectedRevision: binding.record.revision, needsRecovery: snapshot.modified });
      binding.savedCoreRevision = snapshot.revision;
      setMessage(binding, 'Recovery up to date on this device');
    })();
    binding.pending = job;
    try { await job; }
    catch (error) {
      if ((error as Error).name === 'CheckpointDeferredError') setMessage(binding, 'Recovery pending - finish the current annotation');
      else {
        binding.blocked = error instanceof Error ? error : new Error(errorMessage(error));
        setMessage(binding, error instanceof LocalLibraryError && error.code === 'CONFLICT' ? 'Newer stored copy exists - export these edits' : 'Local save failed - keep open and export a copy');
      }
      throw error;
    } finally {
      if (binding.pending === job) binding.pending = undefined;
      if (!binding.closing && !binding.blocked) schedule(binding);
    }
  }

  function onState(session: LibrarySession, state: ReaderState) {
    const binding = bindings.get(session.id);
    if (!binding || binding.closing || binding.blocked) return;
    if (state.checkpointPending) {
      cancelScheduled(binding);
      setMessage(binding, 'Recovery pending - finish the current annotation');
      return;
    }
    schedule(binding);
  }

  async function flushAll() {
    for (const binding of bindings.values()) {
      binding.session.controller.flushPendingEdits();
      await checkpoint(binding, binding.session.controller.state.revision !== binding.savedCoreRevision);
      binding.session.controller.flushPendingEdits();
      if (binding.session.controller.state.revision !== binding.savedCoreRevision) throw new Error('More edits arrived while recovery was saving. Finish editing and try again; your document remains open.');
    }
  }

  async function addSession(session: LibrarySession): Promise<void> {
    session.controller.flushPendingEdits();
    const originalBytes = new Uint8Array(await session.controller.getOriginalFile().arrayBuffer());
    const record = await vault.add({ name: session.name, bytes: originalBytes });
    const binding: Binding = { session, vault, record, savedCoreRevision: -1, closing: false, message: 'Original stored; saving recovery copy...' };
    bindings.set(session.id, binding);
    hooks.refreshStatus();
    await checkpoint(binding, true);
    hooks.toast('Stored on this device. Recovery copies are automatic; your original is kept separately.');
  }

  async function storeActive(origin?: HTMLElement) {
    await initialize();
    const session = hooks.active();
    if (!session || operationBusy) return;
    operationBusy = true;
    try {
      const current = bindings.get(session.id);
      if (current) {
        if (current.blocked instanceof LocalLibraryError && current.blocked.code === 'CONFLICT') {
          const answer = await hooks.dialog('A newer local copy exists', paragraph('Another tab saved this document. Keep that stored version. You can store your current open work as a separate document, or export a PDF copy.'), [
            { label: 'Keep open', value: 'cancel' }, { label: 'Store separate copy', value: 'copy', primary: true },
          ]);
          if (answer !== 'copy') return;
          cancelScheduled(current);
          bindings.delete(session.id);
          await addSession(session);
          return;
        }
        current.blocked = undefined;
        session.controller.flushPendingEdits();
        await checkpoint(current, true);
        hooks.toast('Recovery copy updated on this device.');
        return;
      }
      const body = document.createElement('div');
      body.append(paragraph(`Store ${session.name} in ${owner ? 'this account library' : 'the guest library'} on this browser?`));
      body.append(paragraph('Folio will keep the original and automatically save validated recovery copies locally. PDF contents and passwords are never uploaded. Browser storage can be cleared or evicted; keep an exported backup.'));
      body.append(paragraph('This is not encrypted storage. Someone with access to this browser profile may be able to access locally stored files.'));
      const answer = await hooks.dialog('Store this PDF on this device?', body, [{ label: 'Not now', value: 'cancel' }, { label: 'Enable local recovery', value: 'store', primary: true }], origin);
      if (answer === 'store' && hooks.sessions().some(item => item.id === session.id)) await addSession(session);
    } catch (error) { hooks.toast(errorMessage(error), true); }
    finally { operationBusy = false; hooks.refreshStatus(); }
  }

  async function beforeClose(session: LibrarySession, discard: boolean): Promise<void> {
    const binding = bindings.get(session.id);
    if (!binding) return;
    binding.closing = true;
    cancelScheduled(binding);
    try {
      if (binding.pending) await binding.pending.catch(() => undefined);
      if (discard) {
        // The opened baseline may already contain recovered edits. It is NOT necessarily
        // the immutable first-import original, which the vault keeps independently.
        binding.record = await binding.vault.saveRevision(binding.record.id, {
          bytes: new Uint8Array(await session.controller.getOriginalFile().arrayBuffer()),
          expectedRevision: binding.record.revision, needsRecovery: false,
        });
      } else {
        session.controller.flushPendingEdits();
        await checkpoint(binding, true);
        session.controller.flushPendingEdits();
        if (session.controller.state.revision !== binding.savedCoreRevision) throw new Error('More edits arrived while recovery was saving. The document remains open; close it again after recovery finishes.');
        binding.record = await binding.vault.markRecovered(binding.record.id, binding.record.revision);
        session.controller.flushPendingEdits();
        if (session.controller.state.revision !== binding.savedCoreRevision) throw new Error('New edits need a recovery copy. The document remains open.');
      }
      bindings.delete(session.id);
    } catch (error) { binding.closing = false; schedule(binding); throw error; }
    finally { hooks.refreshStatus(); }
  }

  async function openStored(record: LocalDocumentMetadata) {
    const existing = [...bindings.values()].find(binding => binding.record.id === record.id);
    hooks.dismissDialog();
    if (existing) { hooks.activate(existing.session.id); return; }
    let stored;
    try { stored = await vault.read(record.id); }
    catch (error) {
      if (!(error instanceof LocalLibraryError) || error.code !== 'CORRUPT') throw error;
      const answer = await hooks.dialog('Recovery copy needs attention', paragraph(`${error.message} Open the separately stored original as an unstored document? The damaged recovery record will be kept.`), [
        { label: 'Keep stored copies', value: 'cancel' }, { label: 'Open original', value: 'original', primary: true },
      ]);
      if (answer === 'original') {
        const original = await vault.readOriginal(record.id);
        await hooks.openFile(new File([original.bytes], original.name, { type: 'application/pdf' }));
      }
      return;
    }
    const session = await hooks.openFile(new File([stored.latestBytes], stored.name, { type: 'application/pdf', lastModified: stored.updatedAt }));
    if (!session) return;
    const binding: Binding = { session, vault, record: stored, savedCoreRevision: session.controller.state.revision, closing: false, message: 'Recovery up to date on this device' };
    bindings.set(session.id, binding);
    if (stored.needsRecovery) {
      try { binding.record = await vault.markRecovered(stored.id, stored.revision); }
      catch (error) { binding.blocked = error instanceof Error ? error : new Error(errorMessage(error)); setMessage(binding, 'Newer stored copy exists - export these edits'); hooks.toast(errorMessage(error), true); }
    }
    hooks.refreshStatus();
  }

  function actionButton(label: string, action: string, handler: () => Promise<void>, primary = false) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = primary ? 'button primary' : 'button';
    button.textContent = label; button.dataset.libraryAction = action;
    button.addEventListener('click', () => {
      button.disabled = true;
      void handler().catch(error => hooks.toast(errorMessage(error), true)).finally(() => { button.disabled = false; });
    });
    return button;
  }

  async function showLibrary(origin?: HTMLElement) {
    await initialize();
    try {
      const records = await vault.list();
      const body = document.createElement('div'); body.className = 'device-library';
      body.append(paragraph(offlineOwner ? `Offline library for ${offlineDisplayName}. This cached account identity is not a verified sign-in.` : owner ? 'Files saved for your account on this device. They do not sync to other devices.' : 'Guest library on this device. Sign in to keep a separate account library.'));
      body.append(paragraph('Originals and recovery copies stay in this browser. Profile storage is not encrypted; exported backups remain important.'));
      const usage = document.createElement('p'); usage.className = 'library-usage'; usage.textContent = 'Checking device storage...'; body.append(usage);
      void vault.estimateStorage().then(estimate => {
        usage.textContent = `${estimate.documentCount} stored ${estimate.documentCount === 1 ? 'document' : 'documents'} - ${bytesLabel(estimate.storedBytes)} of ${bytesLabel(estimate.limits.maxStoredBytes)} library budget. ${estimate.persisted ? 'Browser persistence granted.' : 'Browser persistence is not guaranteed.'}`;
      }).catch(error => { usage.textContent = errorMessage(error); });
      body.append(actionButton('Request persistent storage', 'persist', async () => {
        const result = await vault.requestPersistence();
        hooks.toast(result === 'granted' ? 'The browser granted persistent storage. Keep exported backups; clearing site data still removes local files.' : result === 'denied' ? 'The browser did not grant persistence. Local storage remains available, but keep exported backups.' : 'This browser does not support requesting persistent storage. Keep exported backups.');
      }));
      if (!records.length) body.append(paragraph('No PDFs stored here yet. Open a PDF and choose Store on this device to enable recovery for that document.'));
      for (const record of records) {
        const row = document.createElement('section'); row.className = 'library-row'; row.dataset.documentId = record.id;
        const title = document.createElement('h3'); title.textContent = record.name; row.append(title);
        const detail = document.createElement('p'); detail.className = 'library-detail'; detail.textContent = `${bytesLabel(record.latestSize)} - saved ${new Date(record.checkpointAt).toLocaleString()}`; row.append(detail);
        if (record.needsRecovery) { const badge = document.createElement('span'); badge.className = 'recovery-badge'; badge.textContent = 'Recovery copy available'; row.append(badge); }
        const buttons = document.createElement('div'); buttons.className = 'library-actions';
        buttons.append(actionButton('Open latest', 'open', () => openStored(record), true));
        buttons.append(actionButton('Download original', 'original', async () => { const source = await vault.readOriginal(record.id); hooks.toast(downloadPdf(source.bytes, source.name).message); }));
        buttons.append(actionButton('Delete stored copies', 'delete', async () => {
          if ([...bindings.values()].some(binding => binding.record.id === record.id)) throw new Error('Close this document before deleting its stored copies.');
          hooks.dismissDialog();
          const answer = await hooks.dialog('Delete this stored document?', paragraph(`Delete the original and latest recovery copy of ${record.name} from this browser? Files you exported or opened from your device are unaffected. This local deletion cannot be undone.`), [
            { label: 'Keep document', value: 'cancel' }, { label: 'Delete stored copies', value: 'delete', primary: true },
          ]);
          if (answer === 'delete') { await vault.remove(record.id, record.revision); hooks.toast('Stored copies deleted from this browser.'); }
          await showLibrary(origin);
        }));
        row.append(buttons); body.append(row);
      }
      await hooks.dialog('My library', body, [{ label: 'Done', value: 'done', primary: true }], origin);
    } catch (error) { hooks.toast(errorMessage(error), true); }
  }

  async function mayNavigate(): Promise<boolean> {
    try { await flushAll(); } catch (error) { hooks.toast(errorMessage(error), true); return false; }
    const unprotected = hooks.sessions().some(session => session.controller.flushPendingEdits() && !bindings.has(session.id));
    if (!unprotected) return true;
    const answer = await hooks.dialog('Keep your open work?', paragraph('Signing in or out leaves this workspace. Some modified documents do not have local recovery enabled. Export or store them before leaving, or explicitly continue without saving.'), [
      { label: 'Keep reading', value: 'cancel', primary: true }, { label: 'Continue without saving', value: 'leave' },
    ]);
    return answer === 'leave';
  }

  async function showAccount(origin?: HTMLElement) {
    await initialize();
    const body = document.createElement('div');
    const actions: { label: string; value: string; primary?: boolean }[] = [{ label: 'Done', value: 'done' }];
    if (offlineOwner) {
      body.append(paragraph(`Offline library for ${offlineDisplayName}. The remembered account selects local files only; it does not authenticate you to the server.`));
      body.append(paragraph('Reconnect to verify your account. PDFs remain on this device and are not synchronized.'));
      actions.push({ label: 'Check connection', value: 'refresh', primary: true });
    } else if (account?.account) {
      body.append(paragraph(`Signed in as ${account.identity?.displayName || 'your account'}.`));
      body.append(paragraph(`${account.registered} of ${account.limit} global account places are registered.`));
      body.append(paragraph('Account identity is hosted. PDF files stay in this browser and do not sync. Signing out does not delete local files.'));
      actions.push({ label: 'Sign out', value: 'signout' });
    } else if (account?.identity) {
      body.append(paragraph(`You are signed in as ${account.identity.displayName}. Create a Folio account to use a separate local account library.`));
      body.append(paragraph(`${account.registered} of ${account.limit} global account places are registered. The server enforces this limit.`));
      if (account.registered < account.limit) actions.push({ label: 'Create account', value: 'create', primary: true });
      else body.append(paragraph('All account places are currently occupied. Guest PDF reading remains available.'));
      actions.push({ label: 'Sign out', value: 'signout' });
    } else {
      body.append(paragraph(accountError || 'Use Sign in with ChatGPT to create or access your Folio account. No PDF is uploaded when you sign in.'));
      if (account) { body.append(paragraph(`${account.registered} of ${account.limit} global account places are registered.`)); actions.push({ label: 'Sign in with ChatGPT', value: 'signin', primary: true }); }
      else body.append(paragraph('Use the hosted website for account access. You can continue reading and storing guest documents locally here.'));
    }
    const websiteLabel = document.createElement('label');
    websiteLabel.className = 'dialog-label';
    websiteLabel.htmlFor = 'account-website-url';
    websiteLabel.textContent = 'Folio website';
    const websiteUrl = document.createElement('input');
    websiteUrl.id = 'account-website-url';
    websiteUrl.className = 'dialog-input';
    websiteUrl.type = 'url';
    websiteUrl.readOnly = true;
    websiteUrl.value = 'https://folio-local-pdf.gogoi-ronnie.chatgpt.site';
    websiteUrl.addEventListener('focus', () => websiteUrl.select());
    body.append(websiteLabel, websiteUrl);
    if (!isTauri()) {
      const websiteLink = document.createElement('a');
      websiteLink.className = 'button';
      websiteLink.href = websiteUrl.value;
      websiteLink.target = '_blank';
      websiteLink.rel = 'noopener noreferrer';
      websiteLink.textContent = 'Open Folio website (new tab)';
      body.append(websiteLink);
    }
    body.append(paragraph('Use the website for hosted account access. Your desktop and browser PDF libraries stay separate; opening the website does not transfer your PDFs.'));
    body.append(paragraph('Local account separation is not device encryption. Protect your browser profile and keep exported backups.'));
    const result = await hooks.dialog('Your account', body, actions, origin);
    try {
      if (result === 'signin' && await mayNavigate()) location.assign(signInPath);
      else if (result === 'signout' && await mayNavigate()) {
        // Optional browser preferences must never prevent server-side sign-out.
        try { localStorage.removeItem(IDENTITY_HINT); }
        catch { hooks.toast('The local account preference could not be cleared. Signing out of the hosted account now.'); }
        // Keep the live coordinator until the browser actually leaves. A user may
        // cancel the beforeunload prompt; their open recovery sessions must survive.
        location.assign(signOutPath);
      } else if (result === 'create') {
        await flushAll();
        const created = await getAccount(true);
        await useOwner(created.account?.accountId || null);
        account = created; accountError = ''; offlineOwner = false; rememberOwner(created);
        hooks.toast('Your account is ready. Choose Store on this device for any open PDF you want in this account library.');
        hooks.refreshStatus();
      } else if (result === 'refresh') {
        const refreshed = await getAccount(false);
        await useOwner(refreshed.account?.accountId || null);
        account = refreshed; accountError = ''; offlineOwner = false; rememberOwner(refreshed);
        await showAccount();
      }
    } catch (error) { hooks.toast(errorMessage(error), true); }
  }

  return { initialize, showLibrary, showAccount, storeActive, onState, beforeClose,
    isStored: (id: number) => bindings.has(id),
    status: (id: number) => bindings.get(id)?.message || 'Not stored on this device',
  };
}
