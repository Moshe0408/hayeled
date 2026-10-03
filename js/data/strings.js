// js/data/strings.js (Content) - shared Hebrew labels (SPEC §4.3).
// Pure data: no DOM, no randomness. Every key of §4.3 is present; UI_TEXT is an
// additional, optional export with shared screen copy (settings, save, privacy,
// feedback, install, ads...). UI may use it or keep its own copy.

export const POSITIONS = {
  GK:  { he: 'שוער', short: 'שוער', group: 'GK', desc: 'השומר האחרון. צלילות, יציאות, ובנייה מהרגליים' },
  CB:  { he: 'בלם', short: 'בלם', group: 'DEF', desc: 'עמוד השדרה של ההגנה: תיקולים, נגיחות ומיקום' },
  LB:  { he: 'מגן שמאלי', short: 'מגן', group: 'DEF', desc: 'מגן שעולה להתקפה באגף שמאל וחוזר מהר' },
  RB:  { he: 'מגן ימני', short: 'מגן', group: 'DEF', desc: 'מגן שעולה להתקפה באגף ימין וחוזר מהר' },
  CDM: { he: 'קשר אחורי', short: 'קשר', group: 'MID', desc: 'שומר על האיזון, חוטף כדורים ומתחיל את הבנייה' },
  CM:  { he: 'קשר מרכזי', short: 'קשר', group: 'MID', desc: 'המנוע של הקבוצה: מסירות, ריצות וקצת מכל דבר' },
  CAM: { he: 'קשר התקפי', short: '10', group: 'MID', desc: 'מספר 10 הקלאסי. רואה מסירות שאף אחד לא רואה' },
  LW:  { he: 'כנף שמאל', short: 'כנף', group: 'ATT', desc: 'מהיר וחמקמק באגף שמאל, חותך פנימה ומבשל' },
  RW:  { he: 'כנף ימין', short: 'כנף', group: 'ATT', desc: 'מהיר וחמקמק באגף ימין, מגביה ובועט' },
  ST:  { he: 'חלוץ', short: 'חלוץ', group: 'ATT', desc: 'מספר 9. התפקיד שלו פשוט: להבקיע' },
};

export const ATTRS = {
  pac: { he: 'מהירות', short: 'מהי' },
  sho: { he: 'בעיטה', short: 'בעי' },
  pas: { he: 'מסירה', short: 'מסי' },
  dri: { he: 'כדרור', short: 'כדר' },
  def: { he: 'הגנה', short: 'הגנ' },
  phy: { he: 'פיזיות', short: 'פיז' },
  div: { he: 'צלילה', short: 'צלי' },
  han: { he: 'תפיסה', short: 'תפי' },
  ref: { he: 'רפלקסים', short: 'רפל' },
  gkp: { he: 'מיקום', short: 'מיק' },
  kic: { he: 'בעיטות', short: 'בעט' },
};

export const TRAINING = {
  balanced:    { he: 'אימון מאוזן', desc: 'קצת מהכול. התקדמות יציבה בכל התכונות' },
  shooting:    { he: 'בעיטות לשער', desc: 'סיומות, בעיטות מרחוק ובעיטות חופשיות' },
  technique:   { he: 'טכניקה ומסירות', desc: 'מסירות, כדרור ושליטה בכדור' },
  defense:     { he: 'הגנה ותיקולים', desc: 'תיקולים, קריאת משחק ועמדה, עם קצת כוח' },
  physical:    { he: 'כושר ומהירות', desc: 'מהירות, כוח וסיבולת. מאט ירידה בגיל מבוגר' },
  goalkeeping: { he: 'אימון שוערים', desc: 'צלילות, תפיסה, רפלקסים ומיקום (לשוערים בלבד)' },
  rest:        { he: 'מנוחה והתאוששות', desc: 'בלי התקדמות השבוע, אבל +15 אנרגיה ובלי סיכון לפציעה באימון' },
};

export const ROLES = { star: 'כוכב הקבוצה', key: 'שחקן מפתח', rotation: 'רוטציה', squad: 'שחקן סגל', prospect: 'כישרון צעיר' };

export const ODDS = { low: 'נמוך', mid: 'בינוני', high: 'גבוה' };

