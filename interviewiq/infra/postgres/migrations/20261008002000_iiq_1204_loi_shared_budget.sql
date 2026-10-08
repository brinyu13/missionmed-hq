-- Additive candidate only. Existing outbox rows remain untouched. No new tables or roles.
BEGIN;
SET LOCAL ROLE iiq_owner;
-- Runtime remains owner-private. Only the existing NOLOGIN migration owner may
-- read reservation payloads inside the narrow definer functions below.
CREATE POLICY loi_budget_internal_read ON iiq.outbox_events FOR SELECT TO iiq_owner
 USING (topic='iiq.loi.generation.reserved');
CREATE FUNCTION iiq.loi_budget_policy_valid(p jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE amount bigint; output_tokens bigint; budget bigint; timeout_ms bigint;
BEGIN
 IF p IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object'
  OR jsonb_typeof(p->'maxCostMicros') IS DISTINCT FROM 'number'
  OR jsonb_typeof(p->'maxOutputTokens') IS DISTINCT FROM 'number'
  OR jsonb_typeof(p->'lifetimeBudgetMicros') IS DISTINCT FROM 'number'
  OR jsonb_typeof(p->'timeoutMs') IS DISTINCT FROM 'number'
  OR coalesce(p->>'maxCostMicros','')!~'^[0-9]{1,8}$'
  OR coalesce(p->>'maxOutputTokens','')!~'^[0-9]{1,8}$'
  OR coalesce(p->>'lifetimeBudgetMicros','')!~'^[0-9]{1,8}$'
  OR coalesce(p->>'timeoutMs','')!~'^[0-9]{1,8}$' THEN RETURN false; END IF;
 amount:=(p->>'maxCostMicros')::bigint;output_tokens:=(p->>'maxOutputTokens')::bigint;
 budget:=(p->>'lifetimeBudgetMicros')::bigint;timeout_ms:=(p->>'timeoutMs')::bigint;
 RETURN coalesce(p->>'authorizationId'='FOUNDER-IIQ1204-LOI25USD-20261005'
  AND p->>'model'='gpt-5-nano-2025-08-07'
  AND p->>'canaryOwnerId'='c94abcfb-dfda-4c74-9a27-f58fcf56f9b2'
  AND p->'maxInputTokens'='400000'::jsonb
  AND output_tokens BETWEEN 128 AND 8192 AND timeout_ms BETWEEN 100 AND 30000
  AND amount BETWEEN (400000+8*output_tokens+19)/20 AND 1000000
  AND budget BETWEEN amount AND 25000000,false);
END $$;
REVOKE ALL ON FUNCTION iiq.loi_budget_policy_valid(jsonb) FROM PUBLIC;
CREATE FUNCTION iiq.loi_budget_total() RETURNS bigint
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; total bigint:=0; amount bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid='iiq.outbox_events'::regclass
  AND p.polname='loi_budget_internal_read' AND p.polcmd='r'
  AND p.polroles=ARRAY['iiq_owner'::regrole::oid]
  AND pg_catalog.pg_get_expr(p.polqual,p.polrelid)='(topic = ''iiq.loi.generation.reserved''::text)') THEN
  RAISE EXCEPTION 'LOI aggregate visibility unqualified' USING ERRCODE='23514';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('IIQ1204:LOI:SHARED_LIFETIME_25USD',0));
 FOR r IN SELECT payload FROM iiq.outbox_events WHERE topic='iiq.loi.generation.reserved' AND payload->'dispatch' IS DISTINCT FROM 'false'::jsonb LOOP
  IF NOT iiq.loi_budget_policy_valid(r->'policy') OR r->'dispatch' IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(r->'reservedCostMicros') IS DISTINCT FROM 'number'
    OR coalesce(r->>'reservedCostMicros','')!~'^[0-9]{1,8}$'
    OR r->'policy'->>'authorizationId' IS DISTINCT FROM 'FOUNDER-IIQ1204-LOI25USD-20261005'
    OR r->'policy'->>'model' IS DISTINCT FROM 'gpt-5-nano-2025-08-07'
    OR r->'policy'->>'canaryOwnerId' IS DISTINCT FROM 'c94abcfb-dfda-4c74-9a27-f58fcf56f9b2'
    OR r->'policy'->>'maxCostMicros' IS DISTINCT FROM r->>'reservedCostMicros' THEN
   RAISE EXCEPTION 'LOI budget history unqualified' USING ERRCODE='23514';
  END IF;
  amount:=(r->>'reservedCostMicros')::bigint;
  IF amount<1 OR amount>1000000 OR total>25000000-amount THEN
   RAISE EXCEPTION 'LOI budget exhausted or unqualified' USING ERRCODE='23514';
  END IF;
  total:=total+amount;
 END LOOP;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION iiq.loi_budget_total() FROM PUBLIC;
