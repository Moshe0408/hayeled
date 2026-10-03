// national.js: #/national. Level, caps, upcoming, qualifier table, tournament, history.
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { call } from './app.js';
import { badge, fixtureRow, tableView, bracketRound, segmented, statGrid, card, empty } from './components.js';

export function render(root) {
  const n = call(() => game.getNational(), { quiet: true });
  if (!n) { root.innerHTML = empty('אין נתוני נבחרת', '🏳️'); return; }
  let tview = 'table';
  let roundIdx = null;

  function tournamentBlock() {
    const t = n.tournament;
    if (!t) return '';
    const hasT = !!(t.table && (t.table.groups || []).length);
    const hasB = !!(t.bracket && (t.bracket.rounds || []).length);
    if (!hasT && hasB) tview = 'bracket';
    let body = '';
    if (tview === 'table' && hasT) body = tableView(t.table, { compact: true });
    else if (hasB) {
      const rounds = t.bracket.rounds;
      if (roundIdx === null) { roundIdx = 0; rounds.forEach((r, i) => { if ((r.ties || []).length) roundIdx = i; }); }
      body = `<div class="chips wrap">${rounds.map((r, i) => `<button type="button" class="chip chip-btn${i === roundIdx ? ' on' : ''}" data-act="round" data-i="${i}">${esc(r.he)}</button>`).join('')}</div>${bracketRound(rounds[roundIdx])}`;
    }
    return card(`${t.stageHe ? `<p class="note">${esc(t.stageHe)}</p>` : ''}
      ${hasT && hasB ? segmented('tv', [{ id: 'table', he: 'בתים' }, { id: 'bracket', he: 'נוקאאוט' }], tview) : ''}${body}`, { title: '🌍 ' + (t.he || 'טורניר') });
  }

  function draw() {
    const y = n.youth || {};
    const yRow = (k, he) => (Array.isArray(y[k]) && (y[k][0] || y[k][1]) ? `<div class="kv"><span>${he}</span><b class="num">${esc(y[k][0])} הופ׳ · ${esc(y[k][1])} שע׳</b></div>` : '');
    root.innerHTML = `<div class="national">
      <section class="card nat-head">${badge(n.nation, 'l')}<div class="grow"><b class="pname">${esc(n.nation && n.nation.nameHe)}</b>
        <div class="small">${esc(n.levelHe || '')}</div><div class="muted small">${esc(n.statusHe || '')}</div></div></section>
      ${card(statGrid([{ label: 'הופעות', value: n.caps ?? 0 }, { label: 'שערים', value: n.goals ?? 0 }]) + yRow('u17', 'עד גיל 17') + yRow('u19', 'עד גיל 19') + yRow('u21', 'עד גיל 21'), { title: 'הנבחרת הבוגרת' })}
      ${(n.upcoming || []).length ? card((n.upcoming || []).map((fx) => fixtureRow(fx, { showDate: true })).join(''), { title: 'המשחקים הבאים' }) : ''}
      ${n.qualifier ? card(tableView(n.qualifier, { compact: true }), { title: n.qualifier.he || 'מוקדמות' }) : ''}
      ${tournamentBlock()}
      ${(n.history || []).length ? card(`<div class="nat-hist">${n.history.map((h) => `<div class="kv"><span>${esc(h.seasonHe)} · ${esc(h.he)}</span><b>${esc(h.stageHe)}${h.winnerHe ? ` <small class="muted">(זכתה: ${esc(h.winnerHe)})</small>` : ''}</b></div>`).join('')}</div>`, { title: 'היסטוריה בטורנירים' }) : ''}
      ${!n.caps && !(n.upcoming || []).length && !n.qualifier && !n.tournament ? '<p class="muted center">תמשיך להופיע טוב, ומאמן הנבחרת ישים לב. 🏳️</p>' : ''}
    </div>`;
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'seg') { tview = b.dataset.val; draw(); }
    else if (b.dataset.act === 'round') { roundIdx = Number(b.dataset.i) || 0; draw(); }
  });
  draw();
}
