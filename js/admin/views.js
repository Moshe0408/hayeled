// js/admin/views.js - admin dashboard renderers (SPEC §8.7).
// SECURITY: feedback/context/house-ad data comes from anonymous players or the network.
// Everything is rendered with textContent / value / setAttribute (never as HTML markup).
import { APP_VERSION } from '../config.js';
import { REMOTE_DEFAULTS, deepMerge, safeUrl } from '../core/remote.js';
import { SupaError } from '../core/supa.js';
import * as api from './api.js';
import { AuthLostError } from './api.js';
import { lineChart, columnChart, rankList, splitBar, rateBars } from './charts.js';
import { mountFunnel, schemaBanner23 } from './views23.js';

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** European top-5 leagues (same ids for the men's and the women's competitions). */
export const TOP5_LEAGUES = ['eng1', 'esp1', 'ita1', 'ger1', 'fra1'];
const C_BOY = '#3987e5';    // series-1 (validated pair on the card surface)
const C_GIRL = '#d95926';   // series-2

// ---------- DOM helpers ----------
/** h(tag, attrs, ...children). attrs: class, text, testid, on* handlers, dataset via data-*, everything else setAttribute. */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = String(v);
      else if (k === 'testid') el.setAttribute('data-testid', v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k === 'disabled') el.disabled = !!v;
      else if (k === 'hidden') el.hidden = !!v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
export function clear(el) {
  while (el && el.firstChild) el.removeChild(el.firstChild);
}

let toastTimer = null;
export function toast(text, { error = false } = {}) {
  const t = document.getElementById('adm-toast');
  if (!t) return;
  t.textContent = String(text);
  t.className = 'adm-toast' + (error ? ' err' : '');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

// ---------- formatting ----------
const dtFmt = (() => {
  try { return new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return null; }
})();
/** '04.10.26 · 00:58' (Israel time). Built from parts with a neutral separator so no comma lands on the wrong side in RTL. */
export function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso || '');
  if (!dtFmt || typeof dtFmt.formatToParts !== 'function') return d.toISOString().slice(0, 16).replace('T', ' ');
  const p = {};
  for (const x of dtFmt.formatToParts(d)) p[x.type] = x.value;
  return p.day + '.' + p.month + '.' + p.year + ' · ' + p.hour + ':' + p.minute;
}
/** One unit style everywhere: '42 שנ׳', '11 דק׳ 7 שנ׳', '7 שע׳ 55 דק׳'. */
export function fmtDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh) return hh + ' שע׳' + (mm ? ' ' + mm + ' דק׳' : '');
  if (mm) return mm + ' דק׳' + (ss ? ' ' + ss + ' שנ׳' : '');
  return ss + ' שנ׳';
}
/** Short Latin code for a country: emoji flags (e.g. England's) render badly on Windows, so every nation gets letters. */
function natCode(c, id) {
  if (c && typeof c.flag === 'string') {
    if (/^[A-Z]{2,3}$/.test(c.flag)) return c.flag;
    // regional-indicator pair (e.g. the Israeli flag) -> its two letters 'IL'
    const cps = Array.from(c.flag).map((ch) => ch.codePointAt(0));
    if (cps.length === 2 && cps.every((cp) => cp >= 0x1F1E6 && cp <= 0x1F1FF)) return cps.map((cp) => String.fromCharCode(65 + cp - 0x1F1E6)).join('');
  }
  const k = String(id || '').toLowerCase();
  const MAP = { eng: 'EN', sco: 'SC', wal: 'WA', nir: 'NI' };
  return MAP[k] || String(id || '').slice(0, 2).toUpperCase();
}
const n0 = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
function stars(r) {
  const k = Math.max(0, Math.min(5, Math.round(n0(r))));
  return '★'.repeat(k) + '☆'.repeat(5 - k);
}

// ---------- Hebrew names for ids (data modules are optional at runtime) ----------
let namesPromise = null;
export function loadNames() {
  if (!namesPromise) {
    namesPromise = (async () => {
      const out = { countries: {}, clubs: {}, positions: {}, leagues: {}, crests: null };
      try { const m = await import('../data/countries.js'); out.countries = m.COUNTRY_BY_ID || {}; } catch { /* optional */ }
      try { const m = await import('../data/leagues.js'); out.clubs = m.CLUB_INDEX || {}; out.leagues = m.LEAGUE_BY_ID || {}; } catch { /* optional */ }
      try { const m = await import('../data/strings.js'); out.positions = m.POSITIONS || {}; } catch { /* optional */ }
      try { out.crests = await import('../ui/crests.js'); } catch { /* optional: rows show a monogram instead */ }
      return {
        nation(id) { const c = out.countries[id]; return c ? (natCode(c, id) + ' ' + c.nameHe) : String(id); },
        club(id) { const c = out.clubs[id]; return c && c.club ? c.club.nameHe : String(id); },
        /** data: URL of the club's crest (the game's own generator, js/ui/crests.js) or '' when unknown. */
        crest(id, size = 64) {
          const c = out.clubs[id];
          if (!c || !c.club || !out.crests || typeof out.crests.crestDataURL !== 'function') return '';
          try { return out.crests.crestDataURL({ id: c.club.id, nameHe: c.club.nameHe, shortHe: c.club.shortHe, colors: c.club.colors }, size); } catch { return ''; }
        },
        pos(id) { const p = out.positions[id]; return p ? (p.he + ' (' + id + ')') : String(id); },
        /** Hebrew name only (players tab: no Latin code). */
        nationHe(id) { const c = out.countries[id]; return c ? c.nameHe : String(id); },
        leagueHe(id) { const l = out.leagues[id]; return l ? (l.shortHe || l.nameHe) : (id === '?' ? 'לא ידוע' : String(id)); },
        isTop5(id) { return TOP5_LEAGUES.includes(id); },
        league(id) {
          const l = out.leagues[id];
          if (!l) return id === '?' ? 'לא ידוע' : String(id);
          const c = out.countries[l.countryId];
          return (c ? natCode(c, l.countryId) + ' ' : '') + (l.shortHe || l.nameHe) + (TOP5_LEAGUES.includes(id) ? ' ★' : '');
        },
      };
    })();
  }
  return namesPromise;
}

// ---------- shared states ----------
export function renderMessage(root, { title, text, code, retry } = {}) {
  clear(root);
  root.appendChild(h('div', { class: 'adm-card adm-msg adm-center' },
    h('img', { class: 'adm-logo-img', src: './icons/emblem.svg', alt: '', width: '64', height: '83' }),
    h('div', { class: 'adm-logo', text: 'הילד מהשכונה' }),
    title ? h('h2', { text: title }) : null,
    text ? h('p', { text }) : null,
    code ? h('p', {}, h('code', { text: code })) : null,
    retry ? h('button', { class: 'adm-btn primary', type: 'button', text: 'נסה שוב', onclick: retry }) : null,
  ));
}

/** Map an error to a friendly Hebrew message (or rethrow auth loss: the router handles it). */
export function showError(root, e, retry) {
  if (e instanceof AuthLostError) return;
  if (e instanceof SupaError && e.status === 0) {
    renderMessage(root, { title: 'אין חיבור לשרת', text: 'בדוק את החיבור לאינטרנט. אם הפרויקט ב-Supabase הושהה (אחרי 7 ימים בלי פעילות), היכנס ללוח הבקרה של Supabase כדי להעיר אותו.', retry });
    return;
  }
  if (e instanceof SupaError && e.status === 404) {
    renderMessage(root, { title: 'הפונקציות לא נמצאו בשרת', text: 'נראה ש-supabase/schema.sql עוד לא הורץ (או שצריך להריץ אותו שוב).', code: e.code, retry });
    return;
  }
  renderMessage(root, { title: 'שגיאה', text: (e && e.message) || String(e), code: e && e.code ? String(e.code) : '', retry });
}

export function errText(e) {
  if (e instanceof SupaError && e.status === 0) return 'אין חיבור לשרת';
  return (e && e.message) || String(e);
}

/** Banner shown while supabase/update-2.1.sql has not been run on the server (the 2.1 tools stay hidden). */
export function schemaBanner(extra) {
  return h('div', { class: 'adm-banner', role: 'status', testid: 'adm-schema-banner' },
    h('span', { class: 'ic', 'aria-hidden': 'true', text: '!' }),
    h('div', {},
      h('strong', { text: 'יש להריץ את update-2.1.sql' }),
      h('p', {}, 'הנתונים החדשים של גרסה 2.1 והכלים (מחיקת משוב, סינון לפי דירוג, איפוס) יופיעו אחרי הרצת הקובץ ',
        h('code', { text: 'supabase/update-2.1.sql' }), ' בעורך ה-SQL של Supabase. ההסבר המלא נמצא בקובץ ',
        h('code', { text: 'docs/ADMIN_SETUP.md' }), ', בסעיף "עדכון 2.1".'),
      extra ? h('p', { text: extra }) : null));
}

/** Banner shown while supabase/update-2.2.sql has not been run (the 2.2 training / coach-talk block stays hidden). */
export function schemaBanner22(extra) {
  return h('div', { class: 'adm-banner', role: 'status', testid: 'adm-schema-banner-22' },
    h('span', { class: 'ic', 'aria-hidden': 'true', text: '!' }),
    h('div', {},
      h('strong', { text: 'יש להריץ את update-2.2.sql' }),
      h('p', {}, 'הנתונים של גרסה 2.2 (עוצמת אימון, שחיקות, פציעות באימון, שיחות עם המאמן ולשונית השחקנים) יופיעו אחרי הרצת הקובץ ',
        h('code', { text: 'supabase/update-2.2.sql' }), ' בעורך ה-SQL של Supabase. ההסבר המלא נמצא בקובץ ',
        h('code', { text: 'docs/ADMIN_SETUP.md' }), ', בסעיף "עדכון 2.2".'),
      extra ? h('p', { text: extra }) : null));
}

// ---------- header ----------
export function renderHeader(active, { onLogout } = {}) {
  const link = (id, hash, label) => h('a', { href: hash, testid: 'nav-' + id, class: active === id ? 'active' : '', 'aria-current': active === id ? 'page' : null, text: label });
  return h('header', { class: 'adm-header' },
    h('a', { class: 'adm-brand', href: '#/dash', 'aria-label': 'לוח הניהול' },
      h('img', { src: './icons/emblem.svg', alt: '', width: '40', height: '52' }),
      h('h1', { class: 'adm-title' }, h('span', { class: 'gold', text: 'הילד מהשכונה' }), ' · ניהול',
        h('small', { text: api.currentEmail() + ' · גרסת משחק ' + APP_VERSION }))),
    h('nav', { class: 'adm-nav' },
      link('dash', '#/dash', 'לוח'),
      link('players', '#/players', 'שחקנים'),
      link('board', '#/board', 'טבלה'),
      link('feedback', '#/feedback', 'משובים'),
      link('tools', '#/tools', 'כלים'),
      h('a', { href: '#/config', testid: 'nav-config', class: active === 'config' ? 'active' : '', 'aria-current': active === 'config' ? 'page' : null },
        'הגדרות', h('span', { class: 'adm-nav-long', text: ' ופרסומות' })),
    ),
    h('button', { class: 'adm-btn danger adm-logout', type: 'button', testid: 'btn-logout', text: 'התנתק', onclick: onLogout }),
  );
}

