import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const php=readFileSync(resolve(root,'wp-content/mu-plugins/missionmed-mr-p0.php'),'utf8');
const js=readFileSync(resolve(root,'wp-content/mu-plugins/missionmed-mr-0912-assets/premium-hero/hero.js'),'utf8');
const css=readFileSync(resolve(root,'wp-content/mu-plugins/missionmed-mr-0912-assets/premium-hero/hero.css'),'utf8');
const frames=php.slice(php.indexOf('function mm_mr_0929_home_hero_frames()'),php.indexOf('function mm_mr_0929_division_showcase_markup()'));
const markup=php.slice(php.indexOf('function mm_mr_0929_home_hero_markup()'),php.indexOf('// Autoptimize loads its aggregate styles'));

test('the approved eight-frame order and MATCHED opening are restored',()=>{
 assert.deepEqual([...frames.matchAll(/\['id'=>'([^']+)'/g)].map(m=>m[1]),['mr-application','exam-live','mr-communication','usce-fit','mr-ranking','exam-reasoning','mr-story','usce-pathway']);
 assert.match(frames,/YOU BUILT THE APPLICATION/);
 assert.match(frames,/INTO A MATCH\./);
 assert.match(markup,/data-theme=\"destination\" data-visual=\"physician\"/);
 assert.match(markup,/width=\"1277\" height=\"473\" fetchpriority=\"high\"/);
 assert.match(js,/if\(frames\.length!==8\)return/);
 assert.doesNotMatch(frames,/mr-testimonials|frame-marian-aaa\.jpg/);
 assert.doesNotMatch(css,/data-theme=\"testimonials\"/);
});

test('two Hero destinations preserve enrollment and add the verified Student Stories page',()=>{
 assert.match(frames,/Explore Interview Bootcamp Week/);
 assert.match(markup,/class=\"mm-ph__cta\" data-cta/);
 assert.match(markup,/class=\"mm-ph__testimonial-cta\" href=\"' \. esc_url\(home_url\('\/testimonials\/'\)\)/);
 assert.match(markup,/Watch Student Testimonials/);
 assert.match(js,/\.mm-ph__testimonial-cta/);
 assert.match(js,/mm_home_hero_cta/);
});

test('testimonials proof and unrelated homepage integration survive',()=>{
 assert.match(markup,/Dr Marian Ghaly · Mission Residency alumna/);
 assert.match(markup,/reader-embed\.js/);
 assert.match(markup,/mm_mr_0929_division_showcase_markup\(\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(js,/prefers-reduced-motion: reduce/);
});
