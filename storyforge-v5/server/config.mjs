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

export const config = Object.freeze({
  packageDir,
  publicDir: path.join(packageDir, 'public'),
  port: boundedInteger('STORYFORGE_PORT', 4180, 1, 65535),
  host: text('STORYFORGE_HOST', flag('STORYFORGE_DEV_AUTH') ? '127.0.0.1' : '0.0.0.0'),
  databaseUrl: text('STORYFORGE_DATABASE_URL'),
  publicOrigin: text('STORYFORGE_PUBLIC_ORIGIN', 'http://127.0.0.1:4180'),
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
});

export function validateConfig() {
  const errors = [];
  if (!config.databaseUrl) errors.push('STORYFORGE_DATABASE_URL is required');
  if (!config.devAuth && !config.jwksUrl && !config.jwtSecret) {
    errors.push('production auth requires STORYFORGE_JWKS_URL or STORYFORGE_JWT_SECRET');
  }
  if (config.devAuth && config.devJwtSecret.length < 24) {
    errors.push('STORYFORGE_DEV_JWT_SECRET must contain at least 24 characters');
  }
  if (!config.jwtIssuer) errors.push('STORYFORGE_JWT_ISSUER is required');
  if (config.devAuth && config.host !== '127.0.0.1') {
    errors.push('local fixture auth must bind STORYFORGE_HOST to 127.0.0.1');
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
