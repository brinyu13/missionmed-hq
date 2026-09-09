/**
 * Deterministic, offline provider for the P1-RISE-5012A live infrastructure
 * canary. It never calls a network service and never manufactures canonical
 * evidence. The returned result is internal-only until an explicitly approved
 * provider produces reviewable research through the normal canonical path.
 */
export function createReplayResearchProvider() {
  return {
    providerKey: "RISE_REPLAY_TEST",
    modelKey: "deterministic-private-replay-v1",
    async execute({ job }) {
      return {
        providerKey: "RISE_REPLAY_TEST",
        modelKey: "deterministic-private-replay-v1",
        replay: true,
        networkUsed: false,
        newSpendUsd: 0,
        publicationState: "INTERNAL_ONLY",
        canonicalPromotion: "NOT_ATTEMPTED",
        programSpecialtyId: job.programSpecialtyId,
        acgmeId: job.acgmeId,
        specialty: job.specialty,
        state: job.state,
        note: "Infrastructure-only replay; no research facts or canonical evidence were generated.",
      };
    },
  };
}
