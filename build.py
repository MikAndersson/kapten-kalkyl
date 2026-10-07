#!/usr/bin/env python3
"""Bygger Kapten Kalkyl från källfilerna i src/ och lessons/.

Resultat i dist/:
  kapten-kalkyl/index.html     lektionerna och övningstentan (med inbyggd kopia av lektioner och mallar)
  kapten-kalkyl/lessons/       lektionsfilerna (XML) + index.xml
  kapten-kalkyl/mallar/        tentamallarna G.xml och VG.xml
  kapten-kalkyl/LÄSMIG.txt     instruktioner
  kapten-kalkyl-editor/editor.html   lektionseditorn (separat, delas bara med den som skriver lektioner)
  kapten-kalkyl-editor/tools/        generera_mallar.py
  kapten-kalkyl-editor/kallkod/      all källkod + build.py (för att bygga om)
  artefakt.html, artefakt-editor.html   samma sidor utan <html>-skal (för publicering)
  Kapten_Kalkyl.zip       elevversionen packad
  Kapten_Kalkyl_editor.zip     editorn + verktyg packade
  github/kapten-kalkyl/        färdig mapp för ett GitHub-projekt (GitHub Pages), även som Kapten_Kalkyl_GitHub.zip
Med --github skrivs index.html och editor.html i stället direkt i projektmappen (används i GitHub-projektet).
"""
import glob, os, shutil, sys, zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
DIST = os.path.join(ROOT, 'dist')
APP = os.path.join(DIST, 'kapten-kalkyl')

read = lambda p: open(p, encoding='utf8').read()

def banner(title):
    line = '#' * 74
    return f'\n/* {line}\n   {title}\n   {line} */\n\n'

MATHJAX = r'''<script>
  /* MathJax-inställningar (LaTeX -> SVG). \enh{kN} skriver en enhet. */
  window.MathJax = {
    tex: {
      inlineMath: [['\\(', '\\)']],
      displayMath: [['\\[', '\\]']],
      macros: { enh: ['\\,\\mathrm{#1}', 1] }
    },
    svg: { fontCache: 'global' },
    options: { enableMenu: false },
    startup: {
      typeset: false,
      ready() {
        MathJax.startup.defaultReady();
        MathJax.startup.promise.then(() => window.dispatchEvent(new Event('mathjax-ready')));
      }
    }
  };
</script>
<script async id="MathJax-script" src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.js" onerror="window.dispatchEvent(new Event('mathjax-failed'))"></script>'''

HEAD_COMMENT = {'student': '''<!--
  KAPTEN KALKYL – uppläst repetitionslektion och övningstenta.
  Lektionerna ligger som XML-filer i mappen lessons/ och tentamallarna i mallar/.
  Läs LÄSMIG.txt för hur man lägger till, ändrar och sorterar lektioner och mallar.

  Filen är ordnad så här:
    1. CSS (utseende)        2. HTML (stomme)
    3. Inbyggd kopia av lektioner och mallar (används när filen öppnas direkt från datorn)
    4. JavaScript: kursinställningar, figurer, exempeltentan, gemensam kod, elevdelen
-->''', 'editor': '''<!--
  KAPTEN KALKYL – LEKTIONSEDITOR (separat fil).
  Skapar och ändrar lektionsfiler (XML) med ett formulär och förhandsvisning.
  Filen är ordnad: CSS, HTML, inbyggd kopia av lektionerna, JavaScript.
-->'''}

FONT_FACES = [   # (familj, fil i src/fonts, vikt, stil)
    ('Inter', 'inter-400.woff', '400', 'normal'),
    ('Inter', 'inter-400-italic.woff', '400', 'italic'),
    ('Inter', 'inter-700.woff', '600 800', 'normal'),
    ('Bricolage Grotesque', 'bricolage-700.woff', '500 900', 'normal'),
    ('JetBrains Mono', 'jetbrainsmono-400.woff', '400', 'normal'),
    ('JetBrains Mono', 'jetbrainsmono-700.woff', '600 800', 'normal'),
]

