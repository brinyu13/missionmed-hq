# On-Demand Automatic Completion

Dossier V2 automatic completion is deployed:

`FULL Terra -> DELTA Terra -> critical residue Sol when required`

All continuation jobs retain one root request and one quota charge. Provider-neutral job metadata stores parent/root/stage identity. The worker may claim all configured route providers, not only the primary.

Live proof:

- University of Michigan IM ACGME `1402521187` completed FULL Terra job `1fa7d86a-6e10-47b7-b428-aa5a2f56b445` at score `0.9768`, cost `$0.3429`, and became `DEEP` in the shared live UI.
- Holdout B Terra DELTA `24279372-1171-4003-8225-78dac4c66869` and Sol residue `80bc1208-39fc-4c72-9e15-2666ad9c3f5e` completed truthfully as PARTIAL because a source conflict remained.
- A first-attempt classification defect was caught in job `3930374f-2ea6-4a51-8f17-56dc8df2fbff`; quota was refunded. The fix now requires a genuine prior Dossier V2 matrix before classifying a request as DELTA.

No result was forced to Deep and no Parallel work launched.
