# Changelog

## 2026-10-07

### Native Save As development pass

- Added reader Save As through a Rust-owned OS dialog, bounded binary chunks, same-folder temporary staging, disk readback/hash checks and a verified receipt. Existing destinations are never replaced. Cancellation/write failure retains edits; browser download acknowledgment stays unchanged.
- Reserved picker/save/tab-close/application-close operations to prevent duplicate work and stale callbacks. Preserved the PDF controller, original-byte prefix validation, library schema and completed-checkpoint recovery.
- Added native adapter tests, 12 simulated native UI cases, 19 Rust safety tests and actual installed-dialog/multi-chunk checks to Windows CI. Native build jobs now require formatting and clippy on pinned Rust 1.99.0. Added only reviewed native dependencies; existing package versions remain unchanged.
- Final implementation `ce62ae1` passed all four fresh affected workflows: 84 unit tests, 88 workflows per browser engine, core/signing suites, Windows/macOS builds and Rust checks, 17 actual installed Windows checks with verified Save As/reopen, notice/binary/checksum/extraction gates and 20 published-upgrade checks. Independent retained-artifact verification passed; the follow-up PR remains open. Earlier native helper/CSP failures and local policy gaps remain documented.
- Public installers, release tags/assets and hosted deployment are unchanged. Current results and runtime limitations are recorded in [verification](docs/verification.md).

### Publication fix delivered

- Uploaded prepared commits `de1b19b` and `cdecc8e` without rewriting history, updated PR #3 and merged as `0d089ea` after fresh Reader, Windows/macOS package, installed-Windows and published-upgrade CI passed. Publication stayed skipped.
- Fresh local baseline passed 70 unit/fixture cases, eight extraction cases, type/syntax checks, production build and 79 Edge workflows. Actual Rust compilation/linking succeeded; prerelease-aware discovery confirmed existing MSVC and Windows SDK. Earlier access/prerequisite blockers are retained as historical evidence.

### Explicit Windows release publication

- Separated automatic installer verification from publication. Pull requests and matching main pushes retain their read-only installed-app/artifact checks; publication now requires an explicit main-branch manual dispatch with a full matching source SHA. Default manual runs verify only.
- Added an independent publisher policy and seven regression tests covering accidental triggers, malformed inputs, wrong branches/repositories, stale source confirmation and immutable-tag conflicts before network activity or writes.
- Added previously missing application/build-input paths to automatic installed-reader verification. Retained exact-source Reader checks, notices, binary/artifact/checksum validation and immutable assets. Application behavior and public release identities are unchanged.
- Reverified prepared commit `de1b19b`: 70 unit/fixture tests, eight extraction tests, type/syntax and static workflow checks passed. GitHub tree upload and PR-description update remain blocked by the session's `never` approval policy. Confirmed PR #3 remains open and remote main, release tags and asset metadata are unchanged; retained exact errors and local handoff evidence.

### Windows upgrade preservation

- Added pinned published-installer downloads, guarded installation, a synthetic recovery test and read-only GitHub verification workflow. Twenty upgrade/reopen/export/restart checks passed on disposable Windows Server 2025 CI.
- Corrected test document/export readiness races and separated durable upgrade state from pre-upgrade recent-file flush loss. Retained failures and independently checked downloaded PDF evidence.
- Local type checking, 63 unit tests with zero skips, production client/account-worker builds and 13 Edge accessibility/responsive cases passed. Inspected native annotation and 320-pixel screenshots.
- Updated engineering records. Application code, dependencies, hosted deployment and published assets are unchanged. Local native inspection remains restricted; normal-user Windows 11 upgrades remain unverified.
- PR-source CI also passed 79 browser cases each on Linux Chromium/macOS WebKit, seven core cases, nine signing cases, both native package builds and the installed Windows preview gate. PR publication was skipped.

## 2026-10-03

### Accessibility pass

- Kept document-tab buttons stable during renderer updates; separated Home/End tab navigation from PDF page shortcuts and retained named inactive panel wrappers without attaching inactive form widgets.
- Added focus restoration for document open/close, dialogs and navigation; exposed navigation expanded/current state and persistent page/unsaved announcements. Phone navigation closes before covering a focused PDF field, and phone actions expose help.
- Improved 320-pixel/short-window reflow, doubled-text zoom labels, application control/Properties contrast, focus indicators and forced-colors selected states. PDF-authored metrics remain unchanged.
- Added 13 accessibility behavior tests and a 15-state axe gate, plus retained screenshots for six standard viewport classes. Baseline defects and verification limits are recorded in the accessibility audit.
- Published Windows 0.1.1 after strict installed-reader and release-integrity gates; independently downloaded all four assets before updating direct download links. The 0.1.0 tag and asset digests remain unchanged.


