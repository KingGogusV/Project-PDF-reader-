# Verification record

Updated 2026-10-03 UTC. This is a development implementation, not a production-readiness or universal-platform certification.

## Current local evidence

Earlier local audit/timing evidence used production build 2e61d5c66548dcdc at http://127.0.0.1:4173 on Windows. The final library regression rerun and successful CI/delivery revisions are recorded separately below.

| Check | Verified result |
| --- | --- |
| Strict TypeScript and production client/Worker build | Passed |
| Node unit/fixture tests | 55 passed, zero failures/skips; 5.85 seconds |
| Windows Edge reader/offline regressions | 24 passed; 35.4 seconds |
| Windows Edge local library | 14 shell + 9 IndexedDB cases passed; final rerun 27.5 seconds after ArrayBuffer compatibility repair, including legacy Blob reads |
| Windows Edge OCR | 4 passed; 9.9 seconds, including offline-after-first-use |
| Windows Edge page organization | 8 passed; 18.3 seconds |
| Windows Edge signing UI | 3 passed; 5.9 seconds |
| Windows Edge checkpoint/core tests | 7 passed; 13.6 seconds |
| Windows Edge signing core | 9 passed; independent Node crypto checks |
| Accessibility | 9 production UI states: zero axe violations; four PDF-content contrast checks incomplete |
| Runtime npm audit | Zero known advisories returned for 44 runtime/optional dependencies; compiled WASM is not covered |

The final-source complete E2E suite contains 63 tests, including the hosted-redirect regression. The separate core/signing suites contain 16. Suite durations are execution times, not application performance. Windows Edge production audit version154.0.4258.53; Chrome measurement version153.0.8010.54.

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

Heap samples exclude total browser/native/worker/canvas memory and are not peaks. Single-run values are not benchmark distributions. The earlier measured build had approximately 75.8 KB initial JS (24.6 KB gzip); v2 reports 75.88 KB (24.71 KB gzip). Mandatory offline assets were 8.06 MiB in the measured build. OCR loads its worker, one selected core and English model on request. Large-byte scans, battery and physical low-memory devices remain unmeasured.

## Remote CI and native packaging

