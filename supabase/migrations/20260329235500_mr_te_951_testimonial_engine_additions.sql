-- ============================================================================
-- MR-TE-901 / MR-TE-004
-- Testimonial Intelligence Engine additions for persistence + analytics
-- Target: Supabase / PostgreSQL
-- Notes:
--   - Safe companion file to mr-905a_testimonial_engine.sql
--   - Frontend currently supports localStorage-first persistence with optional
--     remote POST hooks. Apply this schema when wiring Supabase endpoints.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE OR REPLACE FUNCTION mm_te_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  email TEXT,
  specialty_interest TEXT NOT NULL,
  step1_status TEXT NOT NULL CHECK (step1_status IN ('pass_first', 'pass_repeat', 'fail_history')),
  step2_ck_score INTEGER CHECK (step2_ck_score IS NULL OR step2_ck_score BETWEEN 1 AND 300),
  step3_status TEXT NOT NULL CHECK (step3_status IN ('not_taken', 'scheduled', 'passed')),
  exam_attempts INTEGER NOT NULL CHECK (exam_attempts BETWEEN 0 AND 20),
  yog INTEGER NOT NULL CHECK (yog BETWEEN 1950 AND 2100),
  visa_status TEXT NOT NULL CHECK (visa_status IN ('us_citizen', 'green_card', 'ead', 'requires_visa')),
  usce_type TEXT NOT NULL CHECK (usce_type IN ('clerkship', 'externship_teaching', 'externship_nonteaching', 'observership_teaching', 'observership_nonteaching', 'private_clinic', 'none')),
  usce_duration TEXT NOT NULL CHECK (usce_duration IN ('none', 'lt_3_months', '3_to_6_months', 'gt_6_months')),
  self_identified_red_flags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  free_text_concern TEXT,
  computed_actual_flags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  computed_profile_tier TEXT CHECK (computed_profile_tier IN ('exceptional', 'strong', 'competitive', 'borderline', 'at_risk', 'critical')),
  computed_severity TEXT CHECK (computed_severity IN ('minimal', 'low', 'moderate', 'high', 'critical')),
  primary_match_case_id UUID,
  recommended_service TEXT,
  intake_completed_at TIMESTAMPTZ,
  last_visit_at TIMESTAMPTZ,
  visit_count INTEGER NOT NULL DEFAULT 1 CHECK (visit_count >= 1),
  conversion_status TEXT NOT NULL DEFAULT 'visitor' CHECK (conversion_status IN ('visitor', 'engaged', 'intake_complete', 'cta_clicked', 'enrolled')),
  source_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'testimonial_cases'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f'
      AND t.relname = 'user_profiles'
      AND a.attname = 'primary_match_case_id'
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT fk_mm_te_user_profiles_primary_match_case
      FOREIGN KEY (primary_match_case_id) REFERENCES testimonial_cases(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
  ) THEN
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY session_id
          ORDER BY COALESCE(updated_at, last_visit_at, intake_completed_at, created_at) DESC, created_at DESC, id DESC
        ) AS row_num
      FROM user_profiles
      WHERE session_id IS NOT NULL
    )
    DELETE FROM user_profiles
    WHERE id IN (
      SELECT id
      FROM ranked
      WHERE row_num > 1
    );
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mm_te_user_profiles_session_id_unique
  ON user_profiles(session_id);
CREATE INDEX IF NOT EXISTS idx_mm_te_user_profiles_email
  ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_mm_te_user_profiles_profile_tier
  ON user_profiles(computed_profile_tier);
CREATE INDEX IF NOT EXISTS idx_mm_te_user_profiles_conversion_status
  ON user_profiles(conversion_status);
DROP TRIGGER IF EXISTS trg_mm_te_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trg_mm_te_user_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION mm_te_set_updated_at();
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'page_view',
    'intake_start',
    'intake_step',
    'intake_complete',
    'match_viewed',
    'story_expanded',
    'concern_viewed',
    'pd_section_viewed',
    'recommendation_viewed',
    'cta_clicked',
    'library_filtered',
    'load_more',
    'return_visit'
  )),
  event_data JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(event_data) = 'object'),
  page_section TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mm_te_analytics_events_session_id
  ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_mm_te_analytics_events_user_profile_id
  ON analytics_events(user_profile_id);
