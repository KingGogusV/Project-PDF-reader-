# Install Folio on Windows

**[Download Folio-0.1.2-Windows-x64-Setup.exe](https://github.com/KingGogusV/Project-PDF-reader-/releases/download/v0.1.2-preview.1/Folio-0.1.2-Windows-x64-Setup.exe)**

1. Open the downloaded installer and follow its prompts.
2. Launch **Folio** from the Windows Start menu.
3. Choose **Open PDF**. Reading and device storage need no ChatGPT account, subscription, terminal, PowerShell, Node.js or Rust.

This is an **unsigned Windows x64 Intel/AMD development preview**. No code-signing identity is configured. Windows may show an unknown-publisher or reputation warning. Check the [GitHub release and checksums](https://github.com/KingGogusV/Project-PDF-reader-/releases/tag/v0.1.2-preview.1); keep Windows protections enabled. Use the [website](https://folio-local-pdf.gogoi-ronnie.chatgpt.site) if your device policy blocks unsigned applications.

## Save a new PDF copy

Edit supported forms or annotations, then choose **Save As** or press **Ctrl+S**. Choose an unused PDF filename in the Windows save dialog. Folio verifies the completed disk bytes before acknowledging the save and clearing the unsaved marker. Canceling the dialog or a failed write keeps the document and its edits open so you can retry.

Existing files are always preserved. If Windows asks whether to replace a file and you confirm, Folio still refuses replacement; choose a new filename. The window close button asks about unsaved changes. Saving from that prompt returns to the document so you can check the copy and close again when ready. **Keep in library**, when available, records a device checkpoint rather than an external PDF save.

Rust writes native copies through chunks of at most 1 MiB and checks their final disk bytes before returning a save receipt. This bounds each transfer buffer; it does not establish a speed or total-memory benchmark. Input PDFs are limited to 150 MiB and native saved copies to 256 MiB. Document tools keep their existing output handoffs; physical printing remains unverified.

## Practical requirements

Use Windows 10 or 11 on a 64-bit Intel/AMD computer with a current **Microsoft Edge WebView2 Evergreen Runtime**. An installed Edge browser alone does not establish that the separate Runtime is available. The installer can obtain or update it; initial setup may need internet. PDF reading and device storage can then work offline. See [Microsoft's Runtime distribution guidance](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution).

The 0.1.2 installer requests WebView2 **125.0.0.0 or newer**, following the bundled [legacy PDF.js browser target](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions#faq-support). This is a dependency/installer floor. Recorded actual Folio installed-app tests use WebView2 153/154; no installed Folio test at 125 is claimed. Missing required runtime capabilities show update guidance before the reader or device storage initializes. Keep Evergreen current rather than pinning the minimum. ARM emulation, every Windows configuration and a real user's default-profile upgrade are not certified.

## Updates and startup help

Desktop updates open the reader from the installed files, bypassing the older offline interface and removing only Folio's old app-shell worker/cache. Stored PDFs, completed recovery copies and preferences are separate and are preserved. The desktop reader can use its packaged assets offline; website offline caching is unchanged.

If required WebView2 features are missing, Folio shows update guidance before opening the reader or device storage. If app-shell cleanup or reader loading fails, it shows restart help rather than silently continuing with the old interface. Stored documents are not erased. Early startup failures permit the window to close; if the reader already owns an open document, its changes and normal unsaved-close prompt remain available.

## Documents and accounts

The desktop app is a guest reader. Only optional website accounts use ChatGPT/OpenAI sign-in. **Store on this device** keeps unencrypted originals/recovery copies in the app profile, separate from website storage, without synchronization to other devices. Keep exported backups before updating, uninstalling or clearing application data.

Completed checkpoints can recover after a process restart. Pending edits and every power-loss scenario are not guaranteed; abrupt termination during a save can leave an unpublished temporary file. Native file associations and automatic updates are absent.

## Checksums and verification

Installer: **18016393 bytes**. SHA-256:

```text
1ed999a56b9c4fa5b4c95d25af743ed4903cc366345ce097244a4602eee2d799
```

An optional PowerShell checksum check is shown below; PowerShell is not needed to install or use Folio:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath .\Folio-0.1.2-Windows-x64-Setup.exe
```

The release includes four files: the EXE installer, matching third-party notice ZIP, `SHA256SUMS.txt` and `release-provenance.json`. All four were downloaded anonymously and compared byte-for-byte with the independently verified prepared payload. Every notice reference and covered source archive matched; all 554 installed **third-party-notices** files matched the public inventory. Both older releases and all eight assets retained their recorded IDs, timestamps, sizes and hashes.

Released source: `ad8b2c169d707ff9616bf115b9c977c88c09cef9`. [Reader CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37686461277) and [publication CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37686535246) passed for that exact source. The [machine-readable delivery record](windows-preview-3-verification.json) retains provenance, hashes and these separate test boundaries:

- **17 installed runtime checks passed** in disposable Windows CI: eight successful owned dialog interactions, Unicode and multi-chunk Save As, independent PDF reopen, original preservation, restart recovery and confirmed OS close. Both owned jobs emptied and their exact test-policy values were removed; page/console/privacy error arrays were empty.
- **20 source-bound 0.1.1-to-0.1.2 candidate upgrade checks passed** with synthetic library/recovery PDFs in the genuine default app profile of an elevated disposable CI account. They verified actual installers/Start-menu shortcuts, current Save As controls on the first navigation of both upgraded launches before any test reload, exact preserved documents/preferences, all three native Save As copies, four owned launch cleanups, installer removal and exact captured-shortcut cleanup. No real user's library was used.
- A **17-check normal, non-elevated local pass** used the anonymously downloaded installer on Windows 11 Pro build 22621 with WebView2 154.0.4258.62, a separate isolated synthetic profile and no registry policy changes. [Its sanitized report](windows-preview-3-normal-user-verification.json) records all eight owned dialog actions, both process cleanups, 554 notice hashes, guarded uninstall and unchanged execution policy. This separate run does not certify a normal user's existing-profile upgrade.

These synthetic-document checks do not establish universal PDF compatibility, screen-reader conformance, printer output or production readiness. Never compare a new installer with an older release's checksum.

## Earlier 0.1.1 release

The preserved [0.1.1 installer](https://github.com/KingGogusV/Project-PDF-reader-/releases/download/v0.1.1-preview.1/Folio-0.1.1-Windows-x64-Setup.exe) is **17,854,309 bytes**, SHA-256 `32e7484d4ec716a513ff09ff86c85f3a4ac4f690be9c6d7e5b56c5b70d5a6be2`. Its source is `8b9f1683bf0c47b9c8b2da4d638168c4a1e3b00f` and [release CI 37142162439](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37142162439) passed 14 native workflows using WebView2 153.0.4234.48. Its export used the browser handoff and acknowledgment rather than the 0.1.2 verified native Save As receipt. [Historical public asset evidence](windows-preview-2-verification.json) is unchanged; normal-user 0.1.0 evidence remains separate in [verification](verification.md).

The published 0.1.0-to-0.1.1 upgrade preserved three synthetic guest-library PDFs, completed unsaved checkpoints and exact exports in 20 Windows CI checks on 2026-10-07 ([evidence](windows-upgrade-verification-2026-10-07.json)). That earlier pass used an elevated disposable runner and an overridden profile. It does not establish the later 0.1.1-to-0.1.2 default-profile result.

## Developer verification

For an already installed, checksum-verified preview in a task-owned temporary directory, use PowerShell 7 with Windows UI Automation assemblies available and an existing execution policy that permits the helper scripts. Run as a normal non-elevated user:

```sh
node tests/native/windows-app-smoke.mjs --local <absolute-installed-exe-path> <expected-exe-sha256>
```

Local mode creates a fresh synthetic profile and changes no registry policy. Disposable CI alone uses documented executable-scoped WebView2 overrides and removes its exact values. Real OS close and save-dialog automation target only the verified owned process. The harness neither changes nor bypasses execution policy. The earlier Windows PowerShell 5.1 failure remains partial historical evidence; an offscreen helper probe is not a full installed-app pass. See [maintenance](../MAINTENANCE.md) and [verification](verification.md).

To remove the app, export important PDFs, then use **Windows Settings > Apps > Folio > Uninstall**. Leave application-data deletion unchecked to preserve local copies. Report the Windows version, installer filename and error using synthetic documents.
