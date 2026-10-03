// Teaching derivations — evidence-only. Every sentence here is computed from measured samples,
// transcript turns or the conductor ledger. No psychology, personality, emotion or
// match-likelihood. Evidence always carries a seek time.

import { dwell, intervalRuns } from './trace-reducer.mjs';

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pct = (f) => `${Math.round(f * 100)}%`;

function longestRun(samples, predicate, minS = 4) {
  let best = null; let cur = null;
  for (const s of samples) {
    if (predicate(s)) { if (!cur) cur = { startT: s.t, endT: s.t }; else cur.endT = s.t; }
    else if (cur) { if (!best || cur.endT - cur.startT > best.endT - best.startT) best = cur; cur = null; }
  }
  if (cur && (!best || cur.endT - cur.startT > best.endT - best.startT)) best = cur;
  return best && best.endT - best.startT >= minS ? best : null;
}

export function deriveDebrief(attempt) {
  const samples = attempt.samples || [];
  const events = attempt.events || [];
  const answering = samples.filter((s) => s.state === 'ANSWERING');
  const worked = []; const change = []; const facts = [];
  const paceIn = dwell(samples, (s) => s.scores?.pace != null && s.scores.pace >= 7 && s.scores.pace <= 8.5);
  const paceMeasured = dwell(samples, (s) => s.scores?.pace != null);
  if (paceMeasured.count >= 6) {
    const f = paceIn.count / paceMeasured.count;
    facts.push({ lane: 'pace', text: `Pace in the displayed range in ${pct(f)} of retained speech samples`, value: f });
    if (f >= 0.6) worked.push({ lane: 'pace', text: `Pace stayed in the displayed range in ${pct(f)} of retained speech samples.`, at: longestRun(samples, (s) => s.scores?.pace != null && s.scores.pace >= 7 && s.scores.pace <= 8.5)?.startT ?? null });
    else { const fast = longestRun(samples, (s) => s.scores?.pace != null && s.scores.pace > 8.5, 3); const slow = longestRun(samples, (s) => s.scores?.pace != null && s.scores.pace < 7, 3); const run = fast || slow; if (run) change.push({ lane: 'pace', text: `Pace left your range for ${Math.round(run.endT - run.startT)} s at ${fmt(run.startT)} (${fast ? 'too fast' : 'too slow'}).`, at: run.startT, priority: 0.8 }); }
  }
  const volMeasured = dwell(samples, (s) => s.scores?.volume != null);
  if (volMeasured.count >= 6) {
    const low = longestRun(samples, (s) => s.scores?.volume != null && s.scores.volume < 7, 4);
    const inF = dwell(samples, (s) => s.scores?.volume != null && s.scores.volume >= 7).count / volMeasured.count;
    facts.push({ lane: 'volume', text: `Volume in corridor in ${pct(inF)} of retained speech samples`, value: inF });
    if (low) change.push({ lane: 'volume', text: `Volume dropped below your corridor for ${Math.round(low.endT - low.startT)} s at ${fmt(low.startT)}.`, at: low.startT, priority: 0.7 });
    else if (inF >= 0.7) worked.push({ lane: 'volume', text: `Volume held in your corridor in ${pct(inF)} of retained speech samples.`, at: samples.find((s) => s.scores?.volume != null)?.t ?? null });
  }
  const varMeasured = dwell(samples, (s) => s.scores?.variety != null);
  if (varMeasured.count >= 6) {
    const v = dwell(samples, (s) => s.scores?.variety != null && s.scores.variety >= 7).count / varMeasured.count;
    facts.push({ lane: 'variety', text: `Vocal variation in the displayed range in ${pct(v)} of retained speech samples`, value: v });
    if (v < 0.5) { const flat = longestRun(samples, (s) => s.scores?.variety != null && s.scores.variety < 7, 6); if (flat) change.push({ lane: 'variety', text: `Delivery went flat for ${Math.round(flat.endT - flat.startT)} s at ${fmt(flat.startT)}: pitch and loudness barely moved.`, at: flat.startT, priority: 0.6 }); }
    else worked.push({ lane: 'variety', text: `Vocal variation stayed in the displayed range in ${pct(v)} of retained speech samples.`, at: null });
  }
  const handsNone = dwell(answering, (s) => s.hands === 'NONE');
  if (handsNone.total >= 6) {
    facts.push({ lane: 'hands', text: `Hands out of view in ${pct(handsNone.fraction)} of retained answering samples`, value: handsNone.fraction });
    if (handsNone.fraction > 0.35) { const run = longestRun(answering, (s) => s.hands === 'NONE', 5); change.push({ lane: 'hands', text: `Hands were out of view in ${pct(handsNone.fraction)} of retained answering samples${run ? `, longest at ${fmt(run.startT)}` : ''}.`, at: run?.startT ?? null, priority: 0.5 }); }
    else if (handsNone.fraction < 0.15) worked.push({ lane: 'hands', text: `Hands stayed visible while you answered (${pct(1 - handsNone.fraction)}).`, at: null });
  }
  const smiles = events.filter((e) => e.kind === 'smile'); const listeningSmiles = smiles.filter((e) => e.state === 'LISTENING').length;
  if (samples.some((s) => Number.isFinite(s.smiles))) {
    facts.push({ lane: 'smiles', text: `${smiles.length} smile patterns (${listeningSmiles} while listening)`, value: smiles.length });
    if (smiles.length === 0 && answering.length > 20) change.push({ lane: 'smiles', text: 'No qualifying smile pattern was observed. Try one while the interviewer is asking.', at: null, priority: 0.4 });
    else if (smiles.length) worked.push({ lane: 'smiles', text: `${smiles.length} smile pattern${smiles.length > 1 ? 's' : ''} observed${listeningSmiles ? `, ${listeningSmiles} while listening` : ''}.`, at: smiles[0].t });
  }
  const gestures = events.filter((e) => e.kind === 'gesture');
  if (gestures.length) worked.push({ lane: 'gestures', text: `${gestures.length} gesture units while answering.`, at: gestures[0].t });
  const gaps = intervalRuns(samples, 'signalGap').filter((r) => r.value === true);
  if (gaps.length) facts.push({ lane: 'gaps', text: `${gaps.length} signal gap${gaps.length > 1 ? 's' : ''} (no evidence during those intervals)`, value: gaps.length });
  change.sort((a, b) => b.priority - a.priority);
  const theOne = change[0] || null;
  // Transcript-derived (deterministic): filler, length.
  const applicant = (attempt.turns || []).filter((t) => t.speaker === 'applicant');
  const words = applicant.reduce((n, t) => n + t.text.split(/\s+/).filter(Boolean).length, 0);
  const fillers = applicant.reduce((n, t) => n + (t.text.match(/\b(um|uh|like|you know|i mean|sort of|kind of)\b/gi) || []).length, 0);
  if (words > 40 && fillers / words > 0.06) change.push({ lane: 'transcript', text: `${fillers} possible filler-token matches in ${words} transcript words (lexical count, not a judgment of each use). Try a deliberate pause.`, at: null, priority: 0.45 });
  return { worked: worked.slice(0, 3), change: theOne ? [theOne] : change.slice(0, 1), facts, allChange: change };
}

