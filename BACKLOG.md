# Backlog

Updated: **2026-10-07 UTC**. This is specific future work, not blanket authorization for unlimited expansion. Implemented recovery, account registration, OCR, safe page operations, certificate signing and the native wrapper are described in PROJECT/ARCHITECTURE; they are not listed as wholly unimplemented here. Exact current verification remains in [verification](docs/verification.md).

## Windows 0.1.2 evidence boundary

Final main/public source `ad8b2c169d707ff9616bf115b9c977c88c09cef9` is the PR #5 merge with the same tree as successful PR test merge `8878008e36ad57e0097eb055cf49c70d7487f0c8`. Application/build inputs remain those of worker-settlement implementation `6a0c29e20644734e8eb63963aa7c968cad84037c`; head `d13a4c6cf9270d814c90717494ac38a098f36901` changes its test fixture and changelog record. Later documentation-only commits are separate identities, not newly tested or published application revisions.

Main Reader [37686461277](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37686461277) passed 116 units and 102 workflows per Linux Chromium/macOS WebKit engine, plus seven core and nine signing cases, without failures/skips/retries. Package [37686461278](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37686461278) passed Rustfmt, locked Clippy, 19 Windows/17 macOS Rust tests and both package builds. Manual release [37686535246](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37686535246) passed 25 guards, nine ZIP cases, 19 Rust tests, 17 installed checks/eight dialogs and all 20 synthetic-default-profile candidate upgrade checks before publishing unsigned Windows x64 v0.1.2-preview.1. Candidate verification retained three confirmed saves, four cleanups and two upgraded first navigations with zero Folio workers/static caches.

All four anonymous public downloads matched prepared bytes and passed checksums/provenance/tag validation. Notices verified 554 files, 551 manifest hashes, 234 crates, 113 original license texts, 24 platform files and five MPL source archives. All eight prior 0.1.0/0.1.1 assets and their IDs/timestamps/source/tag/hash metadata remained unchanged.

The actual non-elevated Windows 11 Pro build 22621 run used PowerShell 7.6.5 and WebView2 154.0.4258.62. It passed 17 checks, eight owned dialogs and all 554 installed notice hashes, with zero page/console/external/unexpected-write errors. Both owned jobs emptied, temporary policies were removed, and guarded install/uninstall exited 0 with no remaining Folio process/registration/debug policy. Effective execution policy stayed unchanged. This was a fresh task-owned temporary installation and isolated synthetic profile; no real default library or default installation was read or modified.

Earlier `9515daafd83b7c6d5f4b37605a969f561802f04f` / `ce230d593d82943550078b32e68b564e5fc22dc7` and `ac15f31509cc391426b2a699eca59c4b379bfb3d` outcomes remain separate history. The latter macOS failure occurred before native cleanup because a fixture inferred cache lifetime from engine name. The corrected test measures the native-page baseline and actual worker state; preparation/preflight alone were never installed-runtime or publication passes.

Preserve the [delivery record](docs/windows-preview-3-verification.json) and [normal-user record](docs/windows-preview-3-normal-user-verification.json) with these source-bound results.

- Preserve the native first-navigation query, exact root-worker/static-cache retirement and explicit captured-worker completion before cache deletion or main import. Parsed/installing/unknown states remain pending; the ten-second deadline disposes updatefound/statechange listeners and fences late completions without touching user stores. Preserve unrelated workers/caches, close ownership before document interactions, safe empty startup failure close, and usable dirty-reader controls after a late fault.
- Keep the candidate 0.1.1 → 0.1.2 synthetic default-profile/Start-menu/byte-preservation gate separate from actual normal-user temporary-profile verification. Real existing user libraries, other Windows 11 configurations and storage/disk failures remain future work.
- Keep published-source/run/installer/installed-byte/notices evidence explicit: ad8b2c169d707ff9616bf115b9c977c88c09cef9, [37686535246](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37686535246), 1ed999a56b9c4fa5b4c95d25af743ed4903cc366345ce097244a4602eee2d799, 24565967b37b2023d6ab9d852672d18c31ce5519fd8149aa76b68c949c42531c. Retain historical failures and tests below; none automatically verifies a later source.


## Critical

- Preserve the completed development native Save As receipt/no-overwrite gates and the 150 MiB input / 256 MiB output bounds. Actual installed Windows verification passed 17 checks and eight owned OS-dialog interactions on exact source `ce62ae1` / tested merge `98e199c`; retain that source/run/artifact evidence and rerun after affected changes. Tool-specific native output, manual Open-dialog navigation, macOS runtime and termination/power-loss durability remain separate work. Published delivery and exact installer identity are source-qualified in the completed 0.1.2 record above; do not infer them from this earlier development pass.

