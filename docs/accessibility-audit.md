# Accessibility audit and platform verification boundaries

Checked 2026-10-03 UTC. This is a targeted engineering audit, not a WCAG
conformance certification or a screen-reader compatibility claim.

## Current accessibility pass — 2026-10-03

The new `tests/e2e/accessibility.spec.ts` adds 13 regression cases. They cover stable keyboard tabs; valid panel references with detached inactive PDF widgets; open/close and panel/dialog focus; phone navigation; skip links and keyboard form export/reopen with original-byte preservation; unsaved descriptions/status; 320 x 256 CSS-pixel reflow; doubled application text at phone/laptop sizes; forced-colors/reduced-motion emulation; and 15 axe states. The existing six viewport workflows now retain reader screenshots.

Pre-fix tests reproduced four failures: tab focus was lost, inactive panel references were missing, expanded state was absent, and the canvas failed to render at 320 x 256 because chrome consumed the viewport. Expanding the scan to Properties subsequently identified nine 3.60:1 label-contrast failures. Repairs are described in ARCHITECTURE/CHANGELOG; final run evidence belongs below and in verification.

The axe gate scans welcome; help, library and account dialogs; multiple documents; document tools; OCR, organization and certificate dialogs; Properties; search; interactive forms; local-storage consent; phone reader and phone actions. It excludes no rules or document content and fails on reported violations. Full `incomplete` results are retained in the test attachment.


## Verified local result for this pass

2026-10-03 UTC, Linux, Google Chrome for Testing **153.0.8010.12**, Playwright 1.63.0. Frozen dependency installation, type checking, 63 unit/fixture tests (zero skips), production client/account-worker build, **79 browser workflows**, seven core/checkpoint cases, nine signing cases and eight release-extraction cases passed. After the final footer layout adjustment, all **19 affected accessibility/responsive cases** passed again. No retries or skips were needed for the final local browser suite.

All **15 axe states reported zero violations**. `color-contrast` remained incomplete in the welcome footer, PDF/text/canvas states, and some clipped/overlapping content reported in OCR, signing and phone-actions dialogs. These incomplete checks were retained, not suppressed or relabeled as passes. Application Properties labels improved from 3.60:1 to 6.36:1. Screenshot review covered desktop 1600 x 1000, laptop 1280 x 800, tablet 1024 x 768 and 768 x 1024, phone 390 x 844 and 844 x 390, 320 x 256 reflow, doubled text and forced colors.

The local production shell JavaScript is **79.62 kB / 25.90 kB gzip**, compared with the inspected baseline 76.69 kB / 25.02 kB gzip. This is a build-size measurement, not a device-speed benchmark. No new runtime dependency was added. GitHub/macOS/native results and publication must be checked separately against their actual source revisions.

## Earlier verified audit (before this pass)

The earlier production-preview audit completed at 2026-10-03 01:58 UTC in Microsoft
Edge 154.0.4258.53 on Windows, against `http://127.0.0.1:4173`. The inspected build
has service-worker manifest version `2e61d5c66548dcdc`; the audit context blocked
service workers to avoid stale cached assets. All nine scanned states had zero
axe violations. No rules or page content were excluded.

| Production state | Axe violations | Incomplete automated checks |
| --- | ---: | --- |
| Welcome, desktop | 0 | None |
| Device-library dialog | 0 | None |
| Account dialog | 0 | None |
| Reader, desktop | 0 | PDF text/canvas color contrast |
| Document-tools dialog | 0 | None |
| Search, desktop | 0 | PDF text/canvas color contrast |
| Demo interactive form, desktop | 0 | PDF text/canvas color contrast |
| Reader, 390 x 844 viewport | 0 | PDF text/canvas color contrast |
| Actions dialog, 390 x 844 viewport | 0 | None |

The earlier tab semantics, form-label and contrast findings were absent in this
production scan. Closing search restored focus to `#toggle-search`; Escape from
help restored focus to `#help`. All four native form widgets received their actual
PDF field names as fallback accessible names. At the phone viewport, body and
toolbar widths both measured 390 pixels. These results do not resolve the
incomplete PDF-content checks or establish screen-reader compatibility.

## Method and repeatability

`node scripts/audit-accessibility.mjs` visits the running preview specified by
`E2E_BASE_URL` (default `http://127.0.0.1:4173`). It uses installed Microsoft Edge
on Windows by default; `E2E_BROWSER_CHANNEL=chromium` selects the Playwright
Chromium installation. Start the built preview before running the audit.

