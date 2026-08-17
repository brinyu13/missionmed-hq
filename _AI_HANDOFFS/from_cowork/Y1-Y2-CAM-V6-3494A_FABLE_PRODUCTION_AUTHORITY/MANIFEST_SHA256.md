# Y1-Y2-CAM-V6-3494A — Fable Production Authority Package (Preservation Manifest)

Preserved by: Y1-Y2-CAM-V6-3500-CLAUDE-CODE (temporary Claude Code implementation custody)
Preserved on: 2026-08-17
Worktree: /Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3440
Branch: codex/y1-y2-cam-v6-3440-aaa-unified-production-admin-canary
Worktree HEAD at preservation time: ae17956dba7ac90960dfef4075fce02576d11606

## Why this package exists

Y1-Y2-CAM-V6-3500-CC00 reconnaissance established that the entire Fable
3490 -> 3494A design/architecture/execution lineage existed ONLY inside a
temporary Claude session-mounted output directory, with no copy under version
control anywhere in the MissionMed repositories. That directory also contained
`.fuse_hidden*` artifacts, indicating a live FUSE mount whose contents are not
durable. Loss of that mount would have destroyed the governing product
authority for IV Prep On-Call.

This package is a byte-exact preservation copy. Filenames are unchanged.

## Source of record (no longer depended upon)

/Users/brianb/Library/Application Support/Claude/local-agent-mode-sessions/
  25296480-16fa-4f6f-ac90-c4c64f64d3ba/
  bb3fe89b-13eb-46d4-8255-db55073a42de/
  local_424b27bd-bc7e-441e-82ee-80974806bd9a/outputs/

Every file below was verified byte-identical to its source by SHA-256
comparison at copy time. Implementation from this point forward reads from
this in-repo package, not from the session mount.

## Layout

- `3492_DESIGN_WIRING/`      — design system, component ledger, frontend build
                               contract, Delivery Intelligence wiring contract,
                               avatar stage integration contract, Codex return
                               contract, and the FINAL NORTHSTAR mockup.
- `3494_ARCHITECTURE/`       — production architecture, module cartridge spec,
                               session configuration spec, vision overlay engine
                               spec, avatar provider spec, recording evidence
                               spec, production acceptance matrix, master
                               execution plan.
- `3494A_CONSOLIDATED/`      — consolidated master execution plan (highest
                               execution authority) plus question engine,
                               taxonomy/import map, MVP question import
                               manifest, CV context generator, TimelineBuilder/
                               FileVault adapter, interviewer asset pack, hybrid
                               interview execution, Dr Kelly / Dr Woods asset
                               plan, progression engine.
- `3490_3491_3493_LINEAGE/`  — antecedent showrooms, selections, run notes,
                               implementation map and feature completeness
                               matrix. Retained for provenance and for the
                               Founder selections recorded during 3490/3491.
                               NOT execution authority; 3494A supersedes.

## Authority order in force for Y1-Y2-CAM-V6-3500

1. Current actual repo/runtime state
2. Codex 3483 forensic evidence
3. Fable 3494A consolidated execution authority   (`3494A_CONSOLIDATED/`)
4. Fable 3494 architecture                        (`3494_ARCHITECTURE/`)
5. Fable 3492 design/wiring contracts             (`3492_DESIGN_WIRING/`)
6. Current IV Prep orchestrator authority
7. Historical material                            (`3490_3491_3493_LINEAGE/`)

## Repository tracking note for Codex

`.gitignore` lines 60-63 intentionally restrict `_AI_HANDOFFS/**` to `*.md`
only, to keep handoff trees from carrying secrets or local machine state. The
four HTML design artifacts in this package (3490 showroom, 3491 visual
showroom, 3492 final northstar, 3493 complete northstar) are therefore ignored
by default and were added with `git add -f` as an explicit, scoped exception.

The shared `.gitignore` policy was NOT modified.

Before force-adding, all four HTML files were scanned for credential patterns
(`sk-*`, bearer tokens, JWT `eyJ*`, `*_API_KEY`/`*_API_SECRET` assignments):
zero hits. Their only external reference is `https://fonts.googleapis.com`.

## Known related continuity risk NOT addressed by this commit

`_AI_HANDOFFS/from_codex/Y1-Y2-CAM-V6-3483_CURRENT_STATE.json` is the machine
readable Codex forensic binding record and is ignored by the same `*.md`-only
rule, so it survives only as an untracked working-tree file. It was left
exactly as found, because 3483's own `preserved_non_rapid_qa_state` list
declares that file set as preserved untracked state and CC-00 verified the live
`git status` matches that declaration byte for byte. Changing it would break
that verification. Codex should decide whether to track it.

