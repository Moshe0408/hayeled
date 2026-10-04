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
  rest:        { he: 'מנוחה והתאוששות', desc: 'בלי התקדמות השבוע, אבל האנרגיה חוזרת, העומס יורד ואין סיכון לפציעה באימון. יותר מדי מנוחה מוריד את החדות' },
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
  physio:         { he: 'הפיזיותרפיסט', avatar: '🩹' },
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
  load_high: 'העומס גבוה. שבוע של אימון קל יוריד אותו',
  load_burnt: '{{אתה שחוק|את שחוקה}}. אימון קל או מנוחה, לפני שהמהירות והפיזיות ירדו',
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
    telemetryNote: 'אנחנו אוספים נתוני שימוש אנונימיים (מזהה מכשיר אקראי, כמה זמן משחקים, אירועים במשחק) ואת השם שכתבת לדמות, בדיוק כמו שכתבת אותו, כדי לשפר את המשחק. אם זה השם האמיתי שלך, גם הוא יישלח, אז אפשר להמציא שם. בלי מיקום ובלי אנשי קשר. אפשר לכבות בכל רגע.',
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

// ---------------------------------------------------------------------------
// v2.2: training load, sharpness and bench talks (docs/SPEC-2.2-training-bench.md).
// All strings may carry {{male|female}} markers (resolve with gtext / g()).
// Placeholders are listed per table; the engine must fill every one it uses.
// Numbers with a sign go through signedLtr / sgnHe BEFORE they are put into {v}.
// In RTL copy the "from -> to" arrow is written '←' (it points right-to-left).
// ---------------------------------------------------------------------------

// Training intensity (S.trainInt). tone = colour family for the UI (no emoji).
export const TRAIN_INTENSITY = {
  light:   { he: 'קל', tone: 'green', desc: 'שומר על האנרגיה ומוריד עומס. התקדמות איטית יותר' },
  normal:  { he: 'רגיל', tone: 'blue', desc: 'האימון הרגיל: התקדמות יציבה ועומס קטן' },
  hard:    { he: 'קשה', tone: 'orange', desc: 'התקדמות מהירה, אבל האנרגיה יורדת והעומס עולה' },
  extreme: { he: 'קיצוני', tone: 'red', desc: 'הכי מהר שאפשר, במחיר כבד: אנרגיה, עומס וסיכון לפציעה', lockHe: 'נפתח מגיל 16', warnHe: 'סיכון לפציעה' },
};

// Load bands (p.load). he = adjective of the player (gendered); desc = effect.
export const LOAD_BANDS = {
  fresh: { he: '{{רענן|רעננה}}', min: 0, max: 39, tone: 'green', desc: 'הגוף מוכן. אין השפעה על המשחק' },
  tired: { he: '{{עייף|עייפה}}', min: 40, max: 59, tone: 'yellow', desc: 'קצת פחות חדות במשחק ובבחירת ההרכב' },
  heavy: { he: '{{עמוס|עמוסה}}', min: 60, max: 79, tone: 'orange', desc: 'הביצועים במשחק נפגעים והסיכון לפציעה עולה' },
  burnt: { he: '{{שחוק|שחוקה}}', min: 80, max: 100, tone: 'red', desc: 'הגוף גמור. המאמן עלול להשאיר אותך בחוץ, ושבועות כאלה פוגעים במהירות ובכוח' },
};

// Sharpness (p.sharp). he agrees with the word "חדות" (feminine noun, not the player): "חדות: גבוהה". "כושר" stays the
// word for match form (recent ratings); sharpness is always "חדות" so the two never mix.
// heP = adjective of the player (gendered). Suggested ranges; the engine owns the
// cut-offs (the rusty event fires under 35).
export const SHARPNESS = {
  sharp:  { he: 'גבוהה', heP: '{{חד|חדה}}', min: 70, max: 100, tone: 'green' },
  normal: { he: 'רגילה', heP: 'בקצב', min: 35, max: 69, tone: 'blue' },
  rusty:  { he: 'נמוכה', heP: '{{חלוד|חלודה}}', min: 0, max: 34, tone: 'red' },
};

// Weekly training-injury risk label (getTrainingPreview().injuryRiskHe).
// Suggested: 0 -> none, < 0.5% -> low, < 2% -> mid, else high.
export const INJURY_RISK = { none: 'אין', low: 'נמוך', mid: 'בינוני', high: 'גבוה' };

