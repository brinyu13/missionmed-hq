// P1-RISE-5012H: provider-neutral, evidence-backed application intelligence.
// This module never infers applicant demographics, nationality, or match odds.

export const APPLICATION_PRIORITY_KEYS = Object.freeze([
  "visa", "exams", "attempts", "yog", "usce", "img", "do", "same_school",
  "same_country", "location", "research_depth", "fellowships", "soap",
]);

export const APPLICATION_CARD_FIELDS = Object.freeze([
  "visa", "exams", "yog", "usce", "composition", "research_depth",
  "attempts", "same_school", "same_country", "fellowships", "soap",
]);

const COUNTRY_PATTERNS = Object.freeze([
  ["United States", /\b(?:united states|u\.?s\.?a?|alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/i],
  ["India", /\b(?:india|indian|mumbai|delhi|kolkata|calcutta|chennai|madras|hyderabad|bangalore|bengaluru|maharashtra|gujarat|punjab|rajasthan|kerala|karnataka|tamil nadu|uttar pradesh)\b/i],
  ["Pakistan", /\b(?:pakistan|pakistani|karachi|lahore|islamabad|rawalpindi|peshawar|multan|sindh|punjab medical college|aga khan|dow medical|nishtar|khyber)\b/i],
  ["Bangladesh", /\b(?:bangladesh|bangladeshi|dhaka|chittagong)\b/i],
  ["Nepal", /\b(?:nepal|nepalese|kathmandu)\b/i],
  ["Philippines", /\b(?:philippines|philippine|manila|cebu)\b/i],
  ["Egypt", /\b(?:egypt|egyptian|cairo|alexandria|ain shams|mansoura)\b/i],
  ["Jordan", /\b(?:jordan|jordanian|amman)\b/i],
  ["Lebanon", /\b(?:lebanon|lebanese|beirut)\b/i],
  ["Israel", /\b(?:israel|israeli|tel aviv|jerusalem|sackler)\b/i],
  ["Mexico", /\b(?:mexico|mexican|monterrey|guadalajara)\b/i],
  ["Colombia", /\b(?:colombia|colombian|bogota|medellin)\b/i],
  ["Venezuela", /\b(?:venezuela|venezuelan|caracas)\b/i],
  ["Ecuador", /\b(?:ecuador|ecuadorian|quito|cuenca)\b/i],
  ["Argentina", /\b(?:argentina|argentine|buenos aires)\b/i],
  ["Brazil", /\b(?:brazil|brazilian|sao paulo|rio de janeiro)\b/i],
  ["Nigeria", /\b(?:nigeria|nigerian|lagos|ibadan)\b/i],
  ["Ghana", /\b(?:ghana|ghanaian|accra)\b/i],
  ["United Kingdom", /\b(?:united kingdom|england|scotland|wales|northern ireland|london|edinburgh|glasgow)\b/i],
  ["Ireland", /\b(?:ireland|irish|dublin|cork)\b/i],
  ["Canada", /\b(?:canada|canadian|ontario|quebec|toronto|montreal|alberta|british columbia)\b/i],
  ["Australia", /\b(?:australia|australian|sydney|melbourne|queensland)\b/i],
  ["China", /\b(?:china|chinese|beijing|shanghai|wuhan|zhejiang|sichuan)\b/i],
  ["South Korea", /\b(?:south korea|korean|seoul)\b/i],
  ["Japan", /\b(?:japan|japanese|tokyo|osaka)\b/i],
  ["Turkey", /\b(?:turkey|turkish|istanbul|ankara)\b/i],
  ["Iran", /\b(?:iran|iranian|tehran|shiraz)\b/i],
  ["Iraq", /\b(?:iraq|iraqi|baghdad)\b/i],
  ["Saudi Arabia", /\b(?:saudi arabia|saudi|riyadh|jeddah)\b/i],
  ["United Arab Emirates", /\b(?:united arab emirates|u\.?a\.?e\.?|dubai|abu dhabi)\b/i],
  ["Dominican Republic", /\b(?:dominican republic|santo domingo|pucmm)\b/i],
  ["Puerto Rico", /\b(?:puerto rico|puerto rican|san juan|ponce school of medicine)\b/i],
]);

const CARIBBEAN_SCHOOLS = /\b(?:st\.? george'?s university|ross university|american university of the caribbean|saba university|university of medicine and health sciences|medical university of the americas|windsor university school of medicine|avalon university|all saints university|st\.? matthew'?s university|trinity school of medicine|xavier university school of medicine)\b/i;
const SCHOOL_ALIASES = new Map([
  ["sgu", "st georges university school of medicine"],
  ["st georges university", "st georges university school of medicine"],
  ["ross university", "ross university school of medicine"],
  ["auc", "american university of the caribbean school of medicine"],
  ["lecom", "lake erie college of osteopathic medicine"],
]);

function text(value) {
  const result = String(value ?? "").replace(/\s+/g, " ").trim();
  return result || null;
}

function normalizedToken(value) {
  return String(value ?? "").toLocaleLowerCase("en-US")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeMedicalSchoolName(value) {
  const raw = text(value);
  if (!raw) return null;
  const token = normalizedToken(raw);
  return { raw, canonical: SCHOOL_ALIASES.get(token) ?? token, display: raw };
}

export function medicalSchoolCountry(value, explicitCountry = null, classification = null) {
  const explicit = text(explicitCountry);
  if (explicit && !/^(?:unknown|not stated|not available|n\/a)$/i.test(explicit)) return explicit;
  const school = text(value) ?? "";
  const normalizedClass = normalizedToken(classification).replaceAll(" ", "_");
  if (normalizedClass === "us_md" || normalizedClass === "us_do" || /\b(?:college of osteopathic medicine|school of osteopathic medicine)\b/i.test(school)) return "United States";
  for (const [country, pattern] of COUNTRY_PATTERNS) if (pattern.test(school)) return country;
  if (CARIBBEAN_SCHOOLS.test(school)) return "Caribbean";
  return null;
}

export function rosterCategory(row = {}) {
  const classification = normalizedToken(row.classification ?? row.category ?? row.cat).replaceAll(" ", "_");
  const degree = normalizedToken(row.degree).replaceAll(" ", "_");
  const school = text(row.medical_school ?? row.medicalSchool ?? row.school) ?? "";
  const caribbean = row.caribbean === true || /^(?:yes|true)$/i.test(String(row.caribbean ?? row.car ?? ""))
    || /caribbean/.test(classification) || CARIBBEAN_SCHOOLS.test(school);
  if (caribbean) return "CARIBBEAN";
  if (/^(?:us_do|do)$/.test(classification) || degree === "do" || /osteopathic medicine/i.test(school)) return "US_DO";
  if (classification === "us_md" || classification === "md_us_md_grad") return "US_MD";
  if (/\b(?:img|international|non_us|foreign_medical)/.test(classification)) return "IMG_NON_CARIBBEAN";
  return "UNKNOWN";
}

function rosterRows(value) {
  if (Array.isArray(value)) return value.flatMap((row) => Array.isArray(row) ? rosterRows(row) : [row]);
  if (!value || typeof value !== "object") return [];
  for (const key of ["full_roster", "residents", "roster"]) if (Array.isArray(value[key])) return rosterRows(value[key]);
  const partitioned = ["pgy_1", "pgy_2", "pgy_3", "pgy_4", "pgy4_chiefs", "pgy3_chiefs", "other_residents_identified"]
    .filter((key) => Array.isArray(value[key])).flatMap((key) => rosterRows(value[key]));
  if (partitioned.length) return partitioned;
  return [];
}

export function normalizeResidentRoster(value) {
  return rosterRows(value).filter((row) => row && typeof row === "object").map((row, index) => {
    const school = normalizeMedicalSchoolName(row.medical_school ?? row.medicalSchool ?? row.school);
    const category = rosterCategory(row);
    return {
      rowKey: `${normalizedToken(row.name ?? "resident") || "resident"}-${index + 1}`,
      name: text(row.name ?? row.resident_name) ?? "Resident name not published",
      pgy: text(row.pgy ?? row.pgy_year ?? row.pgy_level ?? row.PGY ?? row.class ?? row.class_of) ?? "PGY not published",
      degree: text(row.degree ?? row.degree_credential),
      medicalSchool: school?.display ?? null,
      medicalSchoolKey: school?.canonical ?? null,
      medicalSchoolCountry: medicalSchoolCountry(school?.display, row.medical_school_country ?? row.school_country ?? row.country, category),
      category,
      track: text(row.track),
      role: text(row.role ?? row.public_role),
      sourceUrl: text(row.source_url ?? row.url),
    };
  });
}

function known(program, field) {
  const claim = program?.fields?.[field];
  return claim?.knowledge?.state === "known" ? claim.knowledge.value : null;
}

function dynamicValue(facts, field) {
  const fact = facts.find((candidate) => candidate?.field === field);
  return fact ? (fact.canonicalValue ?? fact.canonical_value ?? fact.knowledge?.value ?? null) : null;
}

function findNumber(value, patterns) {
  const entries = [];
  const visit = (item, key = "", depth = 0) => {
    if (depth > 6 || item == null) return;
    if (typeof item === "object") {
      for (const [childKey, child] of Object.entries(item)) visit(child, childKey, depth + 1);
      return;
    }
    const joined = `${key.replaceAll("_", " ")} ${String(item)}`;
    if (!patterns.some((pattern) => pattern.test(joined))) return;
    if (typeof item === "number" && Number.isFinite(item) && item > 0) {
      entries.push(item);
      return;
    }
    const matches = [...String(item).matchAll(/\b([1-9][0-9]{0,3})\b/g)].map((match) => Number(match[1]));
    if (matches.length) entries.push(matches.at(-1));
  };
  visit(value);
  return entries.length ? Math.min(...entries) : null;
}

function explicitBoolean(value, keys) {
  if (!value || typeof value !== "object") return null;
  for (const key of keys) {
    if (!(key in value)) continue;
    const candidate = value[key];
    if (candidate === true || /^(?:yes|true|required|accepted|supported|published)$/i.test(String(candidate))) return true;
    if (candidate === false || /^(?:no|false|not required|not accepted|not supported)$/i.test(String(candidate))) return false;
  }
  return null;
}

function percent(value) {
  const number = Number.parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
}

function profileClass(profile = {}) {
  const value = normalizedToken(profile.degree_type ?? profile.graduate_type ?? profile.is_img);
  if (/do|osteopathic/.test(value)) return "US_DO";
  if (/caribbean/.test(value)) return "CARIBBEAN";
  if (/img|international|true|yes/.test(value)) return "IMG";
  if (/md|allopathic/.test(value)) return "US_MD";
  return null;
}

function requirementField(program, profile, stage) {
  const klass = profileClass(profile);
  if (stage === 1) return klass === "IMG" || klass === "CARIBBEAN" ? known(program, "IMG Step 1 Required")
    : klass === "US_DO" ? known(program, "DO Step 1 Required") : klass === "US_MD" ? known(program, "US MD Step 1 Required") : null;
  return klass === "IMG" || klass === "CARIBBEAN" ? known(program, "IMG Step 2 Required")
    : klass === "US_DO" ? known(program, "DO Step 2 Required") : klass === "US_MD" ? known(program, "US MD Step 2 Required") : null;
}

function summaryCount(value, total) {
  return total ? { count: value, total, percent: Number(((value / total) * 100).toFixed(1)) } : { count: value, total: 0, percent: null };
}

export function buildApplicationIntelligence(program, facts = [], profile = {}) {
  const application = dynamicValue(facts, "research.application_requirements") ?? {};
  const visaFact = dynamicValue(facts, "research.visa") ?? {};
  const roster = normalizeResidentRoster(dynamicValue(facts, "research.resident_roster"));
  const supported = Array.isArray(visaFact?.supported) ? visaFact.supported.map(String) : [];
  const j1 = known(program, "J1") === true || visaFact?.j1 === true || supported.some((item) => /\bJ-?1\b/i.test(item));
  const h1b = known(program, "H1B") === true || visaFact?.h1b === true || supported.some((item) => /\bH-?1B\b/i.test(item));
  const step1 = requirementField(program, profile, 1);
  const step2 = requirementField(program, profile, 2);
  const step2Minimum = findNumber(application, [/step\s*2/i, /usmle.*minimum/i, /minimum.*score/i]);
  const comlex2Minimum = findNumber(application, [/comlex.*(?:2|level\s*2)/i, /level\s*2.*minimum/i]);
  const maxAttempts = findNumber(application, [/max(?:imum)?\s*(?:usmle|comlex|exam)?\s*attempt/i, /attempt.*(?:limit|maximum)/i]);
  const step1Policy = text(application.step1_policy);
  const step2Timing = text(application.step2_timing);
  const step1FirstAttemptRequired = /(?:first attempt|first sitting|one attempt)/i.test(step1Policy ?? "");
  const step1FailureAllowed = /(?:failure|failed attempt).{0,30}(?:allowed|accepted|considered)|multiple attempts.{0,20}(?:allowed|accepted)/i.test(step1Policy ?? "");
  const step2RequiredWithApplication = /(?:required|must be available).{0,36}(?:with|at (?:the )?time of|before).{0,18}(?:application|initial review|interview)/i.test(step2Timing ?? "");
  const step2PendingFriendly = /(?:after (?:application|initial review)|before (?:ranking|rank list)|by (?:ranking|rank list)|score pending|not required.{0,24}(?:application|initial review))/i.test(step2Timing ?? "");
  const yogRaw = known(program, "Medical School Graduation Timeline") ?? text(application.yog_policy);
  const yogNoCutoff = typeof yogRaw === "string" && /no cap|no (?:published )?(?:limit|cutoff)/i.test(yogRaw);
  const yogYears = typeof yogRaw === "number" ? yogRaw : (!yogNoCutoff ? findNumber({ yog: yogRaw }, [/yog|graduat/i]) : null);
  const usceRaw = known(program, "Gap Experience Requirement") ?? text(application.usce);
  const usceText = text(usceRaw);
  const usceRequired = /clinical experience in the us/i.test(usceText ?? "");
  const usceRecommended = /(?:recommend|prefer)/i.test(JSON.stringify(application)) && /(?:usce|clinical experience)/i.test(JSON.stringify(application));
  const usceMonths = findNumber(application, [/usce.*month/i, /clinical experience.*month/i]);
  const counts = { US_MD: 0, US_DO: 0, CARIBBEAN: 0, IMG_NON_CARIBBEAN: 0, UNKNOWN: 0 };
  for (const resident of roster) counts[resident.category] += 1;
  const total = roster.length;
  const schools = new Map();
  const countries = new Map();
  for (const resident of roster) {
    if (resident.medicalSchoolKey) schools.set(resident.medicalSchoolKey, { label: resident.medicalSchool, count: (schools.get(resident.medicalSchoolKey)?.count ?? 0) + 1 });
    if (resident.medicalSchoolCountry) countries.set(resident.medicalSchoolCountry, (countries.get(resident.medicalSchoolCountry) ?? 0) + 1);
  }
  const profileSchool = normalizeMedicalSchoolName(profile.medical_school);
  const profileCountry = text(profile.medical_school_country) ?? medicalSchoolCountry(profile.medical_school, null, profileClass(profile));
  const sameSchoolCount = profileSchool ? (schools.get(profileSchool.canonical)?.count ?? 0) : 0;
  const sameCountryCount = profileCountry ? (countries.get(profileCountry) ?? 0) : 0;
  const registryComposition = {
    img: percent(known(program, "IMG Graduates Percent")),
    do: percent(known(program, "DO Graduates Percent")),
    usmd: percent(known(program, "US MD Graduates Percent")),
  };
  const fellowshipValue = dynamicValue(facts, "research.fellowship_inventory");
  return {
    visa: { j1, h1b, any: j1 || h1b || text(known(program, "Visa Sponsorship")) !== null, summary: text(known(program, "Visa Sponsorship")) ?? text(visaFact?.summary) },
    exams: {
      step1Required: typeof step1 === "boolean" ? step1 : null,
      step1Policy,
      step1FirstAttemptRequired,
      step1FailureAllowed,
      step2Required: typeof step2 === "boolean" ? step2 : null,
      step2Minimum,
      step2Timing,
      step2RequiredWithApplication,
      step2PendingFriendly,
      comlexLevel2Accepted: /level\s*2\s*passed:\s*yes/i.test(String(known(program, "COMLEX Accepted") ?? "")) || known(program, "DO COMLEX Level 2 Required") === true,
      comlexLevel2Required: known(program, "DO COMLEX Level 2 Required"),
      comlexLevel2Minimum: comlex2Minimum,
      maxAttempts,
    },
    yog: { published: yogRaw !== null, years: yogYears, noPublishedCutoff: yogNoCutoff, raw: yogRaw },
    usce: { published: usceRaw !== null || usceRecommended || usceMonths !== null, required: usceRequired, recommended: usceRecommended, minimumMonths: usceMonths, raw: usceRaw },
    ecfmg: { published: /ecfmg/i.test(JSON.stringify(application)), summary: text(application?.medical_education_or_ecfmg_requirement) },
    roster: {
      total, schoolIdentified: roster.filter((resident) => resident.medicalSchoolKey).length,
      countryIdentified: roster.filter((resident) => resident.medicalSchoolCountry).length,
      distinctSchools: schools.size, distinctCountries: countries.size,
      composition: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, summaryCount(value, total)])),
      registryComposition,
      schools: [...schools].map(([key, value]) => ({ key, ...value })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
      countries: [...countries].map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count || a.country.localeCompare(b.country)),
      sameSchoolCount, sameCountryCount,
    },
    fellowshipCount: Array.isArray(fellowshipValue) ? fellowshipValue.length : 0,
    profile: { class: profileClass(profile), schoolKnown: Boolean(profileSchool), countryKnown: Boolean(profileCountry) },
  };
}

