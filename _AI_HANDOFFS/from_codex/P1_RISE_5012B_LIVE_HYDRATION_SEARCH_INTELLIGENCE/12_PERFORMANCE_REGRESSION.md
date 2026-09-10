# Performance and Regression

- Unit/integration tests: 163/163 PASS.
- Browser suite: 16/16 PASS in 45.2 seconds against a fresh production build.
- Live authenticated search, filters, four Program Files, six tabs, SOAP, My Programs, Student Intel, admin controls, and mobile QA passed.
- Catalog/filter architecture remains the 5011 serving path; the new full-profile payload is fetched only when a Program File opens.
- Current direct health/readback and live browser navigation completed without a material filter/catalog regression.
- Railway error scan found one startup warning that the PostgreSQL source-rights row was not yet seeded; the existing signed file-level source-rights verification passed and live health reports sourceRightsCurrent=true. No request-time application error was found.

Sibling URL checks were bounded observations only: public homepage, WordPress login, StoryForge, and Arena returned 200. Guessed paths returning 404 were not interpreted as product failures.
