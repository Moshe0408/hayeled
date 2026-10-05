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

// ===========================================================================
// v2.3 "אין רגע דל" (F1-F12). Pure data. Conventions for every table below:
//  - {{male|female}} markers follow the CAREER gender (engine: gtext; UI:
//    js/ui/gender.js gtext). Exception: CHALLENGE_TEXT.card markers follow the
//    CHALLENGER's gender (resolve with gtext(str, challenge.gender)); text
//    addressed to an unknown viewer (title screen) is written gender-neutral.
//  - {placeholders} are single-brace and listed per table. Whoever renders a
//    string must fill every placeholder it contains (or not use that string).
//  - Plain numbers in texts are literal (they match target/val of the row).
//  - Star amounts are always shown with '⭐'. Money values arrive formatted
//    (fmtMoney) in {v}; never write a currency sign around {v}.
//  - Optional everywhere: engine/UI must fall back to built-in Hebrew.
// ===========================================================================

// Shared reward labels (objectives, achievements, daily, stakes).
// {n} = number, {v} = formatted money. Join parts with sep.
export const REWARD_HE = {
  stars: '{n} ⭐',
  starsPlus: '+{n} ⭐',
  morale: 'מורל +{n}',
  energy: 'אנרגיה +{n}',
  money: '{v}',
  trust: 'אמון המאמן +{n}',
  fans: 'אהדת הקהל +{n}',
  mates: 'יחסים בקבוצה +{n}',
  sep: ' · ',
};

// Stars currency (F6) - generic labels.
export const STARS_TEXT = {
  name: 'כוכבים',
  balance: '{n} ⭐',
  balanceLong: 'יש לך {n} ⭐',
  earnedTotal: 'נאספו בסך הכול: {n} ⭐',
  earned: '+{n} ⭐',
  spent: '-{n} ⭐',
  howTo: 'כוכבים מקבלים על משימות, הישגים, מטרות אישיות במשחק והפרס היומי',
  // ledger reasons (getStars history lines, optional). {he} = objective / achievement name
  reason: {
    objective: 'משימה: {he}',
    achievement: 'הישג: {he}',
    daily: 'פרס יומי',
    matchGoal: 'מטרה אישית במשחק',
    tutorial: 'משחק הבכורה',
    migration: 'מתנת קפיצת המדרגה',
    purchase: 'קנייה: {he}',
  },
};

// ---------------------------------------------------------------------------
// F1 fast start (js/ui/onboarding.js). Step 1 is shown BEFORE a gender exists:
// keys marked (neutral) have no markers. Placeholders: {name} {first} {pos}
// {club} {ovr} {pot} {age}.
// ---------------------------------------------------------------------------
export const ONBOARDING = {
  step1Title: 'שנייה אחת, ואנחנו על הדשא',                         // (neutral)
  step1Hint: 'בן או בת, שם, וזהו. את כל השאר נסדר בשבילך',       // (neutral)
  step1Of: 'שלב {n} מתוך 2',                                       // (neutral)
  genderQ: 'מי יוצא לדרך?',                                        // (neutral)
  boy: 'בן', girl: 'בת',
  first: 'שם פרטי', last: 'שם משפחה (לא חובה)', nick: 'כינוי (לא חובה)',
  firstPh: 'איך קוראים לך?',                                        // (neutral)
  randomBtn: '🎲 שחקן אקראי',                                       // (neutral; the spec wording)
  randomBtnG: '{{🎲 שחקן אקראי|🎲 שחקנית אקראית}}',                 // after a gender was picked
  randomDone: 'הוגרל! אפשר לשנות כל דבר',                           // (neutral)
  errFirst: 'רק שם פרטי, וממשיכים',                                 // (neutral)
  next: 'הבא',
  // step 2 (gender known)
  step2Title: '{{מוכן|מוכנה}}? האצטדיון כבר מלא',
  step2Sub: 'גיל 16, ו{{אתה כבר|את כבר}} בסגל הבוגר',
  cardLine: '{pos} · {club}',
  cardStats: 'גיל {age} · יכולת {ovr}',
  cardPotential: 'פוטנציאל: {{כוכב על|כוכבת על}}',
  scoutQuote: [
    '"כישרון כזה רואים פעם בעשור" - הסקאוט של {club}',
    '"{{הוא עוד לא בן 17, וכבר משגע את ההגנה של הבוגרים|היא עוד לא בת 17, וכבר משגעת את ההגנה של הבוגרות}}" - מאמן הנוער',
    '"תזכרו את השם {first}" - כתב הספורט המקומי',
    '"לא ראיתי {{ילד|ילדה}} עם בעיטה כזאת מאז שהתחלתי לאמן" - המאמן של {club}',
    '"השכונה כולה תבוא לראות את {first}" - אבא',
  ],
  kickoff: 'לבעיטת הפתיחה',
  kickoffHint: 'משחק הבכורה {{שלך|שלך}} מתחיל עכשיו',
  advanced: 'התאמה מתקדמת',
  advancedHint: 'מדינה, עמדה, רגל חזקה, אקדמיה ומראה',
  rerollClub: 'קבוצה אחרת',
  rerollLook: 'מראה אחר',
  back: 'חזרה',
  defaultPos: { m: 'חלוץ', f: 'חלוצה' },
  defaultNation: 'ישראל',
  // short pre-match lines shown while the debut loads (pick one)
  loading: [
    'הנעליים קשורות. המנהרה מחכה',
    'אבא כבר ביציע עם התרמוס',
    'החבר׳ה מהשכונה מול המסך',
    'המאמן קורא בשם שלך...',
  ],
};

// ---------------------------------------------------------------------------
// F2 schema v5 migration message (inbox, sender: coach). title = the exact
// thread subject from the spec. Use titlePro / linesPro when the player is
// already a pro (already in the first team). Placeholders: {first} {club} {coach} {ovr}.
// ---------------------------------------------------------------------------
export const MIGRATION_TEXT = {
  v5: {
    from: 'coach',
    title: 'קפיצת מדרגה! המאמן מעלה אותך {{לבוגרים|לבוגרות}}',
    lines: [
      '{first}, אני עוקב {{אחריך|אחרייך}} כבר חודשים. ראיתי מספיק.',
      'מהיום {{אתה|את}} בסגל הבוגר של {club}. יכולת {ovr}, ואני מצפה ליותר.',
      'אל {{תתרגש|תתרגשי}} יותר מדי. {{תתאמן|תתאמני}} חזק, והדקות יגיעו.',
    ],
    titlePro: 'קפיצת מדרגה! העבודה הקשה משתלמת',
    linesPro: [
      '{first}, הצוות המקצועי עבר על הנתונים שלך. הקפיצה הזאת לא מקרית.',
      'יכולת {ovr}. מהיום {{אתה|את}} חלק מהתוכניות שלי ב{club}, לא רק מהסגל.',
    ],
    toast: 'קפיצת מדרגה! יכולת {ovr}',
    gift: 'מתנת קפיצת המדרגה: +{n} ⭐',
  },
};

// ---------------------------------------------------------------------------
// F3 debut tutorial (js/ui/onboarding.js + the post-match card). The scripted
// match commentary lives in commentary.js DEBUT_SCRIPT.
//  coachMarks[i] = { id, target (UI anchor: 'pitch'|'scorebug'|'speed'), title, he }
//  Placeholders: {first} {club} {opp} {minute} {n} {ach}
// ---------------------------------------------------------------------------
export const TUTORIAL = {
  coachMarks: [
    { id: 'pitch', target: 'pitch', title: 'המגרש החי', he: 'הנקודה עם ההילה זה {{אתה|את}}. כל מהלך במשחק קורה פה מול העיניים' },
    { id: 'score', target: 'scorebug', title: 'התוצאה והשעון', he: 'הדקה והתוצאה. כשהמספר שלנו עולה, כל האצטדיון קם על הרגליים' },
    { id: 'speed', target: 'speed', title: 'מהירות הצפייה', he: 'x1 כדי לא לפספס אף רגע, x4 כדי להגיע מהר לרגעים הגדולים' },
  ],
  next: 'הבנתי',
  done: 'יאללה, למשחק!',
  skip: 'דלג על ההדרכה',
  stepOf: '{n}/3',
  preMatch: {
    title: 'משחק הבכורה',
    sub: '{club} נגד {opp}',
    lines: [
      'המאמן: "{first}, {{אתה מתחיל|את מתחילה}} על הספסל. {{תהיה מוכן|תהיי מוכנה}}, בחצי השני {{אתה נכנס|את נכנסת}}."',
      'המאמן: "אל {{תחשוב|תחשבי}} יותר מדי. {{תעשה|תעשי}} מה שעשית בשכונה."',
      'המאמן: "הקהל עוד לא מכיר אותך. אחרי היום, יכירו."',
    ],
    cta: 'למנהרה',
  },
  postMatch: {
    title: 'ככה מתחילים אגדה',
    sub: [
      'בכורה עם שער. לא הרבה {{שחקנים יכולים|שחקניות יכולות}} להגיד את זה',
      'נכנסת, הבקעת, והשכונה כולה יצאה למרפסות',
      'משחק אחד, שער אחד, ושם שכולם מדברים עליו',
    ],
    goalLine: 'שער בבכורה, דקה {minute}',
    achievementLabel: 'הישג ראשון נפתח',
    achievementLine: '{ach}',
    starsLabel: 'הכוכבים הראשונים שלך',
    starsLine: '+{n} ⭐',
    teaserLabel: 'הבא בשביל הקריירה',
    teaser: 'הבא: {{נבחרת הנוער|נבחרת הנערות}}',
    teaserHint: 'עוד כמה משחקים טובים בהרכב, והטלפון מהנבחרת יגיע',
    objectivesHint: 'המשימות השבועיות כבר מחכות לך בבית',
    cta: 'ממשיכים',
    share: '📤 שתף את הגול',
  },
  // optional one-time tips on the hub after the debut (pick by id)
  hubTips: {
    objectives: 'אלה המשימות של השבוע. כל משימה שווה ⭐',
    path: 'שביל הקריירה: מה הבא, ומה חסר כדי להגיע',
    daily: 'כל יום שחוזרים יש פרס. ביום ה-7 מחכה תיבה גדולה',
    stakes: 'לפני כל משחק {{תראה|תראי}} מה מונח על הכף',
    ff: '"המשך עד האירוע הבא" עוצר רק כשקורה משהו מעניין',
    shop: 'בחנות, בלשונית "פרסים", מחליפים ⭐ בנעליים, חגיגות ומסגרות',
  },
};

