/* ---------- Läsa lektioner från XML ----------
   Var lektionerna kommer ifrån, i prioritetsordning:
     1. Filerna i mappen lessons/ (listade i lessons/index.xml). Fungerar när
        sidan ligger på en webbserver eller publiceras som artefakt.
     2. Inbyggda kopior längst ner i den här HTML-filen (<script type="text/xml">).
        Används när filen öppnas direkt från datorn, där webbläsaren inte får
        läsa andra filer.
   Lektionerna sorteras efter attributet ordning (lägst först). */

// Tolkar en XML-text till ett lektionsobjekt. Kastar ett fel med radnummer om XML:en är trasig.
function parseLesson(xmlText, source) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parseError = doc.getElementsByTagName('parsererror')[0];
  if (parseError) {
    const message = parseError.textContent
      .replace(/This page contains the following errors:/i, '')
      .replace(/Below is a rendering of the page.*$/is, '')
      .replace(/\s+/g, ' ').trim();
    throw new Error('XML-fel: ' + message.slice(0, 300));
  }
  const root = doc.documentElement;
  if (root.localName !== 'lektion') throw new Error('Filen måste börja med <lektion …>.');

  const id = root.getAttribute('id');
  if (!id) throw new Error('<lektion> saknar attributet id="…".');

  const slides = [...root.children]
    .filter(el => el.localName === 'bild')
    .map(el => ({
      element: el,
      titel: el.getAttribute('titel') || '',
      say: narrationText(el, 'sv'),
      sayEn: narrationText(el, 'en'),
    }));
  if (!slides.length) throw new Error('Lektionen har ingen <bild>.');

  return {
    id,
    ordning: isNaN(parseFloat(root.getAttribute('ordning'))) ? 500 : parseFloat(root.getAttribute('ordning')),
    omrade: root.getAttribute('omrade') || 'Övrigt',
    titel: root.getAttribute('titel') || id,
    titelEn: root.getAttribute('titel-en') || root.getAttribute('titel') || id,
    slides,
    xml: xmlText,
    source,
  };
}

// Hämtar <berattare> (svenska) eller <berattare sprak="en"> för en bild.
function narrationText(slideElement, language) {
  const items = [...slideElement.children].filter(el => el.localName === 'berattare');
  const match = items.find(el => (el.getAttribute('sprak') || 'sv') === language);
  return match ? match.textContent.replace(/\s+/g, ' ').trim() : '';
}

// Försöker läsa filerna från lessons/. Returnerar null om det inte går (t.ex. file://).
async function fetchLessonFiles() {
  try {
    const folder = KURS.lektionsmapp;
    const response = await fetch(folder + 'index.xml', { cache: 'no-cache' });
    if (!response.ok) return null;
    const index = new DOMParser().parseFromString(await response.text(), 'application/xml');
    const files = [...index.getElementsByTagName('fil')]
      .filter(f => f.getAttribute('visa') !== 'nej')
      .map(f => f.textContent.trim())
      .filter(Boolean);
    const texts = await Promise.all(files.map(async file => {
      const r = await fetch(folder + file, { cache: 'no-cache' });
      if (!r.ok) throw new Error(`Kunde inte läsa ${file}`);
      return { file, text: await r.text() };
    }));
    return texts;
  } catch (e) {
    return null;
  }
}

// Inbyggda kopior som byggskriptet lagt in i HTML-filen.
function embeddedLessonFiles() {
  return $$('script[type="text/xml"][data-lesson-file]').map(s => ({
    file: s.dataset.lessonFile,
    text: s.textContent.trim(),
  }));
}

const lessonStore = {
  builtIn: [],     // från lessons/ eller inbyggda kopior
  source: '',      // 'mapp' eller 'inbyggd'
  errors: [],      // filer som inte gick att läsa
  all: [],         // sorterade efter ordning
};

async function loadBuiltInLessons() {
  let files = await fetchLessonFiles();
  lessonStore.source = 'mapp';
  if (!files || !files.length) {
    files = embeddedLessonFiles();
    lessonStore.source = 'inbyggd';
  }
  lessonStore.builtIn = [];
  lessonStore.errors = [];
  for (const { file, text } of files) {
    try {
      lessonStore.builtIn.push(parseLesson(text, file));
    } catch (e) {
      lessonStore.errors.push(`${file}: ${e.message}`);
    }
  }
}

// Sorterar lektionerna efter ordning (lägst först).
function combineLessons() {
  lessonStore.all = [...lessonStore.builtIn].sort((a, b) => a.ordning - b.ordning || a.titel.localeCompare(b.titel, 'sv'));
}
