"""Freeze the web legal font's axes for matching editable text in Figma.
Requires fonttools==4.60.2. Run from any directory; the generated TTF is committed.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

assets = Path(__file__).resolve().parents[1] / 'app' / 'assets'
axes = dict(opsz=50, wght=400, GRAD=0, wdth=25, slnt=0, XOPQ=96, YOPQ=79,
            XTRA=468, YTUC=712, YTLC=514, YTAS=750, YTDE=-203, YTFI=738)
def build(family, filename, axis_values):
    font = instantiateVariableFont(TTFont(assets / 'RobotoFlex.ttf'), axis_values, inplace=False)
    # The fixed family exposes one Regular face; visual weight is baked into glyphs.
    font['OS/2'].usWeightClass = 400
    postscript = family.replace(' ', '') + '-Regular'
    names = {1:family, 2:'Regular', 3:postscript+'-1.0', 4:family+' Regular',
             6:postscript, 16:family, 17:'Regular', 21:family, 22:'Regular'}
    for record in font['name'].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding())
    for name_id, value in names.items():
        font['name'].setName(value, name_id, 3, 1, 0x409)
    font.recalcTimestamp = False
    font.save(assets / filename)
    assert 'fvar' not in font, 'Every variation axis must be baked into the static font.'
    print('Built ' + filename)

build('WB Resizer Legal', 'WBResizerLegal-Regular.ttf', axes)
# Reduce counter width with the native XTRA axis; cap height and stroke axes stay fixed.
build('WB Resizer Legal Condensed', 'WBResizerLegalCondensed-Regular.ttf', {**axes, 'XTRA':395, 'wght':350})
