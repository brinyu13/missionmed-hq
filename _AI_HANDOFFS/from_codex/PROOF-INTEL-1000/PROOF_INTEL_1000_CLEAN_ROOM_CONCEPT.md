# PROOF-INTEL-1000 — Clean-room concept

**Frozen:** 2026-09-30 19:25 UTC, before inspection of historical testimonial designs, screens, HTML, specifications, or summaries. This document is a product proposal, not an implementation or an assertion about the current corpus. Source allowed at freeze: the Founder outcome and corpus categories in the supplied directive, the current worktree and MissionMed OS orientation, and general privacy constraints. No historical testimonial artifact was opened.

## Product thesis

Give a prospective student a way to find *evidence that speaks to their situation*, while making the reason for every match inspectable. Start with the student's concern or a few verified filters, then return a small set of proof profiles whose particular passages or video moments support the match. Keep a complete browseable library for visitors who prefer exploration. Treat weak matches as weak; never fill gaps with invented biography or outcome claims.

The working interaction name is **Find my proof**. It is not a public brand decision.

## Entry and journeys

1. **Describe a concern.** A prompt such as “I am worried that a late application will hurt me” is parsed into a theme, not a claim that the visitor has a particular score, visa, attempt, or Match history. The system asks for optional, explicit filters only when they can materially improve retrieval. The user sees and may edit the interpreted themes before results load.
2. **Choose facts.** Specialty, application cycle, service, and other public-safe fields appear only when supported by verified structured data and publication policy. Each selected filter is visibly distinct from the natural-language concern. If a field has insufficient coverage, explain that rather than presenting a misleading empty filter.
3. **Browse all proof.** A library supports text, video, outcome, and topic browsing without requiring personal disclosure or accepting personalization.
4. **Open a proof profile.** A profile unifies a person's authorized written story, video, transcript moments, and verified outcome where reliable identity joins exist. It keeps separate source and consent badges for each medium. Missing joins remain separate assets rather than being forced into a combined profile.
5. **Refine results.** Visitors can broaden themes, clear a strict filter, switch between similar circumstances and similar concerns, or browse the library. The interface says which constraint changed.

## Information architecture

The landing view has one plain-language input, a compact set of verified filters, example concerns, and a direct “Browse all stories” path. Results are organized by relevance evidence rather than a uniform grid: a lead proof profile with a directly relevant quote or video moment, then a diverse set of other stories. A profile page presents a short story overview, original-source evidence, video with chapters and transcript, a clearly sourced outcome section, and optional other authorized material from the same person. Every page has a route back to the full library.

The interface should use the current StoryForge-family design grammar and tokens after those are verified. This concept specifies interaction and information structure, not a borrowed visual design.

## Retrieval interaction and ranking

The retrieval pipeline is a proposed hybrid:

1. Apply **hard verified filters** only to fields with trustworthy structured values and public-display permission.
2. Search approved written text and timestamped transcript chunks semantically for the concern or situation. Index a traceable source ID, offsets, media timestamps, model/version, and review status with every chunk.
3. Match concern themes only when the source passage supports them. Keep theme extraction reviewable and separate from biographical facts.
4. Rank by evidence strength, relevance, source quality, and diversity. Avoid repeating several stories from the same person or near-duplicate passage. Penalize weak joins and ambiguous claims. Commercial value or service promotion must not masquerade as similarity.
5. Return a reason for each result in the form “Relevant because this approved passage discusses [theme]” or “Matches your selected [verified field].” Quote or timestamp links let the visitor verify the reason. Never state “this student had your exact experience” from semantic similarity alone.

The search UI distinguishes **same verified circumstances** from **same concern**. If no strong result exists, it says so, shows the closest relevant passages with their limits, suggests safe ways to broaden filters, and offers the full library. It never manufactures a match or silently drops a strict filter.

## Proof profile and video behavior

A profile has a stable internal person identifier, but a public identity is shown only to the extent approved. A profile may be pseudonymous. Written text, video, transcript, and outcome each retain their own source IDs, dates, consent scope, editorial history, and withdrawal state. The visitor can jump from a result explanation to the exact passage or timecode. Transcript search highlights the passage and synchronizes to the video; accessible text remains available when media is unavailable. Captions, keyboard controls, reduced motion, readable type, and mobile playback are first-class requirements.

The result card should preview one meaningful evidence unit: a short approved quote or a video frame/timecode with a source label. An outcome badge appears only when the outcome and its association with this person are verified and authorized. It should not collapse a complex trajectory into a misleading single victory label.

## Trust and privacy model

Separate three gates: **possessed**, **internally retrieval-eligible**, and **public-display authorized**. Possession does not imply either later gate. Explicit publication rights are needed per medium and, where necessary, per field. Sensitive application attributes are excluded from public facets and matching until a specific policy and consent decision permits them. Semantic themes may be indexed for internal retrieval only after review and an approved use basis; they are not biographical facts. Honor consent withdrawal by removing the public item and its retrieval chunks together. Keep private joining identifiers off public pages and browser analytics.

The visitor's free-text situation should be processed with data minimization, short retention by default, and no assumption that it is a student record. Do not persist it in a lead or identity profile without a separate opt-in.

## Conceptual wireframes

```text
LANDING
Find proof that speaks to your situation
[ Describe what you are wondering about...      ] [Find stories]
Examples: application timing · confidence · interview preparation
Optional verified filters: [Specialty] [Year] [Service]
Browse all stories →

RESULTS
Your concern: [timing]  Verified filters: [Internal Medicine ×]
We found 6 passages about this concern; 2 also match your selected facts.
[Lead story: approved evidence passage + source/timecode]
Why shown: discusses application timing; verified specialty match.
[Other distinct stories]  [Broaden concern] [Clear filter] [Browse all]

PROFILE
Approved display identity + source/consent status
Story overview | Verified outcome (if permitted)
Written story  | Video player + searchable timecoded transcript
Source notes and relevant passage anchors
```

## What must be proven before implementation

- Corpus counts, source rights, join quality, and field coverage.
- Exact current platform and StoryForge-family component authority.
- Whether existing search/vector infrastructure is suitable and privacy-safe.
- A retrieval evaluation set with human judgments for strong, weak, and no-match cases; tests for fabricated similarity, duplicate domination, consent withdrawal, and sensitive-field leakage.
- Accessible mobile usability with real visitors, plus a policy decision on public outcome and sensitive-attribute display.

## Founder choices for the next phase

Choose the minimum public identity level, approved display fields, whether visitor situation text may be retained, and the first service/corpus slice for a private pilot. Product implementation and publication require a new scoped directive and independent verification.
