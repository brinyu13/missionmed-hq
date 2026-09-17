/* B creative composition integrated with current production controls. */
document.addEventListener('mr-b-ready', () => {
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const asset='/wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/';
const ev=window.MRBtrack;
const picture=(name,alt,cls='')=>`<img src="${asset}${name}" alt="${alt}" class="${cls}" loading="lazy" decoding="async">`;
const eyebrow=t=>`<p class="eyebrow">${t}</p>`;
const quotes=[
 {id:'Q01',name:'Marian',quote:'You made me fall in love with my story.'},
 {id:'Q02',name:'Chelsey & Danny',quote:"You make a difference in people's life."},
 {id:'Q03',name:'Yamini',quote:'You gave me voice to express myself.'},
 {id:'Q04',name:'Gunjan',quote:'This is the best feeling right now.'},
 {id:'Q05',name:'Sana',quote:'Being persistent and just trying harder... it does pay off.'},
 {id:'Q06',name:'Maisha',quote:'Coming up to you was one of the best decisions in my life.'},
 {id:'Q07',name:'Maksura',quote:'It feels like I belong to somewhere.'},
 {id:'Q08',name:'Mahabuba',quote:'You are the person who gave me the confidence.'}
];
const qstate=[];
function quoteIntro(before,ids,theme){
 const node=document.createElement('aside');node.className='quote-intro';
 node.setAttribute('aria-label',theme+' student voices');node.dataset.section=before;
 node.innerHTML='<p class="quote-theme">'+theme+' <span>· Student voices</span></p><figure><blockquote></blockquote><figcaption></figcaption></figure><div class="quote-controls"><button class="quote-prev" aria-label="Previous quote">←</button><span class="quote-count"></span><button class="quote-next" aria-label="Next quote">→</button><button class="quote-pause" aria-pressed="false">Pause</button></div>';
 $(before).before(node);let ix=0,paused=false,hover=false,focused=false,reveal=null;
 const draw=()=>{const q=quotes[ids[ix]];$('blockquote',node).textContent='“'+q.quote+'”';$('figcaption',node).textContent=q.name+' · '+(q.sourceLabel||'MissionMed Match Day');$('.quote-count',node).textContent=(ix+1)+' / '+ids.length;node.dataset.quoteId=q.id};
 const step=n=>{ix=(ix+n+ids.length)%ids.length;draw();reveal?.cancel();if(!document.body.classList.contains('motion-off'))reveal=$('figure',node).animate([{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'translateY(0)'}],{duration:650,easing:'cubic-bezier(.2,.7,.2,1)'})};
 $('.quote-prev',node).onclick=()=>{step(-1);ev('mr_quote_interaction',{section:before,quote_id:node.dataset.quoteId,direction:'previous'})};
 $('.quote-next',node).onclick=()=>{step(1);ev('mr_quote_interaction',{section:before,quote_id:node.dataset.quoteId,direction:'next'})};
 $('.quote-pause',node).onclick=()=>{paused=!paused;$('.quote-pause',node).textContent=paused?'Resume':'Pause';$('.quote-pause',node).setAttribute('aria-pressed',String(paused));ev('mr_quote_interaction',{section:before,action:paused?'pause':'resume'})};
 node.onmouseenter=()=>hover=true;node.onmouseleave=()=>hover=false;
 node.addEventListener('focusin',()=>focused=true);
 node.addEventListener('focusout',e=>focused=!!e.relatedTarget&&node.contains(e.relatedTarget));
 const reserve=()=>{const figure=$('figure',node),probe=figure.cloneNode(true);probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none;min-height:0;width:'+figure.getBoundingClientRect().width+'px';probe.setAttribute('aria-hidden','true');node.append(probe);let height=0;ids.forEach(id=>{const q=quotes[id];$('blockquote',probe).textContent='“'+q.quote+'”';$('figcaption',probe).textContent=q.name+' · '+(q.sourceLabel||'MissionMed Match Day');height=Math.max(height,probe.getBoundingClientRect().height)});probe.remove();figure.style.minHeight=Math.ceil(height)+'px';};
 qstate.push({node,reserve,tick:()=>{if(!paused&&!hover&&!focused&&!document.hidden&&!document.body.classList.contains('motion-off')){const r=node.getBoundingClientRect();if(r.top<innerHeight&&r.bottom>0)step(1)}}});
 draw();
}
$('.brand img').src=asset+'mr-transparent.png';$('.brand>span').textContent='Physician-led preparation from MissionMed Institute';
$('.site-nav nav').insertAdjacentHTML('beforebegin',`<a class="parent-brand" href="https://missionmedinstitute.com/" aria-label="MissionMed Institute">${picture('missionmed-authentic.png','MissionMed Institute')}</a>`);
$('.footer-brand img').src=asset+'missionmed-authentic.png';
$('.hero-background').outerHTML=`<div class="hero-scene"><img class="hero-plane hero-room" src="${asset}hero-brian-photo-composite.png" alt="Dr Brian photo-based composite" fetchpriority="high"><img class="hero-plane hero-person" src="${asset}hero-brian-photo-composite.png" alt="Dr Brian photo-based composite"><img class="hero-plane hero-foreground" src="${asset}hero-brian-photo-composite.png" alt="" aria-hidden="true"></div>`;
$('.hero-b').insertAdjacentHTML('beforeend','<span class="hero-disclosure">Photo-based composite</span>');
$('.hero-copy .actions').insertAdjacentHTML('afterend','<p class="fine">Complete includes Interview Week. No separate Interview Week charge.</p>');
const beats=[
 ['Know what you want to say.','Your experiences are the raw material. Bring program research, personal notes, and a prepared home setup to the conversation.','prepare.jpg','Illustrative applicant preparing personal notes at home'],
 ['Practice how it lands.','Live online training with Dr. Brian. Work on communication and delivery from your own interview setup.','online-class.webp','Authentic published Mission Residency online class'],
 ['Read the person in front of you.','Listen for what the interviewer emphasizes. Adapt your story and delivery to the conversation—not to a memorized script.','online-class.webp','Participants communicating in a live online class'],
 ['Walk into the real interview ready.','Prepare for virtual and in-person formats. Bring clear thinking, a flexible framework, and your authentic voice to either setting.','hero-brian-photo-composite.png','Dr Brian photo-based composite']
];
$$('.chapter').forEach((n,i)=>{$('h2',n).textContent=beats[i][0];$('p:not(.eyebrow)',n).textContent=beats[i][1]});$$('.story-image').forEach((n,i)=>{n.src=asset+beats[i][2];n.alt=beats[i][3]});$('.story-caption').textContent='Primarily live online · Authentic class and illustrative scenes';
const teach=$('.teacher-visual .photo img');teach.src=asset+'online-class.webp';teach.alt='Authentic published Mission Residency online teaching session';$('.teacher .art-label').textContent='Mission Residency · Live online';
$('.teacher-copy>p:not(.eyebrow)').textContent='Before shaping an answer, Dr. Brian learns the person: the experience, the stakes, the strengths, the habits, and the goals behind it. The next practice plan starts with you.';
const bars=Array.from({length:34},(_,i)=>`<i style="--bar:${[20,32,44,60,72,51,37,63,78,55,29][i%11]}%;--delay:${i*.08}s"></i>`).join('');
$('#teacher').insertAdjacentHTML('afterend',`<section class="personalization" id="personalization"><div class="personal-pin"><div class="personal-copy">${eyebrow('THE PERSON + THE COMMUNICATION')}<h2>We learn the person.<br><em>Then we study<br>the communication.</em></h2><p>Your story is more than wording. Your pace, presence, listening, and delivery shape how it lands.</p><p>Technology can support mentor judgment. It should never replace the person who understands your context.</p><details data-new-event="mr_analytics_section_open"><summary>What useful feedback looks like <b>+</b></summary><p>Start with what can be observed: clarity, pacing, camera framing, and how ideas connect. Discuss the context with your mentor, then choose one specific thing to practice. A signal is a prompt for conversation, not a verdict about you.</p></details></div><div class="personal-stage"><img class="mentor-layer personal-layer" src="${asset}brian-real.jpg" alt="Authentic portrait of Dr Brian" loading="lazy"><div class="story-layer personal-layer"><span>YOUR STORY</span><h3>Experience.<br>Meaning.<br>Your voice.</h3><p>What happened? Why did it matter? What do you want them to understand?</p></div><div class="signal-layer personal-layer"><div class="signal-label"><span>DELIVERY FEEDBACK</span><span>LISTEN → REFLECT</span></div><div class="signal-bars" aria-hidden="true">${bars}</div><p>Illustration of delivery feedback—not a student measurement or product result.</p></div></div></div></section>`);
$('#curriculum').insertAdjacentHTML('beforebegin',`<section class="strategy section" id="strategy"><div class="strategy-heading"><div>${eyebrow('A FRAMEWORK, NOT A SCRIPT')}<h2>Don’t memorize the answer.<br><em>Learn how to answer.</em></h2></div><p>A rigid script gives you one route. A bank of meaningful experiences gives you choices. Recognize the question, select the right content, and respond in your own voice.</p></div><div class="pathway-tabs" role="group" aria-label="Explore answer strategy"><button data-pathway="0" aria-pressed="true">Recognize the question</button><button data-pathway="1" aria-pressed="false">Choose your material</button><button data-pathway="2" aria-pressed="false">Adapt the conversation</button></div><div class="pathway-panel" aria-live="polite"><h3></h3><div><p></p><div class="content-paths"></div></div></div><p class="strategy-note">AI can help you brainstorm. A polished sentence is not useful if it is not true to your experience—or if you cannot adapt when the conversation changes.</p></section>`);
const pathways=[['What is being asked?','A question about a difficult moment might be asking about judgment, teamwork, reflection, or growth. Listen before choosing a story.',['Recognition','Purpose','Context']],['Build a bank, not a script.','Dr. Brian’s method can develop 10–20+ content and answer pathways from your truthful experiences. This describes the method, not a promised result. The same experience can support different conversations without becoming a rehearsed monologue.',['Experience','Your contribution','What changed','What you learned']],['Meet the conversation.','Adapt to the interviewer’s role, professional experience, demeanor, conversational style, and emphasis. Stay responsive without guessing from age or gender.',['Listen','Select','Explain','Respond']]];
function setPath(i){const d=pathways[i];$('.pathway-panel h3').textContent=d[0];$('.pathway-panel p').textContent=d[1];$('.content-paths').innerHTML=d[2].map(x=>'<span>'+x+'</span>').join('');$$('[data-pathway]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.pathway===i)))}setPath(0);$$('[data-pathway]').forEach(b=>b.onclick=()=>{setPath(+b.dataset.pathway);ev('mr_no_memorization_engagement',{step:+b.dataset.pathway})});
$('#compare').insertAdjacentHTML('afterend',`<section class="team section" id="team"><div class="team-photo">${picture('online-class.webp','Authentic Mission Residency online class')}</div><div>${eyebrow('PERSONAL ATTENTION. SHARED PRACTICE.')}<h2>Your turn.<br><em>Your team<br>is listening.</em></h2><p>In a team mock, the focus is on you when it is your turn. Dr. Brian analyzes and takes notes while teammates observe using the same framework.</p><details data-new-event="mr_team_model_open"><summary>Why practice together? <b>+</b></summary><p>Your teammates learn the feedback with you. Between sessions, that shared context helps you practice the specific areas Dr. Brian identified. Useful practice needs a framework, informed feedback, and people invested in your progress—not just another person asking questions.</p></details><blockquote class="founder-quote">“You'll start out as classmates that are strangers, then teammates, then friends, and eventually, family.”<cite>— Dr. Brian</cite></blockquote></div></section>`);
$('#team').insertAdjacentHTML('afterend',`<section class="matrix-section section" id="matrix"><div class="matrix-heading"><div>${eyebrow('THE WIDER MISSIONMED ENVIRONMENT')}<h2>A place for the work<br><em>between the sessions.</em></h2></div><p>Your season is more than interview day. Keep your stories, preparation, research, and decisions in view.</p></div><div class="matrix-display"><div class="matrix-device"><div class="matrix-window">${picture('matrix-reference.jpeg','Cropped supplied Matrix interface reference showing app cards')}</div></div><div class="matrix-app-strip" aria-label="Matrix tools"><span>StoryForge</span><span>File Vault</span><span>RISE</span><span>RankList IQ</span></div></div><div class="matrix-foot"><p>MissionMed Matrix connects the wider preparation environment. The tools available to your account depend on your enrollment and current access.</p><details data-new-event="mr_matrix_open"><summary>Where Matrix fits <b>+</b></summary><p>Use your confirmed MissionMed account to see the tools available to you. This overview is not a promise that every pictured app or feature is included in Interview Week or Complete. Check your enrollment details for access.</p></details></div></section>`);
$('.date-content').insertAdjacentHTML('beforeend',`<details class="season-details" data-new-event="mr_complete_schedule_open"><summary>What happens after Interview Week? <b>+</b></summary><p>Complete continues the practice and feedback loop through interview season. Explore the session-day plan, then confirm placement and joining details with Admissions.</p><div class="season-selector" role="group" aria-label="Complete session"><button data-session="A360" aria-pressed="true">A360</button><button data-session="B" aria-pressed="false">B</button><button data-session="C" aria-pressed="false">C</button><button data-session="D" aria-pressed="false">D</button><button data-session="J" aria-pressed="false">J</button></div><div class="season-answer" aria-live="polite"><h3>Session A360 · Mondays</h3><p>Recurring mock/practice weekday. Your enrollment confirmation controls your placement, meeting dates, frequency, and joining details.</p></div><ol class="season-timeline"><li><b>Start together · September 24–October 3</b><span>Orientation plus the five-day Interview Week foundation.</span></li><li><b>Practice → mock → feedback</b><span>Work from the framework. Focus on the individual student during their turn, with teammates learning alongside them.</span></li><li><b>Carry the feedback forward</b><span>Use identified areas in between-session practice. Ask Admissions about your program’s exact debrief and support arrangements.</span></li></ol><p>Have an interview before October 15? Dr. Brian provides interview-specific preparation for Complete students. Contact Admissions promptly to arrange your preparation. Where a later interview date is offered, we generally recommend allowing more preparation time; do not forfeit an opportunity.</p></details>`);
$$('[data-session]').forEach(b=>b.onclick=()=>{const session=b.dataset.session,day=session==='A360'?'Mondays':['B','C'].includes(session)?'Wednesdays':'Fridays';$$('[data-session]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('.season-answer h3').textContent='Session '+session+' · '+day;ev('mr_schedule_session_select',{session,day})});
$('.proof-footer').insertAdjacentHTML('beforebegin',`<div class="match-film"><div class="match-film-grid"><div>${eyebrow('WHEN THE NEWS ARRIVES')}<h3>Not a number.<br><em>A life moving forward.</em></h3><p>Watch Mission Residency’s Match Monday celebration. Individual experiences, never a promise of your outcome.</p></div><div><div class="youtube-frame">${picture('gunjan.jpg','MissionMed Match Day celebration recording')}<button id="play-match-film">Play the Match celebration ▶</button></div><div class="movie-options"><span>Video loads only when you choose to play.</span><a href="https://www.youtube.com/watch?v=SWFzwGD3nZI" target="_blank" rel="noopener">Watch on YouTube ↗</a></div></div></div></div>`);
$('#play-match-film').onclick=()=>{ev('mr_match_video_play_intent',{video_id:'SWFzwGD3nZI'});$('.youtube-frame').innerHTML='<iframe title="Mission Residency Match Monday celebration" src="https://www.youtube-nocookie.com/embed/SWFzwGD3nZI?autoplay=1&playsinline=1&rel=0&enablejsapi=1&origin='+encodeURIComponent(location.origin)+'" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';const stop=document.createElement('button');stop.textContent='Stop and unload video';stop.onclick=()=>{const iframe=$('.youtube-frame iframe');if(iframe)iframe.remove();$('.youtube-frame').textContent='Video stopped. Use the YouTube link to watch again.';stop.remove();ev('mr_match_video_stop')};$('.movie-options').append(stop)};
addEventListener('message',e=>{const frame=$('.youtube-frame iframe');if(!frame||e.source!==frame.contentWindow||!['https://www.youtube-nocookie.com','https://www.youtube.com'].includes(e.origin))return;try{const x=typeof e.data==='string'?JSON.parse(e.data):e.data;if(x.event==='onStateChange'&&x.info===1)ev('mr_match_video_play',{video_id:'SWFzwGD3nZI'})}catch{}});
const faq=[
['What is Interview Week?','IV Prep Essentials: Interview Week is the live foundation: Orientation + Match Primer, then five training days in communication, content, question strategy, formats, virtual and in-person preparation, program research, and interview follow-through. Tuition is $549 by card or $499 by Zelle.'],
['Is the training live online?','Yes. Mission Residency training is primarily live online, using Webex. Prepare a quiet space, reliable connection, camera, and microphone. Your enrollment details provide joining instructions.'],
['What does Complete add?','Complete adds a continued practice, mock, debrief, personalized-feedback, and interview-season support pathway. Your enrollment confirmation controls exact mock arrangements and services.'],
['Does Complete include Interview Week?','Yes. Complete includes Interview Week. You never add a separate Interview Week price to Complete tuition. Choose one program, not both.'],
['Why choose Complete from the start?','Begin with the same foundation and continue into season-long practice and feedback. Early card tuition is $3,099 through September 23, compared with standard tuition of $3,499—a $400 saving. Interview Week is already included.'],
['How do team mocks work?','When it is your turn, the focus is on you. Dr. Brian analyzes and takes notes while teammates observe using the same taught framework. Exact mock arrangements are confirmed with enrollment.'],
['Do I still receive individual attention?','Team format does not mean everyone gives the same answer. The student taking the mock receives the focused analysis. Your experiences and improvement areas shape the feedback.'],
['What happens between Dr. Brian’s mocks?','Teammates can help you practice the specific areas identified in feedback, using the framework and context you have learned together. Confirm your program’s recurring schedule with Admissions.'],
['Why not just find a practice partner online?','A partner can help. The difference is having a shared framework, useful feedback, context about your experiences, and a clear next practice goal.'],
['Do you teach memorized answers?','No. The method develops question recognition, strategy, content, story selection, adaptability, and authentic delivery. Build a bank of truthful experiences rather than a single rigid script.'],
['Can I use AI to write my answers?','AI can support brainstorming, but memorizing polished language that does not sound like you creates another script. Keep the content truthful, personal, and flexible enough for a real conversation.'],
['How are answers personalized?','Dr. Brian learns about the experiences, strengths, challenges, habits, and goals behind your answers. Personal context comes before choosing content and shaping delivery.'],
['What does IV Prep On-Call analyze?','This page does not promise a particular analytics feature or access tier. Ask Admissions which tools are currently available to your account. Technology is intended to support—not replace—mentor feedback.'],
['What is Matrix?','MissionMed’s wider preparation environment. Sign in with your MissionMed account to see your available tools. Pictured tools are not a promise that every app is included in every program.'],
['What if my interview is before October 15?','Dr. Brian provides interview-specific preparation for Complete students with an interview before October 15. Contact Admissions promptly to arrange it. If a later interview date is offered, allowing more time to prepare is generally recommended—not forfeiting an opportunity.'],
['What happens after Interview Week?','Complete students continue the practice and feedback pathway. Explore the Complete schedule above and confirm your session placement and joining details. Interview Week alone is the foundation, without continued Complete support.'],
['Who is this for?','IMGs, Caribbean graduates, U.S. MD and DO students, reapplicants, and strong first-time applicants across specialties. Applicants with complex histories belong here; they are not the only people who benefit from strong communication.'],
['Will these skills help beyond interviews?','The same work on clarity, listening, and authentic communication can carry into conversations with patients, families, nurses, residents, attendings, and teams; presentations, leadership, difficult conversations, and later fellowship or job interviews.'],
['What happens after enrollment?','Keep your order confirmation. Use the same MissionMed account for My Account and My Courses. Follow the schedule, placement, and joining details in your confirmation. Complete starts with Interview Week, with no separate charge. Contact Admissions if confirmed access does not appear.'],
['Does Interview Week include an individual Signature Mock?','No individual Signature Mock Interview is included in the $549 Interview Week tuition. Complete adds a mock and feedback pathway; confirm exact arrangements with Admissions.'],
['What time are the sessions?','Weekend Interview Week sessions are 11 AM–4 PM Eastern. September 24, September 29, and October 1 are evening sessions; exact evening times must be confirmed. Complete’s session selector shows weekdays, not a booking or guaranteed time.'],
['What about recordings and refunds?','Review the published refund and cancellation policy and confirm the terms of your enrollment. This page does not promise replay access, a refund exception, or a Match outcome.'],
['What if I cannot attend this September?','Contact Admissions about future training dates before making plans.']
];

const guarantee="Attend and participate in at least 80% of formally scheduled sessions for your assigned group. Absences formally excused or approved by Dr. Brian do not count against attendance. If you are eligible and do not Match, you enter an equivalent IV Prep Complete group in the NEXT Match Cycle at no additional training tuition for that equivalent group.";
$('#compare').insertAdjacentHTML('afterend',`<section class="guarantee section" id="guarantee"><div>${eyebrow('IV PREP COMPLETE / THE NEXT CYCLE')}<h2>A commitment<br><em>to keep training.</em></h2></div><div><h3>Complete Match Guarantee</h3><p>${guarantee}</p><p>This is next-cycle equivalent-group training, not guaranteed residency placement, a refund, or unlimited years. It does not cover Interview Week alone or Emergency Intensive.</p><a class="text-link" href="/terms-of-agreement/#complete-match-guarantee">Read the Complete Match Guarantee terms ↗</a></div></section>`);
$('#matrix').insertAdjacentHTML('afterend',`<section class="specialized section" id="other-ways"><div class="specialized-heading">${eyebrow('OTHER WAYS WE CAN HELP')}<h2>For a different<br><em>kind of need.</em></h2><p>Interview Week and Complete remain the two primary training paths. These specialized options serve different circumstances.</p></div><div class="specialized-grid"><article id="emergency-offer"><p class="eyebrow">EMERGENCY / PRIVATE</p><h3>Emergency Private<br>Interview Intensive</h3><p class="price">$3,999</p><p><strong>For a real residency interview 7 days or less away.</strong></p><ul><li>4 total private emergency hours with Dr. Brian, including 3 Signature Mock Interviews</li><li>Structured evaluation, debrief and an individualized action plan</li><li>Personalized strategy, content development and interview/program-specific preparation</li></ul><p>It does not include Interview Week / Essentials, IV Prep Complete, Complete’s full-season pathway or Complete Match Guarantee.</p><details data-new-event="emergency_offer_expand"><summary>Is Emergency Intensive right for me? <b>+</b></summary><p>If you still have time to train properly, we recommend IV Prep Complete instead. Emergency Intensive costs more because it requires concentrated, last-minute private access to Dr. Brian. It is an emergency option, not the best-value option.</p><a class="text-link" href="#compare" data-event="emergency_vs_complete_compare">Compare the two primary paths ↗</a></details><p class="small-note">If your interview is within 7 days, contact us now so we can determine whether Dr. Brian can accommodate your timeline.</p><a class="button" id="emergency-request" href="${window.MRBcarry('/contact/?inquiry=emergency-interview-prep')}" data-event="emergency_request_click">Request Emergency Prep ↗</a></article><article id="mentorship-offer"><p class="eyebrow">FLAGSHIP / MENTORSHIP</p><h3>360 Match Mentorship</h3><p class="price">$5,499</p><span class="sold-out">SOLD OUT</span><p>Our flagship mentorship tier. Enrollment is closed.</p><p>For current interview-season training, explore Interview Week or IV Prep Complete above.</p></article></div></section>`);
faq.push(['What is the Complete Match Guarantee?',guarantee+' This is next-cycle training, not guaranteed residency placement or a refund. Read the linked Complete Match Guarantee terms.'],['What if my interview is within 7 days?','Emergency Private Interview Intensive is $3,999 for four TOTAL private hours with Dr. Brian, including three Signature Mock Interviews, structured evaluation, debrief, an action plan, and program-specific strategy. Availability must be confirmed. Request Emergency Prep through Admissions—there is no online Emergency checkout.'],['Does Emergency include Interview Week or Complete?','No. Emergency excludes Interview Week / Essentials, IV Prep Complete, Complete’s full-season pathway and Complete Match Guarantee. If you still have time to train properly, Complete is the recommended value.'],['Can I enroll in 360 Match Mentorship?','360 Match Mentorship is $5,499 and SOLD OUT. It is visible for context, not available for purchase.']);

$('.faq-list').innerHTML=faq.map(([q,a])=>`<details data-new-event="mr_faq_open"><summary>${q}<b aria-hidden="true">+</b></summary><p>${a}</p>${q.includes('Guarantee')?'<a class="text-link" href="/terms-of-agreement/#complete-match-guarantee">Read the Guarantee terms ↗</a>':q.includes('refunds')?'<a class="text-link" href="https://missionmedinstitute.com/refund-cancellation-policy/" target="_blank" rel="noopener">Read refund & cancellation policy ↗</a>':''}</details>`).join('');
$$('details[data-new-event]').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)ev(d.dataset.newEvent,{section:d.closest('section')?.id||'proof',label:$('summary',d).textContent.trim()})}));
quoteIntro('#method',[2,7],'Voice and confidence');quoteIntro('#teacher',[0,1],'Personal impact');quoteIntro('#compare',[5,7],'Decision and confidence');quoteIntro('#team',[6,1],'Belonging and support');quoteIntro('#proof',[3,4,5],'Match Day');quoteIntro('#enroll',[0,2],'Your voice');
setInterval(()=>qstate.forEach(q=>q.tick()),9000);
const motionButton=document.createElement('button');motionButton.className='motion-toggle';motionButton.textContent='Motion on';motionButton.setAttribute('aria-pressed','true');document.body.append(motionButton);
let scheduled=false;
function paintDepth(){scheduled=false;const off=document.body.classList.contains('motion-off'),factor=innerWidth<750?.7:1;motionButton.textContent=off?'Motion off':'Motion on';motionButton.setAttribute('aria-pressed',String(!off));if(off)return;const hero=$('.hero-b'),p=Math.max(0,Math.min(1,-hero.getBoundingClientRect().top/hero.offsetHeight));$('.hero-room').style.transform=`translate3d(0,${p*330*factor}px,0) scale(${1.08+p*.09})`;
 $('.hero-copy').style.transform=`translate3d(0,${-p*110*factor}px,0)`;$('.cinema-ticket').style.transform=`translate3d(0,${-p*65*factor}px,0)`;
 $('.viewfinder').style.transform=`translate3d(${p*22*factor}px,${-p*90*factor}px,0)`;
 hero.style.setProperty('--atmosphere-shift',`${p*180*factor}px`);
 if(window.MRBAAAdepth){window.MRBAAAdepth();return;}
 const r=$('#personalization').getBoundingClientRect(),range=Math.max(1,$('#personalization').offsetHeight-innerHeight),t=Math.max(0,Math.min(1,-r.top/range))-.5;$('.mentor-layer').style.transform=`translate3d(${t*40*factor}px,${t*140*factor}px,0)`;$('.story-layer').style.transform=`translate3d(${-t*60*factor}px,${-t*100*factor}px,0)`;$('.signal-layer').style.transform=`translate3d(${t*25*factor}px,${-t*180*factor}px,0)`;
 const m=$('#matrix').getBoundingClientRect(),mp=Math.max(-.5,Math.min(.5,(innerHeight/2-m.top)/(innerHeight+m.height)));$('.matrix-device').style.transform=`translate3d(0,${mp*100*factor}px,0) rotateX(${mp*-14}deg) rotateY(${mp*5}deg)`;$('.matrix-app-strip').style.transform=`translate3d(${-mp*55*factor}px,${-mp*100*factor}px,60px)`;
 $$('.proof-story').forEach((n,i)=>{const a=n.getBoundingClientRect(),progress=Math.max(-.5,Math.min(.5,(innerHeight/2-a.top)/(innerHeight+a.height)));n.style.transform=`translate3d(0,${progress*(i===0?65:i===1?-55:90)*factor}px,0)`});
}
const schedulePaint=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(paintDepth)}};addEventListener('scroll',schedulePaint,{passive:true});addEventListener('resize',schedulePaint);motionButton.onclick=()=>{window.mrBSetMotion(document.body.classList.contains('motion-off'));paintDepth();ev('mr_motion_preference',{enabled:!document.body.classList.contains('motion-off')})};matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>requestAnimationFrame(paintDepth));paintDepth();
$('.hero-disclosure').textContent='Photo-based composite';
$('.hero-room').src=asset+'hero-brian-photo-composite.png';
$('.hero-room').alt='Dr Brian photo-based composite in the interview room';
$('.hero-foreground').src=asset+'hero-brian-photo-composite.png';
$('.story-layer p').remove();
$('.real-inset small').textContent='Physician-led mentor';
// Keep canonical raster bytes unchanged. Crop/contrast are reversible CSS treatments.
$('.parent-brand').innerHTML=`<img class="mm-crest" src="${asset}missionmed-authentic.png" alt="MissionMed Institute"><img class="mm-wordmark" src="${asset}missionmed-authentic.png" alt="" aria-hidden="true">`;
$('.brand>span').innerHTML='Physician-led interview preparation<br><span>from MissionMed Institute</span>';
// Founder continuation: one related-brand lockup, equal optical widths.
const brandLockup=document.createElement('div');brandLockup.className='brand-lockup';
const residencyBrand=$('.brand'),instituteBrand=$('.parent-brand'),brandSubtitle=$('.brand>span');
const brandJoin=document.createElement('span');brandJoin.className='brand-join';brandJoin.textContent='&';brandJoin.setAttribute('aria-hidden','true');
brandSubtitle.className='brand-subtitle';
residencyBrand.before(brandLockup);brandLockup.append(residencyBrand,brandJoin,instituteBrand,brandSubtitle);

$$('#other-ways a[data-event]').forEach(a=>a.addEventListener('click',()=>ev(a.dataset.event)));
const seen=new Set();const views=new IntersectionObserver(items=>items.forEach(i=>{if(i.isIntersecting&&!seen.has(i.target.id)){seen.add(i.target.id);ev(i.target.id==='emergency-offer'?'emergency_offer_view':'360_sold_out_view');}}),{threshold:.25});['emergency-offer','mentorship-offer'].forEach(id=>views.observe(document.getElementById(id)));
const depths=new Set();addEventListener('scroll',()=>{const p=100*(scrollY+innerHeight)/document.documentElement.scrollHeight;[25,50,75,90].forEach(n=>{if(p>=n&&!depths.has(n)){depths.add(n);ev('mr_scroll_depth',{percent:n})}})},{passive:true});
const walker=document.createTreeWalker(document.getElementById('app'),NodeFilter.SHOW_TEXT);while(walker.nextNode()){const n=walker.currentNode;n.nodeValue=window.MRBcopy(n.nodeValue);}

/* September 16: bounded B mastering; presentation only. */
document.body.classList.add('aaa-mastered');
const storyFiles=['prepare.jpg','online-class.webp','virtual-interview-aaa.png','inperson-interview-aaa.png'];
const storyAlts=['Illustrative applicant researching and preparing personal notes at home','Authentic published Mission Residency live online Webex class','Illustrative applicant adapting to a virtual interviewer','Illustrative applicant in an in-person residency interview'];
$$('.story-image').forEach((n,i)=>{n.src=asset+storyFiles[i];n.alt=storyAlts[i];n.width=1536;n.height=1024;});
$$('.story-image').forEach((img,i)=>{const frame=document.createElement('div');frame.className='story-visual'+(i===1?' class-frame':'');img.before(frame);frame.append(img);});
$('.story-caption').textContent='Real online class · Other interview scenes illustrated';
$$('.story-progress b').forEach((n,i)=>n.textContent=['Prepare','Train','Adapt','Interview'][i]);
$('.teacher-visual .photo img').src=asset+'brian-studio-aaa.jpg';
$('.teacher-visual .photo img').alt='Authentic published studio portrait of Dr Brian';
$('.teacher .art-label').textContent='Dr. Brian · Mission Residency';
$('.real-inset').remove();
$('.teacher-copy').insertAdjacentHTML('beforeend','<a class="text-link strategy-preview" href="#strategy">How we build your answers—not a script ↗</a>');
// Give the supplied UI its own stage. It is a demonstration, not live student data.
$('#personalization').innerHTML=`<div class="personal-pin"><div class="analytics-heading"><div>${eyebrow('IV PREP ON-CALL / COMMUNICATION IN VIEW')}<h2>First, the person.<br><em>Then, the signal.</em></h2></div><p>Your experiences shape the answer. Your delivery shapes how it lands. Use observations to start a useful conversation with your mentor.</p></div><div class="analytics-stage"><div class="analytics-browser"><div class="device-top"><span>IV Prep On-Call</span><span>Demonstration · synthetic data</span></div><div class="oncall-screen" data-view="0"><img src="${asset}oncall-demo-aaa.jpeg" width="1536" height="915" alt="Supplied On-Call demonstration: interview view with framing, pace, volume, pitch, vocal variety and delivery timeline" loading="eager"><span class="metric-focus" aria-hidden="true"></span></div></div><div class="analytics-controls" role="group" aria-label="Explore the communication demonstration"><button data-metric="0" aria-pressed="true">01 · Your presence</button><button data-metric="1" aria-pressed="false">02 · Your voice</button><button data-metric="2" aria-pressed="false">03 · Your next practice</button></div><div class="analytics-insight"><h3>Your story, in context.</h3><p>Start with your experience and the meaning you want to convey. Framing and hand-position observations concern what is visible—not who you are.</p></div><p class="demo-note">Demonstration interface with a fictional candidate and synthetic observations. It is not a student's result or a promise of access. Confirm current tool access with Admissions.</p></div></div>`;
const metricCopy=[
['Your story, in context.','Start with your experience and the meaning you want to convey. Framing and hand-position observations concern what is visible—not who you are.'],
['Hear how your answer lands.','The demonstration places pace, volume, pitch and vocal variety beside the conversation. These are observable communication signals—not personality, honesty or hiring scores.'],
['One observation. A useful next step.','Review delivery over time, discuss the context with your mentor, and choose what to practice next. Technology supports judgment; it does not replace the teacher who knows your story.']
];
let chosenMetric=0,manualMetric=false;
function setMetric(i,manual=false){chosenMetric=i;manualMetric=manual;$('.oncall-screen').dataset.view=String(i);$$('[data-metric]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.metric===i)));$('.analytics-insight h3').textContent=metricCopy[i][0];$('.analytics-insight p').textContent=metricCopy[i][1];}
$$('[data-metric]').forEach(b=>b.onclick=()=>{setMetric(+b.dataset.metric,true);ev('mr_analytics_section_open',{step:+b.dataset.metric,source:'demonstration'})});
$('#matrix').innerHTML=`<div class="matrix-heading"><div>${eyebrow('MISSIONMED MATRIX / THE WORK BETWEEN SESSIONS')}<h2>Your preparation.<br><em>Connected.</em></h2></div><p>Stories, files, research, decisions. Keep the work of your season in a wider MissionMed environment.</p></div><div class="matrix-display"><div class="matrix-device"><div class="device-top"><span>MissionMed Matrix</span><span>Interface preview</span></div><div class="matrix-window"><img src="${asset}matrix-reference.jpeg" width="1536" height="710" alt="Supplied Matrix interface showing navigation and featured preparation apps" loading="eager"><span class="matrix-source-mask" aria-hidden="true">FEATURED APPS</span></div></div></div><div class="matrix-app-strip" role="group" aria-label="Explore the preparation tools"><button data-app="0" aria-pressed="true">StoryForge</button><button data-app="1" aria-pressed="false">File Vault</button><button data-app="2" aria-pressed="false">RISE</button><button data-app="3" aria-pressed="false">RankList IQ</button></div><div class="matrix-tool-copy"><span>01 / YOUR STORIES</span><h3>Find the experience behind the answer.</h3><p>StoryForge is the story-development part of the wider environment. Connect the moments you remember to the meaning you want to communicate.</p></div><p class="matrix-access">This is the wider MissionMed ecosystem, not a list of everything included in either course. Your account and enrollment determine access; confirm specific tools with Admissions. Preview artwork is not the current training calendar.</p>`;
const appCopy=[
['01 / YOUR STORIES','Find the experience behind the answer.','StoryForge is the story-development part of the wider environment. Connect the moments you remember to the meaning you want to communicate.'],
['02 / YOUR FILES','Keep preparation materials within reach.','File Vault is the file-management part of Matrix. Use the materials available in your authorized account as you prepare.'],
['03 / YOUR RESEARCH','Bring better context to the conversation.','RISE is the residency-research part of the environment. Use program research to shape more purposeful preparation and questions.'],
['04 / YOUR DECISIONS','Give your choices room for thought.','RankList IQ is the rank-list planning part of the environment. Keep research and your own priorities in view as you consider decisions.']
];
let chosenApp=0,manualApp=false;
function setApp(i,manual=false){chosenApp=i;manualApp=manual;$$('button[data-app]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.app===i)));const box=$('.matrix-tool-copy');$('span',box).textContent=appCopy[i][0];$('h3',box).textContent=appCopy[i][1];$('p',box).textContent=appCopy[i][2];$('#matrix').dataset.app=String(i);}
$$('button[data-app]').forEach(b=>b.onclick=()=>{setApp(+b.dataset.app,true);ev('mr_matrix_open',{tool:appCopy[+b.dataset.app][0]})});
$$('.proof-story img').forEach((n,i)=>{n.src=asset+['frame-marian-aaa.jpg','frame-yamini-aaa.jpg','frame-gunjan-aaa.jpg'][i];n.alt=['Marian','Yamini','Gunjan'][i]+' in an authentic published Match Day recording';});
$('.proof-heading').insertAdjacentHTML('afterend',`<figure class="match-wall"><img src="${asset}match-wall-aaa.jpg" width="1702" height="630" alt="Authentic MissionMed collage of students and families receiving Match news" loading="lazy"><figcaption>Different journeys. Real moments of joy.</figcaption></figure>`);
$('.youtube-frame img').src=asset+'match-wall-aaa.jpg';$('.youtube-frame img').alt='Authentic MissionMed Match celebration collage';
const mockRow=$$('.comparison-table tr').find(r=>r.textContent.includes('Signature Mock pathway'));
$('td:last-child',mockRow).textContent='Included: mock, debrief and feedback pathway';
$$('.comparison-table tbody tr').forEach(r=>$$('td',r).forEach((td,i)=>td.dataset.offer=i?'Complete':'Interview Week'));
$('.full-comparison>p').textContent="Complete's standard tuition is $3,499. During your team mock, the focus is on you; teammates learn from the same framework and feedback. Exact mock arrangements are confirmed with enrollment.";
const oncallFAQ=$$('.faq-list details').find(n=>$('summary',n).textContent.startsWith('What does IV Prep On-Call analyze?'));
$('p',oncallFAQ).textContent='The demonstration above shows framing and body/hand observations alongside pace, volume, pitch, vocal variety and a delivery timeline. These signals support mentor-led feedback; they do not infer personality, honesty or hiring suitability. The pictured observations are synthetic. Confirm current features and your account access with Admissions.';
const qStart=quotes.length;
quotes.push(
{id:'Q09',name:'Shamsun Nahar Mita',quote:'His emphasis on effective communication has undoubtedly made me a better communicator, a skill that is indispensable in the medical field.',sourceLabel:'Student review'},
{id:'Q10',name:'Sara Habib',quote:'This course is not just for interview preparation but you will also get to learn socializing, networking, and being better at communicating with colleagues and patients.',sourceLabel:'Student review'},
{id:'Q11',name:'Sara Habib',quote:'Whatever you learn to talk about on interviews, are stories from your own life.',sourceLabel:'Student review'},
{id:'Q12',name:'Varun Ravindran',quote:'The classes and the mocks took away so much stress from the day of the interview and just made everything easier.',sourceLabel:'Student review'}
);
quoteIntro('#personalization',[7,0],'Confidence, built together');
quoteIntro('#strategy',[qStart+2,2],'Your own stories and voice');
quoteIntro('.career',[qStart,qStart+1],'Communication beyond interviews');
// Make the mock-specific source visible within its relevant section.
$('#team>div:last-child').insertAdjacentHTML('beforeend','<figure class="team-testimony"><blockquote>“'+quotes[qStart+3].quote+'”</blockquote><figcaption>'+quotes[qStart+3].name+' · Student review</figcaption></figure>');
// This is a utility, not a floating obstacle over mobile buying information.
$('.footer').append(motionButton);
const introQuote=$('.quote-intro[data-section="#method"]');
introQuote.querySelector('figcaption').textContent+='';
let ticking=false;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
window.MRBAAAdepth=()=>{
 const off=document.body.classList.contains('motion-off'),mobile=innerWidth<900;
 const pr=$('#personalization').getBoundingClientRect(),range=Math.max(1,$('#personalization').offsetHeight-innerHeight);
 const t=clamp(-pr.top/range);
 if(!manualMetric&&!mobile&&!off)setMetric(Math.min(2,Math.floor(t*3)));
 const enter=clamp((innerHeight-pr.top)/(innerHeight+250));
 $('.analytics-browser').style.transform=off?'none':`perspective(1600px) rotateX(${(1-enter)*14-t*4}deg) rotateY(${(1-enter)*-9}deg) translate3d(0,${(1-enter)*80-t*30}px,0) scale(${.91+enter*.09})`;
 $('#personalization').style.setProperty('--atmosphere-shift',`${t*180}px`);
 const mr=$('#matrix').getBoundingClientRect(),mp=clamp((innerHeight*.75-mr.top)/(mr.height+innerHeight*.25));
 const panelTop=$('.matrix-tool-copy').getBoundingClientRect().top;
 const appProgress=clamp((innerHeight*.55-panelTop)/(innerHeight*.4));
 if(!manualApp&&!off&&!mobile)setApp(Math.min(3,Math.floor(appProgress*4)));
 $('.matrix-device').style.transform=off?'none':`perspective(1600px) translate3d(0,${(mp-.5)*-130}px,0) rotateX(${(mp-.5)*-18}deg) rotateY(${(mp-.5)*5}deg)`;
 $('#matrix').style.setProperty('--atmosphere-shift',`${mp*150}px`);
 const collage=$('.celebration-image');if(collage){const r=$('#celebration').getBoundingClientRect(),p=clamp((innerHeight-r.top)/(innerHeight+r.height));collage.style.transform=off||mobile?'none':`translate3d(0,${(p-.5)*110}px,0) scale(1.12)`;}
 $$('.proof-story').forEach((n,i)=>{const r=n.getBoundingClientRect(),p=clamp((innerHeight-r.top)/(innerHeight+r.height));n.style.transform=off?'none':`translateY(${(p-.5)*(mobile?30:70)*(i%2?-1:1)}px)`;});
};
const aaPaint=()=>{if(!ticking){ticking=true;requestAnimationFrame(()=>{ticking=false;window.MRBAAAdepth()})}};
addEventListener('scroll',aaPaint,{passive:true});addEventListener('resize',aaPaint);window.MRBAAAdepth();
const revealObserver=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('aaa-visible');revealObserver.unobserve(e.target);}}),{threshold:.08});
$$('.analytics-heading,.matrix-heading,.strategy-heading,.specialized-heading,.proof-heading,.match-wall,.team-photo,.teacher-copy').forEach(n=>{n.classList.add('aaa-reveal');revealObserver.observe(n)});
ev('mr_b_aaa_mastering_view');

/* Founder surgical V2: exact supplied proof, editorial hierarchy, bounded depth. */
document.body.classList.add('aaa-correction-v2');
$('.brand-subtitle').textContent='Physician-led interview preparation';
const heroVisibility=new IntersectionObserver(entries=>entries.forEach(e=>document.body.classList.toggle('v2-hero-in-view',e.isIntersecting)),{threshold:0});heroVisibility.observe($('.hero-b'));
$('.hero-person').remove();$('.hero-foreground').remove();
// The approved portrait stays intact: no guessed subject mask or duplicate desk.
const wall=$('.match-wall');wall.remove();$('.match-film').remove();
$('.intro').insertAdjacentHTML('afterend',`<section id="celebration" class="celebration"><div class="celebration-heading"><p class="eyebrow">THE HUMAN PART / MISSION RESIDENCY</p><h2>The moment<br><em>it becomes real.</em></h2><p>Different journeys. Shared joy.<br>The people behind the preparation.</p></div><figure><div class="celebration-window"><img class="celebration-image" src="${asset}student-celebrate-v2.webp" width="1702" height="630" alt="Mission Residency student celebration collage: students and families laughing, cheering and receiving Match news" loading="lazy" decoding="async"></div><figcaption><span>Real Mission Residency celebrations.<br>Individual experiences, not a promise of your outcome.</span><a class="text-link" href="${asset}student-celebrate-v2.webp" target="_blank" rel="noopener">View the full celebration image ↗</a></figcaption></figure><div class="celebration-links"><a class="button" href="#compare">Find your training path ↗</a><a class="text-link" href="#proof">Hear their stories ↗</a><a class="text-link" href="https://www.youtube.com/watch?v=SWFzwGD3nZI" target="_blank" rel="noopener">Watch the celebration ↗</a></div></section>`);
$('.proof-heading h2').innerHTML='In their<br><em>own words.</em>';
$('.proof-heading>p:not(.eyebrow)').textContent='Meet Marian, Yamini and Gunjan. Watch their authentic MissionMed Match Day recordings.';
const decisionQuote=$('.quote-intro[data-section="#compare"]');
// Distinct, source-verified mock experience at the actual decision point.
$('blockquote',decisionQuote).textContent='“'+quotes[qStart+3].quote+'”';
$('figcaption',decisionQuote).textContent=quotes[qStart+3].name+' · Student review';
decisionQuote.dataset.quoteId='Q12';
// Keep the existing rotation controls honest: this feature is a single, static source.
qstate.splice(qstate.findIndex(q=>q.node===decisionQuote),1);$('.quote-controls',decisionQuote).remove();
$('.quote-theme',decisionQuote).innerHTML='Practice with purpose <span>· Student voice</span>';
$('.team-testimony').remove();
const matrixStage=document.createElement('div');matrixStage.className='matrix-stage';$('.matrix-heading').after(matrixStage);['.matrix-display','.matrix-app-strip','.matrix-tool-copy','.matrix-access'].forEach(s=>matrixStage.append($(s)));
const closingQuote=$('.quote-intro[data-section="#enroll"]');
qstate.splice(qstate.findIndex(q=>q.node===closingQuote),1);$('.quote-controls',closingQuote).remove();
$('blockquote',closingQuote).textContent='“'+quotes[5].quote+'”';$('figcaption',closingQuote).textContent=quotes[5].name+' · MissionMed Match Day';closingQuote.dataset.quoteId='Q06';
const v2Reveal=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('v2-visible');v2Reveal.unobserve(e.target)}}),{threshold:.12});
$$('.quote-intro,.celebration-heading,.analytics-insight,.matrix-tool-copy').forEach(n=>{n.classList.add('v2-reveal');v2Reveal.observe(n)});
// Reset all added transforms when the reader disables motion, including dynamic preference changes.
const resetV2=()=>{if(document.body.classList.contains('motion-off')){$$('.hero-room,.hero-copy,.cinema-ticket,.viewfinder,.celebration-image,.analytics-browser,.matrix-device,.proof-story').forEach(n=>n.style.transform='none');$$('.hero-b,#personalization,#matrix').forEach(n=>n.style.setProperty('--atmosphere-shift','0px'));}};
new MutationObserver(resetV2).observe(document.body,{attributes:true,attributeFilter:['class']});resetV2();aaPaint();
const reserveQuotes=()=>qstate.forEach(q=>q.reserve());document.fonts.ready.then(reserveQuotes);let quoteResize;addEventListener('resize',()=>{clearTimeout(quoteResize);quoteResize=setTimeout(reserveQuotes,160)});
ev('mr_b_aaa_correction_v2_view');

