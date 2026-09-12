# Core Free RISE Access

`CORE_RISE_FREE_ACCESS_LIVE = NO`.

The requested minimum free account/anonymous path crosses the protected shared WordPress/HQ authentication and entitlement seam. That seam is the known-good P1-RISE-5010 baseline, its relevant worktree files were already dirty before 5012H, and DR-235 requires separate `SHARED:AUTH` authority. 5012H therefore preserved the proven fail-closed production chain rather than making an unauthorized access-policy change.

Required continuation: establish a clean source for the shared auth files, obtain exact `SHARED:AUTH` authority, define the free entitlement and private subject, then run authenticated free-user allow, private-data isolation, admin-denial, and anonymous-denial QA.
