# Install Folio on Windows

**[Download Folio-0.1.1-Windows-x64-Setup.exe](https://github.com/KingGogusV/Project-PDF-reader-/releases/download/v0.1.1-preview.1/Folio-0.1.1-Windows-x64-Setup.exe)**

**0.1.2 release preparation:** the next unsigned preview adds Windows Save As and a stricter installed-runtime release gate. Its new source CI and 0.1.1-to-0.1.2 candidate upgrade checks are pending. The working download above stays on 0.1.1 until the new release and its public asset checks complete. [Prepared 0.1.2 release notes](releases/windows-preview-3.md) describe the candidate; their new download link becomes available only after publication.

1. Open the downloaded installer and follow its prompts.
2. Launch **Folio** from the Windows Start menu.
3. Choose **Open PDF**. No ChatGPT account, subscription, terminal, Node.js or Rust is needed for PDF reading or device storage.

This is an **unsigned Windows x64 Intel/AMD development preview**. Windows may show an unknown-publisher or reputation warning. Check the [GitHub release](https://github.com/KingGogusV/Project-PDF-reader-/releases/tag/v0.1.1-preview.1) and checksum. Do not disable Windows protections; use the [website](https://folio-local-pdf.gogoi-ronnie.chatgpt.site) if your device policy blocks unsigned applications. ARM emulation and all Windows versions have not been verified. The installer obtains Microsoft's WebView2 Runtime if missing; that initial setup needs internet.

## Practical requirements

Use Windows 10 or 11 on a 64-bit Intel/AMD computer and keep the **Microsoft Edge WebView2 Evergreen Runtime** current. WebView2 is the app's separate rendering runtime; an installed Edge browser alone does not establish that it is available. Initial runtime installation or an update can need internet, after which PDF reading and local device storage work without a connection. See [Microsoft's Runtime distribution guidance](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution).

The 0.1.2 candidate installer sets a minimum WebView2 version of **125.0.0.0**, following the bundled [legacy PDF.js browser target](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions#faq-support). That dependency/installer floor is separate from actual Folio installed tests at WebView2 153/154. Missing required runtime capabilities show update guidance before the reader or device storage initializes. No installed test at 125 or universal Windows compatibility is claimed. Keep Evergreen updated rather than pinning the minimum.

No code-signing identity is configured for this preview. If your organization requires signed applications, use the website or ask its administrator about approved software. User PDF workflows require no PowerShell or developer tools; the PowerShell 7 requirement below applies only to the optional developer test harness.

## Documents and accounts

The desktop app is a guest reader. Only optional website accounts use ChatGPT/OpenAI sign-in. **Store on this device** keeps unencrypted originals/recovery copies in this app's profile; it does not synchronize with the website or other devices. Export creates a new PDF copy. Keep external backups before uninstalling or clearing storage. Forced termination before a completed checkpoint can lose recent work.

The window close button asks about unsaved edits. Choose **Keep open**, **Export copy**, **Keep in library** (when stored) or **Discard changes**. Export requires acknowledgment and returns to the document; close it again when finished. Native file associations, automatic updates and atomic overwrite are absent. Physical printing remains unverified.

In the 0.1.2 candidate, the main **Save As** control or **Ctrl+S** opens the Windows save dialog. Choose a new filename. Folio verifies the completed disk copy before clearing its unsaved marker; cancellation or a failed write leaves your edits open. Existing files remain protected even after a Windows replacement confirmation. Saving from the close prompt returns to the document; close it again after checking the copy. The older published 0.1.1 export uses its browser handoff and acknowledgment instead.

The candidate accepts input PDFs up to 150 MiB and limits native saved copies to 256 MiB. These are protective bounds, not memory or speed guarantees. Tool-specific downloads and printing keep their existing handoffs. Completed recovery checkpoints can survive a process restart; pending edits, preferences and every power-loss scenario are not guaranteed.

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

Those hashes and public-download results identify **0.1.1**, not the pending 0.1.2 candidate. The new preview requires fresh exact-source Reader CI, strict licenses/notices and installed/build byte identity, all 17 installed checks, eight successful owned Save As dialog interactions, zero observed page/console/privacy errors and both owned process cleanups. Its new SHA-256 values and public asset evidence will be recorded after publication; never use an older preview's checksum to validate a newer installer. The installer bundles `third-party-notices`, including unchanged covered native source archives; the release's matching notice ZIP contains the same material. The separate 0.1.1-to-0.1.2 candidate upgrade pass is not yet claimed.

## Developer verification

For an already installed, checksum-verified preview in a task-owned temporary directory, use PowerShell 7 with the required Windows UI Automation assemblies available and an existing execution policy that permits the helper scripts. Run as a normal non-elevated user:

```sh
node tests/native/windows-app-smoke.mjs --local <absolute-installed-exe-path> <expected-exe-sha256>
```

Local mode creates only a fresh synthetic profile and changes no registry policy. Disposable CI uses documented executable-scoped WebView2 overrides and removes its exact values; sandbox switches and wildcard policies are absent. Real OS close targets only the exact owned process. See [maintenance](../MAINTENANCE.md) for build commands and strict publication checks.

The harness neither changes nor bypasses execution policy. The earlier Windows PowerShell 5.1 helper failure is retained as partial local evidence; an owned offscreen PowerShell 7 UI Automation probe is a helper prerequisite check, not a complete installed-app Save As pass. Fresh full local/runtime results belong in [verification](verification.md).

To remove the app, export important PDFs, then use **Windows Settings > Apps > Folio > Uninstall**. Leave application-data deletion unchecked if you want to preserve local copies. Report the Windows version, installer filename and error using synthetic documents.