// Hub training card, preview line, week summary and profile copy.
// Preview = parts joined by sep: "אנרגיה -9 · עומס +9 · התקדמות ×1.25 · סיכון פציעה: בינוני".
// One word per stat in the whole game: energy = "אנרגיה" (the hub bar), sharpness = "חדות", form = "כושר".
export const TRAINING_UI = {
  focusLabel: 'פוקוס',
  intensityLabel: 'עוצמה',
  energyLabel: 'אנרגיה',
  loadLabel: 'עומס',
  sharpLabel: 'חדות',
  previewTitle: 'מה האימון יעשה השבוע',
  preview: { energy: 'אנרגיה {v}', load: 'עומס {v}', growth: 'התקדמות ×{v}', noGrowth: 'בלי התקדמות', sharp: 'חדות {v}', risk: 'סיכון פציעה: {v}', sep: ' · ' },
  restNote: 'מנוחה היא תמיד קלה',
  sharpTag: 'חדות: {v}',
  previewCost: 'עלות האימון השבוע',
  previewAfter: 'בסוף השבוע, לפני משחקים: אנרגיה {e} · עומס {l}',
  loadTag: 'עומס {v} ({band})',
  loadChartTitle: 'עומס ב־8 השבועות האחרונים',
  loadChartEmpty: 'עוד אין מספיק שבועות לגרף',
  talkBtn: 'לדבר עם המאמן',
  // week summary: {e0} {e1} {l0} {l1} numbers, {band} = LOAD_BANDS[x].he, {s0} {s1} sharp
  weekLine: 'אנרגיה {e0} ← {e1} · עומס {l0} ← {l1} ({band})',
  weekSharp: 'חדות {s0} ← {s1}',
  // week summary training line: "<focus>: +0.1 בעיטה · אימון קשה"; {v} = intensity label
  weekIntensity: 'אימון {v}',
  weekPhysio: 'אימון קל לפי הפיזיותרפיסט',
  // hub training card while the physio's one-week light override is on
  physioNote: 'הפיזיותרפיסט הוריד לך את העוצמה לשבוע אחד: אימון קל. אפשר לבחור עוצמה אחרת',
};

// getTrainingPreview().warnHe candidates (pick the most relevant one, or none).
export const TRAINING_WARN = {
  locked: 'קיצוני נפתח מגיל 16',
  extreme: 'סיכון לפציעה. אימון כזה כדאי רק {{כשאתה רענן|כשאת רעננה}}',
  highLoad: 'העומס כבר גבוה. אימון קשה עכשיו מגדיל מאוד את הסיכון לפציעה',
  burnt: '{{אתה שחוק|את שחוקה}}. עוד שבועות כאלה יורידו את המהירות והפיזיות',
  lowEnergy: 'האנרגיה נמוכה. אימון קשה יכניס אותך למשחק {{עייף|עייפה}}',
  rusty: 'החדות יורדת. עוד מנוחה, {{ותחליד|ותחלידי}}',
  restLong: 'כבר כמה שבועות של מנוחה. החדות מתחילה לרדת',
  // {n} = the load after this week
  intoBurnt: 'האימון הזה ייקח את העומס ל-{n}. מ-80 {{אתה נשחק|את נשחקת}}, והמהירות והפיזיות מתחילות לרדת',
  burntLight: '{{אתה שחוק|את שחוקה}}. שבוע קל יוריד את העומס ל-{n}',
  burntNormal: '{{אתה שחוק|את שחוקה}}. אימון קל או מנוחה יורידו את העומס מהר יותר',
  restLoad: 'מנוחה תוריד את העומס ל-{n}',
  veteranPhysical: 'בגיל שלך אימון כושר קשה מאט את הירידה, אבל העומס גבוה',
};

// Short system lines for the inbox / week summary. Placeholder: {injury} = injury name.
export const LOAD_TEXT = {
  trainInjury: [
    'נפצעת באימון: {injury}',
    'עצירה חדה בתרגיל, {{ואתה יוצא|ואת יוצאת}} מהאימון בצליעה: {injury}',
    'האימון נגמר מוקדם בשבילך. {injury}',
    'מגע לא מוצלח באימון, והפיזיותרפיסט כבר עם הקרח: {injury}',
  ],
  trainInjuryHeavy: [
    'הגוף היה עמוס מדי, ונפצעת באימון: {injury}',
    'הפיזיותרפיסט הזהיר. נפצעת באימון: {injury}',
    'עומס גבוה ואימון קשה זה שילוב מסוכן. נפצעת באימון: {injury}',
    'השרירים לא החזיקו. נפצעת באימון: {injury}',
  ],
  restedByCoach: [
    'המאמן השאיר אותך בחוץ: "{{אתה גמור|את גמורה}} פיזית. {{תנוח|תנוחי}} השבוע."',
    'לא בהרכב השבוע. המאמן: "{{אני צריך אותך רענן|אני צריך אותך רעננה}} לחודש הבא, לא {{שבור|שבורה}} עכשיו."',
    'המאמן נתן לך מנוחה מהמשחק. העומס אצלך בשמיים',
    'הצוות המקצועי המליץ, והמאמן הסכים: השבוע {{אתה נח|את נחה}}',
  ],
  burnoutLine: 'שחיקה: המהירות והפיזיות ירדו',
  burnoutLineGk: 'שחיקה: המהירות, הפיזיות והרפלקסים ירדו',
  promiseKeptLine: 'המאמן עמד במילה',
  promiseBrokenLine: 'המאמן לא עמד בהבטחה',
  poorChanceLine: 'קיבלת הזדמנות ולא ניצלת אותה',
  preseasonLine: 'קדם־עונה: החדות עולה מהר',
};

