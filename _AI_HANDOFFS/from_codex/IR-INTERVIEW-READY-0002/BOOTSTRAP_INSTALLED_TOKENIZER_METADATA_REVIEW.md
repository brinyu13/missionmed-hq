# Independent installed-tokenizer metadata probe review

Verdict: **APPROVE this exact bounded read-only metadata probe for Root's separately controlled execution.** No module loading, reader retry, WordPress bootstrap, native operation or provider admission is approved.

Independent reviewer `/root/phase1_release_verifier`, requested Sol6.1 High. Actual HEAD independently remains `3da89f3d6a40b620cc89aba1a79d3d55a273a3f8`; packet OS pin is R2 `bc1d36fcb9f7bdda4bcd4ba507078b7787d802a2`. Only this new report was written. No probe/source/helper/PHP/SSH/provider/credentials/bootstrap/control/HEAD operation occurred.

Exact handoff-directory pins:

- BOOTSTRAP_TOKENIZER_PROBE_READBACK_1.json: `3288799d193fec7aa3d874a43bda8c086852b229cb3e127923febcdf8e0573cb`.
- BOOTSTRAP_INSTALLED_TOKENIZER_METADATA_PACKET_1.json: `9cc30f6aa242760fcaee2f4fb5fddd5182c2642f5ebd3361af79b320ccabe8f4`.
- Embedded program: `640cdd20f14d380d3bb05d3f74191c27bc0763e147ea00b8648031ef13322094`.
- Native private_capture dependency: `c84bc76264749e732e0e2555d942d64086a18cf625dd8f5006c529d32977e8f1`.

Root's previous readback records PHP8.2.29/cli/tokenizer=false under -n at1791161701.841522 with the local transport reaped. That establishes the isolated availability result; this reviewer did not reproduce it remotely.

The fixed SSH program queries only compiled PHP_EXTENSION_DIR through `/usr/bin/php8.2 -n -r`. It constrains the resulting directory to `/usr/lib/php/<digits>`, then opens only tokenizer.so and `/etc/php/8.2/mods-available/tokenizer.ini` read-only. Regular-file/ancestor-symlink checks, O_NOFOLLOW, size caps and in-read metadata checks reject unsafe/drifting inputs. Module cap is1MiB; INI cap4096 bytes. The only noncomment INI directive must be exactly extension=tokenizer.so; the known CLI20-tokenizer.ini symlink must resolve to that same INI. The INI is inspected as bytes, not loaded. The module is hashed, not executed.

Successful output is only the constrained module path, integer byte count, module/INI SHA256 and two fixed true qualification flags. No source body, INI content, environment, credential, WP configuration, DB or private error is emitted. Failure produces only INSTALLED_TOKENIZER_METADATA_STOP. Fixed SSH BatchMode/StrictHostKeyChecking/ConnectTimeout8, Native Dispatch10/private_capture4096/reap2, remote alarm8/PHP communicate6/best-effort reap1 remain bounded. The PHP child has only fixed small compile-time metadata output; remote communicate's postcapture cap is accepted for this exact snippet.

Independent packet/program/capture hashes, argv, limits, Python AST and compile checks PASS. Program not executed. A successful result qualifies installed file custody and the observed standard reference only; it does not approve the binary loader, extension enabling, parser substitution or harmless WordPress bootstrap. Any later php -n -d extension=<exact qualified module> change requires its own narrow packet/review. A failed or unresolved capture permits no automatic retry or semantic conclusion.

STOP UNCOMMITTED. Write set: only BOOTSTRAP_INSTALLED_TOKENIZER_METADATA_REVIEW.md.
