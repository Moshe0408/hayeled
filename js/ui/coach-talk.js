// coach-talk.js (v2.2): #/coach-talk. WhatsApp-style talk with the coach after a run on the bench (spec §4, §6).
// Coach avatar + club crest header, opener with a typing indicator, three approaches (ask / demand / threat) with the
// match-moment odds chips, then the coach's reply and a result card (effects + promise).
// Engine: canTalkToCoach() -> { ok, reasonHe, benchRun, lowMin, nextAbs, ...optional openHe, coachHe, odds, loan }
//         talkToCoach(approach) -> { ok, success, replyHe, effects: [{ labelHe, delta }], promise }
import * as game from '../engine/game.js';
import { esc } from './dom.js';
import { call, toast, hubSafe, reducedMotion, commit, ctx, confirmDialog } from './app.js';
import { navigate } from './router.js';
import { badge, oddsChip, ODDS_HE } from './components.js';
import { avatarSVG } from './ext.js';
import { g, gtext } from './gender.js';
import { sgn } from './format.js';
import { ico } from './icons.js';
import { benchRunHe } from './training.js';

const APPROACHES = [
  { id: 'ask', ico: 'wave', tagHe: 'בקשה', he: 'אפשר לדבר? אני רוצה הזדמנות', base: 0.55 },
  { id: 'demand', ico: 'fist', tagHe: 'דרישה', he: 'מגיע לי לפתוח. אני {{דורש|דורשת}} דקות', base: 0.40 },
  { id: 'threat', ico: 'plane', tagHe: 'איום בעזיבה', he: 'אם לא אשחק, אבקש לעזוב', heLoan: 'אם לא אשחק, אבקש לחזור לקבוצה שלי', base: 0.30 },
];

/** Odds bucket for an approach: engine-provided ('low'|'mid'|'high' or a probability), else the spec base chance. */
function oddsFor(ct, a) {
  const src = ct && (ct.odds || ct.approaches);
  let v = null;
  if (Array.isArray(src)) { const x = src.find((o) => o && o.id === a.id); v = x ? (x.band || x.odds || (typeof x.chance === 'number' ? x.chance : x.p)) : null; }
  else if (src && typeof src === 'object') v = src[a.id];
  if (v && typeof v === 'object') v = v.odds !== undefined ? v.odds : v.p;
  if (v === 'low' || v === 'mid' || v === 'high') return v;
  const p = typeof v === 'number' ? v : a.base;
  return p >= 0.6 ? 'high' : p >= 0.38 ? 'mid' : 'low';
}

function coachAvatar(name, club, size = 46) {
  // the coach: an older face (grey / salt-and-pepper hair), dark staff jacket with the club colour as trim
  const kit = club && Array.isArray(club.colors) ? club.colors : ['#1b2a44', '#ffffff'];
  let h = 0;
  const seed = 'coach|' + (name || '') + '|' + ((club && club.id) || '');
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const greys = ['#8A8F98', '#B8BCC4', '#5E5A55', '#2B2622'];
  const styles = ['crop', 'side', 'buzz', 'fade'];
  try {
    return avatarSVG({ gender: 'm', seed, skin: h % 6, hair: styles[(h >>> 3) % styles.length], hairColor: greys[(h >>> 6) % greys.length], kitColors: ['#141C2C', kit[0] || '#ffffff'], size, pose: 'portrait', bg: true, title: name || 'המאמן' });
  } catch { return ''; }
}

function promiseText(pr) {
  if (!pr) return '';
  if (pr.he || pr.textHe) return gtext(pr.he || pr.textHe);
  const t = String(pr.type || '');
  if (/3|three|rotation/.test(t)) return g('תפתח בשלושת המשחקים הבאים, ותהיה ברוטציה עד סוף העונה', 'תפתחי בשלושת המשחקים הבאים, ותהיי ברוטציה עד סוף העונה');
  if (/2|two/.test(t)) return g('תפתח באחד משני המשחקים הבאים', 'תפתחי באחד משני המשחקים הבאים');
  if (/next|1|one/.test(t)) return g('תפתח במשחק הבא', 'תפתחי במשחק הבא');
  return 'המאמן הבטיח לך הזדמנות בהרכב';
}

