/* ---------- Flikar ---------- */

const VIEWS = ['lesson', 'exam'];
const currentView = () => VIEWS.find(v => !$('#view-' + v).classList.contains('hidden')) || 'lesson';


function showView(view) {
  stopSpeaking();
  for (const v of VIEWS) {
    $('#view-' + v).classList.toggle('hidden', v !== view);
    $('#tab-' + v).setAttribute('aria-selected', v === view);
  }
  storage.set('view', view);
  closeSheet(true);
  updateSheetButtons();
  window.scrollTo({ top: 0 });
}


/* ---------- Övningstentan ---------- */

/* Vilken tenta som visas:
   - 'slump': genererad från mallarna med ett tentanummer (frö). Samma nummer ger samma tenta,
     så kurskamrater kan skriva samma tenta genom att dela numret.
   - 'fast':  kursens exempeltenta (EXAM i tenta.js). */
const exam = {
  mode: storage.get('exam-mode', 'slump'),
  seed: storage.get('exam-seed', null),
  questions: [],
  extras: [],
};
const examKey = () => (exam.mode === 'fast' ? 'fast' : 'nr' + exam.seed);
let savedAnswers = {};

const newSeed = () => 100000 + Math.floor(Math.random() * 900000);

// Bygger aktuell tenta. Faller tillbaka på den fasta tentan om mallarna saknas.
function buildExam() {
  if (exam.mode === 'slump' && (templateStore.G.length && templateStore.VG.length)) {
    if (!exam.seed) exam.seed = newSeed();
    let generated = generateExam(exam.seed);
    for (let tries = 0; !generated && tries < 5; tries++) { exam.seed = newSeed(); generated = generateExam(exam.seed); }
    if (generated) {
      exam.questions = generated.questions;
      exam.extras = generated.extras;
      storage.set('exam-seed', exam.seed);
    } else {
      exam.mode = 'fast';
    }
  } else {
    exam.mode = 'fast';
  }
  if (exam.mode === 'fast') { exam.questions = EXAM; exam.extras = EXTRA; }
  storage.set('exam-mode', exam.mode);
  savedAnswers = storage.get('answers-' + examKey(), {});
  examMessage = EXAM_TEXTS.intro;
  examMessageEn = EXAM_TEXTS_EN.intro;
}
let examMessage = EXAM_TEXTS.intro;        // svensk text (visas i pratbubblan)
let examMessageEn = EXAM_TEXTS_EN.intro;   // engelsk uppläsning vid behov

const answerId = (question, fieldNo) => `ex-${question.n}-${fieldNo}`;
const sumPoints = questions => questions.reduce((sum, q) => sum + q.p, 0);

function questionHTML(question, isExtra) {
  const label = isExtra ? 'Extra ' + question.n.slice(1) : question.n + '.';
  return `<div class="q" id="q-${question.n}">
    <div class="qtop">
      <span class="qn">${label}</span>
      <span class="pts" id="pts-${question.n}">${isExtra ? 'utan poäng' : question.p + ' p'}</span>
    </div>
    <p>${question.q}</p>
    ${question.u || ''}
    ${question.f.map((f, k) => fieldHTML(f, answerId(question, k), savedAnswers[answerId(question, k)] || '')).join('')}
    ${workingHTML(question.n, savedAnswers['rw-' + question.n] || '')}
    <div class="btnrow"><span class="result" id="result-${question.n}"></span></div>
    <div class="btnrow ${isExtra ? '' : 'hidden'}" id="tools-${question.n}">
      <button class="btn ghost" data-solution="${question.n}">Visa lösning</button>
      ${isExtra ? `<button class="btn ghost" data-check="${question.n}">Kontrollera</button>` : ''}
      <button class="btn ghost" data-repeat="${question.ch}">Repetera i lektionen</button>
    </div>
    <div class="sol hidden" id="solution-${question.n}">${question.s}</div>
  </div>`;
}

