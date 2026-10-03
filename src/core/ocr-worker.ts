import type { Page } from 'tesseract.js';

type Action = 'load' | 'loadLanguage' | 'initialize' | 'setParameters' | 'recognize';
type Progress = (status: string, fraction: number) => void;
interface Pending {
  id: string;
  action: Action;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Own the native worker before initialization, so cancel also stops model/core
 * loading. Tesseract.js's public createWorker() exposes it only after init.
 * This narrow protocol is verified against pinned tesseract.js 7.0.0:
 * src/createWorker.js and src/worker-script/index.js. Re-test on every upgrade.
 * We neither alter nor reimplement the OCR engine.
 */
export class LocalOcrWorker {
  private readonly worker: Worker;
  private readonly id = `folio-ocr-${crypto.randomUUID()}`;
  private pending?: Pending;
  private sequence = 0;
  private stopped = false;

  constructor(private readonly assets: URL, private readonly progress: Progress) {
    if (assets.origin !== location.origin) throw new Error('OCR assets must be hosted with the application.');
    this.worker = new Worker(new URL('worker.min.js', assets), { name: 'Folio local OCR' });
    this.worker.onmessage = ({ data }) => {
      const pending = this.pending;
      if (!pending || data?.workerId !== this.id || data?.jobId !== pending.id || data?.action !== pending.action) return;
      if (data.status === 'progress') {
        const fraction = Number(data.data?.progress);
        if (Number.isFinite(fraction)) this.progress(String(data.data?.status ?? ''), Math.max(0, Math.min(1, fraction)));
        return;
      }
      if (data.status === 'resolve') {
        clearTimeout(pending.timer);
        this.pending = undefined;
        pending.resolve(data.data);
      } else if (data.status === 'reject') {
        // Do not forward engine diagnostics that could contain recognized text.
        this.terminate(new Error(pending.action === 'recognize'
          ? 'OCR could not recognize this page. Try a smaller page selection.'
          : 'The local OCR engine could not load. Connect to load its assets, then try again.'));
      }
    };
    this.worker.onerror = event => {
      event.preventDefault();
      this.terminate(new Error('The local OCR worker failed. Your PDF has not changed.'));
    };
    this.worker.onmessageerror = () => this.terminate(new Error('The local OCR worker returned unreadable data.'));
  }

  private run(action: Action, payload: unknown, transfer: Transferable[] = []): Promise<unknown> {
    if (this.stopped) return Promise.reject(new DOMException('OCR cancelled.', 'AbortError'));
    if (this.pending) return Promise.reject(new Error('Only one OCR operation may run at a time.'));
    return new Promise((resolve, reject) => {
      const id = `${++this.sequence}`;
      const timer = setTimeout(() => this.terminate(new Error('OCR timed out. Try fewer pages or a smaller document.')), 90_000);
      this.pending = { id, action, resolve, reject, timer };
      try {
        this.worker.postMessage({ workerId: this.id, jobId: id, action, payload }, transfer);
      } catch {
        this.terminate(new Error('The page could not be sent to the local OCR worker.'));
      }
    });
  }

  async initialize(): Promise<void> {
    await this.run('load', { options: { lstmOnly: true, corePath: new URL('core/', this.assets).href, logging: false } });
    await this.run('loadLanguage', {
      langs: 'eng',
      options: { langPath: new URL('lang/', this.assets).href, cacheMethod: 'none', gzip: true, lstmOnly: true },
    });
    await this.run('initialize', { langs: 'eng', oem: 1, config: {} });
    await this.run('setParameters', { params: { tessedit_pageseg_mode: '3' } });
  }

  async recognize(png: Uint8Array<ArrayBuffer>, dpi: number): Promise<Page> {
    return await this.run('recognize', {
      image: png,
      // No auto rotation: coordinates must describe the PDF.js raster exactly.
      options: { rotateAuto: false, user_defined_dpi: String(dpi) },
      output: { text: true, blocks: true },
    }, [png.buffer]) as Page;
  }

  terminate(reason: Error = new DOMException('OCR cancelled.', 'AbortError')): void {
    if (this.stopped) return;
    this.stopped = true;
    this.worker.terminate();
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.onmessageerror = null;
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(reason);
      this.pending = undefined;
    }
  }
}