def font_faces():
    """@font-face med typsnitten inbakade (base64), så att sidan fungerar utan att hämta typsnitt utifrån."""
    import base64
    rules = []
    for family, name, weight, style in FONT_FACES:
        data = base64.b64encode(open(os.path.join(SRC, 'fonts', name), 'rb').read()).decode()
        rules.append(f"@font-face{{font-family:'{family}';font-style:{style};font-weight:{weight};font-display:swap;"
                     f"src:url(data:font/woff;base64,{data}) format('woff')}}")
    return '<style>\n/* Typsnitt (SIL Open Font License, se src/fonts/LICENS.txt): Inter, Bricolage Grotesque, JetBrains Mono */\n' + '\n'.join(rules) + '\n</style>'

# ---------- Formelbladet ----------
# Lärarens godkända formelblad ligger orört i src/formelblad/formelblad.html. Bygget gör en kopia som:
#  - inte hämtar Google Fonts (Inter ligger inbakat i stället) och saknar årskurskod (t.ex. "· TR26"),
#  - har data-kort="…" på varje kort (från kommentaren "KORT: <titel>"), så att minitentorna kan visa utvalda kort,
#  - har ett litet skript som tar emot vilka kort som ska visas från Kapten Kalkyl.
FORMELBLAD_SKRIPT = """
<style>
/* Tillagt av Kapten Kalkyl */
.kk-dold { display: none !important; }
body.kk-utvalt .page { margin: 0 auto; box-shadow: none; }
body.kk-utvalt .page__head { display: none; }
body.kk-utvalt .band, body.kk-utvalt .cols { display: flex; flex-direction: column; }
body.kk-utvalt .col, body.kk-utvalt .stack { display: contents; }
body.kk-utvalt .card { flex: none; }
</style>
<script>
/* Kapten Kalkyl skickar {formelblad: 'visa', kort: ['procent', …]} för utvalda kort, eller kort: null för hela bladet. */
(function () {
  function visa(kort) {
    var utvalt = Array.isArray(kort) && kort.length > 0;
    document.body.classList.toggle('kk-utvalt', utvalt);
    document.querySelectorAll('[data-kort]').forEach(function (c) {
      c.classList.toggle('kk-dold', utvalt && kort.indexOf(c.dataset.kort) < 0);
    });
    // Göm sektioner och sidor där inget kort syns
    document.querySelectorAll('.section, .page').forEach(function (el) {
      var synliga = [].some.call(el.querySelectorAll('[data-kort]'), function (c) { return !c.classList.contains('kk-dold'); });
      el.classList.toggle('kk-dold', !synliga);
    });
    window.scrollTo(0, 0);
  }
  window.addEventListener('message', function (e) {
    if (e.data && e.data.formelblad === 'visa') visa(e.data.kort);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'f' || e.key === 'F') parent.postMessage({ formelblad: 'stang' }, '*');
  });
  parent.postMessage({ formelblad: 'redo' }, '*');
})();
</script>
"""

def kort_slug(title):
    """'Tid ↔ decimaler' -> 'tid-decimaler', 'Vektorer · komponenter …' -> 'vektorer'."""
    import re, unicodedata
    title = title.split('·')[0].strip().lower()
    title = unicodedata.normalize('NFKD', title).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', title).strip('-')

def formelblad():
    """Den rensade kopian av formelbladet (en hel HTML-sida) eller None om det saknas."""
    import re
    path = os.path.join(SRC, 'formelblad', 'formelblad.html')
    if not os.path.exists(path):
        return None
    html = read(path)
    html = re.sub(r'\s*<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>', '', html)
    html = re.sub(r'<!-- Typsnitt:.*?-->', '<!-- Typsnitt: Inter, inbakat av Kapten Kalkyl (inget hämtas utifrån). -->', html, flags=re.S)
    html = re.sub(r'\s*·\s*[A-ZÅÄÖ]{1,4}\d{2}(?=\s*<)', '', html)   # årskurskoden, t.ex. " · TR26"
    html = re.sub(r'(--font-head:\s*)"Roboto",', r"\1'Inter',", html)
    html = re.sub(r'(--font-ui:\s*)"Raleway",', r"\1'Inter',", html)
    html = re.sub(r'(--fw-head:\s*)500', r'\g<1>600', html)
    def tag(m):
        return f'{m.group(1)}<section data-kort="{kort_slug(m.group(2))}"'
    html = re.sub(r'(<!-- KORT: (.+?)\s+\([a-z]+\) -->\s*)<section', tag, html)
    faces = [f for f in font_faces().split('\n') if "'Inter'" in f and 'italic' not in f]
    html = html.replace('</head>', '<style>\n' + '\n'.join(faces) + '\n</style>\n</head>', 1)
    html = html.replace('</body>', FORMELBLAD_SKRIPT + '</body>', 1)
    return html

