**[Download Folio for Windows (.exe)](https://github.com/KingGogusV/Project-PDF-reader-/releases/download/v0.1.2-preview.1/Folio-0.1.2-Windows-x64-Setup.exe)**

# Folio for Windows — preview 0.1.2

Open **Folio-0.1.2-Windows-x64-Setup.exe**, follow the installer, then launch **Folio** from Start and choose **Open PDF**. Reading and device storage need no ChatGPT account, subscription, terminal, Node.js, Rust or PowerShell. Optional website accounts use ChatGPT/OpenAI sign-in; the desktop app is a local guest reader.

## Save a new PDF copy

Edit supported forms or annotations, choose **Save As** or press **Ctrl+S**, and select a new filename in the Windows save dialog. Folio checks the completed disk copy before clearing the document's unsaved marker. Cancellation or an error keeps the document and its changes open.

Existing files are always preserved. If Windows asks whether to replace a file and you confirm, Folio still refuses replacement; choose an unused filename. The window close button asks how to handle unsaved edits. Saving from that prompt returns to the document so you can check the copy before closing it again.

The app accepts PDFs up to 150 MiB and bounds a native saved copy to 256 MiB. These limits protect resource use; they do not promise smooth operation for every document or device. Completed device checkpoints can recover after a process restart; pending edits and universal power-loss recovery are not guaranteed. Browser and tool-specific downloads keep their existing handoffs, and physical printing remains unverified.

## Windows requirements

Use Windows 10 or 11 on a 64-bit Intel/AMD computer with a current **Microsoft Edge WebView2 Evergreen Runtime**. The installer requests WebView2 **125.0.0.0 or newer** and can obtain or update it; that setup may need internet. Microsoft documents the separate [WebView2 Runtime and its distribution](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution).

The 125 floor follows the bundled legacy PDF.js dependency's [upstream browser target](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions#faq-support); it is not an installed Folio test at that version. Earlier installed-app evidence uses WebView2 153/154. If required runtime capabilities are missing, startup provides update guidance before opening the reader or device storage. Keep Evergreen updated. ARM emulation, every Windows configuration and upgrades of a real user's existing profile are not certified.

This is an **unsigned development preview**. Code signing has not been configured with a signing identity. Windows may show an unknown-publisher or reputation warning. Check this GitHub release and its checksums; keep Windows protections enabled. If your device policy blocks unsigned apps, use the [website](https://folio-local-pdf.gogoi-ronnie.chatgpt.site).

## Copies, notices and verification

PDFs and recovery copies remain on the device. **Store on this device** retains unencrypted copies in the app's profile, separate from website storage. Export backups before updating, uninstalling or clearing application data. Native file associations and automatic updates are not implemented.

The installer includes third-party licenses, notices and unchanged covered native source archives under **third-party-notices**. The same material is available in **Folio-0.1.2-Third-Party-Notices.zip**. **SHA256SUMS.txt** and **release-provenance.json** identify the exact installer, notice archive, source and verification run. Existing 0.1.0 and 0.1.1 release assets remain unchanged.

Publication requires Reader checks on the exact reviewed main revision, strict notice collection, installed/build byte identity, all **17 installed runtime checks**, eight successful owned Windows-dialog interactions, verified Unicode and multi-chunk Save As copies, zero observed page/console/privacy errors, and both process cleanups. It also requires a source-matched **0.1.1-to-0.1.2 candidate upgrade** using synthetic device storage and the actual installer/Start menu path. The [verification record](https://github.com/KingGogusV/Project-PDF-reader-/blob/main/docs/verification.md) separates current source and upgrade evidence from earlier passes. These synthetic-document checks do not establish universal PDF compatibility, screen-reader conformance, printer output or production readiness. OCR remains experimental.
