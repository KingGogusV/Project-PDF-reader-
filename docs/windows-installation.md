# Install Folio on Windows

Folio targets **Windows x64 Intel/AMD PCs**. No ChatGPT account, subscription,
Node.js, Rust or developer tools are needed for local PDFs or optional device storage.

**Publication status:** actual Windows native checks passed; public delivery is
pending release validation. No public EXE has been released yet.
Check [GitHub Releases](https://github.com/KingGogusV/Project-PDF-reader-/releases)
or use the [website](https://folio-local-pdf.gogoi-ronnie.chatgpt.site).

Once published, choose **Folio-0.1.0-Windows-x64-Setup.exe**, open it and follow
the installer, then open **Folio** from Start. The source-code ZIP is for developers.
The installer includes original dependency notices and covered source archives.
Release checksums and provenance identify the exact binary and verification run.

The installer uses Microsoft's WebView2 Runtime. Obtaining it requires internet
if it is missing. Core PDF work remains local afterward.

This is an **unsigned development preview**, not a signed production release.
Windows may show an unknown-publisher or reputation warning. Verify the GitHub
source and checksum; do not disable Windows protections. Use the website if
your device's policy blocks unsigned applications.

## Documents and accounts

- The desktop preview operates as a guest reader. Only optional website accounts
  use managed ChatGPT/OpenAI sign-in; reading and device storage need no account.
- **Store on this device** keeps unencrypted copies in the app profile, separate
  from website storage. It does not synchronize devices.
- Export creates a new PDF copy. Keep external backups before uninstalling or
  clearing storage. A crash before a completed checkpoint can lose recent edits.
- File associations, atomic native overwrite, OS sharing and automatic updates
  are absent. Native printing remains a verification gap.

## Verified evidence

On 2026-10-03 the checksum-verified installer from application source
`85cc5de6378e64372549fb298d383374c74a488a` passed 12 checks on Windows
10.0.22621 x64 / WebView2 154.0.4258.53: real rendering, search, storage consent,
original preservation, form and text-annotation export/reopen, and recovery after
terminating and restarting the entire owned app/WebView process job. Both jobs
emptied. All 533 installed notice hashes matched.

The earlier custom-account CI failure did not reproduce in the normal user
session. The revised same-account CI route subsequently passed all 12 checks and cleanup
in run 37118654858. Preparation then failed a separate validation gate.
The OS-close correction subsequently passed all 14 native checks locally and in
CI, including cancel and explicit-discard flows. Packaging identity was traced to
Tauri's exact NSIS marker patch; revised publication validation remains pending. See [verification](verification.md) and
[native evidence](native-windows-2026-10-03.json).

These checks do not certify every Windows version, ARM emulation, physical
printing, native file-picker interaction or assistive technology. File selection
was automated through the installed app's actual HTML input.

## Developer verification

The workflow installs in a fresh disposable runner directory, then runs
`node tests/native/windows-app-smoke.mjs`. Only on elevated disposable CI,
the helper uses documented executable-scoped WebView2 profile/debugging policy,
then removes its exact values. It never disables the sandbox, sets wildcard
policy or embeds debugging configuration in the shipped application. Actual
profile/port identity and process/policy cleanup must all pass.

For an already installed, checksum-verified preview in an isolated temporary
folder, a normal non-elevated user can run:

```sh
node tests/native/windows-app-smoke.mjs --local <absolute-installed-exe-path> <expected-exe-sha256>
```

Local mode changes no registry policy, creates a fresh synthetic-data profile,
and does not install/uninstall applications. See [maintenance](../MAINTENANCE.md)
for prerequisites and exact release gates. The older custom-account diagnostic
scripts remain historical CI-only tools; never spoof their environment guards.

For removal, export important documents, then use **Windows Settings > Apps >
Folio > Uninstall**. Report the Windows version, installer filename and error;
use synthetic documents instead of private PDFs.
