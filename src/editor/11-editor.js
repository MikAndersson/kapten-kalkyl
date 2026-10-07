/* ---------- Editorn (visuell) ----------
   Lektionen byggs med formulär:
     - Lektionsinfo: titel, område och plats i ordningen.
     - Bildflikar: en flik per bild, med knappar för att lägga till, flytta och ta bort.
     - Varje bild har färdiga fält för rubrik, brödtext och berättare.
     - "+ Lägg till element" öppnar en meny med fler element (formel, uträkning,
       tabell, Testa dig …). Elementen kan flyttas upp/ner och tas bort.
   Förhandsvisningen till höger uppdateras medan man skriver. XML:en skapas
   automatiskt (se "Avancerat" längst ner för att se eller ändra den direkt). */

const editor = {
  model: null,
  slideNo: 0,
  idTouched: false,     // har användaren ändrat id själv? annars följer det titeln
  opened: false,
  timer: null,
  openMenu: null,       // den +-meny som är öppen
};

/* ----- Små byggstenar för formulärfält ----- */

// path = var i modellen fältet bor, t.ex. ['slides', 0, 'blocks', 2]
const pathAttr = path => `data-path="${escapeHtml(JSON.stringify(path))}"`;

function inputField(path, key, value, { label = '', placeholder = '', kind = '', cls = '', type = 'text' } = {}) {
  const input = `<input class="ed-in ${cls}" type="${type}" ${pathAttr(path)} data-key="${key}"${kind ? ` data-kind="${kind}"` : ''}
    value="${escapeHtml(value == null ? '' : value)}" placeholder="${escapeHtml(placeholder)}">`;
  return label ? `<label class="ed-field"><span>${label}</span>${input}</label>` : input;
}

function textArea(path, key, value, { label = '', placeholder = '', kind = '', rows = 3, hint = '' } = {}) {
  return `<label class="ed-field"><span>${label}</span>
    <textarea class="ed-in" rows="${rows}" ${pathAttr(path)} data-key="${key}"${kind ? ` data-kind="${kind}"` : ''}
      placeholder="${escapeHtml(placeholder)}">${escapeHtml(value == null ? '' : value)}</textarea>
    ${hint ? `<small class="ed-hint">${hint}</small>` : ''}</label>`;
}

function checkbox(path, key, checked, label) {
  return `<label class="ed-check"><input type="checkbox" ${pathAttr(path)} data-key="${key}"${checked ? ' checked' : ''}> ${label}</label>`;
}

const iconButton = (action, path, text, title, extra = '') =>
  `<button type="button" class="btn ghost small" data-action="${action}" ${pathAttr(path)} title="${title}" aria-label="${title}" ${extra}>${text}</button>`;

const TEXT_HINT = 'Formel i texten: <code>$a^2+b^2=c^2$</code> · Fet: <code>**ord**</code>';
const TEX_HINT = 'LaTeX, t.ex. <code>\\frac{a}{b}</code> <code>\\sqrt{x}</code> <code>x^2</code> <code>\\cdot</code> <code>\\enh{kN}</code>. Decimalkomma och 24 000 fungerar.';

/* ----- Tabelltext: en rad per tabellrad, celler skiljs med |, ! först = fet rad ----- */
const tableToText = rows => rows.map(r => (r.header ? '! ' : '') + r.cells.join(' | ')).join('\n');
const textToTable = text => text.split('\n').map(line => {
  const header = line.trim().startsWith('!');
  return { header, cells: line.replace(/^\s*!\s?/, '').split('|').map(c => c.trim()) };
});

/* ----- Formulär för varje elementtyp ----- */

