/* ---------- Minitentor ----------
   Sist i varje lektion som har tentamallar kommer en minitenta med upp till
   fyra uppgifter av olika typ från just den lektionen. Den går att hoppa över
   (knappen "Hoppa över", eller stäng av alla med rutan "Minitentor"). */

const mini = {
  lessonId: null, seed: 0, questions: [],
  wrong: {},          // hur många gånger varje uppgift (index) har blivit fel
  lastAnswer: {},     // svaret som räknades senast för varje uppgift
  touched: {},        // har eleven gått in i uppgiftens ruta sedan senaste rättningen?
  feedbackTimer: null,
};

function miniSlideInfo(lesson) {
  const t = lesson.titel.toLowerCase();
  return {
    element: null,
    say: `Dags för en minitenta om ${t}. Några snabba uppgifter för att se att det sitter. Kändes avsnittet lätt kan du hoppa över minitentan och gå direkt vidare.`,
    sayEn: `Time for a mini exam on ${(lesson.titelEn || lesson.titel).toLowerCase()}. A few quick questions to check that it has sunk in. If the section felt easy, you can skip the mini exam and move straight on.`,
  };
}

function newMini(lessonId) {
  mini.lessonId = lessonId;
  mini.seed = 100000 + Math.floor(Math.random() * 900000);
  mini.questions = generateMini(lessonId, mini.seed);
  mini.wrong = {};
  mini.lastAnswer = {};
  mini.touched = {};
}

function renderMini(lesson) {
  if (mini.lessonId !== lesson.id) newMini(lesson.id);
  const isLast = slideIndex >= slides.length - 1;
  const skip = `<button class="btn ghost" data-mini="skip">${isLast ? 'Hoppa över' : 'Hoppa över ▶'}</button>`;
  return `<div class="mini">
    <div class="eyebrow">Minitenta · ${escapeHtml(lesson.titel)}</div>
    <h2>Kolla att det sitter</h2>
    <p>${mini.questions.length} uppgifter från det här avsnittet. Kändes avsnittet lätt? Hoppa över och gå vidare.</p>
    <div class="btnrow">${skip}</div>
    ${mini.questions.map((q, i) => `
      <div class="q" id="mq-${i}">
        <div class="qtop"><span class="qn">${i + 1}.</span><span class="pts">${q.p} p</span></div>
        <p>${q.q}</p>
        ${q.u || ''}
        ${q.f.map((f, k) => fieldHTML(f, `mini-${i}-${k}`)).join('')}
        <div class="sol hidden" id="msol-${i}">${q.s}</div>
      </div>`).join('')}
    <div class="btnrow">
      <button class="btn primary" data-mini="check">Rätta</button>
      <button class="btn ghost" data-mini="solutions">Visa lösningar</button>
      <button class="btn ghost" data-mini="new">Nya uppgifter</button>
      ${skip}
    </div>
    <div id="mini-result" aria-live="polite"></div>
  </div>`;
}

function handleMiniClick(event) {
  const button = event.target.closest('button[data-mini]');
  if (!button) return;
  const action = button.dataset.mini;
  if (action === 'skip') { goToSlide(slideIndex + 1); return; }
  if (action === 'new') { newMini(mini.lessonId); renderSlide(); return; }
  if (action === 'solutions') {
    $$('.mini .sol').forEach(el => el.classList.remove('hidden'));
    typeset($('#board'));
    return;
  }
  if (action === 'check') {
    let right = 0;
    const counted = [];     // fel som räknas den här gången (nytt svar eller rutan har fått fokus)
    const stillWrong = [];  // fel med samma svar som förra gången – räknas inte igen
    mini.questions.forEach((q, i) => {
      const ok = q.f.map((f, k) => checkField(f, `mini-${i}-${k}`)).every(Boolean);
      const values = q.f.map((f, k) => String(document.getElementById(`mini-${i}-${k}`).value).trim());
      const answered = values.every(v => v !== '');
      const signature = values.join('|');
      if (ok) right++;
      else if (answered) {
        if (signature !== mini.lastAnswer[i] || mini.touched[i]) {
          mini.wrong[i] = (mini.wrong[i] || 0) + 1;
          counted.push(i);
        } else stillWrong.push(i);
      }
      mini.lastAnswer[i] = signature;
      mini.touched[i] = false;
      $('#mq-' + i).classList.toggle('graded-full', ok);
      $('#mq-' + i).classList.toggle('graded-zero', !ok);
    });
    const total = mini.questions.length;
    clearTimeout(mini.feedbackTimer);
    let fb;
    // Alla fel gås igenom med tipset för sin nivå. Fel med samma svar som förut räknas inte upp en nivå.
    if (counted.length || stillWrong.length) fb = miniFeedback(counted, stillWrong, right > 0);
    else {
      const text = right === total
        ? `Alla ${total} rätt! Avsnittet sitter. Gå vidare till nästa.`
        : `${right} av ${total} rätt. Fyll i de tomma rutorna och rätta igen.`;
      $('#mini-result').innerHTML = `<div class="scorebox"><div class="big">${right} / ${total}</div><p>${text}</p></div>`;
      $('#bubble-lesson').innerHTML = toParagraphs(text);
      return;
    }
    // Det som visas är HTML där formlerna ritas med MathJax (LaTeX), precis som på bilderna
    const html = fb.html || escapeHtml(fb.text);
    $('#mini-result').innerHTML = `<div class="scorebox"><div class="big">${right} / ${total}</div><p>${html}</p></div>`;
    $('#bubble-lesson').innerHTML = `<p>${html}</p>`;
    typeset($('#mini-result'));
    typeset($('#bubble-lesson'));
    // Kapten Kalkyl börjar prata en sekund efter rättningen
    const from = slideIndex;
    mini.feedbackTimer = setTimeout(() => {
      if (slideIndex !== from) return;
      const sendBack = () => setTimeout(() => {
        if (slideIndex !== from) return;
        mini.wrong[fb.index] = 0;   // nästa gång börjar det om från första nivån
        goToLesson(fb.lesson || mini.lessonId, Math.max(0, fb.sida - 1));
      }, 2000);
      if (typeof synth === 'undefined' || !synth) { if (fb.level === 3) setTimeout(sendBack, 3000); return; }
      speak(narration(fb.text, fb.textEn), $('#teacher-lesson'), fb.level === 3 ? sendBack : null);
    }, 1000);
  }
}