// ---------------------------------------------------------------------------
// F4 objectives. OBJECTIVES.weekly = rotating pool (3 active at a time),
// OBJECTIVES.season = one per season. Row shape:
//   { id, metric, target, val?, weeks, he, stars, reward, cond?, weight? }
//   weeks  = how many game weeks the objective stays active (weekly pool; the
//            season rows run until season end, weeks: 0)
//   he     = imperative to the player (markers); numbers are literal = target/val
//   stars  = ⭐ paid on completion; reward = extra Effects-like deltas
//            { morale?, energy?, money? (men's scale ₪, apply econ), trust?, fans?, mates? }
//   cond   = optional gate: { groups?: ['GK'|'DEF'|'MID'|'ATT'], notGroups?, stage?: ['youth','pro'],
//            minOvr?, maxOvr?, minAge?, derbyWeek?: true, europe?: true (club in Europe this season),
//            national?: true (player in a national squad), bench?: true (role prospect/rotation/squad),
//            league?: true (club in a league table) }
//   weight = relative pick weight (default 1)
// Metric vocabulary (counted only inside the objective's window; "match" =
// a match the player appeared in, all competitions):
//   goals, assists, ga (goals+assists), starts, apps, minutes, wins (team won
//   a match the player played), unbeaten (matches played without a loss),
//   motm, rating_n (matches with rating >= val), clean_sheets (played >= 60',
//   team conceded 0), brace (matches with 2+ goals), bench_goal (goal after
//   coming on), away_win, derby_win, europe_goals, nt_apps, cup_win (won a cup tie),
//   load_end_below (weeks ending with load < val), energy_end_above (energy > val),
//   sharp_end_above (sharp > val), train_weeks (weeks not on rest), train_hard
//   (weeks at hard/extreme), reply_msgs (inbox threads answered), talk_ok
//   (successful coach talk), shop_buy (items bought, ₪ shop or ⭐ rewards).
// Season metrics: s_goals, s_assists, s_apps, s_starts, s_avg_rating (val,
//   needs >= 10 apps), s_clean_sheets, s_motm, league_pos (final league rank <= val),
//   s_trophy (any trophy), s_callup (any national call-up), ovr_gain (OVR now - OVR
//   at season start), s_survive (club not relegated).
// ---------------------------------------------------------------------------
export const OBJECTIVES = {
  weekly: [
    { id: 'w_goal_1', metric: 'goals', target: 1, weeks: 1, he: '{{הבקע|הבקיעי}} שער השבוע', stars: 10, reward: { morale: 3 }, cond: { notGroups: ['GK'] }, weight: 3 },
    { id: 'w_goals_2', metric: 'goals', target: 2, weeks: 3, he: '{{הבקע|הבקיעי}} 2 שערים', stars: 15, reward: { morale: 3, fans: 1 }, cond: { notGroups: ['GK'] }, weight: 3 },
    { id: 'w_goals_3', metric: 'goals', target: 3, weeks: 4, he: '{{הבקע|הבקיעי}} 3 שערים', stars: 25, reward: { money: 3000, fans: 2 }, cond: { groups: ['ATT'] }, weight: 2 },
    { id: 'w_brace', metric: 'brace', target: 1, weeks: 4, he: 'צמד: 2 שערים במשחק אחד', stars: 30, reward: { fans: 3, morale: 3 }, cond: { groups: ['ATT', 'MID'] } },
    { id: 'w_assist_1', metric: 'assists', target: 1, weeks: 2, he: '{{בשל|בשלי}} שער', stars: 10, reward: { mates: 2 }, cond: { notGroups: ['GK'] }, weight: 2 },
    { id: 'w_assists_2', metric: 'assists', target: 2, weeks: 4, he: '{{בשל|בשלי}} 2 שערים', stars: 20, reward: { mates: 3, trust: 2 }, cond: { groups: ['MID', 'ATT'] } },
    { id: 'w_ga_2', metric: 'ga', target: 2, weeks: 3, he: '{{היה מעורב|היי מעורבת}} ב-2 שערים: שער או בישול', stars: 15, reward: { morale: 2, trust: 1 }, cond: { groups: ['MID', 'ATT'] }, weight: 2 },
    { id: 'w_bench_goal', metric: 'bench_goal', target: 1, weeks: 4, he: '{{היכנס|היכנסי}} מהספסל {{והבקע|והבקיעי}}', stars: 25, reward: { trust: 4, morale: 3 }, cond: { notGroups: ['GK'], bench: true } },
    { id: 'w_rating_75', metric: 'rating_n', target: 1, val: 7.5, weeks: 2, he: 'ציון 7.5 ומעלה במשחק', stars: 15, reward: { trust: 2 }, weight: 3 },
    { id: 'w_rating_7x2', metric: 'rating_n', target: 2, val: 7.0, weeks: 3, he: 'ציון 7 ומעלה בשני משחקים', stars: 15, reward: { trust: 2, morale: 1 }, weight: 2 },
    { id: 'w_rating_8', metric: 'rating_n', target: 1, val: 8.0, weeks: 3, he: 'ערב ענק: ציון 8 ומעלה', stars: 25, reward: { fans: 2, trust: 2 }, cond: { minOvr: 62 } },
    { id: 'w_motm', metric: 'motm', target: 1, weeks: 4, he: '{{היה שחקן המשחק|היי שחקנית המשחק}}', stars: 25, reward: { fans: 2, morale: 3 } },
    { id: 'w_start_1', metric: 'starts', target: 1, weeks: 2, he: '{{פתח|פתחי}} בהרכב', stars: 10, reward: { morale: 3 }, cond: { bench: true }, weight: 2 },
    { id: 'w_starts_3', metric: 'starts', target: 3, weeks: 4, he: '{{פתח|פתחי}} בהרכב ב-3 משחקים', stars: 20, reward: { trust: 3 }, weight: 2 },
    { id: 'w_apps_2', metric: 'apps', target: 2, weeks: 3, he: '{{שחק|שחקי}} ב-2 משחקים', stars: 8, reward: { morale: 2 }, cond: { bench: true } },
    { id: 'w_minutes_180', metric: 'minutes', target: 180, weeks: 3, he: '180 דקות על הדשא', stars: 15, reward: { trust: 2 } },
    { id: 'w_wins_2', metric: 'wins', target: 2, weeks: 3, he: '2 ניצחונות במשחקים {{שאתה משחק|שאת משחקת}} בהם', stars: 12, reward: { morale: 3 }, weight: 2 },
    { id: 'w_unbeaten_3', metric: 'unbeaten', target: 3, weeks: 4, he: '3 משחקים בלי הפסד', stars: 15, reward: { morale: 2, mates: 2 } },
    { id: 'w_away_win', metric: 'away_win', target: 1, weeks: 3, he: 'ניצחון במשחק חוץ', stars: 12, reward: { fans: 1, morale: 2 } },
    { id: 'w_derby_win', metric: 'derby_win', target: 1, weeks: 1, he: 'לנצח בדרבי. כל העיר מסתכלת', stars: 30, reward: { fans: 4, morale: 4 }, cond: { derbyWeek: true }, weight: 5 },
    { id: 'w_cs_1', metric: 'clean_sheets', target: 1, weeks: 2, he: '{{שמור|שמרי}} על רשת נקייה', stars: 15, reward: { trust: 2 }, cond: { groups: ['GK', 'DEF'] }, weight: 3 },
    { id: 'w_cs_2', metric: 'clean_sheets', target: 2, weeks: 4, he: '2 רשתות נקיות', stars: 25, reward: { trust: 3, fans: 1 }, cond: { groups: ['GK'] }, weight: 2 },
    { id: 'w_europe_goal', metric: 'europe_goals', target: 1, weeks: 4, he: '{{הבקע|הבקיעי}} שער באירופה', stars: 30, reward: { fans: 3 }, cond: { europe: true, notGroups: ['GK'] }, weight: 2 },
    { id: 'w_nt_apps', metric: 'nt_apps', target: 1, weeks: 4, he: '{{עלה|עלי}} למגרש במדי הנבחרת', stars: 20, reward: { morale: 3 }, cond: { national: true }, weight: 2 },
    { id: 'w_cup_win', metric: 'cup_win', target: 1, weeks: 4, he: 'לעלות שלב בגביע', stars: 15, reward: { morale: 2, fans: 1 } },
    { id: 'w_load_50', metric: 'load_end_below', target: 1, val: 50, weeks: 1, he: '{{סיים|סיימי}} שבוע עם עומס מתחת ל-50', stars: 8, reward: { energy: 10 }, weight: 2 },
    { id: 'w_load_40x2', metric: 'load_end_below', target: 2, val: 40, weeks: 3, he: '2 שבועות עם עומס מתחת ל-40', stars: 12, reward: { energy: 10, morale: 1 } },
    { id: 'w_energy_70', metric: 'energy_end_above', target: 1, val: 70, weeks: 1, he: '{{סיים|סיימי}} שבוע עם אנרגיה מעל 70', stars: 8, reward: { morale: 2 } },
    { id: 'w_sharp_70', metric: 'sharp_end_above', target: 1, val: 70, weeks: 2, he: 'חדות מעל 70 בסוף שבוע', stars: 10, reward: { trust: 1 } },
    { id: 'w_train_hard_2', metric: 'train_hard', target: 2, weeks: 3, he: '2 שבועות של אימון קשה', stars: 12, reward: { trust: 2 }, cond: { minAge: 16 } },
    { id: 'w_train_3', metric: 'train_weeks', target: 3, weeks: 3, he: '3 שבועות אימון ברצף, בלי מנוחה', stars: 10, reward: { trust: 2 } },
    { id: 'w_reply_3', metric: 'reply_msgs', target: 3, weeks: 2, he: '{{ענה|עני}} ל-3 הודעות בתיבה', stars: 6, reward: { mates: 1, morale: 1 } },
    { id: 'w_talk_ok', metric: 'talk_ok', target: 1, weeks: 4, he: '{{שכנע|שכנעי}} את המאמן בשיחה', stars: 15, reward: { morale: 2 }, cond: { bench: true }, weight: 0.5 },
    { id: 'w_shop_1', metric: 'shop_buy', target: 1, weeks: 3, he: '{{פנק|פנקי}} את עצמך: קנייה בחנות', stars: 5, reward: { morale: 2 }, weight: 0.5 },
  ],
  season: [
    { id: 's_goals_12', metric: 's_goals', target: 12, weeks: 0, he: '12 שערים העונה', stars: 100, reward: { money: 25000, fans: 4 }, cond: { groups: ['ATT'] }, weight: 3 },
    { id: 's_goals_6', metric: 's_goals', target: 6, weeks: 0, he: '6 שערים העונה', stars: 80, reward: { money: 15000, fans: 3 }, cond: { groups: ['MID'] }, weight: 2 },
    { id: 's_assists_8', metric: 's_assists', target: 8, weeks: 0, he: '8 בישולים העונה', stars: 80, reward: { money: 15000, mates: 4 }, cond: { groups: ['MID', 'ATT'] }, weight: 2 },
    { id: 's_cs_8', metric: 's_clean_sheets', target: 8, weeks: 0, he: '8 רשתות נקיות העונה', stars: 100, reward: { money: 20000, trust: 4 }, cond: { groups: ['GK', 'DEF'] }, weight: 3 },
    { id: 's_apps_25', metric: 's_apps', target: 25, weeks: 0, he: '25 הופעות העונה', stars: 70, reward: { trust: 4, morale: 4 }, cond: { bench: true }, weight: 2 },
    { id: 's_starts_15', metric: 's_starts', target: 15, weeks: 0, he: '15 משחקים בהרכב העונה', stars: 80, reward: { trust: 5 }, weight: 2 },
    { id: 's_avg_7', metric: 's_avg_rating', target: 1, val: 7.0, weeks: 0, he: 'ממוצע ציונים 7 ומעלה (לפחות 10 משחקים)', stars: 90, reward: { trust: 4, fans: 2 }, cond: { minOvr: 60 } },
    { id: 's_motm_3', metric: 's_motm', target: 3, weeks: 0, he: '3 פעמים {{שחקן המשחק|שחקנית המשחק}} העונה', stars: 90, reward: { fans: 4 } },
    { id: 's_top4', metric: 'league_pos', target: 1, val: 4, weeks: 0, he: 'לסיים את הליגה בטופ 4', stars: 100, reward: { money: 20000, morale: 4 }, cond: { league: true } },
    { id: 's_survive', metric: 's_survive', target: 1, weeks: 0, he: 'להישאר בליגה', stars: 70, reward: { morale: 5, fans: 2 }, cond: { league: true, maxOvr: 66 }, weight: 0.5 },
    { id: 's_trophy', metric: 's_trophy', target: 1, weeks: 0, he: 'להניף תואר העונה', stars: 120, reward: { money: 30000, fans: 5 }, cond: { minOvr: 66 } },
    { id: 's_callup', metric: 's_callup', target: 1, weeks: 0, he: 'זימון לנבחרת העונה', stars: 90, reward: { morale: 5 }, weight: 2 },
    { id: 's_ovr_4', metric: 'ovr_gain', target: 4, weeks: 0, he: 'לעלות 4 נקודות יכולת העונה', stars: 80, reward: { morale: 4, trust: 2 }, cond: { maxOvr: 80 }, weight: 2 },
  ],
  ui: {
    title: 'משימות',
    weekly: 'משימות השבוע',
    season: 'משימת העונה',
    progress: '{p}/{t}',
    left: 'עוד {n} שבועות',
    left1: 'השבוע האחרון',
    reward: 'פרס: {v}',
    done: 'הושלם ✓',
    doneToast: 'משימה הושלמה!',
    doneToastSub: '{he} · +{n} ⭐',
    expired: 'הזמן נגמר. משימה חדשה בדרך',
    newOnes: 'משימות חדשות',
    allDone: 'כל המשימות הושלמו. חדשות יגיעו בשבוע הבא',
    seasonDone: 'משימת העונה הושלמה!',
  },
};

