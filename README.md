# Folio

An original, local-first PDF workspace for reading, review, forms and everyday document tools.

Original repository purpose: "Project to create free pdf reader that does not suck."

**Open Folio:** [folio-local-pdf.gogoi-ronnie.chatgpt.site](https://folio-local-pdf.gogoi-ronnie.chatgpt.site).

## Download for Windows

**[Download Folio for Windows (.exe)](https://github.com/KingGogusV/Project-PDF-reader-/releases/download/v0.1.1-preview.1/Folio-0.1.1-Windows-x64-Setup.exe)**

Open the installer, then launch **Folio** from Start. Windows x64 Intel/AMD; **unsigned development preview**. No ChatGPT account, subscription or developer tools are required for reading or device storage. If your Windows policy blocks unsigned apps, use the website above.

[Release and checksums](https://github.com/KingGogusV/Project-PDF-reader-/releases/tag/v0.1.1-preview.1) · [Installation help](docs/windows-installation.md)

**Status:** public web application and verified Windows preview. The release passed installation, native reader/export/recovery/close tests and exact-source CI. macOS packages build, but macOS native runtime remains unverified. See [verification](docs/verification.md).

Only optional website accounts currently use ChatGPT/OpenAI sign-in. PDFs remain on your device.

The published 0.1.0-to-0.1.1 upgrade preserved synthetic local-library and recovery PDFs in Windows CI; real default-profile upgrades remain a separate verification task. See [upgrade evidence](docs/windows-upgrade-verification-2026-10-07.json).

## Available workflows

- Open local PDFs in up to three tabs; navigate, search, select text, use thumbnails/outlines, zoom and rotate the view.
- Highlight, add text or ink, fill supported forms, and export a checked new PDF copy.
- Opt in to a device library with preserved originals, validated recovery copies and conflict/quota handling.
- Recognize English text locally and download it; extract, reorder, delete, rotate or merge eligible pages into a new copy.
- Review a local P12/PFX certificate and create an invisible RSA/SHA-256 signature with integrity checks.
- Use responsive keyboard/touch controls, cached offline reading and a browser print/download handoff.

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

TypeScript/DOM + Vite + PDF.js; bounded pdf-lib page operations; local Tesseract OCR; LibPDF/PKI.js signing; IndexedDB device storage; account-only worker/SQLite; experimental shared Tauri wrapper.

`src/` contains the application; `server/`, `db/` and `drizzle/` contain accounts; `src-tauri/` contains native packaging; `tests/`, `scripts/`, `third_party/` and `docs/` contain verification, build tools, notices and project records.

- [Product/platform status](PROJECT.md), [architecture](ARCHITECTURE.md), [maintenance](MAINTENANCE.md)
- [Research](RESEARCH.md), [requirements](docs/requirements.md), [upgrade scope](docs/upgrade-scope.md)
- [Verification](docs/verification.md), [changelog](CHANGELOG.md), [backlog](BACKLOG.md)

Physical mobile devices, branded Safari, macOS native runtime and printers remain unverified. No general content editor, true redaction, sticky-note/underline/strikethrough creation or trusted-signature validator is included. Original source remains **UNLICENSED** pending the owner's choice; third-party notices, including OCR and FontBox provenance, are distributed separately.
