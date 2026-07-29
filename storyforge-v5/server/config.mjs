import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function text(name, fallback = '') {
  return String(process.env[name] ?? fallback).trim();
}

function flag(name, fallback = false) {
  const raw = text(name, fallback ? '1' : '0').toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

function boundedInteger(name, fallback, min, max) {
  const value = Number.parseInt(text(name, String(fallback)), 10);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function normalizedBasePath(value) {
  const clean = String(value || '/').trim().replace(/^\/+|\/+$/g, '');
  return clean ? `/${clean}/` : '/';
}

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

function csv(name, fallback = '') {
  return [...new Set(text(name, fallback).split(',').map((value) => originOf(value.trim())).filter(Boolean))];
}

const staticDirSetting = text('STORYFORGE_STATIC_DIR', 'public');
const staticDir = path.resolve(packageDir, staticDirSetting);
const publicOrigin = text('STORYFORGE_PUBLIC_ORIGIN', 'http://127.0.0.1:4180');
const providerPort = boundedInteger('PORT', 4180, 1, 65535);

export const config = Object.freeze({
  packageDir,
  publicDir: staticDir,
  port: boundedInteger('STORYFORGE_PORT', providerPort, 1, 65535),
  host: text('STORYFORGE_HOST', flag('STORYFORGE_DEV_AUTH') ? '127.0.0.1' : '0.0.0.0'),
  databaseUrl: text('STORYFORGE_DATABASE_URL'),
  publicOrigin,
  basePath: normalizedBasePath(text('STORYFORGE_BASE_PATH', flag('STORYFORGE_DEV_AUTH') ? '/' : '/storyforge/')),
  matrixBaseUrl: text('STORYFORGE_MATRIX_BASE_URL', `${originOf(publicOrigin)}/member-dashboard/`),
  originApiOnly: flag('STORYFORGE_ORIGIN_API_ONLY', !flag('STORYFORGE_DEV_AUTH')),
  wpBootstrapPath: text(
    'STORYFORGE_WP_BOOTSTRAP_PATH',
    '/wp-admin/admin-ajax.php?action=missionmed_storyforge_bootstrap',
  ),
  wpTokenPath: text('STORYFORGE_WP_TOKEN_PATH', '/wp-json/missionmed/v1/storyforge/token'),
  allowedOrigins: Object.freeze(csv('STORYFORGE_ALLOWED_ORIGINS', originOf(publicOrigin))),
  tokenRefreshSkewSeconds: boundedInteger('STORYFORGE_TOKEN_REFRESH_SKEW_SECONDS', 15, 1, 120),
  jwtIssuer: text('STORYFORGE_JWT_ISSUER'),
  jwtAudience: text('STORYFORGE_JWT_AUDIENCE', 'storyforge'),
  jwksUrl: text('STORYFORGE_JWKS_URL'),
  jwtSecret: text('STORYFORGE_JWT_SECRET'),
  devAuth: flag('STORYFORGE_DEV_AUTH'),
  devJwtSecret: text('STORYFORGE_DEV_JWT_SECRET'),
  flags: Object.freeze({
    aiMentorBeta: flag('STORYFORGE_AI_MENTOR_BETA'),
    aiStudentGeneral: flag('STORYFORGE_AI_STUDENT_GENERAL'),
    aiClinicalMentor: flag('STORYFORGE_AI_CLINICAL_MENTOR'),
    aiClinicalStudent: flag('STORYFORGE_AI_CLINICAL_STUDENT'),
  }),
  r2: Object.freeze({
    endpoint: text('STORYFORGE_R2_ENDPOINT'),
    region: text('STORYFORGE_R2_REGION', 'auto'),
    bucket: text('STORYFORGE_R2_BUCKET'),
    accessKeyId: text('STORYFORGE_R2_ACCESS_KEY_ID'),
    secretAccessKey: text('STORYFORGE_R2_SECRET_ACCESS_KEY'),
    signedUrlTtlSeconds: boundedInteger('STORYFORGE_R2_SIGNED_URL_TTL_SECONDS', 300, 60, 900),
  }),
  transcription: Object.freeze({
    provider: text('STORYFORGE_TRANSCRIBE_PROVIDER', 'none').toLowerCase() || 'none',
  }),
});

export function validateConfig() {
  const errors = [];
  if (!config.publicDir.startsWith(`${config.packageDir}${path.sep}`)) {
    errors.push('STORYFORGE_STATIC_DIR must stay inside the StoryForge package');
  }
  if (!config.databaseUrl) errors.push('STORYFORGE_DATABASE_URL is required');
  if (!config.devAuth && !config.jwksUrl && !config.jwtSecret) {
    errors.push('production auth requires STORYFORGE_JWKS_URL or STORYFORGE_JWT_SECRET');
  }
  if (!config.devAuth && !config.jwksUrl && config.jwtSecret && config.jwtSecret.length < 32) {
    errors.push('STORYFORGE_JWT_SECRET must contain at least 32 characters');
  }
  if (config.devAuth && config.devJwtSecret.length < 24) {
    errors.push('STORYFORGE_DEV_JWT_SECRET must contain at least 24 characters');
  }
  if (!config.jwtIssuer) errors.push('STORYFORGE_JWT_ISSUER is required');
  if (!originOf(config.publicOrigin)) errors.push('STORYFORGE_PUBLIC_ORIGIN must be an absolute URL');
  if (!originOf(config.matrixBaseUrl)) errors.push('STORYFORGE_MATRIX_BASE_URL must be an absolute URL');
  if (!config.devAuth && config.allowedOrigins.length === 0) {
    errors.push('STORYFORGE_ALLOWED_ORIGINS must pin at least one Matrix origin');
  }
  if (!config.devAuth && !config.originApiOnly) {
    errors.push('production requires STORYFORGE_ORIGIN_API_ONLY=true');
  }
  if (!config.devAuth && config.basePath !== '/storyforge/') {
    errors.push('production requires STORYFORGE_BASE_PATH=/storyforge/');
  }
  if (config.devAuth && config.host !== '127.0.0.1') {
    errors.push('local fixture auth must bind STORYFORGE_HOST to 127.0.0.1');
  }
  if (config.transcription.provider !== 'none') {
    errors.push(
      'STORYFORGE_TRANSCRIBE_PROVIDER must remain none until provider authority is amended',
    );
  }
  return errors;
}

export function isAudioConfigured() {
  const values = [
    config.r2.endpoint,
    config.r2.bucket,
    config.r2.accessKeyId,
    config.r2.secretAccessKey,
  ];
  return values.every(Boolean);
}
