/* ---------- Uppläsning ----------
   Använder webbläsarens inbyggda talsyntes (Web Speech API).
   Texten läses mening för mening, så att paus kan återuppta från rätt mening.
   Saknar enheten svensk röst används en engelsk röst och de engelska texterna
   (<berattare sprak="en">). Första gången sägs ENGLISH_NOTICE först.

   Anpassningar för mobiler (Android/iOS):
   - Första meningen startas direkt i klickhändelsen (krav på iPhone/iPad).
   - Den aktuella meningen sparas i en variabel. Annars kan Chrome på Android
     slänga den i förtid och då kommer aldrig "klar"-signalen.
   - En vakthund kontrollerar varje halvsekund om talet tystnat utan signal
     och går i så fall vidare till nästa mening.
   - Språkkoder som "sv_SE" (Android) tolkas lika som "sv-SE". */

const ENGLISH_NOTICE = 'The Swedish voice package is not installed on this device. ' +
  'If you want to hear the lesson in Swedish, install Swedish as a speech language in your settings and restart the browser. ' +
  'For now, here is the lesson in English.';

const synth = window.speechSynthesis || null;
let voices = [];
let chosenVoice = null;
let hasSwedishVoice = false;
let englishNoticeGiven = false;

const voiceLang = voice => (voice && voice.lang ? voice.lang : '').replace('_', '-').toLowerCase();
const isSwedish = voice => voiceLang(voice).startsWith('sv');
const isEnglish = voice => voiceLang(voice).startsWith('en');

const speech = {
  run: 0,           // ökas vid varje start/stopp så att gamla händelser ignoreras
  sentences: [],
  index: 0,
  card: null,       // lärarpanelen som pratar (för munrörelsen)
  onDone: null,
  paused: false,
  current: null,    // aktuell mening (behålls så att Android inte slänger den)
  watchdog: null,
};

// Vilket språk uppläsningen ska ske på, utifrån vald röst.
function speechLanguage() {
  if (!voices.length) return 'sv';
  return chosenVoice && isSwedish(chosenVoice) ? 'sv' : 'en';
}

// Väljer svensk eller engelsk text beroende på röst.
function narration(swedishText, englishText) {
  if (speechLanguage() === 'sv') return swedishText;
  let text = englishText || swedishText;
  if (!hasSwedishVoice && !englishNoticeGiven) {
    englishNoticeGiven = true;
    text = ENGLISH_NOTICE + ' ' + text;
  }
  return text;
}

function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices() || [];
  const swedish = voices.filter(isSwedish);
  const english = voices.filter(isEnglish);
  const others = voices.filter(v => !isSwedish(v) && !isEnglish(v));
  const saved = storage.get('voice', '');
  const best = list => list.find(v => /natural|neural|online|google|enhanced|premium/i.test(v.name)) || list[0];

  hasSwedishVoice = swedish.length > 0;
  chosenVoice = voices.find(v => v.name === saved) || best(swedish) || best(english) || null;

  const group = (label, list) =>
    list.length ? `<optgroup label="${label}">${list.map(v => `<option>${escapeHtml(v.name)}</option>`).join('')}</optgroup>` : '';
  const select = $('#voice');
  select.innerHTML = group('Svenska', swedish) + group('Engelska', english) + group('Övriga', others)
    || '<option value="">standardröst</option>';
  if (chosenVoice) select.value = chosenVoice.name;
  updateVoiceNote();
}

function updateVoiceNote(message) {
  let note = 'Piltangenterna bläddrar, mellanslag pausar.';
  if (message) note = message;
  else if (voices.length && !hasSwedishVoice) {
    note = 'Ingen svensk röst hittades, så Kapten Kalkyl läser upp lektionen på engelska. ' +
           'Vill du höra den på svenska: installera svenska som talspråk i enhetens inställningar och starta om webbläsaren.';
  } else if (speechLanguage() === 'en') {
    note = 'Du har valt en engelsk röst, så uppläsningen sker på engelska.';
  }
  $('#voice-note').textContent = note;
}

