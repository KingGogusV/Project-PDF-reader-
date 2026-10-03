/**
 * Device-local PDF storage. Call only after the user consents to device storage/recovery.
 * Owner IDs partition records; they are not encryption or a security boundary against
 * other code/users with access to this browser profile. No document/password is uploaded.
 * The caller must validate PDF revisions with the document controller before saving.
 */
export const LOCAL_LIBRARY_DATABASE_NAME = 'folio-local-library';
export const LOCAL_LIBRARY_SCHEMA_VERSION = 1;

export type LocalLibraryErrorCode = 'UNAVAILABLE' | 'CLOSED' | 'UPGRADE_BLOCKED' | 'CORRUPT'
  | 'NOT_FOUND' | 'CONFLICT' | 'INVALID_INPUT' | 'LIMIT_EXCEEDED' | 'QUOTA_EXCEEDED' | 'STORAGE_FAILURE';

export class LocalLibraryError extends Error {
  readonly code: LocalLibraryErrorCode;
  constructor(code: LocalLibraryErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.name = 'LocalLibraryError';
  }
}

export interface LocalLibraryLimits {
  maxDocuments: number;
  maxStoredBytes: number;
  maxDocumentBytes: number;
}

export const DEFAULT_LOCAL_LIBRARY_LIMITS: Readonly<LocalLibraryLimits> = Object.freeze({
  maxDocuments: 500,
  maxStoredBytes: 512 * 1024 * 1024,
  maxDocumentBytes: 150 * 1024 * 1024,
});

export interface LocalDocumentMetadata {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  checkpointAt: number;
  revision: number;
  originalSize: number;
  latestSize: number;
  originalSha256: string;
  latestSha256: string;
  latestIsOriginal: boolean;
  needsRecovery: boolean;
}

export interface LocalDocument extends LocalDocumentMetadata {
  originalBytes: Uint8Array<ArrayBuffer>;
  latestBytes: Uint8Array<ArrayBuffer>;
}

export interface SaveLocalRevision {
  /** A complete PDF that has already passed the controller's save/reopen checks. */
  bytes: Uint8Array;
  /** Compare-and-swap: never overwrite a newer save from another tab/session. */
  expectedRevision: number;
  needsRecovery: boolean;
}

export interface LocalStorageEstimate {
  documentCount: number;
  /** Original plus distinct latest PDF bytes; excludes browser database overhead. */
  storedBytes: number;
  limits: Readonly<LocalLibraryLimits>;
  browserUsage?: number;
  browserQuota?: number;
  persisted?: boolean;
}

type DocumentRecord = LocalDocumentMetadata & { owner: string };
type BytesRecord = { schemaVersion: 1; owner: string; id: string; bytes: Blob };
type UsageRecord = { schemaVersion: 1; owner: string; storedBytes: number; documentCount: number };
const STORES = ['documents', 'originals', 'latest', 'usage'];

function failure(error: unknown): LocalLibraryError {
  if (error instanceof LocalLibraryError) return error;
  const name = (error as { name?: string })?.name;
  if (name === 'QuotaExceededError') return new LocalLibraryError('QUOTA_EXCEEDED', 'Device storage is full. The previous recovery copy and original are unchanged. Export a copy or free storage before trying again.', { cause: error });
  if (name === 'SecurityError' || name === 'NotAllowedError') return new LocalLibraryError('UNAVAILABLE', 'This browser does not allow local document storage. Keep this document open and export a copy.', { cause: error });
  if (name === 'VersionError') return new LocalLibraryError('UNAVAILABLE', 'This local library was created by a newer Folio version. Reload the latest application; do not clear site data.', { cause: error });
  return new LocalLibraryError('STORAGE_FAILURE', 'The local library operation did not complete. Existing stored documents were not intentionally removed. Keep unsaved work open and export a copy.', { cause: error });
}

function requireId(id: string): void {
  if (typeof id !== 'string' || !id || id.length > 128) throw new LocalLibraryError('INVALID_INPUT', 'The local document identifier is invalid.');
}

function requireRevision(revision: number): void {
  if (!Number.isSafeInteger(revision) || revision < 1) throw new LocalLibraryError('INVALID_INPUT', 'A valid current document revision is required.');
}

function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error ?? new Error('IndexedDB request failed'));
  });
}

