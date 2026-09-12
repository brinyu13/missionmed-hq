# Application Intelligence Information Architecture

Student flow:

`central search / filters / profile -> canonical current program record -> deterministic application-intelligence projection -> list card and Program File`

The projection is implemented in `rise/src/application-intelligence.mjs`. It consumes canonical fields and approved provider-neutral evidence; it does not maintain frontend program lists. Unknown, not researched, researched-not-found, review-pending, partially verified, and verified states remain distinct.

Main surfaces:

- Find Programs: search, criteria, profile/CV modes, counts, application snapshot cards.
- Program File: application snapshot, requirements, residents, people, fellowships/outcomes, Why This Program.
- Preferences: private per-subject priorities and card-field selection.
- Research: Dossier V2 completion matrix and provider-neutral continuation stages.

The Fable-derived shell and navigation remain intact.
