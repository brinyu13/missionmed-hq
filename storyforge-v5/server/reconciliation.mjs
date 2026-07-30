import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

export const LEASE_DURATION_MS = 30 * 60 * 1000;
export const LEASE_RENEWAL_MS = 5 * 60 * 1000;
export const PAGE_SIZE = 1000;
export const MAX_PAGES_PER_RUN = 5;
export const MAX_DELETES_PER_RUN = 200;
export const INTENT_MAX_ATTEMPTS = 3;
export const ELIGIBLE_AGE_DAYS = 7;
export const STORYFORGE_PREFIXES = Object.freeze([
  'storyforge-audio/',
  'storyforge-rec/',
]);

const eligibleAgeMs = ELIGIBLE_AGE_DAYS * 24 * 60 * 60 * 1000;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function exactUuid(value) {
  const text = String(value || '');
  return uuidPattern.test(text) ? text : null;
}

export function parseReconciliationKey(keyValue) {
  const key = String(keyValue || '');
  const parts = key.split('/');
  const prefix = STORYFORGE_PREFIXES.find((candidate) => key.startsWith(candidate));
  if (!prefix) return Object.freeze({ inScope: false, key });
  if (parts.length < 4) {
    return Object.freeze({
      inScope: true,
      key,
      kind: parts[0],
      studentRef: null,
      storyRef: null,
      refState: 'invalid_key',
    });
  }
  const studentRef = exactUuid(parts[1]);
  const storyRef = parts[0] === 'storyforge-audio' ? exactUuid(parts[2]) : null;
  if (!studentRef || (parts[0] === 'storyforge-audio' && !storyRef)) {
    return Object.freeze({
      inScope: true,
      key,
      kind: parts[0],
      studentRef: null,
      storyRef: null,
      refState: 'invalid_key',
    });
  }
  return Object.freeze({
    inScope: true,
    key,
    kind: parts[0],
    studentRef,
    storyRef,
    refState: null,
  });
}

export function reconciliationCursorDigest(cursorKey) {
  const value = String(cursorKey || '');
  return value ? createHash('sha256').update(value).digest('hex') : '';
}

function reconciliationMode(config) {
  const value = String(
    config?.mode
      ?? config?.audioReconciliation
      ?? config?.environment?.STORYFORGE_AUDIO_RECONCILIATION
      ?? 'off',
  ).trim().toLowerCase();
  return value === 'dry_run' || value === 'on' ? value : 'off';
}

function suspensionReason(config) {
  return String(
    config?.suspended
      ?? config?.audioReconciliationSuspended
      ?? config?.environment?.STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED
      ?? '',
  ).trim();
}

function r2Bucket(config) {
  return String(config?.bucket ?? config?.r2?.bucket ?? '').trim();
}

function loggerMethod(logger) {
  if (typeof logger === 'function') return logger;
  if (typeof logger?.info === 'function') return (event) => logger.info(event);
  return () => {};
}

function noSuchKey(error) {
  return (
    error?.name === 'NoSuchKey'
    || error?.Code === 'NoSuchKey'
    || error?.code === 'NoSuchKey'
    || error?.$metadata?.httpStatusCode === 404
    || error?.status === 404
  );
}

function categoryFor(refState) {
  if (refState === 'deleted') return 'orphan_deleted_ref';
  if (refState === 'never_existed') return 'orphan_never_existed';
  return 'orphan_invalid_key';
}

function emptyCounters() {
  return {
    pagesListed: 0,
    keysEvaluated: 0,
    candidates: 0,
    preserved: 0,
    deletedConfirmed: 0,
    objectAbsent: 0,
    retried: 0,
    failed: 0,
  };
}

function counterColumns(counters) {
  return [
    counters.pagesListed,
    counters.keysEvaluated,
    counters.candidates,
    counters.preserved,
    counters.deletedConfirmed,
    counters.objectAbsent,
    counters.retried,
    counters.failed,
  ];
}

