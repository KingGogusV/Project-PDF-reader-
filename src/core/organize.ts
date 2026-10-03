import { PDFDocument, PDFDict, PDFName, degrees } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

export interface OrganizationInput { name: string; bytes: Uint8Array }
export type OrganizationOperation =
  | { kind: 'extract' | 'reorder' | 'delete'; pages: number[] }
  | { kind: 'rotate'; pages: number[]; degrees: 90 | 180 | 270 }
  | { kind: 'merge' };
export interface OrganizationOptions {
  signal?: AbortSignal;
  standardFontDataUrl?: string;
  cMapUrl?: string;
  wasmUrl?: string;
  iccUrl?: string;
}
export interface OrganizationResult {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  notes: string[];
  verification: {
    engine: 'PDF.js';
    pages: number;
    text: true;
    geometry: true;
    rotation: true;
    renderedPixels: true;
    renderMaxDimension: number;
  };
}
export class OrganizationError extends Error {
  code: 'input' | 'unsupported' | 'verification';
  constructor(code: OrganizationError['code'], message: string, cause?: unknown) {
    super(`${message} Your original files have not changed.`, { cause });
    this.name = 'OrganizationError';
    this.code = code;
  }
}

const MAX_INPUT_BYTES = 50 * 1024 * 1024;
const MAX_PAGES = 500;
const MAX_INPUTS = 10;
const RENDER_DIMENSION = 512;
const n = (name: string) => PDFName.of(name);
const normalizedRotation = (angle: number) => ((angle % 360) + 360) % 360;
const unsupported = (detail: string): never => { throw new OrganizationError('unsupported', detail); };
const invalid = (detail: string): never => { throw new OrganizationError('input', detail); };
const abort = (options: OrganizationOptions) => options.signal?.throwIfAborted();

interface Snapshot {
  view: number[];
  unit: number;
  rotation: number;
  text: string;
  image: string;
}
interface Prepared {
  input: OrganizationInput;
  editor: PDFDocument;
  reader: PDFDocumentProxy;
}
interface PageSelection { source: number; page: number; rotate: number }

/** The writer cannot preserve these cross-page/catalog structures safely yet. */
function checkStructure(editor: PDFDocument) {
  const rejectedCatalog: Record<string, string> = {
    AcroForm: 'interactive forms, signature fields or XFA',
    Perms: 'certification signatures or permissions',
    Outlines: 'bookmarks/outlines',
    Names: 'named destinations, scripts or embedded files',
    Dests: 'named destinations',
    StructTreeRoot: 'tagged reading order',
    MarkInfo: 'tagged-document metadata',
    OCProperties: 'optional-content layers',
    OpenAction: 'opening actions or destinations',
    AA: 'document actions',
    Collection: 'PDF portfolios',
    AF: 'associated files',
    OutputIntents: 'output-color profiles or archival conformance',
    PageLabels: 'custom page labels',
    SpiderInfo: 'web-capture structure',
  };
  for (const [key, description] of Object.entries(rejectedCatalog)) {
    if (editor.catalog.has(n(key))) unsupported(`Page organization does not yet preserve ${description}.`);
  }
  const knownCatalog = new Set(['Type', 'Pages', 'Version', 'Metadata', 'Lang', 'ViewerPreferences', 'PageLayout', 'PageMode']);
  for (const key of editor.catalog.keys()) {
    if (!knownCatalog.has(key.decodeText())) unsupported('This PDF contains additional document-level structure that page organization cannot yet preserve.');
  }
  // Catch signature dictionaries even if a damaged or unusual file omits AcroForm.
  for (const [, object] of editor.context.enumerateIndirectObjects()) {
    if (object instanceof PDFDict && (
      object.get(n('Type'))?.toString() === '/Sig' ||
      object.get(n('FT'))?.toString() === '/Sig' || object.has(n('ByteRange'))
    )) unsupported('Documents containing signature information cannot be reorganized.');
  }
  const knownPage = new Set(['Type', 'Parent', 'Resources', 'MediaBox', 'CropBox', 'BleedBox', 'TrimBox', 'ArtBox', 'Rotate', 'Contents', 'UserUnit', 'Group', 'Metadata', 'Annots', 'Thumb', 'LastModified']);
  for (const page of editor.getPages()) {
    if (page.node.Annots()?.size()) unsupported('Page organization does not yet preserve annotations, links or form widgets.');
    for (const key of ['AA', 'PresSteps', 'Trans', 'Dur', 'StructParents', 'AF']) {
      if (page.node.has(n(key))) unsupported('This document contains page actions, associated files or structure that cannot yet be preserved.');
    }
    for (const key of page.node.keys()) {
      if (!knownPage.has(key.decodeText())) unsupported('This PDF contains additional page structure that page organization cannot yet preserve.');
    }
  }
}