/* September 16: Founder-authorized warm-audience enrollment refactor. */
document.body.classList.add('warm-audience');
const warmPrice=$('.complete-offer .price')?.childNodes[0]?.nodeValue?.trim()||'$3,099';
const warmEarly=warmPrice==='$3,099';
const warmTuition=warmEarly?'$3,099 early card tuition through September 23':'$3,499 standard tuition';

// Student outcome first: reuse the exact supplied collage and the already-bound core CTA.
const warmHero=$('#top');warmHero.classList.add('warm-hero');
$('.hero-room').src=asset+'student-celebrate-v2.webp';
$('.hero-room').alt='Mission Residency students and families celebrating Match news';
$('.hero-disclosure')?.remove();
$('.hero-copy>.eyebrow').textContent='MISSION RESIDENCY / LIVE ONLINE / FALL 2026';
$('.hero-copy .scene-label')?.remove();
$('.hero-copy h1').innerHTML='Train before<br><em>the interview<br>that matters.</em>';
$('.hero-copy .hero-intro').innerHTML='Interview Week builds the live foundation.<br>Complete stays with you through interview season.';
const warmHeroAction=$('.hero-copy [data-action]');warmHeroAction.dataset.action='complete';warmHeroAction.textContent='Choose Complete · '+warmPrice+' ↗';
const warmNavAction=$('.nav-enroll');warmNavAction.dataset.action='complete';warmNavAction.textContent='Complete · '+warmPrice+' ↗';
$('.hero-copy .actions .text-link').textContent='Interview Week · $549 card / $499 Zelle ↗';
$('.hero-copy .actions .text-link').href='#compare';
$('.hero-copy .fine').innerHTML='<strong>Interview Week starts September 24.</strong> Complete includes it—no separate Interview Week charge.';
$('.cinema-ticket').innerHTML='<span>INTERVIEW WEEK<br><b>SEP 24 → OCT 3</b></span><strong>$549<span>CARD · $499 ZELLE</span></strong><p>Save $50 with Zelle.<br>Complete: '+warmTuition+', Interview Week included.</p><a href="#dates" aria-label="See the schedule">↓</a>';

