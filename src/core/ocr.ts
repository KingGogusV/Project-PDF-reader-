import { AnnotationMode, PermissionFlag } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { Bbox, Page } from 'tesseract.js';
import { LocalOcrWorker } from './ocr-worker';

export type PdfRect = [number, number, number, number];
export type PdfQuad = [number, number, number, number, number, number, number, number];
export interface OcrWord {
  text: string;
  confidence: number;
  pixels: Bbox;
  /** Clockwise from top-left in the rendered image, in unrotated PDF user space. */
  pdfQuad: PdfQuad;
  pdfRect: PdfRect;
}
export interface OcrPage {
  pageNumber: number;
  text: string;
  confidence: number;
  pixelWidth: number;
  pixelHeight: number;
  rotation: number;
  scale: number;
  viewBox: PdfRect;
  words: OcrWord[];
}
export interface OcrResult { language: 'eng'; pages: OcrPage[] }
export interface OcrProgress {
  stage: 'preparing' | 'rendering' | 'recognizing' | 'complete';
  pageNumber: number;
  pageIndex: number;
  pageCount: number;
  /** Overall fraction from 0 to 1. */
  progress: number;
  status: string;
}
export interface OcrOptions {
  signal?: AbortSignal;
  onProgress?: (progress: OcrProgress) => void;
  onPage?: (page: OcrPage) => void;
}

export const OCR_MAX_PAGES = 50;
export const OCR_MAX_PIXELS = 4_000_000;
const MAX_DIMENSION = 4096;
const MAX_RESULT_CHARACTERS = 2_000_000;
let jobActive = false;

function cancelled(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new DOMException('OCR cancelled.', 'AbortError');
}

