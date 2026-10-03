# Local OCR and certificate research

Research date: 2026-10-03 UTC. **FACT** describes upstream evidence or inspected artifacts; **INFERENCE** describes an engineering assessment; **DESIGN DECISION** describes Folio's chosen approach. Runtime verification is recorded separately from upstream capability claims.

## OCR selection and licensing

**FACT:** [Tesseract.js](https://github.com/naptha/tesseract.js) runs the Tesseract OCR engine through WebAssembly in browser workers. It consumes images rather than PDF files. PDF pages therefore need rendering before recognition. Since version 6, structured output must be requested explicitly; text alone is the default. The package is Apache-2.0.

**FACT:** On the research date, the public npm registry reported `tesseract.js` 7.0.0 with a `tesseract.js-core` dependency of `^7.0.0`. The core package contains version 7.0.0 even though its `latest` distribution tag pointed to 6.1.2. Resolve and pin the required version, rather than assuming both latest tags match. Registry evidence: [wrapper](https://registry.npmjs.org/tesseract.js), [core](https://registry.npmjs.org/tesseract.js-core).

**FACT:** `@tesseract.js-data/eng` 1.0.0 labels its package MIT. Its [upstream model repository license](https://github.com/naptha/tessdata/blob/gh-pages/LICENSE) is Apache-2.0. Preserve both the packaging notice and the model license when distributing a selected English model. Registry evidence: [English model package](https://registry.npmjs.org/@tesseract.js-data/eng). This packaging distinction must not be collapsed into an MIT-only notice for the trained model.

**FACT:** The exact selected model bytes match upstream tessdata revision `806cd9adc8c6e8abc11c782db1818c990576bebc`; SHA-256 `45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91`. Full wrapper/model/native/compiler/worker-dependency notices and hashed provenance are preserved under [`third_party/ocr`](../third_party/ocr/README.md). Core source revision `acffef2b66eb44a31df297e11d905f4b39001068` builds Leptonica, giflib, libjpeg, libpng, libtiff, libwebp, zlib, OpenLibm, and Tesseract. The installed Apache-only core notice is insufficient to describe all these components. The complete OpenLibm notice mentions LGPL test files; the inspected `install-static` target builds its permissive library, not those test programs.

**INFERENCE:** Package-manager vulnerability audit cannot establish the security of native libraries embedded in a WASM package. The pinned zlib README identifies 1.2.12; native advisory review remains a release task. Feeding only browser-encoded PNGs from bounded PDF.js canvases reduces exposure to arbitrary crafted native image formats. It does not prove that the OCR engine has no exploitable defects.

**DESIGN DECISION:** Use the existing PDF.js renderer to produce bounded page images and Tesseract.js LSTM recognition in a single sequential worker. Recognized text is a separate result, never a replacement for the source document's text. English is the initial bundled language. Do not claim multilingual, handwriting, table reconstruction, or layout fidelity without dedicated tests.

## Self-hosted assets and API

**FACT:** The [local installation guide](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md) and [API reference](https://github.com/naptha/tesseract.js/blob/master/docs/api.md) expose `workerPath`, `corePath`, and `langPath`. Supply all three: their defaults can fetch third-party CDN resources. `corePath` should be a directory containing the relevant feature-detected variants. `langPath` resolves a language name to a `.traineddata.gz` file. Set `workerBlobURL: false` to load the self-hosted worker directly.

**DESIGN DECISION:** The application serves the worker under `vendor/ocr/worker.min.js`, the selected LSTM core variants under `vendor/ocr/core/`, and `eng.traineddata.gz` under `vendor/ocr/lang/`. All URLs are derived from the application's same-origin base path. No recognized content, page image, or PDF is uploaded. OCR result text is kept in memory until the user explicitly exports it. Disable Tesseract's IndexedDB model cache; optional service-worker asset caching owns offline availability and version consistency. OCR assets should load on explicit use/preparation, without making ordinary reader installation download all OCR variants.

**FACT:** Public registry metadata reports 1,411,341 unpacked bytes for the wrapper, 45,262,431 for the entire core 7.0.0 package, and 13,876,967 for the English model package. These are package sizes, not application transfer sizes, runtime memory, or selected-asset sizes. The application should ship only required LSTM variants and one model, while preserving CPU/browser fallback coverage.

**FACT:** Installed version 7.0.0 selects three LSTM `.wasm.js` variants: `tesseract-core-lstm.wasm.js` (3,896,484 bytes), `tesseract-core-simd-lstm.wasm.js` (3,899,472 bytes), and `tesseract-core-relaxedsimd-lstm.wasm.js` (3,905,767 bytes). These files embed their WASM; a browser smoke test requested no separate `.wasm` file. `worker.min.js` is 111,307 bytes. The selected `4.0.0_best_int/eng.traineddata.gz` is 2,952,873 bytes. Only one core variant loads per device. These are uncompressed file sizes except for the already-gzipped model; HTTP transfer compression may differ.

**INFERENCE:** Wasm SIMD availability varies by browser and device. Keeping a non-SIMD fallback is necessary; availability of a Tesseract build does not establish Safari/iOS compatibility of the complete Folio workflow. Physical mobile memory behavior and Safari need independent verification. OCR can consume substantially more memory than its input canvas; a raster-pixel limit bounds only one contributor.

## Document and execution safety

**DESIGN DECISION:** Check the PDF's copy permission before OCR, so recognition cannot become a copy-restriction workaround. OCR reads base page content; editor overlays and interactive form controls are not flattened into the recognized image. It never modifies the PDF, its annotation storage, or the original bytes. Any later searchable-copy exporter is a separate mutation path with its own protected-document guard and reopen verification.

**DESIGN DECISION:** Limit a job to 50 distinct pages, one OCR worker and one page at a time, a raster of at most 4 million pixels/4096 pixels per side/180 nominal DPI, 90 seconds total initialization, 90 seconds per worker command, and 120 seconds per page. Limit returned text to 2 million characters. Release every canvas. Cancellation stops the OCR-owned render operation and OCR worker; it must not destroy the shared PDF.js document or cancel the reader's render operations. Report progress without logging document text. These are protective limits, not demonstrated mobile capacity. Text/coordinates are recognition estimates, and users must review output before relying on it.

**FACT:** Inspection of installed `tesseract.js` 7.0.0 `src/createWorker.js` found that its public factory returns the worker only after initialization, and catches initialization-chain failures without exposing early worker ownership. **DESIGN DECISION:** `src/core/ocr-worker.ts` owns a native worker immediately and implements a small sequential adapter to the pinned worker's inspected message protocol. This allows termination during core/model loading and recovery from errors without hidden pending initialization. It uses the packaged engine unchanged. Recheck `src/createWorker.js`, `src/worker-script/index.js`, and `src/worker-script/browser/getCore.js` and run cancellation/recognition tests on any dependency upgrade. This is a version-sensitive integration boundary.

**DESIGN DECISION:** Return page text, engine confidence, pixel bounds, and word quadrilaterals/axis-aligned rectangles in original PDF user coordinates. PDF.js's inverse viewport maps coordinates including crop/rotation. OCR preserves the raster orientation and does not request Tesseract auto-rotation, so coordinates remain in that raster's space. Automatic orientation correction, deskew, original font reconstruction, and semantic reading-order guarantees are not implemented.

## Certificate signatures: distinct capability

**FACT:** [PKI.js](https://github.com/PeculiarVentures/PKI.js) provides browser/Node CMS, X.509, and related PKI structures using Web Crypto. Its [license](https://github.com/PeculiarVentures/PKI.js/blob/master/LICENSE) has three-clause BSD conditions. It is a cryptographic component, not a complete PDF incremental writer or a system trust-store adapter.

**FACT:** The PKI.js documentation links [PDF signature verification](https://pkijs.org/docs/examples/other/how-to-verify-a-signature-in-a-PDF-file/) and [PKCS#12](https://pkijs.org/docs/examples/other/working-with-PKCS-12-files/) pages, but their example bodies said “Coming soon” when inspected. Do not present these pages as tested integration recipes.

**FACT:** [@signpdf](https://github.com/vbuch/node-signpdf) uses the MIT license and targets Node.js. Its P12 signer uses `node-forge` to create detached signatures. The project explicitly limits its plain placeholder helper: fragile string operations, no stream support, and PDF version at most 1.3. The pdf-lib placeholder helper is a different path and rewrites the document. Browser operation must be demonstrated, including any Buffer compatibility, before adoption.

**DESIGN DECISION:** Never use the plain string placeholder helper for arbitrary user PDFs. Existing signed/certified/encrypted documents remain outside mutation scope. A visible handwritten mark is not a certificate signature. A mathematical CMS signature result is not a certificate trust, revocation, trusted timestamp, legal-validity, or PAdES-conformance verdict. Such verdicts need a separately designed trust policy and appropriate evidence. Never silently contact a timestamp, OCSP, or certificate endpoint: that is a network operation with privacy implications.

**INFERENCE:** A limited browser signing workflow is technically plausible with a reviewed PDF writer plus CMS/signing components, but it requires tests of byte ranges, signed content digest, tampering, encrypted-key import, key/certificate matching, output reopening, and verification by an independent implementation. It must keep imported key material in memory, avoid persistence/logging, and expose the absence of trusted timestamps and revocation checks. JavaScript cannot promise secure physical erasure of all runtime copies of a private key.

## Verification status

`src/core/ocr.ts` and `src/core/ocr-worker.ts` pass strict project type checking. A temporary Vite harness in Windows headless Edge exercised the real browser worker/WASM using same-origin routes serving the exact pinned assets:

- Synthetic `scanned.pdf` contained zero PDF text items. Recognition recovered the expected five lines (33 words, engine confidence 95); canvas 1530 by 1980, elapsed 1,332 ms. This is one local smoke measurement, not a representative-device benchmark.
- PDF annotation storage remained empty. No uncaught browser exceptions occurred. OCR requested only the same-origin worker, relaxed-SIMD LSTM core, and English model.
- While the model request was deliberately held, cancelling returned `AbortError` in 0.6 ms; one OCR worker was created and one closed. A copy-denied probe rejected before starting an OCR worker.

The real UI suite `tests/e2e/ocr.spec.ts` passed all three tests in Windows headless Edge against both the Vite development server (10.8 seconds total) and the production preview build (6.1 seconds total): image-only PDF to recognized text/download, cancellation while the model is loading plus retry, and a real copy-restricted encrypted PDF with no OCR asset requests. The recognition workflow checks that all network requests remain same-origin and that no uncaught browser exception occurs. Timings are suite durations, not page-recognition benchmarks. All 30 notice/metadata hashes in `third_party/ocr/sources.json` were independently recomputed and matched.

Optional offline OCR asset caching, Safari, and physical mobile OCR verification remain pending. The reader's existing platform results do not establish OCR parity on those platforms.
