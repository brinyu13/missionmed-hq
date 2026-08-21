const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const b1517FeatureKeys = Object.freeze([
  'eras_taxonomy',
  'myeras_workspace',
  'clinical_case_metadata',
  'use_ranking',
  'myeras_versions',
  'ai_condensation',
]);

const capabilityNames = Object.freeze({
  eras_taxonomy: 'erasTaxonomy',
  myeras_workspace: 'myerasWorkspace',
  clinical_case_metadata: 'clinicalCaseMetadata',
  use_ranking: 'useRanking',
  myeras_versions: 'myerasVersions',
  ai_condensation: 'aiCondensation',
});
const forceOffNames = Object.freeze({
  eras_taxonomy: 'STORYFORGE_ERAS_TAXONOMY_FORCE_OFF',
  myeras_workspace: 'STORYFORGE_MYERAS_WORKSPACE_FORCE_OFF',
  clinical_case_metadata: 'STORYFORGE_CLINICAL_CASE_METADATA_FORCE_OFF',
  use_ranking: 'STORYFORGE_USE_RANKING_FORCE_OFF',
  myeras_versions: 'STORYFORGE_MYERAS_VERSIONS_FORCE_OFF',
  ai_condensation: 'STORYFORGE_AI_CONDENSATION_FORCE_OFF',
});
const taxonomyDimensions = new Set([
  'experience_type', 'primary_focus', 'key_characteristic', 'setting',
  'participation_frequency', 'clinical_specialty', 'clinical_setting',
  'clinical_acuity', 'clinical_role',
]);
const useIds = new Set([
  'ps', 'iv', 'letter', 'myeras_experiences', 'myeras_most_impactful', 'later',
]);
const featureScopes = new Set(['off', 'allowlist', 'cohort', 'eligible_all']);
const experienceFields = new Set([
  'slotNo', 'organization', 'experienceType', 'positionTitle', 'isCurrent',
  'startMonth', 'endMonth', 'country', 'stateProvince', 'city', 'postalCode',
  'setting', 'primaryFocus', 'keyCharacteristic',
  'descriptionText', 'mostMeaningful', 'mostMeaningfulRank', 'mostMeaningfulText',
]);

export class MyerasError extends Error {
  constructor(code, message, status = 400, options = {}) {
    super(message, options);
    this.name = 'MyerasError';
    this.code = code;
    this.status = status;
  }
}

function requireFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be supplied.`);
  return value;
}

function uuid(value, label, { nullable = false } = {}) {
  if (nullable && (value == null || value === '')) return null;
  const normalized = String(value || '').trim();
  if (!uuidPattern.test(normalized)) throw new MyerasError('invalid_identifier', `${label} is invalid.`);
  return normalized;
}

function exactObject(value, allowed, code = 'invalid_myeras_request') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MyerasError(code, 'The MyERAS request is invalid.');
  }
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new MyerasError(code, 'Unsupported MyERAS fields are not accepted.');
  }
  return value;
}

function integer(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) {
    throw new MyerasError('invalid_myeras_request', `${label} is invalid.`);
  }
  return result;
}

function optionalText(value, label, max) {
  if (value == null) return null;
  const result = String(value);
  if (result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) {
    throw new MyerasError('invalid_myeras_request', `${label} is invalid.`);
  }
  return result;
}

function optionalDate(value, label) {
  if (value == null || value === '') return null;
  const result = String(value);
  if (!datePattern.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`))) {
    throw new MyerasError('invalid_myeras_request', `${label} is invalid.`);
  }
  return result;
}

function expectedVersion(value) {
  return integer(value, 'Expected version', 0);
}

function requireStudent(identity) {
  if (identity?.role !== 'student' || identity?.eligible !== true) {
    throw new MyerasError('student_required', 'Only the student may change this MyERAS workspace.', 403);
  }
}

function requireAdmin(identity) {
  if (identity?.role !== 'admin' || identity?.eligible !== true) {
    throw new MyerasError('admin_required', 'Administrator authority is required.', 403);
  }
}

