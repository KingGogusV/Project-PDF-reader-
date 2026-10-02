# Product reference research

Research checked: **2026-10-02**. Product: **Folio**. This report covers product references, not Folio's implementation or platform verification. Consult `PROJECT.md` for actual feature status.

## Evidence rules

- **FACT**: directly observed public source contents or behavior documented by the product owner. Documentation is evidence of a documented capability, not independent runtime verification.
- **DEVELOPER CLAIM**: architecture, privacy, performance, compatibility, or quality assertion supplied by the developer without independent testing here.
- **INFERENCE**: our interpretation of the evidence.
- **DESIGN DECISION**: a choice for Folio.
- **UNRESOLVED QUESTION**: evidence or testing still needed.

No Adobe or RevPDF application was installed or benchmarked for this research. No proprietary code or assets were reused. A source's update date is recorded where available; a recent page date does not establish that every paragraph is current. Adobe's Reader FAQ still contains legacy references such as Windows Phone, so those references are not treated as current platform support.

## Adobe Acrobat Reader

**FACT:** Adobe documents Reader as the free viewing, printing, searching, commenting, signing, and sharing application. Its desktop targets are Windows and macOS; current mobile documentation covers Android and iOS. The free product does not provide permanent editing of existing PDF text/images. Reader's general FAQ documents notes, text comments, highlights, underline, strikethrough, and freehand markup. [A1]

**FACT:** Reader navigation documentation covers page numbers, previous/next navigation, thumbnails, bookmarks, zoom/fit, and scrolling/multipage arrangements. Saving a separate copy is a documented workflow. [A2]

**INFERENCE:** The useful benchmark for Folio's first release is a coherent reading/review/save loop. Reproducing every paid Acrobat tool would dilute this goal and create disproportionate PDF mutation risk.

## Adobe Acrobat / Acrobat Pro

**FACT:** Adobe's comparison page assigns editing, page organization, conversion, and password protection to Standard; Pro adds OCR/editable scans, document comparison, redaction, and advanced signature workflows. Studio combines Pro with AI Assistant, PDF Spaces, and Express Premium. This is a capability benchmark, not a pricing commitment or a complete entitlement contract. [A3]

### Capability matrix

Legend: **Reader** means a documented free Reader baseline unless qualified. **Acrobat** means a paid/editor workflow or an Acrobat documentation scope whose exact Reader entitlement needs separate validation. **Service** means an optional account, cloud, AI, or collaboration workflow. The last column prevents assuming cross-platform equivalence.

