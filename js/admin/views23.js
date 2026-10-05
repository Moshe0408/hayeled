// js/admin/views23.js - v2.3 admin: the funnel / retention / engagement block on the dashboard and the
// "טבלה" tab (leaderboard moderation). Data: supabase/update-2.3.sql (admin_funnel, admin_leaderboard,
// admin_leaderboard_hide). Before that file is run every call answers null and a banner explains what to do.
// SECURITY: names come from anonymous players: everything is rendered with textContent (h() never parses HTML).
import { h, clear, toast, fmtDate, fmtAgo, loadNames, kpi, showError, errText, armedButton } from './views.js';
import { funnelBars, rankList, columnChart } from './charts.js';
import * as api from './api.js';
import { AuthLostError } from './api.js';

const n0 = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const C_BAR = '#3987e5';   // series-1 (the dashboard's validated single-series hue on the card surface)

/** Banner while supabase/update-2.3.sql has not been run (the funnel, retention and leaderboard stay hidden). */
export function schemaBanner23(extra) {
  return h('div', { class: 'adm-banner', role: 'status', testid: 'adm-schema-banner-23' },
    h('span', { class: 'ic', 'aria-hidden': 'true', text: '!' }),
    h('div', {},
      h('strong', { text: 'יש להריץ את update-2.3.sql' }),
      h('p', {}, 'המשפך (איפה שחקנים חדשים נושרים), החזרה למחרת ואחרי שבוע, הפרסים היומיים, ההישגים, השיתופים וטבלת המובילים יופיעו אחרי הרצת הקובץ ',
        h('code', { text: 'supabase/update-2.3.sql' }), ' בעורך ה-SQL של Supabase. ההסבר המלא נמצא בקובץ ',
        h('code', { text: 'docs/ADMIN_SETUP.md' }), ', בסעיף "עדכון 2.3".'),
      extra ? h('p', { text: extra }) : null));
}

// ---------- Hebrew labels ----------
export const FUNNEL_STEPS = [
  { key: 'visitors', he: 'נכנסו למשחק' },
  { key: 'onboarding', he: 'התחילו הרשמה' },
  { key: 'career', he: 'פתחו קריירה' },
  { key: 'first_match', he: 'שיחקו משחק ראשון' },
  { key: 'week_3', he: 'הגיעו לשבוע 3' },
  { key: 'week_5', he: 'הגיעו לשבוע 5' },
  { key: 'week_10', he: 'הגיעו לשבוע 10' },
  { key: 'week_20', he: 'הגיעו לשבוע 20' },
  { key: 'week_40', he: 'הגיעו לשבוע 40 (עונה שלמה)' },
];
// the sentence: [plural past, singular past, present plural (per 100)]
const SENT = {
  onboarding: ['התחילו הרשמה', 'התחיל הרשמה', 'מתחילים הרשמה'],
  career: ['פתחו קריירה', 'פתח קריירה', 'פותחים קריירה'],
  first_match: ['שיחקו משחק ראשון', 'שיחק משחק ראשון', 'משחקים משחק ראשון'],
  week_3: ['הגיעו לשבוע 3', 'הגיע לשבוע 3', 'מגיעים לשבוע 3'],
  week_5: ['הגיעו לשבוע 5', 'הגיע לשבוע 5', 'מגיעים לשבוע 5'],
  week_10: ['הגיעו לשבוע 10', 'הגיע לשבוע 10', 'מגיעים לשבוע 10'],
  week_20: ['הגיעו לשבוע 20', 'הגיע לשבוע 20', 'מגיעים לשבוע 20'],
  week_40: ['הגיעו לשבוע 40', 'הגיע לשבוע 40', 'מגיעים לשבוע 40'],
};
const STEP_HE = {
  open: 'פתחו את מסך ההרשמה', gender: 'בחרו בן או בת', name: 'כתבו שם', random: 'לחצו "שחקן אקראי"',
  advanced: 'פתחו "התאמה מתקדמת"', kickoff: 'לחצו "לבעיטת הפתיחה"', '?': 'לא ידוע',
};
const SHARE_HE = { goal: 'שער', achievement: 'הישג', promotion: 'עלייה בדרגה', trophy: 'תואר', challenge: 'אתגר חבר', card: 'כרטיס שחקן', '?': 'לא ידוע' };
const METHOD_HE = { share: 'שיתוף מהטלפון', download: 'הורדת תמונה', whatsapp: 'וואטסאפ', copy: 'העתקת קישור', cancel: 'בוטל', '?': 'לא ידוע' };

