/* ---------- Diagram och interaktiva bilder ----------
   <diagram>     ritar ett stapel-, linje-, punkt- eller funktionsdiagram som SVG.
                 Fungerar både i lektioner och i tentamallar (inuti <underlag>).
   <interaktiv>  en liten "prova själv"-modell med reglage: rata-linjen, statistik,
                 trig, interpolation, tyngdpunkt, procent.
   Diagrammen följer sidans färger (även mörkt läge) och visar värdet när man
   pekar på en stapel eller punkt. */

const fmt = (v, d) => formatNumber(v, d);

// "Snygga" skalsteg: 1, 2, 5, 10, 20, 50 …
function niceTicks(min, max, count = 5) {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= raw) || 10 * mag;
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return { lo, hi, step, ticks };
}

const splitValues = text => String(text || '').split(/[;|]/).map(s => s.trim()).filter(s => s !== '');

/* ----- Statiska diagram ----- */
// Läser <diagram> till { typ, titel, xLabel, yLabel, series: [{ namn, points: [{x, y}] }] }
function readDiagram(el) {
  const typ = el.getAttribute('typ') || 'stapel';
  const series = [];
  const serieEls = [...el.children].filter(c => c.localName === 'serie');
  if (serieEls.length) {
    for (const s of serieEls) {
      series.push({ namn: s.getAttribute('namn') || '', points: [...s.children].filter(c => c.localName === 'v')
        .map(v => ({ x: v.getAttribute('x'), y: parseNumber(v.getAttribute('y')) })) });
    }
  } else if (el.hasAttribute('varden')) {
    const labels = splitValues(el.getAttribute('etiketter'));
    const values = splitValues(el.getAttribute('varden')).map(parseNumber);
    series.push({ namn: el.getAttribute('namn') || '', points: values.map((y, i) => ({ x: labels[i] != null ? labels[i] : String(i + 1), y })) });
  } else {
    const points = [...el.children].filter(c => c.localName === 'v').map(v => ({ x: v.getAttribute('x'), y: parseNumber(v.getAttribute('y')) }));
    series.push({ namn: el.getAttribute('namn') || '', points });
  }
  return {
    typ, series,
    titel: el.getAttribute('titel') || '',
    xLabel: el.getAttribute('x') || '', yLabel: el.getAttribute('y') || '',
    ymin: el.hasAttribute('ymin') ? parseNumber(el.getAttribute('ymin')) : null,
    ymax: el.hasAttribute('ymax') ? parseNumber(el.getAttribute('ymax')) : null,
    uttryck: el.getAttribute('uttryck'), xmin: parseNumber(el.getAttribute('xmin') || '-10'), xmax: parseNumber(el.getAttribute('xmax') || '10'),
    rutnat: el.getAttribute('rutnat') !== 'nej',
    visaVarden: el.getAttribute('visavarden') === 'ja',   // visa alla värden (t.ex. i tentauppgifter)
  };
}

const CHART_W = 480, CHART_H = 280, CHART_PAD = { l: 52, r: 16, t: 18, b: 46 };
const SERIES_CLASS = ['s1', 's2', 's3'];

function axisLabels(d) {
  return (d.yLabel ? `<text class="ax-title" x="12" y="${CHART_PAD.t + (CHART_H - CHART_PAD.t - CHART_PAD.b) / 2}" transform="rotate(-90 12 ${CHART_PAD.t + (CHART_H - CHART_PAD.t - CHART_PAD.b) / 2})" text-anchor="middle">${escapeHtml(d.yLabel)}</text>` : '') +
    (d.xLabel ? `<text class="ax-title" x="${CHART_PAD.l + (CHART_W - CHART_PAD.l - CHART_PAD.r) / 2}" y="${CHART_H - 6}" text-anchor="middle">${escapeHtml(d.xLabel)}</text>` : '');
}

function yAxis(scale, y) {
  return scale.ticks.map(t => `<g class="tick"><line class="grid" x1="${CHART_PAD.l}" x2="${CHART_W - CHART_PAD.r}" y1="${y(t)}" y2="${y(t)}"/>` +
    `<text x="${CHART_PAD.l - 8}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text></g>`).join('');
}

