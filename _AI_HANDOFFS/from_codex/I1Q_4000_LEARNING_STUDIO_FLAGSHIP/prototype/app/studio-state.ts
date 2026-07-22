import {
  CATALOG_DIGEST,
  QUESTIONS,
  type StudioQuestion,
  type TemplateId,
} from "./studio-data.ts";

export type StudioView =
  | "home"
  | "studio"
  | "sessions"
  | "favorites"
  | "analytics"
  | "decisions"
  | "session"
  | "debrief";

export type BuilderFocus =
  | "all"
  | "adaptive-review"
  | "weak-concepts"
  | "favorites";
export type LaunchOrigin = "direct" | "daily-drills-simulated";

export type BuilderState = {
  templateId: TemplateId;
  drillIds: string[];
  subjectIds: string[];
  focus: BuilderFocus;
  length: number;
  launchOrigin: LaunchOrigin;
};

export type SessionEvent = {
  seq: number;
  at: string;
  type:
    | "SESSION_STARTED"
    | "ANSWER_COMMITTED"
    | "SELF_REPORT_COMMITTED"
    | "FEEDBACK_REVEALED"
    | "EXPLANATION_OPENED"
    | "REPLAY_REQUESTED"
    | "ZOOM_PLACEHOLDER_OPENED"
    | "NOTE_UPDATED"
    | "QUESTION_FLAGGED"
    | "QUESTION_ADVANCED"
    | "SESSION_PAUSED"
    | "SESSION_RESUMED"
    | "SESSION_COMPLETED";
  slotId?: string;
  detail?: string;
};

export type SessionResponse = {
  slotId: string;
  selectedIndex: number | null;
  selfReport: "knew" | "partial" | "missed" | null;
  confidence: "low" | "medium" | "high" | null;
  committed: boolean;
  revealed: boolean;
  flagged: boolean;
};

export type QueueSlot = {
  slotId: string;
  questionId: string;
  ordinal: number;
  reason: string;
};

export type StudioSession = {
  id: string;
  status: "active" | "paused" | "completed";
  createdAt: string;
  updatedAt: string;
  templateId: TemplateId;
  templateVersion: 1;
  selectionSnapshot: BuilderState;
  catalogDigest: string;
  queue: QueueSlot[];
  cursor: number;
  responses: Record<string, SessionResponse>;
  events: SessionEvent[];
};

export type FounderDecisionState = Record<
  string,
  { selection: string; note: string; updatedAt: string }
>;

export type StudioState = {
  hydrated: boolean;
  view: StudioView;
  builderOpen: boolean;
  builderStep: 1 | 2 | 3;
  builder: BuilderState;
  activeSession: StudioSession | null;
  savedSessions: StudioSession[];
  favorites: string[];
  questionNotes: Record<string, string>;
  founderDecisions: FounderDecisionState;
  persistenceStatus:
    | "loading"
    | "saved"
    | "not-saved"
    | "corrupt"
    | "future-schema";
  persistenceMessage: string;
};

