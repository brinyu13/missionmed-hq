# RankListIQ dual-mode source

This directory contains the bounded RankListIQ frontend work for mission
`RLQ-DUALMODE-0921A`.

The live WordPress page (post 4216) is a wrapper whose `post_content` embeds
`/wp-content/uploads/2026/03/rank_list_engine_WORKING.html` in an iframe. The
exact public artifact is retained only in the private provider backup because
the public source contained hard-coded developer unlock credentials. The Git
base is a byte-preserving capture except for four security edits that remove
those credential values and make both client-side unlock comparisons fail
closed.

No WordPress plugin, BFF, RISE source, Matrix source, entitlement, Supabase
schema, policy, or production row is owned by this directory.