| Capability requested for research | Free Reader benchmark | Paid / Acrobat Pro distinction | Optional cloud / AI / collaboration and platform caveat |
|---|---|---|---|
| Open and view local PDFs | Core Reader behavior [A1] | Paid tools extend processing | Web online-tool processing uploads files [A4] |
| Recent files | Home/recent-file access [A1] | Not a justification for paid-only local history | Cross-device recents use Adobe services; not equivalent to local path access |
| Multiple documents / tabs | Reader multiple-window viewing is documented [A11]; exact present tab behavior not run-tested | No claim that tab behavior is Pro-only | Mobile simultaneous-tab parity unresolved |
| Page navigation | Page number, next/previous, first/last [A2, A10] | Same baseline with editing tools | Do not assume keyboard/window conventions on phones |
| Thumbnail navigation | Documented Reader navigation [A2] | Page organization is separate | Thumbnail UI arrangement differs by viewport |
| Bookmarks / outlines | Navigate existing bookmarks [A2, A10] | Authoring document structure is separate | Bookmarks can also participate in desktop search [A9] |
| Zoom | Reader magnification controls [A2] | Not inherently a paid capability | Mobile reflow is a different feature from zoom [A8] |
| Fit page / fit width | Reader fit options; Acrobat view documentation details fitting [A2, A11] | Not content editing | Browser zoom and PDF zoom must be distinguished |
| Rotate view | Acrobat viewing documentation covers rotation [A11] | Permanent page rotation belongs to page organization | A view transform must not imply saved page rotation |
| Full-screen / presentation | Viewing behavior; exact current platform controls not tested | Presentation authoring is a separate workflow | Browser/OS full-screen availability differs; mobile parity unresolved |
| Text selection / copy | Allowed subject to document permissions [A5] | Export to editable formats is separate | Snapshot/whole-file clipboard behaviors have desktop-specific limits [A5] |
| Search / next and previous match | Reader search baseline [A1, A2] | Search-and-replace is editing | Search within a PDF differs from account/cloud-file search |
| Advanced search | Reader documents advanced search [A2]; desktop guide details multidocument/options/index searching [A9] | Catalog/index creation explicitly refers to Pro [A9] | Exact entitlement for every advanced option unresolved; no modern web/mobile parity assumed |
| Printing | Page/range selection, scaling, orientation, comments/forms [A6] | Professional print-production tooling is separate | Duplex depends on printer/driver; mobile/browser output must use platform flow |
| Annotations | Reader review tools [A1] | Editing original content is distinct | Shared review introduces remote collaboration |
| Highlights / underline / strikethrough | Documented Reader commenting tools [A1] | Not text replacement | Mobile documentation confirms annotations, not identical tool layout [A7] |
| Sticky notes / comments | Reader notes/comments [A1] | No Pro requirement for basic comments | Online shared comments require service context |
| Freehand drawing | Documented Reader review tool [A1] | Not image/content editing | Stylus/palm behavior not verified |
| Text annotation | Reader can add review text [A1] | Does not edit existing text [A1] | Save/reopen correctness still requires independent testing |
| Shapes | Detailed free-tool and mobile parity unresolved | Acrobat review capability scope must be checked per tool | Do not equate an annotation category with every shape supported everywhere |
| Interactive forms | Existing fields can be completed [A12] | Form creation is a different task | Dynamic/XFA/scripted parity must not be assumed |
| Fill & Sign / flat forms | Text/symbol overlay workflow distinct from interactive fields [A12] | Form-field construction is not the same operation | Web fill/sign available with account, subject to document/tool restrictions [A4] |
| Basic signatures | Type/draw/import a visible signature [A13] | Not certificate validation | Optional saved-signature sync uses cloud [A13] |
| Document sharing | Reader can share PDFs [A1] | Advanced request/tracking workflows vary by plan | Cloud links, review state, accounts, and file transfers are separate from local saving |
| Accessibility | Preferences, screen-reader support, document colors [A14] | Accessible-document authoring/remediation is separate [A1] | Mobile reflow/VoiceOver/TalkBack does not imply all PDFs become accessible [A8] |
| Protected documents | Respect restrictions; inspect security permissions [A5] | Creating/changing protection is paid [A3] | Authorization to open does not imply permission to edit/copy |
| Password-protected PDFs | Password/restriction behavior is a compatibility requirement | Protection authoring is a separate capability | Liquid Mode excludes protected documents; online workflows have limitations [A8] |
| Attachments | Viewing/security behavior needs tool-specific verification | Adobe documents adding embedded attachments in Acrobat [A15] | Do not execute or automatically extract arbitrary attachments |
| Metadata / properties | Reader exposes document properties/security [A5] | Broader property/metadata management documented in Acrobat [A16] | Fonts, encryption, title/author, and custom metadata are different data categories |
| Digital signatures / certificates | Must remain distinct from visual signature placement | Acrobat documents certificate validation and certification [A17, A18] | Exact Reader creation/validation entitlements and mobile parity unresolved; trust/timestamp services differ |
| OCR / scan conversion | Outside the basic Reader editing baseline | Pro OCR; some mobile subscription packages include OCR [A3, A7] | Adobe Scan is a separate mobile capture application [A3] |
| AI document assistance | Not required for local reading | Studio includes AI features [A3] | Treat summarization, PDF Spaces, and AI actions as optional service scope |

### Adobe platform differences

| Environment | Evidence-backed distinction | Implication for Folio |
|---|---|---|
| Desktop Windows / macOS | Reader is documented for both; native printing, clipboard distinctions, side panels, and desktop advanced search have specific workflows [A1, A5, A6, A9] | Keep keyboard and window workflows where useful, but do not make them prerequisites for core functions |
| Browser / web | Online tools are service workflows. Adobe says uploaded files go to cloud storage; free-tool transactions have limits and account-dependent behavior [A4] | A browser UI need not copy this architecture; Folio's document bytes should remain local |
| Tablet | Adobe's mobile app provides free view/comment/fill/sign; Liquid Mode targets phone and tablet readability [A7, A8] | Use collapsible panels and touch controls, not a reduced desktop screenshot |
| Phone | Mobile paid offerings differ from desktop subscriptions and by region. Reader Plus is mobile-only; other entitlements have limitations [A7] | Define capability status separately from package or subscription assumptions |
| Linux | No native Linux Reader support established in the reviewed current Reader support statement [A1] | Folio browser support on Linux is its own test target, not inherited Adobe parity |