// En ruta som får fokus räknas som ett nytt försök på den uppgiften (även med samma svar)
function trackMiniFocus(event) {
  const m = event.target.id && /^mini-(\d+)-\d+$/.exec(event.target.id);
  if (m) mini.touched[m[1]] = true;
}

/* Vad Kapten Kalkyl säger när något blev fel.
   Nivån för varje uppgift är hur många gånger den har blivit fel (räknas bara med nytt svar):
     1  formeln i generell form + kort förklaring
     2  formeln med uppgiftens siffror insatta (utan svaret)
     3  "Det är nog bäst att vi repeterar det här" -> tillbaka till uppgiftens avsnitt
   Uppgiften som fick ett nytt fel tas först ("Jag ser att du svarade fel på fråga …"),
   sedan de andra felen i frågeordning ("Du svarade också fel på fråga …"), var och en
   med tipset för sin nivå. Texterna kommer från mallens <hjalp> (se LÄSMIG.txt).
   Har uppgiften flera svar säger Kapten vilka delar som är rätt och vilka som är fel,
   och ger tipsen bara för de felaktiga delarna (formel="…" tips="…" på mallens <svar>). */
const MAX_PART_TIPS = 2;   // tips för högst så många felaktiga delar åt gången

// joinWords ("A, B och C") finns i 07d-repetition.js

function miniTip(index, level, first, also = true) {
  const q = mini.questions[index];
  const h = q.hjalp || { formel: '', kort: '', genomgang: '', sida: 1 };
  const no = index + 1;
  const value = k => (document.getElementById(`mini-${index}-${k}`) || {}).value || '';
  const wrong = q.f.map((f, k) => (isCorrect(f, value(k)) ? -1 : k)).filter(k => k >= 0);
  if (q.f.length > 1 && wrong.length) return miniPartTip(q, h, no, wrong, level, first, also, value);

  // said = uppläst text, html = det som visas (formeln som LaTeX)
  const formula = h.formel ? { said: `Formeln är: ${texToSpeech(h.formel)}.`, html: `Formeln är: ${inlineMath(h.formel)}.` } : { said: '', html: '' };
  const steps = h.genomgang || `${formula.said} ${h.kort}`;
  if (level >= 2) {
    const intro = first ? `Jag ser att fråga ${no} fortfarande inte sitter, så vi går igenom den tillsammans.`
      : `${also ? 'Du svarade också fel på' : 'Fortfarande fel på'} fråga ${no}. Den har blivit fel förut, så vi sätter in siffrorna.`;
    return { said: `${intro} ${steps}`, html: escapeHtml(`${intro} ${steps}`) };
  }
  const intro = first ? `Jag ser att du svarade fel på fråga ${no}.` : `${also ? 'Du svarade också fel på' : 'Fortfarande fel på'} fråga ${no}.`;
  return { said: `${intro} ${formula.said} ${h.kort}`, html: `${escapeHtml(intro)} ${formula.html} ${escapeHtml(h.kort)}` };
}

