# Y1-Y2-CAM-V6-3494A — INTERVIEWER ASSET PACK SPEC

## 1. Pack contract (interviewer-agnostic; nothing hardwired to Kelly)

```ts
interface InterviewerAssetPack {
  interviewer_id: 'dr_kelly'|'dr_woods'|...;
  displayName; presentation; version;
  assets: {
    session_open?: MediaAsset; session_close?: MediaAsset;
    questions: { [question_id]: QuestionVideo };     // per-question prerecorded ask
    listening: { neutral?: Loop; attentive_nod?: Loop; slight_smile?: Loop; thoughtful?: Loop };
    acknowledgments: { positive?: MediaAsset; neutral?: MediaAsset };
    transitions: { next_question?: MediaAsset; followup_handoff?: MediaAsset };
  };
  fallback: 'voice_only'|'still_frame';              // pack-level degrade
}
interface QuestionVideo { question_id; interviewer_id; video_asset; audio_asset; durationSec; version; transcript; }
```

Laws: the QUESTION stays canonical — a video is one embodiment of it (question edits/revisions invalidate asset status to `planned`, never mutate the question). Not every reaction is required at launch: missing asset classes degrade per-pack (neutral loop → still frame → voice-only) without breaking the session. Packs load lazily by manifest; per-asset versioning; drawer/loadout show 🎬 availability from `Question.assets`.

## 2. Registry

`InterviewerPackRegistry.register(pack)` / `.get(id)` / `.assetFor(interviewerId, questionId)`. Hybrid engine and stage query the registry only. Adding Dr Woods (or any future pack) = register a pack; zero engine changes.

## 3. Storage/delivery

CDN-addressed media refs; preload next question's ask-video + one listening loop during current answer; hard budget: never block session start on full pack download.
