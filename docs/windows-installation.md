# Install Folio on Windows

Folio 0.1.0 is an experimental desktop release. The Windows package targets
**x64 PCs (64-bit Intel/AMD)**; a native ARM64 or 32-bit Windows package is not
included. You do not need Node.js, Rust, Visual Studio, a Folio account or a
ChatGPT account.

1. [Download the Windows installer](https://github.com/KingGogusV/Project-PDF-reader-/releases/download/v0.1.0-preview.1/Folio-0.1.0-Windows-x64-Setup.exe).
2. Open the downloaded installer and follow its steps. The current package uses
   installation for your Windows user account.
3. Open **Folio** from Start. Try the included demo, or choose a local PDF.

[Release notes, checksums and notices](https://github.com/KingGogusV/Project-PDF-reader-/releases/tag/v0.1.0-preview.1) are on GitHub. The source-code ZIP is for developers, not installation.

The installer uses Microsoft's WebView2 Runtime. If it is missing, the installer
downloads Microsoft's bootstrapper, so an internet connection may be needed for
initial installation. Core PDF processing is local; installation dependencies
are separate from document processing.

## What to expect

- Reading requires no sign-in. The packaged app provides guest local reading;
  managed account access belongs to the hosted website.
- **Store on this device** is optional. Those copies stay in the app's local
  profile, are not encrypted by Folio, and do not synchronize across devices.
  Keep separately exported backups of important documents.
- Save/export produces a new copy. File associations, native atomic saves,
  operating-system sharing and automatic updates are not implemented.
- This development installer is **unsigned**. Windows may show an unknown
  publisher or reputation warning. Check that you downloaded it from this
  repository and compare its SHA-256 with the release checksum when provided.
  Do not disable Windows security protections to install it. The
  [web application](https://folio-local-pdf.gogoi-ronnie.chatgpt.site) is an
  alternative if your device's policy blocks unsigned applications.

## Verification status

[Build 37091186893](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37091186893)
successfully compiled and packaged the Windows installer from application
revision `710ff978c4f59b907bce108921ade34b6d2b5326`. Package creation alone does
not verify installation or PDF workflows in the native Windows app. See the
[verification record](verification.md) for current tested environments and known
limitations. Windows on ARM emulation and older Windows releases have not been
verified.

For removal, use Windows **Settings > Apps** and uninstall Folio. Export important
local documents before removing the app or clearing its storage. To report a
problem, include your Windows version, the installer filename and the error;
use a synthetic PDF rather than attaching private documents.

Installer behavior was checked against the repository's Tauri configuration and
the pinned CLI schema on 2026-10-03. See
[Tauri's Windows installer documentation](https://v2.tauri.app/distribute/windows-installer/)
for the current-user and WebView2 installation defaults.

## Native verification procedure

`tests/native/windows-smoke.mjs` is a bounded, CI-only test for a disposable
Windows GitHub Actions runner. It is not an end-user installation command.
The workflow installs the package beneath `RUNNER_TEMP` and passes the installed
`folio-desktop.exe` path through `FOLIO_NATIVE_EXE`, then runs:

```sh
node tests/native/windows-smoke.mjs
```

The script requires `GITHUB_ACTIONS=true` and `CI=true`, rejects an executable
outside `RUNNER_TEMP`, and launches only that executable with an isolated
WebView2 profile and process-scoped loopback debugging. It uses the
[official Playwright WebView2 integration](https://playwright.dev/docs/webview2).
There is no SDK installation, account substitution, CSP change or permission
expansion. Generated `form.pdf` and `text-outline.pdf` fixtures must already exist.

It checks nonblank PDF rendering, form edits, storage refusal/consent, immutable
original bytes, independently parsed checkpoint content, recovery after reloading
the native WebView, and search-result navigation. Nonlocal application HTTP and
WebSocket requests are blocked and treated as failures. This observes app traffic
from a controlled reload; it does not audit WebView2/OS update traffic or certify
physical offline behavior. It terminates only its owned process tree and retains
the isolated profile for debugging.

Screenshots, a synthetic recovery PDF, process output and `report.json` go to
`test-results/native-windows/`. The implemented test is **not a passed native
runtime result** until its actual CI execution succeeds. It does not cover every
installer dialog, printing, native download handoffs, updates or assistive tools.

### CI privilege preflight

GitHub's Windows hosted runners run as administrators with UAC disabled. Microsoft
WebView2 Runtime 150 intentionally ignores environment overrides in elevated hosts.
The test respects that restriction by reducing its own child's privileges, using
`CreateRestrictedToken` (`LUA_TOKEN` and `DISABLE_MAX_PRIVILEGE`), Administrators
deny-only membership, Medium integrity, and `CreateProcessAsUserW`. It checks
the actual suspended child token before resuming: same user, no elevation, no
enabled Administrators membership, and exactly Medium integrity. There are no
registry/policy changes, new accounts or disabled security features. Failure to
meet any invariant stops the test.

Before compiling an installer, CI can check that the runner supports this route
without launching any app:

```powershell
pwsh -NoProfile -File tests/native/windows-token-launch.ps1 -Mode Preflight
```

The optional `FOLIO_TOKEN_REPORT` points to a JSON output file in an existing
test-results directory. The smoke test also records nested CDP errors, WebView2
version and selected owned-process arguments, and verifies that the actual
runtime uses the requested isolated profile. Tokens, credentials and complete
process command lines are not logged. No native runtime pass is implied by a
successful token preflight.

Primary references checked on 2026-10-03:

- [GitHub hosted-runner privileges](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [Microsoft's Runtime 150 security-hardening explanation](https://github.com/MicrosoftEdge/WebView2Feedback/issues/5640#issuecomment-4923662109)
- [CreateRestrictedToken](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-createrestrictedtoken)
- [CreateProcessAsUserW](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessasuserw)