/** Work must await only IndexedDB requests; hashing/Blob reads happen outside transactions. */
async function transaction<T>(db: IDBDatabase, stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => Promise<T>): Promise<T> {
  let tx: IDBTransaction;
  try {
    try { tx = db.transaction(stores, mode, mode === 'readwrite' ? { durability: 'strict' } : undefined); }
    catch (error) { if (!(error instanceof TypeError)) throw error; tx = db.transaction(stores, mode); }
  } catch (error) { throw failure(error); }
  const completed = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('The storage transaction was aborted.'));
    tx.onerror = () => { /* The abort event settles the transaction after rollback. */ };
  });
  // Attach before any asynchronous work, so an early quota abort is never unhandled.
  void completed.catch(() => undefined);
  try {
    const result = await work(tx);
    await completed;
    return result;
  } catch (error) {
    try { tx.abort(); } catch { /* It may already have aborted or completed. */ }
    await completed.catch(() => undefined);
    throw failure(error);
  }
}

function metadata(record: DocumentRecord): LocalDocumentMetadata {
  const { owner: _owner, ...result } = record;
  return result;
}

function documentRecord(value: unknown, owner: string, id?: string): DocumentRecord {
  const item = value as Partial<DocumentRecord> | undefined;
  if (!item) throw new LocalLibraryError('NOT_FOUND', 'This document is not stored in the current local library.');
  const size = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n > 0;
  const date = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  const digest = (s: unknown) => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
  if (item.schemaVersion !== 1 || item.owner !== owner || typeof item.id !== 'string' || !item.id || (id !== undefined && item.id !== id)
    || typeof item.name !== 'string' || !item.name || item.name.length > 1024
    || !size(item.revision) || !size(item.originalSize) || !size(item.latestSize)
    || !date(item.createdAt) || !date(item.updatedAt) || !date(item.checkpointAt)
    || !digest(item.originalSha256) || !digest(item.latestSha256)
    || typeof item.needsRecovery !== 'boolean' || typeof item.latestIsOriginal !== 'boolean'
    || (item.latestIsOriginal && (item.latestSha256 !== item.originalSha256 || item.latestSize !== item.originalSize))) {
    throw new LocalLibraryError('CORRUPT', 'Local document metadata could not be verified. Stored originals have not been deleted.');
  }
  return item as DocumentRecord;
}

function usageRecord(value: unknown, owner: string): UsageRecord {
  const item = value as Partial<UsageRecord> | undefined;
  if (!item) return { schemaVersion: 1, owner, storedBytes: 0, documentCount: 0 };
  if (item.schemaVersion !== 1 || item.owner !== owner || !Number.isSafeInteger(item.storedBytes) || item.storedBytes! < 0
    || !Number.isSafeInteger(item.documentCount) || item.documentCount! < 0) {
    throw new LocalLibraryError('CORRUPT', 'Local storage accounting could not be verified. No documents were removed.');
  }
  return item as UsageRecord;
}

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new LocalLibraryError('UNAVAILABLE', 'Verified local storage requires a secure browser context (HTTPS or localhost).');
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
}

function hasPdfHeader(bytes: Uint8Array): boolean {
  return new TextDecoder('latin1').decode(bytes.subarray(0, 1024)).includes('%PDF-');
}

async function verifyBytes(value: unknown, owner: string, id: string, expectedSize: number, expectedDigest: string): Promise<Uint8Array<ArrayBuffer>> {
  const item = value as Partial<BytesRecord> | undefined;
  if (!item || item.schemaVersion !== 1 || item.owner !== owner || item.id !== id || !(item.bytes instanceof Blob) || item.bytes.size !== expectedSize) {
    throw new LocalLibraryError('CORRUPT', 'The stored PDF copy is missing or damaged. Do not clear site data; the original may still be recoverable.');
  }
  const bytes = new Uint8Array(await item.bytes.arrayBuffer());
  if (!hasPdfHeader(bytes) || await sha256(bytes) !== expectedDigest) {
    throw new LocalLibraryError('CORRUPT', 'The stored PDF copy failed its integrity check. The original is kept separately; try opening the original.');
  }
  return bytes;
}

export class LocalLibrary {
  readonly limits: Readonly<LocalLibraryLimits>;
  private readonly owner: string;
  private db?: IDBDatabase;
  private opening?: Promise<IDBDatabase>;
  private closed = false;

