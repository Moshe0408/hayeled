// create.js: #/new career wizard (gender -> name -> look -> nation -> position/foot -> academy -> summary + slot).
import * as game from '../engine/game.js';
import * as save from '../core/save.js';
import { esc } from './dom.js';
import { ctx, call, toast, openModal, setHeader } from './app.js';
import { navigate } from './router.js';
import { badge, stars, attrRow, ovrCircle, playerCard, avatarFor, nationTeam, shirtNumber } from './components.js';
import { avatarSVG, avatarLooks } from './ext.js';
import { gBy, gtext } from './gender.js';
import { mountTilt } from './fx.js';
import { BACKEND_ENABLED } from '../config.js';

// Pitch layout (percent from left / top). Attack is up. LB on the left of the pitch, RB on the right.
const PITCH = {
  ST: [50, 10], LW: [16, 20], RW: [84, 20], CAM: [50, 32], CM: [50, 48], CDM: [50, 63],
  LB: [14, 70], CB: [50, 78], RB: [86, 70], GK: [50, 92],
};
const PH = {
  m: { first: 'למשל: יוסי', last: 'למשל: אזולאי', nick: 'איך קוראים לך בשכונה?' },
  f: { first: 'למשל: נועה', last: 'למשל: אזולאי', nick: 'איך קוראים לך בשכונה?' },
};
const STEP_NAMES = ['מי {{אתה|את}}?', 'השם שלך', 'המראה שלך', 'המדינה', 'העמדה', 'האקדמיה', '{{יוצאים|יוצאות}} לדרך'];
const TOTAL = STEP_NAMES.length;