// ---------------------------------------------------------------------------
// F5 achievements. ACHIEVEMENTS = ordered array (grid order). Row shape:
//   { id, tier: 'bronze'|'silver'|'gold', cat, icon, he, descHe, metric, target, stars, hidden? }
//   he / descHe may carry markers; descHe is written so it reads well both
//   before ("goal") and after unlocking. icon = js/ui/icons.js name.
//   hidden: true = shown as "???" until unlocked (surprise badges).
//   cat ids: ACH_UI.cats keys.
// Metric vocabulary (career totals, senior matches all competitions unless noted;
// progress = min(value, target) / target):
//   debut (0/1), starts, apps, goals, assists, motm, hat_tricks, bench_goals,
//   late_winners (winning goal from minute 85), rating_max (best match rating;
//   target = rating), clean_sheets (GK/DEF, >= 60'), pro_contract (0/1),
//   derby_wins, league_titles, cup_wins, trophies (all club + national trophies),
//   promoted (club promotions while in the squad), captain (0/1), one_club
//   (most seasons at one club), clubs (distinct senior clubs), abroad (0/1),
//   top5 (0/1: played for a club of eng1/esp1/ita1/ger1/fra1), europe_apps,
//   ucl_apps, ucl_goals, ucl_wins, ynt_apps (youth/u21 national), nt_apps,
//   nt_goals, wc_apps, wc_wins, cont_wins (Euro/Copa/AFCON/Asian/Gold Cup win),
//   golden_boy, top_scorer (league top scorer awards), pots (player of the
//   season), tots (team of the season), ballon_top10, ballon_podium, ballon_wins,
//   season_goals_best (best single season goal total), teen_goals (goals before
//   age 19), age_app (oldest age with a senior app; target = age), legacy
//   (legacy points), seasons (completed seasons), injury_comeback (returns from
//   a long injury), burnout_survived (load back under 40 after a burnout),
//   talk_ok (successful coach talks), mgr_jobs, mgr_wins, mgr_trophies,
//   mgr_titles, mgr_awards (coach of the season/year), streak_best (best daily
//   streak, from claimDaily), shared (cards shared), challenges (challenge links
//   sent), objectives (completed), stars_earned (earnedTotal), cosmetics (owned
//   non-default items).
// ---------------------------------------------------------------------------
export const ACHIEVEMENTS = [
  // --- start
  { id: 'debut', tier: 'bronze', cat: 'start', icon: 'start', he: 'בכורה', descHe: 'משחק ראשון בקבוצה הבוגרת', metric: 'debut', target: 1, stars: 10 },
  { id: 'first_goal', tier: 'bronze', cat: 'start', icon: 'ball', he: 'השער הראשון', descHe: 'שער ראשון בבוגרים. את זה לא שוכחים', metric: 'goals', target: 1, stars: 15 },
  { id: 'first_assist', tier: 'bronze', cat: 'start', icon: 'spark', he: 'הבישול הראשון', descHe: 'מסירת שער ראשונה בבוגרים', metric: 'assists', target: 1, stars: 10 },
  { id: 'first_start', tier: 'bronze', cat: 'start', icon: 'whistle', he: 'מהדקה הראשונה', descHe: 'פתיחה ראשונה בהרכב', metric: 'starts', target: 1, stars: 10 },
  { id: 'pro_contract', tier: 'silver', cat: 'start', icon: 'pen', he: 'חוזה מקצועני', descHe: 'חתימה על החוזה המקצועני הראשון', metric: 'pro_contract', target: 1, stars: 30 },
  { id: 'first_motm', tier: 'bronze', cat: 'start', icon: 'star', he: 'כוכב הערב', descHe: 'פעם ראשונה {{שחקן המשחק|שחקנית המשחק}}', metric: 'motm', target: 1, stars: 15 },
  { id: 'season_one', tier: 'bronze', cat: 'start', icon: 'calendar', he: 'עונה ראשונה', descHe: 'עונה שלמה {{מאחוריך|מאחורייך}}', metric: 'seasons', target: 1, stars: 20 },
  // --- goals
  { id: 'goals_10', tier: 'bronze', cat: 'goals', icon: 'ball', he: '10 שערים', descHe: '10 שערים בקריירה', metric: 'goals', target: 10, stars: 20 },
  { id: 'goals_50', tier: 'silver', cat: 'goals', icon: 'ball', he: '50 שערים', descHe: '50 שערים בקריירה. השוערים כבר מכירים אותך', metric: 'goals', target: 50, stars: 50 },
  { id: 'goals_100', tier: 'gold', cat: 'goals', icon: 'ball', he: 'מועדון ה-100', descHe: '100 שערים בקריירה', metric: 'goals', target: 100, stars: 100 },
  { id: 'goals_300', tier: 'gold', cat: 'goals', icon: 'mega', he: '300: מכונת שערים', descHe: '300 שערים בקריירה. מספרים של אגדות', metric: 'goals', target: 300, stars: 250 },
  { id: 'hat_trick', tier: 'bronze', cat: 'goals', icon: 'sparkle', he: 'שלושער', descHe: '3 שערים במשחק אחד, והכדור הולך הביתה איתך', metric: 'hat_tricks', target: 1, stars: 30 },
  { id: 'hat_tricks_5', tier: 'gold', cat: 'goals', icon: 'sparkle', he: 'אוסף כדורים', descHe: '5 שלושערים בקריירה', metric: 'hat_tricks', target: 5, stars: 100 },
  { id: 'season_20', tier: 'silver', cat: 'goals', icon: 'target', he: 'עונה של 20', descHe: '20 שערים בעונה אחת', metric: 'season_goals_best', target: 20, stars: 60 },
  { id: 'season_40', tier: 'gold', cat: 'goals', icon: 'target', he: 'עונה של 40', descHe: '40 שערים בעונה אחת. פשוט לא הוגן', metric: 'season_goals_best', target: 40, stars: 150 },
  { id: 'top_scorer', tier: 'silver', cat: 'goals', icon: 'medal', he: '{{מלך השערים|מלכת השערים}}', descHe: 'סיום עונה בראש טבלת המבקיעים של הליגה', metric: 'top_scorer', target: 1, stars: 60 },
  { id: 'super_sub', tier: 'bronze', cat: 'goals', icon: 'swap', he: 'ג׳וקר מהספסל', descHe: '5 שערים אחרי כניסה מהספסל', metric: 'bench_goals', target: 5, stars: 25 },
  { id: 'late_winner', tier: 'silver', cat: 'goals', icon: 'clock', he: 'ברגע האחרון', descHe: 'שער ניצחון מהדקה 85 ואילך', metric: 'late_winners', target: 1, stars: 40, hidden: true },
  { id: 'teen_goals_10', tier: 'silver', cat: 'goals', icon: 'sprout', he: 'הכישרון שהתפוצץ', descHe: '10 שערים בבוגרים לפני גיל 19', metric: 'teen_goals', target: 10, stars: 50 },
  // --- play
  { id: 'assists_10', tier: 'bronze', cat: 'play', icon: 'spark', he: '10 בישולים', descHe: '10 מסירות שער בקריירה', metric: 'assists', target: 10, stars: 20 },
  { id: 'assists_50', tier: 'silver', cat: 'play', icon: 'spark', he: 'הקוסם', descHe: '50 מסירות שער בקריירה', metric: 'assists', target: 50, stars: 60 },
  { id: 'assists_100', tier: 'gold', cat: 'play', icon: 'spark', he: 'מנצח התזמורת', descHe: '100 מסירות שער בקריירה', metric: 'assists', target: 100, stars: 120 },
  { id: 'motm_10', tier: 'silver', cat: 'play', icon: 'star', he: '10 פעמים {{שחקן המשחק|שחקנית המשחק}}', descHe: '10 תארי {{שחקן המשחק|שחקנית המשחק}}', metric: 'motm', target: 10, stars: 50 },
  { id: 'motm_50', tier: 'gold', cat: 'play', icon: 'star', he: '{{האיש של הערבים הגדולים|האישה של הערבים הגדולים}}', descHe: '50 תארי {{שחקן המשחק|שחקנית המשחק}}', metric: 'motm', target: 50, stars: 150 },
  { id: 'rating_9', tier: 'silver', cat: 'play', icon: 'sparkle', he: 'ערב מושלם', descHe: 'ציון 9 ומעלה במשחק', metric: 'rating_max', target: 9, stars: 40 },
  { id: 'rating_10', tier: 'gold', cat: 'play', icon: 'mega', he: 'עשר עגול', descHe: 'ציון 10 במשחק. אין יותר מזה', metric: 'rating_max', target: 10, stars: 100, hidden: true },
  { id: 'apps_100', tier: 'silver', cat: 'play', icon: 'boot', he: '100 הופעות', descHe: '100 משחקים בבוגרים', metric: 'apps', target: 100, stars: 50 },
  { id: 'apps_300', tier: 'gold', cat: 'play', icon: 'boot', he: '300 הופעות', descHe: '300 משחקים בבוגרים', metric: 'apps', target: 300, stars: 120 },
  { id: 'apps_500', tier: 'gold', cat: 'play', icon: 'boot', he: '500: ברזל', descHe: '500 משחקים בבוגרים', metric: 'apps', target: 500, stars: 200 },
  // --- goalkeepers / defenders
  { id: 'cs_1', tier: 'bronze', cat: 'gk', icon: 'shield', he: 'רשת נקייה', descHe: 'משחק ראשון בלי לספוג', metric: 'clean_sheets', target: 1, stars: 15 },
  { id: 'cs_25', tier: 'silver', cat: 'gk', icon: 'shield', he: 'הקיר', descHe: '25 רשתות נקיות בקריירה', metric: 'clean_sheets', target: 25, stars: 60 },
  { id: 'cs_100', tier: 'gold', cat: 'gk', icon: 'lock', he: 'המנעול', descHe: '100 רשתות נקיות בקריירה', metric: 'clean_sheets', target: 100, stars: 150 },
  // --- club
  { id: 'derby_win', tier: 'bronze', cat: 'club', icon: 'flag', he: '{{מלך העיר|מלכת העיר}}', descHe: 'ניצחון בדרבי', metric: 'derby_wins', target: 1, stars: 25 },
  { id: 'derby_wins_5', tier: 'silver', cat: 'club', icon: 'flag', he: 'העיר שלך', descHe: '5 ניצחונות בדרבי', metric: 'derby_wins', target: 5, stars: 60 },
  { id: 'cup_win', tier: 'silver', cat: 'club', icon: 'trophy', he: 'גביע ראשון', descHe: 'זכייה בגביע', metric: 'cup_wins', target: 1, stars: 50 },
  { id: 'league_title', tier: 'silver', cat: 'club', icon: 'trophy', he: '{{אלופים|אלופות}}!', descHe: 'זכייה באליפות', metric: 'league_titles', target: 1, stars: 70 },
  { id: 'league_titles_3', tier: 'gold', cat: 'club', icon: 'trophy', he: 'שושלת', descHe: '3 אליפויות בקריירה', metric: 'league_titles', target: 3, stars: 120 },
  { id: 'trophies_10', tier: 'gold', cat: 'club', icon: 'hof', he: 'ארון מלא', descHe: '10 תארים בקריירה', metric: 'trophies', target: 10, stars: 150 },
  { id: 'promoted', tier: 'bronze', cat: 'club', icon: 'up', he: 'עולים ליגה', descHe: 'עלייה ליגה עם הקבוצה', metric: 'promoted', target: 1, stars: 30 },
  { id: 'captain', tier: 'silver', cat: 'club', icon: 'users', he: 'הסרט על הזרוע', descHe: '{{קפטן|קפטנית}} הקבוצה', metric: 'captain', target: 1, stars: 50 },
  { id: 'one_club', tier: 'gold', cat: 'club', icon: 'heart', he: '{{איש של מועדון אחד|אישה של מועדון אחד}}', descHe: '8 עונות באותו מועדון', metric: 'one_club', target: 8, stars: 100, hidden: true },
  // --- journey
  { id: 'clubs_3', tier: 'bronze', cat: 'journey', icon: 'bag', he: 'תרמיל על הגב', descHe: 'שיחקת ב-3 מועדונים', metric: 'clubs', target: 3, stars: 20 },
  { id: 'moved_abroad', tier: 'silver', cat: 'journey', icon: 'plane', he: 'טסים לאירופה', descHe: 'מעבר לקבוצה בחו״ל', metric: 'abroad', target: 1, stars: 50 },
  { id: 'top5', tier: 'silver', cat: 'journey', icon: 'globe', he: 'ליגות הטופ', descHe: 'משחק בליגה מחמש הגדולות: אנגליה, ספרד, איטליה, גרמניה או צרפת', metric: 'top5', target: 1, stars: 70 },
  { id: 'comeback', tier: 'bronze', cat: 'journey', icon: 'medic', he: 'חזרה מפציעה', descHe: 'חזרה למגרש אחרי פציעה ארוכה', metric: 'injury_comeback', target: 1, stars: 25 },
  { id: 'veteran_35', tier: 'gold', cat: 'journey', icon: 'clock', he: 'יין משובח', descHe: 'משחק בבוגרים בגיל 35', metric: 'age_app', target: 35, stars: 100 },
  { id: 'legend', tier: 'gold', cat: 'journey', icon: 'hof', he: 'אגדה', descHe: '320 נקודות מורשת. השכונה כבר קוראת למגרש על שמך', metric: 'legacy', target: 320, stars: 200 },
  // --- europe
  { id: 'europe_debut', tier: 'bronze', cat: 'europe', icon: 'stadium', he: 'לילות אירופה', descHe: 'משחק ראשון במפעל אירופי', metric: 'europe_apps', target: 1, stars: 25 },
  { id: 'ucl_debut', tier: 'silver', cat: 'europe', icon: 'stadium', he: 'ההמנון', descHe: 'בכורה בליגת האלופות', metric: 'ucl_apps', target: 1, stars: 60 },
  { id: 'ucl_goal', tier: 'silver', cat: 'europe', icon: 'ball', he: 'שער בליגת האלופות', descHe: 'שער ראשון בליגת האלופות', metric: 'ucl_goals', target: 1, stars: 70 },
  { id: 'ucl_goals_10', tier: 'gold', cat: 'europe', icon: 'mega', he: '{{מלך אירופה|מלכת אירופה}}', descHe: '10 שערים בליגת האלופות', metric: 'ucl_goals', target: 10, stars: 120 },
  { id: 'ucl_win', tier: 'gold', cat: 'europe', icon: 'trophy', he: 'האוזניים הגדולות', descHe: 'זכייה בליגת האלופות', metric: 'ucl_wins', target: 1, stars: 200 },
  // --- national
  { id: 'ynt_debut', tier: 'bronze', cat: 'national', icon: 'flag', he: '{{נבחרת הנוער|נבחרת הנערות}}', descHe: 'משחק ראשון בנבחרת צעירה', metric: 'ynt_apps', target: 1, stars: 25 },
  { id: 'nt_debut', tier: 'silver', cat: 'national', icon: 'flag', he: 'הנבחרת הבוגרת', descHe: 'בכורה בנבחרת הבוגרת', metric: 'nt_apps', target: 1, stars: 60 },
  { id: 'nt_goal', tier: 'silver', cat: 'national', icon: 'ball', he: 'שער בשביל המדינה', descHe: 'שער ראשון בנבחרת הבוגרת', metric: 'nt_goals', target: 1, stars: 70 },
  { id: 'nt_caps_50', tier: 'gold', cat: 'national', icon: 'medal', he: '50 הופעות בנבחרת', descHe: '50 משחקים בנבחרת הבוגרת', metric: 'nt_apps', target: 50, stars: 120 },
  { id: 'wc_play', tier: 'silver', cat: 'national', icon: 'globe', he: 'מונדיאל!', descHe: 'משחק בטורניר גביע העולם', metric: 'wc_apps', target: 1, stars: 80 },
  { id: 'cont_win', tier: 'gold', cat: 'national', icon: 'trophy', he: '{{אלופי היבשת|אלופות היבשת}}', descHe: 'זכייה באליפות היבשת עם הנבחרת', metric: 'cont_wins', target: 1, stars: 150 },
  { id: 'wc_win', tier: 'gold', cat: 'national', icon: 'trophy', he: '{{אלוף העולם|אלופת העולם}}', descHe: 'זכייה בגביע העולם', metric: 'wc_wins', target: 1, stars: 300 },
  // --- awards
  { id: 'tots', tier: 'silver', cat: 'awards', icon: 'users', he: 'נבחרת העונה', descHe: 'מקום בנבחרת העונה של הליגה', metric: 'tots', target: 1, stars: 50 },
  { id: 'pots', tier: 'gold', cat: 'awards', icon: 'medal', he: '{{שחקן העונה|שחקנית העונה}}', descHe: 'פרס {{שחקן העונה|שחקנית העונה}} בליגה', metric: 'pots', target: 1, stars: 100 },
  { id: 'golden_boy', tier: 'gold', cat: 'awards', icon: 'star', he: '{{הגולדן בוי|הכישרון הצעיר}}', descHe: '{{פרס הגולדן בוי|פרס הכישרון הצעיר}} לכישרון הצעיר הטוב בעולם', metric: 'golden_boy', target: 1, stars: 120 },
  { id: 'ballon_top10', tier: 'silver', cat: 'awards', icon: 'ball', he: 'טופ 10 בעולם', descHe: 'מקום בעשירייה הראשונה של כדור הזהב', metric: 'ballon_top10', target: 1, stars: 100 },
  { id: 'ballon_podium', tier: 'gold', cat: 'awards', icon: 'ball', he: 'על הפודיום', descHe: 'מקום בשלישייה הראשונה של כדור הזהב', metric: 'ballon_podium', target: 1, stars: 150 },
  { id: 'ballon_win', tier: 'gold', cat: 'awards', icon: 'trophy', he: 'כדור הזהב', descHe: '{{השחקן הטוב|השחקנית הטובה}} בעולם. מהשכונה ועד הפסגה', metric: 'ballon_wins', target: 1, stars: 300 },
  // --- manager
  { id: 'mgr_job', tier: 'bronze', cat: 'manager', icon: 'clipboard', he: 'על הקווים', descHe: 'תפקיד אימון ראשון', metric: 'mgr_jobs', target: 1, stars: 25 },
  { id: 'mgr_wins_25', tier: 'silver', cat: 'manager', icon: 'whistle', he: '25 ניצחונות על הקווים', descHe: '25 ניצחונות בתור {{מאמן|מאמנת}}', metric: 'mgr_wins', target: 25, stars: 60 },
  { id: 'mgr_trophy', tier: 'silver', cat: 'manager', icon: 'trophy', he: 'תואר ראשון בתור {{מאמן|מאמנת}}', descHe: 'זכייה בתואר בתור {{מאמן|מאמנת}}', metric: 'mgr_trophies', target: 1, stars: 80 },
  { id: 'mgr_title', tier: 'gold', cat: 'manager', icon: 'trophy', he: 'אליפות מהספסל', descHe: 'זכייה באליפות בתור {{מאמן|מאמנת}}', metric: 'mgr_titles', target: 1, stars: 150 },
  { id: 'mgr_award', tier: 'gold', cat: 'manager', icon: 'medal', he: '{{מאמן השנה|מאמנת השנה}}', descHe: 'פרס {{מאמן העונה|מאמנת העונה}} או {{מאמן השנה|מאמנת השנה}}', metric: 'mgr_awards', target: 1, stars: 120 },
  // --- character
  { id: 'talk_ok', tier: 'bronze', cat: 'character', icon: 'talk', he: 'בגובה העיניים', descHe: 'שיחה מוצלחת עם המאמן', metric: 'talk_ok', target: 1, stars: 15 },
  { id: 'talk_ok_3', tier: 'silver', cat: 'character', icon: 'talk', he: '{{יודע לדבר|יודעת לדבר}}', descHe: '3 שיחות מוצלחות עם המאמן', metric: 'talk_ok', target: 3, stars: 40 },
  { id: 'burnout_survived', tier: 'silver', cat: 'character', icon: 'battery', he: 'קמים מהקרשים', descHe: 'יציאה משחיקה: העומס חזר מתחת ל-40', metric: 'burnout_survived', target: 1, stars: 40, hidden: true },
  // --- meta (daily, stars, sharing)
  { id: 'streak_3', tier: 'bronze', cat: 'meta', icon: 'calendar', he: '3 ימים ברצף', descHe: 'חזרת 3 ימים ברצף', metric: 'streak_best', target: 3, stars: 15 },
  { id: 'streak_7', tier: 'silver', cat: 'meta', icon: 'calendar', he: 'שבוע מושלם', descHe: '7 ימים ברצף', metric: 'streak_best', target: 7, stars: 40 },
  { id: 'streak_30', tier: 'gold', cat: 'meta', icon: 'calendar', he: 'חודש של {{מקצוען|מקצוענית}}', descHe: '30 ימים ברצף', metric: 'streak_best', target: 30, stars: 150 },
  { id: 'objectives_10', tier: 'bronze', cat: 'meta', icon: 'check', he: 'מכונת משימות', descHe: '10 משימות הושלמו', metric: 'objectives', target: 10, stars: 25 },
  { id: 'objectives_50', tier: 'silver', cat: 'meta', icon: 'check', he: 'אין משימה שלא נגמרת', descHe: '50 משימות הושלמו', metric: 'objectives', target: 50, stars: 80 },
  { id: 'stars_500', tier: 'silver', cat: 'meta', icon: 'star', he: 'אספן כוכבים', descHe: '500 ⭐ נאספו', metric: 'stars_earned', target: 500, stars: 50 },
  { id: 'style_first', tier: 'bronze', cat: 'meta', icon: 'sparkle', he: 'סטייל', descHe: 'פריט ראשון מלשונית הפרסים', metric: 'cosmetics', target: 1, stars: 10 },
  { id: 'shared_card', tier: 'bronze', cat: 'meta', icon: 'upload', he: 'שגריר השכונה', descHe: 'שיתפת כרטיס', metric: 'shared', target: 1, stars: 15 },
  { id: 'challenge_sent', tier: 'bronze', cat: 'meta', icon: 'fist', he: 'אתגר נשלח', descHe: 'אתגרת חבר', metric: 'challenges', target: 1, stars: 15 },
];

