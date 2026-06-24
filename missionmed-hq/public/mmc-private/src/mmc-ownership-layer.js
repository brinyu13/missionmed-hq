// MMC-021 ownership layer.
// This module keeps the approved MMC UX while syncing MMC-owned domains through
// the private same-origin persistence route backed by the validated mmc.* schema.
(function () {
  "use strict";

  const PROFILE_PHOTO_STORAGE_KEY = "mmc.profile_photos.local_pilot.v1";
  const DEFAULT_PERSISTENCE_ENDPOINT = "/api/mmc/persistence";

  const STATUS = Object.freeze({
    VERIFIED: "VERIFIED",
    LIKELY: "LIKELY",
    UNVERIFIED: "UNVERIFIED",
    CONFLICT: "CONFLICT",
    BLOCKED: "BLOCKED"
  });

  const ownershipGate = Object.freeze({
    version: "MMC-021",
    launchReadinessVersion: "MMC-MEGARUN-100",
    baseline: "MMC-011 / MMC-016 / MMC-018 / MMC-020A",
    mode: "mmc-schema-persistence",
    verdict: "PERSISTENCE_INTEGRATION_READY",
    productionIntegration: true,
    productionHydration: false,
    externalRequestsEnabled: false,
    externalWritesEnabled: false,
    sameOriginPersistenceEnabled: true,
    localOwnedWritesEnabled: false,
    localStorageEnabled: false,
    localStorageFallbackEnabled: false,
    schemaPersistenceEnabled: true,
    schemaPersistenceTarget: "mmc.*",
    ownsMentorMemory: true,
    ownsCoachingSessions: true,
    ownsGoals: true,
    ownsTasks: true,
    ownsAssignments: true,
    ownsPrivateNotes: true,
    ownsPromises: true,
    ownsSessionArtifacts: true,
    ownsMemorySearch: true,
    ownsStudentTimeline: true,
    ownsReadinessFramework: true,
    ownsRiskFramework: true,
    ownsRelationshipContext: true,
    ownsStudentBriefingEngine: true,
    ownsOpenLoopDetector: true,
    ownsPromiseEngine: true,
    ownsAdviceHistoryEngine: true,
    ownsTimelineSummarizer: true,
    ownsRiskSummaryEngine: true,
    ownsNextBestMoveEngine: true,
    ownsProfilePhotos: true
  });

  const ownershipModel = Object.freeze({
    mentors: {
      status: STATUS.VERIFIED,
      owner: "MMC",
      writes: "mmc.mentors principal projection via private persistence route"
    },
    mentorAssignments: {
      status: STATUS.VERIFIED,
      owner: "MMC",
      writes: "mmc.mentor_assignments for fixture-safe mentor-to-student assignment roster"
    },
    coachingSessions: {
      status: STATUS.VERIFIED,
      owner: "MMC",
      writes: "mmc.coaching_sessions for call prep, live session, and post-session lifecycle"
    },
    goals: {
      status: STATUS.VERIFIED,
      owner: "MMC",
      writes: "mmc.goals for student goals, milestones, progress, and velocity"
    },
    tasks: {
      status: STATUS.VERIFIED,
      owner: "MMC",
      writes: "mmc.action_items for student tasks, mentor tasks, promises, deadlines, and follow-ups"
    },
    mentorMemory: {
      status: STATUS.VERIFIED,
      owner: "MMC",
      writes: "mmc.mentor_memory for personal context, sensitive context, last advice, next move, and timeline"
    },
    privateNotes: {
      status: STATUS.VERIFIED,
      owner: "MMC",
      writes: "mmc.private_notes for mentor-only notes denied to student preview by default"
    },
    sessionArtifacts: {
      status: STATUS.VERIFIED,
      owner: "MMC",
      writes: "mmc.session_artifacts for summary, captured items, visibility decision, and session references"
    },
    memorySearch: {
      status: STATUS.VERIFIED,
      owner: "MMC",
      writes: "local searchable projection across mentor memory, promises, tasks, goals, and sessions"
    },
    studentTimeline: {
      status: STATUS.VERIFIED,
      owner: "MMC",
      writes: "local cross-session journey timeline from MMC-owned records"
    },
    readinessFramework: {
      status: STATUS.VERIFIED,
      owner: "MMC",
      writes: "local readiness score derived only from MMC-owned goals, sessions, memory, and tasks"
    },
    riskFramework: {
      status: STATUS.VERIFIED,
      owner: "MMC",
      writes: "local risk score derived only from MMC-owned follow-through and mentor context"
    },
    studentBriefingEngine: {
      status: STATUS.VERIFIED,
      owner: "MMC",
      writes: "local executive briefing derived from MMC-owned memory, goals, tasks, sessions, promises, and assignments"
    },
    openLoopDetector: {
      status: STATUS.VERIFIED,
      owner: "MMC",
      writes: "local repeated topic, open commitment, and unfinished action projection"
    },
    promiseEngine: {
      status: STATUS.VERIFIED,
      owner: "MMC",
      writes: "local mentor and student promise tracking with overdue state"
    },
    adviceHistoryEngine: {
      status: STATUS.VERIFIED,
      owner: "MMC",
      writes: "local latest, repeated, and not-yet-acted-on advice projection"
    },
    timelineSummarizer: {
      status: STATUS.VERIFIED,
      owner: "MMC",
      writes: "local recent events, milestones, and change summary"
    },
    nextBestMoveEngine: {
      status: STATUS.VERIFIED,
      owner: "MMC",
      writes: "local coaching recommendation from owned open loops, risk, promises, and memory"
    },
    profilePhotos: {
      status: STATUS.VERIFIED,
      owner: "MMC",
      writes: "separate local internal-pilot profile photo data and metadata for mentor/admin review only"
    },
    externalSystems: {
      status: STATUS.BLOCKED,
      owner: "external",
      writes: "never touched by MMC-012"
    }
  });

  const baseState = Object.freeze({
    mentors: Object.freeze([
      Object.freeze({
        id: "mentor-brian",
        displayName: "Brian Biruk",
        role: "Lead Mentor",
        status: "active"
      })
    ]),
    assignments: Object.freeze([
      "amara", "raj", "mei", "diego", "yuki", "fatima",
      "ahmed", "priya", "carlos", "olga", "jin", "sarah"
    ].map((studentId, index) => Object.freeze({
      id: `assignment-${studentId}`,
      mentorId: "mentor-brian",
      studentId,
      status: "active",
      cohort: index < 6 ? "core-advising" : "watch-list",
      source: "mmc-owned-local-assignment",
      createdAt: "2026-06-23"
    }))),
    goals: Object.freeze([
      Object.freeze({ id: "goal-amara-match", studentId: "amara", title: "Match into academic Internal Medicine", milestone: "Two USCE rotations secured before application window", targetDate: "2026-07-06", progress: 58, velocity: "Needs acceleration", readinessInputs: Object.freeze(["USCE 2/4", "statement rewrite", "LOR plan"]) }),
      Object.freeze({ id: "goal-raj-ps", studentId: "raj", title: "Finalize personal statement narrative", milestone: "Opening paragraph reviewed and tightened", targetDate: "2026-06-27", progress: 72, velocity: "On track", readinessInputs: Object.freeze(["draft exists", "needs hook", "review queued"]) }),
      Object.freeze({ id: "goal-mei-interview", studentId: "mei", title: "Stabilize interview performance", milestone: "Run two high-pressure pediatrics mocks", targetDate: "2026-07-01", progress: 44, velocity: "At risk", readinessInputs: Object.freeze(["mock debrief", "answer structure", "confidence rebuild"]) }),
      Object.freeze({ id: "goal-diego-cadence", studentId: "diego", title: "Lock surgery interview cadence", milestone: "Weekly mock cycle approved", targetDate: "2026-06-29", progress: 63, velocity: "Steady", readinessInputs: Object.freeze(["cadence decision", "case bank", "feedback loop"]) })
    ]),
    tasks: Object.freeze([
      Object.freeze({ id: "task-amara-intro", studentId: "amara", owner: "mentor", type: "Promise", title: "Send Mount Sinai IM coordinator introduction", dueLabel: "Overdue", dueAt: "2026-06-22", status: "open", priority: "critical", promiseId: "promise-amara-intro", sourceSessionId: "session-amara-0622" }),
      Object.freeze({ id: "task-raj-ps", studentId: "raj", owner: "mentor", type: "Review", title: "Review personal statement opening paragraph", dueLabel: "Due Today", dueAt: "2026-06-23", status: "open", priority: "high", promiseId: null, sourceSessionId: "session-raj-0620" }),
      Object.freeze({ id: "task-mei-plan", studentId: "mei", owner: "mentor", type: "Follow-up", title: "Check ERAS acceleration plan and mock interview debrief", dueLabel: "Tomorrow", dueAt: "2026-06-24", status: "open", priority: "medium", promiseId: null, sourceSessionId: "session-mei-0618" }),
      Object.freeze({ id: "task-diego-cadence", studentId: "diego", owner: "mentor", type: "Decision", title: "Approve Diego mock interview cadence", dueLabel: "This Week", dueAt: "2026-06-27", status: "open", priority: "medium", promiseId: null, sourceSessionId: "session-diego-0619" }),
      Object.freeze({ id: "task-yuki-notes", studentId: "yuki", owner: "mentor", type: "Admin", title: "Update Yuki session notes before next prep", dueLabel: "Queued", dueAt: "2026-06-28", status: "open", priority: "normal", promiseId: null, sourceSessionId: "session-yuki-0617" }),
      Object.freeze({ id: "task-amara-ps-opening", studentId: "amara", owner: "student", type: "Action", title: "Rewrite personal statement opening by Jun 25", dueLabel: "Student", dueAt: "2026-06-25", status: "open", priority: "high", promiseId: null, sourceSessionId: "session-amara-0622" }),
      Object.freeze({ id: "task-amara-lor", studentId: "amara", owner: "student", type: "Action", title: "Draft LOR request list for three attendings", dueLabel: "Student", dueAt: "2026-06-28", status: "open", priority: "medium", promiseId: null, sourceSessionId: "session-amara-0622" })
    ]),
    promises: Object.freeze([
      Object.freeze({ id: "promise-amara-intro", taskId: "task-amara-intro", studentId: "amara", promisor: "mentor", title: "Send Mount Sinai IM coordinator introduction", madeAt: "2026-06-22", dueLabel: "Overdue", status: "open" }),
      Object.freeze({ id: "promise-amara-framework", taskId: null, studentId: "amara", promisor: "mentor", title: "Share personal statement framework examples", madeAt: "2026-06-15", dueLabel: "Done", status: "complete" }),
      Object.freeze({ id: "promise-amara-cv", taskId: null, studentId: "amara", promisor: "mentor", title: "Review her CV", madeAt: "2026-06-08", dueLabel: "Done", status: "complete" })
    ]),
    memory: Object.freeze([
      Object.freeze({ id: "memory-amara-personal", studentId: "amara", category: "personal", title: "Personal Details", content: "Lagos roots; staying in Brooklyn with cousin; prefers morning calls; responds to structured guidance.", sensitive: false, verified: true, source: "mentor-memory", createdAt: "2026-06-22" }),
      Object.freeze({ id: "memory-amara-family", studentId: "amara", category: "sensitive", title: "Family Context", content: "Father has been unwell. Let her lead if she wants to discuss it. Financial pressure is real, so prioritize free resources.", sensitive: true, verified: true, source: "mentor-memory", createdAt: "2026-06-22" }),
      Object.freeze({ id: "memory-amara-advice", studentId: "amara", category: "last-advice", title: "Last Advice Given", content: "Use warm introductions, rewrite statement with Why / What / So What, and begin LOR requests early.", sensitive: false, verified: true, source: "session", createdAt: "2026-06-22" }),
      Object.freeze({ id: "memory-amara-next", studentId: "amara", category: "next-move", title: "Next Best Coaching Move", content: "Start with a short personal check-in, confirm the coordinator intro, then turn the call into three concrete deadlines.", sensitive: false, verified: true, source: "mentor-memory", createdAt: "2026-06-23" }),
      Object.freeze({ id: "memory-raj-advice", studentId: "raj", category: "next-move", title: "Next Best Coaching Move", content: "Focus his statement on one patient story; he is over-explaining the timeline and underusing emotion.", sensitive: false, verified: true, source: "mentor-memory", createdAt: "2026-06-20" }),
      Object.freeze({ id: "memory-mei-flag", studentId: "mei", category: "sensitive", title: "Confidence Flag", content: "Mei-Ling shuts down when feedback feels abstract. Use examples, then have her repeat the structure out loud.", sensitive: true, verified: true, source: "mentor-memory", createdAt: "2026-06-18" }),
      Object.freeze({ id: "memory-diego-goal", studentId: "diego", category: "coaching", title: "Cadence Preference", content: "Diego does best with recurring drills and clear benchmarks. Avoid changing the plan too often.", sensitive: false, verified: true, source: "mentor-memory", createdAt: "2026-06-19" })
    ]),
    sessions: Object.freeze([
      Object.freeze({ id: "session-amara-0622", studentId: "amara", mentorId: "mentor-brian", status: "complete", startedAt: "2026-06-22T10:00:00", endedAt: "2026-06-22T10:42:00", title: "USCE Strategy Review", summary: "Reviewed USCE outreach plan, personal statement rewrite, and LOR preparation.", privateNotes: "Keep feedback structured; avoid direct criticism on statement.", capturedItemIds: Object.freeze(["task-amara-intro", "task-amara-ps-opening", "task-amara-lor"]), studentVisible: false }),
      Object.freeze({ id: "session-raj-0620", studentId: "raj", mentorId: "mentor-brian", status: "complete", startedAt: "2026-06-20T14:00:00", endedAt: "2026-06-20T14:50:00", title: "Personal Statement Workshop", summary: "Raj needs a stronger opening and less timeline explanation.", privateNotes: "He is close, but the narrative still sounds too procedural.", capturedItemIds: Object.freeze(["task-raj-ps"]), studentVisible: false })
    ]),
    sessionArtifacts: Object.freeze([
      Object.freeze({ id: "artifact-amara-0622-summary", sessionId: "session-amara-0622", studentId: "amara", type: "summary", title: "Post-session summary", visibility: "mentor", createdAt: "2026-06-22" })
    ]),
    activityLog: Object.freeze([
      Object.freeze({ id: "activity-bootstrap", action: "private-alpha-bootstrap", detail: "MMC-owned pilot roster, memory, goals, tasks, and sessions loaded.", createdAt: "2026-06-23T09:00:00.000Z" })
    ]),
    profilePhotos: Object.freeze([])
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function makeState() {
    return clone(baseState);
  }

  function getProfilePhotoStorage() {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function normalizeDate(value) {
    if (!value || value === "TBD") return "TBD";
    return String(value).slice(0, 10);
  }

  function loadProfilePhotos(storageMeta) {
    const storage = getProfilePhotoStorage();
    storageMeta.enabled = Boolean(storage);
    if (!storage) return [];
    try {
      const raw = storage.getItem(PROFILE_PHOTO_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.profilePhotos)) return [];
      storageMeta.loadedFromStorage = true;
      storageMeta.lastSavedAt = parsed.savedAt || null;
      return parsed.profilePhotos;
    } catch (error) {
      storageMeta.error = "Local profile photos could not be loaded; initials fallback retained.";
      return [];
    }
  }

  function saveProfilePhotos(profilePhotos, storageMeta) {
    const storage = getProfilePhotoStorage();
    storageMeta.enabled = Boolean(storage);
    if (!storage) return false;
    try {
      storageMeta.lastSavedAt = new Date().toISOString();
      storage.setItem(PROFILE_PHOTO_STORAGE_KEY, JSON.stringify({
        version: ownershipGate.version,
        savedAt: storageMeta.lastSavedAt,
        profilePhotos
      }));
      storageMeta.error = null;
      return true;
    } catch (error) {
      storageMeta.error = "Local profile photos could not be persisted.";
      return false;
    }
  }

  function deriveSequence(state) {
    const pools = [
      state.tasks,
      state.promises,
      state.memory,
      state.sessions,
      state.sessionArtifacts,
      state.goals,
      state.profilePhotos
    ];
    return pools.flat()
      .map((record) => String(record && record.id || "").match(/-(\d+)$/))
      .filter(Boolean)
      .map((match) => Number(match[1]))
      .reduce((max, value) => Math.max(max, value), 100);
  }

  function clampScore(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  function scoreStatus(score) {
    if (score >= 78) return "Strong";
    if (score >= 58) return "Stable";
    if (score >= 40) return "Needs attention";
    return "At risk";
  }

  function priorityScore(task) {
    const priority = { critical: 4, high: 3, medium: 2, normal: 1 }[task.priority] || 0;
    const status = task.status === "open" ? 10 : 0;
    return status + priority;
  }

  function createRuntime(options) {
    const profilePhotoStorageMeta = {
      enabled: false,
      key: PROFILE_PHOTO_STORAGE_KEY,
      loadedFromStorage: false,
      lastSavedAt: null,
      error: null
    };
    const state = makeState();
    state.profilePhotos = loadProfilePhotos(profilePhotoStorageMeta);
    const demoStudents = Array.isArray(options && options.demoStudents) ? options.demoStudents : [];
    const activeMentorId = String(options && options.activeMentorId || "mentor-brian");
    const persistenceEndpoint = String(options && options.persistenceEndpoint || DEFAULT_PERSISTENCE_ENDPOINT);
    const persistenceMeta = {
      enabled: Boolean(persistenceEndpoint),
      endpoint: persistenceEndpoint,
      mode: "mmc-schema",
      status: "initializing",
      loadedFromSchema: false,
      lastLoadedAt: null,
      lastSavedAt: null,
      lastPersistReason: null,
      lastWriteCount: 0,
      error: null,
      csrfToken: "",
      localStorageFallback: false,
      persistedDomains: [
        "mmc.mentor_memory",
        "mmc.private_notes",
        "mmc.action_items",
        "mmc.goals",
        "mmc.coaching_sessions",
        "mmc.session_artifacts",
        "mmc.open_loops",
        "mmc.intelligence_snapshots"
      ]
    };
    let activeSessionId = null;
    let sequence = deriveSequence(state);
    let pendingPersistence = Promise.resolve({ ok: true, skipped: true });

    function nextId(prefix) {
      sequence += 1;
      return `${prefix}-${sequence}`;
    }

    function nowIso() {
      return new Date().toISOString();
    }

    function today() {
      return nowIso().slice(0, 10);
    }

    function recordActivity(action, detail) {
      state.activityLog.unshift({
        id: nextId("activity"),
        action,
        detail: typeof detail === "string" ? detail : JSON.stringify(detail || {}),
        createdAt: nowIso()
      });
      state.activityLog = state.activityLog.slice(0, 60);
    }

    function latestRecoverableSession(studentId) {
      const recoverable = state.sessions
        .filter((session) => session.status === "active" || session.status === "post-session")
        .filter((session) => !studentId || session.studentId === studentId)
        .sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || "")));
      return recoverable[0] || null;
    }

    function recoverLatestSession(studentId) {
      const session = latestRecoverableSession(studentId) || latestRecoverableSession();
      if (!session) return null;
      activeSessionId = session.id;
      recordActivity("session-recovered", { sessionId: session.id, studentId: session.studentId });
      return session;
    }

    function applyPersistedState(persistedState) {
      if (!persistedState || typeof persistedState !== "object") return false;
      let applied = false;
      for (const key of ["goals", "tasks", "promises", "memory", "sessions", "sessionArtifacts"]) {
        if (Array.isArray(persistedState[key]) && persistedState[key].length) {
          state[key] = clone(persistedState[key]);
          applied = true;
        }
      }
      sequence = deriveSequence(state);
      const recoverableSession = latestRecoverableSession();
      if (recoverableSession) activeSessionId = recoverableSession.id;
      return applied;
    }

    function persistenceFetchOptions(method, body) {
      const headers = { Accept: "application/json" };
      if (body) headers["Content-Type"] = "application/json";
      if (persistenceMeta.csrfToken) headers["X-MMHQ-CSRF"] = persistenceMeta.csrfToken;
      return {
        method,
        credentials: "same-origin",
        headers,
        body: body ? JSON.stringify(body) : undefined
      };
    }

    async function hydratePersistence() {
      if (!persistenceEndpoint || typeof fetch !== "function") {
        persistenceMeta.status = "unavailable";
        persistenceMeta.error = "MMC schema persistence fetch is unavailable; fixture memory retained.";
        return false;
      }
      try {
        const response = await fetch(persistenceEndpoint, persistenceFetchOptions("GET"));
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload || payload.ok === false) {
          persistenceMeta.status = "unavailable";
          persistenceMeta.error = payload && payload.message ? payload.message : "MMC schema persistence is unavailable; fixture memory retained.";
          persistenceMeta.localStorageFallback = false;
          return false;
        }
        persistenceMeta.status = "connected";
        persistenceMeta.loadedFromSchema = applyPersistedState(payload.state);
        persistenceMeta.lastLoadedAt = new Date().toISOString();
        persistenceMeta.csrfToken = payload.csrfToken || persistenceMeta.csrfToken;
        persistenceMeta.persistedDomains = Array.isArray(payload.persistedDomains) ? payload.persistedDomains : persistenceMeta.persistedDomains;
        persistenceMeta.error = null;
        return true;
      } catch (error) {
        persistenceMeta.status = "unavailable";
        persistenceMeta.error = "MMC schema persistence could not be loaded; fixture memory retained.";
        persistenceMeta.localStorageFallback = false;
        return false;
      }
    }

    function buildDerivedPersistenceState() {
      const base = clone(state);
      base.students = demoStudents.map((student) => ({
        id: student.id,
        name: student.name,
        initials: student.initials
      }));
      base.openLoops = getAssignedStudentIds().flatMap((studentId) =>
        getOpenLoops(studentId).map((loop) => ({
          id: `loop-${studentId}-${loop.id}`,
          studentId,
          title: loop.title,
          type: loop.type,
          status: loop.status,
          severity: loop.severity,
          detail: loop.detail
        }))
      );
      base.intelligenceSnapshots = getAssignedStudentIds().map((studentId) => ({
        id: `snapshot-${studentId}-student-briefing`,
        studentId,
        snapshotType: "student_briefing",
        summary: getStudentBriefing(studentId),
        confidenceScore: 1
      }));
      return base;
    }

    function persistState(reason) {
      persistenceMeta.lastPersistReason = reason || "schema-write";
      if (!persistenceEndpoint || typeof fetch !== "function") {
        persistenceMeta.status = "unavailable";
        persistenceMeta.error = "MMC schema persistence fetch is unavailable.";
        return false;
      }

      persistenceMeta.status = "saving";
      pendingPersistence = pendingPersistence
        .catch(() => null)
        .then(async () => {
          try {
            const response = await fetch(persistenceEndpoint, persistenceFetchOptions("POST", {
              reason: persistenceMeta.lastPersistReason,
              state: buildDerivedPersistenceState()
            }));
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload || payload.ok === false) {
              throw new Error(payload && payload.message ? payload.message : "MMC schema persistence save failed.");
            }
            persistenceMeta.status = "connected";
            persistenceMeta.loadedFromSchema = applyPersistedState(payload.state) || persistenceMeta.loadedFromSchema;
            persistenceMeta.lastSavedAt = new Date().toISOString();
            persistenceMeta.lastWriteCount = Number(payload.writeCount || 0);
            persistenceMeta.persistedDomains = Array.isArray(payload.persistedDomains) ? payload.persistedDomains : persistenceMeta.persistedDomains;
            persistenceMeta.error = null;
            return payload;
          } catch (error) {
            persistenceMeta.status = "error";
            persistenceMeta.error = error instanceof Error ? error.message : "MMC schema persistence save failed.";
            return { ok: false, error: persistenceMeta.error };
          }
        });
      return true;
    }

    function flushPersistence() {
      return pendingPersistence;
    }

    function findStudent(studentId) {
      return demoStudents.find((student) => student.id === studentId) || demoStudents[0] || null;
    }

    function getAssignedStudentIds(mentorId = activeMentorId) {
      return state.assignments
        .filter((assignment) => assignment.mentorId === mentorId && assignment.status === "active")
        .map((assignment) => assignment.studentId);
    }

    function getTasks(studentId) {
      return state.tasks
        .filter((task) => !studentId || task.studentId === studentId)
        .slice()
        .sort((a, b) => priorityScore(b) - priorityScore(a));
    }

    function getOpenTasks(studentId) {
      return getTasks(studentId).filter((task) => task.status === "open");
    }

    function getPromises(studentId) {
      return state.promises.filter((promise) => !studentId || promise.studentId === studentId);
    }

    function getMemory(studentId, category) {
      return state.memory.filter((memory) => {
        if (studentId && memory.studentId !== studentId) return false;
        if (category && memory.category !== category) return false;
        return true;
      });
    }

    function getGoals(studentId) {
      return state.goals.filter((goal) => !studentId || goal.studentId === studentId);
    }

    function getSessions(studentId) {
      return state.sessions.filter((session) => !studentId || session.studentId === studentId);
    }

    function getProfilePhoto(studentId) {
      const student = findStudent(studentId);
      const resolvedStudentId = student ? student.id : studentId;
      const photo = state.profilePhotos.find((item) => item.studentId === resolvedStudentId) || null;
      if (photo) return photo;
      return {
        id: `profile-photo-fallback-${resolvedStudentId}`,
        studentId: resolvedStudentId,
        hasPhoto: false,
        dataUrl: null,
        fileName: null,
        mimeType: null,
        size: 0,
        initials: student ? student.initials : "ST",
        source: "local MMC profile photo",
        visibility: "mentor/admin review only for now",
        productionStorage: "future unresolved",
        studentUploadStatus: "future-supported, not enabled publicly",
        status: STATUS.UNVERIFIED,
        updatedAt: null
      };
    }

    function setProfilePhoto(payload) {
      const student = findStudent(payload.studentId);
      const resolvedStudentId = student ? student.id : payload.studentId;
      const dataUrl = String(payload.dataUrl || "");
      if (!resolvedStudentId || !dataUrl.startsWith("data:image/")) return null;
      const existingIndex = state.profilePhotos.findIndex((item) => item.studentId === resolvedStudentId);
      const record = {
        id: existingIndex >= 0 ? state.profilePhotos[existingIndex].id : nextId("profile-photo"),
        studentId: resolvedStudentId,
        hasPhoto: true,
        dataUrl,
        fileName: payload.fileName || "local-profile-photo",
        mimeType: payload.mimeType || "image/*",
        size: Number(payload.size || 0),
        initials: student ? student.initials : "ST",
        source: "local MMC profile photo",
        visibility: "mentor/admin review only for now",
        productionStorage: "future unresolved",
        studentUploadStatus: "future-supported, not enabled publicly",
        status: STATUS.VERIFIED,
        updatedAt: today()
      };
      if (existingIndex >= 0) state.profilePhotos.splice(existingIndex, 1, record);
      else state.profilePhotos.unshift(record);
      saveProfilePhotos(state.profilePhotos, profilePhotoStorageMeta);
      recordActivity("profile-photo-local-save", { studentId: resolvedStudentId, storage: "local-only" });
      return record;
    }

    function getStudentBundle(studentId) {
      const student = findStudent(studentId);
      const resolvedStudentId = student ? student.id : studentId;
      return {
        student,
        assignment: state.assignments.find((assignment) => assignment.studentId === resolvedStudentId) || null,
        goals: getGoals(resolvedStudentId),
        tasks: getTasks(resolvedStudentId),
        openTasks: getOpenTasks(resolvedStudentId),
        promises: getPromises(resolvedStudentId),
        openPromises: getPromises(resolvedStudentId).filter((promise) => promise.status === "open"),
        memory: getMemory(resolvedStudentId),
        personalMemory: getMemory(resolvedStudentId, "personal"),
        sensitiveMemory: getMemory(resolvedStudentId, "sensitive"),
        adviceMemory: getMemory(resolvedStudentId, "last-advice"),
        nextMoves: getMemory(resolvedStudentId, "next-move"),
        sessions: getSessions(resolvedStudentId),
        profilePhoto: getProfilePhoto(resolvedStudentId)
      };
    }

    function getReadiness(studentId) {
      const bundle = getStudentBundle(studentId);
      const student = bundle.student || {};
      const goals = bundle.goals;
      const averageGoalProgress = goals.length
        ? goals.reduce((sum, goal) => sum + Number(goal.progress || 0), 0) / goals.length
        : 35;
      const criticalOpen = bundle.openTasks.filter((task) => task.priority === "critical").length;
      const highOpen = bundle.openTasks.filter((task) => task.priority === "high").length;
      const overdue = bundle.openTasks.filter((task) => task.dueLabel === "Overdue").length;
      const sessions = bundle.sessions.length;
      const memoryDepth = bundle.memory.length;
      const riskPenalty = student.risk === "high" ? 18 : student.risk === "medium" ? 9 : 2;
      const score = clampScore(
        averageGoalProgress +
        Math.min(12, sessions * 3) +
        Math.min(10, memoryDepth * 1.5) -
        criticalOpen * 12 -
        highOpen * 5 -
        overdue * 10 -
        riskPenalty
      );
      const missingInputs = [];
      if (!goals.length) missingInputs.push("primary coaching goal");
      if (!bundle.sessions.length) missingInputs.push("session history");
      if (!bundle.nextMoves.length) missingInputs.push("next best move");
      if (!bundle.personalMemory.length) missingInputs.push("personal context");
      return {
        status: scoreStatus(score),
        score,
        goalProgress: clampScore(averageGoalProgress),
        openActions: bundle.openTasks.length,
        openPromises: bundle.openPromises.length,
        criticalOpen,
        highOpen,
        overdue,
        memoryDepth,
        sessions,
        missingInputs,
        factors: [
          `Goal progress ${clampScore(averageGoalProgress)}%`,
          `${bundle.openTasks.length} open actions`,
          `${bundle.openPromises.length} open promises`,
          `${memoryDepth} memory items`,
          `${sessions} sessions captured`
        ]
      };
    }

    function getRisk(studentId) {
      const bundle = getStudentBundle(studentId);
      const student = bundle.student || {};
      const baseRisk = student.risk === "high" ? 62 : student.risk === "medium" ? 38 : 18;
      const overdue = bundle.openTasks.filter((task) => task.dueLabel === "Overdue").length;
      const criticalOpen = bundle.openTasks.filter((task) => task.priority === "critical").length;
      const highOpen = bundle.openTasks.filter((task) => task.priority === "high").length;
      const sensitiveCount = bundle.sensitiveMemory.length;
      const completePromises = bundle.promises.filter((promise) => promise.status === "complete").length;
      const score = clampScore(
        baseRisk +
        overdue * 14 +
        criticalOpen * 12 +
        highOpen * 6 +
        sensitiveCount * 4 -
        completePromises * 4 -
        Math.min(10, bundle.sessions.length * 2)
      );
      const level = score >= 70 ? "High" : score >= 42 ? "Medium" : "Low";
      const reasons = [];
      if (overdue) reasons.push(`${overdue} overdue commitment${overdue === 1 ? "" : "s"}`);
      if (criticalOpen) reasons.push(`${criticalOpen} critical open action${criticalOpen === 1 ? "" : "s"}`);
      if (highOpen) reasons.push(`${highOpen} high-priority action${highOpen === 1 ? "" : "s"}`);
      if (sensitiveCount) reasons.push(`${sensitiveCount} sensitive context item${sensitiveCount === 1 ? "" : "s"}`);
      if (!reasons.length) reasons.push("No critical MMC-owned follow-through risk");
      return { level, score, reasons, sensitiveCount, overdue, criticalOpen, highOpen };
    }

    function getRelationshipContext(studentId) {
      const bundle = getStudentBundle(studentId);
      const personal = bundle.personalMemory[0];
      const sensitive = bundle.sensitiveMemory[0];
      const nextMove = bundle.nextMoves[0];
      const openLoops = bundle.openTasks.slice(0, 4).map((task) => task.title);
      return {
        trustSignal: bundle.sessions.length >= 2 ? "Established" : bundle.memory.length >= 3 ? "Emerging" : "Needs capture",
        communicationStyle: personal ? personal.content : "Capture preferred communication style during next session.",
        sensitiveContext: sensitive ? sensitive.content : "No sensitive context captured.",
        nextMove: nextMove ? nextMove.content : "Review open goals and actions before the call.",
        openLoops,
        privateNoteCount: getMemory(studentId, "private-note").length
      };
    }

    function getSessionInsights(studentId) {
      const bundle = getStudentBundle(studentId);
      const lastSession = bundle.sessions.slice().sort((a, b) => normalizeDate(b.startedAt).localeCompare(normalizeDate(a.startedAt)))[0] || null;
      const readiness = getReadiness(studentId);
      const risk = getRisk(studentId);
      const relationship = getRelationshipContext(studentId);
      return {
        lastSession,
        readiness,
        risk,
        relationship,
        openLoops: bundle.openTasks.slice(0, 5),
        prepFocus: [
          relationship.nextMove,
          bundle.openPromises[0] ? `Close promise: ${bundle.openPromises[0].title}` : "No open mentor promise captured.",
          readiness.missingInputs.length ? `Capture missing input: ${readiness.missingInputs[0]}` : "Confirm next milestone and deadline."
        ]
      };
    }

    function getStudentTimeline(studentId) {
      const bundle = getStudentBundle(studentId);
      const records = [];
      bundle.sessions.forEach((session) => {
        records.push({
          id: session.id,
          kind: "Session",
          date: normalizeDate(session.startedAt),
          title: session.title,
          detail: session.summary || session.privateNotes || "MMC-owned advising session captured.",
          status: session.status,
          tone: "cyan"
        });
      });
      bundle.tasks.forEach((task) => {
        records.push({
          id: task.id,
          kind: task.owner === "student" ? "Student Task" : "Mentor Task",
          date: normalizeDate(task.dueAt),
          title: task.title,
          detail: `${task.status} · ${task.dueLabel} · ${task.priority}`,
          status: task.status,
          tone: task.status === "complete" ? "green" : task.priority === "critical" ? "red" : "gold"
        });
      });
      bundle.promises.forEach((promise) => {
        records.push({
          id: promise.id,
          kind: "Promise",
          date: normalizeDate(promise.madeAt),
          title: promise.title,
          detail: `${promise.promisor} promise · ${promise.status}`,
          status: promise.status,
          tone: promise.status === "complete" ? "green" : "red"
        });
      });
      bundle.memory.forEach((memory) => {
        records.push({
          id: memory.id,
          kind: memory.sensitive ? "Sensitive Memory" : "Memory",
          date: normalizeDate(memory.createdAt),
          title: memory.title,
          detail: memory.content,
          status: memory.category,
          tone: memory.sensitive ? "red" : "cyan"
        });
      });
      bundle.goals.forEach((goal) => {
        records.push({
          id: goal.id,
          kind: "Goal",
          date: normalizeDate(goal.targetDate),
          title: goal.title,
          detail: `${goal.progress}% · ${goal.velocity}`,
          status: goal.velocity,
          tone: "gold"
        });
      });
      return records.sort((a, b) => b.date.localeCompare(a.date));
    }

    function newestByDate(records, field) {
      return records.slice().sort((a, b) => normalizeDate(b[field]).localeCompare(normalizeDate(a[field])));
    }

    function detectRepeatedTopics(bundle) {
      const topicCatalog = [
        { key: "statement", label: "Personal statement", cue: "story clarity and rewrite follow-through" },
        { key: "lor", label: "LOR collection", cue: "letters and attending outreach" },
        { key: "usce", label: "USCE strategy", cue: "rotation targeting and coordinator outreach" },
        { key: "intro", label: "Warm introduction", cue: "mentor-owned networking promise" },
        { key: "mock", label: "Mock interview cadence", cue: "practice rhythm and debrief loop" },
        { key: "timeline", label: "Application timeline", cue: "dates, milestones, and readiness pacing" },
        { key: "confidence", label: "Confidence and feedback style", cue: "coaching delivery and trust signal" }
      ];
      const textParts = [
        ...bundle.tasks.map((task) => `${task.title} ${task.type} ${task.dueLabel}`),
        ...bundle.promises.map((promise) => `${promise.title} ${promise.dueLabel} ${promise.status}`),
        ...bundle.memory.map((memory) => `${memory.title} ${memory.content} ${memory.category}`),
        ...bundle.sessions.map((session) => `${session.title} ${session.summary || ""} ${session.privateNotes || ""}`),
        ...bundle.goals.map((goal) => `${goal.title} ${goal.milestone} ${goal.velocity} ${(goal.readinessInputs || []).join(" ")}`)
      ].join(" ").toLowerCase();
      return topicCatalog.map((topic) => {
        const occurrences = (textParts.match(new RegExp(topic.key, "gu")) || []).length;
        return {
          id: `topic-${topic.key}`,
          label: topic.label,
          cue: topic.cue,
          occurrences
        };
      }).filter((topic) => topic.occurrences >= 2);
    }

    function dedupeByTitle(items) {
      const seen = new Set();
      return items.filter((item) => {
        const key = String(item.title || item.label || item.id || "").toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function getOpenLoops(studentId) {
      const bundle = getStudentBundle(studentId);
      const promiseLoops = bundle.openPromises.map((promise) => ({
        id: promise.id,
        title: promise.title,
        type: promise.promisor === "student" ? "Student Promise" : "Mentor Promise",
        status: promise.dueLabel,
        severity: promise.dueLabel === "Overdue" ? "critical" : "high",
        detail: `${promise.promisor} promise remains ${promise.status}`
      }));
      const taskLoops = bundle.openTasks.map((task) => ({
        id: task.id,
        title: task.title,
        type: task.owner === "student" ? "Student Action" : task.type,
        status: task.dueLabel,
        severity: task.priority,
        detail: `${task.owner} owned · ${task.status} · ${task.priority}`
      }));
      const topicLoops = detectRepeatedTopics(bundle).map((topic) => ({
        id: topic.id,
        title: topic.label,
        type: "Repeated Topic",
        status: `${topic.occurrences} mentions`,
        severity: topic.occurrences >= 3 ? "high" : "medium",
        detail: topic.cue
      }));
      return dedupeByTitle([...promiseLoops, ...taskLoops, ...topicLoops]).slice(0, 7);
    }

    function getPromiseBriefing(studentId) {
      const bundle = getStudentBundle(studentId);
      const mentorPromises = bundle.promises.filter((promise) => promise.promisor === "mentor");
      const studentCommitments = bundle.openTasks.filter((task) => task.owner === "student").map((task) => ({
        id: task.id,
        title: task.title,
        madeAt: normalizeDate(task.dueAt),
        dueLabel: task.dueLabel,
        status: task.status,
        promisor: "student",
        taskId: task.id
      }));
      const allPromises = [...mentorPromises, ...studentCommitments];
      const open = allPromises.filter((promise) => promise.status === "open");
      const overdue = open.filter((promise) => promise.dueLabel === "Overdue");
      return {
        engine: "Promise Engine",
        status: STATUS.VERIFIED,
        made: allPromises,
        mentorPromises,
        studentCommitments,
        open,
        overdue,
        completed: allPromises.filter((promise) => promise.status === "complete"),
        summary: overdue.length
          ? `${overdue.length} overdue promise needs closure`
          : open.length
            ? `${open.length} open promise or commitment needs tracking`
            : "No open promises captured"
      };
    }

    function getAdviceHistory(studentId) {
      const bundle = getStudentBundle(studentId);
      const adviceRecords = newestByDate(bundle.adviceMemory, "createdAt");
      const latest = adviceRecords[0] || null;
      const repeatedTopics = detectRepeatedTopics(bundle);
      const openTaskText = bundle.openTasks.map((task) => task.title.toLowerCase()).join(" ");
      const notActedUpon = repeatedTopics
        .filter((topic) => openTaskText.includes(topic.key))
        .map((topic) => ({
          id: `advice-open-${topic.id}`,
          title: topic.label,
          detail: topic.cue,
          status: "Open action remains"
        }));
      return {
        engine: "Advice History Engine",
        status: STATUS.VERIFIED,
        latest,
        repeated: repeatedTopics,
        notActedUpon,
        summary: latest ? latest.content : "No advice captured yet"
      };
    }

    function getRelationshipContextEngine(studentId) {
      const relationship = getRelationshipContext(studentId);
      const bundle = getStudentBundle(studentId);
      const personal = bundle.personalMemory[0];
      const sensitive = bundle.sensitiveMemory[0];
      return Object.assign({}, relationship, {
        engine: "Relationship Context Engine",
        status: STATUS.VERIFIED,
        personalContext: personal ? personal.content : "No personal context captured yet.",
        sensitiveTopics: sensitive ? [sensitive.content] : [],
        professionalContext: bundle.goals[0]
          ? `${bundle.goals[0].title}; current milestone: ${bundle.goals[0].milestone}`
          : "No formal MMC-owned professional goal captured yet.",
        relationshipSummary: `${relationship.trustSignal} trust signal · ${relationship.openLoops.length} open loop(s)`
      });
    }

    function getTimelineSummary(studentId) {
      const bundle = getStudentBundle(studentId);
      const timeline = getStudentTimeline(studentId);
      const lastSession = newestByDate(bundle.sessions, "startedAt")[0] || null;
      return {
        engine: "Timeline Summarizer",
        status: STATUS.VERIFIED,
        lastSession,
        recent: timeline.slice(0, 5),
        milestones: bundle.goals.slice(0, 3).map((goal) => ({
          id: goal.id,
          title: goal.milestone,
          date: normalizeDate(goal.targetDate),
          status: goal.velocity,
          detail: `${goal.progress}% progress`
        })),
        summary: lastSession
          ? `${lastSession.title} on ${normalizeDate(lastSession.startedAt)}; ${bundle.openTasks.length} open action(s) remain`
          : `${timeline.length} MMC-owned timeline record(s) available`
      };
    }

    function getRiskSummary(studentId) {
      const risk = getRisk(studentId);
      const readiness = getReadiness(studentId);
      const trend = risk.overdue || risk.criticalOpen ? "Escalating" : readiness.score >= 70 ? "Improving" : "Stable";
      return {
        engine: "Risk Summary Engine",
        status: STATUS.VERIFIED,
        level: risk.level,
        score: risk.score,
        trend,
        severity: risk.score >= 70 ? "High severity" : risk.score >= 42 ? "Moderate severity" : "Low severity",
        reasons: risk.reasons,
        readinessStatus: readiness.status,
        readinessScore: readiness.score,
        summary: `${risk.level} risk · ${trend} · ${risk.reasons.slice(0, 2).join("; ")}`
      };
    }

    function getNextBestMove(studentId) {
      const bundle = getStudentBundle(studentId);
      const promiseBriefing = getPromiseBriefing(studentId);
      const adviceHistory = getAdviceHistory(studentId);
      const riskSummary = getRiskSummary(studentId);
      const nextMove = bundle.nextMoves[0];
      const overduePromise = promiseBriefing.overdue[0];
      const criticalTask = bundle.openTasks.find((task) => task.priority === "critical");
      const highTask = bundle.openTasks.find((task) => task.priority === "high");
      let title = "Open the next coaching loop";
      let action = nextMove ? nextMove.content : "Review goals, promises, and open actions before starting.";
      if (overduePromise) {
        title = "Close the overdue promise first";
        action = `Confirm and complete: ${overduePromise.title}`;
      } else if (criticalTask) {
        title = "Resolve the critical action";
        action = `Move ${criticalTask.title} from open loop to completed follow-through.`;
      } else if (highTask) {
        title = "Tighten the highest-priority action";
        action = `Turn ${highTask.title} into a dated commitment.`;
      }
      return {
        engine: "Next Best Move Engine",
        status: STATUS.VERIFIED,
        title,
        action,
        why: [
          riskSummary.summary,
          adviceHistory.notActedUpon[0] ? `${adviceHistory.notActedUpon[0].title} advice is still open` : "Latest advice has no explicit open follow-through conflict",
          promiseBriefing.summary
        ],
        confidence: bundle.memory.length && bundle.tasks.length ? "High for MMC-owned local context" : "Partial until more MMC-owned memory is captured"
      };
    }

    function getStudentBriefing(studentId) {
      const bundle = getStudentBundle(studentId);
      const student = bundle.student || {};
      const goal = bundle.goals[0] || null;
      const relationship = getRelationshipContextEngine(studentId);
      const profilePhoto = getProfilePhoto(studentId);
      const promiseBriefing = getPromiseBriefing(studentId);
      const adviceHistory = getAdviceHistory(studentId);
      const timelineSummary = getTimelineSummary(studentId);
      const riskSummary = getRiskSummary(studentId);
      const nextBestMove = getNextBestMove(studentId);
      const openLoops = getOpenLoops(studentId);
      const deadlines = bundle.openTasks
        .filter((task) => task.dueAt && task.dueAt !== "TBD")
        .slice(0, 4)
        .map((task) => ({
          id: task.id,
          title: task.title,
          date: normalizeDate(task.dueAt),
          status: task.dueLabel,
          owner: task.owner
        }));
      const lastAdvice = adviceHistory.latest;
      return {
        engine: "Student Briefing Engine",
        status: STATUS.VERIFIED,
        source: "MMC-owned memory, goals, tasks, sessions, notes, promises, timeline, and assignments only",
        profilePhoto,
        studentId: student.id || studentId,
        studentName: student.name || "Student",
        who: `${student.name || "This student"} is a ${student.specialty || "specialty"} applicant from ${student.country || "unknown country"} with ${bundle.openTasks.length} open MMC-owned action(s).`,
        personalContext: relationship.personalContext,
        professionalContext: relationship.professionalContext,
        lastMeeting: timelineSummary.lastSession
          ? `${timelineSummary.lastSession.title} · ${normalizeDate(timelineSummary.lastSession.startedAt)}`
          : student.lastMeeting || "No MMC-owned session captured yet.",
        lastAdvice: lastAdvice ? lastAdvice.content : "No advice captured yet.",
        openLoops,
        promises: promiseBriefing,
        adviceHistory,
        relationship,
        timelineSummary,
        riskSummary,
        nextBestMove,
        deadlines,
        primaryGoal: goal ? goal.title : "No MMC-owned goal captured yet.",
        confidence: "VERIFIED local-only MMC-owned intelligence; no external systems queried"
      };
    }

    function searchMemory(query, studentId) {
      const q = String(query || "").trim().toLowerCase();
      const terms = q.split(/\s+/u).filter(Boolean);
      const assigned = new Set(getAssignedStudentIds());
      const toResult = (record, type, fields) => {
        const student = findStudent(record.studentId);
        const text = fields.join(" ");
        const haystack = `${type} ${student ? student.name : ""} ${text}`.toLowerCase();
        const matches = !terms.length || terms.some((term) => haystack.includes(term));
        if (!matches) return null;
        const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 8 : 0), 0) +
          (record.status === "open" ? 5 : 0) +
          (record.priority === "critical" ? 5 : 0) +
          (record.sensitive ? 2 : 0);
        return {
          id: record.id,
          type,
          studentId: record.studentId,
          studentName: student ? student.name : record.studentId,
          title: fields[0],
          detail: fields.slice(1).filter(Boolean).join(" · "),
          date: normalizeDate(record.createdAt || record.madeAt || record.startedAt || record.dueAt || record.targetDate),
          sensitive: Boolean(record.sensitive),
          assignedToMentor: assigned.has(record.studentId),
          score
        };
      };
      const results = [
        ...state.memory.map((record) => toResult(record, "Memory", [record.title, record.content, record.category])),
        ...state.tasks.map((record) => toResult(record, "Task", [record.title, record.type, record.dueLabel, record.status])),
        ...state.promises.map((record) => toResult(record, "Promise", [record.title, record.dueLabel, record.status])),
        ...state.goals.map((record) => toResult(record, "Goal", [record.title, record.milestone, record.velocity])),
        ...state.sessions.map((record) => toResult(record, "Session", [record.title, record.summary || record.privateNotes, record.status]))
      ].filter(Boolean)
        .filter((record) => !studentId || record.studentId === studentId)
        .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));
      return results.slice(0, 12);
    }

    function getStats() {
      const openTasks = state.tasks.filter((task) => task.status === "open");
      return {
        assignedStudents: getAssignedStudentIds().length,
        openActions: openTasks.length,
        mentorPromises: state.promises.filter((promise) => promise.promisor === "mentor" && promise.status === "open").length,
        documentReviews: openTasks.filter((task) => task.type === "Review").length,
        dueToday: openTasks.filter((task) => task.dueLabel === "Due Today" || task.dueLabel === "Overdue").length,
        memoryItems: state.memory.length,
        goals: state.goals.length,
        activeSessions: state.sessions.filter((session) => session.status === "active" || session.status === "post-session").length
      };
    }

    function hydrateDirectory(students) {
      const assigned = new Set(getAssignedStudentIds());
      return students.map((student) => {
        const bundle = getStudentBundle(student.id);
        return Object.assign({}, student, {
          mmcOwned: {
            assignedToMentor: assigned.has(student.id),
            assignmentStatus: assigned.has(student.id) ? "active" : "unassigned-local",
            openTaskCount: bundle.openTasks.length,
            openPromiseCount: bundle.openPromises.length,
            goalCount: bundle.goals.length,
            memoryCount: bundle.memory.length,
            sessionCount: bundle.sessions.length,
            ownershipSource: "mmc-owned-local"
          }
        });
      });
    }

    function completeTask(taskId, completed) {
      const task = state.tasks.find((item) => item.id === taskId);
      if (!task) return null;
      task.status = completed ? "complete" : "open";
      task.completedAt = completed ? "2026-06-23" : null;
      if (task.promiseId) {
        const promise = state.promises.find((item) => item.id === task.promiseId);
        if (promise) promise.status = completed ? "complete" : "open";
      }
      recordActivity(completed ? "action-completed" : "action-reopened", { taskId: task.id, studentId: task.studentId });
      persistState("task-status");
      return task;
    }

    function createTask(payload) {
      const task = {
        id: nextId("task"),
        studentId: payload.studentId,
        owner: payload.owner || "mentor",
        type: payload.type || "Follow-up",
        title: payload.title || "Captured follow-up",
        dueLabel: payload.dueLabel || "Queued",
        dueAt: payload.dueAt || "TBD",
        status: "open",
        priority: payload.priority || "normal",
        promiseId: payload.promiseId || null,
        sourceSessionId: payload.sourceSessionId || activeSessionId
      };
      state.tasks.unshift(task);
      recordActivity("task-created", { taskId: task.id, studentId: task.studentId, type: task.type });
      persistState("task-create");
      return task;
    }

    function createMemory(payload) {
      const memory = {
        id: nextId("memory"),
        studentId: payload.studentId,
        category: payload.category || "coaching",
        title: payload.title || "Captured Memory",
        content: payload.content || "Captured mentor memory",
        sensitive: Boolean(payload.sensitive),
        verified: true,
        source: payload.source || "manual",
        createdAt: today()
      };
      state.memory.unshift(memory);
      recordActivity("memory-created", { memoryId: memory.id, studentId: memory.studentId, category: memory.category });
      persistState("memory-create");
      return memory;
    }

    function createGoal(payload) {
      const goal = {
        id: nextId("goal"),
        studentId: payload.studentId,
        title: payload.title || "Captured coaching goal",
        milestone: payload.milestone || "Define next milestone with student",
        targetDate: payload.targetDate || "TBD",
        progress: Number(payload.progress || 0),
        velocity: payload.velocity || "Needs mentor definition",
        readinessInputs: Array.isArray(payload.readinessInputs) && payload.readinessInputs.length
          ? payload.readinessInputs
          : ["goal captured in MMC", "milestone pending", "mentor follow-up needed"]
      };
      state.goals.unshift(goal);
      recordActivity("goal-created", { goalId: goal.id, studentId: goal.studentId });
      persistState("goal-create");
      return goal;
    }

    function createPromise(payload) {
      const task = createTask({
        studentId: payload.studentId,
        owner: payload.promisor || "mentor",
        type: "Promise",
        title: payload.title,
        dueLabel: payload.dueLabel || "Queued",
        priority: payload.priority || "high",
        sourceSessionId: payload.sourceSessionId || activeSessionId
      });
      const promise = {
        id: nextId("promise"),
        taskId: task.id,
        studentId: payload.studentId,
        promisor: payload.promisor || "mentor",
        title: payload.title,
        madeAt: today(),
        dueLabel: payload.dueLabel || "Queued",
        status: "open"
      };
      task.promiseId = promise.id;
      state.promises.unshift(promise);
      recordActivity("promise-created", { promiseId: promise.id, studentId: promise.studentId, promisor: promise.promisor });
      persistState("promise-create");
      return { task, promise };
    }

    function quickCapture(payload) {
      const studentId = payload.studentId;
      const type = payload.type || "Note";
      const content = payload.content || "Prototype capture saved";
      if (type === "Action") {
        return { kind: "task", record: createTask({ studentId, type: "Follow-up", title: content, priority: "medium" }) };
      }
      if (type === "Memory") {
        return { kind: "memory", record: createMemory({ studentId, category: "coaching", title: "Quick Memory", content, source: "quick-capture" }) };
      }
      if (type === "Flag") {
        return { kind: "memory", record: createMemory({ studentId, category: "sensitive", title: "Mentor Flag", content, sensitive: true, source: "quick-capture" }) };
      }
      return { kind: "note", record: createMemory({ studentId, category: "private-note", title: "Private Mentor Note", content, sensitive: false, source: "quick-capture" }) };
    }

    function startSession(studentId) {
      const student = findStudent(studentId);
      const resolvedStudentId = student ? student.id : studentId;
      const session = {
        id: nextId("session"),
        studentId: resolvedStudentId,
        mentorId: activeMentorId,
        status: "active",
        startedAt: nowIso(),
        endedAt: null,
        title: "MMC-owned advising session",
        summary: "",
        privateNotes: "",
        capturedItemIds: [],
        studentVisible: false
      };
      state.sessions.unshift(session);
      activeSessionId = session.id;
      recordActivity("session-started", { sessionId: session.id, studentId: session.studentId });
      persistState("session-start");
      return session;
    }

    function getActiveSession() {
      return state.sessions.find((session) => session.id === activeSessionId) || null;
    }

    function addSessionItem(payload) {
      const session = getActiveSession() || startSession(payload.studentId);
      let result;
      if (payload.type === "Promise") {
        result = createPromise({
          studentId: session.studentId,
          title: payload.content || "Captured mentor promise",
          sourceSessionId: session.id
        }).task;
      } else if (payload.type === "Memory" || payload.type === "Flag") {
        result = createMemory({
          studentId: session.studentId,
          category: payload.type === "Flag" ? "sensitive" : "coaching",
          title: payload.type === "Flag" ? "Session Flag" : "Session Memory",
          content: payload.content || "Captured during the live session",
          sensitive: payload.type === "Flag",
          source: "session"
        });
      } else {
        result = createTask({
          studentId: session.studentId,
          owner: payload.owner || "student",
          type: "Action",
          title: payload.content || "Captured session action",
          priority: "medium",
          sourceSessionId: session.id
        });
      }
      session.capturedItemIds.push(result.id);
      recordActivity("session-item-created", { sessionId: session.id, itemId: result.id, type: payload.type || "Action" });
      persistState("session-item");
      return result;
    }

    function endSession(notes) {
      const session = getActiveSession();
      if (!session) return null;
      session.privateNotes = notes || session.privateNotes;
      session.status = "post-session";
      recordActivity("session-ended", { sessionId: session.id, studentId: session.studentId });
      persistState("session-end");
      return session;
    }

    function savePostSession(payload) {
      const session = getActiveSession();
      if (!session) return null;
      session.summary = payload.summary || session.summary;
      if (payload.privateNotes) {
        const privateNote = {
          id: nextId("memory"),
          studentId: session.studentId,
          category: "private-note",
          title: "Post-session private note",
          content: payload.privateNotes,
          sensitive: false,
          verified: true,
          source: "post-session",
          createdAt: today()
        };
        state.memory.unshift(privateNote);
        session.capturedItemIds.push(privateNote.id);
      }
      session.studentVisible = Boolean(payload.studentVisible);
      session.status = "complete";
      session.endedAt = nowIso();
      const artifact = {
        id: nextId("artifact"),
        sessionId: session.id,
        studentId: session.studentId,
        type: "post-session-summary",
        title: "MMC-owned post-session summary",
        visibility: session.studentVisible ? "student-approved" : "mentor",
        createdAt: today()
      };
      state.sessionArtifacts.unshift(artifact);
      activeSessionId = null;
      recordActivity("post-session-saved", { sessionId: session.id, studentId: session.studentId, studentVisible: session.studentVisible });
      persistState("post-session-save");
      return { session, artifact };
    }

    function exportState() {
      return clone(state);
    }

    function exportPilotSnapshot() {
      const snapshot = {
        exportedAt: nowIso(),
        status: "PRIVATE_ALPHA_LAUNCH_READY_CANDIDATE",
        scope: "MMC-owned private alpha data only",
        productionHydration: false,
        externalRequestsEnabled: false,
        localStorageFallbackEnabled: false,
        validation: validationSummary(),
        launchReadiness: getLaunchReadiness(),
        state: exportState()
      };
      recordActivity("pilot-snapshot-exported", { assignedStudents: snapshot.validation.stats.assignedStudents });
      return snapshot;
    }

    function getLaunchReadiness() {
      const stats = getStats();
      const activeSession = getActiveSession();
      const recoverableSession = latestRecoverableSession();
      const blockers = [];
      if (persistenceMeta.status !== "connected") blockers.push("schema persistence is not connected");
      if (persistenceMeta.localStorageFallback) blockers.push("localStorage fallback is enabled");
      if (!stats.assignedStudents) blockers.push("no mentor assignments available");
      if (!stats.memoryItems) blockers.push("no mentor memory available");
      if (!stats.goals) blockers.push("no goals available");
      return {
        status: blockers.length ? "PRIVATE_ALPHA_REVIEW_NEEDED" : "PRIVATE_ALPHA_LAUNCH_READY",
        blockers,
        mentorBootstrapReady: stats.assignedStudents > 0,
        assignmentCount: stats.assignedStudents,
        persistenceStatus: persistenceMeta.status,
        persistenceLastSavedAt: persistenceMeta.lastSavedAt,
        persistenceLastLoadedAt: persistenceMeta.lastLoadedAt,
        persistenceLastWriteCount: persistenceMeta.lastWriteCount,
        localStorageFallbackEnabled: Boolean(persistenceMeta.localStorageFallback),
        sessionRecoveryReady: Boolean(activeSession || recoverableSession),
        activeSession: activeSession || recoverableSession || null,
        exportReady: true,
        stats
      };
    }

    function validationSummary() {
      return {
        status: ownershipGate.verdict,
        version: ownershipGate.version,
        launchReadinessVersion: ownershipGate.launchReadinessVersion,
        mode: ownershipGate.mode,
        productionIntegration: true,
        productionHydration: false,
        externalRequestsEnabled: false,
        externalWritesEnabled: false,
        localOwnedWritesEnabled: false,
        localStorageEnabled: false,
        localStorageFallbackEnabled: false,
        schemaPersistenceEnabled: true,
        persistence: Object.assign({}, persistenceMeta),
        profilePhotoStorage: Object.assign({}, profilePhotoStorageMeta),
        model: ownershipModel,
        stats: getStats(),
        activeSessionId,
        recoverableSession: latestRecoverableSession(),
        launchReadiness: getLaunchReadiness(),
        assignedStudentIds: getAssignedStudentIds(),
        writableDomains: Object.keys(ownershipModel).filter((key) => ownershipModel[key].owner === "MMC"),
        intelligenceDomains: [
          "memorySearch",
          "studentTimeline",
          "readinessFramework",
          "riskFramework",
          "relationshipContext",
          "sessionInsights",
          "Student Briefing Engine",
          "Open Loop Detector",
          "Promise Engine",
          "Advice History Engine",
          "Relationship Context Engine",
          "Timeline Summarizer",
          "Risk Summary Engine",
          "Next Best Move Engine",
          "local MMC profile photo"
        ]
      };
    }

    return Object.freeze({
      status: ownershipGate.verdict,
      mode: ownershipGate.mode,
      gate: ownershipGate,
      model: ownershipModel,
      hydrateDirectory,
      getStats,
      getAssignedStudentIds,
      getStudentBundle,
      getTasks,
      getOpenTasks,
      getGoals,
      getMemory,
      getSessions,
      getActiveSession,
      getProfilePhoto,
      setProfilePhoto,
      getReadiness,
      getRisk,
      getRelationshipContext,
      getRelationshipContextEngine,
      getSessionInsights,
      getStudentTimeline,
      getOpenLoops,
      getPromiseBriefing,
      getAdviceHistory,
      getTimelineSummary,
      getRiskSummary,
      getNextBestMove,
      getStudentBriefing,
      searchMemory,
      completeTask,
      createTask,
      createMemory,
      createGoal,
      createPromise,
      quickCapture,
      startSession,
      addSessionItem,
      endSession,
      savePostSession,
      recoverLatestSession,
      hydratePersistence,
      flushPersistence,
      exportState,
      exportPilotSnapshot,
      getLaunchReadiness,
      validationSummary
    });
  }

  window.MMCOwnershipLayer = Object.freeze({
    STATUS,
    ownershipGate,
    ownershipModel,
    createRuntime
  });
}());
