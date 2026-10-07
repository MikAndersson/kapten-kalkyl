/* ---------- Start ---------- */

async function init() {
  $('#app-subtitle').textContent = `${KURS.kod} ${KURS.namn} · repetition inför sluttentan`;
  $$('[data-avatar]').forEach(el => el.append($('#avatar-template').content.cloneNode(true)));

  for (const view of VIEWS) $('#tab-' + view).onclick = () => showView(view);
  $('#timer-start').onclick = startTimer;
  $('#timer-reset').onclick = resetTimer;

  setupMath();
  setupSpeech();
  setupLessonControls();
  setupExamControls();

  // Lektioner och tentamallar läses in (från mapparna eller de inbyggda kopiorna)
  await Promise.all([loadBuiltInLessons(), loadTemplates()]);
  combineLessons();
  buildSlideList();
  renderChapterButtons();
  renderLessonNotice();

  const saved = storage.get('position', null);
  const savedIndex = saved ? slides.findIndex(s => s.lesson.id === saved.lesson && s.slideNoInLesson === saved.slide) : -1;
  slideIndex = savedIndex >= 0 ? savedIndex : 0;
  renderSlide();

  // En länk som slutar med #tenta482913 öppnar just den tentan
  const linked = /^#tenta(\d{6})$/.exec(location.hash);
  if (linked) { exam.mode = 'slump'; exam.seed = parseInt(linked[1], 10); }
  buildExam();
  renderExam();
  updateTimer();
  if (timer.startedAt) startTimer();

  const view = linked ? 'exam' : storage.get('view', 'lesson');
  if (VIEWS.includes(view) && view !== 'lesson') showView(view);
}

init();
