/** The OS close event is prevented in Rust until the shared document workflow agrees. */
export function registerNativeCloseGuard(
  target: EventTarget,
  prepare: () => Promise<boolean>,
  finish: () => Promise<void>,
  reportError: (error: unknown) => void,
): () => void {
  let busy = false;
  let disposed = false;
  const request = async () => {
    if (busy || disposed) return;
    busy = true;
    try {
      if (await prepare() && !disposed) await finish();
    } catch (error) {
      reportError(error);
    } finally {
      busy = false;
    }
  };
  const listener = () => { void request(); };
  target.addEventListener('folio-native-close-request', listener);
  return () => { disposed = true; target.removeEventListener('folio-native-close-request', listener); };
}
