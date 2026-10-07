#!/usr/bin/env python3
"""Genererar tentamallar till mallar/G.xml och mallar/VG.xml.

Varje frågetyp (familj) kombineras med flera byggsammanhang och formuleringar.
Varje kombination blir en egen mall med egna variabler, villkor, svar och lösning.
Villkoren garanterar att de slumpade siffrorna ger en lösbar och rimlig uppgift
(t.ex. att x ligger mellan x1 och x2 vid interpolation, att ekvationer får jämna
lösningar och att vinklar ligger i ett rimligt intervall).

Kör:  python3 tools/generera_mallar.py
Mallarna kan också skrivas för hand direkt i XML-filerna (se LÄSMIG.txt).
"""
import os
from xml.sax.saxutils import escape, quoteattr

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'mallar')

TEMPLATES = {'G': [], 'VG': []}


def v(name, lo, hi, dec=0, step=None):
    attrs = f'namn="{name}" min={quoteattr(str(lo))} max={quoteattr(str(hi))}'
    if step is not None:
        attrs += f' steg={quoteattr(str(step))}'
    if dec:
        attrs += f' decimaler="{dec}"'
    return f'<var {attrs}/>'


def val(name, options):
    return f'<var namn="{name}" typ="val" alternativ={quoteattr("|".join(str(o) for o in options))}/>'


def lista(name, n, lo, hi, dec=0):
    return f'<lista namn="{name}" antal="{n}" min="{lo}" max="{hi}"' + (f' decimaler="{dec}"' if dec else '') + '/>'


def r(name, expr):
    return f'<rakna namn="{name}">{escape(expr)}</rakna>'


def c(expr):
    return f'<villkor>{escape(expr)}</villkor>'


def ans(label, unit, expr, dec=None, lo=None, hi=None, exact=False, fel=()):
    """Ett svar. fel = [(uttryck, förklaring), …] är typiska felsvar som får en egen förklaring."""
    a = f'<svar etikett={quoteattr(label)}'
    if unit:
        a += f' enhet={quoteattr(unit)}'
    a += f' varde={quoteattr(expr)}'
    if dec is not None:
        a += f' decimaler="{dec}"'
    if lo is not None:
        a += f' min={quoteattr(str(lo))}'
    if hi is not None:
        a += f' max={quoteattr(str(hi))}'
    if exact:
        a += ' exakt="ja"'
    if fel:
        return a + '>' + ''.join(f'<fel varde={quoteattr(e)}>{escape(t)}</fel>' for e, t in fel) + '</svar>'
    return a + '/>'


def choice(label, options, expr):
    return f'<svar etikett={quoteattr(label)} typ="val" alternativ={quoteattr("|".join(options))} varde={quoteattr(expr)}/>'


def calc(*rows):
    """Lösningsrader. En rad som börjar med 'T:' är vanlig text, sista raden blir grön."""
    out = []
    for i, row in enumerate(rows):
        tag = 'svar' if i == len(rows) - 1 else 'rad'
        if row.startswith('T:'):
            out.append(f'<{tag} text="ja">{escape(row[2:])}</{tag}>')
        else:
            out.append(f'<{tag}>{escape(row)}</{tag}>')
    return '<berakning>' + ''.join(out) + '</berakning>'


def add(level, tid, lesson, points, parts, question, answers, solution, underlag=''):
    """underlag = färdig XML (t.ex. ett <diagram>) som visas under frågan."""
    TEMPLATES[level].append(
        f'  <mall id="{tid}" niva="{level}" lektion="{lesson}" poang="{points}">\n'
        + ''.join('    ' + p + '\n' for p in parts)
        + f'    <fraga>{escape(question)}</fraga>\n'
        + (f'    <underlag>{underlag}</underlag>\n' if underlag else '')
        + ''.join('    ' + a + '\n' for a in answers)
        + f'    <losning>{solution}</losning>\n  </mall>')


def fam(prefix):
    """Ger löpnummer per familj: g-area-001, g-area-002 …"""
    counter = {'n': 0}

    def nxt():
        counter['n'] += 1
        return f'{prefix}-{counter["n"]:03d}'
    return nxt


# Gemensamma byggsammanhang
PLATTOR = ['En betongplatta', 'Ett garagegolv', 'En altan', 'Ett förrådsgolv', 'En grundplatta', 'Ett vindsbjälklag',
           'En terrass', 'Ett källargolv', 'En carportplatta', 'Ett verkstadsgolv', 'Ett bjälklag', 'En gjuten uteplats']
MATERIAL_GAMMA = [('trä', 5), ('limträ', 5), ('tegel', 18), ('lättbetong', 6), ('betong', 24), ('armerad betong', 25),
                  ('natursten', 27), ('stål', 78)]
FORDON = [('material', 'ton', 'lastbil som tar', 'körningar'), ('grus', 'ton', 'flakbil som tar', 'körningar'),
          ('betong', 'm³', 'betongbil som tar', 'lass'), ('jord', 'ton', 'dumper som tar', 'turer'),
          ('sand', 'ton', 'lastbil som tar', 'körningar'), ('armering', 'ton', 'lastbil som tar', 'leveranser')]
SAKER = [('en maskin', 'kr'), ('en byggställning', 'kr'), ('ett parti isolering', 'kr'), ('en betongblandare', 'kr'),
         ('ett parti gipsskivor', 'kr'), ('en vibratorplatta', 'kr'), ('en lift', 'kr'), ('ett parti virke', 'kr'),
         ('en laserkikare', 'kr'), ('en kompressor', 'kr'), ('ett takarbete', 'kr'), ('en fasadrenovering', 'kr')]


# ============================================================================
# G-NIVÅ
# ============================================================================

def g_rakneordning():
    nxt = fam('g-ordning')
    shapes = [
        ('{=a} + {=b} · {=c}', 'a + b*c', '{=a} + {=b*c}'),
        ('({=a} + {=b}) · {=c}', '(a + b)*c', '{=a+b} \\cdot {=c}'),
        ('{=a} − {=b} · {=c}', 'a - b*c', '{=a} - {=b*c}'),
        ('{=a} · {=b} − {=c}²', 'a*b - c^2', '{=a*b} - {=c^2}'),
        ('{=a} − ({=b} − {=c})', 'a - (b - c)', '{=a} - {=b-c}'),
        ('{=b} · ({=c} + {=a}) ÷ {=c}', 'b*(c + a)/c', '{=b*(c+a)} / {=c}'),
        ('−{=a} + {=b} · {=c}', '-a + b*c', '-{=a} + {=b*c}'),
        ('{=a} ÷ {=c} + {=b}', 'a/c + b', '{=a/c} + {=b}'),
    ]
    for i, (text, expr, mid) in enumerate(shapes):
        for ctx in ['Beräkna', 'Räkna ut värdet av', 'Beräkna utan miniräknare']:
            cond = ['isint(svar)']
            if '÷' in text:
                cond.append('isint(a/c)' if 'a/c' in expr else 'isint(b*(c+a)/c)')
            add('G', nxt(), 'tal-och-brak', 1,
                [v('a', 2, 30), v('b', 2, 9), v('c', 2, 9), r('svar', expr)] + [c(x) for x in cond],
                f'{ctx} {text}.', [ans('Svar', '', 'svar', 0)],
                calc('T:Parenteser och potenser först, sedan gånger/delat, sist plus/minus.', mid, '= {=svar}'))


def g_brak():
    nxt = fam('g-brak')
    dens = [(2, 3), (3, 4), (2, 5), (3, 8), (5, 6), (1, 4), (3, 5), (1, 6)]
    ctxs = [('Ett recept kräver {T} liter mjölk och du har {U} liter. Hur mycket saknas', 'sub', 'liter'),
            ('En bräda är {T} m och du sågar av {U} m. Hur lång bit blir kvar', 'sub', 'm'),
            ('Du målar {T} av en vägg på förmiddagen och {U} på eftermiddagen. Hur stor del har du målat', 'add', ''),
            ('Ett lag har lagt {T} av ett tak och ett annat lag {U}. Hur stor del är lagd', 'add', ''),
            ('En hink innehåller {T} liter färg. Du använder {U} liter. Hur mycket färg är kvar', 'sub', 'liter'),
            ('En pall innehåller {T} ton material och ytterligare {U} ton levereras. Hur mycket finns totalt', 'add', 'ton')]
    for text, op, unit in ctxs:
        for k in range(5):
            add('G', nxt(), 'tal-och-brak', 1,
                [val('t1', [1, 2, 3]), val('n1', [3, 4, 5, 6, 8]), val('t2', [1, 2, 3]), val('n2', [3, 4, 5, 6, 8, 10]),
                 r('x1', 't1/n1'), r('x2', 't2/n2'),
                 c('t1 < n1'), c('t2 < n2'), c('n1 != n2'), c('x1 > x2' if op == 'sub' else 'x1 + x2 < 1.5'),
                 r('svar', 'x1 - x2' if op == 'sub' else 'x1 + x2')],
                text.replace('{T}', '{=t1}/{=n1}').replace('{U}', '{=t2}/{=n2}') + '? Svara i decimalform med två decimaler.',
                [ans('Svar', unit, 'svar', 2)],
                calc('T:Gör om till gemensam nämnare (eller dela ut till decimaltal).',
                     f'\\frac{{{{=t1}}}}{{{{=n1}}}} {"-" if op == "sub" else "+"} \\frac{{{{=t2}}}}{{{{=n2}}}} = {{=x1:3}} {"-" if op == "sub" else "+"} {{=x2:3}}',
                     '\\approx {=svar:2}' + (f'\\enh{{{unit}}}' if unit and unit != 'liter' else (' \\text{ liter}' if unit else ''))))


def g_brak_av():
    nxt = fam('g-brakav')
    ctxs = [('En jacka kostar {=P} kr. Rabatten är {=t}/{=n} av priset. Hur stor är rabatten', 'kr'),
            ('Ett projekt kostar {=P} kr. Materialet är {=t}/{=n} av kostnaden. Hur mycket kostar materialet', 'kr'),
            ('En vägg är {=P} cm lång. Fönstren tar {=t}/{=n} av längden. Hur lång del är fönster', 'cm'),
            ('En leverans väger {=P} kg. {=t}/{=n} av leveransen är isolering. Hur mycket väger isoleringen', 'kg'),
            ('En faktura på {=P} kr betalas i delar. Du har betalat {=t}/{=n}. Hur mycket har du betalat', 'kr'),
            ('En tomt är {=P} m². Huset tar {=t}/{=n} av ytan. Hur stor är husets yta', 'm²')]
    for text, unit in ctxs:
        for k in range(4):
            add('G', nxt(), 'tal-och-brak', 1,
                [val('n', [3, 4, 5, 8, 10]), v('t', 1, 'n - 1'), c('!(isint(t/2) && isint(n/2)) && !(n == 10 && t == 5)'), v('P', 6, 60, 0), r('P', 'P*n*10'), r('svar', 'P*t/n')],
                text + '?', [ans('Svar', unit, 'svar', 0)],
                calc('\\frac{{=t}}{{=n}} \\cdot {=P} = \\frac{{=t*P}}{{=n}}', '= {=svar}' + f' \\text{{ {unit}}}'))


def g_negativa():
    nxt = fam('g-neg')
    ctxs = [('Temperaturen på natten var {=-a} °C. Under dagen steg den med {=b} °C och på kvällen sjönk den med {=d} °C. Vilken temperatur var det på kvällen', '°C', '-a + b - d', '{=-a} + {=b} - {=d}'),
            ('Elpriset var {=-a/100:2} kr/kWh en natt och {=b/10:2} kr/kWh dagen efter. Hur stor var skillnaden', 'kr/kWh', 'b/10 + a/100', '{=b/10:2} - ({=-a/100:2})'),
            ('En grund ligger på nivån {=-a/10:1} m. Golvet ska ligga {=b/10:1} m högre. Vilken nivå får golvet', 'm', '-a/10 + b/10', '{=-a/10:1} + {=b/10:1}'),
            ('Ett konto visar {=-a*100} kr. Du sätter in {=b*100} kr och betalar sedan {=d*100} kr. Vad visar kontot', 'kr', '-a*100 + b*100 - d*100', '{=-a*100} + {=b*100} - {=d*100}'),
            ('Grundvattnet står på {=-a/10:1} m. Det stiger {=b/10:1} m och sjunker sedan {=d/10:1} m. Var står det nu', 'm', '-a/10 + b/10 - d/10', '{=-a/10:1} + {=b/10:1} - {=d/10:1}')]
    for text, unit, expr, mid in ctxs:
        for k in range(4):
            dec = 2 if 'kWh' in unit else (1 if unit == 'm' else 0)
            add('G', nxt(), 'tal-och-brak', 1,
                [v('a', 2, 15), v('b', 5, 25), v('d', 2, 12), r('svar', expr)],
                text + '?', [ans('Svar', unit, 'svar', dec)],
                calc('T:Minus minus blir plus. Räkna från vänster till höger.', mid, '= {=svar' + (f':{dec}' if dec else '') + '}' + f' \\text{{ {unit}}}'))


def g_avrundning():
    nxt = fam('g-avr')
    places = [('närmaste tiotal', 10), ('närmaste hundratal', 100), ('närmaste tusental', 1000), ('närmaste tiotusental', 10000)]
    ctxs = ['En kommun har {=N} invånare', 'Ett projekt kostar {=N} kr', 'En byggnad använder {=N} kWh per år',
            'En väg är {=N} m lång', 'Ett lager innehåller {=N} tegelstenar', 'En leverans väger {=N} kg']
    for text in ctxs:
        for name, p in places:
            add('G', nxt(), 'tal-och-brak', 1,
                [v('N', 12345, 987654), r('svar', f'round(N/{p})*{p}')],
                f'{text}. Avrunda talet till {name}.', [ans('Svar', '', 'svar', 0, exact=True)],
                calc(f'T:Titta på siffran efter {name.split()[-1]}ssiffran: 0–4 nedåt, 5–9 uppåt.', '{=N} \\approx {=svar}'))


def g_mm_volym():
    nxt = fam('g-mmvol')
    objs = ['En regel', 'En planka', 'En stolpe', 'En bräda', 'En läkt', 'En limträbalk', 'En syll', 'En takstolsstav']
    for obj in objs:
        for phr in ['Beräkna volymen i m³.', 'Hur stor volym har den i m³?']:
            add('G', nxt(), 'enheter', 2,
                [val('b', [22, 34, 45, 70, 95]), val('h', [45, 70, 95, 120, 145, 170, 195, 220]), v('L', 2.4, 6.0, 1, 0.3),
                 c('h > b'), r('svar', 'b/1000*h/1000*L')],
                f'{obj} har tvärsnittet {{=b}} × {{=h}} mm och är {{=L:1}} m lång. {phr}',
                [ans('Volym', 'm³', 'svar', 4)],
                calc('T:Gör om mm till m först.', 'V = {=b/1000:3} \\cdot {=h/1000:3} \\cdot {=L:1}', 'V \\approx {=svar:4}\\enh{m^3}'))


def g_massa_tyngd():
    nxt = fam('g-mt')
    objs = ['En stålbalk', 'Ett betongblock', 'En pall med tegel', 'En prefabricerad trappa', 'En container',
            'Ett fönsterparti', 'En lastpall med gips', 'En byggmaskin', 'Ett takstolspaket', 'En armeringskorg', 'En kranlast', 'Ett glasparti']
    for obj in objs:
        for gtext, gval in [('Använd g ≈ 10 m/s²', 10), ('Använd g = 9,82 m/s²', 9.82)]:
            add('G', nxt(), 'enheter', 2 if gval == 9.82 else 1,
                [v('m', 120, 2400, 0, 10), r('svar', f'm*{gval}/1000')],
                f'{obj} har massan {{=m}} kg. Beräkna tyngden i kN. {gtext}.',
                [ans('Tyngd', 'kN', 'svar', 2)],
                calc('G = m \\cdot g', f'G = {{=m}} \\cdot {str(gval).replace(".", ",")} = {{=m*{gval}:1}}\\enh{{N}}', 'G \\approx {=svar:2}\\enh{kN}'))


def g_ton_kn():
    nxt = fam('g-tonkn')
    objs = ['En betongbalk', 'Ett stålfackverk', 'En prefabvägg', 'En lyftlast', 'En container', 'Ett bjälklagselement']
    for obj in objs:
        for phr in ['Beräkna tyngden i kN (g ≈ 10 m/s²).', 'Hur stor tyngd i kN motsvarar det? Räkna med g ≈ 10 m/s².']:
            add('G', nxt(), 'enheter', 1,
                [v('t', 0.4, 9.5, 1), r('svar', 't*10')],
                f'{obj} väger {{=t:1}} ton. {phr}', [ans('Tyngd', 'kN', 'svar', 1)],
                calc('1\\enh{ton} = 1000\\enh{kg} \\Rightarrow 10\\enh{kN}', 'G = {=t:1} \\cdot 10 = {=svar:1}\\enh{kN}'))


def g_avrunda_upp():
    nxt = fam('g-upp')
    for mat, unit, veh, word in FORDON:
        for phr in ['Hur många {w} krävs?', 'Hur många hela {w} behövs?', 'Beräkna antalet {w}.']:
            add('G', nxt(), 'enheter', 1,
                [v('cap', 1.2, 9.0, 1), v('tot', 'cap*2.2', 'cap*12', 1), r('q', 'tot/cap'), c('!isint(q)'), r('svar', 'ceil(q)')],
                f'Ett bygge behöver {{=tot:1}} {unit} {mat}. En {veh} {{=cap:1}} {unit} per gång. ' + phr.format(w=word),
                [ans('Antal', 'st', 'svar', 0, exact=True)],
                calc('{=tot:1} / {=cap:1} \\approx {=q:2}', f'T:Avrunda uppåt: {{=svar}} {word}'))
    for prod, cover, unit in [('färg', 'En liter färg täcker', 'm²'), ('isolering', 'En rulle isolering täcker', 'm²'), ('golvplattor', 'Ett paket plattor täcker', 'm²')]:
        for phr in ['Hur många hela förpackningar behövs?', 'Hur många måste köpas?']:
            add('G', nxt(), 'enheter', 1,
                [v('per', 2, 9, 1), v('A', 20, 160), r('q', 'A/per'), c('!isint(q)'), r('svar', 'ceil(q)')],
                f'En yta på {{=A}} m² ska täckas. {cover} {{=per:1}} {unit}. {phr}',
                [ans('Antal', 'st', 'svar', 0, exact=True)],
                calc('{=A} / {=per:1} \\approx {=q:2}', 'T:Avrunda uppåt: {=svar} st'))


