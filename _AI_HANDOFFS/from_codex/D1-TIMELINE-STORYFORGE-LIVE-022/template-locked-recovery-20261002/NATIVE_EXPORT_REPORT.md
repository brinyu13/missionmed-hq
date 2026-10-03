# Actual native and print inspection — 2026-10-03

Classification: REPAIRED CANDIDATE, not Founder-accepted or deployed.

M01 normal, M02 sparse, M03 dense and M06 overlapping histories: actual exported PPTX files were opened in Apple Keynote. Native slide text, arrows, pennants, profile paper and six-row key were inspected. No missing-font dialog appeared. No empty photo/program/date placeholders were present. Native source slide remains a single 1920×1080-equivalent 16:9 canvas (1440×810 points in Keynote).

Each imported PPTX was saved as a separate native .key file. M03 Medical Officer was edited to an explicit temporary test string, verified in AX, restored to the original wording, saved, closed and reopened. Restored text was verified. M01 and M06 were also closed/reopened and their event labels verified. M02 was opened/inspected/saved; its attempted reopen was not verified and is not counted as successful reopen proof. No original exported PPTX was altered. Four saved native preview.jpg images were extracted from the .key containers for persistent native-render evidence.

M06 initial save selected the prior evidence directory by native Save dialog default. The new uniquely named file was closed and moved without overwrite to this phase's directory; prior sealed files were not changed. Final native proofs now live under native-proofs/.

The actual four Letter PDF files were rendered with Poppler and visually inspected. They preserve the 16:9 composition with letterboxing on the landscape print page. PNGs and SVGs were separately inspected. PDF is raster output; PPTX contains native editable objects. Native PowerPoint was not exercised. These observations do not establish Founder sendability approval.


Final source: 7e5b6314434ee9b86fb7bb2dc0c55ba278d28b07. final-native-parity.json and independent sealed-final-parity.json prove four current PNG/PDF/SVG bytes and PPTX contents(except creation timestamp) equal the iteration2exports inspected natively. This avoids treating regenerated filenames as proof by themselves. Native proof files: /Users/brianb/MissionMed_worktrees/timeline-astra6-recovery-20261002/.timeline-recovery-20261002/founder-decisions-20261003/native-proofs/.

Independent report adds bothLetter/A4 saved PDF inspection and all material native PPTX text/group checks. PDF is raster and is not claimed editable or tagged. Native PowerPoint remains untested. No missing-font dialog was observed in Keynote; this does not prove every external platform has those fonts installed.
