// js/data/strings.js (Content) - shared Hebrew labels (SPEC §4.3).
// Pure data: no DOM, no randomness. Every key of §4.3 is present; UI_TEXT is an
// additional, optional export with shared screen copy (settings, save, privacy,
// feedback, install, ads...). UI may use it or keep its own copy.
//
// GENDER (v1.2, contracts C2/C3):
//  - Labels that the ENGINE turns into view models may carry {{male|female}}
//    markers (ROLES, STAGES, SELECTION, ALERTS, LEGACY_TIERS, PERSONAS,
//    TRAINING, SHOP_ITEMS desc). The engine resolves them (femLabel / gtext).
//  - Tables that other modules read directly stay plain and get a parallel
//    women's field/table instead: POSITIONS (heF/shortF/descF; the admin reads
//    POSITIONS.he), AWARDS -> AWARDS_W, TROPHIES -> TROPHIES_W (hof.js reads
//    them), EURO_COMPS -> EURO_COMPS_W, TOURNAMENTS -> TOURNAMENTS_W,
//    COMP_NAMES_W (any competition id -> women's name).
//  - UI_TEXT strings may contain markers: resolve them with js/ui/gender.js gtext().

export const POSITIONS = {
  GK:  { he: 'שוער', short: 'שוער', group: 'GK', desc: 'השומר האחרון. צלילות, יציאות, ובנייה מהרגליים',
         heF: 'שוערת', shortF: 'שוערת', descF: 'השומרת האחרונה. צלילות, יציאות, ובנייה מהרגליים' },
  CB:  { he: 'בלם', short: 'בלם', group: 'DEF', desc: 'עמוד השדרה של ההגנה: תיקולים, נגיחות ומיקום',
         heF: 'בלמית', shortF: 'בלמית', descF: 'עמוד השדרה של ההגנה: תיקולים, נגיחות ומיקום' },
  LB:  { he: 'מגן שמאלי', short: 'מגן', group: 'DEF', desc: 'מגן שעולה להתקפה באגף שמאל וחוזר מהר',
         heF: 'מגנה שמאלית', shortF: 'מגנה', descF: 'מגנה שעולה להתקפה באגף שמאל וחוזרת מהר' },
  RB:  { he: 'מגן ימני', short: 'מגן', group: 'DEF', desc: 'מגן שעולה להתקפה באגף ימין וחוזר מהר',
         heF: 'מגנה ימנית', shortF: 'מגנה', descF: 'מגנה שעולה להתקפה באגף ימין וחוזרת מהר' },
  CDM: { he: 'קשר אחורי', short: 'קשר', group: 'MID', desc: 'שומר על האיזון, חוטף כדורים ומתחיל את הבנייה',
         heF: 'קשרית אחורית', shortF: 'קשרית', descF: 'שומרת על האיזון, חוטפת כדורים ומתחילה את הבנייה' },
  CM:  { he: 'קשר מרכזי', short: 'קשר', group: 'MID', desc: 'המנוע של הקבוצה: מסירות, ריצות וקצת מכל דבר',
         heF: 'קשרית מרכזית', shortF: 'קשרית', descF: 'המנוע של הקבוצה: מסירות, ריצות וקצת מכל דבר' },
  CAM: { he: 'קשר התקפי', short: '10', group: 'MID', desc: 'מספר 10 הקלאסי. רואה מסירות שאף אחד לא רואה',
         heF: 'קשרית התקפית', shortF: '10', descF: 'מספר 10 הקלאסית. רואה מסירות שאף אחת לא רואה' },
  LW:  { he: 'כנף שמאל', short: 'כנף', group: 'ATT', desc: 'מהיר וחמקמק באגף שמאל, חותך פנימה ומבשל',
         heF: 'כנף שמאל', shortF: 'כנף', descF: 'מהירה וחמקמקה באגף שמאל, חותכת פנימה ומבשלת' },
  RW:  { he: 'כנף ימין', short: 'כנף', group: 'ATT', desc: 'מהיר וחמקמק באגף ימין, מגביה ובועט',
         heF: 'כנף ימין', shortF: 'כנף', descF: 'מהירה וחמקמקה באגף ימין, מגביהה ובועטת' },
  ST:  { he: 'חלוץ', short: 'חלוץ', group: 'ATT', desc: 'מספר 9. התפקיד שלו פשוט: להבקיע',
         heF: 'חלוצה', shortF: 'חלוצה', descF: 'מספר 9. התפקיד שלה פשוט: להבקיע' },
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
  goalkeeping: { he: '{{אימון שוערים|אימון שוערות}}', desc: 'צלילות, תפיסה, רפלקסים ומיקום ({{לשוערים|לשוערות}} בלבד)' },
  rest:        { he: 'מנוחה והתאוששות', desc: 'בלי התקדמות השבוע, אבל +15 אנרגיה ובלי סיכון לפציעה באימון' },
};

