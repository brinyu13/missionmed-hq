import { ivocApi } from './api.mjs';

export const account = {
  ready: false,
  identity: null,
  entitlement: null,
  preferences: null,
};

export async function loadAccount({ force = false } = {}) {
  if (account.ready && !force) return account;
  const payload = await ivocApi.bootstrap();
  account.ready = true;
  account.identity = payload.identity || null;
  account.entitlement = payload.entitlement || null;
  account.preferences = payload.preferences || null;
  return account;
}

export function accountName() { return account.identity?.displayName || 'MissionMed student'; }
export function accountInitials() {
  return accountName().split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'MM';
}

