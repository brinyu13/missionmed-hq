# Production release addendum — September 15, 2026

Production reuses the existing dataLayer/gtag stack. Checkout intent re-fetches configuration and validates product, variation, course, amount and the same-origin HTTPS checkout destination. Five UTM keys carry to checkout and contact. Events cover page, CTA, upsell, comparison, curriculum, FAQ, quotes, video, Facebook, lead form, schedule, Matrix, feedback, strategy, scroll, Emergency and 360. Independent GA HTTP204 transport was observed for page/B/schedule/scroll/Emergency/360. Lead submit/confirmation were NOT EXECUTED. No PII is added to event fields. No new analytics or CRM backend was created.

See PRODUCTION_QA.md, INDEPENDENT_ACCEPTANCE.md and the source ledger for current evidence. The original document is preserved below as historical context. Its local-only and pending-authority statuses are not current release claims.

---

# CRO event map — local hooks and production requirements

The candidate pushes events into in-memory `dataLayer`; it has no GTM/GA4 collector installation and no verified analytics-delivery claim. A name in a `data-event` attribute alone does not prove dispatch. This run tested UI behavior, not GA4 reports.

| Interaction | Hook / planned signal | Current truth |
|---|---|---|
| View | mr_concept_view, mr_b_finalization_view | Local; deduplicate into production page_view strategy |
| CTA | mr_cta_click (action, section/location) | Existing local handler |
| IW intercept | mr_upsell_shown / mr_upsell_accept / mr_upsell_decline | UI paths tested; preserve no-mixed-purchase protection |
| Comparison | mr_comparison_toggle / mr_comparison_expand | Local selection/disclosure |
| Checkout intent | mr_iw_checkout_intent / mr_complete_checkout_intent | Preview intent, NEVER purchase proof |
| Lead | mr_lead_capture_open / mr_lead_capture_submit | Local-only; values reset; no CRM delivery |
| Curriculum / schedule | mr_curriculum_open / mr_schedule_open / mr_complete_schedule_open | Local disclosures |
| Session | mr_schedule_session_select (session, day) | All five choices UI-tested |
| Strategy | mr_no_memorization_engagement (step) | Tabs tested |
| Personalization / team / Matrix | mr_analytics_section_open / mr_team_model_open / mr_matrix_open | Disclosure, not product use |
| Quotes | mr_quote_interaction (quote_id, section, direction/action) | Manual next/pause checked; no student details |
| Local videos | mr_testimonial_open / mr_video_open | Player-open only; not completion |
| YouTube | mr_match_video_play_intent / mr_match_video_play / mr_match_video_stop | Actual play NOT verified; player unavailable; JS API subscription requires validation |
| FAQ | mr_faq_open (fixed question label) | All 23 disclosures tested |
| Community | mr_facebook_proof_click | Existing outbound hook, not a conversion |
| Motion | mr_motion_preference (enabled) | Toggle tested |

## Production checklist — not executed

1. Preserve live GTM/GA4 and consent configuration. Verify homepage, campaign, products, cart and checkout. Do not inject a duplicate loader.
2. Map hooks to a documented schema. Fixed section/offer IDs only; no name, email, phone, answers or student measurements.
3. Use actual Woo variation, currency and price for commerce. Never promote preview intent or a waived test to purchase. Deduplicate transaction IDs.
4. Verify arrival in the intended GA4 property with collector/debug evidence, not only `dataLayer` existence.
5. Verify WhatsApp attribution through cart/checkout/account creation with privacy/consent preserved.
6. Verify lead delivery, consent, spam protection, failure handling and confirmation before replacing the local form.
7. Validate actual video play/progress/completion; player-open is not watched testimony.

## WhatsApp UTM proposal — specification only

`utm_source=whatsapp`, `utm_medium=messaging`, `utm_campaign=mr_interview_week_2026_09`, `utm_content=b_immersive_founder_intro`. Use the approved production URL after deployment; never put personal recipient information in parameters. Live attribution is NOT verified.

Measure which messages reach comparison, selected offers, IW accept/decline paths, account/checkout friction, question engagement and real orders. No conversion uplift or attribution reliability was established by this local task.
