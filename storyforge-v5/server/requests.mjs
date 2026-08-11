import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const relationships = new Set(['parent','sibling','spouse_partner','grandparent','cousin','best_friend','childhood_friend','medical_school_friend','faculty','mentor','coworker','supervisor','teammate']);

export class RequestsError extends Error {
  constructor(code, message, status = 400, options = {}) {
    super(message, options);
    this.name = 'RequestsError'; this.code = code; this.status = status;
  }
}

function off(value) { return !['0','false','no','off'].includes(String(value ?? '1').trim().toLowerCase()); }
function uuid(value, label) { const result=String(value||'').trim(); if(!uuidPattern.test(result)) throw new RequestsError('invalid_identifier',`${label} is invalid.`); return result; }
function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function maskEmail(value) { const [local,domain=''] = String(value).split('@'); return `${local.slice(0,1)}${local.length>1?'***':''}@${domain}`; }
function cleanEmail(value) { const result=String(value||'').trim().toLowerCase(); if(result.length>320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new RequestsError('invalid_email','A valid recipient email is required.'); return result; }
function requireGuestToken(value) { const token=String(value||''); if(!tokenPattern.test(token)) throw new RequestsError('invitation_not_found','Invitation not found.',404); return token; }
function providerEvent(input = {}) {
  const type = String(input.RecordType || input.Type || '').trim().toLowerCase();
  const messageId = String(input.MessageID || input.MessageId || '').trim();
  const occurredAt = String(
    input.DeliveredAt || input.BouncedAt || input.ReceivedAt || input.RecordedAt || '',
  ).trim();
  const mapped = type === 'delivery' ? 'delivered' : type === 'bounce' ? 'bounced' : type === 'open' ? 'opened_approximate' : '';
  if (!mapped || !messageId || messageId.length > 200 || !Number.isFinite(Date.parse(occurredAt))) {
    throw new RequestsError('invalid_webhook_event', 'Webhook event is invalid.');
  }
  return {
    type: mapped,
    messageId,
    occurredAt: new Date(occurredAt).toISOString(),
    providerEventId: hash(JSON.stringify([type, messageId, occurredAt])),
    bounceReason: mapped === 'bounced' ? String(input.Description || input.Details || '').slice(0, 500) : null,
  };
}

export function createRequestsService({ withIdentity, withServiceTransaction, postmark, environment=process.env, now=()=>new Date() }={}) {
  if(typeof withIdentity!=='function'||typeof withServiceTransaction!=='function') throw new TypeError('StoryForge database transactions are required.');
  async function capability(identity) {
    if(off(environment.STORYFORGE_REQUEST_A_STORY_FORCE_OFF)||identity?.role!=='student'||identity?.eligible!==true) return false;
    try{return await withIdentity(identity,async(client)=>(await client.query("SELECT public.sf_story_feature_enabled('request_a_story',ARRAY['student']) AS enabled")).rows[0]?.enabled===true);}catch(error){if(['42501','42883','42P01'].includes(error?.code))return false;throw error;}
  }
  async function requireStudent(identity){if(!await capability(identity))throw new RequestsError('request_a_story_disabled','Request a Story is unavailable.',403);}
  async function guestEnabled(){if(off(environment.STORYFORGE_GUEST_FORCE_OFF)||off(environment.STORYFORGE_GUEST_CONTRIBUTIONS_FORCE_OFF))return false;return withServiceTransaction(async(client)=>(await client.query("SELECT scope <> 'off' AS enabled FROM public.sf_feature_flags WHERE key='guest_contributions'")).rows[0]?.enabled===true);}
  function safeInvitation(row){return {id:row.id,recipientFirstName:row.contributor_first_name,relationship:row.relationship_id,maskedEmail:maskEmail(row.email),status:row.status,personalMessage:row.personal_message,disclosureVersion:row.disclosure_version,remindersSent:row.reminders_sent,rowVersion:row.row_version,createdAt:row.created_at,sentAt:row.sent_at,deliveredAt:row.delivered_at,linkVisitedAt:row.link_visited_at,startedAt:row.started_at,contributedAt:row.contributed_at,expiresAt:row.expires_at,bouncedAt:row.bounced_at,bounceReason:row.bounce_reason};}
  async function rateLimit(client,tokenHash,ip){
    const bucket=new Date(Math.floor(now().getTime()/900000)*900000).toISOString(); const scopes=[hash(`token:${tokenHash}`),hash(`ip:${ip||'unknown'}`)];
    for(const scope of scopes){const result=await client.query('SELECT public.sf_guest_rate_hit($1,$2) AS attempts',[scope,bucket]);if(Number(result.rows[0].attempts)>20)throw new RequestsError('guest_rate_limited','Please wait before trying again.',429);}
  }
  return Object.freeze({
    capability,
    async list(identity){await requireStudent(identity);return withIdentity(identity,async(client)=>{const result=await client.query('SELECT * FROM public.sf_story_invitations WHERE student_id=public.sf_actor_id() ORDER BY created_at DESC,id DESC');return result.rows.map(safeInvitation);});},
    async create(identity,input={}){await requireStudent(identity);const first=String(input.recipientFirstName||'').trim();const relationship=String(input.relationship||'');const email=cleanEmail(input.email);const message=String(input.personalMessage||'').trim();const disclosure=String(environment.STORYFORGE_GUEST_DISCLOSURE_VERSION||'').trim();if(!first||first.length>100||!relationships.has(relationship)||message.length>2000)throw new RequestsError('invalid_invitation','Invitation details are invalid.');if(!/^[a-z0-9._-]{1,64}$/.test(disclosure))throw new RequestsError('disclosure_unapproved','Guest disclosure wording is unavailable.',503);return withIdentity(identity,async(client)=>{const result=await client.query('SELECT public.sf_request_create($1,$2,$3,$4,$5) AS payload',[first,relationship,email,message,disclosure]);return safeInvitation(result.rows[0].payload);});},
    async send(identity,invitationId,{expectedVersion}={}){await requireStudent(identity);return withIdentity(identity,async(client)=>{const found=await client.query('SELECT * FROM public.sf_story_invitations WHERE id=$1 AND student_id=public.sf_actor_id()',[uuid(invitationId,'Invitation identifier')]);const row=found.rows[0];if(!row)throw new RequestsError('invitation_not_found','Invitation not found.',404);if(row.status!=='draft'||Number(row.row_version)!==Number(expectedVersion))throw new RequestsError('invitation_locked','Reload this invitation before sending.',409);const token=randomBytes(32).toString('base64url');const url=`${String(environment.STORYFORGE_PUBLIC_URL||'').replace(/\/$/,'')}/guest/${token}`;const name=identity.firstName||identity.displayName||'Your student';const delivery=await postmark.send({to:row.email,subject:`${name} asked you to share a story`,htmlBody:`<p>${name} asked for your help.</p><p><a href="${url}">Share a story</a></p>`,textBody:`${name} asked for your help. ${url}`,tag:'storyforge-request-a-story',metadata:{invitationId:row.id}});if(delivery.dryRun)return {dryRun:true,previewUrl:url,invitation:safeInvitation(row)};const updated=await client.query('SELECT public.sf_request_mark_sent($1,$2,$3,$4) AS payload',[row.id,expectedVersion,hash(token),delivery.providerMessageId]);return {dryRun:false,invitation:safeInvitation(updated.rows[0].payload)};});},
    async revoke(identity,invitationId){await requireStudent(identity);return withIdentity(identity,async(client)=>{const result=await client.query('SELECT public.sf_request_revoke($1) AS payload',[uuid(invitationId,'Invitation identifier')]);return safeInvitation(result.rows[0].payload);});},
    async listContributions(identity) {
      await requireStudent(identity);
      return withIdentity(identity, async (client) => {
        const result = await client.query(
          `SELECT contribution.id,contribution.invitation_id,contribution.kind,
                  contribution.transcript,contribution.prompt_text_snapshot,
                  contribution.state,contribution.promoted_story_id,
                  contribution.submitted_at,invitation.contributor_first_name,
                  invitation.relationship_id
             FROM public.sf_story_contributions contribution
             JOIN public.sf_story_invitations invitation ON invitation.id=contribution.invitation_id
            WHERE invitation.student_id=public.sf_actor_id()
            ORDER BY contribution.submitted_at DESC,contribution.id DESC`,
        );
        return result.rows;
      });
    },
    async setContributionState(identity, contributionId, state) {
      await requireStudent(identity);
      if (!['new', 'favorite', 'archived'].includes(state)) throw new RequestsError('invalid_contribution_state', 'Contribution state is invalid.');
      return withIdentity(identity, async (client) => {
        const result = await client.query(
          'SELECT public.sf_request_set_contribution_state($1,$2) AS payload',
          [uuid(contributionId, 'Contribution identifier'), state],
        );
        return result.rows[0]?.payload;
      });
    },
    async promote(identity, contributionId, input = {}) {
      await requireStudent(identity);
      return withIdentity(identity, async (client) => {
        const title = String(input.title || 'A contributed story').trim().slice(0, 240) || 'A contributed story';
        const result = await client.query('SELECT public.sf_request_promote($1,$2) AS payload',[uuid(contributionId,'Contribution identifier'),title]);
        return result.rows[0]?.payload;
      });
    },
    async guestView(token,{ip}={}){if(!await guestEnabled())throw new RequestsError('invitation_not_found','Invitation not found.',404);const raw=requireGuestToken(token);return withServiceTransaction(async(client)=>{const tokenHash=hash(raw);await rateLimit(client,tokenHash,ip);const result=await client.query(`SELECT invitation.*,student.first_name,student.display_name FROM public.sf_story_invitations invitation JOIN public.sf_users student ON student.id=invitation.student_id WHERE invitation.token_hash=$1`,[tokenHash]);const row=result.rows[0];if(!row||!timingSafeEqual(Buffer.from(row.token_hash,'hex'),Buffer.from(tokenHash,'hex')))throw new RequestsError('invitation_not_found','Invitation not found.',404);if(row.revoked_at)throw new RequestsError('invitation_revoked','This invitation is no longer active.',410);if(new Date(row.expires_at)<=now())throw new RequestsError('invitation_expired','This invitation has expired.',410);await client.query('SELECT public.sf_guest_mark_visited($1)',[row.id]);const prompts=await client.query('SELECT id,library_key,text,hint FROM public.sf_contributor_prompts WHERE state=\'active\' AND $1=ANY(relationship_ids) ORDER BY sort_order,id',[row.relationship_id]);return {student:{firstName:row.first_name||String(row.display_name||'').split(/\s+/)[0]||'Your student'},recipientFirstName:row.contributor_first_name,relationship:row.relationship_id,personalMessage:row.personal_message,disclosureVersion:row.disclosure_version,expiresAt:row.expires_at,prompts:prompts.rows};});},
    async contribute(token,input={},{ip}={}){if(!await guestEnabled())throw new RequestsError('invitation_not_found','Invitation not found.',404);const raw=requireGuestToken(token);const transcript=String(input.transcript||'').trim();const kind=input.kind==='voice'?'voice':'text';if(!transcript||transcript.length>20000)throw new RequestsError('invalid_contribution','A contribution between 1 and 20000 characters is required.');return withServiceTransaction(async(client)=>{const tokenHash=hash(raw);await rateLimit(client,tokenHash,ip);const found=await client.query('SELECT * FROM public.sf_story_invitations WHERE token_hash=$1',[tokenHash]);const row=found.rows[0];if(!row||!timingSafeEqual(Buffer.from(row.token_hash,'hex'),Buffer.from(tokenHash,'hex')))throw new RequestsError('invitation_not_found','Invitation not found.',404);if(row.revoked_at)throw new RequestsError('invitation_revoked','This invitation is no longer active.',410);if(new Date(row.expires_at)<=now())throw new RequestsError('invitation_expired','This invitation has expired.',410);const prompt=await client.query('SELECT id,text FROM public.sf_contributor_prompts WHERE id=$1 AND state=\'active\' AND $2=ANY(relationship_ids)',[uuid(input.promptId,'Prompt identifier'),row.relationship_id]);if(!prompt.rows[0])throw new RequestsError('prompt_not_found','Prompt not found.',404);const result=await client.query('SELECT public.sf_guest_contribute($1,$2,$3,$4,$5) AS payload',[row.id,kind,transcript,prompt.rows[0].id,prompt.rows[0].text]);return result.rows[0]?.payload;});},
    async processWebhook(input = {}) {
      const event = providerEvent(input);
      return withServiceTransaction(async (client) => {
        const result=await client.query('SELECT public.sf_request_provider_event($1,$2,$3,$4,$5) AS payload',[event.messageId,event.type,event.providerEventId,event.occurredAt,event.bounceReason]);
        return result.rows[0]?.payload;
      });
    },
  });
}
