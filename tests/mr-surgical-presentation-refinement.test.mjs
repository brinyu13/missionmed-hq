import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, resolve} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const path='wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive';
const read=file=>readFileSync(join(root,file));
const js=read(`${path}/scripts/site.js`).toString('utf8');
const css=read(`${path}/styles/site.css`).toString('utf8');
const sha=file=>createHash('sha256').update(read(file)).digest('hex');

test('Founder-authorized hero message preserves the montage architecture',()=>{
  for(const text of [
    'student-celebrate-v2.webp',
    'YOU EARNED THE INTERVIEW.',
    "NOW LET'S TURN IT INTO A MATCH.",
    'Build the communication, story and connection skills that programs experience when they meet you.'
  ]) assert.ok(js.includes(text),text);
  assert.ok(!js.includes('Train before<br><em>the interview'));
});

test('Founder portraits and verified alumni authority are exact',()=>{
  assert.equal(sha(`${path}/assets/marian-ghaly-founder.png`),'25939ff9a10a9d119c4d6978b1177b7d79f3706500c007d8fa7fa17e1d4d09a4');
  assert.equal(sha(`${path}/assets/manasa-kandula-founder.avif`),'a0ca11c53529a99a0880f93703e5a74dbd0ca558e3633099f2fc667f18cfaf72');
  for(const text of [
    "role:'Assistant Program Director'",
    "institution:'St Joseph’s Paterson, Family Medicine'",
    "role:'Associate Program Director'",
    "institution:'Internal Medicine Residency, University of Illinois College of Medicine Peoria'",
    'You made me fall in love with my own story and believe that my dreams are valid against all Odds.',
    'Once your session is done, you will know exactly how to approach any interview question.'
  ]) assert.ok(js.includes(text),text);
});

test('editorial alumni break and clean enrollment close are contrast-safe',()=>{
  for(const token of [
    '.alumni{position:relative;isolation:isolate;overflow:hidden;background:#f7f3e9;color:#1b2a31}',
    '.closing{background:#fbfaf7;color:#17272f;text-align:center}',
    '.closing .button{background:#17272f;border-color:#17272f;color:#fff}',
    '.decide-option{display:flex;flex-direction:column'
  ]) assert.ok(css.includes(token),token);
  for(const text of ['Standalone / Focused program','Recommended / Full season','final interviews in February','Complete includes Interview Bootcamp Week']) assert.ok(js.includes(text),text);
});

test('scroll depth is bounded, mobile-safe and reduced-motion-safe',()=>{
  for(const token of ['parallax-media','Math.min(24','innerWidth>820',"setProperty('--parallax-y','0px')"]) assert.ok(js.includes(token),token);
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
  assert.ok(css.includes('.parallax-media{transform:none!important;will-change:auto!important}'));
  assert.ok(css.includes('.alumni-portrait img{height:100%;transform:none!important;will-change:auto}'));
});
