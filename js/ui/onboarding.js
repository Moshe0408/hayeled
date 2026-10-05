// onboarding.js (v2.3, F1 + F3): #/new FAST START in two steps, the debut coach-marks and the "ככה מתחילים אגדה" card.
//   step 1: boy / girl + name (or "🎲 שחקן אקראי" that fills everything)  ->  step 2: the youth-star card + "לבעיטת הפתיחה"
//   -> the career is created (game.quickCareer) and the first week is played at once: straight into the debut match.
// "התאמה מתקדמת" (#/new?adv=1) opens the full v2 wizard (create.js) for nation / position / foot / academy / look.
// Existing testids are kept (gender-m|f, inp-first, inp-last, inp-nick, btn-next, btn-start, new-slot-N).
import * as game from '../engine/game.js';
import * as save from '../core/save.js';
import * as STR from '../data/strings.js';
import { NAME_POOLS, NAME_POOLS_F, NICKNAMES, NICKNAMES_F } from '../data/names.js';
import { esc } from './dom.js';
import { ctx, svc, call, toast, openModal, setHeader, reducedMotion, buzz, clearToast } from './app.js';
import { navigate } from './router.js';
import { playerCard, nationTeam, badge } from './components.js';
import { avatarSVG } from './ext.js';
import { lookFromSeed as lookFromSeedRaw } from './avatar.js';
import { gBy, gtext } from './gender.js';
import { mountTilt } from './fx.js';
import { ico } from './icons.js';
import { BACKEND_ENABLED } from '../config.js';

/* ------------------------------------------------------------------ content (js/data/strings.js ONBOARDING, fallbacks) */
const OB_FB = {
  step1Title: 'שנייה אחת, ואנחנו על הדשא', step1Hint: 'בן או בת, שם, וזהו. את כל השאר נסדר בשבילך', step1Of: 'שלב {n} מתוך 2',
  genderQ: 'מי יוצא לדרך?', boy: 'בן', girl: 'בת', first: 'שם פרטי', last: 'שם משפחה (לא חובה)', nick: 'כינוי (לא חובה)', firstPh: 'איך קוראים לך?',
  randomBtn: '🎲 שחקן אקראי', randomBtnG: '{{🎲 שחקן אקראי|🎲 שחקנית אקראית}}', randomDone: 'הוגרל! אפשר לשנות כל דבר', errFirst: 'רק שם פרטי, וממשיכים',
  next: 'הבא', step2Title: '{{מוכן|מוכנה}}? האצטדיון כבר מלא', step2Sub: 'גיל 16, ו{{אתה כבר|את כבר}} בסגל הבוגר',
  cardLine: '{pos} · {club}', cardStats: 'גיל {age} · יכולת {ovr}', cardPotential: 'פוטנציאל: {{כוכב על|כוכבת על}}',
  scoutQuote: ['"כישרון כזה רואים פעם בעשור" - הסקאוט של {club}', '"תזכרו את השם {first}" - כתב הספורט המקומי'],
  kickoff: 'לבעיטת הפתיחה', kickoffHint: 'משחק הבכורה שלך מתחיל עכשיו', advanced: 'התאמה מתקדמת', advancedHint: 'מדינה, עמדה, רגל חזקה, אקדמיה ומראה',
  rerollClub: 'קבוצה אחרת', rerollLook: 'מראה אחר', back: 'חזרה', defaultPos: { m: 'חלוץ', f: 'חלוצה' }, defaultNation: 'ישראל',
  loading: ['הנעליים קשורות. המנהרה מחכה', 'אבא כבר ביציע עם התרמוס', 'החבר׳ה מהשכונה מול המסך', 'המאמן קורא בשם שלך...'],
};
const OB = { ...OB_FB, ...(STR.ONBOARDING || {}) };
/** Fill {placeholders} and resolve {{m|f}} markers for gender gd. */
export function fill(str, vars = {}, gd) {
  const s = String(str == null ? '' : str).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
  return gtext(s, gd);
}
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
// the fast start's random look reads as a boy / a girl at first glance (the full wizard still offers every style)
const AMBIG = { m: ['manbun', 'long'], f: ['pixie'] };
function lookFromSeed(seed, gd) {
  let l = lookFromSeedRaw(seed, gd);
  for (let i = 1; i < 8 && AMBIG[gd === 'f' ? 'f' : 'm'].includes(l.hair); i++) l = lookFromSeedRaw((seed + i * 7919) >>> 0, gd);
  return l;
}

