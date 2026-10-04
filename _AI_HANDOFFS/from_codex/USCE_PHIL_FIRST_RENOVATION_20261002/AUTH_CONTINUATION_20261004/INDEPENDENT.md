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

Root additional live evidence, 2026-10-04 approximately17:17UTC, under AUTH lease d2641d63-286d-45bf-80b0-1d38381f9991 (released=true): retained authentic signed WordPress handoff from an actual prior relay trace, naturally past its short expiry, was placed only in the isolated CDN tab's own cached bearer slot, followed by ordinary reload. Raw credential stayed solely in CUA process memory. Network showed two /api/auth/session HTTP200 probes, scoped mmhq_usce_admin_auth_relay302, then protected queue200. Post-recovery probe explicitly authenticated=true/sessionPersistent=true; fixture replaced, hash cleared, test tab closed. Initial session response bodies were unavailable after navigation, so no initial payload or401 is asserted. This demonstrates automatic recovery when the cache contains a naturally expired signed WordPress handoff. A WordPress handoff is a different credential class from the HQ-issued encrypted eight-hour session; this result does not prove HQ-issued session expiry handling in a live browser. These facts are Root-attributed, not independently replayed here.

## 2026-10-04 current human-provided role sessions

Founder reported signing into the main Chrome administrator session and an Incognito student session, ready for checks. Password/MFA entry itself was human-reported, not witnessed by an agent. Root reports current Incognito tab315031855 was labeled Incognito and displayed a logged-in member dashboard before ordinary navigation to /usce-admin/. That current student journey displayed 'USCE administrator access is required.', scoped mmhq_usce_admin_auth_relay network403, no protected queue and no raw authentication JSON. This is current real-browser nonadministrator evidence attributed to Root, not a historical/source-only assertion.

After explicit exclusive Chrome handover, this verifier independently opened fresh normal main-Chrome tab315031876 at /usce-admin/. WordPress shell visibly brinyu; protected application title MissionMed Clinicals HQ - Offer System, runtime Live protected, Cases updated banner, queue rendered, no raw auth JSON. Ordinary refresh independently PASS again with the same protected queue signals. No account, credential, cookie/storage, source/provider or business changes; no case actions or private queue export. Chrome explicitly handed back afterward.

The verifier could not independently bind/read the already Root-owned Incognito student tab: supported cua.getTab and browser.user.claimTab returned ownership conflict, while browser.tabs.get had no such owned tab. User inventory confirmed that tab's normal USCE URL/title only; those metadata do not prove role or403. No native fallback or ownership bypass was attempted. Current student denial is therefore Root-observed, not independently replayed by this verifier. A transient old main-tab control timeout was Root-reported; own fresh entry/refresh passed, so no application outage is inferred from that control timeout.

Root also issued a read-only browser GET from the existing student tab to its already observed scoped WordPress relay URL with credentials omitted and redirects followed. Result: HTTP200, redirected=true, final path /wp-login.php, password form present, rawAuthJSON=false. No cookie/storage/session changes or HTML/nonce/token export. This is actual browser anonymous-request redirect/login-form proof attributed to Root; it is not a separate top-level anonymous UI navigation and was not independently replayed by this verifier.

## Remaining acceptance limits

Root's live checks establish invalid/absent cached-session recovery, HQ logout/re-entry and naturally expired WordPress handoff cache recovery. Current Founder-provided role sessions additionally establish independent current main-admin entry/refresh and Root-observed real student browser403. Fresh password/MFA interaction is Founder-reported, not agent-witnessed. Independent replay of the current real student403 is limited by supported browser ownership conflict, not a reproduced authorization failure. Actual expiry of an HQ-issued encrypted session remains untested: Root's earliest captured session expires2026-10-04T23:10:14.938Z, after the role/recovery tests. September results remain historical. Root browser anonymous-request redirect/login-form proof is now observed; no separate top-level anonymous UI acceptance is claimed. No full terminal browser contract or renovation acceptance is declared.

No repair/deployment is justified by this verification alone: reported raw-JSON failure is absent in the current exercised normal path. Paused renovation features, cleanup and broader F/U/O remain unaccepted.

## Documentation custody

Sole assigned exact new file; documentation-only PATH Lease V2, shared_domains empty, no AUTH mutation. Initial exclusive-create/no-clobber; this bounded attributed-evidence update verified its exact preimage. Fresh exact-path acquire and positive heartbeat immediately before each write; positive release proof returned to Root separately after sealing. Raw nonce/private grants stay in process memory. Root integrates Git; verifier does not commit or push.
