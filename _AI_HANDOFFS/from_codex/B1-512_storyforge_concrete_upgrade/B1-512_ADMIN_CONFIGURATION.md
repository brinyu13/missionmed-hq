# B1-512 Administrator configuration

## Result

The existing Administrator View now contains one bounded **Content & Display** editor. It changes only approved taxonomy labels/order/state, five approved section titles/helpers/modes, and Interview Prep visibility. It does not create a second renderer or alter identity, entitlements, privacy, voice, or routing.

## Enforcement

- Stable taxonomy IDs preserve historical story values.
- New values are server-validated; hidden/retired values cannot be newly selected.
- Publish and restore are optimistic-versioned and audited.
- Submission requirements are enforced by PostgreSQL, not only the browser.
- `STORYFORGE_CONTENT_DISPLAY_FORCE_OFF=1` is the independent default-closed kill switch.
- Migration: `20260806190000_b1_512_concrete_configuration_media.sql`.

Unit, PostgreSQL, browser, and conformance evidence all pass. Production activation remains blocked on the fresh provider/Kinsta backup gate described in the deployment handoff.
