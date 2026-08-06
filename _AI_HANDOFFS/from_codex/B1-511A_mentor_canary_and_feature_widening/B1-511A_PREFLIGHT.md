# B1-511A Preflight

Date: 2026-08-06 (America/New_York)

## Accepted baseline

- Worktree: `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`
- Branch: `codex/b1-503-storyforge-product-recovery`
- Implementation HEAD entering seal: `752d408f32c7becc9d10712e163ab86693998edc`
- Canonical live route: `https://missionmedinstitute.com/storyforge/`
- Live immutable frontend release: `v-d45ca5e899878fea`
- Kinsta release pointer: `releases/752d408f32c7becc9d10712e163ab86693998edc`
- Railway deployment: `17615414-9422-453a-9eb8-7d1b36f462a6` (`SUCCESS`, one replica)

## Scope controls

- No redesign, authentication change, ownership reassignment, entitlement rewrite, or database-schema change was performed.
- `brinyu` retained ownership of the existing seven student stories and WordPress-authorized Administrator View.
- `Brian_test` remained an additional administrator.
- The widening affected only the already-implemented student workflow flags. Mentor notes remained a two-identity controlled pilot.
- Secrets and token values are intentionally omitted from all receipts.

## Immutable release evidence

| Artifact | SHA-256 / identity |
|---|---|
| WordPress route | `e30a563cedd6e4d4fab03bbbac1bc72bfe2fbe82efbd44fdad5e6b5ea607455f` |
| Runtime PHP | `805ec783704f8be8a9ce4d7fbc593e046391464a5d0ce081ab185f87eb400ef6` |
| `index.html` | `a781895575afd34e68266a78f0e026d3d0802bc00bcd98741d0898b6143b766f` |
| App alias / SHA | `217f4d2d0f5f` / `217f4d2d0f5f3f4c95f83403efc2fd35681a87718afe8fffd25c791897e08b9c` |
| Styles alias / SHA | `409bdc5b96d7` / `409bdc5b96d7dadad4d9eda1f4c0a01a2ee8d561745f4b2439850423eee0e18c` |
| Auth alias / SHA | `d2cfc4e447d2` / `d2cfc4e447d23c2e6c164978221417a333764b33fd1dfea7cb1ae415b99118e6` |

Cloudflare reported `DYNAMIC`; Kinsta reported `BYPASS`; application responses retained `no-store` behavior. Exact public readbacks matched the release artifacts.
