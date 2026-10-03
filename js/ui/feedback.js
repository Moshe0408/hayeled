// feedback.js: #/feedback screen + gentle prompt sheet (after season 1 and on retirement).
import * as game from '../engine/game.js';
import { APP_VERSION } from '../config.js';
import { esc } from './dom.js';
import { svc, toast, openModal } from './app.js';
import { navigate } from './router.js';
import { isStandalone, isIOS } from './install.js';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const LABELS = ['', 'לא אהבתי', 'ככה ככה', 'נחמד', 'אהבתי', 'מטורף!'];

function platform() {
  try {
    if (isIOS()) return 'ios';
    if (/android/i.test(navigator.userAgent)) return 'android';
    if (/windows|macintosh|linux/i.test(navigator.userAgent)) return 'desktop';
  } catch { /* ignore */ }
  return 'other';
}

function buildContext(trigger) {
  const c = { v: APP_VERSION, platform: platform(), standalone: (() => { try { return isStandalone(); } catch { return false; } })(), trigger: trigger || 'settings' };
  try {
    if (game.hasCareer()) {
      const m = game.getSaveMeta();
      Object.assign(c, { season: m.season, seasons: m.seasons, age: m.age, ovr: m.ovr, club: m.clubId });
    }
  } catch { /* ignore */ }
  return c;
}

function available() {
  try { return !!svc.feedback.isFeedbackAvailable(); } catch { return false; }
}

export function render(root, params = {}) {
  const st = { rating: Math.max(0, Math.min(5, Number(params.rating) || 0)), text: '', email: '', sending: false };
  const trigger = ['season1', 'retired'].includes(params.trigger) ? params.trigger : 'settings';
  const can = available();

  function starsHtml() {
    return `<div class="fb-stars" role="radiogroup" aria-label="דירוג">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="fb-star${n <= st.rating ? ' on' : ''}" data-act="star" data-n="${n}" data-testid="fb-star-${n}" role="radio" aria-checked="${n === st.rating}" aria-label="${n} כוכבים">★</button>`).join('')}</div>
      <div class="fb-label">${esc(LABELS[st.rating] || 'גע בכוכב כדי לדרג')}</div>`;
  }

  function draw() {
    root.innerHTML = `<div class="feedback">
      <section class="card">
        <h2 class="card-title">איך המשחק? ❤️</h2>
        <p class="muted small">כל משוב נקרא. ספר לנו מה אהבת, מה הציק, ומה היית רוצה לראות.</p>
        <div class="fb-stars-wrap">${starsHtml()}</div>
        <label class="field"><span>מה דעתך? (לא חובה)</span><textarea id="fb-text" data-testid="fb-text" maxlength="2000" rows="5" placeholder="למשל: הייתי רוצה עוד ליגות...">${esc(st.text)}</textarea></label>
        <label class="field"><span>מייל (לא חובה)</span><input id="fb-email" data-testid="fb-email" type="email" inputmode="email" maxlength="200" autocomplete="email" value="${esc(st.email)}" placeholder="name@example.com">
          <small class="muted">אם תרצה שנחזור אליך</small></label>
        ${can ? '' : '<p class="note">שליחת משוב תהיה זמינה בקרוב</p>'}
        <button type="button" class="btn btn-primary btn-lg" data-act="send" data-testid="btn-fb-send" ${can && st.rating && !st.sending ? '' : 'disabled'}>${st.sending ? 'שולח...' : 'שלח משוב'}</button>
      </section>
    </div>`;
  }

  function readInputs() {
    const t = root.querySelector('#fb-text'), e = root.querySelector('#fb-email');
    if (t) st.text = t.value;
    if (e) st.email = e.value;
  }

  function done(queued) {
    root.innerHTML = `<div class="feedback"><section class="card center" data-testid="fb-done">
      <div class="big-ico">🙏</div><h2>תודה! קיבלנו ❤️</h2>
      ${queued ? '<p class="muted">המשוב יישלח אוטומטית כשתחזור לרשת</p>' : '<p class="muted">המשוב שלך עוזר לנו לשפר את המשחק.</p>'}
      <button type="button" class="btn btn-primary" data-act="back">חזרה</button></section></div>`;
  }

  root.addEventListener('input', readInputs);
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'star') {
      readInputs();
      st.rating = Number(b.dataset.n) || 0;
      draw();
    } else if (act === 'back') {
      navigate(game.hasCareer() ? (trigger === 'retired' ? '#/retire' : '#/hub') : '#/title');
    } else if (act === 'send') {
      readInputs();
      if (!st.rating) { toast('בחר דירוג של 1 עד 5 כוכבים'); return; }
      const email = st.email.trim();
      if (email && !EMAIL_RE.test(email)) { toast('כתובת המייל לא נראית תקינה'); return; }
      if (st.sending) return;
      st.sending = true;
      draw();
      let res = null;
      try {
        res = await svc.feedback.submitFeedback({ rating: st.rating, text: st.text.trim().slice(0, 2000), email: email || '', context: buildContext(trigger) });
      } catch (err) { console.warn(err); res = null; }
      st.sending = false;
      if (res && res.ok) done(!!res.queued);
      else { toast('לא הצלחנו לשלוח כרגע. נסה שוב מאוחר יותר.'); draw(); }
    }
  });
  draw();
}

/**
 * Bottom-sheet prompt: "איך המשחק עד עכשיו?" with 5 stars. Calls markPrompted on show.
 */
export function openFeedbackPrompt(trigger) {
  try { svc.feedback.markPrompted(trigger); } catch { /* ignore */ }
  const close = openModal(`<div class="center">
      <h2 class="modal-title">איך המשחק עד עכשיו?</h2>
      <p class="muted small">דירוג קטן עוזר לנו המון</p>
      <div class="fb-stars">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="fb-star" data-n="${n}" data-testid="fb-prompt-star-${n}" aria-label="${n} כוכבים">★</button>`).join('')}</div>
      <button type="button" class="btn btn-ghost" data-close data-testid="btn-fb-later">לא עכשיו</button></div>`,
  { sheet: true, testid: 'fb-prompt' });
  close.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-n]');
    if (!b) return;
    const n = Number(b.dataset.n) || 5;
    close();
    navigate(`#/feedback?rating=${n}&trigger=${encodeURIComponent(trigger)}`);
  });
  return close;
}

/** Show the prompt only if feedback.shouldPrompt(trigger) allows it (30-day cap, once for season1). */
export function maybePromptFeedback(trigger) {
  let ok = false;
  try { ok = !!svc.feedback.shouldPrompt(trigger); } catch { ok = false; }
  if (ok) openFeedbackPrompt(trigger);
  return ok;
}
