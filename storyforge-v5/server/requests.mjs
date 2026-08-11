import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const pseudonymPattern = /^[a-f0-9]{64}$/;
const relationships = new Set(['parent','sibling','spouse_partner','grandparent','cousin','best_friend','childhood_friend','medschool_friend','faculty','mentor','coworker','supervisor','teammate']);

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
function expectedVersion(value) { const result=Number(value); if(!Number.isSafeInteger(result)||result<0)throw new RequestsError('invalid_invitation_version','A current invitation version is required.');return result; }
function escapeHtml(value) { return String(value||'').replace(/[&<>"']/g,(character)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character]); }
function exactObject(input,allowed,code='invalid_invitation'){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some((key)=>!allowed.has(key)))throw new RequestsError(code,'Invitation details are invalid.');}
function invitationFields(input,{version=false}={}){exactObject(input,new Set(['recipientFirstName','relationship','email','personalMessage',...(version?['expectedVersion']:[])]));const first=String(input.recipientFirstName||'').trim();const relationship=String(input.relationship||'').trim();const email=cleanEmail(input.email);const personalMessage=String(input.personalMessage||'').trim();if(!first||first.length>100||!relationships.has(relationship)||personalMessage.length>2000)throw new RequestsError('invalid_invitation','Invitation details are invalid.');return{first,relationship,email,personalMessage,...(version?{expectedVersion:expectedVersion(input.expectedVersion)}:{})};}
function canonicalGuestBase(environment) {
  const explicit = String(environment.STORYFORGE_PUBLIC_URL || '').trim();
  const configuredOrigin = String(environment.STORYFORGE_PUBLIC_ORIGIN || '').trim();
  const configuredBase = String(environment.STORYFORGE_BASE_PATH || '/storyforge/').trim();
  let derived = '';
  try {
    if (configuredOrigin) derived = new URL(configuredBase, new URL(configuredOrigin).origin).toString();
  } catch {}
  const candidate = explicit || derived;
  try {
    const url = new URL(candidate);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const derivedUrl = derived ? new URL(derived) : null;
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || path !== '/storyforge'
      || (derivedUrl && (url.origin !== derivedUrl.origin || path !== (derivedUrl.pathname.replace(/\/+$/, '') || '/')))) {
      throw new Error('invalid');
    }
    return `${url.origin}${path}`;
  } catch {
    throw new RequestsError('guest_public_url_unavailable', 'StoryForge invitation delivery is unavailable.', 503);
  }
}
function emailContent(identity,row,url){const studentName=String(identity?.firstName||identity?.displayName||'Your student').trim()||'Your student';const recipient=String(row.contributor_first_name||'there').trim()||'there';const message=String(row.personal_message||'').trim();const subject=`${studentName} asked you to share a story`;const textBody=[`Hi ${recipient},`,`${studentName} asked for your help remembering a story.`,message,`Share a story: ${url}`].filter(Boolean).join('\n\n');const htmlBody=`<p>Hi ${escapeHtml(recipient)},</p><p>${escapeHtml(studentName)} asked for your help remembering a story.</p>${message?`<p>${escapeHtml(message)}</p>`:''}<p><a href="${escapeHtml(url)}">Share a story</a></p>`;return{subject,textBody,htmlBody};}
function providerEvent(input = {}) {
  const type = String(input.RecordType || input.Type || '').trim().toLowerCase();
  const messageId = String(input.MessageID || input.MessageId || '').trim();
  const occurredAt = String(
    input.DeliveredAt || input.BouncedAt || input.ReceivedAt || input.RecordedAt || '',
  ).trim();
  const mapped = type === 'delivery' ? 'delivered' : type === 'bounce' ? 'bounced' : ['spamcomplaint','spam_complaint'].includes(type) ? 'complained' : type === 'open' ? 'opened_approximate' : '';
  if (!mapped || !messageId || messageId.length > 200 || !Number.isFinite(Date.parse(occurredAt))) {
    throw new RequestsError('invalid_webhook_event', 'Webhook event is invalid.');
  }
  const metadata = input.Metadata && typeof input.Metadata === 'object' && !Array.isArray(input.Metadata)
    ? input.Metadata
    : {};
  const attemptId = String(metadata.storyforgeDeliveryAttemptId || '').trim();
  const invitationId = String(metadata.storyforgeInvitationId || '').trim();
  if ((attemptId && !uuidPattern.test(attemptId)) || (invitationId && !uuidPattern.test(invitationId))) {
    throw new RequestsError('invalid_webhook_event', 'Webhook event is invalid.');
  }
  return {
    type: mapped,
    messageId,
    occurredAt: new Date(occurredAt).toISOString(),
    providerEventId: hash(JSON.stringify([type, messageId, occurredAt])),
    bounceReason: ['bounced','complained'].includes(mapped) ? String(input.Description || input.Details || mapped).slice(0, 500) : null,
    attemptId: attemptId || null,
    invitationId: invitationId || null,
  };
}

export function createRequestsService({ withIdentity, withServiceTransaction, postmark, signPlayback=null, environment=process.env, now=()=>new Date() }={}) {
  if(typeof withIdentity!=='function'||typeof withServiceTransaction!=='function') throw new TypeError('StoryForge database transactions are required.');
  async function capability(identity) {
    if(off(environment.STORYFORGE_REQUEST_A_STORY_FORCE_OFF)||identity?.role!=='student'||identity?.eligible!==true) return false;
    try{return await withIdentity(identity,async(client)=>(await client.query("SELECT public.sf_story_feature_enabled('request_a_story',ARRAY['student']) AS enabled")).rows[0]?.enabled===true);}catch(error){if(['42501','42883','42P01'].includes(error?.code))return false;throw error;}
  }
  async function requireStudent(identity){if(!await capability(identity))throw new RequestsError('request_a_story_disabled','Request a Story is unavailable.',403);}
  async function guestEnabled(){if(off(environment.STORYFORGE_GUEST_FORCE_OFF)||off(environment.STORYFORGE_GUEST_CONTRIBUTIONS_FORCE_OFF))return false;return withServiceTransaction(async(client)=>(await client.query("SELECT scope <> 'off' AS enabled FROM public.sf_feature_flags WHERE key='guest_contributions'")).rows[0]?.enabled===true);}
  function safeInvitation(row){return {id:row.id,recipientFirstName:row.contributor_first_name,relationship:row.relationship_id,maskedEmail:maskEmail(row.email),status:row.status,personalMessage:row.personal_message,disclosureVersion:row.disclosure_version,remindersSent:row.reminders_sent,rowVersion:row.row_version,createdAt:row.created_at,previewedAt:row.previewed_at,sentAt:row.sent_at,deliveredAt:row.delivered_at,linkVisitedAt:row.link_visited_at,startedAt:row.started_at,contributedAt:row.contributed_at,expiresAt:row.expires_at,bouncedAt:row.bounced_at,bounceReason:row.bounce_reason,suppressedAt:row.suppressed_at,suppressionReason:row.suppression_reason,reinvitedFromId:row.reinvited_from_id,deliveryState:row.delivery_state||null};}
  async function rateLimit(client,tokenHash,ip){
    const pseudonym=String(ip||'').trim().toLowerCase();
    if(!pseudonymPattern.test(pseudonym))throw new RequestsError('gateway_ingress_required','StoryForge guest access is unavailable.',401);
    const bucket=new Date(Math.floor(now().getTime()/900000)*900000).toISOString();
    const scopes=[[hash(`token:${tokenHash}`),120],[hash(`client:${pseudonym}`),240]];
    for(const [scope,limit] of scopes){const result=await client.query('SELECT public.sf_guest_rate_hit($1,$2) AS attempts',[scope,bucket]);if(Number(result.rows[0].attempts)>limit)throw new RequestsError('guest_rate_limited','Please wait before trying again.',429);}
  }
  function deliveryReadiness() {
    if (typeof postmark?.readiness === 'function') return postmark.readiness();
    const mode = typeof postmark?.mode === 'function' ? postmark.mode() : 'live';
    if (!['dry_run','live'].includes(mode)) throw new RequestsError('postmark_disabled','StoryForge invitation delivery is disabled.',503);
    return { mode };
  }
  async function dispatchDelivery(identity, invitationId, version, purpose) {
    const readiness = deliveryReadiness();
    const guestBase = canonicalGuestBase(environment);
    const prepareFunction = purpose === 'initial' ? 'sf_request_prepare_send' : 'sf_request_prepare_reminder';
    if (readiness.mode === 'dry_run') {
      const row = await withIdentity(identity, async (client) => (
        await client.query(`SELECT public.${prepareFunction}($1,$2) AS payload`, [invitationId, version])
      ).rows[0].payload);
      return {
        dryRun: true,
        previewUrl: `${guestBase}/guest/[secure-link-created-on-send]`,
        deliveryPending: false,
        invitation: safeInvitation(row),
      };
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = hash(token);
    const reserved = await withIdentity(identity, async (client) => (
      await client.query(
        'SELECT public.sf_request_reserve_delivery($1,$2,$3,$4) AS payload',
        [invitationId, version, purpose, tokenHash],
      )
    ).rows[0].payload);
    if (reserved.delivery_created !== true) {
      return { dryRun: false, deliveryPending: true, invitation: safeInvitation(reserved) };
    }

    const attemptId = uuid(reserved.delivery_attempt_id, 'Delivery attempt identifier');
    let claim;
    try {
      claim = await withServiceTransaction(async (client) => (
        await client.query('SELECT public.sf_request_claim_delivery_attempt($1) AS payload', [attemptId])
      ).rows[0].payload);
    } catch {
      return { dryRun: false, deliveryPending: true, invitation: safeInvitation(reserved) };
    }
    if (claim?.claimed !== true) {
      return { dryRun: false, deliveryPending: true, invitation: { ...safeInvitation(reserved), deliveryState: claim?.state || 'ambiguous' } };
    }

    const url = `${guestBase}/guest/${token}`;
    const content = emailContent(identity, reserved, url);
    let delivery;
    try {
      delivery = await postmark.send({
        to: reserved.email,
        subject: purpose === 'reminder' ? `Reminder: ${content.subject}` : content.subject,
        htmlBody: content.htmlBody,
        textBody: content.textBody,
        tag: purpose === 'reminder' ? 'storyforge-request-a-story-reminder' : 'storyforge-request-a-story',
        metadata: {
          storyforgeDeliveryAttemptId: attemptId,
          storyforgeInvitationId: reserved.id,
          purpose,
          ordinal: Number(reserved.delivery_ordinal),
        },
      });
    } catch (error) {
      if (error?.deliveryDisposition === 'not_sent') {
        await withServiceTransaction((client) => client.query(
          'SELECT public.sf_request_fail_delivery($1,$2,$3)',
          [attemptId, 'provider_rejected', null],
        )).catch(() => {});
        throw error;
      }
      await withServiceTransaction((client) => client.query(
        'SELECT public.sf_request_mark_delivery_ambiguous($1)', [attemptId],
      )).catch(() => {});
      return { dryRun: false, deliveryPending: true, invitation: { ...safeInvitation(reserved), deliveryState: 'ambiguous' } };
    }

    const providerMessageId = String(delivery?.providerMessageId || '').trim();
    if (delivery?.accepted !== true || !providerMessageId) {
      await withServiceTransaction((client) => client.query(
        'SELECT public.sf_request_mark_delivery_ambiguous($1)', [attemptId],
      )).catch(() => {});
      return { dryRun: false, deliveryPending: true, invitation: { ...safeInvitation(reserved), deliveryState: 'ambiguous' } };
    }
    try {
      const accepted = await withServiceTransaction(async (client) => (
        await client.query(
          "SELECT public.sf_request_accept_delivery($1,$2,'provider_response') AS payload",
          [attemptId, providerMessageId],
        )
      ).rows[0].payload);
      return { dryRun: false, deliveryPending: false, invitation: safeInvitation(accepted) };
    } catch {
      await withServiceTransaction((client) => client.query(
        'SELECT public.sf_request_mark_delivery_ambiguous($1)', [attemptId],
      )).catch(() => {});
      return { dryRun: false, deliveryPending: true, invitation: { ...safeInvitation(reserved), deliveryState: 'ambiguous' } };
    }
  }
  return Object.freeze({
    capability,
    async list(identity){await requireStudent(identity);return withIdentity(identity,async(client)=>{const result=await client.query('SELECT * FROM public.sf_story_invitations WHERE student_id=public.sf_actor_id() ORDER BY created_at DESC,id DESC');return result.rows.map(safeInvitation);});},
    async create(identity,input={}){await requireStudent(identity);const value=invitationFields(input);const disclosure=String(environment.STORYFORGE_GUEST_DISCLOSURE_VERSION||'').trim();if(!/^[a-z0-9._-]{1,64}$/.test(disclosure))throw new RequestsError('disclosure_unapproved','Guest disclosure wording is unavailable.',503);return withIdentity(identity,async(client)=>{const result=await client.query('SELECT public.sf_request_create($1,$2,$3,$4,$5) AS payload',[value.first,value.relationship,value.email,value.personalMessage,disclosure]);return safeInvitation(result.rows[0].payload);});},
    async update(identity,invitationId,input={}){await requireStudent(identity);const value=invitationFields(input,{version:true});return withIdentity(identity,async(client)=>{const result=await client.query('SELECT public.sf_request_update($1,$2,$3,$4,$5,$6) AS payload',[uuid(invitationId,'Invitation identifier'),value.expectedVersion,value.first,value.relationship,value.email,value.personalMessage]);return safeInvitation(result.rows[0].payload);});},
    async preview(identity,invitationId,input={}){await requireStudent(identity);exactObject(input,new Set(['expectedVersion']));const version=expectedVersion(input.expectedVersion);const guestBase=canonicalGuestBase(environment);return withIdentity(identity,async(client)=>{const result=await client.query('SELECT public.sf_request_preview($1,$2) AS payload',[uuid(invitationId,'Invitation identifier'),version]);const row=result.rows[0].payload;const content=emailContent(identity,row,`${guestBase}/guest/[secure-link-created-on-send]`);return{invitation:safeInvitation(row),preview:{to:row.email,from:String(environment.STORYFORGE_POSTMARK_FROM||''),replyTo:String(environment.STORYFORGE_POSTMARK_REPLY_TO||''),senderVerification:'required-before-live-send',...content,auditEventId:String(row.preview_event_id)}};});},
    async send(identity,invitationId,input={}){await requireStudent(identity);exactObject(input,new Set(['expectedVersion']));return dispatchDelivery(identity,uuid(invitationId,'Invitation identifier'),expectedVersion(input.expectedVersion),'initial');},
    async remind(identity,invitationId,input={}){await requireStudent(identity);exactObject(input,new Set(['expectedVersion']));return dispatchDelivery(identity,uuid(invitationId,'Invitation identifier'),expectedVersion(input.expectedVersion),'reminder');},
    async reinvite(identity,invitationId,input={}){await requireStudent(identity);exactObject(input,new Set(['expectedVersion','email']));const version=expectedVersion(input.expectedVersion);const email=cleanEmail(input.email);return withIdentity(identity,async(client)=>{const result=await client.query('SELECT public.sf_request_reinvite($1,$2,$3) AS payload',[uuid(invitationId,'Invitation identifier'),version,email]);return safeInvitation(result.rows[0].payload);});},
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
    async contributionPlayback(identity, contributionId) {
      await requireStudent(identity);
      if (typeof signPlayback !== 'function') {
        throw new RequestsError('contribution_audio_unavailable', 'Contribution audio is unavailable.', 503);
      }
      let audio;
      try {
        audio = await withIdentity(identity, async (client) => (
          await client.query(
            'SELECT public.sf_contribution_audio_playback_claim($1) AS payload',
            [uuid(contributionId, 'Contribution identifier')],
          )
        ).rows[0]?.payload);
      } catch (cause) {
        if (cause?.code === 'P0002' || cause?.code === '42501') {
          throw new RequestsError('contribution_audio_not_found', 'Contribution audio was not found.', 404, { cause });
        }
        throw cause;
      }
      const signed = await signPlayback({ objectKey: audio.objectKey });
      return {
        contributionId: audio.contributionId,
        contentType: audio.contentType,
        durationMs: audio.durationMs,
        byteSize: audio.byteSize,
        playbackUrl: signed.playbackUrl,
        expiresIn: signed.expiresIn,
      };
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
    async guestView(token,{ip}={}){if(!await guestEnabled())throw new RequestsError('invitation_not_found','Invitation not found.',404);const raw=requireGuestToken(token);return withServiceTransaction(async(client)=>{const tokenHash=hash(raw);await rateLimit(client,tokenHash,ip);const result=await client.query('SELECT public.sf_guest_view($1) AS payload',[tokenHash]);const row=result.rows[0]?.payload;if(!row)throw new RequestsError('invitation_not_found','Invitation not found.',404);if(row.revoked_at||row.suppressed_at||['bounced','revoked'].includes(row.status))throw new RequestsError('invitation_revoked','This invitation is no longer active.',410);if(new Date(row.expires_at)<=now()){await client.query('SELECT public.sf_guest_expire_if_due($1)',[row.id]);throw new RequestsError('invitation_expired','This invitation has expired.',410);}await client.query('SELECT public.sf_guest_mark_visited($1)',[row.id]);const prompts=await client.query('SELECT id,library_key,text,hint FROM public.sf_contributor_prompts WHERE state=\'active\' AND $1=ANY(relationship_ids) ORDER BY sort_order,id',[row.relationship_id]);return {student:{firstName:row.first_name||String(row.display_name||'').split(/\s+/)[0]||'Your student'},recipientFirstName:row.contributor_first_name,relationship:row.relationship_id,personalMessage:row.personal_message,disclosureVersion:row.disclosure_version,expiresAt:row.expires_at,prompts:prompts.rows};});},
    async guestStarted(token,{ip}={}){if(!await guestEnabled())throw new RequestsError('invitation_not_found','Invitation not found.',404);const raw=requireGuestToken(token);return withServiceTransaction(async(client)=>{const tokenHash=hash(raw);await rateLimit(client,tokenHash,ip);const result=await client.query('SELECT * FROM public.sf_story_invitations WHERE token_hash=$1',[tokenHash]);const row=result.rows[0];if(!row||!timingSafeEqual(Buffer.from(row.token_hash,'hex'),Buffer.from(tokenHash,'hex')))throw new RequestsError('invitation_not_found','Invitation not found.',404);if(row.revoked_at||row.suppressed_at||['bounced','revoked'].includes(row.status))throw new RequestsError('invitation_revoked','This invitation is no longer active.',410);if(new Date(row.expires_at)<=now()){await client.query('SELECT public.sf_guest_expire_if_due($1)',[row.id]);throw new RequestsError('invitation_expired','This invitation has expired.',410);}return (await client.query('SELECT public.sf_guest_mark_started($1) AS payload',[row.id])).rows[0]?.payload;});},
    async contribute(token,input={},{ip}={}){if(!await guestEnabled())throw new RequestsError('invitation_not_found','Invitation not found.',404);const raw=requireGuestToken(token);const transcript=String(input.transcript||'').trim();const kind=input.kind==='voice'?'voice':'text';if(!transcript||transcript.length>20000)throw new RequestsError('invalid_contribution','A contribution between 1 and 20000 characters is required.');try{return await withServiceTransaction(async(client)=>{const tokenHash=hash(raw);await rateLimit(client,tokenHash,ip);const found=await client.query('SELECT * FROM public.sf_story_invitations WHERE token_hash=$1',[tokenHash]);const row=found.rows[0];if(!row||!timingSafeEqual(Buffer.from(row.token_hash,'hex'),Buffer.from(tokenHash,'hex')))throw new RequestsError('invitation_not_found','Invitation not found.',404);if(row.revoked_at||row.suppressed_at||['bounced','revoked'].includes(row.status))throw new RequestsError('invitation_revoked','This invitation is no longer active.',410);if(new Date(row.expires_at)<=now()){await client.query('SELECT public.sf_guest_expire_if_due($1)',[row.id]);throw new RequestsError('invitation_expired','This invitation has expired.',410);}const prompt=await client.query('SELECT id,text FROM public.sf_contributor_prompts WHERE id=$1 AND state=\'active\' AND $2=ANY(relationship_ids)',[uuid(input.promptId,'Prompt identifier'),row.relationship_id]);if(!prompt.rows[0])throw new RequestsError('prompt_not_found','Prompt not found.',404);const result=await client.query('SELECT public.sf_guest_contribute($1,$2,$3,$4,$5) AS payload',[row.id,kind,transcript,prompt.rows[0].id,prompt.rows[0].text]);return result.rows[0]?.payload;});}catch(cause){if(cause?.code==='P0003')throw new RequestsError('invitation_complete','This invitation already has three shared stories.',429,{cause});throw cause;}},
    async expireDue(limit=100){if(off(environment.STORYFORGE_REQUEST_LIFECYCLE_FORCE_OFF))return{expired:0,disabled:true};const value=Number(limit);if(!Number.isInteger(value)||value<1||value>500)throw new RequestsError('invalid_expiry_limit','Expiry batch limit is invalid.');return withServiceTransaction(async(client)=>({expired:Number((await client.query('SELECT public.sf_request_expire_due($1) AS expired',[value])).rows[0]?.expired||0),disabled:false}));},
    async processWebhook(input = {}) {
      const event = providerEvent(input);
      return withServiceTransaction(async (client) => {
        const result=await client.query('SELECT public.sf_request_provider_event_resolve($1,$2,$3,$4,$5,$6,$7) AS payload',[event.messageId,event.type,event.providerEventId,event.occurredAt,event.bounceReason,event.attemptId,event.invitationId]);
        return result.rows[0]?.payload;
      });
    },
  });
}