/** 'a, b ו-c' */
function joinHe(parts) {
  if (parts.length <= 1) return parts.join('');
  return parts.slice(0, -1).join(', ') + ' ו-' + parts[parts.length - 1];
}

/** "מתוך 15 שנכנסו ב-30 הימים האחרונים: 9 התחילו הרשמה, 5 פתחו קריירה ..." */
export function funnelSentence(f, days) {
  const v = n0(f.visitors);
  if (!v) return 'ב-' + days + ' הימים האחרונים עוד לא נכנסו שחקנים חדשים.';
  const parts = [];
  let firstWeek = true;
  for (const s of FUNNEL_STEPS.slice(1)) {
    const c = n0(f[s.key]);
    const w = SENT[s.key];
    if (!c) { parts.push('אף אחד עוד לא ' + w[1]); break; }
    if (s.key.startsWith('week_') && !firstWeek) parts.push(c + ' ' + w[c === 1 ? 1 : 0].replace(/^הגיעו? /, ''));
    else parts.push(c + ' ' + w[c === 1 ? 1 : 0]);
    if (s.key.startsWith('week_')) firstWeek = false;
  }
  return 'מתוך ' + v + ' שנכנסו ב-' + days + ' הימים האחרונים: ' + joinHe(parts) + '.';
}

/** "כלומר, מכל 100 שנכנסים: 60 מתחילים הרשמה, ..." (only with >= 10 visitors; null otherwise) */
export function per100Sentence(f) {
  const v = n0(f.visitors);
  if (v < 10) return null;
  const parts = [];
  for (const s of FUNNEL_STEPS.slice(1)) {
    const c = n0(f[s.key]);
    if (!c) break;
    parts.push(pct(c, v) + ' ' + SENT[s.key][2]);
    if (s.key === 'week_10') break;
  }
  return parts.length ? 'כלומר, מכל 100 שנכנסים: ' + joinHe(parts) + '.' : null;
}

export function retentionSentence(r) {
  const e1 = n0(r.eligible_d1);
  const e7 = n0(r.eligible_d7);
  const out = [];
  if (e1) {
    out.push('מתוך ' + e1 + ' שנכנסו לראשונה לפני יום או יותר, ' + n0(r.d1) + ' חזרו למחרת (' + pct(n0(r.d1), e1) + '%) ו-'
      + n0(r.returned) + ' חזרו מתישהו (' + pct(n0(r.returned), e1) + '%).');
  } else out.push('עוד אין מי שנכנס לראשונה לפני יום או יותר, אז אי אפשר לדעת מי חזר למחרת.');
  if (e7) out.push('מתוך ' + e7 + ' שנכנסו לפני שבוע או יותר, ' + n0(r.d7) + ' נכנסו ביום השביעי (' + pct(n0(r.d7), e7) + '%) ו-'
    + n0(r.returned_7) + ' עדיין משחקים אחרי שבוע (' + pct(n0(r.returned_7), e7) + '%).');
  else out.push('עוד אין מי שנכנס לפני שבוע, אז D7 יופיע בהמשך.');
  return out.join(' ');
}

