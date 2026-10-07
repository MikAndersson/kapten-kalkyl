/* ---------- Editor för tentafrågor (mallar) ----------
   En mall är en uppgift med variabler i stället för siffror. Formuläret har:
     - Grunddata: id, nivå (G/VG), lektion och poäng.
     - Variabler: slumptal, val ur lista, lista med tal, uträkningar och villkor.
     - Fråga, svar (med vanliga felsvar) och lösning.
   Förhandsvisningen slumpar fram en uppgift ur mallen. "Testa 300 slumpningar"
   kontrollerar att mallen alltid går att lösa. Mallarna sparas i en samling i
   webbläsaren och laddas ner som en XML-fil som läggs i mappen mallar/. */

const mallEditor = {
  model: null,
  seed: 1,
  timer: null,
  collection: storage.get('mall-samling', {}),   // { id: xml }
};

const PART_KINDS = {
  var:     { label: 'Slumptal', desc: 'Ett tal mellan min och max' },
  val:     { label: 'Val ur lista', desc: 'Ett av flera alternativ' },
  lista:   { label: 'Lista med tal', desc: 'Flera slumptal, t.ex. för statistik' },
  rakna:   { label: 'Uträkning', desc: 'Ett värde som räknas ut' },
  villkor: { label: 'Villkor', desc: 'Måste vara sant, annars slumpas om' },
};

function newMallModel() {
  return {
    id: 'egen-' + (Object.keys(mallEditor.collection).length + 1), niva: 'G', lektion: 'geometri', poang: 1,
    parts: [
      { kind: 'var', namn: 'a', min: '2', max: '12', steg: '', decimaler: '1' },
      { kind: 'var', namn: 'b', min: '2', max: '9', steg: '', decimaler: '1' },
      { kind: 'rakna', namn: 'svar', uttryck: 'a*b' },
    ],
    fraga: 'Ett golv är {=a:1} m långt och {=b:1} m brett. Beräkna arean.',
    underlag: '',
    svar: [{ etikett: 'Area', enhet: 'm²', varde: 'svar', decimaler: '2', exakt: false,
      fel: '2*(a + b) = Det är omkretsen. Arean är längd gånger bredd.' }],
    losning: [{ kind: 'rad', text: 'A = l \\cdot b = {=a:1} \\cdot {=b:1}' }, { kind: 'svar', text: 'A = {=svar:2}\\enh{m^2}' }],
    losningXml: '',
  };
}

/* ----- Modell <-> XML ----- */

// "uttryck = förklaring" – första ensamma likhetstecknet skiljer (== <= >= != räknas inte)
function splitFel(line) {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '=' && !'<>!='.includes(line[i - 1] || '') && line[i + 1] !== '=') return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
  }
  return null;
}

