# B1-507 RP-7 Corpus Bake-off Receipt

Status: HARNESS READY; HUMAN CORPUS/REAL PROVIDER RUNS NOT EXECUTED.

The scorer now correctly recognizes B1-506A as binding scoring-semantics authority and marks activation metrics usable only when every passage is human, consented, and carries a consent artifact. It still emits raw metrics only and never invents a cutover verdict.

Local scorer tests pass. No authorized 40-passage, six-accent, three-run human corpus was located or uploaded. Synthetic fixtures are not represented as accent evidence.

RP-7 remains required before provider activation, not before dormant/default-off deployment.
