import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { authorize, issueDevToken, fixtureIdentities } from './auth.mjs';
import { config, validateConfig } from './config.mjs';
import {
  appendActivity,
  closePool,
  healthCheck,
  withIdentity,
  withServiceTransaction,
} from './db.mjs';

/*
 * HomeBase V1 API — HB-360A-001
 *
 * Derived from the StoryForge V5 runtime conventions (isolated Railway API,
 * WordPress-signed bearer identity, per-request database identity, additive
 * activity records). HomeBase is the session command center for students and
 * Dr Brian; File Vault, Calendar, and Matrix remain the owning systems for
 * documents, events, and authentication.
 */

const jsonLimit = 1 * 1024 * 1024;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.woff2', 'font/woff2'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

const CHECKLIST_STATUSES = new Set([
  'not_started', 'waiting_on_student', 'submitted', 'in_review',
  'waiting_on_drb', 'revision_needed', 'approved', 'completed', 'not_applicable',
]);
const OWNERS = new Set(['student', 'drb', 'none']);
const ENROLLMENT_STATUSES = new Set(['active', 'hidden', 'archived', 'removed']);
const PHOTO_STATES = new Set(['missing', 'uploaded', 'approved']);
const TASK_ASSIGNMENT_STATUSES = new Set([
  'assigned', 'submitted', 'revision_needed', 'approved', 'completed', 'reopened',
]);
const ALERT_KINDS = new Set(['alert', 'priority']);
const URGENCIES = new Set(['info', 'notice', 'urgent']);
const CATEGORY_STATES = new Set(['active', 'hidden', 'archived']);

export const PS_STAGES = Object.freeze([
  { stage: 0, admin: 'No info from student', student: 'Getting Started' },
  { stage: 1, admin: 'Story approved', student: 'Story Selected' },
  { stage: 2, admin: '1st/test draft in progress', student: 'Initial Draft in Progress' },
  { stage: 3, admin: '1st draft completed', student: 'First Draft Complete' },
  { stage: 4, admin: 'Advanced draft', student: 'Advanced Draft' },
  { stage: 5, admin: 'Alumni/PD/APD/Faculty review', student: 'Expert Review' },
  { stage: 6, admin: 'Final/review with student', student: 'Final Student Review' },
  { stage: 7, admin: 'Final completed', student: 'Finalized' },
]);

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function sendError(response, error) {
  const status = Number(error?.status) || (String(error?.code || '').includes('auth') ? 401 : 500);
  sendJson(response, status, {
    error: {
      code: String(error?.code || 'internal_error'),
      message: status >= 500 && !error?.code
        ? 'HomeBase hit an unexpected problem. Please try again.'
        : String(error?.message || 'Request failed.'),
    },
  });
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > jsonLimit) throw httpError(413, 'payload_too_large', 'The request body is too large.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw httpError(400, 'invalid_json', 'The request body must be valid JSON.');
  }
}

function applyCors(request, response) {
  const origin = String(request.headers.origin || '');
  if (!origin) return true;
  if (!config.allowedOrigins.includes(origin)) return false;
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  return true;
}

function text(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function optionalDate(value) {
  const raw = text(value, 20);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw httpError(400, 'invalid_date', 'Dates must use YYYY-MM-DD.');
  return raw;
}

function requireUuid(value, label = 'id') {
  const raw = text(value, 64);
  if (!uuidPattern.test(raw)) throw httpError(400, 'invalid_id', `A valid ${label} is required.`);
  return raw.toLowerCase();
}

function psStageInfo(stage) {
  return PS_STAGES[Number(stage)] || PS_STAGES[0];
}

function enrollmentView(row, { admin = false } = {}) {
  const ps = psStageInfo(row.ps_stage);
  const base = {
    id: row.id,
    sessionId: row.session_id,
    sessionKey: row.session_key || undefined,
    sessionName: row.session_name || undefined,
    programName: row.program_name || undefined,
    firstName: row.first_name,
    lastName: row.last_name,
    name: `${row.first_name} ${row.last_name}`.trim(),
    photoUrl: row.photo_url,
    photoState: row.photo_state,
    psStage: Number(row.ps_stage),
    psStageLabel: ps.student,
    currentStatus: row.current_status,
    ballOwner: row.ball_owner,
    studentNextAction: row.student_next_action,
    drbNextAction: row.drb_next_action,
    nextMilestone: row.next_milestone,
    deadline: row.deadline,
    lastActivityAt: row.last_activity_at,
    updatedAt: row.updated_at,
  };
  if (!admin) return base;
  return {
    ...base,
    wpUserId: row.wp_user_id,
    email: row.email,
    username: row.username,
    identityStatus: row.identity_status,
    identityNote: row.identity_note,
    rosterSource: row.roster_source,
    status: row.status,
    adminNote: row.admin_note,
    psStageAdminLabel: ps.admin,
    createdAt: row.created_at,
  };
}

const enrollmentSelect = `
  SELECT e.*, s.key AS session_key, s.name AS session_name, p.name AS program_name
  FROM public.hb_enrollments e
  JOIN public.hb_sessions s ON s.id = e.session_id
  JOIN public.hb_programs p ON p.id = s.program_id
`;

async function findOwnEnrollment(client, identity) {
  const byWpUser = await client.query(
    `${enrollmentSelect} WHERE e.wp_user_id = $1 AND e.status = 'active' ORDER BY e.created_at LIMIT 1`,
    [identity.wpUserId],
  );
  if (byWpUser.rows[0]) return { row: byWpUser.rows[0], bound: false };

  // Identity-match priority from HB-360A-001 section 5: signed email first,
  // then signed username. Never bind by name alone — that stays admin review.
  const email = text(identity.email, 190).toLowerCase();
  if (email) {
    const byEmail = await client.query(
      `${enrollmentSelect}
       WHERE lower(e.email) = $1 AND e.wp_user_id IS NULL AND e.status = 'active'
       ORDER BY e.created_at LIMIT 1`,
      [email],
    );
    if (byEmail.rows[0]) return { row: byEmail.rows[0], bound: true, via: 'email' };
  }
  const username = text(identity.username, 80).toLowerCase();
  if (username) {
    const byUsername = await client.query(
      `${enrollmentSelect}
       WHERE lower(e.username) = $1 AND e.wp_user_id IS NULL AND e.status = 'active'
       ORDER BY e.created_at LIMIT 1`,
      [username],
    );
    if (byUsername.rows[0]) return { row: byUsername.rows[0], bound: true, via: 'username' };
  }
  return { row: null, bound: false };
}

async function resolveEnrollment(identity) {
  return withServiceTransaction(async (client) => {
    const found = await findOwnEnrollment(client, identity);
    if (!found.row) return null;
    if (found.bound) {
      await client.query(
        `UPDATE public.hb_enrollments
         SET wp_user_id = $1, subject_id = $2, identity_status = 'matched',
             identity_note = trim(both ' ' from identity_note || ' Matched at first sign-in via signed ' || $3 || '.'),
             last_activity_at = now(), updated_at = now()
         WHERE id = $4`,
        [identity.wpUserId, identity.sub, found.via, found.row.id],
      );
      await appendActivity(client, {
        action: 'identity_matched',
        entityType: 'enrollment',
        entityId: found.row.id,
        sessionId: found.row.session_id,
        enrollmentId: found.row.id,
        actorRole: 'system',
        actorName: 'HomeBase',
        summary: `Matrix identity linked automatically via signed ${found.via}.`,
        studentVisible: false,
      });
      const refreshed = await client.query(`${enrollmentSelect} WHERE e.id = $1`, [found.row.id]);
      return refreshed.rows[0];
    }
    return found.row;
  });
}

function requireAdmin(identity) {
  if (identity.wordpressAdmin !== true) {
    throw httpError(403, 'admin_required', 'Signed WordPress administrator authority is required.');
  }
}

async function requireStudentEnrollment(identity) {
  const row = await resolveEnrollment(identity);
  if (!row) {
    throw httpError(403, 'homebase_roster_required',
      'Your account is not on the Session A HomeBase roster. If you believe this is an error, contact Dr B.');
  }
  return row;
}

// ---------------------------------------------------------------------------
// Shared payload builders
// ---------------------------------------------------------------------------

async function progressPayload(client, enrollmentId, sessionId, { admin = false } = {}) {
  const categories = await client.query(
    `SELECT c.* FROM public.hb_checklist_categories c
     WHERE (c.scope_type = 'global'
        OR (c.scope_type = 'session' AND c.scope_session = $1)
        OR (c.scope_type = 'program' AND c.scope_program = (SELECT program_id FROM public.hb_sessions WHERE id = $1))
        OR (c.scope_type = 'student' AND c.scope_enrollment = $2))
       ${admin ? '' : "AND c.state = 'active'"}
     ORDER BY c.sort_order, c.created_at`,
    [sessionId, enrollmentId],
  );
  const items = await client.query(
    `SELECT i.*, st.status AS student_status, st.owner AS student_owner,
            st.due_date AS student_due_date, st.note AS student_note,
            st.updated_at AS state_updated_at, st.id AS state_id
     FROM public.hb_checklist_items i
     JOIN public.hb_checklist_categories c ON c.id = i.category_id
     LEFT JOIN public.hb_item_states st
       ON st.item_id = i.id AND st.enrollment_id = $2
     WHERE (c.scope_type = 'global'
        OR (c.scope_type = 'session' AND c.scope_session = $1)
        OR (c.scope_type = 'program' AND c.scope_program = (SELECT program_id FROM public.hb_sessions WHERE id = $1))
        OR (c.scope_type = 'student' AND c.scope_enrollment = $2))
       AND (i.scope_enrollment IS NULL OR i.scope_enrollment = $2)
       ${admin ? '' : "AND i.state = 'active' AND c.state = 'active'"}
     ORDER BY i.sort_order, i.created_at`,
    [sessionId, enrollmentId],
  );
  return categories.rows.map((category) => ({
    id: category.id,
    key: category.key,
    title: category.title,
    description: category.description,
    state: category.state,
    sortOrder: category.sort_order,
    scopeType: category.scope_type,
    builtin: category.builtin,
    items: items.rows
      .filter((item) => item.category_id === category.id)
      .map((item) => ({
        id: item.id,
        stateId: item.state_id,
        key: item.key,
        title: item.title,
        description: item.description,
        state: item.state,
        sortOrder: item.sort_order,
        required: item.required,
        isPsTracker: item.is_ps_tracker,
        defaultOwner: item.default_owner,
        status: item.student_status || item.default_status,
        owner: item.student_owner || item.default_owner,
        dueDate: item.student_due_date || item.due_date,
        note: item.student_note || '',
        linkVaultDocument: item.link_vault_document,
        linkCalendar: item.link_calendar,
        updatedAt: item.state_updated_at,
      })),
  }));
}

async function alertsPayload(client, enrollmentId, sessionId) {
  const result = await client.query(
    `SELECT a.*, (d.alert_id IS NOT NULL) AS dismissed
     FROM public.hb_alerts a
     LEFT JOIN public.hb_alert_dismissals d
       ON d.alert_id = a.id AND d.enrollment_id = $2
     WHERE a.state = 'active'
       AND a.starts_at <= now()
       AND (a.expires_at IS NULL OR a.expires_at > now())
       AND (a.scope_type = 'global'
        OR (a.scope_type = 'session' AND a.scope_session = $1)
        OR (a.scope_type = 'program' AND a.scope_program = (SELECT program_id FROM public.hb_sessions WHERE id = $1))
        OR (a.scope_type = 'student' AND a.scope_enrollment = $2))
     ORDER BY a.sort_order, a.created_at DESC`,
    [sessionId, enrollmentId],
  );
  const rows = result.rows.filter((row) => !(row.dismissed && row.dismissible));
  return {
    priorities: rows.filter((row) => row.kind === 'priority').map(alertView),
    alerts: rows.filter((row) => row.kind === 'alert').map(alertView),
  };
}

function alertView(row) {
  return {
    id: row.id,
    kind: row.kind,
    scopeType: row.scope_type,
    scopeEnrollment: row.scope_enrollment || null,
    title: row.title,
    body: row.body,
    urgency: row.urgency,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    dismissible: row.dismissible,
    dismissed: row.dismissed === true,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    sortOrder: row.sort_order,
    state: row.state,
  };
}

async function tasksPayload(client, enrollmentId) {
  const result = await client.query(
    `SELECT t.*, a.id AS assignment_id, a.status AS assignment_status,
            a.student_comment, a.admin_comment, a.submitted_at, a.completed_at,
            a.updated_at AS assignment_updated_at
     FROM public.hb_task_assignments a
     JOIN public.hb_tasks t ON t.id = a.task_id
     WHERE a.enrollment_id = $1 AND t.status <> 'cancelled'
     ORDER BY (t.due_date IS NULL), t.due_date, t.created_at DESC`,
    [enrollmentId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    assignmentId: row.assignment_id,
    title: row.title,
    description: row.description,
    assignedBy: row.assigned_by_name,
    assignedOn: row.assigned_on,
    dueDate: row.due_date,
    priority: row.priority,
    audience: row.audience,
    status: row.assignment_status,
    requiredUpload: row.required_upload,
    studentComment: row.student_comment,
    adminComment: row.admin_comment,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at,
    updatedAt: row.assignment_updated_at,
    linkItem: row.link_item,
    linkVaultDocument: row.link_vault_document,
    linkCalendar: row.link_calendar,
  }));
}

