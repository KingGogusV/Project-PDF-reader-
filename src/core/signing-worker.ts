import { executeSigningTask, safeSigningFailure } from './signing-engine';
import type { SigningTask } from './signing';

// Exactly one job per worker. The caller terminates it after result, error, cancellation or timeout.
self.onmessage = async (event: MessageEvent<SigningTask>) => {
  self.onmessage = null;
  try {
    const result = await executeSigningTask(event.data);
    const transfers = 'bytes' in result ? [result.bytes.buffer as ArrayBuffer] : [];
    self.postMessage({ ok: true, result }, { transfer: transfers });
  } catch (error) {
    self.postMessage({ ok: false, ...safeSigningFailure(error) });
  }
};
