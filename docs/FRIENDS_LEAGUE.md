# ליגת חברים (v2.3)

ליגה פרטית בין חברים: פותחים ליגה, שולחים קישור (`?league=CODE`), וכל מי שמצטרף רואה טבלה משותפת
של הקריירות (מורשת, שערים, תארים, דירוג), עם מדליות 🥇🥈🥉, "👑 מלך השערים של השבוע" והתראות כמו
"נועה עקפה אותך בליגה 'החבר'ה'!". עד 50 משתתפים בליגה, עד 10 ליגות שפתח מכשיר אחד.

המודול עצמאי לגמרי: הוא לא משנה אף קובץ קיים. כדי להפעיל אותו צריך לבצע את שלבי החיבור (סעיף 4).

## 1. קבצים

| קובץ | תפקיד |
|---|---|
| `js/core/friends.js` | לקוח ה-API (fl_* RPC), אחסון מקומי `hy.friends`, סנכרון, התראות. לא נוגע ב-DOM, לא זורק חריגות |
| `js/ui/friends.js` | המסכים `#/friends`, `#/friends/CODE`, `#/friends/join?code=` + `friendsNotices()` |
| `css/friends.css` | העיצוב (קידומת `fl-`, 360-430px, RTL) |
| `supabase/update-2.3-friends.sql` | שתי טבלאות + פונקציות fl_* + admin_fl_overview. אידמפוטנטי |
| `tests/mock-friends.mjs` | מוק בזיכרון של כל ה-RPC (Node + דפדפן) לחיבור ל-`tests/mock-supabase.mjs` |

## 2. API של הלקוח (`js/core/friends.js`)

כל הפונקציות האסינכרוניות מחזירות `{ok:true, ...}` או `{ok:false, error, messageHe}` (טקסט ידידותי מותאם מגדר).
בלי backend / בלי רשת: `{ok:false, error:'unavailable'|'offline', offline:true}`. אף פעם לא זורקות.

- `createLeague(nameHe)` -> `{ok, code, url, nameHe, joined}` (מצטרף אוטומטית עם הקריירה שבזיכרון, אם יש)
- `joinLeague(code, {summary}?)` -> `{ok, league:{code, nameHe, members, already}}` (בלי summary: הקריירה שבזיכרון; לקריירה ממשבצת אחרת: `summaryFromMeta(slot.meta)`)
- `myLeagues()` (סינכרוני) -> `[{code, nameHe, role:'owner'|'member', careers, members}]` מ-`localStorage['hy.friends']` (משותף לכל המשבצות)
- `refreshMyLeagues({force})` -> משחזר/מיישר את הרשימה מול השרת (`fl_mine`, פעם ב-6 שעות)
- `getLeague(code)` -> `{ok, code, nameHe, count, max, isOwner, isMember, members:[{rank, hash, name, gender, nation, clubHe, clubId, ovr, goals, trophies, ballon, legacy, weekGoals, isMe, owner}], weekKing:{name, gender, weekGoals, isMe}|null, stale?}`. בלי רשת: העותק השמור עם `stale:true`
- `syncMyCareer({force})` -> דוחף את סיכום הקריירה שבזיכרון לכל הליגות של המכשיר + הקריירה. מוגבל לפעם ב-10 דקות לקריירה (`force:true` לסוף עונה / פרישה)
- `leaveLeague(code)`, `ownerRename(code, name)`, `ownerRemove(code, memberHash)`
- `handleLeagueParam()` -> קורא `?league=CODE`, שומר הזמנה ממתינה, מנקה את הכתובת, מחזיר את הקוד או null
- `getPendingJoin()` / `clearPendingJoin()`
- `refreshLeagues({maxAgeMs})` -> מרענן טבלאות שמורות (בשביל ההתראות)
- `currentSummary()`, `summaryFromMeta(meta)`, `inviteUrl(code)`, `normCode(s)`, `checkLeagueName(s)`, `messageFor(error)`
- `markSeen(code)`, `markAllSeen()`, `leagueChanges()`, `diffLeague(seen, league)` (טהור)
- `_setTransport(fn)` - בדיקות בלבד: `fn(name, args) -> Promise<json>`

הסיכום נלקח מ-`game.getCareerSummaryForBoard()`; אם אין כזו - מ-`getSaveMeta()` + `getProfile()`.

ממשק (`js/ui/friends.js`): `render(root, params)`, `openInvite({code, nameHe})`,
`friendsNotices({max=3})` -> `[{id, kind:'invite'|'overtaken'|'top'|'up'|'joined', code, textHe, href, tone}]`,
`dismissFriendsNotices()`, `_setCareerSource(fn)` (בדיקות).

