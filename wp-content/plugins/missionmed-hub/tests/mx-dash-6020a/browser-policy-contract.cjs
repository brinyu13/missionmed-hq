'use strict';

const fs = require('fs');
const path = require('path');
const root = process.env.MMED_6020A_PLUGIN_ROOT || path.resolve(__dirname, '../..');
const student = fs.readFileSync(path.join(root, 'assets/student-os.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'assets/dashboard-v2/mmed-dashboard-v2.6010b-students.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/dashboard-v2/mmed-dashboard-v2.6010b-true-morph.css'), 'utf8');
let checks = 0;
function check(value, label) {
	checks += 1;
	if (!value) { throw new Error(label); }
}

check(!student.includes('MATRIX_TEMPORARY_OPEN_ROUTES'), 'temporary client allowlist removed');
check(student.includes('matrixAppDecision(route)'), 'student runtime consumes server decisions');
check(student.includes('decision.allowed !== true'), 'unknown client state cannot override a denial');
check(student.includes('{ route: "rise"'), 'RISE appears in the rail');
check(student.includes('{ route: "ranklist"'), 'RankList appears in the rail');
check(student.includes('truthyAccessFlag(accessData.full_access)'), 'welcome chooser uses full-access policy');
check(dashboard.includes('mmdv2-access-badge'), 'featured cards expose a lock badge');
check(dashboard.includes('aria-disabled="true"'), 'locked actions expose semantic state');
check(dashboard.includes('Open its featured card to learn more'), 'catalog lock remains discoverable');
check(dashboard.includes('const target = (accessLaunch(id) || a.launch ||'), 'launch uses server-owned target');
check(css.includes('.mmdv2-access-note'), 'locked detail status is styled');
check(css.includes('.mmdv2-entitlement-locked'), 'locked card state is styled');
check(dashboard.includes("const morphEnabled = cfg.experience === 'matrix2'"), 'Matrix 2 morph gate preserved');
check(dashboard.includes("const reduceMorphMotion = () => !fullMotionPreview && reduceMotion()"), 'reduced-motion path preserved');
check(dashboard.includes("listen(card, 'focusin', () => set(node, true))"), 'keyboard morph path preserved');
console.log(`PASS ${checks} browser policy assertions`);