def g_tid():
    nxt = fam('g-tid')
    for ctx in ['Ett gjutarbete tar', 'En montering tar', 'Ett arbetspass är', 'En transport tar', 'En målning tar']:
        for k in range(3):
            add('G', nxt(), 'tal-och-brak', 1,
                [val('h', [1, 2, 3, 4, 5, 6, 7]), val('d', [0.25, 0.5, 0.75, 0.2, 0.4, 0.6, 0.8]), r('svar', 'd*60')],
                f'{ctx} {{=h+d:2}} timmar. Hur många minuter är decimaldelen {{=d:2}} h?',
                [ans('Minuter', 'min', 'svar', 0)],
                calc('{=d:2} \\cdot 60 = {=svar}\\enh{min}', 'T:Alltså {=h} h {=svar} min'))


def g_procent_ff():
    nxt = fam('g-ff')
    for thing, unit in SAKER:
        for direction in ['höjs', 'sänks']:
            sign = '+' if direction == 'höjs' else '-'
            add('G', nxt(), 'procent', 1,
                [v('P', 8, 95, 0), r('P', 'P*1000'), val('p', [3, 4, 5, 6, 8, 10, 12, 15, 18, 20, 25]),
                 r('f', f'1 {sign} p/100'), r('svar', 'P*f')],
                f'Priset för {thing} är {{=P}} {unit}. Priset {direction} med {{=p}} %. Beräkna det nya priset.',
                [ans('Nytt pris', unit, 'svar', 0)],
                calc('T:Förändringsfaktor: 1 ' + sign + ' {=p}/100 = {=f:2}', '{=P} \\cdot {=f:2} = {=svar:0}\\enh{kr}'))


def g_procent_forandring():
    nxt = fam('g-proc')
    for thing, unit in SAKER:
        for kind in ['ökning', 'minskning']:
            if kind == 'ökning':
                cond = [r('N', 'G*(1 + p/100)')]
            else:
                cond = [r('N', 'G*(1 - p/100)')]
            add('G', nxt(), 'procent', 2,
                [v('G', 10, 90, 0), r('G', 'G*500'), val('p', [5, 8, 10, 12, 15, 20, 25, 30, 35, 40])] + cond +
                [r('svar', 'abs(N - G)/G*100')],
                f'Priset för {thing} ändrades från {{=G}} {unit} till {{=N}} {unit}. Hur stor är {kind}en i procent?',
                [ans(kind.capitalize(), '%', 'svar', 1, fel=[('abs(N - G)/N*100', 'Du har delat med det nya värdet. Procentuell förändring räknas alltid från det gamla (ursprungliga) värdet.')])],
                calc('\\frac{\\text{nytt} - \\text{gammalt}}{\\text{gammalt}} = \\frac{{=N} - {=G}}{{=G}}', '= {=(N-G)/G:3} \\Rightarrow \\text{' + kind + '} \\approx {=svar:1}\\,\\%'))


def g_procent_del():
    nxt = fam('g-del')
    ctxs = [('En byggnad har {=H} lägenheter. {=p} % ska renoveras. Hur många lägenheter är det', 'st', 0),
            ('Ett projekt kostar {=H} kr. Materialet är {=p} % av kostnaden. Hur mycket kostar materialet', 'kr', 0),
            ('En energibesparing på {=p} % görs på {=H} kWh. Hur många kWh sparas', 'kWh', 0),
            ('Spillet är {=p} % av {=H} m². Hur stor yta är spill', 'm²', 1),
            ('Moms är {=p} % på {=H} kr. Hur stor är momsen', 'kr', 0),
            ('En entreprenör lägger på {=p} % vinst på {=H} kr. Hur stor är vinsten', 'kr', 0)]
    for text, unit, dec in ctxs:
        for k in range(4):
            add('G', nxt(), 'procent', 1,
                [val('p', [10, 15, 20, 25, 30, 40, 5, 12]), v('H', 20, 200, 0), r('H', 'H*(if(%s, 1, 100))' % ('1' if unit == 'st' else '0')),
                 r('svar', 'H*p/100')] + ([c('isint(svar)')] if unit == 'st' else []),
                text + '?', [ans('Svar', unit, 'svar', dec)],
                calc('{=p} \\% \\text{ av } {=H} = {=p/100:2} \\cdot {=H}', '= {=svar' + (f':{dec}' if dec else '') + '}' + f' \\text{{ {unit}}}'))


def g_ranta():
    nxt = fam('g-ranta')
    for who in ['Ett byggföretag lånar', 'Ett hushåll lånar', 'En bostadsrättsförening lånar', 'Du lånar', 'En kommun lånar', 'En snickerifirma lånar']:
        for per in ['år', 'månad']:
            add('G', nxt(), 'ekonomi', 1 if per == 'år' else 2,
                [v('K', 5, 90, 0), r('K', 'K*10000'), val('p', [2.5, 3, 3.5, 4, 4.5, 5, 6]), r('arsranta', 'K*p/100'),
                 r('svar', 'arsranta' if per == 'år' else 'arsranta/12')],
                f'{who} {{=K}} kr med {{=p}} % ränta per år. Hur stor blir räntan per {per}?',
                [ans('Ränta', 'kr', 'svar', 0)],
                calc('{=K} \\cdot {=p/100:3} = {=arsranta:0}\\enh{kr/år}') if per == 'år'
                else calc('{=K} \\cdot {=p/100:3} = {=arsranta:0}\\enh{kr/år}', '{=arsranta:0} / 12 \\approx {=svar:0}\\enh{kr/månad}'))


def g_index():
    nxt = fam('g-index')
    for thing in ['Ett byggjobb', 'En lägenhet', 'Ett ton armering', 'En kubikmeter betong', 'En entreprenad', 'Ett takbyte']:
        for k in range(3):
            add('G', nxt(), 'ekonomi', 2,
                [v('I1', 180, 320), v('I2', 'I1 + 10', 'I1*1.4'), v('P', 4, 90), r('P', 'P*1000'), r('svar', 'P*I2/I1')],
                f'{thing} kostade {{=P}} kr när byggkostnadsindex var {{=I1}}. Nu är index {{=I2}}. Vad kostar det nu enligt index?',
                [ans('Pris', 'kr', 'svar', 0)],
                calc('\\text{nytt pris} = {=P} \\cdot \\frac{{=I2}}{{=I1}}', '\\approx {=svar:0}\\enh{kr}'))


def g_ekvation():
    nxt = fam('g-ekv')
    forms = [('{=a}x + {=b} = {=c}', 'a*x + b', '{=a}x = {=c-b}'), ('{=a}x − {=b} = {=c}', 'a*x - b', '{=a}x = {=c+b}'),
             ('{=b} + {=a}x = {=c}', 'b + a*x', '{=a}x = {=c-b}'), ('{=a}(x + {=b}) = {=c}', 'a*(x + b)', 'x + {=b} = {=c/a}'),
             ('{=a}x + {=b} = x + {=c}', '(a - 1)*x + b - c + x*0', '{=a-1}x = {=c-b}')]
    for i, (text, lhs, step) in enumerate(forms):
        for phr in ['Lös ekvationen', 'Bestäm x i ekvationen', 'Lös ut x']:
            if i == 4:
                parts = [v('a', 2, 9), v('x', 1, 12), v('b', 1, 30), r('c', '(a - 1)*x + b')]
            elif i == 3:
                parts = [v('a', 2, 9), v('x', 1, 15), v('b', 1, 12), r('c', 'a*(x + b)')]
            else:
                parts = [v('a', 2, 12), v('x', 1, 15), v('b', 1, 40), r('c', lhs)]
            add('G', nxt(), 'algebra', 1, parts + [c('c > 0')],
                f'{phr} {text}.', [ans('x =', '', 'x', 2)],
                calc(text.replace('x', 'x').replace('−', '-').replace('(', '(').replace(')', ')'), step, 'x = {=x}'))


def g_formel_baklanges():
    nxt = fam('g-formel')
    cases = [
        ('En rektangulär yta är {=A} m² och {=l} m lång. Hur bred är den?', 'A = l \\cdot b \\Rightarrow b = A / l', [v('l', 4, 15, 1), v('b', 2, 'l', 1), r('A', 'l*b')], 'b', 'Bredd', 'm', 2, 'b = {=A:2} / {=l:1}'),
        ('En platta har volymen {=V} m³ och arean {=A} m². Hur tjock är den?', 'V = A \\cdot t \\Rightarrow t = V / A', [v('A', 20, 120), val('t', [0.10, 0.12, 0.15, 0.18, 0.20, 0.25]), r('V', 'A*t')], 't', 'Tjocklek', 'm', 2, 't = {=V:2} / {=A}'),
        ('En vägg har tyngden {=G} kN och tyngdtätheten {=g} kN/m³. Vilken volym har den?', 'G = \\gamma V \\Rightarrow V = G / \\gamma', [val('g', [5, 18, 20, 24, 25]), v('V', 0.5, 9, 1), r('G', 'g*V')], 'V', 'Volym', 'm³', 1, 'V = {=G:1} / {=g}'),
        ('En triangel har arean {=A} m² och basen {=b} m. Hur hög är den?', 'A = \\frac{b h}{2} \\Rightarrow h = \\frac{2A}{b}', [v('b', 3, 14, 1), v('h', 1, 8, 1), r('A', 'b*h/2')], 'h', 'Höjd', 'm', 1, 'h = 2 \\cdot {=A:2} / {=b:1}'),
        ('En rektangulär grund har omkretsen {=O} m och längden {=l} m. Hur bred är den?', 'O = 2l + 2b \\Rightarrow b = \\frac{O - 2l}{2}', [v('l', 6, 20), v('b', 3, 'l'), r('O', '2*l + 2*b')], 'b', 'Bredd', 'm', 0, 'b = ({=O} - 2 \\cdot {=l}) / 2'),
    ]
    for text, formula, parts, var, label, unit, dec, mid in cases:
        for phr in ['', ' Visa hur du löser ut den okända storheten.', ' Lös ut storheten ur formeln.', ' Svara med enhet.']:
            add('G', nxt(), 'algebra', 2, parts, text + phr, [ans(label, unit, var, dec)],
                calc(formula, mid, f'{var} = {{={var}:{dec}}}\\enh{{{unit.replace("³", "^3")}}}'))


def g_potensekvation():
    nxt = fam('g-pot')
    ctxs = [('En kvadratisk platta har arean {=A} m². Hur lång är sidan?', 2, 'm'),
            ('En kvadratisk glasruta har arean {=A} m². Bestäm sidans längd.', 2, 'm'),
            ('Ett kvadratiskt golv är {=A} m². Lös ekvationen x² = {=A}.', 2, 'm'),
            ('En kvadratisk öppning har arean {=A} m². Hur bred är den?', 2, 'm'),
            ('En kub har volymen {=A} m³. Hur lång är kanten?', 3, 'm'),
            ('En kubisk betongkloss har volymen {=A} m³. Bestäm kantlängden genom att lösa x³ = {=A}.', 3, 'm')]
    for text, n, unit in ctxs:
        for k in range(4):
            parts = [v('x', 0.5, 12, 1)] if n == 2 else [v('x', 0.5, 4, 1)]
            parts.append(r('A', f'x^{n}'))
            add('G', nxt(), 'algebra', 1, parts, text, [ans('Sida', unit, 'x', 1)],
                calc(f'x^{n} = {{=A:{3 if n == 3 else 2}}}', ('x = \\sqrt{{=A:2}}' if n == 2 else 'x = {=A:3}^{1/3}'), 'x = {=x:1}\\enh{m}'))


def g_talfoljd():
    nxt = fam('g-talf')
    ctxs = [('En byggställning byggs med {=a} rör dag 1, {=a+d} rör dag 2 och {=a+2*d} rör dag 3. Hur många rör behövs dag {=n}?', 'rör'),
            ('Stolpar placeras med {=d} m mellanrum. Den första står vid {=a} m. Var står stolpe nummer {=n}?', 'm'),
            ('Fönster sitter vid {=a} m, {=a+d} m och {=a+2*d} m från hörnet. Var sitter fönster {=n}?', 'm'),
            ('Ett staket får {=d} nya sektioner varje dag. Första dagen finns {=a}. Hur många sektioner finns dag {=n}?', 'st'),
            ('En talföljd börjar {=a}, {=a+d}, {=a+2*d}, … Vilket är tal nummer {=n}?', ''),
            ('Plattor läggs i rader: {=a}, {=a+d}, {=a+2*d} plattor … Hur många plattor ligger i rad {=n}?', 'st')]
    for text, unit in ctxs:
        for k in range(4):
            add('G', nxt(), 'algebra', 1,
                [v('a', 1, 12), v('d', 2, 6), v('n', 7, 30), r('svar', 'a + (n - 1)*d')],
                text, [ans('Svar', unit, 'svar', 0)],
                calc('a_n = a_1 + (n - 1) \\cdot d', 'a_{{=n}} = {=a} + ({=n} - 1) \\cdot {=d}', '= {=svar}'))


def g_uttryck():
    nxt = fam('g-uttr')
    forms = [('{=a}(x + {=b}) − {=c}x', 'a*(x + b) - c*x', '{=a}x + {=a*b} - {=c}x = {=a-c}x + {=a*b}'),
             ('{=a}x + {=b} + {=c}x', 'a*x + b + c*x', '{=a+c}x + {=b}'),
             ('{=c}(x − {=b}) + {=a}x', 'c*(x - b) + a*x', '{=c}x - {=c*b} + {=a}x = {=a+c}x - {=c*b}'),
             ('{=a}x · {=b}', 'a*x*b', '{=a*b}x')]
    for text, expr, simp in forms:
        for phr in ['Förenkla uttrycket {T} och beräkna dess värde när x = {=x}.', 'Beräkna värdet av {T} då x = {=x}. Förenkla gärna först.',
                    'Ett materialpris beskrivs av {T} kr där x är antal enheter. Vad blir priset för x = {=x}?']:
            add('G', nxt(), 'algebra', 1,
                [v('a', 2, 9), v('b', 1, 9), v('c', 1, 'a - 1'), v('x', 2, 12), r('svar', expr), c('svar > 0')],
                phr.replace('{T}', text), [ans('Värde', '', 'svar', 0)],
                calc(simp, '= {=svar} \\quad (x = {=x})'))


def g_linje_varde():
    nxt = fam('g-linje')
    ctxs = [('Hyran för en byggställning är y = {=k}x + {=m} kr, där x är antal dagar. Vad kostar {=x} dagar?', 'kr'),
            ('Betong kostar y = {=k}x + {=m} kr, där x är antal m³. Vad kostar {=x} m³?', 'kr'),
            ('En hantverkare tar y = {=k}x + {=m} kr, där x är antal timmar. Vad kostar {=x} timmar?', 'kr'),
            ('En tank fylls enligt y = {=k}x + {=m} liter, där x är minuter. Hur mycket finns efter {=x} minuter?', 'liter'),
            ('En transport kostar y = {=k}x + {=m} kr, där x är km. Vad kostar {=x} km?', 'kr'),
            ('En kran höjer en last enligt y = {=k/10:1}x + {=m/100:0} m, där x är sekunder. Hur högt är lasten efter {=x} s?', 'm')]
    for text, unit in ctxs:
        for k in range(4):
            expr = 'k/10*x + m/100' if unit == 'm' else 'k*x + m'
            add('G', nxt(), 'linjara-funktioner', 1,
                [v('k', 15, 900, 0, 5), v('m', 100, 5000, 0, 50), v('x', 2, 25), r('svar', expr)],
                text, [ans('Svar', unit, 'svar', 1 if unit == 'm' else 0)],
                calc('y = ' + ('{=k/10:1}' if unit == 'm' else '{=k}') + ' \\cdot {=x} + ' + ('{=m/100:0}' if unit == 'm' else '{=m}'), '= {=svar:1}' if unit == 'm' else '= {=svar}'))


def g_linje_x():
    nxt = fam('g-linjex')
    ctxs = ['En kran höjer lasten enligt y = {=k}x + {=m} (y i dm, x i sekunder). Efter hur många sekunder är lasten {=y} dm upp?',
            'Kostnaden är y = {=k}x + {=m} kr för x timmar. Hur många timmar får du för {=y} kr?',
            'En cistern innehåller y = {=k}x + {=m} liter efter x minuter. När innehåller den {=y} liter?',
            'Hyran är y = {=k}x + {=m} kr för x dagar. Hur många dagar kan du hyra för {=y} kr?',
            'Snödjupet är y = {=k}x + {=m} mm efter x timmar. När är det {=y} mm?']
    for text in ctxs:
        for k in range(4):
            add('G', nxt(), 'linjara-funktioner', 2,
                [v('k', 2, 400), v('m', 10, 3000), v('x', 2, 30), r('y', 'k*x + m')],
                text, [ans('x', '', 'x', 1)],
                calc('{=y} = {=k}x + {=m}', '{=k}x = {=y-m}', 'x = {=x}'))


def g_area():
    nxt = fam('g-area')
    for obj in PLATTOR:
        for phr in ['Beräkna arean.', 'Hur stor är ytan?', 'Beräkna arean i m².']:
            add('G', nxt(), 'geometri', 1,
                [v('l', 4, 16, 1), v('b', 2.5, 'l', 1), r('svar', 'l*b')],
                f'{obj} är {{=l:1}} m lång och {{=b:1}} m bred. {phr}', [ans('Area', 'm²', 'svar', 2)],
                calc('A = l \\cdot b = {=l:1} \\cdot {=b:1}', 'A = {=svar:2}\\enh{m^2}'))


def g_triangel():
    nxt = fam('g-tri')
    for obj in ['En gavel', 'En triangulär vägg', 'Ett triangulärt takfall', 'En triangulär tomtbit', 'En gavelspets', 'Ett triangulärt fönster', 'En stödplåt', 'En takkupa']:
        for phr in ['Beräkna arean.', 'Hur stor är ytan?']:
            add('G', nxt(), 'geometri', 1,
                [v('b', 2, 14, 1), v('h', 1, 6, 1), r('svar', 'b*h/2')],
                f'{obj} har formen av en triangel med basen {{=b:1}} m och höjden {{=h:1}} m. {phr}', [ans('Area', 'm²', 'svar', 2)],
                calc('A = \\frac{b \\cdot h}{2} = \\frac{{=b:1} \\cdot {=h:1}}{2}', 'A = {=svar:2}\\enh{m^2}'))