function mallToXml(m) {
  const a = (name, value) => (String(value == null ? '' : value).trim() !== '' ? ` ${name}="${xmlEscape(String(value).trim())}"` : '');
  const parts = m.parts.map(p => {
    switch (p.kind) {
      case 'var': return `    <var namn="${xmlEscape(p.namn)}"${a('min', p.min)}${a('max', p.max)}${a('steg', p.steg)}${p.decimaler && p.decimaler !== '0' ? a('decimaler', p.decimaler) : ''}/>`;
      case 'val': return `    <var namn="${xmlEscape(p.namn)}" typ="val"${a('alternativ', p.alternativ)}/>`;
      case 'lista': return `    <lista namn="${xmlEscape(p.namn)}"${a('antal', p.antal)}${a('min', p.min)}${a('max', p.max)}${p.decimaler && p.decimaler !== '0' ? a('decimaler', p.decimaler) : ''}/>`;
      case 'rakna': return `    <rakna namn="${xmlEscape(p.namn)}">${xmlEscape(p.uttryck || '')}</rakna>`;
      case 'villkor': return `    <villkor>${xmlEscape(p.uttryck || '')}</villkor>`;
      default: return '';
    }
  });
  const answers = m.svar.map(s => {
    const fel = String(s.fel || '').split('\n').map(splitFel).filter(Boolean)
      .map(([v, t]) => `<fel varde="${xmlEscape(v)}">${xmlEscape(t)}</fel>`).join('');
    const head = String(s.alternativ || '').trim()
      ? `    <svar${a('etikett', s.etikett)} typ="val"${a('alternativ', s.alternativ)}${a('varde', s.varde)}`
      : `    <svar${a('etikett', s.etikett)}${a('enhet', s.enhet)}${a('varde', s.varde)}${a('decimaler', s.decimaler)}${s.exakt ? ' exakt="ja"' : ''}`;
    return fel ? `${head}>${fel}</svar>` : `${head}/>`;
  });
  const solution = m.losningXml.trim()
    ? m.losningXml.trim()
    : '<berakning>' + m.losning.map((r, i) => {
      const tag = r.kind.startsWith('svar') ? 'svar' : 'rad';
      const asText = r.kind.endsWith('text');
      return `<${tag}${asText ? ' text="ja"' : ''}>${asText ? friendlyToXml(r.text) : xmlEscape(r.text)}</${tag}>`;
    }).join('') + '</berakning>';
  return `  <mall id="${xmlEscape(m.id)}" niva="${m.niva}" lektion="${xmlEscape(m.lektion)}" poang="${xmlEscape(String(m.poang))}">\n` +
    parts.join('\n') + '\n' +
    `    <fraga>${friendlyToXml(m.fraga)}</fraga>\n` +
    (m.underlag.trim() ? `    <underlag>${m.underlag.trim()}</underlag>\n` : '') +
    answers.join('\n') + '\n' +
    `    <losning>${solution}</losning>\n  </mall>`;
}

const innerXml = el => [...el.childNodes].map(n => new XMLSerializer().serializeToString(n)).join('').replace(/ xmlns="[^"]*"/g, '');

function xmlToMall(el) {
  const m = {
    id: el.getAttribute('id') || 'egen', niva: el.getAttribute('niva') || 'G', lektion: el.getAttribute('lektion') || '',
    poang: el.getAttribute('poang') || '1', parts: [], fraga: '', underlag: '', svar: [], losning: [], losningXml: '',
  };
  for (const c of el.children) {
    const g = n => c.getAttribute(n) || '';
    switch (c.localName) {
      case 'var':
        m.parts.push(g('typ') === 'val' ? { kind: 'val', namn: g('namn'), alternativ: g('alternativ') }
          : { kind: 'var', namn: g('namn'), min: g('min'), max: g('max'), steg: g('steg'), decimaler: g('decimaler') || '0' });
        break;
      case 'lista': m.parts.push({ kind: 'lista', namn: g('namn'), antal: g('antal'), min: g('min'), max: g('max'), decimaler: g('decimaler') || '0' }); break;
      case 'rakna': m.parts.push({ kind: 'rakna', namn: g('namn'), uttryck: c.textContent.trim() }); break;
      case 'villkor': m.parts.push({ kind: 'villkor', uttryck: c.textContent.trim() }); break;
      case 'fraga': m.fraga = xmlToFriendly(c); break;
      case 'underlag': m.underlag = innerXml(c).trim(); break;
      case 'svar':
        m.svar.push({ etikett: g('etikett'), enhet: g('enhet'), varde: g('varde'), decimaler: g('decimaler'), exakt: g('exakt') === 'ja',
          alternativ: g('typ') === 'val' ? g('alternativ') : '',
          fel: [...c.getElementsByTagName('fel')].map(f => `${f.getAttribute('varde')} = ${f.textContent.trim()}`).join('\n') });
        break;
      case 'losning': {
        const kids = [...c.children];
        if (kids.length === 1 && kids[0].localName === 'berakning') {
          m.losning = [...kids[0].children].map(r => {
            const asText = isYes(r, 'text');
            return { kind: (r.localName === 'svar' ? 'svar' : 'rad') + (asText ? 'text' : ''), text: asText ? xmlToFriendly(r) : r.textContent.trim() };
          });
        } else {
          m.losningXml = innerXml(c).trim();
        }
        break;
      }
    }
  }
  return m;
}