## SHA-256 manifest (35 files)

```
65ae493aa714d243acb6338af453b8ba42c0d62f4e8f81a749b86407874f4297  3490_3491_3493_LINEAGE/Y1-Y2-CAM-V6-3490_CLAUDE_CODE_BUILD_CONTRACT.md
44136843fcce091c4f5cb61d83543559f0306844eb1225105159e4ce42ccffa7  3490_3491_3493_LINEAGE/Y1-Y2-CAM-V6-3490_CODEX_RETURN_CONTRACT.md
5605ac2f93598ce0b230b2e8921c9ba8bcb73cf30584d26374486bda149947bd  3490_3491_3493_LINEAGE/Y1-Y2-CAM-V6-3490_FABLE_FINAL_PRODUCT_ARCHITECTURE.md
91a8d43ffb8be0bd24f85bd6633172c15c93ede7670798fc75ba20ce6aa861fd  3490_3491_3493_LINEAGE/Y1-Y2-CAM-V6-3490_IVPREP_AAA_SHOWROOM.html
9b68bb7e16b5f44316d7f6859adfbd3ada9c73ac26f9a1752068cb417534e8c9  3490_3491_3493_LINEAGE/Y1-Y2-CAM-V6-3490_SHOWROOM_SELECTIONS.md
ef01799380ee60dd59c0999f2a3e6e8945de212961a26029729232fea006c892  3490_3491_3493_LINEAGE/Y1-Y2-CAM-V6-3491_IVPREP_AAA_VISUAL_SHOWROOM.html
2d549619e887c67547d77a24dbf865a1c633999462d9b56085409cdbc1417fb5  3490_3491_3493_LINEAGE/Y1-Y2-CAM-V6-3491_RUN2_NOTES.md
122991a54bcd97e7c420cc1eb432b0cad1547fb10ea8f133109e08d43602acaf  3490_3491_3493_LINEAGE/Y1-Y2-CAM-V6-3493_CLAUDE_CODE_IMPLEMENTATION_MAP.md
2652093671d8b5baf8ed340a46ee208ae4e2cd534515e9896c39f4b4c6a6a09f  3490_3491_3493_LINEAGE/Y1-Y2-CAM-V6-3493_FEATURE_COMPLETENESS_MATRIX.md
d645b8f4a458648cba2c27f28b65a8d454ce7004c9f040e0a28a780c16160ae9  3490_3491_3493_LINEAGE/Y1-Y2-CAM-V6-3493_IVPREP_COMPLETE_NORTHSTAR.html
30f5ddbba389fb874418d8382a74ad2da4942012b85b82e952f487244aeda6a2  3492_DESIGN_WIRING/Y1-Y2-CAM-V6-3492_AVATAR_STAGE_INTEGRATION_CONTRACT.md
b64d49d3379cf4de39e73215af205fd37a2417bf496a89e4cd9391798ec5f390  3492_DESIGN_WIRING/Y1-Y2-CAM-V6-3492_CLAUDE_CODE_FRONTEND_BUILD_CONTRACT.md
6bfb1bf1b307d6e017b694759e2e88dc21344d9382efa3ed6e8c228fe1e61f2b  3492_DESIGN_WIRING/Y1-Y2-CAM-V6-3492_CODEX_RETURN_CONTRACT.md
6863b310f67c360ec0598a27dcdf06b23ca796790156e0ba82ad9da63935d438  3492_DESIGN_WIRING/Y1-Y2-CAM-V6-3492_DELIVERY_INTELLIGENCE_WIRING_CONTRACT.md
d2a2444caf7c42634692a07b2e69997871d0c8128cfb4c8baafa963bed84e328  3492_DESIGN_WIRING/Y1-Y2-CAM-V6-3492_FINAL_COMPONENT_LEDGER.md
cb3fe7d503f074590b60afb5ad74efdb8cf72d25844f196871d815de31895127  3492_DESIGN_WIRING/Y1-Y2-CAM-V6-3492_FINAL_DESIGN_SYSTEM.md
2b33cb47359a8d86a641a14e270762a0b62dad10ccdbb010a6e0c872e4bdca4a  3492_DESIGN_WIRING/Y1-Y2-CAM-V6-3492_IVPREP_FINAL_NORTHSTAR.html
e95140470a6cd7624cf61a7f2df9d40b7639561dcde82e99a649770e9f0e1d6d  3494A_CONSOLIDATED/Y1-Y2-CAM-V6-3494A_CLAUDE_CODE_MASTER_EXECUTION_PLAN_CONSOLIDATED.md
62173a5d5502dc60a5935752a43e89f390e501e123f50d05f868697e513f9dec  3494A_CONSOLIDATED/Y1-Y2-CAM-V6-3494A_CV_CONTEXT_AND_QUESTION_GENERATOR_SPEC.md
11a5c6d4fb3ecb4fbc1f76949108c5a34f3f8c3f2b32e042f77e5b2240c136f5  3494A_CONSOLIDATED/Y1-Y2-CAM-V6-3494A_DR_KELLY_DR_WOODS_ASSET_PLAN.md
5a34cea648012d05c0fb1f3e1b9f607d3e445832091b754e62ce6c305d04f7e9  3494A_CONSOLIDATED/Y1-Y2-CAM-V6-3494A_HYBRID_INTERVIEW_EXECUTION_SPEC.md
b7823ff8111b60fd2aad62fe13ae52dee028eff73a45100deb99a567f4edb641  3494A_CONSOLIDATED/Y1-Y2-CAM-V6-3494A_INTERVIEWER_ASSET_PACK_SPEC.md
53a25dc49b0083b7069b14dbaf07f4f7528c920f0ee326ac8e34e8f6fac32cec  3494A_CONSOLIDATED/Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md
ea2002b477f9afbe3593fe433042e5e06d6d51a524cce0b888ee2171286f7539  3494A_CONSOLIDATED/Y1-Y2-CAM-V6-3494A_PROGRESSION_ENGINE_SPEC.md
48a11346c2b0556dc76947888dffef72daa02a9f4ca4a8e5c9f8001dd3e7edd7  3494A_CONSOLIDATED/Y1-Y2-CAM-V6-3494A_QUESTION_ENGINE_SPEC.md
11e2b7b7870f2d2b629cf45b68bbed9c862a6a292c472849a691d85b49266e72  3494A_CONSOLIDATED/Y1-Y2-CAM-V6-3494A_QUESTION_TAXONOMY_AND_IMPORT_MAP.md
7ee0c81f24748e23055788e1e0b386f549e398c5b941685845a8cb05184c1189  3494A_CONSOLIDATED/Y1-Y2-CAM-V6-3494A_TIMELINEBUILDER_FILEVAULT_ADAPTER_SPEC.md
2e74adbade8e752b611a2353cfd4ecdc49046cd210892d6edc50217a71d3ca70  3494_ARCHITECTURE/Y1-Y2-CAM-V6-3494_AVATAR_PROVIDER_SPEC.md
e550660dd6e6f5325ae7aa31bf942208cc8c9dd185eea63cc9fa00bbc0cf51e4  3494_ARCHITECTURE/Y1-Y2-CAM-V6-3494_CLAUDE_CODE_MASTER_EXECUTION_PLAN.md
54669803a1bd3a3e372192b496426d64515d489c002211984ffbb627557ccaab  3494_ARCHITECTURE/Y1-Y2-CAM-V6-3494_MODULE_CARTRIDGE_SPEC.md
669c6211ef1aeced97e1c61fadd4ec562fe86f760b039ef3ab3ebd342b014578  3494_ARCHITECTURE/Y1-Y2-CAM-V6-3494_PRODUCTION_ACCEPTANCE_MATRIX.md
cca0e82f066c456f0e290580454cd0fe304d0eca98f2867d9541f1a6223d7d53  3494_ARCHITECTURE/Y1-Y2-CAM-V6-3494_PRODUCTION_ARCHITECTURE.md
c1b9be71366b203e275d588c76ea39ee7d0cdcb0a78b5411665789986018f28a  3494_ARCHITECTURE/Y1-Y2-CAM-V6-3494_RECORDING_EVIDENCE_SPEC.md
3495d711d4965a0b84325b3cd77287723bf5742e4507d3c02eea725db155076c  3494_ARCHITECTURE/Y1-Y2-CAM-V6-3494_SESSION_CONFIGURATION_SPEC.md
0bf7f6fa9d7c8d62439821318b39d660037afdee1f3838b74adc062e4edb2646  3494_ARCHITECTURE/Y1-Y2-CAM-V6-3494_VISION_OVERLAY_ENGINE_SPEC.md
```