// ---------- #/login ----------
export function renderLogin(root, { onSuccess, initialError = '' } = {}) {
  clear(root);
  const email = h('input', { class: 'adm-input', type: 'email', testid: 'adm-email', autocomplete: 'username', dir: 'ltr', required: true, placeholder: 'you@example.com' });
  const pass = h('input', { class: 'adm-input', type: 'password', testid: 'adm-password', autocomplete: 'current-password', dir: 'ltr', required: true });
  const err = h('div', { class: 'adm-error', testid: 'adm-error', role: 'alert', text: initialError });
  const btn = h('button', { class: 'adm-btn primary', type: 'submit', testid: 'adm-login', text: 'כניסה' });
  const form = h('form', { class: 'adm-card adm-form', novalidate: true },
    h('label', { class: 'adm-field' }, h('span', { text: 'אימייל' }), email),
    h('label', { class: 'adm-field' }, h('span', { text: 'סיסמה' }), pass),
    err, btn);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    err.textContent = '';
    if (!email.value.trim() || !pass.value) { err.textContent = 'הזן אימייל וסיסמה'; return; }
    btn.disabled = true;
    btn.textContent = 'מתחבר...';
    const r = await api.login(email.value.trim(), pass.value);
    btn.disabled = false;
    btn.textContent = 'כניסה';
    if (r.ok) { pass.value = ''; onSuccess && onSuccess(); return; }
    err.textContent = r.error === 'not_admin' ? 'למשתמש הזה אין הרשאת מנהל'
      : r.error === 'bad_credentials' ? 'אימייל או סיסמה שגויים'
        : r.error === 'network' ? 'אין חיבור לשרת. נסה שוב.'
          : 'שגיאה בהתחברות: ' + (r.message || r.error);
  });
  root.appendChild(h('div', { class: 'adm-center' },
    h('img', { class: 'adm-login-logo', src: './icons/logo.svg', alt: 'הילד מהשכונה', width: '300', height: '195' }),
    h('p', { text: 'כניסת מנהל' }),
    form,
    h('p', { class: 'adm-muted', text: 'על מכשיר משותף, לחץ "התנתק" בסיום.' }),
  ));
  setTimeout(() => { try { email.focus(); } catch { /* ignore */ } }, 0);
}

// ---------- #/dash ----------
export function kpi(testid, label, value, sub, { hero = false, dot = false, gold = false } = {}) {
  return h('div', { class: 'adm-card adm-kpi' + (hero ? ' hero' : '') + (gold ? ' gold' : '') },
    h('div', { class: 'label' }, dot ? h('span', { class: 'dot', 'aria-hidden': 'true' }) : null, label),
    h('div', { class: 'value', testid: testid || null, 'data-value': String(value), text: String(value) }),
    sub ? h('div', { class: 'sub', text: sub }) : null,
  );
}

// Hebrew labels for the job tiers of manager_started {tier} (unknown keys are shown as-is)
const MANAGER_TIER_HE = {
  national: 'נבחרת לאומית', elite: 'מאמן ראשי במועדון ענק', top: 'מאמן ראשי במועדון בכיר',
  lower: 'מאמן ראשי בליגה נמוכה', assistant: 'עוזר מאמן', youth: 'מאמן נוער', '?': 'לא ידוע',
};
function managerTierHe(k) { return MANAGER_TIER_HE[k] || String(k); }
// retired {tier}: top5 | europe | tier1 | tier2 | none (numbers are shown as a league level)
const LEAGUE_TIER_HE = {
  top5: 'ליגת טופ 5 באירופה', europe: 'ליגה בכירה אחרת באירופה', tier1: 'ליגה בכירה מחוץ לאירופה',
  tier2: 'ליגה שנייה', none: 'בלי מועדון', '1': 'ליגה ראשונה', '2': 'ליגה שנייה', '?': 'לא ידוע',
};
function leagueTierHe(k) { return LEAGUE_TIER_HE[String(k)] || String(k); }
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const NEUTRAL = '#64789E';   // "the rest" segment of a part-to-whole bar

/** The v2.1 dashboard block (supabase/update-2.1.sql admin_stats_v2). */
function drawV21(body, v2, names) {
  const g = v2.careers_by_gender || {};
  const mgr = v2.manager || {};
  const intro = v2.intro || {};
  const goals = v2.goals || {};
  const ret = v2.retired || {};
  const introTotal = n0(intro.done) + n0(intro.skipped);
  const retTotal = n0(ret.total);
  const rg = ret.by_gender || {};
  const mg = mgr.by_gender || {};
  const map = (arr, fn) => (Array.isArray(arr) ? arr : []).map((x) => ({ name: fn(x.key), count: n0(x.count) }));

  body.appendChild(h('div', { class: 'adm-section-title gold' }, h('span', { text: 'קריירות, מאמנים ופרישות' }), h('span', { class: 'tag', text: '2.1' })));
  body.appendChild(h('div', { class: 'adm-grid wide', testid: 'v21-kpis' },
    kpi('kpi-careers-m', 'קריירות של בנים', n0(g.m), n0(g.m_7d) + ' ב-7 ימים'),
    kpi('kpi-careers-f', 'קריירות של בנות', n0(g.f), n0(g.f_7d) + ' ב-7 ימים'),
    kpi('kpi-manager', 'קריירות אימון שהתחילו', n0(mgr.started), n0(mgr.sacked) + ' פיטורים · ' + n0(mgr.trophies) + ' תארים', { gold: true }),
    kpi('kpi-intro', 'צפו בפתיחה עד הסוף', introTotal ? pct(n0(intro.done), introTotal) + '%' : '–', n0(intro.done) + ' צפו · ' + n0(intro.skipped) + ' דילגו'),
    kpi('kpi-goals', 'שערים שהבקיעו השחקנים', n0(goals.total), 'חגיגות מגה: ' + n0(goals.mega)),
    kpi('kpi-top5', 'הגיעו לליגת טופ 5 באירופה', n0(ret.top5), retTotal ? pct(n0(ret.top5), retTotal) + '% מהפורשים · סיימו שם ' + n0(ret.final_top5) : 'עוד אין פרישות', { gold: true }),
  ));

  const perDay = Array.isArray(v2.careers_per_day) ? v2.careers_per_day : [];
  body.appendChild(h('div', { class: 'adm-cols' },
    h('div', { class: 'adm-card' },
      h('h3', { text: 'בנים מול בנות (קריירות חדשות)' }),
      splitBar([
        { name: 'בנים', value: n0(g.m), color: C_BOY },
        { name: 'בנות', value: n0(g.f), color: C_GIRL },
        ...(n0(g.unknown) ? [{ name: 'לא ידוע (גרסה ישנה)', value: n0(g.unknown), color: NEUTRAL }] : []),
      ], { testid: 'chart-gender' }),
      h('div', { style: 'height:10px' }),
      lineChart([
        { name: 'בנים', color: C_BOY, points: perDay.map((d) => ({ day: d.day, count: n0(d.m) })) },
        { name: 'בנות', color: C_GIRL, points: perDay.map((d) => ({ day: d.day, count: n0(d.f) })) },
      ], { height: 170, testid: 'chart-gender-days' })),
    h('div', { class: 'adm-card' },
      h('h3', { text: 'הפתיחה, שערים ומגה' }),
      h('div', { class: 'adm-muted', style: 'font-size:13px;margin-bottom:6px', text: 'פתיחה של 8 שניות: צפו עד הסוף מול דילגו' }),
      splitBar([
        { name: 'צפו עד הסוף', value: n0(intro.done), color: C_BOY },
        { name: 'דילגו', value: n0(intro.skipped), color: NEUTRAL },
      ], { testid: 'chart-intro', empty: 'עוד אין נתוני פתיחה' }),
      h('div', { style: 'height:14px' }),
      h('div', { class: 'adm-muted', style: 'font-size:13px;margin-bottom:6px', text: 'שערים: חגיגת מגה מול שער רגיל' }),
      splitBar([
        { name: 'חגיגות מגה', value: n0(goals.mega), color: C_GIRL },
        { name: 'שערים רגילים', value: Math.max(0, n0(goals.total) - n0(goals.mega)), color: NEUTRAL },
      ], { testid: 'chart-goals', empty: 'עוד אין שערים' }),
      h('div', { style: 'height:14px' }),
      h('div', { class: 'adm-muted', style: 'font-size:13px;margin-bottom:6px', text: 'פרישות לפי מגדר · ממוצע מורשת: ' + n0(ret.avg_legacy) }),
      splitBar([
        { name: 'שחקנים', value: n0(rg.m), color: C_BOY },
        { name: 'שחקניות', value: n0(rg.f), color: C_GIRL },
      ], { testid: 'chart-retired-gender', empty: 'עוד אין פרישות' })),
  ));

  body.appendChild(h('div', { class: 'adm-cols three' },
    h('div', { class: 'adm-card', testid: 'v21-retire-league' }, h('h3', { text: 'פרישה: הליגה האחרונה' }),
      rankList(map(ret.by_league, (k) => names.league(k)), { empty: 'עוד אין פרישות' }),
      h('div', { class: 'adm-muted', style: 'font-size:12px;margin-top:6px', text: '★ = ליגת טופ 5 באירופה (אנגליה, ספרד, איטליה, גרמניה, צרפת)' })),
    h('div', { class: 'adm-card' }, h('h3', { text: 'פרישה: רמת הליגה האחרונה' }),
      rankList(map(ret.by_tier, leagueTierHe), { empty: 'עוד אין פרישות' })),
    h('div', { class: 'adm-card', testid: 'v21-manager-tier' }, h('h3', { text: 'מאמנים: התפקיד הראשון' }),
      rankList(map(mgr.by_tier, managerTierHe), { empty: 'עוד אין קריירות אימון' }),
      n0(mgr.jobs) ? h('div', { class: 'adm-muted', style: 'font-size:12px;margin-top:6px', text: 'סה"כ ' + n0(mgr.jobs) + ' תפקידים (כולל מעברים) · פרשו מאימון: ' + n0(mgr.retired) }) : null,
      n0(mg.m) + n0(mg.f) ? h('div', { style: 'margin-top:10px' }, splitBar([
        { name: 'מאמנים', value: n0(mg.m), color: C_BOY },
        { name: 'מאמנות', value: n0(mg.f), color: C_GIRL },
      ], { testid: 'chart-manager-gender' })) : null),
  ));
}

// ---------- v2.2: training load + coach talks (supabase/update-2.2.sql admin_stats_v3) ----------
export const INTENSITY_HE = { light: 'קל', normal: 'רגיל', hard: 'קשה', extreme: 'קיצוני' };
// ordinal ramp (one hue, blue 550 -> 100): darker = easier, lighter = harder (more contrast on the dark card)
// the game's own intensity colours (css/v22.css --int-*), a shade darker for the admin's light cards
const INTENSITY_COLOR = { light: '#13A89A', normal: '#3987E5', hard: '#E8930C', extreme: '#E5484D' };
// approaches as in the coach-talk screen: ask teal, demand amber, threat red
const APPROACH_COLOR = { ask: '#13A89A', demand: '#E8930C', threat: '#E5484D' };
const FOCUS_HE = {
  balanced: 'מאוזן', shooting: 'בעיטות', technique: 'טכניקה', defense: 'הגנה', physical: 'כושר ומהירות',
  goalkeeping: 'שוערים', rest: 'מנוחה', '?': 'לא ידוע',
};
export const APPROACH_HE = { ask: 'בקשה', demand: 'דרישה', threat: 'איום בעזיבה' };
/** Base success chance of each approach in the game's formula (docs/SPEC-2.2-training-bench.md §4.2). */
const APPROACH_BASE = { ask: 0.55, demand: 0.40, threat: 0.30 };
const per100 = (a, b) => (b ? (Math.round((a / b) * 1000) / 10).toFixed(1) : '0');

function intensityParts(o) {
  const x = o || {};
  return ['light', 'normal', 'hard', 'extreme'].map((k) => ({ name: INTENSITY_HE[k], value: n0(x[k]), color: INTENSITY_COLOR[k] }));
}

