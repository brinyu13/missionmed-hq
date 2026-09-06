import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRawBody, readJsonBody, parseJsonBody } from './http/body.mjs';
import { StripeGateway } from './payments/stripe.mjs';
import { NotificationGateway } from './notifications/notification-gateway.mjs';
import { localDayFromIso } from './domain/billing-engine.mjs';
import { authenticate, requireRole } from './security/auth.mjs';
import { PreviewStore, SupabaseRestStore } from './storage/supabase-rest.mjs';

const modulePath = fileURLToPath(import.meta.url);
const here = path.dirname(modulePath);
const defaultPublicDir = path.resolve(here, '../public');

function environmentConfig() {
  const production = process.env.NODE_ENV === 'production';
  return {
    production,
    localAuth: process.env.MISSIONACCOUNTS_AUTH_MODE === 'local',
    issuer: process.env.MISSIONACCOUNTS_JWT_ISSUER || 'https://missionmedinstitute.com/wp-json/missionmed/v1/missionaccounts',
    audience: process.env.MISSIONACCOUNTS_JWT_AUDIENCE || 'missionaccounts',
    jwksUrl: process.env.MISSIONACCOUNTS_JWKS_URL || 'https://missionmedinstitute.com/wp-json/missionmed/v1/jwks',
    jwtSecret: process.env.MISSIONACCOUNTS_JWT_SECRET || '',
    basePath: '/missionaccounts/',
    wpBootstrapPath: process.env.MISSIONACCOUNTS_WP_BOOTSTRAP_PATH || '/wp-admin/admin-ajax.php?action=missionmed_missionaccounts_bootstrap',
    tokenRefreshSkewSeconds: 15,
    features: {
      studentContacts: process.env.MISSIONACCOUNTS_STUDENT_CONTACTS === '1',
      billingDecisions: process.env.MISSIONACCOUNTS_BILLING_DECISIONS === '1',
      attendanceCorrections: process.env.MISSIONACCOUNTS_ATTENDANCE_CORRECTIONS === '1',
      examPlans: process.env.MISSIONACCOUNTS_EXAM_PLANS === '1',
      compDays: process.env.MISSIONACCOUNTS_COMP_DAYS === '1',
      autoBilling: process.env.MISSIONACCOUNTS_AUTO_BILLING === '1',
      notifications: process.env.MISSIONACCOUNTS_NOTIFICATIONS === '1',
      zoomSync: process.env.MISSIONACCOUNTS_ZOOM_SYNC === '1',
    },
    workerToken: process.env.MISSIONACCOUNTS_WORKER_TOKEN || '',
  };
}

function environmentStore() {
  const url = process.env.MISSIONACCOUNTS_SUPABASE_URL || '';
  const serviceKey = process.env.MISSIONACCOUNTS_SUPABASE_SERVICE_KEY || '';
  if (url && serviceKey) return new SupabaseRestStore({ url, serviceKey });
  if (url || serviceKey) throw new Error('MissionAccounts database configuration is incomplete');
  if (process.env.NODE_ENV === 'production') throw new Error('MissionAccounts production requires an explicit database target');
  return new PreviewStore();
}

function environmentStripeGateway() {
  return new StripeGateway({
    secretKey: process.env.MISSIONACCOUNTS_STRIPE_SECRET_KEY,
    webhookSecret: process.env.MISSIONACCOUNTS_STRIPE_WEBHOOK_SECRET,
    apiVersion: process.env.MISSIONACCOUNTS_STRIPE_API_VERSION || '',
    mode: process.env.MISSIONACCOUNTS_STRIPE_MODE || 'disabled',
  });
}

function environmentNotificationGateway() {
  return new NotificationGateway({
    endpoint: process.env.MISSIONACCOUNTS_NOTIFICATION_ENDPOINT || '',
    token: process.env.MISSIONACCOUNTS_NOTIFICATION_TOKEN || '',
    mode: process.env.MISSIONACCOUNTS_NOTIFICATION_MODE || 'disabled',
  });
}

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

function mime(file) {
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream';
}

function requestError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function requestIdFor(request) {
  const requestId = String(request.headers['idempotency-key'] || request.headers['x-request-id'] || '').trim();
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(requestId)) {
    throw requestError('A valid Idempotency-Key header is required');
  }
  return requestId;
}

function requireFeature(config, feature) {
  if (!config.features?.[feature]) throw requestError('This MissionAccounts capability is not enabled', 503);
}