GitHub repository: [KingGogusV/Project-PDF-reader-](https://github.com/KingGogusV/Project-PDF-reader-). Upgrade branch: `feature/hosted-local-library`; [PR 1](https://github.com/KingGogusV/Project-PDF-reader-/pull/1).

[Final-source Reader run 37091186897](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37091186897) **succeeded in all jobs** on application commit `710ff978c4f59b907bce108921ade34b6d2b5326`: 55 unit/fixture checks with zero skips, typecheck/build, 63 E2E cases on Linux Chromium (2.1 minutes), 63 E2E cases on macOS WebKit (4.3 minutes, no flaky marker), seven controller checkpoints (11.5 seconds) and nine signing-core cases (11.7 seconds). These are suite durations. Patched WebKit is not branded Safari or a physical Apple-device test.

[Final-source native run 37091186893](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37091186893) **succeeded on Windows and macOS**, producing unsigned NSIS and app/DMG packages with a retained Cargo lockfile. Compilation/packaging does not verify installation, native runtime, signing or notarization.

| Verified artifact | ZIP size | SHA-256 |
| --- | ---: | --- |
| [Windows NSIS package](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37091186893/artifacts/11262104539) | 13,946,200 bytes | `2a0e6bdc1b459d887e3e77886dba1600c311751ca83e7d2b57e585eea531fc6f` |
| [macOS app/DMG packages](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37091186893/artifacts/11261664576) | 29,792,212 bytes | `e47283997b450e6c32cf072f6911557dfa41fca53f00a5f63025f77d78ccbf38` |

These CI downloads expire **2026-10-17** and may require GitHub access. They are development artifacts, not permanent signed releases. Earlier runs 37088665148/37088665153 exposed signing-harness navigation, WebKit Blob storage and Windows CLI argument-forwarding failures; the final runs above verify their corrections.

## Hosting and identity

Current deployment **v2** `appgdep_6ac06d8fe58c819181427cd4cea78796` reached terminal success at **2026-10-03 02:51:08 UTC**. URL: [Folio](https://folio-local-pdf.gogoi-ronnie.chatgpt.site). App manifest: `b2837e77c6ac14a7`.

Published Site source `cae5f95b0255f6278c485c78da834adf606e6a60` and GitHub implementation `710ff978c4f59b907bce108921ade34b6d2b5326` have identical verified tree `09642b4ac086bf603510c5fc75fcf1aa14862650`. Their ancestry differs. GitHub remains authoritative. Preserve Site history on `site-publication`; align `feature/hosted-local-library` with the actual fetched GitHub HEAD by branch switching without resets/history rewriting. Future publishing must merge/reconcile Site and GitHub feature/main ancestry without force-pushing. Final documentation commits are separate from this delivered implementation snapshot.

At **02:51:18 UTC**, live v2 checks passed:

- Root/app and account dialog, including its sign-in button, loaded.
- Anonymous `GET /api/account` returned 200, null identity/account, limit 200 and registered 0.
- A POST with forged identity headers returned 401; managed sign-in redirected with 302 to `auth.openai.com`.
- A real local form was opened, explicitly stored, edited, reloaded online and recovered with its value intact.
- A 390-pixel phone viewport had no body overflow.
- With Chromium's actual browser-offline mode enabled, the hosted app reloaded and reopened the device-local form with its edited value preserved.
- No PDF uploads or application page exceptions were observed.

The live D1 accounts table was confirmed. Actual managed sign-in, account registration/sign-out sessions and live capacity/load were **not** exercised. A redirect to the provider is not a completed authenticated session.

### Offline correction and source-specific CI

Deployment v1 `appgdep_6ac06a440c048191bac16353afd60fa4` succeeded at 02:37:09 UTC, using Site `f7734929de58e05f280b536fbcd20b875a423221` and identical-tree GitHub `6033dbf3546b0eef776507bc50b14ee354ca6273`. Its online checks passed, but Chromium offline reload returned `net::ERR_FAILED`: the host canonicalized `/index.html` to the root and the cached response retained redirect state.

The worker now normalizes cached navigation responses. The added regression failed against the old worker, then the two direct/canonical offline cases passed on Edge and WebKit before v2 deployment. The live Chromium pass above verifies the actual hosted repair. WebKit's automated test uses an unavailable origin because its offline-emulation limitation differs; it is not a physical Safari test.

Final-source Reader run 37091186897 and native run 37091186893 both succeeded in all jobs, as detailed above.

Historical Reader run 37089902258 passed 62 cases before the added redirect regression; the primary artifact table now refers exclusively to the final-source packages. CI evidence attaches to the tested application commit, not a later documentation-only HEAD. Engineering-record updates do not require republishing unchanged application inputs and must not be described as a separately tested build.

### Hosting header boundary

Static responses bypass the worker's static-response header code. Restrictive document metadata CSP and `referrer=no-referrer` metadata are active in v2. HTTP CSP/frame-ancestors/nosniff and Referrer-Policy header enforcement were not established through the attempted static-header route; the experiment was reverted. Supported host-level header configuration remains a release task. CSP was not weakened to allow host-injected inline code.

## Security review and remaining gates

OCR's native inventory includes older zlib/libwebp affected by known advisories. Independent review traced Folio's only recognition input to a fresh browser-encoded PNG; production worker interception confirmed PNG IHDR/IDAT/IEND only, fixed same-origin model and bounded actions. The reviewed gzip-header/WebP paths were not found reachable through this interface. This supports constrained experimental OCR, not a patched-binary or production-security claim. A reproducible patched native rebuild and wider advisory review remain stable-release gates; see [OCR research](ocr-research.md).

Physical iOS/Android, Safari itself, native installation/runtime, signing/notarization, physical printing, comprehensive assistive technology, high-byte stress, XFA, broad pre-existing annotation preservation, certificate trust/revocation/timestamping and arbitrary content editing/redaction remain unverified or unimplemented. Browser eviction or a crash before a validated checkpoint can still lose recent work.
