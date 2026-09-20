# Local harness (evidence only; never deploy)

Real WordPress 7.1.1 on SQLite with the PHP 8.4 built-in server, a stub `missionmed-hub` plugin whose File Vault classes have the same names and static method shapes as the real ones, and three Node stubs: RISE (real route shapes, fictional programs), an OpenAI Responses protocol stub (good, hallucinate-once, hallucinate-always and bad-model modes) and a file server standing in for File Vault storage. Paths are hard-coded to the sandbox (`/home/claude/wpdev`).

- `e2e-api.mjs`: 99 API-level checks. Gate and namespace disclosure, RISE transport, bundle exclusions, File Vault read and refusals, privacy gate (File Vault and pasted text), generation, validators, region-change refusal, save, download, user isolation, CSRF, blast radius, kill switches, corrupted-file and missing-file containment, degraded dependencies, simulator. Result: `e2e-api-results.json`.
- `unit-validators.php`: 21 validator, redaction and evidence scenarios taken from the adversarial review. Result: `unit-validators-results.txt`.
- `e2e-ui.cjs`: 20 browser checks with Playwright, producing `../screenshots/`. Result: `e2e-ui-results.json`.

Every program, person and fact in the stubs is fictional. No real student data and no real credential was used anywhere. SQLite was the test database, so MySQL behaviour was checked by analysis only.
