-- =============================================================================
-- 20260420_stat_canon_helpers.sql
-- Phase 2.1 of MR-702 STAT Async Duel V1 server-authoritative pivot.
-- Authority: MR-702 (v1.1 corrected via MR-703). Prompt ID: (B3)-STAT-PH2-CLAUDE-HIGH-001.
-- Depends on:
--   20260420_stat_canon_schema.sql  (dataset_registry)
--   20260420_stat_dataset_ingest.sql (dataset_questions with v4 rows)
-- =============================================================================
-- Scope: four deterministic SECURITY DEFINER helpers shared by seal + score paths:
--   1. pick_questions_seeded(p_seed, p_count, p_dataset_version) -> text[]
--   2. shuffle_choices_seeded(p_seed, p_question_ids, p_dataset_version) -> jsonb
--   3. content_hash_compute(p_question_ids, p_choices_order, p_dataset_version) -> text
--   4. answer_map_for(p_question_ids, p_dataset_version) -> jsonb
-- -----------------------------------------------------------------------------
-- Hard contract (STAT_CANON_SPEC.md, Phase 4.1):
--
--   PRNG: mulberry32 seeded from the first 32 bits (big-endian) of sha256(seed).
--   Implementation translated from the canonical JS form:
--     state = (state + 0x6D2B79F5) mod 2^32
--     t     = state
--     inner = ((t ^ (t >>> 15)) mod 2^32) * (t | 1) mod 2^32
--     t     = inner
--     inner = ((t ^ (t >>> 7))  mod 2^32) * (t | 61) mod 2^32
--     t     = (t ^ ((t + inner) mod 2^32)) mod 2^32
--     rand  = ((t ^ (t >>> 14)) mod 2^32) / 2^32
--
--   Shuffle: forward Fisher-Yates. For n items and k picks (0-indexed):
--     for i in 0..k-1:
--       r = mulberry32.next()
--       j = i + floor(r * (n - i))
--       clamp j to [i, n-1] defensively
--       swap arr[i] and arr[j]
--     return arr[0..k-1]
--   shuffle_choices_seeded uses this same forward variant with n=4 and k=3
--   (i = 0,1,2; the last position is fixed by construction).
--
--   content_hash canonical string:
--     'dataset_version=' || version
--     || '|question_ids='   || join(question_ids, ',')
--     || '|choices_order='  || join(for each inner jsonb array:
--                                     join(inner, ','), ';')
--   Outer iteration preserves ordinal order via
--   jsonb_array_elements WITH ORDINALITY ORDER BY ord ASC.
-- -----------------------------------------------------------------------------
-- Determinism rules:
--   * No now()/clock_timestamp()/random()/gen_random_uuid() in any helper body.
--   * pick reads dataset_questions ORDER BY question_id ASC (stable base).
--   * shuffle/hash/answer_map do not depend on row storage order; only inputs.
--   * Volatility: STABLE. SECURITY DEFINER + SET search_path = public, pg_temp.
-- -----------------------------------------------------------------------------
-- Named errors raised (SQLSTATE P0001):
--   dataset_version_unknown     -- registry row missing for p_dataset_version
--   insufficient_questions      -- fewer rows than requested in dataset_questions
--   dataset_version_mismatch    -- answer_map_for cannot resolve one of the ids
--   null_argument               -- guard on null inputs
-- =============================================================================

