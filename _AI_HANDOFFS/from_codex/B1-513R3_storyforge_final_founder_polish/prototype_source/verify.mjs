#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const file = new URL('../B1-513R3_FINAL_FOUNDER_APPROVED_PROTOTYPE.html', import.meta.url);
const html = readFileSync(file, 'utf8');
const checks = [
  ['R2 source retained', html.includes('B1-513R2_FINAL_WORKING_PROTOTYPE') || html.includes('B1-513R2')],
  ['R3 authority marker', html.includes("authority: Object.freeze(['DR-040','DR-041'])")],
  ['Premium recommends module', html.includes('b1513r3Recommends') && html.includes('Dr Brian <em>Recommends</em>')],
  ['Full-width Home HUD', html.includes('b1513r3Hud') && html.includes('Where your stories <em>stand</em>')],
  ['Status filtering preserved', html.includes('data-library-status=')],
  ['Student transcript surface', html.includes('Readable transcript')],
  ['Original mentor audio surface', html.includes('Listen to original voice') && html.includes('data-play-mentor-note=')],
  ['Editable mentor transcript', html.includes('Editable transcript or typed feedback') && html.includes('id="mentorNoteText"')],
  ['Existing record pipeline reused', html.includes('data-record-mentor-note') && html.includes('toggleMentorNoteRecording')],
  ['Pause and resume controls', html.includes('data-b1513r3-mentor-pause') && html.includes('data-b1513r3-mentor-resume')],
  ['Private admin note boundary', html.includes('Private admin note') && html.includes('never shown to student')],
  ['Consent accept hook preserved', html.includes('data-b1513-consent-accept')],
  ['Consent private option preserved', html.includes('data-b1513-consent-defer') && html.includes('Not now — keep everything private')],
  ['Post-consent default accurately stated', html.includes('only new stories default to Mentor Visible')],
  ['Historical V1 no-widening stated', html.includes('Historical V1 stories are never silently widened')],
  ['Visibility and submission separated', html.includes('Mentor visibility and formal submission are separate choices')],
  ['Reduced motion supported', html.includes('@media (prefers-reduced-motion:reduce)')],
  ['Responsive mobile supported', html.includes('@media (max-width:640px)')],
  ['R3 API exposed', html.includes('window.__B1513R3')],
  ['Single HTML document', (html.match(/<!doctype html>/gi) || []).length === 1 && (html.match(/<\/html>/gi) || []).length === 1],
];
const failed = checks.filter(([, pass]) => !pass);
console.log(`R3 FOCUSED CHECKS: ${checks.length - failed.length}/${checks.length} PASS`);
checks.forEach(([name, pass]) => console.log(` ${pass ? '✓' : '✗'} ${name}`));
process.exit(failed.length ? 1 : 0);
