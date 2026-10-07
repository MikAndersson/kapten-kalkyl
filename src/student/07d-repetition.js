/* ---------- Repetition efter tentan ----------
   När tentan är rättad sätter Kapten Kalkyl ihop en lista med bara de avsnitt där
   något blev fel. I repetitionsläget visar lektionsvyn bara de avsnitten (med sina
   minitentor), och sist kommer en bild där man kan göra tentan igen.
   Läget sparas i webbläsaren tills man avslutar det eller gör om tentan. */

const reviewState = () => storage.get('review', null);   // { lessons: [id], wrong: [{ n, ch }], mode, seed }

// Lektionerna som visas: alla, eller bara repetitionslistans
function activeLessons() {
  const review = reviewState();
  if (!review) return lessonStore.all;
  const list = lessonStore.all.filter(l => review.lessons.includes(l.id));
  return list.length ? list : lessonStore.all;
}

const lessonTitle = id => { const l = lessonStore.all.find(x => x.id === id); return l ? l.titel : id; };
const joinWords = list => (list.length > 1 ? list.slice(0, -1).join(', ') + ' och ' + list[list.length - 1] : list.join(''));

function reviewEndInfo(review) {
  return {
    element: null,
    say: `Bra jobbat! Nu har du repeterat ${review.lessons.length === 1 ? 'avsnittet' : 'alla ' + review.lessons.length + ' avsnitten'} där det blev fel på tentan. Gör samma tenta igen och se om det sitter, eller ta en ny slumpad tenta.`,
    sayEn: 'Well done! You have now reviewed the sections where you made mistakes on the exam. Take the same exam again to see if it has sunk in, or try a new random exam.',
  };
}

function renderReviewEnd() {
  const review = reviewState();
  return `<div class="eyebrow">Repetition efter tentan</div>
    <h2>Dags att testa igen!</h2>
    <p>Du har gått igenom ${review.lessons.length === 1 ? 'avsnittet' : `de ${review.lessons.length} avsnitten`} där det blev fel:
      <b>${escapeHtml(joinWords(review.lessons.map(lessonTitle)))}</b>.</p>
    <div class="btnrow cta">
      <button class="btn primary" data-review="same">Gör samma tenta igen ▶</button>
      <button class="btn" data-review="new">Ny slumpad tenta</button>
      <button class="btn ghost" data-review="end">Avsluta repetitionen</button>
    </div>`;
}

// Banderollen ovanför lektionerna i repetitionsläget
function renderReviewBanner() {
  const review = reviewState();
  const box = $('#review-banner');
  if (!box) return;
  box.hidden = !review;
  if (!review) { box.innerHTML = ''; return; }
  box.innerHTML = `<span><b>Repetition efter tentan:</b> ${review.lessons.length} ${review.lessons.length === 1 ? 'avsnitt' : 'avsnitt'}
      (${escapeHtml(joinWords(review.lessons.map(lessonTitle)))}).</span>
    <span class="btnrow" style="margin:0">
      <button class="btn small" data-review="same">Gör tentan igen</button>
      <button class="btn ghost small" data-review="end">Visa alla lektioner</button>
    </span>`;
}

function refreshLessonList() {
  buildSlideList();
  renderChapterButtons();
  renderReviewBanner();
}

function startReview(wrongQuestions) {
  const order = id => { const l = lessonStore.all.find(x => x.id === id); return l ? l.ordning : 999; };
  const lessons = [...new Set(wrongQuestions.map(q => q.ch))].filter(id => lessonStore.all.some(l => l.id === id)).sort((a, b) => order(a) - order(b));
  if (!lessons.length) return;
  storage.set('review', { lessons, wrong: wrongQuestions.map(q => ({ n: q.n, ch: q.ch })), mode: exam.mode, seed: exam.seed });
  refreshLessonList();
  showView('lesson');
  goToSlide(0);
}

function endReview() {
  const current = slides[slideIndex];
  storage.set('review', null);
  refreshLessonList();
  const same = current ? slides.findIndex(s => s.lesson.id === current.lesson.id && s.slideNoInLesson === current.slideNoInLesson) : -1;
  slideIndex = Math.max(0, same);
  renderSlide();
}

// Samma tenta igen: svaren töms och tentan öppnas. Repetitionsläget avslutas.
function redoExam(fresh) {
  const review = reviewState();
  storage.set('review', null);
  refreshLessonList();
  slideIndex = Math.min(slideIndex, slides.length - 1);
  if (fresh || !review) { openExam('slump', newSeed()); }
  else {
    const key = review.mode === 'fast' ? 'fast' : 'nr' + review.seed;
    storage.set('answers-' + key, {});
    openExam(review.mode, review.seed);
  }
  showView('exam');
  window.scrollTo({ top: 0 });
}

function handleReviewClick(event) {
  const button = event.target.closest('button[data-review]');
  if (!button) return;
  const action = button.dataset.review;
  if (action === 'start') startReview(lastWrongQuestions);
  if (action === 'end') endReview();
  if (action === 'same') redoExam(false);
  if (action === 'new') redoExam(true);
}
