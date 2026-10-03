# Maintenance

Updated: **2026-10-03 UTC**. The connected GitHub repository is the authoritative source. The existing workspace/hosting manifest belongs to this project; do not create a second application or replace established resources merely to deploy.

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

The Tauri wrapper shares `dist/client`; its single local-main-window command `finish_close` completes the shared save/discard workflow. No filesystem/shell/network plugins are granted. Preserve the generated command ACL and actual OS-close regression gate. Actual convenience scripts are `pnpm native:dev` and `pnpm native:build`. Use explicit platform bundles and a locked dependency graph for repeatable packaging:

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

The inspected Windows environment has an isolated Rust tool cache but lacks MSVC and Windows SDK; WebView2 alone does not permit a local build. The checksum-verified CI installer was installed and tested locally without compiler SDKs. Remote run 37091186893 successfully built both Windows NSIS and macOS app/DMG; silent Windows installation was later verified in run 37101691271, while later Windows runtime checks passed as recorded in verification; macOS runtime and signing/notarization remain unverified. See [native prerequisites and runtime gates](src-tauri/README.md). Test custom-origin workers, local opening, PDF export/print, recovery, accounts and offline behavior on actual Windows/macOS wrappers before release.

## Windows Download Release Pipeline

The published unsigned x64 prerelease is [`v0.1.0-preview.1`](https://github.com/KingGogusV/Project-PDF-reader-/releases/tag/v0.1.0-preview.1). Native reader/close, strict packaging identity and publication gates passed. Reproduce the build with:

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

The shared test checks real rendering, form fields, storage consent, immutable originals, search, form/annotation PDF downloads and independent reopen. It terminates the entire owned app/WebView job after a verified form checkpoint, restarts it, and checks recovery. This establishes completed-checkpoint recovery, not recovery of unfinished drafts or writes. The current gate additionally sends OS close requests to the exact owned process and requires cancellation to preserve edits, then explicit discard to exit cleanly. Natural exit is permitted only after the test marks an expected confirmed close. Printing and native file-picker UI interaction remain separate tests; file selection uses Playwright's real input mechanism.

Release preparation compares every installed/build EXE byte with only the pinned Tauri NSIS marker transformation permitted, exact source revision, native pass and both cleanup records. Main-only publication also checks exact-source Reader CI, archive digest, bounded payload inventory, checksums and tag identity. Draft retries never overwrite conflicting assets. Anonymous downloads of all four preview assets were verified before linking README. For a future release, deliberately update the version, tag, asset names and release notes; never move this tag or overwrite existing release assets. The publisher refuses mismatched source/assets. The old `windows-smoke.mjs`/temporary-account route and manual diagnostic workflow remain historical evidence, not a local invocation path.

Use the supported Sites workflow only when the served app changes; native test/documentation changes do not require republishing unchanged web assets.

## Platform Test Procedure

The Windows release job pins Rust **1.99.0**, whose compiler and standard-library notice layout was inspected. The complete collector passed locally with isolated, checksum-verified Rust/Cargo 1.99.0 and cargo-about 0.9.2: 226 crates, 110 original license texts, 24 platform files and five MPL archives. Independent output verification recomputed 533 file hashes and the unchanged Cargo lock hash. This verifies notice collection, not native compilation or runtime. The temporary metadata tooling lives only in ignored workspace cache; it did not install a system toolchain or MSVC. Future native builders should use the documented supported toolchain setup rather than depend on that cache.

Record OS, browser/version, headless/manual mode and input emulation. Layout classes include desktop 1600x1000, laptop 1280x800, tablet landscape 1024x768, tablet portrait 768x1024, phone portrait 390x844 and phone landscape 844x390. These are viewport checks, not physical-device certifications.

Cover open/navigation/close; search/results/clear; annotation/form export-reopen; duplicate widgets/radios; dirty close; protected/damaged input; print/download handoff; local library/recovery/conflicts/quota; account availability/capacity; OCR recognize/cancel/offline; organization output/refusal; certificate signing/cancel/tamper. Monitor external requests and uncaught errors. Inspect saved outputs with independent parsers/renderers and actual screenshots.

macOS WebKit CI, branded Safari, native wrappers, physical Android/iOS/iPadOS, printers and screen readers each need separate evidence. Read the latest run for the exact committed revision; historical Linux reader success does not establish the upgraded build. Workflow definitions cover Linux Chromium, macOS WebKit, core/signatures and native packaging, with current outcomes recorded only after they actually run.

## Source and Publishing Continuity

Current deployment v3 uses Site commit `e3437ffb0d6e45b469f167845c009b2ee24f28e5` and GitHub application commit `85cc5de6378e64372549fb298d383374c74a488a`, with identical tree `8fcd7d07f26969320f361319b9d317930bd136f6`. Deployment `appgdep_6ac0a0deb3108191a9fbce3e650d4019` succeeded at 2026-10-03 06:30:01 UTC. Source-matched Reader CI and native packaging passed; the separate Windows runtime release gate failed and did not publish an EXE. Later Windows changes and their published source are recorded in verification. Website v3 remains on the stated source; native close/release changes did not require republishing the unchanged browser workflows. Documentation-only commits are not separately tested application builds.

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

Build the versioned service worker after assets. Keep matching cached HTML/resources on one build; do not force activation over open documents. Cache only app assets and the explicit optional OCR allowlist. User PDFs/Blob URLs and account API requests are excluded. Device PDF recovery belongs to its separate opt-in IndexedDB store.

Verify online setup -> worker/cache ready -> offline reload -> local PDF render/navigation/search. For OCR, explicitly load the local engine/model first, then verify offline recognition and inspect cached URLs. The optional OCR offline workflow passed its browser checks; the actual second hosted deployment also passed Chromium offline reload and local recovery. Keep the canonical-redirect regression: redirected cached responses must be normalized before navigation fulfillment. Exact run evidence is in verification. This does not establish device eviction immunity or Safari/mobile parity.

## Release and Debugging Procedure

Before release: frozen install; type/unit/core/signing/E2E checks; production build; output/render/accessibility review; dependency/license/security review; requirements reconciliation and updated verification; coherent commits; actual GitHub synchronization/CI confirmation. Inspect deployed identity/database/header behavior separately. Native signing/notarization/updating, broader platform gates and original-source licensing remain release decisions.

Debug with synthetic reproductions, stack traces, worker errors, browser traces, saved-output inspection and profiler/render comparisons. Do not hide failures, log document contents/credentials or reclassify incomplete checks as passes. Keep factual limitations and remaining work in BACKLOG rather than undocumented chat memory.
