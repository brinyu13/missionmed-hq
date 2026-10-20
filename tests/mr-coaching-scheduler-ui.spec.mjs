import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const donor = fileURLToPath(new URL('../LIVE/scheduler/scheduler_v1.html', import.meta.url));
const adopted = fs.readFileSync(donor, 'utf8');
const patchFile = fileURLToPath(new URL('fixtures/mr-coaching-scheduler-ui.patch', import.meta.url));
const fixture = fs.readFileSync(patchFile, 'utf8');

// Reverse only the reviewed fixture in memory: no Git, network, or file writes.
function originalFromAdopted(current, diff) {
  const lines = current.split('\n'); const result = []; let cursor = 0;
  for (const hunk of diff.split(/(?=^@@ )/m).slice(1)) {
    const [header, ...body] = hunk.trimEnd().split('\n');
    const match = header.match(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/);
    assert.ok(match, 'fixture hunk header');
    const start = Number(match[3]) - 1;
    assert.ok(start >= cursor, 'ordered nonoverlapping fixture');
    result.push(...lines.slice(cursor, start)); cursor = start;
    let oldCount = 0, newCount = 0;
    for (const row of body) {
      assert.ok([' ', '+', '-'].includes(row[0]), 'fixture line type');
      if (row[0] !== '-') { assert.equal(lines[cursor++], row.slice(1), 'exact adopted UI fixture'); ++newCount; }
      if (row[0] !== '+') { result.push(row.slice(1)); ++oldCount; }
    }
    assert.equal(oldCount, Number(match[2])); assert.equal(newCount, Number(match[4]));
  }
  result.push(...lines.slice(cursor)); return result.join('\n');
}
const source = originalFromAdopted(adopted, fixture);
assert.equal(crypto.createHash('sha256').update(source).digest('hex'), 'e070132cd376f38da996493adb9866233dd3bc61230eee6d5e36535d53847323', 'exact original Git donor reconstructed in memory');
const edits = [];
function edit(before, after) {
  const start = source.indexOf(before);
  assert.ok(start >= 0 && source.indexOf(before, start + 1) < 0, 'unique exact edit anchor');
  assert.ok(start === 0 || source[start - 1] === '\n');
  assert.ok(before.endsWith('\n') && after.endsWith('\n'));
  edits.push({ start: source.slice(0, start).split('\n').length - 1, before: before.trimEnd().split('\n'), after: after.trimEnd().split('\n') });
}
edit(`      function paymentLabel(type) {
        if (!type) return "No payment step";
`, `      function paymentLabel(type) {
        if (!type) return "No payment step";
        if (isCoachingType(type)) return coachingTypeUsable(type) ? "Uses a paid coaching credit" : "Paid coaching credit unavailable";
`);
edit(`          return Boolean(appointmentTypeByVisit(visit, division));
        });
`, `          return Boolean(appointmentTypeByVisit(visit, division));
        }) || (division.id === "mission-residency" && scheduler.state.appointmentTypes.some(coachingTypeUsable));
`);
edit(`      function selectedVisitConfig() {
`, `      function isCoachingType(type) {
        return Boolean(type && Object.prototype.hasOwnProperty.call(type, "coaching_service"));
      }

      function coachingTypeUsable(type) {
        var entitlement = type && type.entitlement ? type.entitlement : {};
        return Boolean(type && type.division === "mission-residency" &&
          ["strategy", "mock", "debrief"].indexOf(type.coaching_service) >= 0 &&
          Number.isInteger(type.coaching_remaining) && type.coaching_remaining > 0 &&
          entitlement.status === "eligible" && entitlement.locked === false);
      }

      function coachingVisitConfig(type) {
        if (!coachingTypeUsable(type)) return null;
        return { slug: String(type.id), label: type.label || type.name || "Private coaching", mentors: [], coaching: true };
      }

      function selectedVisitConfig() {
`);
edit(`        return division.visits.find(function (visit) {
          return type && appointmentTypeMatchesVisit(type, visit, division);
        }) || null;
`, `        return division.visits.find(function (visit) {
          return type && appointmentTypeMatchesVisit(type, visit, division);
        }) || (division.id === "mission-residency" ? coachingVisitConfig(type) : null);
`);
edit(`        return division.visits.map(function (visit) {
          var type = appointmentTypeByVisit(visit, division);
          return type ? { label: visit.label, visit: visit, type: type } : null;
        }).filter(Boolean);
`, `        var options = division.visits.map(function (visit) {
          var type = appointmentTypeByVisit(visit, division);
          return type ? { label: visit.label, visit: visit, type: type } : null;
        }).filter(Boolean);
        if (division.id === "mission-residency") {
          scheduler.state.appointmentTypes.forEach(function (type) {
            var visit = coachingVisitConfig(type);
            if (visit && !options.some(function (option) { return String(option.type.id) === String(type.id); })) {
              options.push({ label: visit.label, visit: visit, type: type });
            }
          });
        }
        return options;
`);
edit(`      function isTypeLocked(type) {
        if (!type || !type.division) return true;
`, `      function isTypeLocked(type) {
        if (!type || !type.division) return true;
        if (isCoachingType(type)) return !coachingTypeUsable(type);
`);
edit(`      function appointmentTypeMatchesVisit(row, visit, division) {
`, `      function appointmentTypeMatchesVisit(row, visit, division) {
        if (isCoachingType(row)) return false;
`);
edit(`      function canUseAppointmentAction(action, appointment) {
`, `      function canUseAppointmentAction(action, appointment) {
        if (action === "reschedule" && appointment && appointment.coaching_access &&
          appointment.coaching_access.can_reschedule === false) return false;
`);
edit(`          query.set("provider_id", scheduler.state.providerId);
        }
        return query;
`, `          query.set("provider_id", scheduler.state.providerId);
        }
        if (scheduler.state.rescheduleAppointmentId && isCoachingType(selectedAppointmentType())) {
          query.set("appointment_id", scheduler.state.rescheduleAppointmentId);
        }
        return query;
`);
edit(`      function entitlementSuffix(type) {
`, `      function entitlementSuffix(type) {
        if (isCoachingType(type)) return coachingTypeUsable(type) ? " · " + type.coaching_remaining + " paid coaching credit(s) remaining" : " · no usable paid coaching credits";
`);
edit(`        if (!visit) return [];
        return visit.mentors.map(function (slug) {
`, `        if (!visit) return [];
        if (visit.coaching) {
          if (String(scheduler.state.providersAppointmentTypeId || "") !== String(scheduler.state.appointmentTypeId)) return [];
          return scheduler.state.providers.filter(function (provider) { return provider && provider.id; }).map(function (provider) {
            return { label: provider.display_name || provider.name || String(provider.id), provider: provider, availableSoon: false };
          });
        }
        return visit.mentors.map(function (slug) {
`);
edit(`          '<option value="">Choose a mentor</option>',
`, `          '<option value="">' + (isCoachingType(selectedAppointmentType()) && !options.length ? "Provider availability not yet confirmed" : "Choose a mentor") + '</option>',
`);
edit(`        var query = new URLSearchParams();
        if (scheduler.state.appointmentTypeId) {
          query.set("appointment_type_id", scheduler.state.appointmentTypeId);
        }
        return scheduler.api.get("/providers?" + query.toString()).then(function (result) {
          scheduler.state.providers = result.ok ? result.data.providers || [] : (isLocalPreview() ? localPreviewProviders() : []);
`, `        var requestedTypeId = scheduler.state.appointmentTypeId;
        scheduler.state.providers = [];
        scheduler.state.providersAppointmentTypeId = "";
        var query = new URLSearchParams();
        if (scheduler.state.appointmentTypeId) {
          query.set("appointment_type_id", scheduler.state.appointmentTypeId);
        }
        return scheduler.api.get("/providers?" + query.toString()).then(function (result) {
          if (String(requestedTypeId) !== String(scheduler.state.appointmentTypeId)) return;
          scheduler.state.providers = result.ok ? result.data.providers || [] : (isLocalPreview() ? localPreviewProviders() : []);
          scheduler.state.providersAppointmentTypeId = result.ok ? requestedTypeId : "";
`);
edit(`        function storyUnavailable(type) {
`, `        function storyUnavailable(type) {
          if (isCoachingType(type)) return !coachingTypeUsable(type);
`);
edit(`        function storyTypeStatus(type) {
`, `        function storyTypeStatus(type) {
          if (isCoachingType(type)) return coachingTypeUsable(type) ? type.coaching_remaining + " paid coaching credit(s) remaining" : "No usable paid coaching credits";
`);
edit(`                    escapeHTML(unavailable ? storyUnavailableMessage(option.type) : (option.type.description || storyTypeStatus(option.type))) +
`, `                    escapeHTML(unavailable ? storyUnavailableMessage(option.type) : (isCoachingType(option.type) ? storyTypeStatus(option.type) : (option.type.description || storyTypeStatus(option.type)))) +
`);
edit(`                (scheduler.state.noticeError ? storyError("Mentors did not load", scheduler.state.notice, "retry-providers") : storyLoading("Loading available mentors")),
`, `                (scheduler.state.noticeError ? storyError("Mentors did not load", scheduler.state.notice, "retry-providers") : (isCoachingType(type) ? '<div class="sf-empty">Provider availability not yet confirmed.</div>' : storyLoading("Loading available mentors"))),
`);

