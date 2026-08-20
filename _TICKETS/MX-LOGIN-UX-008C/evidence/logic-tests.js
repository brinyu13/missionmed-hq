/* MX-LOGIN-UX-008C static logic verification.
   Extracts the two declarative config blocks from the shipped student-os.js and
   exercises them directly, so the tests run against the real shipped source. */
const fs = require("fs");
const path = "wp-content/plugins/missionmed-hub/assets/student-os.js";
const src = fs.readFileSync(path, "utf8");

function slice(startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  const b = src.indexOf(endMarker, a);
  if (a === -1 || b === -1) throw new Error("marker not found: " + startMarker);
  return src.slice(a, b);
}

// ---- build a sandbox with the real declarations ----
const navSrc    = slice("var MATRIX_APPROVED_NAV = [", "var MATRIX_APPROVED_NAV_BY_ROUTE");
const seasonSrc = slice("var MATCH_SEASON_STAGES = [", "\tfunction resolveMatchSeasonIndex");
const resolveSrc= slice("\tfunction resolveMatchSeasonIndex", "\tfunction truthyAccessFlag");

let accessData = {};
const app = { state: { stats: {} } };
const factory = new Function("accessData", "app", `
  ${navSrc}
  ${seasonSrc}
  ${resolveSrc}
  return { MATRIX_APPROVED_NAV, MATCH_SEASON_STAGES, matchSeasonToken, resolveMatchSeasonIndex };
`);
let M = factory(accessData, app);

let pass = 0, fail = 0;
const results = [];
function check(id, desc, cond, detail) {
  (cond ? pass++ : fail++);
  results.push(`${cond ? "PASS" : "FAIL"}  ${id}  ${desc}${detail && !cond ? "  -> " + detail : ""}`);
}

// ================= SIDEBAR =================
const nav = M.MATRIX_APPROVED_NAV;
const labels = nav.map(n => n.label);
const routes = nav.map(n => n.route);
/* MX-LOGIN-UX-008F founder authority: File Vault is VISIBLE + UNLOCKED (real-world
   beta), so it moves into the unlocked block at position 9. */
const expected = ["Dashboard Home","My Profile","Calendar","Scheduler","My Appointments",
  "StoryForge","Timeline Builder","Arena","File Vault","LOR Writer","IV Prep On-Call",
  "Med Messenger","Dr J Live Drills","Settings"];

check("AC-23","exact membership: 14 items", nav.length === 14, `got ${nav.length}`);
check("AC-24","exact order 1-14", JSON.stringify(labels) === JSON.stringify(expected), JSON.stringify(labels));
const unlocked = nav.filter(n => n.state === "unlocked").map(n => n.label);
const locked   = nav.filter(n => n.state === "locked").map(n => n.label);
const lastUnlockedIdx = Math.max(...nav.map((n,i)=> n.state==="unlocked"?i:-1));
const firstLockedIdx  = Math.min(...nav.map((n,i)=> n.state==="locked"?i:99));
check("AC-25","all unlocked precede all locked", lastUnlockedIdx < firstLockedIdx, `${lastUnlockedIdx} < ${firstLockedIdx}`);
check("AC-26","My Profile is item 2", labels[1] === "My Profile", labels[1]);
check("AC-27","Settings is last", labels[13] === "Settings", labels[13]);
check("AC-28","My Appointments follows Scheduler", labels[labels.indexOf("Scheduler")+1] === "My Appointments");
check("AC-29","unlocked set exact", JSON.stringify(unlocked) === JSON.stringify(
  ["Dashboard Home","My Profile","Calendar","Scheduler","My Appointments","StoryForge","Timeline Builder","Arena","File Vault"]), JSON.stringify(unlocked));
check("AC-30","locked set exact", JSON.stringify(locked) === JSON.stringify(
  ["LOR Writer","IV Prep On-Call","Med Messenger","Dr J Live Drills","Settings"]), JSON.stringify(locked));
check("AC-31","Med Messenger locked", nav.find(n=>n.route==="messages").state === "locked");
const hidden = ["courses","orders","notifications","help","study","ranklist","cam","interview-prep"];
check("AC-32","hidden routes absent from nav", hidden.every(r => !routes.includes(r)),
  hidden.filter(r=>routes.includes(r)).join(","));
