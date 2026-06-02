import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schedulerHtml = path.join(root, "LIVE/scheduler_v1.html");
const matrixMount = path.join(root, "DEPLOY/MM-SCHED-052C_KINSTA_PATCH_20260519_140455/assets/scheduler-mount.js");

const checks = [
  {
    file: schedulerHtml,
    label: "source embedded layout invariant marker",
    pattern: /MM-SCHED-057D layout invariant/
  },
  {
    file: schedulerHtml,
    label: "details controls stay full-width rows",
    pattern: /\.sos-booking-fields\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/
  },
  {
    file: schedulerHtml,
    label: "loader uses percentage, not staged copy",
    pattern: /data-sos-load-percent/
  },
  {
    file: schedulerHtml,
    label: "loader updates in place to avoid blinking",
    pattern: /function updateLoadingTransitionDom\(\)/
  },
  {
    file: schedulerHtml,
    label: "confirmation screen is source-owned",
    pattern: /function confirmationStep\(\)/
  },
  {
    file: schedulerHtml,
    label: "booking success stores confirmed appointment",
    pattern: /scheduler\.state\.confirmedAppointment\s*=\s*appointment/
  },
  {
    file: matrixMount,
    label: "Matrix embedded layout invariant marker",
    pattern: /MM-SCHED-057D embedded layout invariant/
  },
  {
    file: matrixMount,
    label: "Matrix embedded root cannot escape content lane",
    pattern: /#schedule-root\.sos-schedule-embedded\{display:block;width:100%;max-width:100%;min-width:0/
  },
  {
    file: matrixMount,
    label: "Matrix embedded details controls stay full-width rows",
    pattern: /#schedule-root\.sos-schedule-embedded \.sos-booking-fields\{grid-template-columns:minmax\(0,1fr\)/
  }
];

let failures = 0;

for (const check of checks) {
  const rel = path.relative(root, check.file);
  const source = fs.readFileSync(check.file, "utf8");
  if (!check.pattern.test(source)) {
    failures += 1;
    console.error(`FAIL ${rel}: ${check.label}`);
  } else {
    console.log(`PASS ${rel}: ${check.label}`);
  }
}

const schedulerSource = fs.readFileSync(schedulerHtml, "utf8");
if (/Stage '\s*\+|<span>Staged<\/span>|<span>Staged<\/span>/.test(schedulerSource)) {
  failures += 1;
  console.error("FAIL LIVE/scheduler_v1.html: staged loader copy was reintroduced");
} else {
  console.log("PASS LIVE/scheduler_v1.html: staged loader copy absent");
}

if (failures) {
  process.exitCode = 1;
}