export const ACH_UI = {
  title: 'הישגים',
  progress: '{u} מתוך {t} הישגים',
  rowProgress: '{p}/{t}',
  locked: 'נעול',
  hidden: '???',
  hiddenDesc: 'הישג סודי. ימשיך להיות סודי עד שיקרה',
  unlockedAt: 'נפתח: {v}',
  toast: 'הישג חדש!',
  toastSub: '{he} · +{n} ⭐',
  share: '📤 שתף',
  filterAll: 'הכול',
  filterUnlocked: 'נפתחו',
  filterLocked: 'עוד לא',
  tiers: { bronze: 'ארד', silver: 'כסף', gold: 'זהב' },
  cats: {
    start: 'הצעדים הראשונים', goals: 'שערים', play: 'על הדשא', gk: 'שוערים והגנה', club: 'מועדון',
    journey: 'המסע', europe: 'אירופה', national: 'נבחרת', awards: 'פרסים', manager: 'אימון', character: 'אופי', meta: 'נאמנות',
  },
};

// ---------------------------------------------------------------------------
// F9 match stakes. STAKES.kinds[kind] = {
//   icon, prio (higher = shown first; show the top 1-2 that apply),
//   need: 'win'|'not_lose'|'score'|'ga'|'rating'|'clean'|'play'  (+ val for rating),
//   he: string[]   pre-match line (pick one, rngFor(..., 'stake', kind)),
//   hit: string[]  after the match when need was met,
//   miss: string[] after the match when it was not,
//   fx: { hit?: Effects, miss?: Effects }  suggested consequences, §4.1 Effects
//        plus three extra keys the engine may map to its own systems:
//        promise: 'next1' (coach promise: start the next match),
//        natBoost: n (weeks of boosted national call-up chance),
//        interest: 'abroad'|'local' (an interested club; with agentPush = more offers)
// }
// `when` comments say when the engine should consider the kind.
// Placeholders: {opp} {club} {rival} {pos} (target table position) {n}
// {scoutClub} (a bigger club name, engine-picked) {comp} {round} {coach}
// {teammate} {nation}. Markers allowed.
// personal[id] = { he, need, val?, stars, cond?, doneHe, missHe } (one per
// match, cond like OBJECTIVES cond). ui = card copy.
// ---------------------------------------------------------------------------
export const STAKES = {
  kinds: {
    // when: fixture vs club.rival
    derby: { icon: 'flag', prio: 95, need: 'win',
      he: ['דרבי. כל העיר מסתכלת', 'דרבי מול {rival}. השבוע הזה אף אחד בעיר לא ישן', 'מי שמנצח היום, מסתובב בעיר עם הראש למעלה כל החודש'],
      hit: ['ניצחתם בדרבי! העיר שלכם', 'הדרבי שלכם. הקהל ישיר את השם שלך כל השבוע'],
      miss: ['הדרבי הלך. השבוע יהיה ארוך ברחוב', 'לא היום. יש עוד דרבי, ויש חשבון לסגור'],
      fx: { hit: { fans: 4, morale: 4 }, miss: { fans: -2, morale: -3 } } },
    // when: league fixture and a win would lift the club to a better position ({pos})
    table_up: { icon: 'up', prio: 60, need: 'win',
      he: ['ניצחון מעלה אתכם למקום {pos}', 'שלוש נקודות היום, ו{club} במקום {pos}', 'הטבלה צפופה. ניצחון ואתם במקום {pos}'],
      hit: ['עליתם למקום {pos}!', 'מקום {pos}. הטבלה כבר נראית אחרת'],
      miss: ['הטבלה לא זזה הפעם', 'הנקודות נשארו בחוץ. המקום ה-{pos} יחכה'],
      fx: { hit: { morale: 2 }, miss: { morale: -1 } } },
    // when: a win keeps / takes first place
    table_top: { icon: 'trophy', prio: 80, need: 'win',
      he: ['ניצחון, ואתם במקום הראשון', 'המקום הראשון על הכף', 'כל הליגה מסתכלת: ניצחון ו{club} בפסגה'],
      hit: ['{club} בראש הטבלה!', 'מקום ראשון. ככה נראית פסגה'],
      miss: ['הפסגה ברחה הפעם. עוד ארוכה הדרך', 'מישהו אחר בראש הטבלה. בינתיים'],
      fx: { hit: { morale: 3, fans: 2 }, miss: { morale: -2 } } },
    // when: week >= 30, club within 3 points of first place
    title: { icon: 'trophy', prio: 90, need: 'win',
      he: ['מרוץ האליפות בשיאו. כל נקודה שווה זהב', 'עוד ניצחון, וצלחת האליפות מתקרבת', 'זה החלק של העונה שבו נכנסים לספרי ההיסטוריה'],
      hit: ['האליפות קרובה מתמיד', 'עוד צעד לעבר הצלחת'],
      miss: ['מעידה במרוץ האליפות. אסור שזה יקרה שוב', 'הנקודות האלה עוד יחסרו. או שלא'],
      fx: { hit: { morale: 3, fans: 2 }, miss: { morale: -3 } } },
    // when: club in the relegation zone or within 3 points of it
    relegation: { icon: 'warn', prio: 85, need: 'not_lose',
      he: ['קרב הישרדות. הפסד ואתם עמוק בתחתית', 'כל נקודה היום שווה הישארות בליגה', 'המשחק הכי חשוב של העונה, גם אם אף אחד לא יגיד את זה בטלוויזיה'],
      hit: ['נקודות של זהב בקרב ההישרדות', 'נשמתם. הקו האדום קצת יותר רחוק'],
      miss: ['הלחץ בתחתית עולה', 'הפסד כואב. הקבוצות מלמטה מתקרבות'],
      fx: { hit: { morale: 3, trust: 2 }, miss: { morale: -3 } } },
    // when: club within 3 points of the last European place
    europe_race: { icon: 'globe', prio: 70, need: 'win',
      he: ['ניצחון, ואתם בתוך מקומות אירופה', 'אירופה בעונה הבאה מתחילה היום', 'הכרטיס לאירופה על השולחן'],
      hit: ['אירופה מתקרבת!', 'הכרטיס לאירופה כמעט בכיס'],
      miss: ['אירופה התרחקה צעד', 'נקודות שעוד יחסרו במרוץ לאירופה'],
      fx: { hit: { morale: 2, fans: 1 } } },
    // when: random (chance), player OVR >= 62 or rep high; {scoutClub} = a bigger foreign club
    scout_abroad: { icon: 'plane', prio: 75, need: 'rating', val: 7.0,
      he: ['סקאוט של {scoutClub} ביציע', 'הסוכן לחש לך: "{scoutClub} שלחו מישהו לראות אותך היום"', 'במקום ה-12 בשורה ה-4 יושב סקאוט של {scoutClub}. הוא בא בשבילך'],
      hit: ['הסקאוט של {scoutClub} רשם את השם שלך. הסוכן כבר קיבל טלפון', '{scoutClub} התרשמו. הסיכוי להצעה מחו״ל עלה'],
      miss: ['הסקאוט של {scoutClub} יצא בדקה ה-70. תהיה עוד הזדמנות', 'לא היום. אבל סקאוטים חוזרים'],
      fx: { hit: { agentPush: 3, repC: 1, interest: 'abroad' } } },
    // when: random (chance), youth or pro in a small club; {scoutClub} = a bigger local club
    scout_local: { icon: 'users', prio: 65, need: 'rating', val: 7.0,
      he: ['סקאוט של {scoutClub} ביציע', 'אומרים ש{scoutClub} שלחו אנשים לראות אותך', 'ביציע יושב מישהו עם מחברת ומעיל של {scoutClub}'],
      hit: ['{scoutClub} שמו {{עליך|עלייך}} עין. ההצעות בדרך', 'הסקאוט של {scoutClub} יצא מרוצה'],
      miss: ['הסקאוט של {scoutClub} לא נשאר עד הסוף', 'לא הפעם. {scoutClub} יחזרו לבדוק'],
      fx: { hit: { agentPush: 2, repL: 1, interest: 'local' } } },
    // when: player on the bench / rotation, not GK
    coach_promise: { icon: 'promise', prio: 80, need: 'score',
      he: ['המאמן: "אם {{תבקיע|תבקיעי}}, {{תפתח|תפתחי}} גם בשבוע הבא"', '{coach} אמר לך במסדרון: "שער אחד, והמקום שלך"', 'המאמן מחכה לראות שער. שער אחד, וההרכב שלך'],
      hit: ['המאמן עומד במילה: {{אתה פותח|את פותחת}} במשחק הבא', 'שער, והמקום בהרכב שלך לשבוע הבא'],
      miss: ['לא הבקעת. ההבטחה של המאמן נשארה על הנייר', 'בלי שער הפעם. המאמן יחשוב שוב על ההרכב'],
      fx: { hit: { promise: 'next1', trust: 3 }, miss: { trust: -1 } } },
    // when: player in the line-up but trust low / just got the spot
    coach_test: { icon: 'clipboard', prio: 70, need: 'rating', val: 7.0,
      he: ['המאמן בוחן אותך: ציון 7 ומעלה, והמקום נשאר שלך', '{teammate} {{מתחמם|מתחממת}} לידך על הקו. אסור לפספס', 'המאמן לא אמר כלום, אבל כולם יודעים: היום מבחן'],
      hit: ['עברת את המבחן. המקום שלך', 'המאמן מהנהן. זה מספיק'],
      miss: ['המבחן לא הלך טוב. {teammate} מחכה', 'המאמן רשם משהו במחברת. לא נראה טוב'],
      fx: { hit: { trust: 4 }, miss: { trust: -3 } } },
    // when: youth national level not yet senior, player age <= 19
    ynt_watch: { icon: 'flag', prio: 75, need: 'rating', val: 7.0,
      he: ['מאמן {{נבחרת הנוער|נבחרת הנערות}} צופה', 'הטלפון מהנבחרת הצעירה יכול להגיע כבר השבוע', 'ביציע: מאמן {{נבחרת הנוער|נבחרת הנערות}}. בלי לחץ'],
      hit: ['מאמן {{נבחרת הנוער|נבחרת הנערות}} רשם אותך. הזימון מתקרב', 'הנבחרת הצעירה ראתה, והתרשמה'],
      miss: ['מאמן הנבחרת הצעירה יחזור לראות שוב', 'לא היום. הנבחרת עוד תתקשר'],
      fx: { hit: { natBoost: 4, morale: 2 } } },
    // when: not yet senior national, OVR close to call-up level
    nt_watch: { icon: 'flag', prio: 80, need: 'rating', val: 7.0,
      he: ['מאמן הנבחרת ביציע', 'הנבחרת של {nation} מחפשת פנים חדשות. מאמן הנבחרת פה', 'משחק טוב היום, ואולי זימון ראשון לנבחרת הבוגרת'],
      hit: ['מאמן הנבחרת יצא עם חיוך. הזימון קרוב', 'הנבחרת הבוגרת מתקרבת'],
      miss: ['מאמן הנבחרת עזב בלי להגיד מילה', 'לא היום. הנבחרת תחכה'],
      fx: { hit: { natBoost: 6, repL: 1 } } },
    // when: cup knockout (not the final)
    cup_ko: { icon: 'trophy', prio: 70, need: 'win',
      he: ['{round} של {comp}. מפסידים והולכים הביתה', 'גביע: אין מחר. ניצחון ואתם בשלב הבא', 'משחק גביע. הקטנות מפילות את הגדולות, והגדולות זוכרות'],
      hit: ['עליתם שלב בגביע!', 'הגביע ממשיך. עוד צעד לגמר'],
      miss: ['הגביע נגמר בשבילכם', 'הודחתם. השנה הבאה, הגביע שלנו'],
      fx: { hit: { morale: 3, fans: 1 }, miss: { morale: -2 } } },
    // when: cup final
    cup_final: { icon: 'trophy', prio: 100, need: 'win',
      he: ['גמר {comp}. משחק אחד בין {club} לבין ההיסטוריה', 'גמר. ההורים ביציע, השכונה בכיכר, והגביע על השולחן', 'כל הילדים בשכונה חולמים על הערב הזה'],
      hit: ['הגביע שלכם!!!', 'מנפים את הגביע. ערב שלא נגמר'],
      miss: ['הגביע עבר לצד השני. כואב', 'כל כך קרוב. הגמר הבא יגיע'],
      fx: { hit: { morale: 6, fans: 5 }, miss: { morale: -4 } } },
    // when: European fixture (league phase / groups)
    europe: { icon: 'stadium', prio: 75, need: 'win',
      he: ['לילה אירופי. כל היבשת צופה', 'ההמנון מתנגן. {comp} מול {opp}', 'משחק אירופי. ככה בונים שם מחוץ לבית'],
      hit: ['ניצחון אירופי! העיתונים בחו״ל כבר כותבים', 'שלוש נקודות באירופה. הלילה הזה נשאר'],
      miss: ['אירופה לימדה שיעור', 'לא הלילה. אבל הבמה הזאת שלך'],
      fx: { hit: { repC: 1, fans: 2 } } },
    // when: European knockout
    europe_ko: { icon: 'stadium', prio: 90, need: 'win',
      he: ['{round} של {comp}. משחקים כאלה זוכרים לכל החיים', 'נוקאאוט באירופה. מכאן הולכים לגמר, או הביתה', 'הלילה הזה יכול להכניס אותך לספרים'],
      hit: ['עוד צעד באירופה!', 'אירופה ממשיכה. ככה כותבים היסטוריה'],
      miss: ['הדרך באירופה נגמרה כאן', 'הלילה האירופי נגמר בשקט'],
      fx: { hit: { repC: 2, fans: 3, morale: 3 }, miss: { morale: -2 } } },
    // when: national team fixture
    national: { icon: 'flag', prio: 85, need: 'win',
      he: ['ההמנון של {nation}. כל המדינה מאחוריכם', 'משחק נבחרת. השם על הגב, הדגל על החזה', 'כל המדינה מול המסך'],
      hit: ['ניצחון לנבחרת! המדינה חוגגת', 'הנבחרת ניצחה. ההמנון נשמע אחרת עכשיו'],
      miss: ['ערב קשה לנבחרת', 'הנבחרת הפסידה. ההזדמנות הבאה תגיע'],
      fx: { hit: { repL: 1, fans: 2 } } },
    // when: national tournament match (incl. knockouts)
    tournament: { icon: 'globe', prio: 95, need: 'win',
      he: ['טורניר גדול. העולם צופה', 'משחק טורניר. אף אחד לא ישכח את מה שיקרה הלילה', '{comp}: הבמה הכי גדולה שיש'],
      hit: ['הטורניר ממשיך! המדינה בטירוף', 'עוד ניצחון בטורניר. הכיכרות מלאות'],
      miss: ['הלילה הזה כואב לכל המדינה', 'לא הלך בטורניר. הראש למעלה'],
      fx: { hit: { repW: 1, fans: 3, morale: 3 } } },
    // when: the player's first ever start
    first_start: { icon: 'start', prio: 90, need: 'play',
      he: ['פתיחה ראשונה בהרכב. השם שלך על הלוח', 'בפעם הראשונה {{אתה|את}} עולה מהשריקה הראשונה', 'ההרכב יצא, והשם שלך שם. מהדקה הראשונה'],
      hit: ['פתיחה ראשונה {{מאחוריך|מאחורייך}}. עכשיו רק עוד', 'תשעים דקות ראשונות בבוגרים. רק ההתחלה'],
      miss: ['המשחק לא הלך כמו שחלמת. יהיו עוד'],
      fx: { hit: { trust: 2, morale: 3 } } },
    // when: pro stage, contract ends this season, or youth before the pro contract
    contract: { icon: 'pen', prio: 70, need: 'rating', val: 7.0,
      he: ['ההנהלה ביציע. הופעה טובה, והחוזה החדש בדרך', 'הסוכן אומר: "עוד משחק כזה, ואני סוגר לך חוזה"', 'החוזה על השולחן. המשחק הזה יכול לחתום אותו'],
      hit: ['ההנהלה התרשמה. החוזה מתקרב', 'הסוכן שלח הודעה: "זה היה המשחק שהייתי צריך"'],
      miss: ['ההנהלה עוד מתלבטת', 'החוזה יחכה עוד קצת'],
      fx: { hit: { agentPush: 2, trust: 2 } } },
    // when: first match after an injury of >= 3 weeks
    return: { icon: 'medic', prio: 75, need: 'play',
      he: ['חזרה מפציעה. הגוף מוכן? המשחק יגיד', 'שבועות של פיזיותרפיה, והנה זה: חזרה לדשא', 'הקהל מחכה לראות אותך שוב'],
      hit: ['חזרת! והגוף החזיק', 'החזרה הושלמה. כאילו לא היית בחוץ'],
      miss: ['החזרה לוקחת זמן. סבלנות'],
      fx: { hit: { morale: 3 } } },
    // when: club lost the last meeting with this opponent
    revenge: { icon: 'fist', prio: 55, need: 'win',
      he: ['בפעם הקודמת {opp} ניצחו. היום מחזירים', 'יש חשבון פתוח עם {opp}', 'כולם בחדר ההלבשה זוכרים את המשחק הקודם מול {opp}'],
      hit: ['החשבון עם {opp} נסגר', 'נקמה מתוקה'],
      miss: ['{opp} שוב לקחו את זה. החשבון רק גדל'],
      fx: { hit: { morale: 3, mates: 2 } } },
    // when: club won the last 3+ ({n})
    win_streak: { icon: 'spark', prio: 50, need: 'win',
      he: ['{n} ניצחונות ברצף. שומרים על הרצף', 'הקבוצה על גל. ניצחון היום והרצף ממשיך', '{{אף אחד לא רוצה להיות זה ששובר|אף אחת לא רוצה להיות זאת ששוברת}} את הרצף'],
      hit: ['הרצף ממשיך!', 'עוד ניצחון. הגל לא נשבר'],
      miss: ['הרצף נשבר. מתחילים חדש'],
      fx: { hit: { morale: 2 } } },
    // when: club lost the last 2+ ({n})
    loss_streak: { icon: 'warn', prio: 60, need: 'not_lose',
      he: ['{n} הפסדים ברצף. חייבים לעצור את הנפילה', 'הקהל מתחיל לשרוק. היום עוצרים את זה', 'חדר ההלבשה שקט מדי. משחק אחד יכול לשנות הכול'],
      hit: ['הנפילה נעצרה. נושמים', 'סוף לרצף ההפסדים'],
      miss: ['עוד הפסד. הלחץ עולה', 'הרצף הרע ממשיך. משהו חייב להשתנות'],
      fx: { hit: { morale: 3, trust: 1 }, miss: { morale: -2 } } },
    // when: opponent much stronger
    big_opponent: { icon: 'shield', prio: 60, need: 'not_lose',
      he: ['{opp} הפייבוריטים. אף אחד לא מאמין בכם, וזה בדיוק היתרון', 'דוד מול גוליית. ונקודה היום שווה כמו ניצחון', 'כל העיתונים כבר כתבו את התוצאה. בואו נכתוב אחרת'],
      hit: ['הפתעה! {opp} לא האמינו', 'נקודות מהגדולים. ככה נבנה אופי'],
      miss: ['{opp} היו גדולים מדי הפעם', 'הפסד לפייבוריטים. לומדים וממשיכים'],
      fx: { hit: { fans: 3, morale: 4 } } },
    // when: opponent much weaker
    must_win: { icon: 'target', prio: 40, need: 'win',
      he: ['כולם מצפים לניצחון. אסור להחליק', 'על הנייר זה קל. על הדשא אין דבר כזה קל', 'משחק "חובה". הכי מסוכן שיש'],
      hit: ['עשיתם את העבודה', 'שלוש נקודות בלי סיפורים'],
      miss: ['מעידה מביכה. העיתונים לא יסלחו', 'נקודות שאסור היה לאבד'],
      fx: { miss: { fans: -2, morale: -2 } } },
    // when: home match, random (chance)
    family: { icon: 'mom', prio: 45, need: 'rating', val: 7.0,
      he: ['כל המשפחה ביציע. אבא הביא את התרמוס', 'סבתא באה למשחק. בפעם הראשונה', 'החבר׳ה מהשכונה קנו כרטיסים בשורה הראשונה'],
      hit: ['המשפחה יצאה גאה. אמא כבר מתקשרת לכל השכונה', 'אבא לא הפסיק למחוא כפיים'],
      miss: ['אמא אומרת שהיית הכי {{טוב|טובה}} במגרש. אמהות'],
      fx: { hit: { morale: 4 } } },
    // when: player 1 goal away from a round career number ({n} = 10, 25, 50, 100, ...)
    milestone: { icon: 'ball', prio: 70, need: 'score',
      he: ['עוד שער אחד, ו{{אתה מגיע|את מגיעה}} ל-{n} בקריירה', 'שער ה-{n} מחכה', 'המספר {n} כבר מודפס על חולצה. חסר רק השער'],
      hit: ['שער ה-{n}! מספר עגול', '{n} שערים בקריירה. ועוד הרבה'],
      miss: ['שער ה-{n} יחכה למשחק הבא'],
      fx: { hit: { fans: 2, morale: 3 } } },
    // when: week 30 fixture
    birthday: { icon: 'sparkle', prio: 50, need: 'win',
      he: ['משחק ביום ההולדת. הקהל כבר יודע', 'יום הולדת, והמתנה הכי טובה היא שלוש נקודות'],
      hit: ['מזל טוב! ניצחון ביום ההולדת', 'יום הולדת עם ניצחון. אין עוגה יותר טובה'],
      miss: ['יום הולדת בלי ניצחון. העוגה תעזור'],
      fx: { hit: { morale: 3 } } },
    // when: fans >= 70 (fan favourite)
    fans: { icon: 'users', prio: 45, need: 'rating', val: 7.0,
      he: ['היציע הכין כרזה עם השם שלך', 'הקהל ישיר את השם שלך מהדקה הראשונה', 'מכירות החולצות עם השם שלך שברו שיא השבוע'],
      hit: ['הקהל לא הפסיק לשיר', 'אהבת הקהל רק גדלה'],
      miss: ['הקהל עדיין איתך. הם יודעים מה {{אתה שווה|את שווה}}'],
      fx: { hit: { fans: 3 } } },
    // when: TV / big stage match (top clash or prime-time)
    tv: { icon: 'mic', prio: 40, need: 'rating', val: 7.0,
      he: ['שידור חי בפריים טיים. כל המדינה צופה', 'המצלמות שם. משחק טוב, והפנים שלך במהדורה', 'פרשני האולפן כבר מדברים {{עליך|עלייך}} לפני שריקת הפתיחה'],
      hit: ['האולפן לא הפסיק לדבר {{עליך|עלייך}}', 'הקטע שלך כבר ויראלי'],
      miss: ['האולפן היה קשוח הערב'],
      fx: { hit: { repL: 1, fans: 2 } } },
    // when: week 1 fixture
    season_opener: { icon: 'calendar', prio: 50, need: 'win',
      he: ['משחק פתיחת העונה. הרושם הראשון נקבע היום', 'עונה חדשה, דף חדש. מתחילים חזק'],
      hit: ['פתיחת עונה מושלמת', 'ככה פותחים עונה'],
      miss: ['פתיחה עקומה. העונה ארוכה'],
      fx: { hit: { morale: 2 } } },
    // when: last league fixture of the season
    last_match: { icon: 'flag', prio: 55, need: 'win',
      he: ['המשחק האחרון של העונה. נפרדים בגדול', 'מחזור אחרון. מסיימים עם חיוך'],
      hit: ['סיום עונה עם ניצחון', 'נפרדים מהעונה בגדול'],
      miss: ['סיום עונה מאכזב. הקיץ יעזור'],
      fx: { hit: { morale: 2, fans: 1 } } },
    // when: academy / youth match, the first-team coach watching
    youth: { icon: 'sprout', prio: 60, need: 'rating', val: 7.0,
      he: ['מאמן הבוגרים צופה במשחק {{הנוער|הנערות}}', 'משחק טוב היום, ואולי זימון לבוגרים בשבוע הבא', '{{כל השחקנים יודעים|כל השחקניות יודעות}} מי יושב ביציע היום'],
      hit: ['מאמן הבוגרים ראה. הדלת נפתחת', 'השם שלך עלה בישיבת הצוות של הבוגרים'],
      miss: ['מאמן הבוגרים יחזור לראות'],
      fx: { hit: { trust: 3 } } },
  },
  // personal match goal (one per match; pays ⭐)
  personal: {
    score:    { he: '{{הבקע|הבקיעי}} שער', need: 'score', stars: 10, cond: { notGroups: ['GK', 'DEF'] }, doneHe: 'המטרה הושגה: הבקעת!', missHe: 'השער יחכה למשחק הבא' },
    brace:    { he: 'צמד: 2 שערים', need: 'goals', val: 2, stars: 25, cond: { groups: ['ATT'], minOvr: 66 }, doneHe: 'צמד! המטרה הושגה', missHe: 'צמד יבוא בפעם אחרת' },
    assist:   { he: '{{בשל|בשלי}} שער', need: 'assist', stars: 10, cond: { notGroups: ['GK'] }, doneHe: 'בישלת! המטרה הושגה', missHe: 'הבישול יחכה' },
    ga:       { he: 'שער או בישול', need: 'ga', stars: 8, cond: { groups: ['MID', 'ATT'] }, doneHe: 'מעורבות בשער. המטרה הושגה', missHe: 'בלי מעורבות בשערים הפעם' },
    rating7:  { he: 'ציון 7 ומעלה', need: 'rating', val: 7.0, stars: 8, doneHe: 'ציון 7+. המטרה הושגה', missHe: 'הציון לא הגיע ל-7 הפעם' },
    rating8:  { he: 'ציון 8 ומעלה', need: 'rating', val: 8.0, stars: 20, cond: { minOvr: 66 }, doneHe: 'ציון 8+! ערב גדול', missHe: 'ציון 8 יגיע' },
    clean:    { he: 'רשת נקייה', need: 'clean', stars: 12, cond: { groups: ['GK', 'DEF'] }, doneHe: 'רשת נקייה. המטרה הושגה', missHe: 'ספגתם הפעם' },
    motm:     { he: '{{שחקן המשחק|שחקנית המשחק}}', need: 'motm', stars: 20, cond: { minOvr: 64 }, doneHe: '{{שחקן המשחק|שחקנית המשחק}}! המטרה הושגה', missHe: 'התואר הלך למישהו אחר הפעם' },
    impact:   { he: '{{היכנס|היכנסי}} {{ותשפיע|ותשפיעי}}: ציון 6.5 ומעלה', need: 'rating', val: 6.5, stars: 8, cond: { bench: true }, doneHe: 'נכנסת והשפעת. המטרה הושגה', missHe: 'הדקות היו קצרות מדי הפעם' },
  },
  ui: {
    title: 'מה על הכף',
    personalTitle: 'המטרה שלך',
    reward: '+{n} ⭐',
    resultTitle: 'מה קרה עם מה שהיה על הכף',
    hit: 'הצלחה',
    miss: 'לא הפעם',
    // shown when no kind applies (pick one)
    none: ['כל משחק הוא הזדמנות להיכנס להיסטוריה', 'שלוש נקודות זה שלוש נקודות. ובמשחק הזה הן שלכם', 'אין משחק קטן. יש {{שחקנים שמחכים|שחקניות שמחכות}} להזדמנות'],
  },
};

