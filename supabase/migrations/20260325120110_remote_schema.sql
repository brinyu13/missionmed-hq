drop extension if exists "pg_net";
drop trigger if exists "trg_email_messages_touch_common_columns" on "comms"."email_messages";
drop trigger if exists "trg_email_threads_touch_common_columns" on "comms"."email_threads";
drop trigger if exists "trg_video_assets_touch_common_columns" on "content"."video_assets";
drop trigger if exists "trg_divisions_touch_common_columns" on "core"."divisions";
drop trigger if exists "trg_staff_users_touch_common_columns" on "core"."staff_users";
drop trigger if exists "trg_enrollments_touch_common_columns" on "crm"."enrollments";
drop trigger if exists "trg_people_touch_common_columns" on "crm"."people";
drop trigger if exists "trg_pipeline_stage_history_touch_common_columns" on "crm"."pipeline_stage_history";
drop trigger if exists "trg_student_profiles_touch_common_columns" on "crm"."student_profiles";
drop trigger if exists "trg_orders_touch_common_columns" on "finance"."orders";
drop trigger if exists "trg_payments_touch_common_columns" on "finance"."payments";
drop trigger if exists "trg_alerts_touch_common_columns" on "ops"."alerts";
drop trigger if exists "trg_notes_touch_common_columns" on "ops"."notes";
drop trigger if exists "trg_tasks_touch_common_columns" on "ops"."tasks";
drop trigger if exists "trg_automation_events_set_updated_at" on "public"."automation_events";
drop trigger if exists "trg_email_sequences_set_updated_at" on "public"."email_sequences";
drop trigger if exists "trg_interactions_rollup" on "public"."interactions";
drop trigger if exists "trg_interactions_set_updated_at" on "public"."interactions";
drop trigger if exists "trg_lead_sequence_enrollment_prepare" on "public"."lead_sequence_enrollment";
drop trigger if exists "trg_lead_sequence_enrollment_queue_events" on "public"."lead_sequence_enrollment";
drop trigger if exists "trg_lead_sequence_enrollment_set_updated_at" on "public"."lead_sequence_enrollment";
drop trigger if exists "trg_leads_log_state_changes" on "public"."leads";
drop trigger if exists "trg_leads_prepare_defaults" on "public"."leads";
drop trigger if exists "trg_leads_set_updated_at" on "public"."leads";
drop trigger if exists "trg_segment_sequences_set_updated_at" on "public"."segment_sequences";
drop trigger if exists "trg_segments_set_updated_at" on "public"."segments";
drop trigger if exists "trg_sequence_steps_set_updated_at" on "public"."sequence_steps";
drop trigger if exists "trg_funnel_events_touch_common_columns" on "tracking"."funnel_events";
drop policy "service_role_all_automation_events" on "public"."automation_events";
drop policy "authenticated_read_reference_sequences" on "public"."email_sequences";
drop policy "service_role_all_email_sequences" on "public"."email_sequences";
drop policy "service_role_all_interactions" on "public"."interactions";
drop policy "service_role_all_lead_sequence_enrollment" on "public"."lead_sequence_enrollment";
drop policy "service_role_all_leads" on "public"."leads";
drop policy "authenticated_read_reference_segment_sequences" on "public"."segment_sequences";
drop policy "service_role_all_segment_sequences" on "public"."segment_sequences";
drop policy "authenticated_read_reference_segments" on "public"."segments";
drop policy "service_role_all_segments" on "public"."segments";
drop policy "authenticated_read_reference_steps" on "public"."sequence_steps";
drop policy "service_role_all_sequence_steps" on "public"."sequence_steps";
revoke delete on table "public"."automation_events" from "anon";
revoke insert on table "public"."automation_events" from "anon";
revoke references on table "public"."automation_events" from "anon";
revoke select on table "public"."automation_events" from "anon";
revoke trigger on table "public"."automation_events" from "anon";
revoke truncate on table "public"."automation_events" from "anon";
revoke update on table "public"."automation_events" from "anon";
revoke delete on table "public"."automation_events" from "authenticated";
revoke insert on table "public"."automation_events" from "authenticated";
revoke references on table "public"."automation_events" from "authenticated";
revoke select on table "public"."automation_events" from "authenticated";
revoke trigger on table "public"."automation_events" from "authenticated";
revoke truncate on table "public"."automation_events" from "authenticated";
revoke update on table "public"."automation_events" from "authenticated";
revoke delete on table "public"."automation_events" from "service_role";
revoke insert on table "public"."automation_events" from "service_role";
revoke references on table "public"."automation_events" from "service_role";
revoke select on table "public"."automation_events" from "service_role";
revoke trigger on table "public"."automation_events" from "service_role";
revoke truncate on table "public"."automation_events" from "service_role";
revoke update on table "public"."automation_events" from "service_role";
revoke delete on table "public"."email_sequences" from "anon";
revoke insert on table "public"."email_sequences" from "anon";
revoke references on table "public"."email_sequences" from "anon";
revoke select on table "public"."email_sequences" from "anon";
revoke trigger on table "public"."email_sequences" from "anon";
revoke truncate on table "public"."email_sequences" from "anon";
revoke update on table "public"."email_sequences" from "anon";
revoke delete on table "public"."email_sequences" from "authenticated";
revoke insert on table "public"."email_sequences" from "authenticated";
revoke references on table "public"."email_sequences" from "authenticated";
revoke select on table "public"."email_sequences" from "authenticated";
revoke trigger on table "public"."email_sequences" from "authenticated";
revoke truncate on table "public"."email_sequences" from "authenticated";
revoke update on table "public"."email_sequences" from "authenticated";
revoke delete on table "public"."email_sequences" from "service_role";
revoke insert on table "public"."email_sequences" from "service_role";
revoke references on table "public"."email_sequences" from "service_role";
revoke select on table "public"."email_sequences" from "service_role";
revoke trigger on table "public"."email_sequences" from "service_role";
revoke truncate on table "public"."email_sequences" from "service_role";
revoke update on table "public"."email_sequences" from "service_role";
revoke delete on table "public"."interactions" from "anon";
revoke insert on table "public"."interactions" from "anon";
revoke references on table "public"."interactions" from "anon";
revoke select on table "public"."interactions" from "anon";
revoke trigger on table "public"."interactions" from "anon";
revoke truncate on table "public"."interactions" from "anon";
revoke update on table "public"."interactions" from "anon";
revoke delete on table "public"."interactions" from "authenticated";
revoke insert on table "public"."interactions" from "authenticated";
revoke references on table "public"."interactions" from "authenticated";
revoke select on table "public"."interactions" from "authenticated";
revoke trigger on table "public"."interactions" from "authenticated";
revoke truncate on table "public"."interactions" from "authenticated";
revoke update on table "public"."interactions" from "authenticated";
revoke delete on table "public"."interactions" from "service_role";
revoke insert on table "public"."interactions" from "service_role";
revoke references on table "public"."interactions" from "service_role";
revoke select on table "public"."interactions" from "service_role";
revoke trigger on table "public"."interactions" from "service_role";
revoke truncate on table "public"."interactions" from "service_role";
revoke update on table "public"."interactions" from "service_role";
revoke delete on table "public"."lead_sequence_enrollment" from "anon";
revoke insert on table "public"."lead_sequence_enrollment" from "anon";
revoke references on table "public"."lead_sequence_enrollment" from "anon";
revoke select on table "public"."lead_sequence_enrollment" from "anon";
revoke trigger on table "public"."lead_sequence_enrollment" from "anon";
revoke truncate on table "public"."lead_sequence_enrollment" from "anon";
revoke update on table "public"."lead_sequence_enrollment" from "anon";
revoke delete on table "public"."lead_sequence_enrollment" from "authenticated";
revoke insert on table "public"."lead_sequence_enrollment" from "authenticated";
revoke references on table "public"."lead_sequence_enrollment" from "authenticated";
revoke select on table "public"."lead_sequence_enrollment" from "authenticated";
revoke trigger on table "public"."lead_sequence_enrollment" from "authenticated";
revoke truncate on table "public"."lead_sequence_enrollment" from "authenticated";
revoke update on table "public"."lead_sequence_enrollment" from "authenticated";
revoke delete on table "public"."lead_sequence_enrollment" from "service_role";
revoke insert on table "public"."lead_sequence_enrollment" from "service_role";
revoke references on table "public"."lead_sequence_enrollment" from "service_role";
revoke select on table "public"."lead_sequence_enrollment" from "service_role";
revoke trigger on table "public"."lead_sequence_enrollment" from "service_role";
revoke truncate on table "public"."lead_sequence_enrollment" from "service_role";
revoke update on table "public"."lead_sequence_enrollment" from "service_role";
revoke delete on table "public"."leads" from "anon";
revoke insert on table "public"."leads" from "anon";
revoke references on table "public"."leads" from "anon";
revoke select on table "public"."leads" from "anon";
revoke trigger on table "public"."leads" from "anon";
revoke truncate on table "public"."leads" from "anon";
revoke update on table "public"."leads" from "anon";
revoke delete on table "public"."leads" from "authenticated";
revoke insert on table "public"."leads" from "authenticated";
revoke references on table "public"."leads" from "authenticated";
revoke select on table "public"."leads" from "authenticated";
revoke trigger on table "public"."leads" from "authenticated";
revoke truncate on table "public"."leads" from "authenticated";
revoke update on table "public"."leads" from "authenticated";
revoke delete on table "public"."leads" from "service_role";
revoke insert on table "public"."leads" from "service_role";
revoke references on table "public"."leads" from "service_role";
revoke select on table "public"."leads" from "service_role";
revoke trigger on table "public"."leads" from "service_role";
revoke truncate on table "public"."leads" from "service_role";
revoke update on table "public"."leads" from "service_role";
revoke delete on table "public"."segment_sequences" from "anon";
revoke insert on table "public"."segment_sequences" from "anon";
revoke references on table "public"."segment_sequences" from "anon";
revoke select on table "public"."segment_sequences" from "anon";
revoke trigger on table "public"."segment_sequences" from "anon";
revoke truncate on table "public"."segment_sequences" from "anon";
revoke update on table "public"."segment_sequences" from "anon";
revoke delete on table "public"."segment_sequences" from "authenticated";
revoke insert on table "public"."segment_sequences" from "authenticated";
revoke references on table "public"."segment_sequences" from "authenticated";
revoke select on table "public"."segment_sequences" from "authenticated";
revoke trigger on table "public"."segment_sequences" from "authenticated";
revoke truncate on table "public"."segment_sequences" from "authenticated";
revoke update on table "public"."segment_sequences" from "authenticated";
revoke delete on table "public"."segment_sequences" from "service_role";
revoke insert on table "public"."segment_sequences" from "service_role";
revoke references on table "public"."segment_sequences" from "service_role";
revoke select on table "public"."segment_sequences" from "service_role";
revoke trigger on table "public"."segment_sequences" from "service_role";
revoke truncate on table "public"."segment_sequences" from "service_role";
revoke update on table "public"."segment_sequences" from "service_role";
revoke delete on table "public"."segments" from "anon";
revoke insert on table "public"."segments" from "anon";
revoke references on table "public"."segments" from "anon";
revoke select on table "public"."segments" from "anon";
revoke trigger on table "public"."segments" from "anon";
revoke truncate on table "public"."segments" from "anon";
revoke update on table "public"."segments" from "anon";
revoke delete on table "public"."segments" from "authenticated";
revoke insert on table "public"."segments" from "authenticated";
revoke references on table "public"."segments" from "authenticated";
revoke select on table "public"."segments" from "authenticated";
revoke trigger on table "public"."segments" from "authenticated";
revoke truncate on table "public"."segments" from "authenticated";
revoke update on table "public"."segments" from "authenticated";
revoke delete on table "public"."segments" from "service_role";
revoke insert on table "public"."segments" from "service_role";
revoke references on table "public"."segments" from "service_role";
revoke select on table "public"."segments" from "service_role";
revoke trigger on table "public"."segments" from "service_role";
revoke truncate on table "public"."segments" from "service_role";
revoke update on table "public"."segments" from "service_role";
revoke delete on table "public"."sequence_steps" from "anon";
revoke insert on table "public"."sequence_steps" from "anon";
revoke references on table "public"."sequence_steps" from "anon";
revoke select on table "public"."sequence_steps" from "anon";
revoke trigger on table "public"."sequence_steps" from "anon";
revoke truncate on table "public"."sequence_steps" from "anon";
revoke update on table "public"."sequence_steps" from "anon";
revoke delete on table "public"."sequence_steps" from "authenticated";
revoke insert on table "public"."sequence_steps" from "authenticated";
revoke references on table "public"."sequence_steps" from "authenticated";
revoke select on table "public"."sequence_steps" from "authenticated";
revoke trigger on table "public"."sequence_steps" from "authenticated";
revoke truncate on table "public"."sequence_steps" from "authenticated";
revoke update on table "public"."sequence_steps" from "authenticated";
revoke delete on table "public"."sequence_steps" from "service_role";
revoke insert on table "public"."sequence_steps" from "service_role";
revoke references on table "public"."sequence_steps" from "service_role";
revoke select on table "public"."sequence_steps" from "service_role";
revoke trigger on table "public"."sequence_steps" from "service_role";
revoke truncate on table "public"."sequence_steps" from "service_role";
revoke update on table "public"."sequence_steps" from "service_role";
alter table "comms"."email_messages" drop constraint "email_messages_direction_check";
alter table "comms"."email_messages" drop constraint "email_messages_message_status_check";
alter table "comms"."email_messages" drop constraint "email_messages_owner_person_id_fkey";
alter table "comms"."email_messages" drop constraint "email_messages_person_id_fkey";
alter table "comms"."email_messages" drop constraint "email_messages_thread_id_fkey";
alter table "comms"."email_threads" drop constraint "email_threads_message_count_check";
alter table "comms"."email_threads" drop constraint "email_threads_owner_person_id_fkey";
alter table "comms"."email_threads" drop constraint "email_threads_person_id_fkey";
alter table "comms"."email_threads" drop constraint "email_threads_thread_status_check";
alter table "content"."video_assets" drop constraint "video_assets_asset_status_check";
alter table "content"."video_assets" drop constraint "video_assets_duration_seconds_check";
alter table "content"."video_assets" drop constraint "video_assets_owner_person_id_fkey";
alter table "content"."video_assets" drop constraint "video_assets_person_id_fkey";
alter table "content"."video_assets" drop constraint "video_assets_video_type_check";
alter table "core"."divisions" drop constraint "divisions_leader_person_id_fkey";
alter table "core"."divisions" drop constraint "divisions_name_key";
alter table "core"."divisions" drop constraint "divisions_slug_key";
alter table "core"."staff_users" drop constraint "staff_users_division_id_fkey";
alter table "core"."staff_users" drop constraint "staff_users_person_id_fkey";
alter table "core"."staff_users" drop constraint "staff_users_person_id_key";
alter table "core"."staff_users" drop constraint "staff_users_role_key_check";
alter table "crm"."enrollments" drop constraint "enrollments_enrollment_status_check";
alter table "crm"."enrollments" drop constraint "enrollments_owner_person_id_fkey";
alter table "crm"."enrollments" drop constraint "enrollments_person_id_fkey";
alter table "crm"."enrollments" drop constraint "enrollments_pipeline_stage_check";
alter table "crm"."enrollments" drop constraint "enrollments_program_category_check";
alter table "crm"."enrollments" drop constraint "enrollments_student_profile_id_fkey";
alter table "crm"."people" drop constraint "people_owner_person_id_fkey";
alter table "crm"."people" drop constraint "people_person_type_check";
alter table "crm"."people" drop constraint "people_record_status_check";
alter table "crm"."pipeline_stage_history" drop constraint "pipeline_stage_history_changed_by_person_id_fkey";
alter table "crm"."pipeline_stage_history" drop constraint "pipeline_stage_history_enrollment_id_fkey";
alter table "crm"."pipeline_stage_history" drop constraint "pipeline_stage_history_from_stage_check";
alter table "crm"."pipeline_stage_history" drop constraint "pipeline_stage_history_person_id_fkey";
alter table "crm"."pipeline_stage_history" drop constraint "pipeline_stage_history_to_stage_check";
alter table "crm"."student_profiles" drop constraint "student_profiles_candidate_track_check";
alter table "crm"."student_profiles" drop constraint "student_profiles_person_id_fkey";
alter table "crm"."student_profiles" drop constraint "student_profiles_person_id_key";
alter table "finance"."orders" drop constraint "orders_discount_amount_check";
alter table "finance"."orders" drop constraint "orders_enrollment_id_fkey";
alter table "finance"."orders" drop constraint "orders_order_status_check";
alter table "finance"."orders" drop constraint "orders_owner_person_id_fkey";
alter table "finance"."orders" drop constraint "orders_person_id_fkey";
alter table "finance"."orders" drop constraint "orders_subtotal_amount_check";
alter table "finance"."orders" drop constraint "orders_tax_amount_check";
alter table "finance"."orders" drop constraint "orders_total_amount_check";
alter table "finance"."payments" drop constraint "payments_amount_check";
alter table "finance"."payments" drop constraint "payments_enrollment_id_fkey";
alter table "finance"."payments" drop constraint "payments_order_id_fkey";
alter table "finance"."payments" drop constraint "payments_owner_person_id_fkey";
alter table "finance"."payments" drop constraint "payments_payment_kind_check";
alter table "finance"."payments" drop constraint "payments_payment_status_check";
alter table "finance"."payments" drop constraint "payments_person_id_fkey";
alter table "ops"."alerts" drop constraint "alerts_alert_status_check";
alter table "ops"."alerts" drop constraint "alerts_alert_type_check";
alter table "ops"."alerts" drop constraint "alerts_enrollment_id_fkey";
alter table "ops"."alerts" drop constraint "alerts_owner_person_id_fkey";
alter table "ops"."alerts" drop constraint "alerts_person_id_fkey";
alter table "ops"."alerts" drop constraint "alerts_severity_check";
alter table "ops"."alerts" drop constraint "alerts_task_id_fkey";
alter table "ops"."alerts" drop constraint "alerts_thread_id_fkey";
alter table "ops"."notes" drop constraint "notes_author_person_id_fkey";
alter table "ops"."notes" drop constraint "notes_enrollment_id_fkey";
alter table "ops"."notes" drop constraint "notes_note_type_check";
alter table "ops"."notes" drop constraint "notes_person_id_fkey";
alter table "ops"."notes" drop constraint "notes_task_id_fkey";
alter table "ops"."notes" drop constraint "notes_thread_id_fkey";
alter table "ops"."notes" drop constraint "notes_visibility_check";
alter table "ops"."tasks" drop constraint "tasks_created_by_person_id_fkey";
alter table "ops"."tasks" drop constraint "tasks_enrollment_id_fkey";
alter table "ops"."tasks" drop constraint "tasks_owner_person_id_fkey";
alter table "ops"."tasks" drop constraint "tasks_person_id_fkey";
alter table "ops"."tasks" drop constraint "tasks_priority_check";
alter table "ops"."tasks" drop constraint "tasks_task_status_check";
alter table "ops"."tasks" drop constraint "tasks_task_type_check";
alter table "public"."automation_events" drop constraint "automation_events_attempt_count_check";
alter table "public"."automation_events" drop constraint "automation_events_lead_id_fkey";
alter table "public"."automation_events" drop constraint "automation_events_priority_check";
alter table "public"."automation_events" drop constraint "automation_events_sequence_enrollment_id_fkey";
alter table "public"."automation_events" drop constraint "automation_events_sequence_id_fkey";
alter table "public"."automation_events" drop constraint "automation_events_sequence_step_id_fkey";
alter table "public"."automation_events" drop constraint "automation_events_source_interaction_id_fkey";
alter table "public"."automation_events" drop constraint "automation_events_source_segment_id_fkey";
alter table "public"."email_sequences" drop constraint "email_sequences_priority_tier_check";
alter table "public"."email_sequences" drop constraint "email_sequences_slug_key";
alter table "public"."interactions" drop constraint "interactions_lead_id_fkey";
alter table "public"."interactions" drop constraint "interactions_sequence_enrollment_id_fkey";
alter table "public"."interactions" drop constraint "interactions_sequence_id_fkey";
alter table "public"."interactions" drop constraint "interactions_sequence_step_id_fkey";
alter table "public"."lead_sequence_enrollment" drop constraint "lead_sequence_enrollment_current_step_id_fkey";
alter table "public"."lead_sequence_enrollment" drop constraint "lead_sequence_enrollment_lead_id_fkey";
alter table "public"."lead_sequence_enrollment" drop constraint "lead_sequence_enrollment_sequence_id_fkey";
alter table "public"."lead_sequence_enrollment" drop constraint "lead_sequence_enrollment_source_segment_id_fkey";
alter table "public"."leads" drop constraint "leads_analyzer_flag_count_check";
alter table "public"."leads" drop constraint "leads_analyzer_score_check";
alter table "public"."leads" drop constraint "leads_conversion_probability_check";
alter table "public"."leads" drop constraint "leads_engagement_score_check";
alter table "public"."leads" drop constraint "leads_failed_attempts_check";
alter table "public"."leads" drop constraint "leads_graduation_year_check";
alter table "public"."leads" drop constraint "leads_lead_score_check";
alter table "public"."leads" drop constraint "leads_lead_score_manual_override_value_check";
alter table "public"."leads" drop constraint "leads_manual_score_requires_value";
alter table "public"."leads" drop constraint "leads_previous_match_cycles_check";
alter table "public"."leads" drop constraint "leads_red_flag_count_check";
alter table "public"."leads" drop constraint "leads_red_flag_taxonomy_is_array";
alter table "public"."leads" drop constraint "leads_research_publications_check";
alter table "public"."leads" drop constraint "leads_step1_score_check";
alter table "public"."leads" drop constraint "leads_step2_ck_score_check";
alter table "public"."leads" drop constraint "leads_usce_months_check";
alter table "public"."leads" drop constraint "leads_years_since_graduation_check";
alter table "public"."segment_sequences" drop constraint "segment_sequences_enrollment_priority_check";
alter table "public"."segment_sequences" drop constraint "segment_sequences_segment_id_fkey";
alter table "public"."segment_sequences" drop constraint "segment_sequences_segment_sequence_key";
alter table "public"."segment_sequences" drop constraint "segment_sequences_sequence_id_fkey";
alter table "public"."segments" drop constraint "segments_priority_check";
alter table "public"."segments" drop constraint "segments_slug_key";
alter table "public"."sequence_steps" drop constraint "sequence_steps_delay_minutes_check";
alter table "public"."sequence_steps" drop constraint "sequence_steps_sequence_id_fkey";
alter table "public"."sequence_steps" drop constraint "sequence_steps_sequence_order_key";
alter table "public"."sequence_steps" drop constraint "sequence_steps_sequence_step_key";
alter table "public"."sequence_steps" drop constraint "sequence_steps_step_order_check";
alter table "tracking"."funnel_events" drop constraint "funnel_events_enrollment_id_fkey";
alter table "tracking"."funnel_events" drop constraint "funnel_events_person_id_fkey";
drop function if exists "core"."touch_common_columns"();
drop function if exists "public"."crm_compute_red_flag_severity"(p_flag_count integer, p_analyzer_score integer, p_analyzer_risk_level public.crm_risk_level);
drop function if exists "public"."crm_compute_score_band"(p_score numeric);
drop function if exists "public"."crm_enqueue_enrollment_events"();
drop function if exists "public"."crm_enroll_lead_in_sequence"(p_lead_id uuid, p_sequence_slug text, p_entry_source text, p_source_segment_slug text, p_enrollment_reason text);
drop function if exists "public"."crm_log_lead_state_changes"();
drop view if exists "public"."crm_pending_automation_queue";
drop function if exists "public"."crm_prepare_enrollment"();
drop function if exists "public"."crm_prepare_lead_defaults"();
drop function if exists "public"."crm_rollup_lead_activity"();
drop function if exists "public"."crm_set_updated_at"();
alter table "comms"."email_messages" drop constraint "email_messages_pkey";
alter table "comms"."email_threads" drop constraint "email_threads_pkey";
alter table "content"."video_assets" drop constraint "video_assets_pkey";
alter table "core"."divisions" drop constraint "divisions_pkey";
alter table "core"."staff_users" drop constraint "staff_users_pkey";
alter table "crm"."enrollments" drop constraint "enrollments_pkey";
alter table "crm"."people" drop constraint "people_pkey";
alter table "crm"."pipeline_stage_history" drop constraint "pipeline_stage_history_pkey";
alter table "crm"."student_profiles" drop constraint "student_profiles_pkey";
alter table "finance"."orders" drop constraint "orders_pkey";
alter table "finance"."payments" drop constraint "payments_pkey";
alter table "ops"."alerts" drop constraint "alerts_pkey";
alter table "ops"."notes" drop constraint "notes_pkey";
alter table "ops"."tasks" drop constraint "tasks_pkey";
alter table "public"."automation_events" drop constraint "automation_events_pkey";
alter table "public"."email_sequences" drop constraint "email_sequences_pkey";
alter table "public"."interactions" drop constraint "interactions_pkey";
alter table "public"."lead_sequence_enrollment" drop constraint "lead_sequence_enrollment_pkey";
alter table "public"."leads" drop constraint "leads_pkey";
alter table "public"."segment_sequences" drop constraint "segment_sequences_pkey";
alter table "public"."segments" drop constraint "segments_pkey";
alter table "public"."sequence_steps" drop constraint "sequence_steps_pkey";
alter table "tracking"."funnel_events" drop constraint "funnel_events_pkey";
drop index if exists "comms"."email_messages_pkey";
drop index if exists "comms"."email_threads_pkey";
drop index if exists "comms"."idx_email_messages_person";
drop index if exists "comms"."idx_email_messages_thread";
drop index if exists "comms"."idx_email_threads_owner";
drop index if exists "comms"."idx_email_threads_person";
drop index if exists "comms"."ux_email_messages_external_message";
drop index if exists "comms"."ux_email_messages_source_record";
drop index if exists "comms"."ux_email_threads_external_thread";
drop index if exists "comms"."ux_email_threads_source_record";
drop index if exists "content"."idx_video_assets_owner";
drop index if exists "content"."idx_video_assets_person";
drop index if exists "content"."ux_video_assets_source_record";
drop index if exists "content"."video_assets_pkey";
drop index if exists "core"."divisions_name_key";
drop index if exists "core"."divisions_pkey";
drop index if exists "core"."divisions_slug_key";
drop index if exists "core"."idx_divisions_leader_person";
drop index if exists "core"."idx_staff_users_division_active";
drop index if exists "core"."staff_users_person_id_key";
drop index if exists "core"."staff_users_pkey";
drop index if exists "core"."ux_divisions_source_record";
drop index if exists "core"."ux_staff_users_source_record";
drop index if exists "crm"."enrollments_pkey";
drop index if exists "crm"."idx_enrollments_owner";
drop index if exists "crm"."idx_enrollments_person";
drop index if exists "crm"."idx_enrollments_pipeline_stage";
drop index if exists "crm"."idx_people_owner";
drop index if exists "crm"."idx_people_record_status";
drop index if exists "crm"."idx_pipeline_stage_history_person";
drop index if exists "crm"."idx_pipeline_stage_history_stage";
drop index if exists "crm"."idx_student_profiles_person";
drop index if exists "crm"."people_pkey";
drop index if exists "crm"."pipeline_stage_history_pkey";
drop index if exists "crm"."student_profiles_person_id_key";
drop index if exists "crm"."student_profiles_pkey";
drop index if exists "crm"."ux_enrollments_source_record";
drop index if exists "crm"."ux_people_email";
drop index if exists "crm"."ux_people_source_record";
drop index if exists "crm"."ux_pipeline_stage_history_source_record";
drop index if exists "crm"."ux_student_profiles_source_record";
drop index if exists "finance"."idx_orders_owner";
drop index if exists "finance"."idx_orders_person";
drop index if exists "finance"."idx_payments_order";
drop index if exists "finance"."idx_payments_person";
drop index if exists "finance"."orders_pkey";
drop index if exists "finance"."payments_pkey";
drop index if exists "finance"."ux_orders_order_number";
drop index if exists "finance"."ux_orders_source_record";
drop index if exists "finance"."ux_payments_processor_transaction";
drop index if exists "finance"."ux_payments_source_record";
drop index if exists "ops"."alerts_pkey";
drop index if exists "ops"."idx_alerts_owner";
drop index if exists "ops"."idx_alerts_person";
drop index if exists "ops"."idx_alerts_severity";
drop index if exists "ops"."idx_notes_person";
drop index if exists "ops"."idx_tasks_owner";
drop index if exists "ops"."idx_tasks_person";
drop index if exists "ops"."notes_pkey";
drop index if exists "ops"."tasks_pkey";
drop index if exists "ops"."ux_alerts_open_dedupe_key";
drop index if exists "ops"."ux_alerts_source_record";
drop index if exists "ops"."ux_notes_source_record";
drop index if exists "ops"."ux_tasks_source_record";
drop index if exists "public"."automation_events_pkey";
drop index if exists "public"."email_sequences_pkey";
drop index if exists "public"."email_sequences_slug_key";
drop index if exists "public"."idx_automation_events_created_at";
drop index if exists "public"."idx_automation_events_enrollment";
drop index if exists "public"."idx_automation_events_idempotency";
drop index if exists "public"."idx_automation_events_lead";
drop index if exists "public"."idx_automation_events_pending_queue";
drop index if exists "public"."idx_automation_events_status_schedule";
drop index if exists "public"."idx_email_sequences_created_at";
drop index if exists "public"."idx_email_sequences_owner_id";
drop index if exists "public"."idx_email_sequences_status";
drop index if exists "public"."idx_enrollment_created_at";
drop index if exists "public"."idx_enrollment_due_queue";
drop index if exists "public"."idx_enrollment_lead_status";
drop index if exists "public"."idx_enrollment_owner_id";
drop index if exists "public"."idx_enrollment_sequence_status";
drop index if exists "public"."idx_enrollment_single_active";
drop index if exists "public"."idx_interactions_channel";
drop index if exists "public"."idx_interactions_created_at";
drop index if exists "public"."idx_interactions_enrollment";
drop index if exists "public"."idx_interactions_external_event";
drop index if exists "public"."idx_interactions_follow_up";
drop index if exists "public"."idx_interactions_lead_occurred";
drop index if exists "public"."idx_interactions_owner_id";
drop index if exists "public"."idx_interactions_type";
drop index if exists "public"."idx_leads_analyzer_risk";
drop index if exists "public"."idx_leads_assigned_owner";
drop index if exists "public"."idx_leads_call_booked";
drop index if exists "public"."idx_leads_created_at";
drop index if exists "public"."idx_leads_email_normalized";
drop index if exists "public"."idx_leads_enrolled";
drop index if exists "public"."idx_leads_last_activity";
drop index if exists "public"."idx_leads_lead_score";
drop index if exists "public"."idx_leads_lifecycle_stage";
drop index if exists "public"."idx_leads_metadata_gin";
drop index if exists "public"."idx_leads_next_action";
drop index if exists "public"."idx_leads_owner_id";
drop index if exists "public"."idx_leads_pipeline_stage";
drop index if exists "public"."idx_leads_red_flag_codes_gin";
drop index if exists "public"."idx_leads_red_flag_severity";
drop index if exists "public"."idx_leads_red_flag_taxonomy_gin";
drop index if exists "public"."idx_leads_source";
drop index if exists "public"."idx_leads_tags_gin";
drop index if exists "public"."idx_leads_worklist";
drop index if exists "public"."idx_segment_sequences_created_at";
drop index if exists "public"."idx_segment_sequences_segment";
drop index if exists "public"."idx_segment_sequences_sequence";
drop index if exists "public"."idx_segments_category_active";
drop index if exists "public"."idx_segments_created_at";
drop index if exists "public"."idx_segments_owner_id";
drop index if exists "public"."idx_segments_rules_gin";
drop index if exists "public"."idx_sequence_steps_active";
drop index if exists "public"."idx_sequence_steps_created_at";
drop index if exists "public"."idx_sequence_steps_sequence_order";
drop index if exists "public"."interactions_pkey";
drop index if exists "public"."lead_sequence_enrollment_pkey";
drop index if exists "public"."leads_pkey";
drop index if exists "public"."segment_sequences_pkey";
drop index if exists "public"."segment_sequences_segment_sequence_key";
drop index if exists "public"."segments_pkey";
drop index if exists "public"."segments_slug_key";
drop index if exists "public"."sequence_steps_pkey";
drop index if exists "public"."sequence_steps_sequence_order_key";
drop index if exists "public"."sequence_steps_sequence_step_key";
drop index if exists "tracking"."funnel_events_pkey";
drop index if exists "tracking"."idx_funnel_events_event_name";
drop index if exists "tracking"."idx_funnel_events_person";
drop index if exists "tracking"."ux_funnel_events_source_record";
drop table "comms"."email_messages";
drop table "comms"."email_threads";
drop table "content"."video_assets";
drop table "core"."divisions";
drop table "core"."staff_users";
drop table "crm"."enrollments";
drop table "crm"."people";
drop table "crm"."pipeline_stage_history";
drop table "crm"."student_profiles";
drop table "finance"."orders";
drop table "finance"."payments";
drop table "ops"."alerts";
drop table "ops"."notes";
drop table "ops"."tasks";
drop table "public"."automation_events";
drop table "public"."email_sequences";
drop table "public"."interactions";
drop table "public"."lead_sequence_enrollment";
drop table "public"."leads";
drop table "public"."segment_sequences";
drop table "public"."segments";
drop table "public"."sequence_steps";
drop table "tracking"."funnel_events";
create table "public"."rfa_pipeline_events" (
    "id" bigint generated always as identity not null,
    "email" text not null,
    "ac_contact_id" text,
    "ac_deal_id" text,
    "from_stage" text,
    "to_stage" text not null,
    "risk_level" text,
    "trigger_type" text,
    "notes" text,
    "created_at" timestamp with time zone default now()
      );
