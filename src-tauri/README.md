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
- `pnpm exec tauri build --bundles nsis` builds the Windows NSIS installer.
- `pnpm exec tauri build --bundles app,dmg` builds macOS artifacts on a Mac.
- `pnpm exec tauri icon public/icon.svg --output src-tauri/icons` regenerates
  icons from Folio's original existing SVG. Extra generated platform icon files
  are not required for these initial desktop targets.

The CLI is pinned in the root package manifest; direct Rust crates are pinned in
`Cargo.toml`. Commit the generated Cargo lockfile after the first verified native
build. Native CI build success establishes compilation/packaging, not runtime
document correctness, installer trust or release readiness.

An initial GitHub Actions job should run on `windows-latest` or `macos-latest`,
install Node 24 plus the repository's pinned pnpm, install stable Rust with rustup,
then run `pnpm install --frozen-lockfile` followed by the matching build command
above. On Windows collect `src-tauri/target/release/bundle/nsis/*.exe`; on macOS
collect `src-tauri/target/release/bundle/dmg/*.dmg` and the `.app` inside
`src-tauri/target/release/bundle/macos/`. Retain Rust's generated lockfile as an
artifact for inspection and commit it only after a successful reproducible build.
These are unsigned development artifacts; no signing credentials are configured.

## Prerequisites and current evidence

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
