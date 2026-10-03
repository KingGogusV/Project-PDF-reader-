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

`preview` serves the already-built static client, normally at `http://127.0.0.1:4173`. It does **not** run the managed identity dispatcher or account database. Guest workflows remain available; account-service unavailability here is expected, not evidence of a broken hosted deployment. During this work session a preview terminal is already running on port 4173; coordinate before starting another process. Do not rebuild or replace served files while another agent/test is using that preview.

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

Hosting uses the existing Sites project/manifest and its supported deployment tooling; no local deploy command is defined in package.json. Build and review concrete artifacts first, then use the authorized project deployment flow and inspect terminal status/live behavior. Do not invent a URL, migration success or authentication test. Deployment v1 succeeded at [Folio](https://folio-local-pdf.gogoi-ronnie.chatgpt.site), and upgraded Reader/native CI passed. Live online reading/recovery, anonymous account responses and spoofed-identity refusal passed; actual managed account sign-in remains unverified. Hosted offline reload exposed a separate failure under investigation. Exact runs and delivery identities are in verification.

The 200-account ceiling concerns registered accounts, not measured concurrent traffic. Account rows do not contain PDFs. PDFs remain opt-in, unencrypted, device-local; sign-in on another device does not synchronize them.

## Experimental Native Commands

The Tauri wrapper shares `dist/client`, with no privileged commands/plugins. Actual convenience scripts are `pnpm native:dev` and `pnpm native:build`. Use explicit platform bundles and a locked dependency graph for repeatable packaging:

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

The inspected Windows environment lacks Rust/cargo, MSVC and Windows SDK; WebView2 alone does not permit a build. No local native build/runtime is claimed. Remote run 37089902268 successfully built both Windows NSIS and macOS app/DMG; installation/runtime and signing/notarization remain unverified. See [native prerequisites and runtime gates](src-tauri/README.md). Test custom-origin workers, local opening, PDF export/print, recovery, accounts and offline behavior on actual Windows/macOS wrappers before release.

## Platform Test Procedure

Record OS, browser/version, headless/manual mode and input emulation. Layout classes include desktop 1600x1000, laptop 1280x800, tablet landscape 1024x768, tablet portrait 768x1024, phone portrait 390x844 and phone landscape 844x390. These are viewport checks, not physical-device certifications.

Cover open/navigation/close; search/results/clear; annotation/form export-reopen; duplicate widgets/radios; dirty close; protected/damaged input; print/download handoff; local library/recovery/conflicts/quota; account availability/capacity; OCR recognize/cancel/offline; organization output/refusal; certificate signing/cancel/tamper. Monitor external requests and uncaught errors. Inspect saved outputs with independent parsers/renderers and actual screenshots.

macOS WebKit CI, branded Safari, native wrappers, physical Android/iOS/iPadOS, printers and screen readers each need separate evidence. Read the latest run for the exact committed revision; historical Linux reader success does not establish the upgraded build. Workflow definitions cover Linux Chromium, macOS WebKit, core/signatures and native packaging, with current outcomes recorded only after they actually run.

## Source and Publishing Continuity

Deployment v1 used Site source commit `f7734929de58e05f280b536fbcd20b875a423221`; the corresponding GitHub commit is `6033dbf3546b0eef776507bc50b14ee354ca6273`. Their source trees were verified identical, but commit histories differ because the Site added a source commit. GitHub remains authoritative. Before future publishing, inspect both histories and merge/reconcile ancestry; do not force-push or overwrite either history because trees matched once. Later delivery/documentation revisions must be verified separately in the delivery record.

Live static responses bypass the worker's static-response headers on the current host: HTML metadata CSP was confirmed, but HTTP CSP/frame-ancestors and Referrer-Policy enforcement need supported hosting configuration. Do not claim the worker header code or an unverified `_headers` file configures the live static service. Preserve document metadata CSP while resolving this platform gap.

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

Verify online setup -> worker/cache ready -> offline reload -> local PDF render/navigation/search. For OCR, explicitly load the local engine/model first, then verify offline recognition and inspect cached URLs. The optional OCR offline workflow has now passed its browser checks; exact run evidence is in verification. This does not establish device eviction immunity or Safari/mobile parity.

## Release and Debugging Procedure

Before release: frozen install; type/unit/core/signing/E2E checks; production build; output/render/accessibility review; dependency/license/security review; requirements reconciliation and updated verification; coherent commits; actual GitHub synchronization/CI confirmation. Inspect deployed identity/database/header behavior separately. Native signing/notarization/updating, broader platform gates and original-source licensing remain release decisions.

Debug with synthetic reproductions, stack traces, worker errors, browser traces, saved-output inspection and profiler/render comparisons. Do not hide failures, log document contents/credentials or reclassify incomplete checks as passes. Keep factual limitations and remaining work in BACKLOG rather than undocumented chat memory.
