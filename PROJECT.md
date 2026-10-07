# Folio - product record

Updated: **2026-10-07 UTC**. Folio is a functioning development application with verified browser workflows and substantial remaining release/platform gates. It is not certified production-ready. [Verification](docs/verification.md) records exact runs; results from the original reader do not automatically cover later features.

## Product Overview

Folio is an original, local-first PDF workspace for everyday reading, annotation, forms, document recovery and bounded document tools. It serves people using browsers, keyboards, pointers and touch screens. Opening and processing a document requires neither an account nor an upload.

Authoritative repository: [KingGogusV/Project-PDF-reader-](https://github.com/KingGogusV/Project-PDF-reader-). Original purpose: "Project to create free pdf reader that does not suck." Folio remains a provisional name, not trademark clearance.

An optional hosted account service supports **up to 200 registered accounts**. Account metadata is the only server-side application data. PDFs and recovery copies remain in the current device/browser profile. Deployment succeeded at [Folio](https://folio-local-pdf.gogoi-ronnie.chatgpt.site); the live database has an accounts table. Online hosted local-form storage/edit/reload recovery, anonymous responses, spoofed-header rejection and sign-in redirect passed. Actual managed sign-in/registration remains unverified. Deployment v4 publishes the accessibility pass at the same public URL. Its source tree matches GitHub commit `86f2547`; the application code passed 79 browser workflows each on Linux Chromium and macOS WebKit in Reader run 37140750050. All 15 accessibility scan states had zero violations. Earlier hosted guest recovery/offline and ink export/reopen verification is retained in the verification record; this publication does not claim a new signed-in session or physical screen-reader test.

## Product Principles

Cross-platform design; local processing; fast startup; accurate rendering; privacy; low friction; no unnecessary accounts; preserved original documents; understandable adaptive UI; keyboard, pointer and touch access; accessible controls; evidence-based support claims.

## Platform Strategy

| Target | Actual status | Limits and verification boundary |
|---|---|---|
| Web | Deployed; Windows browser checks and upgraded Linux Chromium/macOS WebKit CI passed | Actual managed account sign-in remains unverified |
| Windows | Browser checks plus actual installed native reader, form/annotation export and process-restart recovery passed | Published and verified unsigned x64 preview; signing and broader native integrations remain |
| macOS | 79 WebKit E2E cases passed; unsigned app/DMG built successfully | Branded Safari, WKWebView runtime, installation and notarization unverified |
| Linux | 79 Chromium E2E cases and upgraded unit/core/signing checks passed | Interactive desktop and physical printing unverified; no Linux native package configured |
| iOS/iPadOS | Experimental browser target | Responsive/touch emulation is not physical-device, Safari or screen-reader verification |
| Android | Experimental browser target | Physical file pickers, memory, selection, printing and sharing unverified |

Tauri Windows NSIS and macOS app/DMG artifacts were built by verified remote CI and are linked in verification. The current Windows session also has Rust 1.99.0, MSVC 14.51.36231 and Windows SDK 10.0.26100.0; local compilation and linking now pass. Earlier missing-prerequisite results remain historical. These remain unsigned development packages, not trusted production releases.

## Windows Preview Delivery

Release automation now separates verification from publication: automatic PR/matching-main runs retain installed-app verification, while a new public release requires an explicit main dispatch and exact reviewed commit confirmation. The optional dispatch defaults to verification only. See the [release procedure](MAINTENANCE.md#windows-download-release-pipeline); the current published preview remains immutable.

[Windows preview v0.1.1-preview.1](https://github.com/KingGogusV/Project-PDF-reader-/releases/tag/v0.1.1-preview.1) is published from source `8b9f1683bf0c47b9c8b2da4d638168c4a1e3b00f`. All four public assets were downloaded without credentials and their sizes, SHA-256 values, provenance and tag identity verified at 2026-10-03T18:05:44.007570+00:00. The unsigned Windows x64 installer is 17,854,309 bytes. [Release CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37142162439) passed installation, 14 native workflows, exact-byte NSIS identity, cleanup, notices and publication. [Reader CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37142162437) passed 63 unit tests with zero skips, 79 E2E workflows each on Linux Chromium/macOS WebKit, seven checkpoint cases and nine signing cases. [Native builds](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37142162471) passed on Windows and macOS.

Download [Folio-0.1.1-Windows-x64-Setup.exe](https://github.com/KingGogusV/Project-PDF-reader-/releases/download/v0.1.1-preview.1/Folio-0.1.1-Windows-x64-Setup.exe), run it, and launch Folio from Start. Local reading and opt-in storage need no ChatGPT account or developer tools. Optional website accounts use managed ChatGPT/OpenAI sign-in; native mode is a guest reader. Device copies remain unencrypted and separate from website storage. Initial installation may need internet for WebView2.

The installed app protects OS close with the shared save/discard flow. Completed-checkpoint recovery, form/annotation export-reopen and close cancel/discard passed in Windows CI for 0.1.1. Earlier normal-user 0.1.0 evidence remains separate. This remains a development preview: signing, associations, physical printing, macOS native runtime and physical mobile devices are separate gaps. See [maintenance](MAINTENANCE.md) and [installation](docs/windows-installation.md).

The published 0.1.0-to-0.1.1 installer upgrade passed 20 checks on 2026-10-07: three synthetic guest PDFs retained originals, unexported form/text-annotation checkpoints, records, exports and restart recovery. Environment: elevated disposable Windows Server 2025, WebView2 153.0.4234.48, isolated overridden profile. This does not establish a real default Windows 11 profile upgrade. One earlier abrupt-termination run lost its newest recent-file entry while PDF stores survived. [Evidence](docs/windows-upgrade-verification-2026-10-07.json) retains boundaries and failures. Application code, hosted deployment and published installers are unchanged.

## Current Technology Stack

| Concern | Actual choice |
|---|---|
| UI | TypeScript 7.0.2, modular DOM, original adaptive CSS/SVG |
| Reader and incremental annotation/form saving | PDF.js 6.3.289, matching legacy display/viewer/worker and local engine assets |
| Bounded page organization | pdf-lib 1.17.1 writer; PDF.js parsing, text and rendered-content verification |
| OCR | Tesseract.js/core 7.0.0, self-hosted English LSTM model and cancellable worker |
| Certificate signing | @libpdf/core 0.5.1 incremental writer; PKI.js 3.4.1 and ASN.1.js 3.0.10 verification; browser Web Crypto |
| Local persistence | IndexedDB original/latest PDF copies; localStorage preferences, recent metadata and optional account hint; versioned app/optional OCR asset cache |
| Hosted accounts | Same-origin worker API, managed ChatGPT identity, SQLite-compatible account table/migrations; no PDF upload API |
| Build | Vite 8.3.2, Node 24, pnpm 11.25.0; client and worker-server build outputs |
| Native packaging | Experimental Tauri 2 wrapper sharing the browser application |
| Tests | Node runner, PDF.js/pdf-lib checks, Playwright 1.63.0, axe 4.13.0 audits |

Original application source is **UNLICENSED** pending the owner's decision. Dependency notices and OCR native/model provenance remain separate distribution obligations. The exact pinned LibPDF FontBox Apache/PDFBox attribution is retained under [third_party/signing](third_party/signing/README.md) and copied into built distribution notices. See [research](RESEARCH.md).

## Architecture Summary

The adaptive shell owns tabs and dialogs. Each document controller retains original bytes, coordinates PDF.js rendering/editing, enforces restrictions and creates verified export or recovery snapshots. Platform adapters own browser output, local persistence and optional account requests. OCR, page organization and certificate signing are explicit local tools with separate safety boundaries. They do not upload documents.

## Important Directories

- `src/core/`: reader controller, safe page operations, OCR and certificate workers.
- `src/features/`: device-library/account interaction and document-tool dialogs.
- `src/platform/`: browser, account API and IndexedDB adapters.
- `src/ui/`, `src/style.css`, `src/main.ts`: adaptive presentation and session integration.
- `server/`, `db/`, `drizzle/`: account-only API, schema and migrations.
- `src-tauri/`: experimental native wrapper and prerequisites.
- `scripts/`, `tests/`, `public/`, `third_party/`, `docs/`: build/fixtures, verification, served assets, dependency provenance and durable records.

## Document Lifecycle

Open -> retain immutable original bytes -> PDF.js parse and restriction inspection -> render/interact -> supported edit storage -> verified snapshot -> explicit new-copy output or opt-in device checkpoint.

The controller owns reading and annotation/form snapshots. Reader exports must retain the exact original byte prefix and pass fresh-parser checks. The device library stores the immutable original separately from the latest verified revision. A background checkpoint does not acknowledge an external save or clear dirty state.

Page organization creates a separate page-only PDF after conservative eligibility checks and output comparison. It deliberately does not preserve original byte ranges or all document-level metadata. Certificate signing uses a distinct verified incremental-copy path. OCR returns separate text; it does not alter the PDF or add a searchable text layer.

## Platform Abstraction

Shared: document logic, rendering, search, supported annotations/forms, restrictions, checkpoint validation and local tools. Opening uses the WebView's HTML file input and operating-system chooser. Browser output retains downloads and explicit saved-copy acknowledgment. Development desktop reader output uses a Rust-owned Save As dialog, bounded binary transfer, no-overwrite publication and a verified disk receipt before acknowledging the exported revision. Tool-specific outputs and printing retain their existing browser handoffs. Associations, update delivery and share sheets remain unimplemented.

## Feature Status

| Category | Implemented behavior | Remaining limits |
|---|---|---|
| Reader | Open, scroll/single-page, thumbnails, outlines, page/search navigation, zoom/fit, view rotation, properties, adaptive controls | Broader fidelity and physical-device verification |
| Review/forms | Text/freehand highlight, FreeText, ink; supported text, multiline, checkbox, dropdown and radio fields; editor undo/redo | No new sticky-note, underline or strikethrough tools; no PDF scripts/XFA |
| Output | Validated new-copy download and explicit saved-copy acknowledgment; browser print/open/download handoff | Download initiation is not confirmed disk persistence; physical printing unverified |
| Device library | Opt-in immutable originals plus latest verified revision, recovery reopening, hash checks, quota handling and conflict refusal | Unencrypted browser-profile storage; eviction/termination can still lose uncheckpointed edits |
| Accounts | Account-only API/UI, identity-dependent registration, database-enforced 200-account cap, guest operation | Live accounts table confirmed; actual managed sign-in/account sessions and live capacity/load unverified; no cross-device PDF sync |
| OCR | English recognition, progress/cancel, separate text output and `.txt` download | Recognition estimates; no handwriting/multilingual guarantee, searchable-PDF export or layout reconstruction |
| Page tools | Extract, reorder, delete, permanent rotation and merge to a verified new copy | Reject forms, annotations, signatures, encryption and unsupported document structures; page-only metadata behavior is explicit |
| Certificate signing | Local P12/PFX review and invisible RSA/SHA-256 signature; independent byte-range/CMS and preservation checks | No trust-chain, revocation, trusted timestamp, visible-signature or existing-signature validation verdict |
| Offline | Cached reader/local PDF operation and live hosted Chromium offline recovery verified; optional OCR assets/recognition verified in the Windows browser suite | First asset retrieval requires network; browser eviction and other platforms need separate evidence; accounts require hosted service |
| Native/accessibility | Stable keyboard document tabs, panel/dialog/close focus restoration, named panel relationships, live page/unsaved status, enlarged-text/reflow and forced-colors support; Windows/macOS packaging | Automated and manual visual results are recorded in the accessibility audit; physical screen readers, arbitrary PDF reading order and WCAG conformance remain unverified |

The [original MVP trace](docs/requirements.md), [upgrade scope](docs/upgrade-scope.md) and [verification](docs/verification.md) separate implemented behavior from test evidence.

## Non-Negotiable Requirements

Never corrupt originals, silently discard modifications or bypass permissions/encryption. Prefer verified new copies and atomic local-storage transactions. Never claim printing, disk persistence, certificate trust, deployment or platform support without evidence. Keep core processing local. Do not copy Adobe/RevPDF proprietary code or assets. Keep shared document logic while adapting genuine platform differences.

## Known Limitations

Protective limits are not capacity guarantees: reader inputs are capped at 150 MiB with three open documents; a device library permits 500 records and 512 MiB combined stored PDF bytes per owner partition, subject to lower browser quotas; organization permits 50 MiB/500 source pages/10 files; OCR permits 50 pages with bounded raster/text output; signing permits 20 MiB and 200 pages, with a 1 MiB P12/PFX input cap.

Encrypted, signature-bearing, XFA and insufficiently permitted PDFs are conservatively read-only in the reader. Document tools impose their own stricter checks. Local PDF storage is unencrypted: account partitions are organizational separation, not protection from code or people accessing the same browser profile. OCR's older embedded native dependencies still require a patched reproducible rebuild before stable production support; constrained PNG input does not remediate those binaries. Browser storage clearing/eviction removes copies; unfinished strokes/editor drafts and recent edits before checkpoint completion are not guaranteed recoverable. Keep external backups.

The 200-account limit is a registration capacity rule, not a 200-concurrent-user load result. Account security depends on a trusted managed dispatcher stripping client-supplied identity headers. Do not expose the worker directly under a host that accepts spoofed identity headers. Certificate integrity verification is not signer identity, legal validity or trust. No complete PDF/UA, PDF/A, Safari, native or physical-mobile certification is established.

## Important Engineering Decisions

Keep editor cancellation reliable across browser engines: the controller retains active PDF.js composite abort signals until abort/destruction after a reproduced WebKit garbage-collection defect. A deterministic ink/export/reopen regression guards this behavior. Windows Edge and WebKit focused checks passed; source-matched macOS CI subsequently passed, as recorded above.

Keep one shared renderer and reader controller; add bounded specialist writers/workers only where PDF.js does not supply the operation. Preserve the reader's incremental editing path while rejecting organizer inputs whose semantics cannot be retained. Store device documents only by explicit consent; isolate account metadata from PDFs. Use a thin native wrapper until platform evidence justifies privileged adapters. Keep original-source licensing, dependency compliance, performance and verified-platform status explicit.

## Accessibility Pass — 2026-10-03

The shell keeps document tabs mounted during render/search updates. Inactive tab panels retain valid accessibility relationships while their PDF widget DOM stays detached. Navigation controls expose expanded/current state, modal dialogs and closed documents return focus, and phone navigation closes when focus enters the PDF. Controls reflow at 320 CSS pixels and 200% application text size; short windows scroll instead of losing the canvas. PDF-authored page geometry and form metrics are unchanged.

The pass adds 13 behavioral accessibility regressions and axe scans of 15 interface states to the existing Chromium/macOS WebKit CI suite. It is not a screen-reader or PDF/UA certification. See [accessibility evidence and manual gates](docs/accessibility-audit.md). Version 0.1.1 is published and its public assets are verified; the 0.1.0 tag and asset digests were checked unchanged.
