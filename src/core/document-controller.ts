import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { PDFViewer, EventBus, PDFLinkService, PDFFindController } from 'pdfjs-dist/legacy/web/pdf_viewer.mjs';
import type { AnnotationEditorUIManager } from 'pdfjs-dist/types/src/display/editor/tools';

// The component distribution deliberately reads this global during evaluation.
// Importing the component dynamically preserves that required evaluation order.
Object.assign(globalThis, { pdfjsLib: pdfjs });
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const componentsPromise = import('pdfjs-dist/legacy/web/pdf_viewer.mjs');

export type ReaderTool = 'select' | 'highlight' | 'text' | 'draw';
export interface ReaderState {
  loading: boolean;
  page: number;
  pages: number;
  scale: number;
  dirty: boolean;
  /** Monotonic local content revision, including unfinished text annotation drafts. */
  revision: number;
  /** The native editor has an unfinished operation which cannot yet be checkpointed. */
  checkpointPending: boolean;
  tool: ReaderTool;
  canUndo: boolean;
  canRedo: boolean;
  canPrint: boolean;
  canCopy: boolean;
  searchCount: number;
  searchCurrent: number;
  readOnlyReason?: string;
  error?: string;
  notice?: string;
  renderMs?: number;
}
export type PasswordHandler = (reason: number) => Promise<string | null>;
export type OutlineItem = NonNullable<Awaited<ReturnType<PDFDocumentProxy['getOutline']>>>[number];

export interface DocumentCheckpoint {
  bytes: Uint8Array;
  /** Revision captured when this queued operation started serializing. */
  revision: number;
  /** PDF.js document identifier, not a cryptographic integrity checksum. */
  fingerprint: string;
  /** Whether this snapshot differed from the last explicitly acknowledged export. */
  modified: boolean;
}

export class CheckpointDeferredError extends Error {
  constructor() {
    super('Recovery is pending until the current annotation edit is finished.');
    this.name = 'CheckpointDeferredError';
  }
}

interface SerializedCopy extends DocumentCheckpoint { hash: string }

const TOOL_MODES: Record<ReaderTool, number> = {
  select: pdfjs.AnnotationEditorType.NONE,
  highlight: pdfjs.AnnotationEditorType.HIGHLIGHT,
  text: pdfjs.AnnotationEditorType.FREETEXT,
  draw: pdfjs.AnnotationEditorType.INK,
};
const MAX_FILE_BYTES = 150 * 1024 * 1024;
const assets = new URL(`${import.meta.env.BASE_URL}vendor/pdfjs/`, location.href).href;

function loadingOptions(data: Uint8Array) {
  return {
    data,
    cMapUrl: `${assets}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assets}standard_fonts/`,
    wasmUrl: `${assets}wasm/`,
    iccUrl: `${assets}iccs/`,
    enableXfa: false,
    disableAutoFetch: true,
    canvasMaxAreaInBytes: 32 * 1024 * 1024,
    // Fail instead of presenting incomplete operators as a successful render.
    stopAtErrors: true,
  };
}

function messageFor(error: unknown): string {
  const e = error as { name?: string; message?: string };
  if (e?.name === 'InvalidPDFException') return 'This PDF is damaged or unsupported. Your original file has not changed.';
  if (e?.name === 'PasswordException') return 'The PDF could not be opened with that password.';
  if (e?.name === 'AbortException') return 'Opening cancelled.';
  return e?.message || 'The document could not be processed. Your original file has not changed.';
}

function sameFieldValue(expected: unknown, actual: unknown): boolean {
  const normalize = (value: unknown) => Array.isArray(value) && value.length === 1 ? value[0] : value;
  return JSON.stringify(normalize(expected)) === JSON.stringify(normalize(actual));
}

