# Synthetic PDF fixtures

Run `pnpm fixtures` from the repository root. All fixture content is original,
synthetic project material; no personal documents or third-party PDF examples are
included. Generated binaries live in `generated/` and are ignored by Git. The
same command creates the original four-page `public/demo.pdf` used by the app.

| Fixture | Purpose |
| --- | --- |
| `demo.pdf` | Four-page field guide with text, outline, forms, existing comment and a safe HTTPS link |
| `text-outline.pdf` | Three pages, three outline entries; `amber heron` occurs once per page; `UniqueToken1` through `UniqueToken3` identify unaffected page text |
| `form.pdf` | Text (`reader_name`), dropdown (`review_status`), checkbox (`approved`), multiline text (`notes`) |
| `multi-widget.pdf` | Two text widgets for one `shared_name` field; radio group `shared_choice` with `Alpha`/`Beta`; open duplicate documents to test tab isolation |
| `annotations.pdf` | Existing highlight, underline, strikeout, comment, ink and free-text annotations |
| `mixed-pages.pdf` | Four different media boxes and rotations of 0, 90, 180 and 270 degrees |
| `images.pdf` | Four image-bearing pages generated from an original raster |
| `scanned.pdf` | One raster page with no searchable PDF text layer |
| `large.pdf` | 200 lightweight pages, 28 text lines per page; `LastPageNeedle` on the final page |
| `unsigned-signature.pdf` | One empty signature widget; not a signed PDF and not a signature-validation fixture |
| `hostile-actions.pdf` | Inert test payloads for PDF JavaScript, a JavaScript URI, and a launch action; none must execute |
| `encrypted.pdf` | Optional AES-128 password fixture, user password `folio-test`, owner password `folio-owner-test` |
| `restricted.pdf` | Optional AES-128 permissions fixture; opens without a user password, permits printing only |
| `malformed.pdf` | Deliberately incomplete object graph; safe failure is expected |
| `unsupported.txt` | Non-PDF input for boundary validation |

The fonts are PDF standard fonts embedded/referenced through pdf-lib. Raster
images are drawn locally through PDF.js's optional Node canvas dependency. If
that optional dependency is unavailable, the generator uses an embedded original
one-pixel image, still with no text layer; the manifest and generation must be
checked before making visual/performance claims on a different machine.

Encryption fixtures use Python `pypdf` plus `cryptography`. The generator checks
the bundled runtime, `CODEX_PRIMARY_RUNTIME_PYTHON`, `FOLIO_PYTHON`, and Python on
PATH. When these optional dependencies are absent, it prints a clear notice and
ordinary fixture generation succeeds. Install those Python packages and set
`FOLIO_PYTHON` to the executable to enable password and restriction tests.
Encryption output is intentionally not byte deterministic (encryption uses fresh
random values); its document content and intended behavior are reproducible.

Fixture tests use the actual PDF.js parser, not just generator inspection.
Modification tests must assert saved PDF reopening, changed values, preserved
baseline text, and unchanged source bytes. Run tests against copies or in-memory
buffers; never overwrite fixture inputs. Passing fixture-shape tests alone does
not establish that a UI workflow works.
