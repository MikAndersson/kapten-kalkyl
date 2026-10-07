/* ---------- Formelbladet ----------
   Lärarens formelblad (src/formelblad/formelblad.html) byggs in i sidan av build.py
   som strängen FORMELBLAD_HTML och visas i en ram (iframe) på baksidan av lektions-
   respektive tentafönstret. Fönstret vänds som ett kort (flip) mellan framsidan
   (bilden eller tentan) och formelbladet.
     - Under övningstentan visas hela bladet.
     - Under minitentorna visas bara korten som hör till avsnittet (KURS.formelbladKort).
       Har avsnittet inga kort visas hela bladet.
     - På vanliga lektionsbilder är knappen avstängd. Där visar övningsfrågorna i stället
       just den formel som behövs (<testa formelblad="f-…">, se renderQuiz).
   Samma knapp (📐 Formelblad i högerkolumnen, eller tangenten F) vänder fram och
   tillbaka. Esc vänder också tillbaka. När bladet vänds tillbaka hamnar man på samma
   ställe på sidan och i samma svarsruta som innan. */

const sheet = {
  open: null,        // 'lesson' eller 'exam' när bladet visas, annars null
  busy: false,       // en vändning pågår
  ready: {},         // vilka ramar som har laddat: { lesson: true, exam: true }
  scrollY: 0,        // var på sidan man var innan bladet vändes fram
  lastField: {},     // senaste svarsrutan med markören, per vy
};

const hasFormelblad = () => typeof FORMELBLAD_HTML === 'string';
const FLIP_MS = 300;   // varje halva av vändningen

const sheetFace = view => $('#fb-face-' + view);
const sheetFrame = view => sheetFace(view).querySelector('.fb-frame');
const sheetFront = view => (view === 'exam' ? $('#exam') : $('#board'));

// Formelbladet finns under tentan och minitentorna. Svarar 'exam', 'lesson' eller null.
function sheetContext() {
  if (!hasFormelblad()) return null;
  if (currentView() === 'exam') return 'exam';
  return slides[slideIndex] && slides[slideIndex].mini ? 'lesson' : null;
}

// Avsnittets kort, eller null för hela bladet
function sheetCards(view) {
  if (view !== 'lesson') return null;
  const lesson = slides[slideIndex] && slides[slideIndex].lesson;
  const cards = lesson && (KURS.formelbladKort || {})[lesson.id];
  return cards && cards.length ? cards : null;
}

function sendSheetCards(view) {
  const frame = sheetFrame(view);
  if (sheet.ready[view] && frame.contentWindow) frame.contentWindow.postMessage({ formelblad: 'visa', kort: sheetCards(view) }, '*');
}

function updateSheetBar(view) {
  const face = sheetFace(view);
  const lesson = slides[slideIndex] && slides[slideIndex].lesson;
  const hasCards = view === 'lesson' && lesson && !!(KURS.formelbladKort || {})[lesson.id];
  face.querySelector('.fb-heading').textContent =
    hasCards ? `Det som hör till ${lesson.titel.replace(/&amp;/g, '&')}` : 'Hela formelbladet';
}

// Knapparnas text: samma knapp öppnar och stänger
function updateSheetButtons() {
  const usable = !!sheetContext();
  $$('[data-fb-toggle]').forEach(b => {
    const open = !!sheet.open;
    b.disabled = !usable && !open;
    b.title = b.disabled ? 'Formelbladet finns under minitentorna och övningstentan' : 'Formelblad (F)';
    b.setAttribute('aria-pressed', open);
    b.classList.toggle('on', open);
    if (b.classList.contains('fb-toggle')) b.textContent = open ? `✕ Stäng formelbladet` : '📐 Formelblad';
    else b.textContent = open ? '✕' : '📐';
    b.setAttribute('aria-label', open ? 'Stäng formelbladet' : 'Visa formelbladet');
  });
}

// Anropas när en ny bild visas: stäng bladet om bilden inte är en minitenta, annars uppdatera korten
function updateSheetButton() {
  if (sheet.open === 'lesson') {
    if (sheetContext() !== 'lesson') closeSheet(true);
    else { updateSheetBar('lesson'); sendSheetCards('lesson'); }
  }
  updateSheetButtons();
}