// ---------- names from the content tables (optional at runtime) ----------
let contentPromise = null;
function loadContent() {
  if (!contentPromise) {
    contentPromise = (async () => {
      const tables = { ach: null, obj: null };
      for (const p of ['../data/strings.js', '../data/events.js']) {
        try {
          const m = await import(p);
          if (!tables.ach && m.ACHIEVEMENTS) tables.ach = m.ACHIEVEMENTS;
          if (!tables.obj && m.OBJECTIVES) tables.obj = m.OBJECTIVES;
        } catch { /* optional */ }
      }
      const unmark = (s) => String(s).replace(/\{\{([^|}]*)\|[^}]*\}\}/g, '$1');   // {{m|f}} -> the boy's form
      const find = (t, id) => {
        if (!t) return null;
        let e = null;
        if (Array.isArray(t)) e = t.find((x) => x && x.id === id);
        else if (typeof t === 'object') {
          e = t[id];
          if (!e) for (const v of Object.values(t)) { if (Array.isArray(v)) { e = v.find((x) => x && x.id === id); if (e) break; } }
        }
        if (!e) return null;
        if (typeof e === 'string') return unmark(e);
        const s = e.he || e.nameHe || e.titleHe || e.name || e.title;
        return typeof s === 'string' ? unmark(s) : (s && typeof s.m === 'string' ? s.m : null);
      };
      return { ach: (id) => find(tables.ach, id) || String(id), obj: (id) => find(tables.obj, id) || String(id) };
    })();
  }
  return contentPromise;
}

// ---------- the dashboard block ----------
/**
 * Mount the 2.3 block into `slot` (it loads on its own, so the rest of the dashboard never waits for it).
 * showBanner: show the 2.3 banner when update-2.3.sql is missing (false while an older banner is already shown).
 * -> cleanup()
 */
