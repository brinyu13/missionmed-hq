# D9-415 MU-Plugin Runtime Manifest

Full sealed MU observation: `126` files; top-level files: `46`; selected Matrix closure: `10` files.

Selection includes every component explicitly named by the ticket, the active/copy legacy-popup pair required for quarantine evidence, and direct source-evidenced Matrix effects that Wave 1 undercounted. Unrelated Kinsta/vendor and adjacent product MU files remain outside Git.

| Selected top-level MU file | Bytes | Mode | SHA-256 | Runtime rationale |
|---|---:|---:|---|---|
| `arena-route-proxy.php` | 25209 | `644` | `536cbeb8896f0e92fee992a790c5126cfc5ce826da50e697a8420c9e470420ca` | Provides the four Arena proxy functions directly consumed by the DrJ Matrix access guard. |
| `missionmed-drj-drills-access.php` | 26210 | `644` | `ffab495c8d591d2bb500838334090b816282bcee73c6f55524c0c50b31db43ce` | Auto-loaded role/access control that directly locks Student OS Matrix routes and feature flags for a restricted role. |
| `missionmed-hq-auth-handoff.php` | 24719 | `644` | `f8c14ce4c833174fd1f7837e7a669f390a9cfc03fabcbf4db66d29b1b69ed4b3` | Explicit D9-415 protected WordPress-to-HQ signed authentication/entitlement handoff component. |
| `missionmed-hq-proxy.php` | 8308 | `644` | `85e155f7f5e00ac465e1e5d61b4160d0d7a4d2fa97178bbb52adb8d811d3ccb3` | Explicit D9-415 protected same-origin HQ authentication proxy component. |
| `missionmed-matrix-account-entry.php` | 21023 | `644` | `4c0a10ba39c0dab81d97a5ff4d0a5d6f235e3f778493b6f78d89aae269b712ba` | Matrix account/LearnDash entry component; dynamically loads the hub LearnDash reskin class. |
| `missionmed-mr-legacy-popup.php` | 14800 | `644` | `725790239f0dacc344e8a349c0d095ee57d069d00f254f54f1b2b6dff009a52b` | Active production counterpart required by the explicit duplicate/backup preservation and remediation contract. |
| `missionmed-mr-legacy-popup_BACKUP_PRE004.php` | 14800 | `644` | `725790239f0dacc344e8a349c0d095ee57d069d00f254f54f1b2b6dff009a52b` | Explicitly required byte-identical, currently auto-loaded backup preserved in D9-415A. |
| `missionmed-performance-boost.php` | 52078 | `644` | `00a51063b4f56366568c96bf3bf276b441875d536c509099e05492d683808ba1` | Auto-loaded source that explicitly preserves query versions for the exact missionmed-hub Matrix asset paths. |
| `missionmed-supabase-session-cookie-auth.php` | 3077 | `644` | `d343f7581e3c131bc9a4f5e6a1f2c2c8966c82b9e88d01e92430989e505dc26f` | Explicit D9-415 protected Supabase session-to-WordPress identity bridge. |
| `mm-scheduler-webex-broker.php` | 31173 | `644` | `5544dccf9504266db42105fea048db6687ad28cd53865b3df8aaeff6c4154455` | Explicit Scheduler/Webex entitlement, meeting, recording, and proxy broker used by the Matrix Scheduler runtime. |

The legacy popup and its backup are byte-identical at `725790239f0dacc344e8a349c0d095ee57d069d00f254f54f1b2b6dff009a52b`. Both are auto-loaded in D9-415A exactly as observed. D9-415B removes only the backup-named active-path copy and preserves it unchanged in non-autoloaded forensics.
