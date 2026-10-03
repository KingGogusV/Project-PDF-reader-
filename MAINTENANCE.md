# Maintenance

Updated: 2026-10-02, America/Los_Angeles.

## Startup Procedure

Read PROJECT.md, this file and ARCHITECTURE.md; review recent CHANGELOG.md, relevant BACKLOG.md, requirements and verification. Inspect git status/branch/remotes/history. Run practical baseline checks before consequential changes. Preserve existing work and update affected records after verification.

## Build Procedure

Recorded toolchain: Node 24, pnpm 11.25.0. No native SDK target exists.

~~~sh
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm preview
~~~

dev copies self-hosted engine assets, generates fixtures/demo, then starts Vite on loopback. test regenerates fixtures and runs tests/unit/*.test.mjs. build copies assets, generates fixtures, type-checks, builds static output and generates the service worker. preview serves the production build.

pnpm assets and pnpm fixtures run the generators individually. No standalone lint/native-run/native-package command exists. Generated binaries/assets, dependencies, builds and reports are ignored; preserve generators and lockfile.

### Browser workflows

Build first and start pnpm preview in another terminal, then run pnpm test:e2e. Default channel: installed Microsoft Edge.

~~~powershell
$env:E2E_BROWSER_CHANNEL = 'chrome'
pnpm test:e2e
~~~

Channels: chrome, msedge or chromium. Bundled Chromium requires pnpm exec playwright install chromium. CI uses install --with-deps chromium on Linux.

Set E2E_START_SERVER=1 to let Playwright start the already-built preview automatically. Default URL: http://127.0.0.1:4173; E2E_BASE_URL overrides it. One worker runs tests. Do not drive another session's browser context.

Ordinary E2E blocks service workers to avoid stale caches; offline testing enables workers separately.

### Encrypted fixtures

The generator detects the bundled Python runtime or FOLIO_PYTHON. Encryption requires pypdf/cryptography; CI pins 6.10.0/50.0.1 respectively. If unavailable, generation explicitly reports missing encrypted coverage. Record skips; missing fixtures are not passing password tests.

## Platform Test Procedure

Record OS, browser/version, headless/manual mode, viewport and touch emulation. Six classes: 1600×1000 desktop, 1280×800 laptop, 1024×768 tablet landscape, 768×1024 tablet portrait, 390×844 phone portrait, 844×390 phone landscape. These are layouts, not device certifications.

Verify open/navigation/close; search/results/clear; annotation/form export-reopen; print-copy handoff; malformed/protected input; duplicate-widget/radio documents; dirty close/reload; storage denial; hostile actions and adaptive controls. Preserve independent saved-field/parser checks. A parser or build pass does not prove visual fidelity.

Actual Safari/macOS/mobile, interactive Linux desktop, printer, stylus and screen-reader checks require separate evidence. Headless Linux Chromium CI is verified; see docs/verification.md. Confirm real CI outcomes instead of inferring them from a workflow.

## Document Safety Rules

Never overwrite fixtures/originals. Flush pending editor/form state before close/unload/export. Serialize exports with an immutable snapshot; edits made during serialization stay dirty. Reopen output and confirm persisted changes, original-byte prefix, page count/geometry and unaffected content.

Download initiation is not completed saving. Preserve dirty state after failure/cancel and require saved-copy acknowledgment. Do not bypass restrictions or claim certificate validity. Keep inactive form hosts detached; regression-test matching field IDs/radio names. Intercept read-only ResetForm as well as script/launch actions.

## Dependency Policy

Review maintenance, advisories, license obligations, browser/mobile support and alternatives before consequential additions. Pin and match engine/display/viewer/worker versions; preserve notices and lockfile. Zero advisories is not proof of safety.

PDF.js 6.3.289 no longer exposes isEvalSupported. Use actual pinned APIs; scripting is excluded through integration and omitted resources, not a fictitious switch.

## Offline Procedure

Build the versioned worker after static assets. Keep cached HTML and matching resources on one version; do not combine new network HTML with old stable engine paths. Do not force activation over open documents. Cache app assets only, never user PDFs.

Verify production load → worker/cache ready → network offline → reload → choose local PDF → render/navigate/search. Inspect cached URLs. First setup needs network; offline caching does not persist unsaved documents.

## Release Procedure

Current output is a static build and repository implementation, not a hosted production/native release. Before release: frozen install; unit/type/browser checks; production build; dependency audit/notices; requirements reconciliation; updated verification; coherent commit. Confirm actual GitHub source synchronization and Reader checks result.

Deployment, installers/signing/updates and public-source licensing need separate decisions. UNLICENSED is intentional until the owner selects a license.

## Debugging Guidelines

Use synthetic reproductions, stack traces, worker errors, browser traces, saved-output inspection and visual/profile comparisons. Do not hide errors or log document contents/passwords. Separate startup/first-page/search timings from test duration. Keep remaining failure evidence and backlog accurate.