CREATE INDEX IF NOT EXISTS idx_mm_te_analytics_events_event_type
  ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_mm_te_analytics_events_occurred_at
  ON analytics_events(occurred_at DESC);
CREATE TABLE IF NOT EXISTS concern_interpretations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concern_key TEXT NOT NULL,
  severity_band TEXT NOT NULL CHECK (severity_band IN ('low', 'moderate', 'high', 'critical')),
  headline TEXT NOT NULL,
  acknowledgment TEXT NOT NULL,
  reality_statement TEXT NOT NULL,
  reframe TEXT NOT NULL,
  proof_strategy TEXT NOT NULL DEFAULT 'show_same',
  compound_modifier JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(compound_modifier) = 'object'),
  proof_case_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
  display_order INTEGER NOT NULL DEFAULT 100 CHECK (display_order >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (concern_key, severity_band)
);
CREATE INDEX IF NOT EXISTS idx_mm_te_concern_interpretations_key_active
  ON concern_interpretations(concern_key, active);
DROP TRIGGER IF EXISTS trg_mm_te_concern_interpretations_updated_at ON concern_interpretations;
CREATE TRIGGER trg_mm_te_concern_interpretations_updated_at
BEFORE UPDATE ON concern_interpretations
FOR EACH ROW
EXECUTE FUNCTION mm_te_set_updated_at();
INSERT INTO concern_interpretations (
  concern_key,
  severity_band,
  headline,
  acknowledgment,
  reality_statement,
  reframe,
  proof_strategy,
  display_order
)
VALUES
  (
    'low_scores',
    'high',
    'Low scores are a real limitation, but not an automatic dead end.',
    'Programs do filter on scores, so the concern itself is grounded in reality.',
    'MissionMed has public proof of applicants matching with borderline and low metrics when the rest of the file was rebuilt correctly.',
    'The real question is what the rest of your application says once a program decides to keep reading.',
    'show_worse_first',
    10
  ),
  (
    'old_graduate',
    'high',
    'A long graduation gap is hard, but it is not the same thing as being unmatchable.',
    'Programs will notice a 10+ year gap and ask about it directly.',
    'Public MissionMed proof includes applicants matching after very long gaps when the narrative and recent proof were rebuilt.',
    'At this gap range, narrative control and clinical recency matter more than trying to hide the age of the application.',
    'show_same_and_worse',
    20
  ),
  (
    'no_usce',
    'high',
    'No USCE is a major gap and also one of the few major weaknesses you can still repair.',
    'Without U.S. clinical proof, letters and interview stories both weaken.',
    'USCE creates recent proof, U.S.-based references, and stronger application credibility in one move.',
    'Because this weakness is fixable, the real issue is whether you build the highest-value version of it before applying.',
    'show_recovery_paths',
    30
  ),
  (
    'previously_unmatched',
    'high',
    'Going unmatched before is painful, but repeating the same strategy is the bigger risk.',
    'Programs will want to know what changed and why the next cycle will be different.',
    'MissionMed has repeated-cycle proof cases that only converted after a full rebuild, not after small edits.',
    'The next application has to look meaningfully different from the one that already failed.',
    'show_worse_first',
    40
  ),
  (
    'visa_restriction',
    'moderate',
    'Visa need changes the targeting strategy more than it changes the possibility of matching itself.',
    'Requiring sponsorship does reduce the eligible program pool.',
    'The limitation becomes most dangerous when it combines with weak scores, weak USCE, or poor targeting.',
    'The real job is identifying sponsoring programs that also tolerate the rest of the profile.',
    'show_same',
    50
  )