// ---------------------------------------------------------------------------
// F9 "no empty weeks": a week without a fixture gets a training mini-goal.
// drills[i] = { id, attr (ATTRS key) | null, groups? (pos groups, omit = all),
//   notGroups?, he (the challenge), okHe (result line), stars, fx (Effects suggestion) }
// Placeholders: {first} {coach} {teammate}.
// ---------------------------------------------------------------------------
export const QUIET_WEEK = {
  title: 'אין משחק השבוע? יש אתגר באימון',
  sub: 'השבוע בלי משחק, אבל לא בלי סיפור',
  drills: [
    { id: 'd_shoot_50', attr: 'sho', notGroups: ['GK'], he: 'אתגר בעיטות: 50 בעיטות לחיבורים', okHe: '38 מתוך 50 בחיבורים. המאמן צילם את זה לקבוצה', stars: 5, fx: { attr: { sho: 0.2 }, trust: 1 } },
    { id: 'd_free_kicks', attr: 'sho', notGroups: ['GK'], he: 'בעיטות חופשיות אחרי האימון, עד שהשומר מכבה את האורות', okHe: 'שלוש ברציפות לחיבור. {teammate} {{הפסיק|הפסיקה}} לצחוק', stars: 5, fx: { attr: { sho: 0.2 } } },
    { id: 'd_sand_sprints', attr: 'pac', he: 'ספרינטים בחול בחוף הים', okHe: 'הרגליים שורפות, אבל השעון לא משקר: מהר יותר', stars: 5, fx: { attr: { pac: 0.2 }, energy: -4 } },
    { id: 'd_rondo', attr: 'pas', notGroups: ['GK'], he: 'רונדו עם הבוגרים: 5 דקות בלי לאבד כדור', okHe: 'אף כדור לא נאבד. {{הוותיקים|הוותיקות}} כבר מחאו כפיים', stars: 5, fx: { attr: { pas: 0.2 }, mates: 2 } },
    { id: 'd_cones', attr: 'dri', notGroups: ['GK'], he: 'מסלול קונוסים נגד השעון', okHe: 'שיא אישי במסלול. הכדור דבוק לרגל', stars: 5, fx: { attr: { dri: 0.2 } } },
    { id: 'd_one_on_one', attr: 'def', groups: ['DEF', 'MID'], he: '1 על 1 מול {{החלוץ הכי מהיר|החלוצה הכי מהירה}} בקבוצה', okHe: 'שבע מתוך עשר עצרת. המאמן רשם', stars: 5, fx: { attr: { def: 0.2 }, trust: 1 } },
    { id: 'd_headers', attr: 'phy', notGroups: ['GK'], he: '30 כדורי קרן, רק נגיחות', okHe: 'הצוואר כואב, הנגיחה חזקה יותר', stars: 5, fx: { attr: { phy: 0.2 } } },
    { id: 'd_gym', attr: 'phy', he: 'חדר כושר עם המאמן האישי', okHe: 'עוד משקולת על המוט. הגוף מתחזק', stars: 5, fx: { attr: { phy: 0.2 }, energy: -3 } },
    { id: 'd_gk_machine', attr: 'ref', groups: ['GK'], he: 'מכונת כדורים: 100 כדורים, רפלקסים בלבד', okHe: '84 הצלות מתוך 100. מאמן השוערים בהלם', stars: 5, fx: { attr: { ref: 0.2 } } },
    { id: 'd_gk_dive', attr: 'div', groups: ['GK'], he: 'צלילות לשני הצדדים עד שהדשא נגמר', okHe: 'הבגדים מלאים בדשא, הצלילה ארוכה יותר', stars: 5, fx: { attr: { div: 0.2 } } },
    { id: 'd_video', attr: null, he: 'ניתוח וידאו פרטי עם {coach}', okHe: '{coach} הראה לך שלוש טעויות. במשחק הבא הן לא יחזרו', stars: 5, fx: { trust: 3 } },
    { id: 'd_recovery', attr: null, he: 'יום יוגה ושחרור עם הפיזיותרפיסט', okHe: 'הגוף רענן, העומס ירד', stars: 5, fx: { energy: 10 } },
    { id: 'd_kids', attr: null, he: 'אימון עם הילדים של האקדמיה', okHe: 'חתמת על 40 כדורים. {{ילד אחד אמר שהוא רוצה|ילדה אחת אמרה שהיא רוצה}} להיות כמוך', stars: 5, fx: { fans: 2, morale: 3 } },
  ],
  done: 'האתגר הושלם',
};