/** Checks actual persisted widget values and added/changed annotation objects. */
async function verifyChanges(reopened: PDFDocumentProxy, changes: Map<string, any> | null) {
  if (!changes?.size) return;
  const fieldChanges = [...changes].filter(([, value]) => value.annotationType === undefined && !value.deleted && 'value' in value);
  if (fieldChanges.length) {
    const fields = await reopened.getFieldObjects();
    const byId = new Map<string, Record<string, any>>();
    for (const widgets of fields?.values() ?? []) {
      for (const widget of widgets as Record<string, any>[]) byId.set(widget.id, widget);
    }
    for (const [id, change] of fieldChanges) {
      const field = byId.get(id);
      if (!field) throw new Error('A changed form field is missing from the saved copy.');
      // Every radio widget reports the group's selected export value. An
      // unchecked widget therefore need not report "Off" when another is set.
      if (typeof change.value === 'boolean') {
        if (!['checkbox', 'radiobutton'].includes(field.type) || sameFieldValue(field.exportValues, field.value) !== change.value) {
          throw new Error('A checked form value did not survive export.');
        }
      } else if (!sameFieldValue(change.value, field.value)) throw new Error('A form value did not survive export.');
    }
  }
  const pageAnnotations = new Map<number, any[]>();
  for (const change of changes.values()) {
    if (typeof change.pageIndex !== 'number') continue;
    const pageNumber = change.pageIndex + 1;
    if (!pageAnnotations.has(pageNumber)) {
      pageAnnotations.set(pageNumber, await (await reopened.getPage(pageNumber)).getAnnotations());
    }
    const annotations = pageAnnotations.get(pageNumber)!;
    if (change.deleted) {
      if (annotations.some(annotation => annotation.id === change.id)) throw new Error('An annotation deletion did not survive export.');
      continue;
    }
    if (typeof change.annotationType !== 'number') continue;
    const match = annotations.findIndex(annotation => {
      // PDF.js stores a freehand highlighter as /Ink /IT /InkHighlight;
      // text-selection highlights use the PDF /Highlight subtype.
      const freeHighlight = change.annotationType === pdfjs.AnnotationEditorType.HIGHLIGHT && !change.quadPoints;
      const expectedType = freeHighlight ? pdfjs.AnnotationType.INK : change.annotationType;
      if (annotation.annotationType !== expectedType) return false;
      if (freeHighlight && annotation.it !== 'InkHighlight') return false;
      if (change.id && annotation.id !== change.id) return false;
      if (change.rect && !change.rect.every((value: number, index: number) => Math.abs(value - annotation.rect[index]) < 0.1)) return false;
      if (change.annotationType === pdfjs.AnnotationEditorType.FREETEXT && annotation.contentsObj?.str !== change.value) return false;
      return true;
    });
    if (match < 0) throw new Error('An annotation did not survive export.');
    annotations.splice(match, 1);
  }
}

/** One local document, one worker, one bounded page-rendering cache. */
export class ReaderController {
  private _file?: File;
  private _pdfDocument?: PDFDocumentProxy;
  private _viewer?: PDFViewer;
  private loadingTask?: PDFDocumentLoadingTask;
  private originalBytes?: Uint8Array<ArrayBuffer>;
  private eventBus?: EventBus;
  private linkService?: PDFLinkService;
  private findController?: PDFFindController;
  private editorManager?: AnnotationEditorUIManager;
  private readonly editorSignals = new Set<AbortSignal>();
  private readonly lifetime = new AbortController();
  private destroyed = false;
  private openedAt = 0;
  private lastQuery = '';
  private savedHash = '';
  private exportedHash?: string;
  private observedHash = '';
  private observedDraft = '';
  private draftElement?: HTMLElement;
  private drawingPointers = new Set<number>();
  private outputQueue: Promise<void> = Promise.resolve();
  private dirtyTimer?: ReturnType<typeof setTimeout>;
  private thumbnailQueue: Promise<void> = Promise.resolve();
  private thumbnailTask?: RenderTask;
  private _state: ReaderState = {
    loading: false, page: 1, pages: 0, scale: 1, dirty: false, revision: 0, checkpointPending: false, tool: 'select',
    canUndo: false, canRedo: false, canPrint: false, canCopy: false,
    searchCount: 0, searchCurrent: 0,
  };