function signal(kind, criterion, title, detail, source = "published program evidence") {
  return { kind, criterion, title, detail, source };
}

export function evaluateApplicationCompatibility(intel, profile = {}) {
  const result = { blockers: [], cautions: [], positives: [], unknowns: [] };
  const add = (group, ...args) => result[group].push(signal(group, ...args));
  const step2Score = Number(profile.step2_score ?? profile.usmle_step2_score);
  if (intel.exams.step2Minimum !== null && Number.isFinite(step2Score)) {
    if (step2Score < intel.exams.step2Minimum) add("blockers", "step2", "Published Step 2 minimum is higher", `Published minimum ${intel.exams.step2Minimum}; your profile ${step2Score}.`);
    else if (step2Score < intel.exams.step2Minimum + 5) add("cautions", "step2", "Step 2 score is close to the published minimum", `Published minimum ${intel.exams.step2Minimum}; your profile ${step2Score}.`);
    else add("positives", "step2", "Step 2 score is above the published minimum", `Published minimum ${intel.exams.step2Minimum}; your profile ${step2Score}.`);
  } else add("unknowns", "step2", "Step 2 minimum not available", "No supported numeric cutoff is available for this program.");
  const visaNeed = normalizedToken(profile.visa_status ?? profile.visa_requirement);
  if (/j\s*1/.test(visaNeed)) {
    if (intel.visa.j1) add("positives", "visa", "J-1 sponsorship published", "The program has explicit published J-1 evidence.");
    else add("unknowns", "visa", "J-1 sponsorship not established", "No supported J-1 sponsorship evidence is available.");
  } else if (/h\s*1b/.test(visaNeed)) {
    if (intel.visa.h1b) add("positives", "visa", "H-1B sponsorship published", "The program has explicit published H-1B evidence.");
    else add("unknowns", "visa", "H-1B sponsorship not established", "No supported H-1B sponsorship evidence is available.");
  }
  const graduationYear = Number(profile.graduation_year);
  if (Number.isInteger(graduationYear) && intel.yog.years !== null) {
    const age = new Date().getUTCFullYear() - graduationYear;
    if (age > intel.yog.years) add("blockers", "yog", "Published graduation window may exclude you", `Program publishes ${intel.yog.years} year(s); your profile is ${age} year(s) from graduation.`);
    else add("positives", "yog", "Profile is within the published graduation window", `Program publishes ${intel.yog.years} year(s); your profile is ${age} year(s) from graduation.`);
  } else if (!intel.yog.published) add("unknowns", "yog", "No published graduation cutoff", "Absence of a published cutoff is not automatic acceptance.");
  const usceMonths = Number(profile.usce_months);
  if (intel.usce.minimumMonths !== null && Number.isFinite(usceMonths)) {
    if (usceMonths < intel.usce.minimumMonths) add("blockers", "usce", "Published USCE minimum is higher", `Program publishes ${intel.usce.minimumMonths} month(s); your profile ${usceMonths}.`);
    else add("positives", "usce", "Profile meets the published USCE minimum", `Program publishes ${intel.usce.minimumMonths} month(s); your profile ${usceMonths}.`);
  } else if (intel.usce.required && !Number.isFinite(usceMonths)) add("cautions", "usce", "US clinical experience is published as required", "Add USCE months to your Matrix profile to compare.");
  if (intel.roster.sameSchoolCount > 0) add("positives", "same_school", "Residents from your medical school", `${intel.roster.sameSchoolCount} current/recent roster entr${intel.roster.sameSchoolCount === 1 ? "y" : "ies"} match your school.`);
  if (intel.roster.sameCountryCount > 0) add("positives", "same_country", "Residents from your medical-school country", `${intel.roster.sameCountryCount} current/recent roster entr${intel.roster.sameCountryCount === 1 ? "y" : "ies"} attended school in that country.`);
  const klass = profileClass(profile);
  if ((klass === "IMG" || klass === "CARIBBEAN") && (intel.roster.composition.IMG_NON_CARIBBEAN.count + intel.roster.composition.CARIBBEAN.count > 0)) add("positives", "img", "Observed IMG representation", "Current/recent roster evidence includes international medical graduates; this is not an admissions-policy claim.");
  if (klass === "US_DO" && intel.roster.composition.US_DO.count > 0) add("positives", "do", "Observed DO representation", "Current/recent roster evidence includes US DO graduates; this is not an admissions-policy claim.");
  result.summary = `${result.positives.length} positive signal${result.positives.length === 1 ? "" : "s"} · ${result.cautions.length} caution${result.cautions.length === 1 ? "" : "s"} · ${result.blockers.length ? `${result.blockers.length} known blocker${result.blockers.length === 1 ? "" : "s"}` : "no known blockers"}`;
  return result;
}

