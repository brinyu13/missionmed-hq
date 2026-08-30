import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const PREIMAGE_SHA256 = Object.freeze({
  php: '80d510b4bb5531b7ad23689084f7173372dfbd5d5c7102365d85ab3e645f7a51',
  javascript: '30068939fc54fb4a21209de4962977b9aa1a89a9557a046d367b1737624c570b',
  runtimePin: 'f3c2d7e0c409c94d85e638382c0d2a439bb12138e66e43249c6f6ee6ca5b4988',
});

export const PINNED_ASSET_SHA256 = '809093d2b5b2bc05cdd4f355511f2c8d5303c71edbca4f71823d319976ced54f';
const OLD_ASSET = 'student-os.809093d2b5b2bc05.js';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function replaceExactly(source, before, after, label) {
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${label}_PREIMAGE_MISMATCH:${occurrences}`);
  }
  return source.replace(before, after);
}

export function transformPhp(source) {
  const before = `\t/**
\t * Add the fail-closed administrator-only IV Prep On-Call launch data.
\t *
\t * The launch target is fixed in server-owned code. Students and anonymous
\t * visitors receive neither the module permission nor the handoff URL.
\t *
\t * @param array $access Matrix access payload.
\t * @param int   $user_id WordPress user ID.
\t * @return array
\t */
\tprivate static function add_ivprep_access_payload( $access, $user_id ) {
\t\tif ( ! is_array( $access ) ) {
\t\t\t$access = array();
\t\t}

\t\t$allowed    = $user_id > 0 && user_can( $user_id, 'manage_options' );
\t\t$launch_url = $allowed ? self::get_ivprep_launch_url() : '';
\t\t$unlocked   = $allowed && '' !== $launch_url;

\t\tif ( ! isset( $access['module_permissions'] ) || ! is_array( $access['module_permissions'] ) ) {
\t\t\t$access['module_permissions'] = array();
\t\t}

\t\t$access['module_permissions']['ivprep'] = $unlocked;
\t\t$access['ivprep'] = array(
\t\t\t'enabled'     => '' !== $launch_url,
\t\t\t'unlocked'    => $unlocked,
\t\t\t'status'      => $unlocked ? 'admin_only' : 'not_authorized',
\t\t\t'reason_code' => $unlocked ? 'ivprep_admin_access' : 'ivprep_admin_required',
\t\t\t'launch_url'  => $unlocked ? $launch_url : '',
\t\t);

\t\treturn $access;
\t}`;

  const after = `\t/**
\t * Add fail-closed IV Prep On-Call launch data for administrators or current
\t * LearnDash course 3893 students.
\t *
\t * The launch target is fixed in server-owned code. Anonymous and
\t * non-entitled visitors receive neither permission nor the handoff URL.
\t *
\t * @param array $access Matrix access payload.
\t * @param int   $user_id WordPress user ID.
\t * @return array
\t */
\tprivate static function add_ivprep_access_payload( $access, $user_id ) {
\t\tif ( ! is_array( $access ) ) {
\t\t\t$access = array();
\t\t}

\t\t$is_admin        = $user_id > 0 && user_can( $user_id, 'manage_options' );
\t\t$enrolled        = array();
\t\t$course_entitled = false;

\t\tif ( $user_id > 0 && function_exists( 'learndash_user_get_enrolled_courses' ) ) {
\t\t\t$resolved_courses = learndash_user_get_enrolled_courses( $user_id );
\t\t\t$enrolled = is_array( $resolved_courses ) ? array_map( 'intval', $resolved_courses ) : array();
\t\t\t$course_entitled = in_array( 3893, $enrolled, true );
\t\t}

\t\t$allowed    = $is_admin || $course_entitled;
\t\t$launch_url = $allowed ? self::get_ivprep_launch_url() : '';
\t\t$unlocked   = $allowed && '' !== $launch_url;

\t\tif ( ! isset( $access['module_permissions'] ) || ! is_array( $access['module_permissions'] ) ) {
\t\t\t$access['module_permissions'] = array();
\t\t}

\t\t$access['module_permissions']['ivprep'] = $unlocked;
\t\t$access['ivprep'] = array(
\t\t\t'enabled'            => '' !== $launch_url,
\t\t\t'unlocked'           => $unlocked,
\t\t\t'status'             => $unlocked ? ( $is_admin ? 'administrator' : 'course_entitled' ) : 'not_authorized',
\t\t\t'reason_code'        => $unlocked ? ( $is_admin ? 'ivprep_admin_access' : 'ivprep_course_3893_access' ) : 'ivprep_entitlement_required',
\t\t\t'required_course_id' => 3893,
\t\t\t'launch_url'         => $unlocked ? $launch_url : '',
\t\t);

\t\treturn $access;
\t}`;

  let transformed = replaceExactly(source, before, after, 'PHP_IVPREP_METHOD');
  transformed = replaceExactly(
    transformed,
    "\t\t$final    = $origin . '/iv-prep-on-call/';",
    "\t\t$final    = $origin . '/iv-prep-analytics/';",
    'PHP_IVPREP_LAUNCH_ROUTE',
  );
  return transformed;
}

export function transformJavascript(source) {
  let transformed = replaceExactly(
    source,
    '\t\t{ route: "ivprep",        label: "IV Prep On-Call",  icon: "IV", section: "COMING / LOCKED", state: "locked" },',
    '\t\t{ route: "ivprep",        label: "IV Prep On-Call",  icon: "IV", section: "MATCH TOOLS",     state: "unlocked" },',
    'JS_IVPREP_NAV',
  );
  transformed = replaceExactly(
    transformed,
    'This hosted Founder/Admin surface requires a current administrator session.',
    'This protected surface requires current IV Prep On-Call access.',
    'JS_IVPREP_PAGE_COPY',
  );
  transformed = replaceExactly(
    transformed,
    'IV Prep On-Call is coming. Access will open when the module is released.',
    'IV Prep On-Call requires current access through MissionMed.',
    'JS_IVPREP_LOCK_COPY',
  );
  return transformed;
}

export function transformRuntimePin(source, { assetName, assetSha256 }) {
  let transformed = replaceExactly(source, PINNED_ASSET_SHA256, assetSha256, 'PIN_HASH');
  transformed = replaceExactly(transformed, OLD_ASSET, assetName, 'PIN_ASSET');
  return transformed;
}

export async function buildMatrixCandidate({ phpInput, javascriptInput, runtimePinInput, outputDirectory }) {
  const [phpBytes, javascriptBytes, runtimePinBytes] = await Promise.all([
    readFile(phpInput),
    readFile(javascriptInput),
    readFile(runtimePinInput),
  ]);
  const observed = {
    php: sha256(phpBytes),
    javascript: sha256(javascriptBytes),
    runtimePin: sha256(runtimePinBytes),
  };
  for (const [key, expected] of Object.entries(PREIMAGE_SHA256)) {
    if (observed[key] !== expected) throw new Error(`${key.toUpperCase()}_SHA256_MISMATCH`);
  }

  const php = transformPhp(phpBytes.toString('utf8'));
  const javascript = transformJavascript(javascriptBytes.toString('utf8'));
  const assetSha256 = sha256(Buffer.from(javascript));
  const assetName = `student-os.${assetSha256.slice(0, 16)}.js`;
  const runtimePin = transformRuntimePin(runtimePinBytes.toString('utf8'), { assetName, assetSha256 });

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, 'class-mmed-student-os.php'), php),
    writeFile(path.join(outputDirectory, assetName), javascript),
    writeFile(path.join(outputDirectory, 'missionmed-matrix-runtime-pin.php'), runtimePin),
  ]);
  return Object.freeze({ assetName, assetSha256, phpSha256: sha256(Buffer.from(php)), runtimePinSha256: sha256(Buffer.from(runtimePin)) });
}

async function main() {
  const [phpInput, javascriptInput, runtimePinInput, outputDirectory] = process.argv.slice(2);
  if (!phpInput || !javascriptInput || !runtimePinInput || !outputDirectory) {
    throw new Error('USAGE: build-matrix-canary.mjs PHP JS RUNTIME_PIN OUTPUT_DIRECTORY');
  }
  const receipt = await buildMatrixCandidate({ phpInput, javascriptInput, runtimePinInput, outputDirectory });
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    process.stderr.write(`MATRIX_CANARY_BUILD_FAILED:${error.message}\n`);
    process.exitCode = 1;
  });
}
