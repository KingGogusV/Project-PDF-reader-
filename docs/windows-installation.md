# Install Folio on Windows

**[Download Folio-0.1.1-Windows-x64-Setup.exe](https://github.com/KingGogusV/Project-PDF-reader-/releases/download/v0.1.1-preview.1/Folio-0.1.1-Windows-x64-Setup.exe)**

1. Open the downloaded installer and follow its prompts.
2. Launch **Folio** from the Windows Start menu.
3. Choose **Open PDF**. No ChatGPT account, subscription, terminal, Node.js or Rust is needed for PDF reading or device storage.

This is an **unsigned Windows x64 Intel/AMD development preview**. Windows may show an unknown-publisher or reputation warning. Check the [GitHub release](https://github.com/KingGogusV/Project-PDF-reader-/releases/tag/v0.1.1-preview.1) and checksum. Do not disable Windows protections; use the [website](https://folio-local-pdf.gogoi-ronnie.chatgpt.site) if your device policy blocks unsigned applications. ARM emulation and all Windows versions have not been verified. The installer obtains Microsoft's WebView2 Runtime if missing; that initial setup needs internet.

## Documents and accounts

The desktop app is a guest reader. Only optional website accounts use ChatGPT/OpenAI sign-in. **Store on this device** keeps unencrypted originals/recovery copies in this app's profile; it does not synchronize with the website or other devices. Export creates a new PDF copy. Keep external backups before uninstalling or clearing storage. Forced termination before a completed checkpoint can lose recent work.

The window close button asks about unsaved edits. Choose **Keep open**, **Export copy**, **Keep in library** (when stored) or **Discard changes**. Export requires acknowledgment and returns to the document; close it again when finished. Native file associations, automatic updates and atomic overwrite are absent. Physical printing remains unverified.

## Checksums and verification

Installer: 17,854,309 bytes. SHA-256:

```text
32e7484d4ec716a513ff09ff86c85f3a4ac4f690be9c6d7e5b56c5b70d5a6be2
```

Use Windows PowerShell to compare your download:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath .\Folio-0.1.1-Windows-x64-Setup.exe
```

The release includes `SHA256SUMS.txt`, `release-provenance.json` and native dependency notices. All four assets were downloaded anonymously and checked. Source: `8b9f1683bf0c47b9c8b2da4d638168c4a1e3b00f`. [Release CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37142162439) verifies actual installation, 14 native workflows, original preservation, form/annotation export-reopen, process-restart recovery, OS-close cancel/discard and exact process/policy cleanup. The 0.1.1 tests ran on a disposable Windows CI runner with WebView2 153.0.4234.48. Normal-user 0.1.0 verification is separate; [full evidence](verification.md) and [public asset checks](windows-preview-2-verification.json) retain exact revisions. The actual published 0.1.0-to-0.1.1 upgrade preserved three synthetic guest-library PDFs, unsaved checkpoints and exact exports in 20 Windows CI checks on 2026-10-07 ([evidence](windows-upgrade-verification-2026-10-07.json)). That used an elevated disposable runner and overridden profile; normal-user default-profile upgrades remain unverified. Export important PDFs before updating. These are synthetic-document tests, not universal compatibility or physical-printer certification.

## Developer verification

For an already installed, checksum-verified preview in a task-owned temporary directory, run as a normal non-elevated user:

```sh
node tests/native/windows-app-smoke.mjs --local <absolute-installed-exe-path> <expected-exe-sha256>
```

Local mode creates only a fresh synthetic profile and changes no registry policy. Disposable CI uses documented executable-scoped WebView2 overrides and removes its exact values; sandbox switches and wildcard policies are absent. Real OS close targets only the exact owned process. See [maintenance](../MAINTENANCE.md) for build commands and strict publication checks.

To remove the app, export important PDFs, then use **Windows Settings > Apps > Folio > Uninstall**. Leave application-data deletion unchecked if you want to preserve local copies. Report the Windows version, installer filename and error using synthetic documents.