/** The v2.2 dashboard block. */
function drawV22(body, v3) {
  const tr = v3.training || {};
  const bi = tr.by_intensity || {};
  const bi7 = tr.by_intensity_7d || {};
  const burn = v3.burnout || {};
  const inj = v3.injury_training || {};
  const talk = v3.coach_talk || {};
  const ba = talk.by_approach || {};
  const weeks = n0(tr.weeks);
  const intWeeks = n0(bi.light) + n0(bi.normal) + n0(bi.hard) + n0(bi.extreme);
  const hardWeeks = n0(bi.hard) + n0(bi.extreme);
  const talks = n0(talk.total);
  const perDay = Array.isArray(v3.per_day) ? v3.per_day : [];

  body.appendChild(h('div', { class: 'adm-section-title gold' }, h('span', { text: 'אימונים ושיחות עם המאמן' }), h('span', { class: 'tag', text: '2.2' })));
  body.appendChild(h('div', { class: 'adm-grid wide', testid: 'v22-kpis' },
    kpi('kpi-train-weeks', 'שבועות אימון', weeks, n0(tr.weeks_7d) + ' ב-7 ימים · ' + n0(tr.devices) + ' שחקנים'),
    kpi('kpi-train-hard', 'אימון קשה או קיצוני', intWeeks ? pct(hardWeeks, intWeeks) + '%' : '–', 'קיצוני: ' + (intWeeks ? pct(n0(bi.extreme), intWeeks) : 0) + '% מהשבועות'),
    kpi('kpi-burnouts', 'שחיקות', n0(burn.total), per100(n0(burn.total), weeks) + ' לכל 100 שבועות אימון'),
    kpi('kpi-injury-training', 'פציעות באימון', n0(inj.total), per100(n0(inj.total), weeks) + ' לכל 100 שבועות אימון'),
    kpi('kpi-coach-talks', 'שיחות עם המאמן', talks, n0(talk.total_7d) + ' ב-7 ימים · ' + n0(talk.devices) + ' שחקנים'),
    kpi('kpi-coach-success', 'שיחות שהצליחו', talks ? pct(n0(talk.success), talks) + '%' : '–', n0(talk.success) + ' מתוך ' + talks, { gold: true }),
  ));

  const restW = n0(bi.rest);
  body.appendChild(h('div', { class: 'adm-cols' },
    h('div', { class: 'adm-card', testid: 'v22-intensity' },
      h('h3', { text: 'עוצמת האימון שנבחרה (שבועות)' }),
      splitBar(intensityParts(bi), { testid: 'chart-intensity', empty: 'עוד אין שבועות אימון' }),
      h('div', { style: 'height:14px' }),
      h('div', { class: 'adm-muted', style: 'font-size:13px;margin-bottom:6px', text: 'ב-7 הימים האחרונים' }),
      splitBar(intensityParts(bi7), { testid: 'chart-intensity-7d', empty: 'אין שבועות אימון ב-7 הימים האחרונים' }),
      h('div', { class: 'adm-note-sm', testid: 'v22-rest',
        text: 'שבועות מנוחה: ' + restW + (weeks ? ' (' + pct(restW, weeks) + '% מכל השבועות)' : '') + '. מנוחה לא נספרת בעוצמות.' })),
    h('div', { class: 'adm-card', testid: 'v22-coach' },
      h('h3', { text: 'שיחות עם המאמן לפי גישה' }),
      rateBars(['ask', 'demand', 'threat'].map((k) => ({
        name: APPROACH_HE[k], success: n0((ba[k] || {}).success), total: n0((ba[k] || {}).total),
        color: APPROACH_COLOR[k], ref: APPROACH_BASE[k], refLabel: 'סיכוי בסיס בנוסחה ' + Math.round(APPROACH_BASE[k] * 100) + '%', testid: 'coach-rate-' + k,
      })), { testid: 'chart-coach-approach', empty: 'עוד אין שיחות עם המאמן' }),
      talks ? h('div', { class: 'adm-note-sm' }, h('span', { class: 'adm-ref-key', 'aria-hidden': 'true' }),
        'הקו הלבן = סיכוי הבסיס של הגישה בנוסחה, לפני ההשפעה של הרמה, האמון, הכושר, העומס והחוזה.') : null,
      talks ? h('div', { style: 'margin-top:12px' },
        h('div', { class: 'adm-muted', style: 'font-size:13px;margin-bottom:6px', text: 'איזו גישה השחקנים בוחרים' }),
        splitBar(['ask', 'demand', 'threat'].map((k, i) => ({
          name: APPROACH_HE[k], value: n0((ba[k] || {}).total), color: APPROACH_COLOR[k] || ['#3987e5', '#d95926', '#199e70'][i],
        })), { testid: 'chart-coach-share' })) : null),
  ));

  body.appendChild(h('div', { class: 'adm-cols' },
    h('div', { class: 'adm-card', testid: 'v22-per-day' },
      h('h3', { text: 'שחיקות ופציעות באימון לפי יום (30 ימים)' }),
      lineChart([
        { name: 'שחיקות', color: C_BOY, points: perDay.map((d) => ({ day: d.day, count: n0(d.burnout) })) },
        { name: 'פציעות באימון', color: C_GIRL, points: perDay.map((d) => ({ day: d.day, count: n0(d.injury_training) })) },
      ], { height: 170, testid: 'chart-burnout-days' })),
    h('div', { class: 'adm-card', testid: 'v22-focus' },
      h('h3', { text: 'פוקוס האימון (שבועות)' }),
      rankList((Array.isArray(tr.by_focus) ? tr.by_focus : []).map((x) => ({ name: FOCUS_HE[x.key] || String(x.key), count: n0(x.count) })),
        { empty: 'עוד אין שבועות אימון' })),
  ));
}

/** v2.2: the plain-words summary at the top of the dashboard (numbers from admin_stats, nothing new on the server).
 *  "עד היום נכנסו 28 אנשים · היום 17 · השבוע 20 · מחוברים עכשיו 0 · שוחקו 79 משחקים · 6 קריירות · דירוג 4.8 מתוך 12 משובים" */
export function summaryCard(s) {
  const big = (testid, v, cls = '') => h('b', { class: 'n' + (cls ? ' ' + cls : ''), testid, 'data-value': String(v), text: String(v) });
  const item = (cls, ...parts) => h('span', { class: 'adm-sum-item' + (cls ? ' ' + cls : '') }, ...parts);
  const rc = n0(s.rating_count);
  const avg = rc ? (Math.round(n0(s.rating_avg) * 10) / 10).toFixed(1) : '0';
  const card = h('section', { class: 'adm-card adm-summary', testid: 'summary-card', 'aria-label': 'סיכום במילים פשוטות' },
    h('h2', { class: 'adm-sum-title', text: 'במילים פשוטות' }),
    h('p', { class: 'adm-sum-line', testid: 'summary-text' },
      item('lead', 'עד היום נכנסו ', big('sum-people', n0(s.total_devices)), ' אנשים'),
      item('', 'היום נכנסו ', big('sum-today', n0(s.dau))),
      item('', 'השבוע נכנסו ', big('sum-week', n0(s.wau))),
      item('live', h('span', { class: 'dot', 'aria-hidden': 'true' }), 'מחוברים עכשיו ', big('sum-online', n0(s.online_now), 'green')),
      item('', 'שוחקו ', big('sum-matches', n0(s.matches_played)), ' משחקים'),
      item('', 'התחילו ', big('sum-careers', n0(s.careers_started)), ' קריירות'),
      rc
        ? item('gold', 'דירוג ממוצע ', big('sum-rating', avg, 'gold'), h('span', { 'aria-hidden': 'true', class: 'star', text: '★' }), ' (לפי ', big('sum-rating-count', rc, 'small'), ' משובים)')
        : item('', 'עוד אין דירוגים', h('b', { class: 'n', testid: 'sum-rating', 'data-value': '0', hidden: true, text: '0' }))),
    h('p', { class: 'adm-sum-note', testid: 'summary-note' },
      h('b', { text: '"אנשים" = מכשירים: ' }),
      'כל טלפון או מחשב שפתח את המשחק נספר פעם אחת (לפי מזהה אנונימי של המכשיר).'),
    h('p', { class: 'adm-sum-note sub' },
      '"היום" = 24 השעות האחרונות · "השבוע" = 7 הימים האחרונים · "מחוברים עכשיו" = פעילים ב-2 הדקות האחרונות'));
  return card;
}

