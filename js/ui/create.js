// create.js: #/new career wizard (name -> nation -> position/foot -> academy -> slot + summary).
import * as game from '../engine/game.js';
import * as save from '../core/save.js';
import { esc } from './dom.js';
import { ctx, call, toast, openModal, setHeader } from './app.js';
import { navigate } from './router.js';
import { badge, stars, attrRow, ovrCircle } from './components.js';

// Pitch layout (percent from left / top). Attack is up. LB on the left of the pitch, RB on the right.
const PITCH = {
  ST: [50, 10], LW: [16, 20], RW: [84, 20], CAM: [50, 32], CM: [50, 48], CDM: [50, 63],
  LB: [14, 70], CB: [50, 78], RB: [86, 70], GK: [50, 92],
};

export function render(root, params = {}) {
  let opts;
  try { opts = game.getCreateOptions({ seed: Date.now() >>> 0 }); } catch (e) { throw e; }
  const st = {
    step: 1,
    first: '', last: '', nick: '',
    nation: (opts.nations[0] && opts.nations[0].id) || 'isr',
    pos: null, foot: 'R', club: null, group: 0, q: '',
    slot: [1, 2, 3].includes(Number(params.slot)) ? Number(params.slot) : null,
    slots: null,
  };
  let academy = null;
  const TOTAL = 5;

  save.listSlots().then((s) => {
    st.slots = s;
    if (!st.slot) {
      const emptyS = s.find((x) => x.empty && !x.corrupt && !x.tooNew);
      st.slot = emptyS ? emptyS.slot : null;
    }
    if (st.step === 5) draw();
  }).catch(() => { st.slots = [1, 2, 3].map((n) => ({ slot: n, empty: true })); if (!st.slot) st.slot = 1; });

  function loadAcademy() {
    if (academy && academy.nation === st.nation) return academy.data;
    const data = game.getAcademyOptions(st.nation);
    academy = { nation: st.nation, data };
    st.group = 0;
    return data;
  }

  function stepHeader() {
    const names = ['השם שלך', 'המדינה', 'העמדה', 'האקדמיה', 'יוצאים לדרך'];
    return `<div class="wiz-head"><div class="wiz-steps">${names.map((n, i) => `<span class="wiz-dot${i + 1 === st.step ? ' on' : i + 1 < st.step ? ' done' : ''}"></span>`).join('')}</div>
      <h2 class="wiz-title">${esc(names[st.step - 1])}</h2><span class="muted small">שלב ${st.step} מתוך ${TOTAL}</span></div>`;
  }

  function step1() {
    return `<div class="card">
      <label class="field"><span>שם פרטי</span><input id="f-first" data-testid="inp-first" maxlength="20" autocomplete="off" value="${esc(st.first)}" placeholder="למשל: יוסי"></label>
      <label class="field"><span>שם משפחה</span><input id="f-last" data-testid="inp-last" maxlength="20" autocomplete="off" value="${esc(st.last)}" placeholder="למשל: אזולאי"></label>
      <label class="field"><span>כינוי (לא חובה)</span><input id="f-nick" data-testid="inp-nick" maxlength="16" autocomplete="off" value="${esc(st.nick)}" placeholder="איך קוראים לך בשכונה?"></label>
      <div class="chips">${(opts.nicknames || []).map((n) => `<button type="button" class="chip chip-btn${st.nick === n ? ' on' : ''}" data-act="nick" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div>
    </div>`;
  }

  function step2() {
    const q = st.q.trim();
    const list = opts.nations.filter((n) => !q || n.nameHe.includes(q));
    return `<div class="card">
      <label class="field"><span>חיפוש</span><input id="f-q" type="search" value="${esc(st.q)}" placeholder="חפש מדינה..." autocomplete="off"></label>
      <div class="nation-grid">${list.map((n) => `<button type="button" class="nation${n.id === st.nation ? ' on' : ''}" data-act="nation" data-v="${esc(n.id)}" data-testid="nation-${esc(n.id)}">
        <span class="flag">${esc(n.flag)}</span><span class="nname">${esc(n.nameHe)}</span>${n.hasLeague ? '' : '<small class="muted">בלי ליגה</small>'}</button>`).join('') || '<p class="muted">לא נמצאה מדינה</p>'}</div>
    </div>`;
  }

  function step3() {
    const sel = opts.positions.find((p) => p.id === st.pos);
    return `<div class="card">
      <div class="pitch" aria-label="בחר עמדה">
        <div class="pitch-lines"><i class="pl-mid"></i><i class="pl-circle"></i><i class="pl-box top"></i><i class="pl-box bottom"></i></div>
        ${opts.positions.map((p) => { const xy = PITCH[p.id] || [50, 50]; return `<button type="button" class="pos-dot${p.id === st.pos ? ' on' : ''}" style="left:${xy[0]}%;top:${xy[1]}%" data-act="pos" data-v="${esc(p.id)}" data-testid="pos-${esc(p.id)}" aria-label="${esc(p.he)}"><b>${esc(p.id)}</b><small>${esc(p.short)}</small></button>`; }).join('')}
      </div>
      <div class="pos-desc">${sel ? `<b>${esc(sel.he)}</b><p class="muted">${esc(sel.desc || '')}</p>` : '<p class="muted">גע בעמדה במגרש כדי לבחור</p>'}</div>
      <h3 class="sub">רגל חזקה</h3>
      <div class="seg">${opts.feet.map((f) => `<button type="button" class="seg-btn${f.id === st.foot ? ' on' : ''}" data-act="foot" data-v="${esc(f.id)}" data-testid="foot-${esc(f.id)}">${esc(f.he)}</button>`).join('')}</div>
    </div>`;
  }

  function step4() {
    const data = loadAcademy();
    const groups = data.groups || [];
    const g = groups[st.group] || groups[0];
    return `<div class="card">
      ${data.nationHasLeague ? '' : '<p class="note">למדינה שבחרת אין ליגה במשחק, אז אפשר להתחיל באקדמיה של כל ליגה. הנבחרת שלך תישאר המדינה שבחרת.</p>'}
      ${groups.length > 1 ? `<div class="chips wrap">${groups.map((x, i) => `<button type="button" class="chip chip-btn${i === st.group ? ' on' : ''}" data-act="group" data-v="${i}">${esc(x.flag || '')} ${esc(x.leagueHe)}</button>`).join('')}</div>` : ''}
      ${g ? `<h3 class="sub">${esc(g.flag || '')} ${esc(g.leagueHe)} <span class="muted small">${esc(g.countryHe || '')}</span></h3>
      <div class="club-list">${g.clubs.map((c) => `<button type="button" class="club${c.id === st.club ? ' on' : ''}" data-act="club" data-v="${esc(c.id)}" data-testid="club-${esc(c.id)}">
        ${badge(c)}<span class="grow"><b>${esc(c.nameHe)}</b><small class="muted">${esc(c.city || '')}</small></span>
        <span class="club-stars" title="איכות האקדמיה">${stars(c.academyStars, 'איכות האקדמיה')}</span></button>`).join('')}</div>` : '<p class="muted">אין קבוצות להצגה</p>'}
    </div>`;
  }

  function findClub() {
    const data = loadAcademy();
    for (const g of data.groups || []) for (const c of g.clubs) if (c.id === st.club) return { c, g };
    return null;
  }

  function step5() {
    const n = opts.nations.find((x) => x.id === st.nation);
    const p = opts.positions.find((x) => x.id === st.pos);
    const fc = findClub();
    const f = opts.feet.find((x) => x.id === st.foot);
    const slots = st.slots || [];
    return `<div class="card summary">
      <div class="sum-name"><b>${esc(st.first)} ${esc(st.last)}</b>${st.nick ? ` <span class="muted">"${esc(st.nick)}"</span>` : ''}</div>
      <div class="kv"><span>מדינה</span><b>${esc(n ? n.flag + ' ' + n.nameHe : '')}</b></div>
      <div class="kv"><span>עמדה</span><b>${esc(p ? p.he : '')}</b></div>
      <div class="kv"><span>רגל</span><b>${esc(f ? f.he : '')}</b></div>
      <div class="kv"><span>אקדמיה</span><b>${esc(fc ? fc.c.nameHe : '')}</b></div>
      <div class="kv"><span>גיל</span><b>15</b></div>
    </div>
    <div class="card">
      <h3 class="sub">באיזו משבצת לשמור?</h3>
      <div class="slot-pick">${slots.map((s) => `<button type="button" class="slot-chip${s.slot === st.slot ? ' on' : ''}" data-act="slot" data-v="${s.slot}" data-testid="new-slot-${s.slot}">
        <b class="num">${s.slot}</b><small>${s.empty && !s.corrupt ? 'ריקה' : esc((s.meta && s.meta.name) || 'תפוסה')}</small></button>`).join('') || '<span class="muted">טוען...</span>'}</div>
      ${(() => { const s = slots.find((x) => x.slot === st.slot); return s && (!s.empty || s.corrupt) ? '<p class="note warn">המשבצת תפוסה. הקריירה הקיימת תישמר כעותק שאפשר לשחזר מהתפריט של המשבצת.</p>' : ''; })()}
    </div>
    <button type="button" class="btn btn-primary btn-xl" data-act="start" data-testid="btn-start" ${st.slot ? '' : 'disabled'}>צא לדרך! ⚽</button>`;
  }

  function draw() {
    const body = [step1, step2, step3, step4, step5][st.step - 1]();
    root.innerHTML = `<div class="wizard">${stepHeader()}${body}
      ${st.step < 5 ? `<div class="wiz-nav">
        ${st.step > 1 ? '<button type="button" class="btn btn-ghost" data-act="prev">חזרה</button>' : '<span></span>'}
        <button type="button" class="btn btn-primary" data-act="next" data-testid="btn-next">המשך ←</button></div>`
        : '<div class="wiz-nav"><button type="button" class="btn btn-ghost" data-act="prev">חזרה</button><span></span></div>'}
    </div>`;
    if (st.step === 1) {
      const f = root.querySelector('#f-first');
      if (f && !st.first) setTimeout(() => { try { f.focus({ preventScroll: true }); } catch { /* ignore */ } }, 60);
    }
    setHeader({ back: '#/title' });
  }

  function readInputs() {
    if (st.step !== 1) return;
    const v = (id) => (root.querySelector(id) || {}).value || '';
    st.first = v('#f-first');
    st.last = v('#f-last');
    st.nick = v('#f-nick');
  }

  function validate() {
    if (st.step === 1) {
      readInputs();
      const f = st.first.trim(), l = st.last.trim();
      if (!f || f.length > 20) return 'כתוב שם פרטי (עד 20 תווים)';
      if (!l || l.length > 20) return 'כתוב שם משפחה (עד 20 תווים)';
      if (st.nick.trim().length > 16) return 'הכינוי ארוך מדי';
    }
    if (st.step === 2 && !st.nation) return 'בחר מדינה';
    if (st.step === 3 && !st.pos) return 'בחר עמדה במגרש';
    if (st.step === 4 && !findClub()) return 'בחר אקדמיה';
    return null;
  }

  root.addEventListener('input', (e) => {
    if (e.target.id === 'f-q') {
      st.q = e.target.value;
      const grid = root.querySelector('.nation-grid');
      const tmp = document.createElement('div');
      tmp.innerHTML = step2();
      const ng = tmp.querySelector('.nation-grid');
      if (grid && ng) grid.replaceWith(ng);
    } else if (st.step === 1) readInputs();
  });

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && st.step === 1 && e.target.tagName === 'INPUT') {
      e.preventDefault();
      const next = root.querySelector('[data-act="next"]');
      if (next) next.click();
    }
  });

  let starting = false;
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b)) return;
    const act = b.dataset.act, v = b.dataset.v;
    if (act === 'nick') { readInputs(); st.nick = v; draw(); }
    else if (act === 'nation') { st.nation = v; st.club = null; draw(); }
    else if (act === 'pos') { st.pos = v; draw(); }
    else if (act === 'foot') { st.foot = v; draw(); }
    else if (act === 'group') { st.group = Number(v) || 0; draw(); }
    else if (act === 'club') { st.club = v; for (const x of root.querySelectorAll('.club')) x.classList.toggle('on', x.dataset.v === v); }
    else if (act === 'slot') { st.slot = Number(v); draw(); }
    else if (act === 'prev') { readInputs(); st.step = Math.max(1, st.step - 1); draw(); }
    else if (act === 'next') {
      const err = validate();
      if (err) { toast(err); return; }
      st.step = Math.min(TOTAL, st.step + 1);
      draw();
      try { window.scrollTo(0, 0); } catch { /* ignore */ }
    } else if (act === 'start') {
      if (starting) return;
      if (!st.slot) { toast('בחר משבצת'); return; }
      starting = true;
      b.disabled = true;
      const res = await ctx.hooks.startNewCareer({
        first: st.first.trim(), last: st.last.trim(), nick: st.nick.trim(),
        nation: st.nation, pos: st.pos, foot: st.foot, club: st.club,
      }, st.slot);
      starting = false;
      if (!res || !res.ok) { b.disabled = false; toast((res && res.messageHe) || 'לא הצלחנו ליצור את הקריירה'); return; }
      showScout(res.report);
    }
  });

  draw();
}

function showScout(r) {
  if (!r) { navigate('#/hub'); return; }
  const close = openModal(`
    <div class="scout-head"><span class="muted small">דו״ח סקאוט</span>
      <h2 class="modal-title">${esc(r.name)}${r.nick ? ` <span class="muted">"${esc(r.nick)}"</span>` : ''}</h2>
      <div class="small">${esc(r.flag || '')} ${esc(r.nationHe || '')} · ${esc(r.posHe || '')} · רגל ${esc(r.footHe || '')} · גיל ${esc(r.age)}</div>
      <div class="small muted">${esc(r.clubHe || '')}</div></div>
    <div class="scout-top">${ovrCircle(r.ovr, { size: 'l' })}<div><div class="muted small">פוטנציאל</div>${stars(r.potStars)}<div class="muted small num" dir="ltr">${esc((r.potRange || []).join('-'))}</div></div></div>
    <div class="attrs">${(r.attrs || []).map(attrRow).join('')}</div>
    <p class="scout-text">${esc(r.textHe || '')}</p>
    <button type="button" class="btn btn-primary btn-lg" data-testid="btn-scout-ok" data-close>יאללה, לאימון הראשון!</button>`,
  { testid: 'scout-report', dismissible: false, onClose: () => navigate('#/hub') });
  return close;
}
