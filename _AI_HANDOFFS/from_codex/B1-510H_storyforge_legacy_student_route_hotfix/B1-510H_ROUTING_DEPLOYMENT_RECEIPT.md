# B1-510H Routing Deployment Receipt

## Scope deployed

Only these existing SSO seam files were deployed to WordPress:

- `wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php`
- `wp-content/plugins/missionmed-storyforge-sso/assets/matrix-launch.js`

Current production SHA-256 values:

- PHP: `ec43265a3345f7084cececd9df21bab1506492733a70f34bee3c137e2255ae2a`
- JavaScript: `fd96fc1e3c81135d31addc0ae9d354083e3db7a7268111193cb88845de91105c`

Ownership remained `theresidencyacademy:www-data` and mode remained `0644`.
Pre-change bytes are sealed in the B1-510H recovery point.

## Cache-bounded correction

The old adapter URL with `?ver=0.1.0` remained a Cloudflare cache hit after the
new file reached origin. The SSO plugin version constant and header were changed
only from `0.1.0` to `0.1.1`, producing a new asset URL. That URL returned the
exact deployed JavaScript hash with a cache miss. No broad cache purge occurred.

## Result

- a current entitled student passes the existing trusted, verified, active
  entitlement gate;
- administrators and mentors retain their existing allowlist boundary;
- an initial Matrix `#storyforge` entry redirects immediately to
  `/storyforge/`;
- refresh remains on the canonical StoryForge application;
- ineligible and anonymous access remain denied.

The current StoryForge UI/release bundle and Railway backend were not deployed
or changed. The live release remains `v-a790ce4e3168384f`; Railway remains on
deployment `d5b98049-e24e-45e7-8c1f-6c6dbaef0714`.
