// achievements.js (v2.3, F5): #/achievements (badge grid with tiers + progress) and the unlock toast queue.
// Data: game.getAchievements() -> [{ id, tier: 'bronze'|'silver'|'gold', he, descHe, unlocked, progress, target, unlockedAbs }].
// Unlocks arrive as engine signals ('achievement' {id, tier}, 'objective_done' {id, kind}) through app.forwardSignals;
// they are paced here: never during a match replay, never on top of a goal celebration, at most one toast at a time.
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { ctx, call, openModal, buzz, reducedMotion } from './app.js';
import { navigate } from './router.js';
import { gtext } from './gender.js';
import { ico } from './icons.js';
import { empty } from './components.js';
import { celebrate, celebrating } from './scene/celebration.js';
import { starsState } from './cosmetics.js';
import * as STR from '../data/strings.js';

export const TIER_HE = { bronze: 'ארד', silver: 'כסף', gold: 'זהב' };
const ICO_RULES = [
  [/ballon|golden_ball|כדור.?הזהב/, 'ball'], [/golden_boy|boy|girl|kid/, 'star'], [/hat|trick|שלושער/, 'spark'], [/goal|score|scorer/, 'ball'],
  [/assist|playmak/, 'boot'], [/motm|mvp|man_of/, 'star'], [/clean|sheet|gk|keeper|save/, 'shield'], [/derby|rival/, 'fist'],
  [/abroad|move|transfer|plane/, 'plane'], [/top5|top_5|league_top/, 'up'], [/ucl|cl_|champ/, 'trophy'], [/wc|world/, 'globe'],
  [/nt_|national|cap|youth_nt|ynt/, 'flag'], [/manager|coach_trophy|mgr/, 'clipboard'], [/talk/, 'talk'], [/burn|load|surviv/, 'battery'],
  [/streak|daily|day/, 'spark'], [/share/, 'upload'], [/contract|pro|sign/, 'pen'], [/debut|first_app|first_match/, 'boot'],
  [/trophy|title|cup|league/, 'trophy'], [/legend|hof/, 'hof'], [/money|rich|shekel/, 'bank'], [/fan|star/, 'star'],
];
export function achIco(id) {
  const s = String(id || '').toLowerCase();
  const r = ICO_RULES.find(([re]) => re.test(s));
  return r ? r[1] : 'medal';
}
/** Hexagonal medal in the tier colour with the badge icon. */
export function medal(a, size = 56) {
  const tier = ['bronze', 'silver', 'gold'].includes(a.tier) ? a.tier : 'bronze';
  const tg = a.target > 0 ? Math.min(1, (Number(a.progress) || 0) / a.target) : 0;
  const C = 2 * Math.PI * 27, len = (a.unlocked ? 1 : tg) * C;
  return `<span class="medal m-${tier}${a.unlocked ? ' on' : ''}" style="--ms:${size}px" aria-hidden="true">
    <svg viewBox="0 0 64 64" class="medal-svg"><circle cx="32" cy="32" r="27" class="m-trk"/>${len > 0 ? `<circle cx="32" cy="32" r="27" class="m-val" stroke-dasharray="${len.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 32 32)"/>` : ''}
      <path class="m-hex" d="M32 9l19.9 11.5v23L32 55 12.1 43.5v-23z"/><path class="m-hex-in" d="M32 14l15.6 9v18L32 50l-15.6-9V23z"/></svg>
    <span class="medal-ico">${a.unlocked ? ico(achIco(a.id)) : ico('lock')}</span></span>`;
}

function getList() {
  if (typeof game.getAchievements !== 'function') return null;
  const r = call(() => game.getAchievements(), { quiet: true });
  return Array.isArray(r) ? r.filter((a) => a && a.id) : null;
}