// Gör om modellen till ett mallobjekt som mallmotorn förstår
function modelToTemplate(m) {
  return parseTemplates('<mallar>' + mallToXml(m) + '</mallar>', 'editor')[0];
}

/* ----- Formuläret ----- */

const EXPR_HINT = 'Räknesätt: <code>+ − * / ^</code>, t.ex. <code>sqrt(a^2 + b^2)</code>, <code>pi*r^2</code>, <code>round(x, 2)</code>, <code>sin(v)</code> (grader). Se LÄSMIG.txt för alla funktioner.';

function partRow(p, i, count) {
  const path = ['parts', i];
  let body;
  switch (p.kind) {
    case 'var':
      body = `<div class="me-part-grid">${inputField(path, 'namn', p.namn, { label: 'Namn', cls: 'mono' })}${inputField(path, 'min', p.min, { label: 'Min', cls: 'mono' })}
        ${inputField(path, 'max', p.max, { label: 'Max', cls: 'mono' })}${inputField(path, 'steg', p.steg, { label: 'Steg (valfritt)', cls: 'mono', placeholder: 't.ex. 0,5' })}
        ${inputField(path, 'decimaler', p.decimaler, { label: 'Decimaler', type: 'number' })}</div>`;
      break;
    case 'val':
      body = `<div class="me-part-grid">${inputField(path, 'namn', p.namn, { label: 'Namn', cls: 'mono' })}
        ${inputField(path, 'alternativ', p.alternativ, { label: 'Alternativ (skilj med |)', cls: 'mono', placeholder: '24|25|27' })}</div>`;
      break;
    case 'lista':
      body = `<div class="me-part-grid">${inputField(path, 'namn', p.namn, { label: 'Namn', cls: 'mono' })}${inputField(path, 'antal', p.antal, { label: 'Antal', cls: 'mono' })}
        ${inputField(path, 'min', p.min, { label: 'Min', cls: 'mono' })}${inputField(path, 'max', p.max, { label: 'Max', cls: 'mono' })}
        ${inputField(path, 'decimaler', p.decimaler, { label: 'Decimaler', type: 'number' })}</div>`;
      break;
    case 'rakna':
      body = `<div class="me-part-grid me-calc">${inputField(path, 'namn', p.namn, { label: 'Namn', cls: 'mono' })}${inputField(path, 'uttryck', p.uttryck, { label: '= uttryck', cls: 'mono', placeholder: 'a*b' })}</div>`;
      break;
    case 'villkor':
      body = inputField(path, 'uttryck', p.uttryck, { label: 'Villkor (måste vara sant)', cls: 'mono', placeholder: 'isint(svar) && a != b' });
      break;
  }
  return `<div class="ed-card"><div class="ed-card-head"><span class="ed-card-title">${PART_KINDS[p.kind].label}</span>
    <span class="ed-card-tools">${iconButton('me-up', path, '↑', 'Flytta upp', i === 0 ? 'disabled' : '')}${iconButton('me-down', path, '↓', 'Flytta ner', i === count - 1 ? 'disabled' : '')}
    ${iconButton('me-delete', path, '✕', 'Ta bort')}</span></div><div class="ed-card-body">${body}</div></div>`;
}