ON CONFLICT (concern_key, severity_band) DO NOTHING;
INSERT INTO concern_interpretations (
  concern_key,
  severity_band,
  headline,
  acknowledgment,
  reality_statement,
  reframe,
  proof_strategy,
  display_order
)
VALUES
  (
    'exam_attempts',
    'high',
    'Attempt history has to be handled directly, not buried.',
    'Programs do notice failed attempts and repeat passes immediately.',
    'Attempt history becomes survivable when the rest of the application clearly shows recovery, present-day competence, and a believable explanation.',
    'The danger is not the attempt alone. The danger is sounding vague, defensive, or unchanged when the topic comes up.',
    'show_same_and_worse',
    60
  ),
  (
    'step1_issues',
    'moderate',
    'A Step 1 setback matters most when nothing later proves recovery.',
    'A repeat pass or failure history does create an obvious question mark.',
    'Programs care less about old damage when Step 2, Step 3, USCE, and interviews make the current version of the candidate feel stronger.',
    'The goal is to make Step 1 old news by proving what changed after it.',
    'show_recovery_paths',
    70
  ),
  (
    'weak_usce',
    'moderate',
    'The issue is not only whether you have USCE. It is what kind of USCE you have.',
    'Low-touch observerships and weak letters do not carry the same weight as stronger teaching-hospital exposure.',
    'Programs trust clinical proof more when the experience produced specific U.S.-based examples and stronger letters.',
    'You may not need more volume. You may need better proof.',
    'show_same',
    80
  ),
  (
    'gap_years',
    'moderate',
    'Gap years become risky when the file never proves what happened during them.',
    'Programs do ask what the inactive period means for readiness now.',
    'The gap is easier to manage when the application shows current clinical relevance and a coherent story.',
    'The calendar gap matters. The unanswered gap matters more.',
    'show_same_and_worse',
    90
  ),
  (
    'multiple_cycles',
    'high',
    'Multiple cycles do not kill an application. Repeating the same cycle does.',
    'Programs will want to know why prior cycles failed and what is truly different now.',
    'MissionMed has public repeated-cycle proof that only converted after a full rebuild, not after cosmetic edits.',
    'The next cycle has to look meaningfully different from the last one.',
    'show_worse_first',
    100
  ),
  (
    'limited_interviews',
    'moderate',
    'Sparse interviews usually point to a file problem before an interview problem.',
    'If interviews are not coming, the anxiety is grounded in something real.',
    'One interview or none is usually the product of targeting, letters, statement quality, and metrics interacting together.',
    'Before fixing the room, fix the file that gets you into the room.',
    'show_recovery_paths',
    110
  ),
  (
    'interview_weakness',
    'moderate',
    'Interview weakness may be the highest-leverage fix on the page.',
    'A lot of applicants know interviews are where they lose momentum, and they are often right.',
    'Once the interview arrives, communication carries more weight than another round of score anxiety.',
    'The goal is not sounding polished. It is sounding clear, real, memorable, and safe to work with.',
    'show_same',
    120
  ),
  (
    'competitive_specialty',
    'moderate',
    'A competitive specialty is not automatically unrealistic. It is less forgiving.',
    'Competitive fields expose weak spots faster and punish average execution more aggressively.',
    'Some applicants truly need recalibration. Others need cleaner positioning and much stronger interview work.',
    'The real question is whether the profile is impossible or whether the execution simply has to be sharper.',
    'show_same_and_worse',
    130
  ),
  (
    'low_score_visa',
    'critical',
    'Low score plus visa need is a compound risk, not just two separate flags.',
    'Both concerns are real on their own. Together they shrink the margin for error.',
    'This combination can still match, but only when targeting is sharper and the rest of the file has fewer weak points.',
    'The strategy has to remove low-yield programs and make every viable application feel intentional.',
    'show_recovery_paths',
    140
  ),
  (
    'old_grad_attempts',
    'high',
    'Old graduate plus attempt history means the recovery story has to be airtight.',
    'Programs will question both recency and prior academic struggle.',
    'These profiles can still match when the file reads like a coherent comeback instead of a collection of apologies.',
    'Narrative control matters more here than generic encouragement.',
    'show_recovery_paths',
    150
  ),
  (
    'no_usce_attempts',
    'critical',
    'No or weak USCE plus attempt history creates a steep credibility problem.',
    'This combination raises both ability and readiness concerns at the same time.',
    'The way out is not optimism. It is fresh proof that programs can trust quickly.',
    'You need new evidence, not just more explanation.',
    'show_recovery_paths',
    160
  )
ON CONFLICT (concern_key, severity_band) DO NOTHING;
