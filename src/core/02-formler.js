/* ---------- Formler (LaTeX via MathJax) ----------
   MathJax laddas från cdnjs och ritar formlerna som SVG.
   I XML-filerna skriver man LaTeX. För att det ska vara enkelt:
     - decimalkomma fungerar direkt:      8,2      (blir 8{,}2)
     - tusentalsmellanslag fungerar:      24 000   (blir 24\,000)
     - procenttecken fungerar:            15 %     (blir 15\%)
     - \enh{kN/m^3} skriver en enhet med rätt mellanrum.
   Laddas inte MathJax (t.ex. utan internet) visas LaTeX-koden som text. */

function prepareTex(tex) {
  return String(tex)
    .trim()
    .replace(/−/g, '-')
    .replace(/(\d),(?=\d)/g, '$1{,}')
    .replace(/(\d) (?=\d{3}(?!\d))/g, '$1\\,')
    .replace(/(^|[^\\])%/g, '$1\\%');
}

// Gör om LaTeX till HTML som MathJax sedan renderar.
const inlineMath = tex => `<span class="m">\\(${escapeHtml(prepareTex(tex))}\\)</span>`;
const displayMath = tex => `<span class="m">\\(\\displaystyle ${escapeHtml(prepareTex(tex))}\\)</span>`;

const math = {
  ready: false,
  failed: false,     // MathJax kunde inte laddas -> visa förenklad text
  pending: new Set(),
};

// Förenklad läsbar text av en LaTeX-formel, om MathJax inte går att ladda.
function texToPlain(tex) {
  let t = tex.replace(/^\\\(|\\\)$/g, '').replace(/\\displaystyle\s*/g, '');
  const rules = [
    [/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)'],
    [/\\sqrt\[3\]\{([^{}]*)\}/g, '∛($1)'],
    [/\\sqrt\{([^{}]*)\}/g, '√($1)'],
    [/\\text\{([^{}]*)\}/g, '$1'],
    [/\\mathrm\{([^{}]*)\}/g, '$1'],
    [/\\enh\{([^{}]*)\}/g, ' $1'],
    [/\\vec\{([^{}]*)\}/g, '$1⃗'],
    [/\\left|\\right/g, ''],
    [/\{,\}/g, ','], [/\\,|\\;|\\ |\\quad|\\qquad/g, ' '],
    [/\\cdot/g, '·'], [/\\approx/g, '≈'], [/\\Rightarrow/g, '⇒'], [/\\div/g, '÷'],
    [/\\lt/g, '<'], [/\\gt/g, '>'], [/\\gamma/g, 'γ'], [/\\theta/g, 'θ'], [/\\rho/g, 'ρ'], [/\\pi/g, 'π'],
    [/\\dots/g, '…'], [/\\%/g, '%'], [/\^\\circ/g, '°'], [/\^\{-1\}/g, '⁻¹'],
    [/\^2/g, '²'], [/\^3/g, '³'], [/\\(sin|cos|tan)/g, '$1'],
    [/_\{([^{}]*)\}/g, '$1'], [/_(\w)/g, '$1'], [/\^\{([^{}]*)\}/g, '^($1)'],
  ];
  // Flera varv så att nästlade uttryck (\frac{\text{a}}{b}) också blir klara; klamrar tas bort sist
  for (let pass = 0; pass < 4; pass++) rules.forEach(([re, to]) => { t = t.replace(re, to); });
  return t.replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}

/* LaTeX -> text som går att läsa upp ("A = \frac{b h}{2}" -> "A är b h delat med 2").
   Används när Kapten Kalkyl går igenom en uträkning i minitentan. */
const UNIT_WORDS = {
  'm^2': 'kvadratmeter', 'm^3': 'kubikmeter', 'dm^2': 'kvadratdecimeter', 'cm^2': 'kvadratcentimeter', 'mm^2': 'kvadratmillimeter', 'dm^3': 'kubikdecimeter',
  km: 'kilometer', m: 'meter', dm: 'decimeter', cm: 'centimeter', mm: 'millimeter', kN: 'kilonewton', N: 'newton', kg: 'kilo', g: 'gram',
  ton: 'ton', kr: 'kronor', h: 'timmar', min: 'minuter', s: 'sekunder', MPa: 'megapascal', kPa: 'kilopascal', kWh: 'kilowattimmar',
  st: 'stycken', 'år': 'år', 'månad': 'månad', dag: 'dag', dagar: 'dagar', liter: 'liter', tkr: 'tusen kronor', Mkr: 'miljoner kronor', 'öre': 'öre',
};
const unitToSpeech = unit => String(unit).replace(/\s/g, '').split('/')
  .map(u => UNIT_WORDS[u] || UNIT_WORDS[u.replace('²', '^2').replace('³', '^3')] || u).join(' per ');

