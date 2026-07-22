#!/usr/bin/env python3
"""Build the I1Q-3000 evidence-backed gallery and comparison artifacts.

The source artifacts are read-only. This script writes only inside the ticket
handoff directory and records unavailable/unknown attributes explicitly.
"""

from __future__ import annotations

import hashlib
import html
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "evidence"
SHOTS = ROOT / "I1Q-3000_SCREENSHOT_BOOK"


DIMENSIONS = [
    "visual_quality", "navigation", "educational_progression", "replay",
    "zoom_notes", "learning_flow", "question_progression", "ladder_concepts",
    "rounds_concepts", "explanation_philosophy", "clinical_reasoning",
    "interaction_speed", "student_engagement", "animation", "accessibility",
    "standalone_potential", "daily_drills_integration", "analytics",
    "teacher_experience", "student_experience", "reuse_potential",
]


PROFILES = {
    "legacy": [2, 2, 4, 0, 0, 3, 4, 1, 0, 4, 4, 3, 3, 1, 1, 5, 0, 3, 1, 3, 3],
    "qbank": [3, 4, 4, 0, 0, 4, 4, 1, 0, 5, 5, 4, 3, 1, 3, 5, 0, 4, 4, 4, 4],
    "video": [3, 3, 4, 5, 4, 4, 3, 1, 0, 4, 4, 4, 4, 2, 2, 1, 5, 3, 2, 4, 5],
    "daily": [4, 4, 4, 3, 4, 4, 3, 1, 0, 3, 3, 5, 4, 2, 3, 4, 5, 4, 2, 4, 5],
    "stat": [4, 4, 3, 3, 1, 4, 4, 1, 0, 3, 3, 5, 5, 4, 3, 5, 1, 5, 2, 4, 4],
    "ladder": [4, 4, 5, 5, 3, 5, 5, 5, 0, 5, 5, 4, 5, 4, 3, 5, 1, 4, 2, 5, 5],
    "ladder_daily": [4, 5, 5, 5, 5, 5, 5, 5, 0, 5, 5, 4, 5, 4, 4, 4, 5, 5, 2, 5, 5],
    "rounds": [4, 4, 5, 5, 2, 5, 5, 2, 5, 5, 5, 5, 5, 4, 3, 5, 2, 3, 2, 5, 5],
    "platform": [3, 3, 2, 3, 1, 3, 3, 0, 0, 3, 2, 3, 2, 1, 3, 1, 4, 5, 5, 1, 5],
    "grand": [5, 4, 4, 3, 1, 4, 4, 0, 4, 4, 4, 4, 5, 5, 4, 5, 1, 5, 4, 5, 4],
    "timeline": [4, 3, 2, 0, 3, 3, 2, 0, 0, 2, 2, 3, 2, 3, 2, 5, 0, 3, 5, 3, 4],
    "donor": [5, 4, 1, 0, 0, 2, 0, 0, 0, 1, 0, 4, 3, 4, 3, 5, 0, 1, 1, 3, 4],
    "document": [1, 1, 2, 0, 0, 1, 1, 0, 0, 3, 2, 1, 1, 0, 0, 0, 0, 2, 3, 1, 3],
}


def p(
    ident: str,
    title: str,
    ticket: str,
    order: int,
    lineage: str,
    path: str,
    author: str,
    status: str,
    profile: str,
    description: str,
    idea: str,
    interaction: str,
    strengths: list[str],
    weaknesses: list[str],
    innovations: list[str],
    *,
    dependencies: str = "None evidenced; standalone local HTML.",
    handoff: str | None = None,
    launchable: bool = True,
    screenshot: str | None = None,
    purpose: str | None = None,
    navigation: str = "Artifact-specific local navigation; see visual capture and source.",
    question_flow: str = "No question flow evidenced or not applicable.",
    replay: str = "No replay implementation evidenced.",
    zoom_notes: str = "No Zoom Notes behavior evidenced.",
    explanation: str = "No explanation system evidenced.",
    analytics: str = "No analytics implementation evidenced.",
    animation: str = "No material animation evidenced.",
    visual: str = "Historical MissionMed prototype language; see screenshot.",
    cam: str = "CAM conformance not established.",
    accessibility: str = "Not independently certified; unknowns remain.",
    responsiveness: str = "Not independently certified; inspect representative captures.",
    standalone: str = "Standalone local HTML.",
    daily: str = "No direct Daily Drills integration evidenced.",
    reusable_components: list[str] | None = None,
    reusable_interactions: list[str] | None = None,
    reusable_education: list[str] | None = None,
    limitations: list[str] | None = None,
    must_not_lose: list[str] | None = None,
    aliases: list[str] | None = None,
    score_overrides: dict[str, int] | None = None,
) -> dict:
    scores = dict(zip(DIMENSIONS, PROFILES[profile]))
    scores.update(score_overrides or {})
    # Fail closed when the record itself says a capability was not evidenced.
    # This prevents family-level profile hints from becoming unsupported claims.
    if replay.startswith("No replay"):
        scores["replay"] = 0
    if zoom_notes.startswith("No Zoom Notes"):
        scores["zoom_notes"] = 0
    if explanation.startswith("No explanation"):
        scores["explanation_philosophy"] = 0
    if analytics.startswith("No analytics"):
        scores["analytics"] = 0
    if animation.startswith("No material animation"):
        scores["animation"] = 0
    if daily.startswith("No direct Daily Drills"):
        scores["daily_drills_integration"] = 0
    if question_flow.startswith("No question flow"):
        scores["question_progression"] = 0
    if not launchable:
        scores["standalone_potential"] = 0
        if standalone == "Standalone local HTML.":
            standalone = "Non-runnable evidence artifact; no HTML launch target."
        if dependencies == "None evidenced; standalone local HTML.":
            dependencies = "Markdown/document evidence only; not a runnable prototype."
    record = {
        "id": ident,
        "title": title,
        "ticket": ticket,
        "order": order,
        "lineage": lineage,
        "path": path,
        "authoring_ai": author,
        "status": status,
        "description": description,
        "purpose": purpose or description,
        "major_educational_idea": idea,
        "interaction_model": interaction,
        "dependencies": dependencies,
        "handoff": handoff,
        "launchable_html": launchable,
        "screenshot": screenshot or (f"{ident}_01_home_redacted.jpg" if launchable else None),
        "navigation": navigation,
        "question_flow": question_flow,
        "replay_implementation": replay,
        "zoom_notes_behavior": zoom_notes,
        "explanation_system": explanation,
        "analytics": analytics,
        "animations": animation,
        "visual_language": visual,
        "cam_compliance": cam,
        "accessibility": accessibility,
        "responsiveness": responsiveness,
        "standalone_capability": standalone,
        "daily_drills_integration": daily,
        "reusable_components": reusable_components or [],
        "reusable_interactions": reusable_interactions or innovations,
        "reusable_educational_ideas": reusable_education or [idea],
        "strengths": strengths,
        "weaknesses": weaknesses,
        "known_limitations": limitations or weaknesses,
        "ideas_that_must_not_be_lost": must_not_lose or innovations,
        "innovations": innovations,
        "aliases": aliases or [],
        "scores": scores,
    }
    return record


P = "/Users/brianb"

