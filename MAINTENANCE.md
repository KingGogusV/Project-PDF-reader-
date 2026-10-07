# Maintenance

Updated: **2026-10-07 UTC**. The connected GitHub repository is the authoritative source. The existing workspace/hosting manifest belongs to this project; do not create a second application or replace established resources merely to deploy.

## Startup Procedure

1. Read PROJECT.md, this file and ARCHITECTURE.md.
2. Review recent CHANGELOG.md, relevant BACKLOG.md, requirements, upgrade scope and verification.
3. Inspect branch, remotes, commits and uncommitted changes; preserve other sessions' work.
4. Inspect the actual package/configuration before using commands below.
5. Run practical baseline checks before consequential changes, then update records from completed evidence.

Do not edit project-synced reference material under the parent workspace's `sources/` directory. Keep generated artifacts, credentials, PDFs containing private data and environment secrets out of commits.

## Install, Run and Build

Recorded toolchain: Node 24 and pnpm 11.25.0. Use the committed pnpm lockfile.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

`dev` copies self-hosted engine/OCR/license resources, generates synthetic fixtures/demo, then starts Vite on loopback. `test` regenerates ordinary and fidelity fixtures and runs `tests/unit/*.test.mjs`. `build` copies assets, generates fixtures, type-checks, builds `dist/client`, generates its versioned service worker, and builds `dist/server/index.js`. It copies the existing hosting manifest and migrations into `dist/.openai/` and checks the worker fetch export.

`preview` serves the already-built static client, normally at `http://127.0.0.1:4173`. It does **not** run the managed identity dispatcher or account database. Guest workflows remain available; account-service unavailability here is expected, not evidence of a broken hosted deployment. Check whether port 4173 is already in use and coordinate ownership before starting another process. Do not rebuild or replace served files while another agent/test is using that preview.

Individual generators are `pnpm assets`, `pnpm fixtures` and `pnpm fixtures:fidelity`. There is no standalone lint script. Generated assets/fixtures/builds/reports/dependencies are ignored; retain source generators, synthetic fixture definitions and dependency locks.

### Full fixture prerequisites

The ordinary generator detects the bundled Python runtime or explicit `FOLIO_PYTHON`. Encrypted fixtures require pypdf/cryptography; CI installs the inspected pins:

```sh
python -m pip install pypdf==6.10.0 cryptography==50.0.1
```

Independent fidelity comparisons detect bundled Poppler, `FOLIO_PDFTOPPM`, or `pdftoppm` on PATH. Linux CI installs `poppler-utils`; macOS CI installs Poppler through Homebrew when missing. Fidelity generation downloads pinned Noto font bytes and OFL licenses on first use, validates hashes, then reuses the generated local cache. That test-fixture setup needs network; it does not cause application PDF uploads. Record missing dependencies/skips explicitly; an unavailable encrypted or independent-renderer fixture is not passing coverage.

## Browser and Core Tests

After the production build, start `pnpm preview` in a separate terminal, then run:

```sh
pnpm test:e2e
```

The default channel is installed Microsoft Edge. On Windows PowerShell, select another installed Chromium channel:

```powershell
$env:E2E_BROWSER_CHANNEL = 'chrome'
pnpm test:e2e
```

Supported channel selections are `msedge`, `chrome` and `chromium`. Bundled Chromium requires `pnpm exec playwright install chromium`; Linux CI uses `pnpm exec playwright install --with-deps chromium`. Set `E2E_BROWSER=webkit` to select Playwright WebKit after installing it with `pnpm exec playwright install webkit`; this is not branded Safari.

The E2E base URL defaults to `http://127.0.0.1:4173`; `E2E_BASE_URL` overrides it. `E2E_START_SERVER=1` makes Playwright start an already-built preview, as CI does. One test worker prevents conflicting shared fixtures. Ordinary tests block service workers; dedicated offline tests enable them. Never drive another session's browser page/context.

Core checkpoints and signing have separate actual configurations and servers:

```sh
pnpm assets
pnpm fixtures
pnpm fixtures:fidelity
pnpm test:core
pnpm test:signing
```

Core tests start/reuse a Vite harness on loopback port 5175; signing tests use 5176. They use Chromium/Edge by default and honor `E2E_BROWSER_CHANNEL`; they do not inherit the shell's WebKit switch. Keep ports clear or coordinate existing harness ownership. These tests supplement production-shell E2E; they do not replace it.

### Accessibility and performance

With a built preview running:

