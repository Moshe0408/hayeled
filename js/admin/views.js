// js/admin/views.js - admin dashboard renderers (SPEC §8.7).
// SECURITY: feedback/context/house-ad data comes from anonymous players or the network.
// Everything is rendered with textContent / value / setAttribute (never as HTML markup).
import { APP_VERSION } from '../config.js';
import { REMOTE_DEFAULTS, deepMerge, safeUrl } from '../core/remote.js';
import { SupaError } from '../core/supa.js';
import * as api from './api.js';
import { AuthLostError } from './api.js';
import { lineChart, columnChart, rankList } from './charts.js';

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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
export function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso || '');
  return dtFmt ? dtFmt.format(d) : d.toISOString().slice(0, 16).replace('T', ' ');
}
export function fmtDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return hh ? hh + ':' + String(mm).padStart(2, '0') + ':' + ss : mm + ':' + ss;
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
      const out = { countries: {}, clubs: {}, positions: {} };
      try { const m = await import('../data/countries.js'); out.countries = m.COUNTRY_BY_ID || {}; } catch { /* optional */ }
      try { const m = await import('../data/leagues.js'); out.clubs = m.CLUB_INDEX || {}; } catch { /* optional */ }
      try { const m = await import('../data/strings.js'); out.positions = m.POSITIONS || {}; } catch { /* optional */ }
      return {
        nation(id) { const c = out.countries[id]; return c ? ((c.flag ? c.flag + ' ' : '') + c.nameHe) : String(id); },
        club(id) { const c = out.clubs[id]; return c && c.club ? c.club.nameHe : String(id); },
        pos(id) { const p = out.positions[id]; return p ? (p.he + ' (' + id + ')') : String(id); },
      };
    })();
  }
  return namesPromise;
}

// ---------- shared states ----------
export function renderMessage(root, { title, text, code, retry } = {}) {
  clear(root);
  root.appendChild(h('div', { class: 'adm-card adm-msg adm-center' },
    h('div', { class: 'adm-logo', text: 'הילד מהשכונה' }),
    title ? h('h2', { text: title }) : null,
    text ? h('p', { text }) : null,
    code ? h('p', {}, h('code', { text: code })) : null,
    retry ? h('button', { class: 'adm-btn primary', type: 'button', text: 'נסה שוב', onclick: retry }) : null,
  ));
}

/** Map an error to a friendly Hebrew message (or rethrow auth loss: the router handles it). */
function showError(root, e, retry) {
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

// ---------- header ----------
export function renderHeader(active, { onLogout } = {}) {
  const link = (id, hash, label) => h('a', { href: hash, testid: 'nav-' + id, class: active === id ? 'active' : '', 'aria-current': active === id ? 'page' : null, text: label });
  return h('header', { class: 'adm-header' },
    h('h1', { class: 'adm-title' }, 'ניהול · הילד מהשכונה', h('small', { text: api.currentEmail() + ' · גרסת משחק ' + APP_VERSION })),
    h('nav', { class: 'adm-nav' },
      link('dash', '#/dash', 'לוח'),
      link('feedback', '#/feedback', 'משובים'),
      link('config', '#/config', 'הגדרות ופרסומות'),
      h('button', { class: 'adm-btn danger', type: 'button', testid: 'btn-logout', text: 'התנתק', onclick: onLogout }),
    ),
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
    h('div', { class: 'adm-logo', text: 'הילד מהשכונה' }),
    h('p', { text: 'כניסת מנהל' }),
    form,
    h('p', { class: 'adm-muted', text: 'על מכשיר משותף, לחץ "התנתק" בסיום.' }),
  ));
  setTimeout(() => { try { email.focus(); } catch { /* ignore */ } }, 0);
}

// ---------- #/dash ----------
function kpi(testid, label, value, sub, { hero = false, dot = false } = {}) {
  return h('div', { class: 'adm-card adm-kpi' + (hero ? ' hero' : '') },
    h('div', { class: 'label' }, dot ? h('span', { class: 'dot', 'aria-hidden': 'true' }) : null, label),
    h('div', { class: 'value', testid: testid || null, 'data-value': String(value), text: String(value) }),
    sub ? h('div', { class: 'sub', text: sub }) : null,
  );
}

