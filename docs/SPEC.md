# הילד מהשכונה: Technical Specification (SPEC v1)

> Single source of truth for all implementers (Data, Engine, Content, UI, Platform, Backend, Integrate).
> If something is not specified here, choose the simplest option that does not change any interface in this document.
> **Interfaces in this document are frozen.** Internal helpers inside a module you own are free.

- Game name: **הילד מהשכונה**, tagline **"מהשכונה ועד הבאלון ד'אור"**, ascii slug `hayeled`.
- Hosting: GitHub Pages at `https://moshe0408.github.io/hayeled/`, which is a **sub-path**. The repo root is the site root.
- Note: every `*.github.io` repo of this user shares **one origin**, and with it one localStorage and one IndexedDB namespace. All keys MUST use the prefix `hy.` and the IDB database name is `hayeled`.

---

## 0. Global conventions (all agents)

1. **ES modules only.** No default exports; named exports only. File extension `.js`. Import with relative paths that include the extension (`import { clamp } from './util.js'`).
2. **No build step, no npm runtime deps, no CDN JS.** The only external resource is Google Fonts CSS (Heebo, Rubik), plus the optional AdSense script, which loads only when enabled.
3. **Relative URLs only** (`./js/main.js`, `./icons/icon-192.png`). Never start a path with `/`.
4. **Pure layers.** `js/core/rng.js`, `js/engine/**`, and `js/data/**` MUST NOT touch `window`, `document`, `localStorage`, `fetch`, `navigator`, `Date.now()`, or `Math.random()`. The only exceptions: `game.js` may call `Date.now()` as the default for `opts.now` / `createdAt` and for `HofEntry.createdAt`; `rng.js` `randomSeed()` may use `globalThis.crypto`, `Date.now()`, and `performance.now()`. They must import and run in Node 20 (`node tests/sim.mjs`).
   - **No module-level mutable state** in `js/engine/**` other than the current career, the signal list, and the subscriber list. Caches derived purely from `js/data/**` (for example, id lookups) are fine. Anything that affects results lives in `State`.
   - **Getters are pure.** Read-only facade functions (`get*`, `hasCareer`, `serialize`, `getSaveMeta`) never consume the main RNG and never change state. Values that are generated lazily for display (teammate names, opponent keeper names, coach names) come from `rngFor(...)` derived streams keyed by ids, so they are stable without being stored.
   - **Stable iteration.** Whenever the order of a loop affects RNG consumption or results, iterate over arrays of ids sorted with plain `<` comparisons. Never rely on `Object.keys` order of state objects, and never use `localeCompare` in engine logic (it is fine for display-only sorting).
   - Determinism is required within one JS engine (Node/V8 in tests). Cross-engine bit-equality (V8 vs Safari JavaScriptCore) is not required, because a save carries its own RNG state.
5. **UI access.** UI code (`js/ui/**`, `js/main.js`) uses the engine **only via `js/engine/game.js`**. UI may import `js/data/strings.js` for labels. UI must not import other engine files.
6. **Language.** All player-facing text is Hebrew. `<html lang="he" dir="rtl">`. Code, ids, and keys are English. The engine returns ready-to-display Hebrew strings in view models (VMs). Numbers are raw, and UI formats them using the helpers re-exported by `game.js`.
7. **Money** is in euros (number, integer €). Display format comes from `fmtMoney(n)`: `€950`, `€12K`, `€1.2M`, `€85M`. Below 10K, show the full number with a thousands separator (`€9,500`).
8. **Season** is identified by its start year (`2026`) and displayed as `2026/27` via `fmtSeason(2026)`.
9. **ids** are lowercase `[a-z0-9_]`. Formats are listed in §3.
10. **Errors.** Facade user actions return `{ ok:false, error:'<code>', messageHe }` for expected failures. They throw only on programming errors (unknown id, wrong phase).
11. **Determinism.** All randomness in the engine comes from the seeded RNG (`js/core/rng.js`). Given the same seed and the same sequence of facade calls, results are identical.
12. **Ownership** (who writes what):

| Agent | Files |
|---|---|
| Architect | `docs/SPEC.md` |
| Data | `js/data/countries.js`, `js/data/leagues.js`, `js/data/names.js` |
| Content | `js/data/events.js`, `js/data/commentary.js`, `js/data/strings.js` |
| Engine | `js/core/rng.js`, `js/engine/*.js`, `tests/sim.mjs` |
| UI | `index.html`, `css/app.css`, `js/main.js`, `js/ui/*.js` |
| Platform | `js/core/save.js`, `js/core/idb.js`, `sw.js`, `manifest.webmanifest`, `icons/*`, `tools/make-icons.mjs`, `tests/serve.mjs`, `README.md`, `.gitignore`, `.nojekyll` (empty file, so GitHub Pages serves files as-is without Jekyll processing), `publish.ps1` |
| Backend | `js/config.js`, `js/core/supa.js`, `js/core/telemetry.js`, `js/core/remote.js`, `js/core/feedback.js`, `js/core/ads.js`, `admin.html`, `css/admin.css`, `js/admin/*.js`, `supabase/schema.sql`, `docs/ADMIN_SETUP.md`, `tests/mock-supabase.mjs` |
| Integrate | `tests/e2e.mjs`, optional `tests/package.json` (devDependency `puppeteer-core` only), fixes across files |

---

## 1. Module list (exact file set and exports)

**The file set below is closed.** `sw.js` precaches exactly these files. If you need more code, put it in one of your listed files. Do not create new JS files without updating §1 and the `sw.js` PRECACHE list.

### 1.1 Root files

| File | Owner | Notes |
|---|---|---|
| `index.html` | UI | Game shell. See §9.1. |
| `admin.html` | Backend | Admin dashboard. `<meta name="robots" content="noindex,nofollow">`. Not linked from the game. |
| `manifest.webmanifest` | Platform | See §7.6. |
| `sw.js` | Platform | See §7.7. |
| `README.md`, `.gitignore`, `publish.ps1` | Platform | See §11. |
| `icons/icon.svg`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/maskable-512.png`, `icons/apple-touch-icon.png` (180×180) | Platform | Generated by `tools/make-icons.mjs` (zero-dependency PNG encoder using `node:zlib`). |
| `css/app.css` | UI | The only game stylesheet. |
| `css/admin.css` | Backend | |

### 1.2 `js/config.js` (Backend)

```js
export const APP_VERSION = '1.0.0';            // MUST equal VERSION in sw.js
export const APP_NAME = 'הילד מהשכונה';
const CONFIG_URL = '';                          // the owner pastes the Supabase Project URL here
const CONFIG_ANON_KEY = '';                     // the owner pastes the anon / publishable key here
export const DEV_OVERRIDE_KEY = 'hy.dev.backend';
const dev = readDevOverride();                  // try { JSON.parse(globalThis.localStorage?.getItem(DEV_OVERRIDE_KEY)) } catch { null }
export const SUPABASE_URL = (dev?.url || CONFIG_URL).replace(/\/+$/, '');   // string, '' by default
export const SUPABASE_ANON_KEY = dev?.anonKey || CONFIG_ANON_KEY;           // string, '' by default
export const BACKEND_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
export const FEEDBACK_ENABLED = true;
export const TELEMETRY_DEFAULT_ON = true;
export const HEARTBEAT_MS = 60000;
```
(The code block is the exact shape; `readDevOverride` is a private helper in the same file.)
**Dev override (used by e2e and local testing).** If `globalThis.localStorage` exists and `localStorage['hy.dev.backend']` parses as `{"url":"http://localhost:54321","anonKey":"mock-anon"}`, those values replace the two constants. All access is wrapped in try/catch, and the module must import cleanly in Node.

### 1.3 `js/core/rng.js` (Engine)

```js
export function createRng(seed /* uint32 number */) /* -> Rng */;
export function hash32(...parts /* string|number */) /* -> uint32: FNV-1a 32 over parts.join('|') */;
export function rngFor(...parts) /* -> Rng = createRng(hash32(...parts)); derived stream, does NOT touch main RNG */;
export function randomSeed() /* -> uint32 via crypto.getRandomValues if present, else (Date.now() ^ perf) >>> 0. Only for new careers. */;

// Rng (mulberry32; the whole state is one uint32)
// rng.next()            -> float in [0,1)
// rng.int(min, max)     -> integer in [min, max] inclusive
// rng.float(min, max)   -> float in [min, max)
// rng.chance(p)         -> boolean (next() < p)
// rng.pick(arr)         -> element (undefined if empty)
// rng.weighted(arr, fn) -> element chosen with weight fn(el) >= 0 (falls back to pick if all 0)
// rng.shuffle(arr)      -> same array, Fisher-Yates in place
// rng.normal(mean=0, sd=1) -> Box-Muller (consumes 2 draws, no caching, to keep state = 1 uint32; use u1 = 1 - next() so log(0) never happens)
// rng.poisson(lambda)   -> integer (Knuth; lambda clamped to [0, 10])
// rng.getState()        -> uint32
// rng.setState(u32)
```

### 1.4 `js/core/save.js` and `js/core/idb.js` (Platform)

```js
// idb.js: thin promise wrapper. DB 'hayeled', version 1, object store 'kv' (out-of-line string keys, string values).
export function idbAvailable() /* -> boolean (indexedDB exists) */;
export async function idbOpen()  /* -> IDBDatabase|null (null if blocked/private mode; never throws) */;
export async function idbGet(key)        /* -> string|null */;
export async function idbSet(key, value) /* -> boolean */;
export async function idbDel(key)        /* -> boolean */;
export async function idbKeys(prefix='') /* -> string[] */;
```
```js
// save.js
export const SLOTS = [1, 2, 3];
export function configure({ schemaVersion, appVersion, migrate /* (data, fromVersion) => data */ });
export async function initStorage()          /* -> { ls:boolean, idb:boolean } */;
export async function listSlots()            /* -> SlotInfo[] (always 3 items) */;
export async function loadSlot(slot)         /* -> LoadResult */;
export function saveSlot(slot, state, meta, opts /* { onQuota?: (level:1|2|3)=>object|null } */) /* -> SaveResult (sync) */;
export function flushPending()               /* -> Promise<void>, resolves when queued IDB writes finish */;
export async function deleteSlot(slot)       /* soft delete (see §7) */;
export async function hasDeleted(slot)       /* -> boolean */;
export async function restoreDeleted(slot)   /* -> LoadResult */;
export async function restorePrevious(slot)  /* -> LoadResult (swap cur <-> prev) */;
export async function loadHallOfFame()       /* -> HofEntry[] (newest first) */;
export async function addHallOfFame(entry)   /* -> HofEntry[]; dedupe by entry.careerId (replace) */;
export async function exportSlotJSON(slot)   /* -> { filename, json } */;
export async function exportSlotCode(slot)   /* -> string 'HY1:...' or 'HY0:...' */;
export async function exportBackupJSON()     /* -> { filename, json } all slots + HoF */;
export function downloadFile(filename, text, mime='application/json');
export async function parseImport(text)      /* -> ImportParsed | { ok:false, error, messageHe } */;
export async function importToSlot(parsed, slot) /* -> LoadResult */;
export async function importBackup(parsed)   /* -> { ok, slots:number[], hof:number } */;
export async function requestPersist()       /* -> 'granted'|'denied'|'unsupported' */;
export async function getStorageStatus()     /* -> { persisted:boolean|null, usage:number|null, quota:number|null, ls:boolean, idb:boolean } */;
export function onWarning(cb /* ({code, messageHe}) => void */) /* -> unsubscribe */;
export function onExternalWrite(cb /* ({ slot, seq }) => void */) /* -> unsubscribe; fires when ANOTHER tab writes hy.slot.<n> (window 'storage' event) */;
export function fnv1a(str) /* -> 8-char lowercase hex */;
```
Types are defined in §7. `initStorage()` must be awaited before any other call. It reads every slot header from LS (sync) and IDB and seeds the per-slot `lastSeq` (the max `seq` over all copies and tombstones) and `lastSum`, so the synchronous `saveSlot` never reuses a sequence number.

### 1.5 Backend core modules (Backend)

```js
// js/core/supa.js
export function isEnabled() /* -> BACKEND_ENABLED */;
export class SupaError extends Error { /* .status:number, .code:string */ }
export async function rpc(name, args = {}, { token, keepalive = false, timeoutMs = 8000 } = {}) /* -> parsed JSON */;
export async function select(table, query /* 'select=key,value' */, { token, timeoutMs = 8000 } = {}) /* -> rows[] */;
export const auth = {
  async signIn(email, password) /* -> Session */,
  async refresh(refreshToken)   /* -> Session */,
  async signOut()               /* clears stored session; best-effort POST /auth/v1/logout */,
  getSession()                  /* -> Session|null from localStorage 'hy.admin.session' */,
  async getValidToken()         /* -> access_token (refreshes if expires in < 60s) or null */,
};
// Session = { access_token, refresh_token, expires_at /* unix seconds */, user: { id, email } }

// js/core/telemetry.js
export function initTelemetry({ appVersion } = {}) /* idempotent; never throws */;
export function track(name /* ^[a-z_]{2,32}$ */, props = {});
export async function flush({ keepalive = false } = {}) /* -> boolean */;
export function trackSignals(signals /* Signal[] from game.getAndClearSignals() */);
export function setConsent(on);
export function getConsent() /* -> boolean */;
export function getDeviceId() /* -> string */;
export function getSessionId() /* -> string */;

// js/core/remote.js
export const REMOTE_DEFAULTS /* RemoteConfig, see §8.4 */;
export async function loadRemoteConfig({ timeoutMs = 4000 } = {}) /* -> RemoteConfig (never throws) */;
export function getRemoteConfig() /* -> RemoteConfig (cache or defaults, sync) */;
export function onRemoteConfig(cb) /* -> unsubscribe; cb(config) after each successful load */;
export function compareVersions(a, b) /* -> -1|0|1 for 'x.y.z' */;

// js/core/feedback.js
export function isFeedbackAvailable() /* -> boolean */;
export async function submitFeedback({ rating, text, email, context }) /* -> { ok, queued, error? } */;
export function shouldPrompt(trigger /* 'season1'|'retired' */) /* -> boolean */;
export function markPrompted(trigger /* 'season1'|'retired' */);
export async function flushFeedbackQueue() /* -> number sent */;

// js/core/ads.js
export function initAds(adsConfig /* RemoteConfig.ads */, { track, adsConsent = false } = {});  // re-callable: a later call replaces the config (after remote refresh or consent change)
export function onAdsChange(cb) /* -> unsubscribe; cb() after every initAds call, so mounted slots re-render */;
export function isEnabled(placement /* optional */) /* -> boolean */;
export function renderSlot(el, placement /* 'hub_banner' */) /* -> boolean rendered */;
export function noteMatchday();
export async function maybeInterstitial(context /* { type:'matchday', week } */) /* -> boolean shown */;
export function canShowRewarded() /* -> boolean */;
export async function showRewarded(onReward /* optional fn */) /* -> boolean earned */;
```

### 1.6 Data and content modules

```js
// js/data/countries.js (Data)
export const CONFEDS = ['UEFA','CONMEBOL','CONCACAF','CAF','AFC'];
export const COUNTRIES;          // Country[] (§3.1)
export const COUNTRY_BY_ID;      // { [id]: Country }
// js/data/leagues.js (Data)
export const LEAGUES;            // League[] (§3.2), in the order listed in §3.2
export const LEAGUE_BY_ID;       // { [id]: League }
export const CLUB_INDEX;         // { [clubId]: { club: Club, leagueId } } for league clubs AND filler clubs (leagueId = null for fillers)
export const EURO_FILLER_CLUBS;  // FillerClub[] (§3.3)
// js/data/names.js (Data)
export const NAME_POOLS;         // { [poolId]: { first: string[], last: string[] } } (§3.4)
export const NICKNAMES;          // string[] suggestions
export const FRIEND_NAMES;       // string[] neighbourhood friends
export const PARTNER_NAMES;      // string[]
export const AGENT_NAMES;        // string[]
export const JOURNALIST_NAMES;   // string[]

// js/data/events.js (Content)
export const EVENTS;             // EventDef[] (§4.1)
// js/data/commentary.js (Content)
export const MOMENT_TEXT;        // §4.2
export const RESULT_TEXT;
export const RESULT_TEXT_BY_TYPE;
export const MATCH_TEXT;
// js/data/strings.js (Content)
export const POSITIONS, ATTRS, TRAINING, ROLES, ODDS, STAGES, COMP_TYPES, EURO_COMPS, ROUND_NAMES,
             TOURNAMENTS, AWARDS, TROPHIES, INJURIES, PERSONAS, MONTHS, LEGACY_TIERS, SHOP_ITEMS,
             RESULT_LABELS, ALERTS, SELECTION, FORMAT_LABELS;   // §4.3
```

### 1.7 Engine modules (Engine). The file set is fixed; internal signatures are suggestions.

Only `game.js` is a cross-team contract (§6). The other files are listed so `sw.js` can precache them.

| File | Purpose (suggested exports) |
|---|---|
| `js/engine/game.js` | **Facade** (§6). |
| `js/engine/state.js` | `SCHEMA_VERSION`, `createEmptyState()`, `migrateState(data, fromV)`, `absWeek(season, week)`, `nextId(state, kind)` |
| `js/engine/util.js` | `clamp`, `round1`, `lerp`, `avg`, `sum`, `fill(template, vars)`, `fmtMoney`, `fmtSeason`, `deepClone` |
| `js/engine/calendar.js` | Week constants (§5.1), `leagueRoundSlots(R)`, `cupRoundSlots(n)`, `tournamentSlots(format)`, `isWindowOpen(week)`, `monthOfWeek(week)`, `weekLabelHe(season, week)`, `summerTournaments(year)` |
| `js/engine/schedule.js` | `roundRobin(ids, cycles, rng)`, `splitGroups(table, groups)`, `cupBracket(...)`, `leaguePhaseDraw(ids36, strengthFn, rng)` |
| `js/engine/sim.js` | `lambdas(sH, sA, neutral)`, `simScore(rng, sH, sA, opts)`, `simExtraTime`, `simPenalties` |
| `js/engine/world.js` | World init, club runtime values, league tables, promotion/relegation, club evolution, weekly round play |
| `js/engine/player.js` | Player creation, OVR, potential, development, aging, injuries, market value, wages |
| `js/engine/selection.js` | Matchday selection |
| `js/engine/moments.js` | Key moment catalog, generation, odds, resolution, rating |
| `js/engine/match.js` | Live match orchestration (pre, live, ended), auto play, summary |
| `js/engine/transfers.js` | Offers, negotiation, contracts, loans, renewals, free-agent fallback |
| `js/engine/europe.js` | UCL/UEL/UECL qualification, league phase, knockouts |
| `js/engine/cups.js` | Domestic cups |
| `js/engine/national.js` | National team call-ups, qualifiers, friendlies, tournaments, youth internationals |
| `js/engine/awards.js` | Season awards, Ballon d'Or, Golden Boy, fictional stars |
| `js/engine/narrative.js` | Event engine, triggers, inbox |
| `js/engine/history.js` | Match records, season archive, timeline, legacy score, HoF entry |
| `js/engine/shop.js` | Lifestyle shop |

### 1.8 UI modules (UI). The file set is fixed.

`js/main.js` (boot, see §9.2) plus the files below. Every screen module exports `render(root /* HTMLElement */, params /* object from route */) -> (cleanup fn | void)`.

| File | Purpose |
|---|---|
| `js/ui/dom.js` | `h(tag, attrs, ...children)`, `$`, `$$`, `esc(str)`, `clear(el)` |
| `js/ui/router.js` | `route(pattern, loader)`, `navigate(hash)`, `startRouter(root)`, `currentRoute()` → `{ path, params, query }`. The hash may carry a query (`#/feedback?rating=5&trigger=season1`); the router splits it off and passes `{...params, ...query}` to `render`. Loaders use `import('./hub.js')`: dynamic import specifiers resolve relative to `router.js` (`js/ui/`), not to the page. |
| `js/ui/app.js` | App shell: header, bottom tab bar, toast (`toast(textHe)`), modal (`openModal(contentEl, opts) -> close`), confirm dialog, `commit()` (calls autosave), announcement banner, update banner |
| `js/ui/components.js` | Cards, stat bars, stars, team badge (colors), fixture row, table renderer, chat bubbles, segmented control, empty states |
| `js/ui/format.js` | `money`, `pct`, `rating`, `dateLabel`, `ago`; wraps `fmtMoney`/`fmtSeason` from game.js |
| `js/ui/title.js` | `#/title` |
| `js/ui/create.js` | `#/new` wizard |
| `js/ui/hub.js` | `#/hub` |
| `js/ui/week.js` | Week summary modal + season review modal (`#/season`) |
| `js/ui/match.js` | `#/match` |
| `js/ui/inbox.js` | `#/inbox`, `#/chat/:id` |
| `js/ui/schedule.js` | `#/schedule` |
| `js/ui/tables.js` | `#/tables`, `#/tables/:compId` |
| `js/ui/career.js` | `#/career` |
| `js/ui/profile.js` | `#/profile` |
| `js/ui/national.js` | `#/national` |
| `js/ui/offers.js` | `#/offers` |
| `js/ui/awards.js` | `#/awards` |
| `js/ui/shop.js` | `#/shop` |
| `js/ui/hof.js` | `#/hof` |
| `js/ui/settings.js` | `#/settings` |
| `js/ui/feedback.js` | `#/feedback` + `openFeedbackPrompt(trigger)` |
| `js/ui/install.js` | `#/install` + `initInstall()` (beforeinstallprompt capture), `canInstall()`, `isStandalone()`, `isIOS()` |
| `js/ui/adslots.js` | `mountAdSlot(el, placement)`, `afterWeekAds(summary)`, `rewardedButton(el)` (glue to `js/core/ads.js`) |
| `js/ui/retire.js` | `#/retire` |

### 1.9 Admin modules (Backend)

`js/admin/admin.js` (entry, router `#/login`, `#/dash`, `#/feedback`, `#/config`), `js/admin/api.js` (wrappers over supa.js RPCs), `js/admin/charts.js` (inline SVG line/bar charts), `js/admin/views.js` (renderers).

### 1.10 Tests and tools

`tests/sim.mjs` (Engine), `tests/serve.mjs` (Platform), `tests/mock-supabase.mjs` (Backend), `tests/e2e.mjs` (Integrate), `tools/make-icons.mjs` (Platform). None of these are precached.

---

## 2. Game STATE (schema version 1)

The state is one JSON-serialisable object held inside `game.js`. It has no class instances, no `undefined` values (use `null`), no `Map`/`Set`, and no functions. Floats are rounded to 1 decimal where noted, to keep the JSON small. **Target size: < 400 KB after 25 seasons; hard limit 1.5 MB.**

Notation: `absWeek = season * 52 + week` (unique and monotonic).

```ts
State = {
  v: 1,                         // SCHEMA_VERSION
  id: string,                   // career id 'c_' + base36(now) + '_' + base36(seed), e.g. 'c_m1x2k3_9f3a1'
  createdAt: number,            // ms epoch (from opts.now ?? Date.now(); excluded from determinism checks)
  seed: number,                 // initial uint32 seed
  rng: number,                  // current mulberry32 state (uint32), written before every serialize()
  startSeason: number,          // 2026
  season: number,               // current season start year
  week: number,                 // 1..52 (1..44 season, 45..52 summer)
  wstep: 0|1|2,                 // 0 = week not started, 1 = midweek slot done, 2 = weekend slot done (internal)
  inWeek: boolean,              // true between advanceWeek() and week completion
  wsum: null | {                // week-in-progress accumulator (persisted, so a reload mid-week still yields a full WeekSummaryVM)
    ovrBefore: number, results: object[] /*WeekSummaryVM.results rows so far*/, lines: string[], injuryHe: string|null, callupHe: string|null,
    msgs: number, offers: number, hadMatchday: boolean
  },                            // set at week start, cleared when the week completes
  training: TrainingId,         // last chosen training (§4.3 TRAINING keys)
  player: Player,
  world: World,
  comp: SeasonComps,            // this season's competitions (engine-internal shapes, see 2.4)
  nt: NationalState,
  inbox: InboxItem[],           // newest LAST; capped at 80 (drop oldest answered/info first)
  offers: Offer[],              // active + recently closed (closed pruned after 4 weeks)
  live: LiveMatch|null,         // match in progress (survives reload)
  lastMatch: MatchSummary|null, // last finished player match (for display)
  pending: { review: number|null, retire: null|'forced'|'offer' }, // season review to show; retirement state (see below)
  hist: History,
  stars: Star[],                // 40 fictional world stars
  ev: { cd: {[eventId]: number /*absWeek last fired*/}, once: string[], flags: {[flag]: number|boolean}, trig: string[] /*triggers raised this week*/,
        q: string[] /*EventDef ids queued by Effects.next, fired first at the next week end*/ },
  names: { coach: {[clubId]: string}, agent: string, journalist: string, friends: [string,string,string], partner: string|null },
  ctr: { m: number, o: number, t: number, s: number },  // id counters: inbox 'm<n>', offers 'o<n>', timeline 't<n>', stars 's<n>'
  retired: null | { season, week, age, reason: 'voluntary'|'age'|'decline'|'no_club', legacy: number }
}
```
**Retirement flags (exact meaning).** `retired !== null` is the single source of truth for "career over" (HubVM `status:'retired'`, `pending.retire: true`). `pending.retire` is a hint for the UI only: `'offer'` = the engine suggests retiring (set at the end of week 44 when age ≥ 33, cleared by `ackSeasonReview()`); `'forced'` = the engine retired the player itself at rollover (the retire screen shows the forced wording). It is never cleared once `retired` is set.

### 2.1 Player

```ts
Player = {
  first: string, last: string, nick: string,      // Hebrew, nick may be ''
  nation: CountryId,                               // 'isr'
  pos: 'GK'|'CB'|'LB'|'RB'|'CDM'|'CM'|'CAM'|'LW'|'RW'|'ST',
  foot: 'R'|'L',
  born: number,                                    // birth year; age in season S = S - born (start: age 15)
  a: { pac, sho, pas, dri, def, phy, div, han, ref, gkp, kic },  // numbers 1..99, 1 decimal
  pot: number,                                     // hidden potential 55..96 (integer)
  potSeen: [number, number],                       // scout range shown to user (integers)
  peak: number,                                    // highest OVR reached
  energy: number, morale: number,                  // 0..100 (integers)
  form: number[],                                  // last <=5 match ratings (1 decimal), newest last
  injury: null | { weeks: number, kind: string /* INJURIES id */, sev: 'minor'|'medium'|'major' },
  susp: number,                                    // matches suspended (red cards are not modelled; 5 yellows = 1 match)
  yc: number,                                      // yellow cards this season (league)
  trust: number, fans: number, mates: number,      // 0..100
  rep: { l: number, c: number, w: number },        // local / continental / world 0..100 (1 decimal)
  money: number,                                   // bank €
  stage: 'youth'|'pro'|'free'|'retired',
  club: ClubId|null,                               // club he currently plays for (loan club while on loan)
  contract: Contract|null,                         // current contract (loan contract while on loan). While stage === 'youth' this is the
                                                   // youth contract { club: academy, wage: 150+5*s, until: born+18, role:'prospect', rc:0, loan:false }.
                                                   // Youth contracts are NOT subject to §5.3a step 6 expiry; §5.10 governs them.
  parent: Contract|null,                           // parent-club contract while on loan, else null
  next: Contract|null,                             // signed pre-contract that starts at week 45 (summer), else null
  youth: null | 'u17'|'u19',                       // youth team level while stage === 'youth'
  owned: string[],                                 // SHOP_ITEMS ids
  mins: number[],                                  // minutes played in each of the last 8 weeks (0..180)
  bench: number,                                   // consecutive weeks without a start (club matches)
  freeWeeks: number,                               // consecutive weeks without a club
  treq: boolean,                                   // transfer request active
  agentPush: number,                               // weeks remaining of agent push (more offers)
  natLvl: 'none'|'u17'|'u19'|'u21'|'senior',       // current national level (called up at least once at this level)
  caps: { u17, u19, u21, senior },                 // appearances
  ig:   { u17, u19, u21, senior },                 // international goals
  s: SeasonStats                                   // current season stats
}

Contract = { club: ClubId, wage: number /*€ per week*/, until: number /*last season covered*/, role: RoleId,
             rc: number /*release clause €, 0 = none*/, since: number /*season signed*/, loan: boolean }
// A contract "covers" season S through the end of week 44 of S. For a contract of `years` signed now:
//   effSeason = (week >= 45 ? season + 1 : season);  until = effSeason + years - 1.   Loans: until = effSeason (one season).

RoleId = 'star'|'key'|'rotation'|'squad'|'prospect'

SeasonStats = { lg: Line, cup: Line, eu: Line, nt: Line, yth: Line, ynt: Line }   // league, domestic cup, Europe, senior national, youth league, youth national
Line = { apps, st /*starts*/, min, g, a, cs /*clean sheets, GK/DEF only*/, rs /*sum of ratings, 1 decimal*/, motm }
```

