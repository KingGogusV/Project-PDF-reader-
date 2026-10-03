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

Together the E2E files contain 62 tests; the separate core/signing suites contain 16. Suite durations are execution times, not application performance. Windows Edge production audit version154.0.4258.53; Chrome measurement version153.0.8010.54.

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

GitHub repository: [KingGogusV/Project-PDF-reader-](https://github.com/KingGogusV/Project-PDF-reader-). Upgrade branch: `feature/hosted-local-library`; [PR 1](https://github.com/KingGogusV/Project-PDF-reader-/pull/1).

[Reader run 37089902258](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37089902258) **succeeded in all jobs**: 55 unit/fixture checks, typecheck/build, 62 E2E cases on Linux Chromium, 62 E2E cases on macOS WebKit, seven controller checkpoints and nine signing-core cases. Patched WebKit is not branded Safari or a physical Apple-device test.

[Native run 37089902268](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37089902268) **succeeded on Windows and macOS**, producing unsigned NSIS and app/DMG packages with a retained Cargo lockfile. Compilation/packaging does not verify installation, native runtime, signing or notarization.

| Verified artifact | ZIP size | SHA-256 |
| --- | ---: | --- |
| [Windows NSIS package](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37089902268/artifacts/11262491712) | 13,932,934 bytes | `e496ec3f543d4ca98e53a2fabcdaed9ce0ae10dec954dce0d4d5e34347b823e4` |
| [macOS app/DMG packages](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37089902268/artifacts/11262072022) | 29,791,928 bytes | `15c595ed8e2c8c1c42f4f5840d7961a23604ed41f66c8d8bd3f961459450bd85` |

These CI downloads expire **2026-10-17** and may require GitHub access. They are development artifacts, not permanent signed releases. Earlier runs 37088665148/37088665153 exposed signing-harness navigation, WebKit Blob storage and Windows CLI argument-forwarding failures; the final runs above verify their corrections.

## Hosting and identity

Deployment v1 `appgdep_6ac06a440c048191bac16353afd60fa4` reached terminal success at **2026-10-03 02:37:09 UTC**. URL: [Folio](https://folio-local-pdf.gogoi-ronnie.chatgpt.site).

The deployed Site source commit is `f7734929de58e05f280b536fbcd20b875a423221`; GitHub implementation commit `6033dbf3546b0eef776507bc50b14ee354ca6273` has a verified identical source tree. They have different ancestry. GitHub remains authoritative; future publishing must inspect and merge/reconcile histories, without force-pushing. This does not claim a final documentation commit has been created.

Live v1 checks passed:

- Root HTTP 200; anonymous `GET /api/account` returned null identity/account, limit 200, registered 0 and no-store.
- A POST with forged identity headers was rejected with 401.
- Managed sign-in returned a 302 redirect to `auth.openai.com`; an actual signed-in account/registration session was **not** exercised.
- Live D1 inspection confirmed the accounts table.
- A real local form was opened, explicitly stored, edited, reloaded and recovered with its value intact; no browser document uploads or page exceptions were observed.
- A 390-pixel phone viewport had no body overflow.

**Known hosted failure:** with an active service worker, Chromium offline `page.reload` returned `net::ERR_FAILED`. The deployed offline-navigation path is under investigation. Local offline reader/OCR tests passed, but do not override this hosted failure. No hosted-offline pass is claimed until a corrected deployment is independently retested.

**Hosting header gap:** static responses bypassed the worker's static-response headers. Document metadata CSP was confirmed, but HTTP CSP, frame-ancestors and Referrer-Policy were not enforced through the attempted static header route. The reverted experiment is not part of the delivered source. Supported host-level header configuration remains a release task.

## Security review and remaining gates

OCR's native inventory includes older zlib/libwebp affected by known advisories. Independent review traced Folio's only recognition input to a fresh browser-encoded PNG; production worker interception confirmed PNG IHDR/IDAT/IEND only, fixed same-origin model and bounded actions. The reviewed gzip-header/WebP paths were not found reachable through this interface. This supports constrained experimental OCR, not a patched-binary or production-security claim. A reproducible patched native rebuild and wider advisory review remain stable-release gates; see [OCR research](ocr-research.md).

Physical iOS/Android, Safari itself, native installation/runtime, signing/notarization, physical printing, comprehensive assistive technology, high-byte stress, XFA, broad pre-existing annotation preservation, certificate trust/revocation/timestamping and arbitrary content editing/redaction remain unverified or unimplemented. Browser eviction or a crash before a validated checkpoint can still lose recent work.
