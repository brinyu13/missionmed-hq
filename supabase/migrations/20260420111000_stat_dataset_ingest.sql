-- =============================================================================
-- 20260420_stat_dataset_ingest.sql
-- Phase 1.2 of MR-702 STAT Async Duel V1 server-authoritative pivot.
-- Authority: MR-702 (v1.1 corrected via MR-703). Prompt ID: (B3)-STAT-PH1-CLAUDE-HIGH-002.
-- Depends on: 20260420_stat_canon_schema.sql (dataset_registry + canonical state enum)
-- =============================================================================
-- Scope:
--   1. Create public.dataset_questions (SQL-resident question bank).
--   2. Deterministically load 845 v4 questions from the canonical JSON at
--      /Users/brianb/MissionMed/universal_questions_v4.json (repo root).
--   3. Install dataset_canonical_hash(text) server-side hash function.
--   4. Seed dataset_registry row for version 'v4' using that hash.
--   5. Install dataset_registry_current() helper.
-- -----------------------------------------------------------------------------
-- Idempotency:
--   * CREATE TABLE / INDEX: IF NOT EXISTS
--   * dataset_questions rows: INSERT ... ON CONFLICT DO UPDATE on (dataset_version,
--     question_id) primary key, all columns refreshed from EXCLUDED.
--   * dataset_registry row: INSERT ... ON CONFLICT DO UPDATE on dataset_version.
--   * Helper functions: CREATE OR REPLACE.
--   Re-running the migration leaves row counts identical and re-computes the hash
--   from the same canonical source.
-- -----------------------------------------------------------------------------
-- Canonical serialization (Phase 4.1 STAT_CANON_SPEC.md):
--   Per-row: question_id '|' prompt '|' choice_a '|' choice_b '|' choice_c '|'
--   choice_d '|' answer
--   Aggregate: rows joined by E'\n' ORDER BY question_id ASC.
--   Hash: SHA-256 of UTF-8 bytes, hex encoded.
-- -----------------------------------------------------------------------------
-- Dataset provenance:
--   source_path : /Users/brianb/MissionMed/universal_questions_v4.json
--   record_count: 845
--   ordering    : sort(records, key=id) ascending
--   transform   : id->question_id; question->prompt; choices{A..D}->choice_a..d;
--                 correct_answer letter preserved as answer
-- =============================================================================

create extension if not exists pgcrypto;
-- -----------------------------------------------------------------------------
-- 1. Resident questions table
-- -----------------------------------------------------------------------------
create table if not exists public.dataset_questions (
  dataset_version text   not null,
  question_id     text   not null,
  prompt          text   not null,
  choice_a        text   not null,
  choice_b        text   not null,
  choice_c        text   not null,
  choice_d        text   not null,
  answer          char(1) not null check (answer in ('A','B','C','D')),
  explanation     text,
  primary key (dataset_version, question_id)
);
create index if not exists dataset_questions_ver_qid_idx
  on public.dataset_questions (dataset_version, question_id);
grant select on public.dataset_questions to authenticated;
comment on table public.dataset_questions is
  'SQL-resident question bank. Server-authoritative source for duel seal + score. MR-702 Phase 1.2.';
-- -----------------------------------------------------------------------------
-- 2. Deterministic seed of dataset_version = 'v4' (845 rows, sorted by question_id asc)
-- -----------------------------------------------------------------------------

insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-010AC632EC4E', 'What is the treatment for CMV Encephalitis?', 'Ganciclovir', 'IV acyclovir', 'Interferon and Tenofovir', 'Supportive', 'A', 'Treatment for CMV Encephalitis: Ganciclovir. (Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-010AC632EC4E_V', 'A 30-year-old patient is diagnosed with CMV Encephalitis. The patient presents with Altered mental status, confusion, neck stiffness, photophobia, Retinitis, esophagitis,. What is the most appropriate treatment?', 'Ganciclovir', 'IV acyclovir', 'Interferon and Tenofovir', 'Supportive', 'A', 'Treatment for CMV Encephalitis: Ganciclovir. (Vignette from Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-01B0E91CC191', 'What is the treatment for Type II diabetes?', 'If all the receptors are not working anymore due to lack of treatment, can end up in DKAdown ﬁnomina - GH', 'Insulin , > MOA = works on adipose', 'Thiazide, paradoxical effect, make more V₂ aquaporins', 'Topical azoles, selenium sulﬁde', 'A', 'Treatment for Type II diabetes: If all the receptors are not working anymore due to lack of treatment ,  can end up in DKAdown ﬁnomina - GH. Give more insulinsomagi affect - done b... (Dr. J notes, p12)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-01B0E91CC191_V', 'A 58-year-old patient is diagnosed with Type II diabetes. The patient presents with Insulin resistance ↑ [ insulin desensitization ] - path-physiology. What is the most appropriate treatment?', 'If all the receptors are not working anymore due to lack of treatment, can end up in DKAdown ﬁnomina - GH', 'Insulin , > MOA = works on adipose', 'Thiazide, paradoxical effect, make more V₂ aquaporins', 'Topical azoles, selenium sulﬁde', 'A', 'Treatment for Type II diabetes: If all the receptors are not working anymore due to lack of treatment ,  can end up in DKAdown ﬁnomina - GH. Give more insulinsomagi affect - done b... (Vignette from Dr. J notes, p12)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-01CEC7467C49', 'What is the treatment for Takayasu?', 'Vasculitis small vessel, diminished pulses in arm or leg Sed high, haptoglobin level is low- ab bind to RBC and lyse', 'Methotrexate = dihydro-folate reductase inhibitor, A/E - megaloblastic anemia so Give with B9, leucovorin', 'Went to vagus drink alcohol to much, acute gout', 'Urinary incountinance, wipe don’t feel = quad eqvaina', 'A', 'Treatment for Takayasu: Vasculitis small vessel, diminished pulses in arm or leg Sed high, haptoglobin level is low- ab bind to RBC and lyse , > schistocytes Rx - low dose ... (Dr. J notes, p20)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-01CEC7467C49_V', 'A 40-year-old patient with Takayasu presents with Vasculitis small vessel, diminished pulses in arm or leg Sed high, haptoglobin level is low- ab bind to RBC and lyse , > . What is the best initial treatment?', 'Vasculitis small vessel, diminished pulses in arm or leg Sed high, haptoglobin level is low- ab bind to RBC and lyse', 'Methotrexate = dihydro-folate reductase inhibitor, A/E - megaloblastic anemia so Give with B9, leucovorin', 'Went to vagus drink alcohol to much, acute gout', 'Urinary incountinance, wipe don’t feel = quad eqvaina', 'A', 'Treatment for Takayasu: Vasculitis small vessel, diminished pulses in arm or leg Sed high, haptoglobin level is low- ab bind to RBC and lyse , > schistocytes Rx - low dose ... (Vignette from Dr. J notes, p20)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-02251C388C8E', 'What is the classic presentation of HHV -5?', 'Fever myalgia, joint pain', 'Roseola. Starts with fever, then rash is seen in 3 days', 'Fever, myalgia, splenomegaly, lymphadenopathy', '3-4 days of fever sore throat, myalgia, ﬂu like', 'A', 'Classic presentation of HHV -5: Fever myalgia, joint pain, (Dr. J notes, p33)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-02251C388C8E_V', 'A 30-year-old patient is brought to the ED with Fever myalgia, joint pain,. The most likely diagnosis is:', 'Fever myalgia, joint pain', 'Roseola. Starts with fever, then rash is seen in 3 days', 'Fever, myalgia, splenomegaly, lymphadenopathy', '3-4 days of fever sore throat, myalgia, ﬂu like', 'A', 'The presentation of Fever myalgia, joint pain, is classic for HHV -5. (Dr. J notes, p33)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-02E007538D65', 'What is the classic presentation of Atypical interstitial pneumonia?', 'Legionella, gastroenteritis, Decreases Na+, of diarrhea', 'After being in farms with goats, Q fever = Coxiella Brunetti', 'Capsule - typical, fast onset', 'Klebsiella = capsulated, productive pneumonia (typical), currant jelly sputum, also cause, UTI, Tertiary', 'A', 'Classic presentation of Atypical interstitial pneumonia: Legionella ,  gastroenteritis ,  Decreases Na+ ,  because of diarrhea (Dr. J notes, p48)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-02E007538D65_V', 'A 3-year-old patient presents to the clinic with Legionella ,  gastroenteritis ,  Decreases Na+ ,  because of diarrhea. Which of the following is the most likely diagnosis?', 'Legionella, gastroenteritis, Decreases Na+, of diarrhea', 'After being in farms with goats, Q fever = Coxiella Brunetti', 'Capsule - typical, fast onset', 'Klebsiella = capsulated, productive pneumonia (typical), currant jelly sputum, also cause, UTI, Tertiary', 'A', 'The presentation of Legionella ,  gastroenteritis ,  Decreases Na+ ,  because of diarrhea is classic for Atypical interstitial pneumonia. (Dr. J notes, p48)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-03E338D1E713', 'What is the treatment for Onchocerca volvulus?', 'Ivermectin', 'Tx - fecal oral', 'Praziquantel', 'Live vaccine, ages 2-4-6 months', 'A', 'Treatment for Onchocerca volvulus: Ivermectin (Dr. J notes, p40)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-041168D53330', 'What is the best diagnostic approach for CLL?', 'Smear, Smudge cells', 'TRAP positive', 'Carboxylation of clotting factors, to attract plts with negative charge', 'Smear, roulette formation, clock face chromatin', 'A', 'Diagnosis of CLL: Smear ,  Smudge cells (Dr. J notes, p114)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-041168D53330_V', 'A 70-year-old patient presents with Asymptomatic,. What is the best initial diagnostic test?', 'Smear, Smudge cells', 'TRAP positive', 'Carboxylation of clotting factors, to attract plts with negative charge', 'Smear, roulette formation, clock face chromatin', 'A', 'Diagnosis of CLL: Smear ,  Smudge cells (Vignette from Dr. J notes, p114)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0511CFBED74D', 'What is the classic presentation of Causes?', 'Rash moving towards heart', '7 1. Catalase = Break down Hydrogen peroxide (H₂O₂ + H₂O + O₂) 2', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', 'Sub acute bac endocarditis regorge murmur - mitral valve', 'A', 'Classic presentation of Causes: Rash moving towards heart (Dr. J notes, p43)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0511CFBED74D_V', 'A 3-year-old patient presents to the clinic with Rash moving towards heart. Which of the following is the most likely diagnosis?', 'Rash moving towards heart', '7 1. Catalase = Break down Hydrogen peroxide (H₂O₂ + H₂O + O₂) 2', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', 'Sub acute bac endocarditis regorge murmur - mitral valve', 'A', 'The presentation of Rash moving towards heart is classic for Causes. (Dr. J notes, p43)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-058CB1FB7749', 'What is the classic presentation of Digoxin?', 'Tachycardia, nausea, vomiting', 'Prox tachycardia, nausea, vomiting', 'Chest pain, aspirin, shortness of breath', 'Fever , nausea severe ﬂu like symptoms', 'A', 'Classic presentation of Digoxin: Tachycardia, nausea, vomiting. (Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-058CB1FB7749_V', 'A 42-year-old patient is brought to the ED with Tachycardia, nausea, vomiting.. The most likely diagnosis is:', 'Tachycardia, nausea, vomiting', 'Prox tachycardia, nausea, vomiting', 'Chest pain, aspirin, shortness of breath', 'Fever , nausea severe ﬂu like symptoms', 'A', 'The presentation of Tachycardia, nausea, vomiting. is classic for Digoxin. (Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-05AB1B0C1BAD', 'What is the classic presentation of Rota virus?', 'Com. Viral cause of diarrhea in kids', 'Diarrhea after traveling in cruise, big hotels (large crowds) buffets', 'Neuro symptoms - headache, encephalitis, meningitis', 'Dump with diarrhea, in USA, 2 possibilities', 'A', 'Classic presentation of Rota virus: Com. Viral cause of diarrhea in kids. Intussusception. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-05AB1B0C1BAD_V', 'A 30-year-old patient presents to the clinic with Com. Viral cause of diarrhea in kids. Intussusception.. Which of the following is the most likely diagnosis?', 'Com. Viral cause of diarrhea in kids', 'Diarrhea after traveling in cruise, big hotels (large crowds) buffets', 'Neuro symptoms - headache, encephalitis, meningitis', 'Dump with diarrhea, in USA, 2 possibilities', 'A', 'The presentation of Com. Viral cause of diarrhea in kids. Intussusception. is classic for Rota virus. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-05F8DA1686F7', 'What is the treatment for Steven Johnson syn?', 'Drug-induced', 'Topical permethrin or oral ivermectin (Single dose - fat sol, easier to be toxic)', 'Extensive - oral steroids, more then 2 wks we need to, 3 ADRENAL INSUFFICIENCY', 'Topical azole', 'A', 'Treatment for Steven Johnson syn: Only Due to drugs. ,  Stop the drug. Ex. - carbamazepine - use to Rx trigeminal neuralgia (Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0717BDFE84CB', 'What is the classic presentation of Cryptosporidium ,  healthy pt?', 'Watery diarrhea from fresh water', 'Dump with diarrhea, in USA, 2 possibilities', 'Fever myalgia, joint pain', 'Flu like symptoms, RUQ pain, jaundice may be, travel history Then we run labs', 'A', 'Classic presentation of Cryptosporidium ,  healthy pt: Watery diarrhea from fresh water (Dr. J notes, p40)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0717BDFE84CB_V', 'A 22-year-old patient is brought to the ED with Watery diarrhea from fresh water. The most likely diagnosis is:', 'Watery diarrhea from fresh water', 'Dump with diarrhea, in USA, 2 possibilities', 'Fever myalgia, joint pain', 'Flu like symptoms, RUQ pain, jaundice may be, travel history Then we run labs', 'A', 'The presentation of Watery diarrhea from fresh water is classic for Cryptosporidium ,  healthy pt. (Dr. J notes, p40)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0750995B92B3', 'What is the classic presentation of H vs Graft ,  T cells?', 'Oliguria, slight fever, transplanted tissue is grossly mottled', 'Oliguria, high fever, BUN and cr high, transplanted tissue is slightly mottled', 'Fatigue, easy bruising, petechia, purpura in a kid', 'Px, hematuria, joint pain, massive hemolysis', 'A', 'Classic presentation of H vs Graft ,  T cells: Oliguria, slight fever ,  transplanted tissue is grossly mottled ,  (Dr. J notes, p115)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0750995B92B3_V', 'A 60-year-old patient is brought to the ED with Oliguria, slight fever ,  transplanted tissue is grossly mottled , . The most likely diagnosis is:', 'Oliguria, slight fever, transplanted tissue is grossly mottled', 'Oliguria, high fever, BUN and cr high, transplanted tissue is slightly mottled', 'Fatigue, easy bruising, petechia, purpura in a kid', 'Px, hematuria, joint pain, massive hemolysis', 'A', 'The presentation of Oliguria, slight fever ,  transplanted tissue is grossly mottled ,  is classic for H vs Graft ,  T cells. (Dr. J notes, p115)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0796714194BB', 'What is the treatment for S. Mansoni?', 'Praziquantel', 'Acyclovir, famciclovir, for future outbreak', 'Acyclovir - needs thymidylate kinase', 'Supportive/self-limiting, Vaccine', 'A', 'Treatment for S. Mansoni: Rx praziquantel (Dr. J notes, p40)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0796714194BB_V', 'A 45-year-old patient is diagnosed with S. Mansoni. The patient presents with Liver cancer.. What is the most appropriate treatment?', 'Praziquantel', 'Acyclovir, famciclovir, for future outbreak', 'Acyclovir - needs thymidylate kinase', 'Supportive/self-limiting, Vaccine', 'A', 'Treatment for S. Mansoni: Rx praziquantel (Vignette from Dr. J notes, p40)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-084DA94BD2B1', 'What is the classic presentation of Psoriasis?', 'Auzpits sign, leison comes off and pin point bleeding', 'Scaly skin rash after infection', 'Common in older, but if many appear in short period, rule out cancer', 'Can occur anytime of the year', 'A', 'Classic presentation of Psoriasis: Auzpits sign ,  leison comes off and pin point bleeding (Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-084DA94BD2B1_V', 'A 32-year-old patient presents to the clinic with Auzpits sign ,  leison comes off and pin point bleeding. Which of the following is the most likely diagnosis?', 'Auzpits sign, leison comes off and pin point bleeding', 'Scaly skin rash after infection', 'Common in older, but if many appear in short period, rule out cancer', 'Can occur anytime of the year', 'A', 'The presentation of Auzpits sign ,  leison comes off and pin point bleeding is classic for Psoriasis. (Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-08A2D1461903', 'What is a key risk factor or cause of Dx - Monospot test?', 'Avoid contact sports, due to splenomegaly (risk of rupture)', 'Chronic, risk of cancer', 'Less likely to cause cancer, replicated in cytoplasm', 'No blindness but can cause death', 'A', 'Risk factor for Dx - Monospot test: Avoid contact sports ,  due to splenomegaly (risk of rupture). Can play when splenomegaly goes down. Hepatomegaly? (Dr. J notes, p33)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-094B83A90D99', 'What is the mechanism of Hypersensitivity?', 'Type II, cytotoxic, True autoimmune ABO & Rh', 'Bruton’s, agammaglobulinemia = X linked recessive, tyrosine kinase prob', 'Enzyme, A.D.A def', 'Ataxia telangiectasia, DNA endonuclease, enzyme', 'A', 'Mechanism of Hypersensitivity: Type II ,  cytotoxic ,  True autoimmune ABO & Rh (Dr. J notes, p87)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-09AD07930E8C', 'What is the treatment for Venous clot (painless),  stasis?', 'Heparin and warfarin', 'Aspirin, dicloccicillin, clopidogrel', 'Urokinase, when open ﬁstula, tubes', 'Except in E.R, We give Hydroxyurea to keep HbF high', 'A', 'Treatment for Venous clot (painless),  stasis: Heparin and warfarin (Dr. J notes, p107)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-09B58884FC19', 'What is the classic presentation of Crohn’s?', 'Px , Diarrhea, on and off, kidney stones, gall stones', '7 1. Catalase = Break down Hydrogen peroxide (H₂O₂ + H₂O + O₂) 2', 'Diarrhea toxin, >18hrs - Left out meat and sauces', 'Chest pain', 'A', 'Classic presentation of Crohn’s: Px , Diarrhea, on and off, kidney stones, gall stones, (Dr. J notes, p56)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-09B58884FC19_V', 'A 3-year-old patient is brought to the ED with Px , Diarrhea, on and off, kidney stones, gall stones,. The most likely diagnosis is:', 'Px , Diarrhea, on and off, kidney stones, gall stones', '7 1. Catalase = Break down Hydrogen peroxide (H₂O₂ + H₂O + O₂) 2', 'Diarrhea toxin, >18hrs - Left out meat and sauces', 'Chest pain', 'A', 'The presentation of Px , Diarrhea, on and off, kidney stones, gall stones, is classic for Crohn’s. (Dr. J notes, p56)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-09BC343FE90C', 'What is the mechanism of Skeletal muscle?', 'Use certain muscle ﬁber to speciﬁc work no autonomics, no syncytial activity = syncytial activity all muscle go', 'No sarcomeres, partial synsitial activity, to peristalsis 2° messenger for contraction = IP₃', 'CPK - creatine phosphate kinase', 'Triple VP mutation Bird peak, muscle wasting (diﬃculty releasing hand from handshake)', 'A', 'Mechanism of Skeletal muscle: Use certain muscle ﬁber to speciﬁc work no autonomics, no syncytial activity = syncytial activity all muscle go together communications ﬁbers need ... (Dr. J notes, p18)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-09DE30834236', 'What is the treatment for Hashimoto thyroiditis?', 'Anti TSH, anti microsomal, anti TPO', 'Blocks T₃, T₄ production pathway (', '> surgical remove (Thyroidectomy )', '𝝰 blockers then β blockers to avoid hypertensive crisis', 'A', 'Treatment for Hashimoto thyroiditis: Anti TSH, anti microsomal, anti TPO. Rx -- Levothyroxine- (Dr. J notes, p13)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-09DE30834236_V', 'A 45-year-old patient with known Hashimoto thyroiditis comes in with Weight loss, heat intolerance, and ﬁne tremor.. Which treatment is most appropriate?', 'Anti TSH, anti microsomal, anti TPO', 'Blocks T₃, T₄ production pathway (', '> surgical remove (Thyroidectomy )', '𝝰 blockers then β blockers to avoid hypertensive crisis', 'A', 'Treatment for Hashimoto thyroiditis: Anti TSH, anti microsomal, anti TPO. Rx -- Levothyroxine- (Vignette from Dr. J notes, p13)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0A47334D98B4', 'What is the classic presentation of Atypical pneumonia?', 'After being in farms with goats, Q fever = Coxiella Brunetti', 'Legionella, gastroenteritis, Decreases Na+, of diarrhea', 'Capsule - typical, fast onset', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', 'A', 'Classic presentation of Atypical pneumonia: After being in farms with goats, Q fever = Coxiella Brunetti (Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0A47334D98B4_V', 'A 65-year-old patient is brought to the ED with After being in farms with goats, Q fever = Coxiella Brunetti. The most likely diagnosis is:', 'After being in farms with goats, Q fever = Coxiella Brunetti', 'Legionella, gastroenteritis, Decreases Na+, of diarrhea', 'Capsule - typical, fast onset', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', 'A', 'The presentation of After being in farms with goats, Q fever = Coxiella Brunetti is classic for Atypical pneumonia. (Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0A93D56EE7CE', 'What is the best diagnostic approach for Latent autoimmune diabetes in adult?', 'Insuline Polyuria, polydipsia leading to DM leading to water deprivation test leading to concentrated Psychogenic', 'Punch biopsy', 'Non healing ulcer, ﬂaky red in lower part of face, biopsy', 'If female, pregnancy test and 2 forms of contraceptive', 'A', 'Diagnosis of Latent autoimmune diabetes in adult: Insuline Polyuria, polydipsia → DM → water deprivation test → concentrated Psychogenic polydipsia = because of drinking to much water, low Na, uvolemic (Dr. J notes, p13)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0AF43676181E', 'What is the treatment for 1° Hyperaldosterone in adult?', 'Crohn syndrome, Total Na⁺↑ Serum Na⁺↑ K⁺↓, pH ↑ (alkalic), BP↑, renin↓, Rx, spironolactone, blocks aldosteron', '> surgical remove (Thyroidectomy )', 'Defect in adrenal steroid biosynthesis', 'Topical azoles, selenium sulﬁde', 'A', 'Treatment for 1° Hyperaldosterone in adult: Crohn syndrome ,  Total Na⁺↑ Serum Na⁺↑ K⁺↓, pH ↑ (alkalic), BP↑, renin↓, Rx ,  spironolactone ,  blocks aldosteron. (Dr. J notes, p14)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0B9A68ECE14F', 'What is the mechanism of FAP?', 'Mutation of APC tumor suppressor gene on chromosome 5q21-q22', 'Autoimmune response, Gliadin', 'Receptor doesn’t upregulate enzyme', 'Sulfonamides, folic acid synthesis, inhibit metabolism', 'A', 'Mechanism of FAP: Mutation of APC tumor suppressor gene on chromosome 5q21-q22. (Dr. J notes, p57)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0DEFACEF5D52', 'What is the classic presentation of Staph. Aureus?', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', '7 1. Catalase = Break down Hydrogen peroxide (H₂O₂ + H₂O + O₂) 2', 'Sub acute bac endocarditis regorge murmur - mitral valve', 'Watery diarrhea in kids, malabsorption', 'A', 'Classic presentation of Staph. Aureus: 3 toxins1)Exfoliating exotoxin - Scalded skin syndrome ,  palms and soles rash, +ve nikolsky sign2)Endotoxin - Toxic shock syndrome ,  fever, palms a... (Dr. J notes, p42)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0DEFACEF5D52_V', 'A 40-year-old patient presents with 3 toxins1)Exfoliating exotoxin - Scalded skin syndrome ,  palms and soles rash, +ve nikolsky sign2)Endotoxin - Toxic shoc. What is the most likely diagnosis?', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', '7 1. Catalase = Break down Hydrogen peroxide (H₂O₂ + H₂O + O₂) 2', 'Sub acute bac endocarditis regorge murmur - mitral valve', 'Watery diarrhea in kids, malabsorption', 'A', 'The presentation of 3 toxins1)Exfoliating exotoxin - Scalded skin syndrome ,  palms and soles rash, +ve nikolsky sign2)Endotoxin - Toxic shoc is classic for Staph. Aureus. (Dr. J notes, p42)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0E8A60C93189', 'What is the best diagnostic approach for Echovirus?', 'Others, N. Meningitis, strep pneumonia, Echo', 'Vomiting, neck stiffness, photophobia Dx - India ink', 'PCR of CSF on DNA', 'Tzank test - Eosinophilic intranuclear inclusions', 'A', 'Diagnosis of Echovirus: Others ,  N. Meningitis, strep pneumonia, Echo. (Dr. J notes, p36)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0E94AD312607', 'What is the classic presentation of Aspirin overdose?', 'Doesn’t vomit - respi acidosis', 'Tingling, burning, local swelling', 'Fever , nausea severe ﬂu like symptoms', 'Tachycardia, nausea, vomiting', 'A', 'Classic presentation of Aspirin overdose: Doesn’t vomit - respi acidosis (Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0E94AD312607_V', 'A 50-year-old patient presents to the clinic with Doesn’t vomit - respi acidosis. Which of the following is the most likely diagnosis?', 'Doesn’t vomit - respi acidosis', 'Tingling, burning, local swelling', 'Fever , nausea severe ﬂu like symptoms', 'Tachycardia, nausea, vomiting', 'A', 'The presentation of Doesn’t vomit - respi acidosis is classic for Aspirin overdose. (Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0F44E7CD5E62', 'What is the best diagnostic approach for Platelet release calcium , > because +ve charge?', 'And clotting factors negative charge, so they are attracted to each other, hypercoagulable state', 'Most accurate test, B12 level or we check for homocysteine and methylmalonic acid', 'Smear, target cells', 'Auer rods in smear', 'A', 'Diagnosis of Platelet release calcium , > because +ve charge: And clotting factors negative charge ,  so they are attracted to each other ,  hypercoagulable state. (Dr. J notes, p107)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0F44E7CD5E62_V', 'A 70-year-old patient is evaluated for And clotting factors negative charge ,  so they are attracted to each other ,  hypercoagulable state.. Which diagnostic study should be ordered first?', 'And clotting factors negative charge, so they are attracted to each other, hypercoagulable state', 'Most accurate test, B12 level or we check for homocysteine and methylmalonic acid', 'Smear, target cells', 'Auer rods in smear', 'A', 'Diagnosis of Platelet release calcium , > because +ve charge: And clotting factors negative charge ,  so they are attracted to each other ,  hypercoagulable state. (Vignette from Dr. J notes, p107)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0F8ED811BFED', 'What is the classic presentation of Hyperlipidemia?', '↓energy state', 'Due to sphincter being weak', 'Even wind blow, pain', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', 'A', 'Classic presentation of Hyperlipidemia: ↓energy state (Dr. J notes, p55)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0F8ED811BFED_V', 'A 65-year-old patient is brought to the ED with ↓energy state. The most likely diagnosis is:', '↓energy state', 'Due to sphincter being weak', 'Even wind blow, pain', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', 'A', 'The presentation of ↓energy state is classic for Hyperlipidemia. (Dr. J notes, p55)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0FD1093D5DB9', 'What is a key risk factor or cause of Type I diabetes?', 'Genetic = HLA DR₃, DR₄', 'Genetic, as obesity is genetic, Type II diabetes can also be seen as genetic', 'At gland - parathyroid adenoma Ca⁺↑, PO₄⁺↓, PTH↑ Chief cell adenoma of parathyroid', '↓ 21𝝰 hydroxylase, ↑17-Hydroxy pro', 'A', 'Risk factor for Type I diabetes: Genetic = HLA DR₃, DR₄ (Dr. J notes, p12)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-0FFA4AFC8C17', 'What is a key risk factor or cause of Pseudomonas?', 'Cystic ﬁbrosis, cause pneumonia after 20', 'PH alkalotic, risk for staghorn calculi', 'Pylori, NSAIDs, spicy food', 'Genetic or trauma (car accident steering hit)', 'A', 'Risk factor for Pseudomonas: Cystic ﬁbrosis ,  cause pneumonia after 20 (Dr. J notes, p47)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-11096A9EEFF9', 'What is the best diagnostic approach for Multiple myeloid?', 'Roulette forms, blood smear', 'TRAP cell positive', 'Lab, hypoglycemia, hypocalcemia', 'Biopsy test = reed Stemberg cells', 'A', 'Diagnosis of Multiple myeloid: Roulette forms ,  blood smear (Dr. J notes, p84)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-11096A9EEFF9_V', 'A 42-year-old patient is evaluated for Chronic back pain. Which diagnostic study should be ordered first?', 'Roulette forms, blood smear', 'TRAP cell positive', 'Lab, hypoglycemia, hypocalcemia', 'Biopsy test = reed Stemberg cells', 'A', 'Diagnosis of Multiple myeloid: Roulette forms ,  blood smear (Vignette from Dr. J notes, p84)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-121F98C7CFDA', 'What is a key risk factor or cause of Streptococcus Pyogenes?', 'Other bugs cause NF, staph Aureus and Clostridium perfringens', 'Genetic = HLA DR₃, DR₄', 'In pregnancy, can cause hydrops fetalis', 'New leison, cause psoriasis in that location, Koebner phenomenon', 'A', 'Risk factor for Streptococcus Pyogenes: Other bugs cause NF ,  staph Aureus and Clostridium perfringens (Dr. J notes, p3)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1258FD156CF7', 'What is the classic presentation of Young pt?', 'Severe back pain , worse with lean down, fever, ↑HR, ↓BP = spinal abscess', 'Back pain, more when lean down, > 65yo leading to 3 diffrenciations = multiple myeloma, tumor, metastasis', 'Pain, tenderness, tibial tubro', 'Pain and swelling, fever, warmness & redness in that area Most common bug - Steph Aureus, sickle cell - salmonella', 'A', 'Classic presentation of Young pt: Severe back pain , worse with lean down, fever, ↑HR, ↓BP = spinal abscess (Dr. J notes, p23)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1258FD156CF7_V', 'A 55-year-old patient presents with Severe back pain , worse with lean down, fever, ↑HR, ↓BP = spinal abscess. What is the most likely diagnosis?', 'Severe back pain , worse with lean down, fever, ↑HR, ↓BP = spinal abscess', 'Back pain, more when lean down, > 65yo leading to 3 diffrenciations = multiple myeloma, tumor, metastasis', 'Pain, tenderness, tibial tubro', 'Pain and swelling, fever, warmness & redness in that area Most common bug - Steph Aureus, sickle cell - salmonella', 'A', 'The presentation of Severe back pain , worse with lean down, fever, ↑HR, ↓BP = spinal abscess is classic for Young pt. (Dr. J notes, p23)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-12E568694324', 'What is a key risk factor or cause of Type II diabetes?', 'Genetic, as obesity is genetic, Type II diabetes can also be seen as genetic', 'Genetic = HLA DR₃, DR₄', 'At gland - parathyroid adenoma Ca⁺↑, PO₄⁺↓, PTH↑ Chief cell adenoma of parathyroid', 'In pregnancy, can cause hydrops fetalis', 'A', 'Risk factor for Type II diabetes: Genetic ,  as obesity is genetic, Type II diabetes can also be seen as genetic. But obesity is preventable (Dr. J notes, p12)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-13D470FE7BBD', 'What is the treatment for Von Willebrand factor?', 'Mild, Rx, vasopressin, V1 on blood vessels, V2 in kidney (aquaporins)', 'Give if PT and PTT ↑', 'Iron + vit C', 'B6 supplement, underlying cause if any', 'A', 'Treatment for Von Willebrand factor: Mild ,  Rx ,  vasopressin ,  V1 on blood vessels, V2 in kidney (aquaporins) (Dr. J notes, p108)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-13D470FE7BBD_V', 'A 25-year-old patient with known Von Willebrand factor comes in with Bleeding disorder - joints & cavities. Also skin & mucosa. Which treatment is most appropriate?', 'Mild, Rx, vasopressin, V1 on blood vessels, V2 in kidney (aquaporins)', 'Give if PT and PTT ↑', 'Iron + vit C', 'B6 supplement, underlying cause if any', 'A', 'Treatment for Von Willebrand factor: Mild ,  Rx ,  vasopressin ,  V1 on blood vessels, V2 in kidney (aquaporins) (Vignette from Dr. J notes, p108)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-13F64AEF586A', 'What is the classic presentation of Salmonella?', 'Pea soup colored diarrhea', 'Even wind blow, pain', 'New onset of diabetes and arthritis, restrictive cardiomyopathy', 'Diarrhea, metabolic acidosis, DKA, RTA, 2', 'A', 'Classic presentation of Salmonella: Pea soup colored diarrhea (Dr. J notes, p47)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-13F64AEF586A_V', 'A 40-year-old patient presents with Pea soup colored diarrhea. What is the most likely diagnosis?', 'Pea soup colored diarrhea', 'Even wind blow, pain', 'New onset of diabetes and arthritis, restrictive cardiomyopathy', 'Diarrhea, metabolic acidosis, DKA, RTA, 2', 'A', 'The presentation of Pea soup colored diarrhea is classic for Salmonella. (Dr. J notes, p47)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-140AA85CFA43', 'What is the treatment for Brown recluse spider?', 'Dapsone, debridement', 'Iv ca 2 gluconate + anti venom', 'Rx., debridement, lots of ﬂuids, diuretics, mannitol', 'Benzo (short acting), liver issues Benzo, long acting, if no liver damage', 'A', 'Treatment for Brown recluse spider: Rx ,  Dapsone, debridement (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-140AA85CFA43_V', 'A 60-year-old patient with known Brown recluse spider comes in with Fever , nausea severe ﬂu like symptoms. Which treatment is most appropriate?', 'Dapsone, debridement', 'Iv ca 2 gluconate + anti venom', 'Rx., debridement, lots of ﬂuids, diuretics, mannitol', 'Benzo (short acting), liver issues Benzo, long acting, if no liver damage', 'A', 'Treatment for Brown recluse spider: Rx ,  Dapsone, debridement (Vignette from Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-15A684CF452B', 'What is the best diagnostic approach for HIV + Toxo (encephalitis) confusion?', 'Neck stiffness, photophobia, altered mental status', 'Location stimulated by dopamine Respond to taste and smell.Sturge weber syndrome, neurocutenous', 'Symptomatic, ataxia, spingomyelia, pain and temperature loss bilateral', 'Greasy appearancePt with headache, precocious puberty, bitemporal hemianopsia + loss of upper gaze, Pinealoma Stroke', 'A', 'Diagnosis of HIV + Toxo (encephalitis) confusion: Neck stiffness, photophobia, altered mental status. Starts with euro symp. ,  Toxo ,  ring enhancing lesion in the Brain CT. (Dr. J notes, p139)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-15A684CF452B_V', 'A 45-year-old patient presents with Neck stiffness, photophobia, altered mental status. Starts with euro symp. ,  Toxo ,  ring enhancing lesion in the Brain C. What is the most accurate diagnostic approach?', 'Neck stiffness, photophobia, altered mental status', 'Location stimulated by dopamine Respond to taste and smell.Sturge weber syndrome, neurocutenous', 'Symptomatic, ataxia, spingomyelia, pain and temperature loss bilateral', 'Greasy appearancePt with headache, precocious puberty, bitemporal hemianopsia + loss of upper gaze, Pinealoma Stroke', 'A', 'Diagnosis of HIV + Toxo (encephalitis) confusion: Neck stiffness, photophobia, altered mental status. Starts with euro symp. ,  Toxo ,  ring enhancing lesion in the Brain CT. (Vignette from Dr. J notes, p139)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-17EC734B5A23', 'What is the classic presentation of Erythema infectiosum?', 'Fever, malaise, fatigue', 'Pain, photophobia, lacrimation Herpes infection', 'Red ﬂaky, non-tender, sun exposed area', 'Can occur anytime of the year', 'A', 'Classic presentation of Erythema infectiosum: Fever, malaise, fatigue (Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-17EC734B5A23_V', 'A 45-year-old patient presents with Fever, malaise, fatigue. What is the most likely diagnosis?', 'Fever, malaise, fatigue', 'Pain, photophobia, lacrimation Herpes infection', 'Red ﬂaky, non-tender, sun exposed area', 'Can occur anytime of the year', 'A', 'The presentation of Fever, malaise, fatigue is classic for Erythema infectiosum. (Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-18A59BA35D26', 'What is the treatment for Retinal detachment?', 'Painless vision loss, unilateral ﬂoaters, sees half of you', 'Replace lens, type 4 collagen in lens', 'No pain, when looks sideways', 'Steroids, IVIg', 'A', 'Treatment for Retinal detachment: Painless vision loss, unilateral ﬂoaters, sees half of you. Rx - Surgery to reattach it (Dr. J notes, p7)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-18A59BA35D26_V', 'A 22-year-old patient with Retinal detachment presents with Painless vision loss, unilateral ﬂoaters, sees half of you. Rx - Surgery to reattach it. What is the best initial treatment?', 'Painless vision loss, unilateral ﬂoaters, sees half of you', 'Replace lens, type 4 collagen in lens', 'No pain, when looks sideways', 'Steroids, IVIg', 'A', 'Treatment for Retinal detachment: Painless vision loss, unilateral ﬂoaters, sees half of you. Rx - Surgery to reattach it (Vignette from Dr. J notes, p7)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-18B29908C07B', 'What is the best diagnostic approach for Severe Hypothermia ,  ↓HR?', 'EKG, J wave, Osler wave', 'Die of cardiac arrested x-ray - white out', 'EKG, X-RAY', 'Dx , EM - Negri body', 'A', 'Diagnosis of Severe Hypothermia ,  ↓HR: EKG ,  J wave, Osler wave (Dr. J notes, p27)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1953492F5681', 'What is the best diagnostic approach for SLE?', 'Sensitive test = ANA - anti nuclear antibody', '20-40yo, connective tissue problem Loss of wrinkles, tight skin, ﬁnger tip pitting BP = ↑↑, S₄, Esophagus', '> 55yo, mono articular, Previous damaged joint, big joint Analysis, + Ve birefringent crystals of Ca⁺ pyrophosphate', '30yo, Back pain mostly in the morning X-ray, vertebrae fuse to gather, bamboos', 'A', 'Diagnosis of SLE: Sensitive test = ANA - anti nuclear antibody (Dr. J notes, p20)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1953492F5681_V', 'A 28-year-old patient is evaluated for Fatigue, malar rash, joint pain, painless ulcer oral. Which diagnostic study should be ordered first?', 'Sensitive test = ANA - anti nuclear antibody', '20-40yo, connective tissue problem Loss of wrinkles, tight skin, ﬁnger tip pitting BP = ↑↑, S₄, Esophagus', '> 55yo, mono articular, Previous damaged joint, big joint Analysis, + Ve birefringent crystals of Ca⁺ pyrophosphate', '30yo, Back pain mostly in the morning X-ray, vertebrae fuse to gather, bamboos', 'A', 'Diagnosis of SLE: Sensitive test = ANA - anti nuclear antibody (Vignette from Dr. J notes, p20)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1AAEB16306B8', 'What is the mechanism of HSV-2?', 'Cidofovir, foscarnate, doesn’t require thymidine kinase', 'Acyclovir, needs thymidine kinase to work, except Cidofovir and foscarnet', 'Ganciclovir, or foscarnet (no need of Thymidine kinase enzyme)', 'Circular, only hepatitis virus that is DNA virus and has Reverse transcriptase enzyme', 'A', 'Mechanism of HSV-2: Cidofovir, foscarnate ,  doesn’t require thymidine kinase (Dr. J notes, p32)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1B4FAC695E6C', 'What is the classic presentation of GERD?', 'Due to sphincter being weak', 'Even wind blow, pain', 'Itching, fatigue', 'Baby + at birth, jaundice', 'A', 'Classic presentation of GERD: Due to sphincter being weak (Dr. J notes, p51)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1B4FAC695E6C_V', 'A 65-year-old patient presents with Due to sphincter being weak. What is the most likely diagnosis?', 'Due to sphincter being weak', 'Even wind blow, pain', 'Itching, fatigue', 'Baby + at birth, jaundice', 'A', 'The presentation of Due to sphincter being weak is classic for GERD. (Dr. J notes, p51)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1CDBFE2969EF', 'What is the classic presentation of Tinea capitis?', 'If no hat, same Px, alopecia', 'Can occur anytime of the year', '+ve nikolsky sign, may not be present if smoking', 'Positive nikalosky sign', 'A', 'Classic presentation of Tinea capitis: If no hat, same Px ,  alopecia (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1CDBFE2969EF_V', 'A 70-year-old patient is brought to the ED with If no hat, same Px ,  alopecia. The most likely diagnosis is:', 'If no hat, same Px, alopecia', 'Can occur anytime of the year', '+ve nikolsky sign, may not be present if smoking', 'Positive nikalosky sign', 'A', 'The presentation of If no hat, same Px ,  alopecia is classic for Tinea capitis. (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1D3D005C4ECB', 'What is the best diagnostic approach for Diabetic retinopathy , ?', 'Wet type, due to neovascularization, blurry vision If non proliferative, no vision effects VEG-F inhibitors', 'Insuline Polyuria, polydipsia leading to DM leading to water deprivation test leading to concentrated Psychogenic', 'Slit lamp test', 'Biopsy, and local excision', 'A', 'Diagnosis of Diabetic retinopathy , : Wet type ,  due to neovascularization ,  blurry vision If non proliferative ,  no vision effects VEG-F inhibitors. Dx- Woods lamp (Dr. J notes, p7)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1DC76012F360', 'What is a key risk factor or cause of Achalasia?', 'If in baby, non migration of Auerbach plex, congenital', 'Risk of squamous cell carcinoma - alcoholism, smoking', 'UTIs, Pyelonephritis, cystitis', 'PH alkalotic, risk for staghorn calculi', 'A', 'Risk factor for Achalasia: If in baby ,  non migration of Auerbach plex ,  congenital. (Dr. J notes, p51)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1DE4730291DD', 'What is the classic presentation of Neisseria Meningitidis?', 'Neck stiffness, photophobia, nausea, Vomiting', 'Sub acute bac endocarditis regorge murmur - mitral valve', 'Itching, fatigue', 'Watery diarrhea in kids, malabsorption', 'A', 'Classic presentation of Neisseria Meningitidis: Cause = neck stiffness, photophobia, nausea, Vomiting (Dr. J notes, p45)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1DE4730291DD_V', 'A 3-year-old patient presents with Cause = neck stiffness, photophobia, nausea, Vomiting. What is the most likely diagnosis?', 'Neck stiffness, photophobia, nausea, Vomiting', 'Sub acute bac endocarditis regorge murmur - mitral valve', 'Itching, fatigue', 'Watery diarrhea in kids, malabsorption', 'A', 'The presentation of Cause = neck stiffness, photophobia, nausea, Vomiting is classic for Neisseria Meningitidis. (Dr. J notes, p45)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1DF037021E76', 'What is the treatment for 45Yo pt?', 'Went to vagus drink alcohol to much, acute gout', 'History of duodenal ulcer - acute gout', 'MRSTCS mix connective tissue, RA, SLE, takayasu, CREST, Scleroderma,', 'Calcinosis cutis, raynaud’s phenomenon, esophageal dysmotility, sclerodactyly, telangiectasis Anti centromere antibody', 'A', 'Treatment for 45Yo pt: Went to vagus drink alcohol to much ,  acute gout Rx = NSAIDs, S/E = not give to old age (Dr. J notes, p22)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1DF037021E76_V', 'A 28-year-old patient with known 45Yo pt comes in with Went to vagus drink alcohol to much ,  acute gout Rx = NSAIDs, S/E = not give to old age. Which treatment is most appropriate?', 'Went to vagus drink alcohol to much, acute gout', 'History of duodenal ulcer - acute gout', 'MRSTCS mix connective tissue, RA, SLE, takayasu, CREST, Scleroderma,', 'Calcinosis cutis, raynaud’s phenomenon, esophageal dysmotility, sclerodactyly, telangiectasis Anti centromere antibody', 'A', 'Treatment for 45Yo pt: Went to vagus drink alcohol to much ,  acute gout Rx = NSAIDs, S/E = not give to old age (Vignette from Dr. J notes, p22)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1E04B0FD514E', 'What is the mechanism of Calcitonin?', 'Inhibit osteoclast - JOB', 'Insulin comes from β cells, inhibit by glucagon', 'Single gene point mutation', '↑ sugar, receptor on cytoplasm', 'A', 'Mechanism of Calcitonin: Inhibit osteoclast - JOB (Dr. J notes, p10)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1F1F8DBE6742', 'What is the best diagnostic approach for Rheumatoid arthritis?', 'X-ray, erosion (inﬂammation)', 'Shoes not ﬁt, headaches, hearing problem, test - IGF ↑, conductive hearing loss, GH, rx - octriotide in kids, Gigantism', '30yo, Back pain mostly in the morning X-ray, vertebrae fuse to gather, bamboos', '20-40yo, connective tissue problem Loss of wrinkles, tight skin, ﬁnger tip pitting BP = ↑↑, S₄, Esophagus', 'A', 'Diagnosis of Rheumatoid arthritis: X-ray ,  erosion (inﬂammation) (Dr. J notes, p21)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1F1F8DBE6742_V', 'A 65-year-old patient presents with Bilateral Joints pain & stiff in morning. What is the best initial diagnostic test?', 'X-ray, erosion (inﬂammation)', 'Shoes not ﬁt, headaches, hearing problem, test - IGF ↑, conductive hearing loss, GH, rx - octriotide in kids, Gigantism', '30yo, Back pain mostly in the morning X-ray, vertebrae fuse to gather, bamboos', '20-40yo, connective tissue problem Loss of wrinkles, tight skin, ﬁnger tip pitting BP = ↑↑, S₄, Esophagus', 'A', 'Diagnosis of Rheumatoid arthritis: X-ray ,  erosion (inﬂammation) (Vignette from Dr. J notes, p21)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1F4A802CFB33', 'What is the best diagnostic approach for Warm Auto immune hemolysis (AIH)?', 'Smear, spherocytes', 'Rituximab, PPD +ve, do x-ray', 'Smear, roulette formation, clock face chromatin', 'TRAP positive', 'A', 'Diagnosis of Warm Auto immune hemolysis (AIH): Smear ,  spherocytes (Dr. J notes, p112)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-1FCA0E727AF3', 'What is a key risk factor or cause of Brain tumor with best prognosis?', 'Meningioma, brain growing around mass, Psammoma body Ependymoma, brain tumor in children', 'Symptomatic, ataxia, spingomyelia, pain and temperature loss bilateral', 'Need vit A to make CSF enzyme - carbonic anhydrase, acetazolamide inhibits carbonic anhydrase CSF acidic in blood', 'Tingling 1ˢᵗ 3 ﬁngers', 'A', 'Risk factor for Brain tumor with best prognosis: Meningioma ,  brain growing around mass ,  Psammoma body Ependymoma ,  brain tumor in children ,  cause communicating hydrocephalus - ependymal cells i... (Dr. J notes, p140)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2037C7BB7FBA', 'What is the classic presentation of More likely Depolarize?', 'Confusion, psychosis, tachycardia, arrhythmia, Diarrhea followed by constipation, tetany and spasm', 'Silvery rash Osteophytes', 'Tingling 1ˢᵗ 3 ﬁngers', '> 50yo, Back pain, hat not ﬁt, hearing problem Alk phosphate ↑, X-ray sclerotic lessions', 'A', 'Classic presentation of More likely Depolarize: Confusion, psychosis ,  tachycardia, arrhythmia ,  Diarrhea followed by constipation ,  tetany and spasm (Dr. J notes, p17)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2037C7BB7FBA_V', 'A 75-year-old patient presents to the clinic with Confusion, psychosis ,  tachycardia, arrhythmia ,  Diarrhea followed by constipation ,  tetany and spasm. Which of the following is the most likely diagnosis?', 'Confusion, psychosis, tachycardia, arrhythmia, Diarrhea followed by constipation, tetany and spasm', 'Silvery rash Osteophytes', 'Tingling 1ˢᵗ 3 ﬁngers', '> 50yo, Back pain, hat not ﬁt, hearing problem Alk phosphate ↑, X-ray sclerotic lessions', 'A', 'The presentation of Confusion, psychosis ,  tachycardia, arrhythmia ,  Diarrhea followed by constipation ,  tetany and spasm is classic for More likely Depolarize. (Dr. J notes, p17)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-209B2386A04E', 'What is the classic presentation of Pt has diabetic Neutropenic Alcoholic get pneumonia Top 2 bugs?', 'Klebsiella = capsulated, productive pneumonia (typical), currant jelly sputum, also cause, UTI, Tertiary', 'After being in farms with goats, Q fever = Coxiella Brunetti', 'Legionella, gastroenteritis, Decreases Na+, of diarrhea', 'Watery diarrhea', 'A', 'Classic presentation of Pt has diabetic Neutropenic Alcoholic get pneumonia Top 2 bugs: Klebsiella = capsulated, productive pneumonia (typical), currant jelly sputum, also cause ,  UTI, Tertiary (Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-209B2386A04E_V', 'A 3-year-old patient presents with Klebsiella = capsulated, productive pneumonia (typical), currant jelly sputum, also cause ,  UTI, Tertiary. What is the most likely diagnosis?', 'Klebsiella = capsulated, productive pneumonia (typical), currant jelly sputum, also cause, UTI, Tertiary', 'After being in farms with goats, Q fever = Coxiella Brunetti', 'Legionella, gastroenteritis, Decreases Na+, of diarrhea', 'Watery diarrhea', 'A', 'The presentation of Klebsiella = capsulated, productive pneumonia (typical), currant jelly sputum, also cause ,  UTI, Tertiary is classic for Pt has diabetic Neutropenic Alcoholic get pneumonia Top 2 bugs. (Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-20F150F9A620', 'What is the best diagnostic approach for Rabies?', 'Dx , EM - Negri body', 'EKG, X-RAY', 'EKG, J wave, Osler wave', 'Die of cardiac arrested x-ray - white out', 'A', 'Diagnosis of Rabies: Dx , EM - Negri body (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-20F150F9A620_V', 'A 50-year-old patient presents with Px ,  confusion, fuming from mouth, hydrophobia, hypersalivation. What is the best initial diagnostic test?', 'Dx , EM - Negri body', 'EKG, X-RAY', 'EKG, J wave, Osler wave', 'Die of cardiac arrested x-ray - white out', 'A', 'Diagnosis of Rabies: Dx , EM - Negri body (Vignette from Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-21C19BB87E0C', 'What is the treatment for Salmonella?', 'Dont treat', 'Gabapentin TCA', 'O2, debridement, IV antibiotics', 'Nifurtimox, Benznidazole - chagas', 'A', 'Treatment for Salmonella: Rx ,  Dont treat. If treated,  Infection to gall bladder (Dr. J notes, p47)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-21C19BB87E0C_V', 'A 28-year-old patient with Salmonella presents with Pea soup colored diarrhea. What is the best initial treatment?', 'Dont treat', 'Gabapentin TCA', 'O2, debridement, IV antibiotics', 'Nifurtimox, Benznidazole - chagas', 'A', 'Treatment for Salmonella: Rx ,  Dont treat. If treated,  Infection to gall bladder (Vignette from Dr. J notes, p47)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-21D742E62F6A', 'What is the classic presentation of 1°sclerosing (hardening) cholangitis ,  20?', 'Itching, fatigue', 'Severe abdominal pain radiating to the back, vomiting', 'Bloody diarrhea, abd pain, No vit def, erythema nodosum', 'Px , Diarrhea, on and off, kidney stones, gall stones', 'A', 'Classic presentation of 1°sclerosing (hardening) cholangitis ,  20: Itching, fatigue (Dr. J notes, p57)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-21D742E62F6A_V', 'A 28-year-old patient presents with Itching, fatigue. What is the most likely diagnosis?', 'Itching, fatigue', 'Severe abdominal pain radiating to the back, vomiting', 'Bloody diarrhea, abd pain, No vit def, erythema nodosum', 'Px , Diarrhea, on and off, kidney stones, gall stones', 'A', 'The presentation of Itching, fatigue is classic for 1°sclerosing (hardening) cholangitis ,  20. (Dr. J notes, p57)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-21D74716BF8D', 'What is the treatment for Heparin induced thrombocytopenia II (HIT II)?', 'Stop heparin factor 10, agartroban', 'None', 'Severe, splenectomy', 'Aspirin induced asthma, bronchospasm due to', 'A', 'Treatment for Heparin induced thrombocytopenia II (HIT II): Stop heparin factor 10, agartroban. (Dr. J notes, p108)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2292B6E13759', 'What is the classic presentation of B3 ,  dehydrogenases need NAD/FAD Forgetfulness?', 'Lose stools, dry skin Dementia diarrhea Dermatitis', 'Pale skin + red hair, bunch of rash, core face, S.A inf', 'B cells and neutrophils, gets sick quicker, High fever', 'Chronic back pain', 'A', 'Classic presentation of B3 ,  dehydrogenases need NAD/FAD Forgetfulness: Lose stools, dry skin Dementia diarrhea Dermatitis (Dr. J notes, p103)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2292B6E13759_V', 'A 25-year-old patient presents to the clinic with Lose stools, dry skin Dementia diarrhea Dermatitis. Which of the following is the most likely diagnosis?', 'Lose stools, dry skin Dementia diarrhea Dermatitis', 'Pale skin + red hair, bunch of rash, core face, S.A inf', 'B cells and neutrophils, gets sick quicker, High fever', 'Chronic back pain', 'A', 'The presentation of Lose stools, dry skin Dementia diarrhea Dermatitis is classic for B3 ,  dehydrogenases need NAD/FAD Forgetfulness. (Dr. J notes, p103)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-231B7029E708', 'What is the classic presentation of Brown recluse spider?', 'Fever , nausea severe ﬂu like symptoms', 'Tingling, burning, local swelling', 'Big ones, tingling pain Rx, Antihistamine, HTZ cream', 'Chest pain, aspirin, shortness of breath', 'A', 'Classic presentation of Brown recluse spider: Fever , nausea severe ﬂu like symptoms (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-231B7029E708_V', 'A 42-year-old patient presents to the clinic with Fever , nausea severe ﬂu like symptoms. Which of the following is the most likely diagnosis?', 'Fever , nausea severe ﬂu like symptoms', 'Tingling, burning, local swelling', 'Big ones, tingling pain Rx, Antihistamine, HTZ cream', 'Chest pain, aspirin, shortness of breath', 'A', 'The presentation of Fever , nausea severe ﬂu like symptoms is classic for Brown recluse spider. (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-23A12FF4DAC8', 'What is the treatment for pneumocystis jiroveci?', 'TMP-SMX, if allergic we give pentamidine', 'Albendazole', 'Aggressive, Rota (Vaccine every 2 months in kids unto 6 months), inﬂuenza A', 'Is supportive', 'A', 'Treatment for pneumocystis jiroveci: TMP-SMX, if allergic we give pentamidine. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-23A12FF4DAC8_V', 'A 8-year-old patient with pneumocystis jiroveci presents with Fatigue, shortness of breath ,  MCC of death.. What is the best initial treatment?', 'TMP-SMX, if allergic we give pentamidine', 'Albendazole', 'Aggressive, Rota (Vaccine every 2 months in kids unto 6 months), inﬂuenza A', 'Is supportive', 'A', 'Treatment for pneumocystis jiroveci: TMP-SMX, if allergic we give pentamidine. (Vignette from Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-24235909C011', 'What is the treatment for Fresh frozen plasma?', 'Give it when we can’t wait for vit', 'No sweating, ↑104°F , Dry & warm body, IV ﬂuid, cool down, clonazepam.Shock, Warm, septic, neurogenic Cool', 'Give with Ⓝ saline', 'Dapsone, debridement', 'A', 'Treatment for Fresh frozen plasma: Give it when we can’t wait for vit. K (Dr. J notes, p27)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-24DC1547D6FE', 'What is the treatment for Amphetamine , overdose?', 'Antidepressant, lorazepam', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'Constipation, pin point pupils, slow speech, impaired memory', 'Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures', 'A', 'Treatment for Amphetamine , overdose: Antidepressant, lorazepam (Dr. J notes, p61)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-24DC1547D6FE_V', 'A 45-year-old patient with known Amphetamine , overdose comes in with Agitation. Which treatment is most appropriate?', 'Antidepressant, lorazepam', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'Constipation, pin point pupils, slow speech, impaired memory', 'Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures', 'A', 'Treatment for Amphetamine , overdose: Antidepressant, lorazepam (Vignette from Dr. J notes, p61)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-24DF43A27FFF', 'What is the treatment for Chronic?', 'Must remove organ', 'Eculizumab, blocks C5a, blocks complement', 'Underlying cause', 'Hydroxy urea', 'A', 'Treatment for Chronic: Must remove organ (Dr. J notes, p115)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2516AF71C6C7', 'What is the best diagnostic approach for DiGeorge?', 'Lab, hypoglycemia, hypocalcemia', 'Biopsy test = reed Stemberg cells', 'Roulette forms, blood smear', 'Protein level = normal to low', 'A', 'Diagnosis of DiGeorge: Lab ,  hypoglycemia, hypocalcemia (Dr. J notes, p83)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2516AF71C6C7_V', 'A 8-year-old patient presents with > T cells, inf. Parathyroid. 22q11. What is the best initial diagnostic test?', 'Lab, hypoglycemia, hypocalcemia', 'Biopsy test = reed Stemberg cells', 'Roulette forms, blood smear', 'Protein level = normal to low', 'A', 'Diagnosis of DiGeorge: Lab ,  hypoglycemia, hypocalcemia (Vignette from Dr. J notes, p83)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-25B429270F03', 'What is the treatment for Digoxin?', 'Digoxin ab', 'Due P450 , > DH feb', 'No sweating, ↑104°F , Dry & warm body, IV ﬂuid, cool down, clonazepam.Shock, Warm, septic, neurogenic Cool', 'Mild hypothermia, loopy/talking, Rx, Electrolytes, IV/oral ﬂuids', 'A', 'Treatment for Digoxin: Digoxin ab (Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-25B429270F03_V', 'A 25-year-old patient with known Digoxin comes in with Tachycardia, nausea, vomiting.. Which treatment is most appropriate?', 'Digoxin ab', 'Due P450 , > DH feb', 'No sweating, ↑104°F , Dry & warm body, IV ﬂuid, cool down, clonazepam.Shock, Warm, septic, neurogenic Cool', 'Mild hypothermia, loopy/talking, Rx, Electrolytes, IV/oral ﬂuids', 'A', 'Treatment for Digoxin: Digoxin ab (Vignette from Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-25C2614C8BD7', 'What is the treatment for Fresh frozen plasma?', 'Give if PT and PTT ↑', 'Must remove organ', 'B6 supplement, underlying cause if any', 'Supplement B12, vegans, and pts with bariatric Sx', 'A', 'Treatment for Fresh frozen plasma: Give if PT and PTT ↑ (Dr. J notes, p108)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-25C2614C8BD7_V', 'A 25-year-old patient with known Fresh frozen plasma comes in with Give if PT and PTT ↑. Which treatment is most appropriate?', 'Give if PT and PTT ↑', 'Must remove organ', 'B6 supplement, underlying cause if any', 'Supplement B12, vegans, and pts with bariatric Sx', 'A', 'Treatment for Fresh frozen plasma: Give if PT and PTT ↑ (Vignette from Dr. J notes, p108)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-25C93B4D4692', 'What is the classic presentation of HHV-6,7?', 'Roseola. Starts with fever, then rash is seen in 3 days', 'Fever, myalgia, splenomegaly, lymphadenopathy', 'Purple papules', 'Vesicles in various stages of healing', 'A', 'Classic presentation of HHV-6,7: Roseola. Starts with fever, then rash is seen in 3 days. (Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-25C93B4D4692_V', 'A 8-year-old patient presents to the clinic with Roseola. Starts with fever, then rash is seen in 3 days.. Which of the following is the most likely diagnosis?', 'Roseola. Starts with fever, then rash is seen in 3 days', 'Fever, myalgia, splenomegaly, lymphadenopathy', 'Purple papules', 'Vesicles in various stages of healing', 'A', 'The presentation of Roseola. Starts with fever, then rash is seen in 3 days. is classic for HHV-6,7. (Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-25F12B843CEC', 'What is the best diagnostic approach for Sideroblastic anemia?', 'B.M biopsy, perssion blue stain', 'Blue iron stain in smear', 'Best initial Diagnostic, Iron study, High TIBC', 'Auer rods in smear', 'A', 'Diagnosis of Sideroblastic anemia: Most accurate,  B.M biopsy, perssion blue stain. TIBC low to normal because all bind up (Dr. J notes, p110)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-283D8D9EEE32', 'What is the best diagnostic approach for Thalassemia?', 'Smear, target cells', 'B.M biopsy, perssion blue stain', 'Blue iron stain in smear', 'B.I, biopsy, reed stern berg cells', 'A', 'Diagnosis of Thalassemia: Smear ,  target cells (Dr. J notes, p110)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-28CFEE9E0BDC', 'What is the treatment for Aspirin overdose?', 'Charcoal', 'Slur speech withdrawal, mydriasis, yawning, lacrimation', 'Antidepressant, lorazepam', 'Dapsone, debridement', 'A', 'Treatment for Aspirin overdose: Rx ,  Charcoal (Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-28CFEE9E0BDC_V', 'A 42-year-old patient with Aspirin overdose presents with Doesn’t vomit - respi acidosis. What is the best initial treatment?', 'Charcoal', 'Slur speech withdrawal, mydriasis, yawning, lacrimation', 'Antidepressant, lorazepam', 'Dapsone, debridement', 'A', 'Treatment for Aspirin overdose: Rx ,  Charcoal (Vignette from Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2996E478D1E6', 'What is the best diagnostic approach for G6PD?', 'In smear, Heinz bodies', 'B.I, biopsy, reed stern berg cells', 'Most accurate test, B12 level or we check for homocysteine and methylmalonic acid', 'Smear, Smudge cells', 'A', 'Diagnosis of G6PD: In smear ,  Heinz bodies (Dr. J notes, p113)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2996E478D1E6_V', 'A 35-year-old patient is evaluated for Px ,  hematuria, joint pain, massive hemolysis. Which diagnostic study should be ordered first?', 'In smear, Heinz bodies', 'B.I, biopsy, reed stern berg cells', 'Most accurate test, B12 level or we check for homocysteine and methylmalonic acid', 'Smear, Smudge cells', 'A', 'Diagnosis of G6PD: In smear ,  Heinz bodies (Vignette from Dr. J notes, p113)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2A0DD8F8DF2A', 'What is the classic presentation of Ebola ,  Tx?', '3-4 days of fever sore throat, myalgia, ﬂu like', 'Black vomitus (due to blood), high fever and severe liver damage', 'Fever, Periventricular lymphadenopathy', 'Diarrhea after traveling in cruise, big hotels (large crowds) buffets', 'A', 'Classic presentation of Ebola ,  Tx: 3-4 days of fever sore throat, myalgia, ﬂu like (Dr. J notes, p38)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2A0DD8F8DF2A_V', 'A 8-year-old patient is brought to the ED with 3-4 days of fever sore throat, myalgia, ﬂu like. The most likely diagnosis is:', '3-4 days of fever sore throat, myalgia, ﬂu like', 'Black vomitus (due to blood), high fever and severe liver damage', 'Fever, Periventricular lymphadenopathy', 'Diarrhea after traveling in cruise, big hotels (large crowds) buffets', 'A', 'The presentation of 3-4 days of fever sore throat, myalgia, ﬂu like is classic for Ebola ,  Tx. (Dr. J notes, p38)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2A3869A681F4', 'What is the treatment for Anemia due to chronic disease?', 'Underlying cause', 'B6 supplement, underlying cause if any', 'Hydroxy urea', 'Heparin and warfarin', 'A', 'Treatment for Anemia due to chronic disease: Rx ,  Underlying cause (Dr. J notes, p110)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2A3869A681F4_V', 'A 60-year-old patient with Anemia due to chronic disease presents with In pt with MM, RA, malignancy. What is the best initial treatment?', 'Underlying cause', 'B6 supplement, underlying cause if any', 'Hydroxy urea', 'Heparin and warfarin', 'A', 'Treatment for Anemia due to chronic disease: Rx ,  Underlying cause (Vignette from Dr. J notes, p110)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2A7E8ABBB56B', 'What is the classic presentation of Lead poisoning?', 'Altered mental status, abd pain, headaches, irritable', 'Seizures, fever, renal issues', 'Older pt. with chronic back pain, rule out MM', 'Px, red urine in the morning or heavy exercise due to acidic env', 'A', 'Classic presentation of Lead poisoning: Altered mental status, abd pain, headaches, irritable (Dr. J notes, p110)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2A7E8ABBB56B_V', 'A 60-year-old patient presents with Altered mental status, abd pain, headaches, irritable. What is the most likely diagnosis?', 'Altered mental status, abd pain, headaches, irritable', 'Seizures, fever, renal issues', 'Older pt. with chronic back pain, rule out MM', 'Px, red urine in the morning or heavy exercise due to acidic env', 'A', 'The presentation of Altered mental status, abd pain, headaches, irritable is classic for Lead poisoning. (Dr. J notes, p110)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2AFEE5408483', 'What is the mechanism of PTH?', 'Resorb in vit D def, resorb the bone', 'Tyrosine kinase', 'Gluconeogenesis by proteolysis in the liver', 'Growth factor, EPO = Tyrosine kinase', 'A', 'Mechanism of PTH: Resorb in vit D def., resorb the bone. Stimulates osteoclast and receptor on osteoblast. (Dr. J notes, p11)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2BA9AA458832', 'What is the treatment for Cyclothymia?', 'Alternating between persistent depression disordered, hypomania Never hit base line, cycling', '↑respiration, muscle spasm, yawning, impaired memory', '1ˢᵀ leading to acute dystonia = muscle spasm, stiffness, difﬁculty swallowing. reversible', 'Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures', 'A', 'Treatment for Cyclothymia: Alternating between persistent depression disordered, hypomania Never hit base line, cycling. Rx - SSRIs (Dr. J notes, p63)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2BA9AA458832_V', 'A 35-year-old patient with Cyclothymia presents with Alternating between persistent depression disordered, hypomania Never hit base line, cycling. Rx - SSRIs. What is the best initial treatment?', 'Alternating between persistent depression disordered, hypomania Never hit base line, cycling', '↑respiration, muscle spasm, yawning, impaired memory', '1ˢᵀ leading to acute dystonia = muscle spasm, stiffness, difﬁculty swallowing. reversible', 'Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures', 'A', 'Treatment for Cyclothymia: Alternating between persistent depression disordered, hypomania Never hit base line, cycling. Rx - SSRIs (Vignette from Dr. J notes, p63)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2BF17D444723', 'What is the treatment for Achalasia?', 'Nifurtimox, Benznidazole - chagas', 'Aggravated at menses / chron’s, iron deﬁciency (', 'Ca blockers', 'Bug, chlamydia trachomatis rx - azithro', 'A', 'Treatment for Achalasia: Rx ,  nifurtimox, Benznidazole - chagas. Achalasia ,  Surgery. (Dr. J notes, p51)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2C45F77F248E', 'What is the mechanism of Exenatide?', '↓ Glucagon release , GLP-1 agonist', '2P , > RET Gene mutation', '1 Antibody against to pancreas , > slow progressing autoimmune', 'Insulin comes from β cells, inhibit by glucagon', 'A', 'Mechanism of Exenatide: ↓ Glucagon release , GLP-1 agonist (Dr. J notes, p12)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2E4577BD8085', 'What is the treatment for Seborrheic dermatitis?', 'Topical selenium sulﬁde, ketoconazole', 'Steroid, and Type 1 Hypersensitivity reaction', 'Extensive - oral steroids, more then 2 wks we need to, 3 ADRENAL INSUFFICIENCY', 'Oral Griseofulvin, oral ketoconazole, itraconazole, isosulfate', 'A', 'Treatment for Seborrheic dermatitis: Rx ,  topical selenium sulﬁde, ketoconazole, (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2E4577BD8085_V', 'A 58-year-old patient is diagnosed with Seborrheic dermatitis. The patient presents with Eyebrows, cradle cap, greasy dandruff. What is the most appropriate treatment?', 'Topical selenium sulﬁde, ketoconazole', 'Steroid, and Type 1 Hypersensitivity reaction', 'Extensive - oral steroids, more then 2 wks we need to, 3 ADRENAL INSUFFICIENCY', 'Oral Griseofulvin, oral ketoconazole, itraconazole, isosulfate', 'A', 'Treatment for Seborrheic dermatitis: Rx ,  topical selenium sulﬁde, ketoconazole, (Vignette from Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2EA02FD92273', 'What is the mechanism of Maturity onset diabetes of young?', 'Single gene point mutation', '1 Antibody against to pancreas , > slow progressing autoimmune', 'By autoimmune disease', 'Nuclear / retinoid, binding to DNA , > cause hormone receptor', 'A', 'Mechanism of Maturity onset diabetes of young: Single gene point mutation (Dr. J notes, p13)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2FA1EE5C3429', 'What is the treatment for Melanoma?', 'Excision and interferons', 'Dopamine agonist', 'Extensive - oral steroids, more then 2 wks we need to, 3 ADRENAL INSUFFICIENCY', '𝝰 blockers then β blockers to avoid hypertensive crisis', 'A', 'Treatment for Melanoma: Excision and interferons. (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-2FE18173485D', 'What is the treatment for HUS?', 'Fluid & dialysis', 'Lots of ﬂuid, transfusion', 'Hydroxy urea', 'Except in E.R, We give Hydroxyurea to keep HbF high', 'A', 'Treatment for HUS: Rx ,  Fluid & dialysis (Dr. J notes, p113)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-30D2FE33A2D0', 'What is the best diagnostic approach for Rituximab?', 'Mabs, we need to do PPD test ﬁrst it inhibit granulomas - CD20', '20-40yo, connective tissue problem Loss of wrinkles, tight skin, ﬁnger tip pitting BP = ↑↑, S₄, Esophagus', 'X-ray, erosion (inﬂammation)', '30yo, Back pain mostly in the morning X-ray, vertebrae fuse to gather, bamboos', 'A', 'Diagnosis of Rituximab: Mabs ,  we need to do PPD test ﬁrst because it inhibit granulomas - CD20 (Dr. J notes, p21)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-30D2FE33A2D0_V', 'A 55-year-old patient presents with Mabs ,  we need to do PPD test ﬁrst because it inhibit granulomas - CD20. What is the most accurate diagnostic approach?', 'Mabs, we need to do PPD test ﬁrst it inhibit granulomas - CD20', '20-40yo, connective tissue problem Loss of wrinkles, tight skin, ﬁnger tip pitting BP = ↑↑, S₄, Esophagus', 'X-ray, erosion (inﬂammation)', '30yo, Back pain mostly in the morning X-ray, vertebrae fuse to gather, bamboos', 'A', 'Diagnosis of Rituximab: Mabs ,  we need to do PPD test ﬁrst because it inhibit granulomas - CD20 (Vignette from Dr. J notes, p21)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-30EFCF51B613', 'What is the classic presentation of Adrenal hemorrhage?', 'Rash, adrenal hemorrhage, Neiserria meningitides, nausea vomiting photophobia, neck stiffness', 'Sandpaper-like body rash (palms and sole), strawberry tongue', 'Pallor', '2nd mes, cAMP', 'A', 'Classic presentation of Adrenal hemorrhage: Rash, adrenal hemorrhage ,  Neiserria meningitides ,  nausea vomiting photophobia, neck stiffness (Dr. J notes, p14)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-30EFCF51B613_V', 'A 70-year-old patient presents with Rash, adrenal hemorrhage ,  Neiserria meningitides ,  nausea vomiting photophobia, neck stiffness. What is the most likely diagnosis?', 'Rash, adrenal hemorrhage, Neiserria meningitides, nausea vomiting photophobia, neck stiffness', 'Sandpaper-like body rash (palms and sole), strawberry tongue', 'Pallor', '2nd mes, cAMP', 'A', 'The presentation of Rash, adrenal hemorrhage ,  Neiserria meningitides ,  nausea vomiting photophobia, neck stiffness is classic for Adrenal hemorrhage. (Dr. J notes, p14)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-310ECF5349D8', 'What is the treatment for HHV-6,7?', 'Supportive', 'HART therapy', 'Mephloquine', 'Supportive/self-limiting, Vaccine', 'A', 'Treatment for HHV-6,7: Supportive (Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-310ECF5349D8_V', 'A 8-year-old patient with known HHV-6,7 comes in with Roseola. Starts with fever, then rash is seen in 3 days.. Which treatment is most appropriate?', 'Supportive', 'HART therapy', 'Mephloquine', 'Supportive/self-limiting, Vaccine', 'A', 'Treatment for HHV-6,7: Supportive (Vignette from Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-31452F5C3C2D', 'What is the treatment for General anxiety?', '> 6 month, Anxiety (outside) + worry (inside), about everything', 'Sadness.; treatment: psychotherapy, SSRIs', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures', 'A', 'Treatment for General anxiety: > 6 month ,  Anxiety (outside) + worry (inside) ,  about everything Rx = CBT, SSRI (Dr. J notes, p63)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-31452F5C3C2D_V', 'A 22-year-old patient with known General anxiety comes in with > 6 month ,  Anxiety (outside) + worry (inside) ,  about everything Rx = CBT, SSRI. Which treatment is most appropriate?', '> 6 month, Anxiety (outside) + worry (inside), about everything', 'Sadness.; treatment: psychotherapy, SSRIs', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures', 'A', 'Treatment for General anxiety: > 6 month ,  Anxiety (outside) + worry (inside) ,  about everything Rx = CBT, SSRI (Vignette from Dr. J notes, p63)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-31B94DA6EBE0', 'What is the treatment for Atypical interstitial pneumonia?', 'Ceftriaxon, macrolides', '0-2 months old, chlamydia', 'Macrolides', 'Salmonella , Touching turtles, chicken', 'A', 'Treatment for Atypical interstitial pneumonia: Ceftriaxon, macrolides (Dr. J notes, p48)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-31B94DA6EBE0_V', 'A 55-year-old patient with Atypical interstitial pneumonia presents with Legionella ,  gastroenteritis ,  Decreases Na+ ,  because of diarrhea. What is the best initial treatment?', 'Ceftriaxon, macrolides', '0-2 months old, chlamydia', 'Macrolides', 'Salmonella , Touching turtles, chicken', 'A', 'Treatment for Atypical interstitial pneumonia: Ceftriaxon, macrolides (Vignette from Dr. J notes, p48)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-338CA8BBEBD3', 'What is the mechanism of Gilbert syndrome?', 'Receptor doesn’t upregulate enzyme', 'Mutation of APC tumor suppressor gene on chromosome 5q21-q22', 'Sulfonamides, folic acid synthesis, inhibit metabolism', 'Autoimmune response, Gliadin', 'A', 'Mechanism of Gilbert syndrome: Receptor doesn’t upregulate enzyme ,  (Dr. J notes, p56)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-33A2D54E2049', 'What is the treatment for Alcohol?', 'Benzo (short acting), liver issues Benzo, long acting, if no liver damage', 'Antidepressant, lorazepam', 'First line', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'A', 'Treatment for Alcohol: Rx ,  benzo (short acting) ,  liver issues Benzo ,  long acting ,  if no liver damage (Dr. J notes, p61)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-33C882C01DF9', 'What is the classic presentation of Kaposi sarcoma?', 'Angiosarcoma of the veins', 'Pallor', 'On ﬂexor surfaces, itchy', 'Fever, malaise, fatigue', 'A', 'Classic presentation of Kaposi sarcoma: Angiosarcoma of the veins. Purplish rash on skin (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-33C882C01DF9_V', 'A 70-year-old patient is brought to the ED with Angiosarcoma of the veins. Purplish rash on skin. The most likely diagnosis is:', 'Angiosarcoma of the veins', 'Pallor', 'On ﬂexor surfaces, itchy', 'Fever, malaise, fatigue', 'A', 'The presentation of Angiosarcoma of the veins. Purplish rash on skin is classic for Kaposi sarcoma. (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-33DA454543B9', 'What is the treatment for Rhino virus?', 'Only PERCH virus which is NOT transmitted through fecal- oral route - due to acid labile', 'Live vaccine, ages 2-4-6 months', 'Is supportive', 'Mephloquine', 'A', 'Treatment for Rhino virus: Only PERCH virus which is NOT transmitted through fecal- oral route - due to acid labile. (Dr. J notes, p36)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-34E17DAA4164', 'What is the classic presentation of Premature ovarian failure ,  30?', 'Menopausal symptoms Menses stops, hot ﬂashes no hirsutism, no acne. What lab elevated ﬁrst, high FSH', 'Euphoria, not focus, impaired judgment, mood, swings, perinatal rash', 'Intubation, Sign by, pt & physician', 'Antidepressant, lorazepam', 'A', 'Classic presentation of Premature ovarian failure ,  30: Menopausal symptoms Menses stops, hot ﬂashes no hirsutism, no acne. What lab elevated ﬁrst ,  high FSH Rx - estrogen and progesterone replacement. B... (Dr. J notes, p75)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-34E17DAA4164_V', 'A 18-year-old patient presents with Menopausal symptoms Menses stops, hot ﬂashes no hirsutism, no acne. What lab elevated ﬁrst ,  high FSH Rx - estrogen and . What is the most likely diagnosis?', 'Menopausal symptoms Menses stops, hot ﬂashes no hirsutism, no acne. What lab elevated ﬁrst, high FSH', 'Euphoria, not focus, impaired judgment, mood, swings, perinatal rash', 'Intubation, Sign by, pt & physician', 'Antidepressant, lorazepam', 'A', 'The presentation of Menopausal symptoms Menses stops, hot ﬂashes no hirsutism, no acne. What lab elevated ﬁrst ,  high FSH Rx - estrogen and  is classic for Premature ovarian failure ,  30. (Dr. J notes, p75)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-351F37A5EC41', 'What is the mechanism of Extrapyramidal symptoms?', '2ⁿᵈ leading to Akathisia = restless, reversible', 'Inhibit 5-HT & NE re-uptake', 'Boys, 6-7yo, girls, 12yo > 6 months limited attention Hyperactive, impulsivity > 2 settings', 'Thioridazine, chlorpromazine Not give to old pt', 'A', 'Mechanism of Extrapyramidal symptoms: 2ⁿᵈ → Akathisia = restless, reversible. Manage = β-blocker, benztropine (Dr. J notes, p61)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-357AF7998FF7', 'What is the treatment for Meth hemoglobin?', 'Methylene blue', 'Fomepizole - IV, ⊖ Alcohol dehydrogenase', 'Fomepizole, IV', 'Anti venom for snake, tetanus vaccine', 'A', 'Treatment for Meth hemoglobin: Methylene blue (Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-357AF7998FF7_V', 'A 25-year-old patient with known Meth hemoglobin comes in with Chest pain, aspirin, shortness of breath. Which treatment is most appropriate?', 'Methylene blue', 'Fomepizole - IV, ⊖ Alcohol dehydrogenase', 'Fomepizole, IV', 'Anti venom for snake, tetanus vaccine', 'A', 'Treatment for Meth hemoglobin: Methylene blue (Vignette from Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-35BFE62B8CEB', 'What is the treatment for Budd-Chiari?', 'Eculizumab, blocks C5a, blocks complement', 'Underlying cause', 'Must remove organ', 'Aspirin, dicloccicillin, clopidogrel', 'A', 'Treatment for Budd-Chiari: Rx eculizumab ,  blocks C5a ,  blocks complement. (Dr. J notes, p113)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-35D10DDA069D', 'What is the treatment for DH toxicity?', 'Due P450 , > DH feb', 'N- acetyl cysteine, disulﬁde bonds', 'Fomepizole, IV', 'Charcoal', 'A', 'Treatment for DH toxicity: Due P450 Rx , > DH feb (Dr. J notes, p28)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-35D10DDA069D_V', 'A 42-year-old patient is diagnosed with DH toxicity. The patient presents with Prox tachycardia, nausea, vomiting. What is the most appropriate treatment?', 'Due P450 , > DH feb', 'N- acetyl cysteine, disulﬁde bonds', 'Fomepizole, IV', 'Charcoal', 'A', 'Treatment for DH toxicity: Due P450 Rx , > DH feb (Vignette from Dr. J notes, p28)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3753D0AC6361', 'What is the treatment for Pt + E?', 'Give Thiamine 1st than glucose', 'Benzo', 'Muscle cramps, put in shade/cool place ﬂuids, electrolytes', 'Iv ca 2 gluconate + anti venom', 'A', 'Treatment for Pt + E: Give Thiamine 1st than glucose (Dr. J notes, p27)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-37E14F203253', 'What is the treatment for HSV-3?', 'Supportive', 'Acyclovir, famciclovir, for future outbreak', 'Acyclovir - needs thymidylate kinase', 'TMP-SMX, if allergic we give pentamidine', 'A', 'Treatment for HSV-3: Supportive. Never give aspirin ,  can induce Reyes. (Dr. J notes, p33)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-37E14F203253_V', 'A 5-year-old patient with HSV-3 presents with Vesicles in various stages of healing. Itchy rash. What is the best initial treatment?', 'Supportive', 'Acyclovir, famciclovir, for future outbreak', 'Acyclovir - needs thymidylate kinase', 'TMP-SMX, if allergic we give pentamidine', 'A', 'Treatment for HSV-3: Supportive. Never give aspirin ,  can induce Reyes. (Vignette from Dr. J notes, p33)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-38386F2A23F8', 'What is a key risk factor or cause of Sideroblastic anemia?', 'Genetic , δ ALA synthesis', 'Increase retention of iron within reticuloendothelial system', 'Main cause, nutrition', 'Risk of clots, If happens in hepatic vein', 'A', 'Risk factor for Sideroblastic anemia: Genetic , δ ALA synthesis (Dr. J notes, p110)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-38979AF3B877', 'What is the treatment for H e p A ,  Tx ,  Fecal?', 'Supportive/self-limiting, Vaccine', 'Valpatsavir', 'Acyclovir - needs thymidylate kinase', 'TMP-SMX, if allergic we give pentamidine', 'A', 'Treatment for H e p A ,  Tx ,  Fecal: Supportive/self-limiting, Vaccine. (Dr. J notes, p36)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-38F17B99DA06', 'What is the treatment for Sickle cell disease?', 'Hydroxy urea', 'Except in E.R, We give Hydroxyurea to keep HbF high', 'Underlying cause', 'Must remove organ', 'A', 'Treatment for Sickle cell disease: Rx ,  hydroxy urea. (Dr. J notes, p111)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3A5C14D57AF1', 'What is the mechanism of Glucagon?', 'Insulin comes from β cells, inhibit by glucagon', 'Inhibit osteoclast - JOB', 'PPAR-γ receptor activation', '1P , > Medullary thyroid carcinoma [RET Gene]', 'A', 'Mechanism of Glucagon: Insulin comes from β cells, inhibit by glucagon (Dr. J notes, p11)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3A5EABC79496', 'What is the treatment for Bloody diarrhea bugs?', 'Salmonella , Touching turtles, chicken', 'Acid crossing sphincter, columnar metaplasia Glandular, so adenocarcinoma', 'ERCP = bedding', 'IV, metronidazole - blood prob Oral, Vanco, Fenoxamycin', 'A', 'Treatment for Bloody diarrhea bugs: Salmonella , Touching turtles, chicken. systemic -typhi-heart block No Rx ,  otherwise ,  cholecystitis, hide gall bladder (Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3AB38230F4B6', 'What is the treatment for Electric burn?', 'Rx, debridement, lots of ﬂuids, diuretics, mannitol', 'Lots of water & remove chemical', 'Dapsone, debridement', 'Antidepressant, lorazepam', 'A', 'Treatment for Electric burn: Rx. ,  debridement, lots of ﬂuids, diuretics, mannitol. (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3BA8E3CEE291', 'What is the classic presentation of Job syndrome?', 'Pale skin + red hair, bunch of rash, core face, S.A inf', 'B cells and neutrophils, gets sick quicker, High fever', 'Back pain - But X- ray normal', 'Infection Toxin, medullary ?, damage to papillary Sickle cell disease, NSAID’s, papillary damage, Hematuria', 'A', 'Classic presentation of Job syndrome: Pale skin + red hair, bunch of rash, core face, S.A inf. Hyper IgE (Dr. J notes, p84)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3BA8E3CEE291_V', 'A 25-year-old patient presents to the clinic with Pale skin + red hair, bunch of rash, core face, S.A inf. Hyper IgE. Which of the following is the most likely diagnosis?', 'Pale skin + red hair, bunch of rash, core face, S.A inf', 'B cells and neutrophils, gets sick quicker, High fever', 'Back pain - But X- ray normal', 'Infection Toxin, medullary ?, damage to papillary Sickle cell disease, NSAID’s, papillary damage, Hematuria', 'A', 'The presentation of Pale skin + red hair, bunch of rash, core face, S.A inf. Hyper IgE is classic for Job syndrome. (Dr. J notes, p84)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3BB8239C0782', 'What is the best diagnostic approach for Multiple Myeloma?', 'Smear, roulette formation, clock face chromatin', 'Rituximab, PPD +ve, do x-ray', 'Best initial Diagnostic, Iron study, High TIBC', 'TRAP positive', 'A', 'Diagnosis of Multiple Myeloma: P . Smear ,  roulette formation, clock face chromatin (Dr. J notes, p115)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3BB8239C0782_V', 'A 45-year-old patient presents with Older pt. with chronic back pain ,  rule out MM. What is the best initial diagnostic test?', 'Smear, roulette formation, clock face chromatin', 'Rituximab, PPD +ve, do x-ray', 'Best initial Diagnostic, Iron study, High TIBC', 'TRAP positive', 'A', 'Diagnosis of Multiple Myeloma: P . Smear ,  roulette formation, clock face chromatin (Vignette from Dr. J notes, p115)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3C1F946A771F', 'What is the classic presentation of West Nile virus?', 'Neuro symptoms - headache, encephalitis, meningitis', 'Fever, dehydration, ﬂu like symp, rash', 'Com. Viral cause of diarrhea in kids', 'Black vomitus (due to blood), high fever and severe liver damage', 'A', 'Classic presentation of West Nile virus: Neuro symptoms - headache, encephalitis, meningitis. Etc. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3C1F946A771F_V', 'A 30-year-old patient presents to the clinic with Neuro symptoms - headache, encephalitis, meningitis. Etc.. Which of the following is the most likely diagnosis?', 'Neuro symptoms - headache, encephalitis, meningitis', 'Fever, dehydration, ﬂu like symp, rash', 'Com. Viral cause of diarrhea in kids', 'Black vomitus (due to blood), high fever and severe liver damage', 'A', 'The presentation of Neuro symptoms - headache, encephalitis, meningitis. Etc. is classic for West Nile virus. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3CF98851D715', 'What is the mechanism of Protein Hormones?', 'T₄ have receptor on nucleus', 'Gluconeogenesis by proteolysis in the liver', 'Growth factor, EPO = Tyrosine kinase', '2P , > RET Gene mutation', 'A', 'Mechanism of Protein Hormones: T₄ have receptor on nucleus. (Dr. J notes, p10)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3D3ED893465C', 'What is the classic presentation of Old pt?', 'Back pain, more when lean down, > 65yo leading to 3 diffrenciations = multiple myeloma, tumor, metastasis', 'Severe back pain , worse with lean down, fever, ↑HR, ↓BP = spinal abscess', 'Pain pronate, ﬂex wrist, pain elbow = medial epicondyle - golfer’s elbow', 'Tingling 1ˢᵗ 3 ﬁngers', 'A', 'Classic presentation of Old pt: Back pain, more when lean down, > 65yo → 3 diffrenciations = multiple myeloma, tumor, metastasis (Dr. J notes, p23)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3D3ED893465C_V', 'A 55-year-old patient presents with Back pain, more when lean down, > 65yo → 3 diffrenciations = multiple myeloma, tumor, metastasis. What is the most likely diagnosis?', 'Back pain, more when lean down, > 65yo leading to 3 diffrenciations = multiple myeloma, tumor, metastasis', 'Severe back pain , worse with lean down, fever, ↑HR, ↓BP = spinal abscess', 'Pain pronate, ﬂex wrist, pain elbow = medial epicondyle - golfer’s elbow', 'Tingling 1ˢᵗ 3 ﬁngers', 'A', 'The presentation of Back pain, more when lean down, > 65yo → 3 diffrenciations = multiple myeloma, tumor, metastasis is classic for Old pt. (Dr. J notes, p23)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3DE994222F42', 'What is the treatment for Severe back pain?', 'Urinary incountinance, wipe don’t feel = quad eqvaina ,', 'Chronic gout', 'MRSTCS mix connective tissue, RA, SLE, takayasu, CREST, Scleroderma,', 'And with super high dose of cAMP , 1st come in stress', 'A', 'Treatment for Severe back pain: Urinary incountinance, wipe don’t feel = quad eqvaina , Rx = steroids - LMN (Dr. J notes, p23)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3DE994222F42_V', 'A 28-year-old patient with Severe back pain presents with Urinary incountinance, wipe don’t feel = quad eqvaina , Rx = steroids - LMN. What is the best initial treatment?', 'Urinary incountinance, wipe don’t feel = quad eqvaina ,', 'Chronic gout', 'MRSTCS mix connective tissue, RA, SLE, takayasu, CREST, Scleroderma,', 'And with super high dose of cAMP , 1st come in stress', 'A', 'Treatment for Severe back pain: Urinary incountinance, wipe don’t feel = quad eqvaina , Rx = steroids - LMN (Vignette from Dr. J notes, p23)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3DFC113344CA', 'What is the classic presentation of Atopic dermatitis?', 'On ﬂexor surfaces, itchy', 'Positive nikalosky sign', 'Scaly skin rash after infection', '2nd mes, cAMP', 'A', 'Classic presentation of Atopic dermatitis: On ﬂexor surfaces, itchy, (Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3DFC113344CA_V', 'A 45-year-old patient is brought to the ED with On ﬂexor surfaces, itchy,. The most likely diagnosis is:', 'On ﬂexor surfaces, itchy', 'Positive nikalosky sign', 'Scaly skin rash after infection', '2nd mes, cAMP', 'A', 'The presentation of On ﬂexor surfaces, itchy, is classic for Atopic dermatitis. (Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3E4CA017841E', 'What is the treatment for TCAs?', 'Inhibit 5-HT & NE re-uptake Use - neuropathy, A/E - prolong QT NOT give old people', 'FLash backs for >1 month', 'Alternating between persistent depression disordered, hypomania Never hit base line, cycling', 'First line', 'A', 'Treatment for TCAs: Inhibit 5-HT & NE re-uptake Use - neuropathy, A/E - prolong QT NOT give old people (Dr. J notes, p62)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3E4CA017841E_V', 'A 35-year-old patient with TCAs presents with Inhibit 5-HT & NE re-uptake Use - neuropathy, A/E - prolong QT NOT give old people. What is the best initial treatment?', 'Inhibit 5-HT & NE re-uptake Use - neuropathy, A/E - prolong QT NOT give old people', 'FLash backs for >1 month', 'Alternating between persistent depression disordered, hypomania Never hit base line, cycling', 'First line', 'A', 'Treatment for TCAs: Inhibit 5-HT & NE re-uptake Use - neuropathy, A/E - prolong QT NOT give old people (Vignette from Dr. J notes, p62)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3EE2E69B2DC8', 'What is the treatment for Sideroblastic anemia?', 'B6 supplement, underlying cause if any', 'Underlying cause', 'Supplement B12, vegans, and pts with bariatric Sx', 'Aspirin, dicloccicillin, clopidogrel', 'A', 'Treatment for Sideroblastic anemia: B6 supplement, underlying cause if any (Dr. J notes, p110)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3F4052566D6C', 'What is the classic presentation of Subacute Thyroiditis?', 'Finding = tender thyroid, pain', 'Rash, adrenal hemorrhage, Neiserria meningitides, nausea vomiting photophobia, neck stiffness', 'But enzyme def', 'Fever, malaise, fatigue', 'A', 'Classic presentation of Subacute Thyroiditis: Finding = tender thyroid, pain (Dr. J notes, p13)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-3F4052566D6C_V', 'A 32-year-old patient presents with Finding = tender thyroid, pain. What is the most likely diagnosis?', 'Finding = tender thyroid, pain', 'Rash, adrenal hemorrhage, Neiserria meningitides, nausea vomiting photophobia, neck stiffness', 'But enzyme def', 'Fever, malaise, fatigue', 'A', 'The presentation of Finding = tender thyroid, pain is classic for Subacute Thyroiditis. (Dr. J notes, p13)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-417D2E23D1B2', 'What is the best diagnostic approach for Crohn’s?', 'Biopsy, granulomas', 'Screen 18- 79 ages', 'Bordetella pertussis', 'Barium, Dx- Narrowing of upper esophagus', 'A', 'Diagnosis of Crohn’s: Biopsy ,  granulomas (Dr. J notes, p56)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-417D2E23D1B2_V', 'A 40-year-old patient is evaluated for Px , Diarrhea, on and off, kidney stones, gall stones,. Which diagnostic study should be ordered first?', 'Biopsy, granulomas', 'Screen 18- 79 ages', 'Bordetella pertussis', 'Barium, Dx- Narrowing of upper esophagus', 'A', 'Diagnosis of Crohn’s: Biopsy ,  granulomas (Vignette from Dr. J notes, p56)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-41E2DE46F1CC', 'What is the treatment for Prolactinoma?', 'Dopamine agonist', 'Excision and interferons', 'Extensive - oral steroids, more then 2 wks we need to, 3 ADRENAL INSUFFICIENCY', 'Topical azoles, selenium sulﬁde', 'A', 'Treatment for Prolactinoma: Rx ,  dopamine agonist (Dr. J notes, p15)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-426AB65BA7CF', 'What is the best diagnostic approach for Retro virus?', 'Best initial test - ELISA', 'Lab - Neck ﬁlm', 'Neck stiffness, photophobia, altered mental status', 'Wheezing, so best initial in chest Xray', 'A', 'Diagnosis of Retro virus: Best initial test - ELISA (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-42BAD97B44FC', 'What is a key risk factor or cause of Rolling Hiatal hernia?', 'Genetic or trauma (car accident steering hit)', 'Risk of squamous cell carcinoma - alcoholism, smoking', 'That’s why Hypercalcemia, cause ulcers', 'PH alkalotic, risk for staghorn calculi', 'A', 'Risk factor for Rolling Hiatal hernia: Genetic or trauma (car accident steering hit), (Dr. J notes, p53)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-431F45569329', 'What is the treatment for Scabies ,  Px?', 'Topical permethrin or oral ivermectin (Single dose - fat sol, easier to be toxic)', 'Acyclovir, Gabapentin, amitryptaline', 'Topical azole', 'Steroids, IVIg', 'A', 'Treatment for Scabies ,  Px: Rx topical permethrin or oral ivermectin (Single dose - fat sol, easier to be toxic) (Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-433C65B1F3A5', 'What is the treatment for Rosacea?', 'Topical Metronidazole', 'Supportive, rest, sunshine, sulfasaline', 'Dopamine agonist', 'Replace lens, type 4 collagen in lens', 'A', 'Treatment for Rosacea: Topical Metronidazole (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4394F6DE6E6A', 'What is the classic presentation of New mom?', 'Pain, tenderness base of both thumbs = quad tender servitis (sinusitis)', 'Severe back pain , worse with lean down, fever, ↑HR, ↓BP = spinal abscess', 'Pain pronate, ﬂex wrist, pain elbow = medial epicondyle - golfer’s elbow', '50-60 yo - mono articular Pain with movement mostly day, worse at end of day, nodes present Joints in ﬁngers, DIP', 'A', 'Classic presentation of New mom: Pain, tenderness base of both thumbs = quad tender servitis (sinusitis) (Dr. J notes, p23)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4394F6DE6E6A_V', 'A 28-year-old patient is brought to the ED with Pain, tenderness base of both thumbs = quad tender servitis (sinusitis). The most likely diagnosis is:', 'Pain, tenderness base of both thumbs = quad tender servitis (sinusitis)', 'Severe back pain , worse with lean down, fever, ↑HR, ↓BP = spinal abscess', 'Pain pronate, ﬂex wrist, pain elbow = medial epicondyle - golfer’s elbow', '50-60 yo - mono articular Pain with movement mostly day, worse at end of day, nodes present Joints in ﬁngers, DIP', 'A', 'The presentation of Pain, tenderness base of both thumbs = quad tender servitis (sinusitis) is classic for New mom. (Dr. J notes, p23)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-43C4A5B4BE10', 'What is the classic presentation of Gram -ve?', 'Bloody diarrhea', 'Painful, Joint pain (migratory), discharge, urathritis', 'Watery diarrhea', '7 1. Catalase = Break down Hydrogen peroxide (H₂O₂ + H₂O + O₂) 2', 'A', 'Classic presentation of Gram -ve: Bloody diarrhea (Dr. J notes, p47)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-43C4A5B4BE10_V', 'A 65-year-old patient presents to the clinic with Bloody diarrhea. Which of the following is the most likely diagnosis?', 'Bloody diarrhea', 'Painful, Joint pain (migratory), discharge, urathritis', 'Watery diarrhea', '7 1. Catalase = Break down Hydrogen peroxide (H₂O₂ + H₂O + O₂) 2', 'A', 'The presentation of Bloody diarrhea is classic for Gram -ve. (Dr. J notes, p47)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-442D9707D0F0', 'What is the mechanism of Celiac sprue?', 'Autoimmune response, Gliadin', 'Receptor doesn’t upregulate enzyme', 'Sulfonamides, folic acid synthesis, inhibit metabolism', 'Mutation of APC tumor suppressor gene on chromosome 5q21-q22', 'A', 'Mechanism of Celiac sprue: Autoimmune response ,  Gliadin (Dr. J notes, p54)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-444B8E263378', 'What is the classic presentation of Ulcerative colitis , Young 20s?', 'Bloody diarrhea, abd pain, No vit def, erythema nodosum', 'Itching, fatigue', 'Severe abdominal pain radiating to the back, vomiting', 'Painful, Joint pain (migratory), discharge, urathritis', 'A', 'Classic presentation of Ulcerative colitis , Young 20s: Bloody diarrhea, abd pain, No vit def, erythema nodosum, (Dr. J notes, p56)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-444B8E263378_V', 'A 55-year-old patient presents to the clinic with Bloody diarrhea, abd pain, No vit def, erythema nodosum,. Which of the following is the most likely diagnosis?', 'Bloody diarrhea, abd pain, No vit def, erythema nodosum', 'Itching, fatigue', 'Severe abdominal pain radiating to the back, vomiting', 'Painful, Joint pain (migratory), discharge, urathritis', 'A', 'The presentation of Bloody diarrhea, abd pain, No vit def, erythema nodosum, is classic for Ulcerative colitis , Young 20s. (Dr. J notes, p56)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-44D06BD1F701', 'What is the classic presentation of Rabies ,  Dx- histo?', 'Photophobia, hydrophobia, agitation, fever', 'Fever, rash and dehydration', 'Diarrhea after traveling in cruise, big hotels (large crowds) buffets', 'Fever, dehydration, ﬂu like symp, rash', 'A', 'Classic presentation of Rabies ,  Dx- histo: Photophobia, hydrophobia, agitation, fever, (Dr. J notes, p39)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-44D06BD1F701_V', 'A 8-year-old patient presents to the clinic with Photophobia, hydrophobia, agitation, fever,. Which of the following is the most likely diagnosis?', 'Photophobia, hydrophobia, agitation, fever', 'Fever, rash and dehydration', 'Diarrhea after traveling in cruise, big hotels (large crowds) buffets', 'Fever, dehydration, ﬂu like symp, rash', 'A', 'The presentation of Photophobia, hydrophobia, agitation, fever, is classic for Rabies ,  Dx- histo. (Dr. J notes, p39)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-45018B6610D0', 'What is the best diagnostic approach for H e p C?', 'We Can treat acute', 'Neck stiffness, photophobia, altered mental status', 'Tzank test - Eosinophilic intranuclear inclusions', 'Mono spot test will be negative', 'A', 'Diagnosis of H e p C: We Can treat acute. so we screen pts ages between 18 - 79. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-45018B6610D0_V', 'A 5-year-old patient presents with Sexual, contact.. What is the best initial diagnostic test?', 'We Can treat acute', 'Neck stiffness, photophobia, altered mental status', 'Tzank test - Eosinophilic intranuclear inclusions', 'Mono spot test will be negative', 'A', 'Diagnosis of H e p C: We Can treat acute. so we screen pts ages between 18 - 79. (Vignette from Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-45885AF97AA2', 'What is the mechanism of SLE?', 'C1q, complement = low', 'No sarcomeres, partial synsitial activity, to peristalsis 2° messenger for contraction = IP₃', 'Use certain muscle ﬁber to speciﬁc work no autonomics', 'How many joints involve mono = osteoarthritis, gout, septic arthritis Oligo (just couple joints) = spondylopathy', 'A', 'Mechanism of SLE: C1q, complement = low (Dr. J notes, p20)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-45C3733FB1FF', 'What is the treatment for 1° Hypoparathyroidism?', '> surgical remove (Thyroidectomy )', 'Crohn syndrome, Total Na⁺↑ Serum Na⁺↑ K⁺↓, pH ↑ (alkalic), BP↑, renin↓, Rx, spironolactone, blocks aldosteron', 'Blocks T₃, T₄ production pathway (', 'Hypersensitivity', 'A', 'Treatment for 1° Hypoparathyroidism: Cause , > surgical remove (Thyroidectomy ) (Dr. J notes, p12)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-45C3733FB1FF_V', 'A 32-year-old patient with 1° Hypoparathyroidism presents with Cause , > surgical remove (Thyroidectomy ). What is the best initial treatment?', '> surgical remove (Thyroidectomy )', 'Crohn syndrome, Total Na⁺↑ Serum Na⁺↑ K⁺↓, pH ↑ (alkalic), BP↑, renin↓, Rx, spironolactone, blocks aldosteron', 'Blocks T₃, T₄ production pathway (', 'Hypersensitivity', 'A', 'Treatment for 1° Hypoparathyroidism: Cause , > surgical remove (Thyroidectomy ) (Vignette from Dr. J notes, p12)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4618ED2029F5', 'What is the classic presentation of Scorpion sting?', 'Big ones, tingling pain Rx, Antihistamine, HTZ cream', 'Tingling, burning, local swelling', 'Hemotoxin, makes u bleed out', 'Prox tachycardia, nausea, vomiting', 'A', 'Classic presentation of Scorpion sting: Big ones ,  tingling pain Rx ,  Antihistamine, HTZ cream (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4618ED2029F5_V', 'A 50-year-old patient presents to the clinic with Big ones ,  tingling pain Rx ,  Antihistamine, HTZ cream. Which of the following is the most likely diagnosis?', 'Big ones, tingling pain Rx, Antihistamine, HTZ cream', 'Tingling, burning, local swelling', 'Hemotoxin, makes u bleed out', 'Prox tachycardia, nausea, vomiting', 'A', 'The presentation of Big ones ,  tingling pain Rx ,  Antihistamine, HTZ cream is classic for Scorpion sting. (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-463157642A3D', 'What is the treatment for Echovirus?', 'Tx, Fecal oral', 'Is supportive', 'IV acyclovir', 'HART therapy', 'A', 'Treatment for Echovirus: Tx ,  Fecal oral. (Dr. J notes, p36)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-46A60FBF5AF7', 'What is a key risk factor or cause of Duodenal ulcer?', '↓cancer risk', 'Cancer risk ↑↑', 'Cystic ﬁbrosis, cause pneumonia after 20', 'Other bugs cause NF, staph Aureus and Clostridium perfringens', 'A', 'Risk factor for Duodenal ulcer: ↓cancer risk (Dr. J notes, p53)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4740FC61FA26', 'What is the mechanism of ITP , bleeding in skin and mucosa?', 'Kids, resolve, autoimmune', 'Point mutation of glutamic acid leading to valine', 'Tyrosine kinase?? B.I, LAP', 'Chronic PPI use - PPI inhibit parietal cell secretion which needs for B12 absorption', 'A', 'Mechanism of ITP , bleeding in skin and mucosa: Kids ,  resolve, autoimmune (Dr. J notes, p107)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-48C6553B6A2E', 'What is the treatment for Short acting insulin?', 'Regular insulin, IV', 'Topical selenium sulﬁde, ketoconazole', 'Defect in adrenal steroid biosynthesis', '> surgical remove (Thyroidectomy )', 'A', 'Treatment for Short acting insulin: Regular insulin ,  IV (Dr. J notes, p13)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-48C6553B6A2E_V', 'A 58-year-old patient is diagnosed with Short acting insulin. The patient presents with Regular insulin ,  IV. What is the most appropriate treatment?', 'Regular insulin, IV', 'Topical selenium sulﬁde, ketoconazole', 'Defect in adrenal steroid biosynthesis', '> surgical remove (Thyroidectomy )', 'A', 'Treatment for Short acting insulin: Regular insulin ,  IV (Vignette from Dr. J notes, p13)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-48ED79CD0BCD', 'What is the classic presentation of ALL?', 'Fatigue, easy bruising, petechia, purpura in a kid', 'Oliguria, slight fever, transplanted tissue is grossly mottled', 'Fatigue, pale, chest pain, shortness of breath', 'Older pt. with chronic back pain, rule out MM', 'A', 'Classic presentation of ALL: Fatigue, easy bruising, petechia, purpura in a kid (Dr. J notes, p114)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-48ED79CD0BCD_V', 'A 35-year-old patient is brought to the ED with Fatigue, easy bruising, petechia, purpura in a kid. The most likely diagnosis is:', 'Fatigue, easy bruising, petechia, purpura in a kid', 'Oliguria, slight fever, transplanted tissue is grossly mottled', 'Fatigue, pale, chest pain, shortness of breath', 'Older pt. with chronic back pain, rule out MM', 'A', 'The presentation of Fatigue, easy bruising, petechia, purpura in a kid is classic for ALL. (Dr. J notes, p114)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-48FA17A32A0D', 'What is the mechanism of Glutamine, Rosiglitazone?', 'PPAR-γ receptor activation', 'Insulin comes from β cells, inhibit by glucagon', '↓ Glucagon release , GLP-1 agonist', 'Single gene point mutation', 'A', 'Mechanism of Glutamine, Rosiglitazone: PPAR-γ receptor activation (Dr. J notes, p12)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4AF9EB24523C', 'What is the treatment for Osteoporosis?', 'After menopause, >55 Osteoclast problem', 'MRSTCS mix connective tissue, RA, SLE, takayasu, CREST, Scleroderma,', 'And with super high dose of cAMP , 1st come in stress', 'Calcinosis cutis, raynaud’s phenomenon, esophageal dysmotility, sclerodactyly, telangiectasis Anti centromere antibody', 'A', 'Treatment for Osteoporosis: After menopause, >55 Osteoclast problem Rx = bisphosphonates (Dr. J notes, p21)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4AF9EB24523C_V', 'A 75-year-old patient with Osteoporosis presents with After menopause, >55 Osteoclast problem Rx = bisphosphonates. What is the best initial treatment?', 'After menopause, >55 Osteoclast problem', 'MRSTCS mix connective tissue, RA, SLE, takayasu, CREST, Scleroderma,', 'And with super high dose of cAMP , 1st come in stress', 'Calcinosis cutis, raynaud’s phenomenon, esophageal dysmotility, sclerodactyly, telangiectasis Anti centromere antibody', 'A', 'Treatment for Osteoporosis: After menopause, >55 Osteoclast problem Rx = bisphosphonates (Vignette from Dr. J notes, p21)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4B746ECEE46F', 'What is the classic presentation of Allergic ,  bilateral?', 'Itchy; treatment: antihistamines', 'Rash, adrenal hemorrhage, Neiserria meningitides, nausea vomiting photophobia, neck stiffness', '2nd mes, cAMP', 'Scaly skin rash after infection', 'A', 'Classic presentation of Allergic ,  bilateral: Itchy Rx - antihistamines (Dr. J notes, p7)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4B746ECEE46F_V', 'A 22-year-old patient presents with Itchy Rx - antihistamines. What is the most likely diagnosis?', 'Itchy; treatment: antihistamines', 'Rash, adrenal hemorrhage, Neiserria meningitides, nausea vomiting photophobia, neck stiffness', '2nd mes, cAMP', 'Scaly skin rash after infection', 'A', 'The presentation of Itchy Rx - antihistamines is classic for Allergic ,  bilateral. (Dr. J notes, p7)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4BAEC7FAED25', 'What is the treatment for Staph Epidermidis?', 'Infected by = Hip implant, valve replace, IV catheters', 'Amoxicillin - cell wall synthesis', 'Macrolide = 50s', 'Prophylaxis vaccine to family', 'A', 'Treatment for Staph Epidermidis: Infected by = Hip implant, valve replace, IV catheters (Dr. J notes, p43)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4BAEC7FAED25_V', 'A 40-year-old patient is diagnosed with Staph Epidermidis. The patient presents with Gram +Ve, Catalase +Ve, Coagulase , Ve, Novobiocin sensi.. What is the most appropriate treatment?', 'Infected by = Hip implant, valve replace, IV catheters', 'Amoxicillin - cell wall synthesis', 'Macrolide = 50s', 'Prophylaxis vaccine to family', 'A', 'Treatment for Staph Epidermidis: Infected by = Hip implant, valve replace, IV catheters (Vignette from Dr. J notes, p43)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4BD18D1E1B60', 'What is the treatment for Dog/ Cat bite?', 'Clean it out leave it open', 'Due P450 , > DH feb', 'Rx., debridement, lots of ﬂuids, diuretics, mannitol', 'Slur speech withdrawal, mydriasis, yawning, lacrimation', 'A', 'Treatment for Dog/ Cat bite: Rx,  clean it out leave it open. No suture. Amoxicillin, clavinet, tetanus vaccine (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4D5F89C85B6F', 'What is the classic presentation of Pharyngitis?', 'We can prevent Heart block with like rheumatic fever - regorge murmur but cannot prevent PSGN', 'Heart block, S3, Fever, HR no change', 'Klebsiella = capsulated, productive pneumonia (typical), currant jelly sputum, also cause, UTI, Tertiary', 'Legionella, gastroenteritis, Decreases Na+, of diarrhea', 'A', 'Classic presentation of Pharyngitis: We can prevent Heart block with Rx like rheumatic fever - regorge murmur but cannot prevent PSGN. (Dr. J notes, p43)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4D5F89C85B6F_V', 'A 28-year-old patient presents with We can prevent Heart block with Rx like rheumatic fever - regorge murmur but cannot prevent PSGN.. What is the most likely diagnosis?', 'We can prevent Heart block with like rheumatic fever - regorge murmur but cannot prevent PSGN', 'Heart block, S3, Fever, HR no change', 'Klebsiella = capsulated, productive pneumonia (typical), currant jelly sputum, also cause, UTI, Tertiary', 'Legionella, gastroenteritis, Decreases Na+, of diarrhea', 'A', 'The presentation of We can prevent Heart block with Rx like rheumatic fever - regorge murmur but cannot prevent PSGN. is classic for Pharyngitis. (Dr. J notes, p43)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4E1887DD2878', 'What is the classic presentation of Active young kid?', 'Pain, tenderness, tibial tubro', 'Severe back pain , worse with lean down, fever, ↑HR, ↓BP = spinal abscess', 'Bilateral Joints pain & stiff in morning', 'Alcoholic present with acute gout, no GI issues', 'A', 'Classic presentation of Active young kid: Pain, tenderness, tibial tubro. = osgood schlatter disease (Dr. J notes, p23)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4E1887DD2878_V', 'A 55-year-old patient presents with Pain, tenderness, tibial tubro. = osgood schlatter disease. What is the most likely diagnosis?', 'Pain, tenderness, tibial tubro', 'Severe back pain , worse with lean down, fever, ↑HR, ↓BP = spinal abscess', 'Bilateral Joints pain & stiff in morning', 'Alcoholic present with acute gout, no GI issues', 'A', 'The presentation of Pain, tenderness, tibial tubro. = osgood schlatter disease is classic for Active young kid. (Dr. J notes, p23)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4E2D33A1B180', 'What is the treatment for Gastritis type B?', '? CAP, Clarithromycin, amoxicillin, PPI', 'Ceftriaxon, macrolides', '0-2 months old, chlamydia', 'Quadruple therapy, PPI + TCA + Metro +Bismut (give not to)', 'A', 'Treatment for Gastritis type B: Rx , ? CAP ,  Clarithromycin, amoxicillin, PPI (Dr. J notes, p53)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4E7112321E4E', 'What is the mechanism of Pemphigus vulgaris?', 'Autoimmune, sensitive blisters, break easily, painful', 'Single gene point mutation', '2P , > RET Gene mutation', '↓ Glucagon release , GLP-1 agonist', 'A', 'Mechanism of Pemphigus vulgaris: Autoimmune, sensitive blisters ,  break easily, painful (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4EC99FA3753A', 'What is the treatment for Rabies ,  Dx- histo?', 'Iv IG, vaccination', 'Supportive', 'Live vaccine, ages 2-4-6 months', 'Acyclovir, famciclovir, for future outbreak', 'A', 'Treatment for Rabies ,  Dx- histo: Rx ,  Iv IG ,  vaccination (Dr. J notes, p39)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-4EC99FA3753A_V', 'A 22-year-old patient is diagnosed with Rabies ,  Dx- histo. The patient presents with Photophobia, hydrophobia, agitation, fever,. What is the most appropriate treatment?', 'Iv IG, vaccination', 'Supportive', 'Live vaccine, ages 2-4-6 months', 'Acyclovir, famciclovir, for future outbreak', 'A', 'Treatment for Rabies ,  Dx- histo: Rx ,  Iv IG ,  vaccination (Vignette from Dr. J notes, p39)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-502185EDB7A6', 'What is the mechanism of Gray’s?', 'Nuclear / retinoid, binding to DNA , > cause hormone receptor', 'By autoimmune disease', 'Gluconeogenesis by proteolysis in the liver', 'PPAR-γ receptor activation', 'A', 'Mechanism of Gray’s: Nuclear / retinoid ,  binding to DNA , > cause hormone receptor (Dr. J notes, p13)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-508AE5438D14', 'What is the treatment for Low potency 1ˢᵀ generation?', 'Thioridazine, chlorpromazine Not give to old pt', '> 6 month, Anxiety (outside) + worry (inside), about everything', '≥ 5 symptoms, ≥2 weeks SIG E CAPSSleep ↑↓Interest ↓ = diﬃcult to treat Guilt Energy ↓Concentration ↓Appetite', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'A', 'Treatment for Low potency 1ˢᵀ generation: Thioridazine, chlorpromazine Not give to old pt. (Dr. J notes, p61)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-508AE5438D14_V', 'A 22-year-old patient with Low potency 1ˢᵀ generation presents with Thioridazine, chlorpromazine Not give to old pt.. What is the best initial treatment?', 'Thioridazine, chlorpromazine Not give to old pt', '> 6 month, Anxiety (outside) + worry (inside), about everything', '≥ 5 symptoms, ≥2 weeks SIG E CAPSSleep ↑↓Interest ↓ = diﬃcult to treat Guilt Energy ↓Concentration ↓Appetite', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'A', 'Treatment for Low potency 1ˢᵀ generation: Thioridazine, chlorpromazine Not give to old pt. (Vignette from Dr. J notes, p61)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5119D8AAA74E', 'What is the classic presentation of Atrial arrhythmia?', 'No pain', 'Low mg lets Na come right in', 'Funny feeling No P waves, EKG Decrease in PH , No pain, risk embolism in A. Fib', 'With chest pain, palpitation, tachycardia, Wide QRS Ventricular arrhythmia/ V', 'A', 'Classic presentation of Atrial arrhythmia: No pain (Dr. J notes, p118)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5119D8AAA74E_V', 'A 45-year-old patient is brought to the ED with No pain. The most likely diagnosis is:', 'No pain', 'Low mg lets Na come right in', 'Funny feeling No P waves, EKG Decrease in PH , No pain, risk embolism in A. Fib', 'With chest pain, palpitation, tachycardia, Wide QRS Ventricular arrhythmia/ V', 'A', 'The presentation of No pain is classic for Atrial arrhythmia. (Dr. J notes, p118)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5128AC482189', 'What is the classic presentation of Chikungunya?', '1 wk fever, then joint pain (bad) that continues for 1 yr', 'Fever, myalgia, splenomegaly, lymphadenopathy', 'Fever, dehydration, ﬂu like symp, rash', 'Flu like symp', 'A', 'Classic presentation of Chikungunya: 1 wk fever, then joint pain (bad) that continues for 1 yr. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5128AC482189_V', 'A 5-year-old patient presents to the clinic with 1 wk fever, then joint pain (bad) that continues for 1 yr.. Which of the following is the most likely diagnosis?', '1 wk fever, then joint pain (bad) that continues for 1 yr', 'Fever, myalgia, splenomegaly, lymphadenopathy', 'Fever, dehydration, ﬂu like symp, rash', 'Flu like symp', 'A', 'The presentation of 1 wk fever, then joint pain (bad) that continues for 1 yr. is classic for Chikungunya. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-513FF0BCA25C', 'What is the classic presentation of CSF?', 'Need vit A to make CSF enzyme - carbonic anhydrase, acetazolamide inhibits carbonic anhydrase CSF acidic in blood', 'Greasy appearancePt with headache, precocious puberty, bitemporal hemianopsia + loss of upper gaze, Pinealoma Stroke', 'Symptomatic, ataxia, spingomyelia, pain and temperature loss bilateral', 'Night terrors, sleep walking, teeth grinding increase intracraneal pressure, nausea, headache First sign', 'A', 'Classic presentation of CSF: Need vit A to make CSF enzyme - carbonic anhydrase ,  acetazolamide inhibits carbonic anhydrase CSF acidic in blood ,  because CO2 response to brainHypo... (Dr. J notes, p138)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-513FF0BCA25C_V', 'A 60-year-old patient presents to the clinic with Need vit A to make CSF enzyme - carbonic anhydrase ,  acetazolamide inhibits carbonic anhydrase CSF acidic in blood ,  bco. Which of the following is the most likely diagnosis?', 'Need vit A to make CSF enzyme - carbonic anhydrase, acetazolamide inhibits carbonic anhydrase CSF acidic in blood', 'Greasy appearancePt with headache, precocious puberty, bitemporal hemianopsia + loss of upper gaze, Pinealoma Stroke', 'Symptomatic, ataxia, spingomyelia, pain and temperature loss bilateral', 'Night terrors, sleep walking, teeth grinding increase intracraneal pressure, nausea, headache First sign', 'A', 'The presentation of Need vit A to make CSF enzyme - carbonic anhydrase ,  acetazolamide inhibits carbonic anhydrase CSF acidic in blood ,  bco is classic for CSF. (Dr. J notes, p138)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5215CAD3D954', 'What is the treatment for Chemical burns?', 'Lots of water & remove chemical', 'Vaccine & IVIG, Once symptoms start, 100% deadly', 'Rx., debridement, lots of ﬂuids, diuretics, mannitol', 'Fomepizole, IV', 'A', 'Treatment for Chemical burns: Rx ,  Lots of water & remove chemical (Dr. J notes, p26)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-52540BA8E725', 'What is the treatment for HHV-8 (@HIV)?', 'HART therapy', 'Supportive', 'Acyclovir, famciclovir, for future outbreak', 'IV acyclovir', 'A', 'Treatment for HHV-8 (@HIV): Rx,  HART therapy. 2NNRTIs or 2 NRTIs + 1 integrase inhibitors. (Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-52540BA8E725_V', 'A 8-year-old patient is diagnosed with HHV-8 (@HIV). The patient presents with Purple papules.. What is the most appropriate treatment?', 'HART therapy', 'Supportive', 'Acyclovir, famciclovir, for future outbreak', 'IV acyclovir', 'A', 'Treatment for HHV-8 (@HIV): Rx,  HART therapy. 2NNRTIs or 2 NRTIs + 1 integrase inhibitors. (Vignette from Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-52941A8BB196', 'What is the classic presentation of Staph Aureus?', '7 1. Catalase = Break down Hydrogen peroxide (H₂O₂ + H₂O + O₂) 2', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', 'Diarrhea toxin, >18hrs - Left out meat and sauces', 'We can prevent Heart block with like rheumatic fever - regorge murmur but cannot prevent PSGN', 'A', 'Classic presentation of Staph Aureus: 7 1. Catalase = Break down Hydrogen peroxide (H₂O₂ + H₂O + O₂) 2. Beta lactamases = Break down beta lactam Neutralize Drugs Bind to penicillin bind... (Dr. J notes, p42)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-52941A8BB196_V', 'A 55-year-old patient is brought to the ED with 7 1. Catalase = Break down Hydrogen peroxide (H₂O₂ + H₂O + O₂) 2. Beta lactamases = Break down beta lactam Neutralize Dr. The most likely diagnosis is:', '7 1. Catalase = Break down Hydrogen peroxide (H₂O₂ + H₂O + O₂) 2', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', 'Diarrhea toxin, >18hrs - Left out meat and sauces', 'We can prevent Heart block with like rheumatic fever - regorge murmur but cannot prevent PSGN', 'A', 'The presentation of 7 1. Catalase = Break down Hydrogen peroxide (H₂O₂ + H₂O + O₂) 2. Beta lactamases = Break down beta lactam Neutralize Dr is classic for Staph Aureus. (Dr. J notes, p42)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-53025EEEA27F', 'What is the classic presentation of 2° hemochromatosis?', 'New onset of diabetes and arthritis, restrictive cardiomyopathy', 'RUQ pain (not going away this time)', 'Pea soup colored diarrhea', 'Heart block, S3, Fever, HR no change', 'A', 'Classic presentation of 2° hemochromatosis: New onset of diabetes and arthritis, restrictive cardiomyopathy. (Dr. J notes, p57)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-53025EEEA27F_V', 'A 65-year-old patient presents with New onset of diabetes and arthritis, restrictive cardiomyopathy.. What is the most likely diagnosis?', 'New onset of diabetes and arthritis, restrictive cardiomyopathy', 'RUQ pain (not going away this time)', 'Pea soup colored diarrhea', 'Heart block, S3, Fever, HR no change', 'A', 'The presentation of New onset of diabetes and arthritis, restrictive cardiomyopathy. is classic for 2° hemochromatosis. (Dr. J notes, p57)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5315448185F8', 'What is the treatment for Tourette syndrome?', 'Before 18, vocal tics > 1year', '1ˢᵀ leading to acute dystonia = muscle spasm, stiffness, difﬁculty swallowing. reversible', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', '> 6 month, Anxiety (outside) + worry (inside), about everything', 'A', 'Treatment for Tourette syndrome: Before 18, vocal tics > 1year Rx = haloperidol (Dr. J notes, p60)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5315448185F8_V', 'A 45-year-old patient with known Tourette syndrome comes in with Before 18, vocal tics > 1year Rx = haloperidol. Which treatment is most appropriate?', 'Before 18, vocal tics > 1year', '1ˢᵀ leading to acute dystonia = muscle spasm, stiffness, difﬁculty swallowing. reversible', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', '> 6 month, Anxiety (outside) + worry (inside), about everything', 'A', 'Treatment for Tourette syndrome: Before 18, vocal tics > 1year Rx = haloperidol (Vignette from Dr. J notes, p60)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-53C69B5ED8CA', 'What is the mechanism of Myotonic dystrophy?', 'Triple VP mutation Bird peak, muscle wasting (diﬃculty releasing hand from handshake)', 'CPK - creatine phosphate kinase', 'No sarcomeres, partial synsitial activity, to peristalsis 2° messenger for contraction = IP₃', 'Inhibit insulin release release, pancreas', 'A', 'Mechanism of Myotonic dystrophy: Triple VP mutation Bird peak, muscle wasting (diﬃculty releasing hand from handshake) (Dr. J notes, p19)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-54F852E8DE10', 'What is the mechanism of CMV Encephalitis?', 'Enzyme, Thy', 'Ganciclovir, or foscarnet (no need of Thymidine kinase enzyme)', 'Cidofovir, foscarnate, doesn’t require thymidine kinase', 'Acyclovir, needs thymidine kinase to work, except Cidofovir and foscarnet', 'A', 'Mechanism of CMV Encephalitis: Enzyme ,  Thy. Kinase (Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-55B0282B361D', 'What is the classic presentation of Entamoeba histolytica?', 'Bloody diarrhea, liver abscess, liver cysts', 'Dump with diarrhea, in USA, 2 possibilities', 'Fatigue, shortness of breath, MCC of death', 'Acyclovir, famciclovir - prevent future outbreaks Gabapentin (for pain) - emitriptiline Ganciclovir - CMV', 'A', 'Classic presentation of Entamoeba histolytica: Cause bloody diarrhea, liver abscess, liver cysts. (Flask shaped) (Dr. J notes, p39)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-55B0282B361D_V', 'A 8-year-old patient is brought to the ED with Cause bloody diarrhea, liver abscess, liver cysts. (Flask shaped). The most likely diagnosis is:', 'Bloody diarrhea, liver abscess, liver cysts', 'Dump with diarrhea, in USA, 2 possibilities', 'Fatigue, shortness of breath, MCC of death', 'Acyclovir, famciclovir - prevent future outbreaks Gabapentin (for pain) - emitriptiline Ganciclovir - CMV', 'A', 'The presentation of Cause bloody diarrhea, liver abscess, liver cysts. (Flask shaped) is classic for Entamoeba histolytica. (Dr. J notes, p39)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-55D1127401B5', 'What is the classic presentation of Inhalation → overdose -12-16yo?', 'Euphoria, not focus, impaired judgment, mood, swings, perinatal rash', 'Menopausal symptoms Menses stops, hot ﬂashes no hirsutism, no acne. What lab elevated ﬁrst, high FSH', 'Intubation, Sign by, pt & physician', 'Tardive dyskinesia leading to frog tongue like movements', 'A', 'Classic presentation of Inhalation → overdose -12-16yo: Euphoria, not focus, impaired judgment, mood, swings, perinatal rash (Dr. J notes, p61)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-55D1127401B5_V', 'A 18-year-old patient presents with Euphoria, not focus, impaired judgment, mood, swings, perinatal rash. What is the most likely diagnosis?', 'Euphoria, not focus, impaired judgment, mood, swings, perinatal rash', 'Menopausal symptoms Menses stops, hot ﬂashes no hirsutism, no acne. What lab elevated ﬁrst, high FSH', 'Intubation, Sign by, pt & physician', 'Tardive dyskinesia leading to frog tongue like movements', 'A', 'The presentation of Euphoria, not focus, impaired judgment, mood, swings, perinatal rash is classic for Inhalation → overdose -12-16yo. (Dr. J notes, p61)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-564FE655C8E1', 'What is the treatment for Rota virus?', 'Live vaccine, ages 2-4-6 months', 'Only PERCH virus which is NOT transmitted through fecal- oral route - due to acid labile', 'Is supportive', 'Ganciclovir', 'A', 'Treatment for Rota virus: Live vaccine ,  ages 2-4-6 months. Cannot make IgG. So, we give every 2 months. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-564FE655C8E1_V', 'A 45-year-old patient is diagnosed with Rota virus. The patient presents with Com. Viral cause of diarrhea in kids. Intussusception.. What is the most appropriate treatment?', 'Live vaccine, ages 2-4-6 months', 'Only PERCH virus which is NOT transmitted through fecal- oral route - due to acid labile', 'Is supportive', 'Ganciclovir', 'A', 'Treatment for Rota virus: Live vaccine ,  ages 2-4-6 months. Cannot make IgG. So, we give every 2 months. (Vignette from Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-56F1D6C06001', 'What is the classic presentation of Clostridium Difﬁcle?', 'Watery diarrhea', 'Heart block, S3, Fever, HR no change', 'Sub acute bac endocarditis regorge murmur - mitral valve', 'Capsule - typical, fast onset', 'A', 'Classic presentation of Clostridium Difﬁcle: Watery diarrhea (Dr. J notes, p44)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-56F1D6C06001_V', 'A 28-year-old patient presents to the clinic with Watery diarrhea. Which of the following is the most likely diagnosis?', 'Watery diarrhea', 'Heart block, S3, Fever, HR no change', 'Sub acute bac endocarditis regorge murmur - mitral valve', 'Capsule - typical, fast onset', 'A', 'The presentation of Watery diarrhea is classic for Clostridium Difﬁcle. (Dr. J notes, p44)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-589B6AFADCB1', 'What is the best diagnostic approach for Hairy cell leukemia?', 'TRAP cell positive', 'Biopsy test = reed Stemberg cells', 'Roulette forms, blood smear', 'Protein level = normal to low', 'A', 'Diagnosis of Hairy cell leukemia: TRAP cell positive. (Dr. J notes, p83)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-58B941261F2E', 'What is the treatment for Benzo?', 'Withdrawl, anxiety, tachycardia, TRR?', 'Vaccine & IVIG, Once symptoms start, 100% deadly', 'Digoxin ab', 'Charcoal', 'A', 'Treatment for Benzo: Withdrawl ,  anxiety, tachycardia, TRR? Rx - ﬂumazenil (Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-58B941261F2E_V', 'A 60-year-old patient with Benzo presents with Barbiturates (has↑GABA then Benzo). What is the best initial treatment?', 'Withdrawl, anxiety, tachycardia, TRR?', 'Vaccine & IVIG, Once symptoms start, 100% deadly', 'Digoxin ab', 'Charcoal', 'A', 'Treatment for Benzo: Withdrawl ,  anxiety, tachycardia, TRR? Rx - ﬂumazenil (Vignette from Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-58E8CC33A3BD', 'What is the treatment for Extrapyramidal symptoms?', '1ˢᵀ leading to acute dystonia = muscle spasm, stiffness, difﬁculty swallowing. reversible', 'Quetiapine Greatest affect on = Ziprasidone, QT prolong Weight gain (glucose intolerant) = Olanzapine List a/e =', 'Alternating between persistent depression disordered, hypomania Never hit base line, cycling', 'Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures', 'A', 'Treatment for Extrapyramidal symptoms: 1ˢᵀ → acute dystonia = muscle spasm, stiffness, difﬁculty swallowing. reversible. Rx = low dose, anti choli diphenadrymine and benztropine (Dr. J notes, p61)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-59CFC43A32DA', 'What is the treatment for Heat Exhaustion?', 'Mild hypothermia, loopy/talking, Rx, Electrolytes, IV/oral ﬂuids', 'Muscle cramps, put in shade/cool place ﬂuids, electrolytes', 'No sweating, ↑104°F , Dry & warm body, IV ﬂuid, cool down, clonazepam.Shock, Warm, septic, neurogenic Cool', 'Antidepressant, lorazepam', 'A', 'Treatment for Heat Exhaustion: Mild hypothermia, loopy/talking, Rx ,  Electrolytes, IV/oral ﬂuids (Dr. J notes, p27)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-59CFC43A32DA_V', 'A 60-year-old patient is diagnosed with Heat Exhaustion. The patient presents with Mild hypothermia, loopy/talking, Rx ,  Electrolytes, IV/oral ﬂuids. What is the most appropriate treatment?', 'Mild hypothermia, loopy/talking, Rx, Electrolytes, IV/oral ﬂuids', 'Muscle cramps, put in shade/cool place ﬂuids, electrolytes', 'No sweating, ↑104°F , Dry & warm body, IV ﬂuid, cool down, clonazepam.Shock, Warm, septic, neurogenic Cool', 'Antidepressant, lorazepam', 'A', 'Treatment for Heat Exhaustion: Mild hypothermia, loopy/talking, Rx ,  Electrolytes, IV/oral ﬂuids (Vignette from Dr. J notes, p27)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5AED1E8320C5', 'What is the treatment for Obstructive lung disease?', 'X-Ray = tram tracking, bronchial dilatation Emphysema, norm to decreased, O₂, CO₂ ↑, PH ↓', 'Calciﬁcation in lower lobe (unless that is a superman :P)↘ Bx - ferruginous bodies Asbestosis, adenocarcinoma', 'Hyperventilation, dry cough, lung vol small', 'Diffusion problem', 'A', 'Treatment for Obstructive lung disease: X-Ray = tram tracking, bronchial dilatation Emphysema ,  norm to decreased ,  O₂, CO₂ ↑, PH ↓ ,  Starts restrictive and reach obstruction. ,  ↓DLCO, A-... (Dr. J notes, p126)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5AED1E8320C5_V', 'A 40-year-old patient is diagnosed with Obstructive lung disease. The patient presents with RV↑, TLC↑. What is the most appropriate treatment?', 'X-Ray = tram tracking, bronchial dilatation Emphysema, norm to decreased, O₂, CO₂ ↑, PH ↓', 'Calciﬁcation in lower lobe (unless that is a superman :P)↘ Bx - ferruginous bodies Asbestosis, adenocarcinoma', 'Hyperventilation, dry cough, lung vol small', 'Diffusion problem', 'A', 'Treatment for Obstructive lung disease: X-Ray = tram tracking, bronchial dilatation Emphysema ,  norm to decreased ,  O₂, CO₂ ↑, PH ↓ ,  Starts restrictive and reach obstruction. ,  ↓DLCO, A-... (Vignette from Dr. J notes, p126)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5AF904F07868', 'What is a key risk factor or cause of Lactose non fermenter?', 'UTIs, Pyelonephritis, cystitis', 'PH alkalotic, risk for staghorn calculi', 'If in baby, non migration of Auerbach plex, congenital', 'Pylori, NSAIDs, spicy food', 'A', 'Risk factor for Lactose non fermenter: Cause ,  UTIs, Pyelonephritis, cystitis (Dr. J notes, p47)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5B49619FD516', 'What is the treatment for Clostridium botulinum?', 'Baby from honey < 6-month-old', 'O2, debridement, IV antibiotics', 'IV, metronidazole - blood prob Oral, Vanco, Fenoxamycin', 'Aggravated at menses / chron’s, iron deﬁciency (', 'A', 'Treatment for Clostridium botulinum: Baby from honey < 6-month-old. Rx - antitoxin, respiration support. (Dr. J notes, p44)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5B66B0AB86CB', 'What is the treatment for Adenovirus?', 'Is supportive', 'Tx, Fecal oral', 'Only PERCH virus which is NOT transmitted through fecal- oral route - due to acid labile', 'Valpatsavir', 'A', 'Treatment for Adenovirus: Rx is supportive. (Dr. J notes, p35)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5C71681EBF1F', 'What is the classic presentation of Choledocholithiasis?', 'RUQ pain (not going away this time)', 'Klebsiella = capsulated, productive pneumonia (typical), currant jelly sputum, also cause, UTI, Tertiary', 'New onset of diabetes and arthritis, restrictive cardiomyopathy', 'Bloody diarrhea', 'A', 'Classic presentation of Choledocholithiasis: RUQ pain (not going away this time) (Dr. J notes, p54)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5C71681EBF1F_V', 'A 3-year-old patient is brought to the ED with RUQ pain (not going away this time). The most likely diagnosis is:', 'RUQ pain (not going away this time)', 'Klebsiella = capsulated, productive pneumonia (typical), currant jelly sputum, also cause, UTI, Tertiary', 'New onset of diabetes and arthritis, restrictive cardiomyopathy', 'Bloody diarrhea', 'A', 'The presentation of RUQ pain (not going away this time) is classic for Choledocholithiasis. (Dr. J notes, p54)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5C864A80F940', 'What is the classic presentation of Psoriasis?', 'Silvery rash Osteophytes', 'Pain and swelling, fever, warmness & redness in that area Most common bug - Steph Aureus, sickle cell - salmonella', '> 50yo, Back pain, hat not ﬁt, hearing problem Alk phosphate ↑, X-ray sclerotic lessions', 'Pain, tenderness base of both thumbs = quad tender servitis (sinusitis)', 'A', 'Classic presentation of Psoriasis: Silvery rash Osteophytes (Dr. J notes, p21)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5C864A80F940_V', 'A 75-year-old patient is brought to the ED with Silvery rash Osteophytes. The most likely diagnosis is:', 'Silvery rash Osteophytes', 'Pain and swelling, fever, warmness & redness in that area Most common bug - Steph Aureus, sickle cell - salmonella', '> 50yo, Back pain, hat not ﬁt, hearing problem Alk phosphate ↑, X-ray sclerotic lessions', 'Pain, tenderness base of both thumbs = quad tender servitis (sinusitis)', 'A', 'The presentation of Silvery rash Osteophytes is classic for Psoriasis. (Dr. J notes, p21)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5D54DF525C9D', 'What is the mechanism of Antibacterial?', 'Sulfonamides, folic acid synthesis, inhibit metabolism', 'Mutation of APC tumor suppressor gene on chromosome 5q21-q22', 'Autoimmune response, Gliadin', 'Receptor doesn’t upregulate enzyme', 'A', 'Mechanism of Antibacterial: Sulfonamides ,  folic acid synthesis, inhibit metabolism. (Dr. J notes, p44)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5D5C546A3953', 'What is the classic presentation of Child?', 'Hx, Not vaccinated or missed vaccines', 'Due to sphincter being weak', 'Bloody diarrhea, abd pain, No vit def, erythema nodosum', 'Heart block, S3, Fever, HR no change', 'A', 'Classic presentation of Child: Hx ,  Not vaccinated or missed vaccines (Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5D5C546A3953_V', 'A 40-year-old patient presents with Hx ,  Not vaccinated or missed vaccines. What is the most likely diagnosis?', 'Hx, Not vaccinated or missed vaccines', 'Due to sphincter being weak', 'Bloody diarrhea, abd pain, No vit def, erythema nodosum', 'Heart block, S3, Fever, HR no change', 'A', 'The presentation of Hx ,  Not vaccinated or missed vaccines is classic for Child. (Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5DDCFD8C0FF9', 'What is a key risk factor or cause of Causes?', 'Other bugs cause NF, staph Aureus and Clostridium perfringens', 'Cancer risk ↑↑', 'PH alkalotic, risk for staghorn calculi', 'Genetic or trauma (car accident steering hit)', 'A', 'Risk factor for Causes: Other bugs cause NF ,  staph Aureus and Clostridium perfringens (Dr. J notes, p43)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5E6725113AEF', 'What is the best diagnostic approach for Obstructive lung disease?', 'CT- honey combing', 'Diffusion problem', 'Hyperventilation, dry cough, lung vol small', 'X-Ray = tram tracking, bronchial dilatation Emphysema, norm to decreased, O₂, CO₂ ↑, PH ↓', 'A', 'Diagnosis of Obstructive lung disease: CT- honey combing, (Dr. J notes, p126)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5E6725113AEF_V', 'A 70-year-old patient presents with RV↑, TLC↑. What is the most accurate diagnostic approach?', 'CT- honey combing', 'Diffusion problem', 'Hyperventilation, dry cough, lung vol small', 'X-Ray = tram tracking, bronchial dilatation Emphysema, norm to decreased, O₂, CO₂ ↑, PH ↓', 'A', 'Diagnosis of Obstructive lung disease: CT- honey combing, (Vignette from Dr. J notes, p126)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5E962E1394AE', 'What is the treatment for Acute tubular necrosis?', 'Muddy brown, granular #1 Cause = blood loss', 'Hematuria, allergy like sx cause = drugs allergy cast - eosinophil casts Rx, ﬂuids, steroid, stop drug which causing it', 'Giardia (never enters body), hard to Rx', 'Urine turns black Homogentisic acid def; take out phenylalanine and tyrosine', 'A', 'Treatment for Acute tubular necrosis: Muddy brown, granular #1 Cause = blood loss. Rx - lost of ﬂuids (Dr. J notes, p93)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5E962E1394AE_V', 'A 55-year-old patient with Acute tubular necrosis presents with Muddy brown, granular #1 Cause = blood loss. Rx - lost of ﬂuids. What is the best initial treatment?', 'Muddy brown, granular #1 Cause = blood loss', 'Hematuria, allergy like sx cause = drugs allergy cast - eosinophil casts Rx, ﬂuids, steroid, stop drug which causing it', 'Giardia (never enters body), hard to Rx', 'Urine turns black Homogentisic acid def; take out phenylalanine and tyrosine', 'A', 'Treatment for Acute tubular necrosis: Muddy brown, granular #1 Cause = blood loss. Rx - lost of ﬂuids (Vignette from Dr. J notes, p93)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5EAAC6805319', 'What is the treatment for Strep. Viridians?', 'Amoxicillin - cell wall synthesis', 'Pneumococcal vaccine = 23/13, nub of String it covers, 23 covers most of it (98%)', 'Infected by = Hip implant, valve replace, IV catheters', 'FLuid, antibiotics, surgery', 'A', 'Treatment for Strep. Viridians: Amoxicillin - cell wall synthesis. (Dr. J notes, p43)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5EAAC6805319_V', 'A 28-year-old patient with known Strep. Viridians comes in with Cause - Sub acute bac endocarditis regorge murmur - mitral valve. Which treatment is most appropriate?', 'Amoxicillin - cell wall synthesis', 'Pneumococcal vaccine = 23/13, nub of String it covers, 23 covers most of it (98%)', 'Infected by = Hip implant, valve replace, IV catheters', 'FLuid, antibiotics, surgery', 'A', 'Treatment for Strep. Viridians: Amoxicillin - cell wall synthesis. (Vignette from Dr. J notes, p43)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5ECF70D25BB8', 'What is the treatment for Alcohol?', 'Benzo (short acting), liver issues Benzo, long acting, if no liver damage', 'N- acetyl cysteine, disulﬁde bonds', 'Fomepizole - IV, ⊖ Alcohol dehydrogenase', 'Rx, debridement, lots of ﬂuids, diuretics, mannitol', 'A', 'Treatment for Alcohol: Rx ,  benzo (short acting) ,  liver issues Benzo ,  long acting ,  if no liver damage (Dr. J notes, p30)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5EF91A0A1A6D', 'What is the classic presentation of Wasp bee Sting?', 'Tingling, burning, local swelling', 'Big ones, tingling pain Rx, Antihistamine, HTZ cream', 'Fever , nausea severe ﬂu like symptoms', 'Hemotoxin, makes u bleed out', 'A', 'Classic presentation of Wasp bee Sting: Tingling, burning, local swelling (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5EF91A0A1A6D_V', 'A 60-year-old patient presents to the clinic with Tingling, burning, local swelling. Which of the following is the most likely diagnosis?', 'Tingling, burning, local swelling', 'Big ones, tingling pain Rx, Antihistamine, HTZ cream', 'Fever , nausea severe ﬂu like symptoms', 'Hemotoxin, makes u bleed out', 'A', 'The presentation of Tingling, burning, local swelling is classic for Wasp bee Sting. (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-5F9547665925', 'What is the treatment for Pt?', 'Bug, chlamydia trachomatis rx - azithro', 'Dx, Epiglottitis, Thumb sign,; Intubate and vaccine Not vaccinated, H', 'To ↓portal hypertension, Octreotide and antibiotics, due to low immunity', 'Doxy', 'A', 'Treatment for Pt: Bug ,  chlamydia trachomatis rx - azithro (Dr. J notes, p48)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-603CB8F8DCFB', 'What is the treatment for Panic attack?', 'Palpitation', 'Quetiapine Greatest affect on = Ziprasidone, QT prolong Weight gain (glucose intolerant) = Olanzapine List a/e =', 'Thioridazine, chlorpromazine Not give to old pt', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'A', 'Treatment for Panic attack: Palpitation. Rx = benzo. (Dr. J notes, p63)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-603CB8F8DCFB_V', 'A 18-year-old patient is diagnosed with Panic attack. The patient presents with Palpitation. Rx = benzo.. What is the most appropriate treatment?', 'Palpitation', 'Quetiapine Greatest affect on = Ziprasidone, QT prolong Weight gain (glucose intolerant) = Olanzapine List a/e =', 'Thioridazine, chlorpromazine Not give to old pt', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'A', 'Treatment for Panic attack: Palpitation. Rx = benzo. (Vignette from Dr. J notes, p63)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-60C262AF333B', 'What is a key risk factor or cause of UTIs for protease cause?', 'PH alkalotic, risk for staghorn calculi', 'UTIs, Pyelonephritis, cystitis', 'Pylori, NSAIDs, spicy food', 'Cystic ﬁbrosis, cause pneumonia after 20', 'A', 'Risk factor for UTIs for protease cause: PH alkalotic, risk for staghorn calculi (Dr. J notes, p47)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-622AE4D2ECDA', 'What is the classic presentation of Parasympathetic?', 'Most of then are muscarinic, (Nicotinic are , autonomic ganglia and neuromuscular junction) Px - DUMBBELSS - Diarrhea', 'Predominantly, cAMP (low dose)', '> 50yo, Back pain, hat not ﬁt, hearing problem Alk phosphate ↑, X-ray sclerotic lessions', 'Severe back pain , worse with lean down, fever, ↑HR, ↓BP = spinal abscess', 'A', 'Classic presentation of Parasympathetic: Most of then are muscarinic, (Nicotinic are , autonomic ganglia and neuromuscular junction) Px - DUMBBELSS - Diarrhea, Urination, Miosis, Bronchospa... (Dr. J notes, p17)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-622AE4D2ECDA_V', 'A 75-year-old patient presents to the clinic with Most of then are muscarinic, (Nicotinic are , autonomic ganglia and neuromuscular junction) Px - DUMBBELSS - Diarrhea, Ur. Which of the following is the most likely diagnosis?', 'Most of then are muscarinic, (Nicotinic are , autonomic ganglia and neuromuscular junction) Px - DUMBBELSS - Diarrhea', 'Predominantly, cAMP (low dose)', '> 50yo, Back pain, hat not ﬁt, hearing problem Alk phosphate ↑, X-ray sclerotic lessions', 'Severe back pain , worse with lean down, fever, ↑HR, ↓BP = spinal abscess', 'A', 'The presentation of Most of then are muscarinic, (Nicotinic are , autonomic ganglia and neuromuscular junction) Px - DUMBBELSS - Diarrhea, Ur is classic for Parasympathetic. (Dr. J notes, p17)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6473C7A648C2', 'What is the treatment for Psoriasis?', 'Topical salicylic acid', 'Steroid, and Type 1 Hypersensitivity reaction', 'Topical selenium sulﬁde, ketoconazole', 'Topical azoles, selenium sulﬁde', 'A', 'Treatment for Psoriasis: Topical salicylic acid. (Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6473C7A648C2_V', 'A 58-year-old patient with Psoriasis presents with Auzpits sign ,  leison comes off and pin point bleeding. What is the best initial treatment?', 'Topical salicylic acid', 'Steroid, and Type 1 Hypersensitivity reaction', 'Topical selenium sulﬁde, ketoconazole', 'Topical azoles, selenium sulﬁde', 'A', 'Treatment for Psoriasis: Topical salicylic acid. (Vignette from Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-64AA3B22720C', 'What is the best diagnostic approach for Plummer Vinson (Upper esophagus)?', 'Barium, Dx- Narrowing of upper esophagus', 'If Dx Or chance of H.E', 'X-ray = Gallstone in cystic duct, inﬂamed', 'Bordetella pertussis', 'A', 'Diagnosis of Plummer Vinson (Upper esophagus): Barium ,  Dx- Narrowing of upper esophagus (Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-64E7D9B7BC07', 'What is the classic presentation of Seborrheic keratosis , AD?', 'Common in older, but if many appear in short period, rule out cancer', 'Red ﬂaky, non-tender, sun exposed area', 'But enzyme def', 'Itchy; treatment: antihistamines', 'A', 'Classic presentation of Seborrheic keratosis , AD: Common in older ,  but if many appear in short period ,  rule out cancer (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-64E7D9B7BC07_V', 'A 16-year-old patient presents with Common in older ,  but if many appear in short period ,  rule out cancer. What is the most likely diagnosis?', 'Common in older, but if many appear in short period, rule out cancer', 'Red ﬂaky, non-tender, sun exposed area', 'But enzyme def', 'Itchy; treatment: antihistamines', 'A', 'The presentation of Common in older ,  but if many appear in short period ,  rule out cancer is classic for Seborrheic keratosis , AD. (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6511B428216C', 'What is the treatment for Pt with High fever, E?', 'Dx, Epiglottitis, Thumb sign,; Intubate and vaccine Not vaccinated, H', 'Bug, chlamydia trachomatis rx - azithro', 'Infected by = Hip implant, valve replace, IV catheters', 'Prophylaxis vaccine to family', 'A', 'Treatment for Pt with High fever, E: Dx,  Epiglottitis ,  Thumb sign, Rx- Intubate and vaccine Not vaccinated ,  H. Inﬂuenza, Vaccinated - Staph aureus (Dr. J notes, p45)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-667982B8FFB1', 'What is the classic presentation of Corynebacterium diphtheriae?', 'Heart block, S3, Fever, HR no change', 'We can prevent Heart block with like rheumatic fever - regorge murmur but cannot prevent PSGN', 'Watery diarrhea', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', 'A', 'Classic presentation of Corynebacterium diphtheriae: Cause ,  heart block, S3, Fever, HR no change. Rx - ceftriaxzon if heart block, mecrolides (Dr. J notes, p44)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-667982B8FFB1_V', 'A 65-year-old patient is brought to the ED with Cause ,  heart block, S3, Fever, HR no change. Rx - ceftriaxzon if heart block, mecrolides. The most likely diagnosis is:', 'Heart block, S3, Fever, HR no change', 'We can prevent Heart block with like rheumatic fever - regorge murmur but cannot prevent PSGN', 'Watery diarrhea', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', 'A', 'The presentation of Cause ,  heart block, S3, Fever, HR no change. Rx - ceftriaxzon if heart block, mecrolides is classic for Corynebacterium diphtheriae. (Dr. J notes, p44)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-678760FE3550', 'What is the best diagnostic approach for Persistent Depressive disorder?', '> 2 year of low level sadness, dysthymia; CBT', 'Hallucination, synesthsesia, test colors, euphoria, panic', 'Irreversible Tumor marker = KI 67BenignMalignant 90% of tumors10% of tumors Freely mobile FixedWell circumscribed Not', 'Boys, 6-7yo, girls, 12yo > 6 months limited attention Hyperactive, impulsivity > 2 settings', 'A', 'Diagnosis of Persistent Depressive disorder: > 2 year of low level sadness, dysthymia. Rx - CBT. Doesn’t meet SIGECAPS. (Dr. J notes, p63)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-678760FE3550_V', 'A 22-year-old patient is evaluated for > 2 year of low level sadness, dysthymia. Rx - CBT. Doesn’t meet SIGECAPS.. Which diagnostic study should be ordered first?', '> 2 year of low level sadness, dysthymia; CBT', 'Hallucination, synesthsesia, test colors, euphoria, panic', 'Irreversible Tumor marker = KI 67BenignMalignant 90% of tumors10% of tumors Freely mobile FixedWell circumscribed Not', 'Boys, 6-7yo, girls, 12yo > 6 months limited attention Hyperactive, impulsivity > 2 settings', 'A', 'Diagnosis of Persistent Depressive disorder: > 2 year of low level sadness, dysthymia. Rx - CBT. Doesn’t meet SIGECAPS. (Vignette from Dr. J notes, p63)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-67A73C582921', 'What is the classic presentation of Multiple Myeloma?', 'Older pt. with chronic back pain, rule out MM', 'Px , Old pt, Diabetes, bleeding when drawing blood', 'Severe headache', 'Altered mental status, abd pain, headaches, irritable', 'A', 'Classic presentation of Multiple Myeloma: Older pt. with chronic back pain ,  rule out MM (Dr. J notes, p115)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-67A73C582921_V', 'A 60-year-old patient presents to the clinic with Older pt. with chronic back pain ,  rule out MM. Which of the following is the most likely diagnosis?', 'Older pt. with chronic back pain, rule out MM', 'Px , Old pt, Diabetes, bleeding when drawing blood', 'Severe headache', 'Altered mental status, abd pain, headaches, irritable', 'A', 'The presentation of Older pt. with chronic back pain ,  rule out MM is classic for Multiple Myeloma. (Dr. J notes, p115)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-67D637D6C798', 'What is the treatment for Hep B associated with?', 'Interferon and Tenofovir', 'Ganciclovir', 'Aggressive, Rota (Vaccine every 2 months in kids unto 6 months), inﬂuenza A', 'HART therapy', 'A', 'Treatment for Hep B associated with: Interferon and Tenofovir. - chronic hep.B (Dr. J notes, p35)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-67D637D6C798_V', 'A 5-year-old patient is diagnosed with Hep B associated with. The patient presents with A) MPGN, membranous b) Polyarteritis nodosac) cold agglutinin hemolysis, d) cryoglobulinemia. What is the most appropriate treatment?', 'Interferon and Tenofovir', 'Ganciclovir', 'Aggressive, Rota (Vaccine every 2 months in kids unto 6 months), inﬂuenza A', 'HART therapy', 'A', 'Treatment for Hep B associated with: Interferon and Tenofovir. - chronic hep.B (Vignette from Dr. J notes, p35)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-689CAD593063', 'What is a key risk factor or cause of H e p C?', 'Chronic, risk of cancer', 'Avoid contact sports, due to splenomegaly (risk of rupture)', 'Less likely to cause cancer, replicated in cytoplasm', '#1 diarrheal cause in kids, can be serious in babies', 'A', 'Risk factor for H e p C: Chronic ,  risk of cancer. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6914CF5A15B5', 'What is the treatment for Acne?', 'Oral antibiotics', 'No pain, when looks sideways', 'Oral Griseofulvin, oral ketoconazole, itraconazole, isosulfate', 'Oral Neuroma (mucosal neuroma)', 'A', 'Treatment for Acne: Oral antibiotics (Dr. J notes, p6)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6914CF5A15B5_V', 'A 70-year-old patient with Acne presents with Cheeks, neck back -. What is the best initial treatment?', 'Oral antibiotics', 'No pain, when looks sideways', 'Oral Griseofulvin, oral ketoconazole, itraconazole, isosulfate', 'Oral Neuroma (mucosal neuroma)', 'A', 'Treatment for Acne: Oral antibiotics (Vignette from Dr. J notes, p6)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-694990B0B6AA', 'What is the treatment for Black widow Spider?', 'Iv ca 2 gluconate + anti venom', 'Dapsone, debridement', 'Give with Ⓝ saline', 'Mild hypothermia, loopy/talking, Rx, Electrolytes, IV/oral ﬂuids', 'A', 'Treatment for Black widow Spider: Rx ,  Iv ca 2 gluconate + anti venom (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-69B3DC73DCDB', 'What is the classic presentation of Trigeminal neuralgia?', 'Even wind blow, pain', 'Due to sphincter being weak', 'Pea soup colored diarrhea', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', 'A', 'Classic presentation of Trigeminal neuralgia: Even wind blow, pain (Dr. J notes, p50)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-69B3DC73DCDB_V', 'A 40-year-old patient presents to the clinic with Even wind blow, pain. Which of the following is the most likely diagnosis?', 'Even wind blow, pain', 'Due to sphincter being weak', 'Pea soup colored diarrhea', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', 'A', 'The presentation of Even wind blow, pain is classic for Trigeminal neuralgia. (Dr. J notes, p50)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6A0EC8AB0ACB', 'What is the treatment for Cryoglobinemia?', 'Treat the bug', 'B6 supplement, underlying cause if any', 'Supplement B12, vegans, and pts with bariatric Sx', 'Hydroxy urea', 'A', 'Treatment for Cryoglobinemia: Treat the bug (Dr. J notes, p112)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6A0EC8AB0ACB_V', 'A 60-year-old patient is diagnosed with Cryoglobinemia. The patient presents with Hematuria, rash, joint pain. What is the most appropriate treatment?', 'Treat the bug', 'B6 supplement, underlying cause if any', 'Supplement B12, vegans, and pts with bariatric Sx', 'Hydroxy urea', 'A', 'Treatment for Cryoglobinemia: Treat the bug (Vignette from Dr. J notes, p112)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6A19C67D292C', 'What is the classic presentation of Sympathetic?', 'Predominantly, cAMP (low dose)', 'Most of then are muscarinic, (Nicotinic are , autonomic ganglia and neuromuscular junction) Px - DUMBBELSS - Diarrhea', 'Joint pain, Salmon color rash, Rheumatoid factor , ve', 'After age 5, muscle weakness and ensuing gait abnormalities with miss sense Non frameshift mutation, no gowers sign', 'A', 'Classic presentation of Sympathetic: Predominantly ,  cAMP (low dose). muscarenic ,  (Sweat gland & adrenal medulla). (Dr. J notes, p17)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6A19C67D292C_V', 'A 65-year-old patient presents to the clinic with Predominantly ,  cAMP (low dose). muscarenic ,  (Sweat gland & adrenal medulla).. Which of the following is the most likely diagnosis?', 'Predominantly, cAMP (low dose)', 'Most of then are muscarinic, (Nicotinic are , autonomic ganglia and neuromuscular junction) Px - DUMBBELSS - Diarrhea', 'Joint pain, Salmon color rash, Rheumatoid factor , ve', 'After age 5, muscle weakness and ensuing gait abnormalities with miss sense Non frameshift mutation, no gowers sign', 'A', 'The presentation of Predominantly ,  cAMP (low dose). muscarenic ,  (Sweat gland & adrenal medulla). is classic for Sympathetic. (Dr. J notes, p17)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6A4C32C8DBD2', 'What is the treatment for Arterial clot?', 'Aspirin, dicloccicillin, clopidogrel', 'Heparin and warfarin', 'None', 'B6 supplement, underlying cause if any', 'A', 'Treatment for Arterial clot: Aspirin, dicloccicillin, clopidogrel (Dr. J notes, p107)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6ADA38DC597A', 'What is the best diagnostic approach for Cold agglutinin hemolysis?', 'Rituximab, PPD +ve, do x-ray', 'Smear, spherocytes', 'Blue iron stain in smear', 'In smear, Heinz bodies', 'A', 'Diagnosis of Cold agglutinin hemolysis: Rx ,  Rituximab ,  PPD +ve, do x-ray (Dr. J notes, p112)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6AFA9C9AB1B9', 'What is the best diagnostic approach for Sq cell carcinoma?', 'Non healing ulcer, ﬂaky red in lower part of face, biopsy', 'Punch biopsy', 'Slit lamp test', 'Wet type, due to neovascularization, blurry vision If non proliferative, no vision effects VEG-F inhibitors', 'A', 'Diagnosis of Sq cell carcinoma: Non healing ulcer, ﬂaky red in lower part of face ,  biopsy. And surgically excise it (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6B1A95CA5871', 'What is the classic presentation of Walden storm?', 'Back pain - But X- ray normal', 'So excess absorption of water, less sodium to the ratio of water present in the body', 'B cells and neutrophils, gets sick quicker, High fever', 'Hx of sinopulmonary infection', 'A', 'Classic presentation of Walden storm: Back pain - But X- ray normal. (Dr. J notes, p84)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6B1A95CA5871_V', 'A 8-year-old patient presents with Back pain - But X- ray normal.. What is the most likely diagnosis?', 'Back pain - But X- ray normal', 'So excess absorption of water, less sodium to the ratio of water present in the body', 'B cells and neutrophils, gets sick quicker, High fever', 'Hx of sinopulmonary infection', 'A', 'The presentation of Back pain - But X- ray normal. is classic for Walden storm. (Dr. J notes, p84)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6B8DDF1717F0', 'What is the mechanism of What release from M line?', 'CPK - creatine phosphate kinase', 'How many joints involve mono = osteoarthritis, gout, septic arthritis Oligo (just couple joints) = spondylopathy', 'How many joints involve mono = osteoarthritis, gout', 'C1q, complement = low', 'A', 'Mechanism of What release from M line: CPK - creatine phosphate kinase (Dr. J notes, p18)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6D3B573B8720', 'What is the best diagnostic approach for BBB?', 'Location stimulated by dopamine Respond to taste and smell.Sturge weber syndrome, neurocutenous', 'Neck stiffness, photophobia, altered mental status', 'Symptomatic, ataxia, spingomyelia, pain and temperature loss bilateral', 'Night terrors, sleep walking, teeth grinding increase intracraneal pressure, nausea, headache First sign', 'A', 'Diagnosis of BBB: Location stimulated by dopamine Respond to taste and smell.Sturge weber syndrome ,  neurocutenous ,  CV 5 involve born with port wine stain, Sx - sei... (Dr. J notes, p138)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6D3B573B8720_V', 'A 60-year-old patient presents with Location stimulated by dopamine Respond to taste and smell.Sturge weber syndrome ,  neurocutenous ,  CV 5 involve born wit. What is the most accurate diagnostic approach?', 'Location stimulated by dopamine Respond to taste and smell.Sturge weber syndrome, neurocutenous', 'Neck stiffness, photophobia, altered mental status', 'Symptomatic, ataxia, spingomyelia, pain and temperature loss bilateral', 'Night terrors, sleep walking, teeth grinding increase intracraneal pressure, nausea, headache First sign', 'A', 'Diagnosis of BBB: Location stimulated by dopamine Respond to taste and smell.Sturge weber syndrome ,  neurocutenous ,  CV 5 involve born with port wine stain, Sx - sei... (Vignette from Dr. J notes, p138)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6D6BD47613F3', 'What is a key risk factor or cause of Erythema infectiosum?', 'In pregnancy, can cause hydrops fetalis', '↓ 21𝝰 hydroxylase, ↑17-Hydroxy pro', 'New leison, cause psoriasis in that location, Koebner phenomenon', 'At gland - parathyroid adenoma Ca⁺↑, PO₄⁺↓, PTH↑ Chief cell adenoma of parathyroid', 'A', 'Risk factor for Erythema infectiosum: In pregnancy ,  can cause hydrops fetalis (Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6DA5ABA6E292', 'What is the classic presentation of Scarlet fever?', 'Sandpaper-like body rash (palms and sole), strawberry tongue', 'Rash, adrenal hemorrhage, Neiserria meningitides, nausea vomiting photophobia, neck stiffness', 'Itchy; treatment: antihistamines', 'Rash moving towards heart', 'A', 'Classic presentation of Scarlet fever: Sandpaper-like body rash (palms and sole), strawberry tongue Rx = penicillin Bullous impetigo - caused bt staph toxin (Dr. J notes, p6)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6DA5ABA6E292_V', 'A 58-year-old patient presents with Sandpaper-like body rash (palms and sole), strawberry tongue Rx = penicillin Bullous impetigo - caused bt staph toxin. What is the most likely diagnosis?', 'Sandpaper-like body rash (palms and sole), strawberry tongue', 'Rash, adrenal hemorrhage, Neiserria meningitides, nausea vomiting photophobia, neck stiffness', 'Itchy; treatment: antihistamines', 'Rash moving towards heart', 'A', 'The presentation of Sandpaper-like body rash (palms and sole), strawberry tongue Rx = penicillin Bullous impetigo - caused bt staph toxin is classic for Scarlet fever. (Dr. J notes, p6)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6DBFC9753C8C', 'What is the classic presentation of Esophageal spasm?', 'Chest pain', 'Even wind blow, pain', 'Legionella, gastroenteritis, Decreases Na+, of diarrhea', 'Diarrhea toxin, >18hrs - Left out meat and sauces', 'A', 'Classic presentation of Esophageal spasm: Chest pain, (Dr. J notes, p53)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6DBFC9753C8C_V', 'A 3-year-old patient presents to the clinic with Chest pain,. Which of the following is the most likely diagnosis?', 'Chest pain', 'Even wind blow, pain', 'Legionella, gastroenteritis, Decreases Na+, of diarrhea', 'Diarrhea toxin, >18hrs - Left out meat and sauces', 'A', 'The presentation of Chest pain, is classic for Esophageal spasm. (Dr. J notes, p53)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6DF467B91CCC', 'What is the best diagnostic approach for AML ,  Bimodal ,  15?', 'Auer rods in smear', 'B.I, biopsy, reed stern berg cells', 'TRAP positive', 'Most accurate test, B12 level or we check for homocysteine and methylmalonic acid', 'A', 'Diagnosis of AML ,  Bimodal ,  15: Auer rods in smear (Dr. J notes, p114)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6E7595D526BD', 'What is the treatment for H e p A ,  fecal?', 'Prophylaxis vaccine to family', 'ACUTE hep C', 'Liver transplant', '0-2 months old, chlamydia', 'A', 'Treatment for H e p A ,  fecal: Prophylaxis vaccine to family (Dr. J notes, p55)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6EB92BB15F25', 'What is the treatment for other pathology?', 'MRSTCS mix connective tissue, RA, SLE, takayasu, CREST, Scleroderma,', 'After menopause, >55 Osteoclast problem', 'History of duodenal ulcer - acute gout', 'Muscle pain, not true autoimmune C- normal, rx - stop drug „ Anti histon-antibody, complement level normalhydrolasin', 'A', 'Treatment for other pathology: MRSTCS mix connective tissue, RA, SLE, takayasu, CREST, Scleroderma, Rx - Ca⁺ blockers - nifedipine (Dr. J notes, p20)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6EB92BB15F25_V', 'A 65-year-old patient is diagnosed with other pathology. The patient presents with MRSTCS mix connective tissue, RA, SLE, takayasu, CREST, Scleroderma, Rx - Ca⁺ blockers - nifedipine. What is the most appropriate treatment?', 'MRSTCS mix connective tissue, RA, SLE, takayasu, CREST, Scleroderma,', 'After menopause, >55 Osteoclast problem', 'History of duodenal ulcer - acute gout', 'Muscle pain, not true autoimmune C- normal, rx - stop drug „ Anti histon-antibody, complement level normalhydrolasin', 'A', 'Treatment for other pathology: MRSTCS mix connective tissue, RA, SLE, takayasu, CREST, Scleroderma, Rx - Ca⁺ blockers - nifedipine (Vignette from Dr. J notes, p20)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6EE5ECDE8923', 'What is the treatment for PCP?', 'Benzo', 'Vaccine & IVIG, Once symptoms start, 100% deadly', 'Give Thiamine 1st than glucose', 'Thiosulfate, Hydroxocobalamin', 'A', 'Treatment for PCP: Rx ,  Benzo (Dr. J notes, p30)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6EE5ECDE8923_V', 'A 50-year-old patient is diagnosed with PCP. The patient presents with Impaired judgement, No withdrawal. What is the most appropriate treatment?', 'Benzo', 'Vaccine & IVIG, Once symptoms start, 100% deadly', 'Give Thiamine 1st than glucose', 'Thiosulfate, Hydroxocobalamin', 'A', 'Treatment for PCP: Rx ,  Benzo (Vignette from Dr. J notes, p30)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6F2203BE00AC', 'What is the treatment for HSV-2?', 'Acyclovir, famciclovir, for future outbreak', 'Acyclovir - needs thymidylate kinase', 'Supportive', 'Live vaccine, ages 2-4-6 months', 'A', 'Treatment for HSV-2: Acyclovir, famciclovir ,  for future outbreak. (Dr. J notes, p32)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6F2203BE00AC_V', 'A 8-year-old patient is diagnosed with HSV-2. The patient presents with Painful. What is the most appropriate treatment?', 'Acyclovir, famciclovir, for future outbreak', 'Acyclovir - needs thymidylate kinase', 'Supportive', 'Live vaccine, ages 2-4-6 months', 'A', 'Treatment for HSV-2: Acyclovir, famciclovir ,  for future outbreak. (Vignette from Dr. J notes, p32)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6F32ED01D486', 'What is the treatment for Heat Stroke?', 'No sweating, ↑104°F , Dry & warm body, IV ﬂuid, cool down, clonazepam.Shock, Warm, septic, neurogenic Cool', 'Muscle cramps, put in shade/cool place ﬂuids, electrolytes', 'Mild hypothermia, loopy/talking, Rx, Electrolytes, IV/oral ﬂuids', 'Give Thiamine 1st than glucose', 'A', 'Treatment for Heat Stroke: No sweating, ↑104°F , Dry & warm body ,  IV ﬂuid, cool down, clonazepam.Shock ,  Warm ,  septic, neurogenic Cool ,  hemorrhagic/ hypovolemic, cardiogen... (Dr. J notes, p27)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6F32ED01D486_V', 'A 60-year-old patient is diagnosed with Heat Stroke. The patient presents with No sweating, ↑104°F , Dry & warm body ,  IV ﬂuid, cool down, clonazepam.Shock ,  Warm ,  septic, neurogenic Cool ,  hemorrha. What is the most appropriate treatment?', 'No sweating, ↑104°F , Dry & warm body, IV ﬂuid, cool down, clonazepam.Shock, Warm, septic, neurogenic Cool', 'Muscle cramps, put in shade/cool place ﬂuids, electrolytes', 'Mild hypothermia, loopy/talking, Rx, Electrolytes, IV/oral ﬂuids', 'Give Thiamine 1st than glucose', 'A', 'Treatment for Heat Stroke: No sweating, ↑104°F , Dry & warm body ,  IV ﬂuid, cool down, clonazepam.Shock ,  Warm ,  septic, neurogenic Cool ,  hemorrhagic/ hypovolemic, cardiogen... (Vignette from Dr. J notes, p27)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6F3E7F37148D', 'What is the mechanism of MEN 2B?', '1P , > Medullary thyroid carcinoma [RET Gene]', '2P , > RET Gene mutation', '↓ Glucagon release , GLP-1 agonist', 'T₄ have receptor on nucleus', 'A', 'Mechanism of MEN 2B: 1P , > Medullary thyroid carcinoma [RET Gene] (Dr. J notes, p14)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-6FC923BF29DF', 'What is the treatment for Ethylene glycol Toxicity,  anti freeze?', 'Fomepizole, IV', 'N- acetyl cysteine, disulﬁde bonds', 'Due P450 , > DH feb', 'Withdrawl, anxiety, tachycardia, TRR?', 'A', 'Treatment for Ethylene glycol Toxicity,  anti freeze: Rx ,  Fomepizole ,  IV (Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7050E3E02B7A', 'What is the classic presentation of Lymphadenitis?', 'Cervical, if treated with amoxicillin, come back with rash', 'Cutaneous black lesions, spiking fever, anemia, hepatosplenomegaly', '3-4 days of fever sore throat, myalgia, ﬂu like', 'Flu like symptoms, RUQ pain, jaundice may be, travel history Then we run labs', 'A', 'Classic presentation of Lymphadenitis: Cervical, ,  if treated with amoxicillin. ,  come back with rash. (Dr. J notes, p33)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7050E3E02B7A_V', 'A 45-year-old patient is brought to the ED with Cervical, ,  if treated with amoxicillin. ,  come back with rash.. The most likely diagnosis is:', 'Cervical, if treated with amoxicillin, come back with rash', 'Cutaneous black lesions, spiking fever, anemia, hepatosplenomegaly', '3-4 days of fever sore throat, myalgia, ﬂu like', 'Flu like symptoms, RUQ pain, jaundice may be, travel history Then we run labs', 'A', 'The presentation of Cervical, ,  if treated with amoxicillin. ,  come back with rash. is classic for Lymphadenitis. (Dr. J notes, p33)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7083B38764F9', 'What is the classic presentation of Norwalk virus?', 'Diarrhea after traveling in cruise, big hotels (large crowds) buffets', 'Com. Viral cause of diarrhea in kids', 'Kids, slapped cheek rash, fever, erythema, myalgia', 'Acyclovir, famciclovir - prevent future outbreaks Gabapentin (for pain) - emitriptiline Ganciclovir - CMV', 'A', 'Classic presentation of Norwalk virus: Diarrhea after traveling in cruise, big hotels (large crowds) buffets, (Dr. J notes, p36)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7083B38764F9_V', 'A 5-year-old patient presents with Diarrhea after traveling in cruise, big hotels (large crowds) buffets,. What is the most likely diagnosis?', 'Diarrhea after traveling in cruise, big hotels (large crowds) buffets', 'Com. Viral cause of diarrhea in kids', 'Kids, slapped cheek rash, fever, erythema, myalgia', 'Acyclovir, famciclovir - prevent future outbreaks Gabapentin (for pain) - emitriptiline Ganciclovir - CMV', 'A', 'The presentation of Diarrhea after traveling in cruise, big hotels (large crowds) buffets, is classic for Norwalk virus. (Dr. J notes, p36)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-70A5AEC87C0E', 'What is a key risk factor or cause of Myositis?', 'Muscle inﬂammation Cause it, RIPSF Rifampin Isoniazid Prednisone Statins Steroid', 'Predominantly, cAMP (low dose)', 'And with super high dose of cAMP , 1st come in stress', '50-60 yo - mono articular Pain with movement mostly day, worse at end of day, nodes present Joints in ﬁngers, DIP', 'A', 'Risk factor for Myositis: Muscle inﬂammation Cause it ,  RIPSF Rifampin Isoniazid Prednisone Statins Steroid ,  eosinophils Fibrin Endo patho need to rule out in poly Myositis... (Dr. J notes, p19)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7141081E2624', 'What is the treatment for H. Ducreyi?', 'Doxy', 'Infected by = Hip implant, valve replace, IV catheters', 'ACUTE hep C', 'Baby from honey < 6-month-old', 'A', 'Treatment for H. Ducreyi: Rx ,  Doxy (Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7141081E2624_V', 'A 3-year-old patient with known H. Ducreyi comes in with Painful chancroids. Which treatment is most appropriate?', 'Doxy', 'Infected by = Hip implant, valve replace, IV catheters', 'ACUTE hep C', 'Baby from honey < 6-month-old', 'A', 'Treatment for H. Ducreyi: Rx ,  Doxy (Vignette from Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7271EF967AE8', 'What is the treatment for Aspirin?', 'Aspirin induced asthma, bronchospasm due to', 'Iron + vit C', 'Plasmapheresis to get rid of ab., corticosteroid', 'Plasmapheresis to get rid of ab, corticosteroid', 'A', 'Treatment for Aspirin: Aspirin induced asthma ,  bronchospasm due to (Dr. J notes, p108)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7388F25CEBBB', 'What is the treatment for Overdose on antipsychotic?', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'Constipation, pin point pupils, slow speech, impaired memory', 'Repsiratory & cardiac supration', 'FLash backs for >1 month', 'A', 'Treatment for Overdose on antipsychotic: Neuroleptic malignant syndrome Fever, rigidity, bradykinesia Rx = stop drug, ﬂuid, Bromocriptine, Dantrolene (Dr. J notes, p61)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7388F25CEBBB_V', 'A 35-year-old patient with known Overdose on antipsychotic comes in with Neuroleptic malignant syndrome Fever, rigidity, bradykinesia Rx = stop drug, ﬂuid, Bromocriptine, Dantrolene. Which treatment is most appropriate?', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'Constipation, pin point pupils, slow speech, impaired memory', 'Repsiratory & cardiac supration', 'FLash backs for >1 month', 'A', 'Treatment for Overdose on antipsychotic: Neuroleptic malignant syndrome Fever, rigidity, bradykinesia Rx = stop drug, ﬂuid, Bromocriptine, Dantrolene (Vignette from Dr. J notes, p61)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-73A71D211364', 'What is the treatment for Eike Nella?', 'Surgical debridement', 'Wash, clean, amoxycillin, clavulanate', 'Pneumococcal vaccine = 23/13, nub of String it covers, 23 covers most of it (98%)', 'Liver transplant', 'A', 'Treatment for Eike Nella: Rx ,  Surgical debridement (Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-73A71D211364_V', 'A 65-year-old patient with known Eike Nella comes in with Human Bite. Which treatment is most appropriate?', 'Surgical debridement', 'Wash, clean, amoxycillin, clavulanate', 'Pneumococcal vaccine = 23/13, nub of String it covers, 23 covers most of it (98%)', 'Liver transplant', 'A', 'Treatment for Eike Nella: Rx ,  Surgical debridement (Vignette from Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-73B5B62F276A', 'What is the treatment for Heparin induced thrombocytopenia I (HIT I) , Immediately <24hrs?', 'None', 'Stop heparin factor 10, agartroban', 'Give with Ⓝ saline', 'Fluid & dialysis', 'A', 'Treatment for Heparin induced thrombocytopenia I (HIT I) , Immediately <24hrs: Rx ,  none (Dr. J notes, p108)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-73D4B7549089', 'What is the treatment for Opioids overdose?', 'Constipation, pin point pupils, slow speech, impaired memory', 'Repsiratory & cardiac supration', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'Sadness; treatment: psychotherapy, SSRIs', 'A', 'Treatment for Opioids overdose: Constipation, pin point pupils, slow speech, impaired memory Rx = naloxone (Dr. J notes, p60)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-73D4B7549089_V', 'A 18-year-old patient with Opioids overdose presents with Constipation, pin point pupils, slow speech, impaired memory Rx = naloxone. What is the best initial treatment?', 'Constipation, pin point pupils, slow speech, impaired memory', 'Repsiratory & cardiac supration', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'Sadness; treatment: psychotherapy, SSRIs', 'A', 'Treatment for Opioids overdose: Constipation, pin point pupils, slow speech, impaired memory Rx = naloxone (Vignette from Dr. J notes, p60)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-74626FC26869', 'What is the treatment for Causes?', 'Dicloxacillin Impetigo, Honey crust lesions', 'Quadruple therapy, PPI + TCA + Metro +Bismut (give not to)', 'Oral abscess and Interstitial pneumonia after Dental/ Trauma', 'Liver transplant', 'A', 'Treatment for Causes: Dicloxacillin = Cell wall synthesis2) Impetigo ,  Honey crust lesions (Dr. J notes, p43)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-74626FC26869_V', 'A 40-year-old patient with Causes presents with Rash moving towards heart. What is the best initial treatment?', 'Dicloxacillin Impetigo, Honey crust lesions', 'Quadruple therapy, PPI + TCA + Metro +Bismut (give not to)', 'Oral abscess and Interstitial pneumonia after Dental/ Trauma', 'Liver transplant', 'A', 'Treatment for Causes: Dicloxacillin = Cell wall synthesis2) Impetigo ,  Honey crust lesions (Vignette from Dr. J notes, p43)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-769678D07FA8', 'What is the best diagnostic approach for HHV -5?', 'Mono spot test will be negative', 'Neck stiffness, photophobia, altered mental status', 'Smear, spindle cells', 'Others, N. Meningitis, strep pneumonia, Echo', 'A', 'Diagnosis of HHV -5: Mono spot test will be negative. Not cold agglutinin (Dr. J notes, p33)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-769678D07FA8_V', 'A 8-year-old patient presents with Fever myalgia, joint pain,. What is the most accurate diagnostic approach?', 'Mono spot test will be negative', 'Neck stiffness, photophobia, altered mental status', 'Smear, spindle cells', 'Others, N. Meningitis, strep pneumonia, Echo', 'A', 'Diagnosis of HHV -5: Mono spot test will be negative. Not cold agglutinin (Vignette from Dr. J notes, p33)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-781D315F8B02', 'What is the mechanism of Rhino virus?', 'Cell receptor, ICAM', 'Enzyme, Thy', 'Ganciclovir, or foscarnet (no need of Thymidine kinase enzyme)', 'Acyclovir, needs thymidine kinase to work, except Cidofovir and foscarnet', 'A', 'Mechanism of Rhino virus: Cell receptor ,  ICAM. (216) (Dr. J notes, p36)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-78473D3C4050', 'What is the classic presentation of Orthomyxovirus,  Enveloped, -ve sense?', 'Flu like symp', 'Laryngotracheal bronchitis, presents with stridor, extra thoracic obs', 'Diarrhea after traveling in cruise, big hotels (large crowds) buffets', 'Cutaneous black lesions, spiking fever, anemia, hepatosplenomegaly', 'A', 'Classic presentation of Orthomyxovirus,  Enveloped, -ve sense: Flu like symp. Cold, cough, myalgia, sore throat. if we catch it in less than 48 hours, we can treat with neuraminidase inhibitor. Zanamivir (Dr. J notes, p38)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-78473D3C4050_V', 'A 45-year-old patient presents to the clinic with Flu like symp. Cold, cough, myalgia, sore throat. if we catch it in less than 48 hours, we can treat with neuraminidase . Which of the following is the most likely diagnosis?', 'Flu like symp', 'Laryngotracheal bronchitis, presents with stridor, extra thoracic obs', 'Diarrhea after traveling in cruise, big hotels (large crowds) buffets', 'Cutaneous black lesions, spiking fever, anemia, hepatosplenomegaly', 'A', 'The presentation of Flu like symp. Cold, cough, myalgia, sore throat. if we catch it in less than 48 hours, we can treat with neuraminidase  is classic for Orthomyxovirus,  Enveloped, -ve sense. (Dr. J notes, p38)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-785C5C80D5D0', 'What is a key risk factor or cause of Enveloped, S.S?', 'Less likely to cause cancer, replicated in cytoplasm', '#1 diarrheal cause in kids, can be serious in babies', '#1 diarrheal cause in kids., can be serious in babies', 'Chronic, risk of cancer', 'A', 'Risk factor for Enveloped, S.S: Less likely to cause cancer, replicated in cytoplasm (Dr. J notes, p36)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-791163575231', 'What is the treatment for Polycythemia + ↓EPO?', 'Phlebotomy', 'Aspirin, dicloccicillin, clopidogrel', 'Give if PT and PTT ↑', 'Gastric by pass vit needs to give in order = B1, B12 and B9', 'A', 'Treatment for Polycythemia + ↓EPO: Rx ,  phlebotomy (Dr. J notes, p113)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7953601BF09F', 'What is the best diagnostic approach for Neoplasia?', 'Irreversible Tumor marker = KI 67BenignMalignant 90% of tumors10% of tumors Freely mobile FixedWell circumscribed Not', '> 2 year of low level sadness, dysthymia; CBT', 'Hallucination, synesthsesia, test colors, euphoria, panic', 'Benzo (short acting), liver issues Benzo, long acting, if no liver damage', 'A', 'Diagnosis of Neoplasia: Irreversible Tumor marker = KI 67BenignMalignant 90% of tumors10% of tumors Freely mobile FixedWell circumscribed Not well circumscribed Obey physi... (Dr. J notes, p66)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7953601BF09F_V', 'A 35-year-old patient is evaluated for Irreversible Tumor marker = KI 67BenignMalignant 90% of tumors10% of tumors Freely mobile FixedWell circumscribed Not we. Which diagnostic study should be ordered first?', 'Irreversible Tumor marker = KI 67BenignMalignant 90% of tumors10% of tumors Freely mobile FixedWell circumscribed Not', '> 2 year of low level sadness, dysthymia; CBT', 'Hallucination, synesthsesia, test colors, euphoria, panic', 'Benzo (short acting), liver issues Benzo, long acting, if no liver damage', 'A', 'Diagnosis of Neoplasia: Irreversible Tumor marker = KI 67BenignMalignant 90% of tumors10% of tumors Freely mobile FixedWell circumscribed Not well circumscribed Obey physi... (Vignette from Dr. J notes, p66)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-79AA0CE6C6C0', 'What is the best diagnostic approach for Anemia due to chronic disease?', 'Blue iron stain in smear', 'B.M biopsy, perssion blue stain', 'Best initial Diagnostic, Iron study, High TIBC', 'B.I, biopsy, reed stern berg cells', 'A', 'Diagnosis of Anemia due to chronic disease: Blue iron stain in smear (Dr. J notes, p110)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-79AA0CE6C6C0_V', 'A 70-year-old patient is evaluated for In pt with MM, RA, malignancy. Which diagnostic study should be ordered first?', 'Blue iron stain in smear', 'B.M biopsy, perssion blue stain', 'Best initial Diagnostic, Iron study, High TIBC', 'B.I, biopsy, reed stern berg cells', 'A', 'Diagnosis of Anemia due to chronic disease: Blue iron stain in smear (Vignette from Dr. J notes, p110)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-79CE2E1F2D12', 'What is a key risk factor or cause of 1° Hyperparathyroidism?', 'At gland - parathyroid adenoma Ca⁺↑, PO₄⁺↓, PTH↑ Chief cell adenoma of parathyroid', '↓ 21𝝰 hydroxylase, ↑17-Hydroxy pro', 'Genetic = HLA DR₃, DR₄', 'Genetic, as obesity is genetic, Type II diabetes can also be seen as genetic', 'A', 'Risk factor for 1° Hyperparathyroidism: Cause at gland - parathyroid adenoma Ca⁺↑, PO₄⁺↓, PTH↑ Chief cell adenoma of parathyroid (Dr. J notes, p11)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-79EFD284876C', 'What is the classic presentation of TTP?', 'Seizures, fever, renal issues', 'Altered mental status, abd pain, headaches, irritable', 'Older pt. with chronic back pain, rule out MM', 'Fatigue, easy bruising, petechia, purpura in a kid', 'A', 'Classic presentation of TTP: Seizures, fever, renal issues. ↑BT (Dr. J notes, p108)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-79EFD284876C_V', 'A 45-year-old patient presents to the clinic with Seizures, fever, renal issues. ↑BT. Which of the following is the most likely diagnosis?', 'Seizures, fever, renal issues', 'Altered mental status, abd pain, headaches, irritable', 'Older pt. with chronic back pain, rule out MM', 'Fatigue, easy bruising, petechia, purpura in a kid', 'A', 'The presentation of Seizures, fever, renal issues. ↑BT is classic for TTP. (Dr. J notes, p108)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7A0235462966', 'What is the treatment for Boerhaave syndrome?', 'FLuid, antibiotics, surgery', 'Isotonic ﬂuid, due to ↓vol', 'Liver transplant', 'Baby from honey < 6-month-old', 'A', 'Treatment for Boerhaave syndrome: FLuid, antibiotics, surgery. (Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7A0235462966_V', 'A 28-year-old patient with known Boerhaave syndrome comes in with Also Ⓛ chest pain, pleural effusion, crepitus.. Which treatment is most appropriate?', 'FLuid, antibiotics, surgery', 'Isotonic ﬂuid, due to ↓vol', 'Liver transplant', 'Baby from honey < 6-month-old', 'A', 'Treatment for Boerhaave syndrome: FLuid, antibiotics, surgery. (Vignette from Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7B031CDA83E9', 'What is the classic presentation of Glutamine, Rosiglitazone?', 'A/E = edema (where sugar goes water goes), weight gain', 'Dermatitis, diabetes, DVT, diarrhea In liver, partial oxidation of fatty acids', 'Fever, malaise, fatigue', 'Itchy; treatment: antihistamines', 'A', 'Classic presentation of Glutamine, Rosiglitazone: A/E = edema (where sugar goes water goes), weight gain (Dr. J notes, p12)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7B031CDA83E9_V', 'A 22-year-old patient is brought to the ED with A/E = edema (where sugar goes water goes), weight gain. The most likely diagnosis is:', 'A/E = edema (where sugar goes water goes), weight gain', 'Dermatitis, diabetes, DVT, diarrhea In liver, partial oxidation of fatty acids', 'Fever, malaise, fatigue', 'Itchy; treatment: antihistamines', 'A', 'The presentation of A/E = edema (where sugar goes water goes), weight gain is classic for Glutamine, Rosiglitazone. (Dr. J notes, p12)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7B09065FE343', 'What is the treatment for Plummer Vinson (Upper esophagus)?', 'Aggravated at menses / chron’s, iron deﬁciency (', 'Ca blockers', 'Nifurtimox, Benznidazole - chagas', 'Ceftriaxon, macrolides', 'A', 'Treatment for Plummer Vinson (Upper esophagus): Aggravated at menses / chron’s, iron deﬁciency (Rx- iron, vit.c) (Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7C457CFD276E', 'What is the best diagnostic approach for Tinea unguium?', 'KOH (best initial)', 'Slit lamp test', 'If female, pregnancy test and 2 forms of contraceptive', 'Scrape test', 'A', 'Diagnosis of Tinea unguium: Best initial ,  KOH & Most accurate ,  fungus culture (Dr. J notes, p3)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7C457CFD276E_V', 'A 32-year-old patient presents with Also called onychomycosis. What is the best initial diagnostic test?', 'KOH (best initial)', 'Slit lamp test', 'If female, pregnancy test and 2 forms of contraceptive', 'Scrape test', 'A', 'Diagnosis of Tinea unguium: Best initial ,  KOH & Most accurate ,  fungus culture (Vignette from Dr. J notes, p3)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7C9F147251AC', 'What is the treatment for H e p C?', 'ACUTE hep C', 'Prophylaxis vaccine to family', 'Ca blockers', 'Aggravated at menses / chron’s, iron deﬁciency (', 'A', 'Treatment for H e p C: Rx ACUTE hep C (Dr. J notes, p55)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7CA3CCC659CE', 'What is the classic presentation of Treponema Bruce?', 'Px fever anemia, enlarge lymph node', 'Com. Viral cause of diarrhea in kids', 'Diarrhea after traveling in cruise, big hotels (large crowds) buffets', 'Acyclovir, famciclovir - prevent future outbreaks Gabapentin (for pain) - emitriptiline Ganciclovir - CMV', 'A', 'Classic presentation of Treponema Bruce: Px fever anemia, enlarge lymph node (Dr. J notes, p39)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7CA3CCC659CE_V', 'A 45-year-old patient is brought to the ED with Px fever anemia, enlarge lymph node. The most likely diagnosis is:', 'Px fever anemia, enlarge lymph node', 'Com. Viral cause of diarrhea in kids', 'Diarrhea after traveling in cruise, big hotels (large crowds) buffets', 'Acyclovir, famciclovir - prevent future outbreaks Gabapentin (for pain) - emitriptiline Ganciclovir - CMV', 'A', 'The presentation of Px fever anemia, enlarge lymph node is classic for Treponema Bruce. (Dr. J notes, p39)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7DE710E99C63', 'What is the treatment for Rabies?', 'Vaccine & IVIG, Once symptoms start, 100% deadly', 'Lots of water & remove chemical', 'Fomepizole, IV', 'Rx, debridement, lots of ﬂuids, diuretics, mannitol', 'A', 'Treatment for Rabies: Vaccine & IVIG ,  Once symptoms start ,  100% deadly (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7DE710E99C63_V', 'A 60-year-old patient with known Rabies comes in with Px ,  confusion, fuming from mouth, hydrophobia, hypersalivation. Which treatment is most appropriate?', 'Vaccine & IVIG, Once symptoms start, 100% deadly', 'Lots of water & remove chemical', 'Fomepizole, IV', 'Rx, debridement, lots of ﬂuids, diuretics, mannitol', 'A', 'Treatment for Rabies: Vaccine & IVIG ,  Once symptoms start ,  100% deadly (Vignette from Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7DEE2256900E', 'What is the classic presentation of G6PD?', 'Px, hematuria, joint pain, massive hemolysis', 'Severe headache', 'Fatigue, pale, chest pain, shortness of breath', 'Px, red urine in the morning or heavy exercise due to acidic env', 'A', 'Classic presentation of G6PD: Px ,  hematuria, joint pain, massive hemolysis (Dr. J notes, p113)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7DEE2256900E_V', 'A 45-year-old patient is brought to the ED with Px ,  hematuria, joint pain, massive hemolysis. The most likely diagnosis is:', 'Px, hematuria, joint pain, massive hemolysis', 'Severe headache', 'Fatigue, pale, chest pain, shortness of breath', 'Px, red urine in the morning or heavy exercise due to acidic env', 'A', 'The presentation of Px ,  hematuria, joint pain, massive hemolysis is classic for G6PD. (Dr. J notes, p113)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7E3F96121A7C', 'What is a key risk factor or cause of L o a L o a?', 'No blindness but can cause death', '#1 diarrheal cause in kids, can be serious in babies', 'Avoid contact sports, due to splenomegaly (risk of rupture)', 'Cancer, angiosarcoma of veins', 'A', 'Risk factor for L o a L o a: No blindness but can cause death. Dangerous. (Dr. J notes, p40)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7EC17D4DC833', 'What is a key risk factor or cause of Strep. Pneumoniae?', 'Mostly cause, meningitis, otitis media, pneumonia, sinusitis, bronchitis, IgA protease', 'Inf due to use of aggressive antibiotics use', 'Pylori, NSAIDs, spicy food', 'Cystic ﬁbrosis, cause pneumonia after 20', 'A', 'Risk factor for Strep. Pneumoniae: Mostly cause ,  meningitis, otitis media, pneumonia, sinusitis, bronchitis ,  IgA protease. (Dr. J notes, p43)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7EFA74B03886', 'What is the best diagnostic approach for Child?', 'Bordetella pertussis', 'Inﬂammatory crypt abscess, biopsy', 'X-ray = double bubble', 'Barium, Dx- Narrowing of upper esophagus', 'A', 'Diagnosis of Child: Bordetella pertussis (Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7EFA74B03886_V', 'A 40-year-old patient is evaluated for Hx ,  Not vaccinated or missed vaccines. Which diagnostic study should be ordered first?', 'Bordetella pertussis', 'Inﬂammatory crypt abscess, biopsy', 'X-ray = double bubble', 'Barium, Dx- Narrowing of upper esophagus', 'A', 'Diagnosis of Child: Bordetella pertussis (Vignette from Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-7F7278900154', 'What is a key risk factor or cause of Clostridium Difﬁcle?', 'Inf due to use of aggressive antibiotics use', 'Gas gangrene', 'Mostly cause, meningitis, otitis media, pneumonia, sinusitis, bronchitis, IgA protease', 'Cystic ﬁbrosis, cause pneumonia after 20', 'A', 'Risk factor for Clostridium Difﬁcle: Cause ,  inf due to use of aggressive antibiotics use. (Dr. J notes, p44)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-802BBEEBA30E', 'What is the classic presentation of MGUS?', 'Severe headache', 'Altered mental status, abd pain, headaches, irritable', 'Older pt. with chronic back pain, rule out MM', 'Fatigue anemia, various types of inf', 'A', 'Classic presentation of MGUS: Severe headache. (Dr. J notes, p115)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-802BBEEBA30E_V', 'A 25-year-old patient presents with Severe headache.. What is the most likely diagnosis?', 'Severe headache', 'Altered mental status, abd pain, headaches, irritable', 'Older pt. with chronic back pain, rule out MM', 'Fatigue anemia, various types of inf', 'A', 'The presentation of Severe headache. is classic for MGUS. (Dr. J notes, p115)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-80334C24F47F', 'What is the treatment for Heat Cramps?', 'Muscle cramps, put in shade/cool place ﬂuids, electrolytes', 'Mild hypothermia, loopy/talking, Rx, Electrolytes, IV/oral ﬂuids', 'No sweating, ↑104°F , Dry & warm body, IV ﬂuid, cool down, clonazepam.Shock, Warm, septic, neurogenic Cool', 'Fomepizole, IV', 'A', 'Treatment for Heat Cramps: Muscle cramps ,  put in shade/cool place Rx ﬂuids, electrolytes (Dr. J notes, p27)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-80334C24F47F_V', 'A 42-year-old patient is diagnosed with Heat Cramps. The patient presents with Muscle cramps ,  put in shade/cool place Rx ﬂuids, electrolytes. What is the most appropriate treatment?', 'Muscle cramps, put in shade/cool place ﬂuids, electrolytes', 'Mild hypothermia, loopy/talking, Rx, Electrolytes, IV/oral ﬂuids', 'No sweating, ↑104°F , Dry & warm body, IV ﬂuid, cool down, clonazepam.Shock, Warm, septic, neurogenic Cool', 'Fomepizole, IV', 'A', 'Treatment for Heat Cramps: Muscle cramps ,  put in shade/cool place Rx ﬂuids, electrolytes (Vignette from Dr. J notes, p27)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8044C7C859DE', 'What is the best diagnostic approach for Hereditary Nonpolyposis colon cancer (HNPCC) (Lynch), AD?', '6/7 polyps may turn bad but not until 40', 'Barium, Dx- Narrowing of upper esophagus', 'X-ray = Gallstone in cystic duct, inﬂamed', 'Bordetella pertussis', 'A', 'Diagnosis of Hereditary Nonpolyposis colon cancer (HNPCC) (Lynch), AD: 6/7 polyps may turn bad but not until 40. No test until 21. Shape ﬂat. (Dr. J notes, p57)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8247A6AB6C97', 'What is the mechanism of B cell?', 'Bruton’s, agammaglobulinemia = X linked recessive, tyrosine kinase prob', 'Ataxia telangiectasia, DNA endonuclease, enzyme', 'Enzyme, A.D.A def', 'Type II, cytotoxic, True autoimmune ABO & Rh', 'A', 'Mechanism of B cell: Bruton’s ,  agammaglobulinemia = X linked recessive, tyrosine kinase prob. (Dr. J notes, p84)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8267E07BACD1', 'What is the treatment for GERD?', 'Acid crossing sphincter, columnar metaplasia Glandular, so adenocarcinoma', 'Gabapentin TCA', 'Vaccine - everyone', 'Nifurtimox, Benznidazole - chagas', 'A', 'Treatment for GERD: Acid crossing sphincter ,  columnar metaplasia Glandular ,  so adenocarcinoma Rx - life style modiﬁcation, PPIs (Dr. J notes, p51)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8267E07BACD1_V', 'A 55-year-old patient with known GERD comes in with Due to sphincter being weak. Which treatment is most appropriate?', 'Acid crossing sphincter, columnar metaplasia Glandular, so adenocarcinoma', 'Gabapentin TCA', 'Vaccine - everyone', 'Nifurtimox, Benznidazole - chagas', 'A', 'Treatment for GERD: Acid crossing sphincter ,  columnar metaplasia Glandular ,  so adenocarcinoma Rx - life style modiﬁcation, PPIs (Vignette from Dr. J notes, p51)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-82A68990499E', 'What is a key risk factor or cause of Psoriasis?', 'New leison, cause psoriasis in that location, Koebner phenomenon', 'Other bugs cause NF, staph Aureus and Clostridium perfringens', 'In pregnancy, can cause hydrops fetalis', 'Genetic = HLA DR₃, DR₄', 'A', 'Risk factor for Psoriasis: New leison ,  cause psoriasis in that location ,  Koebner phenomenon, (Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-82CE463B95BE', 'What is the classic presentation of Cryoglobinemia?', 'Hematuria, rash, joint pain', 'Fatigue anemia, various types of inf', 'Fatigue, pale, chest pain, shortness of breath', 'Seizures, fever, renal issues', 'A', 'Classic presentation of Cryoglobinemia: Hematuria, rash, joint pain (Dr. J notes, p112)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-82CE463B95BE_V', 'A 25-year-old patient presents with Hematuria, rash, joint pain. What is the most likely diagnosis?', 'Hematuria, rash, joint pain', 'Fatigue anemia, various types of inf', 'Fatigue, pale, chest pain, shortness of breath', 'Seizures, fever, renal issues', 'A', 'The presentation of Hematuria, rash, joint pain is classic for Cryoglobinemia. (Dr. J notes, p112)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-845F723E20AE', 'What is a key risk factor or cause of Impetigo?', 'Erysipelas, Risk for Rheumatic heart disease', 'At gland - parathyroid adenoma Ca⁺↑, PO₄⁺↓, PTH↑ Chief cell adenoma of parathyroid', 'New leison, cause psoriasis in that location, Koebner phenomenon', 'Genetic, as obesity is genetic, Type II diabetes can also be seen as genetic', 'A', 'Risk factor for Impetigo: Erysipelas ,  Risk for Rheumatic heart disease (Dr. J notes, p3)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-848E08B982E0', 'What is the classic presentation of Babesiosis?', 'Fever', 'Photophobia, hydrophobia, agitation, fever', 'Cutaneous black lesions, spiking fever, anemia, hepatosplenomegaly', '3-4 days of fever sore throat, myalgia, ﬂu like', 'A', 'Classic presentation of Babesiosis: Fever. (Dr. J notes, p39)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-848E08B982E0_V', 'A 5-year-old patient is brought to the ED with Fever.. The most likely diagnosis is:', 'Fever', 'Photophobia, hydrophobia, agitation, fever', 'Cutaneous black lesions, spiking fever, anemia, hepatosplenomegaly', '3-4 days of fever sore throat, myalgia, ﬂu like', 'A', 'The presentation of Fever. is classic for Babesiosis. (Dr. J notes, p39)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8580A22BC915', 'What is the treatment for Strep. Pneumoniae?', 'Pneumococcal vaccine = 23/13, nub of String it covers, 23 covers most of it (98%)', 'Amoxicillin - cell wall synthesis', 'Ceftriaxon, macrolides', 'Dicloxacillin Impetigo, Honey crust lesions', 'A', 'Treatment for Strep. Pneumoniae: Pneumococcal vaccine = 23/13 ,  nub of String it covers ,  23 covers most of it (98%). (Dr. J notes, p43)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8580A22BC915_V', 'A 28-year-old patient with Strep. Pneumoniae presents with Capsule - typical, fast onset. What is the best initial treatment?', 'Pneumococcal vaccine = 23/13, nub of String it covers, 23 covers most of it (98%)', 'Amoxicillin - cell wall synthesis', 'Ceftriaxon, macrolides', 'Dicloxacillin Impetigo, Honey crust lesions', 'A', 'Treatment for Strep. Pneumoniae: Pneumococcal vaccine = 23/13 ,  nub of String it covers ,  23 covers most of it (98%). (Vignette from Dr. J notes, p43)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-85A71541090D', 'What is the best diagnostic approach for Biliary colic not Rx?', 'X-ray duct, inﬂamed', 'Inﬂammatory crypt abscess, biopsy', 'If Dx Or chance of H.E', 'Barium, Dx- Narrowing of upper esophagus', 'A', 'Diagnosis of Biliary colic not Rx: X-ray = Gallstone in cystic duct ,  inﬂamed (Dr. J notes, p54)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-85A71541090D_V', 'A 55-year-old patient presents with ↑↑↑ pain when breathe / palpation. What is the best initial diagnostic test?', 'X-ray duct, inﬂamed', 'Inﬂammatory crypt abscess, biopsy', 'If Dx Or chance of H.E', 'Barium, Dx- Narrowing of upper esophagus', 'A', 'Diagnosis of Biliary colic not Rx: X-ray = Gallstone in cystic duct ,  inﬂamed (Vignette from Dr. J notes, p54)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-85BAE2642833', 'What is the classic presentation of Hairy cell leukemia?', 'Fatigue anemia, various types of inf', 'Type 4, hydrops fetalis (edema of fetus), not compatible with life', 'Hematuria, rash, joint pain', 'Severe headache', 'A', 'Classic presentation of Hairy cell leukemia: Fatigue anemia, various types of inf. (Dr. J notes, p114)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-85BAE2642833_V', 'A 70-year-old patient presents with Fatigue anemia, various types of inf.. What is the most likely diagnosis?', 'Fatigue anemia, various types of inf', 'Type 4, hydrops fetalis (edema of fetus), not compatible with life', 'Hematuria, rash, joint pain', 'Severe headache', 'A', 'The presentation of Fatigue anemia, various types of inf. is classic for Hairy cell leukemia. (Dr. J notes, p114)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-864180DE3804', 'What is the treatment for Anxiety?', 'Sadness.; treatment: psychotherapy, SSRIs', '> 6 month, Anxiety (outside) + worry (inside), about everything', 'Before 18, vocal tics > 1year', 'Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures', 'A', 'Treatment for Anxiety: Sadness. Rx = psychotherapy, SSRIs (Dr. J notes, p63)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-864180DE3804_V', 'A 18-year-old patient with Anxiety presents with Sadness. Rx = psychotherapy, SSRIs. What is the best initial treatment?', 'Sadness.; treatment: psychotherapy, SSRIs', '> 6 month, Anxiety (outside) + worry (inside), about everything', 'Before 18, vocal tics > 1year', 'Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures', 'A', 'Treatment for Anxiety: Sadness. Rx = psychotherapy, SSRIs (Vignette from Dr. J notes, p63)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-864C761167E8', 'What is the best diagnostic approach for Duodenal atresia?', 'X-ray = double bubble', 'Bordetella pertussis', 'X-ray - air in mediastenum', 'Barium, Dx- Narrowing of upper esophagus', 'A', 'Diagnosis of Duodenal atresia: X-ray = double bubble (Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-866ACEBBCE7B', 'What is the treatment for Live vaccine?', 'Supportive', 'Cannot treat or prevent it', 'Aggressive, Rota (Vaccine every 2 months in kids unto 6 months), inﬂuenza A', 'Metronidazole', 'A', 'Treatment for Live vaccine: Supportive (Dr. J notes, p33)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-86D82803C4AA', 'What is the treatment for Tinea unguium?', 'Oral terbinaﬁne', 'Oral Griseofulvin, oral ketoconazole, itraconazole, isosulfate', 'Topical azole', 'Acyclovir, Gabapentin, amitryptaline', 'A', 'Treatment for Tinea unguium: Rx ,  oral terbinaﬁne because nail grows from inside out. itraconazole (Dr. J notes, p3)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-86D82803C4AA_V', 'A 32-year-old patient with known Tinea unguium comes in with Also called onychomycosis. Which treatment is most appropriate?', 'Oral terbinaﬁne', 'Oral Griseofulvin, oral ketoconazole, itraconazole, isosulfate', 'Topical azole', 'Acyclovir, Gabapentin, amitryptaline', 'A', 'Treatment for Tinea unguium: Rx ,  oral terbinaﬁne because nail grows from inside out. itraconazole (Vignette from Dr. J notes, p3)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-86E855314884', 'What is the treatment for Types Of CollagenI. Skin?', 'Bone, corneaII', '0-2 months old, chlamydia', '? CAP, Clarithromycin, amoxicillin, PPI', 'Vaccine - everyone', 'A', 'Treatment for Types Of CollagenI. Skin: Bone, corneaII. Connective tissue, aqueous humorIII. Arteries, veins IV. Basement membrane, Lens (Dr. J notes, p42)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-86E855314884_V', 'A 40-year-old patient is diagnosed with Types Of CollagenI. Skin. The patient presents with Bone, corneaII. Connective tissue, aqueous humorIII. Arteries, veins IV. Basement membrane, Lens. What is the most appropriate treatment?', 'Bone, corneaII', '0-2 months old, chlamydia', '? CAP, Clarithromycin, amoxicillin, PPI', 'Vaccine - everyone', 'A', 'Treatment for Types Of CollagenI. Skin: Bone, corneaII. Connective tissue, aqueous humorIII. Arteries, veins IV. Basement membrane, Lens (Vignette from Dr. J notes, p42)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-86F7345EAA61', 'What is the treatment for Kaposi sarcoma?', 'Treat with HAART therapy, 2 NRTIs + Integrase or 2NNRTIS', 'Supportive, rest, sunshine, sulfasaline', 'Steroid, and Type 1 Hypersensitivity reaction', 'Topical salicylic acid', 'A', 'Treatment for Kaposi sarcoma: Treat with HAART therapy ,  2 NRTIs + Integrase or 2NNRTIS (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-86F7345EAA61_V', 'A 45-year-old patient is diagnosed with Kaposi sarcoma. The patient presents with Angiosarcoma of the veins. Purplish rash on skin. What is the most appropriate treatment?', 'Treat with HAART therapy, 2 NRTIs + Integrase or 2NNRTIS', 'Supportive, rest, sunshine, sulfasaline', 'Steroid, and Type 1 Hypersensitivity reaction', 'Topical salicylic acid', 'A', 'Treatment for Kaposi sarcoma: Treat with HAART therapy ,  2 NRTIs + Integrase or 2NNRTIS (Vignette from Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-87135B5A39CB', 'What is the treatment for Hypersensitivity?', 'Type IV , - Delayed (ex.- Contact dermatitis, GVHD, PPD test, Chronic transplant rejection)', 'Bone, cornea, scar tissue II', 'Giardia (never enters body), hard to Rx', 'B symptoms ⨁', 'A', 'Treatment for Hypersensitivity: Type IV , - Delayed (ex.- Contact dermatitis, GVHD, PPD test, Chronic transplant rejection) (Dr. J notes, p87)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-876E65A64E1B', 'What is the classic presentation of Hep B ,  DNA, DS, Envelope?', 'Flu like symptoms, RUQ pain, jaundice may be, travel history Then we run labs', 'Jaundice, abd', 'Flu like symp', 'Fatigue, shortness of breath, MCC of death', 'A', 'Classic presentation of Hep B ,  DNA, DS, Envelope: Flu like symptoms, RUQ pain, jaundice may be, travel history Then we run labs. Labs ,  ↑AST, ↑ALT. (Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-876E65A64E1B_V', 'A 30-year-old patient presents to the clinic with Flu like symptoms, RUQ pain, jaundice may be, travel history Then we run labs. Labs ,  ↑AST, ↑ALT.. Which of the following is the most likely diagnosis?', 'Flu like symptoms, RUQ pain, jaundice may be, travel history Then we run labs', 'Jaundice, abd', 'Flu like symp', 'Fatigue, shortness of breath, MCC of death', 'A', 'The presentation of Flu like symptoms, RUQ pain, jaundice may be, travel history Then we run labs. Labs ,  ↑AST, ↑ALT. is classic for Hep B ,  DNA, DS, Envelope. (Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-881976A66B29', 'What is the classic presentation of Anemia?', 'Fatigue, pale, chest pain, shortness of breath', 'Type 4, hydrops fetalis (edema of fetus), not compatible with life', 'Hematuria, rash, joint pain', 'Oliguria, high fever, BUN and cr high, transplanted tissue is slightly mottled', 'A', 'Classic presentation of Anemia: Fatigue, pale, chest pain, shortness of breath (Dr. J notes, p109)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-881976A66B29_V', 'A 60-year-old patient presents with Fatigue, pale, chest pain, shortness of breath. What is the most likely diagnosis?', 'Fatigue, pale, chest pain, shortness of breath', 'Type 4, hydrops fetalis (edema of fetus), not compatible with life', 'Hematuria, rash, joint pain', 'Oliguria, high fever, BUN and cr high, transplanted tissue is slightly mottled', 'A', 'The presentation of Fatigue, pale, chest pain, shortness of breath is classic for Anemia. (Dr. J notes, p109)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-887C1FB276B6', 'What is the classic presentation of Humoral?', 'B cells and neutrophils, gets sick quicker, High fever', 'Chronic back pain', 'Pale skin + red hair, bunch of rash, core face, S.A inf', 'Infection Toxin, medullary ?, damage to papillary Sickle cell disease, NSAID’s, papillary damage, Hematuria', 'A', 'Classic presentation of Humoral: B cells and neutrophils ,  gets sick quicker, High fever. (Dr. J notes, p82)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-887C1FB276B6_V', 'A 8-year-old patient presents with B cells and neutrophils ,  gets sick quicker, High fever.. What is the most likely diagnosis?', 'B cells and neutrophils, gets sick quicker, High fever', 'Chronic back pain', 'Pale skin + red hair, bunch of rash, core face, S.A inf', 'Infection Toxin, medullary ?, damage to papillary Sickle cell disease, NSAID’s, papillary damage, Hematuria', 'A', 'The presentation of B cells and neutrophils ,  gets sick quicker, High fever. is classic for Humoral. (Dr. J notes, p82)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-88C7FE9844AD', 'What is the mechanism of B12 Def?', 'Chronic PPI use - PPI inhibit parietal cell secretion which needs for B12 absorption', 'Kids, resolve, autoimmune', 'Point mutation of glutamic acid leading to valine', 'Tyrosine kinase?? B.I, LAP', 'A', 'Mechanism of B12 Def: Chronic PPI use - PPI inhibit parietal cell secretion which needs for B12 absorption (Dr. J notes, p111)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-88EEDAF4BA19', 'What is the treatment for Atypical interstitial pneumonia ,  10?', 'Macrolides', 'Ceftriaxon, macrolides', '0-2 months old, chlamydia', 'Dicloxacillin Impetigo, Honey crust lesions', 'A', 'Treatment for Atypical interstitial pneumonia ,  10: Macrolides (Dr. J notes, p48)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-897868A29E5A', 'What is the classic presentation of Pemphigus vulgaris?', '+ve nikolsky sign, may not be present if smoking', 'If no hat, same Px, alopecia', '2nd mes, cAMP', 'Sandpaper-like body rash (palms and sole), strawberry tongue', 'A', 'Classic presentation of Pemphigus vulgaris: +ve nikolsky sign ,  may not be present if smoking (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-897868A29E5A_V', 'A 32-year-old patient presents to the clinic with +ve nikolsky sign ,  may not be present if smoking. Which of the following is the most likely diagnosis?', '+ve nikolsky sign, may not be present if smoking', 'If no hat, same Px, alopecia', '2nd mes, cAMP', 'Sandpaper-like body rash (palms and sole), strawberry tongue', 'A', 'The presentation of +ve nikolsky sign ,  may not be present if smoking is classic for Pemphigus vulgaris. (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8A1295019C07', 'What is the mechanism of Herpes (HSV)?', 'Acyclovir, needs thymidine kinase to work, except Cidofovir and foscarnet', 'Cidofovir, foscarnate, doesn’t require thymidine kinase', 'Cell receptor, ICAM', 'Ganciclovir, or foscarnet (no need of Thymidine kinase enzyme)', 'A', 'Mechanism of Herpes (HSV): Acyclovir ,  needs thymidine kinase to work, except Cidofovir and foscarnet. (Dr. J notes, p32)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8A2E82218EB1', 'What is the classic presentation of Pt fresh water?', 'Dump with diarrhea, in USA, 2 possibilities', 'Bloody diarrhea, liver abscess, liver cysts', 'Watery diarrhea from fresh water', 'Purple papules', 'A', 'Classic presentation of Pt fresh water: Dump with diarrhea, in USA ,  2 possibilities (Dr. J notes, p40)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8A2E82218EB1_V', 'A 8-year-old patient presents to the clinic with Dump with diarrhea, in USA ,  2 possibilities. Which of the following is the most likely diagnosis?', 'Dump with diarrhea, in USA, 2 possibilities', 'Bloody diarrhea, liver abscess, liver cysts', 'Watery diarrhea from fresh water', 'Purple papules', 'A', 'The presentation of Dump with diarrhea, in USA ,  2 possibilities is classic for Pt fresh water. (Dr. J notes, p40)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8B67A6399B5F', 'What is the classic presentation of Shigella?', 'Bloody diarrhea', 'Baby + at birth, jaundice', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', 'Watery diarrhea in kids, malabsorption', 'A', 'Classic presentation of Shigella: Bloody diarrhea (Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8B67A6399B5F_V', 'A 28-year-old patient is brought to the ED with Bloody diarrhea. The most likely diagnosis is:', 'Bloody diarrhea', 'Baby + at birth, jaundice', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', 'Watery diarrhea in kids, malabsorption', 'A', 'The presentation of Bloody diarrhea is classic for Shigella. (Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8C1206FFCCA2', 'What is the classic presentation of Chiari II?', 'Symptomatic, ataxia, spingomyelia, pain and temperature loss bilateral', 'Greasy appearancePt with headache, precocious puberty, bitemporal hemianopsia + loss of upper gaze, Pinealoma Stroke', 'Night terrors, sleep walking, teeth grinding increase intracraneal pressure, nausea, headache First sign', 'Tingling 1ˢᵗ 3 ﬁngers', 'A', 'Classic presentation of Chiari II: Symptomatic ,  ataxia, spingomyelia ,  pain and temperature loss bilateral. In adult usually after some trauma to shoulder/neck. (Dr. J notes, p138)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8C1206FFCCA2_V', 'A 45-year-old patient is brought to the ED with Symptomatic ,  ataxia, spingomyelia ,  pain and temperature loss bilateral. In adult usually after some trauma to shoulder. The most likely diagnosis is:', 'Symptomatic, ataxia, spingomyelia, pain and temperature loss bilateral', 'Greasy appearancePt with headache, precocious puberty, bitemporal hemianopsia + loss of upper gaze, Pinealoma Stroke', 'Night terrors, sleep walking, teeth grinding increase intracraneal pressure, nausea, headache First sign', 'Tingling 1ˢᵗ 3 ﬁngers', 'A', 'The presentation of Symptomatic ,  ataxia, spingomyelia ,  pain and temperature loss bilateral. In adult usually after some trauma to shoulder is classic for Chiari II. (Dr. J notes, p138)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8CE3946B32A7', 'What is the treatment for Trigeminal neuralgia?', 'Gabapentin TCA', 'Acid crossing sphincter, columnar metaplasia Glandular, so adenocarcinoma', 'Liver transplant', 'Oral abscess and Interstitial pneumonia after Dental/ Trauma', 'A', 'Treatment for Trigeminal neuralgia: Gabapentin TCA (Dr. J notes, p50)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8CE3946B32A7_V', 'A 28-year-old patient with known Trigeminal neuralgia comes in with Even wind blow, pain. Which treatment is most appropriate?', 'Gabapentin TCA', 'Acid crossing sphincter, columnar metaplasia Glandular, so adenocarcinoma', 'Liver transplant', 'Oral abscess and Interstitial pneumonia after Dental/ Trauma', 'A', 'Treatment for Trigeminal neuralgia: Gabapentin TCA (Vignette from Dr. J notes, p50)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8CE854A92DBE', 'What is the classic presentation of Pt comes to ofﬁce?', 'Pain pronate, ﬂex wrist, pain elbow = medial epicondyle - golfer’s elbow', 'Back pain, more when lean down, > 65yo leading to 3 diffrenciations = multiple myeloma, tumor, metastasis', 'Severe back pain , worse with lean down, fever, ↑HR, ↓BP = spinal abscess', 'Pain, tenderness, tibial tubro', 'A', 'Classic presentation of Pt comes to ofﬁce: Pain pronate, ﬂex wrist, pain elbow = medial epicondyle - golfer’s elbow. Rx = ice (Dr. J notes, p23)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8CE854A92DBE_V', 'A 65-year-old patient is brought to the ED with Pain pronate, ﬂex wrist, pain elbow = medial epicondyle - golfer’s elbow. Rx = ice. The most likely diagnosis is:', 'Pain pronate, ﬂex wrist, pain elbow = medial epicondyle - golfer’s elbow', 'Back pain, more when lean down, > 65yo leading to 3 diffrenciations = multiple myeloma, tumor, metastasis', 'Severe back pain , worse with lean down, fever, ↑HR, ↓BP = spinal abscess', 'Pain, tenderness, tibial tubro', 'A', 'The presentation of Pain pronate, ﬂex wrist, pain elbow = medial epicondyle - golfer’s elbow. Rx = ice is classic for Pt comes to ofﬁce. (Dr. J notes, p23)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8D057109C622', 'What is a key risk factor or cause of Iron deﬁciency?', 'Main cause, nutrition', 'Genetic , δ ALA synthesis', 'Increase retention of iron within reticuloendothelial system', 'Risk of clots, If happens in hepatic vein', 'A', 'Risk factor for Iron deﬁciency: Main cause ,  nutrition. (Dr. J notes, p110)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8D7F30150406', 'What is the classic presentation of Multiple myeloid?', 'Chronic back pain', 'Hx of sinopulmonary infection', 'Infection Toxin, medullary ?, damage to papillary Sickle cell disease, NSAID’s, papillary damage, Hematuria', 'So excess absorption of water, less sodium to the ratio of water present in the body', 'A', 'Classic presentation of Multiple myeloid: Chronic back pain (Dr. J notes, p84)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8D7F30150406_V', 'A 8-year-old patient presents with Chronic back pain. What is the most likely diagnosis?', 'Chronic back pain', 'Hx of sinopulmonary infection', 'Infection Toxin, medullary ?, damage to papillary Sickle cell disease, NSAID’s, papillary damage, Hematuria', 'So excess absorption of water, less sodium to the ratio of water present in the body', 'A', 'The presentation of Chronic back pain is classic for Multiple myeloid. (Dr. J notes, p84)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8E1B516D58F0', 'What is the treatment for Toxic epidermal necrolysis?', 'Hypersensitivity', 'Steroid, and Type 1 Hypersensitivity reaction', 'Topical selenium sulﬁde, ketoconazole', 'Oral Neuroma (mucosal neuroma)', 'A', 'Treatment for Toxic epidermal necrolysis: Due to drug. Hypersensitivity (Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8E1B516D58F0_V', 'A 58-year-old patient is diagnosed with Toxic epidermal necrolysis. The patient presents with Positive nikalosky sign. What is the most appropriate treatment?', 'Hypersensitivity', 'Steroid, and Type 1 Hypersensitivity reaction', 'Topical selenium sulﬁde, ketoconazole', 'Oral Neuroma (mucosal neuroma)', 'A', 'Treatment for Toxic epidermal necrolysis: Due to drug. Hypersensitivity (Vignette from Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8E2D58F82AC7', 'What is the treatment for Contact dermatitis?', 'Extensive - oral steroids, more then 2 wks we need to, 3 ADRENAL INSUFFICIENCY', 'Steroid, and Type 1 Hypersensitivity reaction', 'Topical selenium sulﬁde, ketoconazole', '𝝰 blockers then β blockers to avoid hypertensive crisis', 'A', 'Treatment for Contact dermatitis: Extensive - oral steroids ,  more then 2 wks we need to ,  3 ADRENAL INSUFFICIENCY (Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8ED4F7DFCB37', 'What is the classic presentation of Hereditary spherocytosis?', 'Fatigue cal bilirubin stones, sudden onset of anemia??', 'Fatigue anemia, various types of inf', 'Altered mental status, abd pain, headaches, irritable', 'Px, hematuria, joint pain, massive hemolysis', 'A', 'Classic presentation of Hereditary spherocytosis: Fatigue cal bilirubin stones, sudden onset of anemia?? (Dr. J notes, p112)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8ED4F7DFCB37_V', 'A 70-year-old patient presents with Fatigue cal bilirubin stones, sudden onset of anemia??. What is the most likely diagnosis?', 'Fatigue cal bilirubin stones, sudden onset of anemia??', 'Fatigue anemia, various types of inf', 'Altered mental status, abd pain, headaches, irritable', 'Px, hematuria, joint pain, massive hemolysis', 'A', 'The presentation of Fatigue cal bilirubin stones, sudden onset of anemia?? is classic for Hereditary spherocytosis. (Dr. J notes, p112)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8F12D0546F28', 'What is the classic presentation of Strep. Viridians?', 'Sub acute bac endocarditis regorge murmur - mitral valve', 'Capsule - typical, fast onset', '7 1. Catalase = Break down Hydrogen peroxide (H₂O₂ + H₂O + O₂) 2', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', 'A', 'Classic presentation of Strep. Viridians: Cause - Sub acute bac endocarditis regorge murmur - mitral valve (Dr. J notes, p43)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8F12D0546F28_V', 'A 55-year-old patient is brought to the ED with Cause - Sub acute bac endocarditis regorge murmur - mitral valve. The most likely diagnosis is:', 'Sub acute bac endocarditis regorge murmur - mitral valve', 'Capsule - typical, fast onset', '7 1. Catalase = Break down Hydrogen peroxide (H₂O₂ + H₂O + O₂) 2', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', 'A', 'The presentation of Cause - Sub acute bac endocarditis regorge murmur - mitral valve is classic for Strep. Viridians. (Dr. J notes, p43)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8F6021687E33', 'What is the treatment for HSV?', 'Acyclovir - needs thymidylate kinase', 'Acyclovir, famciclovir, for future outbreak', 'Supportive', 'Cannot treat or prevent it', 'A', 'Treatment for HSV: Acyclovir - needs thymidylate kinase (Dr. J notes, p32)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8F78D73EAC2B', 'What is the treatment for Parasympathetic?', 'And with super high dose of cAMP , 1st come in stress', 'After menopause, >55 Osteoclast problem', 'Methotrexate = dihydro-folate reductase inhibitor, A/E - megaloblastic anemia so Give with B9, leucovorin', 'History of duodenal ulcer - acute gout', 'A', 'Treatment for Parasympathetic: And with super high dose of cAMP , 1st come in stress (Dr. J notes, p17)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-8F78D73EAC2B_V', 'A 75-year-old patient with known Parasympathetic comes in with Most of then are muscarinic, (Nicotinic are , autonomic ganglia and neuromuscular junction) Px - DUMBBELSS - Diarrhea, Ur. Which treatment is most appropriate?', 'And with super high dose of cAMP , 1st come in stress', 'After menopause, >55 Osteoclast problem', 'Methotrexate = dihydro-folate reductase inhibitor, A/E - megaloblastic anemia so Give with B9, leucovorin', 'History of duodenal ulcer - acute gout', 'A', 'Treatment for Parasympathetic: And with super high dose of cAMP , 1st come in stress (Vignette from Dr. J notes, p17)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9037A2788091', 'What is a key risk factor or cause of Gastritis type B?', 'Pylori, NSAIDs, spicy food', 'Cancer risk ↑↑', 'That’s why Hypercalcemia, cause ulcers', 'UTIs, Pyelonephritis, cystitis', 'A', 'Risk factor for Gastritis type B: Cause ,  H. Pylori, NSAIDs, spicy food. (Dr. J notes, p53)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9062A32DC546', 'What is the treatment for Packed RBC?', 'Give with Ⓝ saline', 'Iv ca 2 gluconate + anti venom', 'N- acetyl cysteine, disulﬁde bonds', 'Anti venom for snake, tetanus vaccine', 'A', 'Treatment for Packed RBC: Give with Ⓝ saline (Dr. J notes, p26)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9062A32DC546_V', 'A 50-year-old patient is diagnosed with Packed RBC. The patient presents with Give with Ⓝ saline. What is the most appropriate treatment?', 'Give with Ⓝ saline', 'Iv ca 2 gluconate + anti venom', 'N- acetyl cysteine, disulﬁde bonds', 'Anti venom for snake, tetanus vaccine', 'A', 'Treatment for Packed RBC: Give with Ⓝ saline (Vignette from Dr. J notes, p26)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-907EE723B954', 'What is the treatment for Herpes encephalitis?', 'IV acyclovir', 'Ganciclovir', 'Tx, Fecal oral', 'Cannot treat or prevent it', 'A', 'Treatment for Herpes encephalitis: IV acyclovir (Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-907EE723B954_V', 'A 8-year-old patient with Herpes encephalitis presents with Confusion, neck stiffness, photophobia, olfactory hallucinations.. What is the best initial treatment?', 'IV acyclovir', 'Ganciclovir', 'Tx, Fecal oral', 'Cannot treat or prevent it', 'A', 'Treatment for Herpes encephalitis: IV acyclovir (Vignette from Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-90B0ACBC08E2', 'What is the treatment for Giardiasis?', 'Metronidazole', 'Is supportive', 'Aggressive, Rota (Vaccine every 2 months in kids unto 6 months), inﬂuenza A', 'Acyclovir - needs thymidylate kinase', 'A', 'Treatment for Giardiasis: Metronidazole (Dr. J notes, p40)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-90FC366878E0', 'What is the best diagnostic approach for Basal cell?', 'Punch biopsy', 'Non healing ulcer, ﬂaky red in lower part of face, biopsy', 'If female, pregnancy test and 2 forms of contraceptive', 'Biopsy and', 'A', 'Diagnosis of Basal cell: Punch biopsy. If on the face, we do MOHS surgery ,  slicing till we hit healthy tissue (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-915B79D7BAC5', 'What is the best diagnostic approach for Vit K?', 'Carboxylation of clotting factors, to attract plts with negative charge', 'Best initial Diagnostic, Iron study, High TIBC', 'Auer rods in smear', 'And clotting factors negative charge, so they are attracted to each other, hypercoagulable state', 'A', 'Diagnosis of Vit K: Carboxylation of clotting factors, to attract plts with negative charge (Dr. J notes, p108)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9256757EEC7F', 'What is the best diagnostic approach for HIV + Cryptococcus (meningitis) nausea?', 'Vomiting, neck stiffness, photophobia Dx - India ink', 'Neck stiffness, photophobia, altered mental status', 'Others, N. Meningitis, strep pneumonia, Echo', 'Best initial test - ELISA', 'A', 'Diagnosis of HIV + Cryptococcus (meningitis) nausea: Vomiting, neck stiffness, photophobia Dx - India ink. Rx - Amphotericin B (Dr. J notes, p38)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9256757EEC7F_V', 'A 22-year-old patient presents with Vomiting, neck stiffness, photophobia Dx - India ink. Rx - Amphotericin B. What is the most accurate diagnostic approach?', 'Vomiting, neck stiffness, photophobia Dx - India ink', 'Neck stiffness, photophobia, altered mental status', 'Others, N. Meningitis, strep pneumonia, Echo', 'Best initial test - ELISA', 'A', 'Diagnosis of HIV + Cryptococcus (meningitis) nausea: Vomiting, neck stiffness, photophobia Dx - India ink. Rx - Amphotericin B (Vignette from Dr. J notes, p38)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9320146BE04F', 'What is the treatment for CREST?', 'Calcinosis cutis, raynaud’s phenomenon, esophageal dysmotility, sclerodactyly, telangiectasis Anti centromere antibody', 'MRSTCS mix connective tissue, RA, SLE, takayasu, CREST, Scleroderma,', 'Urinary incountinance, wipe don’t feel = quad eqvaina ,', 'Chronic gout', 'A', 'Treatment for CREST: Calcinosis cutis, raynaud’s phenomenon, esophageal dysmotility, sclerodactyly, telangiectasis Anti centromere antibody Rx = Penicillemine - pull ou... (Dr. J notes, p20)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9320146BE04F_V', 'A 75-year-old patient with CREST presents with Calcinosis cutis, raynaud’s phenomenon, esophageal dysmotility, sclerodactyly, telangiectasis Anti centromere antibody R. What is the best initial treatment?', 'Calcinosis cutis, raynaud’s phenomenon, esophageal dysmotility, sclerodactyly, telangiectasis Anti centromere antibody', 'MRSTCS mix connective tissue, RA, SLE, takayasu, CREST, Scleroderma,', 'Urinary incountinance, wipe don’t feel = quad eqvaina ,', 'Chronic gout', 'A', 'Treatment for CREST: Calcinosis cutis, raynaud’s phenomenon, esophageal dysmotility, sclerodactyly, telangiectasis Anti centromere antibody Rx = Penicillemine - pull ou... (Vignette from Dr. J notes, p20)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-960189799DA4', 'What is a key risk factor or cause of Plummer Vinson (Upper esophagus)?', 'Risk of squamous cell carcinoma - alcoholism, smoking', 'If in baby, non migration of Auerbach plex, congenital', 'UTIs, Pyelonephritis, cystitis', 'By Cholecystitis', 'A', 'Risk factor for Plummer Vinson (Upper esophagus): Risk of squamous cell carcinoma - alcoholism, smoking (Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-96DF85299DF5', 'What is the classic presentation of Rabies?', 'Px, confusion, fuming from mouth, hydrophobia, hypersalivation', 'Doesn’t vomit - respi acidosis', 'Tingling, burning, local swelling', 'No CO poisoning, we keep 24hrs in hospital why? pul edema risk, in ﬁrst 24 hours , > ischemia , > cell swelling', 'A', 'Classic presentation of Rabies: Px ,  confusion, fuming from mouth, hydrophobia, hypersalivation (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-96DF85299DF5_V', 'A 50-year-old patient presents to the clinic with Px ,  confusion, fuming from mouth, hydrophobia, hypersalivation. Which of the following is the most likely diagnosis?', 'Px, confusion, fuming from mouth, hydrophobia, hypersalivation', 'Doesn’t vomit - respi acidosis', 'Tingling, burning, local swelling', 'No CO poisoning, we keep 24hrs in hospital why? pul edema risk, in ﬁrst 24 hours , > ischemia , > cell swelling', 'A', 'The presentation of Px ,  confusion, fuming from mouth, hydrophobia, hypersalivation is classic for Rabies. (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-976EDE305EA7', 'What is the best diagnostic approach for Hepatic encephalopathy?', 'If Dx Or chance of H.E', 'X-ray = double bubble', 'Barium, Dx- Narrowing of upper esophagus', '6/7 polyps may turn bad but not until 40', 'A', 'Diagnosis of Hepatic encephalopathy: If Dx Or chance of H.E. = protein food takes off (Dr. J notes, p55)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-986F8E227998', 'What is the classic presentation of Keratitis?', 'Pain, photophobia, lacrimation Herpes infection', 'On ﬂexor surfaces, itchy', 'Rash, adrenal hemorrhage, Neiserria meningitides, nausea vomiting photophobia, neck stiffness', 'If no hat, same Px, alopecia', 'A', 'Classic presentation of Keratitis: Pain, photophobia, lacrimation Herpes infection Rx- Acyclovir. (Dr. J notes, p7)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-986F8E227998_V', 'A 45-year-old patient is brought to the ED with Pain, photophobia, lacrimation Herpes infection Rx- Acyclovir.. The most likely diagnosis is:', 'Pain, photophobia, lacrimation Herpes infection', 'On ﬂexor surfaces, itchy', 'Rash, adrenal hemorrhage, Neiserria meningitides, nausea vomiting photophobia, neck stiffness', 'If no hat, same Px, alopecia', 'A', 'The presentation of Pain, photophobia, lacrimation Herpes infection Rx- Acyclovir. is classic for Keratitis. (Dr. J notes, p7)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-98980A1BB498', 'What is the treatment for G6PD?', 'Lots of ﬂuid, transfusion', 'Fluid & dialysis', 'Give with Ⓝ saline', 'Aspirin induced asthma, bronchospasm due to', 'A', 'Treatment for G6PD: Rx ,  Lots of ﬂuid, transfusion. (Dr. J notes, p113)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-98980A1BB498_V', 'A 35-year-old patient with known G6PD comes in with Px ,  hematuria, joint pain, massive hemolysis. Which treatment is most appropriate?', 'Lots of ﬂuid, transfusion', 'Fluid & dialysis', 'Give with Ⓝ saline', 'Aspirin induced asthma, bronchospasm due to', 'A', 'Treatment for G6PD: Rx ,  Lots of ﬂuid, transfusion. (Vignette from Dr. J notes, p113)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-993833C8E0E7', 'What is the best diagnostic approach for Paramyxovirus?', 'Lab - Neck ﬁlm', 'Best initial test - ELISA', 'Echo, rhino, coxsackie, Hep A)', 'Mono spot test will be negative', 'A', 'Diagnosis of Paramyxovirus: Lab - Neck ﬁlm (Dr. J notes, p38)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-993833C8E0E7_V', 'A 8-year-old patient presents with Laryngotracheal bronchitis, presents with stridor, extra thoracic obs.. What is the most accurate diagnostic approach?', 'Lab - Neck ﬁlm', 'Best initial test - ELISA', 'Echo, rhino, coxsackie, Hep A)', 'Mono spot test will be negative', 'A', 'Diagnosis of Paramyxovirus: Lab - Neck ﬁlm (Vignette from Dr. J notes, p38)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-997E63CFC098', 'What is the classic presentation of Zika?', 'Fever, dehydration, ﬂu like symp, rash', 'Neuro symptoms - headache, encephalitis, meningitis', 'Fever, rash and dehydration', 'Purple papules', 'A', 'Classic presentation of Zika: Fever, dehydration, ﬂu like symp, rash. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-997E63CFC098_V', 'A 30-year-old patient is brought to the ED with Fever, dehydration, ﬂu like symp, rash.. The most likely diagnosis is:', 'Fever, dehydration, ﬂu like symp, rash', 'Neuro symptoms - headache, encephalitis, meningitis', 'Fever, rash and dehydration', 'Purple papules', 'A', 'The presentation of Fever, dehydration, ﬂu like symp, rash. is classic for Zika. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-99D434AD0BAE', 'What is the treatment for Mallory Weiss syndrome?', 'Isotonic ﬂuid, due to ↓vol', 'FLuid, antibiotics, surgery', 'Liver transplant', 'Acid crossing sphincter, columnar metaplasia Glandular, so adenocarcinoma', 'A', 'Treatment for Mallory Weiss syndrome: Rx ,  Isotonic ﬂuid ,  due to ↓vol. met. Alkalosis (Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-99D434AD0BAE_V', 'A 55-year-old patient is diagnosed with Mallory Weiss syndrome. The patient presents with Pt. ER - blood vomiting ,  last few days. What is the most appropriate treatment?', 'Isotonic ﬂuid, due to ↓vol', 'FLuid, antibiotics, surgery', 'Liver transplant', 'Acid crossing sphincter, columnar metaplasia Glandular, so adenocarcinoma', 'A', 'Treatment for Mallory Weiss syndrome: Rx ,  Isotonic ﬂuid ,  due to ↓vol. met. Alkalosis (Vignette from Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-99D554E44A5B', 'What is the treatment for venomous snake , keep wound Below?', 'Anti venom for snake, tetanus vaccine', 'Rx, debridement, lots of ﬂuids, diuretics, mannitol', 'Rx., debridement, lots of ﬂuids, diuretics, mannitol', 'N- acetyl cysteine, disulﬁde bonds', 'A', 'Treatment for venomous snake , keep wound Below: Anti venom for snake, tetanus vaccine (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-99D554E44A5B_V', 'A 60-year-old patient is diagnosed with venomous snake , keep wound Below. The patient presents with Hemotoxin ,  makes u bleed out. What is the most appropriate treatment?', 'Anti venom for snake, tetanus vaccine', 'Rx, debridement, lots of ﬂuids, diuretics, mannitol', 'Rx., debridement, lots of ﬂuids, diuretics, mannitol', 'N- acetyl cysteine, disulﬁde bonds', 'A', 'Treatment for venomous snake , keep wound Below: Anti venom for snake, tetanus vaccine (Vignette from Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9A4B338F0B5B', 'What is the treatment for Sickle cell trait?', 'Except in E.R, We give Hydroxyurea to keep HbF high', 'Hydroxy urea', 'Give with Ⓝ saline', 'Phlebotomy', 'A', 'Treatment for Sickle cell trait: Except in E.R ,  We give Hydroxyurea to keep HbF high. (Dr. J notes, p111)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9A8BC8830572', 'What is the treatment for CHF?', 'S3 - systolic dysfunction - low EFBNP high -; diuresis, beta blocker', 'Prolonged PR ↑H.R, shortens PR, infracting AV node', 'Low mg lets Na come right in', 'With chest pain, palpitation, tachycardia, Wide QRS Ventricular arrhythmia/ V', 'A', 'Treatment for CHF: S3 - systolic dysfunction - low EFBNP high - Rx - diuresis, beta blockerRx - ABDFS - ACE inhibitors, beta blocker, digoxin, furosemide, spironolactone (Dr. J notes, p124)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9A8BC8830572_V', 'A 65-year-old patient is diagnosed with CHF. The patient presents with S3 - systolic dysfunction - low EFBNP high - Rx - diuresis, beta blockerRx - ABDFS - ACE inhibitors, beta blocker, digox. What is the most appropriate treatment?', 'S3 - systolic dysfunction - low EFBNP high -; diuresis, beta blocker', 'Prolonged PR ↑H.R, shortens PR, infracting AV node', 'Low mg lets Na come right in', 'With chest pain, palpitation, tachycardia, Wide QRS Ventricular arrhythmia/ V', 'A', 'Treatment for CHF: S3 - systolic dysfunction - low EFBNP high - Rx - diuresis, beta blockerRx - ABDFS - ACE inhibitors, beta blocker, digoxin, furosemide, spironolactone (Vignette from Dr. J notes, p124)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9AAE6FA741E2', 'What is the treatment for SIADH?', 'Chronic SIADH - rx - lithium, dymeﬂocycline', 'Treat with HAART therapy, 2 NRTIs + Integrase or 2NNRTIS', 'Supportive, rest, sunshine, sulfasaline', 'Thiazide, paradoxical effect, make more V₂ aquaporins', 'A', 'Treatment for SIADH: Chronic SIADH - rx - lithium, dymeﬂocycline (Dr. J notes, p13)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9BAD81007F5F', 'What is the classic presentation of Paroxysmal nocturnal hematuria,  Normocytic?', 'Px, red urine in the morning or heavy exercise due to acidic env', 'Fatigue anemia, various types of inf', 'Seizures, fever, renal issues', 'Px , Old pt, Diabetes, bleeding when drawing blood', 'A', 'Classic presentation of Paroxysmal nocturnal hematuria,  Normocytic: Px ,  red urine in the morning or heavy exercise due to acidic env. (Dr. J notes, p113)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9BAD81007F5F_V', 'A 25-year-old patient presents with Px ,  red urine in the morning or heavy exercise due to acidic env.. What is the most likely diagnosis?', 'Px, red urine in the morning or heavy exercise due to acidic env', 'Fatigue anemia, various types of inf', 'Seizures, fever, renal issues', 'Px , Old pt, Diabetes, bleeding when drawing blood', 'A', 'The presentation of Px ,  red urine in the morning or heavy exercise due to acidic env. is classic for Paroxysmal nocturnal hematuria,  Normocytic. (Dr. J notes, p113)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9BAFE37015DE', 'What is the best diagnostic approach for Scabies ,  Px?', 'Scrape test', 'Punch biopsy', 'KOH (best initial)', 'Full thickness biopsy', 'A', 'Diagnosis of Scabies ,  Px: Scrape test. (Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9C54BC9B9A69', 'What is the mechanism of Sickle cell anemia?', 'Point mutation of glutamic acid leading to valine', 'Kids, resolve, autoimmune', 'Chronic PPI use - PPI inhibit parietal cell secretion which needs for B12 absorption', 'Tyrosine kinase?? B.I, LAP', 'A', 'Mechanism of Sickle cell anemia: Point mutation of glutamic acid → valine (Dr. J notes, p111)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9DD249CC8525', 'What is a key risk factor or cause of HHV-8 (@HIV)?', 'Cancer, angiosarcoma of veins', 'Chronic, risk of cancer', 'Most likely cause cancer', 'No blindness but can cause death', 'A', 'Risk factor for HHV-8 (@HIV): Cause cancer ,  angiosarcoma of veins. (Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9DE6954AF640', 'What is the treatment for Opioids?', 'Slur speech withdrawal, mydriasis, yawning, lacrimation', 'Charcoal', 'Lots of water & remove chemical', 'Digoxin ab', 'A', 'Treatment for Opioids: Slur speech withdrawal ,  mydriasis, yawning, lacrimation Rx - naloxone, methadone (Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9DE6954AF640_V', 'A 60-year-old patient is diagnosed with Opioids. The patient presents with Slur speech withdrawal ,  mydriasis, yawning, lacrimation Rx - naloxone, methadone. What is the most appropriate treatment?', 'Slur speech withdrawal, mydriasis, yawning, lacrimation', 'Charcoal', 'Lots of water & remove chemical', 'Digoxin ab', 'A', 'Treatment for Opioids: Slur speech withdrawal ,  mydriasis, yawning, lacrimation Rx - naloxone, methadone (Vignette from Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9E21F04C349D', 'What is the classic presentation of A.Fibrilation?', 'Funny feeling No P waves, EKG Decrease in PH , No pain, risk embolism in A. Fib', 'With chest pain, palpitation, tachycardia, Wide QRS Ventricular arrhythmia/ V', 'Low mg lets Na come right in', 'No pain', 'A', 'Classic presentation of A.Fibrilation: Funny feeling No P waves ,  EKG Decrease in PH , No pain, risk embolism in A. Fib Rx - Ca channel blockers ,  control rate β blockers - A.ﬁb + HTN Di... (Dr. J notes, p120)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9E21F04C349D_V', 'A 72-year-old patient presents to the clinic with Funny feeling No P waves ,  EKG Decrease in PH , No pain, risk embolism in A. Fib Rx - Ca channel blockers ,  control rate. Which of the following is the most likely diagnosis?', 'Funny feeling No P waves, EKG Decrease in PH , No pain, risk embolism in A. Fib', 'With chest pain, palpitation, tachycardia, Wide QRS Ventricular arrhythmia/ V', 'Low mg lets Na come right in', 'No pain', 'A', 'The presentation of Funny feeling No P waves ,  EKG Decrease in PH , No pain, risk embolism in A. Fib Rx - Ca channel blockers ,  control rate is classic for A.Fibrilation. (Dr. J notes, p120)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9E25153BBB22', 'What is a key risk factor or cause of Gastrin?', 'That’s why Hypercalcemia, cause ulcers', 'Cancer risk ↑↑', 'Pylori, NSAIDs, spicy food', 'PH alkalotic, risk for staghorn calculi', 'A', 'Risk factor for Gastrin: That’s why Hypercalcemia ,  cause ulcers (Dr. J notes, p51)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9EE945D5EB3B', 'What is the treatment for B12 Def?', 'Gastric by pass vit needs to give in order = B1, B12 and B9', 'Supplement B12, vegans, and pts with bariatric Sx', 'Steroids, plasmapheresis', 'Urokinase, when open ﬁstula, tubes', 'A', 'Treatment for B12 Def: Gastric by pass vit needs to give in order = B1, B12 and B9 (Dr. J notes, p111)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9EE945D5EB3B_V', 'A 45-year-old patient is diagnosed with B12 Def. The patient presents with Anemia symptoms,. What is the most appropriate treatment?', 'Gastric by pass vit needs to give in order = B1, B12 and B9', 'Supplement B12, vegans, and pts with bariatric Sx', 'Steroids, plasmapheresis', 'Urokinase, when open ﬁstula, tubes', 'A', 'Treatment for B12 Def: Gastric by pass vit needs to give in order = B1, B12 and B9 (Vignette from Dr. J notes, p111)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9F2BDFC31613', 'What is the treatment for Iron deﬁciency?', 'Iron + vit C', 'Supplement B12, vegans, and pts with bariatric Sx', 'B6 supplement, underlying cause if any', 'Aspirin induced asthma, bronchospasm due to', 'A', 'Treatment for Iron deﬁciency: Rx ,  Iron + vit C. Give Deferoxamine if iron overload. (Dr. J notes, p110)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-9F3E898CABDF', 'What is the treatment for Gray’s?', 'Blocks T₃, T₄ production pathway (', '> surgical remove (Thyroidectomy )', 'Anti TSH, anti microsomal, anti TPO', 'Dicloxacillin Impetigo, Honey crust lesions', 'A', 'Treatment for Gray’s: Blocks T₃, T₄ production pathway (3) (Dr. J notes, p13)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A00F50B9763C', 'What is the mechanism of EPO?', 'Tyrosine kinase', 'Resorb in vit D def, resorb the bone', 'Resorb in vit D def., resorb the bone', '1 Antibody against to pancreas , > slow progressing autoimmune', 'A', 'Mechanism of EPO: 2ⁿᵈ messenger , > Tyrosine kinase (Dr. J notes, p11)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A08DB98D4D3F', 'What is the classic presentation of Osteoarthritis?', '50-60 yo - mono articular Pain with movement mostly day, worse at end of day, nodes present Joints in ﬁngers, DIP', 'Bilateral Joints pain & stiff in morning', 'Pain and swelling, fever, warmness & redness in that area Most common bug - Steph Aureus, sickle cell - salmonella', 'After age 5, muscle weakness and ensuing gait abnormalities with miss sense Non frameshift mutation, no gowers sign', 'A', 'Classic presentation of Osteoarthritis: 50-60 yo - mono articular Pain with movement mostly day, worse at end of day, nodes present Joints in ﬁngers ,  DIP, MCP X-ray - narrowing of joint s... (Dr. J notes, p21)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A08DB98D4D3F_V', 'A 55-year-old patient presents to the clinic with 50-60 yo - mono articular Pain with movement mostly day, worse at end of day, nodes present Joints in ﬁngers ,  DIP, MCP X. Which of the following is the most likely diagnosis?', '50-60 yo - mono articular Pain with movement mostly day, worse at end of day, nodes present Joints in ﬁngers, DIP', 'Bilateral Joints pain & stiff in morning', 'Pain and swelling, fever, warmness & redness in that area Most common bug - Steph Aureus, sickle cell - salmonella', 'After age 5, muscle weakness and ensuing gait abnormalities with miss sense Non frameshift mutation, no gowers sign', 'A', 'The presentation of 50-60 yo - mono articular Pain with movement mostly day, worse at end of day, nodes present Joints in ﬁngers ,  DIP, MCP X is classic for Osteoarthritis. (Dr. J notes, p21)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A0B494D8A3E9', 'What is the classic presentation of SLE?', 'Fatigue, malar rash, joint pain, painless ulcer oral', '50-60 yo - mono articular Pain with movement mostly day, worse at end of day, nodes present Joints in ﬁngers, DIP', 'Back pain, more when lean down, > 65yo leading to 3 diffrenciations = multiple myeloma, tumor, metastasis', 'Pain pronate, ﬂex wrist, pain elbow = medial epicondyle - golfer’s elbow', 'A', 'Classic presentation of SLE: Fatigue, malar rash, joint pain, painless ulcer oral (Dr. J notes, p20)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A0B494D8A3E9_V', 'A 40-year-old patient presents with Fatigue, malar rash, joint pain, painless ulcer oral. What is the most likely diagnosis?', 'Fatigue, malar rash, joint pain, painless ulcer oral', '50-60 yo - mono articular Pain with movement mostly day, worse at end of day, nodes present Joints in ﬁngers, DIP', 'Back pain, more when lean down, > 65yo leading to 3 diffrenciations = multiple myeloma, tumor, metastasis', 'Pain pronate, ﬂex wrist, pain elbow = medial epicondyle - golfer’s elbow', 'A', 'The presentation of Fatigue, malar rash, joint pain, painless ulcer oral is classic for SLE. (Dr. J notes, p20)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A17E43C80BFB', 'What is the treatment for PTSD?', 'FLash backs for >1 month', 'Inhibit 5-HT & NE re-uptake Use - neuropathy, A/E - prolong QT NOT give old people', 'Constipation, pin point pupils, slow speech, impaired memory', 'Benzo (short acting), liver issues Benzo, long acting, if no liver damage', 'A', 'Treatment for PTSD: FLash backs for >1 month. Rx = Therapy, sertraline, Prazosin (Dr. J notes, p63)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A17E43C80BFB_V', 'A 18-year-old patient with PTSD presents with FLash backs for >1 month. Rx = Therapy, sertraline, Prazosin. What is the best initial treatment?', 'FLash backs for >1 month', 'Inhibit 5-HT & NE re-uptake Use - neuropathy, A/E - prolong QT NOT give old people', 'Constipation, pin point pupils, slow speech, impaired memory', 'Benzo (short acting), liver issues Benzo, long acting, if no liver damage', 'A', 'Treatment for PTSD: FLash backs for >1 month. Rx = Therapy, sertraline, Prazosin (Vignette from Dr. J notes, p63)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A2635891C41D', 'What is the treatment for Loop diuretics?', 'Furosemide, strong vasodilator', 'Very slow infusion of hypertonic ﬂuid 3% normal saline, OSM ↑, ECF ↑, ICF↓ Lithium and demeclocyclin, to shut of ADH', 'Urine turns black Homogentisic acid def; take out phenylalanine and tyrosine', 'Hematuria, allergy like sx cause = drugs allergy cast - eosinophil casts Rx, ﬂuids, steroid, stop drug which causing it', 'A', 'Treatment for Loop diuretics: Furosemide ,  strong vasodilator because its use prostaglandin. we don''t take NSAID’s with it. because constrict renal A. Lasts ,  6 hours. (Dr. J notes, p89)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A33F08755F64', 'What is the treatment for Echinococcus granulosus?', 'Tx - fecal oral', 'Tx, Fecal oral', 'Praziquantel', 'Cannot treat or prevent it', 'A', 'Treatment for Echinococcus granulosus: Tx - fecal oral (Dr. J notes, p39)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A3AE0CC82B0E', 'What is the classic presentation of Yellow fever ,  vector?', 'Black vomitus (due to blood), high fever and severe liver damage', 'Fever, rash and dehydration', 'Fever, dehydration, ﬂu like symp, rash', 'Fever myalgia, joint pain', 'A', 'Classic presentation of Yellow fever ,  vector: Black vomitus (due to blood), high fever and severe liver damage. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A3AE0CC82B0E_V', 'A 5-year-old patient is brought to the ED with Black vomitus (due to blood), high fever and severe liver damage.. The most likely diagnosis is:', 'Black vomitus (due to blood), high fever and severe liver damage', 'Fever, rash and dehydration', 'Fever, dehydration, ﬂu like symp, rash', 'Fever myalgia, joint pain', 'A', 'The presentation of Black vomitus (due to blood), high fever and severe liver damage. is classic for Yellow fever ,  vector. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A3D353FFF37F', 'What is the mechanism of Hashimoto thyroiditis?', 'By autoimmune disease', 'Nuclear / retinoid, binding to DNA , > cause hormone receptor', '1 Antibody against to pancreas , > slow progressing autoimmune', 'Autoimmune, sensitive blisters, break easily, painful', 'A', 'Mechanism of Hashimoto thyroiditis: Cause by autoimmune disease (Dr. J notes, p13)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A3E0DC7C5FD2', 'What is the mechanism of V. Tach?', 'Small ﬂuttering line', 'Low mg lets Na come right in', 'No pain', 'Funny feeling No P waves, EKG Decrease in PH , No pain, risk embolism in A. Fib', 'A', 'Mechanism of V. Tach: Small ﬂuttering line. Rx ,  If stable ,  Na channel blocker. If we want to control both ventricles and atrium ,  K+ Channel blocker. Amioderone ,  both... (Dr. J notes, p120)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A4133B69087D', 'What is a key risk factor or cause of Galactosuria?', 'Hexokinase (back up), Galactose in urine, and water goes along with it', 'B cells and neutrophils, gets sick quicker, High fever', 'Protein level = normal to low', 'Very slow infusion of hypertonic ﬂuid 3% normal saline, OSM ↑, ECF ↑, ICF↓ Lithium and demeclocyclin, to shut of ADH', 'A', 'Risk factor for Galactosuria: Hexokinase (back up) ,  Galactose in urine, and water goes along with it. Cause ,  UTI, polyuria, polydipsia, cataract (Dr. J notes, p102)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A44C0C36CDAE', 'What is the classic presentation of Bacillus cereus?', 'Diarrhea toxin, >18hrs - Left out meat and sauces', 'Severe abdominal pain radiating to the back, vomiting', '7 1. Catalase = Break down Hydrogen peroxide (H₂O₂ + H₂O + O₂) 2', 'Chest pain', 'A', 'Classic presentation of Bacillus cereus: Diarrhea toxin ,  >18hrs - Left out meat and sauces (Dr. J notes, p45)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A44C0C36CDAE_V', 'A 40-year-old patient presents to the clinic with Diarrhea toxin ,  >18hrs - Left out meat and sauces. Which of the following is the most likely diagnosis?', 'Diarrhea toxin, >18hrs - Left out meat and sauces', 'Severe abdominal pain radiating to the back, vomiting', '7 1. Catalase = Break down Hydrogen peroxide (H₂O₂ + H₂O + O₂) 2', 'Chest pain', 'A', 'The presentation of Diarrhea toxin ,  >18hrs - Left out meat and sauces is classic for Bacillus cereus. (Dr. J notes, p45)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A55EA25830A3', 'What is a key risk factor or cause of NPV?', 'TN / (TN + FN)', 'TP / (TP + FP) (positive predictive value)', 'FP / (FP + TN) (false positive rate)', 'TN / (TN + FP)', 'A', 'Risk factor for NPV: TN / (TN + FN) )Odds ratio ,  diseased are X times more likely to have the risk factor in history We use odds ratio ,  retrospective study (already s... (Dr. J notes, p134)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A563D88BFED6', 'What is the classic presentation of Porphyria cutanea tarda?', 'But enzyme def', 'Common in older, but if many appear in short period, rule out cancer', 'Angiosarcoma of the veins', 'Positive nikalosky sign', 'A', 'Classic presentation of Porphyria cutanea tarda: But enzyme def. Px porphyrin rings on skin Burns when exposed to sun. Uroporphyrinogen decarboxylase def. Rx - phlebotomy, dipheroxymitne (Dr. J notes, p6)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A563D88BFED6_V', 'A 22-year-old patient is brought to the ED with But enzyme def. Px porphyrin rings on skin Burns when exposed to sun. Uroporphyrinogen decarboxylase def. Rx - phlebotom. The most likely diagnosis is:', 'But enzyme def', 'Common in older, but if many appear in short period, rule out cancer', 'Angiosarcoma of the veins', 'Positive nikalosky sign', 'A', 'The presentation of But enzyme def. Px porphyrin rings on skin Burns when exposed to sun. Uroporphyrinogen decarboxylase def. Rx - phlebotom is classic for Porphyria cutanea tarda. (Dr. J notes, p6)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A62853BFA426', 'What is a key risk factor or cause of Budd-Chiari?', 'Risk of clots, If happens in hepatic vein', 'Increase retention of iron within reticuloendothelial system', 'Ab directly on RBC membrane, genetic, immune resp', 'Art. Clots cause what pathologies, MI, stroke', 'A', 'Risk factor for Budd-Chiari: Risk of clots ,  If happens in hepatic vein (Dr. J notes, p113)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A63D2C64178A', 'What is the classic presentation of DH toxicity?', 'Prox tachycardia, nausea, vomiting', 'Tachycardia, nausea, vomiting', 'Chest pain, aspirin, shortness of breath', 'Hemotoxin, makes u bleed out', 'A', 'Classic presentation of DH toxicity: Prox tachycardia, nausea, vomiting (Dr. J notes, p28)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A63D2C64178A_V', 'A 35-year-old patient is brought to the ED with Prox tachycardia, nausea, vomiting. The most likely diagnosis is:', 'Prox tachycardia, nausea, vomiting', 'Tachycardia, nausea, vomiting', 'Chest pain, aspirin, shortness of breath', 'Hemotoxin, makes u bleed out', 'A', 'The presentation of Prox tachycardia, nausea, vomiting is classic for DH toxicity. (Dr. J notes, p28)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A63E6C970227', 'What is the treatment for Herpes encephalitis?', 'Confusion, neck stiffness, photophobia, olfactory hallucinations', 'Symptomatic, ataxia, spingomyelia, pain and temperature loss bilateral', 'Need vit A to make CSF enzyme - carbonic anhydrase, acetazolamide inhibits carbonic anhydrase CSF acidic in blood', 'Night terrors, sleep walking, teeth grinding increase intracraneal pressure, nausea, headache First sign', 'A', 'Treatment for Herpes encephalitis: Confusion, neck stiffness, photophobia, olfactory hallucinations.Rx - IV acyclovir (Dr. J notes, p139)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A63E6C970227_V', 'A 70-year-old patient with Herpes encephalitis presents with Confusion, neck stiffness, photophobia, olfactory hallucinations.Rx - IV acyclovir. What is the best initial treatment?', 'Confusion, neck stiffness, photophobia, olfactory hallucinations', 'Symptomatic, ataxia, spingomyelia, pain and temperature loss bilateral', 'Need vit A to make CSF enzyme - carbonic anhydrase, acetazolamide inhibits carbonic anhydrase CSF acidic in blood', 'Night terrors, sleep walking, teeth grinding increase intracraneal pressure, nausea, headache First sign', 'A', 'Treatment for Herpes encephalitis: Confusion, neck stiffness, photophobia, olfactory hallucinations.Rx - IV acyclovir (Vignette from Dr. J notes, p139)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A6C4F6E499EB', 'What is the mechanism of SCID?', 'Enzyme, A.D.A def', 'Type II, cytotoxic, True autoimmune ABO & Rh', 'Bruton’s, agammaglobulinemia = X linked recessive, tyrosine kinase prob', 'Ataxia telangiectasia, DNA endonuclease, enzyme', 'A', 'Mechanism of SCID: Enzyme ,  A.D.A def. (adenosine deaminase) (Dr. J notes, p84)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A6E8DD2609F4', 'What is the treatment for Drug induced SLE?', 'Muscle pain, not true autoimmune C- normal, rx - stop drug „ Anti histon-antibody, complement level normalhydrolasin', 'Steroids', 'After menopause, >55 Osteoclast problem', 'Methotrexate = dihydro-folate reductase inhibitor, A/E - megaloblastic anemia so Give with B9, leucovorin', 'A', 'Treatment for Drug induced SLE: Muscle pain, not true autoimmune C- normal, rx - stop drug „ Anti histon-antibody, complement level normalhydrolasin, INH, prednison, procanemide, ... (Dr. J notes, p20)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A6E8DD2609F4_V', 'A 28-year-old patient with Drug induced SLE presents with Muscle pain, not true autoimmune C- normal, rx - stop drug „ Anti histon-antibody, complement level normalhydrolasin, IN. What is the best initial treatment?', 'Muscle pain, not true autoimmune C- normal, rx - stop drug „ Anti histon-antibody, complement level normalhydrolasin', 'Steroids', 'After menopause, >55 Osteoclast problem', 'Methotrexate = dihydro-folate reductase inhibitor, A/E - megaloblastic anemia so Give with B9, leucovorin', 'A', 'Treatment for Drug induced SLE: Muscle pain, not true autoimmune C- normal, rx - stop drug „ Anti histon-antibody, complement level normalhydrolasin, INH, prednison, procanemide, ... (Vignette from Dr. J notes, p20)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A7079B0DADF0', 'What is the treatment for Tinea capitis?', 'Oral Griseofulvin, oral ketoconazole, itraconazole, isosulfate', 'Oral terbinaﬁne', 'Topical azole', 'Blocks T₃, T₄ production pathway (', 'A', 'Treatment for Tinea capitis: Rx ,  oral Griseofulvin, oral ketoconazole, itraconazole, isosulfate (Dr. J notes, p3)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A7079B0DADF0_V', 'A 32-year-old patient with known Tinea capitis comes in with Smooth borders, wear hat all the time in history.. Which treatment is most appropriate?', 'Oral Griseofulvin, oral ketoconazole, itraconazole, isosulfate', 'Oral terbinaﬁne', 'Topical azole', 'Blocks T₃, T₄ production pathway (', 'A', 'Treatment for Tinea capitis: Rx ,  oral Griseofulvin, oral ketoconazole, itraconazole, isosulfate (Vignette from Dr. J notes, p3)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A7EACEDB0BA1', 'What is the classic presentation of N. Gonorrhea?', 'Painful, Joint pain (migratory), discharge, urathritis', 'Capsule - typical, fast onset', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', '↓energy state', 'A', 'Classic presentation of N. Gonorrhea: Painful, Joint pain (migratory), discharge, urathritis (Dr. J notes, p45)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A7EACEDB0BA1_V', 'A 40-year-old patient presents with Painful, Joint pain (migratory), discharge, urathritis. What is the most likely diagnosis?', 'Painful, Joint pain (migratory), discharge, urathritis', 'Capsule - typical, fast onset', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', '↓energy state', 'A', 'The presentation of Painful, Joint pain (migratory), discharge, urathritis is classic for N. Gonorrhea. (Dr. J notes, p45)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A8280709DD91', 'What is the mechanism of Ataxia telangiectasia?', 'Ataxia telangiectasia, DNA endonuclease, enzyme', 'Bruton’s, agammaglobulinemia = X linked recessive, tyrosine kinase prob', 'Enzyme, A.D.A def', 'Type II, cytotoxic, True autoimmune ABO & Rh', 'A', 'Mechanism of Ataxia telangiectasia: Ataxia telangiectasia, DNA endonuclease ,  enzyme. (Dr. J notes, p85)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A83DDD02A707', 'What is the classic presentation of Carpal tunnel?', 'Tingling 1ˢᵗ 3 ﬁngers', 'Night terrors, sleep walking, teeth grinding increase intracraneal pressure, nausea, headache First sign', 'Symptomatic, ataxia, spingomyelia, pain and temperature loss bilateral', 'Greasy appearancePt with headache, precocious puberty, bitemporal hemianopsia + loss of upper gaze, Pinealoma Stroke', 'A', 'Classic presentation of Carpal tunnel: Tingling 1ˢᵗ 3 ﬁngers (Dr. J notes, p142)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A83DDD02A707_V', 'A 45-year-old patient presents to the clinic with Tingling 1ˢᵗ 3 ﬁngers. Which of the following is the most likely diagnosis?', 'Tingling 1ˢᵗ 3 ﬁngers', 'Night terrors, sleep walking, teeth grinding increase intracraneal pressure, nausea, headache First sign', 'Symptomatic, ataxia, spingomyelia, pain and temperature loss bilateral', 'Greasy appearancePt with headache, precocious puberty, bitemporal hemianopsia + loss of upper gaze, Pinealoma Stroke', 'A', 'The presentation of Tingling 1ˢᵗ 3 ﬁngers is classic for Carpal tunnel. (Dr. J notes, p142)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A8E8E0551297', 'What is the best diagnostic approach for LSD → overdose?', 'Hallucination, synesthsesia, test colors, euphoria, panic', '> 2 year of low level sadness, dysthymia; CBT', 'Irreversible Tumor marker = KI 67BenignMalignant 90% of tumors10% of tumors Freely mobile FixedWell circumscribed Not', 'Repsiratory & cardiac supration', 'A', 'Diagnosis of LSD → overdose: Hallucination, synesthsesia, test colors, euphoria, panic (Dr. J notes, p60)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A8E8E0551297_V', 'A 45-year-old patient presents with Hallucination, synesthsesia, test colors, euphoria, panic. What is the most accurate diagnostic approach?', 'Hallucination, synesthsesia, test colors, euphoria, panic', '> 2 year of low level sadness, dysthymia; CBT', 'Irreversible Tumor marker = KI 67BenignMalignant 90% of tumors10% of tumors Freely mobile FixedWell circumscribed Not', 'Repsiratory & cardiac supration', 'A', 'Diagnosis of LSD → overdose: Hallucination, synesthsesia, test colors, euphoria, panic (Vignette from Dr. J notes, p60)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A92732C18C9F', 'What is the classic presentation of Selective IgA def?', 'Hx of sinopulmonary infection', 'Chronic back pain', 'Back pain - But X- ray normal', 'Lose stools, dry skin Dementia diarrhea Dermatitis', 'A', 'Classic presentation of Selective IgA def: Hx of sinopulmonary infection. (Dr. J notes, p84)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A92732C18C9F_V', 'A 55-year-old patient is brought to the ED with Hx of sinopulmonary infection.. The most likely diagnosis is:', 'Hx of sinopulmonary infection', 'Chronic back pain', 'Back pain - But X- ray normal', 'Lose stools, dry skin Dementia diarrhea Dermatitis', 'A', 'The presentation of Hx of sinopulmonary infection. is classic for Selective IgA def. (Dr. J notes, p84)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A9704B28F049', 'What is the mechanism of 2ⁿᵈ messenger for insulin?', 'Growth factor, EPO = Tyrosine kinase', 'T₄ have receptor on nucleus', '↑ sugar, receptor on cytoplasm', '1P , > Medullary thyroid carcinoma [RET Gene]', 'A', 'Mechanism of 2ⁿᵈ messenger for insulin: Growth factor, EPO = Tyrosine kinase (Dr. J notes, p10)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A98159E9CD75', 'What is the treatment for Major depression?', '≥ 5 symptoms, ≥2 weeks SIG E CAPSSleep ↑↓Interest ↓ = diﬃcult to treat Guilt Energy ↓Concentration ↓Appetite', 'Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures', 'Antidepressant, lorazepam', 'Tardive dyskinesia leading to frog tongue like movements', 'A', 'Treatment for Major depression: ≥ 5 symptoms, ≥2 weeks SIG E CAPSSleep ↑↓Interest ↓ = diﬃcult to treat Guilt Energy ↓Concentration ↓Appetite ↑↓Psychomotor change ↑↓Suicide Rx = ru... (Dr. J notes, p62)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A98159E9CD75_V', 'A 45-year-old patient with Major depression presents with ≥ 5 symptoms, ≥2 weeks SIG E CAPSSleep ↑↓Interest ↓ = diﬃcult to treat Guilt Energy ↓Concentration ↓Appetite ↑↓Psychomot. What is the best initial treatment?', '≥ 5 symptoms, ≥2 weeks SIG E CAPSSleep ↑↓Interest ↓ = diﬃcult to treat Guilt Energy ↓Concentration ↓Appetite', 'Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures', 'Antidepressant, lorazepam', 'Tardive dyskinesia leading to frog tongue like movements', 'A', 'Treatment for Major depression: ≥ 5 symptoms, ≥2 weeks SIG E CAPSSleep ↑↓Interest ↓ = diﬃcult to treat Guilt Energy ↓Concentration ↓Appetite ↑↓Psychomotor change ↑↓Suicide Rx = ru... (Vignette from Dr. J notes, p62)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-A990519F1F58', 'What is the treatment for Hepato renal syndrome?', 'Liver transplant', 'FLuid, antibiotics, surgery', 'Isotonic ﬂuid, due to ↓vol', 'ACUTE hep C', 'A', 'Treatment for Hepato renal syndrome: Rx ,  Liver transplant. (Dr. J notes, p55)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-AA2E57F5ED63', 'What is the treatment for Bullous pemphigoid?', 'Steroids', 'No pain, when looks sideways', 'Steroids, IVIg', 'Chronic SIADH - rx - lithium, dymeﬂocycline', 'A', 'Treatment for Bullous pemphigoid: Steroids (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-AAA4E227DA64', 'What is the treatment for Dermatomyositis?', 'Steroids', 'Muscle pain, not true autoimmune C- normal, rx - stop drug „ Anti histon-antibody, complement level normalhydrolasin', 'Chronic gout', 'After menopause, >55 Osteoclast problem', 'A', 'Treatment for Dermatomyositis: Steroids (Dr. J notes, p19)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-ABDC9427096E', 'What is the treatment for 65yo pt?', 'History of duodenal ulcer - acute gout', 'Went to vagus drink alcohol to much, acute gout', 'Steroids', 'MRSTCS mix connective tissue, RA, SLE, takayasu, CREST, Scleroderma', 'A', 'Treatment for 65yo pt: History of duodenal ulcer - acute gout Rx = Intra artery cular steroid (Dr. J notes, p22)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-ABDC9427096E_V', 'A 55-year-old patient is diagnosed with 65yo pt. The patient presents with History of duodenal ulcer - acute gout Rx = Intra artery cular steroid. What is the most appropriate treatment?', 'History of duodenal ulcer - acute gout', 'Went to vagus drink alcohol to much, acute gout', 'Steroids', 'MRSTCS mix connective tissue, RA, SLE, takayasu, CREST, Scleroderma', 'A', 'Treatment for 65yo pt: History of duodenal ulcer - acute gout Rx = Intra artery cular steroid (Vignette from Dr. J notes, p22)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-ABE2DF98F21B', 'What is the classic presentation of Glucagonomas?', 'Dermatitis, diabetes, DVT, diarrhea In liver, partial oxidation of fatty acids', 'A/E = edema (where sugar goes water goes), weight gain', 'Scaly skin rash after infection', 'Rash, adrenal hemorrhage, Neiserria meningitides, nausea vomiting photophobia, neck stiffness', 'A', 'Classic presentation of Glucagonomas: Dermatitis, diabetes, DVT, diarrhea In liver,  partial oxidation of fatty acids (Dr. J notes, p15)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-ABE2DF98F21B_V', 'A 32-year-old patient presents with Dermatitis, diabetes, DVT, diarrhea In liver,  partial oxidation of fatty acids. What is the most likely diagnosis?', 'Dermatitis, diabetes, DVT, diarrhea In liver, partial oxidation of fatty acids', 'A/E = edema (where sugar goes water goes), weight gain', 'Scaly skin rash after infection', 'Rash, adrenal hemorrhage, Neiserria meningitides, nausea vomiting photophobia, neck stiffness', 'A', 'The presentation of Dermatitis, diabetes, DVT, diarrhea In liver,  partial oxidation of fatty acids is classic for Glucagonomas. (Dr. J notes, p15)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-AC99BFC3DDA7', 'What is the best diagnostic approach for Pernicious anemia?', 'Most accurate test, B12 level or we check for homocysteine and methylmalonic acid', 'Best initial Diagnostic, Iron study, High TIBC', 'B.M biopsy, perssion blue stain', 'Smear, spherocytes', 'A', 'Diagnosis of Pernicious anemia: Most accurate test ,  B12 level or we check for homocysteine and methylmalonic acid (Dr. J notes, p111)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-AD37A9A85DD2', 'What is the classic presentation of Paramyxovirus?', 'Laryngotracheal bronchitis, presents with stridor, extra thoracic obs', 'Flu like symp', 'Diarrhea after traveling in cruise, big hotels (large crowds) buffets', 'Fever, myalgia, splenomegaly, lymphadenopathy', 'A', 'Classic presentation of Paramyxovirus: Laryngotracheal bronchitis, presents with stridor, extra thoracic obs. (Dr. J notes, p38)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-AD37A9A85DD2_V', 'A 45-year-old patient presents with Laryngotracheal bronchitis, presents with stridor, extra thoracic obs.. What is the most likely diagnosis?', 'Laryngotracheal bronchitis, presents with stridor, extra thoracic obs', 'Flu like symp', 'Diarrhea after traveling in cruise, big hotels (large crowds) buffets', 'Fever, myalgia, splenomegaly, lymphadenopathy', 'A', 'The presentation of Laryngotracheal bronchitis, presents with stridor, extra thoracic obs. is classic for Paramyxovirus. (Dr. J notes, p38)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-AD5E5DC2C408', 'What is the mechanism of Growth hormone?', 'Gluconeogenesis by proteolysis in the liver', 'T₄ have receptor on nucleus', 'Growth factor, EPO = Tyrosine kinase', 'PPAR-γ receptor activation', 'A', 'Mechanism of Growth hormone: Biochemical pathway , > Gluconeogenesis by proteolysis in the liver (Dr. J notes, p11)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-AD6A71D86E71', 'What is the treatment for Listeria?', 'Macrolide = 50s', 'Wash, clean, amoxycillin, clavulanate', 'Amoxicillin - cell wall synthesis', 'Macrolides', 'A', 'Treatment for Listeria: Macrolide = 50s (Dr. J notes, p44)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-AD6A71D86E71_V', 'A 18-year-old patient is diagnosed with Listeria. The patient presents with G+ ve. What is the most appropriate treatment?', 'Macrolide = 50s', 'Wash, clean, amoxycillin, clavulanate', 'Amoxicillin - cell wall synthesis', 'Macrolides', 'A', 'Treatment for Listeria: Macrolide = 50s (Vignette from Dr. J notes, p44)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-ADEAD07649EA', 'What is the treatment for Pheochromocytoma?', '𝝰 blockers then β blockers to avoid hypertensive crisis', 'Anti TSH, anti microsomal, anti TPO', 'Blocks T₃, T₄ production pathway (', 'Dopamine agonist', 'A', 'Treatment for Pheochromocytoma: Rx ,  𝝰 blockers then β blockers to avoid hypertensive crisis (Dr. J notes, p15)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-ADEAD07649EA_V', 'A 58-year-old patient with Pheochromocytoma presents with Pallor. What is the best initial treatment?', '𝝰 blockers then β blockers to avoid hypertensive crisis', 'Anti TSH, anti microsomal, anti TPO', 'Blocks T₃, T₄ production pathway (', 'Dopamine agonist', 'A', 'Treatment for Pheochromocytoma: Rx ,  𝝰 blockers then β blockers to avoid hypertensive crisis (Vignette from Dr. J notes, p15)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-ADFFAFEE56A8', 'What is the treatment for Pitirysis rosacea?', 'Supportive, rest, sunshine, sulfasaline', 'Treat with HAART therapy, 2 NRTIs + Integrase or 2NNRTIS', 'Topical Metronidazole', 'Topical selenium sulﬁde, ketoconazole', 'A', 'Treatment for Pitirysis rosacea: Rx ,  supportive, rest, sunshine, sulfasaline (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-AE0EF9ABDDCB', 'What is the treatment for Types Of Collagen?', 'Bone, cornea, scar tissue II', 'Type IV , - Delayed (ex.- Contact dermatitis, GVHD, PPD test, Chronic transplant rejection)', 'Muddy brown, granular #1 Cause = blood loss', 'Hematuria, allergy like sx cause = drugs allergy cast - eosinophil casts Rx, ﬂuids, steroid, stop drug which causing it', 'A', 'Treatment for Types Of Collagen: Bone, cornea, scar tissue II. Connective tissue, aqueous humor III. B.vessel, uterus IV. Basement membrane, Lens 1ˢᵗ step ,  Def of hydroxylation of... (Dr. J notes, p100)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-AE0EF9ABDDCB_V', 'A 55-year-old patient is diagnosed with Types Of Collagen. The patient presents with Bone, cornea, scar tissue II. Connective tissue, aqueous humor III. B.vessel, uterus IV. Basement membrane, Lens 1ˢᵗ ste. What is the most appropriate treatment?', 'Bone, cornea, scar tissue II', 'Type IV , - Delayed (ex.- Contact dermatitis, GVHD, PPD test, Chronic transplant rejection)', 'Muddy brown, granular #1 Cause = blood loss', 'Hematuria, allergy like sx cause = drugs allergy cast - eosinophil casts Rx, ﬂuids, steroid, stop drug which causing it', 'A', 'Treatment for Types Of Collagen: Bone, cornea, scar tissue II. Connective tissue, aqueous humor III. B.vessel, uterus IV. Basement membrane, Lens 1ˢᵗ step ,  Def of hydroxylation of... (Vignette from Dr. J notes, p100)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-AE19BCBFF399', 'What is the treatment for Acute interstitial nephritis (AIN)?', 'Hematuria, allergy like sx cause = drugs allergy cast - eosinophil casts Rx, ﬂuids, steroid, stop drug which causing it', 'Muddy brown, granular #1 Cause = blood loss', 'Urine turns black Homogentisic acid def; take out phenylalanine and tyrosine', 'Furosemide, strong vasodilator', 'A', 'Treatment for Acute interstitial nephritis (AIN): Hematuria, allergy like sx cause = drugs allergy cast - eosinophil casts Rx ,  ﬂuids, steroid, stop drug which causing it (Dr. J notes, p93)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-AE19BCBFF399_V', 'A 8-year-old patient is diagnosed with Acute interstitial nephritis (AIN). The patient presents with Hematuria, allergy like sx cause = drugs allergy cast - eosinophil casts Rx ,  ﬂuids, steroid, stop drug which causing it. What is the most appropriate treatment?', 'Hematuria, allergy like sx cause = drugs allergy cast - eosinophil casts Rx, ﬂuids, steroid, stop drug which causing it', 'Muddy brown, granular #1 Cause = blood loss', 'Urine turns black Homogentisic acid def; take out phenylalanine and tyrosine', 'Furosemide, strong vasodilator', 'A', 'Treatment for Acute interstitial nephritis (AIN): Hematuria, allergy like sx cause = drugs allergy cast - eosinophil casts Rx ,  ﬂuids, steroid, stop drug which causing it (Vignette from Dr. J notes, p93)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-AEA45E7A2AFB', 'What is the treatment for Methanol poisoning?', 'Fomepizole - IV, ⊖ Alcohol dehydrogenase', 'Thiosulfate, Hydroxocobalamin', 'Mild hypothermia, loopy/talking, Rx, Electrolytes, IV/oral ﬂuids', 'Muscle cramps, put in shade/cool place ﬂuids, electrolytes', 'A', 'Treatment for Methanol poisoning: Rx ,  fomepizole - IV ,  ⊖ Alcohol dehydrogenase (Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-AEA45E7A2AFB_V', 'A 25-year-old patient with Methanol poisoning presents with Sanitizer, (homemade alcohol). What is the best initial treatment?', 'Fomepizole - IV, ⊖ Alcohol dehydrogenase', 'Thiosulfate, Hydroxocobalamin', 'Mild hypothermia, loopy/talking, Rx, Electrolytes, IV/oral ﬂuids', 'Muscle cramps, put in shade/cool place ﬂuids, electrolytes', 'A', 'Treatment for Methanol poisoning: Rx ,  fomepizole - IV ,  ⊖ Alcohol dehydrogenase (Vignette from Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-AF82A3A61F0C', 'What is the classic presentation of D e n g u e ,  Vector ,  mosquito?', 'Fever, rash and dehydration', 'Black vomitus (due to blood), high fever and severe liver damage', 'Fever, dehydration, ﬂu like symp, rash', 'Fever myalgia, joint pain', 'A', 'Classic presentation of D e n g u e ,  Vector ,  mosquito: Fever, rash and dehydration. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-AF82A3A61F0C_V', 'A 8-year-old patient is brought to the ED with Fever, rash and dehydration.. The most likely diagnosis is:', 'Fever, rash and dehydration', 'Black vomitus (due to blood), high fever and severe liver damage', 'Fever, dehydration, ﬂu like symp, rash', 'Fever myalgia, joint pain', 'A', 'The presentation of Fever, rash and dehydration. is classic for D e n g u e ,  Vector ,  mosquito. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B091B5E2FED6', 'What is the treatment for Hereditary spherocytosis?', 'Severe, splenectomy', 'Mild, Rx, vasopressin, V1 on blood vessels, V2 in kidney (aquaporins)', 'Stop heparin factor 10, agartroban', 'Phlebotomy', 'A', 'Treatment for Hereditary spherocytosis: Severe ,  splenectomy (Dr. J notes, p112)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B091B5E2FED6_V', 'A 35-year-old patient with known Hereditary spherocytosis comes in with Fatigue cal bilirubin stones, sudden onset of anemia??. Which treatment is most appropriate?', 'Severe, splenectomy', 'Mild, Rx, vasopressin, V1 on blood vessels, V2 in kidney (aquaporins)', 'Stop heparin factor 10, agartroban', 'Phlebotomy', 'A', 'Treatment for Hereditary spherocytosis: Severe ,  splenectomy (Vignette from Dr. J notes, p112)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B12900DA6C9B', 'What is the treatment for Cataracts?', 'Replace lens, type 4 collagen in lens', 'Painless vision loss, unilateral ﬂoaters, sees half of you', 'No pain, when looks sideways', 'Steroids - ﬁnasteride', 'A', 'Treatment for Cataracts: Replace lens ,  type 4 collagen in lens (Dr. J notes, p7)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B12900DA6C9B_V', 'A 32-year-old patient with known Cataracts comes in with Difﬁculty at night.. Which treatment is most appropriate?', 'Replace lens, type 4 collagen in lens', 'Painless vision loss, unilateral ﬂoaters, sees half of you', 'No pain, when looks sideways', 'Steroids - ﬁnasteride', 'A', 'Treatment for Cataracts: Replace lens ,  type 4 collagen in lens (Vignette from Dr. J notes, p7)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B1719526A067', 'What is the treatment for Tinea pedis?', 'Topical azole', 'Oral Griseofulvin, oral ketoconazole, itraconazole, isosulfate', 'Oral terbinaﬁne', 'Painless vision loss, unilateral ﬂoaters, sees half of you', 'A', 'Treatment for Tinea pedis: Rx ,  topical azole (Dr. J notes, p3)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B1719526A067_V', 'A 45-year-old patient with Tinea pedis presents with On feet. What is the best initial treatment?', 'Topical azole', 'Oral Griseofulvin, oral ketoconazole, itraconazole, isosulfate', 'Oral terbinaﬁne', 'Painless vision loss, unilateral ﬂoaters, sees half of you', 'A', 'Treatment for Tinea pedis: Rx ,  topical azole (Vignette from Dr. J notes, p3)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B1D6F6D4D8B8', 'What is the classic presentation of Renal papillary necrosis?', 'Infection Toxin, medullary ?, damage to papillary Sickle cell disease, NSAID’s, papillary damage, Hematuria', 'B cells and neutrophils, gets sick quicker, High fever', 'Chronic back pain', 'Back pain - But X- ray normal', 'A', 'Classic presentation of Renal papillary necrosis: Infection Toxin ,  medullary ? ,  damage to papillary Sickle cell disease, NSAID’s, papillary damage, Hematuria, proteinuria, Flank pain (Dr. J notes, p94)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B1D6F6D4D8B8_V', 'A 42-year-old patient presents to the clinic with Infection Toxin ,  medullary ? ,  damage to papillary Sickle cell disease, NSAID’s, papillary damage, Hematuria, proteinur. Which of the following is the most likely diagnosis?', 'Infection Toxin, medullary ?, damage to papillary Sickle cell disease, NSAID’s, papillary damage, Hematuria', 'B cells and neutrophils, gets sick quicker, High fever', 'Chronic back pain', 'Back pain - But X- ray normal', 'A', 'The presentation of Infection Toxin ,  medullary ? ,  damage to papillary Sickle cell disease, NSAID’s, papillary damage, Hematuria, proteinur is classic for Renal papillary necrosis. (Dr. J notes, p94)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B30FF0A02148', 'What is the best diagnostic approach for Saltwater drowning?', 'Die of cardiac arrested x-ray - white out', 'EKG, J wave, Osler wave', 'Dx , EM - Negri body', 'EKG, X-RAY', 'A', 'Diagnosis of Saltwater drowning: Die of cardiac arrested x-ray - white out (Dr. J notes, p27)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B374F5797ECE', 'What is the mechanism of Latent autoimmune diabetes in adult?', '1 Antibody against to pancreas , > slow progressing autoimmune', 'Single gene point mutation', 'Autoimmune, sensitive blisters, break easily, painful', 'Insulin comes from β cells, inhibit by glucagon', 'A', 'Mechanism of Latent autoimmune diabetes in adult: 1 Antibody against to pancreas , > slow progressing autoimmune (Dr. J notes, p13)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B37FEB10E090', 'What is the mechanism of Rheumatology steps to decide1.) First?', 'How many joints involve mono = osteoarthritis, gout, septic arthritis Oligo (just couple joints) = spondylopathy', 'Triple VP mutation Bird peak, muscle wasting (diﬃculty releasing hand from handshake)', 'Inhibit insulin release release, pancreas', 'CPK - creatine phosphate kinase', 'A', 'Mechanism of Rheumatology steps to decide1.) First: How many joints involve mono = osteoarthritis, gout, septic arthritis Oligo (just couple joints) = spondylopathy (ankylosing) Poly (many joints all... (Dr. J notes, p20)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B3F32C8E501B', 'What is the treatment for Acetaminophen toxicity?', 'N- acetyl cysteine, disulﬁde bonds', 'Due P450 , > DH feb', 'Fomepizole, IV', 'Give with Ⓝ saline', 'A', 'Treatment for Acetaminophen toxicity: Rx ,  N- acetyl cysteine ,  disulﬁde bonds (Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B49F97309F64', 'What is the classic presentation of Delta waves?', 'Night terrors, sleep walking, teeth grinding increase intracraneal pressure, nausea, headache First sign', 'Tingling 1ˢᵗ 3 ﬁngers', 'Symptomatic, ataxia, spingomyelia, pain and temperature loss bilateral', 'Greasy appearancePt with headache, precocious puberty, bitemporal hemianopsia + loss of upper gaze, Pinealoma Stroke', 'A', 'Classic presentation of Delta waves: Night terrors, sleep walking, teeth grinding increase intracraneal pressure ,  nausea, headache First sign ,  Papillary edema & Sx ,  headache second ... (Dr. J notes, p141)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B49F97309F64_V', 'A 70-year-old patient is brought to the ED with Night terrors, sleep walking, teeth grinding increase intracraneal pressure ,  nausea, headache First sign ,  Papillary ed. The most likely diagnosis is:', 'Night terrors, sleep walking, teeth grinding increase intracraneal pressure, nausea, headache First sign', 'Tingling 1ˢᵗ 3 ﬁngers', 'Symptomatic, ataxia, spingomyelia, pain and temperature loss bilateral', 'Greasy appearancePt with headache, precocious puberty, bitemporal hemianopsia + loss of upper gaze, Pinealoma Stroke', 'A', 'The presentation of Night terrors, sleep walking, teeth grinding increase intracraneal pressure ,  nausea, headache First sign ,  Papillary ed is classic for Delta waves. (Dr. J notes, p141)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B4B961936176', 'What is the mechanism of Paroxysmal nocturnal hematuria,  Normocytic?', 'Hypoxic states, complement is activated', 'Point mutation of glutamic acid leading to valine', 'Tyrosine kinase?? B.I, LAP', 'Chronic PPI use - PPI inhibit parietal cell secretion which needs for B12 absorption', 'A', 'Mechanism of Paroxysmal nocturnal hematuria,  Normocytic: Hypoxic states ,  complement is activated (Dr. J notes, p113)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B4C9010D1B5D', 'What is the treatment for Atopic dermatitis?', 'Steroid, and Type 1 Hypersensitivity reaction', 'Extensive - oral steroids, more then 2 wks we need to, 3 ADRENAL INSUFFICIENCY', 'Topical selenium sulﬁde, ketoconazole', '𝝰 blockers then β blockers to avoid hypertensive crisis', 'A', 'Treatment for Atopic dermatitis: Rx steroid, and Type 1 Hypersensitivity reaction (Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B4C9010D1B5D_V', 'A 32-year-old patient with known Atopic dermatitis comes in with On ﬂexor surfaces, itchy,. Which treatment is most appropriate?', 'Steroid, and Type 1 Hypersensitivity reaction', 'Extensive - oral steroids, more then 2 wks we need to, 3 ADRENAL INSUFFICIENCY', 'Topical selenium sulﬁde, ketoconazole', '𝝰 blockers then β blockers to avoid hypertensive crisis', 'A', 'Treatment for Atopic dermatitis: Rx steroid, and Type 1 Hypersensitivity reaction (Vignette from Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B6660FF06276', 'What is the treatment for Clostridium Difﬁcle?', 'IV, metronidazole - blood prob Oral, Vanco, Fenoxamycin', 'O2, debridement, IV antibiotics', 'Baby from honey < 6-month-old', 'Bug, chlamydia trachomatis rx - azithro', 'A', 'Treatment for Clostridium Difﬁcle: IV ,  metronidazole - blood prob Oral ,  Vanco, Fenoxamycin (Dr. J notes, p44)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B6660FF06276_V', 'A 40-year-old patient with known Clostridium Difﬁcle comes in with Watery diarrhea. Which treatment is most appropriate?', 'IV, metronidazole - blood prob Oral, Vanco, Fenoxamycin', 'O2, debridement, IV antibiotics', 'Baby from honey < 6-month-old', 'Bug, chlamydia trachomatis rx - azithro', 'A', 'Treatment for Clostridium Difﬁcle: IV ,  metronidazole - blood prob Oral ,  Vanco, Fenoxamycin (Vignette from Dr. J notes, p44)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B68DB4F43104', 'What is the treatment for Streptococcus Pyogenes?', 'Dicloxacillin Impetigo, Honey crust lesions', 'Replace lens, type 4 collagen in lens', 'Purulent. Fluroqunilones and if not controlled, bacterial keratitis', 'Extensive - oral steroids, more then 2 wks we need to, 3 ADRENAL INSUFFICIENCY', 'A', 'Treatment for Streptococcus Pyogenes: Dicloxacillin = Cell wall synthesis2)Impetigo ,  Honey crust lesions (Dr. J notes, p3)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B68DB4F43104_V', 'A 22-year-old patient with Streptococcus Pyogenes presents with Rash moving towards heart. What is the best initial treatment?', 'Dicloxacillin Impetigo, Honey crust lesions', 'Replace lens, type 4 collagen in lens', 'Purulent. Fluroqunilones and if not controlled, bacterial keratitis', 'Extensive - oral steroids, more then 2 wks we need to, 3 ADRENAL INSUFFICIENCY', 'A', 'Treatment for Streptococcus Pyogenes: Dicloxacillin = Cell wall synthesis2)Impetigo ,  Honey crust lesions (Vignette from Dr. J notes, p3)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B7B94D12D190', 'What is the classic presentation of Rubella?', 'Fever, Periventricular lymphadenopathy', '3-4 days of fever sore throat, myalgia, ﬂu like', 'Com. Viral cause of diarrhea in kids', 'Vesicles in various stages of healing', 'A', 'Classic presentation of Rubella: Fever, Periventricular lymphadenopathy (Dr. J notes, p38)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B7B94D12D190_V', 'A 22-year-old patient is brought to the ED with Fever, Periventricular lymphadenopathy. The most likely diagnosis is:', 'Fever, Periventricular lymphadenopathy', '3-4 days of fever sore throat, myalgia, ﬂu like', 'Com. Viral cause of diarrhea in kids', 'Vesicles in various stages of healing', 'A', 'The presentation of Fever, Periventricular lymphadenopathy is classic for Rubella. (Dr. J notes, p38)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B7E034998538', 'What is the best diagnostic approach for Acne?', 'If female, pregnancy test and 2 forms of contraceptive', 'Biopsy, and local excision', 'KOH (best initial)', 'Insuline Polyuria, polydipsia leading to DM leading to water deprivation test leading to concentrated Psychogenic', 'A', 'Diagnosis of Acne: If female, pregnancy test and 2 forms of contraceptive (Dr. J notes, p6)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B7E034998538_V', 'A 45-year-old patient presents with Cheeks, neck back -. What is the most accurate diagnostic approach?', 'If female, pregnancy test and 2 forms of contraceptive', 'Biopsy, and local excision', 'KOH (best initial)', 'Insuline Polyuria, polydipsia leading to DM leading to water deprivation test leading to concentrated Psychogenic', 'A', 'Diagnosis of Acne: If female, pregnancy test and 2 forms of contraceptive (Vignette from Dr. J notes, p6)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B7EC9A2E3B5B', 'What is the best diagnostic approach for 55 yr?', 'Chest pain, got some meds, waiting for EKG suddenly lost pulse, low undulating line EKG, Ventricular ﬁbrillation Rx', 'Low mg lets Na come right in', 'No pain', 'S3 - systolic dysfunction - low EFBNP high -; diuresis, beta blocker', 'A', 'Diagnosis of 55 yr: Chest pain, ,  got some meds, waiting for EKG suddenly lost pulse ,  low undulating line EKG ,  Ventricular ﬁbrillation Rx ,  Unsync condioversion, che... (Dr. J notes, p120)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B7EC9A2E3B5B_V', 'A 72-year-old patient is evaluated for Chest pain, ,  got some meds, waiting for EKG suddenly lost pulse ,  low undulating line EKG ,  Ventricular ﬁbrillation Rx . Which diagnostic study should be ordered first?', 'Chest pain, got some meds, waiting for EKG suddenly lost pulse, low undulating line EKG, Ventricular ﬁbrillation Rx', 'Low mg lets Na come right in', 'No pain', 'S3 - systolic dysfunction - low EFBNP high -; diuresis, beta blocker', 'A', 'Diagnosis of 55 yr: Chest pain, ,  got some meds, waiting for EKG suddenly lost pulse ,  low undulating line EKG ,  Ventricular ﬁbrillation Rx ,  Unsync condioversion, che... (Vignette from Dr. J notes, p120)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B904150A84CA', 'What is the best diagnostic approach for Neurocysticercosis,  nausea vomiting?', 'CT - cyst in brain', 'Vomiting, neck stiffness, photophobia Dx - India ink', 'Wheezing, so best initial in chest Xray', 'We Can treat acute', 'A', 'Diagnosis of Neurocysticercosis,  nausea vomiting: CT - cyst in brain. (Dr. J notes, p40)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B904150A84CA_V', 'A 8-year-old patient is evaluated for Alt mental status, confusion. Which diagnostic study should be ordered first?', 'CT - cyst in brain', 'Vomiting, neck stiffness, photophobia Dx - India ink', 'Wheezing, so best initial in chest Xray', 'We Can treat acute', 'A', 'Diagnosis of Neurocysticercosis,  nausea vomiting: CT - cyst in brain. (Vignette from Dr. J notes, p40)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B9BF02C4D018', 'What is the classic presentation of HHV-8 (@HIV)?', 'Purple papules', 'Fever, myalgia, splenomegaly, lymphadenopathy', 'Roseola. Starts with fever, then rash is seen in 3 days', 'Cutaneous black lesions, spiking fever, anemia, hepatosplenomegaly', 'A', 'Classic presentation of HHV-8 (@HIV): Purple papules. (Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-B9BF02C4D018_V', 'A 5-year-old patient presents to the clinic with Purple papules.. Which of the following is the most likely diagnosis?', 'Purple papules', 'Fever, myalgia, splenomegaly, lymphadenopathy', 'Roseola. Starts with fever, then rash is seen in 3 days', 'Cutaneous black lesions, spiking fever, anemia, hepatosplenomegaly', 'A', 'The presentation of Purple papules. is classic for HHV-8 (@HIV). (Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BA5D5A486D34', 'What is the treatment for Type I diabetes?', 'Insulin , > MOA = works on adipose', 'If all the receptors are not working anymore due to lack of treatment, can end up in DKAdown ﬁnomina - GH', 'Thiazide, paradoxical effect, make more V₂ aquaporins', 'Topical salicylic acid', 'A', 'Treatment for Type I diabetes: Insulin , > MOA = works on adipose, (Dr. J notes, p12)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BA5D5A486D34_V', 'A 70-year-old patient with known Type I diabetes comes in with Ab against insulin release, pancreas islet cell - beta cell. Which treatment is most appropriate?', 'Insulin , > MOA = works on adipose', 'If all the receptors are not working anymore due to lack of treatment, can end up in DKAdown ﬁnomina - GH', 'Thiazide, paradoxical effect, make more V₂ aquaporins', 'Topical salicylic acid', 'A', 'Treatment for Type I diabetes: Insulin , > MOA = works on adipose, (Vignette from Dr. J notes, p12)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BAC85DD58A1A', 'What is the classic presentation of Actinic keratosis?', 'Red ﬂaky, non-tender, sun exposed area', 'Common in older, but if many appear in short period, rule out cancer', 'On ﬂexor surfaces, itchy', 'Itchy; treatment: antihistamines', 'A', 'Classic presentation of Actinic keratosis: Red ﬂaky, non-tender, sun exposed area. (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BAC85DD58A1A_V', 'A 22-year-old patient presents with Red ﬂaky, non-tender, sun exposed area.. What is the most likely diagnosis?', 'Red ﬂaky, non-tender, sun exposed area', 'Common in older, but if many appear in short period, rule out cancer', 'On ﬂexor surfaces, itchy', 'Itchy; treatment: antihistamines', 'A', 'The presentation of Red ﬂaky, non-tender, sun exposed area. is classic for Actinic keratosis. (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BAF59C95B339', 'What is the classic presentation of Paget disease (Osteitis deformans)?', '> 50yo, Back pain, hat not ﬁt, hearing problem Alk phosphate ↑, X-ray sclerotic lessions', 'Joint pain, Salmon color rash, Rheumatoid factor , ve', 'Pain and swelling, fever, warmness & redness in that area Most common bug - Steph Aureus, sickle cell - salmonella', 'Silvery rash Osteophytes', 'A', 'Classic presentation of Paget disease (Osteitis deformans): > 50yo, Back pain, hat not ﬁt, hearing problem Alk phosphate ↑, X-ray sclerotic lessions Rx = bisphosphanate - MOA - apoptosis of osteoclast (Dr. J notes, p22)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BAF59C95B339_V', 'A 55-year-old patient presents with > 50yo, Back pain, hat not ﬁt, hearing problem Alk phosphate ↑, X-ray sclerotic lessions Rx = bisphosphanate - MOA - apo. What is the most likely diagnosis?', '> 50yo, Back pain, hat not ﬁt, hearing problem Alk phosphate ↑, X-ray sclerotic lessions', 'Joint pain, Salmon color rash, Rheumatoid factor , ve', 'Pain and swelling, fever, warmness & redness in that area Most common bug - Steph Aureus, sickle cell - salmonella', 'Silvery rash Osteophytes', 'A', 'The presentation of > 50yo, Back pain, hat not ﬁt, hearing problem Alk phosphate ↑, X-ray sclerotic lessions Rx = bisphosphanate - MOA - apo is classic for Paget disease (Osteitis deformans). (Dr. J notes, p22)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BB680AFF97E1', 'What is the treatment for Amphetamine?', 'Antidepressant, lorazepam', 'Mild hypothermia, loopy/talking, Rx, Electrolytes, IV/oral ﬂuids', 'N- acetyl cysteine, disulﬁde bonds', 'Give Thiamine 1st than glucose', 'A', 'Treatment for Amphetamine: Antidepressant, lorazepam (Dr. J notes, p30)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BB680AFF97E1_V', 'A 50-year-old patient with known Amphetamine comes in with Agitation. Which treatment is most appropriate?', 'Antidepressant, lorazepam', 'Mild hypothermia, loopy/talking, Rx, Electrolytes, IV/oral ﬂuids', 'N- acetyl cysteine, disulﬁde bonds', 'Give Thiamine 1st than glucose', 'A', 'Treatment for Amphetamine: Antidepressant, lorazepam (Vignette from Dr. J notes, p30)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BB88F5F03886', 'What is the classic presentation of Mycobacterium aevum?', 'HIV, Sev Anemia, and persistent cough', 'Malaria, fever every 72hrs', 'Fatigue, shortness of breath, MCC of death', 'Flu like symptoms, RUQ pain, jaundice may be, travel history Then we run labs', 'A', 'Classic presentation of Mycobacterium aevum: HIV, Sev Anemia, and persistent cough. Recurrent infections (Dr. J notes, p38)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BB88F5F03886_V', 'A 8-year-old patient is brought to the ED with HIV, Sev Anemia, and persistent cough. Recurrent infections. The most likely diagnosis is:', 'HIV, Sev Anemia, and persistent cough', 'Malaria, fever every 72hrs', 'Fatigue, shortness of breath, MCC of death', 'Flu like symptoms, RUQ pain, jaundice may be, travel history Then we run labs', 'A', 'The presentation of HIV, Sev Anemia, and persistent cough. Recurrent infections is classic for Mycobacterium aevum. (Dr. J notes, p38)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BC442152F2CC', 'What is the classic presentation of HHV-4?', 'Fever, myalgia, splenomegaly, lymphadenopathy', 'Roseola. Starts with fever, then rash is seen in 3 days', 'Purple papules', 'Acyclovir, famciclovir - prevent future outbreaks Gabapentin (for pain) - emitriptiline Ganciclovir - CMV', 'A', 'Classic presentation of HHV-4: Fever, myalgia, splenomegaly, lymphadenopathy (Dr. J notes, p33)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BC442152F2CC_V', 'A 5-year-old patient presents to the clinic with Fever, myalgia, splenomegaly, lymphadenopathy. Which of the following is the most likely diagnosis?', 'Fever, myalgia, splenomegaly, lymphadenopathy', 'Roseola. Starts with fever, then rash is seen in 3 days', 'Purple papules', 'Acyclovir, famciclovir - prevent future outbreaks Gabapentin (for pain) - emitriptiline Ganciclovir - CMV', 'A', 'The presentation of Fever, myalgia, splenomegaly, lymphadenopathy is classic for HHV-4. (Dr. J notes, p33)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BCBF3C0D04E3', 'What is the treatment for Tinea versicolor (Malassezia fur-fur) Malassezia globosa?', 'Topical azoles, selenium sulﬁde', 'Oral Griseofulvin, oral ketoconazole, itraconazole, isosulfate', 'Oral terbinaﬁne', 'Thiazide, paradoxical effect, make more V₂ aquaporins', 'A', 'Treatment for Tinea versicolor (Malassezia fur-fur) Malassezia globosa: Rx ,  topical azoles, selenium sulﬁde (Dr. J notes, p3)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BCBF3C0D04E3_V', 'A 70-year-old patient is diagnosed with Tinea versicolor (Malassezia fur-fur) Malassezia globosa. The patient presents with Can occur anytime of the year. More in summer because mainly at where sweat is sitting.. What is the most appropriate treatment?', 'Topical azoles, selenium sulﬁde', 'Oral Griseofulvin, oral ketoconazole, itraconazole, isosulfate', 'Oral terbinaﬁne', 'Thiazide, paradoxical effect, make more V₂ aquaporins', 'A', 'Treatment for Tinea versicolor (Malassezia fur-fur) Malassezia globosa: Rx ,  topical azoles, selenium sulﬁde (Vignette from Dr. J notes, p3)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BCE48ACA5DFA', 'What is the treatment for SIADH?', 'Very slow infusion of hypertonic ﬂuid 3% normal saline, OSM ↑, ECF ↑, ICF↓ Lithium and demeclocyclin, to shut of ADH', 'Urine turns black Homogentisic acid def; take out phenylalanine and tyrosine', 'B symptoms ⨁,', 'Bone, cornea, scar tissue II', 'A', 'Treatment for SIADH: Rx ,  very slow infusion of hypertonic ﬂuid 3% normal saline ,  OSM ↑, ECF ↑, ICF↓ Lithium and demeclocyclin ,  to shut of ADH (Dr. J notes, p91)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BE0126302F16', 'What is the treatment for Bupropion?', 'Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures', 'First line', '≥ 5 symptoms, ≥2 weeks SIG E CAPSSleep ↑↓Interest ↓ = diﬃcult to treat Guilt Energy ↓Concentration ↓Appetite', 'Benzo (short acting), liver issues Benzo, long acting, if no liver damage', 'A', 'Treatment for Bupropion: Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures, smoking cessation Less A/E on weight gain & sexual eﬀect (Dr. J notes, p62)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BE0126302F16_V', 'A 22-year-old patient with Bupropion presents with Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures, smoking cessation Less A/E on weight gain & sexual eﬀec. What is the best initial treatment?', 'Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures', 'First line', '≥ 5 symptoms, ≥2 weeks SIG E CAPSSleep ↑↓Interest ↓ = diﬃcult to treat Guilt Energy ↓Concentration ↓Appetite', 'Benzo (short acting), liver issues Benzo, long acting, if no liver damage', 'A', 'Treatment for Bupropion: Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures, smoking cessation Less A/E on weight gain & sexual eﬀect (Vignette from Dr. J notes, p62)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BEC0CF596F87', 'What is the treatment for 1° heart block?', 'Prolonged PR ↑H.R, shortens PR, infracting AV node', 'S3 - systolic dysfunction - low EFBNP high -; diuresis, beta blocker', 'Low mg lets Na come right in', 'Chest pain, got some meds, waiting for EKG suddenly lost pulse, low undulating line EKG, Ventricular ﬁbrillation Rx', 'A', 'Treatment for 1° heart block: Prolonged PR ↑H.R, ,  shortens PR, ,  infracting AV node. Rx ,  exercise , atropine? (Dr. J notes, p119)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BEC0CF596F87_V', 'A 72-year-old patient is diagnosed with 1° heart block. The patient presents with Prolonged PR ↑H.R, ,  shortens PR, ,  infracting AV node. Rx ,  exercise , atropine?. What is the most appropriate treatment?', 'Prolonged PR ↑H.R, shortens PR, infracting AV node', 'S3 - systolic dysfunction - low EFBNP high -; diuresis, beta blocker', 'Low mg lets Na come right in', 'Chest pain, got some meds, waiting for EKG suddenly lost pulse, low undulating line EKG, Ventricular ﬁbrillation Rx', 'A', 'Treatment for 1° heart block: Prolonged PR ↑H.R, ,  shortens PR, ,  infracting AV node. Rx ,  exercise , atropine? (Vignette from Dr. J notes, p119)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BFA527F01FDA', 'What is the best diagnostic approach for Acromegaly?', 'Shoes not ﬁt, headaches, hearing problem, test - IGF ↑, conductive hearing loss, GH, rx - octriotide in kids, Gigantism', 'X-ray, erosion (inﬂammation)', '20-40yo, connective tissue problem Loss of wrinkles, tight skin, ﬁnger tip pitting BP = ↑↑, S₄, Esophagus', 'Mabs, we need to do PPD test ﬁrst it inhibit granulomas - CD20', 'A', 'Diagnosis of Acromegaly: Shoes not ﬁt, headaches, hearing problem, test - IGF ↑, conductive hearing loss, GH ,  rx - octriotide in kids ,  Gigantism ,  epiphyseal plates close... (Dr. J notes, p22)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-BFA527F01FDA_V', 'A 55-year-old patient is evaluated for Shoes not ﬁt, headaches, hearing problem, test - IGF ↑, conductive hearing loss, GH ,  rx - octriotide in kids ,  Gigantis. Which diagnostic study should be ordered first?', 'Shoes not ﬁt, headaches, hearing problem, test - IGF ↑, conductive hearing loss, GH, rx - octriotide in kids, Gigantism', 'X-ray, erosion (inﬂammation)', '20-40yo, connective tissue problem Loss of wrinkles, tight skin, ﬁnger tip pitting BP = ↑↑, S₄, Esophagus', 'Mabs, we need to do PPD test ﬁrst it inhibit granulomas - CD20', 'A', 'Diagnosis of Acromegaly: Shoes not ﬁt, headaches, hearing problem, test - IGF ↑, conductive hearing loss, GH ,  rx - octriotide in kids ,  Gigantism ,  epiphyseal plates close... (Vignette from Dr. J notes, p22)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C00A4856F1A3', 'What is the mechanism of HHV -5?', 'Ganciclovir, or foscarnet (no need of Thymidine kinase enzyme)', 'Enzyme, Thy', 'Circular, only hepatitis virus that is DNA virus and has Reverse transcriptase enzyme', 'Cidofovir, foscarnate, doesn’t require thymidine kinase', 'A', 'Mechanism of HHV -5: Ganciclovir, or foscarnet (no need of Thymidine kinase enzyme) (Dr. J notes, p33)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C0840275D18D', 'What is the mechanism of Hep B ,  DNA, DS, Envelope?', 'Circular, only hepatitis virus that is DNA virus and has Reverse transcriptase enzyme', 'Cidofovir, foscarnate, doesn’t require thymidine kinase', 'Enzyme, Thy', 'Cell receptor, ICAM', 'A', 'Mechanism of Hep B ,  DNA, DS, Envelope: Circular, only hepatitis virus that is DNA virus and has Reverse transcriptase enzyme. Bcoz all other hep virus r RNA. (Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C0A985B529AE', 'What is the classic presentation of Guttate psoriasis?', 'Scaly skin rash after infection', 'Auzpits sign, leison comes off and pin point bleeding', 'Red ﬂaky, non-tender, sun exposed area', 'Rash moving towards heart', 'A', 'Classic presentation of Guttate psoriasis: Scaly skin rash after infection. (Dr. J notes, p6)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C0A985B529AE_V', 'A 58-year-old patient presents with Scaly skin rash after infection.. What is the most likely diagnosis?', 'Scaly skin rash after infection', 'Auzpits sign, leison comes off and pin point bleeding', 'Red ﬂaky, non-tender, sun exposed area', 'Rash moving towards heart', 'A', 'The presentation of Scaly skin rash after infection. is classic for Guttate psoriasis. (Dr. J notes, p6)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C114E22238F1', 'What is the treatment for Herpes zoster?', 'Acyclovir, Gabapentin, amitryptaline', 'Topical permethrin or oral ivermectin (Single dose - fat sol, easier to be toxic)', 'Topical azole', 'Steroids, IVIg', 'A', 'Treatment for Herpes zoster: Rx acyclovir, Gabapentin, amitryptaline, (Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C117F5BC3AD9', 'What is the mechanism of MEN-2A?', '2P , > RET Gene mutation', '1P , > Medullary thyroid carcinoma [RET Gene]', '↓ Glucagon release , GLP-1 agonist', 'Tyrosine kinase', 'A', 'Mechanism of MEN-2A: 2P , > RET Gene mutation (Dr. J notes, p14)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C1F8329DEA56', 'What is the treatment for Ulcerative colitis , Young 20s?', 'Pathophys, autoimmune', 'ERCP = bedding', 'PPIs for life', 'Infected by = Hip implant, valve replace, IV catheters', 'A', 'Treatment for Ulcerative colitis , Young 20s: Pathophys ,  autoimmune Rx - cholesteramine (Dr. J notes, p56)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C1F8329DEA56_V', 'A 65-year-old patient is diagnosed with Ulcerative colitis , Young 20s. The patient presents with Bloody diarrhea, abd pain, No vit def, erythema nodosum,. What is the most appropriate treatment?', 'Pathophys, autoimmune', 'ERCP = bedding', 'PPIs for life', 'Infected by = Hip implant, valve replace, IV catheters', 'A', 'Treatment for Ulcerative colitis , Young 20s: Pathophys ,  autoimmune Rx - cholesteramine (Vignette from Dr. J notes, p56)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C2672E22CBDE', 'What is the treatment for L o a L o a?', 'Ivermectin', 'Supportive/self-limiting, Vaccine', 'Interferon and Tenofovir', 'Acyclovir, famciclovir, for future outbreak', 'A', 'Treatment for L o a L o a: Rx Ivermectin (Dr. J notes, p40)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C282C51043DC', 'What is the classic presentation of Strep. Pneumoniae?', 'Capsule - typical, fast onset', 'Sub acute bac endocarditis regorge murmur - mitral valve', 'After being in farms with goats, Q fever = Coxiella Brunetti', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', 'A', 'Classic presentation of Strep. Pneumoniae: Capsule - typical, fast onset (Dr. J notes, p43)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C282C51043DC_V', 'A 65-year-old patient presents with Capsule - typical, fast onset. What is the most likely diagnosis?', 'Capsule - typical, fast onset', 'Sub acute bac endocarditis regorge murmur - mitral valve', 'After being in farms with goats, Q fever = Coxiella Brunetti', '3 toxins Exfoliating exotoxin - Scalded skin syndrome, palms and soles rash', 'A', 'The presentation of Capsule - typical, fast onset is classic for Strep. Pneumoniae. (Dr. J notes, p43)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C3703466B26D', 'What is the treatment for For both art and venous ,  tPA (thrombolytics)?', 'Urokinase, when open ﬁstula, tubes', 'Heparin and warfarin', 'Iron + vit C', 'Aspirin, dicloccicillin, clopidogrel', 'A', 'Treatment for For both art and venous ,  tPA (thrombolytics): Urokinase ,  when open ﬁstula, tubes. not give streptokinase when on antibiotics. (Dr. J notes, p107)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C3D7633472FF', 'What is the treatment for H e p C?', 'Valpatsavir', 'Supportive/self-limiting, Vaccine', 'Interferon and Tenofovir', 'HART therapy', 'A', 'Treatment for H e p C: Valpatsavir. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C3D7633472FF_V', 'A 22-year-old patient with H e p C presents with Sexual, contact.. What is the best initial treatment?', 'Valpatsavir', 'Supportive/self-limiting, Vaccine', 'Interferon and Tenofovir', 'HART therapy', 'A', 'Treatment for H e p C: Valpatsavir. (Vignette from Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C58AF7ACBF14', 'What is the mechanism of SSNRIs?', 'Inhibit 5-HT & NE re-uptake', '2ⁿᵈ leading to Akathisia = restless, reversible', 'Before 18, vocal tics > 1year', 'Tardive dyskinesia leading to frog tongue like movements', 'A', 'Mechanism of SSNRIs: Inhibit 5-HT & NE re-uptake. A/e anticholinergic. Close to TCAs because less ach aﬀect. (Dr. J notes, p62)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C5C99E698A20', 'What is the best diagnostic approach for Bullous pemphigoid?', 'Biopsy and', 'Full thickness biopsy', 'If female, pregnancy test and 2 forms of contraceptive', 'Non healing ulcer, ﬂaky red in lower part of face, biopsy', 'A', 'Diagnosis of Bullous pemphigoid: Biopsy and (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C606983C60AA', 'What is the treatment for Clostridium perferingenes?', 'O2, debridement, IV antibiotics', 'IV, metronidazole - blood prob Oral, Vanco, Fenoxamycin', 'Baby from honey < 6-month-old', 'Gabapentin TCA', 'A', 'Treatment for Clostridium perferingenes: O2, debridement, IV antibiotics (Dr. J notes, p44)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C606983C60AA_V', 'A 40-year-old patient with known Clostridium perferingenes comes in with Alpha toxin. Which treatment is most appropriate?', 'O2, debridement, IV antibiotics', 'IV, metronidazole - blood prob Oral, Vanco, Fenoxamycin', 'Baby from honey < 6-month-old', 'Gabapentin TCA', 'A', 'Treatment for Clostridium perferingenes: O2, debridement, IV antibiotics (Vignette from Dr. J notes, p44)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C78FBB57D431', 'What is the classic presentation of HSV-3?', 'Vesicles in various stages of healing', 'Acyclovir, famciclovir - prevent future outbreaks Gabapentin (for pain) - emitriptiline Ganciclovir - CMV', 'Roseola. Starts with fever, then rash is seen in 3 days', 'Jaundice, abd', 'A', 'Classic presentation of HSV-3: Vesicles in various stages of healing. Itchy rash (Dr. J notes, p33)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C78FBB57D431_V', 'A 5-year-old patient presents to the clinic with Vesicles in various stages of healing. Itchy rash. Which of the following is the most likely diagnosis?', 'Vesicles in various stages of healing', 'Acyclovir, famciclovir - prevent future outbreaks Gabapentin (for pain) - emitriptiline Ganciclovir - CMV', 'Roseola. Starts with fever, then rash is seen in 3 days', 'Jaundice, abd', 'A', 'The presentation of Vesicles in various stages of healing. Itchy rash is classic for HSV-3. (Dr. J notes, p33)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C79A85DCE2DC', 'What is the classic presentation of Osteomyelities?', 'Pain and swelling, fever, warmness & redness in that area Most common bug - Steph Aureus, sickle cell - salmonella', 'Pain pronate, ﬂex wrist, pain elbow = medial epicondyle - golfer’s elbow', 'Tingling 1ˢᵗ 3 ﬁngers', 'Pain, tenderness base of both thumbs = quad tender servitis (sinusitis)', 'A', 'Classic presentation of Osteomyelities: Pain and swelling, fever, warmness & redness in that area Most common bug - Steph Aureus, sickle cell - salmonella, iv drug - pseudomonas (Dr. J notes, p22)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C79A85DCE2DC_V', 'A 55-year-old patient is brought to the ED with Pain and swelling, fever, warmness & redness in that area Most common bug - Steph Aureus, sickle cell - salmonella, iv d. The most likely diagnosis is:', 'Pain and swelling, fever, warmness & redness in that area Most common bug - Steph Aureus, sickle cell - salmonella', 'Pain pronate, ﬂex wrist, pain elbow = medial epicondyle - golfer’s elbow', 'Tingling 1ˢᵗ 3 ﬁngers', 'Pain, tenderness base of both thumbs = quad tender servitis (sinusitis)', 'A', 'The presentation of Pain and swelling, fever, warmness & redness in that area Most common bug - Steph Aureus, sickle cell - salmonella, iv d is classic for Osteomyelities. (Dr. J notes, p22)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C7DBB94F0AF1', 'What is the best diagnostic approach for Actinic keratosis?', 'Biopsy, and local excision', 'Slit lamp test', 'If female, pregnancy test and 2 forms of contraceptive', 'Full thickness biopsy', 'A', 'Diagnosis of Actinic keratosis: Biopsy, and local excision. 5-FU. (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C7DBB94F0AF1_V', 'A 32-year-old patient presents with Red ﬂaky, non-tender, sun exposed area.. What is the best initial diagnostic test?', 'Biopsy, and local excision', 'Slit lamp test', 'If female, pregnancy test and 2 forms of contraceptive', 'Full thickness biopsy', 'A', 'Diagnosis of Actinic keratosis: Biopsy, and local excision. 5-FU. (Vignette from Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C836F3485E4D', 'What is the treatment for benzodiaze → overdose?', 'Repsiratory & cardiac supration', 'Constipation, pin point pupils, slow speech, impaired memory', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'First line', 'A', 'Treatment for benzodiaze → overdose: Repsiratory & cardiac supration. Rx = ﬂumazenil Withdrawal = seizures, tremors, arrhythmia, anxiety, depression (Dr. J notes, p60)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C836F3485E4D_V', 'A 22-year-old patient with known benzodiaze → overdose comes in with Repsiratory & cardiac supration. Rx = ﬂumazenil Withdrawal = seizures, tremors, arrhythmia, anxiety, depression. Which treatment is most appropriate?', 'Repsiratory & cardiac supration', 'Constipation, pin point pupils, slow speech, impaired memory', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'First line', 'A', 'Treatment for benzodiaze → overdose: Repsiratory & cardiac supration. Rx = ﬂumazenil Withdrawal = seizures, tremors, arrhythmia, anxiety, depression (Vignette from Dr. J notes, p60)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C864DFD83210', 'What is the treatment for Alkaptonuria?', 'Urine turns black Homogentisic acid def; take out phenylalanine and tyrosine', 'Furosemide, strong vasodilator', 'Hematuria, allergy like sx cause = drugs allergy cast - eosinophil casts Rx, ﬂuids, steroid, stop drug which causing it', 'Muddy brown, granular #1 Cause = blood loss', 'A', 'Treatment for Alkaptonuria: Urine turns black Homogentisic acid def. Rx - take out phenylalanine and tyrosine. So that pathway dont start. (Dr. J notes, p99)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C864DFD83210_V', 'A 42-year-old patient is diagnosed with Alkaptonuria. The patient presents with Urine turns black Homogentisic acid def. Rx - take out phenylalanine and tyrosine. So that pathway dont start.. What is the most appropriate treatment?', 'Urine turns black Homogentisic acid def; take out phenylalanine and tyrosine', 'Furosemide, strong vasodilator', 'Hematuria, allergy like sx cause = drugs allergy cast - eosinophil casts Rx, ﬂuids, steroid, stop drug which causing it', 'Muddy brown, granular #1 Cause = blood loss', 'A', 'Treatment for Alkaptonuria: Urine turns black Homogentisic acid def. Rx - take out phenylalanine and tyrosine. So that pathway dont start. (Vignette from Dr. J notes, p99)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C97C54B90C7E', 'What is the classic presentation of Hep B (DNA)?', 'Jaundice, abd', 'Flu like symptoms, RUQ pain, jaundice may be, travel history Then we run labs', 'Acyclovir, famciclovir - prevent future outbreaks Gabapentin (for pain) - emitriptiline Ganciclovir - CMV', 'Watery diarrhea from fresh water', 'A', 'Classic presentation of Hep B (DNA): Jaundice, abd. Pain, fever (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-C97C54B90C7E_V', 'A 22-year-old patient presents with Jaundice, abd. Pain, fever. What is the most likely diagnosis?', 'Jaundice, abd', 'Flu like symptoms, RUQ pain, jaundice may be, travel history Then we run labs', 'Acyclovir, famciclovir - prevent future outbreaks Gabapentin (for pain) - emitriptiline Ganciclovir - CMV', 'Watery diarrhea from fresh water', 'A', 'The presentation of Jaundice, abd. Pain, fever is classic for Hep B (DNA). (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-CA1918498F17', 'What is a key risk factor or cause of Rota virus?', '#1 diarrheal cause in kids, can be serious in babies', 'Most likely cause cancer', 'Avoid contact sports, due to splenomegaly (risk of rupture)', 'Less likely to cause cancer, replicated in cytoplasm', 'A', 'Risk factor for Rota virus: #1 diarrheal cause in kids. ,  can be serious in babies. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-CA2F07B91BDF', 'What is the classic presentation of Zenker diverticulum?', 'Diarrhea, metabolic acidosis, DKA, RTA, 2', 'Heart block, S3, Fever, HR no change', 'Legionella, gastroenteritis, Decreases Na+, of diarrhea', 'Baby + at birth, jaundice', 'A', 'Classic presentation of Zenker diverticulum: Diarrhea ,  metabolic acidosis ,  DKA, RTA ,  2 (Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-CA2F07B91BDF_V', 'A 40-year-old patient is brought to the ED with Diarrhea ,  metabolic acidosis ,  DKA, RTA ,  2. The most likely diagnosis is:', 'Diarrhea, metabolic acidosis, DKA, RTA, 2', 'Heart block, S3, Fever, HR no change', 'Legionella, gastroenteritis, Decreases Na+, of diarrhea', 'Baby + at birth, jaundice', 'A', 'The presentation of Diarrhea ,  metabolic acidosis ,  DKA, RTA ,  2 is classic for Zenker diverticulum. (Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-CB9E89AFE3C3', 'What is the treatment for TTP?', 'Steroids, plasmapheresis', 'Gastric by pass vit needs to give in order = B1, B12 and B9', 'Plasmapheresis to get rid of ab., corticosteroid', 'Severe, splenectomy', 'A', 'Treatment for TTP: Steroids, plasmapheresis (Dr. J notes, p108)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-CB9E89AFE3C3_V', 'A 60-year-old patient is diagnosed with TTP. The patient presents with Seizures, fever, renal issues. ↑BT. What is the most appropriate treatment?', 'Steroids, plasmapheresis', 'Gastric by pass vit needs to give in order = B1, B12 and B9', 'Plasmapheresis to get rid of ab., corticosteroid', 'Severe, splenectomy', 'A', 'Treatment for TTP: Steroids, plasmapheresis (Vignette from Dr. J notes, p108)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-CBA183977138', 'What is the best diagnostic approach for MMR?', 'Wheezing, so best initial in chest Xray', 'Mono spot test will be negative', 'PCR of CSF on DNA', 'Smear, spindle cells', 'A', 'Diagnosis of MMR: Wheezing ,  so best initial in chest Xray ,  because wheezing is intrathoracic. (Dr. J notes, p39)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-CC1C59C82FE5', 'What is the best diagnostic approach for Viruses ,  set immune system ,  take time?', 'Protein level = normal to low', 'Biopsy test = reed Stemberg cells', 'Roulette forms, blood smear', 'Lab, hypoglycemia, hypocalcemia', 'A', 'Diagnosis of Viruses ,  set immune system ,  take time: Protein level = normal to low (Dr. J notes, p83)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-CC3B603019EC', 'What is a key risk factor or cause of Biliary colic not Rx?', 'By Cholecystitis', 'UTIs, Pyelonephritis, cystitis', 'If in baby, non migration of Auerbach plex, congenital', 'Mostly cause, meningitis, otitis media, pneumonia, sinusitis, bronchitis, IgA protease', 'A', 'Risk factor for Biliary colic not Rx: Cause by Cholecystitis (Dr. J notes, p54)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-CE9027404FC5', 'What is the classic presentation of Acute pancreatitis?', 'Severe abdominal pain radiating to the back, vomiting', 'Itching, fatigue', 'Legionella, gastroenteritis, Decreases Na+, of diarrhea', 'Capsule - typical, fast onset', 'A', 'Classic presentation of Acute pancreatitis: Severe abdominal pain radiating to the back, vomiting (Dr. J notes, p56)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-CE9027404FC5_V', 'A 28-year-old patient presents with Severe abdominal pain radiating to the back, vomiting. What is the most likely diagnosis?', 'Severe abdominal pain radiating to the back, vomiting', 'Itching, fatigue', 'Legionella, gastroenteritis, Decreases Na+, of diarrhea', 'Capsule - typical, fast onset', 'A', 'The presentation of Severe abdominal pain radiating to the back, vomiting is classic for Acute pancreatitis. (Dr. J notes, p56)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-CF0681F2A59D', 'What is the best diagnostic approach for Herpes encephalitis?', 'PCR of CSF on DNA', 'Test - Tzank test', 'Neck stiffness, photophobia, altered mental status', 'Vomiting, neck stiffness, photophobia Dx - India ink', 'A', 'Diagnosis of Herpes encephalitis: PCR of CSF on DNA (Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-CF0681F2A59D_V', 'A 5-year-old patient presents with Confusion, neck stiffness, photophobia, olfactory hallucinations.. What is the best initial diagnostic test?', 'PCR of CSF on DNA', 'Test - Tzank test', 'Neck stiffness, photophobia, altered mental status', 'Vomiting, neck stiffness, photophobia Dx - India ink', 'A', 'Diagnosis of Herpes encephalitis: PCR of CSF on DNA (Vignette from Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-CF8B3A5D9289', 'What is the classic presentation of Meth hemoglobin?', 'Chest pain, aspirin, shortness of breath', 'Prox tachycardia, nausea, vomiting', 'Tachycardia, nausea, vomiting', 'Fever , nausea severe ﬂu like symptoms', 'A', 'Classic presentation of Meth hemoglobin: Chest pain, aspirin, shortness of breath (Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-CF8B3A5D9289_V', 'A 25-year-old patient presents to the clinic with Chest pain, aspirin, shortness of breath. Which of the following is the most likely diagnosis?', 'Chest pain, aspirin, shortness of breath', 'Prox tachycardia, nausea, vomiting', 'Tachycardia, nausea, vomiting', 'Fever , nausea severe ﬂu like symptoms', 'A', 'The presentation of Chest pain, aspirin, shortness of breath is classic for Meth hemoglobin. (Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-CF94950FB112', 'What is the best diagnostic approach for Scleroderma?', '20-40yo, connective tissue problem Loss of wrinkles, tight skin, ﬁnger tip pitting BP = ↑↑, S₄, Esophagus', 'Sensitive test = ANA - anti nuclear antibody', 'Mabs, we need to do PPD test ﬁrst it inhibit granulomas - CD20', '30yo, Back pain mostly in the morning X-ray, vertebrae fuse to gather, bamboos', 'A', 'Diagnosis of Scleroderma: 20-40yo, connective tissue problem Loss of wrinkles, tight skin, ﬁnger tip pitting BP = ↑↑, S₄, Esophagus ,  chronic GERD Manometry ,  ↓peristalsis T... (Dr. J notes, p20)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-CF94950FB112_V', 'A 40-year-old patient presents with 20-40yo, connective tissue problem Loss of wrinkles, tight skin, ﬁnger tip pitting BP = ↑↑, S₄, Esophagus ,  chronic GERD. What is the best initial diagnostic test?', '20-40yo, connective tissue problem Loss of wrinkles, tight skin, ﬁnger tip pitting BP = ↑↑, S₄, Esophagus', 'Sensitive test = ANA - anti nuclear antibody', 'Mabs, we need to do PPD test ﬁrst it inhibit granulomas - CD20', '30yo, Back pain mostly in the morning X-ray, vertebrae fuse to gather, bamboos', 'A', 'Diagnosis of Scleroderma: 20-40yo, connective tissue problem Loss of wrinkles, tight skin, ﬁnger tip pitting BP = ↑↑, S₄, Esophagus ,  chronic GERD Manometry ,  ↓peristalsis T... (Vignette from Dr. J notes, p20)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D0868F1130A7', 'What is the best diagnostic approach for HSV-2?', 'Tzank test - Eosinophilic intranuclear inclusions', 'Test - Tzank test', 'Neck stiffness, photophobia, altered mental status', 'We Can treat acute', 'A', 'Diagnosis of HSV-2: Tzank test - Eosinophilic intranuclear inclusions (Dr. J notes, p32)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D0868F1130A7_V', 'A 5-year-old patient is evaluated for Painful. Which diagnostic study should be ordered first?', 'Tzank test - Eosinophilic intranuclear inclusions', 'Test - Tzank test', 'Neck stiffness, photophobia, altered mental status', 'We Can treat acute', 'A', 'Diagnosis of HSV-2: Tzank test - Eosinophilic intranuclear inclusions (Vignette from Dr. J notes, p32)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D0C584B4E25F', 'What is the best diagnostic approach for Hairy cell leukemia?', 'TRAP positive', 'B.I, biopsy, reed stern berg cells', 'Auer rods in smear', 'Most accurate test, B12 level or we check for homocysteine and methylmalonic acid', 'A', 'Diagnosis of Hairy cell leukemia: TRAP positive (Dr. J notes, p114)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D0C584B4E25F_V', 'A 70-year-old patient is evaluated for Fatigue anemia, various types of inf.. Which diagnostic study should be ordered first?', 'TRAP positive', 'B.I, biopsy, reed stern berg cells', 'Auer rods in smear', 'Most accurate test, B12 level or we check for homocysteine and methylmalonic acid', 'A', 'Diagnosis of Hairy cell leukemia: TRAP positive (Vignette from Dr. J notes, p114)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D126322FE1A6', 'What is the classic presentation of 55 yrs old, @E.R?', 'With chest pain, palpitation, tachycardia, Wide QRS Ventricular arrhythmia/ V', 'Funny feeling No P waves, EKG Decrease in PH , No pain, risk embolism in A. Fib', 'No pain', 'Low mg lets Na come right in', 'A', 'Classic presentation of 55 yrs old, @E.R: With chest pain, palpitation, tachycardia, ,  Wide QRS Ventricular arrhythmia/ V. Tach (Dr. J notes, p120)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D126322FE1A6_V', 'A 45-year-old patient presents to the clinic with With chest pain, palpitation, tachycardia, ,  Wide QRS Ventricular arrhythmia/ V. Tach. Which of the following is the most likely diagnosis?', 'With chest pain, palpitation, tachycardia, Wide QRS Ventricular arrhythmia/ V', 'Funny feeling No P waves, EKG Decrease in PH , No pain, risk embolism in A. Fib', 'No pain', 'Low mg lets Na come right in', 'A', 'The presentation of With chest pain, palpitation, tachycardia, ,  Wide QRS Ventricular arrhythmia/ V. Tach is classic for 55 yrs old, @E.R. (Dr. J notes, p120)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D1812ADC27BC', 'What is the treatment for 1° Adrenal Insufﬁciency in children?', 'Defect in adrenal steroid biosynthesis', 'Crohn syndrome, Total Na⁺↑ Serum Na⁺↑ K⁺↓, pH ↑ (alkalic), BP↑, renin↓, Rx, spironolactone, blocks aldosteron', '> surgical remove (Thyroidectomy )', 'Replace lens, type 4 collagen in lens', 'A', 'Treatment for 1° Adrenal Insufﬁciency in children: Defect in adrenal steroid biosynthesis (Dr. J notes, p14)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D1F0F7F4FFDC', 'What is the classic presentation of 𝛂 thalassemia?', 'Type 4, hydrops fetalis (edema of fetus), not compatible with life', 'Fatigue anemia, various types of inf', 'Hematuria, rash, joint pain', 'Fatigue, pale, chest pain, shortness of breath', 'A', 'Classic presentation of 𝛂 thalassemia: Type 4 ,  hydrops fetalis (edema of fetus) ,  not compatible with life (Dr. J notes, p110)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D1F0F7F4FFDC_V', 'A 45-year-old patient presents to the clinic with Type 4 ,  hydrops fetalis (edema of fetus) ,  not compatible with life. Which of the following is the most likely diagnosis?', 'Type 4, hydrops fetalis (edema of fetus), not compatible with life', 'Fatigue anemia, various types of inf', 'Hematuria, rash, joint pain', 'Fatigue, pale, chest pain, shortness of breath', 'A', 'The presentation of Type 4 ,  hydrops fetalis (edema of fetus) ,  not compatible with life is classic for 𝛂 thalassemia. (Dr. J notes, p110)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D2850E86F183', 'What is the treatment for Curve rod?', 'Quadruple therapy, PPI + TCA + Metro +Bismut (give not to)', 'Dicloxacillin Impetigo, Honey crust lesions', 'Isotonic ﬂuid, due to ↓vol', '? CAP, Clarithromycin, amoxicillin, PPI', 'A', 'Treatment for Curve rod: Quadruple therapy ,  PPI + TCA + Metro +Bismut (give not to) (Dr. J notes, p47)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D2850E86F183_V', 'A 28-year-old patient with known Curve rod comes in with Urease +ve ,  H. Pylori. Which treatment is most appropriate?', 'Quadruple therapy, PPI + TCA + Metro +Bismut (give not to)', 'Dicloxacillin Impetigo, Honey crust lesions', 'Isotonic ﬂuid, due to ↓vol', '? CAP, Clarithromycin, amoxicillin, PPI', 'A', 'Treatment for Curve rod: Quadruple therapy ,  PPI + TCA + Metro +Bismut (give not to) (Vignette from Dr. J notes, p47)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D2F7D647638B', 'What is the classic presentation of DNR?', 'Intubation, Sign by, pt & physician', 'Menopausal symptoms Menses stops, hot ﬂashes no hirsutism, no acne. What lab elevated ﬁrst, high FSH', 'Euphoria, not focus, impaired judgment, mood, swings, perinatal rash', 'FLash backs for >1 month', 'A', 'Classic presentation of DNR: Intubation, Sign by ,  pt & physician (Dr. J notes, p65)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D2F7D647638B_V', 'A 35-year-old patient presents to the clinic with Intubation, Sign by ,  pt & physician. Which of the following is the most likely diagnosis?', 'Intubation, Sign by, pt & physician', 'Menopausal symptoms Menses stops, hot ﬂashes no hirsutism, no acne. What lab elevated ﬁrst, high FSH', 'Euphoria, not focus, impaired judgment, mood, swings, perinatal rash', 'FLash backs for >1 month', 'A', 'The presentation of Intubation, Sign by ,  pt & physician is classic for DNR. (Dr. J notes, p65)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D35BA9A8C43B', 'What is the treatment for Schistosoma haematobium?', 'Praziquantel', 'Tx - fecal oral', 'Metronidazole', 'Acyclovir, famciclovir, for future outbreak', 'A', 'Treatment for Schistosoma haematobium: Rx praziquantel (Dr. J notes, p40)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D35BA9A8C43B_V', 'A 8-year-old patient with known Schistosoma haematobium comes in with Bladder cancer.. Which treatment is most appropriate?', 'Praziquantel', 'Tx - fecal oral', 'Metronidazole', 'Acyclovir, famciclovir, for future outbreak', 'A', 'Treatment for Schistosoma haematobium: Rx praziquantel (Vignette from Dr. J notes, p40)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D3938FB47545', 'What is the treatment for Pasteurella?', 'Wash, clean, amoxycillin, clavulanate', 'Macrolide = 50s', 'Surgical debridement', 'Liver transplant', 'A', 'Treatment for Pasteurella: Wash, clean, amoxycillin, clavulanate (Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D3938FB47545_V', 'A 3-year-old patient is diagnosed with Pasteurella. The patient presents with Dog - cat bites. What is the most appropriate treatment?', 'Wash, clean, amoxycillin, clavulanate', 'Macrolide = 50s', 'Surgical debridement', 'Liver transplant', 'A', 'Treatment for Pasteurella: Wash, clean, amoxycillin, clavulanate (Vignette from Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D42A6DFAC8E2', 'What is the treatment for Esophageal varices ,  Palmar erythema?', 'To ↓portal hypertension, Octreotide and antibiotics, due to low immunity', 'Ca blockers', 'Dx, Epiglottitis, Thumb sign,; Intubate and vaccine Not vaccinated, H', 'Macrolide = 50s', 'A', 'Treatment for Esophageal varices ,  Palmar erythema: Rx to ↓portal hypertension ,  Octreotide and antibiotics ,  due to low immunity because liver not making protein to help immune sys. ↑TBG (Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D47A5856C16D', 'What is the treatment for Coxsackie A?', 'Cannot treat or prevent it', 'Supportive', 'Acyclovir - needs thymidylate kinase', 'Mephloquine', 'A', 'Treatment for Coxsackie A: Cannot treat or prevent it. (Dr. J notes, p36)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D4A1D2CA7201', 'What is the treatment for Atypical antipsychotic → most sedating?', 'Quetiapine Greatest affect on = Ziprasidone, QT prolong Weight gain (glucose intolerant) = Olanzapine List a/e =', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'Thioridazine, chlorpromazine Not give to old pt', 'Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures', 'A', 'Treatment for Atypical antipsychotic → most sedating: Quetiapine Greatest affect on = Ziprasidone ,  QT prolong Weight gain (glucose intolerant) = Olanzapine List a/e = Aripiprazole - D₂ partial against... (Dr. J notes, p61)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D4A1D2CA7201_V', 'A 50-year-old patient with Atypical antipsychotic → most sedating presents with Quetiapine Greatest affect on = Ziprasidone ,  QT prolong Weight gain (glucose intolerant) = Olanzapine List a/e = Aripip. What is the best initial treatment?', 'Quetiapine Greatest affect on = Ziprasidone, QT prolong Weight gain (glucose intolerant) = Olanzapine List a/e =', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'Thioridazine, chlorpromazine Not give to old pt', 'Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures', 'A', 'Treatment for Atypical antipsychotic → most sedating: Quetiapine Greatest affect on = Ziprasidone ,  QT prolong Weight gain (glucose intolerant) = Olanzapine List a/e = Aripiprazole - D₂ partial against... (Vignette from Dr. J notes, p61)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D555201B4F2A', 'What is the classic presentation of Streptococcus Pyogenes?', 'Rash moving towards heart', 'Red ﬂaky, non-tender, sun exposed area', '2nd mes, cAMP', 'Positive nikalosky sign', 'A', 'Classic presentation of Streptococcus Pyogenes: Rash moving towards heart (Dr. J notes, p3)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D555201B4F2A_V', 'A 32-year-old patient presents with Rash moving towards heart. What is the most likely diagnosis?', 'Rash moving towards heart', 'Red ﬂaky, non-tender, sun exposed area', '2nd mes, cAMP', 'Positive nikalosky sign', 'A', 'The presentation of Rash moving towards heart is classic for Streptococcus Pyogenes. (Dr. J notes, p3)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D593548EE14F', 'What is the classic presentation of Graft vs host ,  B cells?', 'Oliguria, high fever, BUN and cr high, transplanted tissue is slightly mottled', 'Oliguria, slight fever, transplanted tissue is grossly mottled', 'Older pt. with chronic back pain, rule out MM', 'Fatigue anemia, various types of inf', 'A', 'Classic presentation of Graft vs host ,  B cells: Oliguria, high fever, BUN and cr high ,  transplanted tissue is slightly mottled (Dr. J notes, p115)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D593548EE14F_V', 'A 35-year-old patient presents with Oliguria, high fever, BUN and cr high ,  transplanted tissue is slightly mottled. What is the most likely diagnosis?', 'Oliguria, high fever, BUN and cr high, transplanted tissue is slightly mottled', 'Oliguria, slight fever, transplanted tissue is grossly mottled', 'Older pt. with chronic back pain, rule out MM', 'Fatigue anemia, various types of inf', 'A', 'The presentation of Oliguria, high fever, BUN and cr high ,  transplanted tissue is slightly mottled is classic for Graft vs host ,  B cells. (Dr. J notes, p115)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D675AFECA536', 'What is the classic presentation of Biliary colic not Rx?', '↑↑↑ pain when breathe / palpation', 'Even wind blow, pain', 'Itching, fatigue', 'Due to sphincter being weak', 'A', 'Classic presentation of Biliary colic not Rx: ↑↑↑ pain when breathe / palpation (Dr. J notes, p54)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D675AFECA536_V', 'A 28-year-old patient presents with ↑↑↑ pain when breathe / palpation. What is the most likely diagnosis?', '↑↑↑ pain when breathe / palpation', 'Even wind blow, pain', 'Itching, fatigue', 'Due to sphincter being weak', 'A', 'The presentation of ↑↑↑ pain when breathe / palpation is classic for Biliary colic not Rx. (Dr. J notes, p54)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D6AC9F4B4AEC', 'What is the treatment for MEN 2B?', 'Oral Neuroma (mucosal neuroma)', 'Insulin , > MOA = works on adipose', 'If all the receptors are not working anymore due to lack of treatment, can end up in DKAdown ﬁnomina - GH', 'Topical salicylic acid', 'A', 'Treatment for MEN 2B: Oral Neuroma (mucosal neuroma) (Dr. J notes, p14)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D6AC9F4B4AEC_V', 'A 22-year-old patient is diagnosed with MEN 2B. The patient presents with 1P , > Medullary thyroid carcinoma [RET Gene]. What is the most appropriate treatment?', 'Oral Neuroma (mucosal neuroma)', 'Insulin , > MOA = works on adipose', 'If all the receptors are not working anymore due to lack of treatment, can end up in DKAdown ﬁnomina - GH', 'Topical salicylic acid', 'A', 'Treatment for MEN 2B: Oral Neuroma (mucosal neuroma) (Vignette from Dr. J notes, p14)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D6EAA5F55CF7', 'What is a key risk factor or cause of DNA virus?', 'Most likely cause cancer', '#1 diarrheal cause in kids, can be serious in babies', '#1 diarrheal cause in kids., can be serious in babies', 'No blindness but can cause death', 'A', 'Risk factor for DNA virus: Most likely cause cancer. (Dr. J notes, p32)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D6F561047393', 'What is the classic presentation of Becker?', 'After age 5, muscle weakness and ensuing gait abnormalities with miss sense Non frameshift mutation, no gowers sign', 'Silvery rash Osteophytes', 'Confusion, psychosis, tachycardia, arrhythmia, Diarrhea followed by constipation, tetany and spasm', 'Bilateral Joints pain & stiff in morning', 'A', 'Classic presentation of Becker: After age 5, muscle weakness and ensuing gait abnormalities with miss sense Non frameshift mutation ,  no gowers sign, not as severe as duchene impa... (Dr. J notes, p19)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D6F561047393_V', 'A 75-year-old patient presents with After age 5, muscle weakness and ensuing gait abnormalities with miss sense Non frameshift mutation ,  no gowers sign, no. What is the most likely diagnosis?', 'After age 5, muscle weakness and ensuing gait abnormalities with miss sense Non frameshift mutation, no gowers sign', 'Silvery rash Osteophytes', 'Confusion, psychosis, tachycardia, arrhythmia, Diarrhea followed by constipation, tetany and spasm', 'Bilateral Joints pain & stiff in morning', 'A', 'The presentation of After age 5, muscle weakness and ensuing gait abnormalities with miss sense Non frameshift mutation ,  no gowers sign, no is classic for Becker. (Dr. J notes, p19)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D7537853D9CF', 'What is the best diagnostic approach for Picornaviruses?', 'Echo, rhino, coxsackie, Hep A)', 'Lab - Neck ﬁlm', 'Others, N. Meningitis, strep pneumonia, Echo', 'We Can treat acute', 'A', 'Diagnosis of Picornaviruses: Echo, rhino, coxsackie, Hep A) (Dr. J notes, p36)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D7537853D9CF_V', 'A 8-year-old patient presents with Echo, rhino, coxsackie, Hep A). What is the best initial diagnostic test?', 'Echo, rhino, coxsackie, Hep A)', 'Lab - Neck ﬁlm', 'Others, N. Meningitis, strep pneumonia, Echo', 'We Can treat acute', 'A', 'Diagnosis of Picornaviruses: Echo, rhino, coxsackie, Hep A) (Vignette from Dr. J notes, p36)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D7551749D5A6', 'What is the mechanism of Cortisol?', '↑ sugar, receptor on cytoplasm', 'Inhibit osteoclast - JOB', 'Growth factor, EPO = Tyrosine kinase', 'Resorb in vit D def, resorb the bone', 'A', 'Mechanism of Cortisol: ↑ sugar, receptor on cytoplasm (Dr. J notes, p10)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D8FE90B70FF9', 'What is the classic presentation of Pheochromocytoma?', 'Pallor', 'Angiosarcoma of the veins', 'But enzyme def', 'Positive nikalosky sign', 'A', 'Classic presentation of Pheochromocytoma: Pallor (Dr. J notes, p15)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D8FE90B70FF9_V', 'A 70-year-old patient presents with Pallor. What is the most likely diagnosis?', 'Pallor', 'Angiosarcoma of the veins', 'But enzyme def', 'Positive nikalosky sign', 'A', 'The presentation of Pallor is classic for Pheochromocytoma. (Dr. J notes, p15)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D94660C37E33', 'What is the treatment for Enterococcus?', 'Endocarditis in - Pt who had renal transplant / cystoscopy procedure', 'Dicloxacillin Impetigo, Honey crust lesions', 'Macrolide = 50s', 'Pathophys, autoimmune', 'A', 'Treatment for Enterococcus: Cause Endocarditis in - Pt who had renal transplant / cystoscopy procedure (Dr. J notes, p44)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D94660C37E33_V', 'A 40-year-old patient is diagnosed with Enterococcus. The patient presents with Gram +Ve, Catalase -Ve, Nitrate -Ve,. What is the most appropriate treatment?', 'Endocarditis in - Pt who had renal transplant / cystoscopy procedure', 'Dicloxacillin Impetigo, Honey crust lesions', 'Macrolide = 50s', 'Pathophys, autoimmune', 'A', 'Treatment for Enterococcus: Cause Endocarditis in - Pt who had renal transplant / cystoscopy procedure (Vignette from Dr. J notes, p44)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D958F7A63633', 'What is the treatment for Scleroderma , Pt. 20-40yo?', 'PPIs for life', 'ERCP = bedding', 'Pathophys, autoimmune', 'Surgery', 'A', 'Treatment for Scleroderma , Pt. 20-40yo: PPIs for life. (Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D958F7A63633_V', 'A 40-year-old patient with known Scleroderma , Pt. 20-40yo comes in with Chronic GERD, difﬁculty swallowing,. Which treatment is most appropriate?', 'PPIs for life', 'ERCP = bedding', 'Pathophys, autoimmune', 'Surgery', 'A', 'Treatment for Scleroderma , Pt. 20-40yo: PPIs for life. (Vignette from Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D9DF98431AF4', 'What is the treatment for Pernicious anemia?', 'Supplement B12, vegans, and pts with bariatric Sx', 'Gastric by pass vit needs to give in order = B1, B12 and B9', 'Iron + vit C', 'B6 supplement, underlying cause if any', 'A', 'Treatment for Pernicious anemia: Rx ,  Supplement B12 ,  vegans, and pts with bariatric Sx (Dr. J notes, p111)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-D9EEF12740E4', 'What is the mechanism of 𝝰₂ Receptors?', 'Inhibit insulin release release, pancreas', 'No sarcomeres, partial synsitial activity, to peristalsis 2° messenger for contraction = IP₃', 'Triple VP mutation Bird peak, muscle wasting (diﬃculty releasing hand from handshake)', 'CPK - creatine phosphate kinase', 'A', 'Mechanism of 𝝰₂ Receptors: Inhibit insulin release release ,  pancreas (Dr. J notes, p17)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DA4D8B5223D4', 'What is the treatment for Genetic shift?', 'Aggressive, Rota (Vaccine every 2 months in kids unto 6 months), inﬂuenza A', 'Albendazole', 'IV acyclovir', 'Is supportive', 'A', 'Treatment for Genetic shift: Aggressive ,  Rota (Vaccine every 2 months in kids unto 6 months), inﬂuenza A (Dr. J notes, p32)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DA4D8B5223D4_V', 'A 8-year-old patient with Genetic shift presents with Aggressive ,  Rota (Vaccine every 2 months in kids unto 6 months), inﬂuenza A. What is the best initial treatment?', 'Aggressive, Rota (Vaccine every 2 months in kids unto 6 months), inﬂuenza A', 'Albendazole', 'IV acyclovir', 'Is supportive', 'A', 'Treatment for Genetic shift: Aggressive ,  Rota (Vaccine every 2 months in kids unto 6 months), inﬂuenza A (Vignette from Dr. J notes, p32)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DAF1350AD4CE', 'What is the treatment for Bacterial conjuctivitis?', 'Purulent. Rx Fluroqunilones and if not controlled, bacterial keratitis', 'Topical selenium sulﬁde, ketoconazole', 'Dicloxacillin Impetigo, Honey crust lesions', 'Treat with HAART therapy, 2 NRTIs + Integrase or 2NNRTIS', 'A', 'Treatment for Bacterial conjuctivitis: Purulent. Rx Fluroqunilones and if not controlled ,  bacterial keratitis (Dr. J notes, p7)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DAF1350AD4CE_V', 'A 22-year-old patient with Bacterial conjuctivitis presents with Purulent. Rx Fluroqunilones and if not controlled ,  bacterial keratitis. What is the best initial treatment?', 'Purulent. Rx Fluroqunilones and if not controlled, bacterial keratitis', 'Topical selenium sulﬁde, ketoconazole', 'Dicloxacillin Impetigo, Honey crust lesions', 'Treat with HAART therapy, 2 NRTIs + Integrase or 2NNRTIS', 'A', 'Treatment for Bacterial conjuctivitis: Purulent. Rx Fluroqunilones and if not controlled ,  bacterial keratitis (Vignette from Dr. J notes, p7)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DB55A79FB864', 'What is the treatment for Periorbital cellulitis?', 'No pain, when looks sideways', 'Topical selenium sulﬁde, ketoconazole', 'Oral terbinaﬁne', 'If all the receptors are not working anymore due to lack of treatment, can end up in DKAdown ﬁnomina - GH', 'A', 'Treatment for Periorbital cellulitis: No pain, when looks sideways. Rx - Oral antibioticsBaby has eye irritation in ﬁrst 24 hrs ,  chemical, Rx - washPt with eye irritation in ﬁrst 1 wk ... (Dr. J notes, p8)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DB55A79FB864_V', 'A 22-year-old patient with Periorbital cellulitis presents with No pain, when looks sideways. Rx - Oral antibioticsBaby has eye irritation in ﬁrst 24 hrs ,  chemical, Rx - washPt with e. What is the best initial treatment?', 'No pain, when looks sideways', 'Topical selenium sulﬁde, ketoconazole', 'Oral terbinaﬁne', 'If all the receptors are not working anymore due to lack of treatment, can end up in DKAdown ﬁnomina - GH', 'A', 'Treatment for Periorbital cellulitis: No pain, when looks sideways. Rx - Oral antibioticsBaby has eye irritation in ﬁrst 24 hrs ,  chemical, Rx - washPt with eye irritation in ﬁrst 1 wk ... (Vignette from Dr. J notes, p8)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DC6DAD6D2A67', 'What is a key risk factor or cause of Lead poisoning?', 'Exposure risk ↑in old houses with chipped paint (children) and workplace (adults)', 'Increase retention of iron within reticuloendothelial system', 'Ab directly on RBC membrane, genetic, immune resp', 'Genetic , δ ALA synthesis', 'A', 'Risk factor for Lead poisoning: Exposure risk ↑in old houses with chipped paint (children) and workplace (adults) (Dr. J notes, p110)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DD004D5C20AF', 'What is the best diagnostic approach for Ulcerative colitis , Young 20s?', 'Inﬂammatory crypt abscess, biopsy', 'Bordetella pertussis', 'X-ray = Gallstone in cystic duct, inﬂamed', 'If Dx Or chance of H.E', 'A', 'Diagnosis of Ulcerative colitis , Young 20s: Inﬂammatory crypt abscess ,  biopsy (Dr. J notes, p56)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DD004D5C20AF_V', 'A 28-year-old patient presents with Bloody diarrhea, abd pain, No vit def, erythema nodosum,. What is the most accurate diagnostic approach?', 'Inﬂammatory crypt abscess, biopsy', 'Bordetella pertussis', 'X-ray = Gallstone in cystic duct, inﬂamed', 'If Dx Or chance of H.E', 'A', 'Diagnosis of Ulcerative colitis , Young 20s: Inﬂammatory crypt abscess ,  biopsy (Vignette from Dr. J notes, p56)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DD0598639053', 'What is the classic presentation of Rheumatoid arthritis?', 'Bilateral Joints pain & stiff in morning', '50-60 yo - mono articular Pain with movement mostly day, worse at end of day, nodes present Joints in ﬁngers, DIP', 'Pain and swelling, fever, warmness & redness in that area Most common bug - Steph Aureus, sickle cell - salmonella', 'Fatigue, malar rash, joint pain, painless ulcer oral', 'A', 'Classic presentation of Rheumatoid arthritis: Bilateral Joints pain & stiff in morning (Dr. J notes, p21)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DD0598639053_V', 'A 28-year-old patient presents to the clinic with Bilateral Joints pain & stiff in morning. Which of the following is the most likely diagnosis?', 'Bilateral Joints pain & stiff in morning', '50-60 yo - mono articular Pain with movement mostly day, worse at end of day, nodes present Joints in ﬁngers, DIP', 'Pain and swelling, fever, warmness & redness in that area Most common bug - Steph Aureus, sickle cell - salmonella', 'Fatigue, malar rash, joint pain, painless ulcer oral', 'A', 'The presentation of Bilateral Joints pain & stiff in morning is classic for Rheumatoid arthritis. (Dr. J notes, p21)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DD2886F99B4B', 'What is the classic presentation of Herpes (HSV)?', 'Acyclovir, famciclovir - prevent future outbreaks Gabapentin (for pain) - emitriptiline Ganciclovir - CMV', 'Jaundice, abd', 'Purple papules', 'Photophobia, hydrophobia, agitation, fever', 'A', 'Classic presentation of Herpes (HSV): Acyclovir, famciclovir - prevent future outbreaks Gabapentin (for pain) - emitriptiline Ganciclovir - CMV (Dr. J notes, p32)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DD2886F99B4B_V', 'A 5-year-old patient presents to the clinic with Acyclovir, famciclovir - prevent future outbreaks Gabapentin (for pain) - emitriptiline Ganciclovir - CMV. Which of the following is the most likely diagnosis?', 'Acyclovir, famciclovir - prevent future outbreaks Gabapentin (for pain) - emitriptiline Ganciclovir - CMV', 'Jaundice, abd', 'Purple papules', 'Photophobia, hydrophobia, agitation, fever', 'A', 'The presentation of Acyclovir, famciclovir - prevent future outbreaks Gabapentin (for pain) - emitriptiline Ganciclovir - CMV is classic for Herpes (HSV). (Dr. J notes, p32)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DD32291C36BD', 'What is a key risk factor or cause of 1° Adrenal Insufﬁciency in children?', '↓ 21𝝰 hydroxylase, ↑17-Hydroxy pro', 'At gland - parathyroid adenoma Ca⁺↑, PO₄⁺↓, PTH↑ Chief cell adenoma of parathyroid', 'In pregnancy, can cause hydrops fetalis', 'Genetic, as obesity is genetic, Type II diabetes can also be seen as genetic', 'A', 'Risk factor for 1° Adrenal Insufﬁciency in children: Cause ,  ↓ 21𝝰 hydroxylase, ↑17-Hydroxy pro. (Dr. J notes, p14)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DD6F3AB22ED8', 'What is the best diagnostic approach for Electric burn?', 'EKG, X-RAY', 'Die of cardiac arrested x-ray - white out', 'Dx , EM - Negri body', 'EKG, J wave, Osler wave', 'A', 'Diagnosis of Electric burn: EKG, X-RAY (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DE5A6833598D', 'What is the treatment for Atypical interstitial pneumonia?', '0-2 months old, chlamydia', 'Ceftriaxon, macrolides', 'Macrolides', 'Prophylaxis vaccine to family', 'A', 'Treatment for Atypical interstitial pneumonia: 0-2 months old ,  chlamydia Rx - Azithro ,  lymph granuloma venerium (Dr. J notes, p47)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DE5A6833598D_V', 'A 55-year-old patient with known Atypical interstitial pneumonia comes in with Legionella, urease plasma, micro plasma.. Which treatment is most appropriate?', '0-2 months old, chlamydia', 'Ceftriaxon, macrolides', 'Macrolides', 'Prophylaxis vaccine to family', 'A', 'Treatment for Atypical interstitial pneumonia: 0-2 months old ,  chlamydia Rx - Azithro ,  lymph granuloma venerium (Vignette from Dr. J notes, p47)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DE8EE016CCD8', 'What is the treatment for Hodgkin’s?', 'B symptoms ⨁,', 'Giardia (never enters body), hard to Rx', 'Furosemide, strong vasodilator', 'Type IV , - Delayed (ex.- Contact dermatitis, GVHD, PPD test, Chronic transplant rejection)', 'A', 'Treatment for Hodgkin’s: B symptoms ⨁ ,  Rx - chemo, Radiation (Dr. J notes, p87)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DF7DC3AB43AF', 'What is the classic presentation of venomous snake , keep wound Below?', 'Hemotoxin, makes u bleed out', 'Fever , nausea severe ﬂu like symptoms', 'Big ones, tingling pain Rx, Antihistamine, HTZ cream', 'Chest pain, aspirin, shortness of breath', 'A', 'Classic presentation of venomous snake , keep wound Below: Hemotoxin ,  makes u bleed out (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DF7DC3AB43AF_V', 'A 42-year-old patient presents with Hemotoxin ,  makes u bleed out. What is the most likely diagnosis?', 'Hemotoxin, makes u bleed out', 'Fever , nausea severe ﬂu like symptoms', 'Big ones, tingling pain Rx, Antihistamine, HTZ cream', 'Chest pain, aspirin, shortness of breath', 'A', 'The presentation of Hemotoxin ,  makes u bleed out is classic for venomous snake , keep wound Below. (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DFA7BAC02FA9', 'What is the classic presentation of Carpal tunnel?', 'Tingling 1ˢᵗ 3 ﬁngers', 'Pain and swelling, fever, warmness & redness in that area Most common bug - Steph Aureus, sickle cell - salmonella', 'Most of then are muscarinic, (Nicotinic are , autonomic ganglia and neuromuscular junction) Px - DUMBBELSS - Diarrhea', 'Fatigue, malar rash, joint pain, painless ulcer oral', 'A', 'Classic presentation of Carpal tunnel: Tingling 1ˢᵗ 3 ﬁngers (Dr. J notes, p22)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DFA7BAC02FA9_V', 'A 55-year-old patient is brought to the ED with Tingling 1ˢᵗ 3 ﬁngers. The most likely diagnosis is:', 'Tingling 1ˢᵗ 3 ﬁngers', 'Pain and swelling, fever, warmness & redness in that area Most common bug - Steph Aureus, sickle cell - salmonella', 'Most of then are muscarinic, (Nicotinic are , autonomic ganglia and neuromuscular junction) Px - DUMBBELSS - Diarrhea', 'Fatigue, malar rash, joint pain, painless ulcer oral', 'A', 'The presentation of Tingling 1ˢᵗ 3 ﬁngers is classic for Carpal tunnel. (Dr. J notes, p22)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-DFFA286FB4C9', 'What is a key risk factor or cause of Gastric ulcer?', 'Cancer risk ↑↑', '↓cancer risk', 'Pylori, NSAIDs, spicy food', 'If in baby, non migration of Auerbach plex, congenital', 'A', 'Risk factor for Gastric ulcer: Cancer risk ↑↑ (Dr. J notes, p53)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E03834A1894F', 'What is a key risk factor or cause of direct comb?', 'Ab directly on RBC membrane, genetic, immune resp', 'Main cause, nutrition', 'Risk of clots, If happens in hepatic vein', 'Increase retention of iron within reticuloendothelial system', 'A', 'Risk factor for direct comb: Ab directly on RBC membrane ,  1) genetic, 2) immune resp (Dr. J notes, p112)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E0F9AABD991A', 'What is the treatment for Zenker diverticulum?', 'Surgery', 'Prophylaxis vaccine to family', 'Baby from honey < 6-month-old', 'Macrolide = 50s', 'A', 'Treatment for Zenker diverticulum: Rx ,  surgery. (Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E0F9AABD991A_V', 'A 28-year-old patient with Zenker diverticulum presents with Diarrhea ,  metabolic acidosis ,  DKA, RTA ,  2. What is the best initial treatment?', 'Surgery', 'Prophylaxis vaccine to family', 'Baby from honey < 6-month-old', 'Macrolide = 50s', 'A', 'Treatment for Zenker diverticulum: Rx ,  surgery. (Vignette from Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E14E856E6B95', 'What is the best diagnostic approach for Herpes (HSV)?', 'Test - Tzank test', 'PCR of CSF on DNA', 'Tzank test - Eosinophilic intranuclear inclusions', 'Lab - Neck ﬁlm', 'A', 'Diagnosis of Herpes (HSV): Test - Tzank test (Dr. J notes, p32)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E14E856E6B95_V', 'A 45-year-old patient presents with Acyclovir, famciclovir - prevent future outbreaks Gabapentin (for pain) - emitriptiline Ganciclovir - CMV. What is the most accurate diagnostic approach?', 'Test - Tzank test', 'PCR of CSF on DNA', 'Tzank test - Eosinophilic intranuclear inclusions', 'Lab - Neck ﬁlm', 'A', 'Diagnosis of Herpes (HSV): Test - Tzank test (Vignette from Dr. J notes, p32)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E21595D34F85', 'What is the treatment for Pemphigus vulgaris?', 'Steroids, IVIg', 'Acyclovir, Gabapentin, amitryptaline', 'No pain, when looks sideways', 'Topical azole', 'A', 'Treatment for Pemphigus vulgaris: Steroids, IVIg (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E21595D34F85_V', 'A 70-year-old patient with Pemphigus vulgaris presents with +ve nikolsky sign ,  may not be present if smoking. What is the best initial treatment?', 'Steroids, IVIg', 'Acyclovir, Gabapentin, amitryptaline', 'No pain, when looks sideways', 'Topical azole', 'A', 'Treatment for Pemphigus vulgaris: Steroids, IVIg (Vignette from Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E2570C0EF7FE', 'What is the best diagnostic approach for Cataracts?', 'Slit lamp test', 'Biopsy, and local excision', 'Non healing ulcer, ﬂaky red in lower part of face, biopsy', 'Biopsy and', 'A', 'Diagnosis of Cataracts: Slit lamp test (Dr. J notes, p7)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E2570C0EF7FE_V', 'A 70-year-old patient is evaluated for Difﬁculty at night.. Which diagnostic study should be ordered first?', 'Slit lamp test', 'Biopsy, and local excision', 'Non healing ulcer, ﬂaky red in lower part of face, biopsy', 'Biopsy and', 'A', 'Diagnosis of Cataracts: Slit lamp test (Vignette from Dr. J notes, p7)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E2A75FEBCD14', 'What is the treatment for 2 or more gout attacks in year?', 'Chronic gout', 'Urinary incountinance, wipe don’t feel = quad eqvaina ,', 'Muscle pain, not true autoimmune C- normal, rx - stop drug „ Anti histon-antibody, complement level normalhydrolasin', 'MRSTCS mix connective tissue, RA, SLE, takayasu, CREST, Scleroderma', 'A', 'Treatment for 2 or more gout attacks in year: Chronic gout Rx = life style modiﬁcation ﬁrst Probanasid - if no kidney problems because most people are under secreters - pee it out Allopurinol - xa... (Dr. J notes, p22)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E2A75FEBCD14_V', 'A 75-year-old patient with known 2 or more gout attacks in year comes in with Chronic gout Rx = life style modiﬁcation ﬁrst Probanasid - if no kidney problems because most people are under secreters - . Which treatment is most appropriate?', 'Chronic gout', 'Urinary incountinance, wipe don’t feel = quad eqvaina ,', 'Muscle pain, not true autoimmune C- normal, rx - stop drug „ Anti histon-antibody, complement level normalhydrolasin', 'MRSTCS mix connective tissue, RA, SLE, takayasu, CREST, Scleroderma', 'A', 'Treatment for 2 or more gout attacks in year: Chronic gout Rx = life style modiﬁcation ﬁrst Probanasid - if no kidney problems because most people are under secreters - pee it out Allopurinol - xa... (Vignette from Dr. J notes, p22)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E3670A652B2A', 'What is the treatment for Dx - Monospot test?', 'Supportive', 'Iv IG, vaccination', 'Praziquantel', 'Is supportive', 'A', 'Treatment for Dx - Monospot test: Rx ,  supportive (Dr. J notes, p33)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E3C4F945AF80', 'What is the treatment for Child?', 'Vaccine - everyone', 'Acid crossing sphincter, columnar metaplasia Glandular, so adenocarcinoma', 'Pathophys, autoimmune', 'Endocarditis in - Pt who had renal transplant / cystoscopy procedure', 'A', 'Treatment for Child: Rx ,  Vaccine - everyone (Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E3C4F945AF80_V', 'A 28-year-old patient with Child presents with Hx ,  Not vaccinated or missed vaccines. What is the best initial treatment?', 'Vaccine - everyone', 'Acid crossing sphincter, columnar metaplasia Glandular, so adenocarcinoma', 'Pathophys, autoimmune', 'Endocarditis in - Pt who had renal transplant / cystoscopy procedure', 'A', 'Treatment for Child: Rx ,  Vaccine - everyone (Vignette from Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E41A03727DD9', 'What is the treatment for Packed RBC?', 'Give with Ⓝ saline', 'Except in E.R, We give Hydroxyurea to keep HbF high', 'Phlebotomy', 'Plasmapheresis to get rid of ab, corticosteroid', 'A', 'Treatment for Packed RBC: Give with Ⓝ saline (Dr. J notes, p108)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E41A03727DD9_V', 'A 45-year-old patient with Packed RBC presents with Give with Ⓝ saline. What is the best initial treatment?', 'Give with Ⓝ saline', 'Except in E.R, We give Hydroxyurea to keep HbF high', 'Phlebotomy', 'Plasmapheresis to get rid of ab, corticosteroid', 'A', 'Treatment for Packed RBC: Give with Ⓝ saline (Vignette from Dr. J notes, p108)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E5A3B80698E3', 'What is the best diagnostic approach for H e p C?', 'Screen 18- 79 ages', 'Biopsy, granulomas', 'Inﬂammatory crypt abscess, biopsy', 'X-ray - air in mediastenum', 'A', 'Diagnosis of H e p C: Screen 18- 79 ages (Dr. J notes, p55)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E6BEFDC6E38F', 'What is the best diagnostic approach for Microcytic anemia?', 'Best initial Diagnostic, Iron study, High TIBC', 'Most accurate test, B12 level or we check for homocysteine and methylmalonic acid', 'B.M biopsy, perssion blue stain', 'Carboxylation of clotting factors, to attract plts with negative charge', 'A', 'Diagnosis of Microcytic anemia: Best initial Diagnostic ,  Iron study ,  High TIBC (Dr. J notes, p109)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E6BEFDC6E38F_V', 'A 60-year-old patient presents with Thalassemia, lead poisoning, anemia due to chronic disease, sideroblastic.. What is the most accurate diagnostic approach?', 'Best initial Diagnostic, Iron study, High TIBC', 'Most accurate test, B12 level or we check for homocysteine and methylmalonic acid', 'B.M biopsy, perssion blue stain', 'Carboxylation of clotting factors, to attract plts with negative charge', 'A', 'Diagnosis of Microcytic anemia: Best initial Diagnostic ,  Iron study ,  High TIBC (Vignette from Dr. J notes, p109)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E6FB62286571', 'What is the classic presentation of pneumocystis jiroveci?', 'Fatigue, shortness of breath, MCC of death', 'Neuro symptoms - headache, encephalitis, meningitis', '3-4 days of fever sore throat, myalgia, ﬂu like', 'Fever, myalgia, splenomegaly, lymphadenopathy', 'A', 'Classic presentation of pneumocystis jiroveci: Fatigue, shortness of breath ,  MCC of death. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E6FB62286571_V', 'A 8-year-old patient is brought to the ED with Fatigue, shortness of breath ,  MCC of death.. The most likely diagnosis is:', 'Fatigue, shortness of breath, MCC of death', 'Neuro symptoms - headache, encephalitis, meningitis', '3-4 days of fever sore throat, myalgia, ﬂu like', 'Fever, myalgia, splenomegaly, lymphadenopathy', 'A', 'The presentation of Fatigue, shortness of breath ,  MCC of death. is classic for pneumocystis jiroveci. (Dr. J notes, p37)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E728414BCB92', 'What is the classic presentation of Toxic epidermal necrolysis?', 'Positive nikalosky sign', 'On ﬂexor surfaces, itchy', 'Common in older, but if many appear in short period, rule out cancer', 'Fever, malaise, fatigue', 'A', 'Classic presentation of Toxic epidermal necrolysis: Positive nikalosky sign (Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E728414BCB92_V', 'A 70-year-old patient is brought to the ED with Positive nikalosky sign. The most likely diagnosis is:', 'Positive nikalosky sign', 'On ﬂexor surfaces, itchy', 'Common in older, but if many appear in short period, rule out cancer', 'Fever, malaise, fatigue', 'A', 'The presentation of Positive nikalosky sign is classic for Toxic epidermal necrolysis. (Dr. J notes, p5)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E7AB880DF3AF', 'What is the best diagnostic approach for Pseudo gout?', '> 55yo, mono articular, Previous damaged joint, big joint Analysis, + Ve birefringent crystals of Ca⁺ pyrophosphate', 'Sensitive test = ANA - anti nuclear antibody', '20-40yo, connective tissue problem Loss of wrinkles, tight skin, ﬁnger tip pitting BP = ↑↑, S₄, Esophagus', 'Shoes not ﬁt, headaches, hearing problem, test - IGF ↑, conductive hearing loss, GH, rx - octriotide in kids, Gigantism', 'A', 'Diagnosis of Pseudo gout: > 55yo, mono articular, Previous damaged joint, big joint Analysis ,  + Ve birefringent crystals of Ca⁺ pyrophosphate, do X-ray - calciﬁcation (Dr. J notes, p22)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E7AB880DF3AF_V', 'A 75-year-old patient presents with > 55yo, mono articular, Previous damaged joint, big joint Analysis ,  + Ve birefringent crystals of Ca⁺ pyrophosphate, do. What is the most accurate diagnostic approach?', '> 55yo, mono articular, Previous damaged joint, big joint Analysis, + Ve birefringent crystals of Ca⁺ pyrophosphate', 'Sensitive test = ANA - anti nuclear antibody', '20-40yo, connective tissue problem Loss of wrinkles, tight skin, ﬁnger tip pitting BP = ↑↑, S₄, Esophagus', 'Shoes not ﬁt, headaches, hearing problem, test - IGF ↑, conductive hearing loss, GH, rx - octriotide in kids, Gigantism', 'A', 'Diagnosis of Pseudo gout: > 55yo, mono articular, Previous damaged joint, big joint Analysis ,  + Ve birefringent crystals of Ca⁺ pyrophosphate, do X-ray - calciﬁcation (Vignette from Dr. J notes, p22)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E7E3FB6AD52B', 'What is the treatment for Bipolar-II?', 'First line', 'Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures', 'Benzo (short acting), liver issues Benzo, long acting, if no liver damage', 'Boys, 6-7yo, girls, 12yo > 6 months limited attention Hyperactive, impulsivity > 2 settings', 'A', 'Treatment for Bipolar-II: First line Rx = lithium A/E - Ebstein anomaly, nephrogenic, hypo / hyperthyroidism, tremor (Dr. J notes, p63)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E7E3FB6AD52B_V', 'A 35-year-old patient with Bipolar-II presents with Hypomanic +/- depression episodes and in between go normal ↓ ↑activity, energy, focus, ??. What is the best initial treatment?', 'First line', 'Inhibit NE & DA re-uptake 5-HT also - Not give pt with seizures', 'Benzo (short acting), liver issues Benzo, long acting, if no liver damage', 'Boys, 6-7yo, girls, 12yo > 6 months limited attention Hyperactive, impulsivity > 2 settings', 'A', 'Treatment for Bipolar-II: First line Rx = lithium A/E - Ebstein anomaly, nephrogenic, hypo / hyperthyroidism, tremor (Vignette from Dr. J notes, p63)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E7F5C0D692CE', 'What is the treatment for Actinomyces?', 'Oral abscess and Interstitial pneumonia after Dental/ Trauma', 'IV, metronidazole - blood prob Oral, Vanco, Fenoxamycin', 'Isotonic ﬂuid, due to ↓vol', 'Salmonella , Touching turtles, chicken', 'A', 'Treatment for Actinomyces: Cause oral abscess and Interstitial pneumonia after Dental/ Trauma (Dr. J notes, p45)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E83A89210CC6', 'What is the treatment for X- ray?', 'Calciﬁcation in lower lobe (unless that is a superman :P)↘ Bx - ferruginous bodies Asbestosis, adenocarcinoma', 'X-Ray = tram tracking, bronchial dilatation Emphysema, norm to decreased, O₂, CO₂ ↑, PH ↓', 'Hyperventilation, dry cough, lung vol small', 'Diffusion problem', 'A', 'Treatment for X- ray: Calciﬁcation in lower lobe (unless that is a superman :P)↘ Bx - ferruginous bodies Asbestosis ,  adenocarcinoma ,  M.C.C cancer is bronchogenic most ... (Dr. J notes, p129)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E83A89210CC6_V', 'A 55-year-old patient with known X- ray comes in with Calciﬁcation in lower lobe (unless that is a superman :P)↘ Bx - ferruginous bodies Asbestosis ,  adenocarcinoma ,  M.C.C c. Which treatment is most appropriate?', 'Calciﬁcation in lower lobe (unless that is a superman :P)↘ Bx - ferruginous bodies Asbestosis, adenocarcinoma', 'X-Ray = tram tracking, bronchial dilatation Emphysema, norm to decreased, O₂, CO₂ ↑, PH ↓', 'Hyperventilation, dry cough, lung vol small', 'Diffusion problem', 'A', 'Treatment for X- ray: Calciﬁcation in lower lobe (unless that is a superman :P)↘ Bx - ferruginous bodies Asbestosis ,  adenocarcinoma ,  M.C.C cancer is bronchogenic most ... (Vignette from Dr. J notes, p129)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-E92595A0A80F', 'What is the best diagnostic approach for Hodgkin lymphoma ,  15?', 'B.I, biopsy, reed stern berg cells', 'Auer rods in smear', 'TRAP positive', 'Most accurate test, B12 level or we check for homocysteine and methylmalonic acid', 'A', 'Diagnosis of Hodgkin lymphoma ,  15: B.I ,  biopsy, reed stern berg cells (Dr. J notes, p114)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-EA082F6C1B16', 'What is the best diagnostic approach for Ankylosing spondylitis?', '30yo, Back pain mostly in the morning X-ray, vertebrae fuse to gather, bamboos', 'X-ray, erosion (inﬂammation)', '> 55yo, mono articular, Previous damaged joint, big joint Analysis, + Ve birefringent crystals of Ca⁺ pyrophosphate', 'Mabs, we need to do PPD test ﬁrst it inhibit granulomas - CD20', 'A', 'Diagnosis of Ankylosing spondylitis: 30yo, Back pain mostly in the morning X-ray ,  vertebrae fuse to gather, bamboos. Also do MRI Dx = associated with HLAB₂₇ Other associated with HLAB... (Dr. J notes, p21)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-EA082F6C1B16_V', 'A 40-year-old patient presents with 30yo, Back pain mostly in the morning X-ray ,  vertebrae fuse to gather, bamboos. Also do MRI Dx = associated with HLAB₂₇. What is the best initial diagnostic test?', '30yo, Back pain mostly in the morning X-ray, vertebrae fuse to gather, bamboos', 'X-ray, erosion (inﬂammation)', '> 55yo, mono articular, Previous damaged joint, big joint Analysis, + Ve birefringent crystals of Ca⁺ pyrophosphate', 'Mabs, we need to do PPD test ﬁrst it inhibit granulomas - CD20', 'A', 'Diagnosis of Ankylosing spondylitis: 30yo, Back pain mostly in the morning X-ray ,  vertebrae fuse to gather, bamboos. Also do MRI Dx = associated with HLAB₂₇ Other associated with HLAB... (Vignette from Dr. J notes, p21)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-EA70AFC58806', 'What is the mechanism of Rabies?', 'Receptor in brain aﬀected = nicotinic Receptor', 'Iv ca 2 gluconate + anti venom', 'Vaccine & IVIG, Once symptoms start, 100% deadly', 'Methylene blue', 'A', 'Mechanism of Rabies: Receptor in brain aﬀected = nicotinic Receptor, (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-EB278E9F1F93', 'What is the treatment for ITP , bleeding in skin and mucosa?', 'Plasmapheresis to get rid of ab, corticosteroid', 'Heparin and warfarin', 'Steroids, plasmapheresis', 'Gastric by pass vit needs to give in order = B1, B12 and B9', 'A', 'Treatment for ITP , bleeding in skin and mucosa: Plasmapheresis to get rid of ab., corticosteroid (Dr. J notes, p107)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-EB278E9F1F93_V', 'A 45-year-old patient with ITP , bleeding in skin and mucosa presents with Petechia, purpura,. What is the best initial treatment?', 'Plasmapheresis to get rid of ab, corticosteroid', 'Heparin and warfarin', 'Steroids, plasmapheresis', 'Gastric by pass vit needs to give in order = B1, B12 and B9', 'A', 'Treatment for ITP , bleeding in skin and mucosa: Plasmapheresis to get rid of ab., corticosteroid (Vignette from Dr. J notes, p107)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-EB635093977C', 'What is the classic presentation of House ﬁre burn , face & lips cherry red, stinging from nose and mouth?', 'No CO poisoning, we keep 24hrs in hospital why? pul edema risk, in ﬁrst 24 hours , > ischemia , > cell swelling', 'Tingling, burning, local swelling', 'Fever , nausea severe ﬂu like symptoms', 'Doesn’t vomit - respi acidosis', 'A', 'Classic presentation of House ﬁre burn , face & lips cherry red, stinging from nose and mouth: No CO poisoning, we keep 24hrs in hospital why? pul edema risk ,  in ﬁrst 24 hours , > ischemia , > cell swelling (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-EB635093977C_V', 'A 50-year-old patient is brought to the ED with No CO poisoning, we keep 24hrs in hospital why? pul edema risk ,  in ﬁrst 24 hours , > ischemia , > cell swelling. The most likely diagnosis is:', 'No CO poisoning, we keep 24hrs in hospital why? pul edema risk, in ﬁrst 24 hours , > ischemia , > cell swelling', 'Tingling, burning, local swelling', 'Fever , nausea severe ﬂu like symptoms', 'Doesn’t vomit - respi acidosis', 'A', 'The presentation of No CO poisoning, we keep 24hrs in hospital why? pul edema risk ,  in ﬁrst 24 hours , > ischemia , > cell swelling is classic for House ﬁre burn , face & lips cherry red, stinging from nose and mouth. (Dr. J notes, p25)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-EBAED7F28803', 'What is the classic presentation of Still’s disease?', 'Joint pain, Salmon color rash, Rheumatoid factor , ve', '> 50yo, Back pain, hat not ﬁt, hearing problem Alk phosphate ↑, X-ray sclerotic lessions', 'Silvery rash Osteophytes', '50-60 yo - mono articular Pain with movement mostly day, worse at end of day, nodes present Joints in ﬁngers, DIP', 'A', 'Classic presentation of Still’s disease: Joint pain, Salmon color rash, Rheumatoid factor , ve (Dr. J notes, p21)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-EBAED7F28803_V', 'A 55-year-old patient presents to the clinic with Joint pain, Salmon color rash, Rheumatoid factor , ve. Which of the following is the most likely diagnosis?', 'Joint pain, Salmon color rash, Rheumatoid factor , ve', '> 50yo, Back pain, hat not ﬁt, hearing problem Alk phosphate ↑, X-ray sclerotic lessions', 'Silvery rash Osteophytes', '50-60 yo - mono articular Pain with movement mostly day, worse at end of day, nodes present Joints in ﬁngers, DIP', 'A', 'The presentation of Joint pain, Salmon color rash, Rheumatoid factor , ve is classic for Still’s disease. (Dr. J notes, p21)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-ECB89F258EF6', 'What is the classic presentation of Plasmodium falciparum?', 'Malaria, fever every 72hrs', 'Roseola. Starts with fever, then rash is seen in 3 days', 'Black vomitus (due to blood), high fever and severe liver damage', 'Kids, slapped cheek rash, fever, erythema, myalgia', 'A', 'Classic presentation of Plasmodium falciparum: P. Malaria ,  fever every 72hrs (Dr. J notes, p39)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-ECB89F258EF6_V', 'A 30-year-old patient presents to the clinic with P. Malaria ,  fever every 72hrs. Which of the following is the most likely diagnosis?', 'Malaria, fever every 72hrs', 'Roseola. Starts with fever, then rash is seen in 3 days', 'Black vomitus (due to blood), high fever and severe liver damage', 'Kids, slapped cheek rash, fever, erythema, myalgia', 'A', 'The presentation of P. Malaria ,  fever every 72hrs is classic for Plasmodium falciparum. (Dr. J notes, p39)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-ED1D39C1A75A', 'What is the classic presentation of Cigler Najjar?', 'Baby + at birth, jaundice', 'Bloody diarrhea', 'Watery diarrhea in kids, malabsorption', '↑↑↑ pain when breathe / palpation', 'A', 'Classic presentation of Cigler Najjar: Baby + at birth, jaundice (Dr. J notes, p56)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-ED1D39C1A75A_V', 'A 55-year-old patient is brought to the ED with Baby + at birth, jaundice. The most likely diagnosis is:', 'Baby + at birth, jaundice', 'Bloody diarrhea', 'Watery diarrhea in kids, malabsorption', '↑↑↑ pain when breathe / palpation', 'A', 'The presentation of Baby + at birth, jaundice is classic for Cigler Najjar. (Dr. J notes, p56)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-ED5F6561412F', 'What is the best diagnostic approach for Melanoma?', 'Full thickness biopsy', 'KOH (best initial)', 'Biopsy and', 'Scrape test', 'A', 'Diagnosis of Melanoma: How do we diagnose it? Full thickness biopsy. (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-EDF3C1A382B5', 'What is the classic presentation of Hypo Mg⁺?', 'Low mg lets Na come right in', 'No pain', 'Funny feeling No P waves, EKG Decrease in PH , No pain, risk embolism in A. Fib', 'With chest pain, palpitation, tachycardia, Wide QRS Ventricular arrhythmia/ V', 'A', 'Classic presentation of Hypo Mg⁺: Low mg lets Na come right in. UPQDBVTFBMDPIPMXJUIESBXBM .H CMPDLT/B ,  Altered mental status, seizures GI ,  diarrhea followed by constipati... (Dr. J notes, p117)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-EDF3C1A382B5_V', 'A 65-year-old patient presents with Low mg lets Na come right in. UPQDBVTFBMDPIPMXJUIESBXBM .H CMPDLT/B ,  Altered mental status, seizures GI ,  diar. What is the most likely diagnosis?', 'Low mg lets Na come right in', 'No pain', 'Funny feeling No P waves, EKG Decrease in PH , No pain, risk embolism in A. Fib', 'With chest pain, palpitation, tachycardia, Wide QRS Ventricular arrhythmia/ V', 'A', 'The presentation of Low mg lets Na come right in. UPQDBVTFBMDPIPMXJUIESBXBM .H CMPDLT/B ,  Altered mental status, seizures GI ,  diar is classic for Hypo Mg⁺. (Dr. J notes, p117)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-EDF6B496C2E1', 'What is the treatment for Esophageal spasm?', 'Ca blockers', 'To ↓portal hypertension, Octreotide and antibiotics, due to low immunity', 'Aggravated at menses / chron’s, iron deﬁciency (', 'Acid crossing sphincter, columnar metaplasia Glandular, so adenocarcinoma', 'A', 'Treatment for Esophageal spasm: Ca blockers (Dr. J notes, p53)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-EDF6B496C2E1_V', 'A 40-year-old patient is diagnosed with Esophageal spasm. The patient presents with Chest pain,. What is the most appropriate treatment?', 'Ca blockers', 'To ↓portal hypertension, Octreotide and antibiotics, due to low immunity', 'Aggravated at menses / chron’s, iron deﬁciency (', 'Acid crossing sphincter, columnar metaplasia Glandular, so adenocarcinoma', 'A', 'Treatment for Esophageal spasm: Ca blockers (Vignette from Dr. J notes, p53)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-EED8E686A4A0', 'What is the treatment for 1°sclerosing (hardening) cholangitis ,  20?', 'ERCP = bedding', 'PPIs for life', 'Pathophys, autoimmune', 'O2, debridement, IV antibiotics', 'A', 'Treatment for 1°sclerosing (hardening) cholangitis ,  20: ERCP = bedding. Rx - steroids (Dr. J notes, p57)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-EED8E686A4A0_V', 'A 3-year-old patient with known 1°sclerosing (hardening) cholangitis ,  20 comes in with Itching, fatigue. Which treatment is most appropriate?', 'ERCP = bedding', 'PPIs for life', 'Pathophys, autoimmune', 'O2, debridement, IV antibiotics', 'A', 'Treatment for 1°sclerosing (hardening) cholangitis ,  20: ERCP = bedding. Rx - steroids (Vignette from Dr. J notes, p57)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F00733550807', 'What is a key risk factor or cause of Sickle cell crisis?', '1st crisis', 'Ab directly on RBC membrane, genetic, immune resp', 'Art. Clots cause what pathologies, MI, stroke', 'Increase retention of iron within reticuloendothelial system', 'A', 'Risk factor for Sickle cell crisis: 1st crisis. Risk for encapsulated bugs. (Dr. J notes, p111)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F1CEEED75F1D', 'What is the classic presentation of Boerhaave syndrome?', 'Also Ⓛ chest pain, pleural effusion, crepitus', 'RUQ pain (not going away this time)', 'Hx, Not vaccinated or missed vaccines', 'We can prevent Heart block with like rheumatic fever - regorge murmur but cannot prevent PSGN', 'A', 'Classic presentation of Boerhaave syndrome: Also Ⓛ chest pain, pleural effusion, crepitus. (Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F1CEEED75F1D_V', 'A 3-year-old patient is brought to the ED with Also Ⓛ chest pain, pleural effusion, crepitus.. The most likely diagnosis is:', 'Also Ⓛ chest pain, pleural effusion, crepitus', 'RUQ pain (not going away this time)', 'Hx, Not vaccinated or missed vaccines', 'We can prevent Heart block with like rheumatic fever - regorge murmur but cannot prevent PSGN', 'A', 'The presentation of Also Ⓛ chest pain, pleural effusion, crepitus. is classic for Boerhaave syndrome. (Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F255BF51EF1D', 'What is the classic presentation of 55yo?', 'Alcoholic present with acute gout, no GI issues', 'Severe back pain , worse with lean down, fever, ↑HR, ↓BP = spinal abscess', 'Pain, tenderness, tibial tubro', 'Bilateral Joints pain & stiff in morning', 'A', 'Classic presentation of 55yo: Alcoholic present with acute gout, no GI issues Rx = Colchicine → blocks micro tubules (Dr. J notes, p22)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F255BF51EF1D_V', 'A 28-year-old patient is brought to the ED with Alcoholic present with acute gout, no GI issues Rx = Colchicine → blocks micro tubules. The most likely diagnosis is:', 'Alcoholic present with acute gout, no GI issues', 'Severe back pain , worse with lean down, fever, ↑HR, ↓BP = spinal abscess', 'Pain, tenderness, tibial tubro', 'Bilateral Joints pain & stiff in morning', 'A', 'The presentation of Alcoholic present with acute gout, no GI issues Rx = Colchicine → blocks micro tubules is classic for 55yo. (Dr. J notes, p22)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F2EDB1F7B1A9', 'What is the treatment for Neurocysticercosis,  nausea vomiting?', 'Albendazole', 'Aggressive, Rota (Vaccine every 2 months in kids unto 6 months), inﬂuenza A', 'TMP-SMX, if allergic we give pentamidine', 'Only PERCH virus which is NOT transmitted through fecal- oral route - due to acid labile', 'A', 'Treatment for Neurocysticercosis,  nausea vomiting: Albendazole (Dr. J notes, p40)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F2EDB1F7B1A9_V', 'A 5-year-old patient is diagnosed with Neurocysticercosis,  nausea vomiting. The patient presents with Alt mental status, confusion. What is the most appropriate treatment?', 'Albendazole', 'Aggressive, Rota (Vaccine every 2 months in kids unto 6 months), inﬂuenza A', 'TMP-SMX, if allergic we give pentamidine', 'Only PERCH virus which is NOT transmitted through fecal- oral route - due to acid labile', 'A', 'Treatment for Neurocysticercosis,  nausea vomiting: Albendazole (Vignette from Dr. J notes, p40)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F2FCE04A9362', 'What is the classic presentation of Parvo virus?', 'Kids, slapped cheek rash, fever, erythema, myalgia', 'Diarrhea after traveling in cruise, big hotels (large crowds) buffets', 'Laryngotracheal bronchitis, presents with stridor, extra thoracic obs', 'Com. Viral cause of diarrhea in kids', 'A', 'Classic presentation of Parvo virus: Kids ,  slapped cheek rash, fever, erythema, myalgia, (Dr. J notes, p35)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F2FCE04A9362_V', 'A 45-year-old patient presents with Kids ,  slapped cheek rash, fever, erythema, myalgia,. What is the most likely diagnosis?', 'Kids, slapped cheek rash, fever, erythema, myalgia', 'Diarrhea after traveling in cruise, big hotels (large crowds) buffets', 'Laryngotracheal bronchitis, presents with stridor, extra thoracic obs', 'Com. Viral cause of diarrhea in kids', 'A', 'The presentation of Kids ,  slapped cheek rash, fever, erythema, myalgia, is classic for Parvo virus. (Dr. J notes, p35)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F34E63788FFB', 'What is the treatment for Opioid withdrawal?', '↑respiration, muscle spasm, yawning, impaired memory', 'Constipation, pin point pupils, slow speech, impaired memory', 'Boys, 6-7yo, girls, 12yo > 6 months limited attention Hyperactive, impulsivity > 2 settings', '> 6 month, Anxiety (outside) + worry (inside), about everything', 'A', 'Treatment for Opioid withdrawal: ↑respiration, muscle spasm, yawning, impaired memory Rx = naltrexone (Dr. J notes, p60)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F34E63788FFB_V', 'A 22-year-old patient with Opioid withdrawal presents with ↑respiration, muscle spasm, yawning, impaired memory Rx = naltrexone. What is the best initial treatment?', '↑respiration, muscle spasm, yawning, impaired memory', 'Constipation, pin point pupils, slow speech, impaired memory', 'Boys, 6-7yo, girls, 12yo > 6 months limited attention Hyperactive, impulsivity > 2 settings', '> 6 month, Anxiety (outside) + worry (inside), about everything', 'A', 'Treatment for Opioid withdrawal: ↑respiration, muscle spasm, yawning, impaired memory Rx = naltrexone (Vignette from Dr. J notes, p60)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F383D6110513', 'What is the treatment for ADD / ADHD?', 'Boys, 6-7yo, girls, 12yo > 6 months limited attention Hyperactive, impulsivity > 2 settings', '↑respiration, muscle spasm, yawning, impaired memory', '> 6 month, Anxiety (outside) + worry (inside), about everything', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'A', 'Treatment for ADD / ADHD: Boys ,  6-7yo, girls ,  12yo > 6 months limited attention Hyperactive, impulsivity > 2 settings, > 6 months True lesion = vertical activating system,... (Dr. J notes, p60)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F383D6110513_V', 'A 35-year-old patient is diagnosed with ADD / ADHD. The patient presents with Boys ,  6-7yo, girls ,  12yo > 6 months limited attention Hyperactive, impulsivity > 2 settings, > 6 months True lesion = . What is the most appropriate treatment?', 'Boys, 6-7yo, girls, 12yo > 6 months limited attention Hyperactive, impulsivity > 2 settings', '↑respiration, muscle spasm, yawning, impaired memory', '> 6 month, Anxiety (outside) + worry (inside), about everything', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'A', 'Treatment for ADD / ADHD: Boys ,  6-7yo, girls ,  12yo > 6 months limited attention Hyperactive, impulsivity > 2 settings, > 6 months True lesion = vertical activating system,... (Vignette from Dr. J notes, p60)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F3B19EB3E19F', 'What is the classic presentation of Histo?', 'Greasy appearancePt with headache, precocious puberty, bitemporal hemianopsia + loss of upper gaze, Pinealoma Stroke', 'Symptomatic, ataxia, spingomyelia, pain and temperature loss bilateral', 'Night terrors, sleep walking, teeth grinding increase intracraneal pressure, nausea, headache First sign', 'Need vit A to make CSF enzyme - carbonic anhydrase, acetazolamide inhibits carbonic anhydrase CSF acidic in blood', 'A', 'Classic presentation of Histo: Greasy appearancePt with headache, precocious puberty, bitemporal hemianopsia + loss of upper gaze ,  Pinealoma Stroke ,  numbness, paralysis, diﬃcul... (Dr. J notes, p140)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F3B19EB3E19F_V', 'A 70-year-old patient presents to the clinic with Greasy appearancePt with headache, precocious puberty, bitemporal hemianopsia + loss of upper gaze ,  Pinealoma Stroke ,  . Which of the following is the most likely diagnosis?', 'Greasy appearancePt with headache, precocious puberty, bitemporal hemianopsia + loss of upper gaze, Pinealoma Stroke', 'Symptomatic, ataxia, spingomyelia, pain and temperature loss bilateral', 'Night terrors, sleep walking, teeth grinding increase intracraneal pressure, nausea, headache First sign', 'Need vit A to make CSF enzyme - carbonic anhydrase, acetazolamide inhibits carbonic anhydrase CSF acidic in blood', 'A', 'The presentation of Greasy appearancePt with headache, precocious puberty, bitemporal hemianopsia + loss of upper gaze ,  Pinealoma Stroke ,   is classic for Histo. (Dr. J notes, p140)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F3C85177B464', 'What is the classic presentation of End stage renal disease?', 'Px , Old pt, Diabetes, bleeding when drawing blood', 'Type 4, hydrops fetalis (edema of fetus), not compatible with life', 'Seizures, fever, renal issues', 'Fatigue anemia, various types of inf', 'A', 'Classic presentation of End stage renal disease: Px , Old pt, Diabetes, ,  bleeding when drawing blood. (Dr. J notes, p109)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F3C85177B464_V', 'A 25-year-old patient presents with Px , Old pt, Diabetes, ,  bleeding when drawing blood.. What is the most likely diagnosis?', 'Px , Old pt, Diabetes, bleeding when drawing blood', 'Type 4, hydrops fetalis (edema of fetus), not compatible with life', 'Seizures, fever, renal issues', 'Fatigue anemia, various types of inf', 'A', 'The presentation of Px , Old pt, Diabetes, ,  bleeding when drawing blood. is classic for End stage renal disease. (Dr. J notes, p109)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F3E619D04960', 'What is the treatment for Alopecia?', 'Steroids - ﬁnasteride', 'Oral antibiotics', 'Topical azole', 'Topical azoles, selenium sulﬁde', 'A', 'Treatment for Alopecia: Rx ,  steroids - ﬁnasteride (Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F3E619D04960_V', 'A 32-year-old patient is diagnosed with Alopecia. The patient presents with Patchy hair loss, + smooth edges. What is the most appropriate treatment?', 'Steroids - ﬁnasteride', 'Oral antibiotics', 'Topical azole', 'Topical azoles, selenium sulﬁde', 'A', 'Treatment for Alopecia: Rx ,  steroids - ﬁnasteride (Vignette from Dr. J notes, p4)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F430385D819E', 'What is the classic presentation of Restrictive lung disease?', 'Hyperventilation, dry cough, lung vol small', 'Diffusion problem', 'CT- honey combing', 'X-Ray = tram tracking, bronchial dilatation Emphysema, norm to decreased, O₂, CO₂ ↑, PH ↓', 'A', 'Classic presentation of Restrictive lung disease: Hyperventilation, dry cough, lung vol small (Dr. J notes, p126)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F430385D819E_V', 'A 60-year-old patient presents with Hyperventilation, dry cough, lung vol small. What is the most likely diagnosis?', 'Hyperventilation, dry cough, lung vol small', 'Diffusion problem', 'CT- honey combing', 'X-Ray = tram tracking, bronchial dilatation Emphysema, norm to decreased, O₂, CO₂ ↑, PH ↓', 'A', 'The presentation of Hyperventilation, dry cough, lung vol small is classic for Restrictive lung disease. (Dr. J notes, p126)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F572368F02F5', 'What is a key risk factor or cause of Anemia due to chronic disease?', 'Increase retention of iron within reticuloendothelial system', 'Genetic , δ ALA synthesis', 'Risk of clots, If happens in hepatic vein', '1st crisis', 'A', 'Risk factor for Anemia due to chronic disease: Cause ,  increase retention of iron within reticuloendothelial system (Dr. J notes, p110)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F59665DDB445', 'What is the classic presentation of Somatostatin?', '2nd mes, cAMP', 'Positive nikalosky sign', 'Scaly skin rash after infection', 'If no hat, same Px, alopecia', 'A', 'Classic presentation of Somatostatin: 2nd mes ,  cAMP. Present - constipation (Dr. J notes, p11)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F59665DDB445_V', 'A 45-year-old patient is brought to the ED with 2nd mes ,  cAMP. Present - constipation. The most likely diagnosis is:', '2nd mes, cAMP', 'Positive nikalosky sign', 'Scaly skin rash after infection', 'If no hat, same Px, alopecia', 'A', 'The presentation of 2nd mes ,  cAMP. Present - constipation is classic for Somatostatin. (Dr. J notes, p11)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F5BEE14EF620', 'What is the treatment for Cyanide poisoning?', 'Thiosulfate, Hydroxocobalamin', 'Fomepizole - IV, ⊖ Alcohol dehydrogenase', 'Give with Ⓝ saline', 'Digoxin ab', 'A', 'Treatment for Cyanide poisoning: Thiosulfate, Hydroxocobalamin (Dr. J notes, p29)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F5CB71B867A4', 'What is the best diagnostic approach for HIV + CMV encephalitis confusion?', 'Neck stiffness, photophobia, altered mental status', 'Vomiting, neck stiffness, photophobia Dx - India ink', 'PCR of CSF on DNA', 'Others, N. Meningitis, strep pneumonia, Echo', 'A', 'Diagnosis of HIV + CMV encephalitis confusion: Neck stiffness, photophobia, altered mental status. Retinitis, esophagitis ,  CT ,  can see calciﬁcation only in the ventricles. (Dr. J notes, p38)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F5CB71B867A4_V', 'A 30-year-old patient presents with Neck stiffness, photophobia, altered mental status. Retinitis, esophagitis ,  CT ,  can see calciﬁcation only in the ventr. What is the most accurate diagnostic approach?', 'Neck stiffness, photophobia, altered mental status', 'Vomiting, neck stiffness, photophobia Dx - India ink', 'PCR of CSF on DNA', 'Others, N. Meningitis, strep pneumonia, Echo', 'A', 'Diagnosis of HIV + CMV encephalitis confusion: Neck stiffness, photophobia, altered mental status. Retinitis, esophagitis ,  CT ,  can see calciﬁcation only in the ventricles. (Vignette from Dr. J notes, p38)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F69AF0302835', 'What is a key risk factor or cause of Arterial clot?', 'Art. Clots cause what pathologies, MI, stroke', 'Increase retention of iron within reticuloendothelial system', 'Risk of clots, If happens in hepatic vein', 'Exposure risk ↑in old houses with chipped paint (children) and workplace (adults)', 'A', 'Risk factor for Arterial clot: Art. Clots cause what pathologies ,  MI, stroke (Dr. J notes, p107)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F74424C27548', 'What is the treatment for Selective IgA def?', 'Giardia (never enters body), hard to Rx', 'Muddy brown, granular #1 Cause = blood loss', 'Type IV , - Delayed (ex.- Contact dermatitis, GVHD, PPD test, Chronic transplant rejection)', 'Very slow infusion of hypertonic ﬂuid 3% normal saline, OSM ↑, ECF ↑, ICF↓ Lithium and demeclocyclin, to shut of ADH', 'A', 'Treatment for Selective IgA def: Giardia (never enters body) ,  hard to Rx (Dr. J notes, p84)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F74424C27548_V', 'A 30-year-old patient with Selective IgA def presents with Hx of sinopulmonary infection.. What is the best initial treatment?', 'Giardia (never enters body), hard to Rx', 'Muddy brown, granular #1 Cause = blood loss', 'Type IV , - Delayed (ex.- Contact dermatitis, GVHD, PPD test, Chronic transplant rejection)', 'Very slow infusion of hypertonic ﬂuid 3% normal saline, OSM ↑, ECF ↑, ICF↓ Lithium and demeclocyclin, to shut of ADH', 'A', 'Treatment for Selective IgA def: Giardia (never enters body) ,  hard to Rx (Vignette from Dr. J notes, p84)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F7D8B79B07F1', 'What is the treatment for Rheumatoid arthritis?', 'Methotrexate = dihydro-folate reductase inhibitor, A/E - megaloblastic anemia so Give with B9, leucovorin', 'Vasculitis small vessel, diminished pulses in arm or leg Sed high, haptoglobin level is low- ab bind to RBC and lyse', 'And with super high dose of cAMP , 1st come in stress', 'Calcinosis cutis, raynaud’s phenomenon, esophageal dysmotility, sclerodactyly, telangiectasis Anti centromere antibody', 'A', 'Treatment for Rheumatoid arthritis: Rx ,  methotrexate = dihydro-folate reductase inhibitor, A/E - megaloblastic anemia so Give with B9, leucovorin (Dr. J notes, p21)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F7D8B79B07F1_V', 'A 55-year-old patient is diagnosed with Rheumatoid arthritis. The patient presents with Bilateral Joints pain & stiff in morning. What is the most appropriate treatment?', 'Methotrexate = dihydro-folate reductase inhibitor, A/E - megaloblastic anemia so Give with B9, leucovorin', 'Vasculitis small vessel, diminished pulses in arm or leg Sed high, haptoglobin level is low- ab bind to RBC and lyse', 'And with super high dose of cAMP , 1st come in stress', 'Calcinosis cutis, raynaud’s phenomenon, esophageal dysmotility, sclerodactyly, telangiectasis Anti centromere antibody', 'A', 'Treatment for Rheumatoid arthritis: Rx ,  methotrexate = dihydro-folate reductase inhibitor, A/E - megaloblastic anemia so Give with B9, leucovorin (Vignette from Dr. J notes, p21)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F7DD02F25707', 'What is the best diagnostic approach for Restrictive lung disease?', 'Diffusion problem', 'CT- honey combing', 'X-Ray = tram tracking, bronchial dilatation Emphysema, norm to decreased, O₂, CO₂ ↑, PH ↓', 'Hyperventilation, dry cough, lung vol small', 'A', 'Diagnosis of Restrictive lung disease: Diffusion problem . X-ray - ground glass (Dr. J notes, p126)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F7DD02F25707_V', 'A 70-year-old patient presents with Hyperventilation, dry cough, lung vol small. What is the most accurate diagnostic approach?', 'Diffusion problem', 'CT- honey combing', 'X-Ray = tram tracking, bronchial dilatation Emphysema, norm to decreased, O₂, CO₂ ↑, PH ↓', 'Hyperventilation, dry cough, lung vol small', 'A', 'Diagnosis of Restrictive lung disease: Diffusion problem . X-ray - ground glass (Vignette from Dr. J notes, p126)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F8029547EA76', 'What is the best diagnostic approach for Hodgkin’s?', 'Biopsy test = reed Stemberg cells', 'TRAP cell positive', 'Roulette forms, blood smear', 'Lab, hypoglycemia, hypocalcemia', 'A', 'Diagnosis of Hodgkin’s: Biopsy test = reed Stemberg cells. (Dr. J notes, p87)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F85692EDEA4C', 'What is the mechanism of Smooth muscle?', 'No sarcomeres, partial synsitial activity, to peristalsis 2° messenger for contraction = IP₃', 'Use certain muscle ﬁber to speciﬁc work no autonomics, no syncytial activity = syncytial activity all muscle go', 'Use certain muscle ﬁber to speciﬁc work no autonomics', 'Triple VP mutation Bird peak, muscle wasting (diﬃculty releasing hand from handshake)', 'A', 'Mechanism of Smooth muscle: No sarcomeres, partial synsitial activity ,  to peristalsis 2° messenger for contraction = IP₃, DAG 2° messenger for contraction due to distention , ... (Dr. J notes, p18)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F8A7C2BCF2C4', 'What is the treatment for Entamoeba histolytica?', 'Metronidazole', 'Tx, Fecal oral', 'Tx - fecal oral', 'IV acyclovir', 'A', 'Treatment for Entamoeba histolytica: Metronidazole (Dr. J notes, p39)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F8A7C2BCF2C4_V', 'A 45-year-old patient is diagnosed with Entamoeba histolytica. The patient presents with Cause bloody diarrhea, liver abscess, liver cysts. (Flask shaped). What is the most appropriate treatment?', 'Metronidazole', 'Tx, Fecal oral', 'Tx - fecal oral', 'IV acyclovir', 'A', 'Treatment for Entamoeba histolytica: Metronidazole (Vignette from Dr. J notes, p39)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F96062DE64C9', 'What is the classic presentation of Small cell lung cancer?', 'So excess absorption of water, less sodium to the ratio of water present in the body', 'Chronic back pain', 'Hx of sinopulmonary infection', 'Lose stools, dry skin Dementia diarrhea Dermatitis', 'A', 'Classic presentation of Small cell lung cancer: So excess absorption of water ,  less sodium to the ratio of water present in the body. (Dr. J notes, p91)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F96062DE64C9_V', 'A 55-year-old patient presents to the clinic with So excess absorption of water ,  less sodium to the ratio of water present in the body.. Which of the following is the most likely diagnosis?', 'So excess absorption of water, less sodium to the ratio of water present in the body', 'Chronic back pain', 'Hx of sinopulmonary infection', 'Lose stools, dry skin Dementia diarrhea Dermatitis', 'A', 'The presentation of So excess absorption of water ,  less sodium to the ratio of water present in the body. is classic for Small cell lung cancer. (Dr. J notes, p91)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-F9B0A36DF972', 'What is a key risk factor or cause of Clostridium perferingenes?', 'Gas gangrene', 'Inf due to use of aggressive antibiotics use', 'Cystic ﬁbrosis, cause pneumonia after 20', 'If in baby, non migration of Auerbach plex, congenital', 'A', 'Risk factor for Clostridium perferingenes: Cause gas gangrene (Dr. J notes, p44)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-FA1A2134FF04', 'What is the mechanism of CML ,  30?', 'Tyrosine kinase?? B.I, LAP', 'Point mutation of glutamic acid leading to valine', 'Chronic PPI use - PPI inhibit parietal cell secretion which needs for B12 absorption', 'Kids, resolve, autoimmune', 'A', 'Mechanism of CML ,  30: Tyrosine kinase?? B.I ,  LAP (Dr. J notes, p114)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-FA6F54B4BDB6', 'What is the treatment for Irreversible EPs?', 'Tardive dyskinesia leading to frog tongue like movements', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'Repsiratory & cardiac supration', 'Quetiapine Greatest affect on = Ziprasidone, QT prolong Weight gain (glucose intolerant) = Olanzapine List a/e =', 'A', 'Treatment for Irreversible EPs: Tardive dyskinesia → frog tongue like movements Rx = 2ⁿᵈ generation atypical, stop ﬁrst generation (Dr. J notes, p61)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-FA6F54B4BDB6_V', 'A 18-year-old patient with Irreversible EPs presents with Tardive dyskinesia → frog tongue like movements Rx = 2ⁿᵈ generation atypical, stop ﬁrst generation. What is the best initial treatment?', 'Tardive dyskinesia leading to frog tongue like movements', 'Neuroleptic malignant syndrome Fever, rigidity, bradykinesia', 'Repsiratory & cardiac supration', 'Quetiapine Greatest affect on = Ziprasidone, QT prolong Weight gain (glucose intolerant) = Olanzapine List a/e =', 'A', 'Treatment for Irreversible EPs: Tardive dyskinesia → frog tongue like movements Rx = 2ⁿᵈ generation atypical, stop ﬁrst generation (Vignette from Dr. J notes, p61)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-FA79C13612B4', 'What is the classic presentation of EPEC?', 'Watery diarrhea in kids, malabsorption', 'Due to sphincter being weak', '↓energy state', 'Px , Diarrhea, on and off, kidney stones, gall stones', 'A', 'Classic presentation of EPEC: Watery diarrhea in kids, malabsorption (Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-FA79C13612B4_V', 'A 65-year-old patient is brought to the ED with Watery diarrhea in kids, malabsorption. The most likely diagnosis is:', 'Watery diarrhea in kids, malabsorption', 'Due to sphincter being weak', '↓energy state', 'Px , Diarrhea, on and off, kidney stones, gall stones', 'A', 'The presentation of Watery diarrhea in kids, malabsorption is classic for EPEC. (Dr. J notes, p46)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-FBBB237209F3', 'What is the classic presentation of Leishmaniasis?', 'Cutaneous black lesions, spiking fever, anemia, hepatosplenomegaly', 'Fever', 'Fatigue, shortness of breath, MCC of death', 'Kids, slapped cheek rash, fever, erythema, myalgia', 'A', 'Classic presentation of Leishmaniasis: Cutaneous black lesions, spiking fever, anemia, hepatosplenomegaly. (Dr. J notes, p40)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-FBBB237209F3_V', 'A 22-year-old patient is brought to the ED with Cutaneous black lesions, spiking fever, anemia, hepatosplenomegaly.. The most likely diagnosis is:', 'Cutaneous black lesions, spiking fever, anemia, hepatosplenomegaly', 'Fever', 'Fatigue, shortness of breath, MCC of death', 'Kids, slapped cheek rash, fever, erythema, myalgia', 'A', 'The presentation of Cutaneous black lesions, spiking fever, anemia, hepatosplenomegaly. is classic for Leishmaniasis. (Dr. J notes, p40)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-FBFAAB04F356', 'What is the best diagnostic approach for HHV-8 (@HIV)?', 'Smear, spindle cells', 'Test - Tzank test', 'Mono spot test will be negative', 'Others, N. Meningitis, strep pneumonia, Echo', 'A', 'Diagnosis of HHV-8 (@HIV): Smear ,  spindle cells. (Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-FBFAAB04F356_V', 'A 8-year-old patient is evaluated for Purple papules.. Which diagnostic study should be ordered first?', 'Smear, spindle cells', 'Test - Tzank test', 'Mono spot test will be negative', 'Others, N. Meningitis, strep pneumonia, Echo', 'A', 'Diagnosis of HHV-8 (@HIV): Smear ,  spindle cells. (Vignette from Dr. J notes, p34)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-FC993BB30B4D', 'What is the treatment for Plasmodium falciparum?', 'Mephloquine', 'Supportive', 'Aggressive, Rota (Vaccine every 2 months in kids unto 6 months), inﬂuenza A', 'Is supportive', 'A', 'Treatment for Plasmodium falciparum: Mephloquine. A.E ,  Nightmares (Dr. J notes, p39)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-FC993BB30B4D_V', 'A 45-year-old patient is diagnosed with Plasmodium falciparum. The patient presents with P. Malaria ,  fever every 72hrs. What is the most appropriate treatment?', 'Mephloquine', 'Supportive', 'Aggressive, Rota (Vaccine every 2 months in kids unto 6 months), inﬂuenza A', 'Is supportive', 'A', 'Treatment for Plasmodium falciparum: Mephloquine. A.E ,  Nightmares (Vignette from Dr. J notes, p39)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-FCD3EC498E81', 'What is the treatment for Latent autoimmune diabetes in adult?', 'Thiazide, paradoxical effect, make more V₂ aquaporins', 'Insulin , > MOA = works on adipose', 'If all the receptors are not working anymore due to lack of treatment, can end up in DKAdown ﬁnomina - GH', 'Topical salicylic acid', 'A', 'Treatment for Latent autoimmune diabetes in adult: Rx ,  Thiazide ,  paradoxical effect, make more V₂ aquaporins (Dr. J notes, p13)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-FD11AEE481D5', 'What is the classic presentation of Tinea versicolor (Malassezia fur-fur) Malassezia globosa?', 'Can occur anytime of the year', 'If no hat, same Px, alopecia', 'Positive nikalosky sign', 'Pain, photophobia, lacrimation Herpes infection', 'A', 'Classic presentation of Tinea versicolor (Malassezia fur-fur) Malassezia globosa: Can occur anytime of the year. More in summer because mainly at where sweat is sitting. (Dr. J notes, p3)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-FD11AEE481D5_V', 'A 58-year-old patient is brought to the ED with Can occur anytime of the year. More in summer because mainly at where sweat is sitting.. The most likely diagnosis is:', 'Can occur anytime of the year', 'If no hat, same Px, alopecia', 'Positive nikalosky sign', 'Pain, photophobia, lacrimation Herpes infection', 'A', 'The presentation of Can occur anytime of the year. More in summer because mainly at where sweat is sitting. is classic for Tinea versicolor (Malassezia fur-fur) Malassezia globosa. (Dr. J notes, p3)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-FE9E233482A0', 'What is the best diagnostic approach for Boerhaave syndrome?', 'X-ray - air in mediastenum', 'Bordetella pertussis', 'Inﬂammatory crypt abscess, biopsy', '6/7 polyps may turn bad but not until 40', 'A', 'Diagnosis of Boerhaave syndrome: X-ray - air in mediastenum (Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
insert into public.dataset_questions (dataset_version, question_id, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation) values
  ('v4', 'UQ-FE9E233482A0_V', 'A 40-year-old patient is evaluated for Also Ⓛ chest pain, pleural effusion, crepitus.. Which diagnostic study should be ordered first?', 'X-ray - air in mediastenum', 'Bordetella pertussis', 'Inﬂammatory crypt abscess, biopsy', '6/7 polyps may turn bad but not until 40', 'A', 'Diagnosis of Boerhaave syndrome: X-ray - air in mediastenum (Vignette from Dr. J notes, p52)')
on conflict (dataset_version, question_id) do update set
  prompt      = excluded.prompt,
  choice_a    = excluded.choice_a,
  choice_b    = excluded.choice_b,
  choice_c    = excluded.choice_c,
  choice_d    = excluded.choice_d,
  answer      = excluded.answer,
  explanation = excluded.explanation;
-- -----------------------------------------------------------------------------
-- 3. Canonical hash helper
-- -----------------------------------------------------------------------------
create or replace function public.dataset_canonical_hash(p_dataset_version text)
returns text
language sql
stable
as $fn$
  select encode(
    digest(
      string_agg(
        question_id || '|' || prompt || '|' || choice_a || '|' || choice_b || '|' || choice_c || '|' || choice_d || '|' || answer,
        E'\n' order by question_id
      ),
      'sha256'
    ),
    'hex'
  )
  from public.dataset_questions
  where dataset_version = p_dataset_version;
$fn$;
comment on function public.dataset_canonical_hash(text) is
  'Deterministic SHA-256 hex over canonical per-row serialization of dataset_questions rows for a given dataset_version. Canonical order: question_id asc. MR-702 Phase 1.2.';
-- -----------------------------------------------------------------------------
-- 4. Seed dataset_registry row for v4 using the server-computed hash
-- -----------------------------------------------------------------------------
insert into public.dataset_registry (dataset_version, content_root_hash, question_count, source_path, notes)
select 'v4',
       public.dataset_canonical_hash('v4'),
       (select count(*) from public.dataset_questions where dataset_version = 'v4'),
       '/Users/brianb/MissionMed/universal_questions_v4.json',
       'MR-702 STAT pivot v1.1 canonical seed'
on conflict (dataset_version) do update
set content_root_hash = excluded.content_root_hash,
    question_count    = excluded.question_count,
    source_path       = excluded.source_path,
    registered_at     = now(),
    notes             = excluded.notes;
-- -----------------------------------------------------------------------------
-- 5. dataset_registry_current() helper
-- -----------------------------------------------------------------------------
create or replace function public.dataset_registry_current()
returns text
language sql
stable
as $fn$
  select dataset_version from public.dataset_registry order by registered_at desc limit 1;
$fn$;
comment on function public.dataset_registry_current() is
  'Returns the most recently registered dataset_version. MR-702 Phase 1.2.';
grant execute on function public.dataset_canonical_hash(text) to authenticated;
grant execute on function public.dataset_registry_current() to authenticated, anon;
-- =============================================================================
-- End of 20260420_stat_dataset_ingest.sql
-- =============================================================================;