def formelbibliotek():
    """Formlerna ur formelbladet som SVG-symboler, så att en övningsfråga kan visa just
    den formel som behövs (<testa formelblad="f-procent-3">). Ger (html, js) eller ('', '')."""
    import re, json
    path = os.path.join(SRC, 'formelblad', 'formelblad.html')
    if not os.path.exists(path):
        return '', ''
    html = read(path)
    start = html.index('FORMELBIBLIOTEK')
    begin = html.index('<svg width="0"', start)
    lib = html[begin:html.index('</svg>', begin) + len('</svg>')]
    lib = lib.replace('<svg ', '<svg id="formelbibliotek" ', 1)
    # Etikett och storlek för varje formel: kortets titel och närmaste rubrik ovanför
    body = html[html.index('<body'):start]
    meta, card, label = {}, '', ''
    # Formler som står som text (<div class="math">) får namn som m-skala-1, m-skala-2 …
    count = {}
    for m in re.finditer(r'<!-- KORT: (.+?)\s+\(|<h3 class="[^"]*">(.*?)</h3>|<svg class="fx" viewBox="([^"]+)"[^>]*><use href="#(f-[a-z0-9-]+)"|<div class="math">(.*?)</div>', body, re.S):
        if m.group(1):
            card, label = m.group(1).split('·')[0].strip(), ''
        elif m.group(2) is not None:
            label = re.sub(r'<[^>]+>', '', m.group(2)).strip()
        elif m.group(5) is not None:
            slug = kort_slug(card)
            count[slug] = count.get(slug, 0) + 1
            meta[f'm-{slug}-{count[slug]}'] = {'html': re.sub(r'\s+', ' ', m.group(5)).strip(), 'kort': card, 'rubrik': label}
        elif m.group(4) not in meta:
            meta[m.group(4)] = {'vb': m.group(3), 'kort': card, 'rubrik': label}
    colors = dict(re.findall(r'--(v-start|v-end|v-change|v-steps):\s*(#[0-9a-fA-F]{3,6})', html))
    css = '\n'.join(f'#formelbibliotek .{k}{{fill:{v}}}' for k, v in colors.items())
    css += '\n' + '\n'.join(f'.fbm .{k}{{color:{v}}}' for k, v in colors.items())
    return (f'<!-- Formlerna ur formelbladet (skapas av build.py ur src/formelblad/formelblad.html) -->\n'
            f'<style>{css}</style>\n{lib}',
            'const FORMELBLAD_FORMLER = ' + json.dumps(meta, ensure_ascii=False) + ';')

def lesson_files():
    return sorted(f for f in glob.glob(os.path.join(ROOT, 'lessons', '*.xml')) if not f.endswith('index.xml'))

def template_files(include_index=False):
    files = sorted(glob.glob(os.path.join(ROOT, 'mallar', '*.xml')))
    return files if include_index else [f for f in files if not f.endswith('index.xml')]

def listed_template_files():
    """Mallfilerna som står i mallar/index.xml (utan visa="nej")."""
    import xml.etree.ElementTree as ET
    index = ET.parse(os.path.join(ROOT, 'mallar', 'index.xml')).getroot()
    return [os.path.join(ROOT, 'mallar', f.text.strip()) for f in index.iter('fil') if f.get('visa') != 'nej']

def js_files(folder):
    return sorted(glob.glob(os.path.join(SRC, folder, '*.js')))

