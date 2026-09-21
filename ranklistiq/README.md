# RankListIQ dual-mode source

This directory contains the bounded RankListIQ frontend work for mission
`RLQ-DUALMODE-0921A`.

The live WordPress page (post 4216) is a wrapper whose `post_content` embeds
`/wp-content/uploads/2026/03/rank_list_engine_WORKING.html` in an iframe. The
exact public artifact is retained only in the private provider backup because
the public source contained hard-coded developer unlock credentials. The Git
base is a byte-preserving capture except for a security-only sanitization that
removes every plaintext occurrence from executable code, changelog text, and
rollback filenames and makes all three client-side unlock checks fail closed.

No WordPress plugin, BFF, RISE source, Matrix source, entitlement, Supabase
schema, policy, or production row is owned by this directory.
