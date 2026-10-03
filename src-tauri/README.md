# Experimental desktop wrapper

The [Windows preview](https://github.com/KingGogusV/Project-PDF-reader-/releases/tag/v0.1.0-preview.1) is published and its actual reader/export/recovery/OS-close checks passed locally and in CI. [Installation help](../docs/windows-installation.md) contains the direct EXE and checksum. macOS packaging passed; macOS native runtime remains unverified. Older diagnostics below describe historical sources.

This Tauri 2 shell embeds the existing `dist/client/` web app and its local PDF.js worker.
It adds no separate document engine. Its only command, `finish_close`, is limited
to the local main window and completes the shared save/discard flow after a native
close request. `capabilities/default.json` grants only `allow-finish-close`;
no filesystem, shell or network plugin is enabled. Ordinary
HTML file inputs remain the initial opening mechanism; native file associations,
atomic native saves, OS share sheets and automatic updates are not implemented.
Do not register it as a default PDF handler until those lifecycle paths are tested.

The app identifier `app.folio.localreader` is an internal development identifier,
not evidence of a registered product name or domain. Final release identity and
signing arrangements remain a release decision.

## Commands

- `pnpm exec tauri dev` builds/runs the wrapper and starts `pnpm dev`.
- `node node_modules/@tauri-apps/cli/tauri.js build --no-sign --bundles nsis -- --locked`
  builds the unsigned Windows NSIS installer with locked Cargo dependencies.
- `node node_modules/@tauri-apps/cli/tauri.js build --no-sign --bundles app,dmg -- --locked`
  builds unsigned macOS artifacts on a Mac with locked Cargo dependencies.
- `pnpm exec tauri icon public/icon.svg --output src-tauri/icons` regenerates
  icons from Folio's original existing SVG. Extra generated platform icon files
  are not required for these initial desktop targets.

The CLI is pinned in the root package manifest; direct Rust crates are pinned in
`Cargo.toml`. The verified generated `Cargo.lock` is now retained in source;
preserve it and review any dependency-resolution change. Native CI build success establishes compilation/packaging, not runtime
document correctness, installer trust or release readiness.

`.github/workflows/native-build.yml` defines Windows and macOS jobs using Node 24,
pnpm 11.25.0 and stable Rust. The job generates `Cargo.lock` only when absent, then
runs `cargo metadata --locked` followed by
`node node_modules/@tauri-apps/cli/tauri.js build --no-sign --bundles nsis -- --locked` (Windows), or the
same build command with `--bundles app,dmg` (macOS).
The final `-- --locked` forwards dependency locking to Cargo. Invoke Node directly
for this command: the pnpm wrapper on Windows consumed the separator in the first
CI run, causing argument parsing to fail before compilation.

The workflow collects `src-tauri/target/release/bundle/nsis/*.exe` on Windows and
`src-tauri/target/release/bundle/dmg/*.dmg` on macOS. It archives the `.app` as a
tarball to preserve executable permissions. Cargo's lockfile and resolved
dependency metadata are separate artifacts for inspection. The successful final
run below establishes compilation and package availability; it does not establish
installer execution or application runtime.
These are unsigned development packages; no signing credentials are configured.

## Prerequisites and current evidence

[Native run 37091186893](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37091186893)
succeeded on both Windows and macOS after the direct-Node argument-forwarding fix.
Unsigned development packages are available until **2026-10-17**:

- [Windows NSIS artifact](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37091186893/artifacts/11262104539)
- [macOS app/DMG artifact](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37091186893/artifacts/11261664576)

ZIP sizes and verified SHA-256 hashes are in [verification](../docs/verification.md).
Downloads may require GitHub access. The earlier run 37088665153 built macOS but
stopped on Windows before compilation; the final successful run supersedes that
failure. Subsequent Windows installation and actual reader/export/recovery checks passed as recorded below; macOS runtime, signing and notarization remain unverified.

The Windows environment has WebView2 154.0.4258.53 and an isolated Rust tool cache, but lacks MSVC/Windows SDK for local compilation. The CI-built installer was checksum-verified, installed in a temporary directory and tested in the normal Windows user session. Twelve checks passed, including form/annotation export/reopen and completed-checkpoint recovery after full process termination. Both owned jobs emptied and all 533 installed notice hashes matched. See [verification](../docs/verification.md).

The current reusable test is `tests/native/windows-app-smoke.mjs`; local mode requires a temporary installation, expected EXE hash and non-elevated user. CI mode uses documented executable-scoped WebView2 debugger/profile policy only on disposable elevated runners. Policy/process cleanup and actual installed/build byte identity are release gates. The corrected gate and public preview publication passed.

Official sources checked 2026-10-03:

- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Tauri configuration](https://v2.tauri.app/reference/config/)
- [Tauri MIT license](https://github.com/tauri-apps/tauri/blob/dev/LICENSE-MIT)
- [Tauri Apache 2.0 license](https://github.com/tauri-apps/tauri/blob/dev/LICENSE-APACHE-2.0)

Tauri's Rust/CLI components offer MIT OR Apache-2.0 licensing. The Windows native
notice collector has now been run and independently checked with the committed
Cargo lockfile, Rust/Cargo 1.99.0 and cargo-about 0.9.2: **226 crates, 110 original
license texts, 24 platform records and five MPL source archives**. Independent
verification recomputed 533 output hashes and the unchanged lockfile hash. This
establishes notice collection; it does not establish native compilation, runtime
correctness or publication of the planned Windows preview.

`node scripts/native-notices.mjs src-tauri/generated-notices` creates the reviewed
notices in a fresh output directory. The Windows release configuration bundles
them as `third-party-notices`; its release workflow gates publication on the
actual installed-app smoke result and exact-source reader checks. See
[maintenance](../MAINTENANCE.md#windows-download-release-pipeline) for commands
and provenance requirements.

Windows uses WebView2 and Apple platforms use WKWebView; their version/platform
behavior must be tested separately. This wrapper is not a verified iOS/Android
application.

## Required native runtime verification

Open local, encrypted, restricted and signed synthetic PDFs; search and render;
fill forms; annotate; export and independently reopen; close with unsaved work;
check Blob downloads/print windows and external links; open offline; verify worker
and WebAssembly loading under the packaged CSP. Test on Windows and macOS
separately. Actual Windows reader/export/recovery tests passed locally and in CI;
release validation and public preview publication passed.

The historical, superseded Windows CI launcher created a temporary Users-only account,
loads its profile using only scoped privileges already assigned to the runner,
and launches on a private desktop with a separate environment. It checks the
suspended child's unrestricted, non-elevated Medium token before resuming, then
checks WebView2's actual data directory/debugging port. Plain `STARTUPINFO` does
not inherit standard handles; browser logs and owned-process diagnostics are
retained. Cleanup must empty the owned job, close the private desktop, unload and
delete the exact temporary profile, and remove the name/SID-matched account.
The replaced same-user restricted-token attempt is not passing runtime evidence. Both standard-user token and credential launch attempts also failed before CDP/reader startup with WebView2 ProcessSingleton errors; silent installation passed. These historical failures were superseded by the same-account owned-job route: its 12 native checks and cleanup passed. Native close safety and the corrected release identity gate subsequently passed; the Windows preview is published.
See the [Windows verification procedure](../docs/windows-installation.md#developer-verification).

The browser service worker, browser account redirects, downloads and popups may
behave differently under custom WebView origins. Do not weaken CSP or grant broad
filesystem/shell permissions merely to make a browser path work. Add narrowly
scoped platform adapters only after a concrete runtime failure is reproduced.
