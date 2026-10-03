// components.js: reusable HTML-string components. Every dynamic value is escaped here.
import { esc } from './dom.js';
import { rating as fmtRating, money } from './format.js';

const HEX = /^#[0-9a-fA-F]{3,8}$/;
const safeColor = (c, d) => (typeof c === 'string' && HEX.test(c) ? c : d);

export const SEL_HE = { starter: 'בהרכב', bench: 'על הספסל', out: 'מחוץ לסגל', injured: 'פצוע', suspended: 'מורחק', youth: 'קבוצת הנוער', national: 'בנבחרת', unknown: '' };
export const ODDS_HE = { low: 'נמוך', mid: 'בינוני', high: 'גבוה' };
export const RES_HE = { W: 'ניצחון', D: 'תיקו', L: 'הפסד' };

/** Initials for a club badge: first letter of up to two words. */
function initials(name) {
  const words = String(name || '?').replace(/["'׳״.]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2);
  return words[0][0] + words[1][0];
}

/** Team badge (club colours or national flag). size: 's' | 'm' | 'l' */
export function badge(team, size = 'm') {
  if (!team) return `<span class="badge badge-${size} badge-empty">?</span>`;
  if (team.flag) return `<span class="badge badge-${size} badge-flag" aria-hidden="true">${esc(team.flag)}</span>`;
  const [a, b] = Array.isArray(team.colors) ? team.colors : [];
  const c1 = safeColor(a, '#24304d'), c2 = safeColor(b, '#eef3ff');
  return `<span class="badge badge-${size}" style="--c1:${c1};--c2:${c2}" aria-hidden="true"><span>${esc(initials(team.shortHe || team.nameHe))}</span></span>`;
}

export function teamLabel(team, short = true) {
  if (!team) return '';
  return esc(short ? (team.shortHe || team.nameHe) : (team.nameHe || team.shortHe));
}

/** Horizontal stat bar 0..max. */
export function bar(label, value, { max = 100, cls = '', testid = '', suffix = '', show } = {}) {
  const v = Number(value) || 0;
  const w = Math.max(0, Math.min(100, (v / max) * 100));
  const tone = w >= 66 ? 'good' : w >= 35 ? 'mid' : 'bad';
  const tid = testid ? ` data-testid="${esc(testid)}"` : '';
  return `<div class="bar ${esc(cls)} tone-${tone}"${tid}>
    <div class="bar-top"><span class="bar-label">${esc(label)}</span><b class="num">${esc(show !== undefined ? show : Math.round(v))}${esc(suffix)}</b></div>
    <div class="bar-track"><i style="width:${w.toFixed(1)}%"></i></div></div>`;
}

/** Attribute row with value bar and season delta. */
export function attrRow(a) {
  const v = Number(a.value) || 0;
  const tone = v >= 80 ? 'elite' : v >= 70 ? 'good' : v >= 55 ? 'mid' : 'bad';
  const d = Number(a.delta) || 0;
  const dHtml = d ? `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</span>` : '';
  return `<div class="attr tone-${tone}"><span class="attr-name">${esc(a.he)}</span>
    <span class="attr-track"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></span>
    <b class="num attr-val">${v}</b>${dHtml}</div>`;
}

/** Stars 0.5..5 with half stars. */
export function stars(n, label = '') {
  const v = Math.max(0, Math.min(5, Number(n) || 0));
  let out = '';
  for (let i = 1; i <= 5; i++) {
    const cls = v >= i ? 's-full' : v >= i - 0.5 ? 's-half' : 's-empty';
    out += `<i class="star ${cls}">★</i>`;
  }
  return `<span class="stars" role="img" aria-label="${esc(label || v + ' כוכבים')}">${out}</span>`;
}

/** OVR circle. */
export function ovrCircle(ovr, { testid = '', size = 'm', label = 'OVR' } = {}) {
  const tid = testid ? ` data-testid="${esc(testid)}"` : '';
  const v = Math.round(Number(ovr) || 0);
  const tone = v >= 85 ? 'elite' : v >= 75 ? 'gold' : v >= 65 ? 'good' : 'base';
  return `<div class="ovr ovr-${size} tone-${tone}"${tid}><b class="num">${v}</b><small>${esc(label)}</small></div>`;
}

export function ratingChip(r) {
  if (r === null || r === undefined || !(Number(r) > 0)) return '';
  const v = Number(r);
  const tone = v >= 8 ? 'elite' : v >= 7 ? 'good' : v >= 6 ? 'mid' : 'bad';
  return `<span class="rchip tone-${tone} num">${esc(fmtRating(v))}</span>`;
}

export function oddsChip(odds, oddsHe) {
  const k = odds === 'low' || odds === 'mid' || odds === 'high' ? odds : 'mid';
  return `<span class="odds odds-${k}">${esc(oddsHe || ODDS_HE[k])}</span>`;
}

export function selChip(sel) {
  if (!sel || sel === 'unknown') return '';
  return `<span class="chip sel sel-${esc(sel)}">${esc(SEL_HE[sel] || sel)}</span>`;
}

export function resChip(res) {
  if (!res) return '';
  return `<span class="chip res res-${esc(res)}">${esc(RES_HE[res] || res)}</span>`;
}

/** Score box in RTL order: home number on the right next to the home team. */
export function scoreBox(score, cls = '') {
  if (!Array.isArray(score)) return `<span class="sc sc-vs ${esc(cls)}">נגד</span>`;
  return `<span class="sc ${esc(cls)}"><b class="num">${esc(score[0])}</b><i>-</i><b class="num">${esc(score[1])}</b></span>`;
}

/** Fixture row (FixtureVM). */
export function fixtureRow(fx, { showSel = true, showDate = false, act = '' } = {}) {
  if (!fx) return '';
  const r = fx.result;
  const actAttr = act ? ` data-act="${esc(act)}" data-key="${esc(fx.key)}" role="button" tabindex="0"` : '';
  const res = r ? `<span class="fx-res res-${esc(r.res || '')}"></span>` : '';
  return `<div class="fx${fx.big ? ' fx-big' : ''}${r ? ' fx-played' : ''}"${actAttr}>
    ${res}
    <div class="fx-meta"><span class="chip comp kind-${esc(fx.kind)}">${esc(fx.compHe)}</span>${fx.roundHe ? `<span class="muted">${esc(fx.roundHe)}</span>` : ''}${fx.big ? '<span class="big-tag">⭐ משחק גדול</span>' : ''}${showDate ? `<span class="muted fx-date">${esc(fx.dateHe)}</span>` : ''}</div>
    <div class="fx-teams">
      <span class="fx-team home${fx.isHome ? ' mine' : ''}">${badge(fx.home, 's')}<span class="tname">${teamLabel(fx.home)}</span></span>
      ${scoreBox(r ? r.score : null)}
      <span class="fx-team away${!fx.isHome ? ' mine' : ''}"><span class="tname">${teamLabel(fx.away)}</span>${badge(fx.away, 's')}</span>
    </div>
    <div class="fx-foot">${r && r.extraHe ? `<span class="muted">${esc(r.extraHe)}</span>` : ''}${showSel && !r ? selChip(fx.selection) : ''}${r ? ratingChip(r.rating) : ''}</div>
  </div>`;
}

const ZONE_HE = { champ: 'אליפות', ucl: 'ליגת האלופות', uel: 'הליגה האירופית', uecl: 'הקונפרנס', promo: 'עלייה', releg: 'ירידה', ko: 'עולה', kpo: 'פלייאוף', out: 'הדחה', q: 'מוקדמות' };

/** One table group (TableVM.groups[i]). */
export function tableGroup(g, { compact = false } = {}) {
  const rows = (g.rows || []).map((r) => `<tr class="${r.mine ? 'mine' : ''}${r.zone ? ' z-' + esc(r.zone) : ''}">
      <td class="rk"><span class="zbar"></span><b class="num">${esc(r.rank)}</b></td>
      <td class="tm"><span class="tm-in">${badge(r.team, 's')}<span class="tname">${teamLabel(r.team)}</span></span></td>
      <td class="num">${esc(r.p)}</td>
      ${compact ? '' : `<td class="num wdl">${esc(r.w)}</td><td class="num wdl">${esc(r.d)}</td><td class="num wdl">${esc(r.l)}</td>`}
      <td class="num gd" dir="ltr">${esc(r.gd > 0 ? '+' + r.gd : r.gd)}</td>
      <td class="num pts"><b>${esc(r.pts)}</b></td></tr>`).join('');
  return `<div class="tbl-wrap">${g.he ? `<h3 class="tbl-title">${esc(g.he)}</h3>` : ''}
    <table class="tbl"><thead><tr><th>#</th><th class="tm">קבוצה</th><th>מש׳</th>${compact ? '' : '<th class="wdl">נ</th><th class="wdl">ת</th><th class="wdl">ה</th>'}<th>הפרש</th><th>נק׳</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

export function tableLegend(legend) {
  if (!Array.isArray(legend) || !legend.length) return '';
  return `<div class="legend">${legend.map((l) => `<span class="lg z-${esc(l.zone)}"><i></i>${esc(l.he || ZONE_HE[l.zone] || '')}</span>`).join('')}</div>`;
}

/** Full TableVM. */
export function tableView(t, opts) {
  if (!t) return empty('אין טבלה להצגה');
  const groups = (t.groups || []).map((g) => tableGroup(g, opts)).join('');
  return `${t.formatHe ? `<div class="muted small">${esc(t.formatHe)}</div>` : ''}${groups}${tableLegend(t.legend)}${t.noteHe ? `<p class="note">${esc(t.noteHe)}</p>` : ''}`;
}

/** Ties of one bracket round. */
export function bracketRound(round) {
  if (!round) return empty('אין עדיין משחקים בשלב הזה');
  const ties = (round.ties || []).map((t) => {
    const legs = (t.legs || []).map((l, i) => `<span class="leg">${(t.legs.length > 1 ? (i === 0 ? 'ראשון ' : 'גומלין ') : '')}${l.score ? scoreBox(l.score) : '<span class="muted">טרם</span>'}</span>`).join('');
    return `<div class="tie${t.mine ? ' mine' : ''}">
      <div class="tie-team${t.winner === 'home' ? ' win' : ''}">${badge(t.home, 's')}<span class="tname">${teamLabel(t.home, false)}</span></div>
      <div class="tie-team${t.winner === 'away' ? ' win' : ''}">${badge(t.away, 's')}<span class="tname">${teamLabel(t.away, false)}</span></div>
      <div class="tie-legs">${legs}${t.aggHe ? `<span class="muted">${esc(t.aggHe)}</span>` : ''}</div></div>`;
  }).join('');
  return `<div class="ties">${ties || empty('אין עדיין משחקים בשלב הזה')}</div>`;
}

/** Chat bubble. */
export function bubble(m, isGroup = false) {
  const mine = !!m.mine;
  const who = !mine && isGroup && m.whoHe ? `<b class="who">${esc(m.whoHe)}</b>` : '';
  return `<div class="bub ${mine ? 'me' : 'them'}">${who}<span>${esc(m.textHe)}</span></div>`;
}

/** Segmented control. options: [{id, he}] */
export function segmented(name, options, current) {
  return `<div class="seg" role="tablist">${options.map((o) => `<button type="button" role="tab" class="seg-btn${o.id === current ? ' on' : ''}" data-act="seg" data-seg="${esc(name)}" data-val="${esc(o.id)}" aria-selected="${o.id === current}">${esc(o.he)}</button>`).join('')}</div>`;
}

export function empty(text, icon = '⚽') {
  return `<div class="empty"><div class="empty-ico">${esc(icon)}</div><p>${esc(text)}</p></div>`;
}

/** Grid of small stat tiles. items: [{label, value}] */
export function statGrid(items) {
  return `<div class="stat-grid">${items.map((i) => `<div class="stat"><b class="num">${esc(i.value)}</b><small>${esc(i.label)}</small></div>`).join('')}</div>`;
}

export function card(inner, { title = '', cls = '', testid = '', extra = '' } = {}) {
  const tid = testid ? ` data-testid="${esc(testid)}"` : '';
  return `<section class="card ${esc(cls)}"${tid}>${title ? `<h2 class="card-title">${esc(title)}${extra}</h2>` : ''}${inner}</section>`;
}

/** Form chips for last ratings. */
export function formChips(form) {
  if (!Array.isArray(form) || !form.length) return '<span class="muted small">אין עדיין משחקים</span>';
  return `<span class="form-chips">${form.map((r) => ratingChip(r)).join('')}</span>`;
}

/** Contract card (ContractVM). */
export function contractCard(c) {
  if (!c) return empty('אין לך חוזה כרגע', '📝');
  return `<div class="contract">
    <div class="row">${badge(c.club)}<div class="grow"><b>${teamLabel(c.club, false)}</b>${c.loan ? ' <span class="chip">השאלה</span>' : ''}<div class="muted small">${esc(c.roleHe || '')}</div></div></div>
    <div class="kv"><span>שכר</span><b class="num">${esc(money(c.wage))} לשבוע</b></div>
    <div class="kv"><span>חוזה</span><b>${esc(c.untilHe || '')}</b></div>
    ${c.rc ? `<div class="kv"><span>סעיף שחרור</span><b class="num">${esc(money(c.rc))}</b></div>` : ''}
    ${c.parentHe ? `<div class="kv"><span>מועדון האם</span><b>${esc(c.parentHe)}</b></div>` : ''}
    ${c.nextHe ? `<div class="kv"><span>חוזה עתידי</span><b>${esc(c.nextHe)}</b></div>` : ''}
  </div>`;
}

export function kv(label, value) {
  return `<div class="kv"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
}
