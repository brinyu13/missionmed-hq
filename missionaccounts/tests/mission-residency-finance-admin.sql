-- Run against a disposable staged Phase 1 database only.
do $$ declare x jsonb; denied boolean; begin
 if not missionaccounts.api_financial_read_access('00000000-0000-4000-8000-000000000001',1) then raise exception 'Founder explicit read grant failed'; end if;
 if missionaccounts.api_financial_read_access('00000000-0000-4000-8000-000000000001',2) or missionaccounts.api_financial_read_access('00000000-0000-4000-8000-000000000002',1) then raise exception 'cross-principal access'; end if;
 denied:=false;begin perform missionaccounts.api_read_financial_command('00000000-0000-4000-8000-000000000002',1);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'unauthorized read accepted';end if;
 x:=missionaccounts.api_read_financial_command('00000000-0000-4000-8000-000000000001',1);
 if jsonb_array_length(x->'accounts')<>17 then raise exception 'directory count mismatch';end if;
 if (select count(*) from jsonb_array_elements(x->'accounts') a where a->>'state'='HELD' and a->'agreement'='null'::jsonb and a->'balance'='null'::jsonb)<>6 then raise exception 'held debt exposed';end if;
end $$;
do $$ declare r text; t text; f text; begin
 foreach r in array array['anon','authenticated'] loop
  foreach t in array array['financial_read_binding','financial_display_directory'] loop
   if has_table_privilege(r,'missionaccounts.'||t,'SELECT') or has_table_privilege(r,'missionaccounts.'||t,'INSERT') then raise exception 'browser table privilege';end if;
  end loop;
  foreach f in array array['api_financial_read_access(uuid,bigint)','api_read_financial_command(uuid,bigint)'] loop
   if has_function_privilege(r,'missionaccounts.'||f,'EXECUTE') then raise exception 'browser RPC privilege';end if;
  end loop;
 end loop;
 foreach t in array array['financial_read_binding','financial_display_directory'] loop
  if has_table_privilege('service_role','missionaccounts.'||t,'INSERT') or has_table_privilege('service_role','missionaccounts.'||t,'UPDATE') or has_table_privilege('service_role','missionaccounts.'||t,'DELETE') then raise exception 'app financial mutation grant';end if;
 end loop;
end $$;