function trackStep(step) {
  try { if (typeof svc.telemetry.trackOnboarding === 'function') svc.telemetry.trackOnboarding(step); else svc.telemetry.track('onboarding_step', { step }); } catch { /* ignore */ }
}

/** Top-6 clubs of the Israeli top flight (strongest first): the fast-start pool. */
function topClubs(gd) {
  try {
    const data = game.getAcademyOptions('isr', { gender: gd });
    const g = (data.groups || []).slice().sort((a, b) => (a.tier || 1) - (b.tier || 1))[0];
    return ((g && g.clubs) || []).slice().sort((a, b) => (b.strength || 0) - (a.strength || 0)).slice(0, 6);
  } catch { return []; }
}

/* ------------------------------------------------------------------ #/new */
export async function render(root, params = {}) {
  if (params.adv) {
    trackStep('advanced');
    const m = await import('./create.js');
    return m.render(root, params);
  }
  trackStep('open');
  const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
  const st = {
    step: 1, gender: null, first: '', last: '', nick: '', random: false,
    seed, look: null, club: null, clubs: [], quote: 0,
    slot: [1, 2, 3].includes(Number(params.slot)) ? Number(params.slot) : null, slots: null,
  };
  let untilt = () => {};
  const T = (s, vars) => fill(s, vars, st.gender || 'm');

  save.listSlots().then((s) => {
    st.slots = s;
    if (!st.slot) { const e = s.find((x) => x.empty && !x.corrupt && !x.tooNew); st.slot = e ? e.slot : null; }
    if (st.step === 2) draw();
  }).catch(() => { st.slots = [1, 2, 3].map((n) => ({ slot: n, empty: true })); if (!st.slot) st.slot = 1; });

  function setGender(gd) {
    if (st.gender === gd) return;
    st.gender = gd;
    st.look = lookFromSeed(st.seed + (gd === 'f' ? 7 : 3), gd);
    st.clubs = topClubs(gd);
    if (!st.club || !st.clubs.some((c) => c.id === st.club.id)) st.club = st.clubs.length ? st.clubs[st.seed % st.clubs.length] : null;
    trackStep('gender');
  }

  function randomize() {
    const gd = st.gender || (Math.random() < 0.5 ? 'm' : 'f');
    setGender(gd);
    const firsts = ((gd === 'f' ? NAME_POOLS_F : NAME_POOLS).isr || {}).first || ['נועם'];
    const lasts = (NAME_POOLS.isr || {}).last || ['כהן'];
    st.first = rnd(firsts); st.last = rnd(lasts);
    // one display name: a random player has no extra nickname (pitch, card and summary all use the same name)
    st.nick = '';
    st.seed = (st.seed * 1103515245 + 12345) >>> 0;
    st.look = lookFromSeed(st.seed, gd);
    if (st.clubs.length) st.club = st.clubs[st.seed % st.clubs.length];
    st.random = true;
    trackStep('random');
  }

  function readInputs() {
    const v = (id) => { const el = root.querySelector(id); return el ? el.value : null; };
    const f = v('#q-first'), l = v('#q-last'), n = v('#q-nick');
    if (f !== null) st.first = f;
    if (l !== null) st.last = l;
    if (n !== null) st.nick = n;
  }

  function dots() {
    return `<div class="wiz-steps">${[1, 2].map((i) => `<span class="wiz-dot${i === st.step ? ' on' : i < st.step ? ' done' : ''}"></span>`).join('')}</div>
      <span class="wiz-count num">${esc(fill(OB.step1Of, { n: st.step }, 'm'))}</span>`;
  }

  /* ---------- step 1: who + name ---------- */
  function step1() {
    const gcard = (gd) => `<button type="button" class="gcard qs-g${st.gender === gd ? ' on' : ''}" data-act="gender" data-v="${gd}" data-testid="gender-${gd}" aria-pressed="${st.gender === gd}">
        <span class="gcard-glow" aria-hidden="true"></span>
        <span class="gcard-art" aria-hidden="true">${avatarSVG({ gender: gd, skin: gd === 'f' ? 2 : 1, hair: 0, kitColors: gd === 'f' ? ['#E11D74', '#FFFFFF'] : ['#1D4ED8', '#FFFFFF'], number: gd === 'f' ? 10 : 9, size: 110, pose: 'full', bg: false })}</span>
        <span class="gcard-label"><b>${esc(gd === 'f' ? OB.girl : OB.boy)}</b><small>${gd === 'f' ? 'הילדה מהשכונה' : 'הילד מהשכונה'}</small></span>
        <span class="gcard-check" aria-hidden="true">✓</span></button>`;
    const gd = st.gender || 'm';
    const nicks = st.gender ? ((gd === 'f' ? NICKNAMES_F : NICKNAMES) || []).slice((st.seed % 10), (st.seed % 10) + 5) : [];
    return `<div class="qs qs-1">
      <div class="wiz-head">${dots()}<h2 class="wiz-title">${esc(OB.step1Title)}</h2><p class="muted small qs-hint">${esc(OB.step1Hint)}</p></div>
      <div class="gender-pick qs-gender" role="group" aria-label="${esc(OB.genderQ)}">${gcard('m')}${gcard('f')}</div>
      <section class="card qs-name">
        <label class="field"><span>${esc(OB.first)}</span><input id="q-first" data-testid="inp-first" maxlength="20" autocomplete="off" enterkeyhint="next" value="${esc(st.first)}" placeholder="${esc(OB.firstPh)}"></label>
        <div class="qs-row2">
          <label class="field"><span>${esc(OB.last)}</span><input id="q-last" data-testid="inp-last" maxlength="20" autocomplete="off" value="${esc(st.last)}"></label>
          <label class="field"><span>${esc(OB.nick)}</span><input id="q-nick" data-testid="inp-nick" maxlength="16" autocomplete="off" value="${esc(st.nick)}"></label>
        </div>
        ${nicks.length ? `<div class="chips qs-nicks">${nicks.map((n) => `<button type="button" class="chip chip-btn${st.nick === n ? ' on' : ''}" data-act="nick" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
        <button type="button" class="btn btn-glass qs-random" data-act="random" data-testid="btn-random">${esc(st.gender ? T(OB.randomBtnG) : OB.randomBtn)}</button>
        ${BACKEND_ENABLED ? '<p class="muted small qs-privacy" data-testid="name-privacy-note">אפשר להמציא שם. השם של הדמות נשלח עם נתוני השימוש האנונימיים (אפשר לכבות בהגדרות).</p>' : ''}
      </section>
      <button type="button" class="btn btn-gold btn-xl qs-next" data-act="next" data-testid="btn-next"><span>${esc(OB.next)}</span>${ico('chevron')}</button>
      <button type="button" class="qs-adv" data-act="advanced" data-testid="btn-advanced">${ico('gear')}<span><b>${esc(OB.advanced)}</b><small>${esc(OB.advancedHint)}</small></span></button>
    </div>`;
  }

  /* ---------- step 2: the card + kick-off ---------- */
  function step2() {
    const gd = st.gender || 'm';
    const pos = (OB.defaultPos && OB.defaultPos[gd]) || (gd === 'f' ? 'חלוצה' : 'חלוץ');
    const club = st.club;
    const name = `${st.first.trim()} ${st.last.trim()}`.trim();
    // the real numbers of the career this seed creates (engine preview); a plain OVR 60 card if the engine lacks it
    let pv = null;
    try { pv = typeof game.previewQuickPlayer === 'function' ? game.previewQuickPlayer({ seed: st.seed, pos: 'ST', gender: gd }) : null; } catch { pv = null; }
    const card = playerCard({
      name, nick: st.nick.trim(), ovr: (pv && pv.ovr) || 60, pos: 'ST', attrs: (pv && pv.attrs) || [], gender: gd, meta: { gender: gd, look: st.look || {}, careerId: '' },
      club: club ? { ...club } : null, nation: nationTeam('isr'), frame: 'youth',
    }, { size: 'l', testid: 'qs-card' });
    const quotes = Array.isArray(OB.scoutQuote) && OB.scoutQuote.length ? OB.scoutQuote : OB_FB.scoutQuote;
    const quote = fill(quotes[st.quote % quotes.length], { club: club ? club.nameHe : '', first: st.first.trim(), name }, gd);
    const slots = st.slots || [];
    const free = slots.some((s) => s.empty && !s.corrupt && !s.tooNew);
    const slotPick = slots.length && !free ? `<section class="card qs-slots">
        <h3 class="card-title"><span>כל המשבצות תפוסות. איפה לשמור?</span></h3>
        <div class="slot-pick">${slots.map((s) => `<button type="button" class="slot-chip${s.slot === st.slot ? ' on' : ''}" data-act="slot" data-v="${s.slot}" data-testid="new-slot-${s.slot}"><b class="num">${s.slot}</b><small>${esc((s.meta && s.meta.name) || 'תפוסה')}</small></button>`).join('')}</div>
        ${st.slot ? '<p class="note warn">הקריירה הקיימת תישמר כעותק שאפשר לשחזר מהתפריט של המשבצת.</p>' : ''}
      </section>` : '';
    return `<div class="qs qs-2">
      <div class="wiz-head">${dots()}<h2 class="wiz-title">${esc(T(OB.step2Title))}</h2><p class="muted small qs-hint">${esc(T(OB.step2Sub))}</p></div>
      <div class="qs-stage"><i class="qs-spot" aria-hidden="true"></i><i class="qs-rays" aria-hidden="true"></i>${card}
        <span class="qs-pot">${ico('star', 'gold')}${esc(T(OB.cardPotential))}</span></div>
      <div class="qs-meta">
        <b>${esc(fill(OB.cardLine, { pos, club: club ? club.nameHe : 'ישראל' }, gd))}</b>
        <span class="muted">${esc(fill(OB.cardStats, { age: 16, ovr: 60 }, gd))}</span>
        <p class="qs-quote">${esc(quote)}</p>
      </div>
      <div class="qs-rerolls">
        <button type="button" class="chip chip-btn" data-act="reclub" data-testid="btn-reroll-club">${ico('swap')}${esc(OB.rerollClub)}</button>
        <button type="button" class="chip chip-btn" data-act="relook" data-testid="btn-reroll-look">${ico('user')}${esc(OB.rerollLook)}</button>
      </div>
      ${slotPick}
      <button type="button" class="btn btn-gold btn-xl qs-kick" data-act="start" data-testid="btn-start" ${st.slot || !slots.length ? '' : 'disabled'}><span>${ico('ball')}${esc(OB.kickoff)}</span><small>${esc(T(OB.kickoffHint))}</small></button>
      <div class="qs-foot"><button type="button" class="btn btn-ghost btn-sm" data-act="back">${esc(OB.back)}</button>
        <button type="button" class="qs-adv sm" data-act="advanced" data-testid="btn-advanced">${ico('gear')}<span><b>${esc(OB.advanced)}</b></span></button></div>
    </div>`;
  }

  function draw() {
    untilt();
    root.innerHTML = `<div class="wizard quick-start qs-s${st.step}${st.gender ? ' g-' + st.gender : ''}">${st.step === 1 ? step1() : step2()}</div>`;
    if (st.step === 2) untilt = mountTilt(root);
    setHeader({ back: '#/title' });
  }

  function next() {
    readInputs();
    if (!st.gender) { toast('בחרו: בן או בת'); const g = root.querySelector('.qs-gender'); if (g) { g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake'); } return; }
    if (!st.first.trim()) { toast(OB.errFirst); const f = root.querySelector('#q-first'); if (f) f.focus(); return; }
    if (st.first.trim().length > 20 || st.last.trim().length > 20) { toast('השם ארוך מדי (עד 20 תווים)'); return; }
    if (st.nick.trim().length > 16) { toast('הכינוי ארוך מדי'); return; }
    if (!st.random) trackStep('name');
    st.quote = Math.floor(Math.random() * 20);
    try { clearToast(0); } catch { /* ignore */ }
    st.step = 2;
    draw();
    try { window.scrollTo(0, 0); } catch { /* ignore */ }
  }

  let starting = false;
  async function start(btn) {
    if (starting) return;
    readInputs();
    if (st.slots && st.slots.length && !st.slot) { toast('בחרו משבצת'); return; }
    starting = true;
    if (btn) btn.disabled = true;
    trackStep('kickoff');
    buzz([20, 40, 20]);
    const gd = st.gender || 'm';
    const last = st.last.trim() || rnd((NAME_POOLS.isr || {}).last || ['כהן']);
    // only a first name typed: that name is the one on the pitch and the card (not a surname the kid never chose)
    const nick = st.nick.trim() || (!st.last.trim() && !st.random ? st.first.trim().slice(0, 16) : '');
    const ov = loadingOverlay(gd);
    const opts = {
      gender: gd, first: st.first.trim(), last, nick, random: !!st.random, seed: st.seed,
      // not in the quickCareer contract, honoured if the engine supports them (the card the player saw)
      club: st.club ? st.club.id : undefined, look: st.look || undefined, nation: 'isr', pos: 'ST', foot: 'R',
    };
    const slot = st.slot || 1;
    const t0 = performance.now();
    const res = await ctx.hooks.startNewCareer(opts, slot, { quick: true });
    if (!res || !res.ok) {
      ov.close(); starting = false; if (btn) btn.disabled = false;
      toast((res && res.messageHe) || 'לא הצלחנו ליצור את הקריירה');
      return;
    }
    ctx.tutorial = { careerId: (() => { try { return game.getSaveMeta().careerId; } catch { return ''; } })(), at: Date.now() };
    // v2.3 review: an accepted challenge link follows the new career as a rival on the hub
    try { const lbm = await import('./leaderboard.js'); lbm.adoptRival(ctx.tutorial.careerId); } catch { /* ignore */ }
    // a short beat of anticipation (the tunnel), then straight into the debut week
    const wait = Math.max(0, (reducedMotion() ? 300 : 1500) - (performance.now() - t0));
    await new Promise((r) => setTimeout(r, wait));
    const r = goToDebut();
    ov.close();
    if (!r) navigate('#/hub');
  }

  root.addEventListener('input', (e) => { if (e.target && e.target.id && e.target.id.startsWith('q-')) { readInputs(); st.random = false; } });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); if (e.target.id === 'q-first' && !root.querySelector('#q-last').value) root.querySelector('#q-last').focus(); else next(); }
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b)) return;
    const act = b.dataset.act;
    if (act === 'gender') { readInputs(); setGender(b.dataset.v); draw(); const f = root.querySelector('#q-first'); if (f && !st.first) setTimeout(() => { try { f.focus({ preventScroll: true }); } catch { /* ignore */ } }, 60); }
    else if (act === 'nick') { readInputs(); st.nick = b.dataset.v; draw(); }
    else if (act === 'random') { randomize(); draw(); toast(OB.randomDone, { tone: 'good' }); }
    else if (act === 'next') next();
    else if (act === 'advanced') { readInputs(); navigate('#/new?adv=1' + (st.slot ? '&slot=' + st.slot : '')); }
    else if (act === 'back') { st.step = 1; draw(); }
    else if (act === 'reclub') { if (st.clubs.length > 1) { const i = st.clubs.findIndex((c) => st.club && c.id === st.club.id); st.club = st.clubs[(i + 1) % st.clubs.length]; draw(); } }
    else if (act === 'relook') { st.lseed = (((st.lseed || st.seed) ^ 0x5bd1e995) * 1103515245 + 12345) >>> 0; st.look = lookFromSeed(st.lseed, st.gender || 'm'); draw(); }
    else if (act === 'slot') { st.slot = Number(b.dataset.v); draw(); }
    else if (act === 'start') start(b);
  });

  draw();
  return () => untilt();
}

