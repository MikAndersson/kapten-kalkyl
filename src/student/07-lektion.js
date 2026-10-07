/* ---------- Lektionsvyn ----------
   Alla bilder från alla lektioner läggs i en lång lista (slides) i
   lektionernas sorteringsordning. Kapitelknapparna hoppar till första
   bilden i respektive lektion och grupperas per matematikområde. */

let slides = [];        // [{ lesson, slide, lessonNo, slideNoInLesson, mini? }]
let slideIndex = 0;

// Minitentor (en extra bild sist i varje lektion som har tentamallar) kan stängas av.
const showMinis = () => storage.get('mini', true);

function buildSlideList() {
  slides = [];
  lessonStore.all.forEach((lesson, lessonNo) => {
    lesson.slides.forEach((slide, i) => slides.push({ lesson, slide, lessonNo, slideNoInLesson: i }));
    if (showMinis() && hasTemplatesFor(lesson.id)) {
      slides.push({ lesson, slide: miniSlideInfo(lesson), lessonNo, slideNoInLesson: lesson.slides.length, mini: true });
    }
  });
}

function renderChapterButtons() {
  let html = '';
  let lastArea = null;
  for (const lesson of lessonStore.all) {
    if (lesson.omrade !== lastArea) {
      html += `<span class="area">${escapeHtml(lesson.omrade)}</span>`;
      lastArea = lesson.omrade;
    }
    html += `<button data-lesson="${escapeHtml(lesson.id)}">${escapeHtml(lesson.titel)}</button>`;
  }
  $('#chapters').innerHTML = html;
}

function renderSlide() {
  if (!slides.length) {
    $('#board').innerHTML = '<h2>Inga lektioner hittades</h2><p>Kontrollera lessons/index.xml.</p>';
    return;
  }
  const { lesson, slide, lessonNo, slideNoInLesson, mini } = slides[slideIndex];
  fieldCounter = 0;
  Object.keys(quizRegistry).forEach(k => delete quizRegistry[k]);

  $('#board').innerHTML = (mini ? renderMini(lesson) : renderSlideContent(slide.element)) + `
    <div class="titleblock">
      <span>${escapeHtml(KURS.kod)} · ${escapeHtml(lesson.omrade)}</span>
      <span>Lektion <b>${lessonNo + 1}</b> ${escapeHtml(lesson.titel)}</span>
      <span>${mini ? '<b>Minitenta</b>' : `Blad <b>${slideNoInLesson + 1}</b>/${lesson.slides.length}`}</span>
    </div>`;
  typeset($('#board'));
  setupWidgets($('#board'));

  $('#bubble-lesson').innerHTML = toParagraphs(slide.say || '…');
  $('#bubble-lesson').scrollTop = 0;
  $('#count').textContent = `${slideIndex + 1} / ${slides.length}`;
  $('#mb-count').textContent = `${slideIndex + 1}/${slides.length}`;
  $('#mb-prev').disabled = slideIndex === 0;
  $('#mb-next').disabled = slideIndex === slides.length - 1;
  $('#progress').style.width = ((slideIndex + 1) / slides.length * 100) + '%';
  $('#prev').disabled = slideIndex === 0;
  $('#next').disabled = slideIndex === slides.length - 1;

  $$('#chapters button').forEach(b => b.classList.toggle('on', b.dataset.lesson === lesson.id));
  const active = $('#chapters button.on');
  if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });

  storage.set('position', { lesson: lesson.id, slide: slideNoInLesson });
}

function goToSlide(index) {
  if (index < 0 || index >= slides.length) return;
  slideIndex = index;
  stopSpeaking();
  renderSlide();
  if ($('#autoplay').checked) readCurrentSlide();
}

function goToLesson(lessonId, slideNo = 0) {
  const index = slides.findIndex(s => s.lesson.id === lessonId && s.slideNoInLesson === slideNo);
  const first = slides.findIndex(s => s.lesson.id === lessonId);
  goToSlide(index >= 0 ? index : Math.max(first, 0));
}

