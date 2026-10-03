// js/admin/charts.js - tiny inline-SVG charts (no libraries). All text via textContent.
// Marks: 2px lines with round joins, >=8px end-dots with a 2px surface ring, columns <=24px with a
// 4px rounded data-end, hairline solid gridlines. Every chart has a hover tooltip and a table view.

const NS = 'http://www.w3.org/2000/svg';
const SURFACE = '#16213a';

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}
function htmlEl(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = String(text);
  return el;
}

function niceMax(v) {
  if (!(v > 0)) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 4, 5, 10]) {
    const c = m * pow;
    if (c >= v) return Math.max(4, c);
  }
  return 10 * pow;
}
function ticksFor(max) {
  const step = max / 4;
  return [0, 1, 2, 3, 4].map((i) => Math.round(i * step * 100) / 100);
}
function fmtNum(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
function shortDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? (Number(m[3]) + '/' + Number(m[2])) : String(iso || '');
}

function tableView(headers, rows) {
  const det = htmlEl('details', 'adm-table-toggle');
  det.appendChild(htmlEl('summary', '', 'הצג כטבלה'));
  const wrap = htmlEl('div', 'adm-scroll');
  const t = htmlEl('table', 'adm-table');
  const thead = htmlEl('thead');
  const trh = htmlEl('tr');
  headers.forEach((h) => trh.appendChild(htmlEl('th', '', h)));
  thead.appendChild(trh);
  t.appendChild(thead);
  const tb = htmlEl('tbody');
  rows.forEach((r) => {
    const tr = htmlEl('tr');
    r.forEach((c, i) => tr.appendChild(htmlEl('td', i > 0 ? 'n' : '', c)));
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  wrap.appendChild(t);
  det.appendChild(wrap);
  return det;
}

function placeTip(tip, wrap, clientX, clientY) {
  const r = wrap.getBoundingClientRect();
  const tw = tip.offsetWidth || 120;
  let x = clientX - r.left + 12;
  if (x + tw > r.width) x = clientX - r.left - tw - 12;
  if (x < 0) x = 0;
  tip.style.left = x + 'px';
  tip.style.top = Math.max(0, clientY - r.top - 40) + 'px';
}

/**
 * Multi-series daily line chart.
 * series: [{ name, color, points: [{ day:'YYYY-MM-DD', count }] }] (same days, oldest first)
 */
export function lineChart(series, { height = 200, testid } = {}) {
  const wrap = htmlEl('div', 'adm-chart');
  if (testid) wrap.setAttribute('data-testid', testid);
  const list = (Array.isArray(series) ? series : []).filter((s) => s && Array.isArray(s.points));
  const days = list.length ? list[0].points.map((p) => p.day) : [];
  if (!days.length) {
    wrap.appendChild(htmlEl('div', 'adm-empty', 'אין עדיין נתונים'));
    return wrap;
  }
  if (list.length > 1) {
    const lg = htmlEl('div', 'adm-legend');
    list.forEach((s) => {
      const it = htmlEl('span');
      const key = htmlEl('span', 'key');
      key.style.background = s.color;
      it.appendChild(key);
      it.appendChild(document.createTextNode(s.name));
      lg.appendChild(it);
    });
    wrap.appendChild(lg);
  }

  const W = 600;
  const H = height;
  const padL = 34; const padR = 12; const padT = 10; const padB = 24;
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const maxV = niceMax(Math.max(0, ...list.flatMap((s) => s.points.map((p) => Number(p.count) || 0))));
  const n = days.length;
  const x = (i) => padL + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v) => padT + ih - (v / maxV) * ih;

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': list.map((s) => s.name).join(', '), direction: 'ltr' });
  const grid = svgEl('g', { class: 'grid' });
  for (const t of ticksFor(maxV)) {
    grid.appendChild(svgEl('line', { x1: padL, x2: W - padR, y1: y(t), y2: y(t) }));
    const lbl = svgEl('text', { x: padL - 6, y: y(t) + 4, 'text-anchor': 'end' });
    lbl.textContent = fmtNum(t);
    grid.appendChild(lbl);
  }
  svg.appendChild(grid);

  const xl = svgEl('g', { class: 'axis' });
  const idxs = n <= 3 ? days.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
  for (const i of idxs) {
    const t = svgEl('text', { x: x(i), y: H - 6, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' });
    t.textContent = shortDay(days[i]);
    xl.appendChild(t);
  }
  svg.appendChild(xl);

  list.forEach((s) => {
    const d = s.points.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(Number(p.count) || 0).toFixed(1)).join(' ');
    svg.appendChild(svgEl('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    const last = s.points[s.points.length - 1];
    svg.appendChild(svgEl('circle', { cx: x(n - 1), cy: y(Number(last.count) || 0), r: 4, fill: s.color, stroke: SURFACE, 'stroke-width': 2 }));
  });

  // hover layer
  const cross = svgEl('line', { x1: 0, x2: 0, y1: padT, y2: padT + ih, stroke: '#93a1c0', 'stroke-width': 1, visibility: 'hidden' });
  svg.appendChild(cross);
  const hoverDots = list.map((s) => {
    const c = svgEl('circle', { r: 5, fill: s.color, stroke: SURFACE, 'stroke-width': 2, visibility: 'hidden' });
    svg.appendChild(c);
    return c;
  });
  const hit = svgEl('rect', { x: padL, y: padT, width: iw, height: ih, fill: 'transparent' });
  svg.appendChild(hit);
  wrap.appendChild(svg);

  const tip = htmlEl('div', 'adm-tip');
  tip.hidden = true;
  wrap.appendChild(tip);

  const show = (ev) => {
    const r = svg.getBoundingClientRect();
    if (!r.width) return;
    const sx = ((ev.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((sx - padL) / iw) * (n - 1))));
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
    cross.setAttribute('visibility', 'visible');
    list.forEach((s, k) => {
      hoverDots[k].setAttribute('cx', x(i));
      hoverDots[k].setAttribute('cy', y(Number(s.points[i].count) || 0));
      hoverDots[k].setAttribute('visibility', 'visible');
    });
    tip.textContent = '';
    tip.appendChild(htmlEl('div', '', shortDay(days[i])));
    list.forEach((s) => {
      const row = htmlEl('div');
      const k = htmlEl('span', 'k');
      k.style.background = s.color;
      row.appendChild(k);
      row.appendChild(document.createTextNode(s.name + ': ' + (Number(s.points[i].count) || 0)));
      tip.appendChild(row);
    });
    tip.hidden = false;
    placeTip(tip, wrap, ev.clientX, ev.clientY);
  };
  const hide = () => {
    tip.hidden = true;
    cross.setAttribute('visibility', 'hidden');
    hoverDots.forEach((c) => c.setAttribute('visibility', 'hidden'));
  };
  hit.addEventListener('pointermove', show);
  hit.addEventListener('pointerdown', show);
  hit.addEventListener('pointerleave', hide);

  wrap.appendChild(tableView(['יום', ...list.map((s) => s.name)],
    days.map((d, i) => [d, ...list.map((s) => String(Number(s.points[i].count) || 0))]).reverse()));
  return wrap;
}

/** Vertical columns. items: [{ label, value }] */
export function columnChart(items, { height = 170, color = '#3987e5', testid, valueSuffix = '' } = {}) {
  const wrap = htmlEl('div', 'adm-chart');
  if (testid) wrap.setAttribute('data-testid', testid);
  const list = Array.isArray(items) ? items : [];
  const W = 360; const H = height;
  const padT = 18; const padB = 22; const padX = 10;
  const ih = H - padT - padB;
  const maxV = Math.max(1, ...list.map((it) => Number(it.value) || 0));
  const band = (W - padX * 2) / Math.max(1, list.length);
  const bw = Math.min(24, band * 0.6);
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', direction: 'ltr' });
  const base = padT + ih;
  svg.appendChild(svgEl('line', { x1: padX, x2: W - padX, y1: base, y2: base, stroke: '#24304d', 'stroke-width': 1 }));
  const tip = htmlEl('div', 'adm-tip');
  tip.hidden = true;

  list.forEach((it, i) => {
    const v = Number(it.value) || 0;
    const cx = padX + band * i + band / 2;
    const h = (v / maxV) * ih;
    const x0 = cx - bw / 2;
    const top = base - h;
    if (h > 0) {
      const r = Math.min(4, h, bw / 2);
      const d = `M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + bw - r} Q${x0 + bw},${top} ${x0 + bw},${top + r} V${base} Z`;
      svg.appendChild(svgEl('path', { d, fill: color }));
    }
    const val = svgEl('text', { x: cx, y: top - 5, 'text-anchor': 'middle' });
    val.textContent = fmtNum(v) + valueSuffix;
    svg.appendChild(val);
    const lbl = svgEl('text', { x: cx, y: H - 6, 'text-anchor': 'middle' });
    lbl.textContent = it.label;
    svg.appendChild(lbl);
    const hit = svgEl('rect', { x: padX + band * i, y: padT - 14, width: band, height: ih + 14, fill: 'transparent' });
    const show = (ev) => {
      tip.textContent = it.label + ': ' + fmtNum(v) + valueSuffix;
      tip.hidden = false;
      placeTip(tip, wrap, ev.clientX, ev.clientY);
    };
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', () => { tip.hidden = true; });
    svg.appendChild(hit);
  });
  wrap.appendChild(svg);
  wrap.appendChild(tip);
  return wrap;
}

/** Ranked horizontal list with proportional bars. items: [{ name, count }] */
export function rankList(items, { empty = 'אין עדיין נתונים', total } = {}) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return htmlEl('div', 'adm-empty', empty);
  const ul = htmlEl('ul', 'adm-list');
  const max = Math.max(1, ...list.map((x) => Number(x.count) || 0));
  const sum = total || list.reduce((a, x) => a + (Number(x.count) || 0), 0);
  list.forEach((it) => {
    const li = htmlEl('li');
    li.appendChild(htmlEl('span', '', it.name));
    const pct = sum ? Math.round(((Number(it.count) || 0) / sum) * 100) : 0;
    li.appendChild(htmlEl('span', 'num', String(Number(it.count) || 0) + ' · ' + pct + '%'));
    const bar = htmlEl('span', 'bar');
    bar.style.width = Math.max(2, ((Number(it.count) || 0) / max) * 100) + '%';
    li.appendChild(bar);
    ul.appendChild(li);
  });
  return ul;
}