export const STAGES = { youth: 'נוער', pro: 'מקצוען', free: 'שחקן חופשי', retired: 'פרש' };

export const SELECTION = { starter: 'בהרכב', bench: 'על הספסל', out: 'מחוץ לסגל', injured: 'פצוע', suspended: 'מורחק', youth: 'קבוצת הנוער', national: 'בנבחרת' };

export const COMP_TYPES = { league: 'ליגה', cup: 'גביע', europe: 'אירופה', national: 'נבחרת', youth: 'נוער', ynt: 'נבחרת נוער', friendly: 'ידידות' };

export const EURO_COMPS = {
  ucl:  { he: 'ליגת האלופות', short: 'האלופות' },
  uel:  { he: 'הליגה האירופית', short: 'האירופית' },
  uecl: { he: 'הקונפרנס ליג', short: 'הקונפרנס' },
};

export const ROUND_NAMES = {
  q: 'סיבוב מוקדם', lp: 'שלב הליגה', kpo: 'פלייאוף', r128: 'סיבוב ראשון', r64: 'סיבוב 64', r32: 'סיבוב 32', r16: 'שמינית הגמר',
  qf: 'רבע הגמר', sf: 'חצי הגמר', f: 'הגמר', grp: 'שלב הבתים', md: 'מחזור', q_md: 'מוקדמות', fr: 'ידידות',
};

export const TOURNAMENTS = {
  wc: 'המונדיאל', euro: 'היורו', copa: 'קופה אמריקה', afcon: 'אליפות אפריקה', asian: 'גביע אסיה', gold: 'גביע הזהב',
  u17: 'אליפות עד גיל 17', u19: 'אליפות עד גיל 19', u21: 'אליפות עד גיל 21', qual: 'מוקדמות', friendly: 'משחק ידידות',
};

export const AWARDS = {
  top_scorer: 'מלך השערים', pots: 'שחקן העונה', tots: 'נבחרת העונה', young_pots: 'השחקן הצעיר של העונה',
  ucl_top_scorer: 'מלך שערי ליגת האלופות', golden_boy: 'פרס הגולדן בוי', ballon_dor: 'כדור הזהב', bdo_top3: 'פודיום כדור הזהב',
  bdo_top10: 'טופ 10 בכדור הזהב', golden_boot_tour: 'מלך שערי הטורניר', motm_final: 'שחקן הגמר',
};

export const TROPHIES = {
  league: 'אליפות', league2: 'עלייה ליגה', cup: 'גביע', ucl: 'ליגת האלופות', uel: 'הליגה האירופית', uecl: 'הקונפרנס ליג',
  wc: 'גביע העולם', euro: 'אליפות אירופה', copa: 'קופה אמריקה', afcon: 'אליפות אפריקה', asian: 'גביע אסיה', gold: 'גביע הזהב',
  u17: 'אליפות עד 17', u19: 'אליפות עד 19', u21: 'אליפות עד 21', youth_league: 'אליפות נוער',
};

export const INJURIES = {
  minor: [
    { id: 'knock', he: 'מכה' },
    { id: 'ankle_twist', he: 'נקע קל בקרסול' },
    { id: 'calf_tight', he: 'שריר תפוס בשוק' },
    { id: 'thigh_bruise', he: 'שטף דם בירך' },
    { id: 'back_spasm', he: 'תפס בגב' },
  ],
  medium: [
    { id: 'hamstring', he: 'מתיחה בירך האחורית' },
    { id: 'groin', he: 'מתיחה במפשעה' },
    { id: 'ankle_sprain', he: 'נקע בקרסול' },
    { id: 'calf_tear', he: 'קרע קל בשריר השוק' },
    { id: 'rib', he: 'צלע סדוקה' },
  ],
  major: [
    { id: 'acl', he: 'קרע ברצועה הצולבת' },
    { id: 'meniscus', he: 'קרע במניסקוס' },
    { id: 'broken_leg', he: 'שבר ברגל' },
    { id: 'achilles', he: 'קרע בגיד אכילס' },
    { id: 'metatarsal', he: 'שבר בכף הרגל' },
  ],
};