async function activityPayload(client, enrollmentId, { studentSafe = true, limit = 30 } = {}) {
  const result = await client.query(
    `SELECT * FROM public.hb_activity
     WHERE enrollment_id = $1 ${studentSafe ? 'AND student_visible' : ''}
     ORDER BY created_at DESC
     LIMIT $2`,
    [enrollmentId, limit],
  );
  return result.rows.map(activityView);
}

function activityView(row) {
  return {
    id: String(row.id),
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    enrollmentId: row.enrollment_id,
    actorRole: row.actor_role,
    actorName: row.actor_name,
    summary: row.summary,
    studentVisible: row.student_visible,
    createdAt: row.created_at,
  };
}

async function filesPayload(client, enrollmentId, { admin = false } = {}) {
  const result = await client.query(
    `SELECT * FROM public.hb_files
     WHERE enrollment_id = $1 ${admin ? '' : 'AND student_visible'}
     ORDER BY created_at DESC
     LIMIT 100`,
    [enrollmentId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind,
    vaultDocumentUuid: row.vault_document_uuid,
    externalUrl: row.external_url,
    linkItem: row.link_item,
    linkTask: row.link_task,
    studentVisible: row.student_visible,
    createdAt: row.created_at,
  }));
}

async function studentHomePayload(enrollmentRow) {
  return withServiceTransaction(async (client) => {
    const [progress, alerts, tasks, activity, files] = await Promise.all([
      progressPayload(client, enrollmentRow.id, enrollmentRow.session_id),
      alertsPayload(client, enrollmentRow.id, enrollmentRow.session_id),
      tasksPayload(client, enrollmentRow.id),
      activityPayload(client, enrollmentRow.id, { studentSafe: true, limit: 12 }),
      filesPayload(client, enrollmentRow.id),
    ]);
    const upcoming = [];
    for (const category of progress) {
      for (const item of category.items) {
        if (item.dueDate && !['completed', 'approved', 'not_applicable'].includes(item.status)) {
          upcoming.push({ kind: 'checklist', title: item.title, dueDate: item.dueDate });
        }
      }
    }
    for (const task of tasks) {
      if (task.dueDate && !['completed', 'approved'].includes(task.status)) {
        upcoming.push({ kind: 'task', title: task.title, dueDate: task.dueDate });
      }
    }
    if (enrollmentRow.deadline) {
      upcoming.push({ kind: 'milestone', title: enrollmentRow.next_milestone || 'Session deadline', dueDate: enrollmentRow.deadline });
    }
    upcoming.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
    return {
      enrollment: enrollmentView(enrollmentRow),
      psStages: PS_STAGES,
      progress,
      ...alerts,
      tasks,
      activity,
      files: files.slice(0, 6),
      upcoming: upcoming.slice(0, 8),
    };
  });
}

// ---------------------------------------------------------------------------
// Admin operations
// ---------------------------------------------------------------------------

async function adminEnrollment(client, enrollmentId) {
  const result = await client.query(`${enrollmentSelect} WHERE e.id = $1`, [enrollmentId]);
  if (!result.rows[0]) throw httpError(404, 'enrollment_not_found', 'That student is not on the HomeBase roster.');
  return result.rows[0];
}

