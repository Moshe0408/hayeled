// tests/migrate-v5.test.mjs: v4 -> v5 (2.3) migration from REAL v4 saves.
// The fixtures tests/fixtures/v4-save-{m,f}.json were produced by the v2.2.0 engine + v2.2.0 save.js (git cac02e2):
// an OVR-52 boy and an OVR-48 girl, stored in slot 1 of a fake localStorage (the dump is the whole storage map).
// Checks: OVR lifted to 60 (±1), potential >= 82, the "קפיצת מדרגה" coach message exactly once (also after a
// save + reload and a forced second migration), no tutorial replay, retired / manager careers untouched.
// Usage: node tests/migrate-v5.test.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const FIX = path.join(ROOT, "tests", "fixtures");
class LS { constructor(){this.map=new Map();} getItem(k){return this.map.has(k)?this.map.get(k):null;} setItem(k,v){this.map.set(k,String(v));} removeItem(k){this.map.delete(k);} key(i){return [...this.map.keys()][i]??null;} get length(){return this.map.size;} clear(){this.map.clear();} }
globalThis.localStorage = new LS();
const url = (p) => pathToFileURL(path.join(ROOT, p)).href;
const game = await import(url('js/engine/game.js'));
let n = 0;
const MSG = /קפיצת מדרגה/;
for (const g of ['m', 'f']) {
  const fx = JSON.parse(fs.readFileSync(`${FIX}/v4-save-${g}.json`, 'utf8'));
  localStorage.clear();
  for (const [k, v] of Object.entries(fx.localStorage)) localStorage.setItem(k, v);
  const save = await import(url('js/core/save.js') + '?r=' + (n++));
  save.configure({ schemaVersion: game.SCHEMA_VERSION, appVersion: '2.3.0', migrate: game.migrateState });
  await save.initStorage();
  const r = await save.loadSlot(1);
  assert.ok(r.ok, 'load ok ' + r.error);
  assert.equal(r.migratedFrom, 4);
  const lr = game.loadState(r.state);
  assert.ok(lr.ok !== false, 'loadState ' + JSON.stringify(lr));
  const m = game.getSaveMeta();
  const before = fx.meta.ovr;
  const S = game.serialize();
  const msgs = S.inbox.filter((it) => it.lines.some((l) => MSG.test(l.t)));
  console.log(g, 'ovr', before, '->', m.ovr, 'pot', S.player.pot, 'msgs', msgs.length, 'stars', game.getStars().balance, 'm5', S.meta.m5, 'carry', S.ev.carry, 'tut', S.meta.tut.st, 'v', S.v);
  assert.ok(before < 60);
  assert.ok(m.ovr >= 59 && m.ovr <= 61, 'ovr 60±1');
  assert.ok(S.player.pot >= 82);
  assert.equal(msgs.length, 1, 'one message');
  assert.equal(S.meta.tut.st, 'skip', 'old careers never replay the tutorial');
  assert.ok(msgs[0].lines[0].t.includes(g === 'f' ? 'לבוגרות' : 'לבוגרים'), 'title: ' + msgs[0].lines[0].t);
  // save as v5 and reload: the lift never repeats
  const w = save.saveSlot(1, game.serialize(), game.getSaveMeta()); await save.flushPending(); assert.ok(w.ok);
  const save2 = await import(url('js/core/save.js') + '?r=' + (n++));
  save2.configure({ schemaVersion: game.SCHEMA_VERSION, appVersion: '2.3.0', migrate: game.migrateState });
  await save2.initStorage();
  const r2 = await save2.loadSlot(1);
  assert.equal(r2.migratedFrom, null);
  game.loadState(r2.state);
  // also force a second migrateV5 pass on the already-migrated data: no-op
  const again = game.migrateState(JSON.parse(JSON.stringify(game.serialize())), 4);
  const S2 = game.serialize();
  assert.equal(S2.inbox.filter((it) => it.lines.some((l) => MSG.test(l.t))).length, 1);
  assert.equal(again.inbox.filter((it) => it.lines.some((l) => MSG.test(l.t))).length, 1, 'idempotent');
  // v2.3 review: a migrated veteran is not a new funnel visitor, and the season objective opened mid-season never pays at once
  game.getAndClearSignals();
  const s0 = game.advanceWeek(); { let x = s0, k = 0; while (x && x.status === 'match' && k++ < 6) { game.startMatch(); game.autoPlayMatch(); game.finishMatch(); x = game.resumeWeek(); } }
  const sig = game.getAndClearSignals().map((x) => x.name);
  const so = game.serialize().meta.obj.seas;
  console.log('   week 1 after migration: season objective', so && so.id, 'tgt', so && so.tgt, 'done', so && so.done, 'base', so && so.base, '| funnel signals', sig.filter((x) => x === 'first_match_done' || x === 'week_reached').length, '| achievement signals', sig.filter((x) => x === 'achievement').length);
  assert.ok(!sig.includes('first_match_done') && !sig.includes('week_reached'), 'funnel signals re-fired for a migrated career: ' + sig.join(','));
  assert.ok(!so || so.done !== true, 'the season objective paid out in the first week after migration: ' + JSON.stringify(so));
  // play 2 weeks: the promoted_v5 inbox event fires, no crash
  for (let i = 0; i < 2; i++) { let x = game.advanceWeek(); let k = 0; while (x && x.status === 'match' && k++ < 6) { game.startMatch(); game.autoPlayMatch(); game.finishMatch(); x = game.resumeWeek(); } if (x && x.ok === false) { game.ackSeasonReview(); } }
  const evs = game.serialize().inbox.filter((it) => it.ev && it.ev.startsWith('v23_promoted')).map((x) => x.ev);
  console.log('   after 2 weeks: ovr', game.getSaveMeta().ovr, 'promoted events', evs, 'toasts', game.takeToasts().map((t) => t.k + ':' + t.id).join(','));
}
// retired / manager careers untouched: take the m fixture, mark retired
{
  const fx = JSON.parse(fs.readFileSync(`${FIX}/v4-save-m.json`, 'utf8'));
  const rec = fx.localStorage['hy.slot.1'];
  console.log('record header keys', Object.keys(fx.localStorage));
}
console.log('MIGRATION OK');
{
  const fx = JSON.parse(fs.readFileSync(`${FIX}/v4-save-m.json`, 'utf8'));
  localStorage.clear();
  for (const [k, v] of Object.entries(fx.localStorage)) localStorage.setItem(k, v);
  let raw = null;
  const save = await import(url('js/core/save.js') + '?r=x');
  save.configure({ schemaVersion: game.SCHEMA_VERSION, appVersion: '2.3.0', migrate: (d, v) => { raw = JSON.parse(JSON.stringify(d)); return game.migrateState(d, v); } });
  await save.initStorage();
  await save.loadSlot(1);
  const { ovrOf } = await import(url('js/engine/player.js'));
  const o0 = ovrOf(raw.player);
  const ret = JSON.parse(JSON.stringify(raw)); ret.retired = { season: 2040, age: 35, club: ret.player.club, reason: 'age' }; ret.player.stage = 'retired';
  const mg = JSON.parse(JSON.stringify(raw)); mg.retired = { season: 2040, age: 35, club: mg.player.club, reason: 'age' }; mg.mgr = { st: 'active', job: null };
  const a = game.migrateState(ret, 4), b = game.migrateState(mg, 4);
  const cnt = (d) => d.inbox.filter((it) => it.lines.some((l) => MSG.test(l.t))).length;
  console.log('retired ovr', o0, '->', ovrOf(a.player), 'msgs', cnt(a), '| manager ovr', ovrOf(b.player), 'msgs', cnt(b));
  assert.equal(ovrOf(a.player), o0); assert.equal(ovrOf(b.player), o0); assert.equal(cnt(a), 0); assert.equal(cnt(b), 0);
  console.log('RETIRED/MANAGER UNTOUCHED OK');
}