CREATE FUNCTION iiq.loi_budget_allowance(cost bigint, ceiling bigint) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE total bigint;
BEGIN
 IF NOT iiq.authenticated() OR iiq.actor_id() IS DISTINCT FROM 'c94abcfb-dfda-4c74-9a27-f58fcf56f9b2'::uuid
  OR iiq.actor_role() IS DISTINCT FROM 'student' OR current_setting('iiq.wp_user_id',true) IS DISTINCT FROM '1397' THEN
  RETURN jsonb_build_object('allowed',false,'reason','AI_CANARY_SCOPE');
 END IF;
 IF cost IS NULL OR ceiling IS NULL OR cost<1 OR cost>1000000 OR ceiling<cost OR ceiling>25000000 THEN
  RETURN jsonb_build_object('allowed',false,'reason','SHARED_LIFETIME_LIMIT');
 END IF;
 -- Guard must exist and be enabled; removal never silently degrades to owner totals.
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid='iiq.outbox_events'::regclass
  AND t.tgname='loi_budget_reservation_guard' AND t.tgenabled='O'
  AND t.tgfoid='iiq.loi_budget_reservation_guard()'::regprocedure) THEN
  RETURN jsonb_build_object('allowed',false,'reason','SHARED_BUDGET_UNAVAILABLE');
 END IF;
 total:=iiq.loi_budget_total();
 RETURN jsonb_build_object('allowed',total<=ceiling-cost AND total<=25000000-cost,'reason','SHARED_LIFETIME_LIMIT','contract','iiq-loi-shared-budget-v1','totalReservedMicros',total,'capMicros',25000000);
EXCEPTION WHEN check_violation THEN
 RETURN jsonb_build_object('allowed',false,'reason','SHARED_BUDGET_UNAVAILABLE');
END $$;
REVOKE ALL ON FUNCTION iiq.loi_budget_allowance(bigint,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iiq.loi_budget_allowance(bigint,bigint) TO iiq_authenticated;
CREATE FUNCTION iiq.loi_budget_reservation_guard() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb; total bigint; amount bigint; ceiling bigint;
BEGIN
 IF TG_OP<>'INSERT' THEN
  IF OLD.topic='iiq.loi.generation.reserved' OR (TG_OP='UPDATE' AND NEW.topic='iiq.loi.generation.reserved') THEN
   RAISE EXCEPTION 'LOI reservations are immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF NEW.topic<>'iiq.loi.generation.reserved' THEN RETURN NEW; END IF;
 p:=NEW.payload;
 IF p->'dispatch'='false'::jsonb AND p->'reservedCostMicros'='0'::jsonb THEN RETURN NEW; END IF;
 IF NOT iiq.authenticated() OR NEW.owner_id IS DISTINCT FROM iiq.actor_id()
   OR iiq.actor_id() IS DISTINCT FROM 'c94abcfb-dfda-4c74-9a27-f58fcf56f9b2'::uuid
   OR iiq.actor_role() IS DISTINCT FROM 'student' OR current_setting('iiq.wp_user_id',true) IS DISTINCT FROM '1397'
   OR NOT iiq.loi_budget_policy_valid(p->'policy') OR p->'dispatch' IS DISTINCT FROM 'true'::jsonb
   OR jsonb_typeof(p->'reservedCostMicros') IS DISTINCT FROM 'number'
   OR coalesce(p->>'reservedCostMicros','')!~'^[0-9]{1,8}$'
   OR coalesce(p->'policy'->>'lifetimeBudgetMicros','')!~'^[0-9]{1,8}$'
   OR p->'policy'->>'authorizationId' IS DISTINCT FROM 'FOUNDER-IIQ1204-LOI25USD-20261005'
   OR p->'policy'->>'model' IS DISTINCT FROM 'gpt-5-nano-2025-08-07'
   OR p->'policy'->>'canaryOwnerId' IS DISTINCT FROM NEW.owner_id::text
   OR p->'policy'->>'maxCostMicros' IS DISTINCT FROM p->>'reservedCostMicros' THEN
  RAISE EXCEPTION 'LOI reservation unqualified' USING ERRCODE='23514';
 END IF;
 amount:=(p->>'reservedCostMicros')::bigint;ceiling:=(p->'policy'->>'lifetimeBudgetMicros')::bigint;
 IF amount<1 OR amount>1000000 OR ceiling<amount OR ceiling>25000000 THEN
  RAISE EXCEPTION 'LOI reservation limit' USING ERRCODE='23514';
 END IF;
 total:=iiq.loi_budget_total();
 IF total>ceiling-amount OR total>25000000-amount THEN
  RAISE EXCEPTION 'LOI shared lifetime budget exhausted' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION iiq.loi_budget_reservation_guard() FROM PUBLIC;
CREATE TRIGGER loi_budget_reservation_guard BEFORE INSERT OR UPDATE OR DELETE ON iiq.outbox_events
 FOR EACH ROW EXECUTE FUNCTION iiq.loi_budget_reservation_guard();
COMMIT;