### 2.2 World, clubs, stars

```ts
World = {
  clubs: { [ClubId]: { s: number /*strength 35..92, 1 decimal*/, r: number /*reputation 1..100*/, b: number /*budget M€*/, lg: LeagueId|null /*current league; null for fillers*/ } },
  champs: { [season]: { [compId]: ClubId } }  // winners archive: leagues, cups, ucl/uel/uecl (compact)
}
Star = { id: 's<n>', first, last, nation, pos, club: ClubId, born, ovr /*1 dec*/, pot, bdo: number /*wins*/, g: number /*goals last season*/ }
```

### 2.3 Inbox, offers, live match

```ts
InboxItem = {
  id: 'm<n>', aw: number /*absWeek*/, from: PersonaId, ev: string|null /*EventDef id*/,
  lines: [{ who: SpeakerId|'me', t: string /*rendered Hebrew*/ }],
  choices: null | [{ label: string, disabled: boolean }],  // rendered labels; `disabled` is re-checked in answerEvent (money may have changed)
  ans: number|null,           // chosen index
  exp: number|null,           // absWeek after which defaultChoice is auto-applied (aw + 2)
  imp: boolean,               // important: true for trigger events (EventDef.trigger !== null) that have choices; fastForward stops on these
  read: boolean
}
SpeakerId = PersonaId | 'friend1' | 'friend2' | 'friend3'   // friendN = state.names.friends[N-1]; used inside the 'friends' group chat
Offer = {
  id: 'o<n>', aw: number, club: ClubId,
  type: 'transfer'|'loan'|'free'|'precontract'|'renewal'|'pro',
  fee: number, wage: number, years: number /*1..5*/, role: RoleId, rc: number,
  exp: number /*absWeek it expires*/, status: 'open'|'accepted'|'rejected'|'expired'|'club_refused'|'withdrawn',
  neg: number /*negotiation rounds used, max 2; loans and 'pro' offers cannot be negotiated*/
}
LiveMatch = {
  fx: FixtureRef,             // { comp: CompId, week, slot:'mw'|'wk', h: ClubOrNationId, a: ClubOrNationId, kind: 'league'|'cup'|'europe'|'national'|'youth'|'ynt'|'friendly', tie?: { leg:1|2, agg:[h,a] }|null, ko: boolean /*must have a winner*/, big: boolean }
  role: 'starter'|'bench',
  phase: 'pre'|'live'|'ended',
  on: number,                 // minute the player is on the pitch from (0 for starter; 55..80 for bench)
  off: number,                // minute he leaves (90; or earlier if subbed at 60..85 when energy low)
  sc: [number, number],       // score [home, away]
  bg: [{ m: number, side: 'h'|'a' }],      // pre-drawn background goals (minute, side)
  mo: [{ m: number, type: MomentType, opts: string[] /*option keys*/, setup: string /*rendered*/, res: null | { opt: number, code: ResultCode, ok: boolean, t: string, d: number /*rating delta*/ } }],
  i: number,                  // index of current moment
  log: [{ m: number, t: string, k: 'goal_for'|'goal_against'|'moment'|'info' }],
  rd: number,                 // running rating delta sum
  et: null | { sc: [number,number], pens: [number,number]|null }
}
```
`MatchSummary` = the VM returned by `finishMatch()` (§6.3), stored as-is with its `log` field removed.

**Live match end.** When the last moment is resolved (by `chooseMoment` or `autoPlayMatch`), the engine immediately plays out the remaining background goals up to minute 90. If `fx.ko` and the match (or the aggregate) is level, it then runs extra time and penalties with the team model (§5.4; the player takes no moments in extra time), fills `et`, and sets `phase = 'ended'`.

### 2.4 Season competitions (engine-internal; the shapes are a recommendation)

```ts
SeasonComps = {
  lg:  { [LeagueId]: { r: number /*rounds played*/, R: number /*total rounds*/, t: Row[] /*table*/, sp: null | ClubId[][] /*split groups, set when base phase ends*/, last: [h,a,hg,ag][] /*last round results*/ } },
  yl:  null | { id: string /*'isr1_u17'*/, lvl: 'u17'|'u19', clubs: ClubId[], str: {[ClubId]: number}, r, R, t: Row[] },
  cups:{ [CupId]: { rd: number /*index of next round*/, rounds: Tie[][], alive: ClubId[], w: ClubId|null } },
  eu:  { ucl: Euro, uel: Euro, uecl: Euro },
  next:null | { ucl: {lp: ClubId[], q: ClubId[]}, uel: {...}, uecl: {...} },  // computed at week 44 for next season
  sc:  { [compId]: { n: string /*rival top scorer name*/, club: ClubId, g: number } }  // rival award benchmarks (§5.12)
}
// Every playable league, every domestic cup, and all three European competitions are built and simulated every season,
// whether or not the player is involved (needed for browsing tables and for next season's entrants).
// Knockout draws (domestic cups) happen when the previous round completes, using rngFor(season, cupId, 'draw', rd).
// Future rounds therefore do not exist yet; getSchedule() lists a cup/European KO fixture only once its tie is known.
Row  = [ClubId, p, w, d, l, gf, ga, pts]
Tie  = [h, a, hg|null, ag|null, extra|null]  // extra: 'et' | 'p:4-3'; two-legged ties store 2 entries (leg 1, leg 2)
Euro = { q: Tie[], lp: { teams: ClubId[], fx: [md, h, a, hg|null, ag|null][], t: Row[] }, ko: { kpo: Tie[], r16: Tie[], qf: Tie[], sf: Tie[], f: Tie[] }, w: ClubId|null, md: number }
```
**Schedules are not stored.** Round-robin fixtures are regenerated deterministically with `rngFor(season, leagueId, 'rr')` from the club order sorted by id. Split-phase groups are stored in `sp` because they depend on standings.

### 2.5 National state

```ts
NationalState = {
  str: { [CountryId]: number },            // national strength runtime values (start = COUNTRY.strength, drift ±1/season)
  q: null | { tour: TourKey, grp: CountryId[] /*5*/, fx: [round, h, a, hg|null, ag|null][], t: Row[], done: boolean },  // player's nation qualifier group
  tour: null | Tournament,                  // summer tournament involving the player's nation (or fully simulated if not)
  ytour: null | Tournament,                 // youth tournament (if player called)
  called: { [level]: boolean },             // called up for the current break
  hist: [{ season, key: TourKey, nation: CountryId, stage: 'group'|'r32'|'r16'|'qf'|'sf'|'f'|'w'|'dnq', winner: CountryId }]
}
TourKey = 'wc2030'|'euro2028'|'copa2028'|'afcon2028'|'asian2028'|'gold2028'|'u17_2027'|'u19_2027'|'u21_2027'|... (kind + year)
Tournament = { key: TourKey, kind: string, fmt: 'g48'|'g24'|'g16'|'g8', groups: CountryId[][], gfx: [md, h, a, hg|null, ag|null][], gt: Row[][], ko: { [round]: Tie[] }, w: CountryId|null }
```

### 2.6 History

```ts
History = {
  seasons: [{ s: number, age, club: ClubId|null /*club at the end of week 44*/, lg: LeagueId|null, rank: number|null, ovr: number, stats: SeasonStats, loan: boolean,
              moved: boolean /*true if he changed club during weeks 1-44*/ }],
  matches: [{ aw, c: CompId, k: kind, o: oppId, h: 0|1, gf, ga, r: rating, g, a, m: minutes, st: 0|1 }],  // current + previous season only (older pruned)
  timeline: [{ id: 't<n>', aw, icon: string /*key, §4.3 TROPHIES/ALERTS*/, t: string /*Hebrew*/ }],             // milestones
  trophies: [{ s, k: TrophyKey, c: CompId, club: ClubId|CountryId }],
  awards:   [{ s, k: AwardKey, c: CompId|null, v: number|null /*e.g. goals*/ }],
  bdo:      [{ s, rank: number /*0 = not nominated*/, top: [{ n: string, club: ClubId, nation }] /*top 3*/, gb: number /*Golden Boy rank, 0 = n/a*/ }],
  clubs:    [{ club: ClubId, from: number /*season*/, to: number|null, loan: boolean, fee: number,
               apps: number, g: number, a: number }],   // one entry per spell; apps/goals/assists in all club competitions, incremented live
                                                        // for the open spell (to === null). CareerVM.clubs reads these, so mid-season moves are exact.
  firsts:   { debut: number|null, goal: number|null, ntDebut: number|null, ntGoal: number|null, euDebut: number|null }   // absWeek
}
TrophyKey = 'league'|'league2'|'cup'|'ucl'|'uel'|'uecl'|'wc'|'euro'|'copa'|'afcon'|'asian'|'gold'|'u17'|'u19'|'u21'|'youth_league'
AwardKey  = 'top_scorer'|'pots'|'tots'|'young_pots'|'ucl_top_scorer'|'golden_boy'|'ballon_dor'|'bdo_top3'|'bdo_top10'|'golden_boot_tour'|'motm_final'
```

### 2.7 Compaction rules (engine; used by `compactState(level)`)

- Always: `hist.matches` keeps only the current and previous season. `inbox` is capped at 80. Closed offers are pruned after 4 weeks. `lastMatch.log` is dropped.
- Level 1: drop `hist.matches` of the previous season, and `comp.lg[*].last` except the player's league.
- Level 2: additionally trim `inbox` to the newest 25 and drop `timeline` entries with icon `info`.
- Level 3: additionally drop all `hist.matches` and `ev.cd` entries older than 104 weeks.
- Compaction never touches `hist.seasons`, `hist.trophies`, `hist.awards`, `hist.bdo`, `hist.clubs`, or `player`.
- `compactState(level)` compacts the **live** state in place (so later saves stay small) and returns `serialize()`. Levels are cumulative.

---

## 3. Data schemas (Data agent)

All data files are plain `export const` literals. No functions, except that the index maps may be built with a small loop at module end. All names are in Hebrew. **No real current player names anywhere.** Real club and country names are fine.

### 3.1 `countries.js`

```ts
Country = {
  id: string,            // FIFA-like 3-letter lowercase: 'isr','eng','esp','ita','ger','fra','por','ned','bel','tur','sco','gre','ksa','usa','bra','arg', ...
  nameHe: string,        // 'ישראל'
  flag: string,          // emoji flag, e.g. '🇮🇱' (England/Scotland use subdivision flags)
  confed: 'UEFA'|'CONMEBOL'|'CONCACAF'|'CAF'|'AFC',
  strength: number,      // national team strength 40..90 (same scale as clubs: ~avg XI OVR)
  namePool: PoolId,      // key of NAME_POOLS (§3.4)
  pickable: boolean,     // shown in the create wizard
  leagues: LeagueId[],   // playable leagues in this country (may be [])
  colors: [string, string] // national kit colours, e.g. isr ['#0038B8','#FFFFFF'] (used for TeamVM badges)
}
```
**TeamVM for non-club sides** (engine rule): a nation's TeamVM is `{ id, nameHe, shortHe: nameHe, colors: Country.colors, flag }`. A youth national side uses `nameHe = country + ' עד גיל 17'` (or 19 / 21) and `shortHe = country name`. A club youth side (youth league) uses the club's TeamVM with ' (נוער)' appended to `nameHe` and `shortHe` unchanged.
Requirements:
- **≥ 105 countries total**, so tournaments can be filled: UEFA ≥ 34, CONMEBOL = 10, CONCACAF ≥ 16, CAF ≥ 24, AFC ≥ 22. Israel is UEFA.
- **≥ 40 pickable**, including: isr, eng, esp, ita, ger, fra, por, ned, bel, tur, sco, gre, ksa, usa, bra, arg, cro, srb, pol, ukr, den, swe, nor, sui, aut, cze, rou, hun, irl, wal, geo, cyp, mar, egy, nga, sen, gha, civ, alg, tun, jpn, kor, aus, mex, can, uru, col, chi.
- Strength anchors (keep the relative order roughly like this): fra 87, esp 87, arg 87, eng 86, bra 86, por 85, ger 85, ned 83, ita 83, bel 81, cro 79, uru 79, col 78, mar 78, den 77, sui 77, usa 75, jpn 76, sen 76, mex 75, tur 76, aut 76, nor 75, pol 73, srb 74, ukr 74, sco 72, gre 71, kor 74, egy 72, ksa 68, **isr 68**, cyp 58, and the smallest nations 45..55.
- The first element of `COUNTRIES` is `isr` (the default nation).

### 3.2 `leagues.js`: the exact playable league list

```ts
League = {
  id: LeagueId, countryId: CountryId, tier: 1|2,
  nameHe: string, shortHe: string,
  prestige: number,                 // 1..10, drives wages, reputation gain and awards weight
  format: Format,
  relegation: null | { to: LeagueId, count: number },   // only between modelled tiers
  promotion:  null | { to: LeagueId, count: number },
  euro: null | { ucl: { lp: number, q: number }, uel: { lp: number, q: number }, uecl: { lp: number, q: number }, cup: 'uel_lp'|'uel_q'|'uecl_q' },  // tier-1 UEFA leagues only
  cup: null | { id: CupId, nameHe: string },             // set on tier 1 only; the cup includes all clubs of all modelled tiers of the country
  youthNameHe: string,              // e.g. 'ליגת הנוער' (the engine appends ' עד גיל 17' / ' עד גיל 19')
  clubs: Club[]                     // exactly `size` entries
}
Format =
  | { type: 'double_rr' }                                          // 2*(N-1) rounds
  | { type: 'double_rr_split' | 'triple_rr_split',                 // base phase 2 or 3 round robins, then split
      groups: [{ from: number, to: number, rr: 1|2, nameHe: string }],   // ranks (1-based, inclusive) after base phase
      halve: boolean }                                             // halve points (ceil) at split (Belgium)
Club = {
  id: ClubId,              // '<country>_<slug>' e.g. 'isr_mhaifa', 'eng_mcity', 'esp_rmadrid' (slug <= 10 chars)
  nameHe: string,          // 'מכבי חיפה'
  shortHe: string,         // <= 10 chars: 'מ. חיפה'
  city: string,            // 'חיפה'
  strength: number,        // 35..92 base strength (integer)
  reputation: number,      // 1..100
  budget: number,          // M€ per year (transfer + wage capacity), 1..400
  colors: [string, string],// ['#00843D', '#FFFFFF'] primary, secondary
  rival: ClubId|null       // derby rival (same league or country), or null
}
```

**Exact league list (order of the `LEAGUES` array):**

| id | country | tier | nameHe | size | format | rel/prom | euro (ucl / uel / uecl, cup) | cup |
|---|---|---|---|---|---|---|---|---|
| `isr1` | isr | 1 | ליגת העל | 14 | `double_rr_split`: 26 rounds, then groups 1-6 rr2 'פלייאוף עליון', 7-14 rr1 'פלייאוף תחתון' → R=36 | rel 2 → isr2 | q1 / – / q2, cup `uel_q` | `isr_cup` גביע המדינה |
| `isr2` | isr | 2 | הליגה הלאומית | 16 | `double_rr_split`: 30, then groups 1-8 rr1 'פלייאוף עליון', 9-16 rr1 'פלייאוף תחתון' → R=37 | prom 2 → isr1 | – | – |
| `eng1` | eng | 1 | הפרמייר ליג | 20 | `double_rr` R=38 | rel 3 → eng2 | lp4 / lp1 / q1, cup `uel_lp` | `eng_cup` הגביע האנגלי |
| `eng2` | eng | 2 | הצ'מפיונשיפ | 24 | `double_rr` R=46 | prom 3 → eng1 | – | – |
| `esp1` | esp | 1 | לה ליגה | 20 | `double_rr` 38 | – | lp4 / lp1 / q1, `uel_lp` | `esp_cup` גביע המלך |
| `ita1` | ita | 1 | הסרייה A | 20 | `double_rr` 38 | – | lp4 / lp1 / q1, `uel_lp` | `ita_cup` גביע איטליה |
| `ger1` | ger | 1 | הבונדסליגה | 18 | `double_rr` 34 | – | lp4 / lp1 / q1, `uel_lp` | `ger_cup` גביע גרמניה |
| `fra1` | fra | 1 | הליג 1 | 18 | `double_rr` 34 | – | lp3 / lp1 / q1, `uel_lp` | `fra_cup` גביע צרפת |
| `por1` | por | 1 | הליגה הפורטוגלית | 18 | `double_rr` 34 | – | lp1+q1 / lp1 / q1, `uel_lp` | `por_cup` גביע פורטוגל |
| `ned1` | ned | 1 | הארדיביזי | 18 | `double_rr` 34 | – | lp1+q1 / lp1 / q1, `uel_lp` | `ned_cup` גביע הולנד |
| `bel1` | bel | 1 | הליגה הבלגית | 16 | `double_rr_split`: 30, then 1-6 rr2 'פלייאוף האליפות', 7-12 rr2 'פלייאוף אירופה', 13-16 rr2 'פלייאוף תחתון', halve=true → R=40 | – | lp1+q1 / q1 / q1, `uel_q` | `bel_cup` גביע בלגיה |
| `tur1` | tur | 1 | הסופר ליג הטורקית | 18 | `double_rr` 34 | – | q1 / q1 / q1, `uel_q` | `tur_cup` גביע טורקיה |
| `sco1` | sco | 1 | הפרמיירשיפ הסקוטית | 12 | `triple_rr_split`: 33, then 1-6 rr1 'החצי העליון', 7-12 rr1 'החצי התחתון' → R=38 | – | q1 / q1 / q1, `uel_q` | `sco_cup` הגביע הסקוטי |
| `gre1` | gre | 1 | הסופר ליג היוונית | 14 | `double_rr_split`: 26, then 1-4 rr2 'פלייאוף האליפות', 5-8 rr2 'פלייאוף אירופה', 9-14 rr1 'פלייאוף תחתון' → R=32 | – | q1 / q1 / q1, `uel_q` | `gre_cup` גביע יוון |
| `ksa1` | ksa | 1 | ליגת המקצוענים הסעודית | 18 | `double_rr` 34 | – | null | `ksa_cup` גביע המלך הסעודי |
| `usa1` | usa | 1 | MLS | 18 | `double_rr` 34 (simplified single table) | – | null | `usa_cup` גביע ארה"ב הפתוח |
| `bra1` | bra | 1 | הברזיליירו | 20 | `double_rr` 38 | – | null | `bra_cup` גביע ברזיל |
| `arg1` | arg | 1 | הליגה הארגנטינאית | 20 | `double_rr` 38 (simplified) | – | null | `arg_cup` גביע ארגנטינה |

How to read the euro column: it lists the slots for UCL / UEL / UECL in that order. `lpN` means N direct league-phase slots, `qN` means N qualifying-round slots, and `–` means none. Example: `lp1+q1` = `{lp:1, q:1}`. For tier-1 UEFA leagues, the `euro` object must contain all three keys (use `{lp:0,q:0}` for "none").

Totals: 322 league clubs. Prestige: eng1 10, esp1 9.5, ita1 9, ger1 9, fra1 8.5, por1 7, ned1 7, bra1 7, tur1 6.5, arg1 6.5, eng2 6, bel1 6, ksa1 5.5, sco1 5, gre1 5, usa1 5, isr1 4, isr2 2.

