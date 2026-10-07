#!/usr/bin/env python3
"""Gör små typsnittsfiler (bara de tecken sidan behöver) till src/fonts/.

Typsnitten bäddas sedan in i HTML-filen av build.py, så att sidan inte behöver
hämta något från Google Fonts (ingen IP-adress skickas till Google).
Alla typsnitt har licensen SIL Open Font License (OFL), se src/fonts/LICENS.txt.

Kör:  python3 tools/typsnitt.py <mapp med Inter-*.otf> <mapp med Bricolage/JetBrains *.ttf>
"""
import os, sys
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'fonts')
inter_dir, other_dir = sys.argv[1], sys.argv[2]

# Latin (inkl. åäö), skiljetecken, grekiska bokstäver och matematiska tecken som används
UNICODES = ('U+0020-007E,U+00A0-00FF,U+0100-017F,U+0391-03C9,U+2010-2027,U+2030-205E,U+2070-209F,'
            'U+20D7,U+2190-21FF,U+2200-22FF,U+2300-23FF,U+25A0-25FF,U+2600-26FF,U+2713-2717,U+FB01-FB02')

FONTS = [
    (os.path.join(inter_dir, 'Inter-Regular.otf'), 'inter-400.woff'),
    (os.path.join(inter_dir, 'Inter-Italic.otf'), 'inter-400-italic.woff'),
    (os.path.join(inter_dir, 'Inter-Bold.otf'), 'inter-700.woff'),
    (os.path.join(other_dir, 'BricolageGrotesque-Bold.ttf'), 'bricolage-700.woff'),
    (os.path.join(other_dir, 'JetBrainsMono-Regular.ttf'), 'jetbrainsmono-400.woff'),
    (os.path.join(other_dir, 'JetBrainsMono-Bold.ttf'), 'jetbrainsmono-700.woff'),
]

os.makedirs(OUT, exist_ok=True)
for src, name in FONTS:
    opts = subset.Options()
    opts.flavor = 'woff'
    opts.layout_features = ['kern', 'liga', 'calt', 'tnum', 'lnum']
    opts.name_IDs = ['*']
    font = subset.load_font(src, opts)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=subset.parse_unicodes(UNICODES))
    sub.subset(font)
    subset.save_font(font, os.path.join(OUT, name), opts)
    print(name, os.path.getsize(os.path.join(OUT, name)) // 1024, 'kB')