// Optional stdout-only patch construction; never writes or alters the donor.
function buildPatch() {
  const lines = source.split('\n');
  const sorted = edits.sort((a, b) => a.start - b.start);
  const groups = [];
  for (const e of sorted) {
    const begin = Math.max(0, e.start - 3), end = Math.min(lines.length, e.start + e.before.length + 3);
    const last = groups.at(-1);
    if (last && begin <= last.end) { last.end = Math.max(last.end, end); last.edits.push(e); }
    else groups.push({ begin, end, edits: [e] });
  }
  let delta = 0;
  const out = ['--- a/LIVE/scheduler/scheduler_v1.html', '+++ b/LIVE/scheduler/scheduler_v1.html'];
  for (const group of groups) {
    const body = []; let cursor = group.begin, added = 0;
    for (const e of group.edits) {
      while (cursor < e.start) body.push(' ' + lines[cursor++]);
      assert.deepEqual(lines.slice(cursor, cursor + e.before.length), e.before);
      body.push(...e.before.map(s => '-' + s), ...e.after.map(s => '+' + s));
      cursor += e.before.length; added += e.after.length - e.before.length;
    }
    while (cursor < group.end) body.push(' ' + lines[cursor++]);
    out.push(`@@ -${group.begin + 1},${group.end - group.begin} +${group.begin + delta + 1},${group.end - group.begin + added} @@`, ...body);
    delta += added;
  }
  return out.join('\n') + '\n';
}
if (process.argv.includes('--emit-patch')) { process.stdout.write(buildPatch()); process.exit(0); }
const patch = fs.readFileSync(patchFile, 'utf8');
assert.equal(patch, buildPatch(), 'patch is narrow exact-donor unified diff');
const originalLines = source.split('\n'); const modified = []; let cursor = 0;
for (const hunk of patch.split(/(?=^@@ )/m).slice(1)) {
  const [header, ...body] = hunk.trimEnd().split('\n');
  const match = header.match(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/);
  assert.ok(match); const start = Number(match[1]) - 1;
  modified.push(...originalLines.slice(cursor, start)); cursor = start;
  let oldCount = 0, newCount = 0;
  for (const row of body) {
    if (row[0] !== '+') { assert.equal(originalLines[cursor++], row.slice(1)); ++oldCount; }
    if (row[0] !== '-') { modified.push(row.slice(1)); ++newCount; }
  }
  assert.equal(oldCount, Number(match[2])); assert.equal(newCount, Number(match[4]));
}
modified.push(...originalLines.slice(cursor)); const patched = modified.join('\n');
let count = 0;
function check(condition, label) { ++count; assert.ok(condition, label); }
function fn(text, name, indent = 6) {
  const prefix = ' '.repeat(indent) + 'function ' + name + '(';
  const begin = text.indexOf(prefix); assert.ok(begin >= 0, name);
  const end = text.indexOf('\n' + ' '.repeat(indent) + 'function ', begin + prefix.length);
  assert.ok(end > begin, name + ' end'); return text.slice(begin, end);
}
for (const html of [source, patched]) {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) new vm.Script(script[1]);
  check(scripts.length > 0, 'both renderers embedded scripts parse');
}
const divisionStart = patched.indexOf('      var BOOKING_DIVISIONS = [');
const divisions = patched.slice(divisionStart, patched.indexOf('\n\n      scheduler.state =', divisionStart));
check(divisions === source.slice(source.indexOf('      var BOOKING_DIVISIONS = ['), source.indexOf('\n\n      scheduler.state =', source.indexOf('      var BOOKING_DIVISIONS = ['))), 'all legacy division options unchanged');
for (const name of ['submitBookingCore', 'cancelAppointment', 'startReschedule', 'loadAvailability']) check(fn(source, name) === fn(patched, name), name + ' payload/control source unchanged');
for (const name of ['hasPendingAppointmentDraft', 'confirmMatrixReturn', 'bindMatrixReturnControls']) check(fn(source, name, 8) === fn(patched, name, 8), name + ' unchanged');
const names = ['selectedDivision', 'visibleBookingDivisions', 'hasDivisionTypes', 'isCoachingType', 'coachingTypeUsable', 'coachingVisitConfig', 'selectedVisitConfig', 'selectedVisitLabel', 'visitTypeOptions', 'isTypeLocked', 'entitlementSuffix', 'mentorOptions', 'appointmentTypeByVisit', 'appointmentTypeMatchesVisit', 'visitSlugCandidates', 'appointmentTypeSlugCandidates', 'appointmentTypeLabelCandidates', 'appointmentTypeDivisionMatches', 'normalizeSlug', 'providerBySlug', 'providerSlug', 'mentorNameFromSlug', 'selectedAppointmentType', 'escapeHTML', 'escapeAttr', 'visitTypeSelectMarkup', 'mentorSelectMarkup', 'paymentLabel', 'loadProviders'];
names.push('buildAvailabilityQuery', 'canUseAppointmentAction');
const state = { division: 'mission-residency', appointmentTypes: [], providers: [], appointmentTypeId: '', providerId: '', entitlements: { available_divisions: ['non-member'] } };
const context = vm.createContext({ scheduler: { state }, URLSearchParams, readFormState() {}, renderBookingStepOnly() {}, isLocalPreview: () => false, setNotice() {}, storyError: () => 'Provider error', storyLoading: () => 'Loading' });
vm.runInContext(divisions + '\n' + names.map(n => fn(patched, n)).join('\n') + '\n' + ['storyUnavailable', 'storyUnavailableMessage', 'storyTypeStatus', 'storyDetails'].map(n => fn(patched, n, 8)).join('\n'), context);
const legacy = { id: 'legacy-mock', slug: 'mission-residency-1-on-1-mock-iv', name: 'Legacy Mock', division: 'mission-residency', entitlement: { status: 'eligible', locked: false } };
const coaching = { id: 'owned-coaching', name: 'Signature Coaching Mock', division: 'mission-residency', coaching_service: 'mock', coaching_remaining: 2, entitlement: { status: 'eligible', locked: false }, student_config: { payments: { mode: 'none' } }, description: 'Service description' };
state.appointmentTypes = [legacy, coaching]; state.appointmentTypeId = coaching.id;
check(context.visitTypeOptions().map(o => o.type.id).join(',') === 'legacy-mock,owned-coaching', 'new paid coaching appended after unchanged legacy option');
state.appointmentTypes = [{ ...coaching, name: '1-on-1 Mock IV' }, legacy];
check(context.visitTypeOptions().map(o => o.type.id).join(',') === 'legacy-mock,owned-coaching', 'coaching label collision never hijacks legacy option');
check(context.selectedVisitConfig().coaching === true, 'coaching label collision never invents legacy mentor mapping');
state.appointmentTypes = [legacy, coaching];
check(context.visibleBookingDivisions().some(d => d.id === 'mission-residency'), 'paid coaching division visible without legacy entitlement');
check(context.selectedVisitLabel() === coaching.name, 'actual coaching type label fallback');
check(context.mentorOptions().length === 0, 'no invented mentor before scoped provider load');
check(context.mentorSelectMarkup().includes('Provider availability not yet confirmed'), 'Classic honest missing provider');
check(context.visitTypeSelectMarkup().includes('2 paid coaching credit(s) remaining'), 'Classic shows usable credit balance');
check(context.storyDetails().includes('2 paid coaching credit(s) remaining'), 'StoryForge shows usable credits even with description');
check(context.storyDetails().includes('Provider availability not yet confirmed'), 'StoryForge honest missing provider');
check(context.paymentLabel(coaching) === 'Uses a paid coaching credit', 'scheduler payment-none never implies free service');
check(!/free|unlimited/i.test(context.entitlementSuffix(coaching) + context.paymentLabel(coaching)), 'no free or unlimited credit claim');
for (const changes of [{ coaching_remaining: 0 }, { coaching_remaining: -1 }, { coaching_remaining: '2' }, { coaching_remaining: 1.5 }, { coaching_remaining: null }, { division: 'exam-prep' }, { coaching_service: 'emergency' }, { entitlement: { status: 'ineligible', locked: true } }, { entitlement: { status: 'eligible' } }, { entitlement: { status: 'pending', locked: false } }]) {
  const bad = { ...coaching, ...changes }; state.appointmentTypes = [legacy, bad];
  check(context.visitTypeOptions().every(o => o.type.id !== bad.id) && context.isTypeLocked(bad) && context.storyUnavailable(bad), 'unpaid/invalid/exhausted coaching hidden and locked in both renderers');
}
state.appointmentTypes = [legacy, coaching];
state.providers = [{ id: 'actual-server-provider', display_name: 'Actual Provider' }];
check(context.mentorOptions().length === 0, 'providers from previous type not reused');
state.providersAppointmentTypeId = coaching.id;
check(context.mentorOptions().length === 1 && context.mentorOptions()[0].provider.id === 'actual-server-provider', 'only actual scoped server provider offered');
check(context.mentorOptions()[0].availableSoon === false, 'no invented availability-coming-soon claim');
const replies = [];
context.scheduler.api = { get: url => new Promise(resolve => replies.push({ url, resolve })) };
const firstLoad = context.loadProviders();
check(state.providers.length === 0 && state.providersAppointmentTypeId === '', 'provider load clears stale provider state');
state.appointmentTypeId = legacy.id;
replies[0].resolve({ ok: true, data: { providers: [{ id: 'stale-provider' }] } }); await firstLoad;
check(state.providers.length === 0, 'late provider response for previous type ignored');
state.appointmentTypeId = coaching.id;
const secondLoad = context.loadProviders(); replies[1].resolve({ ok: true, data: { providers: [{ id: 'paid-provider', name: 'Verified Provider' }] } }); await secondLoad;
check(context.mentorOptions()[0].provider.id === 'paid-provider', 'current scoped provider response usable');
check(replies.every(r => r.url.startsWith('/providers?appointment_type_id=')), 'standard provider API unchanged');
context.weekDays = () => Array.from({length:7}, (_, i) => new Date(Date.UTC(2032, 6, 4+i, 12)));
state.timezone='America/New_York';state.rescheduleAppointmentId='stored-reserved-appointment';
check(context.buildAvailabilityQuery().get('appointment_id') === 'stored-reserved-appointment', 'coaching reschedule identifies reserved usage even when no new available credit remains');
check(!context.buildAvailabilityQuery().has('unit_id') && !context.buildAvailabilityQuery().has('actor_user_id'), 'browser never resolves paid units or claims actor identity');
state.rescheduleAppointmentId='';
check(!context.buildAvailabilityQuery().has('appointment_id'), 'new coaching booking has no reschedule target');
state.rescheduleAppointmentId='stored-reserved-appointment';state.appointmentTypeId=legacy.id;
check(!context.buildAvailabilityQuery().has('appointment_id'), 'ordinary availability query unchanged');
state.boot={features:{can_reschedule:true,can_cancel:true}};
const deniedHistory={coaching_access:{status:'unverified',links_available:false,can_reschedule:false},capabilities:{can_reschedule:true}};
check(!context.canUseAppointmentAction('reschedule',deniedHistory), 'explicit coaching refund/outage denial overrides generic or stale reschedule capability');
check(context.canUseAppointmentAction('cancel',deniedHistory), 'revoked owned usage can still request cancellation');
check(context.canUseAppointmentAction('reschedule',{}), 'ordinary reschedule capability unchanged');
state.appointmentTypes = [legacy]; state.appointmentTypeId = legacy.id;
check(context.entitlementSuffix(legacy) === ' · included' && !context.isTypeLocked(legacy), 'legacy entitlement presentation unchanged');
check(fs.readFileSync(donor, 'utf8') === adopted && patched === adopted, 'adopted source unchanged and equals accepted narrow patch');
console.log(`PASS: ${count} deterministic Scheduler coaching UI assertions; portable adopted source verified in memory`);