**FACT:** Liquid Mode reformats supported documents, supports mobile screen readers, and is documented as server-processed. Its exclusions include large/long documents, scans, encryption, and complex layouts; original view remains available. [A8]

**DESIGN DECISION:** Do not implement speculative reflow by rewriting a page's extracted text and call it accurate PDF rendering. Keep fixed-layout fidelity as the baseline and record reading-order limitations.

**FACT:** Adobe distinguishes certificate validation (trust and signed content) from certification (a digital ID, allowed changes, and saving a certified document). [A17, A18]

**DESIGN DECISION:** A drawn or typed mark must be labeled a basic visible signature. Folio must not claim cryptographic validity, certificate trust, identity verification, or preservation of existing signatures without a tested implementation.

## RevPDF from revpdf.com

This is the product by Pawandeep Singh, associated with `Pawandeep-prog/revpdf-release`. It is distinct from `bikash1376/revpdf` and `revpdf.in`.

**DEVELOPER CLAIM:** The current site advertises RevPDF 5.0 with local content editing, review, page organization, form filling, basic signing, OCR, compression, conversion, comparison, and repeatable workflows. [R1]

**FACT:** The developer's February 10, 2026 build log identifies Flutter, C++, and CMake and explicitly describes the application as closed-source. **DEVELOPER CLAIM:** That post reports approximately 30 MB installation size, 0.7-second cold start, 55 MB idle RAM, and 0.9 seconds to open a 50-page PDF. The device, measurement methodology, and representative workload are insufficient for a Folio performance baseline; none of these numbers was reproduced. The same post lists basic rather than advanced digital signatures, and no 3D, cloud sync, or plugins. [R2]

**DEVELOPER CLAIM:** The feature page describes text reflow editing; PDF comparison; text markup, comments, ink/shapes; find/replace; tabs/bookmarks; permanent redaction; form authoring/filling; signing; headers/footers; watermarks; workflow automation; compression; merge/split; page organization; metadata; OCR; Word/Excel/image conversion; and PDF/A-2a output. Its large-document improvements are qualitative, not an independent benchmark. These capabilities and preservation claims were not executed or validated. [R3]

**FACT:** Download offerings include Windows, macOS, Linux, Android, and iOS/iPadOS. Desktop binaries and mobile store distributions are separate; the download page does not establish a browser application or uniform feature parity. [R4]

**FACT:** The privacy policy dated August 25, 2026 says local processing coexists with update/font connections, mobile advertising/store services, scanner components, and model downloads. It discloses local recovery copies, OCR/thumbnail caches, signatures, recent paths, settings, and retention limits. Thus “local processing” is not equivalent to “no network traffic.” [R5]

**FACT:** Terms dated August 24, 2026 grant limited use, preserve ownership, describe desktop-free/mobile-premium distribution, and disclose mobile AdMob initialization before premium entitlement is known. [R6]

**INFERENCE:** Useful concepts are focused document workflows, bounded caches, recovery awareness, local computation, and explicit network boundaries. Copying every advanced feature or its native-only architecture would be unjustified for Folio's browser-inclusive goal. Avoid remote font dependencies for an offline reader; startup and loaded-document memory must be measured separately.

**UNRESOLVED QUESTIONS:** Actual PDF engine, licensing of the private dependency stack, exact allocation/render scheduling, per-platform feature completeness, mutation fidelity, accessibility quality, and independent large-file measurements cannot be established from these public claims.

## Pawandeep-prog/revpdf-release

**FACT:** The inspected default-branch listing contains README, LICENSE, image assets, and distribution metadata, not the application implementation. The README explicitly calls this an official release repository and links desktop binaries. [R7]

**FACT:** Its EULA reserves rights, permits desktop use and conditional redistribution of unchanged official binaries, and forbids modification, derivative works, reverse-engineering, sublicensing/selling, removal of notices, and misleading branding without further permission. This is not an open-source license. [R8]

**DESIGN DECISION:** Reuse no source, binary components, images, logos, or interface assets from this repository. Treat publicly documented product ideas only as comparison material. A public GitHub page is not permission to incorporate a program.

## bikash1376/revpdf

**FACT:** Public GitHub API and raw-source reads succeeded on 2026-10-02, although the web retrieval service failed on the repository URL. The API reported default branch `main`, MIT metadata, and last push `2026-07-12T09:01:34Z`. Actual code is present. The README identifies `revpdf.in`, confirming separate product identity. [B1, B2]

