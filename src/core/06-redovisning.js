/* ---------- Rättning av redovisningen ----------
   Eleven kan skriva sin uträkning i en ruta under uppgiften. Vid rättningen
   kontrolleras fyra saker på ett enkelt sätt:
     1. Formel      – finns något i stil med  A = …,  V = …  eller  x = …?
     2. Insättning  – används talen från uppgiften?
     3. Mellanled   – finns något av mellanresultaten i lösningsförslaget med?
     4. Svar + enhet – står rätt svar och rätt enhet med?
   Det är en grov kontroll (ingen lärare), men den visar vad som saknas. */

// Hittar alla tal i en text: "24 000", "0,375", "−3.5"
function numbersIn(text) {
  const cleaned = String(text).replace(/−/g, '-').replace(/\{,\}/g, ',').replace(/\\,/g, ' ').replace(/\\[a-zA-Z]+/g, ' ');
  const found = cleaned.match(/-?\d{1,3}(?:[  ]\d{3})+(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?/g) || [];
  return found.map(parseNumber).filter(n => isFinite(n));
}

const plainText = html => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent; };
const sameNumber = (a, b) => Math.abs(a - b) <= Math.max(Math.abs(b) * 0.01, 0.006);

// Gör om enheter så att m², m^2 och m2 räknas som samma sak.
const normUnit = u => String(u).toLowerCase().replace(/\s/g, '').replace(/\^/g, '').replace(/²/g, '2').replace(/³/g, '3').replace(/°/g, 'grader');

function checkWorking(text, question) {
  const written = String(text || '');
  const nums = numbersIn(written);
  const has = v => nums.some(n => sameNumber(n, v));
  const trivial = v => [0, 1, 2, 10, 100, 1000].includes(Math.abs(v));

  const given = numbersIn(plainText(question.q + ' ' + (question.u || ''))).filter(v => !trivial(v));
  const answers = question.f.filter(f => !f.sel).map(f => f.a);
  const steps = numbersIn(question.s)
    .filter(v => !trivial(v) && !given.some(g => sameNumber(v, g)) && !answers.some(a => sameNumber(v, a)));

  const solutionText = plainText(question.s).replace(/\\text\{[^}]*\}/g, '').replace(/\\[a-zA-Z]+/g, ' ');
  const solutionHasFormula = /[A-Za-z]\w*(_\w+|_\{[^}]*\})?\s*=/.test(solutionText);
  const unitsOk = question.f.filter(f => !f.sel && f.u).every(f => normUnit(written).includes(normUnit(f.u)));
  const answersOk = answers.length ? answers.every(has) : true;

  return [
    { label: 'Formel', ok: /[A-Za-zÅÄÖåäöπγρθα_]\w*\s*=/.test(written) || /[√π]/.test(written) ||
        // Har lösningsförslaget ingen namngiven formel räcker en uträkning med likhetstecken
        (!solutionHasFormula && /[-+*/·×÷^]/.test(written) && written.includes('=')),
      tip: 'Börja med formeln, t.ex. A = l · b eller G = m · g.' },
    { label: 'Insättning', ok: given.length ? given.some(has) : nums.length > 0,
      tip: 'Sätt in talen från uppgiften i formeln.' },
    { label: 'Mellanled', ok: steps.length ? steps.some(has) : (written.match(/=/g) || []).length >= 2,
      tip: 'Visa minst ett mellanresultat innan svaret.' },
    { label: 'Svar med enhet', ok: answersOk && unitsOk,
      tip: answersOk ? 'Skriv enheten efter svaret.' : 'Det rätta svaret saknas i redovisningen.' },
  ];
}

// HTML för rutan under en uppgift.
function workingHTML(n, saved = '') {
  return `<details class="redov" id="redov-${n}"${saved ? ' open' : ''}>
    <summary>Din redovisning <small>(valfritt – rättas när du rättar)</small></summary>
    <textarea id="rw-${n}" rows="3" spellcheck="false" placeholder="T.ex.  A = l · b = 4,5 · 3,2 = 14,4 m²">${escapeHtml(saved)}</textarea>
    <div class="redov-res" id="rwres-${n}"></div>
  </details>`;
}

// Visar resultatet. Är rutan tom visas en checklista att kryssa själv (för den som räknar på papper).
function showWorkingResult(question) {
  const n = question.n;
  const box = document.getElementById('rwres-' + n);
  const area = document.getElementById('rw-' + n);
  if (!box || !area) return null;
  if (!area.value.trim()) {
    box.innerHTML = `<p class="note">Räknade du på papper? Kryssa i det du skrev:</p>` +
      ['Formel', 'Insättning', 'Mellanled', 'Svar med enhet'].map(l => `<label class="selfcheck"><input type="checkbox"> ${l}</label>`).join('');
    return null;
  }
  const items = checkWorking(area.value, question);
  box.innerHTML = '<ul class="redov-list">' + items.map(i =>
    `<li class="${i.ok ? 'ok' : 'bad'}">${i.ok ? '✓' : '✗'} ${i.label}${i.ok ? '' : ` – <span>${escapeHtml(i.tip)}</span>`}</li>`).join('') + '</ul>';
  document.getElementById('redov-' + n).open = true;
  return items.every(i => i.ok);
}
