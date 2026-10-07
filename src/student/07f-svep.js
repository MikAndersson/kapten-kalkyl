/* ---------- Svep på pekskärm ----------
   - I lektionen: svep åt vänster = nästa bild, svep åt höger = föregående bild.
   - Under minitentorna och övningstentan: svep (åt något håll) vänder mellan
     uppgifterna och formelbladet. Inne i formelbladet (en egen ram) skickar
     bladets skript ett meddelande som vänder tillbaka (se build.py).
   Ett svep räknas när fingret dragits minst SWIPE.min pixlar i sidled, mest i
   sidled (inte uppåt/nedåt) och snabbare än SWIPE.maxMs. Svep som börjar i en
   svarsruta, ett reglage, kapitellistan eller något som rullar i sidled räknas inte,
   och inte heller svep från skärmens kant (där webbläsaren har sin egen "bakåt"). */

const SWIPE = { min: 60, ratio: 1.5, maxMs: 800, edge: 24, start: 12 };
let swipe = null;

// Element där ett svep inte ska tolkas (man skriver, drar i ett reglage eller rullar i sidled)
function swipeBlocked(el) {
  for (; el && el !== document.body; el = el.parentElement) {
    if (el.matches('input, textarea, select, [contenteditable="true"], [data-no-swipe], .widget, .chapters, .tabs')) return true;
    const overflow = getComputedStyle(el).overflowX;
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollWidth > el.clientWidth + 2) return true;
  }
  return false;
}

// Det som följer med fingret: bilden/tentan, eller formelbladet om det är framme
function swipeTarget() {
  const view = currentView();
  if (sheet.open) return sheetFace(sheet.open);
  return sheetFront(view);
}

function swipeStart(e) {
  const t = e.touches[0];
  swipe = null;
  if (e.touches.length !== 1 || sheet.busy || swipeBlocked(e.target)) return;
  if (t.clientX < SWIPE.edge || t.clientX > innerWidth - SWIPE.edge) return;
  swipe = { x: t.clientX, y: t.clientY, time: Date.now(), dragging: false, el: swipeTarget() };
}

function swipeMove(e) {
  if (!swipe) return;
  const t = e.touches[0];
  const dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
  if (!swipe.dragging) {
    if (Math.abs(dy) > SWIPE.start && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; }   // man rullar uppåt/nedåt
    if (Math.abs(dx) < SWIPE.start || Math.abs(dx) < SWIPE.ratio * Math.abs(dy)) return;
    swipe.dragging = true;
  }
  // Lite motstånd: innehållet följer med en bit av vägen
  swipe.el.style.transform = `translateX(${(dx * 0.35).toFixed(1)}px)`;
  swipe.el.style.opacity = String(Math.max(0.6, 1 - Math.abs(dx) / 900));
}

function resetSwipeStyle(el, animate) {
  if (!el) return;
  if (animate && el.animate && el.style.transform) {
    el.animate([{ transform: el.style.transform, opacity: el.style.opacity || 1 }, { transform: 'translateX(0)', opacity: 1 }],
      { duration: 180, easing: 'ease-out' });
  }
  el.style.transform = '';
  el.style.opacity = '';
}

// Ny bild glider in från det håll man svepte mot
function slideIn(dir) {
  const board = $('#board');
  if (!board.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  board.animate([{ transform: `translateX(${dir * 70}px)`, opacity: 0.2 }, { transform: 'translateX(0)', opacity: 1 }],
    { duration: 260, easing: 'cubic-bezier(.2,.7,.2,1)' });
}

function swipeEnd(e) {
  if (!swipe) return;
  const s = swipe;
  swipe = null;
  const t = e.changedTouches[0];
  const dx = t.clientX - s.x, dy = t.clientY - s.y;
  const isSwipe = s.dragging && Math.abs(dx) >= SWIPE.min && Math.abs(dx) >= SWIPE.ratio * Math.abs(dy) && Date.now() - s.time < SWIPE.maxMs;
  if (!isSwipe) { resetSwipeStyle(s.el, true); return; }
  resetSwipeStyle(s.el, false);

  // Minitenta eller tenta: vänd mellan uppgifterna och formelbladet
  if (sheet.open || sheetContext()) { toggleSheet(); return; }

  // Vanlig lektionsbild: bläddra
  if (currentView() !== 'lesson') return;
  const next = slideIndex + (dx < 0 ? 1 : -1);
  if (next < 0 || next >= slides.length) { resetSwipeStyle(s.el, false); return; }
  goToSlide(next);
  slideIn(dx < 0 ? 1 : -1);
}

function setupSwipe() {
  for (const id of ['#view-lesson', '#view-exam']) {
    const area = $(id);
    area.addEventListener('touchstart', swipeStart, { passive: true });
    area.addEventListener('touchmove', swipeMove, { passive: true });
    area.addEventListener('touchend', swipeEnd, { passive: true });
    area.addEventListener('touchcancel', () => { if (swipe) resetSwipeStyle(swipe.el, true); swipe = null; }, { passive: true });
  }
}
