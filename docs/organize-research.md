# Safe-copy page organization

Research and implementation reviewed **2026-10-03 UTC**. This report concerns the page organizer; it does not change the existing reader's incremental annotation/form save path or implement certificate signing.

## Evidence and dependency decision

- **FACT — installed license:** `node_modules/pdf-lib/package.json` identifies version **1.17.1**; its `LICENSE.md` grants MIT permissions with copyright/permission notice retention and an as-is disclaimer. The upstream [repository](https://github.com/Hopding/pdf-lib) identifies MIT. Commercial distribution is permitted under those conditions; the application must distribute the package notice. This is dependency due diligence, not a legal opinion about every deployment.
- **FACT — supported APIs:** The official [PDFDocument API](https://pdf-lib.js.org/docs/api/classes/pdfdocument) provides page copying, adding/removing pages and serialization. Its document-copy API expressly warns that not all document structures transfer. Installed `src/api/PDFDocument.ts` and `src/core/structures/PDFPageLeaf.ts` were inspected rather than assuming that visual page copying preserves catalog/form/navigation semantics.
- **FACT — limitations:** The upstream [README limitations and encryption sections](https://github.com/Hopding/pdf-lib#limitations) state that encrypted input is unsupported and ordinary existing page text is not an editable text API. `ignoreEncryption` does not decrypt files. Folio never enables it. This package is not an OCR engine, renderer, trustworthy signature-preserving incremental writer or general content editor.
- **FACT — release evidence:** The official [release list](https://github.com/Hopding/pdf-lib/releases) still identifies 1.17.1 as its latest published release when reviewed. An old stable release is not evidence of active security maintenance. No unreviewed fork or encryption patch is introduced.
- **DESIGN DECISION:** Promote the already installed MIT package from fixture-only use to the bounded organizer runtime. Keep PDF.js 6.3.289 as the separate parsing/rendering/extraction engine that validates the writer's result. The package choice does not establish unrestricted document compatibility.
- **INFERENCE:** Reusing a browser-capable TypeScript/JavaScript writer is preferable to adding a server upload or second platform-native editing stack for these limited operations. The small shared surface is easier to replace if future fidelity/security evidence requires a different engine.
- **UNRESOLVED:** Broader embedded-font, color-managed, transparency, exotic image, unusual-object and large-byte corpus coverage is needed before expanding eligible documents or limits. Current successful fixtures do not establish universal PDF fidelity.

## Implemented API

`src/core/organize.ts` exports `organizePdf(inputs, operation, options)` and `OrganizationError`.

Inputs are explicit `{ name, bytes: Uint8Array }` values. The API returns a new `{ name, bytes, pageCount, notes, verification }` value; it cannot overwrite an input file. Page numbers are **1-based**.

| Operation | Contract |
|---|---|
| `extract` | One input; copy the listed unique pages in the listed order. |
| `reorder` | One input; supply every page exactly once in the desired order. |
| `delete` | One input; omit the listed pages and keep the others in original order; at least one page must remain. |
| `rotate` | One input; add 90, 180 or 270 clockwise degrees to selected pages' existing permanent rotation. |
| `merge` | Two to ten inputs; concatenate every page in input order. |

The caller supplies the same local `standardFontDataUrl`, `cMapUrl`, `wasmUrl` and `iccUrl` used by the reader, and initializes the existing PDF.js worker. There is no document upload, font CDN, account or remote processor in this module. An optional AbortSignal cancels before output is returned. Secure-context Web Crypto supplies SHA-256 for rendered evidence; missing canvas/crypto capability fails closed.

Input buffers and the requested operation are copied before the first asynchronous boundary. UI edits to source arrays or selection while preflight runs cannot change the request. Error messages explain that originals remain unchanged; underlying failures remain available as `Error.cause` for diagnosis without logging document contents automatically.

## Eligibility and intentional limitations

**DESIGN DECISION:** Require agreement between PDF.js and pdf-lib about page count and rotation before copying. Reject encrypted PDFs even if they open with an empty/default password, all non-null permission sets, signature dictionaries/fields, AcroForm/XFA, and page annotations including links/widgets. Preflight covers every source page, including pages omitted by extraction/deletion. The organizer does not flatten or silently drop those structures.

Also reject outlines, named destinations, scripts/actions, embedded or associated files, portfolios, tagged reading order, optional-content layers, output intents, custom page labels and unknown catalog/page structures. These restrictions are deliberate because page-only copying cannot currently preserve their cross-page references or semantics. Read-only eligibility is separate from the reader's broader ability to display a file.

The returned copy intentionally omits title, author, dates and other document metadata and resets viewer preferences. The UI must describe this page-only behavior before export and present the returned notes. Output receives new Folio creator/producer metadata. There is no claim that source byte ranges, document identity, PDF/A conformance, certificate validity or all original document semantics survive. The existing reader export path remains the appropriate route for supported annotations and forms.

## Integrity verification

Before copying, each retained source page is independently parsed by PDF.js. Evidence captures its visible page box, user-unit value, permanent rotation, and extracted text strings/direction/positions/dimensions/line breaks. PDF.js renders the page on a white canvas with rotation normalized to zero; SHA-256 records exact resulting pixel bytes and dimensions. Standard-font substitution is disabled so configured local assets, rather than arbitrary installed system fonts, drive verification.

After pdf-lib creates new bytes, PDF.js reopens those bytes and repeats the evidence for every output page against its designated source page. Permanent rotation must equal the requested composition; unrotated page content must remain identical. A separate pdf-lib reparse checks media, crop, bleed, trim and art boxes. Output page count must match the selection. A mismatch or any parsing/rendering failure rejects the result; no unverified output is returned.

**VERIFICATION LIMIT:** Pixel checks use at most **512 pixels per dimension** and scale no larger than 1. They can catch missing images, altered visible content and substantial geometry mistakes, but cannot prove full-resolution print fidelity. Exact comparison can also reject otherwise acceptable files; such rejection is preferable to claiming unverifiable preservation. PDF.js is independent of the mutation library but is not an independent human visual audit or second rendering engine.

## Resource bounds

The operation accepts at most **50 MiB combined input**, **500 combined source pages**, and **10 files**. Each page is processed sequentially; only its current bounded verification canvas exists, then is destroyed. Stored evidence contains text and compact hashes, not all rendered bitmaps. Source readers are destroyed in finally paths, cancellation checks occur during loops, and processing yields between retained pages.

These bounds avoid unbounded canvas retention; they are not a measured guarantee of low memory on physical phones. Source byte snapshots, PDF.js state and writer object graphs still coexist. File-size/page limits may require tightening after actual mobile memory testing. Operations are not streamed or delegated to a dedicated mutation worker in this first implementation.

## Automated evidence

`node --test tests/unit/organize.test.mjs` uses Node 24 on Windows with the installed PDF.js Node canvas implementation. Synthetic fixtures are generated in memory; existing repository fixtures supply scans, encrypted/restricted PDFs, forms, signatures, annotations and damaged input.

**Observed result:** all **24 organization tests passed, zero skipped**, in approximately 2.2 seconds; TypeScript `tsc --noEmit` passed. This timing is suite execution duration, not a document-performance benchmark.

The suite verifies all five operations; text/vector/image content; mixed sizes and existing rotation; media/crop/bleed/trim/art boxes and user units; unchanged input hashes; unsupported document rejection; unique/ranged page selection; empty-result, size/page/file limits; cancellation; immutable asynchronous snapshots; and explicit metadata omission. A deliberate writer fault paints over copied content, proving that independent pixel verification rejects a changed result. No unsafe input is treated as a successful best-effort export.

Integration into the application, browser E2E, deployed-host execution and Linux CI are separate evidence gates owned by the root implementation. Unit results do not establish physical touch, mobile memory, Safari, native packaging, actual certificate signing or production readiness.

### Browser UI verification

The modular `src/features/document-tools.ts` dialog now calls the organizer through a verified reader checkpoint without acknowledging or clearing the original document's dirty state. Merge uses a real multiple-file input. The result is downloaded or opened in a separate tab only when the user chooses the corresponding action. Changing the selection invalidates the previous result; closing or cancelling aborts pending processing. Detailed verification limits are expandable after the result, while metadata omission is explained before the operation.

On **2026-10-03 UTC**, the production build served at localhost port 4173 passed **8/8 Windows Edge organization E2E cases, zero skipped**, in **18.3 seconds** of suite execution. The command was `playwright test tests/e2e/organization-workflows.spec.ts --reporter=list --output=test-results/organization-production`. Cases exercised all five operations, download/independent parse/separate-tab reopen, invalid and duplicate selections, refusal of an edited form with its original value and dirty state retained, cancellation, Escape focus restoration, and a 390x844 touch-emulated phone dialog. Per-test monitoring recorded no external requests or uncaught browser exceptions.

The production phone screenshot was inspected: all fields, output actions, expandable limits and Close fit the viewport without horizontal body overflow. The screenshot is a local test artifact at `test-results/organization-production/organization-workflows-pho-03adf-h-and-fits-the-phone-dialog/phone-organization.png`. Browser automation does not establish physical-phone performance or native-platform behavior. Hosted deployment and any later remote CI result remain separate root verification records.

## Next engineering checks

1. Exercise the caller's actual download/reopen UI on a plain PDF and a refused annotated/protected PDF.
2. Extend the corpus with embedded/CJK/RTL fonts, transparency, image codecs, offset/negative boxes and high-resolution scans; investigate any refusal with retained synthetic reproduction.
3. Measure CPU/memory/cancellation on representative physical phones before increasing limits.
4. Add preservation for individual document structures only when its references and output semantics can be tested; keep unsupported cases explicit.
5. Review upstream advisories and maintenance before release; keep runtime notices with distributed assets.
