# Research record

Research checked: **2026-10-02, America/Los_Angeles**. Facts, developer claims, inferences, decisions and unresolved questions are distinguished. Vendor figures are not independent Folio measurements.

## Evidence

- [Product references](docs/reference-research.md): Adobe Reader versus paid Acrobat/Pro and optional cloud/AI; desktop/web/tablet/phone differences; separate revpdf.com/Pawandeep and bikash1376 projects; licenses/privacy/source inspection.
- [Engine research](docs/engine-research.md): PDF standards, candidate engines/frameworks, licenses, web/native/mobile, OCR, printing, signatures and accessibility.
- [Requirements](docs/requirements.md) and [verification](docs/verification.md): acceptance criteria and actual implementation evidence.

## Selected Engine

**FACT:** Mozilla documents core/display/viewer layers in [PDF.js getting started](https://mozilla.github.io/pdf.js/getting_started/). Its [license](https://github.com/mozilla/pdf.js/blob/master/LICENSE) is Apache-2.0.

**FACT:** Registry/package inspection identified PDF.js 6.3.289, Vite 8.3.2, TypeScript 7.0.2 and Playwright 1.63.0. The lockfile records the actual dependency graph.

**FACT:** [CVE-2024-4367](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq) concerns older releases. The installed 6.3.289 package no longer has the historical isEvalSupported option. Do not invent that switch. Current boundaries include no scripting manager, filtered actions, enabled permissions, matched local assets, CSP and workers.

**DESIGN DECISION:** One shared browser core, modular DOM UI and thin platform adapters. PDF.js handles supported incremental saving; pdf-lib generates/checks synthetic fixtures only.

## Reference Conclusions

**FACT:** Adobe separates basic reading/review/forms from paid editing/OCR/redaction and cloud/AI services. Its online tools and Liquid Mode may process files remotely; Folio does not adopt that architecture.

**FACT:** revpdf.com describes a closed-source Flutter/C++/CMake implementation. Pawandeep's release EULA is not open source. Public performance claims were not independently reproduced.

**FACT:** bikash1376/revpdf is a separate Expo/React Native/SQLite/WebView/PDF.js project associated with revpdf.in. Source inspection found whole-file base64 transfer, a typed bridge, local highlight metadata and bundled reader assets; these do not prove annotation PDF export or platform parity.

**DESIGN DECISION:** Reuse no Adobe/RevPDF implementation or assets; apply independently implemented local workflow/platform-boundary concepts only.

## Licensing and Security

Original source remains **UNLICENSED** pending the owner's distribution decision. This does not replace dependency obligations. Copied PDF.js resources retain licenses; future fonts/WASM/native/codecs need separate review.

Production dependency audit reported zero advisories in this session. It is a dated dependency result, not proof of application safety. Exact command/results belong in verification.

## Open Questions

**UNRESOLVED:** Safari/macOS/physical-mobile compatibility and interactive Linux workflows beyond headless Chromium CI; touch/stylus/palm handling; assistive reading order; CJK/RTL/unusual fonts; large scans and constrained memory; real certificate trust workflows; native packaging/updating; product-name clearance and original-source licensing.

**DESIGN DECISION:** Defer OCR/destructive editing/cryptographic signatures until engine, license, preservation and platform plans are defensible. Folio's actual offline/performance measurements are recorded separately in verification.