- Preserve the now-passing Reader, native close, exact NSIS identity and published-release gates for future versions. Preserve their source/run/artifact provenance and rerun affected gates after consequential changes.
- Keep automatic Windows installer verification separate from explicit publication. PR/main test/documentation merges must not create releases; new previews require a reviewed version/tag and exact-source manual publication request. Retain the publication policy regression tests.
- Prepared publication fix `de1b19b` and record `cdecc8e` were delivered and merged through PR #3 as `0d089ea` after all four fresh affected CI workflows passed; publication was skipped. Preserve this explicit-source boundary in future native changes. See [delivery evidence](docs/verification.md#publication-fix-delivered---2026-10-07).
- Complete actual managed sign-in, registration and sign-out. Live anonymous responses, spoofed-header refusal and redirect to the identity provider passed; those checks do not establish a complete account session. Never expose the account worker behind a dispatcher that trusts client headers.
- The live D1 accounts table is confirmed. Verify real registration/capacity/outage behavior without disrupting existing accounts and document operational backup/recovery. Local SQLite/mock identity checks do not establish deployed account sessions or concurrent load.
- Preserve save/recovery regression gates: immutable input, pending editor/stroke handling, asynchronous snapshot races, explicit export acknowledgment, ResetForm restrictions, duplicate widgets/radios, per-tab position, quota failures and revision conflicts.
- Preserve the completed pinned LibPDF FontBox license/provenance and OCR/signing notices through builds and upgrades. Preserve the current Windows Cargo/platform notice gate verified against all 554 installed file hashes in 0.1.2; the earlier 533-file result belongs to the 0.1.0/0.1.1 milestone. Review other native platform inventories separately. Review embedded-native advisories, including the zlib version recorded in OCR research; an npm audit alone is insufficient.
- Keep unsupported signed/encrypted/restricted/form/annotation/document-structure cases fail-closed in each writer. Do not broaden supported documents by suppressing validation failures.

## High Priority

- Complete physical assistive-technology checks on the accessibility pass: NVDA/JAWS on Windows, VoiceOver in branded Safari/macOS and iOS, TalkBack on Android. Exercise tab switching, focus restoration, search announcements, forms, dialogs, local recovery and export. Retain the 13 shell regressions and all 15 axe states.
- Validate real browser zoom at 400%, OS font scaling, speech input and braille separately from the passed/recorded viewport and CSS text-scaling emulations. Audit tagged-PDF reading order and keyboard annotation creation without changing document integrity.


- Investigate intermittent macOS WebKit OCR cancellation/retry page termination observed in Reader run 37120364985: one page crash, automatic retry passed. Three focused Windows WebKit reruns passed. This does not establish the crash cause or a fix; OCR remains experimental.

- Preserve the deterministic mid-stroke garbage-collection regression for editor cancellation. The WebKit stale-listener fix passed focused Windows Edge/WebKit checks, source-matched macOS CI and hosted ink export/reopen. Retain instance-scoped signal cleanup on future PDF.js upgrades.

- Keep the repaired canonical-redirect cache path under regression coverage; the deployed website passed true Chromium offline reload/recovery. Retain the accessibility pass’s 79-case Chromium/macOS WebKit Reader CI and Windows/macOS packaging evidence; rerun affected gates after consequential changes.
- Obtain supported host-level HTTP CSP/frame-ancestors/nosniff/referrer-header enforcement. Metadata CSP and no-referrer metadata are active; do not weaken it for host-injected scripts or claim ineffective worker/static-header configuration protects live static responses.
- Exercise crash/forced-termination recovery around debounced checkpoints, incomplete strokes/text drafts, storage eviction, corrupt originals/latest copies, multiple browser tabs and account switching. Explain unrecoverable windows honestly; never silently overwrite a newer revision.
- Retain the completed zero-violation production shell audit and rerun after UI changes; complete manual keyboard, contrast and representative tagged-PDF checks. See [accessibility audit](docs/accessibility-audit.md); incomplete automated checks are not passes.
- Extend the now-passing macOS WebKit CI evidence to branded Safari and physical iPhone/iPad/Android workflows. Keep those results separate from Chromium and viewport emulation.
- Extend the passed published 0.1.0-to-0.1.1 synthetic-profile upgrade check to normal-user Windows 11 default profiles, older libraries, account partitions and storage/disk failures. Keep elevated CI evidence separate from physical-user verification.
- Investigate recent-file localStorage flush behavior after abrupt termination: one run lost its newest recent entry while completed PDF checkpoints survived. Do not promise pending-edit or preference recovery.
- Retain the built unsigned Windows/macOS artifacts and Cargo lockfile; retain the current 0.1.2 normal-user 17-check/eight-dialog smoke and 554 installed notice checks, preserve the earlier 533-file 0.1.0/0.1.1 evidence and published preview gates, then expand native printing, file-picker interaction and macOS WebView runtime. Installer compilation alone does not establish runtime correctness.
- Expand independent-reader rendering comparisons for every shipped mutation, including newly generated embedded/Unicode-font, transparency/image and mixed-box fixtures. Successful object/value checks do not prove full visual fidelity.
- Verify signing with independently generated certificate/document variants and external readers while preserving the explicit no-trust/no-revocation/no-timestamp boundary. Retain strict tamper, trailing-data, wrong-key, cancellation and preservation tests.
- Extend the now-passing Windows OCR offline asset/reload workflow to other supported engines and actual devices. Keep model-load cancellation/retry, version consistency, resource cleanup and absence of PDF/account caching under regression coverage.