/* ------------------------------------------------------------------ #/achievements */
export function render(root, params = {}) {
  let filter = ['all', 'open', 'got'].includes(params.f) ? params.f : 'all';
  function draw() {
    const list = getList();
    if (!list) { root.innerHTML = empty('ההישגים יופיעו כאן בקרוב', '🏅'); return; }
    const got = list.filter((a) => a.unlocked);
    const tiers = { bronze: 0, silver: 0, gold: 0 };
    for (const a of got) if (tiers[a.tier] !== undefined) tiers[a.tier]++;
    const ratio = (a) => (a.target > 0 ? (Number(a.progress) || 0) / a.target : 0);
    const recent = got.slice().sort((a, b) => (Number(b.unlockedAbs) || 0) - (Number(a.unlockedAbs) || 0)).slice(0, 3);
    let shown = filter === 'got' ? got : filter === 'open' ? list.filter((a) => !a.unlocked) : list;
    shown = shown.slice().sort((a, b) => (Number(b.unlocked) - Number(a.unlocked)) || (a.unlocked ? (Number(b.unlockedAbs) || 0) - (Number(a.unlockedAbs) || 0) : ratio(b) - ratio(a)));
    const st = starsState();
    root.innerHTML = `<div class="ach" data-testid="achievements">
      <section class="card ach-hero">
        <div class="ach-hero-n"><b class="num">${got.length}</b><small>/${list.length}</small><span>הישגים</span></div>
        <div class="ach-tiers">${['gold', 'silver', 'bronze'].map((t) => `<span class="ach-tier m-${t}"><i></i><b class="num">${tiers[t]}</b><small>${TIER_HE[t]}</small></span>`).join('')}</div>
        <div class="ach-prog"><i style="width:${list.length ? (got.length / list.length * 100).toFixed(1) : 0}%"></i></div>
        <a class="ach-stars" href="#/shop?cat=rewards">${ico('star', 'gold')}<span>${esc(st.balance)} ⭐ לבזבז בפרסים</span><span class="chev">‹</span></a>
      </section>
      ${recent.length ? `<h2 class="section-title"><span>נפתחו לאחרונה</span></h2><div class="ach-recent">${recent.map((a) => tile(a, true)).join('')}</div>` : ''}
      <div class="seg ach-filter" role="tablist">${[['all', 'הכול'], ['open', 'בדרך'], ['got', 'נפתחו']].map(([id, he]) => `<button type="button" role="tab" class="seg-btn${filter === id ? ' on' : ''}" data-act="f" data-v="${id}" aria-selected="${filter === id}">${he}</button>`).join('')}</div>
      <div class="ach-grid">${shown.map((a) => tile(a)).join('') || '<p class="muted center">אין כאן עדיין הישגים</p>'}</div>
      <a class="btn btn-ghost" href="#/leaderboard">${ico('table')}טבלת האגדות</a>
    </div>`;
  }
  function tile(a, big = false) {
    const pr = Math.min(Number(a.target) || 0, Number(a.progress) || 0);
    return `<button type="button" class="ach-tile t-${esc(a.tier)}${a.unlocked ? ' on' : ''}${big ? ' big' : ''}" data-act="open" data-id="${esc(a.id)}" data-testid="ach-${esc(a.id)}">
      ${medal(a, big ? 60 : 50)}<b>${esc(gtext(a.he))}</b>
      ${a.unlocked ? `<small class="ach-tier-l">${TIER_HE[a.tier] || ''}</small>` : a.target > 1 ? `<small class="num ach-pr">${esc(Math.round(pr))}/${esc(a.target)}</small>` : '<small class="ach-pr">נעול</small>'}
    </button>`;
  }
  function sheet(a) {
    const pr = Math.min(Number(a.target) || 0, Number(a.progress) || 0);
    const close = openModal(`<div class="ach-sheet t-${esc(a.tier)}">${medal(a, 96)}
      <span class="chip ach-chip m-${esc(a.tier)}">${TIER_HE[a.tier] || ''}</span>
      <h2 class="modal-title">${esc(gtext(a.he))}</h2>
      <p class="muted">${esc(gtext(a.descHe || ''))}</p>
      ${!a.unlocked && a.target > 0 ? `<div class="ach-sheet-bar"><i style="width:${(pr / a.target * 100).toFixed(0)}%"></i></div><p class="small num">${esc(Math.round(pr))} / ${esc(a.target)}</p>` : ''}
      <div class="btn-col">${a.unlocked ? `<button type="button" class="btn btn-gold btn-lg" data-a="share" data-testid="btn-share-ach">${ico('upload')}שתף את ההישג</button>` : ''}
      <button type="button" class="btn btn-ghost" data-close>סגירה</button></div></div>`, { sheet: true, testid: 'ach-sheet' });
    close.el.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-a="share"]')) return;
      const m = await import('./sharecard.js');
      m.shareMoment({ kind: 'achievement', titleHe: gtext(a.he), textHe: gtext(a.descHe || ''), tier: a.tier });
    });
  }
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b)) return;
    if (b.dataset.act === 'f') { filter = b.dataset.v; draw(); return; }
    if (b.dataset.act === 'open') { const a = (getList() || []).find((x) => x.id === b.dataset.id); if (a) sheet(a); }
  });
  draw();
}

/* ------------------------------------------------------------------ unlock toasts */
// Toast items (engine game.takeToasts()): { k: 'achievement'|'objective'|'milestone'|'migration'|'stars', id, tier?, he, descHe?, rewardHe?, stars? }
const queue = [];
let busy = false;
let holdTimer = 0;
const ACHU = (STR.ACH_UI && typeof STR.ACH_UI === 'object') ? STR.ACH_UI : {};
const PATHU = (STR.PATH && STR.PATH.ui) || {};

export function queueToasts(items) {
  for (const t of items || []) {
    if (!t || !t.k) continue;
    const id = String(t.id || t.he || '');
    if (queue.some((q) => q.k === t.k && String(q.id || q.he || '') === id)) continue;
    queue.push(t);
  }
  pump();
}
/** Older engines: signals ({name:'achievement'|'objective_done', props:{id,...}}). */
export function queueUnlocks(signals) {
  queueToasts((signals || []).map((s) => (s && s.props ? { k: s.name === 'achievement' ? 'achievement' : 'objective', ...s.props } : null)).filter(Boolean));
}

