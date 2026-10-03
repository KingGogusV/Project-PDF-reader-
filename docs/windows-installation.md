# Install Folio on Windows

**[Download Folio-0.1.0-Windows-x64-Setup.exe](https://github.com/KingGogusV/Project-PDF-reader-/releases/download/v0.1.0-preview.1/Folio-0.1.0-Windows-x64-Setup.exe)**

1. Open the downloaded installer and follow its prompts.
2. Launch **Folio** from the Windows Start menu.
3. Choose **Open PDF**. No ChatGPT account, subscription, terminal, Node.js or Rust is needed for PDF reading or device storage.

This is an **unsigned Windows x64 Intel/AMD development preview**. Windows may show an unknown-publisher or reputation warning. Check the [GitHub release](https://github.com/KingGogusV/Project-PDF-reader-/releases/tag/v0.1.0-preview.1) and checksum. Do not disable Windows protections; use the [website](https://folio-local-pdf.gogoi-ronnie.chatgpt.site) if your device policy blocks unsigned applications. ARM emulation and all Windows versions have not been verified. The installer obtains Microsoft's WebView2 Runtime if missing; that initial setup needs internet.

## Documents and accounts

The desktop app is a guest reader. Only optional website accounts use ChatGPT/OpenAI sign-in. **Store on this device** keeps unencrypted originals/recovery copies in this app's profile; it does not synchronize with the website or other devices. Export creates a new PDF copy. Keep external backups before uninstalling or clearing storage. Forced termination before a completed checkpoint can lose recent work.

The window close button asks about unsaved edits. Choose **Keep open**, **Export copy**, **Keep in library** (when stored) or **Discard changes**. Export requires acknowledgment and returns to the document; close it again when finished. Native file associations, automatic updates and atomic overwrite are absent. Physical printing remains unverified.

## Checksums and verification

Installer: 17,844,743 bytes. SHA-256:

```text
ad33d489e9f317965b40fbc3ad473ddaa2883e503e8bd4c46e30c756414120ac
```

Use Windows PowerShell to compare your download:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath .\Folio-0.1.0-Windows-x64-Setup.exe
```

The release includes `SHA256SUMS.txt`, `release-provenance.json` and native dependency notices. All four assets were downloaded anonymously and checked. Source: `61adbfd1c9d582e1203606052c2443270f689366`. [Release CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37121666280) verifies actual installation, 14 native workflows, original preservation, form/annotation export-reopen, process-restart recovery, OS-close cancel/discard and exact process/policy cleanup. Normal-user Windows build 22621 / WebView2 154 verification also passed; [full evidence](verification.md) distinguishes this from macOS/mobile/browser results. These are synthetic-document tests, not universal compatibility or physical-printer certification.

## Developer verification

For an already installed, checksum-verified preview in a task-owned temporary directory, run as a normal non-elevated user:

```sh
node tests/native/windows-app-smoke.mjs --local <absolute-installed-exe-path> <expected-exe-sha256>
```

Local mode creates only a fresh synthetic profile and changes no registry policy. Disposable CI uses documented executable-scoped WebView2 overrides and removes its exact values; sandbox switches and wildcard policies are absent. Real OS close targets only the exact owned process. See [maintenance](../MAINTENANCE.md) for build commands and strict publication checks.

To remove the app, export important PDFs, then use **Windows Settings > Apps > Folio > Uninstall**. Leave application-data deletion unchecked if you want to preserve local copies. Report the Windows version, installer filename and error using synthetic documents.
