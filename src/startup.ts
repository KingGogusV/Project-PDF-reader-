import './style.css';
import { missingRuntimeCapabilities, showRuntimeUpdateHelp } from './platform/runtime-compatibility';
import { registerNativeCloseGuard } from './platform/native-close';

const root = document.querySelector<HTMLDivElement>('#app')!;
// Match the pinned Tauri API's isTauri() without evaluating that module.
const native = Boolean((globalThis as typeof globalThis & { isTauri?: unknown }).isTauri);
if (missingRuntimeCapabilities().length) {
  showRuntimeUpdateHelp(root, native);
  if (native) {
    // No application/document module has been imported. Reuse its existing close
    // command through the exact transport used by pinned @tauri-apps/api 2.12.1.
    // Do not bypass the normal unsaved guard after a partially evaluated main.
    registerNativeCloseGuard(window, async () => true, async () => {
      const transport = (window as Window & {
        __TAURI_INTERNALS__?: { invoke<T>(command: string): Promise<T> };
      }).__TAURI_INTERNALS__;
      if (!transport || typeof transport.invoke !== 'function') throw new Error('The close service is unavailable.');
      await transport.invoke<void>('finish_close');
    }, () => {
      const message = root.querySelector('[role="alert"]');
      if (message) message.textContent = 'Folio remains open because it could not finish closing. Try the window close button again.';
    });
  }
} else {
  void import('./main').catch(() => showRuntimeUpdateHelp(root, native, true));
}