function blocked() {
  if (ctx.holdBadges) return true;
  try { if (celebrating()) return true; } catch { /* ignore */ }
  const h = location.hash || '';
  if (h.startsWith('#/match') && !document.querySelector('[data-testid="match-summary"]')) return true;
  if (h.startsWith('#/new')) return true;
  if (document.querySelector('.qs-tunnel, .cm-layer, [data-testid="legend-card"], [data-testid="daily-sheet"]')) return true;
  // one overlay at a time: the toasts wait for any open sheet (week summary, offer, reward) to close
  if (document.querySelector('.modal-wrap:not(.closing)')) return true;
  return false;
}

function pump() {
  if (busy || !queue.length) return;
  if (blocked()) { clearTimeout(holdTimer); holdTimer = setTimeout(pump, 900); return; }
  busy = true;
  const items = queue.length >= 3 ? queue.splice(0, queue.length) : [queue.shift()];
  showToast(items).finally(() => { busy = false; setTimeout(pump, 400); });
}

function describe(t) {
  if (t.k === 'achievement') {
    let a = null;
    if (!t.he) { try { a = (getList() || []).find((x) => x.id === t.id) || null; } catch { a = null; } }
    return { kind: 'ach', tier: t.tier || (a && a.tier) || 'bronze', he: gtext(t.he || (a && a.he) || 'הישג חדש'), descHe: gtext(t.descHe || (a && a.descHe) || ''), stars: Number(t.stars) || 0, id: t.id };
  }
  if (t.k === 'objective') return { kind: 'obj', he: gtext(t.he || 'משימה הושלמה'), rewardHe: gtext(t.rewardHe || (t.stars ? '+' + t.stars + ' ⭐' : '')), season: !!t.season };
  if (t.k === 'milestone') return { kind: 'path', he: gtext(t.he || ''), rewardHe: '' };
  return { kind: 'info', he: gtext(t.he || ''), rewardHe: t.stars ? '+' + t.stars + ' ⭐' : '' };
}

function showToast(items) {
  return new Promise((resolve) => {
    const ds = items.map(describe).filter((d) => d.he);
    if (!ds.length) { resolve(); return; }
    const multi = ds.length > 1;
    const first = ds[0];
    const achN = ds.filter((d) => d.kind === 'ach').length;
    const label = multi ? (achN ? `${ds.length} רגעים גדולים!` : `${ds.length} משימות הושלמו!`)
      : first.kind === 'ach' ? gtext(ACHU.toast || 'הישג חדש!') : first.kind === 'obj' ? (first.season ? 'משימת העונה הושלמה!' : 'משימה הושלמה!')
        : first.kind === 'path' ? gtext(PATHU.stepToast || 'צעד חדש בשביל הקריירה!') : '';
    const sub = !multi ? (first.kind === 'ach' ? (first.stars ? `+${first.stars} ⭐` + (first.descHe ? ' · ' + first.descHe : '') : first.descHe) : first.rewardHe) : '';
    const el = document.createElement('div');
    el.className = 'ach-toast' + (first.kind === 'ach' ? ' t-' + first.tier : first.kind === 'path' ? ' path' : ' obj');
    el.setAttribute('role', 'status');
    el.setAttribute('data-testid', first.kind === 'ach' ? 'ach-toast' : first.kind === 'path' ? 'path-toast' : 'obj-toast');
    const icon = first.kind === 'ach' ? medal({ id: first.id, tier: first.tier, unlocked: true, target: 1, progress: 1 }, 46)
      : `<span class="obj-ico big">${first.kind === 'path' ? ico('flag', 'gold') : ico('check', 'good')}</span>`;
    el.innerHTML = `<button type="button" class="at-main" data-a="open">${icon}<span class="at-txt"><small>${esc(label)}</small><b>${esc(multi ? ds.map((d) => d.he).slice(0, 3).join(' · ') : first.he)}</b>${sub ? `<em>${esc(sub)}</em>` : ''}</span></button>
      ${!multi && (first.kind === 'ach' || first.kind === 'path') ? `<button type="button" class="at-share" data-a="share" aria-label="שתף" data-testid="btn-toast-share">${ico('upload')}</button>` : ''}`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    buzz([25, 40, 70]);
    if ((first.kind === 'ach' || first.kind === 'path') && !reducedMotion()) {
      try { celebrate({ kind: 'trophy', small: true, textHe: label, subHe: multi ? '' : first.he }); } catch { /* ignore */ }
    }
    let done = false;
    const finish = () => { if (done) return; done = true; el.classList.remove('show'); setTimeout(() => { el.remove(); resolve(); }, 280); };
    const t = setTimeout(finish, multi ? 5200 : 4200);
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      clearTimeout(t);
      finish();
      if (b.dataset.a === 'share') {
        const m = await import('./sharecard.js');
        if (first.kind === 'path') m.shareMoment({ kind: 'promotion', titleHe: first.he, vars: { step: first.he } });
        else m.shareMoment({ kind: 'achievement', titleHe: first.he, textHe: first.descHe, tier: first.tier, vars: { ach: first.he } });
      } else navigate(first.kind === 'ach' ? '#/achievements' : '#/hub');
    });
  });
}