### Accessibility cross-browser follow-up — 2026-10-03

- Fixed stale dialog return focus after macOS pointer activation by supplying the initiating control.
- Kept zoom/reading-mode selects native while enforcing readable, 44-pixel control boxes across engines.
- Added Safari keyboard navigation guidance and cross-platform pointer-focus regression assertions.
- Recorded the failing macOS CI evidence; passing Linux results alone are not treated as cross-platform verification.

- Windows release verification exposed an empty process-image path during startup. The native harness now waits within its existing bound for that metadata without weakening runtime identity or cleanup checks.

- Published the accessibility update as website v4 after 79-workflow Linux Chromium and macOS WebKit verification; retained 15-state audit summaries and explicit manual-testing limits.

### Published accessibility release

- [Windows preview v0.1.1-preview.1](https://github.com/KingGogusV/Project-PDF-reader-/releases/tag/v0.1.1-preview.1) is published from source `8b9f1683bf0c47b9c8b2da4d638168c4a1e3b00f`. All four public assets were downloaded without credentials and their sizes, SHA-256 values, provenance and tag identity verified at 2026-10-03T18:05:44.007570+00:00. The unsigned Windows x64 installer is 17,854,309 bytes. [Release CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37142162439) passed installation, 14 native workflows, exact-byte NSIS identity, cleanup, notices and publication. [Reader CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37142162437) passed 63 unit tests with zero skips, 79 E2E workflows each on Linux Chromium/macOS WebKit, seven checkpoint cases and nine signing cases. [Native builds](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37142162471) passed on Windows and macOS.
- Updated README, installation guidance, product/maintenance records and structured accessibility/release evidence; preserved earlier source-specific results.

### Earlier published preview

- [Windows preview v0.1.0-preview.1](https://github.com/KingGogusV/Project-PDF-reader-/releases/tag/v0.1.0-preview.1) is published from source `61adbfd1c9d582e1203606052c2443270f689366`. All four public assets were downloaded without credentials and their sizes, SHA-256 values, provenance and tag identity verified at 2026-10-03T12:15:32.087Z. The unsigned Windows x64 installer is 17,844,743 bytes. [Release CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37121666280) passed actual installation, 14 native checks, exact-byte NSIS identity, notice collection and publication. [Reader CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37121666271) passed 63 unit tests with zero skips, 66 E2E cases each on Linux Chromium/macOS WebKit, seven checkpoint cases and nine signing cases. [Native build CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37121666305) built both Windows and macOS packages.
- The exact public installer also passed all 14 native workflows in a normal local Windows session (12:16:20–12:16:31 UTC), including real OS-close cancellation/discard and process recovery; both owned process jobs emptied. Added sanitized evidence linked from verification.
- Added the direct Windows EXE link and installation/checksum guidance to README. Guest PDF reading/device storage requires no ChatGPT account; optional website accounts still use managed sign-in.
- Restored the local preview and verified live hosted guest recovery/offline reading. Physical-device, real sign-in-session and broader accessibility gaps remain explicit.

The earlier same-day investigation and failures below are retained for engineering history.

### Added

- Added a narrow native close handshake that reuses each document's save/discard flow, coalesces duplicate OS-close requests and displays the affected background tab. Added race/error unit tests, explicitly simulated browser UI tests, and real owned-window close assertions to the native release gate. Rebuilt native verification subsequently passed all 14 cases locally and in CI; see the evidence below.
- Added granular release identity/cleanup diagnostics after runtime passed but aggregate preparation validation failed.

- Added an explicit normal-user Windows installed-app test route and a same-account owned-job launcher. Twelve native checks passed, including actual PDF form/annotation downloads and recovery after full process termination. All 533 installed notice hashes passed.
- Updated release CI to use documented per-executable WebView2 debugging/profile overrides on its elevated disposable runner, with exact cleanup and unchanged application binaries. The revised runtime gate subsequently passed; release validation and public publication remain pending.
- Strengthened release preparation with installed/build EXE hash, source revision, native workflow and both process/policy cleanup checks.

- Implemented a planned `v0.1.0-preview.1` Windows x64 download pipeline: bundled notices, isolated runner installation, actual installed-WebView2 smoke, and main-only publication after exact-source Reader/artifact/tag validation. Notice generation, compilation and silent installation have passed in later runs; installed-reader workflows and publication remain pending.
- Added pinned `cargo-about 0.9.2` notice generation with original license texts, checked native archives, exact-version unchanged MPL source distribution and Rust/NSIS/WebView2 notices. Folio's own source remains UNLICENSED.
- Documented account-free guest PDF reading/device storage in the desktop preview; optional website accounts retain managed ChatGPT/OpenAI sign-in.
- Added a disposable GitHub-hosted Windows standard-user startup comparison with child-token identity checks, a private desktop/profile and exact-account cleanup. Runtime verification remains blocked after the bounded comparisons; the harness does not weaken the app sandbox or grant system privileges.

- Opt-in local PDF library with immutable originals, validated recovery checkpoints, SHA-256 checks, atomic writes and stale-tab conflict protection.
- Managed-identity account API and UI, database-enforced maximum of 200 registrations, guest operation and clearly labeled offline account hints.
- Experimental local English OCR with cancellation, text export and offline operation after initial model setup.
- Conservative extract/reorder/delete/rotate/merge to independently verified new PDF copies.
- Local P12 certificate inspection/signing with independent CMS verification, strict preservation checks and explicit trust/revocation limitations.
- Expanded synthetic embedded-font, transparency and cryptographic fixtures; independent Poppler rendering checks.
- Experimental Tauri wrapper, native dependency lock, Windows/macOS build workflows and macOS WebKit verification lane.
- Complete OCR native/runtime and LibPDF FontBox distribution notices with pinned provenance.

### Fixed

- Verified the native close correction with 14 installed-app checks locally and in CI; cancellation preserves edits and explicit discard closes cleanly.
- Traced the release identity failure to Tauri's exact three-byte NSIS bundle marker and added a strict full-byte comparator with version/ambiguity/tamper guards. Four focused tests passed; revised release CI is pending.

- The first Windows release run exposed cargo-about 0.9.2's opt-in CLI binary; installation now requests `--features cli`. The failed run stopped before packaging/publication and is retained as evidence.
- The subsequent run reached the installed CLI and exposed its PowerShell pipe guard. The collector now uses its UTF-8 output-file option and retains notice diagnostics; it does not suppress the guard or alter license policy.
- Release retries now find matching drafts through authenticated release listing; publication jobs are serialized and recheck tag identity before publishing. Existing mismatched source or asset bytes are never replaced.
- Added exact original-file clarifications after the first native license scan rejected generic fallback texts; retained dpi's combined license obligations and checked registry-archive bytes when Cargo omits per-file checksum metadata.
- Corrected Rust 1.99 notice locations and retained its referenced license collection. The Windows release job now pins that reviewed compiler. Full local collection passed, including an independent check of 533 generated-file hashes; installer/runtime verification remains separate.
- Retained PDF.js editor composite abort signals until abort/destruction after WebKit garbage collection left stale ink pointer listeners. The regression now requests collection mid-stroke and retains existing export/reopen and uncaught-error checks; no exceptions are suppressed.
- Corrected the native CI token inspector's unchecked four-byte read: initialized storage, explicit one/four-byte return handling and recorded diagnostics retain the nonrestricted-token requirement. Run 37100039753 failed preflight; local measurement confirmed only one byte is written and upper sentinel bytes remain unchanged. Corrected runner measurements now pass the standard-user gate; native runtime remains pending.
- WebKit IndexedDB rejected Blob-backed documents; portable ArrayBuffer writes now retain read compatibility with earlier Blob records, without resetting storage.
- Cold signing-test dependency discovery caused page navigation; an isolated preoptimized harness removes that interruption.
- WebKit automation's network-offline limitation is measured separately with a real isolated-origin outage; Chromium retains actual offline emulation.
- Persistent recovery scheduling during continuous reader updates, canceled-signout recovery ownership, account-outage fallback and optional-storage logout.
- Tablet toolbar overflow, contrast, PDF form accessible names, tab semantics and focus restoration.
- Native Windows CLI argument forwarding; separate CI verification records preserve the initial failure.

### Verification

- Source `20b1f48` passed Reader run 37118654848 and both native build jobs in 37118654865. Windows release run 37118654858 passed 12 actual runtime checks and cleanup, then failed preparation validation; publisher skipped.
- A separate real Windows OS-close test exposed silent loss of unsaved forms despite the earlier reader/recovery passes. The correction passed 59 local unit tests, typecheck/build, three shared-UI close cases and six responsive viewport cases; rebuilt native verification remains pending.

- [Reader run 37098740604](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37098740604) exposed the ink lifecycle defect: macOS WebKit 62 passed, one failed after export. Windows WebKit reproduced the exact failure before the fix (1/1); the patched forced-GC regression passed 3/3 and six focused editor cases passed on WebKit and Edge (6/6 each). Typecheck/build and all 55 unit cases passed with zero skips; the subsequent patched macOS CI pass is recorded below.
- [Windows run 37096782242](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37096782242) verified privilege reduction but exited before reader assertions. [Run 37097697001](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37097697001) captured WebView2 153 initialization error `RPC_E_DISCONNECTED` despite an honored debugging port and passing profile-write probe. These failures do not establish native reader or release success.
- [Fast diagnostic run 37100324020](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37100324020) measured one-byte zero restriction values on both parent and standard-user tokens; the full standard-user gate, unchanged-ACL profile-write probe and all five cleanup checks passed. Launch then stopped at `CreateProcessWithTokenW` error 87; subsequent plain-startup evidence follows.
- [Fast diagnostic run 37101691273](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37101691273) launched a genuine standard-user child with matching session IDs and passed token/profile/cleanup checks, but browser `ProcessSingleton` failure still stopped reader assertions. A random `Local\` mutex probe failed with access denied under target impersonation; this is observed CI-context evidence, not proof of the child failure's cause. The separate bounded `CreateProcessWithLogonW` comparison is recorded below; no shared namespace ACL or policy was relaxed.
- [Final bounded comparison 37102433709](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37102433709) also failed before CDP/reader assertions: genuine standard-user/session checks passed, but the child exited 101 with browser `ProcessSingleton` failure. All cleanup checks passed. The current hosted native-verification environment is a blocker; a normal interactive Windows session or suitable runner is needed. This does not prove normal Windows failure. Fast diagnostics are now manual-only with explicit artifact/digest/source inputs. No further launcher retry, native reader pass or published EXE is claimed.
- [Reader fix run 37102794616](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37102794616), source `85cc5de6378e64372549fb298d383374c74a488a`, passed all three jobs: typecheck/build/unit checks, 63 Linux Chromium cases (2.3 minutes), 63 macOS WebKit cases (3.0 minutes), seven controller cases (12.3 seconds) and nine signing cases (12.7 seconds). Durations describe test execution.
- [Native build 37102794636](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37102794636) passed both package targets. [Full-source Windows release 37102794622](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37102794622) passed preflight/notices/eight tests/build/install, but native startup exited 101 and its publisher was skipped. No Windows EXE release is available.
- Windows: 55 unit/fixture cases; 62 E2E cases across focused suites; 7 controller and 9 signing-core cases passed.
- Nine production accessibility states returned zero axe violations, with PDF-content contrast checks still incomplete.
- Linux Chromium: 55 unit/fixture and 62 E2E cases passed in the first upgrade CI lane.
- Initial-upgrade Reader CI run 37091186897 passed all jobs: 55 unit cases with zero skips, 63 E2E cases each on Linux Chromium/macOS WebKit, seven checkpoint and nine signing cases.
- Initial-upgrade native run 37091186893 built Windows NSIS and macOS app/DMG successfully; installation/runtime and signing/notarization remain unverified.
- Final Windows library rerun passed 23 cases in 27.5 seconds after portable ArrayBuffer writes, including legacy Blob read compatibility.
- Earlier signing-harness navigation, WebKit Blob storage and Windows CLI forwarding failures were fixed and verified by the successful final runs.
- New performance samples and hosted delivery status are recorded in docs/verification.md.

### Delivery

- Deployment v1 `appgdep_6ac06a440c048191bac16353afd60fa4` succeeded at https://folio-local-pdf.gogoi-ronnie.chatgpt.site on 2026-10-03 at 02:37:09 UTC; live D1 accounts table confirmed.
- Published Site commit `f7734929de58e05f280b536fbcd20b875a423221` and GitHub commit `6033dbf3546b0eef776507bc50b14ee354ca6273` have verified identical source trees with different ancestry. Preserve/reconcile both histories for future publishing; do not force-push.
- Hosted online form/local-storage/edit/reload recovery, anonymous API response, forged-header rejection, sign-in redirect and phone layout passed. Actual account sign-in remains unverified.
- Deployment v2 `appgdep_6ac06d8fe58c819181427cd4cea78796` succeeded at 02:51:08 UTC. At 02:51:18 UTC the full live online/account-boundary/phone smoke and true Chromium offline reload/local recovery passed, with zero PDF uploads or page exceptions.
- Canonical-redirect cache normalization repaired the v1 offline failure; the added regression failed with the old worker and passed with the fix in Edge and WebKit. Metadata no-referrer and an original account icon were added; restrictive metadata CSP remains unchanged.
- Site source `cae5f95b0255f6278c485c78da834adf606e6a60` and GitHub `710ff978c4f59b907bce108921ade34b6d2b5326` share tree `09642b4ac086bf603510c5fc75fcf1aa14862650`. The v2-source Reader CI passed, including Linux 63 cases in 2.1 minutes and macOS WebKit 63 in 4.3 minutes without a flaky marker. That source's Windows and macOS packaging both passed in native run 37091186893.
- Deployment v3 `appgdep_6ac0a0deb3108191a9fbce3e650d4019` succeeded at 06:30:01.366914 UTC with manifest `4336354ebff242c2`. Site `e3437ffb0d6e45b469f167845c009b2ee24f28e5` and GitHub reader fix `85cc5de6378e64372549fb298d383374c74a488a` share tree `8fcd7d07f26969320f361319b9d317930bd136f6`.
- Live v3 anonymous/guest, local recovery, offline and phone checks passed. Hosted Windows WebKit passed forced-GC ink export/reopen (1/1, 6.1 seconds test duration). Actual managed sign-in remains unverified. PR 1 remains unmerged; the Windows release remains blocked with no public EXE.
- Static-host HTTP CSP/frame-ancestors/nosniff/referrer-header enforcement remains a platform gap; metadata CSP and no-referrer are active. Actual managed account sign-in remains unverified.

### Known limitations

- Device storage is unencrypted and evictable; unfinished edits or writes before transaction completion can still be lost.
- OCR native dependencies retain advisory/update work; constrained PNG input is not proof that the bundle is patched.
- Physical iOS/Android, Safari itself, physical printing, comprehensive accessibility and broad real-world PDF fidelity remain verification gates.
- No certificate trust/revocation/timestamp verdict, visible signing placement, arbitrary existing-content editing or redaction.

## 2026-10-02

### Added

- Original adaptive Folio workspace: local picker/drop, three sessions, navigation, thumbnails/outlines, search, zoom/fit/view rotation, properties and keyboard controls.
- PDF.js-supported text/freehand highlights, FreeText, ink and AcroForm fields.
- Validated new-copy export and explicit saved-copy acknowledgment; browser print-copy handoff.
- Metadata-only recents and versioned offline app caching.
- Synthetic fixture generator, four-page demo, unit/fixture and browser workflows.
- Durable project records, dated research and 37-item requirements trace.
- Reader checks GitHub workflow; actual run results are in verification.

### Fixed

- Loading/close race that could remove an unrelated document.
- Modal ownership, stale tool/zoom state and missing safety notices.
- Reader scrolling, thumbnail lifetime and bounded rendering.
- Cross-document duplicate-widget/radio isolation and restored tab position.
- Pending-edit flush, immutable export snapshots and coordinated output.
- Read-only ResetForm interception, static CSP and browser-menu print handling.
- Offline shell/resource version consistency and cache hydration.

### Architecture

- TypeScript/Vite with one PDF.js 6.3.289 display/viewer/worker stack.
- Original-byte preservation plus incremental export and fresh-parser validation.
- No server, account, native package, OCR or cryptographic signature subsystem.
- Original source remains UNLICENSED; third-party notices retained.

### Repository

- Preserved repository purpose and initial commit 65059af146c826bcb317f55435894332710e6881.
- Documentation foundation: ff120621.
- Implementation milestone on GitHub main: 76af235.
- Offline/tab/print hardening on GitHub main: d2dbfa4.
- Read actual Git/verification records for final documentation commits, synchronization and CI outcomes.

### Testing and Platforms

- Final Windows checks: 23 unit/fixture cases, 24 Edge workflows and 5 focused Chrome cases passed. Typecheck and production build passed.
- Linux Chromium CI run 37082312401 on d2dbfa4 passed: 23 unit/fixture cases and 24 browser cases. The earlier CI failures in tab state, widget isolation and headless print expectations were fixed and rerun.
- Supported forms/annotations survived export/reopen and original-byte preservation checks.
- Chrome screenshots covered six viewport classes without reported page errors/body overflow.
- Chrome production cache reloaded offline and opened a local PDF; no cached PDF URLs.
- Single-run Chrome desktop/throttled-phone-emulation timings used a lightweight 200-page fixture; exact methodology/values in verification.
- Production audit reported zero advisories.
- Native/physical mobile, Safari/macOS and physical printing remain untested; interactive Linux desktop behavior beyond headless CI is unverified.

### Known Issues

Deferred tools include underline/strikethrough/sticky-note creation, signing, OCR and advanced editing. Broad font/document fidelity, real signed PDFs, large-byte scans and assistive technology need more evidence. No persistent unsaved-document recovery exists.
