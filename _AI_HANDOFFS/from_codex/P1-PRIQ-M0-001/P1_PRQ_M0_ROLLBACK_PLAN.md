# Rollback plan

No deploy or migration occurred. Rollback is therefore branch-local: revert the PRIQ commits (do not reset unrelated work). If the isolated migration is later applied, first disable PRIQ traffic, export required audit evidence, then use a separately reviewed down migration; never delete audit/private data ad hoc.

Emergency runtime rollback is the backend `mirEnabled=false` kill switch plus disabled writebacks. This foundation binds only to loopback until OIDC exists.