// The four-beat 2x2 story is replaced by one short, concrete method section.
const warmMethod=document.createElement('section');warmMethod.id='method';warmMethod.className='warm-method section';
warmMethod.innerHTML=`<div class="warm-heading">${eyebrow('THE METHOD / TRAIN BEFORE YOU TEST')}<h2>Build a framework.<br><em>Keep your own voice.</em></h2><p>Real interviews should not be your practice rounds. Learn the skill before the moment asks for it.</p></div><div class="method-steps"><article><span>01</span><h3>Recognize the question</h3><p>Understand what the interviewer is really asking and what a strong answer needs to accomplish.</p></article><article><span>02</span><h3>Choose truthful material</h3><p>Build from your own experiences instead of borrowing language or memorizing a rigid script.</p></article><article><span>03</span><h3>Shape the strategy</h3><p>Connect the question, the content and the impression you want to leave.</p></article><article><span>04</span><h3>Practice adaptability</h3><p>Work on clarity, pacing, presence and follow-up so the answer can move with a real conversation.</p></article></div>`;
$('#method').replaceWith(warmMethod);

// Verified dates and curriculum are prominent without inventing a day-by-day module assignment.
const warmDates=document.createElement('section');warmDates.id='dates';warmDates.className='warm-schedule section';
const warmSessions=[
 ['SEP 24','Orientation + Match Primer','Evening · exact time confirmed with enrollment'],
 ['SEP 26','Day 1','11 AM–4 PM Eastern'],['SEP 27','Day 2','11 AM–4 PM Eastern'],
 ['SEP 29','Day 3','Evening · exact time confirmed with enrollment'],
 ['OCT 1','Day 4','Evening · exact time confirmed with enrollment'],['OCT 3','Day 5','11 AM–4 PM Eastern']
];
const warmCurriculum=[
 ['Communication & delivery','Practice presence, pacing, voice, body language and making your meaning clear.'],
 ['Content & question strategy','Recognize the question beneath the question and choose the right experience.'],
 ['Interviewer types & formats','Adapt to traditional, conversational, behavioral, CV-based, panel and group formats.'],
 ['Virtual & in-person readiness','Prepare your environment, camera, sound, appearance and approach for the room.'],
 ['Program research & fit','Use purposeful research to prepare stronger questions and more specific conversations.'],
 ['During & after the interview','Think about the impression you leave, the questions you ask and what follows.']
];
warmDates.innerHTML=`<div class="warm-heading">${eyebrow('INTERVIEW WEEK / $549 CARD · $499 ZELLE')}<h2>Six live sessions.<br><em>One usable foundation.</em></h2><p>September 24–October 3, 2026. Primarily live online via Webex.</p></div><div class="warm-session-grid">${warmSessions.map(s=>`<article><time>${s[0]}</time><h3>${s[1]}</h3><p>${s[2]}</p></article>`).join('')}</div><div class="warm-course-work"><div><h3>What you learn across the week</h3><p>Across the five training days, you build one connected interview-preparation framework. Each topic below is part of the week; your enrollment confirmation provides the final session details.</p></div><div class="warm-curriculum">${warmCurriculum.map((x,i)=>`<details ${i===0?'open':''}><summary><span>0${i+1}</span>${x[0]}<b>+</b></summary><p>${x[1]} <strong>Included in Interview Week and Complete.</strong></p></details>`).join('')}</div></div><p class="warm-boundary">You leave with a repeatable way to recognize questions, choose personal content and adapt your communication. Interview Week does not include an individual Signature Mock Interview or continued Complete support.</p>`;
$('#dates').replaceWith(warmDates);