  constructor(readonly container: HTMLElement, private readonly onState: (state: ReaderState) => void) {
    container.addEventListener('input', event => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('.annotationEditorLayer') && target.isContentEditable) {
        this.draftElement = target;
      }
    }, { signal: this.lifetime.signal });
    for (const event of ['input', 'change', 'pointerup', 'keyup', 'focusout']) {
      container.addEventListener(event, () => this.scheduleDirtyCheck(), { signal: this.lifetime.signal });
    }
    container.addEventListener('pointerdown', event => {
      if (['draw', 'highlight'].includes(this._state.tool) && (event.target as Element).closest('.annotationEditorLayer, .textLayer')) {
        this.drawingPointers.add(event.pointerId);
        this.scheduleDirtyCheck();
      }
    }, { signal: this.lifetime.signal });
    for (const type of ['pointerup', 'pointercancel'] as const) {
      window.addEventListener(type, event => {
        if (this.drawingPointers.delete(event.pointerId)) this.scheduleDirtyCheck();
      }, { signal: this.lifetime.signal });
    }
    container.addEventListener('click', event => {
      const target = event.target as Element;
      if (target.closest('.fileAttachmentAnnotation, .mediaAnnotation, .soundAnnotation')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.publish({ notice: 'Embedded attachments and media are not opened in this version.' });
      }
    }, { capture: true, signal: this.lifetime.signal });
  }

  get pdfDocument() { return this._pdfDocument; }
  get viewer() { return this._viewer; }
  get file() { return this._file; }
  get name() { return this._file?.name ?? 'Document'; }
  get dirty() { return this._state.dirty; }
  get pageCount() { return this._pdfDocument?.numPages ?? 0; }
  get currentPage() { return this._viewer?.currentPageNumber ?? 1; }
  get state(): Readonly<ReaderState> { return { ...this._state }; }

  /** An immutable snapshot of the parsed source, independent of its external file. */
  getOriginalFile(): File {
    if (!this._file || !this.originalBytes || !this._pdfDocument || this.destroyed) throw new Error('No document is open.');
    return new File([this.originalBytes], this._file.name, {
      type: this._file.type || 'application/pdf', lastModified: this._file.lastModified,
    });
  }

  private publish(patch: Partial<ReaderState>) {
    if (this.destroyed) return;
    this._state = { ...this._state, ...patch };
    this.onState({ ...this._state });
  }

  async open(file: File, passwordHandler: PasswordHandler): Promise<void> {
    if (this.destroyed || this.loadingTask) throw new Error('Use a new document tab to open another file.');
    if (file.size > MAX_FILE_BYTES) throw new Error('This version supports PDFs up to 150 MB. Open a smaller copy.');
    if (!file.size) throw new Error('This file is empty.');
    this._file = file;
    this.openedAt = performance.now();
    let cancelled = false;
    this.publish({ loading: true, error: undefined });
    try {
      const header = new TextDecoder('latin1').decode(await file.slice(0, 1024).arrayBuffer());
      if (!header.includes('%PDF-')) throw new Error('Choose a PDF document. This file does not contain a PDF header.');
      this.originalBytes = new Uint8Array(await file.arrayBuffer());
      if (this.destroyed) throw new DOMException('Opening cancelled.', 'AbortError');
      // A copy is transferred into the PDF.js worker; immutable original bytes stay here.
      const task = this.loadingTask = pdfjs.getDocument(loadingOptions(this.originalBytes.slice()));
      task.onPassword = (updatePassword: (password: string) => void, reason: number) => {
        void passwordHandler(reason).then(password => {
          if (this.destroyed) return;
          if (password === null) { cancelled = true; void task.destroy().catch(() => undefined); }
          else updatePassword(password);
        }).catch(() => { cancelled = true; void task.destroy().catch(() => undefined); });
      };
      const doc = this._pdfDocument = await task.promise;
      const [metadata, permissions, signatures] = await Promise.all([
        doc.getMetadata(), doc.getPermissions(), doc.getSignatures(),
      ]);
      const info = metadata.info as Record<string, unknown>;
      let readOnlyReason: string | undefined;
      if (info.EncryptFilterName) readOnlyReason = 'Encrypted document: reading only. Export keeps the original encryption.';
      else if (signatures?.length) readOnlyReason = 'Signed document: reading only to preserve existing signatures. Signature validity is not checked.';
      else if (info.IsSignaturesPresent) readOnlyReason = 'This PDF contains signature fields. Changes to these documents are disabled in this version.';
      else if (info.IsXFAPresent || doc.isPureXfa) readOnlyReason = 'XFA forms are not supported. This document is read-only and may require another reader.';
      else if (permissions && (!permissions.has(pdfjs.PermissionFlag.MODIFY_CONTENTS) || !permissions.has(pdfjs.PermissionFlag.MODIFY_ANNOTATIONS))) {
        readOnlyReason = 'This document restricts changes. Editing and form entry are disabled.';
      }
      this.publish({
        pages: doc.numPages, readOnlyReason,
        canPrint: !permissions || permissions.has(pdfjs.PermissionFlag.PRINT) || permissions.has(pdfjs.PermissionFlag.PRINT_HIGH_QUALITY),
        canCopy: !permissions || permissions.has(pdfjs.PermissionFlag.COPY),
      });
      if (readOnlyReason) {
        // ResetForm actions are supported by PDF.js even without its scripting
        // manager. Enforce our protected-document policy at the storage boundary
        // as well as disabling visible editors and interactive form controls.
        doc.annotationStorage.setValue = () => this.publish({ notice: readOnlyReason });
      }
      if (this.destroyed) return;
      await this.createViewer(!!readOnlyReason);
      const storage = doc.annotationStorage as unknown as { onSetModified: (() => void) | null; onResetModified: (() => void) | null };
      storage.onSetModified = () => this.scheduleDirtyCheck();
      // saveDocument resets its own modification flag even when export later fails.
      // Never let that reset acknowledge a user save.
      storage.onResetModified = () => this.scheduleDirtyCheck();
      this.savedHash = doc.annotationStorage.serializable.hash;
      this.observedHash = this.savedHash;
      this.linkService!.setDocument(doc);
      this._viewer!.setDocument(doc);
      await this._viewer!.firstPagePromise;
      if (this.destroyed) return;
      this._viewer!.currentScaleValue = 'page-width';
      this._viewer!.update();
      this.publish({ loading: false });
    } catch (error) {
      const message = cancelled ? 'Opening cancelled.' : messageFor(error);
      this.publish({ loading: false, error: message });
      throw new Error(message);
    }
  }

  private async createViewer(readOnly: boolean) {
    const { EventBus, PDFLinkService, PDFFindController, PDFViewer, LinkTarget } = await componentsPromise;
    if (this.destroyed) return;
    const eventBus = this.eventBus = new EventBus();
    const linkService = this.linkService = new PDFLinkService({
      eventBus, externalLinkTarget: LinkTarget.BLANK,
      externalLinkRel: 'noopener noreferrer nofollow', ignoreDestinationZoom: true,
    });
    const originalAddLink = linkService.addLinkAttributes.bind(linkService);
    linkService.addLinkAttributes = (link, url) => {
      try {
        const parsed = new URL(url);
        if (!['https:', 'http:', 'mailto:'].includes(parsed.protocol)) throw new Error('Blocked link');
        originalAddLink(link, parsed.href, true);
      } catch {
        link.removeAttribute('href');
        link.setAttribute('aria-disabled', 'true');
        link.title = 'This link type is blocked for safety.';
      }
    };
    const namedAction = linkService.executeNamedAction.bind(linkService);
    linkService.executeNamedAction = action => {
      if (['FirstPage', 'LastPage', 'NextPage', 'PrevPage'].includes(action)) namedAction(action);
    };
    this.findController = new PDFFindController({ eventBus, linkService, updateMatchesCountOnProgress: true });
    const viewerElement = document.createElement('div');
    viewerElement.className = 'pdfViewer';
    this.container.replaceChildren(viewerElement);
    // abortSignal exists in the pinned distribution, but its generated declaration omits it.
    const options: ConstructorParameters<typeof PDFViewer>[0] & { abortSignal: AbortSignal } = {
      container: this.container as HTMLDivElement, viewer: viewerElement,
      eventBus, linkService, findController: this.findController,
      annotationEditorMode: readOnly ? pdfjs.AnnotationEditorType.DISABLE : pdfjs.AnnotationEditorType.NONE,
      annotationMode: readOnly ? pdfjs.AnnotationMode.ENABLE : pdfjs.AnnotationMode.ENABLE_FORMS,
      annotationEditorHighlightColors: 'Yellow=#fff066,Green=#90edaf,Blue=#8ecfff,Pink=#ffb3cb',
      imageResourcesPath: `${assets}images/`, enablePermissions: true,
      enableAutoLinking: false, supportsPinchToZoom: true,
      maxCanvasPixels: 4 * 1024 * 1024, maxCanvasDim: 8192,
      capCanvasAreaFactor: 125, enableDetailCanvas: false,
      minDurationToUpdateCanvas: 180, abortSignal: this.lifetime.signal,
    };
    const viewer = this._viewer = new PDFViewer(options);
    linkService.setViewer(viewer);
    const on = (name: string, listener: (event: any) => void) => eventBus.on(name, listener, { signal: this.lifetime.signal });
    on('pagesinit', () => { viewer.currentScaleValue = 'page-width'; });
    on('pagechanging', event => this.publish({ page: event.pageNumber }));
    on('scalechanging', event => this.publish({ scale: event.scale }));
    on('pagerendered', event => {
      if (event.error) this.publish({ error: 'A page could not render correctly. Your original file has not changed.' });
      else if (this._state.renderMs === undefined) this.publish({ renderMs: Math.round(performance.now() - this.openedAt) });
    });
    on('updatefindmatchescount', event => this.publish({ searchCount: event.matchesCount.total, searchCurrent: event.matchesCount.current }));
    on('updatefindcontrolstate', event => this.publish({ searchCount: event.matchesCount.total, searchCurrent: event.matchesCount.current }));
    on('annotationeditoruimanager', event => {
      const manager = this.editorManager = event.uiManager as AnnotationEditorUIManager;
      const combinedSignal = manager.combinedSignal.bind(manager);
      manager.combinedSignal = controller => {
        const signal = combinedSignal(controller);
        // WebKit 26.6 can collect AbortSignal.any() while event listeners still
        // depend on it, so aborting a finished stroke leaves stale listeners.
        // Retain only this manager's live signals until their normal abort.
        // No global API patch or suppressed editor exceptions are involved.
        if (!signal.aborted) {
          this.editorSignals.add(signal);
          signal.addEventListener('abort', () => this.editorSignals.delete(signal), { once: true });
        }
        return signal;
      };
    });
    on('annotationlayerrendered', event => {
      // PDFs often omit /TU (the field's alternate name). Preserve supplied
      // labels; otherwise expose the actual field name without guessing meaning.
      const page = viewer.getPageView(event.pageNumber - 1)?.div as HTMLDivElement | undefined;
      const controls = page?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        '.annotationLayer input:not([type="hidden"]), .annotationLayer textarea, .annotationLayer select',
      );
      for (const control of controls ?? []) {
        if (control.getAttribute('aria-label')?.trim() || control.getAttribute('aria-labelledby')?.trim() || control.title.trim() || control.labels?.length) continue;
        const fieldName = control.name.trim();
        if (fieldName) control.setAttribute('aria-label', fieldName);
      }
    });
    on('editingstateschanged', event => {
      this.publish({ canUndo: !!event.details.hasSomethingToUndo, canRedo: !!event.details.hasSomethingToRedo });
      this.scheduleDirtyCheck();
    });
    on('annotationeditormodechanged', event => {
      const tool = (Object.keys(TOOL_MODES) as ReaderTool[]).find(key => TOOL_MODES[key] === event.mode);
      if (tool) this.publish({ tool });
    });
  }

  private scheduleDirtyCheck() {
    clearTimeout(this.dirtyTimer);
    this.dirtyTimer = setTimeout(() => this.checkDirty(), 0);
  }
  private checkDirty() {
    if (!this._pdfDocument || this.destroyed || this._state.readOnlyReason) return;
    const hash = this._pdfDocument.annotationStorage.serializable.hash;
    // FreeText serializes its committed private content, not the current DOM.
    // Track that transient draft so the UI reports pending recovery honestly.
    if (this.draftElement && !this.draftElement.isContentEditable) this.draftElement = undefined;
    const draft = this.draftElement ? `${this.draftElement.id}:${this.draftElement.innerHTML}` : '';
    const contentChanged = hash !== this.observedHash || draft !== this.observedDraft;
    const dirty = hash !== this.savedHash || !!draft;
    const checkpointPending = !!draft || this.drawingPointers.size > 0;
    this.observedHash = hash;
    this.observedDraft = draft;
    if (contentChanged || dirty !== this._state.dirty || checkpointPending !== this._state.checkpointPending) {
      this.publish({ dirty, checkpointPending, revision: this._state.revision + (contentChanged ? 1 : 0) });
    }
  }

  /** Commit the active editor before a close/navigation decision; do not rely on a timer. */
  flushPendingEdits(): boolean {
    const focused = document.activeElement as HTMLElement | null;
    if (focused && this.container.contains(focused)) focused.blur();
    this.editorManager?.commitOrRemove();
    this.draftElement = undefined;
    this.drawingPointers.clear();
    this.checkDirty();
    return this._state.dirty;
  }

  goToPage(page: number) {
    if (this._viewer && Number.isFinite(page)) this._viewer.currentPageNumber = Math.max(1, Math.min(this.pageCount, Math.trunc(page)));
  }
  async goToDestination(destination: string | unknown[]) { await this.linkService?.goToDestination(destination); }
  zoomIn() { this._viewer?.increaseScale(); }
  zoomOut() { this._viewer?.decreaseScale(); }
  setScale(scale: 'page-width' | 'page-fit' | number) {
    if (!this._viewer) return;
    if (typeof scale === 'number') this._viewer.currentScale = Math.max(0.1, Math.min(5, scale));
    else this._viewer.currentScaleValue = scale;
  }
  rotate() { if (this._viewer) this._viewer.pagesRotation = (this._viewer.pagesRotation + 90) % 360; }
  setScrollMode(mode: 'continuous' | 'page') { if (this._viewer) this._viewer.scrollMode = mode === 'page' ? 3 : 0; }
  refresh() {
    if (!this._viewer || !this.pageCount) return;
    const mode = this._viewer.currentScaleValue;
    if (mode === 'page-width' || mode === 'page-fit') this._viewer.currentScaleValue = mode;
    this._viewer.update();
  }
  search(query: string, previous = false) {
    if (!this.eventBus) return;
    if (!query.trim()) { this.clearSearch(); return; }
    this.eventBus.dispatch('find', {
      source: this, type: query === this.lastQuery ? 'again' : '',
      query, phraseSearch: true, caseSensitive: false, entireWord: false,
      highlightAll: true, findPrevious: previous, matchDiacritics: false,
    });
    this.lastQuery = query;
  }
  clearSearch() {
    this.lastQuery = '';
    this.eventBus?.dispatch('findbarclose', { source: this });
    this.publish({ searchCount: 0, searchCurrent: 0 });
  }
  setTool(tool: ReaderTool) {
    if (!this._viewer || this._state.readOnlyReason) return;
    this._viewer.annotationEditorMode = { mode: TOOL_MODES[tool] };
    this.publish({ tool });
  }
  undo() { this.eventBus?.dispatch('editingaction', { source: this, name: 'undo' }); this.scheduleDirtyCheck(); }
  redo() { this.eventBus?.dispatch('editingaction', { source: this, name: 'redo' }); this.scheduleDirtyCheck(); }

  private queueOutput<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.outputQueue.then(operation);
    // Keep the queue usable after a failed operation; the caller still receives
    // the original rejection and must display a recovery/export failure.
    this.outputQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  /** A validated copy; starting a download alone never acknowledges these changes. */
  exportBytes(): Promise<Uint8Array> {
    return this.queueOutput(async () => {
      this.flushPendingEdits();
      const copy = await this.serializeCopy();
      this.exportedHash = copy.hash;
      return copy.bytes;
    });
  }

  /** Background recovery must neither steal editor focus nor acknowledge a save. */
  createCheckpoint(): Promise<DocumentCheckpoint> {
    return this.queueOutput(async () => {
      this.checkDirty();
      if (this._state.checkpointPending) throw new CheckpointDeferredError();
      const { hash: _hash, ...checkpoint } = await this.serializeCopy();
      return checkpoint;
    });
  }

  /** Shared, serialized preservation and persistence checks for every output path. */
  private async serializeCopy(): Promise<SerializedCopy> {
    const doc = this._pdfDocument;
    const original = this.originalBytes;
    if (!doc || !original || this.destroyed) throw new Error('No document is open.');
    this.checkDirty();
    const snapshot = doc.annotationStorage.serializable;
    const expectedHash = snapshot.hash;
    const captured = {
      hash: expectedHash, revision: this._state.revision,
      fingerprint: doc.fingerprints[0] ?? '', modified: expectedHash !== this.savedHash,
    };
    if (this._state.readOnlyReason || !doc.annotationStorage.size) {
      return { ...captured, bytes: original.slice() };
    }
    // Form entries are live object references; edits made while writing must not
    // change what this specific saved copy is checked against.
    const expectedChanges = snapshot.map ? structuredClone(snapshot.map) : null;
    const output = await doc.saveDocument();
    if (this.destroyed) throw new Error('The document was closed before its copy finished.');
    // PDF.js performs incremental writes: every byte of the source must remain.
    if (output.length < original.length || !original.every((value, index) => output[index] === value)) {
      throw new Error('Export validation failed: the original PDF bytes were not preserved. Your edits remain open.');
    }
    const verificationTask = pdfjs.getDocument(loadingOptions(output.slice()));
    try {
      const reopened = await verificationTask.promise;
      if (reopened.numPages !== doc.numPages) throw new Error('Export validation failed: the page count changed.');
      // Parse the first/last page and all changed annotation pages before offering the file.
      const pages = new Set([1, doc.numPages]);
      for (const value of expectedChanges?.values() ?? []) {
        if (typeof value.pageIndex === 'number') pages.add(value.pageIndex + 1);
      }
      for (const pageNumber of pages) {
        const [before, after] = await Promise.all([doc.getPage(pageNumber), reopened.getPage(pageNumber)]);
        if (before.rotate !== after.rotate || JSON.stringify(before.view) !== JSON.stringify(after.view)) {
          throw new Error('Export validation failed: page geometry changed.');
        }
        await after.getAnnotations();
      }
      await verifyChanges(reopened, expectedChanges);
      if (this.destroyed) throw new Error('The document was closed before its copy finished.');
      return { ...captured, bytes: output };
    } catch (error) {
      throw new Error(`The saved copy could not be verified. Your edits remain open. ${messageFor(error)}`);
    } finally {
      await verificationTask.destroy();
      this.checkDirty();
    }
  }

  /** Invoke only after the platform confirms a write or the user confirms a download. */
  markExported() {
    if (!this._pdfDocument || this.exportedHash === undefined) return;
    this.savedHash = this.exportedHash;
    this._pdfDocument.annotationStorage.resetModified();
    this.checkDirty();
  }

  async getOutline() { return await this._pdfDocument?.getOutline() ?? []; }
  async getMetadata() { return await this._pdfDocument?.getMetadata(); }
  renderThumbnail(pageNumber: number, canvas: HTMLCanvasElement): Promise<void> {
    const render = this.thumbnailQueue.then(() => this.renderOneThumbnail(pageNumber, canvas));
    this.thumbnailQueue = render.catch(() => undefined);
    return render;
  }
  private async renderOneThumbnail(pageNumber: number, canvas: HTMLCanvasElement) {
    if (!this._pdfDocument || this.destroyed) return;
    const page = await this._pdfDocument.getPage(pageNumber);
    if (this.destroyed) return;
    const normal = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(140 / normal.width, 200 / normal.height) });
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(viewport.width * ratio);
    canvas.height = Math.ceil(viewport.height * ratio);
    canvas.style.width = `${Math.ceil(viewport.width)}px`;
    canvas.style.height = `${Math.ceil(viewport.height)}px`;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('A canvas could not be created.');
    const task = this.thumbnailTask = page.render({ canvas, canvasContext: context, viewport, transform: [ratio, 0, 0, ratio, 0, 0], annotationMode: pdfjs.AnnotationMode.ENABLE });
    try { await task.promise; }
    catch (error) { if (!this.destroyed) throw error; }
    finally { if (this.thumbnailTask === task) this.thumbnailTask = undefined; }
  }

  async destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    clearTimeout(this.dirtyTimer);
    this.thumbnailTask?.cancel();
    // The pinned runtime accepts null here although its generated types do not.
    this._viewer?.setDocument(null as unknown as PDFDocumentProxy);
    this.editorSignals.clear();
    this.linkService?.setDocument(null);
    this.lifetime.abort();
    await this.loadingTask?.destroy();
    this.originalBytes = undefined;
    this._pdfDocument = undefined;
    this.editorManager = undefined;
    this.container.replaceChildren();
  }
}