export const PERSONAS = {
  mom:            { he: 'אמא', avatar: '👩‍🍳' },
  dad:            { he: 'אבא', avatar: '👨' },
  friends:        { he: 'החבר׳ה מהשכונה', avatar: '⚽', group: true },
  agent:          { he: 'הסוכן', avatar: '🕴️' },
  coach:          { he: 'המאמן', avatar: '📋' },
  journalist:     { he: 'עיתונאי', avatar: '🎙️' },
  sponsor:        { he: 'ספונסר', avatar: '💼' },
  partner:        { he: 'בת הזוג', avatar: '❤️' },
  social:         { he: 'רשתות חברתיות', avatar: '📱' },
  captain:        { he: 'הקפטן', avatar: '©️' },
  fan:            { he: 'אוהד', avatar: '📣' },
  brother:        { he: 'אח קטן', avatar: '🧒' },
  grandma:        { he: 'סבתא', avatar: '👵' },
  national_coach: { he: 'מאמן הנבחרת', avatar: '🏳️' },
  owner:          { he: 'בעלי המועדון', avatar: '🎩' },
  doctor:         { he: 'הרופא', avatar: '🩺' },
  club:           { he: 'המועדון', avatar: '🏟️' },
  system:         { he: 'הילד מהשכונה', avatar: '⭐' },
};

export const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export const LEGACY_TIERS = [
  { min: 0, he: 'שחקן ליגה' },
  { min: 60, he: 'שחקן מוערך' },
  { min: 160, he: 'כוכב' },
  { min: 320, he: 'אגדה' },
  { min: 550, he: 'אגדה של כל הזמנים' },
];

// Numbers are binding (SPEC §5.15). minAge omitted = no limit. fam_* items cannot be sold.
export const SHOP_ITEMS = [
  { id: 'car_old',        cat: 'car',    he: 'הסובארו הישנה של הדוד', price: 3000,    upkeep: 20,   morale: 1,  minAge: 18, desc: 'נוסעת. בדרך כלל.' },
  { id: 'car_city',       cat: 'car',    he: 'קיה פיקנטו חדשה',        price: 15000,   upkeep: 60,   morale: 2,  minAge: 18, desc: 'קטנה, חסכונית, נכנסת לכל חניה' },
  { id: 'car_family',     cat: 'car',    he: 'מאזדה 3',                price: 35000,   upkeep: 120,  morale: 3,  minAge: 18, desc: 'רכב של שחקן רציני' },
  { id: 'car_lux',        cat: 'car',    he: 'אאודי RS',               price: 120000,  upkeep: 450,  morale: 5,  minAge: 18, desc: 'כל השכונה תשמע אותך מגיע' },
  { id: 'car_super',      cat: 'car',    he: 'למבורגיני',              price: 450000,  upkeep: 1800, morale: 8,  minAge: 18, desc: 'אבא כבר מבקש לנהוג רק סיבוב אחד' },
  { id: 'home_room',      cat: 'home',   he: 'שיפוץ החדר אצל ההורים',  price: 8000,    upkeep: 0,    morale: 2,                desc: 'בלי הפוסטרים מכיתה ח׳. טוב, רק חלק' },
  { id: 'home_apt',       cat: 'home',   he: 'דירת 3 חדרים בעיר',      price: 250000,  upkeep: 400,  morale: 4,  minAge: 18, desc: 'סוף סוף לבד. אמא עדיין מביאה אוכל' },
  { id: 'home_pent',      cat: 'home',   he: 'פנטהאוז מול הים',        price: 1800000, upkeep: 2500, morale: 7,  minAge: 18, desc: 'נוף לים ומרפסת למנגלים' },
  { id: 'home_villa',     cat: 'home',   he: 'וילה עם בריכה',          price: 6000000, upkeep: 6000, morale: 10, minAge: 18, desc: 'החבר׳ה כבר עברו לגור אצלך. בערך' },
  { id: 'fam_trip',       cat: 'family', he: 'טיסה משפחתית לחו״ל',     price: 12000,   upkeep: 0,    morale: 2,                desc: 'אבא כבר מכין רשימת ציוד' },
  { id: 'fam_parents',    cat: 'family', he: 'שיפוץ הבית של ההורים',   price: 90000,   upkeep: 0,    morale: 5,                desc: 'מטבח חדש לאמא, ספה חדשה לאבא' },
  { id: 'fam_field',      cat: 'family', he: 'מגרש חדש בשכונה',        price: 400000,  upkeep: 0,    morale: 6,  fans: 5,      desc: 'דשא סינתטי, תאורה, ושלט עם השם שלך' },
  { id: 'style_wardrobe', cat: 'style',  he: 'ארון בגדים של מעצבים',   price: 20000,   upkeep: 0,    morale: 1,                desc: 'החבר׳ה יצחקו. ואז יבקשו לשאול חולצה' },
  { id: 'style_watch',    cat: 'style',  he: 'שעון יוקרה',             price: 40000,   upkeep: 0,    morale: 2,                desc: 'מראה את השעה. ואת המשכורת' },
];

