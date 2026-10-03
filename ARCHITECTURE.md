# Architecture

Updated: 2026-10-02, America/Los_Angeles. Implemented development architecture; [verification](docs/verification.md) controls platform and final-test claims.

~~~mermaid
flowchart TD
 UI["Adaptive shell and sessions"] --> Core["Document controller"]
 Core --> Viewer["PDF.js viewer and editors"]
 Viewer --> Worker["PDF.js worker"]
 Core --> Adapters["Browser adapters"]
 Adapters --> Files["Local files and copy output"]
 Adapters --> State["Recent metadata and settings"]
 UI --> Cache["Versioned app cache"]
~~~

## Selected Approach

One responsive TypeScript/DOM UI, Vite and PDF.js 6.3.289 with matching legacy display/viewer/worker modules. Production parsing/rendering/supported mutation use PDF.js; pdf-lib is a development fixture and independent checking tool. No server, account, document database or upload endpoint.

The initial shell does not need a UI framework. Native integration remains an adapter choice after real platform evidence. Alternatives/licensing are in RESEARCH.md and docs/engine-research.md.

## UI and Sessions

src/main.ts owns tabs, dialogs, controls, adaptive navigation and keyboard handling. Each of up to three sessions retains its own controller/state. Inactive form-bearing DOM is detached to prevent global widget lookups/duplicate radio names crossing documents. Saved per-session position is restored on reattachment. Switching commits/exits editors; loading/closing and modal ownership are explicit.

Original CSS/icons form the product design. Phone actions remain reachable without desktop-only controls.

## Document Controller and Lifecycle

src/core/document-controller.ts owns original bytes, loading task/document proxy, viewer/link/find/editor managers, restrictions, dirty hash, export snapshot, timing and cancellation.

Local File → preserve original bytes → worker parse → inspect permissions/signatures/XFA → render/interact → supported annotation storage → snapshot/serialize → fresh-parser checks → new-copy download → explicit acknowledgment.

Inspection failures fail safely. Encrypted, signature-bearing, XFA and restricted PDFs are conservatively read-only. A signature field/appearance is not certificate validity.

## Rendering and Performance

PDF.js provides canvas, text/annotation layers, lazy page rendering and bounded buffers. Current safeguards include four-million-pixel page canvases, 8192 maximum dimension, disabled detail canvases, 150 MB input cap and three-document limit.

Thumbnail work is sequential/cancellable with limited dimensions/DPR. Offscreen preview backing buffers are released and replaced observers disconnected. Page placeholders still scale with document length. These limits are not demonstrated maximum capacity; the measured 200-page fixture is only about 343 KB.

## Search, Navigation and Properties

PDFFindController performs local text search, matches and result navigation. Image-only PDFs need future OCR. PDFLinkService resolves destinations; named actions and external URL schemes are restricted. Outlines/properties come from document metadata and are inserted safely as text.

View rotation is temporary. Zoom/fit/reading-mode controls reflect the active viewer. Native selection/clipboard obey engine permissions and browser behavior.

## Annotations, Forms and History

Authoring: text/freehand highlight, FreeText and ink. Existing annotation rendering does not imply authoring all subtypes; underline/strikethrough/sticky-note creation are absent.

AcroForm text, multiline, checkbox and dropdown values use PDF.js annotation storage. Duplicate-widget/radio isolation has specific regression coverage. XFA, PDF scripting/calculations/submission and certificate signing are not enabled. Read-only ResetForm actions are intercepted.

Annotation undo/redo delegates to PDF.js. Native field/text editing retains browser conventions; no unified form-history claim. Dirty state follows serialized storage and is flushed before consequential actions.

## Save Strategy

Commit pending input; clone an immutable snapshot/hash; serialize supported changes; require source bytes as exact prefix; reopen output; check page count, relevant geometry, changed fields and annotation objects; offer a safely named new copy; acknowledge only the exported snapshot after user confirmation.

Later edits remain dirty. Print/export serialization is coordinated. Read-only output preserves original bytes. Failed verification retains edits. Prefix preservation alone does not establish visual fidelity, so fixture/browser/independent checks complement it. Native atomic overwrite is absent.

## Platform Adapters and Persistence

src/platform/browser.ts owns user-triggered picker, downloads, print-copy windows and localStorage. Recent metadata is bounded to 12 records; no document/password/file handle is stored. Reopening requires selecting the file again. Storage failure leaves reading available.

Downloads report initiation, not disk completion. Print reserves a popup during user activation and opens a local PDF copy for native browser print/share; fallback behavior depends on popup permission. Physical printing is unverified. App-shell print styling prevents accidental document/chrome output through browser-menu paths.

## Offline Cache

Production generates a versioned asset allowlist. User PDFs/arbitrary URLs are excluded. Cached HTML and resources stay on one build; updates do not force activation over open documents. First setup needs network, while cached reload/local opening was verified offline. No unsaved-document recovery database exists.

## Security, Errors and Logging

No scripting manager/QuickJS resource is integrated. The old isEvalSupported option does not exist in this engine version. Permissions are explicitly enabled. HTTP(S)/mailto links use filtered schemes and safe relationships. Launch/embedded media/attachment execution is disabled.

CSP exists in HTML metadata and development/preview headers; deployment headers still need review. Metadata uses safe text insertion. No content telemetry or remote processing path. Input/password/render/storage/permission/save/print failures remain visible; logs must exclude contents/passwords.

## OCR, Signatures and Native Integrations

OCR and both basic signing workflow/cryptographic signatures are deferred. Signature fields trigger conservative read-only behavior; trust, revocation/timestamps and validity are not evaluated. Native menus/filesystem/share sheets, installers and updates are absent.

## Alternatives and Testing

PDFium adds bindings/native/WASM packaging responsibilities. MuPDF/Poppler require a deliberate licensing model. Qt/Flutter add browser/accessibility integration work. Electron does not solve phone/web. React Native needs reader bridges. Tauri may become a thin wrapper later. None justifies multiple document stacks now.

Unit tests cover adapters/fixtures; browser checks cover the shell; independent values/parser and screenshot reviews inspect output/layout. Isolated Edge checks additionally cover export races and read-only actions. Offline/benchmark runs are separate from ordinary E2E.

PROJECT.md contains platform status; docs/requirements.md contains acceptance; docs/verification.md contains exact latest results and limits. Emulation does not establish native/physical-device or full screen-reader support.
