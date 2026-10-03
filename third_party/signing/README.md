# LibPDF embedded FontBox notices

Retrieved from the pinned LibPDF `v0.5.1` release tag on 2026-10-03:

- `FontBox-LICENSE.txt`: https://raw.githubusercontent.com/LibPDF-js/core/v0.5.1/src/fontbox/LICENSE.md
- `FontBox-README.md`: https://raw.githubusercontent.com/LibPDF-js/core/v0.5.1/src/fontbox/README.md

These two files are unmodified upstream copies. The license contains Apache-2.0 terms, the original FontBox copyright/BSD attribution, and inherited font notices. The upstream README identifies this component as a TypeScript port of Apache PDFBox FontBox retaining Apache-2.0. Its implementation-status statements describe the upstream component, not Folio.

The published `@libpdf/core@0.5.1` JavaScript bundle contains `src/fontbox/` code, but its npm package includes only the top-level MIT license. Preserve these additional notices alongside the package's MIT license when distributing Folio. Retaining inherited font notices here does not imply that every font mentioned is bundled in Folio.

SHA-256 of the downloaded, unmodified files:

| File | SHA-256 |
| --- | --- |
| FontBox-LICENSE.txt | `614463316e5297b7b9eff36d251f03c1c269e5bae7243f11a7ace98f453c2a7a` |
| FontBox-README.md | `a56dfc53868a59868bbca4d43fcb5265e09ce148293246b79ddfb6f89444ad30` |

No Folio modifications were made to the upstream FontBox implementation. The application imports the pinned npm distribution.
