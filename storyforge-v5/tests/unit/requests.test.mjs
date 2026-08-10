import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestsService, RequestsError } from '../../server/requests.mjs';
import { createPostmarkService, postmarkMode } from '../../server/postmark.mjs';
import { normalizeContributorLibrary } from '../../scripts/seed-contributor-prompts.mjs';
import { readFile } from 'node:fs/promises';

const studentId='11111111-1111-4111-8111-111111111111';
const promptId='22222222-2222-4222-8222-222222222222';
const identity={sub:studentId,role:'student',eligible:true,firstName:'Maya'};

test('Postmark uses triple gating and never treats send acceptance as delivery',async()=>{assert.equal(postmarkMode({}),'off');assert.equal(postmarkMode({STORYFORGE_POSTMARK_ENABLED:'1',STORYFORGE_POSTMARK_DRY_RUN:'1'}),'dry_run');assert.equal(postmarkMode({STORYFORGE_POSTMARK_ENABLED:'1',STORYFORGE_POSTMARK_DRY_RUN:'0',STORYFORGE_POSTMARK_LIVE_SEND_ENABLED:'1'}),'live');const service=createPostmarkService({environment:{STORYFORGE_POSTMARK_ENABLED:'1',STORYFORGE_POSTMARK_DRY_RUN:'1',STORYFORGE_POSTMARK_FROM:'verified@example.com',STORYFORGE_POSTMARK_REPLY_TO:'reply@example.com'}});assert.deepEqual(await service.send({to:'guest@example.com',subject:'subject',htmlBody:'html',textBody:'text'}),{accepted:false,dryRun:true,providerMessageId:null});});

test('canonical contributor library is stable, unique, and complete',async()=>{const source=JSON.parse(await readFile(new URL('../../content/contributor-prompts.json',import.meta.url),'utf8'));const first=normalizeContributorLibrary(source);assert.equal(first.length,48);assert.equal(new Set(first.map((item)=>item.id)).size,48);assert.equal(new Set(first.flatMap((item)=>item.relationships)).size,13);assert.deepEqual(first,normalizeContributorLibrary(source));});

function service({environment={},identityQuery,serviceQuery,postmark}={}){const env={STORYFORGE_REQUEST_A_STORY_FORCE_OFF:'0',STORYFORGE_GUEST_CONTRIBUTIONS_FORCE_OFF:'0',STORYFORGE_GUEST_DISCLOSURE_VERSION:'founder-v1',STORYFORGE_PUBLIC_URL:'https://example.test/storyforge',...environment};return createRequestsService({environment:env,postmark:postmark||{send:async()=>({accepted:true,dryRun:false,providerMessageId:'provider-1'})},withIdentity:async(_identity,operation)=>operation({query:identityQuery|| (async(sql)=>sql.includes('sf_story_feature_enabled')?{rows:[{enabled:true}]}:{rows:[],rowCount:1})}),withServiceTransaction:async(operation)=>operation({query:serviceQuery|| (async(sql)=>sql.includes("key='guest_contributions'")?{rows:[{enabled:true}]}:{rows:[],rowCount:1})})});}

test('Request a Story defaults closed and remains student-only',async()=>{assert.equal(await service({environment:{STORYFORGE_REQUEST_A_STORY_FORCE_OFF:'1'}}).capability(identity),false);assert.equal(await service().capability(identity),true);assert.equal(await service().capability({...identity,role:'mentor'}),false);});

test('student create validates governed relationship and never returns raw email',async()=>{let inserted;const subject=service({identityQuery:async(sql,values)=>{if(sql.includes('sf_story_feature_enabled'))return{rows:[{enabled:true}]};if(sql.includes('INSERT INTO public.sf_story_invitations')){inserted=values;return{rows:[{id:promptId,contributor_first_name:'Sam',relationship_id:'parent',email:'sam@example.com',status:'draft',personal_message:'Hello',disclosure_version:'founder-v1',reminders_sent:0,row_version:'0'}]};}return{rows:[]};}});const result=await subject.create(identity,{recipientFirstName:'Sam',relationship:'parent',email:'sam@example.com',personalMessage:'Hello'});assert.equal(result.maskedEmail,'s***@example.com');assert.equal(JSON.stringify(result).includes('sam@example.com'),false);assert.equal(inserted[1],'parent');await assert.rejects(()=>subject.create(identity,{recipientFirstName:'Sam',relationship:'stranger',email:'sam@example.com'}),RequestsError);});

test('guest token errors are uniform and malformed tokens never reach storage',async()=>{let calls=0;const subject=service({serviceQuery:async(sql)=>{calls+=1;if(sql.includes("key='guest_contributions'"))return{rows:[{enabled:true}]};return{rows:[]};}});await assert.rejects(()=>subject.guestView('not-a-token'),(error)=>error.code==='invitation_not_found'&&error.status===404);assert.equal(calls,1);});

test('guest contribution enforces 20k transcript bound before database mutation',async()=>{const subject=service();await assert.rejects(()=>subject.contribute('A'.repeat(43),{promptId,transcript:'x'.repeat(20001)}),(error)=>error.code==='invalid_contribution');});