function renderMallForm() {
  const m = mallEditor.model;
  const lessons = lessonStore.all.filter(l => l.id !== 'introduktion' && l.id !== 'tentastrategi');
  $('#me-form').innerHTML = `
    <section class="ed-section">
      <h3>Mall</h3>
      <div class="ed-grid">
        ${inputField([], 'id', m.id, { label: 'Id (unikt)', cls: 'mono' })}
        <label class="ed-field"><span>Nivå</span><select class="ed-in" data-path="[]" data-key="niva">
          <option${m.niva === 'G' ? ' selected' : ''}>G</option><option${m.niva === 'VG' ? ' selected' : ''}>VG</option></select></label>
        <label class="ed-field"><span>Lektion ("Repetera i lektionen")</span><select class="ed-in" data-path="[]" data-key="lektion">
          ${lessons.map(l => `<option value="${escapeHtml(l.id)}"${l.id === m.lektion ? ' selected' : ''}>${escapeHtml(l.titel)}</option>`).join('')}</select></label>
        ${inputField([], 'poang', m.poang, { label: 'Poäng', type: 'number' })}
      </div>
    </section>

    <section class="ed-section">
      <h3>Variabler</h3>
      <small class="ed-hint">Variablerna räknas i ordning uppifrån. Ett villkor som inte stämmer gör att allt slumpas om (så siffrorna alltid ger en lösbar uppgift). ${EXPR_HINT}</small>
      <div class="ed-blocks">${m.parts.map((p, i) => partRow(p, i, m.parts.length)).join('')}</div>
      <div class="me-add">${Object.entries(PART_KINDS).map(([k, t]) => `<button type="button" class="btn small ghost" data-action="me-add-part" data-kind="${k}" title="${t.desc}">＋ ${t.label}</button>`).join('')}</div>
    </section>

    <section class="ed-section">
      <h3>Fråga</h3>
      ${textArea([], 'fraga', m.fraga, { rows: 3, hint: '<code>{=a}</code> skriver värdet av a, <code>{=a:2}</code> med två decimaler, <code>{=b:s}</code> med tecken (+ 3 / − 3). Formel: <code>$\\frac{a}{b}$</code>' })}
      ${textArea([], 'underlag', m.underlag, { label: 'Underlag under frågan (valfritt, XML)', rows: 2, placeholder: '<diagram typ="stapel" etiketter="A;B;C" varden="{=item(L,1)};{=item(L,2)};{=item(L,3)}"/>' })}
    </section>

    <section class="ed-section">
      <h3>Svar</h3>
      ${m.svar.map((s, i) => {
        const p = ['svar', i];
        return `<div class="ed-card"><div class="ed-card-head"><span class="ed-card-title">Svarsruta ${i + 1}</span>
          <span class="ed-card-tools">${iconButton('me-svar-delete', p, '✕', 'Ta bort svarsrutan', m.svar.length === 1 ? 'disabled' : '')}</span></div>
          <div class="ed-card-body"><div class="me-part-grid">
            ${inputField(p, 'etikett', s.etikett, { label: 'Etikett' })}${inputField(p, 'varde', s.varde, { label: 'Rätt svar (uttryck)', cls: 'mono' })}
            ${inputField(p, 'enhet', s.enhet, { label: 'Enhet' })}${inputField(p, 'decimaler', s.decimaler, { label: 'Decimaler', type: 'number' })}</div>
            ${checkbox(p, 'exakt', s.exakt, 'Exakt svar (t.ex. antal lass)')}
            ${inputField(p, 'alternativ', s.alternativ || '', { label: 'Rullista i stället för textruta (valfritt)', placeholder: 'Lag A|Lag B  – rätt svar är då 0, 1, 2 … (ordningen)' })}
            ${textArea(p, 'fel', s.fel, { label: 'Vanliga felsvar (valfritt)', rows: 2, placeholder: '2*(a + b) = Det är omkretsen. Arean är längd gånger bredd.',
              hint: 'En rad per felsvar: <code>uttryck = förklaring</code>. Förklaringen visas när eleven svarar just det.' })}
          </div></div>`;
      }).join('')}
      <div class="me-add"><button type="button" class="btn small ghost" data-action="me-svar-add">＋ Svarsruta</button></div>
      <small class="ed-hint">Godkänt: inom 1 % av rätt svar, eller avrundat till angivet antal decimaler.</small>
    </section>

    <section class="ed-section">
      <h3>Lösning</h3>
      ${m.losningXml ? `${textArea([], 'losningXml', m.losningXml, { label: 'Lösningen som XML (har fler element än en uträkning)', rows: 4 })}` : `
      <div class="ed-rows">${m.losning.map((r, i) => {
        const rp = ['losning', i];
        return `<div class="ed-row"><select class="ed-in ed-kind" ${pathAttr(rp)} data-key="kind" aria-label="Radtyp">
            <option value="rad"${r.kind === 'rad' ? ' selected' : ''}>Steg (formel)</option><option value="radtext"${r.kind === 'radtext' ? ' selected' : ''}>Steg (text)</option>
            <option value="svar"${r.kind === 'svar' ? ' selected' : ''}>Svar (formel)</option><option value="svartext"${r.kind === 'svartext' ? ' selected' : ''}>Svar (text)</option></select>
          ${inputField(rp, 'text', r.text, { cls: r.kind.endsWith('text') ? '' : 'mono' })}${iconButton('me-row-delete', rp, '✕', 'Ta bort raden')}</div>`;
      }).join('')}</div>
      <div class="me-add"><button type="button" class="btn small ghost" data-action="me-row-add">＋ Rad</button></div>
      <small class="ed-hint">${TEX_HINT} Värden skrivs med <code>{=a}</code> även här.</small>`}
    </section>`;
  updateMallPreview();
}

