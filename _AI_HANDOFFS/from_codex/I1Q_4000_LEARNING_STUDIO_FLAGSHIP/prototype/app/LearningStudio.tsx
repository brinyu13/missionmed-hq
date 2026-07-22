"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEMO_HISTORY,
  DRILLS,
  FOUNDER_DECISIONS,
  QUESTIONS,
  STORAGE_KEY,
  SUBJECTS,
  TEMPLATES,
  type TemplateId,
} from "./studio-data";
import {
  INITIAL_STATE,
  buildQueue,
  createSession,
  isSlotComplete,
  observedSessionScore,
  parsePersistedEnvelope,
  questionForSlot,
  sessionCompletion,
  studioReducer,
  toPersistedEnvelope,
  type BuilderFocus,
  type LaunchOrigin,
  type StudioSession,
  type StudioView,
} from "./studio-state";

type PanelKind = "replay" | "zoom" | "note" | "rounds" | "guide" | null;
type AnalyticsTab =
  | "current"
  | "lifetime"
  | "mastery"
  | "heatmap"
  | "trends"
  | "replay"
  | "explanations"
  | "confidence";

type BuilderPreset = {
  drillIds?: string[];
  subjectIds?: string[];
  focus?: BuilderFocus;
};

type OpenBuilder = (
  origin: LaunchOrigin,
  templateId?: TemplateId,
  preset?: BuilderPreset,
) => void;

const nowIso = () => new Date().toISOString();

const VIEW_LABELS: Record<StudioView, string> = {
  home: "Home",
  studio: "Learning Studio",
  sessions: "Saved sessions",
  favorites: "Favorites",
  analytics: "Analytics",
  decisions: "Founder review",
  session: "Learning session",
  debrief: "Session debrief",
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    home: (
      <>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v10h13V10" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
    studio: (
      <>
        <path d="M4 5.5h16v13H4z" />
        <path d="M8 2.8v5.4M16 2.8v5.4" />
        <path d="M8 12h8M8 15.5h5" />
      </>
    ),
    bookmark: <path d="M6 3.5h12v17L12 16l-6 4.5z" />,
    star: (
      <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
    ),
    chart: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
    decision: (
      <>
        <path d="M4 4h16v16H4z" />
        <path d="m8 12 2.2 2.2L16.5 8" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m14 7 5 5-5 5" />
      </>
    ),
    play: <path d="m9 7 8 5-8 5z" />,
    pause: (
      <>
        <path d="M9 7v10M15 7v10" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" />
        <path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6z" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
        <path d="M15 9 21 3M17 3h4v4" />
      </>
    ),
    ladder: (
      <>
        <path d="M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10" />
      </>
    ),
    route: (
      <>
        <circle cx="5" cy="5" r="2" />
        <circle cx="19" cy="19" r="2" />
        <path d="M7 5h5a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4H9a4 4 0 0 0-4 4" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5z" />
        <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
      </>
    ),
    notes: (
      <>
        <path d="M5 3h14v18H5z" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    replay: (
      <>
        <path d="M5.5 8A8 8 0 1 1 4 14" />
        <path d="M5.5 3v5h5" />
        <path d="m10 9 6 3-6 3z" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7h.01" />
      </>
    ),
    flag: (
      <>
        <path d="M5 21V4" />
        <path d="M5 5h11l-2 4 2 4H5" />
      </>
    ),
    chevron: <path d="m9 6 6 6-6 6" />,
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" />
      </>
    ),
    grid: (
      <>
        <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.info}
    </svg>
  );
}

function TruthPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`truth-pill ${tone}`}>{children}</span>;
}

function Ring({
  value,
  label,
  tone = "mint",
}: {
  value: number;
  label: string;
  tone?: string;
}) {
  return (
    <div className="ring-wrap" aria-label={`${label}: ${value} percent`}>
      <div
        className={`progress-ring ${tone}`}
        style={{ "--value": `${value * 3.6}deg` } as React.CSSProperties}
      >
        <div>
          <strong>{value}</strong>
          <span>%</span>
        </div>
      </div>
      <span>{label}</span>
    </div>
  );
}

function MiniBars({
  values,
  active = -1,
}: {
  values: number[];
  active?: number;
}) {
  return (
    <div className="mini-bars" aria-hidden="true">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className={active === index ? "active" : ""}
          style={{ height: `${Math.max(12, value)}%` }}
        />
      ))}
    </div>
  );
}

