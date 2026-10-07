# Folio

## Download for Windows

**[Download Folio for Windows (.exe)](https://github.com/KingGogusV/Project-PDF-reader-/releases/download/v0.1.2-preview.1/Folio-0.1.2-Windows-x64-Setup.exe)**

Open the installer, launch **Folio** from Start, then choose **Open PDF**. Windows 10/11 x64 Intel/AMD; **unsigned development preview 0.1.2**. Reading and device storage need no ChatGPT account, subscription, terminal, PowerShell or developer tools. Initial Microsoft WebView2 Runtime setup or updating can need internet. If your Windows policy blocks unsigned apps, use the [website](https://folio-local-pdf.gogoi-ronnie.chatgpt.site).

[Release and checksums](https://github.com/KingGogusV/Project-PDF-reader-/releases/tag/v0.1.2-preview.1) · [Installation help](docs/windows-installation.md)

An original, local-first PDF workspace for reading, review, forms and everyday document tools. Original repository purpose: "Project to create free pdf reader that does not suck."

**Use Folio in your browser:** [folio-local-pdf.gogoi-ronnie.chatgpt.site](https://folio-local-pdf.gogoi-ronnie.chatgpt.site).

**Status:** public web application and a published unsigned Windows 0.1.2 preview from source `ad8b2c169d707ff9616bf115b9c977c88c09cef9`. [Reader CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37686461277), [publication CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37686535246) and the [delivery record](docs/windows-preview-3-verification.json) verify the exact release. All 17 installed reader/Save As/recovery/close checks passed in Windows CI and again in a normal-user local session with an isolated synthetic profile. A separate 20-check candidate upgrade passed in disposable Windows CI. macOS packages build; macOS native runtime remains unverified.

Use **Save As** or **Ctrl+S** to save supported form or annotation edits to a new PDF filename. Folio checks the completed disk copy before clearing its unsaved marker. Cancellation or a failed write keeps the document open with its changes; existing files remain protected even after a Windows replacement confirmation. Saving from the close prompt returns to the document so you can check the copy before closing again. Native saving uses bounded chunks and verified disk receipts; no speed or total-memory benchmark is claimed.

Desktop updates bypass the older Folio offline interface and load the reader from the installed files. Startup retires only Folio's old offline app shell; stored PDFs, completed recovery copies and preferences stay in their separate stores. The desktop reader uses packaged offline assets, and website offline caching keeps its existing behavior. If startup fails, Folio shows restart or runtime-update help without erasing those stored documents.

Only optional website accounts currently use ChatGPT/OpenAI sign-in. PDFs remain on your device.

The 20-check 0.1.1-to-0.1.2 candidate upgrade preserved synthetic library/recovery PDFs in the genuine default app profile of an elevated disposable CI account, checked installer-created Start-menu shortcuts, and showed the current reader on the first navigation of both upgraded launches. The 17-check normal-user local run used a separate isolated profile; neither test certifies upgrades of a real user's library. Earlier 0.1.0-to-0.1.1 evidence used an overridden profile and remains [recorded separately](docs/windows-upgrade-verification-2026-10-07.json).

Keep Microsoft Edge WebView2 Evergreen current. The installer requests **125.0.0.0 or newer**, following the bundled legacy PDF.js dependency target; the recorded actual installed-app tests use WebView2 153/154. No installed Folio test at 125 is claimed. Runtime requirements, checksums, unsigned-app limitations and earlier releases are in [installation help](docs/windows-installation.md).

## Available workflows

- Open local PDFs in up to three tabs; navigate, search, select text, use thumbnails/outlines, zoom and rotate the view.
- Highlight, add text or ink, fill supported forms, and export a checked new PDF copy.
- Opt in to a device library with preserved originals, validated recovery copies and conflict/quota handling.
- Recognize English text locally and download it; extract, reorder, delete, rotate or merge eligible pages into a new copy.
- Review a local P12/PFX certificate and create an invisible RSA/SHA-256 signature with integrity checks.
- Use responsive keyboard/touch controls, packaged desktop offline reading, cached browser offline reading and a browser print/download handoff.

Reading needs no account. Optional **managed ChatGPT sign-in** supports up to **200 registered Folio accounts**; that is a registration cap, not a concurrent-user benchmark. Only account metadata goes to the service. Stored PDFs remain **unencrypted in this device/browser profile**, may be lost if browser storage is cleared/evicted, and do not synchronize between devices.

Original files are preserved. Reader saves and document tools validate output before offering a copy. Protected PDFs are conservatively read-only; page tools reject structures they cannot preserve. Signature integrity does **not** establish certificate trust, revocation status or trusted time. OCR currently produces separate text, not a searchable PDF, and remains experimental pending a patched native dependency rebuild. Local offline checks and live hosted Chromium offline reload/recovery passed. Deployment v4 includes the accessibility pass: stable keyboard tabs, reliable dialog focus, clearer state announcements and controls that reflow with enlarged text. Its application code passed 79 browser cases each on Linux Chromium and macOS WebKit; all 15 automated accessibility states reported zero violations. See [accessibility evidence and manual limits](docs/accessibility-audit.md).

## Development

Requires Node 24 and pnpm 11.25.0. Full fixture coverage also needs the Python/Poppler prerequisites in [maintenance](MAINTENANCE.md).

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm test:core
pnpm test:signing
pnpm build
pnpm preview
```

Build before starting preview; run `pnpm test:e2e` in another terminal. Do not rebuild the served output during tests. The static preview does not run hosted authentication. Build outputs are `dist/client` and `dist/server`; generated local assets/fixtures and the committed lockfile support reproducibility.

## Repository

TypeScript/DOM + Vite + PDF.js; bounded pdf-lib page operations; local Tesseract OCR; LibPDF/PKI.js signing; IndexedDB device storage; account-only worker/SQLite; Tauri wrapper with bounded Rust new-copy file I/O.

`src/` contains the application; `server/`, `db/` and `drizzle/` contain accounts; `src-tauri/` contains native packaging; `tests/`, `scripts/`, `third_party/` and `docs/` contain verification, build tools, notices and project records.

- [Product/platform status](PROJECT.md), [architecture](ARCHITECTURE.md), [maintenance](MAINTENANCE.md)
- [Research](RESEARCH.md), [requirements](docs/requirements.md), [upgrade scope](docs/upgrade-scope.md)
- [Verification](docs/verification.md), [changelog](CHANGELOG.md), [backlog](BACKLOG.md)

Physical mobile devices, branded Safari, macOS native runtime and printers remain unverified. No general content editor, true redaction, sticky-note/underline/strikethrough creation or trusted-signature validator is included. Original source remains **UNLICENSED** pending the owner's choice; third-party notices, including OCR and FontBox provenance, are distributed separately.