export const ROLES = { star: '{{כוכב הקבוצה|כוכבת הקבוצה}}', key: '{{שחקן מפתח|שחקנית מפתח}}', rotation: 'רוטציה', squad: '{{שחקן סגל|שחקנית סגל}}', prospect: 'כישרון צעיר' };

export const ODDS = { low: 'נמוך', mid: 'בינוני', high: 'גבוה' };

export const STAGES = { youth: '{{נוער|נערות}}', pro: '{{מקצוען|מקצוענית}}', free: '{{שחקן חופשי|שחקנית חופשית}}', retired: '{{פרש|פרשה}}' };

export const SELECTION = { starter: 'בהרכב', bench: 'על הספסל', out: 'מחוץ לסגל', injured: '{{פצוע|פצועה}}', suspended: '{{מורחק|מורחקת}}', youth: '{{קבוצת הנוער|קבוצת הנערות}}', national: 'בנבחרת' };

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
  coach_season: 'מאמן העונה', coach_year: 'מאמן השנה',
};

export const TROPHIES = {
  league: 'אליפות', league2: 'עלייה ליגה', cup: 'גביע', ucl: 'ליגת האלופות', uel: 'הליגה האירופית', uecl: 'הקונפרנס ליג',
  wc: 'גביע העולם', euro: 'אליפות אירופה', copa: 'קופה אמריקה', afcon: 'אליפות אפריקה', asian: 'גביע אסיה', gold: 'גביע הזהב',
  u17: 'אליפות עד 17', u19: 'אליפות עד 19', u21: 'אליפות עד 21', youth_league: 'אליפות נוער',
};

// ---------------------------------------------------------------------------
// Women's football names (contract C3). Same keys as the men's tables. The
// values match the engine's internal tables (js/engine/history.js, match.js).
// ---------------------------------------------------------------------------
export const AWARDS_W = {
  top_scorer: 'מלכת השערים', pots: 'שחקנית העונה', tots: 'נבחרת העונה', young_pots: 'השחקנית הצעירה של העונה',
  ucl_top_scorer: 'מלכת שערי ליגת האלופות לנשים', golden_boy: 'פרס הכישרון הצעיר', ballon_dor: 'כדור הזהב לנשים', bdo_top3: 'פודיום כדור הזהב לנשים',
  bdo_top10: 'טופ 10 בכדור הזהב לנשים', golden_boot_tour: 'מלכת שערי הטורניר', motm_final: 'שחקנית הגמר',
  coach_season: 'מאמנת העונה', coach_year: 'מאמנת השנה',
};

export const TROPHIES_W = {
  league: 'אליפות', league2: 'עלייה ליגה', cup: 'גביע', ucl: 'ליגת האלופות לנשים', uel: 'הליגה האירופית לנשים', uecl: 'הקונפרנס ליג לנשים',
  wc: 'גביע העולם לנשים', euro: 'אליפות אירופה לנשים', copa: 'קופה אמריקה לנשים', afcon: 'אליפות אפריקה לנשים', asian: 'גביע אסיה לנשים', gold: 'גביע הזהב לנשים',
  u17: 'אליפות עד 17 לנערות', u19: 'אליפות עד 19 לנערות', u21: 'אליפות עד 21', youth_league: 'אליפות נערות',
};

export const EURO_COMPS_W = {
  ucl:  { he: 'ליגת האלופות לנשים', short: 'האלופות' },
  uel:  { he: 'הליגה האירופית לנשים', short: 'האירופית' },
  uecl: { he: 'הקונפרנס ליג לנשים', short: 'הקונפרנס' },
};

