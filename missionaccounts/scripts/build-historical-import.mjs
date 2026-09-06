import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { readFile, stat, writeFile } from 'node:fs/promises';

const ledgerPath = process.env.MISSIONACCOUNTS_5000B_LEDGER || '/Users/brianb/MissionMed/_REPORTS/EXAMPREP/DrJ_Billing_Rescue_2026/MX-EXAMPREP-5000B_Reconciled_Ledger.json';
const graphPath = process.env.MISSIONACCOUNTS_5000B_IDENTITY || '/Users/brianb/MissionMed/_REPORTS/EXAMPREP/DrJ_Billing_Rescue_2026/MX-EXAMPREP-5000B_Identity_Graph.json';
const rawDir = process.env.MISSIONACCOUNTS_ZOOM_EXPORT_DIR || '/Users/brianb/MissionMed/_REPORTS/EXAMPREP/DrJ_Billing_Rescue_2026/raw_zoom_exports';
const manifestPath = `${rawDir}/SOURCE_MANIFEST.csv`;
const expected = {
  ledger: '6a38967fcb369ba6b9bb71daee8f66697efee0042ab6ebd421a0edf1aaeba108',
  graph: 'c8e89ab0217c5a6df21e4506f133f06d9470c8cd5b51c81eec356de251bce5ee',
  manifest: '5209775bceca32b4db848154d54b116a5ff9820d409cda648c9c9698ab6a1b60',
};
const cycleByLabel = {
  'Cycle 1': { key: '2026-cycle-1', label: 'June Cycle', starts_on: '2026-06-08', ends_on: '2026-07-13' },
  'Cycle 2': { key: '2026-cycle-2', label: 'July Cycle', starts_on: '2026-07-14', ends_on: '2026-08-11' },
  'Cycle 3': { key: '2026-cycle-3', label: 'August Cycle', starts_on: '2026-08-12', ends_on: '2026-09-04' },
};

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function uuidFor(value) {
  const hex = sha256(value);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function normalize(value) { return String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' '); }
function sql(value) {
  if (value === null || value === undefined || value === '') return value === '' ? "''" : 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `'${String(value).replaceAll('\0', '').replaceAll("'", "''")}'`;
}
function valuesStatement(table, columns, rows, size = 250) {
  const output = [];
  for (let offset = 0; offset < rows.length; offset += size) {
    const chunk = rows.slice(offset, offset + size);
    output.push(`insert into missionaccounts.${table}(${columns.join(',')}) values\n${chunk.map(row => `  (${row.map(sql).join(',')})`).join(',\n')};`);
  }
  return output.join('\n');
}
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows;
}
function easternIso(value) {
  const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2}) (AM|PM)$/);
  if (!match) return null;
  let hour = Number(match[4]);
  if (match[7] === 'AM' && hour === 12) hour = 0;
  if (match[7] === 'PM' && hour !== 12) hour += 12;
  return `${match[3]}-${match[1]}-${match[2]}T${String(hour).padStart(2, '0')}:${match[5]}:${match[6]}-04:00`;
}
function localStartKey(value) { return String(value || '').replace(/(?:-04:00|Z)$/, '').slice(0, 19); }
function meetingLookupKey(meetingId, startsAt) { return `${normalize(meetingId)}|${localStartKey(startsAt)}`; }
function cycleForDay(day) {
  return Object.values(cycleByLabel).find(cycle => day >= cycle.starts_on && day <= cycle.ends_on) || null;
}
function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const outputFlag = process.argv.indexOf('--output');
if (outputFlag < 0 || !process.argv[outputFlag + 1]) throw new Error('Usage: node build-historical-import.mjs --output /absolute/private-import.sql');
const outputPath = resolve(process.argv[outputFlag + 1]);

async function verifiedJson(file, digest) {
  const bytes = await readFile(file);
  const actual = sha256(bytes);
  if (actual !== digest) throw new Error(`Source hash mismatch for ${basename(file)}: ${actual}`);
  return { data: JSON.parse(bytes), sha256: actual, byte_count: bytes.length };
}

