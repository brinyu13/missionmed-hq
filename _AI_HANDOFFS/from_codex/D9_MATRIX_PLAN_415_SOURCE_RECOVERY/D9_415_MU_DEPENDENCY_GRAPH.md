# D9-415 MU Dependency Graph

```text
WordPress MU loader (alphabetical top-level *.php autoload)
├── missionmed-matrix-account-entry.php
│   └── wp-content/plugins/missionmed-hub/includes/class-mmed-learndash-reskin.php
├── missionmed-drj-drills-access.php
│   └── arena-route-proxy.php (four optional custom Arena proxy functions)
├── missionmed-performance-boost.php
│   └── exact missionmed-hub Student OS/Calendar/Scheduler/File Vault/StoryForge asset paths
├── missionmed-hq-auth-handoff.php
├── missionmed-hq-proxy.php
├── missionmed-supabase-session-cookie-auth.php
├── mm-scheduler-webex-broker.php
├── missionmed-mr-legacy-popup.php
└── missionmed-mr-legacy-popup_BACKUP_PRE004.php (same symbols/hooks and same bytes)
```

No selected top-level MU file directly `include`s or `require`s another selected MU file. The Matrix account entry dynamically requires the hub LearnDash reskin class if not already loaded. The DrJ access guard calls four custom functions supplied by `arena-route-proxy.php`; that provider is therefore included. The performance MU file is included because it explicitly preserves query-version behavior for the exact Matrix asset set.

The two legacy-popup PHP files register the same functions and hooks. Their active co-location is preserved only in immutable D9-415A evidence and is the exact source-only quarantine target for D9-415B.
