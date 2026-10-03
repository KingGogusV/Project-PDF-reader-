# Research record

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

## Windows Release Inventory and Gates (2026-10-03)

Primary references: [cargo-about generation](https://embarkstudios.github.io/cargo-about/cli/generate/index.html), [Tauri bundled resources](https://v2.tauri.app/develop/resources/), [Playwright WebView2 testing](https://playwright.dev/docs/webview2), [Mozilla MPL 2.0](https://www.mozilla.org/MPL/2.0/), and [GitHub release download links](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases). Exact component URLs/hashes are retained in the collectors and generated manifest.

**FACT - runtime test boundary:** Windows run 37095044448 passed notice generation, extraction tests, compilation and silent installation, then timed out connecting to CDP before any app workflow assertions ran. Microsoft documents that Runtime 150 ignores WebView2 environment settings in elevated hosts ([maintainer explanation](https://github.com/MicrosoftEdge/WebView2Feedback/issues/5640#issuecomment-4923662109)); [GitHub Windows runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) use administrators with UAC disabled. **INFERENCE:** elevation is the likely cause, not yet a measured pass/fail diagnosis of PDF functionality. Test the installed app with an explicitly verified non-elevated token rather than disabling security restrictions, downgrading the runtime or changing application permissions. Preserve startup diagnostics and leave publication blocked until the actual workflow passes.

**FACT - inspected implementation:** `scripts/native-notices.mjs` invokes pinned `cargo-about 0.9.2` for the locked `x86_64-pc-windows-msvc` graph, includes build dependencies conservatively, requires original license text rather than SPDX fallback text, and checks original crate archives/notices against Cargo checksums. `scripts/native-licenses.toml` selects reviewed permissive alternatives; it is not a blanket allowlist for every dependency.

**DESIGN DECISION:** Accept MPL-2.0 only for the enumerated unchanged versions (`cssparser 0.37.0`, `cssparser-macros 0.7.1`, `dtoa-short 0.3.5`, `option-ext 0.2.0`, `selectors 0.38.0`) and distribute their original checksum-matched registry source archives with notices. Changed/new versions require review. Hash-pinned upstream MIT clarifications cover the selected WebView2 Rust crates whose archives omit workspace-root notices.

**FACT - scanner verification:** The first actual notice scan rejected canonical fallback text for several crates. Exact packaged-file hashes now identify indented Microsoft MIT notices and cargo_toml's original MIT notice. The collector retains both Apache and MIT obligations for dpi's libm-derived code, selects the packaged CC0 alternative for dunce and BSD alternative for brotli-decompressor, and pins alloc-stdlib's missing repository-root BSD notice to its inspected upstream revision. These are version-guarded original texts, not permission to substitute invented attribution. Cargo 1.99 may omit per-file checksum metadata; the collector then compares every copied notice to the checksum-verified original registry archive.

**FACT - platform scope:** `scripts/native-platform-notices.mjs` collects the actual build compiler's Rust standard-library copyright/licenses, hash-pinned WebView2 SDK loader license/NOTICE, NSIS 3.11 licenses and unchanged source, and installer-plugin attribution. NSIS's included LZMA terms/linking exception and Microsoft static runtime terms mean the whole executable must not be described as only permissively licensed Rust. WebView2 Evergreen installation is separate; the app does not embed a fixed Chromium runtime. The upstream installer plugin lacks an exact dependency/compiler inventory, which remains explicitly disclosed rather than invented.

**DESIGN DECISION:** Bundle these materials in the installer and an accompanying notices ZIP. The implemented release gate requires exact main Reader checks, an installed WebView2 smoke report, same-run artifact/provenance hashes and a matching immutable tag before publishing a draft as `v0.1.0-preview.1`. These are inspected code paths, not completed runtime/publication results. The planned direct EXE avoids requiring end users to obtain expiring CI artifacts.

**UNRESOLVED:** Execute and inspect the notice/build/install/publish workflow, check its distributed bytes, and record actual evidence before claiming the preview is available or native workflows passed. The Windows inventory does not certify another platform, a security audit, legal advice or a new license for Folio's own **UNLICENSED** source.

## Licensing, Security and Performance Record

Original source remains **UNLICENSED**, pending owner choice. PDF.js, page writer, signing components, OCR models/native components, fonts and Tauri transitive artifacts each retain their own obligations. The verified native Cargo lockfile is retained. A Windows-specific native notice/source gate is now implemented as described above; successful generated-distribution verification remains pending, and other native platform inventories need separate review. Test-only dependencies must not be silently bundled into the client.

Security review must include parser/worker boundaries, account identity dispatch, device-storage expectations and embedded WASM components. An earlier zero-advisory package audit does not establish the upgraded dependency graph's current status; exact new commands/results belong in verification.

Existing initial-reader timings use small synthetic localhost fixtures, not high-byte scans or physical phones. New OCR/signing/organization assets and memory costs require separate measurements. No competitor benchmark, suite duration or account count is presented as application performance evidence.
