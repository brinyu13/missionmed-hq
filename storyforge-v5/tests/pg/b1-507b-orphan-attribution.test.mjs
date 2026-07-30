import {
  definePgAcceptanceSuite,
  scalar,
  sourceCase,
} from './b1-507b-support.mjs';

definePgAcceptanceSuite([
  sourceCase('T4-01', 'live referenced keys are preserved before attribution', 'reconciliation', /if \(await isReferenced\(parsed\.key\)\)[\s\S]*counters\.preserved/),
  sourceCase('T4-02', 'deleted reference maps to orphan-deleted-ref', 'reconciliation', /orphan_deleted_ref/),
  sourceCase('T4-03', 'never-existing reference maps to orphan-never-existed', 'reconciliation', /orphan_never_existed/),
  sourceCase('T4-04', 'invalid parsed key maps to orphan-invalid-key', 'reconciliation', /orphan_invalid_key/),
  sourceCase('T4-09', 'seven-day HeadObject age floor is enforced', 'reconciliation', /ELIGIBLE_AGE_DAYS = 7[\s\S]*LastModified/),
  sourceCase('T4-10', 'objects older than the age floor continue to deletion', 'reconciliation', /if \(age < eligibleAgeMs\)[\s\S]*counters\.candidates/),
  {
    id: 'T4-11',
    name: 'intent attribution UUID columns have no foreign keys',
    async run({ assert, client }) {
      assert.equal(
        await scalar(
          client,
          `SELECT count(*) FROM pg_constraint
            WHERE conrelid='public.sf_audio_deletion_intents'::regclass AND contype='f'`,
        ),
        '0',
      );
    },
  },
  sourceCase('T4-12', 'orphan audit foreign keys are null', 'reconciliation', /\$1, \$2, \$3, NULL, NULL, NULL, \$4::jsonb/),
  sourceCase('T4-13', 'parsed attribution is never promoted into audit foreign keys', 'reconciliation', /appendAudit\(client,[\s\S]*entityType: 'deletion_intent'/),
  sourceCase('T4-14', 'audit payload includes category and reference state', 'reconciliation', /category: intent\.category,[\s\S]*refState: intent\.ref_state/),
  sourceCase('T4-15', 'existing M3 reference-check function is used', 'reconciliation', /sf_voice_audio_reference_check/),
  sourceCase('T4-16', 'live-entity unreferenced keys are preserved without intent', 'reconciliation', /attribution\.refState === 'live'[\s\S]*counters\.preserved \+= 1[\s\S]*continue/),
  sourceCase('T4-17', 'dry-run uses the same age-floor evaluation', 'reconciliation', /if \(age < eligibleAgeMs\)[\s\S]*if \(mode === 'on'\)/),
]);
