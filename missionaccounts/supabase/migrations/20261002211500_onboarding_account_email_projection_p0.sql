-- DR-363: fill missing contact email from the verified WordPress account identity.
BEGIN;
create function missionaccounts.api_sync_student_account_email(
  p_student_id uuid, p_account_email text, p_actor_id text, p_actor_role text
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, missionaccounts
as $$
declare s missionaccounts.student%rowtype; r record;
  clean_email text := lower(btrim(p_account_email)); changed boolean := false;
begin
  if p_actor_role is distinct from 'student' or p_actor_id is distinct from p_student_id::text then
    raise exception using errcode='42501', message='account_email_subject_mismatch';
  end if;
  if clean_email is null or length(clean_email)>320 or clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode='22023', message='account_email_invalid';
  end if;
  select * into s from missionaccounts.student where id=p_student_id for update;
  if not found then raise exception using errcode='P0002', message='student_not_found'; end if;
  select * into r from missionaccounts.identity_student_resolution where source_student_id=p_student_id;
  if s.identity_state<>'verified' or r.canonical_student_id is distinct from p_student_id
     or coalesce(r.absorbed,false) or coalesce(r.excluded,false) then
    raise exception using errcode='42501', message='account_email_canonical_identity_required';
  end if;
  if nullif(btrim(s.email),'') is null then
    update missionaccounts.student set email=clean_email where id=p_student_id;
    s.email:=clean_email; changed:=true;
    insert into missionaccounts.audit_event(actor_id,actor_role,subject_student_id,kind,text,from_val,to_val,reason,request_id)
    values(p_actor_id,p_actor_role,p_student_id,'onboarding.account_email_projected',
      'Verified account supplied missing contact email',jsonb_build_object('email_present',false),
      jsonb_build_object('email_present',true),'Verified WordPress account identity projection',
      'missionaccounts:account-email:'||p_student_id::text);
  end if;
  return jsonb_build_object('email',s.email,'updated',changed);
end;
$$;
revoke all on function missionaccounts.api_sync_student_account_email(uuid,text,text,text) from public,anon,authenticated;
grant execute on function missionaccounts.api_sync_student_account_email(uuid,text,text,text) to service_role;
COMMIT;