export function mountFunnel(slot, { showBanner = true } = {}) {
  let alive = true;
  let days = 30;
  let seq = 0;
  const load = async () => {
    const my = ++seq;
    clear(slot);
    slot.appendChild(h('div', { class: 'adm-loading', text: 'טוען את המשפך...' }));
    try {
      const [F, names] = await Promise.all([api.getFunnel(days), loadContent()]);
      if (!alive || my !== seq) return;
      clear(slot);
      if (F === null) {
        if (showBanner) slot.appendChild(schemaBanner23());
        return;
      }
      draw(F || {}, names);
    } catch (e) {
      if (e instanceof AuthLostError) return;
      if (!alive || my !== seq) return;
      clear(slot);
      slot.appendChild(h('p', { class: 'adm-warn', testid: 'v23-error', text: 'נתוני 2.3 (המשפך) לא נטענו: ' + errText(e) + '. לחץ "רענן" כדי לנסות שוב.' }));
    }
  };

  const chips = () => h('div', { class: 'adm-chips', role: 'group', 'aria-label': 'תקופה', testid: 'funnel-days' },
    [7, 30, 90].map((d) => h('button', {
      class: 'adm-chip' + (days === d ? ' on' : ''), type: 'button', testid: 'funnel-days-' + d, 'aria-pressed': days === d ? 'true' : 'false',
      text: d + ' ימים', onclick: () => { if (days !== d) { days = d; load(); } },
    })));

  const draw = (F, names) => {
    const f = F.funnel || {};
    const r = F.retention || {};
    const eng = F.engagement || {};
    const lb = F.leaderboard || {};
    const d = n0(F.days) || days;

    slot.appendChild(h('div', { class: 'adm-section-title gold adm-funnel-title' },
      h('span', { text: 'משפך שחקנים חדשים וחזרה למשחק' }), h('span', { class: 'tag', text: '2.3' })));
    slot.appendChild(h('div', { class: 'adm-row adm-funnel-bar' },
      h('span', { class: 'adm-muted', text: 'מי שנכנס לראשונה ב:' }), chips()));

    // 1) the funnel, in words + bars
    const steps = FUNNEL_STEPS.map((s) => ({ key: s.key, name: s.he, count: n0(f[s.key]) }));
    // trailing weeks nobody reached are folded into one line under the chart
    let last = steps.length - 1;
    while (last > 4 && !steps[last].count && !steps[last - 1].count) last--;
    const shown = steps.slice(0, last + 1);
    const p100 = per100Sentence(f);
    const ret = n0(f.returning_careers);
    const onbCard = h('div', { class: 'adm-card', testid: 'v23-onboarding' }, h('h3', { text: 'ההרשמה המהירה: מי הגיע לאיזה שלב' }),
        rankList((Array.isArray(F.onboarding_steps) ? F.onboarding_steps : []).map((x) => ({ name: STEP_HE[x.key] || String(x.key), count: n0(x.devices) })),
          { empty: 'עוד אין נתוני הרשמה (מגרסה 2.3)', total: n0(f.visitors) || undefined }),
        h('div', { class: 'adm-muted', style: 'font-size:12px;margin-top:6px', text: 'האחוז = מתוך כל מי שנכנס בתקופה.' }));
    slot.appendChild(h('div', { class: 'adm-cols adm-funnel-cols' },
      h('section', { class: 'adm-card adm-funnel-card', testid: 'funnel-card', 'aria-label': 'משפך שחקנים חדשים' },
        h('h3', { text: 'איפה שחקנים חדשים נושרים' }),
        h('p', { class: 'adm-funnel-text', testid: 'funnel-text', text: funnelSentence(f, d) }),
        p100 ? h('p', { class: 'adm-funnel-text sub', testid: 'funnel-per100', text: p100 }) : null,
        funnelBars(shown, { testid: 'chart-funnel', color: C_BAR, empty: 'עוד אין שחקנים חדשים בתקופה הזו' }),
        h('p', { class: 'adm-note-sm', testid: 'funnel-note' },
          'כל שלב סופר מכשירים שהגיעו אליו או לשלב מאוחר יותר. "שבוע" = שבוע משחק בקריירה (בגרסאות לפני 2.3: לפי מספר המשחקים).'
          + (ret ? ' ' + ret + ' מהם המשיכו קריירה שהתחילה לפני התקופה (שחקנים חוזרים).' : ''))),
      h('div', { class: 'adm-stack' },
        h('section', { class: 'adm-card', testid: 'retention-card', 'aria-label': 'חזרה למשחק' },
          h('h3', { text: 'חוזרים למשחק? (D1 / D7)' }),
          h('div', { class: 'adm-grid adm-ret-grid' },
            kpi('kpi-d1', 'חזרו למחרת (D1)', n0(r.eligible_d1) ? pct(n0(r.d1), n0(r.eligible_d1)) + '%' : '–', n0(r.d1) + ' מתוך ' + n0(r.eligible_d1), { gold: true }),
            kpi('kpi-d7', 'נכנסו ביום ה-7 (D7)', n0(r.eligible_d7) ? pct(n0(r.d7), n0(r.eligible_d7)) + '%' : '–', n0(r.d7) + ' מתוך ' + n0(r.eligible_d7)),
            kpi('kpi-returned', 'חזרו מתישהו', n0(r.eligible_d1) ? pct(n0(r.returned), n0(r.eligible_d1)) + '%' : '–', n0(r.returned) + ' מתוך ' + n0(r.eligible_d1))),
          h('p', { class: 'adm-funnel-text sub', testid: 'retention-text', text: retentionSentence(r) }),
          cohortTable(Array.isArray(F.cohorts) ? F.cohorts : []),
          h('p', { class: 'adm-note-sm', text: '"חזרו" = המכשיר היה פעיל ביום קלנדרי מאוחר יותר (שעון ישראל). D1 = היום שאחרי הכניסה הראשונה, D7 = היום השביעי אחריה.' })),
        onbCard),
    ));

    // 2) fast-start steps + 2.3 engagement
    const dr = eng.daily_reward || {};
    const ach = eng.achievements || {};
    const obj = eng.objectives || {};
    const sh = eng.share || {};
    const lv = eng.leaderboard_view || {};
    const co = eng.challenge_open || {};
    slot.appendChild(h('div', { class: 'adm-section-title gold' }, h('span', { text: 'פרסים יומיים, הישגים, שיתופים וטבלה' }), h('span', { class: 'tag', text: '2.3' })));
    slot.appendChild(h('div', { class: 'adm-grid wide', testid: 'v23-kpis' },
      kpi('kpi-daily', 'פרסים יומיים שנאספו', n0(dr.total), n0(dr.devices) + ' שחקנים · רצף שיא ' + n0(dr.max_streak) + ' ימים'),
      kpi('kpi-achievements', 'הישגים שנפתחו', n0(ach.total), n0(ach.total_7d) + ' ב-7 ימים · ' + n0(ach.devices) + ' שחקנים'),
      kpi('kpi-objectives', 'משימות שהושלמו', n0(obj.total), n0(obj.total_7d) + ' ב-7 ימים · ' + n0(obj.devices) + ' שחקנים'),
      kpi('kpi-shares', 'שיתופים', n0(sh.total), n0(sh.total_7d) + ' ב-7 ימים · ' + n0(sh.devices) + ' שחקנים', { gold: true }),
      kpi('kpi-lb-views', 'צפיות בטבלת המובילים', n0(lv.total), n0(lv.devices) + ' שחקנים'),
      kpi('kpi-challenges', 'נכנסו מקישור "אתגר חבר"', n0(co.total), n0(co.devices) + ' מכשירים · ' + n0(co.total_7d) + ' ב-7 ימים'),
    ));
    const byDay = dr.by_day || {};
    const mapKey = (arr, fn) => (Array.isArray(arr) ? arr : []).map((x) => ({ name: fn(x.key), count: n0(x.count != null ? x.count : x.devices) }));
    slot.appendChild(h('div', { class: 'adm-cols three' },
      h('div', { class: 'adm-card', testid: 'v23-daily' }, h('h3', { text: 'פרס יומי: באיזה יום ברצף' }),
        n0(dr.total)
          ? columnChart(['1', '2', '3', '4', '5', '6', '7'].map((k) => ({ label: 'יום ' + k, value: n0(byDay[k]) })), { testid: 'chart-daily', color: C_BAR })
          : h('div', { class: 'adm-empty', text: 'עוד לא נאספו פרסים יומיים' }),
        h('div', { class: 'adm-muted', style: 'font-size:12px;margin-top:6px', text: 'יום 7 = התיבה הגדולה. ירידה חדה בין הימים = שחקנים ששוברים את הרצף.' })),
      h('div', { class: 'adm-card', testid: 'v23-achievements' }, h('h3', { text: 'ההישגים הנפוצים' }),
        rankList((Array.isArray(ach.top) ? ach.top : []).slice(0, 8).map((x) => ({ name: names.ach(x.key), count: n0(x.devices != null ? x.devices : x.count) })),
          { empty: 'עוד לא נפתחו הישגים', total: n0(ach.devices) || undefined }),
        n0(ach.devices) ? h('div', { class: 'adm-muted', style: 'font-size:12px;margin-top:6px', text: 'האחוז = מתוך השחקנים שפתחו הישג כלשהו.' }) : null),
      h('div', { class: 'adm-card', testid: 'v23-shares' }, h('h3', { text: 'מה משתפים' }),
        rankList(mapKey(sh.by_kind, (k) => SHARE_HE[k] || k), { empty: 'עוד אין שיתופים' }),
        (Array.isArray(sh.by_method) && sh.by_method.length) ? h('div', { class: 'adm-muted', style: 'font-size:12px;margin-top:8px',
          text: 'איך: ' + sh.by_method.map((x) => (METHOD_HE[x.key] || x.key) + ' ' + n0(x.count)).join(' · ') }) : null),
    ));
    slot.appendChild(h('div', { class: 'adm-cols' },
      h('div', { class: 'adm-card', testid: 'v23-objectives' }, h('h3', { text: 'המשימות שהושלמו הכי הרבה' }),
        rankList(mapKey(obj.top, names.obj).slice(0, 8), { empty: 'עוד לא הושלמו משימות' })),
      h('a', { class: 'adm-card adm-kpi adm-lb-link', href: '#/board', testid: 'v23-board-link' },
        h('div', { class: 'label', text: 'טבלת המובילים' }),
        h('div', { class: 'value', testid: 'kpi-lb-entries', text: String(n0(lb.visible)) }),
        h('div', { class: 'sub', text: 'קריירות בטבלה · ' + n0(lb.new_7d) + ' חדשות ב-7 ימים' }),
        h('div', { class: 'sub', text: 'מוסתרות: ' + n0(lb.hidden) + ' · שמות שהוחלפו בסינון: ' + n0(lb.flagged) }),
        h('div', { class: 'sub strong', text: 'לחץ לניהול הטבלה ←' })),
    ));
  };

  load();
  return () => { alive = false; };
}

