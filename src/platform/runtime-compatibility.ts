/** Check before importing the reader: the legacy PDF.js bundle still needs these native APIs. */
export interface RuntimeCapabilities {
  Promise?: { withResolvers?: unknown };
  AbortSignal?: { any?: unknown; timeout?: unknown };
  structuredClone?: unknown;
  crypto?: { subtle?: { digest?: unknown }; randomUUID?: unknown };
  Array?: { prototype?: { at?: unknown } };
  TextEncoder?: unknown;
  TextDecoder?: unknown;
  Worker?: unknown;
  DOMMatrix?: unknown;
  ResizeObserver?: unknown;
  IntersectionObserver?: unknown;
}

export function missingRuntimeCapabilities(runtime: RuntimeCapabilities = globalThis as unknown as RuntimeCapabilities): string[] {
  const required: [string, () => unknown][] = [
    ['Promise.withResolvers', () => runtime.Promise?.withResolvers],
    ['AbortSignal.any', () => runtime.AbortSignal?.any],
    ['AbortSignal.timeout', () => runtime.AbortSignal?.timeout],
    ['structuredClone', () => runtime.structuredClone],
    ['crypto.subtle.digest', () => runtime.crypto?.subtle?.digest],
    ['crypto.randomUUID', () => runtime.crypto?.randomUUID],
    ['Array.prototype.at', () => runtime.Array?.prototype?.at],
    ['TextEncoder', () => runtime.TextEncoder],
    ['TextDecoder', () => runtime.TextDecoder],
    ['Worker', () => runtime.Worker],
    ['DOMMatrix', () => runtime.DOMMatrix],
    ['ResizeObserver', () => runtime.ResizeObserver],
    ['IntersectionObserver', () => runtime.IntersectionObserver],
  ];
  return required.filter(([, read]) => {
    try { return typeof read() !== 'function'; }
    catch { return true; }
  }).map(([name]) => name);
}

/** No reader imports, storage access or private error details are needed for update guidance. */
export function showRuntimeUpdateHelp(root: HTMLElement, native: boolean, loadFailure = false, preserveExisting = false): void {
  const document = root.ownerDocument;
  const main = document.createElement(preserveExisting ? 'section' : 'main');
  main.className = 'welcome';
  main.tabIndex = -1;
  main.setAttribute('aria-labelledby', 'runtime-update-title');
  const content = document.createElement('div');
  content.className = 'welcome-content';
  const title = document.createElement(preserveExisting ? 'h2' : 'h1');
  title.id = 'runtime-update-title';
  title.textContent = loadFailure ? 'Folio could not start' : 'Folio needs an update';
  const guidance = document.createElement('p');
  guidance.className = 'intro';
  guidance.setAttribute('role', 'alert');
  guidance.textContent = loadFailure
    ? 'Close and reopen Folio. If it still cannot start, use the current installer or a current browser.'
    : native
      ? 'Install the current Microsoft Edge WebView2 Evergreen Runtime, then reopen Folio. Your saved PDFs have not been changed.'
      : 'Open Folio from its HTTPS website in a current version of Edge, Chrome, Firefox or Safari. Your saved PDFs have not been changed.';
  content.append(title, guidance);
  if (native) {
    const label = document.createElement('label');
    label.htmlFor = 'runtime-update-url';
    label.textContent = 'Copy this Microsoft download page into your browser:';
    const url = document.createElement('input');
    url.id = 'runtime-update-url';
    url.className = 'dialog-input';
    url.type = 'url';
    url.readOnly = true;
    url.value = 'https://developer.microsoft.com/microsoft-edge/webview2/consumer/';
    url.addEventListener('focus', () => url.select());
    content.append(label, url);
  } else {
    const link = document.createElement('a');
    link.className = 'button primary';
    link.href = 'https://folio-local-pdf.gogoi-ronnie.chatgpt.site';
    link.textContent = 'Open Folio website';
    content.append(link);
  }
  main.append(content);
  // After close ownership has passed to the reader, its mounted document,
  // dialog and status elements must remain usable by the normal unsaved guard.
  if (preserveExisting) root.prepend(main);
  else root.replaceChildren(main);
  main.focus();
}
