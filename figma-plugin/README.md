# Resizer Banner Import

This is a local development plugin, not a published Community plugin.

## JSON workflow

1. In Resizer, select the format and slide, then click **Export current slide**.
2. In Figma Desktop, use Plugins → Development → Import plugin from manifest.
   Select this directory's `manifest.json`. This setup is needed once.
3. Run **Resizer Banner Import** and select the downloaded `.figma.json` file.

The importer creates a new draft; it does not overwrite existing banners.
The source JSON includes the saved web settings, assets, measured lines, font
axes, geometry, and a browser PNG reference produced by the existing renderer.
The configured renderer must be available to create that reference. No intermediate HTML or manual Figma adjustments are used.
The plugin imports embedded assets offline and needs no network access.

Run `npm run figma:build` after changing `importer.js`. Commit the generated
`code.js` so the manifest can be used without a build step.

## Current scope and validation

The JSON exporter downloads only the selected slide, with both panels and a
single-slide source snapshot. A packshot enabled for another slide does not
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
font features. Imports stay named DRAFT for human acceptance.

**Known blocker:** the available Figma Roboto Flex font lacks the `opsz` axis
used by the application's local font. Native legal text therefore differs.
Install/resolve an equivalent font with matching axes before treating that
output as faithful. The importer reports this; it does not silently replace
the font or convert legal text to a flattened image.

`importer.js` is also the entry point used for automated MCP trials. Its optional
image-hash cache allows identical image assets already in a Figma file to be
reused; it does not alter layout or text.
