# Research record

## Native Save As design - 2026-10-07

**FACT:** Tauri documents `TAURI_ENV_PLATFORM` for both [CLI hook commands](https://v2.tauri.app/reference/environment-variables/#tauri-cli-hook-commands) and the two local IPC sources `ipc:` / `http://ipc.localhost` in its [CSP guide](https://v2.tauri.app/security/csp/). The native configuration already allowed those sources, but the shared HTML metadata policy intersected it with `connect-src 'self'` and blocked actual Save As in installed run 37602092673. The native-only Vite transform aligns metadata/headers with the configured native policy; normal browser HTML/headers stay unchanged. Tests require exactly one reviewed metadata policy and refuse silent policy drift.

**FACT:** The official [Tauri dialog guide](https://v2.tauri.app/plugin/dialog/) supports Rust-owned OS save dialogs. [Pinned dialog 2.7.0](https://docs.rs/tauri-plugin-dialog/2.7.0/tauri_plugin_dialog/struct.FileDialogBuilder.html) supports a parent window and cancellation callback, and its [manifest](https://docs.rs/crate/tauri-plugin-dialog/2.7.0/source/Cargo.toml) is compatible with existing Tauri 2.12.1. The installed Tauri/API 2.12.1 sources document raw binary request bodies and invoke headers, permitting bounded chunks instead of JSON byte arrays.

**DESIGN DECISION:** Preserve existing OS-backed HTML PDF input and the shared controller's original-byte/output validation. Add narrowly allowlisted Rust Save As commands that retain the selected destination in Rust. Grant no JavaScript dialog or filesystem plugin permissions. Save only a new copy; reject existing files even after an OS overwrite prompt.

**FACT:** Microsoft's [CBN_EDITCHANGE](https://learn.microsoft.com/en-us/windows/win32/controls/cbn-editchange) and [WM_COMMAND](https://learn.microsoft.com/en-us/windows/win32/menurc/wm-command) document a ComboBox notification to its immediate parent, carrying the control ID, notification code and exact ComboBox HWND. [WM_SETTEXT](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-settext) documents displayed text changes without promising synchronization of a shell dialog's filename model. The pinned Windows dialog backend leaves the Save dialog's default overwrite prompt enabled.

**INFERENCE:** Installed run 37610271900 showed exact visible filename readback followed by a successful receipt for the default filename, so visible text alone did not update that shell dialog's selected filename. The test-only modern fallback needs the narrowly owned ComboBox change notification; its actual correctness requires a new installed run. Do not relax the existing-file assertion or infer an immediate refusal from a missing overwrite prompt.

**FACT:** Microsoft's [TDM_CLICK_BUTTON](https://learn.microsoft.com/en-us/windows/win32/controls/tdm-click-button) accepts a semantic button ID on the Task Dialog root; the handler result is ignored, and a callback can prevent closure. [TaskDialogIndirect](https://learn.microsoft.com/en-us/windows/win32/api/commctrl/nf-commctrl-taskdialogindirect) documents common Yes/No button results and an explicit parent window. An independent offscreen owned TaskDialogIndirect probe reproduced the observed two physical Button controls with ID zero: sending semantic IDYES 6 to its root produced callback/result 6 and destroyed the prompt, with foreground state preserved.

**DESIGN DECISION:** The test-only existing-file confirmation fallback must link the prompt to the exact prior synthetic Save dialog HWND, require that owner to be visible and disabled, and revalidate the sole enabled owned root and observed control structure. Never select an ID-zero child by name/order. Bound semantic message delivery and require prompt disappearance; all application refusal, original-byte and dirty-state assertions remain mandatory. Actual installed evidence remains separate from the owned probe.

**FACT:** [`NamedTempFile::persist_noclobber`](https://docs.rs/tempfile/3.27.0/tempfile/struct.NamedTempFile.html#method.persist_noclobber) preserves an existing destination. Its [Windows implementation](https://docs.rs/crate/tempfile/3.27.0/source/src/file/imp/windows.rs) uses a move without replacement. Explicit write/disk checks and flushing still matter; this API does not promise universal atomicity or power-loss durability. Abrupt termination may retain an unpublished temporary file. Actual implementation/test evidence is recorded in verification rather than inferred from documentation.

## Explicit release publication - 2026-10-07

**FACT:** GitHub documents typed `workflow_dispatch` inputs, with boolean values preserved in the `inputs` context and represented as strings in `github.event.inputs`. Branch/path filters control automatic runs. References: [workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [manual workflow runs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

**DESIGN DECISION:** Preserve automatic installer verification while requiring an explicit manual main publication request with a full matching source SHA. Independently enforce the event payload in the publisher before network access; check immutable tag conflicts before waiting for Reader checks/artifacts. Keep all existing source, native-runtime, notice and digest gates.

**UNRESOLVED:** A future new-version publication still needs coherent version/tag/allowlist updates and all release gates. This automation-only change does not publish or replace the current preview. The earlier access-blocked session was resolved by a subsequent session; PR #3 merged after fresh CI. See [verification](docs/verification.md).

## Windows installer upgrade - 2026-10-07

**FACT:** Anonymous downloads of the existing 0.1.0 and 0.1.1 installers matched recorded digests. [Run 37583640160](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37583640160) passed 20 upgrade/recovery checks with those exact executables. The evidence ZIP digest, before/after stores and actual exported PDFs were independently rechecked. Environment: elevated Windows Server 2025 CI, WebView2 153.0.4234.48, isolated guest profile.

**FACT:** Earlier run 37583139158 lost its newest recent-file localStorage entry after abrupt old-version termination; PDF stores matched. Another attempt applied storage before the requested tab was active. The first attempt timed out awaiting a third download; its exact cause was not independently isolated.

**DESIGN DECISION:** Confirm durable 0.1.0 state after restarting before upgrading; retain complete preservation checks and failed evidence. Wait for document identity and visible export confirmation. Add no application code or dependency for this verification.

**UNRESOLVED:** Default-profile normal-user upgrades, older libraries, account partitions, storage failure, pending edits and recent-metadata flush guarantees need separate tests. The local Work session denies CIM inspection despite working shell/build/browser execution. See [evidence](docs/windows-upgrade-verification-2026-10-07.json).

## Final delivery evidence - 2026-10-03

**FACT:** [Windows preview v0.1.0-preview.1](https://github.com/KingGogusV/Project-PDF-reader-/releases/tag/v0.1.0-preview.1) is published from source `61adbfd1c9d582e1203606052c2443270f689366`. All four public assets were downloaded without credentials and their sizes, SHA-256 values, provenance and tag identity verified at 2026-10-03T12:15:32.087Z. The unsigned Windows x64 installer is 17,844,743 bytes. [Release CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37121666280) passed actual installation, 14 native checks, exact-byte NSIS identity, notice collection and publication. [Reader CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37121666271) passed 63 unit tests with zero skips, 66 E2E cases each on Linux Chromium/macOS WebKit, seven checkpoint cases and nine signing cases. [Native build CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37121666305) built both Windows and macOS packages.

**DESIGN DECISION:** Preserve exact-version unsigned NSIS identity rules and immutable release tags. Native close handling now has actual runtime evidence. These results resolve the earlier startup, close and publication questions; physical devices, trust/signing, actual account sessions and intermittent experimental OCR investigation remain open.

Updated: **2026-10-03 UTC**. **FACT** records inspected code/artifacts or primary evidence; **DEVELOPER CLAIM** records upstream assertions; **INFERENCE** records an engineering assessment; **DESIGN DECISION** records Folio's choice; **UNRESOLVED** records remaining questions. Marketing figures and dependency capabilities are not Folio verification.

## Evidence Index

- [Product references](docs/reference-research.md): current Adobe Reader/paid Acrobat/cloud-AI matrix and desktop/web/mobile differences; three separately identified RevPDF references.
- [Engine and platform research](docs/engine-research.md): PDF standards; PDFium, PDF.js, MuPDF, Poppler, Qt PDF, PDFBox, PoDoFo and native options; browser, desktop and mobile architecture; printing/signatures/accessibility.
- [OCR research and provenance](docs/ocr-research.md), [OCR notices](third_party/ocr/README.md): worker/model/native licensing, local delivery, bounded recognition and evidence.
- [Page organization](docs/organize-research.md): pdf-lib capabilities/limitations, conservative eligibility and independent output checks.
- [Accessibility audit](docs/accessibility-audit.md): observed findings, repairs, manual gaps and WebKit/native verification boundaries.
- [Requirements](docs/requirements.md), [upgrade scope](docs/upgrade-scope.md), [architecture](ARCHITECTURE.md) and [verification](docs/verification.md): actual product contract and evidence.

Earlier research remains historical context. The current decisions below supersede initial plans to defer all OCR, organization, certificate signing, accounts and document recovery.

## Adobe Acrobat Reader

**FACT:** Authoritative Adobe sources in the reference report distinguish free reading, navigation, review, form completion and basic signing from paid content editing/OCR/redaction and subscription/cloud features. Desktop, browser and phone/tablet functionality differs; one product name is not evidence of feature parity.

**DESIGN DECISION:** Benchmark useful workflows and reliability, not Adobe branding, artwork, layout or proprietary implementation. Folio's current unsupported tools remain explicit.

## Adobe Acrobat / Acrobat Pro and Optional Services

**FACT:** Adobe's paid editing/conversion/OCR and optional cloud/AI/collaboration services have distinct capability and processing boundaries. Online tools and some mobile document transformations can require remote processing; the reference matrix preserves those distinctions.

**DESIGN DECISION:** No cloud PDF processor, AI upload, analytics of document contents or collaboration backend is introduced. Optional Folio accounts store identity/account metadata only. Account registration is not a prerequisite for local reading.

## RevPDF from revpdf.com

**DEVELOPER CLAIM:** revpdf.com describes local/offline processing, a Flutter/C++ implementation and performance/size advantages. Public architecture and product claims are recorded with dates in the reference report; Folio has not independently benchmarked its binaries.

**FACT:** Privacy/source/release inspection does not justify treating every product network request as absent or all platforms as equivalent. Refer to the separate privacy, update/font/model and mobile-ad findings rather than repeating an unqualified offline claim.

**DESIGN DECISION:** Apply the useful principle of local document processing without copying closed-source code or adopting unverified benchmark claims.

## Pawandeep-prog/revpdf-release

**FACT:** This is the public release/binary repository associated with revpdf.com, not an assumed reusable application source tree. Its inspected EULA is not an open-source grant.

**DESIGN DECISION:** No source, binary, asset or proprietary implementation from this repository is incorporated.

## bikash1376/revpdf

**FACT:** This separate project is associated with revpdf.in and has inspectable Expo/React Native, SQLite, WebView and PDF.js architecture. The reference report records exact inspected versions/license provenance. Its base64 document transfer, typed bridge and local highlight metadata do not prove PDF annotation export or platform parity.

**DESIGN DECISION:** Keep this evidence separate from revpdf.com. Reuse no project source; shared local-domain boundaries and responsive interaction are independently implemented.

## PDF Format, Standards and Reader Engine

**FACT:** [PDF.js getting started](https://mozilla.github.io/pdf.js/getting_started/) describes core/display/viewer layers. Its [license](https://github.com/mozilla/pdf.js/blob/master/LICENSE) is Apache-2.0. The installed, pinned reader is 6.3.289 with matched local assets.

**FACT:** [CVE-2024-4367](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq) affects older releases. The installed version lacks the historical `isEvalSupported` switch. Folio's actual boundaries are absence of a scripting manager, filtered actions, permission enforcement, local matched assets, CSP and worker isolation.

**DESIGN DECISION:** Retain one shared PDF.js rendering/search/reader stack and its supported incremental annotation/form saving. Separate original-byte retention, snapshot consistency, reopen verification and independent visual checks. No claim of universal PDF fidelity, PDF/A preservation or PDF/UA conformance follows from parsing successfully.

## Candidate Engines and Page Mutation Decision

**FACT:** The engine report evaluates licensing/platform tradeoffs for PDFium, MuPDF, Poppler, Qt PDF, PDFBox, PoDoFo and native frameworks. Public source visibility is not unrestricted reuse. Copyleft/commercial/native packaging obligations were considered before selecting permissive browser-capable components.

**FACT:** Installed pdf-lib **1.17.1** includes the MIT grant. Its [official API](https://pdf-lib.js.org/docs/api/classes/pdfdocument) supports page copying/serialization, while its [limitations](https://github.com/Hopding/pdf-lib#limitations) do not provide ordinary existing-text editing or encryption support. The old stable release is not evidence of active security maintenance.

**DESIGN DECISION:** Promote pdf-lib from fixture-only use to a bounded production page organizer. Reject document structures the page-copy contract cannot preserve. PDF.js independently checks all retained pages' text, geometry and bounded rendered pixels; output is a new copy with disclosed metadata omission. This does not replace the reader's incremental save path or support general destructive editing.

## Cross-Platform Frameworks and Web Architecture

**INFERENCE:** A browser-capable core and adaptive shared DOM UI minimize duplicate document stacks across browser and native-webview targets. Flutter/Qt/React Native require different integration/bridge work; Electron does not solve phone/browser distribution; PDFium/native engines add packaging/binding responsibilities.

**DESIGN DECISION:** Keep TypeScript/Vite/PDF.js and thin platform adapters. Lazy tool integration and self-hosted resources preserve local processing. Browser Web Crypto/worker/IndexedDB availability is checked at capability boundaries rather than assumed universally.

**FACT:** Account service and device persistence are separate implemented systems: `server/` stores account metadata; `src/platform/local-library.ts` stores original/latest PDFs locally. IndexedDB partitions are not encryption, cloud sync or authentication against another user of the same browser profile.

**DESIGN DECISION:** Use explicit local-storage consent, SHA-256 validation, transactional updates and revision-based conflict refusal. Keep the original copy separate and show failed/corrupt recovery honestly. A 200-slot database constraint enforces account registration capacity; it is not a concurrency benchmark.

**UNRESOLVED:** Hosted identity correctness depends on the managed dispatcher stripping client identity headers. Local mocked-header/unit results do not verify managed sign-in or live capacity. Deployment has now succeeded at [Folio](https://folio-local-pdf.gogoi-ronnie.chatgpt.site), and the live D1 accounts table is confirmed; online form recovery, anonymous account response, spoofed-header rejection and sign-in redirect passed. Actual account sign-in remains unverified.

**FACT - hosting observation:** On 2026-10-03, live static responses bypassed the worker's header code. Metadata CSP remained active, including blocking a host-injected inline script. HTTP CSP/frame-ancestors/nosniff and Referrer-Policy were not established by the attempted static-header configuration. [Cloudflare's static-asset headers documentation](https://developers.cloudflare.com/workers/static-assets/headers/) describes `_headers` behavior for its service; the managed Sites deployment did not honor the attempted route, so generic upstream behavior is not proof of this host's configuration.

**DESIGN DECISION:** Keep restrictive metadata CSP and the now-deployed metadata no-referrer fallback without enabling injected scripts. Resolve host-level headers through supported hosting configuration.

**FACT - corrected hosted behavior:** Initial offline reload failed when the cache held a redirected response for the canonical application URL. Normalizing cached navigation responses repaired it; the regression failed against the old worker and passed with the fix in Edge and WebKit. Deployment v2 succeeded at 2026-10-03 02:51:08 UTC, followed by live Chromium offline reload/local-form recovery at 02:51:18 UTC. This verifies that hosted path, not branded Safari or physical devices.

**FACT - current hosted delivery:** Deployment v3 `appgdep_6ac0a0deb3108191a9fbce3e650d4019` succeeded at **2026-10-03 06:30:01.366914 UTC**, with app manifest `4336354ebff242c2`. Site source `e3437ffb0d6e45b469f167845c009b2ee24f28e5` and GitHub reader fix `85cc5de6378e64372549fb298d383374c74a488a` share verified tree `8fcd7d07f26969320f361319b9d317930bd136f6`. Live anonymous/guest, local recovery, offline and phone checks passed. Hosted Windows WebKit also passed the forced-GC ink export/reopen regression (1/1, 6.1 seconds test duration). Actual managed sign-in, physical devices and native runtime remain separate unverified boundaries; [PR 1](https://github.com/KingGogusV/Project-PDF-reader-/pull/1) remains unmerged.

## Desktop and Mobile Architecture

**FACT:** Experimental Tauri source embeds the existing client. The [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) require platform toolchains. Inspected local Windows lacks Rust/cargo/MSVC/Windows SDK; no local native build is claimed. Existing WebView2 alone is insufficient.

**DESIGN DECISION:** Start with zero custom native commands or privileged plugin permissions. Configure Windows NSIS and macOS app/DMG targets while retaining one document UI/core. Native association/atomic-save/updater/share integrations await actual product and platform evidence.

**FACT:** [Playwright's WebKit documentation](https://playwright.dev/docs/browsers#webkit) distinguishes its patched WebKit from branded Safari. The upgraded CI now passed 63 E2E cases on macOS WebKit and 63 on Linux Chromium; the separate native run built Windows NSIS and macOS app/DMG successfully. Physical iOS/iPadOS/Android, Safari and native WebView2/WKWebView workflows still require independent verification.

## OCR Options and Decision

**FACT:** [Tesseract.js](https://github.com/naptha/tesseract.js) consumes images, not PDF files. Pinned wrapper/core 7.0.0 and English model delivery are documented in the OCR report. Wrapper/core/Tesseract/model licenses include Apache-2.0; the model npm packaging MIT label does not replace the model's upstream Apache license. Embedded native codecs/runtime notices and hashed provenance are preserved separately.

**DESIGN DECISION:** Render permitted base pages locally through PDF.js, recognize sequentially in one cancellable worker and offer plain-text output. Do not alter original PDFs or claim a searchable layer. Use self-hosted worker/core/model URLs; disable separate engine model caching and use versioned optional app-asset caching.

**FACT:** The worker adapter uses an inspected internal protocol because the public factory did not provide early ownership during initialization. This is a pinned integration boundary requiring upgrade tests, not a claimed stable public API.

**FACT:** Optional OCR asset caching and recognition after offline reload have now passed the Windows browser workflow checks, in addition to recognition/cancellation/permission coverage. The exact final run is recorded in verification; this is not a physical-mobile or Safari claim.

**UNRESOLVED:** Physical mobile memory, multilingual/handwriting/layout quality, other browsers' offline behavior and embedded-native vulnerability review remain release tasks. Package audits alone do not cover WASM's compiled native dependencies; the OCR report specifically flags the pinned zlib source version for review.

## Digital-Signature Options and Decision

**FACT:** Installed **@libpdf/core 0.5.1** has a top-level MIT license. The [upstream repository](https://github.com/LibPDF-js/core) documents browser/Web Crypto support, incremental writing and P12 signing, identifies the project as beta, and does not supply its own signature verifier. These are upstream capability statements; Folio uses a narrower tested path.

**FACT:** The same upstream README identifies `src/fontbox/` as Apache-2.0 derived from Apache PDFBox, and the installed bundle contains fontbox modules. Therefore a top-level MIT notice alone is not a complete distribution-license inventory. The exact `v0.5.1` upstream FontBox license and provenance README are now preserved unmodified under [third_party/signing](third_party/signing/README.md); both recorded SHA-256 hashes were independently recomputed and matched. The license includes inherited attribution/BSD/font notices. Asset generation copies these alongside the top-level MIT and other package notices into the distribution. Keep this complete set on upgrades rather than reverting to an MIT-only label.

**FACT:** Installed **PKI.js 3.4.1** and **ASN.1.js 3.0.10** have three-clause BSD notices. [PKI.js](https://github.com/PeculiarVentures/PKI.js) supplies CMS/X.509 primitives; it is not an operating-system trust-store policy or general PDF preservation engine. The OCR report records alternatives such as @signpdf and why fragile string-placeholder paths were rejected.

**DESIGN DECISION:** Implement an explicit local P12/PFX inspection and confirmation flow, an invisible RSA/SHA-256 incremental signature and independent strict CMS/byte-range/preservation checks. Reject unsupported/protected/already-signed documents. Keep imported P12/password material only in transient UI and short-lived worker memory until completion/cancellation; never persist credentials, fetch certificate chains or silently contact TSA/OCSP endpoints.

**VERIFICATION BOUNDARY:** Cryptographic integrity checks and independent test signatures do not establish trusted identity, revocation status, trusted time, legal validity, arbitrary-existing-signature validation or PAdES conformance. Those capabilities remain unimplemented. JavaScript cannot guarantee physical erasure of every secret copy.

## Printing and Accessibility

**DESIGN DECISION:** Browser printing hands a verified local copy to the native viewer or download route. Native/physical output needs separate verification; a print popup or PDF download is not proof that paper was produced.

**FACT:** [Playwright's accessibility guide](https://playwright.dev/docs/accessibility-testing) recommends automated and manual assessment. Axe is a test-only MPL-2.0 dependency. The audit records actual contrast/semantics/label/focus findings and partial repairs; automated zero findings, where achieved, are not a conformance or screen-reader verdict.

**UNRESOLVED:** PDF reading order, incomplete canvas/text contrast checks, tagged-document handling, NVDA/JAWS/VoiceOver/TalkBack, browser/OS scaling and physical stylus/touch remain separate checks.

## WebKit Editor Signal Lifetime (2026-10-03)

**FACT - observed failure:** [Reader CI run 37098740604, macOS job 111133904673](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37098740604/job/111133904673) passed 62 cases and failed one ink workflow on `TypeError: null is not an object (evaluating 'e.#n.isCancellable')`. The PDF export itself succeeded; a stale pointer listener threw afterward. With PDF.js 6.3.289 and Playwright 1.63.0/WebKit 26.6 (build 2359) on Windows, requesting garbage collection immediately after pointer-down reproduced that exact exception. The unpatched production regression failed 1/1; the same workflow without forced collection had passed 10/10, so those earlier passes did not establish listener-lifetime safety.

**FACT - cause and contract:** PDF.js's drawing cleanup aborts its controller, but WebKit collected the dependent `AbortSignal.any()` signal before abort removed the window pointer listener. Switching to Select cleared the current drawing; the next Export pointer-down reached that stale listener and dereferenced it. The independent plain-EventTarget reproduction left 100/100 listeners active after collection/abort without a strong signal reference, versus 0/100 when retained. The [DOM signal garbage-collection contract](https://dom.spec.whatwg.org/#abortsignal-garbage-collection) requires dependent signals with live sources and registered abort handling to remain alive. [Playwright requestGC](https://playwright.dev/docs/api/class-page#page-request-gc) requests collection; it does not guarantee collection of every unreachable object.

**DESIGN DECISION AND VERIFICATION:** [The document controller](src/core/document-controller.ts) now retains each PDF.js editor manager's active combined signals until normal abort or controller destruction. [The ink regression](tests/e2e/workflows.spec.ts) requests collection during the stroke while preserving export/reopen, original-byte and uncaught-error assertions. The fixed regression passed 3/3, and six focused editor workflows passed on Windows WebKit and installed Edge (6/6 each). Typecheck and an isolated production build passed. No dependency patch, global API replacement or exception suppression was introduced. The patched [Reader run 37102794616](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37102794616) on `85cc5de6378e64372549fb298d383374c74a488a` passed all three jobs: typecheck/build/unit checks, 63 Linux Chromium cases (2.3 minutes), 63 macOS WebKit cases (3.0 minutes), seven controller cases (12.3 seconds) and nine signing cases (12.7 seconds). The v3 hosted regression passed as recorded above. These are test durations, not application benchmarks, and patched WebKit is not branded Safari or a physical Apple-device test.

## Windows Release Inventory and Gates (2026-10-03)

Primary references: [cargo-about generation](https://embarkstudios.github.io/cargo-about/cli/generate/index.html), [Tauri bundled resources](https://v2.tauri.app/develop/resources/), [Playwright WebView2 testing](https://playwright.dev/docs/webview2), [Mozilla MPL 2.0](https://www.mozilla.org/MPL/2.0/), and [GitHub release download links](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases). Exact component URLs/hashes are retained in the collectors and generated manifest.

**FACT - runtime test boundary:** [Windows run 37095044448](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37095044448) passed notice generation, extraction tests, compilation and silent installation, then timed out connecting to CDP before any app workflow assertions ran. Microsoft documents that Runtime 150 ignores WebView2 environment settings in elevated hosts ([maintainer explanation](https://github.com/MicrosoftEdge/WebView2Feedback/issues/5640#issuecomment-4923662109)); [GitHub Windows runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) use administrators with UAC disabled. **INFERENCE:** elevation is the likely cause, not yet a measured pass/fail diagnosis of PDF functionality. Test the installed app with an explicitly verified non-elevated token rather than disabling security restrictions, downgrading the runtime or changing application permissions. Preserve startup diagnostics and leave publication blocked until the actual workflow passes.

**FACT - inspected implementation:** `scripts/native-notices.mjs` invokes pinned `cargo-about 0.9.2` for the locked `x86_64-pc-windows-msvc` graph, includes build dependencies conservatively, requires original license text rather than SPDX fallback text, and checks original crate archives/notices against Cargo checksums. `scripts/native-licenses.toml` selects reviewed permissive alternatives; it is not a blanket allowlist for every dependency.

**FACT - subsequent runtime diagnosis:** [Run 37096782242](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37096782242) verified the actual child as the same user, non-elevated, Medium integrity (8192), with Administrators disabled/deny-only. The application then exited with code 101 before CDP or document assertions. This establishes successful privilege reduction, not a native reader pass. The next harness records Rust startup output through an explicit two-handle inheritance allowlist and captures early owned-process snapshots; no application permissions or system policies change.

**FACT - captured startup error:** [Run 37097697001](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37097697001) captured WebView2 153.0.4234.48 failing initialization with `RPC_E_DISCONNECTED` (`0x80010108`). Its process honored the requested debugging port and used `<profile>/EBWebView`. The restricted-token write probe passed without changing the profile ACL. [Microsoft's restricted-token issue](https://github.com/MicrosoftEdge/WebView2Feedback/issues/4850#issuecomment-2412609705) describes a related WebView2/Chromium sandbox limitation; that report uses restricting SIDs, so it is relevant evidence, not proof of this failure's exact cause. Bounded browser logs and a separate read-only cached-installer diagnostic workflow now isolate startup failures without treating a reused artifact as a new release build. Publication remains gated on the full source-matched workflow.

**DESIGN DECISION - standard-user comparison:** The [CI-only launcher](tests/native/windows-token-launch.ps1) now compares startup under a fresh temporary Users-only account, using [CreateProcessWithTokenW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createprocesswithtokenw), an explicitly loaded user profile and a private desktop. It requires verification that the actual child is non-elevated, Medium integrity, belongs to the intended account, has no Administrators membership and has no restricted-token flags/SIDs. The helper requires disposable GitHub-hosted Windows CI, records exact account identity for cleanup, and fails on incomplete owned-resource cleanup. Only its newly created empty app-profile directory may receive a narrowly scoped write permission if the write probe requires it. No privilege grant, system-policy change, application-permission change or sandbox-disabling flag is introduced.

**FACT - comparison preflight failure:** [Run 37100039753](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37100039753) stopped before runtime assertions because its token inspector reported restrictions on both the elevated parent and newly created standard user. The original helper read four bytes from an allocation sized by the API without checking its returned length. [Microsoft's token-information reference](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ne-winnt-token_information_class) documents a DWORD, while a [September 2026 Q&A reproduction](https://learn.microsoft.com/en-us/answers/questions/6000453/gettokeninformation-tokenhasrestrictions-21-return) reports a one-byte result; the latter is an observed report, not a revised API contract. The helper now initializes four bytes, accepts only measured lengths of one or four, records the returned length/value and still rejects genuinely restricted tokens. Independent local Windows measurement returned length one: a zero-initialized four-byte buffer became `[1, 0, 0, 0]`, while an `A5`-initialized buffer became `[1, A5, A5, A5]`. Only the first byte changed; this local sandbox token actually reported restriction value one, unlike the runner tokens below. The external Q&A used `AA` sentinels. Reading beyond the returned byte can manufacture a nonzero value; the initialized, length-checked reader preserves the nonrestricted-token requirement.

**FACT - measured token correction:** [Fast diagnostic run 37100324020](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37100324020) reported `ReturnLength=1`, `RawValue=0` for both the elevated parent and the genuine standard user. The complete standard-user token gate passed. Its profile write probe passed with the ACL unchanged, and all five cleanup flags were true with `errors=[]`. Downloaded [artifact 11265459557](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37100324020/artifacts/11265459557) has SHA-256 `5fd720d7ddc675e69bb3abb88fd4e3abe43a9c8705a6af6ea298c49ec2c1ec54`.

**FACT - bounded startup comparison:** The earlier `CreateProcessWithTokenW` error 87 was followed by a plain `STARTUPINFO` path without inherited caller stdio. [Fast diagnostic run 37101691273](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37101691273) launched the actual genuine standard-user child and passed all token gates, then exited with code 101 before reader assertions. Parent, target and child token session IDs were 2; available process session IDs also matched. `EBWebView` was owned by the target user with inherited FullControl. The browser log reported failure to create its `ProcessSingleton`. All five cleanup flags passed with no errors. Downloaded [artifact 11265952614](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37101691273/artifacts/11265952614), `.cache/windows-fast-sixth.zip`, has independently checked SHA-256 `59574bb02e338ec247a1f189df186887944e2b112b20e491a6df7f9560e638f2`.

**FACT / INFERENCE - namespace boundary:** Under target impersonation, creation of a fresh random `Local\` mutex failed with access denied (error 5). The fixed upstream Chromium mutex-name probe found no object before or after (error 2); that name is not established as Edge's actual mutex. [Microsoft's mutex API reference](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-createmutexw) explains named-object access and namespaces. The observed helper-side access failure identifies a CI-context constraint, but does not prove which child-process API or permission caused the browser failure. Matching session IDs and writable profile ownership do not resolve that distinction.

**FACT - final bounded comparison:** The [CreateProcessWithLogonW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createprocesswithlogonw) comparison in [run 37102433709](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37102433709) failed before CDP/reader assertions as well. Recorded source head: `1b38fd4d1dc4cab99124bf4ed5f5432d1ecfc9b6`; tested merge: `49f6cc830e8fa454e5cb397f19a82ab9d78fb10a`. The actual child (10040) passed all genuine-standard-user gates in session 2, then exited 101. Browser process 7796 logged `ProcessSingleton` failure. The helper's random mutex probe still returned access denied; the profile remained target-owned with FullControl. All five cleanup flags were true with no errors. Downloaded [artifact 11266003295](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37102433709/artifacts/11266003295), `.cache/windows-fast-seventh.zip`, has independently checked SHA-256 `d4d36f47f1b8258a6ea62a56b09d3176813121f0ad6720b207bc2e60b0a1fd6a`.

**DESIGN DECISION / BLOCKER:** Bounded launcher comparisons are complete. This hosted native-verification environment currently blocks the installed-reader gate; verification needs a normal interactive Windows session or a suitable runner. These results do not establish that Folio fails on normal Windows, or prove the exact child namespace/API cause. Shared namespace ACLs and system policies were not relaxed. [Fast diagnostics](.github/workflows/windows-harness.yml) are now manual-only, requiring explicit unexpired installer artifact ID, digest and source inputs rather than hard-coded expiring IDs. No native reader pass, release publication or live downloadable EXE is established; cached-installer diagnostics cannot satisfy the source-matched release gate.

**FACT - final full-source gate:** [Native build run 37102794636](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37102794636) built both Windows and macOS packages successfully. The separate full-source [Windows release run 37102794622](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37102794622) passed preflight, notice generation, eight tests, compilation and installation, then the native application exited 101 before reader verification. Its publisher was **skipped**. This confirms the runtime gate remains blocked on the rebuilt source; no public Windows EXE or completed release is available.

**DESIGN DECISION:** Accept MPL-2.0 only for the enumerated unchanged versions (`cssparser 0.37.0`, `cssparser-macros 0.7.1`, `dtoa-short 0.3.5`, `option-ext 0.2.0`, `selectors 0.38.0`) and distribute their original checksum-matched registry source archives with notices. Changed/new versions require review. Hash-pinned upstream MIT clarifications cover the selected WebView2 Rust crates whose archives omit workspace-root notices.

**FACT - scanner verification:** The first actual notice scan rejected canonical fallback text for several crates. Exact packaged-file hashes now identify indented Microsoft MIT notices and cargo_toml's original MIT notice. The collector retains both Apache and MIT obligations for dpi's libm-derived code, selects the packaged CC0 alternative for dunce and BSD alternative for brotli-decompressor, and pins alloc-stdlib's missing repository-root BSD notice to its inspected upstream revision. These are version-guarded original texts, not permission to substitute invented attribution. Cargo 1.99 may omit per-file checksum metadata; the collector then compares every copied notice to the checksum-verified original registry archive.

**FACT - platform scope:** `scripts/native-platform-notices.mjs` collects the actual build compiler's Rust standard-library copyright/licenses, hash-pinned WebView2 SDK loader license/NOTICE, NSIS 3.11 licenses and unchanged source, and installer-plugin attribution. NSIS's included LZMA terms/linking exception and Microsoft static runtime terms mean the whole executable must not be described as only permissively licensed Rust. WebView2 Evergreen installation is separate; the app does not embed a fixed Chromium runtime. The upstream installer plugin lacks an exact dependency/compiler inventory, which remains explicitly disclosed rather than invented.

**DESIGN DECISION:** Bundle these materials in the installer and an accompanying notices ZIP. The implemented release gate requires exact main Reader checks, an installed WebView2 smoke report, same-run artifact/provenance hashes and a matching immutable tag before publishing a draft as `v0.1.0-preview.1`. These are inspected code paths, not completed runtime/publication results. The planned direct EXE avoids requiring end users to obtain expiring CI artifacts.

**UNRESOLVED:** Complete the installed runtime and source-matched publication gate, inspect distributed bytes, and record actual evidence before claiming the preview is available or native workflows passed. Earlier notice/build/silent-install successes do not establish runtime success. The Windows inventory does not certify another platform, a security audit, legal advice or a new license for Folio's own **UNLICENSED** source.

## Licensing, Security and Performance Record

Original source remains **UNLICENSED**, pending owner choice. PDF.js, page writer, signing components, OCR models/native components, fonts and Tauri transitive artifacts each retain their own obligations. The verified native Cargo lockfile is retained. The Windows-specific native notice/source gate and build/install checks passed as described above; public release verification remains blocked by the latest close-safety/release validation described below, and other native platform inventories need separate review. Test-only dependencies must not be silently bundled into the client.

Security review must include parser/worker boundaries, account identity dispatch, device-storage expectations and embedded WASM components. An earlier zero-advisory package audit does not establish the upgraded dependency graph's current status; exact new commands/results belong in verification.

Existing initial-reader timings use small synthetic localhost fixtures, not high-byte scans or physical phones. New OCR/signing/organization assets and memory costs require separate measurements. No competitor benchmark, suite duration or account count is presented as application performance evidence.


## Normal-user native execution and CI test configuration — 2026-10-03

**FACT:** Actual Windows 10.0.22621 x64 / WebView2 154.0.4258.53 verification on 2026-10-03 passed 12 native checks: startup, real rendering, storage refusal/consent, immutable originals, form recovery, search, form download/reopen, text annotation download/reopen, and recovery after full owned-process termination/relaunch. Both process jobs emptied; the normal-user route changed no registry policy. The tested installer came from artifact 11266978801, source `85cc5de6378e64372549fb298d383374c74a488a` (installer SHA-256 `48e755d2e3a9596981a11c0a914ae514455ec533e82eb0e8201e65e219da8c31`). All 533 installed notice hashes also passed.

**INFERENCE:** The previous custom-account/session failures are specific to that CI launch route; they are not a general Folio startup failure. This does not prove every Windows machine behaves identically.

**FACT:** [Microsoft's WebView2 environment reference](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/webview2-idl?view=webview2-1.0.3800.47) documents executable-scoped HKLM/HKCU AdditionalBrowserArguments and UserDataFolder overrides, with HKLM checked first. [Playwright documents attaching to actual WebView2](https://playwright.dev/docs/webview2). Prior elevated-host environment-variable rejection remains in the historical evidence.

**DESIGN DECISION:** Keep the shipped app unchanged. Use the runner's existing account for CI, supplying only the documented executable-scoped debugger/profile settings on the disposable elevated machine and removing the exact values afterward. Local normal-user testing uses process environment only. Require verified actual profile/port, owned-job cleanup, original preservation, independent PDF reopen and process-restart recovery. No sandbox switch, shared namespace ACL change or persistent debugging configuration is introduced.

**FACT:** Revised CI runtime passed 12 checks and exact cleanup in run 37118654858; preparation validation failed and publication was skipped.

**UNRESOLVED:** Release validation and public prerelease remain pending; native print/file-picker UI, physical devices and live managed account sessions still require their own evidence.

## Native close safety and API dependency - 2026-10-03

**FACT (observed):** Actual Windows OS-close testing on source `85cc5de` exited with dirty form edits and no prompt. Browser `beforeunload` alone did not protect this native window. Existing 12-check reader/recovery passes did not include that operation.

**FACT (primary sources):** [Tauri capabilities](https://v2.tauri.app/security/capabilities/), [command permissions](https://v2.tauri.app/security/permissions/) and [core JavaScript API](https://v2.tauri.app/reference/javascript/api/namespacecore/) document local-window ACLs and invocation. Exact cached Rust source for tauri 2.12.1 / tauri-build 2.7.1 confirms `on_window_event`, prevented `CloseRequested`, `WebviewWindow::destroy` and AppManifest command permission generation.

**FACT (license):** npm metadata and packaged original license files for `@tauri-apps/api` 2.12.1 declare `Apache-2.0 OR MIT`; the lockfile pins the package integrity. Original license files are copied into distribution assets. The API supports the existing web frontend/native bridge; it introduces no additional PDF engine or Rust dependency. This records inspected terms, not legal advice.

**DESIGN DECISION:** Prevent native closure first, then reuse the shared validated per-document workflow. Only `finish_close` is granted to the local main window; no filesystem/shell/network permission is added. The wrapper fails closed if the frontend cannot respond. Browser bridge simulations test UI only; release verification must also send actual OS-close requests and prove cancel-preservation and confirmed clean exit.

**UNRESOLVED:** Compile and execute the corrected native binary, then resolve the independent release identity/cleanup validation using explicit diagnostics; never remove a gate to conceal its failure.

## NSIS executable identity - 2026-10-03

**FACT:** The exact [Tauri CLI 2.12.1 bundler source](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.1/crates/tauri-bundler/src/bundle.rs), downloaded SHA-256 `91c8387ccb2e52388cdcfeccfd23f69dac5439aba397d464b1d5446153fdc82e`, patches the first bundle marker from UNK to NSS and restores the original build EXE afterward. Run 37120364964 logged different raw hashes; an independently downloaded/installed copy reproduced the original build hash after reversing exactly those three bytes. Native close passed 14 cases both remotely and locally.

**DESIGN DECISION:** Model only this pinned unsigned packaging transformation in a strict full-byte comparator, record both hashes and offset, and reject any other difference, ambiguous marker or new CLI version. Do not omit the identity gate or normalize arbitrary PE sections. Signed builds need a separate review.

**UNRESOLVED:** Verify revised prepare/publication CI and inspect anonymous public downloads. An unrelated macOS WebKit OCR retry page crash passed on retry and did not reproduce in three local runs; its cause remains unproved.

## Accessibility Interaction Research (2026-10-03)

**FACT:** [WAI-ARIA tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) associates each tab with a labeled panel and specifies arrow-key navigation, with Home/End optional. Recreating the focused tab is not necessary to update selection.

**FACT:** [WCAG 2.2 reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) uses 320 CSS pixels for vertically scrolling content; document regions that require two-dimensional layout have a scoped exception. [Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) addresses 200% text size. [Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) requires that author-created content not completely hide the focused component. [Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) describes the 24 CSS-pixel minimum and exceptions.

**FACT — observed:** Four pre-fix Chromium regressions reproduced lost tab focus, missing inactive panel targets, absent navigation expanded state and a collapsed canvas at 320 x 256. A later expanded axe scan found nine Document Properties labels at 3.60:1. The replacement label color #52615a on #fdfcf9 calculates to 6.36:1. Application field boundaries #7b8b81 on #f5f5f0 calculate to 3.28:1; selected thumbnail border #52684a on #e7ebdf calculates to 5.05:1. These ratios concern application chrome, not arbitrary PDF content.

**DESIGN DECISION:** Preserve session/tab DOM identity, retain empty panel wrappers while detaching inactive widgets, restore focus at UI transitions, and use persistent status announcements. Reflow application controls separately from PDF page geometry. Use the existing axe dependency as a blocking regression gate; add no runtime dependency.

**UNRESOLVED:** Browser viewport/text/forced-colors emulation is not native zoom, OS text scaling or assistive-technology verification. Physical NVDA/JAWS/VoiceOver/TalkBack, speech input, braille, arbitrary tagged-PDF reading order and accessible annotation authoring require separate evaluation.

**FACT — macOS CI follow-up:** Reader runs 37139250189 and 37139464662 passed Linux Chromium but exposed five WebKit accessibility failures. Pointer-opened dialogs returned to stale focus; the native zoom selector measured only 22 CSS pixels high; default Tab skipped the initial link. [WebKit records that macOS buttons are not mouse-focusable](https://results.webkit.org/commit?id=311768%40main&repository_id=webkit). [Apple documents Option-Tab and Safari’s full Tab navigation setting](https://support.apple.com/en-lamr/guide/safari/cpsh003/mac).

**DESIGN DECISION:** Supply explicit dialog origins for pointer activation, keep the native select semantics/menu with a styled 44-pixel box and CSS arrow, and test the documented Option-Tab gesture for the initial link on macOS WebKit. These changes do not bypass a failing test or replace the native select with a custom widget.

**FACT — verification outcome:** The corrected application passed 79 browser workflows on each of Linux Chromium and macOS WebKit in merged-source Reader run 37142162437. Windows release run 37142162439 passed 14 installed-app checks and published 0.1.1; independent anonymous downloads matched source/tag/provenance and asset digests. These results establish the recorded workflows, not physical assistive-technology compatibility.
