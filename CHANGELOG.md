# Changelog

## 2026-10-03

### Added

- Implemented a planned `v0.1.0-preview.1` Windows x64 download pipeline: bundled notices, isolated runner installation, actual installed-WebView2 smoke, and main-only publication after exact-source Reader/artifact/tag validation. No execution or publication success is claimed for this new pipeline yet.
- Added pinned `cargo-about 0.9.2` notice generation with original license texts, checked native archives, exact-version unchanged MPL source distribution and Rust/NSIS/WebView2 notices. Folio's own source remains UNLICENSED.
- Documented account-free guest PDF reading/device storage in the desktop preview; optional website accounts retain managed ChatGPT/OpenAI sign-in.

- Opt-in local PDF library with immutable originals, validated recovery checkpoints, SHA-256 checks, atomic writes and stale-tab conflict protection.
- Managed-identity account API and UI, database-enforced maximum of 200 registrations, guest operation and clearly labeled offline account hints.
- Experimental local English OCR with cancellation, text export and offline operation after initial model setup.
- Conservative extract/reorder/delete/rotate/merge to independently verified new PDF copies.
- Local P12 certificate inspection/signing with independent CMS verification, strict preservation checks and explicit trust/revocation limitations.
- Expanded synthetic embedded-font, transparency and cryptographic fixtures; independent Poppler rendering checks.
- Experimental Tauri wrapper, native dependency lock, Windows/macOS build workflows and macOS WebKit verification lane.
- Complete OCR native/runtime and LibPDF FontBox distribution notices with pinned provenance.

### Fixed

- The first Windows release run exposed cargo-about 0.9.2's opt-in CLI binary; installation now requests `--features cli`. The failed run stopped before packaging/publication and is retained as evidence.
- The subsequent run reached the installed CLI and exposed its PowerShell pipe guard. The collector now uses its UTF-8 output-file option and retains notice diagnostics; it does not suppress the guard or alter license policy.
- WebKit IndexedDB rejected Blob-backed documents; portable ArrayBuffer writes now retain read compatibility with earlier Blob records, without resetting storage.
- Cold signing-test dependency discovery caused page navigation; an isolated preoptimized harness removes that interruption.
- WebKit automation's network-offline limitation is measured separately with a real isolated-origin outage; Chromium retains actual offline emulation.
- Persistent recovery scheduling during continuous reader updates, canceled-signout recovery ownership, account-outage fallback and optional-storage logout.
- Tablet toolbar overflow, contrast, PDF form accessible names, tab semantics and focus restoration.
- Native Windows CLI argument forwarding; separate CI verification records preserve the initial failure.

### Verification

- Windows: 55 unit/fixture cases; 62 E2E cases across focused suites; 7 controller and 9 signing-core cases passed.
- Nine production accessibility states returned zero axe violations, with PDF-content contrast checks still incomplete.
- Linux Chromium: 55 unit/fixture and 62 E2E cases passed in the first upgrade CI lane.
- Final-source Reader CI run 37091186897 passed all jobs: 55 unit cases with zero skips, 63 E2E cases each on Linux Chromium/macOS WebKit, seven checkpoint and nine signing cases.
- Final-source native run 37091186893 built Windows NSIS and macOS app/DMG successfully; installation/runtime and signing/notarization remain unverified.
- Final Windows library rerun passed 23 cases in 27.5 seconds after portable ArrayBuffer writes, including legacy Blob read compatibility.
- Earlier signing-harness navigation, WebKit Blob storage and Windows CLI forwarding failures were fixed and verified by the successful final runs.
- New performance samples and hosted delivery status are recorded in docs/verification.md.

### Delivery

- Deployment v1 `appgdep_6ac06a440c048191bac16353afd60fa4` succeeded at https://folio-local-pdf.gogoi-ronnie.chatgpt.site on 2026-10-03 at 02:37:09 UTC; live D1 accounts table confirmed.
- Published Site commit `f7734929de58e05f280b536fbcd20b875a423221` and GitHub commit `6033dbf3546b0eef776507bc50b14ee354ca6273` have verified identical source trees with different ancestry. Preserve/reconcile both histories for future publishing; do not force-push.
- Hosted online form/local-storage/edit/reload recovery, anonymous API response, forged-header rejection, sign-in redirect and phone layout passed. Actual account sign-in remains unverified.
- Deployment v2 `appgdep_6ac06d8fe58c819181427cd4cea78796` succeeded at 02:51:08 UTC. At 02:51:18 UTC the full live online/account-boundary/phone smoke and true Chromium offline reload/local recovery passed, with zero PDF uploads or page exceptions.
- Canonical-redirect cache normalization repaired the v1 offline failure; the added regression failed with the old worker and passed with the fix in Edge and WebKit. Metadata no-referrer and an original account icon were added; restrictive metadata CSP remains unchanged.
- Site source `cae5f95b0255f6278c485c78da834adf606e6a60` and GitHub `710ff978c4f59b907bce108921ade34b6d2b5326` share tree `09642b4ac086bf603510c5fc75fcf1aa14862650`. Final-source Reader CI passed, including Linux 63 cases in 2.1 minutes and macOS WebKit 63 in 4.3 minutes without a flaky marker. Final-source Windows and macOS packaging both passed in native run 37091186893.
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
