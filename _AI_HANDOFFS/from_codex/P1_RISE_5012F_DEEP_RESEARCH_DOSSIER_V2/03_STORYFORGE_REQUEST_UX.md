# StoryForge Request UX

The live modal replaces generic confirmation with a dark navy/gold, keyboard-accessible flow. It describes the dossier domains, shows the actual quota meter, explains dedupe/no-charge behavior, and uses student language only.

| Research state | Live CTA/status |
|---|---|
| Basic / pending | Deep Research This Program; uses 1 request |
| Enriched | Complete Deep Research; uses 1 request |
| Stale Deep | Refresh This Program; charged only for meaningful refresh |
| Current Deep | Deep Research Current; no charge |
| Matching active job | Research already underway; no charge |

Post-submit states are Queued, Researching, Processing/Reviewing, Updated, Partial, and Failed/Request Restored. Provider keys, job IDs, review queues, and backend jargon remain admin-only. The quota readback after Holdout B is `2 used / 28 remaining / 0 reserved`.

Desktop and 390x844 mobile browser tests passed with no horizontal overflow. The Fable 5002 lock hash remained `1e1a16aa630449c9e763a04f6f720b51df0afa46822044de165687d7f8758987`.