export const RESULT_LABELS = { W: 'ניצחון', D: 'תיקו', L: 'הפסד' };

export const ALERTS = {
  contract_expiring: 'החוזה שלך מסתיים בסוף העונה',
  injured: 'אתה פצוע',
  callup: 'זומנת לנבחרת!',
  window_open: 'חלון ההעברות פתוח',
  offer: 'יש לך הצעה חדשה',
  energy_low: 'האנרגיה נמוכה. כדאי לנוח',
  suspended: 'אתה מורחק למשחק הבא',
  free_agent: 'אתה שחקן חופשי. בדוק הצעות',
  season_review: 'סיכום העונה מחכה לך',
  info: '',
};

export const FORMAT_LABELS = { double_rr: 'ליגה כפולה', double_rr_split: 'ליגה + פלייאוף', triple_rr_split: 'ליגה משולשת + פיצול' };

// ---------------------------------------------------------------------------
// Extra (optional) shared screen copy. Placeholders in braces ({n}, {v}, {slot},
// {minute}...) are filled by the UI with simple replace.
// ---------------------------------------------------------------------------
export const UI_TEXT = {
  app: {
    name: 'הילד מהשכונה',
    tagline: 'מהשכונה ועד הבאלון ד׳אור',
    loading: 'טוען...',
    noscript: 'כדי לשחק ב"הילד מהשכונה" צריך להפעיל JavaScript בדפדפן.',
  },
  common: {
    ok: 'אישור', cancel: 'ביטול', back: 'חזרה', close: 'סגור', continue: 'המשך', yes: 'כן', no: 'לא',
    save: 'שמור', copy: 'העתק', copied: 'הועתק ✓', share: 'שתף', send: 'שלח', delete: 'מחק', retry: 'נסה שוב',
    later: 'לא עכשיו', confirm: 'בטוח?', areYouSure: 'אתה בטוח?', error: 'משהו השתבש. נסה שוב',
    offline: 'אין חיבור לאינטרנט. המשחק ממשיך לעבוד כרגיל', week: 'שבוע', season: 'עונה', age: 'גיל',
    ovr: 'יכולת', potential: 'פוטנציאל', money: 'כסף', energy: 'אנרגיה', morale: 'מורל', form: 'כושר',
    trust: 'אמון המאמן', fans: 'אהבת הקהל', mates: 'יחסים בקבוצה', value: 'שווי שוק', wage: 'משכורת', perWeek: 'לשבוע',
  },
  nav: {
    hub: 'בית', schedule: 'לוח', tables: 'טבלאות', career: 'קריירה', inbox: 'הודעות',
    settings: 'הגדרות', offers: 'הצעות', national: 'נבחרת', profile: 'פרופיל', shop: 'חנות', awards: 'פרסים', hof: 'היכל התהילה',
  },
  title: {
    newCareer: 'קריירה חדשה', continue: 'המשך קריירה', hof: 'היכל התהילה', settings: 'הגדרות',
    slot: 'משבצת {n}', emptySlot: 'משבצת ריקה', corrupt: 'השמירה נפגמה', load: 'טען', deleteSlot: 'מחק',
    restoreDeleted: 'שחזר קריירה שנמחקה', restorePrev: 'שחזר שמירה קודמת', importBackup: 'ייבוא גיבוי',
    deleteConfirm: 'למחוק את הקריירה מהמשבצת? אפשר יהיה לשחזר אותה מתפריט המשבצת',
    deleteConfirm2: 'בטוח? זו הקריירה של {name}',
  },
  create: {
    stepName: 'איך קוראים לך?', first: 'שם פרטי', last: 'שם משפחה', nick: 'כינוי (לא חובה)', nickHint: 'ככה יקראו לך בשכונה',
    stepNation: 'מאיזו מדינה אתה?', searchNation: 'חפש מדינה...',
    stepPosition: 'באיזו עמדה אתה משחק?', foot: 'רגל חזקה', footR: 'ימין', footL: 'שמאל',
    stepClub: 'באיזו מחלקת נוער אתה מתחיל?', noLeagueNote: 'למדינה שלך אין ליגה במשחק. בחר אקדמיה בכל ליגה שתרצה',
    stepSummary: 'מוכן לצאת לדרך?', chooseSlot: 'באיזו משבצת לשמור?', slotTaken: 'המשבצת תפוסה. הקריירה הקיימת תעבור לשחזור',
    next: 'הבא', start: 'צא לדרך!', scoutTitle: 'דו״ח סקאוט', scoutOk: 'יאללה, מתחילים',
    errName: 'צריך שם פרטי ושם משפחה',
  },
  hub: {
    playWeek: 'שחק את השבוע', resumeWeek: 'המשך את השבוע', toMatch: 'למשחק', seasonReview: 'סיכום העונה',
    thisWeek: 'השבוע', noFixture: 'אין משחק השבוע', training: 'אימון השבוע',
    fastForward: 'הרצה מהירה', ffNextMatch: 'עד המשחק הבא', ffSeasonEnd: 'עד סוף העונה', ffSkipSummer: 'דלג על הקיץ',
    ffProgress: 'שבוע {n}...', ffStop: 'עצור',
    alerts: 'התראות', quickLinks: 'קיצורים',
    weekSummary: 'סיכום השבוע', weekOk: 'המשך', newMessages: '{n} הודעות חדשות', newOffers: '{n} הצעות חדשות',
    ovrChange: 'שינוי ביכולת',
  },
  match: {
    start: 'יאללה!', autoplay: 'שחק אוטומטית', finish: 'סיכום', continue: 'המשך',
    goalFlash: 'גוללל!', starter: 'בהרכב', benchOn: 'נכנס מהספסל בדקה {minute}', minute: 'דקה',
    rating: 'ציון', motm: 'שחקן המשחק', goals: 'שערים', assists: 'בישולים', odds: 'סיכוי', fullTime: 'סיום',
  },
  save: {
    saved: 'נשמר ✓',
    repaired: 'שחזרנו את השמירה שלך מהגיבוי במכשיר ✓',
    corruptToast: 'השמירה במשבצת הזאת נפגמה. אפשר לשחזר שמירה קודמת או לייבא גיבוי',
    tooNew: 'השמירה נוצרה בגרסה חדשה יותר. מעדכנים את המשחק...',
    quotaWarn: 'האחסון במכשיר כמעט מלא. פינינו נתוני משחקים ישנים. מומלץ לייצא גיבוי',
    quotaFail: 'לא הצלחנו לשמור: אין מקום באחסון. ייצא גיבוי עכשיו כדי לא לאבד התקדמות',
    otherTabTitle: 'המשחק פתוח בחלון אחר',
    otherTabBody: 'כדי לא לדרוס את ההתקדמות, אפשר לשחק רק בחלון אחד בכל פעם. סגור את החלון השני או טען מחדש כאן.',
    otherTabReload: 'טען מחדש כאן',
    restoredPrev: 'חזרנו לשמירה מתחילת השבוע הקודם ✓',
    hofSaved: 'הקריירה נכנסה להיכל התהילה ✓',
  },
  settings: {
    title: 'הגדרות',
    progressTitle: 'השמירה וההתקדמות שלך',
    progressLines: [
      'ההתקדמות נשמרת אוטומטית אחרי כל פעולה, על המכשיר הזה, בשני מקומות בדפדפן. אם אחד מהם נפגם, המשחק משחזר מהשני.',
      'ההתקדמות לא נשמרת בשרת. מחיקת נתוני הדפדפן או נתוני האתר מוחקת גם אותה.',
      'כדי לעבור לטלפון אחר או לשמור עותק: "ייצוא קובץ" או "העתק קוד גיבוי", ואז ייבוא במכשיר החדש.',
      'מומלץ להתקין את המשחק במסך הבית. באייפון זה מקטין מאוד את הסיכוי למחיקה: ספארי עלול למחוק נתוני אתרים אחרי כשבוע בלי ביקור.',
      'באייפון, האפליקציה המותקנת וספארי שומרים התקדמות נפרדת. לפני ההתקנה ייצא קוד גיבוי בספארי, וייבא אותו בתוך האפליקציה.',
      '"שחזר שמירה קודמת" מחזיר לשמירה מתחילת שבוע המשחק הקודם (צעד אחד אחורה; אפשר לבטל בשחזור נוסף).',
    ],
    storageProtected: 'האחסון מוגן ✓',
    storageAtRisk: 'הדפדפן עלול למחוק נתונים כשהמכשיר מתמלא. מומלץ לגבות',
    storageUnsupported: 'לא נתמך בדפדפן הזה',
    storageUsage: 'בשימוש: {used} מתוך {quota}',
    requestPersist: 'בקש הגנה על האחסון',
    backupTitle: 'גיבוי והעברה',
    exportFile: 'ייצוא קובץ',
    exportCode: 'העתק קוד',
    exportCodeTitle: 'קוד הגיבוי שלך',
    exportCodeHint: 'העתק את הקוד ושמור אותו בהודעה לעצמך או בפתקים. בטלפון החדש: הגדרות ← ייבוא ← הדבק קוד.',
    exportCodeTooLong: 'הקוד ארוך מאוד ווטסאפ עלול לקצץ אותו. עדיף להשתמש ב"ייצוא קובץ"',
    restorePrev: 'שחזר שמירה קודמת',
    restorePrevConfirm: 'לחזור לשמירה מתחילת השבוע הקודם? ההתקדמות מאז תישמר כשמירה הקודמת, ואפשר לחזור אליה',
    backupAll: 'גיבוי מלא (כל המשבצות + היכל התהילה)',
    importTitle: 'ייבוא גיבוי',
    importFile: 'בחר קובץ גיבוי',
    importCodePh: 'הדבק כאן קוד גיבוי',
    importCodeBtn: 'ייבא קוד',
    importTarget: 'לאיזו משבצת לייבא?',
    importOverwrite: 'במשבצת הזאת יש קריירה. היא תעבור לשחזור ואפשר יהיה להחזיר אותה. להמשיך?',
    importDone: 'הייבוא הצליח ✓',
    importErrors: {
      bad_format: 'זה לא נראה כמו קוד או קובץ גיבוי של "הילד מהשכונה"',
      bad_checksum: 'הגיבוי פגום או לא הועתק עד הסוף. נסה להעתיק שוב',
      too_new: 'הגיבוי נוצר בגרסה חדשה יותר של המשחק. רענן את הדף ונסה שוב',
      unsupported_code: 'הדפדפן הזה לא יודע לפתוח קוד מכווץ. נסה דפדפן אחר או ייבא קובץ',
    },
    installTitle: 'התקנה למסך הבית',
    installLink: 'איך מתקינים?',
    feedbackTitle: 'משוב',
    feedbackLink: 'שלח משוב',
    displayTitle: 'תצוגה',
    reduceMotion: 'הפחתת אנימציות',
    haptics: 'רטט במשחקים',
    aboutTitle: 'אודות',
    version: 'גרסה {v}',
    checkUpdate: 'בדוק עדכונים',
    upToDate: 'יש לך את הגרסה האחרונה ✓',
    credits: 'משחק קריירה בעברית. כל השמות של השחקנים בדיוניים.',
    dangerTitle: 'אזור מסוכן',
    deleteSlot: 'מחק משבצת {n}',
    deleteSlotConfirm: 'למחוק את הקריירה במשבצת {n}?',
    deleteSlotConfirm2: 'בטוח בטוח? אפשר יהיה לשחזר אותה ממסך הפתיחה',
  },
  privacy: {
    title: 'פרטיות',
    telemetryToggle: 'שתף נתוני שימוש אנונימיים',
    telemetryNote: 'אנחנו אוספים נתונים אנונימיים בלבד (מזהה מכשיר אקראי, כמה זמן משחקים, אירועים במשחק) כדי לשפר את המשחק. בלי שם, בלי מיקום, בלי אנשי קשר.',
    adsConsentToggle: 'אפשר פרסומות מותאמות של Google',
    adsConsentNote: 'אם תאשר, Google עשויה להשתמש בעוגיות כדי להציג פרסומות. אפשר לבטל בכל רגע.',
  },
  install: {
    title: 'התקנה למסך הבית',
    why: 'משחק מותקן נפתח מהר, עובד בלי אינטרנט, וההתקדמות שמורה בצורה בטוחה יותר.',
    installed: 'כבר מותקן ✓',
    androidBtn: 'התקן',
    androidSteps: ['פתח את התפריט ⋮ בפינה של כרום', 'בחר "הוספה למסך הבית" או "התקנת אפליקציה"', 'אשר, וזהו!'],
    iosSteps: ['פתח את המשחק בספארי', 'לחץ על כפתור השיתוף (ריבוע עם חץ למעלה)', 'גלול ובחר "הוסף למסך הבית"', 'לחץ "הוסף"'],
    iosStorageWarn: 'חשוב: באייפון, האפליקציה המותקנת שומרת התקדמות נפרדת מספארי. לפני ההתקנה העתק קוד גיבוי, ואחרי ההתקנה ייבא אותו בתוך האפליקציה (הגדרות ← ייבוא).',
    iosCopyCode: 'העתק קוד גיבוי',
    dismiss: 'אולי אחר כך',
    banner: 'התקן את המשחק במסך הבית',
  },
  feedback: {
    title: 'משוב',
    prompt: 'איך המשחק עד עכשיו?',
    ratingLabel: 'כמה כוכבים?',
    ratingRequired: 'בחר דירוג בין 1 ל־5 כוכבים',
    textLabel: 'ספר לנו',
    textPh: 'מה אהבת? מה היית משפר? מצאת באג?',
    emailLabel: 'אימייל (לא חובה)',
    emailHint: 'אם תרצה שנחזור אליך',
    emailInvalid: 'כתובת האימייל לא נראית תקינה',
    send: 'שלח משוב',
    sending: 'שולח...',
    done: 'תודה! קיבלנו ❤️',
    queued: 'המשוב יישלח אוטומטית כשתחזור לרשת',
    unavailable: 'שליחת משוב תהיה זמינה בקרוב',
    later: 'לא עכשיו',
    stars: ['גרוע', 'לא משהו', 'בסדר', 'טוב', 'מעולה!'],
  },
  ads: {
    label: 'פרסומת',
    sponsor: 'בחסות',
    close: 'סגור',
    closeIn: 'סגור בעוד {n}',
    rewardedBtn: 'צפה בפרסומת וקבל +15 אנרגיה',
    rewardedCountdown: 'הפרס יגיע בעוד {n} שניות...',
    rewardedDone: '+15 אנרגיה! ⚡',
    rewardedLimit: 'צפית בכל הפרסומות להיום. נתראה מחר',
  },
  update: {
    available: 'יש גרסה חדשה. רענן כדי לעדכן',
    required: 'צריך לעדכן את המשחק כדי להמשיך',
    refresh: 'רענן',
    dismiss: 'אחר כך',
  },
  retire: {
    title: 'סוף הקריירה',
    forced: 'הגוף אמר את המילה האחרונה. הגיע הזמן לתלות את הנעליים.',
    voluntary: 'החלטת לתלות את הנעליים. איזו דרך עברת.',
    legacy: 'ציון מורשת',
    toHof: 'להיכל התהילה',
    myCareer: 'הקריירה שלי',
    newCareer: 'קריירה חדשה',
    feedback: 'שלח משוב',
    confirm: 'לפרוש? אי אפשר לחזור מזה',
  },
};
