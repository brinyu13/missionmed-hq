# B1-510H Identity Synchronization Design and Authority

## Binding authority

- WordPress is the identity authority.
- `mmhq_cam_build_entitlement()` is the access authority.
- LearnDash course `3893` is the canonical StoryForge 360 course.
- The Founder roster is acceptance evidence only; it is not an allowlist or a
  replacement entitlement source.
- Existing WordPress users, profiles, email addresses, usernames, roles, and
  LearnDash enrollment are immutable in this operation.

The later Founder correction supplied ten exact WordPress usernames and allowed
the existing Jukaku account to be resolved from its stored WordPress email. It
supersedes the older display-name-derived identifiers in the initial B1-510H-B
attachment. All eleven existing accounts resolved through WordPress's existing
case-insensitive login semantics; no account was created or edited.

## Operator-controlled mechanism

The synchronization is deliberately operator-controlled, not JIT and not a
background scheduler:

1. `wp-storyforge-identity-sync.php export` recomputes the canonical entitlement
   set inside WordPress and emits a private candidate file.
2. `storyforge-identity-sync.mjs dry-run` compares that candidate set with
   PostgreSQL and produces a mode-0600 plan.
3. Any invalid account, UUID collision, WordPress-ID collision, or inconsistent
   partial mapping stops the whole production write.
4. With zero blockers, the Node command inserts only missing `sf_users` rows in
   one transaction and verifies every row after `ON CONFLICT DO NOTHING`.
5. The WP-CLI command applies only the existing
   `_missionmed_storyforge_user_id` meta key from the sealed plan, after
   recomputing eligibility and conflict checks.
6. Re-running both commands performs zero writes when mappings are already
   valid.

The durable one-to-one invariant is:

`WordPress user ID <-> _missionmed_storyforge_user_id <-> sf_users.id`

## Classification contract

The dry run reports:

- `ALREADY_VALID`
- `NEEDS_WORDPRESS_UUID_ONLY`
- `NEEDS_POSTGRES_ROW_ONLY`
- `NEEDS_BOTH`
- `CONFLICTING_WORDPRESS_UUID`
- `CONFLICTING_POSTGRES_IDENTITY`
- `DUPLICATE_WORDPRESS_ID`
- `DUPLICATE_UUID`
- `INELIGIBLE`
- `INVALID_ACCOUNT`

No conflict or invalid class is writable. Existing valid mappings are preserved
without reassignment. The synchronization does not touch stories, audits,
recordings, audio, R2, transcription, voice flags, or protected Matrix source.

## Repeat operation

Future currently eligible students are synchronized by repeating the same
backup, export, dry-run, zero-conflict, apply, and verify sequence. No permanent
manual roster is retained by the implementation.
