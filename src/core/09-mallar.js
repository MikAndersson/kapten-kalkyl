/* ---------- Tentamallar: slumpade tentor ----------
   Mallarna ligger i mallar/G.xml och mallar/VG.xml (med inbyggd kopia i HTML-filen).
   En mall beskriver en uppgift med variabler som slumpas inom gränser:

   <mall id="g-area-01" niva="G" lektion="geometri" poang="1">
     <var namn="l" min="4" max="12" decimaler="1"/>          slumpat tal
     <var namn="b" min="3" max="l - 1" decimaler="1"/>       gränser kan bero på tidigare variabler
     <var namn="mat" typ="val" alternativ="betong|tegel"/>   slumpat ord
     <lista namn="T" antal="6" min="9" max="13"/>            slumpad talserie
     <rakna namn="A">l * b</rakna>                           mellanresultat
     <villkor>A > 10</villkor>                               måste vara sant, annars slumpas om
     <fraga>En platta är {=l} m × {=b} m. Beräkna arean.</fraga>
     <svar etikett="Area" enhet="m²" varde="A" decimaler="1"/>
     <losning><berakning><svar>A = {=l} \cdot {=b} = {=A:1}\enh{m^2}</svar></berakning></losning>
   </mall>

   {=uttryck} skrivs ut med svenskt decimalkomma. {=uttryck:2} ger två decimaler.
   Uttryck: + - * / ^ ( ) < > <= >= == != och funktioner, se FUNKTIONER nedan.
   Vinklar i grader. Generatorn slumpar om tills alla villkor är uppfyllda och
   svaret är ett rimligt tal (högst 400 försök), så att uppgiften alltid går att lösa. */

