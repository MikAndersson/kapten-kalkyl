/* ---------- Start (editorn) ---------- */

// Anropas av formeldelen om MathJax laddas in sent.
function redrawAfterLateMath() {
  if (editor.model) updatePreview();
}

// Flikar: Lektioner och Tentafrågor
function showEditorTab(tab) {
  const isMallar = tab === 'mallar';
  $('#view-editor').classList.toggle('hidden', isMallar);
  $('#view-mallar').classList.toggle('hidden', !isMallar);
  $('#intro-lektioner').classList.toggle('hidden', isMallar);
  $('#intro-mallar').classList.toggle('hidden', !isMallar);
  $('#tab-lektioner').setAttribute('aria-selected', !isMallar);
  $('#tab-mallar').setAttribute('aria-selected', isMallar);
  storage.set('editor-tab', tab);
  if (isMallar) mallEditorOpened();
}

async function initEditor() {
  $('#app-subtitle').textContent = `${KURS.kod} ${KURS.namn}`;
  setupMath();
  setupEditor();
  setupMallEditor();
  $('#tab-lektioner').onclick = () => showEditorTab('lektioner');
  $('#tab-mallar').onclick = () => showEditorTab('mallar');
  // Kursens lektioner och mallar kan öppnas som kopior
  await Promise.all([loadBuiltInLessons(), loadTemplates()]);
  combineLessons();
  editorOpened();
  showEditorTab(storage.get('editor-tab', 'lektioner'));
}

initEditor();
