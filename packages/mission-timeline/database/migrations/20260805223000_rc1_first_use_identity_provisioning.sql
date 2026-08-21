-- TIMELINE-RC1-PRODUCTION-FAILURE-RECOVERY-002
-- Allow the isolated identity-sync role to provision only the exact verified
-- WordPress subject carried by the server-validated Timeline JWT.
-- Existing principal identities remain immutable.

begin;

do $$
begin
  if timeline.schema_version() <> 'd1-timeline-db-500.1' then
    raise exception 'RC1 first-use identity provisioning requires schema version d1-timeline-db-500.1';
  end if;
end
$$;

create policy principals_identity_first_use_read_rc1 on timeline.principals
  for select to timeline_identity_sync using (
    id = timeline.current_principal_id()
    or wp_user_id = nullif(timeline.jwt_claims()->>'wp_user_id', '')::bigint
  );

create policy principals_identity_first_use_insert_rc1 on timeline.principals
  for insert to timeline_identity_sync with check (
    id = timeline.current_principal_id()
    and wp_user_id = nullif(timeline.jwt_claims()->>'wp_user_id', '')::bigint
    and matrix_wp_user_id = nullif(timeline.jwt_claims()->>'wp_user_id', '')::bigint
    and role = timeline.current_role()
    and status = 'ACTIVE'
    and (
      (
        role = 'STUDENT'
        and coalesce((timeline.jwt_claims()->>'has_learndash_3893_access')::boolean, false)
        and not coalesce((timeline.jwt_claims()->>'is_wordpress_administrator')::boolean, false)
      )
      or (
        role = 'PROGRAM_ADMIN'
        and coalesce((timeline.jwt_claims()->>'is_wordpress_administrator')::boolean, false)
      )
    )
  );

create policy principal_programs_identity_first_use_insert_rc1 on timeline.principal_programs
  for insert to timeline_identity_sync with check (
    principal_id = timeline.current_principal_id()
    and program_id = 'missionmed-360:3893'
    and timeline.current_role() = 'STUDENT'
    and coalesce((timeline.jwt_claims()->>'has_learndash_3893_access')::boolean, false)
    and not coalesce((timeline.jwt_claims()->>'is_wordpress_administrator')::boolean, false)
  );

comment on policy principals_identity_first_use_insert_rc1 on timeline.principals is
  'First-use provisioning is limited to the exact server-verified WordPress subject and role in request.jwt.claims.';

commit;