export function render(root, params = {}) {
  const seed = Date.now() >>> 0;
  let opts = game.getCreateOptions({ seed });
  const st = {
    step: 1,
    gender: null,
    first: '', last: '', nick: '',
    skin: 1, hair: 0, hairColor: 1,
    nation: (opts.nations[0] && opts.nations[0].id) || 'isr',
    pos: null, foot: 'R', club: null, group: 0, q: '',
    slot: [1, 2, 3].includes(Number(params.slot)) ? Number(params.slot) : null,
    slots: null,
  };
  let academy = null;
  let untilt = () => {};
  const G = (m, f) => gBy(st.gender, m, f);
  const T = (s) => gtext(s, st.gender || 'm');

  save.listSlots().then((s) => {
    st.slots = s;
    if (!st.slot) {
      const emptyS = s.find((x) => x.empty && !x.corrupt && !x.tooNew);
      st.slot = emptyS ? emptyS.slot : null;
    }
    if (st.step === TOTAL) draw();
  }).catch(() => { st.slots = [1, 2, 3].map((n) => ({ slot: n, empty: true })); if (!st.slot) st.slot = 1; });

  function setGender(gd) {
    if (st.gender === gd) return;
    st.gender = gd;
    try { opts = game.getCreateOptions({ seed, gender: gd }) || opts; } catch { /* keep */ }
    if (st.nick && !(opts.nicknames || []).includes(st.nick)) { /* keep a custom nickname */ }
    st.hair = 0;
  }

  function loadAcademy() {
    const gd = st.gender === 'f' ? 'f' : 'm';
    if (academy && academy.nation === st.nation && academy.gender === gd) return academy.data;
    const data = game.getAcademyOptions(st.nation, { gender: gd });
    academy = { nation: st.nation, gender: gd, data };
    st.group = 0;
    return data;
  }

  function findClub() {
    const data = loadAcademy();
    for (const g of data.groups || []) for (const c of g.clubs) if (c.id === st.club) return { c, g };
    return null;
  }

  function kit() {
    const fc = st.club ? findClub() : null;
    if (fc && fc.c.colors) return fc.c.colors;
    const n = nationTeam(st.nation);
    return n ? n.colors : ['#1d4ed8', '#ffffff'];
  }

  function avatar(o = {}) {
    try {
      return avatarSVG({ gender: st.gender || 'm', skin: st.skin, hair: st.hair, hairColor: st.hairColor, kitColors: kit(), number: shirtNumber(st.pos), size: 120, pose: 'full', ...o }) || '';
    } catch (e) { console.warn('[hayeled] avatar', e); return ''; }
  }

  function stepHeader() {
    return `<div class="wiz-head"><div class="wiz-steps">${STEP_NAMES.map((n, i) => `<span class="wiz-dot${i + 1 === st.step ? ' on' : i + 1 < st.step ? ' done' : ''}"></span>`).join('')}</div>
      <span class="wiz-count num">שלב ${st.step} מתוך ${TOTAL}</span>
      <h2 class="wiz-title">${esc(T(STEP_NAMES[st.step - 1]))}</h2></div>`;
  }

  /* ---------- 1: gender ---------- */
  function stepGender() {
    const cardG = (gd, he, sub) => `<button type="button" class="gcard${st.gender === gd ? ' on' : ''}" data-act="gender" data-v="${gd}" data-testid="gender-${gd}" aria-pressed="${st.gender === gd}">
        <span class="gcard-glow" aria-hidden="true"></span>
        <span class="gcard-art" aria-hidden="true">${avatarSVG({ gender: gd, skin: gd === 'f' ? 2 : 1, hair: 0, kitColors: gd === 'f' ? ['#E11D74', '#FFFFFF'] : ['#1D4ED8', '#FFFFFF'], number: gd === 'f' ? 10 : 9, size: 130, pose: 'full', bg: false })}</span>
        <span class="gcard-label"><b>${he}</b><small>${sub}</small></span>
        <span class="gcard-check" aria-hidden="true">✓</span>
      </button>`;
    return `<div class="gender-pick">
      ${cardG('m', 'בן', 'הילד מהשכונה')}
      ${cardG('f', 'בת', 'הילדה מהשכונה')}
    </div>
    <p class="muted small center">${st.gender === 'f' ? 'כדורגל נשים: אותם מועדונים ונבחרות, ליגות הנשים, ליגת האלופות לנשים, גביע העולם לנשים וכדור הזהב לנשים.' : st.gender === 'm' ? 'מהשכונה, דרך האקדמיה, ועד ליגת האלופות והמונדיאל.' : 'בחרו עם מי יוצאים לדרך. אפשר לשחק בכל אחת מהאפשרויות.'}</p>`;
  }

  /* ---------- 2: name ---------- */
  function stepName() {
    const ph = PH[st.gender === 'f' ? 'f' : 'm'];
    return `<div class="card">
      <label class="field"><span>שם פרטי</span><input id="f-first" data-testid="inp-first" maxlength="20" autocomplete="off" value="${esc(st.first)}" placeholder="${esc(ph.first)}"></label>
      <label class="field"><span>שם משפחה</span><input id="f-last" data-testid="inp-last" maxlength="20" autocomplete="off" value="${esc(st.last)}" placeholder="${esc(ph.last)}"></label>
      <label class="field"><span>כינוי (לא חובה)</span><input id="f-nick" data-testid="inp-nick" maxlength="16" autocomplete="off" value="${esc(st.nick)}" placeholder="${esc(ph.nick)}"></label>
      <div class="chips">${(opts.nicknames || []).map((n) => { const v = T(n); return `<button type="button" class="chip chip-btn${st.nick === v ? ' on' : ''}" data-act="nick" data-v="${esc(v)}">${esc(v)}</button>`; }).join('')}</div>
      ${BACKEND_ENABLED ? `<p class="muted small" data-testid="name-privacy-note">${esc('אפשר להמציא שם. השם של הדמות נשלח עם נתוני השימוש האנונימיים (אפשר לכבות בהגדרות).')}</p>` : ''}
    </div>`;
  }

  /* ---------- 3: look ---------- */
  function stepLook() {
    const L = avatarLooks(st.gender || 'm');
    return `<div class="look">
      <div class="look-stage"><i class="look-spot" aria-hidden="true"></i><div class="look-avatar" aria-hidden="true">${avatar({ size: 150 })}</div></div>
      <section class="card">
        <h3 class="card-title"><span>גוון עור</span></h3>
        <div class="swatches">${L.skins.map((c, i) => `<button type="button" class="swatch${st.skin === i ? ' on' : ''}" style="--sw:${esc(c)}" data-act="skin" data-v="${i}" data-testid="skin-${i}" aria-label="גוון ${i + 1}" aria-pressed="${st.skin === i}"></button>`).join('')}</div>
        <h3 class="card-title"><span>צבע שיער</span></h3>
        <div class="swatches hc">${L.hairColors.map((c, i) => `<button type="button" class="swatch hcol${st.hairColor === i ? ' on' : ''}" style="--sw:${esc(c)}" data-act="haircol" data-v="${i}" data-testid="haircol-${i}" aria-label="צבע ${i + 1}" aria-pressed="${st.hairColor === i}"></button>`).join('')}</div>
        <h3 class="card-title"><span>תסרוקת</span></h3>
        <div class="hair-grid">${L.hairs.map((h, i) => `<button type="button" class="hair-tile${st.hair === i ? ' on' : ''}" data-act="hair" data-v="${i}" data-testid="hair-${i}" aria-pressed="${st.hair === i}" aria-label="${esc(h || 'תסרוקת ' + (i + 1))}">
          <span class="ht-art" aria-hidden="true">${avatar({ hair: i, pose: 'portrait', size: 64 })}</span>${h ? `<small>${esc(h)}</small>` : ''}</button>`).join('')}</div>
      </section>
    </div>`;
  }

  /* ---------- 4: nation ---------- */
  function stepNation() {
    const q = st.q.trim();
    const list = opts.nations.filter((n) => !q || n.nameHe.includes(q));
    return `<div class="card">
      <label class="field"><span>חיפוש</span><input id="f-q" type="search" value="${esc(st.q)}" placeholder="${esc(T('חפש{{|י}} מדינה...'))}" autocomplete="off"></label>
      <div class="nation-grid">${list.map((n) => `<button type="button" class="nation${n.id === st.nation ? ' on' : ''}" data-act="nation" data-v="${esc(n.id)}" data-testid="nation-${esc(n.id)}">
        ${badge(nationTeam(n.id) || n, 'm')}<span class="nname">${esc(n.nameHe)}</span>${n.hasLeague ? '' : '<small class="muted">בלי ליגה</small>'}</button>`).join('') || '<p class="muted">לא נמצאה מדינה</p>'}</div>
    </div>`;
  }

  /* ---------- 5: position ---------- */
  function stepPos() {
    const sel = opts.positions.find((p) => p.id === st.pos);
    return `<div class="card">
      <div class="pitch" aria-label="${esc(T('בחר{{|י}} עמדה'))}">
        <div class="pitch-lines"><i class="pl-mid"></i><i class="pl-circle"></i><i class="pl-box top"></i><i class="pl-box bottom"></i></div>
        ${opts.positions.map((p) => { const xy = PITCH[p.id] || [50, 50]; return `<button type="button" class="pos-dot${p.id === st.pos ? ' on' : ''}" style="left:${xy[0]}%;top:${xy[1]}%" data-act="pos" data-v="${esc(p.id)}" data-testid="pos-${esc(p.id)}" aria-label="${esc(T(p.he))}"><b>${esc(p.id)}</b><small>${esc(T(p.short))}</small></button>`; }).join('')}
      </div>
      <div class="pos-desc">${sel ? `<b>${esc(T(sel.he))}</b><p class="muted">${esc(T(sel.desc || ''))}</p>` : `<p class="muted">${esc(T('גע{{|י}} בעמדה במגרש כדי לבחור'))}</p>`}</div>
      <h3 class="card-title"><span>רגל חזקה</span></h3>
      <div class="seg">${opts.feet.map((f) => `<button type="button" class="seg-btn${f.id === st.foot ? ' on' : ''}" data-act="foot" data-v="${esc(f.id)}" data-testid="foot-${esc(f.id)}">${esc(f.he)}</button>`).join('')}</div>
    </div>`;
  }

  /* ---------- 6: academy ---------- */
  function stepAcademy() {
    const data = loadAcademy();
    const groups = data.groups || [];
    const g = groups[st.group] || groups[0];
    return `<div class="card">
      ${data.nationHasLeague ? '' : `<p class="note">${esc(T('למדינה שבחרת אין ליגה במשחק, אז אפשר להתחיל באקדמיה של כל ליגה. הנבחרת שלך תישאר המדינה שבחרת.'))}</p>`}
      ${groups.length > 1 ? `<div class="chips wrap">${groups.map((x, i) => `<button type="button" class="chip chip-btn${i === st.group ? ' on' : ''}" data-act="group" data-v="${i}">${esc(T(x.leagueHe))}</button>`).join('')}</div>` : ''}
      ${g ? `<h3 class="card-title"><span>${esc(T(g.leagueHe))}</span><small class="muted">${esc(g.countryHe || '')}</small></h3>
      <div class="club-list">${g.clubs.map((c) => `<button type="button" class="club${c.id === st.club ? ' on' : ''}" data-act="club" data-v="${esc(c.id)}" data-testid="club-${esc(c.id)}">
        ${badge(c, 'l')}<span class="club-name"><b>${esc(c.nameHe)}</b><small class="muted">${esc(c.city || '')}</small></span>
        <span class="club-stars" title="איכות האקדמיה">${stars(c.academyStars, 'איכות האקדמיה')}</span></button>`).join('')}</div>` : '<p class="muted">אין קבוצות להצגה</p>'}
    </div>`;
  }

  /* ---------- 7: summary ---------- */
  function stepSummary() {
    const n = opts.nations.find((x) => x.id === st.nation);
    const p = opts.positions.find((x) => x.id === st.pos);
    const fc = findClub();
    const f = opts.feet.find((x) => x.id === st.foot);
    const slots = st.slots || [];
    const club = fc ? { ...fc.c } : null;
    const preview = playerCard({
      name: `${st.first} ${st.last}`, nick: st.nick, ovr: null, pos: st.pos, gender: st.gender,
      meta: { gender: st.gender, look: { skin: st.skin, hair: st.hair, hairColor: st.hairColor } }, club, nation: nationTeam(st.nation), gk: st.pos === 'GK',
      attrs: (st.pos === 'GK' ? ['div', 'han', 'kic', 'ref', 'pac', 'gkp'] : ['pac', 'sho', 'pas', 'dri', 'def', 'phy']).map((key) => ({ key, value: '?' })),
    }, { size: 'l' });
    return `<div class="sum-wrap">${preview}</div>
    <div class="card summary">
      <div class="sum-name"><b>${esc(st.first)} ${esc(st.last)}</b>${st.nick ? ` <span class="muted">"${esc(st.nick)}"</span>` : ''}</div>
      <div class="kv"><span>מדינה</span><b>${esc(n ? n.nameHe : '')}</b></div>
      <div class="kv"><span>עמדה</span><b>${esc(p ? T(p.he) : '')}</b></div>
      <div class="kv"><span>רגל</span><b>${esc(f ? f.he : '')}</b></div>
      <div class="kv"><span>אקדמיה</span><b>${esc(fc ? fc.c.nameHe : '')}</b></div>
      <div class="kv"><span>גיל</span><b>15</b></div>
    </div>
    <div class="card">
      <h3 class="card-title"><span>באיזו משבצת לשמור?</span></h3>
      <div class="slot-pick">${slots.map((s) => `<button type="button" class="slot-chip${s.slot === st.slot ? ' on' : ''}" data-act="slot" data-v="${s.slot}" data-testid="new-slot-${s.slot}">
        <b class="num">${s.slot}</b><small>${s.empty && !s.corrupt ? 'ריקה' : esc((s.meta && s.meta.name) || 'תפוסה')}</small></button>`).join('') || '<span class="muted">טוען...</span>'}</div>
      ${(() => { const s = slots.find((x) => x.slot === st.slot); return s && (!s.empty || s.corrupt) ? '<p class="note warn">המשבצת תפוסה. הקריירה הקיימת תישמר כעותק שאפשר לשחזר מהתפריט של המשבצת.</p>' : ''; })()}
    </div>
    <button type="button" class="btn btn-gold btn-xl" data-act="start" data-testid="btn-start" ${st.slot ? '' : 'disabled'}>${esc(G('יוצאים לדרך!', 'יוצאות לדרך!'))} ⚽</button>`;
  }

  function draw() {
    const body = [stepGender, stepName, stepLook, stepNation, stepPos, stepAcademy, stepSummary][st.step - 1]();
    untilt();
    root.innerHTML = `<div class="wizard wiz-s${st.step}">${stepHeader()}${body}
      ${st.step < TOTAL ? `<div class="wiz-nav">
        ${st.step > 1 ? '<button type="button" class="btn btn-ghost" data-act="prev">חזרה</button>' : '<span></span>'}
        <button type="button" class="btn btn-primary" data-act="next" data-testid="btn-next" ${st.step === 1 && !st.gender ? 'aria-disabled="true"' : ''}>המשך ←</button></div>`
        : '<div class="wiz-nav"><button type="button" class="btn btn-ghost" data-act="prev">חזרה</button><span></span></div>'}
    </div>`;
    if (st.step === 2) {
      const f = root.querySelector('#f-first');
      // don't steal focus if the player already tapped another field
      if (f && !st.first) setTimeout(() => { try { const a = document.activeElement; if (!a || a === document.body) f.focus({ preventScroll: true }); } catch { /* ignore */ } }, 60);
    }
    if (st.step === TOTAL) untilt = mountTilt(root);
    setHeader({ back: '#/title' });
  }

  function refreshLook() {
    const a = root.querySelector('.look-avatar');
    if (a) a.innerHTML = avatar({ size: 150 });
    for (const b of root.querySelectorAll('.swatch')) { const on = Number(b.dataset.v) === (b.dataset.act === 'haircol' ? st.hairColor : st.skin); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }
    for (const b of root.querySelectorAll('.hair-tile')) {
      const i = Number(b.dataset.v);
      const on = i === st.hair; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
      const art = b.querySelector('.ht-art');
      if (art) art.innerHTML = avatar({ hair: i, pose: 'portrait', size: 64 });
    }
  }

  function readInputs() {
    if (st.step !== 2) return;
    const v = (id) => (root.querySelector(id) || {}).value || '';
    st.first = v('#f-first');
    st.last = v('#f-last');
    st.nick = v('#f-nick');
  }

  function validate() {
    if (st.step === 1 && !st.gender) return 'בחרו: בן או בת';
    if (st.step === 2) {
      readInputs();
      const f = st.first.trim(), l = st.last.trim();
      if (!f || f.length > 20) return T('כתוב{{|י}} שם פרטי (עד 20 תווים)');
      if (!l || l.length > 20) return T('כתוב{{|י}} שם משפחה (עד 20 תווים)');
      if (st.nick.trim().length > 16) return 'הכינוי ארוך מדי';
    }
    if (st.step === 4 && !st.nation) return T('בחר{{|י}} מדינה');
    if (st.step === 5 && !st.pos) return T('בחר{{|י}} עמדה במגרש');
    if (st.step === 6 && !findClub()) return T('בחר{{|י}} אקדמיה');
    return null;
  }

  root.addEventListener('input', (e) => {
    if (e.target.id === 'f-q') {
      st.q = e.target.value;
      const grid = root.querySelector('.nation-grid');
      const tmp = document.createElement('div');
      tmp.innerHTML = stepNation();
      const ng = tmp.querySelector('.nation-grid');
      if (grid && ng) grid.replaceWith(ng);
    } else if (st.step === 2) readInputs();
  });

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && st.step === 2 && e.target.tagName === 'INPUT') {
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
    if (act === 'gender') { setGender(v); draw(); }
    else if (act === 'nick') { readInputs(); st.nick = v; draw(); }
    else if (act === 'skin') { st.skin = Number(v) || 0; refreshLook(); }
    else if (act === 'hair') { st.hair = Number(v) || 0; refreshLook(); }
    else if (act === 'haircol') { st.hairColor = Number(v) || 0; refreshLook(); }
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
      if (!st.slot) { toast('בחרו משבצת'); return; }
      starting = true;
      b.disabled = true;
      const res = await ctx.hooks.startNewCareer({
        first: st.first.trim(), last: st.last.trim(), nick: st.nick.trim(),
        nation: st.nation, pos: st.pos, foot: st.foot, club: st.club,
        gender: st.gender || 'm', look: { skin: st.skin, hair: st.hair, hairColor: st.hairColor },
      }, st.slot);
      starting = false;
      if (!res || !res.ok) { b.disabled = false; toast((res && res.messageHe) || 'לא הצלחנו ליצור את הקריירה'); return; }
      showScout(res.report, { gender: st.gender, look: { skin: st.skin, hair: st.hair, hairColor: st.hairColor }, kit: kit(), pos: st.pos });
    }
  });

  draw();
  return () => untilt();
}

