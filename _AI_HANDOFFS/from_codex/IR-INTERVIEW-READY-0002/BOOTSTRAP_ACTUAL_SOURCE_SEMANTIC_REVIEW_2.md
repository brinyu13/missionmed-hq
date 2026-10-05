# Independent actual bootstrap source semantic review

Verdict: **NOT YET QUALIFIED for WordPress bootstrap or creation_inventory_read.** Actual static capture succeeded, but its redaction removes specific public call/guard/include identities needed to resolve reachable effects. No harmful effect is established by this review. Do not set bootstrapEffectsQualified or reachableInventoryEffectsQualified true from this artifact.

Independent nonbuilder `/root/phase1_release_verifier`, requested Sol6.1 High. Actual custody HEAD `ce30114fa7a31167399923eadeaf884e6be65f1f`; product source8717 unchanged. Only this new report was written. No provider/SSH/PHP/WP/DB/bootstrap/account/source/helper/control/HEAD action occurred.

## Actual evidence and useful control flow

BOOTSTRAP_STATIC_SOURCE_READBACK_2.json SHA256 `835b9ea5ec7b7a95e8c71588df75f451ce25f8e0a2bdf6e6256141fcf0379ce8` records successful76-role redacted capture at1791162660.0393898, localTransportEnded=true, packet `dbd0edbadabcc4dc9555c26aba7182ba7eb3aef0d445a5fae7fb7dc3c5508128`, and noSemanticApproval=true. Its reader7571/tests53e1/handoffcd48/program779f/privacy template876e/delta07a4 have the previously reviewed provenance. Local transport completion is not an execution-effects verdict.

The actual code shows:

- **wp-load.php:** alternative config selection and require_once branches; builtin tests and filename literals are opaque. Presence/hash of the seeded config alone does not identify the selected include branch.
- **wp-config.php:** two unguarded opaque require_once statements near the start, then a final ABSPATH-based require_once. Builtins and runtime constant names/values are obscured. Actual config SHA256 is `a131ee7751a7779991f82a9df724efbd19dcbe58840baff913ec20af7701537f`.
- **wp-settings.php:** require_wp_db, wp_start_object_cache, MU inclusion through wp_get_mu_plugins, active-plugin inclusion through wp_get_active_and_valid_plugins, active-theme inclusion through wp_get_active_and_valid_themes, and multiple do_action sites are visible. Their include suffixes/hook names and some dispatch identities are opaque. The early conditional return cannot be classified from its opaque constant. The reported327 dynamic include sites are lexical counts, not327 independently proven reachable dependencies.
- **kinsta-mu-plugins.php:** ABSPATH guard, followed by ten require/require_once expressions without a visible CLI exclusion. Their public dependency paths are opaque; source SHA256 `fac0c7361bdc6c02e150b60aaf02c82044141ef1276afbfd73684d37f8491e13`.
- **missionmed-matrix-account-entry.php:** registers plugins_loaded and contains mmed_matrix_account_entry_bootstrap_learndash_reskin with a guarded require_once and class init. The registration-to-function association, class_exists/function tests and target path cannot yet be resolved.
- **CLI guards:** homepage-asset-cleaner, homepage-ld-unload and performance-boost visibly test WP_CLI and return from some paths; the predicate identities and exact enclosing callback/registration context remain necessary before excluding their effects. drills-oncall-enrollment's WP_CLI branch registers a command; it is not an automatic whole-file exclusion.
- **launcher:** the pinned stub shows an opaque static call, include and __halt_compiler; the entry class/method/target is unavailable. This calls for a public entry-target fact, not a full PHAR audit.

All76 regularRelativePhpIncludes lists are empty. The reader's direct-literal-only path rule fails to retain ordinary ABSPATH/WPINC/plugin_dir_path expressions, so empty lists do not mean no includes. Similarly the closed hook facts omit callback identity and source position; they cannot associate an init/plugins_loaded registration with its actual body. Existing mail-failclosed registration is visible, but opaque transport calls/guards cannot qualify bootstrap mail suppression; the native preamble itself begins after bootstrap.

## One minimal correction/evidence packet

Keep the same pinned sources, config-string privacy, tokenizer-only execution, installed module and finite capture. Reuse their actual hashes. Add only semantic usability evidence:

1. Retain public executable-code callable/class/member/constant identifiers, including builtin callees such as defined/define/file_exists and public WP calls. Keep arbitrary data strings, numeric values, comments, inline HTML and private variable values opaque. Code symbols are not credentials.
2. Emit context-bound public facts with source positions: exact CLI/ABSPATH/PHP_SAPI guards; registration/dispatch hook names; callback links only when they resolve to source-declared public function/class/method identities. Config literals stay opaque, including words equal to safe constants; a recognized guard fact must not expose a generic config value.
3. Emit bounded public include-target facts for the actual loader expressions: seeded wp-load/config/settings chain, the two config requires, Kinsta's ten includes, the Matrix reskin require and the launcher's fixed entry target. Resolve only recognized literal/known-root forms in private parser memory; emit safe relative public PHP paths or explicit unresolved/outside-scope classifications. Do not execute expressions, adopt included bodies, expand into the whole estate or inspect the whole PHAR. A concrete reachable external dependency can then receive its own precise closure evidence if needed.

First use this single corrected artifact to classify actual bootstrap hook bodies and CLI guard reachability. Do not prepare broad DB/options queries or audit all plugins/themes now. If the visible selection loops remain reachable after those facts, identify their exact missing selection/dependency fact rather than inventing an active set or declaring unknown callbacks approved.

## Inventory boundary

Unchanged native source `c84bc76264749e732e0e2555d942d64086a18cf625dd8f5006c529d32977e8f1` admits inventory mode only creation_inventory_read. Its body adds request-local suppression, reads the hook registry, reflects callbacks, hashes files, sorts and encodes rows; it contains no identity creation, enrollment, state write or callback-body invocation. Bootstrap remains before that body. Class-name reflection/is_callable and hook-object property access require the actual class/autoloader context to establish their reachable introspection effects. Inventory does not require reviewing every unrelated callback body; creation/auth callback qualification follows the later private inventory observation and actual release.

NATIVE_NEXT_EXECUTION_PACKET.md is prospective sequencing evidence, not semantic true flags or current execution controls. New reader evidence and focused semantic acceptance must precede AUTH inventory admission; subsequent creation remains a separate gate. No callback digest substitutes for this closure.

STOP UNCOMMITTED. Write set: only BOOTSTRAP_ACTUAL_SOURCE_SEMANTIC_REVIEW_2.md. Next step is the single privacy-safe semantic-usability correction above, independent delta review and Root's new exact read packet.
