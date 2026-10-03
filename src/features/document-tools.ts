import type { ReaderController, ReaderState } from '../core/document-controller';
import type { OrganizationOperation, OrganizationResult } from '../core/organize';
import type { SignedPdfCopy, SigningCertificateSummary } from '../core/signing';
import { downloadPdf, exportedPdfName } from '../platform/browser';

interface ActiveDocument {
  id: string | number;
  name: string;
  file?: File;
  controller: ReaderController;
  state?: Readonly<ReaderState>;
}
export interface DocumentToolsHooks {
  active(): ActiveDocument | undefined;
  openFile(file: File): Promise<unknown>;
  dialog(title: string, body: HTMLElement, actions: { label: string; value: string; primary?: boolean }[]): Promise<string>;
  dismissDialog(): void;
  toast(message: string, error?: boolean): void;
}

const paragraph = (text: string) => {
  const element = document.createElement('p'); element.className = 'dialog-copy'; element.textContent = text; return element;
};
const button = (id: string, text: string, primary = false) => {
  const element = document.createElement('button'); element.id = id; element.type = 'button';
  element.className = `button${primary ? ' primary' : ''}`; element.textContent = text; return element;
};
const input = (id: string, type = 'text') => {
  const element = document.createElement('input'); element.id = id; element.type = type; element.className = 'dialog-input'; return element;
};
const label = (text: string, control: HTMLElement) => {
  const element = document.createElement('label'); element.className = 'dialog-label'; element.textContent = text; element.append(control); return element;
};
const statusElement = (id: string) => {
  const element = paragraph(''); element.id = id; element.setAttribute('role', 'status'); element.setAttribute('aria-live', 'polite'); return element;
};
const row = (...elements: HTMLElement[]) => {
  const holder = document.createElement('div'); holder.className = 'document-tools-actions'; holder.style.display = 'flex'; holder.style.flexWrap = 'wrap'; holder.style.gap = '.5rem'; holder.append(...elements); return holder;
};
const toolsBody = () => { const element = document.createElement('div'); element.className = 'document-tools-body'; return element; };
const errorText = (error: unknown) => error instanceof Error ? error.message : 'The operation could not be completed. Your original PDF has not changed.';
const cancelled = (error: unknown, signal: AbortSignal) => signal.aborted || (error instanceof Error && error.name === 'AbortError');
const fileFromBytes = (bytes: Uint8Array, name: string) => new File([bytes.slice().buffer], name, { type: 'application/pdf' });
const copyName = (name: string, suffix: string) => `${name.replace(/\.pdf$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 120) || 'document'}-${suffix}`;

/** Page numbers remain ordered; duplicate/descending/empty ranges are rejected. */
function parsePages(value: string, maximum: number, limit = 500): number[] {
  if (!value.trim()) throw new Error('Enter page numbers, for example 1-3, 5.');
  const pages: number[] = [];
  const seen = new Set<number>();
  for (const section of value.split(',')) {
    const match = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(section);
    if (!match) throw new Error('Use page numbers or ascending ranges separated by commas, for example 1-3, 5.');
    const start = Number(match[1]); const end = Number(match[2] ?? match[1]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start || end > maximum || end - start + 1 > limit) {
      throw new Error(`Choose pages between 1 and ${maximum}, with at most ${limit} pages per operation.`);
    }
    for (let page = start; page <= end; page++) {
      if (seen.has(page)) throw new Error('Choose each page only once.');
      seen.add(page); pages.push(page);
      if (pages.length > limit) throw new Error(`Choose at most ${limit} pages per operation.`);
    }
  }
  return pages;
}

function downloadText(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.hidden = true;
  document.body.append(anchor);
  try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
}