function cohortTable(rows) {
  if (!rows.length) return null;
  const cell = (v, d) => (v === null || v === undefined ? h('td', { class: 'n muted', text: '–', title: 'עוד מוקדם לדעת' }) : h('td', { class: 'n', text: String(v) + (d ? ' (' + pct(v, d) + '%)' : '') }));
  const det = h('details', { class: 'adm-table-toggle', testid: 'cohort-table' },
    h('summary', { text: 'לפי יום הכניסה הראשונה (14 ימים)' }),
    h('div', { class: 'adm-scroll' },
      h('table', { class: 'adm-table' },
        h('thead', {}, h('tr', {}, h('th', { text: 'יום' }), h('th', { text: 'חדשים' }), h('th', { text: 'חזרו למחרת' }), h('th', { text: 'ביום ה-7' }))),
        h('tbody', {}, rows.map((x) => h('tr', {},
          h('td', { text: shortDay(x.day) }),
          h('td', { class: 'n', text: String(n0(x.new)) }),
          cell(x.d1, n0(x.new)),
          cell(x.d7, n0(x.new))))))));
  return det;
}
function shortDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? Number(m[3]) + '.' + Number(m[2]) : String(iso || '');
}

// ---------- #/board: leaderboard moderation ----------
const FILTERS = [
  { id: 'all', he: 'הכול' },
  { id: 'visible', he: 'מופיעים בטבלה' },
  { id: 'hidden', he: 'מוסתרים' },
  { id: 'flagged', he: 'שם הוחלף בסינון' },
];

