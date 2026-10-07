/* ---------- Tangentbordet ----------
   Står markören INTE i en svarsruta:
     - mellanslag   startar, pausar och fortsätter uppläsningen
     - ← →          bläddrar mellan bilderna i lektionen
     - siffror, minus, komma eller punkt   hoppar till första obesvarade
       svarsrutan (i bilden, minitentan eller tentan) och börjar skriva där
     - F            vänder fram och tillbaka formelbladet (minitentor och tentan), Esc vänder tillbaka
   Står markören i en svarsruta:
     - Enter        rättar övningsuppgiften om alla dess rutor är ifyllda och
                    hoppar vidare till nästa obesvarade ruta. Finns ingen kvar
                    släpps markören, så att mellanslag och pilar styr Kapten igen.
     - Esc          släpper markören från rutan.
   Mellanslag och pilar fungerar alltså som vanligt i rutorna (för att skriva). */

// Element där tangenterna ska skriva text och inte styra Kapten Kalkyl
const isTextEntry = el => !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable ||
  (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(el.type)));

const ANSWER_KEY = /^[0-9,.\-−]$/;

// Svarsrutorna som syns just nu, i ordning uppifrån och ner
function visibleAnswerFields() {
  const area = currentView() === 'exam' ? $('#exam') : $('#board');
  return [...area.querySelectorAll('.field input, .field select')].filter(el => el.offsetParent !== null && !el.disabled);
}

const isEmpty = el => !String(el.value).trim();

function focusField(el) {
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// Alla rutor i en grupp (en övningsuppgift eller extrauppgift) är ifyllda
const allFilled = group => [...group.querySelectorAll('.field input, .field select')].every(el => !isEmpty(el));

// Enter i en svarsruta: rätta det som går att rätta och gå vidare till nästa obesvarade ruta
function answerEntered(field) {
  const quiz = field.closest('.quiz');
  if (quiz && allFilled(quiz)) {
    const check = quiz.querySelector('[data-action="check-quiz"]');
    if (check) check.click();
  }
  const extra = field.closest('.q');
  const extraCheck = extra && extra.querySelector('[data-check]');
  if (extraCheck && allFilled(extra)) extraCheck.click();

  const fields = visibleAnswerFields();
  const index = fields.indexOf(field);
  const next = fields.slice(index + 1).find(isEmpty) || fields.slice(0, index).find(isEmpty);
  if (next) {
    focusField(next);
  } else {
    field.blur();
    // Sista rutan i minitentan: rätta hela minitentan
    if (field.closest('.mini')) { const button = $('[data-mini="check"]'); if (button) button.click(); }
  }
}

/* ----- "Spela upp allt": gå vidare 2 sekunder efter att alla uppgifter besvarats rätt ----- */
const AUTO_ADVANCE_MS = 2000;
let autoAdvanceTimer = null;

function cancelAutoAdvance() {
  clearTimeout(autoAdvanceTimer);
  autoAdvanceTimer = null;
}

// Anropas när en uppgift rättats. Är alla rutor på bilden rätt besvarade och "Spela upp allt"
// ikryssad bläddrar Kapten vidare efter 2 sekunder (efter att han pratat klart).
// Är något svar fel stannar han kvar.
function maybeAutoAdvance() {
  if (currentView() !== 'lesson' || !$('#autoplay').checked) return;
  const fields = visibleAnswerFields();
  if (!fields.length || fields.some(isEmpty) || slideIndex >= slides.length - 1) return;
  cancelAutoAdvance();
  $$('#bubble-lesson .auto-next').forEach(n => n.remove());
  // Bara när allt är rätt. Är något fel stannar Kapten kvar så att man kan rätta till det.
  const boxes = fields.map(f => f.closest('.field'));
  if (!boxes.every(b => b && b.classList.contains('ok'))) {
    if (boxes.some(b => b && b.classList.contains('bad')) && !$('#board .mini')) {   // minitentan har egen återkoppling
      const note = document.createElement('p');
      note.className = 'note auto-next';
      note.textContent = 'Något blev fel, så vi stannar här. Ändra svaret och rätta igen, eller titta på lösningen och bläddra vidare själv.';
      $('#bubble-lesson').append(note);
    }
    return;
  }
  const from = slideIndex;
  const tick = () => {
    if (!$('#autoplay').checked || slideIndex !== from || currentView() !== 'lesson') return cancelAutoAdvance();
    if (isSpeaking()) { autoAdvanceTimer = setTimeout(tick, 500); return; }   // vänta tills han pratat klart
    autoAdvanceTimer = null;
    goToSlide(from + 1);
  };
  autoAdvanceTimer = setTimeout(tick, AUTO_ADVANCE_MS);
  const note = document.createElement('p');
  note.className = 'note auto-next';
  note.textContent = 'Vi går vidare till nästa bild om 2 sekunder … (bocka ur "Spela upp allt" för att stanna)';
  $('#bubble-lesson').append(note);
}

function toggleNarration() {
  if (isSpeaking()) togglePause();
  else if (currentView() === 'lesson') readCurrentSlide();
  else $('#speak-exam').click();
}

function setupKeyboard() {
  // Rättning med knapparna räknas också som "svarat"
  $('#board').addEventListener('click', e => {
    if (e.target.closest('[data-action="check-quiz"], [data-mini="check"]')) setTimeout(maybeAutoAdvance, 0);
  });

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const el = document.activeElement;

    // Formelbladet: F öppnar och stänger, Esc stänger. Medan det är öppet bläddrar pilarna inte i lektionen.
    if (sheet.open && (e.key === 'Escape' || ((e.key === 'f' || e.key === 'F') && !isTextEntry(el)))) { e.preventDefault(); closeSheet(); return; }
    if ((e.key === 'f' || e.key === 'F') && !isTextEntry(el) && sheetContext()) { e.preventDefault(); openSheet(); return; }
    if (sheet.open && e.key !== ' ') return;

    if (isTextEntry(el)) {
      if (e.key === 'Escape') { el.blur(); return; }
      if (e.key === 'Enter' && el.matches('.field input, .field select')) {
        e.preventDefault();
        answerEntered(el);
      }
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      if (el && el.tagName === 'BUTTON') el.blur();   // mellanslag ska inte "klicka" igen på knappen man nyss tryckte på
      toggleNarration();
      return;
    }
    if (currentView() === 'lesson' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      goToSlide(slideIndex + (e.key === 'ArrowRight' ? 1 : -1));
      return;
    }
    if (ANSWER_KEY.test(e.key)) {
      const target = visibleAnswerFields().find(f => f.tagName === 'INPUT' && isEmpty(f));
      if (!target) return;
      e.preventDefault();
      focusField(target);
      target.value = e.key === '−' ? '-' : e.key;
      target.dispatchEvent(new Event('input', { bubbles: true }));   // sparar svaret i tentan
    }
  });
}