const [ledgerArtifact, graphArtifact] = await Promise.all([
  verifiedJson(ledgerPath, expected.ledger),
  verifiedJson(graphPath, expected.graph),
]);
const ledger = ledgerArtifact.data;
const graph = graphArtifact.data;
const manifestBytes = await readFile(manifestPath);
const manifestSha256 = sha256(manifestBytes);
if (manifestSha256 !== expected.manifest) throw new Error(`Source hash mismatch for ${basename(manifestPath)}: ${manifestSha256}`);
const manifestRows = parseCsv(manifestBytes.toString('utf8'));
const manifestHeader = manifestRows.shift();
const manifestObjects = manifestRows.filter(row => row.length).map(row => Object.fromEntries(manifestHeader.map((key, index) => [key, row[index]])));
const manifest = new Map(manifestObjects.map(row => [row.verified_raw_copy, row]));
const rawFiles = [...manifest.values()].map(item => item.verified_raw_copy);
const rawArtifacts = [];
for (const name of rawFiles) {
  const file = `${rawDir}/${name}`;
  const bytes = await readFile(file);
  const digest = sha256(bytes);
  const expectedRow = manifest.get(name);
  if (digest !== expectedRow.sha256 || bytes.length !== Number(expectedRow.size_bytes)) throw new Error(`Raw Zoom custody mismatch for ${name}`);
  rawArtifacts.push({ name, file, bytes, sha256: digest, byte_count: bytes.length, stat: await stat(file) });
}

const artifactRows = [
  { kind: 'reconciled_ledger', path: ledgerPath, digest: ledgerArtifact.sha256, bytes: ledgerArtifact.byte_count },
  { kind: 'identity_graph', path: graphPath, digest: graphArtifact.sha256, bytes: graphArtifact.byte_count },
  { kind: 'zoom_manifest', path: manifestPath, digest: manifestSha256, bytes: manifestBytes.length },
  ...rawArtifacts.map(item => ({ kind: 'zoom_csv', path: item.file, digest: item.sha256, bytes: item.byte_count })),
].map(item => ({ ...item, id: uuidFor(`artifact:${item.digest}`) }));
const artifactByBasename = new Map(artifactRows.map(item => [basename(item.path), item]));
const ledgerArtifactId = artifactRows.find(item => item.kind === 'reconciled_ledger').id;
const graphArtifactId = artifactRows.find(item => item.kind === 'identity_graph').id;
const importRunId = uuidFor(`import:${ledgerArtifact.sha256}`);
const engineRunId = uuidFor(`engine:historical-v1:${ledgerArtifact.sha256}`);

const unresolvedKeys = new Set(ledger.unresolved_relationships.flatMap(item => [item.alias_a_key, item.alias_b_key]).filter(Boolean));
const graphNodes = new Map(graph.nodes.map(node => [node.identity_key, node]));
const studentSourceKeys = new Map();
const students = new Map();
for (const row of ledger.reconciled_attendance_ledger) {
  const keys = studentSourceKeys.get(row.human_key) || new Set();
  for (const key of row.source_identity_keys || []) keys.add(key);
  studentSourceKeys.set(row.human_key, keys);
  if (!students.has(row.human_key)) students.set(row.human_key, { human_key: row.human_key, name: row.canonical_human });
}
for (const student of students.values()) {
  const sourceKeys = studentSourceKeys.get(student.human_key) || new Set();
  const emails = new Set([...sourceKeys].map(key => graphNodes.get(key)?.normalized_email).filter(Boolean));
  student.id = uuidFor(`student:${student.human_key}`);
  student.email = emails.size === 1 ? [...emails][0] : null;
  student.identity_state = [...sourceKeys].some(key => unresolvedKeys.has(key)) || emails.size > 1 ? 'needs_review' : 'verified';
}

const ledgerSessions = new Map();
for (const row of ledger.reconciled_attendance_ledger) {
  const key = meetingLookupKey(row.meeting_id, row.meeting_start);
  const existing = ledgerSessions.get(key);
  if (existing && existing.meeting_key !== row.meeting_key) throw new Error('Reconciled ledger has conflicting meeting keys');
  ledgerSessions.set(key, {
    meeting_key: row.meeting_key,
    meeting_id: row.meeting_id,
    starts_at: row.meeting_start,
    held_on: row.meeting_date,
    cycle: cycleByLabel[row.cycle],
  });
}

