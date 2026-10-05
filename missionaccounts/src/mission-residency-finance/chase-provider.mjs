import crypto from 'node:crypto';
import { findExactZelleMatch, normalizeMatchInput } from './chase-donor-v2.mjs';

export const CHASE_MAILBOX = 'info@missionmedinstitute.com';
export const CHASE_QR = 'missionmed-zelle-email-qr.gif';
export const CHASE_CLAIM_URL = 'https://missionmedinstitute.com/wp-json/missionmed-finance/v1/chase-reserve';
export const CHASE_BRIDGE_NAMESPACE = 'missionmed-finance/chase-reserve/v1';
const fail = () => { throw new Error('Verified Chase receipt or permanent reservation unavailable'); };
const uuid = v => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v || '');
const hex = v => /^[a-f0-9]{64}$/.test(v || '');
export const bridgeSignatureInput = (timestamp, nonce, body) =>
  [CHASE_BRIDGE_NAMESPACE, String(timestamp), nonce, crypto.createHash('sha256').update(body).digest('hex')].join('\n');

export function chaseMatchBinding(context, normalizedPayer = context.payer_name) {
  return crypto.createHash('sha256').update(['financial-chase-match/v1', context.request_id, context.account_id,
    String(context.amount_cents), normalizedPayer, String(context.created_epoch), String(context.match_slot)].join('\n')).digest('hex');
}

// Instantiate on the private service only; context is retrieved from the canonical ledger.
// dwd is the existing HQ readGmailDwdConfig/getConfiguredAllowedMailboxes/
// googleGetJson/mintDelegatedAccessToken interface. No credentials are returned or logged.
export class ChaseReceiptProvider {
  constructor({ dwd, secret, fetchImpl = fetch, now = () => Date.now() } = {}) {
    this.dwd = dwd; this.secret = secret; this.fetchImpl = fetchImpl; this.now = now;
  }
  configurationState() {
    const required = ['getConfiguredAllowedMailboxes', 'readGmailDwdConfig', 'googleGetJson', 'mintDelegatedAccessToken'];
    const configured = required.every(name => typeof this.dwd?.[name] === 'function') && typeof this.secret === 'function';
    // Interface presence is not provider/configuration acceptance or a release gate.
    return { provider: 'Chase', interface_configured: configured, release_verified: false,
      mailbox: CHASE_MAILBOX, money_moved: false };
  }
  async reserve(context) {
    if (!this.configurationState().interface_configured) fail();
    if (!uuid(context?.request_id) || !uuid(context?.account_id) ||
        !Number.isSafeInteger(context.amount_cents) || context.amount_cents <= 0 ||
        !Number.isSafeInteger(context.created_epoch) || !context.payer_name ||
        !Number.isSafeInteger(context.match_slot) || context.match_slot < 1 ||
        context.eligible_match_count !== 1) fail();
    // Numeric slot is only the unchanged donor's deterministic input key, never a Woo order.
    const input = normalizeMatchInput({ protocol_version: 2, currency: 'USD',
      order_id: context.match_slot, eligible_order_ids: [context.match_slot],
      expected_amount: `${Math.floor(context.amount_cents / 100)}.${String(context.amount_cents % 100).padStart(2, '0')}`,
      payer_name: context.payer_name, order_created_epoch: context.created_epoch, consumed_fingerprints: [] });
    if (!input.ok) fail();
    if (input.payerName !== context.payer_name) fail();
    const binding = chaseMatchBinding(context, input.payerName);
    if (context.match_binding && context.match_binding !== binding) fail();
    let proof;
    try {
      if (!this.dwd.getConfiguredAllowedMailboxes().has(CHASE_MAILBOX)) fail();
      const config = this.dwd.readGmailDwdConfig();
      if (!config.ok || config.scopes?.length !== 1 ||
          config.scopes[0] !== 'https://www.googleapis.com/auth/gmail.readonly') fail();
      proof = await findExactZelleMatch({ input, credentials: config.credentials, scopes: config.scopes,
        gmailGetJson: this.dwd.googleGetJson, mintToken: this.dwd.mintDelegatedAccessToken });
    } catch { fail(); }
    if (proof?.ok !== true || proof.state !== 'verified' || proof.match_count !== 1 ||
        proof.authentication !== 'gmail_chase_dkim_dmarc_pass' || !hex(proof.fingerprint) ||
        !hex(proof.message_fingerprint)) fail();
    const body = JSON.stringify({ namespace: CHASE_BRIDGE_NAMESPACE,
      fingerprint: proof.fingerprint, match_binding: binding, expected_amount: input.expectedAmount, payer_name: input.payerName });
    const timestamp = String(Math.floor(this.now() / 1000));
    const nonce = crypto.randomBytes(16).toString('hex');
    let secret;
    try { secret = await this.secret(); } catch { fail(); }
    if (typeof secret !== 'string' || !secret.trim()) fail();
    const signature = crypto.createHmac('sha256', secret.trim()).update(bridgeSignatureInput(timestamp, nonce, body)).digest('hex');
    let response, result;
    try {
      response = await this.fetchImpl(CHASE_CLAIM_URL, { method: 'POST', redirect: 'error',
        signal: AbortSignal.timeout(10000), headers: { 'content-type': 'application/json',
          'x-mmed-finance-timestamp': timestamp, 'x-mmed-finance-nonce': nonce,
          'x-mmed-finance-signature': signature }, body });
      if (!response.ok || (response.url && response.url !== CHASE_CLAIM_URL)) fail();
      const raw = await response.text();
      if (raw.length > 2048) fail();
      const received = response.headers.get('x-mmed-finance-signature') || '';
      const expected = crypto.createHmac('sha256', secret.trim()).update(bridgeSignatureInput(timestamp, nonce, raw)).digest('hex');
      if (!hex(received) || !crypto.timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'))) fail();
      result = JSON.parse(raw);
    } catch { fail(); }
    if (result?.reserved !== true || result.fingerprint !== proof.fingerprint || result.match_binding !== binding) fail();
    return { provider: 'Chase', provider_account: CHASE_MAILBOX, provider_identity: proof.fingerprint,
      amount_cents: context.amount_cents, received_at: new Date(proof.received_epoch * 1000).toISOString(),
      authenticity_verified: true, message_fingerprint: proof.message_fingerprint,
      match_binding: binding, reservation_verified: true, global_claim_verified: true, money_moved: false };
  }
}

// Parent supplies unchanged accepted HQ DWD callbacks from its verified runtime.
// Absent callbacks leave a safe constructed adapter that cannot retrieve or reserve receipts.
export function createChaseReceiptProvider(options = {}) { return new ChaseReceiptProvider(options); }
