// components.js: reusable HTML-string components. Every dynamic value is escaped here.
import { esc } from './dom.js';
import { rating as fmtRating, money } from './format.js';
import { crestSVG, avatarSVG, avatarFromMeta } from './ext.js';
import { g, gtext } from './gender.js';
import { emojiIco } from './icons.js';
import { COUNTRY_BY_ID } from '../data/countries.js';
import * as game from '../engine/game.js';

const HEX = /^#[0-9a-fA-F]{3,8}$/;
const safeColor = (c, d) => (typeof c === 'string' && HEX.test(c) ? c : d);

export const SEL_HE = { starter: 'בהרכב', bench: 'על הספסל', out: 'מחוץ לסגל', injured: 'פצוע{{|ה}}', suspended: 'מורחק{{|ת}}', youth: 'קבוצת הנוער', national: 'בנבחרת', unknown: '' };
export const ODDS_HE = { low: 'נמוך', mid: 'בינוני', high: 'גבוה' };
export const RES_HE = { W: 'ניצחון', D: 'תיקו', L: 'הפסד' };
const BADGE_PX = { xs: 18, s: 24, m: 38, l: 56, xl: 76 };

/* ------------------------------------------------------------------ */
/* Crests                                                              */
/* ------------------------------------------------------------------ */

/** Team crest (club crest or national-team shield). size: 'xs' | 's' | 'm' | 'l' | 'xl'. Same signature as v1. */
export function badge(team, size = 'm') {
  if (!team) return `<span class="badge crest badge-${size} badge-empty" aria-hidden="true">?</span>`;
  let t = team;
  if (t.flag && !Array.isArray(t.colors) && COUNTRY_BY_ID[t.id]) t = { ...t, colors: COUNTRY_BY_ID[t.id].colors };
  let svg = '';
  try { svg = crestSVG(t, BADGE_PX[size] || BADGE_PX.m); } catch (e) { console.warn('[hayeled] crest', e); svg = ''; }
  if (!svg) return `<span class="badge crest badge-${size} badge-empty" aria-hidden="true">?</span>`;
  return `<span class="badge crest badge-${size}" aria-hidden="true">${svg}</span>`;
}

/** Team-like object for a nation id (crest + kit colours). */
export function nationTeam(id) {
  const c = COUNTRY_BY_ID[id];
  if (!c) return null;
  return { id: c.id, nameHe: c.nameHe, shortHe: c.nameHe, flag: c.flag, colors: (c.colors || ['#4da3ff', '#ffffff']).slice(0, 2), nation: c.id };
}

export function teamLabel(team, short = true) {
  if (!team) return '';
  return esc(short ? (team.shortHe || team.nameHe) : (team.nameHe || team.shortHe));
}

/* ------------------------------------------------------------------ */
/* Avatar + player card                                                */
/* ------------------------------------------------------------------ */

const POS_NUM = { GK: 1, RB: 2, LB: 3, CB: 4, CDM: 6, RW: 7, CM: 8, ST: 9, CAM: 10, LW: 11 };
export function shirtNumber(pos, num) { return num || POS_NUM[pos] || 9; }

/** Avatar SVG for a career (meta = getSaveMeta()-like: careerId, gender, look, pos). opts override. */
export function avatarFor(meta = {}, opts = {}) {
  // R8: without explicit kit colours, a career without a club (retired) wears the colours of its last club
  if (!opts.kitColors && meta && !meta.clubId && (meta.retired || meta.stage === 'retired')) {
    const kit = lastClubKit(meta.careerId);
    if (kit) opts = { ...opts, kitColors: kit };
  }
  let base = {};
  try { base = avatarFromMeta(meta) || {}; } catch { base = {}; }
  const look = meta.look || {};
  const o = { gender: meta.gender === 'f' ? 'f' : 'm', ...base, ...(look.skin !== undefined ? { skin: look.skin } : {}), ...(look.hair !== undefined ? { hair: look.hair } : {}), ...(look.hairColor !== undefined ? { hairColor: look.hairColor } : {}), ...opts };
  try { return avatarSVG(o) || ''; } catch (e) { console.warn('[hayeled] avatar', e); return ''; }
}

