import {
  definePgAcceptanceSuite,
  scalar,
  sourceCase,
} from './b1-507b-support.mjs';

definePgAcceptanceSuite([
  sourceCase('T7-01', 'all original M3 audit actions remain allowed', 'migration', /recording_cancelled[\s\S]*recording_swept[\s\S]*assembly_completed[\s\S]*assembly_failed[\s\S]*segment_transcribed[\s\S]*segment_transcribe_failed[\s\S]*provider_failover/),
  sourceCase('T7-02', 'all reconciliation audit actions are allowed', 'migration', /reconciliation_deleted[\s\S]*object_delete_retried[\s\S]*reconciliation_object_absent[\s\S]*reconciliation_delete_failed[\s\S]*reconciliation_run_started[\s\S]*reconciliation_run_finished[\s\S]*reconciliation_run_aborted[\s\S]*reconciliation_lease_acquired[\s\S]*reconciliation_lease_lost/),
  sourceCase('T7-03', 'unknown audit action raises invalid-parameter-value', 'migration', /service audit action not permitted' USING ERRCODE = '22023'/),
  sourceCase('T7-04', 'reconciliation entity types augment M3 entities', 'migration', /deletion_intent[\s\S]*reconciliation_run[\s\S]*reconciliation_state/),
  sourceCase('T7-05', 'unknown entity type is rejected', 'migration', /service audit entity not permitted' USING ERRCODE = '22023'/),
  sourceCase('T7-06', 'M3 payload keys remain in the allowlist', 'migration', /errorCategory[\s\S]*recordingId/),
  sourceCase('T7-07', 'reconciliation payload keys are all allowlisted', 'migration', /pagesListed[\s\S]*keysEvaluated[\s\S]*deletedConfirmed[\s\S]*objectAbsent[\s\S]*cursorDigest[\s\S]*replicaId[\s\S]*suspensionReason/),
  {
    id: 'T7-08',
    name: 'objectKey is deliberately absent from the payload allowlist',
    async run({ assert, client }) {
      assert.equal(await scalar(client, `SELECT public.sf_voice_audit_payload_ok('{"objectKey":"secret"}'::jsonb)`), false);
    },
  },
  sourceCase('T7-09', 'intent terminal states are validated', 'migration', /intended[\s\S]*deleted_confirmed[\s\S]*object_absent/),
  sourceCase('T7-10', 'reconciliation abort reasons are validated', 'migration', /reconciliation_audit_failed[\s\S]*reconciliation_lease_lost[\s\S]*reconciliation_caps_reached[\s\S]*reconciliation_suspension/),
  sourceCase('T7-11', 'audit mode admits only dry-run and on', 'migration', /dry_run[\s\S]*'on'/),
  sourceCase('T7-12', 'orphan categories are fixed', 'migration', /orphan_deleted_ref[\s\S]*orphan_never_existed[\s\S]*orphan_invalid_key/),
  sourceCase('T7-13', 'reference-state vocabulary is fixed', 'migration', /never_existed[\s\S]*invalid_key/),
  sourceCase('T7-14', 'content-free payload cap remains 4096 characters', 'migration', /4096/),
  sourceCase('T7-15', 'content-free payload key cap remains twelve', 'migration', /count\(\*\) FROM jsonb_object_keys\(p_payload\)\) > 12/),
  {
    id: 'T7-16',
    name: 'service audit function signature and bigint result remain unchanged',
    async run({ assert, client }) {
      const result = await scalar(
        client,
        `SELECT pg_get_function_result(
          'public.sf_append_voice_audit_service(text,text,uuid,uuid,uuid,jsonb,jsonb)'::regprocedure
        )`,
      );
      assert.equal(result, 'bigint');
    },
  },
]);