async function adminRoster(identity, url) {
  requireAdmin(identity);
  const query = text(url.searchParams.get('query'), 120).toLowerCase();
  const filter = text(url.searchParams.get('filter'), 40);
  const includeHidden = url.searchParams.get('includeHidden') === '1';
  return withServiceTransaction(async (client) => {
    const result = await client.query(
      `${enrollmentSelect}
       LEFT JOIN LATERAL (
         SELECT max(a.created_at) AS latest FROM public.hb_activity a WHERE a.enrollment_id = e.id
       ) act ON true
       WHERE e.status <> 'removed'
       ORDER BY e.last_name, e.first_name`,
    );
    const today = new Date().toISOString().slice(0, 10);
    const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    let rows = result.rows;
    if (!includeHidden) rows = rows.filter((row) => row.status === 'active');
    if (query) {
      rows = rows.filter((row) => (
        `${row.first_name} ${row.last_name} ${row.email || ''} ${row.username || ''}`.toLowerCase().includes(query)
      ));
    }
    const filters = {
      waiting_on_drb: (row) => row.ball_owner === 'drb',
      waiting_on_student: (row) => row.ball_owner === 'student',
      overdue: (row) => row.deadline && row.deadline < today,
      due_this_week: (row) => row.deadline && row.deadline >= today && row.deadline <= weekAhead,
      missing_photo: (row) => row.photo_state === 'missing',
      needs_review: (row) => row.identity_status === 'needs_review' || row.identity_status === 'not_supplied',
      no_next_action: (row) => !text(row.student_next_action) && !text(row.drb_next_action),
      hidden: (row) => row.status !== 'active',
    };
    if (filters[filter]) rows = rows.filter(filters[filter]);
    return {
      students: rows.map((row) => enrollmentView(row, { admin: true })),
      total: rows.length,
    };
  });
}

async function adminAddStudent(identity, body) {
  requireAdmin(identity);
  const firstName = text(body.firstName, 80);
  const lastName = text(body.lastName, 80);
  if (!firstName || !lastName) throw httpError(400, 'name_required', 'First and last name are required.');
  const email = text(body.email, 190).toLowerCase() || null;
  const username = text(body.username, 80).toLowerCase() || null;
  const sessionKey = text(body.sessionKey, 60) || '360-session-a';
  return withServiceTransaction(async (client) => {
    const session = await client.query('SELECT id FROM public.hb_sessions WHERE key = $1', [sessionKey]);
    if (!session.rows[0]) throw httpError(404, 'session_not_found', 'That session does not exist.');
    if (email) {
      const existing = await client.query(
        'SELECT id, first_name, last_name FROM public.hb_enrollments WHERE session_id = $1 AND lower(email) = $2',
        [session.rows[0].id, email],
      );
      if (existing.rows[0]) {
        throw httpError(409, 'enrollment_exists',
          `${existing.rows[0].first_name} ${existing.rows[0].last_name} already has this email on the roster.`);
      }
    }
    const inserted = await client.query(
      `INSERT INTO public.hb_enrollments
         (session_id, first_name, last_name, email, username, identity_status, identity_note, roster_source,
          student_next_action, drb_next_action)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'admin_add_student',
               'Upload your profile photo and confirm your contact details',
               'Preparing your Session A kickoff plan')
       RETURNING id, session_id`,
      [
        session.rows[0].id, firstName, lastName, email, username,
        email || username ? 'pending' : 'not_supplied',
        email || username ? '' : 'Added without email/username — identity requires admin review.',
      ],
    );
    await appendActivity(client, {
      action: 'student_added',
      entityType: 'enrollment',
      entityId: inserted.rows[0].id,
      sessionId: inserted.rows[0].session_id,
      enrollmentId: inserted.rows[0].id,
      actorRole: 'admin',
      actorName: identity.name || 'Dr B',
      actorSub: identity.sub,
      summary: `${firstName} ${lastName} added to the roster by + ADD STUDENT.`,
      studentVisible: false,
    });
    const row = await adminEnrollment(client, inserted.rows[0].id);
    return { student: enrollmentView(row, { admin: true }) };
  });
}

const ENROLLMENT_PATCHABLE = Object.freeze({
  firstName: { column: 'first_name', clean: (v) => text(v, 80) },
  lastName: { column: 'last_name', clean: (v) => text(v, 80) },
  email: { column: 'email', clean: (v) => text(v, 190).toLowerCase() || null },
  username: { column: 'username', clean: (v) => text(v, 80).toLowerCase() || null },
  status: {
    column: 'status',
    clean: (v) => {
      const value = text(v, 20);
      if (!ENROLLMENT_STATUSES.has(value)) throw httpError(400, 'invalid_status', 'Unknown roster status.');
      return value;
    },
  },
  identityStatus: {
    column: 'identity_status',
    clean: (v) => {
      const value = text(v, 20);
      if (!['pending', 'matched', 'needs_review', 'not_supplied'].includes(value)) {
        throw httpError(400, 'invalid_identity_status', 'Unknown identity status.');
      }
      return value;
    },
  },
  photoUrl: { column: 'photo_url', clean: (v) => text(v, 500) },
  photoState: {
    column: 'photo_state',
    clean: (v) => {
      const value = text(v, 20);
      if (!PHOTO_STATES.has(value)) throw httpError(400, 'invalid_photo_state', 'Unknown photo state.');
      return value;
    },
  },
  psStage: {
    column: 'ps_stage',
    clean: (v) => {
      const value = Number(v);
      if (!Number.isInteger(value) || value < 0 || value > 7) {
        throw httpError(400, 'invalid_ps_stage', 'PS stage must be 0-7.');
      }
      return value;
    },
  },
  currentStatus: { column: 'current_status', clean: (v) => text(v, 200) },
  ballOwner: {
    column: 'ball_owner',
    clean: (v) => {
      const value = text(v, 20);
      if (!OWNERS.has(value)) throw httpError(400, 'invalid_owner', 'Unknown ball owner.');
      return value;
    },
  },
  studentNextAction: { column: 'student_next_action', clean: (v) => text(v, 400) },
  drbNextAction: { column: 'drb_next_action', clean: (v) => text(v, 400) },
  nextMilestone: { column: 'next_milestone', clean: (v) => text(v, 200) },
  deadline: { column: 'deadline', clean: optionalDate },
  adminNote: { column: 'admin_note', clean: (v) => text(v, 4000) },
});

async function adminPatchStudent(identity, enrollmentId, body) {
  requireAdmin(identity);
  const id = requireUuid(enrollmentId, 'student id');
  const updates = [];
  const values = [];
  const changed = {};
  for (const [field, spec] of Object.entries(ENROLLMENT_PATCHABLE)) {
    if (!(field in body)) continue;
    const value = spec.clean(body[field]);
    values.push(value);
    updates.push(`${spec.column} = $${values.length}`);
    changed[field] = value;
  }
  if (!updates.length) throw httpError(400, 'no_changes', 'No editable fields were provided.');
  return withServiceTransaction(async (client) => {
    const before = await adminEnrollment(client, id);
    values.push(id);
    await client.query(
      `UPDATE public.hb_enrollments SET ${updates.join(', ')}, updated_at = now(), last_activity_at = now()
       WHERE id = $${values.length}`,
      values,
    );
    const after = await adminEnrollment(client, id);
    let summary = `Roster record updated (${Object.keys(changed).join(', ')}).`;
    let action = 'roster_updated';
    let studentVisible = false;
    if ('psStage' in changed && Number(before.ps_stage) !== Number(changed.psStage)) {
      const fromStage = psStageInfo(before.ps_stage);
      const toStage = psStageInfo(changed.psStage);
      action = 'ps_stage_changed';
      studentVisible = true;
      summary = `Dr B moved your Personal Statement from ${fromStage.student} → ${toStage.student}.`;
    } else if ('ballOwner' in changed && before.ball_owner !== changed.ballOwner) {
      action = 'ball_changed';
      studentVisible = true;
      summary = changed.ballOwner === 'drb'
        ? 'The ball moved to Dr B.'
        : changed.ballOwner === 'student'
          ? 'The ball is with you — check What I Need To Do.'
          : 'Ownership updated.';
    } else if ('status' in changed && before.status !== changed.status) {
      action = `roster_${changed.status}`;
      summary = `Roster status changed to ${changed.status}.`;
    } else if ('deadline' in changed) {
      action = 'deadline_changed';
      studentVisible = true;
      summary = changed.deadline
        ? `Your deadline was set to ${changed.deadline}.`
        : 'Your deadline was cleared.';
    }
    await appendActivity(client, {
      action,
      entityType: 'enrollment',
      entityId: id,
      sessionId: after.session_id,
      enrollmentId: id,
      actorRole: 'admin',
      actorName: identity.name || 'Dr B',
      actorSub: identity.sub,
      summary,
      studentVisible,
      previousValue: { psStage: before.ps_stage, ballOwner: before.ball_owner, status: before.status },
      newValue: changed,
    });
    return { student: enrollmentView(after, { admin: true }) };
  });
}

