# Banner export contract

Applies to browser renders and any future Figma export integration. The saved
banner settings and the app's rendered stage are the source of truth.

## Rules

1. Render the existing Vue components and CSS. Do not recreate the design in
   Figma, swap layout presets, change copy sizes, or approximate spacing to make
   an import fit. Use one explicit saved settings snapshot for every output.
2. Apply the production renderer's layout dimensions and output scaling before
   measuring or capturing. Preserve the selected slide and panel order. Capture
   only the stage, with editor controls excluded.
3. Load the exact fonts used by the stage, including local font files. Preserve
   weight, stretch, variation axes, line height, tracking, and explicit line
   breaks. Wait for font loading and heading fitting. Missing fonts fail export;
   do not silently substitute Inter, Arial, or another available family.
4. Decode image assets before capture. Preserve image crop, object position,
   gradients, opacity, clipping, and layer order. Broken images fail export.
5. For Figma, import the original logo SVG as editable vectors. Keep copy as
   editable text. A flattened screenshot is a comparison artifact, never a
   substitute for editable layers.
6. Do not create intermediate HTML by copying computed styles unless all font
   definitions, assets, pseudo-elements and variable font settings are retained
   and the intermediate rendering is verified against the original stage.
7. Resolve CSS font aliases to the same installed font in Figma. A similar name
   is not proof of equivalence. If Figma cannot represent a font or variation,
   report that limitation and mark the editable export incomplete. Do not change
   the typography and describe the result as faithful.
8. Verify one representative portrait, square, landscape and narrow banner
   before exporting a pack. Compare browser and Figma renders at identical pixel
   dimensions. Check headline bounds and line breaks, subheading metrics, logo
   vectors and bounds, CTA bounds, legal font and wrapping, and overlay gradients.
   Ignore differences in photo content only when explicitly requested.
9. Keep the previous export until the replacement passes review. Label an
   unverified import as a draft. A successful upload alone is not validation.

## Enforcement today

`server/utils/export-contract.ts` checks stage text fonts and image decoding,
then waits for layout to settle. Both browser renderer endpoints call it before
capture. This guard does not validate Figma output, CSS background images, video,
or guarantee that text fits: those require separate checks.

The “Export to Figma” action now downloads measured JSON for the selected still
slide. The left panel’s “Export pack to Figma” downloads that slide across the
active pack’s sizes, retaining per-format settings and a browser reference for
each banner. The plugin imports and compares the banners sequentially.
`figma-plugin/importer.js` is the reusable importer; see
[plugin setup and limitations](figma-plugin/README.md). It checks missing fonts,
unsupported axes and text-width differences. The plugin UI also compares its PNG export against the embedded browser PNG
reference. A mismatch or font warning requires review; these checks do not
automatically repair unsupported fonts or guarantee perceptual equivalence.
