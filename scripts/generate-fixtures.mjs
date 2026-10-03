/** Original, synthetic fixtures only. Generated PDFs never contain user documents. */
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb, degrees } from 'pdf-lib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'tests', 'fixtures', 'generated');
const publicDir = join(root, 'public');
await mkdir(output, { recursive: true });
await mkdir(publicDir, { recursive: true });
const fixedDate = new Date('2026-10-02T12:00:00Z');
const colors = {
  ink: rgb(0.10, 0.18, 0.19), muted: rgb(0.38, 0.44, 0.43),
  teal: rgb(0.12, 0.39, 0.35), paper: rgb(0.97, 0.965, 0.94),
  line: rgb(0.81, 0.85, 0.81), mint: rgb(0.87, 0.93, 0.88), coral: rgb(0.81, 0.37, 0.24),
};
async function document(title) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor('Folio project - original synthetic test material');
  pdf.setSubject('Synthetic PDF fixture. Contains no personal or confidential information.');
  pdf.setCreator('Folio fixture generator');
  pdf.setProducer('pdf-lib 1.17.1');
  pdf.setCreationDate(fixedDate);
  pdf.setModificationDate(fixedDate);
  const fonts = {
    sans: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    serif: await pdf.embedFont(StandardFonts.TimesRoman),
    italic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    mono: await pdf.embedFont(StandardFonts.Courier),
  };
  return { pdf, fonts };
}
function text(page, fonts, str, x, y, size = 12, style = 'sans', color = colors.ink) {
  page.drawText(str, { x, y, size, font: fonts[style], color });
}
function paragraph(page, fonts, str, x, y, width = 470, size = 11.5, lineHeight = 18, style = 'sans') {
  let line = '';
  for (const word of str.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (fonts[style].widthOfTextAtSize(candidate, size) > width && line) {
      text(page, fonts, line, x, y, size, style);
      y -= lineHeight;
      line = word;
    } else line = candidate;
  }
  if (line) { text(page, fonts, line, x, y, size, style); y -= lineHeight; }
  return y;
}
function basePage(pdf, fonts, index, label, size = [612, 792]) {
  const page = pdf.addPage(size);
  const [width, height] = size;
  page.drawRectangle({ x: 0, y: 0, width, height, color: colors.paper });
  text(page, fonts, 'FOLIO', 48, height - 42, 12, 'bold', colors.teal);
  text(page, fonts, 'FIELD GUIDE / 01', width - 151, height - 41, 8.5, 'mono', colors.muted);
  page.drawLine({ start: { x: 48, y: 47 }, end: { x: width - 48, y: 47 }, thickness: 0.6, color: colors.line });
  text(page, fonts, label, 48, 31, 8.5, 'sans', colors.muted);
  text(page, fonts, `${String(index).padStart(2, '0')} / 04`, width - 83, 31, 8.5, 'mono', colors.muted);
  return page;
}
function annotation(pdf, page, props) {
  const ref = pdf.context.register(pdf.context.obj({ Type: 'Annot', ...props }));
  page.node.addAnnot(ref);
  return ref;
}
function outline(pdf, entries) {
  const parent = pdf.context.obj({ Type: 'Outlines', Count: entries.length });
  const parentRef = pdf.context.register(parent);
  const nodes = entries.map(([title, page]) => pdf.context.obj({
    Title: PDFString.of(title), Parent: parentRef, Dest: [page.ref, PDFName.of('Fit')],
  }));
  const refs = nodes.map(node => pdf.context.register(node));
  nodes.forEach((node, i) => {
    if (i > 0) node.set(PDFName.of('Prev'), refs[i - 1]);
    if (i < refs.length - 1) node.set(PDFName.of('Next'), refs[i + 1]);
  });
  parent.set(PDFName.of('First'), refs[0]); parent.set(PDFName.of('Last'), refs.at(-1));
  pdf.catalog.set(PDFName.of('Outlines'), parentRef);
  pdf.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
}
function formFields(pdf, fonts, page, top = 572) {
  const form = pdf.getForm();
  const borderColor = colors.line;
  text(page, fonts, 'READER NAME', 48, top, 8.5, 'bold', colors.muted);
  const name = form.createTextField('reader_name');
  name.setText('');
  name.addToPage(page, { x: 48, y: top - 43, width: 316, height: 28, borderColor, borderWidth: 0.7, font: fonts.sans });
  name.setFontSize(12);
  text(page, fonts, 'REVIEW STATUS', 48, top - 77, 8.5, 'bold', colors.muted);
  const status = form.createDropdown('review_status');
  status.addOptions(['In progress', 'Ready to share', 'Needs another look']);
  status.select('In progress');
  status.addToPage(page, { x: 48, y: top - 120, width: 316, height: 28, borderColor, borderWidth: 0.7, font: fonts.sans });
  status.setFontSize(12);
  const approved = form.createCheckBox('approved');
  approved.addToPage(page, { x: 49, y: top - 161, width: 17, height: 17, borderColor, borderWidth: 0.7 });
  text(page, fonts, 'I have reviewed this document.', 79, top - 156, 11);
  text(page, fonts, 'NOTES', 48, top - 199, 8.5, 'bold', colors.muted);
  const notes = form.createTextField('notes');
  notes.enableMultiline();
  notes.addToPage(page, { x: 48, y: top - 326, width: 516, height: 112, borderColor, borderWidth: 0.7, font: fonts.sans });
  notes.setFontSize(11);
  form.updateFieldAppearances(fonts.sans);
}
async function save(name, pdf) {
  const data = await pdf.save({ useObjectStreams: false });
  await writeFile(join(output, name), data);
  return data;
}