async function openReader(bytes: Uint8Array, options: OrganizationOptions): Promise<PDFDocumentProxy> {
  abort(options);
  const task = getDocument({
    data: bytes.slice(),
    stopAtErrors: true,
    enableXfa: false,
    disableFontFace: true,
    useSystemFonts: false,
    cMapPacked: true,
    ...Object.fromEntries(['standardFontDataUrl', 'cMapUrl', 'wasmUrl', 'iccUrl']
      .filter(key => options[key as keyof OrganizationOptions] !== undefined)
      .map(key => [key, options[key as keyof OrganizationOptions]])),
  });
  const cancel = () => { void task.destroy().catch(() => {}); };
  options.signal?.addEventListener('abort', cancel, { once: true });
  try {
    const reader = await task.promise;
    abort(options);
    return reader;
  } catch (error) {
    await task.destroy().catch(() => {});
    abort(options);
    if ((error as Error).name === 'PasswordException') unsupported('Encrypted PDFs cannot be reorganized, even when a password is known.');
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', cancel);
  }
}

async function prepare(input: OrganizationInput, options: OrganizationOptions): Promise<Prepared> {
  const reader = await openReader(input.bytes, options);
  try {
    const metadata = await reader.getMetadata();
    const info = metadata.info as Record<string, unknown>;
    if (info.EncryptFilterName || await reader.getPermissions() !== null) {
      unsupported('Encrypted or permission-restricted PDFs cannot be reorganized.');
    }
    if (reader.numPages < 1 || reader.numPages > MAX_PAGES) invalid(`Choose a PDF with between 1 and ${MAX_PAGES} pages.`);
    if (info.IsAcroFormPresent || info.IsXFAPresent || (await reader.getFieldObjects())?.size) {
      unsupported('Forms, XFA and signature fields cannot yet be preserved during page organization.');
    }
    if (await reader.hasJSActions()) unsupported('PDFs containing JavaScript actions cannot be reorganized.');
    const editor = await PDFDocument.load(input.bytes.slice(), {
      ignoreEncryption: false, updateMetadata: false, throwOnInvalidObject: true,
    });
    if (editor.isEncrypted) unsupported('Encrypted PDFs cannot be reorganized.');
    if (editor.getPageCount() !== reader.numPages) unsupported('The PDF engines disagree about this document\'s page count.');
    checkStructure(editor);
    for (let number = 1; number <= reader.numPages; number++) {
      abort(options);
      const page = await reader.getPage(number);
      if ((await page.getAnnotations()).length) unsupported('Annotations, links and form widgets cannot yet be preserved during page organization.');
      const box = page.view;
      if (!box.every(Number.isFinite) || box[2] <= box[0] || box[3] <= box[1] || !Number.isFinite(page.userUnit) || page.userUnit <= 0) {
        unsupported('This document contains invalid page geometry.');
      }
      const libRotation = editor.getPage(number - 1).getRotation().angle;
      if (libRotation % 90 !== 0 || normalizedRotation(libRotation) !== page.rotate) unsupported('The PDF engines disagree about page rotation.');
      page.cleanup();
    }
    return { input, editor, reader };
  } catch (error) {
    await reader.loadingTask.destroy();
    throw error;
  }
}