def g_cirkel():
    nxt = fam('g-cirkel')
    for obj in ['En rund fontän', 'Ett runt bord', 'En cirkulär platta', 'Ett runt fundament', 'En rund ljusgård', 'Ett cirkulärt hål']:
        for what in ['area', 'omkrets']:
            for given in ['radien', 'diametern']:
                expr = 'pi*r^2' if what == 'area' else '2*pi*r'
                add('G', nxt(), 'geometri', 1,
                    [v('r', 0.3, 6, 1), r('d', '2*r'), r('svar', expr)],
                    f'{obj} har {given} {{=' + ('r:1' if given == 'radien' else 'd:1') + f'}} m. Beräkna {"arean" if what == "area" else "omkretsen"}.',
                    [ans(what.capitalize(), 'm²' if what == 'area' else 'm', 'svar', 2)],
                    calc(('A = \\pi r^2 = \\pi \\cdot {=r:1}^2' if what == 'area' else 'O = 2 \\pi r = 2 \\pi \\cdot {=r:1}'),
                         ('A' if what == 'area' else 'O') + ' \\approx {=svar:2}' + ('\\enh{m^2}' if what == 'area' else '\\enh{m}')))


def g_volym():
    nxt = fam('g-vol')
    for obj in PLATTOR:
        for unit in ['m', 'cm', 'mm']:
            tdec = {'m': 'tm:2', 'cm': 'tm*100', 'mm': 'tm*1000'}[unit]
            add('G', nxt(), 'geometri', 2,
                [v('l', 4, 16, 1), v('b', 2.5, 'l', 1), val('tm', [0.08, 0.10, 0.12, 0.15, 0.18, 0.20, 0.25]), r('svar', 'l*b*tm')],
                f'{obj} är {{=l:1}} m × {{=b:1}} m och {{={tdec}}} {unit} tjock. Beräkna volymen i m³.',
                [ans('Volym', 'm³', 'svar', 2)],
                calc(('T:Gör om tjockleken till meter: ' + '{=tm:2} m') if unit != 'm' else 'V = l \\cdot b \\cdot h',
                     'V = {=l:1} \\cdot {=b:1} \\cdot {=tm:2}', 'V = {=svar:2}\\enh{m^3}'))


def g_skala():
    nxt = fam('g-skala')
    objs = ['En vägg', 'Ett fönster', 'En dörr', 'Ett rum', 'En balk', 'En fasad', 'En carport', 'En trappa']
    for obj in objs:
        for scale in [50, 100, 200, 500]:
            add('G', nxt(), 'geometri', 1,
                [v('cm', 0.8, 12, 1), r('svar', f'cm*{scale}/100')],
                f'{obj} mäter {{=cm:1}} cm på en ritning i skala 1:{scale}. Hur lång är den i verkligheten i meter?',
                [ans('Längd', 'm', 'svar', 2)],
                calc(f'{{=cm:1}} \\cdot {scale} = {{=cm*{scale}:0}}\\enh{{cm}}', '= {=svar:2}\\enh{m}'))


def g_omkrets():
    nxt = fam('g-omkr')
    for obj in ['En rektangulär grund', 'En tomt', 'Ett staket runt en altan', 'En kantbalk runt en platta', 'En lekplats', 'Ett förråd']:
        for phr in ['Beräkna omkretsen.', 'Hur lång är omkretsen?', 'Hur många meter kantlist går åt runt hela?']:
            add('G', nxt(), 'geometri', 1,
                [v('l', 4, 30, 1), v('b', 3, 'l', 1), r('svar', '2*l + 2*b')],
                f'{obj} är {{=l:1}} m lång och {{=b:1}} m bred. {phr}', [ans('Omkrets', 'm', 'svar', 1)],
                calc('O = 2l + 2b = 2 \\cdot {=l:1} + 2 \\cdot {=b:1}', 'O = {=svar:1}\\enh{m}'))


def g_pythagoras():
    nxt = fam('g-pyt')
    ctxs = [('En stege är {=c:1} m lång och står {=a:1} m ut från väggen. Hur högt når den?', 'katet'),
            ('En byggställning är {=c:1} m lång och lutar mot en vägg. Foten står {=a:1} m ut. Hur högt når den?', 'katet'),
            ('En rätvinklig triangel har kateterna {=a:1} m och {=b:1} m. Hur lång är hypotenusan?', 'hyp'),
            ('Ett rum är {=a:1} m × {=b:1} m. Hur lång är diagonalen?', 'hyp'),
            ('En takbjälke går från väggliv till nock: {=a:1} m horisontellt och {=b:1} m upp. Hur lång är bjälken?', 'hyp'),
            ('En ramp stiger {=b:1} m över {=a:1} m horisontellt. Hur lång är rampen?', 'hyp'),
            ('En vajer är {=c:1} m och fäst {=a:1} m från masten på marken. Hur högt upp sitter fästet i masten?', 'katet'),
            ('En diagonal stagning ska gå över en vägg som är {=a:1} m bred och {=b:1} m hög. Hur lång blir stagningen?', 'hyp')]
    for text, kind in ctxs:
        for k in range(4):
            if kind == 'hyp':
                parts = [v('a', 1, 12, 1), v('b', 0.5, 9, 1), r('svar', 'sqrt(a^2 + b^2)')]
                sol = calc('c = \\sqrt{a^2 + b^2} = \\sqrt{{=a:1}^2 + {=b:1}^2}', 'c \\approx {=svar:2}\\enh{m}')
            else:
                parts = [v('c', 3, 12, 1), v('a', 0.5, 'c*0.6', 1), r('svar', 'sqrt(c^2 - a^2)')]
                sol = calc('b = \\sqrt{c^2 - a^2} = \\sqrt{{=c:1}^2 - {=a:1}^2}', 'b \\approx {=svar:2}\\enh{m}')
            fel = ([('a + b', 'Du har lagt ihop sidorna. Pythagoras gäller kvadraterna: c² = a² + b², sedan roten ur.'),
                    ('sqrt(abs(a^2 - b^2))', 'Du har subtraherat. Hypotenusan är längst, så c² = a² + b².')] if kind == 'hyp' else
                   [('sqrt(c^2 + a^2)', 'Du har lagt ihop kvadraterna. När hypotenusan är känd subtraherar du: b² = c² − a².'),
                    ('c - a', 'Du har dragit sidorna från varandra. Räkna med kvadraterna: b² = c² − a², sedan roten ur.')])
            add('G', nxt(), 'trigonometri', 1 if k % 2 == 0 else 2, parts, text, [ans('Längd', 'm', 'svar', 2, fel=fel)], sol)


FN_TEXT = 'Fel trigonometrisk funktion. Tänk SOH-CAH-TOA: vilka sidor känner du, och vilken söker du?'


def g_trig_sida():
    nxt = fam('g-trigs')
    ctxs = [('Ett tak lutar {=v}° och halva spännvidden är {=a:1} m. Hur hög är taknocken över väggliv?', 'tan'),
            ('En kranarm är {=a:1} m lång och lutar {=v}° mot marken. Hur högt når kroken?', 'sin'),
            ('En stege är {=a:1} m och bildar vinkeln {=v}° med marken. Hur långt från väggen står foten?', 'cos'),
            ('En ramp är {=a:1} m lång med lutningen {=v}°. Hur stor är höjdskillnaden?', 'sin'),
            ('En inspektör står {=a:1} m från en mast och ser toppen i vinkeln {=v}° (bortse från ögonhöjden). Hur hög är masten?', 'tan'),
            ('En vajer är {=a:1} m och bildar {=v}° med marken. Hur långt från masten är den fäst i marken?', 'cos')]
    for text, fn in ctxs:
        for k in range(4):
            add('G', nxt(), 'trigonometri', 2,
                [v('a', 3, 12, 1) if fn == 'tan' else v('a', 3, 25, 1), v('v', 15, 40) if fn == 'tan' else v('v', 15, 65), r('svar', f'a*{fn}(v)')],
                text, [ans('Längd', 'm', 'svar', 2, fel=[(f'a*{o}(v)', FN_TEXT) for o in ['sin', 'cos', 'tan'] if o != fn] +
                                                   [(f'a/{fn}(v)', 'Du har delat i stället för att multiplicera. Ställ upp kvoten och lös ut den sökta sidan.')])],
                calc(f'\\text{{sökt}} = {{=a:1}} \\cdot \\{fn} {{=v}}^\\circ', '\\approx {=svar:2}\\enh{m}'))


def g_trig_vinkel():
    nxt = fam('g-trigv')
    ctxs = ['Ett tak stiger {=h:1} m på {=l:1} m horisontell längd. Beräkna taklutningen i grader.',
            'En ramp stiger {=h:1} m över {=l:1} m horisontellt. Vilken vinkel har rampen?',
            'En takprofil har horisontella längden {=l:1} m och höjdskillnaden {=h:1} m. Beräkna vinkeln mot horisontalplanet.',
            'En väg stiger {=h:1} m på {=l:1} m. Hur stor är lutningsvinkeln?',
            'En trappa stiger {=h:1} m på {=l:1} m i plan. Vilken vinkel har trappan?']
    for text in ctxs:
        for k in range(4):
            add('G', nxt(), 'trigonometri', 2,
                [v('l', 3, 15, 1), v('h', 0.4, 'l*0.9', 1), r('svar', 'atan(h/l)')],
                text, [ans('Vinkel', '°', 'svar', 1, fel=[('atan(l/h)', 'Du har tagit vinkeln mot lodlinjen. tan v = motstående / närliggande = höjd / horisontell längd.'),
                                                   ('asin(h/l)', FN_TEXT), ('h/l*100', 'Det är lutningen i procent. Vinkeln i grader får du med tan⁻¹.')])],
                calc('\\tan v = \\frac{{=h:1}}{{=l:1}} = {=h/l:3}', 'v = \\tan^{-1}({=h/l:3}) \\approx {=svar:1}^\\circ'))


def g_lutning():
    nxt = fam('g-lutn')
    for ctx in ['En ramp', 'En uppfart', 'En gångväg', 'En lastkaj', 'Ett platt tak', 'En ledning']:
        for kind in ['procent', '1:n']:
            if kind == 'procent':
                add('G', nxt(), 'trigonometri', 1,
                    [v('l', 2, 20, 1), v('h', 0.1, 'l*0.12', 2), c('h >= 0.05'), r('svar', 'h/l*100')],
                    f'{ctx} stiger {{=h:2}} m på {{=l:1}} m horisontell längd. Hur stor är lutningen i procent?',
                    [ans('Lutning', '%', 'svar', 1)],
                    calc('\\frac{{=h:2}}{{=l:1}} \\cdot 100', '\\approx {=svar:1} \\%'))
            else:
                add('G', nxt(), 'trigonometri', 1,
                    [val('n', [8, 10, 12, 15, 20, 50]), v('h', 0.2, 1.5, 2), r('svar', 'h*n')],
                    f'{ctx} ska ha lutningen 1:{{=n}} och höjdskillnaden {{=h:2}} m. Hur lång måste den vara horisontellt?',
                    [ans('Längd', 'm', 'svar', 2)],
                    calc('T:1:{=n} betyder 1 m höjd per {=n} m längd.', '{=h:2} \\cdot {=n} = {=svar:2}\\enh{m}'))


def g_vektor():
    nxt = fam('g-vek')
    ctxs = ['Två personer drar i en last med krafterna ({=a}, {=b}) N och ({=c}, {=d}) N. Hur stor är resultantens storlek?',
            'Två vajrar drar med ({=a}, {=b}) N och ({=c}, {=d}) N. Beräkna resultantens längd.',
            'En mätare går först ({=a}, {=b}) m och sedan ({=c}, {=d}) m. Hur långt från start är hen?',
            'Två krafter ({=a}, {=b}) kN och ({=c}, {=d}) kN verkar på ett fundament. Hur stor är den totala kraften?']
    for text in ctxs:
        for k in range(5):
            unit = 'kN' if 'kN' in text else ('m' if 'mätare' in text else 'N')
            add('G', nxt(), 'vektorer', 2,
                [v('a', -300, 400), v('b', -200, 300), v('c', -300, 400), v('d', -200, 300),
                 r('Rx', 'a + c'), r('Ry', 'b + d'), r('svar', 'sqrt(Rx^2 + Ry^2)'), c('svar > 50')],
                text, [ans('|R|', unit, 'svar', 1)],
                calc('\\vec{R} = ({=a} + {=c:p};\\ {=b} + {=d:p}) = ({=Rx};\\ {=Ry})', '|\\vec{R}| = \\sqrt{{=Rx:p}^2 + {=Ry:p}^2} \\approx {=svar:1}' + f'\\enh{{{unit}}}'))


def g_medel():
    nxt = fam('g-medel')
    ctxs = [('Ett arbetslag behövde följande antal dagar för {n} likadana grunder: {=L}. Beräkna medelvärdet.', 'dagar', 8, 20),
            ('Snickare rapporterade följande arbetstimmar per vecka: {=L}. Beräkna medelvärdet.', 'h', 34, 44),
            ('Kostnader i tkr för {n} leveranser: {=L}. Beräkna medelkostnaden.', 'tkr', 38, 56),
            ('Uppmätta höjder i meter: {=L}. Beräkna medelhöjden.', 'm', 8, 12),
            ('Betongprover hade hållfastheten (MPa): {=L}. Beräkna medelvärdet.', 'MPa', 25, 40)]
    for text, unit, lo, hi in ctxs:
        for n in [5, 6, 7, 8]:
            dec = 1 if unit == 'm' else 0
            add('G', nxt(), 'statistik', 1,
                [lista('L', n, lo, hi, dec), r('svar', 'mean(L)')],
                text.replace('{n}', str(n)), [ans('Medelvärde', unit, 'svar', 2)],
                calc('\\bar{x} = \\frac{\\text{summan}}{\\text{antalet}} = \\frac{{=sum(L):1}}{' + str(n) + '}', '\\approx {=svar:2}'))


def g_median():
    nxt = fam('g-median')
    ctxs = [('Antal dagar för olika arbetslag: {=L}. Bestäm medianen.', 'dagar', 8, 22),
            ('Arbetstimmar per vecka: {=L}. Bestäm medianen.', 'h', 34, 45),
            ('Kostnader i tkr: {=L}. Bestäm mediankostnaden.', 'tkr', 35, 60),
            ('Antal fel per leverans: {=L}. Vilket är medianvärdet?', 'st', 0, 9),
            ('Väntetider i minuter: {=L}. Bestäm medianen.', 'min', 5, 40)]
    for text, unit, lo, hi in ctxs:
        for n in [5, 6, 7, 8]:
            add('G', nxt(), 'statistik', 1,
                [lista('L', n, lo, hi), r('svar', 'median(L)')],
                text, [ans('Median', unit, 'svar', 1, fel=[('mean(L)', 'Du har räknat medelvärdet. Medianen är mittvärdet när talen är sorterade.'),
                                                  ('item(L, floor((count(L) + 1)/2))', 'Glöm inte att sortera talen innan du tar mittvärdet.')])],
                calc('T:Sortera: {=sorted(L)}', 'T:' + ('Mittvärdet' if n % 2 else 'Medel av de två mittersta') + ' = {=svar:1}'))


def g_typvarde_bredd():
    nxt = fam('g-typ')
    ctxs = [('Antal dagar: {=L}', 'dagar', 10, 16), ('Arbetstimmar: {=L}', 'h', 36, 42), ('Antal leveranser per vecka: {=L}', 'st', 2, 8),
            ('Skostorlekar i laget: {=L}', '', 39, 45), ('Antal sjukdagar: {=L}', 'dagar', 0, 6)]
    for text, unit, lo, hi in ctxs:
        for kind in ['typ', 'bredd']:
            for n in [7, 9]:
                if kind == 'typ':
                    add('G', nxt(), 'statistik', 1,
                        [lista('L', n, lo, hi), c('uniquemode(L)'), r('svar', 'mode(L)')],
                        text + '. Vilket är typvärdet?', [ans('Typvärde', unit, 'svar', 0, exact=True)],
                        calc('T:Sorterat: {=sorted(L)}', 'T:Vanligast: {=svar} ({=modecount(L)} gånger)'))
                else:
                    add('G', nxt(), 'statistik', 1,
                        [lista('L', n, lo, hi), r('svar', 'range(L)'), c('svar > 0')],
                        text + '. Beräkna variationsbredden.', [ans('Variationsbredd', unit, 'svar', 0, exact=True)],
                        calc('\\text{största} - \\text{minsta} = {=max(L)} - {=min(L)}', '= {=svar}'))


def g_viktat():
    nxt = fam('g-viktat')
    pairs = [('En skola', 'klassrum', 'matsal'), ('Ett kontor', 'kontorsdel', 'lagerdel'), ('En fastighet', 'bostäder', 'garage'),
             ('Ett köpcentrum', 'butiker', 'biograf'), ('En idrottshall', 'hall', 'omklädning'), ('Ett sjukhus', 'vårdavdelning', 'kök'),
             ('En verkstad', 'verkstad', 'kontor'), ('Ett hotell', 'rum', 'konferens')]
    for bld, p1, p2 in pairs:
        for phr in ['Beräkna byggnadens medelförbrukning per m².', 'Vilken viktad medelförbrukning har byggnaden?', 'Beräkna medelvärdet med hänsyn till arean.']:
            add('G', nxt(), 'statistik', 2,
                [v('A1', 2, 15, 0), r('A1', 'A1*100'), v('A2', 1, 10, 0), r('A2', 'A2*100'), v('e1', 15, 45), v('e2', 'e1 + 8', 80),
                 r('svar', '(A1*e1 + A2*e2)/(A1 + A2)')],
                f'{bld} har {p1} på {{=A1}} m² som använder {{=e1}} kWh/m² och {p2} på {{=A2}} m² som använder {{=e2}} kWh/m². {phr}',
                [ans('Medel', 'kWh/m²', 'svar', 1, fel=[('(e1 + e2)/2', 'Du har tagit vanligt medelvärde. Delarna är olika stora, så du måste väga med arean.')])],
                calc('E_{\\text{tot}} = {=A1} \\cdot {=e1} + {=A2} \\cdot {=e2} = {=A1*e1 + A2*e2}\\enh{kWh}',
                     'E_{\\text{medel}} = \\frac{{=A1*e1 + A2*e2}}{{=A1 + A2}} \\approx {=svar:1}\\enh{kWh/m^2}'))


