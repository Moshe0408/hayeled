// hof.js: #/hof. Hall of Fame (separate dual-stored store; survives slot deletion). Works without a career.
import * as save from '../core/save.js';
import * as S from '../data/strings.js';
import { esc } from './dom.js';
import { openModal } from './app.js';
import { statGrid, empty, avatarFor, badge, nationTeam } from './components.js';
const natMark = (e) => (e.nation && nationTeam(e.nation) ? badge(nationTeam(e.nation), 'xs') : esc(e.flag || ''));
import { dateLabel } from './format.js';
import { trophyIco, awardIco } from './icons.js';
/** Season range; a single season prints once ('2044/45', not '2044/45–2044/45'). */
function range(a, b) { return !b || a === b ? String(a || '') : (a || '') + '–' + b; }


// a girl's career record uses the women's competition / award names (AWARDS_W / TROPHIES_W)
function trophyHe(k, f) { return (f && S.TROPHIES_W && S.TROPHIES_W[k]) || (S.TROPHIES && S.TROPHIES[k]) || k; }
function awardHe(k, f) { return (f && S.AWARDS_W && S.AWARDS_W[k]) || (S.AWARDS && S.AWARDS[k]) || k; }
function posHe(e) { const P = S.POSITIONS && S.POSITIONS[e.pos]; return (e.gender === 'f' && P && P.heF) || e.posHe || (P && P.he) || e.pos || ''; }

function trophyIcons(tr, f) {
  const items = Object.entries(tr || {}).filter(([, n]) => n > 0);
  if (!items.length) return '';
  return `<span class="hof-tr">${items.slice(0, 8).map(([k, n]) => `<span title="${esc(trophyHe(k, f))}">${trophyIco(k)}${n > 1 ? `<small class="num">${esc(n)}</small>` : ''}</span>`).join('')}</span>`;
}

export async function render(root) {
  root.innerHTML = '<div class="loading-line">טוען את היכל התהילה...</div>';
  let list = [];
  try { list = await save.loadHallOfFame(); } catch (e) { console.warn(e); list = []; }
  list = (list || []).slice().sort((a, b) => (b.legacy || 0) - (a.legacy || 0));
  root.innerHTML = `<div class="hof" data-testid="hof-list">
    <p class="muted small">כל קריירה שהסתיימה נשמרת כאן לתמיד, גם אם מוחקים משבצת או מתחילים קריירה חדשה.</p>
    ${list.length ? list.map((e, i) => `<button type="button" class="hof-item${i < 3 ? ' top' : ''}" data-act="open" data-id="${esc(e.careerId)}" data-testid="hof-item-${esc(e.careerId)}">
      <span class="hof-rank num">${i + 1}</span><span class="hof-av" aria-hidden="true">${avatarFor(e, { size: 44, pose: 'portrait' })}</span>
      <span class="grow"><b>${natMark(e)} ${esc(e.name)}${e.nick ? ` <span class="muted">"${esc(e.nick)}"</span>` : ''}</b>
        <small class="muted">${esc(posHe(e))} · <span dir="ltr">${esc(e.startSeason)}–${esc(e.endSeason)}</span> · ${esc(e.tierHe || '')}</small>${trophyIcons(e.trophies, e.gender === 'f')}</span>
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

/** R2: the coaching half of a "שחקן + מאמן" entry (e.coach from the engine's coachHof). */
function coachBlock(e) {
  const c = e.coach;
  if (!c || !c.games) return '';
  const f = e.gender === 'f';
  const tr = Object.entries(c.trophies || {}).filter(([, n]) => n > 0);
  const aw = Object.entries(c.awards || {}).filter(([, n]) => n > 0);
  return `<div class="hof-coach" data-testid="hof-coach">
    <h3 class="sub">${f ? 'הקריירה כמאמנת' : 'הקריירה כמאמן'}</h3>
    ${statGrid([{ label: 'עונות', value: c.seasons ?? 0 }, { label: 'משחקים', value: c.games ?? 0 }, { label: 'אחוז ניצחונות', value: (c.winPct ?? 0) + '%' },
      { label: 'ניצחונות', value: c.w ?? 0 }, { label: 'תיקו', value: c.d ?? 0 }, { label: 'הפסדים', value: c.l ?? 0 }])}
    ${tr.length ? `<div class="chips">${tr.map(([k, n]) => `<span class="chip gold">${trophyIco(k, '')} ${esc(trophyHe(k, f))}${n > 1 ? ' ×' + esc(n) : ''}</span>`).join('')}</div>` : ''}
    ${aw.length ? `<div class="chips">${aw.map(([k, n]) => `<span class="chip">${awardIco(k)} ${esc(awardHe(k, f))}${n > 1 ? ' ×' + esc(n) : ''}</span>`).join('')}</div>` : ''}
    ${(c.jobs || []).length ? `<p class="small">${c.jobs.map((j) => `${esc(j.roleHe ? j.roleHe + ' · ' : '')}${esc(j.he)} <span class="muted" dir="ltr">${esc(range(j.fromHe, j.toHe))}</span>`).join('<br>')}</p>` : ''}
  </div>`;
}

function detail(e) {
  const tr = Object.entries(e.trophies || {}).filter(([, n]) => n > 0);
  const aw = Object.entries(e.awards || {}).filter(([, n]) => n > 0);
  openModal(`<h2 class="modal-title">${natMark(e)} ${esc(e.name)}</h2>
    <div class="muted small">${esc(posHe(e))} · <span dir="ltr">${esc(e.startSeason)}–${esc(e.endSeason)}</span> · ${esc(e.seasons)} עונות · ${e.gender === 'f' ? 'פרשה' : 'פרש'} בגיל ${esc(e.age)}</div>
    <div class="legacy-big"><b class="num">${esc(Math.round(e.legacy || 0))}</b><span>${esc(e.tierHe || '')}</span></div>
    ${e.coach && e.coach.games ? `<h3 class="sub">${e.gender === 'f' ? 'הקריירה כשחקנית' : 'הקריירה כשחקן'}</h3>` : ''}
    ${statGrid([{ label: 'הופעות', value: e.apps ?? 0 }, { label: 'שערים', value: e.goals ?? 0 }, { label: 'בישולים', value: e.assists ?? 0 }, { label: 'נבחרת', value: e.caps ?? 0 }, { label: 'שערי נבחרת', value: e.intlGoals ?? 0 }, { label: 'דירוג שיא', value: e.peakOvr ?? 0 }])}
    ${tr.length ? `<h3 class="sub">תארים</h3><div class="chips">${tr.map(([k, n]) => `<span class="chip gold">${trophyIco(k, '')} ${esc(trophyHe(k, e.gender === 'f'))}${n > 1 ? ' ×' + esc(n) : ''}</span>`).join('')}</div>` : ''}
    ${aw.length ? `<h3 class="sub">פרסים</h3><div class="chips">${aw.map(([k, n]) => `<span class="chip">${awardIco(k)} ${esc(awardHe(k, e.gender === 'f'))}${n > 1 ? ' ×' + esc(n) : ''}</span>`).join('')}</div>` : ''}
    ${coachBlock(e)}
    ${(e.clubs || []).length ? `<h3 class="sub">מועדונים</h3><p class="small">${e.clubs.map((c) => esc(c.he)).join(' ← ')}</p>` : ''}
    ${e.createdAt ? `<p class="muted small">נכנס להיכל: ${esc(dateLabel(e.createdAt, false))}</p>` : ''}
    <button type="button" class="btn btn-primary" data-close>סגור</button>`, { sheet: true, testid: 'hof-detail' });
}
