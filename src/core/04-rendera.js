/* ---------- Från XML-taggar till HTML ----------
   Varje tagg i lektionsfilerna har en funktion i BLOCK nedan.
   Vill du skapa en ny tagg: lägg till en rad i BLOCK och beskriv den i LÄSMIG.txt. */

let fieldCounter = 0;   // ger unika id:n åt svarsrutor

// Text som kan innehålla <m>formel</m>, \( formel \), <b>, <i> och <br/>.
function inline(element) {
  let html = '';
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
      // Dela texten i vanlig text och \( formler \)
      html += node.nodeValue.split(/(\\\(.+?\\\))/s)
        .map(part => /^\\\(.*\\\)$/s.test(part) ? inlineMath(part.slice(2, -2)) : escapeHtml(part))
        .join('');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.localName;
      if (tag === 'm') html += inlineMath(node.textContent);
      else if (tag === 'b') html += `<b>${inline(node)}</b>`;
      else if (tag === 'i') html += `<i>${inline(node)}</i>`;
      else if (tag === 'br') html += '<br>';
      else html += inline(node);
    }
  }
  return html.trim();
}

const children = element => [...element.children];
const isYes = (element, attr) => /^(ja|yes|true)$/i.test(element.getAttribute(attr) || '');

// En rad i en beräkning: formel, eller vanlig text om text="ja".
function calcRow(row) {
  const content = isYes(row, 'text') ? `<span class="calc-text">${inline(row)}</span>` : displayMath(row.textContent);
  return `<div class="calc-row${row.localName === 'svar' ? ' ans' : ''}">${content}</div>`;
}

const BLOCK = {
  rubrik:      el => `<h2>${inline(el)}</h2>`,
  underrubrik: el => `<h3>${inline(el)}</h3>`,
  text:        el => `<p>${inline(el)}</p>`,
  formel:      el => `<div class="formula-row"><span class="formula${isYes(el, 'stor') ? ' big' : ''}">${displayMath(el.textContent)}</span></div>`,
  berakning:   el => `<div class="calc">${children(el).map(calcRow).join('')}</div>`,
  tips:        el => `<div class="tip"><b>Tips:</b> ${inline(el)}</div>`,
  varning:     el => `<div class="trap"><b>Fälla:</b> ${inline(el)}</div>`,
  lista:       el => {
    const tag = isYes(el, 'numrerad') ? 'ol' : 'ul';
    return `<${tag}>${children(el).map(p => `<li>${inline(p)}</li>`).join('')}</${tag}>`;
  },
  steg:        el => `<ol class="steps">${children(el).map(p => `<li><div>${inline(p)}</div></li>`).join('')}</ol>`,
  tabell:      el => {
    const firstColHeader = el.getAttribute('forstakolumn') === 'rubrik';
    const rows = children(el).map(row => {
      const headerRow = isYes(row, 'rubrik');
      const cells = children(row).map((cell, i) => {
        const tag = headerRow || (firstColHeader && i === 0) ? 'th' : 'td';
        return `<${tag}>${inline(cell)}</${tag}>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<div class="tbl"><table class="t">${rows}</table></div>`;
  },
  kolumner:    el => `<div class="cols">${children(el).map(col => `<div>${renderBlocks(col)}</div>`).join('')}</div>`,
  figur:       el => {
    const svg = el.getElementsByTagName('svg')[0];
    if (svg) return `<div class="figure">${new XMLSerializer().serializeToString(svg)}</div>`;
    const name = el.getAttribute('namn');
    if (FIGURER[name]) return `<div class="figure">${FIGURER[name]}</div>`;
    return `<div class="trap"><b>Okänd figur:</b> "${escapeHtml(name || '')}". Finns: ${Object.keys(FIGURER).join(', ')}</div>`;
  },
  testa:       el => renderQuiz(el),
  diagram:     el => renderDiagram(el),
  interaktiv:  el => renderInteractive(el),
  underlag:    el => renderBlocks(el),
  knapp:       el => el.getAttribute('typ') === 'tenta'
    ? `<div class="btnrow cta"><button class="btn primary" data-action="go-to-exam">${inline(el) || 'Starta övningstentan'} ▶</button></div>`
    : '',
  berattare:   () => '',   // berättartexten visas i pratbubblan, inte på bilden
};

function renderBlocks(container) {
  return children(container).map(el => {
    const render = BLOCK[el.localName];
    if (render) return render(el);
    return `<div class="trap"><b>Okänd tagg:</b> &lt;${escapeHtml(el.localName)}&gt;</div>`;
  }).join('');
}

// <testa>: fråga, svarsrutor, kontrollknapp och lösning.
function renderQuiz(el) {
  const quizId = 'quiz-' + (++fieldCounter);
  const question = el.getElementsByTagName('fraga')[0];
  const solution = el.getElementsByTagName('losning')[0];
  const fields = [...el.getElementsByTagName('ruta')].map(ruta => ({
    l: ruta.getAttribute('etikett') || 'Svar',
    u: ruta.getAttribute('enhet') || '',
    a: parseNumber(ruta.getAttribute('svar')),
    tol: ruta.hasAttribute('tolerans') ? parseNumber(ruta.getAttribute('tolerans')) : null,
    fel: [...ruta.getElementsByTagName('fel')].map(f => ({ v: parseNumber(f.getAttribute('varde')), t: f.textContent.trim() })),
  }));
  quizRegistry[quizId] = fields;
  return `<div class="quiz" id="${quizId}">
    <div class="qh">Testa dig</div>
    ${question ? `<p>${inline(question)}</p>` : ''}
    ${fields.map((f, i) => fieldHTML(f, `${quizId}-${i}`)).join('')}
    <div class="btnrow">
      <button class="btn primary" data-action="check-quiz" data-quiz="${quizId}">Kontrollera</button>
      ${solution ? `<button class="btn ghost" data-action="toggle" data-target="${quizId}-sol">Visa lösning</button>` : ''}
    </div>
    ${solution ? `<div class="sol hidden" id="${quizId}-sol">${renderBlocks(solution)}</div>` : ''}
  </div>`;
}

// Svarsrutor för alla quiz som visas just nu: { quizId: [fält] }
const quizRegistry = {};

// Hela bilden som HTML (utan ritningshuvud).
function renderSlideContent(slideElement) {
  const label = slideElement.getAttribute('etikett');
  return (label ? `<div class="eyebrow">${escapeHtml(label)}</div>` : '') + renderBlocks(slideElement);
}

// Knappar inne i bilder (quiz, lösning, starta tenta) hanteras här för alla ytor.
function handleSlideClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'toggle') {
    const target = document.getElementById(button.dataset.target);
    if (target) { target.classList.toggle('hidden'); typeset(target); }
  }
  if (action === 'check-quiz') {
    const quizId = button.dataset.quiz;
    (quizRegistry[quizId] || []).forEach((f, i) => checkField(f, `${quizId}-${i}`));
  }
  if (action === 'go-to-exam' && typeof showView === 'function') showView('exam');
}