export type StudioAction =
  | { type: "HYDRATE_EMPTY" }
  | { type: "HYDRATE"; payload: PersistedPayload }
  | {
      type: "HYDRATE_ERROR";
      status: "corrupt" | "future-schema";
      message: string;
    }
  | { type: "PERSIST_OK" }
  | { type: "PERSIST_ERROR"; message: string }
  | { type: "NAVIGATE"; view: StudioView }
  | {
      type: "OPEN_BUILDER";
      origin: LaunchOrigin;
      templateId?: TemplateId;
      drillIds?: string[];
      subjectIds?: string[];
      focus?: BuilderFocus;
    }
  | { type: "CLOSE_BUILDER" }
  | { type: "SET_BUILDER_STEP"; step: 1 | 2 | 3 }
  | { type: "SET_TEMPLATE"; templateId: TemplateId }
  | { type: "TOGGLE_DRILL"; drillId: string }
  | { type: "TOGGLE_SUBJECT"; subjectId: string }
  | { type: "SET_FOCUS"; focus: BuilderFocus }
  | { type: "SET_LENGTH"; length: number }
  | { type: "START_SESSION"; session: StudioSession }
  | { type: "SELECT_ANSWER"; slotId: string; selectedIndex: number }
  | {
      type: "SET_CONFIDENCE";
      slotId: string;
      confidence: "low" | "medium" | "high";
    }
  | { type: "COMMIT_RESPONSE"; slotId: string; at: string }
  | { type: "REVEAL_QUICK"; slotId: string; at: string }
  | {
      type: "SELF_REPORT";
      slotId: string;
      outcome: "knew" | "partial" | "missed";
      at: string;
    }
  | { type: "REVEAL_FEEDBACK"; slotId: string; at: string }
  | {
      type: "LOG_EVENT";
      eventType: SessionEvent["type"];
      slotId?: string;
      detail?: string;
      at: string;
    }
  | { type: "TOGGLE_FLAG"; slotId: string; at: string }
  | { type: "JUMP_TO"; index: number }
  | { type: "ADVANCE"; at: string }
  | { type: "PAUSE_SESSION"; at: string }
  | { type: "RESUME_SESSION"; sessionId: string; at: string }
  | { type: "COMPLETE_SESSION"; at: string }
  | { type: "TOGGLE_FAVORITE"; questionId: string }
  | { type: "UPDATE_NOTE"; questionId: string; body: string; at: string }
  | { type: "REMOVE_SAVED_SESSION"; sessionId: string }
  | {
      type: "SET_FOUNDER_DECISION";
      decisionId: string;
      selection: string;
      note: string;
      at: string;
    }
  | { type: "RESET_LOCAL_DATA" };

export type PersistedPayload = Pick<
  StudioState,
  | "builder"
  | "activeSession"
  | "savedSessions"
  | "favorites"
  | "questionNotes"
  | "founderDecisions"
>;

export type PersistedEnvelope = {
  schema: "missionmed.learning-studio.local";
  schemaVersion: 1;
  catalogDigest: string;
  savedAt: string;
  payloadChecksum: string;
  payload: PersistedPayload;
};

export const INITIAL_BUILDER: BuilderState = {
  templateId: "quick-review",
  drillIds: ["syn-drill-0718"],
  subjectIds: ["syn-cardio", "syn-neuro"],
  focus: "all",
  length: 6,
  launchOrigin: "direct",
};

export const INITIAL_STATE: StudioState = {
  hydrated: false,
  view: "home",
  builderOpen: false,
  builderStep: 1,
  builder: INITIAL_BUILDER,
  activeSession: null,
  savedSessions: [],
  favorites: [],
  questionNotes: {},
  founderDecisions: {},
  persistenceStatus: "loading",
  persistenceMessage: "Loading browser-local prototype state…",
};

const defaultResponse = (slotId: string): SessionResponse => ({
  slotId,
  selectedIndex: null,
  selfReport: null,
  confidence: null,
  committed: false,
  revealed: false,
  flagged: false,
});

function withEvent(
  session: StudioSession,
  at: string,
  type: SessionEvent["type"],
  slotId?: string,
  detail?: string,
): StudioSession {
  return {
    ...session,
    updatedAt: at,
    events: [
      ...session.events,
      { seq: session.events.length + 1, at, type, slotId, detail },
    ],
  };
}

function updateActive(
  state: StudioState,
  updater: (session: StudioSession) => StudioSession,
): StudioState {
  if (!state.activeSession || state.activeSession.status !== "active")
    return state;
  return { ...state, activeSession: updater(state.activeSession) };
}