def g_interpolation():
    nxt = fam('g-interp')
    ctxs = [('Hastighetstrycket qₚ är {=y1:2} kN/m² vid {=x1} m höjd och {=y2:2} kN/m² vid {=x2} m. Bestäm qₚ vid {=x} m.', 'kN/m²', 2, 'up'),
            ('Ett material väger {=y1} kg vid {=x1} mm tjocklek och {=y2} kg vid {=x2} mm. Bestäm vikten vid {=x} mm.', 'kg', 1, 'up'),
            ('Temperaturen var {=y1} °C kl {=x1} och {=y2} °C kl {=x2}. Bestäm temperaturen kl {=x}.', '°C', 1, 'up'),
            ('Hållfastheten är {=y1} kN vid {=x1} % fukthalt och {=y2} kN vid {=x2} %. Bestäm hållfastheten vid {=x} %.', 'kN', 1, 'down'),
            ('U-värdet är {=y1:2} vid {=x1} mm isolering och {=y2:2} vid {=x2} mm. Bestäm U-värdet vid {=x} mm.', '', 3, 'down'),
            ('En skiva kostar {=y1} kr vid {=x1} m² och {=y2} kr vid {=x2} m². Bestäm priset vid {=x} m².', 'kr', 1, 'up'),
            ('Värmemotståndet är {=y1:2} vid {=x1} mm och {=y2:2} vid {=x2} mm. Bestäm värdet vid {=x} mm.', '', 3, 'up')]
    for text, unit, dec, d in ctxs:
        for k in range(5):
            if unit in ('kN/m²',):
                parts = [val('x1', [4, 8, 10, 15, 20, 25]), r('x2', 'x1 + if(x1 < 10, 4, 5)'), v('x', 'x1 + 1', 'x2 - 1'),
                         v('y1', 0.3, 1.4, 2), v('y2', 'y1 + 0.03', 'y1 + 0.2', 2)]
            elif unit == '°C':
                parts = [val('x1', [6, 7, 8, 9, 10]), r('x2', 'x1 + 4'), v('x', 'x1 + 1', 'x2 - 1'), v('y1', -5, 15), v('y2', 'y1 + 2', 'y1 + 14')]
            elif unit == '':
                parts = [val('x1', [50, 100, 150, 200]), r('x2', 'x1 + 50'), v('x', 'x1 + 10', 'x2 - 10', 0, 5),
                         v('y1', 0.15, 0.6, 2), v('y2', 'y1 - 0.12', 'y1 - 0.02', 2) if d == 'down' else v('y2', 'y1 + 0.05', 'y1 + 0.6', 2)]
            else:
                parts = [v('x1', 5, 30), v('dx', 4, 20), r('x2', 'x1 + dx'), v('x', 'x1 + 1', 'x2 - 1'), v('y1', 8, 60),
                         v('y2', 'y1 - 10', 'y1 - 2') if d == 'down' else v('y2', 'y1 + 3', 'y1 + 40')]
            parts += [c('x > x1 && x < x2'), r('svar', 'y1 + (x - x1)/(x2 - x1)*(y2 - y1)')]
            add('G', nxt(), 'interpolation', 2, parts, text, [ans('Värde', unit, 'svar', dec, fel=[('(y1 + y2)/2', 'Du har tagit mitten mellan värdena. Det stämmer bara om x ligger precis mitt emellan – räkna med andelen.')])],
                calc('y = y_1 + \\frac{x - x_1}{x_2 - x_1} \\cdot (y_2 - y_1)',
                     'y = {=y1} + \\frac{{=x} - {=x1}}{{=x2} - {=x1}} \\cdot ({=y2} - {=y1})', 'y \\approx {=svar:' + str(dec) + '}'))


def g_tyngd():
    nxt = fam('g-tyngd')
    for mat, gamma in MATERIAL_GAMMA:
        for shape in ['vol', 'mått', 'vägg']:
            if shape == 'vol':
                parts = [v('V', 0.2, 12, 1), r('svar', f'{gamma}*V')]
                text = f'En byggdel av {mat} har volymen {{=V:1}} m³. Tyngdtätheten är {gamma} kN/m³. Beräkna tyngden.'
                sol = calc(f'G = \\gamma \\cdot V = {gamma} \\cdot {{=V:1}}', 'G = {=svar:1}\\enh{kN}')
                pts = 1
            elif shape == 'mått':
                parts = [v('l', 1.5, 8, 1), v('b', 0.2, 1.2, 2), v('h', 0.2, 1.2, 2), r('V', 'l*b*h'), r('svar', f'{gamma}*V')]
                text = f'En balk av {mat} är {{=l:1}} m lång, {{=b:2}} m bred och {{=h:2}} m hög. Tyngdtäthet {gamma} kN/m³. Beräkna tyngden.'
                sol = calc('V = {=l:1} \\cdot {=b:2} \\cdot {=h:2} = {=V:3}\\enh{m^3}', f'G = {gamma} \\cdot {{=V:3}} \\approx {{=svar:2}}\\enh{{kN}}')
                pts = 2
            else:
                parts = [v('l', 2, 10, 1), v('h', 2, 3.2, 1), val('t', [0.1, 0.12, 0.15, 0.2, 0.25, 0.3]), r('V', 'l*h*t'), r('svar', f'{gamma}*V')]
                text = f'En vägg av {mat} är {{=l:1}} m lång, {{=h:1}} m hög och {{=t:2}} m tjock. Tyngdtätheten är {gamma} kN/m³. Beräkna väggens tyngd.'
                sol = calc('V = {=l:1} \\cdot {=h:1} \\cdot {=t:2} = {=V:3}\\enh{m^3}', f'G = {gamma} \\cdot {{=V:3}} \\approx {{=svar:1}}\\enh{{kN}}')
                pts = 2
            add('G', nxt(), 'mekanik', pts, parts, text, [ans('Tyngd', 'kN', 'svar', 2)], sol)
    for mat, gamma in MATERIAL_GAMMA:
        for phr in ['Beräkna tyngdtätheten.', 'Vilken tyngdtäthet har materialet?']:
            add('G', nxt(), 'mekanik', 1,
                [v('V', 0.5, 8, 1), r('G', f'{gamma}*V')],
                f'Ett block av {mat} har tyngden {{=G:1}} kN och volymen {{=V:1}} m³. {phr}',
                [ans('γ', 'kN/m³', f'G/V', 1)],
                calc('\\gamma = \\frac{G}{V} = \\frac{{=G:1}}{{=V:1}}', f'\\gamma = {{=G/V:1}}\\enh{{kN/m^3}}'))


def g_ytlast():
    nxt = fam('g-ytlast')
    for obj in ['En vägg', 'Ett bjälklag', 'Ett tak', 'En fasadskiva', 'Ett golv', 'En mellanvägg']:
        for kind in ['yta', 'linje']:
            if kind == 'yta':
                add('G', nxt(), 'mekanik', 1,
                    [v('A', 5, 60, 1), v('q', 0.3, 4, 1), r('svar', 'A*q')],
                    f'{obj} på {{=A:1}} m² har egentyngden {{=q:1}} kN/m². Hur stor är den totala tyngden?',
                    [ans('Tyngd', 'kN', 'svar', 1)], calc('G = {=q:1} \\cdot {=A:1}', 'G = {=svar:1}\\enh{kN}'))
            else:
                add('G', nxt(), 'mekanik', 1,
                    [v('L', 2, 12, 1), v('q', 0.5, 6, 1), r('svar', 'L*q')],
                    f'En linjelast från {obj.lower()} är {{=q:1}} kN/m och verkar längs {{=L:1}} m. Beräkna den totala lasten.',
                    [ans('Tyngd', 'kN', 'svar', 1)], calc('G = {=q:1} \\cdot {=L:1}', 'G = {=svar:1}\\enh{kN}'))


def g_tyngdpunkt():
    nxt = fam('g-tp')
    for obj in ['En stålbalk', 'En limträbalk', 'En planka', 'En bärlina', 'En gångbrygga', 'En lyftbalk']:
        for phr in ['Var ligger den gemensamma tyngdpunkten mätt från vänster ände?', 'Bestäm den gemensamma tyngdpunktens läge från vänster ände.']:
            add('G', nxt(), 'tyngdpunkt', 2,
                [v('L', 4, 10), v('m1', 100, 600, 0, 50), v('m2', 50, 400, 0, 50), v('x2', 0.5, 'L - 0.5', 1),
                 r('svar', '(m1*L/2 + m2*x2)/(m1 + m2)')],
                f'{obj} är {{=L}} m lång och väger {{=m1}} kg (jämnt fördelat). En last på {{=m2}} kg ligger {{=x2:1}} m från vänster ände. {phr}',
                [ans('x_T', 'm', 'svar', 2, fel=[('x2', 'Du har glömt balkens egen vikt. Den räknas som en massa i balkens mitt.'),
                                                 ('(L/2 + x2)/2', 'Du har tagit vanligt medelvärde av lägena. Tyngdpunkten är ett viktat medelvärde: väg med massorna.')])],
                calc('T:Balkens egen tyngdpunkt ligger i mitten: {=L/2:1} m', 'x_T = \\frac{{=m1} \\cdot {=L/2:1} + {=m2} \\cdot {=x2:1}}{{=m1} + {=m2}}', 'x_T \\approx {=svar:2}\\enh{m}'))
    for shape in ['rektangel', 'triangel']:
        for k in range(6):
            if shape == 'rektangel':
                add('G', nxt(), 'tyngdpunkt', 1,
                    [v('b', 50, 300, 0, 10), v('h', 50, 400, 0, 10), r('svar', 'h/2')],
                    'Ett rektangulärt tvärsnitt är {=b} mm brett och {=h} mm högt med nedre vänstra hörnet i origo. Vilken y-koordinat har tyngdpunkten?',
                    [ans('y_T', 'mm', 'svar', 1)], calc('y_T = h / 2 = {=h} / 2', 'y_T = {=svar:1}\\enh{mm}'))
            else:
                add('G', nxt(), 'tyngdpunkt', 1,
                    [v('b', 60, 300, 0, 10), v('h', 60, 300, 0, 15), r('svar', 'h/3')],
                    'En triangel har basen {=b} mm och höjden {=h} mm. Hur högt över basen ligger tyngdpunkten?',
                    [ans('y_T', 'mm', 'svar', 1)], calc('y_T = h / 3 = {=h} / 3', 'y_T = {=svar:1}\\enh{mm}'))


# ============================================================================
# VG-NIVÅ
# ============================================================================

def vg_flera_procent():
    nxt = fam('vg-flerproc')
    for thing, unit in SAKER:
        for steps in [2, 3]:
            parts = [v('P', 10, 90), r('P', 'P*10000'), val('p1', [3, 5, 6, 8, 10, 12, 15]), val('p2', [-5, -4, 3, 4, 5, 6, 7, -8]),
                     val('p3', [2, 3, -3, 5, -2])]
            f = '(1 + p1/100)*(1 + p2/100)' + ('*(1 + p3/100)' if steps == 3 else '')
            parts += [r('f', f), r('svar', 'P*f'), r('tot', '(f - 1)*100')]
            changes = 'först med {=p1} %, sedan med {=p2} %' + (' och sist med {=p3} %' if steps == 3 else '')
            add('VG', nxt(), 'procent', 3 if steps == 3 else 2, parts,
                f'Kostnaden för {thing} är {{=P}} {unit}. Kostnaden förändras {changes} (minus betyder minskning). Beräkna den nya kostnaden och den totala procentuella förändringen.',
                [ans('Ny kostnad', unit, 'svar', 0, fel=[('P*(1 + (p1 + p2' + (' + p3' if steps == 3 else '') + ')/100)', 'Du har lagt ihop procenten. Multiplicera förändringsfaktorerna i stället.')]),
                 ans('Total förändring', '%', 'tot', 2, fel=[('p1 + p2' + (' + p3' if steps == 3 else ''), 'Du har lagt ihop procenten. Multiplicera förändringsfaktorerna och dra bort 1.')])],
                calc('T:Multiplicera förändringsfaktorerna, addera inte procenten.',
                     'f = {=1+p1/100:2} \\cdot {=1+p2/100:2}' + (' \\cdot {=1+p3/100:2}' if steps == 3 else '') + ' = {=f:4}',
                     '{=P} \\cdot {=f:4} \\approx {=svar:0}\\enh{kr}', 'T:Total förändring: {=tot:2} %'))


def vg_snitt_per_ar():
    nxt = fam('vg-snitt')
    for thing, unit in SAKER:
        for kind in ['minskar', 'ökar']:
            parts = [v('P', 10, 80), r('P', 'P*1000'), val('n', [2, 3, 4, 5]), val('p', [4, 5, 6, 8, 10, 12, 15])]
            parts += [r('S', 'P*(1 ' + ('-' if kind == 'minskar' else '+') + ' p/100)^n'), r('S', 'round(S)'),
                      r('x', '(S/P)^(1/n)'), r('svar', 'abs(x - 1)*100')]
            add('VG', nxt(), 'procent', 2, parts,
                f'Värdet på {thing} {kind} från {{=P}} {unit} till {{=S}} {unit} på {{=n}} år. Beräkna den genomsnittliga procentuella förändringen per år.',
                [ans('Per år', '%', 'svar', 1, fel=[('abs(S - P)/P*100/n', 'Du har delat den totala förändringen med antalet år. Förändringen sker som ränta-på-ränta: lös x^n = slut/start.')])],
                calc('x^{{=n}} = \\frac{{=S}}{{=P}} = {=S/P:4}', 'x = {=S/P:4}^{1/{=n}} \\approx {=x:4}', 'T:Förändring ≈ {=svar:1} % per år'))


def vg_ranta_avskr():
    nxt = fam('vg-ranta')
    for ctx in ['Ett företag sätter in', 'En förening placerar', 'Du sparar', 'En kommun avsätter', 'Ett hushåll sätter in', 'Ett byggbolag placerar']:
        for k in range(4):
            add('VG', nxt(), 'ekonomi', 2,
                [v('K', 5, 90), r('K', 'K*1000'), val('p', [2, 2.5, 3, 3.5, 4, 5]), val('n', [3, 4, 5, 6, 8, 10]), r('svar', 'K*(1 + p/100)^n')],
                f'{ctx} {{=K}} kr med {{=p}} % ränta per år (ränta-på-ränta). Hur stort är beloppet efter {{=n}} år?',
                [ans('Belopp', 'kr', 'svar', 0, fel=[('K*(1 + p/100*n)', 'Du har räknat enkel ränta. Med ränta-på-ränta multiplicerar du med förändringsfaktorn n gånger.')])],
                calc('K_n = K_0 \\cdot (1 + r)^n', 'K = {=K} \\cdot {=1+p/100:3}^{{=n}}', '\\approx {=svar:0}\\enh{kr}'))
    for thing, unit in SAKER:
        for k in range(2):
            add('VG', nxt(), 'ekonomi', 2,
                [v('P', 10, 90), r('P', 'P*1000'), val('p', [10, 12, 15, 18, 20, 25]), val('n', [2, 3, 4, 5]), r('svar', 'P*(1 - p/100)^n'), r('minsk', 'P - svar')],
                f'{thing.capitalize()} köps för {{=P}} {unit} och skrivs av med {{=p}} % per år. Vad är värdet efter {{=n}} år, och hur mycket har det minskat totalt?',
                [ans('Värde', unit, 'svar', 0), ans('Minskning', unit, 'minsk', 0)],
                calc('V = {=P} \\cdot {=1-p/100:2}^{{=n}} \\approx {=svar:0}\\enh{kr}', 'T:Minskning: {=P} − {=svar:0} = {=minsk:0} kr'))


def vg_lan():
    nxt = fam('vg-lan')
    for who in ['Ett byggföretag', 'En bostadsrättsförening', 'Ett hushåll', 'En hantverkare', 'En kommun', 'Ett åkeri']:
        for k in range(4):
            add('VG', nxt(), 'ekonomi', 2,
                [v('L', 6, 60), r('L', 'L*10000'), val('am', [1000, 1500, 2000, 2500, 3000, 5000]), val('p', [3, 4, 4.5, 5, 6, 7]),
                 val('m', [1, 2, 3, 6, 12]), r('kvar', 'L - (m - 1)*am'), r('ranta', 'kvar*p/100/12'), r('svar', 'am + ranta'), c('kvar > am*3')],
                f'{who} har ett lån på {{=L}} kr med rak amortering {{=am}} kr per månad och {{=p}} % årsränta. Hur mycket betalar de totalt (amortering + ränta) i månad {{=m}}?',
                [ans('Betalning', 'kr', 'svar', 0)],
                calc('T:Före månad {=m} har {=m-1} amorteringar gjorts.', '\\text{kvar} = {=L} - {=m-1} \\cdot {=am} = {=kvar}\\enh{kr}',
                     '\\text{ränta} = {=kvar} \\cdot \\frac{{=p/100:3}}{12} \\approx {=ranta:0}\\enh{kr}', '\\text{betalning} \\approx {=svar:0}\\enh{kr}'))


def vg_spill():
    nxt = fam('vg-spill')
    for obj in PLATTOR:
        for spill in [3, 4, 5, 8]:
            add('VG', nxt(), 'mekanik', 3,
                [v('l', 4, 14, 1), v('b', 3, 'l', 1), val('t', [0.12, 0.15, 0.18, 0.20, 0.25]), val('g', [24, 25]),
                 r('V', 'l*b*t'), r('Vb', f'V*(1 + {spill}/100)'), r('G', 'g*Vb')],
                f'{obj} är {{=l:1}} m × {{=b:1}} m × {{=t:2}} m. Betongen har tyngdtätheten {{=g}} kN/m³. Beställningsvolymen ska innehålla {spill} % spill. Beräkna beställningsvolymen och den totala tyngden (med spill).',
                [ans('Beställningsvolym', 'm³', 'Vb', 2), ans('Tyngd', 'kN', 'G', 1)],
                calc('V = {=l:1} \\cdot {=b:1} \\cdot {=t:2} = {=V:3}\\enh{m^3}', f'V_{{\\text{{best}}}} = {{=V:3}} \\cdot {1 + spill / 100:.2f}'.replace('.', ',') + ' \\approx {=Vb:2}\\enh{m^3}',
                     'G = {=g} \\cdot {=Vb:2} \\approx {=G:1}\\enh{kN}'))


