// friends.js: "ליגת חברים" screens (css/friends.css, client js/core/friends.js, SQL supabase/update-2.3-friends.sql).
//   #/friends               my leagues + "פתיחת ליגה" / "יש לי קוד"
//   #/friends/CODE          the league table (also #/friends?code=CODE)
//   #/friends/join?code=X   the join card of an invitation link (?league=X on boot -> friends.handleLeagueParam())
// Works without a career (list / join card); joining needs a career (the one in memory or another save slot).
// friendsNotices() -> hub alerts ("נועה עקפה אותך בליגה 'החבר'ה'!") from the cached tables vs the last seen ranks.
import * as F from '../core/friends.js';
import { esc } from './dom.js';
import { gtext, gBy } from './gender.js';
import { crestSVG, crestFor, hashStr } from './crests.js';
import { ico } from './icons.js';
import { openModal, toast, confirmDialog, svc, ctx } from './app.js';
import { COUNTRY_BY_ID } from '../data/countries.js';
import { num, ago } from './format.js';

const MEDAL = ['', '🥇', '🥈', '🥉'];
const SUGGEST = ['החבר׳ה', 'הכיתה', 'השכונה', 'המשפחה', 'הקבוצה'];
const LG_COLORS = [['#0B3D91', '#F4C35A'], ['#7A1020', '#FFFFFF'], ['#0E5A3A', '#F4C35A'], ['#1B1F3B', '#2FE3CF'], ['#5B2A86', '#FFE7A3'], ['#B4461A', '#0A1838'], ['#0A1838', '#FFFFFF'], ['#1F6FB2', '#FFFFFF']];
const T = (s) => gtext(s);

// ---------- career source (the join card): the career in memory + the other save slots ----------
let careerSource = null;
/** Test / integration hook: fn() -> Promise<[{slot, summary, current}]>. */
export function _setCareerSource(fn) { careerSource = typeof fn === 'function' ? fn : null; }
async function listCareers() {
  if (careerSource) { try { return (await careerSource()) || []; } catch { return []; } }
  const out = [];
  const cur = F.currentSummary();
  if (cur) out.push({ slot: ctx.activeSlot || null, summary: cur, current: true });
  try {
    const save = await import('../core/save.js');
    const slots = await save.listSlots();
    for (const s of slots || []) {
      if (!s || s.empty || !s.meta || s.tooNew) continue;
      const sm = F.summaryFromMeta(s.meta);
      if (!sm || out.some((o) => o.summary.careerId === sm.careerId)) continue;
      out.push({ slot: s.slot, summary: sm, current: false });
    }
  } catch { /* storage not ready: the career in memory only */ }
  return out;
}

// ---------- small bits ----------
function leagueCrest(code, nameHe, size) {
  const cols = LG_COLORS[hashStr(String(code)) % LG_COLORS.length];
  return crestSVG({ id: 'fl_' + code, nameHe: nameHe || code, colors: cols, reputation: 90 }, size);
}
function memberCrest(m, size) {
  if (m.clubId || m.clubHe) return crestFor({ id: m.clubId || ('fl_club_' + (m.clubHe || '')), nameHe: m.clubHe || '' }, size);
  if (m.nation) return crestFor(m.nation, size);
  return crestSVG(null, size);
}
/** A tiny flag crest (flag emoji do not render on Windows; the game's crests do everywhere). */
function flag(id) {
  const c = id ? COUNTRY_BY_ID[id] : null;
  if (!c) return '';
  return crestSVG({ id: c.id, nameHe: c.nameHe, flag: c.flag, colors: (c.colors || ['#4da3ff', '#ffffff']).slice(0, 2) }, 14, { shadow: false, title: c.nameHe });
}
function rankChip(rank) {
  if (rank >= 1 && rank <= 3) return `<span class="fl-rank m${rank}" aria-label="מקום ${rank}">${MEDAL[rank]}</span>`;
  return `<span class="fl-rank num" aria-label="מקום ${esc(rank)}">${esc(rank)}</span>`;
}
const fmtCode = (c) => (c.length === 6 ? c.slice(0, 3) + ' ' + c.slice(3) : c);
function inviteText(nameHe, url) { return T("בוא{{|י}} תתחר{{ה|י}} איתי בליגה '{name}' ⚽ {url}").replace('{name}', nameHe).replace('{url}', url); }
function track(method) {
  try { if (typeof svc.telemetry.trackShare === 'function') svc.telemetry.trackShare('league', method); else svc.telemetry.track('share', { kind: 'league', method }); } catch { /* ignore */ }
}
function sheetError(el, msg) {
  const e = el.querySelector('.fl-err');
  if (!e) return;
  e.textContent = msg || '';
  e.hidden = !msg;
}
function busy(btn, on) {
  if (!btn) return;
  btn.disabled = !!on;
  btn.classList.toggle('is-busy', !!on);
}

