# Hosted library upgrade

Requested 2026-10-02 America/Los_Angeles (2026-10-03 UTC). This record tracks outcomes, not completion promises.

| Request | Implementation / evidence target |
| --- | --- |
| Working website link | Persistent Sites deployment from this existing GitHub source; verify terminal deployment status |
| Accounts, maximum 200 | Managed ChatGPT identity, explicit Folio registration, atomic D1 allocation with database-enforced ceiling; test concurrent registration and existing users at capacity |
| Store PDFs locally | Explicit opt-in IndexedDB library per account/device; immutable original and validated revisions; no PDF upload route |
| Crash recovery | Commit checkpoints while editing; recover after reload/renderer termination; disclose unfinished-editor and storage-eviction limits |
| OCR | Local English worker/model; bounded pages, cancellation, permissions and real scanned fixture recognition |
| Advanced editing | Safe new-copy page extract/reorder/delete/rotate/merge; reject documents with features that cannot be preserved |
| Certificate signing | Local P12/private-key processing, certificate/key correspondence, independent CMS verification; no implied certificate trust or revocation verdict |
| Native installers | Shared web core in minimal Tauri wrapper; build artifacts through supported runners, distinguish built from runtime-verified |
| macOS/Safari and mobile | Expand WebKit/macOS CI where possible; physical devices cannot be simulated into verified hardware |
| Physical printing | Verify real browser handoff; physical printer output requires access to a printer |
| Accessibility | Automated audit plus keyboard/focus/zoom checks; no comprehensive screen-reader certification without direct evidence |
| Fidelity | Embedded fonts, unicode/image/transparency corpus and independent render/preservation checks |

Account metadata is server-backed; PDF bytes are explicitly device-local. Browser clearing/eviction can delete local documents. Signing in on another device does not synchronize files. Managed ChatGPT sign-in avoids a new password database. A cap on registered accounts is not a measured 200-concurrent-user service guarantee.

Native SDK inspection found no Rust, Windows build SDK, Android SDK/ADB or Xcode in this Windows environment. Remote CI may build additional targets; actual hardware, printer and trust-chain checks remain separate gates.