export default function LearningStudio() {
  const [state, dispatch] = useReducer(studioReducer, INITIAL_STATE);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [panel, setPanel] = useState<PanelKind>(null);
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>("current");
  const [explanationTab, setExplanationTab] = useState<
    "concise" | "deep" | "alternatives"
  >("concise");
  const [quickReveal, setQuickReveal] = useState<string | null>(null);
  const [setupError, setSetupError] = useState("");
  const [toast, setToast] = useState("");
  const [storageConflict, setStorageConflict] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>(
    {},
  );
  const mainHeadingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const builderDialogRef = useRef<HTMLElement>(null);
  const resetDialogRef = useRef<HTMLDivElement>(null);
  const panelTriggerRef = useRef<HTMLElement | null>(null);
  const builderTriggerRef = useRef<HTMLElement | null>(null);
  const resetTriggerRef = useRef<HTMLElement | null>(null);
  const mobileMenuRef = useRef<HTMLButtonElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const hasAppliedRoute = useRef(false);

  const persistencePayload = useMemo(
    () => ({
      builder: state.builder,
      activeSession: state.activeSession,
      savedSessions: state.savedSessions,
      favorites: state.favorites,
      questionNotes: state.questionNotes,
      founderDecisions: state.founderDecisions,
    }),
    [
      state.builder,
      state.activeSession,
      state.savedSessions,
      state.favorites,
      state.questionNotes,
      state.founderDecisions,
    ],
  );

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      dispatch({ type: "HYDRATE_EMPTY" });
      return;
    }
    const parsed = parsePersistedEnvelope(raw);
    if (parsed.status === "ok" && parsed.payload) {
      dispatch({ type: "HYDRATE", payload: parsed.payload });
    } else {
      dispatch({
        type: "HYDRATE_ERROR",
        status: parsed.status === "ok" ? "corrupt" : parsed.status,
        message: parsed.message,
      });
    }
  }, []);

  useEffect(() => {
    if (
      !state.hydrated ||
      state.persistenceStatus === "corrupt" ||
      state.persistenceStatus === "future-schema"
    )
      return;
    try {
      const envelope = toPersistedEnvelope(persistencePayload, nowIso());
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
      dispatch({ type: "PERSIST_OK" });
    } catch {
      dispatch({
        type: "PERSIST_ERROR",
        message:
          "Not saved — browser storage is unavailable. Your in-memory session is still active.",
      });
    }
  }, [state.hydrated, state.persistenceStatus, persistencePayload]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setStorageConflict(true);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!state.hydrated || hasAppliedRoute.current) return;
    hasAppliedRoute.current = true;
    const route = window.location.hash.replace(/^#\/?/, "");
    if (route === "daily")
      dispatch({ type: "OPEN_BUILDER", origin: "daily-drills-simulated" });
    else if (route === "session" && state.activeSession?.status === "active")
      dispatch({ type: "NAVIGATE", view: "session" });
    else if (route === "debrief" && state.activeSession?.status === "completed")
      dispatch({ type: "NAVIGATE", view: "debrief" });
    else if (
      ["studio", "sessions", "favorites", "analytics", "decisions"].includes(
        route,
      )
    ) {
      dispatch({ type: "NAVIGATE", view: route as StudioView });
    }
  }, [state.hydrated, state.activeSession?.status]);

  useEffect(() => {
    if (!state.hydrated) return;
    const applyHistoryRoute = () => {
      const route = window.location.hash.replace(/^#\/?/, "");
      if (!route) {
        dispatch({ type: "NAVIGATE", view: "home" });
      } else if (
        ["studio", "sessions", "favorites", "analytics", "decisions"].includes(
          route,
        )
      ) {
        dispatch({ type: "NAVIGATE", view: route as StudioView });
      } else if (route === "session" && state.activeSession) {
        dispatch({ type: "NAVIGATE", view: "session" });
      } else if (
        route === "debrief" &&
        state.activeSession?.status === "completed"
      ) {
        dispatch({ type: "NAVIGATE", view: "debrief" });
      } else {
        dispatch({ type: "NAVIGATE", view: "home" });
      }
    };
    window.addEventListener("popstate", applyHistoryRoute);
    return () => window.removeEventListener("popstate", applyHistoryRoute);
  }, [state.hydrated, state.activeSession]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!panel) return;
    const dialog = dialogRef.current;
    const previous = panelTriggerRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPanel(null);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [panel]);

  useEffect(() => {
    if (!state.builderOpen) return;
    const dialog = builderDialogRef.current;
    const previous = builderTriggerRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dispatch({ type: "CLOSE_BUILDER" });
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [state.builderOpen]);

  useEffect(() => {
    if (!resetConfirm) return;
    const dialog = resetDialogRef.current;
    const previous = resetTriggerRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [],
      );
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setResetConfirm(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [resetConfirm]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previous = mobileMenuRef.current;
    mobileCloseRef.current?.focus();
    const sidebar = document.querySelector<HTMLElement>("#primary-navigation");
    const focusable = () =>
      Array.from(
        sidebar?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (state.view === "session") {
      window.setTimeout(
        () => document.querySelector<HTMLElement>("#question-heading")?.focus(),
        0,
      );
    } else {
      mainHeadingRef.current?.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [state.view]);

  const activeSlot = state.activeSession?.queue[state.activeSession.cursor];
  const activeQuestion = questionForSlot(activeSlot);
  const activeResponse = activeSlot
    ? state.activeSession?.responses[activeSlot.slotId]
    : undefined;
  const activeTemplate = TEMPLATES.find(
    (item) => item.id === state.activeSession?.templateId,
  );

  const openPanel = useCallback((kind: PanelKind, trigger: HTMLElement) => {
    panelTriggerRef.current = trigger;
    setReplayPlaying(false);
    setPanel(kind);
  }, []);

  const navigate = useCallback((view: StudioView) => {
    dispatch({ type: "NAVIGATE", view });
    setMobileNavOpen(false);
    const route = view === "home" ? "" : view;
    window.history.pushState(
      {},
      "",
      route ? `#/${route}` : window.location.pathname,
    );
  }, []);

  const openBuilder: OpenBuilder = (origin, templateId, preset) => {
    builderTriggerRef.current = document.activeElement as HTMLElement | null;
    dispatch({ type: "OPEN_BUILDER", origin, templateId, ...preset });
    setSetupError("");
  };

  const requestReset = () => {
    resetTriggerRef.current = panel
      ? panelTriggerRef.current
      : (document.activeElement as HTMLElement | null);
    setPanel(null);
    setResetConfirm(true);
  };

  const startSession = () => {
    const built = createSession(
      state.builder,
      state.favorites,
      `LS-${Date.now().toString(36).toUpperCase()}`,
      nowIso(),
    );
    if (!built.session) {
      setSetupError(built.error ?? "This session could not be created.");
      return;
    }
    dispatch({ type: "START_SESSION", session: built.session });
    window.history.pushState({}, "", "#/session");
    setQuickReveal(null);
    setExplanationTab("concise");
  };

  const goNext = () => {
    if (
      !state.activeSession ||
      !activeResponse?.committed ||
      !activeResponse.revealed
    )
      return;
    if (state.activeSession.cursor === state.activeSession.queue.length - 1) {
      dispatch({ type: "COMPLETE_SESSION", at: nowIso() });
      window.history.pushState({}, "", "#/debrief");
    } else {
      dispatch({ type: "ADVANCE", at: nowIso() });
      setQuickReveal(null);
      setExplanationTab("concise");
      setPanel(null);
      window.setTimeout(
        () => document.querySelector<HTMLElement>("#question-heading")?.focus(),
        0,
      );
    }
  };

  const resetLocalData = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    dispatch({ type: "RESET_LOCAL_DATA" });
    setDecisionNotes({});
    setQuickReveal(null);
    setStorageConflict(false);
    setResetConfirm(false);
    setToast("Local prototype data cleared");
  };

  if (!state.hydrated) {
    return (
      <main className="boot-screen" aria-busy="true">
        <div className="brand-mark large" aria-hidden="true">
          <span>M</span>
        </div>
        <p className="eyebrow">MissionMed Learning Studio</p>
        <h1>Preparing your local prototype</h1>
        <div className="boot-line">
          <span />
        </div>
      </main>
    );
  }

  const renderMain = () => {
    switch (state.view) {
      case "studio":
        return (
          <StudioLibrary
            openBuilder={openBuilder}
            headingRef={mainHeadingRef}
          />
        );
      case "sessions":
        return (
          <SessionsView
            sessions={state.savedSessions}
            headingRef={mainHeadingRef}
            onResume={(sessionId) => {
              dispatch({ type: "RESUME_SESSION", sessionId, at: nowIso() });
              window.history.pushState({}, "", "#/session");
            }}
            onRemove={(sessionId) =>
              dispatch({ type: "REMOVE_SAVED_SESSION", sessionId })
            }
            onStart={() => openBuilder("direct")}
            onReview={() => navigate("analytics")}
          />
        );
      case "favorites":
        return (
          <FavoritesView
            favorites={state.favorites}
            notes={state.questionNotes}
            headingRef={mainHeadingRef}
            onToggle={(questionId) =>
              dispatch({ type: "TOGGLE_FAVORITE", questionId })
            }
            onStart={(favoritesOnly) =>
              openBuilder("direct", "quick-review", {
                focus: favoritesOnly ? "favorites" : "all",
                drillIds: DRILLS.map((drill) => drill.id),
                subjectIds: SUBJECTS.map((subject) => subject.id),
              })
            }
          />
        );
      case "analytics":
        return (
          <AnalyticsView
            tab={analyticsTab}
            setTab={setAnalyticsTab}
            activeSession={state.activeSession}
            savedSessions={state.savedSessions}
            headingRef={mainHeadingRef}
            onStartAdaptive={() => openBuilder("direct", "adaptive")}
          />
        );
      case "decisions":
        return (
          <DecisionsView
            decisions={state.founderDecisions}
            notes={decisionNotes}
            setNotes={setDecisionNotes}
            headingRef={mainHeadingRef}
            onSave={(id, selection) => {
              dispatch({
                type: "SET_FOUNDER_DECISION",
                decisionId: id,
                selection,
                note:
                  decisionNotes[id] ?? state.founderDecisions[id]?.note ?? "",
                at: nowIso(),
              });
              setToast("Founder review note saved locally — not ratified");
            }}
          />
        );
      case "session":
        return state.activeSession && activeSlot && activeQuestion ? (
          <SessionView
            session={state.activeSession}
            slot={activeSlot}
            question={activeQuestion}
            response={activeResponse}
            template={activeTemplate}
            isFavorite={state.favorites.includes(activeQuestion.id)}
            quickReveal={
              quickReveal === activeSlot.slotId ||
              Boolean(activeResponse?.revealed)
            }
            setQuickReveal={() => {
              setQuickReveal(activeSlot.slotId);
              dispatch({
                type: "REVEAL_QUICK",
                slotId: activeSlot.slotId,
                at: nowIso(),
              });
            }}
            explanationTab={explanationTab}
            setExplanationTab={(tab) => {
              if (tab === explanationTab) return;
              setExplanationTab(tab);
              dispatch({
                type: "LOG_EVENT",
                eventType: "EXPLANATION_OPENED",
                slotId: activeSlot.slotId,
                detail: tab,
                at: nowIso(),
              });
            }}
            dispatch={dispatch}
            openPanel={openPanel}
            onNext={goNext}
            onPause={() => {
              dispatch({ type: "PAUSE_SESSION", at: nowIso() });
              window.history.pushState({}, "", "#/sessions");
              setToast("Session saved locally");
            }}
          />
        ) : (
          <RecoveryState
            onHome={() => navigate("home")}
            onStart={() => openBuilder("direct")}
          />
        );
      case "debrief":
        return state.activeSession ? (
          <DebriefView
            session={state.activeSession}
            headingRef={mainHeadingRef}
            onReview={() => navigate("analytics")}
            onNextAction={() => openBuilder("direct", "adaptive")}
            onHome={() => {
              dispatch({ type: "NAVIGATE", view: "home" });
              window.history.pushState({}, "", window.location.pathname);
            }}
          />
        ) : (
          <RecoveryState
            onHome={() => navigate("home")}
            onStart={() => openBuilder("direct")}
          />
        );
      case "home":
      default:
        return (
          <HomeView
            savedSessions={state.savedSessions}
            activeSession={state.activeSession}
            favoritesCount={state.favorites.length}
            headingRef={mainHeadingRef}
            openBuilder={openBuilder}
            navigate={navigate}
            onResume={(sessionId) => {
              if (state.activeSession?.id === sessionId)
                dispatch({ type: "NAVIGATE", view: "session" });
              else
                dispatch({
                  type: "RESUME_SESSION",
                  sessionId,
                  at: nowIso(),
                });
              window.history.pushState({}, "", "#/session");
            }}
          />
        );
    }
  };

  return (
    <div
      className={`studio-shell ${state.view === "session" ? "in-session" : ""}`}
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside
        id="primary-navigation"
        className={`sidebar ${mobileNavOpen ? "open" : ""}`}
        aria-label="Primary navigation"
        inert={state.builderOpen || Boolean(panel) || resetConfirm || undefined}
      >
        <div className="sidebar-top">
          <button
            className="brand-button"
            onClick={() => navigate("home")}
            aria-label="Learning Studio home"
          >
            <span className="brand-mark" aria-hidden="true">
              <span>M</span>
            </span>
            <span>
              <strong>MissionMed</strong>
              <small>Learning Studio</small>
            </span>
          </button>
          <button
            ref={mobileCloseRef}
            className="mobile-close"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          >
            <Icon name="close" />
          </button>
        </div>

        <nav className="nav-list">
          {(
            [
              ["home", "home", "Home"],
              ["studio", "studio", "Studio"],
              ["sessions", "bookmark", "Saved"],
              ["favorites", "star", "Favorites"],
              ["analytics", "chart", "Analytics"],
              ["decisions", "decision", "Founder review"],
            ] as const
          ).map(([view, icon, label]) => (
            <button
              key={view}
              className={state.view === view ? "active" : ""}
              onClick={() => navigate(view)}
              aria-current={state.view === view ? "page" : undefined}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {view === "sessions" &&
              state.savedSessions.filter((item) => item.status === "paused")
                .length > 0 ? (
                <em>
                  {
                    state.savedSessions.filter(
                      (item) => item.status === "paused",
                    ).length
                  }
                </em>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="daily-entry-card">
          <span className="live-dot" />
          <p>From Daily Drills</p>
          <strong>Continue today’s learning</strong>
          <button onClick={() => openBuilder("daily-drills-simulated")}>
            Open simulated entry <Icon name="arrow" size={16} />
          </button>
        </div>

        <div className="sidebar-foot">
          <TruthPill tone="local">P4 · local synthetic</TruthPill>
          <p>Not deployed · not medically validated</p>
        </div>
      </aside>

      {mobileNavOpen ? (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <div
        className="workspace"
        inert={
          state.builderOpen ||
          Boolean(panel) ||
          resetConfirm ||
          mobileNavOpen ||
          undefined
        }
      >
        {state.view !== "session" ? (
          <header className="topbar">
            <button
              ref={mobileMenuRef}
              className="mobile-menu"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
              aria-controls="primary-navigation"
            >
              <Icon name="menu" />
            </button>
            <div>
              <span className="crumb">Learning Studio</span>
              <strong>{VIEW_LABELS[state.view]}</strong>
            </div>
            <div className="topbar-actions">
              <span
                className={`save-status ${state.persistenceStatus !== "saved" ? "warn" : ""}`}
              >
                <span /> {state.persistenceMessage}
              </span>
              <button
                className="icon-button"
                onClick={(event) => openPanel("guide", event.currentTarget)}
                aria-label="Open prototype guide"
              >
                <Icon name="info" />
              </button>
              <button
                className="avatar"
                onClick={(event) => openPanel("guide", event.currentTarget)}
                aria-label="Open prototype guide from avatar"
              >
                DM
              </button>
            </div>
          </header>
        ) : null}

        {storageConflict ? (
          <div className="conflict-banner" role="status">
            Another tab changed this prototype’s local data. Reload to inspect
            it; changes were not merged.
            <button onClick={() => window.location.reload()}>Reload</button>
            <button
              onClick={() => setStorageConflict(false)}
              aria-label="Dismiss"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ) : null}

        {state.persistenceStatus === "corrupt" ||
        state.persistenceStatus === "future-schema" ? (
          <div className="integrity-banner" role="alert">
            <Icon name="info" />
            <span>
              <strong>Saved state not loaded.</strong>{" "}
              {state.persistenceMessage}
            </span>
            <button onClick={requestReset}>Reset local data</button>
          </div>
        ) : null}

        <main id="main-content" className="main-content">
          {renderMain()}
        </main>
      </div>

      {state.builderOpen ? (
        <SessionBuilder
          dialogRef={builderDialogRef}
          state={state}
          error={setupError}
          setError={setSetupError}
          dispatch={dispatch}
          onStart={startSession}
          onClose={() => dispatch({ type: "CLOSE_BUILDER" })}
        />
      ) : null}

      {panel ? (
        <SidePanel
          ref={dialogRef}
          kind={panel}
          question={activeQuestion}
          note={
            activeQuestion ? (state.questionNotes[activeQuestion.id] ?? "") : ""
          }
          replayPlaying={replayPlaying}
          setReplayPlaying={setReplayPlaying}
          roundsConsidered={Boolean(
            activeSlot &&
              state.activeSession?.events.some(
                (event) =>
                  event.type === "EXPLANATION_OPENED" &&
                  event.slotId === activeSlot.slotId &&
                  event.detail === "rounds-foundation",
              ),
          )}
          onClose={() => setPanel(null)}
          onLog={(eventType, detail) => {
            if (activeSlot)
              dispatch({
                type: "LOG_EVENT",
                eventType,
                slotId: activeSlot.slotId,
                detail,
                at: nowIso(),
              });
          }}
          onNote={(body) => {
            if (activeQuestion)
              dispatch({
                type: "UPDATE_NOTE",
                questionId: activeQuestion.id,
                body,
                at: nowIso(),
              });
          }}
          onReset={requestReset}
        />
      ) : null}

      {resetConfirm ? (
        <div className="modal-layer" role="presentation">
          <div
            ref={resetDialogRef}
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-title"
          >
            <span className="warning-icon">
              <Icon name="trash" />
            </span>
            <h2 id="reset-title">Clear local prototype data?</h2>
            <p>
              This removes saved sessions, favorites, question notes, and
              Founder review notes from this browser only. It cannot be undone.
            </p>
            <div className="dialog-actions">
              <button
                className="button secondary"
                onClick={() => setResetConfirm(false)}
              >
                Cancel
              </button>
              <button className="button danger" onClick={resetLocalData}>
                Clear local data
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          <Icon name="check" size={17} /> {toast}
        </div>
      ) : null}
    </div>
  );
}

function HomeView({
  savedSessions,
  activeSession,
  favoritesCount,
  headingRef,
  openBuilder,
  navigate,
  onResume,
}: {
  savedSessions: StudioSession[];
  activeSession: StudioSession | null;
  favoritesCount: number;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  openBuilder: (origin: LaunchOrigin, templateId?: TemplateId) => void;
  navigate: (view: StudioView) => void;
  onResume: (id: string) => void;
}) {
  const resumable =
    (activeSession?.status === "active" ? activeSession : null) ??
    savedSessions.find((session) => session.status === "paused");
  const highestPriority = [...QUESTIONS].sort(
    (a, b) => b.weakSignal - a.weakSignal || a.id.localeCompare(b.id),
  )[0];
  const reviewSignalCount = QUESTIONS.filter(
    (question) => question.weakSignal >= 70,
  ).length;
  return (
    <div className="page home-page">
      <section className="hero-card">
        <div className="hero-copy">
          <div className="hero-pills">
            <TruthPill tone="mint">Flagship P4 prototype</TruthPill>
            <TruthPill>Bundled prompts: synthetic</TruthPill>
          </div>
          <p className="eyebrow">Make every drill teach twice</p>
          <h1 ref={headingRef} tabIndex={-1}>
            From fast recall to
            <br />
            <em>clinical reasoning.</em>
          </h1>
          <p className="hero-lede">
            Build a focused session from one drill or many, then move only as
            deep as the evidence calls for.
          </p>
          <div className="hero-actions">
            <button
              className="button primary large"
              onClick={() => openBuilder("direct")}
            >
              <Icon name="spark" /> Build a learning session
            </button>
            <button
              className="button ghost light"
              onClick={() => openBuilder("daily-drills-simulated")}
            >
              <Icon name="route" /> Enter from Daily Drills
            </button>
          </div>
          <p className="micro-copy">
            <span className="live-dot" /> Both paths use the same local session
            model. Daily Drills entry is simulated.
          </p>
        </div>
        <div
          className="hero-visual"
          aria-label="Learning progression illustration"
        >
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="learning-path">
            <div className="path-node complete">
              <span>01</span>
              <strong>Recall</strong>
              <small>Source signal</small>
            </div>
            <div className="path-line active">
              <i />
            </div>
            <div className="path-node current">
              <span>02</span>
              <strong>Apply</strong>
              <small>Board bridge</small>
            </div>
            <div className="path-line">
              <i />
            </div>
            <div className="path-node">
              <span>03</span>
              <strong>Reason</strong>
              <small>Clinical transfer</small>
            </div>
          </div>
          <div className="signal-card">
            <span>Adaptive preview</span>
            <strong>Why this next?</strong>
            <p>Priority score 89 · deterministic demo</p>
          </div>
        </div>
      </section>

      {resumable ? (
        <section className="resume-strip">
          <span className="resume-icon">
            <Icon name="play" />
          </span>
          <div>
            <p className="eyebrow">Ready when you are</p>
            <h2>
              Resume{" "}
              {TEMPLATES.find((item) => item.id === resumable.templateId)?.name}
            </h2>
            <p>
              {resumable.cursor + 1} of {resumable.queue.length} · browser-local
              <span>
                {" "}
                {resumable.status === "active" ? "active" : "saved"} session
              </span>
            </p>
          </div>
          <div className="resume-progress">
            <span style={{ width: `${sessionCompletion(resumable)}%` }} />
          </div>
          <button
            className="button secondary"
            onClick={() => onResume(resumable.id)}
          >
            Resume session <Icon name="arrow" size={17} />
          </button>
        </section>
      ) : null}

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Choose your learning contract</p>
            <h2>Four ways to move forward</h2>
          </div>
          <button className="text-link" onClick={() => navigate("studio")}>
            Compare templates <Icon name="arrow" size={16} />
          </button>
        </div>
        <div className="template-grid">
          {TEMPLATES.map((template, index) => (
            <button
              key={template.id}
              className={`template-card ${template.accent}`}
              onClick={() => openBuilder("direct", template.id)}
            >
              <span className="template-index">0{index + 1}</span>
              <span className="template-icon">
                <Icon name={template.icon} />
              </span>
              <span className="template-eyebrow">{template.eyebrow}</span>
              <strong>{template.name}</strong>
              <p>{template.description}</p>
              <span className="template-meta">
                <Icon name="clock" size={15} /> {template.duration}
                <i />
                <Icon name="arrow" size={17} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="home-insights">
        <article className="insight-card focus-card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Synthetic focus signal</p>
              <h2>Highest seeded-priority block</h2>
            </div>
            <TruthPill tone="violet">Adaptive preview</TruthPill>
          </div>
          <div className="focus-content">
            <Ring
              value={highestPriority.weakSignal}
              label="review priority"
              tone="violet"
            />
            <div>
              <strong>{highestPriority.topic}</strong>
              <p>
                Ranked by one bundled synthetic review-priority score; no
                learner history or recency model is connected.
              </p>
              <button
                className="text-link"
                onClick={() => openBuilder("direct", "adaptive")}
              >
                See the rule and start <Icon name="arrow" size={16} />
              </button>
            </div>
          </div>
        </article>
        <article className="insight-card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Last 8 demo sessions</p>
              <h2>Observed trend</h2>
            </div>
            <span className="metric-rise">+18 pts</span>
          </div>
          <MiniBars
            values={DEMO_HISTORY.map((item) => item.observed)}
            active={7}
          />
          <div className="stat-row">
            <div>
              <strong>76%</strong>
              <span>Latest observed</span>
            </div>
            <div>
              <strong>{favoritesCount}</strong>
              <span>Local favorites</span>
            </div>
            <div>
              <strong>{reviewSignalCount}</strong>
              <span>Signals ≥70</span>
            </div>
          </div>
          <p className="footnote">
            Synthetic demonstration data · not mastery or readiness.
          </p>
        </article>
        <article className="insight-card source-card">
          <div className="source-mark">
            <Icon name="layers" />
          </div>
          <p className="eyebrow">Truth at every layer</p>
          <h2>Know what you’re seeing.</h2>
          <ul>
            <li>
              <span className="dot mint" />
              Synthetic content
            </li>
            <li>
              <span className="dot gold" />
              Prototype-authored teaching
            </li>
            <li>
              <span className="dot slate" />
              Integration not connected
            </li>
          </ul>
          <button className="text-link" onClick={() => navigate("decisions")}>
            Open Founder review <Icon name="arrow" size={16} />
          </button>
        </article>
      </section>
    </div>
  );
}

function StudioLibrary({
  openBuilder,
  headingRef,
}: {
  openBuilder: OpenBuilder;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className="page library-page">
      <header className="page-header split">
        <div>
          <p className="eyebrow">Learning Studio</p>
          <h1 ref={headingRef} tabIndex={-1}>
            Build the right kind of practice.
          </h1>
          <p>
            Choose a template first. Scope, depth, and feedback follow its
            learning contract.
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => openBuilder("direct")}
        >
          <Icon name="spark" /> New session
        </button>
      </header>
      <div className="contract-grid">
        {TEMPLATES.map((template, index) => (
          <article
            className={`contract-card ${template.accent}`}
            key={template.id}
          >
            <div className="contract-top">
              <span className="template-icon">
                <Icon name={template.icon} />
              </span>
              <span>0{index + 1}</span>
            </div>
            <p className="eyebrow">{template.eyebrow}</p>
            <h2>{template.name}</h2>
            <p>{template.description}</p>
            <div className="contract-rule">
              <span>Learning contract</span>
              <strong>{template.contract}</strong>
            </div>
            <div className="contract-footer">
              <span>
                <Icon name="clock" size={15} /> {template.duration}
              </span>
              <button onClick={() => openBuilder("direct", template.id)}>
                Choose template <Icon name="arrow" size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
      <section className="scope-preview">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Flexible scope</p>
            <h2>One drill, a mixed block, or a precise signal.</h2>
          </div>
          <TruthPill>Exact intersection · never silently broadened</TruthPill>
        </div>
        <div className="scope-columns">
          <div>
            <h3>Recent synthetic drills</h3>
            {DRILLS.map((drill) => (
              <div className="list-row" key={drill.id}>
                <span className="list-date">{drill.date}</span>
                <div>
                  <strong>{drill.name}</strong>
                  <small>{drill.questionCount} source-shaped prompts</small>
                </div>
                <Icon name="chevron" size={17} />
              </div>
            ))}
          </div>
          <div>
            <h3>Subjects</h3>
            <div className="subject-cloud">
              {SUBJECTS.map((subject) => (
                <button
                  key={subject.id}
                  onClick={() =>
                    openBuilder("direct", undefined, {
                      focus: "all",
                      drillIds: DRILLS.map((drill) => drill.id),
                      subjectIds: [subject.id],
                    })
                  }
                >
                  <span className={`dot ${subject.tint}`} />
                  {subject.name}
                  <small>
                    {
                      QUESTIONS.filter(
                        (question) => question.subjectId === subject.id,
                      ).length
                    }
                  </small>
                </button>
              ))}
            </div>
          </div>
          <div className="truth-panel">
            <Icon name="info" />
            <h3>Prototype data boundary</h3>
            <p>
              Bundled prompts, drills, and score history are synthetic.
              User-entered notes stay browser-local and unencrypted; do not
              enter patient or other sensitive information. No Dr. J corpus,
              external or protected learner/account record, Zoom data, or
              production API is connected. Local synthetic session state is
              stored unencrypted in this browser.
            </p>
            <TruthPill tone="local">No external requests</TruthPill>
          </div>
        </div>
      </section>
    </div>
  );
}

function SessionsView({
  sessions,
  headingRef,
  onResume,
  onRemove,
  onStart,
  onReview,
}: {
  sessions: StudioSession[];
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onResume: (id: string) => void;
  onRemove: (id: string) => void;
  onStart: () => void;
  onReview: () => void;
}) {
  return (
    <div className="page">
      <header className="page-header split">
        <div>
          <p className="eyebrow">Browser-local continuity</p>
          <h1 ref={headingRef} tabIndex={-1}>
            Saved sessions
          </h1>
          <p>
            Pause, return, and resume the exact synthetic queue from this
            browser.
          </p>
        </div>
        <button className="button primary" onClick={onStart}>
          <Icon name="spark" /> New session
        </button>
      </header>
      <div className="boundary-callout">
        <Icon name="bookmark" />
        <div>
          <strong>Saved only in this browser</strong>
          <p>
            Local storage is not encrypted or account-synced. Clear it before
            leaving a shared device.
          </p>
        </div>
      </div>
      {sessions.length ? (
        <div className="saved-grid">
          {sessions.map((session) => {
            const template = TEMPLATES.find(
              (item) => item.id === session.templateId,
            );
            const completion = sessionCompletion(session);
            return (
              <article className="saved-card" key={session.id}>
                <div className="saved-card-top">
                  <span className={`template-icon small ${template?.accent}`}>
                    <Icon name={template?.icon ?? "spark"} size={18} />
                  </span>
                  <TruthPill
                    tone={session.status === "completed" ? "mint" : "gold"}
                  >
                    {session.status}
                  </TruthPill>
                </div>
                <p className="eyebrow">{template?.name}</p>
                <h2>{session.selectionSnapshot.focus.replaceAll("-", " ")}</h2>
                <p>
                  {session.queue.length} prompts ·{" "}
                  {session.selectionSnapshot.drillIds.length} drill
                  {session.selectionSnapshot.drillIds.length === 1 ? "" : "s"}
                </p>
                <div className="line-progress">
                  <span style={{ width: `${completion}%` }} />
                </div>
                <div className="saved-meta">
                  <span>{completion}% learning steps complete</span>
                  <span>
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="saved-actions">
                  {session.status === "paused" ? (
                    <button
                      className="button secondary"
                      onClick={() => onResume(session.id)}
                    >
                      Resume <Icon name="arrow" size={16} />
                    </button>
                  ) : (
                    <button className="button secondary" onClick={onReview}>
                      Open analytics dashboard
                    </button>
                  )}
                  <button
                    className="icon-button"
                    onClick={() => onRemove(session.id)}
                    aria-label={`Remove ${template?.name} session`}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <span>
            <Icon name="bookmark" size={30} />
          </span>
          <h2>No saved sessions yet</h2>
          <p>
            Pause any session and it will appear here with its exact queue,
            answers, flags, and position.
          </p>
          <button className="button primary" onClick={onStart}>
            Start a session
          </button>
        </div>
      )}
      <section className="demo-ledger">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Synthetic history</p>
            <h2>Eight-session exploration ledger</h2>
          </div>
          <TruthPill>Demonstration only</TruthPill>
        </div>
        <div
          className="ledger-table"
          role="table"
          aria-label="Synthetic session history"
        >
          <div className="ledger-row header" role="row">
            <span role="columnheader">Session</span>
            <span role="columnheader">Date</span>
            <span role="columnheader">Observed</span>
            <span role="columnheader">Confidence</span>
            <span role="columnheader">Replay</span>
            <span role="columnheader">Depth</span>
          </div>
          {DEMO_HISTORY.map((item) => (
            <div className="ledger-row" role="row" key={item.id}>
              <strong role="cell">{item.label}</strong>
              <span role="cell">{item.date}</span>
              <span role="cell">{item.observed}%</span>
              <span role="cell">{item.confidence}%</span>
              <span role="cell">
                {item.replayOpens} request{item.replayOpens === 1 ? "" : "s"}
              </span>
              <span role="cell">{item.explanationDepth}%</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function FavoritesView({
  favorites,
  notes,
  headingRef,
  onToggle,
  onStart,
}: {
  favorites: string[];
  notes: Record<string, string>;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onToggle: (id: string) => void;
  onStart: (favoritesOnly: boolean) => void;
}) {
  const items = QUESTIONS.filter((question) => favorites.includes(question.id));
  return (
    <div className="page">
      <header className="page-header split">
        <div>
          <p className="eyebrow">Occurrence-specific</p>
          <h1 ref={headingRef} tabIndex={-1}>
            Favorites
          </h1>
          <p>
            A lightweight local preference, separate from saved sessions and
            learner notes.
          </p>
        </div>
        {items.length ? (
          <button className="button primary" onClick={() => onStart(true)}>
            <Icon name="star" /> Practice favorites
          </button>
        ) : null}
      </header>
      {items.length ? (
        <div className="favorite-list">
          {items.map((question) => {
            const subject = SUBJECTS.find(
              (item) => item.id === question.subjectId,
            );
            const drill = DRILLS.find((item) => item.id === question.drillId);
            return (
              <article key={question.id}>
                <button
                  className="favorite-star active"
                  onClick={() => onToggle(question.id)}
                  aria-label={`Remove ${question.prompt} from favorites`}
                >
                  <Icon name="star" />
                </button>
                <div>
                  <div className="item-labels">
                    <TruthPill tone="local">Synthetic occurrence</TruthPill>
                    <span>{subject?.name}</span>
                  </div>
                  <h2>{question.prompt}</h2>
                  <p>{question.stem}</p>
                  <div className="favorite-meta">
                    <span>{drill?.name}</span>
                    <span>{question.id}</span>
                    {notes[question.id] ? (
                      <span>
                        <Icon name="notes" size={14} /> Local note
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <span>
            <Icon name="star" size={30} />
          </span>
          <h2>No favorites yet</h2>
          <p>
            Star a synthetic occurrence during a session for a quick path back
            to it.
          </p>
          <button className="button primary" onClick={() => onStart(false)}>
            Browse in a session
          </button>
        </div>
      )}
    </div>
  );
}

function AnalyticsView({
  tab,
  setTab,
  activeSession,
  savedSessions,
  headingRef,
  onStartAdaptive,
}: {
  tab: AnalyticsTab;
  setTab: (tab: AnalyticsTab) => void;
  activeSession: StudioSession | null;
  savedSessions: StudioSession[];
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onStartAdaptive: () => void;
}) {
  const score = activeSession ? observedSessionScore(activeSession) : 76;
  const tabs: [AnalyticsTab, string][] = [
    ["current", "Current session"],
    ["lifetime", "Lifetime"],
    ["mastery", "Mastery proxy"],
    ["heatmap", "Heatmaps"],
    ["trends", "Trends"],
    ["replay", "Replay usage"],
    ["explanations", "Explanation usage"],
    ["confidence", "Confidence history"],
  ];
  const onTabKey = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    const next = tabs[nextIndex][0];
    setTab(next);
    window.requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`#analytics-tab-${next}`)?.focus(),
    );
  };
  return (
    <div className="page analytics-page">
      <header className="page-header split">
        <div>
          <p className="eyebrow">Observed facts + simulated models</p>
          <h1 ref={headingRef} tabIndex={-1}>
            Learning analytics
          </h1>
          <p>
            Session behavior stays separate from mastery proxies, predictions,
            and readiness.
          </p>
        </div>
        <TruthPill tone="local">Local synthetic metrics</TruthPill>
      </header>
      <div
        className="analytics-tabs"
        role="tablist"
        aria-label="Analytics views"
      >
        {tabs.map(([id, label], index) => (
          <button
            key={id}
            id={`analytics-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`analytics-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
            onKeyDown={(event) => onTabKey(event, index)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="analytics-layout">
        <section
          className="analytics-primary"
          id={`analytics-panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`analytics-tab-${tab}`}
          tabIndex={0}
        >
          {tab === "current" ? (
            <CurrentAnalytics score={score} activeSession={activeSession} />
          ) : null}
          {tab === "lifetime" ? (
            <LifetimeAnalytics savedCount={savedSessions.length} />
          ) : null}
          {tab === "mastery" ? <MasteryAnalytics /> : null}
          {tab === "heatmap" ? <HeatmapAnalytics /> : null}
          {tab === "trends" ? <TrendAnalytics /> : null}
          {tab === "replay" ? (
            <UsageAnalytics kind="replay" activeSession={activeSession} />
          ) : null}
          {tab === "explanations" ? (
            <UsageAnalytics kind="explanations" activeSession={activeSession} />
          ) : null}
          {tab === "confidence" ? <ConfidenceAnalytics /> : null}
        </section>
        <PredictionCard onStartAdaptive={onStartAdaptive} />
      </div>
    </div>
  );
}

function CurrentAnalytics({
  score,
  activeSession,
}: {
  score: number;
  activeSession: StudioSession | null;
}) {
  const live = Boolean(activeSession);
  const responses = activeSession
    ? activeSession.queue.map((slot) => ({
        slot,
        response: activeSession.responses[slot.slotId],
        question: questionForSlot(slot),
      }))
    : [];
  const committed = responses.filter(
    ({ response }) => response?.committed,
  ).length;
  const highConfidenceMisses = responses.filter(
    ({ response, question }) =>
      response?.committed &&
      response.confidence === "high" &&
      response.selectedIndex !== null &&
      response.selectedIndex !== question?.correctIndex,
  ).length;
  const flags = responses.filter(({ response }) => response?.flagged).length;
  const replayRequests = live
    ? activeSession!.events.filter((event) => event.type === "REPLAY_REQUESTED")
        .length
    : DEMO_HISTORY.at(-1)!.replayOpens;
  const explanationOpens = live
    ? activeSession!.events.filter(
        (event) => event.type === "EXPLANATION_OPENED",
      ).length
    : DEMO_HISTORY.at(-1)!.explanationDepth;
  const denominator = Math.max(1, activeSession?.queue.length ?? 8);
  const scoreResponseCount = responses.filter(
    ({ response }) =>
      response?.committed &&
      (response.selfReport || response.selectedIndex !== null),
  ).length;
  const scoreLabel =
    activeSession?.templateId === "quick-review"
      ? "self-report index"
      : activeSession
        ? "synthetic key match"
        : "seeded fixture value";
  return (
    <>
      <div className="analytics-summary">
        <div>
          <p className="eyebrow">Current session</p>
          <h2>
            {live
              ? "Current browser-local session signals"
              : "Latest seeded demo fixture"}
          </h2>
          <p>
            {activeSession
              ? `${sessionCompletion(activeSession)}% learning steps complete · ${activeSession.queue.length} prompts`
              : "Synthetic Session 08 · Jul 19"}
          </p>
        </div>
        <Ring value={score} label={scoreLabel} />
      </div>
      <div className="metric-grid">
        <article>
          <span>{scoreLabel}</span>
          <strong>{score}%</strong>
          <small>
            {activeSession?.templateId === "quick-review"
              ? `knew 100 · partial 50 · missed 0 · ${scoreResponseCount} of ${activeSession.queue.length} self-reports`
              : activeSession
                ? `bundled synthetic answer key · ${scoreResponseCount} of ${activeSession.queue.length} completed selections`
                : "demonstration only"}
          </small>
        </article>
        <article>
          <span>{live ? "Committed prompts" : "Seeded confidence"}</span>
          <strong>
            {live ? committed : `${DEMO_HISTORY.at(-1)!.confidence}%`}
          </strong>
          <small>{live ? "browser-local events" : "fixture value"}</small>
        </article>
        <article>
          <span>Replay requests</span>
          <strong>{replayRequests}</strong>
          <small>{live ? "0 verified opens" : "seeded fixture"}</small>
        </article>
        <article>
          <span>{live ? "Explanation opens" : "Seeded depth index"}</span>
          <strong>{explanationOpens}</strong>
          <small>
            {live ? "deliberate tab selections" : "fixture percent"}
          </small>
        </article>
      </div>
      <article className="debrief-panel">
        <div className="card-head">
          <div>
            <p className="eyebrow">
              {live ? "Interaction-classified debrief" : "Seeded demo summary"}
            </p>
            <h2>
              {live ? "What happened locally" : "What the fixture contains"}
            </h2>
          </div>
          <TruthPill>
            {live ? "Observed local events" : "Demonstration only"}
          </TruthPill>
        </div>
        <div className="error-bars">
          <div>
            <span>{live ? "Committed" : "Outcome"}</span>
            <i>
              <b
                style={{
                  width: live ? `${(committed / denominator) * 100}%` : "76%",
                }}
              />
            </i>
            <strong>{live ? committed : 76}</strong>
          </div>
          <div>
            <span>{live ? "High-conf miss" : "Confidence"}</span>
            <i>
              <b
                style={{
                  width: live
                    ? `${(highConfidenceMisses / denominator) * 100}%`
                    : "78%",
                }}
              />
            </i>
            <strong>{live ? highConfidenceMisses : 78}</strong>
          </div>
          <div>
            <span>{live ? "Flags" : "Replay request"}</span>
            <i>
              <b
                style={{
                  width: live ? `${(flags / denominator) * 100}%` : "13%",
                }}
              />
            </i>
            <strong>{live ? flags : 1}</strong>
          </div>
        </div>
        <div className="next-action">
          <span>
            <Icon name="route" />
          </span>
          <div>
            <strong>One defensible next action</strong>
            <p>
              {live
                ? highConfidenceMisses > 0
                  ? "Revisit the high-confidence review signal without the explanation visible."
                  : flags > 0
                    ? "Build a Quick Review block from the prompts you flagged."
                    : "Continue with the highest bundled synthetic review-priority score."
                : "Start an Adaptive preview to inspect the deterministic priority ordering."}
            </p>
          </div>
        </div>
      </article>
    </>
  );
}

function LifetimeAnalytics({ savedCount }: { savedCount: number }) {
  return (
    <>
      <div className="metric-grid">
        <article>
          <span>Seeded demo sessions</span>
          <strong>8</strong>
          <small>fixed fixture</small>
        </article>
        <article>
          <span>Saved local sessions</span>
          <strong>{savedCount}</strong>
          <small>browser-local records</small>
        </article>
        <article>
          <span>Seeded prompt count</span>
          <strong>84</strong>
          <small>demonstration history</small>
        </article>
        <article>
          <span>Study minutes</span>
          <strong>126</strong>
          <small>simulated history</small>
        </article>
      </div>
      <article className="chart-card">
        <div className="card-head">
          <div>
            <p className="eyebrow">Seeded lifetime demo trend</p>
            <h2>Session outcomes over time</h2>
          </div>
          <span className="metric-rise">+18 pts</span>
        </div>
        <div
          className="line-chart"
          aria-label="Observed session values rose from 58 to 76 percent across eight demo sessions"
        >
          <svg viewBox="0 0 720 260" role="img">
            <title>Observed outcomes over eight synthetic sessions</title>
            <g className="chart-grid">
              <path d="M40 40H700M40 100H700M40 160H700M40 220H700" />
            </g>
            <path
              className="area"
              d="M40 190 L130 172 L220 184 L310 150 L400 134 L490 143 L580 112 L680 94 L680 220 L40 220 Z"
            />
            <path
              className="trend-line"
              d="M40 190 L130 172 L220 184 L310 150 L400 134 L490 143 L580 112 L680 94"
            />
            {[190, 172, 184, 150, 134, 143, 112, 94].map((y, index) => (
              <circle key={index} cx={40 + index * (640 / 7)} cy={y} r="5" />
            ))}
          </svg>
          <div className="chart-labels">
            <span>Jun 21</span>
            <span>Jul 19</span>
          </div>
        </div>
        <p className="footnote">
          Observed synthetic outcomes describe this demo history only; they do
          not establish mastery or exam readiness.
        </p>
      </article>
    </>
  );
}

function MasteryAnalytics() {
  return (
    <>
      <div className="simulation-banner">
        <Icon name="spark" />
        <div>
          <strong>Simulated mastery proxy — not validated</strong>
          <p>
            Seeded illustrative values show the intended separation of subject
            signals. No mastery formula, psychometric model, or readiness
            instrument is implemented.
          </p>
        </div>
      </div>
      <div className="mastery-list">
        {SUBJECTS.map((subject, index) => {
          const value = [74, 62, 81, 55][index];
          return (
            <article key={subject.id}>
              <div className="mastery-name">
                <span className={`dot ${subject.tint}`} />
                <div>
                  <strong>{subject.name}</strong>
                  <small>
                    {
                      QUESTIONS.filter(
                        (question) => question.subjectId === subject.id,
                      ).length
                    }{" "}
                    bundled catalog occurrences
                  </small>
                </div>
              </div>
              <div className="mastery-meter">
                <i>
                  <b style={{ width: `${value}%` }} />
                </i>
                <strong>{value}</strong>
                <small>proxy</small>
              </div>
            </article>
          );
        })}
      </div>
      <div className="claim-separation">
        <div>
          <span>Seeded demo outcome</span>
          <strong>76%</strong>
          <small>illustrative fixture</small>
        </div>
        <div>
          <span>Simulated mastery proxy</span>
          <strong>68</strong>
          <small>unvalidated model output</small>
        </div>
        <div>
          <span>Readiness</span>
          <strong>Not measured</strong>
          <small>no authorized instrument</small>
        </div>
      </div>
    </>
  );
}

function HeatmapAnalytics() {
  const values = [
    [2, 3, 4, 3, 5, 4, 4],
    [1, 2, 3, 4, 4, 5, 3],
    [3, 3, 2, 4, 5, 4, 5],
    [2, 1, 3, 3, 4, 4, 3],
  ];
  return (
    <article className="chart-card heatmap-card">
      <div className="card-head">
        <div>
          <p className="eyebrow">Taxonomy-backed demo</p>
          <h2>Review activity heatmap</h2>
        </div>
        <TruthPill>Seven demo intervals</TruthPill>
      </div>
      <div className="heatmap">
        <div className="heatmap-labels">
          {SUBJECTS.map((s) => (
            <span key={s.id}>{s.shortName}</span>
          ))}
        </div>
        <div className="heatmap-grid">
          {values.flatMap((row, rowIndex) =>
            row.map((value, index) => (
              <span
                key={`${rowIndex}-${index}`}
                className={`level-${value}`}
                role="img"
                aria-label={`${SUBJECTS[rowIndex].name}, interval ${index + 1}: synthetic activity level ${value} of 5`}
                title={`${SUBJECTS[rowIndex].name}, interval ${index + 1}: synthetic activity level ${value} of 5`}
              />
            )),
          )}
        </div>
      </div>
      <div className="heatmap-legend" aria-hidden="true">
        <span>Less</span>
        {[1, 2, 3, 4, 5].map((v) => (
          <i className={`level-${v}`} key={v} />
        ))}
        <span>More</span>
      </div>
      <p className="footnote">
        Activity intensity is seeded demonstration data. Topic labels come from
        the bundled synthetic catalog, not keyword inference.
      </p>
    </article>
  );
}

function TrendAnalytics() {
  return (
    <article className="chart-card">
      <div className="card-head">
        <div>
          <p className="eyebrow">Three separate signals</p>
          <h2>Observed, confidence, and simulated prediction</h2>
        </div>
      </div>
      <div
        className="multi-trend"
        aria-label="Trend chart comparing observed outcomes, confidence, and simulated prediction"
      >
        <svg viewBox="0 0 720 280" role="img">
          <title>Three synthetic trend lines over eight sessions</title>
          <g className="chart-grid">
            <path d="M40 45H700M40 105H700M40 165H700M40 225H700" />
          </g>
          <polyline
            className="observed"
            points="40,190 130,172 220,184 310,150 400,134 490,143 580,112 680,94"
          />
          <polyline
            className="confidence"
            points="40,118 130,138 220,176 310,128 400,112 490,156 580,102 680,84"
          />
          <polyline
            className="prediction"
            points="40,176 130,165 220,160 310,150 400,144 490,139 580,128 680,116"
          />
        </svg>
        <div className="trend-legend">
          <span>
            <i className="observed" />
            Observed
          </span>
          <span>
            <i className="confidence" />
            Confidence
          </span>
          <span>
            <i className="prediction" />
            Simulated prediction
          </span>
        </div>
      </div>
      <p className="footnote">
        Lines share a display, not an authority level. Prediction remains
        simulated and unvalidated.
      </p>
    </article>
  );
}

function UsageAnalytics({
  kind,
  activeSession,
}: {
  kind: "replay" | "explanations";
  activeSession: StudioSession | null;
}) {
  const isReplay = kind === "replay";
  const live = Boolean(activeSession);
  const localCount =
    activeSession?.events.filter(
      (event) =>
        event.type === (isReplay ? "REPLAY_REQUESTED" : "EXPLANATION_OPENED"),
    ).length ?? 0;
  const deepCount = live
    ? activeSession!.events.filter(
        (event) =>
          event.type === "EXPLANATION_OPENED" && event.detail === "deep",
      ).length
    : 0;
  const seededReplayRequests = DEMO_HISTORY.reduce(
    (sum, item) => sum + item.replayOpens,
    0,
  );
  const seededReplaySessions = DEMO_HISTORY.filter(
    (item) => item.replayOpens > 0,
  ).length;
  const latestDepth = DEMO_HISTORY.at(-1)!.explanationDepth;
  const meanDepth = Math.round(
    DEMO_HISTORY.reduce((sum, item) => sum + item.explanationDepth, 0) /
      DEMO_HISTORY.length,
  );
  const unavailableMedia = QUESTIONS.filter(
    (question) => question.replay.status === "unavailable",
  ).length;
  return (
    <>
      <div className="metric-grid">
        <article>
          <span>
            {isReplay
              ? live
                ? "Replay requests"
                : "Seeded replay requests"
              : live
                ? "Layer opens"
                : "Latest seeded depth index"}
          </span>
          <strong>
            {live
              ? localCount
              : isReplay
                ? seededReplayRequests
                : `${latestDepth}%`}
          </strong>
          <small>
            {live
              ? "browser-local interactions"
              : `derived from ${DEMO_HISTORY.length} seeded sessions`}
          </small>
        </article>
        <article>
          <span>
            {isReplay
              ? "Verified plays"
              : live
                ? "Deep-dive opens"
                : "Mean seeded depth index"}
          </span>
          <strong>{isReplay ? "0" : live ? deepCount : `${meanDepth}%`}</strong>
          <small>
            {isReplay
              ? "placeholder only"
              : live
                ? "browser-local interactions"
                : "derived seeded mean"}
          </small>
        </article>
        <article>
          <span>{live ? "Active-session prompts" : "Seeded sessions"}</span>
          <strong>
            {live
              ? activeSession!.queue.length
              : isReplay
                ? `${seededReplaySessions}/${DEMO_HISTORY.length}`
                : DEMO_HISTORY.length}
          </strong>
          <small>
            {live ? "current local scope" : "explicit fixture scope"}
          </small>
        </article>
        <article>
          <span>
            {isReplay ? "Unavailable media fixtures" : "Available layers"}
          </span>
          <strong>{isReplay ? unavailableMedia : "3"}</strong>
          <small>
            {isReplay
              ? "bundled catalog count"
              : "concise · deep · alternatives"}
          </small>
        </article>
      </div>
      <article className="debrief-panel">
        <div className="card-head">
          <div>
            <p className="eyebrow">
              {isReplay ? "Replay boundary" : "Explanation depth"}
            </p>
            <h2>
              {isReplay
                ? "Requests are not verified plays"
                : "Concise first, depth on demand"}
            </h2>
          </div>
          <TruthPill tone={isReplay ? "gold" : "mint"}>
            {isReplay
              ? "Not connected"
              : live
                ? "Observed local opens"
                : "Seeded demo fixture"}
          </TruthPill>
        </div>
        <p>
          {isReplay
            ? "The P4 counts a learner asking for replay, then records that the local placeholder was shown. It never increments a verified-open metric."
            : "The studio records which layer was deliberately opened. Rendering a control does not count as use."}
        </p>
        <MiniBars
          values={DEMO_HISTORY.map((item) =>
            isReplay ? item.replayOpens * 20 : item.explanationDepth,
          )}
          active={7}
        />
        <p className="footnote">
          Bars always show the eight seeded sessions. Headline cards explicitly
          identify current browser-local events versus derived seeded values.
        </p>
      </article>
    </>
  );
}

function ConfidenceAnalytics() {
  return (
    <>
      <div className="calibration-card">
        <div>
          <p className="eyebrow">Seeded confidence fixture</p>
          <h2>Calibrating certainty</h2>
          <p>
            Confidence is captured before feedback in Board and Clinical Mastery
            templates. The plot below is illustrative seeded data, not a
            calculation from the current session.
          </p>
        </div>
        <div
          className="calibration-plot"
          aria-label="Synthetic confidence calibration plot"
        >
          <span className="axis y">Observed</span>
          <span className="axis x">Confidence</span>
          <i className="diagonal" />
          {[
            [26, 70],
            [42, 59],
            [58, 46],
            [72, 34],
            [84, 25],
          ].map(([x, y], i) => (
            <b key={i} style={{ left: `${x}%`, top: `${y}%` }} />
          ))}
        </div>
      </div>
      <div className="confidence-summary">
        <article>
          <span className="dot mint" />
          <div>
            <strong>Well calibrated</strong>
            <p>5 synthetic responses</p>
          </div>
          <em>± 5 pts</em>
        </article>
        <article>
          <span className="dot amber" />
          <div>
            <strong>Under-confident</strong>
            <p>2 synthetic responses</p>
          </div>
          <em>Review wins</em>
        </article>
        <article>
          <span className="dot rose" />
          <div>
            <strong>Over-confident</strong>
            <p>1 synthetic response</p>
          </div>
          <em>Review miss</em>
        </article>
      </div>
    </>
  );
}

function simulatedPredictionFixture() {
  const current = DEMO_HISTORY.at(-1)!.predicted;
  const rolling = Math.round(
    DEMO_HISTORY.slice(-3).reduce((sum, item) => sum + item.predicted, 0) / 3,
  );
  const syntheticStandardError = 3.06;
  const margin = Math.ceil(1.96 * syntheticStandardError);
  return {
    current,
    rolling,
    lifetimeTrend: current - DEMO_HISTORY[0].predicted,
    lower: current - margin,
    upper: current + margin,
    margin,
    syntheticStandardError,
  };
}

function PredictionCard({ onStartAdaptive }: { onStartAdaptive: () => void }) {
  const prediction = simulatedPredictionFixture();
  return (
    <aside className="prediction-card">
      <div className="prediction-head">
        <span className="prediction-icon">
          <Icon name="spark" />
        </span>
        <TruthPill tone="violet">Simulated · not validated</TruthPill>
      </div>
      <p className="eyebrow">Prototype score projection</p>
      <div className="prediction-number">
        <strong>{prediction.current}</strong>
        <span>
          simulated 95% confidence interval {prediction.lower}–
          {prediction.upper}
        </span>
      </div>
      <p className="prediction-copy">
        A deterministic demo based on the eight seeded synthetic sessions.
      </p>
      <div className="prediction-stats">
        <div>
          <span>Current seeded prediction</span>
          <strong>{prediction.current}</strong>
        </div>
        <div>
          <span>Rolling</span>
          <strong>{prediction.rolling}</strong>
        </div>
        <div>
          <span>Lifetime trend</span>
          <strong>+{prediction.lifetimeTrend}</strong>
        </div>
      </div>
      <div className="prediction-chart">
        <MiniBars
          values={DEMO_HISTORY.map((item) => item.predicted)}
          active={7}
        />
        <div className="interval">
          <span style={{ left: "54%", width: "30%" }} />
          <i style={{ left: "69%" }} />
        </div>
      </div>
      <details className="model-disclosure">
        <summary>
          <Icon name="info" size={16} /> How the demo rule works
        </summary>
        <p>
          i1q4000-demo-v1 uses the latest seeded prediction; rolling is the mean
          of three seeded predictions. The fixture supplies a synthetic model
          standard error of {prediction.syntheticStandardError}; the 95%
          normal-approximation confidence interval is current ± 1.96 × that
          value, rounded outward to ±{prediction.margin}. It is not estimated
          from learner data, calibrated, or validated—and is not an exam score,
          mastery, or readiness claim.
        </p>
      </details>
      <button className="button primary full" onClick={onStartAdaptive}>
        Start adaptive preview <Icon name="arrow" size={16} />
      </button>
    </aside>
  );
}

function DecisionsView({
  decisions,
  notes,
  setNotes,
  headingRef,
  onSave,
}: {
  decisions: Record<
    string,
    { selection: string; note: string; updatedAt: string }
  >;
  notes: Record<string, string>;
  setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onSave: (id: string, selection: string) => void;
}) {
  const [selections, setSelections] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(decisions).map(([id, value]) => [id, value.selection]),
    ),
  );
  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Founder decision log</p>
        <h1 ref={headingRef} tabIndex={-1}>
          Review the product hypotheses.
        </h1>
        <p>
          Selections are browser-local review notes. They are not Founder
          ratification, product canon, or release authority.
        </p>
      </header>
      <div className="decision-boundary">
        <TruthPill tone="gold">Review artifact</TruthPill>
        <span>
          The requested prototype surfaces are implemented; three adoption
          questions remain open.
        </span>
      </div>
      <div className="decision-list">
        {FOUNDER_DECISIONS.map((decision, index) => (
          <article key={decision.id}>
            <div className="decision-number">0{index + 1}</div>
            <div className="decision-body">
              <p className="eyebrow">Open product decision</p>
              <h2>{decision.title}</h2>
              <p>{decision.question}</p>
              <div className="decision-options">
                {decision.options.map((option) => (
                  <label
                    key={option}
                    className={
                      selections[decision.id] === option ? "selected" : ""
                    }
                  >
                    <input
                      type="radio"
                      name={decision.id}
                      value={option}
                      checked={selections[decision.id] === option}
                      onChange={() =>
                        setSelections({ ...selections, [decision.id]: option })
                      }
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              <label className="note-field">
                <span>
                  Founder note <em>optional · local only</em>
                </span>
                <textarea
                  value={
                    notes[decision.id] ?? decisions[decision.id]?.note ?? ""
                  }
                  onChange={(event) =>
                    setNotes({ ...notes, [decision.id]: event.target.value })
                  }
                  placeholder="Capture what should change before the next gate…"
                />
              </label>
              <div className="decision-save">
                <span>
                  {decisions[decision.id]
                    ? `Saved locally ${new Date(decisions[decision.id].updatedAt).toLocaleString()}`
                    : "No decision saved"}
                </span>
                <button
                  className="button secondary"
                  disabled={!selections[decision.id]}
                  onClick={() => onSave(decision.id, selections[decision.id])}
                >
                  Save review note
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <section className="founder-footer">
        <div>
          <Icon name="decision" />
          <div>
            <p className="eyebrow">What this P4 can establish</p>
            <h2>Interaction direction, not production adoption.</h2>
          </div>
        </div>
        <ul>
          <li>Can the Founder explore every required flow?</li>
          <li>Are the learning contracts understandable?</li>
          <li>Are simulation boundaries unmistakable?</li>
        </ul>
        <p>
          Medical review, psychometric validation, real consumer integration,
          accessibility certification, and deployment remain separate gates.
        </p>
      </section>
    </div>
  );
}

function SessionBuilder({
  dialogRef,
  state,
  error,
  setError,
  dispatch,
  onStart,
  onClose,
}: {
  dialogRef: React.RefObject<HTMLElement | null>;
  state: typeof INITIAL_STATE;
  error: string;
  setError: (value: string) => void;
  dispatch: React.Dispatch<Parameters<typeof studioReducer>[1]>;
  onStart: () => void;
  onClose: () => void;
}) {
  const template = TEMPLATES.find(
    (item) => item.id === state.builder.templateId,
  )!;
  const preview = buildQueue(state.builder, state.favorites);
  const next = () => {
    if (state.builderStep === 2 && preview.error) {
      setError(preview.error);
      return;
    }
    setError("");
    dispatch({
      type: "SET_BUILDER_STEP",
      step: Math.min(3, state.builderStep + 1) as 1 | 2 | 3,
    });
  };
  return (
    <div className="builder-layer" role="presentation">
      <section
        ref={dialogRef}
        className="session-builder"
        role="dialog"
        aria-modal="true"
        aria-labelledby="builder-title"
      >
        <header className="builder-header">
          <div>
            <TruthPill
              tone={
                state.builder.launchOrigin === "daily-drills-simulated"
                  ? "gold"
                  : "local"
              }
            >
              {state.builder.launchOrigin === "daily-drills-simulated"
                ? "Simulated Daily Drills entry"
                : "Local direct launch"}
            </TruthPill>
            <h2 id="builder-title">Build your session</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close session builder"
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="stepper" aria-label={`Step ${state.builderStep} of 3`}>
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={state.builderStep >= step ? "active" : ""}
            >
              <span>
                {state.builderStep > step ? (
                  <Icon name="check" size={14} />
                ) : (
                  step
                )}
              </span>
              <em>{["Template", "Scope", "Review"][step - 1]}</em>
            </div>
          ))}
        </div>
        <div className="builder-content">
          {state.builderStep === 1 ? (
            <div className="builder-step">
              <p className="eyebrow">Step 1 · learning contract</p>
              <h3>How should this session teach?</h3>
              <div className="builder-template-list">
                {TEMPLATES.map((item) => (
                  <button
                    key={item.id}
                    className={`${item.accent} ${state.builder.templateId === item.id ? "selected" : ""}`}
                    onClick={() =>
                      dispatch({ type: "SET_TEMPLATE", templateId: item.id })
                    }
                    aria-pressed={state.builder.templateId === item.id}
                  >
                    <span className="template-icon">
                      <Icon name={item.icon} />
                    </span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.description}</small>
                      <em>{item.contract}</em>
                    </span>
                    <i>
                      {state.builder.templateId === item.id ? (
                        <Icon name="check" size={15} />
                      ) : null}
                    </i>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {state.builderStep === 2 ? (
            <div className="builder-step scope-step">
              <p className="eyebrow">Step 2 · exact scope</p>
              <h3>What should we include?</h3>
              <div className="scope-builder-grid">
                <fieldset>
                  <legend>
                    Drills <span>{state.builder.drillIds.length} selected</span>
                  </legend>
                  {DRILLS.map((drill) => (
                    <label
                      className={
                        state.builder.drillIds.includes(drill.id)
                          ? "selected"
                          : ""
                      }
                      key={drill.id}
                    >
                      <input
                        type="checkbox"
                        checked={state.builder.drillIds.includes(drill.id)}
                        onChange={() =>
                          dispatch({ type: "TOGGLE_DRILL", drillId: drill.id })
                        }
                      />
                      <span>
                        <strong>{drill.name}</strong>
                        <small>
                          {drill.date} · {drill.questionCount} prompts
                        </small>
                      </span>
                      <i>
                        <Icon name="check" size={14} />
                      </i>
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>
                    Subjects{" "}
                    <span>{state.builder.subjectIds.length} selected</span>
                  </legend>
                  {SUBJECTS.map((subject) => (
                    <label
                      className={
                        state.builder.subjectIds.includes(subject.id)
                          ? "selected"
                          : ""
                      }
                      key={subject.id}
                    >
                      <input
                        type="checkbox"
                        checked={state.builder.subjectIds.includes(subject.id)}
                        onChange={() =>
                          dispatch({
                            type: "TOGGLE_SUBJECT",
                            subjectId: subject.id,
                          })
                        }
                      />
                      <span className={`dot ${subject.tint}`} />
                      <span>
                        <strong>{subject.name}</strong>
                        <small>
                          {
                            QUESTIONS.filter((q) => q.subjectId === subject.id)
                              .length
                          }{" "}
                          synthetic occurrences
                        </small>
                      </span>
                      <i>
                        <Icon name="check" size={14} />
                      </i>
                    </label>
                  ))}
                </fieldset>
              </div>
              <fieldset className="focus-options">
                <legend>Focus</legend>
                {(
                  [
                    ["all", "Everything in scope"],
                    [
                      "weak-concepts",
                      "Weak concepts · ranked by synthetic signal",
                    ],
                    ["adaptive-review", "Adaptive review"],
                    ["favorites", "Favorites only"],
                  ] as [BuilderFocus, string][]
                ).map(([id, label]) => (
                  <label
                    className={state.builder.focus === id ? "selected" : ""}
                    key={id}
                  >
                    <input
                      type="radio"
                      name="focus"
                      checked={state.builder.focus === id}
                      onChange={() =>
                        dispatch({ type: "SET_FOCUS", focus: id })
                      }
                    />
                    <span>{label}</span>
                    {id === "adaptive-review" ? (
                      <small>simulated logic</small>
                    ) : null}
                  </label>
                ))}
              </fieldset>
              <label className="length-control">
                <span>
                  <strong>Session length</strong>
                  <small>
                    up to {state.builder.length} unique prompts · no validated
                    completion-time estimate
                  </small>
                </span>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={state.builder.length}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_LENGTH",
                      length: Number(e.target.value),
                    })
                  }
                />
                <output>{state.builder.length}</output>
              </label>
              {error ? (
                <div className="builder-error" role="alert">
                  <Icon name="info" />
                  <span>{error}</span>
                  <button
                    onClick={() => {
                      dispatch({ type: "SET_FOCUS", focus: "all" });
                      setError("");
                    }}
                  >
                    Show all in scope
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {state.builderStep === 3 ? (
            <div className="builder-step review-step">
              <p className="eyebrow">Step 3 · review</p>
              <h3>Your session is ready.</h3>
              <div className="review-hero">
                <span className={`template-icon ${template.accent}`}>
                  <Icon name={template.icon} size={26} />
                </span>
                <div>
                  <TruthPill tone={template.accent}>
                    {template.eyebrow}
                  </TruthPill>
                  <h4>{template.name}</h4>
                  <p>{template.contract}</p>
                </div>
                <strong>
                  {preview.queue.length}
                  <small>prompts</small>
                </strong>
              </div>
              {preview.queue.length < state.builder.length ? (
                <p className="availability-note">
                  This exact intersection contains {preview.queue.length} unique
                  synthetic occurrence{preview.queue.length === 1 ? "" : "s"};
                  the prototype will not repeat or silently broaden them.
                </p>
              ) : null}
              <dl className="review-details">
                <div>
                  <dt>Entry</dt>
                  <dd>
                    {state.builder.launchOrigin === "daily-drills-simulated"
                      ? "Simulated Daily Drills"
                      : "Local direct launch"}
                  </dd>
                </div>
                <div>
                  <dt>Drills</dt>
                  <dd>{state.builder.drillIds.length} selected</dd>
                </div>
                <div>
                  <dt>Subjects</dt>
                  <dd>
                    {state.builder.subjectIds.length > 1
                      ? "Mixed subjects"
                      : SUBJECTS.find(
                          (s) => s.id === state.builder.subjectIds[0],
                        )?.name}
                  </dd>
                </div>
                <div>
                  <dt>Focus</dt>
                  <dd>{state.builder.focus.replaceAll("-", " ")}</dd>
                </div>
              </dl>
              {state.builder.templateId === "adaptive" ? (
                <div className="adaptive-disclosure">
                  <Icon name="route" />
                  <div>
                    <strong>How the Adaptive preview chooses</strong>
                    <p>
                      One deterministic prototype rule ranks the bundled
                      synthetic review-priority score. Every item explains its
                      resulting position.
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="truth-check">
                <Icon name="check" />
                <p>
                  <strong>Synthetic prototype only.</strong> No protected source
                  is connected; no account data, verified replay, Zoom data,
                  readiness measure, or production service will be used.
                </p>
              </div>
            </div>
          ) : null}
        </div>
        <footer className="builder-footer">
          <button
            className="button ghost"
            onClick={() =>
              state.builderStep === 1
                ? onClose()
                : dispatch({
                    type: "SET_BUILDER_STEP",
                    step: (state.builderStep - 1) as 1 | 2,
                  })
            }
          >
            {state.builderStep === 1 ? "Cancel" : "Back"}
          </button>
          <span>Step {state.builderStep} of 3</span>
          {state.builderStep < 3 ? (
            <button className="button primary" onClick={next}>
              Continue <Icon name="arrow" size={16} />
            </button>
          ) : (
            <button className="button primary" onClick={onStart}>
              Start {template.shortName} <Icon name="play" size={16} />
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

function SessionView({
  session,
  slot,
  question,
  response,
  template,
  isFavorite,
  quickReveal,
  setQuickReveal,
  explanationTab,
  setExplanationTab,
  dispatch,
  openPanel,
  onNext,
  onPause,
}: {
  session: StudioSession;
  slot: StudioSession["queue"][number];
  question: NonNullable<ReturnType<typeof questionForSlot>>;
  response: StudioSession["responses"][string] | undefined;
  template: (typeof TEMPLATES)[number] | undefined;
  isFavorite: boolean;
  quickReveal: boolean;
  setQuickReveal: () => void;
  explanationTab: "concise" | "deep" | "alternatives";
  setExplanationTab: (tab: "concise" | "deep" | "alternatives") => void;
  dispatch: React.Dispatch<Parameters<typeof studioReducer>[1]>;
  openPanel: (kind: PanelKind, trigger: HTMLElement) => void;
  onNext: () => void;
  onPause: () => void;
}) {
  const quick = session.templateId === "quick-review";
  const committed = Boolean(response?.committed);
  const revealed = quick
    ? quickReveal || committed
    : Boolean(response?.revealed);
  const correct = response?.selectedIndex === question.correctIndex;
  const subject = SUBJECTS.find((item) => item.id === question.subjectId);
  const drill = DRILLS.find((item) => item.id === question.drillId);
  const progress = ((session.cursor + 1) / session.queue.length) * 100;
  const clinicalRung = (session.cursor % 3) + 1;
  const firstIncomplete = session.queue.findIndex(
    (item) => !isSlotComplete(session, item.slotId),
  );
  const furthestReachable =
    firstIncomplete === -1 ? session.queue.length - 1 : firstIncomplete;
  const explanationTabs = [
    ["concise", "Concise"],
    ["deep", "Deep dive"],
    ["alternatives", "Alternatives"],
  ] as const;
  const onExplanationKey = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex = index;
    if (event.key === "ArrowRight")
      nextIndex = (index + 1) % explanationTabs.length;
    else if (event.key === "ArrowLeft")
      nextIndex = (index - 1 + explanationTabs.length) % explanationTabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = explanationTabs.length - 1;
    else return;
    event.preventDefault();
    const next = explanationTabs[nextIndex][0];
    setExplanationTab(next);
    window.requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`#explanation-tab-${next}`)?.focus(),
    );
  };
  return (
    <div className="session-page">
      <header className="session-header">
        <button
          className="session-brand"
          onClick={onPause}
          aria-label="Save session and return"
        >
          <span className="brand-mark">
            <span>M</span>
          </span>
          <span>
            <strong>Learning Studio</strong>
            <small>Local prototype</small>
          </span>
        </button>
        <div className="session-progress">
          <div>
            <span>{template?.name}</span>
            <strong>
              {session.cursor + 1} <i>/</i> {session.queue.length}
            </strong>
          </div>
          <div className="line-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="session-head-actions">
          <TruthPill tone="local">Synthetic content</TruthPill>
          <button className="button ghost dark" onClick={onPause}>
            <Icon name="pause" size={17} /> Save & pause
          </button>
        </div>
      </header>
      <div className="session-body">
        <aside className="question-rail" aria-label="Question navigator">
          <div className="rail-label">
            <span>Session map</span>
            <small>{Math.round(progress)}%</small>
          </div>
          <div className="question-dots">
            {session.queue.map((item, index) => {
              const itemResponse = session.responses[item.slotId];
              return (
                <button
                  key={item.slotId}
                  className={`${index === session.cursor ? "current" : ""} ${itemResponse?.committed ? "done" : ""} ${itemResponse?.flagged ? "flagged" : ""}`}
                  aria-label={[
                    `Question ${index + 1}`,
                    index === session.cursor ? "current" : "",
                    itemResponse?.committed ? "answered" : "",
                    itemResponse?.flagged ? "flagged" : "",
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  aria-current={index === session.cursor ? "step" : undefined}
                  disabled={index > furthestReachable}
                  onClick={() => {
                    dispatch({ type: "JUMP_TO", index });
                    window.setTimeout(
                      () =>
                        document
                          .querySelector<HTMLElement>("#question-heading")
                          ?.focus(),
                      0,
                    );
                  }}
                >
                  <span>
                    {itemResponse?.committed ? (
                      <Icon name="check" size={13} />
                    ) : (
                      index + 1
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="rail-legend">
            <span>
              <i className="current" />
              Current
            </span>
            <span>
              <i className="done" />
              Complete
            </span>
            <span>
              <i className="flagged" />
              Flagged
            </span>
          </div>
          {session.templateId === "clinical-mastery" ? (
            <div className="ladder-mini">
              <p className="eyebrow">Reasoning sequence</p>
              {["Source recall", "Mechanism", "Decision"].map(
                (label, index) => (
                  <div
                    className={clinicalRung >= index + 1 ? "active" : ""}
                    key={label}
                  >
                    <span>{index + 1}</span>
                    <strong>{label}</strong>
                  </div>
                ),
              )}
            </div>
          ) : null}
        </aside>
        <section className="question-canvas" aria-labelledby="question-heading">
          <div className="question-meta">
            <div>
              <TruthPill tone={subject?.tint}>{subject?.name}</TruthPill>
              <span>{drill?.name}</span>
              <span>{question.id}</span>
            </div>
            <button
              className={`favorite-star ${isFavorite ? "active" : ""}`}
              onClick={() =>
                dispatch({ type: "TOGGLE_FAVORITE", questionId: question.id })
              }
              aria-pressed={isFavorite}
              aria-label={
                isFavorite ? "Remove from favorites" : "Add to favorites"
              }
            >
              <Icon name="star" size={19} />
            </button>
          </div>
          {session.templateId === "adaptive" ? (
            <div className="why-selected">
              <Icon name="route" />
              <div>
                <strong>Why this item?</strong>
                <p>{slot.reason}</p>
              </div>
              <TruthPill tone="violet">Simulated rule</TruthPill>
            </div>
          ) : null}
          <p className="question-kicker">
            {quick
              ? "Say or think your answer before revealing"
              : session.templateId === "clinical-mastery"
                ? `Stage ${clinicalRung} · ${["Source recall", "Mechanism", "Decision"][clinicalRung - 1]}`
                : "Choose the best answer, then set confidence"}
          </p>
          <h1 id="question-heading" tabIndex={-1}>
            {question.prompt}
          </h1>
          <p className="question-stem">{question.stem}</p>
          {quick ? (
            <div className="recall-surface">
              <div className="recall-visual">
                <span className="pulse-ring">
                  <i />
                </span>
                <div>
                  <strong>Open recall</strong>
                  <small>No microphone or server grading</small>
                </div>
              </div>
              {!quickReveal && !committed ? (
                <button className="button primary" onClick={setQuickReveal}>
                  Reveal source answer
                </button>
              ) : null}
              {revealed ? (
                <div className="quick-reveal">
                  <p className="eyebrow">Synthetic source answer</p>
                  <strong>{question.options[question.correctIndex]}</strong>
                  <p>{question.concise}</p>
                  {!committed ? (
                    <div className="self-report">
                      <span>How did that feel?</span>
                      <div>
                        {(
                          [
                            ["knew", "I knew it"],
                            ["partial", "Partial"],
                            ["missed", "Missed it"],
                          ] as const
                        ).map(([outcome, label]) => (
                          <button
                            key={outcome}
                            onClick={() =>
                              dispatch({
                                type: "SELF_REPORT",
                                slotId: slot.slotId,
                                outcome,
                                at: nowIso(),
                              })
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="reported">
                      <Icon name="check" size={16} /> Recorded as{" "}
                      {response?.selfReport}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div
                className="option-list"
                role="radiogroup"
                aria-label="Answer choices"
              >
                {question.options.map((option, index) => {
                  const selected = response?.selectedIndex === index;
                  const show = revealed && committed;
                  const isCorrect = index === question.correctIndex;
                  return (
                    <button
                      key={option}
                      id={`answer-option-${session.cursor}-${index}`}
                      role="radio"
                      aria-checked={selected}
                      tabIndex={
                        selected ||
                        (response?.selectedIndex == null && index === 0)
                          ? 0
                          : -1
                      }
                      disabled={committed}
                      className={`${selected ? "selected" : ""} ${show && isCorrect ? "correct" : ""} ${show && selected && !isCorrect ? "incorrect" : ""}`}
                      onClick={() =>
                        dispatch({
                          type: "SELECT_ANSWER",
                          slotId: slot.slotId,
                          selectedIndex: index,
                        })
                      }
                      onKeyDown={(event) => {
                        if (
                          ![
                            "ArrowDown",
                            "ArrowRight",
                            "ArrowUp",
                            "ArrowLeft",
                            "Home",
                            "End",
                          ].includes(event.key)
                        )
                          return;
                        event.preventDefault();
                        const last = question.options.length - 1;
                        const nextIndex =
                          event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? last
                              : event.key === "ArrowDown" ||
                                  event.key === "ArrowRight"
                                ? (index + 1) % question.options.length
                                : (index - 1 + question.options.length) %
                                  question.options.length;
                        dispatch({
                          type: "SELECT_ANSWER",
                          slotId: slot.slotId,
                          selectedIndex: nextIndex,
                        });
                        document
                          .querySelector<HTMLElement>(
                            `#answer-option-${session.cursor}-${nextIndex}`,
                          )
                          ?.focus();
                      }}
                    >
                      <span className="option-letter">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span>{option}</span>
                      {show && isCorrect ? (
                        <span className="sr-only">
                          Correct synthetic answer.
                        </span>
                      ) : null}
                      {show && selected && !isCorrect ? (
                        <span className="sr-only">
                          Your selected answer did not match the synthetic key.
                        </span>
                      ) : null}
                      {show && isCorrect ? (
                        <i>
                          <Icon name="check" size={16} />
                        </i>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {!committed ? (
                <div className="commit-row">
                  <fieldset>
                    <legend>Confidence before verdict</legend>
                    {(["low", "medium", "high"] as const).map((level) => (
                      <label
                        className={
                          response?.confidence === level ? "selected" : ""
                        }
                        key={level}
                      >
                        <input
                          type="radio"
                          name={`confidence-${slot.slotId}`}
                          checked={response?.confidence === level}
                          onChange={() =>
                            dispatch({
                              type: "SET_CONFIDENCE",
                              slotId: slot.slotId,
                              confidence: level,
                            })
                          }
                        />
                        <span>{level}</span>
                      </label>
                    ))}
                  </fieldset>
                  <button
                    className="button primary"
                    disabled={
                      response?.selectedIndex == null || !response?.confidence
                    }
                    onClick={() =>
                      dispatch({
                        type: "COMMIT_RESPONSE",
                        slotId: slot.slotId,
                        at: nowIso(),
                      })
                    }
                  >
                    Lock answer
                  </button>
                </div>
              ) : null}
              {committed && !revealed ? (
                <div className="commit-confirm">
                  <span>
                    <Icon name="check" />
                  </span>
                  <div>
                    <strong>Answer locked.</strong>
                    <p>
                      Confidence: {response?.confidence}. Feedback has not been
                      opened.
                    </p>
                  </div>
                  <button
                    className="button primary"
                    onClick={() =>
                      dispatch({
                        type: "REVEAL_FEEDBACK",
                        slotId: slot.slotId,
                        at: nowIso(),
                      })
                    }
                  >
                    Open feedback
                  </button>
                </div>
              ) : null}
            </>
          )}
          {revealed && committed ? (
            <section
              className={`feedback-card ${quick ? response?.selfReport : correct ? "correct" : "incorrect"}`}
              aria-live="polite"
            >
              <div className="verdict-row">
                <span>
                  {quick ? (
                    <Icon name="check" />
                  ) : correct ? (
                    <Icon name="check" />
                  ) : (
                    <Icon name="route" />
                  )}
                </span>
                <div>
                  <p className="eyebrow">
                    {quick
                      ? "Self-report captured"
                      : correct
                        ? "Observed answer match"
                        : "Review signal"}
                  </p>
                  <h2>
                    {quick
                      ? `${response?.selfReport ?? "Response"} — keep moving.`
                      : correct
                        ? "That matches the synthetic key."
                        : "Use the explanation to repair the reasoning."}
                  </h2>
                </div>
                <TruthPill>
                  {quick
                    ? "Not server graded"
                    : correct
                      ? "Descriptive outcome"
                      : "Not a mastery claim"}
                </TruthPill>
              </div>
              <div
                className="explanation-tabs"
                role="tablist"
                aria-label="Explanation depth"
              >
                {explanationTabs.map(([id, label], index) => (
                  <button
                    id={`explanation-tab-${id}`}
                    role="tab"
                    aria-selected={explanationTab === id}
                    aria-controls={`explanation-panel-${id}`}
                    tabIndex={explanationTab === id ? 0 : -1}
                    className={explanationTab === id ? "active" : ""}
                    onClick={() => setExplanationTab(id)}
                    onKeyDown={(event) => onExplanationKey(event, index)}
                    key={id}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div
                className="explanation-content"
                id={`explanation-panel-${explanationTab}`}
                role="tabpanel"
                aria-labelledby={`explanation-tab-${explanationTab}`}
                tabIndex={0}
              >
                {explanationTab === "concise" ? (
                  <>
                    <p className="eyebrow">Teaching point</p>
                    <p>{question.concise}</p>
                  </>
                ) : null}
                {explanationTab === "deep" ? (
                  <>
                    <p className="eyebrow">Prototype-authored deep dive</p>
                    <p>{question.deepDive}</p>
                    <div className="clinical-bridge">
                      <Icon name="ladder" />
                      <div>
                        <strong>Transfer prompt</strong>
                        <p>{question.clinicalBridge}</p>
                      </div>
                    </div>
                  </>
                ) : null}
                {explanationTab === "alternatives" ? (
                  <>
                    <p className="eyebrow">
                      Why the other options do not fit this synthetic model
                    </p>
                    <ol>
                      {question.alternatives.map((item, index) => {
                        const optionIndex = question.options
                          .map((_, option) => option)
                          .filter((option) => option !== question.correctIndex)[
                          index
                        ];
                        return (
                          <li key={item}>
                            <span>{String.fromCharCode(65 + optionIndex)}</span>
                            {item}
                          </li>
                        );
                      })}
                    </ol>
                  </>
                ) : null}
              </div>
              <div className="learning-tools">
                <button
                  onClick={(event) => {
                    dispatch({
                      type: "LOG_EVENT",
                      eventType: "REPLAY_REQUESTED",
                      slotId: slot.slotId,
                      at: nowIso(),
                    });
                    openPanel("replay", event.currentTarget);
                  }}
                >
                  <Icon name="replay" />
                  <span>
                    <strong>Replay moment</strong>
                    <small>
                      Simulated placeholder · {question.replay.anchor}
                    </small>
                  </span>
                  <Icon name="chevron" size={16} />
                </button>
                <button
                  onClick={(event) => {
                    dispatch({
                      type: "LOG_EVENT",
                      eventType: "ZOOM_PLACEHOLDER_OPENED",
                      slotId: slot.slotId,
                      at: nowIso(),
                    });
                    openPanel("zoom", event.currentTarget);
                  }}
                >
                  <Icon name="notes" />
                  <span>
                    <strong>Zoom Notes</strong>
                    <small>Disconnected placeholder</small>
                  </span>
                  <Icon name="chevron" size={16} />
                </button>
                <button
                  onClick={(event) => openPanel("note", event.currentTarget)}
                >
                  <Icon name="bookmark" />
                  <span>
                    <strong>Question Note</strong>
                    <small>Browser-local · unencrypted</small>
                  </span>
                  <Icon name="chevron" size={16} />
                </button>
                {session.templateId === "clinical-mastery" ? (
                  <button
                    onClick={(event) =>
                      openPanel("rounds", event.currentTarget)
                    }
                  >
                    <Icon name="route" />
                    <span>
                      <strong>Optional Rounds branch</strong>
                      <small>Bounded synthetic transfer</small>
                    </span>
                    <Icon name="chevron" size={16} />
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}
          <footer className="question-footer">
            <button
              className={`flag-button ${response?.flagged ? "active" : ""}`}
              onClick={() =>
                dispatch({
                  type: "TOGGLE_FLAG",
                  slotId: slot.slotId,
                  at: nowIso(),
                })
              }
            >
              <Icon name="flag" size={17} />
              {response?.flagged ? "Flagged for review" : "Flag for review"}
            </button>
            <span>
              {committed
                ? "Response saved locally"
                : "Commit a response to continue"}
            </span>
            <button
              className="button primary"
              disabled={!committed || !revealed}
              onClick={onNext}
            >
              {session.cursor === session.queue.length - 1
                ? "Finish & debrief"
                : "Next question"}{" "}
              <Icon name="arrow" size={16} />
            </button>
          </footer>
        </section>
        <aside className="context-rail">
          <p className="eyebrow">Context</p>
          <div className="context-block">
            <span>Template</span>
            <strong>{template?.name}</strong>
            <small>{template?.contract}</small>
          </div>
          <div className="context-block">
            <span>Source truth</span>
            <strong>Synthetic occurrence</strong>
            <small>Not Dr. J content · not medically reviewed</small>
          </div>
          <div className="context-block">
            <span>Session scope</span>
            <strong>
              {session.selectionSnapshot.drillIds.length} drill
              {session.selectionSnapshot.drillIds.length === 1
                ? ""
                : "s"} · {session.selectionSnapshot.subjectIds.length} subject
              {session.selectionSnapshot.subjectIds.length === 1 ? "" : "s"}
            </strong>
            <small>
              {session.selectionSnapshot.focus.replaceAll("-", " ")}
            </small>
          </div>
          <div className="context-quote">
            <Icon name="info" />
            <p>
              Observed behavior informs this local debrief. It does not
              establish mastery or readiness.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function DebriefView({
  session,
  headingRef,
  onReview,
  onNextAction,
  onHome,
}: {
  session: StudioSession;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onReview: () => void;
  onNextAction: () => void;
  onHome: () => void;
}) {
  const score = observedSessionScore(session);
  const quick = session.templateId === "quick-review";
  const flags = Object.values(session.responses).filter(
    (r) => r.flagged,
  ).length;
  const replays = session.events.filter(
    (e) => e.type === "REPLAY_REQUESTED",
  ).length;
  const explanations = session.events.filter(
    (e) => e.type === "EXPLANATION_OPENED",
  ).length;
  const confidenceValues = session.queue
    .map((slot) => session.responses[slot.slotId]?.confidence)
    .filter((value): value is "low" | "medium" | "high" => Boolean(value))
    .map((value) => ({ low: 33, medium: 67, high: 100 })[value]);
  const meanConfidence = confidenceValues.length
    ? Math.round(
        confidenceValues.reduce((sum, value) => sum + value, 0) /
          confidenceValues.length,
      )
    : null;
  const highConfidenceMisses = session.queue.filter((slot) => {
    const response = session.responses[slot.slotId];
    const question = questionForSlot(slot);
    return (
      response?.committed &&
      response.confidence === "high" &&
      response.selectedIndex !== null &&
      response.selectedIndex !== question?.correctIndex
    );
  }).length;
  const prediction = simulatedPredictionFixture();
  return (
    <div className="page debrief-page">
      <header className="debrief-hero">
        <TruthPill tone="mint">Session complete</TruthPill>
        <p className="eyebrow">
          {TEMPLATES.find((t) => t.id === session.templateId)?.name}
        </p>
        <h1 ref={headingRef} tabIndex={-1}>
          Good work. Now make it useful.
        </h1>
        <p>
          This debrief separates what happened from what the separate seeded
          fixture displays.
        </p>
        <div className="debrief-rings">
          <Ring
            value={score}
            label={quick ? "self-report index" : "synthetic key match"}
          />
          {meanConfidence === null ? (
            <div className="prediction-mini">
              <TruthPill>Observed</TruthPill>
              <strong>—</strong>
              <span>confidence not captured</span>
              <small>template contract</small>
            </div>
          ) : (
            <Ring
              value={meanConfidence}
              label="confidence display index"
              tone="blue"
            />
          )}
          <div className="prediction-mini">
            <TruthPill tone="violet">Simulated</TruthPill>
            <strong>{prediction.current}</strong>
            <span>
              simulated 95% interval {prediction.lower}–{prediction.upper}
            </span>
            <small>seeded fixture · not based on this session</small>
          </div>
        </div>
        <p className="debrief-formula">
          {quick
            ? "Self-report index: knew 100, partial 50, missed 0; not accuracy or mastery."
            : "Synthetic key match: share of selections matching bundled fixture keys; not medical validation."}
          {meanConfidence === null
            ? ""
            : " Confidence display index: low 33, medium 67, high 100; ordinal presentation, not probability."}
        </p>
      </header>
      <section className="debrief-grid">
        <article className="debrief-panel">
          <p className="eyebrow">What happened</p>
          <h2>Session evidence</h2>
          <div className="metric-grid compact">
            <div>
              <strong>{session.queue.length}</strong>
              <span>Prompts</span>
            </div>
            <div>
              <strong>{flags}</strong>
              <span>Flagged</span>
            </div>
            <div>
              <strong>{replays}</strong>
              <span>Replay requests</span>
            </div>
            <div>
              <strong>{explanations}</strong>
              <span>Layer opens</span>
            </div>
          </div>
          <p className="footnote">
            Replay requests opened placeholders; verified playback remains zero.
          </p>
        </article>
        <article className="debrief-panel">
          <p className="eyebrow">Confidence calibration</p>
          <h2>
            {meanConfidence === null
              ? "Not captured in this template"
              : highConfidenceMisses
                ? `${highConfidenceMisses} high-confidence review signal${highConfidenceMisses === 1 ? "" : "s"}`
                : "No high-confidence miss recorded"}
          </h2>
          <div className="calibration-row">
            <span className="signal-icon">
              <Icon name="target" />
            </span>
            <div>
              <strong>
                {meanConfidence === null
                  ? "Quick Review uses truthful self-report"
                  : "Browser-local confidence evidence"}
              </strong>
              <p>
                {meanConfidence === null
                  ? "Board and Clinical templates capture confidence before feedback."
                  : highConfidenceMisses
                    ? "Revisit the high-confidence miss without the explanation visible."
                    : "No high-confidence mismatch was observed in this completed synthetic session."}
              </p>
            </div>
          </div>
          <button className="text-link" onClick={onReview}>
            Explore analytics <Icon name="arrow" size={16} />
          </button>
        </article>
        <article className="debrief-panel wide">
          <div className="next-action prominent">
            <span>
              <Icon name="route" />
            </span>
            <div>
              <p className="eyebrow">One defensible next action</p>
              <h2>Build an Adaptive preview.</h2>
              <p>
                The deterministic demo rule will rank the bundled synthetic
                review-priority score, then explain every selection.
              </p>
            </div>
            <button className="button primary" onClick={onNextAction}>
              Build next block <Icon name="arrow" size={16} />
            </button>
          </div>
        </article>
      </section>
      <div className="debrief-actions">
        <button className="button ghost" onClick={onHome}>
          Return home
        </button>
        <button className="button secondary" onClick={onReview}>
          Explore analytics
        </button>
      </div>
      <p className="debrief-boundary">
        LOCAL_P4_INTERACTION_CANDIDATE · local synthetic only · not deployed ·
        not production-integrated · not medically or psychometrically validated
      </p>
    </div>
  );
}

function RecoveryState({
  onHome,
  onStart,
}: {
  onHome: () => void;
  onStart: () => void;
}) {
  return (
    <div className="empty-state recovery">
      <span>
        <Icon name="route" size={30} />
      </span>
      <h1>That local session is unavailable.</h1>
      <p>
        It may have been cleared, completed, or created against a different
        synthetic catalog. Nothing was silently relinked.
      </p>
      <div>
        <button className="button ghost" onClick={onHome}>
          Return home
        </button>
        <button className="button primary" onClick={onStart}>
          Build a new session
        </button>
      </div>
    </div>
  );
}

const SidePanel = ReactForwardPanel();
function ReactForwardPanel() {
  return function Panel({
    kind,
    question,
    note,
    replayPlaying,
    setReplayPlaying,
    roundsConsidered,
    onClose,
    onLog,
    onNote,
    onReset,
    ref,
  }: {
    kind: Exclude<PanelKind, null>;
    question: ReturnType<typeof questionForSlot>;
    note: string;
    replayPlaying: boolean;
    setReplayPlaying: (v: boolean) => void;
    roundsConsidered: boolean;
    onClose: () => void;
    onLog: (
      eventType:
        | "EXPLANATION_OPENED"
        | "REPLAY_REQUESTED"
        | "ZOOM_PLACEHOLDER_OPENED",
      detail?: string,
    ) => void;
    onNote: (body: string) => void;
    onReset: () => void;
    ref: React.Ref<HTMLDivElement>;
  }) {
    const [draft, setDraft] = useState(note);
    useEffect(() => setDraft(note), [note, question?.id]);
    const titles = {
      replay: "Replay moment",
      zoom: "Zoom Notes",
      note: "Question Note",
      rounds: "Clinical Rounds branch",
      guide: "Prototype guide",
    };
    return (
      <div
        className="panel-layer"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <aside
          ref={ref}
          className="side-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="panel-title"
        >
          <header>
            <div>
              <p className="eyebrow">Learning Studio</p>
              <h2 id="panel-title">{titles[kind]}</h2>
            </div>
            <button
              className="icon-button"
              onClick={onClose}
              aria-label="Close panel"
            >
              <Icon name="close" />
            </button>
          </header>
          <div className="panel-content">
            {kind === "replay" ? (
              <>
                <div className="simulation-banner compact">
                  <Icon name="replay" />
                  <div>
                    <strong>Simulated replay placeholder</strong>
                    <p>Not a Dr. J recording · no media service connected.</p>
                  </div>
                </div>
                {question?.replay.status === "unavailable" ? (
                  <div className="unavailable-state">
                    <span>
                      <Icon name="replay" />
                    </span>
                    <h3>Replay unavailable</h3>
                    <p>
                      This synthetic occurrence intentionally demonstrates an
                      honest missing-media state.
                    </p>
                    <button className="button secondary" onClick={onClose}>
                      Return to explanation
                    </button>
                  </div>
                ) : (
                  <div className="fake-player">
                    <div className="player-stage">
                      <span className="player-watermark">
                        SYNTHETIC LOCAL MEDIA
                      </span>
                      <div className="waveform">
                        {Array.from({ length: 46 }, (_, i) => (
                          <i
                            key={i}
                            style={{ height: `${18 + ((i * 17) % 52)}%` }}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          setReplayPlaying(!replayPlaying);
                        }}
                        aria-label={
                          replayPlaying
                            ? "Pause simulated replay"
                            : "Play simulated replay"
                        }
                      >
                        <Icon
                          name={replayPlaying ? "pause" : "play"}
                          size={25}
                        />
                      </button>
                    </div>
                    <div className="player-controls">
                      <strong>{question?.replay.anchor}</strong>
                      <div className="player-track">
                        <span className={replayPlaying ? "playing" : ""} />
                      </div>
                      <span>{question?.replay.duration}</span>
                    </div>
                    <p>
                      Anchor and waveform are synthetic presentation fixtures.
                      Opening this panel recorded one placeholder request;
                      play/pause is visual only and never a verified replay
                      open.
                    </p>
                  </div>
                )}
                <div className="boundary-list">
                  <div>
                    <Icon name="close" />
                    <span>Real video identity</span>
                    <strong>Not connected</strong>
                  </div>
                  <div>
                    <Icon name="close" />
                    <span>Source + revision hashes</span>
                    <strong>Not connected</strong>
                  </div>
                  <div>
                    <Icon name="close" />
                    <span>Rights + privacy gate</span>
                    <strong>Not connected</strong>
                  </div>
                </div>
              </>
            ) : null}
            {kind === "zoom" ? (
              <>
                <div className="simulation-banner compact gold">
                  <Icon name="notes" />
                  <div>
                    <strong>Synthetic Notes sidecar — not Zoom data</strong>
                    <p>
                      Read-only fixture · separate from your local Question
                      Note.
                    </p>
                  </div>
                </div>
                <article className="zoom-note-card">
                  <div className="zoom-note-head">
                    <span>ZN</span>
                    <div>
                      <strong>Session sidecar</strong>
                      <small>Synthetic · disconnected</small>
                    </div>
                  </div>
                  <p>{question?.zoomNote}</p>
                  <dl>
                    <div>
                      <dt>Source</dt>
                      <dd>No Zoom workspace connected</dd>
                    </div>
                    <div>
                      <dt>Timestamp</dt>
                      <dd>{question?.replay.anchor ?? "—"} synthetic anchor</dd>
                    </div>
                    <div>
                      <dt>Persistence</dt>
                      <dd>Not stored with learner notes</dd>
                    </div>
                  </dl>
                </article>
                <p className="panel-footnote">
                  Future integration would require a verified source,
                  rights/privacy clearance, revision identity, and an authorized
                  runtime.
                </p>
              </>
            ) : null}
            {kind === "note" ? (
              <>
                <div className="simulation-banner compact">
                  <Icon name="bookmark" />
                  <div>
                    <strong>Local Question Note</strong>
                    <p>
                      Browser-only · not Zoom Notes · not included in analytics.
                    </p>
                  </div>
                </div>
                <label className="panel-note">
                  <span>Note for {question?.id}</span>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Capture your own reasoning…"
                  />
                  <small>
                    {draft.length} characters · local storage is not encrypted ·
                    do not enter patient or sensitive information
                  </small>
                </label>
                <div className="panel-actions">
                  <button className="button ghost" onClick={onClose}>
                    Cancel
                  </button>
                  <button
                    className="button primary"
                    onClick={() => {
                      onNote(draft);
                      onClose();
                    }}
                  >
                    Save local note
                  </button>
                </div>
              </>
            ) : null}
            {kind === "rounds" ? (
              <>
                <div className="simulation-banner compact gold">
                  <Icon name="route" />
                  <div>
                    <strong>Optional bounded Rounds branch</strong>
                    <p>
                      Prototype-authored transfer · not Dr. J teaching · not
                      product canon.
                    </p>
                  </div>
                </div>
                <div className="rounds-path">
                  {[
                    ["01", "Foundation", question?.concise],
                    ["02", "Consequence", question?.clinicalBridge],
                    [
                      "03",
                      "Decision",
                      "Name the minimum additional evidence needed before acting in this fictional model.",
                    ],
                  ].map(([num, title, copy], i) => (
                    <article className={i === 0 ? "active" : ""} key={title}>
                      <span>{num}</span>
                      <div>
                        <strong>{title}</strong>
                        <p>{copy}</p>
                        {i === 0 ? (
                          <button
                            aria-pressed={roundsConsidered}
                            disabled={roundsConsidered}
                            onClick={() => {
                              if (!roundsConsidered)
                                onLog(
                                  "EXPLANATION_OPENED",
                                  "rounds-foundation",
                                );
                            }}
                          >
                            {roundsConsidered
                              ? "Considered locally"
                              : "Mark considered"}
                          </button>
                        ) : (
                          <small>Explore during Founder review</small>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                <button className="button primary full" onClick={onClose}>
                  Return to the main session
                </button>
              </>
            ) : null}
            {kind === "guide" ? (
              <>
                <div className="guide-hero">
                  <span className="brand-mark large">
                    <span>M</span>
                  </span>
                  <p className="eyebrow">I1Q-4000</p>
                  <h3>Flagship Learning Studio P4</h3>
                  <p>
                    A fully interactive local prototype for Founder review—not a
                    production implementation.
                  </p>
                </div>
                <div className="guide-sections">
                  <article>
                    <span>01</span>
                    <div>
                      <strong>Explore four learning contracts</strong>
                      <p>
                        Quick Review, Board Review, Clinical Mastery, and
                        Adaptive share one truthful synthetic catalog.
                      </p>
                    </div>
                  </article>
                  <article>
                    <span>02</span>
                    <div>
                      <strong>Try every continuity path</strong>
                      <p>
                        Favorite an occurrence, add a local note, pause, resume,
                        and inspect the resulting analytics.
                      </p>
                    </div>
                  </article>
                  <article>
                    <span>03</span>
                    <div>
                      <strong>Challenge the boundaries</strong>
                      <p>
                        Replay, Zoom Notes, mastery, and prediction remain
                        explicitly simulated or disconnected.
                      </p>
                    </div>
                  </article>
                </div>
                <div className="guide-truth">
                  <TruthPill tone="local">No external connections</TruthPill>
                  <TruthPill tone="gold">No protected bundled data</TruthPill>
                  <TruthPill tone="violet">No readiness claim</TruthPill>
                </div>
                <button className="button secondary full" onClick={onReset}>
                  Reset local prototype data
                </button>
              </>
            ) : null}
          </div>
        </aside>
      </div>
    );
  };
}