// Coach talk (#/coach-talk). Paths read by js/engine/talk.js (lines([...])):
//   approach.ask | demand | threat | threatLoan   button text = the player's own bubble (strings)
//   open.bench | tired | broken | loan | youth    coach's first line ({n} = benchRun in bench/youth)
//   reply.<approach>.ok | fail, reply.threat.loanFail   coach's answer
//   tired          replaces a failed answer when the player is burnt (load >= 80)
//   punish         appended to a failed demand (the 30% "sit next match too")
//   promiseKept / promiseBroken   sent by the AGENT after the promise games (third person, {coach})
//   poorChance     sent by the coach (rating < 6.0 in the promise games)
//   national       national coach, after 3 call-ups without minutes (text only)
// Extra keys for the UI / future engine use: approachInfo, say, open.lowMin | third | default,
// reply.threat.loanOk, reasons, result, promiseHe, effectsHe.
// Placeholders: {coach} {club} {n} only ({n} only where noted; reasons.cooldown {n} = weeks).
// The coach is male in both worlds; the player's words and the teammates follow the career.
export const COACH_TALK = {
  title: 'שיחה עם המאמן',
  button: 'לדבר עם המאמן',
  typing: 'מקליד...',
  pickHe: 'איך {{אתה פונה|את פונה}}?',
  oddsHe: 'סיכוי: {v}',
  approach: {
    ask: 'אפשר לדבר? אני רוצה הזדמנות',
    demand: 'מגיע לי לפתוח. אני {{דורש|דורשת}} דקות',
    threat: 'אם לא אשחק, אבקש לעזוב',
    threatLoan: 'אם לא אשחק, אבקש לחזור לקבוצה שלי',
  },
  approachInfo: {
    ask: { he: 'בקשה', hint: 'סיכוי טוב ותגובה עדינה' },
    demand: { he: 'דרישה', hint: 'סיכוי נמוך יותר. זה יכול לעבוד, אבל המאמן לא אוהב לחץ' },
    threat: { he: 'איום בעזיבה', hint: 'הכול או כלום: מקום בהרכב, או בקשת העברה' },
  },
  // Optional longer player bubbles (one may be picked instead of the button text).
  say: {
    ask: [
      'המאמן, אפשר דקה? אני רוצה הזדמנות.',
      'אני לא {{בא|באה}} להתלונן. אני רק {{מבקש|מבקשת}} הזדמנות להראות מה אני שווה.',
      'אני {{עובד|עובדת}} קשה באימונים, ואני {{מרגיש מוכן|מרגישה מוכנה}}. תן לי צ׳אנס.',
      'אני רוצה לעזור לקבוצה. מה אני {{צריך|צריכה}} לעשות כדי לפתוח?',
      'אפשר לדבר בכנות? קשה לי על הספסל, ואני {{בטוח שאני יכול|בטוחה שאני יכולה}} לתת יותר.',
      'אני {{מכבד|מכבדת}} את ההחלטות שלך. רק תן לי משחק אחד מההתחלה.',
    ],
    demand: [
      'מגיע לי לפתוח. אני {{דורש|דורשת}} דקות.',
      'אני {{טוב יותר ממי שמשחק|טובה יותר ממי שמשחקת}} במקומי, וכולם רואים את זה.',
      'לא הגעתי לפה כדי לשבת. אני רוצה לשחק, וזהו.',
      'אני {{נותן|נותנת}} הכול באימונים ולא {{מקבל|מקבלת}} כלום. זה לא הוגן.',
      'אני {{צריך|צריכה}} דקות עכשיו, לא בעוד חודש.',
      'תסתכל על המספרים שלי. מגיע לי לפתוח.',
    ],
    threat: [
      'אם לא אשחק, אבקש לעזוב.',
      'אני אגיד את זה ישר: עוד משחק על הספסל, ואני {{מבקש|מבקשת}} העברה.',
      'יש קבוצות שרוצות אותי. אם פה לא צריכים אותי, אני {{הולך|הולכת}}.',
      'אני לא {{מוכן|מוכנה}} לבזבז עוד עונה על הספסל. או {{שאני משחק, או שאני עוזב|שאני משחקת, או שאני עוזבת}}.',
      'הסוכן שלי כבר שואל מה קורה. מה אני אגיד לו?',
      'אני {{אוהב|אוהבת}} את המועדון, אבל לא אשאר פה כדי לשבת.',
    ],
    // youth stage (no agent, no transfer list): the threat to the academy coach
    threatYouth: [
      'אם לא אשחק, אבקש לעזוב.',
      'אם לא אשחק פה, אני {{מבקש|מבקשת}} לעבור למחלקה אחרת.',
      'אני לא {{מוכן|מוכנה}} לשבת עוד עונה על הספסל. אני אדבר עם ההורים על לעזוב.',
      'יש עוד מחלקות נוער שרוצות אותי. אם פה לא צריכים אותי, אני {{הולך|הולכת}}.',
    ],
  },
  open: {
    bench: [
      'כן, {{תיכנס|תיכנסי}}. אני מניח שזה על {n} המשחקים האחרונים על הספסל.',
      '{{שב|שבי}}. אני יודע למה באת: {n} משחקים בלי הרכב. אני מקשיב.',
      'הדלת פתוחה. {n} משחקים על הספסל, נכון? {{דבר|דברי}}.',
      '{n} משחקים {{שאתה מחמם|שאת מחממת}} את הספסל. אני לא עיוור. מה על הלב?',
      'קפה? {{תשב|תשבי}}. אחרי {n} משחקים בחוץ, ברור לי שיש לך מה להגיד.',
    ],
    lowMin: [
      '{n} משחקים {{שאתה נכנס|שאת נכנסת}} רק לדקות האחרונות. אני יודע. {{דבר|דברי}} איתי.',
      '{{שב|שבי}}. {n} משחקים עם כמה דקות בסוף, זה לא מה שחלמת עליו. נכון?',
      'אני רואה את הפרצוף שלך כל פעם שאני קורא לך לחמם בדקה השמונים. מה קורה?',
      'כן, {{תיכנס|תיכנסי}}. {n} משחקים של דקות בודדות. אני מקשיב.',
    ],
    tired: [
      'לפני {{שאתה מתחיל|שאת מתחילה}}, {{תסתכל|תסתכלי}} על נתוני העומס שלך. אבל {{דבר|דברי}}.',
      '{{שב|שבי}}. ואני אומר מראש: הגוף שלך גמור, וזה חלק מהסיפור.',
      'אני יודע למה באת. גם אני ראיתי את הנתונים מהפיזיותרפיסט. {{דבר|דברי}}.',
      'כן? רק אל {{תגיד|תגידי}} לי {{שאתה רענן|שאת רעננה}}, כי הפיזיותרפיסט אמר אחרת.',
    ],
    broken: [
      'אני יודע מה {{אתה הולך|את הולכת}} להגיד. הבטחתי ולא קיימתי. {{דבר|דברי}}.',
      '{{שב|שבי}}. מגיע לך הסבר, ואני לא בורח ממנו.',
      'לפני הכול: כן, הבטחתי. אני מקשיב.',
      'אני חייב לך את השיחה הזאת. {{תגיד|תגידי}} מה {{שאתה רוצה|שאת רוצה}}.',
    ],
    loan: [
      'באת אלינו בהשאלה כדי לשחק, אני יודע. מה על הלב?',
      '{{שב|שבי}}. אני מבין שבקבוצה שלך מצפים {{שתשחק|שתשחקי}} פה. {{דבר|דברי}}.',
      'שלחו אותך אלינו כדי {{שתקבל|שתקבלי}} דקות, ואני לא נתתי מספיק. נכון?',
      'כן, {{תיכנס|תיכנסי}}. השאלה זה דבר מסובך. מה קורה?',
    ],
    youth: [
      '{n} משחקים בלי לפתוח. {{בוא|בואי}}, {{שב|שבי}}. {{בנוער כל אחד רוצה|בנערות כל אחת רוצה}} לשחק, וזה טוב. מה קורה?',
      'אני שמח שבאת לדבר במקום לכעוס בשקט. {{דבר|דברי}}.',
      'כן, {{תיכנס|תיכנסי}}. אני מאמן {{נוער|נערות}} עשרים שנה. אני יודע מה ספסל עושה בגיל שלך.',
      '{{שב|שבי}}. ההורים שלך יודעים {{שאתה פה|שאת פה}}? טוב, לא משנה. {{דבר|דברי}}.',
    ],
    third: [
      'שוב? זו כבר הפעם השלישית העונה. אני מקשיב, אבל הסבלנות שלי נגמרת.',
      'פעם שלישית בעונה אחת. {{תבין|תביני}} שאני מתחיל להתעייף מהשיחות האלה.',
      'אני אקשיב, כי אני מקשיב לכולם. אבל זו הפעם השלישית, {{ואתה יודע|ואת יודעת}} את זה.',
      '{{שוב אתה|שוב את}} פה. טוב, {{דבר|דברי}}. אבל קצר.',
    ],
    default: [
      'כן, {{תיכנס|תיכנסי}}. מה קורה?',
      '{{שב|שבי}}. אני מקשיב.',
      'הדלת שלי תמיד פתוחה. {{דבר|דברי}}.',
      'יש לך חמש דקות עד האימון. מה על הלב?',
    ],
  },
  reply: {
    ask: {
      ok: [
        'טוב שבאת אליי ולא לעיתונים. אני רואה איך {{אתה מתאמן|את מתאמנת}}. באחד משני המשחקים הקרובים {{אתה פותח|את פותחת}}.',
        'אני מעריך שבאת בצורה כזאת. {{תהיה מוכן|תהיי מוכנה}}: באחד משני המשחקים הבאים יש לך מקום בהרכב.',
        '{{האמת? חיכיתי שתבוא|האמת? חיכיתי שתבואי}}. {{אתה|את}} בתוכניות שלי. באחד משני המשחקים הקרובים {{תעלה|תעלי}} מהדקה הראשונה.',
        'בסדר, הרווחת את זה באימונים. אחד משני המשחקים הבאים שלך מהשריקה. אל {{תפספס|תפספסי}} את ההזדמנות.',
        'שמעתי אותך. אני לא מבטיח עונה שלמה, אבל באחד משני המשחקים הבאים {{אתה|את}} בפנים. משם זה תלוי בך.',
        '{{אתה יודע מה? אתה צודק|את יודעת מה? את צודקת}}. במשחק הזה או בזה שאחריו {{אתה פותח|את פותחת}}. {{תראה|תראי}} לי שלא טעיתי.',
        'יפה שבאת בגובה העיניים. ב{club} מי {{שעובד מקבל|שעובדת מקבלת}} הזדמנות, {{ואתה עובד|ואת עובדת}}. באחד משני המשחקים הקרובים {{אתה|את}} בהרכב.',
      ],
      fail: [
        'אני מבין אותך, אבל כרגע {{יש לפניך שחקנים|יש לפנייך שחקניות}} בכושר. {{תמשיך|תמשיכי}} לעבוד באימונים, ההזדמנות תגיע.',
        'הדלת שלי פתוחה, אבל ההרכב נקבע במגרש האימונים. {{תראה|תראי}} לי יותר, ואז נדבר.',
        'לא עכשיו. הקבוצה בתנופה, ואני לא משנה הרכב מנצח. {{תהיה מוכן|תהיי מוכנה}} כשאקרא לך.',
        'שאלה הוגנת, ותשובה כנה: {{אתה|את}} עוד לא שם. עוד כמה שבועות של עבודה, ונדבר שוב.',
        'אני יודע שקשה על הספסל. גם אני ישבתי שם. {{תמשיך|תמשיכי}} לדחוף באימונים, אני רואה הכול.',
        'כרגע לא. אבל אני רוצה לראות ממך יותר באימונים, לא פחות. אל {{תוריד|תורידי}} את הראש.',
        'כל {{שחקן|שחקנית}} בסגל רוצה לפתוח. ההבדל הוא מי {{שמוכיח|שמוכיחה}} את זה במהלך השבוע. {{תמשיך|תמשיכי}} לעבוד.',
      ],
    },
    demand: {
      ok: [
        'אני לא אוהב שלוחצים עליי, אבל הפעם {{אתה צודק|את צודקת}}. במשחק הבא {{אתה פותח|את פותחת}}.',
        'טון כזה אני לא שומע הרבה בחדר הזה. בסדר. משחק הבא, מהדקה הראשונה. {{תצדיק|תצדיקי}} את זה.',
        'קיבלת. במשחק הבא {{אתה|את}} בהרכב. ובפעם הבאה {{תדפוק|תדפקי}} בדלת לפני {{שאתה מתפרץ|שאת מתפרצת}}.',
        'יש לך אופי, את זה אני אוהב. במשחק הבא {{אתה פותח|את פותחת}}. אם זה לא יעבוד, נדבר על הטון.',
        'טוב. רצית דקות? במשחק הבא {{תקבל|תקבלי}} תשעים. עכשיו {{תראה|תראי}} לי שזה לא היה רק דיבור.',
        'אני לא נכנע ללחץ, אני נכנע לביצועים, והאימונים שלך השבוע היו טובים. במשחק הבא {{אתה|את}} בפנים.',
        'אוקיי, המסר התקבל. במשחק הבא {{אתה|את}} בהרכב. אל {{תגרום|תגרמי}} לי להתחרט.',
      ],
      fail: [
        'לא {{אתה תגיד|את תגידי}} לי מי משחק. ההרכב נקבע אצלי, לא במסדרון.',
        'דרישות? במועדון הזה מקבלים דקות באימונים, לא בצעקות. {{תחשוב|תחשבי}} על זה.',
        'שמעתי. ועכשיו {{תשמע אתה|תשמעי את}}: עוד פעם טון כזה, {{ואתה|ואת}} לא בסגל בכלל.',
        'אני מבין {{שאתה מתוסכל|שאת מתוסכלת}}, אבל ככה לא מדברים איתי. כרגע אין שינוי.',
        'מגיע לך? לפי מה? {{תראה|תראי}} לי את זה במגרש, ואז {{תבוא|תבואי}} לדרוש.',
        'אני לא אוהב שלוחצים עליי. התשובה היא לא, והיא נשארת לא עד {{שתשנה|שתשני}} גישה.',
        'יש פה {{עשרים וחמישה שחקנים שרוצים|עשרים וחמש שחקניות שרוצות}} לפתוח. דרישות לא מקדמות אף אחד בתור.',
      ],
    },
    threat: {
      ok: [
        'לא הייתי רוצה לאבד אותך. בסדר: שלושה משחקים בהרכב, ועד סוף העונה {{אתה|את}} חלק מהרוטציה. אבל איומים אני זוכר.',
        'אף אחד לא עוזב פה באמצע העונה. {{תקבל|תקבלי}} שלושה משחקים מהדקה הראשונה, ונראה איפה {{אתה עומד|את עומדת}}.',
        'אוקיי. {{אתה חשוב|את חשובה}} לי יותר ממה {{שאתה חושב|שאת חושבת}}. שלושה משחקים בהרכב, ומקום קבוע ברוטציה. ובלי עוד איומים.',
        'אני לא אוהב אולטימטומים. אבל {{אתה לא הולך|את לא הולכת}} לשום מקום. שלושה משחקים בהרכב, ואחר כך רוטציה.',
        'שמעתי, והבנתי שזה רציני. מהמשחק הבא, שלושה משחקים ברצף בהרכב. עד סוף העונה {{אתה לא יורד|את לא יורדת}} מהרוטציה.',
        'בסדר, ניצחת הפעם. שלושה משחקים בהרכב ותפקיד ברוטציה. עכשיו {{תוכיח שאתה שווה|תוכיחי שאת שווה}} את כל הרעש הזה.',
        '{club} לא מוותרת על {{שחקנים|שחקניות}} כמוך. שלושה משחקים בהרכב, ואחר כך מקום ברוטציה עד סוף העונה.',
      ],
      fail: [
        'הדלת פתוחה. אם {{אתה רוצה|את רוצה}} ללכת, אף אחד לא יעצור אותך.',
        'אני לא מנהל משא ומתן עם איומים. {{תגיש|תגישי}} בקשה, וההנהלה תטפל בזה.',
        'אם זו הגישה, אז כנראה שבאמת הגיע הזמן להיפרד. אני מעדכן את ההנהלה.',
        'אף {{שחקן לא גדול|שחקנית לא גדולה}} מהמועדון. רוצה לעזוב? בבקשה. הדלת פתוחה.',
        'איומים? אצלי? טוב. מהיום {{אתה|את}} ברשימת ההעברות. בהצלחה.',
        'ציפיתי ליותר ממך. אני לא עוצר אף אחד. הסוכן שלך כבר יקבל טלפון.',
        '{club} הייתה פה {{לפניך|לפנייך}} ותהיה פה {{אחריך|אחרייך}}. הדלת פתוחה.',
      ],
      loanOk: [
        'לא שלחו אותך אלינו כדי לשבת, {{אתה צודק|את צודקת}}. שלושה משחקים בהרכב, ואחר כך רוטציה.',
        'אני לא רוצה {{שתחזור|שתחזרי}} לשם עם סיפורים עליי. שלושה משחקים בהרכב, מהמשחק הבא.',
        'בסדר. אני מתקשר לקבוצה שלך ואומר להם {{שאתה|שאת}} בהרכב בשלושת המשחקים הבאים.',
        'השאלה זה עסק של שני הצדדים. מגיע לך לשחק. שלושה משחקים בהרכב, ונמשיך משם.',
      ],
      // youth stage (no transfer list below the pro stage): a failed threat to the academy coach
      youthFail: [
        'איומים לא יכניסו אותך להרכב. עבודה כן. {{תחשוב|תחשבי}} על זה.',
        'לעזוב את המחלקה זה עניין להורים ולמנהל האקדמיה. אצלי בהרכב משחקים לפי האימונים.',
        'בגיל שלך כבר מאיימים? {{תתאמן|תתאמני}} כמו שצריך, ואז נדבר.',
        'שמעתי. אני אדבר עם מנהל האקדמיה. בינתיים {{אתה|את}} על הספסל.',
        'פה לומדים, לא מאיימים. מי {{שלומד|שלומדת}} משחק. {{לך|לכי}} להתאמן.',
      ],
      loanFail: [
        'אם {{אתה רוצה|את רוצה}} לחזור לקבוצה שלך, אני לא אעצור אותך. אני אדבר איתם.',
        'השאלה לא עובדת אם {{השחקן לא רוצה|השחקנית לא רוצה}} להיות פה. אני מבטל אותה.',
        'בסדר. {{תחזור|תחזרי}} אליהם. אני לא מחזיק פה אף אחד בכוח.',
        'הבנתי. אני מתקשר לקבוצה שלך. {{תתחיל|תתחילי}} לארוז.',
      ],
    },
  },
  tired: [
    '{{אתה גמור|את גמורה}} פיזית. {{תנוח|תנוחי}} שבוע {{ותחזור|ותחזרי}}.',
    'זו לא החלטה נגדך. העומס אצלך בשמיים. אימון קל, מנוחה, ואז נדבר על הרכב.',
    'אני לא שם {{שחקן שחוק|שחקנית שחוקה}} על הדשא. ככה מאבדים {{שחקנים|שחקניות}} לחצי עונה.',
    '{{תסתכל|תסתכלי}} על הנתונים: האנרגיה למטה, העומס למעלה. {{תוריד|תורידי}} הילוך שבוע, {{ותחזור רענן|ותחזרי רעננה}}.',
    'הבעיה היא לא הכישרון, היא הרגליים. {{אתה עייף|את עייפה}}. שבוע קל, ואני מסתכל {{עליך|עלייך}} שוב.',
    'אם אני שם אותך עכשיו, {{אתה נפצע|את נפצעת}} עד הדקה השישים. קודם {{תתאושש|תתאוששי}}.',
  ],
  punish: [
    'ובשביל {{שתלמד|שתלמדי}} משהו: גם במשחק הבא {{אתה|את}} על הספסל.',
    '{{אתה יושב|את יושבת}} גם במשחק הבא. {{תחשוב|תחשבי}} על הטון.',
    'אחרי שיחה כזאת, גם במשחק הבא {{אתה מתחיל|את מתחילה}} מהספסל.',
    'וכדי שיהיה ברור מי מחליט כאן: משחק הבא, ספסל.',
  ],
  promiseKept: [
    '{coach} עמד במילה: פתחת בהרכב. עכשיו {{תראה|תראי}} לו שהוא צדק.',
    'ראיתי את ההרכב. {coach} קיים את מה שהבטיח. ככה זה כשמדברים נכון.',
    'נו, מה אמרתי לך? פתחת. {coach} לא מבטיח סתם. {{תמשיך|תמשיכי}} ככה, והמקום שלך.',
    'השם שלך בהרכב. {coach} עמד במילה, והשווי שלך כבר מודה לו.',
    'יפה. {coach} נתן לך את ההזדמנות. עכשיו הכול בידיים שלך. או ברגליים.',
    'ההבטחה קוימה: פתחת. וכבר יש סקאוטים ששאלו {{עליך|עלייך}}.',
  ],
  promiseBroken: [
    '{coach} הבטיח ולא קיים. עוד פעם על הספסל. אני לא אוהב את זה.',
    'הבטחה זו הבטחה, ו{coach} הפר אותה. בשיחה הבאה איתו, הקלף אצלך.',
    'שוב לא בהרכב, למרות מה ש{coach} אמר. אני רושם את זה. אם זה ממשיך, אני מתחיל לחפש.',
    'אני מסתכל על ההרכב ולא מאמין. {coach} אמר לך משהו אחר. {{תלך|תלכי}} אליו שוב, הפעם הוא חייב לך.',
    '{coach} לא עמד במילה. אל {{תשבור|תשברי}} את הכלים, אבל גם אל {{תשתוק|תשתקי}}.',
    'מאמנים מבטיחים, אני יודע. אבל {coach} לא קיים, ועכשיו הוא חייב לך.',
  ],
  poorChance: [
    'קיבלת הזדמנות. לא ניצלת אותה. עכשיו {{תצטרך|תצטרכי}} לחכות.',
    'נתתי לך את הדקות שביקשת. מה שראיתי במגרש לא מספיק.',
    'אמרתי {{שתקבל|שתקבלי}} צ׳אנס, וקיבלת. בפעם הבאה אני צריך לראות יותר.',
    'פתחת, ונעלמת. אני לא יכול להצדיק את זה מול {{השחקנים|השחקניות}} שעל הספסל.',
    'זה היה המבחן שלך, והוא לא הלך טוב. נחזור לעבוד באימונים.',
  ],
  national: [
    'אני יודע שלא שיחקת בזימונים האחרונים. {{אתה|את}} בתוכניות שלי. {{תמשיך|תמשיכי}} לעבוד בקבוצה, ההזדמנות תגיע.',
    'רק רציתי שיהיה ברור: אני לא מזמן {{שחקנים|שחקניות}} סתם. {{אתה|את}} בתוכניות שלי, גם אם כרגע זה מהספסל.',
    'שלושה זימונים בלי דקות זה מתסכל, אני יודע. {{תהיה סבלני|תהיי סבלנית}}. הסגל הזה נבנה לטווח ארוך, {{ואתה|ואת}} חלק ממנו.',
    'ראיתי אותך באימונים של הנבחרת. {{אתה|את}} בתוכניות שלי. כשהרגע יגיע, אני רוצה אותך {{מוכן|מוכנה}}.',
  ],
  // canTalkToCoach().reasonHe. {n} = weeks left (use cooldown1 when n === 1).
  reasons: {
    notYet: 'השיחה נפתחת אחרי 3 משחקים רצופים בלי לפתוח בהרכב, או 4 משחקים עם פחות מ-30 דקות',
    notYetYouth: '{{בנוער|בנערות}} השיחה נפתחת אחרי 4 משחקים רצופים בלי לפתוח בהרכב',
    starter: '{{אתה|את}} בהרכב. אין סיבה לדפוק על הדלת',
    cooldown: 'דיברת עם המאמן לא מזמן. אפשר שוב בעוד {n} שבועות',
    cooldown1: 'דיברת עם המאמן לא מזמן. אפשר שוב בשבוע הבא',
    seasonLimit: 'כבר דיברת עם המאמן 3 פעמים העונה. נחכה לעונה הבאה',
    promiseActive: 'יש לך הבטחה מהמאמן. {{תן|תני}} לה זמן',
    injured: '{{אתה פצוע|את פצועה}}. קודם {{תחזור|תחזרי}} לכשירות',
    suspended: '{{אתה מורחק|את מורחקת}}. אחרי ההרחקה נדבר',
    noClub: 'אין לך קבוצה כרגע',
    manager: '{{אתה|את}} המאמן עכשיו. ההרכב אצלך',
    national: 'עם מאמן הנבחרת לא מדברים על דקות',
  },
  result: {
    okTitle: 'המאמן השתכנע',
    failTitle: 'המאמן לא השתכנע',
    effectsTitle: 'מה השתנה',
    promiseTitle: 'ההבטחה',
    noPromise: 'אין הבטחה',
    back: 'חזרה לבית',
  },
  promiseHe: {
    next1: '{{תפתח|תפתחי}} במשחק הבא',
    next2: '{{תפתח|תפתחי}} באחד משני המשחקים הבאים',
    run3: '{{תפתח|תפתחי}} בשלושת המשחקים הבאים, {{ותהיה|ותהיי}} ברוטציה עד סוף העונה',
    benchNext: 'גם במשחק הבא על הספסל',
  },
  effectsHe: {
    trust: 'אמון המאמן',
    morale: 'מורל',
    fans: 'אהדת הקהל',
    selection: 'סיכוי לפתוח במשחק הבא',
    role: 'תפקיד: רוטציה עד סוף העונה',
    treq: 'בקשת העברה הוגשה',
    loanEnd: 'ההשאלה מסתיימת',
    interested: 'קבוצות מעוניינות בך',
    youthDoor: 'מאמן הנוער זוכר את האיום',
  },
};