export function renderDash(root) {
  clear(root);
  const body = h('div', {}, h('div', { class: 'adm-loading', text: 'טוען נתונים...' }));
  root.appendChild(body);
  let timer = null;
  let alive = true;
  let funnelCleanup = null;

  const load = async () => {
    try {
      // the 2.1 stats never break the 2.0 dashboard: missing -> null (banner), other failure -> 'error'
      const v2p = api.getStatsV2(30).catch((e) => { if (e instanceof AuthLostError) throw e; return 'error'; });
      // same for 2.2: missing update-2.2.sql -> null (banner), other failure -> 'error'
      const v3p = api.getStatsV3(30).catch((e) => { if (e instanceof AuthLostError) throw e; return 'error'; });
      const [s, names, v2, v3] = await Promise.all([api.getStats(30), loadNames(), v2p, v3p]);
      if (!alive) return;
      draw(s || {}, names, v2, v3);
    } catch (e) {
      if (alive) showError(body, e, load);
    }
  };

  const draw = (s, names, v2, v3) => {
    clear(body);
    body.appendChild(summaryCard(s));
    const later23 = ' בסוף הרץ גם את supabase/update-2.3.sql (המשפך, החזרה למשחק וטבלת המובילים, סעיף "עדכון 2.3").';
    if (v2 === null) body.appendChild(schemaBanner((v3 === null ? 'אחרי זה הרץ גם את supabase/update-2.2.sql (נתוני האימונים והשיחות עם המאמן של 2.2, סעיף "עדכון 2.2").' : '') + later23));
    else if (v3 === null) body.appendChild(schemaBanner22(later23.trim()));
    // v2.3: the funnel / retention block loads on its own (missing update-2.3.sql -> its own banner)
    const funnelSlot = h('div', { class: 'adm-v23', testid: 'v23-slot' });
    body.appendChild(funnelSlot);
    if (funnelCleanup) { try { funnelCleanup(); } catch { /* ignore */ } }
    funnelCleanup = mountFunnel(funnelSlot, { showBanner: v2 !== null && v3 !== null });
    const ads = s.ads || {};
    const imp = n0(ads.impressions_total);
    const clk = n0(ads.clicks_total);
    const ctr = imp ? ((clk / imp) * 100).toFixed(1) + '%' : '–';
    const ratingCount = n0(s.rating_count);

    body.appendChild(h('div', { class: 'adm-row' },
      h('span', { class: 'adm-muted', text: 'עודכן: ' + fmtDate(s.generated_at || new Date().toISOString()) + ' (שעון ישראל)' }),
      h('span', { class: 'adm-spacer' }),
      h('button', { class: 'adm-btn small', type: 'button', text: 'רענן', onclick: () => { clear(body); body.appendChild(h('div', { class: 'adm-loading', text: 'טוען נתונים...' })); load(); } }),
    ));

    body.appendChild(h('div', { class: 'adm-section-title', text: 'אנשים (מכשירים) - הפירוט המלא' }));
    const onlineTile = kpi('kpi-online', 'מחוברים עכשיו', n0(s.online_now), 'פעילים ב-2 הדקות האחרונות', { hero: true, dot: true });
    body.appendChild(h('div', { class: 'adm-grid wide' },
      onlineTile,
      kpi('kpi-devices', 'סה"כ אנשים (מכשירים)', n0(s.total_devices)),
      kpi('kpi-dau', 'פעילים היום (DAU)', n0(s.dau), '24 שעות אחרונות'),
      kpi('kpi-wau', 'פעילים השבוע (WAU)', n0(s.wau), '7 ימים'),
      kpi('kpi-mau', 'פעילים החודש (MAU)', n0(s.mau), '30 ימים'),
      kpi('kpi-installs', 'התקנות למסך הבית', n0(s.installs_total), n0(s.installs_7d) + ' ב-7 ימים'),
    ));

    body.appendChild(h('div', { class: 'adm-section-title', text: 'מעורבות' }));
    body.appendChild(h('div', { class: 'adm-grid wide' },
      kpi('kpi-sessions', 'כניסות היום', n0(s.sessions_today)),
      kpi('kpi-avg-session', 'משך כניסה ממוצע היום', fmtDuration(s.avg_session_sec_today), 'ממוצע 7 ימים: ' + fmtDuration(s.avg_session_sec_7d)),
      kpi('kpi-careers', 'קריירות שהתחילו', n0(s.careers_started), n0(s.careers_7d) + ' ב-7 ימים'),
      kpi('kpi-matches', 'משחקים ששוחקו', n0(s.matches_played), n0(s.matches_7d) + ' ב-7 ימים'),
      kpi('kpi-seasons', 'עונות שהושלמו', n0(s.seasons_completed)),
      kpi('kpi-retirements', 'פרישות', n0(s.retirements), 'העברות: ' + n0(s.transfers)),
    ));

    if (v2 && typeof v2 === 'object') drawV21(body, v2, names);
    else if (v2 === 'error') body.appendChild(h('p', { class: 'adm-warn', text: 'נתוני 2.1 לא נטענו כרגע. לחץ "רענן" כדי לנסות שוב.' }));
    if (v3 && typeof v3 === 'object') drawV22(body, v3);
    else if (v3 === 'error') body.appendChild(h('p', { class: 'adm-warn', testid: 'v22-error', text: 'נתוני 2.2 לא נטענו כרגע. לחץ "רענן" כדי לנסות שוב.' }));

    body.appendChild(h('div', { class: 'adm-section-title', text: 'דירוג ומשובים' }));
    body.appendChild(h('div', { class: 'adm-grid' },
      kpi('kpi-rating', 'דירוג ממוצע ★', ratingCount ? n0(s.rating_avg).toFixed(2) : '0', ratingCount + ' דירוגים'),
      h('a', { href: '#/feedback', class: 'adm-card adm-kpi', style: null },
        h('div', { class: 'label', text: 'משובים שלא נקראו' }),
        h('div', { class: 'value', testid: 'kpi-unread', text: String(n0(s.feedback_unread)) }),
        h('div', { class: 'sub', text: 'מתוך ' + n0(s.feedback_total) + ' · לחץ לתיבת המשובים' })),
    ));

    // charts
    const blue = '#3987e5';
    const orange = '#d95926';
    const newPts = Array.isArray(s.new_per_day) ? s.new_per_day : [];
    const actPts = Array.isArray(s.active_per_day) ? s.active_per_day : [];
    const dist = s.rating_dist || {};
    body.appendChild(h('div', { class: 'adm-cols' },
      h('div', { class: 'adm-card' },
        h('h3', { text: 'שחקנים חדשים ופעילים לפי יום (30 ימים)' }),
        lineChart([
          { name: 'חדשים', color: blue, points: newPts },
          ...(actPts.length === newPts.length ? [{ name: 'פעילים', color: orange, points: actPts }] : []),
        ], { testid: 'chart-new' })),
      h('div', { class: 'adm-card' },
        h('h3', { text: 'התפלגות דירוגים' }),
        ratingCount
          ? columnChart(['1', '2', '3', '4', '5'].map((k) => ({ label: k + '★', value: n0(dist[k]) })), { testid: 'chart-rating' })
          : h('div', { class: 'adm-empty', text: 'עוד אין דירוגים' })),
    ));

    body.appendChild(h('div', { class: 'adm-section-title', text: 'מה השחקנים בוחרים (קריירות חדשות)' }));
    const map = (arr, fn) => (Array.isArray(arr) ? arr : []).map((x) => ({ name: fn(x.key), count: n0(x.count) }));
    body.appendChild(h('div', { class: 'adm-cols three' },
      h('div', { class: 'adm-card' }, h('h3', { text: 'נבחרות / לאומים' }), rankList(map(s.top_nations, names.nation))),
      h('div', { class: 'adm-card' }, h('h3', { text: 'עמדות' }), rankList(map(s.top_positions, names.pos))),
      h('div', { class: 'adm-card' }, h('h3', { text: 'מועדונים' }), rankList(map(s.top_clubs, names.club))),
    ));

    body.appendChild(h('div', { class: 'adm-section-title', text: 'פרסומות' }));
    const byPl = Array.isArray(ads.by_placement) ? ads.by_placement : [];
    const plName = { hub_banner: 'באנר במסך הבית', interstitial: 'מסך מלא בין מחזורים', rewarded: 'פרסומת עם פרס', '?': 'לא ידוע' };
    body.appendChild(h('div', { class: 'adm-grid' },
      kpi('kpi-ad-imp', 'חשיפות (סה"כ)', imp, n0(ads.impressions_7d) + ' ב-7 ימים'),
      kpi('kpi-ad-clk', 'הקלקות (סה"כ)', clk, n0(ads.clicks_7d) + ' ב-7 ימים'),
      kpi('kpi-ad-ctr', 'CTR', ctr),
      kpi('kpi-ad-rw', 'צפיות עם פרס (7 ימים)', n0(ads.rewarded_7d)),
    ));
    if (byPl.length) {
      const t = h('table', { class: 'adm-table' },
        h('thead', {}, h('tr', {}, h('th', { text: 'מיקום' }), h('th', { text: 'חשיפות' }), h('th', { text: 'הקלקות' }), h('th', { text: 'CTR' }))),
        h('tbody', {}, byPl.map((p) => h('tr', {},
          h('td', { text: plName[p.placement] || String(p.placement) }),
          h('td', { class: 'n', text: String(n0(p.impressions)) }),
          h('td', { class: 'n', text: String(n0(p.clicks)) }),
          h('td', { class: 'n', text: n0(p.impressions) ? ((n0(p.clicks) / n0(p.impressions)) * 100).toFixed(1) + '%' : '–' }),
        ))));
      body.appendChild(h('div', { class: 'adm-card', style: null }, t));
    } else {
      body.appendChild(h('div', { class: 'adm-empty', text: 'פרסומות כבויות או שעוד אין חשיפות. אפשר להפעיל בלשונית "הגדרות ופרסומות".' }));
    }

    body.appendChild(h('div', { class: 'adm-section-title', text: 'מכשירים' }));
    const platName = { android: 'אנדרואיד', ios: 'אייפון / אייפד', desktop: 'מחשב', other: 'אחר' };
    body.appendChild(h('div', { class: 'adm-cols' },
      h('div', { class: 'adm-card' }, h('h3', { text: 'פלטפורמות' }), rankList(map(s.platforms, (k) => platName[k] || k))),
      h('div', { class: 'adm-card' }, h('h3', { text: 'גרסאות משחק' }), rankList(map(s.versions, (k) => 'v' + k))),
    ));

    // auto-refresh "online now" every 60 s while visible
    clearInterval(timer);
    timer = setInterval(async () => {
      if (!alive || document.visibilityState === 'hidden') return;
      try {
        const s2 = await api.getStats(30);
        for (const id of ['kpi-online', 'sum-online']) {
          const el = root.querySelector(`[data-testid="${id}"]`);
          if (el && s2) { el.textContent = String(n0(s2.online_now)); el.setAttribute('data-value', String(n0(s2.online_now))); }
        }
      } catch { /* keep the old value */ }
    }, 60000);
  };

  load();
  return () => { alive = false; clearInterval(timer); if (funnelCleanup) { try { funnelCleanup(); } catch { /* ignore */ } } };
}

