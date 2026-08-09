# Timeline UX Implementation 006 - Human Acceptance Matrix

All 40 controlling gates are PASS. Canonical visual checks 29-32 are based on the clean immutable reference, not the distorted canary.

| # | Human task | Browser/visual/persistence/undo/export proof | Result |
|---:|---|---|---|
| 1 | Recover from normal collision | Last-good canvas stayed visible; bounded overlap guidance | PASS |
| 2 | Avoid internal errors | Live and fresh-browser screens contain no stack/internal failure language | PASS |
| 3 | Preserve last-good canvas | Failed candidate path retains prior board | PASS |
| 4 | Select event arrow | Direct protected hit target selected in live browser | PASS |
| 5 | Move event arrow | Pointer drag committed one geometry/date action | PASS |
| 6 | Resize event geometry | Endpoint resize remained chronological and undoable | PASS |
| 7 | Resize generic object | Eight-handle control path verified | PASS |
| 8 | Lock proportions | Corner resize preserved ratio; reload/undo/export persisted | PASS |
| 9 | Unlock proportions | Freeform width/height resize verified | PASS |
| 10 | Edit text directly | Double-click inline edit survived save/reload | PASS |
| 11 | Group | Shift-selected text plus shape formed durable group | PASS |
| 12 | Ungroup | Children restored with positions preserved | PASS |
| 13 | Multi-select | Modifier selection added/removed objects predictably | PASS |
| 14 | Undo | Visible group/gesture change reversed | PASS |
| 15 | Redo | Reapplied visible change | PASS |
| 16 | Snap/align | Center, edge, and nearby-object guides appeared during drag | PASS |
| 17 | Library click-to-add | Selected tile created centered selected object | PASS |
| 18 | Library drag-to-canvas | Physical cross-frame pointer drag created object at drop | PASS |
| 19 | Upload through UI | Visible upload flow passed prior production acceptance | PASS |
| 20 | Durable media | Cross-device/reload media path passed RC1 recovery | PASS |
| 21 | Move/resize asset | Direct selected asset gestures passed | PASS |
| 22 | Remove asset | Removal passed and persisted | PASS |
| 23 | Replace asset | Replacement path passed and preserved ownership | PASS |
| 24 | Zoom | FIT/100/150 preserved canvas/panel/selection without remount | PASS |
| 25 | Ordinary update | No blank loading replacement | PASS |
| 26 | Read progress language | Human-readable save/progress/recovery copy verified | PASS |
| 27 | Move/resize Color Key | Composition remained attached; move/resize/export passed | PASS |
| 28 | Edit year boundary | Adjacent widths changed live, total preserved, undo/export passed | PASS |
| 29 | Export preview | Canonical visual model unchanged in export surface | PASS |
| 30 | PNG | Opened `canonical-baseline/05_CANONICAL_EXPORT_1920x1080.png`; composition matched | PASS |
| 31 | Letter PDF | Opened/rendered `canonical-baseline/06_CANONICAL_EXPORT_LETTER.pdf`; composition matched with margins | PASS |
| 32 | A4 PDF | Opened/rendered `canonical-baseline/07_CANONICAL_EXPORT_A4.pdf`; composition matched with margins | PASS |
| 33 | CV intake smoke | Existing native upload/extraction/review/pre-fill acceptance remains valid; untouched by UX-006 | PASS |
| 34 | Save/reload | Canonical visual model identical; normalized pixels 0 diff | PASS |
| 35 | Session renewal | Prior sustained live renewal passed; auth seam unchanged | PASS |
| 36 | Matrix return | `/matrix/demo/` local roundtrip and live `/member-dashboard/` target verified | PASS |
| 37 | Student isolation | Existing two-owner RLS and direct API checks remain valid; API unchanged | PASS |
| 38 | Denials | Non-360, revoked, anonymous, and direct-API denial remain valid; current anonymous API 401 | PASS |
| 39 | No unrelated impact | Homepage, StoryForge, and Arena returned HTTP 200 | PASS |
| 40 | Fresh human acceptance | Authenticated Chrome loaded current live asset, administrator context, and zero browser errors | PASS |

Primary evidence:

- `recovery-003/EDITOR_STEER_INTERACTION_INVENTORY.md`
- `recovery-003/editor-ux-004/RC1_EDITOR_UX_004_PRODUCTION_CLOSURE.md`
- `canonical-baseline/CANONICAL_ROUNDTRIP_RECEIPT.json`
- `canonical-baseline/00_EDITOR_TORTURE_FIXTURE_NOT_VISUAL_AUTHORITY.png`
- `TIMELINE_RC1_CANONICAL_BASELINE_006_REPORT.md`
