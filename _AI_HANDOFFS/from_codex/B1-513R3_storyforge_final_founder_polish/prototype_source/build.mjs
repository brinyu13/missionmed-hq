#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const source = new URL('../../from_fable/B1-513R2_storyforge_v2_final_refinement/B1-513R2_FINAL_WORKING_PROTOTYPE.html', root);
const cssFile = new URL('prototype_source/b1513r3.css', root);
const jsFile = new URL('prototype_source/b1513r3.js', root);
const output = new URL('B1-513R3_FINAL_FOUNDER_APPROVED_PROTOTYPE.html', root);

let html = readFileSync(source, 'utf8');
const css = readFileSync(cssFile, 'utf8');
const js = readFileSync(jsFile, 'utf8');
const styleAnchor = '</head>';
const moduleClose = '\n  </script>\n</body>';
if ((html.match(/<\/head>/g) || []).length !== 1) throw new Error('R3 build: expected one </head> anchor');
if ((html.split(moduleClose).length - 1) !== 1) throw new Error('R3 build: final module anchor missing or ambiguous');
html = html.replace(styleAnchor, `  <style id="b1513r3-founder-polish">\n${css}\n  </style>\n${styleAnchor}`);
html = html.replace(moduleClose, `\n\n/* ===== B1-513R3 FOUNDER POLISH ===== */\n${js}\n${moduleClose}`);
writeFileSync(output, html);
console.log(JSON.stringify({
  output: output.pathname,
  bytes: Buffer.byteLength(html),
  sha256: createHash('sha256').update(html).digest('hex'),
  sourceSha256: createHash('sha256').update(readFileSync(source)).digest('hex'),
}, null, 2));
