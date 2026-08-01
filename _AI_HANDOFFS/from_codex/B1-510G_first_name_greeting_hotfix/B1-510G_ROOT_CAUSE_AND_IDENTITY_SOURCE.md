# B1-510G Root Cause and Identity Source

## Verdict

The homepage greeting used the first token of `state.user.display_name`. In the
Founder student account that trusted display value was `brinyu`, so the page
rendered `Good morning, brinyu.` even though WordPress core stores `Dr` in the
account's authoritative `first_name` field.

## Verified identity evidence

Read-only WordPress inspection before implementation established:

- WordPress user 1: login `brinyu`, display name `brinyu`, core `first_name=Dr`.
- WordPress user 107: login `Brian_test`, display name `Brian Bolante`, core
  `first_name=Brian`.
- StoryForge's PostgreSQL `first_name` values for those mapped identities were
  blank and therefore were not the WordPress profile authority requested by the
  Founder.

No WordPress profile, user metadata, display name, login, email, registration
record, StoryForge UUID, or database row was changed.

## Existing bridge and bounded correction

The existing WordPress SSO plugin remains the sole identity issuer. It now adds
the existing core `$user->first_name` and existing `$user->user_login` to the
same signed JWT that already carries display name, WordPress ID, role, and
eligibility. The server type-checks those two claims and returns them through
the existing authenticated `/api/session` response. No endpoint or identity
authority was added.

Only the student homepage greeting reads the new session fields. Its exact
priority is:

1. nonblank signed WordPress `first_name`, returned without splitting,
   normalizing, correcting, or reinterpreting it;
2. first token of the existing trusted display name;
3. existing signed WordPress login name as the final fail-safe;
4. `there` only if all trusted values are absent or blank.

Email, last name, title, StoryForge UUID, and hardcoded names are never used.
The existing `esc(firstName())` HTML-escaping sink remains unchanged.

## Exact production-source files

- `wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php`
- `storyforge-v5/server/auth.mjs`
- `storyforge-v5/server/app.mjs`
- `storyforge-v5/public/app.js`
