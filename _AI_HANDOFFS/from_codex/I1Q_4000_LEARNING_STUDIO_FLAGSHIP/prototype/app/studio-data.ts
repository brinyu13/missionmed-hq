export type TemplateId =
  | "quick-review"
  | "board-review"
  | "clinical-mastery"
  | "adaptive";

export type TemplateDefinition = {
  id: TemplateId;
  name: string;
  shortName: string;
  eyebrow: string;
  description: string;
  duration: string;
  contract: string;
  accent: string;
  icon: string;
};

export type DrillDefinition = {
  id: string;
  name: string;
  date: string;
  subjectIds: string[];
  questionCount: number;
  sourceKind: "Synthetic drill";
};

export type SubjectDefinition = {
  id: string;
  name: string;
  shortName: string;
  tint: string;
};

export type StudioQuestion = {
  id: string;
  drillId: string;
  subjectId: string;
  topic: string;
  prompt: string;
  stem: string;
  options: string[];
  correctIndex: number;
  concise: string;
  deepDive: string;
  alternatives: string[];
  clinicalBridge: string;
  weakSignal: number;
  replay: {
    anchor: string;
    duration: string;
    status: "placeholder" | "unavailable";
  };
  zoomNote: string;
};

export type DemoHistoryPoint = {
  id: string;
  label: string;
  date: string;
  observed: number;
  confidence: number;
  replayOpens: number;
  explanationDepth: number;
  predicted: number;
};

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: "quick-review",
    name: "Quick Review",
    shortName: "Quick",
    eyebrow: "Recall",
    description:
      "Move through source-shaped prompts, reveal a concise teaching point, and self-report what you knew.",
    duration: "Target 8–12 min",
    contract: "Immediate reveal · truthful self-report",
    accent: "mint",
    icon: "spark",
  },
  {
    id: "board-review",
    name: "Board Review",
    shortName: "Board",
    eyebrow: "Application",
    description:
      "Commit an answer and confidence level before opening a board-style explanation and debrief.",
    duration: "Target 15–20 min",
    contract: "Commit first · bounded feedback",
    accent: "blue",
    icon: "target",
  },
  {
    id: "clinical-mastery",
    name: "Clinical Mastery",
    shortName: "Mastery",
    eyebrow: "Transfer",
    description:
      "Move through a three-stage reasoning sequence, then explore an optional bounded Rounds branch.",
    duration: "Target 20–30 min",
    contract: "Sequential depth · confidence before verdict",
    accent: "gold",
    icon: "ladder",
  },
  {
    id: "adaptive",
    name: "Adaptive",
    shortName: "Adaptive",
    eyebrow: "Orchestration",
    description:
      "Use a transparent deterministic prototype rule to rank the bundled synthetic review-priority signal.",
    duration: "Target 12–18 min",
    contract: "Explainable selection · simulated logic",
    accent: "violet",
    icon: "route",
  },
];

export const SUBJECTS: SubjectDefinition[] = [
  {
    id: "syn-cardio",
    name: "Cardiovascular Systems",
    shortName: "Cardio",
    tint: "rose",
  },
  {
    id: "syn-micro",
    name: "Microbial Systems",
    shortName: "Micro",
    tint: "aqua",
  },
  {
    id: "syn-neuro",
    name: "Neural Systems",
    shortName: "Neuro",
    tint: "violet",
  },
  {
    id: "syn-endo",
    name: "Regulatory Systems",
    shortName: "Endo",
    tint: "amber",
  },
];

export const DRILLS: DrillDefinition[] = [
  {
    id: "syn-drill-0718",
    name: "Signals & Sequences",
    date: "Jul 18",
    subjectIds: ["syn-cardio", "syn-neuro"],
    questionCount: 2,
    sourceKind: "Synthetic drill",
  },
  {
    id: "syn-drill-0716",
    name: "Patterns Under Pressure",
    date: "Jul 16",
    subjectIds: ["syn-micro", "syn-endo"],
    questionCount: 2,
    sourceKind: "Synthetic drill",
  },
  {
    id: "syn-drill-0712",
    name: "Mechanism to Decision",
    date: "Jul 12",
    subjectIds: ["syn-cardio", "syn-micro"],
    questionCount: 2,
    sourceKind: "Synthetic drill",
  },
  {
    id: "syn-drill-0708",
    name: "Feedback & Regulation",
    date: "Jul 08",
    subjectIds: ["syn-endo", "syn-neuro"],
    questionCount: 2,
    sourceKind: "Synthetic drill",
  },
];