/* ----- Slump med frö (samma tentanummer ger samma tenta) ----- */
function makeRandom(seed) {
  let a = seed >>> 0;
  return () => {               // mulberry32
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ----- Säker uttrycksberäknare (ingen eval) ----- */
const deg = x => x * Math.PI / 180;
const asList = v => (Array.isArray(v) ? v : [v]);
const sortedCopy = v => [...asList(v)].sort((a, b) => a - b);
const FUNKTIONER = {
  sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp, pow: Math.pow,
  ceil: Math.ceil, floor: Math.floor,
  round: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d,
  min: (...a) => Math.min(...a.flat()), max: (...a) => Math.max(...a.flat()),
  sin: x => Math.sin(deg(x)), cos: x => Math.cos(deg(x)), tan: x => Math.tan(deg(x)),
  asin: x => Math.asin(x) * 180 / Math.PI, acos: x => Math.acos(x) * 180 / Math.PI,
  atan: x => Math.atan(x) * 180 / Math.PI, atan2: (y, x) => Math.atan2(y, x) * 180 / Math.PI,
  sum: v => asList(v).reduce((s, x) => s + x, 0),
  count: v => asList(v).length,
  mean: v => FUNKTIONER.sum(v) / asList(v).length,
  median: v => { const s = sortedCopy(v), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; },
  range: v => Math.max(...asList(v)) - Math.min(...asList(v)),
  stdev: v => { const m = FUNKTIONER.mean(v), l = asList(v); return Math.sqrt(l.reduce((s, x) => s + (x - m) ** 2, 0) / (l.length - 1)); },
  modecount: v => { const c = {}; asList(v).forEach(x => { c[x] = (c[x] || 0) + 1; }); return Math.max(...Object.values(c)); },
  mode: v => { const c = {}; asList(v).forEach(x => { c[x] = (c[x] || 0) + 1; }); const top = Math.max(...Object.values(c)); return Number(Object.keys(c).find(k => c[k] === top)); },
  uniquemode: v => { const c = {}; asList(v).forEach(x => { c[x] = (c[x] || 0) + 1; }); const top = Math.max(...Object.values(c)); return Object.values(c).filter(n => n === top).length === 1 && top > 1 ? 1 : 0; },
  item: (v, i) => asList(v)[i - 1],
  sorted: v => sortedCopy(v),
  if: (c, a, b) => (c ? a : b),
  isint: x => (Math.abs(x - Math.round(x)) < 1e-9 ? 1 : 0),
  decimals: (x, d) => (Math.abs(x * 10 ** d - Math.round(x * 10 ** d)) < 1e-7 ? 1 : 0),
};
const KONSTANTER = { pi: Math.PI, g: 9.82 };

function tokenize(text) {
  const tokens = [];
  const re = /\s*(\d+(?:\.\d+)?(?:e[+-]?\d+)?|[A-Za-zÅÄÖåäö_][\wÅÄÖåäö]*|<=|>=|==|!=|&&|\|\||[-+*/^(),<>!?:])/gy;
  let m;
  let pos = 0;
  while (pos < text.length) {
    re.lastIndex = pos;
    m = re.exec(text);
    if (!m) { if (/^\s*$/.test(text.slice(pos))) break; throw new Error('Okänt tecken i uttryck: ' + text.slice(pos, pos + 10)); }
    tokens.push(m[1]);
    pos = re.lastIndex;
  }
  return tokens;
}

// Rekursiv parser: villkor ? a : b  >  || && > jämförelse > + - > * / > ^ > unärt > primärt
function evaluate(text, scope) {
  const t = tokenize(String(text).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
  let i = 0;
  const peek = () => t[i];
  const take = expected => {
    const tok = t[i++];
    if (expected && tok !== expected) throw new Error(`Förväntade "${expected}" i: ${text}`);
    return tok;
  };
  const ternary = () => {
    const c = or();
    if (peek() === '?') { take('?'); const a = ternary(); take(':'); const b = ternary(); return c ? a : b; }
    return c;
  };
  const or = () => { let v = and(); while (peek() === '||') { take(); const r = and(); v = v || r; } return v; };
  const and = () => { let v = cmp(); while (peek() === '&&') { take(); const r = cmp(); v = v && r; } return v; };
  const cmp = () => {
    let v = add();
    while (['<', '>', '<=', '>=', '==', '!='].includes(peek())) {
      const op = take(); const r = add();
      v = op === '<' ? v < r : op === '>' ? v > r : op === '<=' ? v <= r : op === '>=' ? v >= r
        : op === '==' ? Math.abs(v - r) < 1e-9 : Math.abs(v - r) >= 1e-9;
      v = v ? 1 : 0;
    }
    return v;
  };
  const add = () => { let v = mul(); while (peek() === '+' || peek() === '-') { const op = take(); const r = mul(); v = op === '+' ? v + r : v - r; } return v; };
  const mul = () => { let v = pow(); while (peek() === '*' || peek() === '/') { const op = take(); const r = pow(); v = op === '*' ? v * r : v / r; } return v; };
  const pow = () => { const b = unary(); if (peek() === '^') { take(); return b ** pow(); } return b; };
  const unary = () => {
    if (peek() === '-') { take(); return -unary(); }
    if (peek() === '+') { take(); return unary(); }
    if (peek() === '!') { take(); return unary() ? 0 : 1; }
    return primary();
  };
  const primary = () => {
    const tok = take();
    if (tok === undefined) throw new Error('Uttrycket tar slut: ' + text);
    if (tok === '(') { const v = ternary(); take(')'); return v; }
    if (/^\d/.test(tok)) return parseFloat(tok);
    if (peek() === '(') {
      const fn = FUNKTIONER[tok];
      if (!fn) throw new Error('Okänd funktion: ' + tok);
      take('(');
      const args = [];
      if (peek() !== ')') { args.push(ternary()); while (peek() === ',') { take(); args.push(ternary()); } }
      take(')');
      return fn(...args);
    }
    if (tok in scope) return scope[tok];
    if (tok in KONSTANTER) return KONSTANTER[tok];
    throw new Error('Okänd variabel: ' + tok);
  };
  const value = ternary();
  if (i < t.length) throw new Error('Oväntat slut på uttryck: ' + text);
  return value;
}

/* ----- Talformat: svenskt decimalkomma och mellanslag för tusental ----- */
function formatNumber(v, decimals) {
  if (Array.isArray(v)) return v.map(x => formatNumber(x, decimals)).join(', ');
  if (typeof v === 'string') return v;
  let d = decimals;
  if (d == null) {                          // automatiskt: högst 3 decimaler, inga onödiga nollor
    d = 0;
    while (d < 3 && Math.abs(v * 10 ** d - Math.round(v * 10 ** d)) > 1e-9) d++;
  }
  const fixed = (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);
  let [int, frac] = fixed.split('.');
  const neg = int.startsWith('-');
  if (neg) int = int.slice(1);
  if (int.length > 4) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (neg ? '−' : '') + int + (frac ? ',' + frac : '');
}

/* ----- Läsa mallar ----- */
const templateStore = { G: [], VG: [], errors: [], source: '' };

function parseTemplates(xmlText, file) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.getElementsByTagName('parsererror')[0]) throw new Error(`${file}: XML-fel`);
  return [...doc.getElementsByTagName('mall')].map(el => ({
    id: el.getAttribute('id'),
    niva: el.getAttribute('niva') || 'G',
    lektion: el.getAttribute('lektion') || '',
    poang: parseFloat(el.getAttribute('poang')) || 1,
    xml: new XMLSerializer().serializeToString(el),
    element: el,
  }));
}

/* Mallfilerna står i mallar/index.xml (precis som lektionerna i lessons/index.xml).
   Öppnas sidan direkt från datorn används de inbyggda kopiorna i HTML-filen. */
async function loadTemplates() {
  let texts = null;
  try {
    const indexResponse = await fetch('mallar/index.xml', { cache: 'no-cache' });
    if (!indexResponse.ok) throw new Error();
    const index = new DOMParser().parseFromString(await indexResponse.text(), 'application/xml');
    const files = [...index.getElementsByTagName('fil')].filter(f => f.getAttribute('visa') !== 'nej').map(f => f.textContent.trim());
    texts = await Promise.all(files.map(async f => {
      const r = await fetch('mallar/' + f, { cache: 'no-cache' });
      if (!r.ok) throw new Error();
      return { file: f, text: await r.text() };
    }));
    templateStore.source = 'mapp';
  } catch (e) {
    texts = $$('script[type="text/xml"][data-template-file]').map(s => ({ file: s.dataset.templateFile, text: s.textContent.trim() }));
    templateStore.source = 'inbyggd';
  }
  templateStore.G = [];
  templateStore.VG = [];
  templateStore.errors = [];
  const seen = new Set();
  for (const { file, text } of texts) {
    try {
      for (const t of parseTemplates(text, file)) {
        if (seen.has(t.id)) { templateStore.errors.push(`${file}: mall-id "${t.id}" finns redan`); continue; }
        seen.add(t.id);
        (t.niva === 'VG' ? templateStore.VG : templateStore.G).push(t);
      }
    } catch (e) { templateStore.errors.push(e.message); }
  }
}

/* ----- Skapa en uppgift från en mall ----- */
const MAX_TRIES = 400;

function drawVariables(template, rnd) {
  const scope = {};
  for (const el of template.element.children) {
    const name = el.getAttribute('namn');
    if (el.localName === 'var') {
      if (el.getAttribute('typ') === 'val') {
        const options = el.getAttribute('alternativ').split('|');
        scope[name] = options[Math.floor(rnd() * options.length)];
        const n = Number(String(scope[name]).replace(',', '.'));
        if (!isNaN(n) && String(scope[name]).trim() !== '') scope[name] = n;
        continue;
      }
      const min = evaluate(el.getAttribute('min'), scope);
      const max = evaluate(el.getAttribute('max'), scope);
      const step = el.hasAttribute('steg') ? evaluate(el.getAttribute('steg'), scope) : null;
      const dec = parseInt(el.getAttribute('decimaler') || '0', 10);
      let v;
      if (step) {
        const n = Math.floor((max - min) / step + 1e-9);
        v = min + Math.floor(rnd() * (n + 1)) * step;
      } else {
        v = min + rnd() * (max - min);
      }
      scope[name] = Math.round(v * 10 ** dec) / 10 ** dec;
    } else if (el.localName === 'lista') {
      const count = evaluate(el.getAttribute('antal'), scope);
      const min = evaluate(el.getAttribute('min'), scope);
      const max = evaluate(el.getAttribute('max'), scope);
      const dec = parseInt(el.getAttribute('decimaler') || '0', 10);
      scope[name] = Array.from({ length: count }, () => Math.round((min + rnd() * (max - min)) * 10 ** dec) / 10 ** dec);
    } else if (el.localName === 'rakna') {
      scope[name] = evaluate(el.textContent, scope);
    } else if (el.localName === 'villkor') {
      if (!evaluate(el.textContent, scope)) return null;
    }
  }
  return scope;
}

// Fyller i {=uttryck} och {=uttryck:d} i en text. Tillägg efter kolon:
//   {=x:p}  negativa tal inom parentes:   5 + (−3)   (−3)²
//   {=x:s}  tal med räknetecken:          + 3   − 3     (för  4x {=b:s}  →  4x − 3)
function fillPlaceholders(text, scope) {
  return text.replace(/\{=([^{}]+?)(?::(\d)?([ps])?)?\}/g, (_, expr, d, mode) => {
    const v = /^[A-Za-zÅÄÖåäö_]\w*$/.test(expr.trim()) && typeof scope[expr.trim()] === 'string'
      ? scope[expr.trim()] : evaluate(expr, scope);
    const dec = d == null ? null : parseInt(d, 10);
    let shown = formatNumber(v, dec);
    if (typeof v === 'number' && mode === 'p' && v < 0) shown = `(${shown})`;
    if (typeof v === 'number' && mode === 's') shown = (v < 0 ? '− ' : '+ ') + formatNumber(Math.abs(v), dec);
    return xmlEscape(shown);
  });
}

// Skapar en uppgift (samma form som EXAM-uppgifterna) eller null om mallen inte gick att lösa.
function instantiate(template, rnd, number, part) {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    let scope;
    try { scope = drawVariables(template, rnd); } catch (e) { return { error: e.message }; }
    if (!scope) continue;

    const answers = [...template.element.getElementsByTagName('svar')].filter(s => s.parentNode === template.element);
    const fields = [];
    let ok = true;
    // Tips för just den här delen (formel="…" tips="…" på <svar>), används när uppgiften har flera svar
    const partTip = s => ({ formel: s.getAttribute('formel') || '', kort: s.getAttribute('tips') || '' });
    for (const s of answers) {
      const value = evaluate(s.getAttribute('varde'), scope);
      if (s.getAttribute('typ') === 'val') {
        const options = s.getAttribute('alternativ').split('|');
        fields.push({ l: s.getAttribute('etikett') || 'Svar', sel: options, a: options[value], tip: partTip(s) });
        if (options[value] === undefined) ok = false;
        continue;
      }
      if (!isFinite(value)) { ok = false; break; }
      const dec = s.hasAttribute('decimaler') ? parseInt(s.getAttribute('decimaler'), 10) : null;
      const min = s.hasAttribute('min') ? evaluate(s.getAttribute('min'), scope) : -Infinity;
      const max = s.hasAttribute('max') ? evaluate(s.getAttribute('max'), scope) : Infinity;
      if (value < min || value > max) { ok = false; break; }
      const exact = s.getAttribute('exakt') === 'ja';
      // Godkänt: inom 1 % eller avrundat till angivet antal decimaler
      const tol = exact ? 1e-9 : Math.max(Math.abs(value) * 0.01, dec != null ? 0.5 * 10 ** -dec + 1e-9 : 0.005);
      const fel = [...s.getElementsByTagName('fel')].map(f => ({ v: evaluate(f.getAttribute('varde'), scope), t: '' }));
      fields.push({ l: s.getAttribute('etikett') || 'Svar', u: s.getAttribute('enhet') || '', a: dec != null ? Math.round(value * 10 ** dec) / 10 ** dec : value, tol, fel, tip: partTip(s) });
    }
    if (!ok) continue;

    // Fyll i texten och lösningen
    const filled = fillPlaceholders(template.xml, scope);
    const el = new DOMParser().parseFromString(filled, 'application/xml').documentElement;
    const q = el.getElementsByTagName('fraga')[0];
    const sol = el.getElementsByTagName('losning')[0];
    const extra = el.getElementsByTagName('underlag')[0];   // t.ex. ett diagram eller en tabell
    // Felsvarens förklaringar hämtas ur den ifyllda texten (samma ordning som svaren)
    [...el.children].filter(c => c.localName === 'svar').forEach((s, i) => {
      const field = fields[i];
      if (field && field.fel) [...s.getElementsByTagName('fel')].forEach((f, k) => { if (field.fel[k]) field.fel[k].t = f.textContent.trim(); });
    });
    return {
      part, n: number, p: template.poang, ch: template.lektion, mall: template.id,
      q: q ? inline(q) : '', u: extra ? renderBlocks(extra) : '', f: fields, s: sol ? renderBlocks(sol) : '',
      hjalp: readHelp(el, sol, fields),
    };
  }
  return null;
}

