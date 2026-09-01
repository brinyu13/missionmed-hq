import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('FAC-02B Pace remains a full analog speedometer at compact viewport heights', async () => {
  const live = await source('public/ivoc-standalone/app/live.mjs');
  const css = await source('public/ivoc-standalone/styles/cockpit.css');

  assert.match(live, /class="speed-dial"/u);
  assert.match(live, /class="speed-rim"/u);
  assert.match(live, /class="speed-needle"/u);
  assert.match(live, /viewBox="0 0 320 120"/u);
  for (const value of [...live.matchAll(/class="speed-(?:tick|hub|hub-outer|label[^" ]*|hold-label)"[^>]*\b(?:y|y1|y2|cy)="([\d.]+)"/gu)].map(match => Number(match[1]))) {
    assert(value <= 120, `speedometer y geometry ${value} must remain inside its 120px viewBox`);
  }
  assert.match(live, /SLOW[\s\S]*TARGET ZONE[\s\S]*FAST/u);
  assert.match(live, /-90 \+ nn \* 180/u);
  assert.match(live, /targetStartTick/u);
  assert.match(css, /\.speedometer\s*\{[\s\S]*height:\s*104px[\s\S]*overflow:\s*visible/u);
  assert.match(css, /@media \(max-height: 830px\)[\s\S]*\.speedometer\s*\{\s*height:\s*76px;\s*min-height:\s*76px;/u);
  assert.doesNotMatch(css, /\.speed-arc[\s\S]*scale\(\.5\)/u);
});

test('FAC-02B Pace needle eases between genuine two-second rolling timed-word windows without fabricating WPM', async () => {
  const live = await source('public/ivoc-standalone/app/live.mjs');
  const css = await source('public/ivoc-standalone/styles/cockpit.css');

  assert.match(live, /two-second rolling transcript-timing/u);
  assert.match(live, /last validated 5–10 words/u);
  assert.match(live, /live rolling 5–10 words/u);
  assert.match(live, /ins\.id === 'pace' \? 'WPM'/u);
  assert.match(live, /const held = liveNorm == null && heldNorm != null/u);
  assert.match(live, /classList\.toggle\('observed', liveNorm != null\)/u);
  assert.match(live, /classList\.toggle\('held', held\)/u);
  assert.match(css, /\.speedometer\.held \.speed-hold-label \{ display: block; \}/u);
  assert.match(css, /#inst-pace \.inst-tech \{ display: block;/u);
  assert.match(css, /transition:\s*transform 560ms cubic-bezier/u);
  assert.match(css, /prefers-reduced-motion:\s*reduce/u);
});

test('FAC-02B Pitch piano heat maps validated voiced occupancy without treating frequency as quality', async () => {
  const live = await source('public/ivoc-standalone/app/live.mjs');
  const css = await source('public/ivoc-standalone/styles/cockpit.css');

  assert.match(live, /Pitch zone \$\{i \+ 1\}: \$\{count\} validated voiced sample/u);
  assert.match(live, /point\.pitch \* 14/u);
  assert.match(live, /KEY HEAT = VOICED OCCUPANCY · LINE = YOUR MEDIAN/u);
  assert.match(live, /heat-low/u);
  assert.match(live, /heat-medium/u);
  assert.match(live, /heat-high/u);
  assert.match(css, /\.pk-w\.heat-low\s*\{\s*fill:\s*#c84b54/u);
  assert.match(css, /\.pk-w\.heat-medium\s*\{\s*fill:\s*#e58b2d/u);
  assert.match(css, /\.pk-w\.heat-high\s*\{\s*fill:\s*#42c889/u);
});