// Make the existing guarded buying decision more decisive, without replacing its checkout controls.
const warmCompare=$('#compare');warmCompare.classList.add('warm-compare');warmCompare.dataset.selected='complete';
$('.comparison-head>.eyebrow').textContent='ONE FOUNDATION / TWO WAYS FORWARD';
$('.comparison-head h2').innerHTML='Choose the support<br><em>you want after the foundation.</em>';
$('.comparison-head>p').innerHTML='Complete includes Interview Week.<br><strong>There is no separate Interview Week charge.</strong>';
$$('[data-choice]',warmCompare).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.choice==='complete')));
$('.choice-feedback').textContent='Complete: Interview Week plus continued practice, personalized feedback and season support.';
$('.complete-offer>.eyebrow').textContent='RECOMMENDED / THE FULL-SEASON PATH';
$('.complete-offer .offer-boundary').textContent=warmEarly?'Standard tuition $3,499. Choose by September 23 and save $400.':'Current standard tuition $3,499.';

// Rest-of-season truth: ratified weekdays, qualitative cadence and exact Guarantee boundaries.
const warmComplete=document.createElement('section');warmComplete.id='complete-season';warmComplete.className='warm-complete section';
warmComplete.innerHTML=`<div class="warm-heading">${eyebrow('WHY CHOOSE COMPLETE FROM THE START?')}<h2>Do the foundation once.<br><em>Keep training all season.</em></h2><p>Interview Week teaches the framework. Complete adds the recurring practice and feedback loop that helps you use it when interviews arrive.</p></div><div class="complete-value"><article><span>01</span><h3>Interview Week included</h3><p>Start with Orientation + Match Primer and all five live training days. There is no separate Interview Week charge.</p></article><article><span>02</span><h3>Practice → mock → feedback</h3><p>Your turn receives focused analysis. Teammates learn the same framework and carry identified practice areas forward.</p></article><article><span>03</span><h3>Your assigned group</h3><p>A360 meets Mondays; B/C Wednesdays; D/J Fridays. Placement, dates, frequency, capacity, times and joining details come with enrollment.</p></article><article><span>04</span><h3>Interview-specific preparation</h3><p>Interview before October 15? Dr Brian provides program-specific preparation for Complete students; contact Admissions promptly to arrange it.</p></article></div><details class="complete-disclosure" open><summary>Complete Match Guarantee <b>+</b></summary><p>${guarantee}</p><p>This is next-cycle equivalent-group training—not guaranteed residency placement, a refund or unlimited years. It does not cover Interview Week alone or Emergency Intensive.</p><a class="text-link" href="/terms-of-agreement/#complete-match-guarantee">Read the Complete Match Guarantee terms ↗</a></details><details class="complete-disclosure"><summary>What is confirmed—and what is confirmed after enrollment? <b>+</b></summary><p>Confirmed here: the weekday pattern, practice/mock/feedback pathway, personalized season support and pre-October-15 preparation. Your enrollment confirmation provides exact meeting dates, placement, frequency, mock arrangements, joining details and any account-specific tools. Replay availability, group capacity and the number of included mocks are confirmed with your enrollment.</p></details><p class="complete-price"><strong>${warmPrice}</strong> ${warmEarly?'early card paid in full through September 23 · ':''}<span>$3,499 standard tuition · Interview Week included</span></p><a class="button warm-jump" href="#enroll">Choose Complete at the final enrollment step ↓</a>`;