The script runs axe-core 4.13.0 through `@axe-core/playwright` 4.13.0 with the tags
`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `wcag22aa`, without suppressing
rules or excluding PDF content. It scans the welcome screen, document reader,
search, demo form, 390 x 844 phone-sized reader, and mobile actions dialog.
When present, it additionally scans the device-library, account and document-tools
dialogs without activating remote sign-in or changing a document. It also records
native dialog focus movement, Escape focus restoration, search
closure focus, PDF widget names, and shell width. Raw output is written to
`.cache/accessibility-results.json`; it is diagnostic data, not tracked user data.

This audit script reports findings without making a zero-violations pass claim.
It is not a replacement for the workflow test suite or manual assistive-technology
testing. A browser viewport is not a physical phone or tablet.

## Initial observed findings

The initial Windows Edge audit completed all six states. The following are
observed findings from that rendered preview, not hypothetical advice:

| Finding | Evidence | Required repair/verification |
| --- | --- | --- |
| Low-contrast supporting text | Welcome screen had 11 affected nodes, including `.intro` (3.76:1), drop-zone text (3.34:1), feature descriptions (3.52:1), recent empty state (2.92:1), footer (2.56:1) | Increase contrast against actual backgrounds and rescan all states |
| Reader/status contrast | `.workspace-label` 4.38:1; `.sidebar-title` 3.64:1; status 3.76:1; search status also failed | Repair shared text colors without reducing text legibility in contextual panels |
| Invalid tab-list child semantics | `#tabs[role=tablist]` contains separate close buttons that are not permitted tab descendants | Restructure semantics while preserving document switching and separately accessible close actions; retest arrow navigation |
| PDF form controls lack names | `reader_name`, `review_status`, `approved`, `notes` had no tooltip/title/ARIA label in the sample PDF | Preserve PDF-supplied labels; add native field-name fallback only where a control has no accessible label |
| Search closure loses focus | Clicking search-close left the document body as the active element | Restore focus to the find toggle or active document |

The core owner subsequently added an annotation-layer label fallback from native
field names while preserving existing ARIA, title and HTML labels, and reported a
passing focused Edge form-label regression. The final production audit also
confirmed all four labels.

The mobile actions dialog had zero automatically detected violations in the
initial run. The 390-pixel viewport had body and toolbar widths of 390 pixels,
so that state had no shell horizontal overflow. Escape from the help dialog
returned focus to the help button. Native dialog Tab traversal can momentarily
leave `document.activeElement` at BODY while focus is in browser chrome; that
alone is not evidence that background application controls became focusable.

## Incomplete or untested checks

- Axe marked PDF text-overlay contrast checks incomplete because text spans and
  canvas content overlap. An incomplete check is not a pass. Rendered document
  contrast and reading order need manual review using representative tagged PDFs.
- No NVDA, JAWS, VoiceOver, TalkBack, braille display, or real-device screen-reader
  session was conducted by this audit.
- Keyboard-only annotation creation, complex form grouping, malformed PDF tagging,
  and arbitrary PDF reading order are not established by HTML shell checks.
- Native dialogs, browser zoom, forced-colors mode, mobile OS text scaling, and
  physical stylus/palm behavior require platform-specific validation.
- The original synthetic demo is not a fully tagged PDF/UA document. Rendering a
  selectable text layer does not establish correct semantic reading order.

## Safari, WebKit and native targets

Playwright documents that its WebKit builds are patched versions, often ahead of
Safari, and cannot drive branded Safari. macOS-hosted WebKit is a closer proxy
than Windows/Linux WebKit for platform behavior. `.github/workflows/checks.yml`
now defines a `macos-latest` lane that installs the repository-pinned Playwright
WebKit build and runs the browser workflow suite, including responsive viewport
configurations. The earlier Reader CI run 37121666271 passed 66 cases in that lane. Each new source revision still needs its own run. Passing that lane should
be labeled **WebKit on macOS**, not Safari, iPhone, iPad, or VoiceOver verification.

The current Tauri wrapper shares the web UI/document engine. Its Windows WebView2
and Apple WKWebView need their own runtime tests; native installer compilation
does not establish reader correctness or accessibility. During the earlier audit, the inspected Windows
machine had WebView2 154.0.4258.53 but lacked Rust, cargo, MSVC and the Windows SDK;
`tauri info` confirmed those blockers. Subsequent remote installer builds and actual Windows reader checks passed; see verification for exact revisions. This does not establish native accessibility conformance.
See `src-tauri/README.md` for exact build commands and native verification gates.

## Sources and dependency licensing

Primary sources checked 2026-10-03:

- [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing)
  recommends axe integration alongside manual assessments and inclusive user
  testing; automated checks cover only some accessibility problems.