// ---------- routing ----------
export function render(root, params = {}) {
  root.classList.add('fl-screen');
  const path = String((typeof location !== 'undefined' && location.hash) || '').split('?')[0];
  if (/^#\/friends\/join\/?$/.test(path) || params.join) return renderJoin(root, params);
  const m = /^#\/friends\/([A-Za-z0-9-]{6,10})\/?$/.exec(path);
  const code = F.normCode(params.code || (m && m[1]) || '');
  if (code) return renderTable(root, code);
  return renderList(root);
}

// ======================================================================
// 1. My leagues
// ======================================================================
function renderList(root) {
  let alive = true;
  const draw = () => {
    if (!alive) return;
    const list = F.myLeagues();
    const pending = F.getPendingJoin();
    const showPending = pending && !list.some((l) => l.code === pending);
    root.innerHTML = `<div class="fl" data-testid="friends-list">
      <section class="fl-hero">
        <div class="fl-hero-art" aria-hidden="true">${ico('users')}</div>
        <h2 class="fl-hero-title">ליגת חברים</h2>
        <p class="fl-hero-sub">פותחים ליגה, שולחים קישור לחברים, ורואים מי בונה את הקריירה הכי גדולה.</p>
        <div class="fl-hero-btns">
          <button type="button" class="btn btn-gold" data-a="create" data-testid="fl-btn-create">${ico('trophy')}פתיחת ליגה</button>
          <button type="button" class="btn btn-glass" data-a="code" data-testid="fl-btn-code">${ico('lock')}יש לי קוד</button>
        </div>
      </section>
      ${showPending ? `<a class="fl-pending" href="#/friends/join?code=${esc(pending)}" data-testid="fl-pending">
        <span class="fl-pending-ico" aria-hidden="true">✉️</span><span class="grow"><b>${esc(T('הוזמנת לליגת חברים!'))}</b><small>${esc(T('לח{{ץ|צי}} כדי לראות את הליגה ולהצטרף'))}</small></span>${ico('chevron')}</a>` : ''}
      ${!F.isAvailable() ? `<p class="note warn">${esc(F.messageFor('unavailable'))}</p>` : ''}
      <h3 class="section-title"><span>הליגות שלי</span>${list.length ? `<small class="muted num">${esc(list.length)}</small>` : ''}</h3>
      ${list.length ? `<div class="fl-leagues">${list.map(rowLeague).join('')}</div>`
        : `<div class="fl-empty" data-testid="fl-empty">
            <div class="fl-empty-art" aria-hidden="true"><span>🥇</span><span>⚽</span><span>🥈</span></div>
            <p>${esc(T('עוד אין לך ליגות. פת{{ח|חי}} ליגה ראשונה ושל{{ח|חי}} לחברים את הקישור, או הצטר{{ף|פי}} עם קוד שקיבלת.'))}</p></div>`}
    </div>`;
  };
  function rowLeague(l) {
    const c = F.cachedLeague(l.code);
    const me = c && c.members ? c.members.filter((m) => m.isMe).sort((a, b) => a.rank - b.rank)[0] : null;
    const count = c ? c.count : l.members;
    return `<a class="fl-lg" href="#/friends/${esc(l.code)}" data-testid="fl-league-${esc(l.code)}">
      <span class="fl-lg-crest" aria-hidden="true">${leagueCrest(l.code, l.nameHe, 42)}</span>
      <span class="fl-lg-body"><b>${esc(l.nameHe)}</b>
        <small>${count != null ? `<span class="num">${esc(count)}</span> משתתפים` : 'טוען...'}${l.role === 'owner' ? ` · <span class="fl-own">${esc(T('{{מנהל|מנהלת}}'))}</span>` : ''}</small></span>
      ${me ? rankChip(me.rank) : ''}
      <span class="fl-chev" aria-hidden="true">${ico('chevron')}</span></a>`;
  }
  draw();
  const onClick = (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    if (b.dataset.a === 'create') openCreate();
    else if (b.dataset.a === 'code') openCodeEntry();
  };
  root.addEventListener('click', onClick);
  // background: restore the list from the server, then refresh the small numbers (member counts / my rank)
  (async () => {
    await F.refreshMyLeagues();
    draw();
    const n = await F.refreshLeagues({ maxAgeMs: 5 * 60 * 1000 });
    if (n) draw();
  })().catch(() => {});
  return () => { alive = false; root.removeEventListener('click', onClick); };
}

function openCreate() {
  const hasCareer = !!F.currentSummary();
  const close = openModal(`<div class="fl-sheet" data-testid="fl-create">
      <h2 class="modal-title">${ico('trophy', 'gold')} פתיחת ליגה</h2>
      <label class="field"><span>שם הליגה</span>
        <input type="text" name="name" maxlength="${F.NAME_MAX}" autocomplete="off" enterkeyhint="done" placeholder="למשל: החבר׳ה מהשכונה" data-testid="fl-create-name" autofocus></label>
      <div class="chips fl-suggest">${SUGGEST.map((s) => `<button type="button" class="chip chip-btn" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <p class="small muted">${esc(T(hasCareer ? 'עד 50 חברים בליגה. הקריירה הנוכחית שלך תצטרף אוטומטית.' : 'עד 50 חברים בליגה. אפשר להצטרף אליה עם קריירה מאוחר יותר.'))}</p>
      <p class="fl-err" role="alert" hidden></p>
      <div class="btn-col">
        <button type="button" class="btn btn-gold btn-lg" data-a="go" data-testid="fl-create-go">פתיחת הליגה</button>
        <button type="button" class="btn btn-ghost" data-close>ביטול</button>
      </div></div>`, { sheet: true, testid: 'fl-create-sheet', label: 'פתיחת ליגה' });
  const el = close.el;
  const input = el.querySelector('input');
  const go = async () => {
    const btn = el.querySelector('[data-a="go"]');
    const bad = F.checkLeagueName(input.value);
    if (bad) { sheetError(el, F.messageFor(bad)); input.focus(); return; }
    busy(btn, true);
    sheetError(el, '');
    const r = await F.createLeague(input.value);
    busy(btn, false);
    if (!r.ok) { sheetError(el, r.messageHe); return; }
    close();
    toast(T('הליגה נפתחה! עכשיו מזמינים חברים ✓'), { tone: 'good' });
    location.hash = '#/friends/' + r.code;
    setTimeout(() => openInvite({ code: r.code, nameHe: r.nameHe }), 260);
  };
  el.addEventListener('click', (e) => {
    const s = e.target.closest('[data-s]');
    if (s) { input.value = s.dataset.s; sheetError(el, ''); input.focus(); return; }
    if (e.target.closest('[data-a="go"]')) go();
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  return close;
}

function openCodeEntry() {
  const close = openModal(`<div class="fl-sheet" data-testid="fl-code">
      <h2 class="modal-title">${ico('lock', 'gold')} הצטרפות עם קוד</h2>
      <p class="small muted">${esc(T('הקל{{ד|ידי}} את הקוד שקיבלת מחבר או חברה (6 אותיות ומספרים).'))}</p>
      <label class="field"><span>קוד הליגה</span>
        <input type="text" name="code" dir="ltr" class="fl-code-input" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC 123" data-testid="fl-code-input" autofocus></label>
      <p class="fl-err" role="alert" hidden></p>
      <div class="btn-col">
        <button type="button" class="btn btn-gold btn-lg" data-a="go" data-testid="fl-code-go">המשך</button>
        <button type="button" class="btn btn-ghost" data-close>ביטול</button>
      </div></div>`, { sheet: true, testid: 'fl-code-sheet', label: 'הצטרפות עם קוד' });
  const el = close.el;
  const input = el.querySelector('input');
  input.addEventListener('input', () => { input.value = input.value.toUpperCase(); sheetError(el, ''); });
  const go = () => {
    const c = F.normCode(input.value);
    if (!c) { sheetError(el, F.messageFor('bad_code')); input.focus(); return; }
    close();
    location.hash = '#/friends/join?code=' + c;
  };
  el.addEventListener('click', (e) => { if (e.target.closest('[data-a="go"]')) go(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  return close;
}

/** The invite sheet: code, link, Web Share / WhatsApp / copy. */
export function openInvite({ code, nameHe }) {
  const url = F.inviteUrl(code);
  const text = inviteText(nameHe, url);
  const textNoUrl = text.replace(' ' + url, '');
  const close = openModal(`<div class="fl-sheet fl-invite" data-testid="fl-invite">
      <h2 class="modal-title">${ico('upload', 'gold')} הזמנת חברים</h2>
      <p class="small muted">${esc(T('מי שיפתח את הקישור יצטרף לליגה. אפשר גם לתת את הקוד.'))}</p>
      <div class="fl-ticket">
        <span class="fl-ticket-crest" aria-hidden="true">${leagueCrest(code, nameHe, 48)}</span>
        <span class="fl-ticket-body"><small>${esc(nameHe)}</small><b class="fl-code-big num" dir="ltr" data-testid="fl-invite-code">${esc(fmtCode(code))}</b></span>
      </div>
      <p class="fl-msg" data-testid="fl-invite-text">${esc(textNoUrl)} <span dir="ltr" class="fl-url">${esc(url)}</span></p>
      <div class="btn-col">
        <button type="button" class="btn btn-gold btn-lg" data-a="native" data-testid="fl-invite-share">${ico('upload')}שיתוף</button>
        <div class="btn-row">
          <a class="btn fl-wa" data-a="wa" data-testid="fl-invite-wa" target="_blank" rel="noopener" href="https://wa.me/?text=${esc(encodeURIComponent(text))}">${ico('chat')}וואטסאפ</a>
          <button type="button" class="btn" data-a="copy" data-testid="fl-invite-copy">${ico('copy')}העתקה</button>
        </div>
        <button type="button" class="btn btn-ghost" data-close>סגירה</button>
      </div></div>`, { sheet: true, testid: 'fl-invite-sheet', label: 'הזמנת חברים' });
  close.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'wa') { track('whatsapp'); return; }
    if (a === 'copy') {
      let done = false;
      try { await navigator.clipboard.writeText(text); done = true; } catch { done = false; }
      if (done) { toast('ההזמנה הועתקה ✓', { tone: 'good' }); track('copy'); } else toast(url, { ms: 6000 });
      return;
    }
    if (a === 'native') {
      if (navigator.share) {
        try { await navigator.share({ title: 'הילד מהשכונה · ליגת חברים', text: textNoUrl, url }); track('share'); } catch (err) { if (err && err.name === 'AbortError') track('cancel'); }
      } else {
        location.href = 'https://wa.me/?text=' + encodeURIComponent(text);
        track('whatsapp');
      }
    }
  });
  return close;
}

// ======================================================================
// 2. The league table
// ======================================================================
function renderTable(root, code) {
  let alive = true;
  let L = F.cachedLeague(code);
  let sort = 'legacy';
  let manage = false;
  let loading = true;
  let error = null;

  const sorted = () => {
    const ms = (L && L.members ? L.members : []).slice();
    if (sort === 'goals') ms.sort((a, b) => (b.goals - a.goals) || (a.rank - b.rank));
    else if (sort === 'week') ms.sort((a, b) => (b.weekGoals - a.weekGoals) || (a.rank - b.rank));
    return ms.map((m, i) => ({ ...m, pos: sort === 'legacy' ? m.rank : i + 1 }));
  };
  const draw = () => {
    if (!alive) return;
    if (!L) {
      root.innerHTML = error
        ? `<div class="fl" data-testid="friends-table-error"><div class="fl-empty"><div class="fl-empty-art" aria-hidden="true"><span>🔎</span></div>
            <p>${esc(error.messageHe || F.messageFor('server'))}</p>
            <div class="btn-row"><a class="btn btn-glass" href="#/friends">הליגות שלי</a>${error.offline ? '<button type="button" class="btn" data-a="reload">נסה שוב</button>' : ''}</div></div></div>`
        : `<div class="fl" data-testid="friends-table-loading"><div class="loading-line">טוען את הטבלה...</div></div>`;
      return;
    }
    const king = L.weekKing;
    const metricHe = sort === 'week' ? 'השבוע' : 'מורשת';
    const rows = sorted();
    root.innerHTML = `<div class="fl" data-testid="friends-table">
      <section class="fl-head">
        <div class="fl-head-top">
          <span class="fl-head-crest" aria-hidden="true">${leagueCrest(L.code, L.nameHe, 58)}</span>
          <span class="fl-head-body">
            <h2 class="fl-title" data-testid="fl-title">${esc(L.nameHe)}</h2>
            <span class="fl-meta"><span class="chip fl-chip-code" dir="ltr" data-testid="fl-code-chip">${esc(fmtCode(L.code))}</span>
              <span class="chip"><b class="num" dir="ltr">${esc(L.count)}/${esc(L.max)}</b>&nbsp;משתתפים</span>
              ${L.isOwner ? `<span class="chip gold">${esc(T('{{מנהל|מנהלת}}'))}</span>` : ''}</span>
          </span>
        </div>
        <div class="fl-king${king ? '' : ' none'}" data-testid="fl-king"><span class="fl-king-crown" aria-hidden="true">👑</span>
          <span class="fl-king-body"><small>מלך השערים של השבוע</small>
          ${king ? `<b>${esc(king.name)}${king.isMe ? ` <span class="fl-you">(${esc(T('את{{ה|}}'))})</span>` : ''}</b>` : `<b class="muted">עוד אין שערים השבוע</b>`}</span>
          ${king ? `<span class="fl-king-n"><b class="num">${esc(king.weekGoals)}</b><small>⚽</small></span>` : ''}</div>
        <div class="fl-head-btns">
          <button type="button" class="btn btn-gold" data-a="invite" data-testid="fl-btn-invite">${ico('upload')}${esc(T('הזמ{{ן|יני}} חברים'))}</button>
          <button type="button" class="btn btn-glass fl-icon-btn" data-a="reload" aria-label="רענון" data-testid="fl-btn-reload">${ico('undo')}</button>
        </div>
      </section>
      <div class="seg fl-seg" role="tablist" aria-label="מיון">
        ${[['legacy', 'מורשת'], ['goals', 'שערים'], ['week', 'השבוע']].map(([k, he]) => `<button type="button" class="seg-btn${sort === k ? ' on' : ''}" role="tab" aria-selected="${sort === k}" data-sort="${k}" data-testid="fl-sort-${k}">${he}</button>`).join('')}
      </div>
      <div class="fl-table${manage ? ' managing' : ''}" role="table" aria-label="${esc(L.nameHe)}" data-testid="fl-table">
        <div class="fl-tr fl-th" role="row"><span role="columnheader">#</span><span role="columnheader" class="fl-th-name">שחקן</span>
          <span role="columnheader">דירוג</span><span role="columnheader" class="${sort === 'goals' ? 'on' : ''}">שערים</span><span role="columnheader">🏆</span><span role="columnheader" class="${sort !== 'goals' ? 'on' : ''}">${metricHe}</span></div>
        ${rows.length ? rows.map((m) => rowMember(m)).join('') : `<div class="fl-none">עוד אין משתתפים</div>`}
      </div>
      ${L.stale ? `<p class="note warn small" data-testid="fl-stale">${esc(T('אין חיבור כרגע. מוצגת הטבלה האחרונה ששמרנו'))} (${esc('עודכנה ' + ago(L.cachedAt || L.at || Date.now()))})</p>` : ''}
      ${!L.isMember ? `<a class="btn btn-gold btn-lg fl-joinbar" href="#/friends/join?code=${esc(L.code)}" data-testid="fl-btn-join">${esc(T('הצטר{{ף|פי}} לליגה'))}</a>` : ''}
      <div class="fl-foot">
        ${L.isOwner ? `<button type="button" class="btn btn-ghost btn-sm" data-a="rename" data-testid="fl-btn-rename">${ico('pen')}שינוי שם</button>
          <button type="button" class="btn btn-ghost btn-sm${manage ? ' on' : ''}" data-a="manage" data-testid="fl-btn-manage">${ico('users')}${manage ? 'סיום ניהול' : 'ניהול משתתפים'}</button>` : ''}
        ${L.isMember || L.isOwner ? `<button type="button" class="btn btn-ghost btn-sm fl-leave" data-a="leave" data-testid="fl-btn-leave">${ico('wave')}יציאה מהליגה</button>` : ''}
      </div>
    </div>`;
  };
  function rowMember(m) {
    const metric = sort === 'week' ? m.weekGoals : m.legacy;
    const canRemove = manage && L.isOwner && !m.isMe;
    return `<div class="fl-tr${m.isMe ? ' me' : ''}${m.pos <= 3 ? ' top' : ''}" role="row" data-testid="fl-row-${esc(m.pos)}">
      <span role="cell">${rankChip(m.pos)}</span>
      <span role="cell" class="fl-td-name"><span class="fl-crest" aria-hidden="true">${memberCrest(m, 30)}</span>
        <span class="fl-who"><b><span class="fl-nm">${esc(m.name)}</span>${m.owner ? `<i class="fl-owner" title="${esc(T('{{מנהל|מנהלת}} הליגה'))}">${ico('star')}</i>` : ''}${m.isMe ? `<i class="fl-me-tag">${esc(T('את{{ה|}}'))}</i>` : ''}</b>
        <small>${flag(m.nation) ? `<span class="fl-flag">${flag(m.nation)}</span>` : ''}${esc(m.clubHe || '')}</small></span></span>
      <span role="cell" class="num fl-ovr">${esc(m.ovr || '-')}</span>
      <span role="cell" class="num${sort === 'goals' ? ' on' : ''}">${esc(num(m.goals))}</span>
      <span role="cell" class="num fl-tro">${esc(m.trophies)}</span>
      <span role="cell" class="num fl-metric${sort !== 'goals' ? ' on' : ''}">${canRemove
        ? `<button type="button" class="fl-x" data-a="remove" data-hash="${esc(m.hash)}" data-name="${esc(m.name)}" aria-label="הסרת ${esc(m.name)}" data-testid="fl-remove-${esc(m.pos)}">${ico('cross')}</button>`
        : esc(num(metric))}</span>
    </div>`;
  }
  const load = async () => {
    loading = true;
    const r = await F.getLeague(code);
    loading = false;
    if (!alive) return;
    if (r.ok) { L = r; error = null; if (!r.stale) F.markSeen(code, r); }
    else { error = r; if (r.error === 'not_found') L = null; }
    draw();
  };
  draw();
  load();

  const onClick = async (e) => {
    const s = e.target.closest('[data-sort]');
    if (s) { sort = s.dataset.sort; draw(); return; }
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'reload') { if (!loading) { b.classList.add('spin'); await load(); } return; }
    if (!L) return;
    if (a === 'invite') { openInvite({ code: L.code, nameHe: L.nameHe }); return; }
    if (a === 'manage') { manage = !manage; draw(); return; }
    if (a === 'rename') { openRename(L, (nameHe) => { L = { ...L, nameHe }; draw(); }); return; }
    if (a === 'remove') {
      const yes = await confirmDialog({ title: 'להסיר את ' + b.dataset.name + '?', text: T('המשתתף יוסר מהטבלה. אפשר להזמין אותו שוב עם הקישור.'), yes: 'הסרה', danger: true });
      if (!yes) return;
      const r = await F.ownerRemove(L.code, b.dataset.hash);
      if (!r.ok) { toast(r.messageHe); return; }
      toast('הוסר מהליגה ✓', { tone: 'good' });
      await load();
      return;
    }
    if (a === 'leave') {
      const yes = await confirmDialog({
        title: 'לצאת מהליגה?',
        text: L.isOwner ? T('{{אתה מנהל|את מנהלת}} את הליגה. אחרי היציאה הניהול יעבור למשתתף הוותיק ביותר.') : T('אפשר לחזור בכל רגע עם קישור ההזמנה.'),
        yes: 'יציאה', danger: true,
      });
      if (!yes) return;
      const r = await F.leaveLeague(L.code);
      if (!r.ok) { toast(r.messageHe); return; }
      toast(T('יצאת מהליגה'), { tone: 'good' });
      location.hash = '#/friends';
    }
  };
  root.addEventListener('click', onClick);
  return () => { alive = false; root.removeEventListener('click', onClick); };
}

function openRename(L, done) {
  const close = openModal(`<div class="fl-sheet" data-testid="fl-rename">
      <h2 class="modal-title">${ico('pen', 'gold')} שינוי שם הליגה</h2>
      <label class="field"><span>שם חדש</span>
        <input type="text" name="name" maxlength="${F.NAME_MAX}" autocomplete="off" value="${esc(L.nameHe)}" data-testid="fl-rename-name" autofocus></label>
      <p class="fl-err" role="alert" hidden></p>
      <div class="btn-col">
        <button type="button" class="btn btn-gold btn-lg" data-a="go" data-testid="fl-rename-go">שמירה</button>
        <button type="button" class="btn btn-ghost" data-close>ביטול</button>
      </div></div>`, { sheet: true, testid: 'fl-rename-sheet', label: 'שינוי שם הליגה' });
  const el = close.el;
  const input = el.querySelector('input');
  const go = async () => {
    const btn = el.querySelector('[data-a="go"]');
    const bad = F.checkLeagueName(input.value);
    if (bad) { sheetError(el, F.messageFor(bad)); return; }
    busy(btn, true);
    const r = await F.ownerRename(L.code, input.value);
    busy(btn, false);
    if (!r.ok) { sheetError(el, r.messageHe); return; }
    close();
    toast('השם עודכן ✓', { tone: 'good' });
    done(r.nameHe);
  };
  el.addEventListener('click', (e) => { if (e.target.closest('[data-a="go"]')) go(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
}

// ======================================================================
// 3. The join card (invitation link)
// ======================================================================
function renderJoin(root, params) {
  let alive = true;
  const code = F.normCode(params.code || F.getPendingJoin() || '');
  if (!code) {
    root.innerHTML = `<div class="fl fl-join" data-testid="friends-join-nocode"><div class="fl-empty"><div class="fl-empty-art" aria-hidden="true"><span>🔑</span></div>
      <p>${esc(T('צריך קוד ליגה כדי להצטרף.'))}</p><div class="btn-row"><button type="button" class="btn btn-gold" data-a="code">יש לי קוד</button><a class="btn btn-glass" href="#/friends">הליגות שלי</a></div></div></div>`;
    const h = (e) => { if (e.target.closest('[data-a="code"]')) openCodeEntry(); };
    root.addEventListener('click', h);
    return () => root.removeEventListener('click', h);
  }
  root.innerHTML = `<div class="fl fl-join" data-testid="friends-join-loading"><div class="loading-line">טוען את ההזמנה...</div></div>`;
  let L = null;
  let careers = [];
  let pick = null;
  const draw = () => {
    if (!alive) return;
    if (!L.ok) {
      root.innerHTML = `<div class="fl fl-join" data-testid="friends-join-error"><div class="fl-empty"><div class="fl-empty-art" aria-hidden="true"><span>🔎</span></div>
        <p>${esc(L.messageHe || F.messageFor('server'))}</p>
        <div class="btn-row">${L.offline ? '<button type="button" class="btn btn-gold" data-a="retry">נסה שוב</button>' : ''}<a class="btn btn-glass" href="#/friends">הליגות שלי</a></div></div></div>`;
      return;
    }
    const top = L.members.slice(0, 3);
    const podium = [top[1], top[0], top[2]].map((m, i) => (m ? `<div class="fl-pod p${m.rank}">
        <span class="fl-pod-crest" aria-hidden="true">${memberCrest(m, i === 1 ? 44 : 36)}</span>
        <span class="fl-pod-medal" aria-hidden="true">${MEDAL[m.rank]}</span>
        <b>${esc(m.name)}</b><small class="num">${esc(num(m.legacy))}</small>
        <span class="fl-pod-step"><span class="num">${esc(m.rank)}</span></span></div>` : `<div class="fl-pod empty p${[2, 1, 3][i]}"><span class="fl-pod-step"></span></div>`)).join('');
    const free = Math.max(0, L.max - L.count);
    const already = L.isMember;
    const chosen = careers.find((c) => c.summary.careerId === pick) || careers[0] || null;
    let action;
    if (already) {
      action = `<p class="fl-join-note good">${esc(T('{{אתה|את}} כבר בליגה הזאת ✓'))}</p>
        <a class="btn btn-gold btn-lg" href="#/friends/${esc(L.code)}" data-testid="fl-join-open">לטבלה</a>`;
    } else if (!careers.length) {
      action = `<p class="fl-join-note">${esc(F.messageFor('no_career'))}</p>
        <a class="btn btn-gold btn-lg" href="#/new" data-testid="fl-join-newcareer">פתיחת קריירה</a>`;
    } else if (free === 0) {
      action = `<p class="fl-join-note warn">${esc(F.messageFor('full'))}</p>`;
    } else {
      action = `${careers.length > 1 ? `<div class="fl-cars" role="radiogroup" aria-label="עם איזו קריירה להצטרף?" data-testid="fl-join-careers">
          <p class="fl-cars-q">${esc(T('עם איזו קריירה {{תצטרף|תצטרפי}}?'))}</p>
          ${careers.map((c) => `<label class="fl-car${c === chosen ? ' on' : ''}">
            <input type="radio" name="fl-car" value="${esc(c.summary.careerId)}"${c === chosen ? ' checked' : ''}>
            <span class="fl-crest" aria-hidden="true">${memberCrest(c.summary, 30)}</span>
            <span class="fl-who"><b><span class="fl-nm">${esc(c.summary.name)}</span></b><small>${esc(c.summary.clubHe || '')}${c.slot ? ` · משבצת ${esc(c.slot)}` : ''}</small></span>
            <span class="fl-car-ovr num">${esc(c.summary.ovr || '')}</span></label>`).join('')}
        </div>` : ''}
        <button type="button" class="btn btn-gold btn-xl" data-a="join" data-testid="fl-join-go">${esc(T('הצטר{{ף|פי}} לליגה'))}</button>`;
    }
    root.innerHTML = `<div class="fl fl-join" data-testid="friends-join">
      <section class="fl-invcard">
        <div class="fl-ribbon">${esc(T('הוזמנת לליגת חברים!'))}</div>
        <span class="fl-inv-crest" aria-hidden="true">${leagueCrest(L.code, L.nameHe, 76)}</span>
        <h2 class="fl-inv-name" data-testid="fl-join-name">${esc(L.nameHe)}</h2>
        <p class="fl-inv-meta"><span class="num">${esc(L.count)}</span> משתתפים · ${free ? `עוד <span class="num">${esc(free)}</span> מקומות` : 'הליגה מלאה'}</p>
        ${top.length ? `<div class="fl-podium" data-testid="fl-join-podium">${podium}</div>`
          : `<p class="fl-inv-first">${esc(T('עוד אין משתתפים. {{תהיה הראשון|תהיי הראשונה}}!'))}</p>`}
        <div class="fl-join-act">${action}</div>
        <p class="fl-err" role="alert" hidden></p>
        <a class="fl-later" href="#/friends" data-a="later">לא עכשיו</a>
      </section>
    </div>`;
  };
  const load = async () => {
    const [r, cs] = await Promise.all([F.getLeague(code), listCareers()]);
    if (!alive) return;
    L = r;
    careers = cs;
    if (!pick && careers.length) pick = (careers.find((c) => c.current) || careers[0]).summary.careerId;
    draw();
  };
  load();
  const onClick = async (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    if (b.dataset.a === 'retry') { root.innerHTML = '<div class="fl fl-join"><div class="loading-line">טוען את ההזמנה...</div></div>'; load(); return; }
    if (b.dataset.a === 'later') { F.clearPendingJoin(); return; }
    if (b.dataset.a !== 'join' || b.disabled) return;
    const c = careers.find((x) => x.summary.careerId === pick) || careers[0];
    if (!c) return;
    busy(b, true);
    const r = await F.joinLeague(code, c.current ? {} : { summary: c.summary });
    busy(b, false);
    if (!alive) return;
    if (!r.ok) { sheetError(root, r.messageHe); return; }
    toast(T(r.league.already ? '{{אתה|את}} כבר בליגה ✓' : 'הצטרפת לליגה! בהצלחה ⚽'), { tone: 'good' });
    location.hash = '#/friends/' + code;
  };
  const onChange = (e) => {
    const inp = e.target.closest('input[name="fl-car"]');
    if (!inp) return;
    pick = inp.value;
    for (const lab of root.querySelectorAll('.fl-car')) lab.classList.toggle('on', lab.contains(inp));
  };
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  return () => { alive = false; root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); };
}

// ======================================================================
// 4. Hub notices
// ======================================================================
const PRIO = { invite: 0, overtaken: 1, top: 2, up: 3, joined: 4 };
/**
 * Hebrew notices for the hub alerts, from the cached tables vs the ranks seen last time (sync, never throws):
 * [{id, kind:'invite'|'overtaken'|'top'|'up'|'joined', code, textHe, href, tone}]. Opening the table marks it seen;
 * dismissFriendsNotices() marks everything seen. Keep the tables fresh with friends.refreshLeagues() (core) on boot.
 */
export function friendsNotices({ max = 3 } = {}) {
  try {
    const out = [];
    const pending = F.getPendingJoin();
    if (pending && !F.myLeagues().some((l) => l.code === pending)) {
      out.push({ id: 'fl_inv_' + pending, kind: 'invite', code: pending, textHe: T('הוזמנת לליגת חברים! לח{{ץ|צי}} כדי להצטרף ⚽'), href: '#/friends/join?code=' + pending, tone: 'good' });
    }
    for (const lg of F.leagueChanges()) {
      const nm = lg.nameHe;
      for (const c of lg.changes) {
        let t = '';
        if (c.kind === 'overtaken') t = `${c.name} ${gBy(c.gender, 'עקף', 'עקפה')} אותך בליגה '${nm}'!`;
        else if (c.kind === 'top') t = `עלית למקום הראשון בליגה '${nm}'! 🥇`;
        else if (c.kind === 'up') t = `טיפסת למקום ${c.rank} בליגה '${nm}'`;
        else if (c.kind === 'joined') t = `${c.name} ${gBy(c.gender, 'הצטרף', 'הצטרפה')} לליגה '${nm}'`;
        if (!t) continue;
        out.push({ id: 'fl_' + lg.code + '_' + c.kind + '_' + (c.name || c.rank || ''), kind: c.kind, code: lg.code, textHe: t, href: '#/friends/' + lg.code, tone: c.kind === 'overtaken' ? 'warn' : 'good' });
      }
    }
    out.sort((a, b) => PRIO[a.kind] - PRIO[b.kind]);
    const seen = new Set();
    return out.filter((n) => (seen.has(n.id) ? false : seen.add(n.id))).slice(0, Math.max(1, max));
  } catch { return []; }
}
/** The player dismissed the friends notices: the latest cached tables become the new baseline. */
export function dismissFriendsNotices() { F.markAllSeen(); }
