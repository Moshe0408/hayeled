// save.js: dual-store save system (SPEC §1.4, §7).
// Primary: localStorage (synchronous). Mirror: IndexedDB 'hayeled'/'kv' (same keys, same strings).
// Every record carries a checksum, a sequence number, savedAt and the schema version; on load the
// newest valid copy wins and the other store is healed. Never throws for storage problems.

import { idbAvailable, idbOpen, idbGet, idbSet, idbDel, idbKeys } from './idb.js';

export const SLOTS = [1, 2, 3];

const REC_PREFIX = 'HYS1';
const HOF_PREFIX = 'HYH1';
const K_HOF = 'hy.hof';
const K_HOF_PREV = 'hy.hof.prev';
const K_TM_QUEUE = 'hy.tm.q';
const CORRUPT_KEEP = 3;

const MSG = {
  quota: 'האחסון במכשיר כמעט מלא. ההתקדמות נשמרת, אבל מומלץ לייצא גיבוי.',
  ls_full_idb_only: 'ההתקדמות נשמרת רק במאגר אחד של הדפדפן (IndexedDB). מומלץ לייצא גיבוי מדי פעם.',
  save_failed: 'המכשיר לא מאפשר שמירה (אולי גלישה פרטית?). ההתקדמות לא תישמר. מומלץ לייצא קוד גיבוי.',
  too_new: 'השמירה נוצרה בגרסה חדשה יותר של המשחק. רענן כדי לעדכן.',
  corrupt: 'השמירה נפגמה. נסה "שחזר שמירה קודמת" או ייבוא גיבוי.',
  empty: 'המשבצת ריקה',
  no_prev: 'אין שמירה קודמת לשחזור',
  no_deleted: 'אין קריירה מחוקה לשחזור',
  bad_format: 'הקובץ או הקוד לא מזוהים כגיבוי של הילד מהשכונה',
  bad_checksum: 'הגיבוי פגום (בדיקת תקינות נכשלה). נסה להעתיק אותו שוב במלואו.',
  unsupported_code: 'הדפדפן הזה לא יכול לפתוח קוד מכווץ. נסה לייבא קובץ במקום.',
  migrate_failed: 'לא הצלחנו לעדכן את השמירה לגרסה הנוכחית.',
};

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------
const cfg = { schemaVersion: 1, appVersion: '0.0.0', migrate: (d) => d };
let lsOk = false;
let idbOk = false;
let inited = false;

const lastSeq = {};      // slot -> max seq seen over all copies and tombstones
const lastSum = {};      // slot -> sum of the last record written/loaded (cur)
const lastHdr = {};      // slot -> header of the last record written/loaded (cur)
const lastRec = {};      // slot -> full record string of the last record written/loaded (cur)
const tooNew = {};       // slot -> best record is from a newer schema
const touched = new Set();   // slots this tab saved or loaded
const blocked = new Set();   // slots another tab wrote after we touched them

