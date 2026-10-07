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
  Kapten_Kalkyl_TR26.zip       elevversionen packad
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
    parts.append('<title>Kapten Kalkyl TR26</title>' if kind == 'student' else '<title>Kapten Kalkyl editor</title>')
    parts.append(HEAD_COMMENT[kind])
    parts.append('<link rel="preconnect" href="https://fonts.googleapis.com">')
    parts.append('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>')
    parts.append('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=JetBrains+Mono:wght@400;600&display=swap">')
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
    head_end = body.index('</style>') + len('</style>')
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
    print('Klart: index.html och editor.html är uppdaterade. Ladda upp dem till GitHub.')

def make_github_folder(student, editor):
    """dist/github/kapten-kalkyl: färdig mapp att ladda upp till ett GitHub-projekt."""
    repo = os.path.join(DIST, 'github', 'kapten-kalkyl')
    os.makedirs(repo)
    open(os.path.join(repo, 'index.html'), 'w', encoding='utf8').write(standalone(student))
    open(os.path.join(repo, 'editor.html'), 'w', encoding='utf8').write(standalone(editor))
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
    shutil.copy(os.path.join(ROOT, 'LÄSMIG.txt'), APP)
    shutil.copy(os.path.join(ROOT, 'LÄSMIG.txt'), EDITOR)
    make_github_folder(student, editor)
    zip_folder(APP, 'Kapten_Kalkyl_TR26.zip')
    zip_folder(EDITOR, 'Kapten_Kalkyl_editor.zip')
    print('Klart:', sorted(os.listdir(DIST)))

if __name__ == '__main__':
    main()
