# P1-PRIQ-M0-002 provider activation

Date: 2026-08-02
Status: CREDENTIAL AVAILABLE AND INHERITED

## Credential authority

- Credential source: inherited MissionMed runtime process environment, `process.env.OPENAI_API_KEY`.
- Secret value: never recorded, printed, logged, hashed, encoded, copied, or written.
- Repository-local environment file: not created and not required.
- Resolver precedence: runtime environment; approved secret-provider interface; explicitly configured development-only ignored file; otherwise fail closed with `OPENAI_CREDENTIAL_HEALTH_ERROR`.
- Restricted-data authority: not granted by this activation. `MIR_OPENAI_RESTRICTED_DATA_APPROVED=true` remains required before student-provided, founder-private, MissionMed-intel, or PHI calls.

## Process inheritance

At the start of 002A, no process was listening on port 4310, so there was no running PRIQ process to classify as inherited or not inherited. The surrounding MissionMed runtime safely reported `OPENAI_API_KEY present: yes`. PRIQ was started with the existing repository launcher:

`npm run priq:dev`

The resulting PRIQ listener reported `PRIQ process OPENAI_API_KEY inherited: yes`. After the final regression pass, only that PRIQ process was restarted and the same inheritance result was confirmed. No unrelated app was restarted or terminated. No special restart procedure was required because PRIQ was not previously running.

## Health and real-call proof

- Provider health endpoint: success, HTTP 2xx, `{ configured: true }` only.
- Provider: OpenAI.
- Capability route: `extraction_fast`.
- Configured model: `gpt-5.6-luna`.
- Input: non-sensitive synthetic text only.
- Structured output: valid against `priq_provider_health` JSON Schema.
- HTTP status category: 2xx.
- Measured latency: 694 ms.
- Token usage: 64 input, 15 output.
- Estimated cost: USD 0.000154 using the route registry prices.
- Model-run ID: `f4a0183b-9856-489b-8f63-b946f3d26d09`.
- Sanitized error category: none.

The first automated attempt was stopped locally before any provider call because its synthetic fixture lacked required subject scope and used a disallowed service feature name. It incurred no provider cost. The corrected fixture used `synthetic:provider-proof` and the existing `profile` policy surface.

## Kill and release proof

After the successful structured-output run, the external AI kill switch blocked the next attempted invocation before provider execution and without adding a model run. Releasing the kill switch restored the route, and a second minimal structured-output call succeeded.

## Server-only and frontend enforcement

- `OPENAI_API_KEY` is consumed only by server-side provider/tooling/test modules and documented with a blank value in `.env.example`.
- `/health` and `/api/ui-state` return only a boolean provider configured state; `/api/profile/readiness` exposes only a boolean provider gate.
- The key is never sent to browser code or substituted into the build.
- Built-asset regression scanning checked for the actual runtime credential without printing it, authorization/Bearer material, the variable name, and secret-bearing configuration patterns: PASS.
- Automated unit tests use fake fetchers/mock credentials. Real calls require `MIR_REAL_AI_TESTS=1`.
- Provider failures exposed by the proof script are reduced to sanitized categories; headers and configuration values are not recorded.

## Commands and results

- `npm run priq:check`: PASS, including TypeScript, 26/26 tests, accessibility, frozen visual contract, build, and frontend credential scan.
- `npm run priq:test`: PASS, 26/26.
- `npm run priq:build`: PASS with frozen UI hash preserved.
- `npm run priq:secret-scan`: PASS.
- `MIR_REAL_AI_TESTS=1 npm run priq:provider-proof`: PASS.

## Remaining gate

OpenAI activation is proven only for synthetic/public-professional data. Do not process Ezechiel private files until secure intake, consent/retention, restricted-data provider posture, and the remaining P1-PRIQ-M0-002 authority gates are satisfied.

Official implementation basis: [OpenAI API key production practices](https://developers.openai.com/api/docs/guides/production-best-practices#api-keys) and [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