const warnCbs = new Set();
const extCbs = new Set();
const warnedOnce = new Set();
let lastQuotaWarnAt = 0;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
export function fnv1a(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const now = () => Date.now();
const kCur = (n) => `hy.slot.${n}`;
const kPrev = (n) => `hy.slot.${n}.prev`;
const kDel = (n) => `hy.slot.${n}.deleted`;
const kTomb = (n) => `hy.slot.${n}.tomb`;
const kCorruptPrefix = (n) => `hy.corrupt.${n}.`;

function checkSlot(slot) {
  const n = Number(slot);
  if (!SLOTS.includes(n)) throw new Error('save.js: bad slot ' + slot);
  return n;
}

function emitWarning(code, messageHe) {
  for (const cb of [...warnCbs]) {
    try { cb({ code, messageHe }); } catch { /* listener errors are not ours */ }
  }
}
function warnOnce(code) {
  if (warnedOnce.has(code)) return;
  warnedOnce.add(code);
  emitWarning(code, MSG[code]);
}
function warnQuota() {
  const t = now();
  if (t - lastQuotaWarnAt < 10 * 60 * 1000) return;
  lastQuotaWarnAt = t;
  emitWarning('quota', MSG.quota);
}

function getLS() {
  try { return globalThis.localStorage || null; } catch { return null; }
}
function lsGet(key) {
  if (!lsOk) return null;
  try { const v = getLS().getItem(key); return typeof v === 'string' ? v : null; } catch { return null; }
}
function lsSet(key, value) {
  if (!lsOk) return false;
  try { getLS().setItem(key, value); return true; } catch { return false; }
}
function lsDel(key) {
  if (!lsOk) return;
  try { getLS().removeItem(key); } catch { /* ignore */ }
}
function testLS() {
  const ls = getLS();
  if (!ls) return false;
  try {
    const k = 'hy.__probe';
    ls.setItem(k, '1');
    const ok = ls.getItem(k) === '1';
    ls.removeItem(k);
    return ok;
  } catch {
    // A full storage also throws on the probe; reading still works then.
    try { ls.getItem('hy.__probe'); return true; } catch { return false; }
  }
}

function safeJSON(s) {
  try { return JSON.parse(s); } catch { return undefined; }
}

// ---------------------------------------------------------------------------
// IDB write queue: one sequential chain, coalesced to the latest value per key.
// ---------------------------------------------------------------------------
const pending = new Map();   // key -> { del: boolean, v: string|null, critical: boolean }
let running = null;

function queueIdb(key, value, critical = false) {
  if (!idbOk) return;
  const prevOp = pending.get(key);
  if (prevOp) pending.delete(key);   // re-insert so the key order follows the latest write
  pending.set(key, { del: value === null, v: value, critical: critical || false });
  kick();
}

function kick() {
  if (running) return running;
  running = (async () => {
    try {
      while (pending.size) {
        const batch = [...pending.entries()];
        pending.clear();
        for (const [key, o] of batch) {
          // A newer value for this key arrived meanwhile: skip, the next round writes it.
          if (pending.has(key)) continue;
          const ok = o.del ? await idbDel(key) : await idbSet(key, o.v);
          if (!ok && o.critical) warnOnce('save_failed');
        }
      }
    } finally {
      running = null;
    }
  })();
  return running;
}

export function flushPending() {
  if (!running && !pending.size) return Promise.resolve();
  return (running || kick()).then(() => (pending.size ? flushPending() : undefined));
}

async function idbRead(key) {
  if (!idbOk) return null;
  await flushPending();
  return idbGet(key);
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------
function buildRecord(slot, seq, savedAt, v, dataJSON, meta) {
  const header = { slot, seq, savedAt, v, app: cfg.appVersion, sum: fnv1a(dataJSON), len: dataJSON.length, meta: meta || null };
  return { header, raw: REC_PREFIX + '\n' + JSON.stringify(header) + '\n' + dataJSON };
}

// -> null | { status:'valid'|'too_new'|'invalid', header, dataJSON, raw }
function parseRecord(raw, prefix = REC_PREFIX) {
  if (typeof raw !== 'string' || !raw.length) return null;
  const bad = { status: 'invalid', header: null, dataJSON: null, raw };
  const i1 = raw.indexOf('\n');
  if (i1 < 0 || raw.slice(0, i1) !== prefix) return bad;
  const i2 = raw.indexOf('\n', i1 + 1);
  if (i2 < 0) return bad;
  const header = safeJSON(raw.slice(i1 + 1, i2));
  if (!header || typeof header !== 'object' || typeof header.seq !== 'number' || !isFinite(header.seq)) return bad;
  const dataJSON = raw.slice(i2 + 1);
  if (dataJSON.length !== header.len || fnv1a(dataJSON) !== header.sum) return { ...bad, header };
  const v = Number(header.v) || 0;
  if (prefix === REC_PREFIX && v > cfg.schemaVersion) return { status: 'too_new', header, dataJSON, raw };
  return { status: 'valid', header, dataJSON, raw };
}

function headerSeqOf(raw) {
  // Cheap header-only peek (used by the storage event).
  if (typeof raw !== 'string') return null;
  const i1 = raw.indexOf('\n');
  const i2 = i1 < 0 ? -1 : raw.indexOf('\n', i1 + 1);
  if (i2 < 0) return null;
  const h = safeJSON(raw.slice(i1 + 1, i2));
  return h && typeof h.seq === 'number' ? h.seq : null;
}

const weekKey = (h) => {
  const m = h && h.meta;
  if (!m) return null;
  return (Number(m.season) || 0) * 52 + (Number(m.week) || 0);
};
const careerOf = (h) => (h && h.meta ? h.meta.careerId : null);

function parseTomb(raw) {
  const t = safeJSON(raw);
  return t && typeof t.seq === 'number' ? t.seq : -1;
}

// Reads every copy of a slot. order matters for tie-breaks: LS cur, IDB cur, LS prev, IDB prev.
async function readSlot(slot) {
  const rawLsCur = lsGet(kCur(slot));
  const rawLsPrev = lsGet(kPrev(slot));
  const rawLsTomb = lsGet(kTomb(slot));
  let rawIdbCur = null, rawIdbPrev = null, rawIdbTomb = null;
  if (idbOk) {
    await flushPending();
    [rawIdbCur, rawIdbPrev, rawIdbTomb] = await Promise.all([idbGet(kCur(slot)), idbGet(kPrev(slot)), idbGet(kTomb(slot))]);
  }
  const tomb = Math.max(parseTomb(rawLsTomb), parseTomb(rawIdbTomb));
  const defs = [
    ['ls', 'cur', rawLsCur, 'ls'],
    ['idb', 'cur', rawIdbCur, 'idb'],
    ['ls', 'prev', rawLsPrev, 'ls-prev'],
    ['idb', 'prev', rawIdbPrev, 'idb-prev'],
  ];
  const all = [];
  const raws = { ls: { cur: rawLsCur, prev: rawLsPrev }, idb: { cur: rawIdbCur, prev: rawIdbPrev } };
  let maxSeq = Math.max(tomb, 0);
  let corruptRaw = [];
  defs.forEach(([store, which, raw, source], order) => {
    const p = parseRecord(raw);
    if (!p) return;
    if (p.header && typeof p.header.seq === 'number') maxSeq = Math.max(maxSeq, p.header.seq);
    if (p.status === 'invalid') {
      // A tombstoned leftover that is also damaged is ignored like any tombstoned copy.
      if (!(p.header && p.header.seq <= tomb)) corruptRaw.push({ src: source, raw });
      return;
    }
    if (p.header.seq <= tomb) return;
    all.push({ ...p, store, which, source, order });
  });
  all.sort((a, b) => (b.header.seq - a.header.seq) || ((b.header.savedAt || 0) - (a.header.savedAt || 0)) || (a.order - b.order));
  const best = all[0] || null;
  let prev = null;
  if (best && best.status === 'valid') {
    const bk = weekKey(best.header);
    const lower = all.filter((c) => c.status === 'valid' && c.header.seq < best.header.seq);
    prev = lower.find((c) => careerOf(c.header) === careerOf(best.header) && weekKey(c.header) < bk) || lower[0] || null;
  }
  return { best, prev, all, raws, tomb, maxSeq, corruptRaw, rawTomb: { ls: rawLsTomb, idb: rawIdbTomb } };
}

function noteRecord(slot, header, raw) {
  lastSeq[slot] = Math.max(lastSeq[slot] || 0, header.seq);
  lastSum[slot] = header.sum;
  lastHdr[slot] = header;
  lastRec[slot] = raw;
}
function forgetRecord(slot) {
  lastSum[slot] = null;
  lastHdr[slot] = null;
  lastRec[slot] = null;
}

// Write a record string to LS with the quota fallback (drop LS prev, trim telemetry). Returns boolean.
function lsWriteWithRoom(key, value, prevKey) {
  if (!lsOk) return false;
  if (lsSet(key, value)) return true;
  if (prevKey) lsDel(prevKey);
  trimTelemetryQueue();
  return lsSet(key, value);
}

function trimTelemetryQueue() {
  const q = safeJSON(lsGet(K_TM_QUEUE));
  if (Array.isArray(q) && q.length > 50) lsSet(K_TM_QUEUE, JSON.stringify(q.slice(-50)));
}

async function stashCorrupt(slot, items) {
  if (!idbOk || !items.length) return;
  try {
    const h = fnv1a(items.map((i) => i.raw).join('\u0000'));
    const prefix = kCorruptPrefix(slot);
    await flushPending();
    let keys = await idbKeys(prefix);
    const byTs = (k) => Number(k.slice(prefix.length)) || 0;
    keys.sort((a, b) => byTs(b) - byTs(a));
    if (keys.length) {
      const newest = safeJSON(await idbGet(keys[0]));
      if (newest && newest.h === h) return;   // already kept this exact damage
    }
    const ts = now();
    await idbSet(prefix + ts, JSON.stringify({ at: ts, h, items }));
    keys = [prefix + ts, ...keys.filter((k) => k !== prefix + ts)];
    for (const k of keys.slice(CORRUPT_KEEP)) await idbDel(k);
  } catch { /* support data only */ }
}

// ---------------------------------------------------------------------------
// Public API: setup
// ---------------------------------------------------------------------------
export function configure({ schemaVersion, appVersion, migrate } = {}) {
  if (typeof schemaVersion === 'number') cfg.schemaVersion = schemaVersion;
  if (appVersion != null) cfg.appVersion = String(appVersion);
  if (typeof migrate === 'function') cfg.migrate = migrate;
}

function onStorageEvent(e) {
  try {
    if (!e || typeof e.key !== 'string') return;
    const ls = getLS();
    if (e.storageArea && ls && e.storageArea !== ls) return;
    const m = /^hy\.slot\.(\d)$/.exec(e.key);
    if (!m) return;
    const slot = Number(m[1]);
    if (!touched.has(slot)) return;
    blocked.add(slot);
    const seq = headerSeqOf(e.newValue);
    if (typeof seq === 'number') lastSeq[slot] = Math.max(lastSeq[slot] || 0, seq);
    for (const cb of [...extCbs]) {
      try { cb({ slot, seq }); } catch { /* ignore */ }
    }
  } catch { /* never break the page */ }
}

export async function initStorage() {
  lsOk = testLS();
  idbOk = false;
  if (idbAvailable()) {
    try { idbOk = !!(await idbOpen()); } catch { idbOk = false; }
  }
  if (!inited) {
    inited = true;
    try {
      if (typeof globalThis.addEventListener === 'function') globalThis.addEventListener('storage', onStorageEvent);
    } catch { /* ignore */ }
  }
  for (const slot of SLOTS) {
    try {
      const r = await readSlot(slot);
      lastSeq[slot] = Math.max(lastSeq[slot] || 0, r.maxSeq);
      tooNew[slot] = !!(r.best && r.best.status === 'too_new');
      if (r.best && r.best.status === 'valid') noteRecord(slot, r.best.header, r.best.raw);
      else forgetRecord(slot);
    } catch { /* keep defaults */ }
  }
  return { ls: lsOk, idb: idbOk };
}

// ---------------------------------------------------------------------------
// Public API: slots
// ---------------------------------------------------------------------------
export async function listSlots() {
  const out = [];
  for (const slot of SLOTS) {
    let info = { slot, empty: true, meta: null, savedAt: null, hasPrev: false, hasDeleted: false, source: null, corrupt: false, tooNew: false };
    try {
      const r = await readSlot(slot);
      lastSeq[slot] = Math.max(lastSeq[slot] || 0, r.maxSeq);
      const b = r.best;
      info = {
        slot,
        empty: !b,
        meta: b ? b.header.meta || null : null,
        savedAt: b ? b.header.savedAt || null : null,
        hasPrev: !!r.prev,
        hasDeleted: await hasDeleted(slot),
        source: b ? b.store : null,
        corrupt: !b && r.corruptRaw.length > 0,
        tooNew: !!(b && b.status === 'too_new'),
      };
      tooNew[slot] = info.tooNew;
    } catch { /* keep the empty info */ }
    out.push(info);
  }
  return out;
}

function decodeState(p) {
  // -> { ok, state, migratedFrom } | { ok:false }
  const data = safeJSON(p.dataJSON);
  if (!data || typeof data !== 'object') return { ok: false };
  const v = Number(p.header.v) || 0;
  if (v < cfg.schemaVersion) {
    try {
      return { ok: true, state: cfg.migrate(data, v), migratedFrom: v };
    } catch {
      return { ok: false, migrate: true };
    }
  }
  return { ok: true, state: data, migratedFrom: null };
}

// Make both stores hold `curRaw` as cur and `prevRaw` (if given) as prev. Best-effort. -> boolean (anything written)
function healStores(slot, r, curRaw, prevRaw) {
  let wrote = false;
  if (lsOk) {
    if (r.raws.ls.cur !== curRaw) {
      if (lsWriteWithRoom(kCur(slot), curRaw, kPrev(slot))) wrote = true;
    }
    if (prevRaw && lsGet(kPrev(slot)) !== prevRaw) {
      if (lsSet(kPrev(slot), prevRaw)) wrote = true;
    }
  }
  if (idbOk) {
    if (r.raws.idb.cur !== curRaw) { queueIdb(kCur(slot), curRaw); wrote = true; }
    if (prevRaw && r.raws.idb.prev !== prevRaw) { queueIdb(kPrev(slot), prevRaw); wrote = true; }
  }
  return wrote;
}

export async function loadSlot(slot) {
  slot = checkSlot(slot);
  const r = await readSlot(slot);
  lastSeq[slot] = Math.max(lastSeq[slot] || 0, r.maxSeq);
  const b = r.best;
  if (!b) {
    tooNew[slot] = false;
    if (r.corruptRaw.length) {
      await stashCorrupt(slot, r.corruptRaw);
      return { ok: false, state: null, meta: null, source: null, repaired: false, migratedFrom: null, error: 'corrupt', messageHe: MSG.corrupt };
    }
    return { ok: false, state: null, meta: null, source: null, repaired: false, migratedFrom: null, error: 'empty', messageHe: MSG.empty };
  }
  if (b.status === 'too_new') {
    tooNew[slot] = true;
    return { ok: false, state: null, meta: b.header.meta || null, source: b.source, repaired: false, migratedFrom: null, error: 'too_new', messageHe: MSG.too_new };
  }
  tooNew[slot] = false;
  const dec = decodeState(b);
  if (!dec.ok) {
    return { ok: false, state: null, meta: b.header.meta || null, source: b.source, repaired: false, migratedFrom: null, error: 'corrupt', messageHe: dec.migrate ? MSG.migrate_failed : MSG.corrupt };
  }
  if (r.corruptRaw.length) await stashCorrupt(slot, r.corruptRaw);
  let repaired = false;
  try {
    repaired = healStores(slot, r, b.raw, r.prev ? r.prev.raw : null);
    if (repaired) await flushPending();
  } catch { /* best-effort */ }
  noteRecord(slot, b.header, b.raw);
  touched.add(slot);
  blocked.delete(slot);
  return { ok: true, state: dec.state, meta: b.header.meta || null, source: b.source, repaired, migratedFrom: dec.migratedFrom };
}

export function saveSlot(slot, state, meta, opts = {}) {
  slot = checkSlot(slot);
  const fail = (warn) => ({ ok: false, bytes: 0, ls: false, warn });
  if (blocked.has(slot)) return fail('blocked_other_tab');
  if (tooNew[slot]) return fail('too_new');
  if (!lsOk && !idbOk) {
    warnOnce('save_failed');
    return fail(null);
  }
  let dataJSON;
  try { dataJSON = JSON.stringify(state); } catch { return fail(null); }
  if (typeof dataJSON !== 'string') return fail(null);
  const sum = fnv1a(dataJSON);
  if (lastSum[slot] && sum === lastSum[slot]) return { ok: true, bytes: 0, ls: lsOk, warn: 'unchanged' };

  const seq = (lastSeq[slot] || 0) + 1;
  const savedAt = now();
  let rec = buildRecord(slot, seq, savedAt, cfg.schemaVersion, dataJSON, meta);

  // Rotate prev once per game week (same career, different week).
  const oldHdr = lastHdr[slot];
  const oldRaw = lastRec[slot];
  const rotate = !!(oldHdr && oldRaw && meta && careerOf(oldHdr) === meta.careerId && weekKey(oldHdr) !== weekKey({ meta }));
  if (rotate) {
    if (lsOk && !lsSet(kPrev(slot), oldRaw)) lsDel(kPrev(slot));   // stale prev wastes room; IDB keeps the real one
    queueIdb(kPrev(slot), oldRaw);
  }

  let lsWritten = false;
  let warn = null;
  if (lsOk) {
    lsWritten = lsSet(kCur(slot), rec.raw);
    if (!lsWritten) {
      // Quota path: (1) drop LS prev + trim telemetry, (2-4) compact via onQuota(1..3).
      lsDel(kPrev(slot));
      trimTelemetryQueue();
      lsWritten = lsSet(kCur(slot), rec.raw);
      for (let level = 1; !lsWritten && level <= 3 && typeof opts.onQuota === 'function'; level++) {
        let compacted = null;
        try { compacted = opts.onQuota(level); } catch { compacted = null; }
        if (!compacted) continue;
        let j;
        try { j = JSON.stringify(compacted); } catch { continue; }
        dataJSON = j;
        rec = buildRecord(slot, seq, savedAt, cfg.schemaVersion, dataJSON, meta);
        lsWritten = lsSet(kCur(slot), rec.raw);
      }
      if (lsWritten) warn = 'quota_pruned';
    }
  }

  if (!lsWritten) {
    if (!idbOk) {
      warnOnce('save_failed');
      return fail(null);
    }
    if (lsOk) warnQuota();
    else warnOnce('ls_full_idb_only');
    warn = 'ls_full_idb_only';
  }
  queueIdb(kCur(slot), rec.raw, !lsWritten);
  noteRecord(slot, rec.header, rec.raw);
  touched.add(slot);
  return { ok: true, bytes: rec.raw.length, ls: lsWritten, warn };
}

// Writes a fresh record (new seq) as cur in both stores, optionally a prev too. -> { ok, ls, header, raw }
function writeFresh(slot, header0, dataJSON, prevRaw) {
  const seq = (lastSeq[slot] || 0) + 1;
  const rec = buildRecord(slot, seq, now(), Number(header0.v) || cfg.schemaVersion, dataJSON, header0.meta || null);
  rec.header.app = header0.app || cfg.appVersion;
  rec.raw = REC_PREFIX + '\n' + JSON.stringify(rec.header) + '\n' + dataJSON;
  let ls = false;
  if (lsOk) {
    if (prevRaw) { if (!lsSet(kPrev(slot), prevRaw)) lsDel(kPrev(slot)); }
    else lsDel(kPrev(slot));
    ls = lsWriteWithRoom(kCur(slot), rec.raw, kPrev(slot));
  }
  if (idbOk) {
    queueIdb(kPrev(slot), prevRaw || null);
    queueIdb(kCur(slot), rec.raw, !ls);
  }
  noteRecord(slot, rec.header, rec.raw);
  return { ok: ls || idbOk, ls, header: rec.header, raw: rec.raw };
}

export async function restorePrevious(slot) {
  slot = checkSlot(slot);
  const r = await readSlot(slot);
  lastSeq[slot] = Math.max(lastSeq[slot] || 0, r.maxSeq);
  const none = { ok: false, state: null, meta: null, source: null, repaired: false, migratedFrom: null, error: 'empty', messageHe: MSG.no_prev };
  if (r.best && r.best.status === 'too_new') {
    return { ...none, error: 'too_new', messageHe: MSG.too_new };
  }
  if (!r.best || !r.prev) return none;
  const target = r.prev;
  const dec = decodeState(target);
  if (!dec.ok) return { ...none, error: 'corrupt', messageHe: MSG.corrupt };
  const w = writeFresh(slot, target.header, target.dataJSON, r.best.raw);
  if (!w.ok) return { ...none, error: 'corrupt', messageHe: MSG.save_failed };
  await flushPending();
  touched.add(slot);
  blocked.delete(slot);
  tooNew[slot] = false;
  return { ok: true, state: dec.state, meta: w.header.meta || null, source: w.ls ? 'ls' : 'idb', repaired: false, migratedFrom: dec.migratedFrom };
}

export async function deleteSlot(slot) {
  slot = checkSlot(slot);
  const r = await readSlot(slot);
  const maxSeq = Math.max(lastSeq[slot] || 0, r.maxSeq);
  lastSeq[slot] = maxSeq;
  if (!maxSeq && !r.best && !r.corruptRaw.length) {
    // Nothing was ever stored in this slot: no tombstone needed.
    forgetRecord(slot);
    tooNew[slot] = false;
    blocked.delete(slot);
    return { ok: true, recoverable: false };
  }
  if (r.best && idbOk) queueIdb(kDel(slot), r.best.raw);
  else if (r.corruptRaw.length) await stashCorrupt(slot, r.corruptRaw);
  const tomb = JSON.stringify({ seq: maxSeq, at: now() });
  lsSet(kTomb(slot), tomb);
  queueIdb(kTomb(slot), tomb);
  lsDel(kCur(slot));
  lsDel(kPrev(slot));
  queueIdb(kCur(slot), null);
  queueIdb(kPrev(slot), null);
  forgetRecord(slot);
  tooNew[slot] = false;
  blocked.delete(slot);
  await flushPending();
  return { ok: true, recoverable: !!(r.best && idbOk) };
}

export async function hasDeleted(slot) {
  slot = checkSlot(slot);
  if (!idbOk) return false;
  const p = parseRecord(await idbRead(kDel(slot)));
  return !!(p && p.status !== 'invalid');
}

export async function restoreDeleted(slot) {
  slot = checkSlot(slot);
  const none = { ok: false, state: null, meta: null, source: null, repaired: false, migratedFrom: null, error: 'empty', messageHe: MSG.no_deleted };
  if (!idbOk) return none;
  const p = parseRecord(await idbRead(kDel(slot)));
  if (!p) return none;
  if (p.status === 'invalid') return { ...none, error: 'corrupt', messageHe: MSG.corrupt };
  if (p.status === 'too_new') return { ...none, error: 'too_new', messageHe: MSG.too_new };
  const dec = decodeState(p);
  if (!dec.ok) return { ...none, error: 'corrupt', messageHe: MSG.corrupt };
  const r = await readSlot(slot);
  lastSeq[slot] = Math.max(lastSeq[slot] || 0, r.maxSeq);
  if (r.best) {
    // The slot holds another career: swap it into the deleted copy so nothing is lost.
    const tomb = JSON.stringify({ seq: lastSeq[slot], at: now() });
    lsSet(kTomb(slot), tomb);
    queueIdb(kTomb(slot), tomb);
    queueIdb(kDel(slot), r.best.raw);
  } else {
    lsDel(kTomb(slot));
    queueIdb(kTomb(slot), null);
    queueIdb(kDel(slot), null);
  }
  const w = writeFresh(slot, p.header, p.dataJSON, null);
  await flushPending();
  if (!w.ok) return { ...none, error: 'corrupt', messageHe: MSG.save_failed };
  touched.add(slot);
  blocked.delete(slot);
  tooNew[slot] = false;
  return { ok: true, state: dec.state, meta: w.header.meta || null, source: w.ls ? 'ls' : 'idb', repaired: false, migratedFrom: dec.migratedFrom };
}

// ---------------------------------------------------------------------------
// Hall of Fame (§7.4): union of all copies, dual-stored, never touched by deleteSlot.
// ---------------------------------------------------------------------------
function hofEntriesSorted(map) {
  return [...map.values()].sort((a, b) => ((Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)) || (a.careerId < b.careerId ? -1 : a.careerId > b.careerId ? 1 : 0));
}

async function readHof() {
  const raws = { ls: { cur: lsGet(K_HOF), prev: lsGet(K_HOF_PREV) }, idb: { cur: null, prev: null } };
  if (idbOk) {
    await flushPending();
    [raws.idb.cur, raws.idb.prev] = await Promise.all([idbGet(K_HOF), idbGet(K_HOF_PREV)]);
  }
  const copies = [];
  let maxSeq = 0;
  for (const raw of [raws.ls.cur, raws.idb.cur, raws.ls.prev, raws.idb.prev]) {
    const p = parseRecord(raw, HOF_PREFIX);
    if (!p || p.status === 'invalid') continue;
    const d = safeJSON(p.dataJSON);
    if (!d || !Array.isArray(d.entries)) continue;
    maxSeq = Math.max(maxSeq, p.header.seq);
    copies.push({ seq: p.header.seq, entries: d.entries, raw });
  }
  copies.sort((a, b) => b.seq - a.seq);
  const map = new Map();
  for (const c of copies) {
    for (const e of c.entries) {
      if (!e || typeof e !== 'object' || typeof e.careerId !== 'string' || !e.careerId) continue;
      const ex = map.get(e.careerId);
      if (!ex || (Number(e.createdAt) || 0) > (Number(ex.createdAt) || 0)) map.set(e.careerId, e);
    }
  }
  return { raws, map, maxSeq };
}

function hofDataJSON(entries) {
  return JSON.stringify({ entries });
}
function curHofData(raw) {
  const p = parseRecord(raw, HOF_PREFIX);
  return p && p.status !== 'invalid' ? p.dataJSON : null;
}

function writeHof(h, entries, rotate) {
  const dataJSON = hofDataJSON(entries);
  const header = { seq: h.maxSeq + 1, savedAt: now(), v: 1, sum: fnv1a(dataJSON), len: dataJSON.length, count: entries.length };
  const raw = HOF_PREFIX + '\n' + JSON.stringify(header) + '\n' + dataJSON;
  let ls = false;
  if (lsOk) {
    if (rotate && h.raws.ls.cur && curHofData(h.raws.ls.cur)) { if (!lsSet(K_HOF_PREV, h.raws.ls.cur)) lsDel(K_HOF_PREV); }
    ls = lsWriteWithRoom(K_HOF, raw, K_HOF_PREV);
  }
  if (idbOk) {
    const prevSrc = rotate ? (curHofData(h.raws.idb.cur) ? h.raws.idb.cur : (curHofData(h.raws.ls.cur) ? h.raws.ls.cur : null)) : null;
    if (prevSrc) queueIdb(K_HOF_PREV, prevSrc);
    queueIdb(K_HOF, raw, !ls);
  }
  if (!ls && !idbOk) warnOnce('save_failed');
  else if (!ls && lsOk) warnQuota();
  h.maxSeq = header.seq;
  return ls || idbOk;
}

export async function loadHallOfFame() {
  try {
    const h = await readHof();
    const entries = hofEntriesSorted(h.map);
    const want = hofDataJSON(entries);
    if (entries.length) {
      const lsDiff = lsOk && curHofData(h.raws.ls.cur) !== want;
      const idbDiff = idbOk && curHofData(h.raws.idb.cur) !== want;
      if (lsDiff || idbDiff) {
        writeHof(h, entries, false);
        await flushPending();
      }
    }
    return entries;
  } catch {
    return [];
  }
}

async function mergeHof(newEntries, keepCreatedAt) {
  const h = await readHof();
  const before = hofDataJSON(hofEntriesSorted(h.map));
  for (const e of newEntries) {
    if (!e || typeof e !== 'object' || typeof e.careerId !== 'string' || !e.careerId) continue;
    const ex = h.map.get(e.careerId);
    if (keepCreatedAt) {
      const entry = { ...e };
      if (ex && ex.createdAt != null) entry.createdAt = ex.createdAt;
      if (entry.createdAt == null) entry.createdAt = now();
      h.map.set(e.careerId, entry);
    } else if (!ex || (Number(e.createdAt) || 0) > (Number(ex.createdAt) || 0)) {
      h.map.set(e.careerId, e);
    }
  }
  const entries = hofEntriesSorted(h.map);
  const after = hofDataJSON(entries);
  const lsDiff = lsOk && curHofData(h.raws.ls.cur) !== after;
  const idbDiff = idbOk && curHofData(h.raws.idb.cur) !== after;
  if (after !== before || lsDiff || idbDiff) {
    writeHof(h, entries, after !== before);
    await flushPending();
  }
  return entries;
}

export async function addHallOfFame(entry) {
  if (!entry || typeof entry !== 'object' || !entry.careerId) return loadHallOfFame();
  try {
    return await mergeHof([entry], true);
  } catch {
    return loadHallOfFame();
  }
}

// ---------------------------------------------------------------------------
// Export / import (§7.5)
// ---------------------------------------------------------------------------
async function bestValid(slot) {
  const r = await readSlot(slot);
  const b = r.best;
  if (!b) return null;
  return b;   // valid or too_new: both are exportable as-is
}

function hySaveText(b, pretty) {
  const meta = b.header.meta || null;
  const head = [
    ['format', 'hy-save'],
    ['v', Number(b.header.v) || cfg.schemaVersion],
    ['app', cfg.appVersion],
    ['exportedAt', now()],
    ['meta', meta],
    ['sum', fnv1a(b.dataJSON)],
  ];
  if (!pretty) return '{' + head.map(([k, v]) => JSON.stringify(k) + ':' + JSON.stringify(v)).join(',') + ',"data":' + b.dataJSON + '}';
  return '{\n' + head.map(([k, v]) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(v)).join(',\n') + ',\n  "data": ' + b.dataJSON + '\n}';
}

const safeName = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'save';

export async function exportSlotJSON(slot) {
  slot = checkSlot(slot);
  const b = await bestValid(slot);
  if (!b) return { ok: false, filename: null, json: null, error: 'empty', messageHe: MSG.empty };
  const meta = b.header.meta || {};
  const filename = `hayeled-${safeName(meta.careerId || 'slot' + slot)}-${safeName(meta.season != null ? meta.season : '')}.json`;
  return { ok: true, filename, json: hySaveText(b, true) };
}

export async function exportSlotCode(slot) {
  slot = checkSlot(slot);
  const b = await bestValid(slot);
  if (!b) return '';
  const json = hySaveText(b, false);
  const bytes = utf8Encode(json);
  const gz = await gzip(bytes);
  return gz ? 'HY1:' + b64urlEncode(gz) : 'HY0:' + b64urlEncode(bytes);
}

export async function exportBackupJSON() {
  const parts = [];
  for (const slot of SLOTS) {
    const b = await bestValid(slot);
    parts.push('    ' + JSON.stringify(String(slot)) + ': ' + (b ? hySaveText(b, false) : 'null'));
  }
  const entries = await loadHallOfFame();
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const json = '{\n' +
    '  "format": "hy-backup",\n' +
    '  "v": 1,\n' +
    '  "app": ' + JSON.stringify(cfg.appVersion) + ',\n' +
    '  "exportedAt": ' + now() + ',\n' +
    '  "slots": {\n' + parts.join(',\n') + '\n  },\n' +
    '  "hof": ' + JSON.stringify({ entries }) + '\n}';
  return { filename: `hayeled-backup-${ymd}.json`, json };
}

export function downloadFile(filename, text, mime = 'application/json') {
  try {
    const doc = globalThis.document;
    if (!doc) return false;
    const blob = new Blob([text], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = doc.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    doc.body.appendChild(a);
    a.click();
    setTimeout(() => { try { a.remove(); URL.revokeObjectURL(url); } catch { /* ignore */ } }, 4000);
    return true;
  } catch {
    return false;
  }
}

// --- bytes / base64url / gzip -------------------------------------------------
function utf8Encode(s) { return new TextEncoder().encode(s); }
function utf8Decode(b) { return new TextDecoder().decode(b); }

function b64urlEncode(bytes) {
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipeBytes(bytes, stream) {
  const piped = new Blob([bytes]).stream().pipeThrough(stream);
  if (typeof Response === 'function') return new Uint8Array(await new Response(piped).arrayBuffer());
  const reader = piped.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
async function gzip(bytes) {
  try {
    if (typeof CompressionStream !== 'function' || typeof Blob !== 'function') return null;
    return await pipeBytes(bytes, new CompressionStream('gzip'));
  } catch { return null; }
}
async function gunzip(bytes) {
  return pipeBytes(bytes, new DecompressionStream('gzip'));
}

// --- import -----------------------------------------------------------------
const importErr = (error) => ({ ok: false, error, messageHe: MSG[error] || MSG.bad_format });

// Validates a hy-save object. -> { ok, meta, data, v } | importErr
function checkHySave(obj) {
  if (!obj || typeof obj !== 'object' || obj.format !== 'hy-save' || !obj.data || typeof obj.data !== 'object') return importErr('bad_format');
  let dataJSON;
  try { dataJSON = JSON.stringify(obj.data); } catch { return importErr('bad_format'); }
  if (typeof obj.sum !== 'string' || fnv1a(dataJSON) !== obj.sum) return importErr('bad_checksum');
  const v = Number(obj.v != null ? obj.v : obj.data.v) || 0;
  if (v > cfg.schemaVersion) return importErr('too_new');
  let data = obj.data;
  if (v < cfg.schemaVersion) {
    try { data = cfg.migrate(data, v); } catch { return { ok: false, error: 'bad_format', messageHe: MSG.migrate_failed }; }
  }
  return { ok: true, meta: obj.meta && typeof obj.meta === 'object' ? obj.meta : null, data, v };
}

function fromObject(obj, raw) {
  if (obj && obj.format === 'hy-save') {
    const c = checkHySave(obj);
    if (!c.ok) return c;
    return { ok: true, kind: 'save', meta: c.meta, data: c.data, raw };
  }
  if (obj && obj.format === 'hy-backup') {
    if (Number(obj.v) > 1) return importErr('too_new');
    const slots = {};
    const src = obj.slots && typeof obj.slots === 'object' ? obj.slots : {};
    for (const slot of SLOTS) {
      const s = src[String(slot)];
      if (!s) { slots[slot] = null; continue; }
      const c = checkHySave(s);
      if (!c.ok) return c;
      slots[slot] = { meta: c.meta, data: c.data };
    }
    const entries = obj.hof && Array.isArray(obj.hof.entries) ? obj.hof.entries.filter((e) => e && typeof e === 'object' && typeof e.careerId === 'string') : [];
    return { ok: true, kind: 'backup', meta: null, data: { slots, hof: { entries } }, raw };
  }
  return importErr('bad_format');
}

export async function parseImport(text) {
  try {
    if (typeof text !== 'string') return importErr('bad_format');
    let t = text.replace(/^﻿/, '').trim();
    if (!/^HY[01]:/.test(t) && !t.startsWith('{') && !t.startsWith(REC_PREFIX)) {
      // Tolerate a code pasted together with surrounding chat text.
      const m = /HY[01]:[A-Za-z0-9_\-\s]{16,}/.exec(t);
      if (m) t = m[0].trim();
    }
    if (/^HY[01]:/.test(t)) {
      t = t.replace(/\s+/g, '');
      const kind = t[2];
      const body = t.slice(4);
      if (!/^[A-Za-z0-9_-]+$/.test(body)) return importErr('bad_format');
      let bytes;
      try { bytes = b64urlDecode(body); } catch { return importErr('bad_format'); }
      if (kind === '1') {
        if (typeof DecompressionStream !== 'function') return importErr('unsupported_code');
        try { bytes = await gunzip(bytes); } catch { return importErr('bad_checksum'); }
      }
      let json;
      try { json = utf8Decode(bytes); } catch { return importErr('bad_format'); }
      const obj = safeJSON(json);
      if (!obj) return importErr('bad_checksum');
      return fromObject(obj, t);
    }
    if (t.startsWith(REC_PREFIX + '\n') || t.startsWith(REC_PREFIX + '\r\n')) {
      const norm = t.replace(/^([^\n]*?)\r\n([^\n]*?)\r\n/, '$1\n$2\n');
      const p = parseRecord(norm);
      if (!p || p.status === 'invalid') return importErr('bad_checksum');
      if (p.status === 'too_new') return importErr('too_new');
      const dec = decodeState(p);
      if (!dec.ok) return importErr(dec.migrate ? 'bad_format' : 'bad_checksum');
      return { ok: true, kind: 'save', meta: p.header.meta || null, data: dec.state, raw: norm };
    }
    if (t.startsWith('{')) {
      const obj = safeJSON(t);
      if (!obj) return importErr('bad_format');
      return fromObject(obj, t);
    }
    return importErr('bad_format');
  } catch {
    return importErr('bad_format');
  }
}

async function importOne(slot, meta, data) {
  await deleteSlot(slot);   // soft delete: the old career stays recoverable
  let dataJSON;
  try { dataJSON = JSON.stringify(data); } catch { return { ok: false, state: null, meta: null, source: null, repaired: false, migratedFrom: null, error: 'corrupt', messageHe: MSG.bad_format }; }
  const w = writeFresh(slot, { v: cfg.schemaVersion, app: cfg.appVersion, meta: meta || null }, dataJSON, null);
  await flushPending();
  if (!w.ok) return { ok: false, state: null, meta: null, source: null, repaired: false, migratedFrom: null, error: 'corrupt', messageHe: MSG.save_failed };
  touched.add(slot);
  blocked.delete(slot);
  tooNew[slot] = false;
  return { ok: true, state: data, meta: meta || null, source: w.ls ? 'ls' : 'idb', repaired: false, migratedFrom: null };
}

export async function importToSlot(parsed, slot) {
  slot = checkSlot(slot);
  if (!parsed || !parsed.ok || parsed.kind !== 'save') {
    return { ok: false, state: null, meta: null, source: null, repaired: false, migratedFrom: null, error: 'corrupt', messageHe: MSG.bad_format };
  }
  return importOne(slot, parsed.meta, parsed.data);
}

export async function importBackup(parsed) {
  if (!parsed || !parsed.ok || parsed.kind !== 'backup') return { ok: false, slots: [], hof: 0 };
  const done = [];
  let ok = true;
  for (const slot of SLOTS) {
    const s = parsed.data.slots[slot];
    if (!s) continue;
    const r = await importOne(slot, s.meta, s.data);
    if (r.ok) done.push(slot); else ok = false;
  }
  const entries = parsed.data.hof ? parsed.data.hof.entries : [];
  if (entries.length) await mergeHof(entries, false);
  return { ok, slots: done, hof: entries.length };
}

// ---------------------------------------------------------------------------
// Persistence (§7.6)
// ---------------------------------------------------------------------------
export async function requestPersist() {
  try {
    const st = globalThis.navigator && globalThis.navigator.storage;
    if (!st || typeof st.persist !== 'function') return 'unsupported';
    if (typeof st.persisted === 'function' && (await st.persisted())) return 'granted';
    return (await st.persist()) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export async function getStorageStatus() {
  const out = { persisted: null, usage: null, quota: null, ls: lsOk, idb: idbOk };
  try {
    const st = globalThis.navigator && globalThis.navigator.storage;
    if (st && typeof st.persisted === 'function') out.persisted = !!(await st.persisted());
    if (st && typeof st.estimate === 'function') {
      const e = await st.estimate();
      out.usage = typeof e.usage === 'number' ? e.usage : null;
      out.quota = typeof e.quota === 'number' ? e.quota : null;
    }
  } catch { /* keep nulls */ }
  return out;
}

// ---------------------------------------------------------------------------
// Listeners
// ---------------------------------------------------------------------------
export function onWarning(cb) {
  if (typeof cb !== 'function') return () => {};
  warnCbs.add(cb);
  return () => warnCbs.delete(cb);
}

export function onExternalWrite(cb) {
  if (typeof cb !== 'function') return () => {};
  extCbs.add(cb);
  return () => extCbs.delete(cb);
}
