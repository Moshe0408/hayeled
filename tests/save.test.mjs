// tests/save.test.mjs: headless tests for js/core/save.js + js/core/idb.js.
// Usage: node tests/save.test.mjs
// Uses in-memory fakes of localStorage, indexedDB and the window 'storage' event.
// Every "tab" / "reload" is a fresh instance of save.js (imported with a query string),
// while the fake storages persist, exactly like a real browser reload.

import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------
class FakeLocalStorage {
  constructor(capacity = Infinity) { this.map = new Map(); this.capacity = capacity; this.broken = false; }
  _size() { let n = 0; for (const [k, v] of this.map) n += k.length + v.length; return n; }
  getItem(k) { if (this.broken) throw new Error('SecurityError'); return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) {
    if (this.broken) throw new Error('SecurityError');
    v = String(v);
    const old = this.map.has(k) ? k.length + this.map.get(k).length : 0;
    if (this._size() - old + k.length + v.length > this.capacity) {
      const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e;
    }
    this.map.set(k, v);
  }
  removeItem(k) { if (this.broken) throw new Error('SecurityError'); this.map.delete(k); }
  key(i) { return [...this.map.keys()][i] ?? null; }
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
}

const later = (fn) => setTimeout(fn, 0);

class FakeIDBFactory {
  constructor() { this.dbs = new Map(); this.broken = false; this.openFails = false; }
  store() { return this.dbs.get('hayeled')?.stores.get('kv') || new Map(); }
  open(name, version) {
    const req = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
    later(() => {
      if (this.openFails) { req.error = new Error('open failed'); req.onerror && req.onerror({ preventDefault() {} }); return; }
      let data = this.dbs.get(name);
      const fresh = !data;
      if (fresh) { data = { version, stores: new Map() }; this.dbs.set(name, data); }
      req.result = new FakeDB(this, data);
      if (fresh && req.onupgradeneeded) req.onupgradeneeded({});
      req.onsuccess && req.onsuccess({});
    });
    return req;
  }
}
class FakeDB {
  constructor(f, data) {
    this.f = f; this.data = data;
    this.objectStoreNames = { contains: (n) => data.stores.has(n) };
  }
  createObjectStore(n) { this.data.stores.set(n, new Map()); return {}; }
  close() {}
  transaction(name, mode) {
    if (this.f.broken) { const e = new Error('The database connection is closing.'); e.name = 'InvalidStateError'; throw e; }
    const map = this.data.stores.get(name);
    const tx = { oncomplete: null, onerror: null, onabort: null, error: null, mode };
    let open = 0;
    const done = () => { if (--open === 0) later(() => tx.oncomplete && tx.oncomplete({})); };
    const mk = (fn) => {
      const req = { result: undefined, onsuccess: null, onerror: null };
      open++;
      later(() => { req.result = fn(); req.onsuccess && req.onsuccess({}); done(); });
      return req;
    };
    tx.objectStore = () => ({
      get: (k) => mk(() => map.get(k)),
      put: (v, k) => mk(() => { if (mode !== 'readwrite') throw new Error('ro'); map.set(k, v); return k; }),
      delete: (k) => mk(() => { map.delete(k); }),
      getAllKeys: (range) => mk(() => [...map.keys()].filter((k) => !range || (k >= range.lower && k <= range.upper)).sort()),
    });
    tx.abort = () => {};
    return tx;
  }
}

// Window-ish globals used by save.js
const listeners = [];   // { tab, fn }
let currentTab = 0;
globalThis.addEventListener = (type, fn) => { if (type === 'storage') listeners.push({ tab: currentTab, fn }); };
globalThis.IDBKeyRange = { bound: (lower, upper) => ({ lower, upper }) };

let ls, idb;
function resetStores({ lsCapacity = Infinity, withIdb = true } = {}) {
  ls = new FakeLocalStorage(lsCapacity);
  idb = withIdb ? new FakeIDBFactory() : undefined;
  globalThis.localStorage = ls;
  globalThis.indexedDB = idb;
  listeners.length = 0;
}

