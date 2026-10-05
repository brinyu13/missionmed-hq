import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSchedule, onboardingState, chargeAuthorization, deterministicZelleMatch, aggregateApplications, exactDate, safeStudentProjection } from '../src/mission-residency-finance/operations-domain.mjs';
import { MissionResidencyStripe } from '../src/mission-residency-finance/stripe-provider.mjs';
const evidence={authority_ref:'DR-fixture',evidence_sha256:'a'.repeat(64)};
test('plans allocate certified residuals without duplicating principal or fabricating dates',()=>{
 const args={obligations:[{id:'parent',remaining_cents:10000}],installments:[{key:'one',obligation_id:'parent',amount_cents:5000,due_on:null},{key:'two',obligation_id:'parent',amount_cents:5000,due_on:'2026-11-05'}],evidence};
 assert.equal(validateSchedule(args)[0].due_precision,'UNKNOWN');
 assert.throws(()=>validateSchedule({...args,installments:args.installments.concat([{key:'three',obligation_id:'parent',amount_cents:1,due_on:null}])}),/exceeds/);
 assert.throws(()=>validateSchedule({...args,installments:[{...args.installments[0],obligation_id:'other'}]}),/certified obligation/);
 assert.throws(()=>exactDate('2026-02-30'),/established/);
 assert.deepEqual(aggregateApplications([{obligation_id:'parent',amount_cents:5000},{obligation_id:'parent',amount_cents:5000}]),[{obligation_id:'parent',amount_cents:10000}]);
});
test('PIF needs no card; held onboarding eligibility is explicit and does not create debt',()=>{
 assert.equal(onboardingState({subject:{certification_state:'CERTIFIED'},eligibility:{required:false}}).state,'NOT_REQUIRED');
 const args={subject:{certification_state:'HELD'},eligibility:{required:true,card_required:true}};
 assert.deepEqual(onboardingState(args).missing,['identity_contact','arrangement_acknowledgment','payment_method']);
 const result=onboardingState({...args,profile:{phone:'+1 555 0100',email:'fixture@example.invalid',contact_confirmed:true},method:{state:'READY'},acknowledgment:{arrangement_acknowledged:true}});
 assert.equal(result.state,'COMPLETE');assert.equal(result.account_review,true);
});
test('stored method is not unlimited charge consent; require exact obligation, amount, method and Founder confirmation',()=>{
 const args={subject:{subject_key:'fixture',certification_state:'CERTIFIED'},obligation:{id:'o',subject_key:'fixture',remaining_cents:10000},request:{id:'r',obligation_id:'o',amount_cents:5000,state:'OPEN',...evidence},method:{id:'m',subject_key:'fixture',state:'READY'},confirmation:true};
 assert.throws(()=>chargeAuthorization(args),/does not authorize/);
 args.authorization={state:'ACTIVE',subject_key:'fixture',request_id:'r',payment_method_id:'m',amount_cents:5000,scope:'SPECIFIC_OBLIGATION',terms_version:'approved-fixture',accepted_at:'2026-10-05T00:00:00Z'};
 assert.equal(chargeAuthorization(args),5000);
 assert.throws(()=>chargeAuthorization({...args,subject:{...args.subject,certification_state:'HELD'}}),/review/);
 assert.throws(()=>chargeAuthorization({...args,authorization:{...args.authorization,amount_cents:10000}}),/does not authorize/);
 assert.throws(()=>chargeAuthorization({...args,confirmation:false}),/confirmation/);
});
test('Zelle claims are not evidence; exact unique verified beneficiary match and global replay protection',()=>{
 const receipt={verified:true,provider:'Chase',reference:'123456789',fingerprint:'b'.repeat(64),amount_cents:5000,payer:'Family Payer'};
 const candidate={id:'r',certified:true,state:'OPEN',amount_cents:5000,beneficiary_verified:true,payers:[{name:' Family   Payer ',verified:true}]};
 const args={receipt,candidates:[candidate],consumedReferences:[],consumedFingerprints:[]};
 assert.equal(deterministicZelleMatch(args).state,'MATCHED');
 assert.equal(deterministicZelleMatch({...args,candidates:[]}).reason,'NO_MATCH');
 assert.equal(deterministicZelleMatch({...args,candidates:[candidate,{...candidate,id:'second'}]}).reason,'MULTIPLE_MATCHES');
 assert.throws(()=>deterministicZelleMatch({...args,consumedReferences:['123456789']}),/consumed/);
 assert.throws(()=>deterministicZelleMatch({...args,receipt:{...receipt,verified:false}}),/Authentic/);
 assert.equal(deterministicZelleMatch({...args,candidates:[{...candidate,amount_cents:5001}]}).state,'REVIEW_REQUIRED');
});
test('MR Stripe pins a separate account before every mutation; failure never invokes another gateway',async()=>{
 const gateway=new MissionResidencyStripe({accountId:'acct_MRfixture',mode:'test',secretKey:'sk_test_fixture'});let writes=0;
 gateway.retrieveAccount=async()=>({id:'acct_ExamPrepFixture',charges_enabled:true});gateway.request=async()=>{writes++;};
 await assert.rejects(()=>gateway.createResidencySetup({customerId:'cus_fixture',subjectKey:'fixture',requestId:'setup-fixture-1'}),/verification failed/);assert.equal(writes,0);
 gateway.retrieveAccount=async()=>({id:'acct_MRfixture',charges_enabled:true});let observed;
 gateway.request=async(path,params,key)=>{observed={path,params,key};return{id:'pi_fixture'};};
 await gateway.createResidencyPayment({attemptId:'attempt-fixture-1',requestId:'request-fixture-1',customerId:'cus_fixture',subjectKey:'fixture',amountCents:5000,offSession:false});
 assert.equal(observed.params['metadata[namespace]'],'mission_residency_finance');assert.equal(observed.params.amount,'5000');assert.equal(observed.params.confirm,undefined);assert.match(observed.key,/mr-finance:payment:attempt-fixture-1/);
});
test('card success requires current provider proof; decline, 3DS, mismatched amount and reversal never mark paid',async()=>{
 const gateway=new MissionResidencyStripe({accountId:'acct_MRfixture',mode:'test',secretKey:'sk_test_fixture'});gateway.verifyAccount=async()=>({id:'acct_MRfixture'});
 const expected={customerId:'cus_fixture',subjectKey:'fixture',attemptId:'attempt-fixture-1',requestId:'request-fixture-1',amountCents:5000,paymentMethodId:'pm_fixture'};
 const intent={customer:'cus_fixture',payment_method:'pm_fixture',amount:5000,currency:'usd',livemode:false,metadata:{namespace:'mission_residency_finance',financial_subject:'fixture',attempt_id:'attempt-fixture-1',request_id:'request-fixture-1'},status:'requires_action'};
 gateway.retrieve=async()=>intent;assert.equal((await gateway.paymentResult('pi_fixture',expected)).state,'REQUIRES_ACTION');
 intent.status='requires_payment_method';assert.equal((await gateway.paymentResult('pi_fixture',expected)).state,'DECLINED');
 intent.status='succeeded';intent.amount_received=5000;intent.latest_charge={id:'ch_fixture',paid:true,captured:true,amount_captured:5000,amount:5000,currency:'usd',payment_intent:'pi_fixture',created:1800000000,amount_refunded:0,refunded:false};
 assert.equal((await gateway.paymentResult('pi_fixture',expected)).state,'SUCCEEDED');
 intent.payment_method='pm_other';await assert.rejects(()=>gateway.paymentResult('pi_fixture',expected),/mismatch/);intent.payment_method='pm_fixture';
 intent.metadata.request_id='other';await assert.rejects(()=>gateway.paymentResult('pi_fixture',expected),/mismatch/);intent.metadata.request_id='request-fixture-1';
 intent.amount=5001;await assert.rejects(()=>gateway.paymentResult('pi_fixture',expected),/mismatch/);intent.amount=5000;
 intent.latest_charge.amount_captured=4999;await assert.rejects(()=>gateway.paymentResult('pi_fixture',expected),/incomplete/);intent.latest_charge.amount_captured=5000;
 intent.amount_received=4999;await assert.rejects(()=>gateway.paymentResult('pi_fixture',expected),/incomplete/);intent.amount_received=5000;
 intent.latest_charge.refunded=true;await assert.rejects(()=>gateway.paymentResult('pi_fixture',expected),/reversed/);
});
test('held student projection excludes debt and private evidence; own certified receipts expose safe history',()=>{
 const a={state:'HELD',program:'Mission Residency',payments:[{provider_pm_ref:'private',verification_state:'VERIFIED'}],cases:[{reason:'private forensic'}],balance:{balance_cents:10000}};
 const p=safeStudentProjection(a,{state:'IN_PROGRESS'},[{id:'request',amount_cents:10000}]);assert.equal(p.balance,null);assert.deepEqual(p.payment_requests,[]);assert.doesNotMatch(JSON.stringify(p),/private|forensic|provider_pm_ref/);
});