async function adminHome(identity) {
  requireAdmin(identity);
  return withServiceTransaction(async (client) => {
    const roster = await client.query(
      `${enrollmentSelect} WHERE e.status = 'active' ORDER BY e.last_name, e.first_name`,
    );
    const today = new Date().toISOString().slice(0, 10);
    const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const staleCutoff = new Date(Date.now() - 7 * 86400000).toISOString();
    const rows = roster.rows;
    const bucket = (predicate) => rows.filter(predicate).map((row) => enrollmentView(row, { admin: true }));
    const alerts = await client.query(
      `SELECT * FROM public.hb_alerts
       WHERE state = 'active' AND kind = 'priority'
         AND starts_at <= now() AND (expires_at IS NULL OR expires_at > now())
       ORDER BY sort_order, created_at DESC LIMIT 10`,
    );
    const psReview = await client.query(
      `SELECT st.enrollment_id FROM public.hb_item_states st
       JOIN public.hb_checklist_items i ON i.id = st.item_id
       WHERE st.status IN ('submitted', 'in_review', 'waiting_on_drb')
         AND i.category_id IN (SELECT id FROM public.hb_checklist_categories WHERE key = 'personal-statement')`,
    );
    const psReviewIds = new Set(psReview.rows.map((row) => row.enrollment_id));
    const activity = await client.query(
      'SELECT * FROM public.hb_activity ORDER BY created_at DESC LIMIT 20',
    );
    return {
      counts: { active: rows.length },
      waitingOnMe: bucket((row) => row.ball_owner === 'drb'),
      waitingOnStudent: bucket((row) => row.ball_owner === 'student'),
      overdue: bucket((row) => row.deadline && row.deadline < today),
      dueThisWeek: bucket((row) => row.deadline && row.deadline >= today && row.deadline <= weekAhead),
      psToReview: bucket((row) => psReviewIds.has(row.id) || [4, 5].includes(Number(row.ps_stage))),
      missingPhoto: bucket((row) => row.photo_state === 'missing'),
      identityReview: bucket((row) => ['needs_review', 'not_supplied'].includes(row.identity_status)),
      noNextAction: bucket((row) => !text(row.student_next_action) && !text(row.drb_next_action)),
      stalled: bucket((row) => !row.last_activity_at || String(row.last_activity_at.toISOString?.() || row.last_activity_at) < staleCutoff),
      priorities: alerts.rows.map(alertView),
      recentActivity: activity.rows.map(activityView),
    };
  });
}

async function adminChecklist(identity) {
  requireAdmin(identity);
  return withServiceTransaction(async (client) => {
    const session = await client.query("SELECT id FROM public.hb_sessions WHERE key = '360-session-a'");
    const sessionId = session.rows[0]?.id;
    const categories = await client.query(
      `SELECT * FROM public.hb_checklist_categories ORDER BY sort_order, created_at`,
    );
    const items = await client.query(
      `SELECT * FROM public.hb_checklist_items ORDER BY sort_order, created_at`,
    );
    return {
      sessionId,
      categories: categories.rows.map((category) => ({
        id: category.id,
        key: category.key,
        title: category.title,
        description: category.description,
        scopeType: category.scope_type,
        state: category.state,
        sortOrder: category.sort_order,
        builtin: category.builtin,
        items: items.rows.filter((item) => item.category_id === category.id).map((item) => ({
          id: item.id,
          key: item.key,
          title: item.title,
          description: item.description,
          state: item.state,
          sortOrder: item.sort_order,
          required: item.required,
          defaultOwner: item.default_owner,
          defaultStatus: item.default_status,
          dueBehavior: item.due_behavior,
          dueDate: item.due_date,
          isPsTracker: item.is_ps_tracker,
        })),
      })),
    };
  });
}