// ---------- CSV export (feedback) ----------
const CSV_HEAD = ['מזהה', 'תאריך (שעון ישראל)', 'דירוג', 'הודעה', 'אימייל', 'גרסה', 'נקרא', 'הקשר', 'מכשיר'];
/** One CSV cell: quoted, quotes doubled, spreadsheet formulas neutralised (CSV injection). */
export function csvCell(v) {
  let s = v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export function feedbackCsv(rows) {
  const lines = [CSV_HEAD.map(csvCell).join(',')];
  for (const f of Array.isArray(rows) ? rows : []) {
    lines.push([f.id, fmtDate(f.created_at), n0(f.rating), f.message || '', f.email || '', f.app_version || '',
      f.is_read ? 'כן' : 'לא', f.context && typeof f.context === 'object' ? f.context : {}, f.device_id || ''].map(csvCell).join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';   // BOM: Excel opens Hebrew correctly
}
function downloadText(name, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name, hidden: true });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}
async function exportFeedbackCsv(btn, filters = {}) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'מכין קובץ...';
  try {
    const rows = await api.fetchAllFeedback(filters);
    const day = new Date().toISOString().slice(0, 10);
    downloadText('hayeled-feedback-' + day + '.csv', feedbackCsv(rows));
    toast('יוצאו ' + rows.length + ' משובים ✓');
    return rows.length;
  } catch (e) {
    if (!(e instanceof AuthLostError)) toast('הייצוא נכשל: ' + errText(e), { error: true });
    return -1;
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

/** Two-tap confirm button: the first tap arms it (red, new label) for 4 s, the second tap runs action(). */
export function armedButton(attrs, { label, armedLabel, action }) {
  const btn = h('button', { ...attrs, type: 'button', text: label });
  let armed = false;
  let timer = null;
  const disarm = () => { armed = false; clearTimeout(timer); btn.classList.remove('armed'); btn.textContent = label; btn.removeAttribute('data-armed'); };
  btn.addEventListener('click', async () => {
    if (!armed) {
      armed = true;
      btn.classList.add('armed');
      btn.textContent = armedLabel;
      btn.setAttribute('data-armed', '1');
      timer = setTimeout(disarm, 4000);
      return;
    }
    clearTimeout(timer);
    btn.disabled = true;
    try { await action(); } finally { btn.disabled = false; disarm(); }
  });
  return btn;
}

// ---------- #/feedback ----------
export function renderFeedback(root, { onUnreadChange } = {}) {
  clear(root);
  const PAGE = 50;
  const state = { offset: 0, unreadOnly: false, rating: null, total: 0, unread: 0 };
  let alive = true;
  const unreadToggle = h('input', { type: 'checkbox', testid: 'fb-unread-only' });
  const countLbl = h('span', { class: 'adm-muted', testid: 'fb-count' });
  const chips = h('div', { class: 'adm-chips', role: 'group', 'aria-label': 'סינון לפי דירוג', testid: 'fb-rating-filter', hidden: true });
  const bannerSlot = h('div');
  const list = h('div', { class: 'adm-fb' }, h('div', { class: 'adm-loading', text: 'טוען משובים...' }));
  const pager = h('div', { class: 'adm-pager' });
  const exportBtn = h('button', { class: 'adm-btn small', type: 'button', testid: 'btn-export-csv', text: '⬇ ייצוא CSV', title: 'ייצוא המשובים לפי הסינון הנוכחי' });
  exportBtn.addEventListener('click', () => exportFeedbackCsv(exportBtn, { unreadOnly: state.unreadOnly, rating: state.rating }));
  const drawCount = () => { countLbl.textContent = 'סה"כ ' + state.total + ' · לא נקראו ' + state.unread; };

  root.appendChild(bannerSlot);
  root.appendChild(h('div', { class: 'adm-toolbar' },
    h('label', { class: 'adm-check' }, unreadToggle, 'רק שלא נקראו'),
    chips,
    h('span', { class: 'adm-spacer' }),
    countLbl,
    exportBtn,
    h('button', { class: 'adm-btn small', type: 'button', text: 'רענן', onclick: () => load() }),
  ));
  root.appendChild(list);
  root.appendChild(pager);
  unreadToggle.addEventListener('change', () => { state.unreadOnly = unreadToggle.checked; state.offset = 0; load(); });

  const drawChips = (byRating) => {
    clear(chips);
    const br = byRating && typeof byRating === 'object' ? byRating : {};
    const all = [1, 2, 3, 4, 5].reduce((a, k) => a + n0(br[k]), 0);
    const chip = (r, label, count) => h('button', {
      class: 'adm-chip' + (state.rating === r ? ' on' : ''), type: 'button', testid: 'fb-rating-' + (r || 'all'),
      'aria-pressed': state.rating === r ? 'true' : 'false',
      onclick: () => { state.rating = r; state.offset = 0; load(); },
    }, label, h('span', { class: 'c', text: String(count) }));
    chips.appendChild(chip(null, 'הכול', all));
    for (const r of [5, 4, 3, 2, 1]) chips.appendChild(chip(r, h('bdi', { dir: 'ltr', text: r + '★' }), n0(br[r])));
  };

  const ctxSummary = (ctx, names) => {
    const c = ctx && typeof ctx === 'object' ? ctx : {};
    const parts = [];
    if (c.v) parts.push('v' + c.v);
    if (c.seasons) parts.push('עונה ' + c.seasons);
    else if (c.season) parts.push('עונה ' + c.season);
    if (c.age) parts.push('גיל ' + c.age);
    if (c.ovr) parts.push('OVR ' + c.ovr);
    if (c.gender) parts.push(c.gender === 'f' ? 'שחקנית' : c.gender === 'm' ? 'שחקן' : String(c.gender));
    if (c.mode === 'manager' || c.manager === true) parts.push('קריירת אימון');
    if (c.club) parts.push(/^[a-z0-9_]+$/.test(String(c.club)) ? names.club(c.club) : String(c.club));
    if (c.trigger) parts.push(c.trigger === 'season1' ? 'אחרי עונה 1' : c.trigger === 'retired' ? 'אחרי פרישה' : String(c.trigger));
    if (c.platform) parts.push(String(c.platform) + (c.standalone ? ' (מותקן)' : ''));
    return parts.join(' · ');
  };

  const row = (f, names, canDelete) => {
    const item = h('article', { class: 'adm-fb-item' + (f.is_read ? '' : ' unread'), testid: 'fb-row-' + f.id });
    const btn = h('button', { class: 'adm-btn small', type: 'button', testid: 'btn-mark-read-' + f.id });
    const sync = () => {
      item.className = 'adm-fb-item' + (f.is_read ? '' : ' unread');
      item.setAttribute('data-read', f.is_read ? '1' : '0');
      btn.textContent = f.is_read ? 'סמן כלא נקרא' : 'סמן כנקרא';
    };
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await api.markRead(f.id, !f.is_read);
        f.is_read = !f.is_read;
        sync();
        state.unread = Math.max(0, state.unread + (f.is_read ? -1 : 1));
        drawCount();
        if (onUnreadChange) onUnreadChange(f.is_read ? -1 : 1);
      } catch (e) {
        if (!(e instanceof AuthLostError)) toast(e instanceof SupaError && e.status === 0 ? 'אין חיבור לשרת' : 'השמירה נכשלה', { error: true });
      } finally {
        btn.disabled = false;
      }
    });
    sync();
    const del = canDelete ? armedButton({ class: 'adm-btn small danger', testid: 'btn-delete-' + f.id, 'aria-label': 'מחק משוב' }, {
      label: 'מחק',
      armedLabel: 'בטוח? לחץ שוב',
      action: async () => {
        try {
          const r = await api.deleteFeedback(f.id);
          if (!r || r.ok !== true) { toast('המחיקה נדחתה', { error: true }); return; }
          item.classList.add('removing');
          setTimeout(() => { item.remove(); if (!list.querySelector('.adm-fb-item')) load(); }, 220);
          state.total = Math.max(0, state.total - 1);
          if (!f.is_read) state.unread = Math.max(0, state.unread - 1);
          drawCount();
          toast('המשוב נמחק');
        } catch (e) {
          if (!(e instanceof AuthLostError)) toast('המחיקה נכשלה: ' + errText(e), { error: true });
        }
      },
    }) : null;
    const email = typeof f.email === 'string' ? f.email : '';
    const emailNode = email
      ? (EMAIL_RE.test(email) ? h('a', { href: 'mailto:' + encodeURIComponent(email), dir: 'ltr', text: email }) : h('bdi', { text: email }))
      : h('span', { text: 'ללא אימייל' });
    item.appendChild(h('div', { class: 'adm-row' },
      h('span', { class: 'stars', 'aria-label': n0(f.rating) + ' כוכבים', text: stars(f.rating) }),
      h('span', { class: 'adm-spacer' }),
      btn, del));
    item.appendChild(h('div', { class: 'msg', text: f.message ? String(f.message) : '(ללא טקסט)' }));
    item.appendChild(h('div', { class: 'meta' },
      h('bdi', { text: fmtDate(f.created_at) }),
      emailNode,
      h('span', { text: ctxSummary(f.context, names) || (f.app_version ? 'v' + f.app_version : '') }),
    ));
    return item;
  };

  const load = async () => {
    clear(list);
    list.appendChild(h('div', { class: 'adm-loading', text: 'טוען משובים...' }));
    try {
      const [res, names] = await Promise.all([
        api.getFeedbackV2({ limit: PAGE, offset: state.offset, unreadOnly: state.unreadOnly, rating: state.rating }),
        loadNames()]);
      if (!alive) return;
      const v21 = api.v21Status() === true;
      clear(bannerSlot);
      if (!v21) {
        state.rating = null;
        bannerSlot.appendChild(schemaBanner('בינתיים אפשר לקרוא משובים, לסמן כנקרא ולייצא ל-CSV.'));
      }
      chips.hidden = !v21;
      if (v21) drawChips(res && res.by_rating);
      const rows = (res && Array.isArray(res.rows)) ? res.rows : [];
      const total = n0(res && res.total);
      state.total = total;
      state.unread = n0(res && res.unread);
      drawCount();
      clear(list);
      if (!rows.length) {
        list.appendChild(h('div', { class: 'adm-empty', text: state.rating ? 'אין משובים עם ' + state.rating + '★' : state.unreadOnly ? 'אין משובים שלא נקראו 🎉' : 'עוד אין משובים' }));
      }
      rows.forEach((f) => list.appendChild(row(f, names, v21)));
      clear(pager);
      if (total > PAGE) {
        const page = Math.floor(state.offset / PAGE) + 1;
        const pages = Math.ceil(total / PAGE);
        pager.appendChild(h('button', { class: 'adm-btn small', type: 'button', text: 'הקודם', disabled: state.offset <= 0, onclick: () => { state.offset = Math.max(0, state.offset - PAGE); load(); } }));
        pager.appendChild(h('span', { class: 'adm-muted', text: 'עמוד ' + page + ' מתוך ' + pages }));
        pager.appendChild(h('button', { class: 'adm-btn small', type: 'button', text: 'הבא', disabled: state.offset + PAGE >= total, onclick: () => { state.offset += PAGE; load(); } }));
      }
    } catch (e) {
      if (alive) showError(list, e, load);
    }
  };
  load();
  return () => { alive = false; };
}

// ---------- #/players (v2.2: supabase/update-2.2.sql admin_players) ----------
export const PLATFORM_HE = { android: 'אנדרואיד', ios: 'אייפון / אייפד', desktop: 'מחשב', other: 'אחר' };
const STAGE_HE = {
  youth: ['נוער', 'נערות'], pro: ['מקצוען', 'מקצוענית'], free: ['שחקן חופשי', 'שחקנית חופשית'],
  manager: ['מאמן', 'מאמנת'], retired: ['פרש', 'פרשה'],
};
const WHY_HE = { start: 'התחלת קריירה', season: 'סוף עונה', retired: 'פרישה', manager: 'התחלת אימון', open: 'פתיחת המשחק' };
/** 'נוער' / 'מקצוענית' ... (unknown stages are shown as-is). */
export function stageHe(stage, gender) {
  const s = STAGE_HE[stage];
  return s ? s[gender === 'f' ? 1 : 0] : String(stage || '?');
}
/** 'עכשיו' / 'לפני 5 דק׳' / 'לפני 3 שע׳' / 'אתמול' / 'לפני 4 ימים' / 'לפני 2 שבועות' / '12.06.26' */
export function fmtAgo(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '–';
  const sec = Math.max(0, Math.round((now - t) / 1000));
  if (sec < 120) return 'עכשיו';
  const min = Math.floor(sec / 60);
  if (min < 60) return 'לפני ' + min + ' דק׳';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? 'לפני שעה' : 'לפני ' + hr + ' שע׳';
  const d = Math.floor(hr / 24);
  if (d === 1) return 'אתמול';
  if (d < 14) return 'לפני ' + d + ' ימים';
  if (d < 60) return 'לפני ' + Math.floor(d / 7) + ' שבועות';
  return fmtDate(iso).split(' · ')[0];
}
const fmtDay = (iso) => (iso ? fmtDate(iso).split(' · ')[0] : '–');
/** 2031 -> '2031/32' (the game's season label) */
const seasonLabel = (y) => (Number.isFinite(Number(y)) && Number(y) > 0 ? Number(y) + '/' + String((Number(y) + 1) % 100).padStart(2, '0') : '–');
const numOr = (v, d = '–') => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? d : String(Number(v)));

/** Club / role line of a career: the game's own label, except 'פרש' (shown as the stage already). */
function clubLabel(r, names) {
  if (r.stage === 'retired') {
    if (!r.club) return r.gender === 'f' ? 'סיימה את הקריירה' : 'סיים את הקריירה';
    return (r.club_he || names.club(r.club)) + ' (מועדון אחרון)';
  }
  return r.club_he || (r.club ? names.club(r.club) : 'ללא קבוצה');
}
/** League line for the players tab: Hebrew name only; top-5 leagues get a word, not an unexplained star. */
function leagueLabel(r, names) {
  if (!r.league) return '';
  return names.leagueHe(r.league) + (names.isTop5(r.league) ? ' · ליגת טופ' : '');
}
const OVR_TIP = 'OVR = הדירוג הכללי של השחקן במשחק (0–99)';
const ovrLabel = (r) => (r.stage === 'manager' ? 'OVR כשחקן' : 'OVR');
/** Display name: the character name chosen in the game ('ללא שם' when empty). */
function playerName(r) {
  const nm = String((r && r.name) || '').trim() || 'ללא שם';
  return nm;
}

const SORTS = [
  { id: 'last_seen', he: 'נראו לאחרונה' },
  { id: 'matches', he: 'הכי הרבה משחקים בקריירה' },
  { id: 'ovr', he: 'OVR הכי גבוה' },
];
// career path shown in the details panel (from the latest snapshot's stage); 'מאמן' only for coaching careers
const PATH = ['youth', 'pro', 'retired'];
const PATH_MGR = ['youth', 'pro', 'retired', 'manager'];