alter table "public"."rfa_pipeline_events" enable row level security;
create table "public"."rfa_submissions" (
    "id" bigint generated always as identity not null,
    "email" text not null,
    "name" text,
    "risk_level" text not null,
    "score" integer not null default 0,
    "flag_count" integer not null default 0,
    "flags" jsonb default '[]'::jsonb,
    "status" text not null,
    "ac_contact_id" text,
    "ac_deal_id" text,
    "tags_applied" jsonb default '[]'::jsonb,
    "errors" jsonb default '[]'::jsonb,
    "duration_ms" integer default 0,
    "source" text default 'red-flag-analyzer'::text,
    "created_at" timestamp with time zone default now()
      );
alter table "public"."rfa_submissions" enable row level security;
drop type "public"."crm_automation_event_type";
drop type "public"."crm_confidence_level";
drop type "public"."crm_enrollment_status";
drop type "public"."crm_event_status";
drop type "public"."crm_interaction_channel";
drop type "public"."crm_interaction_direction";
drop type "public"."crm_interaction_type";
drop type "public"."crm_lead_score_band";
drop type "public"."crm_lifecycle_stage";
drop type "public"."crm_lor_quality";
drop type "public"."crm_owner";
drop type "public"."crm_pipeline_stage";
drop type "public"."crm_risk_level";
drop type "public"."crm_segment_type";
drop type "public"."crm_sequence_status";
drop type "public"."crm_sequence_step_action";
drop type "public"."crm_service_need";
drop type "public"."crm_student_stage";
drop extension if exists "citext";
CREATE INDEX idx_rfa_pipe_created ON public.rfa_pipeline_events USING btree (created_at DESC);
CREATE INDEX idx_rfa_pipe_deal ON public.rfa_pipeline_events USING btree (ac_deal_id);
CREATE INDEX idx_rfa_pipe_email ON public.rfa_pipeline_events USING btree (email);
CREATE INDEX idx_rfa_pipe_to_stage ON public.rfa_pipeline_events USING btree (to_stage);
CREATE INDEX idx_rfa_sub_ac_contact ON public.rfa_submissions USING btree (ac_contact_id);
CREATE INDEX idx_rfa_sub_created ON public.rfa_submissions USING btree (created_at DESC);
CREATE INDEX idx_rfa_sub_email ON public.rfa_submissions USING btree (email);
CREATE INDEX idx_rfa_sub_risk ON public.rfa_submissions USING btree (risk_level);
CREATE INDEX idx_rfa_sub_status ON public.rfa_submissions USING btree (status);
CREATE UNIQUE INDEX rfa_pipeline_events_pkey ON public.rfa_pipeline_events USING btree (id);
CREATE UNIQUE INDEX rfa_submissions_pkey ON public.rfa_submissions USING btree (id);
alter table "public"."rfa_pipeline_events" add constraint "rfa_pipeline_events_pkey" PRIMARY KEY using index "rfa_pipeline_events_pkey";
alter table "public"."rfa_submissions" add constraint "rfa_submissions_pkey" PRIMARY KEY using index "rfa_submissions_pkey";
alter table "public"."rfa_pipeline_events" add constraint "rfa_pipeline_events_risk_level_check" CHECK ((risk_level = ANY (ARRAY['LOW'::text, 'MODERATE'::text, 'HIGH'::text, 'CRITICAL'::text]))) not valid;
alter table "public"."rfa_pipeline_events" validate constraint "rfa_pipeline_events_risk_level_check";
alter table "public"."rfa_pipeline_events" add constraint "rfa_pipeline_events_trigger_type_check" CHECK ((trigger_type = ANY (ARRAY['automation'::text, 'manual'::text, 'system'::text]))) not valid;
alter table "public"."rfa_pipeline_events" validate constraint "rfa_pipeline_events_trigger_type_check";
alter table "public"."rfa_submissions" add constraint "rfa_submissions_risk_level_check" CHECK ((risk_level = ANY (ARRAY['LOW'::text, 'MODERATE'::text, 'HIGH'::text, 'CRITICAL'::text]))) not valid;
alter table "public"."rfa_submissions" validate constraint "rfa_submissions_risk_level_check";
alter table "public"."rfa_submissions" add constraint "rfa_submissions_status_check" CHECK ((status = ANY (ARRAY['success'::text, 'partial'::text, 'failed'::text]))) not valid;
alter table "public"."rfa_submissions" validate constraint "rfa_submissions_status_check";
create or replace view "public"."rfa_conversion_funnel" as  SELECT 'Analyzer Submissions'::text AS stage,
    1 AS stage_order,
    count(*) AS count
   FROM public.rfa_submissions