function slugify(value, fallback) {
  const slug = text(value, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || fallback;
}

async function adminCreateCategory(identity, body) {
  requireAdmin(identity);
  const title = text(body.title, 120);
  if (!title) throw httpError(400, 'title_required', 'A category title is required.');
  return withServiceTransaction(async (client) => {
    const session = await client.query("SELECT id FROM public.hb_sessions WHERE key = '360-session-a'");
    if (!session.rows[0]) throw httpError(500, 'session_missing', 'Session A is not seeded.');
    const key = slugify(body.key || title, `category-${Date.now()}`);
    const inserted = await client.query(
      `INSERT INTO public.hb_checklist_categories (key, title, description, scope_type, scope_session, sort_order)
       VALUES ($1, $2, $3, 'session', $4, COALESCE((SELECT max(sort_order) + 10 FROM public.hb_checklist_categories), 10))
       RETURNING id`,
      [key, title, text(body.description, 500), session.rows[0].id],
    );
    await appendActivity(client, {
      action: 'checklist_category_added',
      entityType: 'checklist_category',
      entityId: inserted.rows[0].id,
      sessionId: session.rows[0].id,
      actorRole: 'admin',
      actorName: identity.name || 'Dr B',
      actorSub: identity.sub,
      summary: `Checklist category "${title}" added.`,
      studentVisible: false,
    });
    return { id: inserted.rows[0].id };
  });
}

async function adminPatchCategory(identity, categoryId, body) {
  requireAdmin(identity);
  const id = requireUuid(categoryId, 'category id');
  const updates = [];
  const values = [];
  if ('title' in body) { values.push(text(body.title, 120)); updates.push(`title = $${values.length}`); }
  if ('description' in body) { values.push(text(body.description, 500)); updates.push(`description = $${values.length}`); }
  if ('sortOrder' in body) { values.push(Number(body.sortOrder) || 100); updates.push(`sort_order = $${values.length}`); }
  if ('state' in body) {
    const value = text(body.state, 20);
    if (!CATEGORY_STATES.has(value)) throw httpError(400, 'invalid_state', 'Unknown category state.');
    values.push(value); updates.push(`state = $${values.length}`);
  }
  if (!updates.length) throw httpError(400, 'no_changes', 'No editable fields were provided.');
  return withServiceTransaction(async (client) => {
    values.push(id);
    const result = await client.query(
      `UPDATE public.hb_checklist_categories SET ${updates.join(', ')}, updated_at = now()
       WHERE id = $${values.length} RETURNING id, title, scope_session`,
      values,
    );
    if (!result.rows[0]) throw httpError(404, 'category_not_found', 'That category does not exist.');
    await appendActivity(client, {
      action: 'checklist_category_updated',
      entityType: 'checklist_category',
      entityId: id,
      sessionId: result.rows[0].scope_session,
      actorRole: 'admin',
      actorName: identity.name || 'Dr B',
      actorSub: identity.sub,
      summary: `Checklist category "${result.rows[0].title}" updated.`,
      studentVisible: false,
    });
    return { ok: true };
  });
}

async function adminDeleteCategory(identity, categoryId, body) {
  requireAdmin(identity);
  const id = requireUuid(categoryId, 'category id');
  if (body.confirm !== true) {
    throw httpError(400, 'confirmation_required', 'Deleting a category requires confirm: true. Consider archiving instead.');
  }
  return withServiceTransaction(async (client) => {
    const result = await client.query(
      'DELETE FROM public.hb_checklist_categories WHERE id = $1 RETURNING title, scope_session',
      [id],
    );
    if (!result.rows[0]) throw httpError(404, 'category_not_found', 'That category does not exist.');
    await appendActivity(client, {
      action: 'checklist_category_deleted',
      entityType: 'checklist_category',
      entityId: id,
      sessionId: result.rows[0].scope_session,
      actorRole: 'admin',
      actorName: identity.name || 'Dr B',
      actorSub: identity.sub,
      summary: `Checklist category "${result.rows[0].title}" deleted with confirmation.`,
      studentVisible: false,
    });
    return { ok: true };
  });
}

async function adminCreateItem(identity, body) {
  requireAdmin(identity);
  const categoryId = requireUuid(body.categoryId, 'category id');
  const title = text(body.title, 200);
  if (!title) throw httpError(400, 'title_required', 'An item title is required.');
  const defaultOwner = OWNERS.has(text(body.defaultOwner, 20)) ? text(body.defaultOwner, 20) : 'student';
  return withServiceTransaction(async (client) => {
    const category = await client.query(
      'SELECT id, scope_session FROM public.hb_checklist_categories WHERE id = $1',
      [categoryId],
    );
    if (!category.rows[0]) throw httpError(404, 'category_not_found', 'That category does not exist.');
    const inserted = await client.query(
      `INSERT INTO public.hb_checklist_items
         (category_id, key, title, description, sort_order, required, default_owner, due_behavior, due_date)
       VALUES ($1, $2, $3, $4,
               COALESCE((SELECT max(sort_order) + 10 FROM public.hb_checklist_items WHERE category_id = $1), 10),
               $5, $6, $7, $8)
       RETURNING id`,
      [
        categoryId,
        slugify(body.key || title, `item-${Date.now()}`),
        title,
        text(body.description, 500),
        body.required !== false,
        defaultOwner,
        optionalDate(body.dueDate) ? 'fixed' : 'none',
        optionalDate(body.dueDate),
      ],
    );
    // hydrate default state for existing active enrollments in scope
    await client.query(
      `INSERT INTO public.hb_item_states (item_id, enrollment_id, status, owner)
       SELECT $1, e.id, 'not_started', $2
       FROM public.hb_enrollments e
       JOIN public.hb_checklist_categories c ON c.id = $3
       WHERE (c.scope_session IS NULL OR e.session_id = c.scope_session)
         AND e.status = 'active'
       ON CONFLICT (item_id, enrollment_id) DO NOTHING`,
      [inserted.rows[0].id, defaultOwner, categoryId],
    );
    await appendActivity(client, {
      action: 'checklist_item_added',
      entityType: 'checklist_item',
      entityId: inserted.rows[0].id,
      sessionId: category.rows[0].scope_session,
      actorRole: 'admin',
      actorName: identity.name || 'Dr B',
      actorSub: identity.sub,
      summary: `Checklist item "${title}" added.`,
      studentVisible: false,
    });
    return { id: inserted.rows[0].id };
  });
}

async function adminPatchItem(identity, itemId, body) {
  requireAdmin(identity);
  const id = requireUuid(itemId, 'item id');
  const updates = [];
  const values = [];
  if ('title' in body) { values.push(text(body.title, 200)); updates.push(`title = $${values.length}`); }
  if ('description' in body) { values.push(text(body.description, 500)); updates.push(`description = $${values.length}`); }
  if ('sortOrder' in body) { values.push(Number(body.sortOrder) || 100); updates.push(`sort_order = $${values.length}`); }
  if ('required' in body) { values.push(body.required === true); updates.push(`required = $${values.length}`); }
  if ('state' in body) {
    const value = text(body.state, 20);
    if (!CATEGORY_STATES.has(value)) throw httpError(400, 'invalid_state', 'Unknown item state.');
    values.push(value); updates.push(`state = $${values.length}`);
  }
  if ('defaultOwner' in body) {
    const value = text(body.defaultOwner, 20);
    if (!OWNERS.has(value)) throw httpError(400, 'invalid_owner', 'Unknown owner.');
    values.push(value); updates.push(`default_owner = $${values.length}`);
  }
  if ('dueDate' in body) {
    const value = optionalDate(body.dueDate);
    values.push(value); updates.push(`due_date = $${values.length}`);
    values.push(value ? 'fixed' : 'none'); updates.push(`due_behavior = $${values.length}`);
  }
  if (!updates.length) throw httpError(400, 'no_changes', 'No editable fields were provided.');
  return withServiceTransaction(async (client) => {
    values.push(id);
    const result = await client.query(
      `UPDATE public.hb_checklist_items SET ${updates.join(', ')}, updated_at = now()
       WHERE id = $${values.length} RETURNING title`,
      values,
    );
    if (!result.rows[0]) throw httpError(404, 'item_not_found', 'That checklist item does not exist.');
    await appendActivity(client, {
      action: 'checklist_item_updated',
      entityType: 'checklist_item',
      entityId: id,
      actorRole: 'admin',
      actorName: identity.name || 'Dr B',
      actorSub: identity.sub,
      summary: `Checklist item "${result.rows[0].title}" updated.`,
      studentVisible: false,
    });
    return { ok: true };
  });
}

async function adminDeleteItem(identity, itemId, body) {
  requireAdmin(identity);
  const id = requireUuid(itemId, 'item id');
  if (body.confirm !== true) {
    throw httpError(400, 'confirmation_required', 'Deleting an item requires confirm: true. Consider archiving instead.');
  }
  return withServiceTransaction(async (client) => {
    const result = await client.query(
      'DELETE FROM public.hb_checklist_items WHERE id = $1 RETURNING title',
      [id],
    );
    if (!result.rows[0]) throw httpError(404, 'item_not_found', 'That checklist item does not exist.');
    await appendActivity(client, {
      action: 'checklist_item_deleted',
      entityType: 'checklist_item',
      entityId: id,
      actorRole: 'admin',
      actorName: identity.name || 'Dr B',
      actorSub: identity.sub,
      summary: `Checklist item "${result.rows[0].title}" deleted with confirmation.`,
      studentVisible: false,
    });
    return { ok: true };
  });
}

const STATUS_LABELS = Object.freeze({
  not_started: 'Not Started',
  waiting_on_student: 'Waiting on Student',
  submitted: 'Submitted',
  in_review: 'In Review',
  waiting_on_drb: 'Waiting on Dr B',
  revision_needed: 'Revision Needed',
  approved: 'Approved',
  completed: 'Completed',
  not_applicable: 'Not Applicable',
});

async function adminSetItemState(identity, body) {
  requireAdmin(identity);
  const itemId = requireUuid(body.itemId, 'item id');
  const enrollmentId = requireUuid(body.enrollmentId, 'student id');
  const status = text(body.status, 30);
  if (!CHECKLIST_STATUSES.has(status)) throw httpError(400, 'invalid_status', 'Unknown checklist status.');
  const owner = OWNERS.has(text(body.owner, 20)) ? text(body.owner, 20) : null;
  const dueDate = 'dueDate' in body ? optionalDate(body.dueDate) : undefined;
  const note = 'note' in body ? text(body.note, 1000) : undefined;
  return withServiceTransaction(async (client) => {
    const item = await client.query(
      'SELECT i.title FROM public.hb_checklist_items i WHERE i.id = $1', [itemId],
    );
    if (!item.rows[0]) throw httpError(404, 'item_not_found', 'That checklist item does not exist.');
    const enrollment = await adminEnrollment(client, enrollmentId);
    const previous = await client.query(
      'SELECT status FROM public.hb_item_states WHERE item_id = $1 AND enrollment_id = $2',
      [itemId, enrollmentId],
    );
    await client.query(
      `INSERT INTO public.hb_item_states (item_id, enrollment_id, status, owner, due_date, note, updated_by)
       VALUES ($1, $2, $3, COALESCE($4, 'student'), $5, COALESCE($6, ''), $7)
       ON CONFLICT (item_id, enrollment_id) DO UPDATE SET
         status = EXCLUDED.status,
         owner = COALESCE($4, public.hb_item_states.owner),
         due_date = CASE WHEN $8 THEN $5 ELSE public.hb_item_states.due_date END,
         note = COALESCE($6, public.hb_item_states.note),
         updated_by = $7,
         updated_at = now()`,
      [itemId, enrollmentId, status, owner, dueDate ?? null, note ?? null, identity.sub, dueDate !== undefined],
    );
    await client.query(
      'UPDATE public.hb_enrollments SET last_activity_at = now(), updated_at = now() WHERE id = $1',
      [enrollmentId],
    );
    const fromLabel = STATUS_LABELS[previous.rows[0]?.status] || 'Not Started';
    await appendActivity(client, {
      action: 'checklist_status_changed',
      entityType: 'checklist_item',
      entityId: itemId,
      sessionId: enrollment.session_id,
      enrollmentId,
      actorRole: 'admin',
      actorName: identity.name || 'Dr B',
      actorSub: identity.sub,
      summary: `${item.rows[0].title}: ${fromLabel} → ${STATUS_LABELS[status]}.`,
      studentVisible: true,
      previousValue: { status: previous.rows[0]?.status || 'not_started' },
      newValue: { status, owner, dueDate, note },
    });
    return { ok: true };
  });
}

async function adminTasks(identity) {
  requireAdmin(identity);
  return withServiceTransaction(async (client) => {
    const tasks = await client.query(
      `SELECT t.*,
        (SELECT count(*) FROM public.hb_task_assignments a WHERE a.task_id = t.id) AS assigned_count,
        (SELECT count(*) FROM public.hb_task_assignments a WHERE a.task_id = t.id AND a.status IN ('completed','approved')) AS done_count
       FROM public.hb_tasks t
       ORDER BY (t.due_date IS NULL), t.due_date, t.created_at DESC`,
    );
    const assignments = await client.query(
      `SELECT a.*, e.first_name, e.last_name
       FROM public.hb_task_assignments a
       JOIN public.hb_enrollments e ON e.id = a.enrollment_id
       ORDER BY a.updated_at DESC`,
    );
    return {
      tasks: tasks.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        audience: row.audience,
        assignedBy: row.assigned_by_name,
        assignedOn: row.assigned_on,
        dueDate: row.due_date,
        priority: row.priority,
        status: row.status,
        requiredUpload: row.required_upload,
        assignedCount: Number(row.assigned_count),
        doneCount: Number(row.done_count),
        assignments: assignments.rows
          .filter((assignment) => assignment.task_id === row.id)
          .map((assignment) => ({
            id: assignment.id,
            enrollmentId: assignment.enrollment_id,
            studentName: `${assignment.first_name} ${assignment.last_name}`,
            status: assignment.status,
            studentComment: assignment.student_comment,
            adminComment: assignment.admin_comment,
            submittedAt: assignment.submitted_at,
            updatedAt: assignment.updated_at,
          })),
      })),
    };
  });
}