/* ----- Förhandsvisning och test ----- */

function updateMallPreview() {
  const m = mallEditor.model;
  const errors = [];
  if (lessonStore.all.length && !lessonStore.all.some(l => l.id === m.lektion)) errors.push(`Lektionen "${m.lektion}" finns inte.`);
  if ([...templateStore.G, ...templateStore.VG].some(t => t.id === m.id)) errors.push(`Id "${m.id}" finns redan bland kursens mallar. Byt id för en ny mall.`);
  const names = m.parts.filter(p => p.namn).map(p => p.namn);
  names.filter((n, i) => names.indexOf(n) !== i && m.parts.filter(p => p.namn === n && p.kind !== 'rakna').length > 1)
    .forEach(n => errors.push(`Namnet "${n}" används av flera slumpvariabler.`));
  $('#me-seed').textContent = 'slump nr ' + mallEditor.seed;
  let q = null;
  try {
    q = instantiate(modelToTemplate(m), makeRandom(mallEditor.seed), 1, 1);
  } catch (e) { errors.push(e.message); }
  if (q && q.error) { errors.push('Fel i uttryck: ' + q.error); q = null; }
  if (!q && !errors.length) errors.push('Mallen gick inte att lösa på 400 försök. Kontrollera villkoren.');
  $('#me-errors').hidden = !errors.length;
  $('#me-errors').innerHTML = errors.map(e => `<p>${escapeHtml(e)}</p>`).join('');
  fieldCounter = 0;
  $('#me-preview').innerHTML = q ? `
    <div class="eyebrow">${m.niva} · ${escapeHtml(m.lektion)} · ${escapeHtml(String(m.poang))} p</div>
    <div class="q"><p>${q.q}</p>${q.u || ''}
      ${q.f.map((f, k) => fieldHTML(f, 'me-f-' + k)).join('')}
      <div class="btnrow"><button class="btn small" data-action="me-check">Kontrollera</button></div>
      <p class="note"><b>Rätt svar:</b> ${q.f.map(f => `${escapeHtml(f.l)} = ${f.sel ? escapeHtml(f.a) : formatNumber(f.a)} ${escapeHtml(f.u || '')}`).join(' · ')}
        ${q.f.some(f => f.fel && f.fel.length) ? `<br><b>Felsvar:</b> ${q.f.flatMap(f => (f.fel || []).map(x => formatNumber(x.v, 3))).join(' · ')}` : ''}</p>
      <div class="sol">${q.s}</div></div>` : '';
  mallEditor.lastQuestion = q;
  typeset($('#me-preview'));
  setupWidgets($('#me-preview'));
}

