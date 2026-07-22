# I1Q-4000 Learning Studio Educational Rationale

## Status and evidence limit

I1Q-4000 demonstrates four learning contracts with **eight bundled synthetic question occurrences and seeded synthetic history**. It contains no real Dr. J questions, Gold Set records, learner records, medical curriculum, validated scoring, or production recommendations. The prototype is suitable for local P4 interaction review only; it is not medically validated, psychometrically validated, deployed, production-integrated, or canonical product adoption.

The rationale draws on I1Q-3000's recovered design evidence: truthful open recall, confidence before verdict, layered explanation, recall-to-transfer progression, bounded Rounds, source-aware replay, and separation of behavior, mastery, and readiness. These are hypotheses to test, not proof of educational efficacy.

## Educational architecture

The Learning Studio separates two decisions that are often conflated:

1. **What content is in scope?** The learner selects an exact drill-and-subject intersection, optionally focused on bundled weak-concept signals or browser-local favorites.
2. **How will the learner work with it?** The learner selects Quick Review, Board Review, Clinical Mastery, or Adaptive.

Separating scope from instructional method makes single-drill, multi-drill, single-subject, and mixed-subject sessions comparable. The queue contains only unique eligible synthetic occurrences. A short eligible set stays short; the system does not repeat questions or silently introduce content outside the declared scope. That preserves interpretability of the learning experience even though the fixture catalog is small.

## Quick Review: breadth through truthful open recall

Quick Review asks the learner to say or think an answer before revealing the bundled source answer, then self-report **I knew it**, **Partial**, or **Missed it**. There is no microphone, speech recognition, server grading, or claim that the system can judge an unobserved spoken response.

The intended educational value is retrieval practice with low interaction cost. The three-level self-report preserves more uncertainty than a correct/missed binary while remaining lightweight. Immediate concise feedback supports rapid breadth. The limitation is equally important: self-report is subjective and is not evidence of objective accuracy, durable retention, or mastery.

## Board Review: application and calibration

Board Review requires the learner to select an answer and record low, medium, or high confidence before locking it. Feedback remains closed until commitment. This ordering protects the calibration signal from hindsight and lets review distinguish a confident miss from an uncertain answer.

After commitment, the learner can inspect a concise answer, a deeper explanation, and why the alternatives do not fit the supplied synthetic rule. The design hypothesis is that answer commitment plus layered remediation supports board-style application without forcing every learner through the longest explanation.

The prototype does not establish item quality, difficulty, discrimination, reliability, or examination validity. Its synthetic answer-key match is an interaction fact, not an exam score.

## Clinical Mastery: a three-stage session sequence

Clinical Mastery labels successive questions as **Source recall**, **Mechanism**, and **Decision**. The sequence is intended to make increasing reasoning depth visible across a session: retrieve a declared relationship, reason through its mechanism or order, then apply it to a decision-shaped prompt. Confidence is captured before the verdict, as in Board Review.

This implementation is **not the full I1Q-2000 per-concept Ladder**. It does not guarantee that three successive questions test the same assertion through three validated rungs, nor does it reproduce the entire earlier calibration and convergence model. It is an interactive P4 demonstration of a three-stage session sequence.

The optional Rounds panel is kept separate as a bounded extension: a foundation, a connection, and a payoff prompt derived from the current synthetic item. Opening it does not replace the core response sequence or establish a physician-approved clinical link.

I1Q-2002's historical preference for Rounds is not inherited as product canon. That bakeoff compared Rounds against a reduced, largely passive Ladder rather than the strongest recovered interactive Ladder. I1Q-4000 therefore keeps the Ladder-inspired sequence and Rounds-inspired branch available as distinct review hypotheses. No new Ladder-versus-Rounds verdict is made here.

## Adaptive: transparent orchestration, not a fourth pedagogy

Adaptive uses the same question and feedback surfaces as the other applied templates. Its distinct function is queue orchestration: within the exact selected intersection, it sorts the bundled synthetic review-priority score and explains “Why this item?” for each selection. Ties are deterministic.