function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(cancelled(signal));
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(cancelled(signal));
    signal.addEventListener('abort', abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

function confidence(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

function wordsForPage(data: Page, viewport: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['getViewport']>): OcrWord[] {
  const words: OcrWord[] = [];
  for (const block of data.blocks ?? []) for (const paragraph of block.paragraphs ?? []) {
    for (const line of paragraph.lines ?? []) for (const word of line.words ?? []) {
      if (!word.text?.trim() || !word.bbox || !Object.values(word.bbox).every(Number.isFinite)) continue;
      const pixels = {
        x0: Math.max(0, Math.min(viewport.width, word.bbox.x0)),
        y0: Math.max(0, Math.min(viewport.height, word.bbox.y0)),
        x1: Math.max(0, Math.min(viewport.width, word.bbox.x1)),
        y1: Math.max(0, Math.min(viewport.height, word.bbox.y1)),
      };
      if (pixels.x1 <= pixels.x0 || pixels.y1 <= pixels.y0) continue;
      const corners = [
        viewport.convertToPdfPoint(pixels.x0, pixels.y0),
        viewport.convertToPdfPoint(pixels.x1, pixels.y0),
        viewport.convertToPdfPoint(pixels.x1, pixels.y1),
        viewport.convertToPdfPoint(pixels.x0, pixels.y1),
      ];
      const xs = corners.map(point => point[0] as number);
      const ys = corners.map(point => point[1] as number);
      words.push({
        text: word.text, confidence: confidence(word.confidence), pixels,
        pdfQuad: corners.flat() as PdfQuad,
        pdfRect: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      });
    }
  }
  return words;
}

/** Recognize selected pages locally. Never writes to the PDF or annotation store. */
export async function recognizePdfPages(pdf: PDFDocumentProxy, pageNumbers: readonly number[], options: OcrOptions = {}): Promise<OcrResult> {
  if (jobActive) throw new Error('An OCR job is already running. Cancel it or wait for it to finish.');
  const pages = [...new Set(pageNumbers)];
  if (!pages.length || pages.length > OCR_MAX_PAGES) throw new Error(`Choose between 1 and ${OCR_MAX_PAGES} pages for OCR.`);
  if (pages.some(page => !Number.isInteger(page) || page < 1 || page > pdf.numPages)) throw new Error('The OCR page selection is outside this document.');
  options.signal?.throwIfAborted();
  jobActive = true;
  const lifetime = new AbortController();
  const cancel = () => lifetime.abort(new DOMException('OCR cancelled.', 'AbortError'));
  options.signal?.addEventListener('abort', cancel, { once: true });
  let worker: LocalOcrWorker | undefined;
  let render: RenderTask | undefined;
  let pageIndex = 0;
  let recognizing = false;
  let pageTimer: ReturnType<typeof setTimeout> | undefined;
  const result: OcrResult = { language: 'eng', pages: [] };
  const report = (stage: OcrProgress['stage'], fraction: number, status: string) => options.onProgress?.({
    stage, pageNumber: pages[pageIndex], pageIndex, pageCount: pages.length,
    progress: stage === 'complete' ? 1 : (pageIndex + fraction) / pages.length, status,
  });
  const stop = () => { render?.cancel(); worker?.terminate(cancelled(lifetime.signal)); };
  lifetime.signal.addEventListener('abort', stop, { once: true });
  try {
    pageTimer = setTimeout(() => lifetime.abort(new Error('OCR initialization timed out. Check the local OCR assets and try again.')), 90_000);
    const permissions = await abortable(pdf.getPermissions(), lifetime.signal);
    if (permissions && !permissions.has(PermissionFlag.COPY)) throw new Error('This PDF does not permit text copying, so OCR is unavailable.');
    report('preparing', 0, 'Loading local English OCR');
    const assets = new URL(`${import.meta.env.BASE_URL}vendor/ocr/`, location.href);
    worker = new LocalOcrWorker(assets, (_status, fraction) => {
      if (!lifetime.signal.aborted && recognizing) report('recognizing', 0.2 + fraction * 0.8, 'Recognizing page text');
    });
    await abortable(worker.initialize(), lifetime.signal);
    clearTimeout(pageTimer);
    pageTimer = undefined;
    let totalCharacters = 0;
    for (pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      lifetime.signal.throwIfAborted();
      pageTimer = setTimeout(() => lifetime.abort(new Error('OCR page processing timed out. Try a smaller page selection.')), 120_000);
      report('rendering', 0, 'Rendering page for OCR');
      const page = await abortable(pdf.getPage(pages[pageIndex]), lifetime.signal);
      const natural = page.getViewport({ scale: 1 });
      if (![natural.width, natural.height].every(value => Number.isFinite(value) && value > 0)) throw new Error('This page has unsupported dimensions.');
      const scale = Math.min(2.5, MAX_DIMENSION / natural.width, MAX_DIMENSION / natural.height, Math.sqrt(OCR_MAX_PIXELS / natural.width / natural.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      try {
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('The browser could not allocate an OCR page image.');
        render = page.render({ canvas, canvasContext: context, viewport, annotationMode: AnnotationMode.DISABLE, background: 'white' });
        await abortable(render.promise, lifetime.signal);
        render = undefined;
        const blob = await abortable(new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('The OCR page image could not be prepared.')), 'image/png')), lifetime.signal);
        const image = new Uint8Array(await abortable(blob.arrayBuffer(), lifetime.signal));
        recognizing = true;
        report('recognizing', 0.2, 'Recognizing page text');
        const recognized = await abortable(worker.recognize(image, Math.max(70, Math.round(72 * scale))), lifetime.signal);
        recognizing = false;
        if (typeof recognized.text !== 'string') throw new Error('The OCR engine returned an invalid text result.');
        totalCharacters += recognized.text.length;
        if (totalCharacters > MAX_RESULT_CHARACTERS) throw new Error('OCR results are too large. Recognize a smaller page selection.');
        const output: OcrPage = {
          pageNumber: pages[pageIndex], text: recognized.text, confidence: confidence(recognized.confidence),
          pixelWidth: canvas.width, pixelHeight: canvas.height, rotation: viewport.rotation, scale,
          viewBox: [...page.view] as PdfRect, words: wordsForPage(recognized, viewport),
        };
        result.pages.push(output);
        options.onPage?.(output);
        lifetime.signal.throwIfAborted();
      } finally {
        render?.cancel();
        render = undefined;
        canvas.width = canvas.height = 0;
        clearTimeout(pageTimer);
        pageTimer = undefined;
      }
    }
    lifetime.signal.throwIfAborted();
    pageIndex = pages.length - 1;
    report('complete', 1, 'Text recognition complete');
    return result;
  } finally {
    clearTimeout(pageTimer);
    worker?.terminate();
    render?.cancel();
    options.signal?.removeEventListener('abort', cancel);
    lifetime.signal.removeEventListener('abort', stop);
    jobActive = false;
  }
}
