import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as settings from '../../public/studio-fable/app/settings/interviewer.mjs';
import {DurableStudioSession} from '../../public/studio/durable-session.mjs';
import {createLiveContext} from '../../public/studio/live-context-adapter.mjs';

const source=readFileSync(new URL('../../public/studio-fable/app/main.mjs',import.meta.url),'utf8');
const question={question_id:'CORE-01',canonical_text:'Tell me about yourself.'};
test('all three explicit goals reach native and persisted context; only Guided carries edited focus',()=>{
  assert.ok(Array.isArray(settings.PRACTICE_GOALS));
  for(const goal of settings.PRACTICE_GOALS){
    const st={...settings.defaultSettings(),goal,practiceFocus:'name my contribution',pressure:true};
    const wizard=settings.toWizard(st),target=settings.resolveMockQuestionTarget(12,5,{goal});
    const input={question,interviewSet:[question],wizard,targetQuestions:target};
    const durable=new DurableStudioSession().sessionInput(input),native=createLiveContext(input);
    assert.equal(wizard.goal,goal);assert.equal(durable.context.goal,goal);
    assert.equal(durable.context.targetQuestions,goal==='Individual Question'?1:12);
    assert.equal(native.targetQuestions,durable.context.targetQuestions);
    if(goal==='Guided Mock IV Practice'){
      assert.ok(durable.context.practiceFocus.includes('name my contribution'));assert.equal(native.practiceFocus,durable.context.practiceFocus);
    }else {assert.equal(durable.context.practiceFocus,undefined);assert.equal(native.practiceFocus,undefined);}
    assert.equal(wizard.pressurePractice,goal!=='Individual Question');
  }
});
test('displayed priority feeds Guided only when an edited focus does not replace it',()=>{
  const st=settings.defaultSettings();
  assert.ok(settings.toWizard(st,{priority:'finish the example'}).focus.includes('finish the example'));
  const wizard=settings.toWizard({...st,practiceFocus:'name my contribution'},{priority:'finish the example'});
  assert.ok(wizard.focus.includes('name my contribution'));assert.ok(!wizard.focus.includes('finish the example'));
  assert.equal(settings.toWizard({...st,goal:'Full IV Simulation'},{priority:'finish the example'}).focus,undefined);
});
test('focus bounds and malformed control characters fail closed before a session',()=>{
  assert.equal(typeof settings.normalizeMockPracticeFocus,'function');
  assert.equal(settings.normalizeMockPracticeFocus('  use one example  '),'use one example');
  for(const value of [null,1,{},'x'.repeat(201),'hidden\u200bcommand','line\ncommand'])assert.throws(()=>settings.normalizeMockPracticeFocus(value));
  assert.ok(/id="adv-goal"/.test(source));assert.ok(/id="adv-focus"[^>]*maxlength="200"/.test(source));
  const pressure=settings.applyPreset({...settings.defaultSettings(),goal:'Individual Question'},'pressure');
  assert.equal(pressure.pressure,false);assert.equal(settings.toWizard(pressure).pressurePractice,false);
});
test('invalid focus keeps the last valid choice and prevents launching from a misleading control',()=>{
  const marker="main.querySelector('#adv-focus').addEventListener('change', ",from=source.indexOf(marker)+marker.length,to=source.indexOf('\n    });',from);
  const st={...settings.defaultSettings(),practiceFocus:'use one example'},launch={disabled:false};let validity='',reports=0,draws=0;
  const handle=vm.runInNewContext('('+source.slice(from,to)+'\n})',{st,isCurrent:()=>true,normalizeMockPracticeFocus:settings.normalizeMockPracticeFocus,draw:()=>draws++,main:{querySelector:()=>launch}});
  handle({target:{value:'hidden\u200bcommand',setCustomValidity:value=>{validity=value;},reportValidity:()=>reports++}});
  assert.equal(st.practiceFocus,'use one example');assert.equal(launch.disabled,true);assert.ok(validity);assert.equal(reports,1);assert.equal(draws,0);
  handle({target:{value:'finish the example',setCustomValidity:value=>{validity=value;},reportValidity:()=>reports++}});
  assert.equal(st.practiceFocus,'finish the example');assert.equal(validity,'');assert.equal(draws,1);
});
test('actual retained goal and focus controls preserve choices across redraws and reject stale edits',()=>{
  const extract=id=>{
    const marker="main.querySelector('#"+id+"').addEventListener('change', ",from=source.indexOf(marker)+marker.length;
    assert.ok(from>=marker.length);return source.slice(from,source.indexOf('\n    });',from))+'\n}';
  };
  const st=settings.defaultSettings(),cfg={targetQuestions:12},session={retry:{wizard:{goal:'Full IV Simulation'}},retryOf:'own-retry'};
  let current=true,draws=0;
  const context={st,cfg,session,isCurrent:()=>current,draw:()=>draws++,PRACTICE_GOALS:settings.PRACTICE_GOALS,normalizeMockPracticeFocus:settings.normalizeMockPracticeFocus};
  const goal=vm.runInNewContext('('+extract('adv-goal')+')',context),focus=vm.runInNewContext('('+extract('adv-focus')+')',context);
  goal({target:{value:'Guided Mock IV Practice'}});focus({target:{value:'name my contribution',setCustomValidity(){},reportValidity(){}}});
  assert.equal(st.goal,'Guided Mock IV Practice');assert.equal(st.practiceFocus,'name my contribution');assert.equal(session.retryOf,null);
  assert.ok(settings.toWizard(st).focus.includes('name my contribution'));
  goal({target:{value:'Individual Question'}});assert.equal(st.pressure,false);
  assert.equal(settings.resolveMockQuestionTarget(cfg.targetQuestions,5,{goal:st.goal}),1);
  goal({target:{value:'Full IV Simulation'}});assert.equal(cfg.targetQuestions,12);assert.equal(st.practiceFocus,'name my contribution');
  const before=draws;current=false;goal({target:{value:'Individual Question'}});focus({target:{value:'stale'}});
  assert.equal(st.goal,'Full IV Simulation');assert.equal(st.practiceFocus,'name my contribution');assert.equal(draws,before);
});