function blockBody(b, path) {
  switch (b.type) {
    case 'rubrik': case 'underrubrik':
      return inputField(path, 'text', b.text, { placeholder: 'Rubrik' });
    case 'text': case 'tips': case 'varning':
      return textArea(path, 'text', b.text, { rows: 3, hint: TEXT_HINT });
    case 'formel':
      return inputField(path, 'tex', b.tex, { cls: 'mono', placeholder: 'G = m \\cdot g' }) +
        checkbox(path, 'stor', b.stor, 'Stor formel') + `<small class="ed-hint">${TEX_HINT}</small>`;
    case 'berakning':
      return `<div class="ed-rows">${b.rows.map((r, i) => {
        const rp = path.concat('rows', i);
        return `<div class="ed-row">
          <select class="ed-in ed-kind" ${pathAttr(rp)} data-key="kind" aria-label="Radtyp">
            <option value="rad"${r.kind === 'rad' ? ' selected' : ''}>Steg (formel)</option>
            <option value="radtext"${r.kind === 'radtext' ? ' selected' : ''}>Steg (text)</option>
            <option value="svar"${r.kind === 'svar' ? ' selected' : ''}>Svar (formel)</option>
            <option value="svartext"${r.kind === 'svartext' ? ' selected' : ''}>Svar (text)</option>
          </select>
          ${inputField(rp, 'text', r.text, { cls: r.kind.endsWith('text') ? '' : 'mono' })}
          ${iconButton('row-delete', rp, '✕', 'Ta bort raden')}
        </div>`;
      }).join('')}</div>
      ${iconButton('row-add', path, '+ Rad', 'Lägg till rad')}<small class="ed-hint">${TEX_HINT}</small>`;
    case 'lista':
      return checkbox(path, 'numrerad', b.numrerad, 'Numrerad lista') +
        textArea(path, 'items', b.items.join('\n'), { kind: 'lines', rows: 4, hint: 'En punkt per rad. ' + TEXT_HINT });
    case 'steg':
      return textArea(path, 'items', b.items.join('\n'), { kind: 'lines', rows: 4, hint: 'Ett steg per rad. ' + TEXT_HINT });
    case 'tabell':
      return checkbox(path, 'forstaKolumnRubrik', b.forstaKolumnRubrik, 'Första kolumnen fet') +
        textArea(path, 'rows', tableToText(b.rows), { kind: 'table', rows: 5,
          hint: 'En rad per tabellrad. Skilj cellerna med <code>|</code>. Börja raden med <code>!</code> för en fet rubrikrad.' });
    case 'figur':
      return b.svg
        ? `<p class="note">Egen SVG-figur (ändras under Avancerat).</p>`
        : `<label class="ed-field"><span>Figur</span><select class="ed-in" ${pathAttr(path)} data-key="namn">
            ${Object.keys(FIGURER).map(n => `<option${n === b.namn ? ' selected' : ''}>${n}</option>`).join('')}
          </select></label>`;
    case 'kolumner':
      return `<div class="ed-cols">${b.cols.map((col, i) => `
        <div class="ed-col"><div class="ed-col-title">${i === 0 ? 'Vänster' : 'Höger'} kolumn</div>
          ${blockList(col, path.concat('cols', i), true)}</div>`).join('')}</div>`;
    case 'testa':
      return textArea(path, 'fraga', b.fraga, { label: 'Fråga', rows: 2, hint: TEXT_HINT }) +
        inputField(path, 'formelblad', b.formelblad || '', { label: 'Formel från formelbladet (valfritt)', placeholder: 'f-procent-3' }) +
        `<div class="ed-sub">Svarsrutor</div>` +
        b.rutor.map((r, i) => {
          const rp = path.concat('rutor', i);
          return `<div class="ed-ruta">
            ${inputField(rp, 'etikett', r.etikett, { label: 'Etikett', placeholder: 'Tyngd' })}
            ${inputField(rp, 'svar', r.svar, { label: 'Rätt svar', placeholder: '4,5' })}
            ${inputField(rp, 'enhet', r.enhet, { label: 'Enhet', placeholder: 'kN' })}
            ${inputField(rp, 'tolerans', r.tolerans, { label: 'Tolerans', placeholder: '1 %' })}
            ${iconButton('ruta-delete', rp, '✕', 'Ta bort svarsrutan')}
          </div>
          ${textArea(rp, 'fel', r.fel || '', { label: 'Vanliga felsvar (valfritt)', rows: 2, placeholder: '40 = Det är bara januari. Lägg ihop alla tre månaderna.',
            hint: 'En rad per felsvar: <code>värde = förklaring</code>. Förklaringen visas när eleven svarar just det.' })}`;
        }).join('') +
        iconButton('ruta-add', path, '+ Svarsruta', 'Lägg till svarsruta') +
        `<div class="ed-sub">Lösning (visas när eleven trycker Visa lösning)</div>` +
        blockList(b.losning, path.concat('losning'), true);
    case 'knapp':
      return inputField(path, 'text', b.text, { placeholder: 'Starta övningstentan' });
    case 'diagram': {
      const sel = `<label class="ed-field"><span>Typ</span><select class="ed-in" ${pathAttr(path)} data-key="typ">
        ${[['stapel', 'Stapeldiagram'], ['linje', 'Linjediagram'], ['punkt', 'Punktdiagram'], ['funktion', 'Graf till en funktion']]
          .map(([v, l]) => `<option value="${v}"${b.typ === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
      const common = `<div class="ed-grid">${sel}${inputField(path, 'titel', b.titel, { label: 'Titel' })}
        ${inputField(path, 'x', b.x, { label: 'x-axelns namn' })}${inputField(path, 'y', b.y, { label: 'y-axelns namn' })}</div>`;
      return common + (b.typ === 'funktion'
        ? `<div class="ed-grid">${inputField(path, 'uttryck', b.uttryck, { label: 'y = …', cls: 'mono', placeholder: '2*x + 1' })}
             ${inputField(path, 'xmin', b.xmin, { label: 'x från', placeholder: '-10' })}${inputField(path, 'xmax', b.xmax, { label: 'x till', placeholder: '10' })}</div>
           <small class="ed-hint">Skriv * för gånger och ^ för upphöjt, t.ex. <code>0,5*x^2 - 3</code>.</small>`
        : `${inputField(path, 'etiketter', b.etiketter, { label: 'Etiketter', placeholder: 'Jan;Feb;Mar' })}
           ${inputField(path, 'varden', b.varden, { label: 'Värden', cls: 'mono', placeholder: '12;18;9' })}
           <small class="ed-hint">Skilj med semikolon. Lika många etiketter som värden.</small>`);
    }
    case 'interaktiv':
      return `<label class="ed-field"><span>Modell</span><select class="ed-in" ${pathAttr(path)} data-key="typ">
        ${Object.keys(WIDGETS).map(n => `<option${n === b.typ ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <small class="ed-hint">Startvärden kan ändras under Avancerat (t.ex. <code>k="2" m="1"</code> för räta linjen). Se LÄSMIG.txt.</small>`;
    case 'raw':
      return textArea(path, 'xml', b.xml, { label: 'XML', rows: 4, hint: 'Elementet känns inte igen av formuläret och visas som XML.' });
    default:
      return '';
  }
}

// Ett element som kort med rubrik och knappar för flytta/ta bort.
function blockCard(b, path, index, count) {
  return `<div class="ed-card">
    <div class="ed-card-head">
      <span class="ed-card-title">${blockLabel(b.type)}</span>
      <span class="ed-card-tools">
        ${iconButton('block-up', path, '↑', 'Flytta upp', index === 0 ? 'disabled' : '')}
        ${iconButton('block-down', path, '↓', 'Flytta ner', index === count - 1 ? 'disabled' : '')}
        ${iconButton('block-delete', path, '✕', 'Ta bort elementet')}
      </span>
    </div>
    <div class="ed-card-body">${blockBody(b, path)}</div>
  </div>`;
}

// En lista med element + knappen "Lägg till element".
function blockList(blocks, path, nested = false) {
  const types = BLOCK_TYPES.filter(t => !nested || t.nested);
  const menuId = 'menu-' + path.join('-');
  return `<div class="ed-blocks">${blocks.map((b, i) => blockCard(b, path.concat(i), i, blocks.length)).join('')}</div>
    <div class="ed-add">
      <button type="button" class="btn ed-add-btn" data-action="menu-toggle" data-menu="${menuId}" aria-expanded="false">＋ Lägg till element</button>
      <div class="ed-menu" id="${menuId}" hidden role="menu">
        ${types.map(t => `<button type="button" role="menuitem" data-action="block-add" data-type="${t.type}" ${pathAttr(path)}>
          <b>${t.label}</b><small>${t.desc}</small></button>`).join('')}
      </div>
    </div>`;
}

/* ----- Hela formuläret ----- */

function renderEditorForm() {
  const m = editor.model;
  editor.slideNo = Math.min(editor.slideNo, m.slides.length - 1);
  const s = m.slides[editor.slideNo];
  const sp = ['slides', editor.slideNo];
  const areas = [...new Set(lessonStore.all.map(l => l.omrade).concat(m.omrade))];

  $('#ed-form').innerHTML = `
    <section class="ed-section">
      <h3>Lektion</h3>
      <div class="ed-grid">
        ${inputField([], 'titel', m.titel, { label: 'Titel', placeholder: 'Area & volym' })}
        ${inputField([], 'titelEn', m.titelEn, { label: 'Titel på engelska (valfri)', placeholder: 'Area and volume' })}
        <label class="ed-field"><span>Område</span>
          <input class="ed-in" list="ed-areas" ${pathAttr([])} data-key="omrade" value="${escapeHtml(m.omrade)}">
          <datalist id="ed-areas">${areas.map(a => `<option value="${escapeHtml(a)}">`).join('')}</datalist>
        </label>
        ${inputField([], 'ordning', m.ordning, { label: 'Plats i ordningen', kind: 'number', type: 'number' })}
        ${inputField([], 'id', m.id, { label: 'Id (filnamn)', kind: 'id', cls: 'mono' })}
      </div>
      <small class="ed-hint">Lägre tal kommer först. Befintliga: ${lessonStore.all.map(l => `${l.ordning} ${escapeHtml(l.titel)}`).join(' · ')}</small>
    </section>

    <section class="ed-section">
      <div class="ed-tabs" role="tablist">
        ${m.slides.map((sl, i) => `<button type="button" role="tab" class="ed-tab${i === editor.slideNo ? ' on' : ''}" data-action="slide-select" data-index="${i}" aria-selected="${i === editor.slideNo}">
          ${i + 1}. <span data-tab-title="${i}">${escapeHtml(sl.titel || 'Bild')}</span></button>`).join('')}
        <button type="button" class="ed-tab ed-tab-add" data-action="slide-add">＋ Ny bild</button>
      </div>
      <div class="ed-slide-tools">
        ${iconButton('slide-left', sp, '← Flytta', 'Flytta bilden åt vänster', editor.slideNo === 0 ? 'disabled' : '')}
        ${iconButton('slide-right', sp, 'Flytta →', 'Flytta bilden åt höger', editor.slideNo === m.slides.length - 1 ? 'disabled' : '')}
        ${iconButton('slide-copy', sp, 'Kopiera bild', 'Gör en kopia av bilden')}
        ${iconButton('slide-delete', sp, 'Ta bort bild', 'Ta bort bilden', m.slides.length === 1 ? 'disabled' : '')}
      </div>
    </section>

    <section class="ed-section">
      <div class="ed-grid">
        ${inputField(sp, 'titel', s.titel, { label: 'Bildens namn', placeholder: 'Areaformler' })}
        ${inputField(sp, 'etikett', s.etikett, { label: 'Liten text ovanför rubriken', placeholder: 'Geometri · 1' })}
      </div>
      ${inputField(sp, 'rubrik', s.rubrik, { label: 'Rubrik', cls: 'ed-big', placeholder: 'Rubrik på bilden' })}
      ${textArea(sp, 'brodtext', s.brodtext, { label: 'Brödtext', rows: 4, hint: TEXT_HINT, placeholder: 'Valfri förklarande text' })}

      <div class="ed-sub">Fler element på bilden</div>
      ${blockList(s.blocks, sp.concat('blocks'))}

      <div class="ed-sub">Kapten Kalkyl säger</div>
      ${textArea(sp, 'say', s.say, { label: 'På svenska', rows: 4, placeholder: 'Det Kapten Kalkyl säger när bilden visas' })}
      ${textArea(sp, 'sayEn', s.sayEn, { label: 'På engelska (läses om enheten saknar svensk röst)', rows: 3 })}
    </section>`;
  const activeTab = $('.ed-tab.on');
  if (activeTab && activeTab.scrollIntoView) activeTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  updatePreview();
}

/* ----- Förhandsvisning ----- */

function currentLessonXml() {
  return modelToXml(editor.model);
}

function updatePreview() {
  const errorsBox = $('#ed-errors');
  let lesson;
  try {
    lesson = parseLesson(currentLessonXml(), 'editor');
  } catch (e) {
    errorsBox.hidden = false;
    errorsBox.textContent = e.message;
    return;
  }
  const slide = lesson.slides[Math.min(editor.slideNo, lesson.slides.length - 1)];
  $('#ed-preview').innerHTML = renderSlideContent(slide.element);
  typeset($('#ed-preview'));
  setupWidgets($('#ed-preview'));
  $('#ed-count').textContent = `Förhandsvisning · bild ${editor.slideNo + 1} av ${lesson.slides.length}`;
  $('#ed-narration').innerHTML = toParagraphs(slide.say || '(Kapten Kalkyl säger inget på den här bilden.)');

  // Kontroller som hjälper den som skriver
  const warnings = [];
  const m = editor.model;
  if (!m.titel.trim()) warnings.push('Lektionen saknar titel.');
  if (lessonStore.builtIn.some(l => l.id === m.id)) warnings.push(`Id "${m.id}" finns redan bland lektionerna. Byt id om det ska bli en ny lektion (annars ersätter filen den gamla).`);
  m.slides.forEach((s, i) => {
    const check = blocks => blocks.forEach(b => {
      if (b.type === 'testa') b.rutor.forEach(r => { if (isNaN(parseNumber(r.svar))) warnings.push(`Bild ${i + 1}: en svarsruta saknar rätt svar.`); });
      if (b.type === 'kolumner') b.cols.forEach(check);
    });
    check(s.blocks);
  });
  errorsBox.hidden = warnings.length === 0;
  errorsBox.textContent = warnings.join(' ');

  if ($('#ed-advanced').open) $('#ed-xml').value = currentLessonXml();
}

function scheduleSave() {
  clearTimeout(editor.timer);
  editor.timer = setTimeout(() => {
    storage.set('editor-draft', currentLessonXml());
    updatePreview();
  }, 200);
}

/* ----- Händelser i formuläret ----- */

const getAt = (obj, path) => path.reduce((o, k) => o[k], obj);

function onFormInput(e) {
  const el = e.target;
  if (!el.dataset || !el.dataset.key) return;
  const path = JSON.parse(el.dataset.path);
  const target = getAt(editor.model, path);
  const key = el.dataset.key;
  let value = el.type === 'checkbox' ? el.checked : el.value;
  switch (el.dataset.kind) {
    case 'lines': value = value.split('\n'); break;
    case 'table': value = textToTable(value); break;
    case 'number': value = parseFloat(value) || 0; break;
    case 'id': value = slugify(value); editor.idTouched = true; break;
  }
  target[key] = value;
  if (key === 'typ' && target.type === 'diagram') { renderEditorForm(); scheduleSave(); return; }

  // Titeln styr id:t tills någon ändrar id:t själv
  if (path.length === 0 && key === 'titel' && !editor.idTouched) {
    editor.model.id = slugify(value);
    const idInput = $('#ed-form [data-key="id"]');
    if (idInput) idInput.value = editor.model.id;
  }
  // Uppdatera bildfliken när bildens namn ändras
  if (path.length === 2 && key === 'titel') {
    const tab = $(`[data-tab-title="${path[1]}"]`);
    if (tab) tab.textContent = value || 'Bild';
  }
  // Byter man radtyp i en uträkning ändras typsnittet i fältet
  if (key === 'kind') {
    const input = el.parentElement.querySelector('input');
    if (input) input.classList.toggle('mono', !value.endsWith('text'));
  }
  scheduleSave();
}

function closeMenus() {
  $$('.ed-menu').forEach(m => { m.hidden = true; });
  $$('.ed-add-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
  editor.openMenu = null;
}

function onFormClick(e) {
  const button = e.target.closest('[data-action]');
  if (!button) {
    if (!e.target.closest('.ed-menu')) closeMenus();
    return;
  }
  const action = button.dataset.action;
  const path = button.dataset.path ? JSON.parse(button.dataset.path) : [];
  const m = editor.model;

  if (action === 'menu-toggle') {
    const menu = document.getElementById(button.dataset.menu);
    const wasOpen = !menu.hidden;
    closeMenus();
    if (!wasOpen) {
      menu.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      editor.openMenu = menu;
      const first = menu.querySelector('button');
      if (first) first.focus();
    }
    return;
  }

  let rerender = true;
  const parentOf = p => getAt(m, p.slice(0, -1));
  const indexOf = p => p[p.length - 1];
  const move = (list, from, to) => { if (to >= 0 && to < list.length) list.splice(to, 0, list.splice(from, 1)[0]); };

  switch (action) {
    case 'block-add': {
      const type = BLOCK_TYPES.find(t => t.type === button.dataset.type);
      getAt(m, path).push(type.make());
      closeMenus();
      break;
    }
    case 'block-up':     move(parentOf(path), indexOf(path), indexOf(path) - 1); break;
    case 'block-down':   move(parentOf(path), indexOf(path), indexOf(path) + 1); break;
    case 'block-delete': parentOf(path).splice(indexOf(path), 1); break;
    case 'row-add':      getAt(m, path).rows.push({ kind: 'rad', text: '' }); break;
    case 'row-delete':   parentOf(path).splice(indexOf(path), 1); break;
    case 'ruta-add':     getAt(m, path).rutor.push({ etikett: 'Svar', enhet: '', svar: '', tolerans: '' }); break;
    case 'ruta-delete':  parentOf(path).splice(indexOf(path), 1); break;
    case 'slide-select': editor.slideNo = Number(button.dataset.index); break;
    case 'slide-add':
      m.slides.push(newSlide(m.slides.length + 1));
      editor.slideNo = m.slides.length - 1;
      break;
    case 'slide-left':  move(m.slides, editor.slideNo, editor.slideNo - 1); editor.slideNo--; break;
    case 'slide-right': move(m.slides, editor.slideNo, editor.slideNo + 1); editor.slideNo++; break;
    case 'slide-copy':
      m.slides.splice(editor.slideNo + 1, 0, JSON.parse(JSON.stringify(m.slides[editor.slideNo])));
      editor.slideNo++;
      m.slides[editor.slideNo].titel += ' (kopia)';
      break;
    case 'slide-delete':
      if (!button.dataset.armed) {          // två klick krävs
        button.dataset.armed = '1';
        button.textContent = 'Klicka igen för att ta bort';
        setTimeout(() => { if (button.isConnected) { button.textContent = 'Ta bort bild'; delete button.dataset.armed; } }, 3000);
        rerender = false;
      } else {
        m.slides.splice(editor.slideNo, 1);
        editor.slideNo = Math.max(0, editor.slideNo - 1);
      }
      break;
    default:
      rerender = false;
  }
  if (rerender) {
    renderEditorForm();
    scheduleSave();
  }
}

/* ----- Öppna, spara, dela ----- */

function loadIntoEditor(xmlText) {
  const lesson = parseLesson(xmlText, 'editor');
  editor.model = lessonToModel(lesson);
  editor.slideNo = 0;
  editor.idTouched = true;
  renderEditorForm();
  storage.set('editor-draft', xmlText);
}

function editorOpened() {
  if (!editor.opened) {
    editor.opened = true;
    fillOpenSelect();
    const draft = storage.get('editor-draft', null);
    try {
      if (draft) { loadIntoEditor(draft); return; }
    } catch (e) { /* trasigt utkast: börja om */ }
    editor.model = newLessonModel();
    editor.idTouched = false;
    renderEditorForm();
    return;
  }
  fillOpenSelect();
  updatePreview();
}

// Lektioner som importerats under det här besöket (finns bara i minnet).
const importedLessons = {};

function fillOpenSelect() {
  const ownIds = Object.keys(importedLessons);
  $('#ed-open').innerHTML =
    '<option value="">Öppna lektion…</option>' +
    '<option value="new">＋ Ny tom lektion</option>' +
    (ownIds.length ? `<optgroup label="Importerade">${ownIds.map(id => `<option value="own:${escapeHtml(id)}">${escapeHtml(id)}</option>`).join('')}</optgroup>` : '') +
    `<optgroup label="Kursens lektioner (öppnas som kopia)">${lessonStore.builtIn.map(l => `<option value="built:${escapeHtml(l.id)}">${l.ordning} · ${escapeHtml(l.titel)}</option>`).join('')}</optgroup>`;
}

function setEditorStatus(text, isError) {
  $('#ed-status').textContent = text;
  $('#ed-status').classList.toggle('err', !!isError);
}

function openLesson(value) {
  $('#ed-open').value = '';
  if (!value) return;
  try {
    if (value === 'new') {
      editor.model = newLessonModel();
      editor.slideNo = 0;
      editor.idTouched = false;
      renderEditorForm();
      storage.set('editor-draft', currentLessonXml());
    } else if (value.startsWith('own:')) {
      loadIntoEditor(importedLessons[value.slice(4)]);
    } else if (value.startsWith('built:')) {
      const lesson = lessonStore.builtIn.find(l => l.id === value.slice(6));
      if (lesson) loadIntoEditor(lesson.xml);
    }
    setEditorStatus('');
  } catch (e) {
    setEditorStatus('Kunde inte öppna lektionen: ' + e.message, true);
  }
}

async function copyXml() {
  const text = currentLessonXml();
  try {
    await navigator.clipboard.writeText(text);
    setEditorStatus('XML:en är kopierad. Klistra in den i en ny fil i mappen lessons/.');
  } catch (e) {
    $('#ed-advanced').open = true;
    $('#ed-xml').value = text;
    $('#ed-xml').select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { /* ignorera */ }
    setEditorStatus(ok ? 'XML:en är kopierad.' : 'XML:en är markerad under Avancerat. Tryck Ctrl+C (eller håll fingret och välj Kopiera).');
  }
}

// Packar filer i en enkel zip (utan komprimering). Används i artefaktvisaren,
// som bara tillåter vissa filtyper (zip men inte xml).
function makeZip(files) {   // files: [{ name, text }]
  const crcTable = [...Array(256)].map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = bytes => {
    let c = 0xFFFFFFFF;
    for (const b of bytes) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const name = enc.encode(file.name);
    const data = enc.encode(file.text);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(local, name, data);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true); entry.setUint16(4, 20, true); entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true); entry.setUint32(16, crc, true); entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true); entry.setUint16(28, name.length, true); entry.setUint32(42, offset, true);
    central.push(entry, name);
    offset += 30 + name.length + data.length;
  }
  const centralSize = central.reduce((n, p) => n + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}


async function downloadXml() {
  const id = editor.model.id || 'lektion';
  const text = currentLessonXml();
  const downloads = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
  if (downloads) {
    try {
      await downloads.save({ filename: id + '.zip', data: makeZip([{ name: id + '.xml', text }]) });
      setEditorStatus(`Sparad som ${id}.zip. Packa upp den och lägg ${id}.xml i mappen lessons/.`);
    } catch (e) {
      setEditorStatus(e && e.code === 'declined' ? 'Nedladdningen avbröts.' : 'Nedladdning gick inte här. Använd Kopiera XML.', e && e.code !== 'declined');
    }
    return;
  }
  try {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'application/xml' }));
    link.download = id + '.xml';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    setEditorStatus(`Laddar ner ${id}.xml.`);
  } catch (e) {
    setEditorStatus('Nedladdning gick inte här. Använd Kopiera XML.', true);
  }
}

async function importFiles(fileList) {
  const results = [];
  let last = null;
  for (const file of fileList) {
    if (file.name.toLowerCase() === 'index.xml') continue;
    try {
      const text = await file.text();
      const lesson = parseLesson(text, file.name);
      importedLessons[lesson.id] = text;
      results.push(`✓ ${file.name}`);
      last = text;
    } catch (e) {
      results.push(`✗ ${file.name}: ${e.message}`);
    }
  }
  fillOpenSelect();
  if (last) loadIntoEditor(last);
  setEditorStatus(results.length ? 'Importerat: ' + results.join(' · ') : 'Inga lektionsfiler valdes.');
}

function applyAdvancedXml() {
  try {
    loadIntoEditor($('#ed-xml').value);
    setEditorStatus('XML:en är inläst i formuläret.');
  } catch (e) {
    setEditorStatus('XML:en innehåller fel: ' + e.message, true);
  }
}

function setupEditor() {
  const form = $('#ed-form');
  form.addEventListener('input', onFormInput);
  form.addEventListener('change', e => { if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT') onFormInput(e); });
  document.addEventListener('click', e => {
    if (e.target.closest('#ed-form')) onFormClick(e);
    else if (editor.openMenu) closeMenus();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && editor.openMenu) closeMenus(); });

  $('#ed-open').onchange = e => openLesson(e.target.value);
  $('#ed-import').onchange = e => { importFiles([...e.target.files]); e.target.value = ''; };
  $('#ed-new').onclick = () => openLesson('new');
  $('#ed-copy').onclick = copyXml;
  $('#ed-download').onclick = downloadXml;
  $('#ed-apply-xml').onclick = applyAdvancedXml;
  $('#ed-advanced').addEventListener('toggle', () => { if ($('#ed-advanced').open && editor.model) $('#ed-xml').value = currentLessonXml(); });
  $('#ed-preview').addEventListener('click', handleSlideClick);

  // Mobil: växla mellan formulär och förhandsvisning
  $$('[data-edmode]').forEach(b => b.onclick = () => {
    $('#view-editor').dataset.mode = b.dataset.edmode;
    $$('[data-edmode]').forEach(x => x.setAttribute('aria-pressed', x === b));
    if (b.dataset.edmode === 'preview') updatePreview();
  });
}