UNION ALL
 SELECT 'HIGH + CRITICAL Leads'::text AS stage,
    2 AS stage_order,
    count(*) FILTER (WHERE (rfa_submissions.risk_level = ANY (ARRAY['HIGH'::text, 'CRITICAL'::text]))) AS count
   FROM public.rfa_submissions
UNION ALL
 SELECT rfa_pipeline_events.to_stage AS stage,
    (3 + row_number() OVER (ORDER BY (min(rfa_pipeline_events.created_at)))) AS stage_order,
    count(*) AS count
   FROM public.rfa_pipeline_events
  GROUP BY rfa_pipeline_events.to_stage
  ORDER BY 2;
create or replace view "public"."rfa_daily_summary" as  SELECT date(created_at) AS submission_date,
    count(*) AS total_submissions,
    count(*) FILTER (WHERE (status = 'success'::text)) AS successful,
    count(*) FILTER (WHERE (status = 'partial'::text)) AS partial,
    count(*) FILTER (WHERE (status = 'failed'::text)) AS failed,
    count(*) FILTER (WHERE (risk_level = 'LOW'::text)) AS risk_low,
    count(*) FILTER (WHERE (risk_level = 'MODERATE'::text)) AS risk_moderate,
    count(*) FILTER (WHERE (risk_level = 'HIGH'::text)) AS risk_high,
    count(*) FILTER (WHERE (risk_level = 'CRITICAL'::text)) AS risk_critical,
    round(avg(score), 1) AS avg_score,
    round(avg(duration_ms), 0) AS avg_duration_ms
   FROM public.rfa_submissions
  GROUP BY (date(created_at))
  ORDER BY (date(created_at)) DESC;