// Fast-forward "המשך עד האירוע הבא" (F9). reasons[k] = why it stopped.
// Placeholders: {opp} {comp} {n} {he}.
export const FF_STOPS = {
  button: 'המשך עד האירוע הבא',
  buttonShort: 'לאירוע הבא',
  running: 'מריצים...',
  stoppedAt: 'עצרנו: {v}',
  reasons: {
    stakes: 'יש משחק עם הרבה על הכף',
    derby: 'דרבי השבוע',
    big_match: 'משחק גדול: {comp}',
    debut: 'משחק הבכורה',
    first_start: '{{אתה פותח|את פותחת}} בהרכב!',
    offer: 'הגיעה הצעה',
    callup: 'זימון לנבחרת',
    message: 'הודעה שמחכה לתשובה',
    objective: 'משימה הושלמה: {he}',
    achievement: 'הישג חדש: {he}',
    path: 'צעד חדש בשביל הקריירה',
    injury: 'פציעה',
    injury_return: 'חזרת לכשירות',
    contract: 'החוזה על השולחן',
    window: 'חלון ההעברות נפתח',
    promise: 'המאמן הבטיח לך משהו',
    talk: 'אפשר לדבר עם המאמן',
    season_end: 'סוף העונה',
    burnout: 'הגוף מאותת: עומס גבוה',
    quiet: 'אתגר אימון השבוע',
  },
};