function experiencePayload(input) {
  const source = exactObject(input, experienceFields);
  const result = {};
  const textLimits = {
    organization: 200,
    experienceType: 120,
    positionTitle: 200,
    country: 120,
    stateProvince: 120,
    city: 120,
    postalCode: 32,
    setting: 120,
    primaryFocus: 120,
    keyCharacteristic: 120,
    descriptionText: 4000,
    mostMeaningfulText: 2000,
  };
  for (const [key, max] of Object.entries(textLimits)) {
    if (Object.hasOwn(source, key)) result[key] = optionalText(source[key], key, max);
  }
  if (Object.hasOwn(source, 'slotNo')) result.slotNo = integer(source.slotNo, 'Slot number', 1, 40);
  if (Object.hasOwn(source, 'isCurrent')) {
    if (typeof source.isCurrent !== 'boolean') throw new MyerasError('invalid_myeras_request', 'Current status is invalid.');
    result.isCurrent = source.isCurrent;
  }
  if (Object.hasOwn(source, 'mostMeaningful')) {
    if (typeof source.mostMeaningful !== 'boolean') throw new MyerasError('invalid_myeras_request', 'Most meaningful status is invalid.');
    result.mostMeaningful = source.mostMeaningful;
  }
  if (Object.hasOwn(source, 'mostMeaningfulRank')) {
    result.mostMeaningfulRank = source.mostMeaningfulRank == null
      ? null
      : integer(source.mostMeaningfulRank, 'Most meaningful rank', 1, 10);
  }
  if (Object.hasOwn(source, 'startMonth')) result.startMonth = optionalDate(source.startMonth, 'Start month');
  if (Object.hasOwn(source, 'endMonth')) result.endMonth = optionalDate(source.endMonth, 'End month');
  return result;
}

function tagsPayload(input) {
  const source = exactObject(input, new Set(['profileKey', 'tags']));
  const profileKey = optionalText(source.profileKey, 'Profile key', 80)?.trim();
  if (!profileKey || !Array.isArray(source.tags) || source.tags.length > 9) {
    throw new MyerasError('invalid_myeras_request', 'ERAS tags are invalid.');
  }
  const seen = new Set();
  const tags = source.tags.map((item) => {
    const tag = exactObject(item, new Set(['dimension', 'termId', 'source']));
    const dimension = String(tag.dimension || '').trim();
    const termId = String(tag.termId || '').trim();
    const sourceValue = tag.source == null ? 'student' : String(tag.source);
    if (!taxonomyDimensions.has(dimension) || !/^[a-z0-9_]+$/.test(termId)
      || !['student', 'mapped_accepted'].includes(sourceValue) || seen.has(dimension)) {
      throw new MyerasError('invalid_myeras_request', 'ERAS tags are invalid.');
    }
    seen.add(dimension);
    return { dimension, termId, source: sourceValue };
  });
  return { profileKey, tags };
}

function clinicalPayload(input) {
  const source = exactObject(input, new Set([
    'specialty', 'careSetting', 'acuity', 'roleInCase', 'patientContext',
    'outcomeFocus', 'deidentConfirmed', 'expectedVersion',
  ]));
  if (typeof source.deidentConfirmed !== 'boolean') {
    throw new MyerasError('invalid_myeras_request', 'De-identification confirmation is required.');
  }
  const payload = {
    specialty: optionalText(source.specialty, 'Specialty', 120),
    careSetting: optionalText(source.careSetting, 'Care setting', 120),
    acuity: optionalText(source.acuity, 'Acuity', 120),
    roleInCase: optionalText(source.roleInCase, 'Role in case', 120),
    patientContext: optionalText(source.patientContext ?? '', 'Patient context', 500),
    outcomeFocus: optionalText(source.outcomeFocus ?? '', 'Outcome focus', 500),
    deidentConfirmed: source.deidentConfirmed,
  };
  if ((payload.patientContext || payload.outcomeFocus) && !payload.deidentConfirmed) {
    throw new MyerasError('invalid_myeras_request', 'Confirm that clinical details are de-identified.');
  }
  return { payload, expectedVersion: expectedVersion(source.expectedVersion) };
}