const rawSourceRows = [];
const sessions = new Map();
for (const artifact of rawArtifacts) {
  const rows = parseCsv(artifact.bytes.toString('utf8').replace(/^\uFEFF/, ''));
  const header = rows.shift();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.length !== header.length || row.length < 21) continue;
    const meetingId = row[2].trim();
    const startsAt = easternIso(row[5]);
    const heldOn = startsAt?.slice(0, 10);
    const cycle = cycleForDay(heldOn);
    if (!meetingId || !startsAt || !cycle) throw new Error(`Invalid Zoom row custody at ${artifact.name}:${index + 2}`);
    const lookup = meetingLookupKey(meetingId, startsAt);
    const confirmed = ledgerSessions.get(lookup) || null;
    const sessionId = uuidFor(`session:${lookup}`);
    if (!sessions.has(lookup)) {
      sessions.set(lookup, {
        id: sessionId,
        cycle,
        artifact_id: artifactByBasename.get(artifact.name).id,
        meeting_id: meetingId,
        instance_id: confirmed?.meeting_key || `raw:${sha256(lookup)}`,
        starts_at: startsAt,
        held_on: heldOn,
        step: confirmed ? (Number(startsAt.slice(11, 13)) < 13 ? 's1' : 's23') : 'unknown',
        state: confirmed ? 'confirmed' : 'candidate',
        confirmed: Boolean(confirmed),
      });
    }
    const payload = { source_file: artifact.name, source_row: index + 2, columns: Object.fromEntries(header.map((key, column) => [`${key || 'column'}_${column + 1}`, row[column]])) };
    const providerSourceId = sha256(`${artifact.sha256}|${index + 2}|${row.join('\u241f')}`);
    rawSourceRows.push({
      id: uuidFor(`source-row:${providerSourceId}`),
      session_id: sessionId,
      provider_source_id: providerSourceId,
      participant_source_id: sha256(`${normalize(row[16])}|${normalize(row[17])}`),
      display_name: row[16].trim() || 'Unidentified Zoom participant',
      joined_at: easternIso(row[18]),
      left_at: easternIso(row[19]),
      duration_seconds: numeric(row[20]) == null ? null : Math.max(0, Math.round(numeric(row[20]) * 60)),
      payload,
      payload_sha256: sha256(JSON.stringify(payload)),
      lookup,
      normalized_name: normalize(row[16]),
    });
  }
}

for (const session of ledgerSessions.values()) {
  if (!sessions.has(meetingLookupKey(session.meeting_id, session.starts_at))) throw new Error(`Confirmed ledger session is absent from preserved Zoom CSV: ${session.meeting_key}`);
}

const eventRows = [];
const sourceRowsByMeetingAndName = new Map();
for (const row of rawSourceRows) {
  const key = `${row.lookup}|${row.normalized_name}`;
  const list = sourceRowsByMeetingAndName.get(key) || [];
  list.push(row);
  sourceRowsByMeetingAndName.set(key, list);
}
const eventsByMeetingAndName = new Map();
for (const row of ledger.reconciled_attendance_ledger) {
  const lookup = meetingLookupKey(row.meeting_id, row.meeting_start);
  const event = {
    id: uuidFor(`event:${row.human_key}|${row.meeting_key}`),
    student_id: students.get(row.human_key).id,
    session_id: sessions.get(lookup).id,
    cycle_key: cycleByLabel[row.cycle].key,
    local_day: row.meeting_date,
    step: sessions.get(lookup).step,
    interpretation_state: students.get(row.human_key).identity_state === 'verified' ? 'effective' : 'needs_review',
    provenance: {
      source: 'MX-EXAMPREP-5000B_Reconciled_Ledger.json',
      meeting_key: row.meeting_key,
      human_key: row.human_key,
      source_identity_keys: row.source_identity_keys,
      source_attendance_rows_consolidated: row.source_attendance_rows_consolidated,
      reconciliation_confidence: row.reconciliation_confidence,
    },
    raw_names: new Set([...(row.raw_participant_names || []), ...(row.provenance || []).map(item => item.raw_name)].filter(Boolean).map(normalize)),
  };
  eventRows.push(event);
  for (const name of event.raw_names) {
    const key = `${lookup}|${name}`;
    const list = eventsByMeetingAndName.get(key) || [];
    list.push(event);
    eventsByMeetingAndName.set(key, list);
  }
}

const eventSourceLinks = [];
const linkedEventIds = new Set();
for (const [key, sourceRows] of sourceRowsByMeetingAndName) {
  const matchingEvents = [...new Map((eventsByMeetingAndName.get(key) || []).map(event => [event.id, event])).values()];
  if (matchingEvents.length !== 1) continue;
  for (const sourceRow of sourceRows) eventSourceLinks.push([matchingEvents[0].id, sourceRow.id]);
  linkedEventIds.add(matchingEvents[0].id);
}
for (const event of eventRows) {
  if (!linkedEventIds.has(event.id)) event.interpretation_state = 'needs_review';
}