def build_body(kind):
    parts = []
    parts.append('<title>Kapten Kalkyl</title>' if kind == 'student' else '<title>Kapten Kalkyl editor</title>')
    parts.append(HEAD_COMMENT[kind])
    parts.append(font_faces())   # typsnitten ligger i sidan (ingen hämtning från Google Fonts)
    parts.append(MATHJAX)
    parts.append('<style>\n' + read(os.path.join(SRC, 'styles.css')) + '\n</style>')
    parts.append(read(os.path.join(SRC, kind, 'markup.html')))

    parts.append('\n<!-- ==========================================================================\n'
                 '     INBYGGD KOPIA AV LEKTIONERNA' + (' OCH MALLARNA') + ' (skapas automatiskt av build.py)\n'
                 '     Ändra i stället filerna i mapparna lessons/ och mallar/.\n'
                 '     ========================================================================== -->')
    for f in lesson_files():
        parts.append(f'<script type="text/xml" data-lesson-file="{os.path.basename(f)}">\n{read(f).strip()}\n</script>')
    if True:   # båda sidorna: eleverna får tentor, editorn kan öppna kursens mallar som exempel
        for f in listed_template_files():
            body = read(f).strip().replace('</script', '<\\/script')
            parts.append(f'<script type="text/xml" data-template-file="{os.path.basename(f)}">\n{body}\n</script>')

    lib_html, lib_js = formelbibliotek()
    if lib_html:
        parts.append(lib_html)
        parts.append('<script>\n' + lib_js + '\n</script>')
    sheet = formelblad() if kind == 'student' else None
    if sheet:
        parts.append('\n<!-- FORMELBLADET (rensad kopia av src/formelblad/formelblad.html, skapas av build.py) -->')
        import json   # som JavaScript-sträng med < skrivet som \u003c, så att inget i bladet kan avsluta <script>
        parts.append('<script>\nconst FORMELBLAD_HTML = ' + json.dumps(sheet, ensure_ascii=False).replace('<', '\\u003c') + ';\n</script>')

    js = [banner('DEL 1: KURSINSTÄLLNINGAR') + read(os.path.join(SRC, 'kurs.js')),
          banner('DEL 2: FIGURER') + read(os.path.join(SRC, 'figurer.js'))]
    if kind == 'student':
        js.append(banner('DEL 3: EXEMPELTENTAN (fast tenta)') + read(os.path.join(SRC, 'tenta.js')))
    js.append(banner('DEL 4: GEMENSAM KOD (src/core)') + '/* Hjälpfunktioner, formler, XML, rendering, svarsrutor, mallmotor. */\n')
    js += ['\n' + read(f) for f in js_files('core')]
    js.append(banner('DEL 5: ' + ('ELEVDELEN (src/student): uppläsning, lektion, tenta, start' if kind == 'student' else 'EDITORN (src/editor)')))
    js += ['\n' + read(f) for f in js_files(kind)]
    parts.append('<script>\n' + '\n'.join(js) + '\n</script>')
    return '\n'.join(parts) + '\n'