/* ----- Munnen -----
   Medan Kapten Kalkyl pratar byter munnen slumpvis grimas (vrål-O, gapskratt,
   hånflin), huvudet gungar och ibland glider solglasögonen ner så
   att han glor över dem. Med "minska rörelse" i systemet blir det lugnt. */
const MOUTH_SHAPES = ['o', 'grin', 'smirk'];
const calmMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let mouthTimer = null;
let glassesTimer = null;

function setMouth(svg, shape, transform = '') {
  svg.setAttribute('data-mouth-shape', shape);
  svg.style.transform = transform;
}

function animateMouth() {
  clearTimeout(mouthTimer);
  const svg = speech.card && speech.card.querySelector('.who svg');
  if (!svg) return;
  const calm = calmMotion();
  if (speech.paused) {
    setMouth(svg, 'rest');
  } else {
    const current = svg.getAttribute('data-mouth-shape');
    // Ibland en kort paus med stängd mun, annars en ny grimas än den förra
    const options = Math.random() < 0.1 ? ['rest'] : MOUTH_SHAPES.filter(s => s !== current);
    const shape = options[Math.floor(Math.random() * options.length)];
    let transform = '';
    if (!calm) {
      const tilt = Math.random() * 16 - 8;                  // lutar huvudet ±8°
      const lift = -(Math.random() * 6);                    // hoppar upp till 6 px
      const pop = Math.random() < 0.15 ? 1.1 : 1;           // ibland ett litet "pang"
      transform = `rotate(${tilt.toFixed(1)}deg) translateY(${lift.toFixed(1)}px) scale(${pop})`;
    }
    setMouth(svg, shape, transform);

    // Solglasögonen glider ner då och då, och blicken flackar
    if (!calm && !glassesTimer && Math.random() < 0.012) {   // ungefär var 12:e sekund
      svg.setAttribute('data-glasses', 'down');
      svg.setAttribute('data-look', ['left', 'right', ''][Math.floor(Math.random() * 3)]);
      glassesTimer = setTimeout(() => {
        svg.removeAttribute('data-glasses');
        svg.removeAttribute('data-look');
        glassesTimer = null;
      }, 700 + Math.random() * 500);
    }
  }
  const delay = calm ? 380 : 80 + Math.random() * 160;
  mouthTimer = setTimeout(animateMouth, delay);
}

function stopMouth() {
  clearTimeout(mouthTimer);
  clearTimeout(glassesTimer);
  glassesTimer = null;
  $$('.who svg').forEach(svg => {
    setMouth(svg, 'rest');
    svg.removeAttribute('data-glasses');
    svg.removeAttribute('data-look');
  });
}

function speak(text, card, onDone) {
  if (!synth) return;
  if (!voices.length) loadVoices();            // vissa mobiler laddar rösterna först vid klick
  const wasBusy = synth.speaking || synth.pending;
  stopSpeaking();
  speech.sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  speech.index = 0;
  speech.card = card;
  speech.onDone = onDone || null;
  card.classList.add('speaking');
  updateSpeechButtons();
  animateMouth();
  // Starta direkt (krav på iPhone). Bara om något nyss avbröts väntar vi lite,
  // eftersom Chrome annars kan tappa en mening som startas direkt efter cancel().
  if (wasBusy) speakSoon(); else speakNextSentence();
}

function speakSoon() {
  const run = speech.run;
  setTimeout(() => {
    if (run === speech.run && speech.card && !speech.paused) speakNextSentence();
  }, 200);
}