function selectPages(documents: Prepared[], operation: OrganizationOperation): PageSelection[] {
  if (!operation || !['extract', 'reorder', 'delete', 'rotate', 'merge'].includes(operation.kind)) invalid('Choose a supported page operation.');
  if (operation.kind === 'merge') {
    if (documents.length < 2) invalid('Merge requires at least two PDFs.');
    return documents.flatMap((doc, source) => doc.editor.getPageIndices().map(index => ({ source, page: index + 1, rotate: 0 })));
  }
  if (documents.length !== 1) invalid('This page operation requires exactly one PDF.');
  const total = documents[0].reader.numPages;
  if (!Array.isArray(operation.pages) || operation.pages.length === 0 || operation.pages.length > total ||
    operation.pages.some(page => !Number.isInteger(page) || page < 1 || page > total) || new Set(operation.pages).size !== operation.pages.length) {
    invalid(`Choose unique page numbers between 1 and ${total}.`);
  }
  if (operation.kind === 'reorder' && operation.pages.length !== total) invalid('Reordering requires every page exactly once.');
  if (operation.kind === 'rotate' && ![90, 180, 270].includes(operation.degrees)) invalid('Rotation must be 90, 180 or 270 degrees clockwise.');
  const selected = new Set(operation.pages);
  const sequence = operation.kind === 'delete'
    ? Array.from({ length: total }, (_, i) => i + 1).filter(page => !selected.has(page))
    : operation.kind === 'rotate' ? Array.from({ length: total }, (_, i) => i + 1) : operation.pages;
  if (!sequence.length) invalid('Keep at least one page in the exported PDF.');
  return sequence.map(page => ({ source: 0, page, rotate: operation.kind === 'rotate' && selected.has(page) ? operation.degrees : 0 }));
}

async function renderedDigest(reader: PDFDocumentProxy, page: PDFPageProxy, options: OrganizationOptions) {
  const unscaled = page.getViewport({ scale: 1, rotation: 0 });
  const scale = Math.min(1, RENDER_DIMENSION / Math.max(unscaled.width, unscaled.height));
  const viewport = page.getViewport({ scale, rotation: 0 });
  // PDF.js supplies the platform canvas implementation: DOM in browsers, its
  // optional native canvas in Node. Missing canvas support fails closed.
  const factory = reader.canvasFactory as {
    create(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D };
    destroy(entry: { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }): void;
  };
  const canvas = factory.create(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
  try {
    const task = page.render({ canvas: canvas.canvas, canvasContext: canvas.context, viewport, background: '#ffffff' });
    const cancel = () => task.cancel();
    options.signal?.addEventListener('abort', cancel, { once: true });
    try { await task.promise; } finally { options.signal?.removeEventListener('abort', cancel); }
    abort(options);
    const pixels = canvas.context.getImageData(0, 0, canvas.canvas.width, canvas.canvas.height).data;
    const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(pixels));
    return `${canvas.canvas.width}x${canvas.canvas.height}:` + Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  } finally { factory.destroy(canvas); }
}

async function snapshot(reader: PDFDocumentProxy, pageNumber: number, options: OrganizationOptions): Promise<Snapshot> {
  abort(options);
  const page = await reader.getPage(pageNumber);
  try {
    const content = await page.getTextContent();
    // Object references and generated font IDs differ after page copying. Compare
    // extracted strings, direction, positions, dimensions and line breaks instead.
    const text = JSON.stringify(content.items.map(item => 'str' in item ? {
      text: item.str, direction: item.dir, transform: item.transform,
      width: item.width, height: item.height, endOfLine: item.hasEOL,
    } : item));
    const image = await renderedDigest(reader, page, options);
    return { view: [...page.view], unit: page.userUnit, rotation: page.rotate, text, image };
  } finally { page.cleanup(); }
}

function outputName(name: string, operation: OrganizationOperation['kind']) {
  const stem = name.replace(/\.pdf$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 120).trim() || 'document';
  return `${operation === 'merge' ? 'merged' : stem}-${operation}.pdf`;
}

/**
 * Make a new page-only PDF. Inputs are snapshotted before any await; no writer
 * sees the caller's buffers, no file is overwritten, and verification is required.
 * Page numbers are 1-based. Every input is preflighted, including omitted pages.
 */