```sh
node scripts/audit-accessibility.mjs
node scripts/benchmark.mjs
```

The CI-gated accessibility pass is part of `pnpm test:e2e`. For a focused production-build check on Linux after installing Playwright Chromium, run:

```sh
E2E_BROWSER_CHANNEL=chromium E2E_START_SERVER=1 pnpm test:e2e tests/e2e/accessibility.spec.ts
```

Use `E2E_BROWSER=webkit` for the installed WebKit engine. Keep the baseline PDF workflow tests: focus fixes must not break exports, duplicate-widget isolation, dirty tracking, recovery or phone landscape controls. Inspect the retained screenshots and axe attachments; zero violations does not resolve automated incomplete checks. Use physical NVDA/JAWS/VoiceOver/TalkBack sessions separately.

Audit configuration and incomplete/manual checks are documented in [the accessibility audit](docs/accessibility-audit.md). Record browser/version, build, viewport, CPU emulation, fixture size, warm/cold/cache state and actual timings. Suite execution time is not document latency. Review script defaults before interpreting any new benchmark.

## Account Schema and Hosted Deployment

The existing `.openai/hosting.json` identifies this managed project and its `DB` database binding. `db/schema.ts` and reviewed SQL under `drizzle/` are durable schema history.

```sh
pnpm db:generate
```

This command generates migrations; it does not apply them to a live database. Review generated SQL for preservation, the slot check 1-200 and unique identity/account constraints. Do not reset live data or claim a live migration from local schema generation.

The worker exposes only `/api/account`. Managed dispatch owns ChatGPT sign-in/sign-out/callback routes and must strip client identity headers before inserting trusted identity. Never expose the worker directly through a host that lets clients spoof these headers. Test unauthenticated access, forged headers, same-origin checks, bounded bodies, capacity, existing accounts at capacity and outage handling against the actual host.

