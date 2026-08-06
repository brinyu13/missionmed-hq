const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const legacyIdPattern = /^[a-z][a-z0-9_]{0,63}$/;
const taxonomyStates = new Set(['active', 'hidden', 'retired']);
const sectionModes = new Set(['visible_optional', 'visible_required', 'hidden']);
const sectionKeys = Object.freeze([
  'storyCategories',
  'intendedUses',
  'workingVersion',
  'learningLesson',
  'reviewSubmission',
]);

export class ProductConfigurationError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ProductConfigurationError';
    this.code = code;
    this.status = status;
  }
}

export function contentDisplayForceOff(environment = process.env) {
  return !['0', 'false', 'no', 'off'].includes(
    String(environment.STORYFORGE_CONTENT_DISPLAY_FORCE_OFF ?? '1').trim().toLowerCase(),
  );
}

function plainText(value, label, maximum, { allowBlank = false } = {}) {
  const text = String(value ?? '').trim();
  if ((!allowBlank && !text) || text.length > maximum || /[<>\u0000-\u001f\u007f]/u.test(text)) {
    throw new ProductConfigurationError('invalid_content_display', `${label} is not valid plain text.`);
  }
  return text;
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProductConfigurationError('invalid_content_display', `${label} is required.`);
  }
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])) {
    throw new ProductConfigurationError('invalid_content_display', `${label} contains unsupported fields.`);
  }
}

function normalizeTaxonomy(entries, label, maximum) {
  if (!Array.isArray(entries) || !entries.length || entries.length > maximum) {
    throw new ProductConfigurationError('invalid_content_display', `${label} must contain between 1 and ${maximum} values.`);
  }
  const ids = new Set();
  const orders = new Set();
  return entries.map((entry) => {
    exactKeys(entry, ['id', 'label', 'sortOrder', 'state', 'builtin'], `${label} entry`);
    const id = String(entry.id || '').trim();
    if ((!legacyIdPattern.test(id) && !uuidPattern.test(id)) || ids.has(id)) {
      throw new ProductConfigurationError('invalid_content_display', `${label} identifiers must be stable and unique.`);
    }
    const sortOrder = Number(entry.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10_000 || orders.has(sortOrder)) {
      throw new ProductConfigurationError('invalid_content_display', `${label} ordering must be unique and bounded.`);
    }
    const state = String(entry.state || '');
    if (!taxonomyStates.has(state)) {
      throw new ProductConfigurationError('invalid_content_display', `${label} state is not recognized.`);
    }
    ids.add(id);
    orders.add(sortOrder);
    return Object.freeze({
      id,
      label: plainText(entry.label, `${label} label`, 80),
      sortOrder,
      state,
      builtin: entry.builtin === true,
    });
  }).sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
}

export function validateContentDisplay(input) {
  exactKeys(input, ['taxonomy', 'sections', 'navigation'], 'Content & Display configuration');
  exactKeys(input.taxonomy, ['categories', 'intendedUses'], 'Taxonomy configuration');
  exactKeys(input.sections, sectionKeys, 'Section configuration');
  exactKeys(input.navigation, ['interviewPrepVisible'], 'Navigation configuration');

  const sections = Object.fromEntries(sectionKeys.map((key) => {
    const section = input.sections[key];
    exactKeys(section, ['title', 'helper', 'mode'], `${key} section`);
    const mode = String(section.mode || '');
    if (!sectionModes.has(mode)) {
      throw new ProductConfigurationError('invalid_content_display', `${key} visibility mode is not recognized.`);
    }
    return [key, Object.freeze({
      title: plainText(section.title, `${key} title`, 80),
      helper: plainText(section.helper, `${key} helper`, 400, { allowBlank: true }),
      mode,
    })];
  }));

  if (typeof input.navigation.interviewPrepVisible !== 'boolean') {
    throw new ProductConfigurationError('invalid_content_display', 'Interview Prep visibility must be true or false.');
  }

  return Object.freeze({
    taxonomy: Object.freeze({
      categories: Object.freeze(normalizeTaxonomy(input.taxonomy.categories, 'Story categories', 50)),
      intendedUses: Object.freeze(normalizeTaxonomy(input.taxonomy.intendedUses, 'Intended uses', 30)),
    }),
    sections: Object.freeze(sections),
    navigation: Object.freeze({ interviewPrepVisible: input.navigation.interviewPrepVisible }),
  });
}

function requireAdmin(identity) {
  if (identity?.eligible !== true
      || (identity?.role !== 'admin' && identity?.wordpressAdmin !== true)
      || !uuidPattern.test(String(identity?.sub || ''))) {
    throw new ProductConfigurationError('admin_required', 'An eligible WordPress administrator is required.', 403);
  }
}

function databaseError(error) {
  if (error?.code === '40001') {
    throw new ProductConfigurationError('content_display_conflict', 'Content & Display changed. Reload before publishing.', 409);
  }
  if (error?.code === '42501') {
    throw new ProductConfigurationError('admin_required', 'An eligible WordPress administrator is required.', 403);
  }
  throw error;
}

export function createProductConfigurationService({ withIdentity, environment = process.env } = {}) {
  if (typeof withIdentity !== 'function') throw new TypeError('withIdentity must be supplied.');
  const withAdmin = (identity, operation) => identity?.role === 'admin'
    ? withIdentity(identity, operation)
    : withIdentity(identity, operation, { adminMode: true });

  return Object.freeze({
    async read(identity) {
      return withIdentity(identity, async (client) => {
        const result = await client.query('SELECT public.sf_get_storyforge_configuration() AS configuration');
        return result.rows[0]?.configuration || null;
      });
    },
    async validate(identity, input) {
      requireAdmin(identity);
      if (contentDisplayForceOff(environment)) {
        throw new ProductConfigurationError('content_display_disabled', 'Content & Display administration is disabled.', 403);
      }
      return { payload: validateContentDisplay(input?.payload) };
    },
    async publish(identity, input) {
      requireAdmin(identity);
      if (contentDisplayForceOff(environment)) {
        throw new ProductConfigurationError('content_display_disabled', 'Content & Display administration is disabled.', 403);
      }
      const expectedVersion = Number(input?.expectedVersion);
      if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
        throw new ProductConfigurationError('invalid_content_display', 'Expected configuration version is required.');
      }
      const payload = validateContentDisplay(input?.payload);
      try {
        return await withAdmin(identity, async (client) => {
          const result = await client.query(
            'SELECT public.sf_publish_storyforge_configuration($1::jsonb, $2::bigint) AS configuration',
            [JSON.stringify(payload), expectedVersion],
          );
          return result.rows[0]?.configuration;
        });
      } catch (error) {
        return databaseError(error);
      }
    },
    async restore(identity, input) {
      requireAdmin(identity);
      if (contentDisplayForceOff(environment)) {
        throw new ProductConfigurationError('content_display_disabled', 'Content & Display administration is disabled.', 403);
      }
      const expectedVersion = Number(input?.expectedVersion);
      if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
        throw new ProductConfigurationError('invalid_content_display', 'Expected configuration version is required.');
      }
      try {
        return await withAdmin(identity, async (client) => {
          const result = await client.query(
            'SELECT public.sf_restore_storyforge_configuration($1::bigint) AS configuration',
            [expectedVersion],
          );
          return result.rows[0]?.configuration;
        });
      } catch (error) {
        return databaseError(error);
      }
    },
  });
}