export function studioReducer(
  state: StudioState,
  action: StudioAction,
): StudioState {
  switch (action.type) {
    case "HYDRATE_EMPTY":
      return {
        ...state,
        hydrated: true,
        persistenceStatus: "saved",
        persistenceMessage: "Stored only in this browser",
      };
    case "HYDRATE":
      return {
        ...state,
        ...action.payload,
        hydrated: true,
        view:
          action.payload.activeSession?.status === "active"
            ? "session"
            : "home",
        persistenceStatus: "saved",
        persistenceMessage: "Stored only in this browser",
      };
    case "HYDRATE_ERROR":
      return {
        ...state,
        hydrated: true,
        persistenceStatus: action.status,
        persistenceMessage: action.message,
      };
    case "PERSIST_OK":
      return state.persistenceStatus === "saved"
        ? state
        : {
            ...state,
            persistenceStatus: "saved",
            persistenceMessage: "Stored only in this browser",
          };
    case "PERSIST_ERROR":
      return {
        ...state,
        persistenceStatus: "not-saved",
        persistenceMessage: action.message,
      };
    case "NAVIGATE":
      return { ...state, view: action.view, builderOpen: false };
    case "OPEN_BUILDER": {
      const daily = action.origin === "daily-drills-simulated";
      return {
        ...state,
        builderOpen: true,
        builderStep: 1,
        builder: {
          ...state.builder,
          launchOrigin: action.origin,
          templateId: action.templateId ?? state.builder.templateId,
          focus:
            action.focus ??
            (action.templateId === "adaptive"
              ? "adaptive-review"
              : state.builder.focus),
          drillIds:
            action.drillIds ??
            (daily ? ["syn-drill-0718"] : state.builder.drillIds),
          subjectIds:
            action.subjectIds ??
            (daily ? ["syn-cardio", "syn-neuro"] : state.builder.subjectIds),
        },
      };
    }
    case "CLOSE_BUILDER":
      return { ...state, builderOpen: false };
    case "SET_BUILDER_STEP":
      return { ...state, builderStep: action.step };
    case "SET_TEMPLATE":
      return {
        ...state,
        builder: {
          ...state.builder,
          templateId: action.templateId,
          focus:
            action.templateId === "adaptive"
              ? "adaptive-review"
              : state.builder.focus,
        },
      };
    case "TOGGLE_DRILL":
      return {
        ...state,
        builder: {
          ...state.builder,
          drillIds: state.builder.drillIds.includes(action.drillId)
            ? state.builder.drillIds.filter((id) => id !== action.drillId)
            : [...state.builder.drillIds, action.drillId],
        },
      };
    case "TOGGLE_SUBJECT":
      return {
        ...state,
        builder: {
          ...state.builder,
          subjectIds: state.builder.subjectIds.includes(action.subjectId)
            ? state.builder.subjectIds.filter((id) => id !== action.subjectId)
            : [...state.builder.subjectIds, action.subjectId],
        },
      };
    case "SET_FOCUS":
      return { ...state, builder: { ...state.builder, focus: action.focus } };
    case "SET_LENGTH":
      return { ...state, builder: { ...state.builder, length: action.length } };
    case "START_SESSION":
      return {
        ...state,
        activeSession: action.session,
        view: "session",
        builderOpen: false,
      };
    case "SELECT_ANSWER":
      return updateActive(state, (session) => {
        const existing =
          session.responses[action.slotId] ?? defaultResponse(action.slotId);
        if (existing.committed) return session;
        return {
          ...session,
          responses: {
            ...session.responses,
            [action.slotId]: {
              ...existing,
              selectedIndex: action.selectedIndex,
            },
          },
        };
      });
    case "SET_CONFIDENCE":
      return updateActive(state, (session) => {
        const existing =
          session.responses[action.slotId] ?? defaultResponse(action.slotId);
        if (existing.committed) return session;
        return {
          ...session,
          responses: {
            ...session.responses,
            [action.slotId]: { ...existing, confidence: action.confidence },
          },
        };
      });
    case "COMMIT_RESPONSE":
      return updateActive(state, (session) => {
        const existing =
          session.responses[action.slotId] ?? defaultResponse(action.slotId);
        if (
          existing.committed ||
          existing.selectedIndex === null ||
          !existing.confidence
        )
          return session;
        const updated = {
          ...session,
          responses: {
            ...session.responses,
            [action.slotId]: { ...existing, committed: true },
          },
        };
        return withEvent(updated, action.at, "ANSWER_COMMITTED", action.slotId);
      });
    case "REVEAL_QUICK":
      return updateActive(state, (session) => {
        if (session.templateId !== "quick-review") return session;
        const existing =
          session.responses[action.slotId] ?? defaultResponse(action.slotId);
        if (existing.revealed) return session;
        const updated = {
          ...session,
          responses: {
            ...session.responses,
            [action.slotId]: { ...existing, revealed: true },
          },
        };
        return withEvent(
          updated,
          action.at,
          "FEEDBACK_REVEALED",
          action.slotId,
        );
      });
    case "SELF_REPORT":
      return updateActive(state, (session) => {
        const existing =
          session.responses[action.slotId] ?? defaultResponse(action.slotId);
        if (existing.selfReport) return session;
        const updated = {
          ...session,
          responses: {
            ...session.responses,
            [action.slotId]: {
              ...existing,
              selfReport: action.outcome,
              committed: true,
              revealed: true,
            },
          },
        };
        return withEvent(
          updated,
          action.at,
          "SELF_REPORT_COMMITTED",
          action.slotId,
          action.outcome,
        );
      });
    case "REVEAL_FEEDBACK":
      return updateActive(state, (session) => {
        const existing =
          session.responses[action.slotId] ?? defaultResponse(action.slotId);
        if (!existing.committed || existing.revealed) return session;
        const updated = {
          ...session,
          responses: {
            ...session.responses,
            [action.slotId]: { ...existing, revealed: true },
          },
        };
        return withEvent(
          updated,
          action.at,
          "FEEDBACK_REVEALED",
          action.slotId,
        );
      });
    case "LOG_EVENT":
      return updateActive(state, (session) =>
        withEvent(
          session,
          action.at,
          action.eventType,
          action.slotId,
          action.detail,
        ),
      );
    case "TOGGLE_FLAG":
      return updateActive(state, (session) => {
        const existing =
          session.responses[action.slotId] ?? defaultResponse(action.slotId);
        const flagged = !existing.flagged;
        const updated = {
          ...session,
          responses: {
            ...session.responses,
            [action.slotId]: { ...existing, flagged },
          },
        };
        return flagged
          ? withEvent(updated, action.at, "QUESTION_FLAGGED", action.slotId)
          : updated;
      });
    case "JUMP_TO":
      return updateActive(state, (session) => {
        const firstIncomplete = session.queue.findIndex(
          (slot) => !isSlotComplete(session, slot.slotId),
        );
        const furthestReachable =
          firstIncomplete === -1 ? session.queue.length - 1 : firstIncomplete;
        if (
          !Number.isInteger(action.index) ||
          action.index < 0 ||
          action.index > furthestReachable
        )
          return session;
        return { ...session, cursor: action.index };
      });
    case "ADVANCE":
      return updateActive(state, (session) => {
        const current = session.queue[session.cursor];
        if (!current || !isSlotComplete(session, current.slotId))
          return session;
        if (session.cursor >= session.queue.length - 1) return session;
        return withEvent(
          { ...session, cursor: session.cursor + 1 },
          action.at,
          "QUESTION_ADVANCED",
          session.queue[session.cursor + 1]?.slotId,
        );
      });
    case "PAUSE_SESSION": {
      if (!state.activeSession) return state;
      const paused = withEvent(
        { ...state.activeSession, status: "paused" },
        action.at,
        "SESSION_PAUSED",
      );
      return {
        ...state,
        activeSession: null,
        savedSessions: [
          paused,
          ...state.savedSessions.filter((item) => item.id !== paused.id),
        ],
        view: "sessions",
      };
    }
    case "RESUME_SESSION": {
      const target = state.savedSessions.find(
        (session) => session.id === action.sessionId,
      );
      if (
        !target ||
        target.catalogDigest !== CATALOG_DIGEST ||
        target.status === "completed"
      )
        return state;
      const resumed = withEvent(
        { ...target, status: "active" },
        action.at,
        "SESSION_RESUMED",
      );
      return {
        ...state,
        activeSession: resumed,
        savedSessions: state.savedSessions.filter(
          (session) => session.id !== target.id,
        ),
        view: "session",
      };
    }
    case "COMPLETE_SESSION": {
      if (!state.activeSession) return state;
      const session = state.activeSession;
      const canComplete =
        session.cursor === session.queue.length - 1 &&
        session.queue.length > 0 &&
        session.queue.every((slot) => isSlotComplete(session, slot.slotId));
      if (!canComplete) return state;
      const completed = withEvent(
        { ...session, status: "completed" },
        action.at,
        "SESSION_COMPLETED",
      );
      return {
        ...state,
        activeSession: completed,
        savedSessions: [
          completed,
          ...state.savedSessions.filter((item) => item.id !== completed.id),
        ],
        view: "debrief",
      };
    }
    case "TOGGLE_FAVORITE":
      return {
        ...state,
        favorites: state.favorites.includes(action.questionId)
          ? state.favorites.filter((id) => id !== action.questionId)
          : [...state.favorites, action.questionId],
      };
    case "UPDATE_NOTE": {
      const notes = { ...state.questionNotes };
      if (action.body.trim()) notes[action.questionId] = action.body;
      else delete notes[action.questionId];
      const base = { ...state, questionNotes: notes };
      return updateActive(base, (session) =>
        withEvent(
          session,
          action.at,
          "NOTE_UPDATED",
          undefined,
          "local-question-note",
        ),
      );
    }
    case "REMOVE_SAVED_SESSION":
      return {
        ...state,
        activeSession:
          state.activeSession?.id === action.sessionId
            ? null
            : state.activeSession,
        savedSessions: state.savedSessions.filter(
          (session) => session.id !== action.sessionId,
        ),
      };
    case "SET_FOUNDER_DECISION":
      return {
        ...state,
        founderDecisions: {
          ...state.founderDecisions,
          [action.decisionId]: {
            selection: action.selection,
            note: action.note,
            updatedAt: action.at,
          },
        },
      };
    case "RESET_LOCAL_DATA":
      return {
        ...INITIAL_STATE,
        hydrated: true,
        favorites: [],
        persistenceStatus: "saved",
        persistenceMessage: "Local prototype data reset",
      };
    default:
      return state;
  }
}