// Kör mallen med många slumptal och rapporterar problem
function testMall() {
  const t = modelToTemplate(mallEditor.model);
  let ok = 0, failed = 0, leftovers = 0;
  const errors = new Set();
  const ranges = [];
  let tries = 0;
  const r0 = makeRandom(4711);
  for (let i = 0; i < 300; i++) { try { if (drawVariables(t, r0)) tries++; } catch (e) { errors.add(e.message); break; } }
  for (let s = 1; s <= 300; s++) {
    const q = instantiate(t, makeRandom(s * 7919), 1, 1);
    if (!q) { failed++; continue; }
    if (q.error) { errors.add(q.error); failed++; continue; }
    if (/\{=/.test(q.q + q.s)) leftovers++;
    ok++;
    q.f.forEach((f, k) => {
      if (f.sel) return;
      ranges[k] = ranges[k] || { l: f.l, u: f.u, min: Infinity, max: -Infinity };
      ranges[k].min = Math.min(ranges[k].min, f.a);
      ranges[k].max = Math.max(ranges[k].max, f.a);
    });
  }
  const rate = Math.round(tries / 3);
  $('#me-testres').innerHTML = `<div class="ed-section">
    <h3>Test av 300 slumpningar</h3>
    <p>${ok === 300 && !leftovers ? '✓ Alla 300 gick att lösa.' : `✗ ${failed} misslyckades${leftovers ? `, ${leftovers} hade kvar {= i texten` : ''}.`}</p>
    <p class="note">Villkoren godkände ${rate} % av dragningarna direkt${rate < 5 ? ' – det är lågt. Gör intervallen snävare så blir mallen säkrare.' : '.'}</p>
    ${ranges.map(r => `<p class="note">${escapeHtml(r.l)}: från ${formatNumber(r.min)} till ${formatNumber(r.max)} ${escapeHtml(r.u || '')}</p>`).join('')}
    ${[...errors].map(e => `<p class="note err">${escapeHtml(e)}</p>`).join('')}
    <p class="note">Rimliga svar? Kontrollera att intervallen ovan ser ut som verkliga mått och priser.</p></div>`;
}

/* ----- Samlingen ----- */

function setMallStatus(text, isError) {
  $('#me-status').textContent = text;
  $('#me-status').classList.toggle('err', !!isError);
}

function saveCollection() { storage.set('mall-samling', mallEditor.collection); }

function renderCollection() {
  const ids = Object.keys(mallEditor.collection);
  $('#me-collection').innerHTML = ids.length
    ? `<ul class="me-list">${ids.map(id => `<li><button class="linkbtn" data-me-open="${escapeHtml(id)}">${escapeHtml(id)}</button>
        <button class="btn ghost small" data-me-remove="${escapeHtml(id)}" aria-label="Ta bort ${escapeHtml(id)}">✕</button></li>`).join('')}</ul>`
    : '<p class="note">Inga egna mallar ännu. Tryck "Spara i min samling".</p>';
}

function collectionXml() {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Egna tentamallar. Lägg filen i mappen mallar/ och skriv in den i mallar/index.xml. -->\n<mallar>\n' +
    Object.values(mallEditor.collection).join('\n') + '\n</mallar>\n';
}

function fillMallOpenSelect() {
  const byLesson = {};
  [...templateStore.G, ...templateStore.VG].forEach(t => { (byLesson[t.lektion] = byLesson[t.lektion] || []).push(t); });
  $('#me-open').innerHTML = '<option value="">Öppna mall…</option><option value="new">＋ Ny mall</option>' +
    Object.keys(byLesson).map(l => `<optgroup label="Kursens mallar: ${escapeHtml(l)}">${byLesson[l].map(t => `<option value="kurs:${escapeHtml(t.id)}">${escapeHtml(t.id)}</option>`).join('')}</optgroup>`).join('');
}

function loadMall(model) {
  mallEditor.model = model;
  mallEditor.seed = 1;
  $('#me-testres').innerHTML = '';
  renderMallForm();
  storage.set('mall-utkast', mallToXml(model));
}

function loadMallXml(xml) {
  const doc = new DOMParser().parseFromString('<mallar>' + xml + '</mallar>', 'application/xml');
  if (doc.getElementsByTagName('parsererror')[0]) throw new Error('XML:en innehåller fel.');
  const el = doc.getElementsByTagName('mall')[0];
  if (!el) throw new Error('Ingen <mall> hittades.');
  loadMall(xmlToMall(el));
}

async function downloadCollection() {
  if (!Object.keys(mallEditor.collection).length) { setMallStatus('Samlingen är tom. Spara först en mall.', true); return; }
  const text = collectionXml();
  const downloads = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
  try {
    if (downloads) {
      await downloads.save({ filename: 'egna-mallar.zip', data: makeZip([{ name: 'egna-mallar.xml', text }]) });
      setMallStatus('Sparad som egna-mallar.zip. Packa upp och lägg egna-mallar.xml i mappen mallar/.');
      return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'application/xml' }));
    link.download = 'egna-mallar.xml';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    setMallStatus('Laddar ner egna-mallar.xml. Lägg den i mappen mallar/ och skriv <fil>egna-mallar.xml</fil> i mallar/index.xml.');
  } catch (e) {
    setMallStatus(e && e.code === 'declined' ? 'Nedladdningen avbröts.' : 'Nedladdning gick inte här. Använd Kopiera XML under Avancerat.', e && e.code !== 'declined');
  }
}

