/**
 * USCE Supabase Client Factory (Step 2.2)
 * Authority: W-028
 *
 * Modes:
 * 1) user_facing: caller JWT + RLS
 * 2) service_role: internal only
 * 3) authenticated_portal_context: caller JWT + portal token context header
 *
 * Notes:
 * - service_role is forbidden in user-facing handlers
 * - portal token is context only, never identity
 */

// ---------------------------------------------------------------------------
// Lightweight local types (no external type dependency required)
// ---------------------------------------------------------------------------

export type EnvMap = Record<string, string | undefined>;

export type SupabaseClientLike = Record<string, unknown>;

export type SupabaseCreateClientFn = (
  url: string,
  key: string,
  options?: {
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
      detectSessionInUrl?: boolean;
    };
    global?: {
      headers?: Record<string, string>;
    };
  }
) => SupabaseClientLike;

export interface FactoryBootstrapOptions {
  env?: EnvMap;
  createClient?: SupabaseCreateClientFn;
}

export interface CreateUserFacingClientInput {
  accessToken: string;
}

export interface CreateServiceRoleClientInput {
  internal: true;
}

export interface CreatePortalContextClientInput {
  accessToken: string;
  portalToken: string;
}

export interface USCESupabaseClientFactory {
  createUserFacingClient(input: CreateUserFacingClientInput): SupabaseClientLike;
  createServiceRoleClient(input: CreateServiceRoleClientInput): SupabaseClientLike;
  createPortalContextClient(input: CreatePortalContextClientInput): SupabaseClientLike;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SUPABASE_URL = 'https://fglyvdykwgbuivikqoah.supabase.co';

// ---------------------------------------------------------------------------
// Env + guard helpers
// ---------------------------------------------------------------------------

function getProcessEnvFallback(): EnvMap {
  const globalWithProcess = globalThis as unknown as {
    process?: { env?: EnvMap };
  };
  return globalWithProcess.process?.env ?? {};
}

function resolveEnv(envOverride?: EnvMap): EnvMap {
  return envOverride ?? getProcessEnvFallback();
}

function getRequiredEnvValue(env: EnvMap, keys: string[]): string {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  throw new Error(`Missing required environment variable: ${keys.join(' or ')}`);
}

function ensureServerOnly(label: string): void {
  const globalWithWindow = globalThis as unknown as { window?: unknown };
  if (typeof globalWithWindow.window !== 'undefined') {
    throw new Error(`${label} is server-only and cannot run in browser context.`);
  }
}

function assertNonEmpty(value: string, field: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }
}

// ---------------------------------------------------------------------------
// Runtime loader for @supabase/supabase-js
// ---------------------------------------------------------------------------

type DynamicImporter = (specifier: string) => Promise<unknown>;

const dynamicImport: DynamicImporter = new Function(
  'specifier',
  'return import(specifier);'
) as DynamicImporter;

async function loadRuntimeCreateClient(): Promise<SupabaseCreateClientFn> {
  const moduleShape = (await dynamicImport('@supabase/supabase-js')) as {
    createClient?: SupabaseCreateClientFn;
  };

  if (!moduleShape.createClient || typeof moduleShape.createClient !== 'function') {
    throw new Error(
      'Unable to load createClient from @supabase/supabase-js. Ensure dependency is installed in runtime.'
    );
  }

  return moduleShape.createClient;
}

// ---------------------------------------------------------------------------
// Factory builder
// ---------------------------------------------------------------------------

function buildFactoryWithCreateClient(
  createClient: SupabaseCreateClientFn,
  env: EnvMap
): USCESupabaseClientFactory {
  const supabaseUrl = getRequiredEnvValue(env, ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']) || DEFAULT_SUPABASE_URL;
  const anonKey = getRequiredEnvValue(env, ['SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);
  const serviceRoleKey = getRequiredEnvValue(env, ['SUPABASE_SERVICE_ROLE_KEY']);

  return {
    createUserFacingClient(input: CreateUserFacingClientInput): SupabaseClientLike {
      assertNonEmpty(input.accessToken, 'accessToken');

      return createClient(supabaseUrl, anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${input.accessToken}`,
          },
        },
      });
    },

    createServiceRoleClient(input: CreateServiceRoleClientInput): SupabaseClientLike {
      ensureServerOnly('createServiceRoleClient');

      if (input.internal !== true) {
        throw new Error('Service role client requires explicit internal=true.');
      }

      return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      });
    },

    createPortalContextClient(input: CreatePortalContextClientInput): SupabaseClientLike {
      assertNonEmpty(input.accessToken, 'accessToken');
      assertNonEmpty(input.portalToken, 'portalToken');

      return createClient(supabaseUrl, anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${input.accessToken}`,
            // Context only; identity must still come from caller JWT (auth.uid()).
            'x-usce-portal-token': input.portalToken,
          },
        },
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Public APIs
// ---------------------------------------------------------------------------

/**
 * Preferred path for tests and server code that can inject createClient directly.
 */
export function createUSCESupabaseClientFactory(
  options: FactoryBootstrapOptions
): USCESupabaseClientFactory {
  const env = resolveEnv(options.env);

  if (!options.createClient) {
    throw new Error(
      'createUSCESupabaseClientFactory requires an injected createClient function. ' +
        'Use createUSCESupabaseClientFactoryFromRuntime() for lazy runtime loading.'
    );
  }

  return buildFactoryWithCreateClient(options.createClient, env);
}

/**
 * Runtime path: lazy-load @supabase/supabase-js at execution time.
 */
export async function createUSCESupabaseClientFactoryFromRuntime(
  options: Omit<FactoryBootstrapOptions, 'createClient'> = {}
): Promise<USCESupabaseClientFactory> {
  const env = resolveEnv(options.env);
  const createClient = await loadRuntimeCreateClient();
  return buildFactoryWithCreateClient(createClient, env);
}