async function adminCreateTask(identity, body) {
  requireAdmin(identity);
  const title = text(body.title, 200);
  if (!title) throw httpError(400, 'title_required', 'A task title is required.');
  const audience = ['session', 'subset', 'individual'].includes(text(body.audience, 20))
    ? text(body.audience, 20)
    : 'session';
  const priority = ['low', 'normal', 'high', 'urgent'].includes(text(body.priority, 20))
    ? text(body.priority, 20)
    : 'normal';
  const enrollmentIds = Array.isArray(body.enrollmentIds)
    ? body.enrollmentIds.map((value) => requireUuid(value, 'student id'))
    : [];
  if (audience !== 'session' && !enrollmentIds.length) {
    throw httpError(400, 'students_required', 'Choose at least one student for a subset/individual task.');
  }
  return withServiceTransaction(async (client) => {
    const session = await client.query("SELECT id FROM public.hb_sessions WHERE key = '360-session-a'");
    if (!session.rows[0]) throw httpError(500, 'session_missing', 'Session A is not seeded.');
    const inserted = await client.query(
      `INSERT INTO public.hb_tasks
         (session_id, audience, title, description, assigned_by_name, assigned_by, due_date, priority, required_upload, link_item)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        session.rows[0].id, audience, title, text(body.description, 4000),
        identity.name || 'Dr B', identity.sub, optionalDate(body.dueDate), priority,
        body.requiredUpload === true,
        body.linkItem ? requireUuid(body.linkItem, 'checklist item id') : null,
      ],
    );
    const taskId = inserted.rows[0].id;
    if (audience === 'session') {
      await client.query(
        `INSERT INTO public.hb_task_assignments (task_id, enrollment_id)
         SELECT $1, e.id FROM public.hb_enrollments e
         WHERE e.session_id = $2 AND e.status = 'active'
         ON CONFLICT DO NOTHING`,
        [taskId, session.rows[0].id],
      );
    } else {
      for (const enrollmentId of enrollmentIds) {
        await client.query(
          `INSERT INTO public.hb_task_assignments (task_id, enrollment_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [taskId, enrollmentId],
        );
      }
    }
    const assigned = await client.query(
      'SELECT enrollment_id FROM public.hb_task_assignments WHERE task_id = $1',
      [taskId],
    );
    for (const row of assigned.rows) {
      await appendActivity(client, {
        action: 'task_assigned',
        entityType: 'task',
        entityId: taskId,
        sessionId: session.rows[0].id,
        enrollmentId: row.enrollment_id,
        actorRole: 'admin',
        actorName: identity.name || 'Dr B',
        actorSub: identity.sub,
        summary: `New assignment: ${title}${optionalDate(body.dueDate) ? ` — due ${optionalDate(body.dueDate)}` : ''}.`,
        studentVisible: true,
      });
    }
    return { id: taskId, assignedCount: assigned.rows.length };
  });
}

async function adminSetAssignmentStatus(identity, assignmentId, body) {
  requireAdmin(identity);
  const id = requireUuid(assignmentId, 'assignment id');
  const status = text(body.status, 30);
  if (!TASK_ASSIGNMENT_STATUSES.has(status)) throw httpError(400, 'invalid_status', 'Unknown assignment status.');
  return withServiceTransaction(async (client) => {
    const result = await client.query(
      `UPDATE public.hb_task_assignments
       SET status = $1,
           admin_comment = CASE WHEN $2::text IS NULL THEN admin_comment ELSE $2 END,
           completed_at = CASE WHEN $1 IN ('completed', 'approved') THEN now() ELSE completed_at END,
           updated_at = now()
       WHERE id = $3
       RETURNING task_id, enrollment_id`,
      [status, 'adminComment' in body ? text(body.adminComment, 2000) : null, id],
    );
    if (!result.rows[0]) throw httpError(404, 'assignment_not_found', 'That assignment does not exist.');
    const task = await client.query('SELECT title, session_id FROM public.hb_tasks WHERE id = $1', [result.rows[0].task_id]);
    await appendActivity(client, {
      action: 'task_status_changed',
      entityType: 'task',
      entityId: result.rows[0].task_id,
      sessionId: task.rows[0]?.session_id,
      enrollmentId: result.rows[0].enrollment_id,
      actorRole: 'admin',
      actorName: identity.name || 'Dr B',
      actorSub: identity.sub,
      summary: `${task.rows[0]?.title || 'Assignment'}: marked ${status.replace(/_/g, ' ')} by Dr B.`,
      studentVisible: true,
    });
    return { ok: true };
  });
}

async function adminAlerts(identity) {
  requireAdmin(identity);
  return withServiceTransaction(async (client) => {
    const result = await client.query(
      'SELECT * FROM public.hb_alerts WHERE state <> \'archived\' ORDER BY kind, sort_order, created_at DESC',
    );
    return { alerts: result.rows.map(alertView) };
  });
}

async function adminCreateAlert(identity, body) {
  requireAdmin(identity);
  const title = text(body.title, 200);
  if (!title) throw httpError(400, 'title_required', 'A title is required.');
  const kind = ALERT_KINDS.has(text(body.kind, 20)) ? text(body.kind, 20) : 'alert';
  const urgency = URGENCIES.has(text(body.urgency, 20)) ? text(body.urgency, 20) : 'notice';
  const scopeEnrollment = body.enrollmentId ? requireUuid(body.enrollmentId, 'student id') : null;
  return withServiceTransaction(async (client) => {
    const session = await client.query("SELECT id FROM public.hb_sessions WHERE key = '360-session-a'");
    const inserted = await client.query(
      `INSERT INTO public.hb_alerts
         (kind, scope_type, scope_session, scope_enrollment, title, body, urgency,
          expires_at, dismissible, cta_label, cta_url, created_by,
          sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
               COALESCE((SELECT max(sort_order) + 10 FROM public.hb_alerts), 10))
       RETURNING id`,
      [
        kind,
        scopeEnrollment ? 'student' : 'session',
        scopeEnrollment ? null : session.rows[0]?.id,
        scopeEnrollment,
        title,
        text(body.body, 2000),
        urgency,
        body.expiresAt ? new Date(body.expiresAt).toISOString() : null,
        body.dismissible !== false,
        text(body.ctaLabel, 60),
        text(body.ctaUrl, 500),
        identity.sub,
      ],
    );
    await appendActivity(client, {
      action: kind === 'priority' ? 'priority_posted' : 'alert_posted',
      entityType: 'alert',
      entityId: inserted.rows[0].id,
      sessionId: session.rows[0]?.id,
      enrollmentId: scopeEnrollment,
      actorRole: 'admin',
      actorName: identity.name || 'Dr B',
      actorSub: identity.sub,
      summary: kind === 'priority' ? `New weekly priority: ${title}.` : `New alert: ${title}.`,
      studentVisible: true,
    });
    return { id: inserted.rows[0].id };
  });
}

async function adminPatchAlert(identity, alertId, body) {
  requireAdmin(identity);
  const id = requireUuid(alertId, 'alert id');
  const updates = [];
  const values = [];
  if ('title' in body) { values.push(text(body.title, 200)); updates.push(`title = $${values.length}`); }
  if ('body' in body) { values.push(text(body.body, 2000)); updates.push(`body = $${values.length}`); }
  if ('urgency' in body) {
    const value = text(body.urgency, 20);
    if (!URGENCIES.has(value)) throw httpError(400, 'invalid_urgency', 'Unknown urgency.');
    values.push(value); updates.push(`urgency = $${values.length}`);
  }
  if ('state' in body) {
    const value = text(body.state, 20);
    if (!CATEGORY_STATES.has(value)) throw httpError(400, 'invalid_state', 'Unknown alert state.');
    values.push(value); updates.push(`state = $${values.length}`);
  }
  if ('sortOrder' in body) { values.push(Number(body.sortOrder) || 100); updates.push(`sort_order = $${values.length}`); }
  if ('expiresAt' in body) {
    values.push(body.expiresAt ? new Date(body.expiresAt).toISOString() : null);
    updates.push(`expires_at = $${values.length}`);
  }
  if (!updates.length) throw httpError(400, 'no_changes', 'No editable fields were provided.');
  return withServiceTransaction(async (client) => {
    values.push(id);
    const result = await client.query(
      `UPDATE public.hb_alerts SET ${updates.join(', ')}, updated_at = now()
       WHERE id = $${values.length} RETURNING id`,
      values,
    );
    if (!result.rows[0]) throw httpError(404, 'alert_not_found', 'That alert does not exist.');
    return { ok: true };
  });
}

