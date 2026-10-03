# Verification record

Updated 2026-10-03 UTC. This is a development implementation, not a production-readiness or universal-platform certification.

## Published Windows preview and final QA, 2026-10-03

[Windows preview v0.1.0-preview.1](https://github.com/KingGogusV/Project-PDF-reader-/releases/tag/v0.1.0-preview.1) is published from source `61adbfd1c9d582e1203606052c2443270f689366`. All four public assets were downloaded without credentials and their sizes, SHA-256 values, provenance and tag identity verified at 2026-10-03T12:15:32.087Z. The unsigned Windows x64 installer is 17,844,743 bytes. [Release CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37121666280) passed actual installation, 14 native checks, exact-byte NSIS identity, notice collection and publication. [Reader CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37121666271) passed 63 unit tests with zero skips, 66 E2E cases each on Linux Chromium/macOS WebKit, seven checkpoint cases and nine signing cases. [Native build CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37121666305) built both Windows and macOS packages.

Public download: [Folio-0.1.0-Windows-x64-Setup.exe](https://github.com/KingGogusV/Project-PDF-reader-/releases/download/v0.1.0-preview.1/Folio-0.1.0-Windows-x64-Setup.exe). Installer SHA-256: `ad33d489e9f317965b40fbc3ad473ddaa2883e503e8bd4c46e30c756414120ac`. The release is a development preview, not production certification. [Machine-readable public verification](windows-preview-1-verification.json) records every asset and hash. PR #1 was merged preserving its milestone commits; later documentation-only changes do not alter the released application.

The exact anonymously downloaded public installer was installed and passed all 14 native checks in a normal, non-elevated Windows build 22621 session at 12:16:20–12:16:31 UTC with WebView2 154.0.4258.53. This includes actual OS-close cancellation/discard, native PDF export/reopen and completed-checkpoint recovery after process termination. Both owned process jobs emptied; no local registry policy was changed. All 533 installed native notice hashes passed. Sanitized local evidence is included in the machine-readable record above. CI uses WebView2 153.0.4234.48. The final main browser runs had 66 passes each with no flaky marker; the earlier macOS OCR page crash remains recorded and is not considered resolved by subsequent passes.

Local preview at `http://127.0.0.1:4173/` returned HTTP 200 with its CSP header. Live website v3 guest storage/recovery, phone layout and genuine Chromium-offline reopening passed at 11:40:57 UTC. No document uploads or page exceptions were observed. No website republish was needed for the native-only close/release changes.

Performance boundaries: the current production build has 76.69 KB initial JavaScript (25.02 KB gzip), and 225 required offline assets total 8.07 MiB. The recovered one-page native synthetic form reported 147 ms to first page in the public-installer warm recovery run; this is not a cold-start distribution or physical-phone benchmark. Earlier measured large-page-count fixtures are retained below.

Remaining external verification: complete managed account sessions, branded Safari/macOS native runtime, physical iOS/Android, printers and comprehensive assistive technology. Device storage remains unencrypted and nonsynchronizing; 200 is a registration ceiling, not a concurrent-user result.

## Historical native close-safety correction, 2026-10-03

The close correction passed 14 actual installed Windows checks both in CI (run 37120364964, WebView2 153.0.4234.48) and a normal local session (WebView2 154.0.4258.53), including cancel-preservation and confirmed clean exit. The remaining release checksum mismatch was reproduced: Tauri patches only its three-byte NSIS marker and restores the unpatched build file. The strict comparator now verifies that exact transformation and every remaining byte; At that stage revised release validation and publication were pending; both subsequently passed as recorded at the top.

- Source `20b1f48e6a980a5b70cc3cfe41dad9828bb3e19a`: Reader run [37118654848](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37118654848) and both native build jobs [37118654865](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37118654865) passed.
- Release run [37118654858](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37118654858): native WebView2 153.0.4234.48 passed 12 checks at 11:15:42-11:15:54 UTC; prepare failed, publisher skipped. Both jobs emptied and exact test policy was removed. Evidence archive SHA-256 `9960786ae9012f2ae5bb0aa6758ed51dc0da5da3e8d14ecc6168d3a3c822dd2b`.
- Negative normal-user check at 11:11:33-11:11:37 UTC, source `85cc5de6378e64372549fb298d383374c74a488a`: real OS close exited zero without an unsaved-form prompt. Prior 12-check passes did not cover OS close.
- Local correction: typecheck and production build passed (manifest `6242986adc1c8c29`); 59 unit tests passed, zero skips, 6.08 seconds. All three shared-UI close tests passed in Edge (6.0 seconds), and all six responsive viewport classes passed (12.3 seconds). The first background-tab attempt requested close while the second PDF was still opening; the app correctly refused, and the test now waits for opening to finish. Rebuilt native verification subsequently passed all 14 cases locally and in CI; see the evidence below. Browser tests simulate only the native bridge and are not native close evidence.

## Historical normal-user Windows verification, 2026-10-03

Actual Windows 10.0.22621 x64 / WebView2 154.0.4258.53 verification on 2026-10-03 passed 12 native checks: startup, real rendering, storage refusal/consent, immutable originals, form recovery, search, form download/reopen, text annotation download/reopen, and recovery after full owned-process termination/relaunch. Both process jobs emptied; the normal-user route changed no registry policy. The tested installer came from artifact 11266978801, source `85cc5de6378e64372549fb298d383374c74a488a` (installer SHA-256 `48e755d2e3a9596981a11c0a914ae514455ec533e82eb0e8201e65e219da8c31`). All 533 installed notice hashes also passed.

At this earlier 12-check stage, public Windows publication was pending the later close-safety/release validation. The existing hosted custom-account failure does not reproduce in the normal Windows user session.

Initial expanded-test attempts exposed test-only path joining and plain-array parsing mistakes; neither was marked passed. Corrected full verification passed at 10:57:34–10:57:43 UTC, followed by a final launcher rerun. Evidence is summarized in [native-windows-2026-10-03.json](native-windows-2026-10-03.json). File selection was automated through the real HTML input; physical picker/printing and other devices are not established by this result.

## Historical verification: reader correction and Windows release gates

The corrected reader is now live in **deployment v3**. Its complete Linux Chromium
and macOS WebKit CI passed, and the hosted forced-GC Ink regression passed.
The previous custom-account CI runtime failed; subsequent normal-user Windows native checks passed. The later revised runtime gate passed; close-safety/release validation and public publication were still pending at this stage. Earlier results below remain
evidence for their stated source revisions; they are not erased by later passes.

### WebKit editor lifecycle correction

[Reader run 37098740604](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37098740604)
at PR head `6c0c5d999b615607d918eb6baad99b2950d8e887` exposed a real error in the
macOS WebKit job: **62 passed, one failed**, including a failed retry of the Ink
case. The exact uncaught exception was
`null is not an object (evaluating 'e.#n.isCancellable')`. A stale PDF.js pointer
listener threw when Export was pressed after switching to Select. Export/reopen
assertions still completed, but the strict exception assertion correctly failed
the workflow.

Local reproduction with Playwright 1.63.0 WebKit 26.6 build 2359 on Windows forced
garbage collection during a live stroke. The engine collected a composite
`AbortSignal.any()` needed to remove drawing listeners on abort. The controller
now retains only its own editor manager's live composite signals until abort or
document destruction. The regression adds `page.requestGC()` during the existing
Ink workflow and retains its exception, original-byte, PDF-annotation and fresh
reopen assertions; no exceptions are suppressed.

| Correction verification | Verified result |
| --- | --- |
| Forced-GC Ink regression against the unpatched production app | One failed with the exact CI exception |
| Same regression against the corrected production bundle | Three passed |
| Windows Edge editor workflows | Six passed; 12.5 seconds |
| Windows WebKit editor workflows | Six passed; 19.3 seconds |
| Typecheck and full production client/Worker build | Passed; manifest `4336354ebff242c2` |
| Unit/fixture tests on the local corrected source | 55 passed; zero skips |
| Corrected-source macOS WebKit CI | 63 passed; 3.0 minutes, run 37102794616 |
| Hosted v3 Windows WebKit forced-GC Ink regression | One passed; 6.1 seconds, with real PDF export/reopen |

The six browser cases cover forms, free text, text-highlight undo/redo, Ink under
GC, freehand highlight and canceled dirty close. They retain independent output
inspection, original-prefix preservation, reopen checks and zero external
requests/page exceptions. These scoped local checks preceded the full corrected-source
CI below. Deployment v3 now uses the same manifest `4336354ebff242c2`; none of
these tests certify physical Safari or Apple devices.

### Corrected-source CI and packaging

[Reader run 37102794616](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37102794616)
**passed all three jobs** for the v3 reader source. Typecheck, production build and
unit/fixture checks passed; Linux Chromium passed **63 E2E cases in 2.3 minutes**,
macOS WebKit passed **63 in 3.0 minutes**, controller checkpoints passed **7 in
12.3 seconds**, and signing-core checks passed **9 in 12.7 seconds**. These are
suite execution times, not document performance measurements. The previously
failing Ink workflow now forces GC during a live stroke and retains strict
exception/export/reopen checks.

[Native packaging run 37102794636](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37102794636)
**passed on both Windows and macOS** for the updated source. This establishes
compilation and unsigned package creation, not native PDF runtime correctness or
a public release. GitHub implementation `85cc5de6378e64372549fb298d383374c74a488a`
and its matching hosted source/tree are recorded in the hosting section below.
[PR 1](https://github.com/KingGogusV/Project-PDF-reader-/pull/1) was still open at this stage; its later merge is recorded above.

### Windows installation passed; native runtime failed

[Latest Windows release run 37102794622](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37102794622)
built a new installer from the corrected source. Standard-user preflight, native
notices, all **eight** extraction-boundary tests, installer build and silent
installation **passed**. The actual installed application then exited with code
**101**, so native runtime verification **failed** and publication was **skipped**.
This confirms that the current source was built and installed; it does not turn
the prior diagnostic failures into native passes. No public EXE/release had been published at that stage.

The earlier release/harness comparisons remain relevant diagnostic history:

[Windows release run 37101691271](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37101691271)
tested PR merge `a2b7697e7913ff7420a47a48defd54103932892e` (head
`145942bfd20675418741078d5e947629b92221cc` into
`6644d304f7a44124658672c82cd18a3d5c0dd947`). Its results are:

| Release gate | Verified result |
| --- | --- |
| Isolated standard-user preflight and cleanup | Passed |
| Native distribution notice generation | Passed |
| Release extraction boundary tests | Eight passed |
| Windows installer compilation/packaging | Passed |
| Silent installation into the disposable runner directory | Passed; installed executable and notices present |
| Actual installed WebView2 application smoke | Failed |
| Named release preparation and publication | Skipped; no usable public-release claim |

This establishes an actual CI installation, beyond the older packaging-only
evidence. It does not establish a working native PDF workflow or a successful
interactive installation on end-user machines. CI diagnostic installer artifacts
are not verified public releases.

[Fast diagnostic run 37101691273](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37101691273)
used the same harness merge and provenance-checked unchanged installer source
`3d122090cca651e007b0759be72a43be41ac1666`. Installation again passed; the runtime
diagnostic failed. Under target-account impersonation, creation of a newly
randomized `Local\` mutex returned access-denied error **5**. The observed
launcher/token/child session values were all **2**, the fresh test profile's full
ACL access and child standard-user token were verified, and exact job, account,
profile and private-desktop cleanup passed. These observations narrow the failure;
they do not establish its final cause or a working runtime. Genuine token evidence
also confirms `TokenHasRestrictions` returned length **1**, value **0**.

The final `CreateProcessWithLogonW` comparison,
[run 37102433709](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37102433709),
also **failed** with the same WebView2 `ProcessSingleton` startup failure before
CDP became available. Folio exited with code **101**. Its
[diagnostic artifact 11266003295](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37102433709/artifacts/11266003295)
was downloaded and independently hash-checked:
`d4d36f47f1b8258a6ea62a56b09d3176813121f0ad6720b207bc2e60b0a1fd6a` (archive SHA-256).

The actual suspended child passed every standard-user token gate: correct account,
non-elevated Medium integrity, Users enabled, no Administrators SID or token
restrictions, and session **2**. The target account owned `EBWebView` and had an
inherited FullControl rule. The random `Local\` mutex probe under helper
impersonation still returned **5**; that helper probe does not establish the
child's exact namespace behavior. All five cleanup results were true—owned job
empty, profile unloaded, profile deleted, account removed and private desktop
closed—with no cleanup errors.

Launcher retries in this hosted environment have ended. **Native runtime
verification is blocked here** and next requires a normal interactive Windows
session or another suitable test environment. These failures do not prove Folio
fails on ordinary Windows installations. The public Windows release remains
unpublished. Native PDF workflows and release gates still need actual passing
evidence. The latest release run above rebuilt and installed the corrected source
but still failed runtime startup. Corrected-source macOS browser CI has since
passed; that browser result is separate from this native blocker.

## Historical local evidence: upgrade and v2 delivery

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

The v2-source complete E2E suite contains 63 tests, including the hosted-redirect regression. The separate core/signing suites contain 16. Suite durations are execution times, not application performance. Windows Edge production audit version154.0.4258.53; Chrome measurement version153.0.8010.54.

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

## Historical remote CI and native packaging: v2 application source

GitHub repository: [KingGogusV/Project-PDF-reader-](https://github.com/KingGogusV/Project-PDF-reader-). At v2 delivery, the upgrade branch was `feature/hosted-local-library`; [PR 1](https://github.com/KingGogusV/Project-PDF-reader-/pull/1).

[V2-source Reader run 37091186897](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37091186897) **succeeded in all jobs** on application commit `710ff978c4f59b907bce108921ade34b6d2b5326`: 55 unit/fixture checks with zero skips, typecheck/build, 63 E2E cases on Linux Chromium (2.1 minutes), 63 E2E cases on macOS WebKit (4.3 minutes, no flaky marker), seven controller checkpoints (11.5 seconds) and nine signing-core cases (11.7 seconds). These are suite durations. Playwright WebKit is not branded Safari or a physical Apple-device test. This historical pass does not supersede the later GC failure or verify its correction.

[V2-source native run 37091186893](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37091186893) **succeeded on Windows and macOS**, producing unsigned NSIS and app/DMG packages with a retained Cargo lockfile. This run verified compilation/packaging, not installation, native runtime, signing or notarization. Later Windows installation evidence is recorded in the current addendum above.

| Verified artifact | ZIP size | SHA-256 |
| --- | ---: | --- |
| [Windows NSIS package](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37091186893/artifacts/11262104539) | 13,946,200 bytes | `2a0e6bdc1b459d887e3e77886dba1600c311751ca83e7d2b57e585eea531fc6f` |
| [macOS app/DMG packages](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37091186893/artifacts/11261664576) | 29,792,212 bytes | `e47283997b450e6c32cf072f6911557dfa41fca53f00a5f63025f77d78ccbf38` |

These CI downloads expire **2026-10-17** and may require GitHub access. They are development artifacts, not permanent signed releases. Earlier runs 37088665148/37088665153 exposed signing-harness navigation, WebKit Blob storage and Windows CLI argument-forwarding failures; the listed v2 runs verify those corrections.

## Hosting and identity

Current deployment **v3** `appgdep_6ac0a0deb3108191a9fbce3e650d4019` reached terminal
success at **2026-10-03 06:30:01.366914 UTC**. URL:
[Folio](https://folio-local-pdf.gogoi-ronnie.chatgpt.site). App manifest:
`4336354ebff242c2`.

Published Site source `e3437ffb0d6e45b469f167845c009b2ee24f28e5` and GitHub
implementation `85cc5de6378e64372549fb298d383374c74a488a` have identical verified
tree `8fcd7d07f26969320f361319b9d317930bd136f6`. GitHub remains authoritative;
the separate Site ancestry is preserved. Later documentation-only commits must
not be described as independently deployed or tested application revisions.

At **06:30:37.083 UTC**, the live v3 smoke report passed:

- Anonymous account GET returned **200**, null identity/account, limit **200** and registered **0**.
- Forged identity headers were refused with **401**; sign-in redirected with **302** to `auth.openai.com`.
- A local form was explicitly stored, edited, reloaded and recovered with its value intact.
- Chromium network-offline reload and reopening the device-local PDF passed.
- The 390-pixel phone viewport had no horizontal overflow; its screenshot was inspected and usable.
- Observed document workflows made no POST/document-upload requests and produced no page errors. The separate forged-header API probe was deliberately sent and refused.

Against this deployed v3 URL, Windows Playwright WebKit also passed the real
forced-GC Ink export/reopen regression: **one passed in 6.1 seconds**. An initial
test invocation could not locate the installed browser; setting
`PLAYWRIGHT_BROWSERS_PATH` to the existing `.cache/playwright` installation fixed
the test setup. That invocation did not exercise or demonstrate an application
failure. It remains a Windows WebKit test, not branded Safari or a physical Apple
device test.

Actual managed sign-in, account registration/sign-out sessions and live
capacity/load remain **unverified**. A provider redirect is not a completed
authenticated session. The hosted update contains the reader correction; it does
not publish or validate the Windows installer.

### Historical deployment v2

Deployment **v2** `appgdep_6ac06d8fe58c819181427cd4cea78796` reached terminal success at **2026-10-03 02:51:08 UTC** at the same URL. Its app manifest was `b2837e77c6ac14a7`.

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

V2-source Reader run 37091186897 and native run 37091186893 both succeeded in all jobs, as detailed above. Those results remain tied to the historical v2 identity; the current corrected deployment is v3.

Historical Reader run 37089902258 passed 62 cases before the added redirect regression; the primary artifact table refers exclusively to the v2-source packages. CI evidence attaches to the tested application commit, not a later documentation-only HEAD. Engineering-record updates do not require republishing unchanged application inputs and must not be described as a separately tested build.

### Hosting header boundary

Static responses bypass the worker's static-response header code. Restrictive document metadata CSP and `referrer=no-referrer` metadata were confirmed in v2; the v3 smoke confirms its restrictive metadata CSP remains present. HTTP CSP/frame-ancestors/nosniff and Referrer-Policy header enforcement remain unestablished; the unsuccessful static-header experiment was reverted. Supported host-level header configuration remains a release task. CSP was not weakened to allow host-injected inline code.

## Security review and remaining gates

OCR's native inventory includes older zlib/libwebp affected by known advisories. Independent review traced Folio's only recognition input to a fresh browser-encoded PNG; production worker interception confirmed PNG IHDR/IDAT/IEND only, fixed same-origin model and bounded actions. The reviewed gzip-header/WebP paths were not found reachable through this interface. This supports constrained experimental OCR, not a patched-binary or production-security claim. A reproducible patched native rebuild and wider advisory review remain stable-release gates; see [OCR research](ocr-research.md).

Physical iOS/Android, Safari itself, native PDF runtime workflows, macOS installation, signing/notarization, physical printing, comprehensive assistive technology, high-byte stress, XFA, broad pre-existing annotation preservation, certificate trust/revocation/timestamping and arbitrary content editing/redaction remain unverified or unimplemented. Windows silent installation passed on the disposable runner; that does not cover interactive installation or normal end-user devices. Browser eviction or a crash before a validated checkpoint can still lose recent work.

## Corrected native close and packaging identity - 2026-10-03

Application PR head `c720587726f486bbf431f1067ca353f2e2fd85f6` / merge source `9de673b3acf0a3f1f91989648246473f91e8875b` built on Windows and macOS in run [37120365003](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37120365003). Reader run [37120364985](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37120364985) passed: 59 unit cases with zero skips, 66 Linux Chromium E2E, seven checkpoint cases and nine signing cases. macOS WebKit had 65 first-attempt passes and one OCR cancellation/retry page crash that passed its automatic retry. The crash is retained as an unresolved experimental-OCR issue, not described as fixed. Three focused local Windows WebKit reruns passed (12.6 seconds).

Windows release run [37120364964](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37120364964) passed all 14 actual native checks, including OS-close cancel and confirmed clean exit, then failed only the raw build/installed hash comparison. The downloaded diagnostic installer (SHA-256 `12fd743a3511bf369fd2991d0ed99bc4457b5cdfd155c2de51eb6d336ed425d0`) was installed into the same task-owned temporary directory. All 14 normal-user WebView2 154 checks and 533 installed notice hashes passed. See [sanitized native evidence](native-windows-close-2026-10-03.json).

The installed EXE SHA-256 is `998a0595d8a8e8215e03e9c3307fd248c70f36becbbb14c553dc9b342265a355`. Reversing only the reviewed marker at byte 18469506 reproduces the independently logged build hash `afec79d8a54f795a5d817c41a3aa6c17cdcdb34cfcdc766384ee8a734314e982`. The new comparator checks all bytes and has four passing tests for identity, tampering, ambiguous markers, size and version rejection. Its revised CI prepare/publication result was pending at that point; final main-source validation and publication subsequently passed (see the current record above).

The live website was rechecked at 11:40:57 UTC: anonymous account API limit 200, forged identity refusal, managed sign-in redirect, guest local form recovery, phone layout and actual Chromium-offline reopen passed. No uploads/page exceptions were observed. Full signed-in account sessions remain unverified.

## Accessibility pass — local verification, 2026-10-03

2026-10-03 UTC, Linux, Google Chrome for Testing **153.0.8010.12**, Playwright 1.63.0. Frozen dependency installation, type checking, 63 unit/fixture tests (zero skips), production client/account-worker build, **79 browser workflows**, seven core/checkpoint cases, nine signing cases and eight release-extraction cases passed. After the final footer layout adjustment, all **19 affected accessibility/responsive cases** passed again. No retries or skips were needed for the final local browser suite.

All **15 axe states reported zero violations**. `color-contrast` remained incomplete in the welcome footer, PDF/text/canvas states, and some clipped/overlapping content reported in OCR, signing and phone-actions dialogs. These incomplete checks were retained, not suppressed or relabeled as passes. Application Properties labels improved from 3.60:1 to 6.36:1. Screenshot review covered desktop 1600 x 1000, laptop 1280 x 800, tablet 1024 x 768 and 768 x 1024, phone 390 x 844 and 844 x 390, 320 x 256 reflow, doubled text and forced colors.

The local production shell JavaScript is **79.62 kB / 25.90 kB gzip**, compared with the inspected baseline 76.69 kB / 25.02 kB gzip. This is a build-size measurement, not a device-speed benchmark. No new runtime dependency was added. GitHub/macOS/native results and publication must be checked separately against their actual source revisions.

The managed agent preview was unreachable from this environment. Actual production browser verification instead used the repository's existing Playwright web-server harness. This does not indicate a failure of the hosted site. Windows 0.1.1 release preparation preserves the 0.1.0 public release; publication and new native checks are not claimed here until their runs complete.

Final screenshot review also caught phone action buttons compressed into columns of broken words. Actions now wrap into readable rows; a minimum readable-width regression and the complete 13-case accessibility gate passed after that correction. OCR/signing dialog screenshots showed readable foreground content despite the automated overlap/incomplete reports; those reports remain available for assistive-technology review.

### Cross-platform accessibility gate

PR head `608bf0943627a3d8689ef63ed248f5ae57032eca` passed Reader CI [37140750050](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37140750050): 79 workflows on Linux Chromium and 79 on macOS WebKit, with no retries/skips in the downloaded macOS report. All 15 macOS axe states had zero violations. The artifact ZIP SHA-256 was verified before inspecting its 320-pixel, doubled-text phone and phone-actions screenshots. The native Windows/macOS package build [37140749981](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37140749981) also passed.

Windows release gate 37140749969 built and installed the app, then failed before reader tests because `Win32_Process.ExecutablePath` was empty during runtime metadata collection. Its retained launch report confirms owned-job and policy cleanup. The harness now waits for that metadata within its existing startup bound; it still requires the owned runtime path/version, isolated profile, debugging port and cleanup checks. No release was published by that failed run. Whether the empty field was a transient startup race remains an inference until the rerun.
