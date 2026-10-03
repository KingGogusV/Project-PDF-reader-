# Folio — product record

Updated: **2026-10-02, America/Los_Angeles**. Status: functioning development reader, with recorded Windows browser and Linux Chromium CI verification and remaining platform/fidelity gaps; not production-ready certification.

## Product Overview

An original local-first PDF application for everyday reading, review, form completion and safe output across browser, pointer, keyboard and touch environments. No account or document upload is required.

Authoritative repository: [KingGogusV/Project-PDF-reader-](https://github.com/KingGogusV/Project-PDF-reader-). Original purpose: “Project to create free pdf reader that does not suck.” Folio is provisional, not trademark clearance.

## Product Principles

Cross-platform design; local processing; fast startup; accurate rendering; privacy; low friction; original-document preservation; understandable adaptive UI; keyboard/pointer/touch access; accessible controls; evidence-based support claims.

## Platform Strategy

| Target | Actual status | Delivery/limits |
|---|---|---|
| Web | Implemented; Windows Edge/Chrome and Linux Chromium verified | Exact completed checks and coverage gaps in verification |
| Windows | Browser workflows tested | No native installer, associations or update system |
| macOS | Not tested | Browser target; Safari compatibility unverified |
| Linux | Headless Chromium CI verified | No native package; interactive desktop/printing not tested |
| iOS/iPadOS | Experimental, physical devices untested | Desktop tablet/phone emulation is not Safari/device verification |
| Android | Experimental, physical devices untested | Mobile selection, memory, sharing/printing unverified |

[Verification](docs/verification.md) controls final counts, CI status and platform claims.

## Current Technology Stack

| Concern | Actual choice |
|---|---|
| UI | TypeScript 7.0.2, modular DOM, original adaptive CSS/SVG |
| PDF engine/mutation | PDF.js 6.3.289 matching legacy display/viewer/worker; supported incremental serialization |
| Persistence | localStorage for bounded recent metadata/preferences; service-worker app cache |
| Build | Vite 8.3.2, Node 24, pnpm 11.25.0, lockfile |
| Tests | Node runner, PDF.js, pdf-lib fixture/independent checks, Playwright 1.63.0 |
| Packaging | Static browser build; no native package |
| OCR/database/server | None |

pdf-lib is a development fixture/checking dependency, not production mutation. Original application source is UNLICENSED pending an owner decision; dependencies retain their notices.

## Architecture Summary and Document Lifecycle

Adaptive shell → per-document controller → PDF.js viewer/worker → supported edits → immutable export snapshot → incremental serialization → fresh-parser preservation/persistence checks → new-copy download → explicit saved-copy acknowledgment.

Original bytes remain retained. Inactive document hosts are detached to isolate matching form names/widget IDs. Browser adapters own file selection, output windows/downloads and local metadata. No upload endpoint exists.

## Important Directories

src/main.ts: shell/sessions; src/core/: document safety; src/platform/: browser integration; src/ui/ and src/style.css: presentation; scripts/: assets/fixtures/cache generation; tests/: unit/browser evidence; public/: original/generated static resources; docs/: research/requirements/verification.

## Platform Abstraction

Shared: document rendering, search, navigation, supported annotations/forms, dirty state and export verification. Browser-specific: picker, downloads, app cache, localStorage, print-copy windows, selection/clipboard. Native filesystem/atomic writes, menus, associations, installers, share sheets and stylus/palm behavior remain deferred or unverified.

## Feature Status

| Category | State |
|---|---|
| Reader | Open, navigation, scroll/single-page, thumbnails, outlines, search, zoom/fit, view rotation, properties and adaptive controls implemented with recorded browser checks |
| Mutation | Highlight including freehand, FreeText, ink, text/multiline/checkbox/dropdown/radio values verified in final-shell export/reopen; exact coverage in verification |
| Output | Validated new-copy export and explicit save acknowledgment; browser print-copy handoff, not physical print confirmation |
| History | Metadata only; file must be selected again |
| Offline | Cached production shell reload and local PDF open verified offline on Windows Edge/Chrome and Linux Chromium; no user PDFs cached |
| Partial | Broader document fidelity/fonts, accessibility, physical touch/mobile, real printing and large-byte memory behavior |
| Deferred | Underline/strikethrough/sticky-note creation, signature workflow/cryptography, OCR and advanced destructive editing |

See the [37-item trace](docs/requirements.md) for precise evidence and remaining gaps.

## Non-Negotiable Requirements

Never corrupt originals, silently discard edits or bypass restrictions. Do not claim disk writes, printing, signature validity or platform support without evidence. Local processing by default. No proprietary Adobe/RevPDF source/assets. Avoid duplicated PDF stacks and forced platform uniformity.

## Known Limitations

Protective limits: 150 MB per input and three documents; these are not verified capacity guarantees. The 200-page timing fixture is only about 343 KB. Encrypted/signature-bearing/XFA/restricted PDFs are conservatively read-only. PDF scripting, launch and embedded-media execution are disabled.

No persistent document recovery exists; OS/browser termination may bypass unload warnings. No actual signed-document trust validation, native distribution, deployment, Safari/macOS/physical-mobile certification, or full assistive reading-order assurance is established.

## Important Engineering Decisions

Use one browser-capable PDF.js stack and thin adapters. Preserve originals; prefer validated incremental output over broad rewriting. Keep unsupported tools absent. Separate original-source licensing from dependency compliance. Exact benchmark methodology and completed CI outcomes and remaining coverage gaps live in verification.
