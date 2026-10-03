# Folio

An original, local-first PDF reader with an adaptive browser workspace for reading, searching, annotating and filling PDFs.

Original repository purpose: “Project to create free pdf reader that does not suck.”

**Status:** working development implementation verified in Windows Edge/Chrome and Linux Chromium CI. Exact test results and remaining coverage gaps are tracked in [verification](docs/verification.md). Phone/tablet viewport emulation is not physical-device verification. Folio is a provisional name.

## Available workflows

Local opening; up to three documents; page navigation, thumbnails, outlines, search, zoom and view rotation; text/freehand highlights, added text and ink; supported AcroForm fields; new-copy PDF export; print-copy handoff; recent metadata; offline application caching after setup.

Original files are preserved. Exported changes are reopened and checked before download. Encrypted, restricted and signature-bearing documents are conservatively read-only; signature validity is not checked.

## Development

Requires Node 24 and pnpm 11.25.0.

~~~sh
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm preview
~~~

Development/build generate local engine assets and synthetic fixtures. For browser tests, build and start preview in another terminal, then run pnpm test:e2e. Tests default to installed Microsoft Edge; E2E_BROWSER_CHANNEL selects chrome, msedge or chromium. See [MAINTENANCE.md](MAINTENANCE.md) for setup and optional encrypted-fixture dependencies.

## Project records

TypeScript + Vite + PDF.js 6.3.289. Application: src/; document controller: src/core/; browser adapters: src/platform/; tests: tests/; build utilities: scripts/.

- [Product/platform status](PROJECT.md) · [Architecture](ARCHITECTURE.md)
- [Maintenance](MAINTENANCE.md) · [Research](RESEARCH.md)
- [Requirements](docs/requirements.md) · [Verification](docs/verification.md)
- [Changelog](CHANGELOG.md) · [Backlog](BACKLOG.md)

No native installer, OCR, certificate signing, sticky-note/underline/strikethrough creation or destructive content editing is included. Original source remains **UNLICENSED** until the owner selects a license. Third-party notices are distributed with their assets.