function featureInput(input) {
  const source = exactObject(input, new Set(['scope', 'allowlist', 'cohorts']));
  const scope = String(source.scope || '').trim();
  if (!featureScopes.has(scope)) throw new MyerasError('invalid_feature_scope', 'Feature scope is invalid.');
  const allowlist = Array.isArray(source.allowlist) ? source.allowlist.map((id) => uuid(id, 'Student identifier')) : [];
  const cohorts = Array.isArray(source.cohorts)
    ? source.cohorts.map((value) => optionalText(value, 'Cohort', 120)?.trim()).filter(Boolean)
    : [];
  if (allowlist.length > 50 || cohorts.length > 20
    || (scope === 'off' && (allowlist.length || cohorts.length))
    || (scope === 'allowlist' && (!allowlist.length || cohorts.length))
    || (scope === 'cohort' && (!cohorts.length || allowlist.length))
    || (scope === 'eligible_all' && (allowlist.length || cohorts.length))) {
    throw new MyerasError('invalid_feature_scope', 'Feature scope values are invalid.');
  }
  return { scope, allowlist: [...new Set(allowlist)], cohorts: [...new Set(cohorts)] };
}

function translate(error) {
  if (error?.code === 'P0002') throw new MyerasError('myeras_not_found', 'The requested MyERAS resource was not found.', 404, { cause: error });
  if (error?.code === '40001') throw new MyerasError('myeras_conflict', 'This MyERAS workspace changed. Reload before saving.', 409, { cause: error });
  if (error?.code === '22023') throw new MyerasError('invalid_myeras_request', 'The MyERAS request is invalid.', 400, { cause: error });
  if (['42501', '42883', '42P01'].includes(error?.code)) {
    throw new MyerasError('myeras_unavailable', 'MyERAS features are unavailable.', 403, { cause: error });
  }
  throw error;
}

