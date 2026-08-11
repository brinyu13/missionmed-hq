import { createHmac, timingSafeEqual } from 'node:crypto';

const pseudonymPattern = /^[a-f0-9]{64}$/;
const signaturePattern = /^[a-f0-9]{64}$/;

export class GatewayIngressError extends Error {
  constructor(code = 'gateway_ingress_required', message = 'StoryForge guest access is unavailable.', status = 401) {
    super(message);
    this.name = 'GatewayIngressError';
    this.code = code;
    this.status = status;
  }
}

function fixedEqual(left, right) {
  const leftBytes = Buffer.from(left, 'hex');
  const rightBytes = Buffer.from(right, 'hex');
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function createGatewayIngressVerifier({
  environment = process.env,
  now = () => Date.now(),
  maxClockSkewSeconds = 90,
} = {}) {
  return function verifyGatewayIngress(request, pathname) {
    const secret = String(environment.STORYFORGE_GATEWAY_SHARED_SECRET || '');
    if (secret.length < 32) {
      throw new GatewayIngressError('gateway_ingress_unavailable', 'StoryForge guest access is unavailable.', 503);
    }
    const pseudonym = String(request?.headers?.['x-storyforge-client-pseudonym'] || '').trim().toLowerCase();
    const signature = String(request?.headers?.['x-storyforge-gateway-signature'] || '').trim().toLowerCase();
    const timestampText = String(request?.headers?.['x-storyforge-gateway-timestamp'] || '').trim();
    const timestamp = Number(timestampText);
    if (!pseudonymPattern.test(pseudonym) || !signaturePattern.test(signature)
      || !/^\d{10}$/.test(timestampText) || !Number.isSafeInteger(timestamp)) {
      throw new GatewayIngressError();
    }
    if (Math.abs(Math.floor(now() / 1000) - timestamp) > maxClockSkewSeconds) {
      throw new GatewayIngressError('gateway_ingress_expired', 'StoryForge guest access is unavailable.');
    }
    const method = String(request?.method || '').toUpperCase();
    const canonicalPath = String(pathname || '');
    const expected = createHmac('sha256', secret)
      .update(`${method}\n${canonicalPath}\n${timestampText}\n${pseudonym}`)
      .digest('hex');
    if (!fixedEqual(signature, expected)) throw new GatewayIngressError();
    return pseudonym;
  };
}
