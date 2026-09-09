import test from 'node:test';
import assert from 'node:assert/strict';
import {installFamilyRuntime022} from '../web/js/production/family-runtime-022.js';

function fixture({subject=true,manager=true,mobile=true}={}){
  const elements=new Map(),changes=new Set();
  class Element{
    constructor(){this.listeners=new Map();this.children=[];this.parentElement=null;}
    append(child){child.parentElement?.children.splice(child.parentElement.children.indexOf(child),1);this.children.push(child);child.parentElement=this;if(child.id)elements.set(child.id,child);}
    addEventListener(kind,handler){this.listeners.set(kind,handler);}
    querySelector(selector){return selector==='.family022ToolsList'?tools:null;}
  }
  const rail=new Element(),tools=new Element();elements.set('rail',rail);rail.append(tools);
  const media={matches:mobile,addEventListener(kind,fn){assert.equal(kind,'change');changes.add(fn);},removeEventListener(kind,fn){assert.equal(kind,'change');changes.delete(fn);}};
  const documentObject={getElementById:id=>elements.get(id),createElement:()=>new Element(),addEventListener(){},removeEventListener(){},dispatchEvent(){}};
  const claims={role:'PROGRAM_ADMIN',adminWorkspace:true,founderStandardsManager:manager,principalId:'local-founder',displayName:'Local Founder'};
  const runtime={authClient:{bootstrapState:claims,subscribeClaims:()=>()=>{}},subject:subject?{principalId:'local-subject',displayName:'Local Synthetic Student'}:null,remotePersistenceAllowed:false};
  const store={document:{id:'local-doc'},saveStatus:'saved',subscribe:()=>()=>{}};
  const windowObject={navigator:{onLine:true},matchMedia:query=>{assert.equal(query,'(max-width:650px)');return media;},addEventListener(){},removeEventListener(){}};
  const controller=installFamilyRuntime022({runtime,store,bridge:{},documentObject,windowObject});
  return {rail,tools,elements,changes,controller,resize(value){media.matches=value;for(const fn of changes)fn();}};
}

test('selected mobile moves the existing authorized Founder Standard into Tools and restores its desktop node/listener',()=>{
  const f=fixture();const button=f.elements.get('timelineStandards022'),listener=button.listeners.get('click');
  assert.equal(button.parentElement,f.tools);assert.equal(f.tools.children.filter(x=>x===button).length,1);
  f.resize(false);assert.equal(button.parentElement,f.rail);assert.equal(button.listeners.get('click'),listener);
  f.resize(true);assert.equal(button.parentElement,f.tools);assert.equal(button.listeners.get('click'),listener);
  f.resize(true);assert.equal(f.tools.children.filter(x=>x===button).length,1);
  f.controller.destroy();assert.equal(f.changes.size,0);
});

test('mobile Admin Home keeps Founder Standard on its rail and unavailable capability creates no control',()=>{
  const landing=fixture({subject:false});assert.equal(landing.elements.get('timelineStandards022').parentElement,landing.rail);landing.controller.destroy();
  for(const mobile of [true,false]){
    const denied=fixture({manager:false,mobile});assert.equal(denied.elements.has('timelineStandards022'),false);
    denied.resize(!mobile);assert.equal(denied.elements.has('timelineStandards022'),false);denied.controller.destroy();
  }
});
