import { PERSON_ID, PROGRAM_ID, SUBJECT_ID } from "./research.ts";

/** Local-only ticket-authorized identifiers. Contains no student materials, observations, notes, transcripts, or media. */
export const developmentFixture = {
  fixtureKind: "local-development-identifiers" as const,
  subject: { id: SUBJECT_ID, displayName: "Ezechiel Fenelon" },
  program: { id: PROGRAM_ID, name: "One Brooklyn Health — Brookdale Hospital Medical Center", specialty: "Internal Medicine" },
  person: { id: PERSON_ID, displayName: "Dr. Conrad Fischer" },
};
