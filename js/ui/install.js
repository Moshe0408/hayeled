// install.js: #/install guide + beforeinstallprompt capture.
import * as game from '../engine/game.js';
import * as save from '../core/save.js';
import { ctx, toast } from './app.js';

let deferredPrompt = null;
let inited = false;

export function initInstall() {
  if (inited) return;
  inited = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; });
}

export function canInstall() { return !!deferredPrompt; }

export function isStandalone() {
  try {
    return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  } catch { return false; }
}

export function isIOS() {
  try {
    const ua = navigator.userAgent || '';
    return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  } catch { return false; }
}

function isAndroid() {
  try { return /android/i.test(navigator.userAgent || ''); } catch { return false; }
}

const SHARE_SVG = '<svg class="ill" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
const ADD_SVG = '<svg class="ill" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
const DOTS_SVG = '<svg class="ill" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>';

export function render(root) {
  let hasCareer = false;
  try { hasCareer = game.hasCareer() && !!ctx.activeSlot; } catch { hasCareer = false; }
  const standalone = isStandalone();
  const ios = isIOS();

  function draw() {
    if (standalone) {
      root.innerHTML = `<div class="install"><section class="card center"><div class="big-ico">✅</div><h2>כבר מותקן ✓</h2>
        <p class="muted">המשחק פתוח מהמסך הראשי. אפשר לשחק גם בלי אינטרנט.</p></section></div>`;
      return;
    }
    const iosBlock = `<section class="card">
      <h2 class="card-title">📱 אייפון / אייפד (Safari)</h2>
      <ol class="steps">
        <li>${SHARE_SVG}<span>לחץ על כפתור <b>השיתוף</b> בתחתית המסך</span></li>
        <li>${ADD_SVG}<span>גלול ובחר <b>"הוסף למסך הבית"</b></span></li>
        <li><span class="step-ico">⚽</span><span>לחץ <b>"הוסף"</b>. האייקון של הילד מהשכונה יופיע במסך הבית</span></li>
      </ol>
      <div class="note warn"><b>חשוב באייפון:</b> לאפליקציה המותקנת יש אחסון <b>נפרד</b> מ-Safari. קריירה שהתחלת ב-Safari לא תופיע באפליקציה.
        לפני ההתקנה העתק קוד גיבוי, ואחרי ההתקנה פתח את המשחק ← הגדרות ← ייבוא והדבק אותו.</div>
      ${hasCareer ? '<button type="button" class="btn btn-primary" data-act="copycode" data-testid="btn-install-copy-code">📋 העתק קוד גיבוי</button>' : ''}
      <p class="muted small">טיפ: Safari עלול למחוק נתוני אתרים אחרי כ-7 ימים בלי ביקור. התקנה למסך הבית מונעת את זה.</p>
    </section>`;
    const androidBlock = `<section class="card">
      <h2 class="card-title">🤖 אנדרואיד (Chrome)</h2>
      ${canInstall() ? '<button type="button" class="btn btn-primary btn-lg" data-act="install" data-testid="btn-install">📲 התקן</button>' : ''}
      <ol class="steps">
        <li>${DOTS_SVG}<span>לחץ על <b>⋮</b> (שלוש הנקודות) בפינה</span></li>
        <li>${ADD_SVG}<span>בחר <b>"הוספה למסך הבית"</b> או <b>"התקנת האפליקציה"</b></span></li>
      </ol>
      <p class="muted small">באנדרואיד האפליקציה המותקנת חולקת את האחסון עם Chrome, אז ההתקדמות שלך נשארת. אין צורך להעביר כלום.</p>
    </section>`;
    const desktopBlock = `<section class="card"><h2 class="card-title">💻 מחשב</h2>
      ${canInstall() ? '<button type="button" class="btn btn-primary" data-act="install" data-testid="btn-install">📲 התקן</button>' : ''}
      <p class="small">ב-Chrome או Edge: לחץ על סמל ההתקנה בשורת הכתובת, או בתפריט ← "התקן את הילד מהשכונה".</p></section>`;
    root.innerHTML = `<div class="install">
      <section class="card hero-card"><div class="big-ico">📲</div><h2>שחק כמו באפליקציה</h2>
        <p class="muted">התקנה למסך הבית: פתיחה במסך מלא, משחק גם בלי אינטרנט, וההתקדמות מוגנת יותר.</p></section>
      ${ios ? iosBlock + androidBlock : isAndroid() ? androidBlock + iosBlock : desktopBlock + androidBlock + iosBlock}
    </div>`;
  }

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'install' && deferredPrompt) {
      const p = deferredPrompt;
      deferredPrompt = null;
      try {
        await p.prompt();
        const choice = p.userChoice ? await p.userChoice : null;
        if (choice && choice.outcome === 'accepted') toast('מותקן! תמצא את המשחק במסך הבית ⚽');
      } catch (err) { console.warn(err); }
      draw();
    } else if (b.dataset.act === 'copycode') {
      try {
        if (ctx.hooks.saveNow) ctx.hooks.saveNow();
        const code = await save.exportSlotCode(ctx.activeSlot);
        let copied = false;
        try { await navigator.clipboard.writeText(code); copied = true; } catch { copied = false; }
        if (copied) toast('קוד הגיבוי הועתק ✓ שמור אותו בפתקים או בוואטסאפ לעצמך');
        else toast('לא הצלחנו להעתיק. אפשר להעתיק מההגדרות ← העתק קוד');
      } catch (err) { console.warn(err); toast('לא הצלחנו ליצור קוד גיבוי'); }
    }
  });
  draw();
}