/** Kit colours of the last (non-loan, if any) club of the career in memory; null if unknown. */
export function lastClubKit(careerId) {
  try {
    if (!game.hasCareer()) return null;
    if (careerId) { const m = game.getSaveMeta(); if (m && m.careerId !== careerId) return null; }
    const clubs = (game.getCareer() || {}).clubs || [];
    const pick = clubs.slice().reverse().find((c) => c && !c.loan && c.club) || clubs[clubs.length - 1];
    const col = pick && pick.club && pick.club.colors;
    return Array.isArray(col) && col.length ? col.slice(0, 2) : null;
  } catch { return null; }
}

export function cardTier(ovr) {
  const v = Number(ovr) || 0;
  return v >= 85 ? 'icon' : v >= 75 ? 'gold' : v >= 65 ? 'silver' : 'bronze';
}

// Hebrew abbreviations with a geresh (מהירות, בעיטה, מסירה, כדרור, הגנה, פיזיות / זינוק, תפיסה, רפלקסים, מיקום)
const CARD_ATTR = { pac: 'מהי׳', sho: 'בעי׳', pas: 'מסי׳', dri: 'כדר׳', def: 'הגנ׳', phy: 'פיז׳', div: 'זינ׳', han: 'תפי׳', ref: 'רפל׳', gkp: 'מיק׳', kic: 'בעי׳' };
/** Short Hebrew position code for the card (instead of ST / CAM). */
const POS_SHORT = { GK: ['שוער', 'שוערת'], CB: ['בלם', 'בלמית'], LB: ['מגן', 'מגנה'], RB: ['מגן', 'מגנה'], CDM: ['קשר', 'קשרית'], CM: ['קשר', 'קשרית'], CAM: ['קשר', 'קשרית'], LW: ['כנף', 'כנף'], RW: ['כנף', 'כנף'], ST: ['חלוץ', 'חלוצה'] };
export function posShortHe(pos, gender) { const v = POS_SHORT[pos]; if (!v) return pos || ''; return gender === 'f' ? v[1] : gender === 'm' ? v[0] : g(v[0], v[1]); }
const CARD_ORDER_OUT = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
const CARD_ORDER_GK = ['div', 'han', 'kic', 'ref', 'pac', 'gkp'];

/**
 * FUT-style player card.
 * p: { name, nick, ovr, pos, posHe, attrs:[{key,value}], gk, gender, meta, club(team), nation(team), number, testid }
 */