async function adminActivity(identity, url) {
  requireAdmin(identity);
  const enrollmentId = url.searchParams.get('studentId');
  return withServiceTransaction(async (client) => {
    const result = enrollmentId
      ? await client.query(
        'SELECT * FROM public.hb_activity WHERE enrollment_id = $1 ORDER BY created_at DESC LIMIT 100',
        [requireUuid(enrollmentId, 'student id')],
      )
      : await client.query('SELECT * FROM public.hb_activity ORDER BY created_at DESC LIMIT 100');
    return { activity: result.rows.map(activityView) };
  });
}

async function adminStudentDetail(identity, enrollmentId) {
  requireAdmin(identity);
  const id = requireUuid(enrollmentId, 'student id');
  return withServiceTransaction(async (client) => {
    const row = await adminEnrollment(client, id);
    const [progress, tasks, activity, files] = await Promise.all([
      progressPayload(client, row.id, row.session_id, { admin: true }),
      tasksPayload(client, row.id),
      activityPayload(client, row.id, { studentSafe: false, limit: 50 }),
      filesPayload(client, row.id, { admin: true }),
    ]);
    return {
      student: enrollmentView(row, { admin: true }),
      psStages: PS_STAGES,
      progress,
      tasks,
      activity,
      files,
    };
  });
}

async function adminSubjectHome(identity, enrollmentId) {
  requireAdmin(identity);
  const id = requireUuid(enrollmentId, 'student id');
  const row = await withServiceTransaction((client) => adminEnrollment(client, id));
  const payload = await studentHomePayload(row);
  return { ...payload, subject: enrollmentView(row, { admin: true }) };
}