// Four original pages designed to exercise the application's everyday workflows.
{
  const { pdf, fonts } = await document('Folio - A little space to think');
  let p = basePage(pdf, fonts, 1, 'A small guide to working with documents');
  text(p, fonts, 'YOUR DOCUMENTS. YOUR PACE.', 48, 677, 9, 'bold', colors.teal);
  text(p, fonts, 'A little space', 45, 604, 57, 'serif');
  text(p, fonts, 'to think.', 45, 539, 57, 'serif');
  paragraph(p, fonts, 'A field guide to reading closely, leaving useful notes, and keeping your work in your own hands.', 48, 484, 390, 15, 23);
  p.drawRectangle({ x: 48, y: 221, width: 516, height: 171, color: colors.mint });
  text(p, fonts, 'MAKE ROOM FOR THE DOCUMENT', 68, 364, 9, 'bold', colors.teal);
  paragraph(p, fonts, 'The best tools leave you with fewer things to manage. Start with a page. Read a sentence twice. Mark the part that matters. Keep the original safe.', 68, 333, 370, 15, 23, 'serif');
  text(p, fonts, '01  Read     02  Reflect     03  Review     04  Keep', 68, 244, 9, 'mono', colors.teal);
  paragraph(p, fonts, 'Try it: search for amber heron. The phrase appears on three pages so you can move between results.', 48, 169, 488, 11.5, 18);
  text(p, fonts, 'This is an original synthetic document created for Folio.', 48, 98, 9, 'sans', colors.muted);

  p = basePage(pdf, fonts, 2, 'Read / reflect');
  text(p, fonts, '01 / READING WELL', 48, 682, 9, 'bold', colors.teal);
  text(p, fonts, 'Give an idea some room.', 48, 629, 34, 'serif');
  paragraph(p, fonts, 'A useful reading session does not need to be a long one. Pick a question, scan the shape of the document, and slow down where the answer starts to emerge.', 48, 585, 480, 12, 19);
  const blocks = [
    ['Find your bearings', 'Use page thumbnails and the outline to understand the structure. Fit the page to see its shape, or fit the width to give the text more space.'],
    ['Leave a useful trace', 'A short comment is most useful when it explains why something matters. Highlight a passage you want to return to, then add your question in your own words.'],
    ['Keep the context', 'A quotation without its surrounding argument can be misleading. Read the paragraph before it and the paragraph after it. The amber heron is our small reminder to look twice.'],
  ];
  let y = 490;
  blocks.forEach(([title, body], i) => {
    text(p, fonts, `0${i + 1}`, 48, y, 12, 'mono', colors.coral);
    text(p, fonts, title, 87, y, 17, 'serif');
    paragraph(p, fonts, body, 87, y - 29, 465, 11.5, 18);
    y -= 126;
  });
  p.drawLine({ start: { x: 48, y: 105 }, end: { x: 564, y: 105 }, thickness: 0.7, color: colors.line });
  text(p, fonts, 'Select a sentence on this page and try an annotation.', 48, 78, 10, 'italic', colors.muted);

  p = basePage(pdf, fonts, 3, 'Review / interactive worksheet');
  text(p, fonts, '02 / A QUICK CHECK-IN', 48, 682, 9, 'bold', colors.teal);
  text(p, fonts, 'Make it your own.', 48, 629, 37, 'serif');
  paragraph(p, fonts, 'This page contains real PDF form fields. Add a name, choose a status, and leave a note. Export a copy, then reopen it to check your changes.', 48, 590, 493, 11, 17);
  formFields(pdf, fonts, p, 514);
  paragraph(p, fonts, 'A typed name is not a cryptographic digital signature. This worksheet is for testing form behavior only.', 48, 141, 480, 10, 16);

  p = basePage(pdf, fonts, 4, 'Keep / a thoughtful finish');
  text(p, fonts, '03 / KEEP WHAT MATTERS', 48, 682, 9, 'bold', colors.teal);
  text(p, fonts, 'Leave with a clear next step.', 48, 629, 32, 'serif');
  paragraph(p, fonts, 'Before you close a document, decide what you want to remember. One sentence is enough. A good note makes the next reading easier.', 48, 581, 483, 12, 19);
  p.drawRectangle({ x: 48, y: 336, width: 516, height: 146, color: colors.mint });
  text(p, fonts, 'THE SMALL FINISHING CHECKLIST', 69, 451, 9, 'bold', colors.teal);
  text(p, fonts, '1. Save a separate copy when you make changes.', 69, 417, 12);
  text(p, fonts, '2. Reopen it and make sure your work survived.', 69, 387, 12);
  text(p, fonts, '3. Keep the original until you are satisfied.', 69, 357, 12);
  paragraph(p, fonts, 'The amber heron has reached the last page. Use the outline to jump back to the start, or open a document of your own.', 48, 283, 484, 12, 19);
  text(p, fonts, 'A note is waiting in the margin.', 48, 207, 12, 'italic', colors.muted);
  annotation(pdf, p, { Subtype: 'Text', Rect: [524, 202, 546, 224], Contents: PDFString.of('Welcome to Folio. This existing PDF comment should survive a saved copy.'), T: PDFString.of('Folio'), Name: 'Comment', F: 4, C: [0.9, 0.65, 0.2] });
  text(p, fonts, 'A harmless sample link: example.com', 48, 154, 10, 'sans', colors.teal);
  annotation(pdf, p, { Subtype: 'Link', Rect: [48, 151, 246, 168], Border: [0, 0, 0], A: { S: 'URI', URI: PDFString.of('https://example.com') } });
  text(p, fonts, 'Made for reading. Designed to stay out of the way.', 48, 93, 10, 'italic', colors.muted);
  outline(pdf, [['A little space to think', pdf.getPage(0)], ['Read and reflect', pdf.getPage(1)], ['Interactive worksheet', pdf.getPage(2)], ['Keep what matters', pdf.getPage(3)]]);
  const bytes = await save('demo.pdf', pdf);
  await writeFile(join(publicDir, 'demo.pdf'), bytes);
}