function showScout(r, info = {}) {
  if (!r) { navigate('#/hub'); return; }
  const gd = info.gender || 'm';
  const T = (s) => gtext(s, gd);
  let meta = { gender: gd, look: info.look };
  try { meta = { ...game.getSaveMeta(), ...meta }; } catch { /* keep */ }
  const art = avatarFor(meta, { kitColors: info.kit, number: shirtNumber(info.pos), size: 96, pose: 'portrait' });
  const close = openModal(`
    <div class="scout-head"><span class="scout-tag">דו״ח סקאוט</span>
      <div class="scout-art" aria-hidden="true">${art}</div>
      <h2 class="modal-title">${esc(r.name)}${r.nick ? ` <span class="muted">"${esc(r.nick)}"</span>` : ''}</h2>
      <div class="small">${esc(r.nationHe || '')} · ${esc(T(r.posHe || ''))} · רגל ${esc(r.footHe || '')} · גיל ${esc(r.age)}</div>
      <div class="small muted">${esc(r.clubHe || '')}</div></div>
    <div class="scout-top">${ovrCircle(r.ovr, { size: 'l' })}<div><div class="muted small">פוטנציאל</div>${stars(r.potStars)}<div class="muted small num" dir="ltr">${esc((r.potRange || []).join('-'))}</div></div></div>
    <div class="attrs">${(r.attrs || []).map(attrRow).join('')}</div>
    <p class="scout-text">${esc(T(r.textHe || ''))}</p>
    <button type="button" class="btn btn-gold btn-lg" data-testid="btn-scout-ok" data-close>יאללה, לאימון הראשון!</button>`,
  { testid: 'scout-report', dismissible: false, cls: 'scout', onClose: () => navigate('#/hub') });
  return close;
}
