-- Roll back only the RC1 first-use identity policy surface.
-- Principal records created while the policy was active are retained because
-- their immutable identity and owned Timeline data may already be in use.

begin;

drop policy if exists principal_programs_identity_first_use_insert_rc1 on timeline.principal_programs;
drop policy if exists principals_identity_first_use_insert_rc1 on timeline.principals;
drop policy if exists principals_identity_first_use_read_rc1 on timeline.principals;

commit;