export async function organizePdf(inputs: OrganizationInput[], operation: OrganizationOperation, options: OrganizationOptions = {}): Promise<OrganizationResult> {
  abort(options);
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > MAX_INPUTS) invalid(`Choose between 1 and ${MAX_INPUTS} PDFs.`);
  let totalBytes = 0;
  const copies = inputs.map(input => {
    if (!input || typeof input.name !== 'string' || !(input.bytes instanceof Uint8Array) || input.bytes.byteLength < 8) invalid('Each PDF needs a filename and nonempty PDF bytes.');
    totalBytes += input.bytes.byteLength;
    if (totalBytes > MAX_INPUT_BYTES) invalid('Page organization accepts at most 50 MiB of source PDFs per operation.');
    return { name: input.name, bytes: Uint8Array.from(input.bytes) };
  });
  // Snapshot selection too, so UI changes during async preflight cannot alter it.
  const requested = structuredClone(operation);
  const documents: Prepared[] = [];
  let reopened: PDFDocumentProxy | undefined;
  try {
    for (const input of copies) {
      documents.push(await prepare(input, options));
      if (documents.reduce((sum, doc) => sum + doc.reader.numPages, 0) > MAX_PAGES) invalid(`Page organization accepts at most ${MAX_PAGES} source pages per operation.`);
    }
    const selection = selectPages(documents, requested);
    const expected: Snapshot[] = [];
    for (const item of selection) {
      expected.push(await snapshot(documents[item.source].reader, item.page, options));
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    abort(options);
    const output = await PDFDocument.create();
    output.setProducer('Folio page organization');
    output.setCreator('Folio');
    for (const item of selection) {
      abort(options);
      const [page] = await output.copyPages(documents[item.source].editor, [item.page - 1]);
      if (item.rotate) page.setRotation(degrees(normalizedRotation(page.getRotation().angle + item.rotate)));
      output.addPage(page);
    }
    const bytes = await output.save({ addDefaultPage: false, updateFieldAppearances: false });
    const outputStructure = await PDFDocument.load(bytes.slice(), { ignoreEncryption: false, updateMetadata: false, throwOnInvalidObject: true });
    reopened = await openReader(bytes, options);
    if (reopened.numPages !== selection.length) throw new OrganizationError('verification', 'The exported page count did not match the requested result.');
    for (let index = 0; index < selection.length; index++) {
      const actual = await snapshot(reopened, index + 1, options);
      const before = expected[index];
      const originalPage = documents[selection[index].source].editor.getPage(selection[index].page - 1);
      const outputPage = outputStructure.getPage(index);
      const boxes = (page: typeof outputPage) => JSON.stringify([page.getMediaBox(), page.getCropBox(), page.getBleedBox(), page.getTrimBox(), page.getArtBox()]);
      if (actual.text !== before.text || actual.image !== before.image || actual.unit !== before.unit ||
        JSON.stringify(actual.view) !== JSON.stringify(before.view) ||
        boxes(originalPage) !== boxes(outputPage) ||
        actual.rotation !== normalizedRotation(before.rotation + selection[index].rotate)) {
        throw new OrganizationError('verification', `Page ${index + 1} did not preserve its text, geometry, rotation or rendered appearance.`);
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    abort(options);
    return {
      bytes, name: outputName(copies[0].name, requested.kind), pageCount: selection.length,
      notes: ['This is a new page-only PDF. Original files remain unchanged.', 'Document-level title, author, dates and other metadata are not copied. Viewing preferences are also reset.', 'Appearance checks compare all retained pages at up to 512 pixels per dimension; this is not a full-resolution fidelity or archival-conformance certification.'],
      verification: { engine: 'PDF.js', pages: selection.length, text: true, geometry: true, rotation: true, renderedPixels: true, renderMaxDimension: RENDER_DIMENSION },
    };
  } catch (error) {
    abort(options);
    if (error instanceof OrganizationError) throw error;
    throw new OrganizationError('verification', 'This PDF could not be safely organized and verified.', error);
  } finally {
    await reopened?.loadingTask.destroy().catch(() => {});
    await Promise.all(documents.map(doc => doc.reader.loadingTask.destroy().catch(() => {})));
  }
}
