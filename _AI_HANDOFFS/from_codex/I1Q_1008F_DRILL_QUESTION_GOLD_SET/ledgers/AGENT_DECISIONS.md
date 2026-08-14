# Agent Decisions

| Decision | Owner | Result | Evidence |
|---|---|---|---|
| Continue rather than restart after storage interruption | Supervisor | Accepted | I1Q-1008F-R |
| Recover storage only from verified disposable files and cache contents | Sentinel | Accepted | `evidence/storage-recovery-receipt.json` |
| Keep restricted corpus local and owner-only | Sentinel | Accepted | 1008F boundary modes and zero Drive uploads |
| Pin 070B as accepted Drills v3 runtime owner | Herschel | Accepted | Runtime artifact hash `d14aab…2f6` |
| Use live detector as comparison evidence, not Gold truth | Supervisor, Herschel | Accepted | Proven 071 loss points and missing semantic grouping |
| Preserve ordered per-drill sequences; prohibit global deduplication | Lorentz | Accepted | Restricted shard and semantic-invariant design |
| Use content-addressed shards and verified-shard truth for resume | Darwin, Lorentz | Accepted | Recovery/resume design |
| Process one drill at a time with a 10 GiB runtime reserve | Darwin, Sentinel | Accepted | Storage gate and no-copy streaming design |
| Keep verbatim text, aliases, locators, and answer mappings outside Git | Sentinel, Lorentz | Accepted | Restricted execution decision |
| Reject contract `6582fbbf…` despite complete structural validation | Supervisor, Osler, Sagan | Accepted | Sagan found 14/97 sampled exclusion false negatives; Osler measured 86/93 (924,731 ppm), below the 950,000 ppm precision gate |
| Preserve every rejected complete generation content-addressably | Supervisor, Darwin | Accepted | Supersession receipt `4ad1dcb9…`; no restricted generation was deleted |
| Repair recall and precision together before final certification | Supervisor, Turing | Accepted | Short/elliptical answer slots require bounded recovery while study, meta, coaching, and rhetorical prompts require subtractive exclusions |
| Freeze contract `de31610d…` and shard root `4d906f38…` | Supervisor | Accepted | 97/97 completion, clean no-op resume, Osler PASS, Sagan PASS, Turing PASS |
| Permit one governance locator only in the filed cleanup decision | Supervisor, Sentinel | Accepted | Required protected-path control; zero content, identity, artifact, question, or media locators |
| Keep ambiguity-marked questions restricted | Supervisor, Osler | Accepted | 10,123 questions remain engineering-valid but not physician-approved or releasable |