// Uppgift med flera svar: säg vilka delar som är rätt/fel och ge tips för de felaktiga delarna
function miniPartTip(q, h, no, wrong, level, first, also, value) {
  const name = k => ({ said: texToSpeech(q.f[k].l), html: escapeHtml(q.f[k].l) });
  const right = q.f.map((f, k) => k).filter(k => !wrong.includes(k));
  const wrongNames = wrong.map(name);
  // "Beställningsvolym är rätt, men Tyngd är fel." / "Både … och … är fel."
  const status = list => (right.length
    ? `${joinWords(right.map(name).map(n => n[list]))} är rätt, men ${joinWords(wrongNames.map(n => n[list]))} är fel.`
    : wrong.length === 2 ? `Både ${wrongNames[0][list]} och ${wrongNames[1][list]} är fel.` : 'Alla delarna är fel.');
  const lead = level >= 2
    ? (first ? `Jag ser att fråga ${no} fortfarande inte sitter.` : `${also ? 'Du svarade också fel på' : 'Fortfarande fel på'} fråga ${no}.`)
    : (first ? `Jag ser att du svarade fel på fråga ${no}.` : `${also ? 'Du svarade också fel på' : 'Fortfarande fel på'} fråga ${no}.`);
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  const said = [lead, cap(status('said'))], html = [escapeHtml(lead), cap(status('html'))];

  const shown = wrong.slice(0, MAX_PART_TIPS);
  if (level >= 2) { said.push('Vi går igenom det tillsammans.'); html.push('Vi går igenom det tillsammans.'); }
  else if (!right.length && wrong.length > 1) { said.push(`Börja med ${wrongNames[0].said}.`); html.push(`Börja med ${wrongNames[0].html}.`); }
  const usedKort = new Set();
  for (const k of shown) {
    const f = q.f[k];
    const tip = f.tip || { formel: '', kort: '' };
    // Om bara en del finns att ge tips för och den saknar egna tips: uppgiftens gemensamma tips
    const formel = tip.formel || (wrong.length === 1 && !tip.kort ? h.formel : '');
    const kort = tip.kort || (wrong.length === 1 ? h.kort : '');
    const label = wrong.length > 1 || right.length ? name(k) : null;
    const pre = label ? { said: `${label.said}: `, html: `<b>${label.html}:</b> ` } : { said: '', html: '' };
    const diag = diagnose(f, value(k));   // t.ex. "Du har använt standardavvikelsen …"
    let partSaid = '', partHtml = '';
    if (level >= 2) {
      const steps = partSubstitution(h, q.f, k, wrong);
      // Kort genomgång (t.ex. bara "1,96 gånger 0,471"): lägg till förklaringen också
      const extra = steps && steps.length < 60 && kort ? ` ${kort}` : '';
      partSaid = steps ? steps + extra : `${formel ? `Formeln är ${texToSpeech(formel)}.` : ''} ${kort}`;
      partHtml = steps ? escapeHtml(steps + extra) : `${formel ? `Formeln är ${inlineMath(formel)}.` : ''} ${escapeHtml(kort)}`;
    } else {
      const k2 = usedKort.has(kort) ? '' : kort;
      usedKort.add(kort);
      partSaid = `${formel ? `Formeln är ${texToSpeech(formel)}.` : ''} ${k2}`;
      partHtml = `${formel ? `Formeln är ${inlineMath(formel)}.` : ''} ${escapeHtml(k2)}`;
    }
    if (diag) { partSaid = `${diag} ${partSaid}`; partHtml = `${escapeHtml(diag)} ${partHtml}`; }
    said.push(pre.said + partSaid.trim());
    html.push(pre.html + partHtml.trim());
  }
  if (wrong.length > shown.length) {
    const rest = joinWords(wrongNames.slice(shown.length).map(n => n.said));
    said.push(`Ta ${rest} när det här sitter.`);
    html.push(escapeHtml(`Ta ${joinWords(wrong.slice(shown.length).map(k => q.f[k].l))} när det här sitter.`));
  }
  return { said: said.join(' '), html: html.join(' ') };
}

// anyRight: någon uppgift är rätt – då heter det "Du svarade också fel på fråga …"
function miniFeedback(counted, stillWrong, anyRight = true) {
  const clean = t => t.replace(/\s+/g, ' ').trim();
  // Tre fel på någon uppgift: tillbaka till den uppgiftens avsnitt
  const third = [...counted].sort((a, b) => a - b).find(i => mini.wrong[i] >= 3);
  if (third != null) {
    const q = mini.questions[third];
    const text = `Det är nog bäst att vi repeterar det här. Fråga ${third + 1} har blivit fel tre gånger, så vi går tillbaka till avsnittet.`;
    return { index: third, level: 3, sida: (q.hjalp && q.hjalp.sida) || 1, lesson: q.ch, text, html: escapeHtml(text),
      textEn: 'I think we had better review this. Let\'s go back to that section.' };
  }
  const order = [...[...counted].sort((a, b) => a - b), ...[...stillWrong].sort((a, b) => a - b)];
  const tips = order.map((i, n) => miniTip(i, mini.wrong[i] || 1, n === 0 && counted.length > 0, anyRight || n > 0));
  const nos = order.map(i => i + 1).join(' och ');
  return {
    index: order[0], level: Math.min(2, mini.wrong[order[0]] || 1),
    text: clean(tips.map(t => t.said).join(' ') + ' Försök igen!'),
    html: clean(tips.map(t => t.html).join(' ') + ' Försök igen!'),
    textEn: `Question ${nos} ${order.length > 1 ? 'are' : 'is'} still wrong. Have a look at the formula and try again!`,
  };
}
