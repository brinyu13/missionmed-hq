import { readFileSync } from 'node:fs';

const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

function valueFrom(raw) {
  const value = raw.trim();
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1);
  }
  return value;
}

export function loadLocalEnvironment({ path, env = process.env } = {}) {
  if (!path) throw new TypeError('A local environment path is required.');
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return { found: false, loaded: 0 };
    throw error;
  }
  let loaded = 0;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!KEY.test(key) || env[key] != null) continue;
    env[key] = valueFrom(trimmed.slice(separator + 1));
    loaded += 1;
  }
  return { found: true, loaded };
}
