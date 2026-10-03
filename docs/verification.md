# Verification record

Updated 2026-10-03 UTC. This is a development implementation, not a production-readiness or universal-platform certification.

## Current local evidence

Stable production build 2e61d5c66548dcdc was served at http://127.0.0.1:4173 on Windows. Source changes after this build are tracked separately through Git and CI.

| Check | Verified result |
| --- | --- |
| Strict TypeScript and production client/Worker build | Passed |
| Node unit/fixture tests | 55 passed, zero failures/skips; 5.85 seconds |
| Windows Edge reader/offline regressions | 24 passed; 35.4 seconds |
| Windows Edge local library | 14 shell + 9 IndexedDB cases passed; 29.4 seconds |
| Windows Edge OCR | 4 passed; 9.9 seconds, including offline-after-first-use |
| Windows Edge page organization | 8 passed; 18.3 seconds |
| Windows Edge signing UI | 3 passed; 5.9 seconds |
| Windows Edge checkpoint/core tests | 7 passed; 13.6 seconds |
| Windows Edge signing core | 9 passed; independent Node crypto checks |
| Accessibility | 9 production UI states: zero axe violations; four PDF-content contrast checks incomplete |
| Runtime npm audit | Zero known advisories returned for 44 runtime/optional dependencies; compiled WASM is not covered |

Together the E2E files contain62 tests; the separate core/signing suites contain16. Suite durations are execution times, not application performance. Windows Edge production audit version154.0.4258.53; Chrome measurement version153.0.8010.54.

## Verified workflows and safety

Reader checks exercise actual PDFs, selection/search/outlines, annotations/forms, original-byte preservation and fresh reopen, tabs/widget isolation, bad input/password/permissions, print-copy handoff and six responsive viewport classes. They check uncaught errors and external document requests.

Local library checks exercise explicit consent/refusal, reload recovery, exact immutable original download, clean/dirty checkpoint transitions, continuous-scrolling debounce, quota rollback, damaged-copy detection, stale-tab conflicts, namespace separation, encrypted-source/password preservation, offline/account-service outages and canceled signout. Account API tests used220 concurrent registration attempts: exactly200 accounts; repeated registrations reused the same account. This is not a200-concurrent-user load test.

Page operations verify every retained page's text, geometry and bounded rendered pixels before download; unsupported document structures are rejected. Signing tests verify real downloaded CMS/ByteRange with independent Node cryptography, preserve original bytes and form appearances, reopen signed output, reject wrong passwords/unsupported certificates and cancel workers. Certificate trust, revocation and trusted timestamps remain unverified.

OCR recognizes a real image-only fixture, exports text and cancels during model initialization. The offline test confirms no OCR preload, selected worker/core/model cached after use, complete offline reload/reselection, matching output and no PDF/blob CacheStorage entries. Device-library PDFs are separately stored in IndexedDB only with consent.

Fidelity checks embed static Latin/Greek/Cyrillic/CJK/Arabic fonts, verify meaningful Unicode/rendering, preserve unrelated transparency pages through mutation and compare output using independent Poppler. This is a synthetic corpus, not broad compatibility certification.

## Responsive, accessibility and physical boundaries

Desktop1600x1000, laptop1280x800, tablet1024x768/768x1024 and phone390x844/844x390 reader workflows passed. A discovered768px toolbar clipping defect was repaired and the affected regression passed. Phone organization/library dialogs were inspected.

The audit verifies accessible form-name fallbacks, valid tab semantics, contrast repairs, visible keyboard focus and focus restoration. [Audit details](accessibility-audit.md) record incomplete PDF contrast checks. Physical touch/stylus, screen-reader reading order, VoiceOver/TalkBack/NVDA and full WCAG conformance remain unverified.

Printing verification means a local PDF reaches browser viewer/download handling. No physical printer output, native driver fidelity or mobile print sheet was verified. A download event is not a filesystem durability guarantee.

## Performance

[Raw measurements](benchmark-2026-10-03.json): one run per configuration, Windows Chrome153, localhost, a synthetic200-page342,975-byte PDF. Phone is390x844 emulation with4x CPU throttling, not a physical device.

| Measurement | Desktop | Phone emulation |
| --- | ---: | ---: |
| Shell ready | 122ms | 287ms |
| First page, controller timing | 230ms | 493ms |
| Open workflow, including picker/test overhead | 417ms | 1080ms |
| Search to final-page match, including debounce | 449ms | 572ms |
| Live canvases at sample | 4 | 5 |
| Canvas pixels at sample | 7,222,996 | 791,000 |
| Reported JS heap at sample | 10,663,756B | 11,617,220B |

Heap samples exclude total browser/native/worker/canvas memory and are not peaks. Single-run values are not benchmark distributions. Initial JS is approximately75.8KB (24.6KB gzip); mandatory offline assets8.06MiB. OCR loads its worker, one selected core and English model on request. Large-byte scans, battery and physical low-memory devices remain unmeasured.

## Remote CI and native packaging

GitHub repository: KingGogusV/Project-PDF-reader-. Upgrade branch: feature/hosted-local-library; [PR1](https://github.com/KingGogusV/Project-PDF-reader-/pull/1). Initial upgrade commit33adba0d154c2504772fa8f6dc8f6b0604014e9d has a byte-identical verified local/remote source tree997d6ff62eb3463f7e272695f4f8d7eeacce1b61.

[Reader run37088665148](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37088665148):
- Linux Chromium job111104088127 succeeded: all62 E2E passed,55 unit/fixture checks, typecheck and build passed.
- Core job passed7 controller tests; first signing case was interrupted by development-harness navigation, with8 others passing. Investigation/retest pending; this run is not an overall pass.
- macOS WebKit job remains pending/in progress at this record update. Patched WebKit is not branded Safari.

[Native run37088665153](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37088665153):
- macOS arm64 release compilation and Folio.app/DMG packaging succeeded. [Artifact](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37088665153/artifacts/11261144589) retained14 days. Not notarized or runtime-tested.
- Windows failed at argument parsing before compilation; direct Node CLI forwarding is now the corrective change, awaiting retry.
- Native dependency lock/metadata artifacts were produced; source lock retention is being completed.

## Hosting and identity

The site is registered and its requested multi-account audience is public. Deployment and live managed-sign-in/database/anti-spoof checks are still pending at this record update. Local API simulations do not verify the hosted trust boundary. No live website/account-completion claim follows from frontend or mocked-identity tests.

## Security review and remaining gates

OCR's native inventory includes older zlib/libwebp affected by known advisories. Independent review traced Folio's only recognition input to a fresh browser-encoded PNG; production worker interception confirmed PNG IHDR/IDAT/IEND only, fixed same-origin model and bounded actions. The reviewed gzip-header/WebP paths were not found reachable through this interface. This supports constrained experimental OCR, not a patched-binary or production-security claim. A reproducible patched native rebuild and wider advisory review remain stable-release gates; see [OCR research](ocr-research.md).

Physical iOS/Android, Safari itself, native installation/runtime, signing/notarization, physical printing, comprehensive assistive technology, high-byte stress, XFA, broad pre-existing annotation preservation, certificate trust/revocation/timestamping and arbitrary content editing/redaction remain unverified or unimplemented. Browser eviction or a crash before a validated checkpoint can still lose recent work.