The score is fixture metadata. It is not inferred from learner performance, recency, uncertainty, favorites, diagnosis, medical weakness, or a validated knowledge model. If higher-priority items do not fill the requested length, lower-priority eligible items may follow with a disclosure; the selection never broadens beyond the chosen drill/subject scope.

This makes the adaptive logic inspectable for Founder review and avoids the educational hazard of presenting unexplained personalization as authority. A future adaptive system would require a separately approved evidence model, update rules, fairness analysis, minimum data requirements, calibration, and learner-facing explanation contract.

## Feedback, explanation, replay, and notes

The prototype treats feedback depth as learner-controlled after response commitment:

- the **concise** layer states the supplied synthetic answer and teaching point;
- the **deep** layer explains the declared relationship in more detail;
- the **alternatives** layer addresses the remaining options individually;
- the **clinical bridge** offers a transfer-oriented next thought without claiming a validated medical case.

Replay and Zoom Notes are interface placeholders. Synthetic time anchors and sidecar text allow review of where source support would appear, but there is no media join, transcript/node provenance, rights/privacy state, or Zoom content. Browser-local question notes are a separate learner-authored surface and must not be mistaken for source notes. Users are warned not to enter PHI or sensitive information.

## Debrief and continuity

Pause/resume, favorites, flags, and question navigation let a learner preserve intent across a local session. The debrief reports the session's completed interactions and offers a defensible next route, such as review or another bounded session. These features are continuity hypotheses; browser-local persistence is not a longitudinal learning record.

Quick self-reports and answer-key matches should remain separate in any future evidence model. Confidence, explanation opens, replay requests, favorites, and flags are behaviors or preferences; none alone proves learning.

## Analytics and predictive-score boundary

The eight analytics views—current session, lifetime, mastery proxy, heatmaps, trends, replay usage, explanation usage, and confidence history—are deliberately separated. Where a live local session exists, the interface identifies browser-local events and synthetic answer-key matches. Historical charts use eight seeded demonstration sessions and say so.

The prediction card is a deterministic fixture demonstration:

- current seeded prediction: **72**;
- rolling mean of the last three seeded predictions: **70**;
- seeded lifetime trend: **+11**;
- fixture-supplied synthetic model standard error: **3.06**;
- normal-approximation 95% interval, rounded outward: **66–78**.

These numbers are not estimated from a learner, calibrated, validated, medically meaningful, or suitable for an exam-readiness decision. The interval demonstrates disclosure layout and model-method copy; it does not confer statistical legitimacy on the fixture. “Mastery proxy” likewise remains a simulated presentation concept, not a mastery determination.

## Time targets and efficacy claims

The interface displays target ranges of 8–12 minutes for Quick Review, 15–20 for Board Review, 20–30 for Clinical Mastery, and 12–18 for Adaptive. These are unvalidated product hypotheses, not measured completion times, dosage recommendations, or evidence of learning efficiency. The requested 30–60-minute Founder exploration window has not been timed as a usability study.

No claim is made that one template is universally superior. Appropriate sequencing, session length, spacing, difficulty, feedback timing, and transfer benefit require learner research and psychometric/educational evaluation using approved content.

## Required gates before educational adoption

Production or curricular use would require, at minimum:

1. approved question and explanation provenance with medical review;
2. a defined instructional objective and population for each template;
3. usability and accessibility research with learners;
4. psychometric and learning-outcome evaluation, including calibration and retention;
5. validated semantics for weak concepts, mastery, and prediction;
6. privacy-safe event collection and retention rules;
7. verified replay/notes source, rights, and synchronization contracts;
8. Founder, physician, product, accessibility, privacy, security, and release authorization.

Until those gates are met, I1Q-4000 should be read as a high-fidelity educational interaction hypothesis—not as an efficacy result, clinical learning authority, or learner release.