/* ----- Händelser ----- */

function onMallInput(e) {
  const el = e.target;
  if (!el.dataset || !el.dataset.key) return;
  const target = getAt(mallEditor.model, JSON.parse(el.dataset.path));
  target[el.dataset.key] = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.key === 'kind') { renderMallForm(); return; }
  clearTimeout(mallEditor.timer);
  mallEditor.timer = setTimeout(() => { storage.set('mall-utkast', mallToXml(mallEditor.model)); updateMallPreview(); }, 250);
}

function onMallClick(e) {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const m = mallEditor.model;
  const path = b.dataset.path ? JSON.parse(b.dataset.path) : [];
  const i = path[path.length - 1];
  const move = (list, from, to) => { if (to >= 0 && to < list.length) list.splice(to, 0, list.splice(from, 1)[0]); };
  switch (b.dataset.action) {
    case 'me-add-part': {
      const k = b.dataset.kind;
      const n = 'abcdefghijklmnopqrstuvwxyz'.split('').find(c => !m.parts.some(p => p.namn === c)) || 'x';
      m.parts.push(k === 'var' ? { kind: k, namn: n, min: '1', max: '10', steg: '', decimaler: '0' }
        : k === 'val' ? { kind: k, namn: n, alternativ: '1|2|3' }
        : k === 'lista' ? { kind: k, namn: 'L', antal: '5', min: '10', max: '20', decimaler: '0' }
        : k === 'rakna' ? { kind: k, namn: n, uttryck: '' } : { kind: k, uttryck: '' });
      break;
    }
    case 'me-up': move(m.parts, i, i - 1); break;
    case 'me-down': move(m.parts, i, i + 1); break;
    case 'me-delete': m.parts.splice(i, 1); break;
    case 'me-svar-add': m.svar.push({ etikett: 'Svar', enhet: '', varde: '', decimaler: '1', exakt: false, fel: '' }); break;
    case 'me-svar-delete': m.svar.splice(i, 1); break;
    case 'me-row-add': m.losning.push({ kind: 'rad', text: '' }); break;
    case 'me-row-delete': m.losning.splice(i, 1); break;
    default: return;
  }
  renderMallForm();
}