const dayGroups = new Map();
for (const event of eventRows) {
  const key = `${event.student_id}|${event.local_day}`;
  const list = dayGroups.get(key) || [];
  list.push(event);
  dayGroups.set(key, list);
}
const dayRows = [...dayGroups.entries()].map(([key, events]) => {
  const [studentId, day] = key.split('|');
  const student = [...students.values()].find(item => item.id === studentId);
  return {
    id: uuidFor(`attendance-day:${key}`),
    student_id: studentId,
    cycle_key: events[0].cycle_key,
    day,
    kind: student.identity_state === 'verified' && events.every(event => event.interpretation_state === 'effective') ? 'billable' : 'needs_review',
    same_day_multiple_events: events.length > 1,
    events,
  };
});

const summaries = ledger.human_cycle_summaries.map(row => ({
  ...row,
  student_id: students.get(row.human_key).id,
  cycle_key: cycleByLabel[row.cycle].key,
}));
const capCandidates = summaries.filter(row => row.billing_tier === '16+ / $300' && row.session_dates.length * 25 > 300);
const controls = {
  students: students.size,
  sessions: sessions.size,
  confirmed_sessions: [...sessions.values()].filter(session => session.confirmed).length,
  raw_source_rows: rawSourceRows.length,
  attendance_events: eventRows.length,
  linked_events: linkedEventIds.size,
  event_source_links: eventSourceLinks.length,
  attendance_days: dayRows.length,
  needs_review_students: [...students.values()].filter(student => student.identity_state === 'needs_review').length,
  students_with_email: [...students.values()].filter(student => student.email).length,
  events_without_exact_source_link: eventRows.length - linkedEventIds.size,
  cap_candidates: capCandidates.length,
};
if (controls.students !== 271 || controls.sessions !== 419 || controls.confirmed_sessions !== 100
  || controls.raw_source_rows !== 5498 || controls.attendance_events !== 3941 || controls.attendance_days !== 3264
  || controls.cap_candidates !== 74 || controls.events_without_exact_source_link !== 4) throw new Error(`Historical import controls failed: ${JSON.stringify(controls)}`);

const statements = ['begin;', "set local timezone = 'America/New_York';"];
statements.push(valuesStatement('source_artifact', ['id','source_kind','source_path','sha256','byte_count','observed_at'], artifactRows.map(item => [item.id,item.kind,item.path,item.digest,item.bytes,ledger.generated_at])));
statements.push(valuesStatement('import_run', ['id','artifact_id','request_id','state','source_controls'], [[importRunId,ledgerArtifactId,`mx-examprep-5000b:${ledgerArtifact.sha256}`,'validated',JSON.stringify({ ledger_sha256: ledgerArtifact.sha256, graph_sha256: graphArtifact.sha256, manifest_sha256: manifestSha256, raw_exports: rawArtifacts.map(item => item.sha256) })]]));
statements.push(`${valuesStatement('cycle', ['key','label','starts_on','ends_on','state'], Object.values(cycleByLabel).map(cycle => [cycle.key,cycle.label,cycle.starts_on,cycle.ends_on,'review'])).replace(/;$/, '')}
on conflict (key) do update set
  label = excluded.label,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  state = excluded.state;`);
statements.push(valuesStatement('student', ['id','display_name','source_name','email','comp_days_allowance','identity_state'], [...students.values()].map(student => [student.id,student.name,student.name,student.email,0,student.identity_state])));