create extension if not exists pgcrypto;
-- -----------------------------------------------------------------------------
-- 1. pick_questions_seeded
-- -----------------------------------------------------------------------------
create or replace function public.pick_questions_seeded(
  p_seed            text,
  p_count           integer,
  p_dataset_version text
)
returns text[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_state      bigint;
  v_all        text[];
  v_n          integer;
  v_i          integer;
  v_j          integer;
  v_tmp        text;
  v_t          bigint;
  v_inner      bigint;
  v_rand       double precision;
  v_seed_bytes bytea;
begin
  if p_seed is null or p_dataset_version is null or p_count is null then
    raise exception 'null_argument' using errcode = 'P0001';
  end if;
  if p_count <= 0 then
    return array[]::text[];
  end if;

  -- Registry existence gate.
  if not exists (
    select 1
    from public.dataset_registry
    where dataset_version = p_dataset_version
  ) then
    raise exception 'dataset_version_unknown' using errcode = 'P0001';
  end if;

  -- Candidate ids in canonical ASC order.
  select array_agg(question_id order by question_id asc)
    into v_all
  from public.dataset_questions
  where dataset_version = p_dataset_version;

  v_n := coalesce(array_length(v_all, 1), 0);
  if v_n < p_count then
    raise exception 'insufficient_questions' using errcode = 'P0001';
  end if;

  -- Seed PRNG from first 32 bits (big-endian, unsigned) of sha256(p_seed).
  -- Byte-level extraction avoids any bit(32)->int4 signed-interpretation edge
  -- case when the high bit of the SHA-256 prefix is set.
  v_seed_bytes := digest(p_seed, 'sha256');
  v_state      := (get_byte(v_seed_bytes, 0)::bigint << 24)
                | (get_byte(v_seed_bytes, 1)::bigint << 16)
                | (get_byte(v_seed_bytes, 2)::bigint << 8)
                |  get_byte(v_seed_bytes, 3)::bigint;

  -- Forward partial Fisher-Yates: iterate 0..p_count-1 (0-indexed); swap arr[i]
  -- with arr[j] where j in [i, n-1]. plpgsql arrays are 1-indexed.
  v_i := 1;
  while v_i <= p_count loop
    -- mulberry32 next() -- split into atomic, explicitly-masked steps.
    v_state := (v_state + 1831565813) & 4294967295;  -- 0x6D2B79F5
    v_t     := v_state;

    -- t = imul32(t ^ (t >>> 15), t | 1)
    v_inner := (v_t # (v_t >> 15)) & 4294967295;
    v_t     := (v_inner * (v_t | 1)) & 4294967295;

    -- t ^= t + imul32(t ^ (t >>> 7), t | 61)
    v_inner := (v_t # (v_t >> 7)) & 4294967295;
    v_inner := (v_inner * (v_t | 61)) & 4294967295;
    v_t     := (v_t # ((v_t + v_inner) & 4294967295)) & 4294967295;

    -- rand = ((t ^ (t >>> 14)) & 0xFFFFFFFF) / 2^32
    v_rand := ((v_t # (v_t >> 14)) & 4294967295)::double precision / 4294967296.0;

    -- j in 1-based: pick from [v_i, v_n]
    v_j := v_i + floor(v_rand * ((v_n - v_i + 1)::double precision))::integer;
    if v_j > v_n then
      v_j := v_n;
    end if;
    if v_j < v_i then
      v_j := v_i;
    end if;

    if v_j <> v_i then
      v_tmp      := v_all[v_i];
      v_all[v_i] := v_all[v_j];
      v_all[v_j] := v_tmp;
    end if;

    v_i := v_i + 1;
  end loop;

  return v_all[1:p_count];
end;
$fn$;
comment on function public.pick_questions_seeded(text, integer, text) is
  'Deterministic pick of p_count question_ids from dataset_questions for p_dataset_version, seeded by p_seed via mulberry32. MR-702 Phase 2.1.';
-- -----------------------------------------------------------------------------
-- 2. shuffle_choices_seeded
-- -----------------------------------------------------------------------------
create or replace function public.shuffle_choices_seeded(
  p_seed            text,
  p_question_ids    text[],
  p_dataset_version text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_out        jsonb := '[]'::jsonb;
  v_qid        text;
  v_ord        integer;
  v_state      bigint;
  v_seed_bytes bytea;
  v_arr        text[];
  v_i          integer;
  v_j          integer;
  v_tmp        text;
  v_t          bigint;
  v_inner      bigint;
  v_rand       double precision;
begin
  if p_seed is null or p_dataset_version is null then
    raise exception 'null_argument' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.dataset_registry
    where dataset_version = p_dataset_version
  ) then
    raise exception 'dataset_version_unknown' using errcode = 'P0001';
  end if;

  if p_question_ids is null or coalesce(array_length(p_question_ids, 1), 0) = 0 then
    return v_out;
  end if;

  for v_ord in 1..array_length(p_question_ids, 1) loop
    v_qid        := p_question_ids[v_ord];
    v_seed_bytes := digest(p_seed || ':' || v_qid, 'sha256');
    v_state      := (get_byte(v_seed_bytes, 0)::bigint << 24)
                  | (get_byte(v_seed_bytes, 1)::bigint << 16)
                  | (get_byte(v_seed_bytes, 2)::bigint << 8)
                  |  get_byte(v_seed_bytes, 3)::bigint;

    v_arr := array['A','B','C','D'];

    -- forward Fisher-Yates for n=4, k=3 (i = 1..3 in 1-based; j in [i, 4])
    v_i := 1;
    while v_i <= 3 loop
      v_state := (v_state + 1831565813) & 4294967295;  -- 0x6D2B79F5
      v_t     := v_state;

      v_inner := (v_t # (v_t >> 15)) & 4294967295;
      v_t     := (v_inner * (v_t | 1)) & 4294967295;

      v_inner := (v_t # (v_t >> 7)) & 4294967295;
      v_inner := (v_inner * (v_t | 61)) & 4294967295;
      v_t     := (v_t # ((v_t + v_inner) & 4294967295)) & 4294967295;

      v_rand := ((v_t # (v_t >> 14)) & 4294967295)::double precision / 4294967296.0;

      v_j := v_i + floor(v_rand * ((4 - v_i + 1)::double precision))::integer;
      if v_j > 4 then v_j := 4; end if;
      if v_j < v_i then v_j := v_i; end if;

      if v_j <> v_i then
        v_tmp      := v_arr[v_i];
        v_arr[v_i] := v_arr[v_j];
        v_arr[v_j] := v_tmp;
      end if;

      v_i := v_i + 1;
    end loop;

    v_out := v_out || jsonb_build_array(to_jsonb(v_arr));
  end loop;

  return v_out;
end;
$fn$;
comment on function public.shuffle_choices_seeded(text, text[], text) is
  'Deterministic per-question choice permutation. Fisher-Yates mulberry32 seeded by sha256(p_seed || '':'' || question_id). Registry-version gated. MR-702 Phase 2.1.';
-- -----------------------------------------------------------------------------
-- 3. content_hash_compute
-- -----------------------------------------------------------------------------
-- Canonical content hash for a sealed pack. Byte-identical to a matching JS
-- implementation that builds the same canonical string and SHA-256s its UTF-8
-- bytes. Intentionally avoids jsonb::text (pg does not guarantee jsonb key /
-- whitespace stability across versions).
create or replace function public.content_hash_compute(
  p_question_ids    text[],
  p_choices_order   jsonb,
  p_dataset_version text
)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_canonical      text;
  v_choices_joined text;
begin
  if p_dataset_version is null or p_question_ids is null or p_choices_order is null then
    raise exception 'null_argument' using errcode = 'P0001';
  end if;

  select string_agg(
           array_to_string(
             array(select jsonb_array_elements_text(elem)),
             ','
           ),
           ';'
           order by ord
         )
    into v_choices_joined
  from jsonb_array_elements(p_choices_order) with ordinality as t(elem, ord);

  v_canonical :=
       'dataset_version=' || p_dataset_version
    || '|question_ids='   || array_to_string(p_question_ids, ',')
    || '|choices_order='  || coalesce(v_choices_joined, '');

  return encode(digest(v_canonical, 'sha256'), 'hex');
end;
$fn$;
comment on function public.content_hash_compute(text[], jsonb, text) is
  'SHA-256 hex over the canonical pack string: dataset_version=<v>|question_ids=<csv>|choices_order=<csv rows joined by ;>. STAT_CANON_SPEC Phase 4.1. MR-702 Phase 2.1.';
-- -----------------------------------------------------------------------------
-- 4. answer_map_for
-- -----------------------------------------------------------------------------
-- Returns a jsonb array [{id: <qid>, answer: <A|B|C|D>}, ...] aligned with the
-- ordering of p_question_ids. Raises dataset_version_mismatch if any id cannot
-- be resolved in dataset_questions for the given dataset_version.
create or replace function public.answer_map_for(
  p_question_ids    text[],
  p_dataset_version text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_out           jsonb;
  v_missing_count integer;
begin
  if p_dataset_version is null or p_question_ids is null then
    raise exception 'null_argument' using errcode = 'P0001';
  end if;

  if coalesce(array_length(p_question_ids, 1), 0) = 0 then
    return '[]'::jsonb;
  end if;

  if not exists (
    select 1
    from public.dataset_registry
    where dataset_version = p_dataset_version
  ) then
    raise exception 'dataset_version_unknown' using errcode = 'P0001';
  end if;

  -- Coverage check: every input id must resolve in dataset_questions.
  select count(*)
    into v_missing_count
  from unnest(p_question_ids) with ordinality as t(qid, ord)
  left join public.dataset_questions dq
    on dq.dataset_version = p_dataset_version
   and dq.question_id     = t.qid
  where dq.answer is null;

  if v_missing_count > 0 then
    raise exception 'dataset_version_mismatch' using errcode = 'P0001';
  end if;

  -- Aligned output.
  select jsonb_agg(
           jsonb_build_object('id', t.qid, 'answer', dq.answer)
           order by t.ord
         )
    into v_out
  from unnest(p_question_ids) with ordinality as t(qid, ord)
  join public.dataset_questions dq
    on dq.dataset_version = p_dataset_version
   and dq.question_id     = t.qid;

  return coalesce(v_out, '[]'::jsonb);
end;
$fn$;
comment on function public.answer_map_for(text[], text) is
  'Returns jsonb array [{id, answer}, ...] aligned with p_question_ids. Raises dataset_version_mismatch if any id is absent. MR-702 Phase 2.1.';
-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
grant execute on function public.pick_questions_seeded(text, integer, text) to authenticated;
grant execute on function public.shuffle_choices_seeded(text, text[], text) to authenticated;
grant execute on function public.content_hash_compute(text[], jsonb, text)  to authenticated;
grant execute on function public.answer_map_for(text[], text)               to authenticated;
-- =============================================================================
-- Fixed test vectors (STAT_CANON_SPEC.md Phase 4.1 parity probe)
-- =============================================================================
-- Asserts run at migration apply time. Any drift in the PRNG or the canonical
-- serialization fails the branch preview immediately.
-- -----------------------------------------------------------------------------
-- VECTOR A -- content_hash_compute:
--   question_ids    = ARRAY['Q1','Q2','Q3']
--   choices_order   = '[["A","B","C","D"],["B","A","D","C"],["D","C","B","A"]]'::jsonb
--   dataset_version = 'v4'
--   Canonical string :
--     'dataset_version=v4|question_ids=Q1,Q2,Q3|choices_order=A,B,C,D;B,A,D,C;D,C,B,A'
--   EXPECTED SHA-256 (hex):
--     3c1e3e0b02b4f30d86731e93b04001dd14bc0617887f24226668511fbdb88f69
-- -----------------------------------------------------------------------------
-- VECTOR B -- shuffle_choices_seeded (does not touch dataset_questions rows):
--   p_seed            = 'abc123'
--   p_question_ids    = ARRAY['Q1','Q2','Q3']
--   p_dataset_version = 'v4'
--   EXPECTED jsonb:
--     [["D","C","A","B"],["A","D","B","C"],["D","B","C","A"]]
-- -----------------------------------------------------------------------------
-- VECTOR C -- pick_questions_seeded determinism (content-agnostic):
--   Same (seed, count, dataset_version) -> identical text[] on repeat calls.
--   Parity checked in Phase 2.2 integration tests. Reference mulberry32 +
--   sha256-prefix + forward partial Fisher-Yates. Python reference:
--   corpus ['X001'..'X010'], seed='seed-A', count=3 -> ['X007','X001','X006'].
-- =============================================================================

do $assert$
declare
  v_hash text;
  v_shuf jsonb;
begin
  -- VECTOR A: content_hash_compute
  v_hash := public.content_hash_compute(
              array['Q1','Q2','Q3']::text[],
              '[["A","B","C","D"],["B","A","D","C"],["D","C","B","A"]]'::jsonb,
              'v4'
            );
  if v_hash <> '3c1e3e0b02b4f30d86731e93b04001dd14bc0617887f24226668511fbdb88f69' then
    raise exception 'content_hash_compute parity failure: got %', v_hash;
  end if;

  -- VECTOR B: shuffle_choices_seeded (requires dataset_registry row for v4;
  -- skipped if registry is unseeded during branch preview without the ingest
  -- migration applied).
  if exists (select 1 from public.dataset_registry where dataset_version = 'v4') then
    v_shuf := public.shuffle_choices_seeded(
                'abc123',
                array['Q1','Q2','Q3']::text[],
                'v4'
              );
    if v_shuf <> '[["D","C","A","B"],["A","D","B","C"],["D","B","C","A"]]'::jsonb then
      raise exception 'shuffle_choices_seeded parity failure: got %', v_shuf::text;
    end if;
  end if;
end;
$assert$;
-- =============================================================================
-- End of 20260420_stat_canon_helpers.sql
-- =============================================================================;