def vg_sammansatt():
    nxt = fam('vg-samm')
    combos = [('betong', 24, 'sten', 27), ('betong', 24, 'stål', 78), ('tegel', 18, 'betong', 25), ('trä', 5, 'stål', 78),
              ('lättbetong', 6, 'betong', 24), ('natursten', 27, 'armerad betong', 25)]
    for m1, g1, m2, g2 in combos:
        for obj in ['Ett fundament', 'En vägg', 'En pelare', 'En konstruktion']:
            add('VG', nxt(), 'mekanik', 2,
                [v('V1', 0.3, 6, 1), v('V2', 0.1, 3, 2), r('svar', f'{g1}*V1 + {g2}*V2')],
                f'{obj} består av {{=V1:1}} m³ {m1} ({g1} kN/m³) och {{=V2:2}} m³ {m2} ({g2} kN/m³). Beräkna den totala tyngden.',
                [ans('Tyngd', 'kN', 'svar', 1)],
                calc(f'G_1 = {g1} \\cdot {{=V1:1}} = {{={g1}*V1:1}}\\enh{{kN}}', f'G_2 = {g2} \\cdot {{=V2:2}} = {{={g2}*V2:2}}\\enh{{kN}}', 'G = {=svar:1}\\enh{kN}'))


def vg_viktat3():
    nxt = fam('vg-viktat')
    for bld in ['Ett tak', 'En kontorsfastighet', 'En byggarbetsplats med baracker', 'Ett radhusområde', 'En skola', 'Ett köpcentrum',
                'Ett sjukhus', 'En industrihall']:
        for n in [3, 4]:
            parts = [v('A1', 40, 1200, 0, 10), v('A2', 40, 900, 0, 10), v('A3', 40, 600, 0, 10), v('A4', 20, 400, 0, 10),
                     v('e1', 15, 30), v('e2', 20, 40), v('e3', 25, 60), v('e4', 30, 70)]
            if n == 3:
                parts += [r('svar', '(A1*e1 + A2*e2 + A3*e3)/(A1 + A2 + A3)')]
                txt = 'tre delar: {=A1} m² ({=e1} kWh/m²), {=A2} m² ({=e2} kWh/m²) och {=A3} m² ({=e3} kWh/m²)'
                num = '{=A1*e1 + A2*e2 + A3*e3}'; den = '{=A1 + A2 + A3}'
            else:
                parts += [r('svar', '(A1*e1 + A2*e2 + A3*e3 + A4*e4)/(A1 + A2 + A3 + A4)')]
                txt = 'fyra delar: {=A1} m² ({=e1} kWh/m²), {=A2} m² ({=e2} kWh/m²), {=A3} m² ({=e3} kWh/m²) och {=A4} m² ({=e4} kWh/m²)'
                num = '{=A1*e1 + A2*e2 + A3*e3 + A4*e4}'; den = '{=A1 + A2 + A3 + A4}'
            for phr in ['Beräkna medelförbrukningen per m².', 'Beräkna den areaviktade medelförbrukningen.']:
                add('VG', nxt(), 'statistik', 2, parts, f'{bld} har {txt}. {phr}', [ans('Medel', 'kWh/m²', 'svar', 1)],
                    calc('T:Gör en tabell med A, e och A · e. Summera.', f'E_{{\\text{{medel}}}} = \\frac{{{num}}}{{{den}}}', '\\approx {=svar:1}\\enh{kWh/m^2}'))


def vg_stabilitet():
    nxt = fam('vg-stab')
    for ctx, unit in [('dagar per grund', 'dagar'), ('timmar per vägg', 'h'), ('dagar per villa', 'dagar'), ('timmar per takstol', 'h'), ('dagar per trapphus', 'dagar')]:
        for n in [5, 6, 7, 8]:
            add('VG', nxt(), 'statistik', 3,
                [v('m', 8, 20), lista('X', n, 'm - 1', 'm + 1'), lista('Y', n, 'm - 5', 'm + 5'), val('s', [0, 1]),
                 r('A', 'if(s == 0, X, Y)'), r('B', 'if(s == 0, Y, X)'), r('rA', 'range(A)'), r('rB', 'range(B)'), c('abs(rB - rA) >= 4'), r('mA', 'mean(A)'), r('mB', 'mean(B)')],
                f'Två arbetslag har följande tider ({ctx}). Lag A: {{=A}}. Lag B: {{=B}}. Beräkna medelvärdet och variationsbredden för båda lagen. Vilket lag är mest stabilt?',
                [ans('Medel A', unit, 'mA', 2), ans('Medel B', unit, 'mB', 2), ans('Bredd A', unit, 'rA', 0, exact=True),
                 ans('Bredd B', unit, 'rB', 0, exact=True), choice('Mest stabilt', ['Lag A', 'Lag B'], 's')],
                calc('\\bar{x}_A = {=mA:2},\\quad \\bar{x}_B = {=mB:2}', '\\text{bredd}_A = {=max(A)} - {=min(A)} = {=rA}', '\\text{bredd}_B = {=max(B)} - {=min(B)} = {=rB}',
                     'T:Det lag som har minst variationsbredd ({=min(rA, rB)}) har minst spridning och är därför mest stabilt.'))


def vg_stdav():
    nxt = fam('vg-stdav')
    for ctx, unit in [('Mätta höjder', 'm'), ('Tider per moment', 'min'), ('Betonghållfasthet', 'MPa'), ('Leveranstider', 'dagar'), ('Arbetstimmar', 'h')]:
        for n in [4, 5, 6]:
            for k in range(2):
                add('VG', nxt(), 'statistik', 3,
                    [lista('L', n, 10, 20), r('m', 'mean(L)'), r('s', 'stdev(L)'), c('s > 0.5')],
                    f'{ctx} ({unit}): {{=L}}. Beräkna medelvärdet och standardavvikelsen (stickprov, n − 1).',
                    [ans('Medelvärde', unit, 'm', 2), ans('Standardavvikelse', unit, 's', 2, fel=[('s*sqrt((count(L) - 1)/count(L))', 'Du har delat med n. För ett stickprov delar man med n − 1.')])],
                    calc('\\bar{x} = {=m:2}', 's = \\sqrt{\\frac{\\sum (x_i - \\bar{x})^2}{n - 1}}', 's \\approx {=s:2}'))


def vg_tak():
    nxt = fam('vg-tak')
    for obj in ['En takprofil', 'Ett pulpettak', 'En ramp', 'Ett sadeltak (halva)', 'En lastbrygga', 'En carport']:
        for k in range(4):
            add('VG', nxt(), 'trigonometri', 4,
                [v('l', 3, 12, 1), v('h', 0.6, 'l*0.8', 1), r('v', 'atan(h/l)'), r('L', 'sqrt(l^2 + h^2)')],
                f'{obj} bildar en rätvinklig triangel med horisontella längden {{=l:1}} m och höjdskillnaden {{=h:1}} m. Beräkna vinkeln mot horisontalplanet och den lutande sidans längd.',
                [ans('Vinkel', '°', 'v', 1), ans('Längd', 'm', 'L', 2)],
                calc('\\tan v = \\frac{{=h:1}}{{=l:1}} \\Rightarrow v \\approx {=v:1}^\\circ', 'L = \\sqrt{{=l:1}^2 + {=h:1}^2} \\approx {=L:2}\\enh{m}'))


DEF = {'en byggnad': 'byggnaden', 'ett torn': 'tornet', 'en kran': 'kranen', 'en skorsten': 'skorstenen', 'en mast': 'masten', 'ett höghus': 'höghuset'}


def vg_matning():
    nxt = fam('vg-matn')
    for obj in ['en byggnad', 'ett torn', 'en kran', 'en skorsten', 'en mast', 'ett höghus']:
        for k in range(4):
            add('VG', nxt(), 'trigonometri', 3,
                [v('d', 8, 60, 1), v('v', 15, 60, 1), val('h0', [1.5, 1.6, 1.7, 1.8]), r('svar', 'd*tan(v) + h0')],
                f'Ett mätinstrument står {{=d:1}} m från {obj} och mäter vinkeln {{=v:1}}° upp till toppen. Instrumenthöjden är {{=h0:1}} m. Hur hög är {DEF[obj]}?',
                [ans('Höjd', 'm', 'svar', 2)],
                calc('H = d \\cdot \\tan(v) + h_0', 'H = {=d:1} \\cdot \\tan {=v:1}^\\circ + {=h0:1}', 'H \\approx {=svar:2}\\enh{m}'))


def vg_kran():
    nxt = fam('vg-kran')
    for obj in ['En lyftkran', 'En mobilkran', 'Ett stag', 'En vajer', 'En stege', 'En byggställning']:
        for k in range(4):
            add('VG', nxt(), 'trigonometri', 3,
                [v('a', 6, 30, 1), v('v', 25, 65), r('h', 'a*tan(v)'), r('c', 'a/cos(v)')],
                f'{obj}: avståndet längs marken är {{=a:1}} m och vinkeln mot marken är {{=v}}°. Beräkna höjden och den lutande längden.',
                [ans('Höjd', 'm', 'h', 2), ans('Lutande längd', 'm', 'c', 2)],
                calc('h = {=a:1} \\cdot \\tan {=v}^\\circ \\approx {=h:2}\\enh{m}', 'c = \\frac{{=a:1}}{\\cos {=v}^\\circ} \\approx {=c:2}\\enh{m}',
                     'T:Kontroll med Pythagoras: √(a² + h²) ≈ {=sqrt(a^2 + h^2):2} m'))


def vg_takstol():
    nxt = fam('vg-takstol')
    for obj in ['En takstol', 'En gavel', 'Ett sadeltak', 'En takkupa', 'En carport med sadeltak', 'Ett förrådstak']:
        for k in range(4):
            add('VG', nxt(), 'trigonometri', 3,
                [v('S', 4, 14, 1), v('v', 15, 45), r('h', 'S/2*tan(v)'), r('L', 'S/2/cos(v)')],
                f'{obj} är en likbent triangel med spännvidden {{=S:1}} m och takvinkeln {{=v}}°. Beräkna höjden och längden på ett takben.',
                [ans('Höjd', 'm', 'h', 2), ans('Takben', 'm', 'L', 2)],
                calc('T:Dela på mitten: halva spännvidden = {=S/2:2} m', 'h = {=S/2:2} \\cdot \\tan {=v}^\\circ \\approx {=h:2}\\enh{m}',
                     'L = \\frac{{=S/2:2}}{\\cos {=v}^\\circ} \\approx {=L:2}\\enh{m}'))


def vg_vektor():
    nxt = fam('vg-vek')
    for ctx, unit in [('Två personer drar en bil', 'N'), ('Två vajrar håller en mast', 'N'), ('Två krafter verkar på ett fäste', 'kN'),
                      ('Två bogserlinor drar en pråm', 'kN'), ('En mätare går två sträckor', 'm'), ('Två stag belastar en nod', 'kN')]:
        for k in range(4):
            add('VG', nxt(), 'vektorer', 3,
                [v('a', 20, 400), v('b', -150, 200), v('c', 20, 400), v('d', -150, 200),
                 r('Rx', 'a + c'), r('Ry', 'b + d'), c('abs(Ry) > 10'), r('R', 'sqrt(Rx^2 + Ry^2)'), r('vinkel', 'atan(abs(Ry)/Rx)')],
                f'{ctx}: ({{=a}}, {{=b}}) {unit} och ({{=c}}, {{=d}}) {unit}. Beräkna resultantens storlek och vinkeln mot x-axeln.',
                [ans('|R|', unit, 'R', 1), ans('Vinkel', '°', 'vinkel', 1)],
                calc('\\vec{R} = ({=Rx};\\ {=Ry})', '|\\vec{R}| = \\sqrt{{=Rx:p}^2 + {=Ry:p}^2} \\approx {=R:1}' + f'\\enh{{{unit}}}',
                     '\\tan v = \\frac{{=abs(Ry)}}{{=Rx}} \\Rightarrow v \\approx {=vinkel:1}^\\circ', 'T:Vinkeln räknas ovanför x-axeln om Ry > 0, annars under.'))


def vg_komposant():
    nxt = fam('vg-komp')
    for ctx, unit in [('En vajer drar', 'N'), ('En lina drar', 'N'), ('Ett stag trycker', 'kN'), ('En kran lyfter snett med', 'kN'), ('En person drar', 'N'), ('Vinden trycker', 'kN')]:
        for k in range(4):
            add('VG', nxt(), 'vektorer', 2,
                [v('F', 100, 1500, 0, 10), v('v', 15, 75), r('Fx', 'F*cos(v)'), r('Fy', 'F*sin(v)')],
                f'{ctx} med kraften {{=F}} {unit} i vinkeln {{=v}}° mot marken. Beräkna den horisontella och den vertikala komposanten.',
                [ans('F_x', unit, 'Fx', 1), ans('F_y', unit, 'Fy', 1)],
                calc('F_x = {=F} \\cdot \\cos {=v}^\\circ \\approx {=Fx:1}' + f'\\enh{{{unit}}}', 'F_y = {=F} \\cdot \\sin {=v}^\\circ \\approx {=Fy:1}' + f'\\enh{{{unit}}}'))


PLURAL = {'timme': 'timmar', 'dag': 'dagar', 'km': 'km', 'm³': 'm³'}


def vg_brytpunkt():
    nxt = fam('vg-bryt')
    for a, b in [('Firma A', 'Firma B'), ('Abonnemang A', 'Abonnemang B'), ('Kranuthyrare A', 'Kranuthyrare B'), ('Leverantör A', 'Leverantör B'),
                 ('Åkeri A', 'Åkeri B'), ('Ställningsfirma A', 'Ställningsfirma B')]:
        for unit in ['timme', 'dag', 'km', 'm³']:
            add('VG', nxt(), 'linjara-funktioner', 3,
                [v('kA', 15, 60), v('kB', 5, 'kA - 5'), v('x', 5, 40), v('mA', 100, 900, 0, 10), r('mB', 'mA + (kA - kB)*x')],
                f'{a} tar {{=mA}} kr + {{=kA}} kr per {unit}. {b} tar {{=mB}} kr + {{=kB}} kr per {unit}. Vid hur många {PLURAL[unit]} kostar de lika mycket, och vad kostar det då?',
                [ans('Antal', PLURAL[unit], 'x', 1), ans('Kostnad', 'kr', 'mA + kA*x', 0)],
                calc('{=mA} + {=kA}x = {=mB} + {=kB}x', '{=kA-kB}x = {=mB-mA} \\Rightarrow x = {=x}', 'y = {=mA} + {=kA} \\cdot {=x} = {=mA + kA*x}\\enh{kr}'))


def vg_linjar_modell():
    nxt = fam('vg-modell')
    for ctx, unit, xu in [('En transport på {=x1} km kostar {=y1} kr och en på {=x2} km kostar {=y2} kr', 'kr', 'km'),
                          ('Hyra i {=x1} dagar kostar {=y1} kr och i {=x2} dagar {=y2} kr', 'kr', 'dagar'),
                          ('Ett jobb på {=x1} timmar kostar {=y1} kr och ett på {=x2} timmar {=y2} kr', 'kr', 'timmar'),
                          ('{=x1} m³ betong kostar {=y1} kr och {=x2} m³ kostar {=y2} kr', 'kr', 'm³'),
                          ('En tank innehåller {=y1} liter efter {=x1} min och {=y2} liter efter {=x2} min', 'liter', 'min')]:
        for k in range(5):
            add('VG', nxt(), 'linjara-funktioner', 3,
                [v('k', 20, 400, 0, 5), v('m', 100, 2000, 0, 50), v('x1', 1, 8), v('x2', 'x1 + 3', 'x1 + 15'), r('y1', 'k*x1 + m'), r('y2', 'k*x2 + m'),
                 v('X', 'x2 + 2', 'x2 + 25'), r('B', 'k*X + m')],
                f'{ctx} (linjärt samband). Bestäm k och m, och beräkna hur mycket ({xu}) man får för {{=B}} {unit}.',
                [ans('k', f'{unit}/{xu}', 'k', 1), ans('m', unit, 'm', 0), ans('Mängd', xu, 'X', 1)],
                calc('k = \\frac{{=y2} - {=y1}}{{=x2} - {=x1}} = {=k}', 'm = {=y1} - {=k} \\cdot {=x1} = {=m}', '{=B} = {=k}x + {=m} \\Rightarrow x = {=X}'))


def vg_olikhet():
    nxt = fam('vg-olik')
    for ctx in ['Kranhyra', 'Ställningshyra', 'Maskinhyra', 'Containerhyra', 'Lifthyra', 'Hyra av grävmaskin']:
        for k in range(4):
            add('VG', nxt(), 'algebra', 2,
                [v('f', 500, 4000, 0, 100), v('d', 300, 4000, 0, 100), v('B', 'f + d*3', 'f + d*15', 0, 500), r('q', '(B - f)/d'), c('!isint(q)'), r('svar', 'floor(q)')],
                f'{ctx} kostar {{=f}} kr i startavgift plus {{=d}} kr per dag. Budgeten är {{=B}} kr. Ställ upp en olikhet och bestäm hur många hela dagar man högst kan hyra.',
                [ans('Dagar', 'st', 'svar', 0, exact=True)],
                calc('{=f} + {=d}x \\le {=B}', 'x \\le \\frac{{=B} - {=f}}{{=d}} \\approx {=q:2}', 'T:Högst {=svar} hela dagar (avrunda nedåt)'))


def vg_tprofil():
    nxt = fam('vg-tprof')
    for name in ['En T-profil', 'Ett T-tvärsnitt', 'En T-balk', 'Ett limträtvärsnitt i T-form', 'En stålprofil i T-form', 'En betongbalk med fläns']:
        for k in range(4):
            add('VG', nxt(), 'tyngdpunkt', 4,
                [v('bf', 80, 300, 0, 10), v('tf', 15, 60, 0, 5), v('tw', 15, 60, 0, 5), v('hw', 80, 300, 0, 10), c('bf > tw*2'),
                 r('A1', 'bf*tf'), r('y1', 'hw + tf/2'), r('A2', 'tw*hw'), r('y2', 'hw/2'), r('svar', '(A1*y1 + A2*y2)/(A1 + A2)')],
                f'{name} har en fläns {{=bf}} × {{=tf}} mm ovanpå ett liv {{=tw}} × {{=hw}} mm. Livet står på x-axeln och tvärsnittet är symmetriskt kring y-axeln. Beräkna tyngdpunktens höjd y_T.',
                [ans('y_T', 'mm', 'svar', 1)],
                calc('A_1 = {=A1}\\enh{mm^2},\\ y_1 = {=hw} + {=tf/2:1} = {=y1:1}\\enh{mm}', 'A_2 = {=A2}\\enh{mm^2},\\ y_2 = {=y2:1}\\enh{mm}',
                     'y_T = \\frac{{=A1} \\cdot {=y1:1} + {=A2} \\cdot {=y2:1}}{{=A1 + A2}}', 'y_T \\approx {=svar:1}\\enh{mm}'))