  constructor(ownerId: string | null, options: { limits?: Partial<LocalLibraryLimits> } = {}) {
    if (ownerId !== null && (typeof ownerId !== 'string' || !ownerId.trim() || ownerId.length > 256)) {
      throw new LocalLibraryError('INVALID_INPUT', 'A valid account identifier or an explicit guest library is required.');
    }
    this.owner = ownerId === null ? 'guest' : `account:${ownerId}`;
    this.limits = Object.freeze({ ...DEFAULT_LOCAL_LIBRARY_LIMITS, ...options.limits });
    if (Object.values(this.limits).some(value => !Number.isSafeInteger(value) || value < 1)) {
      throw new LocalLibraryError('INVALID_INPUT', 'Local storage limits must be positive whole numbers.');
    }
  }

  private async database(): Promise<IDBDatabase> {
    if (this.closed) throw new LocalLibraryError('CLOSED', 'This library session is closed. Open the current account library again.');
    if (this.db) return this.db;
    if (this.opening) return this.opening;
    this.opening = new Promise<IDBDatabase>((resolve, reject) => {
      let operation: IDBOpenDBRequest;
      let rejected = false;
      try {
        if (!globalThis.indexedDB) throw new LocalLibraryError('UNAVAILABLE', 'This browser does not support a local document library. Export your files instead.');
        operation = indexedDB.open(LOCAL_LIBRARY_DATABASE_NAME, LOCAL_LIBRARY_SCHEMA_VERSION);
      } catch (error) { reject(failure(error)); return; }
      operation.onupgradeneeded = () => {
        const db = operation.result;
        // Version 1 creates fresh stores only. Future upgrades must migrate, never reset.
        if (!db.objectStoreNames.contains('documents')) db.createObjectStore('documents', { keyPath: ['owner', 'id'] }).createIndex('byOwner', 'owner');
        if (!db.objectStoreNames.contains('originals')) db.createObjectStore('originals', { keyPath: ['owner', 'id'] });
        if (!db.objectStoreNames.contains('latest')) db.createObjectStore('latest', { keyPath: ['owner', 'id'] });
        if (!db.objectStoreNames.contains('usage')) db.createObjectStore('usage', { keyPath: 'owner' });
      };
      operation.onblocked = () => {
        rejected = true;
        reject(new LocalLibraryError('UPGRADE_BLOCKED', 'Another Folio tab is blocking the local library upgrade. Close other Folio tabs and try again; do not clear site data.'));
      };
      operation.onerror = () => reject(failure(operation.error));
      operation.onsuccess = () => {
        const db = operation.result;
        if (rejected || this.closed) {
          db.close();
          reject(new LocalLibraryError('CLOSED', 'The local library session closed before it was ready.'));
          return;
        }
        db.onversionchange = () => { db.close(); this.db = undefined; this.opening = undefined; };
        db.onclose = () => { this.db = undefined; this.opening = undefined; };
        this.db = db;
        resolve(db);
      };
    });
    try { return await this.opening; }
    finally { this.opening = undefined; }
  }