function splitLines(t) {
  return String(t || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
}

export function render(root) {
  const hub = hubSafe();
  if (!hub) { navigate('#/title', { replace: true }); return; }
  if (hub.status === 'retired') { navigate('#/retire', { replace: true }); return; }
  const club = hub.club || null;
  let ct = call(() => game.canTalkToCoach(), { quiet: true }) || { ok: false, reasonHe: 'אי אפשר לדבר עם המאמן כרגע' };
  const coachHe = ct.coachHe || 'המאמן';
  const loan = !!(ct.loan || (club && club.loan));
  const motion = !reducedMotion();
  const msgs = [];            // { mine, textHe, sys }
  let typing = false;
  let showChoices = false;
  let result = null;
  let busy = false;
  const timers = [];
  const later = (fn, ms) => { timers.push(setTimeout(fn, motion ? ms : 0)); };

  const ctxLine = ct.ok ? benchRunHe(ct) : '';   // the context chip only when a talk is open
  const opener = ct.openHe ? gtext(ct.openHe)
    : (hub.player && hub.player.loadBand === 'burnt') ? g('נכנס. אני רואה שאתה גמור מהאימונים. מה רצית?', 'תיכנסי. אני רואה שאת גמורה מהאימונים. מה רצית?')
      : g('נכנס, הדלת פתוחה. מה רצית להגיד לי?', 'תיכנסי, הדלת פתוחה. מה רצית להגיד לי?');

  /** Button / bubble text: the engine's line (content COACH_TALK) or the built-in one. */
  function approachText(a) {
    const x = Array.isArray(ct.approaches) ? ct.approaches.find((o) => o && o.id === a.id) : null;
    if (x && x.he) return gtext(x.he);
    return gtext(a.id === 'threat' && loan ? a.heLoan : a.he);
  }

  /** What can go wrong (engine approachInfo hint; the threat always spells out the transfer request / the loan). */
  function hintFor(a) {
    const x = Array.isArray(ct.approaches) ? ct.approaches.find((o) => o && o.id === a.id) : null;
    if (a.id === 'threat') {
      if (loan) return 'אם זה לא עובד: ההשאלה מסתיימת ו' + g('אתה חוזר', 'את חוזרת') + ' לקבוצה שלך';
      if (ct.youth) return 'אם זה לא עובד: אמון המאמן יורד, והוא יזכור את זה';
      return 'אם זה לא עובד: בקשת העברה יוצאת אוטומטית, והאמון והאהדה יורדים';
    }
    return x && x.hintHe ? gtext(x.hintHe) : '';
  }

  function effectRow(e) {
    const d = e && e.delta;
    const isNum = typeof d === 'number' && Number.isFinite(d);
    const tone = e && e.tone ? e.tone : isNum ? (d > 0 ? 'good' : d < 0 ? 'bad' : '') : '';
    return `<li class="ct-eff ${esc(tone)}"><span>${esc(gtext((e && (e.labelHe || e.he)) || ''))}</span>${isNum && d !== 0 ? `<b class="num">${esc(sgn(d))}</b>` : isNum ? `<b>${ico(tone === 'bad' || tone === 'warn' ? 'warn' : 'check')}</b>` : d ? `<b>${esc(gtext(String(d)))}</b>` : ''}</li>`;
  }

  function resultCard(r) {
    const ok = !!r.success;
    const eff = Array.isArray(r.effects) ? r.effects.filter(Boolean) : [];
    const pr = r.promise || null;
    const title = r.titleHe ? gtext(r.titleHe) : ok ? g('המאמן השתכנע', 'המאמן השתכנע') : 'המאמן לא השתכנע';
    return `<section class="ct-result ${ok ? 'ok' : 'fail'}" data-testid="coach-talk-result" data-success="${ok ? 1 : 0}">
      <div class="ctr-head"><span class="ctr-ico">${ico(ok ? 'check' : 'cross')}</span><b>${esc(title)}</b></div>
      ${pr ? `<div class="ctr-promise" data-testid="coach-talk-promise">${ico('promise')}<span><small>ההבטחה</small><b>${esc(promiseText(pr))}</b></span></div>` : ''}
      ${eff.length ? `<ul class="ctr-effects">${eff.map(effectRow).join('')}</ul>` : ''}
      <div class="ctr-actions">
        <button type="button" class="btn btn-gold btn-lg grow" data-act="home" data-testid="btn-coach-talk-done">${ico('home')}חזרה לבית</button>
        <button type="button" class="btn btn-ghost" data-act="profile">${ico('user')}פרופיל</button>
      </div>
    </section>`;
  }

  function draw() {
    const head = `<div class="ct-head">
      <span class="ct-av">${coachAvatar(coachHe, club, 54)}${club ? `<span class="ct-crest">${badge(club, 's')}</span>` : ''}</span>
      <span class="grow ct-who"><b>${esc(gtext(coachHe))}</b><small class="muted">${esc(ct.clubHe || (club ? club.nameHe : ''))}${ct.youth ? ' · ' + esc(g('מאמן הנוער', 'מאמן הנערות')) : ''}${club && club.loan ? ' · השאלה' : ''}</small></span>
      ${ctxLine ? `<span class="chip warn ct-ctx">${ico('bench')}<span>${esc(ctxLine)}</span></span>` : ''}
    </div>`;
    let body = '';
    if (!ct.ok) {
      body = `<div class="bubbles ct-bubbles"><div class="ct-sys">${esc(gtext(ct.reasonHe || 'אי אפשר לדבר עם המאמן כרגע'))}</div></div>
        <div class="ctr-actions"><button type="button" class="btn btn-lg grow" data-act="home" data-testid="btn-coach-talk-back">${ico('home')}חזרה לבית</button></div>`;
    } else {
      const bub = msgs.map((m) => m.sys ? `<div class="ct-sys">${esc(m.textHe)}</div>` : `<div class="bub ${m.mine ? 'me' : 'them'}"><span>${esc(m.textHe)}</span></div>`).join('');
      const hints = [];
      if (ct.tired || ct.burnt) hints.push(`<p class="ct-hint warn">${ico('battery')}<span>${esc(g('המאמן רואה שאתה עייף, והסיכוי לשכנע נמוך יותר. שבוע קל יעזור.', 'המאמן רואה שאת עייפה, והסיכוי לשכנע נמוך יותר. שבוע קל יעזור.'))}</span></p>`);
      if (typeof ct.talksLeft === 'number') hints.push(`<p class="ct-hint">${ico('info')}<span>${ct.talksLeft === 1 ? 'זו השיחה האחרונה שלך העונה' : `נשארו לך ${esc(ct.talksLeft)} שיחות העונה`}</span></p>`);
      const choices = showChoices ? `<div class="ct-choices" data-testid="coach-talk-choices">${hints.join('')}${APPROACHES.map((a) => {
        const odds = oddsFor(ct, a);
        const txt = approachText(a);
        const hint = hintFor(a);
        return `<button type="button" class="ct-choice ct-${a.id}" data-act="approach" data-v="${a.id}" data-testid="coach-talk-${a.id}">
          <span class="ctc-ico">${ico(a.ico)}</span>
          <span class="grow ctc-txt"><small>${esc(a.tagHe)}</small><b>${esc(txt)}</b>${hint ? `<em class="ctc-hint">${esc(hint)}</em>` : ''}</span>
          <span class="ctc-odds"><small>סיכוי</small>${oddsChip(odds, ODDS_HE[odds])}</span></button>`;
      }).join('')}</div>` : '';
      body = `<div class="bubbles ct-bubbles" data-testid="coach-talk-thread">${bub}${typing ? '<div class="bub them typing" aria-label="מקליד"><i></i><i></i><i></i></div>' : ''}</div>
        ${choices}${result ? resultCard(result) : ''}`;
    }
    root.innerHTML = `<div class="coach-talk" data-testid="coach-talk">${head}${body}</div>`;
    const last = root.querySelector('.ct-result') || root.querySelector('.ct-choices') || root.querySelector('.bubbles > :last-child');
    if (last && last.scrollIntoView && motion) { try { last.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch { /* ignore */ } }
  }

  async function choose(id) {
    if (busy || result) return;
    const a = APPROACHES.find((x) => x.id === id);
    if (!a) return;
    busy = true;
    if (id === 'threat') {
      // all or nothing: confirm first (like the transfer request on the profile screen)
      const text = loan ? 'אם המאמן לא ישתכנע, ההשאלה תסתיים ' + g('ותחזור', 'ותחזרי') + ' לקבוצה שלך.'
        : ct.youth ? 'אם המאמן לא ישתכנע, האמון שלו בך ירד.'
          : 'אם המאמן לא ישתכנע, תוגש בקשת העברה: אמון המאמן ואהדת הקהל ירדו.';
      const ok = await confirmDialog({ title: 'לאיים בעזיבה?', text, yes: 'כן, לאיים', no: 'לא, אחשוב שוב', danger: true });
      if (!ok) { busy = false; return; }
    }
    const r = call(() => game.talkToCoach(id));
    if (!r || !r.ok) {
      busy = false;
      toast(gtext((r && (r.messageHe || r.reasonHe)) || 'אי אפשר לדבר עם המאמן כרגע'));
      ct = call(() => game.canTalkToCoach(), { quiet: true }) || ct;
      draw();
      return;
    }
    commit();
    try { if (ctx.hooks && ctx.hooks.saveNow) ctx.hooks.saveNow(); } catch { /* ignore */ }
    showChoices = false;
    msgs.push({ mine: true, textHe: r.sayHe ? gtext(r.sayHe) : approachText(a) });   // the same words the inbox thread keeps
    typing = true;
    draw();
    const lines = splitLines(gtext(r.replyHe || (r.success ? 'בסדר. נראה מה אפשר לעשות.' : 'לא עכשיו.')));
    let t = 1100;
    lines.forEach((ln, i) => {
      later(() => {
        msgs.push({ textHe: ln });
        typing = i < lines.length - 1;
        draw();
      }, t);
      t += 900;
    });
    later(() => { typing = false; result = r; busy = false; draw(); }, t - 350);
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b)) return;
    const act = b.dataset.act;
    if (act === 'approach') choose(b.dataset.v);
    else if (act === 'home') navigate('#/hub');
    else if (act === 'profile') navigate('#/profile');
  });

  if (ct.ok) {
    if (ctxLine) msgs.push({ sys: true, textHe: 'היום' });
    typing = true;
    draw();
    later(() => { typing = false; msgs.push({ textHe: opener }); showChoices = true; draw(); }, 750);
  } else draw();

  return () => { for (const t of timers) clearTimeout(t); };
}