Strength guidance (base `strength` is an integer):
- **Elite (86-92):** Real Madrid, Man City, Liverpool, Arsenal, Bayern, Barcelona, PSG, Inter.
- **Strong (78-85):** Chelsea, Atlético, Leverkusen, Dortmund, Napoli, Juventus, Milan, Tottenham, Newcastle, Man United, Aston Villa.
- **Top of mid leagues:** Benfica, Porto, Sporting 77-80; PSV, Ajax, Feyenoord 75-78; Galatasaray, Fenerbahçe 77-79; Celtic 73, Rangers 71; Olympiacos 73.
- **Saudi:** top 4 at 76-78.
- **Brazil and Argentina:** top clubs 72-77.
- **MLS:** 60-70.
- **Israel:** isr1 range 52-66 (Maccabi Tel Aviv 66, Maccabi Haifa 65, Hapoel Be'er Sheva 65, Beitar Jerusalem 61, Hapoel Tel Aviv 59, ...). isr2 range 42-52.
- **Floors:** Championship 62-72. Bottom of each top league about 12-16 points below its top club, with a floor of 55 in the big 5 leagues.
- Include real derby rivals where well known (הפועל תל אביב ↔ מכבי תל אביב, מכבי חיפה ↔ הפועל חיפה, Real ↔ Atlético, ...). `rival` is symmetric where both clubs are modelled.

### 3.3 European filler clubs

```ts
FillerClub = { id: 'eu_<slug>', nameHe, shortHe, city, nation: CountryId, strength: number /*45..82*/, reputation, budget, colors, tier: 1|2|3 }  // tier: 1 = UCL level, 2 = UEL, 3 = UECL
```
- **≥ 100 filler clubs**: at least 30 with tier 1, 35 with tier 2, and 35 with tier 3.
- Fillers come only from UEFA countries **without** a playable league: Austria, Switzerland, Czechia, Croatia, Serbia, Ukraine, Denmark, Norway, Sweden, Poland, Cyprus, Hungary, Romania, Bulgaria, Slovakia, Slovenia, Azerbaijan, Kazakhstan, Bosnia, Moldova, Ireland, Wales, Finland, Iceland, Armenia, Georgia, Belarus, Kosovo, Albania, Malta, North Macedonia, Lithuania, Latvia, Estonia, Luxembourg, Faroe Islands, Northern Ireland, Montenegro, Gibraltar.
- Examples: 'eu_salzburg' רד בול זלצבורג (aut, 74, tier 1), 'eu_dzagreb' דינמו זאגרב, 'eu_crvenaz' הכוכב האדום בלגרד, 'eu_shakhtar' שחטאר דונייצק, 'eu_copenh' קופנהגן, 'eu_bodo' בודו/גלימט, 'eu_slavia' סלביה פראג, 'eu_basel' באזל, 'eu_young' יאנג בויז, 'eu_apoel' אפואל ניקוסיה, 'eu_ferenc' פרנצווארוש, 'eu_qarabag' קרבאח.

### 3.4 `names.js`

```ts
NAME_POOLS = { [PoolId]: { first: string[], last: string[] } }   // Hebrew transliterations
PoolId = 'isr'|'arab'|'eng'|'esp'|'ita'|'ger'|'fra'|'por'|'bra'|'ned'|'tur'|'gre'|'slav'|'nord'|'afr_fr'|'afr_en'|'jpn'|'kor'|'latam'|'generic'
```
- Every `Country.namePool` must be one of these keys.
- `isr`: ≥ 60 first and ≥ 80 last names, mixing common Israeli Jewish names with some Israeli Arab and Druze names.
- Other pools: ≥ 30 first and ≥ 40 last names (`generic` ≥ 20/30).
- `NICKNAMES` ≥ 30 (e.g. 'הקוסם', 'הטיל', 'ג׳וני', 'הפנתר', 'הילד').
- `FRIEND_NAMES` ≥ 20 Israeli neighbourhood nicknames ('שמוליק', 'אבי הג׳ינג׳י', 'מוטי', 'ג׳ו', 'דודו').
- `PARTNER_NAMES` ≥ 15. `AGENT_NAMES` ≥ 10 (e.g. 'שוקי "המכה" לוי'). `JOURNALIST_NAMES` ≥ 10.
- **No real current footballers**, including famous retired ones. Combinations are generated at random, so pools must be common names only.

---

## 4. Content schemas (Content agent)

### 4.1 `events.js`: narrative events

```ts
EventDef = {
  id: string,                     // unique snake_case, e.g. 'mom_cooking_after_loss'
  who: PersonaId,                 // sender persona (§4.3 PERSONAS)
  trigger: TriggerId|null,        // null = random weekly pool; otherwise only eligible in a week the trigger fired
  weight: number,                 // default 1 (relative pick weight among eligible)
  cooldown: number,               // weeks before it may fire again (default 26)
  once: boolean,                  // at most once per career (default false)
  cond: Cond,                     // all keys optional; ALL must hold
  messages: (string | { who: SpeakerId, t: string })[],   // 1..4 bubbles; objects allow group chats (friends) with several speakers
  choices: Choice[],              // 0..3. 0 = info message
  defaultChoice: number           // index auto-applied when unanswered after 2 weeks (default 0)
}
Choice = { label: string /*<= 40 chars*/, reply: string /*my message bubble*/, effects: Effects, followUp: string|null /*sender's answer*/ }
Cond = {
  minAge, maxAge, minOvr, maxOvr, minRepW,                 // numbers
  stage: Stage[], role: RoleId[], natLvl: string[], nation: CountryId[], leagueTier: 1|2,
  phase: 'season'|'summer', weeks: [from, to],             // inclusive week range
  inWindow: boolean, hasClub: boolean, abroad: boolean,    // abroad = club's country !== player.nation
  injured: boolean, minMoney: number,
  flags: string[], notFlags: string[],                     // ev.flags present / absent
  lastResult: 'W'|'D'|'L', lastRatingMin, lastRatingMax,   // player's last match
  formMin, formMax,                                        // average of form[]
  benchMin: number,                                        // player.bench >= n
  derbyWeek: boolean,                                      // a fixture this week vs club.rival
  chance: number                                           // 0..1 extra probability filter
}
Effects = {                       // all optional; deltas are clamped to valid ranges by the engine
  morale, energy, trust, fans, mates,     // ±int
  repL, repC, repW,                       // ±number
  money,                                  // ±€ (choice disabled if money < 0 and bank < |money|)
  form,                                   // pushes a pseudo-rating into form[] (e.g. 7.5)
  injuryWeeks,                            // minor injury of n weeks
  attr: { [AttrKey]: number },            // e.g. { phy: 1 }
  pot,                                    // ±int hidden potential
  setFlags: string[], clearFlags: string[],
  treq: boolean,                          // set transfer request
  agentPush: number,                      // weeks of boosted offers
  next: string                            // EventDef id to queue for next week (ignores cond/cooldown)
}
```
**Triggers raised by the engine (`TriggerId`)**. Content must provide ≥ 1 event (preferably 2+) for each one:
`season_start` (week 1), `summer_start` (week 45), `window_open`, `debut` (first senior app), `first_goal` (first senior goal), `hat_trick`, `great_match` (rating ≥ 8.5), `bad_match` (rating ≤ 5.5), `motm`, `loss_streak` (3 club losses), `win_streak` (5 wins), `benched` (bench ≥ 3), `injury`, `long_injury` (≥ 6 weeks), `injury_return`, `derby_week`, `big_match` (cup final / UCL KO / national tournament KO this week), `offer_received`, `transfer_done`, `loan_start`, `moved_abroad`, `homesick` (abroad, first 20 weeks, random), `contract_expiring` (last season, week 22), `renewal_offer`, `pro_contract`, `released`, `youth_callup`, `national_callup` (first senior), `national_debut`, `tournament_start`, `tournament_won`, `tournament_out`, `trophy`, `promoted`, `relegated`, `ballon_dor_night`, `golden_boy`, `top_scorer`, `birthday` (week 30), `big_purchase`, `money_low`, `age_30`, `retire_soon` (age ≥ 33, week 1), `retired`.

Engine-reserved flags that content may read: `has_partner` (set via an event), `abroad`, `captain`, `fan_favourite`, `bad_boy`, `charity`, `married`, `kids`. Content may invent other flags freely (snake_case).

Content volume: **≥ 160 events**.
- All personas must be used.
- About 60% are random-pool events and 40% are trigger events.
- Tone: warm Israeli neighbourhood humour. Mom feeding you, Dad in the stands with a thermos, the group chat "החבר׳ה מהשכונה" roasting you, the agent who always "has something big", journalists, sponsors, a partner, social media, nightlife temptation, charity, homesickness abroad, derby week, national pride, contract gossip, Ballon d'Or night, retirement.

**Placeholders** allowed in `messages`, `label`, `reply`, and `followUp` (the engine fills them; unknown placeholders are left as-is):
`{first} {last} {nick} {name} {club} {clubShort} {city} {league} {coach} {agent} {journalist} {partner} {friend1} {friend2} {friend3} {opp} {rival} {nation} {age} {money} {wage} {value} {season} {teammate} {captain} {goals} {apps} {rating}`.

Exact values and fallbacks (the engine MUST always produce a non-empty string, so Content never sees a raw `{x}` in the UI):

| placeholder | value | fallback |
|---|---|---|
| `{first}` `{last}` | player names | – |
| `{nick}` | nickname | `{first}` |
| `{name}` | `first + ' ' + last` | – |
| `{club}` `{clubShort}` `{city}` | current club `nameHe` / `shortHe` / `city` | 'הקבוצה' / 'הקבוצה' / 'העיר' when free or retired |
| `{league}` | current league `nameHe` (youth: youth league name) | 'הליגה' |
| `{coach}` | `names.coach[club]` (lazily generated from the club country's pool) | 'המאמן' |
| `{agent}` `{journalist}` | `names.agent` / `names.journalist` | – |
| `{partner}` | `names.partner` | 'בת הזוג' |
| `{friend1..3}` | `names.friends[0..2]` | – |
| `{opp}` | opponent of this week's (else next, else last) club fixture | 'היריבה' |
| `{rival}` | `club.rival` nameHe; if null, the strongest other club of his league | 'היריבה העירונית' |
| `{nation}` | player's country `nameHe` | – |
| `{age}` | age this season | – |
| `{money}` `{wage}` `{value}` | `fmtMoney(bank)`, `fmtMoney(contract.wage)` + ' לשבוע', `fmtMoney(value)` | wage: 'אין חוזה' |
| `{season}` | `fmtSeason(season)` | – |
| `{teammate}` `{captain}` | generated names, `rngFor(clubId, season, 'mate', k)` / `rngFor(clubId, season, 'cap')`, club country's pool | 'חבר לקבוצה' / 'הקפטן' |
| `{goals}` `{apps}` | season totals over all competitions | '0' |
| `{rating}` | last match rating (1 decimal) | '-' |

Speakers: in `messages`, an object's `who` may be any `SpeakerId` (§2.3), so a group chat can be written as `{ who:'friend1', t:'...' }`; `ThreadVM.messages[].whoHe` shows the friend's name.

### 4.2 `commentary.js`: match text

Moment types and option keys are **fixed by this spec** (mechanics in §5.5). Content provides text for every type and every option.

```ts
MOMENT_TEXT = { [MomentType]: { setup: string[] /*>= 4 lines*/, options: { [optionKey]: string /*button label <= 28 chars*/ } } }
RESULT_TEXT = { [ResultCode]: string[] }                    // >= 5 generic lines each
RESULT_TEXT_BY_TYPE = { [MomentType]: { [ResultCode]?: string[] } }   // optional specific lines (>= 2 when present); preferred over RESULT_TEXT
MATCH_TEXT = {
  intro: { default: string[], derby: string[], final: string[], europe: string[], national: string[], youth: string[], debut: string[] },
  goal_for: string[], goal_against: string[],                // background goals
  half_time: string[], sub_on: string[], sub_off: string[],
  full_time: { W: string[], D: string[], L: string[] },
  extra_time: string[], pens_win: string[], pens_loss: string[],
  bench_unused: string[], not_selected: string[]
}
```
Commentary placeholders: `{player}` (nick or last name), `{first}`, `{last}`, `{team}`, `{opp}`, `{teammate}`, `{gk}` (opponent keeper), `{minute}`, `{score}` ('2-1', always home-away), `{comp}`.
`{team}`/`{opp}` are `shortHe` of the player's side and the opponent. `{teammate}` and `{gk}` are generated names (`rngFor(teamId, season, 'mate'|'gk', k)`, pool of the team's country). They are filled at moment creation and stored rendered in `LiveMatch`.

**MomentType → option keys** (exact):

| type | side | options |
|---|---|---|
| `one_on_one` | att | `placed`, `power`, `round_gk` |
| `header` | att | `power_header`, `placed_header`, `knock_down` |
| `long_shot` | att | `curl`, `drive`, `keep_ball` |
| `through_ball` | att | `killer_pass`, `one_two`, `safe_pass` |
| `dribble` | att | `take_on_shoot`, `take_on_cross`, `recycle` |
| `cross` | att | `whipped_cross`, `cutback`, `shoot_near` |
| `free_kick` | att | `over_wall`, `power_fk`, `to_box` |
| `penalty` | att | `low_corner`, `top_corner`, `panenka` |
| `counter` | att | `sprint_shoot`, `pass_wide`, `slow_down` |
| `late_run` | att | `arrive_shot`, `hold_position` |
| `build_up` | att | `line_break`, `long_ball`, `safe_side` |
| `tackle` | def | `slide`, `stand`, `jockey` |
| `aerial` | def | `attack_ball`, `body_position` |
| `interception` | def | `step_in`, `hold_line` |
| `last_man` | def | `slide_last`, `track_back`, `foul_tactical` |
| `press` | def | `press_high`, `hold_shape` |
| `gk_one_on_one` | gk | `stay_big`, `rush_out`, `spread` |
| `gk_shot` | gk | `dive_catch`, `parry` |
| `gk_cross` | gk | `claim`, `punch`, `stay_line` |
| `gk_penalty` | gk | `dive_left`, `dive_right`, `stay_center` |
| `gk_distribution` | gk | `short_build`, `long_kick` |

**ResultCode** (exact): `GOAL`, `ASSIST`, `CHANCE`, `MISS`, `LOST`, `WON`, `BEATEN`, `CONCEDED`, `SAVE`, `GK_CONCEDED`, `CARD`.

### 4.3 `strings.js`: shared labels (exact export names and keys)

```js
export const POSITIONS = { GK:{he:'שוער',short:'שוער',group:'GK',desc:'...'}, CB:{he:'בלם',short:'בלם',group:'DEF'}, LB:{he:'מגן שמאלי',short:'מגן',group:'DEF'},
  RB:{he:'מגן ימני',short:'מגן',group:'DEF'}, CDM:{he:'קשר אחורי',short:'קשר',group:'MID'}, CM:{he:'קשר מרכזי',short:'קשר',group:'MID'},
  CAM:{he:'קשר התקפי',short:'10',group:'MID'}, LW:{he:'כנף שמאל',short:'כנף',group:'ATT'}, RW:{he:'כנף ימין',short:'כנף',group:'ATT'}, ST:{he:'חלוץ',short:'חלוץ',group:'ATT'} };  // each with desc (one line)
export const ATTRS = { pac:{he:'מהירות',short:'מהי'}, sho:{he:'בעיטה',short:'בעי'}, pas:{he:'מסירה',short:'מסי'}, dri:{he:'כדרור',short:'כדר'},
  def:{he:'הגנה',short:'הגנ'}, phy:{he:'פיזיות',short:'פיז'}, div:{he:'צלילה',short:'צלי'}, han:{he:'תפיסה',short:'תפי'}, ref:{he:'רפלקסים',short:'רפל'},
  gkp:{he:'מיקום',short:'מיק'}, kic:{he:'בעיטות',short:'בעט'} };
export const TRAINING = { balanced:{he:'אימון מאוזן',desc}, shooting:{he:'בעיטות לשער',desc}, technique:{he:'טכניקה ומסירות',desc},
  defense:{he:'הגנה ותיקולים',desc}, physical:{he:'כושר ומהירות',desc}, goalkeeping:{he:'אימון שוערים',desc}, rest:{he:'מנוחה והתאוששות',desc} };
export const ROLES = { star:'כוכב הקבוצה', key:'שחקן מפתח', rotation:'רוטציה', squad:'שחקן סגל', prospect:'כישרון צעיר' };
export const ODDS = { low:'נמוך', mid:'בינוני', high:'גבוה' };
export const STAGES = { youth:'נוער', pro:'מקצוען', free:'שחקן חופשי', retired:'פרש' };
export const SELECTION = { starter:'בהרכב', bench:'על הספסל', out:'מחוץ לסגל', injured:'פצוע', suspended:'מורחק', youth:'קבוצת הנוער', national:'בנבחרת' };
export const COMP_TYPES = { league:'ליגה', cup:'גביע', europe:'אירופה', national:'נבחרת', youth:'נוער', ynt:'נבחרת נוער', friendly:'ידידות' };
export const EURO_COMPS = { ucl:{he:'ליגת האלופות',short:'האלופות'}, uel:{he:'הליגה האירופית',short:'האירופית'}, uecl:{he:'הקונפרנס ליג',short:'הקונפרנס'} };
export const ROUND_NAMES = { q:'סיבוב מוקדם', lp:'שלב הליגה', kpo:'פלייאוף', r128:'סיבוב ראשון', r64:'סיבוב 64', r32:'סיבוב 32', r16:'שמינית הגמר',
  qf:'רבע הגמר', sf:'חצי הגמר', f:'הגמר', grp:'שלב הבתים', md:'מחזור', q_md:'מוקדמות', fr:'ידידות' };
export const TOURNAMENTS = { wc:'המונדיאל', euro:'היורו', copa:'קופה אמריקה', afcon:'אליפות אפריקה', asian:'גביע אסיה', gold:'גביע הזהב',
  u17:'אליפות עד גיל 17', u19:'אליפות עד גיל 19', u21:'אליפות עד גיל 21', qual:'מוקדמות', friendly:'משחק ידידות' };
export const AWARDS = { top_scorer:'מלך השערים', pots:'שחקן העונה', tots:'נבחרת העונה', young_pots:'השחקן הצעיר של העונה',
  ucl_top_scorer:'מלך שערי ליגת האלופות', golden_boy:'פרס הגולדן בוי', ballon_dor:'כדור הזהב', bdo_top3:'פודיום כדור הזהב',
  bdo_top10:'טופ 10 בכדור הזהב', golden_boot_tour:'מלך שערי הטורניר', motm_final:'שחקן הגמר' };
export const TROPHIES = { league:'אליפות', league2:'עלייה ליגה', cup:'גביע', ucl:'ליגת האלופות', uel:'הליגה האירופית', uecl:'הקונפרנס ליג',
  wc:'גביע העולם', euro:'אליפות אירופה', copa:'קופה אמריקה', afcon:'אליפות אפריקה', asian:'גביע אסיה', gold:'גביע הזהב',
  u17:'אליפות עד 17', u19:'אליפות עד 19', u21:'אליפות עד 21', youth_league:'אליפות נוער' };
export const INJURIES = { minor:[{id:'knock',he:'מכה'},...], medium:[{id:'hamstring',he:'מתיחה בירך האחורית'},...], major:[{id:'acl',he:'קרע ברצועה הצולבת'},...] };  // >= 4 each
export const PERSONAS = { mom:{he:'אמא',avatar:'👩‍🍳'}, dad:{he:'אבא',avatar:'👨'}, friends:{he:'החבר׳ה מהשכונה',avatar:'⚽',group:true},
  agent:{he:'הסוכן',avatar:'🕴️'}, coach:{he:'המאמן',avatar:'📋'}, journalist:{he:'עיתונאי',avatar:'🎙️'}, sponsor:{he:'ספונסר',avatar:'💼'},
  partner:{he:'בת הזוג',avatar:'❤️'}, social:{he:'רשתות חברתיות',avatar:'📱'}, captain:{he:'הקפטן',avatar:'©️'}, fan:{he:'אוהד',avatar:'📣'},
  brother:{he:'אח קטן',avatar:'🧒'}, grandma:{he:'סבתא',avatar:'👵'}, national_coach:{he:'מאמן הנבחרת',avatar:'🏳️'}, owner:{he:'בעלי המועדון',avatar:'🎩'},
  doctor:{he:'הרופא',avatar:'🩺'}, club:{he:'המועדון',avatar:'🏟️'}, system:{he:'הילד מהשכונה',avatar:'⭐'} };
export const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
export const LEGACY_TIERS = [ {min:0,he:'שחקן ליגה'}, {min:60,he:'שחקן מוערך'}, {min:160,he:'כוכב'}, {min:320,he:'אגדה'}, {min:550,he:'אגדה של כל הזמנים'} ];
export const SHOP_ITEMS = [ { id, cat:'car'|'home'|'family'|'style', he, price, upkeep /*€/week*/, morale /*+int*/, minAge? } ];   // >= 12 items, see §5.15
export const RESULT_LABELS = { W:'ניצחון', D:'תיקו', L:'הפסד' };
export const ALERTS = { contract_expiring:'החוזה שלך מסתיים בסוף העונה', injured:'אתה פצוע', callup:'זומנת לנבחרת!', window_open:'חלון ההעברות פתוח',
  offer:'יש לך הצעה חדשה', energy_low:'האנרגיה נמוכה. כדאי לנוח', suspended:'אתה מורחק למשחק הבא', free_agent:'אתה שחקן חופשי. בדוק הצעות', season_review:'סיכום העונה מחכה לך', info:'' };
export const FORMAT_LABELS = { double_rr:'ליגה כפולה', double_rr_split:'ליגה + פלייאוף', triple_rr_split:'ליגה משולשת + פיצול' };
```
The Hebrew values above are binding where given. Content may polish wording but **must keep every key**.

---

## 5. Engine design (Engine agent)

The numbers below are the **starting values**. The Engine agent may tune them to hit the calibration targets in §5.19. The agent must not change ids, keys, the week tables, or facade shapes.

### 5.1 Calendar

A season has 52 weeks. Weeks 1-44 are the football season (week 1 is the first week of August); weeks 45-52 are the summer. Every week has two slots, processed in order: `'mw'` (midweek) first, then `'wk'` (weekend).

```js
SEASON_WEEKS = 44; SUMMER_START = 45; WEEKS = 52;
INTL_WEEKS      = [6, 11, 16, 33];                 // national breaks: no club football. Match A in 'mw', match B in 'wk'
LEAGUE_WK_WEEKS = weeks 1..42 minus INTL_WEEKS     // 38 weekends
LEAGUE_MW_WEEKS = [2, 8, 12, 17, 19, 22, 24, 26];  // overflow midweek league rounds (only for leagues with R > 38)
EURO_WEEKS = { q: [3, 4], lp: [7, 9, 13, 15, 18, 20, 23, 25], kpo: [28, 29], r16: [31, 34], qf: [36, 37], sf: [39, 40], f: 44 };  // all 'mw' except UCL final 'wk'
CUP_WEEKS  = [5, 10, 14, 21, 27, 35, 41];          // 'mw'; domestic cup final is week 43 'wk'
WINDOW_SUMMER = weeks 45..52 and 1..4 (next season); WINDOW_WINTER = weeks 22..26;
MONTH_OF_WEEK: 1-4 Aug(7), 5-8 Sep(8), 9-13 Oct(9), 14-17 Nov(10), 18-21 Dec(11), 22-26 Jan(0), 27-30 Feb(1), 31-34 Mar(2), 35-38 Apr(3), 39-43 May(4), 44-47 Jun(5), 48-52 Jul(6)   // index into MONTHS
```
These tables have no overlaps: INTL, EURO, CUP, and LEAGUE_MW are pairwise disjoint.

**League round to slot mapping** (`leagueRoundSlots(R)`):
- If `R ≤ 38`: round `i` (0-based) is played on weekend `LEAGUE_WK_WEEKS[floor(i*38/R)]`.
- If `R > 38`: build a list of slots from all 38 weekends plus `E = R−38` midweeks taken evenly from LEAGUE_MW_WEEKS (index `floor((j+0.5)*8/E)`). Sort the list chronologically (in the same week, mw comes before wk) and assign rounds in order.
- Examples: eng2 has R=46 (38 weekends + 8 midweeks); bel1 has R=40.
- Split leagues: R counts the base phase plus the longest split group. Groups with fewer rounds idle in the last slots.
  - Split-phase fixtures are generated when the base phase ends, with `rngFor(season, leagueId, 'split', g)` over the group's clubs sorted by id; `rr: 1` with an even group size gives `size−1` rounds, `rr: 2` gives `2*(size−1)`.
  - **Final ranking** of a split league: group 1 occupies ranks `from..to` of group 1, group 2 the next ranks, and so on; within a group, order by pts, GD, GF, W, id. A club can never finish outside its group's rank range. Promotion, relegation, European slots, and awards all use this final ranking.
  - Belgium (`halve: true`): at the split, each club's points become `ceil(pts/2)`; W/D/L/GF/GA are kept.
- The youth league uses the same mapping for its own R.
- **Player slot collisions:** a youth player who is in a first-team squad for a slot skips the youth fixture of that same slot (weekend or midweek).

**Week label:** `weekLabelHe(season, week)` → `'שבוע 12 · אוקטובר · 2026/27'`. In the summer → `'קיץ 2027 · שבוע 3'`.

**Summer tournaments:** `summerTournaments(year = season+1)`. If `year%4==2`, return `['wc']`. If `year%4==0`, return `['euro','copa','afcon','asian','gold']`. Otherwise return `[]`. Youth tournaments for the player's level run every summer (u21 only in odd years).

**Tournament slots** (`tournamentSlots(fmt)`):

| fmt | Schedule |
|---|---|
| `g48` | MD1 45mw, MD2 45wk, MD3 46mw, R32 46wk, R16 47mw, QF 47wk, SF 48mw, F 48wk |
| `g24` | MD1 45mw, MD2 45wk, MD3 46mw, R16 46wk, QF 47mw, SF 47wk, F 48wk |
| `g16` | MD1 45mw, MD2 45wk, MD3 46mw, QF 46wk, SF 47mw, F 47wk |
| `g8` (youth) | MD1 45mw, MD2 45wk, MD3 46mw, SF 46wk, F 47wk |

If the player is called up for both a senior and a youth tournament, the senior one wins.

**One tournament per nation per summer.** In a year with several continental tournaments, a nation plays at most one of them. Copa América guests are the 6 strongest CONCACAF nations **excluding the player's nation** (a CONCACAF player always plays the Gold Cup), and guests are simulated in the Copa only (the Gold Cup field is built from the remaining CONCACAF nations; use g8 if fewer than 16 remain).

### 5.2 Week processing (`advanceWeek` / `resumeWeek`)

1. **Preconditions.** No live match, `pending.review === null`, not retired, and `inWeek === false`. Otherwise return `{ ok:false, error:'busy'|'review_pending'|'retired' }` (`'busy'` = live match exists or `inWeek` is true: the UI must call `resumeWeek()` / go to `#/match`).
2. **Week start.** Set `inWeek = true`, `wstep = 0`, `training = arg ?? training` (an invalid id, such as `goalkeeping` for an outfield player, falls back to `balanced`), `ev.trig = []`, and `wsum = { ovrBefore: ovr, results: [], ... }`.
   - Energy: +20, plus +15 if training is `rest`.
   - Injury countdown (`injury_return` trigger at 0).
   - Raise calendar triggers: `season_start` (w1), `summer_start` (w45), `window_open` (w45, w22), `birthday` (w30), `retire_soon`, `derby_week`.
   - National call-ups for an INTL week or tournament start (w45).
   - Offer generation (§5.13).
3. **Slot `mw`, then slot `wk`.** Collect every fixture of every competition in that slot. Compute the player's fixture, if any, using the selection rules (§5.7).
   - If he is a `starter`, or `bench` and comes on: create `state.live` (phase `'pre'`) and **return `{ status:'match' }`**. The other fixtures of that slot are simulated when `resumeWeek()` runs after `finishMatch()`.
   - Otherwise simulate everything (team model) and record "not selected" / "unused bench" in the week summary.
4. **Week end.**
   - Development tick (§5.11) and training energy cost.
   - Morale, trust, and reputation drift. Wage in, upkeep out.
   - `mins[]` push, `bench` and `freeWeeks` counters, offer expiry, auto-answer of expired inbox items.
   - Narrative events (§5.16).
   - Special weeks:
     - **End of week 44:** season end (§5.3a).
     - **End of week 52:** rollover (§5.3b).
   - Then `week++` (or week 1 of the next season), `inWeek = false`, build the `WeekSummaryVM` from `wsum`, and set `wsum = null`.
   - **Return `{ status:'done', summary }`.**

`resumeWeek()` continues from `wstep`. If no live match exists and `inWeek` is true (for example after a reload in the middle of a week), it simply continues. If `inWeek` is false it returns `{ ok:false, error:'no_week' }`. If a live match exists it returns `{ ok:false, error:'busy' }`. Every partial result of the week (the player's match rows, highlights, injury, call-up) is appended to the persisted `wsum`, so the summary is complete even after a reload.

### 5.3 Season end and rollover

**(a) End of week 44**
1. League awards and trophies (§5.12).
2. Next season's European entrants (`comp.next`).
3. Champions archive.
4. Loans end: return to the parent club.
5. Youth pro-contract or release decisions (§5.10).
6. Contract expiry: if `contract.until === season`, there is no `next`, and no renewal was accepted, the player becomes `free`. If `next` exists, the move happens at week 45. (Youth contracts are excluded; see §5.10.)
7. Build the `SeasonReviewVM` and set `pending.review = season`. If age ≥ 33, set `pending.retire = 'offer'`.
8. Emit signal `season_completed`.

**(b) End of week 52**
1. Ballon d'Or and Golden Boy (§5.12), with a `ballon_dor_night` trigger next week.
2. Archive `hist.seasons` (stats include the summer tournament).
3. Star evolution.
4. Promotion and relegation: the bottom `count` clubs of tier 1 swap with the top `count` of tier 2 (update `world.clubs[id].lg`).
5. Club evolution (§5.4).
6. National strength drift.
7. Reputation decay (`rep *= 0.85` for l and c, `0.9` for w).
8. Potential drift (age ≤ 23).
9. Forced retirement check (§5.17).
10. Build the new season: league tables, youth league (if stage is youth, **or** stage is pro and age ≤ 18; see §5.10), cups, Europe, national qualifiers or friendlies, and rival scorer benchmarks.
11. Reset `player.s`, `yc`, and `susp`.

**First season (career start).** European entrants come from a pseudo-table that sorts each league by `strength + normal(0,3)` (using `rngFor(startSeason,'euro0')`). Cup-winner slots go to a random club from the pseudo-table ranks 2-6, and there are no holders.

### 5.4 Team match model (all non-key-moment matches)

```
λ_home = 1.30 * exp( 0.035*(sH - sA) + HFA ),  λ_away = 1.30 * exp( 0.035*(sA - sH) - HFA )
HFA = 0.12 (0 on neutral venue: cup finals, European finals, tournaments); clamp λ to [0.15, 4.5]
goals ~ Poisson(λ)
```
- **Extra time** (knockouts that are level, or a second leg level on aggregate): λ×(30/90) each side.
- **Penalties:** 5 kicks each with p=0.76, then sudden death.
- **Effective strength of the player's team** in a match where he plays: `s + (ovr - s) * 0.10 * (minutes/90)`.

**Strength sources:**
- Clubs: `world.clubs[id].s`.
- Youth teams: `round(0.5*s + (u17 ? 18 : 23)) + noise[-3..3]` from `rngFor(clubId, season, 'yth')`.
- Nations: `nt.str[id]`.
- Youth nations: `str - 22` (u17), `str - 16` (u19), `str - 10` (u21).

**Club evolution at rollover:**
```
expRank = rank by strength in league; perf = clamp((expRank - finalRank) / N * 6, -3, 3)
s' = s + 0.25*(base - s) + 0.5*perf + normal(0, 1.0) + (in UCL lp ? 0.5 : 0)
promoted: -1.0, relegated: +0.5, clamp 35..92;  b' = b * (1 + perf*0.03), r' = r + perf*0.5
```

### 5.5 Key moments (player matches)

**Count:**
- Starter: `3 + rng.int(0,2)`, +1 if `fx.big`, +1 if `ovr ≥ teamStr + 8`. Clamp to 3..7.
- Bench who comes on at minute `on ∈ [55,80]`: 2 moments if `on ≤ 65`, else 1. Plus one more with probability 0.4.
- Minutes are distinct and sorted, within `[max(on,1)+2, off]`.
- `fx.big` is true for: derby, cup SF/F, any European KO, UCL lp vs a team with s ≥ 85, national tournament matches, and qualifiers vs a stronger nation.

**Type selection** uses position weights (`POSITION_MOMENTS`). Replace an attacking moment with `penalty` with probability 0.06 (and `gk_penalty` for GK, 0.06 per GK moment). Outfield players must get ≥ 1 attacking moment; CB/FB/CDM must get ≥ 1 defensive moment.

| pos | weights |
|---|---|
| ST | one_on_one 3, header 2, counter 2, dribble 1, long_shot 1, press 1.5, free_kick 0.3 |
| LW/RW | dribble 3, cross 2, counter 2, one_on_one 1.5, long_shot 1, free_kick 0.5, tackle 0.6, press 0.6 |
| CAM | through_ball 3, long_shot 2, dribble 1.5, one_on_one 1, free_kick 1, press 0.6 |
| CM | through_ball 2, long_shot 1.5, late_run 1.5, tackle 1.5, interception 1, press 1, build_up 1 |
| CDM | interception 2.5, tackle 2.5, build_up 2, aerial 1, press 1, long_shot 0.7 |
| CB | aerial 2.5, tackle 2, interception 1.5, last_man 1.5, build_up 1, header 1 (set piece) |
| LB/RB | tackle 2, cross 2, interception 1, late_run 1, counter 1, last_man 0.7, aerial 0.5 |
| GK | gk_shot 3, gk_one_on_one 2, gk_cross 1.5, gk_distribution 1 |

**Odds** (shown as a band, and never as a number in the UI):
```
skill = Σ w_a * attr_a                              // option attribute weights below
oppQ  = opponent effective strength
p = clamp( base + (skill - oppQ)*0.011 + (formAvg-6.6)*0.03 + (morale-50)*0.0012
           + (energy<40 ? -0.05 : 0) + (home ? 0.02 : 0) + (big ? -0.02 : 0), 0.05, 0.95 )
band: p < 0.35 → 'low' (נמוך), p < 0.60 → 'mid' (בינוני), else 'high' (גבוה)
```
**Resolution:** `rng.next() < p` gives the `ok` code. Otherwise pick from the weighted `fail` list.

**Score effects:**
- `GOAL`: own team +1, player goal.
- `ASSIST`: own team +1, assist (scorer = generated teammate).
- `CONCEDED`/`GK_CONCEDED`: opponent +1.
- `CARD`: `yc+1`; every 5th league yellow gives `susp = 1`.

**Option catalog** (`w` = attribute weights, `base`, `ok`, `fail` list, `bonus` = extra rating on success):

| type.option | w | base | ok | fail | bonus |
|---|---|---|---|---|---|
| one_on_one.placed | sho .6 dri .2 pas .2 | .38 | GOAL | MISS | 0 |
| one_on_one.power | sho .7 phy .3 | .34 | GOAL | MISS | .1 |
| one_on_one.round_gk | dri .7 pac .3 | .30 | GOAL | MISS .6, LOST .4 | .2 |
| header.power_header | phy .6 sho .4 | .26 | GOAL | MISS | 0 |
| header.placed_header | sho .7 phy .3 | .24 | GOAL | MISS | .1 |
| header.knock_down | pas .5 phy .5 | .62 | CHANCE | LOST | 0 |
| long_shot.curl | sho .7 dri .3 | .12 | GOAL | MISS | .3 |
| long_shot.drive | sho .6 phy .4 | .11 | GOAL | MISS | .3 |
| long_shot.keep_ball | pas .7 dri .3 | .72 | CHANCE | LOST | 0 |
| through_ball.killer_pass | pas .8 dri .2 | .30 | ASSIST | LOST | 0 |
| through_ball.one_two | pas .5 dri .5 | .20 | GOAL | LOST | .1 |
| through_ball.safe_pass | pas 1 | .80 | CHANCE | LOST | 0 |
| dribble.take_on_shoot | dri .5 sho .5 | .18 | GOAL | LOST | .2 |
| dribble.take_on_cross | dri .5 pas .5 | .26 | ASSIST | LOST | 0 |
| dribble.recycle | pas 1 | .80 | CHANCE | LOST | 0 |
| cross.whipped_cross | pas .8 pac .2 | .24 | ASSIST | LOST | 0 |
| cross.cutback | pas .6 dri .4 | .26 | ASSIST | LOST | 0 |
| cross.shoot_near | sho .8 dri .2 | .12 | GOAL | MISS | .2 |
| free_kick.over_wall | sho .8 dri .2 | .10 | GOAL | MISS | .3 |
| free_kick.power_fk | sho .6 phy .4 | .09 | GOAL | MISS | .3 |
| free_kick.to_box | pas 1 | .20 | ASSIST | MISS | 0 |
| penalty.low_corner | sho 1 | .76 | GOAL | MISS | 0 |
| penalty.top_corner | sho .8 phy .2 | .72 | GOAL | MISS | .1 |
| penalty.panenka | dri .5 sho .5 | .66 | GOAL | MISS | .3 (fans +2 / −3) |
| counter.sprint_shoot | pac .5 sho .5 | .20 | GOAL | MISS | .1 |
| counter.pass_wide | pas .7 pac .3 | .26 | ASSIST | LOST | 0 |
| counter.slow_down | pas .6 dri .4 | .80 | CHANCE | LOST | 0 |
| late_run.arrive_shot | sho .6 pac .2 phy .2 | .18 | GOAL | MISS | .1 |
| late_run.hold_position | def .5 pas .5 | .85 | CHANCE | LOST .8, CONCEDED .2 | 0 |
| build_up.line_break | pas .9 dri .1 | .55 | CHANCE | LOST .8, CONCEDED .2 | .1 |
| build_up.long_ball | pas .7 phy .3 | .14 | ASSIST | LOST | .1 |
| build_up.safe_side | pas 1 | .88 | CHANCE | LOST .7, CONCEDED .3 | −.05 |
| tackle.slide | def .7 phy .3 | .58 | WON | CARD .4, BEATEN .35, CONCEDED .25 | .1 |
| tackle.stand | def .8 pac .2 | .62 | WON | BEATEN .7, CONCEDED .3 | 0 |
| tackle.jockey | def .5 pac .5 | .70 | WON | BEATEN .75, CONCEDED .25 | −.1 |
| aerial.attack_ball | phy .6 def .4 | .60 | WON | BEATEN .6, CONCEDED .4 | .1 |
| aerial.body_position | def .7 phy .3 | .66 | WON | BEATEN .7, CONCEDED .3 | 0 |
| interception.step_in | def .6 pac .4 | .52 | WON | BEATEN .6, CONCEDED .4 | .2 |
| interception.hold_line | def .8 pas .2 | .68 | WON | BEATEN .75, CONCEDED .25 | 0 |
| last_man.slide_last | def .7 pac .3 | .50 | WON | CONCEDED .6, CARD .4 | .3 |
| last_man.track_back | pac .6 def .4 | .55 | WON | CONCEDED .7, BEATEN .3 | .1 |
| last_man.foul_tactical | def .5 phy .5 | .90 | CARD | CONCEDED | 0 (the ok CARD stops the attack) |
| press.press_high | pac .5 phy .3 def .2 | .40 | WON | BEATEN .85, CONCEDED .15 | .25 |
| press.hold_shape | def .7 pas .3 | .75 | WON | BEATEN .85, CONCEDED .15 | −.15 |
| gk_one_on_one.stay_big | ref .5 gkp .5 | .42 | SAVE | GK_CONCEDED | 0 |
| gk_one_on_one.rush_out | gkp .5 div .3 han .2 | .38 | SAVE | GK_CONCEDED | .1 |
| gk_one_on_one.spread | div .6 ref .4 | .40 | SAVE | GK_CONCEDED | 0 |
| gk_shot.dive_catch | div .5 han .5 | .60 | SAVE | GK_CONCEDED | .1 |
| gk_shot.parry | div .5 ref .5 | .66 | SAVE | GK_CONCEDED .7, BEATEN .3 | 0 |
| gk_cross.claim | han .6 gkp .4 | .66 | SAVE | BEATEN .6, GK_CONCEDED .4 | .1 |
| gk_cross.punch | gkp .5 phy .5 | .72 | WON | BEATEN .7, GK_CONCEDED .3 | 0 |
| gk_cross.stay_line | ref .6 gkp .4 | .60 | SAVE | GK_CONCEDED | 0 |
| gk_penalty.dive_left / dive_right | div .6 ref .4 | .24 | SAVE | GK_CONCEDED | .5 |
| gk_penalty.stay_center | ref .6 gkp .4 | .14 | SAVE | GK_CONCEDED | .8 |
| gk_distribution.short_build | kic .7 gkp .3 | .80 | CHANCE | LOST .7, GK_CONCEDED .3 | 0 |
| gk_distribution.long_kick | kic 1 | .55 | CHANCE | LOST | 0 |

For the odds formula, GK skill uses GK attributes vs `oppQ`. For `def` moments, `oppQ` is the opponent's strength. For `att` moments, it is the opponent's strength as well.

**Background goals.** At match creation, draw Poisson goals for each side from the team model, then reduce by the expected moment contribution so that totals stay realistic. Own side: `λ_for * (1 - 0.06*attMoments)`. Other side: `λ_against * (1 - 0.05*defMoments)`, floored at 0.1. Each goal gets a random minute in 1..90 and is logged with `MATCH_TEXT.goal_for/goal_against`. Moments resolve in minute order, interleaved with background goals.

**Auto play** picks, for each moment, the option maximising `p*value(ok) + (1-p)*E[value(fail)] + rng.float(0,0.05)`.

### 5.6 Match rating

```
rating = 6.0 + Σ moment deltas + result (W +0.3, D 0, L -0.3)
       + clean sheet (GK +0.5, CB/LB/RB +0.3, CDM +0.15; only if minutes ≥ 60)
       - GK: 0.2 per goal conceded beyond the first
       + normal(0, 0.2)
clamp [3.0, 10.0], round to 1 decimal.  MOTM if rating ≥ 8.0.
moment value(code) = GOAL +1.0, ASSIST +0.7, CHANCE +0.25, MISS -0.2, LOST -0.25, WON +0.35, BEATEN -0.3, CONCEDED -0.6, SAVE +0.5, GK_CONCEDED -0.5, CARD -0.3  (+ option bonus on ok)
```
A bench player who stays unused gets no rating and no app. A player who is not selected likewise has no rating.

### 5.7 Selection

For a club fixture of the player's club:
- If injured, return `'injured'`. If `susp > 0` and the fixture is a league match, return `'suspended'` (and `susp--`).
- Otherwise compute:
  ```
  score = (ovr - teamStr) + (trust-50)/8 + (formAvg-6.6)*2.5 + roleBonus + (energy<35 ? -6 : 0)
          + (comp is cup round before QF && ovr < teamStr ? +3 : 0) + normal(0, 1.5)
  roleBonus: star +5, key +3, rotation 0, squad -2, prospect -3
  ```
- Result: `score ≥ 0` → `'starter'`; `score ≥ -7` → `'bench'`; otherwise `'out'`.
- A bench player comes on with probability `clamp(0.55 + 0.05*score, 0.25, 0.9)` at minute `rng.int(55,80)`.
- A starter is subbed off at a minute in 60..85 if `energy < 45` (otherwise `off = 90`).
- Starts and minutes update `mins[]` and `bench` (reset on start).

National and youth selection rules are in §5.14. Youth league selection is in §5.10.

### 5.8 Europe (UCL / UEL / UECL)

1. **League slot notation.** `euro.ucl = {lp, q}` and so on. Tier-1 final ranks are allocated in this order: ucl.lp, ucl.q, uel.lp, uel.q, uecl.lp, uecl.q.
   - The cup winner gets the `euro.cup` slot (`uel_lp|uel_q|uecl_q`). If it already qualified via the league, the slot passes to the highest-ranked club not yet qualified.
   - Isr1 example (`ucl q1, uecl q2, cup uel_q`): champion → UCL qualifying; 2nd and 3rd → UECL qualifying; cup winner → UEL qualifying.
2. **Holders.** The UCL winner and the UEL winner get UCL lp. The UECL winner gets UEL lp. These are extra entries that do not consume league slots.
   - Allocation order: holders are placed first. A holder that also earned a league slot keeps only its best entry; the league slot it would have used passes to the next-ranked club of its league that has not qualified (same rule as the cup slot).
   - A holder that is a filler club simply takes one of the league-phase places reserved for fillers of that competition.
3. **Qualifying** (weeks 3 and 4, mw, two legs). Each playable `q` entrant meets the filler of that competition's tier (ucl→1, uel→2, uecl→3) closest in strength, with random choice among the 3 closest.
   - Winners (playable or filler) enter the league phase of that competition.
   - Playable losers drop: ucl q → uel lp, uel q → uecl lp, uecl q → out. Filler losers are out. A filler used in qualifying is not used again that season.
4. **League phase.** 36 teams: playable lp entrants plus fillers. Fillers are chosen by tier, then by strength + normal(0,3). If a tier is exhausted, use the adjacent tier. A club appears in at most one European competition per season.
   - Pots: 4 pots of 9 by strength.
   - **Draw:** for each pot pair (a ≤ b):
     - Same pot: put the 9 teams in a random cycle. Each team plays its next neighbour at home and its previous neighbour away.
     - Different pots: take a random permutation π. Team i of pot a hosts pot-b team π(i) and visits pot-b team π((i+1) mod 9).
     - Result: 8 matches per team, 4 home and 4 away, 2 vs each pot.
   - **Matchdays:** assign fixtures to MD 1..8 (`EURO_WEEKS.lp`) by greedy edge colouring with ≤ 200 random restarts. The player's club must have its 8 fixtures on 8 distinct MDs. Other clubs may rarely double up; this is not visible.
   - **Ranking:** pts, GD, GF, W, strength. 1-8 → R16, 9-24 → KPO, 25-36 eliminated.
5. **Knockouts** (two legs; the higher seed hosts leg 2; level on aggregate → ET + pens in leg 2):
   - KPO tie t=1..8: rank (8+t) vs rank (25−t).
   - R16 tie k=1..8: rank k vs the winner of KPO tie (9−k).
   - QF: (R16₁,R16₈), (R16₄,R16₅), (R16₂,R16₇), (R16₃,R16₆).
   - SF: (QF₁,QF₂), (QF₃,QF₄).
   - Final: week 44, neutral venue, single match.
6. **Non-UEFA leagues** (ksa1, usa1, bra1, arg1) have no continental club competition in v1.

### 5.9 Domestic cups

- Entrants: all clubs of the country's modelled leagues. N = entrants, B = the smallest power of 2 ≥ N, byes = B−N, given to the strongest clubs (tier 1 first, then by `s`).
- Rounds = log2(B). Round keys come from the teams remaining (r128 … f). Round 1 has `N − B/2` ties (the `2N − B` non-bye clubs); its winners plus the bye clubs make `B/2` clubs for round 2. If `N` is already a power of 2 there are no byes.
- Each round is drawn when the previous round completes (§2.4), pairing randomly with `rngFor(season, cupId, 'draw', rd)`.
- Schedule: the final is in week 43 `wk`. Earlier rounds use the last `rounds−1` entries of `CUP_WEEKS`.
- Single match. Home = the lower-tier club, or the weaker club if tiers are equal. Final at a neutral venue. Level → ET + pens.
- Example: England has N=44, B=64, 6 rounds.

### 5.10 Youth stage

- **Start.** Age 15, `stage = 'youth'`, `youth = 'u17'` (ages 15-16), then `'u19'` (ages 17-18). Academy = the chosen club. Youth wage: €150 + 5×club.s per week.
- **Youth league.** `id = '<academyLeagueId>_<lvl>'`, made up of all clubs of the academy's league (their youth sides). Name = `league.youthNameHe + ' עד גיל 17|19'`. Double round robin mapped to weekends.
- **Youth selection:** `score = ovr - ys + (formAvg-6.6)*2 + normal(0,1.5)`. `≥ -3` → starter, `≥ -9` → bench, otherwise out.
- **First-team call-up.** Requires age ≥ 16 and `ovr ≥ club.s - 12`. For each first-team league or cup fixture there is a probability `clamp(0.15 + (ovr-(club.s-12))*0.06, 0, 0.9)` of being in the squad. Then use normal selection, where a non-starter is on the bench. In such a slot he skips the youth fixture of that slot.
- **Market.** While `stage === 'youth'`, no transfer/loan offers are generated (§5.13 offer generation is skipped). Only `'pro'` offers from the academy exist.
- **Pro contract.**
  - Immediate `'pro'` offer after his 3rd first-team appearance (age ≥ 16). Terms as below, exp +4 weeks. If it lapses, it is offered again at the end of week 44.
  - At the end of week 44 with age ≥ 17: an offer if `ovr ≥ club.s-18 || (pot ≥ club.s-2 && ovr ≥ club.s-22)`. Terms: wage = `0.6*fairWage`, 3 years (`until` per §2.1), role prospect, exp +6 weeks.
  - Accepting sets stage pro, replaces the youth contract, and raises the `pro_contract` trigger and signal.
  - **Pro players aged ≤ 18** still play for the club's youth side: in a slot where he is `'out'` of the first-team squad (not injured or suspended), he plays the youth-league fixture of that slot if `comp.yl` exists.
- **Release.** Decided at the end of week 44 when age ≥ 18 and still youth:
  - If a pro offer is generated there (criteria above), he stays youth until it is answered. If it is rejected or expires, he is released at that moment.
  - Otherwise he is released immediately.
  - Release: `stage = 'free'`, `club = null`, `contract = null`, `released` trigger, plus free-agent fallback offers (§5.13).

### 5.11 Player model: OVR, development, aging, injuries, status

**OVR weights** (`ovr = round(Σ w*attr)`):

| pos | weights |
|---|---|
| ST | sho .40 pac .20 dri .15 phy .15 pas .10 |
| LW/RW | pac .30 dri .30 sho .20 pas .15 phy .05 |
| CAM | pas .35 dri .30 sho .20 pac .10 phy .05 |
| CM | pas .35 dri .20 def .15 phy .15 sho .10 pac .05 |
| CDM | def .35 pas .25 phy .25 pac .05 dri .05 sho .05 |
| CB | def .50 phy .30 pac .10 pas .10 |
| LB/RB | def .30 pac .30 pas .20 phy .10 dri .10 |
| GK | div .25 han .20 ref .25 gkp .20 kic .10 |

**Creation.**
- Target `t = rng.int(45,55)`.
- Attributes: weighted attributes get `t + 4 + normal(0,3)`, other outfield attributes `t - 10 + normal(0,4)`. GK attributes for outfield players are 8..20. Outfield attributes for a GK are `t - 18` (kic ≈ t).
- Shift so that `ovr == t`.
- `pot = clamp(round(t + 24 + normal(0,7)), t+10, 94)`.
- `potSeen` width: ±6 at age 15-16, ±4 at 17-18, ±3 at 19-21, ±1 from 22. The range is centred on `pot + rngFor(id,season,'scout').int(-2,2)` and recomputed each season.
- `potStars = clamp(round(((lo+hi)/2 - 50)/9 * 2)/2, 0.5, 5)`.

**Weekly growth** (weeks 1-44 only, none while injured):
```
G(age) per season: 15:5.5 16:5.5 17:5 18:4.5 19:4 20:3.5 21:3 22:2.5 23:2 24:1.2 25:0.8 26:0.4 27-29:0.2 30:0 31:-0.8 32:-1.5 33:-2.2 34:-3 35:-3.5 36:-4 37+:-4.5
if G > 0: mult = clamp((pot-ovr)/10, 0, 1.3) * minutesF * trainF * (0.9 + morale/500)
          minutesF = 0.55 + 0.45*min(1, Σmins / (8*90*0.8)) + clamp((formAvg-6.6)*0.15, -0.1, 0.15)
          trainF = rest 0, others 1.0 (specialised focus 1.05)
if G ≤ 0: mult = 1 (physical training → 0.85)
ΔOVR_week = G(age)/44 * mult
attribute split: share_a ∝ 0.65*posW_a + 0.35*focusW_a; scale k so Σ posW_a*Δa = ΔOVR; cap attr at min(99, pot+10)
focusW: balanced = posW, shooting {sho:1}, technique {pas:.5,dri:.5}, defense {def:.8,phy:.2}, physical {pac:.5,phy:.5},
        goalkeeping {div:.25,han:.25,ref:.25,gkp:.15,kic:.1} (outfield → balanced), rest none
decline split: pac ×1.6, phy ×1.3, others ×0.7 (normalised)
```
**Potential drift** at rollover (age ≤ 23): `pot += round(clamp((avgRating-6.8)*2, -2, 2))`, clamped to `[ovr, 96]`.

**Energy:**
- Weekly +20 (+15 more on rest).
- Match: −18×minutes/90.
- Training: balanced −5, specialised −7, rest 0.
- Clamp 0..100.

**Injuries:**
- Per match: `p = 0.010*(min/90)*(energy<40 ? 2 : 1)*(age>31 ? 1.3 : 1)*(1.2 - phy/250)`.
- Training: 0.002 per week (0 on rest).
- Severity: minor 70% (1-2 weeks), medium 25% (3-6), major 5% (8-30).
- While injured: morale −1 per week.

**Morale** (weekly drift):
- Target `T = 55 + min(25, Σ owned morale) - (bench≥3 ? 10 : 0) - (abroad && first season there ? 5 : 0)`.
- `morale += (T - morale)*0.15`.
- Per match: W +3, L −3, rating ≥ 8 +4, ≤ 5.5 −4.
- Trophy +15, injury −8, move to a bigger club +10.

**Trust:**
- Per selected club match: `+(rating-6.6)*4`. Not selected: −1.
- On a new club: 45 (60 if role star/key).
- Transfer request: −15.

**Fans:**
- Rating ≥ 7.5: +1.5. Each goal +1. Derby goal +4. Loss −0.5. Transfer request −10.

**Mates:** drifts toward 55 at 0.05 per week, plus event effects.

**Reputation:**
```
domestic match: Δl = (rating-6.3)*0.25*prestige/6 + goals*0.15
europe / national match: Δc = (rating-6.3)*0.4 + goals*0.2
Δw = (Δl*0.1 + Δc*0.4) * prestige/10   (national tournaments use prestige 9)
trophies: league +5 l +2 c (+prestige/10 w), ucl +8 c +6 w, uel +4 c +2 w, wc +10 w, continental +6 w, bdo top3 +8 w; clamp 0..100
```

**Value and wages:**
```
value = 50,000 * 10^((ovr-45)/12) * ageMult * (age ≤ 23 ? 1 + (pot-ovr)/40 : 1) * (0.85 + rep.c/300)
ageMult: ≤21 1.4, 22-25 1.2, 26-28 1.0, 29-30 0.75, 31-32 0.5, 33+ 0.3; round to 2 significant digits
fairWage(ovr, prestige) = 400 * 1.13^(ovr-40) * (0.4 + 0.09*prestige)   // € per week
wageCap(club) = club.b * 4000                                         // € per week
```
Money each week: `+contract.wage − Σ upkeep`. Money is never negative: if upkeep cannot be paid, morale drops by 2 and the `money_low` trigger is raised.

### 5.12 Awards, stars, Ballon d'Or

**At the end of week 44** (for the player's league, cup, and European competitions). "The player's league" is the league of his club at the end of week 44; league awards use his full `s.lg` line for the season (if he moved between leagues mid-season, all league matches count, a known simplification), compared with that league's benchmark:
- **Champion / cup / European trophies:** credited if the player's club at the time of the final (or the last league round) is the winner and he has ≥ 1 appearance in that competition this season. A promotion from tier 2 gives `league2`.
- **Rival benchmarks** are drawn at season build:
  - League top scorer: `round(R*0.5 + normal(0,3))` goals, with a fictional name from the league's pool and a top-4 club.
  - UCL top scorer: `9 + rng.int(0,5)`.
  - Tournament golden boot: `3 + rng.int(0,3)`.
  - The player wins if his goals are ≥ the benchmark.
- **`pots`** (player of the season): apps ≥ 20 and `avgR + goals*0.02 + (champion ? 0.15 : 0) ≥ 7.55 - (prestige ≤ 5 ? 0.15 : 0) + normal(0,0.1)`.
- **`tots`:** avgR ≥ 7.15 and apps ≥ 20.
- **`young_pots`:** age ≤ 21, avgR ≥ 7.0, apps ≥ 18.
- **`motm_final`:** rating ≥ 8.0 in a cup, European, or tournament final.

**Stars.**
- 40 fictional world stars created at career start: ages 18-33, ovr 82-91, pot ≥ ovr, at clubs with s ≥ 80, nations weighted by strength.
- At rollover:
  - Age and develop using G(age)×0.6.
  - Retire at age ≥ 35 with probability 0.5 (always at ≥ 37). A retired star is replaced by a new star aged 19-21 with ovr 78-83 and pot 88-94.
  - Move club with probability 0.12, to a club with s ≥ 80.

**Ballon d'Or** (end of week 52, for the completed season including the summer tournament):
```
S = (ovr-70)*1.4 + (avgR-6.8)*18 + goals*(ATT ? 0.45 : 0.7) + assists*0.3 + cs*(GK/DEF ? 0.35 : 0) + trophyPts + prestige*0.6
trophyPts: league 6*prestige/10, ucl 14, uel 5, uecl 2, cup 2, wc 16, euro/copa 12, other continental 8, ucl_top_scorer 3
```
- Star season lines are simulated:
  - `avgR = 6.9 + (ovr-84)*0.06 + normal(0,0.2)`.
  - Goals: `max(0, normal(ovr-60, 6))` × position factor (ST 1, W .7, CAM .55, CM .25, CDM/DEF .1, GK 0).
  - Trophies: league with probability by club rank, UCL with 0.12 if club s ≥ 85 (else 0.04).
- The player's line uses all of his club competitions plus national matches. He needs ≥ 15 apps to be eligible.
- Rank the top 30 nominees. Store `hist.bdo` (rank 0 if not nominated, plus the top 3). Award keys `ballon_dor` / `bdo_top3` / `bdo_top10`.
- **Golden Boy:** age ≤ 21. Candidates are the player plus 10 generated rivals (ovr 74-84), using the same S. Rank 1 wins.

### 5.13 Transfers, contracts, loans

**Offer generation.** Runs at the start of each week in a window (weeks 45-52, 1-4, 22-26), or **every week while free**. Never while `stage === 'youth'` (§5.10).

**When offers can be answered.** `respondOffer(..., 'accept')` that would move the player or change his contract is allowed only when `inWeek === false` and no live match exists; otherwise it returns `{ ok:false, error:'busy', status:null, offer, messageHe:'סיים קודם את השבוע' }`, and `OfferVM.canAccept` is false in that state. A loan cannot be accepted while `player.next` is set.
```
n ~ Poisson(λ), λ = clamp(0.25 + 0.15*max(0, ovr-teamStr)/5 + (agentPush>0 ? 0.4 : 0) + (treq ? 0.4 : 0) + (formAvg-6.8)*0.2, 0.05, 1.5)
candidates: all league clubs ≠ current with s ∈ [ovr-10, ovr+6] and wageCap ≥ 0.7*fairWage;
weight = (r/50) * (prestige/5) * (same country && age<20 ? 1.5 : 1) * (s > teamStr ? 1.3 : 0.8)
type:
  'free'        if player is free
  'precontract' if contract.until === season && week ≥ 22 (joins at week 45 via player.next)
  'loan'        if age ≤ 22 && (minutes share < 40% || role ∈ {squad, prospect}) && candidate.s < teamStr && rng 0.5
  'transfer'    otherwise (fee = value*U(0.85,1.25), must be ≤ candidate.b*1e6*0.5)
wage  = min(fairWage(ovr, prestige(candidate league)) * U(0.9, 1.2), wageCap)   (loan: same wage as current)
role  = by gap ovr - candidate.s: ≥ +5 star, ≥ 0 key, ≥ -5 rotation, ≥ -10 squad, else prospect
years = age ≤ 23 ? 4-5 : age ≤ 29 ? 3-4 : 1-2;  rc = (role ∈ {star,key} && prestige < 8) ? round(value*2.5) : 0
exp   = aw + 2
```
- Every new offer raises the `offer_received` trigger and an agent message ("{agent}: יש לי משהו גדול בשבילך...").
- **Fallback:** while free, guarantee ≥ 1 offer on the first free week and then every 3rd week. It comes from the club with the highest weight among clubs with `s ≤ ovr + 4`. If there is none, take the weakest club in the player's country's lowest modelled tier, else the weakest club anywhere.

**Respond.**
- **accept:**
  - `transfer` / `loan`: the selling club accepts if `fee ≥ rc > 0`. Otherwise with probability `clamp((fee/value - 0.8)*2.5 + (treq ? 0.3 : 0) - (role==='star' ? 0.2 : 0), 0, 1)`. If refused → status `club_refused`.
  - On success: an immediate move (club, contract, `hist.clubs`, trust reset, signal `transfer`, triggers `transfer_done` / `loan_start` / `moved_abroad`). The fee is not paid to the player. A signing bonus of 4 weeks' wage is.
  - `precontract`: sets `player.next` (response status `'accepted'`: agreed, the move happens at week 45).
  - `renewal`: extends the contract (status `'signed'`).
  - `pro`: first pro contract (status `'signed'`).
  - Immediate moves (`transfer`, `loan`, `free`) return status `'signed'`. When a move happens, every other open offer becomes `withdrawn`, and the old spell in `hist.clubs` is closed (`to = season`).
- **reject:** status `rejected`.
- **negotiate** with `counter = { wageMul: 1.1|1.2|1.35, years: 1..5, role: RoleId, rc: 'none'|'low'|'default' }`:
  ```
  P(accept) = clamp(1 - 2.2*max(0, wageMul-1) - 0.25*roleSteps(counter.role above offer.role) - 0.05*|years-offer.years| - (rc==='none' ? 0.15 : rc==='low' ? 0.08 : 0), 0.05, 1)
  ```
  - Accepted → the offer is updated to the counter (status stays `open`, and the response is `countered_accepted`).
  - Otherwise 50%: the club counters at the midpoint (`neg++`). Else the offer is `withdrawn`.
  - At most 2 rounds. Only `transfer`, `free`, `precontract`, and `renewal` offers can be negotiated (`loan` and `pro` have `negotiationsLeft: 0`); a negotiate call on them returns `{ ok:false, error:'not_negotiable' }`.
- **Renewal offers** from the own club come at weeks 10, 22, and 35 of the last contract season if `trust ≥ 40 && ovr ≥ teamStr - 8`. Wage = `max(1.1*current, fairWage)`.
- **Transfer request** (`requestTransfer()`): `treq = true`, trust −15, fans −10, offers λ +0.4. Cleared on transfer or at season end.
- **Loans** end at the end of week 44: `contract = parent`, `parent = null`, `club = parent.club`.
- **Contract expiry** is in §5.3a. A free agent can sign any week.

### 5.14 National team and tournaments

**Levels.**
- U17: age ≤ 16. U19: age 17-18. U21: age 19-21. Senior: age ≥ 17.
- If senior caps ≥ 3, there are no more youth call-ups.

**Thresholds** (with `str = nt.str[nation]`):
- Youth: U17 `str-22`, U19 `str-16`, U21 `str-10`. Called if `ovr ≥ thr`. Starter if `ovr ≥ thr+4`, else bench with an on-chance of 0.6.
- Senior: `cs = ovr + (formAvg-6.6)*2 + rep.c/20 + (previously called ? 1.5 : 0)`. Called if `cs ≥ str-3` and not injured. Starter if `cs ≥ str+2`, else bench with an on-chance of 0.55.
- Call-ups are evaluated at the start of each INTL week and at week 45.
- The first call-up at each level raises the `youth_callup` / `national_callup` trigger and the `national_callup` signal.

**Breaks.** Each INTL week has match A (`mw`) and match B (`wk`).
- **Qualifier season:** season Y where `summerTournaments(Y+1)` contains the nation's confed tournament ('wc' for all confeds; euro/copa/afcon/asian/gold for UEFA/CONMEBOL/CAF/AFC/CONCACAF).
  - At week 1, build a group of 5: the player's nation plus one nation from each of the other 4 strength pots of the confed.
  - Double round robin: 8 matches for the player's nation in the 8 break slots. Other group matches are simulated alongside.
  - Scheduling: a double round robin of 5 teams has 10 rounds (each team rests twice). Generate it with `roundRobin` (a bye slot), then drop the 2 rounds in which the player's nation rests by playing their 2 matches each in the slot of the following round (the last one in the previous round). Other nations may therefore play twice in one slot; this is not visible. `q.fx[].round` is the slot index 1..8.
  - The top 2 qualify.
  - If the confed has ≤ tournament slots (e.g. Copa: all 10 CONMEBOL), everyone qualifies automatically and breaks are friendlies.
- **Other seasons:** friendlies vs random nations with |str diff| ≤ 10.
- Youth national matches in breaks are labelled `ynt` (qualifiers/friendlies) and count youth caps.

**Tournament fields.**

| Tournament | Format | Field |
|---|---|---|
| WC | g48 | UEFA 16, CAF 9, AFC 8, CONMEBOL 6, CONCACAF 6, + 3 best remaining |
| Euro | g24 | UEFA |
| Copa | g16 | 10 CONMEBOL + 6 best CONCACAF |
| AFCON | g24 | CAF (g16 if fewer than 24 nations) |
| Asian | g24 | AFC (g16 if fewer than 24 nations) |
| Gold | g16 | CONCACAF |

- Non-player nations are chosen by `str + normal(0,4)`. The player's group members that finished 3rd-5th are excluded.
- Groups are formed by pots. Advance: top 2 per group, plus the best thirds (g48: 8, g24: 4).
- KO bracket: seeds 1..N by (group position, pts, GD, GF). Pair i vs N+1−i, avoiding same-group pairings where possible. Later rounds follow bracket order.
- All tournament matches are at a neutral venue.
- **Youth tournaments** (u17, u19 every summer; u21 in odd years): an 8-team g8 from the player's confed. Created **only if the player is called up** at week 45.
- `nt.hist` records the stage reached for every senior tournament (including `dnq`). Winning gives the trophy and the `tournament_won` trigger.

**Strength drift** at rollover: `str += 0.2*(base - str) + normal(0, 0.8)`.

### 5.15 Shop and money

`SHOP_ITEMS` (Content writes the Hebrew; the numbers are binding):

| id | cat | he (suggested) | price € | upkeep €/wk | morale | minAge |
|---|---|---|---|---|---|---|
| car_old | car | הסובארו הישנה של הדוד | 3,000 | 20 | 1 | 18 |
| car_city | car | קיה פיקנטו חדשה | 15,000 | 60 | 2 | 18 |
| car_family | car | מאזדה 3 | 35,000 | 120 | 3 | 18 |
| car_lux | car | אאודי RS | 120,000 | 450 | 5 | 18 |
| car_super | car | למבורגיני | 450,000 | 1,800 | 8 | 18 |
| home_room | home | שיפוץ החדר אצל ההורים | 8,000 | 0 | 2 | – |
| home_apt | home | דירת 3 חדרים בעיר | 250,000 | 400 | 4 | 18 |
| home_pent | home | פנטהאוז מול הים | 1,800,000 | 2,500 | 7 | 18 |
| home_villa | home | וילה עם בריכה | 6,000,000 | 6,000 | 10 | 18 |
| fam_trip | family | טיסה משפחתית לחו"ל | 12,000 | 0 | 2 | – |
| fam_parents | family | שיפוץ הבית של ההורים | 90,000 | 0 | 5 | – |
| fam_field | family | מגרש חדש בשכונה | 400,000 | 0 | 6 (+fans 5) | – |
| style_wardrobe | style | ארון בגדים של מעצבים | 20,000 | 0 | 1 | – |
| style_watch | style | שעון יוקרה | 40,000 | 0 | 2 | – |

Each item can be bought once. It can be sold for 60% of its price (fam_* items cannot be sold). The total morale bonus used in the morale target is capped at 25. Buying an item ≥ €100K raises `big_purchase`.

### 5.16 Narrative engine

At **week end**:
1. Queued `next` events fire first.
2. For each trigger raised this week (in order), pick 1 eligible trigger event, weighted. Maximum 2 trigger events per week.
3. If fewer than 2 events fired, draw `k` random-pool events with P(0)=0.5, P(1)=0.42, P(2)=0.08, capped so the weekly total is ≤ 2.

**Eligibility:** all `cond` keys hold, `aw - cd[id] ≥ cooldown`, not (`once` && in `ev.once`), and the trigger matches.

**Rendering:**
- Fill placeholders. Choices with `effects.money < 0` and an insufficient bank are `disabled`.
- Push an `InboxItem` with `exp = aw + 2` if it has choices, and `imp = (trigger !== null && choices.length > 0)`.
- `cd` and `once` are recorded when the event **fires** (not when answered), so an unanswered event cannot fire again.
- `answerEvent` re-checks money (a choice that became unaffordable returns `{ ok:false }`), applies the effects, appends a `me` bubble (reply) and a `followUp` bubble, and queues `effects.next` into `ev.q`. Answering an already-answered item returns `{ ok:false }` with the unchanged thread.

**Engine system messages** (not from EVENTS; plain Hebrew written by the engine):
- offer arrived (`agent`), transfer done (`club`), call-up (`national_coach`), injury (`doctor`), award result (`system`), pro contract or release (`club`).
- Keep them short. These items have `ev = null` and no choices.

**Fixed per-career names** (`state.names`) are generated at `newCareer`: agent, journalist, 3 friends, coaches per club (lazily, from the club country's pool), and partner (when the flag `has_partner` is set by an event, if still null).

### 5.17 Retirement and legacy

- **Voluntary:** `retire()` is allowed when age ≥ 32 and `inWeek === false` and no live match exists (otherwise `error:'in_match'`). The season review suggests it when age ≥ 33. Calling `retire()` while a season review is pending is allowed (that is the 'לפרוש' button of `#/season`): it clears `pending.review` itself.
- **Forced** at rollover: age ≥ 40, or (age ≥ 35 and ovr < 60), or (age ≥ 30 and `freeWeeks` ≥ 30). The engine finalises the retirement itself (`stage = 'retired'`, `retired = {...}`) and sets `pending.retire = 'forced'`. The UI shows `#/retire`.
- On retirement:
  - Raise the `retired` trigger and run the narrative step for it **immediately** (inside `retire()` or the rollover), because no further week will be played. Those events go to the inbox; `answerEvent`, `getInbox`, `getCareer`, `getProfile`, `getAwards`, and `getNational` keep working after retirement (read-only browsing).
  - Signal `retired`.
  - The last season is archived (a partial season is archived as-is), and the open `hist.clubs` spell is closed.
  - All open offers become `withdrawn`; inbox items needing an answer get their default choice applied.

**Legacy score:**
```
legacy = apps*0.05 + goals*0.15 + assists*0.08 + caps.senior*0.35 + ig.senior*0.5 + max(0, peak-70)*2.5 + rep.w*0.4 + Σtrophy + Σaward
trophy: league 12 (prestige ≥ 8: 18), league2 4, cup 5, ucl 30, uel 14, uecl 7, wc 45, euro 30, copa 30, afcon/asian/gold 18, u17/u19/u21 4, youth_league 2
award:  ballon_dor 60, bdo_top3 18, bdo_top10 6, golden_boy 12, top_scorer 6, pots 8, tots 3, young_pots 3, ucl_top_scorer 8, golden_boot_tour 6, motm_final 4
tier = last LEGACY_TIERS entry with min ≤ round(legacy)
```

### 5.18 Engine → telemetry seam (signals)

The engine never calls telemetry. It appends to an in-memory (not persisted) signal list. The UI calls `game.getAndClearSignals()` after every facade call and forwards the result to `telemetry.trackSignals()`. Exact signals:

| name | props |
|---|---|
| `career_started` | `{ nation, position, club, league }` |
| `match_played` | `{ kind, result:'W'|'D'|'L', rating, role, auto:boolean }` (player matches only) |
| `season_completed` | `{ season, n /*1-based season index of the career*/, league, rank, apps, goals, ovr }` |
| `transfer` | `{ type, from, to, fee }` |
| `pro_contract` | `{ club }` |
| `trophy` | `{ key, comp }` |
| `award` | `{ key }` |
| `national_callup` | `{ level }` |
| `debut` | `{ kind:'senior'|'national' }` |
| `retired` | `{ age, seasons, legacy, reason }` |

### 5.19 Calibration targets (checked by `tests/sim.mjs`; warnings, not failures)

- Team goals per league match (all leagues): 2.5-3.1. Home win share 40-50%, draws 22-30%.
- Per 90 minutes, as a starter with ovr ≈ team strength vs equal opposition:

| pos | goals | assists |
|---|---|---|
| ST | 0.40-0.55 | 0.10-0.20 |
| W | 0.25-0.40 | 0.20-0.30 |
| CAM | 0.20-0.35 | 0.25-0.35 |
| CM | 0.08-0.18 | 0.10-0.20 |
| CDM / FB / CB | ≤ 0.10 | |

- GK clean sheets 25-40%.
- Average player rating 6.5-7.0. A great season averages 7.5-8.0.
- A pot ≥ 85 prospect with regular minutes reaches ovr ≥ 80 by age 23 and peaks within 3 of pot at 25-28. Careers end at age 33-40.
- The player wins at least one trophy in ≥ 60% of careers. The Ballon d'Or is won in ≤ 15% of careers.

---

## 6. Facade API: `js/engine/game.js` (Engine implements, UI consumes)

**Rules**
- The facade is a stateful singleton module holding one career.
- All functions are **synchronous** and return **fresh plain objects** (VMs). The UI may mutate them freely; they never alias internal state, except `serialize()`.
- Hebrew text is ready to display. Ids are passed back unchanged.
- Every mutating function, after it completes, calls subscribers registered via `subscribe` and may append signals.
- If called without a career, functions other than lifecycle and `getCreateOptions`/`getAcademyOptions` throw `Error('no_career')`.

### 6.1 Lifecycle

```ts
export const SCHEMA_VERSION = 1;
export function getCreateOptions(opts?: { seed?: number /*uint32; UI passes Date.now()>>>0; default 0*/ }): {
  nations: { id, nameHe, flag, confed, hasLeague: boolean }[],             // pickable only, Israel first, then by nameHe
  positions: { id: Pos, he, short, group: 'GK'|'DEF'|'MID'|'ATT', desc }[],  // order: GK, CB, LB, RB, CDM, CM, CAM, LW, RW, ST
  feet: [{ id:'R', he:'ימין' }, { id:'L', he:'שמאל' }],
  nicknames: string[]                                                     // 6 suggestions picked with rngFor(seed, 'nicks')
};
export function getAcademyOptions(nationId): {
  nationHasLeague: boolean,                 // false → groups contain all playable leagues
  groups: { leagueId, leagueHe, countryHe, flag, tier, clubs: { id, nameHe, shortHe, city, colors, strength, academyStars /*1..5 from strength*/ }[] }[]
};
export function newCareer(opts: { first, last, nick, nation, pos, foot, club, seed?: number, now?: number, startSeason?: number /*2026*/ })
  : { ok: true, report: ScoutReportVM } | { ok: false, error: 'invalid_name'|'invalid_club'|..., messageHe };
// validation: first/last 1..20 chars after trim, nick 0..16; club must be in getAcademyOptions(nation)
// seed defaults to randomSeed() from rng.js. newCareer replaces any career in memory, emits career_started and DOES notify subscribers.
export function loadState(data): { ok: true } | { ok: false, error: 'bad_state', messageHe };
// loadState expects data already migrated to SCHEMA_VERSION (save.js migrates). It checks v === SCHEMA_VERSION and the presence of the
// top-level State keys, replaces the career in memory, and does NOT notify subscribers (nothing changed, so no save is needed).
export function serialize(): State;                // the live internal object (do not mutate); rng written before return
export function hasCareer(): boolean;
export function closeCareer(): void;               // drop the current career from memory (e.g. back to title)
export function getSaveMeta(): SaveMeta;           // §7.2 (seasons = season - startSeason + 1)
export function compactState(level: 1|2|3): State;
export function migrateState(data, fromVersion: number): State;   // v1: identity; throws if fromVersion > SCHEMA_VERSION
export function subscribe(fn: () => void): () => void;
export function getAndClearSignals(): { name: string, props: object }[];
export function fmtMoney(n: number): string;       // re-export from util.js
export function fmtSeason(season: number): string; // '2026/27'

ScoutReportVM = { name, nick, age, nationHe, flag, posHe, footHe, clubHe, ovr, potStars, potRange: [lo, hi], attrs: AttrVM[], textHe /*2-3 sentences of scout report*/ }
AttrVM = { key, he, short, value /*integer*/, delta /*season change, integer, may be 0*/ }
```

### 6.2 Hub and time

```ts
export function getHub(): HubVM;
export function setTraining(id: TrainingId): { ok: boolean };
export function advanceWeek(training?: TrainingId): AdvanceResult;
export function resumeWeek(): AdvanceResult;
export function fastForward(opts: { until: 'next_match'|'season_end'|'season_start'|'weeks', weeks?: number, training?: TrainingId,
                                     maxWeeks?: number /*chunk size; default unlimited*/ }): FFResult;
export function getSeasonReview(season?: number): SeasonReviewVM | null;   // default: pending one, else last
export function ackSeasonReview(): { ok: boolean };   // clears pending.review and a pending.retire === 'offer'
export function grantReward(kind: 'energy15'): { ok: boolean, energy: number };   // +15 energy (cap 100). The engine allows at most 1 reward per game week (stored in ev.flags.rw = absWeek); ads.js separately enforces maxPerDay

AdvanceResult =
  | { ok: true, status: 'match', match: MatchVM }        // live match created (phase 'pre')
  | { ok: true, status: 'done', summary: WeekSummaryVM }
  | { ok: false, error: 'busy'|'review_pending'|'retired'|'no_week', messageHe };

FFResult = { ok: true, weeks: number, summaries: WeekSummaryVM[] /*last 10*/, stopped: 'until'|'offer'|'event'|'review'|'retired'|'injury'|'callup'|'chunk', hub: HubVM }
// fastForward auto-plays player matches (autoPlayMatch+finishMatch+resumeWeek), auto-picks nothing in inbox,
// and stops at: the until condition, a new offer, a new inbox item with imp === true, a season review, retirement,
// a new injury ≥ 3 weeks, or a first-time call-up. 'next_match' stops BEFORE playing the next player match (returns at status 'match' state: hub.pending.match = true).
// Entry state: if a live match exists, 'next_match' returns immediately (weeks 0, stopped 'until'); other modes auto-play it first.
//   If inWeek is true, it first resumes the week. If a review is pending → { weeks:0, stopped:'review' }; if retired → stopped 'retired'.
// 'season_end' = until the end of week 44 (which always ends with stopped 'review'). 'season_start' = until week 1 of a later season
//   (from the summer this skips weeks 45-52; it still stops early on offers etc.).
// maxWeeks: after that many completed weeks, return with stopped 'chunk'. The UI calls it in a loop with maxWeeks: 2 and yields to the
//   event loop between calls (progress overlay, autosave) so low-end phones never freeze for seconds. Chunked and unchunked runs are identical in results.
// Subscribers are notified once per fastForward call, not per week.

HubVM = {
  status: 'idle'|'match'|'in_week'|'review'|'retired',
  dateHe: string, season: number, week: number, phase: 'season'|'summer',
  player: { name, nick, age, pos, posHe, ovr, potStars, potRange, energy, morale, formAvg: number|null, form: number[],
            injury: null | { weeks, he }, susp: number, trust, fans, mates, rep: { l, c, w }, money, value, stage, stageHe, natLvl },
  club: null | TeamVM & { leagueHe, rank: number|null, roleHe, wage, untilHe /*'עד סוף 2028/29'*/, loan: boolean },
  thisWeek: FixtureVM[],           // fixtures of the player's teams this week (mw first)
  next: FixtureVM | null,          // first upcoming fixture after this week if thisWeek is empty
  training: { current: TrainingId, options: { id, he, desc, disabled: boolean }[] },   // 'goalkeeping' disabled for outfield, 'shooting' allowed for all
  alerts: { type: keyof ALERTS, textHe, route: string|null }[],
  unread: number, needsAnswer: number, openOffers: number,
  windowOpen: boolean, canRetire: boolean, canRequestTransfer: boolean,
  canReward: boolean,             // grantReward('energy15') would succeed now (not used this game week, energy < 100, not retired)
  lastResult: null | { textHe, rating: number|null },
  pending: { match: boolean, review: boolean, retire: boolean },   // retire: true iff state.retired !== null
  announcementsHe: string[]       // engine-side notes (e.g. 'יורו 2028 בקיץ!'), may be []
}
// status: 'match' = live match exists; 'in_week' = inWeek && no live match (call resumeWeek); 'review' = pending.review;
//         'retired' = retired !== null; else 'idle'. Priority: retired > match > in_week > review > idle.
TeamVM = { id, nameHe, shortHe, colors: [string, string], flag?: string /*nations*/ }
FixtureVM = { key /*'<season>-<week>-<slot>'*/, week, slot: 'mw'|'wk', dateHe, comp: CompId, compHe, kind, roundHe,
              home: TeamVM, away: TeamVM, isHome: boolean, big: boolean,
              selection: 'starter'|'bench'|'out'|'injured'|'suspended'|'unknown',  // 'unknown' for future weeks
              result: null | { score: [h, a], extraHe: string|null, rating: number|null, res: 'W'|'D'|'L' } }
WeekSummaryVM = {
  dateHe, results: { compHe, home: TeamVM, away: TeamVM, score: [h,a], extraHe, mine: boolean /*player played*/, rating: number|null, noteHe /*'ישבת על הספסל'*/ }[],
  trainingHe: string,              // e.g. 'אימון בעיטות: +0.3 בעיטה'
  ovrBefore, ovrAfter, energy, morale,
  newMessages: number, newOffers: number,
  injuryHe: string|null, callupHe: string|null,
  linesHe: string[],               // misc highlights (table position, milestones)
  hadMatchday: boolean,            // any player matchday this week (for interstitial frequency)
  seasonEnded: boolean,            // week 44 just finished → review pending
  retiredNow: boolean              // the engine retired the player during this week (forced retirement at rollover)
}
SeasonReviewVM = {
  season, seasonHe, clubHe, leagueHe, rank: number|null, rankHe,
  stats: { apps, goals, assists, avgRating, motm, cleanSheets },
  byComp: { compHe, apps, goals, assists, avgRating }[],
  trophies: { key, he }[], awards: { key, he }[],
  ovrStart, ovrEnd, valueEnd, highlightsHe: string[], nextHe: string[],
  canRetire: boolean, isFirstSeason: boolean
}
```

### 6.3 Match

```ts
export function getMatch(): MatchVM | null;                 // null when no live match (the #/match screen then redirects to #/hub)
export function startMatch(): MatchVM;                       // phase pre → live (or straight to 'ended' if no moments remain)
export function chooseMoment(optionIndex: number): { outcome: MomentOutcomeVM, match: MatchVM };
export function autoPlayMatch(): MatchVM;                    // resolves all remaining moments → phase 'ended'
export function finishMatch(): MatchSummaryVM;               // phase must be 'ended'; applies everything; clears live; UI then calls resumeWeek()
export function getLastMatch(): MatchSummaryVM | null;

MatchVM = {
  phase: 'pre'|'live'|'ended', compHe, roundHe, kind, big, dateHe,
  home: TeamVM, away: TeamVM, isHome, role: 'starter'|'bench', roleHe, onMinute: number,
  introHe: string, score: [h, a], minute: number,
  momentIndex: number, momentsTotal: number,
  moment: null | { minute, type, side: 'att'|'def'|'gk', textHe, options: { index, key, he, odds: 'low'|'mid'|'high', oddsHe }[] },
  log: { minute, textHe, kind: 'goal_for'|'goal_against'|'moment'|'info' }[],   // chronological, up to current minute
  ratingSoFar: number,          // 6.0 + deltas (display only)
  extraHe: string|null          // e.g. 'הארכה' / 'פנדלים 4-3' when ended
}
MomentOutcomeVM = { code: ResultCode, ok: boolean, textHe, ratingDelta: number, score: [h, a], goalFor: boolean, goalAgainst: boolean }
MatchSummaryVM = {
  key /*FixtureVM.key of this match, so #/schedule can tell which fixture getLastMatch() belongs to*/,
  compHe, roundHe, kind, home: TeamVM, away: TeamVM, isHome, score: [h, a], extraHe, res: 'W'|'D'|'L',
  rating, goals, assists, motm: boolean, minutes, cleanSheet: boolean,
  momentsHe: { minute, textHe, ok }[], log: MatchVM['log'],
  effectsHe: string[],          // ['+3 מורל', 'אמון המאמן עלה']
  tieHe: string|null,           // 'עלית לשמינית הגמר!' / 'סיכום 3-2'
  injuryHe: string|null
}
```

### 6.4 Inbox

```ts
export function getInbox(): InboxRowVM[];          // newest first
export function getThread(id: string): ThreadVM;   // pure (does not mark read; the chat screen calls markRead)
export function answerEvent(id: string, choiceIndex: number): { ok: boolean, thread: ThreadVM, effectsHe: string[] };
export function markRead(id: string): void;
export function markAllRead(): void;

InboxRowVM = { id, from: PersonaId, fromHe, avatar, previewHe, dateHe, unread: boolean, needsAnswer: boolean }
ThreadVM   = { id, from, fromHe, avatar, isGroup: boolean,
               messages: { who: PersonaId|'me', whoHe, textHe, mine: boolean }[],
               choices: null | { index, he, disabled: boolean }[],   // null once answered or info-only
               answered: number|null, dateHe }
```

### 6.5 Transfers and contract

```ts
export function getOffers(): OfferVM[];            // open first, then recent closed
export function respondOffer(id: string, action: 'accept'|'reject'|'negotiate', counter?: { wageMul: 1.1|1.2|1.35, years: number, role: RoleId, rc: 'none'|'low'|'default' }): OfferResponseVM;
export function requestTransfer(): { ok: boolean, messageHe };
export function cancelTransferRequest(): { ok: boolean, messageHe };
export function getContract(): ContractVM | null;

OfferVM = { id, type, typeHe, club: TeamVM & { leagueHe, countryHe, flag, strength }, fee, wage, years, role, roleHe, rc,
            status, statusHe, expiresHe, negotiationsLeft: number, compareHe: string[] /*'שכר גבוה פי 2.3', 'ליגה חזקה יותר'*/, canAccept: boolean }
OfferResponseVM = { ok: boolean, error?: 'busy'|'not_negotiable'|'closed', status: null|'signed'|'accepted'|'rejected'|'club_refused'|'countered'|'countered_accepted'|'withdrawn', offer: OfferVM|null, messageHe }
// 'signed' = contract in force now (move / renewal / pro); 'accepted' = pre-contract agreed (move at week 45). See §5.13.
ContractVM = { club: TeamVM, wage, until, untilHe, role, roleHe, rc, loan: boolean, parentHe: string|null, nextHe: string|null, yearsLeft }
```

### 6.6 Competitions and schedule

```ts
export function getCompetitions(): {
  mine: CompRowVM[],                                  // competitions involving the player this season (league, youth, cup, europe, national, tournament)
  leagues: { countryHe, flag, items: CompRowVM[] }[], // all playable leagues for browsing
  europe: CompRowVM[]                                 // ucl, uel, uecl
};
export function getTable(compId: string, opts?: { group?: number }): TableVM;   // leagues, youth league, European league phase, qualifier group, tournament groups
export function getBracket(compId: string): BracketVM;                          // cups, European KO, tournament KO
export function getSchedule(): { seasonHe, fixtures: FixtureVM[] };             // all fixtures of the player's teams this season incl. future (selection 'unknown')
// "Player's teams" = current club (first team), the youth side while comp.yl applies, and national sides he is currently called up to.
// Future KO fixtures appear only once the tie is known (§2.4). After a mid-season move, fixtures before the move come from `hist.matches` (player matches only, may be pruned by compaction) and later ones from the new club.
export function getResults(compId: string): { roundHe, results: { home: TeamVM, away: TeamVM, score: [h,a] }[] } | null;   // last round of a league

CompRowVM = { id, he, kind, hasTable: boolean, hasBracket: boolean, statusHe /*'מחזור 12 מתוך 36'*/ }
TableVM = { id, he, groups: { he, rows: { rank, team: TeamVM, p, w, d, l, gf, ga, gd, pts, zone: null|'champ'|'ucl'|'uel'|'uecl'|'promo'|'releg'|'ko'|'kpo'|'out'|'q', mine: boolean }[] }[],
            legend: { zone, he }[], noteHe: string|null, formatHe }
BracketVM = { id, he, rounds: { key, he, ties: { home: TeamVM, away: TeamVM, legs: { score: [h,a]|null }[], aggHe: string|null, winner: 'home'|'away'|null, mine: boolean }[] }[], winner: TeamVM|null }
```
Competition ids: league ids (`isr1`), youth league (`isr1_u17`), cups (`isr_cup`), `ucl`/`uel`/`uecl`, national: qualifier `q_<tourKey>` (e.g. `q_euro2028`), tournament `<tourKey>`, `fr` (friendlies), youth national `ynt_u19`.

### 6.7 Player, career, national, awards, shop, retirement

```ts
export function getProfile(): ProfileVM;
export function getCareer(): CareerVM;
export function getNational(): NationalVM;
export function getAwards(): AwardsVM;
export function getShop(): ShopVM;
export function buyItem(id: string): { ok: boolean, messageHe };
export function sellItem(id: string): { ok: boolean, messageHe };
export function retire(): RetirementVM | { ok: false, error: 'too_young'|'in_match', messageHe };
export function getRetirement(): RetirementVM | null;
export function buildHallOfFameEntry(): HofEntry | null;      // only after retirement; pure, createdAt = Date.now() (excluded from determinism checks)

ProfileVM = { name, nick, age, nationHe, flag, posHe, footHe, ovr, potStars, potRange, attrs: AttrVM[] /*position-relevant first*/,
              gk: boolean, value, money, wage, stageHe, clubHe, contract: ContractVM|null,
              status: { energy, morale, trust, fans, mates, rep: { l, c, w } },
              season: { apps, goals, assists, avgRating, motm }, career: { apps, goals, assists, caps, intlGoals, trophies: number },
              owned: { id, he }[], traitsHe: string[] /*flags rendered, e.g. 'קפטן', 'אהוב הקהל'*/ }
CareerVM = { timeline: { id, dateHe, icon, textHe }[] /*newest first*/,
             seasons: { season, seasonHe, age, clubHe, leagueHe, rank, apps, goals, assists, avgRating, ovr, loan: boolean }[],
             totals: { apps, goals, assists, avgRating, motm, caps, intlGoals },
             trophies: { key, he, count, seasonsHe: string }[], awards: { key, he, count, seasonsHe: string }[],
             clubs: { club: TeamVM, fromHe, toHe, apps, goals, loan: boolean }[] }
NationalVM = { nation: TeamVM, level, levelHe, statusHe, caps, goals, youth: { u17: [caps, goals], u19: [...], u21: [...] },
               upcoming: FixtureVM[], qualifier: TableVM|null, tournament: null | { key, he, table: TableVM|null, bracket: BracketVM|null, stageHe },
               history: { seasonHe, he, stageHe, winnerHe }[] }
AwardsVM = { mine: { seasonHe, key, he, detailHe }[], ballonDor: { seasonHe, rank /*0 = not nominated*/, rankHe, top3: { name, clubHe, flag }[] }[],
             seasonBenchmarks: { compHe, scorerHe /*'יואב כהן (מכבי חיפה) 17'*/ }[] }
ShopVM = { money, weeklyUpkeep, moraleBonus, cats: { id, he, items: { id, he, price, upkeep, morale, owned, canBuy, reasonHe: string|null }[] }[] }
RetirementVM = { ok: true, name, age, seasons, reason, reasonHe, legacy: number, tierHe, totals: CareerVM['totals'], trophies: CareerVM['trophies'],
                 awards: CareerVM['awards'], peakOvr, clubsHe: string[], farewellHe: string[] /*3-5 lines (mom, friends, fans)*/ }
```

**HofEntry** (persisted by `save.addHallOfFame`; stable shape, schema 1):
```ts
HofEntry = { v: 1, careerId, name, nick, nation, flag, pos, posHe, born, startSeason, endSeason, seasons, age,
             clubs: { id, he }[], apps, goals, assists, caps, intlGoals, peakOvr,
             trophies: { [TrophyKey]: number }, awards: { [AwardKey]: number },
             legacy: number, tierHe, reason, createdAt /*ms*/ }
```

---

## 7. Platform: storage, backup, PWA (Platform agent)

### 7.1 Storage keys (localStorage and the IDB `kv` store use the SAME keys)

| key | content | stores |
|---|---|---|
| `hy.slot.<n>` (n = 1..3) | current save record (string, format §7.2) | LS + IDB |
| `hy.slot.<n>.prev` | previous good save record | LS + IDB |
| `hy.slot.<n>.deleted` | soft-deleted record (last deleted or overwritten career) | IDB only |
| `hy.slot.<n>.tomb` | tombstone `{"seq":n,"at":ms}` written by `deleteSlot`: candidates with `seq ≤ tomb.seq` are ignored by `loadSlot`/`listSlots` (so a copy that failed to delete in one store cannot resurrect) | LS + IDB |
| `hy.hof` / `hy.hof.prev` | Hall of Fame record (format §7.4) | LS + IDB |
| `hy.corrupt.<n>.<ts>` | raw unreadable strings kept for support (keep the newest 3 per slot) | IDB only |
| `hy.settings` | UI settings JSON (owned by UI, §9.6) | LS |
| `hy.device`, `hy.tm.*` | telemetry (Backend) | LS |
| `hy.fb.*` | feedback (Backend) | LS |
| `hy.rc` | remote config cache (Backend) | LS |
| `hy.ads` | ad frequency state (Backend) | LS |
| `hy.admin.session` | admin auth session (Backend, admin.html only) | LS |
| `hy.dev.backend` | dev override of backend URL and key (e2e) | LS |

### 7.2 Save record format

```
record  = 'HYS1\n' + headerJSON + '\n' + dataJSON
header  = { slot, seq, savedAt /*ms*/, v /*schema*/, app /*APP_VERSION*/, sum /*fnv1a(dataJSON)*/, len /*dataJSON.length*/, meta: SaveMeta }
dataJSON = JSON.stringify(state)        // no indentation
SaveMeta = { careerId, name, nick, nation, flag, pos, posHe, age, ovr, clubId, clubHe, season, week, dateHe, stage, retired: boolean,
             seasons: number /*1-based season index of the career*/ }
```
- **Size.** LS quota is about 5 M UTF-16 characters for the **whole origin**, and `moshe0408.github.io` is shared with every other Pages repo of this user. Budget: cur + prev of 3 slots at the 400 KB target is ≈ 2.4 M chars. That is why the quota path below exists and why `prev` rotates only once per game week.
- `JSON.stringify` never emits raw newlines, so splitting at the first two `\n` is safe.
- **Valid record:** the prefix is `HYS1`, the header parses, `dataJSON.length === len`, `fnv1a(dataJSON) === sum`, and `v ≤ schemaVersion`.
- **Too-new record:** intact (checksum OK) but `v > schemaVersion` (written by a newer app version, e.g. an old cached tab). It is never treated as corrupt, never overwritten, never "repaired", and never rotated away. If the best candidate of a slot is too new, `loadSlot` returns `{ ok:false, error:'too_new', messageHe:'השמירה נוצרה בגרסה חדשה יותר של המשחק. רענן כדי לעדכן.' }` and the UI triggers the SW update flow; `saveSlot` refuses to write that slot (returns `ok:false`).
- `listSlots()` parses **headers only** and does not parse data.
- `seq` is a monotonically increasing integer per slot: `max(seq of all copies) + 1`.
- `fnv1a`: 32-bit FNV-1a over UTF-16 code units (`h ^= charCode; h = Math.imul(h, 16777619)`), output as 8-char lowercase hex.

```ts
SlotInfo   = { slot, empty: boolean, meta: SaveMeta|null, savedAt: number|null, hasPrev: boolean, hasDeleted: boolean, source: 'ls'|'idb'|null,
               corrupt: boolean /*raw data exists but no valid copy*/, tooNew: boolean }
SaveResult = { ok: boolean, bytes: number, ls: boolean /*LS write succeeded*/, warn: null|'quota_pruned'|'ls_full_idb_only'|'unchanged'|'too_new'|'blocked_other_tab' }
LoadResult = { ok: boolean, state: object|null, meta: SaveMeta|null, source: 'ls'|'idb'|'ls-prev'|'idb-prev'|null, repaired: boolean, migratedFrom: number|null, error?: 'empty'|'corrupt'|'too_new', messageHe? }
```

### 7.3 Dual-store algorithms

**`saveSlot(slot, state, meta, opts)`** (synchronous for LS; IDB is queued):
0. If this tab lost ownership of the slot to another tab (see "Multiple tabs" below), return `{ok:false, warn:'blocked_other_tab'}`. If the slot's best record is too new (§7.2), return `{ok:false, warn:'too_new'}`.
1. `dataJSON = JSON.stringify(state)` and `sum = fnv1a(dataJSON)`. If `sum` equals the last saved sum for this slot, return `{ok:true, warn:'unchanged'}`. Nothing is written, so `prev` is not rotated.
2. Build the record with `seq = lastSeq[slot] + 1`.
3. **Rotate (once per game week):** `prev` is the rollback point for 'שחזר שמירה קודמת', so it must not be overwritten on every autosave. Using the cached header of the last record written/loaded for this slot (no re-parse): if its `meta.careerId` equals the new one and its `meta.season*52 + meta.week` differs from the new record's, copy the current LS cur string to `hy.slot.<n>.prev` (LS) and queue the same rotation for IDB. Otherwise keep the existing `prev`. Result: `prev` = the last save of the previous game week.
4. Write `hy.slot.<n>` to LS (try/catch).
5. Queue an IDB write of the same strings. **All** IDB writes of save.js (saves, rotations, repairs, restores, deletes, imports, HoF) go through one sequential promise chain, coalesced to the latest value per key, so they can never land out of order.
   - If LS is unavailable altogether (`initStorage().ls === false`, e.g. storage disabled), skip step 4 and return `{ok:true, ls:false, warn:'ls_full_idb_only'}` (warn once per session).
6. **Quota** (`QuotaExceededError`, or any setItem failure):
   1. Remove `hy.slot.<n>.prev` from LS only (IDB keeps it), trim `hy.tm.q` (telemetry queue) to its last 50 entries, and retry.
   2. Call `opts.onQuota(1)` to get a compacted state, rebuild the record, and retry.
   3. Do the same with `onQuota(2)`, then `onQuota(3)`.
   4. If LS still fails, rely on IDB: the result is `{ok:true, ls:false, warn:'ls_full_idb_only'}`. Emit an `onWarning({code:'quota', messageHe:'האחסון במכשיר כמעט מלא. ההתקדמות נשמרת, אבל מומלץ לייצא גיבוי.'})`.
   5. If IDB is also unavailable, return `ok:false` and emit the warning `'save_failed'` with `messageHe:'המכשיר לא מאפשר שמירה (אולי גלישה פרטית?). ההתקדמות לא תישמר. מומלץ לייצא קוד גיבוי.'` (once per session).
7. Update `lastSeq`, `lastSum`, and the cached header. Every other save.js write to a slot (repair, restore, import, delete) also updates these three, so the next autosave neither reuses a seq nor skips a needed write.

**IDB robustness:** every IDB operation has a 3 s timeout (then treated as failed). On an `InvalidStateError` / "connection lost" (common on iOS after backgrounding), re-open the DB once and retry. `idbOpen` handles `onblocked` with the same timeout and resolves `null`.

**Multiple tabs:** two tabs on the same slot would overwrite each other. save.js listens to the `storage` event; when another tab writes `hy.slot.<n>` for the slot this tab saved or loaded, it marks the slot as owned elsewhere and calls the `onExternalWrite` callbacks. From then on `saveSlot` for that slot returns `blocked_other_tab`. `main.js` shows a blocking modal 'המשחק פתוח בלשונית אחרת. המשך שם, או טען מחדש כאן.' with a 'טען מחדש' button (reloading re-reads the newest copy and takes ownership again).

**`loadSlot(slot)`:**
1. Read the 4 candidates: LS cur, LS prev, IDB cur, IDB prev. Parse and validate each. Drop candidates with `seq ≤ tomb.seq` (max of the LS and IDB tombstones).
2. Pick **best** = the valid or too-new candidate with the highest `seq`; on a tie, the newest `savedAt`; on a further tie, prefer cur over prev and LS over IDB. If best is too new → return `too_new` (no repair).
3. **Repair** so that both stores hold the best record as cur and, as prev, the highest-seq valid candidate of the same career whose game week (`season*52+week`) is earlier than best's (if none, the highest lower-seq candidate; if none, leave prev as is). Write only what differs. Report `repaired: true` if anything was written. Repair writes are best-effort: a quota or IDB failure during repair is swallowed (the load still succeeds).
4. If `header.v < schemaVersion`, set `data = migrate(data, header.v)` and `migratedFrom = header.v`. The next autosave writes the new version.
5. If no candidate is valid but some raw strings existed, copy the raw strings to `hy.corrupt.<n>.<ts>` (IDB) and return `{ok:false, error:'corrupt', messageHe:'השמירה נפגמה. נסה "שחזר שמירה קודמת" או ייבוא גיבוי.'}`.
6. If there is nothing at all, return `error:'empty'`.

**`restorePrevious(slot)`:** swap cur and prev in both stores. The restored record gets a new seq (`max + 1`) so it wins on the next load. This makes the restore undoable. If there is no valid prev, return `{ok:false, error:'empty', messageHe:'אין שמירה קודמת לשחזור'}` and change nothing.

**`deleteSlot(slot)`:** copy the best cur record to IDB `hy.slot.<n>.deleted`, write the tombstone `hy.slot.<n>.tomb = {seq: <max seq>, at}` to both stores, then remove cur and prev from both stores. `restoreDeleted` writes it back as cur with a new seq (`> tomb.seq`) and removes the tombstone.
- The UI must call `deleteSlot` **before** starting a new career in an occupied slot, so the old career can be recovered. The first save of the new career gets `seq = tomb.seq + 1`.
- If IDB is unavailable, the `.deleted` copy cannot be kept: the UI's delete confirmation then says the deletion is final.

**Slot operations on the active slot (UI rule).** Before `restorePrevious`, `restoreDeleted`, `importToSlot`, `importBackup`, or `deleteSlot` touches the slot the game is currently playing, `main.js` cancels its pending debounced autosave (otherwise the old in-memory career would overwrite the restored/imported one 400 ms later). After the operation it calls `game.loadState(result.state)` (or `game.closeCareer()` and `activeSlot = null` after a delete). Before switching to another slot or starting a new career, it runs `saveNow()` + `flushPending()` for the current one. Before any export, it runs `saveNow()` so the export contains the latest state.

**Lifecycle hooks** (wired in `main.js`, §9.2):
- **Autosave** runs on every facade mutation, debounced to 400 ms.
- **Immediate save** also happens on `visibilitychange→hidden`, `pagehide`, and `freeze`, and before a SW-update reload. Use LS synchronously, then `flushPending()`.

### 7.4 Hall of Fame store

```
record = 'HYH1\n' + headerJSON + '\n' + dataJSON;  header = { seq, savedAt, v: 1, sum, len, count }
data   = { entries: HofEntry[] }
```
- **Load:** read LS and IDB (cur and prev). Take the **UNION** of entries from all valid copies, deduplicated by `careerId` (keep the newest `createdAt`), and write the union back to both stores if anything differs. Hall of Fame entries are never lost because one store is stale.
- **`addHallOfFame(entry)`:** load, merge, then write `prev` (rotation) and cur to both stores. Calling it again for the same `careerId` keeps the stored entry's original `createdAt` (idempotent), so repeated visits to `#/retire` change nothing.
- The Hall of Fame is never affected by `deleteSlot`.

### 7.5 Export and import

- **File export (`exportSlotJSON`):**
  - Filename: `hayeled-<careerId>-<season>.json`.
  - Content: `{ "format":"hy-save", "v":<schema>, "app":<appVersion from configure()>, "exportedAt":<ms>, "meta":SaveMeta, "sum":fnv1a(JSON.stringify(data)), "data":<state> }`. Indent the top level with 2 spaces and keep `data` compact.
- **Backup export (`exportBackupJSON`):**
  - Filename: `hayeled-backup-<yyyy-mm-dd>.json`.
  - Content: `{ "format":"hy-backup", "v":1, "app", "exportedAt", "slots": { "1": <hy-save object>|null, "2": ..., "3": ... }, "hof": { "entries": [...] } }`.
- **Code export (`exportSlotCode`):**
  - With `CompressionStream('gzip')` available: `'HY1:' + base64url(gzip(utf8(JSON.stringify(hySaveObject))))`.
  - Otherwise: `'HY0:' + base64url(utf8(json))`.
  - Ready to paste in WhatsApp or notes. WhatsApp truncates messages above ~65,000 characters: if the code is longer than 60,000 characters (likely for `HY0:` or very long careers), the UI says so and recommends 'ייצוא קובץ' instead.
- **`parseImport(text)`:**
  - Trim, and remove whitespace inside codes.
  - Accept: `HY1:` (needs `DecompressionStream`; if it is missing, return `error:'unsupported_code'`), `HY0:`, raw JSON of `hy-save`, raw JSON of `hy-backup`, or a raw `HYS1` record.
  - Validate `sum` (for a `hy-save` object, `sum` is computed over `JSON.stringify(data)`). Migrate if needed.
  - Returns `{ ok:true, kind:'save'|'backup', meta, data, raw }`. Errors are `'bad_format'|'bad_checksum'|'too_new'|'unsupported_code'`, each with a Hebrew `messageHe`.
- **`importToSlot(parsed, slot)`:** soft-delete the existing slot content (as in `deleteSlot`), then save as cur.
- **`importBackup`:** each slot present in the backup is imported (with soft-delete). The Hall of Fame entries are merged (union).

### 7.6 Persistence status

- **`requestPersist()`:**
  - Returns `'unsupported'` if `navigator.storage?.persist` is missing.
  - Otherwise returns `await navigator.storage.persisted()` or `await navigator.storage.persist()` mapped to granted/denied.
  - Called by the UI after the first career is created (a user gesture) and at boot if a career exists and persistence is not yet granted.
  - Never throws (wrap in try/catch); some browsers reject or prompt.

**Platform storage facts the settings and install screens must explain (Hebrew copy owned by UI):**
- **iPhone/iPad:** a game installed to the home screen has its **own, separate** storage from Safari. A career started in Safari does not appear in the installed app. Before installing, export a backup code in Safari and import it inside the installed app. `#/install` on iOS shows this with a 'העתק קוד גיבוי' button when a career exists.
- **Safari (not installed)** may erase site data after about 7 days without visiting the site. Installing to the home screen avoids this.
- **Android Chrome:** the installed app shares storage with Chrome; nothing to move.
- **`getStorageStatus()`** uses `navigator.storage.estimate()`. The settings screen shows status lines in Hebrew:
  - 'האחסון מוגן ✓'
  - 'הדפדפן עלול למחוק נתונים כשהמכשיר מתמלא. מומלץ לגבות'
  - 'לא נתמך בדפדפן הזה'

### 7.7 `manifest.webmanifest`

```json
{ "name": "הילד מהשכונה", "short_name": "הילד מהשכונה", "description": "מהשכונה ועד הבאלון ד'אור. משחק קריירה של כדורגלן",
  "lang": "he", "dir": "rtl", "start_url": "./", "scope": "./", "id": "./", "display": "standalone", "orientation": "portrait",
  "background_color": "#0b1220", "theme_color": "#0b1220", "categories": ["games","sports"],
  "icons": [ { "src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
             { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
             { "src": "./icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" } ] }
```
**Icon art:** a stylised ball over a stadium-night background (#0b1220) with a pitch-green (#1fbf5a) arc and a small gold star. The maskable icon keeps its content inside the 80% safe zone. `icon.svg` is the source; `tools/make-icons.mjs` rasterises a simplified geometric version directly (circles and arcs, drawn in JS into an RGBA buffer, encoded with `node:zlib`) so no external tools are needed.

### 7.8 Service worker (`sw.js`)

```js
const VERSION = '1.0.0';                 // MUST equal APP_VERSION in js/config.js (integration check)
const CACHE = 'hayeled-' + VERSION;      // CacheStorage is per ORIGIN, shared with the user's other *.github.io repos: use a unique prefix
const FONT_CACHE = 'hayeled-fonts-v1';
const PRECACHE = [ './', './index.html', './manifest.webmanifest', './css/app.css',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png',
  './js/main.js', './js/config.js',
  './js/core/rng.js', './js/core/save.js', './js/core/idb.js', './js/core/supa.js', './js/core/telemetry.js', './js/core/remote.js', './js/core/feedback.js', './js/core/ads.js',
  './js/data/countries.js', './js/data/leagues.js', './js/data/names.js', './js/data/events.js', './js/data/commentary.js', './js/data/strings.js',
  './js/engine/game.js', './js/engine/state.js', './js/engine/util.js', './js/engine/calendar.js', './js/engine/schedule.js', './js/engine/sim.js',
  './js/engine/world.js', './js/engine/player.js', './js/engine/selection.js', './js/engine/moments.js', './js/engine/match.js', './js/engine/transfers.js',
  './js/engine/europe.js', './js/engine/cups.js', './js/engine/national.js', './js/engine/awards.js', './js/engine/narrative.js', './js/engine/history.js', './js/engine/shop.js',
  './js/ui/dom.js', './js/ui/router.js', './js/ui/app.js', './js/ui/components.js', './js/ui/format.js', './js/ui/title.js', './js/ui/create.js', './js/ui/hub.js',
  './js/ui/week.js', './js/ui/match.js', './js/ui/inbox.js', './js/ui/schedule.js', './js/ui/tables.js', './js/ui/career.js', './js/ui/profile.js', './js/ui/national.js',
  './js/ui/offers.js', './js/ui/awards.js', './js/ui/shop.js', './js/ui/hof.js', './js/ui/settings.js', './js/ui/feedback.js', './js/ui/install.js', './js/ui/adslots.js', './js/ui/retire.js' ];
```
- **install:** `cache.addAll(PRECACHE)`. Use `{cache:'reload'}` requests so the browser HTTP cache is bypassed. Do **not** call `skipWaiting` automatically.
- **activate:** delete caches starting with `hayeled-` other than `CACHE` and `FONT_CACHE` (never touch other caches of the origin), then `clients.claim()`.
- **fetch** (GET only), checks in this order:
  - Cross-origin requests to `fonts.googleapis.com` / `fonts.gstatic.com` use stale-while-revalidate in `FONT_CACHE`. Other cross-origin requests (Supabase, AdSense, house-ad images) are **not intercepted**.
  - Same-origin admin and test paths are not intercepted (network only). Compute `rel` = the request path relative to `self.registration.scope` (so it works under `/hayeled/` and at root) and skip when `rel === 'admin.html'` or `rel` starts with `js/admin/`, `css/admin.css`, `tests/`, `docs/`, or `supabase/`. This check runs **before** the navigation fallback, so `admin.html` is never answered with `index.html`.
  - Same-origin navigations use network-first with a 3 s timeout, falling back to cached `./index.html` (ignore search).
  - Other same-origin GETs use cache-first (`ignoreSearch:true`). On a miss, fetch, and if `ok`, put the response into `CACHE`. This runtime fill protects against a file accidentally missing from PRECACHE.
- **message:** `{type:'SKIP_WAITING'}` → `self.skipWaiting()`.
- **Update flow** (page side, `main.js`):
  1. `navigator.serviceWorker.register('./sw.js', {scope:'./'})`, only on https or localhost.
  2. On `updatefound`, or if `reg.waiting` exists, show the banner 'גרסה חדשה זמינה' with the button 'עדכן עכשיו'.
  3. On click: save immediately, `flushPending()`, then post `SKIP_WAITING`.
  4. On `controllerchange`, reload once (guard flag) **only if** the user pressed 'עדכן עכשיו' in this page. (`clients.claim()` on the very first install also fires `controllerchange`; reloading then would interrupt a new player.)
  5. Check for updates on boot and every 30 min while visible (`reg.update()`).
  6. On the very first install there is no old worker: do not show the banner when `navigator.serviceWorker.controller` is null.

### 7.9 Zero-dependency static server (`tests/serve.mjs`)

- Usage: `node tests/serve.mjs [port=8080] [--base /hayeled/]`.
- Serves ROOT (`path.resolve(fileURLToPath(import.meta.url), '../..')`; the path contains Hebrew and spaces) under the base path. With a base, `/` redirects (302) to the base.
- MIME types: `.html text/html; charset=utf-8`, `.js text/javascript; charset=utf-8`, `.mjs` same, `.css text/css`, `.json application/json`, `.webmanifest application/manifest+json`, `.svg image/svg+xml`, `.png image/png`, `.ico`, `.md text/markdown`, `.txt`.
- Headers: `Cache-Control: no-cache`. Directory → `index.html`. Unknown file → 404. Prevent path traversal (resolved path must start with ROOT). Decode URI components.
- Logs `Serving <ROOT> at http://localhost:<port><base>`.

---

## 8. Backend: Supabase, telemetry, feedback, remote config, ads, admin (Backend agent)

**Principle:** the game works 100% without a backend. If `BACKEND_ENABLED` is false, every function in telemetry, remote, and feedback is a silent no-op (or returns defaults); `track()` does not even enqueue, so nothing accumulates in LS. Ads still work with provider `'none'` (the default). No network failure may throw into the UI or block gameplay; all calls catch internally.

**Offline behaviour (all online features):**
| feature | offline / backend down |
|---|---|
| telemetry | events stay in `hy.tm.q` (cap 500), heartbeats are skipped; flush retries with backoff and immediately on the `online` event |
| feedback | queued in `hy.fb.q` (cap 10, drop oldest); the UI shows 'אין חיבור כרגע. המשוב יישלח אוטומטית כשתחזור לרשת ✓'; flushed at boot and on `online` |
| remote config | last cached `hy.rc`, else `REMOTE_DEFAULTS` (ads off) |
| house ads | an `<img>` that fails to load hides its slot again (`onerror` → `el.hidden = true`), so no broken image is shown |
| AdSense | script load failure → behave as provider `'none'` for this page load |
| admin.html | not cached by the SW; shows 'אין חיבור לשרת' with a retry button on any network error |

### 8.1 `supa.js`: REST details (no supabase-js)

| Operation | Request |
|---|---|
| RPC | `POST {URL}/rest/v1/rpc/{name}`, body = JSON args object (param names `p_*`). |
| Select | `GET {URL}/rest/v1/{table}?{query}`. |
| Sign in | `POST {URL}/auth/v1/token?grant_type=password`, body `{email,password}` → `{access_token, refresh_token, expires_in, expires_at?, user:{id,email}}`. If `expires_at` is missing, compute it as now + `expires_in`. |
| Refresh | `POST {URL}/auth/v1/token?grant_type=refresh_token`, body `{refresh_token}`. |
| Sign out | `POST {URL}/auth/v1/logout` with Bearer. Best-effort. |

**Headers:**
- Always: `apikey: <ANON_KEY>` and `Content-Type: application/json`.
- `Authorization: Bearer <access_token>` when a user session token is given.
- Otherwise, send `Authorization: Bearer <ANON_KEY>` only if the key looks like a JWT (starts with `eyJ`). New-style `sb_publishable_…` keys are sent in `apikey` only.

**Behaviour:**
- Timeout via `AbortController`.
- Non-2xx responses throw `SupaError(status, code /*PostgREST code or 'http_<status>'*/, message)`.
- `keepalive:true` is used for hide-time flushes. Browsers reject keepalive bodies above 64 KB in total, so `telemetry.flush({keepalive:true})` cuts the batch until `JSON.stringify(body).length < 60000` (typically ≤ 20 events).
- `rpc`/`select` never retry on their own; callers decide.
- `sendBeacon` is **not** used because it cannot send the `apikey` header.

### 8.2 Telemetry (`telemetry.js`)

**Identity and consent:**
- **Device id:** `hy.device` = `crypto.randomUUID()` (fallback: random hex of 32 chars). Anonymous; no personal data.
- **Consent:** `hy.tm.consent` = `'1'|'0'`, defaulting to `TELEMETRY_DEFAULT_ON`. When off: no events, no heartbeat, and the queue is cleared. Feedback and remote config still work.

**Sessions and heartbeat:**
- **Session:** `hy.tm.sess` = `{ id, lastActive }`, `id` = `crypto.randomUUID()` (same fallback as the device id; must match `[A-Za-z0-9-]{8,64}`). A new session starts at boot, or when the app returns from hidden after > 30 min.
- `admin.html` never initialises telemetry (the owner's visits must not count as players).
- **Heartbeat:** while `document.visibilityState === 'visible'`, call `rpc('heartbeat', {p_device, p_session, p_meta})` immediately at init and every `HEARTBEAT_MS`.
- `p_meta = { v: APP_VERSION, standalone: boolean, platform: 'android'|'ios'|'desktop'|'other', lang: navigator.language }`.

**Event queue:**
- `track(name, props)` pushes `{ n: name, p: props, t: new Date().toISOString(), s: sessionId }` to the queue in `hy.tm.q`.
- The queue is capped at 500 (drop oldest). `props` is shallow-copied, and string values are truncated to 120 chars.
- **Flush:** every 30 s, when the queue has ≥ 20 events, and on `visibilitychange→hidden` / `pagehide` (`keepalive:true`).
  - Sends `rpc('track_events', {p_device, p_session, p_events: batch /* ≤ 50 */})`.
  - On success, remove the batch. On failure, keep it and back off (30 s → 60 s → 120 s, max 10 min).

**Automatic events** (sent by `initTelemetry`):
- `app_open { standalone, v, ref: 'pwa'|'browser' }` once per page load.
- `install {}` once per device: on the `appinstalled` event, or the first time `matchMedia('(display-mode: standalone)').matches || navigator.standalone` (flag `hy.tm.installed`).
- `error { msg, src }` for `window.onerror` / `unhandledrejection`: at most 5 per session, `msg` truncated to 200 chars.

**Events forwarded by the UI:**
- Engine signals (§5.18): `career_started`, `match_played`, `season_completed`, `transfer`, `pro_contract`, `trophy`, `award`, `national_callup`, `debut`, `retired`.
- From the UI: `feedback_sent {rating}`, `ad_impression {placement, provider, ad}`, `ad_click {...}`, `ad_rewarded {...}`, `update_applied {from,to}`, `backup_export {kind}`, `backup_import {kind}`.

### 8.3 Feedback (`feedback.js`)

- **Availability:** `isFeedbackAvailable()` = `BACKEND_ENABLED && FEEDBACK_ENABLED && getRemoteConfig().feedback.enabled`. If unavailable, the UI shows the feedback screen with the note 'שליחת משוב תהיה זמינה בקרוב' and a disabled button.
- **Submit:**
  - `submitFeedback({rating /*1..5 required*/, text /*0..2000*/, email /*optional, ≤ 200, basic regex*/, context})` calls `rpc('submit_feedback', {p_device, p_rating, p_message, p_email, p_context})`.
  - `context = { v, platform, standalone, season, seasons, age, ovr, club, trigger }` (supplied by the UI).
  - Offline or on error, append to `hy.fb.q` and return `{ok:true, queued:true}`.
  - `flushFeedbackQueue()` runs at boot and on `online`.
  - On success, track `feedback_sent`.
- **`shouldPrompt(trigger)`** returns true only if all of these hold:
  - feedback is available;
  - `remote.feedback.prompt` is true;
  - now − `hy.fb.last` ≥ 30 days (a missing key counts as "never");
  - now − `hy.fb.sent` ≥ 30 days (missing = never; `submitFeedback` sets it on success or queue);
  - (for `'season1'`) the prompt was not already shown for this trigger (`hy.fb.done` list).
- **`markPrompted(trigger)`** sets `hy.fb.last = now` and adds `trigger` to `hy.fb.done` (call it on show, whether the player chooses 'לא עכשיו' or sends).
- **Server-side validation** mirrors the client: the email must match `^[^@\s]+@[^@\s]+\.[^@\s]+$` (else stored as null), `p_context` is limited to 2 KB (else replaced by `{}`).

### 8.4 Remote config (`remote.js`)

`GET /rest/v1/app_config?select=key,value`. The rows are merged into `REMOTE_DEFAULTS` (recursive deep merge of plain objects; arrays and scalars from the server replace the default) and cached in `hy.rc` as `{fetchedAt, config}`. The cache is used at boot (sync) and refreshed in the background.

**Sanitising (remote.js, after merge):** wrong types fall back to the default value; `provider` must be one of the 3 values; numbers are clamped (`everyMatchdays` 1..50, `minMinutesBetween` 0..120, `skipFirstMinutes` 0..120, `maxPerDay` 0..10); every `link`/`imageUrl` must be an `https:` URL or a relative `./` path, otherwise the item is dropped (blocks `javascript:` links); `textHe`/`messageHe` are truncated to 200 chars and always rendered with `textContent`, never as HTML.

```js
REMOTE_DEFAULTS = {
  ads: {
    enabled: false, provider: 'none',            // 'none' | 'house' | 'adsense'
    placements: {
      hub_banner:   { enabled: true },
      interstitial: { enabled: true, everyMatchdays: 4, minMinutesBetween: 3, skipFirstMinutes: 10 },
      rewarded:     { enabled: false, maxPerDay: 3, energy: 15 }
    },
    house: [],                                    // [{ id, imageUrl, link, textHe, weight, placements: ['hub_banner','interstitial','rewarded'] }]
    adsense: { client: '', slots: { hub_banner: '', interstitial: '' } }
  },
  announcement: { enabled: false, id: '', textHe: '', link: '', level: 'info' },   // level: 'info'|'warn'
  version: { min: '0.0.0', latest: '0.0.0', messageHe: 'יש גרסה חדשה. רענן כדי לעדכן' },
  feedback: { enabled: true, prompt: true }
}
```
- `app_config` rows: `key ∈ {'ads','announcement','version','feedback'}`, `value jsonb`.
- If `compareVersions(APP_VERSION, version.min) < 0`, the UI shows a persistent update banner (and tries `reg.update()`).
- Else if `compareVersions(APP_VERSION, version.latest) < 0`, the UI shows a dismissible banner with `version.messageHe` (and tries `reg.update()`).
- `main.js` subscribes with `onRemoteConfig(cfg => …)` and, on every successful load, re-runs `initAds(cfg.ads, …)`, the announcement check, and the version check. So an admin change reaches running clients at their next boot or background refresh.

### 8.5 Ads (`ads.js`)

**Providers:**
- `'none'`: nothing renders, `renderSlot` hides the element, and no space is reserved.
- `'house'`: sponsor creatives from `ads.house`, weighted random per render, filtered by placement.
  - Markup: `<a class="ad-house" data-testid="ad-house-link" href=link target="_blank" rel="noopener sponsored">` containing an `<img loading="lazy" alt="">` and the text, plus a small label 'פרסומת'.
- `'adsense'`: requires `adsense.client` and `adsConsent === true`. Otherwise fall back to `'house'` (if any creatives exist), else `'none'`.
  - Inject `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=<client>` once (async, crossorigin=anonymous), and render `<ins class="adsbygoogle" data-ad-client data-ad-slot data-ad-format="auto" data-full-width-responsive="true">`.
  - Documented requirement: AdSense needs an approved site. GitHub Pages sub-paths are generally not approvable, so this needs a custom domain.

**Placements:**
- **Disabled path (default):** `ads.enabled === false` or provider `'none'` → `renderSlot` sets `el.hidden = true` and empties it, `maybeInterstitial` resolves `false`, `canShowRewarded()` is `false`, no script/image is requested, and nothing is tracked. `css/app.css` MUST contain `[hidden]{display:none !important}` so no author rule on `.ad-slot` can make a hidden slot take space.
- `hub_banner`: `renderSlot(el,'hub_banner')` sets `el.hidden = false` only when it renders. `adslots.mountAdSlot` re-renders mounted slots on `onAdsChange`.
  - Impression: tracked when ≥ 50% visible (IntersectionObserver), once per render.
  - Click: tracked on click.
- `interstitial`: the UI calls `noteMatchday()` for each week with `hadMatchday`, then `maybeInterstitial({type:'matchday', week})` after the week-summary modal closes.
  - Shown when: enabled, ≥ `everyMatchdays` matchdays since the last one, ≥ `minMinutesBetween` minutes since the last one, and ≥ `skipFirstMinutes` minutes into the first session ever.
  - Full-screen overlay with the creative and a close button that becomes active after 3 s ('סגור'). **Never shown during `#/match`.**
  - State is kept in `hy.ads` (`{lastAt, sinceMatchdays, firstSeenAt, rewarded:{day:'yyyy-mm-dd', n}}`).
- `rewarded` ("צפה בפרסומת וקבל +15 אנרגיה"): `canShowRewarded()` = enabled && provider ≠ 'none' && a house creative exists && `n < maxPerDay`.
  - `showRewarded(onReward)` shows the overlay with a 5 s countdown. On completion it calls `onReward()` and tracks `ad_rewarded`.
  - The UI then calls `game.grantReward('energy15')`. AdSense has no rewarded format here, so rewarded always uses house creatives.
  - The UI shows the rewarded button only if `ads.canShowRewarded() && hub.canReward && hub.player.energy < 70`, so the player never watches an ad the engine would refuse to reward.

### 8.6 Supabase schema (`supabase/schema.sql`, idempotent)

The script runs as one file in the SQL editor and can be run again safely: `create table if not exists`, `create or replace function`, `drop policy if exists` before `create policy`, `drop trigger if exists`, and `insert ... on conflict do nothing`.

```sql
create table if not exists public.devices (
  id text primary key, first_seen timestamptz not null default now(), last_seen timestamptz not null default now(),
  platform text, standalone boolean default false, app_version text, installed_at timestamptz,
  rate_window timestamptz not null default now(), rate_count int not null default 0, feedback_day date, feedback_count int not null default 0);
create table if not exists public.sessions (
  id text primary key, device_id text not null references public.devices(id) on delete cascade,
  started_at timestamptz not null default now(), last_seen timestamptz not null default now(),
  heartbeats int not null default 1, app_version text, standalone boolean default false);
create table if not exists public.events (
  id bigint generated always as identity primary key, device_id text not null, session_id text, name text not null,
  props jsonb not null default '{}', client_ts timestamptz, created_at timestamptz not null default now());
create table if not exists public.feedback (
  id bigint generated always as identity primary key, device_id text, rating smallint not null check (rating between 1 and 5),
  message text check (char_length(message) <= 2000), email text check (char_length(email) <= 200), context jsonb not null default '{}',
  app_version text, is_read boolean not null default false, created_at timestamptz not null default now());
create table if not exists public.app_config ( key text primary key, value jsonb not null, updated_at timestamptz not null default now(), updated_by text );
create table if not exists public.admins ( email text primary key, created_at timestamptz not null default now() );
-- indexes: events(created_at), events(name, created_at), sessions(last_seen), sessions(started_at), devices(first_seen), feedback(created_at desc)
-- seed: insert into app_config(key,value) values ('ads', <defaults>), ('announcement', ...), ('version', ...), ('feedback', ...) on conflict do nothing;
```

**RLS** (enable on all 6 tables):
- `app_config`: policy `select` for `anon, authenticated` using `(true)`. No insert, update, or delete policies.
- `devices`, `sessions`, `events`, `feedback`, `admins`: **no policies**, so they are fully denied to anon and authenticated. All access goes through security-definer functions.
- `revoke all on all tables in schema public from anon, authenticated;` and `revoke all on all sequences in schema public from anon, authenticated;` then `grant select on public.app_config to anon, authenticated;`.
- **Important (Supabase default privileges):** Supabase grants `EXECUTE` on every new function in `public` to `anon` and `authenticated` automatically. `revoke ... from public` alone is NOT enough. For every function the script runs `revoke execute on function <sig> from public, anon, authenticated;` and then the explicit grants below. Without this, anyone with the anon key could call `purge_old_events(0)` and wipe the data.

**Functions** (all `language plpgsql security definer set search_path = public, pg_temp`; schema-qualify `auth.*`, `net.*`, `vault.*`; revoke and grant as above):

| function | grant | returns |
|---|---|---|
| `is_admin() returns boolean` (`exists(select 1 from public.admins a join auth.users u on lower(u.email) = lower(a.email) where u.id = auth.uid() and u.email_confirmed_at is not null)`; the check uses the verified user row, not a JWT claim, so an unconfirmed sign-up with an admin's address gets nothing) | authenticated | boolean |
| `heartbeat(p_device text, p_session text, p_meta jsonb)` | anon, authenticated | `{"ok":true,"server_time":...}` |
| `track_events(p_device text, p_session text, p_events jsonb)` | anon, authenticated | `{"accepted":n,"dropped":m}` |
| `submit_feedback(p_device text, p_rating int, p_message text, p_email text, p_context jsonb)` | anon, authenticated | `{"ok":true,"id":n}` |
| `admin_whoami()` | authenticated | `{"is_admin":bool,"email":text}` |
| `admin_stats(p_days int default 30, p_tz text default 'Asia/Jerusalem')` | authenticated (raises `'forbidden'` unless `is_admin()`) | AdminStats |
| `admin_feedback(p_limit int default 50, p_offset int default 0, p_unread_only boolean default false)` | authenticated + admin | `{"total":n, "unread":m, "rows":[{id, created_at, rating, message, email, context, app_version, is_read, device_id}]}` (rows newest first; `total` counts rows matching the filter, for paging) |
| `admin_mark_read(p_id bigint, p_read boolean default true)` | authenticated + admin | `{"ok":true}` |
| `admin_get_config()` | authenticated + admin | `{"ads":{...},"announcement":{...},"version":{...},"feedback":{...}}` |
| `admin_set_config(p_key text, p_value jsonb)` | authenticated + admin | `{"ok":true,"key":...,"updated_at":...}`; `p_key` must be one of the 4 keys, `jsonb_typeof(p_value) = 'object'`, and `octet_length(p_value::text) ≤ 32768` (else `{"ok":false,"error":"bad_value"}`); upsert; `updated_by = auth.jwt()->>'email'` |
| `purge_old_events(p_days int default 180)` | none (postgres/cron only) | deleted count |

**Validation:**
- Admin functions start with `if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;` (PostgREST returns 403 for an authenticated non-admin, 401 for anon). The check is inside every admin function; the UI-side check (`admin_whoami`) is only cosmetic.
- `p_device` and `p_session` are 8..64 chars of `[A-Za-z0-9-]`. Otherwise, return `{ok:false}` / accepted 0 (never raise to the client).
- `p_meta` larger than 1 KB is replaced by `{}`; `platform` and `app_version` are truncated to 16 / 20 chars.
- **`heartbeat`:**
  - Upsert the device (`last_seen`, platform, standalone, app_version).
  - Upsert the session (`last_seen = now()`, `heartbeats + 1`). Ignore the update if the last update was < 20 s ago.
- **`track_events`:**
  - Upsert the device.
  - Rate limit: max 600 events per device per rolling hour (`rate_window`/`rate_count`). Max 50 per call.
  - Each event name must match `^[a-z_]{2,32}$`; `props` must be ≤ 2048 bytes (`octet_length(props::text)`).
  - `client_ts` is clamped to [now − 7 days, now + 1 hour].
  - For name `install`: `update devices set installed_at = coalesce(installed_at, now())`.
- **`submit_feedback`:**
  - Rating 1..5. Message trimmed and truncated to 2000. Email: empty → null.
  - Max 5 per device per day (`feedback_day`/`feedback_count`).
  - `app_version` comes from `p_context->>'v'`.

**`AdminStats`** (exact JSON keys):
```json
{ "generated_at": "...", "days": 30,
  "online_now": 0,                       // sessions with last_seen > now() - 2 min
  "total_devices": 0, "dau": 0, "wau": 0, "mau": 0,   // distinct devices with a session last_seen within 1/7/30 days
  // All "day" / "today" boundaries use p_tz (default Asia/Jerusalem): day = (ts at time zone p_tz)::date. Rolling windows (online, dau/wau/mau, *_7d) use now() - interval.
  "new_per_day":    [{"day":"2026-10-01","count":0}],  // p_days entries, oldest first, zero-filled (generate_series), by devices.first_seen
  "active_per_day": [{"day":"2026-10-01","count":0}],  // distinct devices with session activity that day (started_at or last_seen)
  "sessions_today": 0, "avg_session_sec_today": 0, "avg_session_sec_7d": 0,   // duration = last_seen - started_at
  "installs_total": 0, "installs_7d": 0,
  "careers_started": 0, "matches_played": 0, "seasons_completed": 0, "retirements": 0, "transfers": 0,   // event counts (all time)
  "careers_7d": 0, "matches_7d": 0,
  "top_nations":   [{"key":"isr","count":0}],    // from career_started props->>'nation', top 10
  "top_positions": [{"key":"ST","count":0}],
  "top_clubs":     [{"key":"isr_mhaifa","count":0}],
  "rating_avg": 0.0, "rating_count": 0, "rating_dist": {"1":0,"2":0,"3":0,"4":0,"5":0},
  "feedback_total": 0, "feedback_unread": 0,
  "ads": { "impressions_total":0, "clicks_total":0, "impressions_7d":0, "clicks_7d":0, "rewarded_7d":0,
           "by_placement":[{"placement":"hub_banner","impressions":0,"clicks":0}] },
  "platforms": [{"key":"android","count":0}], "versions": [{"key":"1.0.0","count":0}]    // devices by platform / app_version
}
```
- Arrays are never `null` (use `[]`); numbers are never `null` (use `0`; `rating_avg` is `0` when there is no feedback, rounded to 2 decimals); `rating_dist` always has the 5 keys.
- Dashboard mapping (exact): `kpi-online` ← online_now, `kpi-devices` ← total_devices, `kpi-dau/wau/mau` ← dau/wau/mau, `kpi-installs` ← installs_total (subtitle installs_7d), `kpi-careers` ← careers_started, `kpi-matches` ← matches_played, `kpi-rating` ← rating_avg + rating_count, plus tiles for sessions_today, avg_session_sec_today (mm:ss), seasons_completed, retirements, feedback_unread. CTR = clicks / impressions (show '–' when impressions = 0).

**Optional email notification** (in the schema file, always created, inert until configured):
- `notify_feedback_email()` is an `after insert on feedback` trigger function, wrapped entirely in `begin ... exception when others then raise warning ...; end;` so feedback inserts can never fail.
- It does nothing unless **all** of these hold:
  - `to_regproc('net.http_post') is not null` (the pg_net extension is enabled);
  - vault secrets exist: `select decrypted_secret from vault.decrypted_secrets where name = 'resend_api_key'` and `'feedback_email_to'`. The optional `'feedback_email_from'` defaults to `'onboarding@resend.dev'`. Reading `vault` is guarded by `to_regclass('vault.decrypted_secrets') is not null`.
- When configured, it calls `net.http_post(url := 'https://api.resend.com/emails', headers := jsonb_build_object('Authorization','Bearer '||key,'Content-Type','application/json'), body := jsonb_build_object('from',from,'to',jsonb_build_array(to),'subject','משוב חדש ('||rating||'★) - הילד מהשכונה','html', <escaped html with rating, message, email, context, created_at>))`.
- Trigger: `drop trigger if exists trg_feedback_email on feedback; create trigger ... for each row execute function notify_feedback_email();`.

**Optional retention:** a `do $$ begin if exists (select 1 from pg_extension where extname='pg_cron') then perform cron.schedule('hy-retention','15 3 * * *', 'select public.purge_old_events(180)'); end if; end $$;` block (unschedule first if it exists).

### 8.7 Admin dashboard (`admin.html`, `js/admin/*`, `css/admin.css`)

**Page setup:**
- Hebrew RTL, mobile-first, dark theme consistent with the game.
- `<meta name="robots" content="noindex,nofollow">`.
- Loads `./js/admin/admin.js` as a module, which imports `../config.js` and `../core/supa.js`.
- If `!BACKEND_ENABLED`: a full-page message "הבקאנד עוד לא מוגדר. ראה docs/ADMIN_SETUP.md".
- **Security (XSS):** feedback messages, emails, and context come from anonymous players. Every user-supplied string is rendered with `textContent` (or `esc()`), never `innerHTML`. The email link is built only if the address matches the email regex: `href = 'mailto:' + encodeURIComponent(email)`. House-ad fields shown in the config editor go into `value` attributes only.
- Any RPC that fails with 401, or with 403 after a token refresh, signs out and routes to `#/login`.
- Note in ADMIN_SETUP: the session lives in `localStorage` on the shared `moshe0408.github.io` origin, so the owner should use 'התנתק' on shared devices.

**`#/login`:**
- Email and password fields → `auth.signIn`, then `rpc('admin_whoami')`.
- If not admin: 'למשתמש הזה אין הרשאת מנהל', then sign out.
- The session is persisted in `hy.admin.session` and refreshed automatically.

**`#/dash`:**
- **KPI tiles:**
  - Players: online now, total devices, DAU/WAU/MAU, installs.
  - Engagement: sessions today, average session length (mm:ss), careers started, matches played, seasons completed, retirements.
  - Ratings and feedback: average rating (★), unread feedback.
- **Charts:**
  - 30-day line or bar chart (inline SVG) of new players per day and active per day.
  - Rating distribution bars.
  - Top-10 lists for nations, positions, and clubs, with Hebrew names resolved via `js/data/countries.js`, `leagues.js`, and `strings.js` imports.
  - Ads block: impressions and clicks, CTR, and per placement.
  - Platforms and versions.
- Auto-refresh "online now" every 60 s; the full refresh button is 'רענן'.

**`#/feedback`:**
- List, newest first: stars, message, email (as a mailto link), context summary (version / season / club), date (shown in Israel time), and a read/unread toggle (`admin_mark_read`).
- Filter 'רק שלא נקראו'. Paging with 50 per page using `total` from `admin_feedback`.

**`#/config`:**
- Form editors built from `admin_get_config()` deep-merged onto `REMOTE_DEFAULTS` (imported from `../core/remote.js`), so missing keys show their defaults:
  - **Ads:** enabled toggle, provider select, placement toggles and caps, house-ads list editor (add/remove rows: id, imageUrl, link, textHe, weight, placements), AdSense client and slots.
  - **Announcement:** enabled, id (auto-generated on text change), text, link, level.
  - **Version:** min, latest, message.
  - **Feedback:** enabled, prompt.
- Each block has a save button → `admin_set_config` → toast 'נשמר ✓'. Also show a 'raw JSON' view per block.

**Logout** button. All admin DOM test ids are listed in §9.8.

### 8.8 `tests/mock-supabase.mjs` (zero-dependency, in-memory)

- Usage: `node tests/mock-supabase.mjs [port=54321] [--admin admin@test.local:test1234]`.
- Implements, with the same paths, bodies, and JSON shapes as Supabase:
  - `OPTIONS *` → 204 with CORS headers: `Access-Control-Allow-Origin: *`, `-Headers: apikey, authorization, content-type, prefer, x-client-info`, `-Methods: GET,POST,PATCH,DELETE,OPTIONS`.
  - `POST /auth/v1/token?grant_type=password|refresh_token`, `POST /auth/v1/logout`, `GET /auth/v1/user`.
  - `GET /rest/v1/app_config?select=...`.
  - `POST /rest/v1/rpc/{heartbeat|track_events|submit_feedback|admin_whoami|admin_stats|admin_feedback|admin_mark_read|admin_get_config|admin_set_config}`.
- Requires an `apikey` header (any non-empty value) → otherwise 401. Admin RPCs require a Bearer token issued by the mock for an admin email → otherwise 401/403 (`{"code":"42501","message":"forbidden"}`).
- `admin_stats` returns the full AdminStats shape computed from in-memory data.
- Test helpers: `GET /__mock/state` returns `{devices, sessions, events, feedback, app_config}` and `POST /__mock/reset` clears it and re-seeds `app_config` with the same 4 default rows as `schema.sql` (ads disabled).
- Prints `mock-supabase listening on http://localhost:<port>`.

### 8.9 `docs/ADMIN_SETUP.md` (Hebrew, step by step, for the owner)

The guide must cover these steps and topics:
1. Create a free Supabase project (region near Israel, e.g. Frankfurt) and save the DB password.
2. SQL Editor → paste the whole `supabase/schema.sql` → Run (it is safe to run again after updates).
3. Authentication → Users → Add user (email and password, **Auto Confirm User must be ticked**: `is_admin()` only accepts confirmed users). Then in the SQL editor: `insert into public.admins(email) values ('you@example.com');`. Recommend disabling public sign-ups (Auth → Providers → Email → disable "Allow new users to sign up"), because admins are created manually.
4. Project Settings → API (or API Keys) → copy the Project URL and the anon / publishable key into `js/config.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). Bump `APP_VERSION` and `VERSION` in `sw.js`, then run `publish.ps1`. Explain that the anon key is meant to be public and that the data is protected by RLS.
5. Open `https://moshe0408.github.io/hayeled/admin.html` and log in. Explain each dashboard number.
6. **Email notification for feedback** (optional; answers "do I need an email"):
   - Without email, feedback is visible in the dashboard.
   - To also receive email: open a free Resend account, verify the address or domain, create an API key, enable the `pg_net` extension (Database → Extensions), then store the secrets in Vault: `select vault.create_secret('<key>','resend_api_key'); select vault.create_secret('you@example.com','feedback_email_to');` and optionally `feedback_email_from` with a verified domain.
   - Without a verified domain, Resend only sends to the account's own email from `onboarding@resend.dev`.
   - How to test the setup.
7. Optional retention with pg_cron.
8. **Enabling ads later:** in the admin Config tab, set provider `house`, add sponsor banners (image URL + link), and turn on `enabled`. The effect is immediate and needs no deploy. AdSense needs a custom domain (e.g. hayeled.co.il → GitHub Pages custom domain), site approval, and a privacy policy and consent; then set the client and slot ids and provider `adsense`. A rewarded ad works with house ads.
9. **Privacy note:** what is collected (anonymous device id, sessions, game events, voluntary feedback and email); what is not collected (names, location, contacts); the in-game opt-out toggle; the 180-day retention.
10. Troubleshooting: 401 means a wrong key; "forbidden" means the email is not in `admins` (or the user is not confirmed); CORS issues; a free project pauses after 7 days of inactivity (open the dashboard to wake it). While paused, the game keeps working and queues telemetry/feedback locally.
11. A short "what to do next" summary at the top of the file in plain Hebrew: (a) is an email needed? No; feedback appears in the dashboard. Email is only for optional notifications. (b) The admin link. (c) Ads are off until switched on in the Config tab.

---

## 9. UI (UI agent)

### 9.1 `index.html`

- `<!doctype html><html lang="he" dir="rtl">`.
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- `<meta name="theme-color" content="#0b1220">`.
- `<link rel="manifest" href="./manifest.webmanifest">`, `<link rel="icon" href="./icons/icon.svg" type="image/svg+xml">`, `<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">`.
- `apple-mobile-web-app-capable=yes`, `mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=black-translucent`, `apple-mobile-web-app-title=הילד מהשכונה`.
- `description` meta.
- Google Fonts: preconnect to `fonts.googleapis.com` and `fonts.gstatic.com` (crossorigin), then `https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;900&family=Rubik:wght@500;700;900&display=swap`.
- `<link rel="stylesheet" href="./css/app.css">`.
- Body: a boot splash inside `<div id="app">` (logo + 'טוען...'), a `<noscript>` Hebrew message, and `<script type="module" src="./js/main.js"></script>`.

### 9.2 `js/main.js` boot sequence

1. `save.configure({ schemaVersion: game.SCHEMA_VERSION, appVersion: APP_VERSION, migrate: game.migrateState })`, then `await save.initStorage()`.
2. Register the SW (§7.8) and wire the update banner.
3. `initTelemetry({appVersion})`. Apply the remote config from cache, then `loadRemoteConfig()` in the background.
   - Then `initAds(cfg.ads, {track, adsConsent: settings.adsConsent})`.
   - Show the announcement banner if it is enabled and its id is not in `settings.dismissed`.
   - Run the version check.
4. `initInstall()` (capture `beforeinstallprompt`).
5. If `settings.lastSlot` has a valid save: `loadSlot` → `game.loadState`, then route.
   - `hub.status === 'match'` → `#/match`.
   - `'review'` → `#/season`.
   - `'retired'` → `#/retire`.
   - Otherwise `#/hub`, unless the URL already has a valid in-game hash.
   - `'in_week'` → `#/hub` (its main button resumes the week).
   - Without a save → `#/title`.
   - If `LoadResult.repaired` is true, show a toast: 'שחזרנו את השמירה שלך מהגיבוי במכשיר ✓'.
   - If `error:'corrupt'` → `#/title`, toast with `messageHe`; the slot card shows 'השמירה נפגמה' with 'שחזר שמירה קודמת' and 'ייבוא גיבוי'. If `error:'too_new'` → show the update banner and run `reg.update()`; do not load or save that slot.
   - Reaching `#/hub` with a career for the first time in this page load (or creating a career): if `navigator.storage.persisted()` is false, call `save.requestPersist()`.
6. **Autosave:** `game.subscribe(() => scheduleSave())`, debounced to 400 ms.
   - `saveNow()` = `save.saveSlot(activeSlot, game.serialize(), game.getSaveMeta(), { onQuota: lvl => game.compactState(lvl) })`.
   - After each facade call, run `telemetry.trackSignals(game.getAndClearSignals())`. Wrap facade calls in `app.call(fn)` so this always happens and errors become a toast instead of crashing.
7. On `visibilitychange` (hidden), `pagehide`, and `freeze`: `saveNow()`, `save.flushPending()`, `telemetry.flush({keepalive:true})`.
8. `save.onWarning(w => toast(w.messageHe))`. `save.onExternalWrite(...)` → the blocking "other tab" modal (§7.3).
9. After the first career is created: `save.requestPersist()`. New career flow: (`saveNow()` + `flushPending()` for any current career) → if the chosen slot is occupied, `await save.deleteSlot(slot)` → `game.newCareer(...)` → `activeSlot = slot`, `settings.lastSlot = slot` → `saveNow()` immediately (not debounced).
9a. **Hall of Fame safety net:** in the `game.subscribe` callback, the first time `getHub().status === 'retired'` is seen for a career, call `save.addHallOfFame(game.buildHallOfFameEntry())` (idempotent), so a forced retirement during fast-forward is recorded even if `#/retire` is never opened.
9b. `remote.onRemoteConfig(cfg => { initAds(cfg.ads, …); announcement + version checks })` (§8.4).
10. Expose a debug handle (always on, harmless): `window.__hy = { game, save, telemetry, remote, ads, feedback, version: APP_VERSION, saveNow }`.

### 9.3 Routes (hash router)

| route | screen | notes |
|---|---|---|
| `#/title` | Title | Logo, tagline, 3 slot cards (meta or 'משבצת ריקה'), buttons 'המשך קריירה' (last slot), 'קריירה חדשה', 'היכל התהילה', 'הגדרות'. Each slot card has a menu: load / delete (confirm + note that recovery is possible) / restore deleted. |
| `#/new` | Create wizard | Steps: (1) first, last, nickname (suggestion chips), (2) nation (search + grid with flags, Israel first), (3) position (pitch diagram with tappable positions + list) and foot, (4) academy club (grouped by league; a note if the nation has no league), (5) slot choice if needed + summary + 'צא לדרך!'. Then show the ScoutReport in a modal ("דו״ח סקאוט") → `#/hub`. |
| `#/hub` | Home | See §9.4. |
| `#/match` | Match | See §9.5. |
| `#/season` | Season review | `getSeasonReview()` → 'המשך' calls `ackSeasonReview()`. If `canRetire`, also offer 'לפרוש' (confirm). Feedback prompt hook (§9.7). |
| `#/inbox` | Messages | WhatsApp-like list: avatar, name, preview, time, unread dot, 'מחכה לתשובה' badge. |
| `#/chat/:id` | Chat | Bubbles (theirs on the right in RTL, mine on the left, green), choice buttons at the bottom. Answering shows a typing indicator for 600 ms, then the followUp and an effects toast. |
| `#/schedule` | לוח | Season fixtures grouped by month. Played fixtures show score and rating chip. Tapping a past player match shows its summary if it is the last match. |
| `#/tables` | טבלאות | Competition picker (mine first, then leagues by country, Europe). |
| `#/tables/:compId` | Table / bracket | Table with zone colours + legend. Bracket view for knockouts. Segmented control if both exist. |
| `#/career` | קריירה | Tabs: ציר זמן (timeline), עונות (season table), תארים (trophies + awards), מועדונים. Link to `#/awards` and `#/profile`. |
| `#/profile` | Profile | Attribute bars, OVR badge, potential stars + range, status bars, contract card, value, owned items. Buttons 'בקש העברה' / 'בטל בקשת העברה' and 'לפרוש' (if allowed). |
| `#/national` | Nation | Level, caps, upcoming, qualifier table, tournament group/bracket, history. |
| `#/offers` | Offers | Offer cards (club badge, league, type chip, fee, wage/week, years, role, release clause, comparison lines). Actions: accept (confirm), reject, negotiate (sheet: wage +10/+20/+35%, years stepper, role select, release clause select). |
| `#/awards` | Awards | Personal awards list; Ballon d'Or history (rank + top 3); benchmarks. |
| `#/shop` | Shop | Categories with item cards; buy / sell with confirm. |
| `#/hof` | Hall of Fame | `save.loadHallOfFame()` entries sorted by legacy, with tier, trophies icons, and detail modal. Works without a career. |
| `#/settings` | Settings | See §9.6. |
| `#/feedback` | Feedback | Stars (1-5, required), textarea, optional email with the hint 'אם תרצה שנחזור אליך', send. Success state 'תודה! קיבלנו ❤️' (`fb-done`). If the result is `queued`, the success state adds 'המשוב יישלח אוטומטית כשתחזור לרשת'. Reads `rating` and `trigger` from the route query. Context = `{ v: APP_VERSION, platform, standalone, trigger, ...(career ? { season, seasons, age, ovr, club } from getSaveMeta() : {}) }`. |
| `#/install` | Install guide | Android: a 'התקן' button if `beforeinstallprompt` was captured, else instructions (⋮ → 'הוספה למסך הבית'). iOS Safari: Share → 'הוסף למסך הבית', with simple inline SVG illustrations, **plus the separate-storage warning and a 'העתק קוד גיבוי' button when a career exists (§7.6)**. Shows 'כבר מותקן ✓' when standalone. |
| `#/retire` | Retirement | `getRetirement()`: farewell lines, legacy score and tier, totals, trophies. On entering: `save.addHallOfFame(game.buildHallOfFameEntry())` (idempotent). Buttons: 'להיכל התהילה', 'הקריירה שלי' (`#/career`, read-only browsing still works), 'קריירה חדשה', 'שלח משוב' (and the prompt, §9.7). Redirects to `#/hub` if the career is not retired. |

**Bottom tab bar** (fixed, safe-area padding, 5 tabs, ≥ 56 px): בית `#/hub`, לוח `#/schedule`, טבלאות `#/tables`, קריירה `#/career`, הודעות `#/inbox` (with unread badge).
- The tab bar is hidden on `#/title`, `#/new`, `#/match`, `#/retire`, and `#/install`.
- Header: screen title, back button where relevant, and a settings gear on the hub.

### 9.4 Hub layout (top to bottom)

1. **Status header:** name, club badge, age, position, OVR circle, and stars. Bars for energy, morale, and form (last 5 ratings as chips). Money.
2. **Announcement banner** (remote) and update banner, if any.
3. **This week card:** fixtures with selection chips. The main button (`btn-advance`) depends on `hub.status`:
   - `'idle'`: **'שחק את השבוע'** → `advanceWeek(training)`.
   - `'in_week'`: 'המשך את השבוע' → `resumeWeek()`.
   - `'match'`: 'למשחק' → `#/match`.
   - `'review'`: 'סיכום העונה' → `#/season`.
   - `'retired'`: never shown (the router sends the user to `#/retire`).
   - Result `status:'match'` → `#/match`; `'done'` → week summary modal; `ok:false` → toast `messageHe` and re-render from `getHub()`.
4. **Training selector:** horizontal chips from `hub.training.options`.
5. **Fast-forward button** `⏩` opens a sheet: 'עד המשחק הבא', 'עד סוף העונה', 'דלג על הקיץ' (if summer). It calls `fastForward({..., maxWeeks: 2})` in a loop, yielding (`await new Promise(r => setTimeout(r, 0))`) and updating a progress overlay ('שבוע 12...') between chunks, until `stopped !== 'chunk'`. Signals are forwarded after every chunk. It calls `ads.noteMatchday()` once for every collected summary with `hadMatchday` except the last one (whose modal close counts it). Then, if `hub.status === 'match'` → `#/match`; otherwise it shows the last summary in the week summary modal, whose close follows the order below (retire → season review → ads). A 'עצור' button on the overlay stops after the current chunk.
6. **Alerts list** (tappable routes).
7. **Ad slot:** `<div class="ad-slot" data-placement="hub_banner" hidden></div>`. It is mounted via `adslots.mountAdSlot` and takes zero height when hidden.
8. **Quick links grid:** הצעות (badge), נבחרת, פרופיל, חנות, פרסים, היכל התהילה.
9. **Rewarded button:** shown only if `ads.canShowRewarded()`, `hub.canReward`, and energy < 70: 'צפה בפרסומת וקבל +15 אנרגיה'.

**Week summary modal** (`week-summary`): results list, training line, OVR change, highlights, and counts of new messages and offers. On close (`btn-week-ok`), in this order:
1. If `summary.retiredNow` (or `getHub().status === 'retired'`) → `#/retire` (no ads).
2. Else if `summary.seasonEnded` → `#/season` (no interstitial at this moment; `noteMatchday` still counts).
3. Else `adslots.afterWeekAds(summary)`, i.e. `noteMatchday` + `maybeInterstitial`.

### 9.5 Match screen flow

- **Phase `pre`:** scoreboard (badges, names, competition, round), role chip ('בהרכב' / 'נכנס מהספסל בדקה X'), and intro text. Buttons 'יאללה!' (`startMatch`) and 'שחק אוטומטית' (`btn-autoplay`).
- **Phase `live`:**
  - Sticky scoreboard with minute, a commentary feed (log), and the current moment card: setup text plus 2-3 big option buttons (`moment-opt-<i>`), each with an odds chip (נמוך red / בינוני amber / גבוה green).
  - Tap → `chooseMoment(i)` → outcome animation. On a goal: a 'גוללל!' flash (CSS only). Show the rating delta.
  - Button 'שחק אוטומטית' at the bottom.
- **Phase `ended`:** full-time card. 'סיכום' (`btn-finish-match`) → `finishMatch()` shows the summary (rating big, goals, assists, MOTM badge, effects) → 'המשך' calls `resumeWeek()`.
  - `'match'` again → render the new match.
  - `'done'` → `#/hub` + week summary modal.
- Respect `prefers-reduced-motion`. Never show ads on this screen.

### 9.6 Settings screen (`#/settings`) and `hy.settings`

`hy.settings` = `{ lastSlot: 1|2|3|null, reduceMotion: false, haptics: true, adsConsent: false, dismissed: [], installDismissedAt: null }`

**Sections:**
1. **'השמירה וההתקדמות שלך'** (Hebrew explainer, binding meaning):
   - The progress is saved automatically after every action, on this device, in two places in the browser (localStorage + IndexedDB). If one is damaged, it is restored from the other.
   - It is not saved on a server. Deleting browser data / site data deletes it.
   - To move to another phone or keep a copy: 'ייצוא קובץ' or 'העתק קוד גיבוי', then import on the new device.
   - It is recommended to install the game to the home screen (it reduces the chance of deletion on iPhone: Safari may erase site data after ~7 days without a visit).
   - On iPhone, the installed app and Safari keep **separate** progress: export a backup code before installing and import it inside the app (§7.6).
   - 'שחזר שמירה קודמת' returns to the save from the start of the previous game week (one step back; it can be undone by restoring again).
   - Then: storage status line (§7.6) + 'בקש הגנה על האחסון' button.
2. **Backup:** per slot: 'ייצוא קובץ' (`btn-export-file`), 'העתק קוד' (`btn-export-code` → modal with `export-code-text` textarea + copy button; `navigator.clipboard.writeText` with a select-all fallback), 'שחזר שמירה קודמת' (`btn-restore-prev-<slot>`, confirm; follow the active-slot rule of §7.3). Global: 'גיבוי מלא (כל המשבצות + היכל התהילה)', and import: file picker (`inp-import-file`) or paste code (`inp-import-code` + `btn-import-code`). Choose the target slot; confirm overwrite (the old career goes to the recoverable deleted copy).
3. **Privacy:** toggle 'שתף נתוני שימוש אנונימיים' (`toggle-telemetry`) + note: "אנחנו אוספים נתונים אנונימיים בלבד (מזהה מכשיר אקראי, כמה זמן משחקים, אירועים במשחק) כדי לשפר את המשחק. בלי שם, בלי מיקום, בלי אנשי קשר." The ads-consent toggle is shown only if the remote provider is `adsense`.
4. **Install:** link to `#/install` (hidden when standalone).
5. **Feedback:** 'שלח משוב' → `#/feedback`.
6. **Display:** reduce motion, haptics (`navigator.vibrate` on moments).
7. **About:** version `APP_VERSION`, 'בדוק עדכונים' (`reg.update()`), credits.
8. **Danger zone:** 'מחק משבצת' per slot (double confirm; recoverable via the title-screen menu).

### 9.7 Feedback prompts and ads placement summary

- **After the first season's review is closed:** if `feedback.shouldPrompt('season1')`, then `openFeedbackPrompt('season1')`.
  - It is a bottom sheet (`fb-prompt`): "איך המשחק עד עכשיו?" with 5 stars. Tapping a star goes to `#/feedback?rating=n&trigger=season1`. 'לא עכשיו' (`btn-fb-later`).
  - `markPrompted('season1')` on show.
- **On `#/retire`:** if `shouldPrompt('retired')`, show the same sheet (stars link to `#/feedback?rating=n&trigger=retired`) and `markPrompted('retired')`.
- **Ads:**
  - Hub banner: hub only.
  - Interstitial: only after closing the week summary modal on the hub.
  - Rewarded: hub energy area only.
  - None of them in the match, create wizard, settings, feedback, install, season review, or retire screens.
  - With ads disabled (the default), no DOM space is used, no ad script or image is requested, and the hub looks exactly as if ads did not exist.

### 9.8 DOM test ids (`data-testid`, required; e2e depends on them)

| Screen | Test ids |
|---|---|
| Title | `btn-new-career`, `btn-continue`, `slot-1`, `slot-2`, `slot-3`, `btn-hof`, `btn-settings` |
| Create | `inp-first`, `inp-last`, `inp-nick`, `nation-<id>`, `pos-<id>`, `foot-R`, `foot-L`, `club-<id>`, `btn-next`, `btn-start`, `scout-report`, `btn-scout-ok` |
| Hub | `hub`, `btn-advance`, `btn-ff`, `ff-next-match`, `ff-season-end`, `ff-skip-summer`, `training-<id>`, `hub-ovr`, `hub-energy` |
| Tabs | `tab-hub`, `tab-schedule`, `tab-tables`, `tab-career`, `tab-inbox`, `inbox-badge` |
| Week / season | `week-summary`, `btn-week-ok`, `season-review`, `btn-season-ok`, `btn-season-retire` |
| Match | `match`, `match-score`, `btn-start-match`, `moment-opt-0`, `moment-opt-1`, `moment-opt-2`, `btn-autoplay`, `btn-finish-match`, `match-summary`, `btn-match-continue` |
| Inbox | `inbox-item-<id>`, `chat-choice-<i>` |
| Offers | `offer-<id>`, `btn-offer-accept-<id>`, `btn-offer-reject-<id>`, `btn-offer-negotiate-<id>` |
| Settings | `btn-export-file-<slot>`, `btn-export-code-<slot>`, `export-code-text`, `inp-import-code`, `btn-import-code`, `inp-import-file`, `toggle-telemetry`, `persist-status`, `btn-restore-prev-<slot>` |
| Feedback | `fb-star-1` … `fb-star-5`, `fb-text`, `fb-email`, `btn-fb-send`, `fb-done`, `fb-prompt`, `btn-fb-later` |
| Retire / HoF | `retire-screen`, `btn-retire` (profile), `hof-list`, `hof-item-<careerId>` |
| Global | `toast`, `modal`, `btn-confirm-yes`, `btn-confirm-no`, `update-banner`, `announcement` |
| Ads | `.ad-slot[data-placement="hub_banner"]`, `ad-house-link`, `ad-interstitial`, `btn-ad-close`, `btn-rewarded` |
| Admin | `adm-email`, `adm-password`, `adm-login`, `adm-error`, `kpi-online`, `kpi-devices`, `kpi-dau`, `kpi-wau`, `kpi-mau`, `kpi-installs`, `kpi-careers`, `kpi-matches`, `kpi-rating`, `chart-new`, `fb-row-<id>`, `btn-mark-read-<id>`, `cfg-ads-enabled`, `cfg-ads-provider`, `cfg-house-add`, `btn-save-ads`, `cfg-ann-text`, `btn-save-announcement`, `nav-dash`, `nav-feedback`, `nav-config`, `btn-logout` |

### 9.9 Visual design

**Theme (CSS variables):**
- `--bg:#0b1220; --bg2:#111a2e; --card:#16213a; --line:#24304d; --text:#eef3ff; --muted:#93a1c0;`
- `--pitch:#1fbf5a; --pitch2:#0e8f3e; --gold:#f5c542; --red:#ff5a5f; --amber:#ffb020; --blue:#4da3ff;`
- Night-stadium radial-gradient header and subtle pitch-line patterns via CSS only.

**Typography:** Heebo for body text, Rubik for numbers and headings. Fallback stack `system-ui, -apple-system, "Segoe UI", Arial, sans-serif`.

**Layout and behaviour:**
- Mobile-first with a max content width of 520 px, centred on desktop.
- Tap targets ≥ 44 px. `env(safe-area-inset-*)` paddings. No horizontal overflow at 320 px width.
- Use logical CSS properties (`margin-inline-start`) for RTL. Numbers and scores sit in `<bdi>` or `dir="ltr"` spans so '2-1' renders correctly.

**Performance:**
- No framework. Render screens with the `h()` helper.
- Avoid layout thrash. Use CSS transforms for animations.
- Total CSS ≤ 60 KB. Initial JS parse should stay light: lazy-`import()` screen modules from the router.

---

## 10. Test contract

### 10.1 `tests/sim.mjs` (Engine): headless simulation via the facade only

**Usage:** `node tests/sim.mjs [--careers 12] [--seasons 25] [--seed 1] [--quick]`. With `--quick`, it runs 3 careers × 6 seasons, which is used during development and by Integrate before e2e.

**Per career** `i`:
1. Generate opts with `rngFor(seed, i, 'opts')`. Cover all positions, ≥ 4 nations including isr, eng, bra, and one nation without a league (e.g. `cro`), and ≥ 1 non-Israeli academy.
2. Call `newCareer({..., seed: hash32(seed, i), now: 0})`.
3. Policy RNG = `rngFor(seed, i, 'policy')` (never `Math.random`).
4. Loop until retired or `season ≥ startSeason + seasons`. Each iteration does one week:
   - Random training.
   - `advanceWeek` → if `status:'match'`: alternate between `startMatch` + `chooseMoment(random)` loops and `autoPlayMatch`, then `finishMatch`, then `resumeWeek` until `'done'`.
   - Answer each inbox item needing an answer with a random enabled choice.
   - Respond to open offers (accept if the club strength is greater than the current club's by > 2 with probability 0.7, otherwise reject; negotiate in 10% of cases).
   - `ackSeasonReview` when pending.
   - Voluntary retirement at age ≥ 35 with probability 0.3 per season.
5. Every 3 seasons: `serialize` → `JSON.stringify` → measure size → `JSON.parse` → `loadState` (round-trip).

**Invariants** (any violation → print the details and `process.exitCode = 1`):
- No exceptions. Every facade VM is JSON-serialisable, and no number in it is `NaN` or `Infinity` (deep scan of every returned VM).
- `week ∈ 1..52`. The season increments exactly once per 52 weeks.
- Player value ranges:
  - All attributes are in `[1, 99]`, and OVR is in `[1, 99]`.
  - `energy`, `morale`, `trust`, `fans`, and `mates` are in `[0, 100]`.
  - `rep.*` is in `[0, 100]`, and `money ≥ 0`.
  - Ratings are in `[3.0, 10.0]`.
- Every league table at week 44:
  - Size matches the league size.
  - For every row: `p = w+d+l`, and `pts = 3w + d`, except for `halve` leagues, where `pts ≤ 3w + d`.
  - Σgf = Σga.
  - Every club played R_base + its split group's rounds.
  - Round count = format total.
- After promotion and relegation, league sizes are unchanged and every club appears in exactly one league.
- Europe:
  - Each competition's league phase has 36 distinct teams, and every team has 8 matches.
  - No club appears in two European competitions in a season.
  - Exactly 1 winner per competition per season, and the winner is in that competition.
- Domestic cups: exactly 1 winner per season, and it is a club of that country.
- The player never has 2 fixtures in the same `(week, slot)`.
- `player.club` matches `contract.club` (or both are null if free). While on loan, `parent` is non-null.
- `hist.seasons.length` equals the number of completed seasons.
- Serialized JSON is ≤ 1.5 MB at all times (report the max; warn above 600 KB).
- **Signals:**
  - `career_started` exactly once per career.
  - `season_completed` once per completed season.
  - `retired` at most once, and present if the career retired.
- **Determinism:** career 0 is run twice (fresh process state, same seed and policy), and `hash32(JSON.stringify(serialize()) without createdAt)` must be identical. Additionally, run career 0 a third time with a save → load round trip every season; the final hash must equal the plain run.
- `buildHallOfFameEntry()` after retirement returns a valid `HofEntry` with a finite legacy.
- Σ `hist.clubs[].apps` equals the career total of club apps (lg + cup + eu + yth lines over all seasons); every spell except the last has `to !== null`.
- No rendered string in any VM or inbox item contains an unfilled `{placeholder}` (regex `/\{[a-z0-9]+\}/`).
- Getter purity: calling every `get*` function twice in a row returns deep-equal VMs and leaves `hash32(JSON.stringify(serialize()))` unchanged.
- Chunked fast-forward (`maxWeeks: 2` loop) for one season produces the same final state hash as one unchunked call from the same saved state.
- With the player transferred mid-season at least once in the run, Europe/cup/league invariants still hold and he has no duplicate `(week, slot)` fixtures.
- **Performance:** average wall time per simulated season ≤ 1.0 s (warn) / ≤ 3.0 s (fail).

**Report:** a JSON summary printed at the end with careers, seasons, retire ages, trophies, awards, average goals per match by position, average rating, league goals per match, home win %, max save size, and timing. It also prints the calibration warnings (§5.19).

### 10.2 `tests/e2e.mjs` (Integrate): puppeteer-core with the installed Chrome or Edge

**Setup:**
- `tests/package.json` with `{"type":"module","private":true,"devDependencies":{"puppeteer-core":"^23"}}`. `node_modules` is gitignored.
- Browser path detection: `CHROME_PATH` env, then `C:\Program Files\Google\Chrome\Application\chrome.exe`, `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`, `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`, `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.
- The script itself spawns `tests/serve.mjs 8123 --base /hayeled/` and `tests/mock-supabase.mjs 54329`, and kills them at the end.
- Viewport 390×844, mobile UA, `deviceScaleFactor` 2.
- Before navigation, set `localStorage['hy.dev.backend'] = {"url":"http://localhost:54329","anonKey":"mock-anon"}` via `evaluateOnNewDocument`, only for the backend scenarios.
- **Fail on any `console.error`** or page error, and on any 404 under `/hayeled/`. Exceptions: favicon/fonts network errors, and the browser's own "Failed to load resource" / `net::ERR_INTERNET_DISCONNECTED` messages for mock/Supabase URLs during the offline scenario (app code itself must never `console.error` for expected network failures; use `console.warn` at most).

**Scenarios:**
1. **Boot:** open `http://localhost:8123/hayeled/`. The title renders. `document.dir === 'rtl'`. No horizontal overflow (`scrollWidth ≤ innerWidth`) at 390 and at 320 px width. The manifest link resolves, and its icons return 200.
2. **Create career** via the wizard (Israel, ST, the first club), then `scout-report` → hub visible with OVR.
3. **Play a week with a match:** advance until a match occurs (using `__hy.game.fastForward({until:'next_match'})` if needed). Play the moments by clicking `moment-opt-0`, then finish and continue. The week summary appears.
4. **Persistence:** reload the page. The hub shows the same season, week, and OVR (compare with `__hy.game.getSaveMeta()` before the reload).
5. **IDB recovery:** remove `hy.slot.1` and `hy.slot.1.prev` from localStorage, then reload. The career is restored (toast present), and LS has been rewritten.
6. **Corruption recovery:** overwrite `hy.slot.1` in LS with a truncated string, then reload. The career is restored from IDB or prev.
7. **Rollback:** use `btn-restore-prev-1` in settings → confirm → the week goes back by ≥ 0 and the app still works.
8. **Export/import:** export the code (`export-code-text` value starts with `HY1:` or `HY0:`), import it into slot 2, and the slot-2 meta equals slot 1.
9. **Season fast-forward:** `ff-season-end` → season review → `btn-season-ok` → feedback prompt is shown (backend scenario) → 'לא עכשיו'.
10. **Offline:** wait for `navigator.serviceWorker.ready` plus a controller (reload once). Then `page.setOfflineMode(true)` and reload: the hub still renders, and advancing a week works.
11. **Telemetry:** after the scenarios, `GET http://localhost:54329/__mock/state` contains events `app_open`, `career_started`, and `match_played`, plus ≥ 1 session row.
12. **Feedback:** submit 5 stars with text via `#/feedback`. The mock state has 1 feedback row with rating 5.
13. **Admin:** open `admin.html`, log in as `admin@test.local`/`test1234`. The KPI `kpi-devices` is ≥ 1 and the feedback row is visible. Mark it read. In Config: enable ads, choose provider `house`, add a house ad (image = `./icons/icon-192.png`, link `https://example.com`), and save.
14. **Ads:** reload the game. The hub banner `.ad-slot[data-placement="hub_banner"]` is visible with `ad-house-link`. With ads disabled (reset the mock), the slot has `hidden` and its height is 0.
15. **Retire** (fast path): `__hy.game` simulate to age 32 via `fastForward` loops (allowed to take ≤ 120 s; on each stop, answer pending inbox items and reject or accept offers via the facade, `ackSeasonReview()` on review, and continue; a forced retirement also satisfies the scenario), then `__hy.saveNow()`, reload, `btn-retire` → `retire-screen` → `#/hof` shows the entry. Delete the slot: the HoF entry is still present after a reload.
16. **Sub-path safety:** every request URL observed starts with `http://localhost:8123/hayeled/` (or is a font, mock, or ad URL).
17. **Two tabs:** open the game in a second page on the same slot and advance a week there; the first page shows the "other tab" modal and its next autosave does not overwrite the newer save.

Output: a pass/fail line per scenario, screenshots to `tests/out/*.png` (gitignored), and a non-zero exit on failure.

---

## 11. Integration checklist (Integrate agent runs this; every implementer self-checks their part)

**Static checks** (write them as a quick Node snippet or do them manually):
- [ ] Every file in §1 exists, and no extra JS files exist under `js/` (except as agreed in §1).
- [ ] `sw.js` PRECACHE equals exactly the set of game files in §1.1-§1.8 (script: walk `js/`, `css/app.css`, `icons/`, minus `js/admin/`). `VERSION` in sw.js equals `APP_VERSION` in config.js.
- [ ] No absolute URLs starting with `/` in `index.html`, `admin.html`, the manifest, `sw.js`, or any `import`/`fetch`/`src`/`href` (grep `"/js`, `'/css`, `href="/`).
- [ ] No `Math.random`, `Date.now`, `document`, `window`, `localStorage`, or `fetch` in `js/engine/**`, `js/data/**`, or `js/core/rng.js` (`game.js` may use `Date.now()` only as the default for `opts.now` / `createdAt` and for `HofEntry.createdAt`; `rng.js` may use `Date.now()`/`performance.now()`/`crypto` only inside `randomSeed()`).
- [ ] `supabase/schema.sql`: every function has an explicit `revoke execute ... from public, anon, authenticated` before its grants; `purge_old_events` and `notify_feedback_email` are granted to nobody; every security-definer function sets `search_path = public, pg_temp`.
- [ ] Admin views never use `innerHTML` with server data (grep `innerHTML` in `js/admin/`).
- [ ] `css/app.css` contains `[hidden]{display:none !important}`.
- [ ] No default exports anywhere. Every import path ends in `.js` and resolves.
- [ ] `node -e "import('./js/engine/game.js')"` works in Node 20 (no DOM access at import time). The same holds for `js/data/*.js`.
- [ ] `strings.js` has every key in §4.3. `commentary.js` covers every MomentType × option key and every ResultCode. Every event `who` is in PERSONAS, every `trigger` is in the trigger list, and each trigger has ≥ 1 event.
- [ ] `leagues.js` sizes match §3.2 exactly. Club ids are unique across leagues and fillers. Every `rival` id exists. Every country's `namePool` exists and every country has `colors`. `isr` is first in COUNTRIES. There are ≥ 100 fillers. Every split-league `groups` covers ranks 1..size exactly once and its round total equals the R in §3.2.
- [ ] Content events only use the placeholders of §4.1 and speakers that are `SpeakerId`s.
- [ ] All Hebrew UI text contains no real current player names.

**Runtime checks:**
- [ ] `node tests/sim.mjs --quick` passes, then the full `node tests/sim.mjs` passes (calibration warnings are reviewed and tuned if far off).
- [ ] `node tests/e2e.mjs` passes all scenarios.
- [ ] Manual: Chrome DevTools Lighthouse PWA/installability check at `/hayeled/` (manifest, SW, icons, maskable). An iOS meta tags sanity check.

**Wiring between agents:**
- [ ] UI → facade: every facade function used exists with the §6 signature. The UI never imports `js/engine/*` other than `game.js`.
- [ ] UI → telemetry: `trackSignals(game.getAndClearSignals())` runs after every facade call.
- [ ] The autosave debounce and the hide handlers are present.
- [ ] Feedback prompts run after season 1 and on retirement, gated by `shouldPrompt`.
- [ ] Ads: hub banner, interstitial after the week summary, and rewarded → `grantReward`. Nothing when disabled.
- [ ] Settings: export/import/rollback/persist status/telemetry toggle all work.
- [ ] Backend disabled (empty config) → zero network requests to anything except fonts. Verify in e2e scenario 1 by recording requests.

**Repo and publish files (Platform):**
- `.gitignore`: `node_modules/`, `tests/node_modules/`, `tests/out/`, `*.log`, `.DS_Store`, `Thumbs.db`.
- `.nojekyll`: empty file at the root (GitHub Pages then serves every file as-is).
- `README.md` (Hebrew + English short): what the game is, how to run locally (`node tests/serve.mjs 8080 --base /hayeled/` → `http://localhost:8080/hayeled/`), tests, deploy, the backend pointer to `docs/ADMIN_SETUP.md`, and the file structure.
- `publish.ps1` (PowerShell 5.1 compatible, ASCII-only script content, Hebrew path safe through `$PSScriptRoot`). It does the following:
  1. `Set-Location $PSScriptRoot`.
  2. If there is no `.git`: `git init -b main`, `git remote add origin https://github.com/Moshe0408/hayeled.git`.
  3. Optional `-Message` param (default `"Update <date>"`).
  4. Check that `sw.js` VERSION equals the `config.js` APP_VERSION (warn and abort if not).
  5. `git add -A`, `git commit` (skip if nothing to commit), `git push -u origin main`.
  6. Print the Pages URL `https://moshe0408.github.io/hayeled/` and a reminder: first time only, enable Settings → Pages → Deploy from branch `main` / root.
  - It must not use `&&`/`||` (PS 5.1); use `if ($LASTEXITCODE -ne 0) { ... }`.

**Versioning rule:** every deploy that changes any precached file bumps `APP_VERSION` (config.js) **and** `VERSION` (sw.js) together, as semver patch at minimum. Schema changes bump `SCHEMA_VERSION` and add a `migrateState` step. Saves are never dropped because of a version change.

---

*End of SPEC v1.*

