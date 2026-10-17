import { normalizeSchedulerEntitlementFacts } from './entitlements.mjs';

const ADMIN_ROLES = new Set(['administrator', 'admin', 'hq_admin', 'missionmed_admin', 'coordinator']);
const PROVIDER_ROLES = new Set(['provider', 'coach', 'staff', 'administrator', 'admin', 'hq_admin', 'missionmed_admin']);

export function getSchedulerActor(session = null, requiredRole = 'student') {
  if (!session) {
    return {
      ok: false,
      status: 401,
      error: 'authentication_required',
      message: 'Scheduler routes require an authenticated MissionMed session.',
    };
  }

  const roles = normalizeSchedulerRoles([
    session.user?.roles,
    session.roles,
    session.user?.role,
    session.role,
  ]);
  const confirmedSupabaseUserId = String(
    session.supabaseUserId
      || session.user?.supabaseUserId
      || session.user?.supabase_user_id
      || session.user?.supabase_user
      || '',
  ).trim();
  const dbocUserId = String(session.user?.dbocUserId || session.dbocUserId || '').trim();
  const fallbackUserId = String(
    session.user?.id
      || session.userId
      || session.user?.userId
      || session.user?.wpUserId
      || session.wpUserId
      || '',
  ).trim();
  const userId = confirmedSupabaseUserId || fallbackUserId;
  const providerId = String(
    session.schedulerProviderId
      || session.providerId
      || session.user?.schedulerProviderId
      || session.user?.providerId
      || session.user?.provider_id
      || '',
  ).trim();
  const wpUserId = numericOrNull(
    session.user?.wpUserId
      || session.user?.wp_user_id
      || session.wpUserId
      || session.wp_user_id
      || session.user?.id,
  );
  const email = String(session.user?.email || session.email || '').trim().toLowerCase();
  const login = String(
    session.user?.login
      || session.user?.user_login
      || session.login
      || session.user_login
      || '',
  ).trim().toLowerCase();
  const entitlementFacts = normalizeSchedulerEntitlementFacts({
    ...(session.schedulerEntitlements || {}),
    ...(session.entitlements || {}),
    ...(session.user?.schedulerEntitlements || {}),
    ...(session.user?.entitlements || {}),
    course_ids: [
      session.schedulerEntitlements?.course_ids,
      session.schedulerEntitlements?.courseIds,
      session.entitlements?.course_ids,
      session.entitlements?.courseIds,
      session.user?.schedulerEntitlements?.course_ids,
      session.user?.schedulerEntitlements?.courseIds,
      session.user?.entitlements?.course_ids,
      session.user?.entitlements?.courseIds,
      session.schedulerCourseIds,
      session.courseIds,
      session.learndashCourseIds,
      session.enrolledCourseIds,
      session.user?.schedulerCourseIds,
      session.user?.courseIds,
      session.user?.learndashCourseIds,
      session.user?.enrolledCourseIds,
      session.user?.course_ids,
      session.user?.learndash_course_ids,
    ],
    product_ids: [
      session.schedulerEntitlements?.product_ids,
      session.schedulerEntitlements?.productIds,
      session.entitlements?.product_ids,
      session.entitlements?.productIds,
      session.user?.schedulerEntitlements?.product_ids,
      session.user?.schedulerEntitlements?.productIds,
      session.user?.entitlements?.product_ids,
      session.user?.entitlements?.productIds,
      session.schedulerProductIds,
      session.productIds,
      session.woocommerceProductIds,
      session.user?.schedulerProductIds,
      session.user?.productIds,
      session.user?.woocommerceProductIds,
      session.user?.product_ids,
      session.user?.woocommerce_product_ids,
    ],
    tier_keys: [
      session.schedulerEntitlements?.tier_keys,
      session.schedulerEntitlements?.tierKeys,
      session.entitlements?.tier_keys,
      session.entitlements?.tierKeys,
      session.user?.schedulerEntitlements?.tier_keys,
      session.user?.schedulerEntitlements?.tierKeys,
      session.user?.entitlements?.tier_keys,
      session.user?.entitlements?.tierKeys,
      session.schedulerTierKeys,
      session.tierKeys,
      session.tiers,
      session.user?.schedulerTierKeys,
      session.user?.tierKeys,
      session.user?.tiers,
      session.user?.tier,
    ],
    division_keys: [
      session.schedulerEntitlements?.division_keys,
      session.schedulerEntitlements?.divisionKeys,
      session.entitlements?.division_keys,
      session.entitlements?.divisionKeys,
      session.user?.schedulerEntitlements?.division_keys,
      session.user?.schedulerEntitlements?.divisionKeys,
      session.user?.entitlements?.division_keys,
      session.user?.entitlements?.divisionKeys,
      session.schedulerDivisionKeys,
      session.divisionKeys,
      session.divisions,
      session.user?.schedulerDivisionKeys,
      session.user?.divisionKeys,
      session.user?.divisions,
    ],
  });

  const actor = {
    userId,
    wpUserId,
    providerId: providerId || null,
    email,
    login,
    displayName: String(session.user?.displayName || session.user?.display_name || session.displayName || ''),
    roles,
    isAdmin: roles.some((role) => ADMIN_ROLES.has(role)),
    isProvider: roles.some((role) => PROVIDER_ROLES.has(role)),
    providerLookup: {
      provider_id: providerId || null,
      supabase_user_id: confirmedSupabaseUserId || null,
      wp_user_id: wpUserId,
      email,
    },
    entitlementFacts,
    identitySource: confirmedSupabaseUserId ? 'supabase_user_id' : dbocUserId ? 'dboc_user_id_fallback' : 'session_user_id_fallback',
    supabaseIdentityConfirmed: Boolean(confirmedSupabaseUserId),
  };

  if (!actor.userId) {
    return {
      ok: false,
      status: 401,
      error: 'scheduler_identity_missing',
      message: 'Scheduler routes require a resolvable MissionMed user identity.',
    };
  }

  if (requiredRole === 'admin' && !actor.isAdmin) {
    return { ok: false, status: 403, error: 'admin_required', message: 'Scheduler admin route requires an HQ/admin role.' };
  }

  if (requiredRole === 'provider' && !actor.isProvider) {
    return { ok: false, status: 403, error: 'provider_required', message: 'Scheduler provider route requires a provider/staff role.' };
  }

  return { ok: true, actor };
}