import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createMissionAccountsServer } from '../src/server.mjs';
import { FinancialOperationsService } from '../src/mission-residency-finance/operations-service.mjs';
const founderId=randomUUID(), ownId=randomUUID(), testSecret=randomBytes(32).toString('hex');
const testConfig={production:true,localAuth:false,jwtSecret:testSecret,issuer:'financial-fixture',audience:'missionaccounts',features:{},basePath:'/missionaccounts/',partnerCostSharing:{enabled:false},missionResidencyFinance:{operations:true,onboarding:true,publication:false,cardDispatch:false}};
function signed(role,id,wp){const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const now=Math.floor(Date.now()/1000),h=enc({alg:'HS256',typ:'JWT'}),b=enc({sub:id,wp_user_id:wp,jti:randomUUID(),iat:now,exp:now+120,iss:testConfig.issuer,aud:testConfig.audience,app_role:role,missionaccounts_eligible:true,program_access:{registered:true,programs:{mission_residency:{enrolled:false},examprep:{enrolled:false},clinicals:{enrolled:false}}}});return h+'.'+b+'.'+createHmac('sha256',testSecret).update(h+'.'+b).digest('base64url');}
test('actual HTTP routes preserve explicit Founder, own-account binding, publication gates, assets and privacy',async()=>{
 const calls=[];const store={rpc:async(name,args)=>{calls.push([name,args]);
  if(name==='api_financial_read_access')return args.p_principal===founderId&&args.p_wp_user_id===1;
  if(name==='api_financial_operating_command')return {gates:{founder_operations:true},accounts:[]};
  if(name==='api_financial_own_onboarding'){if(args.p_principal!==ownId||args.p_wp_user_id!==77)throw Object.assign(Error('Own account denied'),{status:403});return {eligibility:{required:true,card_required:true},profile:null,method:null,certification_state:'HELD'};}
  throw Error('Unexpected RPC: '+name);
 }};
 const server=createMissionAccountsServer({config:testConfig,store,residencyStripe:{},stripeGateway:{},notificationGateway:{},partnerStore:null});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/missionaccounts`;
 const req=(path,t,method='GET')=>fetch(base+'/api'+path,{method,headers:t?{authorization:'Bearer '+t,'content-type':'application/json'}:{},...(method==='POST'?{body:'{}'}:{})});
 try {
  assert.equal((await req('/mission-residency-finance/operations')).status,401);
  for(const t of [signed('missionaccounts_admin',randomUUID(),2),signed('student',ownId,77),signed('founder',founderId,2),signed('registered',ownId,77)])assert.equal((await req('/mission-residency-finance/operations',t)).status,403);
  assert.equal((await req('/mission-residency-finance/operations',signed('founder',founderId,1))).status,200);
  const own=await req('/me/mission-residency-finance/onboarding',signed('registered',ownId,77));assert.equal(own.status,200);assert.match(own.headers.get('cache-control'),/no-store, private/);assert.equal((await own.json()).account_review,true);
  assert.equal((await req('/me/mission-residency-finance/onboarding',signed('registered',randomUUID(),77))).status,403);
  assert.equal((await req('/me/mission-residency-finance/onboarding',signed('student',ownId,78))).status,403);
  assert.equal((await req('/me/mission-residency-finance',signed('student',ownId,77))).status,403);
  assert.equal((await req('/me/mission-residency-finance/card',signed('student',ownId,77),'POST')).status,403);
  for(const asset of ['mission-residency-finance','mission-residency-finance-view','mission-residency-operations-view','mission-residency-student','stripe','mission-residency-finance-style']){const r=await fetch(base+'/assets/'+asset);assert.equal(r.status,200,asset);assert.match(r.headers.get('content-type'),/javascript|css/);}
  assert.equal(calls.some(([name])=>/prepare|settle|record|charge/.test(name)),false);
 }finally{await new Promise(r=>server.close(r));}
});
test('missing MR provider configuration fails closed without using the ExamPrep gateway',async()=>{
 let calls=0;const service=new FinancialOperationsService({store:{rpc:async()=>{calls++;}},config:{onboarding:true,stripeAccount:'acct_MR',publishableKey:'pk_test_fixture'},stripe:{accountId:'acct_EXAMPREP',configurationState:()=>({mode:'test',mutations_enabled:true})}});
 await assert.rejects(()=>service.setup({userId:ownId,wpUserId:77,roles:['student']},'setup-fixture-123'),/not released/);assert.equal(calls,0);
});
test('owned pending card recovery never creates a new intent; cross-account and swapped second read are denied',async()=>{
 const pair={userId:ownId,wpUserId:77,roles:['registered']};let prepares=0,writes=0,checks=0;
 const attempt={id:randomUUID(),request_id:randomUUID(),subject_key:'match360:fixture',customer_ref:'cus_fixture',amount_cents:5000,intent_ref:'pi_fixture',state:'REQUIRES_ACTION'};
 const intent={id:'pi_fixture',customer:'cus_fixture',amount:5000,currency:'usd',livemode:false,status:'requires_action',client_secret:'test-client-secret',metadata:{namespace:'mission_residency_finance',financial_subject:attempt.subject_key,attempt_id:attempt.id,request_id:attempt.request_id}};
 const store={rpc:async(name,args)=>{if(args.p_principal!==ownId||args.p_wp_user_id!==77)throw Object.assign(Error('Own account denied'),{status:403});if(name==='api_financial_prepare_card'){prepares++;throw Error('Recovery must not prepare');}if(name==='api_financial_card_attempt')return attempt;if(name==='api_financial_card_result'){checks++;return{state:args.p_state};}throw Error(name);}};
 const stripe={accountId:'acct_MRfixture',configurationState:()=>({mode:'test',mutations_enabled:true}),paymentResult:async()=>({state:'REQUIRES_ACTION'}),retrieve:async()=>intent,createResidencyPayment:async()=>{writes++;}};
 const service=new FinancialOperationsService({store,stripe,config:{publication:true,cardDispatch:true,stripeAccount:'acct_MRfixture',publishableKey:'pk_test_fixture'}});
 const resumed=await service.resumeCard(pair,attempt.id);assert.equal(resumed.client_secret,'test-client-secret');assert.equal(checks,1);assert.equal(prepares,0);assert.equal(writes,0);
 await assert.rejects(()=>service.resumeCard({...pair,userId:randomUUID()},attempt.id),/Own account/);
 intent.customer='cus_other';await assert.rejects(()=>service.resumeCard(pair,attempt.id),/ownership mismatch/);intent.customer='cus_fixture';
 attempt.state='SUCCEEDED';attempt.payment_id=randomUUID();assert.equal((await service.resumeCard(pair,attempt.id)).client_secret,undefined);
 attempt.state='AMBIGUOUS';attempt.intent_ref=null;assert.deepEqual(await service.resumeCard(pair,attempt.id),{state:'AMBIGUOUS',attempt_id:attempt.id});assert.equal(writes,0);
});
test('secure setup confirmation accepts only a provider-attached own card in the pinned MR account',async()=>{
 const gateway=new MissionResidencyStripe({accountId:'acct_MRfixture',mode:'test',secretKey:'sk_test_fixture'});gateway.verifyAccount=async()=>({id:'acct_MRfixture'});
 const expected={customerId:'cus_fixture',subjectKey:'match360:fixture',requestId:'setup-fixture-1'};
 const setup={id:'seti_fixture',customer:'cus_fixture',livemode:false,status:'succeeded',metadata:{namespace:'mission_residency_finance',financial_subject:expected.subjectKey,request_id:expected.requestId},payment_method:{id:'pm_fixture',customer:'cus_fixture',type:'card',livemode:false,card:{brand:'visa',last4:'4242',exp_month:10,exp_year:2028}}};
 gateway.retrieve=async()=>setup;assert.equal((await gateway.setupResult(setup.id,expected)).last4,'4242');
 setup.payment_method.customer='cus_other';await assert.rejects(()=>gateway.setupResult(setup.id,expected),/unavailable/);setup.payment_method.customer='cus_fixture';
 setup.metadata.namespace='examprep';await assert.rejects(()=>gateway.setupResult(setup.id,expected),/mismatch/);
});
test('provider callbacks require a valid MR signature and refetch provider proof instead of trusting webhook status',async()=>{
 const secret=randomBytes(24).toString('hex'),actor=randomUUID();let calls=0,proofs=0;
 const stripe=new MissionResidencyStripe({accountId:'acct_MRfixture',mode:'test',secretKey:'sk_test_fixture',webhookSecret:secret});
 stripe.setupResult=async()=>{proofs++;return{intent_ref:'seti_fixture',provider_account:'acct_MRfixture'};};
 const store={rpc:async(name,args)=>{calls++;if(name==='api_financial_provider_context')return{principal:actor,subject_key:'match360:fixture',customer_ref:'cus_fixture',request_id:'setup-fixture-1',intent_ref:'seti_fixture'};if(name==='api_financial_confirm_setup'){assert.equal(args.p_wp_user_id,0);assert.equal(args.p_principal,actor);return{duplicate:true};}throw Error(name);}};
 const service=new FinancialOperationsService({store,stripe,config:{providerEvents:true,stripeAccount:'acct_MRfixture',publishableKey:'pk_test_fixture',settlementActor:'fixture-provider'}});
 const event={id:'evt_fixture',type:'setup_intent.succeeded',data:{object:{id:'seti_fixture',metadata:{namespace:'mission_residency_finance',request_id:'setup-fixture-1'}}}},raw=Buffer.from(JSON.stringify(event)),now=Math.floor(Date.now()/1000);
 await assert.rejects(()=>service.receiveProviderEvent(raw,'invalid'),/signature invalid/);assert.equal(calls,0);
 const sig='t='+now+',v1='+createHmac('sha256',secret).update(now+'.'+raw).digest('hex');assert.equal((await service.receiveProviderEvent(raw,sig)).received,true);assert.equal(proofs,1);assert.equal(calls,2);
 service.config.providerEvents=false;await assert.rejects(()=>service.receiveProviderEvent(raw,sig),/not released/);
});
test('authenticated lost-response webhook locates and settles the existing attempt without another intent',async()=>{
 const secret=randomBytes(24).toString('hex'),actor=randomUUID(),id=randomUUID(),request=randomUUID();let settled=0,lookups=0;
 const stripe=new MissionResidencyStripe({accountId:'acct_MRfixture',mode:'test',secretKey:'sk_test_fixture',webhookSecret:secret});stripe.verifyAccount=async()=>({id:'acct_MRfixture'});
 stripe.retrieve=async reference=>{lookups++;assert.match(reference,/payment_intents\/pi_lost/);return{id:'pi_lost',customer:'cus_fixture',amount:5000,amount_received:5000,currency:'usd',livemode:false,status:'succeeded',metadata:{namespace:'mission_residency_finance',financial_subject:'match360:fixture',attempt_id:id,request_id:request},latest_charge:{id:'ch_lost',paid:true,captured:true,amount:5000,amount_captured:5000,currency:'usd',payment_intent:'pi_lost',created:1800000000,refunded:false,amount_refunded:0}};};
 stripe.createResidencyPayment=async()=>{throw Error('Recovery must not create another intent');};
 const store={rpc:async(name,args)=>{if(name==='api_financial_provider_context')return{principal:actor,attempt_id:id};if(name==='api_financial_card_attempt')return{id,subject_key:'match360:fixture',request_id:request,customer_ref:'cus_fixture',amount_cents:5000,state:'AMBIGUOUS',intent_ref:null};if(name==='api_financial_card_result'){assert.equal(args.p_intent,'pi_lost');assert.equal(args.p_state,'SUCCEEDED');assert.equal(args.p_wp_user_id,0);assert.equal(args.p_payment.gross_cents,5000);settled++;return{state:'SUCCEEDED',payment_id:randomUUID()};}throw Error(name);}};
 const service=new FinancialOperationsService({stripe,store,config:{providerEvents:true,stripeAccount:'acct_MRfixture',publishableKey:'pk_test_fixture',settlementActor:'fixture-provider'}});
 const raw=Buffer.from(JSON.stringify({type:'payment_intent.succeeded',data:{object:{id:'pi_lost',metadata:{namespace:'mission_residency_finance',attempt_id:id}}}})),now=Math.floor(Date.now()/1000),sig='t='+now+',v1='+createHmac('sha256',secret).update(now+'.'+raw).digest('hex');
 assert.equal((await service.receiveProviderEvent(raw,sig)).state,'SUCCEEDED');assert.equal(lookups,1);assert.equal(settled,1);
});
