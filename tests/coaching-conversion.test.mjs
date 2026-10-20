import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const directory='wp-content/mu-plugins/missionmed-mr-alternate-assets/';
const page=readFileSync(directory+'page.php','utf8');
const previous=execFileSync('git',['show','769bff687782685801c79923da611bbff5f5f800:'+directory+'page.php'],{encoding:'utf8'});
const css=readFileSync(directory+'StaffCoachingLanding.css','utf8');
const behavior=readFileSync(directory+'StaffCoachingConversion.js','utf8');
const section=(text,id)=>text.match(new RegExp('<section\\b[^>]*\\bid="'+id+'"[^>]*>[\\s\\S]*?</section>'))?.[0];
const hero=text=>text.slice(text.indexOf('<section class="cl1403c-a-hero"'),text.indexOf('</section>',text.indexOf('<section class="cl1403c-a-hero"'))+10);
const visualStructure=text=>text.replace(/href="[^"]*"/g,'href="COPY_ONLY"').replace(/>[^<]+</g,'><');
test('Hero structure, classes, image attributes and three CTA slots unchanged',()=>{
 assert.equal(visualStructure(hero(page)),visualStructure(hero(previous)));
 assert.equal((hero(page).match(/<a /g)||[]).length,3);
 assert.match(hero(page),/NOW LET'S MAKE IT COUNT/);
 assert.match(hero(page),/href="#private-coaching"/);
 assert.match(hero(page),/href="\/testimonials\/"/);
 assert.match(hero(page),/href="#coaching-comparison"/);
 assert.doesNotMatch(hero(page),/href="#bootcamp"|href="#complete"/);
});
test('Accepted proof, curriculum and ecosystem sections remain exact',()=>{
 for(const id of ['method','evidence','complete','alumni','teacher','story'])assert.equal(section(page,id),section(previous,id),id);
 assert.equal(page.includes("require __DIR__ . '/match-day-player.php'"),true);
 assert.equal((page.match(/echo \$coachingMarkup;/g)||[]).length,1);
 assert.ok(page.indexOf('echo $coachingMarkup;')<page.indexOf('id="bootcamp"'));
 assert.doesNotMatch(page,/href="\/product\/iv-prep-masterclass\//);
 assert.match(page,/href="\/product\/match-prep-pro\//);
 assert.match(page,/live cohort has concluded|live Bootcamp has ended/);
});
const harness=`function mmed_staff_coaching_config(){return ['enabled'=>getenv('CONVERSION_DISABLED')!=='1','product_ids'=>['single'=>9548,'three'=>9549,'five'=>9550,'emergency'=>9551]];}
function mmed_staff_coaching_ready($s){return in_array($s,['single','three','five'],true);}
function get_permalink($id){return 'https://missionmedinstitute.com/product/'.[9548=>'single-signature-mock',9549=>'three-signature-mocks',9550=>'five-signature-mocks',9551=>'emergency-interview-intensive'][$id].'/';}
function mmed_staff_coaching_catalog(){return ['single'=>['name'=>'Single Signature Mock','regular'=>39900,'promo'=>24900,'services'=>'Single'], 'three'=>['name'=>'Three Signature Mocks','regular'=>109900,'promo'=>74900,'services'=>'Three'], 'five'=>['name'=>'Five Signature Mocks','regular'=>179900,'promo'=>119900,'services'=>'Five'], 'emergency'=>['name'=>'Emergency Interview Intensive','regular'=>399900,'promo'=>249900,'services'=>'Emergency']];}
require '${directory}StaffCoachingLanding.php';echo mmed_staff_coaching_landing();`;
const render=env=>execFileSync('php',['-r',harness],{encoding:'utf8',env:{...process.env,...env}});
test('Four honest offers, approved service facts, savings and request-first Emergency',()=>{
 const html=render({});
 for(const value of ['$249','$749','$1,199','$2,499','$399','$1,099','$1,799','$3,999','Save $150','Save $350','Save $600','Save $1,500'])assert.ok(html.includes(value),value);
 for(const value of ['15-minute realistic interview','90-minute individualized evaluation','2-hour private strategy session before your first mock','2 × 45-minute post-real-interview debriefs','3 × 45-minute post-real-interview debriefs','8-hour private day, including 1 Signature Mock','2 separate 105-minute follow-up mocks','1 × 45-minute post-real-interview debrief'])assert.ok(html.includes(value),value);
 assert.equal((html.match(/aria-labelledby="staff-coaching-/g)||[]).length,4);
 assert.equal((html.match(/scope="col"/g)||[]).length,5);
 assert.equal((html.match(/href="https:\/\/missionmedinstitute.com\/product\//g)||[]).length,6);
 assert.doesNotMatch(html,/href="[^"]*emergency-interview-intensive\/"|Most Popular|first 20|<del|was \$/i);
 assert.match(html,/Recommended/);assert.match(html,/intended future prices, not previously charged prices/);
 assert.match(html,/No payment with a request/);assert.match(html,/does not grant automatic Matrix or replay access/);
 assert.match(html,/id="coaching-comparison"/);assert.match(html,/data-coaching-copy-status[^>]*role="status"/);
 assert.equal(new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1])).size,[...html.matchAll(/\bid="([^"]+)"/g)].length);
 assert.equal(render({CONVERSION_DISABLED:'1'}),'');
});
test('All new styling remains scoped outside the Hero with readable text and reduced-motion fallback',()=>{
 for(const group of css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{/g)){
   const selectors=group[1].trim();if(selectors.startsWith('@'))continue;
   for(const selector of selectors.split(','))assert.ok(/^(#private-coaching\b|\.mm-staff-coaching-announcement\b)/.test(selector.trim()),selector);
 }
 assert.doesNotMatch(css,/cl1403c-a-hero|mm-alt-hero-img|mm-alt-actions/);
 for(const m of css.matchAll(/font(?:-size)?:[^;{}]*?(\d+(?:\.\d+)?)px/g))assert.ok(Number(m[1])>=12,m[0]);
 assert.match(css,/prefers-reduced-motion/);assert.match(css,/:focus-visible/);
});
test('Coupon interaction copies exact code and fails truthfully without network or Hero writes',async()=>{
 for(const fail of [false,true]){
   let listener;let copied='';const status={textContent:''};const button={disabled:false,addEventListener:(event,fn)=>{assert.equal(event,'click');listener=fn;}};
   const code={textContent:'MATCHREADY2026'};const nodes={'[data-coaching-copy]':button,'[data-coaching-code]':code,'[data-coaching-copy-status]':status};
   const context={document:{querySelector:q=>{assert.equal(q,'#private-coaching');return {querySelector:k=>nodes[k]};}},navigator:{clipboard:{writeText:async value=>{if(fail)throw Error('denied');copied=value;}}}};
   vm.runInNewContext(behavior,context);await listener();assert.equal(button.disabled,false);
   if(fail){assert.equal(copied,'');assert.match(status.textContent,/Select and copy/);}else{assert.equal(copied,'MATCHREADY2026');assert.match(status.textContent,/Code copied/);}
 }
 assert.doesNotMatch(behavior,/fetch\(|localStorage|gtag|\.cl1403c-a-hero/);
});
