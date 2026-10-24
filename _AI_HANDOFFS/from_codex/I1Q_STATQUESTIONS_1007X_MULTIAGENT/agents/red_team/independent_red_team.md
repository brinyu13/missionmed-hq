# I1Q-1007X Final Independent Red-Team Verification

Verdict: `STATE A CLEAR QUALIFIED ONLY`; `STATE B VETO`; `STATE C VETO`; `STATE D VETO`.

Final exact checkpoint: `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`
Repair checkpoint: `e9e807c4803bf4483c90125ace91793489596b81`
Remote branch: `i1q-question-platform-ultra-1007x-ma` at the same final object
Final diff-only range: `65bb52c4bd14d6d20145e666e3b95b6109dfef83..ba17e22b0fe8a48a7397557ef95d2ceb454970d4`
Historical High checkpoints: `8e3f96b826923d394f19735b87725aceacaeff7c`, `2d28d0b271b637f68358fd4aae414aa2f708c63f`, `65bb52c4bd14d6d20145e666e3b95b6109dfef83`
Date: `2026-07-15`

Both `65bb52c` and `ba17e22` were exported with `git archive` and tested outside the working tree. This audit makes no deployment, auth, browser, accessibility, monitoring, or protected-consumer claim.

## Finding Dispositions

| Finding | Severity | Final disposition at `ba17e22` | Basis |
| --- | --- | --- | --- |
| IRT-002 | `HIGH` | `CLOSED` | Class C remains closed-world and omits `misconception_id`; focused adapters plus Class C pass `48/48`. |
| IRT-003 | `HIGH` | `CLOSED` | `src/platform.mjs` is unchanged; the exact package suite retains protected-review positive and denied-path coverage. |
| IRT-004 | `HIGH` | `QUALIFIED` accepted residual | The 97-source State A evidence remains a point-in-time aggregate with no row manifest and no independent Git recomputability. |
| IRT-009 | `HIGH` | `CLOSED` | All four preserved historical Class D-in-Class C bypasses fail closed in the final exact bytes before hashing or insertion. |
| IRT-010 | `HIGH` | `CLOSED` | All `44/44` checksum records match exact final Git-object paths, byte counts, and SHA-256 values. |

No new `CRITICAL` or `HIGH` finding exists at `ba17e22`. All historical findings retain `HIGH` severity; none was downgraded.

## Historical IRT-009 Highs

1. `IRT-009-H1` at `8e3f96b`: mixed-case source-ID base64/base64url bypassed Node isolation in all four prose families (`8/24` accepted).
2. `IRT-009-H2` at `8e3f96b`: SQL accepted an identifier embedded in prose and missed an embedded percent-encoded Class D marker.
3. `IRT-009-H3` at `2d28d0b`: double URL encoding bypassed one-pass Node decoding (`28` total identifier/marker bypasses); a targeted payload received artifact and manifest hashes.
4. `IRT-009-H4` at `65bb52c`: SQL lowercased only before percent decoding. `%53ource_%4Dixed%43ase` decoded to `Source_MixedCase`, while the release identifier comparator remained `source_mixedcase`. Independent artifact attacks were accepted and hashed in `explanation`, `correct_answer_rationale`, `why_tempting`, and `why_wrong`: `4/4` metadata rows and `4/4` payload rows persisted. The checkpoint's then-current PostgreSQL suite still passed `13/13` because it lacked this vector.

These are preserved at severity `HIGH` and marked closed only by final exact-object results.

## Final Closure

The Node release-linked derivation, canonical/lowercase raw/percent/base64/base64url variants, all four prose families, structured markers, bounded iterative decoding, pre-hash validation, and non-echoing `422` behavior are unchanged from the prior closure. Exact final package and focused suites remain green.

`e9e807c` changes only `normalize_security_text`: it lowercases after every percent-decoding round and again after final NFKC. At `ba17e22`, the historical vector normalizes to `source_mixedcase`. Artifact-level replay blocks all four prose-family attacks with non-echoing SQLSTATE `42501` (`channel_artifact_class_d_value_leak`) and persists zero metadata or payload rows.

Independent PostgreSQL 16.13 closure matrix against the exact final archive:

- Mixed-case direct identifiers, seven families by four fields: `28/28` detected.
- Mixed-case base64: `28/28` detected; mixed-case base64url: `28/28` detected.
- Iterative identifiers: `112/112` detected; iterative markers: `16/16` detected (`128/128` combined).
- Depth 8 normalizes to lowercase and is detected; depth 9 raises SQLSTATE `54000`; 65,537 bytes raises SQLSTATE `54000`.
- Denied matrix persistence: `0` metadata rows and `0` payload rows.

The Class A/C scan remains before `calculated_hash` and both artifact inserts. The SQL diff has only three normalization-line changes and no grant, revoke, RLS, policy, feature-flag, gate-predicate, or release-policy change. Forced-RLS, deny-by-default, disabled-gate, apply/reapply, compensation, and retained-history tests pass.

## Exact Results

- `git ls-remote origin refs/heads/i1q-question-platform-ultra-1007x-ma`: `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`.
- `git diff --name-status 65bb52c ba17e22`: 22 modified paths, limited to candidate SQL, two migration tests, and refreshed evidence.
- `env -u I1Q_POSTGRES_TEST_URL npm test`: `228` discovered, `227` pass, `0` fail, `1` intentional PostgreSQL-gated skip.
- `node --test tests/adapters-security.test.mjs tests/exports-class-c.test.mjs`: `48` pass, `0` fail, `0` skip.
- Fresh UTF-8 PostgreSQL 16.13 `tests/postgres-migration.test.mjs`: `13` pass, `0` fail, `0` skip.
- `npm run validate`: `20/20` files, `0` errors, claimed state `STATE_A`.
- Exact Git-object checksum audit: `44/44` unique path/byte/hash matches, `0` stale or missing.
- `jq empty red_team_findings.json`: valid JSON.

## IRT-004 Qualification

`inventory_report.json` still declares `POINT_IN_TIME_AGGREGATE`, `row_manifest_retained=false`, and `independently_recomputable_from_git=false`, with a nonempty dated qualification. It reports 97 authorized sources and 97 registry rows, but no row manifest exists in Git. State A is therefore clear only with this accepted residual.

## State Verdict

| State | Verdict |
| --- | --- |
| State A | `CLEAR QUALIFIED ONLY` |
| State B | `VETO` |
| State C | `VETO` |
| State D | `VETO` |

Final decision: `STATE A CLEAR QUALIFIED ONLY; STATE B VETO; STATE C VETO; STATE D VETO`.
