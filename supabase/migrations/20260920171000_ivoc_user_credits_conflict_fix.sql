begin;

do $repair$
declare
  function_definition text;
  repaired_definition text;
begin
  select pg_get_functiondef(procedure.oid) into function_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'ivoc_mutate_user_credits'
    and pg_get_function_identity_arguments(procedure.oid)
      = 'p_subject_id text, p_expected_version integer, p_action text, p_amount_seconds bigint, p_idempotency_key uuid, p_reason text, p_actor text';

  if function_definition is null then
    raise exception 'ivoc_credit_function_missing' using errcode = 'P0001';
  end if;

  repaired_definition := replace(
    function_definition,
    'on conflict (subject_id) do update set',
    'on conflict on constraint ivoc_credit_accounts_pkey do update set'
  );
  if repaired_definition = function_definition then
    raise exception 'ivoc_credit_conflict_target_not_found' using errcode = 'P0001';
  end if;

  execute repaired_definition;
end;
$repair$;

comment on function public.ivoc_mutate_user_credits(
  text, integer, text, bigint, uuid, text, text
) is 'Atomic, idempotent IVOC per-user credit mutation using an unambiguous account conflict target.';

commit;
