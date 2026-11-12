# Clinicals HQ / USCE IQ — final acceptance sweep
Date: 2026-11-12. Authority: Founder final-sweep packet; USCE-IQ-FOUNDER-CORRECTION-20261009 / DR-413. Existing accepted November 12 renovation preserved.

## State delta
No application, authentication, provider configuration, schema or deployment changes. One authorized labeled synthetic Offer email sent through the existing authenticated Journey, exact-message approval and sanctioned send path. The approved QA intake was temporarily reviewed, then restored to archived at 17:42:41 ET. Underlying mail and audit history retained. No real applicant contacted; no acceptance, payment or placement action. No duplicate Phil notification.

| Verification | Result and current evidence |
|---|---|
| A. Delivered Offer HTML | PASS for actual Info Gmail rendering. Subject: [USCE QA TEST] Delivered Offer HTML acceptance — 2026-11-12. From MMI Clinical Rotations <clinicals@missionmedinstitute.com>; Reply-To clinicals@missionmedinstitute.com; To info@missionmedinstitute.com. Received 22:35:02 UTC. Actual MIME contains text/plain and 16,551-character text/html. Controlled student-facing text, navy treatment, five-stage progress and eight rendered links inspected. |
| Links / contrast | Actual Gmail computed link contrast 6.14–18.21:1; gold secure/contact links on navy 6.47:1; primary gold CTA 12.06:1. Review your offer opened the synthetic secure portal with visible proposed rotation and response controls; no response submitted. Tracker links point to the existing MissionMed tracker; contact links use the sanctioned Clinicals mailbox. |
| Practical narrow rendering | Browser viewport override produced 487 CSS px at current Chrome zoom; delivered email table reflowed to 434.71 CSS px. Normal viewport restored. Native Gmail mobile-client rendering was not independently tested. |
| B. USCE IQ intro | PASS in safe isolated Chrome preview of freshly fetched, byte-identical deployed HTML (SHA-256 28aa37856e9293b434dd5eff620ea037f157782e5616a0eb237ed188083940f2). Branded navy photographic presentation and reveal observed; automatic hidden-attribute event at 6.027 seconds; keyboard Enter on Skip hides the intro and restores Dashboard focus; reduced-motion suppresses it; return reload and Pipeline navigation do not replay it. Existing production sessions/storage untouched. This verifies the deployed artifact in isolation, not a new production credential/login ceremony. |
| C. Phil notification | Provider accepted YES; provider delivered YES. Existing Postmark message f854e714-7690-4cf7-868f-f8810a291148 has Delivered event to philaperri@gmail.com at 14:38:30 ET. Personal inbox receipt UNVERIFIED; read by Phil UNVERIFIED. His personal mailbox is not connected. Delivery means recipient mail-server acceptance, not proof of inbox placement or reading. |

Offer receipt: Gmail message 1a1d1e6703d3055b; Postmark message 168d4963-3b65-42b8-bbda-49d95392a4e8. Raw HTML, secure bearer URLs and credentials were not written to evidence files.

## Source / deployment / preservation
- Application source: ba64a9f21f551902f2efe2557fa109a4b666d0ff.
- Worktree HEAD before this evidence-only delta: fbc81180477326851572511d79bbf368facdfd1d; branch codex/usce-phil-first-renovation-20261002.
- Serving admin: HTTP 200, 416,925 bytes; SHA-256 28aa37856e9293b434dd5eff620ea037f157782e5616a0eb237ed188083940f2.
- Railway current SUCCESS deployment: 3fcfdde0-299e-49d9-8a97-2588af74ee86; runtime source 9b7b44e006ef3135bfd634d3d4d263bb6ebd585b; image sha256:0011f640d27ea1327a03ccc874146e9d8199c681cc89c73dfb360f2d5c70437f.
- Gateway health: HTTP 200. Three relevant deployed mail/Offer module hashes match the accepted manifest.
- BOOT dependency validation PASS via existing sanctioned registrar. Scoped native QA/evidence leases released positively. No broad test or UX review rerun because application dependencies were unchanged.
- Unrelated dirty work and IVOC untouched.
- Rollback originals freshly hash-verified: f3ddeca644fcdbab4adae3e71682a225cb2668914645ff7125a7c95111a64919 and immediately preceding admin preimage 3f93ed721a5028aab2a424ab87db058f14003bfe73bef2c3cbd3f97d39d3685e, in USCE_IQ_PHIL_UX_20261112/release. No rollback performed.
- No required human action for this bounded sweep. Phil personal-inbox receipt and reading remain unverified; the intro gap is now closed by the safe exact-artifact preview described above.

Provider semantics: https://postmarkapp.com/developer/webhooks/delivery-webhook

## Safe intro follow-up / notification lookup
- Fresh BOOT dependency validation PASS at registrar 9519395. Existing application source/deployment unchanged; no application fix needed.
- Temporary loopback-only servers served unmodified production HTML from RAM on separate origins. Response CSP blocked all API connections and form submissions; no production data or credentials entered. Public embedded image treatment retained.
- Chrome inherited reduced motion, which correctly suppressed playback. No-preference was emulated only in disposable preview tabs to exercise animation; all overrides removed and preview tabs/servers closed. Neither production cookies nor production local/session storage was cleared or edited.
- CDP observed the actual intro hidden-attribute mutation at 6,027 ms after reload; fully revealed logo and purpose both reached opacity 1. Keyboard Skip returned focus to Dashboard. Existing live login acceptance is preserved, not replaced by a fixture.
- Existing notification subject, read directly from Postmark: **New USCE student reply — USCE QA TEST — HTML Offer Preview**. Recipient philaperri@gmail.com. Submitted and Delivered: **November 12, 2026 at 2:38:30 PM EST (19:38:30 UTC)**. No notification resent.
- Safe preview screenshot: /tmp/usce-iq-intro-verified-20261112.png.
