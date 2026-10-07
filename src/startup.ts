import './style.css';
import { missingRuntimeCapabilities, showRuntimeUpdateHelp } from './platform/runtime-compatibility';
import { registerNativeCloseGuard } from './platform/native-close';
import { retireNativeOfflineAssets } from './platform/native-offline-cache';

const root = document.querySelector<HTMLDivElement>('#app')!;
// Match the pinned Tauri API's isTauri() without evaluating that module.
const native = Boolean((globalThis as typeof globalThis & { isTauri?: unknown }).isTauri);
function registerEmptyNativeCloseGuard(): void {
  if (native) {
    // No document interaction has started before main's close handoff. Reuse its close
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
}

async function start(): Promise<void> {
  if (missingRuntimeCapabilities().length) {
    showRuntimeUpdateHelp(root, native);
    registerEmptyNativeCloseGuard();
    return;
  }
  if (native) {
    try { await retireNativeOfflineAssets(window.location.href); }
    catch {
      // Cleanup failed before importing any application/document code.
      showRuntimeUpdateHelp(root, native, true);
      registerEmptyNativeCloseGuard();
      return;
    }
  }
  let readerOwnsClose = false;
  const handoff = () => { readerOwnsClose = true; };
  if (native) window.addEventListener('folio-native-close-guard-ready', handoff);
  try { await import('./main'); }
  catch {
    showRuntimeUpdateHelp(root, native, true, readerOwnsClose);
    // Main claims ownership before installing any document interaction handler.
    // A missing/early-faulting module is empty; a reader that claimed ownership
    // keeps its normal unsaved-close guard even if later initialization fails.
    if (native && !readerOwnsClose) registerEmptyNativeCloseGuard();
  } finally {
    if (native) window.removeEventListener('folio-native-close-guard-ready', handoff);
  }
}

void start();