## 3. SQL (`supabase/update-2.3-friends.sql`)

מריצים אחרי `schema.sql` (צריך את `public.is_admin()`), בלי תלות ב-2.1/2.2/2.3. בטוח להרצה חוזרת.
טבלאות `public.friend_leagues`, `public.friend_league_members`: RLS פעיל, אין policies, אין הרשאות טבלה ל-anon/authenticated.

| RPC | הרשאה | תשובה |
|---|---|---|
| `fl_create(p_device, p_name, p_career?, p_summary?)` | anon, authenticated | `{ok, code, name, joined}` / `bad_device, bad_name, too_many (10 ליגות), rate_limited (5 בשעה), busy` |
| `fl_join(p_code, p_device, p_career, p_summary)` | anon, authenticated | `{ok, code, name, members, already, owner}` / `bad_code, not_found, full (50), too_many (3 קריירות למכשיר בליגה, 30 חברויות למכשיר), bad_summary` |
| `fl_sync(p_device, p_career, p_summary)` | anon, authenticated | `{ok, updated}` / `rate_limited (10 שניות)` |
| `fl_get(p_code, p_device?)` | anon, authenticated | `{ok, code, name, count, max, week_key, is_owner, is_member, members[], week_king}` - בלי מזהי מכשיר/קריירה; `hash` (10 hex, שונה בכל ליגה) |
| `fl_mine(p_device)` | anon, authenticated | `{ok, leagues:[{code, name, role, career_id, members}]}` |
| `fl_leave(p_code, p_device, p_career?)` | anon, authenticated | `{ok, removed, deleted, owner_moved}` - מנהל שיוצא מעביר ניהול לוותיק ביותר; ליגה ריקה נמחקת |
| `fl_rename(p_code, p_device, p_name)` | anon, authenticated | מנהל בלבד (`not_owner`) |
| `fl_remove(p_code, p_device, p_member_hash)` | anon, authenticated | מנהל בלבד; לא את עצמו (`self`) |
| `admin_fl_overview()` | authenticated + `is_admin()` | ספירות: ליגות, משתתפים, מכשירים, פעילות/פתיחות ב-7 ימים, ממוצע, מלאות, top 10 |

