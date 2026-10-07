/** Binary transfer to a dialog-selected new copy. No path or file access crosses this adapter. */
export type NativeSaveInvoke = <T>(
  command: string,
  args?: Record<string, unknown> | Uint8Array,
  options?: { headers: Record<string, string> },
) => Promise<T>;

export interface NativeSaveReceipt {
  filename: string;
  byteLength: number;
  sha256: string;
}

const MAX_OUTPUT_BYTES = 256 * 1024 * 1024;
const CHUNK_BYTES = 1024 * 1024;
const isFilename = (value: unknown): value is string => typeof value === 'string'
  && value.length > 0 && value.length <= 255 && !/[\\/<>:"|?*\u0000-\u001f]/.test(value)
  && /\.pdf$/i.test(value);
const isToken = (value: unknown): value is string => typeof value === 'string'
  && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);

/** Null means OS dialog cancellation; a receipt means the verified disk write completed. */
export async function saveNativePdfCopy(
  bytes: Uint8Array,
  filename: string,
  invoke: NativeSaveInvoke,
): Promise<NativeSaveReceipt | null> {
  const call: NativeSaveInvoke = async (command, args, options) => {
    try { return await invoke(command, args, options); }
    catch (error) {
      // Rust errors are sanitized user-facing strings, not Error instances.
      throw error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'The native save operation failed.');
    }
  };
  if (typeof filename !== 'string' || filename.length > 4096 || !/\.pdf$/i.test(filename)
    || /[\\/<>:"|?*\u0000-\u001f]/.test(filename)) throw new Error('Choose a valid PDF copy filename.');
  // Leave room for the extension on filesystems whose filename limit counts UTF-8 bytes.
  let stem = '';
  let nameBytes = 0;
  for (const character of filename.slice(0, -4)) {
    const size = new TextEncoder().encode(character).byteLength;
    if (nameBytes + size > 200) break;
    stem += character; nameBytes += size;
  }
  filename = `${stem || 'document-folio'}.pdf`;
  if (bytes.byteLength < 8 || bytes.byteLength > MAX_OUTPUT_BYTES) {
    throw new Error('Native PDF copies must be between 8 bytes and 256 MB. Your document remains open.');
  }
  // Keep the exported snapshot stable even if a caller changes its buffer while the dialog is open.
  const snapshot = new Uint8Array(bytes);
  // Match the reader's tolerated header prefix; the controller owns full PDF validation.
  if (!String.fromCharCode(...snapshot.subarray(0, 1024)).includes('%PDF-')) throw new Error('The copy has no PDF header. Nothing was saved.');
  const digest = await crypto.subtle.digest('SHA-256', snapshot.buffer);
  const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const selection = await call<{ token: string; filename: string } | null>('begin_pdf_save', {
    filename, byteLength: snapshot.byteLength, sha256,
  });
  if (selection === null) return null;
  if (!selection || !isToken(selection.token)) throw new Error('Folio received an invalid save transaction. Your changes remain open.');
  let complete = false;
  let failure: unknown;
  try {
    if (!isFilename(selection.filename)) throw new Error('Folio received an invalid PDF copy filename.');
    for (let offset = 0; offset < snapshot.byteLength; offset += CHUNK_BYTES) {
      const chunk = snapshot.subarray(offset, Math.min(offset + CHUNK_BYTES, snapshot.byteLength));
      const written = await call<number>('append_pdf_save', chunk, {
        headers: { 'x-folio-save-token': selection.token, 'x-folio-save-offset': String(offset) },
      });
      if (written !== offset + chunk.byteLength) throw new Error('The native PDF write was incomplete.');
    }
    const receipt = await call<NativeSaveReceipt>('finish_pdf_save', { token: selection.token });
    if (!receipt || receipt.filename !== selection.filename || receipt.byteLength !== snapshot.byteLength || receipt.sha256 !== sha256) {
      throw new Error('Folio could not confirm the complete PDF disk write.');
    }
    complete = true;
    return receipt;
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    if (!complete) {
      try { await call<void>('cancel_pdf_save', { token: selection.token }); }
      catch (cleanupError) {
        throw new Error('The save could not be confirmed and temporary-file cleanup failed. Your changes remain open.', {
          cause: new AggregateError([failure, cleanupError], 'Native save and cleanup failed'),
        });
      }
    }
  }
}