async function adminAddFile(identity, body) {
  requireAdmin(identity);
  const enrollmentId = requireUuid(body.enrollmentId, 'student id');
  const title = text(body.title, 200);
  if (!title) throw httpError(400, 'title_required', 'A file title is required.');
  const kind = ['document', 'ps_draft', 'timeline', 'headshot', 'resource', 'other'].includes(text(body.kind, 20))
    ? text(body.kind, 20)
    : 'document';
  return withServiceTransaction(async (client) => {
    const enrollment = await adminEnrollment(client, enrollmentId);
    const inserted = await client.query(
      `INSERT INTO public.hb_files
         (enrollment_id, session_id, vault_document_uuid, title, kind, external_url, link_item, link_task, student_visible, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        enrollmentId,
        enrollment.session_id,
        text(body.vaultDocumentUuid, 64),
        title,
        kind,
        text(body.externalUrl, 500),
        body.linkItem ? requireUuid(body.linkItem, 'checklist item id') : null,
        body.linkTask ? requireUuid(body.linkTask, 'task id') : null,
        body.studentVisible !== false,
        identity.sub,
      ],
    );
    await appendActivity(client, {
      action: 'file_linked',
      entityType: 'file',
      entityId: inserted.rows[0].id,
      sessionId: enrollment.session_id,
      enrollmentId,
      actorRole: 'admin',
      actorName: identity.name || 'Dr B',
      actorSub: identity.sub,
      summary: `Dr B added a file: ${title}.`,
      studentVisible: body.studentVisible !== false,
    });
    return { id: inserted.rows[0].id };
  });
}

// ---------------------------------------------------------------------------
// Student operations
// ---------------------------------------------------------------------------

async function studentSubmitTask(identity, assignmentId, body, enrollmentRow) {
  const id = requireUuid(assignmentId, 'assignment id');
  return withServiceTransaction(async (client) => {
    const result = await client.query(
      `UPDATE public.hb_task_assignments
       SET status = 'submitted',
           student_comment = CASE WHEN $1::text IS NULL THEN student_comment ELSE $1 END,
           submitted_at = now(), updated_at = now()
       WHERE id = $2 AND enrollment_id = $3 AND status IN ('assigned', 'revision_needed', 'reopened')
       RETURNING task_id`,
      ['comment' in body ? text(body.comment, 2000) : null, id, enrollmentRow.id],
    );
    if (!result.rows[0]) throw httpError(404, 'assignment_not_found', 'That assignment is not open for submission.');
    const task = await client.query('SELECT title, session_id FROM public.hb_tasks WHERE id = $1', [result.rows[0].task_id]);
    await client.query(
      'UPDATE public.hb_enrollments SET last_activity_at = now(), updated_at = now() WHERE id = $1',
      [enrollmentRow.id],
    );
    await appendActivity(client, {
      action: 'task_submitted',
      entityType: 'task',
      entityId: result.rows[0].task_id,
      sessionId: task.rows[0]?.session_id,
      enrollmentId: enrollmentRow.id,
      actorRole: 'student',
      actorName: `${enrollmentRow.first_name} ${enrollmentRow.last_name}`,
      actorSub: identity.sub,
      summary: `${enrollmentRow.first_name} submitted: ${task.rows[0]?.title || 'assignment'}.`,
      studentVisible: true,
    });
    return { ok: true };
  });
}

async function studentCommentTask(identity, assignmentId, body, enrollmentRow) {
  const id = requireUuid(assignmentId, 'assignment id');
  const comment = text(body.comment, 2000);
  if (!comment) throw httpError(400, 'comment_required', 'A comment is required.');
  return withServiceTransaction(async (client) => {
    const result = await client.query(
      `UPDATE public.hb_task_assignments
       SET student_comment = $1, updated_at = now()
       WHERE id = $2 AND enrollment_id = $3
       RETURNING task_id`,
      [comment, id, enrollmentRow.id],
    );
    if (!result.rows[0]) throw httpError(404, 'assignment_not_found', 'That assignment does not exist.');
    return { ok: true };
  });
}

async function studentDismissAlert(identity, alertId, enrollmentRow) {
  const id = requireUuid(alertId, 'alert id');
  return withServiceTransaction(async (client) => {
    const alert = await client.query(
      'SELECT dismissible FROM public.hb_alerts WHERE id = $1', [id],
    );
    if (!alert.rows[0]) throw httpError(404, 'alert_not_found', 'That alert does not exist.');
    if (!alert.rows[0].dismissible) throw httpError(400, 'not_dismissible', 'This alert cannot be dismissed.');
    await client.query(
      `INSERT INTO public.hb_alert_dismissals (alert_id, enrollment_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, enrollmentRow.id],
    );
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Static serving (development / hosted-beta convenience; production uses the
// WordPress route adapter with immutable release assets)
// ---------------------------------------------------------------------------
async function serveStatic(response, url) {
  const clean = url.pathname.replace(/^\/+/, '').replace(/\.\./g, '');
  const target = clean === '' ? 'index.html' : clean;
  const candidates = [
    path.join(config.publicDir, target),
    path.join(config.publicDir, 'index.html'),
  ];
  for (const candidate of candidates) {
    if (!candidate.startsWith(config.publicDir)) continue;
    try {
      const data = await readFile(candidate);
      response.writeHead(200, {
        'Content-Type': mimeTypes.get(path.extname(candidate)) || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(data);
      return;
    } catch {
      // try next candidate
    }
  }
  sendJson(response, 404, { error: { code: 'not_found', message: 'Not found.' } });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export function createAppServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      if (!applyCors(request, response)) {
        sendJson(response, 403, { error: { code: 'origin_not_allowed', message: 'Origin not allowed.' } });
        return;
      }
      if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
      }
      if (request.method === 'GET' && url.pathname === '/healthz') {
        const database = await healthCheck().catch(() => null);
        sendJson(response, database ? 200 : 503, {
          ok: Boolean(database),
          service: 'homebase-v1',
          database: database ? database.database : null,
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/config') {
        sendJson(response, 200, {
          basePath: config.basePath,
          matrixBaseUrl: config.matrixBaseUrl,
          wpBootstrapPath: config.wpBootstrapPath,
          wpTokenPath: config.wpTokenPath,
          tokenRefreshSkewSeconds: config.tokenRefreshSkewSeconds,
          devAuth: config.devAuth,
          premiumMotion: config.premiumMotion,
          betaBadge: config.betaBadge,
        });
        return;
      }
      const devSession = config.devAuth && request.method === 'POST'
        && url.pathname.match(/^\/api\/dev\/session\/([a-zA-Z]+)$/);
      if (devSession) {
        const token = await issueDevToken(devSession[1], request, { expiration: '12h' });
        sendJson(response, 200, { token, personas: Object.keys(fixtureIdentities) });
        return;
      }

      if (!url.pathname.startsWith('/api/')) {
        if (config.originApiOnly) {
          sendJson(response, 404, { error: { code: 'not_found', message: 'Not found.' } });
          return;
        }
        await serveStatic(response, url);
        return;
      }

      const identity = await authorize(request);
      const isAdmin = identity.wordpressAdmin === true;

      // ---- session ----
      if (request.method === 'GET' && url.pathname === '/api/session') {
        let enrollment = null;
        if (!isAdmin) enrollment = await requireStudentEnrollment(identity);
        else enrollment = await resolveEnrollment(identity);
        sendJson(response, 200, {
          user: {
            id: identity.sub,
            display_name: identity.name,
            first_name: identity.firstName,
            role: isAdmin ? 'admin' : 'student',
            cohort: identity.cohort,
            avatar_thumbnail_url: identity.avatarThumbnailUrl,
            avatar_url: identity.avatarUrl,
          },
          capabilities: {
            adminConsole: isAdmin,
            rosterAdmin: isAdmin,
            checklistAdmin: isAdmin,
            taskAdmin: isAdmin,
            alertAdmin: isAdmin,
          },
          enrollment: enrollment ? enrollmentView(enrollment, { admin: isAdmin }) : null,
          betaBadge: config.betaBadge,
        });
        return;
      }

      // ---- student surface ----
      if (request.method === 'GET' && url.pathname === '/api/home') {
        const enrollment = await requireStudentEnrollment(identity);
        sendJson(response, 200, await studentHomePayload(enrollment));
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/progress') {
        const enrollment = await requireStudentEnrollment(identity);
        const payload = await withServiceTransaction(async (client) => ({
          enrollment: enrollmentView(enrollment),
          psStages: PS_STAGES,
          progress: await progressPayload(client, enrollment.id, enrollment.session_id),
        }));
        sendJson(response, 200, payload);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/tasks') {
        const enrollment = await requireStudentEnrollment(identity);
        const tasks = await withServiceTransaction((client) => tasksPayload(client, enrollment.id));
        sendJson(response, 200, { tasks });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/alerts') {
        const enrollment = await requireStudentEnrollment(identity);
        const payload = await withServiceTransaction(
          (client) => alertsPayload(client, enrollment.id, enrollment.session_id),
        );
        sendJson(response, 200, payload);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/activity') {
        const enrollment = await requireStudentEnrollment(identity);
        const activity = await withServiceTransaction(
          (client) => activityPayload(client, enrollment.id, { studentSafe: true, limit: 50 }),
        );
        sendJson(response, 200, { activity });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/files') {
        const enrollment = await requireStudentEnrollment(identity);
        const files = await withServiceTransaction((client) => filesPayload(client, enrollment.id));
        sendJson(response, 200, { files });
        return;
      }
      const submitMatch = url.pathname.match(/^\/api\/tasks\/([a-f0-9-]{36})\/submit$/i);
      if (request.method === 'POST' && submitMatch) {
        const enrollment = await requireStudentEnrollment(identity);
        sendJson(response, 200, await studentSubmitTask(identity, submitMatch[1], await readJson(request), enrollment));
        return;
      }
      const commentMatch = url.pathname.match(/^\/api\/tasks\/([a-f0-9-]{36})\/comment$/i);
      if (request.method === 'POST' && commentMatch) {
        const enrollment = await requireStudentEnrollment(identity);
        sendJson(response, 200, await studentCommentTask(identity, commentMatch[1], await readJson(request), enrollment));
        return;
      }
      const dismissMatch = url.pathname.match(/^\/api\/alerts\/([a-f0-9-]{36})\/dismiss$/i);
      if (request.method === 'POST' && dismissMatch) {
        const enrollment = await requireStudentEnrollment(identity);
        sendJson(response, 200, await studentDismissAlert(identity, dismissMatch[1], enrollment));
        return;
      }

      // ---- admin surface ----
      if (url.pathname.startsWith('/api/admin/')) {
        if (request.method === 'GET' && url.pathname === '/api/admin/home') {
          sendJson(response, 200, await adminHome(identity));
          return;
        }
        if (request.method === 'GET' && url.pathname === '/api/admin/roster') {
          sendJson(response, 200, await adminRoster(identity, url));
          return;
        }
        if (request.method === 'POST' && url.pathname === '/api/admin/roster') {
          sendJson(response, 200, await adminAddStudent(identity, await readJson(request)));
          return;
        }
        const studentMatch = url.pathname.match(/^\/api\/admin\/students\/([a-f0-9-]{36})$/i);
        if (request.method === 'GET' && studentMatch) {
          sendJson(response, 200, await adminStudentDetail(identity, studentMatch[1]));
          return;
        }
        if (request.method === 'PATCH' && studentMatch) {
          sendJson(response, 200, await adminPatchStudent(identity, studentMatch[1], await readJson(request)));
          return;
        }
        const subjectMatch = url.pathname.match(/^\/api\/admin\/subjects\/([a-f0-9-]{36})\/home$/i);
        if (request.method === 'GET' && subjectMatch) {
          sendJson(response, 200, await adminSubjectHome(identity, subjectMatch[1]));
          return;
        }
        if (request.method === 'GET' && url.pathname === '/api/admin/checklist') {
          sendJson(response, 200, await adminChecklist(identity));
          return;
        }
        if (request.method === 'POST' && url.pathname === '/api/admin/checklist/categories') {
          sendJson(response, 200, await adminCreateCategory(identity, await readJson(request)));
          return;
        }
        const categoryMatch = url.pathname.match(/^\/api\/admin\/checklist\/categories\/([a-f0-9-]{36})$/i);
        if (request.method === 'PATCH' && categoryMatch) {
          sendJson(response, 200, await adminPatchCategory(identity, categoryMatch[1], await readJson(request)));
          return;
        }
        if (request.method === 'DELETE' && categoryMatch) {
          sendJson(response, 200, await adminDeleteCategory(identity, categoryMatch[1], await readJson(request)));
          return;
        }
        if (request.method === 'POST' && url.pathname === '/api/admin/checklist/items') {
          sendJson(response, 200, await adminCreateItem(identity, await readJson(request)));
          return;
        }
        const itemMatch = url.pathname.match(/^\/api\/admin\/checklist\/items\/([a-f0-9-]{36})$/i);
        if (request.method === 'PATCH' && itemMatch) {
          sendJson(response, 200, await adminPatchItem(identity, itemMatch[1], await readJson(request)));
          return;
        }
        if (request.method === 'DELETE' && itemMatch) {
          sendJson(response, 200, await adminDeleteItem(identity, itemMatch[1], await readJson(request)));
          return;
        }
        if (request.method === 'POST' && url.pathname === '/api/admin/item-states') {
          sendJson(response, 200, await adminSetItemState(identity, await readJson(request)));
          return;
        }
        if (request.method === 'GET' && url.pathname === '/api/admin/tasks') {
          sendJson(response, 200, await adminTasks(identity));
          return;
        }
        if (request.method === 'POST' && url.pathname === '/api/admin/tasks') {
          sendJson(response, 200, await adminCreateTask(identity, await readJson(request)));
          return;
        }
        const assignmentMatch = url.pathname.match(/^\/api\/admin\/task-assignments\/([a-f0-9-]{36})\/status$/i);
        if (request.method === 'POST' && assignmentMatch) {
          sendJson(response, 200, await adminSetAssignmentStatus(identity, assignmentMatch[1], await readJson(request)));
          return;
        }
        if (request.method === 'GET' && url.pathname === '/api/admin/alerts') {
          sendJson(response, 200, await adminAlerts(identity));
          return;
        }
        if (request.method === 'POST' && url.pathname === '/api/admin/alerts') {
          sendJson(response, 200, await adminCreateAlert(identity, await readJson(request)));
          return;
        }
        const alertMatch = url.pathname.match(/^\/api\/admin\/alerts\/([a-f0-9-]{36})$/i);
        if (request.method === 'PATCH' && alertMatch) {
          sendJson(response, 200, await adminPatchAlert(identity, alertMatch[1], await readJson(request)));
          return;
        }
        if (request.method === 'GET' && url.pathname === '/api/admin/activity') {
          sendJson(response, 200, await adminActivity(identity, url));
          return;
        }
        if (request.method === 'POST' && url.pathname === '/api/admin/files') {
          sendJson(response, 200, await adminAddFile(identity, await readJson(request)));
          return;
        }
      }

      sendJson(response, 404, { error: { code: 'not_found', message: 'Unknown HomeBase API route.' } });
    } catch (error) {
      sendError(response, error);
    }
  });
}

const isMainModule = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isMainModule) {
  const errors = validateConfig();
  if (errors.length) {
    process.stderr.write(`${JSON.stringify({ event: 'config_invalid', errors })}\n`);
    process.exit(1);
  }
  const server = createAppServer();
  server.listen(config.port, config.host, () => {
    process.stdout.write(`${JSON.stringify({
      event: 'homebase_listening',
      host: config.host,
      port: config.port,
      basePath: config.basePath,
      devAuth: config.devAuth,
    })}\n`);
  });
  const shutdown = async () => {
    server.close(() => {});
    await closePool().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
