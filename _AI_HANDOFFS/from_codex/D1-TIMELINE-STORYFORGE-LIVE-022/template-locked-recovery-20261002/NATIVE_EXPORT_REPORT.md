# Actual artifact evidence

Candidate source: 4666e157713c8b8ab016f3fa6cc50dd834778a44. All input applicants in this task's fixtures are synthetic.

## Inspected artifacts

- The authoritative 2025 .key and its golden PNG were opened/inspected. Source .key SHA-256 113d22efb8ca2c00c29d8e57b92c1eb24ff2c66931f7138bbf23daa66dbba706; golden bf48d25b2d46a75c868f98692d480147f8c7d8f234955608a27ca50b3b808836. Native font inspector verified the contract font families/sizes. Reference was never edited or uploaded.
- Actual local exporter generated PNG at 1920x1080 and 2560x1440, one-slide editable PPTX, Letter-landscape PDF and A4-landscape PDF. SVG is the underlying portable artifact captured by the test harness, not an advertised sixth app download format.
- M05 twelve rotations and M09 long institution were visually inspected as actual PNG and as pages rendered from actual PDF bytes. Full nearby labels and institution words survive. PDF is a raster page with paper letterboxing; no vector-PDF claim.
- Earlier tranche M01 PPTX opened in Keynote; its Medical Officer text was selected, changed to a proof phrase, restored, and saved as a separate M01-native-edit-reopen-proof.key. Original export bytes were not overwritten. This proves that earlier tranche native editing, not final-candidate acceptance.
- Reopening that saved .key could not be verified: Open was disabled and repeated native input/capture returned timeout/ScreenCaptureKit errors. No force quit, unrelated-window edit or recovery workaround was used. Native PowerPoint appearance and final Keynote appearance/edit/save/reopen remain UNVERIFIED.
- Independent OOXML inspections establish separate editable text/shapes/groups and one slide for M05/M09; they do not establish installed-font substitution or native visual parity.

## Color and font evidence

The golden contains an embedded Display P3 ICC profile. Pillow ImageCms converted flat legend pixels to sRGB: work #00882B, personal #763F9B, exams #0565C0, hospital #DF6A0F, clinic #F49018, research #DCBE23. Multiple flat arrow-body samples corroborate the colors, with one-code-value raster differences for some categories. Raw P3 channel values must not be compared directly to sRGB export pixels. Full analysis: /Users/brianb/MissionMed_worktrees/timeline-astra6-recovery-20261002/.timeline-recovery-20261002/template-locked/golden-color-profile-analysis.json. No claim of recovered native fill-channel values.

PPTX maps the 1920x1080 scene to 20x11.25 inches (1440x810 points): native object/font sizes are scaled by 0.75, preserving relative geometry. A raw 18px/13.5pt comparison is not alone a font-shrink defect. Browser checks found American Typewriter, Baskerville and Futura available on this Mac. Cross-platform substitution remains an acceptance item.

## Artifact custody

Files and hashes are indexed in ARTIFACT_MANIFEST.json. Current final-matrix-receipt.json distinguishes permitted exports from blocked cases. Files from older permissive gates remain historical evidence and must never be presented as currently accepted. Diagnostic PNG/SVG for blocked cases are explicitly diagnostics, not successful production exports.

The harness captures actual Blob bytes to the local evidence server. This verifies bytes and format generation; it does not prove the user's browser Downloads destination receipt or a File Vault export destination.

## Local browser intake and persistence (2026-10-03UTC)

The source application ran at127.0.0.1:8900/web/index.html with verified built assets and the real repository matrix adapter exposed read-only by the local harness. The actual release build retained its production authentication boundary and correctly refused a local unauthenticated bootstrap; no role bypass was added. The harness CSP prohibits off-origin connections.

Selected hash-bound synthetic-cv.pdf through the browser's real file chooser. The local parser produced9suggestions with provenance and explicitly said no AI service was available. Checked separate profile consent, accepted7high-confidence entries, explicitly confirmed the publication category asResearch, accepted the remaining volunteer entry with year-only precision, and added9events. Builder displayed Ana Popescu, the source school, June2022 graduation, MD, both exams, and all9events. After browser reload, Home reported9events and1of1local Timeline usage; Continue reopened the same name/profile/events and preserved year-only2019–2021/2023 wording. This is a local IndexedDB user-flow pass, not authenticated production/RLS acceptance. Export sendability remains blocked by template/content issues.

## Verified native Keynote edit, save and reopen (2026-10-03 UTC)

REPAIRED CANDIDATE, M09, generated from de83ce9f. Opened the actual editable PPTX through Finder in Keynote. Visually inspected full slide; institution remained three lines and editable event title was present. Entered text editing, replaced IM elective with Native edit proof, then restored IM elective. Saved a separate native Keynote document, closed that document and reopened the saved file through Finder. Reopened title and institution were correct. Original PPTX remained unchanged. No missing-font alert was observed; that is not a cross-platform font guarantee. PowerPoint was not tested.

Native preview was extracted directly from the saved Keynote archive, not reconstructed from the browser. It shows the unresolved placeholder/export-policy issue, so native editability does not confer sendable acceptance.

- [M09 native source PPTX](/Users/brianb/MissionMed_worktrees/timeline-astra6-recovery-20261002/.timeline-recovery-20261002/template-locked/browser-exports/M09-native-source-de83.pptx): SHA256 5ca70aa62442b8e9fe50276e57bde89dd219efe5c9350783fe24531f5f0247c9, 473503 bytes.
- [M09-final-native-edit-proof.key](/Users/brianb/MissionMed_worktrees/timeline-astra6-recovery-20261002/.timeline-recovery-20261002/template-locked/browser-exports/M09-final-native-edit-proof.key): SHA256 6c289edaad90e5f5d0eda3a77baeae6d89697edffece331bb6b0c572eb2d79ff, 1260668 bytes.
- [M09-final-native-preview.jpg](/Users/brianb/MissionMed_worktrees/timeline-astra6-recovery-20261002/.timeline-recovery-20261002/template-locked/browser-exports/M09-final-native-preview.jpg): SHA256 32313055abba27364e0c4cff2f7177cc6a13ae710efafc8e20324789e6580442, 122790 bytes.
