/* ---------- Editorns datamodell ----------
   Editorn arbetar med ett vanligt JavaScript-objekt (modellen) och gör om
   det till XML när lektionen sparas eller förhandsvisas.

   Modell:
     { id, ordning, omrade, titel, titelEn,
       slides: [{ titel, etikett, rubrik, brodtext, say, sayEn, blocks: [...] }] }

   Block (element på en bild), t.ex.:
     { type: 'text', text: 'Hej $a^2$' }
     { type: 'formel', tex: 'G = m \\cdot g', stor: false }
     { type: 'berakning', rows: [{ kind: 'rad' | 'radtext' | 'svar' | 'svartext', text }] }
     { type: 'kolumner', cols: [[block, …], [block, …]] }
     { type: 'testa', fraga, rutor: [{ etikett, enhet, svar, tolerans }], losning: [block, …] }

   I textfälten skriver man vanlig text där
     $formel$  blir en formel (LaTeX),  **fet** blir fet,  ny rad blir radbrytning. */

// Vanlig text med $formel$ och **fet** -> XML-innehåll
function friendlyToXml(text) {
  return xmlEscape(String(text || '').trim())
    .replace(/\$([^$]+)\$/g, '<m>$1</m>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\r?\n/g, '<br/>');
}

// XML-innehåll -> vanlig text med $formel$ och **fet**
function xmlToFriendly(element) {
  let text = '';
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
      text += node.nodeValue.replace(/\s+/g, ' ').replace(/\\\((.+?)\\\)/g, '$$$1$$');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.localName;
      if (tag === 'm') text += '$' + node.textContent.trim() + '$';
      else if (tag === 'b') text += '**' + xmlToFriendly(node) + '**';
      else if (tag === 'br') text += '\n';
      else text += xmlToFriendly(node);
    }
  }
  return text.replace(/ *\n */g, '\n').trim();
}

/* Elementtyper som kan läggas till med +. nested = får finnas i kolumner och lösningar. */
const BLOCK_TYPES = [
  { type: 'underrubrik', label: 'Underrubrik', desc: 'Mindre rubrik', nested: true,
    make: () => ({ type: 'underrubrik', text: 'Underrubrik' }) },
  { type: 'text', label: 'Text', desc: 'Ett stycke brödtext', nested: true,
    make: () => ({ type: 'text', text: 'Skriv text här. En formel i texten: $a^2 + b^2 = c^2$' }) },
  { type: 'formel', label: 'Formel', desc: 'Formel i blå ruta (LaTeX)', nested: true,
    make: () => ({ type: 'formel', tex: 'G = m \\cdot g', stor: false }) },
  { type: 'berakning', label: 'Uträkning', desc: 'Steg för steg med grönt svar', nested: true,
    make: () => ({ type: 'berakning', rows: [{ kind: 'rad', text: 'A = l \\cdot b' }, { kind: 'rad', text: 'A = 4,0 \\cdot 3,0' }, { kind: 'svar', text: 'A = 12\\enh{m^2}' }] }) },
  { type: 'tips', label: 'Tips', desc: 'Grön tipsruta', nested: true,
    make: () => ({ type: 'tips', text: 'Ett bra tips.' }) },
  { type: 'varning', label: 'Fälla', desc: 'Röd ruta för vanliga fel', nested: true,
    make: () => ({ type: 'varning', text: 'Vanligt fel att se upp med.' }) },
  { type: 'lista', label: 'Punktlista', desc: 'Punkter eller numrerad lista', nested: true,
    make: () => ({ type: 'lista', numrerad: false, items: ['Första punkten', 'Andra punkten'] }) },
  { type: 'steg', label: 'Steg', desc: 'Numrerade steg med runda siffror', nested: true,
    make: () => ({ type: 'steg', items: ['Första steget', 'Andra steget'] }) },
  { type: 'tabell', label: 'Tabell', desc: 'Rader och kolumner', nested: true,
    make: () => ({ type: 'tabell', forstaKolumnRubrik: false, rows: [{ header: true, cells: ['Material', 'γ (kN/m³)'] }, { header: false, cells: ['Betong', '24'] }] }) },
  { type: 'figur', label: 'Figur', desc: 'Färdig figur', nested: true,
    make: () => ({ type: 'figur', namn: 'rektangel', svg: '' }) },
  { type: 'diagram', label: 'Diagram', desc: 'Stapel-, linje- eller punktdiagram, eller graf', nested: true,
    make: () => ({ type: 'diagram', typ: 'stapel', titel: 'Antal per månad', x: 'Månad', y: 'Antal', etiketter: 'Jan;Feb;Mar;Apr', varden: '12;18;9;15', uttryck: '', xmin: '', xmax: '' }) },
  { type: 'interaktiv', label: 'Prova själv (interaktiv)', desc: 'Reglagemodell: räta linjen, statistik, trig …', nested: false,
    make: () => ({ type: 'interaktiv', typ: 'rata-linjen', extra: {} }) },
  { type: 'kolumner', label: 'Två kolumner', desc: 'Innehåll sida vid sida', nested: false,
    make: () => ({ type: 'kolumner', cols: [[{ type: 'text', text: 'Vänster kolumn' }], [{ type: 'text', text: 'Höger kolumn' }]] }) },
  { type: 'testa', label: 'Testa dig', desc: 'Övningsfråga med svar och lösning', nested: false,
    make: () => ({ type: 'testa', fraga: 'Skriv frågan här.', rutor: [{ etikett: 'Svar', enhet: '', svar: '', tolerans: '' }], losning: [{ type: 'berakning', rows: [{ kind: 'svar', text: 'x = 1' }] }] }) },
  { type: 'knapp', label: 'Knapp till tentan', desc: 'Öppnar övningstentan', nested: false,
    make: () => ({ type: 'knapp', text: 'Starta övningstentan' }) },
  { type: 'rubrik', label: 'Extra rubrik', desc: 'Stor rubrik längre ner på bilden', nested: true,
    make: () => ({ type: 'rubrik', text: 'Rubrik' }) },
];
const blockLabel = type => (BLOCK_TYPES.find(t => t.type === type) || { label: 'Okänt element' }).label;

