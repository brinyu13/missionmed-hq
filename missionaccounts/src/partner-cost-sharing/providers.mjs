import { createHmac } from 'node:crypto';
import { StripeGateway } from '../payments/stripe.mjs';
import { fail, text } from './ledger.mjs';
import { authenticateReceiptEnvelope, proposeExpense, classifyExpenseCandidates } from './ingestion.mjs';
import { digest, PARTNERS } from './domain.mjs';

export class PartnerStripeAdapter {
 constructor({gateway=new StripeGateway(),mode='disabled',moneyAuthorization=null,revalidate=null,reserveDispatch=null,recordDispatch=null}={}){this.gateway=gateway;this.mode=mode;this.moneyAuthorization=moneyAuthorization;this.revalidate=revalidate;this.reserveDispatch=reserveDispatch;this.recordDispatch=recordDispatch;}
 assertProvider(){if(this.mode!=='test'&&this.mode!=='live')fail('Partner card provider is disabled',503);this.gateway.assertMutationAllowed();}
 createCustomer({partner,email,name},requestId) {
  this.assertProvider();if(!PARTNERS.includes(partner))fail('Registered partner required');text(requestId,'Provider request ID',160);return this.gateway.request('customers',{email,name,'metadata[domain]':'partner_cost_sharing','metadata[partner]':partner},'partner-cost-sharing:customer:'+partner+':'+requestId);
 }
 async verifyCustomer(partner,customerReference) {
  this.assertProvider();if(!PARTNERS.includes(partner)||!/^cus_[A-Za-z0-9]+$/.test(customerReference||''))fail('Registered partner customer required');
  const customer=await this.gateway.retrieve('customers/'+encodeURIComponent(customerReference));
  if(customer.deleted||customer.metadata?.domain!=='partner_cost_sharing'||customer.metadata?.partner!==partner)fail('Customer domain binding differs');
  return customer;
 }
 async createSetupIntent({partner,customerReference},requestId) {
  text(requestId,'Provider request ID',160);await this.verifyCustomer(partner,customerReference);return this.gateway.request('setup_intents',{customer:customerReference,usage:'off_session','payment_method_types[]':'card','metadata[domain]':'partner_cost_sharing','metadata[partner]':partner},'partner-cost-sharing:setup:'+partner+':'+requestId);
 }
 async verifyMethod({partner,customerReference,methodReference}) {
  this.assertProvider();if(!/^pm_[A-Za-z0-9]+$/.test(methodReference||''))fail('Own provider method reference required');const row=await this.gateway.retrievePaymentMethod(methodReference);
  if(row.customer!==customerReference||row.type!=='card')fail('Method does not belong to own partner customer');
  await this.verifyCustomer(partner,customerReference);
  return {partner,domain:'partner_cost_sharing',reference:row.id,customerReference,providerVerified:true,brand:row.card?.brand,last4:row.card?.last4};
 }
 async removeMethod(binding,requestId){text(requestId,'Provider request ID',160);await this.verifyMethod(binding);return this.gateway.detachPaymentMethod(binding.methodReference,'partner-cost-sharing:remove:'+binding.partner+':'+requestId);}
 async collect(proposal,{shadow=true}={}) {
  if(proposal?.domain!=='partner_cost_sharing'||!PARTNERS.includes(proposal.partner)||!proposal.consentId||proposal.amountCents<=0||!Number.isSafeInteger(proposal.amountCents)||!Number.isSafeInteger(proposal.revision)||!/^[0-9a-f]{64}$/.test(proposal.snapshotHash||'')||!/^pm_[A-Za-z0-9]+$/.test(proposal.methodReference||'')||!/^cus_[A-Za-z0-9]+$/.test(proposal.customerReference||'')||proposal.currency!=='USD'||proposal.idempotencyKey!==`partner-cost-sharing:collect:${proposal.obligationId}:r${proposal.revision}:s${proposal.settlementRevision||0}`)fail('Certified collection proposal required');
  if(shadow)return {...proposal,state:'SHADOW_ONLY',moneyMoved:false};
  this.assertProvider();
  const gate=this.moneyAuthorization;
  // A separate exact acceptance capability is required even in provider Test Mode.
  const bound=['partner','obligationId','periodId','revision','settlementRevision','snapshotHash','amountCents','currency','consentId','methodReference','customerReference','idempotencyKey'];
  if(!gate||bound.some(k=>gate[k]!==proposal[k])||!Number.isFinite(Date.parse(gate.expiresAt))||Date.parse(gate.expiresAt)<=Date.now()||typeof this.revalidate!=='function'||typeof this.reserveDispatch!=='function'||typeof this.recordDispatch!=='function')fail('Exact money-moving acceptance authority is absent',403);
  await this.verifyMethod({partner:proposal.partner,customerReference:proposal.customerReference,methodReference:proposal.methodReference});
  const current=await this.revalidate(proposal.partner,proposal.obligationId);
  if(!current||bound.some(k=>current[k]!==proposal[k]))fail('Consent, ownership or obligation changed before dispatch',409);
  const reservation=await this.reserveDispatch(current,gate);
  if(!reservation?.dispatchId||reservation.state!=='DISPATCHING'||bound.some(k=>reservation[k]!==current[k]))fail('Atomic current-consent dispatch reservation required',409);
  const result=await this.gateway.request('payment_intents',{amount:String(proposal.amountCents),currency:'usd',customer:proposal.customerReference,payment_method:proposal.methodReference,off_session:'true',confirm:'true',
   'metadata[domain]':'partner_cost_sharing','metadata[partner]':proposal.partner,'metadata[obligation_id]':proposal.obligationId,'metadata[revision]':String(proposal.revision),'metadata[settlement_revision]':String(proposal.settlementRevision||0),'metadata[snapshot_hash]':proposal.snapshotHash,'metadata[consent_id]':proposal.consentId},proposal.idempotencyKey);
  if(!/^pi_[A-Za-z0-9]+$/.test(result?.id||''))fail('Provider dispatch result is ambiguous; review reserved attempt',409);
  await this.recordDispatch(reservation.dispatchId,result.id,['succeeded','processing'].includes(result.status)?'DISPATCHING':'NEEDS_REVIEW');
  return {providerPaymentId:result.id,dispatchId:reservation.dispatchId,state:'AWAITING_AUTHENTICATED_WEBHOOK',verified:false};
 }
 webhook(raw,signature,{dispatch}={}) {
  this.gateway.verifyWebhook(raw,signature);let event;try{event=JSON.parse(raw);}catch{fail('Webhook payload malformed',400);}
  const object=event.data?.object;
  if(object?.metadata?.domain!=='partner_cost_sharing')return {ignored:true};
  if(event.type!=='payment_intent.succeeded')return {state:'NEEDS_REVIEW',providerEventId:event.id,moneyMoved:false};
  if(object.status!=='succeeded'||object.currency!=='usd'||object.amount_received!==object.amount||!Number.isSafeInteger(object.amount))fail('Webhook payment amounts differ');
  if(!dispatch||dispatch.providerPaymentId!==object.id||dispatch.partner!==object.metadata.partner||dispatch.obligationId!==object.metadata.obligation_id||dispatch.revision!==Number(object.metadata.revision)||dispatch.settlementRevision!==Number(object.metadata.settlement_revision||0)||dispatch.snapshotHash!==object.metadata.snapshot_hash||dispatch.consentId!==object.metadata.consent_id||dispatch.amountCents!==object.amount||dispatch.customerReference!==object.customer||dispatch.methodReference!==object.payment_method)fail('Webhook differs from the durable authorized dispatch');
  return {providerEventId:event.id,method:'stripe_webhook',signatureVerified:true,obligationId:object.metadata.obligation_id,partner:object.metadata.partner,expectedRevision:Number(object.metadata.revision),expectedSettlementRevision:Number(object.metadata.settlement_revision||0),
   snapshotHash:object.metadata.snapshot_hash,amountCents:object.amount,receivedAt:new Date(event.created*1000).toISOString(),providerPaymentId:object.id,fingerprint:digest({domain:'partner_cost_sharing',paymentId:object.id}),evidenceSha256:digest(raw)};
 }
}