def vg_lform():
    nxt = fam('vg-lform')
    for name in ['En L-profil', 'Ett vinkeljärn', 'Ett L-format tvärsnitt', 'En vinkelplåt', 'En L-formad platta', 'En hörnprofil']:
        for coord in ['x', 'y']:
            for k in range(2):
                add('VG', nxt(), 'tyngdpunkt', 3,
                    [v('t', 20, 60, 0, 5), v('H', 120, 300, 0, 10), v('B', 100, 250, 0, 10),
                     r('A1', 't*H'), r('x1', 't/2'), r('y1', 'H/2'), r('A2', '(B - t)*t'), r('x2', 't + (B - t)/2'), r('y2', 't/2'),
                     c('B > t*2.5'), c('H > t*3'),
                     r('svar', f'(A1*{coord}1 + A2*{coord}2)/(A1 + A2)')],
                    f'{name} består av ett stående ben {{=t}} × {{=H}} mm (bredd × höjd) och ett liggande ben som gör hela bredden {{=B}} mm med tjockleken {{=t}} mm. Hörnet ligger i origo. Beräkna {coord}-koordinaten för tyngdpunkten.',
                    [ans(f'{coord}_T', 'mm', 'svar', 1)],
                    calc('A_1 = {=t} \\cdot {=H} = {=A1}\\enh{mm^2},\\ (' + '{=x1:1};\\ {=y1:1})', 'A_2 = ({=B} - {=t}) \\cdot {=t} = {=A2}\\enh{mm^2},\\ ({=x2:1};\\ {=y2:1})',
                         f'{coord}_T = \\frac{{{{=A1}} \\cdot {{={coord}1:1}} + {{=A2}} \\cdot {{={coord}2:1}}}}{{{{=A1 + A2}}}}', f'{coord}_T \\approx {{=svar:1}}\\enh{{mm}}'))


def vg_balk2():
    nxt = fam('vg-balk2')
    for obj in ['En stålbalk', 'En limträbalk', 'En lyftbalk', 'En gångbro', 'Ett bjälklagselement', 'En prefabbalk']:
        for k in range(4):
            add('VG', nxt(), 'tyngdpunkt', 3,
                [v('L', 4, 12), v('m0', 100, 800, 0, 50), v('m1', 50, 500, 0, 50), v('x1', 0.5, 'L/2', 1), v('m2', 50, 500, 0, 50), v('x2', 'L/2', 'L - 0.5', 1),
                 r('svar', '(m0*L/2 + m1*x1 + m2*x2)/(m0 + m1 + m2)')],
                f'{obj} är {{=L}} m lång och väger {{=m0}} kg jämnt fördelat. Två laster ligger på den: {{=m1}} kg vid {{=x1:1}} m och {{=m2}} kg vid {{=x2:1}} m från vänster ände. Var ligger den gemensamma tyngdpunkten?',
                [ans('x_T', 'm', 'svar', 2)],
                calc('x_T = \\frac{{=m0} \\cdot {=L/2:1} + {=m1} \\cdot {=x1:1} + {=m2} \\cdot {=x2:1}}{{=m0} + {=m1} + {=m2}}', 'x_T \\approx {=svar:2}\\enh{m}'))


def vg_densitet():
    nxt = fam('vg-dens')
    for obj in PLATTOR:
        for cap in [8, 10, 12]:
            add('VG', nxt(), 'mekanik', 3,
                [v('l', 5, 16, 1), v('b', 3, 'l', 1), val('t', [0.12, 0.15, 0.18, 0.2, 0.25]), r('V', 'l*b*t'), r('m', '2400*V'),
                 r('bilar', f'ceil(m/{cap * 1000})'), c(f'!isint(m/{cap * 1000})'), r('G', 'm*9.82/1000')],
                f'{obj} är {{=l:1}} × {{=b:1}} m och {{=t:2}} m tjock. Betongens densitet är 2 400 kg/m³. Beräkna massan i ton, hur många betongbilar som behövs om varje bil tar {cap} ton, och tyngden i kN (g = 9,82 m/s²).',
                [ans('Massa', 'ton', 'm/1000', 2), ans('Bilar', 'st', 'bilar', 0, exact=True), ans('Tyngd', 'kN', 'G', 0)],
                calc('V = {=l:1} \\cdot {=b:1} \\cdot {=t:2} = {=V:3}\\enh{m^3}', 'm = 2400 \\cdot {=V:3} = {=m:0}\\enh{kg} = {=m/1000:2}\\enh{ton}',
                     f'T:{{=m/1000:2}} / {cap} = {{=m/{cap * 1000}:2}} → {{=bilar}} bilar (uppåt)', 'G = m \\cdot g = {=m:0} \\cdot 9{,}82 = {=m*9.82:0}\\enh{N} \\approx {=G:0}\\enh{kN}'))


def vg_interp_tabell():
    nxt = fam('vg-itab')
    for ctx, unit in [('Hastighetstryck qₚ (kN/m²) vid olika höjder', 'kN/m²'), ('Tillåten last (kN) vid olika spännvidder', 'kN'),
                      ('Vikt (kg) vid olika tjocklekar', 'kg'), ('U-värde vid olika isolertjocklekar', ''), ('Pris (kr) vid olika mängder', 'kr')]:
        for k in range(4):
            dec = 2 if unit in ('kN/m²', '') else 1
            add('VG', nxt(), 'interpolation', 2,
                [val('x1', [2, 4, 5, 10, 20]), r('dx', 'if(x1 < 5, 2, 5)'), r('x2', 'x1 + dx'), r('x3', 'x1 + 2*dx'),
                 v('y1', 1, 9, 2), v('d1', 0.2, 2, 2), v('d2', 0.2, 2, 2), r('y2', 'y1 + d1'), r('y3', 'y2 + d2'),
                 v('x', 'x2 + 0.5', 'x3 - 0.5', 1), c('x > x2 && x < x3 && !isint(x)'), r('svar', 'y2 + (x - x2)/(x3 - x2)*(y3 - y2)')],
                f'Tabell: {ctx}. x = {{=x1}}: {{=y1:2}}, x = {{=x2}}: {{=y2:2}}, x = {{=x3}}: {{=y3:2}}. Bestäm värdet vid x = {{=x:1}} med linjär interpolation (välj rätt intervall).',
                [ans('Värde', unit, 'svar', dec)],
                calc('T:x = {=x:1} ligger mellan {=x2} och {=x3}.', '\\text{andel} = \\frac{{=x:1} - {=x2}}{{=x3} - {=x2}} = {=(x - x2)/(x3 - x2):3}',
                     'y = {=y2:2} + {=(x - x2)/(x3 - x2):3} \\cdot ({=y3:2} - {=y2:2}) \\approx {=svar:' + str(dec) + '}'))


def vg_skala_area():
    nxt = fam('vg-skalarea')
    for obj in ['Ett fönster', 'En dörr', 'Ett rum', 'En fasad', 'Ett garage', 'En altan']:
        for scale in [50, 100, 150, 200]:
            add('VG', nxt(), 'geometri', 2,
                [v('a', 0.6, 8, 1), v('b', 0.6, 8, 1), r('A', f'(a*{scale}/100)*(b*{scale}/100)')],
                f'{obj} mäter {{=a:1}} cm × {{=b:1}} cm på en ritning i skala 1:{scale}. Beräkna den verkliga arean i m².',
                [ans('Area', 'm²', 'A', 2)],
                calc(f'{{=a:1}} \\cdot {scale} = {{=a*{scale}/100:2}}\\enh{{m}},\\quad {{=b:1}} \\cdot {scale} = {{=b*{scale}/100:2}}\\enh{{m}}', 'A = {=A:2}\\enh{m^2}',
                     'T:Obs: arean blir skalan i kvadrat större, inte bara skalan.'))


def vg_potens():
    nxt = fam('vg-pot')
    for obj in ['En kubisk vattentank', 'Ett kubiskt fundament', 'En kubisk container', 'En kubisk betongkloss', 'Ett kubiskt rum', 'En kubisk låda']:
        for k in range(4):
            add('VG', nxt(), 'algebra', 2,
                [v('s', 0.5, 4, 2), r('V', 's^3'), r('V', 'round(V, 3)'), r('svar', 'V^(1/3)'), r('A', '6*svar^2')],
                f'{obj} har volymen {{=V:3}} m³. Bestäm kantlängden genom att lösa x³ = {{=V:3}} och beräkna sedan den totala ytterarean (6 sidor).',
                [ans('Kant', 'm', 'svar', 2), ans('Area', 'm²', 'A', 1)],
                calc('x = {=V:3}^{1/3} \\approx {=svar:2}\\enh{m}', 'A = 6 \\cdot {=svar:2}^2 \\approx {=A:1}\\enh{m^2}'))


def g_moms():
    nxt = fam('g-moms')
    items = ['en borrmaskin', 'ett paket skruv', 'en stege', 'en laseravståndsmätare', 'en cirkelsåg', 'ett vattenpass',
             'en arbetsbänk', 'en skyddshjälm', 'ett par skyddsskor', 'en spikpistol', 'en slagborr', 'en ficklampa']
    for it in items:
        add('G', nxt(), 'ekonomi', 1,
            [v('P', 80, 4800, 0, 20), r('svar', 'P*1.25')],
            f'Priset för {it} är {{=P}} kr exklusive moms. Momsen är 25 %. Vad kostar den inklusive moms?',
            [ans('Pris inkl. moms', 'kr', 'svar', 0)],
            calc('T:Förändringsfaktor 1,25', '{=P} \\cdot 1{,}25 = {=svar:0}\\enh{kr}'))
        add('G', nxt(), 'ekonomi', 2,
            [v('P', 80, 4800, 0, 20), r('I', 'P*1.25'), r('svar', 'I/1.25')],
            f'Priset för {it} är {{=I}} kr inklusive 25 % moms. Vad är priset exklusive moms?',
            [ans('Pris exkl. moms', 'kr', 'svar', 0, fel=[('I*0.75', 'Att dra av 25 % blir fel. Momsen är 25 % av priset utan moms, så dela med 1,25.')])],
            calc('T:Dela med förändringsfaktorn (inte minus 25 %).', '{=I} / 1{,}25 = {=svar:0}\\enh{kr}'))


def g_hastighet():
    nxt = fam('g-fart')
    ctxs = [('En lastbil', 'kör'), ('En betongbil', 'kör'), ('En grävmaskin på trailer', 'transporteras'), ('En leverans', 'körs'),
            ('En arbetsbuss', 'kör'), ('En mobilkran', 'kör')]
    for who, verb in ctxs:
        add('G', nxt(), 'enheter', 1,
            [v('vh', 30, 90, 0, 5), val('t', [0.5, 1.5, 2, 2.5, 0.75, 1.25]), r('svar', 'vh*t')],
            f'{who} {verb} med medelhastigheten {{=vh}} km/h i {{=t:2}} timmar. Hur lång sträcka är det?',
            [ans('Sträcka', 'km', 'svar', 1)],
            calc('s = v \\cdot t', 's = {=vh} \\cdot {=t:2} = {=svar:1}\\enh{km}'))
        add('G', nxt(), 'enheter', 1,
            [v('vh', 30, 90, 0, 10), v('t', 0.5, 3, 1, 0.5), r('s', 'vh*t'), r('svar', 's/vh*60')],
            f'{who} {verb} {{=s:1}} km med medelhastigheten {{=vh}} km/h. Hur många minuter tar det?',
            [ans('Tid', 'min', 'svar', 0)],
            calc('t = s / v = {=s:1} / {=vh} = {=s/vh:2}\\enh{h}', '{=s/vh:2} \\cdot 60 = {=svar}\\enh{min}'))
        add('G', nxt(), 'enheter', 1,
            [v('vh', 18, 108, 0, 18), r('svar', 'vh/3.6')],
            f'{who} {verb} med hastigheten {{=vh}} km/h. Vad är hastigheten i m/s?',
            [ans('Hastighet', 'm/s', 'svar', 1)],
            calc('T:km/h → m/s: dela med 3,6', '{=vh} / 3{,}6 = {=svar:1}\\enh{m/s}'))


def g_jamforpris():
    nxt = fam('g-jmf')
    prods = [('skruv', 'st', 'förpackning'), ('lim', 'liter', 'hink'), ('fog', 'kg', 'säck'), ('kakel', 'm²', 'kartong'),
             ('virke', 'm', 'bunt'), ('cement', 'kg', 'säck'), ('färg', 'liter', 'burk'), ('spackel', 'liter', 'hink')]
    for prod, unit, pack in prods:
        for phr in ['Vilket är jämförpriset i kr/{u}?', 'Vad kostar det per {u}?']:
            add('G', nxt(), 'ekonomi', 1,
                [v('n', 2, 25, 0), v('pr', 4, 60, 1, 0.5), r('P', 'n*pr'), r('svar', 'P/n')],
                f'En {pack} med {{=n}} {unit} {prod} kostar {{=P:1}} kr. ' + phr.format(u=unit),
                [ans('Jämförpris', 'kr/' + unit, 'svar', 2)],
                calc('\\text{pris} / \\text{mängd} = {=P:1} / {=n}', '= {=svar:2}\\enh{kr/' + unit + '}'))


def g_areaenhet():
    nxt = fam('g-arenh')
    rows = [('m²', 'dm²', 100, 0.5, 40, 1), ('m²', 'cm²', 10000, 0.2, 6, 2), ('dm²', 'cm²', 100, 2, 90, 0),
            ('cm²', 'm²', 0.0001, 500, 90000, 0), ('m³', 'liter', 1000, 0.2, 9, 2), ('liter', 'm³', 0.001, 50, 4000, 0),
            ('dm³', 'liter', 1, 3, 400, 0), ('m³', 'dm³', 1000, 0.1, 6, 2)]
    for a, b, f, lo, hi, dec in rows:
        rdec = max(0, dec - {100: 2, 10000: 4, 1000: 3, 1: 0}.get(f, 0)) if f >= 1 else 4 + dec
        for phr in ['Skriv {x} {a} i {b}.', 'Hur många {b} är {x} {a}?', 'Omvandla {x} {a} till {b}.']:
            add('G', nxt(), 'enheter', 1,
                [v('x', lo, hi, dec), r('svar', f'x*{f}')],
                phr.format(x='{=x:%d}' % dec, a=a, b=b),
                [ans('Svar', b, 'svar', min(rdec, 6))],
                calc(f'T:1 {a} = {str(f).replace(".", ",")} {b}', '{=x:%d} \\cdot %s = {=svar:%d}' % (dec, str(f).replace('.', '{,}'), min(rdec, 6))))


# ============================================================================
# NYA FRÅGETYPER (diagram, grafer, tiopotenser, proportionalitet m.m.)
# ============================================================================

MANADER = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun']


def stapel(titel, x_label, y_label, labels, listvar, factor=1):
    """Stapeldiagram som underlag. Värdena hämtas ur listan (item(L, i))."""
    vals = ';'.join(f'{{=item({listvar}, {i + 1})*{factor}}}' for i in range(len(labels)))
    return (f'<diagram typ="stapel" visavarden="ja" titel={quoteattr(titel)} x={quoteattr(x_label)} y={quoteattr(y_label)} '
            f'etiketter={quoteattr(";".join(labels))} varden="{vals}"/>')


def g_diagram():
    nxt = fam('g-diagram')
    ctxs = [('Levererade fönster per månad', 'Månad', 'Antal', 'st', MANADER, 20, 90, 1),
            ('Sålda m³ betong per vecka', 'Vecka', 'm³', 'm³', ['v.1', 'v.2', 'v.3', 'v.4', 'v.5'], 30, 120, 1),
            ('Sjukdagar per kvartal', 'Kvartal', 'Dagar', 'dagar', ['Kv1', 'Kv2', 'Kv3', 'Kv4'], 5, 40, 1),
            ('Elförbrukning per månad', 'Månad', 'kWh', 'kWh', MANADER, 30, 90, 10),
            ('Antal byggstarter per år', 'År', 'Antal', 'st', ['2021', '2022', '2023', '2024', '2025'], 40, 140, 1),
            ('Arbetade timmar per dag', 'Dag', 'Timmar', 'h', ['Mån', 'Tis', 'Ons', 'Tor', 'Fre'], 4, 11, 1)]
    for titel, xl, yl, unit, labels, lo, hi, f in ctxs:
        n = len(labels)
        base = [lista('L', n, lo, hi), r('S', f'sum(L)*{f}')]
        dia = stapel(titel, xl, yl, labels, 'L', f)
        for phr in [0, 1]:
            add('G', nxt(), 'statistik', 1, base + [r('svar', 'S')],
                ['Diagrammet visar {t}. Hur stort är det totala värdet för alla staplar?', 'Läs av diagrammet ({t}) och beräkna summan.'][phr].format(t=titel.lower()),
                [ans('Totalt', unit, 'svar', 0, exact=True, fel=[(f'S - item(L, {n})*{f}', 'Du har missat en stapel. Räkna med alla.')])],
                calc('T:Lägg ihop alla staplarnas värden.', '= {=svar}' + f'\\enh{{{unit}}}'), underlag=dia)
            add('G', nxt(), 'statistik', 1, base + [r('svar', f'S/{n}')],
                ['Diagrammet visar {t}. Beräkna medelvärdet per stapel.', 'Vilket är medelvärdet i diagrammet ({t})?'][phr].format(t=titel.lower()),
                [ans('Medelvärde', unit, 'svar', 1, fel=[(f'median(L)*{f}', 'Det är medianen. Medelvärdet är summan delad med antalet.')])],
                calc('\\bar{x} = \\frac{{=S}}{' + str(n) + '}', '\\approx {=svar:1}' + f'\\enh{{{unit}}}'), underlag=dia)
            add('G', nxt(), 'statistik', 2, base + [r('a', f'item(L, 2)*{f}'), r('b', f'item(L, 3)*{f}'), c('a != b'), r('svar', '(b - a)/a*100')],
                ['Diagrammet visar {t}. Hur stor är den procentuella förändringen från {l1} till {l2}? (Minskning skrivs med minus.)',
                 'Beräkna förändringen i procent mellan {l1} och {l2} i diagrammet ({t}). Svara med minus om det är en minskning.'][phr].format(t=titel.lower(), l1=labels[1], l2=labels[2]),
                [ans('Förändring', '%', 'svar', 1, fel=[('(b - a)/b*100', 'Du har delat med det nya värdet. Jämför alltid med det gamla.'), ('b - a', 'Det är skillnaden i ' + unit + '. Dela med det gamla värdet och gånger 100 för procent.')])],
                calc('\\frac{{=b} - {=a}}{{=a}} = {=(b-a)/a:4}', '\\approx {=svar:1}\\,\\%'), underlag=dia)
            add('G', nxt(), 'statistik', 1, base + [r('svar', f'range(L)*{f}')],
                ['Diagrammet visar {t}. Hur stor är variationsbredden?', 'Bestäm skillnaden mellan högsta och lägsta stapeln ({t}).'][phr].format(t=titel.lower()),
                [ans('Variationsbredd', unit, 'svar', 0, exact=True)],
                calc('\\text{störst} - \\text{minst} = {=max(L)*' + str(f) + '} - {=min(L)*' + str(f) + '}', '= {=svar}' + f'\\enh{{{unit}}}'), underlag=dia)


