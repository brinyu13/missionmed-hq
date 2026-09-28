const baseUrl = requiredUrl(process.env.USCE_VERIFY_BASE_URL);
const expectedEmail = String(process.env.USCE_VERIFY_EXPECTED_EMAIL || '').trim().toLowerCase();
const expectedLogin = String(process.env.USCE_VERIFY_EXPECTED_LOGIN || '').trim().toLowerCase();
const expectDenied = process.env.USCE_VERIFY_EXPECT_DENIED === '1';
const browserOrigin = String(
  process.env.USCE_VERIFY_ORIGIN || 'https://cdn.missionmedinstitute.com',
).trim();
const token = await readTokenFromStdin();

try {
  const exchangeUrl = new URL('/api/auth/session', baseUrl);
  exchangeUrl.searchParams.set('token', token);
  exchangeUrl.searchParams.set('audience', 'hq');

  const exchangeResponse = await fetch(exchangeUrl, {
    headers: { Origin: browserOrigin },
    redirect: 'manual',
  });
  const exchange = await readJson(exchangeResponse);
  if (expectDenied) {
    console.log(JSON.stringify({
      base_origin: baseUrl.origin,
      exchange_status: exchangeResponse.status,
      authenticated: exchange?.authenticated === true,
      error: String(exchange?.error || ''),
    }, null, 2));
    process.exit(exchangeResponse.status === 403 ? 0 : 1);
  }
  const cookie = readCookieHeader(exchangeResponse);
  const accessToken = String(exchange?.accessToken || '').trim();
  const authHeaders = {
    Accept: 'application/json',
    Origin: browserOrigin,
    ...(cookie ? { Cookie: cookie } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  const persistenceResponse = await fetch(new URL('/api/auth/session?audience=hq', baseUrl), {
    headers: authHeaders,
    redirect: 'manual',
  });
  const persistence = await readJson(persistenceResponse);

  const queueUrl = new URL('/api/usce/admin/public-intake-requests?limit=5', baseUrl);
  const queueResponse = await fetch(queueUrl, { headers: authHeaders, redirect: 'manual' });
  const queue = await readJson(queueResponse);
  const queueItems = Array.isArray(queue?.items) ? queue.items : [];
  const existingOfferId = queueItems
    .map((item) => item?.latest_offer?.id || item?.latestOffer?.id || '')
    .find((value) => isUuid(value)) || '';
  const offerIdForContract = existingOfferId || '00000000-0000-4000-8000-000000000000';
  const offerResponse = await fetch(
    new URL(`/api/usce/admin/offers/${offerIdForContract}`, baseUrl),
    { headers: authHeaders, redirect: 'manual' },
  );
  const offer = await readJson(offerResponse);
  const offerCsrfResponse = await fetch(
    new URL(`/api/usce/admin/offers/${offerIdForContract}`, baseUrl),
    {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: '{}',
      redirect: 'manual',
    },
  );
  const invalidPublicOfferResponse = await fetch(
    new URL('/api/usce/offer/abcdefghijklmnopqrstuvwxyzABCDE1234567890_-', baseUrl),
    { headers: { Accept: 'application/json', Origin: browserOrigin }, redirect: 'manual' },
  );

  const unauthenticatedResponse = await fetch(queueUrl, {
    headers: { Accept: 'application/json', Origin: browserOrigin },
    redirect: 'manual',
  });
  const unauthenticated = await readJson(unauthenticatedResponse);

  const unrelatedResponse = await fetch(new URL('/api/bridge/health', baseUrl), {
    headers: authHeaders,
    redirect: 'manual',
  });

  const user = exchange?.user || {};
  const roles = Array.isArray(user.roles) ? user.roles.map((role) => String(role)) : [];
  const result = {
    base_origin: baseUrl.origin,
    exchange_status: exchangeResponse.status,
    authenticated: exchange?.authenticated === true,
    persistent: exchange?.sessionPersistent === true,
    audience: String(exchange?.audience || ''),
    api_scope: String(exchange?.apiScope || ''),
    user: {
      id: Number(user.id || 0),
      dboc_user_id: String(user.dbocUserId || ''),
      login: String(user.login || ''),
      email: String(user.email || ''),
      roles,
      auth_source: String(user.authSource || ''),
    },
    persistence_status: persistenceResponse.status,
    persistence_authenticated: persistence?.authenticated === true,
    queue_status: queueResponse.status,
    queue_items_returned: queueItems.length,
    queue_count: Number(queue?.pagination?.count ?? queueItems.length),
    existing_offer_found: Boolean(existingOfferId),
    offer_read_status: offerResponse.status,
    offer_read_ok: offer?.ok === true,
    offer_state: String(offer?.offer?.status || offer?.status || ''),
    offer_mutation_without_csrf_status: offerCsrfResponse.status,
    invalid_public_offer_status: invalidPublicOfferResponse.status,
    unauthenticated_queue_status: unauthenticatedResponse.status,
    unauthenticated_queue_error: String(unauthenticated?.error || ''),
    unrelated_route_status: unrelatedResponse.status,
  };

  console.log(JSON.stringify(result, null, 2));

  const identityMatches = (!expectedEmail || String(user.email || '').toLowerCase() === expectedEmail)
    && (!expectedLogin || String(user.login || '').toLowerCase() === expectedLogin);
  const accepted = exchangeResponse.status === 200
    && exchange?.authenticated === true
    && exchange?.sessionPersistent === true
    && String(exchange?.audience || '') === 'hq'
    && identityMatches
    && roles.includes('administrator')
    && persistenceResponse.status === 200
    && persistence?.authenticated === true
    && queueResponse.status === 200
    && (existingOfferId ? offerResponse.status === 200 : offerResponse.status === 404)
    && offerCsrfResponse.status === 403
    && invalidPublicOfferResponse.status === 404
    && unauthenticatedResponse.status === 401
    && unrelatedResponse.status === 404;
  if (!accepted) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ error: 'live_verification_failed', type: error?.name || 'Error' }));
  process.exitCode = 1;
}

function requiredUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    if (parsed.protocol !== 'https:') throw new Error('invalid');
    return parsed;
  } catch {
    throw new Error('USCE_VERIFY_BASE_URL must be an https URL');
  }
}

async function readTokenFromStdin() {
  process.stdin.setEncoding('utf8');
  let value = '';
  for await (const chunk of process.stdin) {
    value += chunk;
    if (value.length > 8_192) throw new Error('USCE verification token exceeded the input limit');
  }
  value = value.trim();
  if (!/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/u.test(value)) {
    throw new Error('USCE verification token format is invalid');
  }
  return value;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function readCookieHeader(response) {
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  return setCookies.map((value) => String(value).split(';', 1)[0]).filter(Boolean).join('; ');
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    String(value || ''),
  );
}
