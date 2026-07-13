// MMC-010 local reality hydration guard.
// This file intentionally performs no network work and owns no credentials.
(function () {
  "use strict";

  const STATUS = Object.freeze({
    VERIFIED: "VERIFIED",
    LIKELY: "LIKELY",
    UNVERIFIED: "UNVERIFIED",
    CONFLICT: "CONFLICT",
    BLOCKED: "BLOCKED"
  });

  const realityGate = Object.freeze({
    version: "MMC-010",
    baseline: "MMC-009",
    mode: "fixture-fallback-with-readiness-guards",
    verdict: "PARTIAL",
    liveDataReviewStatus: "HARD_BLOCKED",
    reason: "Real data replacement is blocked until least-privilege read access, identity joins, mentor assignment, and no-write read paths are verified.",
    productionPayloadsLoaded: false,
    credentialsLoaded: false,
    externalRequestsEnabled: false,
    writesEnabled: false,
    realDataReplacements: 0,
    fixtureFallbackRetained: true
  });

  const domains = Object.freeze({
    studentIdentity: {
      status: STATUS.CONFLICT,
      adapter: "studentIdentity",
      fallback: "approvedDemoStudents",
      reason: "No canonical student key is verified across identity systems.",
      requiredProof: "Deterministic match across at least two approved production sources with no conflict."
    },
    profiles: {
      status: STATUS.UNVERIFIED,
      adapter: "profiles",
      fallback: "approvedDemoProfileCards",
      reason: "Credentialed profile payload shape is not verified for mentor-scoped reads.",
      requiredProof: "Approved mentor-safe profile read contract and field provenance."
    },
    appointments: {
      status: STATUS.LIKELY,
      adapter: "appointments",
      fallback: "approvedDemoMeetings",
      reason: "Read-shaped appointment routes exist, but protected payload and no-hidden-write proof are incomplete.",
      requiredProof: "No-write appointment list projection under approved mentor auth."
    },
    goals: {
      status: STATUS.UNVERIFIED,
      adapter: "goals",
      fallback: "approvedDemoStrategyAndDeadlines",
      reason: "Goal ownership belongs to future MMC-owned objects, not existing systems.",
      requiredProof: "Approved MMC-owned object model and access policy."
    },
    messages: {
      status: STATUS.UNVERIFIED,
      adapter: "messages",
      fallback: "approvedDemoMessageCards",
      reason: "Message route existence is known, but mentor-safe payload reads are not verified.",
      requiredProof: "Read-only message metadata contract with private-field exclusion."
    },
    documentsMetadata: {
      status: STATUS.UNVERIFIED,
      adapter: "documentsMetadata",
      fallback: "approvedDemoSubmittedFiles",
      reason: "File metadata and private object boundaries are not verified for V1.",
      requiredProof: "Metadata-only read contract without private object reads."
    },
    readinessInputs: {
      status: STATUS.UNVERIFIED,
      adapter: "readinessInputs",
      fallback: "approvedDemoReadinessCards",
      reason: "Readiness inputs span duplicated systems and need source precedence.",
      requiredProof: "Field-level provenance and mentor-scoped read policy."
    },
    mentorAuthorization: {
      status: STATUS.BLOCKED,
      adapter: "mentorAuthorization",
      fallback: "approvedDemoMentorContext",
      reason: "Mentor role and mentor-student assignment authority are not verified.",
      requiredProof: "Verified mentor identity plus assignment authority."
    }
  });

  const routeCandidates = Object.freeze({
    wordPressProfile: {
      status: STATUS.LIKELY,
      safeForRuntime: false,
      guard: "requires approved mentor auth and field contract"
    },
    calendarNoSyncEvents: {
      status: STATUS.LIKELY,
      safeForRuntime: false,
      guard: "must use no-sync validation path only"
    },
    schedulerAppointmentList: {
      status: STATUS.LIKELY,
      safeForRuntime: false,
      guard: "must avoid booking, cancel, reschedule, payment, admin, and recording lookup paths"
    },
    coursesAndEnrollment: {
      status: STATUS.UNVERIFIED,
      safeForRuntime: false,
      guard: "payload and role scope not verified"
    },
    transcriptHydration: {
      status: STATUS.BLOCKED,
      safeForRuntime: false,
      guard: "excluded from MMC-010"
    },
    privateObjectReads: {
      status: STATUS.BLOCKED,
      safeForRuntime: false,
      guard: "excluded from MMC-010"
    }
  });

  const hydrationPhases = Object.freeze({
    studentDirectory: {
      phase: 1,
      status: STATUS.BLOCKED,
      fallback: "approvedDemoStudents",
      replacementCount: 0,
      targetFields: Object.freeze(["student list", "program", "session", "specialty", "status", "risk", "last meeting"]),
      blockers: Object.freeze(["least-privilege read access", "canonical student identity", "mentor assignment authority"])
    },
    studentProfile: {
      phase: 2,
      status: STATUS.BLOCKED,
      fallback: "approvedDemoProfileCards",
      replacementCount: 0,
      targetFields: Object.freeze(["identity", "school", "country", "specialty", "scores", "current status", "files metadata", "meeting history", "messages metadata"]),
      blockers: Object.freeze(["protected profile payload", "field provenance", "student identity join"])
    },
    meetingHistory: {
      phase: 3,
      status: STATUS.BLOCKED,
      fallback: "approvedDemoMeetings",
      replacementCount: 0,
      targetFields: Object.freeze(["real meetings", "appointment history", "session metadata"]),
      blockers: Object.freeze(["approved appointment payload", "no-write read proof", "mentor-scoped access"])
    },
    taskLayer: {
      phase: 4,
      status: STATUS.BLOCKED,
      fallback: "approvedDemoActions",
      replacementCount: 0,
      targetFields: Object.freeze(["real tasks", "goals", "deadlines"]),
      blockers: Object.freeze(["approved MMC-owned task store", "assignment enforcement", "write boundary proof"])
    }
  });

  const safeSourceRegistry = Object.freeze({
    approvedDemoFixture: {
      status: STATUS.VERIFIED,
      runtimeAllowed: true,
      decision: "use as fallback"
    },
    readOnlyCredential: {
      status: STATUS.UNVERIFIED,
      runtimeAllowed: false,
      decision: "block protected payload replacement"
    },
    canonicalStudentIdentity: {
      status: STATUS.CONFLICT,
      runtimeAllowed: false,
      decision: "do not match by email, name, or display label"
    },
    mentorAssignmentAuthority: {
      status: STATUS.BLOCKED,
      runtimeAllowed: false,
      decision: "do not expose mentor-scoped production records"
    },
    noWriteScheduleReads: {
      status: STATUS.UNVERIFIED,
      runtimeAllowed: false,
      decision: "do not call schedule/calendar sources at runtime"
    },
    profilePayloads: {
      status: STATUS.UNVERIFIED,
      runtimeAllowed: false,
      decision: "retain approved profile fixtures"
    },
    taskGoalPayloads: {
      status: STATUS.UNVERIFIED,
      runtimeAllowed: false,
      decision: "retain approved action fixtures"
    }
  });

  const strictExclusions = Object.freeze({
    recordingHydration: STATUS.BLOCKED,
    transcriptHydration: STATUS.BLOCKED,
    narrativePipeline: STATUS.BLOCKED,
    drillPipelines: STATUS.BLOCKED,
    privateObjectReads: STATUS.BLOCKED,
    externalWrites: STATUS.BLOCKED
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function addStudentProvenance(student) {
    return Object.assign({}, student, {
      mmcReality: {
        source: "approved-demo-fixture",
        identityStatus: domains.studentIdentity.status,
        profileStatus: domains.profiles.status,
        protectedPayloadLoaded: false,
        hydrationStatus: "fixture-fallback",
        realFieldsHydrated: [],
        liveDataReviewStatus: realityGate.liveDataReviewStatus
      }
    });
  }

  function createAdapter(name, fallbackName) {
    const domain = domains[name];
    return Object.freeze({
      name: domain.adapter,
      status: domain.status,
      fallbackName,
      canUseProtectedPayloads: false,
      canMutateExternalSystems: false,
      explain() {
        return {
          status: domain.status,
          reason: domain.reason,
          requiredProof: domain.requiredProof,
          fallback: domain.fallback
        };
      },
      hydrate(fallbackValue) {
        return clone(fallbackValue);
      }
    });
  }

  function hydrateWithFallback(fallbackValue) {
    return clone(fallbackValue);
  }

  function createRuntime(options) {
    const demoStudents = Array.isArray(options && options.demoStudents) ? options.demoStudents : [];
    const students = demoStudents.map(addStudentProvenance);
    const adapters = Object.freeze({
      studentIdentity: createAdapter("studentIdentity", "approvedDemoStudents"),
      profiles: createAdapter("profiles", "approvedDemoProfileCards"),
      appointments: createAdapter("appointments", "approvedDemoMeetings"),
      goals: createAdapter("goals", "approvedDemoStrategyAndDeadlines"),
      messages: createAdapter("messages", "approvedDemoMessageCards"),
      documentsMetadata: createAdapter("documentsMetadata", "approvedDemoSubmittedFiles"),
      readinessInputs: createAdapter("readinessInputs", "approvedDemoReadinessCards"),
      mentorAuthorization: createAdapter("mentorAuthorization", "approvedDemoMentorContext")
    });

    return Object.freeze({
      status: realityGate.verdict,
      mode: realityGate.mode,
      baseline: realityGate.baseline,
      realityGate,
      domains,
      routeCandidates,
      hydrationPhases,
      safeSourceRegistry,
      strictExclusions,
      adapters,
      hydrateStudents() {
        return this.hydrateDirectory(students);
      },
      hydrateDirectory(fallbackStudents) {
        return hydrateWithFallback(fallbackStudents);
      },
      hydrateProfile(fallbackProfile) {
        return hydrateWithFallback(fallbackProfile);
      },
      hydrateMeetingHistory(fallbackMeetings) {
        return hydrateWithFallback(fallbackMeetings);
      },
      hydrateTaskLayer(fallbackTasks) {
        return hydrateWithFallback(fallbackTasks);
      },
      validationSummary() {
        return {
          verdict: realityGate.verdict,
          mode: realityGate.mode,
          version: realityGate.version,
          liveDataReviewStatus: realityGate.liveDataReviewStatus,
          productionPayloadsLoaded: false,
          externalRequestsEnabled: false,
          writesEnabled: false,
          realDataReplacements: 0,
          fixtureFallbackRetained: true,
          blockedDomains: Object.keys(domains).filter((key) => domains[key].status === STATUS.BLOCKED),
          unverifiedDomains: Object.keys(domains).filter((key) => domains[key].status === STATUS.UNVERIFIED),
          conflictDomains: Object.keys(domains).filter((key) => domains[key].status === STATUS.CONFLICT),
          hydrationPhases: Object.keys(hydrationPhases).reduce((summary, key) => {
            summary[key] = {
              status: hydrationPhases[key].status,
              replacementCount: hydrationPhases[key].replacementCount,
              fallback: hydrationPhases[key].fallback
            };
            return summary;
          }, {})
        };
      }
    });
  }

  window.MMCDataAdapters = Object.freeze({
    STATUS,
    realityGate,
    domains,
    routeCandidates,
    hydrationPhases,
    safeSourceRegistry,
    strictExclusions,
    createRuntime
  });
}());
