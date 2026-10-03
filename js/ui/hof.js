// hof.js: #/hof. Hall of Fame (separate dual-stored store; survives slot deletion). Works without a career.
import * as save from '../core/save.js';
import * as S from '../data/strings.js';
import { esc } from './dom.js';
import { openModal } from './app.js';
import { statGrid, empty } from './components.js';
import { dateLabel } from './format.js';

const T_ICO = { league: '🏆', league2: '⬆️', cup: '🏆', ucl: '⭐', uel: '🟠', uecl: '🟢', wc: '🌍', euro: '🏆', copa: '🏆', afcon: '🏆', asian: '🏆', gold: '🥇', u17: '🏳️', u19: '🏳️', u21: '🏳️', youth_league: '🌱' };

function trophyHe(k) { return (S.TROPHIES && S.TROPHIES[k]) || k; }
function awardHe(k) { return (S.AWARDS && S.AWARDS[k]) || k; }

function trophyIcons(tr) {
  const items = Object.entries(tr || {}).filter(([, n]) => n > 0);
  if (!items.length) return '';
  return `<span class="hof-tr">${items.slice(0, 8).map(([k, n]) => `<span title="${esc(trophyHe(k))}">${esc(T_ICO[k] || '🏆')}${n > 1 ? `<small class="num">${esc(n)}</small>` : ''}</span>`).join('')}</span>`;
}

export async function render(root) {
  root.innerHTML = '<div class="loading-line">טוען את היכל התהילה...</div>';
  let list = [];
  try { list = await save.loadHallOfFame(); } catch (e) { console.warn(e); list = []; }
  list = (list || []).slice().sort((a, b) => (b.legacy || 0) - (a.legacy || 0));
  root.innerHTML = `<div class="hof" data-testid="hof-list">
    <p class="muted small">כל קריירה שהסתיימה נשמרת כאן לתמיד, גם אם מוחקים משבצת או מתחילים קריירה חדשה.</p>
    ${list.length ? list.map((e, i) => `<button type="button" class="hof-item${i < 3 ? ' top' : ''}" data-act="open" data-id="${esc(e.careerId)}" data-testid="hof-item-${esc(e.careerId)}">
      <span class="hof-rank num">${i + 1}</span>
      <span class="grow"><b>${esc(e.flag || '')} ${esc(e.name)}${e.nick ? ` <span class="muted">"${esc(e.nick)}"</span>` : ''}</b>
        <small class="muted">${esc(e.posHe || e.pos || '')} · <span dir="ltr">${esc(e.startSeason)}–${esc(e.endSeason)}</span> · ${esc(e.tierHe || '')}</small>${trophyIcons(e.trophies)}</span>
      <span class="hof-legacy"><b class="num">${esc(Math.round(e.legacy || 0))}</b><small>מורשת</small></span></button>`).join('')
      : empty('עוד אין אגדות בהיכל. כל קריירה שתסתיים תיכנס לכאן.', '🏛️')}
  </div>`;
  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act="open"]');
    if (!b) return;
    const e = list.find((x) => x.careerId === b.dataset.id);
    if (e) detail(e);
  });
}

function detail(e) {
  const tr = Object.entries(e.trophies || {}).filter(([, n]) => n > 0);
  const aw = Object.entries(e.awards || {}).filter(([, n]) => n > 0);
  openModal(`<h2 class="modal-title">${esc(e.flag || '')} ${esc(e.name)}</h2>
    <div class="muted small">${esc(e.posHe || '')} · <span dir="ltr">${esc(e.startSeason)}–${esc(e.endSeason)}</span> · ${esc(e.seasons)} עונות · פרש בגיל ${esc(e.age)}</div>
    <div class="legacy-big"><b class="num">${esc(Math.round(e.legacy || 0))}</b><span>${esc(e.tierHe || '')}</span></div>
    ${statGrid([{ label: 'הופעות', value: e.apps ?? 0 }, { label: 'שערים', value: e.goals ?? 0 }, { label: 'בישולים', value: e.assists ?? 0 }, { label: 'נבחרת', value: e.caps ?? 0 }, { label: 'שערי נבחרת', value: e.intlGoals ?? 0 }, { label: 'שיא OVR', value: e.peakOvr ?? 0 }])}
    ${tr.length ? `<h3 class="sub">תארים</h3><div class="chips">${tr.map(([k, n]) => `<span class="chip gold">${esc(T_ICO[k] || '🏆')} ${esc(trophyHe(k))}${n > 1 ? ' ×' + esc(n) : ''}</span>`).join('')}</div>` : ''}
    ${aw.length ? `<h3 class="sub">פרסים</h3><div class="chips">${aw.map(([k, n]) => `<span class="chip">🏅 ${esc(awardHe(k))}${n > 1 ? ' ×' + esc(n) : ''}</span>`).join('')}</div>` : ''}
    ${(e.clubs || []).length ? `<h3 class="sub">מועדונים</h3><p class="small">${e.clubs.map((c) => esc(c.he)).join(' ← ')}</p>` : ''}
    ${e.createdAt ? `<p class="muted small">נכנס להיכל: ${esc(dateLabel(e.createdAt, false))}</p>` : ''}
    <button type="button" class="btn btn-primary" data-close>סגור</button>`, { sheet: true, testid: 'hof-detail' });
}