export function createReconciliationService({
  pool,
  r2Client,
  config = {},
  logger = console,
}) {
  if (!pool || (typeof pool.connect !== 'function' && typeof pool.query !== 'function')) {
    throw new TypeError('A PostgreSQL pool must be supplied.');
  }
  const emit = loggerMethod(logger);
  const replicaId = randomUUID();
  const bucket = r2Bucket(config);

  async function transaction(operation) {
    if (typeof pool.connect !== 'function') return operation(pool);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE storyforge_app');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function appendAudit(client, {
    action,
    entityType,
    entityId,
    next = null,
  }) {
    await client.query(
      `SELECT public.sf_append_voice_audit_service(
         $1, $2, $3, NULL, NULL, NULL, $4::jsonb
       )`,
      [action, entityType, entityId, next == null ? null : JSON.stringify(next)],
    );
  }

  async function acquireLease() {
    return transaction(async (client) => {
      const result = await client.query(
        `UPDATE public.sf_reconciliation_state
            SET lease_owner = $1,
                lease_expires_at = now() + interval '30 minutes',
                updated_at = now()
          WHERE id = 1
            AND (lease_owner IS NULL OR lease_expires_at < now())
          RETURNING *`,
        [replicaId],
      );
      return result.rows[0] || null;
    });
  }

  async function renewLease() {
    return transaction(async (client) => {
      const result = await client.query(
        `UPDATE public.sf_reconciliation_state
            SET lease_expires_at = now() + interval '30 minutes',
                updated_at = now()
          WHERE id = 1
            AND lease_owner = $1
          RETURNING *`,
        [replicaId],
      );
      return result.rows[0] || null;
    });
  }

  async function releaseLease() {
    return transaction((client) => client.query(
      `UPDATE public.sf_reconciliation_state
          SET lease_owner = NULL,
              lease_expires_at = NULL,
              updated_at = now()
        WHERE id = 1
          AND lease_owner = $1`,
      [replicaId],
    ));
  }

  async function createRun(mode, cursorKey) {
    return transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO public.sf_reconciliation_runs (
           mode, replica_id, cursor_digest_start, cursor_digest_end
         )
         VALUES ($1, $2, $3, $3)
         RETURNING *`,
        [mode, replicaId, reconciliationCursorDigest(cursorKey)],
      );
      const run = result.rows[0];
      await appendAudit(client, {
        action: 'reconciliation_run_started',
        entityType: 'reconciliation_run',
        entityId: run.id,
        next: {
          mode,
          replicaId,
          cursorDigest: reconciliationCursorDigest(cursorKey),
        },
      });
      return run;
    });
  }

  async function readAttribution(parsed) {
    if (parsed.refState === 'invalid_key') return parsed;
    return transaction(async (client) => {
      const student = await client.query(
        'SELECT eligible FROM public.sf_users WHERE id = $1',
        [parsed.studentRef],
      );
      if (!student.rows[0]) {
        return Object.freeze({ ...parsed, refState: 'never_existed' });
      }
      if (student.rows[0].eligible !== true) {
        return Object.freeze({ ...parsed, refState: 'deleted' });
      }
      if (parsed.kind === 'storyforge-audio') {
        const story = await client.query(
          'SELECT archived_at FROM public.sf_stories WHERE id = $1 AND student_id = $2',
          [parsed.storyRef, parsed.studentRef],
        );
        if (!story.rows[0]) {
          return Object.freeze({ ...parsed, refState: 'never_existed' });
        }
        if (story.rows[0].archived_at) {
          return Object.freeze({ ...parsed, refState: 'deleted' });
        }
      }
      return Object.freeze({ ...parsed, refState: 'live' });
    });
  }

  async function isReferenced(objectKey) {
    return transaction(async (client) => {
      const result = await client.query(
        'SELECT * FROM public.sf_voice_audio_reference_check($1::text[])',
        [[objectKey]],
      );
      return result.rows.some((row) => (
        row.object_key === objectKey && row.referenced === true
      ));
    });
  }

  async function databaseNow() {
    return transaction(async (client) => {
      const result = await client.query('SELECT now() AS database_now');
      return new Date(result.rows[0]?.database_now);
    });
  }

  async function headObject(objectKey) {
    try {
      return await r2Client.send(new HeadObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      }));
    } catch (error) {
      if (noSuchKey(error)) return null;
      throw error;
    }
  }

  async function listPage(cursorKey) {
    const result = await r2Client.send(new ListObjectsV2Command({
      Bucket: bucket,
      StartAfter: cursorKey || undefined,
      MaxKeys: PAGE_SIZE,
    }));
    return {
      objects: (result.Contents || [])
        .filter((entry) => entry?.Key)
        .map((entry) => ({
          objectKey: String(entry.Key),
          lastModified: entry.LastModified || null,
        })),
      truncated: Boolean(result.IsTruncated),
    };
  }

  async function guardLease(client) {
    const guard = await client.query(
      `SELECT id
         FROM public.sf_reconciliation_state
        WHERE id = 1
          AND lease_owner = $1
          AND lease_expires_at > now()
        FOR UPDATE`,
      [replicaId],
    );
    if (!guard.rows[0]) {
      const error = new Error('The reconciliation lease was lost.');
      error.code = 'reconciliation_lease_lost';
      throw error;
    }
  }

  async function createIntent(runId, attribution) {
    return transaction(async (client) => {
      await guardLease(client);
      const result = await client.query(
        `INSERT INTO public.sf_audio_deletion_intents (
           run_id, object_key, category, student_ref, story_ref, ref_state, state
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'intended')
         ON CONFLICT (object_key) WHERE state = 'intended'
         DO NOTHING
         RETURNING *`,
        [
          runId,
          attribution.key,
          categoryFor(attribution.refState),
          attribution.studentRef,
          attribution.storyRef,
          attribution.refState,
        ],
      );
      if (result.rows[0]) return result.rows[0];
      const existing = await client.query(
        `SELECT *
           FROM public.sf_audio_deletion_intents
          WHERE object_key = $1
            AND state = 'intended'
          ORDER BY created_at
          LIMIT 1`,
        [attribution.key],
      );
      return existing.rows[0] || null;
    });
  }

  async function deleteObject(objectKey) {
    try {
      await r2Client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      }));
      return 'deleted_confirmed';
    } catch (error) {
      if (noSuchKey(error)) return 'object_absent';
      throw error;
    }
  }

  async function resolveIntent(intent, terminalState) {
    return transaction(async (client) => {
      await guardLease(client);
      const result = await client.query(
        `UPDATE public.sf_audio_deletion_intents
            SET state = $2,
                resolved_at = now(),
                updated_at = now()
          WHERE id = $1
            AND state = 'intended'
          RETURNING *`,
        [intent.id, terminalState],
      );
      const resolved = result.rows[0];
      if (!resolved) return null;
      await appendAudit(client, {
        action: terminalState === 'object_absent'
          ? 'reconciliation_object_absent'
          : 'reconciliation_deleted',
        entityType: 'deletion_intent',
        entityId: intent.id,
        next: {
          category: resolved.category,
          refState: resolved.ref_state,
        },
      });
      return resolved;
    });
  }

  async function recordDeleteFailure(intent, counters) {
    return transaction(async (client) => {
      await guardLease(client);
      const result = await client.query(
        `UPDATE public.sf_audio_deletion_intents
            SET attempts = attempts + 1,
                updated_at = now()
          WHERE id = $1
            AND state = 'intended'
          RETURNING *`,
        [intent.id],
      );
      const updated = result.rows[0];
      if (!updated) return null;
      if (Number(updated.attempts) >= INTENT_MAX_ATTEMPTS) {
        const failed = await client.query(
          `UPDATE public.sf_audio_deletion_intents
              SET state = 'failed',
                  resolved_at = now(),
                  updated_at = now()
            WHERE id = $1
              AND state = 'intended'
            RETURNING *`,
          [intent.id],
        );
        await appendAudit(client, {
          action: 'reconciliation_delete_failed',
          entityType: 'deletion_intent',
          entityId: intent.id,
          next: {
            attempts: Number(updated.attempts),
            category: updated.category,
            refState: updated.ref_state,
          },
        });
        counters.failed += failed.rows[0] ? 1 : 0;
        const error = new Error('Reconciliation deletion attempts were exhausted.');
        error.code = 'reconciliation_audit_failed';
        throw error;
      }
      await appendAudit(client, {
        action: 'object_delete_retried',
        entityType: 'deletion_intent',
        entityId: intent.id,
        next: {
          attempts: Number(updated.attempts),
          category: updated.category,
          refState: updated.ref_state,
        },
      });
      counters.retried += 1;
      return updated;
    });
  }

  async function processIntent(intent, counters) {
    if (Number(intent.attempts) >= INTENT_MAX_ATTEMPTS) {
      await transaction(async (client) => {
        await guardLease(client);
        const failed = await client.query(
          `UPDATE public.sf_audio_deletion_intents
              SET state = 'failed',
                  resolved_at = now(),
                  updated_at = now()
            WHERE id = $1
              AND state = 'intended'
            RETURNING *`,
          [intent.id],
        );
        if (failed.rows[0]) {
          await appendAudit(client, {
            action: 'reconciliation_delete_failed',
            entityType: 'deletion_intent',
            entityId: intent.id,
            next: {
              attempts: Number(intent.attempts),
              category: intent.category,
              refState: intent.ref_state,
            },
          });
          counters.failed += 1;
        }
      });
      const error = new Error('Reconciliation deletion attempts were exhausted.');
      error.code = 'reconciliation_audit_failed';
      throw error;
    }
    let terminalState;
    try {
      terminalState = await deleteObject(intent.object_key);
    } catch {
      await recordDeleteFailure(intent, counters);
      return false;
    }
    const resolved = await resolveIntent(intent, terminalState);
    if (!resolved) return false;
    if (terminalState === 'object_absent') counters.objectAbsent += 1;
    else counters.deletedConfirmed += 1;
    return true;
  }

  async function recoverUnresolved(counters) {
    const intents = await transaction(async (client) => {
      const result = await client.query(
        `SELECT *
           FROM public.sf_audio_deletion_intents
          WHERE state = 'intended'
          ORDER BY created_at ASC`,
      );
      return result.rows;
    });
    for (const intent of intents) {
      if ((counters.deletedConfirmed + counters.objectAbsent) >= MAX_DELETES_PER_RUN) {
        break;
      }
      await processIntent(intent, counters);
    }
  }

  async function commitPage(runId, cursorKey, counters) {
    return transaction(async (client) => {
      const state = await client.query(
        `UPDATE public.sf_reconciliation_state
            SET cursor_key = $1,
                updated_at = now()
          WHERE id = 1
            AND lease_owner = $2
            AND lease_expires_at > now()
          RETURNING *`,
        [cursorKey, replicaId],
      );
      if (!state.rows[0]) {
        const error = new Error('The reconciliation lease was lost.');
        error.code = 'reconciliation_lease_lost';
        throw error;
      }
      await client.query(
        `UPDATE public.sf_reconciliation_runs
            SET pages_listed = $2,
                keys_evaluated = $3,
                candidates = $4,
                preserved = $5,
                deleted_confirmed = $6,
                object_absent = $7,
                retried = $8,
                failed = $9,
                cursor_digest_end = $10
          WHERE id = $1`,
        [runId, ...counterColumns(counters), reconciliationCursorDigest(cursorKey)],
      );
      return state.rows[0];
    });
  }

  async function finishRun(runId, mode, counters, cursorKey, exhausted) {
    const finalCursor = exhausted ? '' : cursorKey;
    await transaction(async (client) => {
      const state = await client.query(
        `UPDATE public.sf_reconciliation_state
            SET cursor_key = $1,
                lease_owner = NULL,
                lease_expires_at = NULL,
                updated_at = now()
          WHERE id = 1
            AND lease_owner = $2
            AND lease_expires_at > now()
          RETURNING *`,
        [finalCursor, replicaId],
      );
      if (!state.rows[0]) {
        const error = new Error('The reconciliation lease was lost.');
        error.code = 'reconciliation_lease_lost';
        throw error;
      }
      await client.query(
        `UPDATE public.sf_reconciliation_runs
            SET finished_at = now(),
                pages_listed = $2,
                keys_evaluated = $3,
                candidates = $4,
                preserved = $5,
                deleted_confirmed = $6,
                object_absent = $7,
                retried = $8,
                failed = $9,
                cursor_digest_end = $10
          WHERE id = $1`,
        [runId, ...counterColumns(counters), reconciliationCursorDigest(finalCursor)],
      );
      await appendAudit(client, {
        action: 'reconciliation_run_finished',
        entityType: 'reconciliation_run',
        entityId: runId,
        next: {
          mode,
          pagesListed: counters.pagesListed,
          keysEvaluated: counters.keysEvaluated,
          candidates: counters.candidates,
          preserved: counters.preserved,
          deletedConfirmed: counters.deletedConfirmed,
          objectAbsent: counters.objectAbsent,
          retried: counters.retried,
          failed: counters.failed,
          cursorDigest: reconciliationCursorDigest(finalCursor),
        },
      });
      await client.query('SELECT public.sf_reconciliation_sweep_old_runs()');
    });
    return finalCursor;
  }

  async function abortRun(runId, mode, counters, cursorKey, error) {
    const abortReason = error?.code || 'reconciliation_audit_failed';
    try {
      await transaction(async (client) => {
        await client.query(
          `UPDATE public.sf_reconciliation_runs
              SET pages_listed = $2,
                  keys_evaluated = $3,
                  candidates = $4,
                  preserved = $5,
                  deleted_confirmed = $6,
                  object_absent = $7,
                  retried = $8,
                  failed = $9,
                  abort_reason = $10,
                  cursor_digest_end = $11
            WHERE id = $1`,
          [
            runId,
            ...counterColumns(counters),
            abortReason,
            reconciliationCursorDigest(cursorKey),
          ],
        );
        await appendAudit(client, {
          action: abortReason === 'reconciliation_lease_lost'
            ? 'reconciliation_lease_lost'
            : 'reconciliation_run_aborted',
          entityType: 'reconciliation_run',
          entityId: runId,
          next: {
            mode,
            abortReason,
            failed: counters.failed,
            cursorDigest: reconciliationCursorDigest(cursorKey),
          },
        });
      });
    } catch {
      // The original error and the durable run row remain the authoritative
      // failure evidence when a secondary abort audit cannot be appended.
    }
    return abortReason;
  }

  async function run() {
    const mode = reconciliationMode(config);
    const suspended = suspensionReason(config);
    if (mode === 'off') return Object.freeze({ status: 'off', replicaId });
    if (suspended) {
      return Object.freeze({ status: 'suspended', reason: suspended, replicaId });
    }
    if (!r2Client || typeof r2Client.send !== 'function' || !bucket) {
      return Object.freeze({
        status: 'unavailable',
        code: 'audio_storage_unavailable',
        replicaId,
      });
    }

    const lease = await acquireLease();
    if (!lease) return Object.freeze({ status: 'lease_held', replicaId });
    let cursorKey = String(lease.cursor_key || '');
    const counters = emptyCounters();
    let runRow;
    try {
      runRow = await createRun(mode, cursorKey);
      await recoverUnresolved(counters);
      let exhausted = false;
      let renewalDue = performance.now() + LEASE_RENEWAL_MS;
      const evaluatedAt = await databaseNow();

      for (let pageIndex = 0; pageIndex < MAX_PAGES_PER_RUN; pageIndex += 1) {
        const page = await listPage(cursorKey);
        if (page.objects.length > 0) counters.pagesListed += 1;
        let lastListedKey = cursorKey;
        for (const object of page.objects) {
          lastListedKey = object.objectKey;
          const parsed = parseReconciliationKey(object.objectKey);
          if (!parsed.inScope) continue;
          counters.keysEvaluated += 1;
          if (await isReferenced(parsed.key)) {
            counters.preserved += 1;
            continue;
          }
          const attribution = await readAttribution(parsed);
          if (attribution.refState === 'live') {
            counters.preserved += 1;
            continue;
          }
          const head = await headObject(attribution.key);
          const lastModified = head?.LastModified || head?.lastModified || null;
          const age = lastModified
            ? evaluatedAt.getTime() - new Date(lastModified).getTime()
            : -1;
          if (age < eligibleAgeMs) {
            counters.preserved += 1;
            continue;
          }
          counters.candidates += 1;
          if (mode === 'on') {
            const intent = await createIntent(runRow.id, attribution);
            if (intent) await processIntent(intent, counters);
          }
          if ((counters.deletedConfirmed + counters.objectAbsent) >= MAX_DELETES_PER_RUN) {
            break;
          }
        }

        exhausted = !page.truncated;
        cursorKey = exhausted ? '' : lastListedKey;
        await commitPage(runRow.id, cursorKey, counters);
        if (exhausted) break;
        if ((counters.deletedConfirmed + counters.objectAbsent) >= MAX_DELETES_PER_RUN) break;
        if (performance.now() >= renewalDue) {
          if (!await renewLease()) {
            const error = new Error('The reconciliation lease was lost.');
            error.code = 'reconciliation_lease_lost';
            throw error;
          }
          renewalDue = performance.now() + LEASE_RENEWAL_MS;
        }
      }

      const finalCursor = await finishRun(
        runRow.id,
        mode,
        counters,
        cursorKey,
        exhausted,
      );
      emit({
        event: 'audio_reconciliation',
        status: 'completed',
        mode,
        ...counters,
      });
      return Object.freeze({
        status: 'completed',
        runId: runRow.id,
        mode,
        cursorDigest: reconciliationCursorDigest(finalCursor),
        ...counters,
        replicaId,
      });
    } catch (error) {
      if (runRow?.id) {
        const abortReason = await abortRun(
          runRow.id,
          mode,
          counters,
          cursorKey,
          error,
        );
        emit({
          event: 'audio_reconciliation',
          status: 'aborted',
          mode,
          abortReason,
          ...counters,
        });
        return Object.freeze({
          status: 'aborted',
          runId: runRow.id,
          mode,
          abortReason,
          ...counters,
          replicaId,
        });
      }
      await releaseLease().catch(() => {});
      throw error;
    }
  }

  return Object.freeze({
    replicaId,
    run,
    acquireLease,
    renewLease,
    releaseLease,
    parseKeyAttribution: readAttribution,
  });
}
