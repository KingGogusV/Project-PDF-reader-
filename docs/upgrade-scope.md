# Hosted library upgrade

Requested 2026-10-02 America/Los_Angeles (2026-10-03 UTC). Updated after deployment v2 at 2026-10-03 02:51:18 UTC. Exact runs, source identities and artifact links are in [verification](verification.md).

| Request | Implemented and verified outcome | Remaining boundary |
| --- | --- | --- |
| Working website link | [Folio](https://folio-local-pdf.gogoi-ronnie.chatgpt.site) deployment v2 succeeded; online and true Chromium offline local-form recovery passed | Actual managed sign-in remains unverified; static host HTTP header support remains incomplete |
| Accounts, maximum 200 | Account-only API and atomic database ceiling; live D1 table, anonymous response, forged-header 401 and managed sign-in redirect verified | Actual signed-in registration/session, live capacity and concurrent-user load not tested |
| Store PDFs locally | Opt-in original/latest library, hashes, transactions and conflict protection; Edge and macOS WebKit workflows passed; ArrayBuffer writes retain legacy Blob compatibility | Unencrypted device-profile storage; no file synchronization or eviction guarantee |
| Crash recovery | Validated checkpoints and reload recovery, including actual hosted offline reopening with edited value | Unfinished drafts, termination before commit and browser storage clearing can still lose work |
| OCR | Local English recognition, text download, cancellation, restrictions and primed offline assets verified | Experimental: patched reproducible native dependency rebuild remains a stable-release gate; no searchable-PDF output |
| Advanced editing | Extract/reorder/delete/permanent rotation/merge create independently checked new copies | Unsupported document structures are refused; no general content editor/redaction |
| Certificate signing | Local P12/RSA signing with independent CMS/ByteRange and preservation checks; downloaded signed output reopens | Invisible only; no certificate trust, revocation, trusted time or legal-identity verdict |
| Native installers | Unsigned Windows NSIS and macOS app/DMG artifacts built in run 37091186893 | Installation/runtime, signing/notarization and native integrations unverified; v2 packages verified; no installation/runtime claim |
| macOS/Safari and mobile | 63-case macOS WebKit and Linux Chromium runs passed; responsive/touch-emulated browser coverage | Branded Safari, physical iOS/iPadOS/Android and assistive technology unverified; actual branded Safari/physical-mobile checks remain |
| Physical printing | Browser PDF viewer/download handoff verified | No physical printer, native-driver or OS-share-sheet result |
| Accessibility | Nine production states had zero axe violations; semantics/labels/focus/contrast repaired | Incomplete PDF contrast/reading order and physical screen-reader checks remain |
| Fidelity | Embedded fonts/Unicode/images/transparency corpus and independent Poppler checks passed | Synthetic corpus is not universal compatibility or print/color certification |

Account metadata is server-backed; PDF bytes remain explicitly device-local. Signing in elsewhere does not synchronize documents. Managed ChatGPT sign-in avoids a new password database. The 200-account cap is not a measured 200-concurrent-user service guarantee.

V2 fixed a real hosted canonical-redirect cache failure; the regression failed on the old worker and passed on Edge/WebKit before deployment. Hosted Chromium offline reload then passed. Metadata CSP and no-referrer are active; HTTP CSP/frame-ancestors/nosniff/referrer-header enforcement still requires supported hosting configuration.

The inspected Windows machine lacks Rust/MSVC/Windows SDK, so native builds were performed on remote CI. Existing artifact availability does not imply successful installation or native runtime. Final-source Reader run 37091186897 and native run 37091186893 both succeeded in all jobs. Exact hashes, expiring package downloads and the tested application commit are in verification; later documentation-only commits are not a separate application CI result.
