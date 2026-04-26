/**
 * POST /api/usce/requests
 * Authority: W-028 Step 2.3
 *
 * Requirements:
 * - Validate payload before DB mutation
 * - Use user-context Supabase client (RLS enforced)
 * - Reject anonymous access
 * - Insert into command_center.usce_requests
 * - Return created request object
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCreateRequestBody } from '@/lib/usce/schemas';
import { createUSCESupabaseClientFactoryFromRuntime } from '@/lib/usce/supabaseClient';

type ErrorBody = {
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
};

function requestId(): string {
  return `usce_req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function extractBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization');
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }
  const token = authorization.slice(7).trim();
  return token.length > 0 ? token : null;
}

function errorResponse(status: number, body: ErrorBody): NextResponse<ErrorBody> {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  const rid = requestId();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(400, {
      code: 'INVALID_JSON',
      message: 'Request body must be valid JSON.',
      requestId: rid,
    });
  }

  const parsed = validateCreateRequestBody(payload);
  if (!parsed.success) {
    return errorResponse(400, {
      code: 'VALIDATION_FAILED',
      message: 'Invalid create request payload.',
      requestId: rid,
      details: parsed.errors,
    });
  }

  const accessToken = extractBearerToken(request);
  if (!accessToken) {
    return errorResponse(401, {
      code: 'AUTH_SESSION_MISSING',
      message: 'Authorization Bearer token is required.',
      requestId: rid,
    });
  }

  const factory = await createUSCESupabaseClientFactoryFromRuntime();
  const supabase = factory.createUserFacingClient({ accessToken }) as {
    auth: { getUser: () => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }> };
    schema: (schemaName: string) => {
      from: (tableName: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string | boolean) => {
            eq: (column2: string, value2: string | boolean) => {
              maybeSingle: () => Promise<{ data: { id: string; program_name: string; active: boolean } | null; error: { code?: string; message: string } | null }>;
            };
            single: () => Promise<{ data: Record<string, unknown> | null; error: { code?: string; message: string } | null }>;
          };
        };
        insert: (row: Record<string, unknown>) => {
          select: (columns: string) => {
            single: () => Promise<{ data: Record<string, unknown> | null; error: { code?: string; message: string } | null }>;
          };
        };
      };
    };
  };

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user?.id) {
    return errorResponse(401, {
      code: 'AUTH_SESSION_INVALID',
      message: 'Authenticated user session is required.',
      requestId: rid,
      details: userError ? { supabase: userError.message } : undefined,
    });
  }

  const { data: programSeat, error: programSeatError } = await supabase
    .schema('command_center')
    .from('usce_program_seats')
    .select('id, program_name, active')
    .eq('id', parsed.data.program_seat_id)
    .eq('active', true)
    .maybeSingle();

  if (programSeatError) {
    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to resolve program seat.',
      requestId: rid,
      details: { supabase: programSeatError.message },
    });
  }

  if (!programSeat) {
    return errorResponse(409, {
      code: 'INVALID_PROGRAM_SEAT',
      message: 'Program seat does not exist or is not active.',
      requestId: rid,
    });
  }

  const insertRow = {
    applicant_name: parsed.data.applicant_name,
    applicant_email: parsed.data.applicant_email,
    applicant_phone_e164: parsed.data.applicant_phone_e164 ?? null,
    program_name: programSeat.program_name,
    program_seat_id: parsed.data.program_seat_id,
    preferred_specialties: parsed.data.preferred_specialties,
    preferred_locations: parsed.data.preferred_locations,
    preferred_months: parsed.data.preferred_months,
    preference_rankings: parsed.data.preference_rankings,
    source: 'manual_coordinator',
    intake_payload: parsed.data.intake_payload ?? {},
  };

  const { data: created, error: createError } = await supabase
    .schema('command_center')
    .from('usce_requests')
    .insert(insertRow)
    .select('*')
    .single();

  if (createError) {
    if (createError.code === '23505') {
      return errorResponse(409, {
        code: 'DUPLICATE_REQUEST',
        message: 'An active request already exists for this applicant and program.',
        requestId: rid,
      });
    }

    if (createError.code === '42501') {
      return errorResponse(403, {
        code: 'FORBIDDEN',
        message: 'Authenticated user is not allowed to create requests.',
        requestId: rid,
      });
    }

    return errorResponse(500, {
      code: 'DB_INSERT_FAILED',
      message: 'Failed to create request.',
      requestId: rid,
      details: { supabase: createError.message },
    });
  }

  return NextResponse.json(
    {
      request: created,
      request_id: created?.id ?? null,
    },
    { status: 201 }
  );
}

export async function GET(request: NextRequest) {
  const rid = requestId();

  const accessToken = extractBearerToken(request);
  if (!accessToken) {
    return errorResponse(401, {
      code: 'AUTH_SESSION_MISSING',
      message: 'Authorization Bearer token is required.',
      requestId: rid,
    });
  }

  const factory = await createUSCESupabaseClientFactoryFromRuntime();
  const supabase = factory.createUserFacingClient({ accessToken }) as {
    auth: { getUser: () => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }> };
    schema: (schemaName: string) => {
      from: (tableName: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            order: (
              columnName: string,
              opts: { ascending: boolean }
            ) => Promise<{ data: Record<string, unknown>[] | null; error: { code?: string; message: string } | null }>;
          };
        };
      };
    };
  };

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user?.id) {
    return errorResponse(401, {
      code: 'AUTH_SESSION_INVALID',
      message: 'Authenticated user session is required.',
      requestId: rid,
      details: userError ? { supabase: userError.message } : undefined,
    });
  }

  const { data: requests, error: listError } = await supabase
    .schema('command_center')
    .from('usce_requests')
    .select('*')
    .eq('assigned_coordinator_id', userData.user.id)
    .order('created_at', { ascending: false });

  if (listError) {
    if (listError.code === '42501') {
      return errorResponse(403, {
        code: 'FORBIDDEN',
        message: 'Authenticated user is not allowed to list requests.',
        requestId: rid,
      });
    }

    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to list requests.',
      requestId: rid,
      details: { supabase: listError.message },
    });
  }

  return NextResponse.json(
    {
      requests: requests ?? [],
    },
    { status: 200 }
  );
}