let tabCounter = 0;
const allTabs = [];
async function openTab(opts = {}) {
  const id = ++tabCounter;
  currentTab = id;
  const save = await import('../js/core/save.js?tab=' + id);
  allTabs.push(save);
  save.configure({ schemaVersion: opts.schemaVersion ?? 1, appVersion: '1.0.0', migrate: opts.migrate ?? ((d) => d) });
  const st = await save.initStorage();
  const warnings = [];
  save.onWarning((w) => warnings.push(w));
  return { save, st, warnings, id };
}

function mkState(careerId, season, week, extra = {}) {
  return { v: 1, id: careerId, season, week, player: { name: 'יואב', ovr: 50 + week }, filler: '', ...extra };
}
function mkMeta(careerId, season, week) {
  return { careerId, name: 'יואב כהן', nick: 'יואבי', nation: 'isr', flag: '🇮🇱', pos: 'ST', posHe: 'חלוץ', age: 16, ovr: 50 + week,
    clubId: 'mhaifa', clubHe: 'מכבי חיפה', season, week, dateHe: '', stage: 'youth', retired: false, seasons: 1 };
}
function save1(save, slot, careerId, season, week, extra, opts) {
  return save.saveSlot(slot, mkState(careerId, season, week, extra), mkMeta(careerId, season, week), opts);
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('round trip: save, flush, reload, both stores hold the same record', async () => {
  resetStores();
  const { save, st } = await openTab();
  assert.deepEqual(st, { ls: true, idb: true });
  const r = save1(save, 1, 'c_a', 2026, 3);
  assert.equal(r.ok, true); assert.equal(r.ls, true); assert.ok(r.bytes > 0);
  assert.equal(save1(save, 1, 'c_a', 2026, 3).warn, 'unchanged');
  await save.flushPending();
  assert.equal(ls.getItem('hy.slot.1'), idb.store().get('hy.slot.1'));
  const t2 = await openTab();
  const l = await t2.save.loadSlot(1);
  assert.equal(l.ok, true); assert.equal(l.state.week, 3); assert.equal(l.meta.careerId, 'c_a'); assert.equal(l.repaired, false);
  const slots = await t2.save.listSlots();
  assert.equal(slots.length, 3); assert.equal(slots[0].empty, false); assert.equal(slots[1].empty, true);
  assert.equal(slots[0].meta.clubHe, 'מכבי חיפה');
});

test('one store missing: LS wiped -> restored from IDB and LS healed', async () => {
  resetStores();
  const { save } = await openTab();
  save1(save, 1, 'c_a', 2026, 1); save1(save, 1, 'c_a', 2026, 2);
  await save.flushPending();
  ls.removeItem('hy.slot.1'); ls.removeItem('hy.slot.1.prev');
  const t2 = await openTab();
  const l = await t2.save.loadSlot(1);
  assert.equal(l.ok, true); assert.equal(l.source, 'idb'); assert.equal(l.repaired, true); assert.equal(l.state.week, 2);
  assert.equal(ls.getItem('hy.slot.1'), idb.store().get('hy.slot.1'));
  assert.ok(ls.getItem('hy.slot.1.prev'), 'prev healed in LS');
});

test('one store missing: IDB wiped -> restored from LS and IDB healed', async () => {
  resetStores();
  const { save } = await openTab();
  save1(save, 1, 'c_a', 2026, 5);
  await save.flushPending();
  idb.store().clear();
  const t2 = await openTab();
  const l = await t2.save.loadSlot(1);
  assert.equal(l.ok, true); assert.equal(l.source, 'ls'); assert.equal(l.repaired, true);
  assert.equal(idb.store().get('hy.slot.1'), ls.getItem('hy.slot.1'));
});

test('stale store: the newest seq wins and the stale copy is overwritten', async () => {
  resetStores();
  const { save } = await openTab();
  save1(save, 1, 'c_a', 2026, 1);
  await save.flushPending();
  const old = idb.store().get('hy.slot.1');
  save1(save, 1, 'c_a', 2026, 2);
  await save.flushPending();
  ls.setItem('hy.slot.1', old);   // LS went back in time
  const t2 = await openTab();
  const l = await t2.save.loadSlot(1);
  assert.equal(l.state.week, 2); assert.equal(l.source, 'idb'); assert.equal(l.repaired, true);
  assert.equal(ls.getItem('hy.slot.1'), idb.store().get('hy.slot.1'));
});

test('corruption: truncated LS cur -> IDB copy, damage kept in hy.corrupt.*', async () => {
  resetStores();
  const { save } = await openTab();
  save1(save, 1, 'c_a', 2026, 4);
  await save.flushPending();
  const good = ls.getItem('hy.slot.1');
  ls.setItem('hy.slot.1', good.slice(0, good.length - 20));
  const t2 = await openTab();
  const list = await t2.save.listSlots();
  assert.equal(list[0].empty, false); assert.equal(list[0].corrupt, false);
  const l = await t2.save.loadSlot(1);
  assert.equal(l.ok, true); assert.equal(l.state.week, 4); assert.equal(l.repaired, true);
  assert.equal(ls.getItem('hy.slot.1'), good);
  const corruptKeys = [...idb.store().keys()].filter((k) => k.startsWith('hy.corrupt.1.'));
  assert.equal(corruptKeys.length, 1);
});

test('corruption: both cur copies damaged -> falls back to prev', async () => {
  resetStores();
  const { save } = await openTab();
  save1(save, 1, 'c_a', 2026, 1);
  save1(save, 1, 'c_a', 2026, 2);   // rotates week 1 into prev
  await save.flushPending();
  ls.setItem('hy.slot.1', 'HYS1\n{garbage');
  idb.store().set('hy.slot.1', 'HYS1\n{"seq":99}\n{}');
  const t2 = await openTab();
  const l = await t2.save.loadSlot(1);
  assert.equal(l.ok, true); assert.equal(l.state.week, 1); assert.equal(l.source, 'ls-prev');
  // After repair, the next save must use a seq above the damaged header's 99.
  const s = save1(t2.save, 1, 'c_a', 2026, 2, { x: 1 });
  assert.equal(s.ok, true);
  const hdr = JSON.parse(ls.getItem('hy.slot.1').split('\n')[1]);
  assert.ok(hdr.seq > 99, 'seq ' + hdr.seq);
});

test('corruption: nothing valid -> error corrupt with Hebrew message', async () => {
  resetStores();
  const { save } = await openTab();
  save1(save, 1, 'c_a', 2026, 1);
  await save.flushPending();
  ls.setItem('hy.slot.1', 'xx'); idb.store().set('hy.slot.1', 'yy');
  const t2 = await openTab();
  const list = await t2.save.listSlots();
  assert.equal(list[0].corrupt, true); assert.equal(list[0].empty, true);
  const l = await t2.save.loadSlot(1);
  assert.equal(l.ok, false); assert.equal(l.error, 'corrupt'); assert.match(l.messageHe, /נפגמה/);
  const e = await t2.save.loadSlot(2);
  assert.equal(e.error, 'empty');
});

test('rollback: prev rotates once per game week; restorePrevious is undoable', async () => {
  resetStores();
  const { save } = await openTab();
  save1(save, 1, 'c_a', 2026, 1);
  save1(save, 1, 'c_a', 2026, 1, { step: 'a' });
  save1(save, 1, 'c_a', 2026, 1, { step: 'b' });   // last save of week 1
  save1(save, 1, 'c_a', 2026, 2);                   // rotation: prev = week1/b
  save1(save, 1, 'c_a', 2026, 2, { step: 'c' });   // same week: no rotation
  await save.flushPending();
  const t2 = await openTab();
  const r1 = await t2.save.restorePrevious(1);
  assert.equal(r1.ok, true); assert.equal(r1.state.week, 1); assert.equal(r1.state.step, 'b');
  const l = await (await openTab()).save.loadSlot(1);
  assert.equal(l.state.week, 1, 'restored record wins on the next load');
  const r2 = await t2.save.restorePrevious(1);
  assert.equal(r2.ok, true); assert.equal(r2.state.week, 2); assert.equal(r2.state.step, 'c');
  const none = await t2.save.restorePrevious(2);
  assert.equal(none.ok, false); assert.equal(none.error, 'empty');
});

test('quota: prune LS prev, then compact via onQuota, then IDB-only with warning', async () => {
  resetStores({ lsCapacity: 6000 });
  const { save, warnings } = await openTab();
  const big = 'x'.repeat(2500);
  const r1 = save1(save, 1, 'c_a', 2026, 1, { filler: big });
  assert.equal(r1.ok, true); assert.equal(r1.ls, true);
  // Week 2: rotation puts week 1 into LS prev, the new cur no longer fits -> prune prev.
  const r2 = save1(save, 1, 'c_a', 2026, 2, { filler: big + 'y'.repeat(1000) });
  assert.equal(r2.ok, true); assert.equal(r2.ls, true); assert.equal(r2.warn, 'quota_pruned');
  assert.equal(ls.getItem('hy.slot.1.prev'), null);
  // Now a state that only fits after compaction level 2.
  const levels = [];
  const r3 = save1(save, 1, 'c_a', 2026, 2, { filler: 'z'.repeat(7000) }, {
    onQuota: (lvl) => { levels.push(lvl); return lvl >= 2 ? mkState('c_a', 2026, 2, { filler: 'small' }) : null; },
  });
  assert.equal(r3.ok, true); assert.equal(r3.ls, true); assert.deepEqual(levels, [1, 2]);
  // A state that never fits: IDB only + warning.
  const r4 = save1(save, 1, 'c_a', 2026, 3, { filler: 'w'.repeat(9000) }, { onQuota: () => null });
  assert.equal(r4.ok, true); assert.equal(r4.ls, false); assert.equal(r4.warn, 'ls_full_idb_only');
  assert.ok(warnings.some((w) => w.code === 'quota'));
  await save.flushPending();
  const l = await (await openTab()).save.loadSlot(1);
  assert.equal(l.ok, true); assert.equal(l.state.week, 3); assert.equal(l.source, 'idb');
});

test('quota: telemetry queue trimmed to 50 to make room', async () => {
  resetStores({ lsCapacity: 6000 });
  ls.setItem('hy.tm.q', JSON.stringify(Array.from({ length: 200 }, (_, i) => ({ n: 'e', i }))));
  const { save } = await openTab();
  const r = save1(save, 1, 'c_a', 2026, 1, { filler: 'q'.repeat(3500) });
  assert.equal(r.ok, true); assert.equal(r.ls, true);
  assert.equal(JSON.parse(ls.getItem('hy.tm.q')).length, 50);
});

test('IDB unavailable (private mode): LS-only saving works; delete is final', async () => {
  resetStores({ withIdb: false });
  const { save, st } = await openTab();
  assert.deepEqual(st, { ls: true, idb: false });
  assert.equal(save1(save, 1, 'c_a', 2026, 1).ok, true);
  await save.flushPending();
  const l = await (await openTab()).save.loadSlot(1);
  assert.equal(l.ok, true);
  const d = await save.deleteSlot(1);
  assert.equal(d.recoverable, false);
  assert.equal(await save.hasDeleted(1), false);
});

test('IDB open fails and LS throws: save fails gracefully with save_failed warning', async () => {
  resetStores();
  idb.openFails = true;
  ls.broken = true;
  const { save, st, warnings } = await openTab();
  assert.deepEqual(st, { ls: false, idb: false });
  const r = save1(save, 1, 'c_a', 2026, 1);
  assert.equal(r.ok, false);
  assert.equal(warnings.filter((w) => w.code === 'save_failed').length, 1);
  save1(save, 1, 'c_a', 2026, 2);
  assert.equal(warnings.filter((w) => w.code === 'save_failed').length, 1, 'only once per session');
  assert.deepEqual(await save.listSlots().then((x) => x.map((s) => s.empty)), [true, true, true]);
});

test('LS disabled but IDB works: ls_full_idb_only and data survives reload', async () => {
  resetStores();
  ls.broken = true;
  const { save, st } = await openTab();
  assert.deepEqual(st, { ls: false, idb: true });
  const r = save1(save, 1, 'c_a', 2026, 7);
  assert.equal(r.ok, true); assert.equal(r.ls, false); assert.equal(r.warn, 'ls_full_idb_only');
  await save.flushPending();
  const l = await (await openTab()).save.loadSlot(1);
  assert.equal(l.ok, true); assert.equal(l.state.week, 7);
});

test('IDB connection lost mid-session: reopen + retry', async () => {
  resetStores();
  const { save } = await openTab();
  save1(save, 1, 'c_a', 2026, 1);
  await save.flushPending();
  idb.broken = true;
  setTimeout(() => { idb.broken = false; }, 1);
  save1(save, 1, 'c_a', 2026, 2);
  await save.flushPending();
  // Either the retry succeeded or the write failed softly; LS always holds week 2.
  const l = await (await openTab()).save.loadSlot(1);
  assert.equal(l.state.week, 2);
});

test('too new record: load refuses, save refuses, nothing is overwritten', async () => {
  resetStores();
  const a = await openTab({ schemaVersion: 2 });
  a.save.saveSlot(1, { v: 2, x: 1 }, mkMeta('c_n', 2030, 1));
  await a.save.flushPending();
  const raw = ls.getItem('hy.slot.1');
  const b = await openTab({ schemaVersion: 1 });
  const list = await b.save.listSlots();
  assert.equal(list[0].tooNew, true);
  const l = await b.save.loadSlot(1);
  assert.equal(l.ok, false); assert.equal(l.error, 'too_new'); assert.match(l.messageHe, /גרסה חדשה/);
  const s = save1(b.save, 1, 'c_a', 2026, 1);
  assert.equal(s.ok, false); assert.equal(s.warn, 'too_new');
  assert.equal(ls.getItem('hy.slot.1'), raw);
});

test('migrate: an older schema record is migrated on load', async () => {
  resetStores();
  const a = await openTab({ schemaVersion: 1 });
  save1(a.save, 1, 'c_a', 2026, 1);
  await a.save.flushPending();
  const b = await openTab({ schemaVersion: 2, migrate: (d, from) => ({ ...d, v: 2, migratedFrom: from }) });
  const l = await b.save.loadSlot(1);
  assert.equal(l.ok, true); assert.equal(l.migratedFrom, 1); assert.equal(l.state.v, 2); assert.equal(l.state.migratedFrom, 1);
  const s = b.save.saveSlot(1, l.state, mkMeta('c_a', 2026, 1));
  assert.equal(s.ok, true);
  assert.equal(JSON.parse(ls.getItem('hy.slot.1').split('\n')[1]).v, 2);
});

test('delete: soft delete, tombstone blocks resurrection, restoreDeleted, new career seq > tomb', async () => {
  resetStores();
  const { save } = await openTab();
  save1(save, 1, 'c_a', 2026, 1); save1(save, 1, 'c_a', 2026, 2);
  await save.flushPending();
  const stale = ls.getItem('hy.slot.1');
  await save.deleteSlot(1);
  assert.equal(ls.getItem('hy.slot.1'), null);
  assert.equal(await save.hasDeleted(1), true);
  ls.setItem('hy.slot.1', stale);   // a copy that failed to delete
  const t2 = await openTab();
  assert.equal((await t2.save.listSlots())[0].empty, true);
  assert.equal((await t2.save.loadSlot(1)).error, 'empty');
  const r = await t2.save.restoreDeleted(1);
  assert.equal(r.ok, true); assert.equal(r.state.week, 2);
  assert.equal((await (await openTab()).save.loadSlot(1)).state.week, 2);
  // New career in the occupied slot: delete first, then save.
  await t2.save.deleteSlot(1);
  const tomb = JSON.parse(ls.getItem('hy.slot.1.tomb')).seq;
  save1(t2.save, 1, 'c_b', 2026, 1);
  const hdr = JSON.parse(ls.getItem('hy.slot.1').split('\n')[1]);
  assert.ok(hdr.seq > tomb);
  await t2.save.flushPending();
  const l = await (await openTab()).save.loadSlot(1);
  assert.equal(l.meta.careerId, 'c_b');
});

test('seq never reused across reloads (initStorage seeds lastSeq)', async () => {
  resetStores();
  const a = await openTab();
  for (let w = 1; w <= 5; w++) save1(a.save, 1, 'c_a', 2026, w);
  await a.save.flushPending();
  const before = JSON.parse(ls.getItem('hy.slot.1').split('\n')[1]).seq;
  const b = await openTab();
  save1(b.save, 1, 'c_a', 2026, 6);
  const after = JSON.parse(ls.getItem('hy.slot.1').split('\n')[1]).seq;
  assert.equal(after, before + 1);
});

test('hall of fame: dual store union, idempotent add, survives slot deletion', async () => {
  resetStores();
  const { save } = await openTab();
  const e1 = { v: 1, careerId: 'c_a', name: 'א', legacy: 50, createdAt: 1000 };
  const e2 = { v: 1, careerId: 'c_b', name: 'ב', legacy: 70, createdAt: 2000 };
  await save.addHallOfFame(e1);
  const snapshotLs = ls.getItem('hy.hof');
  await save.addHallOfFame(e2);
  let list = await save.loadHallOfFame();
  assert.deepEqual(list.map((e) => e.careerId), ['c_b', 'c_a']);
  // Idempotent: same careerId, new createdAt -> keeps the original createdAt, no rewrite.
  const rawBefore = ls.getItem('hy.hof');
  await save.addHallOfFame({ ...e1, createdAt: 9999 });
  assert.equal(ls.getItem('hy.hof'), rawBefore);
  // Stale LS (only e1) + IDB lost entirely except a different career -> union of everything.
  ls.setItem('hy.hof', snapshotLs); ls.removeItem('hy.hof.prev');
  idb.store().delete('hy.hof'); idb.store().delete('hy.hof.prev');
  const t2 = await openTab();
  await t2.save.addHallOfFame({ v: 1, careerId: 'c_c', name: 'ג', legacy: 10, createdAt: 3000 });
  ls.setItem('hy.hof', snapshotLs);   // LS regresses again
  list = await (await openTab()).save.loadHallOfFame();
  assert.deepEqual(list.map((e) => e.careerId).sort(), ['c_a', 'c_c']);
  // Slot deletion never touches HoF.
  save1(t2.save, 1, 'c_a', 2026, 1);
  await t2.save.deleteSlot(1);
  assert.equal((await t2.save.loadHallOfFame()).length, 2);
  assert.ok(idb.store().get('hy.hof'));
});

test('export/import: JSON file, HY code, tampered code, raw record, backup', async () => {
  resetStores();
  const { save } = await openTab();
  save1(save, 1, 'c_a1', 2027, 9, { text: 'שלום "עולם"\n' });
  await save.addHallOfFame({ v: 1, careerId: 'c_h', name: 'ה', legacy: 1, createdAt: 5 });
  const f = await save.exportSlotJSON(1);
  assert.equal(f.filename, 'hayeled-c_a1-2027.json');
  const obj = JSON.parse(f.json);
  assert.equal(obj.format, 'hy-save'); assert.equal(obj.data.week, 9);
  assert.match(f.json, /^\{\n  "format": "hy-save",\n/);
  const p1 = await save.parseImport(f.json);
  assert.equal(p1.ok, true); assert.equal(p1.kind, 'save'); assert.equal(p1.meta.careerId, 'c_a1');

  const code = await save.exportSlotCode(1);
  assert.match(code, /^HY[01]:[A-Za-z0-9_-]+$/);
  if (typeof CompressionStream === 'function') assert.ok(code.startsWith('HY1:'));
  const spaced = '  ' + code.slice(0, 20) + '\n ' + code.slice(20) + '  ';
  const p2 = await save.parseImport(spaced);
  assert.equal(p2.ok, true);
  const p2b = await save.parseImport('הנה הקוד שלי: ' + code);
  assert.equal(p2b.ok, true, 'code inside chat text');
  const r2 = await save.importToSlot(p2, 2);
  assert.equal(r2.ok, true);
  const slots = await save.listSlots();
  assert.deepEqual(slots[1].meta, slots[0].meta);

  const plain = 'HY0:' + Buffer.from(JSON.stringify({ ...obj, data: { ...obj.data, week: 10 } }), 'utf8').toString('base64url');
  const bad = await save.parseImport(plain);
  assert.equal(bad.ok, false); assert.equal(bad.error, 'bad_checksum'); assert.ok(bad.messageHe);
  assert.equal((await save.parseImport('שלום')).error, 'bad_format');
  const tooNew = await save.parseImport(JSON.stringify({ ...obj, v: 99 }));
  assert.equal(tooNew.error, 'too_new');

  const p3 = await save.parseImport(ls.getItem('hy.slot.1'));
  assert.equal(p3.ok, true); assert.equal(p3.data.week, 9);

  const bk = await save.exportBackupJSON();
  assert.match(bk.filename, /^hayeled-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const bobj = JSON.parse(bk.json);
  assert.equal(bobj.format, 'hy-backup'); assert.equal(bobj.slots['3'], null); assert.equal(bobj.hof.entries.length, 1);

  // Fresh device: import the backup.
  resetStores();
  const dev2 = await openTab();
  const pb = await dev2.save.parseImport(bk.json);
  assert.equal(pb.ok, true); assert.equal(pb.kind, 'backup');
  const ib = await dev2.save.importBackup(pb);
  assert.deepEqual(ib, { ok: true, slots: [1, 2], hof: 1 });
  const l = await dev2.save.loadSlot(2);
  assert.equal(l.state.week, 9); assert.equal(l.state.text, 'שלום "עולם"\n');
  assert.equal((await dev2.save.loadHallOfFame())[0].careerId, 'c_h');
  // Import over an occupied slot keeps the old career recoverable.
  const r = await dev2.save.importToSlot(p1, 2);
  assert.equal(r.ok, true);
  assert.equal(await dev2.save.hasDeleted(2), true);
});

test('two tabs: a write from another tab blocks this tab', async () => {
  resetStores();
  const a = await openTab();
  save1(a.save, 1, 'c_a', 2026, 1);
  const ext = [];
  a.save.onExternalWrite((e) => ext.push(e));
  const b = await openTab();
  await b.save.loadSlot(1);
  save1(b.save, 1, 'c_a', 2026, 2);
  // The browser fires 'storage' only in OTHER tabs.
  for (const l of listeners) if (l.tab !== b.id) l.fn({ key: 'hy.slot.1', newValue: ls.getItem('hy.slot.1'), storageArea: ls });
  assert.equal(ext.length, 1); assert.equal(ext[0].slot, 1); assert.equal(typeof ext[0].seq, 'number');
  const raw = ls.getItem('hy.slot.1');
  const r = save1(a.save, 1, 'c_a', 2026, 1, { stale: true });
  assert.equal(r.ok, false); assert.equal(r.warn, 'blocked_other_tab');
  assert.equal(ls.getItem('hy.slot.1'), raw);
  assert.equal(save1(b.save, 1, 'c_a', 2026, 3).ok, true, 'the writing tab is not blocked');
});

test('size: a 1.2 MB state saves and loads', async () => {
  resetStores();
  const { save } = await openTab();
  const big = Array.from({ length: 30000 }, (_, i) => ({ aw: i, c: 'isr1', g: i % 3, r: 6.5 }));
  const r = save1(save, 3, 'c_big', 2050, 30, { matches: big });
  assert.equal(r.ok, true); assert.ok(r.bytes > 1e6, 'bytes ' + r.bytes);
  await save.flushPending();
  const l = await (await openTab()).save.loadSlot(3);
  assert.equal(l.ok, true); assert.equal(l.state.matches.length, 30000);
});

test('fnv1a matches the spec algorithm', async () => {
  const { save } = await openTab();
  assert.equal(save.fnv1a(''), '811c9dc5');
  assert.equal(save.fnv1a('a'), 'e40c292c');
  assert.equal(save.fnv1a('שלום').length, 8);
});

// ---------------------------------------------------------------------------
let failed = 0;
for (const t of tests) {
  try {
    await t.fn();
    // Let every tab of this test finish its queued IDB writes before the stores are swapped.
    for (const tab of allTabs) await tab.flushPending();
    console.log('PASS', t.name);
  } catch (e) {
    failed++;
    console.log('FAIL', t.name);
    const where = String((e && e.stack) || '').split('\n').filter((l) => l.includes('.test.mjs')).slice(0, 1).join('');
    console.log('   ', String((e && e.message) || e).split('\n').slice(0, 6).join(' '), '\n    at', where.trim());
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