export function buildQueue(
  builder: BuilderState,
  favorites: string[],
): { queue: QueueSlot[]; error: string | null } {
  if (!builder.drillIds.length || !builder.subjectIds.length) {
    return { queue: [], error: "Choose at least one drill and one subject." };
  }

  let candidates = QUESTIONS.filter(
    (question) =>
      builder.drillIds.includes(question.drillId) &&
      builder.subjectIds.includes(question.subjectId),
  );

  if (builder.focus === "favorites") {
    candidates = candidates.filter((question) =>
      favorites.includes(question.id),
    );
  }

  if (
    builder.focus === "weak-concepts" ||
    builder.focus === "adaptive-review"
  ) {
    candidates = [...candidates].sort(
      (a, b) => b.weakSignal - a.weakSignal || a.id.localeCompare(b.id),
    );
  } else {
    candidates = [...candidates].sort((a, b) => a.id.localeCompare(b.id));
  }

  if (!candidates.length) {
    return {
      queue: [],
      error:
        "No synthetic questions match that exact intersection. Change the focus or selection.",
    };
  }

  const desired = Math.max(1, Math.min(builder.length, 8));
  const queue = candidates.slice(0, desired).map((question, index) => ({
    slotId: `${question.id}::${index + 1}`,
    questionId: question.id,
    ordinal: index + 1,
    reason:
      builder.focus === "adaptive-review"
        ? question.weakSignal >= 70
          ? "Selected because this synthetic concept has a high review-priority signal."
          : "Included after higher-priority candidates to fill the requested length; no balancing model is connected."
        : builder.focus === "weak-concepts"
          ? "Prioritized by the synthetic weak-concept signal."
          : builder.focus === "favorites"
            ? "Included from your browser-local favorites."
            : "Included from the exact drill and subject intersection.",
  }));

  return { queue, error: null };
}

