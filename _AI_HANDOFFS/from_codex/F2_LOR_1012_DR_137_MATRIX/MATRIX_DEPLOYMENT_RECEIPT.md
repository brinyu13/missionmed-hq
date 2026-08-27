# F2-LOR-1012 DR-137 Matrix Dark Deployment Receipt

- Ticket: `F2-LOR-1012-DR137`
- Authority: DR-137 canonical Matrix shared launch-seam authority
- Deployment UTC: `2026-08-27T07:56:14Z`
- Final source commit: `4275274071c7c3c9ee8507527c5d8fcaa2ea93d5`
- Final source tree: `662004b08e82e39fe1a1943159f768fac76beb27`
- Remote ref: `origin/codex/f2-lor-1012-dr137-matrix`
- Transaction: `matrix-lor-final-correction-and-dark-deploy`
- Lease: `SHARED:MATRIX-SHELL`, fencing epoch `344`, lease `f7dd7a4a-5a66-4e81-96ba-0cd63f76fa05`
- Exposure state: dark

## Production result

| Production path | Final SHA-256 | Mode / owner |
|---|---|---|
| `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub/assets/student-os.js` | `30068939fc54fb4a21209de4962977b9aa1a89a9557a046d367b1737624c570b` | `0644`, `1000:33` |
| `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub/assets/student-os.30068939fc54fb4a.js` | `30068939fc54fb4a21209de4962977b9aa1a89a9557a046d367b1737624c570b` | `0644`, `1000:33` |
| `/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-matrix-lor-studio-entry.php` | `ab87e7272aebdf44f82e640f2d0f7f08111caae67f339c874e9ab85eedf08721` | `0644`, `1000:33` |

The immutable artifact is new and was never overwritten. The mutable source mirror and controller were uploaded to exact staging names, hash/lint checked, and atomically renamed. All staging files and the two rejected, never-deployed immutable candidates (`56c7c339...` and `b1c8239b...`) are absent.

The exact production WordPress readback after redeploy was:

```text
mode=off
asset=student-os.30068939fc54fb4a.js
allowed=false
contract_enabled=false
filevault_mode=on
filevault_beta_count=0
```

Therefore the new Matrix shell is installed and production-selected, but LOR Studio is hidden from every Matrix user. The WordPress entitlement contract remains inert and no student, mentor, faculty member, recommender, administrator, or canary was admitted by this transaction.

## Public and 20-asset lock proof

- New immutable origin/public SHA-256: `30068939fc54fb4a21209de4962977b9aa1a89a9557a046d367b1737624c570b` / same.
- Mutable origin/public SHA-256: `30068939fc54fb4a21209de4962977b9aa1a89a9557a046d367b1737624c570b` / same.
- Controller local/origin SHA-256: `ab87e7272aebdf44f82e640f2d0f7f08111caae67f339c874e9ab85eedf08721` / same.
- Updated Matrix manifest asset count: `20`.
- Guard invocation used the worktree manifest explicitly, not the stale canonical default.
- Local source, production origin, and every applicable cache-busted public URL matched all 20 lock entries: PASS.
- File Vault remained `on` with zero beta users throughout rollback and redeploy.

## Rollback proof

Exact mutable preimage custody:

- Backup: `/www/theresidencyacademy_209/private/f2-lor-1012/dr137/student-os.preimage.js`
- SHA-256: `646e3598d284fff31d22dec98c70c1800e74743276872bb65f1afeeda1c17e5a`

The rollback drill restored that preimage atomically and removed the new MU controller. Production WordPress then reported:

```text
lor_controller_loaded=false
asset=student-os.809093d2b5b2bc05.js
filevault_mode=on
filevault_beta_count=0
```

The successor immutable remained inert and unchanged. Redeployment then restored the final three hashes and the exact dark readback above. No broad cache purge, database write, user-metadata write, entitlement mutation, or other product mutation occurred.

## Validation and review

- JavaScript Matrix LOR contract: `142/142 PASS`.
- PHP Matrix LOR contract: `86/86 PASS`.
- File Vault V2 PHP contract: `72/72 PASS`.
- File Vault V2 repository workflow: `92/92 PASS`.
- Mutable/immutable byte identity and filename-derived hash: PASS.
- PHP and JavaScript syntax: PASS.
- `git diff --check`: PASS.
- Final independent review: APPROVE; no P0/P1 source or custody findings.

The dependency-free JS contract covers inherited properties, prototype pollution, accessors, enumerable extras, non-enumerable extras, Symbol extras, administrator/module fallback denial, malicious URLs, same-tab no-referrer manual launch, sidebar referrer suppression, and complete legacy LOR renderer/API removal.

Local APFS pressure temporarily prevented a PHP fixture directory from being created. Six exact completed and stopped disposable DR-133 PostgreSQL temp clusters were removed only after non-symlink and no-process/no-open checks. No repository, evidence, credential, or production path was removed. The exact PHP contract was then rerun successfully at `86/86` before deployment.

## Truthful remaining gate

This receipt proves dark installation and rollback safety, not live LOR availability or AAA completion. Exposure remains prohibited until the exact signed OpenAI zero-data-retention attestation can be bound and the separately authorized consent/canary provisioning path exists. OpenAI currently returns that the organization has no retention setting and directs the account owner to Support; no attestation has been fabricated.

Epoch `344` must remain held through the exact manifest/evidence commit and remote-exact push, then be released normally with provider-native readback.
