// settings.js: #/settings (v2.1 R5). Icon list: game (sound, decisions, intro, motion, haptics), backup & restore,
// app (install, rate, updates), privacy, danger zone (red, confirmed). Long explanations live in "איך זה עובד?" sheets.
import * as save from '../core/save.js';
import { APP_VERSION } from '../config.js';
import { esc } from './dom.js';
import { ctx, svc, toast, openModal, confirmDialog, saveSettings, setHeader } from './app.js';
import { navigate } from './router.js';
import { isStandalone } from './install.js';
import { bytes, ago } from './format.js';
import { playIntro } from './scene/intro.js';
import { gtext, currentGender } from './gender.js';
import { soundWanted, setSound } from './scene/crowd-audio.js';
import { ico } from './icons.js';

const I = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICO = {
  sound: I('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  decisions: I('<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/>'),
  intro: I('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10 9v6l5-3z"/>'),
  motion: I('<path d="M3 9c2.5-2.6 5-2.6 7.5 0s5 2.6 7.5 0M3 15.5c2.5-2.6 5-2.6 7.5 0s5 2.6 7.5 0"/><path d="M4.5 4.5l15 15"/>'),
  haptics: I('<rect x="8" y="3.5" width="8" height="17" rx="2"/><path d="M4.5 8v8M19.5 8v8M2 10v4M22 10v4"/>'),
  backup: I('<path d="M12 3v11M7.5 9.5 12 14l4.5-4.5"/><path d="M4 15.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3.5"/>'),
  install: I('<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M12 7v7M9.2 11.2 12 14l2.8-2.8M10.5 18.5h3"/>'),
  star: I('<path d="m12 3.2 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.6l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
  update: I('<path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4.5h-4.5"/>'),
  privacy: I('<path d="M12 3l7.5 3v6c0 4.5-3.3 7.8-7.5 9-4.2-1.2-7.5-4.5-7.5-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  ads: I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15l2.5-6L12 15M7.8 13h3.4M15 9v6h1.2a2.4 2.4 0 0 0 0-6z"/>'),
  doc: I('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'),
  trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
};
const CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';

/* "איך זה עובד?" sub-screens: the long explanations that used to fill the settings page. Items are trusted HTML. */
const HELP = {
  save: {
    title: 'איפה ההתקדמות שלך נשמרת',
    items: [
      'ההתקדמות נשמרת <b>אוטומטית אחרי כל פעולה</b>, על המכשיר הזה, בשני מקומות בדפדפן (localStorage ו-IndexedDB). אם אחד מהם נפגם, המשחק משחזר מהשני.',
      'ההתקדמות <b>לא נשמרת בשרת</b>. מחיקת נתוני הדפדפן או נתוני האתר תמחק אותה.',
      'כדי לעבור לטלפון אחר או לשמור עותק: <b>"ייצוא קובץ"</b> או <b>"העתקת קוד"</b>, ואז ייבוא במכשיר החדש.',
      'מומלץ להתקין את המשחק למסך הבית. זה מקטין את הסיכוי למחיקה, במיוחד באייפון (Safari עלול למחוק נתוני אתר אחרי כ-7 ימים בלי ביקור).',
      'באייפון, לאפליקציה המותקנת ול-Safari יש התקדמות <b>נפרדת</b>: כדאי לייצא קוד גיבוי לפני ההתקנה ולייבא אותו בתוך האפליקציה.',
      '<b>"שמירה קודמת"</b> מחזירה לשמירה מתחילת שבוע המשחק הקודם (צעד אחד אחורה; אפשר לבטל בשחזור נוסף).',
      'היכל התהילה נשמר בנפרד ולא נמחק כשמוחקים משבצת.',
    ],
  },
  decisions: {
    title: 'החלטות במשחק',
    items: [
      'ברירת המחדל: <b>צופים במשחק כמו בשידור</b>, עם חילופים, שערים וחגיגות. אפשר להאיץ פי 4 או לדלג לסיום.',
      'כשהמתג דלוק, המשחק <b>עוצר ברגעי מפתח</b> (מצב אחד על אחד, בעיטה חופשית, פנדל) ו{{אתה בוחר|את בוחרת}} מה לעשות.',
      'הבחירות משפיעות על הציון, על אמון המאמן ועל התוצאה. אפשר להחליף מצב בכל רגע, גם באמצע עונה.',
    ],
  },
  privacy: {
    title: 'מה אנחנו אוספים',
    items: [
      'רק נתונים <b>אנונימיים</b>: מזהה מכשיר אקראי, כמה זמן משחקים, ואירועים במשחק (למשל התחלת קריירה, שערים, פרישה).',
      '<b>בלי</b> שם, בלי מיקום, בלי אנשי קשר, בלי פרטים מהמכשיר.',
      'הנתונים עוזרים לנו להבין מה כיף ומה צריך לשפר. אפשר לכבות את השיתוף בכל רגע, והמשחק ימשיך לעבוד בדיוק אותו דבר.',
      'השמירה של הקריירה שלך נשארת במכשיר ולא נשלחת לשום מקום.',
    ],
  },
};

export async function render(root, params = {}) {
  // #/settings?sec=backup: the backup & restore sub-screen (export / import / slots / storage status)
  const sub = params.sec === 'backup';
  root.innerHTML = '<div class="loading-line">טוען הגדרות...</div>';
  let slots = [];
  let status = null;
  let busy = false;

  async function load() {
    try { slots = await save.listSlots(); } catch (e) { console.warn(e); slots = [1, 2, 3].map((n) => ({ slot: n, empty: true })); }
    try { status = await save.getStorageStatus(); } catch { status = null; }
  }

  function persistLine() {
    if (!status || status.persisted === null || status.persisted === undefined) return 'לא נתמך בדפדפן הזה';
    return status.persisted ? 'האחסון מוגן' : 'הדפדפן עלול למחוק נתונים כשהמכשיר מתמלא. מומלץ לגבות';
  }

  function slotLabel(s) {
    if (s.corrupt) return 'השמירה נפגמה';
    if (s.tooNew) return 'שמירה מגרסה חדשה';
    if (s.empty || !s.meta) return 'ריקה';
    return `${s.meta.name} · ${s.meta.clubHe || 'ללא קבוצה'} · ${s.meta.dateHe || ''}`;
  }

  function backupTpl() {
    const persisted = status && status.persisted === true;
    const yes = (v) => (v ? 'זמין' : 'לא זמין');
    return `<div class="set set-backup">
      <section class="set-group">
        <h2>המשבצות</h2>
        <div class="set-list">
          ${slots.map((s) => `<div class="set-slot slot-backup${s.empty && !s.corrupt && !s.hasDeleted ? ' is-empty' : ''}">
            <div class="sb-title"><b>משבצת ${s.slot}</b>${ctx.activeSlot === s.slot ? ' <span class="chip good">פעילה</span>' : ''}<small class="muted">${esc(gtext(slotLabel(s)))}${s.savedAt ? ' · ' + esc(ago(s.savedAt)) : ''}</small></div>
            ${!s.empty || s.corrupt || s.hasDeleted ? `<div class="btn-row wrap">
              ${!s.empty && !s.corrupt && !s.tooNew ? `<button type="button" class="btn btn-sm" data-act="exp-file" data-slot="${s.slot}" data-testid="btn-export-file-${s.slot}">${ico('download')}ייצוא קובץ</button>
              <button type="button" class="btn btn-sm" data-act="exp-code" data-slot="${s.slot}" data-testid="btn-export-code-${s.slot}">${ico('copy')}העתקת קוד</button>` : ''}
              ${s.hasPrev || s.corrupt ? `<button type="button" class="btn btn-sm btn-ghost" data-act="prev" data-slot="${s.slot}" data-testid="btn-restore-prev-${s.slot}">${ico('undo')}שמירה קודמת</button>` : ''}
              ${s.hasDeleted ? `<button type="button" class="btn btn-sm btn-ghost" data-act="undelete" data-slot="${s.slot}">שחזור קריירה שנמחקה</button>` : ''}
            </div>` : ''}</div>`).join('')}
        </div>
        <div class="btn-row"><button type="button" class="btn btn-sm" data-act="backup-all" data-testid="btn-backup-all">${ico('download')}גיבוי מלא (כל המשבצות + היכל התהילה)</button></div>
      </section>
      <section class="set-group">
        <h2>ייבוא גיבוי</h2>
        <div class="set-list"><div class="set-sub">
          <label class="file-btn btn btn-sm">${ico('folder')}בחירת קובץ גיבוי<input type="file" accept=".json,application/json,text/plain" data-testid="inp-import-file" data-act="file"></label>
          <label class="field"><span>או הדבקת קוד גיבוי</span><textarea data-testid="inp-import-code" id="imp-code" rows="2" placeholder="HY1:..." autocomplete="off" spellcheck="false"></textarea></label>
          <button type="button" class="btn btn-sm btn-primary" data-act="imp-code" data-testid="btn-import-code">ייבוא קוד</button>
        </div></div>
      </section>
      <section class="set-group">
        <h2>האחסון במכשיר</h2>
        <div class="set-list">
          <div class="set-row"><span class="set-ico ic-teal">${ICO.backup}</span><span class="set-txt"><b>${persisted ? 'השמירה מוגנת' : 'השמירה נמצאת במכשיר'}</b><small data-testid="persist-status">${esc(persistLine())}</small></span>
            <span class="set-end"><button type="button" class="help" data-act="help" data-help="save">איך זה עובד?</button></span></div>
          ${status && status.usage !== null && status.usage !== undefined ? `<div class="set-sub"><div class="kv"><span>נפח בשימוש</span><b class="num" dir="ltr">${esc(bytes(status.usage))}${status.quota ? ' / ' + esc(bytes(status.quota)) : ''}</b></div>
            <div class="kv"><span>localStorage</span><b>${yes(status.ls)}</b></div><div class="kv"><span>IndexedDB</span><b>${yes(status.idb)}</b></div></div>` : ''}
          ${persisted ? '' : `<div class="set-sub"><button type="button" class="btn btn-sm" data-act="persist">${ico('shield')}בקשת הגנה על האחסון</button></div>`}
        </div>
      </section>
    </div>`;
  }

  function draw() {
    if (sub) {
      try { setHeader({ title: 'גיבוי ושחזור', back: '#/settings' }); } catch { /* ignore */ }
      root.innerHTML = backupTpl();
      return;
    }
    const consent = (() => { try { return !!svc.telemetry.getConsent(); } catch { return false; } })();
    const rc = (() => { try { return svc.remote.getRemoteConfig(); } catch { return null; } })();
    const adsense = !!(rc && rc.ads && rc.ads.provider === 'adsense');
    const st = ctx.settings || {};
    const standalone = isStandalone();
    const persisted = status && status.persisted === true;
    const sound = (() => { try { return soundWanted(); } catch { return false; } })();
    const used = slots.filter((s) => !s.empty || s.corrupt);
    root.innerHTML = `<div class="set">
      <section class="set-group">
        <h2>המשחק</h2>
        <div class="set-list">
          ${toggleRow('sound', 'toggle-sound', sound, 'ic-violet', ICO.sound, 'צליל', 'קולות קהל ותופים')}
          ${toggleRow('decisions', 'toggle-decisions', !!st.decisions, 'ic-gold', ICO.decisions, 'החלטות במשחק', st.decisions ? 'עוצרים ברגעי מפתח ובוחרים' : 'צופים במשחק כמו בשידור', 'decisions')}
          ${linkRow('replay-intro', 'btn-replay-intro', 'ic-blue', ICO.intro, 'צפה בפתיחה', 'הפתיחה של 8 שניות')}
          ${toggleRow('rm', 'toggle-reduce-motion', !!st.reduceMotion, 'ic-slate', ICO.motion, 'הפחתת אנימציות', '')}
          ${toggleRow('hap', 'toggle-haptics', !!st.haptics, 'ic-slate', ICO.haptics, 'רטט', 'ברגעים חשובים במשחק')}
        </div>
      </section>

      <section class="set-group">
        <h2>גיבוי ושחזור</h2>
        <div class="set-list">
          <div class="set-row set-split" role="group">
            <button type="button" class="set-link" data-act="open-backup" data-testid="btn-open-backup">
              <span class="set-ico ic-teal">${ICO.backup}</span>
              <span class="set-txt"><b>גיבוי ושחזור</b><small>${esc(persisted ? 'השמירה מוגנת · ייצוא, ייבוא ומשבצות' : 'ייצוא, ייבוא ומשבצות · מומלץ לגבות')}</small></span>
            </button>
            <span class="set-end"><button type="button" class="help" data-act="help" data-help="save" data-testid="btn-help-save">איך זה עובד?</button></span>
            <button type="button" class="set-chev" data-act="open-backup" aria-label="גיבוי ושחזור">${CHEV}</button>
          </div>
        </div>
      </section>

      <section class="set-group">
        <h2>האפליקציה</h2>
        <div class="set-list">
          ${standalone ? rowStatic('ic-green', ICO.install, 'התקנה למסך הבית', 'המשחק מותקן במכשיר') : linkRow('install', 'btn-install', 'ic-green', ICO.install, 'התקנה למסך הבית', 'מסך מלא, בלי אינטרנט ושמירה מוגנת יותר')}
          ${linkRow('rate', 'btn-open-feedback', 'ic-gold', ICO.star, 'דרג את המשחק', 'רעיון, באג או מחמאה? נשמח לשמוע')}
          ${linkRow('update', 'btn-check-update', 'ic-blue', ICO.update, 'בדיקת עדכונים', 'גרסה ' + APP_VERSION)}
        </div>
      </section>

      <section class="set-group">
        <h2>פרטיות</h2>
        <div class="set-list">
          ${toggleRow('tm', 'toggle-telemetry', consent, 'ic-teal', ICO.privacy, 'נתוני שימוש אנונימיים', 'עוזר לנו לשפר את המשחק', 'privacy')}
          ${adsense ? toggleRow('ads-consent', 'toggle-ads-consent', !!st.adsConsent, 'ic-orange', ICO.ads, 'פרסומות מותאמות (Google)', 'רק בהסכמה שלך') : ''}
          ${linkRow('help-privacy', 'btn-privacy', 'ic-slate', ICO.doc, 'מה אנחנו אוספים', 'בלי שם, בלי מיקום, בלי אנשי קשר')}
        </div>
      </section>

      <section class="set-group set-danger">
        <h2>אזור מסוכן</h2>
        <div class="set-list">
          ${used.length ? used.map((s) => `<button type="button" class="set-row" data-act="delete" data-slot="${s.slot}" data-testid="btn-delete-slot-${s.slot}">
              <span class="set-ico ic-red">${ICO.trash}</span>
              <span class="set-txt"><b>מחיקת משבצת ${s.slot}</b><small>${esc(gtext(slotLabel(s)))}</small></span>
              <span class="set-end">${CHEV}</span></button>`).join('') : rowStatic('ic-slate', ICO.trash, 'אין משבצות למחיקה', 'היכל התהילה לא נמחק אף פעם')}
        </div>
      </section>

      <p class="set-foot"><b>הילד מהשכונה ${esc(APP_VERSION)}</b> · מהשכונה ועד הבאלון ד'אור<br>כל השחקנים במשחק בדויים. שמות הקבוצות והמדינות לשם האווירה בלבד.<br>
        <button type="button" class="btn btn-sm btn-ghost" data-act="title" style="margin-top:8px">למסך הפתיחה</button></p>
    </div>`;
  }

  function toggleRow(act, testid, on, ic, ico, title, sub, help) {
    return `<label class="set-row">
      <span class="set-ico ${ic}">${ico}</span>
      <span class="set-txt"><b>${esc(gtext(title))}</b>${sub ? `<small>${esc(gtext(sub))}</small>` : ''}</span>
      ${help ? `<span class="set-end"><button type="button" class="help" data-act="help" data-help="${help}" data-testid="btn-help-${help}">איך זה עובד?</button></span>` : ''}
      <span class="sw"><input type="checkbox" role="switch" data-act="${act}"${testid ? ` data-testid="${testid}"` : ''} ${on ? 'checked' : ''} aria-label="${esc(gtext(title))}"><i aria-hidden="true"></i></span>
    </label>`;
  }
  function linkRow(act, testid, ic, ico, title, sub) {
    return `<button type="button" class="set-row" data-act="${act}" data-testid="${testid}">
      <span class="set-ico ${ic}">${ico}</span>
      <span class="set-txt"><b>${esc(gtext(title))}</b>${sub ? `<small>${esc(gtext(sub))}</small>` : ''}</span>
      <span class="set-end">${CHEV}</span></button>`;
  }
  function rowStatic(ic, ico, title, sub) {
    return `<div class="set-row"><span class="set-ico ${ic}">${ico}</span><span class="set-txt"><b>${esc(gtext(title))}</b>${sub ? `<small>${esc(gtext(sub))}</small>` : ''}</span></div>`;
  }

  function showHelp(key) {
    const h = HELP[key];
    if (!h) return;
    openModal(`<div class="howto"><h2 class="modal-title">${esc(gtext(h.title))}</h2><ul>${h.items.map((t) => `<li>${gtext(t)}</li>`).join('')}</ul>
      <div class="btn-row"><button type="button" class="btn btn-primary" data-close>הבנתי</button></div></div>`, { sheet: true, testid: 'help-' + key });
  }

  async function refresh() { await load(); draw(); }

  function track(name, props) { try { svc.telemetry.track(name, props); } catch { /* ignore */ } }

  async function exportFile(slot) {
    if (slot === ctx.activeSlot && ctx.hooks.saveNow) { ctx.hooks.saveNow(); await ctx.hooks.flush(); }
    const { filename, json } = await save.exportSlotJSON(slot);
    save.downloadFile(filename, json);
    track('backup_export', { kind: 'file' });
    toast('הקובץ נשמר ✓ כדאי לשמור אותו במקום בטוח');
  }

  async function exportCode(slot) {
    if (slot === ctx.activeSlot && ctx.hooks.saveNow) { ctx.hooks.saveNow(); await ctx.hooks.flush(); }
    const code = await save.exportSlotCode(slot);
    track('backup_export', { kind: 'code' });
    const long = code.length > 60000;
    const close = openModal(`<h2 class="modal-title">קוד גיבוי · משבצת ${slot}</h2>
      <p class="muted small">מעתיקים את הקוד ושומרים אותו בפתקים או שולחים לעצמכם בוואטסאפ. במכשיר החדש: הגדרות ← "או הדבקת קוד גיבוי".</p>
      ${long ? '<p class="note warn">הקוד ארוך מאוד (וואטסאפ חותך הודעות ארוכות). מומלץ להשתמש ב"ייצוא קובץ" במקום.</p>' : ''}
      <textarea class="code-box" data-testid="export-code-text" readonly rows="6"></textarea>
      <div class="btn-row"><button type="button" class="btn btn-primary" data-a="copy" data-testid="btn-copy-code">${ico('copy')}העתק</button><button type="button" class="btn btn-ghost" data-close>סגור</button></div>`,
    { testid: 'export-code' });
    const ta = close.el.querySelector('textarea');
    ta.value = code;
    close.el.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-a="copy"]')) return;
      let ok = false;
      try { await navigator.clipboard.writeText(code); ok = true; } catch { ok = false; }
      if (!ok) {
        try { ta.focus(); ta.select(); ta.setSelectionRange(0, code.length); ok = document.execCommand && document.execCommand('copy'); } catch { ok = false; }
      }
      toast(ok ? 'הקוד הועתק ✓' : 'אפשר לסמן את הקוד ולהעתיק ידנית');
    });
  }

  function pickSlot(meta) {
    return new Promise((resolve) => {
      let picked = null;
      const close = openModal(`<h2 class="modal-title">לאיזו משבצת לייבא?</h2>
        ${meta ? `<p class="small">${esc(meta.flag || '')} ${esc(meta.name || '')} · ${esc(meta.clubHe || '')} · ${esc(meta.dateHe || '')}</p>` : ''}
        <div class="btn-col">${slots.map((s) => `<button type="button" class="btn" data-s="${s.slot}" data-testid="import-slot-${s.slot}"><b>משבצת ${s.slot}</b> <small class="muted">${esc(slotLabel(s))}</small></button>`).join('')}
        <button type="button" class="btn btn-ghost" data-close>ביטול</button></div>`, { sheet: true, testid: 'import-pick', onClose: () => resolve(picked) });
      close.el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-s]');
        if (!b) return;
        picked = Number(b.dataset.s);
        close();
      });
    });
  }

  async function doImport(text, source) {
    if (!text || !String(text).trim()) { toast('אין מה לייבא'); return; }
    let parsed;
    try { parsed = await save.parseImport(String(text)); } catch (e) { console.warn(e); parsed = null; }
    if (!parsed || !parsed.ok) { toast((parsed && parsed.messageHe) || 'הקוד או הקובץ לא תקינים'); return; }
    if (parsed.kind === 'backup') {
      const ok = await confirmDialog({ title: 'לשחזר גיבוי מלא?', text: 'המשבצות שבגיבוי ייכתבו מחדש (קריירות קיימות יישמרו כעותק שאפשר לשחזר). היכל התהילה יאוחד.', yes: 'שחזר' });
      if (!ok) return;
      if (ctx.hooks.cancelAutosave) ctx.hooks.cancelAutosave();
      let r = null;
      try { r = await save.importBackup(parsed); } catch (e) { console.warn(e); }
      if (!r || !r.ok) { toast('הייבוא נכשל'); return; }
      if (ctx.activeSlot && (r.slots || []).includes(ctx.activeSlot) && ctx.hooks.reloadActive) await ctx.hooks.reloadActive();
      track('backup_import', { kind: 'backup' });
      toast(`שוחזרו ${(r.slots || []).length} משבצות ו-${r.hof || 0} רשומות בהיכל ✓`);
      await refresh();
      return;
    }
    const slot = await pickSlot(parsed.meta);
    if (!slot) return;
    const info = slots.find((s) => s.slot === slot);
    if (info && (!info.empty || info.corrupt)) {
      const ok = await confirmDialog({ title: 'להחליף את המשבצת?', text: 'הקריירה שבמשבצת תישמר כעותק שאפשר לשחזר ("שחזר קריירה שנמחקה").', yes: 'החלף' });
      if (!ok) return;
    }
    const r = await ctx.hooks.slotOp(slot, () => save.importToSlot(parsed, slot), 'import');
    if (r && r.ok) {
      track('backup_import', { kind: source });
      toast('הקריירה יובאה למשבצת ' + slot + ' ✓');
      const ta = root.querySelector('#imp-code');
      if (ta) ta.value = '';
    } else toast((r && r.messageHe) || 'הייבוא נכשל');
    await refresh();
  }

  root.addEventListener('change', async (e) => {
    const el = e.target;
    const act = el.dataset && el.dataset.act;
    if (act === 'tm') { try { svc.telemetry.setConsent(!!el.checked); } catch { /* ignore */ } toast(el.checked ? 'תודה! זה עוזר לנו לשפר' : 'שיתוף הנתונים כובה'); }
    else if (act === 'ads-consent') { saveSettings({ adsConsent: !!el.checked }); if (ctx.hooks.reinitAds) ctx.hooks.reinitAds(); }
    else if (act === 'rm') saveSettings({ reduceMotion: !!el.checked });
    else if (act === 'decisions') { saveSettings({ decisions: !!el.checked }); toast(el.checked ? 'רגעי המפתח הודלקו' : 'מצב צפייה: המשחקים ירוצו כמו בשידור'); draw(); }
    else if (act === 'sound') { try { setSound(!!el.checked); } catch { /* ignore */ } }
    else if (act === 'hap') saveSettings({ haptics: !!el.checked });
    else if (act === 'file') {
      const f = el.files && el.files[0];
      if (!f) return;
      let text = '';
      try { text = await f.text(); } catch { toast('לא הצלחנו לקרוא את הקובץ'); return; }
      el.value = '';
      await doImport(text, 'file');
    }
  });

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b) || b.tagName === 'INPUT') return;
    const act = b.dataset.act;
    if (act === 'help' || act === 'help-privacy') { e.preventDefault(); e.stopPropagation(); showHelp(act === 'help' ? b.dataset.help : 'privacy'); return; }
    if (act === 'install') { navigate('#/install'); return; }
    if (act === 'open-backup') { navigate('#/settings?sec=backup'); return; }
    if (act === 'rate') { navigate('#/feedback'); return; }
    const slot = Number(b.dataset.slot) || null;
    if (busy) return;
    busy = true;
    try {
      if (act === 'persist') {
        const r = ctx.hooks.requestPersist ? await ctx.hooks.requestPersist(true) : await save.requestPersist();
        toast(r === 'granted' ? 'האחסון מוגן ✓' : r === 'unsupported' ? 'לא נתמך בדפדפן הזה' : 'הדפדפן לא אישר כרגע. התקנה למסך הבית עוזרת.');
        await refresh();
      } else if (act === 'exp-file') await exportFile(slot);
      else if (act === 'exp-code') await exportCode(slot);
      else if (act === 'backup-all') {
        if (ctx.hooks.saveNow) { ctx.hooks.saveNow(); await ctx.hooks.flush(); }
        const { filename, json } = await save.exportBackupJSON();
        save.downloadFile(filename, json);
        track('backup_export', { kind: 'backup' });
        toast('הגיבוי המלא נשמר ✓');
      } else if (act === 'imp-code') {
        const ta = root.querySelector('#imp-code');
        await doImport(ta ? ta.value : '', 'code');
      } else if (act === 'prev') {
        const ok = await confirmDialog({ title: 'לשחזר שמירה קודמת?', text: 'המשחק יחזור לשמירה מתחילת שבוע המשחק הקודם. אפשר לבטל בשחזור נוסף.', yes: 'שחזר' });
        if (ok) {
          const r = await ctx.hooks.slotOp(slot, () => save.restorePrevious(slot), 'restore');
          toast(r && r.ok ? 'השמירה הקודמת שוחזרה ✓' : (r && r.messageHe) || 'אין שמירה קודמת לשחזור');
          await refresh();
        }
      } else if (act === 'undelete') {
        const r = await ctx.hooks.slotOp(slot, () => save.restoreDeleted(slot), 'restore');
        toast(r && r.ok ? 'הקריירה שוחזרה ✓' : (r && r.messageHe) || 'לא הצלחנו לשחזר');
        await refresh();
      } else if (act === 'delete') {
        const idb = !!(ctx.storage && ctx.storage.idb);
        const ok1 = await confirmDialog({ title: `למחוק את משבצת ${slot}?`, text: idb ? 'אפשר יהיה לשחזר אותה ממסך הפתיחה ("שחזר קריירה שנמחקה"), עד ש{{תתחיל|תתחילי}} בה קריירה חדשה.' : 'בדפדפן הזה המחיקה סופית.', yes: 'מחיקה', danger: true });
        if (ok1) {
          const ok2 = await confirmDialog({ title: 'בטוח בטוח?', text: 'היכל התהילה לא יימחק.', yes: 'כן, למחוק', danger: true });
          if (ok2) {
            await ctx.hooks.slotOp(slot, () => save.deleteSlot(slot), 'delete');
            toast('המשבצת נמחקה');
            await refresh();
          }
        }
      } else if (act === 'replay-intro') {
        try { await playIntro({ force: true, gender: currentGender() }); } catch (err) { console.warn('[hayeled] intro', err); }
      } else if (act === 'update') { if (ctx.hooks.checkUpdates) await ctx.hooks.checkUpdates(); }
      else if (act === 'title') navigate('#/title');
    } catch (err) {
      console.warn('[hayeled] settings action', err);
      toast('הפעולה נכשלה. נסו שוב.');
    } finally {
      busy = false;
    }
  });

  await load();
  draw();
}
