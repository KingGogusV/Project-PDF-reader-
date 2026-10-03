# Experimental desktop wrapper

This Tauri 2 shell embeds the existing `dist/client/` web app and its local PDF.js worker.
It adds no separate document engine, no native commands and no privileged plugins.
`capabilities/default.json` deliberately grants zero IPC permissions. Ordinary
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
`Cargo.toml`. Commit the generated Cargo lockfile after the first verified native
build. Native CI build success establishes compilation/packaging, not runtime
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
dependency metadata are separate artifacts for inspection; retain the verified
lockfile in source control after a successful reproducible build. The workflow
definition alone does not establish that these jobs ran or artifacts were built.
These are unsigned development packages; no signing credentials are configured.

## Prerequisites and current evidence

The macOS job in [native build run 37088665153](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37088665153/job/111104088555)
completed release compilation and app/DMG packaging. The Windows job in that run
stopped before compilation because of the argument-forwarding issue described
above; the corrected direct-Node command requires a fresh CI run. No installer
execution, application runtime, signing or notarization claim follows from the
macOS packaging result.

The Windows work environment inspected on 2026-10-03 has no Rust/cargo, MSVC build
tools, Windows SDK, or Android SDK at their usual installation paths; commands are
also absent from PATH. No system SDK installation was attempted. A native binary
cannot be compiled or manually inspected locally in that environment. GitHub
hosted Windows/macOS runners can supply the corresponding native build toolchain.
`pnpm exec tauri info` independently confirmed the missing Rust/MSVC toolchain and
detected WebView2 154.0.4258.53 on Windows 10.0.22621 x64.

Official sources checked 2026-10-03:

- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Tauri configuration](https://v2.tauri.app/reference/config/)
- [Tauri MIT license](https://github.com/tauri-apps/tauri/blob/dev/LICENSE-MIT)
- [Tauri Apache 2.0 license](https://github.com/tauri-apps/tauri/blob/dev/LICENSE-APACHE-2.0)

Tauri's Rust/CLI components offer MIT OR Apache-2.0 licensing. Their complete
transitive notices still require collection for a distributed release. Windows
uses WebView2 and Apple platforms use WKWebView; their version/platform behavior
must be tested separately. This wrapper is not a verified iOS/Android application.

## Required native runtime verification

Open local, encrypted, restricted and signed synthetic PDFs; search and render;
fill forms; annotate; export and independently reopen; close with unsaved work;
check Blob downloads/print windows and external links; open offline; verify worker
and WebAssembly loading under the packaged CSP. Test on Windows and macOS
separately. No successful native runtime test is claimed by these files.

The browser service worker, browser account redirects, downloads and popups may
behave differently under custom WebView origins. Do not weaken CSP or grant broad
filesystem/shell permissions merely to make a browser path work. Add narrowly
scoped platform adapters only after a concrete runtime failure is reproduced.