def standalone(body):
    head_end = body.rindex('</style>', 0, body.index('<!-- ====')) + len('</style>')   # allt CSS hamnar i <head>
    return ('<!doctype html>\n<html lang="sv">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + body[:head_end] + '\n</head>\n<body>\n' + body[head_end:] + '</body>\n</html>\n')

def zip_folder(folder, zip_name):
    with zipfile.ZipFile(os.path.join(DIST, zip_name), 'w', zipfile.ZIP_DEFLATED) as z:
        for base, _, files in os.walk(folder):
            for name in files:
                full = os.path.join(base, name)
                z.write(full, os.path.relpath(full, DIST))

def build_github_in_place():
    """python3 build.py --github: skriver index.html och editor.html direkt i projektmappen
    (används i GitHub-projektet, där sidorna ligger i roten bredvid lessons/ och mallar/)."""
    open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf8').write(standalone(build_body('student')))
    open(os.path.join(ROOT, 'editor.html'), 'w', encoding='utf8').write(standalone(build_body('editor')))
    if formelblad():
        open(os.path.join(ROOT, 'formelblad.html'), 'w', encoding='utf8').write(formelblad())
    print('Klart: index.html och editor.html är uppdaterade. Ladda upp dem till GitHub.')

def make_github_folder(student, editor):
    """dist/github/kapten-kalkyl: färdig mapp att ladda upp till ett GitHub-projekt."""
    repo = os.path.join(DIST, 'github', 'kapten-kalkyl')
    os.makedirs(repo)
    open(os.path.join(repo, 'index.html'), 'w', encoding='utf8').write(standalone(student))
    open(os.path.join(repo, 'editor.html'), 'w', encoding='utf8').write(standalone(editor))
    if formelblad():
        open(os.path.join(repo, 'formelblad.html'), 'w', encoding='utf8').write(formelblad())   # för utskrift
    open(os.path.join(repo, '.nojekyll'), 'w').write('')   # GitHub Pages ska visa filerna som de är
    for d in ['src', 'lessons', 'mallar', 'tools']:
        shutil.copytree(os.path.join(ROOT, d), os.path.join(repo, d), ignore=shutil.ignore_patterns('__pycache__'))
    for f in ['build.py', 'LÄSMIG.txt']:
        shutil.copy(os.path.join(ROOT, f), repo)
    if os.path.exists(os.path.join(ROOT, 'github', 'README.md')):
        shutil.copy(os.path.join(ROOT, 'github', 'README.md'), repo)
    with zipfile.ZipFile(os.path.join(DIST, 'Kapten_Kalkyl_GitHub.zip'), 'w', zipfile.ZIP_DEFLATED) as z:
        for base, _, files in os.walk(repo):
            for name in files:
                full = os.path.join(base, name)
                z.write(full, os.path.relpath(full, os.path.join(DIST, 'github')))

def main():
    if '--github' in sys.argv:
        build_github_in_place()
        return
    shutil.rmtree(DIST, ignore_errors=True)
    EDITOR = os.path.join(DIST, 'kapten-kalkyl-editor')
    for d in [os.path.join(APP, 'lessons'), os.path.join(APP, 'mallar'), os.path.join(EDITOR, 'tools')]:
        os.makedirs(d)
    student, editor = build_body('student'), build_body('editor')
    open(os.path.join(DIST, 'artefakt.html'), 'w', encoding='utf8').write(student)
    open(os.path.join(DIST, 'artefakt-editor.html'), 'w', encoding='utf8').write(editor)
    open(os.path.join(APP, 'index.html'), 'w', encoding='utf8').write(standalone(student))
    open(os.path.join(EDITOR, 'editor.html'), 'w', encoding='utf8').write(standalone(editor))
    for f in glob.glob(os.path.join(ROOT, 'lessons', '*.xml')):
        shutil.copy(f, os.path.join(APP, 'lessons'))
    for f in template_files(include_index=True):
        shutil.copy(f, os.path.join(APP, 'mallar'))
    shutil.copy(os.path.join(ROOT, 'tools', 'generera_mallar.py'), os.path.join(EDITOR, 'tools'))
    # Hela källkoden följer med editorpaketet så att läraren kan bygga om sidorna
    KALL = os.path.join(EDITOR, 'kallkod')
    for d in ['src', 'lessons', 'mallar', 'tools']:
        shutil.copytree(os.path.join(ROOT, d), os.path.join(KALL, d), ignore=shutil.ignore_patterns('__pycache__'))
    for f in ['build.py', 'LÄSMIG.txt']:
        shutil.copy(os.path.join(ROOT, f), KALL)
    if formelblad():
        open(os.path.join(APP, 'formelblad.html'), 'w', encoding='utf8').write(formelblad())   # för utskrift
    shutil.copy(os.path.join(ROOT, 'LÄSMIG.txt'), APP)
    shutil.copy(os.path.join(ROOT, 'LÄSMIG.txt'), EDITOR)
    make_github_folder(student, editor)
    zip_folder(APP, 'Kapten_Kalkyl.zip')
    zip_folder(EDITOR, 'Kapten_Kalkyl_editor.zip')
    print('Klart:', sorted(os.listdir(DIST)))

if __name__ == '__main__':
    main()
