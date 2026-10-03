// idb.js: thin promise wrapper around IndexedDB (SPEC §1.4, §7.3).
// DB 'hayeled', version 1, object store 'kv' (out-of-line string keys, string values).
// Every operation has a 3 s timeout and never throws: failures resolve to null / false / [].
// On InvalidStateError / "connection is closing" (common on iOS after backgrounding) the DB is
// re-opened once and the operation retried.

const DB_NAME = 'hayeled';
const DB_VERSION = 1;
const STORE = 'kv';
const TIMEOUT_MS = 3000;

let _dbp = null;        // Promise<IDBDatabase|null> of the current connection attempt
let _factory = null;    // the indexedDB factory the cached connection belongs to

function factory() {
  try { return globalThis.indexedDB || null; } catch { return null; }
}

export function idbAvailable() {
  return !!factory();
}

function withTimeout(promise, fallback) {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(fallback); } }, TIMEOUT_MS);
    promise.then(
      (v) => { if (!done) { done = true; clearTimeout(t); resolve(v); } },
      () => { if (!done) { done = true; clearTimeout(t); resolve(fallback); } }
    );
  });
}

function openRaw(f) {
  return new Promise((resolve) => {
    let req;
    try {
      req = f.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      try {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      } catch { /* ignore; onerror/onsuccess follows */ }
    };
    req.onblocked = () => { /* the timeout resolves null if it never unblocks */ };
    req.onerror = () => {
      try { if (req.error && typeof req.error === 'object' && 'preventDefault' in req.error) req.error.preventDefault(); } catch { /* ignore */ }
      resolve(null);
    };
    req.onsuccess = () => {
      const db = req.result;
      try {
        db.onversionchange = () => { try { db.close(); } catch { /* ignore */ } dropCache(db); };
        db.onclose = () => dropCache(db);
      } catch { /* ignore */ }
      resolve(db);
    };
  });
}

let _db = null;
function dropCache(db) {
  if (!db || db === _db) { _db = null; _dbp = null; }
}

export async function idbOpen() {
  const f = factory();
  if (!f) return null;
  if (_factory !== f) { _dbp = null; _db = null; _factory = f; }
  if (!_dbp) {
    const p = withTimeout(openRaw(f), null).then((db) => {
      if (!db) { if (_dbp === p) _dbp = null; return null; }
      _db = db;
      return db;
    });
    _dbp = p;
  }
  try { return await _dbp; } catch { return null; }
}

function isConnectionError(e) {
  if (!e) return false;
  const name = String(e.name || '');
  const msg = String(e.message || '');
  return name === 'InvalidStateError' || name === 'TransactionInactiveError' || /connection|closing|closed/i.test(msg);
}

// Runs fn(store) -> IDBRequest|null inside a transaction. Resolves with { ok, value }.
function runTx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(STORE, mode);
    } catch (e) {
      reject(e);
      return;
    }
    let value;
    let req = null;
    try {
      req = fn(tx.objectStore(STORE));
    } catch (e) {
      try { tx.abort(); } catch { /* ignore */ }
      reject(e);
      return;
    }
    if (req) {
      req.onsuccess = () => { value = req.result; if (mode === 'readonly') resolve({ ok: true, value }); };
      req.onerror = (ev) => { try { ev && ev.preventDefault && ev.preventDefault(); } catch { /* ignore */ } };
    }
    tx.oncomplete = () => resolve({ ok: true, value });
    tx.onabort = () => reject(tx.error || new Error('abort'));
    tx.onerror = (ev) => { try { ev && ev.preventDefault && ev.preventDefault(); } catch { /* ignore */ } };
  });
}

async function op(mode, fn, fallback) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const db = await idbOpen();
    if (!db) return fallback;
    let failure = null;
    const res = await withTimeout(
      runTx(db, mode, fn).catch((e) => { failure = e; return null; }),
      null
    );
    if (res && res.ok) return res;
    if (attempt === 0 && isConnectionError(failure)) {
      // Connection lost: forget it and retry once with a fresh connection.
      try { db.close(); } catch { /* ignore */ }
      dropCache(db);
      continue;
    }
    return fallback;
  }
  return fallback;
}

export async function idbGet(key) {
  const res = await op('readonly', (s) => s.get(String(key)), null);
  if (!res) return null;
  const v = res.value;
  return typeof v === 'string' ? v : null;
}

export async function idbSet(key, value) {
  const res = await op('readwrite', (s) => s.put(String(value), String(key)), null);
  return !!res;
}

export async function idbDel(key) {
  const res = await op('readwrite', (s) => s.delete(String(key)), null);
  return !!res;
}

export async function idbKeys(prefix = '') {
  const p = String(prefix);
  const res = await op('readonly', (s) => {
    let range;
    try {
      const KR = globalThis.IDBKeyRange;
      range = p && KR ? KR.bound(p, p + '￿') : undefined;
    } catch { range = undefined; }
    return range !== undefined ? s.getAllKeys(range) : s.getAllKeys();
  }, null);
  if (!res || !Array.isArray(res.value)) return [];
  return res.value.map(String).filter((k) => k.startsWith(p)).sort();
}