export function renderPlayers(root) {
  clear(root);
  const PAGE = 50;
  const state = { offset: 0, search: '', sort: 'last_seen', total: 0, open: '' };
  let alive = true;
  let seq = 0;
  let debounce = null;
  const bannerSlot = h('div');
  const search = h('input', { class: 'adm-input adm-search', type: 'search', testid: 'players-search', placeholder: 'חיפוש לפי שם השחקן או הכינוי', 'aria-label': 'חיפוש לפי שם', autocomplete: 'off', maxlength: '60', enterkeyhint: 'search' });
  const countLbl = h('span', { class: 'adm-muted', testid: 'players-count', 'aria-live': 'polite' });
  const chips = h('div', { class: 'adm-chips', role: 'group', 'aria-label': 'מיון', testid: 'players-sort' });
  const list = h('div', { class: 'adm-pl', testid: 'players-list' }, h('div', { class: 'adm-loading', text: 'טוען שחקנים...' }));
  const pager = h('div', { class: 'adm-pager', testid: 'players-pager' });

  const drawChips = () => {
    clear(chips);
    for (const s of SORTS) {
      chips.appendChild(h('button', {
        class: 'adm-chip' + (state.sort === s.id ? ' on' : ''), type: 'button', testid: 'players-sort-' + s.id,
        'aria-pressed': state.sort === s.id ? 'true' : 'false', text: s.he,
        onclick: () => { if (state.sort === s.id) return; state.sort = s.id; state.offset = 0; drawChips(); load(); },
      }));
    }
  };
  drawChips();
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { const v = search.value.trim(); if (v === state.search) return; state.search = v; state.offset = 0; load(); }, 300);
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); clearTimeout(debounce); state.search = search.value.trim(); state.offset = 0; load(); }
  });

  root.appendChild(bannerSlot);
  root.appendChild(h('div', { class: 'adm-toolbar adm-pl-toolbar' },
    h('label', { class: 'adm-pl-searchwrap' }, h('span', { class: 'ic', 'aria-hidden': 'true', text: '⌕' }), search),
    chips,
    h('span', { class: 'adm-spacer' }),
    countLbl,
    h('button', { class: 'adm-btn small', type: 'button', text: 'רענן', onclick: () => load() }),
  ));
  root.appendChild(h('p', { class: 'adm-note adm-pl-note', testid: 'players-note' },
    'כל שורה היא קריירה אחת (באותו מכשיר יכולות להיות כמה). השם הוא השם שהשחקן כתב לדמות במשחק. "משחקים" = משחקים ששיחק בקריירה הזו. מופיעים רק מי ששיחקו בגרסה 2.2 ומעלה והשאירו את שיתוף הנתונים דלוק. לחץ על שורה לפרטים.'));
  root.appendChild(h('div', { class: 'adm-pl-head', 'aria-hidden': 'true' },
    h('span', { text: 'שחקן' }), h('span', { text: 'מועדון וליגה' }), h('span', { text: 'לאום' }), h('span', { class: 'c', title: OVR_TIP, text: 'OVR' }),
    h('span', { class: 'c', text: 'גיל' }), h('span', { text: 'שלב' }), h('span', { class: 'c', title: 'משחקים ששיחק בקריירה הזו', text: 'משחקים' }), h('span', { class: 'c', text: 'עונות' }),
    h('span', { text: 'מכשיר' }), h('span', { text: 'נראה לראשונה' }), h('span', { text: 'נראה לאחרונה' })));
  root.appendChild(list);
  root.appendChild(pager);

  const crestNode = (r, names, size) => {
    const url = r.club ? names.crest(r.club, size * 2) : '';
    if (url) return h('img', { class: 'adm-crest', src: url, alt: '', width: String(size), height: String(size), loading: 'lazy', decoding: 'async' });
    const ch = (playerName(r).trim()[0] || '?');
    return h('span', { class: 'adm-crest mono' + (r.gender === 'f' ? ' f' : ''), style: 'width:' + size + 'px;height:' + size + 'px', 'aria-hidden': 'true', text: ch });
  };

  const details = (r, names) => {
    const f = r.gender === 'f';
    const kv = (k, v, testid) => h('div', { class: 'kv' }, h('dt', { text: k }), h('dd', { testid: testid || null, text: v }));
    const steps = r.stage === 'manager' ? PATH_MGR : PATH;
    const idx = steps.indexOf(r.stage === 'free' ? 'pro' : r.stage);
    const path = h('ol', { class: 'adm-path', 'aria-label': 'מסלול הקריירה' },
      steps.map((st, i) => h('li', { class: i < idx ? 'done' : i === idx ? 'now' : '' },
        h('span', { class: 'b', 'aria-hidden': 'true' }), stageHe(st, r.gender))));
    const nick = r.nick ? ' «' + r.nick + '»' : '';
    return h('div', { class: 'adm-pl-details', testid: 'player-details' },
      h('div', { class: 'adm-pl-dhead' },
        crestNode(r, names, 48),
        h('div', {},
          h('div', { class: 'nm', text: playerName(r) + nick }),
          h('div', { class: 'adm-muted', text: (f ? 'שחקנית' : 'שחקן') + ' · ' + (r.pos ? names.pos(r.pos) : '') + (r.nation ? ' · ' + names.nationHe(r.nation) : '') }))),
      path,
      h('dl', { class: 'adm-kvs' },
        kv(r.stage === 'manager' ? 'תפקיד' : 'מועדון', clubLabel(r, names)),
        kv('ליגה', r.league ? leagueLabel(r, names) : '–'),
        kv(ovrLabel(r) + ' (דירוג כללי, 0–99)', numOr(r.ovr)),
        kv('גיל במשחק', numOr(r.age)),
        kv('עונה במשחק', seasonLabel(r.season) + (r.seasons ? ' (עונה ' + r.seasons + ' בקריירה)' : '')),
        kv('משחקים בקריירה', numOr(r.apps) + (r.goals != null ? ' · שערים: ' + numOr(r.goals) : '')),
        kv('משחקים ששוחקו במכשיר (כל הקריירות)', numOr(r.matches, '0')),
        kv('מכשיר', (PLATFORM_HE[r.platform] || r.platform || 'לא ידוע') + (r.standalone ? ' · מותקן למסך הבית' : '') + (r.app_version ? ' · v' + r.app_version : '')),
        kv('נראה לראשונה', r.first_seen ? fmtDate(r.first_seen) : '–'),
        kv('נראה לאחרונה', r.last_seen ? fmtDate(r.last_seen) + ' (' + fmtAgo(r.last_seen) + ')' : '–'),
        kv('עדכון אחרון של הנתונים', (r.snapshot_at ? fmtDate(r.snapshot_at) : '–') + (r.why ? ' · ' + (WHY_HE[r.why] || r.why) : ''))),
      h('div', { class: 'adm-muted adm-pl-id' },
        'מזהה מכשיר: ', h('bdi', { dir: 'ltr', text: String(r.device_id || '').slice(0, 8) + '…' }),
        ' · מזהה קריירה: ', h('bdi', { dir: 'ltr', text: String(r.career_id || '') })));
  };

  const row = (r, names, i) => {
    const key = String(r.device_id) + '|' + String(r.career_id);
    const f = r.gender === 'f';
    const btn = h('button', { class: 'adm-pl-row', type: 'button', testid: 'player-row-' + (state.offset + i), 'aria-expanded': 'false', 'data-key': key },
      h('span', { class: 'pl-who' },
        crestNode(r, names, 34),
        h('span', { class: 'pl-names' },
          h('span', { class: 'pl-name', testid: 'player-name', title: playerName(r) + (r.nick ? ' «' + r.nick + '»' : ''), text: playerName(r) }),
          h('span', { class: 'pl-sub' },
            h('span', { class: 'adm-g ' + (f ? 'f' : 'm'), text: f ? 'בת' : 'בן' }),
            r.nick ? h('span', { class: 'pl-nick', text: '«' + r.nick + '»' }) : null,
            r.pos ? h('span', { class: 'pl-pos', dir: 'ltr', text: r.pos }) : null))),
      h('span', { class: 'pl-club' },
        h('span', { class: 'c1', title: clubLabel(r, names), text: clubLabel(r, names) }),
        h('span', { class: 'c2', title: leagueLabel(r, names), text: leagueLabel(r, names) })),
      h('span', { class: 'pl-nat', text: r.nation ? names.nationHe(r.nation) : '–' }),
      h('span', { class: 'pl-ovr' + (r.stage === 'manager' ? ' was' : ''), 'data-label': 'OVR', title: r.stage === 'manager' ? 'OVR כשחקן (לפני שהפך למאמן)' : OVR_TIP, text: numOr(r.ovr) }),
      h('span', { class: 'pl-num pl-age', 'data-label': 'גיל', text: numOr(r.age) }),
      h('span', { class: 'pl-stage' }, h('span', { class: 'adm-stage s-' + String(r.stage || 'x').replace(/[^a-z]/g, ''), text: stageHe(r.stage, r.gender) })),
      h('span', { class: 'pl-num pl-matches', 'data-label': 'משחקים', title: 'משחקים ששיחק בקריירה הזו', text: numOr(r.apps, '0') }),
      h('span', { class: 'pl-num pl-seasons', 'data-label': 'עונות', text: numOr(r.seasons) }),
      h('span', { class: 'pl-plat', text: PLATFORM_HE[r.platform] || r.platform || '–' }),
      h('span', { class: 'pl-first', 'data-label': 'מאז', text: fmtDay(r.first_seen) }),
      h('span', { class: 'pl-last', testid: 'player-last-seen', 'data-label': 'נראה לאחרונה:', title: r.last_seen ? 'נראה לאחרונה: ' + fmtDate(r.last_seen) : '', text: fmtAgo(r.last_seen) }));
    const wrap = h('article', { class: 'adm-pl-item', testid: 'player-item' }, btn);
    let panel = null;
    const toggle = (open) => {
      if (open && !panel) { panel = details(r, names); wrap.appendChild(panel); }
      if (panel) panel.hidden = !open;
      wrap.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      state.open = open ? key : (state.open === key ? '' : state.open);
    };
    btn.addEventListener('click', () => toggle(btn.getAttribute('aria-expanded') !== 'true'));
    if (state.open === key) toggle(true);
    return wrap;
  };

  const load = async () => {
    const my = ++seq;
    clear(list);
    list.appendChild(h('div', { class: 'adm-loading', text: 'טוען שחקנים...' }));
    try {
      const [res, names] = await Promise.all([
        api.getPlayers({ limit: PAGE, offset: state.offset, search: state.search, sort: state.sort }),
        loadNames()]);
      if (!alive || my !== seq) return;
      clear(bannerSlot);
      clear(list);
      clear(pager);
      if (res === null) {
        bannerSlot.appendChild(schemaBanner22('לשונית השחקנים תתמלא אחרי ההרצה. השחקנים שכבר שיחקו בגרסה 2.2 יופיעו מיד (הנתונים כבר נשמרים בשרת).'));
        countLbl.textContent = '';
        list.appendChild(h('div', { class: 'adm-empty', text: 'הרשימה תופיע אחרי הרצת update-2.2.sql.' }));
        return;
      }
      const rows = Array.isArray(res.rows) ? res.rows : [];
      state.total = n0(res.total);
      const range = state.total > PAGE && rows.length ? 'מציג ' + (state.offset + 1) + '–' + (state.offset + rows.length) + ' מתוך ' : '';
      countLbl.textContent = state.search
        ? (range ? range + state.total + ' תוצאות' : state.total === 1 ? 'תוצאה אחת' : state.total + ' תוצאות')
        : (range ? range + state.total + ' קריירות' : 'סה"כ ' + state.total + ' קריירות');
      if (!rows.length) {
        list.appendChild(h('div', { class: 'adm-empty', testid: 'players-empty',
          text: state.search ? 'לא נמצא שחקן בשם "' + state.search + '"' : 'עוד אין שחקנים ברשימה. הם יופיעו כשיפתחו את המשחק בגרסה 2.2.' }));
      }
      rows.forEach((r, i) => list.appendChild(row(r, names, i)));
      if (state.total > PAGE) {
        const page = Math.floor(state.offset / PAGE) + 1;
        const pages = Math.ceil(state.total / PAGE);
        const go = (off) => { state.offset = off; load(); try { root.scrollIntoView({ block: 'start' }); } catch { /* ignore */ } };
        pager.appendChild(h('button', { class: 'adm-btn small', type: 'button', testid: 'players-prev', text: 'הקודם', disabled: state.offset <= 0, onclick: () => go(Math.max(0, state.offset - PAGE)) }));
        pager.appendChild(h('span', { class: 'adm-muted', testid: 'players-page', text: 'עמוד ' + page + ' מתוך ' + pages }));
        pager.appendChild(h('button', { class: 'adm-btn small', type: 'button', testid: 'players-next', text: 'הבא', disabled: state.offset + PAGE >= state.total, onclick: () => go(state.offset + PAGE) }));
      }
    } catch (e) {
      if (alive && my === seq) showError(list, e, load);
    }
  };
  load();
  return () => { alive = false; clearTimeout(debounce); };
}

// ---------- #/tools ----------
const RESET_WORD = 'איפוס';

