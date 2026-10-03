# Install Folio on Windows

Folio 0.1.0 is an experimental desktop release. The Windows package targets
**x64 PCs (64-bit Intel/AMD)**; a native ARM64 or 32-bit Windows package is not
included. You do not need Node.js, Rust, Visual Studio, a Folio account or a
ChatGPT account.

**Publication status:** native runtime verification and the downloadable prerelease
are pending. The release links below are the intended destinations; their presence
in this guide does not mean an installer has been published.

1. Once published, [download the Windows installer](https://github.com/KingGogusV/Project-PDF-reader-/releases/download/v0.1.0-preview.1/Folio-0.1.0-Windows-x64-Setup.exe).
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

The script requires `GITHUB_ACTIONS=true`, `CI=true` and
`RUNNER_ENVIRONMENT=github-hosted`, rejects an executable outside `RUNNER_TEMP`,
and launches only that executable under a fresh temporary standard Windows
account with an isolated WebView2 data directory and process-scoped loopback
debugging. It uses the
[official Playwright WebView2 integration](https://playwright.dev/docs/webview2).
It does not change CSP, application permissions or system security policies.
Generated `form.pdf` and `text-outline.pdf` fixtures must already exist.

It checks nonblank PDF rendering, form edits, storage refusal/consent, immutable
original bytes, independently parsed checkpoint content, recovery after reloading
the native WebView, and search-result navigation. Nonlocal application HTTP and
WebSocket requests are blocked and treated as failures. This observes app traffic
from a controlled reload; it does not audit WebView2/OS update traffic or certify
physical offline behavior. It terminates only its owned process job. The temporary
Windows account/profile are removed; the separate WebView2 test data directory
is retained for debugging on the disposable runner.

Screenshots, a synthetic recovery PDF, helper output, browser logs and `report.json` go to
`test-results/native-windows/`. The implemented test is **not a passed native
runtime result** until its actual CI execution succeeds. It does not cover every
installer dialog, printing, native download handoffs, updates or assistive tools.

### CI privilege preflight

GitHub's Windows hosted runners run as administrators with UAC disabled. Microsoft
WebView2 Runtime 150 intentionally ignores environment overrides in elevated hosts.
The launcher creates one temporary local Users-only account and obtains its token
through `LogonUserW`. It loads that account's Windows profile and uses a private
window station/desktop. The previous same-user restricted-token route did not
establish a working native runtime and is no longer the launcher implementation.

Profile loading/unloading temporarily enables only `SeBackupPrivilege` and
`SeRestorePrivilege` already assigned to the runner; it restores their prior
states afterward and fails if they are unavailable. It creates an environment
for the temporary account without inheriting the runner's environment, copying
only the explicit WebView2 settings and `RUST_BACKTRACE`.

`CreateProcessWithLogonW` uses plain `STARTUPINFO` without inherited standard
handles or extended attributes. Before resuming the suspended child, the helper
verifies the created SID, no elevation, exactly Medium integrity, enabled Users
membership, no Administrators SID, no token restrictions and no restricting SIDs.
The token decoder handles the actual API return length; genuine CI returned
`TokenHasRestrictions` length 1 and value 0. This is token evidence, not a native
application pass. Native stdout/stderr redirection is unavailable in this route;
browser file logging and owned-process diagnostics remain enabled.

If a write probe reports access denied, the helper may add a Modify rule for
that exact account only to the fresh, empty, non-reparse WebView2 test directory.
Existing rules are preserved, and a second probe must succeed. It does not change
ancestor-directory access or an existing user's profile. System policies and
application permissions remain unchanged.

Before compiling an installer, CI can check that the runner supports this route
without launching any app (this still creates and cleans up the temporary account,
profile and private desktop):

```powershell
pwsh -NoProfile -File tests/native/windows-token-launch.ps1 -Mode Preflight
```

The optional `FOLIO_TOKEN_REPORT` points to a JSON output file in an existing
test-results directory. It records the created account name/SID and token facts,
never the generated password or token handles. The smoke test records nested CDP
errors, WebView2 version and selected owned-process arguments, then verifies the
actual runtime's isolated data directory and loopback port.

Cleanup empties the owned kill-on-close job before unloading/deleting the exact
temporary Windows profile and removing the generated account with a name/SID
match. It also closes the private desktop/window station. A cleanup error fails
the test. Forced-stop fallback removes only that exact account and does not
claim successful profile cleanup. A successful preflight does not establish a
native runtime pass.

Maintainers may manually dispatch `windows-harness.yml` with a diagnostic artifact
ID, archive SHA-256 and source commit to compare launcher changes against an
unchanged installer. The script verifies artifact provenance, ancestry and allowed
source differences; changes to compiled application inputs require a new installer.
This diagnostic workflow neither publishes a release nor replaces its gates.

Primary references checked on 2026-10-03:

- [GitHub hosted-runner privileges](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [Microsoft's Runtime 150 security-hardening explanation](https://github.com/MicrosoftEdge/WebView2Feedback/issues/5640#issuecomment-4923662109)
- [CreateProcessWithLogonW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createprocesswithlogonw)
- [LoadUserProfileW](https://learn.microsoft.com/en-us/windows/win32/api/userenv/nf-userenv-loaduserprofilew)
- [CreateEnvironmentBlock](https://learn.microsoft.com/en-us/windows/win32/api/userenv/nf-userenv-createenvironmentblock)
