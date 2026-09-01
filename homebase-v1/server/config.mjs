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

const staticDirSetting = text('HOMEBASE_STATIC_DIR', 'public');
const staticDir = path.resolve(packageDir, staticDirSetting);
const publicOrigin = text('HOMEBASE_PUBLIC_ORIGIN', 'http://127.0.0.1:4190');
const providerPort = boundedInteger('PORT', 4190, 1, 65535);
const requestedDevAuth = flag('HOMEBASE_DEV_AUTH');
const providerRuntime = [
  'RAILWAY_ENVIRONMENT', 'RAILWAY_ENVIRONMENT_ID', 'RAILWAY_PROJECT_ID',
  'RAILWAY_SERVICE_ID', 'RAILWAY_REPLICA_ID', 'RAILWAY_STATIC_URL',
].some((name) => text(name) !== '');
const devAuth = requestedDevAuth && !providerRuntime;

export const config = Object.freeze({
  packageDir,
  publicDir: staticDir,
  port: boundedInteger('HOMEBASE_PORT', providerPort, 1, 65535),
  host: text('HOMEBASE_HOST', devAuth ? '127.0.0.1' : '0.0.0.0'),
  databaseUrl: text('HOMEBASE_DATABASE_URL'),
  publicOrigin,
  basePath: normalizedBasePath(text('HOMEBASE_BASE_PATH', devAuth ? '/' : '/homebase/')),
  matrixBaseUrl: text('HOMEBASE_MATRIX_BASE_URL', `${originOf(publicOrigin)}/member-dashboard/`),
  originApiOnly: flag('HOMEBASE_ORIGIN_API_ONLY', !devAuth),
  wpBootstrapPath: text(
    'HOMEBASE_WP_BOOTSTRAP_PATH',
    '/wp-admin/admin-ajax.php?action=missionmed_homebase_bootstrap',
  ),
  wpTokenPath: text('HOMEBASE_WP_TOKEN_PATH', '/wp-json/missionmed/v1/homebase/token'),
  allowedOrigins: Object.freeze(csv('HOMEBASE_ALLOWED_ORIGINS', originOf(publicOrigin))),
  tokenRefreshSkewSeconds: boundedInteger('HOMEBASE_TOKEN_REFRESH_SKEW_SECONDS', 15, 1, 120),
  jwtIssuer: text('HOMEBASE_JWT_ISSUER'),
  jwtAudience: text('HOMEBASE_JWT_AUDIENCE', 'homebase'),
  jwksUrl: text('HOMEBASE_JWKS_URL'),
  jwtSecret: text('HOMEBASE_JWT_SECRET'),
  devAuth,
  requestedDevAuth,
  providerRuntime,
  devJwtSecret: text('HOMEBASE_DEV_JWT_SECRET'),
  premiumMotion: flag('HOMEBASE_PREMIUM_MOTION'),
  betaBadge: flag('HOMEBASE_BETA_BADGE', true),
});

export function validateConfig() {
  const errors = [];
  if (config.requestedDevAuth && config.providerRuntime) {
    errors.push('HOMEBASE_DEV_AUTH is forbidden in provider environments');
  }
  if (!config.publicDir.startsWith(`${config.packageDir}${path.sep}`)) {
    errors.push('HOMEBASE_STATIC_DIR must stay inside the HomeBase package');
  }
  if (!config.databaseUrl) errors.push('HOMEBASE_DATABASE_URL is required');
  if (!config.devAuth && !config.jwksUrl && !config.jwtSecret) {
    errors.push('production auth requires HOMEBASE_JWKS_URL or HOMEBASE_JWT_SECRET');
  }
  if (!config.devAuth && !config.jwksUrl && config.jwtSecret && config.jwtSecret.length < 32) {
    errors.push('HOMEBASE_JWT_SECRET must contain at least 32 characters');
  }
  if (config.devAuth && config.devJwtSecret.length < 24) {
    errors.push('HOMEBASE_DEV_JWT_SECRET must contain at least 24 characters');
  }
  if (!config.jwtIssuer) errors.push('HOMEBASE_JWT_ISSUER is required');
  if (!originOf(config.publicOrigin)) errors.push('HOMEBASE_PUBLIC_ORIGIN must be an absolute URL');
  if (!originOf(config.matrixBaseUrl)) errors.push('HOMEBASE_MATRIX_BASE_URL must be an absolute URL');
  if (!config.devAuth && config.allowedOrigins.length === 0) {
    errors.push('HOMEBASE_ALLOWED_ORIGINS must pin at least one Matrix origin');
  }
  if (!config.devAuth && !config.originApiOnly) {
    errors.push('production requires HOMEBASE_ORIGIN_API_ONLY=true');
  }
  if (!config.devAuth && config.basePath !== '/homebase/') {
    errors.push('production requires HOMEBASE_BASE_PATH=/homebase/');
  }
  if (config.devAuth && config.host !== '127.0.0.1') {
    errors.push('local fixture auth must bind HOMEBASE_HOST to 127.0.0.1');
  }
  return errors;
}