export const TOURNAMENTS_W = {
  wc: 'גביע העולם לנשים', euro: 'יורו הנשים', copa: 'קופה אמריקה לנשים', afcon: 'אליפות אפריקה לנשים', asian: 'גביע אסיה לנשים', gold: 'גביע הזהב לנשים',
  u17: 'אליפות עד גיל 17 לנערות', u19: 'אליפות עד גיל 19 לנערות', u21: 'אליפות עד גיל 21 לנשים', qual: 'מוקדמות', friendly: 'משחק ידידות',
};

// Any competition id -> women's display name (he) and short form. Covers the
// leagues of js/data/leagues.js, their cups and youth leagues, the European
// cups and the national tournaments. Lookup order for a helper:
// COMP_NAMES_W[id] -> leagues.js nameHeW -> men's name + ' לנשים'.
export const COMP_NAMES_W = {
  // leagues
  isr1: { he: 'ליגת העל לנשים', short: 'ליגת העל' },
  isr2: { he: 'הליגה הלאומית לנשים', short: 'הלאומית' },
  eng1: { he: 'הסופר ליג לנשים', short: 'סופר ליג' },
  eng2: { he: 'הצ׳מפיונשיפ לנשים', short: 'צ׳מפיונשיפ' },
  esp1: { he: 'ליגה F', short: 'ליגה F' },
  ita1: { he: 'הסרייה A לנשים', short: 'סרייה A' },
  ger1: { he: 'הבונדסליגה לנשים', short: 'בונדסליגה' },
  fra1: { he: 'הפרמייר ליג הצרפתית לנשים', short: 'ליגה צרפתית' },
  por1: { he: 'הליגה הפורטוגלית לנשים', short: 'ליגה פורטוגל' },
  ned1: { he: 'הארדיביזי לנשים', short: 'ארדיביזי' },
  bel1: { he: 'הסופר ליג הבלגית לנשים', short: 'ליגה בלגית' },
  tur1: { he: 'הסופר ליג הטורקית לנשים', short: 'סופר ליג' },
  sco1: { he: 'הפרמייר ליג הסקוטית לנשים', short: 'ליגה סקוטית' },
  gre1: { he: 'הליגה היוונית לנשים', short: 'ליגה יוונית' },
  ksa1: { he: 'הליגה הסעודית לנשים', short: 'ליגה סעודית' },
  usa1: { he: 'NWSL', short: 'NWSL' },
  bra1: { he: 'הברזיליירו לנשים', short: 'ברזיליירו' },
  arg1: { he: 'הליגה הארגנטינאית לנשים', short: 'ליגה ארגנטינה' },
  // cups
  isr_cup: { he: 'גביע המדינה לנשים', short: 'הגביע' },
  eng_cup: { he: 'הגביע האנגלי לנשים', short: 'הגביע' },
  esp_cup: { he: 'גביע המלכה', short: 'הגביע' },
  ita_cup: { he: 'גביע איטליה לנשים', short: 'הגביע' },
  ger_cup: { he: 'גביע גרמניה לנשים', short: 'הגביע' },
  fra_cup: { he: 'גביע צרפת לנשים', short: 'הגביע' },
  por_cup: { he: 'גביע פורטוגל לנשים', short: 'הגביע' },
  ned_cup: { he: 'גביע הולנד לנשים', short: 'הגביע' },
  bel_cup: { he: 'גביע בלגיה לנשים', short: 'הגביע' },
  tur_cup: { he: 'גביע טורקיה לנשים', short: 'הגביע' },
  sco_cup: { he: 'הגביע הסקוטי לנשים', short: 'הגביע' },
  gre_cup: { he: 'גביע יוון לנשים', short: 'הגביע' },
  ksa_cup: { he: 'הגביע הסעודי לנשים', short: 'הגביע' },
  usa_cup: { he: 'גביע האתגר של NWSL', short: 'הגביע' },
  bra_cup: { he: 'גביע ברזיל לנשים', short: 'הגביע' },
  arg_cup: { he: 'גביע ארגנטינה לנשים', short: 'הגביע' },
  // European cups
  ucl: { he: 'ליגת האלופות לנשים', short: 'האלופות' },
  uel: { he: 'הליגה האירופית לנשים', short: 'האירופית' },
  uecl: { he: 'הקונפרנס ליג לנשים', short: 'הקונפרנס' },
  // national tournaments
  wc: { he: 'גביע העולם לנשים', short: 'המונדיאל' },
  euro: { he: 'יורו הנשים', short: 'היורו' },
  copa: { he: 'קופה אמריקה לנשים', short: 'הקופה' },
  afcon: { he: 'אליפות אפריקה לנשים', short: 'אליפות אפריקה' },
  asian: { he: 'גביע אסיה לנשים', short: 'גביע אסיה' },
  gold: { he: 'גביע הזהב לנשים', short: 'גביע הזהב' },
  u17: { he: 'אליפות עד גיל 17 לנערות', short: 'עד 17' },
  u19: { he: 'אליפות עד גיל 19 לנערות', short: 'עד 19' },
  u21: { he: 'אליפות עד גיל 21 לנשים', short: 'עד 21' },
};