// ---------------------------------------------------------------------------
// F7 career path. PATH.steps = ordered milestones. Row shape:
//   { id, he (short label), doneHe (one-line when reached), teaserHe ('הבא: ...'),
//     reachHe (used in CHALLENGE_TEXT: "{name} הגיע {reachHe} בגיל {age}"),
//     missing: { default, n?, n1?, ovr?, ovr1?, age? } }
//   missing.* = what is still missing. {n} = count (games / OVR points / legacy
//   points), use n1 / ovr1 when the count is 1. {age} = the age that opens it.
//   {nation} = country name.
// ---------------------------------------------------------------------------
export const PATH = {
  steps: [
    { id: 'debut', he: 'בכורה', doneHe: 'בכורה בבוגרים', teaserHe: 'הבא: משחק הבכורה', reachHe: 'לבכורה בבוגרים',
      missing: { default: 'משחק הבכורה מחכה לך השבוע', n: 'עוד {n} שבועות למשחק הבכורה', n1: 'משחק הבכורה בשבוע הבא' } },
    { id: 'first_goal', he: 'שער ראשון', doneHe: 'השער הראשון בבוגרים', teaserHe: 'הבא: השער הראשון', reachHe: 'לשער ראשון בבוגרים',
      missing: { default: 'שער אחד, והשם שלך על לוח המבקיעים' } },
    { id: 'starter', he: 'מקום בהרכב', doneHe: 'מקום קבוע בהרכב', teaserHe: 'הבא: מקום קבוע בהרכב', reachHe: 'למקום קבוע בהרכב',
      missing: { default: '{{תפתח|תפתחי}} בהרכב, והמאמן יתחיל לבנות {{עליך|עלייך}}', n: 'עוד {n} משחקים בהרכב, {{ואתה|ואת}} חלק מההרכב הקבוע', n1: 'עוד משחק אחד בהרכב, {{ואתה|ואת}} חלק מההרכב הקבוע' } },
    { id: 'pro_contract', he: 'חוזה מקצועני', doneHe: 'החוזה המקצועני הראשון', teaserHe: 'הבא: חוזה מקצועני', reachHe: 'לחוזה מקצועני',
      missing: { default: 'עוד כמה משחקים טובים, והמועדון יגיש חוזה', n: 'עוד {n} משחקים טובים, והמועדון יגיש חוזה', n1: 'עוד משחק טוב אחד, והמועדון יגיש חוזה', age: 'חוזה מקצועני נפתח בגיל {age}. עד אז, כל משחק נרשם', offer: 'הצעת חוזה מחכה לך! {{לחץ|לחצי}} כאן {{ותחתום|ותחתמי}}', later: 'ההצעה הבאה תגיע בסוף העונה. כל משחק טוב מקרב אותה' } },
    { id: 'youth_nt', he: '{{נבחרת הנוער|נבחרת הנערות}}', doneHe: 'זימון ל{{נבחרת הנוער|נבחרת הנערות}}', teaserHe: 'הבא: {{נבחרת הנוער|נבחרת הנערות}}', reachHe: 'ל{{נבחרת הנוער|נבחרת הנערות}}',
      missing: { default: 'עוד כמה משחקים טובים, ו{{נבחרת הנוער|נבחרת הנערות}} תתקשר', n: 'עוד {n} משחקים בהרכב {{ותזומן|ותזומני}} ל{{נבחרת הנוער|נבחרת הנערות}}', n1: 'עוד משחק אחד בהרכב {{ותזומן|ותזומני}} ל{{נבחרת הנוער|נבחרת הנערות}}', ovr: 'עוד {n} נקודות יכולת, ו{{נבחרת הנוער|נבחרת הנערות}} תתקשר', ovr1: 'עוד נקודת יכולת אחת, ו{{נבחרת הנוער|נבחרת הנערות}} תתקשר' } },
    { id: 'abroad_offer', he: 'הצעה מחו״ל', doneHe: 'הצעה ראשונה מחו״ל', teaserHe: 'הבא: הצעה מחו״ל', reachHe: 'להצעה מחו״ל',
      missing: { default: 'משחקים גדולים מביאים סקאוטים מאירופה', ovr: 'עוד {n} נקודות יכולת, והסקאוטים מאירופה יגיעו', ovr1: 'עוד נקודת יכולת אחת, והסקאוטים מאירופה יגיעו', n: 'עוד {n} משחקים בציון 7 ומעלה, ואירופה תשים לב', n1: 'עוד משחק אחד בציון 7 ומעלה, ואירופה תשים לב' } },
    { id: 'top5', he: 'ליגת טופ 5', doneHe: 'משחק בליגה מחמש הגדולות', teaserHe: 'הבא: אנגליה, ספרד, איטליה, גרמניה או צרפת', reachHe: 'לליגת טופ 5',
      missing: { default: 'הצעה מאנגליה, ספרד, איטליה, גרמניה או צרפת', ovr: 'עוד {n} נקודות יכולת, והליגות הגדולות יתעניינו', ovr1: 'עוד נקודת יכולת אחת, והליגות הגדולות יתעניינו' } },
    { id: 'ucl', he: 'ליגת האלופות', doneHe: 'בכורה בליגת האלופות', teaserHe: 'הבא: ליגת האלופות', reachHe: 'לליגת האלופות',
      missing: { default: 'קבוצה שמשחקת בליגת האלופות, או עונה בצמרת הליגה', ovr: 'עוד {n} נקודות יכולת, והגדולות של אירופה יבואו', ovr1: 'עוד נקודת יכולת אחת, והגדולות של אירופה יבואו' } },
    { id: 'senior_nt', he: 'הנבחרת הבוגרת', doneHe: 'בכורה בנבחרת הבוגרת', teaserHe: 'הבא: הנבחרת הבוגרת', reachHe: 'לנבחרת הבוגרת',
      missing: { default: 'עונה חזקה בהרכב, ומאמן הנבחרת יתקשר', ovr: 'עוד {n} נקודות יכולת {{ותזומן|ותזומני}} לנבחרת {nation}', ovr1: 'עוד נקודת יכולת אחת {{ותזומן|ותזומני}} לנבחרת {nation}', n: 'עוד {n} משחקים בהרכב {{ותזומן|ותזומני}} לנבחרת הבוגרת', n1: 'עוד משחק אחד בהרכב {{ותזומן|ותזומני}} לנבחרת הבוגרת' } },
    { id: 'ballon_top10', he: 'טופ 10 בכדור הזהב', doneHe: 'מקום בעשירייה של כדור הזהב', teaserHe: 'הבא: טופ 10 בעולם', reachHe: 'לטופ 10 בכדור הזהב',
      missing: { default: 'עונה ענקית: שערים, תארים וממוצע 7.5 ומעלה', ovr: 'עוד {n} נקודות יכולת, ו{{אתה|את}} ברשימה של הטובים בעולם', ovr1: 'עוד נקודת יכולת אחת, ו{{אתה|את}} ברשימה של הטובים בעולם' } },
    { id: 'legend', he: 'אגדה', doneHe: 'אגדה של השכונה, ושל כל העולם', teaserHe: 'הבא: אגדה', reachHe: 'למעמד של אגדה',
      missing: { default: 'תארים, פרסים ושנים בצמרת הופכים {{שחקן|שחקנית}} לאגדה', n: 'עוד {n} נקודות מורשת, ו{{אתה|את}} אגדה', n1: 'עוד נקודת מורשת אחת, ו{{אתה|את}} אגדה' } },
  ],
  ui: {
    title: 'שביל הקריירה',
    next: 'הבא',
    done: 'הושלם',
    current: '{{אתה|את}} פה',
    allDone: 'השביל כולו {{מאחוריך|מאחורייך}}. מכאן כותבים היסטוריה',
    stepToast: 'צעד חדש בשביל הקריירה!',
    progress: '{p}/{t}',
  },
};

// ---------------------------------------------------------------------------
// F8 daily reward + streak (js/core/daily.js; engine applies via claimDaily).
// Texts may show on the title screen before a career is loaded, so they are
// written gender-neutral (no markers). days[i] = { day (1..7), rewards:
// [{ type: 'stars'|'energy'|'money', n }], big? (day 7 chest), he }.
// Money n is the men's scale ₪ (apply econ). After day 7 the cycle restarts at
// day 1; the streak keeps counting.
// ---------------------------------------------------------------------------
export const DAILY = {
  days: [
    // v2.3 review: exclusive rewards, the same for boys and girls (no money): a mystery item (type 'item' + slot),
    // the head scout (type 'scout'), and a chest with a rare frame on day 7
    { day: 1, he: 'יום 1', rewards: [{ type: 'stars', n: 10 }] },
    { day: 2, he: 'יום 2', rewards: [{ type: 'stars', n: 5 }, { type: 'energy', n: 20 }] },
    { day: 3, he: 'יום 3', rewards: [{ type: 'item', slot: 'boots' }] },
    { day: 4, he: 'יום 4', rewards: [{ type: 'stars', n: 20 }] },
    { day: 5, he: 'יום 5', rewards: [{ type: 'item', slot: 'celebration' }] },
    { day: 6, he: 'יום 6', rewards: [{ type: 'scout' }, { type: 'energy', n: 15 }] },
    { day: 7, he: 'יום 7', big: true, rewards: [{ type: 'item', slot: 'frame' }, { type: 'stars', n: 50 }, { type: 'energy', n: 30 }] },
  ],
  ui: {
    title: 'הפרס היומי',
    sub: 'כל יום שחוזרים, הפרס גדל. ביום ה-7 מחכה תיבה',
    welcome: ['חזרת! הנה הפרס של היום', 'בוקר טוב לאלופים. הפרס מחכה', 'המאמן ראה שהגעת מוקדם. הנה משהו קטן', 'עוד יום, עוד צעד לפסגה'],
    claim: 'לאסוף',
    claimed: 'נאסף ✓',
    today: 'היום',
    tomorrow: 'מחר',
    tomorrowHint: 'מחר מחכה: {v}',
    chest: 'התיבה הגדולה',
    chestOpen: 'התיבה נפתחה!',
    chestHint: 'עוד {n} ימים לתיבה הגדולה',
    chestHint1: 'מחר: התיבה הגדולה!',
    streak: '{n} ימים ברצף',
    streak1: 'יום ראשון ברצף',
    best: 'השיא: {n} ימים',
    missed: 'פספסת יום, והרצף התחיל מחדש. היום מתחילים שוב',
    freezeUsed: 'הקפאת הרצף נכנסה לפעולה: פספסת יום, והרצף נשמר',
    freezeInfo: 'הקפאת רצף אחת בשבוע שומרת על הרצף אם מפספסים יום',
    freezeReady: 'הקפאת רצף: זמינה',
    freezeSpent: 'הקפאת רצף: נוצלה השבוע',
    noCareer: 'הפרס מחכה בקריירה. אפשר לאסוף אותו כשהקריירה נטענת',
    badge: 'יש פרס שמחכה',
    close: 'סגור',
  },
};