function texToSpeech(tex) {
  let t = ' ' + String(tex).replace(/\\displaystyle\s*/g, '') + ' ';
  t = t.replace(/\[([^\[\];]*);\\?\s*([^\[\]]*)\]/g, ' från $1 till $2 ');   // intervall [a; b]
  t = t.replace(/\|([^|]+)\|/g, ' storleken av $1 ');                             // |R|
  const rules = [
    [/\\enh\{([^{}]*)\}/g, (_, u) => ' ' + unitToSpeech(u) + ' '],
    [/\\text\{([^{}]*)\}/g, ' $1 '], [/\\mathrm\{([^{}]*)\}/g, ' $1 '],
    [/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, ' $1 delat med $2 '],
    [/\\sqrt\[3\]\{([^{}]*)\}/g, ' tredje roten ur $1 '],
    [/\\sqrt\{([^{}]*)\}/g, ' roten ur $1 '],
    [/\\bar\{x\}/g, ' medelvärdet '], [/\\vec\{([^{}]*)\}/g, ' vektor $1 '],
    [/\\tan\^\{-1\}/g, ' tangens invers av '], [/\^\{1\/(\w+)\}/g, ' upphöjt till 1 delat med $1 '],
    [/\^\\circ/g, ' grader '], [/\^2(?!\d)/g, ' i kvadrat '], [/\^3(?!\d)/g, ' i kubik '],
    [/\^\{([^{}]*)\}/g, ' upphöjt till $1 '], [/\^(\w)/g, ' upphöjt till $1 '],
    [/_\{([^{}]*)\}/g, ' $1'], [/_(\w)/g, ' $1'],
    [/\\left|\\right/g, ''], [/\{,\}/g, ','],
    [/(\d)\\,(?=\d{3})/g, '$1'], [/\\,|\;|\\ |\\quad|\\qquad/g, ' '],
    [/\\cdot|\\times/g, ' gånger '], [/\\pm/g, ' plus minus '], [/\\approx/g, ' är ungefär '], [/\\Rightarrow/g, ', alltså '],
    [/\\le\b/g, ' mindre än eller lika med '], [/\\ge\b/g, ' större än eller lika med '], [/\\lt/g, ' mindre än '], [/\\gt/g, ' större än '],
    [/\\sin/g, ' sinus '], [/\\cos/g, ' cosinus '], [/\\tan/g, ' tangens '], [/\\pi/g, ' pi '], [/\\gamma/g, ' gamma '], [/\\theta/g, ' theta '], [/<(?!=)/g, ' mindre än '], [/>(?!=)/g, ' större än '], [/\\rho/g, ' rå '],
    [/\\Delta/g, ' delta '], [/\\sum/g, ' summan av '], [/\\%/g, ' procent '], [/\\dots/g, ' och så vidare '],
  ];
  for (let pass = 0; pass < 3; pass++) rules.forEach(([re, to]) => { t = t.replace(re, to); });
  t = t.replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}]/g, '').replace(/°C/g, ' grader').replace(/°/g, ' grader');
  return t
    .replace(/(\d) (?=\d{3}\b)/g, '$1')          // 22 510 -> 22510 så att talet läses som ett tal
    .replace(/\s*=\s*/g, ' är ')
    .replace(/(^|[\s(])[-−]\s*(?=[\d\w(])/g, '$1minus ')
    .replace(/\s[-−]\s/g, ' minus ')
    .replace(/\s\+\s/g, ' plus ').replace(/\+/g, ' plus ')
    .replace(/\s\/\s|\//g, ' delat med ')
    .replace(/[;|]/g, ', ').replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// Vanlig text (t.ex. textrader i en lösning) -> lättare att läsa upp
function plainToSpeech(text) {
  return (' ' + String(text) + ' ')
    .replace(/°C/g, ' grader').replace(/°/g, ' grader').replace(/→|⇒/g, ' ger ').replace(/·|×/g, ' gånger ')
    .replace(/\s[-−]\s/g, ' minus ').replace(/−(?=\d)/g, 'minus ').replace(/\s\/\s/g, ' delat med ')
    .replace(/\s=\s/g, ' är ').replace(/%/g, ' procent')
    .replace(/(\d) (?=\d{3}\b)/g, '$1')
    .replace(/\s+/g, ' ').trim();
}

function showPlainMath(element) {
  element.querySelectorAll('.m:not(.plain)').forEach(m => {
    m.textContent = texToPlain(m.textContent);
    m.classList.add('plain');
  });
}

// Ber MathJax rendera formlerna i ett element (eller vänta tills MathJax är laddat).
function typeset(element) {
  if (!element) return;
  if (math.failed) { showPlainMath(element); return; }
  if (!math.ready) { math.pending.add(element); return; }
  try {
    if (window.MathJax.typesetClear) window.MathJax.typesetClear([element]);
    window.MathJax.typesetPromise([element]).catch(err => console.warn('MathJax:', err));
  } catch (err) {
    console.warn('MathJax:', err);
  }
}

function onMathReady() {
  if (math.ready) return;
  math.ready = true;
  if (math.failed) {            // MathJax kom fram sent: rita om det som visas
    math.failed = false;
    if (typeof redrawAfterLateMath === 'function') redrawAfterLateMath();
  }
  math.pending.forEach(el => { if (document.contains(el)) typeset(el); });
  math.pending.clear();
}

function onMathFailed() {
  if (math.ready || math.failed) return;
  math.failed = true;
  math.pending.forEach(el => showPlainMath(el));
  math.pending.clear();
}

function setupMath() {
  window.addEventListener('mathjax-ready', onMathReady);
  window.addEventListener('mathjax-failed', onMathFailed);
  setTimeout(onMathFailed, 12000);   // inget svar från MathJax inom 12 s
  // Om MathJax redan hann ladda innan den här koden kördes
  if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
    window.MathJax.startup.promise.then(onMathReady);
  }
}