check("AC-34","section headers, exact members",
  JSON.stringify([...new Set(nav.map(n=>n.section))]) ===
  JSON.stringify(["HOME","PLAN","MATCH TOOLS","COMING / LOCKED","ACCOUNT"]),
  JSON.stringify([...new Set(nav.map(n=>n.section))]));
check("-","no duplicate routes", new Set(routes).size === routes.length);
check("008F-1","File Vault VISIBLE + UNLOCKED", nav.find(n=>n.route==="filevault").state==="unlocked");
check("008F-2","CAM absent from student navigation", !routes.includes("cam"));
check("008F-3","Timeline Builder VISIBLE + UNLOCKED", nav.find(n=>n.route==="timeline").state==="unlocked");
check("008F-4","IV Prep On-Call VISIBLE + LOCKED", nav.find(n=>n.route==="ivprep").state==="locked");
check("008F-5","IV Prep On-Call is its own route, not CAM", nav.find(n=>n.route==="ivprep").route!=="cam");

// ================= DR J LIVE DRILLS =================
const drj = nav.find(n => n.route === "drjlivedrills");
check("AC-60","Dr J Live Drills at position 13", labels[12] === "Dr J Live Drills", labels[12]);
check("AC-61","Dr J Live Drills locked", drj.state === "locked");
check("AC-62","no invented LearnDash ID", drj.entitlement.course_id === null, String(drj.entitlement.course_id));
check("AC-63","extensible entitlement seam", drj.entitlement.type === "learndash_course_enrollment");

// ================= SEASON =================
const stages = M.MATCH_SEASON_STAGES;
check("AC-46","five stages, correct labels", JSON.stringify(stages.map(s=>s.label)) === JSON.stringify(
  ["EXAMS","MyERAS, LORs & PERSONAL STATEMENTS","INTERVIEW SEASON","RANK LIST","MATCH WEEK"]));

// full-year coverage: every day resolves to exactly one stage
function idxFor(y, m, d) {
  const RealDate = Date;
  global.Date = class extends RealDate {
    constructor(...a){ return a.length ? new RealDate(...a) : new RealDate(y, m-1, d); }
    static now(){ return new RealDate(y, m-1, d).getTime(); }
  };
  const r = M.resolveMatchSeasonIndex();
  global.Date = RealDate;
  return r;
}
let uncovered = [], monthMap = {};
for (let m = 1; m <= 12; m++) {
  const daysIn = new Date(2026, m, 0).getDate();
  const seen = new Set();
  for (let d = 1; d <= daysIn; d++) {
    const i = idxFor(2026, m, d);
    if (i === -1) uncovered.push(`${m}/${d}`);
    seen.add(i);
  }
  monthMap[m] = [...seen];
}
check("AC-53","every day of the year resolves to a stage", uncovered.length === 0, uncovered.slice(0,8).join(","));
check("AC-53b","Jul/Aug/Sep -> stage 2 (index 1)",
  [7,8,9].every(m => JSON.stringify(monthMap[m]) === "[1]"),
  JSON.stringify({7:monthMap[7],8:monthMap[8],9:monthMap[9]}));
check("AC-53c","Oct-Jan wrap -> INTERVIEW SEASON (index 2)",
  [10,11,12,1].every(m => JSON.stringify(monthMap[m]) === "[2]"),
  JSON.stringify({10:monthMap[10],11:monthMap[11],12:monthMap[12],1:monthMap[1]}));
check("AC-47","August 2026 -> stage 2 current", idxFor(2026,8,18) === 1, String(idxFor(2026,8,18)));

// fail soft
const badFactory = new Function("accessData","app",`
  var MATCH_SEASON_STAGES = [{id:"x",label:"X",start:"zz-zz",end:"qq-qq"}];
  ${seasonSrc.slice(seasonSrc.indexOf("function matchSeasonToken"))}
  ${resolveSrc}
  return { resolveMatchSeasonIndex };
`);
let softOk = true, softVal;
try { softVal = badFactory({}, {state:{stats:{}}}).resolveMatchSeasonIndex(); }
catch (e) { softOk = false; softVal = "threw: " + e.message; }
check("AC-54","malformed config fails soft (-1, no throw)", softOk && softVal === -1, String(softVal));

// server-resolved stage wins (R-4 seam)
const srv = factory({ match_season_stage: "matchweek" }, { state: { stats: {} } });
check("R-4","server-supplied stage overrides client clock", srv.resolveMatchSeasonIndex() === 4,
  String(srv.resolveMatchSeasonIndex()));

console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