## Medium Priority

- Measure sustained scrolling, time to first page, search, peak memory, cancellation and long OCR/organization jobs on high-byte scans and representative physical phones. Existing protective limits are not capacity guarantees.
- Review and, where evidence requires, lower per-tool memory/page/byte limits. Page organization currently retains writer/parser object graphs and does not run mutation in a dedicated worker.
- Expand OCR tests for crop/rotation, low-resolution/noisy scans and confidence/coordinate behavior; add languages only with model provenance, payload/memory budgets and real tests.
- Add individual organizer preservation capabilities only with explicit reference/semantic tests: outlines, links/annotations, forms, tagged reading order, metadata, layers and other currently refused structures. Do not merely drop them during copying.
- Broaden certificate/container interoperability deliberately, with algorithm/key-usage validity tests. Design visible signature placement separately from invisible certificate signing and handwritten marks.
- Test physical printers, browser PDF-viewer fallbacks and mobile print/share behavior. Provide clearer capability-specific output without claiming completed disk/print actions.
- Improve form appearances, international text and repeated-widget grouping while PDF scripting remains disabled.
- Add sticky-note, underline and strikethrough creation only with undo, safe serialization, reopen and visual verification.
- Define account deletion/admin support, abuse/rate controls and recovery policy if required for hosted operation. Avoid collecting unnecessary personal/document metadata.
- Evaluate optional encryption for device-stored PDFs only with a usable key/recovery design; current account partitions do not secure files from the same browser profile.

## Low Priority

- Refine discovery, empty/error states, long-document navigation and tool workflows using observed usage.
- Add themes/preferences after contrast and forced-colors review.
- Evaluate opt-in persistent file handles/native associations where supported without weakening safe-copy behavior or implying cross-platform equivalence.

## Platform Gaps

| Environment | Specific unfinished evidence/integration |
|---|---|
| Hosted web | Online guest recovery/API boundary passed and D1 table exists; actual account sessions, static security headers and concurrent-request measurement remain |
| Linux browser | Upgraded Chromium CI passed; interactive desktop, real printer and assistive-technology sessions remain |
| macOS browser | WebKit CI passed; branded Safari, VoiceOver and real macOS interaction remain |
| Windows native | Published unsigned x64 preview; reader/export/recovery/OS-close and release identity passed locally and in CI; signing, associations and broader lifecycle remain |
| macOS native | App/DMG build passed; installation/runtime, WKWebView/custom-origin workers, signing/notarization and lifecycle/recovery remain |
| Physical phone/tablet | Safari/Android file flows, memory pressure, selection/keyboard, OCR, stylus/palm, share/print, storage eviction and screen readers |
| Linux native | No native package target currently configured; evaluate only after browser/native evidence and product need |

## Research

- Review current engine advisories and maintenance before dependency updates/releases; test the pinned OCR worker protocol after any upgrade.
- Finish product-name clearance and choose an original-source license/distribution policy.
- Design certificate trust-store policy, chain building, explicit revocation/timestamp requests and privacy disclosures before any trusted-signature verdict.
- Assess searchable-PDF OCR export separately from recognition, with protected-file guards, text placement, selectable reading order and original preservation.
- Investigate PDF/A/PDF/UA validation and broader color/font/image interoperability with real independent validators.
- Establish a realistic 200-account workload model if capacity/performance commitments are needed; registration count is not a throughput result.
- Determine native platform adapter needs from measured runtime limitations before adding filesystem/shell privileges or duplicate document logic.

## Deferred

General existing-content editing/find-and-replace, true redaction, compression, comparison, broad document conversion/image export, PDF/A production, headers/footers/watermarks, automation workflows, collaborative cloud documents/AI, searchable OCR layer export, and cryptographic trust/revocation/timestamp validation remain outside the completed scope.

Advanced operations need a defensible engine/license choice, preserved originals, operation-specific verification and explicit platform status. A painted rectangle is not redaction; an ink mark is not a certificate signature; a mathematically valid signature is not a trusted identity.