function renderExam() {
  const part1 = exam.questions.filter(q => q.part === 1);
  const part2 = exam.questions.filter(q => q.part === 2);
  const generated = exam.mode === 'slump';

  $('#exam').innerHTML = `
    <div class="examhead">
      <div class="eyebrow">Övningstenta · bygg- och ingenjörsmatematik</div>
      <h2>${KURS.namn}${generated ? ` <small class="examno">Tenta nr ${exam.seed}</small>` : ''}</h2>
      <div class="exam-choose">
        <button class="btn primary" id="exam-new">＋ Ny slumpad tenta</button>
        <span class="exam-open">
          <label for="exam-seed">Tentanummer</label>
          <input id="exam-seed" inputmode="numeric" maxlength="6" placeholder="t.ex. 482913" value="${generated ? exam.seed : ''}">
          <button class="btn" id="exam-load">Öppna</button>
        </span>
        <button class="btn ghost" id="exam-fixed"${generated ? '' : ' disabled'}>Kursens exempeltenta</button>
      </div>
      <p class="note">${generated
        ? `Slumpad från ${templateStore.G.length} G-mallar och ${templateStore.VG.length} VG-mallar. Dela tentanumret så får kurskamraterna exakt samma tenta.`
        : 'Det här är den fasta exempeltentan. Tryck på Ny slumpad tenta för att få nya uppgifter.'}</p>
      <dl class="meta">
        <div><dt>Skrivtid</dt><dd>${KURS.skrivtidMinuter} minuter</dd></div>
        <div><dt>Poäng</dt><dd>${sumPoints(exam.questions)} p</dd></div>
        <div><dt>Hjälpmedel</dt><dd>Miniräknare och formelblad</dd></div>
        <div><dt>Redovisning</dt><dd>Formel, insättning, mellanled, svar med enhet</dd></div>
      </dl>
      <p class="note">Rättningen jämför bara dina slutsvar. På riktiga tentan krävs även redovisning för full poäng. Skriv decimaler med komma eller punkt.</p>
    </div>

    <div class="partttl">Del 1 · G-nivå <small>${part1.length} uppgifter · ${sumPoints(part1)} p</small></div>
    ${part1.map(q => questionHTML(q)).join('')}

    <div class="partttl">Del 2 · VG-nivå <small>${part2.length} uppgifter · ${sumPoints(part2)} p</small></div>
    ${part2.map(q => questionHTML(q)).join('')}

    <div class="btnrow">
      <button class="btn primary" id="grade">Rätta tentan</button>
      <button class="btn ghost" id="clear">Rensa mina svar</button>
    </div>
    <div id="score"></div>

    <div class="partttl">Extrauppgifter <small>utan poäng · rättas en och en</small></div>
    ${exam.extras.map(q => questionHTML(q, true)).join('')}`;

  $('#bubble-exam').innerHTML = toParagraphs(examMessage);
}

function setupExamControls() {
  const examBox = $('#exam');

  // Spara svaren medan man skriver
  const save = e => {
    if (e.target.id && (e.target.id.startsWith('ex-') || e.target.id.startsWith('rw-'))) {
      savedAnswers[e.target.id] = e.target.value;
      storage.set('answers-' + examKey(), savedAnswers);
    }
  };
  examBox.addEventListener('input', save);
  examBox.addEventListener('change', save);
  examBox.addEventListener('input', e => { if (e.target.id === 'exam-seed') e.target.setCustomValidity(''); });
  examBox.addEventListener('keydown', e => { if (e.target.id === 'exam-seed' && e.key === 'Enter') $('#exam-load').click(); });

  examBox.addEventListener('click', e => {
    const button = e.target.closest('button');
    if (!button) return;

    if (button.dataset.solution) $('#solution-' + button.dataset.solution).classList.toggle('hidden');

    if (button.dataset.check) {
      const question = exam.extras.find(q => q.n === button.dataset.check);
      question.f.forEach((f, k) => checkField(f, answerId(question, k)));
      showWorkingResult(question);
    }

    if (button.dataset.repeat) {
      showView('lesson');
      goToLesson(button.dataset.repeat);
    }

    if (button.id === 'grade') gradeExam();
    if (button.id === 'exam-new') openExam('slump', newSeed());
    if (button.id === 'exam-fixed') openExam('fast');
    if (button.id === 'exam-load') {
      const n = parseInt($('#exam-seed').value, 10);
      if (n >= 100000 && n <= 999999) openExam('slump', n);
      else $('#exam-seed').setCustomValidity('Skriv ett sexsiffrigt tentanummer'), $('#exam-seed').reportValidity();
    }

    // Rensa kräver två klick så att man inte tappar svaren av misstag
    if (button.id === 'clear') {
      if (button.dataset.armed) {
        savedAnswers = {};
        storage.set('answers-' + examKey(), {});
        examMessage = EXAM_TEXTS.intro;
        examMessageEn = EXAM_TEXTS_EN.intro;
        renderExam();
      } else {
        button.dataset.armed = '1';
        button.textContent = 'Klicka igen för att rensa';
        setTimeout(() => { button.textContent = 'Rensa mina svar'; delete button.dataset.armed; }, 3000);
      }
    }
  });

  $('#speak-exam').onclick = () => {   // spelar det redan börjar det om från början
    if (isSpeaking()) stopSpeaking();
    speak(narration(examMessage, examMessageEn), $('#teacher-exam'));
  };
  $('#pause-exam').onclick = togglePause;
}