function legend(d) {
  if (d.series.length < 2) return '';
  return `<div class="chart-legend">${d.series.map((s, i) => `<span><i class="sw ${SERIES_CLASS[i % 3]}"></i>${escapeHtml(s.namn)}</span>`).join('')}</div>`;
}

function renderDiagram(el) {
  const d = readDiagram(el);
  if (d.typ === 'funktion') return renderFunctionDiagram(d);
  const all = d.series.flatMap(s => s.points.map(p => p.y)).filter(isFinite);
  if (!all.length) return '<div class="trap"><b>Diagram:</b> inga värden.</div>';
  const minY = d.ymin != null ? d.ymin : Math.min(0, ...all);
  const maxY = d.ymax != null ? d.ymax : Math.max(...all);
  const scale = niceTicks(minY, maxY);
  const y = v => CHART_PAD.t + (CHART_H - CHART_PAD.t - CHART_PAD.b) * (1 - (v - scale.lo) / (scale.hi - scale.lo));
  const labels = d.series[0].points.map(p => p.x);
  const n = labels.length;
  const band = (CHART_W - CHART_PAD.l - CHART_PAD.r) / n;
  const cx = i => CHART_PAD.l + band * (i + 0.5);
  let marks = '';

  if (d.typ === 'stapel') {
    const groups = d.series.length;
    const barW = Math.min(46, band * 0.7 / groups);
    d.series.forEach((s, si) => s.points.forEach((p, i) => {
      const x = cx(i) - (barW * groups) / 2 + si * barW + 1;
      const top = Math.min(y(p.y), y(Math.max(0, scale.lo)));
      const h = Math.abs(y(p.y) - y(Math.max(0, scale.lo)));
      marks += `<g class="mark"><rect class="bar ${SERIES_CLASS[si % 3]}" x="${x}" y="${top}" width="${barW - 2}" height="${Math.max(h, 1)}" rx="3"/>` +
        `<rect class="hit" x="${x - 2}" y="${CHART_PAD.t}" width="${barW + 2}" height="${CHART_H - CHART_PAD.t - CHART_PAD.b}"/>` +
        `<text class="val" x="${x + barW / 2 - 1}" y="${top - 6}" text-anchor="middle">${fmt(p.y)}</text>` +
        `<title>${escapeHtml(p.x)}${s.namn ? ' · ' + escapeHtml(s.namn) : ''}: ${fmt(p.y)}</title></g>`;
    }));
  } else {   // linje eller punkt
    d.series.forEach((s, si) => {
      const pts = s.points.map((p, i) => [cx(i), y(p.y)]);
      if (d.typ === 'linje') marks += `<polyline class="line ${SERIES_CLASS[si % 3]}" points="${pts.map(p => p.join(',')).join(' ')}"/>`;
      s.points.forEach((p, i) => {
        marks += `<g class="mark"><circle class="dot ${SERIES_CLASS[si % 3]}" cx="${pts[i][0]}" cy="${pts[i][1]}" r="5"/>` +
          `<circle class="hit" cx="${pts[i][0]}" cy="${pts[i][1]}" r="14"/>` +
          `<text class="val" x="${pts[i][0]}" y="${pts[i][1] - 10}" text-anchor="middle">${fmt(p.y)}</text>` +
          `<title>${escapeHtml(p.x)}${s.namn ? ' · ' + escapeHtml(s.namn) : ''}: ${fmt(p.y)}</title></g>`;
      });
    });
  }
  const xTicks = labels.map((l, i) => `<text x="${cx(i)}" y="${CHART_H - CHART_PAD.b + 18}" text-anchor="middle">${escapeHtml(l)}</text>`).join('');
  const baseline = `<line class="axis" x1="${CHART_PAD.l}" x2="${CHART_W - CHART_PAD.r}" y1="${y(Math.max(0, scale.lo))}" y2="${y(Math.max(0, scale.lo))}"/>`;
  const table = `<details class="chart-table"><summary>Visa som tabell</summary><div class="tbl"><table class="t">
      <tr><th>${escapeHtml(d.xLabel || '')}</th>${d.series.map(s => `<th>${escapeHtml(s.namn || d.yLabel || 'Värde')}</th>`).join('')}</tr>
      ${labels.map((l, i) => `<tr><td>${escapeHtml(l)}</td>${d.series.map(s => `<td>${s.points[i] ? fmt(s.points[i].y) : ''}</td>`).join('')}</tr>`).join('')}
    </table></div></details>`;
  return `<figure class="chart${d.visaVarden ? ' show-values' : ''}">${d.titel ? `<figcaption>${escapeHtml(d.titel)}</figcaption>` : ''}${legend(d)}
    <svg viewBox="0 0 ${CHART_W} ${CHART_H}" role="img" aria-label="${escapeHtml(d.titel || 'Diagram')}">
      ${d.rutnat ? yAxis(scale, y) : ''}${baseline}${xTicks}${axisLabels(d)}${marks}
    </svg>${table}</figure>`;
}