export function createDocumentTools(hooks: DocumentToolsHooks) {
  const restoreFocus = () => queueMicrotask(() => {
    if (!document.querySelector('dialog[open]')) document.getElementById('document-tools')?.focus();
  });
  const active = () => {
    const current = hooks.active();
    if (!current?.controller.pdfDocument || current.controller.state.loading) {
      hooks.toast('Open a PDF before using document tools.', true); return undefined;
    }
    current.controller.flushPendingEdits();
    return current;
  };
  const assets = () => {
    const root = new URL(`${import.meta.env.BASE_URL}vendor/pdfjs/`, location.href).href;
    return { standardFontDataUrl: `${root}standard_fonts/`, cMapUrl: `${root}cmaps/`, wasmUrl: `${root}wasm/`, iccUrl: `${root}iccs/` };
  };

  async function showTools() {
    if (!active()) return;
    const body = toolsBody();
    body.append(paragraph('Process this PDF on your device. Tools create separate output and keep your open document.'));
    const ocr = button('document-tool-ocr', 'Recognize text');
    const organize = button('document-tool-organize', 'Organize pages');
    const sign = button('document-tool-sign', 'Sign with certificate');
    ocr.onclick = () => { hooks.dismissDialog(); void showOcr(); };
    organize.onclick = () => { hooks.dismissDialog(); void showOrganization(); };
    sign.onclick = () => { hooks.dismissDialog(); void showSigning(); };
    body.append(row(ocr, organize, sign));
    await hooks.dialog('Document tools', body, [{ label: 'Close', value: 'close' }]);
    restoreFocus();
  }

  async function showOcr() {
    const current = active(); if (!current) return;
    const canCopy = current.controller.state.canCopy;
    const pdf = current.controller.pdfDocument!;
    const body = toolsBody();
    body.append(paragraph('Recognize English text locally from page images. Review the result for recognition errors. This exports text; it does not add a searchable layer to the PDF or include annotation text.'));
    const pages = input('ocr-pages'); pages.value = String(current.controller.currentPage); pages.placeholder = '1-3, 5';
    const start = button('ocr-start', 'Recognize text', true); const cancel = button('ocr-cancel', 'Cancel recognition'); cancel.disabled = true;
    const progress = document.createElement('progress'); progress.id = 'ocr-progress'; progress.max = 1; progress.value = 0; progress.style.width = '100%'; progress.setAttribute('aria-label', 'Text recognition progress');
    const status = statusElement('ocr-status'); status.textContent = 'Choose up to 50 pages. The English model runs on this device.';
    if (!canCopy) { start.disabled = true; status.textContent = 'This PDF does not permit text copying, so OCR is unavailable.'; }
    const output = document.createElement('textarea'); output.id = 'ocr-output'; output.readOnly = true; output.className = 'dialog-input'; output.rows = 8; output.style.width = '100%'; output.setAttribute('aria-label', 'Recognized text');
    const download = button('ocr-download', 'Download text'); download.disabled = true;
    body.append(label('Pages to recognize', pages), row(start, cancel), progress, status, output, download);
    let lifetime: AbortController | undefined; let closed = false; let running = false;
    cancel.onclick = () => lifetime?.abort();
    download.onclick = () => {
      try { if (output.value) { downloadText(output.value, copyName(current.name, 'recognized.txt')); status.textContent = 'Text download started. Check your browser downloads to confirm it was saved.'; } }
      catch (error) { status.textContent = errorText(error); }
    };
    start.onclick = () => { void (async () => {
      if (running || closed) return;
      let selection: number[];
      try { selection = parsePages(pages.value, pdf.numPages, 50); }
      catch (error) { status.textContent = errorText(error); return; }
      running = true; lifetime = new AbortController(); const job = lifetime;
      start.disabled = pages.disabled = true; cancel.disabled = false; download.disabled = true; output.value = ''; progress.value = 0;
      status.textContent = 'Preparing local text recognition...';
      try {
        current.controller.flushPendingEdits();
        const { recognizePdfPages } = await import('../core/ocr');
        job.signal.throwIfAborted();
        const result = await recognizePdfPages(pdf, selection, {
          signal: job.signal,
          onProgress: update => { if (!closed) { progress.value = update.progress; status.textContent = `${update.status} - page ${update.pageNumber} (${update.pageIndex + 1} of ${update.pageCount})`; } },
        });
        if (closed || job.signal.aborted) return;
        const hasText = result.pages.some(page => page.text.trim());
        output.value = hasText ? result.pages.map(page => `Page ${page.pageNumber}\n${page.text.trim()}`).join('\n\n') : '';
        progress.value = 1; download.disabled = !output.value;
        status.textContent = hasText
          ? `Recognition complete for ${result.pages.length} ${result.pages.length === 1 ? 'page' : 'pages'}. Review the text and download it before closing; results are not stored.`
          : 'No text was recognized on the selected pages. The original PDF has not changed.';
      } catch (error) { if (!closed) status.textContent = cancelled(error, job.signal) ? 'Recognition cancelled. The PDF has not changed.' : errorText(error); }
      finally { running = false; if (!closed) { start.disabled = pages.disabled = false; cancel.disabled = true; } }
    })(); };
    try { await hooks.dialog('Recognize text', body, [{ label: 'Close', value: 'close' }]); }
    finally { closed = true; lifetime?.abort(); output.value = ''; restoreFocus(); }
  }

  async function showOrganization() {
    const current = active(); if (!current) return;
    const body = toolsBody();
    body.append(paragraph('Create a separate page-only PDF. Document metadata and viewing preferences are reset. PDFs with forms, annotations, bookmarks, tags or protection are refused when their structure cannot be preserved.'));
    const operation = document.createElement('select'); operation.id = 'organize-operation'; operation.className = 'dialog-input';
    for (const [value, title] of [['extract', 'Extract pages'], ['reorder', 'Reorder all pages'], ['delete', 'Delete selected pages'], ['rotate', 'Rotate pages permanently'], ['merge', 'Merge PDFs']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = title; operation.append(option);
    }
    const pages = input('organize-pages'); pages.value = String(current.controller.currentPage); pages.placeholder = '1-3, 5';
    const pagesLabel = label('Pages in requested order', pages);
    const rotation = document.createElement('select'); rotation.id = 'organize-rotation'; rotation.className = 'dialog-input';
    for (const angle of [90, 180, 270]) { const option = document.createElement('option'); option.value = String(angle); option.textContent = `${angle} degrees clockwise`; rotation.append(option); }
    const rotationLabel = label('Permanent rotation', rotation); rotationLabel.hidden = true;
    const files = input('organize-files', 'file'); files.accept = 'application/pdf,.pdf'; files.multiple = true;
    const filesLabel = label('Add PDFs after the current document (file-picker order)', files); filesLabel.hidden = true;
    const start = button('organize-start', 'Create verified copy', true); const cancel = button('organize-cancel', 'Cancel operation'); cancel.disabled = true;
    const status = statusElement('organize-status'); status.textContent = 'Limit: 50 MiB combined input, 500 source pages and 10 PDFs. Appearance checks use bounded previews.';
    const download = button('organize-download', 'Download PDF copy'); const open = button('organize-open', 'Open new copy'); download.disabled = open.disabled = true;
    const notes = paragraph(''); notes.id = 'organize-notes';
    const details = document.createElement('details'); details.hidden = true;
    const detailsTitle = document.createElement('summary'); detailsTitle.textContent = 'Copy details and verification limits'; details.append(detailsTitle, notes);
    body.append(label('Operation', operation), pagesLabel, rotationLabel, filesLabel, row(start, cancel), status, row(download, open), details);
    let result: OrganizationResult | undefined; let lifetime: AbortController | undefined; let closed = false; let running = false;
    const resetResult = () => {
      result = undefined; download.disabled = open.disabled = true; notes.textContent = ''; details.hidden = true;
      status.textContent = 'Selection changed. Create a new verified copy when ready.';
    };
    const update = () => {
      pagesLabel.hidden = operation.value === 'merge'; rotationLabel.hidden = operation.value !== 'rotate'; filesLabel.hidden = operation.value !== 'merge';
      if (operation.value === 'reorder') pages.value = current.controller.pageCount === 1 ? '1' : `1-${current.controller.pageCount}`;
      resetResult();
    };
    operation.onchange = update; pages.oninput = resetResult; rotation.onchange = resetResult; files.onchange = resetResult;
    cancel.onclick = () => lifetime?.abort();
    download.onclick = () => { try { if (result) status.textContent = downloadPdf(result.bytes, result.name).message; } catch (error) { status.textContent = errorText(error); } };
    open.onclick = () => {
      try { if (result) { const copy = fileFromBytes(result.bytes, exportedPdfName(result.name)); hooks.dismissDialog(); void hooks.openFile(copy).catch(error => hooks.toast(errorText(error), true)); } }
      catch (error) { status.textContent = errorText(error); }
    };
    start.onclick = () => { void (async () => {
      if (running || closed) return;
      let request: OrganizationOperation; let additional: File[] = [];
      try {
        const kind = operation.value as OrganizationOperation['kind'];
        if (kind === 'merge') {
          additional = Array.from(files.files ?? []);
          if (!additional.length || additional.length > 9) throw new Error('Choose one to nine additional PDFs to merge after the current document.');
          request = { kind };
        } else {
          const chosen = parsePages(pages.value, current.controller.pageCount);
          request = kind === 'rotate' ? { kind, pages: chosen, degrees: Number(rotation.value) as 90 | 180 | 270 } : { kind, pages: chosen };
        }
        if ((current.file?.size ?? current.controller.getOriginalFile().size) + additional.reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024) throw new Error('Choose at most 50 MiB of combined source PDFs.');
      } catch (error) { status.textContent = errorText(error); return; }
      running = true; lifetime = new AbortController(); const job = lifetime;
      start.disabled = operation.disabled = pages.disabled = rotation.disabled = files.disabled = true; cancel.disabled = false;
      result = undefined; download.disabled = open.disabled = true; notes.textContent = ''; details.hidden = true; status.textContent = 'Checking document safety and verifying every retained page...';
      try {
        current.controller.flushPendingEdits();
        const checkpoint = await current.controller.createCheckpoint(); job.signal.throwIfAborted();
        const inputs = [{ name: current.name, bytes: checkpoint.bytes }];
        for (const file of additional) { inputs.push({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }); job.signal.throwIfAborted(); }
        const { organizePdf } = await import('../core/organize'); job.signal.throwIfAborted();
        const output = await organizePdf(inputs, request, { ...assets(), signal: job.signal });
        if (closed || job.signal.aborted) return;
        result = output; download.disabled = open.disabled = false;
        status.textContent = `Verified copy ready: ${output.pageCount} ${output.pageCount === 1 ? 'page' : 'pages'}. Download or open it as a separate document.`;
        notes.textContent = output.notes.join(' '); details.hidden = false;
      } catch (error) { if (!closed) status.textContent = cancelled(error, job.signal) ? 'Operation cancelled. Original files have not changed.' : errorText(error); }
      finally { running = false; if (!closed) { start.disabled = operation.disabled = pages.disabled = rotation.disabled = files.disabled = false; cancel.disabled = true; } }
    })(); };
    try { await hooks.dialog('Organize pages', body, [{ label: 'Close', value: 'close' }]); }
    finally { closed = true; lifetime?.abort(); result = undefined; files.value = ''; restoreFocus(); }
  }

  async function showSigning() {
    const current = active(); if (!current) return;
    if (current.controller.state.readOnlyReason) { hooks.toast('This document is protected or already contains signature information. Signing it is unavailable.', true); return; }
    const body = toolsBody();
    body.append(paragraph('Sign a new PDF copy using your local PKCS#12 (.p12/.pfx) certificate. This creates an invisible RSA/SHA-256 certificate signature. It checks cryptographic integrity, not certificate trust, identity, revocation or a trusted timestamp. The original document remains open and unchanged.'));
    const certificate = input('sign-certificate', 'file'); certificate.accept = '.p12,.pfx,application/x-pkcs12';
    const password = input('sign-password', 'password'); password.autocomplete = 'off'; password.maxLength = 1024; password.spellcheck = false;
    const reason = input('sign-reason'); reason.maxLength = 500; reason.placeholder = 'Optional';
    const inspect = button('sign-inspect', 'Review certificate', true);
    const summary = document.createElement('pre'); summary.id = 'sign-summary'; summary.style.whiteSpace = 'pre-wrap'; summary.style.overflowWrap = 'anywhere'; summary.hidden = true; summary.setAttribute('aria-label', 'Certificate details');
    const confirm = button('sign-start', 'Sign PDF copy'); confirm.disabled = true;
    const cancel = button('sign-cancel', 'Cancel processing'); cancel.disabled = true;
    const status = statusElement('sign-status'); status.textContent = 'Certificate files stay on this device. Maximum certificate size: 1 MiB; PDF size: 20 MiB.';
    const download = button('sign-download', 'Download signed copy'); download.disabled = true;
    const open = button('sign-open', 'Open signed copy'); open.disabled = true;
    body.append(label('Certificate file', certificate), label('Certificate password', password), label('Signing reason', reason), row(inspect, cancel), summary, confirm, status, row(download, open));
    let p12: Uint8Array | undefined; let reviewed: SigningCertificateSummary | undefined; let result: SignedPdfCopy | undefined;
    let lifetime: AbortController | undefined; let closed = false; let running = false;
    const clearCredentials = () => { p12?.fill(0); p12 = undefined; password.value = ''; certificate.value = ''; reviewed = undefined; confirm.disabled = true; };
    const invalidate = () => { p12?.fill(0); p12 = undefined; reviewed = undefined; result = undefined; confirm.disabled = true; download.disabled = open.disabled = true; summary.hidden = true; summary.textContent = ''; };
    certificate.onchange = invalidate; password.oninput = invalidate;
    cancel.onclick = () => { lifetime?.abort(); clearCredentials(); status.textContent = 'Certificate processing cancelled. Your original PDF has not changed.'; };
    const setBusy = (busy: boolean) => {
      running = busy; certificate.disabled = password.disabled = reason.disabled = inspect.disabled = busy; cancel.disabled = !busy;
      confirm.disabled = busy || !reviewed;
    };
    inspect.onclick = () => { void (async () => {
      if (running || closed) return;
      const file = certificate.files?.[0];
      if (!file || file.size < 1 || file.size > 1024 * 1024) { status.textContent = 'Choose a PKCS#12 certificate file between 1 byte and 1 MiB.'; return; }
      invalidate(); lifetime = new AbortController(); const job = lifetime; setBusy(true); status.textContent = 'Reading certificate details locally...';
      try {
        p12 = new Uint8Array(await file.arrayBuffer()); job.signal.throwIfAborted();
        const { inspectSigningCertificate } = await import('../core/signing'); job.signal.throwIfAborted();
        // API also accepts cancellation so dialog dismissal releases its worker.
        const information = await inspectSigningCertificate(p12, password.value, job.signal);
        if (closed || job.signal.aborted) return;
        reviewed = information;
        summary.textContent = `Subject: ${information.subject}\nIssuer: ${information.issuer}\nValid from: ${information.validFrom}\nValid until: ${information.validUntil}\nKey: ${information.keyAlgorithm} ${information.keyBits} bits\nSHA-256 fingerprint: ${information.fingerprintSha256}\nSerial: ${information.serialNumber}`;
        summary.hidden = false; status.textContent = 'Review these certificate details. Choose Sign PDF copy to create the invisible signature. Trust and revocation remain unverified.';
      } catch (error) { clearCredentials(); if (!closed) status.textContent = cancelled(error, job.signal) ? 'Certificate review cancelled.' : errorText(error); }
      finally { if (!closed) setBusy(false); }
    })(); };
    confirm.onclick = () => { void (async () => {
      if (running || closed || !reviewed || !p12) return;
      lifetime = new AbortController(); const job = lifetime; setBusy(true); status.textContent = 'Creating and verifying the signed PDF copy locally...';
      try {
        current.controller.flushPendingEdits();
        const checkpoint = await current.controller.createCheckpoint(); job.signal.throwIfAborted();
        const { signPdfCopy } = await import('../core/signing'); job.signal.throwIfAborted();
        const output = await signPdfCopy({ pdfBytes: checkpoint.bytes, p12Bytes: p12, password: password.value, reason: reason.value.trim() || undefined, signal: job.signal });
        if (closed || job.signal.aborted) return;
        result = output; download.disabled = open.disabled = false;
        status.textContent = 'Signed copy ready. Cryptographic integrity verified; certificate trust and revocation not checked; no trusted timestamp. Download and review the copy in your PDF application.';
      } catch (error) { if (!closed) status.textContent = cancelled(error, job.signal) ? 'Signing cancelled. Your original PDF has not changed.' : errorText(error); }
      finally { clearCredentials(); if (!closed) setBusy(false); }
    })(); };
    download.onclick = () => { try { if (result) status.textContent = downloadPdf(result.bytes, copyName(current.name, 'signed.pdf')).message; } catch (error) { status.textContent = errorText(error); } };
    open.onclick = () => {
      try { if (result) { const copy = fileFromBytes(result.bytes, exportedPdfName(copyName(current.name, 'signed.pdf'))); hooks.dismissDialog(); void hooks.openFile(copy).catch(error => hooks.toast(errorText(error), true)); } }
      catch (error) { status.textContent = errorText(error); }
    };
    try { await hooks.dialog('Sign with certificate', body, [{ label: 'Close', value: 'close' }]); }
    finally { closed = true; lifetime?.abort(); clearCredentials(); result = undefined; summary.textContent = ''; restoreFocus(); }
  }

  return { showTools, showOcr, showOrganization, showSigning };
}
