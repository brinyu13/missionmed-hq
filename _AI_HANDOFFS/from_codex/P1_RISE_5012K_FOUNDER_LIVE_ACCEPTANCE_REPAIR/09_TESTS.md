# Tests

- Full Node suite: 225 passed, 0 failed, approximately 8.2 seconds.
- Playwright suite: 18 passed, 0 failed, 47.6 seconds.
- Targeted 5012K suite: 6 passed, 0 failed.
- Direct health readback: build `rise_web_448082ef03f2`, production environment, rights-current true.
- Direct unauthenticated bootstrap: HTTP 401.
- Public `/rise/` without session: HTTP 302 to WordPress login.
- Provider SQL: 34/34 package programs have one Program Director; 1,462 current promoted facts.
- Live browser: Baylor/UTMB overview, leadership, residents, filters, Program File navigation and admin control passed.

An early `node --test` invocation against a Playwright spec used the wrong runner and failed at the runner boundary. It was corrected with the project Playwright command; the full browser suite then passed.
