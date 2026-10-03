// tables.js: #/tables (competition picker) and #/tables/:compId (table / bracket).
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { call, setHeader } from './app.js';
import { tableView, bracketRound, segmented, empty, badge, scoreBox, teamLabel, nationTeam } from './components.js';
import { COUNTRIES } from '../data/countries.js';
import { ico } from './icons.js';

function countryCrest(g) {
  const c = COUNTRIES.find((x) => (g.flag && x.flag === g.flag) || x.nameHe === g.countryHe);
  const t = c ? nationTeam(c.id) : null;
  return t ? badge(t, 's') : `<span class="flag">${esc(g.flag || '')}</span>`;
}

// line icons (same stroke family as the tab bar), tinted per competition kind
const SV = (d) => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
const ICO_STADIUM = SV('<ellipse cx="12" cy="8" rx="9" ry="3.2"/><path d="M3 8v6.5c0 1.8 4 3.3 9 3.3s9-1.5 9-3.3V8"/><path d="M7.5 10.8v6.4M12 11.2v6.6M16.5 10.8v6.4"/>');
const ICO_CUP = SV('<path d="M7 4h10v4.5a5 5 0 0 1-10 0Z"/><path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3.4M17 6h2.5a2.5 2.5 0 0 1-2.6 3.4"/><path d="M12 13.5V17M8.5 20h7M9.5 17h5"/>');
const ICO_STAR = SV('<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z"/>');
const ICO_FLAG = SV('<path d="M5 21V4"/><path d="M5 4.5c4-2 6 2 10 0s4 0 4 0v8.5s-1-2-4 0-6-2-10 0"/>');
const ICO_SPROUT = SV('<path d="M12 21v-8"/><path d="M12 13c0-4 2.5-6.5 7-6.5 0 4.5-2.5 6.5-7 6.5ZM12 15.5c0-3.2-2-5.2-6-5.2 0 3.6 2 5.2 6 5.2Z"/>');
const ICO_GLOBE = SV('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 3.6 5.4 3.6 8.5s-1 5.9-3.6 8.5c-2.6-2.6-3.6-5.4-3.6-8.5s1-5.9 3.6-8.5Z"/>');
const ICO_HANDS = SV('<path d="m3 11 4-4 3 1 2-1 4 0 5 4-6 6-3-1-3 2-6-7Z"/>');
const KIND_ICO = { league: [ICO_STADIUM, 'k-league'], cup: [ICO_CUP, 'k-cup'], europe: [ICO_STAR, 'k-europe'], national: [ICO_FLAG, 'k-nat'], youth: [ICO_SPROUT, 'k-youth'], ynt: [ICO_FLAG, 'k-nat'], friendly: [ICO_HANDS, 'k-friendly'], tournament: [ICO_GLOBE, 'k-tour'] };

export function render(root, params = {}) {
  if (params.compId) return renderComp(root, params.compId);
  return renderPicker(root);
}

function compRow(c) {
  return `<a class="comp-row" href="#/tables/${encodeURIComponent(c.id)}" data-testid="comp-${esc(c.id)}">
    <span class="comp-ico ${(KIND_ICO[c.kind] || KIND_ICO.league)[1]}" aria-hidden="true">${(KIND_ICO[c.kind] || KIND_ICO.league)[0]}</span>
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
      ${leagues.map((g) => `<details class="country"${g.items.some((c) => mine.find((m) => m.id === c.id)) ? ' open' : ''}><summary>${countryCrest(g)} ${esc(g.countryHe)}</summary>
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
        ${bracket.winner ? `<div class="winner-card">${ico('trophy', 'gold')} ${badge(bracket.winner)} <b>${esc(bracket.winner.nameHe)}</b></div>` : ''}` : empty('ההגרלה עוד לא התקיימה', '🎲');
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
