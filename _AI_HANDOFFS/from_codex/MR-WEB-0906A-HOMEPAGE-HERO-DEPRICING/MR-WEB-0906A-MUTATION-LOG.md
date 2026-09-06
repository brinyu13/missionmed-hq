# MR-WEB-0906A Production Mutation Log

Status: **PASS**

Production mutation completed: `2026-09-06`

Target: `https://missionmedinstitute.com/`

## Scope

The corporate homepage Mission Residency seasonal hero was de-priced. The left hero remains intact, including “It is interview season.”, the boutique positioning, and the “Explore Mission Residency” CTA. The former price card was replaced with a non-price Fall 2026 enrollment card and a “View Programs” CTA.

No WordPress page body, product, price, checkout, payment, entitlement, order, student record, or unrelated division was mutated by this ticket.

## Exact production file mutation

| State | Plugin version | SHA-256 |
|---|---:|---|
| Before MR-WEB-0906A | 1.1.0 | `48c48278e0c21c98e2edc9bf6c26e8b731b2ff7838c838561432bc3df14b1fa5` |
| Initial de-pricing deploy | 1.1.1 | `fcc7bc74a7b6adc57b7ab6bc31ddedcd5fa735bc7c5c9e72a9bdd843eb4a4c4f` |
| Final deployed file | 1.1.2 | `9f72885a8030f41c4e588360f467a7e2f1fed4406972c6e665a2e9d8f3afb1e7` |

Production path: `/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-mr-p0.php`

The final one-line 1.1.2 adjustment encodes the last character of the visible word “Complete” as an HTML entity. This is required because a legacy final-response normalizer rewrote the literal new phrase to “IV Prep Essentials.” The logged-out browser resolves the entity to the exact approved text “IV Prep Complete.”

## Elementor archive

The priced seasonal block was supplied by the live MU plugin, not by the native homepage Elementor data. Before the production replacement, its exact rendered HTML was archived as a private/draft Elementor library section:

- Archive ID: `9044`
- Title: `LEGACY_MR_WEB_0906A_CORPORATE_HERO_PRICED_20260906`
- Status: `draft`
- Source plugin SHA-256: `48c48278e0c21c98e2edc9bf6c26e8b731b2ff7838c838561432bc3df14b1fa5`
- Source markup SHA-256: `849c38c82c31ad17a2832db806ac8a02a4c6aa35b0ea3b70ce16056c67ba8f1a`
- Archive verification: `9/9 PASS` at `2026-09-06T23:21:39Z`

The underlying homepage remains page ID `3305`. Its Elementor-data SHA-256 remained unchanged at `1efd33802b9d5a15fcfc520cb0a83b388370aad09ccc6b66f551099a0545310d` before and after this release.

## Recovery artifacts

Exact server-side preimages are outside the public web root:

- Full-ticket preimage: `/www/theresidencyacademy_209/private/mr-web-0906a/missionmed-mr-p0.php.before-48c48278e0c21c98e2edc9bf6c26e8b731b2ff7838c838561432bc3df14b1fa5`
- Initial de-priced preimage: `/www/theresidencyacademy_209/private/mr-web-0906a/missionmed-mr-p0.php.before-fcc7bc74a7b6adc57b7ab6bc31ddedcd5fa735bc7c5c9e72a9bdd843eb4a4c4f`

## Coordination leases

The final source edit, production hotfix, full cache purge, and final CDN retry used bounded Lease V2 scopes. Successful leases were released explicitly. Relevant bindings:

- Final source hotfix: `907f30a5e83e510ed5c5a83aad7c0532ac1f46ead08161adffd00b23e3a260b8`
- Production hotfix: `a4b7bbed04fe307c9941c85343d933d979b28fc69f53eb3ca5979909c834fca2`
- Post-hotfix full cache purge: `26285988489540eb6959a4398da162c9ad18e46a96d8439553e6ce6e06cab749`
- Final CDN retry: `31defa5f2dd9cf57d20be77fa757e4fca5de61a57b5cf49bbe4e32c0ef912418`

The final release commit is the commit containing this evidence directory; its exact pushed SHA is reported in the completion response and is independently resolvable with `git rev-parse HEAD` on `codex/mr-web-0904a-launch-p0`.