def g_graf():
    nxt = fam('g-graf')
    dia = '<diagram typ="funktion" uttryck="{=k}*x + ({=m})" xmin="-5" xmax="5" ymin="-10" ymax="10" x="x" y="y"/>'
    intro = ['Grafen visar en rät linje y = kx + m.', 'I koordinatsystemet syns grafen till en linjär funktion.', 'Figuren visar en rät linje.',
             'En linjär funktion är ritad i koordinatsystemet.', 'Studera grafen nedan.', 'Grafen visar y = kx + m.']
    for text in intro:
        base = [val('k', [-3, -2, -1, 1, 2, 3]), v('m', -4, 4)]
        add('G', nxt(), 'linjara-funktioner', 1, base + [c('m != 0'), r('svar', 'm')], f'{text} Läs av m (där linjen skär y-axeln).',
            [ans('m', '', 'svar', 0, exact=True)], calc('T:Linjen skär y-axeln i y = {=m}, alltså m = {=m}.'), underlag=dia)
        add('G', nxt(), 'linjara-funktioner', 1, base + [r('svar', 'k')], f'{text} Bestäm lutningen k.',
            [ans('k', '', 'svar', 0, exact=True, fel=[('-k', 'Fel tecken. Sjunker linjen åt höger är k negativ.'), ('1/k', 'Du har vänt på kvoten. k = Δy / Δx (uppåt delat med åt höger).')])],
            calc('T:Gå 1 steg åt höger: linjen ändras {=k} steg i y-led.', 'k = \\frac{\\Delta y}{\\Delta x} = {=k}'), underlag=dia)
        add('G', nxt(), 'linjara-funktioner', 1, base + [v('a', -3, 3), c('a != 0 && abs(k*a + m) <= 10'), r('svar', 'k*a + m')],
            f'{text} Vilket värde har y när x = {{=a}}?', [ans('y', '', 'svar', 0, exact=True)],
            calc('y = {=k} \\cdot {=a:p} + {=m:p}', '= {=svar}'), underlag=dia)
        add('G', nxt(), 'linjara-funktioner', 2, base + [c('isint(-m/k) && m != 0 && abs(m/k) <= 5'), r('svar', '-m/k')],
            f'{text} Bestäm k och m och beräkna sedan var linjen skär x-axeln.', [ans('x', '', 'svar', 0, exact=True, fel=[('m/k', 'Fel tecken. y = 0 ger kx = −m, alltså x = −m/k.')])],
            calc('T:Avläsning: k = {=k}, m = {=m}', '0 = {=k}x {=m:s} \\Rightarrow x = \\frac{-({=m})}{{=k}}', 'x = {=svar}'), underlag=dia)


def g_grundpotens():
    nxt = fam('g-tiopot')
    for phr in ['Skriv \\({=a:1} \\cdot 10^{{=e}}\\) som ett vanligt tal.', 'Vilket tal är \\({=a:1} \\cdot 10^{{=e}}\\)?', 'Skriv utan tiopotens: \\({=a:1} \\cdot 10^{{=e}}\\).']:
        add('G', nxt(), 'algebra', 1, [v('a', 1.1, 9.9, 1), v('e', 2, 6), r('svar', 'a*10^e')], phr,
            [ans('Tal', '', 'svar', 0)], calc('T:Flytta decimaltecknet {=e} steg åt höger.', '{=a:1} \\cdot 10^{{=e}} = {=svar:0}'))
        add('G', nxt(), 'algebra', 1, [v('a', 1.1, 9.9, 1), v('e', -4, -1), r('svar', 'a*10^e')], phr,
            [ans('Tal', '', 'svar', 6)], calc('T:Negativ exponent: flytta decimaltecknet åt vänster.', '{=a:1} \\cdot 10^{{=e}} = {=svar:6}'))
    for phr in ['Skriv {=X} i grundpotensform a · 10ⁿ. Vilket värde har n?', 'Talet {=X} skrivs i grundpotensform. Vilken exponent får tiopotensen?',
                'Vilken exponent n gäller när {=X} skrivs som a · 10ⁿ (1 ≤ a < 10)?']:
        add('G', nxt(), 'algebra', 1, [v('a', 1.1, 9.9, 1), v('e', 3, 7), r('X', 'a*10^e')], phr,
            [ans('n', '', 'e', 0, exact=True, fel=[('e + 1', 'a måste ligga mellan 1 och 10. Räkna stegen igen.'), ('e - 1', 'a måste ligga mellan 1 och 10. Räkna stegen igen.')])],
            calc('{=X} = {=a:1} \\cdot 10^{{=e}}', 'n = {=e}'))
    prefix = [('km', 'm', 1000, 0.2, 9.5, 1), ('mm', 'm', 0.001, 120, 9500, 0), ('kN', 'N', 1000, 0.5, 60, 1), ('g', 'kg', 0.001, 150, 9000, 0),
              ('MPa', 'kPa', 1000, 0.2, 30, 1), ('ton', 'kg', 1000, 0.3, 25, 1), ('cm', 'mm', 10, 2, 900, 1), ('dl', 'liter', 0.1, 3, 80, 0)]
    for a, b, f, lo, hi, dec in prefix:
        rd = max(0, dec - {1000: 3, 10: 1}.get(f, 0)) if f >= 1 else dec + 3
        for phr in ['Omvandla {x} {a} till {b}.', 'Hur många {b} är {x} {a}?']:
            add('G', nxt(), 'enheter', 1, [v('x', lo, hi, dec), r('svar', f'x*{f}')], phr.format(x='{=x:%d}' % dec, a=a, b=b),
                [ans('Svar', b, 'svar', min(rd, 4))],
                calc(f'T:1 {a} = {str(f).replace(".", ",")} {b}', '{=x:%d} \\cdot %s = {=svar:%d}' % (dec, str(f).replace('.', '{,}'), min(rd, 4))))


def g_proportionalitet():
    nxt = fam('g-prop')
    direkt = [('{=a} m³ betong kostar {=P} kr. Vad kostar {=b} m³ till samma pris per m³?', 'kr', [v('per', 900, 1600, 0, 10)], 0),
              ('{=a} m kabel väger {=P:1} kg. Hur mycket väger {=b} m av samma kabel?', 'kg', [v('per', 0.2, 1.8, 1)], 1),
              ('En maskin borrar {=P} hål på {=a} timmar. Hur många hål hinner den på {=b} timmar?', 'st', [v('per', 8, 40)], 0),
              ('{=a} säckar fix räcker till {=P:1} m² kakel. Hur många m² räcker {=b} säckar till?', 'm²', [v('per', 2, 6, 1)], 1),
              ('På {=a} liter diesel kör en dumper {=P} minuter. Hur länge går den på {=b} liter?', 'min', [v('per', 6, 20)], 0)]
    for text, unit, per, dec in direkt:
        for k in range(3):
            add('G', nxt(), 'algebra', 1, [v('a', 2, 9)] + per + [r('P', 'a*per'), v('b', 2, 15), c('a != b'), r('svar', 'P/a*b')], text,
                [ans('Svar', unit, 'svar', dec, fel=[('P*a/b', 'Du har räknat omvänt. Mer av det ena ger mer av det andra: direkt proportionalitet.')])],
                calc('T:Räkna ut värdet för 1 enhet först.', '{=P:%d} / {=a} = {=per:%d}' % (dec, dec), '{=per:%d} \\cdot {=b} = {=svar:%d}' % (dec, dec) + f'\\enh{{{unit}}}'))
    omvand = [('{=n1} snickare bygger ett förråd på {=d1} dagar. Hur många dagar tar det för {=n2} lika snabba snickare?', 'dagar'),
              ('Med {=n1} lastbilar tar en schaktning {=d1} timmar. Hur lång tid tar den med {=n2} lastbilar?', 'h'),
              ('{=n1} målare målar ett hus på {=d1} dagar. Hur lång tid tar det för {=n2} målare?', 'dagar'),
              ('{=n1} pumpar tömmer en grop på {=d1} minuter. Hur lång tid tar det med {=n2} pumpar?', 'min')]
    for text, unit in omvand:
        for k in range(3):
            add('G', nxt(), 'algebra', 2, [v('n1', 2, 8), v('d1', 3, 24), v('n2', 2, 10), c('n1 != n2 && isint(n1*d1/n2*2)'), r('svar', 'n1*d1/n2')], text,
                [ans('Tid', unit, 'svar', 1, fel=[('d1*n2/n1', 'Du har räknat med direkt proportionalitet. Fler arbetar = kortare tid: n₁ · t₁ = n₂ · t₂.')])],
                calc('T:Omvänd proportionalitet: hela arbetet = antal · tid är detsamma.', '{=n1} \\cdot {=d1} = {=n1*d1}', 't = {=n1*d1} / {=n2} = {=svar:1}' + f'\\enh{{{unit}}}'))


def g_cylinder():
    nxt = fam('g-cyl')
    objs = ['En rund betongpelare', 'En cylindrisk vattentank', 'Ett rör (inre mått)', 'En borrad grundpåle', 'En rund plintform', 'En cylindrisk silo']
    for obj in objs:
        for given in ['diametern', 'radien']:
            for unit_in in ['cm', 'm']:
                if unit_in == 'cm':
                    parts = [v('d', 20, 80, 0, 5), r('r', 'd/2/100'), v('h', 1, 6, 1), r('svar', 'pi*r^2*h')]
                    shown = '{=d} cm' if given == 'diametern' else '{=d/2:1} cm'
                    conv = 'T:Gör om till meter: r = {=r:3} m'
                else:
                    parts = [v('d', 1, 6, 1), r('r', 'd/2'), v('h', 1, 8, 1), r('svar', 'pi*r^2*h')]
                    shown = '{=d:1} m' if given == 'diametern' else '{=r:2} m'
                    conv = 'T:Radien är {=r:2} m'
                add('G', nxt(), 'geometri', 2, parts, f'{obj} har {given} {shown} och höjden {{=h:1}} m. Beräkna volymen i m³.',
                    [ans('Volym', 'm³', 'svar', 3, fel=[('2*pi*r*h', 'Det är mantelarean. Volym = basytan πr² gånger höjden.'), ('pi*r^2', 'Det är bara basytan. Multiplicera med höjden.')])],
                    calc(conv, 'V = \\pi r^2 h = \\pi \\cdot {=r:3}^2 \\cdot {=h:1}', 'V \\approx {=svar:3}\\enh{m^3}'))


def g_trapets():
    nxt = fam('g-trap')
    objs = ['En gavelvägg har formen av ett trapets', 'En tomt har formen av ett trapets', 'En takyta har formen av ett trapets',
            'En slänt har formen av ett trapets', 'En fasadskiva är trapetsformad', 'En ramp har trapetsformad sida']
    for obj in objs:
        for k in range(3):
            add('G', nxt(), 'geometri', 1, [v('a', 2, 12, 1), v('b', 'a + 1', 'a + 10', 1), v('h', 1.5, 8, 1), r('svar', '(a + b)/2*h')],
                f'{obj} med de parallella sidorna {{=a:1}} m och {{=b:1}} m och höjden {{=h:1}} m. Beräkna arean.',
                [ans('Area', 'm²', 'svar', 2)], calc('A = \\frac{(a + b) \\cdot h}{2} = \\frac{({=a:1} + {=b:1}) \\cdot {=h:1}}{2}', 'A = {=svar:2}\\enh{m^2}'))


def g_lform_area():
    nxt = fam('g-larea')
    objs = ['Ett L-format vardagsrum', 'En L-formad altan', 'Ett L-format kontor', 'En L-formad grundplatta', 'Ett L-format garage', 'En L-formad tomt']
    for obj in objs:
        for k in range(3):
            add('G', nxt(), 'geometri', 2, [v('L', 6, 14, 1), v('B', 4, 10, 1), v('l', 1.5, 'L*0.6', 1), v('b', 1.5, 'B*0.6', 1), r('svar', 'L*B - l*b')],
                f'{obj} får plats i en rektangel på {{=L:1}} × {{=B:1}} m, men ett hörn på {{=l:1}} × {{=b:1}} m saknas. Beräkna arean.',
                [ans('Area', 'm²', 'svar', 2, fel=[('L*B', 'Du har glömt att dra bort hörnet som saknas.'), ('L*B + l*b', 'Hörnet saknas, så det ska dras bort, inte läggas till.')])],
                calc('A = {=L:1} \\cdot {=B:1} - {=l:1} \\cdot {=b:1}', 'A = {=L*B:2} - {=l*b:2} = {=svar:2}\\enh{m^2}'))


def g_procentenheter():
    nxt = fam('g-penh')
    ctxs = ['Räntan på ett bolån', 'Arbetslösheten i byggbranschen', 'Andelen elbilar i firmans bilpark', 'Fukthalten i ett virkesparti',
            'Andelen kunder som väljer ROT-avdrag', 'Vakansgraden i ett bostadsområde']
    for ctx in ctxs:
        for direction in ['steg', 'sjönk']:
            parts = [v('p1', 1.5, 9, 1), (v('p2', 'p1 + 0.5', 'p1 + 4', 1) if direction == 'steg' else v('p2', 1, 'p1 - 0.5', 1)), c('p1 != p2')]
            word = 'ökning' if direction == 'steg' else 'minskning'
            add('G', nxt(), 'procent', 1, parts + [r('svar', 'abs(p2 - p1)')],
                f'{ctx} {direction} från {{=p1:1}} % till {{=p2:1}} %. Hur många procentenheter är {word}en?',
                [ans('Procentenheter', 'p.e.', 'svar', 1, fel=[('abs(p2 - p1)/p1*100', 'Det är förändringen i procent. Procentenheter är bara skillnaden mellan procenttalen.')])],
                calc('T:Procentenheter = skillnaden mellan procenttalen.', '|{=p2:1} - {=p1:1}| = {=svar:1} \\text{ procentenheter}'))
            add('G', nxt(), 'procent', 2, parts + [r('svar', 'abs(p2 - p1)/p1*100')],
                f'{ctx} {direction} från {{=p1:1}} % till {{=p2:1}} %. Hur många procent är {word}en?',
                [ans(word.capitalize(), '%', 'svar', 1, fel=[('abs(p2 - p1)', 'Det är förändringen i procentenheter. I procent jämför du med det gamla värdet: skillnad / gammalt.')])],
                calc('\\frac{|{=p2:1} - {=p1:1}|}{{=p1:1}} = {=abs(p2-p1)/p1:4}', '\\approx {=svar:1}\\,\\%'))


def g_vinkelsumma():
    nxt = fam('g-vsum')
    for ctx in ['En triangel', 'En triangulär gavel', 'En takstol (triangel)', 'En triangulär tomt', 'Ett triangulärt stag']:
        for k in range(2):
            add('G', nxt(), 'geometri', 1, [v('A', 20, 100), v('B', 20, '150 - A'), r('svar', '180 - A - B')],
                f'{ctx} har två vinklar som är {{=A}}° och {{=B}}°. Hur stor är den tredje vinkeln?',
                [ans('Vinkel', '°', 'svar', 0, exact=True, fel=[('360 - A - B', 'Vinkelsumman i en triangel är 180°, inte 360°.')])],
                calc('T:Vinkelsumman i en triangel är 180°.', '180^\\circ - {=A}^\\circ - {=B}^\\circ = {=svar}^\\circ'))
            add('G', nxt(), 'geometri', 2, [v('T', 30, 140, 0, 2), r('svar', '(180 - T)/2')],
                f'{ctx} är likbent och toppvinkeln är {{=T}}°. Hur stora är basvinklarna?',
                [ans('Basvinkel', '°', 'svar', 1, fel=[('180 - T', 'Det är summan av båda basvinklarna. Dela med 2.')])],
                calc('T:Basvinklarna är lika stora.', '\\frac{180^\\circ - {=T}^\\circ}{2} = {=svar:1}^\\circ'))


def g_ekvation2():
    nxt = fam('g-ekv2')
    for phr in ['Lös ekvationen', 'Bestäm x så att', 'Lös ut x:', 'Lös ekvationen och kontrollera ditt svar:', 'Vilket värde på x uppfyller']:
        add('G', nxt(), 'algebra', 2, [v('a', 3, 9), v('c', 1, 'a - 1'), v('x', -6, 9), v('b', -20, 20), r('d', '(a - c)*x + b'), c('x != 0 && b != 0 && d != 0')],
            f'{phr} {{=a}}x {{=b:s}} = {{=c}}x {{=d:s}}',
            [ans('x', '', 'x', 0, exact=True, fel=[('(d - b)/(a + c)', 'Byt tecken när en term flyttas över likhetstecknet: ax − cx = d − b.'), ('(d + b)/(a - c)', 'Byt tecken när en term flyttas över likhetstecknet.')])],
            calc('{=a}x - {=c}x = {=d} - {=b:p}', '{=a-c}x = {=d-b}', 'x = {=x}'))
        add('G', nxt(), 'algebra', 2, [v('a', 2, 9), v('b', -6, 8), v('x', -5, 9), c('b != 0 && x + b != 0'), r('cc', 'a*(x + b)')],
            f'{phr} {{=a}}(x {{=b:s}}) = {{=cc}}',
            [ans('x', '', 'x', 0, exact=True, fel=[('cc/a + b', 'Fel tecken. x + b = c/a ger x = c/a − b.'), ('(cc - b)/a', 'Multiplicera in a i hela parentesen: a·x + a·b.')])],
            calc('x {=b:s} = \\frac{{=cc}}{{=a}} = {=cc/a}', 'x = {=x}'))
        add('G', nxt(), 'algebra', 1, [v('a', 2, 9), v('x', 2, 12), v('b', 1, 30), r('cc', 'a*x - b')],
            f'{phr} {{=a}}x − {{=b}} = {{=cc}}', [ans('x', '', 'x', 0, exact=True)],
            calc('{=a}x = {=cc} + {=b} = {=cc+b}', 'x = {=x}'))
        add('G', nxt(), 'algebra', 1, [v('a', 2, 6), v('x', 2, 30), v('b', 1, 20), c('isint(x/a)'), r('cc', 'x/a + b')],
            f'{phr} x/{{=a}} + {{=b}} = {{=cc}}', [ans('x', '', 'x', 0, exact=True, fel=[('(cc - b)/a', 'Du har delat. För att få bort "delat med a" multiplicerar du med a.')])],
            calc('\\frac{x}{{=a}} = {=cc} - {=b} = {=cc-b}', 'x = {=cc-b} \\cdot {=a} = {=x}'))