// Koordinatsystem med rutnät, används av funktionsdiagram och reglagemodeller.
function coordSystem(xmin, xmax, ymin, ymax, w = CHART_W, h = CHART_H) {
  const pad = 26;
  const X = v => pad + (w - 2 * pad) * (v - xmin) / (xmax - xmin);
  const Y = v => h - pad - (h - 2 * pad) * (v - ymin) / (ymax - ymin);
  const xs = niceTicks(xmin, xmax, 10), ys = niceTicks(ymin, ymax, 6);
  let g = '';
  xs.ticks.filter(t => t >= xmin && t <= xmax).forEach(t => {
    g += `<line class="grid" x1="${X(t)}" x2="${X(t)}" y1="${Y(ymin)}" y2="${Y(ymax)}"/>`;
    if (t !== 0) g += `<text x="${X(t)}" y="${Y(0) + 14 > h - 4 ? h - 4 : Y(Math.max(ymin, Math.min(0, ymax))) + 14}" text-anchor="middle">${fmt(t)}</text>`;
  });
  ys.ticks.filter(t => t >= ymin && t <= ymax).forEach(t => {
    g += `<line class="grid" x1="${X(xmin)}" x2="${X(xmax)}" y1="${Y(t)}" y2="${Y(t)}"/>`;
    if (t !== 0) g += `<text x="${X(Math.max(xmin, Math.min(0, xmax))) - 5}" y="${Y(t) + 4}" text-anchor="end">${fmt(t)}</text>`;
  });
  const x0 = X(Math.max(xmin, Math.min(0, xmax))), y0 = Y(Math.max(ymin, Math.min(0, ymax)));
  g += `<line class="axis" x1="${X(xmin)}" x2="${X(xmax)}" y1="${y0}" y2="${y0}"/><line class="axis" x1="${x0}" x2="${x0}" y1="${Y(ymin)}" y2="${Y(ymax)}"/>`;
  return { X, Y, grid: g };
}

function renderFunctionDiagram(d) {
  // Tillåt svenskt skrivsätt i uttrycket: 0,5*x och −2
  const expr = String(d.uttryck || '0').replace(/−/g, '-').replace(/(\d),(\d)/g, '$1.$2');
  const f = x => { try { return evaluate(expr, { x }); } catch (e) { return NaN; } };
  const samples = [];
  for (let i = 0; i <= 120; i++) { const x = d.xmin + (d.xmax - d.xmin) * i / 120; samples.push([x, f(x)]); }
  const ysAll = samples.map(s => s[1]).filter(isFinite);
  const ymin = d.ymin != null ? d.ymin : Math.min(0, ...ysAll), ymax = d.ymax != null ? d.ymax : Math.max(0, ...ysAll);
  const c = coordSystem(d.xmin, d.xmax, ymin, ymax);
  const path = samples.filter(s => isFinite(s[1]) && s[1] >= ymin && s[1] <= ymax).map((s, i) => `${i ? 'L' : 'M'}${c.X(s[0]).toFixed(1)},${c.Y(s[1]).toFixed(1)}`).join('');
  return `<figure class="chart">${d.titel ? `<figcaption>${escapeHtml(d.titel)}</figcaption>` : ''}
    <svg viewBox="0 0 ${CHART_W} ${CHART_H}" role="img" aria-label="${escapeHtml(d.titel || 'Graf')}">${c.grid}<path class="line s1" d="${path}"/>
    ${d.xLabel ? `<text class="ax-title" x="${CHART_W - 8}" y="${c.Y(0) - 6}" text-anchor="end">${escapeHtml(d.xLabel)}</text>` : ''}
    ${d.yLabel ? `<text class="ax-title" x="${c.X(0) + 6}" y="14">${escapeHtml(d.yLabel)}</text>` : ''}</svg></figure>`;
}

