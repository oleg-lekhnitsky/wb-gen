# Resizer Banner Import

This is a local development plugin, not a published Community plugin.

## JSON workflow

1. In Resizer, choose a slide. Use **Export current slide** for one size, or **Export pack to Figma** in the left panel for all sizes in the active pack.
2. Click **Download fonts** in the app and install all included OTF/TTF files on the computer running Figma. The ZIP includes WB Sans Medium/Bold, Inter 4.1 (installed family **Inter Variable**, not legacy Inter), Google Sans Bold for Armenian, both fixed legal faces, and the original Roboto Flex for older exports. These are the exact static legal fonts used by the web preview; they keep legal text editable without relying on variable-axis support.
3. In Figma Desktop, use Plugins → Development → Import plugin from manifest.
   Select this directory's `manifest.json`. This setup is needed once.
4. Run **Resizer Banner Import** and select the downloaded `.figma.json` file.

The importer creates a new frame named by its dimensions; it does not overwrite existing banners. Review status remains in the import report. New imports start at the center of the current canvas view; pack frames are placed side by side from that point.
The source JSON includes the saved web settings, assets, measured lines, font
axes, geometry, and a browser PNG reference produced by the existing renderer.
The configured renderer must be available to create that reference. No intermediate HTML or manual Figma adjustments are used.
The plugin imports embedded assets offline and needs no network access.

Run `npm run figma:build` after changing `importer.js`. Commit the generated
`code.js` so the manifest can be used without a build step.

## Current scope and validation

The JSON exporter downloads the selected slide, with both panels and a
single-slide source snapshot. Pack exports contain one measured banner per size,
including its own saved settings and browser reference. The plugin imports and
compares each banner sequentially, reporting warnings per banner. A packshot enabled for another slide does not
block export. Visible SVG packshots become frozen vector assets; canvas packshots
become still images with an explicit warning.

The exporter supports the selected still slide with solid panel backgrounds,
photos, SVG logos, CTA shapes, bottom fade, and editable text. Text shadows import as editable drop-shadow effects; browser/Figma blur rendering still requires visual comparison. Heading highlights import as editable rounded background shapes and colored text runs.
Video, button pulse and split/checker backgrounds are rejected.

Measurements include preview zoom normalization and browser line wrapping.
The importer reports unsupported font axes and text-width differences above
1 px (accounting for CSS trailing letter spacing). Import reports also include
`fontDiagnostics` (requested fonts, resolved fonts and unsupported axes) and
`textDiagnostics` (browser/Figma widths, font runs and measured source lines). It never resizes type to hide
a mismatch. The plugin UI compares the imported PNG with the browser reference
at identical dimensions. It reports mean channel error and the fraction of pixels
whose channel error exceeds 16. Comparison passes only if mean error is at most
1 and the changed fraction is at most 0.5%, with no font warnings. This strict
comparison detects differences; it does not automatically repair unsupported
font features. Review status is reported separately from frame names.

**Legal font:** New exports use **WB Resizer Legal Regular** for independent
sizing and **WB Resizer Legal Condensed Regular** when relative sizing is enabled.
The condensed face uses XTRA 395 and a baked weight of 350. Both are renamed static instances of the original Roboto Flex asset. Their axes are baked into the
glyphs by `scripts/build-legal-font.py` (requires `fonttools==4.60.2`). Install the
committed TTF before importing. Existing JSON files retain their original font
requests and must be exported again to use this font. Armenian continues to use
Google Sans Bold. Font and visual comparison warnings still require review.