DENSITET = [('betong', 2400), ('trä', 500), ('stål', 7850), ('tegel', 1800), ('glas', 2500), ('aluminium', 2700)]


def g_densitet():
    nxt = fam('g-dens')
    for mat, rho in DENSITET:
        for k in range(2):
            add('G', nxt(), 'mekanik', 1, [v('V', 0.05, 3, 2), r('svar', f'V*{rho}')],
                f'En del av {mat} har volymen {{=V:2}} m³. Densiteten är {rho} kg/m³. Beräkna massan i kg.',
                [ans('Massa', 'kg', 'svar', 0, fel=[(f'V/{rho}', 'Du har delat. Massa = densitet · volym.')])],
                calc('m = \\rho \\cdot V = ' + str(rho) + ' \\cdot {=V:2}', 'm = {=svar:0}\\enh{kg}'))
            add('G', nxt(), 'mekanik', 2, [v('m', 50, 4000, 0, 10), r('svar', f'm/{rho}')],
                f'Ett föremål av {mat} väger {{=m}} kg. Densiteten är {rho} kg/m³. Hur stor är volymen?',
                [ans('Volym', 'm³', 'svar', 3, fel=[(f'm*{rho}', 'Du har multiplicerat. V = m / ρ.')])],
                calc('V = \\frac{m}{\\rho} = \\frac{{=m}}{' + str(rho) + '}', 'V \\approx {=svar:3}\\enh{m^3}'))


def g_k_tva_punkter():
    nxt = fam('g-kpunkt')
    ctxs = [('Linjen går genom punkterna ({=x1}, {=y1}) och ({=x2}, {=y2}).', ''),
            ('En hyra kostar {=y1} kr för {=x1} dagar och {=y2} kr för {=x2} dagar (linjärt).', 'kr/dag'),
            ('En tank innehåller {=y1} liter efter {=x1} min och {=y2} liter efter {=x2} min (linjärt).', 'liter/min'),
            ('En transport kostar {=y1} kr för {=x1} km och {=y2} kr för {=x2} km (linjärt).', 'kr/km'),
            ('En betongbil levererar: {=x1} m³ kostar {=y1} kr och {=x2} m³ kostar {=y2} kr (linjärt).', 'kr/m³'),
            ('Temperaturen i en härdande platta är {=y1} °C efter {=x1} h och {=y2} °C efter {=x2} h (linjärt).', '°C/h')]
    for text, unit in ctxs:
        big = unit in ('kr/dag', 'kr/km', 'kr/m³')
        parts = ([v('x1', 1, 8), v('dx', 2, 9), r('x2', 'x1 + dx'), v('k', 50, 400, 0, 10), v('m', 100, 2000, 0, 50)] if big else
                 [v('x1', -4, 4), v('dx', 1, 6), r('x2', 'x1 + dx'), val('k', [-4, -3, -2, -1, 1, 2, 3, 4, 5]), v('m', -8, 8)])
        parts += [r('y1', 'k*x1 + m'), r('y2', 'k*x2 + m')]
        for kind in ['k', 'm']:
            add('G', nxt(), 'linjara-funktioner', 1 if kind == 'k' else 2, parts,
                text + (' Bestäm lutningen k.' if kind == 'k' else ' Bestäm k och m. Svara med m.'),
                [ans('k', unit, 'k', 1, fel=[('(x2 - x1)/(y2 - y1)', 'Du har vänt på kvoten. k = Δy / Δx.')])] if kind == 'k' else [ans('m', unit.split('/')[0] if unit else '', 'm', 1)],
                calc('k = \\frac{y_2 - y_1}{x_2 - x_1} = \\frac{{=y2} - {=y1:p}}{{=x2} - {=x1:p}} = {=k}',
                     *(['m = y_1 - k x_1 = {=y1} - {=k} \\cdot {=x1:p} = {=m}'] if kind == 'm' else ['T:k = {=k}'])))


def vg_ekvationssystem():
    nxt = fam('vg-ekvsys')
    ctxs = [('fönster', 'dörrar'), ('pallar tegel', 'säckar cement'), ('timmar snickare', 'timmar elektriker'),
            ('m³ betong', 'ton armering'), ('takstolar', 'balkar'), ('meter list', 'meter rör')]
    for a, b in ctxs:
        for k in range(4):
            add('VG', nxt(), 'linjara-funktioner', 3,
                [v('pA', 3, 60, 0), r('pA', 'pA*10'), v('pB', 2, 40, 0), r('pB', 'pB*10'), v('a1', 1, 6), v('b1', 1, 6), v('a2', 1, 6), v('b2', 1, 6),
                 c('a1*b2 - a2*b1 != 0 && pA != pB'), r('S1', 'a1*pA + b1*pB'), r('S2', 'a2*pA + b2*pB')],
                f'{{=a1}} {a} och {{=b1}} {b} kostar {{=S1}} kr. {{=a2}} {a} och {{=b2}} {b} kostar {{=S2}} kr. Ställ upp ett ekvationssystem och bestäm priset per enhet för båda.',
                [ans(f'Pris {a}', 'kr', 'pA', 0), ans(f'Pris {b}', 'kr', 'pB', 0)],
                calc('{=a1}x + {=b1}y = {=S1}', '{=a2}x + {=b2}y = {=S2}',
                     'T:Lös t.ex. med additionsmetoden: multiplicera så att y-termerna tar ut varandra.',
                     '({=a1*b2} - {=a2*b1})x = {=S1*b2} - {=S2*b1} \\Rightarrow x = {=pA}',
                     'y = \\frac{{=S1} - {=a1} \\cdot {=pA}}{{=b1}} = {=pB}'))


def vg_diagram_utveckling():
    nxt = fam('vg-diautv')
    ctxs = [('Hyresintäkt per år (tkr)', 'tkr', 200, 900), ('Antal sålda villor per år', 'st', 40, 200), ('Byggkostnad per m² (kr)', 'kr', 18000, 30000),
            ('Elpris per år (öre/kWh)', 'öre', 60, 180), ('Antal anställda per år', 'st', 20, 90), ('Omsättning per år (Mkr)', 'Mkr', 10, 60)]
    years = ['2021', '2022', '2023', '2024', '2025']
    for titel, unit, lo, hi in ctxs:
        for k in range(4):
            parts = [v('P0', lo, hi, 0), val('p', [-8, -6, -4, 3, 4, 5, 6, 8, 10, 12])]
            parts += [r(f'Y{i}', f'round(P0*(1 + p/100)^{i})') for i in range(5)]
            parts += [r('tot', '(Y4 - Y0)/Y0*100'), r('snitt', '((Y4/Y0)^(1/4) - 1)*100')]
            dia = (f'<diagram typ="linje" visavarden="ja" titel={quoteattr(titel)} x="År" y={quoteattr(unit)} etiketter="{";".join(years)}" '
                   'varden="{=Y0};{=Y1};{=Y2};{=Y3};{=Y4}"/>')
            add('VG', nxt(), 'statistik', 3, parts,
                f'Diagrammet visar {titel.lower()}. Beräkna den totala procentuella förändringen från 2021 till 2025 och den genomsnittliga procentuella förändringen per år.',
                [ans('Total förändring', '%', 'tot', 1, fel=[('(Y4 - Y0)/Y4*100', 'Jämför med startvärdet (2021), inte slutvärdet.')]),
                 ans('Per år', '%', 'snitt', 1, fel=[('tot/4', 'Du har delat den totala förändringen med antalet år. Lös x⁴ = slut/start i stället.'),
                                                       ('tot/5', 'Mellan 2021 och 2025 är det 4 år (4 förändringar), och förändringen sker som ränta-på-ränta.')])],
                calc('\\text{total} = \\frac{{=Y4} - {=Y0}}{{=Y0}} \\approx {=tot:1}\\,\\%', 'T:2021 → 2025 är 4 förändringar.',
                     'x^4 = \\frac{{=Y4}}{{=Y0}} \\Rightarrow x = ({=Y4/Y0:4})^{1/4} \\approx {=1+snitt/100:4}', 'T:Genomsnittlig förändring ≈ {=snitt:1} % per år'),
                underlag=dia)


def vg_konfidens():
    nxt = fam('vg-ki')
    ctxs = [('Betongens tryckhållfasthet mättes på {=n} provkroppar', 'MPa', 25, 45, 1.5, 5),
            ('Leveranstiden mättes för {=n} leveranser', 'dagar', 5, 20, 1, 4),
            ('Fukthalten mättes i {=n} brädor', '%', 12, 20, 0.8, 3),
            ('Arbetstiden mättes för {=n} likadana moment', 'min', 20, 60, 3, 9),
            ('Tjockleken mättes på {=n} gipsskivor', 'mm', 12, 13, 0.1, 0.4),
            ('Vikten mättes på {=n} säckar', 'kg', 24, 26, 0.2, 0.8)]
    for text, unit, mlo, mhi, slo, shi in ctxs:
        dec = 2 if shi < 1 else 1
        for k in range(4):
            add('VG', nxt(), 'statistik', 3,
                [val('n', [16, 25, 36, 49, 64, 100]), v('m', mlo, mhi, dec), v('s', slo, shi, dec + 1 if shi < 1 else 1), r('SE', 's/sqrt(n)'),
                 r('lo', 'm - 1.96*SE'), r('hi', 'm + 1.96*SE')],
                f'{text}. Medelvärdet blev {{=m:{dec}}} {unit} och standardavvikelsen {{=s}} {unit}. Beräkna medelfelet och ett 95 % konfidensintervall för medelvärdet (använd 1,96).',
                [ans('Medelfel', unit, 'SE', 3, fel=[('s/n', 'Medelfelet är s delat med roten ur n.')]),
                 ans('Undre gräns', unit, 'lo', dec + 1, fel=[('m - 1.96*s', 'Du har använt standardavvikelsen. Intervallet byggs med medelfelet s/√n.')]),
                 ans('Övre gräns', unit, 'hi', dec + 1, fel=[('m + 1.96*s', 'Du har använt standardavvikelsen. Intervallet byggs med medelfelet s/√n.')])],
                calc('SE = \\frac{s}{\\sqrt{n}} = \\frac{{=s}}{\\sqrt{{=n}}} \\approx {=SE:3}', '1{,}96 \\cdot {=SE:3} \\approx {=1.96*SE:3}',
                     '{=m:' + str(dec) + '} \\pm {=1.96*SE:3} \\Rightarrow [{=lo:' + str(dec + 1) + '};\\ {=hi:' + str(dec + 1) + '}]' + f'\\enh{{{unit}}}'))


def vg_pelare():
    nxt = fam('vg-pelare')
    for obj in ['En rund betongpelare', 'En gjuten grundpåle', 'En cylindrisk plint', 'En rund stödpelare', 'En betongkolonn', 'En cylindrisk fundamentsdel']:
        for k in range(4):
            add('VG', nxt(), 'mekanik', 3,
                [v('d', 200, 800, 0, 50), v('h', 1.5, 6, 1), val('g', [24, 25]), val('N', [1, 4, 6, 8]), r('r', 'd/2000'), r('V', 'pi*r^2*h*N'), r('G', 'g*V')],
                f'{obj} har diametern {{=d}} mm och höjden {{=h:1}} m. Det ska gjutas {{=N}} st. Betongens tyngdtäthet är {{=g}} kN/m³. Beräkna den totala volymen och tyngden.',
                [ans('Volym', 'm³', 'V', 3, fel=[('pi*(d/1000)^2*h*N', 'Du har använt diametern i stället för radien i πr².'), ('pi*r^2*h', 'Glöm inte att multiplicera med antalet.')]),
                 ans('Tyngd', 'kN', 'G', 1)],
                calc('r = {=d}/2 = {=d/2}\\enh{mm} = {=r:3}\\enh{m}', 'V = {=N} \\cdot \\pi \\cdot {=r:3}^2 \\cdot {=h:1} \\approx {=V:3}\\enh{m^3}',
                     'G = \\gamma V = {=g} \\cdot {=V:3} \\approx {=G:1}\\enh{kN}'))


def vg_vall():
    nxt = fam('vg-vall')
    for obj in ['En jordvall', 'Ett dike', 'En bullervall', 'En vägbank', 'En grusbädd', 'En kanal']:
        for k in range(4):
            add('VG', nxt(), 'geometri', 3,
                [v('a', 1, 4, 1), v('b', 'a + 1', 'a + 6', 1), v('h', 0.5, 3, 1), v('L', 10, 80), val('cap', [8, 10, 12, 15]),
                 r('A', '(a + b)/2*h'), r('V', 'A*L'), r('lass', 'ceil(V/cap)'), c('!isint(V/cap)')],
                f'{obj} har ett trapetsformat tvärsnitt: {{=a:1}} m i överkant, {{=b:1}} m i underkant och {{=h:1}} m djup/hög. Den är {{=L}} m lång. Beräkna volymen och hur många lass det blir om ett lass rymmer {{=cap}} m³.',
                [ans('Volym', 'm³', 'V', 1), ans('Lass', 'st', 'lass', 0, exact=True, fel=[('floor(V/cap)', 'Avrunda uppåt – annars får inte allt plats.')])],
                calc('A = \\frac{({=a:1} + {=b:1}) \\cdot {=h:1}}{2} = {=A:3}\\enh{m^2}', 'V = {=A:3} \\cdot {=L} \\approx {=V:1}\\enh{m^3}',
                     'T:{=V:1} / {=cap} = {=V/cap:2} → {=lass} lass (avrunda uppåt)'))


def vg_ramp():
    nxt = fam('vg-ramp')
    for obj in ['En ramp till en entré', 'En lastramp', 'En cykelramp', 'En rullstolsramp', 'En ramp till ett garage', 'En ramp vid en lastkaj']:
        for k in range(4):
            add('VG', nxt(), 'trigonometri', 3,
                [val('n', [8, 10, 12, 15, 20]), v('h', 0.2, 1.2, 2), r('L', 'h*n'), r('s', 'sqrt(L^2 + h^2)'), r('v', 'atan(1/n)')],
                f'{obj} ska ha lutningen 1:{{=n}} och övervinna höjdskillnaden {{=h:2}} m. Beräkna den horisontella längden, rampens längd längs ytan och lutningsvinkeln.',
                [ans('Horisontell längd', 'm', 'L', 2, fel=[('h/n', 'Lutningen 1:n betyder 1 m höjd på n m längd, så längden = h · n.')]), ans('Ramplängd', 'm', 's', 2),
                 ans('Vinkel', '°', 'v', 1, fel=[('atan(n)', 'Du har vänt på kvoten. tan v = höjd / längd = 1/n.')])],
                calc('L = {=h:2} \\cdot {=n} = {=L:2}\\enh{m}', 's = \\sqrt{{=L:2}^2 + {=h:2}^2} \\approx {=s:2}\\enh{m}',
                     '\\tan v = \\frac{1}{{=n}} \\Rightarrow v \\approx {=v:1}^\\circ'))


def main():
    for f in [g_rakneordning, g_brak, g_brak_av, g_negativa, g_avrundning, g_mm_volym, g_massa_tyngd, g_ton_kn, g_avrunda_upp, g_tid,
              g_procent_ff, g_procent_forandring, g_procent_del, g_ranta, g_index, g_ekvation, g_formel_baklanges, g_potensekvation,
              g_talfoljd, g_uttryck, g_linje_varde, g_linje_x, g_area, g_triangel, g_cirkel, g_volym, g_skala, g_omkrets, g_pythagoras,
              g_trig_sida, g_trig_vinkel, g_lutning, g_vektor, g_medel, g_median, g_typvarde_bredd, g_viktat, g_interpolation, g_tyngd,
              g_ytlast, g_tyngdpunkt, g_moms, g_hastighet, g_jamforpris, g_areaenhet,
              g_diagram, g_graf, g_grundpotens, g_proportionalitet, g_cylinder, g_trapets, g_lform_area, g_procentenheter,
              g_vinkelsumma, g_ekvation2, g_densitet, g_k_tva_punkter,
              vg_flera_procent, vg_snitt_per_ar, vg_ranta_avskr, vg_lan, vg_spill, vg_sammansatt, vg_viktat3, vg_stabilitet, vg_stdav,
              vg_tak, vg_matning, vg_kran, vg_takstol, vg_vektor, vg_komposant, vg_brytpunkt, vg_linjar_modell, vg_olikhet, vg_tprofil,
              vg_lform, vg_balk2, vg_densitet, vg_interp_tabell, vg_skala_area, vg_potens,
              vg_ekvationssystem, vg_diagram_utveckling, vg_konfidens, vg_pelare, vg_vall, vg_ramp]:
        f()
    os.makedirs(OUT, exist_ok=True)
    for level in ['G', 'VG']:
        head = ('<?xml version="1.0" encoding="UTF-8"?>\n'
                f'<!-- Tentamallar på {level}-nivå. Skapade av tools/generera_mallar.py, men kan också redigeras för hand.\n'
                '     Se LÄSMIG.txt (avsnittet om tentamallar) för formatet. -->\n<mallar>\n')
        with open(os.path.join(OUT, f'{level}.xml'), 'w', encoding='utf8') as fh:
            fh.write(head + '\n'.join(TEMPLATES[level]) + '\n</mallar>\n')
        print(level, len(TEMPLATES[level]), 'mallar')


if __name__ == '__main__':
    main()
