# Verification record

Session: 2026-10-02 America/Los_Angeles; measurements and final CI continued into 2026-10-03 UTC.

## Scope and evidence

This is a verified initial browser implementation, not a production-readiness certification. Native installers, physical mobile devices and macOS were not tested. A desktop browser at a phone viewport is emulation, not an iPhone or Android device.

| Environment | Completed verification |
| --- | --- |
| Windows / Node 24 | Strict TypeScript check, production build; 23 unit/fixture tests passed, zero failed or skipped |
| Windows / Edge | Full 24 browser tests passed in 35.3 seconds |
| Windows / Chrome 153.0.8010.54 | Five focused browser tests passed in 9.8 seconds: offline, form export/reopen, print handoff, duplicate-widget tabs, phone touch/layout |
| Linux / Chromium headless 153.0.8010.12 | GitHub Actions: strict typecheck, production build, all 23 unit/fixture tests and all 24 browser tests passed (browser suite 49.1 seconds) |
| macOS / Safari / Firefox / physical iOS and Android | Not tested |

The 23 unit/fixture checks comprise 10 browser-adapter boundary tests and 13 actual PDF.js fixture tests. Browser workflows check unexpected external requests and uncaught errors. Separate Windows Chrome visual inspection covered selectable text, all three "amber heron" search matches, and six viewport classes with no uncaught page/console errors.

Production dependency audit (`pnpm audit --prod --json`): zero known advisories returned on 2026-10-02. This is a point-in-time database result, not a guarantee of vulnerability absence.

## Workflows verified

The final browser suite covers local opening/rendering/closing; search/results/clear; page navigation and outlines; fit-page use during editing; tabs with preserved position and isolated duplicate form widgets/radios; text annotation, ink and freehand highlight; supported form fields; export/reopen; original-file preservation; dirty-close cancellation; print-copy handoff; password/cancellation/restrictions; malformed input recovery; denied browser storage; offline operation; and six adaptive layouts.

Thumbnail selection, zoom/fit-mode edge cases, temporary view rotation, page-by-page mode, clipboard, drag/drop and properties exist but lack a dedicated end-to-end acceptance matrix. The requirements trace preserves these gaps.

Isolated Windows Edge controller checks additionally cover text-selected highlights, multiline/check/dropdown/radio/repeated fields, concurrent export/edit snapshots, and read-only ResetForm interception.

The controller reopens each modified export, verifies page count/geometry and changed form/annotation values, and requires the original input bytes to remain an identical prefix. Fixture tests independently check output fields with pdf-lib and preserve input SHA-256. Export is not acknowledged as a filesystem save until the user confirms the copy. Later concurrent edits remain dirty after acknowledging an earlier snapshot.

Encrypted PDFs require a password and export unchanged original bytes. Password cancellation settles. Permission-restricted and signature-field documents are read-only. The signature fixture is unsigned: no certificate validity or signed-document mutation claim.

Print verification means a local PDF copy reaches the browser's viewer or download flow. Windows exercised the viewer handoff; Linux headless exercised PDF download, byte equality and successful parsing. No physical print, print-driver fidelity, mobile print-sheet or completed print receipt was verified.

## Responsive and visual checks

| View | Dimensions | Result |
| --- | --- | --- |
| Large desktop | 1440 x 1000 | Inspected welcome/reader; no body overflow |
| Laptop | 1280 x 800 | Inspected |
| Tablet landscape | 1024 x 768 | Inspected |
| Tablet portrait | 768 x 1024 | Inspected; navigation collapses |
| Phone portrait | 390 x 844 | Inspected; compact tools and full-width document |
| Phone landscape | 844 x 390 | Inspected; compact chrome |

The automated desktop layout additionally uses 1600 x 1000. Browser tests exercise touch input emulation. Physical gestures, stylus/palm rejection, VoiceOver/TalkBack, full PDF reading order and comprehensive WCAG conformance remain unverified.

## Performance

Source data: [benchmark-2026-10-02.json](benchmark-2026-10-02.json). Reproduce with a built preview running, then `node scripts/benchmark.mjs`. The default channel is installed Chrome; E2E_BROWSER_CHANNEL can select another available Chromium browser.

One run per configuration, Windows/Chrome 153, localhost, a synthetic **200-page, 342,975-byte** PDF. This is a many-page test, not a large-byte stress test. Startup includes navigation until the Open control is ready; first-page timing is measured by the document controller; search includes UI debounce and extraction.

| Measurement | Desktop 1440 x 1000 | Phone viewport 390 x 844, 4x CPU throttling |
| --- | ---: | ---: |
| Shell ready | 113 ms | 303 ms |
| First page | 229 ms | 516 ms |
| Search to final-page match | 446 ms | 572 ms |
| Live page canvases at sample | 4 | 6 |
| Canvas pixel count at sample | 7,222,996 | 949,200 |
| Reported JS heap at sample | 10,536,891 bytes | 11,542,087 bytes |

Heap readings are Chromium estimates; they exclude total browser/native/worker/canvas memory and are neither peaks nor mobile hardware measurements. The engine is lazy loaded; initial app JS is approximately 32 KB (11 KB gzip), followed by the PDF engine/viewer/worker as needed. Offline app assets total approximately 6.22 MiB; Vite warns that the engine chunk is approximately 501 KB. The warning is retained, not suppressed.

## Offline result

**Verified** in Windows Edge/Chrome and Linux Chromium: after the first completed service-worker installation, browser networking was disabled; the shell reloaded and a local PDF rendered. Cache inspection found **zero PDF URLs**. No document bytes are deliberately persisted by the application.

A real failure was found and fixed: the preview server's Vary: Origin header caused module and stylesheet cache lookups to miss. The worker ignores Vary only for the exact build-generated static-asset allowlist, never for user files or dynamic content. Cached navigation serves the active app version so waiting updates do not mix new HTML with old engine assets. App updates wait for old tabs to close.

## CI and repository evidence

- Preserved original commit: 65059af146c826bcb317f55435894332710e6881.
- Architecture/research foundation: ff120621ad761cae66626822ae49a6e9585beb00.
- Reader implementation: 76af2358450413afec56158249b4d468dcfe97ca.
- Offline/tab/print fixes: d2dbfa4086503a0667ea93d13b8cfadeb5b42430.
- Initial [run 37081514855](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37081514855) failed three browser checks: tab position, duplicate-widget radio isolation, and headless print handoff. Its unit/build steps passed. The failures were investigated and repaired, not skipped.
- Corrected source [run 37082312401](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37082312401), commit d2dbfa4: **SUCCESS**. Completed job logs independently confirmed 23 unit/fixture passes with zero failures/skips and 24 browser passes.
- GitHub connection write access was verified through actual tree/commit/ref writes to main; no forced remote history rewrite. Local source trees were compared with the resulting remote commit trees before alignment.
- This document is a subsequent documentation-only handoff. Its own commit/run identifiers must be read from Git history and Actions, avoiding a self-referential commit identifier.

## Remaining verification gaps

- Real iOS/iPadOS Safari and Android, Firefox/WebKit, macOS and native shells; interactive Linux desktop/printing beyond headless CI.
- Large-byte/image-heavy memory stress, peak memory, battery, constrained physical devices, and fidelity corpus expansion.
- Embedded/CJK/RTL/unusual fonts, real signed/certified PDFs, XFA and specialized form logic.
- Broad preservation testing of existing unsupported annotation types.
- Physical printing, download destination failures and post-download filesystem durability.
- Durable unsaved-edit crash recovery; beforeunload cannot guarantee recovery after browser/OS termination.
- Advanced editing/OCR/redaction/certificate signing are not implemented.
