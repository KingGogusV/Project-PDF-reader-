# Folio — product record

Updated: 2026-10-02. Status: initial implementation in progress; no platform verified yet.

## Product Overview
An original, local-first PDF reader for everyday reading, navigation, annotation and form workflows. The authoritative repository is `KingGogusV/Project-PDF-reader-`. The original repository purpose was “Project to create free pdf reader that does not suck.”

## Product Principles
Cross-platform design; local document processing; no account or document telemetry; accurate rendering; safe export; responsive keyboard, pointer and touch interfaces; accessible controls; fast startup and bounded rendering.

## Platform Strategy
| Platform | Status | Delivery |
| --- | --- | --- |
| Web | In development | Responsive browser application |
| Windows | Planned verification | Browser; native packaging deferred |
| macOS | Not tested | Browser; native packaging deferred |
| Linux | Not tested | Browser; native packaging deferred |
| iOS/iPadOS | Experimental target, not tested | Safari compatibility to verify |
| Android | Experimental target, not tested | Modern browser compatibility to verify |

## Current Technology Stack
Selected after research: TypeScript, Vite, modular native DOM UI, Mozilla PDF.js 6.3.289 and its viewer/editor components. PDF.js owns PDF parsing, rendering and supported incremental saving. pdf-lib is for synthetic test fixture generation only. Playwright verifies browser workflows. No server/database, OCR engine or native packaging is selected.

## Architecture Summary
Adaptive UI calls a document controller, which owns the PDF.js viewer/worker. Browser adapters own local file selection, safe output downloads, print delegation and local settings. See ARCHITECTURE.md.

## Document Lifecycle
Open (file adapter) → parse (PDF.js worker) → render (viewer) → interact (UI/controller) → modify (PDF.js annotation storage/editor) → export a new copy (controller + file adapter). Original files must remain untouched.

## Platform Abstraction
Document/search/editor logic is shared. File picking, downloads, printing and browser storage belong to browser adapters. Native filesystem, menus, mobile share sheets and installers are planned; no native support claim.

## Feature Status
Implementation is in progress. No proposed feature is marked implemented or verified. Final status will be recorded after actual testing.

## Non-Negotiable Requirements
Never corrupt originals or silently discard edits. Do not bypass encryption or usage restrictions. Local processing by default. No proprietary Adobe/RevPDF source or assets. Preserve behavior, and report actual platform verification. Prefer tested capabilities over feature count.

## Known Limitations
Native packaging and physical mobile testing are not available yet. Commercial-quality PDF compatibility, assistive reading order, certificate signatures, OCR and advanced content editing require further work.

## Important Engineering Decisions
Use one browser-capable core to avoid separate engines per platform. Use established PDF.js viewer/editor primitives instead of writing a PDF renderer. Preserve original bytes and use new-file export. Working name Folio is provisional and not a trademark clearance.

## Important Directories
`src/` application; `src/core/` document controller; `src/platform/` browser adapters; `scripts/` fixture/build utilities; `tests/` automated tests; `docs/` evidence and verification records; `public/` original static assets.