function secureTokenEqual(actual, expected) {
  const left = Buffer.from(String(actual || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

export function createMissionAccountsServer({
  config = environmentConfig(),
  store = environmentStore(),
  stripeGateway = environmentStripeGateway(),
  notificationGateway = environmentNotificationGateway(),
  publicDir = defaultPublicDir,
  now = () => new Date(),
} = {}) {
  async function studentContext(identity) {
    const student = await store.studentByMatrixUser(identity.userId);
    if (!student) throw requestError('MissionAccounts record not found', 404);
    return student;
  }

  async function receiveStripeWebhook(request, response) {
    const rawBody = await readRawBody(request);
    stripeGateway.verifyWebhook(rawBody, request.headers['stripe-signature']);
    const event = parseJsonBody(rawBody);
    if (!event?.id || !event?.type || !event?.data?.object) throw requestError('Stripe event is incomplete');
    const result = await store.recordProviderEvent({
      provider: 'stripe',
      eventId: event.id,
      providerObjectId: event.data.object.id || null,
      eventType: event.type,
      payload: event,
      signatureVerified: true,
    });
    let effect = null;
    if (event.type === 'setup_intent.succeeded' && result.status !== 'processed') {
      const object = event.data.object;
      const studentId = String(object.metadata?.student_id || '');
      const customerId = String(object.customer || '');
      const paymentMethodId = String(object.payment_method || '');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(studentId)) {
        throw requestError('Stripe SetupIntent student binding is invalid');
      }
      const paymentMethod = await stripeGateway.retrievePaymentMethod(paymentMethodId);
      if (paymentMethod.customer !== customerId || paymentMethod.type !== 'card' || !paymentMethod.card) {
        throw requestError('Stripe payment method binding is invalid');
      }
      effect = await store.processStripeSetupIntent({
        eventId: event.id,
        studentId,
        customerId,
        paymentMethodId,
        brand: paymentMethod.card.brand || null,
        last4: paymentMethod.card.last4,
        expMonth: paymentMethod.card.exp_month,
        expYear: paymentMethod.card.exp_year,
      });
    } else if (['payment_intent.succeeded', 'payment_intent.payment_failed'].includes(event.type) && result.status !== 'processed') {
      const object = event.data.object;
      const studentId = String(object.metadata?.student_id || '');
      const attendanceDayId = String(object.metadata?.attendance_day_id || '');
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuid.test(studentId) || !uuid.test(attendanceDayId) || !/^pi_[A-Za-z0-9_]+$/.test(String(object.id || ''))) {
        throw requestError('Stripe PaymentIntent metadata binding is invalid');
      }
      effect = await store.processStripePaymentIntent({
        eventId: event.id,
        eventType: event.type,
        paymentIntentId: object.id,
        studentId,
        attendanceDayId,
        failureCode: object.last_payment_error?.code || null,
        failureMessage: object.last_payment_error?.message || null,
      });
    }
    return json(response, 200, { received: true, duplicate: result.duplicate === true || effect?.duplicate === true });
  }

  async function handleApi(request, response, url) {
    if (request.method === 'GET' && url.pathname === '/api/config') {
      return json(response, 200, {
        basePath: config.basePath || '/missionaccounts/',
        wpBootstrapPath: config.wpBootstrapPath || '/wp-admin/admin-ajax.php?action=missionmed_missionaccounts_bootstrap',
        tokenRefreshSkewSeconds: Number(config.tokenRefreshSkewSeconds || 15),
        localAuth: config.production !== true && config.localAuth === true,
        identityMode: config.localAuth ? 'local-preview' : 'missionmed-signed-jwt',
      });
    }
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json(response, 200, {
        status: 'ok',
        app: 'missionaccounts',
        mode: store instanceof PreviewStore ? 'preview' : 'configured',
        route_enabled: false,
        billing_decisions_enabled: Boolean(config.features?.billingDecisions),
        attendance_corrections_enabled: Boolean(config.features?.attendanceCorrections),
        auto_billing_enabled: Boolean(config.features?.autoBilling),
        notifications_enabled: Boolean(config.features?.notifications),
        zoom_sync_enabled: Boolean(config.features?.zoomSync),
      });
    }
    if (request.method === 'POST' && url.pathname === '/api/webhooks/stripe') {
      requireFeature(config, 'autoBilling');
      return receiveStripeWebhook(request, response);
    }
    if (request.method === 'POST' && url.pathname === '/api/internal/notifications/drain') {
      requireFeature(config, 'notifications');
      const bearer = String(request.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1] || '';
      if (!secureTokenEqual(bearer, config.workerToken)) throw requestError('Notification worker authentication failed', 401);
      notificationGateway.assertConfigured();
      const rawBody = await readRawBody(request, { limitBytes: 16_384 });
      const body = rawBody.length ? parseJsonBody(rawBody) : {};
      const limit = body.limit == null ? 10 : Number(body.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw requestError('Notification batch limit must be from 1 through 25');
      const workerId = `missionaccounts:${process.pid}`;
      const claimedAt = now().toISOString();
      const enqueued = await store.enqueueDueExamReminders({
        today: localDayFromIso(claimedAt),
        now: claimedAt,
        limit,
      });
      const claimed = await store.claimNotifications({ workerId, limit, now: claimedAt });
      let sent = 0;
      let failed = 0;
      let suppressed = 0;
      for (const notification of claimed) {
        if (!await store.notificationDeliverable({ notificationId: notification.id })) {
          suppressed += 1;
          continue;
        }
        try {
          const delivery = await notificationGateway.send(notification);
          await store.finishNotification({
            notificationId: notification.id,
            workerId,
            succeeded: true,
            providerRef: delivery.providerRef,
            error: null,
            now: now().toISOString(),
          });
          sent += 1;
        } catch (error) {
          await store.finishNotification({
            notificationId: notification.id,
            workerId,
            succeeded: false,
            providerRef: null,
            error: error instanceof Error ? error.message : 'Notification delivery failed',
            now: now().toISOString(),
          });
          failed += 1;
        }
      }
      return json(response, 200, { enqueued_due: enqueued.queued, claimed: claimed.length, sent, failed, suppressed });
    }

    const identity = await authenticate(request, config);
    if (request.method === 'GET' && url.pathname === '/api/session') {
      const role = identity.roles.includes('founder') ? 'founder'
        : identity.roles.includes('missionaccounts_admin') ? 'missionaccounts_admin'
          : 'student';
      return json(response, 200, {
        authenticated: true,
        mode: role === 'student' ? 'student' : 'admin',
        user: {
          id: identity.userId,
          display_name: identity.displayName || '',
          first_name: identity.firstName || '',
          email: identity.email || '',
          role,
          avatar_thumbnail_url: identity.avatarThumbnailUrl || '',
        },
        capabilities: {
          student_contacts: Boolean(config.features?.studentContacts),
          billing_decisions: Boolean(config.features?.billingDecisions),
          attendance_corrections: Boolean(config.features?.attendanceCorrections),
          exam_plans: Boolean(config.features?.examPlans),
          comp_days: Boolean(config.features?.compDays),
          auto_billing: Boolean(config.features?.autoBilling),
          notifications: Boolean(config.features?.notifications),
          zoom_sync: Boolean(config.features?.zoomSync),
        },
      });
    }
    if (request.method === 'GET' && url.pathname === '/api/ui/bootstrap') {
      const role = identity.roles.includes('founder') ? 'founder'
        : identity.roles.includes('missionaccounts_admin') ? 'missionaccounts_admin'
          : 'student';
      const user = {
        id: identity.userId,
        display_name: identity.displayName || '',
        first_name: identity.firstName || '',
        email: identity.email || '',
        role,
        avatar_thumbnail_url: identity.avatarThumbnailUrl || '',
      };
      if (role === 'student') {
        const student = await studentContext(identity);
        const [attendance, billing, payment_method, billing_consent, billing_terms, exam_plan, canon] = await Promise.all([
          store.attendanceForStudent(student.id),
          store.billingForStudent(student.id),
          store.paymentMethodForStudent(student.id),
          store.billingConsentForStudent(student.id),
          store.currentBillingTerms(),
          store.currentExamPlanForStudent(student.id),
          store.canonicalUiData({ scope: 'student', studentId: student.id }),
        ]);
        return json(response, 200, {
          schema_version: 'missionaccounts-ui-bootstrap-v1',
          scope: 'student',
          user,
          account: { student, attendance, billing, payment_method, billing_consent, billing_terms, exam_plan },
          canon,
        });
      }
      const cycles = await store.billingCycles();
      const [home, students, cycleProjections, identityClusters, health, canon] = await Promise.all([
        store.adminHome({ today: localDayFromIso(now().toISOString()) }),
        store.adminStudents(),
        Promise.all(cycles.map(cycle => store.adminCycle(cycle.key))),
        store.adminIdentityClusters({ state: 'all' }),
        store.adminHealth(),
        store.canonicalUiData({ scope: 'admin' }),
      ]);
      return json(response, 200, {
        schema_version: 'missionaccounts-ui-bootstrap-v1',
        scope: 'admin',
        user,
        home,
        students,
        cycles: cycleProjections.filter(Boolean),
        identity_clusters: identityClusters,
        health,
        canon,
      });
    }
    if (request.method === 'GET' && url.pathname === '/api/me') {
      const student = await studentContext(identity);
      const [attendance, billing, payment_method, billing_consent, billing_terms, exam_plan] = await Promise.all([
        store.attendanceForStudent(student.id, url.searchParams.get('cycle')),
        store.billingForStudent(student.id),
        store.paymentMethodForStudent(student.id),
        store.billingConsentForStudent(student.id),
        store.currentBillingTerms(),
        store.currentExamPlanForStudent(student.id),
      ]);
      return json(response, 200, { student, attendance, billing, payment_method, billing_consent, billing_terms, exam_plan });
    }
    if (request.method === 'POST' && url.pathname === '/api/me/exam-plan') {
      requireRole(identity, ['student']);
      requireFeature(config, 'examPlans');
      const student = await studentContext(identity);
      const body = await readJsonBody(request, { limitBytes: 16_384 });
      if (!['s1', 's2', 's3'].includes(body.step) || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.exam_on || ''))) {
        throw requestError('Exam plan requires step s1, s2, or s3 and exam_on as YYYY-MM-DD');
      }
      const result = await store.submitExamPlan({
        studentId: student.id,
        step: body.step,
        examOn: body.exam_on,
        today: localDayFromIso(now().toISOString()),
        actorId: identity.userId,
        actorRole: 'student',
        requestId: requestIdFor(request),
      });
      return json(response, result.duplicate ? 200 : 201, result);
    }
    const adminExamSubmitRoute = request.method === 'POST'
      ? url.pathname.match(/^\/api\/admin\/students\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/exam-plan$/i)
      : null;
    if (adminExamSubmitRoute) {
      requireRole(identity, ['missionaccounts_admin', 'founder']);
      requireFeature(config, 'examPlans');
      const body = await readJsonBody(request, { limitBytes: 16_384 });
      if (!['s1', 's2', 's3'].includes(body.step) || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.exam_on || ''))) {
        throw requestError('Exam plan requires step s1, s2, or s3 and exam_on as YYYY-MM-DD');
      }
      const result = await store.submitExamPlan({
        studentId: adminExamSubmitRoute[1],
        step: body.step,
        examOn: body.exam_on,
        today: localDayFromIso(now().toISOString()),
        actorId: identity.userId,
        actorRole: identity.roles.includes('founder') ? 'founder' : 'missionaccounts_admin',
        requestId: requestIdFor(request),
      });
      return json(response, result.duplicate ? 200 : 201, result);
    }
    if (request.method === 'POST' && url.pathname === '/api/me/exam-plan/passed') {
      requireRole(identity, ['student']);
      requireFeature(config, 'examPlans');
      const student = await studentContext(identity);
      const plan = await store.currentExamPlanForStudent(student.id);
      if (!plan) throw requestError('Current exam plan not found', 404);
      const rawBody = await readRawBody(request, { limitBytes: 16_384 });
      const body = rawBody.length ? parseJsonBody(rawBody) : {};
      const note = String(body.note || 'Student reported passing').trim();
      if (!note || note.length > 2_000) throw requestError('Exam result note is invalid');
      const result = await store.transitionExamPlan({
        planId: plan.id,
        toState: 'passed',
        result: 'passed',
        note,
        today: localDayFromIso(now().toISOString()),
        actorId: identity.userId,
        actorRole: 'student',
        requestId: requestIdFor(request),
      });
      return json(response, result.accepted === false ? 409 : result.duplicate ? 200 : 201, result);
    }
    if (request.method === 'POST' && url.pathname === '/api/me/payment-setup/session') {
      requireRole(identity, ['student']);
      requireFeature(config, 'autoBilling');
      const student = await studentContext(identity);
      const requestId = requestIdFor(request);
      let customer = await store.stripeCustomerForStudent(student.id);
      let customerCreated = false;
      if (!customer) {
        const stripeCustomer = await stripeGateway.createCustomer({
          studentId: student.id,
          email: student.email || '',
          name: student.display_name || '',
        });
        if (!/^cus_[A-Za-z0-9_]+$/.test(String(stripeCustomer.id || ''))) {
          throw requestError('Stripe customer creation returned an invalid reference', 502);
        }
        customer = await store.saveStripeCustomer({ studentId: student.id, customerId: stripeCustomer.id });
        customerCreated = true;
      }
      const setupIntent = await stripeGateway.createSetupIntent(customer.provider_customer_ref, student.id, requestId);
      if (!/^seti_[A-Za-z0-9_]+$/.test(String(setupIntent.id || '')) || !setupIntent.client_secret) {
        throw requestError('Stripe SetupIntent response is incomplete', 502);
      }
      return json(response, 201, {
        setup_intent_id: setupIntent.id,
        client_secret: setupIntent.client_secret,
        customer_created: customerCreated,
      });
    }
    if (['POST', 'DELETE'].includes(request.method) && url.pathname === '/api/me/consent') {
      requireRole(identity, ['student']);
      requireFeature(config, 'autoBilling');
      const student = await studentContext(identity);
      const rawBody = await readRawBody(request, { limitBytes: 16_384 });
      const body = rawBody.length ? parseJsonBody(rawBody) : {};
      const action = request.method === 'POST' ? 'authorize' : 'revoke';
      const termsVersion = action === 'authorize' ? String(body.terms_version || '').trim() : null;
      const reason = String(body.reason || (action === 'authorize'
        ? 'Student accepted automatic Drills billing terms'
        : 'Student revoked automatic Drills billing authorization')).trim();
      if (action === 'authorize' && !/^[A-Za-z0-9._:-]{1,100}$/.test(termsVersion)) {
        throw requestError('An approved billing terms_version is required');
      }
      if (!reason || reason.length > 2_000) throw requestError('Billing consent reason is invalid');
      const result = await store.setBillingConsent({
        studentId: student.id,
        action,
        termsVersion,
        acceptedIp: request.socket.remoteAddress || null,
        reason,
        actorId: identity.userId,
        actorRole: 'student',
        requestId: requestIdFor(request),
      });
      const status = result.accepted === false ? 409 : result.duplicate ? 200 : action === 'authorize' ? 201 : 200;
      return json(response, status, result);
    }
    if (request.method === 'DELETE' && url.pathname === '/api/me/payment-method') {
      requireRole(identity, ['student']);
      requireFeature(config, 'autoBilling');
      stripeGateway.assertTestMode();
      const student = await studentContext(identity);
      const requestId = requestIdFor(request);
      const prepared = await store.preparePaymentMethodRemoval({
        studentId: student.id,
        actorId: identity.userId,
        actorRole: 'student',
        requestId,
      });
      if (prepared.accepted === false) return json(response, 409, prepared);
      if (prepared.duplicate === true && prepared.payment_method?.status === 'removed') {
        const { provider_payment_method_ref: _privateRef, ...safe } = prepared;
        return json(response, 200, safe);
      }
      try {
        await stripeGateway.detachPaymentMethod(prepared.provider_payment_method_ref, requestId);
        const finished = await store.finishPaymentMethodRemoval({ studentId: student.id, requestId, succeeded: true, error: null });
        return json(response, 200, finished);
      } catch (error) {
        await store.finishPaymentMethodRemoval({
          studentId: student.id,
          requestId,
          succeeded: false,
          error: error instanceof Error ? error.message : 'Stripe payment method removal failed',
        });
        throw error;
      }
    }
    const dayChargeRoute = request.method === 'POST'
      ? url.pathname.match(/^\/api\/admin\/attendance-days\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/charge$/i)
      : null;
    if (dayChargeRoute) {
      requireRole(identity, ['missionaccounts_admin', 'founder']);
      requireFeature(config, 'autoBilling');
      stripeGateway.assertTestMode();
      const rawBody = await readRawBody(request, { limitBytes: 16_384 });
      const body = rawBody.length ? parseJsonBody(rawBody) : {};
      const requestId = requestIdFor(request);
      const result = await store.prepareDayCharge({
        attendanceDayId: dayChargeRoute[1],
        actorId: identity.userId,
        actorRole: identity.roles.includes('founder') ? 'founder' : 'missionaccounts_admin',
        requestId,
        explicitRetry: body.explicit_retry === true,
      });
      if (result.accepted === false) return json(response, 409, result);
      if (result.charge.state === 'succeeded') return json(response, 200, { ...result, already_succeeded: true });
      const paymentIntent = await stripeGateway.createDayCharge({
        customerId: result.customer_ref,
        paymentMethodId: result.payment_method_ref,
        studentId: result.charge.student_id,
        attendanceDayId: result.charge.attendance_day_id,
      });
      if (!/^pi_[A-Za-z0-9_]+$/.test(String(paymentIntent.id || ''))) {
        throw requestError('Stripe PaymentIntent response is incomplete', 502);
      }
      return json(response, result.duplicate ? 200 : 202, {
        accepted: true,
        duplicate: result.duplicate === true,
        charge: result.charge,
        payment_intent_id: paymentIntent.id,
        state: 'pending_webhook',
        audit_event_id: result.audit_event_id || null,
      });
    }
    const accountLinkRoute = request.method === 'POST'
      ? url.pathname.match(/^\/api\/admin\/students\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/account-link$/i)
      : null;
    if (accountLinkRoute) {
      requireRole(identity, ['missionaccounts_admin', 'founder']);
      const body = await readJsonBody(request, { limitBytes: 16_384 });
      const matrixUserId = String(body.matrix_user_id || '').toLowerCase();
      const joinedOn = body.joined_on == null || body.joined_on === '' ? null : String(body.joined_on);
      const reason = String(body.reason || '').trim();
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuid.test(matrixUserId) || (joinedOn && !/^\d{4}-\d{2}-\d{2}$/.test(joinedOn)) || reason.length < 3 || reason.length > 1_000) {
        throw requestError('Account link requires matrix_user_id, an optional joined_on date, and a reason');
      }
      const result = await store.linkStudentAccount({
        studentId: accountLinkRoute[1],
        matrixUserId,
        joinedOn,
        today: localDayFromIso(now().toISOString()),
        reason,
        actorId: identity.userId,
        actorRole: identity.roles.includes('founder') ? 'founder' : 'missionaccounts_admin',
        requestId: requestIdFor(request),
      });
      const { matrix_user_ref: _privateMatrixUserRef, ...safeStudent } = result.student;
      return json(response, result.duplicate ? 200 : 201, { ...result, student: safeStudent });
    }
    const studentContactRoute = request.method === 'POST'
      ? url.pathname.match(/^\/api\/admin\/students\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/contact$/i)
      : null;
    if (studentContactRoute) {
      requireRole(identity, ['missionaccounts_admin', 'founder']);
      requireFeature(config, 'studentContacts');
      const body = await readJsonBody(request, { limitBytes: 16_384 });
      const email = body.email == null ? '' : String(body.email).trim().toLowerCase();
      const phone = body.phone == null ? '' : String(body.phone).trim();
      const reason = String(body.reason || 'Dr J updated student contact information').trim();
      if (email && (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw requestError('Student email is invalid');
      if (phone.length > 100) throw requestError('Student phone is too long');
      if (!reason || reason.length > 2_000) throw requestError('A contact-change reason is required');
      const result = await store.setStudentContact({
        studentId: studentContactRoute[1],
        email: email || null,
        phone: phone || null,
        reason,
        actorId: identity.userId,
        actorRole: identity.roles.includes('founder') ? 'founder' : 'missionaccounts_admin',
        requestId: requestIdFor(request),
      });
      return json(response, result.duplicate ? 200 : 201, result);
    }
    const compRoute = request.method === 'POST'
      ? url.pathname.match(/^\/api\/admin\/students\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/comp$/i)
      : null;
    if (compRoute) {
      requireRole(identity, ['missionaccounts_admin', 'founder']);
      requireFeature(config, 'compDays');
      const body = await readJsonBody(request, { limitBytes: 16_384 });
      const allowance = Number(body.allowance);
      const joinedOn = body.joined_on == null || body.joined_on === '' ? null : String(body.joined_on);
      const reason = String(body.reason || '').trim();
      if (!Number.isInteger(allowance) || allowance < 0 || allowance > 365) throw requestError('Comp allowance must be an integer from 0 through 365');
      if (joinedOn && !/^\d{4}-\d{2}-\d{2}$/.test(joinedOn)) throw requestError('joined_on must be YYYY-MM-DD');
      if (!reason || reason.length > 2_000) throw requestError('A comp-day reason is required');
      const result = await store.setCompAllowance({
        studentId: compRoute[1],
        allowance,
        joinedOn,
        reason,
        applyRetroactively: body.apply_retroactively === true,
        actorId: identity.userId,
        actorRole: identity.roles.includes('founder') ? 'founder' : 'missionaccounts_admin',
        requestId: requestIdFor(request),
      });
      return json(response, result.duplicate ? 200 : 201, result);
    }
    const correctionRoute = request.method === 'POST'
      ? url.pathname.match(/^\/api\/admin\/students\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/corrections$/i)
      : null;
    if (correctionRoute) {
      requireRole(identity, ['missionaccounts_admin', 'founder']);
      requireFeature(config, 'attendanceCorrections');
      const body = await readJsonBody(request, { limitBytes: 32_768 });
      const type = String(body.type || '');
      const reason = String(body.reason || '').trim();
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const sessionId = body.session_id == null ? null : String(body.session_id);
      const attendanceEventId = body.attendance_event_id == null ? null : String(body.attendance_event_id);
      const revertsId = body.reverts_id == null ? null : String(body.reverts_id);
      if (!['add', 'remove', 'step_relabel', 'name', 'note'].includes(type)) throw requestError('Attendance correction type is invalid');
      if (!reason || reason.length > 2_000) throw requestError('An attendance correction reason is required');
      if (sessionId && !uuid.test(sessionId)) throw requestError('session_id must be a UUID');
      if (attendanceEventId && !uuid.test(attendanceEventId)) throw requestError('attendance_event_id must be a UUID');
      if (revertsId && !uuid.test(revertsId)) throw requestError('reverts_id must be a UUID');
      if (type === 'add' && !sessionId) throw requestError('session_id is required when adding attendance');
      if (['remove', 'step_relabel'].includes(type) && !attendanceEventId) throw requestError('attendance_event_id is required for this correction');
      if (type === 'step_relabel' && !['s1', 's23', 'unknown'].includes(body.to_val?.step)) throw requestError('Step relabel must specify s1, s23, or unknown');
      const result = await store.appendAttendanceCorrection({
        studentId: correctionRoute[1],
        sessionId,
        attendanceEventId,
        type,
        fromVal: body.from_val ?? null,
        toVal: body.to_val ?? null,
        reason,
        revertsId,
        actorId: identity.userId,
        actorRole: identity.roles.includes('founder') ? 'founder' : 'missionaccounts_admin',
        requestId: requestIdFor(request),
      });
      return json(response, result.duplicate ? 200 : 201, result);
    }
    const fullCycleCeilingRoute = request.method === 'POST'
      ? url.pathname.match(/^\/api\/admin\/students\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/full-cycle-ceilings\/([a-z0-9][a-z0-9-]{1,63})$/i)
      : null;
    if (fullCycleCeilingRoute) {
      requireRole(identity, ['missionaccounts_admin', 'founder']);
      requireFeature(config, 'billingDecisions');
      const body = await readJsonBody(request, { limitBytes: 16_384 });
      const status = String(body.status || '');
      const reason = String(body.reason || '').trim();
      if (!['candidate', 'verified', 'rejected'].includes(status) || reason.length < 3 || reason.length > 2_000) {
        throw requestError('Full-cycle ceiling decision requires candidate, verified, or rejected status and a reason');
      }
      const result = await store.decideFullCycleCeiling({
        studentId: fullCycleCeilingRoute[1],
        cycleKey: fullCycleCeilingRoute[2],
        status,
        reason,
        actorId: identity.userId,
        actorRole: identity.roles.includes('founder') ? 'founder' : 'missionaccounts_admin',
        requestId: requestIdFor(request),
      });
      return json(response, result.duplicate ? 200 : 201, result);
    }
    const billingDecisionRoute = request.method === 'POST'
      ? url.pathname.match(/^\/api\/admin\/students\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/decisions$/i)
      : null;
    if (billingDecisionRoute) {
      requireRole(identity, ['missionaccounts_admin', 'founder']);
      requireFeature(config, 'billingDecisions');
      const body = await readJsonBody(request, { limitBytes: 32_768 });
      const treatment = String(body.treatment || '');
      const cycleKey = String(body.cycle_key || '');
      const note = String(body.note || '').trim();
      const requestedAmountCents = body.requested_amount_cents == null ? null : Number(body.requested_amount_cents);
      if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(cycleKey)) throw requestError('A valid cycle_key is required');
      if (!['confirm', 'fullcycle', 'other', 'special', 'ucc', 'mul', 'waived', 'prepaid', 'already_paid', 'already_invoiced'].includes(treatment)) {
        throw requestError('Billing treatment is invalid');
      }
      if (['other', 'special'].includes(treatment) && (!Number.isInteger(requestedAmountCents) || requestedAmountCents < 0 || !note)) {
        throw requestError('Custom billing treatment requires a non-negative amount and note');
      }
      const result = await store.approveBillingDecision({
        studentId: billingDecisionRoute[1],
        cycleKey,
        treatment,
        requestedAmountCents,
        note: note || null,
        actorId: identity.userId,
        actorRole: identity.roles.includes('founder') ? 'founder' : 'missionaccounts_admin',
        requestId: requestIdFor(request),
      });
      return json(response, result.accepted === false ? 409 : result.duplicate ? 200 : 201, result);
    }
    const invoiceReadinessRoute = request.method === 'POST'
      ? url.pathname.match(/^\/api\/admin\/invoices\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/readiness$/i)
      : null;
    if (invoiceReadinessRoute) {
      requireRole(identity, ['missionaccounts_admin', 'founder']);
      requireFeature(config, 'billingDecisions');
      const body = await readJsonBody(request, { limitBytes: 16_384 });
      if (typeof body.ready !== 'boolean') throw requestError('Invoice readiness requires a boolean ready value');
      const reason = String(body.reason || (body.ready ? 'Dr J marked invoice ready to send' : 'Dr J removed invoice from ready')).trim();
      if (!reason || reason.length > 2_000) throw requestError('An invoice-readiness reason is required');
      const result = await store.setInvoiceReadiness({
        invoiceId: invoiceReadinessRoute[1],
        ready: body.ready,
        reason,
        actorId: identity.userId,
        actorRole: identity.roles.includes('founder') ? 'founder' : 'missionaccounts_admin',
        requestId: requestIdFor(request),
      });
      return json(response, result.accepted === false ? 409 : result.duplicate ? 200 : 201, result);
    }
    const examTransitionRoute = request.method === 'POST'
      ? url.pathname.match(/^\/api\/admin\/exam-plans\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(approve|deny|speak|followup|reopen|result)$/i)
      : null;
    if (examTransitionRoute) {
      requireRole(identity, ['missionaccounts_admin', 'founder']);
      requireFeature(config, 'examPlans');
      const body = await readJsonBody(request, { limitBytes: 16_384 });
      const action = examTransitionRoute[2].toLowerCase();
      const note = String(body.note || '').trim();
      const resultValue = body.result == null ? null : String(body.result);
      const suggestedOn = body.suggested_on == null || body.suggested_on === '' ? null : String(body.suggested_on);
      const toState = action === 'approve' ? 'approved'
        : action === 'deny' ? 'denied'
          : action === 'reopen' ? 'pending'
            : action === 'result' && resultValue === 'passed' ? 'passed'
              : action === 'result' ? 'followup'
                : action;
      if (action === 'result' && !['passed', 'not_passed', 'no_result'].includes(resultValue)) {
        throw requestError('Result must be passed, not_passed, or no_result');
      }
      if (suggestedOn && (action !== 'deny' || !/^\d{4}-\d{2}-\d{2}$/.test(suggestedOn))) {
        throw requestError('A suggested exam date is valid only when asking for another date');
      }
      if (['deny', 'speak', 'reopen', 'followup'].includes(action) && !note) {
        throw requestError('A reason is required for this exam-plan action');
      }
      const result = await store.transitionExamPlan({
        planId: examTransitionRoute[1],
        toState,
        result: action === 'result' ? resultValue : null,
        note: note || null,
        suggestedOn,
        today: localDayFromIso(now().toISOString()),
        actorId: identity.userId,
        actorRole: identity.roles.includes('founder') ? 'founder' : 'missionaccounts_admin',
        requestId: requestIdFor(request),
      });
      return json(response, result.accepted === false ? 409 : 200, result);
    }
    const cyclePolicyRoute = request.method === 'POST'
      ? url.pathname.match(/^\/api\/admin\/policy\/([A-Za-z0-9._-]{1,100})$/)
      : null;
    if (cyclePolicyRoute) {
      requireRole(identity, ['missionaccounts_admin', 'founder']);
      requireFeature(config, 'billingDecisions');
      const requestId = requestIdFor(request);
      const body = await readJsonBody(request, { limitBytes: 16_384 });
      const decision = String(body.decision || '').trim();
      const reason = String(body.reason || '').trim();
      if (!['cap', 'per', 'pending'].includes(decision)) {
        throw requestError('Cycle policy decision must be cap, per, or pending');
      }
      if (!reason || reason.length > 2_000) throw requestError('A cycle policy reason is required');
      const result = await store.setCyclePolicy({
        cycleKey: cyclePolicyRoute[1],
        decision,
        reason,
        actorId: identity.userId,
        actorRole: identity.roles.includes('founder') ? 'founder' : 'missionaccounts_admin',
        requestId,
      });
      const projection = await store.adminCycle(cyclePolicyRoute[1]);
      return json(response, result.duplicate ? 200 : 201, { ...result, projection });
    }
    if (request.method === 'GET' && url.pathname === '/api/admin/home') {
      requireRole(identity, ['missionaccounts_admin', 'founder']);
      return json(response, 200, await store.adminHome({ today: localDayFromIso(now().toISOString()) }));
    }
    const adminCycleRoute = request.method === 'GET'
      ? url.pathname.match(/^\/api\/admin\/cycles\/([a-z0-9][a-z0-9-]{1,63})$/i)
      : null;
    if (adminCycleRoute) {
      requireRole(identity, ['missionaccounts_admin', 'founder']);
      const projection = await store.adminCycle(adminCycleRoute[1]);
      if (!projection) throw requestError('Billing cycle not found', 404);
      return json(response, 200, projection);
    }
    if (request.method === 'GET' && url.pathname === '/api/admin/students') {
      requireRole(identity, ['missionaccounts_admin', 'founder']);
      const q = String(url.searchParams.get('q') || '').trim();
      const missing = url.searchParams.get('missing');
      if (q.length > 200) throw requestError('Student search is too long');
      if (missing && !['email', 'setup'].includes(missing)) throw requestError('Student missing filter is invalid');
      return json(response, 200, { students: await store.adminStudents({ q, missing }) });
    }
    if (request.method === 'GET' && url.pathname === '/api/admin/identity') {
      requireRole(identity, ['missionaccounts_admin', 'founder']);
      const requestedState = url.searchParams.get('state') || 'open';
      if (!['open', 'resolved', 'all'].includes(requestedState)) throw requestError('Identity state filter is invalid');
      return json(response, 200, { clusters: await store.adminIdentityClusters({ state: requestedState }) });
    }
    const adminStudentRoute = request.method === 'GET'
      ? url.pathname.match(/^\/api\/admin\/students\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)
      : null;
    if (adminStudentRoute) {
      requireRole(identity, ['missionaccounts_admin', 'founder']);
      const projection = await store.adminStudent(adminStudentRoute[1]);
      if (!projection) throw requestError('Student record not found', 404);
      return json(response, 200, projection);
    }
    if (request.method === 'GET' && url.pathname === '/api/admin/health') {
      requireRole(identity, ['missionaccounts_admin', 'founder']);
      return json(response, 200, await store.adminHealth());
    }
    return json(response, 404, { code: 'NOT_FOUND', message: 'MissionAccounts endpoint not found' });
  }

  async function serveStatic(response, pathname) {
    const basePath = config.basePath || '/missionaccounts/';
    const normalizedBase = `/${String(basePath).replace(/^\/+|\/+$/g, '')}/`;
    const mountedPath = pathname.startsWith(normalizedBase) ? pathname.slice(normalizedBase.length) : pathname.replace(/^\/+/, '');
    const requestedIndex = config.production ? 'index.production.html' : 'index.html';
    const requested = pathname === '/' || pathname === normalizedBase.slice(0, -1) || pathname === normalizedBase || mountedPath === '' ? requestedIndex : mountedPath;
    const file = path.resolve(publicDir, requested);
    if (!file.startsWith(`${publicDir}${path.sep}`) || !existsSync(file)) return json(response, 404, { code: 'NOT_FOUND' });
    response.writeHead(200, { 'content-type': mime(file), 'cache-control': requested.endsWith('.html') ? 'no-store, private' : 'no-cache', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'" });
    createReadStream(file).pipe(response);
  }

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
      const basePath = config.basePath || '/missionaccounts/';
      const mountedApiPrefix = `/${String(basePath).replace(/^\/+|\/+$/g, '')}/api/`;
      if (url.pathname.startsWith(mountedApiPrefix)) {
        url.pathname = `/api/${url.pathname.slice(mountedApiPrefix.length)}`;
        await handleApi(request, response, url);
      } else if (url.pathname.startsWith('/api/')) await handleApi(request, response, url);
      else await serveStatic(response, url.pathname);
    } catch (error) {
      const status = Number(error.status) || 500;
      json(response, status, { code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_DENIED', message: config.production && status === 500 ? 'MissionAccounts request failed' : error.message });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  const config = environmentConfig();
  const server = createMissionAccountsServer({ config });
  const port = Number(process.env.PORT || 4179);
  const host = config.production ? '0.0.0.0' : '127.0.0.1';
  server.listen(port, host, () => console.log(`MissionAccounts server listening on http://${host}:${port}`));
}
