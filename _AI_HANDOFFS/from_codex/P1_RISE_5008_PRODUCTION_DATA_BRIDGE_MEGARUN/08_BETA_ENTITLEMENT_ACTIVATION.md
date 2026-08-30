# Beta Entitlement Activation

The local HQ auth contract passes 1/1, but the current production HQ deployment is commit `e2c40ce8f3a6f4771895fa407681b0527af35f03`, which does not contain the RISE audience/course entitlement implementation from commit `5422500`. Live `/rise/` currently reports that RISE authentication is temporarily unavailable.

DR-147 permits shared-seam verification but explicitly does not authorize deployment to `missionmed-hq-fix005`. Therefore 360 and IV Prep Complete beta activation cannot be safely completed in this ticket without a new exact shared HQ deployment decision preserving the current LOR lineage.

