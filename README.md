# Folio

An original, local-first PDF workspace for reading, review, forms and everyday document tools.

Original repository purpose: "Project to create free pdf reader that does not suck."

**Open Folio:** [folio-local-pdf.gogoi-ronnie.chatgpt.site](https://folio-local-pdf.gogoi-ronnie.chatgpt.site).

## Download for Windows

**Windows download is pending close-safety and release validation.** Actual Windows reader/export/recovery checks passed locally and in CI. A separate OS-close check found an unsaved-edits bug; the implemented correction awaits rebuilt native verification. A public EXE has not been released. Use the web app above in the meantime.

Once released, download the installer, open it, then launch **Folio** from Start. **No ChatGPT account or developer tools are required.** This is an **unsigned development preview for Windows x64**, not a production release. If Windows policy blocks it, use the web app without disabling your security protections.

[GitHub releases](https://github.com/KingGogusV/Project-PDF-reader-/releases) · [Installation help](docs/windows-installation.md)

PDF reading and device storage work without signing in. Only the website's optional account feature currently uses ChatGPT/OpenAI sign-in. Documents remain on your device.

**Status:** deployed development application. Windows browser checks, Linux Chromium/macOS WebKit CI, and unsigned Windows/macOS package builds passed. Actual Windows native reader/export/recovery checks passed; native close-safety/release validation and actual managed sign-in remain unverified. See [verification](docs/verification.md) for exact results and package links. Folio is a provisional name.

## Available workflows

- Open local PDFs in up to three tabs; navigate, search, select text, use thumbnails/outlines, zoom and rotate the view.
- Highlight, add text or ink, fill supported forms, and export a checked new PDF copy.
- Opt in to a device library with preserved originals, validated recovery copies and conflict/quota handling.
- Recognize English text locally and download it; extract, reorder, delete, rotate or merge eligible pages into a new copy.
- Review a local P12/PFX certificate and create an invisible RSA/SHA-256 signature with integrity checks.
- Use responsive keyboard/touch controls, cached offline reading and a browser print/download handoff.

Reading needs no account. Optional **managed ChatGPT sign-in** supports up to **200 registered Folio accounts**; that is a registration cap, not a concurrent-user benchmark. Only account metadata goes to the service. Stored PDFs remain **unencrypted in this device/browser profile**, may be lost if browser storage is cleared/evicted, and do not synchronize between devices.

Original files are preserved. Reader saves and document tools validate output before offering a copy. Protected PDFs are conservatively read-only; page tools reject structures they cannot preserve. Signature integrity does **not** establish certificate trust, revocation status or trusted time. OCR currently produces separate text, not a searchable PDF, and remains experimental pending a patched native dependency rebuild. Local offline checks and live hosted Chromium offline reload/recovery passed. Deployment v3 includes the WebKit ink-listener correction. Its source passed 63 browser cases each on Linux Chromium and macOS WebKit, plus native package builds. Hosted recovery/offline and WebKit ink export/reopen checks passed.

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
