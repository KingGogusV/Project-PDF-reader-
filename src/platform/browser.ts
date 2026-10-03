/** Browser integrations. No document bytes, passwords, or file handles are persisted. */
export interface RecentFile {
  name: string;
  size: number;
  lastModified: number;
  openedAt: number;
}

export interface BrowserOutput {
  filename: string;
  message: string;
}

const RECENT_KEY = 'folio.recent.v1';
const SETTING_PREFIX = 'folio.setting.v1.';
const MAX_RECENT = 12;

/** Call directly from a user gesture. Cancellation resolves with an empty array. */
export function pickFiles(): Promise<File[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    input.multiple = true;
    input.hidden = true;
    document.body.append(input);
    const finish = (files: File[]) => {
      input.remove();
      resolve(files);
    };
    input.addEventListener('change', () => finish(Array.from(input.files ?? [])), { once: true });
    // The input cancel event is supported by modern browsers since May 2023.
    // Avoid focus/timer heuristics: they can lose selections on slower mobile pickers.
    input.addEventListener('cancel', () => finish([]), { once: true });
    try {
      input.click();
    } catch (cause) {
      input.remove();
      reject(new Error('The file picker could not open. Try the Open PDF button again.', { cause }));
    }
  });
}

/** A new filename makes the safe-copy workflow explicit; no file is overwritten by us. */
export function exportedPdfName(name: string): string {
  const basename = name.split(/[\\/]/).pop() || 'document';
  const stem = basename.replace(/\.pdf$/i, '').replace(/[<>:"|?*\u0000-\u001f]/g, '_').trim();
  return `${stem || 'document'}-folio.pdf`;
}

function pdfUrl(bytes: Uint8Array): string {
  if (!bytes.byteLength) throw new Error('The PDF is empty. Nothing was exported.');
  // Copy so a detached worker buffer cannot affect the browser's output.
  return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
}

/** Browsers expose download initiation, not whether the user completed a disk save. */
export function downloadPdf(bytes: Uint8Array, name: string): BrowserOutput {
  const filename = exportedPdfName(name);
  const url = pdfUrl(bytes);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  try {
    anchor.click();
  } catch (cause) {
    URL.revokeObjectURL(url);
    throw new Error('The browser could not start the PDF download. Your open document is unchanged.', { cause });
  } finally {
    anchor.remove();
  }
  // Do not revoke immediately: some browsers consume downloads asynchronously.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { filename, message: `Download started: ${filename}. Check your browser downloads to confirm it was saved.` };
}

/** Reserve synchronously in the click handler, before awaiting PDF serialization. */
export function reservePrintWindow(): Window {
  let output: Window | null = null;
  try {
    // Open blank synchronously to detect popup denial, then sever the opener before navigation.
    output = window.open('about:blank', '_blank');
    if (!output) throw new Error('Popup blocked');
    output.opener = null;
    output.document.title = 'Preparing print copy — Folio';
    output.document.body.textContent = 'Preparing a local PDF copy for printing…';
    return output;
  } catch (cause) {
    output?.close();
    throw new Error('The print copy could not open. Allow popups for Folio, or download a copy and print it from your PDF reader.', { cause });
  }
}

/** Opens a local PDF copy for the browser's own print/share controls. Not a print receipt. */
export function printPdf(bytes: Uint8Array, name: string, reservedWindow?: Window): BrowserOutput {
  const filename = exportedPdfName(name);
  let output = reservedWindow;
  let url: string | undefined;
  try {
    output ??= reservePrintWindow();
    if (output.closed) throw new Error('The print window was closed.');
    url = pdfUrl(bytes);
    output.location.replace(url);
  } catch (cause) {
    if (url) URL.revokeObjectURL(url);
    output?.close();
    throw new Error('The print copy could not open. Allow popups for Folio, or download a copy and print it from your PDF reader.', { cause });
  }
  // Retain until the consumer tab closes, allowing its reader to request more data later.
  // Browsers release remaining Blob URLs automatically when this document unloads.
  const timer = window.setInterval(() => {
    if (output.closed) {
      window.clearInterval(timer);
      URL.revokeObjectURL(url);
    }
  }, 2_000);
  // Browsers without a built-in PDF viewer may download the Blob and leave the reserved tab blank.
  window.setTimeout(() => {
    try {
      if (!output.closed && output.location.href === 'about:blank') {
        output.document.title = 'Print copy - Folio';
        output.document.body.textContent = 'Your browser may have downloaded the print copy. Check your downloads, open the PDF in a reader, and choose Print or Share. You can close this tab.';
      }
    } catch { /* A browser PDF viewer may be isolated from the opener; leave its UI alone. */ }
  }, 1_500);
  return { filename, message: 'Print copy sent to your browser. It may open or download the PDF; use its Print or Share controls.' };
}

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch (cause) {
    throw new Error('Browser storage is unavailable. Recent-file names and preferences cannot be read; PDF reading still works.', { cause });
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch (cause) {
    throw new Error('Browser storage is unavailable or full. This preference was not saved; your PDF is unchanged.', { cause });
  }
}

function isRecent(value: unknown): value is RecentFile {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<RecentFile>;
  return typeof item.name === 'string' && item.name.length > 0 && item.name.length <= 4096
    && typeof item.size === 'number' && Number.isSafeInteger(item.size) && item.size >= 0
    && typeof item.lastModified === 'number' && Number.isFinite(item.lastModified) && item.lastModified >= 0
    && typeof item.openedAt === 'number' && Number.isFinite(item.openedAt) && item.openedAt >= 0;
}

export function getRecent(): RecentFile[] {
  const raw = readStored(RECENT_KEY);
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data) || !data.every(isRecent)) throw new Error('Invalid recent-file list');
    return data.slice(0, MAX_RECENT).map(({ name, size, lastModified, openedAt }) => ({ name, size, lastModified, openedAt }));
  } catch (cause) {
    throw new Error('Recent-file history could not be read. Clear recent history to reset it; your PDF files are unaffected.', { cause });
  }
}

export function rememberRecent(file: Pick<File, 'name' | 'size' | 'lastModified'>): void {
  const entry: RecentFile = { name: file.name, size: file.size, lastModified: file.lastModified, openedAt: Date.now() };
  if (!isRecent(entry)) throw new Error('This file’s recent-history metadata is invalid. The PDF itself is unchanged.');
  const remaining = getRecent().filter(item => !(item.name === entry.name && item.size === entry.size && item.lastModified === entry.lastModified));
  writeStored(RECENT_KEY, JSON.stringify([entry, ...remaining].slice(0, MAX_RECENT)));
}

export function clearRecent(): void {
  try {
    window.localStorage.removeItem(RECENT_KEY);
  } catch (cause) {
    throw new Error('Browser storage is unavailable. Recent-file history could not be cleared.', { cause });
  }
}

/** Callers validate values for their setting; malformed JSON is reported instead of hidden. */
export function readSetting<T>(key: string, fallback: T): T {
  const raw = readStored(SETTING_PREFIX + key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (cause) {
    throw new Error(`The ${key} preference could not be read. Choose the setting again to reset it.`, { cause });
  }
}

export function writeSetting(key: string, value: unknown): void {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('This preference has no storable value.');
  writeStored(SETTING_PREFIX + key, serialized);
}