// Halva vändningen: element roterar ut till 90° eller in från 90°
function flipHalf(el, out, dir) {
  // Vrid runt mitten av den del av fönstret som syns (tentan kan vara mycket högre än skärmen)
  const r = el.getBoundingClientRect();
  const middle = (Math.max(r.top, 0) + Math.min(r.bottom, innerHeight)) / 2 - r.top;
  el.style.transformOrigin = `50% ${Math.round(middle)}px`;
  const edge = `perspective(1800px) rotateY(${dir * 90}deg) scale(.92)`;
  const flat = 'perspective(1800px) rotateY(0deg) scale(1)';
  return el.animate(out ? [{ transform: flat }, { transform: edge }] : [{ transform: edge.replace(`${dir * 90}deg`, `${-dir * 90}deg`) }, { transform: flat }],
    { duration: FLIP_MS, easing: out ? 'cubic-bezier(.55,0,.85,.35)' : 'cubic-bezier(.15,.65,.45,1)' }).finished;
}

async function flip(view, toSheet) {
  const front = sheetFront(view), face = sheetFace(view);
  const from = toSheet ? front : face, to = toSheet ? face : front;
  const card = $('#flip-' + view);
  const animate = !matchMedia('(prefers-reduced-motion: reduce)').matches && typeof from.animate === 'function';
  const dir = toSheet ? 1 : -1;
  card.classList.add('flipping');
  if (animate) await flipHalf(from, true, dir).catch(() => {});
  from.classList.add('flip-hidden');
  to.classList.remove('flip-hidden');
  if (toSheet) {
    // Se till att hela bladet syns: rulla upp till fönstrets överkant om den är utanför skärmen
    const top = card.getBoundingClientRect().top;
    if (top < 0 || top > innerHeight * 0.4) window.scrollTo({ top: scrollY + top - 10 });
  } else {
    window.scrollTo({ top: sheet.scrollY });
  }
  if (animate) await flipHalf(to, false, dir).catch(() => {});
  card.classList.remove('flipping');
}

async function openSheet() {
  const view = sheetContext();
  if (!view || sheet.open || sheet.busy) return;
  sheet.busy = true;
  sheet.open = view;
  sheet.scrollY = scrollY;
  const frame = sheetFrame(view);
  if (!frame.srcdoc) frame.srcdoc = FORMELBLAD_HTML;   // laddas första gången bladet visas
  else sendSheetCards(view);
  updateSheetBar(view);
  updateSheetButtons();
  await flip(view, true);
  sheet.busy = false;
  // Stängdes bladet medan det vändes fram (t.ex. byte till en annan flik)? Vänd tillbaka direkt.
  if (sheet.open !== view) {
    sheetFace(view).classList.add('flip-hidden');
    sheetFront(view).classList.remove('flip-hidden');
  }
}

async function closeSheet(instant) {
  const view = sheet.open;
  if (!view || (sheet.busy && !instant)) return;
  sheet.busy = true;
  sheet.open = null;
  updateSheetButtons();
  if (instant) {
    sheetFace(view).classList.add('flip-hidden');
    sheetFront(view).classList.remove('flip-hidden');
    sheet.busy = false;
    return;
  }
  await flip(view, false);
  sheet.busy = false;
  // Tillbaka till svarsrutan man var i
  const field = sheet.lastField[view];
  if (!instant && field && document.contains(field) && field.offsetParent !== null) field.focus({ preventScroll: true });
}

const toggleSheet = () => (sheet.open ? closeSheet() : openSheet());

function setupFormelblad() {
  if (!hasFormelblad()) {
    $$('[data-fb-toggle]').forEach(b => b.remove());
    return;
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-fb-toggle]')) toggleSheet(); });
  // Kom ihåg senaste svarsrutan i varje vy
  for (const view of ['lesson', 'exam']) {
    sheetFront(view).addEventListener('focusin', e => {
      if (e.target.matches('.field input, .field select')) sheet.lastField[view] = e.target;
    });
  }
  window.addEventListener('message', e => {
    if (!e.data || !e.data.formelblad) return;
    const view = ['lesson', 'exam'].find(v => sheetFrame(v).contentWindow === e.source);
    if (!view) return;
    if (e.data.formelblad === 'redo') { sheet.ready[view] = true; sendSheetCards(view); }
    if (e.data.formelblad === 'stang' || e.data.formelblad === 'svep') closeSheet();
  });
  updateSheetButtons();
}