/* ----- Hjälp när en uppgift blir fel (används i minitentan) -----
   <hjalp sida="2">                        bild i lektionen att repetera (valfri, annars första bilden)
     <formel>A = l \cdot b</formel>       formeln i generell form (LaTeX), läses upp vid första felet
     <kort>Arean är längd gånger bredd.</kort>          kort förklaring utan siffror
     <genomgang>A är {=l} gånger {=b}.</genomgang>       siffrorna insatta, utan svaret (valfri)
   </hjalp>
   Saknas formeln används den första formeln i lösningen. Saknas genomgången byggs
   den av lösningsraderna, med slutresultaten borttagna. */
// Första formeln i lösningen med bokstäver och likhetstecken men utan siffror, t.ex. "A = l \cdot b"
function firstSymbolicRow(sol) {
  if (!sol) return '';
  const row = [...sol.getElementsByTagName('rad')].find(r => !isYes(r, 'text') && /[a-zA-Z]\s*=/.test(r.textContent) &&
    !/\d/.test(r.textContent.replace(/\\[a-zA-Z]+/g, '').replace(/_\{?\w+\}?/g, '').replace(/\^\{?\d+\}?/g, '')));
  return row ? row.textContent.trim() : '';
}

// Genomgång med uppgiftens siffror insatta, men utan svaret: slutresultat (= 12,5 m) tas bort,
// och rader som bara innehåller svaret hoppas över.
function substitutionSpeech(sol, fields, givenText = '') {
  if (!sol) return '';
  const near = (n, a) => Math.abs(n - a) <= Math.max(Math.abs(a) * 0.001, 1e-6);
  const given = numbersIn(givenText);
  // Svaren som inte redan står i uppgiften (små heltal som 2 och 3 i "1/3" räknas inte)
  const same = (n, g) => Math.abs(n - g) < 1e-9;
  const answers = fields.filter(f => !f.sel).map(f => f.a)
    .filter(a => !given.some(g => same(g, a)) && !(Number.isInteger(a) && Math.abs(a) <= 3));
  const isAnswer = text => numbersIn(text).some(n => answers.some(a => near(n, a)));
  const isGiven = text => numbersIn(text).every(n => given.some(g => same(n, g))) && numbersIn(text).length > 0;
  const resultOnly = seg => {
    const t = seg.replace(/\\enh\{[^{}]*\}/g, '').replace(/\\text\{[^{}]*\}/g, '').replace(/\\[,;!]|\\quad/g, '').replace(/[{}()\s]/g, '');
    return t === '' || /^[-−]?[\d.,]+(\\%|%|\^\\circ)?$/.test(t);
  };
  const parts = [];
  for (const row of sol.getElementsByTagName('*')) {
    if (row.localName !== 'rad' && row.localName !== 'svar') continue;
    if (isYes(row, 'text')) {
      if (row.localName === 'svar' || isAnswer(row.textContent)) continue;
      parts.push(plainToSpeech(row.textContent.trim()).replace(/[.:]+$/, ''));
      continue;
    }
    // Dela vid likhetstecken och ≈ (utanför klamrar) och ta bort slutresultaten
    const segs = [];
    let depth = 0, cur = '';
    const tex = row.textContent;
    for (let i = 0; i < tex.length; i++) {
      const ch = tex[i];
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (depth === 0 && ch === '=') { segs.push(cur); cur = ''; continue; }
      if (depth === 0 && tex.startsWith('\\approx', i)) { segs.push(cur); cur = ''; i += 6; continue; }
      if (depth === 0 && tex.startsWith('\\Rightarrow', i)) { segs.push(cur); segs.push('⇒'); cur = ''; i += 10; continue; }
      cur += ch;
    }
    segs.push(cur);
    // Ta bort uträknade resultat i slutet (men inte tal som står i uppgiften, t.ex. "9x + 19 = 64")
    while (segs.length && ((resultOnly(segs[segs.length - 1]) && !isGiven(segs[segs.length - 1])) || segs[segs.length - 1] === '⇒')) segs.pop();
    const kept = segs.filter(sg => sg.trim());
    if (!kept.length) continue;
    const spoken = kept.map(sg => (sg === '⇒' ? 'alltså' : texToSpeech(sg))).join(' är ').replace(/ är alltså är /g, ', alltså ')
      .replace(/,? (är )?alltså \w{1,3}$/, '').replace(/[ ,.]+$/, '').trim();
    if (!spoken || /^\w{1,3}$/.test(spoken) || isAnswer(spoken)) continue;            // aldrig svaret
    const hasOperation = /gånger|delat|plus|minus|roten|upphöjt|kvadrat|kubik|procent av/.test(spoken);
    if ((row.localName === 'svar' || kept.length === 1) && !hasOperation) continue;   // t.ex. bara "148x" kvar
    parts.push(spoken);
  }
  return parts.length ? parts.join('. ') + '.' : '';
}

