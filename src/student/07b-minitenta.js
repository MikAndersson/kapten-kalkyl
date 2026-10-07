/* ---------- Minitentor ----------
   Sist i varje lektion som har tentamallar kommer en minitenta med upp till
   fyra uppgifter av olika typ från just den lektionen. Den går att hoppa över
   (knappen "Hoppa över", eller stäng av alla med rutan "Minitentor"). */

const mini = { lessonId: null, seed: 0, questions: [] };

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
    let right = 0, total = 0;
    mini.questions.forEach((q, i) => {
      const ok = q.f.map((f, k) => checkField(f, `mini-${i}-${k}`)).every(Boolean);
      total++; if (ok) right++;
      $('#mq-' + i).classList.toggle('graded-full', ok);
      $('#mq-' + i).classList.toggle('graded-zero', !ok);
    });
    const text = right === total
      ? `Alla ${total} rätt! Avsnittet sitter. Gå vidare till nästa.`
      : `${right} av ${total} rätt. Titta på lösningarna för de röda, eller tryck Nya uppgifter och försök igen.`;
    $('#mini-result').innerHTML = `<div class="scorebox"><div class="big">${right} / ${total}</div><p>${text}</p></div>`;
    $('#bubble-lesson').innerHTML = toParagraphs(text);
  }
}