export function createSession(
  builder: BuilderState,
  favorites: string[],
  id: string,
  at: string,
): { session: StudioSession | null; error: string | null } {
  const built = buildQueue(builder, favorites);
  if (built.error) return { session: null, error: built.error };
  const session: StudioSession = {
    id,
    status: "active",
    createdAt: at,
    updatedAt: at,
    templateId: builder.templateId,
    templateVersion: 1,
    selectionSnapshot: {
      ...builder,
      drillIds: [...builder.drillIds],
      subjectIds: [...builder.subjectIds],
    },
    catalogDigest: CATALOG_DIGEST,
    queue: built.queue,
    cursor: 0,
    responses: {},
    events: [{ seq: 1, at, type: "SESSION_STARTED" }],
  };
  return { session, error: null };
}

export function questionForSlot(
  slot: QueueSlot | undefined,
): StudioQuestion | null {
  if (!slot) return null;
  return QUESTIONS.find((question) => question.id === slot.questionId) ?? null;
}

export function isSlotComplete(
  session: StudioSession,
  slotId: string,
): boolean {
  const response = session.responses[slotId];
  return Boolean(response?.committed && response.revealed);
}

export function sessionCompletion(session: StudioSession): number {
  if (!session.queue.length) return 0;
  const complete = session.queue.filter((slot) =>
    isSlotComplete(session, slot.slotId),
  ).length;
  return Math.round((complete / session.queue.length) * 100);
}

