# Folio - product record

Updated: **2026-10-07 UTC**. Folio is a functioning development application with verified browser workflows and substantial remaining release/platform gates. It is not certified production-ready. [Verification](docs/verification.md) records exact runs; results from the original reader do not automatically cover later features.

## Windows 0.1.2 delivery record — verified public and local preview

Final delivered application source is `ad8b2c169d707ff9616bf115b9c977c88c09cef9`; its relationship to the implementation and exact CI checkout is the PR #5 main merge, whose tree `3383d35496ed58ae79e7efb7a53faa8a5b5ef2ee` exactly matches successful PR merge `8878008e36ad57e0097eb055cf49c70d7487f0c8` (head `d13a4c6cf9270d814c90717494ac38a098f36901`). That head changes the fixture and its changelog record; application/build inputs remain unchanged from implementation `6a0c29e20644734e8eb63963aa7c968cad84037c`. Any later documentation-only commit is a separate identity and is not a newly tested or published application revision. The current worker-settlement implementation is `6a0c29e20644734e8eb63963aa7c968cad84037c`, with prepared PR test merge `ac15f31509cc391426b2a699eca59c4b379bfb3d`. Local checks of that implementation passed 116 unit/fixture tests and 28 focused production workflows each in Edge and Windows WebKit. Fresh main-source CI, publication and the actual normal-user installed run all passed; their exact source and scope are recorded below.

Previous implementation `9515daafd83b7c6d5f4b37605a969f561802f04f` / PR test merge `ce230d593d82943550078b32e68b564e5fc22dc7` retains its own 110 local unit/fixture and 101 production Edge results. The later WebKit fixture failures and worker-settlement correction are recorded in verification; those earlier results do not verify a later revision.

The macOS pre-cleanup cache-lifetime assumption in the `ac15f31509cc391426b2a699eca59c4b379bfb3d` Reader run prompted test-only correction `d13a4c6cf9270d814c90717494ac38a098f36901`. It measures the actual native-page baseline and worker outcome without changing application code or loosening the success/deadline contract. Its three affected real-worker cases passed in each local engine; corrected-source PR Reader 37684271113 and final main Reader 37686461277 subsequently passed.

