# Local Noto Thai fonts

The application loads these fonts through `next/font/local`; production builds
and visitors do not request Google Fonts. Both WOFF2 files are lossless format
conversions of the official variable Noto Thai v2.002 fonts. No glyphs, weights,
width axes or layout features were subset or removed.

The layout declares the original weights: Sans 400/500/600/700 and Serif
400/600/700, with `display: swap` and the original CSS variables. Automatic
fallback families remain Arial (Sans) and Times New Roman (Serif). Both fonts
retain weight 100–900, width 62.5–100, all 87 assigned Thai characters and all
95 printable Basic Latin characters. Arrow symbols use the existing system
fallbacks.

## Source and conversion

Pinned Google Fonts commit: `2750b521bd22ce141f12617194ab0e04cf5d12d5`.
The official metadata identifies source commit
`f8f3f024703f9d939d02f4e2fe16f1d5a39ca963` in
[notofonts/thai](https://github.com/notofonts/thai).

| Local WOFF2 file | Official TTF source | Source TTF SHA-256 | WOFF2 SHA-256 |
| --- | --- | --- | --- |
| `NotoSansThai-Variable.woff2` | [Google Fonts](https://raw.githubusercontent.com/google/fonts/2750b521bd22ce141f12617194ab0e04cf5d12d5/ofl/notosansthai/NotoSansThai%5Bwdth%2Cwght%5D.ttf) | `5a1c559bb539583c8a1fd99d1c5b9491e5e14478c9cd2bd0970d5c3096cc9ef8` | `1818fefa9e7b12ce86654fc3bab74a7abdf905324a251ce74647505eda5cf6a3` |
| `NotoSerifThai-Variable.woff2` | [Google Fonts](https://raw.githubusercontent.com/google/fonts/2750b521bd22ce141f12617194ab0e04cf5d12d5/ofl/notoserifthai/NotoSerifThai%5Bwdth%2Cwght%5D.ttf) | `34a7ad11647c845303aabdde639059806c56b84719e5d2ceb28eb038711bdf53` | `e70485db74da1fdeee3328388c884148fa7a1437eb827c0970ccf5c9503f388e` |

Conversion tools: FontTools **4.67.0**, Brotli **1.2.0**. For each pinned TTF:

```python
from fontTools.ttLib import TTFont
font = TTFont(source_path, recalcBBoxes=False, recalcTimestamp=False)
font.flavor = 'woff2'
font.save(output_path)
```

Round-trip verification against each source TTF retained identical character
maps, glyph order, variation axes and all 467 glyph outlines (coordinates,
contour endpoints and flags). `cmap`, `fvar`, `gvar`, `avar`, `HVAR`, `GPOS`,
`GSUB` and the remaining checked tables (17 total) were byte-identical when
read back.
The two WOFF2 files total **241,352 bytes**, compared with **510,840 bytes**
for the source TTFs.

Both families use the identical copyright notice and SIL Open Font License 1.1;
the complete license text is in [OFL.txt](OFL.txt), with upstream trailing
whitespace normalized and wording preserved. Keep it when
copying or redistributing the fonts. Internal font names, outlines and features
remain unchanged.

To update, choose a new official commit, download both TTFs and their OFL files,
verify licenses, repeat the lossless conversion and round-trip checks, update
these checksums, and run the static build without a Google Fonts response. The
showcase generator and migration copy this four-file package to each new site.
