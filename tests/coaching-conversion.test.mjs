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
function mmed_staff_coaching_catalog(){return ['single'=>['name'=>'Single Signature Mock','regular'=>39900,'promo'=>24900,'services'=>'One 105-minute Signature Mock: 15 minutes of simulated interview followed by 90 minutes of individualized evaluation and correction.'], 'three'=>['name'=>'Three Signature Mocks','regular'=>109900,'promo'=>74900,'services'=>'Three 105-minute Signature Mocks, one two-hour private strategy session before the first mock, and two 45-minute post-interview debriefs.'], 'five'=>['name'=>'Five Signature Mocks','regular'=>179900,'promo'=>119900,'services'=>'Five 105-minute Signature Mocks, one two-hour private strategy session before the first mock, and three 45-minute post-interview debriefs.'], 'emergency'=>['name'=>'Emergency Interview Intensive','regular'=>399900,'promo'=>249900,'services'=>'One eight-hour private training day with Dr Brian, including one 105-minute Signature Mock, plus two separate 105-minute follow-up mocks and one additional 45-minute post-interview debrief.']];}
require '${directory}StaffCoachingLanding.php';echo mmed_staff_coaching_landing();`;
const render=env=>execFileSync('php',['-r',harness],{encoding:'utf8',env:{...process.env,...env}});
test('Concept1 three-card hierarchy preserves four honest offers and explicit native product choices',()=>{
 const html=render({});
 for(const value of ['$249','$749','$1,199','$2,499','$399','$1,099','$1,799','$3,999','Save $150','Save $350','Save $600','Save $1,500'])assert.ok(html.includes(value),value);
 for(const value of ['15-minute mock','90 minutes of individualized evaluation','two-hour private strategy session before your first mock','2 × 45-minute post-real-interview debriefs','3 × 45-minute post-real-interview debriefs','One eight-hour private training day with Dr Brian','two separate 105-minute follow-up mocks','one additional 45-minute post-interview debrief'])assert.ok(html.includes(value),value);
 assert.equal((html.match(/class="mm-coaching-card(?: mm-coaching-featured)?"/g)||[]).length,3);
 assert.equal((html.match(/href="https:\/\/missionmedinstitute.com\/product\//g)||[]).length,3);
 assert.doesNotMatch(html,/href="[^"]*emergency-interview-intensive\/"|Most Popular|first 20|<del|was \$/i);
 assert.match(html,/Most Flexible/);assert.match(html,/intended future standard prices, not previously charged prices/);
 assert.match(html,/No payment is taken with a request/);assert.match(html,/does not grant automatic Matrix or replay access/);
 assert.match(html,/Real Practice\.<br>Real Feedback\.<br>Real Results\./);
 assert.match(html,/Live, 1:1 online sessions built around your background, your specialty, and your goals/);
 assert.match(html,/<details id="coaching-package-choices"/);
 assert.match(html,/href="#coaching-package-choices" data-coaching-choose/);
 assert.match(html,/Illustrative virtual coaching scene; not an actual student session/);
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
   const context={window:{},document:{querySelector:q=>{assert.equal(q,'#private-coaching');return {querySelector:k=>nodes[k]};}},navigator:{clipboard:{writeText:async value=>{if(fail)throw Error('denied');copied=value;}}}};
   vm.runInNewContext(behavior,context);await listener();assert.equal(button.disabled,false);
   if(fail){assert.equal(copied,'');assert.match(status.textContent,/Select and copy/);}else{assert.equal(copied,'MATCHREADY2026');assert.match(status.textContent,/Code copied/);}
 }
 assert.doesNotMatch(behavior,/fetch\(|localStorage|gtag|\.cl1403c-a-hero/);
});
test('One illustrative responsive photo is decorative, lazy and dimensioned; entire main page remains exact',()=>{
 const html=render({});
 assert.equal((html.match(/data-coaching-depth aria-hidden="true"/g)||[]).length,1);
 assert.equal((html.match(/class="mm-coaching-scene"[^>]*><img[^>]*loading="lazy"[^>]*alt=""/g)||[]).length,1);
 for(const image of html.matchAll(/class="mm-coaching-scene"[^>]*><img([^>]+)>/g)){
   assert.match(image[1],/width="\d+" height="\d+"/);
   assert.match(image[1],/src="\/wp-content\//);
 }
 assert.equal(page,execFileSync('git',['show','23978941d8bbd6355c3e3edd2c62b23de602da59:'+directory+'page.php'],{encoding:'utf8'}));
 for(const width of [640,960,1600]){
   assert.ok(readFileSync(directory+'media/coaching-virtual-desk-'+width+'.webp').length<150000);
   assert.match(html,new RegExp('coaching-virtual-desk-'+width+'\\.webp '+width+'w'));
 }
 assert.doesNotMatch(behavior,/setInterval|setTimeout|location\.assign|\.hero/);
});
test('Package chooser opens explicit three/five choices without payment, synthetic selection or navigation interception',()=>{
 let click,hashChange,focused=false;const choices={tagName:'DETAILS',open:false,querySelector:()=>({focus:()=>{focused=true;}})};
 const trigger={addEventListener:(event,fn)=>{assert.equal(event,'click');click=fn;}};
 const section={querySelector:key=>key==='[data-coaching-choose]'?trigger:key==='#coaching-package-choices'?choices:null};
 const context={document:{querySelector:()=>section},window:{addEventListener:(event,fn)=>{assert.equal(event,'hashchange');hashChange=fn;}},location:{hash:''}};
 vm.runInNewContext(behavior,context);
 click({button:0,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false});
 assert.equal(choices.open,true);assert.equal(focused,true);
 choices.open=false;focused=false;click({button:0,ctrlKey:true});assert.equal(choices.open,false);assert.equal(focused,false);
 context.location.hash='#coaching-package-choices';hashChange();assert.equal(choices.open,true);
 assert.doesNotMatch(behavior,/preventDefault|add-to-cart|payment_complete|\.submit\(/);
});
test('Depth is bounded, scroll-driven, pausable, hidden-tab safe and disabled on mobile/reduced motion',()=>{
 const styles=new Map();const callbacks={};const classes=new Set();let intersection,rootChange,paint;
 const photo={classList:{contains:()=>false},getBoundingClientRect:()=>({top:100,height:224}),style:{setProperty:(key,value)=>styles.set(key,value)}};
 const media={reduce:{matches:false,addEventListener:(_,fn)=>{callbacks.reduce=fn;}},desktop:{matches:true,addEventListener:(_,fn)=>{callbacks.desktop=fn;}}};
 const section={dataset:{},querySelector:()=>null,querySelectorAll:()=>[photo]};
 const document={hidden:false,documentElement:{classList:{contains:key=>classes.has(key)}},querySelector:()=>section,addEventListener:(event,fn)=>{callbacks[event]=fn;}};
 class Intersection{constructor(fn){intersection=fn;}observe(){}}
 class Mutation{constructor(fn){rootChange=fn;}observe(){}}
 const context={document,window:{IntersectionObserver:Intersection,MutationObserver:Mutation,addEventListener:(event,fn)=>{callbacks[event]=fn;}},IntersectionObserver:Intersection,MutationObserver:Mutation,matchMedia:q=>q.includes('reduced')?media.reduce:media.desktop,innerHeight:900,requestAnimationFrame:fn=>{paint=fn;return 1;},cancelAnimationFrame:()=>{paint=null;}};
 vm.runInNewContext(behavior,context);
 intersection([{target:photo,isIntersecting:true}]);paint();
 assert.equal(section.dataset.coachingMotion,'active');assert.ok(Math.abs(Number(styles.get('--mm-coaching-depth').replace('px','')))<=22);
 classes.add('mm-motion-paused');rootChange();assert.equal(section.dataset.coachingMotion,'paused');assert.equal(styles.get('--mm-coaching-depth'),'0px');
 classes.clear();rootChange();paint();assert.equal(section.dataset.coachingMotion,'active');
 media.reduce.matches=true;callbacks.reduce();assert.equal(styles.get('--mm-coaching-depth'),'0px');assert.equal(section.dataset.coachingMotion,'paused');
 media.reduce.matches=false;media.desktop.matches=false;callbacks.desktop();assert.equal(section.dataset.coachingMotion,'paused');
 media.desktop.matches=true;document.hidden=true;callbacks.visibilitychange();assert.equal(section.dataset.coachingMotion,'paused');
 assert.match(css,/@media\(max-width:1024px\),\(prefers-reduced-motion:reduce\)/);
});
