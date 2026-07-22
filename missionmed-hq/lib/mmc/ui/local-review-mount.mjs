import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MMC_CAM_UI_SECURITY_HEADERS,
  MMC_JSON_SECURITY_HEADERS,
  MmcHttpError,
} from '../trust/security.mjs';

export const MMC_PRIVATE_ROUTE_PREFIX = '/mmc-private';
export const MMC_CAM_V2_PUBLIC_PREFIX = `${MMC_PRIVATE_ROUTE_PREFIX}/src/cam`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CAM_PUBLIC_ROOT = path.resolve(__dirname, '../../../public/mmc-private/src/cam');
const CAM_ASSET_MIME_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
});
const OPAQUE_ROUTE_ID = '[A-Za-z0-9][A-Za-z0-9._:-]{2,199}';
const CAM_APPLICATION_PATTERNS = Object.freeze([
  new RegExp(`^${MMC_PRIVATE_ROUTE_PREFIX}(?:/(?:today|students|work))?$`, 'u'),
  new RegExp(`^${MMC_PRIVATE_ROUTE_PREFIX}/students/${OPAQUE_ROUTE_ID}(?:/(?:overview|plan|history|files|prep))?$`, 'u'),
  new RegExp(`^${MMC_PRIVATE_ROUTE_PREFIX}/students/${OPAQUE_ROUTE_ID}/history/sessions/${OPAQUE_ROUTE_ID}$`, 'u'),
  new RegExp(`^${MMC_PRIVATE_ROUTE_PREFIX}/sessions/${OPAQUE_ROUTE_ID}/(?:live|review)$`, 'u'),
  new RegExp(`^${MMC_PRIVATE_ROUTE_PREFIX}/reviews(?:/${OPAQUE_ROUTE_ID}(?:/${OPAQUE_ROUTE_ID})?)?$`, 'u'),
  new RegExp(`^${MMC_PRIVATE_ROUTE_PREFIX}/operations(?:/${OPAQUE_ROUTE_ID}(?:/${OPAQUE_ROUTE_ID})?)?$`, 'u'),
]);

export function isMmcCamV2LocalUiEnabled(options = {}) {
  const environment = String(options.environment || '').trim().toUpperCase();
  return options.isProduction !== true
    && options.enabled === true
    && ['FIXTURE', 'LOCAL'].includes(environment);
}

export async function resolveMmcCamV2LocalAsset(pathname, options = {}) {
  const normalized = String(pathname || MMC_PRIVATE_ROUTE_PREFIX).replace(/\/+$/u, '') || MMC_PRIVATE_ROUTE_PREFIX;
  const publicRoot = await realpath(options.publicRoot || DEFAULT_CAM_PUBLIC_ROOT);
  let relativePath = 'index.html';
  let isIndex = true;

  if (normalized === MMC_CAM_V2_PUBLIC_PREFIX || normalized.startsWith(`${MMC_CAM_V2_PUBLIC_PREFIX}/`)) {
    relativePath = normalized.slice(MMC_CAM_V2_PUBLIC_PREFIX.length).replace(/^\/+/, '') || 'index.html';
    isIndex = relativePath === 'index.html';
  } else if (!CAM_APPLICATION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw new MmcHttpError(404, 'MMC_CAM_ASSET_NOT_FOUND', 'The requested CAM asset is not available.');
  }

  const candidate = path.resolve(publicRoot, relativePath);
  const candidateRelative = path.relative(publicRoot, candidate);
  if (!candidateRelative || candidateRelative.startsWith('..') || path.isAbsolute(candidateRelative)) {
    throw new MmcHttpError(404, 'MMC_CAM_ASSET_NOT_FOUND', 'The requested CAM asset is not available.');
  }

  const extension = path.extname(candidate).toLowerCase();
  if ((!isIndex && !Object.hasOwn(CAM_ASSET_MIME_TYPES, extension)) || (isIndex && extension !== '.html')) {
    throw new MmcHttpError(404, 'MMC_CAM_ASSET_NOT_FOUND', 'The requested CAM asset is not available.');
  }

  let canonicalCandidate;
  try {
    canonicalCandidate = await realpath(candidate);
  } catch (error) {
    throw new MmcHttpError(404, 'MMC_CAM_ASSET_NOT_FOUND', 'The requested CAM asset is not available.', { cause: error });
  }
  const canonicalRelative = path.relative(publicRoot, canonicalCandidate);
  if (!canonicalRelative || canonicalRelative.startsWith('..') || path.isAbsolute(canonicalRelative)) {
    throw new MmcHttpError(404, 'MMC_CAM_ASSET_NOT_FOUND', 'The requested CAM asset is not available.');
  }

  const details = await stat(canonicalCandidate);
  if (!details.isFile()) {
    throw new MmcHttpError(404, 'MMC_CAM_ASSET_NOT_FOUND', 'The requested CAM asset is not available.');
  }

  return Object.freeze({
    absolutePath: canonicalCandidate,
    contentType: isIndex ? 'text/html; charset=utf-8' : CAM_ASSET_MIME_TYPES[extension],
    isIndex,
  });
}

export async function serveMmcCamV2LocalUi(response, pathname, options = {}) {
  try {
    const asset = await resolveMmcCamV2LocalAsset(pathname, options);
    response.writeHead(200, {
      ...MMC_CAM_UI_SECURITY_HEADERS,
      'Content-Type': asset.contentType,
      'X-MissionMed-Private-Mount': 'cam-v2-local-review',
      'X-MissionMed-Route': 'mmc-private',
    });
    createReadStream(asset.absolutePath).pipe(response);
  } catch (error) {
    response.writeHead(error instanceof MmcHttpError ? error.statusCode : 404, {
      ...MMC_JSON_SECURITY_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'X-MissionMed-Private-Mount': 'cam-v2-local-review',
      'X-MissionMed-Route': 'mmc-private',
    });
    response.end(JSON.stringify({
      error: 'mmc_cam_asset_not_found',
      message: 'The requested CAM asset is not available.',
    }));
  }
}