create or replace view "public"."rfa_failed_submissions" as  SELECT id,
    email,
    risk_level,
    score,
    errors,
    created_at
   FROM public.rfa_submissions
  WHERE (status = 'failed'::text)
  ORDER BY created_at DESC;
create or replace view "public"."rfa_flag_frequency" as  SELECT flag_value.value AS flag_name,
    count(*) AS occurrences,
    round(((100.0 * (count(*))::numeric) / (NULLIF(( SELECT count(*) AS count
           FROM public.rfa_submissions rfa_submissions_1), 0))::numeric), 1) AS pct_of_all_leads
   FROM public.rfa_submissions,
    LATERAL jsonb_array_elements_text(rfa_submissions.flags) flag_value(value)
  GROUP BY flag_value.value
  ORDER BY (count(*)) DESC;
create or replace view "public"."rfa_pipeline_velocity" as  WITH stage_pairs AS (
         SELECT e1.email,
            e1.to_stage AS from_stage,
            e2.to_stage AS next_stage,
            (EXTRACT(epoch FROM (e2.created_at - e1.created_at)) / 86400.0) AS days_between
           FROM (public.rfa_pipeline_events e1
             JOIN public.rfa_pipeline_events e2 ON (((e1.email = e2.email) AND (e2.created_at > e1.created_at) AND (e2.id = ( SELECT min(e3.id) AS min
                   FROM public.rfa_pipeline_events e3
                  WHERE ((e3.email = e1.email) AND (e3.created_at > e1.created_at)))))))
        )
 SELECT from_stage,
    next_stage,
    count(*) AS transitions,
    round(avg(days_between), 1) AS avg_days,
    round(min(days_between), 1) AS min_days,
    round(max(days_between), 1) AS max_days
   FROM stage_pairs
  GROUP BY from_stage, next_stage
  ORDER BY (round(avg(days_between), 1)) DESC;