/* ----- Interaktiva modeller -----
   I XML:  <interaktiv typ="rata-linjen" k="2" m="1"/>
   renderBlocks ger en tom ruta; setupWidgets(rot) fyller den efter att bilden visats. */
function renderInteractive(el) {
  const attrs = [...el.attributes].map(a => `data-${a.name}="${escapeHtml(a.value)}"`).join(' ');
  return `<div class="widget" ${attrs}><p class="note">Laddar modellen…</p></div>`;
}

function setupWidgets(root) {
  if (!root) return;
  root.querySelectorAll('.widget[data-typ]').forEach(box => {
    if (box.dataset.ready) return;
    box.dataset.ready = '1';
    const make = WIDGETS[box.dataset.typ];
    if (!make) { box.innerHTML = `<div class="trap"><b>Okänd modell:</b> ${escapeHtml(box.dataset.typ)}. Finns: ${Object.keys(WIDGETS).join(', ')}</div>`; return; }
    make(box, box.dataset);
  });
}

// Hjälp: ett reglage med etikett och värde
function slider(name, label, min, max, step, value, unit = '') {
  return `<label class="w-slider"><span>${label}</span>
    <output data-out="${name}">${fmt(+value)}${unit}</output>
    <input type="range" data-w="${name}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
}

function bindSliders(box, draw) {
  const read = () => {
    const v = {};
    box.querySelectorAll('[data-w]').forEach(inp => {
      v[inp.dataset.w] = inp.type === 'range' ? parseFloat(inp.value) : inp.value;
      const out = box.querySelector(`[data-out="${inp.dataset.w}"]`);
      if (out) out.textContent = fmt(parseFloat(inp.value)) + (out.dataset.unit || '');
    });
    return v;
  };
  box.addEventListener('input', () => draw(read()));
  draw(read());
}

const num = (v, def) => (v != null && v !== '' && isFinite(parseNumber(v)) ? parseNumber(v) : def);

const WIDGETS = {
  // y = kx + m med reglage för k och m
  'rata-linjen'(box, o) {
    box.innerHTML = `<div class="w-head">Prova själv: räta linjen <i>y = kx + m</i></div>
      <svg class="w-svg" viewBox="0 0 ${CHART_W} 300" role="img" aria-label="Räta linjen"></svg>
      <div class="w-controls">${slider('k', 'k (lutning)', -3, 3, 0.5, num(o.k, 1))}${slider('m', 'm (startvärde)', -5, 5, 1, num(o.m, 2))}</div>
      <p class="w-readout" aria-live="polite"></p>`;
    bindSliders(box, ({ k, m }) => {
      const c = coordSystem(-6, 6, -6, 6, CHART_W, 300);
      const p1 = [-6, k * -6 + m], p2 = [6, k * 6 + m];
      const step = k !== 0 ? `<path class="kstep" d="M${c.X(0)},${c.Y(m)} H${c.X(1)} V${c.Y(m + k)}"/>
        <text class="w-lbl" x="${c.X(0.5)}" y="${c.Y(m) + (k > 0 ? 17 : -7)}" text-anchor="middle">1</text>
        <text class="w-lbl" x="${c.X(1) + 7}" y="${c.Y(m + k / 2) + 5}">k = ${fmt(k)}</text>` : '';
      box.querySelector('svg').innerHTML = c.grid +
        `<clipPath id="clip-rl"><rect x="26" y="26" width="${CHART_W - 52}" height="248"/></clipPath>
         <line class="line s1" clip-path="url(#clip-rl)" x1="${c.X(p1[0])}" y1="${c.Y(p1[1])}" x2="${c.X(p2[0])}" y2="${c.Y(p2[1])}"/>
         ${step}<circle class="dot s2" cx="${c.X(0)}" cy="${c.Y(m)}" r="5"/>
         <text class="w-lbl" x="${c.X(0) - 9}" y="${c.Y(m) + (k > 0 ? -8 : 18)}" text-anchor="end">m = ${fmt(m)}</text>`;
      const zero = k !== 0 ? `Linjen skär x-axeln där y = 0: x = −m / k = ${fmt(-m / k, 2)}.` : 'k = 0 ger en vågrät linje – y är lika med m överallt.';
      const kx = k === 0 ? '' : (k === 1 ? 'x' : k === -1 ? '−x' : fmt(k) + 'x');
      const eq = k === 0 ? fmt(m) : (m === 0 ? kx : `${kx} ${m < 0 ? '−' : '+'} ${fmt(Math.abs(m))}`);
      box.querySelector('.w-readout').innerHTML = `<b>y = ${eq}</b>. ` +
        `${k > 0 ? 'Positiv k: linjen stiger.' : k < 0 ? 'Negativ k: linjen sjunker.' : ''} ${zero} När x ökar med 1 ändras y med ${fmt(k)}.`;
    });
  },

  // Lägesmått och spridning för en egen talserie
  statistik(box, o) {
    const start = o.varden || '12; 15; 15; 17; 18; 20; 22';
    box.innerHTML = `<div class="w-head">Prova själv: lägesmått och spridning</div>
      <label class="w-text"><span>Talserie (skilj med semikolon)</span><input data-w="data" value="${escapeHtml(start)}" inputmode="decimal"></label>
      <div class="btnrow"><button class="btn small ghost" data-add="outlier">Lägg till ett extremvärde</button><button class="btn small ghost" data-add="reset">Återställ</button></div>
      <svg class="w-svg" viewBox="0 0 ${CHART_W} 150" role="img" aria-label="Prickdiagram"></svg>
      <div class="w-stats"></div>`;
    const input = box.querySelector('[data-w="data"]');
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-add]');
      if (!b) return;
      const vals = splitValues(input.value).map(parseNumber).filter(isFinite);
      input.value = b.dataset.add === 'reset' ? start : [...vals, Math.round(Math.max(...vals) * 3)].map(v => fmt(v)).join('; ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    bindSliders(box, ({ data }) => {
      const v = splitValues(data).map(parseNumber).filter(isFinite);
      const svg = box.querySelector('svg');
      if (v.length < 2) { svg.innerHTML = ''; box.querySelector('.w-stats').innerHTML = '<p class="note">Skriv minst två tal.</p>'; return; }
      const s = [...v].sort((a, b) => a - b);
      const mean = FUNKTIONER.mean(v), median = FUNKTIONER.median(v), sd = FUNKTIONER.stdev(v);
      const mc = FUNKTIONER.modecount(v);
      const mode = mc > 1 ? [...new Set(s.filter(x => s.filter(y => y === x).length === mc))] : [];
      const sc = niceTicks(s[0], s[s.length - 1], 8);
      const X = x => 30 + (CHART_W - 60) * (x - sc.lo) / (sc.hi - sc.lo);
      const stack = {};
      let dots = '';
      s.forEach(x => { stack[x] = (stack[x] || 0) + 1; dots += `<circle class="dot s1" cx="${X(x)}" cy="${104 - (stack[x] - 1) * 13}" r="5.5"><title>${fmt(x)}</title></circle>`; });
      svg.innerHTML = sc.ticks.map(t => `<line class="grid" x1="${X(t)}" x2="${X(t)}" y1="20" y2="112"/><text x="${X(t)}" y="130" text-anchor="middle">${fmt(t)}</text>`).join('') +
        `<line class="axis" x1="30" x2="${CHART_W - 30}" y1="112" y2="112"/>${dots}
         <line class="marker s2" x1="${X(mean)}" x2="${X(mean)}" y1="14" y2="112"/><text class="w-lbl" x="${X(mean)}" y="11" text-anchor="middle">medel</text>
         <line class="marker s3" x1="${X(median)}" x2="${X(median)}" y1="26" y2="112" stroke-dasharray="4 3"/><text class="w-lbl" x="${X(median)}" y="146" text-anchor="middle">median</text>`;
      const rows = [['Antal', v.length], ['Summa', fmt(FUNKTIONER.sum(v), 2)], ['Medelvärde', fmt(mean, 2)], ['Median', fmt(median, 2)],
        ['Typvärde', mode.length ? mode.map(x => fmt(x)).join(' och ') : 'inget'], ['Variationsbredd', fmt(s[s.length - 1] - s[0], 2)],
        ['Standardavvikelse (n − 1)', fmt(sd, 2)]];
      box.querySelector('.w-stats').innerHTML = `<div class="tbl"><table class="t">${rows.map(r => `<tr><th>${r[0]}</th><td>${r[1]}</td></tr>`).join('')}</table></div>
        <p class="note">Lägg till ett extremvärde: medelvärdet och standardavvikelsen flyttar sig mycket, medianen nästan inte alls.</p>`;
    });
  },

  // Rätvinklig triangel: sin, cos och tan för en vinkel
  trig(box, o) {
    box.innerHTML = `<div class="w-head">Prova själv: sinus, cosinus och tangens</div>
      <svg class="w-svg" viewBox="0 0 ${CHART_W} 275" role="img" aria-label="Rätvinklig triangel"></svg>
      <div class="w-controls">${slider('v', 'Vinkel v (°)', 5, 85, 1, num(o.vinkel, 35))}${slider('c', 'Hypotenusa c', 2, 8, 0.5, num(o.hypotenusa, 6))}</div>
      <p class="w-readout" aria-live="polite"></p>`;
    bindSliders(box, ({ v, c }) => {
      const r = v * Math.PI / 180, a = c * Math.sin(r), b = c * Math.cos(r);
      const s = 30, ox = 40, oy = 252;
      const B = [ox + b * s, oy], A = [ox + b * s, oy - a * s];
      box.querySelector('svg').innerHTML = `<polygon class="tri" points="${ox},${oy} ${B.join(',')} ${A.join(',')}"/>
        <path class="axis" d="M${B[0] - 12},${oy} V${oy - 12} H${B[0]}"/>
        <path class="kstep" d="M${ox + 34},${oy} A34,34 0 0 0 ${ox + 34 * Math.cos(r)},${oy - 34 * Math.sin(r)}"/>
        <text class="w-lbl" x="${ox + 42}" y="${oy - 8}">v</text>
        <text class="w-lbl" x="${(ox + B[0]) / 2}" y="${oy + 19}" text-anchor="middle">b = ${fmt(b, 2)}</text>
        <text class="w-lbl" x="${B[0] + 8}" y="${(oy + A[1]) / 2 + 5}">a = ${fmt(a, 2)}</text>
        <text class="w-lbl" x="${(ox + A[0]) / 2 - 8}" y="${(oy + A[1]) / 2 - 8}" text-anchor="end">c = ${fmt(c)}</text>`;
      box.querySelector('.w-readout').innerHTML =
        '<i>a</i> = motstående, <i>b</i> = närliggande, <i>c</i> = hypotenusa. ' +
        `sin ${fmt(v)}° = a / c = ${fmt(a, 2)} / ${fmt(c)} = <b>${fmt(Math.sin(r), 3)}</b> · ` +
        `cos ${fmt(v)}° = b / c = <b>${fmt(Math.cos(r), 3)}</b> · tan ${fmt(v)}° = a / b = <b>${fmt(Math.tan(r), 3)}</b>. ` +
        'Ändra c: sidorna växer men kvoterna (sin, cos, tan) är desamma så länge vinkeln är densamma.';
    });
  },

  // Linjär interpolation mellan två tabellvärden
  interpolation(box, o) {
    const x1 = num(o.x1, 10), y1 = num(o.y1, 0.69), x2 = num(o.x2, 20), y2 = num(o.y2, 0.86);
    box.innerHTML = `<div class="w-head">Prova själv: linjär interpolation</div>
      <svg class="w-svg" viewBox="0 0 ${CHART_W} 260" role="img" aria-label="Interpolation"></svg>
      <div class="w-controls">${slider('x', `x mellan ${fmt(x1)} och ${fmt(x2)}`, x1, x2, (x2 - x1) / 20, (x1 + x2) / 2)}</div>
      <p class="w-readout" aria-live="polite"></p>`;
    bindSliders(box, ({ x }) => {
      const y = y1 + (x - x1) / (x2 - x1) * (y2 - y1);
      const pad = 50, X = v => pad + (CHART_W - 2 * pad) * (v - x1) / (x2 - x1), lo = Math.min(y1, y2), hi = Math.max(y1, y2);
      const Y = v => 210 - 160 * (v - lo) / (hi - lo || 1);
      box.querySelector('svg').innerHTML = `<line class="axis" x1="${pad - 20}" x2="${CHART_W - pad + 20}" y1="230" y2="230"/>
        <line class="line s1" x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}"/>
        <line class="marker s3" x1="${X(x)}" x2="${X(x)}" y1="230" y2="${Y(y)}" stroke-dasharray="4 3"/>
        <circle class="dot s1" cx="${X(x1)}" cy="${Y(y1)}" r="6"/><circle class="dot s1" cx="${X(x2)}" cy="${Y(y2)}" r="6"/>
        <circle class="dot s2" cx="${X(x)}" cy="${Y(y)}" r="7"/>
        <text class="w-lbl" x="${X(x1)}" y="${Y(y1) - 12}" text-anchor="middle">(${fmt(x1)}; ${fmt(y1)})</text>
        <text class="w-lbl" x="${X(x2)}" y="${Y(y2) - 12}" text-anchor="middle">(${fmt(x2)}; ${fmt(y2)})</text>
        <text class="w-lbl" x="${X(x)}" y="${Y(y) - 14}" text-anchor="middle">y ≈ ${fmt(y, 3)}</text>
        <text class="w-lbl" x="${X(x)}" y="248" text-anchor="middle">x = ${fmt(x, 2)}</text>`;
      const share = (x - x1) / (x2 - x1);
      box.querySelector('.w-readout').innerHTML = `Andel av vägen: (${fmt(x, 2)} − ${fmt(x1)}) / (${fmt(x2)} − ${fmt(x1)}) = ${fmt(share, 3)}. ` +
        `y = ${fmt(y1)} + ${fmt(share, 3)} · (${fmt(y2)} − ${fmt(y1)}) ≈ <b>${fmt(y, 3)}</b>`;
    });
  },

  // Tyngdpunkt för balk + last
  tyngdpunkt(box, o) {
    const L = num(o.langd, 10), mb = num(o.balk, 400);
    box.innerHTML = `<div class="w-head">Prova själv: gemensam tyngdpunkt</div>
      <svg class="w-svg" viewBox="0 0 ${CHART_W} 170" role="img" aria-label="Balk med last"></svg>
      <div class="w-controls">${slider('m', 'Lastens massa (kg)', 0, 1000, 50, num(o.last, 300))}${slider('x', 'Lastens läge (m)', 0, L, L / 20, L / 5)}</div>
      <p class="w-readout" aria-live="polite"></p>`;
    bindSliders(box, ({ m, x }) => {
      const xT = (mb * L / 2 + m * x) / (mb + m);
      const X = v => 40 + (CHART_W - 80) * v / L;
      const size = 14 + 26 * Math.sqrt(m / 1000);
      box.querySelector('svg').innerHTML = `<rect class="beam" x="${X(0)}" y="96" width="${X(L) - X(0)}" height="14" rx="3"/>
        <rect class="load" x="${X(x) - size / 2}" y="${96 - size}" width="${size}" height="${size}" rx="3"/>
        <text class="w-lbl" x="${X(x)}" y="${90 - size}" text-anchor="middle">${fmt(m)} kg</text>
        <line class="marker s3" x1="${X(L / 2)}" x2="${X(L / 2)}" y1="112" y2="128" /><text class="w-lbl" x="${X(L / 2)}" y="142" text-anchor="middle">balkens mitt</text>
        <path class="dot s2" d="M${X(xT)},118 l-9,18 h18 z"/><text class="w-lbl" x="${X(xT)}" y="160" text-anchor="middle">x_T = ${fmt(xT, 2)} m</text>
        <text class="w-lbl" x="${X(0)}" y="88">0</text><text class="w-lbl" x="${X(L)}" y="88" text-anchor="end">${fmt(L)} m</text>`;
      box.querySelector('.w-readout').innerHTML = `x_T = (${fmt(mb)} · ${fmt(L / 2)} + ${fmt(m)} · ${fmt(x, 2)}) / (${fmt(mb)} + ${fmt(m)}) = <b>${fmt(xT, 2)} m</b>. ` +
        'Tyngre last eller last längre ut drar tyngdpunkten mot lasten.';
    });
  },

  // Två procentuella förändringar i rad: multiplicera faktorerna
  procent(box, o) {
    const P = num(o.start, 1000);
    box.innerHTML = `<div class="w-head">Prova själv: förändringar i flera steg</div>
      <div class="w-controls">${slider('p1', 'Förändring 1 (%)', -50, 50, 5, num(o.p1, 20))}${slider('p2', 'Förändring 2 (%)', -50, 50, 5, num(o.p2, -20))}</div>
      <svg class="w-svg" viewBox="0 0 ${CHART_W} 200" role="img" aria-label="Staplar"></svg>
      <p class="w-readout" aria-live="polite"></p>`;
    bindSliders(box, ({ p1, p2 }) => {
      const f1 = 1 + p1 / 100, f2 = 1 + p2 / 100, v1 = P * f1, v2 = v1 * f2, naive = P * (1 + (p1 + p2) / 100);
      const vals = [['Start', P], ['Efter steg 1', v1], ['Efter steg 2', v2], ['Fel: lagt ihop %', naive]];
      const max = Math.max(...vals.map(v => v[1])) * 1.15, bw = 70, gap = (CHART_W - 40 - 4 * bw) / 3;
      box.querySelector('svg').innerHTML = vals.map(([l, v], i) => {
        const h = 140 * v / max, x = 20 + i * (bw + gap);
        return `<rect class="bar ${i === 3 ? 's3' : i === 0 ? 's1' : 's2'}" x="${x}" y="${170 - h}" width="${bw}" height="${h}" rx="3"/>
          <text class="val" x="${x + bw / 2}" y="${164 - h}" text-anchor="middle" style="opacity:1">${fmt(v, 0)}</text>
          <text x="${x + bw / 2}" y="190" text-anchor="middle">${l}</text>`;
      }).join('') + `<line class="axis" x1="10" x2="${CHART_W - 10}" y1="170" y2="170"/>`;
      const tot = (f1 * f2 - 1) * 100;
      box.querySelector('.w-readout').innerHTML = `Faktorer: ${fmt(f1, 2)} · ${fmt(f2, 2)} = ${fmt(f1 * f2, 4)} → total förändring <b>${tot >= 0 ? '+' : '−'}${fmt(Math.abs(tot), 2)} %</b>. ` +
        `Att lägga ihop procenten ger ${p1 + p2 >= 0 ? '+' : '−'}${fmt(Math.abs(p1 + p2))} %, vilket blir fel (utom när ett av stegen är 0).`;
    });
  },
};