export function normalizeSchedulerRoles(roles = []) {
  return (Array.isArray(roles) ? roles : [roles])
    .flat(Infinity)
    .flatMap((role) => String(role || '').split(','))
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

export function safeSchedulerActor(actor = {}) {
  return {
    user_id: actor.userId || '',
    wp_user_id: actor.wpUserId || null,
    provider_id: actor.providerId || null,
    email: actor.email || '',
    login: actor.login || '',
    display_name: actor.displayName || '',
    roles: actor.roles || [],
    is_admin: Boolean(actor.isAdmin),
    is_provider: Boolean(actor.isProvider),
    provider_lookup_configured: Boolean(actor.providerId || actor.providerLookup?.supabase_user_id || actor.providerLookup?.wp_user_id || actor.providerLookup?.email),
    scheduler_entitlement_facts_configured: Boolean(actor.entitlementFacts?.configured),
    identity_source: actor.identitySource || 'unknown',
    supabase_identity_confirmed: Boolean(actor.supabaseIdentityConfirmed),
  };
}

export function assertSchedulerMutationIdentity(actor = {}, repositoryStatus = {}) {
  if (!actor.userId) {
    return {
      ok: false,
      status: 401,
      error: 'scheduler_identity_missing',
      message: 'Scheduler mutation requires a server-resolved user identity.',
    };
  }

  if (repositoryStatus.mode === 'supabase_rest' && !actor.supabaseIdentityConfirmed) {
    return {
      ok: false,
      status: 403,
      error: 'scheduler_supabase_identity_unconfirmed',
      message: 'Scheduler production mutations require a confirmed Supabase user id from the server-side auth session.',
    };
  }

  return { ok: true };
}

function numericOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