export class PartnerGmailAdapter {
 constructor({endpoint='',secret='',mode='disabled',fetchImpl=fetch}={}){this.endpoint=endpoint;this.secret=secret;this.mode=mode;this.fetch=fetchImpl;}
 async receipts({requestId,eligibleObligations}) {
  if(this.mode!=='shadow')return {state:'DISABLED',receipts:[],posted:false};
  const url=new URL(this.endpoint);if(url.protocol!=='https:'||!this.secret)fail('Authenticated partner receipt bridge is not configured',503);
  // Partner protocol is isolated. Never call the donor's course/order matching endpoint.
  const payload=JSON.stringify({domain:'partner_cost_sharing',protocolVersion:2,requestId,eligibleObligations});
  const timestamp=Date.now(),nonce=crypto.randomUUID(),signature=createHmac('sha256',this.secret).update(timestamp+'\n'+nonce+'\n'+payload).digest('hex');
  const response=await this.fetch(url,{method:'POST',headers:{'content-type':'application/json','x-pcs-timestamp':String(timestamp),'x-pcs-nonce':nonce,'x-pcs-signature':signature},body:payload,signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!response.ok)fail('Partner receipt bridge unavailable',503);
  const raw=await response.text();
  return {state:'SHADOW',receipts:authenticateReceiptEnvelope(raw,{timestamp:response.headers.get('x-pcs-timestamp'),nonce:response.headers.get('x-pcs-nonce'),signature:response.headers.get('x-pcs-signature')},this.secret),posted:false};
 }
}

export class PartnerVendorAdapter {
 constructor({mode='disabled',readInvoices=null,custody=null}={}){this.mode=mode;this.readInvoices=readInvoices;this.custody=custody;}
 async discover(known=[]) {
  if(this.mode!=='shadow'||!this.readInvoices||!this.custody)return {state:'DISABLED',proposals:[],held:[],posted:false};
  const invoices=await this.readInvoices();if(!Array.isArray(invoices)||invoices.length>1000)fail('Vendor batch exceeds bounded census');
  const proposals=[];
  for(const invoice of invoices){const proof=await this.custody(invoice);proposals.push(proposeExpense(invoice,{sourceSha256:proof.sha256,assetId:proof.assetId,sourceKind:proof.sourceKind}));}
  return {state:'SHADOW',...classifyExpenseCandidates(proposals,known)};
 }
}