// Uppgifterna som blev fel vid senaste rättningen (används av repetitionen)
let lastWrongQuestions = [];

function gradeExam() {
  const scores = { 1: 0, 2: 0 };
  const weakChapters = new Set();
  let emptyFields = 0;
  let workingChecked = 0, workingComplete = 0;
  const wrong = [];

  for (const question of exam.questions) {
    let correctFields = 0;
    question.f.forEach((field, k) => {
      const value = $('#' + answerId(question, k)).value;
      if (!value) emptyFields++;
      const correct = checkField(field, answerId(question, k));
      if (correct) correctFields++;
    });

    // Poängen delas lika mellan svarsrutorna, avrundat till halva poäng
    const points = Math.round(question.p * correctFields / question.f.length * 2) / 2;
    scores[question.part] += points;
    if (points < question.p) { weakChapters.add(question.ch); wrong.push(question); }

    const box = $('#q-' + question.n);
    box.classList.remove('graded-full', 'graded-part', 'graded-zero');
    box.classList.add(points === question.p ? 'graded-full' : points > 0 ? 'graded-part' : 'graded-zero');
    $('#pts-' + question.n).textContent = `${swedishNumber(points)} / ${question.p} p`;
    $('#result-' + question.n).textContent = points === question.p ? 'Rätt svar' : points > 0 ? 'Delvis rätt' : 'Inte rätt ännu';
    $('#tools-' + question.n).classList.remove('hidden');
    const working = showWorkingResult(question);
    if (working !== null) { workingChecked++; if (working) workingComplete++; }
  }

  const max1 = sumPoints(exam.questions.filter(q => q.part === 1));
  const max2 = sumPoints(exam.questions.filter(q => q.part === 2));
  const total = scores[1] + scores[2];
  // Lektioner att repetera (bara de som finns bland de inlästa lektionerna)
  const repeat = [...weakChapters]
    .map(id => lessonStore.all.find(l => l.id === id))
    .filter(Boolean)
    .map(l => ({ id: l.id, t: l.titel, en: l.titelEn }));

  $('#score').innerHTML = `
    <div class="scorebox">
      <div class="eyebrow">Resultat</div>
      <div class="big">${swedishNumber(total)} / ${max1 + max2} p</div>
      <div class="bar"><span>Del 1 · G</span><span class="tr"><i style="width:${scores[1] / max1 * 100}%"></i></span><span>${swedishNumber(scores[1])} / ${max1}</span></div>
      <div class="bar"><span>Del 2 · VG</span><span class="tr"><i style="width:${scores[2] / max2 * 100}%"></i></span><span>${swedishNumber(scores[2])} / ${max2}</span></div>
      ${wrong.length
        ? `<p><b>Det här blev fel:</b></p>
           <ul class="wronglist">${wrong.map(q => `<li>Uppgift ${q.n} – ${escapeHtml(lessonTitle(q.ch))}</li>`).join('')}</ul>
           <div class="btnrow"><button class="btn primary" data-review="start">▶ Repetera bara de här avsnitten (${repeat.length})</button></div>
           <p class="note">Lektionsvyn visar då bara ${repeat.length === 1 ? 'det avsnittet' : 'de avsnitten'}, med minitentor. Sist kan du göra tentan igen.
             Enskilda avsnitt: ${repeat.map(c => `<button class="linkbtn" data-repeat="${c.id}">${escapeHtml(c.t)}</button>`).join(', ')}</p>`
        : '<p>Alla slutsvar stämmer. Kontrollera nu att din redovisning har formel, mellanled och enhet.</p>'}
      <p>${workingChecked
        ? `<b>Redovisning:</b> ${workingComplete} av ${workingChecked} skrivna redovisningar har formel, insättning, mellanled och svar med enhet.`
        : '<b>Redovisning:</b> skriv din uträkning i rutan under en uppgift så kontrolleras den också. På tentan kan en saknad redovisning kosta poäng även när svaret är rätt.'}</p>
      <p class="note">Betygsgränserna sätts av läraren. Sikta på i stort sett full pott på Del 1 och så många poäng som möjligt på Del 2.</p>
    </div>`;

  lastWrongQuestions = wrong;
  const fullScore = total === max1 + max2;
  examMessage = fullScore
    ? EXAM_TEXTS.fullScore(max1 + max2)
    : EXAM_TEXTS.result({
        total: swedishNumber(total), max: max1 + max2,
        part1: swedishNumber(scores[1]), part2: swedishNumber(scores[2]),
        empty: emptyFields,
        repeat: joinWords(repeat.map(c => c.t.toLowerCase().replace(/ & /g, ' och '))),
        wrongNos: joinWords(wrong.map(q => String(q.n))), wrongCount: wrong.length,
      });
  examMessageEn = fullScore
    ? EXAM_TEXTS_EN.fullScore(max1 + max2)
    : EXAM_TEXTS_EN.result({
        total, max: max1 + max2, part1: scores[1], part2: scores[2],
        empty: emptyFields,
        repeat: repeat.map(c => (c.en || c.t).toLowerCase()).join(', '),
        wrongNos: wrong.map(q => q.n).join(', '), wrongCount: wrong.length,
      });
  $('#bubble-exam').innerHTML = toParagraphs(examMessage);
  $('#score').scrollIntoView({ behavior: 'smooth', block: 'center' });
}