export function renderTools(root) {
  clear(root);
  let alive = true;
  const body = h('div', {}, h('div', { class: 'adm-loading', text: 'טוען...' }));
  root.appendChild(body);

  const load = async () => {
    try {
      const [s, v21, v22, v23] = await Promise.all([api.getStats(1), api.probeV21(), api.probeV22(), api.probeV23()]);
      if (!alive) return;
      draw(s || {}, v21, v22, v23);
    } catch (e) {
      if (alive) showError(body, e, load);
    }
  };

  const draw = (s, v21, v22, v23) => {
    clear(body);
    if (v21 === false) body.appendChild(schemaBanner('ייצוא CSV עובד גם בלי העדכון. איפוס הנתונים דורש את העדכון.'));
    else if (v22 === false) body.appendChild(schemaBanner22('הכלים בלשונית הזו עובדים גם בלי העדכון. הוא נדרש רק לנתוני 2.2 בלוח.'));
    else if (v23 === false) body.appendChild(schemaBanner23('הכלים בלשונית הזו עובדים גם בלי העדכון. הוא נדרש למשפך ולטבלת המובילים.'));

    const status = h('div', { class: 'adm-card', testid: 'tools-schema' },
      h('h3', { text: 'מצב השרת' }),
      h('p', { class: v21 ? 'adm-result' : 'adm-warn', testid: 'tools-schema-status',
        text: v21 ? 'update-2.1.sql מותקן ✓ (כל הכלים פעילים)' : v21 === false ? 'update-2.1.sql עוד לא הורץ' : 'לא ידוע (אין חיבור לשרת)' }),
      h('p', { class: v22 ? 'adm-result' : 'adm-warn', testid: 'tools-schema-status-22',
        text: v22 ? 'update-2.2.sql מותקן ✓ (נתוני האימונים, השיחות עם המאמן ולשונית השחקנים)' : v22 === false ? 'update-2.2.sql עוד לא הורץ' : 'update-2.2.sql: לא ידוע (אין חיבור לשרת)' }),
      h('p', { class: v23 ? 'adm-result' : 'adm-warn', testid: 'tools-schema-status-23',
        text: v23 ? 'update-2.3.sql מותקן ✓ (המשפך, החזרה למשחק וטבלת המובילים)' : v23 === false ? 'update-2.3.sql עוד לא הורץ' : 'update-2.3.sql: לא ידוע (אין חיבור לשרת)' }),
      h('p', { class: 'adm-muted', style: 'font-size:13px;margin:0', text: 'גרסת המשחק בקוד: ' + APP_VERSION }));

    const exportBtn = h('button', { class: 'adm-btn primary', type: 'button', testid: 'btn-tools-export-csv', text: '⬇ ייצוא כל המשובים ל-CSV' });
    exportBtn.addEventListener('click', () => exportFeedbackCsv(exportBtn, {}));
    const exportCard = h('div', { class: 'adm-card adm-form' },
      h('h3', { text: 'ייצוא משובים' }),
      h('p', { class: 'adm-muted', style: 'margin:0;font-size:13px', text: 'קובץ CSV שנפתח ב-Excel וב-Google Sheets (עברית תקינה). כולל דירוג, טקסט, אימייל, גרסה והקשר. ' + n0(s.feedback_total) + ' משובים כרגע.' }),
      h('div', { class: 'adm-row' }, exportBtn));

    // danger zone: reset all statistics (open -> type the word -> red button twice)
    const result = h('p', { class: 'adm-result', testid: 'reset-result', hidden: true });
    const input = h('input', { class: 'adm-input', type: 'text', testid: 'reset-confirm-input', placeholder: RESET_WORD, autocomplete: 'off', 'aria-label': 'הקלד ' + RESET_WORD + ' לאישור' });
    const FINAL_LABEL = 'מחק את כל הנתונים';
    const finalBtn = h('button', { class: 'adm-btn danger solid', type: 'button', testid: 'btn-reset-confirm', text: FINAL_LABEL, disabled: true });
    const cancelBtn = h('button', { class: 'adm-btn', type: 'button', testid: 'btn-reset-cancel', text: 'ביטול' });
    const panel = h('div', { class: 'adm-confirm', testid: 'reset-panel', hidden: true },
      h('strong', { text: 'כדי להמשיך, הקלד את המילה "' + RESET_WORD + '"' }),
      input,
      h('div', { class: 'adm-row' }, finalBtn, cancelBtn),
      h('div', { class: 'adm-muted', style: 'font-size:12px', text: 'אחרי ההקלדה צריך ללחוץ על הכפתור האדום פעמיים (אישור כפול).' }));
    const openBtn = h('button', { class: 'adm-btn danger', type: 'button', testid: 'btn-reset-open', text: 'איפוס כל הסטטיסטיקה...', disabled: !v21 });

    let armed = false;
    let armTimer = null;
    const disarm = () => { armed = false; clearTimeout(armTimer); finalBtn.classList.remove('armed'); finalBtn.textContent = FINAL_LABEL; finalBtn.removeAttribute('data-armed'); };
    const close = () => { panel.hidden = true; input.value = ''; finalBtn.disabled = true; disarm(); openBtn.hidden = false; };
    openBtn.addEventListener('click', () => { panel.hidden = false; openBtn.hidden = true; result.hidden = true; setTimeout(() => { try { input.focus(); } catch { /* ignore */ } }, 0); });
    cancelBtn.addEventListener('click', close);
    input.addEventListener('input', () => { finalBtn.disabled = input.value.trim() !== RESET_WORD; if (finalBtn.disabled) disarm(); });
    finalBtn.addEventListener('click', async () => {
      if (input.value.trim() !== RESET_WORD) return;
      if (!armed) {
        armed = true;
        finalBtn.classList.add('armed');
        finalBtn.textContent = 'לחיצה אחרונה: למחוק הכול לצמיתות';
        finalBtn.setAttribute('data-armed', '1');
        armTimer = setTimeout(disarm, 6000);
        return;
      }
      clearTimeout(armTimer);
      finalBtn.disabled = true;
      cancelBtn.disabled = true;
      try {
        const r = await api.resetStats('RESET');
        if (!r || r.ok !== true) { toast('האיפוס נדחה: ' + ((r && r.error) || 'שגיאה'), { error: true }); return; }
        const d = r.deleted || {};
        close();
        result.textContent = 'בוצע ✓ נמחקו ' + n0(d.devices) + ' מכשירים, ' + n0(d.sessions) + ' כניסות, ' + n0(d.events) + ' אירועים ו-' + n0(d.feedback) + ' משובים.';
        result.hidden = false;
        toast('כל הסטטיסטיקה אופסה');
      } catch (e) {
        if (!(e instanceof AuthLostError)) toast('האיפוס נכשל: ' + errText(e), { error: true });
      } finally {
        cancelBtn.disabled = false;
        finalBtn.disabled = input.value.trim() !== RESET_WORD;
        disarm();
      }
    });

    const danger = h('section', { class: 'adm-card adm-danger', testid: 'tools-danger' },
      h('h3', { text: 'אזור מסוכן: איפוס כל הסטטיסטיקה' }),
      h('p', { style: 'margin:0;font-size:14px', text: 'מוחק לצמיתות את כל נתוני השימוש של המשחק, למשל כדי להתחיל לספור מחדש אחרי בדיקות. אי אפשר לבטל.' }),
      h('ul', {},
        h('li', { text: 'יימחקו: ' + n0(s.total_devices) + ' מכשירים, כל הכניסות, כל האירועים ו-' + n0(s.feedback_total) + ' משובים.' }),
        h('li', { text: 'יישארו: הגדרות הפרסומות, ההודעה לשחקנים, הגדרות הגרסה והמשוב, ורשימת המנהלים.' }),
        h('li', {}, 'נמחקות רק 4 הטבלאות של המשחק: ', h('bdi', { dir: 'ltr', text: 'devices, sessions, events, feedback' }), '. שום דבר אחר בפרויקט לא נפגע.'),
        h('li', { text: 'הקריירות של השחקנים שמורות במכשירים שלהם ולא נפגעות.' }),
        h('li', { text: 'טבלת המובילים (2.3) לא נמחקת. שורות לא רצויות מסתירים בלשונית "טבלה".' })),
      h('div', { class: 'adm-row' }, openBtn),
      panel, result);

    body.appendChild(h('div', { class: 'adm-section-title', text: 'כלים' }));
    body.appendChild(h('div', { class: 'adm-cols' }, exportCard, status));
    body.appendChild(h('div', { class: 'adm-section-title', text: 'מחיקה' }));
    body.appendChild(danger);
  };

  load();
  return () => { alive = false; };
}

// ---------- #/config ----------
const PROVIDERS = [['none', 'כבוי (none)'], ['house', 'באנרים של ספונסרים (house)'], ['adsense', 'Google AdSense']];
const PLACEMENT_KEYS = [['hub_banner', 'באנר במסך הבית'], ['interstitial', 'מסך מלא בין מחזורים'], ['rewarded', 'פרסומת עם פרס']];
const VERSION_RE = /^\d+(\.\d+){0,2}$/;

function field(label, input, hint) {
  return h('label', { class: 'adm-field' }, h('span', { text: label }), input, hint ? h('small', { class: 'adm-muted', text: hint }) : null);
}
function checkbox(label, checked, onchange, testid) {
  const inp = h('input', { type: 'checkbox', checked, testid: testid || null });
  inp.addEventListener('change', () => onchange(inp.checked));
  return h('label', { class: 'adm-check' }, inp, label);
}
function textInput(value, oninput, { testid, dir, type = 'text', placeholder, min, max } = {}) {
  const inp = h('input', {
    class: 'adm-input', type, value: value == null ? '' : String(value), testid: testid || null, dir: dir || null,
    placeholder: placeholder || null, min: min == null ? null : String(min), max: max == null ? null : String(max),
  });
  inp.addEventListener('input', () => oninput(inp.value));
  return inp;
}
function numInput(value, oninput, opts = {}) {
  return textInput(value, (v) => oninput(v === '' ? 0 : Number(v)), { ...opts, type: 'number', dir: 'ltr' });
}

function rawView(getValue) {
  const pre = h('pre');
  const det = h('details', { class: 'adm-raw' }, h('summary', { text: 'JSON גולמי' }), pre);
  const refresh = () => { pre.textContent = JSON.stringify(getValue(), null, 2); };
  refresh();
  return { el: det, refresh };
}

function configBlock(title, key, value, buildBody, { saveTestid, validate } = {}) {
  const card = h('section', { class: 'adm-card adm-form', 'data-block': key }, h('h3', { text: title }));
  const raw = rawView(() => value);
  const changed = () => raw.refresh();
  card.appendChild(buildBody(value, changed));
  const saveBtn = h('button', { class: 'adm-btn primary', type: 'button', testid: saveTestid, text: 'שמור' });
  saveBtn.addEventListener('click', async () => {
    const problem = validate ? validate(value) : '';
    if (problem) { toast(problem, { error: true }); return; }
    saveBtn.disabled = true;
    try {
      const res = await api.setConfig(key, JSON.parse(JSON.stringify(value)));
      if (res && res.ok) toast('נשמר ✓');
      else toast('השמירה נדחתה: ' + ((res && res.error) || 'שגיאה'), { error: true });
    } catch (e) {
      if (!(e instanceof AuthLostError)) toast(e instanceof SupaError && e.status === 0 ? 'אין חיבור לשרת' : 'השמירה נכשלה: ' + ((e && e.message) || e), { error: true });
    } finally {
      saveBtn.disabled = false;
      raw.refresh();
    }
  });
  card.appendChild(h('div', { class: 'adm-row' }, saveBtn));
  card.appendChild(raw.el);
  return card;
}

function houseProblems(it) {
  const problems = [];
  if (!safeUrl(it.link)) problems.push('קישור חייב להתחיל ב-https:// (או ./)');
  if (it.imageUrl && !safeUrl(it.imageUrl)) problems.push('כתובת תמונה חייבת להתחיל ב-https:// (או ./)');
  if (!it.imageUrl && !it.textHe) problems.push('צריך תמונה או טקסט');
  return problems;
}

