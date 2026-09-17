# D1-405 Future Admin Theme Package

Status: local integration seam only
Production admin backend: not implemented
Runtime activation: not authorized

## Purpose

This contract makes the five-theme runtime extensible without changing the
current catalog or accepting executable styling. The five frozen themes and
Advanced Studio remain the only active product choices.

## Package contract

- Schema: `1.0`
- Renderer compatibility: explicit minimum and maximum semantic versions
- Package and theme IDs: lowercase hyphenated identifiers
- Versioning: semantic version; replacement imports must advance the prior
  version
- Theme definition: structured board, axis, ticks, label, ink, category,
  flag, shadow, headline, and geometry tokens
- Board kinds: flat, linear gradient, or radial gradient
- Asset manifest: ID, approved image MIME type, SHA-256, and byte count
- Allowed asset MIME types: PNG, JPEG, WEBP
- Preview contract: `D1-405-ADMIN-THEME-PREVIEW-REQUEST-V1`
- Renderer: the canonical `D1-UXR-002-Keynote-Classic` renderer
- Safe fallback: `keynote-classic`

## Security and authority boundaries

- Import requires `timeline.theme.manage`.
- Assets require an injected approval/integrity resolver.
- CSS, JavaScript, HTML, code strings, executable assets, `javascript:`
  values, and `url(...)` values are rejected.
- The local seam makes no external API call and performs no production write.
- No arbitrary CSS/JS uploader exists.
- No production admin backend, permission service, asset CDN, or runtime theme
  activation is claimed.

## Source and tests

- Contract and registry:
  `packages/mission-timeline/web/js/uxr-002/admin-theme-registry.js`
- Verification:
  `packages/mission-timeline/tests/d1-405-admin-theme-registry.test.mjs`

The tests cover schema validation, executable-content rejection, renderer
compatibility, permission denial, asset approval and digest binding, version
advance, frozen-theme preservation, unknown-theme fallback, and local-only
preview generation.