const studentBySourceKey = new Map();
for (const [humanKey, keys] of studentSourceKeys) for (const key of keys) studentBySourceKey.set(key, students.get(humanKey));
const excludedKeys = new Set(ledger.excluded_nonstudents.map(item => item.identity_key));
statements.push(valuesStatement('identity_alias', ['id','student_id','source_artifact_id','source_key','display_value','relationship_state','confidence','approved_by','approved_at'], graph.nodes.map(node => {
  const student = studentBySourceKey.get(node.identity_key) || null;
  const rejected = excludedKeys.has(node.identity_key) || node.staff_or_system === true;
  const candidate = !student || unresolvedKeys.has(node.identity_key);
  const state = rejected ? (node.device_unresolved ? 'device' : 'excluded') : candidate ? 'candidate' : 'verified';
  const display = node.raw_names?.[0] || node.normalized_name || node.normalized_email || node.identity_key;
  return [uuidFor(`alias:${node.identity_key}`),student?.id || null,graphArtifactId,node.identity_key,display,state,numeric(node.confidence),state === 'verified' ? 'MX-EXAMPREP-5000B' : null,state === 'verified' ? ledger.generated_at : null];
})));
statements.push(valuesStatement('session', ['id','cycle_key','source_artifact_id','provider','provider_meeting_id','provider_instance_id','starts_at','held_on','time_zone','step','state','source_payload'], [...sessions.values()].map(session => [session.id,session.cycle.key,session.artifact_id,'zoom',session.meeting_id,session.instance_id,session.starts_at,session.held_on,'America/New_York',session.step,session.state,JSON.stringify({ historical_import: true, confirmed_by_5000b: session.confirmed })])));
statements.push(valuesStatement('attendance_source_row', ['id','import_run_id','session_id','provider_source_id','participant_source_id','display_name','joined_at','left_at','duration_seconds','payload','payload_sha256'], rawSourceRows.map(row => [row.id,importRunId,row.session_id,row.provider_source_id,row.participant_source_id,row.display_name,row.joined_at,row.left_at,row.duration_seconds,JSON.stringify(row.payload),row.payload_sha256])));
statements.push(valuesStatement('attendance_event', ['id','student_id','session_id','cycle_key','local_day','step','interpretation_state','provenance'], eventRows.map(event => [event.id,event.student_id,event.session_id,event.cycle_key,event.local_day,event.step,event.interpretation_state,JSON.stringify(event.provenance)])));
statements.push(valuesStatement('attendance_event_source_row', ['attendance_event_id','source_row_id'], eventSourceLinks));
statements.push(valuesStatement('engine_run', ['id','engine_version','source_digest','state','controls','finished_at'], [[engineRunId,'historical-v1',ledgerArtifact.sha256,'succeeded',JSON.stringify(controls),ledger.generated_at]]));
statements.push(valuesStatement('attendance_day', ['id','engine_run_id','student_id','cycle_key','day','kind','same_day_multiple_events','engine_version','source_digest'], dayRows.map(day => [day.id,engineRunId,day.student_id,day.cycle_key,day.day,day.kind,day.same_day_multiple_events,'historical-v1',ledgerArtifact.sha256])));
statements.push(valuesStatement('attendance_day_event', ['attendance_day_id','attendance_event_id'], dayRows.flatMap(day => day.events.map(event => [day.id,event.id]))));
statements.push(valuesStatement('historical_account_source', ['id','student_id','cycle_key','artifact_id','source_events','source_amount_cents','source_tier','source_state'], summaries.map(row => [uuidFor(`historical-account:${row.human_key}|${row.cycle}`),row.student_id,row.cycle_key,ledgerArtifactId,row.attendance,row.provisional_charge * 100,row.billing_tier,'preserved'])));
statements.push(valuesStatement('full_cycle_ceiling', ['id','student_id','cycle_key','status','ceiling_cents','basis'], capCandidates.map(row => [uuidFor(`cap-candidate:${row.human_key}|${row.cycle}`),row.student_id,row.cycle_key,'candidate',30000,JSON.stringify({ source_artifact_sha256: ledgerArtifact.sha256, source_tier: row.billing_tier, source_events: row.attendance, unique_days: row.session_dates.length, status: 'REVIEW_REQUIRED' })])));
statements.push(`update missionaccounts.import_run set state='applied', result_controls=${sql(JSON.stringify(controls))}, finished_at=${sql(ledger.generated_at)} where id=${sql(importRunId)};`);
statements.push(`do $verify$ begin
  if (select count(*) from missionaccounts.student) <> 271 then raise exception 'student_control_failed'; end if;
  if (select count(*) from missionaccounts.session) <> 419 then raise exception 'session_control_failed'; end if;
  if (select count(*) from missionaccounts.session where state='confirmed') <> 100 then raise exception 'confirmed_session_control_failed'; end if;
  if (select count(*) from missionaccounts.attendance_source_row) <> 5498 then raise exception 'source_row_control_failed'; end if;
  if (select count(*) from missionaccounts.attendance_event) <> 3941 then raise exception 'event_control_failed'; end if;
  if (select count(*) from missionaccounts.attendance_day) <> 3264 then raise exception 'day_control_failed'; end if;
  if (select count(*) from missionaccounts.full_cycle_ceiling where status='candidate') <> 74 then raise exception 'cap_candidate_control_failed'; end if;
end $verify$;`);
statements.push('commit;');

await writeFile(outputPath, `${statements.join('\n\n')}\n`, { mode: 0o600 });
console.log(JSON.stringify({ status: 'PRIVATE_IMPORT_SQL_BUILT', output: outputPath, controls }, null, 2));