export function observedSessionScore(session: StudioSession): number {
  const choiceResponses = session.queue
    .map((slot) => ({ slot, response: session.responses[slot.slotId] }))
    .filter(
      ({ response }) => response?.committed && response.selectedIndex !== null,
    );
  const selfReports = session.queue
    .map((slot) => session.responses[slot.slotId])
    .filter((response) => response?.selfReport);
  if (!choiceResponses.length && !selfReports.length) return 0;

  const choiceCorrect = choiceResponses.filter(({ slot, response }) => {
    const question = questionForSlot(slot);
    return question && response?.selectedIndex === question.correctIndex;
  }).length;
  const selfReportPoints = selfReports.reduce((sum, response) => {
    if (response?.selfReport === "knew") return sum + 1;
    if (response?.selfReport === "partial") return sum + 0.5;
    return sum;
  }, 0);
  return Math.round(
    ((choiceCorrect + selfReportPoints) /
      (choiceResponses.length + selfReports.length)) *
      100,
  );
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function lightweightChecksum(value: unknown): string {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function toPersistedEnvelope(
  state: PersistedPayload,
  savedAt: string,
): PersistedEnvelope {
  const payload: PersistedPayload = {
    builder: state.builder,
    activeSession: state.activeSession,
    savedSessions: state.savedSessions,
    favorites: state.favorites,
    questionNotes: state.questionNotes,
    founderDecisions: state.founderDecisions,
  };
  return {
    schema: "missionmed.learning-studio.local",
    schemaVersion: 1,
    catalogDigest: CATALOG_DIGEST,
    savedAt,
    payloadChecksum: lightweightChecksum(payload),
    payload,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const TEMPLATE_IDS = new Set<TemplateId>([
  "quick-review",
  "board-review",
  "clinical-mastery",
  "adaptive",
]);
const FOCUS_IDS = new Set<BuilderFocus>([
  "all",
  "adaptive-review",
  "weak-concepts",
  "favorites",
]);
const DRILL_IDS = new Set(QUESTIONS.map((question) => question.drillId));
const SUBJECT_IDS = new Set(QUESTIONS.map((question) => question.subjectId));
const QUESTION_IDS = new Set(QUESTIONS.map((question) => question.id));
const EVENT_TYPES = new Set<SessionEvent["type"]>([
  "SESSION_STARTED",
  "ANSWER_COMMITTED",
  "SELF_REPORT_COMMITTED",
  "FEEDBACK_REVEALED",
  "EXPLANATION_OPENED",
  "REPLAY_REQUESTED",
  "ZOOM_PLACEHOLDER_OPENED",
  "NOTE_UPDATED",
  "QUESTION_FLAGGED",
  "QUESTION_ADVANCED",
  "SESSION_PAUSED",
  "SESSION_RESUMED",
  "SESSION_COMPLETED",
]);

function isStringArray(
  value: unknown,
  allowed?: Set<string>,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => typeof item === "string" && (!allowed || allowed.has(item)),
    )
  );
}

function isBuilderState(value: unknown): value is BuilderState {
  if (!isRecord(value)) return false;
  return (
    typeof value.templateId === "string" &&
    TEMPLATE_IDS.has(value.templateId as TemplateId) &&
    isStringArray(value.drillIds, DRILL_IDS) &&
    isStringArray(value.subjectIds, SUBJECT_IDS) &&
    typeof value.focus === "string" &&
    FOCUS_IDS.has(value.focus as BuilderFocus) &&
    Number.isInteger(value.length) &&
    Number(value.length) >= 1 &&
    Number(value.length) <= 8 &&
    (value.launchOrigin === "direct" ||
      value.launchOrigin === "daily-drills-simulated")
  );
}

function isSessionResponse(value: unknown): value is SessionResponse {
  if (!isRecord(value)) return false;
  return (
    typeof value.slotId === "string" &&
    (value.selectedIndex === null ||
      (Number.isInteger(value.selectedIndex) &&
        Number(value.selectedIndex) >= 0 &&
        Number(value.selectedIndex) <= 3)) &&
    (value.selfReport === null ||
      value.selfReport === "knew" ||
      value.selfReport === "partial" ||
      value.selfReport === "missed") &&
    (value.confidence === null ||
      value.confidence === "low" ||
      value.confidence === "medium" ||
      value.confidence === "high") &&
    typeof value.committed === "boolean" &&
    typeof value.revealed === "boolean" &&
    typeof value.flagged === "boolean"
  );
}

function isStudioSession(value: unknown): value is StudioSession {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== "string" ||
    !["active", "paused", "completed"].includes(String(value.status)) ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    typeof value.templateId !== "string" ||
    !TEMPLATE_IDS.has(value.templateId as TemplateId) ||
    value.templateVersion !== 1 ||
    !isBuilderState(value.selectionSnapshot) ||
    value.catalogDigest !== CATALOG_DIGEST ||
    !Array.isArray(value.queue) ||
    value.queue.length < 1 ||
    value.queue.length > 8 ||
    !Number.isInteger(value.cursor) ||
    Number(value.cursor) < 0 ||
    Number(value.cursor) >= value.queue.length ||
    !isRecord(value.responses) ||
    !Array.isArray(value.events)
  )
    return false;

  const slotIds = new Set<string>();
  for (const item of value.queue) {
    if (
      !isRecord(item) ||
      typeof item.slotId !== "string" ||
      slotIds.has(item.slotId) ||
      typeof item.questionId !== "string" ||
      !QUESTION_IDS.has(item.questionId) ||
      !Number.isInteger(item.ordinal) ||
      Number(item.ordinal) < 1 ||
      typeof item.reason !== "string"
    )
      return false;
    slotIds.add(item.slotId);
  }
  if (
    !Object.entries(value.responses).every(
      ([slotId, response]) =>
        slotIds.has(slotId) &&
        isSessionResponse(response) &&
        response.slotId === slotId,
    )
  )
    return false;
  return value.events.every(
    (event, index) =>
      isRecord(event) &&
      event.seq === index + 1 &&
      typeof event.at === "string" &&
      typeof event.type === "string" &&
      EVENT_TYPES.has(event.type as SessionEvent["type"]) &&
      (event.slotId === undefined ||
        (typeof event.slotId === "string" && slotIds.has(event.slotId))) &&
      (event.detail === undefined || typeof event.detail === "string"),
  );
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

function isFounderDecisionState(value: unknown): value is FounderDecisionState {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (item) =>
        isRecord(item) &&
        typeof item.selection === "string" &&
        typeof item.note === "string" &&
        typeof item.updatedAt === "string",
    )
  );
}