create or replace view "public"."rfa_system_health" as  SELECT date(created_at) AS check_date,
    count(*) AS total,
    count(*) FILTER (WHERE (status = 'failed'::text)) AS failures,
    round(((100.0 * (count(*) FILTER (WHERE (status = 'failed'::text)))::numeric) / (NULLIF(count(*), 0))::numeric), 1) AS failure_rate_pct,
    max(duration_ms) AS max_duration_ms,
    round(avg(duration_ms), 0) AS avg_duration_ms,
        CASE
            WHEN (count(*) FILTER (WHERE (status = 'failed'::text)) > 5) THEN 'ALERT: High failure count'::text
            WHEN (avg(duration_ms) > (8000)::numeric) THEN 'WARNING: Slow response times'::text
            ELSE 'HEALTHY'::text
        END AS health_status
   FROM public.rfa_submissions
  WHERE (created_at >= (now() - '24:00:00'::interval))
  GROUP BY (date(created_at));
create or replace view "public"."rfa_weekly_summary" as  SELECT (date_trunc('week'::text, created_at))::date AS week_start,
    count(*) AS total_leads,
    count(*) FILTER (WHERE (risk_level = ANY (ARRAY['HIGH'::text, 'CRITICAL'::text]))) AS high_critical_leads,
    round(((100.0 * (count(*) FILTER (WHERE (risk_level = ANY (ARRAY['HIGH'::text, 'CRITICAL'::text]))))::numeric) / (NULLIF(count(*), 0))::numeric), 1) AS pct_high_critical,
    round(avg(score), 1) AS avg_score,
    count(DISTINCT email) AS unique_emails,
    count(*) FILTER (WHERE (status = 'success'::text)) AS successful_syncs,
    round(((100.0 * (count(*) FILTER (WHERE (status = 'success'::text)))::numeric) / (NULLIF(count(*), 0))::numeric), 1) AS sync_success_rate
   FROM public.rfa_submissions
  GROUP BY (date_trunc('week'::text, created_at))
  ORDER BY ((date_trunc('week'::text, created_at))::date) DESC;
