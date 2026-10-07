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
    [/\\sqrt\{([^{}]*)\}/g, '√($1)'],
    [/\\text\{([^{}]*)\}/g, '$1'],
    [/\\mathrm\{([^{}]*)\}/g, '$1'],
    [/\\enh\{([^{}]*)\}/g, ' $1'],
    [/\\vec\{([^{}]*)\}/g, '$1⃗'],
    [/\\left|\\right/g, ''],
    [/\{,\}/g, ','], [/\\,|\\;|\\ |\\quad|\\qquad/g, ' '],
    [/\\cdot/g, '·'], [/\\approx/g, '≈'], [/\\Rightarrow/g, '⇒'], [/\\div/g, '÷'],
    [/\\lt/g, '<'], [/\\gt/g, '>'], [/\\gamma/g, 'γ'], [/\\rho/g, 'ρ'], [/\\pi/g, 'π'],
    [/\\dots/g, '…'], [/\\%/g, '%'], [/\^\\circ/g, '°'], [/\^\{-1\}/g, '⁻¹'],
    [/\^2/g, '²'], [/\^3/g, '³'], [/\\(sin|cos|tan)/g, '$1'],
    [/_\{([^{}]*)\}/g, '$1'], [/_(\w)/g, '$1'], [/\^\{([^{}]*)\}/g, '^($1)'],
    [/[{}]/g, ''],
  ];
  for (let pass = 0; pass < 3; pass++) rules.forEach(([re, to]) => { t = t.replace(re, to); });
  return t.replace(/\s+/g, ' ').trim();
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