export function createMyerasService({
  withIdentity,
  condensationProviderAvailable = false,
  environment = process.env,
} = {}) {
  requireFunction(withIdentity, 'withIdentity');

  async function rpc(identity, sql, values = []) {
    try {
      return await withIdentity(identity, async (client) => {
        const result = await client.query(sql, values);
        return result.rows[0]?.payload ?? null;
      });
    } catch (error) {
      return translate(error);
    }
  }

  async function capabilities(identity) {
    const disabled = Object.fromEntries(Object.values(capabilityNames).map((name) => [name, false]));
    if (identity?.eligible !== true || !['student', 'admin'].includes(identity?.role)) return disabled;
    const enabledByRuntime = Object.fromEntries(b1517FeatureKeys.map((key) => [
      key,
      ['0', 'false', 'no', 'off'].includes(
        String(environment?.[forceOffNames[key]] ?? '1').trim().toLowerCase(),
      ),
    ]));
    if (!Object.values(enabledByRuntime).some(Boolean)) return disabled;
    try {
      const payload = await withIdentity(identity, async (client) => {
        const sql = identity.role === 'admin'
          ? `SELECT coalesce(jsonb_object_agg(feature.key,
              public.sf_b1_517_admin_feature_enabled(feature.key,NULL)),'{}'::jsonb) AS payload
             FROM unnest($1::text[]) feature(key)`
          : `SELECT coalesce(jsonb_object_agg(feature.key,
              public.sf_story_feature_enabled(feature.key,ARRAY['student'])),'{}'::jsonb) AS payload
             FROM unnest($1::text[]) feature(key)`;
        const result = await client.query(sql, [b1517FeatureKeys]);
        return result.rows[0]?.payload || {};
      });
      const mapped = { ...disabled };
      for (const key of b1517FeatureKeys) {
        mapped[capabilityNames[key]] = enabledByRuntime[key] && payload[key] === true;
      }
      mapped.aiCondensation = mapped.aiCondensation && condensationProviderAvailable;
      return mapped;
    } catch (error) {
      if (['42501', '42883', '42P01'].includes(error?.code)) return disabled;
      throw error;
    }
  }

  return Object.freeze({
    capabilities,
    activeProfile(identity) {
      return rpc(identity, 'SELECT public.sf_eras_active_profile() AS payload');
    },
    taxonomy(identity, dimension = null) {
      const value = dimension == null || dimension === '' ? null : String(dimension).trim();
      if (value && !taxonomyDimensions.has(value)) throw new MyerasError('invalid_myeras_request', 'ERAS taxonomy dimension is invalid.');
      return rpc(identity, 'SELECT public.sf_eras_taxonomy($1) AS payload', [value]);
    },
    listTags(identity, storyId) {
      return rpc(identity, 'SELECT public.sf_list_story_eras_tags($1) AS payload', [uuid(storyId, 'Story identifier')]);
    },
    legacySuggestions(identity, storyId) {
      return rpc(identity, 'SELECT public.sf_eras_legacy_suggestions($1) AS payload', [uuid(storyId, 'Story identifier')]);
    },
    setTags(identity, storyId, input) {
      requireStudent(identity);
      const value = tagsPayload(input);
      return rpc(identity, 'SELECT public.sf_set_story_eras_tags($1,$2,$3::jsonb) AS payload', [
        uuid(storyId, 'Story identifier'), value.profileKey, JSON.stringify(value.tags),
      ]);
    },
    workspace(identity, studentId = null) {
      if (identity?.role === 'student') requireStudent(identity);
      else requireAdmin(identity);
      return rpc(identity, 'SELECT public.sf_myeras_workspace($1) AS payload', [
        identity.role === 'admin' ? uuid(studentId, 'Student identifier') : null,
      ]);
    },
    storyFit(identity, studentId = null) {
      if (identity?.role === 'student') requireStudent(identity);
      else requireAdmin(identity);
      return rpc(identity, 'SELECT public.sf_myeras_story_fit($1) AS payload', [
        identity.role === 'admin' ? uuid(studentId, 'Student identifier') : identity.sub,
      ]);
    },
    upsertExperience(identity, experienceId, input) {
      requireStudent(identity);
      const source = exactObject(input, new Set(['expectedVersion', 'experience']));
      return rpc(identity, 'SELECT public.sf_myeras_upsert_experience($1,$2::jsonb,$3) AS payload', [
        uuid(experienceId, 'Experience identifier', { nullable: true }),
        JSON.stringify(experiencePayload(source.experience)),
        expectedVersion(source.expectedVersion),
      ]);
    },
    reorderExperiences(identity, input) {
      requireStudent(identity);
      const source = exactObject(input, new Set(['experienceIds']));
      if (!Array.isArray(source.experienceIds) || source.experienceIds.length > 40) {
        throw new MyerasError('invalid_myeras_request', 'Experience order is invalid.');
      }
      const ids = source.experienceIds.map((id) => uuid(id, 'Experience identifier'));
      if (new Set(ids).size !== ids.length) throw new MyerasError('invalid_myeras_request', 'Experience order is invalid.');
      return rpc(identity, 'SELECT public.sf_myeras_set_experience_order($1::uuid[]) AS payload', [ids]);
    },
    setMostMeaningful(identity, experienceId, input) {
      requireStudent(identity);
      const source = exactObject(input, new Set(['mostMeaningful', 'rank', 'expectedVersion']));
      if (typeof source.mostMeaningful !== 'boolean') throw new MyerasError('invalid_myeras_request', 'Most meaningful status is invalid.');
      const rank = source.rank == null ? null : integer(source.rank, 'Most meaningful rank', 1, 10);
      if ((source.mostMeaningful && rank == null) || (!source.mostMeaningful && rank != null)) {
        throw new MyerasError('invalid_myeras_request', 'Most meaningful rank is invalid.');
      }
      return rpc(identity, 'SELECT public.sf_myeras_set_most_meaningful($1,$2,$3,$4) AS payload', [
        uuid(experienceId, 'Experience identifier'), source.mostMeaningful, rank,
        expectedVersion(source.expectedVersion),
      ]);
    },
    linkStory(identity, experienceId, storyId, input = {}) {
      requireStudent(identity);
      const source = exactObject(input, new Set(['linkRole']));
      const linkRole = String(source.linkRole || 'supporting');
      if (!['primary', 'supporting'].includes(linkRole)) throw new MyerasError('invalid_myeras_request', 'Story link role is invalid.');
      return rpc(identity, 'SELECT public.sf_myeras_link_story($1,$2,$3) AS payload', [
        uuid(experienceId, 'Experience identifier'), uuid(storyId, 'Story identifier'), linkRole,
      ]);
    },
    unlinkStory(identity, experienceId, storyId) {
      requireStudent(identity);
      return rpc(identity, 'SELECT public.sf_myeras_unlink_story($1,$2) AS payload', [
        uuid(experienceId, 'Experience identifier'), uuid(storyId, 'Story identifier'),
      ]);
    },
    setImpactful(identity, input) {
      requireStudent(identity);
      const source = exactObject(input, new Set(['bodyText', 'sourceStoryId', 'expectedVersion']));
      return rpc(identity, 'SELECT public.sf_myeras_set_impactful($1,$2,$3) AS payload', [
        optionalText(source.bodyText ?? '', 'Impactful experience', 4000),
        uuid(source.sourceStoryId, 'Story identifier', { nullable: true }),
        expectedVersion(source.expectedVersion),
      ]);
    },
    promoteImpactful(identity, storyId, input) {
      requireStudent(identity);
      const source = exactObject(input, new Set(['expectedVersion']));
      return rpc(identity, 'SELECT public.sf_myeras_promote_impactful($1,$2) AS payload', [
        uuid(storyId, 'Story identifier'), expectedVersion(source.expectedVersion),
      ]);
    },
    getClinicalCase(identity, storyId) {
      return rpc(identity, 'SELECT public.sf_get_story_clinical_case($1) AS payload', [uuid(storyId, 'Story identifier')]);
    },
    setClinicalCase(identity, storyId, input) {
      requireStudent(identity);
      const value = clinicalPayload(input);
      return rpc(identity, 'SELECT public.sf_set_story_clinical_case($1,$2::jsonb,$3) AS payload', [
        uuid(storyId, 'Story identifier'), JSON.stringify(value.payload), value.expectedVersion,
      ]);
    },
    setUseRank(identity, storyId, useId, input) {
      requireStudent(identity);
      const normalizedUse = String(useId || '').trim();
      if (!useIds.has(normalizedUse)) throw new MyerasError('invalid_myeras_request', 'Story use is invalid.');
      const source = exactObject(input, new Set(['rank', 'pinned', 'expectedVersion']));
      if (typeof source.pinned !== 'boolean') throw new MyerasError('invalid_myeras_request', 'Pinned status is invalid.');
      return rpc(identity, 'SELECT public.sf_set_story_use_rank($1,$2,$3,$4,$5) AS payload', [
        uuid(storyId, 'Story identifier'), normalizedUse, integer(source.rank, 'Use rank', 1, 99),
        source.pinned, expectedVersion(source.expectedVersion),
      ]);
    },
    async getFeature(identity, key) {
      requireAdmin(identity);
      const normalized = String(key || '').trim();
      if (!b1517FeatureKeys.includes(normalized)) throw new MyerasError('invalid_feature_key', 'Feature key is invalid.');
      return rpc(identity, `SELECT jsonb_build_object(
        'key',flag.key,'scope',flag.scope,'allowlist',to_jsonb(flag.allowlist),
        'cohorts',to_jsonb(flag.cohorts),'updatedBy',flag.updated_by,'updatedAt',flag.updated_at
      ) AS payload FROM public.sf_feature_flags flag WHERE flag.key=$1`, [normalized]);
    },
    updateFeature(identity, key, input) {
      requireAdmin(identity);
      const normalized = String(key || '').trim();
      if (!b1517FeatureKeys.includes(normalized)) throw new MyerasError('invalid_feature_key', 'Feature key is invalid.');
      const value = featureInput(input);
      return rpc(identity, 'SELECT public.sf_admin_set_b1_517_feature_flag($1,$2,$3::uuid[],$4::text[]) AS payload', [
        normalized, value.scope, value.allowlist, value.cohorts,
      ]);
    },
  });
}
