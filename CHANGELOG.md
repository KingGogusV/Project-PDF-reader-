# Changelog

## 2026-10-03

### Added

- Opt-in local PDF library with immutable originals, validated recovery checkpoints, SHA-256 checks, atomic writes and stale-tab conflict protection.
- Managed-identity account API and UI, database-enforced maximum of 200 registrations, guest operation and clearly labeled offline account hints.
- Experimental local English OCR with cancellation, text export and offline operation after initial model setup.
- Conservative extract/reorder/delete/rotate/merge to independently verified new PDF copies.
- Local P12 certificate inspection/signing with independent CMS verification, strict preservation checks and explicit trust/revocation limitations.
- Expanded synthetic embedded-font, transparency and cryptographic fixtures; independent Poppler rendering checks.
- Experimental Tauri wrapper, native dependency lock, Windows/macOS build workflows and macOS WebKit verification lane.
- Complete OCR native/runtime and LibPDF FontBox distribution notices with pinned provenance.

### Fixed

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
- macOS arm64 release compilation and app/DMG packaging succeeded; installation/runtime and notarization remain unverified.
- Remote signing harness navigation and Windows packaging failures are tracked with their corrective work in the verification record.
- New performance samples and hosted delivery status are recorded in docs/verification.md.

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