// Dr Brian is the teacher, not the outcome hero. Use the established identity-accurate image.
const warmTeacher=$('#teacher');warmTeacher.classList.add('warm-teacher');
$('.teacher-visual img').src=asset+'brian-studio-aaa.jpg';$('.teacher-visual img').alt='Dr Brian teaching Mission Residency interview preparation';
$('.teacher-visual figcaption').textContent='Dr Brian · Mission Residency';
$('.teacher-copy>.eyebrow').textContent='HOW DR BRIAN TRAINS YOU';
$('.teacher-copy h2').innerHTML='Personal strategy.<br><em>No memorized script.</em>';
$$('.teacher-copy>p').forEach(n=>n.remove());
$('.teacher-copy h2').insertAdjacentHTML('afterend','<p>Dr Brian learns the person behind the application, helps you recognize what the question requires, and develops truthful content you can adapt under pressure.</p><ul class="teacher-points"><li>Personal experience before polished wording</li><li>Question recognition and answer strategy</li><li>Clearer delivery, listening and adaptability</li><li>Communication you can carry beyond interview season</li></ul>');
$$('.teacher-copy .button,.teacher-copy .text-link').forEach(n=>n.remove());

// Three strategic testimonial modules. Programs/specialties are omitted because current evidence does not verify them.
const warmTestimonials=document.createElement('section');warmTestimonials.id='testimonials';warmTestimonials.className='warm-testimonials section';
const warmSets=[
 {theme:'Dr Brian / personalization',items:[{id:'Q01',name:'Marian',quote:'You made me fall in love with my story.',image:'marian.jpg'},{id:'Q08',name:'Mahabuba',quote:'You are the person who gave me the confidence.'},{id:'Q03',name:'Yamini',quote:'You gave me voice to express myself.',image:'yamini.jpg'}]},
 {theme:'Complete / team / training',items:[{id:'Q07',name:'Maksura',quote:'It feels like I belong to somewhere.'},{id:'Q02',name:'Chelsey & Danny',quote:"You make a difference in people's life."}]},
 {theme:'Match / outcome',items:[{id:'Q04',name:'Gunjan',quote:'This is the best feeling right now.',image:'gunjan.jpg'},{id:'Q05',name:'Sana',quote:'Being persistent and just trying harder... it does pay off.'},{id:'Q06',name:'Maisha',quote:'Coming up to you was one of the best decisions in my life.'}]}
];
const warmPortrait=q=>q.image?`<img src="${asset}${q.image}" alt="${q.name} in authentic published MissionMed media" loading="lazy" decoding="async">`:`<span class="warm-monogram" aria-hidden="true">${q.name.split(/\s|&/).filter(Boolean).slice(0,2).map(x=>x[0]).join('')}</span>`;
warmTestimonials.innerHTML=`<div class="warm-heading">${eyebrow('STUDENT VOICES / PUBLISHED MISSIONMED PROOF')}<h2>What the training<br><em>felt like to them.</em></h2><p>Exact published quotes. Individual experiences, never a promise of your outcome.</p></div><div class="warm-quote-grid">${warmSets.map((set,i)=>{const q=set.items[0];return `<article class="warm-quote" data-warm-quote="${i}" tabindex="0"><p class="quote-theme">${set.theme}</p><div class="warm-portrait">${warmPortrait(q)}</div><figure><blockquote>“${q.quote}”</blockquote><figcaption><strong>${q.name}</strong><span>Published MissionMed student voice</span></figcaption></figure><div class="warm-quote-controls"><button data-dir="-1" aria-label="Previous ${set.theme} quote">←</button><span>1 / ${set.items.length}</span><button data-dir="1" aria-label="Next ${set.theme} quote">→</button><button data-pause aria-pressed="false">Pause</button></div></article>`}).join('')}</div><div class="warm-proof"><div><h3>Watch the real moments</h3><p>Marian, Yamini and Gunjan in authentic published MissionMed Match Day recordings.</p></div><div class="warm-proof-cards"></div></div>`;
const oldProof=$('#proof');const warmProofCards=$('.warm-proof-cards',warmTestimonials);$$('.proof-story',oldProof).forEach(n=>warmProofCards.append(n));
warmSets.forEach((set,i)=>{const card=$(`[data-warm-quote="${i}"]`,warmTestimonials);let ix=0,paused=false,hover=false,focused=false;
 const draw=(dir=1)=>{ix=(ix+dir+set.items.length)%set.items.length;const q=set.items[ix],portrait=$('.warm-portrait',card),figure=$('figure',card);portrait.innerHTML=warmPortrait(q);$('blockquote',card).textContent='“'+q.quote+'”';$('figcaption strong',card).textContent=q.name;$('.warm-quote-controls span',card).textContent=(ix+1)+' / '+set.items.length;if(!document.body.classList.contains('motion-off'))figure.animate([{opacity:.12,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:700,easing:'ease-out'});ev('mr_quote_interaction',{section:'warm-'+i,quote_id:q.id,direction:dir>0?'next':'previous'})};
 $$('[data-dir]',card).forEach(b=>b.onclick=()=>draw(Number(b.dataset.dir)));$('[data-pause]',card).onclick=e=>{paused=!paused;e.currentTarget.textContent=paused?'Resume':'Pause';e.currentTarget.setAttribute('aria-pressed',String(paused))};card.onmouseenter=()=>hover=true;card.onmouseleave=()=>hover=false;card.addEventListener('focusin',()=>focused=true);card.addEventListener('focusout',e=>focused=!!e.relatedTarget&&card.contains(e.relatedTarget));setInterval(()=>{if(!paused&&!hover&&!focused&&!document.hidden&&!document.body.classList.contains('motion-off'))draw(1)},7000);
});

// Preserve the actual supplied On-Call and Matrix UI nodes and their existing controls, but reduce their footprint.
const warmTools=document.createElement('section');warmTools.id='tools';warmTools.className='warm-tools section';
warmTools.innerHTML=`<div class="warm-heading">${eyebrow('SUPPORTING TOOLS / KEPT IN PROPORTION')}<h2>Useful between sessions.<br><em>Never the point of the course.</em></h2><p>Technology organizes observations and preparation. Dr Brian’s judgment, practice and feedback remain central.</p></div><div class="warm-tool-grid"><article class="warm-oncall"><h3>IV Prep On-Call</h3><p>See a concise communication demonstration covering presence, voice and the next practice goal.</p><div class="warm-tool-live"></div><details><summary>What this demo does—and does not prove <b>+</b></summary><p>The pictured candidate and observations are synthetic. Signals can support a mentor conversation; they do not infer personality, honesty or hiring suitability. Confirm current account access with Admissions.</p></details></article><article class="warm-matrix"><h3>MissionMed Matrix</h3><p>Keep stories, files, research and decisions visible in the wider MissionMed environment.</p><div class="warm-tool-live"></div><details><summary>Which tools are included? <b>+</b></summary><p>StoryForge, File Vault, RISE and RankList IQ are shown as the wider environment. Your account and enrollment determine access; the preview is not a promise that every tool is included.</p></details></article></div>`;
const oldOnCall=$('#personalization'),oldMatrix=$('#matrix');
['.analytics-browser','.analytics-controls','.analytics-insight'].forEach(s=>{const n=$(s,oldOnCall);if(n)$('.warm-oncall .warm-tool-live',warmTools).append(n)});
['.matrix-device','.matrix-app-strip','.matrix-tool-copy'].forEach(s=>{const n=$(s,oldMatrix);if(n)$('.warm-matrix .warm-tool-live',warmTools).append(n)});

// Conversion FAQ: eight visible questions; secondary details live behind one clear reveal.
const warmFaqMain=[
 ['What exactly is Interview Week?','The $549 card or $499 Zelle live foundation: Orientation + Match Primer and five training days covering communication, truthful content, question strategy, formats, virtual/in-person readiness, program research and interview follow-through.'],
 ['Is the training live online?','Yes. Mission Residency training is primarily live online via Webex. Your enrollment confirmation provides joining details.'],
 ['Does Complete include Interview Week?','Yes. Complete includes Interview Week. You never add a separate Interview Week charge and you should not buy both.'],
 ['Why choose Complete from the start?','You begin with the same foundation and continue into practice, mocks, debrief, personalized feedback and season support. '+(warmEarly?'Early card tuition is $3,099 through September 23; standard tuition is $3,499.':'Current standard tuition is $3,499.')],
 ['What happens after Interview Week?','Complete students continue the practice and feedback pathway in an assigned group. Interview Week alone ends after the foundation.'],
 ['What happens after enrollment?','Keep your order confirmation, use the same MissionMed account for My Account and My Courses, then follow the schedule, placement and joining instructions in your confirmation.'],
 ['What time are the sessions?','Weekend sessions are 11 AM–4 PM Eastern. September 24, September 29 and October 1 are evenings; exact evening times come with enrollment.'],
 ['What is the Complete Match Guarantee?',guarantee+' It is next-cycle equivalent-group training—not guaranteed placement or a refund.']
];
const warmFaqMore=[
 ['Who is this for?','IMGs, Caribbean graduates, U.S. MD and DO students, reapplicants and strong first-time applicants across specialties.'],
 ['Does Interview Week include an individual Signature Mock?','No. Interview Week tuition does not include an individual Signature Mock. Complete adds a mock and feedback pathway; exact arrangements are confirmed with enrollment.'],
 ['Do you teach memorized answers?','No. The method develops question recognition, strategy, personal content, story selection, adaptability and authentic delivery.'],
 ['What if my interview is before October 15?','Complete students receive interview-specific preparation with Dr Brian. Contact Admissions promptly to arrange it.'],
 ['What about recordings and refunds?','This page does not promise replay access, a refund exception or a Match outcome. Review the published refund and cancellation policy.'],
 ['What if my interview is within seven days?','Emergency Intensive is $3,999 for four TOTAL private hours including three Signature Mocks. It excludes Interview Week, Complete and the Guarantee, and is request-only. If time permits, choose Complete.'],
 ['Can I enroll in 360 Match Mentorship?','No. 360 Match Mentorship is $5,499 and SOLD OUT.'],
 ['Are On-Call and every Matrix tool included?','Access depends on your account and enrollment. The previews explain the wider environment; confirm specific tools with Admissions.']
];
const warmDetails=([q,a])=>`<details><summary>${q}<b>+</b></summary><p>${a}</p>${q.includes('Guarantee')?'<a class="text-link" href="/terms-of-agreement/#complete-match-guarantee">Read Guarantee terms ↗</a>':q.includes('refunds')?'<a class="text-link" href="/refund-cancellation-policy/">Read refund & cancellation policy ↗</a>':''}</details>`;
const warmQuestions=$('#questions');warmQuestions.classList.add('warm-questions');warmQuestions.innerHTML=`<div class="warm-heading">${eyebrow('QUESTIONS BEFORE YOU ENROLL')}<h2>Clear answers.<br><em>Then choose.</em></h2><p>The essential questions are open here. Secondary details stay one step away.</p></div><div class="warm-faq-list">${warmFaqMain.map(warmDetails).join('')}<details class="warm-faq-more"><summary>See all questions <b>+</b></summary><div>${warmFaqMore.map(warmDetails).join('')}</div></details></div>`;
$$('.warm-questions details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)ev('mr_faq_open',{label:$('summary',d).textContent.trim()})}));

// Specialized offers stay visible, compact and decisively secondary.
const warmOther=document.createElement('section');warmOther.id='other-ways';warmOther.className='warm-other section';
warmOther.innerHTML=`<div class="warm-heading">${eyebrow('OTHER WAYS WE CAN HELP')}<h2>Special circumstances.<br><em>Not the normal buying path.</em></h2></div><div class="warm-other-grid"><article><span>EMERGENCY / PRIVATE</span><h3>Emergency Intensive · $3,999</h3><p>For a real residency interview seven days or less away. Four TOTAL private hours with Dr Brian, including three Signature Mocks.</p><details><summary>Scope and exclusions <b>+</b></summary><p>Includes personalized strategy, program-specific preparation, evaluation, debrief and action plan. Excludes Interview Week, Complete, full-season support and the Match Guarantee. If time permits, we recommend Complete.</p></details><a class="text-link" href="${window.MRBcarry('/contact/?inquiry=emergency-interview-prep')}" data-event="emergency_request_click">Request Emergency Prep ↗</a></article><article><span>FLAGSHIP / MENTORSHIP</span><h3>360 Match Mentorship · $5,499</h3><strong class="sold-out">SOLD OUT</strong><p>Visible for context. Enrollment is closed and there is no purchase action.</p></article></div>`;
$$('a[data-event]',warmOther).forEach(a=>a.onclick=()=>ev(a.dataset.event));

// Complete-first close; reuse the already-bound buttons so eligibility and checkout guards remain unchanged.
const warmEnroll=$('#enroll');warmEnroll.classList.add('warm-enroll');
$('.warm-enroll>.eyebrow').textContent='READY TO TRAIN THROUGH THE SEASON?';
$('.warm-enroll h2').innerHTML='Start with Complete.<br><em>Keep Interview Week inside it.</em>';
const enrollActions=$('.warm-enroll .actions'),completeButton=$('[data-action="complete"]',enrollActions),iwButton=$('[data-action="iw"]',enrollActions);
completeButton.classList.remove('secondary');completeButton.textContent='Choose Complete · '+warmPrice+' ↗';iwButton.classList.add('secondary');iwButton.textContent='Interview Week · $549 card / $499 Zelle ↗';enrollActions.prepend(completeButton);
$('.warm-enroll>p').textContent='Complete includes Interview Week. No separate Interview Week charge. Standard tuition is $3,499.';
$('.warm-enroll .lead-invite')?.remove();
const mobileButton=$('.mobile-enroll [data-action]');mobileButton.dataset.action='complete';mobileButton.textContent='Complete · '+warmPrice+' ↗';$('.mobile-enroll>a').innerHTML='Compare<br><strong>Week / Complete</strong>';

// Final page order: eleven decision-focused sections. Everything removed below is already merged, cut or moved to FAQ.
const main=$('#main'),footer=$('.footer'),mobileEnroll=$('.mobile-enroll');
$$('.quote-intro,.intro,#celebration,#strategy,#team,.career,#guarantee,.curriculum').forEach(n=>n.remove());
oldOnCall.remove();oldMatrix.remove();oldProof.remove();$('#other-ways')?.remove();
main.append(warmHero,warmMethod,warmDates,warmCompare,warmComplete,warmTeacher,warmTestimonials,warmTools,warmQuestions,warmOther,warmEnroll,footer,mobileEnroll);
$$('.site-nav nav a').forEach(a=>{if(a.textContent.includes('Match')){a.textContent='Student stories';a.href='#testimonials'}});

// Keep only restrained motion that supports comprehension.
window.MRBAAAdepth=()=>{const off=document.body.classList.contains('motion-off'),hero=warmHero,r=hero.getBoundingClientRect(),p=Math.max(0,Math.min(1,-r.top/Math.max(1,hero.offsetHeight)));$('.hero-room').style.transform=off?'none':`translate3d(0,${p*70}px,0) scale(${1.02+p*.03})`;};
window.MRBAAAdepth();
const warmObserver=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('warm-visible');warmObserver.unobserve(e.target)}}),{threshold:.08});$$('.warm-audience main>.section').forEach(n=>{n.classList.add('warm-reveal');warmObserver.observe(n)});
ev('mr_warm_audience_view',{source:'2e397c4d39301de2eaccc4b06d4627f3ee7593db'});

ev('mr_b_finalization_view');
}, {once:true});