function houseEditor(ads, changed) {
  const wrap = h('div', { class: 'adm-form' });
  const listEl = h('div', { class: 'adm-form' });
  const draw = () => {
    clear(listEl);
    if (!ads.house.length) listEl.appendChild(h('div', { class: 'adm-empty', text: 'אין באנרים. לחץ "הוסף באנר".' }));
    ads.house.forEach((it, i) => {
      if (!Array.isArray(it.placements)) it.placements = PLACEMENT_KEYS.map((p) => p[0]);
      const box = h('div', { class: 'adm-house', testid: 'cfg-house-row-' + i });
      const warn = h('div', { class: 'adm-warn' });
      const preview = h('img', { class: 'preview', alt: '' });
      preview.hidden = true;
      preview.onerror = () => { preview.hidden = true; };
      // The preview loads only after typing pauses, so half-typed URLs are never requested (no 404 noise).
      let previewTimer = null;
      const showPreview = () => {
        const src = safeUrl(it.imageUrl);
        if (src) {
          if (preview.getAttribute('src') !== src) preview.src = src;
          preview.hidden = false;
        } else { preview.removeAttribute('src'); preview.hidden = true; }
      };
      const check = (immediate) => {
        const problems = houseProblems(it);
        warn.textContent = problems.join(' · ');
        box.className = 'adm-house' + (problems.length ? ' invalid' : '');
        clearTimeout(previewTimer);
        if (immediate === true) showPreview(); else previewTimer = setTimeout(showPreview, 700);
      };
      const upd = (k, v) => { it[k] = v; check(); changed(); };
      box.appendChild(h('div', { class: 'adm-row' },
        h('strong', { text: 'באנר ' + (i + 1) }), h('span', { class: 'adm-spacer' }), preview,
        h('button', { class: 'adm-btn small danger', type: 'button', testid: 'cfg-house-remove-' + i, text: 'הסר', onclick: () => { ads.house.splice(i, 1); draw(); changed(); } })));
      box.appendChild(h('div', { class: 'adm-inline' },
        field('מזהה (id)', textInput(it.id, (v) => upd('id', v.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)), { dir: 'ltr', testid: 'cfg-house-' + i + '-id' })),
        field('משקל (סיכוי יחסי)', numInput(it.weight == null ? 1 : it.weight, (v) => upd('weight', Math.max(0, Math.min(100, Math.round(v || 0)))), { testid: 'cfg-house-' + i + '-weight', min: 0, max: 100 })),
      ));
      box.appendChild(field('כתובת תמונה (https:// או ./icons/...)', textInput(it.imageUrl, (v) => upd('imageUrl', v.trim()), { dir: 'ltr', testid: 'cfg-house-' + i + '-imageUrl', placeholder: 'https://...' })));
      box.appendChild(field('קישור בלחיצה (https://)', textInput(it.link, (v) => upd('link', v.trim()), { dir: 'ltr', testid: 'cfg-house-' + i + '-link', placeholder: 'https://...' })));
      box.appendChild(field('טקסט (עד 200 תווים)', textInput(it.textHe, (v) => upd('textHe', v.slice(0, 200)), { testid: 'cfg-house-' + i + '-textHe' })));
      box.appendChild(h('div', { class: 'adm-row' },
        PLACEMENT_KEYS.map(([pk, pl]) => checkbox(pl, it.placements.includes(pk), (on) => {
          it.placements = on ? Array.from(new Set([...it.placements, pk])) : it.placements.filter((x) => x !== pk);
          changed();
        }, 'cfg-house-' + i + '-pl-' + pk))));
      box.appendChild(warn);
      check(true);
      listEl.appendChild(box);
    });
  };
  draw();
  const add = h('button', { class: 'adm-btn', type: 'button', testid: 'cfg-house-add', text: '+ הוסף באנר' });
  add.addEventListener('click', () => {
    ads.house.push({ id: 'h' + Date.now().toString(36), imageUrl: '', link: '', textHe: '', weight: 1, placements: PLACEMENT_KEYS.map((p) => p[0]) });
    draw();
    changed();
  });
  wrap.appendChild(listEl);
  wrap.appendChild(add);
  return wrap;
}

export function renderConfig(root) {
  clear(root);
  let alive = true;
  const body = h('div', {}, h('div', { class: 'adm-loading', text: 'טוען הגדרות...' }));
  root.appendChild(body);

  const load = async () => {
    try {
      const server = await api.getConfig();
      if (!alive) return;
      const srv = server && typeof server === 'object' ? server : {};
      const cfg = {};
      for (const k of ['ads', 'announcement', 'version', 'feedback']) cfg[k] = deepMerge(REMOTE_DEFAULTS[k], srv[k]);
      if (!Array.isArray(cfg.ads.house)) cfg.ads.house = [];
      draw(cfg);
    } catch (e) {
      if (alive) showError(body, e, load);
    }
  };

  const draw = (cfg) => {
    clear(body);
    body.appendChild(h('p', { class: 'adm-note', text: 'שינוי נשמר בשרת ומגיע לשחקנים בפתיחה הבאה של המשחק (או בעדכון ברקע). אין צורך להעלות גרסה חדשה.' }));
    const cols = h('div', { class: 'adm-cols' });
    body.appendChild(cols);

    // ads
    cols.appendChild(configBlock('פרסומות', 'ads', cfg.ads, (ads, changed) => {
      const pl = ads.placements;
      const provSel = h('select', { class: 'adm-select', testid: 'cfg-ads-provider' },
        PROVIDERS.map(([v, l]) => h('option', { value: v, text: l })));
      provSel.value = ads.provider;
      const adsenseBox = h('fieldset', { class: 'adm-fieldset' },
        h('legend', { text: 'Google AdSense' }),
        h('p', { class: 'adm-note', text: 'AdSense דורש דומיין משלך (לא github.io), אישור אתר מגוגל, מדיניות פרטיות והסכמת משתמש. בלי הסכמה המשחק יציג באנרים של ספונסרים (אם יש) או כלום.' }),
        field('Publisher ID (ca-pub-...)', textInput(ads.adsense.client, (v) => { ads.adsense.client = v.trim(); changed(); }, { dir: 'ltr', testid: 'cfg-adsense-client', placeholder: 'ca-pub-0000000000000000' })),
        h('div', { class: 'adm-inline' },
          field('Slot: באנר בית', textInput(ads.adsense.slots.hub_banner, (v) => { ads.adsense.slots.hub_banner = v.replace(/\D/g, ''); changed(); }, { dir: 'ltr', testid: 'cfg-adsense-slot-hub' })),
          field('Slot: מסך מלא', textInput(ads.adsense.slots.interstitial, (v) => { ads.adsense.slots.interstitial = v.replace(/\D/g, ''); changed(); }, { dir: 'ltr', testid: 'cfg-adsense-slot-inter' })),
        ));
      const showAdsense = () => { adsenseBox.hidden = ads.provider !== 'adsense'; };
      provSel.addEventListener('change', () => { ads.provider = provSel.value; showAdsense(); changed(); });
      showAdsense();
      return h('div', { class: 'adm-form' },
        checkbox('פרסומות פעילות', ads.enabled, (on) => { ads.enabled = on; changed(); }, 'cfg-ads-enabled'),
        field('ספק', provSel, 'כדי להתחיל מיד: "באנרים של ספונסרים" + הוסף באנר + סמן "פרסומות פעילות" + שמור.'),
        h('fieldset', { class: 'adm-fieldset' }, h('legend', { text: 'מיקומים ותדירות' }),
          checkbox('באנר במסך הבית', pl.hub_banner.enabled, (on) => { pl.hub_banner.enabled = on; changed(); }, 'cfg-pl-hub'),
          checkbox('מסך מלא בין מחזורים (אף פעם לא באמצע משחק)', pl.interstitial.enabled, (on) => { pl.interstitial.enabled = on; changed(); }, 'cfg-pl-inter'),
          h('div', { class: 'adm-inline' },
            field('כל כמה מחזורים (1-50)', numInput(pl.interstitial.everyMatchdays, (v) => { pl.interstitial.everyMatchdays = v; changed(); }, { min: 1, max: 50 })),
            field('מינימום דקות בין פרסומות', numInput(pl.interstitial.minMinutesBetween, (v) => { pl.interstitial.minMinutesBetween = v; changed(); }, { min: 0, max: 120 })),
            field('בלי פרסומות בדקות הראשונות', numInput(pl.interstitial.skipFirstMinutes, (v) => { pl.interstitial.skipFirstMinutes = v; changed(); }, { min: 0, max: 120 })),
          ),
          checkbox('פרסומת עם פרס ("צפה וקבל +15 אנרגיה")', pl.rewarded.enabled, (on) => { pl.rewarded.enabled = on; changed(); }, 'cfg-pl-rewarded'),
          h('div', { class: 'adm-inline' },
            field('מקסימום ביום (0-10)', numInput(pl.rewarded.maxPerDay, (v) => { pl.rewarded.maxPerDay = v; changed(); }, { min: 0, max: 10 })),
          ),
        ),
        h('fieldset', { class: 'adm-fieldset' }, h('legend', { text: 'באנרים של ספונסרים (house)' }), houseEditor(ads, changed)),
        adsenseBox,
      );
    }, {
      saveTestid: 'btn-save-ads',
      validate: (ads) => {
        for (const it of ads.house) {
          if (houseProblems(it).length) return 'יש באנר עם קישור או תמונה לא תקינים (מסומן באדום)';
        }
        if (ads.enabled && ads.provider === 'adsense' && !ads.adsense.client) return 'חסר Publisher ID של AdSense';
        return '';
      },
    }));

    // announcement
    cols.appendChild(configBlock('הודעה לכל השחקנים', 'announcement', cfg.announcement, (ann, changed) => {
      const idLbl = h('code', { dir: 'ltr', text: ann.id || '-' });
      const text = h('textarea', { class: 'adm-textarea', testid: 'cfg-ann-text', maxlength: '200' });
      text.value = ann.textHe || '';
      text.addEventListener('input', () => {
        ann.textHe = text.value.slice(0, 200);
        ann.id = 'a' + Date.now().toString(36);   // a new id makes the banner reappear for players who dismissed the old one
        idLbl.textContent = ann.id;
        changed();
      });
      const level = h('select', { class: 'adm-select', testid: 'cfg-ann-level' }, h('option', { value: 'info', text: 'מידע' }), h('option', { value: 'warn', text: 'אזהרה' }));
      level.value = ann.level === 'warn' ? 'warn' : 'info';
      level.addEventListener('change', () => { ann.level = level.value; changed(); });
      return h('div', { class: 'adm-form' },
        checkbox('הצג הודעה', ann.enabled, (on) => { ann.enabled = on; changed(); }, 'cfg-ann-enabled'),
        field('טקסט ההודעה (עד 200 תווים)', text),
        field('קישור (לא חובה, https://)', textInput(ann.link, (v) => { ann.link = v.trim(); changed(); }, { dir: 'ltr', testid: 'cfg-ann-link', placeholder: 'https://...' })),
        field('סוג', level),
        h('div', { class: 'adm-muted' }, 'מזהה ההודעה: ', idLbl),
      );
    }, {
      saveTestid: 'btn-save-announcement',
      validate: (ann) => (ann.link && !safeUrl(ann.link) ? 'הקישור חייב להתחיל ב-https://' : (ann.enabled && !ann.textHe ? 'חסר טקסט להודעה' : '')),
    }));

    // version
    cols.appendChild(configBlock('גרסאות ועדכונים', 'version', cfg.version, (ver, changed) => h('div', { class: 'adm-form' },
      h('p', { class: 'adm-note', text: 'הגרסה שמוגדרת כרגע בקוד: ' + APP_VERSION + '. "גרסה מינימלית" מציגה באנר עדכון קבוע לשחקנים עם גרסה ישנה יותר; "גרסה אחרונה" מציגה הודעה שאפשר לסגור.' }),
      h('div', { class: 'adm-inline' },
        field('גרסה מינימלית', textInput(ver.min, (v) => { ver.min = v.trim(); changed(); }, { dir: 'ltr', testid: 'cfg-ver-min', placeholder: '0.0.0' })),
        field('גרסה אחרונה', textInput(ver.latest, (v) => { ver.latest = v.trim(); changed(); }, { dir: 'ltr', testid: 'cfg-ver-latest', placeholder: '1.0.0' })),
      ),
      field('הודעת עדכון', textInput(ver.messageHe, (v) => { ver.messageHe = v.slice(0, 200); changed(); }, { testid: 'cfg-ver-msg' })),
    ), {
      saveTestid: 'btn-save-version',
      validate: (ver) => (VERSION_RE.test(ver.min) && VERSION_RE.test(ver.latest) ? '' : 'גרסה צריכה להיות בפורמט 1.2.3'),
    }));

    // feedback
    cols.appendChild(configBlock('משוב', 'feedback', cfg.feedback, (fb, changed) => h('div', { class: 'adm-form' },
      checkbox('אפשר לשלוח משוב', fb.enabled, (on) => { fb.enabled = on; changed(); }, 'cfg-fb-enabled'),
      checkbox('הצע לדרג אחרי עונה ראשונה ואחרי פרישה (לכל היותר פעם ב-30 יום)', fb.prompt, (on) => { fb.prompt = on; changed(); }, 'cfg-fb-prompt'),
    ), { saveTestid: 'btn-save-feedback' }));
  };

  load();
  return () => { alive = false; };
}
