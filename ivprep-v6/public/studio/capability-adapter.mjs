// Stable capability boundary for the Founder-facing studio.
// Presentation code consumes this module; provider, session, persistence and
// measurement implementations remain replaceable behind it.

export {
  createLiveInterview,
  endLiveInterview,
  loadIvPrepSession,
} from '../aaa/api-client.mjs';
export { COLLECTIONS, createDefaultQuestionStore } from '../questions/question-store.mjs';
export { AdminStudentLibraryCapability } from '../capabilities/admin-student-library.mjs';
export { InterviewCalendarCapability } from '../capabilities/calendar-context.mjs';
export {
  contextResultFromSessionSpine,
  projectContextResults,
  projectTranscriptMetrics,
} from '../capabilities/context-results.mjs';
export { LiveMockStudioCapability } from '../capabilities/live-mock-studio.mjs';
export { DurableStudioSession } from './durable-session.mjs';
export { InstrumentRack } from './instruments.mjs';
export { LiveInterviewSession } from './live-interview.mjs';
export { createLiveContext } from './live-context-adapter.mjs';
export { buildLongitudinalModel, compareAttempts } from './longitudinal-model.mjs';
export { MetricBus, selectCorrection, statusRail } from './metric-bus.mjs';