/* ----- XML -> modell ----- */

function elementToBlock(el) {
  const kids = [...el.children];
  switch (el.localName) {
    case 'rubrik': case 'underrubrik': case 'text': case 'tips': case 'varning':
      return { type: el.localName, text: xmlToFriendly(el) };
    case 'formel':
      return { type: 'formel', tex: el.textContent.trim(), stor: isYes(el, 'stor') };
    case 'berakning':
      return { type: 'berakning', rows: kids.map(r => {
        const asText = isYes(r, 'text');
        const kind = (r.localName === 'svar' ? 'svar' : 'rad') + (asText ? 'text' : '');
        return { kind, text: asText ? xmlToFriendly(r) : r.textContent.trim() };
      }) };
    case 'lista':
      return { type: 'lista', numrerad: isYes(el, 'numrerad'), items: kids.map(xmlToFriendly) };
    case 'steg':
      return { type: 'steg', items: kids.map(xmlToFriendly) };
    case 'tabell':
      return { type: 'tabell', forstaKolumnRubrik: el.getAttribute('forstakolumn') === 'rubrik',
        rows: kids.map(r => ({ header: isYes(r, 'rubrik'), cells: [...r.children].map(xmlToFriendly) })) };
    case 'kolumner':
      return { type: 'kolumner', cols: kids.map(col => [...col.children].map(elementToBlock)) };
    case 'figur': {
      const svg = el.getElementsByTagName('svg')[0];
      return { type: 'figur', namn: el.getAttribute('namn') || '', svg: svg ? new XMLSerializer().serializeToString(svg) : '' };
    }
    case 'testa': {
      const q = el.getElementsByTagName('fraga')[0];
      const sol = el.getElementsByTagName('losning')[0];
      return {
        type: 'testa',
        fraga: q ? xmlToFriendly(q) : '',
        rutor: [...el.getElementsByTagName('ruta')].map(r => ({
          etikett: r.getAttribute('etikett') || '', enhet: r.getAttribute('enhet') || '',
          svar: r.getAttribute('svar') || '', tolerans: r.getAttribute('tolerans') || '',
          fel: [...r.getElementsByTagName('fel')].map(f => `${f.getAttribute('varde')} = ${f.textContent.trim()}`).join('\n'),
        })),
        losning: sol ? [...sol.children].map(elementToBlock) : [],
      };
    }
    case 'knapp':
      return { type: 'knapp', text: xmlToFriendly(el) };
    case 'diagram':
      if ([...el.children].length) break;   // diagram med <serie> visas som XML
      return { type: 'diagram', typ: el.getAttribute('typ') || 'stapel', titel: el.getAttribute('titel') || '', x: el.getAttribute('x') || '',
        y: el.getAttribute('y') || '', etiketter: el.getAttribute('etiketter') || '', varden: el.getAttribute('varden') || '',
        uttryck: el.getAttribute('uttryck') || '', xmin: el.getAttribute('xmin') || '', xmax: el.getAttribute('xmax') || '' };
    case 'interaktiv': {
      const extra = {};
      [...el.attributes].forEach(a => { if (a.name !== 'typ') extra[a.name] = a.value; });
      return { type: 'interaktiv', typ: el.getAttribute('typ') || 'rata-linjen', extra };
    }
  }
  switch (el.localName) {
    default:
      return { type: 'raw', xml: new XMLSerializer().serializeToString(el).replace(/ xmlns="[^"]*"/, '') };
  }
}

function lessonToModel(lesson) {
  return {
    id: lesson.id,
    ordning: lesson.ordning,
    omrade: lesson.omrade,
    titel: lesson.titel,
    titelEn: lesson.titelEn === lesson.titel ? '' : lesson.titelEn,
    slides: lesson.slides.map(({ element }) => {
      const kids = [...element.children].filter(el => el.localName !== 'berattare');
      const slide = {
        titel: element.getAttribute('titel') || '',
        etikett: element.getAttribute('etikett') || '',
        rubrik: '', brodtext: '',
        say: narrationText(element, 'sv'),
        sayEn: narrationText(element, 'en'),
        blocks: [],
      };
      // Första rubriken och första texten direkt efter blir de fasta fälten
      if (kids[0] && kids[0].localName === 'rubrik') slide.rubrik = xmlToFriendly(kids.shift());
      if (kids[0] && kids[0].localName === 'text') slide.brodtext = xmlToFriendly(kids.shift());
      slide.blocks = kids.map(elementToBlock);
      return slide;
    }),
  };
}

/* ----- modell -> XML ----- */

const ind = depth => '  '.repeat(depth);

function blocksToXml(blocks, depth) {
  return blocks.map(b => blockToXml(b, depth)).filter(Boolean).join('\n');
}

function blockToXml(b, d) {
  const pad = ind(d);
  switch (b.type) {
    case 'rubrik': case 'underrubrik': case 'text': case 'tips': case 'varning':
      return b.text.trim() ? `${pad}<${b.type}>${friendlyToXml(b.text)}</${b.type}>` : '';
    case 'formel':
      return b.tex.trim() ? `${pad}<formel${b.stor ? ' stor="ja"' : ''}>${xmlEscape(b.tex.trim())}</formel>` : '';
    case 'berakning': {
      const rows = b.rows.filter(r => r.text.trim()).map(r => {
        const tag = r.kind.startsWith('svar') ? 'svar' : 'rad';
        const asText = r.kind.endsWith('text');
        return `${ind(d + 1)}<${tag}${asText ? ' text="ja"' : ''}>${asText ? friendlyToXml(r.text) : xmlEscape(r.text.trim())}</${tag}>`;
      });
      return rows.length ? `${pad}<berakning>\n${rows.join('\n')}\n${pad}</berakning>` : '';
    }
    case 'lista': case 'steg': {
      const items = b.items.filter(i => i.trim()).map(i => `${ind(d + 1)}<punkt>${friendlyToXml(i)}</punkt>`);
      const attr = b.type === 'lista' && b.numrerad ? ' numrerad="ja"' : '';
      return items.length ? `${pad}<${b.type}${attr}>\n${items.join('\n')}\n${pad}</${b.type}>` : '';
    }
    case 'tabell': {
      const rows = b.rows.filter(r => r.cells.some(c => c.trim())).map(r =>
        `${ind(d + 1)}<rad${r.header ? ' rubrik="ja"' : ''}>${r.cells.map(c => `<cell>${friendlyToXml(c)}</cell>`).join('')}</rad>`);
      return rows.length ? `${pad}<tabell${b.forstaKolumnRubrik ? ' forstakolumn="rubrik"' : ''}>\n${rows.join('\n')}\n${pad}</tabell>` : '';
    }
    case 'kolumner':
      return `${pad}<kolumner>\n${b.cols.map(col =>
        `${ind(d + 1)}<kolumn>\n${blocksToXml(col, d + 2)}\n${ind(d + 1)}</kolumn>`).join('\n')}\n${pad}</kolumner>`;
    case 'figur':
      return b.svg ? `${pad}<figur>${b.svg}</figur>` : `${pad}<figur namn="${xmlEscape(b.namn)}"/>`;
    case 'testa': {
      const rutor = b.rutor.map(r => `${ind(d + 1)}<ruta etikett="${xmlEscape(r.etikett)}"` +
        (r.enhet ? ` enhet="${xmlEscape(r.enhet)}"` : '') + ` svar="${xmlEscape(r.svar)}"` +
        (String(r.tolerans).trim() ? ` tolerans="${xmlEscape(r.tolerans)}"` : '') + felToXml(r.fel));
      const sol = blocksToXml(b.losning, d + 2);
      return `${pad}<testa>\n${ind(d + 1)}<fraga>${friendlyToXml(b.fraga)}</fraga>\n${rutor.join('\n')}` +
        (sol ? `\n${ind(d + 1)}<losning>\n${sol}\n${ind(d + 1)}</losning>` : '') + `\n${pad}</testa>`;
    }
    case 'knapp':
      return `${pad}<knapp typ="tenta">${friendlyToXml(b.text)}</knapp>`;
    case 'diagram': {
      const attr = (name, value) => (String(value || '').trim() ? ` ${name}="${xmlEscape(String(value).trim())}"` : '');
      return `${pad}<diagram typ="${xmlEscape(b.typ)}"` + attr('titel', b.titel) + attr('x', b.x) + attr('y', b.y) +
        (b.typ === 'funktion' ? attr('uttryck', b.uttryck) + attr('xmin', b.xmin) + attr('xmax', b.xmax) : attr('etiketter', b.etiketter) + attr('varden', b.varden)) + '/>';
    }
    case 'interaktiv':
      return `${pad}<interaktiv typ="${xmlEscape(b.typ)}"` + Object.entries(b.extra || {}).map(([k, v]) => ` ${k}="${xmlEscape(v)}"`).join('') + '/>';
    case 'raw':
      return b.xml.trim() ? pad + b.xml.trim() : '';
    default:
      return '';
  }
}

function slideToXml(s) {
  const parts = [`  <bild titel="${xmlEscape(s.titel)}"${s.etikett ? ` etikett="${xmlEscape(s.etikett)}"` : ''}>`];
  if (s.rubrik.trim()) parts.push(`    <rubrik>${friendlyToXml(s.rubrik)}</rubrik>`);
  if (s.brodtext.trim()) parts.push(`    <text>${friendlyToXml(s.brodtext)}</text>`);
  const blocks = blocksToXml(s.blocks, 2);
  if (blocks) parts.push(blocks);
  if (s.say.trim()) parts.push(`    <berattare>${xmlEscape(s.say.trim())}</berattare>`);
  if (s.sayEn.trim()) parts.push(`    <berattare sprak="en">${xmlEscape(s.sayEn.trim())}</berattare>`);
  parts.push('  </bild>');
  return parts.join('\n');
}

function modelToXml(m) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<lektion id="${xmlEscape(m.id)}" ordning="${xmlEscape(m.ordning)}" omrade="${xmlEscape(m.omrade)}" ` +
    `titel="${xmlEscape(m.titel)}"${m.titelEn ? ` titel-en="${xmlEscape(m.titelEn)}"` : ''}>\n\n` +
    m.slides.map(slideToXml).join('\n\n') + '\n\n</lektion>\n';
}

/* ----- Mallar ----- */

function newSlide(number) {
  return {
    titel: `Bild ${number}`, etikett: '', rubrik: 'Rubrik på bilden',
    brodtext: 'Skriv brödtext här. Formler i texten skrivs mellan dollartecken: $A = l \\cdot b$',
    say: 'Det här säger Kapten Kalkyl när bilden visas.', sayEn: '', blocks: [],
  };
}

function newLessonModel() {
  return { id: 'min-lektion', ordning: 55, omrade: 'Geometri', titel: 'Min lektion', titelEn: '', slides: [newSlide(1)] };
}

// Gör ett id av en titel: "Area & volym" -> "area-volym"
const slugify = text => String(text).toLowerCase()
  .replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/é/g, 'e')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'lektion';

// Felsvar till en svarsruta: en rad per felsvar, "värde = förklaring".
function felToXml(text) {
  const lines = String(text || '').split('\n').map(l => l.trim()).filter(l => l.includes('='));
  if (!lines.length) return '/>';
  return '>' + lines.map(l => {
    const i = l.indexOf('=');
    return `<fel varde="${xmlEscape(l.slice(0, i).trim())}">${xmlEscape(l.slice(i + 1).trim())}</fel>`;
  }).join('') + '</ruta>';
}