/** Play the first week right away (the debut is planned in week 1). Returns true if a match screen opened. */
export function goToDebut() {
  let hub = null;
  try { hub = game.getHub(); } catch { hub = null; }
  if (!hub) return false;
  if (hub.status === 'match') { navigate('#/match'); return true; }
  if (hub.status !== 'idle' && hub.status !== 'in_week') return false;
  const focus = (hub.training && hub.training.current) || 'balanced';
  const r = call(() => (hub.status === 'in_week' ? game.resumeWeek() : game.advanceWeek({ focus, intensity: 'normal' })), { quiet: true });
  if (r && r.ok && r.status === 'match') { navigate('#/match'); return true; }
  if (r && r.ok && r.summary) { ctx.pendingSummary = r.summary; navigate('#/hub'); return true; }
  return false;
}

function loadingOverlay(gd) {
  const lines = Array.isArray(OB.loading) && OB.loading.length ? OB.loading : OB_FB.loading;
  const line = gtext(rnd(lines), gd);
  const el = document.createElement('div');
  el.className = 'qs-tunnel';
  el.setAttribute('data-testid', 'qs-tunnel');
  el.innerHTML = `<i class="qs-tunnel-light" aria-hidden="true"></i><div class="qs-tunnel-box"><span class="mx-onair pre"><i></i>יום משחק</span>
    <b>${esc(gBy(gd, 'הבכורה שלך', 'הבכורה שלך'))}</b><p>${esc(line)}</p><div class="qs-tunnel-bar"><i></i></div></div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  return { close: () => { el.classList.remove('show'); setTimeout(() => el.remove(), 260); } };
}

/* ------------------------------------------------------------------ F3: debut coach-marks */
const TUT_FB = {
  coachMarks: [
    { id: 'pitch', target: 'pitch', title: 'המגרש החי', he: 'הנקודה עם ההילה זה {{אתה|את}}. כל מהלך במשחק קורה פה מול העיניים' },
    { id: 'score', target: 'scorebug', title: 'התוצאה והשעון', he: 'הדקה והתוצאה. כשהמספר שלנו עולה, כל האצטדיון קם על הרגליים' },
    { id: 'speed', target: 'speed', title: 'מהירות הצפייה', he: 'x1 כדי לא לפספס אף רגע, x4 כדי להגיע מהר לרגעים הגדולים' },
  ],
  next: 'הבנתי', done: 'יאללה, למשחק!', skip: 'דלג על ההדרכה', stepOf: '{n}/3',
  preMatch: { title: 'משחק הבכורה', sub: '{club} נגד {opp}', lines: ['המאמן: "{first}, {{אתה מתחיל|את מתחילה}} על הספסל. {{תהיה מוכן|תהיי מוכנה}}, בחצי השני {{אתה נכנס|את נכנסת}}."'], cta: 'למנהרה' },
  postMatch: {
    title: 'ככה מתחילים אגדה', sub: ['משחק אחד, שער אחד, ושם שכולם מדברים עליו'], goalLine: 'שער בבכורה, דקה {minute}',
    achievementLabel: 'הישג ראשון נפתח', achievementLine: '{ach}', starsLabel: 'הכוכבים הראשונים שלך', starsLine: '+{n} ⭐',
    teaserLabel: 'הבא בשביל הקריירה', teaser: 'הבא: {{נבחרת הנוער|נבחרת הנערות}}', teaserHint: 'עוד כמה משחקים טובים בהרכב, והטלפון מהנבחרת יגיע',
    objectivesHint: 'המשימות השבועיות כבר מחכות לך בבית', cta: 'ממשיכים', share: '📤 שתף את הגול',
  },
};
export const TUT = (() => {
  const t = STR.TUTORIAL && typeof STR.TUTORIAL === 'object' ? STR.TUTORIAL : {};
  return { ...TUT_FB, ...t, preMatch: { ...TUT_FB.preMatch, ...(t.preMatch || {}) }, postMatch: { ...TUT_FB.postMatch, ...(t.postMatch || {}) },
    coachMarks: Array.isArray(t.coachMarks) && t.coachMarks.length ? t.coachMarks : TUT_FB.coachMarks };
})();
const pickOne = (v, salt = 0) => (Array.isArray(v) ? v[Math.abs(salt) % v.length] : v);

/**
 * Show the coach-marks one by one over the match screen. targets: { pitch, scorebug, speed } -> Element.
 * Resolves when the player finished (or skipped) them. Tap anywhere = next; auto-advances after 6.5 s.
 */
const PITCH_BENCH = 'אלה החברים שלך על הדשא. {{אתה מתחיל|את מתחילה}} על הספסל, ובחצי השני {{אתה נכנס|את נכנסת}} - ואז הנקודה עם ההילה זה {{אתה|את}}';
const SPEED_AUTO = 'בבכורה המשחק רץ מהר עד שהמאמן קורא לך, ואז מאט כדי שלא {{תפספס|תפספסי}} אף רגע. אפשר לשנות מהירות מתי שרוצים';
export function coachMarks(targets = {}, opts = {}) {
  return new Promise((resolve) => {
    const marks = TUT.coachMarks.filter((mk) => targets[mk.target] && targets[mk.target].isConnected)
      .map((mk) => (opts.bench && mk.target === 'pitch' ? { ...mk, he: (TUT.pitchBench || PITCH_BENCH) } : mk))
      .map((mk) => (opts.autoSpeed && mk.target === 'speed' ? { ...mk, he: (TUT.speedAuto || SPEED_AUTO) } : mk));
    if (!marks.length) { resolve(); return; }
    const layer = document.createElement('div');
    layer.className = 'cm-layer';
    layer.setAttribute('data-testid', 'coach-marks');
    layer.innerHTML = '<i class="cm-hole" aria-hidden="true"></i><div class="cm-tip" role="dialog" aria-live="polite"></div>';
    document.body.appendChild(layer);
    const hole = layer.querySelector('.cm-hole'), tip = layer.querySelector('.cm-tip');
    let i = 0, timer = 0, done = false;
    function place() {
      const mk = marks[i];
      const el = mk && targets[mk.target];
      if (!el || !el.isConnected) return;
      const r = el.getBoundingClientRect();
      const pad = mk.target === 'pitch' ? -6 : 6;
      const x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad), w = Math.min(innerWidth - 8, r.width + pad * 2), h = Math.min(innerHeight - 8, r.height + pad * 2);
      Object.assign(hole.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      const below = y + h + 170 < innerHeight;
      tip.style.top = below ? (y + h + 12) + 'px' : '';
      tip.style.bottom = below ? '' : (innerHeight - y + 12) + 'px';
      tip.classList.toggle('up', !below);
      tip.style.setProperty('--ax', Math.max(24, Math.min(innerWidth - 24, x + w / 2)) + 'px');
    }
    const finish = () => { if (done) return; done = true; clearTimeout(timer); layer.classList.remove('show'); window.removeEventListener('resize', place); setTimeout(() => { layer.remove(); resolve(); }, 220); };
    function show() {
      const mk = marks[i];
      const last = i === marks.length - 1;
      tip.innerHTML = `<div class="cm-top"><span class="cm-step num">${esc(fill(TUT.stepOf || '{n}/3', { n: i + 1 }))}</span><b>${esc(gtext(mk.title || ''))}</b></div>
        <p>${esc(gtext(mk.he || ''))}</p>
        <div class="cm-btns"><button type="button" class="btn btn-gold btn-sm" data-cm="next" data-testid="btn-cm-next">${esc(last ? TUT.done : TUT.next)}</button>
        ${last ? '' : `<button type="button" class="btn btn-ghost btn-sm" data-cm="skip" data-testid="btn-cm-skip">${esc(TUT.skip)}</button>`}</div>`;
      tip.classList.remove('in'); void tip.offsetWidth; tip.classList.add('in');
      place();
      clearTimeout(timer);
      timer = setTimeout(next, 6500);
    }
    function next() { if (done) return; i++; if (i >= marks.length) finish(); else show(); }
    layer.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cm]');
      if (b && b.dataset.cm === 'skip') { finish(); return; }
      next();
    });
    window.addEventListener('resize', place);
    show();
    requestAnimationFrame(() => layer.classList.add('show'));
  });
}

/* ------------------------------------------------------------------ F3: "ככה מתחילים אגדה" */
/**
 * The post-debut card: the goal, the first achievement unlocked, the first stars, and what comes next on the path.
 * s = the finishMatch summary. Resolves when closed. opts: { starsBefore }
 */
export function showLegendCard(s, opts = {}) {
  return new Promise((resolve) => {
    let meta = {};
    try { meta = game.getSaveMeta() || {}; } catch { meta = {}; }
    const gd = meta.gender === 'f' ? 'f' : 'm';
    const PM = TUT.postMatch;
    let ach = [], stars = null, path = null, card = null;
    card = (s && s.tutorial && typeof s.tutorial === 'object') ? s.tutorial : null;
    if (!card) { try { if (typeof game.getTutorial === 'function') { const t = game.getTutorial(); card = t && t.card; } } catch { card = null; } }
    try { const list = typeof game.getAchievements === 'function' ? game.getAchievements() : []; ach = (list || []).filter((a) => a && a.unlocked).sort((a, b) => (Number(b.unlockedAbs) || 0) - (Number(a.unlockedAbs) || 0)); } catch { ach = []; }
    try { stars = typeof game.getStars === 'function' ? game.getStars() : null; } catch { stars = null; }
    try { path = typeof game.getPath === 'function' ? game.getPath() : null; } catch { path = null; }
    const goals = Number(s && s.goals) || 0;
    const meGoal = s && Array.isArray(s.log) ? s.log.find((e) => e && e.who === 'me' && (e.ev === 'goal' || e.kind === 'goal_for')) : null;
    const minute = (card && card.minute) || (s && s.goalMinute) || (meGoal && meGoal.minute) || '';
    const diff = (Number(stars && stars.balance) || 0) - (Number(opts.starsBefore) || 0);
    const gotStars = (card && Number(card.stars) > 0) ? Number(card.stars) : diff > 0 ? diff : (stars && stars.balance) || 0;
    const firstAch = (card && card.achievement && card.achievement.he ? card.achievement : null) || ach.find((a) => /debut|first/.test(a.id)) || ach[0] || null;
    const nextStep = path && path.next && path.next.he ? path.next : null;
    const steps = path && Array.isArray(path.steps) ? path.steps.slice(0, 5) : [];
    const subs = Array.isArray(PM.sub) ? PM.sub : [PM.sub];
    const sub = (card && card.subHe) || gtext(pickOne(subs, (meta.careerId || '').length), gd);
    // the teaser is the path's real next step (the same one the hub shows), never a hard-coded milestone
    const teaser = nextStep ? (nextStep.teaserHe ? gtext(nextStep.teaserHe, gd) : 'הבא: ' + gtext(nextStep.he, gd)) : fill(PM.teaser, {}, gd);
    const teaserHint = nextStep && nextStep.missingHe ? gtext(nextStep.missingHe, gd) : gtext(PM.teaserHint, gd);
    const html = `<div class="legend" data-testid="legend-card">
      <i class="legend-rays" aria-hidden="true"></i>
      <span class="legend-tag">${ico('sparkle', 'gold')}${esc(gBy(gd, 'הבכורה שלך', 'הבכורה שלך'))}</span>
      <h2 class="legend-title">${esc(gtext(PM.title, gd))}</h2>
      <p class="legend-sub">${esc(sub)}</p>
      ${goals ? `<div class="legend-goal">${ico('ball', 'gold')}<b>${esc(fill(PM.goalLine, { minute: minute || '?' }, gd))}</b></div>` : ''}
      <div class="legend-grid">
        ${firstAch ? `<div class="legend-box ach t-${esc(firstAch.tier || 'bronze')}" data-testid="legend-ach"><small>${esc(gtext(PM.achievementLabel, gd))}</small><span class="legend-medal">${ico('medal', 'gold')}</span><b>${esc(fill(PM.achievementLine, { ach: gtext(firstAch.he || '', gd) }, gd))}</b></div>` : ''}
        <div class="legend-box stars" data-testid="legend-stars"><small>${esc(gtext(PM.starsLabel, gd))}</small><span class="legend-star">⭐</span><b class="num">${esc(fill(PM.starsLine, { n: gotStars }, gd))}</b></div>
      </div>
      <div class="legend-path"><small>${esc(gtext(PM.teaserLabel, gd))}</small>
        ${steps.length ? `<div class="legend-steps">${steps.map((x, i) => `<span class="ls${x.done ? ' done' : ''}${!x.done && (i === 0 || steps[i - 1].done) ? ' cur' : ''}"><i>${x.done ? ico('check') : i + 1}</i><em>${esc(gtext(x.he, gd))}</em></span>`).join('')}</div>` : ''}
        <b class="legend-teaser">${esc(teaser)}</b><span class="muted small">${esc(teaserHint)}</span></div>
      <p class="muted small center">${esc(gtext(PM.objectivesHint, gd))}</p>
      <div class="btn-col">
        <button type="button" class="btn btn-gold btn-xl" data-a="go" data-testid="btn-legend-continue">${esc(gtext(PM.cta, gd))}</button>
        ${goals ? `<button type="button" class="btn btn-glass" data-a="share" data-testid="btn-legend-share">${esc(gtext(PM.share, gd))}</button>` : ''}
      </div></div>`;
    const close = openModal(html, { testid: 'legend', cls: 'legend-modal', dismissible: false, guardMs: 450, onClose: () => resolve() });
    close.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'go') close();
      else if (b.dataset.a === 'share') {
        try { const m = await import('./sharecard.js'); m.shareMoment({ kind: 'debut', titleHe: fill(PM.goalLine, { minute: minute || '' }, gd), vars: { minute } }); } catch { /* ignore */ }
      }
    });
  });
}

/** Pre-match intro lines for the debut (TUTORIAL.preMatch). m = the match VM. */
export function debutIntro(m) {
  let meta = {};
  try { meta = game.getSaveMeta() || {}; } catch { meta = {}; }
  const gd = meta.gender === 'f' ? 'f' : 'm';
  const mine = m && (m.isHome ? m.home : m.away);
  const opp = m && (m.isHome ? m.away : m.home);
  const first = String(meta.name || '').split(/\s+/)[0] || '';
  const v = { club: (mine && (mine.shortHe || mine.nameHe)) || '', opp: (opp && (opp.shortHe || opp.nameHe)) || '', first };
  const P = TUT.preMatch;
  const lines = Array.isArray(P.lines) ? P.lines : [P.lines];
  const starter = m && m.role === 'starter';
  const ok = lines.filter((l) => !starter || !/ספסל/.test(l));
  return { title: fill(P.title, v, gd), sub: fill(P.sub, v, gd), line: fill(pickOne(ok.length ? ok : lines, first.length), v, gd), cta: fill(P.cta, v, gd) };
}