ITEMS = [
    p("legacy-jbank-01", "Dr. J Immunology Quiz · Updated", "legacy / pre-ticket", 10, "core", f"{P}/Downloads/immunology_quiz_full_updated.html", "Unknown; ChatGPT-era download provenance", "historical precursor", "legacy", "Earliest recovered stacked Dr. J checkpoint and vignette quiz.", "Pair direct recall with clinical application.", "Long stacked form with Practice/Test controls.", ["Direct recall plus vignette pairing", "Immediate explanations"], ["Weak mobile layout", "No replay or timestamp anchors"], ["Paired checkpoint and vignette"], question_flow="Dr. J checkpoint followed by board-style vignette.", explanation="Inline answer explanations.", analytics="Results and topic summaries.", visual="Bright legacy quiz shell with stacked question cards."),
    p("legacy-jbank-02", "Dr. J Immunology Quiz · Fixed", "legacy / pre-ticket", 11, "core", f"{P}/Downloads/immunology_quiz_full_updated_FIXED.html", "Unknown; ChatGPT-era download provenance", "historical repair", "legacy", "Repair pass over the early Immunology quiz.", "Preserve paired recall and vignette learning while stabilizing the page.", "Long-form practice/test quiz.", ["Retains core paired-question model", "Standalone"], ["Still desktop-heavy", "No provenance/replay"], ["Iterative repair before working build"], question_flow="Paired Dr. J ask and vignette sequence.", explanation="Inline answer explanations.", analytics="End-of-quiz result and topic views."),
    p("legacy-jbank-03", "Dr. J Immunology Quiz · Working Download", "legacy / pre-ticket", 12, "core", f"{P}/Downloads/immunology_quiz_full_updated_WORKING.html", "Unknown; ChatGPT-era download provenance", "working historical iteration", "legacy", "Allocated working download between the Fixed build and the later preserved repository reference.", "Couple Dr. J recall with clinical transfer in a complete standalone quiz.", "Long-form paired quiz with Practice/Test, explanations, results, and topic review.", ["Complete standalone loop", "Paired recall and application", "Allocated local source"], ["Weak mobile behavior", "No timestamps or replay"], ["Working repair iteration", "Practice/Test split"], question_flow="Dr. J checkpoint then vignette through a long-form quiz.", explanation="Per-item answer/explanation reveal.", analytics="Score and topic-result concepts."),
    p("legacy-jbank-reference", "Dr. J JBank · Preserved Working 40Q Reference", "legacy / pre-ticket", 13, "core", f"{P}/Desktop/GIT_TEMP_HOLD/_REFERENCE_SYSTEMS/missionmed-codex-legacy/drj-jbank-engine/DrJ_JBank_WORKING.html", "Unknown; preserved legacy repository", "dataless historical reference; do not hydrate", "legacy", "Latest logical legacy JBank reference; all three repository aliases are APFS dataless and must not be hydrated for this archaeology.", "Couple Dr. J recall with clinical transfer in a complete quiz.", "Forty stacked paired items with timer, check, results, and Step 3 CCS affordance.", ["Hash/metadata lineage preserved", "Strong question/explanation density concept", "Topic analytics concept"], ["Not locally launchable without hydration", "Header/subtitle count inconsistency", "Weak mobile behavior", "No timestamps or replay"], ["Practice/Test split", "Paired recall and vignette", "Topic result review"], launchable=False, dependencies="APFS dataless source; hydration is prohibited for this mission.", standalone="Logical HTML reference exists but is deliberately not launched or hydrated.", question_flow="Dr. J checkpoint then vignette, repeated through a 40-item shell.", explanation="Per-item answer/explanation reveal is documented by prior inspection.", analytics="Score, topic analytics, and unofficial outcome summary are documented by prior inspection.", aliases=[f"{P}/Desktop/GIT_TEMP_HOLD/_REFERENCE_SYSTEMS/missionmed-codex-legacy/drj-jbank-engine/DrJ_JBank_WORKING Immuno.html", f"{P}/Desktop/GIT_TEMP_HOLD/_REFERENCE_SYSTEMS/missionmed-codex-legacy/drj-jbank-engine/index.html"]),
    p("qbank-003", "Step 2 CK Full Dual-UI Demo", "QBANK-003", 20, "adjacent", f"{P}/MissionMed_AI_Sandbox/qbank-demo/QBANK-003/MM-QBANK-Step2CK_FullDualUIDemo_v0.1.html", "Artifact metadata does not establish authoring AI", "local synthetic demo", "qbank", "Dual student and admin/reviewer Question Bank demonstration.", "Clinical reasoning plus an explicit content-review surface.", "Menu, settings, question, explanation, assessment report, and reviewer preview.", ["Complete student loop", "Separate reviewer preview", "Strong explanation state"], ["Synthetic demo content", "No Dr. J replay lineage"], ["Dual student/reviewer UI", "Assessment report"], question_flow="Question to explanation to block review.", explanation="Structured answer explanation view.", analytics="Assessment report and reviewer-facing metadata.", accessibility="Responsive captures exist; no final accessibility certification."),
    p("vdrl-090-a", "VDRL-090 Dr. J Interactive Video Drill", "VDRL-090", 30, "core", f"{P}/Downloads/vdrl-090_drj_drill_production.html", "Unknown from artifact metadata", "dependency-bound historical build", "video", "Video-synchronized Dr. J drill with node status, questions, and notes.", "Pause authentic teaching at question nodes and answer in context.", "Three-column video, node list, question/self-report, and note workspace.", ["Strong video synchronization", "Exact-node learning context", "Notes export"], ["Backend/registry/video dependent", "Current launchability is uncertain"], ["Node-synchronized pause", "Response timer", "Local notes export"], dependencies="Requires historical video/registry/backend contracts; network is blocked during archaeology.", question_flow="Playback pauses at nodes for answer/self-report and explanation.", replay="Native video/node seek model.", zoom_notes="Notes stored locally with export.", explanation="Post-response explanation panel.", standalone="HTML shell launches, but full behavior depends on historical services.", daily="Direct conceptual predecessor to Daily Drills video integration."),
    p("vdrl-090-b", "VDRL-090 Review Revision", "VDRL-090", 31, "core", f"{P}/Downloads/vdrl-090_drj_drill_production (1).html", "Unknown from artifact metadata", "dependency-bound historical revision", "video", "Later VDRL revision that reframed Simulation as Review.", "Keep video-tethered review distinct from unsupported simulation claims.", "Video/node review workspace.", ["More truthful Review framing", "Preserves synchronized interaction"], ["External dependencies remain", "No current service verification"], ["Simulation-to-Review truth correction"], dependencies="Requires historical video/registry/backend contracts; network is blocked during archaeology.", question_flow="Node-based review and self-report.", replay="Video seek to teaching nodes.", zoom_notes="Local notes/export behavior.", standalone="HTML shell launches, but full behavior depends on historical services.", daily="Direct conceptual predecessor to Daily Drills replay."),
    p("daily-rounds-v1", "Daily Rounds Mode · v1", "Daily Rounds lineage", 40, "direct-ancestor", f"{P}/MissionMed/LIVE/mode_dailyrounds_v1.html", "Artifact metadata does not establish authoring AI", "historical launcher", "daily", "Early five-step Daily Rounds session launcher.", "Move from exam-step choice to subject and mission context before starting a drill.", "Step selector, subject, Mission Intel, session/history, and settings.", ["Clear session setup", "Preserves context and history"], ["Launcher only", "Auth/API dependencies"], ["Mission Intel", "Full versus review setup"], dependencies="Historical auth/API/sessionStorage contracts.", navigation="Five-step setup funnel.", analytics="History surface and progress summaries.", daily="Native Daily Rounds launcher concept.", standalone="Local shell; meaningful completion depends on runtime services."),
    p("daily-rounds-live", "Daily Rounds Mode · Live Snapshot", "Daily Rounds lineage", 41, "direct-ancestor", f"{P}/MissionMed/LIVE/daily.html", "Artifact metadata does not establish authoring AI", "historical live snapshot", "daily", "Later Daily Rounds launcher snapshot preserved in MissionMed LIVE.", "Preserve session intent, intel, history, and settings around drill start.", "Five-step launcher with timer, volume, and full/review controls.", ["Mature setup framing", "Clear session controls"], ["Not the learning runtime", "Auth/API dependencies"], ["Session intent framing", "Review-mode setup", "Persistent history"], dependencies="Historical auth/API/sessionStorage contracts.", analytics="History and progress framing.", daily="Native Daily Rounds surface.", standalone="Local shell; service-bound beyond setup."),
    p("t10-v3", "TournaMed Five-Concept Demo · v3", "T-10", 50, "adjacent", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/T-10_TournaMed_5Concept_Demo_v3.html", "Fable lineage inferred from ticket family; not separately signed", "adjacent gamification reference", "stat", "Five-concept competitive learning demo retained as an engagement reference.", "Use bounded competition to motivate retrieval without equating game score with mastery.", "Tournament setup and game-state comparison.", ["High engagement", "Clear game-state experimentation"], ["Competitive score can overclaim learning", "Not Dr. J-specific"], ["Mode comparison", "Competitive pacing"], daily="No direct Daily Drills integration.", must_not_lose=["Clear separation between game performance and medical mastery"]),
    p("t11-concepts", "STAT Three-Concept Demo", "T-11", 51, "direct-ancestor", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/T-11_STAT_3Concept_Demo.html", "Fable lineage inferred from ticket family", "historical concept bakeoff", "stat", "Three visual and interaction concepts for STAT-style retrieval.", "Compare commitment and feedback mechanics before choosing a shell.", "Side-by-side concept selection.", ["Explicit concept comparison", "Fast inspection"], ["Demo breadth exceeds validated learning depth"], ["Three-concept bakeoff"], animation="Concept-specific transitions."),
    p("t11-production", "STAT Production v1", "T-11", 52, "direct-ancestor", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/T-11_STAT_PRODUCTION_v1.html", "Fable lineage inferred from ticket family", "historical local candidate", "stat", "First synthesized STAT production-style prototype.", "Commit before feedback and preserve a dignified debrief.", "Setup, timed retrieval, feedback, and result flow.", ["Cohesive runtime", "Immediate commitment loop"], ["Production label is not production authority", "Synthetic/local state"], ["Commitment hold", "Debrief"], question_flow="Prompt, commitment, ruling, and debrief.", explanation="Feedback after commitment.", analytics="Session results and performance framing."),
    p("t12", "Daily Drills Merged · Visual Breadth", "T-12 / 009", 60, "direct-ancestor", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/T-12_DailyDrills_Merged_009.html", "Authoring AI not established", "superseded experiment", "daily", "Three Daily Drills visual concepts across five states.", "Explore multiple drill-state presentations.", "Concept and state comparison.", ["Broad visual exploration", "Five-state coverage"], ["Incorrect server-graded MCQ model", "High comparison density"], ["Visual breadth across drill states"], question_flow="Originally modeled server-graded MCQs; later corrected.", daily="Direct Daily Drills interaction ancestor."),
    p("t13", "Daily Drills Merged · Real Drill Truth", "T-13 / 010", 61, "direct-ancestor", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/T-13_DailyDrills_Merged_RealDrills_010.html", "Claude Code provenance; exact model unestablished", "superseded truth-correction prototype", "daily", "Corrected Daily Drills to timed spoken recall and self-report.", "Represent the real drill honestly: respond aloud, then mark recall.", "Ten-state picker and runtime/log.", ["Truthful drill contract", "Strong state coverage"], ["Still visually dense", "No authentic service binding"], ["Spoken recall", "Self-report", "Runtime log"], question_flow="Timed spoken response followed by self-report.", daily="Direct Daily Drills interaction ancestor.", must_not_lose=["Spoken-recall truth contract", "Self-report rather than fake server grading"]),
    p("t14", "Daily Drills · Three Simplified Versions", "T-14 / 011", 62, "direct-ancestor", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/T-14_DailyDrills_3Versions_011.html", "Claude Code provenance; exact model unestablished", "historical mobile simplification bakeoff", "daily", "Three side-by-side simplified drill versions with phone-frame comparison.", "Reduce cognitive load while keeping Correct/Missed, pause, flag, and review.", "Version chooser, drill runtime, summary, and notes.", ["Best early simplification", "Mobile comparison", "Always-visible commitment"], ["Three-version frame is evaluative, not a product flow"], ["Always-visible Correct/Missed", "Flag/pause", "Summary review and notes"], question_flow="Recall, Correct/Missed self-report, then summary review.", zoom_notes="Notes carried into summary.", responsiveness="Explicit phone-frame comparison; still prototype-level.", daily="Direct Daily Drills interaction ancestor."),
    p("t15-daily", "Daily Drills · Component Bakeoff", "T-15 / 012", 63, "direct-ancestor", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/T-15_DailyDrills_3Versions_012.html", "Authoring AI not established", "historical component bakeoff", "daily", "Refined three-version comparison for Daily Drills components.", "Choose interaction furniture without losing the real spoken-recall contract.", "Side-by-side component variants.", ["Sharper component comparison", "Retains truth contract"], ["Still a bakeoff shell", "Not runtime-wired"], ["Component-level comparison"], daily="Direct Daily Drills interaction ancestor."),
    p("t15-topic", "Daily Drills Topic Picker · Five Concepts", "T-15", 64, "direct-ancestor", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/T-15_TopicPicker_5Concepts.html", "Authoring AI not established", "historical picker study", "daily", "Five topic-picker concepts for drill discovery.", "Help learners choose a bounded focus without hiding drill provenance.", "Five-way topic navigation comparison.", ["Useful discovery breadth", "Explicit comparison"], ["Selection study only", "No end-to-end learning flow"], ["Topic-picker patterns"], daily="Direct Daily Drills navigation reference."),
    p("t15-sessions", "Daily Drills Sessions · Five Concepts", "T-15", 65, "direct-ancestor", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/T-15_Sessions_5Concepts.html", "Authoring AI not established", "historical sessions study", "daily", "Five concepts for session history and continuity.", "Make practice history legible and actionable.", "Session-list and history comparison.", ["Strong continuity exploration", "Reusable history patterns"], ["Analytics concepts not production-calibrated"], ["Session-history patterns"], analytics="Five candidate session/history views.", daily="Direct Daily Drills analytics reference."),
    p("t16", "Daily Drills Production Synthesis", "T-16 / 013", 66, "direct-ancestor", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/T-16_DailyDrills_Production_013.html", "Authoring AI not established", "local synthesis; not production", "daily", "Merged Browse, Sessions, runtime, and summary into one Daily Drills concept.", "A coherent spoken-recall loop from discovery through review.", "Browse and history into runtime and summary.", ["Strongest pre-Ladder Daily Drills synthesis", "Coherent information architecture"], ["Durable wiring missing", "Production title overstates status"], ["Browse plus sessions", "Runtime-to-summary continuity"], question_flow="Browse, launch, spoken recall/self-report, summary.", zoom_notes="Notes and review concepts carried through session.", analytics="Sessions and summary analytics.", daily="Native Daily Drills synthesis.", must_not_lose=["Browse/session/runtime/summary continuity", "Truthful self-report contract"]),
    p("stat-911", "STAT V4 Functional Shell", "I1 STAT4 911", 70, "adjacent", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1_STAT4_911_FUNCTIONAL_SHELL/I1_STAT4_911_FUNCTIONAL_SHELL_CAM_S1.html", "Fable 5", "historical functional shell", "stat", "Playable STAT shell used as a later parity baseline.", "Immediate commitment, feedback, and replayable debrief inside a game shell.", "Setup, game loop, results, and review.", ["Broad playable shell", "Useful baseline"], ["Synthetic content", "Game score risks conflation with mastery"], ["Lifecycle timers", "Mode contracts", "Debrief"], handoff=f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1_STAT4_911_FUNCTIONAL_SHELL/I1_STAT4_911_FUNCTIONAL_SHELL_COMBINED_HANDOFF.md", analytics="Results, history, and subject statistics concepts.", replay="Postgame question replay concept."),
    p("stat-913-a", "STAT V4 Definitive Runtime · A", "I1 STAT4 913", 71, "adjacent", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1_STAT4_913_DEFINITIVE_RUNTIME_REBUILD/I1_STAT4_913_DEFINITIVE_RUNTIME_CAM_S1.html", "Codex/Fable multi-run lineage", "contested local candidate", "stat", "One concurrent 913 runtime rebuild branch.", "Harden deterministic game-mode contracts and debrief.", "Multi-stage game runtime.", ["Deep runtime coverage", "Deterministic contracts"], ["Concurrent contested lineage", "Not canonical"], ["Scoring contract", "Cursor/chase", "Lifelines"], handoff=f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1_STAT4_913_DEFINITIVE_RUNTIME_REBUILD/I1_STAT4_913_DEFINITIVE_RUNTIME_COMPLETE_COMBINED_HANDOFF.md"),
    p("stat-913-b", "STAT V4 Definitive Runtime · Fable B", "I1 STAT4 913", 72, "adjacent", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1_STAT4_913_DEFINITIVE_RUNTIME_REBUILD_FABLE_B/I1_STAT4_913_DEFINITIVE_RUNTIME_CAM_S1.html", "Fable 5", "contested concurrent candidate", "stat", "Parallel 913 rebuild retained as conflicting evidence.", "Compare game runtime decisions without declaring lineage winner.", "Multi-stage game runtime.", ["Independent alternative implementation", "Useful conflict evidence"], ["Contested/truncated history", "Not canonical"], ["Concurrent alternative for comparison"], handoff=f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1_STAT4_913_DEFINITIVE_RUNTIME_REBUILD_FABLE_B/I1_STAT4_913_DEFINITIVE_RUNTIME_COMPLETE_COMBINED_HANDOFF.md"),
    p("stat-913a", "STAT V4 Canonical-Filename Full Game", "I1 STAT4 913A", 73, "adjacent", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1_STAT4_913A_CANONICAL_FULL_GAME/I1_STAT4_913A_STAT_V4_CANONICAL_FULL_GAME_CAM_V2.html", "Fable 5", "partial local candidate; filename is not authority", "stat", "Merged full-game candidate later used as the 914B defect baseline.", "Preserve end-to-end play and postgame review while exposing defects honestly.", "Full setup, runtime, result, review, and analytics shell.", ["Complete breadth", "Strong review surface"], ["Handoff reports PARTIAL", "Canonical filename is not ratification"], ["Full end-to-end state inventory"], handoff=f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1_STAT4_913A_CANONICAL_FULL_GAME/I1_STAT4_913A_CANONICAL_FULL_GAME_COMPLETE_COMBINED_HANDOFF.md"),
    p("stat-914b", "STAT V4 Rendered Repair", "I1 STAT4 914B", 74, "adjacent", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1_STAT4_914B_RENDERED_REPAIR_MEGARUN/I1_STAT4_914B_STAT_V4_RENDERED_REPAIR_CAM_V2.html", "Codex multi-agent", "local repair candidate; release gate unresolved", "stat", "Latest local rendered repair with extensive multi-viewport evidence.", "Make the game loop deterministic, reviewable, and dignified without claiming medical mastery.", "Full setup, runtime, natural replay, and debrief.", ["Deep QA evidence", "Strong responsive coverage", "Natural replay"], ["Synthetic/local", "Not deployed or content-approved"], ["Deterministic seal", "Natural semantic replay", "48-state QA set"], handoff=f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1_STAT4_914B_RENDERED_REPAIR_MEGARUN/I1_STAT4_914B_RENDERED_REPAIR_COMPLETE_COMBINED_HANDOFF.md", accessibility="Extensive local multi-viewport and accessibility evidence; no release certification.", responsiveness="Verified local captures at desktop, tablet, mobile, and high zoom."),
    p("i1q-2000", "The Ladder", "I1Q-2000", 80, "core", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1Q-2000_The_Ladder_Prototype.html", "Fable 5", "superseded concept prototype", "ladder", "Three-rung transfer from Dr. J ask to board item to vignette.", "Climb the same knowledge through recall, board framing, and clinical transfer.", "Learning, Exam, and Review modes around a progressive three-rung ladder.", ["Clearest knowledge-transfer metaphor", "Confidence-before-verdict", "Strong replay and debrief"], ["Synthetic fixtures", "Male Dr. J pronouns later corrected", "A11y gaps"], ["Animated ladder", "Three-rung progression", "Calibration and blind spots", "One-next-action"], handoff=f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1Q-2000_COMPLETE_COMBINED_HANDOFF.md", question_flow="Dr. J ask → recall MCQ → vignette → convergence.", replay="Timestamp-like replay overlay in synthetic data.", explanation="Layered L1/L2/L3 explanations and convergence.", analytics="Calibration, blind spots, XP/mastery-shaped concepts.", animation="Rung climb and replay overlay transitions.", visual="Dark CAM-adjacent assessment shell with restrained gold/ember accents.", accessibility="Keyboard and semantic work present, but focus trap/zoom validation incomplete.", responsiveness="Mobile capture works without horizontal overflow; broader certification absent.", must_not_lose=["Three-rung transfer", "Confidence before verdict", "One-next-action debrief", "Replay at the teaching moment"]),
    p("i1q-2001", "The Ladder inside Daily Drills", "I1Q-2001", 81, "core", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1Q-2001_The_Ladder_Daily_Drills_Prototype.html", "Fable 5", "authentic-anchor prototype; generated items unreviewed", "ladder_daily", "Embeds a full-drill assessment and selective Ladder climb inside Arena Daily Drills.", "Continue directly from the authentic drill into recall, transfer, review, and exact-moment replay.", "Arena → drill hub/player/timeline/notes → quiz → selective Ladder/USMLE → Exam/Review → debrief.", ["Strongest Daily Drills integration", "Exact source anchors", "Complete learner journey"], ["Restricted source content", "Generated MCQ/USMLE items pending review", "Video placeholder"], ["Arena continuity", "Exact-moment replay", "Full-breadth quiz plus selective Ladder", "Review Bay"], handoff=f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1Q-2001_COMPLETE_COMBINED_HANDOFF.md", question_flow="Every authentic question remains takeable; selected authored items climb into MCQ and vignette.", replay="Exact timestamp seek target with placeholder media binding.", zoom_notes="Integrated Drill Notes and replay reference.", explanation="Coached learning feedback, Exam hold, and Review Bay explanations.", analytics="Drill/block completion, calibration, and review/debrief concepts.", accessibility="Improved semantics; focus trap, timeline labels, and skip-link gaps remain.", responsiveness="Desktop and mobile states inspected; no horizontal overflow in sampled mobile state.", standalone="Single HTML launches; authentic media/data services are represented by fixtures/placeholders.", daily="Native Arena Daily Drills integration concept.", must_not_lose=["Every authentic question remains present", "Selective clinical climb", "Exact-moment replay", "Learning/Exam/Review contract separation"]),
    p("i1q-2002", "Ladder vs Rounds Interaction Bakeoff", "I1Q-2002", 82, "core", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1Q-2002_Interaction_Model_Bakeoff_Prototype.html", "Fable 5", "P3 recommendation; Founder and physician gates unresolved", "rounds", "Side-by-side bakeoff of Ladder and linear Rounds teaching models.", "Test whether a clinical rounds rail improves transfer and pacing over an explicit ladder.", "Choose Ladder or Rounds, then progress through a bounded demonstration.", ["Honest comparison", "Strong linear clinical pacing", "Clear payoff"], ["Only seed/timestamp authentic", "Most content authored", "No Founder ratification", "Ladder comparator is a passive reduction, not I1Q-2000's full three-rung interaction"], ["Rounds rail", "Foundation → consequence → board → deeper → decision", "Selective triggers/caps/fallback"], handoff=f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1Q-2002_COMBINED_HANDOFF.md", question_flow="Authentic seed → foundation → consequence → board → deeper reasoning → decision/payoff/replay.", replay="End-of-round replay to authentic seed moment.", explanation="Teaching progression accumulates before payoff.", daily="Potential selective Daily Drills follow-on; not integrated.", must_not_lose=["Bounded linear rounds rail", "Clinical consequence before board framing", "Explicit authored-versus-authentic labeling", "Do not treat the bakeoff as rejection of I1Q-2000's full interactive Ladder"]),
    p("i1q-platform", "I1Q Question Platform · 17-Workflow Operator Studio", "I1Q-1006 through 1008B", 83, "core", f"{P}/MissionMed_worktrees/I1Q-STATQuestions-1008B-SourceFactory/i1q-question-platform/public/index.html", "Codex multi-agent", "local engineering candidate; blocked from production", "platform", "Internal code-free author/reviewer/governance studio for the Question Library.", "Keep provenance, review, rights, release, and audit explicit before learner use.", "Seventeen role-aware operator workflows backed by a local in-memory demo.", ["Deep governance model", "Provenance and review first", "Reusable platform services"], ["Not a learner runtime", "Requires Node server", "UX 8.21 below 9 gate"], ["23-entity model", "RBAC/review/audit", "Answer isolation", "Source-to-item provenance"], dependencies="Node >=20; launch only with I1Q_LOCAL_DEMO=1 for synthetic in-memory inspection.", launchable=True, screenshot="i1q-platform_01_home.jpg", navigation="Seventeen-workflow operator navigation.", question_flow="Authoring and review workflow, not student question-taking.", replay="Source/video provenance and replay-reference fields, not a learner player.", explanation="Author/reviewer content fields and gates.", analytics="Inventory, audit, review, release, and governance reporting.", animation="Minimal operator transitions.", visual="Dense internal studio UI.", accessibility="Local UI review exists; UX acceptance gate not met.", responsiveness="Desktop-oriented operator surface.", standalone="Requires local Node server; synthetic demo is in-memory.", daily="Defines platform seams for Daily Drills source and item provenance."),
    p("zoom-notes-family", "Zoom Notes Print/Export Family", "unassigned historical export", 84, "supporting-artifact", f"{P}/Downloads/usmle-148e9fcd8fb8.html", "Unknown from export metadata", "restricted supporting artifact; direct launch disabled", "document", "Print-friendly study summary with a handwritten-notes margin pattern.", "Let learners carry concise notes into a printable review artifact.", "Static export/print document.", ["Strong print affordance", "Useful annotation margin"], ["Private study content", "Not an interactive prototype"], ["Print-friendly summary", "Handwritten-notes margin"], launchable=False, screenshot=None, dependencies="Restricted private study export; direct gallery launch and public capture are disabled.", navigation="Static print/export layout.", zoom_notes="Core value is a printable note margin and concise summary.", standalone="Logical local HTML exists, but this package deliberately does not launch or display its restricted contents.", aliases=[f"{P}/Downloads/usmle-148e9fcd8fb8 (1).html", f"{P}/Downloads/usmle-82975dee97c2.html", f"{P}/Downloads/usmle-fcf4a9bc63f7.html"], limitations=["Screenshot intentionally replaced by privacy notice", "Lineage to Learning Studio is conceptual, not canonical"], score_overrides={"zoom_notes": 5, "accessibility": 0, "analytics": 0, "teacher_experience": 1}),
    p("gr-2500", "Grand Rounds Functional Shell", "U1-GR-2500", 90, "adjacent", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/U1_GRAND_ROUNDS_2520F/00_INPUTS/FABLE_2500/U1_GR_2500_FUNCTIONAL_SHELL.html", "Fable 5", "historical adjacent reference", "grand", "Early medical game-show shell with board and staged learning mechanics.", "Use ceremony and competition to focus attention on teaching moments.", "Board, clue, ruling, and result sequence.", ["Faithful game-show mechanics", "Strong stage metaphor"], ["Early shell", "Trade-dress risk"], ["Board-to-clue continuity", "Attending teaching moment"]),
    p("gr-2503", "Grand Rounds Functional Shell v2", "U1-GR-2503", 91, "adjacent", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/U1_GRAND_ROUNDS_2520F/00_INPUTS/FABLE_2503/U1_GR_2503_FUNCTIONAL_SHELL_v2.html", "Fable 5", "historical adjacent reference", "grand", "Replaced stacked pages with one active scene and staged contestants.", "Keep attention on one active learning scene.", "Persistent stage with board/clue scenes and Value Burn.", ["One active scene", "Better stage continuity"], ["Still early and theatrical", "Not Dr. J workflow"], ["Persistent stage", "Value Burn"]),
    p("gr-2504", "Grand Rounds Photorealistic Live v3", "U1-GR-2504", 92, "adjacent", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/U1_GRAND_ROUNDS_2520F/00_INPUTS/FABLE_2504/U1_GR_2504_PHOTOREALISTIC_LIVE_V3.html", "Fable 5", "historical adjacent reference", "grand", "Added host/player/spectator/control-room roles and local reducer.", "Separate public teaching, player action, and control-room authority.", "Multi-role stage and reducer-driven state.", ["Clear role separation", "Authoritative local reducer"], ["Photoreal assets/font licensing gated", "Complex operational model"], ["Stage/projector/player/control-room roles"]),
    p("gr-2519x", "Grand Rounds Experience Inventory", "U1-GR-2519X", 93, "adjacent", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/U1_GRAND_ROUNDS_2522F/00_INPUTS/U1_GR_2519X_EXPERIENCE_PROTOTYPE.html", "Fable 5", "rejected interaction reference", "grand", "Large scene inventory that exposed director-rail and overlay defects.", "Inventory every state, then learn which experience patterns fail.", "Permanent director rail with manual Continue progression.", ["Comprehensive state inventory"], ["Director rail dominates", "Continue buttons break show flow", "Feedback covers clues"], ["Negative evidence: what not to repeat"], must_not_lose=["Treat this as explicit anti-pattern evidence"]),
    p("gr-2522f", "Grand Rounds Showrunner Experience", "U1-GR-2522F", 94, "adjacent", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/U1_GRAND_ROUNDS_2522F/04_PROTOTYPES/U1_GR_2522F_EXPERIENCE_PROTOTYPE.html", "Fable 5", "local adjacent candidate", "grand", "Repaired show flow around one persistent stage and a show-caller.", "Let motion carry state while teaching feedback stays outside the clue.", "Auto-flow stage, lower-third rulings, portal transitions, signal-hold failure, phone controller.", ["Excellent continuity", "Feedback does not cover content", "Failure state is staged honestly"], ["Complex ceremony", "Local-only control model"], ["Tile-to-clue flip", "Lower-third verdict", "Signal Hold", "Phone controller", "Reduced-motion contract"], animation="Motion carries state/continuity rather than decorating transitions.", accessibility="Roving board focus, modal/focus contracts, reduced-motion information holds."),
    p("gr-2600f", "Grand Rounds Playable Broadcast", "U1-GR-2600F", 95, "adjacent", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/U1_GRAND_ROUNDS_2600F/01_PROTOTYPE/GRAND_ROUNDS_2600F.html", "Fable 5", "local adjacent candidate", "grand", "Playable broadcast model with buzz timing, rulings, pearls, and Chart Review.", "Place one brief attending pearl at the peak of attention after each ruling.", "Host, buzz arm/lockout, ruling, teaching pearl, Final, and Chart Review.", ["Strong attention timing", "Complete postgame review", "Procedural audio"], ["Multi-device fairness unverified", "Trade-dress/avatar limits"], ["250ms early-buzz lockout", "Attending pearl", "Chart Review", "Phone buzzer"], explanation="One brief attending pearl after each ruling.", analytics="Chart Review and item outcomes."),
    p("gr-2601f", "Grand Rounds Founder-Review Revision", "U1-GR-2601F", 96, "adjacent", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/U1_GRAND_ROUNDS_2601F/01_PROTOTYPE/GRAND_ROUNDS_2601F.html", "Fable 5", "P3 founder-review revision; not production", "grand", "Expanded setup, response modes, live adjudication, Final, and seven-tab postgame.", "Separate game result, medical mastery profile, and provisional exam readiness.", "Setup wizard, MC/fill/voice modes, host console, Final wager, and multi-tab debrief.", ["Deepest postgame model", "Clear score/mastery/readiness separation", "Multiple response modes"], ["Many simulated integrations", "Readiness uncalibrated", "High complexity"], ["Seven-tab debrief", "Live-host adjudication", "Wager-before-clue Final", "Persistent input teaching"], analytics="Result, known, review, next actions, history, career, and readiness tabs.", must_not_lose=["Separate game score, mastery, and readiness", "Error-classified review with next-action rationale"]),
    p("timeline-403", "Mission Timeline Builder · 403", "D1-403", 100, "adjacent", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/(D1)-MacProTimeline-Fable5-HTMLPreview-403.html", "Fable 5", "adjacent studio reference", "timeline", "Guided builder with canvas, upload, advisor, export, and reference views.", "Turn source evidence into an inspectable derived artifact.", "Builder form, canvas, inspector, advisor, and export.", ["Clear builder/canvas model", "Provenance-minded workflow"], ["Desktop-first", "Fixture extraction"], ["Inspector/canvas coupling", "Advisor before export"]),
    p("timeline-404", "Mission Timeline Builder · Theme Loop 404", "D1-404", 101, "adjacent", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/(D1)-MacProTimeline-Fable5-HTMLPreview-404-SelfReviewThemeLoop.html", "Fable 5", "adjacent studio reference", "timeline", "Separated output theme from the application shell.", "Let presentation vary without destabilizing the workflow.", "Theme loop around the timeline artifact.", ["Strong theme/workflow separation"], ["Dense editor remains"], ["Theme affects artifact, not workflow"]),
    p("timeline-405", "Mission Timeline Builder · Interview Use 405", "D1-405", 102, "adjacent", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/(D1)-MacProTimeline-Fable5-HTMLPreview-405-UXClarityInterviewUseLoop.html", "Fable 5", "adjacent studio reference", "timeline", "Added interview-purpose clarity and question-to-event highlighting.", "Make every derived question trace back to its evidence node.", "Interview question list coupled to timeline selection.", ["Excellent source highlighting", "Purposeful derived-question view"], ["Desktop density", "Local fixtures"], ["Click question to highlight source event"]),
    p("timeline-406", "Mission Timeline Builder · UX Polish 406", "D1-406", 103, "adjacent", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/(D1)-MacProTimeline-Fable5-HTMLPreview-406-UXPolishLoop.html", "Fable 5", "adjacent studio reference", "timeline", "Compacted theme selection and added direct preview editing.", "Shorten the path between inspection and safe correction.", "Canvas selection, quick edit, and compact theme modal.", ["Faster editing", "Clear preview coupling"], ["Still a dense desktop tool"], ["Direct preview edit", "Compact theme modal"]),
    p("timeline-406a", "Mission Timeline Builder · Keynote Sprite 406A", "D1-406A", 104, "adjacent", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/(D1)-MacProTimeline-Codex-HTMLPreview-406A-KeynoteClassicSpriteIntegration.html", "Codex", "adjacent visual reference", "timeline", "Integrated exact-derived Keynote-style sprites into the builder.", "Use bounded artifact visuals without changing workflow semantics.", "Editor plus exact-derived sprite board.", ["Strong artifact preview", "Preserves workflow separation"], ["Large embedded sprite data", "Visual source authority must remain explicit"], ["Exact-derived sprite board"]),
    p("timeline-407f", "Mission Timeline Builder · Definitive Full Prototype 407F", "D1-407F", 105, "adjacent", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/(D1)-MacProTimeline-Fable5-DefinitiveFullProductPrototype-407F.html", "Fable 5", "local adjacent prototype; filename is not authority", "timeline", "Expanded to extraction review, question practice, version diff, zoom, and print preview.", "Quarantine derived candidates until accepted and keep source links visible.", "Eleven-tab editor with intake, review, practice, versioning, and export.", ["Deep provenance workflow", "Version compare", "Zoom/full-canvas/print modes"], ["Very dense", "Coarse responsive collapse", "Fixture extraction"], ["Accept/merge/reject quarantine", "Visibility badges", "Version diff", "Zoom/full-canvas", "Print preview"], accessibility="Limited semantics; desktop-first with coarse collapse.", must_not_lose=["Derived-question-to-source highlighting", "Candidate quarantine", "Version compare", "Visibility/audience badges"]),
    p("cam-d", "CAM Season One · Concept D", "CAM Concept Lab", 110, "design-donor", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/CAM_CONCEPT_LAB/prototype_D/index.html", "CAM Concept Lab / Fable lineage", "selected design-system donor; not I1Q product", "donor", "Selected Season One CAM visual-language donor.", "Provide a consistent visual system without deciding learning interaction.", "Five-world visual launcher and design tokens.", ["Strongest visual system", "Cohesive world language"], ["Not an I1Q prototype", "Does not resolve learning flow"], ["CAM Season One tokens", "Five-world visual language"], dependencies="Local tree assets may be required.", cam="Theme instructions identify Concept D as the selected Season One design-system source of truth; this does not make it I1Q product canon.", standalone="Launch from its local tree so relative assets resolve."),
    p("req-i1q-1002", "Question Platform Architecture Ruling", "I1Q-1002", 120, "requirements", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1Q_1002_QUESTION_PLATFORM_ARCHITECTURE.md", "Fable 5", "historical architecture evidence; later ratified as amended within DR-006 scope", "document", "Architecture ancestor for reusable authoring/export and review workflows.", "Separate authoring, review, release, and export concerns.", "Non-runnable requirements document.", ["Strong platform boundaries", "Useful workflow contract"], ["No runnable UI", "Later authority applies only as amended and within DR-006 scope"], ["Reusable authoring/export platform"], launchable=False),
    p("req-i1q-1004c", "Question Platform Binding Amendment", "I1Q-1004C", 121, "requirements", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1Q_1004C_COMBINED_HANDOFF.md", "Fable 5", "binding offline requirements evidence", "document", "Defines 23 entities, 17 workflows, RBAC, audit, security, and answer isolation.", "Govern questions as traceable educational records.", "Non-runnable contract and handoff.", ["Deep governance detail", "Security and answer isolation"], ["No runnable UI", "Does not establish learner design"], ["23-entity model", "17-workflow contract", "Answer isolation"], launchable=False),
    p("req-i1q-1008b", "Question Factory / Question Library Requirements Packet", "I1Q-1008B", 122, "requirements", f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1Q_DRJ_QUESTION_FACTORY_FABLE/20_OUTPUTS/individual/12_I1Q_1008B_MISSIONMEDOS_QUESTION_LIBRARY_APPLICATION.md", "Fable 5", "non-runnable product requirements evidence", "document", "Founder-aligned requirements for immediate Question Factory and long-term Question Library.", "Code-free authoring with provenance, review, rights, release, and audit.", "Non-runnable product requirements.", ["Connects immediate and long-term scope", "Explicit roles and provenance"], ["No visual prototype in packet", "Build authorization remains separate"], ["Question Factory to Question Library bridge"], handoff=f"{P}/MissionMed_AI_Sandbox/CLAUDE_FILES/I1Q_DRJ_QUESTION_FACTORY_FABLE/30_COMBINED/I1Q_1008B_FABLE_COMPLETE_COMBINED_HANDOFF.md", launchable=False),
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def file_uri(path: str) -> str:
    return "file://" + quote(path, safe="/")


KNOWN_DATALESS_SHA256 = {
    "/Users/brianb/Desktop/GIT_TEMP_HOLD/_REFERENCE_SYSTEMS/missionmed-codex-legacy/drj-jbank-engine/DrJ_JBank_WORKING.html": "3026cee38d1e608e6d4491028b91ce0c356a2cf06a2e1094b21cf86c3a3d3461",
}


def enrich(item: dict) -> dict:
    item = json.loads(json.dumps(item))
    source = Path(item["path"])
    item["source_exists"] = source.is_file()
    if source.is_file():
        st = source.stat()
        item["size_bytes"] = st.st_size
        item["allocated_bytes"] = getattr(st, "st_blocks", 0) * 512
        item["dataless"] = st.st_size > 0 and getattr(st, "st_blocks", 1) == 0
        item["mtime_utc"] = datetime.fromtimestamp(st.st_mtime, timezone.utc).isoformat().replace("+00:00", "Z")
        item["approximate_date"] = datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d")
        if item["dataless"]:
            item["sha256"] = KNOWN_DATALESS_SHA256.get(str(source))
            item["hash_basis"] = "prior authenticated duplicate/hash evidence; dataless source was not re-read"
        else:
            item["sha256"] = sha256(source)
            item["hash_basis"] = "computed from allocated local bytes"
        item["source_uri"] = file_uri(str(source))
        item["folder_uri"] = file_uri(str(source.parent))
    else:
        item.update({"size_bytes": None, "allocated_bytes": None, "dataless": None, "mtime_utc": None, "approximate_date": "unknown", "sha256": None, "hash_basis": "source unavailable", "source_uri": None, "folder_uri": None})
    handoff = item.get("handoff")
    item["handoff_exists"] = bool(handoff and Path(handoff).is_file())
    item["handoff_uri"] = file_uri(handoff) if item["handoff_exists"] else None
    item["screenshot_exists"] = bool(item.get("screenshot") and (SHOTS / item["screenshot"]).is_file())
    return item


def write_inventory(items: list[dict]) -> None:
    payload = {
        "schema_version": "i1q-3000-curated-prototype-inventory-v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "authority_note": "Discovery catalog only. Canonical inventory means canonicalized evidence index, not product ratification.",
        "date_note": "Approximate dates use local file modification time; they establish sequence evidence, not authorship or approval.",
        "privacy_note": "Raw learner names, transcripts, question text, and restricted exports are excluded from this inventory.",
        "item_count": len(items),
        "items": items,
    }
    (EVIDENCE / "curated_prototype_inventory.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def card(item: dict) -> str:
    shot = item.get("screenshot") if item.get("screenshot_exists") else None
    shot_state = "synthetic operator dashboard" if item["id"] == "i1q-platform" else "entry or home state, redacted where required"
    media = (
        f'<img src="I1Q-3000_SCREENSHOT_BOOK/{html.escape(shot)}" alt="{html.escape(shot_state.capitalize())} for {html.escape(item["title"])}" loading="lazy">'
        if shot else
        '<div class="placeholder" role="img" aria-label="No public screenshot; non-runnable or privacy-restricted evidence">NO PUBLIC CAPTURE<br><span>non-runnable or privacy-restricted</span></div>'
    )
    def link(label: str, uri: str | None, extra: str = "") -> str:
        if not uri:
            return f'<span class="action disabled" aria-disabled="true">{html.escape(label)} unavailable</span>'
        return f'<a class="action" href="{html.escape(uri)}" {extra}>{html.escape(label)}</a>'
    launch_uri = item.get("source_uri") if item["launchable_html"] else None
    server_route = None
    if launch_uri:
        server_route = (
            f"/t/cam-d/{quote(Path(item['path']).name)}"
            if item["id"] == "cam-d"
            else f"/p/{quote(item['id'])}"
        )
    platform_command = ""
    if item["id"] == "i1q-platform":
        launch_uri = None
        platform_command = '<button class="action copy" type="button" data-copy="cd /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008B-SourceFactory/i1q-question-platform &amp;&amp; I1Q_LOCAL_DEMO=1 /Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node src/server.mjs">Copy launch command</button>'
    search_parts = [
        item["title"], item["ticket"], item["authoring_ai"], item["status"],
        item["description"], item["interaction_model"], item["major_educational_idea"],
        *item["strengths"], *item["innovations"],
    ]
    # Index positive capability evidence, not ubiquitous negative boilerplate.
    # Otherwise a search such as "replay" would match every "No replay" row.
    if not item["replay_implementation"].startswith("No replay"):
        search_parts.append(item["replay_implementation"])
    if not item["zoom_notes_behavior"].startswith("No Zoom Notes"):
        search_parts.append(item["zoom_notes_behavior"])
    search_text = " ".join(search_parts).lower()
    return f'''
      <article class="prototype" data-lineage="{html.escape(item['lineage'])}" data-status="{html.escape(item['status'])}" data-title="{html.escape(item['title'].lower())}" data-ticket="{html.escape(item['ticket'].lower())}" data-author="{html.escape(item['authoring_ai'].lower())}" data-order="{item['approximate_creation_order']}" data-date="{html.escape(item['approximate_date'])}" data-interaction="{html.escape(item['interaction_model'].lower())}" data-keywords="{html.escape(search_text)}" data-education="{item['scores']['educational_progression']}" data-visual="{item['scores']['visual_quality']}" data-reuse="{item['scores']['reuse_potential']}">
        <div class="media">{media}<span class="lineage">{html.escape(item['lineage'])}</span></div>
        <div class="body">
          <div class="eyebrow">{html.escape(item['ticket'])} · {html.escape(item['approximate_date'])} approx.</div>
          <h2>{html.escape(item['title'])}</h2>
          <p class="description">{html.escape(item['description'])}</p>
          <dl><div><dt>Status</dt><dd>{html.escape(item['status'])}</dd></div><div><dt>Authoring AI</dt><dd>{html.escape(item['authoring_ai'])}</dd></div><div><dt>Interaction</dt><dd>{html.escape(item['interaction_model'])}</dd></div></dl>
          <div class="triad"><section><h3>Strengths</h3><ul>{''.join(f'<li>{html.escape(x)}</li>' for x in item['strengths'])}</ul></section><section><h3>Weaknesses</h3><ul>{''.join(f'<li>{html.escape(x)}</li>' for x in item['weaknesses'])}</ul></section><section><h3>Innovations</h3><ul>{''.join(f'<li>{html.escape(x)}</li>' for x in item['innovations'])}</ul></section></div>
          <details><summary>Full design record</summary><div class="detailgrid">
            <p><strong>Purpose:</strong> {html.escape(item['purpose'])}</p><p><strong>Educational idea:</strong> {html.escape(item['major_educational_idea'])}</p>
            <p><strong>Question flow:</strong> {html.escape(item['question_flow'])}</p><p><strong>Replay:</strong> {html.escape(item['replay_implementation'])}</p>
            <p><strong>Zoom Notes:</strong> {html.escape(item['zoom_notes_behavior'])}</p><p><strong>Explanation:</strong> {html.escape(item['explanation_system'])}</p>
            <p><strong>Analytics:</strong> {html.escape(item['analytics'])}</p><p><strong>Animation:</strong> {html.escape(item['animations'])}</p>
            <p><strong>Visual language:</strong> {html.escape(item['visual_language'])}</p><p><strong>CAM:</strong> {html.escape(item['cam_compliance'])}</p>
            <p><strong>Accessibility:</strong> {html.escape(item['accessibility'])}</p><p><strong>Responsive:</strong> {html.escape(item['responsiveness'])}</p>
            <p><strong>Standalone:</strong> {html.escape(item['standalone_capability'])}</p><p><strong>Daily Drills:</strong> {html.escape(item['daily_drills_integration'])}</p>
            <p class="wide"><strong>Dependencies:</strong> {html.escape(item['dependencies'])}</p><p class="wide path"><strong>Source:</strong> {html.escape(item['path'])}<br><strong>SHA-256:</strong> {html.escape(item.get('sha256') or 'unavailable')}</p>
          </div></details>
          <nav class="actions" aria-label="Artifact links for {html.escape(item['title'])}">{link('Launch Prototype', launch_uri, f'target="_blank" rel="noopener" data-server-route="{html.escape(server_route or "")}"')}{platform_command}{link('Open Source Folder', item.get('folder_uri'))}{link('Open Handoff', item.get('handoff_uri'))}<button class="action copy" type="button" data-copy="{html.escape(item['path'])}">Copy path</button></nav>
        </div>
      </article>'''


def build_gallery(items: list[dict]) -> None:
    data = "\n".join(card(item) for item in items)
    html_doc = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>I1Q-3000 · Dr. J Learning Studio Prototype Gallery</title>
<style>
:root{{--ink:#0b1d30;--ink2:#17324d;--paper:#f5f1e8;--white:#fff;--gold:#b68b35;--line:#d7d0c3;--muted:#5c6772;--focus:#0b6aa2}}
*[hidden]{{display:none!important}}
*{{box-sizing:border-box}}html{{scroll-behavior:smooth}}body{{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}a{{color:inherit}}.skip{{position:absolute;left:12px;top:-70px;background:#fff;padding:10px;z-index:10}}.skip:focus{{top:12px}}header{{background:var(--ink);color:#fff;padding:clamp(40px,7vw,88px) 24px 34px}}.shell{{width:min(1180px,100%);margin:auto}}.kicker{{font-size:.75rem;letter-spacing:.16em;text-transform:uppercase;color:#e0c687;font-weight:800}}h1{{font-family:Georgia,serif;font-size:clamp(2.2rem,6vw,4.7rem);line-height:.98;max-width:880px;margin:14px 0 18px;font-weight:500}}header p{{max-width:820px;color:#d4dde6;font-size:1.05rem}}.notice{{border-left:3px solid var(--gold);padding:8px 14px;background:#132b43;margin-top:26px;max-width:860px}}.stats{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:#3b4f62;margin-top:34px;border:1px solid #3b4f62}}.stat{{background:var(--ink);padding:18px}}.stat strong{{display:block;font:2rem/1 Georgia,serif;color:#e0c687}}main{{padding:28px 24px 72px}}.controls{{position:sticky;top:0;z-index:5;background:rgba(245,241,232,.97);border-bottom:1px solid var(--line);padding:14px 0;margin-bottom:26px}}.controlgrid{{display:grid;grid-template-columns:2fr 1fr;gap:12px}}label{{font-size:.74rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}}input,select{{width:100%;margin-top:5px;border:1px solid #697680;background:#fff;color:var(--ink);padding:11px 12px;font:inherit}}.filters{{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}}button{{font:inherit}}.filter,.action,.pager button{{border:1px solid #697680;background:#fff;color:var(--ink);padding:8px 11px;text-decoration:none;cursor:pointer}}.filter[aria-pressed="true"]{{background:var(--ink);color:#fff;border-color:var(--ink)}}:focus-visible{{outline:3px solid var(--focus);outline-offset:3px}}.summaryline{{display:flex;justify-content:space-between;gap:16px;align-items:end;margin:24px 0 14px}}.summaryline h2{{font:2rem/1.1 Georgia,serif;margin:0}}#count{{color:var(--muted)}}.museum{{display:grid;gap:20px}}.prototype{{display:grid;grid-template-columns:minmax(250px,34%) 1fr;background:var(--white);border:1px solid var(--line)}}.media{{position:relative;min-height:250px;background:#0d1824;overflow:hidden}}.media img{{display:block;width:100%;height:auto;max-height:430px;object-fit:contain;object-position:top left}}.placeholder{{height:100%;min-height:250px;display:grid;place-content:center;text-align:center;color:#5b6570;font-weight:800;letter-spacing:.1em;background:repeating-linear-gradient(135deg,#edf0f2,#edf0f2 14px,#e2e6e8 14px,#e2e6e8 28px)}}.placeholder span{{font-size:.7rem;font-weight:600;letter-spacing:.04em}}.lineage{{position:absolute;left:12px;top:12px;background:var(--ink);color:#fff;padding:5px 8px;font-size:.68rem;text-transform:uppercase;letter-spacing:.08em}}.body{{padding:24px}}.eyebrow{{color:#7b622c;font-weight:800;font-size:.72rem;letter-spacing:.09em;text-transform:uppercase}}.body h2{{font:2rem/1.1 Georgia,serif;margin:7px 0 8px}}.description{{font-size:1.05rem;margin-top:0}}dl{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--line);border-bottom:1px solid var(--line)}}dl div{{padding:11px 10px 11px 0}}dt{{font-size:.65rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}}dd{{margin:2px 0 0;font-size:.88rem}}.triad{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:18px 0}}h3{{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;margin:0 0 7px}}ul{{padding-left:18px;margin:0}}li{{margin:3px 0}}details{{border-top:1px solid var(--line);padding-top:12px}}summary{{cursor:pointer;font-weight:800}}.detailgrid{{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}}.detailgrid p{{font-size:.88rem;margin:10px 0}}.wide{{grid-column:1/-1}}.path{{overflow-wrap:anywhere;color:#374552}}.actions{{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}}.action{{font-size:.82rem}}.action:hover{{border-color:var(--gold)}}.disabled{{opacity:.48;cursor:not-allowed}}.pager{{display:flex;justify-content:center;align-items:center;gap:14px;margin-top:24px}}.empty{{padding:40px;border:1px dashed #697680;text-align:center}}footer{{border-top:1px solid var(--line);padding:28px 24px 48px;color:var(--muted)}}
@media(max-width:820px){{.prototype{{grid-template-columns:1fr}}.media{{min-height:210px;max-height:360px}}.triad,dl,.detailgrid{{grid-template-columns:1fr}}.wide{{grid-column:auto}}.controlgrid{{grid-template-columns:1fr}}}}
@media(max-width:480px){{header,main{{padding-left:16px;padding-right:16px}}.stats{{grid-template-columns:1fr}}.body{{padding:18px}}.summaryline{{align-items:start;flex-direction:column}}}}
@media(prefers-reduced-motion:reduce){{html{{scroll-behavior:auto}}}}
</style></head><body><a class="skip" href="#gallery">Skip to gallery</a>
<header><div class="shell"><div class="kicker">MissionMed · I1Q-3000 · Read-only design archaeology</div><h1>Dr. J Learning Studio Prototype Gallery</h1><p>A permanent, hash-backed local history of the Question Factory, Ladder, Daily Drills, and adjacent interaction experiments. It preserves alternatives for Founder inspection; it does not select or authorize a final product.</p><div class="notice"><strong>Authority boundary:</strong> discovery and comparison only. “Canonical inventory” means a normalized evidence index—not canonical product design, production readiness, or adoption.</div><div class="stats"><div class="stat"><strong>{len(items)}</strong> evidence records</div><div class="stat"><strong>{sum(1 for i in items if i['launchable_html'])}</strong> launchable shells</div><div class="stat"><strong>{len(set(i['lineage'] for i in items))}</strong> lineage labels</div></div></div></header>
<main><div class="shell"><section class="controls" aria-label="Gallery controls"><div class="controlgrid"><label>Search<input id="search" type="search" placeholder="Title, ticket, interaction, or preserved idea…"></label><label>Sort<select id="sort"><option value="order">Chronology (approximate mtime)</option><option value="ticket">Ticket</option><option value="author">Authoring AI</option><option value="interaction">Interaction model</option><option value="education">Educational quality</option><option value="visual">Visual quality</option><option value="status">Status</option></select></label></div><div class="filters" role="group" aria-label="Lineage filter"><button class="filter" data-filter="all" aria-pressed="true">All</button><button class="filter" data-filter="core" aria-pressed="false">Core</button><button class="filter" data-filter="direct-ancestor" aria-pressed="false">Direct ancestors</button><button class="filter" data-filter="adjacent" aria-pressed="false">Adjacent</button><button class="filter" data-filter="requirements" aria-pressed="false">Requirements</button><button class="filter" data-filter="design-donor" aria-pressed="false">Design donor</button><button class="filter" data-filter="supporting-artifact" aria-pressed="false">Supporting artifact</button></div></section><div class="summaryline"><h2 id="gallery" tabindex="-1">Museum drawer</h2><div id="count" aria-live="polite"></div></div><section class="museum" id="museum">{data}</section><div class="empty" id="empty" hidden>No records match these controls.</div><nav class="pager" aria-label="Gallery pages"><button id="prev" type="button">Previous</button><span id="page" aria-live="polite"></span><button id="next" type="button">Next</button></nav></div></main>
<footer><div class="shell">Screenshots are documentary interface evidence. Restricted source text and learner-identifying content are redacted or replaced by a privacy notice. Open links depend on local file/application permissions.</div></footer>
<script>
const museum=document.querySelector('#museum'),cards=[...museum.children],search=document.querySelector('#search'),sort=document.querySelector('#sort'),count=document.querySelector('#count'),empty=document.querySelector('#empty'),pageLabel=document.querySelector('#page'),prev=document.querySelector('#prev'),next=document.querySelector('#next');let filter='all',page=1;const pageSize=3;
if(location.protocol==='http:'||location.protocol==='https:')document.querySelectorAll('[data-server-route]').forEach(a=>a.href=a.dataset.serverRoute);
function visible(){{const q=search.value.trim().toLowerCase();return cards.filter(c=>(filter==='all'||c.dataset.lineage===filter)&&(!q||c.dataset.keywords.includes(q)))}}
function compare(a,b){{const k=sort.value;if(['education','visual','reuse'].includes(k))return Number(b.dataset[k])-Number(a.dataset[k])||Number(a.dataset.order)-Number(b.dataset.order);if(k==='order')return Number(a.dataset.order)-Number(b.dataset.order);return (a.dataset[k]||'').localeCompare(b.dataset[k]||'')||Number(a.dataset.order)-Number(b.dataset.order)}}
function render(){{const list=visible().sort(compare),pages=Math.max(1,Math.ceil(list.length/pageSize));page=Math.min(page,pages);cards.forEach(c=>c.hidden=true);list.slice((page-1)*pageSize,page*pageSize).forEach(c=>{{c.hidden=false;museum.appendChild(c)}});count.textContent=`${{list.length}} records · showing up to ${{pageSize}} at once`;pageLabel.textContent=`Page ${{page}} of ${{pages}}`;prev.disabled=page<=1;next.disabled=page>=pages;empty.hidden=list.length>0;}}
document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{{document.querySelectorAll('.filter').forEach(x=>x.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true');filter=b.dataset.filter;page=1;render()}}));search.addEventListener('input',()=>{{page=1;render()}});sort.addEventListener('change',()=>{{page=1;render()}});prev.addEventListener('click',()=>{{page--;render();document.querySelector('#gallery').focus?.()}});next.addEventListener('click',()=>{{page++;render();document.querySelector('#gallery').focus?.()}});document.addEventListener('click',async e=>{{const b=e.target.closest('[data-copy]');if(!b)return;try{{await navigator.clipboard.writeText(b.dataset.copy);const old=b.textContent;b.textContent='Copied';setTimeout(()=>b.textContent=old,1200)}}catch{{b.textContent='Copy unavailable'}}}});render();
</script></body></html>'''
    (ROOT / "I1Q-3000_PROTOTYPE_GALLERY.html").write_text(html_doc, encoding="utf-8")


def build_matrix(items: list[dict]) -> None:
    items = sorted(items, key=lambda item: item["approximate_creation_order"])
    short = dict(zip(DIMENSIONS, ["VQ", "NAV", "EP", "RP", "ZN", "LF", "QP", "LC", "RC", "EX", "CR", "IS", "SE", "AN", "AC", "SP", "DD", "AY", "TE", "SX", "RU"]))
    lines = [
        "# I1Q-3000 Design Comparison",
        "",
        "> Discovery comparison only. Ratings are evidence-weighted archaeological heuristics (0 absent/not applicable, 5 strongest recovered expression), not acceptance, medical validation, production certification, or a final design decision.",
        "",
        "## Full prototype matrix",
        "",
        "The table includes every curated gallery record. `NR` means non-runnable evidence. Dates are approximate filesystem modification dates.",
        "",
        "| Prototype | Ticket | Date | Status | VQ | NAV | EP | RP | ZN | LF | QP | LC | RC | EX | CR | IS | SE | AN | AC | SP | DD | AY | TE | SX | RU |",
        "|---|---|---:|---|" + "---:|" * 21,
    ]
    for i in items:
        vals = [str(i["scores"][d]) for d in DIMENSIONS]
        lines.append("| " + " | ".join([i["title"], i["ticket"], i["approximate_date"], i["status"], *vals]) + " |")
    lines += ["", "### Dimension key", "", " · ".join(f"`{short[d]}` {d.replace('_',' ')}" for d in DIMENSIONS), "", "## Comparison cautions", "", "- I1Q-2002 compared Rounds with a passive reduction of Ladder, not I1Q-2000's full answer/confidence/feedback interaction; its historical verdict cannot reject the stronger earlier model.", "- Educational leaders describe prototype design quality, not medically validated outcomes. Generated MCQs, explanations, and clinical chains remain review-gated.", "- Current runtime integration is unconfirmed. Replay, Zoom Notes, analytics, and protected consumer wiring are evaluated as interface concepts where live binding is absent.", "- Adjacent donors can lead a dimension without becoming direct I1Q lineage or a whole-product recommendation.", "", "## Category leaders", ""]
    preserve = {
        "visual_quality": "CAM D visual system; Grand Rounds stage continuity; restrained Ladder assessment hierarchy.",
        "navigation": "T16 browse/session/runtime continuity; I1Q-2001 Arena-to-review path.",
        "educational_progression": "I1Q-2000 three-rung transfer; I1Q-2002 bounded Rounds rail.",
        "replay": "I1Q-2001 exact-moment replay; VDRL node-seek context.",
        "zoom_notes": "I1Q-2001 Drill Notes integration; restricted Zoom Notes print-margin pattern.",
        "learning_flow": "I1Q-2001 full-breadth quiz plus selective climb; I1Q-2002 linear rounds pacing.",
        "question_progression": "Legacy paired recall/vignette; Ladder recall-to-clinical climb.",
        "ladder_concepts": "I1Q-2000 explicit three rungs; I1Q-2001 embedded selective climb.",
        "rounds_concepts": "I1Q-2002 foundation-to-payoff rail; Grand Rounds attention-timed pearl.",
        "explanation_philosophy": "Ladder layered explanations; Grand Rounds one pearl at attention peak.",
        "clinical_reasoning": "I1Q-2002 consequence/deeper/decision sequence; QBANK-003 structured explanation.",
        "interaction_speed": "T13/T14 spoken recall and direct self-report; 2522F bounded auto-flow.",
        "student_engagement": "Ladder visible progression; Grand Rounds ceremony with clear authority limits.",
        "animation": "2522F motion-as-state continuity; Ladder rung climb.",
        "accessibility": "914B multi-viewport evidence; 2522F roving focus/reduced-motion contracts.",
        "standalone_potential": "I1Q-2000 and legacy JBank single-file loops.",
        "daily_drills_integration": "I1Q-2001 first; T16 as pre-Ladder information-architecture ancestor.",
        "analytics": "I1Q Platform governance analytics; Grand Rounds 2601F score/mastery/readiness separation.",
        "teacher_experience": "I1Q Platform 17 workflows; Timeline 407F provenance/version patterns.",
        "student_experience": "I1Q-2001 end-to-end flow; I1Q-2000 focused transfer loop.",
        "reuse_potential": "I1Q-2001 seam map; I1Q Platform provenance/review contracts.",
    }
    discard = {
        "visual_quality": "Decorative photorealism without licensed/authoritative assets; dense control-room chrome in learner flow.",
        "navigation": "Permanent director rails and scene pickers as learner navigation.",
        "educational_progression": "Server-graded fiction for spoken drills; ceremony that gates action without teaching value.",
        "replay": "Replay labels without a verified source/time binding.",
        "zoom_notes": "Private note content in public captures or shared analytics.",
        "learning_flow": "Unbounded branches and duplicate modes with no clear contract.",
        "question_progression": "Merging authentic questions or hiding authored-versus-source status.",
        "ladder_concepts": "Gamified climb that treats XP as medical mastery.",
        "rounds_concepts": "Authored clinical claims released without physician gate.",
        "explanation_philosophy": "Verdict overlays that cover the question or clue.",
        "clinical_reasoning": "Unsupported readiness or diagnostic-authority claims.",
        "interaction_speed": "Mandatory Continue buttons between every stage.",
        "student_engagement": "Competitive authority, fake readiness, or overlong ceremony.",
        "animation": "Motion as decoration, title cards explaining motion, or information lost under reduced motion.",
        "accessibility": "Desktop-only assumptions, missing focus restoration, and unlabeled timelines.",
        "standalone_potential": "Calling a shell standalone when essential runtime/video services are absent.",
        "daily_drills_integration": "Replacing authentic drill behavior with generic MCQ grading.",
        "analytics": "Conflating game score, mastery, and exam readiness.",
        "teacher_experience": "Editing without provenance, version, rights, or review state.",
        "student_experience": "Question-covering feedback and dense operator controls.",
        "reuse_potential": "Copying trade dress, private data, or unverified service dependencies.",
    }
    leader_ids = {
        "visual_quality": ("cam-d", "gr-2522f"),
        "navigation": ("i1q-2001", "t16"),
        "educational_progression": ("i1q-2002", "i1q-2000"),
        "replay": ("i1q-2001", "vdrl-090-a"),
        "zoom_notes": ("i1q-2001", "vdrl-090-a"),
        "learning_flow": ("i1q-2001", "i1q-2002"),
        "question_progression": ("i1q-2000", "legacy-jbank-03"),
        "ladder_concepts": ("i1q-2000", "i1q-2001"),
        "rounds_concepts": ("i1q-2002", "gr-2600f"),
        "explanation_philosophy": ("i1q-2000", "i1q-2001"),
        "clinical_reasoning": ("i1q-2002", "i1q-2000"),
        "interaction_speed": ("t13", "t14"),
        "student_engagement": ("gr-2601f", "stat-914b"),
        "animation": ("gr-2522f", "i1q-2000"),
        "accessibility": ("stat-914b", "gr-2522f"),
        "standalone_potential": ("i1q-2000", "legacy-jbank-03"),
        "daily_drills_integration": ("i1q-2001", "t16"),
        "analytics": ("i1q-platform", "gr-2601f"),
        "teacher_experience": ("i1q-platform", "timeline-407f"),
        "student_experience": ("i1q-2001", "i1q-2000"),
        "reuse_potential": ("i1q-2001", "i1q-platform"),
    }
    by_id = {item["id"]: item for item in items}
    for d in DIMENSIONS:
        best, second = (by_id[ident] for ident in leader_ids[d])
        lines += [f"### {d.replace('_',' ').title()}", "", f"- Best recovered expression: **{best['title']}**.", f"- Second: **{second['title']}**.", f"- Preserve: {preserve[d]}", f"- Discard: {discard[d]}", ""]
    lines += ["## Interpretation guardrails", "", "- A high rating means a strong expression in this historical corpus, not a recommendation to ship that prototype.", "- Adjacent Grand Rounds, STAT, Timeline, and CAM records are pattern donors, not direct I1Q lineage.", "- Restricted/authentic source data is evaluated at the interaction-contract level; the report does not reproduce question text or learner names.", "- Conflicting or ‘canonical’-named files remain labeled as contested/local unless authority records ratify them.", ""]
    (ROOT / "I1Q-3000_DESIGN_COMPARISON.md").write_text("\n".join(lines), encoding="utf-8")


def build_shot_index(items: list[dict]) -> None:
    lines = ["# I1Q-3000 Screenshot Book", "", "Privacy-safe documentary captures. Restricted content is redacted; non-runnable or unsafe-to-display artifacts use a labeled placeholder in the gallery.", "", "| Prototype | Capture | Evidence status |", "|---|---|---|"]
    for item in items:
        shot = item.get("screenshot")
        exists = bool(shot and (SHOTS / shot).is_file())
        label = f"[{shot}](./{shot})" if exists else "Not captured"
        reason = "representative local capture" if exists else ("non-runnable evidence" if not item["launchable_html"] else "privacy/dependency exception documented")
        lines.append(f"| {item['title']} | {label} | {reason} |")
    primary = {item.get("screenshot") for item in items if item.get("screenshot")}
    extras = sorted(path.name for path in SHOTS.glob("*.jpg") if path.name not in primary)
    lines += ["", "## Additional state and responsive captures", "", "These supplement the one-per-card representative files with question, replay, explanation, verdict, analytics, results, unique-interaction, tablet, and mobile states. Files ending in `_synthetic` are converted copies of pre-existing synthetic QA evidence; exact source and digest lineage is recorded in `../evidence/screenshot_provenance.json`.", ""]
    lines += [f"- [{name}](./{name})" for name in extras]
    lines.append("")
    (SHOTS / "README.md").write_text("\n".join(lines), encoding="utf-8")


def build_launch_manifest(items: list[dict]) -> None:
    routes = []
    for item in items:
        if item["launchable_html"] and item["source_exists"] and item["id"] not in {"i1q-platform", "zoom-notes-family", "cam-d"}:
            routes.append({"id": item["id"], "type": "file", "path": item["path"]})
    # CAM must be served as a tree for relative assets.
    cam = next(i for i in items if i["id"] == "cam-d")
    routes.append({"id": "cam-d", "type": "tree", "path": str(Path(cam["path"]).parent)})
    routes.append({"id": "i1q-3000-gallery", "type": "tree", "path": str(ROOT)})
    (EVIDENCE / "launch_allowlist.json").write_text(json.dumps({"routes": routes}, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    SHOTS.mkdir(parents=True, exist_ok=True)
    items = [enrich(item) for item in ITEMS]
    chronological = sorted(items, key=lambda item: (item.get("mtime_utc") or "9999", item["order"]))
    for rank, item in enumerate(chronological, start=1):
        item["approximate_creation_order"] = rank
    write_inventory(items)
    build_gallery(items)
    build_matrix(items)
    build_shot_index(items)
    build_launch_manifest(items)
    missing = [item["path"] for item in items if not item["source_exists"]]
    print(json.dumps({"items": len(items), "launchable": sum(i["launchable_html"] for i in items), "missing_sources": missing}, indent=2))


if __name__ == "__main__":
    main()