**FACT:** The package manifest specifies Expo 54, React Native 0.81.5, React 19.1, Expo Router 6, React Native Paper, Zustand, Expo SQLite, React Native WebView, a bottom-sheet library, and PDF.js `^3.11.174`. Its root `web` script invokes Expo web; a separate `web/` directory contains an Astro marketing site. Neither fact proves a browser reader works. [B3, B4]

**FACT:** The root LICENSE is MIT text, but its copyright names Expo/650 Industries rather than this application's author. It grants broad reuse subject to notice preservation, but does not individually establish provenance for every asset/dependency. [B5]

**DESIGN DECISION:** Do not copy this application's source or assets. Adopt only independently implemented architectural ideas. Current dependency review remains necessary even when the host project declares MIT.

### Observed architecture from source

- **FACT:** `ReaderWebView.tsx` hosts an HTML reader and communicates through an explicit message/command bridge. It reads a whole local document as base64, injects it into the WebView, and rejects documents over 100 MB because of memory expansion concerns. HTML-loading failure falls back to an empty page in this source. [B6]
- **FACT:** `src/db/index.ts` defines local SQLite tables for documents, progress/locations, highlights, and bookmarks. PDF highlights use serialized page/rectangle anchors. Database persistence of an overlay is not evidence that a saved PDF contains that annotation. [B7]
- **FACT:** `src/reader/bridge.ts` validates message shapes and external-link schemes before passing them to the host. The controller uses PDF.js, a text layer, a blob worker, `isEvalSupported: false`, and an `IntersectionObserver` near the viewport. [B8, B9]
- **FACT:** `scripts/build-reader.mjs` bundles libraries, the PDF worker, and reading fonts into generated HTML and sets a restrictive content-security policy without remote document-resource origins. [B10]
- **DEVELOPER CLAIM:** README describes local multi-format reading, themes, long-press highlighting, and selected-text web-search bottom sheets. Selection search can intentionally send selected text to a search provider; “local document reader” alone does not make every interaction offline. [B2]

**INFERENCE:** The transferable idea is shared rendering logic behind an explicit platform boundary, with local reading state and adaptive controls. The whole-file base64 transfer adds memory copies and serialization work, making it unsuitable as an unquestioned large-document design. Source presence, scripts, and marketing screenshots are not platform verification.

**UNRESOLVED QUESTIONS:** PDF annotation export, form persistence, certificate handling, printing quality, physical-device behavior, web compatibility of native modules, full license/asset provenance, and benchmarks were not established. Avoid describing this project as a complete Acrobat replacement.

## Folio decisions informed by these references

1. **DESIGN DECISION:** Original branding and interface. No Adobe or RevPDF source/design-asset reuse.
2. **DESIGN DECISION:** A shared browser-capable document core and adaptive UI provide the initial cross-platform foundation. Native adapters are a future integration choice, not a claim of shipped native applications.
3. **DESIGN DECISION:** Reading, navigation, text search, review annotations, forms, and safe export precede advanced destructive editing. Feature visibility follows actual engine capabilities and tests.
4. **DESIGN DECISION:** Annotation overlays/local state are not sufficient proof of PDF modification. Save/export must produce bytes that reopen with retained changes and unaffected content.
5. **DESIGN DECISION:** Original bytes remain preserved. Never silently overwrite a sole source, discard unsaved edits, bypass permissions, execute PDF JavaScript, or follow launch actions.
6. **DESIGN DECISION:** Network-independent document processing is separately verified from loading the application. Bundle required rendering assets; document any intentional external-link flow.
7. **DESIGN DECISION:** Performance claims need repeatable fixtures, engine/build versions, measured timing boundaries, and the actual tested environment. Do not inherit competitors' figures.

## Source register

All accessed **2026-10-02**. URLs are primary sources. Dates below are publisher update dates when visible; otherwise the access date is the observation date. Source listings are evidence, not permission to copy assets or code.

### Adobe

