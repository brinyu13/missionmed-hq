import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.resolve(__dirname, '../public/mmc-private/src/app.js');
const indexPath = path.resolve(__dirname, '../public/mmc-private/index.html');
const source = readFileSync(appPath, 'utf8');
const indexHtml = readFileSync(indexPath, 'utf8');

const openProfile = source.match(/function openProfile\(id\) \{[\s\S]*?\n\}/u)?.[0] || '';
assert.ok(openProfile, 'openProfile implementation must exist.');
assert.match(openProfile, /activePrepStudent = id;/u, 'Profile selection must update call-prep selection.');
assert.match(openProfile, /activeMeetingStudent = id;/u, 'Profile selection must update Meeting Intelligence selection.');

assert.match(
  source,
  /if \(id === 'memory'\) renderMemoryContent\(activePrepStudent\);/u,
  'Entering Mentor Memory must rerender the complete selected-student briefing.',
);
assert.doesNotMatch(
  source,
  /if \(id === 'memory'\) renderFocusView\(activePrepStudent\);/u,
  'Mentor Memory navigation must not refresh only the focus card and leave stale details below it.',
);
assert.match(
  source,
  /chip\.classList\.toggle\('active', chip\.dataset\.memoryStudent === studentId\);/u,
  'Mentor Memory must keep the visible student selector aligned with the rendered briefing.',
);
assert.equal(
  [...indexHtml.matchAll(/data-memory-student="[^"]+"/gu)].length,
  5,
  'Every Mentor Memory fixture selector must expose its student identity for state synchronization.',
);
assert.match(
  source,
  /notes\.value = `Opening check-in started for \$\{student\.name\}/u,
  'Session notes must initialize from the selected student rather than a fixed fixture identity.',
);
assert.doesNotMatch(
  indexHtml,
  /Opening check-in complete\. Amara/u,
  'Session Command must not ship an Amara-specific note into every selected student session.',
);

console.log('MMC selected-student continuity validation passed.');
