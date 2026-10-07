/* ---------- Svarsrutor och rättning ---------- */

// Tolkar "7,5", "7.5", "−3", "25 %" och "1 450" som tal.
function parseNumber(input) {
  if (input == null) return NaN;
  const cleaned = String(input).trim()
    .replace(/\s/g, '')
    .replace(/−/g, '-')
    .replace(/[%°]/g, '')
    .replace(',', '.');
  return cleaned === '' ? NaN : Number(cleaned);
}

// Rätt om svaret ligger inom toleransen (standard: 1 % av rätt svar).
function isCorrect(field, value) {
  if (field.sel) return value === field.a;
  const number = parseNumber(value);
  if (isNaN(number)) return false;
  const tolerance = field.tol != null && !isNaN(field.tol) ? field.tol : Math.max(Math.abs(field.a) * 0.01, 0.005);
  return Math.abs(number - field.a) <= tolerance + 1e-9;
}

// Bygger HTML för en svarsruta (textfält eller flervalslista).
function fieldHTML(field, id, savedValue = '') {
  const input = field.sel
    ? `<select id="${id}">
         <option value="">välj…</option>
         ${field.sel.map(o => `<option${savedValue === o ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('')}
       </select>`
    : `<input id="${id}" inputmode="decimal" autocomplete="off" value="${escapeHtml(savedValue)}">`;
  return `<div class="field" data-id="${id}">
            <label for="${id}">${escapeHtml(field.l)}</label>${input}
            <span class="unit">${escapeHtml(field.u || '')}</span><span class="mark"></span>
          </div>`;
}

// Markerar en svarsruta grön (rätt) eller röd (fel). hint = förklaring av felet (valfri).
function markField(id, correct, hint = '') {
  const el = document.querySelector(`.field[data-id="${id}"]`);
  if (!el) return;
  el.classList.toggle('ok', correct);
  el.classList.toggle('bad', !correct);
  el.querySelector('.mark').textContent = correct ? '✓ Rätt' : '✗ Fel';
  let box = el.querySelector('.hint');
  if (!box) { box = document.createElement('span'); box.className = 'hint'; el.append(box); }
  box.textContent = !correct && hint ? '💡 ' + hint : '';
}

// Rättar en ruta och visar vilket misstag det troligen var.
function checkField(field, id) {
  const input = document.getElementById(id);
  const value = input ? input.value : '';
  const correct = isCorrect(field, value);
  markField(id, correct, correct ? '' : diagnose(field, value));
  return correct;
}

/* ----- Felsvarsdiagnos -----
   1. Mallens egna felsvar (<fel varde="...">förklaring</fel>) jämförs först.
   2. Sedan allmänna mönster: fel tecken, enhetsfel (×10, ×100, ×1000),
      gånger två/delat med två, radianer i stället för grader, för tidig avrundning. */
function diagnose(field, value) {
  if (field.sel || value == null || String(value).trim() === '') return '';
  const x = parseNumber(value);
  if (isNaN(x)) return 'Svaret kunde inte läsas som ett tal. Skriv bara siffror (decimalkomma går bra).';
  const a = field.a;
  for (const f of field.fel || []) {
    if (isFinite(f.v) && Math.abs(x - f.v) <= Math.max(Math.abs(f.v) * 0.01, field.tol || 0.005)) return f.t;
  }
  if (!a) return '';
  const near = (u, v) => Math.abs(u - v) <= Math.abs(v) * 0.015;
  const r = x / a;
  if (near(r, -1)) return 'Rätt storlek men fel tecken. Kontrollera plus och minus (minus minus blir plus).';
  if (field.u === '°' && near(x, a * Math.PI / 180)) return 'Miniräknaren står nog i radianer (RAD). Ställ om den till grader (DEG).';
  if (field.u === '%' && (near(r, 0.01) || near(r, 100))) return r < 1
    ? 'Du har svarat i decimalform. Gånger 100 för att få procent.'
    : 'Svaret är 100 gånger för stort. Svara i procent, inte promille eller hundradelar.';
  for (const k of [10, 100, 1000, 10000, 1e6]) {
    if (near(r, k) || near(r, 1 / k)) {
      const word = k === 1e6 ? 'en miljon' : swedishNumber(k);
      return `Svaret är ${word} gånger för ${r > 1 ? 'stort' : 'litet'}. Kontrollera enhetsomvandlingen ` +
        '(mm/cm/m, m²/dm²/cm², kg/ton, N/kN) eller var decimaltecknet hamnade.';
    }
  }
  if (near(r, 2) || near(r, 0.5)) return r > 1
    ? 'Svaret är dubbelt så stort som det ska. Har du glömt att dela med 2 (triangel, halva spännvidden, radie = diameter/2)?'
    : 'Svaret är hälften av det rätta. Har du delat med 2 i onödan eller tagit radien i stället för diametern?';
  if (near(r, 4) || near(r, 0.25)) return 'Fyra gånger fel – har du blandat ihop radie och diameter i πr²?';
  if (Math.abs(x - a) <= Math.abs(a) * 0.05) return 'Nästan rätt! Troligen har du avrundat för tidigt. Räkna med fler decimaler och avrunda först i svaret.';
  return '';
}