{
  const { pdf, fonts } = await document('Text and outline fixture');
  for (let i = 1; i <= 3; i++) {
    const p = pdf.addPage([612, 792]);
    text(p, fonts, `Chapter ${i}`, 48, 720, 28, 'serif');
    text(p, fonts, `The amber heron visits page ${i}.`, 48, 670, 14);
    text(p, fonts, `UniqueToken${i} survives export without modification.`, 48, 631, 12);
    text(p, fonts, 'Select this ordinary sentence to test text markup.', 48, 595, 12);
  }
  outline(pdf, pdf.getPages().map((p, i) => [`Chapter ${i + 1}`, p]));
  await save('text-outline.pdf', pdf);
}
{
  const { pdf, fonts } = await document('Interactive form fixture');
  const p = pdf.addPage([612, 792]);
  text(p, fonts, 'Folio form round-trip fixture', 48, 717, 26, 'serif');
  text(p, fonts, 'FormBaselineToken - this text must remain after saving.', 48, 675, 12);
  formFields(pdf, fonts, p);
  await save('form.pdf', pdf);
}
{
  const { pdf, fonts } = await document('Shared field widgets and radio groups');
  const p = pdf.addPage([612, 792]);
  text(p, fonts, 'One field, two appearances', 48, 716, 27, 'serif');
  text(p, fonts, 'WidgetBaselineToken - open two copies to test independent edits.', 48, 674, 11);
  const form = pdf.getForm();
  const shared = form.createTextField('shared_name');
  for (const [label, y] of [['Shared name - first appearance', 573], ['Shared name - second appearance', 456]]) {
    text(p, fonts, label, 48, y + 44, 12);
    shared.addToPage(p, { x: 48, y, width: 450, height: 32, borderColor: colors.line, borderWidth: 0.7, font: fonts.sans });
  }
  shared.setFontSize(12);
  text(p, fonts, 'Shared choice', 48, 372, 12, 'bold');
  const radio = form.createRadioGroup('shared_choice');
  for (const [option, x] of [['Alpha', 48], ['Beta', 225]]) {
    radio.addOptionToPage(option, p, { x, y: 325, width: 22, height: 22, borderColor: colors.teal, borderWidth: 1 });
    text(p, fonts, option, x + 34, 331, 12);
  }
  radio.select('Alpha');
  form.updateFieldAppearances(fonts.sans);
  await save('multi-widget.pdf', pdf);
}
{
  const { pdf, fonts } = await document('Existing annotations fixture');
  const p = pdf.addPage([612, 792]);
  text(p, fonts, 'Existing annotation types', 48, 722, 26, 'serif');
  for (const [index, subtype] of ['Highlight', 'Underline', 'StrikeOut'].entries()) {
    const y = 652 - index * 65;
    text(p, fonts, `${subtype}: unchanged text under a markup annotation.`, 48, y, 13);
    annotation(pdf, p, { Subtype: subtype, Rect: [48, y - 3, 386, y + 15], QuadPoints: [48, y + 15, 386, y + 15, 48, y - 3, 386, y - 3], C: [1, 0.8, 0.2], CA: 0.4, F: 4, Contents: PDFString.of(`Original ${subtype} annotation`) });
  }
  annotation(pdf, p, { Subtype: 'Text', Rect: [500, 630, 524, 654], Contents: PDFString.of('Original sticky note'), T: PDFString.of('Fixture author'), F: 4, Name: 'Comment' });
  annotation(pdf, p, { Subtype: 'Ink', Rect: [47, 358, 260, 450], InkList: [[50, 400, 90, 440, 130, 375, 180, 421, 230, 366]], C: [0.1, 0.4, 0.8], BS: { W: 3 }, F: 4, Contents: PDFString.of('Original ink drawing') });
  annotation(pdf, p, { Subtype: 'FreeText', Rect: [48, 260, 330, 320], Contents: PDFString.of('Original free text'), DA: PDFString.of('/Helv 14 Tf 0.1 0.2 0.3 rg'), C: [1, 1, 0.9], F: 4 });
  await save('annotations.pdf', pdf);
}
{
  const { pdf, fonts } = await document('Mixed sizes and rotations fixture');
  for (const [index, [w, h, angle]] of [[612, 792, 0], [792, 612, 90], [300, 500, 180], [420, 420, 270]].entries()) {
    const p = pdf.addPage([w, h]);
    p.setRotation(degrees(angle));
    text(p, fonts, `Page ${index + 1} / ${w} x ${h} / ${angle} degrees`, 26, h - 45, 13);
    p.drawRectangle({ x: 25, y: 25, width: w - 50, height: h - 90, borderColor: colors.teal, borderWidth: 2 });
  }
  await save('mixed-pages.pdf', pdf);
}
// The raster is drawn from scratch; it contains no photographed or external material.
let raster;
let rasterMode = 'original 1200x1600 drawing';
try {
  const require = createRequire(import.meta.resolve('pdfjs-dist/package.json'));
  const { createCanvas } = require('@napi-rs/canvas');
  const canvas = createCanvas(1200, 1600); const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5f3e9'; ctx.fillRect(0, 0, 1200, 1600);
  ctx.fillStyle = '#173d38'; ctx.font = 'bold 60px sans-serif'; ctx.fillText('A SYNTHETIC SCANNED PAGE', 85, 150);
  ctx.font = '32px sans-serif';
  ['This page is a generated raster image.', 'There is no PDF text layer.', 'An OCR feature would be needed to search it.', 'No photographed or personal content is used.'].forEach((line, i) => ctx.fillText(line, 85, 270 + i * 75));
  ctx.fillStyle = '#c2d4be'; ctx.fillRect(85, 650, 1030, 530);
  ctx.fillStyle = '#447368'; ctx.beginPath(); ctx.arc(600, 915, 178, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#dd9873'; ctx.beginPath(); ctx.arc(665, 862, 98, 0, Math.PI * 2); ctx.fill();
  raster = canvas.toBuffer('image/png');
} catch {
  // A portable 1x1 image remains a genuine raster fixture if optional Node canvas is absent.
  raster = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=', 'base64');
  rasterMode = 'one-pixel fallback: optional Node canvas unavailable';
}
for (const scanned of [true, false]) {
  const { pdf, fonts } = await document(scanned ? 'Image-only scanned fixture' : 'Image-heavy fixture');
  const image = await pdf.embedPng(raster);
  for (let i = 0; i < (scanned ? 1 : 4); i++) {
    const p = pdf.addPage([612, 792]);
    p.drawImage(image, { x: 24, y: 34, width: 564, height: 720 });
    if (!scanned) text(p, fonts, `Image fixture page ${i + 1}`, 25, 12, 10);
  }
  await save(scanned ? 'scanned.pdf' : 'images.pdf', pdf);
}
{
  const { pdf, fonts } = await document('Large synthetic 200-page document');
  for (let i = 1; i <= 200; i++) {
    const p = pdf.addPage([612, 792]);
    text(p, fonts, `Large document / page ${i} of 200`, 48, 720, 22, 'serif');
    for (let line = 0; line < 28; line++) text(p, fonts, `Page ${i}, line ${line + 1}: local rendering should stay bounded and responsive.`, 48, 670 - line * 20, 10);
    if (i === 200) text(p, fonts, 'LastPageNeedle - search reaches the final page.', 48, 75, 12);
  }
  await save('large.pdf', pdf);
}
{
  const { pdf, fonts } = await document('Unsigned signature field fixture');
  const p = pdf.addPage([612, 792]);
  text(p, fonts, 'Unsigned signature field', 48, 710, 25, 'serif');
  text(p, fonts, 'This document is not digitally signed. No validation claim is made.', 48, 661, 11);
  const widget = pdf.context.obj({ Type: 'Annot', Subtype: 'Widget', FT: 'Sig', T: PDFString.of('signature_placeholder'), Rect: [48, 520, 320, 594], F: 4, P: p.ref });
  const ref = pdf.context.register(widget);
  p.node.addAnnot(ref);
  pdf.catalog.set(PDFName.of('AcroForm'), pdf.context.obj({ Fields: [ref], SigFlags: 1 }));
  await save('unsigned-signature.pdf', pdf);
}
{
  const { pdf, fonts } = await document('Hostile actions are never executed');
  const p = pdf.addPage([612, 792]);
  text(p, fonts, 'Hostile action fixture - inert in Folio', 48, 710, 23, 'serif');
  text(p, fonts, 'Unsafe links, PDF scripts and launch actions must never execute.', 48, 665, 11);
  pdf.catalog.set(PDFName.of('OpenAction'), pdf.context.obj({ S: 'JavaScript', JS: PDFString.of('app.alert("PDF_SCRIPT_MUST_NOT_EXECUTE");') }));
  annotation(pdf, p, { Subtype: 'Link', Rect: [48, 590, 310, 620], A: { S: 'URI', URI: PDFString.of('javascript:alert("UNSAFE_LINK")') } });
  annotation(pdf, p, { Subtype: 'Link', Rect: [48, 520, 310, 550], A: { S: 'Launch', F: PDFString.of('never-run-this-program.exe') } });
  text(p, fonts, 'Unsafe URI annotation', 48, 600, 12);
  text(p, fonts, 'Launch action annotation', 48, 530, 12);
  await save('hostile-actions.pdf', pdf);
}
await writeFile(join(output, 'malformed.pdf'), '%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 99 0 R >>\nendobj\n%%EOF\n');
await writeFile(join(output, 'unsupported.txt'), 'This is ordinary text, not a PDF. Do not upload it anywhere.\n');

// Encryption is generated by pypdf, not custom cryptographic code. This optional fixture
// needs `pypdf` and `cryptography` in Python. All ordinary fixtures need only Node.
const encryptionCode = String.raw`
import sys
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from pypdf.constants import UserAccessPermissions
source, destination = sys.argv[1], Path(sys.argv[2])
writer = PdfWriter(clone_from=PdfReader(source))
writer.encrypt('folio-test', 'folio-owner-test', algorithm='AES-128')
with (destination / 'encrypted.pdf').open('wb') as out: writer.write(out)
restricted = PdfWriter(clone_from=PdfReader(source))
restricted.encrypt('', 'folio-owner-test', permissions_flag=UserAccessPermissions.PRINT, algorithm='AES-128')
with (destination / 'restricted.pdf').open('wb') as out: restricted.write(out)
`;
const candidates = [process.env.CODEX_PRIMARY_RUNTIME_PYTHON, process.env.FOLIO_PYTHON, 'python3', 'python', 'py'];
// Discover the known bundled Python relative to Node when using the Codex runtime.
const runtimePython = resolve(dirname(process.execPath), '..', '..', 'python', 'python.exe');
candidates.unshift(runtimePython);
let encryptionStatus = 'not generated; set FOLIO_PYTHON to a Python with pypdf and cryptography';
for (const name of ['encrypted.pdf', 'restricted.pdf']) {
  await unlink(join(output, name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
for (const executable of [...new Set(candidates.filter(Boolean))]) {
  const result = spawnSync(executable, ['-c', encryptionCode, join(output, 'text-outline.pdf'), output], { encoding: 'utf8', timeout: 20000, windowsHide: true });
  if (result.status === 0) { encryptionStatus = 'generated: encrypted.pdf (password folio-test) and restricted.pdf'; break; }
}
if (!encryptionStatus.startsWith('generated:')) {
  for (const name of ['encrypted.pdf', 'restricted.pdf']) {
    await unlink(join(output, name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
await writeFile(join(output, 'manifest.json'), JSON.stringify({
  generatedBy: 'scripts/generate-fixtures.mjs', synthetic: true, confidential: false,
  search: { filename: 'text-outline.pdf', phrase: 'amber heron', occurrences: 3, pageCount: 3 },
  demo: { pageCount: 4, searchPhrase: 'amber heron', occurrences: 3 },
  formFields: ['reader_name', 'review_status', 'approved', 'notes'],
  multiWidgetFields: { shared_name: 2, shared_choice: ['Alpha', 'Beta'] },
  largePageCount: 200, raster: rasterMode, encryption: encryptionStatus,
}, null, 2) + '\n');
console.log(`Generated synthetic fixtures in ${output}`);
console.log(`Encryption fixtures: ${encryptionStatus}`);
