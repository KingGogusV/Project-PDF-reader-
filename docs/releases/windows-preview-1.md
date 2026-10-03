## Download for Windows

Choose **Folio-0.1.0-Windows-x64-Setup.exe** below, open it, and follow the installer. Then open **Folio** from Start.

No ChatGPT account, subscription, terminal, Node.js or Rust is needed to read PDFs or store local copies. Optional website accounts currently use ChatGPT/OpenAI sign-in. The desktop app operates as a local guest reader.

This is an **unsigned development preview for Windows x64**, not a signed production release. Windows may show an unknown-publisher/SmartScreen warning. Do not disable Windows protection; use the [browser app](https://folio-local-pdf.gogoi-ronnie.chatgpt.site) if your device blocks installation. The installer can obtain Microsoft's WebView2 runtime when it is missing, which requires internet access.

PDFs and recovery copies stay on the device. Native storage is separate from the website's browser storage. Keep exported backups before uninstalling or clearing application data.

The installer includes third-party notices and unchanged covered native source archives under `third-party-notices`. The same material is available in **Folio-0.1.0-Third-Party-Notices.zip**. **SHA256SUMS.txt** and **release-provenance.json** identify the exact downloaded files and verification run.

The release workflow requires reader checks, a successful installer run and an installed WebView2 smoke test before publishing. That test does not establish physical printer output, all Windows versions, physical mobile support, certificate trust or production readiness. OCR remains experimental. See the repository's [verification record](https://github.com/KingGogusV/Project-PDF-reader-/blob/main/docs/verification.md) for the broader limits.