function speakNextSentence() {
  const run = ++speech.run;
  clearInterval(speech.watchdog);
  if (speech.index >= speech.sentences.length) {
    const done = speech.onDone;
    finishSpeaking();
    if (done) done();
    return;
  }
  if (synth.paused) synth.resume();

  const utterance = new SpeechSynthesisUtterance(speech.sentences[speech.index]);
  utterance.lang = chosenVoice ? chosenVoice.lang.replace('_', '-') : (speechLanguage() === 'sv' ? 'sv-SE' : 'en-GB');
  if (chosenVoice) utterance.voice = chosenVoice;
  utterance.rate = parseFloat($('#rate').value) || 1;

  let finished = false;
  const next = () => {
    if (finished || run !== speech.run || speech.paused) return;
    finished = true;
    clearInterval(speech.watchdog);
    speech.index++;
    speakNextSentence();
  };
  utterance.onend = next;
  utterance.onerror = event => {
    if (run !== speech.run) return;
    if (event.error === 'not-allowed') {
      finishSpeaking();
      updateVoiceNote('Webbläsaren tillät inte uppläsning. Tryck på Läs upp igen.');
      return;
    }
    if (event.error !== 'interrupted' && event.error !== 'canceled') next();
  };
  speech.current = utterance;
  synth.speak(utterance);

  // Vakthund: om talet har tystnat utan att "klar" kom, gå vidare.
  // Har webbläsaren aldrig rapporterat att den pratar används en beräknad
  // längsta tid för meningen (ca 0,09 s per tecken) i stället.
  const startedAt = Date.now();
  const maxMs = (utterance.text.length * 90) / utterance.rate + 2000;
  let sawSpeaking = false;
  speech.watchdog = setInterval(() => {
    if (run !== speech.run || speech.paused) { clearInterval(speech.watchdog); return; }
    if (synth.speaking) sawSpeaking = true;
    const silent = !synth.speaking && !synth.pending;
    if ((sawSpeaking && silent) || Date.now() - startedAt > maxMs) next();
  }, 500);
}

function togglePause() {
  if (!speech.card) return;
  speech.paused = !speech.paused;
  speech.card.classList.toggle('paused', speech.paused);
  if (speech.paused) {
    speech.run++;              // den avbrutna meningen ska inte räknas som klar
    clearInterval(speech.watchdog);
    synth.cancel();
  } else {
    speakNextSentence();       // börjar om på meningen där pausen gjordes (direkt i klicket)
    animateMouth();
  }
  updateSpeechButtons();
}

function finishSpeaking() {
  clearInterval(speech.watchdog);
  stopMouth();
  if (speech.card) speech.card.classList.remove('speaking', 'paused');
  speech.card = null;
  speech.current = null;
  speech.paused = false;
  updateSpeechButtons();
}

function stopSpeaking() {
  speech.run++;
  if (synth) synth.cancel();
  finishSpeaking();
}

const isSpeaking = () => speech.card !== null;

function updateSpeechButtons() {
  for (const id of ['#speak-lesson', '#speak-exam', '#mb-speak']) {
    const b = $(id);
    if (b) b.textContent = isSpeaking() ? '■ Stoppa' : '▶ Läs upp';
  }
  for (const id of ['#pause-lesson', '#pause-exam', '#mb-pause']) {
    const b = $(id);
    if (!b) continue;
    b.disabled = !isSpeaking();
    b.textContent = id === '#mb-pause' ? (speech.paused ? '▶' : '❚❚') : (speech.paused ? '▶ Fortsätt' : '❚❚ Paus');
  }
}

function setupSpeech() {
  if (!synth) {
    ['#speak-lesson', '#speak-exam', '#autoplay'].forEach(id => { $(id).disabled = true; });
    updateVoiceNote('Den här webbläsaren saknar uppläsning. Läs Kapten Kalkyls text i pratbubblan.');
    return;
  }
  loadVoices();
  if ('onvoiceschanged' in synth) synth.onvoiceschanged = loadVoices;
  setTimeout(loadVoices, 1000);   // reserv för webbläsare som inte skickar onvoiceschanged

  $('#voice').onchange = e => {
    stopSpeaking();
    chosenVoice = voices.find(v => v.name === e.target.value) || null;
    storage.set('voice', e.target.value);
    updateVoiceNote();
  };
  $('#pause-lesson').onclick = togglePause;
  $('#pause-exam').onclick = togglePause;
  // Stoppa uppläsningen om sidan göms (t.ex. mobilen låses)
  document.addEventListener('visibilitychange', () => { if (document.hidden && isSpeaking() && !speech.paused) togglePause(); });
}
