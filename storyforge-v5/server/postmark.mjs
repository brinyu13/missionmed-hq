import { createHmac, timingSafeEqual } from 'node:crypto';

export class PostmarkError extends Error {
  constructor(code, message, status = 503, options = {}) {
    super(message, options);
    this.name = 'PostmarkError';
    this.code = code;
    this.status = status;
  }
}

function on(value) { return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase()); }

export function postmarkMode(environment = process.env) {
  const enabled = on(environment.STORYFORGE_POSTMARK_ENABLED);
  const dryRun = on(environment.STORYFORGE_POSTMARK_DRY_RUN);
  const live = on(environment.STORYFORGE_POSTMARK_LIVE_SEND_ENABLED);
  if (!enabled) return 'off';
  if (dryRun) return 'dry_run';
  return live ? 'live' : 'off';
}

export function createPostmarkService({ environment = process.env, fetchImpl = globalThis.fetch } = {}) {
  const mode = () => postmarkMode(environment);
  return Object.freeze({
    mode,
    async send({ to, subject, htmlBody, textBody, tag, metadata }) {
      if (mode() === 'off') throw new PostmarkError('postmark_disabled', 'StoryForge invitation delivery is disabled.', 503);
      const payload = {
        From: String(environment.STORYFORGE_POSTMARK_FROM || ''),
        ReplyTo: String(environment.STORYFORGE_POSTMARK_REPLY_TO || ''),
        To: to, Subject: subject, HtmlBody: htmlBody, TextBody: textBody,
        MessageStream: 'outbound', Tag: tag, Metadata: metadata,
      };
      if (!payload.From || !payload.ReplyTo) throw new PostmarkError('postmark_identity_unverified', 'StoryForge sender identity is not verified.', 503);
      if (mode() === 'dry_run') return { accepted: false, dryRun: true, providerMessageId: null };
      const token = String(environment.STORYFORGE_POSTMARK_SERVER_TOKEN || '');
      if (token.length < 20) throw new PostmarkError('postmark_credentials_unavailable', 'StoryForge invitation delivery is unavailable.', 503);
      const response = await fetchImpl('https://api.postmarkapp.com/email', {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': token },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new PostmarkError('postmark_send_failed', 'The invitation service did not accept this message.', 502);
      const result = await response.json();
      return { accepted: true, dryRun: false, providerMessageId: String(result.MessageID || '') };
    },
    verifyWebhook(rawBody, suppliedSignature) {
      const secret = String(environment.STORYFORGE_POSTMARK_WEBHOOK_SECRET || '');
      if (secret.length < 32 || !/^[a-f0-9]{64}$/i.test(String(suppliedSignature || ''))) return false;
      const expected = createHmac('sha256', secret).update(rawBody).digest();
      const supplied = Buffer.from(String(suppliedSignature), 'hex');
      return supplied.length === expected.length && timingSafeEqual(supplied, expected);
    },
  });
}