export function renderBoard(root) {
  clear(root);
  const PAGE = 50;
  const state = { offset: 0, search: '', filter: 'all', total: 0 };
  let alive = true;
  let seq = 0;
  let debounce = null;
  const bannerSlot = h('div');
  const search = h('input', { class: 'adm-input adm-search', type: 'search', testid: 'board-search', placeholder: 'חיפוש לפי שם', 'aria-label': 'חיפוש לפי שם', autocomplete: 'off', maxlength: '60', enterkeyhint: 'search' });
  const countLbl = h('span', { class: 'adm-muted', testid: 'board-count', 'aria-live': 'polite' });
  const chips = h('div', { class: 'adm-chips', role: 'group', 'aria-label': 'סינון', testid: 'board-filter' });
  const list = h('div', { class: 'adm-lb', testid: 'board-list' }, h('div', { class: 'adm-loading', text: 'טוען את הטבלה...' }));
  const pager = h('div', { class: 'adm-pager', testid: 'board-pager' });

  const drawChips = (counts) => {
    clear(chips);
    const c = counts || {};
    for (const f of FILTERS) {
      chips.appendChild(h('button', {
        class: 'adm-chip' + (state.filter === f.id ? ' on' : ''), type: 'button', testid: 'board-filter-' + f.id,
        'aria-pressed': state.filter === f.id ? 'true' : 'false',
        onclick: () => { if (state.filter === f.id) return; state.filter = f.id; state.offset = 0; load(); },
      }, f.he, h('span', { class: 'c', text: String(n0(c[f.id])) })));
    }
  };
  drawChips({});
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
  root.appendChild(h('p', { class: 'adm-note adm-pl-note', testid: 'board-note' },
    'כל שורה היא קריירה אחת שנשלחה לטבלת המובילים הציבורית (בסוף כל עונה). השם הוא השם שהשחקן כתב לדמות. שם גס מוחלף אוטומטית ב"שחקן מהשכונה" / "שחקנית מהשכונה", וכאן רואים גם מה נכתב במקור. '
    + '"הסתר" מוריד את השורה מהטבלה שהשחקנים רואים (אפשר להחזיר). המיקום = המקום בטבלת המורשת של כל הזמנים.'));
  root.appendChild(list);
  root.appendChild(pager);

  const row = (r, names) => {
    const f = r.gender === 'f';
    const item = h('article', { class: 'adm-lb-row' + (r.hidden ? ' hidden-row' : '') + (r.flagged ? ' flagged' : ''), testid: 'board-row-' + r.id, 'data-hidden': r.hidden ? '1' : '0' });
    const stat = (label, v, cls) => h('span', { class: 'st' + (cls ? ' ' + cls : '') }, h('b', { text: String(n0(v)) }), ' ' + label);
    const actions = h('div', { class: 'acts' });
    const sync = () => {
      clear(actions);
      item.classList.toggle('hidden-row', !!r.hidden);
      item.setAttribute('data-hidden', r.hidden ? '1' : '0');
      rankEl.textContent = r.hidden ? 'מוסתר' : '#' + n0(r.legacy_rank);
      rankEl.className = 'rk' + (r.hidden ? ' off' : '');
      if (r.hidden) {
        actions.appendChild(h('button', { class: 'adm-btn small', type: 'button', testid: 'board-show-' + r.id, text: 'החזר לטבלה', onclick: (ev) => toggle(false, ev.currentTarget) }));
        if (r.hidden_at) actions.appendChild(h('span', { class: 'adm-muted when', text: 'הוסתר ' + fmtAgo(r.hidden_at) + (r.hidden_by ? ' · ' + r.hidden_by : '') }));
      } else {
        actions.appendChild(armedButton({ class: 'adm-btn small danger', testid: 'board-hide-' + r.id, 'aria-label': 'הסתר מהטבלה' },
          { label: 'הסתר', armedLabel: 'בטוח? לחץ שוב', action: () => toggle(true) }));
      }
    };
    const toggle = async (hide, btn) => {
      if (btn) btn.disabled = true;
      try {
        const res = await api.setLeaderboardHidden(r.id, hide);
        if (!res || res.ok !== true) { toast('הפעולה נדחתה', { error: true }); return; }
        r.hidden = hide;
        r.hidden_at = hide ? new Date().toISOString() : null;
        r.hidden_by = hide ? api.currentEmail() : null;
        sync();
        toast(hide ? 'השורה הוסתרה מהטבלה' : 'השורה חזרה לטבלה');
      } catch (e) {
        if (!(e instanceof AuthLostError)) toast('הפעולה נכשלה: ' + errText(e), { error: true });
      } finally {
        if (btn) btn.disabled = false;
      }
    };
    const rankEl = h('span', { class: 'rk', testid: 'board-rank' });
    item.appendChild(rankEl);
    item.appendChild(h('div', { class: 'who' },
      h('div', { class: 'nm', testid: 'board-name', title: r.name, text: r.name }),
      h('div', { class: 'sub' },
        h('span', { class: 'adm-g ' + (f ? 'f' : 'm'), text: f ? 'בת' : 'בן' }),
        r.nation ? h('span', { text: names.nationHe(r.nation) }) : null,
        r.club ? h('span', { class: 'club', title: r.club, text: r.club }) : null),
      r.flagged ? h('div', { class: 'flag', testid: 'board-flag' }, 'הוחלף בסינון',
        r.raw_name ? h('span', {}, ' · נכתב: ', h('bdi', { class: 'raw', text: '«' + r.raw_name + '»' })) : null) : null));
    item.appendChild(h('div', { class: 'stats' },
      stat('מורשת', r.legacy, 'gold'), stat('שערים', r.goals), stat('תארים', r.trophies), stat('כדורי זהב', r.ballon), stat('OVR', r.ovr)));
    item.appendChild(h('div', { class: 'meta adm-muted' },
      h('span', { text: 'עודכן ' + fmtAgo(r.updated_at) }),
      h('span', { text: n0(r.submissions) + ' שליחות' }),
      h('span', { title: 'נכנס לטבלה: ' + fmtDate(r.created_at) }, 'מכשיר ', h('bdi', { dir: 'ltr', text: String(r.device_id || '').slice(0, 8) + '…' }))));
    item.appendChild(actions);
    sync();
    return item;
  };

  const load = async () => {
    const my = ++seq;
    clear(list);
    list.appendChild(h('div', { class: 'adm-loading', text: 'טוען את הטבלה...' }));
    try {
      const [res, names] = await Promise.all([
        api.getLeaderboardAdmin({ limit: PAGE, offset: state.offset, search: state.search, filter: state.filter }),
        loadNames()]);
      if (!alive || my !== seq) return;
      clear(bannerSlot);
      clear(list);
      clear(pager);
      if (res === null) {
        bannerSlot.appendChild(schemaBanner23('טבלת המובילים תתחיל להתמלא אחרי ההרצה: המשחק שומר את הקריירות בצד ושולח אותן כשהשרת מוכן.'));
        countLbl.textContent = '';
        list.appendChild(h('div', { class: 'adm-empty', testid: 'board-empty', text: 'הטבלה תופיע אחרי הרצת update-2.3.sql.' }));
        return;
      }
      drawChips(res.counts);
      const rows = Array.isArray(res.rows) ? res.rows : [];
      state.total = n0(res.total);
      const range = state.total > PAGE && rows.length ? 'מציג ' + (state.offset + 1) + '–' + (state.offset + rows.length) + ' מתוך ' : '';
      countLbl.textContent = (range || 'סה"כ ') + state.total + (state.total === 1 ? ' קריירה' : ' קריירות');
      if (!rows.length) {
        list.appendChild(h('div', { class: 'adm-empty', testid: 'board-empty',
          text: state.search ? 'לא נמצא שם שמכיל "' + state.search + '"'
            : state.filter === 'all' ? 'עוד אין קריירות בטבלה. הן נשלחות בסוף כל עונה במשחק.' : 'אין שורות בסינון הזה.' }));
      }
      rows.forEach((r) => list.appendChild(row(r, names)));
      if (state.total > PAGE) {
        const page = Math.floor(state.offset / PAGE) + 1;
        const pages = Math.ceil(state.total / PAGE);
        const go = (off) => { state.offset = off; load(); try { root.scrollIntoView({ block: 'start' }); } catch { /* ignore */ } };
        pager.appendChild(h('button', { class: 'adm-btn small', type: 'button', testid: 'board-prev', text: 'הקודם', disabled: state.offset <= 0, onclick: () => go(Math.max(0, state.offset - PAGE)) }));
        pager.appendChild(h('span', { class: 'adm-muted', text: 'עמוד ' + page + ' מתוך ' + pages }));
        pager.appendChild(h('button', { class: 'adm-btn small', type: 'button', testid: 'board-next', text: 'הבא', disabled: state.offset + PAGE >= state.total, onclick: () => go(state.offset + PAGE) }));
      }
    } catch (e) {
      if (alive && my === seq) showError(list, e, load);
    }
  };
  load();
  return () => { alive = false; clearTimeout(debounce); };
}