export function applicationFacetCounts(records) {
  const count = (predicate) => records.reduce((sum, record) => sum + (predicate(record.application) ? 1 : 0), 0);
  return {
    step1Required: count((a) => a.exams.step1Required === true),
    step1FirstAttemptRequired: count((a) => a.exams.step1FirstAttemptRequired),
    step1FailureAllowed: count((a) => a.exams.step1FailureAllowed),
    step1NoPublishedExclusion: count((a) => a.exams.step1Required !== true),
    step2MinimumPublished: count((a) => a.exams.step2Minimum !== null),
    step2PendingFriendly: count((a) => a.exams.step2PendingFriendly),
    step2RequiredWithApplication: count((a) => a.exams.step2RequiredWithApplication),
    comlexLevel2Accepted: count((a) => a.exams.comlexLevel2Accepted),
    attemptsPolicyPublished: count((a) => a.exams.maxAttempts !== null),
    yogNoPublishedCutoff: count((a) => !a.yog.published || a.yog.noPublishedCutoff),
    yogOne: count((a) => a.yog.years !== null && a.yog.years <= 1),
    yogTwo: count((a) => a.yog.years !== null && a.yog.years <= 2),
    yogThree: count((a) => a.yog.years !== null && a.yog.years <= 3),
    yogFive: count((a) => a.yog.years !== null && a.yog.years <= 5),
    yogTen: count((a) => a.yog.years !== null && a.yog.years <= 10),
    usceRequired: count((a) => a.usce.required),
    usceRecommended: count((a) => a.usce.recommended),
    usceNoPublishedRequirement: count((a) => !a.usce.published),
    sameMedicalSchool: count((a) => a.roster.sameSchoolCount > 0),
    sameMedicalSchoolCountry: count((a) => a.roster.sameCountryCount > 0),
    inHouseFellowships: count((a) => a.fellowshipCount > 0),
  };
}
