# Tests

- Full Node suite: 230 passed, 0 failed.
- Playwright suite: 19 passed, 0 failed.
- Targeted 5012K coverage includes the original Founder defects plus final alias/profile-score/long-evidence regressions.
- Direct health readback: HTTP 200, build `rise_web_8a55c2a73ee5`, production environment, rights-current true.
- Direct unauthenticated bootstrap: HTTP 401.
- Public `/rise/` without session: HTTP 302 to WordPress login.
- Provider SQL: 34/34 package programs have one Program Director; 1,462 current promoted facts.
- Live browser: Baylor/UTMB overview, leadership, residents, filters, Program File navigation and admin control passed.
- Live browser final: deliberate loading skeleton -> 6,139 programs; Application Fit; school-alias control; separate Step 2/COMLEX controls; 390 x 844 reflow; zero console warnings/errors.
- Zero-blast observation: homepage, WordPress login, StoryForge, Arena and LearnDash courses returned HTTP 200.

An early `node --test` invocation against a Playwright spec used the wrong runner and failed at the runner boundary. It was corrected with the project Playwright command; the full browser suite then passed.
