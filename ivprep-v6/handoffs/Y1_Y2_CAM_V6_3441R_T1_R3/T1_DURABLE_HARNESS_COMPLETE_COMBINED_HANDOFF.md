# Y1-Y2-CAM-V6-3441R-T1-R3 Durable Harness Handoff

## Terminal target

`T1 DURABLE HARNESS READY - FOUNDER PHYSICAL TEST MAY RESUME`

At candidate freeze, the zero-provider implementation and its physical-test preparation are complete. The terminal target becomes effective after the exact candidate is committed, non-force pushed, verified remotely, and its publication lease is released.

## Canonical inputs

- Product base: `008f7f60d7a2b2c70e25a0794f5bfb9398ebf33a`
- MissionMed OS authority: `3f5c48f40b1e645bd25977bc76f333d6d99a747e`
- Authority: DR-098/099
- Supabase coordination project: `brxqytrfdisrgakrxkhd`
- Product scope: `PRODUCT:IV-PREP-ON-CALL`
- Sole authorized LemonSlice agent: `agent_9bdfc50ec0086043`
- Paid Test #1 authorization remains unconsumed by this implementation transaction.

## Durable behavior

The Founder harness starts with the product lease `NOT_ACQUIRED` and with paid controls disabled. The Founder explicitly starts the keeper. The keeper acquires one exact 14-path product lease, heartbeats it every 5 seconds, and waits for at least 30 stable seconds before emitting `READY`. The harness cannot authorize or start Test #1 before that state.

The keeper has no provider imports or provider endpoints. It never automatically reacquires after loss. Heartbeat denial, stale process output, child exit, signal, browser transport loss, or harness shutdown converges on fail-closed cleanup. Lease loss disables paid controls and terminates the local harness; orderly exit releases the lease. Raw lease nonces and credential values are neither printed nor persisted.

## Custody chronology

- Build lease `b72ea90b-f5ba-4cc7-ad5e-3eba9822040e`, epoch 27, binding `d751c9c5aa372824ccd9212a9def0cff41eea3b04af188cdfb38c1e27c447c96`, was used for the in-scope implementation and released successfully before publication freeze.
- Publication lease `9afef4ed-383b-4c04-8bde-76e2e42b5bb2`, epoch 28, binding `d9b1eb4c8b90c35897af5ca0359ba488e31deed8a4d037623b46ca984e23b7b9`, nonce SHA-256 `6214c71193eb13f0d09c9e4931cb227047dc6160abac8baab2e0c20283672645`, was acquired by the implemented keeper itself.
- Epoch 28 reached `READY` after exactly 6 successful heartbeats and 30 stable seconds and remained continuously heartbeated during freeze and review.
- Epoch 28 must remain active through commit, non-force push, and post-push verification, then be explicitly released. This prospective release is reported externally after immutable-object verification; it is not prematurely claimed here.

## Validation

- Focused durable-harness matrix: 19 total, 19 pass, 0 fail, 0 skip.
- Full repository context: 270 total, 255 pass, 7 dependency-only failures caused by absent `ws`, 8 expected dependency skips.
- Disposable scripts-disabled install: 296 total, 296 pass, 0 fail, 0 skip; 172 packages installed in the disposable clone.
- `npm run check`: PASS; 28 analytics modules passed syntax validation.
- Real coordination stability: READY after 6 heartbeats / 30 seconds; observation continued beyond 30 heartbeat cycles without loss before candidate freeze.
- Chrome synthetic Founder QA: NOT_ACQUIRED on load, paid controls disabled; STABILIZING after explicit keeper action; READY after the gate; Authorize enabled only at READY; Start remained disabled without authorization.
- Provider sessions created: 0.
- LemonSlice credits consumed: 0.

The seven repository-context failures are not product failures. The same tree passed 296/296 after a disposable dependency install; repository `node_modules` remains absent.

## Founder launch

From `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3440/ivprep-v6`:

```sh
IVPREP_FOUNDER_TEST1_LIVE_ENABLED=true npm run start:3441r-t1-r3 -- --live-test-1
```

Open the exact `LOCAL_FOUNDER_PROOF_URL` emitted by that process in Chrome. Confirm `PROVIDER_CALLS_AT_STARTUP=0` and `LEASE_STATE=NOT_ACQUIRED`. Click `START LEASE KEEPER`, wait for `READY` and at least 30 stable seconds, then use the already authorized one-shot sequence: `AUTHORIZE TEST #1 ONCE`, followed by Start. Do not open a second harness and do not substitute another agent.

The implementation transaction deliberately stops before that paid action. No provider session was created and no credit was consumed.

## Exact implementation hashes

- Keeper: `2e47a8bc164f88da75db447da4776e0fd5cda4e7f5144df73114d7e4fa366d44`
- Harness: `52437f9526c87625bc0113fd3b14bdfe994ba9d6779699c39393496f7e546b4c`
- API client: `de2bf3b42f641642367eba6ea024ce3758336ad92a0ef1953fdbd569dc3e805e`
- Browser app: `58a7d2431af46a3e7a692a1f8749ed1df99db06e83b69d8b7a585ca229602c3b`
- HTML: `1dd77466688e69c8e0838eadc8e704c05c4a9993e2ced63ea1c85f65da53ade9`
- CSS: `e8f6d32c11c45f6a4733272146b1b7336e4bbeebe2060ff2dc820602c4992d90`
- Keeper tests: `b44ce0d2054e479c0d66d7a24561d069aed910c432336e2b3222d79a89cc15d6`
- Runtime tests: `977008e8308e4a818936bed72a754109f14f7181cc419dd1cd36b504436b1209`
- UI tests: `9ec3ddb4616f179494f5ac7ed51092fdef89985766b337282a6909f8304ed5a0`

## Still closed

This transaction does not authorize or perform database mutation, production deployment, canary or student activation, provider configuration, provider session creation, automatic paid retries, or use of Founder Test #2 or #3.