// Byter tenta och sparar valet. Tentanumret skrivs också i adressen (#tenta482913)
// så att länken går att dela.
function openExam(mode, seed) {
  stopSpeaking();
  exam.mode = mode;
  if (seed) exam.seed = seed;
  buildExam();
  renderExam();
  try { history.replaceState(null, '', exam.mode === 'slump' ? '#tenta' + exam.seed : '#'); } catch (e) { /* ignorera */ }
  window.scrollTo({ top: 0 });
}

/* ---------- Skrivtidsklocka ----------
   Starttiden sparas, så klockan fortsätter även om sidan laddas om. */

const timer = {
  startedAt: storage.get('timer-start', null),
  interval: null,
  durationMs: KURS.skrivtidMinuter * 60 * 1000,
};

function formatTime(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor(ms % 3600000 / 60000);
  const s = Math.floor(ms % 60000 / 1000);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimer() {
  if (!timer.startedAt) { $('#timer').textContent = formatTime(timer.durationMs); return; }
  const left = timer.durationMs - (Date.now() - timer.startedAt);
  if (left <= 0) {
    $('#timer').textContent = 'Tiden är ute';
    clearInterval(timer.interval);
    return;
  }
  $('#timer').textContent = formatTime(left);
}

function startTimer() {
  if (!timer.startedAt) {
    timer.startedAt = Date.now();
    storage.set('timer-start', timer.startedAt);
  }
  clearInterval(timer.interval);
  timer.interval = setInterval(updateTimer, 1000);
  updateTimer();
  $('#timer-start').textContent = 'Klockan går';
  $('#timer-start').disabled = true;
}

function resetTimer() {
  timer.startedAt = null;
  storage.set('timer-start', null);
  clearInterval(timer.interval);
  updateTimer();
  $('#timer-start').textContent = 'Starta klockan';
  $('#timer-start').disabled = false;
}


