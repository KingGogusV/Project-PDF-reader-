# PDF engine and platform research

Research date: 2026-10-02. This record separates upstream facts, engineering inferences, selected decisions, and unresolved questions. Capability claims from upstream documentation are not evidence that Folio implements or has verified those capabilities. See `PROJECT.md` and `docs/verification.md` for application status.

## Selected architecture

**DESIGN DECISION:** Vite and TypeScript with an original, modular native DOM interface; PDF.js 6.3.289 display/worker and viewer components; browser adapters for files, export, printing, and settings. PDF.js owns supported annotation/form serialization. `pdf-lib` 1.17.1 is a development-only synthetic-fixture generator. No user-document rewrite path uses pdf-lib. Native packaging is deferred.

**INFERENCE:** A browser-capable document core gives phones, tablets, and desktop browsers the same parsing and document behavior without implementing multiple PDF engines. DOM controls and PDF.js text/annotation layers fit browser selection, keyboard access, and responsive layout. This is a fit assessment, not a measured ranking of performance against native frameworks. React was considered but is unnecessary for this bounded modular shell.

**FACT:** The installed `node_modules/pdfjs-dist/package.json` identifies version 6.3.289, Apache-2.0, and Node `>=22.13.0 || >=24`. The application requires Node 24 or newer. Upstream's releases page listed 6.3.289, released August 29, as latest when researched. Pin display, viewer, worker, decoders, and auxiliary assets to the same version. [Releases](https://github.com/mozilla/pdf.js/releases), [project](https://github.com/mozilla/pdf.js).

## Engine comparison and licensing

License descriptions below are engineering screening results. They do not replace review of the exact distributed artifacts and their dependency notices.

| Candidate | License evidence | Relevant capability and architectural assessment |
| --- | --- | --- |
| PDF.js | Apache-2.0 | Mozilla-supported web parsing/rendering; worker, selection, search, outline, forms, annotation, and save APIs. Selected for a single browser core. Supported editor workflows require independent export/reopen tests. |
| PDFium | Current upstream LICENSE contains BSD-style conditions and Apache-2.0 text | Serious future native/WASM engine candidate. Wrappers, builds, codecs, and dependencies need their own review. The third-party bblanchon WASM build is explicitly experimental. |
| MuPDF | AGPL or commercial license | Broad renderer and manipulation API. Deferred because licensing/distribution obligations require a deliberate product decision. |
| Poppler | Official C++ source header specifies GPL version 2 or later | Active native renderer with C++/GLib/Qt APIs. Not selected for this project's presently unspecified distribution model or browser core. |
| Qt PDF | Commercial, LGPLv3, or GPLv2 | Uses PDFium and supplies viewer, selection, search, link, and bookmark models. Does not establish full annotation/editor parity. Native and browser module support require independent checks. |
| Apache PDFBox | Apache-2.0 | Java forms, manipulation, extraction, rendering, printing, signing. A possible future offline batch/native tool; JVM integration is less direct for the shared browser application. |
| PoDoFo | Library: LGPL-2.0-or-later OR MPL-2.0; tools: GPL-2.0-or-later | Current C++17 API documents incremental writes and PAdES-B signing, but no rendering. Future mutation/signature candidate, with additional native dependencies. |
| Apple PDFKit / Android PdfRenderer | Platform SDK terms | Useful native integration candidates; adopting separate engines would add behavioral differences. Android API capabilities depend on OS level. |
| pdf-lib | MIT | Portable JS generation, forms, drawing, metadata, and page operations. No encrypted-document support or general existing-page text editing/extraction. Development fixtures only. |

**FACT:** Apache-2.0 requires preservation of applicable licensing and attribution notices; altered upstream files require change notices. MIT requires retention of its copyright/permission notice. A package's top-level license is not a complete review of bundled fonts, codecs, WASM, or transitive dependencies. The app's own distribution license remains undecided (`UNLICENSED` package metadata); using permissive dependencies does not choose it for the owner.

Primary sources:

