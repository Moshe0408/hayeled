// settings.js: #/settings. Where progress lives, backup/export/import, rollback, storage status, privacy, display, about.
import * as save from '../core/save.js';
import { APP_VERSION } from '../config.js';
import { esc } from './dom.js';
import { ctx, svc, toast, openModal, confirmDialog, saveSettings } from './app.js';
import { navigate } from './router.js';
import { isStandalone } from './install.js';
import { bytes, ago } from './format.js';

export async function render(root) {
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
    return status.persisted ? 'האחסון מוגן ✓' : 'הדפדפן עלול למחוק נתונים כשהמכשיר מתמלא. מומלץ לגבות';
  }

  function slotLabel(s) {
    if (s.corrupt) return 'השמירה נפגמה';
    if (s.tooNew) return 'שמירה מגרסה חדשה';
    if (s.empty || !s.meta) return 'ריקה';
    return `${s.meta.name} · ${s.meta.clubHe || 'ללא קבוצה'} · ${s.meta.dateHe || ''}`;
  }

  function draw() {
    const consent = (() => { try { return !!svc.telemetry.getConsent(); } catch { return false; } })();
    const rc = (() => { try { return svc.remote.getRemoteConfig(); } catch { return null; } })();
    const adsense = !!(rc && rc.ads && rc.ads.provider === 'adsense');
    const st = ctx.settings || {};
    const standalone = isStandalone();
    const persisted = status && status.persisted === true;
    root.innerHTML = `<div class="settings">
      <section class="card">
        <h2 class="card-title">💾 השמירה וההתקדמות שלך</h2>
        <ul class="explain">
          <li>ההתקדמות נשמרת <b>אוטומטית אחרי כל פעולה</b>, על המכשיר הזה, בשני מקומות בדפדפן (localStorage ו-IndexedDB). אם אחד מהם נפגם, המשחק משחזר מהשני.</li>
          <li>ההתקדמות <b>לא נשמרת בשרת</b>. מחיקת נתוני הדפדפן או נתוני האתר תמחק אותה.</li>
          <li>כדי לעבור לטלפון אחר או לשמור עותק: <b>"ייצוא קובץ"</b> או <b>"העתק קוד גיבוי"</b>, ואז ייבוא במכשיר החדש.</li>
          <li>מומלץ להתקין את המשחק למסך הבית. זה מקטין את הסיכוי למחיקה, במיוחד באייפון (Safari עלול למחוק נתוני אתר אחרי כ-7 ימים בלי ביקור).</li>
          <li>באייפון, לאפליקציה המותקנת ול-Safari יש התקדמות <b>נפרדת</b>: ייצא קוד גיבוי לפני ההתקנה וייבא אותו בתוך האפליקציה.</li>
          <li><b>"שחזר שמירה קודמת"</b> מחזיר לשמירה מתחילת שבוע המשחק הקודם (צעד אחד אחורה; אפשר לבטל בשחזור נוסף).</li>
          <li>היכל התהילה נשמר בנפרד ולא נמחק כשמוחקים משבצת.</li>
        </ul>
        <div class="storage-status${persisted ? ' ok' : ''}"><span data-testid="persist-status">${esc(persistLine())}</span>
          ${status && status.usage !== null && status.usage !== undefined ? `<small class="muted">בשימוש: ${esc(bytes(status.usage))}${status.quota ? ' מתוך ' + esc(bytes(status.quota)) : ''}</small>` : ''}
          <small class="muted">localStorage: ${status && status.ls ? '✓' : '✗'} · IndexedDB: ${status && status.idb ? '✓' : '✗'}</small></div>
        ${persisted ? '' : '<button type="button" class="btn" data-act="persist">🛡️ בקש הגנה על האחסון</button>'}
      </section>

      <section class="card">
        <h2 class="card-title">📦 גיבוי ושחזור</h2>
        ${slots.map((s) => `<div class="slot-backup">
          <div class="sb-title"><b>משבצת ${s.slot}</b>${ctx.activeSlot === s.slot ? ' <span class="chip good">פעילה</span>' : ''}<small class="muted">${esc(slotLabel(s))}${s.savedAt ? ' · ' + esc(ago(s.savedAt)) : ''}</small></div>
          <div class="btn-row wrap">
            ${!s.empty && !s.corrupt && !s.tooNew ? `<button type="button" class="btn btn-sm" data-act="exp-file" data-slot="${s.slot}" data-testid="btn-export-file-${s.slot}">ייצוא קובץ</button>
            <button type="button" class="btn btn-sm" data-act="exp-code" data-slot="${s.slot}" data-testid="btn-export-code-${s.slot}">העתק קוד</button>` : ''}
            ${s.hasPrev || s.corrupt ? `<button type="button" class="btn btn-sm btn-ghost" data-act="prev" data-slot="${s.slot}" data-testid="btn-restore-prev-${s.slot}">שחזר שמירה קודמת</button>` : ''}
            ${s.hasDeleted ? `<button type="button" class="btn btn-sm btn-ghost" data-act="undelete" data-slot="${s.slot}">שחזר קריירה שנמחקה</button>` : ''}
          </div></div>`).join('')}
        <button type="button" class="btn" data-act="backup-all" data-testid="btn-backup-all">גיבוי מלא (כל המשבצות + היכל התהילה)</button>
        <h3 class="sub">ייבוא</h3>
        <label class="file-btn btn">📂 בחר קובץ גיבוי<input type="file" accept=".json,application/json,text/plain" data-testid="inp-import-file" data-act="file"></label>
        <label class="field"><span>או הדבק קוד גיבוי</span><textarea data-testid="inp-import-code" id="imp-code" rows="3" placeholder="HY1:..." autocomplete="off" spellcheck="false"></textarea></label>
        <button type="button" class="btn btn-primary" data-act="imp-code" data-testid="btn-import-code">ייבא קוד</button>
      </section>

      <section class="card">
        <h2 class="card-title">🔒 פרטיות</h2>
        <label class="toggle"><input type="checkbox" data-act="tm" data-testid="toggle-telemetry" ${consent ? 'checked' : ''}><span>שתף נתוני שימוש אנונימיים</span></label>
        <p class="muted small">אנחנו אוספים נתונים אנונימיים בלבד (מזהה מכשיר אקראי, כמה זמן משחקים, אירועים במשחק) כדי לשפר את המשחק. בלי שם, בלי מיקום, בלי אנשי קשר.</p>
        ${adsense ? `<label class="toggle"><input type="checkbox" data-act="ads-consent" ${st.adsConsent ? 'checked' : ''}><span>אני מסכים לפרסומות מותאמות (Google)</span></label>` : ''}
      </section>

      ${standalone ? '' : '<section class="card"><h2 class="card-title">📲 התקנה</h2><p class="small">התקנה למסך הבית: מסך מלא, משחק בלי אינטרנט, ושמירה מוגנת יותר.</p><a class="btn" href="#/install">איך מתקינים?</a></section>'}

      <section class="card">
        <h2 class="card-title">💬 משוב</h2>
        <p class="small">יש לך רעיון, באג או סתם מחמאה? נשמח לשמוע.</p>
        <a class="btn" href="#/feedback" data-testid="btn-open-feedback">שלח משוב</a>
      </section>

      <section class="card">
        <h2 class="card-title">🎨 תצוגה</h2>
        <label class="toggle"><input type="checkbox" data-act="rm" ${st.reduceMotion ? 'checked' : ''}><span>הפחת אנימציות</span></label>
        <label class="toggle"><input type="checkbox" data-act="hap" ${st.haptics ? 'checked' : ''}><span>רטט ברגעים במשחק</span></label>
      </section>

      <section class="card">
        <h2 class="card-title">ℹ️ אודות</h2>
        <div class="kv"><span>גרסה</span><b class="num">${esc(APP_VERSION)}</b></div>
        <div class="btn-row wrap"><button type="button" class="btn btn-sm" data-act="update">בדוק עדכונים</button>
          <button type="button" class="btn btn-sm btn-ghost" data-act="title">למסך הפתיחה</button></div>
        <p class="muted small">הילד מהשכונה · מהשכונה ועד הבאלון ד'אור. כל השחקנים במשחק בדויים. שמות הקבוצות והמדינות לשם האווירה בלבד.</p>
      </section>

      <section class="card danger-zone">
        <h2 class="card-title">⚠️ אזור מסוכן</h2>
        ${slots.filter((s) => !s.empty || s.corrupt).map((s) => `<div class="kv"><span>משבצת ${s.slot}: ${esc(slotLabel(s))}</span><button type="button" class="btn btn-sm btn-danger" data-act="delete" data-slot="${s.slot}" data-testid="btn-delete-slot-${s.slot}">מחק משבצת</button></div>`).join('') || '<p class="muted small">אין משבצות למחיקה.</p>'}
      </section>
    </div>`;
  }

  async function refresh() { await load(); draw(); }

  function track(name, props) { try { svc.telemetry.track(name, props); } catch { /* ignore */ } }

  async function exportFile(slot) {
    if (slot === ctx.activeSlot && ctx.hooks.saveNow) { ctx.hooks.saveNow(); await ctx.hooks.flush(); }
    const { filename, json } = await save.exportSlotJSON(slot);
    save.downloadFile(filename, json);
    track('backup_export', { kind: 'file' });
    toast('הקובץ נשמר ✓ שמור אותו במקום בטוח');
  }

  async function exportCode(slot) {
    if (slot === ctx.activeSlot && ctx.hooks.saveNow) { ctx.hooks.saveNow(); await ctx.hooks.flush(); }
    const code = await save.exportSlotCode(slot);
    track('backup_export', { kind: 'code' });
    const long = code.length > 60000;
    const close = openModal(`<h2 class="modal-title">קוד גיבוי · משבצת ${slot}</h2>
      <p class="muted small">העתק את הקוד ושמור אותו בפתקים או שלח לעצמך בוואטסאפ. במכשיר החדש: הגדרות ← "הדבק קוד גיבוי".</p>
      ${long ? '<p class="note warn">הקוד ארוך מאוד (וואטסאפ חותך הודעות ארוכות). מומלץ להשתמש ב"ייצוא קובץ" במקום.</p>' : ''}
      <textarea class="code-box" data-testid="export-code-text" readonly rows="6"></textarea>
      <div class="btn-row"><button type="button" class="btn btn-primary" data-a="copy" data-testid="btn-copy-code">📋 העתק</button><button type="button" class="btn btn-ghost" data-close>סגור</button></div>`,
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
      toast(ok ? 'הקוד הועתק ✓' : 'סמן את הקוד והעתק ידנית');
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
        const ok1 = await confirmDialog({ title: `למחוק את משבצת ${slot}?`, text: idb ? 'אפשר יהיה לשחזר אותה ממסך הפתיחה ("שחזר קריירה שנמחקה"), עד שתתחיל בה קריירה חדשה.' : 'בדפדפן הזה המחיקה סופית.', yes: 'המשך', danger: true });
        if (ok1) {
          const ok2 = await confirmDialog({ title: 'בטוח בטוח?', text: 'היכל התהילה לא יימחק.', yes: 'כן, מחק', danger: true });
          if (ok2) {
            await ctx.hooks.slotOp(slot, () => save.deleteSlot(slot), 'delete');
            toast('המשבצת נמחקה');
            await refresh();
          }
        }
      } else if (act === 'update') { if (ctx.hooks.checkUpdates) await ctx.hooks.checkUpdates(); }
      else if (act === 'title') navigate('#/title');
    } catch (err) {
      console.warn('[hayeled] settings action', err);
      toast('הפעולה נכשלה. נסה שוב.');
    } finally {
      busy = false;
    }
  });

  await load();
  draw();
}
