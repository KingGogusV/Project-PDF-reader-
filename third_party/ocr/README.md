# OCR distribution notices

Preserve this directory with distributed OCR assets. These are upstream license/notice files, not application source code. Folio uses unchanged Tesseract.js 7.0.0 browser worker and unchanged Tesseract.js-core 7.0.0 LSTM WASM builds. The application does not bundle the compiler itself.

This software is based in part on the work of the Independent JPEG Group.

## Provenance

`sources.json` records exact source revisions/URLs and SHA-256 hashes for each copied file. JavaScript dependency archives were checked against their npm SHA-512 integrity before their license files were extracted. The worker source map was inspected to identify bundled JavaScript dependencies; versions come from the wrapper's published source revision package lock, rather than the application's possibly newer transitive packages.

- Tesseract.js 7.0.0 published source: `42eae669e4b3a66429d8516f078912cc747a89df`.
- Tesseract.js-core 7.0.0 published source: `acffef2b66eb44a31df297e11d905f4b39001068`.
- Native dependencies were resolved from that core revision's submodule pointers. Its `build.sh` and `build-scripts/build-leptonica.sh` build/link the listed image libraries; `build-with-docker.sh` specifies Emscripten 4.0.15.
- English model: `@tesseract.js-data/eng` 1.0.0, `4.0.0_best_int/eng.traineddata.gz`. Its bytes were compared with the same model at upstream tessdata revision `806cd9adc8c6e8abc11c782db1818c990576bebc` and matched exactly. Its SHA-256 is recorded in the manifest.

## License map

| Component | Terms / file |
| --- | --- |
| Tesseract.js, Tesseract.js-core, Tesseract, English trained model | Apache-2.0; corresponding license files |
| English npm packaging | Package metadata states MIT; preserved in `eng-package.json`. No packaging JavaScript is distributed with the model. The trained model's upstream Apache-2.0 notice is retained separately. |
| Leptonica | BSD-style two-clause terms, `leptonica-LICENSE.txt` |
| giflib | MIT terms, `giflib-LICENSE.txt` |
| Independent JPEG Group | IJG terms and required acknowledgement, `libjpeg-README.txt` |
| libpng | PNG Reference Library License terms, `libpng-LICENSE.txt` |
| libtiff | Permissive copyright/permission terms, `libtiff-LICENSE.txt` |
| libwebp | BSD-style terms plus patent grant, `libwebp-LICENSE.txt` and `libwebp-PATENTS.txt` |
| zlib | zlib terms in `zlib-README.txt` |
| OpenLibm | MIT, ISC, BSD, and Sun permissive portions; full upstream `openlibm-LICENSE.md` |
| Emscripten generated/runtime code | MIT / University of Illinois-NCSA terms; `emscripten-LICENSE.txt` |
| Compiler C/C++ runtime notices | `musl-COPYRIGHT.txt`, `libcxx-LICENSE.txt`, `libcxxabi-LICENSE.txt`, `compiler-rt-LICENSE.txt`, `libunwind-LICENSE.txt`; retained conservatively for standard runtime portions |
| Worker bundled JavaScript | Separate license files for base64-js, bmp-js, buffer, idb-keyval, ieee754, is-url, regenerator-runtime, wasm-feature-detect, zlibjs; preserve `worker-bundled-notices.txt` as well |

OpenLibm's upstream combined license file describes LGPL test programs. The pinned OCR build invokes OpenLibm's `install-static`, whose Makefile target depends on `libopenlibm.a`; the separate `test/test-double` and `test/test-float` programs are not included in that library target and are not distributed by Folio. Keeping the complete upstream notice does not imply that those test programs are shipped. A source/build configuration change requires a new review.

## Maintenance

On an OCR upgrade, resolve both wrapper and core published source revisions, inspect the worker source map/package lock and native build/submodule pins, refresh these notices without editing their upstream text, and rerun checksum verification. Public availability alone is not permission to reuse unrelated source.

The current record does not constitute a complete vulnerability assessment of statically linked native components. The focused advisory/build review in [`docs/ocr-research.md`](../../docs/ocr-research.md) identifies older zlib 1.2.12 and libwebp 1.2.2 pins and a production OCR release gate to update/rebuild native dependencies. Package-manager audit alone does not inspect dependencies embedded inside WASM. Folio only sends PNGs freshly encoded from PDF.js canvases to this engine; it does not accept arbitrary user image bytes into its native image decoders. Keep that boundary when extending OCR. It reduces exposure but does not patch the embedded libraries.