- [axe-core license](https://github.com/dequelabs/axe-core/blob/develop/LICENSE):
  Mozilla Public License 2.0. Installed `@axe-core/playwright/LICENSE` also contains
  MPL 2.0. Both are test-only dependencies and are not imported by the application.
- [Playwright browser support and WebKit differences](https://playwright.dev/docs/browsers#webkit).
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) and
  [configuration reference](https://v2.tauri.app/reference/config/).

The MPL dependency is used unmodified for development audits. Any redistribution
of its covered files must preserve its license obligations; do not silently copy
it into the application bundle. The test dependency license does not constitute
a licensing decision for the product's own source.

## Repeat the current gate

```sh
pnpm build
E2E_BROWSER_CHANNEL=chromium E2E_START_SERVER=1 pnpm test:e2e tests/e2e/accessibility.spec.ts
```

The 320 x 256 viewport models the CSS layout space available at high zoom, not a real 400% browser/OS zoom session. `:root { font-size: 200% }` checks application text resizing without scaling PDF-authored form/text metrics. Forced-colors and reduced motion use Playwright media emulation. Screenshots are visually inspected in addition to assertions. The legacy audit script remains diagnostic and covers fewer states; the new E2E case is the CI acceptance gate.

## Manual acceptance work still required

Use NVDA/JAWS with Windows Chromium/WebView2, VoiceOver with branded macOS/iOS Safari, and Android TalkBack. Confirm announced names, selected/expanded/current and unsaved state; reading order; dialog focus; search announcements; field editing and errors; export/recovery; and focus visibility under native zoom/high contrast. Include tagged, untagged, scanned and complex form PDFs. The synthetic keyboard form test is not evidence that arbitrary PDFs have correct labels or reading order.

Final screenshot review also caught phone action buttons compressed into columns of broken words. Actions now wrap into readable rows; a minimum readable-width regression and the complete 13-case accessibility gate passed after that correction. OCR/signing dialog screenshots showed readable foreground content despite the automated overlap/incomplete reports; those reports remain available for assistive-technology review.

### Published browser accessibility update

Website version **4** succeeded at **2026-10-03T17:43:53.819048Z** at the existing public URL. Deployment `appgdep_6ac13ecd06308191bb865188a4e9c0d6` uses Site source `63dd341f02c4aa1de98ec82dc657a3c751507be7`, whose tree exactly matches GitHub `86f25470c53cd56e600d51d6c21b7a764e9438f0`. No account, database schema, document engine or PDF-upload behavior changed. The built shell is `index-DIAAStxT.js`; CSS is `index-DwfgPVrD.css`; service-worker manifest is `18be62c44b734fa5`. Publication status was verified through the hosting service; browser workflows ran against production build output in the test harness, not an authenticated production user session.

[Machine-readable evidence](accessibility-verification-2026-10-03.json) retains both engines’ 15-state summaries, including incomplete checks. The final local 79-case run and downloaded macOS 79-case report both had zero failures, retries or skips. Local Linux WebKit setup remained blocked by host dependency validation; actual macOS WebKit CI supplied the second-engine evidence.

### Manual assistive-technology acceptance checklist (not executed)

Use the generated synthetic fixtures and record browser/OS/assistive-technology versions, actual announcements and pass/fail separately for each setup.

| Workflow | Expected outcome to verify manually |
| --- | --- |
| Open two PDFs; switch tabs with arrows/Home/End | Filename, selected tab and named document region remain understandable; focus stays on the tab; Home/End does not also change PDF pages. |
| Open Help, Properties, library and phone Actions; dismiss with Escape | Dialog name/content is announced, focus stays modal, then returns to a visible initiating control. Check both pointer and keyboard activation. |
| Navigate pages and search results | Page/search changes are announced without repeating unchanged status or interrupting form entry. |
| Fill `form.pdf`; export; acknowledge; reopen | Field name/value and unsaved state are announced; keyboard entry and exported value survive reload. |
| Use OS/browser 400% zoom and high contrast | Focus and selected state remain visible; controls and dialog actions can be reached without hover; the PDF remains usable as a two-dimensional document region. |
| Read a tagged PDF and an untagged/scanned PDF | Record actual reading order, headings, links and form groups. Do not infer semantic document accessibility from its visible text layer. |
| VoiceOver/TalkBack on physical phones/tablets | Explore controls, open local files, select text, navigate, dismiss sheets and export without desktop precision; record OS picker/share behavior separately. |

### Merged-source acceptance

Reader CI [37142162437](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37142162437) passed for merge `8b9f1683bf0c47b9c8b2da4d638168c4a1e3b00f`: 63 unit/fixture tests with zero skips on each browser runner, 79 Chromium workflows, 79 macOS WebKit workflows, seven checkpoint and nine signing cases. Browser suites reported no flaky cases. Their elapsed times (2.2 and 4.2 minutes) are test-suite durations, not document latency measurements. The merged tree exactly matches the published website source tree.