export function playerCard(p, { size = 'm', tilt = true, testid = '', ovrTestid = '' } = {}) {
  const tier = cardTier(p.ovr);
  const club = p.club || null;
  const kit = club && Array.isArray(club.colors) ? club.colors : (p.nation && p.nation.colors) || ['#1d4ed8', '#ffffff'];
  const num = shirtNumber(p.pos, p.number);
  const art = avatarFor(p.meta || { gender: p.gender }, { kitColors: kit, number: num, size: size === 'l' ? 150 : 120, pose: 'portrait', bg: false });
  const order = p.gk ? CARD_ORDER_GK : CARD_ORDER_OUT;
  const amap = {};
  for (const a of p.attrs || []) amap[a.key] = a.value;
  const keys = order.filter((k) => amap[k] !== undefined);
  const attrs = keys.length ? `<div class="pc-attrs">${keys.map((k) => `<span class="pc-a ${attrTone(amap[k])}"><b class="num">${esc(amap[k])}</b><small>${esc(CARD_ATTR[k] || k)}</small></span>`).join('')}</div>` : '';
  const parts = String(p.name || '').trim().split(/\s+/);
  const shown = p.nick || parts.slice(1).join(' ') || parts[0] || '';
  const tid = testid ? ` data-testid="${esc(testid)}"` : '';
  return `<div class="pcard pc-${size} tier-${tier}${tilt ? ' tiltable' : ''}"${tid}>
    <div class="pc-body">
      <i class="pc-shine" aria-hidden="true"></i>
      <div class="pc-side">
        <b class="pc-ovr num"${ovrTestid ? ` data-testid="${esc(ovrTestid)}"` : ""}>${p.ovr === null ? "?" : esc(Math.round(Number(p.ovr) || 0))}</b>
        <span class="pc-pos">${esc(posShortHe(p.pos, p.gender || (p.meta && p.meta.gender)))}</span>
        ${p.nation ? `<span class="pc-ico">${badge(p.nation, 's')}</span>` : ''}
        ${club ? `<span class="pc-ico">${badge(club, 's')}</span>` : ''}
      </div>
      <div class="pc-art" aria-hidden="true">${art}</div>
      <div class="pc-name"><span>${esc(shown)}</span></div>
      ${attrs}
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Bars, attributes, form, morale                                      */
/* ------------------------------------------------------------------ */

/** FM colour tier for a 0..100 attribute: red <40, orange 40-59, yellow 60-69, light green 70-79, green 80+. */
export function attrTone(v) {
  const n = Number(v) || 0;
  return n >= 80 ? 'av-5' : n >= 70 ? 'av-4' : n >= 60 ? 'av-3' : n >= 40 ? 'av-2' : 'av-1';
}

/** Horizontal stat bar 0..max. */
export function bar(label, value, { max = 100, cls = '', testid = '', suffix = '', show, ico = '' } = {}) {
  const v = Number(value) || 0;
  const w = Math.max(0, Math.min(100, (v / max) * 100));
  const tone = w >= 66 ? 'good' : w >= 35 ? 'mid' : 'bad';
  const tid = testid ? ` data-testid="${esc(testid)}"` : '';
  return `<div class="bar ${esc(cls)} tone-${tone}"${tid}>
    <div class="bar-top"><span class="bar-label">${ico}${esc(label)}</span><b class="num">${esc(show !== undefined ? show : Math.round(v))}${esc(suffix)}</b></div>
    <div class="bar-track"><i style="width:${w.toFixed(1)}%"></i></div></div>`;
}

/** Attribute row (FM style: name, bar, colour-coded value, season delta). */
export function attrRow(a) {
  const v = Number(a.value) || 0;
  const d = Number(a.delta) || 0;
  const dHtml = d ? `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</span>` : '<span class="delta"></span>';
  return `<div class="attr ${attrTone(v)}"><span class="attr-name">${esc(a.he)}</span>
    <span class="attr-track"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></span>
    <b class="num attr-val">${v}</b>${dHtml}</div>`;
}

/** FM attribute table: dense two-column grid of name ... value. */
export function attrTable(attrs = []) {
  return `<div class="attr-table">${attrs.map((a) => {
    const v = Number(a.value) || 0;
    const d = Number(a.delta) || 0;
    return `<div class="at-row"><span class="at-name">${esc(a.he)}</span>${d ? `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</span>` : ''}<b class="at-val num ${attrTone(v)}">${v}</b></div>`;
  }).join('')}</div>`;
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
export function ovrCircle(ovr, { testid = '', size = 'm', label = 'דירוג' } = {}) {
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

/** Form strip: last match ratings as FM-style coloured blocks (oldest first). */
export function formDots(form, { max = 5 } = {}) {
  if (!Array.isArray(form) || !form.length) return '<span class="muted small">אין עדיין משחקים</span>';
  return `<span class="form-dots">${form.slice(-max).map((r) => {
    const v = Number(r) || 0;
    const tone = v >= 8 ? 'elite' : v >= 7 ? 'good' : v >= 6 ? 'mid' : 'bad';
    return `<i class="fd tone-${tone} num" title="${esc(fmtRating(v))}">${esc(fmtRating(v))}</i>`;
  }).join('')}</span>`;
}

const MORALE = [
  [85, 'm5', 'מעולה'], [70, 'm4', 'טוב מאוד'], [55, 'm3', 'טוב'], [40, 'm2', 'סביר'], [25, 'm1', 'נמוך'], [-1, 'm0', 'גרוע'],
];
const FACE = {
  m5: 'M8 14.5q4 4.5 8 0', m4: 'M8.5 14.5q3.5 3 7 0', m3: 'M9 15q3 1.5 6 0', m2: 'M9 15.5h6', m1: 'M9 16q3-1.5 6 0', m0: 'M8.5 16.5q3.5-3 7 0',
};
/** Morale: { cls, he } by value. */
export function moraleInfo(v) {
  const n = Number(v) || 0;
  const m = MORALE.find(([t]) => n >= t) || MORALE[MORALE.length - 1];
  return { cls: m[1], he: m[2] };
}
export function moraleIcon(v, { label = true } = {}) {
  const m = moraleInfo(v);
  return `<span class="morale ${m.cls}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><circle cx="9" cy="10" r="1.1"/><circle cx="15" cy="10" r="1.1"/><path d="${FACE[m.cls]}"/></svg>${label ? `<b>${esc(m.he)}</b>` : ''}</span>`;
}

