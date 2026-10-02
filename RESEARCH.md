# Research record

Research date: 2026-10-02. Facts, developer claims, inference, decisions and unresolved questions are distinguished. Marketing benchmarks are not independent measurements.

## Initial decision evidence
- FACT: Mozilla documents display and viewer layers, and asks embedded viewers to have a distinct UI: https://mozilla.github.io/pdf.js/getting_started/
- FACT: PDF.js license is Apache-2.0: https://github.com/mozilla/pdf.js/blob/master/LICENSE
- FACT: CVE-2024-4367 affected older PDF.js and supports defense-in-depth disabling eval: https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq
- FACT: npm registry queried during this session returned PDF.js 6.3.289, Vite 8.3.2, TypeScript 7.0.2 and Playwright 1.63.0.
- DESIGN DECISION: a single local browser core and thin future platform adapters; PDF.js saving instead of broad PDF rewriting.
- UNRESOLVED QUESTION: physical mobile/browser compatibility and native packaging must be tested separately.

## Research workstreams
Adobe Acrobat Reader; Adobe Acrobat / Acrobat Pro; optional cloud/AI; revpdf.com; Pawandeep-prog/revpdf-release; bikash1376/revpdf; PDF standards; candidate engines/frameworks; web/desktop/mobile architecture; OCR; printing; digital signatures; accessibility; licensing. Detailed dated evidence is being compiled in `docs/reference-research.md` and `docs/engine-research.md` before use.

## Reuse constraints
No Adobe or RevPDF proprietary implementation/assets will be reused. Public visibility does not grant a source license. Third-party packages retain their notices; selecting permissive dependencies does not by itself choose a license for this original application.