// Genomgång för en enskild del k av en uppgift med flera svar: lösningsraderna efter föregående
// dels svar, fram till raden där del k räknas ut. Svaren på delarna i "wrong" sägs aldrig,
// men rätt besvarade delar får nämnas (t.ex. beställningsvolymen när bara tyngden är fel).
function partSubstitution(h, fields, k, wrong) {
  if (!h || !h.sol || !fields[k] || fields[k].sel) return '';
  const rows = [...h.sol.getElementsByTagName('*')].filter(r => r.localName === 'rad' || r.localName === 'svar');
  // Tal som de står skrivna i raden, med antal decimaler: "3,09" -> [3.09, 2]
  const written = text => (String(text).replace(/−/g, '-').replace(/\{,\}/g, ',').replace(/\\,/g, ' ').replace(/\\[a-zA-Z]+/g, ' ')
    .match(/-?\d{1,3}(?:[  ]\d{3})+(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?/g) || [])
    .map(t => [parseNumber(t), (/[.,](\d+)$/.exec(t) || ['', ''])[1].length]);
  const shows = (row, a) => written(row.textContent).some(([n, d]) =>
    Math.abs(n - Math.round(a * 10 ** d) / 10 ** d) < 1e-9 && Math.abs(n - a) <= Math.max(Math.abs(a) * 0.01, 0.5 * 10 ** -d));
  // Resultatet i en rad: det som står efter sista = eller ≈ (där räknas svaret ut)
  const result = row => { const t = row.textContent.split(/=|\\approx|≈|\\Rightarrow|⇒|→/); return { textContent: t[t.length - 1] }; };
  const endOf = j => {
    if (fields[j].sel) return -1;
    const i = rows.findIndex(r => shows(result(r), fields[j].a));
    return i >= 0 ? i : rows.findIndex(r => shows(r, fields[j].a));
  };
  const end = endOf(k);
  if (end < 0) return '';
  const before = fields.map((f, j) => (j < k ? endOf(j) : -1)).filter(e => e >= 0 && e < end);
  const start = before.length ? Math.max(...before) + 1 : 0;
  const part = h.sol.cloneNode(false);
  rows.slice(start, end + 1).forEach(r => part.appendChild(r.cloneNode(true)));
  return substitutionSpeech(part, fields.filter((f, j) => wrong.includes(j)), h.given || '');
}

// Talen som står i uppgiften (fråga + underlag) – de får gärna sägas i genomgången
function givenTextOf(el) {
  const q = el.getElementsByTagName('fraga')[0];
  const u = el.getElementsByTagName('underlag')[0];
  const attrs = u ? [...u.getElementsByTagName('*')].map(x => [...x.attributes].map(a => a.value.replace(/;/g, ' ')).join(' ')).join(' ') : '';
  return (q ? q.textContent : '') + ' ' + (u ? u.textContent : '') + ' ' + attrs;
}

function readHelp(el, sol, fields) {
  const h = el.getElementsByTagName('hjalp')[0];
  const get = tag => { const x = h && h.getElementsByTagName(tag)[0]; return x ? x.textContent.replace(/\s+/g, ' ').trim() : ''; };
  const formel = get('formel') || firstSymbolicRow(sol);
  const sida = h ? parseInt(h.getAttribute('sida'), 10) : NaN;
  return {
    formel,                                         // LaTeX, t.ex. "y = k x + m"
    kort: get('kort'),                              // kort förklaring utan siffror
    genomgang: get('genomgang') || substitutionSpeech(sol, fields || [], givenTextOf(el)),   // siffrorna insatta, utan svaret
    sida: isNaN(sida) ? 1 : sida,
    sol,                                            // lösningen (ifylld), för genomgång av en enskild del
    given: givenTextOf(el),
  };
}

/* ----- Sätt ihop en tenta: 16 p på G-nivå och 14 p på VG-nivå ----- */
function pickSet(templates, targetPoints, rnd, maxPerLesson) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const pool = [...templates];
    const chosen = [];
    const perLesson = {};
    let points = 0;
    while (points < targetPoints && pool.length) {
      const idx = Math.floor(rnd() * pool.length);
      const t = pool.splice(idx, 1)[0];
      if ((perLesson[t.lektion] || 0) >= maxPerLesson) continue;
      if (points + t.poang > targetPoints) continue;
      chosen.push(t);
      perLesson[t.lektion] = (perLesson[t.lektion] || 0) + 1;
      points += t.poang;
    }
    if (points === targetPoints) return chosen;
  }
  return null;
}