- **A1** — [Reader FAQ](https://helpx.adobe.com/reader/desktop/faq.html), updated 2026-06-21.
- **A2** — [Reader save/view/search](https://helpx.adobe.com/reader/desktop/save-view-search-pdfs.html), updated 2026-06-21.
- **A3** — [Acrobat plan comparison](https://www.adobe.com/acrobat/pricing/compare-versions.html), current page observed.
- **A4** — [Acrobat online services FAQ](https://helpx.adobe.com/document-cloud/faq/try-acrobat-online-services.html), updated 2025-06-02.
- **A5** — [Reader copy permissions and clipboard](https://helpx.adobe.com/reader/desktop/copy-content-pdfs.html), updated 2026-06-21.
- **A6** — [Reader printing](https://helpx.adobe.com/reader/desktop/print-pdfs.html), updated 2026-06-21.
- **A7** — [Mobile subscriptions and free access](https://www.adobe.com/devnet-docs/acrobat/ios/en/managingsubscriptions.html), updated 2026-08-18.
- **A8** — [Liquid Mode behavior and limitations](https://www.adobe.com/devnet-docs/acrobat/ios/en/lmode.html), current page observed; no current version-independent guarantee inferred.
- **A9** — [Acrobat search](https://helpx.adobe.com/acrobat/using/searching-pdfs.html), updated 2026-02-26.
- **A10** — [Desktop navigation](https://helpx.adobe.com/acrobat/desktop/get-started/learn-the-basics/navigation.html), updated 2025-09-23.
- **A11** — [Adjusting PDF views](https://helpx.adobe.com/acrobat/using/adjusting-pdf-views.html), current page observed.
- **A12** — [Reader form filling](https://helpx.adobe.com/reader/desktop/fill-forms.html), updated 2026-06-21.
- **A13** — [Reader signatures](https://helpx.adobe.com/reader/desktop/sign-pdfs.html), updated 2026-06-21.
- **A14** — [Reader accessibility](https://helpx.adobe.com/reader/desktop/accessibility-features.html), updated 2026-06-21.
- **A15** — [Acrobat attachments](https://helpx.adobe.com/acrobat/desktop/edit-documents/use-links-and-attachments/add-attachment.html), updated 2026-05-27.
- **A16** — [Properties and metadata](https://helpx.adobe.com/acrobat/desktop/edit-documents/edit-pdf-properties/pdf-properties.html), updated 2025-09-23.
- **A17** — [Digital signature validation](https://helpx.adobe.com/acrobat/desktop/e-sign-documents/manage-digital-signatures/validate-digital-sign.html), updated 2025-09-23.
- **A18** — [Certificate signatures](https://helpx.adobe.com/acrobat/desktop/e-sign-documents/manage-digital-signatures/certify-pdfs.html), updated 2025-09-23.

### revpdf.com / Pawandeep

- **R1** — [Product homepage](https://revpdf.com/).
- **R2** — [Developer architecture/build log](https://revpdf.com/blog/how-i-built-a-15mb-pdf-editor), dated 2026-02-10; URL says 15 MB, current title/body says about 30 MB. Do not infer historical binary sizes from the URL.
- **R3** — [Feature catalog](https://revpdf.com/features).
- **R4** — [Platform downloads](https://revpdf.com/download).
- **R5** — [Privacy policy](https://revpdf.com/privacy), modified 2026-08-25.
- **R6** — [Terms](https://revpdf.com/terms), updated 2026-08-24.
- **R7** — [Release repository](https://github.com/Pawandeep-prog/revpdf-release).
- **R8** — [Release EULA](https://github.com/Pawandeep-prog/revpdf-release/blob/main/LICENSE).

### bikash1376 / revpdf.in

- **B1** — [Repository API metadata](https://api.github.com/repos/bikash1376/revpdf).
- **B2** — [README](https://github.com/bikash1376/revpdf/blob/main/README.md), inspected through its raw URL.
- **B3** — [Package manifest](https://github.com/bikash1376/revpdf/blob/main/package.json), inspected through its raw URL.
- **B4** — [Source tree API](https://api.github.com/repos/bikash1376/revpdf/git/trees/main?recursive=1).
- **B5** — [License](https://github.com/bikash1376/revpdf/blob/main/LICENSE), inspected through its raw URL.
- **B6** — [Reader WebView host](https://github.com/bikash1376/revpdf/blob/main/src/components/ReaderWebView.tsx), inspected through its raw URL.
- **B7** — [SQLite model](https://github.com/bikash1376/revpdf/blob/main/src/db/index.ts), inspected through its raw URL.
- **B8** — [Reader bridge](https://github.com/bikash1376/revpdf/blob/main/src/reader/bridge.ts), inspected through its raw URL.
- **B9** — [Reader controller](https://github.com/bikash1376/revpdf/blob/main/src/reader-web/controller.js), selected relevant source inspected through its raw URL.
- **B10** — [Reader bundle script](https://github.com/bikash1376/revpdf/blob/main/scripts/build-reader.mjs), inspected through its raw URL.