grant delete on table "public"."rfa_pipeline_events" to "anon";
grant insert on table "public"."rfa_pipeline_events" to "anon";
grant references on table "public"."rfa_pipeline_events" to "anon";
grant select on table "public"."rfa_pipeline_events" to "anon";
grant trigger on table "public"."rfa_pipeline_events" to "anon";
grant truncate on table "public"."rfa_pipeline_events" to "anon";
grant update on table "public"."rfa_pipeline_events" to "anon";
grant delete on table "public"."rfa_pipeline_events" to "authenticated";
grant insert on table "public"."rfa_pipeline_events" to "authenticated";
grant references on table "public"."rfa_pipeline_events" to "authenticated";
grant select on table "public"."rfa_pipeline_events" to "authenticated";
grant trigger on table "public"."rfa_pipeline_events" to "authenticated";
grant truncate on table "public"."rfa_pipeline_events" to "authenticated";
grant update on table "public"."rfa_pipeline_events" to "authenticated";
grant delete on table "public"."rfa_pipeline_events" to "service_role";
grant insert on table "public"."rfa_pipeline_events" to "service_role";
grant references on table "public"."rfa_pipeline_events" to "service_role";
grant select on table "public"."rfa_pipeline_events" to "service_role";
grant trigger on table "public"."rfa_pipeline_events" to "service_role";
grant truncate on table "public"."rfa_pipeline_events" to "service_role";
grant update on table "public"."rfa_pipeline_events" to "service_role";
grant delete on table "public"."rfa_submissions" to "anon";
grant insert on table "public"."rfa_submissions" to "anon";
grant references on table "public"."rfa_submissions" to "anon";
grant select on table "public"."rfa_submissions" to "anon";
grant trigger on table "public"."rfa_submissions" to "anon";
grant truncate on table "public"."rfa_submissions" to "anon";
grant update on table "public"."rfa_submissions" to "anon";
grant delete on table "public"."rfa_submissions" to "authenticated";
grant insert on table "public"."rfa_submissions" to "authenticated";
grant references on table "public"."rfa_submissions" to "authenticated";
grant select on table "public"."rfa_submissions" to "authenticated";
grant trigger on table "public"."rfa_submissions" to "authenticated";
grant truncate on table "public"."rfa_submissions" to "authenticated";
grant update on table "public"."rfa_submissions" to "authenticated";
grant delete on table "public"."rfa_submissions" to "service_role";
grant insert on table "public"."rfa_submissions" to "service_role";
grant references on table "public"."rfa_submissions" to "service_role";
grant select on table "public"."rfa_submissions" to "service_role";
grant trigger on table "public"."rfa_submissions" to "service_role";
grant truncate on table "public"."rfa_submissions" to "service_role";
grant update on table "public"."rfa_submissions" to "service_role";
create policy "Service role full access on pipeline events"
  on "public"."rfa_pipeline_events"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));
create policy "Service role full access on submissions"
  on "public"."rfa_submissions"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));
drop schema if exists "comms";
drop schema if exists "content";
drop schema if exists "core";
drop schema if exists "crm";
drop schema if exists "finance";
drop schema if exists "ops";
drop schema if exists "tracking";