export const QUESTIONS: StudioQuestion[] = [
  {
    id: "SYN-OCC-0718-01",
    drillId: "syn-drill-0718",
    subjectId: "syn-cardio",
    topic: "Signal sequence",
    prompt: "Identify the initiating signal",
    stem: "In this fictional training model, the source card defines Signal A as the event that begins Pattern Delta. Which event initiates the sequence?",
    options: ["Signal A", "Signal B", "Checkpoint C", "Outcome D"],
    correctIndex: 0,
    concise:
      "Signal A is the designated starting event in this synthetic model.",
    deepDive:
      "The prototype is testing whether a learner can preserve sequence order from a source-shaped prompt before transferring the relationship into a more applied frame.",
    alternatives: [
      "Signal B follows the initiating event.",
      "Checkpoint C is a later verification point.",
      "Outcome D is the modeled endpoint, not the trigger.",
    ],
    clinicalBridge:
      "Transfer step: if Signal A were absent, predict which downstream checkpoint would fail first in the fictional sequence.",
    weakSignal: 72,
    replay: { anchor: "14:22", duration: "00:38", status: "placeholder" },
    zoomNote:
      "Prototype sidecar: sequence = A → B → C → D. Not sourced from Zoom.",
  },
  {
    id: "SYN-OCC-0718-02",
    drillId: "syn-drill-0718",
    subjectId: "syn-neuro",
    topic: "Threshold logic",
    prompt: "Locate the threshold",
    stem: "A fictional pathway remains inactive below Level 4 and activates at Level 4 or higher. Which observation crosses the defined threshold?",
    options: ["Level 2", "Level 3", "Level 4", "No level can activate it"],
    correctIndex: 2,
    concise:
      "Level 4 is the first value that meets the model’s stated threshold.",
    deepDive:
      "This synthetic item demonstrates extraction of an explicit decision boundary. The studio keeps the source rule visible so the interaction, not medical knowledge, is under review.",
    alternatives: [
      "Level 2 remains below threshold.",
      "Level 3 remains below threshold.",
      "The prompt explicitly permits activation.",
    ],
    clinicalBridge:
      "Rounds branch: decide how the fictional pathway changes if the threshold shifts from Level 4 to Level 5.",
    weakSignal: 48,
    replay: { anchor: "21:04", duration: "00:29", status: "placeholder" },
    zoomNote: "Prototype sidecar: the threshold is inclusive at Level 4.",
  },
  {
    id: "SYN-OCC-0716-01",
    drillId: "syn-drill-0716",
    subjectId: "syn-micro",
    topic: "Pattern recognition",
    prompt: "Match the defining pattern",
    stem: "The fictional reference defines Pattern K as three short pulses followed by one long pulse. Which sequence matches Pattern K?",
    options: [
      "short · short · short · long",
      "long · short · long",
      "short · long · short",
      "four long pulses",
    ],
    correctIndex: 0,
    concise:
      "Pattern K is the three-short, one-long sequence stated in the reference.",
    deepDive:
      "The question models exact pattern recognition without importing a real organism, disease, or diagnostic claim.",
    alternatives: [
      "This sequence changes both count and order.",
      "This sequence alternates rather than grouping three short pulses.",
      "This sequence omits the defining short-pulse cluster.",
    ],
    clinicalBridge:
      "Board bridge: distinguish a defining feature from a merely associated feature when both are present.",
    weakSignal: 83,
    replay: { anchor: "08:41", duration: "00:44", status: "placeholder" },
    zoomNote: "Prototype sidecar: defining pattern has four total pulses.",
  },
  {
    id: "SYN-OCC-0716-02",
    drillId: "syn-drill-0716",
    subjectId: "syn-endo",
    topic: "Feedback loop",
    prompt: "Trace the feedback response",
    stem: "In a fictional negative-feedback loop, rising Output R reduces Signal S. If Output R rises, what happens next under the stated model?",
    options: [
      "Signal S decreases",
      "Signal S increases",
      "Output R disappears instantly",
      "The loop reverses permanently",
    ],
    correctIndex: 0,
    concise: "The model states that rising Output R reduces Signal S.",
    deepDive:
      "This interaction tests directionality in a declared synthetic loop. It makes no claim about a real physiological system.",
    alternatives: [
      "An increase would be positive feedback, not the relationship supplied.",
      "The model describes reduction, not instantaneous elimination.",
      "No permanent reversal is specified.",
    ],
    clinicalBridge:
      "Transfer step: predict the qualitative effect if the reducing link were temporarily blocked.",
    weakSignal: 61,
    replay: { anchor: "31:12", duration: "00:35", status: "placeholder" },
    zoomNote: "Prototype sidecar: Output R ─| Signal S.",
  },
  {
    id: "SYN-OCC-0712-01",
    drillId: "syn-drill-0712",
    subjectId: "syn-cardio",
    topic: "Cause and consequence",
    prompt: "Separate cause from consequence",
    stem: "A fictional case card states: Change M occurs first, Marker N rises second, and Effect P appears last. Which finding is the earliest event?",
    options: ["Change M", "Marker N", "Effect P", "All occur simultaneously"],
    correctIndex: 0,
    concise:
      "Change M is explicitly placed first in the synthetic case sequence.",
    deepDive:
      "A future per-concept Ladder could revisit this assertion as recall, mechanism ordering, and consequence prediction. This P4 demonstrates a three-stage session sequence instead.",
    alternatives: [
      "Marker N is second.",
      "Effect P is last.",
      "The source card provides a sequence, not simultaneity.",
    ],
    clinicalBridge:
      "Clinical Mastery rung: if Marker N fails to rise, which declared link should be inspected first?",
    weakSignal: 89,
    replay: { anchor: "05:18", duration: "00:51", status: "placeholder" },
    zoomNote: "Prototype sidecar: M precedes N; N precedes P.",
  },
  {
    id: "SYN-OCC-0712-02",
    drillId: "syn-drill-0712",
    subjectId: "syn-micro",
    topic: "Evidence weighting",
    prompt: "Choose the discriminating clue",
    stem: "Two fictional patterns share Features 1 and 2. Only Pattern Blue includes Feature 3. Which feature best distinguishes Pattern Blue?",
    options: [
      "Feature 1",
      "Feature 2",
      "Feature 3",
      "The shared features together",
    ],
    correctIndex: 2,
    concise: "Feature 3 is the only stated discriminator for Pattern Blue.",
    deepDive:
      "The explanation foregrounds the discriminating clue before offering deeper reasoning, mirroring the concise-first evidence from I1Q-3000.",
    alternatives: [
      "Feature 1 is shared by both patterns.",
      "Feature 2 is shared by both patterns.",
      "Combining shared features still does not distinguish the patterns.",
    ],
    clinicalBridge:
      "Board bridge: rank clues by discriminatory value rather than by how memorable they feel.",
    weakSignal: 56,
    replay: { anchor: "18:36", duration: "00:33", status: "unavailable" },
    zoomNote: "Prototype sidecar: Feature 3 is unique to Pattern Blue.",
  },
  {
    id: "SYN-OCC-0708-01",
    drillId: "syn-drill-0708",
    subjectId: "syn-neuro",
    topic: "Branch decision",
    prompt: "Follow the decision branch",
    stem: "A fictional decision tree routes State X to Path 1 when Check Q is present and to Path 2 when it is absent. State X has Check Q. Which path follows?",
    options: ["Path 1", "Path 2", "Both paths", "The tree cannot decide"],
    correctIndex: 0,
    concise: "The presence of Check Q routes State X to Path 1.",
    deepDive:
      "This is a transparent conditional branch. Adaptive selection can cite this topic as weak, but the prototype does not infer a real clinical deficiency.",
    alternatives: [
      "Path 2 is reserved for absence of Check Q.",
      "The tree defines mutually exclusive branches.",
      "The supplied condition is sufficient for the fictional tree.",
    ],
    clinicalBridge:
      "Rounds branch: identify the minimum new evidence that would change the fictional decision.",
    weakSignal: 76,
    replay: { anchor: "27:09", duration: "00:42", status: "placeholder" },
    zoomNote: "Prototype sidecar: Check Q present → Path 1.",
  },
  {
    id: "SYN-OCC-0708-02",
    drillId: "syn-drill-0708",
    subjectId: "syn-endo",
    topic: "Trend interpretation",
    prompt: "Interpret the direction of change",
    stem: "A synthetic series moves from 8 to 6 to 4 across three checkpoints. Which description is supported by the supplied observations?",
    options: [
      "A downward trend",
      "An upward trend",
      "No change",
      "A cyclical pattern",
    ],
    correctIndex: 0,
    concise: "The observed values decrease at each checkpoint.",
    deepDive:
      "The studio distinguishes an observed local trend from a causal or readiness claim. Three points show direction, not why it occurred.",
    alternatives: [
      "The values do not increase.",
      "Each checkpoint differs from the prior one.",
      "No repeated rise-and-fall cycle is shown.",
    ],
    clinicalBridge:
      "Transfer step: name one additional observation needed before making a causal interpretation.",
    weakSignal: 43,
    replay: { anchor: "11:50", duration: "00:28", status: "placeholder" },
    zoomNote:
      "Prototype sidecar: observations are 8 → 6 → 4; cause remains unspecified.",
  },
];

