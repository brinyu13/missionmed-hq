import { stableStringify } from './canonical.mjs';

function pointerEscape(value) {
  return String(value).replace(/~/gu, '~0').replace(/\//gu, '~1');
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function typeMatches(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isPlainObject(value);
  if (type === 'integer') return Number.isSafeInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'string') return typeof value === 'string';
  if (type === 'boolean') return typeof value === 'boolean';
  return false;
}

function resolvePointer(root, reference) {
  if (reference === '#') return root;
  if (typeof reference !== 'string' || !reference.startsWith('#/')) {
    throw new TypeError('schema_external_reference_rejected');
  }
  let current = root;
  for (const raw of reference.slice(2).split('/')) {
    const key = raw.replace(/~1/gu, '/').replace(/~0/gu, '~');
    if (!isPlainObject(current) || !Object.hasOwn(current, key)) {
      throw new TypeError('schema_reference_missing');
    }
    current = current[key];
  }
  return current;
}

function finding(path, keyword, code = keyword) {
  return { path, keyword, code };
}

function safelyStableStringify(value) {
  try {
    return { valid: true, serialized: stableStringify(value) };
  } catch {
    return { valid: false, serialized: null };
  }
}

function instanceIsJsonValue(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  if (!Array.isArray(value) && !isPlainObject(value)) return false;
  seen.add(value);
  const values = Array.isArray(value) ? value : Object.values(value);
  const valid = values.every((child) => instanceIsJsonValue(child, seen));
  seen.delete(value);
  return valid;
}

function validateNode(schema, value, root, path, depth, activeRefs) {
  if (depth > 256) return [finding(path, 'depth', 'schema_validation_depth_exceeded')];
  if (schema === true) return [];
  if (schema === false) return [finding(path, 'false_schema')];
  if (!isPlainObject(schema)) return [finding(path, 'schema', 'schema_node_invalid')];
  const errors = [];

  if (schema.$ref !== undefined) {
    if (!activeRefs.has(schema.$ref)) {
      const nextRefs = new Set(activeRefs);
      nextRefs.add(schema.$ref);
      errors.push(...validateNode(
        resolvePointer(root, schema.$ref), value, root, path, depth + 1, nextRefs,
      ));
    }
  }

  if (schema.const !== undefined) {
    const actual = safelyStableStringify(value);
    const expected = safelyStableStringify(schema.const);
    if (!actual.valid || !expected.valid || actual.serialized !== expected.serialized) {
      errors.push(finding(path, 'const'));
    }
  }
  if (Array.isArray(schema.enum)) {
    const actual = safelyStableStringify(value);
    const match = actual.valid && schema.enum.some((candidate) => {
      const expected = safelyStableStringify(candidate);
      return expected.valid && expected.serialized === actual.serialized;
    });
    if (!match) errors.push(finding(path, 'enum'));
  }

  if (Array.isArray(schema.oneOf)) {
    const branches = schema.oneOf.map((branch) => (
      validateNode(branch, value, root, path, depth + 1, new Set()).length === 0
    ));
    if (branches.filter(Boolean).length !== 1) errors.push(finding(path, 'oneOf'));
  }
  if (Array.isArray(schema.anyOf)) {
    const valid = schema.anyOf.some((branch) => (
      validateNode(branch, value, root, path, depth + 1, new Set()).length === 0
    ));
    if (!valid) errors.push(finding(path, 'anyOf'));
  }
  if (Array.isArray(schema.allOf)) {
    for (const branch of schema.allOf) {
      errors.push(...validateNode(branch, value, root, path, depth + 1, new Set()));
    }
  }
  if (schema.not !== undefined
      && validateNode(schema.not, value, root, path, depth + 1, new Set()).length === 0) {
    errors.push(finding(path, 'not'));
  }
  if (schema.if !== undefined) {
    const conditionMet = validateNode(schema.if, value, root, path, depth + 1, new Set()).length === 0;
    if (conditionMet && schema.then !== undefined) {
      errors.push(...validateNode(schema.then, value, root, path, depth + 1, new Set()));
    } else if (!conditionMet && schema.else !== undefined) {
      errors.push(...validateNode(schema.else, value, root, path, depth + 1, new Set()));
    }
  }

  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : null;
  if (types && !types.some((type) => typeMatches(value, type))) {
    errors.push(finding(path, 'type'));
    return errors;
  }

  if (typeof value === 'string') {
    if (Number.isSafeInteger(schema.minLength) && [...value].length < schema.minLength) {
      errors.push(finding(path, 'minLength'));
    }
    if (Number.isSafeInteger(schema.maxLength) && [...value].length > schema.maxLength) {
      errors.push(finding(path, 'maxLength'));
    }
    if (typeof schema.pattern === 'string') {
      let pattern;
      try {
        pattern = new RegExp(schema.pattern, 'u');
      } catch {
        throw new TypeError('schema_pattern_invalid');
      }
      if (!pattern.test(value)) errors.push(finding(path, 'pattern'));
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push(finding(path, 'minimum'));
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      errors.push(finding(path, 'maximum'));
    }
    if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) {
      errors.push(finding(path, 'exclusiveMinimum'));
    }
    if (typeof schema.exclusiveMaximum === 'number' && value >= schema.exclusiveMaximum) {
      errors.push(finding(path, 'exclusiveMaximum'));
    }
  }

  if (Array.isArray(value)) {
    if (Number.isSafeInteger(schema.minItems) && value.length < schema.minItems) {
      errors.push(finding(path, 'minItems'));
    }
    if (Number.isSafeInteger(schema.maxItems) && value.length > schema.maxItems) {
      errors.push(finding(path, 'maxItems'));
    }
    if (schema.uniqueItems === true) {
      const serialized = value.map(safelyStableStringify);
      if (serialized.some((item) => !item.valid)
          || new Set(serialized.map((item) => item.serialized)).size !== serialized.length) {
        errors.push(finding(path, 'uniqueItems'));
      }
    }
    if (schema.items !== undefined) {
      value.forEach((item, index) => {
        errors.push(...validateNode(
          schema.items, item, root, `${path}/${index}`, depth + 1, new Set(),
        ));
      });
    }
    if (schema.contains !== undefined) {
      const matches = value.filter((item, index) => (
        validateNode(schema.contains, item, root, `${path}/${index}`, depth + 1, new Set()).length === 0
      )).length;
      const minimum = Number.isSafeInteger(schema.minContains) ? schema.minContains : 1;
      const maximum = Number.isSafeInteger(schema.maxContains) ? schema.maxContains : Number.POSITIVE_INFINITY;
      if (matches < minimum || matches > maximum) errors.push(finding(path, 'contains'));
    }
  }

  if (isPlainObject(value)) {
    if (Number.isSafeInteger(schema.minProperties)
        && Object.keys(value).length < schema.minProperties) {
      errors.push(finding(path, 'minProperties'));
    }
    if (Number.isSafeInteger(schema.maxProperties)
        && Object.keys(value).length > schema.maxProperties) {
      errors.push(finding(path, 'maxProperties'));
    }
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required)) {
        errors.push(finding(`${path}/${pointerEscape(required)}`, 'required'));
      }
    }
    const properties = isPlainObject(schema.properties) ? schema.properties : {};
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}/${pointerEscape(key)}`;
      if (Object.hasOwn(properties, key)) {
        errors.push(...validateNode(
          properties[key], child, root, childPath, depth + 1, new Set(),
        ));
      } else if (schema.additionalProperties === false) {
        errors.push(finding(childPath, 'additionalProperties'));
      } else if (isPlainObject(schema.additionalProperties) || typeof schema.additionalProperties === 'boolean') {
        errors.push(...validateNode(
          schema.additionalProperties, child, root, childPath, depth + 1, new Set(),
        ));
      }
    }
  }
  return errors;
}

export function validateSchemaInstance(schema, instance) {
  if (!(isPlainObject(schema) || typeof schema === 'boolean')) {
    throw new TypeError('schema_document_invalid');
  }
  if (!instanceIsJsonValue(instance)) {
    const errors = [finding('', 'instance', 'instance_non_json_value')];
    return { valid: false, error_count: errors.length, errors };
  }
  const errors = validateNode(schema, instance, schema, '', 0, new Set())
    .filter((error, index, values) => values.findIndex((candidate) => (
      candidate.path === error.path
      && candidate.keyword === error.keyword
      && candidate.code === error.code
    )) === index)
    .sort((left, right) => `${left.path}:${left.keyword}:${left.code}`
      .localeCompare(`${right.path}:${right.keyword}:${right.code}`));
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

export function assertSchemaInstance(schema, instance, code = 'schema_instance_invalid') {
  const result = validateSchemaInstance(schema, instance);
  if (!result.valid) {
    const error = new TypeError(code);
    error.validation = result;
    throw error;
  }
  return result;
}