כללים: שם שחקן עד 30 תווים, שם ליגה 2-24 (ניקוי תווים נסתרים/bidi, מסנן גסויות; שם שחקן גס מוחלף ל"שחקן/שחקנית מהשכונה",
שם ליגה גס נדחה). מספרים נחתכים (ovr 0-99, goals 0-5000, trophies 0-500, ballon 0-50, legacy 0-1000000), מונים לא יורדים.
שערי השבוע מחושבים בשרת מההפרש בין סנכרונים (שבוע ישראלי: ראשון-שבת, Asia/Jerusalem), עד 200 לסנכרון.
קוד ליגה: 6 תווים מ-`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (בלי I O 0 1) מ-`extensions.gen_random_bytes` (או `gen_random_uuid` כגיבוי).

## 4. שלבי חיבור (WIRING STEPS)

1. **router** - `js/ui/router.js`, בטבלת הנתיבים (`join` חייב להופיע לפני `:code`):
   ```js
   route('/friends', () => import('./friends.js'), { tab: 'career', title: 'ליגת חברים', back: 'home' });
   route('/friends/join', () => import('./friends.js'), { tab: 'career', title: 'הזמנה לליגה', back: '#/friends' });
   route('/friends/:code', () => import('./friends.js'), { tab: 'career', title: 'ליגת חברים', back: '#/friends' });
   ```
   ב-`js/main.js` להוסיף ל-`PUBLIC_ROUTES` את `'/friends'` ו-`'/friends/join'` (הם עובדים גם בלי קריירה).
   `/friends/:code` עובד גם בלי קריירה; אם ה-guard מגביל - להוסיף בדיקה `startsWith('/friends')`.
2. **כפתור "ליגת חברים"**:
   - `js/ui/title.js` בתוך `.title-links`: `<button type="button" class="btn btn-ghost" data-act="friends" data-testid="btn-friends">${ico('users')}ליגת חברים</button>` ובטיפול בלחיצה: `else if (act === 'friends') navigate('#/friends');`
   - `js/ui/career.js` בתוך `.career-links`: `<a class="btn btn-sm" href="#/friends" data-testid="btn-career-friends">${ico('users')}ליגת חברים</a>`
3. **boot** - `js/main.js`, אחרי `initTelemetry` ולפני `startRouter`:
   ```js
   let leagueCode = null;
   try { const fr = await import('./core/friends.js'); leagueCode = fr.handleLeagueParam(); fr.syncMyCareer().then(() => fr.refreshLeagues()).catch(() => {}); } catch { /* optional */ }
   if (leagueCode) initial = '#/friends/join?code=' + leagueCode;   // אחרי השורה של intro / ?c=
   ```
   (`handleLeagueParam` מוחק את `?league=` מהכתובת, ולכן קוראים לו פעם אחת.)
   אם אין עדיין קריירה, ההזמנה נשמרת (`getPendingJoin()`); כרטיס ההזמנה מציע "פתיחת קריירה" ומופיע שוב ב-hub (שלב 5).
4. **syncMyCareer** (כולם fire-and-forget: `import('./core/friends.js').then((m) => m.syncMyCareer(opts)).catch(() => {})`):
   - בפתיחת משבצת: בסוף `openSlot()` ב-`js/main.js` (`{}`)
   - אחרי משחק: ב-`js/ui/match.js` אחרי `game.finishMatch()` (`{}` - המגבלה של 10 דקות חלה)
   - סוף עונה: ב-`js/ui/week.js` ליד `game.ackSeasonReview()` / `submitSeason()` (`{ force: true }`)
   - פרישה / תחילת אימון: ב-`js/ui/retire.js` (`{ force: true }`)
5. **התראות ב-hub** - `js/ui/hub.js`, לפני בניית `alertsHtml`:
   ```js
   import { friendsNotices } from './friends.js';
   const fl = friendsNotices({ max: 2 }).map((n) => ({ type: 'friends', textHe: n.textHe, route: n.href }));
   const alerts = [...fl, ...(hub.alerts || [])].filter((a) => a && a.textHe);
   ```
   ולהוסיף `friends: ['users', 'teal']` ל-`ALERT_ICO`. פתיחת הטבלה מסמנת אותה כ"נראתה" ומנקה את ההתראות שלה.
   (`friendsNotices` סינכרוני, קורא רק מהמטמון; הרענון קורה ב-boot דרך `refreshLeagues()`.)
6. **index.html** - אחרי `./css/v23.css`: `<link rel="stylesheet" href="./css/friends.css">`
7. **sw.js** - להוסיף ל-`PRECACHE`: `'./css/friends.css'`, `'./js/core/friends.js'`, `'./js/ui/friends.js'` ולהעלות `VERSION`.
8. **Supabase** - SQL Editor -> להדביק את כל `supabase/update-2.3-friends.sql` -> Run.
9. **admin (אופציונלי)** - `js/admin/api.js`: `rpc('admin_fl_overview', {}, { token })` -> כרטיס "ליגת חברים" בדשבורד.
10. **mock** - `tests/mock-supabase.mjs`:
    ```js
    import { addFriendsRoutes, FRIENDS_RPCS, FRIENDS_ADMIN_RPCS } from './mock-friends.mjs';
    // אחרי const rpcs = {...} בתוך createMockSupabase():
    const friends = addFriendsRoutes(rpcs);
    // ADMIN_RPCS: להוסיף ...FRIENDS_ADMIN_RPCS ; ב-reset(): friends.reset() ; ב-/__mock/state: { ...db, friends: friends.db }
    // hiddenRpc(): FRIENDS_RPCS מוסתרים כש-schema < '2.3' (כמו V23_RPCS)
    ```
    עזר לבדיקות: `friends.age(sec)` מזקין שורות (עוקף את מגבלות 10 השניות / השעה).

## 5. בדיקות שבוצעו

- PGlite (schema.sql + 2.1 + 2.2 + 2.3 + הקובץ פעמיים, וגם על schema.sql בלבד, עם ובלי pgcrypto): 106 בדיקות - מגבלות, בעלות, הרשאות anon/authenticated, RLS, guard.
- הלקוח מול המוק ב-Node: 50 בדיקות (סנכרון, התראות, offline, not_installed, שחזור fl_mine, הזמנה ממתינה).
- הלקוח דרך `supa.rpc` ו-HTTP מקומי מול `addFriendsRoutes`.
- צילומי מסך ב-Chrome headless ב-360/390/430 (בן ובת): רשימה, ריק, טבלה, מיונים, ניהול, הזמנה, פתיחה, קוד, כרטיס הצטרפות (2 קריירות / אחת / בלי קריירה / לא נמצא / כבר חבר), offline. בלי גלישה רוחבית.