| Delivery boundary | Recorded result / identity |
|---|---|
| Published unsigned x64 preview | [v0.1.2-preview.1](https://github.com/KingGogusV/Project-PDF-reader-/releases/tag/v0.1.2-preview.1); source `ad8b2c169d707ff9616bf115b9c977c88c09cef9`; publication run [37686535246](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37686535246) |
| Public installer and notices | 18,016,393 bytes; installer SHA-256 `1ed999a56b9c4fa5b4c95d25af743ed4903cc366345ce097244a4602eee2d799`; installed EXE SHA-256 `24565967b37b2023d6ab9d852672d18c31ce5519fd8149aa76b68c949c42531c`; all four public assets/provenance/checksums: All four anonymous downloads returned HTTP 200, matched the prepared bytes and passed checksum/provenance/tag identity validation. The notices archive verified all 554 files, 551 manifest-referenced hashes, 234 crates, 113 original license texts, 24 platform files and five MPL source archives. All eight older 0.1.0/0.1.1 assets were downloaded again and remained byte-identical; their IDs, timestamps, tag/source identities and hashes were unchanged |
| Source-matched Reader and package gates | [37686461277](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37686461277) passed on exact main source `ad8b2c169d707ff9616bf115b9c977c88c09cef9`; [37686461278](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37686461278) passed on exact main source `ad8b2c169d707ff9616bf115b9c977c88c09cef9` |
| Disposable-CI candidate upgrade | Published 0.1.1 → exact 0.1.2; 20 checks, genuine synthetic default profile, owned Start-menu shortcut and first-navigation interface/cache evidence: [37686535246](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37686535246) passed all 20 published 0.1.1 to built 0.1.2 default-profile candidate checks on exact main source `ad8b2c169d707ff9616bf115b9c977c88c09cef9` |
| Actual normal-user installed run | Fresh temporary installation and isolated synthetic profile; 17 checks/eight owned dialogs, 554 installed notice files, both job cleanups and guarded uninstall: Passed on non-elevated Windows 11 Pro build 22621 with PowerShell 7.6.5 and WebView2 154.0.4258.62: 17 actual installed checks, eight successful owned dialog interactions, all 554 installed notice files verified, zero page/console/external/unexpected-write errors, both owned jobs emptied and temporary policies removed. Guarded install and uninstall exited 0; final Folio processes/registrations/debug policies were absent, effective execution policy unchanged. This was a fresh task-owned temporary installation and isolated synthetic profile, not an upgrade of a real user's default library |

Machine-readable [delivery evidence](docs/windows-preview-3-verification.json) and [normal-user evidence](docs/windows-preview-3-normal-user-verification.json) retain the exact source, public bytes and cleanup boundaries.

The implemented desktop startup loads bundled assets on its first upgraded navigation. It captures only exact owned installing workers before/during unregister and waits for an explicit completed worker state before retiring `folio-app-*` static caches or importing the reader. A detached worker that never settles reaches the existing ten-second safe startup failure, with all listeners disposed and no later cleanup continuation. Unrelated workers/caches, stored originals, recovery PDFs, records and preferences are preserved. Browser offline support retains its existing worker. Native Save As still requires a confirmed disk receipt and never replaces an existing file.

The normal-user test above concerns a fresh owned temporary installation, not an upgrade of a real user's default library. The candidate default-profile test is on an elevated disposable CI account with synthetic PDFs. Existing 0.1.0/0.1.1 assets, the hosted website and any real library/installation preservation audit: Anonymous re-download verified all eight previous 0.1.0/0.1.1 assets plus unchanged IDs/timestamps/tag/source/hash metadata. The hosted website was not redeployed. Compared with PR #5's first parent, protected core PDF/mutation, device/account/storage, provenance-source and public browser assets are unchanged; package/Cargo manifest and lock changes are only Folio's own 0.1.1 to 0.1.2 version. No real default library or default installation was read or modified. After the local guarded uninstall, Folio processes/registrations/test policies were absent. Synthetic profiles, saved copies and diagnostic directories remain intentionally retained; no directory deletion retry occurred. Retained diagnostic directories are intentional; automatic approval review rejected their removal and no repeat deletion is authorized. Later engineering-only commits must not be described as independently tested or published application revisions.


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
| macOS | 102 WebKit workflows and 116 units passed on exact main source `ad8b2c1` in Reader 37686461277; unsigned ARM64 app/DMG built | Branded Safari, macOS native runtime/installation and notarization unverified |
| Linux | 102 Chromium workflows and 116 units passed on exact main source `ad8b2c1` in Reader 37686461277; seven core/nine signing cases passed | Interactive desktop and physical printing unverified; no Linux native package configured |
| iOS/iPadOS | Experimental browser target | Responsive/touch emulation is not physical-device, Safari or screen-reader verification |
| Android | Experimental browser target | Physical file pickers, memory, selection, printing and sharing unverified |

Tauri Windows NSIS and macOS app/DMG artifacts were built by verified remote CI and are linked in verification. The current Windows session also has Rust 1.99.0, MSVC 14.51.36231 and Windows SDK 10.0.26100.0; local compilation and linking now pass. Earlier missing-prerequisite results remain historical. These remain unsigned development packages, not trusted production releases.

## Historical Windows 0.1.1 preview delivery

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

Shared: document logic, rendering, search, supported annotations/forms, restrictions, checkpoint validation and local tools. Opening uses the WebView's HTML file input and operating-system chooser. Browser output retains downloads and explicit saved-copy acknowledgment. Published unsigned Windows 0.1.2 reader output uses a Rust-owned Save As dialog, bounded binary transfer, no-overwrite publication and a verified disk receipt before acknowledging the exported revision. Tool-specific outputs and printing retain their existing browser handoffs. Associations, update delivery and share sheets remain unimplemented.

## Feature Status

| Category | Implemented behavior | Remaining limits |
|---|---|---|
| Reader | Open, scroll/single-page, thumbnails, outlines, page/search navigation, zoom/fit, view rotation, properties, adaptive controls | Broader fidelity and physical-device verification |
| Review/forms | Text/freehand highlight, FreeText, ink; supported text, multiline, checkbox, dropdown and radio fields; editor undo/redo | No new sticky-note, underline or strikethrough tools; no PDF scripts/XFA |
| Output | Browser checked-copy download/explicit acknowledgment; published unsigned Windows 0.1.2 native reader Save As with verified disk receipt | Existing print/tool-specific browser handoffs remain; physical printing and tool-specific native output unverified |
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
