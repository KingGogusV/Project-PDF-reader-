# Accessibility audit and platform verification boundaries

Checked 2026-10-03 UTC. This is a targeted engineering audit, not a WCAG
conformance certification or a screen-reader compatibility claim.

## Latest result

The final production-preview audit completed at 2026-10-03 01:58 UTC in Microsoft
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
configurations. A configured lane is not a verified run. Passing that lane should
be labeled **WebKit on macOS**, not Safari, iPhone, iPad, or VoiceOver verification.

The current Tauri wrapper shares the web UI/document engine. Its Windows WebView2
and Apple WKWebView need their own runtime tests; native installer compilation
does not establish reader correctness or accessibility. The inspected Windows
machine has WebView2 154.0.4258.53 but lacks Rust, cargo, MSVC and the Windows SDK;
`tauri info` confirmed those blockers. No system SDK installation was performed.
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
