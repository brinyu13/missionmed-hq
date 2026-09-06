-- MX-MISSIONACCOUNTS-5301P: fail closed when a charge cannot produce the
-- contractually required Stripe receipt. The public student record may omit an
-- email, but a pending financial mutation may not.

create function missionaccounts.enforce_charge_receipt_email()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  receipt_email text;
begin
  if new.state <> 'pending' then return new; end if;

  select lower(btrim(email)) into receipt_email
  from missionaccounts.student
  where id = new.student_id;

  if receipt_email is null
     or receipt_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '23514', message = 'student_receipt_email_required';
  end if;
  return new;
end;
$$;

revoke execute on function missionaccounts.enforce_charge_receipt_email() from public, anon, authenticated;
grant execute on function missionaccounts.enforce_charge_receipt_email() to service_role;

create trigger charge_receipt_email_required
before insert or update of student_id, state on missionaccounts.charge
for each row execute function missionaccounts.enforce_charge_receipt_email();
