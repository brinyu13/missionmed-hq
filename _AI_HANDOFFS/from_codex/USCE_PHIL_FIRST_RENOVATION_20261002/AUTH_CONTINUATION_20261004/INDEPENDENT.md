# Independent focused USCE auth verdict — 2026-10-04

**APPROVE WITH CONDITIONS — current bounded administrator entry → queue.** No current defect reproduced. This does not accept the paused USCE renovation.

Verifier: fresh independent usce_auth_focused_verifier; no Astra. Authoritative source HEAD d58f08fd3aa1b0c22630a3aa599f98a9f2fc4a06. AGENTS/BOOT/DR-359/360/Founder steering read; mission-profile BOOT PASS. Unrelated dirty state preserved. No source, provider, product data, case, email, account, credential or global logout changes.

## Independently checked

Current local admin SHA-256: b5bfd9743b7f71b160c5d600c525fd245920eb7a89838d70a6ce8dd40b9deaf0. Frontend uses isolated gateway, usce_admin audience, scoped WordPress relay, automatic absent/expired-session recovery and mutation CSRF.

Exact live WordPress plugin /www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-hq-auth-handoff.php independently SSH-verified SHA-256 8cfb8dadf7193c63722ab3d217f319460922324d9e12fa934c902d02a9fa1813, version 1.0.11; PHP lint PASS. Eight live-source boundary assertions PASS: administrator manage_options gate, exact HTTPS CDN host/path, fragment-only delivery, explicit nonadmin403, scoped action, dispatcher isolation, no-referrer. Source checks do not establish current real nonadmin browser acceptance.

Gateway policy current SHA-256 180e77fcd06807efcb6654285447973a844d71a88fd85aa88ad4af113a9824af matches September policy; two focused policy tests PASS. Current isolated gateway/USCE paths route through strict session validation. Nine independent current-source in-memory strict session checks PASS, including expiry, audience, identity, CSRF presence and malformed-bearer precedence.

Current source focused integrated-runtime suite: node missionmed-hq/tests/usce-runtime.test.mjs --source-root /Users/brianb/MissionMed_worktrees/usce-phil-first-renovation-20261002 — **50/50 PASS**. Covers admin queue, anonymous/subscriber rejection, expired/invalid sessions, audience isolation, CSRF before RPC, legacy WP handoff compatibility, gateway boundaries, logout cookie mechanics, no credential logs. External calls intercepted; local contracts do not prove live human login lifecycle.

Independent live anonymous probes: queue401, auth/session200 with authenticated=false/authRequired=true/sessionPersistent=true, unrelated IVOC path404. Python urllib CDN probe returned client-specific Cloudflare403; not used as serving-hash proof.

## Independent Chrome checks

Root handed exclusive Chrome ownership to verifier. Fresh normal https://missionmedinstitute.com/usce-admin/ entry, browser refresh, and second-fresh-tab direct normal revisit all PASS. WordPress shell visibly brinyu; iframe source sanctioned admin-post action mmhq_usce_admin_auth_relay targeting exact versioned CDN asset.

Loaded frame title MissionMed Clinicals HQ - Offer System; runtime **Live protected**; Cases updated banner; protected queue rendered with current filtered display count17. No raw authentication_required JSON as normal browser destination, manual token manipulation or technical recovery. This is Dr Brian's existing authenticated admin session, not fresh password/MFA or Phil-login proof. No queue records exported, case actions or cookies/storage clearing. Chrome explicitly handed back to Root.

## Root facts, attributed

Root independently reports sanctioned WP302 with fragment present/no query token; sessionPersistent=true, WP ID1/admin; queue200 pagination total94 (88real+6ownedQA). Verifier's filtered display17 is not asserted as backend total.

Root reports current Railway deployment dd1ee4ed-b06b-4049-afb8-92bdaaadf5f0 SUCCESS, live CDN admin/applicant hashes/no-store/DYNAMIC, and isolated gateway SSH exact-source parity: gateway c451…, policy180e77fc…, server3fa402…, strictsession91adfa…. These provider/full-serving parity facts are Root evidence, not independently replayed by this verifier.

Root later completed bounded live recovery under shared AUTH lease ea1dccd0-e432-46d1-9572-f4780dcbb048. On the isolated serving CDN tab, Root replaced only mm_usce_admin_bearer_session with a labeled invalid QA marker, then ordinary reload automatically reached sanctioned WordPress admin-post302, fragment bootstrap, auth/session200 authenticated=true/sessionPersistent=true/CSRF present, and queue200. The own bearer was restored by normal exchange and the fragment cleared; no raw JSON. An invalid-token session probe can return HTTP200 with authenticated=false; no401 assertion is made for that probe. Root then exercised CSRF-protected /api/auth/logout: HTTP200 authenticated=false, cleared own bearer, and ordinary reload automatically returned to the protected queue using existing WordPress authentication. These are attributed Root checks, not independently replayed by this verifier.

## Remaining acceptance limits

Root's live checks now establish invalid/absent cached-session recovery and HQ logout/re-entry with an existing authorized WordPress session. They do not establish recovery from an actually expired signed token, a fresh WordPress password/MFA login, or current real-nonadministrator browser403. Those checks were not independently repeated by this verifier. September real nonadmin and login-lifecycle evidence remains historical. Native incognito verification was interrupted by foreground user activity; no anonymous-browser acceptance is claimed. The verifier made no client auth mutation. Local tests and existing-session browser success do not close the remaining human-login/nonadmin/actual-expiry boundaries.

No repair/deployment is justified by this verification alone: reported raw-JSON failure is absent in the current exercised normal path. Paused renovation features, cleanup and broader F/U/O remain unaccepted.

## Documentation custody

Sole assigned exact new file; documentation-only PATH Lease V2, shared_domains empty, no AUTH mutation. Initial exclusive-create/no-clobber; this bounded attributed-evidence update verified its exact preimage. Fresh exact-path acquire and positive heartbeat immediately before each write; positive release proof returned to Root separately after sealing. Raw nonce/private grants stay in process memory. Root integrates Git; verifier does not commit or push.