// ---------------------------------------------------------------------------
// F6 star rewards ("פרסים" section of the shop). COSMETICS = {
//   slots: { [slot]: { he, icon } }   slot ids: boots | celebration | frame | accessory | boost
//   items: [{ id, slot, he, descHe, price (⭐; 0 = owned from the start, default: true),
//            rarity: 'common'|'rare'|'epic'|'legendary',
//            colors?: [main, accent] (boots / accessory, hex),
//            style?:  celebration style key drawn by js/ui/scene/celebration.js:
//                     classic | knee_slide | backflip | spin_jump | heart_hands |
//                     airplane | shush | salute | dance,
//            frame?:  card frame key: basic | silver | gold | holo | fire | neon | night,
//            acc?:    accessory key: none | headband | wristband | armband | snood |
//                     tape | sleeve | clip | gloves,
//            boost?:  boost key: energy_refill | scout_report | morale_boost,
//            limit?:  { perWeeks: n } (boosts: one use per n game weeks) | { perSeason: n },
//            gender?: 'm'|'f' (only offered in that world) }]
//   ui: shop section copy. Placeholders: {n} {he} {pot} {slot}
// }
// Celebration lines for each style: commentary.js CELEBRATION_STYLE_TEXT.
// ---------------------------------------------------------------------------
export const COSMETICS = {
  slots: {
    boots: { he: 'נעליים', icon: 'boot' },
    celebration: { he: 'חגיגת שער', icon: 'sparkle' },
    frame: { he: 'מסגרת לכרטיס', icon: 'card' },
    accessory: { he: 'אביזר', icon: 'user' },
    boost: { he: 'חיזוקים', icon: 'battery' },
  },
  items: [
    // boots
    { id: 'boots_classic', slot: 'boots', he: 'שחורות קלאסיות', descHe: 'הנעליים מהשכונה. איתן הכול התחיל', price: 0, default: true, rarity: 'common', colors: ['#1B1F27', '#FFFFFF'] },
    { id: 'boots_white', slot: 'boots', he: 'לבנות בוהקות', descHe: 'צריך אומץ לנעול לבנות. או כישרון', price: 40, rarity: 'common', colors: ['#F4F6FA', '#C9A227'] },
    { id: 'boots_red', slot: 'boots', he: 'אדום לוהט', descHe: 'השוער רואה אותן לפני שהוא רואה את הכדור', price: 60, rarity: 'common', colors: ['#E0262E', '#1B1F27'] },
    { id: 'boots_neon', slot: 'boots', he: 'ירוק ניאון', descHe: 'אפשר לראות אותן מהיציע העליון', price: 80, rarity: 'rare', colors: ['#7CFF3B', '#14202B'] },
    { id: 'boots_blue', slot: 'boots', he: 'כחול חשמלי', descHe: 'מהירות שרואים בעיניים', price: 80, rarity: 'rare', colors: ['#1E7BFF', '#9FE6FF'] },
    { id: 'boots_pink', slot: 'boots', he: 'ורוד פלמינגו', descHe: 'הכי בולטות במגרש. וזו בדיוק הכוונה', price: 100, rarity: 'rare', colors: ['#FF5FA2', '#FFFFFF'] },
    { id: 'boots_gold', slot: 'boots', he: 'זהב טהור', descHe: 'נעלי זהב ל{{מלך השערים|מלכת השערים}}', price: 250, rarity: 'epic', colors: ['#E8B931', '#6B4A00'] },
    { id: 'boots_galaxy', slot: 'boots', he: 'גלקסיה', descHe: 'סגול, כחול וכוכבים. מהחלל לרשת', price: 400, rarity: 'legendary', colors: ['#5B2BD9', '#2FD3FF'] },
    // celebrations
    { id: 'cel_classic', slot: 'celebration', he: 'ריצה לקהל', descHe: 'אגרוף באוויר וריצה אל היציע', price: 0, default: true, rarity: 'common', style: 'classic' },
    { id: 'cel_knee_slide', slot: 'celebration', he: 'החלקת ברכיים', descHe: 'החלקה על הברכיים עד דגל הקרן', price: 60, rarity: 'common', style: 'knee_slide' },
    { id: 'cel_heart', slot: 'celebration', he: 'לב לקהל', descHe: 'ידיים בצורת לב, ישר למצלמה', price: 60, rarity: 'common', style: 'heart_hands' },
    { id: 'cel_airplane', slot: 'celebration', he: 'המטוס', descHe: 'ידיים פרושות וסיבוב נמוך מול היציע', price: 80, rarity: 'rare', style: 'airplane' },
    { id: 'cel_shush', slot: 'celebration', he: 'ששש...', descHe: 'אצבע על השפתיים מול הקהל של היריבה', price: 100, rarity: 'rare', style: 'shush' },
    { id: 'cel_salute', slot: 'celebration', he: 'הצדעה', descHe: 'עמידה זקופה והצדעה ליציע', price: 100, rarity: 'rare', style: 'salute' },
    { id: 'cel_dance', slot: 'celebration', he: 'ריקוד הניצחון', descHe: 'ריקוד שכל השכונה תעתיק ביום ראשון', price: 150, rarity: 'epic', style: 'dance' },
    { id: 'cel_spin_jump', slot: 'celebration', he: 'קפיצת הסיבוב', descHe: 'ריצה, קפיצה, סיבוב באוויר ונחיתה עם צעקה', price: 200, rarity: 'epic', style: 'spin_jump' },
    { id: 'cel_backflip', slot: 'celebration', he: 'סלטה אחורית', descHe: 'סלטה מלאה. הפיזיותרפיסט מבקש שלא', price: 300, rarity: 'legendary', style: 'backflip' },
    // card frames
    { id: 'frame_basic', slot: 'frame', he: 'מסגרת רגילה', descHe: 'הכרטיס הראשון', price: 0, default: true, rarity: 'common', frame: 'basic' },
    { id: 'frame_silver', slot: 'frame', he: 'כסף', descHe: 'מסגרת כסף מבריקה', price: 50, rarity: 'common', frame: 'silver' },
    { id: 'frame_night', slot: 'frame', he: 'אצטדיון בלילה', descHe: 'אורות הזרקורים מסביב לכרטיס', price: 90, rarity: 'rare', frame: 'night' },
    { id: 'frame_fire', slot: 'frame', he: 'אש', descHe: 'כרטיס לוהט למי שבכושר שיא', price: 120, rarity: 'rare', frame: 'fire' },
    { id: 'frame_neon', slot: 'frame', he: 'ניאון', descHe: 'קווים זוהרים בצבעי הקבוצה', price: 120, rarity: 'rare', frame: 'neon' },
    { id: 'frame_gold', slot: 'frame', he: 'זהב', descHe: 'מסגרת זהב, כמו לאגדות', price: 200, rarity: 'epic', frame: 'gold' },
    { id: 'frame_holo', slot: 'frame', he: 'הולוגרמה', descHe: 'הכרטיס הנדיר מכולם. מחליף צבעים כשמזיזים', price: 350, rarity: 'legendary', frame: 'holo' },
    // accessories
    { id: 'acc_none', slot: 'accessory', he: 'בלי אביזר', descHe: 'נקי ופשוט', price: 0, default: true, rarity: 'common', acc: 'none' },
    { id: 'acc_wristband', slot: 'accessory', he: 'צמיד ספורט', descHe: 'צמיד בד בצבעי הקבוצה', price: 30, rarity: 'common', acc: 'wristband', colors: ['#FFFFFF', '#E0262E'] },
    { id: 'acc_headband', slot: 'accessory', he: 'סרט ראש', descHe: 'השיער במקום, הראש בפוקוס', price: 40, rarity: 'common', acc: 'headband', colors: ['#FFFFFF', '#1B1F27'] },
    { id: 'acc_tape', slot: 'accessory', he: 'טייפ על הגרביים', descHe: 'כמו {{הוותיקים|הוותיקות}} בחדר ההלבשה', price: 40, rarity: 'common', acc: 'tape', colors: ['#F4F6FA', '#9AA3B2'] },
    { id: 'acc_sleeve', slot: 'accessory', he: 'שרוול ארוך מתחת לחולצה', descHe: 'לערבי חורף ולסטייל', price: 60, rarity: 'rare', acc: 'sleeve', colors: ['#1B1F27', '#1B1F27'] },
    { id: 'acc_snood', slot: 'accessory', he: 'צווארון חורף', descHe: 'למשחקי חוץ בקור של צפון אירופה', price: 60, rarity: 'rare', acc: 'snood', colors: ['#1B1F27', '#3A4250'] },
    { id: 'acc_clip', slot: 'accessory', he: 'סיכת שיער זהב', descHe: 'קטנה, נוצצת, ונראית בכל תמונה', price: 80, rarity: 'rare', acc: 'clip', colors: ['#E8B931', '#6B4A00'], gender: 'f' },
    { id: 'acc_gloves', slot: 'accessory', he: 'כפפות שחקן', descHe: 'כפפות דקות לערבים קרים', price: 70, rarity: 'rare', acc: 'gloves', colors: ['#1B1F27', '#E8B931'] },
    { id: 'acc_armband', slot: 'accessory', he: 'סרט קפטן', descHe: 'הסרט על הזרוע. לפחות על הכרטיס', price: 150, rarity: 'epic', acc: 'armband', colors: ['#E8B931', '#1B1F27'] },
    // boosts (consumed on use, limited)
    { id: 'boost_energy', slot: 'boost', he: 'מילוי אנרגיה', descHe: 'אנרגיה מלאה, מיד. פעם בשבוע', price: 30, rarity: 'common', boost: 'energy_refill', limit: { perWeeks: 1 } },
    { id: 'boost_scout', slot: 'boost', he: 'הסקאוט הראשי', descHe: 'הסקאוט הראשי של המועדון חושף את הפוטנציאל המדויק שלך', price: 120, rarity: 'epic', boost: 'scout_report', limit: { perSeason: 1 } },
    { id: 'boost_morale', slot: 'boost', he: 'ארוחה אצל אמא', descHe: 'ערב בבית עם האוכל של אמא. המורל בשמיים', price: 25, rarity: 'common', boost: 'morale_boost', limit: { perWeeks: 2 } },
  ],
  ui: {
    section: 'פרסים',
    sectionHint: 'מחליפים ⭐ בסטייל: נעליים, חגיגות, מסגרות ואביזרים',
    balance: 'יש לך {n} ⭐',
    price: '{n} ⭐',
    buy: 'לקנות',
    equip: 'לבחור',
    equipped: 'בשימוש',
    owned: 'שלך',
    use: 'להשתמש',
    bought: '{he}: שלך!',
    equippedToast: '{he} בשימוש',
    notEnough: 'חסרים עוד {n} ⭐',
    limitWeek: 'כבר השתמשת השבוע. אפשר שוב בשבוע הבא',
    limitWeeks: 'אפשר להשתמש שוב בעוד {n} שבועות',
    limitSeason: 'כבר השתמשת העונה. אפשר שוב בעונה הבאה',
    energyDone: 'האנרגיה מלאה! 100',
    moraleDone: 'אמא הכינה את כל האוכל שאוהבים. המורל עלה',
    scoutDone: 'הסקאוט הראשי: הפוטנציאל שלך הוא {pot}',
    scoutKnown: 'הפוטנציאל המדויק: {pot}',
    preview: 'תצוגה מקדימה',
    rarity: { common: 'רגיל', rare: 'נדיר', epic: 'אפי', legendary: 'אגדי' },
    empty: 'אין פריטים בקטגוריה הזאת',
  },
};

// ---------------------------------------------------------------------------
// F10 share card (js/ui/sharecard.js). moment[kind] = card headline (pick one).
// message = the text sent with the PNG (Web Share text / WhatsApp). The reader
// is unknown, so message lines address them in the plural (gender-neutral).
// Markers = the career gender. Placeholders: {name} {first} {club} {opp}
// {minute} {score} {ovr} {age} {ach} {step} {trophy} {comp} {nation} {text} {url}
// ---------------------------------------------------------------------------
export const SHARE_TEXT = {
  button: '📤 שתף',
  title: 'שיתוף הרגע',
  url: 'https://tinyurl.com/hayeled',
  urlShort: 'tinyurl.com/hayeled',
  card: {
    logo: 'הילד מהשכונה',
    logoG: '{{הילד מהשכונה|הילדה מהשכונה}}',
    ovr: 'יכולת',
    line: '{club} · גיל {age}',
    footer: 'tinyurl.com/hayeled',
    cta: 'גם אתם יכולים',
  },
  moment: {
    mega_goal: ['שער ענק בדקה {minute} מול {opp}', 'גול מטורף מול {opp}!', 'דקה {minute}, והאצטדיון התפוצץ'],
    goal: ['שער מול {opp}, דקה {minute}', 'עוד שער ל{name}'],
    debut_goal: ['שער בבכורה, דקה {minute}', 'משחק ראשון, שער ראשון'],
    hat_trick: ['שלושער מול {opp}!', 'שלושה שערים, כדור אחד הביתה'],
    late_winner: ['שער ניצחון בדקה {minute}!', 'ברגע האחרון מול {opp}'],
    achievement: ['הישג חדש: {ach}', 'נפתח: {ach}'],
    promotion: ['צעד חדש: {step}', 'קפיצת מדרגה: {step}'],
    trophy: ['{trophy}!', '{{מניף|מניפה}} את {trophy}', '{{אלופים|אלופות}}: {trophy}'],
    transfer: ['{{חתם|חתמה}} ב{club}!', 'פרק חדש: {club}'],
    callup: ['זימון לנבחרת {nation}!', 'השם על הגב, הדגל על החזה'],
    ballon: ['כדור הזהב!', '{{הטוב בעולם|הטובה בעולם}}'],
    award: ['{ach}!', 'פרס חדש: {ach}'],
    record: ['שער {n} בקריירה!', '{n} שערים, ועוד הרבה'],
  },
  message: [
    '{text}. הקריירה של {name} ב"הילד מהשכונה". גם אתם יכולים: {url}',
    '{text}! מהשכונה ועד הפסגה. נסו בעצמכם: {url}',
    '{text}. {name}, יכולת {ovr}. מי מגיע רחוק יותר? {url}',
  ],
  whatsapp: 'שליחה בוואטסאפ',
  download: 'הורדת התמונה',
  downloaded: 'הכרטיס נשמר בהורדות',
  copied: 'הטקסט והקישור הועתקו',
  failed: 'לא הצלחנו לשתף. אפשר לנסות שוב',
  thanks: 'תודה ששיתפת!',
  fileName: 'hayeled-card.png',
};

// ---------------------------------------------------------------------------
// F11 challenge link (?c=<code>). card = shown on the title screen to someone
// who opened a link: MARKERS FOLLOW THE CHALLENGER's gender (gtext(str, c.gender));
// lines addressed to the viewer are gender-neutral. reach = PATH.steps[].reachHe
// of the challenger's top step. Placeholders: {name} {reach} {age} {goals}
// {trophies} {ovr} {club} {nation} {url}
// line + ' - ' + ask reproduces "נועה הגיעה לליגת האלופות בגיל 19 - מקבלים את האתגר?"
// ---------------------------------------------------------------------------
export const CHALLENGE_TEXT = {
  button: 'אתגר חבר',
  hint: '{{שלח|שלחי}} לחבר את הקריירה שלך, ונראה מי מגיע רחוק יותר',
  // the challenger's own words (first person past = gender-neutral)
  share: [
    'הגעתי {reach} בגיל {age} ב"הילד מהשכונה". מי מגיע רחוק יותר? {url}',
    'אתגר: הגעתי {reach} בגיל {age}, עם {goals} שערים. חושבים שתצליחו יותר? {url}',
    '{goals} שערים, {trophies} תארים, ו{reach} בגיל {age}. יש לכם אומץ? {url}',
  ],
  card: {
    title: 'אתגר חדש!',
    from: 'אתגר מ{name}',
    line: '{name} {{הגיע|הגיעה}} {reach} בגיל {age}',
    ask: ['מקבלים את האתגר?', 'חושבים שתגיעו רחוק יותר?', 'מי ינצח?'],
    stats: '{goals} שערים · {trophies} תארים · יכולת {ovr}',
    club: '{club} · {nation}',
    accept: 'אני בפנים!',
    later: 'אולי אחר כך',
  },
  invalid: 'קישור האתגר לא תקין. אפשר פשוט להתחיל קריירה',
  // inside the viewer's own career (markers = the viewer's career gender)
  inCareer: {
    active: 'האתגר של {name}: {reach} בגיל {age}',
    beat: 'עקפת את {name}! {reach} בגיל {age}',
    behind: '{name} עדיין לפנים. עוד לא מאוחר',
    beatToast: 'ניצחת באתגר!',
  },
  copied: 'קישור האתגר הועתק',
};

// ---------------------------------------------------------------------------
// F11 leaderboard (js/ui/leaderboard.js). kinds / periods match the RPC
// get_leaderboard(kind, period). stat[kind] formats the row value ({n}).
// Placeholders: {n} {name} {club}
// ---------------------------------------------------------------------------
export const LEADERBOARD_TEXT = {
  title: 'טבלת האגדות',
  tab: 'טבלה',
  kinds: { legacy: 'מורשת', goals: 'שערים', ballon: 'כדור הזהב' },
  periods: { all: 'כל הזמנים', week: 'השבוע' },
  cols: { rank: '#', name: 'שם', club: 'קבוצה', stat: '' },
  stat: { legacy: '{n} נק׳', goals: '{n} שערים', ballon: '{n} כדורי זהב' },
  stat1: { legacy: 'נקודה אחת', goals: 'שער אחד', ballon: 'כדור זהב אחד' },
  me: 'אני',
  myRank: 'המקום שלך: {n}',
  notRanked: 'הקריירה שלך עוד לא בטבלה. היא תיכנס בסוף העונה',
  loading: 'טוען את הטבלה...',
  empty: 'עוד אין כאן אף אחד. הקריירה שלך יכולה להיות הראשונה',
  offline: 'הטבלה זמינה כשיש חיבור לאינטרנט. הקריירה שלך נשמרת בינתיים',
  error: 'הטבלה לא נטענה. אפשר לנסות שוב בעוד רגע',
  retry: 'לנסות שוב',
  submitted: 'הקריירה שלך נכנסה לטבלה',
  submittedRank: 'מקום {n} בטבלה!',
  submitNote: 'בסוף כל עונה נשלחים לטבלה השם, הקבוצה והמספרים של הקריירה. בלי פרטים אישיים',
  optOut: 'לא לשלוח את הקריירה לטבלה',
  genderTag: { m: 'בן', f: 'בת' },
  hidden: 'הוסתר',
  nameRejected: 'השם הזה לא יופיע בטבלה',
};

// ---------------------------------------------------------------------------
// Hub / navigation labels for the 2.3 features (optional; UI may keep its own).
// Placeholders: {n} {he}
// ---------------------------------------------------------------------------
export const HUB_TEXT = {
  objectives: 'משימות',
  path: 'שביל הקריירה',
  stars: '{n} ⭐',
  achievements: 'הישגים',
  achievementsCount: '{n} הישגים',
  leaderboard: 'טבלת האגדות',
  stakes: 'מה על הכף',
  daily: 'פרס יומי',
  rewards: 'פרסים',
  challenge: 'אתגר חבר',
  newBadge: 'חדש',
  seeAll: 'הכול',
};