Hosting uses the existing Sites project/manifest and its supported deployment tooling; no local deploy command is defined in package.json. Build and review concrete artifacts first, then use the authorized project deployment flow and inspect terminal status/live behavior. Do not invent a URL, migration success or authentication test. Deployments v2 and v3 succeeded at [Folio](https://folio-local-pdf.gogoi-ronnie.chatgpt.site). Live online reading/recovery, anonymous responses, spoofed-identity refusal and true Chromium offline reload/local recovery passed; actual managed account sign-in remains unverified. The deployed v2 source passed 63 E2E cases on each browser and Windows/macOS packaging. Exact runs and delivery identities are in verification.

The 200-account ceiling concerns registered accounts, not measured concurrent traffic. Account rows do not contain PDFs. PDFs remain opt-in, unencrypted, device-local; sign-in on another device does not synchronize them.

## Experimental Native Commands

The Tauri wrapper shares `dist/client`. Its five local-main-window commands provide bounded new-copy saving and `finish_close`; only Rust opens the Save As dialog and accesses its selected destination. Save As/Ctrl+S writes chunks of at most 1 MiB, flushes and rechecks the completed copy before returning the filename/length/SHA-256 receipt. Only that receipt clears the exported snapshot's dirty state; cancellation/failure retains edits and existing destinations are never overwritten. This bounds transfer-buffer work, not total memory or measured document latency. No JavaScript filesystem/shell/network/dialog plugin permissions are granted. Preserve the generated command ACL, no-overwrite behavior, disk receipt and OS-close gates. Actual convenience scripts are `pnpm native:dev` and `pnpm native:build`. Use explicit platform bundles and a locked dependency graph for repeatable packaging:

```sh
pnpm exec tauri info
pnpm exec tauri dev
```

The verified `src-tauri/Cargo.lock` is retained. Do not regenerate it during ordinary builds. Only if intentionally bootstrapping a missing lockfile, run `cargo generate-lockfile` from `src-tauri/`; inspect the result, then verify resolution:

```sh
cargo generate-lockfile
cargo metadata --locked --format-version 1
```

Return to the repository root and run the command for the current platform:

```sh
node node_modules/@tauri-apps/cli/tauri.js build --no-sign --bundles nsis -- --locked
node node_modules/@tauri-apps/cli/tauri.js build --no-sign --bundles app,dmg -- --locked
```

The first is Windows; the second requires macOS. Direct Node invocation preserves the final `-- --locked` delimiter when PowerShell's pnpm wrapper would otherwise consume it; that delimiter forwards locking to Cargo. These produce unsigned development artifacts, not trusted releases. Native CI conditionally generates a missing lockfile, retains dependency metadata and packages, and archives the macOS app to preserve executable permissions. Preserve the committed, verified Cargo lockfile; review any future resolution change and its notices.

The current Windows session has Rust/Cargo 1.99.0, MSVC 14.51.36231 (Visual Studio 18 Insiders), Windows SDK 10.0.26100.0 and WebView2 154.0.4258.62. Local compilation and linking pass; `vswhere` needs `-prerelease` to include this compiler installation. Earlier compiler gaps and remote packaging/runtime results remain in verification. Rust formatting, `cargo check --locked`, `cargo test --locked` and `cargo clippy --locked --all-targets -- -D warnings` are required alongside installer creation. Build frontend assets before Rust checks because the embedded context uses `dist/client`. macOS runtime and signing/notarization remain unverified. See [native prerequisites and runtime gates](src-tauri/README.md). The Windows installer requests WebView2 125.0.0.0 or newer, following the actual PDF.js legacy build's dependency target. Historical installed Folio tests use WebView2 153/154; 125 is not an installed runtime test. Keep Evergreen current. The startup capability guard runs before reader/storage initialization and offers update guidance on incompatible runtimes. Initial Runtime setup/updating may need internet. No signing identity is configured; user reading/device storage needs no PowerShell or developer tools.

## Windows Download Release Pipeline

Automatic pull-request and matching main-push runs **verify only**: they build the installer, run the source-bound 0.1.1-to-0.1.2 candidate upgrade and installed reader gates, prepare checksummed files and retain artifacts. The pure release policy requires the exact ordered 17 runtime checks/eight dialog actions and 20 candidate upgrade checks/three native Save As actions, strict typed source/hash/profile/shortcut/cleanup evidence, and empty page/console/privacy error arrays. A historical upgrade report cannot satisfy the candidate gate. Ordinary documentation-only main pushes do not match the Windows workflow's paths. Test/harness changes can merge without attempting to publish an unchanged application or reuse an immutable release tag. Application/build-input paths also trigger installed-reader verification.

To deliberately publish a future preview, first update the application version, release tag, names, notes and extractor allowlist coherently and merge the reviewed change. In GitHub Actions, open **Windows download release**, choose **Run workflow** on `main`, select `publish`, and provide the full reviewed commit in `expected_source_sha`. Leave `publish` unchecked for verification-only manual runs. The workflow and publisher independently require an explicit publication dispatch on this repository's main branch with an exact matching SHA. A moved branch requires reviewing the new source; never substitute a short SHA or bypass that check.

Publication still requires successful Reader **push** checks on the exact main revision; do not use `[skip ci]` for a source intended for publication. Installer verification and artifact/source/digest/notice checks remain mandatory. Any already-published tag cannot be republished from a different commit: the publisher refuses that conflict before waiting for Reader checks or downloading artifacts. The published 0.1.2 release has its own immutable version/tag identity and deliberate publication; automatic preparation runs verify only and keep the publisher skipped.

The published unsigned x64 prerelease is [`v0.1.2-preview.1`](https://github.com/KingGogusV/Project-PDF-reader-/releases/tag/v0.1.2-preview.1), source `ad8b2c169d707ff9616bf115b9c977c88c09cef9`. Installer: **18016393 bytes**, SHA-256 `1ed999a56b9c4fa5b4c95d25af743ed4903cc366345ce097244a4602eee2d799`. [Publication run 37686535246](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37686535246) and [Reader run 37686461277](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37686461277) passed on that exact source. The [delivery record](docs/windows-preview-3-verification.json) retains all four anonymous downloads, complete prepared/public byte equality, nested notice verification and preservation of both earlier releases' IDs/timestamps and all eight asset hashes. The separate normal-user installed run also passed before README/About promotion. No code-signing identity or stable/latest channel is claimed. Reproduce the build with:

```sh
cargo install cargo-about --version 0.9.2 --locked --features cli
node scripts/native-notices.mjs src-tauri/generated-notices
node node_modules/@tauri-apps/cli/tauri.js build --no-sign --bundles nsis --config src-tauri/tauri.windows-release.conf.json -- --locked
```

Notice collection requires a fresh output directory, exact reviewed dependencies and original texts/archives. Do not broaden licensing policy to make a build pass. The workflow installs into an empty validated `RUNNER_TEMP/FolioNativeSmoke`, checks the EXE/notices, then runs `node tests/native/windows-app-smoke.mjs`.

CI mode requires this repository, `GITHUB_ACTIONS=true`, `CI=true` and `RUNNER_ENVIRONMENT=github-hosted`; never spoof these guards. It launches in the runner's existing account, using a suspended process assigned to an owned kill-on-close job. The elevated disposable runner uses documented HKLM WebView2 overrides for exactly `folio-desktop.exe`: only the selected loopback debugging arguments and fresh test profile. Existing values are refused. No wildcard policy, sandbox disabling, account creation, privilege grant or shared namespace ACL change is used. The helper removes only its exact values and verifies the job is empty; any cleanup failure fails verification. These overrides are never added to the shipped app.

For an already installed, checksum-verified preview in an isolated temporary folder, a normal non-elevated Windows user can run:

```sh
node tests/native/windows-app-smoke.mjs --local <absolute-installed-exe-path> <expected-exe-sha256>
```

Local mode refuses elevation, verifies the executable and temporary-path boundaries, changes no registry policy and creates a separate profile/report directory. It does not install, overwrite or uninstall applications. Synthetic fixtures must exist. Reports and screenshots are under `test-results/native-windows-local-*`; CI uses `test-results/native-windows/`. Profiles contain only synthetic PDFs and are retained for diagnosis. Never point tests at an end user's real profile.

The test-only Save As helper now uses the same PowerShell 7 runner as launch/close helpers and explicitly checks UIAutomationClient/UIAutomationTypes/WindowsBase availability before automation. Its scripts must be allowed by the shell's existing execution policy. Never bypass or change policy to obtain a pass. Earlier Windows PowerShell 5.1 policy/module failures remain partial historical evidence; offscreen helper probes establish prerequisites rather than installed application success. User installation and PDF workflows require no PowerShell.

The released source passed all **17 installed CI checks**, eight owned dialog actions, exact Unicode/multi-chunk copy receipts/reopen, empty page/console/privacy error arrays and both stopped/closed process-policy cleanups. The separate **20-check candidate upgrade** passed using the genuine default `app.folio.localreader` profile only in an elevated disposable hosted-CI account, clearing inherited overrides and setting no UserDataFolder override. Occupied profile/policy/shortcut paths remain refused. It verified the pinned published 0.1.1 baseline, exact new candidate installer/EXE, three independently reopened native Save As copies, four owned launch cleanups and verified installer/captured-shortcut removal. It uses synthetic data and does not certify real user libraries.

A normal, non-elevated run passed all **17 local installed-reader checks** from the anonymously downloaded public installer on Windows 11 Pro build 22621/WebView2 154.0.4258.62, with an isolated synthetic profile and no registry policy changes. The [sanitized report](docs/windows-preview-3-normal-user-verification.json) records all eight owned dialogs, both job cleanups, 554 installed notice hashes, guarded uninstall and unchanged execution policy. This pass is separate from the candidate default-profile upgrade. Keep source, installer/executable hashes, runtime version and cleanup records together. Local testing must never use a real user's library or spoof CI flags.

Some dialog providers omit standard controls from UI Automation. The test helper may then use only the exact owned dialog's reviewed Win32 IDs (Save 1, Cancel 2, Yes 6, legacy filename 1148), with unique control/class, PID, child, visible/enabled and exact filename-readback checks. When every legacy 1148 control is absent, the observed Server 2025 picker also supports a unique Edit 1001 with the exact ComboBox/FloatNotifySink/DirectUIHWND/DUIViewWndClassName immediate-parent chain (ancestor IDs 0) into the owned dialog. Every ancestor must be owned, visible and enabled; uniqueness and legacy absence are rechecked before/after setting and after readback. The modern path then sends only bounded `WM_COMMAND`/`CBN_EDITCHANGE` to that captured ComboBox's immediate FloatNotifySink parent and repeats the exact readback; visible text alone left the shell filename model unchanged in recorded CI. A processed handler result zero is valid; a timeout is a failure. Multiple matches or a present unusable legacy control fail. Retain structural-only diagnostics and bounded messages; do not add global input or record MRU names/values.

The existing-file Task Dialog fallback is limited to the confirmation owned by the immediately preceding synthetic Save dialog HWND. Require exactly that visible disabled Save owner and one visible enabled owned confirmation; revalidate the observed DirectUIHWND 0 and two distinct CtrlNotifySink 0/Button 0 branches, with no legacy ID 6. Send only documented `TDM_CLICK_BUTTON` with semantic IDYES 6 to the confirmation root, never an ID-zero child selected by name/order. Bound delivery and require disappearance. The runtime test additionally requires Folio's explicit existing-file refusal, unchanged original bytes, no extra file and retained dirty state; cancellation is not a pass for replacement refusal.

Tauri provides `TAURI_ENV_PLATFORM` to its frontend dev/build hooks. Vite uses it only for recognized native platforms to align HTML metadata and response CSP with the two configured local IPC sources. Ordinary browser builds retain their original policy. Preserve the CSP regression tests, the Vite object-export contract used by signing, and asynchronous dialog-helper execution: blocking Node also blocks Playwright's intercepted IPC requests. Do not remove CSP or grant general network/filesystem permissions to repair a native transport failure.

The shared test checks real rendering, form fields, storage consent, immutable originals, search, form/annotation Save As and independent reopen. Save As automation targets only the verified owned application's dialogs and task-owned temporary destinations: cancel, existing-file refusal after OS confirmation, Unicode names, a multi-chunk unchanged PDF and exact-byte/hash verification. Open uses Playwright's real file-input mechanism; manual Open-dialog navigation and physical printing remain separate checks. The test terminates the entire owned app/WebView job after a completed checkpoint, restarts it, and checks recovery. This establishes completed-checkpoint recovery, not recovery of unfinished drafts or writes. It sends OS close requests to the exact captured main window, requires cancellation to preserve edits and requires explicit discard to exit cleanly. Natural exit is permitted only after an expected confirmed close.

Release preparation compares every installed/build EXE byte with only the pinned Tauri NSIS marker transformation permitted, exact source revision, native pass and both cleanup records. Main-only publication also checks exact-source Reader CI, archive digest, bounded payload inventory, checksums and tag identity. Draft retries never overwrite conflicting assets. Anonymous downloads of all four 0.1.2 assets were verified before README/About promotion; future releases must retain that gate. The independent audit requires successful explicit-main publication and exact-source Reader push CI, peeled tag identity, public API sizes/SHA-256, entire prepared/public byte equality and checksum inventory, both pure native/candidate gates and all notice archive references. It also anonymously re-downloads all eight old assets and matches release/asset IDs, target/source, names, sizes, digests, timestamps and URLs to the saved pre-publication snapshot. A prerelease cannot be promoted as GitHub latest; use its exact versioned EXE URL. For a future release, deliberately update the version, tag, asset names and release notes; never move this tag or overwrite existing release assets. The publisher refuses mismatched source/assets. The old `windows-smoke.mjs`/temporary-account route and manual diagnostic workflow remain historical evidence, not a local invocation path.

Use the supported Sites workflow only when the served app changes; native test/documentation changes do not require republishing unchanged web assets.

## Platform Test Procedure

The Windows release job pins Rust **1.99.0**, whose compiler and standard-library notice layout was inspected. The native Save As dependency inventory is **234 crates, 113 original license texts, 24 platform files and five MPL archives**; all **554 installed notice file hashes** passed the isolated local installation gate. Retain the exact lockfile and original-text provenance; the current source/runtime evidence is in [verification](docs/verification.md).

The earlier published-preview collector passed locally with isolated, checksum-verified Rust/Cargo 1.99.0 and cargo-about 0.9.2: 226 crates, 110 original license texts, 24 platform files and five MPL archives. Independent output verification recomputed 533 file hashes and the unchanged then-current Cargo lock hash. That result verifies notice collection, not native compilation or runtime. The temporary metadata tooling lives only in ignored workspace cache; it did not install a system toolchain or MSVC. Future native builders should use the documented supported toolchain setup rather than depend on that cache.

Record OS, browser/version, headless/manual mode and input emulation. Layout classes include desktop 1600x1000, laptop 1280x800, tablet landscape 1024x768, tablet portrait 768x1024, phone portrait 390x844 and phone landscape 844x390. These are viewport checks, not physical-device certifications.

Cover open/navigation/close; search/results/clear; annotation/form export-reopen; duplicate widgets/radios; dirty close; protected/damaged input; print/download handoff; local library/recovery/conflicts/quota; account availability/capacity; OCR recognize/cancel/offline; organization output/refusal; certificate signing/cancel/tamper. Monitor external requests and uncaught errors. Inspect saved outputs with independent parsers/renderers and actual screenshots.

macOS WebKit CI, branded Safari, native wrappers, physical Android/iOS/iPadOS, printers and screen readers each need separate evidence. Read the latest run for the exact committed revision; historical Linux reader success does not establish the upgraded build. Workflow definitions cover Linux Chromium, macOS WebKit, core/signatures and native packaging, with current outcomes recorded only after they actually run.

## Source and Publishing Continuity

Current deployment v4 uses Site commit `63dd341f02c4aa1de98ec82dc657a3c751507be7`, with tree `52a2f8f0546f5301f9145fb27875911f49f8b2f8` identical to GitHub merge `8b9f1683bf0c47b9c8b2da4d638168c4a1e3b00f`. Deployment `appgdep_6ac13ecd06308191bb865188a4e9c0d6` succeeded at 2026-10-03 17:43:53 UTC. Reader CI passed on Linux Chromium/macOS WebKit; Windows/macOS packaging and the Windows installed-reader release gate passed. Later documentation-only commits do not alter the application inputs recorded for that v4/0.1.1 milestone. The 0.1.2 desktop delivery requires its own completed source/runtime/public-download record before publication or promotion; no new website deployment is inferred. Preserve Site ancestry when reconciling with the authoritative GitHub source; verify tree equality before publishing.

The Sites 0.1.75 workflow calls a Bash archive wrapper even on Windows. Ensure a real Bash executable is on the invoking process PATH. In this session the already-present portable Git Bash was under `.cache/portable-git/bin`; this ignored tool cache is not a guaranteed future prerequisite. The first v3 attempt successfully built/pushed source but failed archive startup because Bash was absent from PATH. Packaging was completed using the same bundled `prepare-site-build.cjs` validator, preserved hosting metadata/migrations, and Windows `tar.exe`; the unchanged source push and archive entries were independently checked before saving/deploying. The resulting archive was accepted. Do not substitute an unchecked source ZIP for the built Worker/client archive.

Local WebKit tests use the already-installed browser cache through `PLAYWRIGHT_BROWSERS_PATH`; this session's location is `.cache/playwright`. A missing default-path browser was corrected by selecting that cache before the hosted ink regression passed. These temporary tooling paths are not application dependencies.

Historical deployment v2 used Site source commit `cae5f95b0255f6278c485c78da834adf606e6a60` and GitHub commit `710ff978c4f59b907bce108921ade34b6d2b5326`, with identical verified tree `09642b4ac086bf603510c5fc75fcf1aa14862650`. Their commit histories differ because publishing retains Site-side ancestry. GitHub remains authoritative. Preserve Site ancestry on the local `site-publication` branch. The initial feature branch has been merged through PR #1. Start future work from the actual fetched GitHub `main`; preserve local milestone branches and do not reset or rewrite their history. Before future publishing, merge/reconcile `site-publication` with the current GitHub feature/main history; do not force-push or overwrite either history because trees matched once. Later delivery/documentation revisions must be identified separately in the delivery record. A documentation-only `[skip ci]` commit may retain evidence for the unchanged tested application inputs; never claim that its new HEAD independently passed CI. Do not republish unchanged application code solely to update unserved engineering records.

Live static responses bypass the worker's static-response headers on the current host: HTML metadata CSP and no-referrer metadata are confirmed, but HTTP CSP/frame-ancestors/nosniff and Referrer-Policy header enforcement need supported hosting configuration. Do not claim the worker header code or an unverified `_headers` file configures the live static service. Preserve document metadata CSP while resolving this platform gap.

## Document and Recovery Safety

Never overwrite original files or the only fixture copy. Keep the three mutation contracts separate:

- Reader forms/annotations: immutable snapshot, original-byte-prefix preservation, reopen/value/geometry checks; later edits remain dirty.
- Page organization: stricter eligibility, new page-only output, explicit metadata omission, every retained page compared after reopening; no original-prefix claim.
- Certificate signing: preserved input prefix, supported-input guards, independent CMS/byte-range/preservation verification; never imply trusted identity.

Background checkpoints do not flush an active editor or acknowledge a save. Defer unfinished drafts/strokes, atomically commit original/latest metadata and bytes, and reject stale revisions. On corruption, offer original recovery explicitly; never silently replace latest content. Keep prior committed copies after quota/failure. Browser termination before completion, eviction or profile clearing remains a loss risk.

Preserve dirty state on cancel/failure; download initiation is not disk completion. Keep inactive form hosts detached and read-only ResetForm blocked. Never bypass copy restrictions through OCR, drop refused organizer structures or weaken signature checks to accept an input.

## Dependency, License and Credential Policy

Review maintenance, advisories, platform compatibility and distribution obligations before consequential additions. Pin reader/viewer/worker/assets together and preserve lockfiles/notices. PDF.js 6.3.289 has no `isEvalSupported` option; do not invent it.

Review the OCR worker's version-sensitive protocol on upgrades. Preserve the full OCR model/native provenance and LibPDF's pinned FontBox Apache/PDFBox/BSD notices under `third_party/`; asset generation copies these alongside package notices. Audit embedded native dependencies as well as npm packages. Zero reported advisories is not a safety guarantee.

Never put tokens, passwords, private signing containers, certificates with private keys or production user data into source, example environments, shell command arguments or logs. Use supported secret facilities. If an authenticated CLI operation needs credentials, supply them through its supported stdin/secret mechanism, not a literal command line; do not echo stdin or credential values. Test certificates must be synthetic. User P12/password material remains memory-only.

## Offline Procedure

Native main-window startup uses `index.html?folio-native=1`: the immutable 0.1.1 worker ignores query URLs, so the new installed shell is fetched without a test reload. Native startup awaits retirement of only the current origin's root `/sw.js` registration when every active/waiting/installing worker has that exact script identity, then deletes only `folio-app-` static caches and verifies their absence. It captures exact owned installing workers before and during unregister acknowledgment, and waits until each reaches an installed/activating/activated/redundant state before deletion or reader import. An initially parsed or stuck worker remains pending under the same 10-second deadline; failure shows safe startup help, removes tracking listeners and fences later cleanup. Unrelated workers/caches, IndexedDB document/recovery records and preferences are preserved. Native main does not register a browser service worker; offline reader assets come from the installation. Ordinary website worker registration/caching remains unchanged.

Cleanup/capability failures stay before reader/storage initialization and show generic update/restart help with a guarded empty-window close. During reader import, startup listens for the explicit close-guard-ready handoff, which main emits synchronously after installing its persistent guard and before document handlers/initialization. An early missing/faulting module gets the empty close guard. A later fault after handoff preserves mounted documents, dialog/status elements and the normal unsaved-close guard; never replace that with an unconditional empty close or erase the reader DOM. Keep failure details/private names out of user help. Worker-preservation fixtures keep continuous same-origin clients because some ephemeral WebKit ports can lose unrelated CacheStorage responses when their last page closes, before Folio runs. A separate detached-worker regression measures exact native-page cache URLs/bodies before cleanup and requires their final preservation. It follows the actual captured worker state: a completed state requires reader startup and full cache retirement; a worker still parsed/installing at the original deadline requires safe help, no reader import or cache deletion, listener disposal and working guarded-close retry. Do not infer cache lifetime or settlement from an engine name. These HTTP fixtures do not substitute for actual persistent/default-profile Windows process-restart gates. Fresh source-matched Reader/native/candidate CI remains required.

Build the versioned service worker after assets. Keep matching cached HTML/resources on one build; do not force activation over open documents. Cache only app assets and the explicit optional OCR allowlist. User PDFs/Blob URLs and account API requests are excluded. Device PDF recovery belongs to its separate opt-in IndexedDB store.

Verify online setup -> worker/cache ready -> offline reload -> local PDF render/navigation/search. For OCR, explicitly load the local engine/model first, then verify offline recognition and inspect cached URLs. The optional OCR offline workflow passed its browser checks; the actual second hosted deployment also passed Chromium offline reload and local recovery. Keep the canonical-redirect regression: redirected cached responses must be normalized before navigation fulfillment. Exact run evidence is in verification. This does not establish device eviction immunity or Safari/mobile parity.

## Release and Debugging Procedure

Before release: frozen install; type/unit/core/signing/E2E checks; production build; output/render/accessibility review; dependency/license/security review; requirements reconciliation and updated verification; coherent commits; actual GitHub synchronization/CI confirmation. Inspect deployed identity/database/header behavior separately. Native signing/notarization/updating, broader platform gates and original-source licensing remain release decisions.

Debug with synthetic reproductions, stack traces, worker errors, browser traces, saved-output inspection and profiler/render comparisons. Do not hide failures, log document contents/credentials or reclassify incomplete checks as passes. Keep factual limitations and remaining work in BACKLOG rather than undocumented chat memory.

### Historical Windows accessibility preview delivery

The earlier verified immutable release is `v0.1.1-preview.1`, with `Folio-0.1.1-Windows-x64-Setup.exe` and matching notices. At that publication, package, Tauri and Cargo application versions were 0.1.1; engine/dependency versions were unchanged. Current 0.1.2 delivery is described above and in the source-qualified delivery record. Release extraction keeps its exact four-file allowlist, and publication still requires exact-source Reader checks, installed Windows workflows, artifact digests and binary identity. The release notes are `docs/releases/windows-preview-2.md`. All four 0.1.1 public assets were downloaded and verified before updating README and installation links. For future releases, apply the same gate and never overwrite existing tags/assets.

### Accessibility verification and recovery notes

The current browser update is deployment v4. `docs/accessibility-verification-2026-10-03.json` records its exact source/build identity and both browser scan summaries. Run the repository browser suite against a production build; keep host preview failures separate from app failures. Safari's default macOS key convention uses Option-Tab for links; the full Tab navigation setting is documented in Help. Pointer-triggered dialog focus must be checked as well as keyboard activation. Windows runtime verification waits for a nonempty CIM process-image path within its existing startup bound before collecting version/profile/port evidence; a timeout is a failure, never an excuse to waive the native release gate.

### Published Windows upgrade check

Run this only in a clean Windows test session with no existing Folio installation or running Folio process. Local mode requires a normal, non-elevated user, readable Windows CIM process metadata and writable HKCU registration. It refuses an occupied target, reparse points and unrelated installed apps. Do not use a user's real profile to seed the test.

```sh
pnpm install --frozen-lockfile
pnpm fixtures
node tests/native/download-upgrade-installers.mjs
node tests/native/windows-upgrade.mjs .cache/public-windows-preview-0.1.0/Folio-0.1.0-Windows-x64-Setup.exe .cache/public-windows-preview-0.1.1/Folio-0.1.1-Windows-x64-Setup.exe
```

The download helper verifies fixed published installer digests; the test also verifies installed executable digests. It creates a temporary installation and synthetic WebView profile, seeds form/text-annotation recovery plus an unchanged mixed-page PDF, terminates the owned process job, verifies the durable 0.1.0 state after restarting, upgrades using the actual 0.1.1 installer, then checks stored bytes/metadata, visible reopening, exact-byte exports and another restart. Any recent-file metadata lost before the upgrade is reported separately. No mock application assets or user PDFs are used.

`.github/workflows/windows-upgrade.yml` runs the same check with `--ci` only on this repository's disposable GitHub-hosted Windows runner. CI uses the existing per-executable WebView2 overrides and owned-job cleanup. Never spoof CI environment variables locally. Reports and synthetic outputs live in `test-results/native-windows-upgrade-*`; Playwright can clear `test-results`, so copy important evidence before running a separate browser suite. The owned uninstaller uses `/UPDATE` to avoid deleting application data; synthetic profiles remain for inspection. Installer-location hints may remain, so use a disposable session for installation tests.

This is a test-only path. Do not publish a new release or replace existing tags/assets for an unchanged application. Review native-workflow changes through a PR; matching `tests/native/**` main pushes verify the installer but cannot publish. The explicit publication policy has regression coverage in `tests/unit/windows-release-policy.test.mjs`.

### Source-bound candidate upgrade gate

The current release workflow separately invokes `node tests/native/windows-upgrade.mjs --ci-candidate <pinned-published-0.1.1-installer>`. This mode is restricted to the genuine disposable GitHub-hosted Windows account. It binds version 0.1.2, installer/build/installed EXE hashes and source checkout to the fixed current build output, verifies an empty genuine default app profile before installation, and captures actual normal installer-created Start-menu shortcuts. The source-bound report is `test-results/native-windows-candidate-upgrade/report.json`; do not substitute historical 0.1.0-to-0.1.1 evidence. Both upgraded launches must show the current Save As interface at exact `/index.html?folio-native=1` on their first navigation, with zero Folio root workers/app caches, before the harness's existing controlled reload. The pure release gate requires these two typed source-bound frontend-delivery records (launches 2 and 3) as well as all document preservation, receipt and cleanup checks.

Path safety reads use literal `Get-Item -Force` so hidden/system ancestors remain inspectable while every reparse-point refusal is retained. The regression creates only a fresh `FolioPathGuard-*` beneath the exact .NET temporary directory reported by the same PowerShell runtime, proves the unforced hidden read fails, and proves the production ancestor checker accepts that ordinary hidden path but rejects an owned junction. Shortcut cleanup rechecks exact owned path/target/hash immediately before literal removal; it never deletes containing folders or profiles. Registry policy cleanup removes only the exact captured owned values after comparison. No execution-policy changes, global UI input or test-only production save destinations are permitted.