- [PDF.js license](https://raw.githubusercontent.com/mozilla/pdf.js/master/LICENSE)
- [PDFium current license](https://github.com/chromium/pdfium/blob/main/LICENSE)
- [PDFium binary distributor and experimental WASM statement](https://github.com/bblanchon/pdfium-binaries) — this distributor explicitly is not affiliated with Google or Foxit; its own MIT license is not the complete PDFium license record.
- [MuPDF license](https://mupdf.readthedocs.io/en/latest/license.html)
- [Poppler](https://poppler.freedesktop.org/) and [official GPL source header](https://poppler.freedesktop.org/api/cpp/poppler-document_8h_source.html)
- [Qt PDF](https://doc.qt.io/qt-6/qtpdf-index.html) — the unversioned documentation redirected to a snapshot during research; verify release-specific terms before selection.
- [Apache PDFBox](https://pdfbox.apache.org/)
- [PoDoFo library/features/license](https://github.com/podofo/podofo)
- [pdf-lib limitations and encryption handling](https://github.com/Hopding/pdf-lib#limitations), [license](https://github.com/Hopding/pdf-lib/blob/master/LICENSE.md)
- [Apple PDFKit](https://developer.apple.com/documentation/pdfkit), [Android PdfRenderer](https://developer.android.com/reference/android/graphics/pdf/PdfRenderer)

## Pinned PDF.js compatibility and API constraints

**FACT:** The upstream FAQ distinguishes modern and legacy builds. It lists modern Chrome and Firefox; legacy Chrome 125+, Firefox ESR+, Chromium Edge, and Safari 18+ with Safari described as mostly supported. Those are upstream targets, not Folio verification. [PDF.js FAQ](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions).

**DESIGN DECISION:** Evaluate the legacy display/worker and matching legacy viewer entry points for broader compatibility. The package supplies both `web/pdf_viewer.mjs` and `legacy/web/pdf_viewer.mjs`. Using a legacy parser with an untested modern viewer does not by itself establish the legacy compatibility envelope. Verify actual browser APIs and syntax in production output.

**FACT — installed-package inspection:**

- Viewer components access `globalThis.pdfjsLib`; module evaluation must initialize the display module before the viewer executes. Display and viewer version mismatch is rejected.
- `PDFDocumentProxy.getPermissions()` returns `Promise<Set<number> | null>` in 6.3.289, not the array returned by some older versions.
- `getSignatures()`, `getSignatureData()`, and `saveDocument()` exist in installed types. Signature metadata retrieval is not cryptographic verification.
- `PDFViewer` defaults `enablePermissions` to false. Folio must explicitly set it true and independently gate its own export/edit/print commands.
- Viewer scripting becomes enabled when a `scriptingManager` is supplied. Omit that manager; do not instantiate `PDFScriptingManager`.
- `enableXfa` defaults false. Keep unsupported XFA behavior explicit, rather than implying AcroForm support covers XFA.
- `maxCanvasPixels` and `maxCanvasDim` bound page canvases. `canvasMaxAreaInBytes` controls image resizing in workers. A low `maxImageSize` can omit page images, so it must not silently trade document fidelity for speed.
- `cleanup()` must not run during active rendering. Cancel/finish render tasks before freeing resources; destroy document/loading tasks on close.

These were read in `node_modules/pdfjs-dist/types/src/display/api.d.ts`, `types/web/pdf_viewer.d.ts`, and the distributed display/viewer modules. Public [API documentation](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html) is a draft and can advance beyond a pinned release; installed types/source prevail.

## Hostile-input security

**FACT:** CVE-2024-4367 / GHSA-wgrm-67xf-hhpq affected `pdfjs-dist <=4.1.392`; 4.2.67 patched it. The historical workaround was `isEvalSupported:false`. [Mozilla advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq).

**FACT — correction after pinned inspection:** `isEvalSupported` no longer appears in the installed 6.3.289 display API types or legacy display/worker code. Do not pass an obsolete option, suppress type errors, or claim it provides a current safeguard. The selected release contains the upstream fix; scripting suppression, dependency updates, and CSP are separate controls.

**DESIGN DECISIONS / REVIEW REQUIREMENTS:**

1. Do not enable PDF JavaScript or auto-execute open, launch, submission, multimedia, or embedded-file actions. JavaScript-dependent form calculations may therefore be unsupported.
2. Treat document metadata, outlines, field names, and comments as untrusted text. Use `textContent`, never content-driven HTML.
3. Apply a URL-scheme allowlist to links and a deliberate user-click requirement. External destinations must not inherit an opener. The app must not automatically follow document-triggered URLs.
4. Keep parser workers, cmaps, fonts, image decoders, color profiles, and WASM on the app origin. No document data goes to telemetry, error reporting, remote OCR, or analytics.
5. Use a restrictive production CSP compatible with bundled workers/fonts and explicitly reviewed WASM needs. Browser development HMR policy is not the production policy. Do not grant broad script eval to fix integration problems.
6. Permission and signature inspection failures should fail closed for mutation. Reading may remain available with a clear limitation. Controls alone are insufficient; command handlers must enforce policy too.
7. Bound rendering jobs, cancel stale work, and surface failure for hostile/oversized input. A worker improves responsiveness but is not an independent OS sandbox.
8. Preserve original bytes and never overwrite the source through the browser baseline. Reopen exported bytes before download; preserve dirty state on serialization/validation failure.
9. Avoid logging passwords, PDF content, field values, document paths, or extracted text. Passwords remain ephemeral and must not enter recent-file storage.
10. Native adapters must enforce narrowly scoped filesystem permissions and validate IPC. Android's own PdfRenderer guidance recommends an isolated process with minimal permissions for untrusted PDFs.

**UNRESOLVED:** A clean npm audit does not establish absence of parser vulnerabilities. Maintain upstream security monitoring, pinned updates, dependency notices, malicious-fixture tests, and a documented update procedure.

## Mutation, forms, and signatures

**DESIGN DECISION:** PDF.js annotation storage/editor and `saveDocument()` form the initial supported save route. Test highlight, ink, free-text, and supported AcroForm fields independently. No claim covers annotations the application does not expose or unsupported field types.

**FACT:** pdf-lib explicitly does not support encrypted documents. `ignoreEncryption:true` does not decrypt; upstream warns modifications may fail or have unexpected results. Folio must never use this option. Its development-only use avoids adding a second user-document mutation engine.

**DESIGN DECISION:** Treat signed/certified documents as read-only until incremental changes and certification permissions are tested. Preserve the original signed bytes. Retrieved signer names are document-supplied data, not proof of identity or validity. A typed or drawn signature is a visible mark, never a certificate signature.

**INFERENCE:** Future certificate signing needs controlled byte ranges, incremental updates, key storage, certificate validation, and decisions about timestamps/revocation. PoDoFo and PDFBox merit later investigation; neither is currently installed for application use. Signature-preserving mutation must be a separate verification gate.

Export verification should check expected page count, mutation persistence, retained text/structure, and representative rendered content. A successful parser reopen alone is insufficient to establish visual or semantic fidelity.

## Framework alternatives

| Option | Assessment |
| --- | --- |
| Native DOM + TypeScript + PDF.js | Selected; one browser rendering/domain core, normal semantic controls, responsive CSS, no UI framework dependency required. |
| Tauri 2 with the same frontend | Preferred future wrapper candidate for OS file dialogs, associations, native saving, and mobile packaging. System WebViews introduce their own test matrix; narrow IPC capabilities are required. |
| Electron | Mature desktop APIs and a consistent Chromium renderer; Chromium/Node distribution/update burden and no direct mobile answer. Deferred. |
| Flutter | Serious shared app framework across mobile/desktop/browser. A concrete PDF engine/package strategy still has to bridge native/web behavior. Browser file restrictions remain. Not selected for this first browser core. |
| Qt | Strong native viewer foundation; Qt WebAssembly exists, but individual modules and mobile browser behavior require validation. Adds native build and license obligations. |
| React Native / Expo | Strong mobile ecosystem, while web/Windows/macOS/Linux involve partner/community platforms or bridges. Extra integration boundaries for this browser reader. |
| Separate Swift/Kotlin/.NET/native apps | Could provide deeper OS specialization but would duplicate substantial UI/integration effort before evidence justifies it. |
| WASM document core | Retained as a future engine option. WASM does not automatically solve payload size, browser memory, accessibility, or safe distribution. |

Primary sources: [Tauri](https://v2.tauri.app/start/), [Tauri security](https://v2.tauri.app/security/), [Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model), [Flutter web FAQ](https://docs.flutter.dev/platform-integration/web/faq), [Qt supported platforms](https://doc.qt.io/qt-6/supported-platforms.html), [React Native out-of-tree platforms](https://reactnative.dev/docs/out-of-tree-platforms).

## Browser opening, recent files, storage, and offline operation

**FACT:** `showOpenFilePicker()` is limited-availability, secure-context functionality. It is not a universal file-opening baseline. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker).

**DESIGN DECISION:** Use `File` input and optional drag/drop everywhere feasible; add handle-based enhancements only after feature detection. Browser recent-file metadata may require selecting the document again. Do not imply a saved filename grants persistent file access.

**FACT:** Browser storage quotas and eviction vary. IndexedDB/OPFS cannot be presented as guaranteed backup. Catch quota errors and provide export; never mark a failed recovery write successful. [Storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

**INFERENCE / PLANNED:** Service workers can cache the app shell and all required engine assets. Offline support is only verified after a production build opens/renders a local fixture with networking disabled. No document-content caching or service-worker update should silently lose unsaved work. [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API).

## Printing

**FACT:** `window.print()` invokes the browser print dialog; it does not report that a printer successfully produced output. [MDN print](https://developer.mozilla.org/en-US/docs/Web/API/Window/print).

**DESIGN DECISION:** Printing belongs to a platform adapter. Preserve page dimensions and pagination; make memory-heavy preparation cancellable. Browser-generated raster print pages can lose selectable/vector output and need explicit fidelity tests. Delegating exported PDFs to platform viewing/printing must be labeled as delegation. Physical printer success and mobile share-sheet behavior remain independently testable outcomes.

## OCR

**FACT:** Tesseract is Apache-2.0. Tesseract.js wraps its WASM engine for browsers/Node but explicitly does not accept PDF files directly. [Tesseract manual](https://tesseract-ocr.github.io/tessdoc/), [Tesseract.js](https://github.com/naptha/tesseract.js), [package license](https://github.com/naptha/tesseract.js/blob/master/package.json).

**DESIGN DECISION:** Defer OCR until reading and safe export are stable. A future local pipeline must rasterize selected pages, use a bounded/cancellable worker queue, review traineddata/codec licenses, and safely add a searchable text layer. Benchmark model loading, memory, accuracy, and offline behavior; do not equate image OCR with a verified PDF OCR workflow.

## Performance and accessibility evidence boundaries

**FACT:** PDF.js recommends rendering only visible pages because high-DPI canvases multiply memory use. **DESIGN DECISION:** Use its rendering queue with bounded page canvases, cancellation, and resource cleanup. Record actual fixture bytes, page count, viewport, browser, hardware class, first-render/search/navigation time, and memory measurement method where available. No competitor benchmark was performed in this research.

**INFERENCE:** Semantic controls plus text/structure layers offer a stronger browser-accessibility basis than a canvas-only interface. They do not repair missing PDF tags or guarantee correct reading order. Keyboard, focus, contrast, zoom, screen reader output, mobile selection handles, stylus input, and reduced-motion behavior each need direct tests.

## Outstanding verification gates

- Check complete license notices in shipped decoder, cmap, font, color-profile, and WASM artifacts.
- Establish production CSP and test that documents cannot trigger unexpected network requests/actions.
- Verify permissions, signature detection, failed inspection, damaged input, and password cancellation fail safely.
- Reopen saved highlight/ink/free-text/forms fixtures and compare unaffected content.
- Exercise physical iOS/Android, Safari, storage eviction, touch selection, and stylus behavior; desktop viewport emulation is not physical-device evidence.
- Measure large-document memory and timing; set practical product limits from measurements.
- Verify print pagination/fidelity and distinguish dialog invocation from completed printing.
- Review native SDK and packaging requirements only when native adapters are actually implemented.