function isPersistedPayload(value: unknown): value is PersistedPayload {
  if (!isRecord(value)) return false;
  return (
    isBuilderState(value.builder) &&
    (value.activeSession === null || isStudioSession(value.activeSession)) &&
    Array.isArray(value.savedSessions) &&
    value.savedSessions.every(isStudioSession) &&
    isStringArray(value.favorites, QUESTION_IDS) &&
    isStringRecord(value.questionNotes) &&
    Object.keys(value.questionNotes).every((id) => QUESTION_IDS.has(id)) &&
    isFounderDecisionState(value.founderDecisions)
  );
}

export function parsePersistedEnvelope(raw: string): {
  payload: PersistedPayload | null;
  status: "ok" | "corrupt" | "future-schema";
  message: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      payload: null,
      status: "corrupt",
      message: "Saved prototype data is unreadable and was left untouched.",
    };
  }
  if (!parsed || typeof parsed !== "object") {
    return {
      payload: null,
      status: "corrupt",
      message:
        "Saved prototype data has an invalid shape and was left untouched.",
    };
  }
  const envelope = parsed as Partial<PersistedEnvelope>;
  if (envelope.schemaVersion !== 1) {
    return {
      payload: null,
      status: "future-schema",
      message: "Saved data uses an unsupported schema and was left untouched.",
    };
  }
  if (
    envelope.schema !== "missionmed.learning-studio.local" ||
    envelope.catalogDigest !== CATALOG_DIGEST ||
    !envelope.payload ||
    envelope.payloadChecksum !== lightweightChecksum(envelope.payload) ||
    !isPersistedPayload(envelope.payload)
  ) {
    return {
      payload: null,
      status: "corrupt",
      message:
        "Saved data failed its local integrity check and was left untouched.",
    };
  }
  return {
    payload: envelope.payload,
    status: "ok",
    message: "Stored only in this browser",
  };
}