export function oddsChip(odds, oddsHe) {
  const k = odds === 'low' || odds === 'mid' || odds === 'high' ? odds : 'mid';
  return `<span class="odds odds-${k}">${esc(oddsHe || ODDS_HE[k])}</span>`;
}

export function selChip(sel) {
  if (!sel || sel === 'unknown') return '';
  return `<span class="chip sel sel-${esc(sel)}">${esc(gtext(SEL_HE[sel] || sel))}</span>`;
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

/* ------------------------------------------------------------------ */
/* Fixtures, tables, brackets                                          */
/* ------------------------------------------------------------------ */

/** Fixture row (FixtureVM). */
export function fixtureRow(fx, { showSel = true, showDate = false, act = '' } = {}) {
  if (!fx) return '';
  const r = fx.result;
  const actAttr = act ? ` data-act="${esc(act)}" data-key="${esc(fx.key)}" role="button" tabindex="0"` : '';
  const res = r ? `<span class="fx-res res-${esc(r.res || '')}"></span>` : '';
  return `<div class="fx${fx.big ? ' fx-big' : ''}${r ? ' fx-played' : ''}"${actAttr}>
    ${res}
    <div class="fx-meta"><span class="chip comp kind-${esc(fx.kind)}">${esc(fx.compHe)}</span>${fx.roundHe ? `<span class="muted">${esc(fx.roundHe)}</span>` : ''}${fx.big ? '<span class="big-tag">★ משחק גדול</span>' : ''}${showDate ? `<span class="muted fx-date">${esc(fx.dateHe)}</span>` : ''}</div>
    <div class="fx-teams">
      <span class="fx-team home${fx.isHome ? ' mine' : ''}">${badge(fx.home, 'm')}<span class="tname">${teamLabel(fx.home)}</span></span>
      ${scoreBox(r ? r.score : null)}
      <span class="fx-team away${!fx.isHome ? ' mine' : ''}"><span class="tname">${teamLabel(fx.away)}</span>${badge(fx.away, 'm')}</span>
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

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

/** Chat bubble. */
export function bubble(m, isGroup = false) {
  const mine = !!m.mine;
  const who = !mine && isGroup && m.whoHe ? `<b class="who">${esc(m.whoHe)}</b>` : '';
  return `<div class="bub ${mine ? 'me' : 'them'}">${who}<span>${esc(m.textHe)}</span></div>`;
}

/** Segmented control (FM-style tab strip). options: [{id, he}] */
export function segmented(name, options, current) {
  return `<div class="seg" role="tablist">${options.map((o) => `<button type="button" role="tab" class="seg-btn${o.id === current ? ' on' : ''}" data-act="seg" data-seg="${esc(name)}" data-val="${esc(o.id)}" aria-selected="${o.id === current}">${esc(o.he)}</button>`).join('')}</div>`;
}

export function empty(text, icon = '⚽') {
  // emoji arguments map to the shared line icons (one visual language)
  const ic = emojiIco(icon) || esc(icon);
  return `<div class="empty"><div class="empty-ico">${ic}</div><p>${esc(gtext(text))}</p></div>`;
}

/** Grid of small stat tiles. items: [{label, value}] */
export function statGrid(items) {
  return `<div class="stat-grid">${items.map((i) => `<div class="stat"><b class="num">${esc(i.value)}</b><small>${esc(i.label)}</small></div>`).join('')}</div>`;
}

/** Panel with an FM-style header (accent bar + hairline). */
export function card(inner, { title = '', cls = '', testid = '', extra = '' } = {}) {
  const tid = testid ? ` data-testid="${esc(testid)}"` : '';
  return `<section class="card ${esc(cls)}"${tid}>${title ? `<h2 class="card-title"><span>${esc(title)}</span>${extra}</h2>` : ''}${inner}</section>`;
}

/** Form chips for last ratings (v1 API; now FM-style dots). */
export function formChips(form) {
  return formDots(form);
}

/** Contract card (ContractVM). */
export function contractCard(c) {
  if (!c) return empty('אין לך חוזה כרגע', '📝');
  return `<div class="contract">
    <div class="row">${badge(c.club, 'l')}<div class="grow"><b>${teamLabel(c.club, false)}</b>${c.loan ? ' <span class="chip">השאלה</span>' : ''}<div class="muted small">${esc(c.roleHe || '')}</div></div></div>
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

export { g, gtext };
