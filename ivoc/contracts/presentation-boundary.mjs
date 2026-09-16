export const FORBIDDEN_PRESENTATION_IMPORTS = Object.freeze([
  /(?:^|\/)ivoc\/core(?:\/|$)/u,
  /(?:^|\/)ivoc\/transport(?:\/|$)/u,
  /(?:^|\/)ivoc\/analytics\/detectors?(?:\/|$)/u,
  /(?:^|\/)ivoc\/media\/storage(?:\/|$)/u,
]);

function importSpecifiers(source) {
  const found = [];
  const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/gu;
  for (const match of source.matchAll(pattern)) found.push(match[1]);
  return found;
}

export function presentationBoundaryViolations(relativePath, source) {
  if (typeof relativePath !== 'string' || !relativePath.startsWith('ivoc/ui/')) {
    throw new TypeError('presentation boundary requires an ivoc/ui path');
  }
  if (typeof source !== 'string') throw new TypeError('presentation source must be text');
  const adapter = relativePath.includes('/adapters/');
  const violations = [];
  for (const specifier of importSpecifiers(source)) {
    const normalized = specifier.replaceAll('\\', '/');
    if (FORBIDDEN_PRESENTATION_IMPORTS.some((rule) => rule.test(normalized))) {
      violations.push({ specifier, reason: 'capability implementation import' });
    } else if (!adapter && /(?:^|\/)ivoc\/contracts(?:\/|$)/u.test(normalized)) {
      violations.push({ specifier, reason: 'component bypasses view-model adapter' });
    }
  }
  return violations;
}

export function assertPresentationBoundary(files) {
  if (!Array.isArray(files)) throw new TypeError('presentation files must be an array');
  const violations = files.flatMap(({ path, source }) => presentationBoundaryViolations(path, source)
    .map((violation) => ({ path, ...violation })));
  if (violations.length) {
    throw new Error(`presentation capability boundary violated: ${JSON.stringify(violations)}`);
  }
  return true;
}
