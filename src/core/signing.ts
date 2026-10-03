/** Local certificate signing. This API verifies mathematics, never certificate trust. */
export interface SigningCertificateSummary {
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validUntil: string;
  fingerprintSha256: string;
  keyAlgorithm: 'RSA';
  keyBits: number;
}

export interface SigningVerification {
  integrity: 'verified';
  trust: 'not-verified';
  revocation: 'not-checked';
  timestamp: 'not-requested';
}

export interface SigningInput {
  pdfBytes: Uint8Array;
  p12Bytes: Uint8Array;
  password: string;
  reason?: string;
  fieldName?: string;
  signal?: AbortSignal;
}

export interface SignedPdfCopy {
  bytes: Uint8Array;
  certificate: SigningCertificateSummary;
  verification: SigningVerification;
}

export type SigningErrorCode = 'input' | 'certificate' | 'unsupported' | 'verification' | 'timeout' | 'cancelled' | 'unavailable';
export class SigningError extends Error {
  constructor(readonly code: SigningErrorCode, message: string) {
    super(message);
    this.name = 'SigningError';
  }
}

export type SigningTask =
  | { kind: 'inspect'; p12Bytes: Uint8Array; password: string }
  | { kind: 'sign'; input: Omit<SigningInput, 'signal'> }
  | { kind: 'verify'; bytes: Uint8Array };
export type SigningTaskResult = SigningCertificateSummary | SignedPdfCopy | SigningVerification;

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_P12_BYTES = 1024 * 1024;
const TIMEOUT_MS = 60_000;

function requireBytes(bytes: Uint8Array, maximum: number, label: string) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > maximum) {
    throw new SigningError('input', `${label} must be between 1 byte and ${maximum / 1024 / 1024} MB.`);
  }
}

function requirePassword(password: string) {
  if (typeof password !== 'string' || password.length > 1024) {
    throw new SigningError('input', 'The certificate password must contain at most 1,024 characters.');
  }
}

function runTask<T extends SigningTaskResult>(task: SigningTask, signal?: AbortSignal): Promise<T> {
  if (!globalThis.crypto?.subtle || typeof Worker === 'undefined') {
    return Promise.reject(new SigningError('unavailable', 'Certificate signing requires a secure browser with Web Crypto and workers.'));
  }
  if (signal?.aborted) return Promise.reject(new SigningError('cancelled', 'Certificate signing was cancelled.'));
  return new Promise((resolve, reject) => {
    // A fresh worker for each operation releases imported keys after completion or cancellation.
    const worker = new Worker(new URL('./signing-worker.ts', import.meta.url), { type: 'module' });
    const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); worker.terminate(); };
    const fail = (error: SigningError) => { finish(); reject(error); };
    const cancel = () => fail(new SigningError('cancelled', 'Certificate signing was cancelled.'));
    const timer = setTimeout(() => fail(new SigningError('timeout', 'Certificate processing timed out. Your original PDF has not changed.')), TIMEOUT_MS);
    signal?.addEventListener('abort', cancel, { once: true });
    worker.onerror = event => {
      event.preventDefault();
      fail(new SigningError('unavailable', 'The certificate worker could not complete the operation. Your original PDF has not changed.'));
    };
    worker.onmessage = event => {
      finish();
      if (event.data.ok) resolve(event.data.result as T);
      else reject(new SigningError(event.data.code, event.data.message));
    };
    const transfers = task.kind === 'sign' ? [task.input.pdfBytes.buffer, task.input.p12Bytes.buffer]
      : task.kind === 'inspect' ? [task.p12Bytes.buffer] : [task.bytes.buffer];
    try { worker.postMessage(task, transfers as ArrayBuffer[]); }
    catch { fail(new SigningError('input', 'The certificate operation could not be started.')); }
  });
}

/** Only public certificate details leave the short-lived worker. Nothing is persisted. */
export async function inspectSigningCertificate(p12Bytes: Uint8Array, password: string, signal?: AbortSignal): Promise<SigningCertificateSummary> {
  requireBytes(p12Bytes, MAX_P12_BYTES, 'Certificate file');
  requirePassword(password);
  return runTask({ kind: 'inspect', p12Bytes: p12Bytes.slice(), password }, signal);
}

/** Produce a new, invisible, basic RSA/SHA-256 certificate signature without network access. */
export async function signPdfCopy(input: SigningInput): Promise<SignedPdfCopy> {
  requireBytes(input.pdfBytes, MAX_PDF_BYTES, 'PDF');
  requireBytes(input.p12Bytes, MAX_P12_BYTES, 'Certificate file');
  requirePassword(input.password);
  for (const [value, limit] of [[input.reason, 500], [input.fieldName, 128]] as const) {
    if (value !== undefined && (typeof value !== 'string' || value.length > limit || /[\u0000-\u001f\u007f]/u.test(value))) {
      throw new SigningError('input', 'Signature metadata contains unsupported characters or is too long.');
    }
  }
  return runTask({ kind: 'sign', input: {
    pdfBytes: input.pdfBytes.slice(), p12Bytes: input.p12Bytes.slice(), password: input.password,
    reason: input.reason, fieldName: input.fieldName,
  } }, input.signal);
}

/** Verify only Folio's single-signature output format; this is not a general PDF trust validator. */
export async function verifySignedPdfCopy(bytes: Uint8Array): Promise<SigningVerification> {
  requireBytes(bytes, MAX_PDF_BYTES + 1024 * 1024, 'Signed PDF');
  return runTask({ kind: 'verify', bytes: bytes.slice() });
}