export const DEMO_HISTORY: DemoHistoryPoint[] = [
  {
    id: "D-01",
    label: "S1",
    date: "Jun 21",
    observed: 58,
    confidence: 72,
    replayOpens: 1,
    explanationDepth: 38,
    predicted: 61,
  },
  {
    id: "D-02",
    label: "S2",
    date: "Jun 25",
    observed: 62,
    confidence: 68,
    replayOpens: 2,
    explanationDepth: 45,
    predicted: 63,
  },
  {
    id: "D-03",
    label: "S3",
    date: "Jun 29",
    observed: 59,
    confidence: 61,
    replayOpens: 3,
    explanationDepth: 71,
    predicted: 64,
  },
  {
    id: "D-04",
    label: "S4",
    date: "Jul 03",
    observed: 66,
    confidence: 70,
    replayOpens: 1,
    explanationDepth: 52,
    predicted: 66,
  },
  {
    id: "D-05",
    label: "S5",
    date: "Jul 07",
    observed: 69,
    confidence: 73,
    replayOpens: 2,
    explanationDepth: 58,
    predicted: 67,
  },
  {
    id: "D-06",
    label: "S6",
    date: "Jul 11",
    observed: 67,
    confidence: 65,
    replayOpens: 4,
    explanationDepth: 77,
    predicted: 68,
  },
  {
    id: "D-07",
    label: "S7",
    date: "Jul 15",
    observed: 73,
    confidence: 75,
    replayOpens: 2,
    explanationDepth: 63,
    predicted: 70,
  },
  {
    id: "D-08",
    label: "S8",
    date: "Jul 19",
    observed: 76,
    confidence: 78,
    replayOpens: 1,
    explanationDepth: 49,
    predicted: 72,
  },
];

export const FOUNDER_DECISIONS = [
  {
    id: "template-contracts",
    title: "Learning template contracts",
    question:
      "Do the four templates feel meaningfully distinct without fragmenting the product?",
    options: ["Approve direction", "Revise boundaries", "Needs comparison"],
  },
  {
    id: "prediction-framing",
    title: "Prediction framing",
    question:
      "Is the simulated score useful while staying unmistakably separate from readiness?",
    options: ["Framing works", "Reduce prominence", "Remove from P4"],
  },
  {
    id: "future-integrations",
    title: "Replay + Zoom Notes placeholders",
    question:
      "Do the placeholders explain future integrations without implying they are connected?",
    options: ["Clear boundary", "Needs stronger label", "Reframe interaction"],
  },
];

export const CATALOG_DIGEST = "i1q4000-synthetic-catalog-v1-20260722";
export const STORAGE_KEY = "missionmed.learning-studio.i1q4000.v1";
