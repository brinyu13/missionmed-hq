# Identity Resolution

The administrator directory resolves canonical WordPress/Matrix identity using the existing RISE session/profile chain. It does not create a second identity store.

- canonical identity data is preferred when present;
- subject keys remain pseudonymous server identifiers;
- unresolved identities display an honest fallback and may resolve on a later authenticated RISE session;
- no email address or secret claim is embedded in the browser route;
- a delegated token targets exactly one canonical student key.

Live acceptance confirmed one fully resolved authorized 360 student and honest unresolved fallbacks without granting them additional access.

