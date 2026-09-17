# Tests and Browser QA

Automated acceptance:

- focused administrator tests: 3/3 pass;
- full Node suite: 233/233 pass;
- Playwright browser suite: 19/19 pass;
- asset and git-diff integrity checks: pass.

Live authenticated acceptance through `https://missionmedinstitute.com/rise/`:

1. Opened the production administrator student directory.
2. Entered an authorized 360 student's delegated My Programs view.
3. Confirmed 12 canonical programs and student-owned controls disabled.
4. Moved program #1 down; live PATCH returned 200 and order persisted.
5. Moved it back up; live PATCH returned 200 and the original order persisted.
6. Confirmed the final list retained contiguous priorities 1-12.

No student preference was left changed by the acceptance run.