export function hookLedger(conductorSnapshot) {
  const hooks = conductorSnapshot?.hooks || [];
  return hooks.filter((h) => h.span).map((h) => ({
    questionId: h.questionId, span: h.span, category: h.category, decision: h.decision, blockedBy: h.blockedBy,
    taken: h.bitTaken === true, attempted: h.decision === 'FOLLOW_HOOK' || h.bitTaken === true, followUp: h.followUp,
    verdict: h.decision === 'OBSERVED' ? (h.bitTaken === true ? 'Follow-up observed in the conversation transcript' : h.bitTaken === false ? 'Hook logged; no matching follow-up observed' : 'Hook logged; follow-up not yet verified') : h.decision === 'FOLLOW_HOOK' ? (h.bitTaken ? 'Interviewer took it' : h.bitTaken === false ? 'Follow-up sent, interviewer did not take it' : 'Follow-up sent') : h.blockedBy === 'DEPTH' ? 'Good hook, follow-up budget already used on this question' : h.blockedBy === 'TIME' ? 'Good hook, closing reserve reached' : h.blockedBy === 'PHASE' ? 'Logged during closing, not followed' : h.decision === 'PROBE_VAGUE' ? 'Vague claim, interviewer asked for an example' : h.decision === 'CLARIFY_CONTRADICTION' ? 'Contradiction, interviewer asked you to reconcile' : 'Not strong enough to follow',
  }));
}