export function renderDash(root) {
  clear(root);
  const body = h('div', {}, h('div', { class: 'adm-loading', text: 'טוען נתונים...' }));
  root.appendChild(body);
  let timer = null;
  let alive = true;

  const load = async () => {
    try {
      const [s, names] = await Promise.all([api.getStats(30), loadNames()]);
      if (!alive) return;
      draw(s || {}, names);
    } catch (e) {
      if (alive) showError(body, e, load);
    }
  };

  const draw = (s, names) => {
    clear(body);
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

    body.appendChild(h('div', { class: 'adm-section-title', text: 'שחקנים' }));
    const onlineTile = kpi('kpi-online', 'מחוברים עכשיו', n0(s.online_now), 'פעילים ב-2 הדקות האחרונות', { hero: true, dot: true });
    body.appendChild(h('div', { class: 'adm-grid wide' },
      onlineTile,
      kpi('kpi-devices', 'סה"כ שחקנים (מכשירים)', n0(s.total_devices)),
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
        const el = root.querySelector('[data-testid="kpi-online"]');
        if (el && s2) { el.textContent = String(n0(s2.online_now)); el.setAttribute('data-value', String(n0(s2.online_now))); }
      } catch { /* keep the old value */ }
    }, 60000);
  };

  load();
  return () => { alive = false; clearInterval(timer); };
}

// ---------- #/feedback ----------
export function renderFeedback(root, { onUnreadChange } = {}) {
  clear(root);
  const PAGE = 50;
  const state = { offset: 0, unreadOnly: false };
  let alive = true;
  const unreadToggle = h('input', { type: 'checkbox', testid: 'fb-unread-only' });
  const countLbl = h('span', { class: 'adm-muted' });
  const list = h('div', { class: 'adm-fb' }, h('div', { class: 'adm-loading', text: 'טוען משובים...' }));
  const pager = h('div', { class: 'adm-pager' });

  root.appendChild(h('div', { class: 'adm-row' },
    h('label', { class: 'adm-check' }, unreadToggle, 'רק שלא נקראו'),
    h('span', { class: 'adm-spacer' }),
    countLbl,
    h('button', { class: 'adm-btn small', type: 'button', text: 'רענן', onclick: () => load() }),
  ));
  root.appendChild(list);
  root.appendChild(pager);
  unreadToggle.addEventListener('change', () => { state.unreadOnly = unreadToggle.checked; state.offset = 0; load(); });

  const ctxSummary = (ctx, names) => {
    const c = ctx && typeof ctx === 'object' ? ctx : {};
    const parts = [];
    if (c.v) parts.push('v' + c.v);
    if (c.seasons) parts.push('עונה ' + c.seasons);
    else if (c.season) parts.push('עונה ' + c.season);
    if (c.age) parts.push('גיל ' + c.age);
    if (c.ovr) parts.push('OVR ' + c.ovr);
    if (c.club) parts.push(/^[a-z0-9_]+$/.test(String(c.club)) ? names.club(c.club) : String(c.club));
    if (c.trigger) parts.push(c.trigger === 'season1' ? 'אחרי עונה 1' : c.trigger === 'retired' ? 'אחרי פרישה' : String(c.trigger));
    if (c.platform) parts.push(String(c.platform) + (c.standalone ? ' (מותקן)' : ''));
    return parts.join(' · ');
  };

  const row = (f, names) => {
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
        if (onUnreadChange) onUnreadChange(f.is_read ? -1 : 1);
      } catch (e) {
        if (!(e instanceof AuthLostError)) toast(e instanceof SupaError && e.status === 0 ? 'אין חיבור לשרת' : 'השמירה נכשלה', { error: true });
      } finally {
        btn.disabled = false;
      }
    });
    sync();
    const email = typeof f.email === 'string' ? f.email : '';
    const emailNode = email
      ? (EMAIL_RE.test(email) ? h('a', { href: 'mailto:' + encodeURIComponent(email), dir: 'ltr', text: email }) : h('bdi', { text: email }))
      : h('span', { text: 'ללא אימייל' });
    item.appendChild(h('div', { class: 'adm-row' },
      h('span', { class: 'stars', 'aria-label': n0(f.rating) + ' כוכבים', text: stars(f.rating) }),
      h('span', { class: 'adm-spacer' }),
      btn));
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
      const [res, names] = await Promise.all([api.getFeedback({ limit: PAGE, offset: state.offset, unreadOnly: state.unreadOnly }), loadNames()]);
      if (!alive) return;
      const rows = (res && Array.isArray(res.rows)) ? res.rows : [];
      const total = n0(res && res.total);
      countLbl.textContent = 'סה"כ ' + total + ' · לא נקראו ' + n0(res && res.unread);
      clear(list);
      if (!rows.length) list.appendChild(h('div', { class: 'adm-empty', text: state.unreadOnly ? 'אין משובים שלא נקראו 🎉' : 'עוד אין משובים' }));
      rows.forEach((f) => list.appendChild(row(f, names)));
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