// Frågetyp = mallens id utan löpnummer (g-area-012 → g-area)
const familyOf = t => t.id.replace(/-\d+$/, '');

// Väljer n mallar ur listan, högst en per frågetyp och utan de typer som redan används.
function pickVaried(templates, n, rnd, usedFamilies = new Set()) {
  const pool = templates.filter(t => !usedFamilies.has(familyOf(t)));
  const chosen = [];
  while (chosen.length < n && pool.length) {
    const t = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    if (usedFamilies.has(familyOf(t))) continue;
    usedFamilies.add(familyOf(t));
    chosen.push(t);
  }
  return chosen;
}

const lessonOrder = id => { const l = lessonStore.all.find(x => x.id === id); return l ? l.ordning : 999; };

// Gör uppgifter av en lista mallar. Uppgifter som inte går att skapa hoppas över.
function instantiateAll(list, rnd, part, numberOf) {
  const out = [];
  for (const t of list) {
    const q = instantiate(t, rnd, numberOf(out.length), part);
    if (q && !q.error) out.push(q);
  }
  return out;
}

/* Hel tenta: 16 p G, 14 p VG och 8 extrauppgifter (utan poäng) av andra frågetyper.
   Returnerar { questions, extras } eller null. */
function generateExam(seed) {
  const rnd = makeRandom(seed);
  const g = pickSet(templateStore.G, 16, rnd, 1) || pickSet(templateStore.G, 16, rnd, 2);
  const vg = pickSet(templateStore.VG, 14, rnd, 1) || pickSet(templateStore.VG, 14, rnd, 2);
  if (!g || !vg) return null;
  // Uppgifterna sorteras i lektionsordning så att varje del börjar med det grundläggande
  g.sort((a, b) => lessonOrder(a.lektion) - lessonOrder(b.lektion));
  vg.sort((a, b) => lessonOrder(a.lektion) - lessonOrder(b.lektion));
  const questions = [];
  let n = 1;
  for (const [list, part] of [[g, 1], [vg, 2]]) {
    for (const t of list) {
      const q = instantiate(t, rnd, n, part);
      if (!q || q.error) return null;
      questions.push(q);
      n++;
    }
  }
  const used = new Set([...g, ...vg].map(familyOf));
  const extraTemplates = [...pickVaried(templateStore.G, 4, rnd, used), ...pickVaried(templateStore.VG, 4, rnd, used)]
    .sort((a, b) => lessonOrder(a.lektion) - lessonOrder(b.lektion));
  const extras = instantiateAll(extraTemplates, rnd, 0, i => 'E' + (i + 1));
  return { questions, extras };
}

/* Minitenta för en lektion: upp till tre G-uppgifter och en VG-uppgift av olika typer. */
function generateMini(lessonId, seed) {
  const rnd = makeRandom(seed);
  const used = new Set();
  const list = [
    ...pickVaried(templateStore.G.filter(t => t.lektion === lessonId), 3, rnd, used),
    ...pickVaried(templateStore.VG.filter(t => t.lektion === lessonId), 1, rnd, used),
  ];
  return instantiateAll(list, rnd, 0, i => 'M' + (i + 1));
}

const hasTemplatesFor = lessonId => templateStore.G.some(t => t.lektion === lessonId) || templateStore.VG.some(t => t.lektion === lessonId);
