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
  async function guestEnabled(){if(off(environment.STORYFORGE_GUEST_CONTRIBUTIONS_FORCE_OFF))return false;return withServiceTransaction(async(client)=>(await client.query("SELECT scope <> 'off' AS enabled FROM public.sf_feature_flags WHERE key='guest_contributions'")).rows[0]?.enabled===true);}
  function safeInvitation(row){return {id:row.id,recipientFirstName:row.contributor_first_name,relationship:row.relationship_id,maskedEmail:maskEmail(row.email),status:row.status,personalMessage:row.personal_message,disclosureVersion:row.disclosure_version,remindersSent:row.reminders_sent,rowVersion:row.row_version,createdAt:row.created_at,sentAt:row.sent_at,deliveredAt:row.delivered_at,linkVisitedAt:row.link_visited_at,startedAt:row.started_at,contributedAt:row.contributed_at,expiresAt:row.expires_at,bouncedAt:row.bounced_at,bounceReason:row.bounce_reason};}
  async function rateLimit(client,tokenHash,ip){
    const bucket=new Date(Math.floor(now().getTime()/900000)*900000).toISOString(); const scopes=[hash(`token:${tokenHash}`),hash(`ip:${ip||'unknown'}`)];
    for(const scope of scopes){const result=await client.query(`INSERT INTO public.sf_guest_rate_limits(scope_hash,bucket_started_at,attempts) VALUES($1,$2,1)
      ON CONFLICT(scope_hash,bucket_started_at) DO UPDATE SET attempts=sf_guest_rate_limits.attempts+1,updated_at=now() RETURNING attempts`,[scope,bucket]);if(Number(result.rows[0].attempts)>20)throw new RequestsError('guest_rate_limited','Please wait before trying again.',429);}
  }
  return Object.freeze({
    capability,
    async list(identity){await requireStudent(identity);return withIdentity(identity,async(client)=>{const result=await client.query('SELECT * FROM public.sf_story_invitations WHERE student_id=public.sf_actor_id() ORDER BY created_at DESC,id DESC');return result.rows.map(safeInvitation);});},
    async create(identity,input={}){await requireStudent(identity);const first=String(input.recipientFirstName||'').trim();const relationship=String(input.relationship||'');const email=cleanEmail(input.email);const message=String(input.personalMessage||'').trim();const disclosure=String(environment.STORYFORGE_GUEST_DISCLOSURE_VERSION||'').trim();if(!first||first.length>100||!relationships.has(relationship)||message.length>2000)throw new RequestsError('invalid_invitation','Invitation details are invalid.');if(!/^[a-z0-9._-]{1,64}$/.test(disclosure))throw new RequestsError('disclosure_unapproved','Guest disclosure wording is unavailable.',503);return withIdentity(identity,async(client)=>{const result=await client.query(`INSERT INTO public.sf_story_invitations(student_id,contributor_first_name,relationship_id,email,personal_message,disclosure_version)
      VALUES(public.sf_actor_id(),$1,$2,$3,$4,$5) RETURNING *`,[first,relationship,email,message,disclosure]);await client.query("INSERT INTO public.sf_story_invitation_events(invitation_id,event_type) VALUES($1,'created')",[result.rows[0].id]);return safeInvitation(result.rows[0]);});},
    async send(identity,invitationId,{expectedVersion}={}){await requireStudent(identity);return withIdentity(identity,async(client)=>{const found=await client.query('SELECT * FROM public.sf_story_invitations WHERE id=$1 AND student_id=public.sf_actor_id() FOR UPDATE',[uuid(invitationId,'Invitation identifier')]);const row=found.rows[0];if(!row)throw new RequestsError('invitation_not_found','Invitation not found.',404);if(row.status!=='draft'||Number(row.row_version)!==Number(expectedVersion))throw new RequestsError('invitation_locked','Reload this invitation before sending.',409);const token=randomBytes(32).toString('base64url');const url=`${String(environment.STORYFORGE_PUBLIC_URL||'').replace(/\/$/,'')}/guest/${token}`;const name=identity.firstName||identity.displayName||'Your student';const delivery=await postmark.send({to:row.email,subject:`${name} asked you to share a story`,htmlBody:`<p>${name} asked for your help.</p><p><a href="${url}">Share a story</a></p>`,textBody:`${name} asked for your help. ${url}`,tag:'storyforge-request-a-story',metadata:{invitationId:row.id}});if(delivery.dryRun)return {dryRun:true,previewUrl:url,invitation:safeInvitation(row)};const updated=await client.query(`UPDATE public.sf_story_invitations SET token_hash=$2,status='sent',provider_message_id=$3,sent_at=now(),row_version=row_version+1,updated_at=now() WHERE id=$1 RETURNING *`,[row.id,hash(token),delivery.providerMessageId]);await client.query("INSERT INTO public.sf_story_invitation_events(invitation_id,event_type) VALUES($1,'sent')",[row.id]);return {dryRun:false,invitation:safeInvitation(updated.rows[0])};});},
    async revoke(identity,invitationId){await requireStudent(identity);return withIdentity(identity,async(client)=>{const result=await client.query(`UPDATE public.sf_story_invitations SET status='revoked',revoked_at=now(),token_hash=NULL,row_version=row_version+1,updated_at=now() WHERE id=$1 AND student_id=public.sf_actor_id() AND revoked_at IS NULL RETURNING *`,[uuid(invitationId,'Invitation identifier')]);if(!result.rows[0])throw new RequestsError('invitation_not_found','Invitation not found.',404);await client.query("INSERT INTO public.sf_story_invitation_events(invitation_id,event_type) VALUES($1,'revoked')",[result.rows[0].id]);return safeInvitation(result.rows[0]);});},
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
          `UPDATE public.sf_story_contributions contribution SET state=$2,updated_at=now()
            FROM public.sf_story_invitations invitation
           WHERE contribution.id=$1 AND invitation.id=contribution.invitation_id
             AND invitation.student_id=public.sf_actor_id() AND contribution.state<>'promoted'
           RETURNING contribution.id,contribution.state`,
          [uuid(contributionId, 'Contribution identifier'), state],
        );
        if (!result.rows[0]) throw new RequestsError('contribution_not_found', 'Contribution not found.', 404);
        return result.rows[0];
      });
    },
    async promote(identity, contributionId, input = {}) {
      await requireStudent(identity);
      return withIdentity(identity, async (client) => {
        const found = await client.query(
          `SELECT contribution.*,invitation.contributor_first_name,invitation.relationship_id
             FROM public.sf_story_contributions contribution
             JOIN public.sf_story_invitations invitation ON invitation.id=contribution.invitation_id
            WHERE contribution.id=$1 AND invitation.student_id=public.sf_actor_id()
            FOR UPDATE OF contribution`,
          [uuid(contributionId, 'Contribution identifier')],
        );
        const contribution = found.rows[0];
        if (!contribution) throw new RequestsError('contribution_not_found', 'Contribution not found.', 404);
        if (contribution.state === 'promoted') return { storyId: contribution.promoted_story_id, existing: true };
        const title = String(input.title || `A story from ${contribution.contributor_first_name}`).trim().slice(0, 240);
        const created = await client.query(
          `SELECT * FROM public.sf_create_story_v5(
             jsonb_build_object('title',$1,'text',$2,'captureType','imported','prefixEnabled',false),
             'library'
           )`,
          [title || 'A contributed story', contribution.transcript],
        );
        const story = created.rows[0];
        await client.query(
          `UPDATE public.sf_stories
              SET visibility='private',visibility_changed_at=NULL,
                  origin=jsonb_build_object('kind','guest_contribution','contributionId',$2::text),
                  updated_at=now()
            WHERE id=$1`,
          [story.id, contribution.id],
        );
        await client.query(
          `UPDATE public.sf_story_contributions
              SET state='promoted',promoted_story_id=$2,promoted_at=now(),updated_at=now()
            WHERE id=$1`,
          [contribution.id, story.id],
        );
        return { storyId: story.id, existing: false, visibility: 'private' };
      });
    },
    async guestView(token,{ip}={}){if(!await guestEnabled())throw new RequestsError('invitation_not_found','Invitation not found.',404);const raw=requireGuestToken(token);return withServiceTransaction(async(client)=>{const tokenHash=hash(raw);await rateLimit(client,tokenHash,ip);const result=await client.query(`SELECT invitation.*,student.first_name,student.display_name FROM public.sf_story_invitations invitation JOIN public.sf_users student ON student.id=invitation.student_id WHERE invitation.token_hash=$1 FOR UPDATE OF invitation`,[tokenHash]);const row=result.rows[0];if(!row||!timingSafeEqual(Buffer.from(row.token_hash,'hex'),Buffer.from(tokenHash,'hex')))throw new RequestsError('invitation_not_found','Invitation not found.',404);if(row.revoked_at)throw new RequestsError('invitation_revoked','This invitation is no longer active.',410);if(new Date(row.expires_at)<=now())throw new RequestsError('invitation_expired','This invitation has expired.',410);await client.query(`UPDATE public.sf_story_invitations SET link_visited_at=coalesce(link_visited_at,now()),status=CASE WHEN status IN('sent','delivered') THEN 'link_visited' ELSE status END,updated_at=now() WHERE id=$1`,[row.id]);const prompts=await client.query('SELECT id,library_key,text,hint FROM public.sf_contributor_prompts WHERE state=\'active\' AND $1=ANY(relationship_ids) ORDER BY sort_order,id',[row.relationship_id]);return {student:{firstName:row.first_name||String(row.display_name||'').split(/\s+/)[0]||'Your student'},recipientFirstName:row.contributor_first_name,relationship:row.relationship_id,personalMessage:row.personal_message,disclosureVersion:row.disclosure_version,expiresAt:row.expires_at,prompts:prompts.rows};});},
    async contribute(token,input={},{ip}={}){if(!await guestEnabled())throw new RequestsError('invitation_not_found','Invitation not found.',404);const raw=requireGuestToken(token);const transcript=String(input.transcript||'').trim();const kind=input.kind==='voice'?'voice':'text';if(!transcript||transcript.length>20000)throw new RequestsError('invalid_contribution','A contribution between 1 and 20000 characters is required.');return withServiceTransaction(async(client)=>{const tokenHash=hash(raw);await rateLimit(client,tokenHash,ip);const found=await client.query('SELECT * FROM public.sf_story_invitations WHERE token_hash=$1 FOR UPDATE',[tokenHash]);const row=found.rows[0];if(!row||!timingSafeEqual(Buffer.from(row.token_hash,'hex'),Buffer.from(tokenHash,'hex')))throw new RequestsError('invitation_not_found','Invitation not found.',404);if(row.revoked_at)throw new RequestsError('invitation_revoked','This invitation is no longer active.',410);if(new Date(row.expires_at)<=now())throw new RequestsError('invitation_expired','This invitation has expired.',410);const count=await client.query('SELECT count(*)::integer AS count FROM public.sf_story_contributions WHERE invitation_id=$1',[row.id]);if(count.rows[0].count>=3)throw new RequestsError('invitation_complete','This invitation has received its maximum number of stories.',429);const prompt=await client.query('SELECT id,text FROM public.sf_contributor_prompts WHERE id=$1 AND state=\'active\' AND $2=ANY(relationship_ids)',[uuid(input.promptId,'Prompt identifier'),row.relationship_id]);if(!prompt.rows[0])throw new RequestsError('prompt_not_found','Prompt not found.',404);const result=await client.query(`INSERT INTO public.sf_story_contributions(invitation_id,kind,transcript,prompt_id,prompt_text_snapshot) VALUES($1,$2,$3,$4,$5) RETURNING id,kind,state,submitted_at`,[row.id,kind,transcript,prompt.rows[0].id,prompt.rows[0].text]);await client.query(`UPDATE public.sf_story_invitations SET status='story_shared',started_at=coalesce(started_at,now()),contributed_at=now(),updated_at=now() WHERE id=$1`,[row.id]);await client.query("INSERT INTO public.sf_story_invitation_events(invitation_id,event_type) VALUES($1,'story_shared')",[row.id]);return result.rows[0];});},
    async processWebhook(input = {}) {
      const event = providerEvent(input);
      return withServiceTransaction(async (client) => {
        const found = await client.query(
          'SELECT id,status FROM public.sf_story_invitations WHERE provider_message_id=$1 FOR UPDATE',
          [event.messageId],
        );
        const invitation = found.rows[0];
        if (!invitation) return { accepted: true };
        const inserted = await client.query(
          `INSERT INTO public.sf_story_invitation_events
             (invitation_id,event_type,provider_event_id,detail,created_at)
           VALUES($1,$2,$3,'{}'::jsonb,$4)
           ON CONFLICT(provider_event_id) DO NOTHING RETURNING id`,
          [invitation.id, event.type, event.providerEventId, event.occurredAt],
        );
        if (!inserted.rowCount) return { accepted: true, duplicate: true };
        if (event.type === 'delivered') {
          await client.query(
            `UPDATE public.sf_story_invitations
                SET delivered_at=coalesce(delivered_at,$2),
                    status=CASE WHEN status='sent' THEN 'delivered' ELSE status END,
                    updated_at=now()
              WHERE id=$1`,
            [invitation.id, event.occurredAt],
          );
        } else if (event.type === 'opened_approximate') {
          await client.query(
            'UPDATE public.sf_story_invitations SET opened_at=coalesce(opened_at,$2),updated_at=now() WHERE id=$1',
            [invitation.id, event.occurredAt],
          );
        } else {
          await client.query(
            `UPDATE public.sf_story_invitations
                SET bounced_at=coalesce(bounced_at,$2),bounce_reason=coalesce(bounce_reason,$3),
                    status=CASE WHEN status IN('sent','delivered') THEN 'bounced' ELSE status END,
                    updated_at=now()
              WHERE id=$1`,
            [invitation.id, event.occurredAt, event.bounceReason],
          );
        }
        return { accepted: true };
      });
    },
  });
}
