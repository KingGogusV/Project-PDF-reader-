import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  clearRecent, downloadPdf, exportedPdfName, getRecent, pickFiles, printPdf,
  readSetting, rememberRecent, reservePrintWindow, writeSetting,
} from '../../src/platform/browser.ts';

let storage;
let elements;
let timers;
let intervals;
let createdUrls;
let revokedUrls;
const originalCreateUrl = URL.createObjectURL;
const originalRevokeUrl = URL.revokeObjectURL;

function fakeTab() {
  return {
    opener: {}, closed: false,
    document: { title: '', body: { textContent: '' } },
    location: { replace(url) { this.url = url; } },
    close() { this.closed = true; },
  };
}

beforeEach(() => {
  storage = new Map();
  elements = [];
  timers = [];
  intervals = [];
  createdUrls = [];
  revokedUrls = [];
  globalThis.window = {
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    setTimeout(callback) { timers.push(callback); return timers.length; },
    setInterval(callback) { intervals.push(callback); return intervals.length; },
    clearInterval() {},
    open: () => fakeTab(),
  };
  globalThis.document = {
    body: { append(element) { elements.push(element); } },
    createElement() {
      const element = new EventTarget();
      element.click = () => { element.clicked = true; };
      element.remove = () => { element.removed = true; };
      return element;
    },
  };
  URL.createObjectURL = blob => {
    const url = `blob:test/${createdUrls.length}`;
    createdUrls.push({ blob, url });
    return url;
  };
  URL.revokeObjectURL = url => revokedUrls.push(url);
});

afterEach(() => {
  URL.createObjectURL = originalCreateUrl;
  URL.revokeObjectURL = originalRevokeUrl;
  delete globalThis.window;
  delete globalThis.document;
});

test('export names are safe copy names, never paths or the input name', () => {
  assert.equal(exportedPdfName('quarterly report.PDF'), 'quarterly report-folio.pdf');
  assert.equal(exportedPdfName('C:\\private\\report.pdf'), 'report-folio.pdf');
  assert.equal(exportedPdfName('../../contract.pdf'), 'contract-folio.pdf');
  assert.equal(exportedPdfName(''), 'document-folio.pdf');
  assert.equal(exportedPdfName('bad:name?.pdf'), 'bad_name_-folio.pdf');
});

test('recent history is bounded, deduplicated metadata and can be cleared', () => {
  for (let index = 0; index < 20; index++) {
    rememberRecent({ name: `file-${index}.pdf`, size: index, lastModified: 42, bytes: [1, 2, 3], password: 'private' });
  }
  rememberRecent({ name: 'file-19.pdf', size: 19, lastModified: 42 });
  const recent = getRecent();
  assert.equal(recent.length, 12);
  assert.equal(recent[0].name, 'file-19.pdf');
  assert.equal(recent.filter(item => item.name === 'file-19.pdf').length, 1);
  assert.deepEqual(Object.keys(recent[0]).sort(), ['lastModified', 'name', 'openedAt', 'size']);
  assert(!Array.from(storage.values()).join('').includes('private'));
  clearRecent();
  assert.deepEqual(getRecent(), []);
});

test('malformed metadata and unavailable storage report errors without silently deleting data', () => {
  storage.set('folio.recent.v1', '{broken');
  assert.throws(getRecent, /history could not be read/);
  assert.equal(storage.get('folio.recent.v1'), '{broken');
  window.localStorage.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
  assert.throws(() => writeSetting('theme', 'dark'), /unavailable or full/);
  window.localStorage.getItem = () => { throw new DOMException('Denied', 'SecurityError'); };
  assert.throws(getRecent, /storage is unavailable/);
});

test('settings roundtrip and malformed JSON errors remain explicit', () => {
  assert.equal(readSetting('theme', 'system'), 'system');
  writeSetting('theme', 'dark');
  assert.equal(readSetting('theme', 'system'), 'dark');
  storage.set('folio.setting.v1.theme', 'invalid');
  assert.throws(() => readSetting('theme', 'system'), /could not be read/);
});

test('file picker cancellation resolves and cleans up its input', async () => {
  const result = pickFiles();
  elements[0].dispatchEvent(new Event('cancel'));
  assert.deepEqual(await result, []);
  assert.equal(elements[0].removed, true);
});

test('file picker returns selected Files and allows multiple selections', async () => {
  const result = pickFiles();
  const files = [new File(['%PDF'], 'first.pdf'), new File(['%PDF'], 'second.pdf')];
  elements[0].files = files;
  elements[0].dispatchEvent(new Event('change'));
  assert.deepEqual(await result, files);
  assert.equal(elements[0].multiple, true);
  assert.equal(elements[0].removed, true);
});

test('download copies bytes, reports initiation, and defers Blob cleanup', async () => {
  const input = new Uint8Array([37, 80, 68, 70]);
  const result = downloadPdf(input, 'source.pdf');
  input[0] = 0;
  assert.equal(result.filename, 'source-folio.pdf');
  assert.match(result.message, /Download started/);
  assert.equal(elements[0].download, result.filename);
  assert.equal(elements[0].clicked, true);
  assert.equal(elements[0].removed, true);
  assert.equal(new Uint8Array(await createdUrls[0].blob.arrayBuffer())[0], 37);
  assert.deepEqual(revokedUrls, []);
  timers[0]();
  assert.deepEqual(revokedUrls, ['blob:test/0']);
});

test('print uses pre-reserved tab and retains Blob until tab closes', () => {
  const tab = reservePrintWindow();
  assert.equal(tab.opener, null);
  window.open = () => { throw new Error('Should not open another tab'); };
  const result = printPdf(new Uint8Array([37, 80, 68, 70]), 'source.pdf', tab);
  assert.equal(tab.location.url, 'blob:test/0');
  assert.match(result.message, /Print copy opened/);
  intervals[0]();
  assert.deepEqual(revokedUrls, []);
  tab.close();
  intervals[0]();
  assert.deepEqual(revokedUrls, ['blob:test/0']);
});

test('popup denial and failed print preparation do not claim success or leave blank tabs', () => {
  window.open = () => null;
  assert.throws(reservePrintWindow, /Allow popups/);
  const tab = fakeTab();
  assert.throws(() => printPdf(new Uint8Array(), 'empty.pdf', tab), /could not open/);
  assert.equal(tab.closed, true);
  assert.equal(createdUrls.length, 0);
});
