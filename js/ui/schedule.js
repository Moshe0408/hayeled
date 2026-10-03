// schedule.js: #/schedule. The season's fixtures of the player's teams, grouped by month.
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { call, openModal, hubSafe } from './app.js';
import { fixtureRow, empty, badge, scoreBox, resChip, statGrid } from './components.js';
import { rating } from './format.js';
import { gtext } from './gender.js';

function monthKey(dateHe) {
  const parts = String(dateHe || '').split('·').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[1];
  return parts[0] || '';
}

export function render(root) {
  const data = call(() => game.getSchedule(), { quiet: true });
  const hub = hubSafe();
  if (!data) { root.innerHTML = empty('אין לוח משחקים כרגע', '📅'); return; }
  const fixtures = data.fixtures || [];
  const groups = [];
  for (const fx of fixtures) {
    const k = monthKey(fx.dateHe);
    let g = groups[groups.length - 1];
    if (!g || g.k !== k) { g = { k, items: [] }; groups.push(g); }
    g.items.push(fx);
  }
  const curWeek = hub ? hub.week : null;
  const played = fixtures.filter((f) => f.result);
  const w = played.filter((f) => f.result.res === 'W').length;
  const d = played.filter((f) => f.result.res === 'D').length;
  const l = played.filter((f) => f.result.res === 'L').length;
  root.innerHTML = `<div class="schedule">
    <div class="sched-head"><h2 class="card-title">עונת ${esc(data.seasonHe || '')}</h2>
      <span class="muted small">${played.length ? `${w} נ׳ · ${d} ת׳ · ${l} ה׳` : 'העונה עוד לא התחילה'}</span></div>
    ${groups.length ? groups.map((g) => `<section class="month"><h3 class="month-title">${esc(g.k)}</h3>
      ${g.items.map((fx) => `<div class="sched-item${fx.week === curWeek ? ' current' : ''}" ${fx.week === curWeek ? 'id="cur-week"' : ''}>
        <div class="muted small">${esc(fx.dateHe)}</div>${fixtureRow(fx, { act: fx.result ? 'fx' : '' })}</div>`).join('')}</section>`).join('')
      : empty('אין משחקים בלוח כרגע', '📅')}
  </div>`;
  const cur = root.querySelector('#cur-week');
  if (cur) setTimeout(() => { try { cur.scrollIntoView({ block: 'center' }); } catch { /* ignore */ } }, 30);

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="fx"]');
    if (!b) return;
    const last = call(() => game.getLastMatch(), { quiet: true });
    if (last && last.key === b.dataset.key) showSummary(last);
  });
}

export function showSummary(s) {
  openModal(`<h2 class="modal-title">${esc(s.compHe || '')}${s.roundHe ? ' · ' + esc(s.roundHe) : ''}</h2>
    <div class="ms-teams"><span>${badge(s.home)}<b>${esc(s.home && s.home.shortHe)}</b></span>${scoreBox(s.score)}<span>${badge(s.away)}<b>${esc(s.away && s.away.shortHe)}</b></span></div>
    <div class="chips center">${resChip(s.res)}${s.extraHe ? `<span class="chip">${esc(s.extraHe)}</span>` : ''}${s.motm ? `<span class="chip gold">⭐ ${esc(gtext('{{מצטיין|מצטיינת}} המשחק'))}</span>` : ''}</div>
    ${statGrid([{ label: 'ציון', value: rating(s.rating) }, { label: 'שערים', value: s.goals ?? 0 }, { label: 'בישולים', value: s.assists ?? 0 }, { label: 'דקות', value: s.minutes ?? 0 }])}
    ${(s.momentsHe || []).map((x) => `<div class="feed-row ${x.ok ? 'k-goal_for' : 'k-goal_against'}"><span class="fm num">${esc(x.minute)}'</span><span>${esc(x.textHe)}</span></div>`).join('')}
    <button type="button" class="btn btn-primary" data-close>סגור</button>`, { sheet: true, testid: 'last-match' });
}