export function closingLedger(snapshot) {
  if (!snapshot) return { status: 'n/a', label: 'Practice rep (no interviewer)' };
  const c = snapshot.closing || {};
  if (c.skipped) return { status: 'skipped', label: `Skipped: ${c.reason === 'student_hard_stop' ? 'you left before the close' : c.reason}` };
  if (!c.reached) return { status: 'none', label: 'Closing not reached' };
  const delivery = c.delivery === 'observed_transcript' ? 'Closing observed in transcript; audibility requires replay' : c.delivery === 'local_fallback' ? 'Delivered locally (interviewer connection failed)' : c.delivery === 'unverified' ? 'Invite sent, delivery unverified' : 'Delivered';
  return { status: c.delivery === 'local_fallback' ? 'local' : 'delivered', label: delivery, candidateQuestions: (c.candidateQuestions || []).length, closeDelivered: snapshot.closeSent > 0 };
}

// Practice coverage, not an inferred mastery/readiness or "priority cleared" score.
export function masteryState(attempts, questionId, nowMs = Date.now()) {
  const mine = attempts.filter((a) => a.questionId === questionId && Number.isFinite(a.at)).sort((a, b) => a.at - b.at);
  if (!mine.length) return { state: 'Unpracticed', reps: 0, segments: 0 };
  if (nowMs - mine[mine.length - 1].at > 21 * 86_400_000) return { state: 'Not recent', reps: mine.length, segments: Math.min(4, mine.length) };
  if (mine.length === 1) return { state: 'Attempted', reps: 1, segments: 1 };
  return { state: 'Rehearsed', reps: mine.length, segments: Math.min(4, mine.length) };
}

export function streak(attempts, nowMs = Date.now()) {
  const days = new Set(attempts.map((a) => new Date(a.at).toDateString()));
  let count = 0; const d = new Date(nowMs);
  for (;;) { if (!days.has(d.toDateString())) { if (count === 0 && days.has(new Date(nowMs - 86_400_000).toDateString())) { d.setDate(d.getDate() - 1); continue; } break; } count += 1; d.setDate(d.getDate() - 1); }
  return count;
}

export function compareAttempts(a, b) {
  if (!a || !b) return null;
  const da = deriveDebrief(a); const db = deriveDebrief(b);
  const laneA = da.change[0]?.lane || null; const laneB = db.change[0]?.lane || null;
  const headline = !laneA && !laneB ? 'Nothing to change in either rep' : laneA && !laneB ? 'Priority cleared' : laneA === laneB ? 'Same priority' : laneA && laneB ? 'New priority' : 'New priority';
  const rows = [];
  for (const fact of da.facts) {
    const other = db.facts.find((f) => f.lane === fact.lane);
    if (!other) continue;
    const delta = (other.value ?? 0) - (fact.value ?? 0);
    const higherIsBetter = ['pace', 'volume', 'variety', 'smiles', 'gestures'].includes(fact.lane);
    const eps = ['smiles', 'gestures', 'gaps'].includes(fact.lane) ? 0.5 : 0.02;
    const better = Math.abs(delta) <= eps ? null : higherIsBetter ? delta > 0 : delta < 0;
    rows.push({ lane: fact.lane, before: fact.text, after: other.text, delta, better });
  }
  return { headline, laneA, laneB, rows, durationDeltaS: Math.round((b.durationS || 0) - (a.durationS || 0)) };
}