function setupMallEditor() {
  $('#me-form').addEventListener('input', onMallInput);
  $('#me-form').addEventListener('change', e => { if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT') onMallInput(e); });
  $('#me-form').addEventListener('click', onMallClick);
  $('#me-reroll').onclick = () => { mallEditor.seed++; updateMallPreview(); };
  $('#me-test').onclick = testMall;
  $('#me-preview').addEventListener('click', e => {
    if (!e.target.closest('[data-action="me-check"]') || !mallEditor.lastQuestion) return;
    mallEditor.lastQuestion.f.forEach((f, k) => checkField(f, 'me-f-' + k));
  });
  $('#me-open').onchange = e => {
    const v = e.target.value;
    e.target.value = '';
    if (v === 'new') loadMall(newMallModel());
    if (v.startsWith('kurs:')) {
      const t = [...templateStore.G, ...templateStore.VG].find(x => x.id === v.slice(5));
      if (t) { loadMallXml(t.xml); mallEditor.model.id = t.id + '-kopia'; renderMallForm(); setMallStatus(`Kopia av ${t.id}. Byt gärna id.`); }
    }
  };
  $('#me-save').onclick = () => {
    const m = mallEditor.model;
    if (!m.id.trim()) { setMallStatus('Mallen behöver ett id.', true); return; }
    mallEditor.collection[m.id] = mallToXml(m);
    saveCollection();
    renderCollection();
    setMallStatus(`"${m.id}" är sparad i din samling (${Object.keys(mallEditor.collection).length} st).`);
  };
  $('#me-download').onclick = downloadCollection;
  $('#me-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(mallToXml(mallEditor.model)); setMallStatus('Mallens XML är kopierad.'); }
    catch (e) { $('#me-advanced').open = true; $('#me-xml').value = mallToXml(mallEditor.model); $('#me-xml').select(); setMallStatus('Markerad under Avancerat – kopiera med Ctrl+C.'); }
  };
  $('#me-collection').addEventListener('click', e => {
    const open = e.target.closest('[data-me-open]');
    const remove = e.target.closest('[data-me-remove]');
    if (open) loadMallXml(mallEditor.collection[open.dataset.meOpen]);
    if (remove) { delete mallEditor.collection[remove.dataset.meRemove]; saveCollection(); renderCollection(); }
  });
  $('#me-import').onchange = async e => {
    let count = 0, first = null;
    for (const file of e.target.files) {
      const doc = new DOMParser().parseFromString(await file.text(), 'application/xml');
      for (const el of doc.getElementsByTagName('mall')) {
        const xml = '  ' + new XMLSerializer().serializeToString(el).replace(/ xmlns="[^"]*"/g, '');
        mallEditor.collection[el.getAttribute('id')] = xml;
        first = first || xml;
        count++;
      }
    }
    e.target.value = '';
    saveCollection();
    renderCollection();
    if (first) loadMallXml(first);
    setMallStatus(`${count} mallar importerades till din samling.`);
  };
  $('#me-advanced').addEventListener('toggle', () => { if ($('#me-advanced').open) $('#me-xml').value = mallToXml(mallEditor.model); });
  $('#me-apply-xml').onclick = () => {
    try { loadMallXml($('#me-xml').value); setMallStatus('XML:en är inläst.'); } catch (err) { setMallStatus(err.message, true); }
  };
  $$('[data-memode]').forEach(b => b.onclick = () => {
    $('#view-mallar').dataset.mode = b.dataset.memode;
    $$('[data-memode]').forEach(x => x.setAttribute('aria-pressed', x === b));
  });
}

function mallEditorOpened() {
  if (mallEditor.model) return;
  fillMallOpenSelect();
  renderCollection();
  const draft = storage.get('mall-utkast', null);
  try { if (draft) { loadMallXml(draft); return; } } catch (e) { /* börja om */ }
  loadMall(newMallModel());
}