// National team naming. {nation} = country nameHe.
export const NATIONAL_TEAM_NAME = {
  m: 'נבחרת {nation}', f: 'נבחרת {nation} לנשים',
  youthM: 'נבחרת הנוער של {nation}', youthF: 'נבחרת הנערות של {nation}',
  u21M: 'נבחרת הצעירה של {nation}', u21F: 'נבחרת הצעירות של {nation}',
};

// Gender choice and words used by the wizard / UI (contract C1).
export const GENDER_LABELS = {
  m: { id: 'm', he: 'בן', role: 'שחקן', kid: 'ילד', hero: 'הילד מהשכונה', pronoun: 'הוא', you: 'אתה', world: 'כדורגל גברים', emoji: '👦' },
  f: { id: 'f', he: 'בת', role: 'שחקנית', kid: 'ילדה', hero: 'הילדה מהשכונה', pronoun: 'היא', you: 'את', world: 'כדורגל נשים', emoji: '👧' },
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

// partner is written as the opposite gender of the player.
export const PERSONAS = {
  mom:            { he: 'אמא', avatar: '👩‍🍳' },
  dad:            { he: 'אבא', avatar: '👨' },
  friends:        { he: '{{החבר׳ה מהשכונה|החברות מהשכונה}}', avatar: '⚽', group: true },
  agent:          { he: 'הסוכן', avatar: '🕴️' },
  coach:          { he: 'המאמן', avatar: '📋' },
  journalist:     { he: 'עיתונאי', avatar: '🎙️' },
  sponsor:        { he: 'ספונסר', avatar: '💼' },
  partner:        { he: '{{בת הזוג|בן הזוג}}', avatar: '❤️' },
  social:         { he: 'רשתות חברתיות', avatar: '📱' },
  captain:        { he: '{{הקפטן|הקפטנית}}', avatar: '©️' },
  fan:            { he: '{{אוהד|אוהדת}}', avatar: '📣' },
  brother:        { he: 'אח קטן', avatar: '🧒' },
  grandma:        { he: 'סבתא', avatar: '👵' },
  national_coach: { he: 'מאמן הנבחרת', avatar: '🏳️' },
  owner:          { he: 'בעלי המועדון', avatar: '🎩' },
  doctor:         { he: 'הרופא', avatar: '🩺' },
  club:           { he: 'המועדון', avatar: '🏟️' },
  system:         { he: 'הילד מהשכונה', avatar: '⭐' },
  board:          { he: 'ההנהלה', avatar: '🏛️' },
  federation:     { he: 'ההתאחדות לכדורגל', avatar: '🏳️' },
  staff:          { he: 'הצוות המקצועי', avatar: '📋' },
};

export const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export const LEGACY_TIERS = [
  { min: 0, he: '{{שחקן ליגה|שחקנית ליגה}}' },
  { min: 60, he: '{{שחקן מוערך|שחקנית מוערכת}}' },
  { min: 160, he: '{{כוכב|כוכבת}}' },
  { min: 320, he: 'אגדה' },
  { min: 550, he: 'אגדה של כל הזמנים' },
];

// Numbers are binding (SPEC §5.15). minAge omitted = no limit. fam_* items cannot be sold.
// Prices are the men's scale; the engine applies S.econ (C3) for women's careers.
export const SHOP_ITEMS = [
  { id: 'car_old',        cat: 'car',    he: 'הסובארו הישנה של הדוד', price: 3000,    upkeep: 20,   morale: 1,  minAge: 18, desc: 'נוסעת. בדרך כלל.' },
  { id: 'car_city',       cat: 'car',    he: 'קיה פיקנטו חדשה',        price: 15000,   upkeep: 60,   morale: 2,  minAge: 18, desc: 'קטנה, חסכונית, נכנסת לכל חניה' },
  { id: 'car_family',     cat: 'car',    he: 'מאזדה 3',                price: 35000,   upkeep: 120,  morale: 3,  minAge: 18, desc: 'רכב של {{שחקן רציני|שחקנית רצינית}}' },
  { id: 'car_lux',        cat: 'car',    he: 'אאודי RS',               price: 120000,  upkeep: 450,  morale: 5,  minAge: 18, desc: 'כל השכונה תשמע אותך {{מגיע|מגיעה}}' },
  { id: 'car_super',      cat: 'car',    he: 'למבורגיני',              price: 450000,  upkeep: 1800, morale: 8,  minAge: 18, desc: 'אבא כבר מבקש לנהוג רק סיבוב אחד' },
  { id: 'home_room',      cat: 'home',   he: 'שיפוץ החדר אצל ההורים',  price: 8000,    upkeep: 0,    morale: 2,                desc: 'בלי הפוסטרים מכיתה ח׳. טוב, רק חלק' },
  { id: 'home_apt',       cat: 'home',   he: 'דירת 3 חדרים בעיר',      price: 250000,  upkeep: 400,  morale: 4,  minAge: 18, desc: 'סוף סוף לבד. אמא עדיין מביאה אוכל' },
  { id: 'home_pent',      cat: 'home',   he: 'פנטהאוז מול הים',        price: 1800000, upkeep: 2500, morale: 7,  minAge: 18, desc: 'נוף לים ומרפסת למנגלים' },
  { id: 'home_villa',     cat: 'home',   he: 'וילה עם בריכה',          price: 6000000, upkeep: 6000, morale: 10, minAge: 18, desc: '{{החבר׳ה כבר עברו|החברות כבר עברו}} לגור אצלך. בערך' },
  { id: 'fam_trip',       cat: 'family', he: 'טיסה משפחתית לחו״ל',     price: 12000,   upkeep: 0,    morale: 2,                desc: 'אבא כבר מכין רשימת ציוד' },
  { id: 'fam_parents',    cat: 'family', he: 'שיפוץ הבית של ההורים',   price: 90000,   upkeep: 0,    morale: 5,                desc: 'מטבח חדש לאמא, ספה חדשה לאבא' },
  { id: 'fam_field',      cat: 'family', he: 'מגרש חדש בשכונה',        price: 400000,  upkeep: 0,    morale: 6,  fans: 5,      desc: 'דשא סינתטי, תאורה, ושלט עם השם שלך' },
  { id: 'style_wardrobe', cat: 'style',  he: 'ארון בגדים של מעצבים',   price: 20000,   upkeep: 0,    morale: 1,                desc: '{{החבר׳ה יצחקו. ואז יבקשו לשאול חולצה|החברות יצחקו. ואז יבקשו לשאול שמלה}}' },
  { id: 'style_watch',    cat: 'style',  he: 'שעון יוקרה',             price: 40000,   upkeep: 0,    morale: 2,                desc: 'מראה את השעה. ואת המשכורת' },
  // v2.1 store (R4): jewellery, gear, investments. Negative upkeep = weekly return.
  { id: 'jewel_chain',    cat: 'watch',  he: 'שרשרת זהב',              price: 18000,   upkeep: 0,    morale: 1,                desc: 'נוצצת בכל תמונה מהמנהרה' },
  { id: 'jewel_ring',     cat: 'watch',  he: 'טבעת יהלום',             price: 75000,   upkeep: 0,    morale: 3,  minAge: 18,   desc: 'יהלום אמיתי. מושלם לחגיגת שער' },
  { id: 'watch_gold',     cat: 'watch',  he: 'שעון זהב במהדורה מוגבלת', price: 220000, upkeep: 0,    morale: 4,  minAge: 18, fans: 1, desc: 'רק 50 נוצרו בעולם. אחד מהם על היד שלך' },
  { id: 'gear_boots',     cat: 'gear',   he: 'נעליים בעיצוב אישי',     price: 2500,    upkeep: 0,    morale: 1,                desc: 'עם השם שלך רקום בצד' },
  { id: 'gear_headphones', cat: 'gear',  he: 'אוזניות פרימיום',        price: 1500,    upkeep: 0,    morale: 1,                desc: 'הפלייליסט של לפני המשחק נשמע אחרת' },
  { id: 'invest_fund',    cat: 'invest', he: 'קרן מדדים',              price: 50000,   upkeep: -60,  morale: 1,  minAge: 18,   desc: 'כסף שעובד בשבילך. תשואה קטנה כל שבוע' },
  { id: 'biz_cafe',       cat: 'invest', he: 'בית קפה בשכונה',         price: 300000,  upkeep: -420, morale: 2,  minAge: 18, fans: 2, desc: 'הקפה הכי טוב בשכונה, והתמונה שלך על הקיר' },
  { id: 'academy_kids',   cat: 'invest', he: 'אקדמיית כדורגל לילדים',  price: 1200000, upkeep: -1500, morale: 4, minAge: 21, fans: 5, desc: 'הדור הבא של השכונה מתאמן אצלך' },
];

export const RESULT_LABELS = { W: 'ניצחון', D: 'תיקו', L: 'הפסד' };

export const ALERTS = {
  contract_expiring: 'החוזה שלך מסתיים בסוף העונה',
  injured: '{{אתה פצוע|את פצועה}}',
  callup: 'זומנת לנבחרת!',
  window_open: 'חלון ההעברות פתוח',
  offer: 'יש לך הצעה חדשה',
  energy_low: 'האנרגיה נמוכה. כדאי לנוח',
  suspended: '{{אתה מורחק|את מורחקת}} למשחק הבא',
  free_agent: '{{אתה שחקן חופשי. בדוק|את שחקנית חופשית. בדקי}} הצעות',
  season_review: 'סיכום העונה מחכה לך',
  info: '',
};

export const FORMAT_LABELS = { double_rr: 'ליגה כפולה', double_rr_split: 'ליגה + פלייאוף', triple_rr_split: 'ליגה משולשת + פיצול' };

// ---------------------------------------------------------------------------
// Extra (optional) shared screen copy. Placeholders in braces ({n}, {v}, {slot},
// {minute}...) are filled by the UI with simple replace. Strings may contain
// {{male|female}} markers: resolve with js/ui/gender.js gtext() first.
// ---------------------------------------------------------------------------
export const UI_TEXT = {
  app: {
    name: 'הילד מהשכונה',
    tagline: 'מהשכונה ועד הבאלון ד׳אור',
    taglineG: '{{מהשכונה ועד הבאלון ד׳אור|מהשכונה ועד כדור הזהב}}',
    hero: '{{הילד מהשכונה|הילדה מהשכונה}}',
    loading: 'טוען...',
    noscript: 'כדי לשחק ב"הילד מהשכונה" צריך להפעיל JavaScript בדפדפן.',
  },
  common: {
    ok: 'אישור', cancel: 'ביטול', back: 'חזרה', close: 'סגור', continue: 'המשך', yes: 'כן', no: 'לא',
    save: 'שמור', copy: 'העתק', copied: 'הועתק ✓', share: 'שתף', send: 'שלח', delete: 'מחק', retry: 'נסה שוב',
    later: 'לא עכשיו', confirm: 'בטוח?', areYouSure: '{{אתה בטוח|את בטוחה}}?', error: 'משהו השתבש. נסה שוב',
    offline: 'אין חיבור לאינטרנט. המשחק ממשיך לעבוד כרגיל', week: 'שבוע', season: 'עונה', age: 'גיל',
    ovr: 'יכולת', potential: 'פוטנציאל', money: 'כסף', energy: 'אנרגיה', morale: 'מורל', form: 'כושר',
    trust: 'אמון המאמן', fans: 'אהבת הקהל', mates: 'יחסים בקבוצה', value: 'שווי שוק', wage: 'משכורת', perWeek: 'לשבוע',
    player: '{{שחקן|שחקנית}}',
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
    replayIntro: 'צפה שוב בפתיחה',
    boy: 'בן', girl: 'בת',
  },
  // C1: gender choice. Shown BEFORE a gender exists, so these are neutral.
  gender: {
    step: 'בן או בת?',
    title: 'מי יוצא לדרך מהשכונה?',
    hint: 'הבחירה קובעת את כל העולם של הקריירה: כדורגל גברים או כדורגל נשים, השמות, הפרסים והתחרויות.',
    boy: 'בן', girl: 'בת',
    boyRole: 'שחקן', girlRole: 'שחקנית',
    boyWorld: 'כדורגל גברים', girlWorld: 'כדורגל נשים',
    boyHero: 'הילד מהשכונה', girlHero: 'הילדה מהשכונה',
    look: 'מראה', skin: 'גוון עור', hair: 'שיער', kit: 'צבעי החולצה', number: 'מספר על הגב',
    random: 'הגרלה',
    changeLater: 'אי אפשר לשנות אחרי שהקריירה מתחילה',
  },
  create: {
    stepName: 'איך קוראים לך?', first: 'שם פרטי', last: 'שם משפחה', nick: 'כינוי (לא חובה)', nickHint: 'ככה יקראו לך בשכונה',
    stepNation: 'מאיזו מדינה {{אתה|את}}?', searchNation: '{{חפש|חפשי}} מדינה...',
    stepPosition: 'באיזו עמדה {{אתה משחק|את משחקת}}?', foot: 'רגל חזקה', footR: 'ימין', footL: 'שמאל',
    stepClub: 'באיזו מחלקת {{נוער אתה מתחיל|נערות את מתחילה}}?', noLeagueNote: 'למדינה שלך אין ליגה במשחק. {{בחר|בחרי}} אקדמיה בכל ליגה {{שתרצה|שתרצי}}',
    stepSummary: '{{מוכן|מוכנה}} לצאת לדרך?', chooseSlot: 'באיזו משבצת לשמור?', slotTaken: 'המשבצת תפוסה. הקריירה הקיימת תעבור לשחזור',
    next: 'הבא', start: '{{צא|צאי}} לדרך!', scoutTitle: 'דו״ח סקאוט', scoutOk: 'יאללה, מתחילים',
    errName: 'צריך שם פרטי ושם משפחה',
  },
  hub: {
    playWeek: 'שחק את השבוע', resumeWeek: 'המשך את השבוע', toMatch: 'למשחק', seasonReview: 'סיכום העונה',
    thisWeek: 'השבוע', noFixture: 'אין משחק השבוע', training: 'אימון השבוע',
    fastForward: 'הרצה מהירה', ffNextMatch: 'עד המשחק הבא', ffSeasonEnd: 'עד סוף העונה', ffSkipSummer: 'דלג על הקיץ',
    ffProgress: 'שבוע {n}...', ffStop: 'עצור',
    alerts: 'התראות', quickLinks: 'קיצורים',
    weekSummary: 'סיכום השבוע', weekOk: 'המשך', newMessages: '{n} הודעות חדשות', newOffers: '{n} הצעות חדשות',
    newMessage: 'הודעה חדשה', newOffer: 'הצעה חדשה',
    ovrChange: 'שינוי ביכולת',
  },
  match: {
    start: 'יאללה!', autoplay: 'שחק אוטומטית', finish: 'סיכום', continue: 'המשך',
    goalFlash: 'גוללל!', starter: 'בהרכב', benchOn: '{{נכנס|נכנסת}} מהספסל בדקה {minute}', minute: 'דקה',
    rating: 'ציון', motm: '{{שחקן המשחק|שחקנית המשחק}}', goals: 'שערים', assists: 'בישולים', odds: 'סיכוי', fullTime: 'סיום',
  },
  // C5: watch mode (default) and the replay controls.
  watch: {
    title: 'צפייה במשחק', live: 'שידור חי', kickoff: 'שריקת פתיחה', watch: 'צפה במשחק',
    play: 'המשך', pause: 'השהה', speed: 'מהירות', speed1: 'x1', speed2: 'x2', speed4: 'x4',
    skip: 'דלג לסיום', skipConfirm: 'לדלג לסיום המשחק?', toSummary: 'לסיכום המשחק',
    minute: 'דקה {minute}', ht: 'מחצית', ft: 'סיום', et: 'הארכה', pens: 'פנדלים', addedTime: '+{n}',
    events: 'אירועי המשחק', lineups: 'הרכבים', subs: 'חילופים', bench: 'ספסל', stats: 'סטטיסטיקה',
    possession: 'החזקת כדור', shots: 'בעיטות', onTarget: 'למסגרת', corners: 'קרנות', cards: 'כרטיסים', fouls: 'עבירות',
    goal: 'גול', sub: 'חילוף', yellow: 'צהוב', red: 'אדום', own: 'שלנו', opp: 'יריבה',
    subIn: 'נכנס', subOut: 'יצא', subInF: 'נכנסה', subOutF: 'יצאה',
    youOn: '{{אתה נכנס|את נכנסת}} למגרש!', youOff: 'הוחלפת. משחק טוב', youBench: '{{אתה|את}} על הספסל',
    youStart: '{{אתה|את}} בהרכב!', youNotSquad: '{{אתה|את}} מחוץ לסגל הפעם',
    myRating: 'הציון שלך', myGoals: 'השערים שלך', motm: '{{שחקן המשחק|שחקנית המשחק}}',
    tapToSkip: 'הקש כדי לדלג', soundOn: 'קול הקהל: פועל', soundOff: 'קול הקהל: כבוי',
    bigGoal: 'גוללללל!', megaGoal: 'גוללללללל!!!', hatTrick: 'שלושער!!!', lateWinner: 'ברגע האחרון!!!', equaliser: 'שוויון!',
    finalScore: 'תוצאת סיום', result: { W: 'ניצחון!', D: 'תיקו', L: 'הפסד' },
  },
  // C8: opening cinematic.
  intro: {
    skip: 'דלג', tapToSkip: 'הקש כדי לדלג',
    line1: 'שכונה אחת. כדור אחד.',
    line2: 'חלום אחד.',
    line3: 'מהמגרש מתחת לבניין...',
    line4: '...ועד האצטדיונים הגדולים בעולם',
    title: 'הילד מהשכונה',
    titleG: '{{הילד מהשכונה|הילדה מהשכונה}}',
    cta: 'יאללה, מתחילים',
  },
  // C9: celebration overlay (see also commentary.js CELEBRATION_TEXT).
  celebrate: {
    goal: 'גוללללל!', mega: 'גוללללללל!!!', save: 'איזו הצלה!', win: 'ניצחון!', trophy: '{{אלופים|אלופות}}!!!',
    tap: 'הקש להמשך',
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
    // C5 setting: ctx.settings.decisions (default false = watch mode)
    matchTitle: 'משחקים',
    decisions: 'החלטות במשחק',
    decisionsNote: 'כבוי (מומלץ): צופים במשחק המלא בזמן אמת, עם חילופים, שערים וחגיגות. דלוק: המשחק עוצר ברגעי מפתח {{ואתה בוחר|ואת בוחרת}} מה לעשות.',
    decisionsOn: 'אני רוצה להחליט ברגעים הגדולים',
    watchSpeed: 'מהירות צפייה ברירת מחדל',
    crowdSound: 'קולות קהל ותופים',
    introReplay: 'הצג שוב את סרטון הפתיחה',
    introAuto: 'סרטון פתיחה בכל כניסה',
    aboutTitle: 'אודות',
    version: 'גרסה {v}',
    checkUpdate: 'בדוק עדכונים',
    upToDate: 'יש לך את הגרסה האחרונה ✓',
    credits: 'משחק קריירה בעברית. כל השמות של השחקנים והשחקניות בדיוניים, וכל הסמלים עיצוב מקורי.',
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