  private async prepare(bytes: Uint8Array): Promise<{ bytes: Blob; digest: string; size: number }> {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || !hasPdfHeader(bytes)) throw new LocalLibraryError('INVALID_INPUT', 'A nonempty PDF is required for local storage.');
    if (bytes.byteLength > this.limits.maxDocumentBytes) throw new LocalLibraryError('LIMIT_EXCEEDED', 'This PDF exceeds the local library per-document size limit. Export it as a file instead.');
    const copy = new Uint8Array(bytes);
    return { bytes: new Blob([copy], { type: 'application/pdf' }), digest: await sha256(copy), size: copy.byteLength };
  }

  private checkBudget(usage: UsageRecord): void {
    if (usage.documentCount > this.limits.maxDocuments || usage.storedBytes > this.limits.maxStoredBytes) {
      throw new LocalLibraryError('LIMIT_EXCEEDED', 'This local library has reached its document or storage limit. Export a copy or remove an unneeded stored document before trying again.');
    }
    if (usage.documentCount < 0 || usage.storedBytes < 0) throw new LocalLibraryError('CORRUPT', 'Local storage accounting is inconsistent. No document was deleted.');
  }

  async add(input: { name: string; bytes: Uint8Array }): Promise<LocalDocumentMetadata> {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 1024 || /[\u0000-\u001f]/.test(input.name)) throw new LocalLibraryError('INVALID_INPUT', 'A valid document filename is required.');
    const prepared = await this.prepare(input.bytes);
    const db = await this.database();
    const id = crypto.randomUUID();
    const now = Date.now();
    const record: DocumentRecord = { schemaVersion: 1, owner: this.owner, id, name: input.name, createdAt: now, updatedAt: now, checkpointAt: now,
      revision: 1, originalSize: prepared.size, latestSize: prepared.size, originalSha256: prepared.digest, latestSha256: prepared.digest, latestIsOriginal: true, needsRecovery: false };
    return transaction(db, STORES, 'readwrite', async tx => {
      const usage = usageRecord(await request(tx.objectStore('usage').get(this.owner)), this.owner);
      usage.documentCount++;
      usage.storedBytes += prepared.size;
      this.checkBudget(usage);
      await request(tx.objectStore('originals').add({ schemaVersion: 1, owner: this.owner, id, bytes: prepared.bytes } satisfies BytesRecord));
      await request(tx.objectStore('documents').add(record));
      await request(tx.objectStore('usage').put(usage));
      return metadata(record);
    });
  }

  async list(options: { recoveryOnly?: boolean } = {}): Promise<LocalDocumentMetadata[]> {
    const db = await this.database();
    return transaction(db, ['documents'], 'readonly', async tx => {
      const records = await request(tx.objectStore('documents').index('byOwner').getAll(IDBKeyRange.only(this.owner)));
      return records.map(value => metadata(documentRecord(value, this.owner))).filter(item => !options.recoveryOnly || item.needsRecovery)
        .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
    });
  }

  async read(id: string): Promise<LocalDocument> {
    requireId(id);
    const db = await this.database();
    const snapshot = await transaction(db, ['documents', 'originals', 'latest'], 'readonly', async tx => {
      const key = [this.owner, id];
      const record = documentRecord(await request(tx.objectStore('documents').get(key)), this.owner, id);
      const original = await request(tx.objectStore('originals').get(key));
      const latest = record.latestIsOriginal ? original : await request(tx.objectStore('latest').get(key));
      return { record, original, latest };
    });
    try {
      const originalBytes = await verifyBytes(snapshot.original, this.owner, id, snapshot.record.originalSize, snapshot.record.originalSha256);
      const latestBytes = snapshot.record.latestIsOriginal ? originalBytes.slice() : await verifyBytes(snapshot.latest, this.owner, id, snapshot.record.latestSize, snapshot.record.latestSha256);
      return { ...metadata(snapshot.record), originalBytes, latestBytes };
    } catch (error) { throw failure(error); }
  }

  /** Recovery fallback when only the latest checkpoint is damaged; never silently substituted. */
  async readOriginal(id: string): Promise<LocalDocumentMetadata & { bytes: Uint8Array<ArrayBuffer> }> {
    requireId(id);
    const db = await this.database();
    const snapshot = await transaction(db, ['documents', 'originals'], 'readonly', async tx => {
      const key = [this.owner, id];
      const record = documentRecord(await request(tx.objectStore('documents').get(key)), this.owner, id);
      return { record, original: await request(tx.objectStore('originals').get(key)) };
    });
    try { return { ...metadata(snapshot.record), bytes: await verifyBytes(snapshot.original, this.owner, id, snapshot.record.originalSize, snapshot.record.originalSha256) }; }
    catch (error) { throw failure(error); }
  }

  async saveRevision(id: string, revision: SaveLocalRevision): Promise<LocalDocumentMetadata> {
    requireId(id);
    requireRevision(revision.expectedRevision);
    if (typeof revision.needsRecovery !== 'boolean') throw new LocalLibraryError('INVALID_INPUT', 'The recovery state must be explicit.');
    const prepared = await this.prepare(revision.bytes);
    const db = await this.database();
    return transaction(db, STORES, 'readwrite', async tx => {
      const key = [this.owner, id];
      const record = documentRecord(await request(tx.objectStore('documents').get(key)), this.owner, id);
      if (record.revision !== revision.expectedRevision) throw new LocalLibraryError('CONFLICT', 'Another tab saved a newer copy of this document. Your current edits are still open; export them before reopening the stored copy.');
      const usage = usageRecord(await request(tx.objectStore('usage').get(this.owner)), this.owner);
      const latestIsOriginal = prepared.digest === record.originalSha256;
      usage.storedBytes += (latestIsOriginal ? 0 : prepared.size) - (record.latestIsOriginal ? 0 : record.latestSize);
      this.checkBudget(usage);
      const updated: DocumentRecord = { ...record, revision: record.revision + 1, updatedAt: Date.now(), checkpointAt: Date.now(),
        latestSize: prepared.size, latestSha256: prepared.digest, latestIsOriginal, needsRecovery: revision.needsRecovery };
      if (latestIsOriginal) await request(tx.objectStore('latest').delete(key));
      // Write the supplied verified bytes even when their digest matches metadata:
      // this also repairs a damaged checkpoint without trusting its old Blob.
      else await request(tx.objectStore('latest').put({ schemaVersion: 1, owner: this.owner, id, bytes: prepared.bytes } satisfies BytesRecord));
      await request(tx.objectStore('documents').put(updated));
      await request(tx.objectStore('usage').put(usage));
      return metadata(updated);
    });
  }

  /** Acknowledges the recovery notice only; keeps original and latest document bytes. */
  async markRecovered(id: string, expectedRevision: number): Promise<LocalDocumentMetadata> {
    requireId(id);
    requireRevision(expectedRevision);
    const db = await this.database();
    return transaction(db, ['documents'], 'readwrite', async tx => {
      const record = documentRecord(await request(tx.objectStore('documents').get([this.owner, id])), this.owner, id);
      if (record.revision !== expectedRevision) throw new LocalLibraryError('CONFLICT', 'A newer recovery copy exists. Reopen the stored copy before acknowledging it.');
      const updated = { ...record, needsRecovery: false, updatedAt: Date.now(), revision: record.revision + 1 };
      await request(tx.objectStore('documents').put(updated));
      return metadata(updated);
    });
  }

  async remove(id: string, expectedRevision: number): Promise<void> {
    requireId(id);
    requireRevision(expectedRevision);
    const db = await this.database();
    await transaction(db, STORES, 'readwrite', async tx => {
      const key = [this.owner, id];
      const record = documentRecord(await request(tx.objectStore('documents').get(key)), this.owner, id);
      if (record.revision !== expectedRevision) throw new LocalLibraryError('CONFLICT', 'This document changed in another tab. Refresh the library before deleting it.');
      const usage = usageRecord(await request(tx.objectStore('usage').get(this.owner)), this.owner);
      usage.documentCount--;
      usage.storedBytes -= record.originalSize + (record.latestIsOriginal ? 0 : record.latestSize);
      // Deletion must remain possible after a configured budget is lowered.
      if (usage.documentCount < 0 || usage.storedBytes < 0) throw new LocalLibraryError('CORRUPT', 'Local storage accounting is inconsistent. No document was deleted.');
      for (const store of ['documents', 'originals', 'latest']) await request(tx.objectStore(store).delete(key));
      await request(tx.objectStore('usage').put(usage));
    });
  }

  async estimateStorage(): Promise<LocalStorageEstimate> {
    const db = await this.database();
    const usage = await transaction(db, ['usage'], 'readonly', async tx => usageRecord(await request(tx.objectStore('usage').get(this.owner)), this.owner));
    try {
      const estimate = await navigator.storage?.estimate?.();
      const persisted = await navigator.storage?.persisted?.();
      return { documentCount: usage.documentCount, storedBytes: usage.storedBytes, limits: this.limits, browserUsage: estimate?.usage, browserQuota: estimate?.quota, persisted };
    } catch (error) { throw failure(error); }
  }

  /** Browser-controlled retention request, not a backup or an absolute eviction guarantee. */
  async requestPersistence(): Promise<'granted' | 'denied' | 'unsupported'> {
    if (this.closed) throw new LocalLibraryError('CLOSED', 'The local library session is closed.');
    if (!navigator.storage?.persist) return 'unsupported';
    try {
      if (await navigator.storage.persisted?.()) return 'granted';
      return await navigator.storage.persist() ? 'granted' : 'denied';
    } catch (error) { throw failure(error); }
  }

  close(): void {
    this.closed = true;
    this.db?.close();
    this.db = undefined;
  }
}

export function createLocalLibrary(ownerId: string | null, options: { limits?: Partial<LocalLibraryLimits> } = {}): LocalLibrary {
  return new LocalLibrary(ownerId, options);
}