// Läser upp aktuell bild. Med "Spela upp allt" bläddrar den vidare själv,
// men stannar på bilder med "Testa dig" så att man hinner räkna.
function readCurrentSlide() {
  const { slide, mini } = slides[slideIndex];
  const hasQuiz = mini || slide.element.getElementsByTagName('testa').length > 0;
  speak(narration(slide.say, slide.sayEn), $('#teacher-lesson'), () => {
    if ($('#autoplay').checked && slideIndex < slides.length - 1 && !hasQuiz) {
      setTimeout(() => { if ($('#autoplay').checked && !isSpeaking()) goToSlide(slideIndex + 1); }, 900);
    }
  });
}

function renderLessonNotice() {
  const notes = [];
  if (lessonStore.source === 'inbyggd') {
    notes.push('Lektionerna lästes från den inbyggda kopian i HTML-filen. Ändrade XML-filer i mappen lessons/ syns när sidan ligger på en webbserver (eller efter att build.py körts).');
  }
  lessonStore.errors.forEach(e => notes.push('Fel: ' + e));
  $('#lesson-notice').hidden = notes.length === 0;
  $('#lesson-notice').innerHTML = notes.map(n => `<p>${escapeHtml(n)}</p>`).join('');
}

function setupLessonControls() {
  $('#chapters').onclick = e => {
    const button = e.target.closest('button[data-lesson]');
    if (button) goToLesson(button.dataset.lesson);
  };
  $('#board').addEventListener('click', handleSlideClick);
  $('#board').addEventListener('click', handleMiniClick);
  $('#mini-toggle').checked = showMinis();
  $('#mini-toggle').onchange = e => {
    const current = slides[slideIndex];
    storage.set('mini', e.target.checked);
    buildSlideList();
    const same = slides.findIndex(s => current && s.lesson.id === current.lesson.id && s.slideNoInLesson === current.slideNoInLesson);
    slideIndex = same >= 0 ? same : Math.min(slideIndex, slides.length - 1);
    renderSlide();
  };
  $('#board').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('.mini input')) { e.preventDefault(); $('[data-mini="check"]').click(); return; }
    if (e.key === 'Enter' && e.target.matches('.quiz input')) {
      e.preventDefault();
      const button = e.target.closest('.quiz').querySelector('[data-action="check-quiz"]');
      if (button) button.click();
    }
  });
  $('#prev').onclick = () => goToSlide(slideIndex - 1);
  $('#next').onclick = () => goToSlide(slideIndex + 1);
  $('#speak-lesson').onclick = () => (isSpeaking() ? stopSpeaking() : readCurrentSlide());
  // Mobilraden gör samma sak som knapparna i lärarpanelen
  $('#mb-prev').onclick = () => goToSlide(slideIndex - 1);
  $('#mb-next').onclick = () => goToSlide(slideIndex + 1);
  $('#mb-speak').onclick = () => $('#speak-lesson').click();
  $('#mb-pause').onclick = togglePause;
  $('#autoplay').onchange = e => {
    if (e.target.checked && !isSpeaking()) readCurrentSlide();
    if (!e.target.checked) stopSpeaking();
  };

  // Svep åt vänster/höger på mobilen för att bläddra
  let touchStartX = null;
  $('#board').addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  $('#board').addEventListener('touchend', e => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(dx) > 70 && !e.target.closest('.tbl, .calc, input, select, textarea, .widget')) goToSlide(slideIndex + (dx < 0 ? 1 : -1));
  }, { passive: true });

  // Tangentbord: pilar bläddrar, mellanslag startar/pausar uppläsningen
  document.addEventListener('keydown', e => {
    if (/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) return;
    const view = currentView();
    if (view === 'lesson' && e.key === 'ArrowRight') goToSlide(slideIndex + 1);
    if (view === 'lesson' && e.key === 'ArrowLeft') goToSlide(slideIndex - 1);
    if (e.key === ' ') {
      e.preventDefault();
      if (isSpeaking()) togglePause();
      else if (view === 'lesson') readCurrentSlide();
      else $('#speak-exam').click();
    }
  });
}

// Anropas av formeldelen om MathJax laddas in efter att reservvisningen redan använts.
function redrawAfterLateMath() {
  if (slides.length) renderSlide();
}
