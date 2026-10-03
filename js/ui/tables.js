// tables.js: #/tables (competition picker) and #/tables/:compId (table / bracket).
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { call, setHeader } from './app.js';
import { tableView, bracketRound, segmented, empty, badge, scoreBox, teamLabel } from './components.js';

const KIND_ICO = { league: '🏟️', cup: '🏆', europe: '⭐', national: '🏳️', youth: '🌱', ynt: '🏳️', friendly: '🤝', tournament: '🌍' };

export function render(root, params = {}) {
  if (params.compId) return renderComp(root, params.compId);
  return renderPicker(root);
}

function compRow(c) {
  return `<a class="comp-row" href="#/tables/${encodeURIComponent(c.id)}" data-testid="comp-${esc(c.id)}">
    <span class="comp-ico" aria-hidden="true">${esc(KIND_ICO[c.kind] || '🏟️')}</span>
    <span class="grow"><b>${esc(c.he)}</b>${c.statusHe ? `<small class="muted">${esc(c.statusHe)}</small>` : ''}</span><span class="chev">‹</span></a>`;
}

function renderPicker(root) {
  const data = call(() => game.getCompetitions(), { quiet: true });
  if (!data) { root.innerHTML = empty('אין מסגרות להצגה', '📊'); return; }
  const mine = data.mine || [];
  const leagues = data.leagues || [];
  const europe = data.europe || [];
  root.innerHTML = `<div class="tables-picker">
    ${mine.length ? `<section class="card"><h2 class="card-title">המסגרות שלי</h2><div class="comp-list">${mine.map(compRow).join('')}</div></section>` : ''}
    ${europe.length ? `<section class="card"><h2 class="card-title">אירופה</h2><div class="comp-list">${europe.map(compRow).join('')}</div></section>` : ''}
    <section class="card"><h2 class="card-title">ליגות העולם</h2>
      ${leagues.map((g) => `<details class="country"${g.items.some((c) => mine.find((m) => m.id === c.id)) ? ' open' : ''}><summary><span class="flag">${esc(g.flag || '')}</span> ${esc(g.countryHe)}</summary>
        <div class="comp-list">${(g.items || []).map(compRow).join('')}</div></details>`).join('')}
    </section>
  </div>`;
}

function findComp(id) {
  const data = call(() => game.getCompetitions(), { quiet: true });
  if (!data) return null;
  const all = [...(data.mine || []), ...(data.europe || [])];
  for (const g of data.leagues || []) all.push(...(g.items || []));
  return all.find((c) => c.id === id) || null;
}

function renderComp(root, compId) {
  const meta = findComp(compId);
  let hasTable = meta ? !!meta.hasTable : true;
  let hasBracket = meta ? !!meta.hasBracket : false;
  let table = null, bracket = null;
  if (hasTable) { table = call(() => game.getTable(compId), { quiet: true }); if (!table) hasTable = false; }
  if (hasBracket || !hasTable) { bracket = call(() => game.getBracket(compId), { quiet: true }); hasBracket = !!(bracket && (bracket.rounds || []).length); }
  const title = (table && table.he) || (bracket && bracket.he) || (meta && meta.he) || 'טבלה';
  setHeader({ title });
  let view = hasTable ? 'table' : 'bracket';
  let roundIdx = null;
  const results = hasTable ? call(() => game.getResults(compId), { quiet: true }) : null;

  function lastKnownRound() {
    const rounds = (bracket && bracket.rounds) || [];
    let idx = 0;
    rounds.forEach((r, i) => { if ((r.ties || []).length) idx = i; });
    return idx;
  }

  function draw() {
    let body = '';
    if (view === 'table') {
      body = tableView(table, { compact: false });
      if (results && (results.results || []).length) {
        body += `<section class="card"><h2 class="card-title">${esc(results.roundHe || 'המחזור האחרון')}</h2>
          ${results.results.map((r) => `<div class="res-row"><span class="fx-team home">${badge(r.home, 's')}<span class="tname">${teamLabel(r.home)}</span></span>${scoreBox(r.score)}<span class="fx-team away"><span class="tname">${teamLabel(r.away)}</span>${badge(r.away, 's')}</span></div>`).join('')}</section>`;
      }
    } else {
      const rounds = (bracket && bracket.rounds) || [];
      if (roundIdx === null) roundIdx = lastKnownRound();
      body = rounds.length ? `<div class="chips wrap">${rounds.map((r, i) => `<button type="button" class="chip chip-btn${i === roundIdx ? ' on' : ''}" data-act="round" data-i="${i}">${esc(r.he)}</button>`).join('')}</div>
        ${bracketRound(rounds[roundIdx])}
        ${bracket.winner ? `<div class="winner-card">🏆 ${badge(bracket.winner)} <b>${esc(bracket.winner.nameHe)}</b></div>` : ''}` : empty('ההגרלה עוד לא התקיימה', '🎲');
    }
    root.innerHTML = `<div class="comp-view">
      ${hasTable && hasBracket ? segmented('view', [{ id: 'table', he: 'טבלה' }, { id: 'bracket', he: 'נוקאאוט' }], view) : ''}
      ${!hasTable && !hasBracket ? empty('אין נתונים להצגה עדיין', '📊') : body}
    </div>`;
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'seg') { view = b.dataset.val; draw(); }
    else if (b.dataset.act === 'round') { roundIdx = Number(b.dataset.i) || 0; draw(); }
  });
  draw();
}
