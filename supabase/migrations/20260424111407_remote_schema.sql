create extension if not exists "pg_trgm" with schema "public";
create type "public"."duel_status" as enum ('pending', 'active', 'completed', 'expired');
create sequence "command_center"."usce_audit_id_seq";
create sequence "command_center"."usce_cron_runs_id_seq";
create sequence "command_center"."usce_dead_letter_id_seq";
drop trigger if exists "trg_command_center_alerts_touch" on "command_center"."alerts";
drop trigger if exists "trg_command_center_email_drafts_touch" on "command_center"."email_drafts";
drop trigger if exists "trg_command_center_events_touch" on "command_center"."events";
drop trigger if exists "trg_command_center_project_integration_event" on "command_center"."events";
drop trigger if exists "trg_command_center_lead_scores_touch" on "command_center"."lead_scores";
drop trigger if exists "trg_command_center_leads_touch" on "command_center"."leads";
drop trigger if exists "trg_command_center_notes_touch" on "command_center"."notes";
drop trigger if exists "trg_command_center_payments_touch" on "command_center"."payments";
drop trigger if exists "trg_command_center_students_touch" on "command_center"."students";
drop trigger if exists "trg_command_center_tasks_touch" on "command_center"."tasks";
drop trigger if exists "trg_mm_te_concern_interpretations_updated_at" on "public"."concern_interpretations";
drop trigger if exists "trg_duel_state_monotonic" on "public"."duel_challenges";
drop trigger if exists "trg_touch_media_playlists_updated_at" on "public"."media_playlists";
drop trigger if exists "trg_touch_media_user_state_updated_at" on "public"."media_user_state";
drop trigger if exists "trg_mm_te_user_profiles_updated_at" on "public"."user_profiles";
drop policy "drill_registry_ready_read" on "public"."drill_registry";
drop policy "drill_registry_control_delete_anon" on "public"."drill_registry_control";
drop policy "drill_registry_control_insert_anon" on "public"."drill_registry_control";
drop policy "drill_registry_control_read_all" on "public"."drill_registry_control";
drop policy "drill_registry_control_update_anon" on "public"."drill_registry_control";
drop policy "menu_categories_delete_anon" on "public"."menu_categories";
drop policy "menu_categories_insert_anon" on "public"."menu_categories";
drop policy "menu_categories_read_all" on "public"."menu_categories";
drop policy "menu_categories_update_anon" on "public"."menu_categories";
drop policy "menu_category_drills_delete_anon" on "public"."menu_category_drills";
drop policy "menu_category_drills_insert_anon" on "public"."menu_category_drills";
drop policy "menu_category_drills_read_all" on "public"."menu_category_drills";
drop policy "menu_category_drills_update_anon" on "public"."menu_category_drills";
drop policy "Service role full access on pipeline events" on "public"."rfa_pipeline_events";
drop policy "Service role full access on submissions" on "public"."rfa_submissions";
revoke select on table "command_center"."alerts" from "service_role";
revoke insert on table "command_center"."email_drafts" from "service_role";
revoke select on table "command_center"."email_drafts" from "service_role";
revoke update on table "command_center"."email_drafts" from "service_role";
revoke insert on table "command_center"."events" from "service_role";
revoke select on table "command_center"."events" from "service_role";
revoke update on table "command_center"."events" from "service_role";
revoke insert on table "command_center"."lead_scores" from "service_role";
revoke select on table "command_center"."lead_scores" from "service_role";
revoke update on table "command_center"."lead_scores" from "service_role";
revoke insert on table "command_center"."leads" from "service_role";
revoke select on table "command_center"."leads" from "service_role";
revoke update on table "command_center"."leads" from "service_role";
revoke insert on table "command_center"."notes" from "service_role";
revoke select on table "command_center"."notes" from "service_role";
revoke insert on table "command_center"."payments" from "service_role";
revoke select on table "command_center"."payments" from "service_role";
revoke update on table "command_center"."payments" from "service_role";
revoke insert on table "command_center"."students" from "service_role";
revoke select on table "command_center"."students" from "service_role";
revoke update on table "command_center"."students" from "service_role";
revoke insert on table "command_center"."tasks" from "service_role";
revoke select on table "command_center"."tasks" from "service_role";
revoke update on table "command_center"."tasks" from "service_role";
revoke delete on table "public"."analytics_events" from "anon";
revoke insert on table "public"."analytics_events" from "anon";
revoke references on table "public"."analytics_events" from "anon";
revoke select on table "public"."analytics_events" from "anon";
revoke trigger on table "public"."analytics_events" from "anon";
revoke truncate on table "public"."analytics_events" from "anon";
revoke update on table "public"."analytics_events" from "anon";
revoke delete on table "public"."analytics_events" from "authenticated";
revoke insert on table "public"."analytics_events" from "authenticated";
revoke references on table "public"."analytics_events" from "authenticated";
revoke select on table "public"."analytics_events" from "authenticated";
revoke trigger on table "public"."analytics_events" from "authenticated";
revoke truncate on table "public"."analytics_events" from "authenticated";
revoke update on table "public"."analytics_events" from "authenticated";
revoke delete on table "public"."analytics_events" from "service_role";
revoke insert on table "public"."analytics_events" from "service_role";
revoke references on table "public"."analytics_events" from "service_role";
revoke select on table "public"."analytics_events" from "service_role";
revoke trigger on table "public"."analytics_events" from "service_role";
revoke truncate on table "public"."analytics_events" from "service_role";
revoke update on table "public"."analytics_events" from "service_role";
revoke delete on table "public"."concern_interpretations" from "anon";
revoke insert on table "public"."concern_interpretations" from "anon";
revoke references on table "public"."concern_interpretations" from "anon";
revoke select on table "public"."concern_interpretations" from "anon";
revoke trigger on table "public"."concern_interpretations" from "anon";
revoke truncate on table "public"."concern_interpretations" from "anon";
revoke update on table "public"."concern_interpretations" from "anon";
revoke delete on table "public"."concern_interpretations" from "authenticated";
revoke insert on table "public"."concern_interpretations" from "authenticated";
revoke references on table "public"."concern_interpretations" from "authenticated";
revoke select on table "public"."concern_interpretations" from "authenticated";
revoke trigger on table "public"."concern_interpretations" from "authenticated";
revoke truncate on table "public"."concern_interpretations" from "authenticated";
revoke update on table "public"."concern_interpretations" from "authenticated";
revoke delete on table "public"."concern_interpretations" from "service_role";
revoke insert on table "public"."concern_interpretations" from "service_role";
revoke references on table "public"."concern_interpretations" from "service_role";
revoke select on table "public"."concern_interpretations" from "service_role";
revoke trigger on table "public"."concern_interpretations" from "service_role";
revoke truncate on table "public"."concern_interpretations" from "service_role";
revoke update on table "public"."concern_interpretations" from "service_role";
revoke delete on table "public"."drill_registry" from "anon";
revoke insert on table "public"."drill_registry" from "anon";
revoke references on table "public"."drill_registry" from "anon";
revoke select on table "public"."drill_registry" from "anon";
revoke trigger on table "public"."drill_registry" from "anon";
revoke truncate on table "public"."drill_registry" from "anon";
revoke update on table "public"."drill_registry" from "anon";
revoke delete on table "public"."drill_registry" from "authenticated";
revoke insert on table "public"."drill_registry" from "authenticated";
revoke references on table "public"."drill_registry" from "authenticated";
revoke select on table "public"."drill_registry" from "authenticated";
revoke trigger on table "public"."drill_registry" from "authenticated";
revoke truncate on table "public"."drill_registry" from "authenticated";
revoke update on table "public"."drill_registry" from "authenticated";
revoke delete on table "public"."drill_registry" from "service_role";
revoke insert on table "public"."drill_registry" from "service_role";
revoke references on table "public"."drill_registry" from "service_role";
revoke select on table "public"."drill_registry" from "service_role";
revoke trigger on table "public"."drill_registry" from "service_role";
revoke truncate on table "public"."drill_registry" from "service_role";
revoke update on table "public"."drill_registry" from "service_role";
revoke delete on table "public"."drill_registry_control" from "anon";
revoke insert on table "public"."drill_registry_control" from "anon";
revoke references on table "public"."drill_registry_control" from "anon";
revoke select on table "public"."drill_registry_control" from "anon";
revoke trigger on table "public"."drill_registry_control" from "anon";
revoke truncate on table "public"."drill_registry_control" from "anon";
revoke update on table "public"."drill_registry_control" from "anon";
revoke delete on table "public"."drill_registry_control" from "authenticated";
revoke insert on table "public"."drill_registry_control" from "authenticated";
revoke references on table "public"."drill_registry_control" from "authenticated";
revoke select on table "public"."drill_registry_control" from "authenticated";
revoke trigger on table "public"."drill_registry_control" from "authenticated";
revoke truncate on table "public"."drill_registry_control" from "authenticated";
revoke update on table "public"."drill_registry_control" from "authenticated";
revoke delete on table "public"."drill_registry_control" from "service_role";
revoke insert on table "public"."drill_registry_control" from "service_role";
revoke references on table "public"."drill_registry_control" from "service_role";
revoke select on table "public"."drill_registry_control" from "service_role";
revoke trigger on table "public"."drill_registry_control" from "service_role";
revoke truncate on table "public"."drill_registry_control" from "service_role";
revoke update on table "public"."drill_registry_control" from "service_role";
revoke delete on table "public"."media_clips" from "anon";
revoke insert on table "public"."media_clips" from "anon";
revoke references on table "public"."media_clips" from "anon";
revoke select on table "public"."media_clips" from "anon";
revoke trigger on table "public"."media_clips" from "anon";
revoke truncate on table "public"."media_clips" from "anon";
revoke update on table "public"."media_clips" from "anon";
revoke delete on table "public"."media_clips" from "authenticated";
revoke insert on table "public"."media_clips" from "authenticated";
revoke references on table "public"."media_clips" from "authenticated";
revoke select on table "public"."media_clips" from "authenticated";
revoke trigger on table "public"."media_clips" from "authenticated";
revoke truncate on table "public"."media_clips" from "authenticated";
revoke update on table "public"."media_clips" from "authenticated";
revoke delete on table "public"."media_clips" from "service_role";
revoke insert on table "public"."media_clips" from "service_role";
revoke references on table "public"."media_clips" from "service_role";
revoke select on table "public"."media_clips" from "service_role";
revoke trigger on table "public"."media_clips" from "service_role";
revoke truncate on table "public"."media_clips" from "service_role";
revoke update on table "public"."media_clips" from "service_role";
revoke delete on table "public"."media_playlist_items" from "anon";
revoke insert on table "public"."media_playlist_items" from "anon";
revoke references on table "public"."media_playlist_items" from "anon";
revoke select on table "public"."media_playlist_items" from "anon";
revoke trigger on table "public"."media_playlist_items" from "anon";
revoke truncate on table "public"."media_playlist_items" from "anon";
revoke update on table "public"."media_playlist_items" from "anon";
revoke delete on table "public"."media_playlist_items" from "authenticated";
revoke insert on table "public"."media_playlist_items" from "authenticated";
revoke references on table "public"."media_playlist_items" from "authenticated";
revoke select on table "public"."media_playlist_items" from "authenticated";
revoke trigger on table "public"."media_playlist_items" from "authenticated";
revoke truncate on table "public"."media_playlist_items" from "authenticated";
revoke update on table "public"."media_playlist_items" from "authenticated";
revoke delete on table "public"."media_playlist_items" from "service_role";
revoke insert on table "public"."media_playlist_items" from "service_role";
revoke references on table "public"."media_playlist_items" from "service_role";
revoke select on table "public"."media_playlist_items" from "service_role";
revoke trigger on table "public"."media_playlist_items" from "service_role";
revoke truncate on table "public"."media_playlist_items" from "service_role";
revoke update on table "public"."media_playlist_items" from "service_role";
revoke delete on table "public"."media_playlists" from "anon";
revoke insert on table "public"."media_playlists" from "anon";
revoke references on table "public"."media_playlists" from "anon";
revoke select on table "public"."media_playlists" from "anon";
revoke trigger on table "public"."media_playlists" from "anon";
revoke truncate on table "public"."media_playlists" from "anon";
revoke update on table "public"."media_playlists" from "anon";
revoke delete on table "public"."media_playlists" from "authenticated";
revoke insert on table "public"."media_playlists" from "authenticated";
revoke references on table "public"."media_playlists" from "authenticated";
revoke select on table "public"."media_playlists" from "authenticated";
revoke trigger on table "public"."media_playlists" from "authenticated";
revoke truncate on table "public"."media_playlists" from "authenticated";
revoke update on table "public"."media_playlists" from "authenticated";
revoke delete on table "public"."media_playlists" from "service_role";
revoke insert on table "public"."media_playlists" from "service_role";
revoke references on table "public"."media_playlists" from "service_role";
revoke select on table "public"."media_playlists" from "service_role";
revoke trigger on table "public"."media_playlists" from "service_role";
revoke truncate on table "public"."media_playlists" from "service_role";
revoke update on table "public"."media_playlists" from "service_role";
revoke delete on table "public"."media_tags" from "anon";
revoke insert on table "public"."media_tags" from "anon";
revoke references on table "public"."media_tags" from "anon";
revoke select on table "public"."media_tags" from "anon";
revoke trigger on table "public"."media_tags" from "anon";
revoke truncate on table "public"."media_tags" from "anon";
revoke update on table "public"."media_tags" from "anon";
revoke delete on table "public"."media_tags" from "authenticated";
revoke insert on table "public"."media_tags" from "authenticated";
revoke references on table "public"."media_tags" from "authenticated";
revoke select on table "public"."media_tags" from "authenticated";
revoke trigger on table "public"."media_tags" from "authenticated";
revoke truncate on table "public"."media_tags" from "authenticated";
revoke update on table "public"."media_tags" from "authenticated";
revoke delete on table "public"."media_tags" from "service_role";
revoke insert on table "public"."media_tags" from "service_role";
revoke references on table "public"."media_tags" from "service_role";
revoke select on table "public"."media_tags" from "service_role";
revoke trigger on table "public"."media_tags" from "service_role";
revoke truncate on table "public"."media_tags" from "service_role";
revoke update on table "public"."media_tags" from "service_role";
revoke delete on table "public"."media_transcript_chunks" from "anon";
revoke insert on table "public"."media_transcript_chunks" from "anon";
revoke references on table "public"."media_transcript_chunks" from "anon";
revoke select on table "public"."media_transcript_chunks" from "anon";
revoke trigger on table "public"."media_transcript_chunks" from "anon";
revoke truncate on table "public"."media_transcript_chunks" from "anon";
revoke update on table "public"."media_transcript_chunks" from "anon";
revoke delete on table "public"."media_transcript_chunks" from "authenticated";
revoke insert on table "public"."media_transcript_chunks" from "authenticated";
revoke references on table "public"."media_transcript_chunks" from "authenticated";
revoke select on table "public"."media_transcript_chunks" from "authenticated";
revoke trigger on table "public"."media_transcript_chunks" from "authenticated";
revoke truncate on table "public"."media_transcript_chunks" from "authenticated";
revoke update on table "public"."media_transcript_chunks" from "authenticated";
revoke delete on table "public"."media_transcript_chunks" from "service_role";
revoke insert on table "public"."media_transcript_chunks" from "service_role";
revoke references on table "public"."media_transcript_chunks" from "service_role";
revoke select on table "public"."media_transcript_chunks" from "service_role";
revoke trigger on table "public"."media_transcript_chunks" from "service_role";
revoke truncate on table "public"."media_transcript_chunks" from "service_role";
revoke update on table "public"."media_transcript_chunks" from "service_role";
revoke delete on table "public"."media_user_state" from "anon";
revoke insert on table "public"."media_user_state" from "anon";
revoke references on table "public"."media_user_state" from "anon";
revoke select on table "public"."media_user_state" from "anon";
revoke trigger on table "public"."media_user_state" from "anon";
revoke truncate on table "public"."media_user_state" from "anon";
revoke update on table "public"."media_user_state" from "anon";
revoke delete on table "public"."media_user_state" from "authenticated";
revoke insert on table "public"."media_user_state" from "authenticated";
revoke references on table "public"."media_user_state" from "authenticated";
revoke select on table "public"."media_user_state" from "authenticated";
revoke trigger on table "public"."media_user_state" from "authenticated";
revoke truncate on table "public"."media_user_state" from "authenticated";
revoke update on table "public"."media_user_state" from "authenticated";
revoke delete on table "public"."media_user_state" from "service_role";
revoke insert on table "public"."media_user_state" from "service_role";
revoke references on table "public"."media_user_state" from "service_role";
revoke select on table "public"."media_user_state" from "service_role";
revoke trigger on table "public"."media_user_state" from "service_role";
revoke truncate on table "public"."media_user_state" from "service_role";
revoke update on table "public"."media_user_state" from "service_role";
revoke delete on table "public"."media_user_video_tags" from "anon";
revoke insert on table "public"."media_user_video_tags" from "anon";
revoke references on table "public"."media_user_video_tags" from "anon";
revoke select on table "public"."media_user_video_tags" from "anon";
revoke trigger on table "public"."media_user_video_tags" from "anon";
revoke truncate on table "public"."media_user_video_tags" from "anon";
revoke update on table "public"."media_user_video_tags" from "anon";
revoke delete on table "public"."media_user_video_tags" from "authenticated";
revoke insert on table "public"."media_user_video_tags" from "authenticated";
revoke references on table "public"."media_user_video_tags" from "authenticated";
revoke select on table "public"."media_user_video_tags" from "authenticated";
revoke trigger on table "public"."media_user_video_tags" from "authenticated";
revoke truncate on table "public"."media_user_video_tags" from "authenticated";
revoke update on table "public"."media_user_video_tags" from "authenticated";
revoke delete on table "public"."media_user_video_tags" from "service_role";
revoke insert on table "public"."media_user_video_tags" from "service_role";
revoke references on table "public"."media_user_video_tags" from "service_role";
revoke select on table "public"."media_user_video_tags" from "service_role";
revoke trigger on table "public"."media_user_video_tags" from "service_role";
revoke truncate on table "public"."media_user_video_tags" from "service_role";
revoke update on table "public"."media_user_video_tags" from "service_role";
revoke delete on table "public"."media_video_tags" from "anon";
revoke insert on table "public"."media_video_tags" from "anon";
revoke references on table "public"."media_video_tags" from "anon";
revoke select on table "public"."media_video_tags" from "anon";
revoke trigger on table "public"."media_video_tags" from "anon";
revoke truncate on table "public"."media_video_tags" from "anon";
revoke update on table "public"."media_video_tags" from "anon";
revoke delete on table "public"."media_video_tags" from "authenticated";
revoke insert on table "public"."media_video_tags" from "authenticated";
revoke references on table "public"."media_video_tags" from "authenticated";
revoke select on table "public"."media_video_tags" from "authenticated";
revoke trigger on table "public"."media_video_tags" from "authenticated";
revoke truncate on table "public"."media_video_tags" from "authenticated";
revoke update on table "public"."media_video_tags" from "authenticated";
revoke delete on table "public"."media_video_tags" from "service_role";
revoke insert on table "public"."media_video_tags" from "service_role";
revoke references on table "public"."media_video_tags" from "service_role";
revoke select on table "public"."media_video_tags" from "service_role";
revoke trigger on table "public"."media_video_tags" from "service_role";
revoke truncate on table "public"."media_video_tags" from "service_role";
revoke update on table "public"."media_video_tags" from "service_role";
revoke delete on table "public"."menu_categories" from "anon";
revoke insert on table "public"."menu_categories" from "anon";
revoke references on table "public"."menu_categories" from "anon";
revoke select on table "public"."menu_categories" from "anon";
revoke trigger on table "public"."menu_categories" from "anon";
revoke truncate on table "public"."menu_categories" from "anon";
revoke update on table "public"."menu_categories" from "anon";
revoke delete on table "public"."menu_categories" from "authenticated";
revoke insert on table "public"."menu_categories" from "authenticated";
revoke references on table "public"."menu_categories" from "authenticated";
revoke select on table "public"."menu_categories" from "authenticated";
revoke trigger on table "public"."menu_categories" from "authenticated";
revoke truncate on table "public"."menu_categories" from "authenticated";
revoke update on table "public"."menu_categories" from "authenticated";
revoke delete on table "public"."menu_categories" from "service_role";
revoke insert on table "public"."menu_categories" from "service_role";
revoke references on table "public"."menu_categories" from "service_role";
revoke select on table "public"."menu_categories" from "service_role";
revoke trigger on table "public"."menu_categories" from "service_role";
revoke truncate on table "public"."menu_categories" from "service_role";
revoke update on table "public"."menu_categories" from "service_role";
revoke delete on table "public"."menu_category_drills" from "anon";
revoke insert on table "public"."menu_category_drills" from "anon";
revoke references on table "public"."menu_category_drills" from "anon";
revoke select on table "public"."menu_category_drills" from "anon";
revoke trigger on table "public"."menu_category_drills" from "anon";
revoke truncate on table "public"."menu_category_drills" from "anon";
revoke update on table "public"."menu_category_drills" from "anon";
revoke delete on table "public"."menu_category_drills" from "authenticated";
revoke insert on table "public"."menu_category_drills" from "authenticated";
revoke references on table "public"."menu_category_drills" from "authenticated";
revoke select on table "public"."menu_category_drills" from "authenticated";
revoke trigger on table "public"."menu_category_drills" from "authenticated";
revoke truncate on table "public"."menu_category_drills" from "authenticated";
revoke update on table "public"."menu_category_drills" from "authenticated";
revoke delete on table "public"."menu_category_drills" from "service_role";
revoke insert on table "public"."menu_category_drills" from "service_role";
revoke references on table "public"."menu_category_drills" from "service_role";
revoke select on table "public"."menu_category_drills" from "service_role";
revoke trigger on table "public"."menu_category_drills" from "service_role";
revoke truncate on table "public"."menu_category_drills" from "service_role";
revoke update on table "public"."menu_category_drills" from "service_role";
revoke delete on table "public"."rfa_pipeline_events" from "anon";
revoke insert on table "public"."rfa_pipeline_events" from "anon";
revoke references on table "public"."rfa_pipeline_events" from "anon";
revoke select on table "public"."rfa_pipeline_events" from "anon";
revoke trigger on table "public"."rfa_pipeline_events" from "anon";
revoke truncate on table "public"."rfa_pipeline_events" from "anon";
revoke update on table "public"."rfa_pipeline_events" from "anon";
revoke delete on table "public"."rfa_pipeline_events" from "authenticated";
revoke insert on table "public"."rfa_pipeline_events" from "authenticated";
revoke references on table "public"."rfa_pipeline_events" from "authenticated";
revoke select on table "public"."rfa_pipeline_events" from "authenticated";
revoke trigger on table "public"."rfa_pipeline_events" from "authenticated";
revoke truncate on table "public"."rfa_pipeline_events" from "authenticated";
revoke update on table "public"."rfa_pipeline_events" from "authenticated";
revoke delete on table "public"."rfa_pipeline_events" from "service_role";
revoke insert on table "public"."rfa_pipeline_events" from "service_role";
revoke references on table "public"."rfa_pipeline_events" from "service_role";
revoke select on table "public"."rfa_pipeline_events" from "service_role";
revoke trigger on table "public"."rfa_pipeline_events" from "service_role";
revoke truncate on table "public"."rfa_pipeline_events" from "service_role";
revoke update on table "public"."rfa_pipeline_events" from "service_role";
revoke delete on table "public"."rfa_submissions" from "anon";
revoke insert on table "public"."rfa_submissions" from "anon";
revoke references on table "public"."rfa_submissions" from "anon";
revoke select on table "public"."rfa_submissions" from "anon";
revoke trigger on table "public"."rfa_submissions" from "anon";
revoke truncate on table "public"."rfa_submissions" from "anon";
revoke update on table "public"."rfa_submissions" from "anon";
revoke delete on table "public"."rfa_submissions" from "authenticated";
revoke insert on table "public"."rfa_submissions" from "authenticated";
revoke references on table "public"."rfa_submissions" from "authenticated";
revoke select on table "public"."rfa_submissions" from "authenticated";
revoke trigger on table "public"."rfa_submissions" from "authenticated";
revoke truncate on table "public"."rfa_submissions" from "authenticated";
revoke update on table "public"."rfa_submissions" from "authenticated";
revoke delete on table "public"."rfa_submissions" from "service_role";
revoke insert on table "public"."rfa_submissions" from "service_role";
revoke references on table "public"."rfa_submissions" from "service_role";
revoke select on table "public"."rfa_submissions" from "service_role";
revoke trigger on table "public"."rfa_submissions" from "service_role";
revoke truncate on table "public"."rfa_submissions" from "service_role";
revoke update on table "public"."rfa_submissions" from "service_role";
revoke delete on table "public"."user_profiles" from "anon";
revoke insert on table "public"."user_profiles" from "anon";
revoke references on table "public"."user_profiles" from "anon";
revoke select on table "public"."user_profiles" from "anon";
revoke trigger on table "public"."user_profiles" from "anon";
revoke truncate on table "public"."user_profiles" from "anon";
revoke update on table "public"."user_profiles" from "anon";
revoke delete on table "public"."user_profiles" from "authenticated";
revoke insert on table "public"."user_profiles" from "authenticated";
revoke references on table "public"."user_profiles" from "authenticated";
revoke select on table "public"."user_profiles" from "authenticated";
revoke trigger on table "public"."user_profiles" from "authenticated";
revoke truncate on table "public"."user_profiles" from "authenticated";
revoke update on table "public"."user_profiles" from "authenticated";
revoke delete on table "public"."user_profiles" from "service_role";
revoke insert on table "public"."user_profiles" from "service_role";
revoke references on table "public"."user_profiles" from "service_role";
revoke select on table "public"."user_profiles" from "service_role";
revoke trigger on table "public"."user_profiles" from "service_role";
revoke truncate on table "public"."user_profiles" from "service_role";
revoke update on table "public"."user_profiles" from "service_role";
alter table "command_center"."alerts" drop constraint "alerts_alert_status_check";
alter table "command_center"."alerts" drop constraint "alerts_assigned_to_check";
alter table "command_center"."alerts" drop constraint "alerts_check";
alter table "command_center"."alerts" drop constraint "alerts_lead_id_fkey";
alter table "command_center"."alerts" drop constraint "alerts_severity_check";
alter table "command_center"."alerts" drop constraint "alerts_source_event_id_fkey";
alter table "command_center"."alerts" drop constraint "alerts_student_id_fkey";
alter table "command_center"."alerts" drop constraint "alerts_task_id_fkey";
alter table "command_center"."email_drafts" drop constraint "email_drafts_ai_confidence_check";
alter table "command_center"."email_drafts" drop constraint "email_drafts_assigned_to_check";
alter table "command_center"."email_drafts" drop constraint "email_drafts_check";
alter table "command_center"."email_drafts" drop constraint "email_drafts_draft_status_check";
alter table "command_center"."email_drafts" drop constraint "email_drafts_lead_id_fkey";
alter table "command_center"."email_drafts" drop constraint "email_drafts_source_event_id_fkey";
alter table "command_center"."email_drafts" drop constraint "email_drafts_student_id_fkey";
alter table "command_center"."events" drop constraint "events_aggregate_type_check";
alter table "command_center"."events" drop constraint "events_causation_event_id_fkey";
alter table "command_center"."events" drop constraint "events_check";
alter table "command_center"."events" drop constraint "events_event_family_check";
alter table "command_center"."events" drop constraint "events_lead_id_fkey";
alter table "command_center"."events" drop constraint "events_student_id_fkey";
alter table "command_center"."lead_scores" drop constraint "lead_scores_confidence_check";
alter table "command_center"."lead_scores" drop constraint "lead_scores_lead_id_fkey";
alter table "command_center"."lead_scores" drop constraint "lead_scores_score_check";
alter table "command_center"."lead_scores" drop constraint "lead_scores_source_event_id_fkey";
alter table "command_center"."leads" drop constraint "leads_assigned_to_check";
alter table "command_center"."leads" drop constraint "leads_funnel_stage_check";
alter table "command_center"."leads" drop constraint "leads_lead_status_check";
alter table "command_center"."notes" drop constraint "notes_author_check";
alter table "command_center"."notes" drop constraint "notes_check";
alter table "command_center"."notes" drop constraint "notes_lead_id_fkey";
alter table "command_center"."notes" drop constraint "notes_note_kind_check";
alter table "command_center"."notes" drop constraint "notes_source_event_id_fkey";
alter table "command_center"."notes" drop constraint "notes_student_id_fkey";
alter table "command_center"."payments" drop constraint "payments_assigned_to_check";
alter table "command_center"."payments" drop constraint "payments_check";
alter table "command_center"."payments" drop constraint "payments_lead_id_fkey";
alter table "command_center"."payments" drop constraint "payments_payment_status_check";
alter table "command_center"."payments" drop constraint "payments_payment_type_check";
alter table "command_center"."payments" drop constraint "payments_processor_name_check";
alter table "command_center"."payments" drop constraint "payments_source_event_id_fkey";
alter table "command_center"."payments" drop constraint "payments_student_id_fkey";
alter table "command_center"."students" drop constraint "students_assigned_to_check";
alter table "command_center"."students" drop constraint "students_funnel_stage_check";
alter table "command_center"."students" drop constraint "students_originating_lead_id_fkey";
alter table "command_center"."students" drop constraint "students_program_tier_check";
alter table "command_center"."students" drop constraint "students_risk_level_check";
alter table "command_center"."students" drop constraint "students_student_status_check";
alter table "command_center"."tasks" drop constraint "tasks_assigned_to_check";
alter table "command_center"."tasks" drop constraint "tasks_check";
alter table "command_center"."tasks" drop constraint "tasks_lead_id_fkey";
alter table "command_center"."tasks" drop constraint "tasks_priority_check";
alter table "command_center"."tasks" drop constraint "tasks_source_event_id_fkey";
alter table "command_center"."tasks" drop constraint "tasks_student_id_fkey";
alter table "command_center"."tasks" drop constraint "tasks_task_status_check";
alter table "public"."analytics_events" drop constraint "analytics_events_event_data_check";
alter table "public"."analytics_events" drop constraint "analytics_events_event_type_check";
alter table "public"."analytics_events" drop constraint "analytics_events_user_profile_id_fkey";
alter table "public"."concern_interpretations" drop constraint "concern_interpretations_compound_modifier_check";
alter table "public"."concern_interpretations" drop constraint "concern_interpretations_concern_key_severity_band_key";
alter table "public"."concern_interpretations" drop constraint "concern_interpretations_display_order_check";
alter table "public"."concern_interpretations" drop constraint "concern_interpretations_severity_band_check";
alter table "public"."drill_registry" drop constraint "drill_registry_stream_uid_key";
alter table "public"."drill_registry_control" drop constraint "drill_registry_control_video_id_key";
alter table "public"."media_clips" drop constraint "media_clips_time_check";
alter table "public"."media_playlist_items" drop constraint "media_playlist_items_playlist_id_fkey";
alter table "public"."media_tags" drop constraint "media_tags_type_check";
alter table "public"."media_user_state" drop constraint "media_user_state_rating_check";
alter table "public"."media_video_tags" drop constraint "media_video_tags_tag_id_fkey";
alter table "public"."menu_categories" drop constraint "menu_categories_slug_unique";
alter table "public"."menu_category_drills" drop constraint "menu_category_drills_category_id_fkey";
alter table "public"."menu_category_drills" drop constraint "menu_category_drills_category_video_unique";
alter table "public"."rfa_pipeline_events" drop constraint "rfa_pipeline_events_risk_level_check";
alter table "public"."rfa_pipeline_events" drop constraint "rfa_pipeline_events_trigger_type_check";
alter table "public"."rfa_submissions" drop constraint "rfa_submissions_risk_level_check";
alter table "public"."rfa_submissions" drop constraint "rfa_submissions_status_check";
alter table "public"."user_profiles" drop constraint "user_profiles_computed_profile_tier_check";
alter table "public"."user_profiles" drop constraint "user_profiles_computed_severity_check";
alter table "public"."user_profiles" drop constraint "user_profiles_conversion_status_check";
alter table "public"."user_profiles" drop constraint "user_profiles_exam_attempts_check";
alter table "public"."user_profiles" drop constraint "user_profiles_metadata_check";
alter table "public"."user_profiles" drop constraint "user_profiles_step1_status_check";
alter table "public"."user_profiles" drop constraint "user_profiles_step2_ck_score_check";
alter table "public"."user_profiles" drop constraint "user_profiles_step3_status_check";
alter table "public"."user_profiles" drop constraint "user_profiles_usce_duration_check";
alter table "public"."user_profiles" drop constraint "user_profiles_usce_type_check";
alter table "public"."user_profiles" drop constraint "user_profiles_visa_status_check";
alter table "public"."user_profiles" drop constraint "user_profiles_visit_count_check";
alter table "public"."user_profiles" drop constraint "user_profiles_yog_check";
alter table "public"."duel_challenges" drop constraint "duel_challenges_state_canonical_ck";
alter table "public"."match_attempts" drop constraint "match_attempts_match_id_fkey";
alter table "public"."question_attempts" drop constraint "question_attempts_match_id_fkey";
drop function if exists "command_center"."append_event"(p_event_type text, p_source_system text, p_aggregate_type text, p_aggregate_id uuid, p_lead_id uuid, p_student_id uuid, p_event_family text, p_external_event_id text, p_source_record_id text, p_dedupe_key text, p_correlation_id text, p_causation_event_id uuid, p_payload jsonb, p_occurred_at timestamp with time zone);
drop function if exists "command_center"."backfill_email_record"(p_payload jsonb);
drop function if exists "command_center"."backfill_lead"(p_payload jsonb);
drop function if exists "command_center"."backfill_lead_score"(p_payload jsonb);
drop function if exists "command_center"."backfill_payment"(p_payload jsonb);
drop function if exists "command_center"."backfill_student"(p_payload jsonb);
drop view if exists "command_center"."email_queue_v1";
drop function if exists "command_center"."ingest_gmail_draft"(p_payload jsonb);
drop function if exists "command_center"."ingest_gmail_message"(p_payload jsonb);
drop function if exists "command_center"."ingest_learndash_event"(p_payload jsonb);
drop function if exists "command_center"."ingest_stripe_event"(p_payload jsonb);
drop function if exists "command_center"."normalize_assigned_to"(p_value text, p_default text);
drop function if exists "command_center"."normalize_draft_status"(p_value text, p_default text);
drop function if exists "command_center"."normalize_lead_funnel_stage"(p_value text, p_default text);
drop function if exists "command_center"."normalize_lead_status"(p_value text, p_default text);
drop function if exists "command_center"."normalize_payment_status"(p_value text, p_default text);
drop function if exists "command_center"."normalize_payment_type"(p_value text, p_default text);
drop function if exists "command_center"."normalize_program_tier"(p_value text, p_default text);
drop function if exists "command_center"."normalize_risk_level"(p_value text, p_default text);
drop function if exists "command_center"."normalize_student_funnel_stage"(p_value text, p_default text);
drop function if exists "command_center"."normalize_student_status"(p_value text, p_default text);
drop view if exists "command_center"."payment_feed_v1";
drop function if exists "command_center"."project_integration_event"();
drop function if exists "command_center"."resolve_anchor"(p_email text, p_wordpress_user_id text, p_source_record_id text);
drop view if exists "command_center"."student_directory_v1";
drop view if exists "command_center"."student_profile_v1";
drop view if exists "command_center"."task_queue_v1";
drop function if exists "command_center"."touch_record"();
drop function if exists "public"."duel_state_monotonic_fn"();
drop function if exists "public"."match_media_transcript_chunks"(query_embedding public.vector, match_count integer);
drop function if exists "public"."mm_te_set_updated_at"();
drop function if exists "public"."mmac_cc_create_email_draft"(p_payload jsonb);
drop function if exists "public"."mmac_cc_create_lead"(p_payload jsonb);
drop function if exists "public"."mmac_cc_create_note"(p_student_id uuid, p_content text, p_author text, p_note_kind text, p_pinned boolean);
drop function if exists "public"."mmac_cc_create_payment"(p_payload jsonb);
drop function if exists "public"."mmac_cc_create_student"(p_payload jsonb);
drop function if exists "public"."mmac_cc_create_task"(p_student_id uuid, p_title text, p_description text, p_assigned_to text, p_created_by text, p_priority integer, p_due_at timestamp with time zone);
drop function if exists "public"."mmac_cc_create_task_linked"(p_student_id uuid, p_lead_id uuid, p_title text, p_description text, p_assigned_to text, p_created_by text, p_priority integer, p_due_at timestamp with time zone, p_source_system text, p_source_record_id text, p_metadata jsonb);
drop function if exists "public"."mmac_cc_delete_email_draft"(p_email_draft_id uuid);
drop function if exists "public"."mmac_cc_delete_lead"(p_lead_id uuid);
drop function if exists "public"."mmac_cc_delete_payment"(p_payment_id uuid);
drop function if exists "public"."mmac_cc_delete_student"(p_student_id uuid);
drop function if exists "public"."mmac_cc_get_student_detail"(p_student_id uuid);
drop function if exists "public"."mmac_cc_list_email_queue"(p_assigned_to text, p_limit integer);
drop function if exists "public"."mmac_cc_list_emails"(p_student_id uuid);
drop function if exists "public"."mmac_cc_list_leads"(p_assigned_to text, p_limit integer);
drop function if exists "public"."mmac_cc_list_payments"(p_student_id uuid);
drop function if exists "public"."mmac_cc_list_students"(p_search text, p_status text, p_assigned_to text);
drop function if exists "public"."mmac_cc_list_tasks"(p_student_id uuid, p_status text, p_assigned_to text);
drop function if exists "public"."mmac_cc_update_email_draft"(p_email_draft_id uuid, p_payload jsonb);
drop function if exists "public"."mmac_cc_update_lead"(p_lead_id uuid, p_payload jsonb);
drop function if exists "public"."mmac_cc_update_payment"(p_payment_id uuid, p_payload jsonb);
drop function if exists "public"."mmac_cc_update_student"(p_student_id uuid, p_payload jsonb);
drop function if exists "public"."mmac_cc_update_task"(p_task_id uuid, p_task_status text, p_assigned_to text, p_priority integer);
drop function if exists "public"."mmac_command_center_backfill_email_queue"(p_payloads jsonb);
drop function if exists "public"."mmac_command_center_backfill_lead_scores"(p_payloads jsonb);
drop function if exists "public"."mmac_command_center_backfill_leads"(p_payloads jsonb);
drop function if exists "public"."mmac_command_center_backfill_payments"(p_payloads jsonb);
drop function if exists "public"."mmac_command_center_backfill_students"(p_payloads jsonb);
drop function if exists "public"."mmac_command_center_ingest_gmail_draft"(p_payload jsonb);
drop function if exists "public"."mmac_command_center_ingest_gmail_message"(p_payload jsonb);
drop function if exists "public"."mmac_command_center_ingest_learndash_event"(p_payload jsonb);
drop function if exists "public"."mmac_command_center_ingest_stripe_event"(p_payload jsonb);
drop view if exists "public"."rfa_conversion_funnel";
drop view if exists "public"."rfa_daily_summary";
drop view if exists "public"."rfa_failed_submissions";
drop view if exists "public"."rfa_flag_frequency";
drop view if exists "public"."rfa_pipeline_velocity";
drop view if exists "public"."rfa_system_health";
drop view if exists "public"."rfa_weekly_summary";
drop function if exists "public"."touch_media_updated_at"();
drop view if exists "command_center"."latest_lead_scores_v1";
alter table "command_center"."alerts" drop constraint "alerts_pkey";
alter table "command_center"."email_drafts" drop constraint "email_drafts_pkey";
alter table "command_center"."events" drop constraint "events_pkey";
alter table "command_center"."lead_scores" drop constraint "lead_scores_pkey";
alter table "command_center"."leads" drop constraint "leads_pkey";
alter table "command_center"."notes" drop constraint "notes_pkey";
alter table "command_center"."payments" drop constraint "payments_pkey";
alter table "command_center"."students" drop constraint "students_pkey";
alter table "command_center"."tasks" drop constraint "tasks_pkey";
alter table "public"."analytics_events" drop constraint "analytics_events_pkey";
alter table "public"."concern_interpretations" drop constraint "concern_interpretations_pkey";
alter table "public"."drill_registry" drop constraint "drill_registry_pkey";
alter table "public"."drill_registry_control" drop constraint "drill_registry_control_pkey";
alter table "public"."media_clips" drop constraint "media_clips_pkey";
alter table "public"."media_playlist_items" drop constraint "media_playlist_items_pkey";
alter table "public"."media_playlists" drop constraint "media_playlists_pkey";
alter table "public"."media_tags" drop constraint "media_tags_pkey";
alter table "public"."media_transcript_chunks" drop constraint "media_transcript_chunks_pkey";
alter table "public"."media_user_state" drop constraint "media_user_state_pkey";
alter table "public"."media_user_video_tags" drop constraint "media_user_video_tags_pkey";
alter table "public"."media_video_tags" drop constraint "media_video_tags_pkey";
alter table "public"."menu_categories" drop constraint "menu_categories_pkey";
alter table "public"."menu_category_drills" drop constraint "menu_category_drills_pkey";
alter table "public"."rfa_pipeline_events" drop constraint "rfa_pipeline_events_pkey";
alter table "public"."rfa_submissions" drop constraint "rfa_submissions_pkey";
alter table "public"."user_profiles" drop constraint "user_profiles_pkey";
drop index if exists "command_center"."alerts_pkey";
drop index if exists "command_center"."email_drafts_pkey";
drop index if exists "command_center"."events_pkey";
drop index if exists "command_center"."idx_command_center_alerts_assignee";
drop index if exists "command_center"."idx_command_center_alerts_lead";
drop index if exists "command_center"."idx_command_center_alerts_student";
drop index if exists "command_center"."idx_command_center_email_drafts_queue";
drop index if exists "command_center"."idx_command_center_email_drafts_student";
drop index if exists "command_center"."idx_command_center_events_lead";
drop index if exists "command_center"."idx_command_center_events_student";
drop index if exists "command_center"."idx_command_center_events_type";
drop index if exists "command_center"."idx_command_center_lead_scores_latest";
drop index if exists "command_center"."idx_command_center_leads_assignment";
drop index if exists "command_center"."idx_command_center_leads_engagement";
drop index if exists "command_center"."idx_command_center_notes_lead";
drop index if exists "command_center"."idx_command_center_notes_pinned";
drop index if exists "command_center"."idx_command_center_notes_student";
drop index if exists "command_center"."idx_command_center_payments_lead";
drop index if exists "command_center"."idx_command_center_payments_status";
drop index if exists "command_center"."idx_command_center_payments_student";
drop index if exists "command_center"."idx_command_center_students_assignment";
drop index if exists "command_center"."idx_command_center_students_risk";
drop index if exists "command_center"."idx_command_center_tasks_assignee";
drop index if exists "command_center"."idx_command_center_tasks_lead";
drop index if exists "command_center"."idx_command_center_tasks_student";
drop index if exists "command_center"."lead_scores_pkey";
drop index if exists "command_center"."leads_pkey";
drop index if exists "command_center"."notes_pkey";
drop index if exists "command_center"."payments_pkey";
drop index if exists "command_center"."students_pkey";
drop index if exists "command_center"."tasks_pkey";
drop index if exists "command_center"."ux_command_center_alerts_open_dedupe";
drop index if exists "command_center"."ux_command_center_alerts_source_record";
drop index if exists "command_center"."ux_command_center_email_drafts_source_record";
drop index if exists "command_center"."ux_command_center_events_dedupe";
drop index if exists "command_center"."ux_command_center_events_external";
drop index if exists "command_center"."ux_command_center_lead_scores_source_record";
drop index if exists "command_center"."ux_command_center_leads_email";
drop index if exists "command_center"."ux_command_center_leads_source_record";
drop index if exists "command_center"."ux_command_center_notes_source_record";
drop index if exists "command_center"."ux_command_center_payments_processor";
drop index if exists "command_center"."ux_command_center_payments_source_record";
drop index if exists "command_center"."ux_command_center_students_email";
drop index if exists "command_center"."ux_command_center_students_originating_lead";
drop index if exists "command_center"."ux_command_center_students_source_record";
drop index if exists "command_center"."ux_command_center_tasks_source_record";
drop index if exists "public"."analytics_events_pkey";
drop index if exists "public"."concern_interpretations_concern_key_severity_band_key";
drop index if exists "public"."concern_interpretations_pkey";
drop index if exists "public"."drill_registry_control_pkey";
drop index if exists "public"."drill_registry_control_video_id_key";
drop index if exists "public"."drill_registry_pkey";
drop index if exists "public"."drill_registry_stream_uid_key";
drop index if exists "public"."duel_attempts_idem_uk";
drop index if exists "public"."idx_drill_registry_control_active";
drop index if exists "public"."idx_drill_registry_status";
drop index if exists "public"."idx_media_clips_creator_created";
drop index if exists "public"."idx_media_clips_video";
drop index if exists "public"."idx_media_playlist_items_playlist";
drop index if exists "public"."idx_media_playlists_user_updated";
drop index if exists "public"."idx_media_transcript_chunks_embedding";
drop index if exists "public"."idx_media_transcript_chunks_video_id";
drop index if exists "public"."idx_media_user_state_user_updated";
drop index if exists "public"."idx_media_user_state_video";
drop index if exists "public"."idx_media_user_video_tags_user_video";
drop index if exists "public"."idx_media_video_tags_video";
drop index if exists "public"."idx_menu_categories_sort_order";
drop index if exists "public"."idx_menu_category_drills_category_id";
drop index if exists "public"."idx_menu_category_drills_video_id";
drop index if exists "public"."idx_mm_te_analytics_events_event_type";
drop index if exists "public"."idx_mm_te_analytics_events_occurred_at";
drop index if exists "public"."idx_mm_te_analytics_events_session_id";
drop index if exists "public"."idx_mm_te_analytics_events_user_profile_id";
drop index if exists "public"."idx_mm_te_concern_interpretations_key_active";
drop index if exists "public"."idx_mm_te_user_profiles_conversion_status";
drop index if exists "public"."idx_mm_te_user_profiles_email";
drop index if exists "public"."idx_mm_te_user_profiles_profile_tier";
drop index if exists "public"."idx_mm_te_user_profiles_session_id_unique";
drop index if exists "public"."idx_rfa_pipe_created";
drop index if exists "public"."idx_rfa_pipe_deal";
drop index if exists "public"."idx_rfa_pipe_email";
drop index if exists "public"."idx_rfa_pipe_to_stage";
drop index if exists "public"."idx_rfa_sub_ac_contact";
drop index if exists "public"."idx_rfa_sub_created";
drop index if exists "public"."idx_rfa_sub_email";
drop index if exists "public"."idx_rfa_sub_risk";
drop index if exists "public"."idx_rfa_sub_status";
drop index if exists "public"."media_clips_pkey";
drop index if exists "public"."media_playlist_items_pkey";
drop index if exists "public"."media_playlists_pkey";
drop index if exists "public"."media_tags_pkey";
drop index if exists "public"."media_transcript_chunks_pkey";
drop index if exists "public"."media_user_state_pkey";
drop index if exists "public"."media_user_video_tags_pkey";
drop index if exists "public"."media_video_tags_pkey";
drop index if exists "public"."menu_categories_pkey";
drop index if exists "public"."menu_categories_slug_unique";
drop index if exists "public"."menu_category_drills_category_video_unique";
drop index if exists "public"."menu_category_drills_pkey";
drop index if exists "public"."rfa_pipeline_events_pkey";
drop index if exists "public"."rfa_submissions_pkey";
drop index if exists "public"."uq_media_tags_name_type";
drop index if exists "public"."user_profiles_pkey";
drop table "command_center"."alerts";
drop table "command_center"."email_drafts";
drop table "command_center"."events";
drop table "command_center"."lead_scores";
drop table "command_center"."leads";
drop table "command_center"."notes";
drop table "command_center"."payments";
drop table "command_center"."students";
drop table "command_center"."tasks";
drop table "public"."analytics_events";
drop table "public"."concern_interpretations";
drop table "public"."drill_registry";
drop table "public"."drill_registry_control";
drop table "public"."media_clips";
drop table "public"."media_playlist_items";
drop table "public"."media_playlists";
drop table "public"."media_tags";
drop table "public"."media_transcript_chunks";
drop table "public"."media_user_state";
drop table "public"."media_user_video_tags";
drop table "public"."media_video_tags";
drop table "public"."menu_categories";
drop table "public"."menu_category_drills";
drop table "public"."rfa_pipeline_events";
drop table "public"."rfa_submissions";
drop table "public"."user_profiles";
create table "command_center"."usce_audit" (
    "id" bigint not null default nextval('command_center.usce_audit_id_seq'::regclass),
    "entity_table" text not null,
    "entity_id" uuid not null,
    "action" text not null,
    "actor_role" text not null,
    "actor_id" uuid,
    "diff" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );
create table "command_center"."usce_comms" (
    "id" uuid not null default gen_random_uuid(),
    "offer_id" uuid,
    "thread_id" uuid,
    "direction" text not null,
    "is_internal_note" boolean not null default false,
    "message_status" text not null default 'sent'::text,
    "from_email" text,
    "to_email" text,
    "subject" text,
    "body_text" text,
    "body_html" text,
    "postmark_message_id" text,
    "in_reply_to_postmark_message_id" text,
    "raw_json" jsonb not null default '{}'::jsonb,
    "needs_triage" boolean not null default false,
    "delivered_at" timestamp with time zone,
    "opened_at" timestamp with time zone,
    "replied_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default now()
      );
alter table "command_center"."usce_comms" enable row level security;
create table "command_center"."usce_confirmations" (
    "id" uuid not null default gen_random_uuid(),
    "offer_id" uuid not null,
    "request_id" uuid not null,
    "applicant_user_id" uuid not null,
    "status" text not null default 'PENDING_PAYMENT'::text,
    "amount_cents" integer not null,
    "currency" text not null default 'USD'::text,
    "stripe_payment_intent_id" text,
    "stripe_charge_id" text,
    "seat_lock_type" text not null default 'hard'::text,
    "seat_lock_expires_at" timestamp with time zone not null,
    "manual_payment" boolean not null default false,
    "manual_reference" text,
    "captured_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "failed_reason" text,
    "refunded_at" timestamp with time zone,
    "refunded_by" uuid,
    "refund_reason" text,
    "enrolled_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );
alter table "command_center"."usce_confirmations" enable row level security;
create table "command_center"."usce_cron_runs" (
    "id" bigint not null default nextval('command_center.usce_cron_runs_id_seq'::regclass),
    "job_name" text not null,
    "started_at" timestamp with time zone not null default now(),
    "completed_at" timestamp with time zone,
    "rows_affected" integer not null default 0,
    "error" text,
    "trigger_source" text not null default 'pg_cron'::text
      );
create table "command_center"."usce_dead_letter" (
    "id" bigint not null default nextval('command_center.usce_dead_letter_id_seq'::regclass),
    "source" text not null,
    "entity_type" text not null,
    "entity_id" uuid,
    "payload" jsonb not null,
    "error" text not null,
    "retryable" boolean not null default true,
    "recovered" boolean not null default false,
    "created_at" timestamp with time zone not null default now(),
    "recovered_at" timestamp with time zone
      );
create table "command_center"."usce_offers" (
    "id" uuid not null default gen_random_uuid(),
    "request_id" uuid not null,
    "applicant_user_id" uuid not null,
    "program_seat_id" uuid not null,
    "amount_cents" integer not null,
    "currency" text not null default 'USD'::text,
    "status" text not null default 'DRAFT'::text,
    "subject" text not null default ''::text,
    "html_body" text not null default ''::text,
    "text_body" text not null default ''::text,
    "preview_subject_body_hash" text,
    "preview_acknowledged_at" timestamp with time zone,
    "preview_acknowledged_by" uuid,
    "approved_subject_body_hash" text,
    "approved_by" uuid,
    "approved_at" timestamp with time zone,
    "portal_token_hash" text not null,
    "portal_token_expires_at" timestamp with time zone,
    "portal_token_encrypted" text,
    "postmark_message_id" text,
    "sent_at" timestamp with time zone,
    "reminder_sent_at" timestamp with time zone,
    "needs_reminder" boolean not null default false,
    "responded_at" timestamp with time zone,
    "response" text,
    "payment_intent_id" text,
    "payment_intent_created_at" timestamp with time zone,
    "retry_count" integer not null default 0,
    "failed_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "invalidated_at" timestamp with time zone,
    "invalidated_reason" text,
    "revoked_at" timestamp with time zone,
    "revoked_by" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );
alter table "command_center"."usce_offers" enable row level security;
create table "command_center"."usce_outbox" (
    "id" uuid not null default gen_random_uuid(),
    "entity_type" text not null,
    "entity_id" uuid not null,
    "action" text not null,
    "payload" jsonb not null,
    "status" text not null default 'pending'::text,
    "idempotency_key" text not null,
    "retry_count" integer not null default 0,
    "last_error" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "completed_at" timestamp with time zone
      );
create table "command_center"."usce_postmark_events" (
    "id" text not null,
    "event_type" text not null,
    "received_at" timestamp with time zone not null default now(),
    "payload" jsonb not null,
    "processed" boolean not null default false
      );
create table "command_center"."usce_program_seats" (
    "id" uuid not null default gen_random_uuid(),
    "program_name" text not null,
    "specialty" text not null,
    "location" text not null,
    "cohort_start_date" date not null,
    "seats_total" integer not null,
    "seats_held_soft" integer not null default 0,
    "seats_held_hard" integer not null default 0,
    "seats_filled" integer not null default 0,
    "active" boolean not null default true,
    "created_at" timestamp with time zone not null default now()
      );
create table "command_center"."usce_requests" (
    "id" uuid not null default gen_random_uuid(),
    "applicant_name" text not null,
    "applicant_email" public.citext not null,
    "applicant_phone_e164" text,
    "program_name" text not null,
    "program_seat_id" uuid not null,
    "preferred_specialties" text[] not null default '{}'::text[],
    "preferred_locations" text[] not null default '{}'::text[],
    "preferred_months" date[] not null default '{}'::date[],
    "preference_rankings" jsonb not null default '{}'::jsonb,
    "status" text not null default 'NEW'::text,
    "assigned_coordinator_id" uuid,
    "sla_claim_deadline" timestamp with time zone not null default (now() + '24:00:00'::interval),
    "sla_offer_deadline" timestamp with time zone,
    "sla_status" text not null default 'on_track'::text,
    "sla_breach_reason" text,
    "sla_breached_at" timestamp with time zone,
    "source" text not null default 'public_form'::text,
    "intake_payload" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );
alter table "command_center"."usce_requests" enable row level security;
create table "command_center"."usce_retention" (
    "id" uuid not null default gen_random_uuid(),
    "request_id" uuid not null,
    "retained_at" timestamp with time zone not null default now(),
    "by_user" uuid,
    "notes" text
      );
create table "command_center"."usce_stripe_events" (
    "id" text not null,
    "type" text not null,
    "received_at" timestamp with time zone not null default now(),
    "payload" jsonb not null
      );
create table "command_center"."usce_webhook_nonces" (
    "nonce" text not null,
    "source" text not null,
    "received_at" timestamp with time zone not null default now(),
    "expires_at" timestamp with time zone not null,
    "payload_hash" text not null
      );
create table "public"."attempts" (
    "id" uuid not null default gen_random_uuid(),
    "duel_id" uuid,
    "user_id" uuid not null,
    "correct_count" integer,
    "total_time_ms" integer,
    "answers_json" jsonb,
    "created_at" timestamp with time zone default now()
      );
alter table "public"."attempts" enable row level security;
create table "public"."con_daily_diagnosis" (
    "id" bigint generated always as identity not null,
    "report_date" date not null,
    "diagnosis_code" text not null,
    "diagnosis_label" text not null,
    "severity" text not null default 'INFO'::text,
    "recommendation" text not null,
    "trend" text default 'FLAT'::text,
    "trend_detail" text,
    "kpi_visibility_status" text default 'UNKNOWN'::text,
    "kpi_engagement_status" text default 'UNKNOWN'::text,
    "kpi_cta_status" text default 'UNKNOWN'::text,
    "kpi_conversion_status" text default 'UNKNOWN'::text,
    "alert_message" text,
    "created_at" timestamp with time zone not null default now()
      );
alter table "public"."con_daily_diagnosis" enable row level security;
create table "public"."con_daily_metrics" (
    "id" bigint generated always as identity not null,
    "report_date" date not null,
    "total_pageviews" integer not null default 0,
    "total_section_views" integer not null default 0,
    "total_engaged_50pct" integer not null default 0,
    "total_cta_clicks" integer not null default 0,
    "total_calls_booked" integer not null default 0,
    "total_missed" integer not null default 0,
    "visibility_rate" numeric(5,2) default 0,
    "engagement_rate" numeric(5,2) default 0,
    "cta_click_rate" numeric(5,2) default 0,
    "conversion_rate" numeric(5,2) default 0,
    "subsection_hero" integer default 0,
    "subsection_narrative" integer default 0,
    "subsection_data_table" integer default 0,
    "subsection_testimonials" integer default 0,
    "subsection_cta_block" integer default 0,
    "avg_time_in_view_seconds" numeric(6,1) default 0,
    "time_bucket_5s" integer default 0,
    "time_bucket_15s" integer default 0,
    "time_bucket_30s" integer default 0,
    "ab_variant_a_views" integer default 0,
    "ab_variant_b_views" integer default 0,
    "ab_variant_a_cta" integer default 0,
    "ab_variant_b_cta" integer default 0,
    "created_at" timestamp with time zone not null default now(),
    "notes" text
      );
alter table "public"."con_daily_metrics" enable row level security;
create table "public"."con_kpi_targets" (
    "id" bigint generated always as identity not null,
    "metric_name" text not null,
    "target_value" numeric(5,2) not null,
    "warning_threshold" numeric(5,2) not null,
    "critical_threshold" numeric(5,2) not null,
    "description" text,
    "updated_at" timestamp with time zone not null default now()
      );
alter table "public"."con_kpi_targets" enable row level security;
create table "public"."duels" (
    "id" uuid not null default gen_random_uuid(),
    "creator_id" uuid not null,
    "opponent_id" uuid,
    "status" public.duel_status default 'pending'::public.duel_status,
    "winner_id" uuid,
    "created_at" timestamp with time zone default now(),
    "expires_at" timestamp with time zone default (now() + '48:00:00'::interval)
      );
alter table "public"."duels" enable row level security;
create table "public"."missionmed_action_queue" (
    "id" uuid not null default gen_random_uuid(),
    "profile_id" uuid,
    "email" text not null,
    "action_type" text,
    "action_reason" text,
    "priority" text,
    "status" text default 'open'::text,
    "assigned_to" text,
    "due_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );
alter table "public"."missionmed_action_queue" enable row level security;
create table "public"."missionmed_email_threads" (
    "id" uuid not null default gen_random_uuid(),
    "profile_id" uuid,
    "email" text not null,
    "sender_name" text,
    "subject" text,
    "thread_summary" text,
    "service_category" text,
    "conversion_probability" numeric,
    "last_message_at" timestamp with time zone,
    "last_message_direction" text,
    "assigned_owner" text,
    "unread_count" integer default 0,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "service_email" text,
    "notify_email" text
      );
alter table "public"."missionmed_email_threads" enable row level security;
create table "public"."missionmed_lead_scores" (
    "id" uuid not null default gen_random_uuid(),
    "profile_id" uuid,
    "email" text not null,
    "program_interest" text,
    "email_opens" integer default 0,
    "replies" integer default 0,
    "consult_scheduled" boolean default false,
    "urgency" boolean default false,
    "price_objection" boolean default false,
    "previous_engagement" boolean default false,
    "last_activity" timestamp with time zone,
    "lead_score" integer,
    "lead_status" text,
    "score_reasoning" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "assigned_owner" text
      );
alter table "public"."missionmed_lead_scores" enable row level security;
create table "public"."missionmed_pipeline_events" (
    "id" uuid not null default gen_random_uuid(),
    "profile_id" uuid,
    "email" text not null,
    "event_type" text,
    "event_notes" text,
    "created_at" timestamp with time zone default now()
      );
alter table "public"."missionmed_pipeline_events" enable row level security;
create table "public"."profile_links" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "profiles_id" uuid,
    "drip_profile_id" uuid,
    "ranklist_submission_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );
alter table "public"."profile_links" enable row level security;
create table "public"."profiles" (
    "id" uuid not null default gen_random_uuid(),
    "wp_user_id" bigint,
    "email" text not null,
    "first_name" text,
    "last_name" text,
    "core_profile" jsonb default '{}'::jsonb,
    "match_profile" jsonb default '{}'::jsonb,
    "tool_data" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "phone" text,
    "country" text,
    "medical_school" text,
    "graduation_year" integer,
    "primary_specialty" text,
    "secondary_specialty" text,
    "usmle_step1_score" integer,
    "usmle_step2_score" integer,
    "attempts_step1" integer,
    "attempts_step2" integer,
    "visa_status" text,
    "need_visa" boolean,
    "onboarding_complete" boolean default false,
    "profile_version" integer default 1,
    "us_grad" boolean,
    "img" boolean,
    "do_student" boolean,
    "visa_needed" boolean,
    "usmle_step3_score" integer,
    "usmle_step1_attempts" integer,
    "usmle_step2_attempts" integer,
    "usmle_step3_attempts" integer,
    "comlex_level1_score" integer,
    "comlex_level2_score" integer,
    "comlex_level3_score" integer,
    "comlex_level1_attempts" integer,
    "comlex_level2_attempts" integer,
    "comlex_level3_attempts" integer,
    "research_experience" boolean,
    "publications_count" integer,
    "usce_months" integer,
    "couples_match" boolean,
    "reapplicant" boolean,
    "intake_completed" boolean default false,
    "intake_completed_at" timestamp with time zone,
    "lead_source" text,
    "utm_source" text,
    "utm_campaign" text,
    "extra_data" jsonb default '{}'::jsonb,
    "auth_user_id" uuid,
    "avatar_url" text
      );
alter table "public"."profiles" enable row level security;
create table "public"."program_intel_aggregate" (
    "id" uuid not null default gen_random_uuid(),
    "program_name" text not null,
    "program_id" text,
    "nrmp_program_code" text,
    "specialty" text,
    "fellowship_strength_bucket" text,
    "interview_format_patterns" jsonb,
    "interviewer_types" jsonb,
    "board_pass_tiers" jsonb,
    "competitiveness_bucket" text,
    "historical_match_stats" jsonb,
    "aggregate_metrics" jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );
alter table "public"."program_intel_aggregate" enable row level security;
create table "public"."rank_lists" (
    "id" uuid not null default gen_random_uuid(),
    "profile_id" uuid not null,
    "match_cycle" integer,
    "is_final" boolean not null default false,
    "rank_list_json" jsonb not null default '{}'::jsonb,
    "submitted_at" timestamp with time zone default now(),
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );
alter table "public"."rank_lists" enable row level security;
create table "public"."ranklist_submissions" (
    "id" uuid not null default gen_random_uuid(),
    "auth_user_id" uuid not null,
    "cycle_year" text,
    "specialty" text,
    "submitted_at" timestamp with time zone not null default now(),
    "payload" jsonb not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );
alter table "public"."ranklist_submissions" enable row level security;
create table "public"."ranklist_versions" (
    "id" uuid not null default gen_random_uuid(),
    "ranklist_id" uuid not null,
    "created_by" uuid not null,
    "label" text default 'Auto Save'::text,
    "snapshot" jsonb not null,
    "created_at" timestamp with time zone not null default now(),
    "is_marker_only" boolean not null default false
      );
alter table "public"."ranklist_versions" enable row level security;
create table "public"."ranklists" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "title" text not null default 'My Rank List'::text,
    "specialty" text,
    "cycle_year" integer,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "is_final" boolean not null default false,
    "finalized_at" timestamp with time zone,
    "finalize_tokens_remaining" integer not null default 1
      );
alter table "public"."ranklists" enable row level security;
create table "public"."user_program_interviews" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "program_name" text not null,
    "program_id" text,
    "nrmp_program_code" text,
    "specialty" text,
    "match_cycle_year" integer,
    "applied_status" text,
    "interview_received" boolean,
    "interview_format" text,
    "signal_sent" boolean,
    "visa_status" text,
    "interview_performance_metrics" jsonb,
    "confidence_score" numeric,
    "ranked_position" integer,
    "final_match_flag" boolean,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "program_key" text,
    "interview_intel" jsonb
      );
alter table "public"."user_program_interviews" enable row level security;
alter table "public"."dataset_questions" enable row level security;
alter table "public"."dataset_questions_backup_pre_v5_tier_a_20260422" enable row level security;
alter table "public"."dataset_registry" enable row level security;
alter table "public"."dataset_registry_backup_pre_v5_tier_a_20260422" enable row level security;
alter table "public"."duel_challenges" add column "finalized_at" timestamp with time zone;
alter sequence "command_center"."usce_audit_id_seq" owned by "command_center"."usce_audit"."id";
alter sequence "command_center"."usce_cron_runs_id_seq" owned by "command_center"."usce_cron_runs"."id";
alter sequence "command_center"."usce_dead_letter_id_seq" owned by "command_center"."usce_dead_letter"."id";
drop type "public"."drill_status";
drop extension if exists "vector";
CREATE INDEX usce_audit_created_idx ON command_center.usce_audit USING btree (created_at DESC);
CREATE INDEX usce_audit_entity_idx ON command_center.usce_audit USING btree (entity_table, entity_id);
CREATE UNIQUE INDEX usce_audit_pkey ON command_center.usce_audit USING btree (id);
CREATE INDEX usce_comms_internal_note_idx ON command_center.usce_comms USING btree (thread_id) WHERE (is_internal_note = true);
CREATE INDEX usce_comms_offer_idx ON command_center.usce_comms USING btree (offer_id);
CREATE UNIQUE INDEX usce_comms_pkey ON command_center.usce_comms USING btree (id);
CREATE INDEX usce_comms_status_idx ON command_center.usce_comms USING btree (message_status);
CREATE INDEX usce_comms_thread_idx ON command_center.usce_comms USING btree (thread_id);
CREATE INDEX usce_comms_triage_idx ON command_center.usce_comms USING btree (needs_triage) WHERE (needs_triage = true);
CREATE INDEX usce_confirmations_applicant_user_idx ON command_center.usce_confirmations USING btree (applicant_user_id);
CREATE INDEX usce_confirmations_offer_idx ON command_center.usce_confirmations USING btree (offer_id);
CREATE UNIQUE INDEX usce_confirmations_pi_idx ON command_center.usce_confirmations USING btree (stripe_payment_intent_id) WHERE (stripe_payment_intent_id IS NOT NULL);
CREATE UNIQUE INDEX usce_confirmations_pkey ON command_center.usce_confirmations USING btree (id);
CREATE INDEX usce_confirmations_request_idx ON command_center.usce_confirmations USING btree (request_id);
CREATE INDEX usce_confirmations_seat_lock_idx ON command_center.usce_confirmations USING btree (seat_lock_expires_at) WHERE (status = ANY (ARRAY['PENDING_PAYMENT'::text, 'PAYMENT_AUTHORIZED'::text]));
CREATE INDEX usce_confirmations_status_idx ON command_center.usce_confirmations USING btree (status);
CREATE UNIQUE INDEX usce_confirmations_stripe_payment_intent_id_key ON command_center.usce_confirmations USING btree (stripe_payment_intent_id);
CREATE INDEX usce_cron_runs_job_idx ON command_center.usce_cron_runs USING btree (job_name, started_at DESC);
CREATE UNIQUE INDEX usce_cron_runs_pkey ON command_center.usce_cron_runs USING btree (id);
CREATE INDEX usce_cron_runs_recent_idx ON command_center.usce_cron_runs USING btree (job_name, completed_at DESC) WHERE (completed_at IS NOT NULL);
CREATE INDEX usce_dead_letter_entity_idx ON command_center.usce_dead_letter USING btree (entity_type, entity_id);
CREATE UNIQUE INDEX usce_dead_letter_pkey ON command_center.usce_dead_letter USING btree (id);
CREATE INDEX usce_dead_letter_recovered_idx ON command_center.usce_dead_letter USING btree (recovered, created_at DESC);
CREATE INDEX usce_offers_applicant_user_idx ON command_center.usce_offers USING btree (applicant_user_id);
CREATE UNIQUE INDEX usce_offers_one_paid_per_request_idx ON command_center.usce_offers USING btree (request_id) WHERE (status = 'PAID'::text);
CREATE INDEX usce_offers_payment_idx ON command_center.usce_offers USING btree (payment_intent_created_at) WHERE (status = 'PENDING_PAYMENT'::text);
CREATE UNIQUE INDEX usce_offers_pkey ON command_center.usce_offers USING btree (id);
CREATE UNIQUE INDEX usce_offers_portal_token_hash_idx ON command_center.usce_offers USING btree (portal_token_hash);
CREATE UNIQUE INDEX usce_offers_portal_token_hash_key ON command_center.usce_offers USING btree (portal_token_hash);
CREATE INDEX usce_offers_request_idx ON command_center.usce_offers USING btree (request_id);
CREATE INDEX usce_offers_sla_idx ON command_center.usce_offers USING btree (sent_at) WHERE (status = ANY (ARRAY['SENT'::text, 'REMINDED'::text]));
CREATE INDEX usce_offers_status_idx ON command_center.usce_offers USING btree (status);
CREATE INDEX usce_outbox_entity_idx ON command_center.usce_outbox USING btree (entity_type, entity_id);
CREATE UNIQUE INDEX usce_outbox_idempotency_key_key ON command_center.usce_outbox USING btree (idempotency_key);
CREATE UNIQUE INDEX usce_outbox_pkey ON command_center.usce_outbox USING btree (id);
CREATE INDEX usce_outbox_status_created_idx ON command_center.usce_outbox USING btree (status, created_at);
CREATE UNIQUE INDEX usce_postmark_events_pkey ON command_center.usce_postmark_events USING btree (id);
CREATE INDEX usce_postmark_events_received_idx ON command_center.usce_postmark_events USING btree (received_at DESC);
CREATE INDEX usce_postmark_events_type_idx ON command_center.usce_postmark_events USING btree (event_type);
CREATE INDEX usce_program_seats_active_idx ON command_center.usce_program_seats USING btree (active, program_name);
CREATE INDEX usce_program_seats_cohort_idx ON command_center.usce_program_seats USING btree (cohort_start_date);
CREATE INDEX usce_program_seats_location_idx ON command_center.usce_program_seats USING btree (location);
CREATE UNIQUE INDEX usce_program_seats_pkey ON command_center.usce_program_seats USING btree (id);
CREATE INDEX usce_program_seats_specialty_idx ON command_center.usce_program_seats USING btree (specialty);
CREATE INDEX usce_requests_assigned_idx ON command_center.usce_requests USING btree (assigned_coordinator_id) WHERE (assigned_coordinator_id IS NOT NULL);
CREATE INDEX usce_requests_created_idx ON command_center.usce_requests USING btree (created_at DESC);
CREATE UNIQUE INDEX usce_requests_dedupe_idx ON command_center.usce_requests USING btree (lower((applicant_email)::text), program_name) WHERE (status <> ALL (ARRAY['FULFILLED'::text, 'EXPIRED'::text, 'CANCELLED'::text, 'ARCHIVED'::text]));
CREATE UNIQUE INDEX usce_requests_pkey ON command_center.usce_requests USING btree (id);
CREATE INDEX usce_requests_pref_locations_gin_idx ON command_center.usce_requests USING gin (preferred_locations);
CREATE INDEX usce_requests_pref_months_gin_idx ON command_center.usce_requests USING gin (preferred_months);
CREATE INDEX usce_requests_pref_specialties_gin_idx ON command_center.usce_requests USING gin (preferred_specialties);
CREATE INDEX usce_requests_search_trgm_idx ON command_center.usce_requests USING gin ((((((applicant_name || ' '::text) || (applicant_email)::text) || ' '::text) || program_name)) public.gin_trgm_ops);
CREATE INDEX usce_requests_sla_claim_deadline_idx ON command_center.usce_requests USING btree (sla_claim_deadline) WHERE (status = 'NEW'::text);
CREATE INDEX usce_requests_sla_offer_deadline_idx ON command_center.usce_requests USING btree (sla_offer_deadline) WHERE (status = 'IN_REVIEW'::text);
CREATE INDEX usce_requests_sla_status_idx ON command_center.usce_requests USING btree (sla_status);
CREATE INDEX usce_requests_status_idx ON command_center.usce_requests USING btree (status);
CREATE UNIQUE INDEX usce_retention_pkey ON command_center.usce_retention USING btree (id);
CREATE UNIQUE INDEX usce_stripe_events_pkey ON command_center.usce_stripe_events USING btree (id);
CREATE INDEX usce_webhook_nonces_expires_idx ON command_center.usce_webhook_nonces USING btree (expires_at);
CREATE UNIQUE INDEX usce_webhook_nonces_pkey ON command_center.usce_webhook_nonces USING btree (nonce, source);
CREATE UNIQUE INDEX usce_webhook_nonces_unique_idx ON command_center.usce_webhook_nonces USING btree (nonce, source);
CREATE UNIQUE INDEX attempts_duel_id_user_id_key ON public.attempts USING btree (duel_id, user_id);
CREATE UNIQUE INDEX attempts_pkey ON public.attempts USING btree (id);
CREATE UNIQUE INDEX con_daily_diagnosis_pkey ON public.con_daily_diagnosis USING btree (id);
CREATE UNIQUE INDEX con_daily_diagnosis_report_date_key ON public.con_daily_diagnosis USING btree (report_date);
CREATE UNIQUE INDEX con_daily_metrics_pkey ON public.con_daily_metrics USING btree (id);
CREATE UNIQUE INDEX con_daily_metrics_report_date_key ON public.con_daily_metrics USING btree (report_date);
CREATE UNIQUE INDEX con_kpi_targets_metric_name_key ON public.con_kpi_targets USING btree (metric_name);
CREATE UNIQUE INDEX con_kpi_targets_pkey ON public.con_kpi_targets USING btree (id);
CREATE UNIQUE INDEX duels_pkey ON public.duels USING btree (id);
CREATE INDEX idx_action_queue_email ON public.missionmed_action_queue USING btree (email);
CREATE INDEX idx_action_queue_profile ON public.missionmed_action_queue USING btree (profile_id) WHERE (profile_id IS NOT NULL);
CREATE INDEX idx_action_queue_status ON public.missionmed_action_queue USING btree (status) WHERE (status = 'open'::text);
CREATE INDEX idx_con_daily_diagnosis_date ON public.con_daily_diagnosis USING btree (report_date DESC);
CREATE INDEX idx_con_daily_metrics_date ON public.con_daily_metrics USING btree (report_date DESC);
CREATE INDEX idx_duel_challenges_dataset_version ON public.duel_challenges USING btree (dataset_version) WHERE (dataset_version IS NOT NULL);
CREATE INDEX idx_email_threads_email ON public.missionmed_email_threads USING btree (email);
CREATE INDEX idx_email_threads_profile ON public.missionmed_email_threads USING btree (profile_id) WHERE (profile_id IS NOT NULL);
CREATE INDEX idx_lead_scores_email ON public.missionmed_lead_scores USING btree (email);
CREATE INDEX idx_lead_scores_profile ON public.missionmed_lead_scores USING btree (profile_id) WHERE (profile_id IS NOT NULL);
CREATE INDEX idx_lead_scores_status ON public.missionmed_lead_scores USING btree (lead_status);
CREATE INDEX idx_pipeline_events_created ON public.missionmed_pipeline_events USING btree (created_at DESC);
CREATE INDEX idx_pipeline_events_email ON public.missionmed_pipeline_events USING btree (email);
CREATE INDEX idx_pipeline_events_profile ON public.missionmed_pipeline_events USING btree (profile_id) WHERE (profile_id IS NOT NULL);
CREATE INDEX idx_profile_links_user ON public.profile_links USING btree (user_id);
CREATE INDEX idx_upi_cycle ON public.user_program_interviews USING btree (match_cycle_year);
CREATE INDEX idx_upi_program ON public.user_program_interviews USING btree (program_name);
CREATE INDEX idx_upi_user ON public.user_program_interviews USING btree (user_id);
CREATE UNIQUE INDEX missionmed_action_queue_email_unique ON public.missionmed_action_queue USING btree (email);
CREATE UNIQUE INDEX missionmed_action_queue_pkey ON public.missionmed_action_queue USING btree (id);
CREATE UNIQUE INDEX missionmed_email_threads_email_unique ON public.missionmed_email_threads USING btree (email);
CREATE UNIQUE INDEX missionmed_email_threads_pkey ON public.missionmed_email_threads USING btree (id);
CREATE UNIQUE INDEX missionmed_lead_scores_email_unique ON public.missionmed_lead_scores USING btree (email);
CREATE UNIQUE INDEX missionmed_lead_scores_pkey ON public.missionmed_lead_scores USING btree (id);
CREATE UNIQUE INDEX missionmed_pipeline_events_pkey ON public.missionmed_pipeline_events USING btree (id);
CREATE UNIQUE INDEX pia_unique_program_specialty ON public.program_intel_aggregate USING btree (program_name, specialty);
CREATE UNIQUE INDEX profile_links_pkey ON public.profile_links USING btree (id);
CREATE INDEX profiles_auth_user_id_idx ON public.profiles USING btree (auth_user_id);
CREATE UNIQUE INDEX profiles_auth_user_id_key ON public.profiles USING btree (auth_user_id);
CREATE UNIQUE INDEX profiles_auth_user_id_uniq ON public.profiles USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);
CREATE INDEX profiles_email_idx ON public.profiles USING btree (email);
CREATE UNIQUE INDEX profiles_email_key ON public.profiles USING btree (email);
CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);
CREATE INDEX profiles_wp_user_id_idx ON public.profiles USING btree (wp_user_id);
CREATE UNIQUE INDEX program_intel_aggregate_pkey ON public.program_intel_aggregate USING btree (id);
CREATE INDEX rank_lists_cycle_idx ON public.rank_lists USING btree (match_cycle);
CREATE UNIQUE INDEX rank_lists_one_final_per_cycle ON public.rank_lists USING btree (profile_id, match_cycle) WHERE (is_final = true);
CREATE UNIQUE INDEX rank_lists_pkey ON public.rank_lists USING btree (id);
CREATE INDEX rank_lists_profile_id_idx ON public.rank_lists USING btree (profile_id);
CREATE INDEX ranklist_submissions_auth_user_id_idx ON public.ranklist_submissions USING btree (auth_user_id);
CREATE UNIQUE INDEX ranklist_submissions_pkey ON public.ranklist_submissions USING btree (id);
CREATE INDEX ranklist_submissions_submitted_at_idx ON public.ranklist_submissions USING btree (submitted_at DESC);
CREATE UNIQUE INDEX ranklist_versions_pkey ON public.ranklist_versions USING btree (id);
CREATE INDEX ranklist_versions_ranklist_created_at_idx ON public.ranklist_versions USING btree (ranklist_id, created_at DESC);
CREATE UNIQUE INDEX ranklists_pkey ON public.ranklists USING btree (id);
CREATE UNIQUE INDEX ranklists_user_id_unique ON public.ranklists USING btree (user_id);
CREATE INDEX ranklists_user_updated_at_idx ON public.ranklists USING btree (user_id, updated_at DESC);
CREATE UNIQUE INDEX uidx_pia_program ON public.program_intel_aggregate USING btree (program_name);
CREATE UNIQUE INDEX uidx_program_intel_name ON public.program_intel_aggregate USING btree (program_name);
CREATE UNIQUE INDEX uidx_upi_user_program_cycle ON public.user_program_interviews USING btree (user_id, program_name, COALESCE(match_cycle_year, '-1'::integer));
CREATE UNIQUE INDEX upi_unique_user_program_cycle ON public.user_program_interviews USING btree (user_id, program_name, match_cycle_year);
CREATE INDEX upi_user_cycle_idx ON public.user_program_interviews USING btree (user_id, match_cycle_year);
CREATE UNIQUE INDEX upi_user_program_cycle_key ON public.user_program_interviews USING btree (user_id, program_key, match_cycle_year);
CREATE UNIQUE INDEX upi_user_program_cycle_uniq ON public.user_program_interviews USING btree (user_id, program_key, match_cycle_year);
CREATE UNIQUE INDEX user_program_interviews_pkey ON public.user_program_interviews USING btree (id);
alter table "command_center"."usce_audit" add constraint "usce_audit_pkey" PRIMARY KEY using index "usce_audit_pkey";
alter table "command_center"."usce_comms" add constraint "usce_comms_pkey" PRIMARY KEY using index "usce_comms_pkey";
alter table "command_center"."usce_confirmations" add constraint "usce_confirmations_pkey" PRIMARY KEY using index "usce_confirmations_pkey";
alter table "command_center"."usce_cron_runs" add constraint "usce_cron_runs_pkey" PRIMARY KEY using index "usce_cron_runs_pkey";
alter table "command_center"."usce_dead_letter" add constraint "usce_dead_letter_pkey" PRIMARY KEY using index "usce_dead_letter_pkey";
alter table "command_center"."usce_offers" add constraint "usce_offers_pkey" PRIMARY KEY using index "usce_offers_pkey";
alter table "command_center"."usce_outbox" add constraint "usce_outbox_pkey" PRIMARY KEY using index "usce_outbox_pkey";
alter table "command_center"."usce_postmark_events" add constraint "usce_postmark_events_pkey" PRIMARY KEY using index "usce_postmark_events_pkey";
alter table "command_center"."usce_program_seats" add constraint "usce_program_seats_pkey" PRIMARY KEY using index "usce_program_seats_pkey";
alter table "command_center"."usce_requests" add constraint "usce_requests_pkey" PRIMARY KEY using index "usce_requests_pkey";
alter table "command_center"."usce_retention" add constraint "usce_retention_pkey" PRIMARY KEY using index "usce_retention_pkey";
alter table "command_center"."usce_stripe_events" add constraint "usce_stripe_events_pkey" PRIMARY KEY using index "usce_stripe_events_pkey";
alter table "command_center"."usce_webhook_nonces" add constraint "usce_webhook_nonces_pkey" PRIMARY KEY using index "usce_webhook_nonces_pkey";
alter table "public"."attempts" add constraint "attempts_pkey" PRIMARY KEY using index "attempts_pkey";
alter table "public"."con_daily_diagnosis" add constraint "con_daily_diagnosis_pkey" PRIMARY KEY using index "con_daily_diagnosis_pkey";
alter table "public"."con_daily_metrics" add constraint "con_daily_metrics_pkey" PRIMARY KEY using index "con_daily_metrics_pkey";
alter table "public"."con_kpi_targets" add constraint "con_kpi_targets_pkey" PRIMARY KEY using index "con_kpi_targets_pkey";
alter table "public"."duels" add constraint "duels_pkey" PRIMARY KEY using index "duels_pkey";
alter table "public"."missionmed_action_queue" add constraint "missionmed_action_queue_pkey" PRIMARY KEY using index "missionmed_action_queue_pkey";
alter table "public"."missionmed_email_threads" add constraint "missionmed_email_threads_pkey" PRIMARY KEY using index "missionmed_email_threads_pkey";
alter table "public"."missionmed_lead_scores" add constraint "missionmed_lead_scores_pkey" PRIMARY KEY using index "missionmed_lead_scores_pkey";
alter table "public"."missionmed_pipeline_events" add constraint "missionmed_pipeline_events_pkey" PRIMARY KEY using index "missionmed_pipeline_events_pkey";
alter table "public"."profile_links" add constraint "profile_links_pkey" PRIMARY KEY using index "profile_links_pkey";
alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";
alter table "public"."program_intel_aggregate" add constraint "program_intel_aggregate_pkey" PRIMARY KEY using index "program_intel_aggregate_pkey";
alter table "public"."rank_lists" add constraint "rank_lists_pkey" PRIMARY KEY using index "rank_lists_pkey";
alter table "public"."ranklist_submissions" add constraint "ranklist_submissions_pkey" PRIMARY KEY using index "ranklist_submissions_pkey";
alter table "public"."ranklist_versions" add constraint "ranklist_versions_pkey" PRIMARY KEY using index "ranklist_versions_pkey";
alter table "public"."ranklists" add constraint "ranklists_pkey" PRIMARY KEY using index "ranklists_pkey";
alter table "public"."user_program_interviews" add constraint "user_program_interviews_pkey" PRIMARY KEY using index "user_program_interviews_pkey";
alter table "command_center"."usce_audit" add constraint "usce_audit_action_check" CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text, 'SLA_AT_RISK'::text, 'SLA_BREACH'::text, 'SLA_MET'::text, 'SLA_WAIVED'::text, 'DELIVERY_FAILED'::text, 'DELIVERY_BOUNCED'::text, 'DELIVERY_COMPLAINED'::text, 'REQUIRES_REVIEW'::text, 'RECONCILIATION_ALERT'::text, 'CRON_SUMMARY'::text, 'VIEW_EXPIRED'::text, 'ONBOARDING_STARTED'::text, 'ONBOARDING_COMPLETED'::text]))) not valid;
alter table "command_center"."usce_audit" validate constraint "usce_audit_action_check";
alter table "command_center"."usce_audit" add constraint "usce_audit_actor_role_check" CHECK ((actor_role = ANY (ARRAY['coordinator'::text, 'admin'::text, 'anon'::text, 'system'::text]))) not valid;
alter table "command_center"."usce_audit" validate constraint "usce_audit_actor_role_check";
alter table "command_center"."usce_comms" add constraint "usce_comms_check" CHECK ((NOT ((is_internal_note = true) AND (direction = 'OUT'::text)))) not valid;
alter table "command_center"."usce_comms" validate constraint "usce_comms_check";
alter table "command_center"."usce_comms" add constraint "usce_comms_check1" CHECK ((NOT ((is_internal_note = true) AND (direction = 'IN'::text)))) not valid;
alter table "command_center"."usce_comms" validate constraint "usce_comms_check1";
alter table "command_center"."usce_comms" add constraint "usce_comms_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;
alter table "command_center"."usce_comms" validate constraint "usce_comms_created_by_fkey";
alter table "command_center"."usce_comms" add constraint "usce_comms_direction_check" CHECK ((direction = ANY (ARRAY['OUT'::text, 'IN'::text, 'SYS'::text]))) not valid;
alter table "command_center"."usce_comms" validate constraint "usce_comms_direction_check";
alter table "command_center"."usce_comms" add constraint "usce_comms_message_status_check" CHECK ((message_status = ANY (ARRAY['sent'::text, 'delivered'::text, 'opened'::text, 'replied'::text, 'failed'::text, 'bounced'::text, 'complained'::text]))) not valid;
alter table "command_center"."usce_comms" validate constraint "usce_comms_message_status_check";
alter table "command_center"."usce_comms" add constraint "usce_comms_offer_id_fkey" FOREIGN KEY (offer_id) REFERENCES command_center.usce_offers(id) not valid;
alter table "command_center"."usce_comms" validate constraint "usce_comms_offer_id_fkey";
alter table "command_center"."usce_comms" add constraint "usce_comms_thread_id_fkey" FOREIGN KEY (thread_id) REFERENCES command_center.usce_requests(id) not valid;
alter table "command_center"."usce_comms" validate constraint "usce_comms_thread_id_fkey";
alter table "command_center"."usce_confirmations" add constraint "usce_confirmations_amount_cents_check" CHECK ((amount_cents > 0)) not valid;
alter table "command_center"."usce_confirmations" validate constraint "usce_confirmations_amount_cents_check";
alter table "command_center"."usce_confirmations" add constraint "usce_confirmations_applicant_user_id_fkey" FOREIGN KEY (applicant_user_id) REFERENCES auth.users(id) not valid;
alter table "command_center"."usce_confirmations" validate constraint "usce_confirmations_applicant_user_id_fkey";
alter table "command_center"."usce_confirmations" add constraint "usce_confirmations_offer_id_fkey" FOREIGN KEY (offer_id) REFERENCES command_center.usce_offers(id) ON DELETE RESTRICT not valid;
alter table "command_center"."usce_confirmations" validate constraint "usce_confirmations_offer_id_fkey";
alter table "command_center"."usce_confirmations" add constraint "usce_confirmations_refunded_by_fkey" FOREIGN KEY (refunded_by) REFERENCES auth.users(id) not valid;
alter table "command_center"."usce_confirmations" validate constraint "usce_confirmations_refunded_by_fkey";
alter table "command_center"."usce_confirmations" add constraint "usce_confirmations_request_id_fkey" FOREIGN KEY (request_id) REFERENCES command_center.usce_requests(id) ON DELETE RESTRICT not valid;
alter table "command_center"."usce_confirmations" validate constraint "usce_confirmations_request_id_fkey";
alter table "command_center"."usce_confirmations" add constraint "usce_confirmations_seat_lock_type_check" CHECK ((seat_lock_type = ANY (ARRAY['soft'::text, 'hard'::text]))) not valid;
alter table "command_center"."usce_confirmations" validate constraint "usce_confirmations_seat_lock_type_check";
alter table "command_center"."usce_confirmations" add constraint "usce_confirmations_status_check" CHECK ((status = ANY (ARRAY['PENDING_PAYMENT'::text, 'PAYMENT_AUTHORIZED'::text, 'PAYMENT_CAPTURED'::text, 'FAILED'::text, 'REFUNDED'::text, 'ENROLLED'::text]))) not valid;
alter table "command_center"."usce_confirmations" validate constraint "usce_confirmations_status_check";
alter table "command_center"."usce_confirmations" add constraint "usce_confirmations_stripe_payment_intent_id_key" UNIQUE using index "usce_confirmations_stripe_payment_intent_id_key";
alter table "command_center"."usce_cron_runs" add constraint "usce_cron_runs_trigger_source_check" CHECK ((trigger_source = ANY (ARRAY['pg_cron'::text, 'mirror_endpoint'::text, 'manual'::text]))) not valid;
alter table "command_center"."usce_cron_runs" validate constraint "usce_cron_runs_trigger_source_check";
alter table "command_center"."usce_offers" add constraint "usce_offers_amount_cents_check" CHECK ((amount_cents > 0)) not valid;
alter table "command_center"."usce_offers" validate constraint "usce_offers_amount_cents_check";
alter table "command_center"."usce_offers" add constraint "usce_offers_applicant_user_id_fkey" FOREIGN KEY (applicant_user_id) REFERENCES auth.users(id) not valid;
alter table "command_center"."usce_offers" validate constraint "usce_offers_applicant_user_id_fkey";
alter table "command_center"."usce_offers" add constraint "usce_offers_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES auth.users(id) not valid;
alter table "command_center"."usce_offers" validate constraint "usce_offers_approved_by_fkey";
alter table "command_center"."usce_offers" add constraint "usce_offers_approved_subject_body_hash_check" CHECK (((approved_subject_body_hash IS NULL) OR (length(approved_subject_body_hash) = 64))) not valid;
alter table "command_center"."usce_offers" validate constraint "usce_offers_approved_subject_body_hash_check";
alter table "command_center"."usce_offers" add constraint "usce_offers_currency_check" CHECK ((currency = 'USD'::text)) not valid;
alter table "command_center"."usce_offers" validate constraint "usce_offers_currency_check";
alter table "command_center"."usce_offers" add constraint "usce_offers_invalidated_reason_check" CHECK (((invalidated_reason IS NULL) OR (invalidated_reason = ANY (ARRAY['sibling_paid'::text, 'request_cancelled'::text, 'request_expired'::text])))) not valid;
alter table "command_center"."usce_offers" validate constraint "usce_offers_invalidated_reason_check";
alter table "command_center"."usce_offers" add constraint "usce_offers_portal_token_hash_check" CHECK ((length(portal_token_hash) = 64)) not valid;
alter table "command_center"."usce_offers" validate constraint "usce_offers_portal_token_hash_check";
alter table "command_center"."usce_offers" add constraint "usce_offers_portal_token_hash_key" UNIQUE using index "usce_offers_portal_token_hash_key";
alter table "command_center"."usce_offers" add constraint "usce_offers_preview_acknowledged_by_fkey" FOREIGN KEY (preview_acknowledged_by) REFERENCES auth.users(id) not valid;
alter table "command_center"."usce_offers" validate constraint "usce_offers_preview_acknowledged_by_fkey";
alter table "command_center"."usce_offers" add constraint "usce_offers_preview_subject_body_hash_check" CHECK (((preview_subject_body_hash IS NULL) OR (length(preview_subject_body_hash) = 64))) not valid;
alter table "command_center"."usce_offers" validate constraint "usce_offers_preview_subject_body_hash_check";
alter table "command_center"."usce_offers" add constraint "usce_offers_program_seat_id_fkey" FOREIGN KEY (program_seat_id) REFERENCES command_center.usce_program_seats(id) not valid;
alter table "command_center"."usce_offers" validate constraint "usce_offers_program_seat_id_fkey";
alter table "command_center"."usce_offers" add constraint "usce_offers_request_id_fkey" FOREIGN KEY (request_id) REFERENCES command_center.usce_requests(id) ON DELETE RESTRICT not valid;
alter table "command_center"."usce_offers" validate constraint "usce_offers_request_id_fkey";
alter table "command_center"."usce_offers" add constraint "usce_offers_response_check" CHECK (((response IS NULL) OR (response = ANY (ARRAY['ACCEPTED'::text, 'DECLINED'::text])))) not valid;
alter table "command_center"."usce_offers" validate constraint "usce_offers_response_check";
alter table "command_center"."usce_offers" add constraint "usce_offers_retry_count_check" CHECK (((retry_count >= 0) AND (retry_count <= 2))) not valid;
alter table "command_center"."usce_offers" validate constraint "usce_offers_retry_count_check";
alter table "command_center"."usce_offers" add constraint "usce_offers_revoked_by_fkey" FOREIGN KEY (revoked_by) REFERENCES auth.users(id) not valid;
alter table "command_center"."usce_offers" validate constraint "usce_offers_revoked_by_fkey";
alter table "command_center"."usce_offers" add constraint "usce_offers_status_check" CHECK ((status = ANY (ARRAY['DRAFT'::text, 'PREVIEWED'::text, 'APPROVED'::text, 'SENT'::text, 'REMINDED'::text, 'ACCEPTED'::text, 'PENDING_PAYMENT'::text, 'PAID'::text, 'FAILED_PAYMENT'::text, 'DECLINED'::text, 'EXPIRED'::text, 'INVALIDATED'::text, 'REVOKED'::text]))) not valid;
alter table "command_center"."usce_offers" validate constraint "usce_offers_status_check";
alter table "command_center"."usce_outbox" add constraint "usce_outbox_idempotency_key_key" UNIQUE using index "usce_outbox_idempotency_key_key";
alter table "command_center"."usce_outbox" add constraint "usce_outbox_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'compensated'::text]))) not valid;
alter table "command_center"."usce_outbox" validate constraint "usce_outbox_status_check";
alter table "command_center"."usce_postmark_events" add constraint "usce_postmark_events_event_type_check" CHECK ((event_type = ANY (ARRAY['Delivery'::text, 'Open'::text, 'Bounce'::text, 'SpamComplaint'::text, 'Inbound'::text]))) not valid;
alter table "command_center"."usce_postmark_events" validate constraint "usce_postmark_events_event_type_check";
alter table "command_center"."usce_program_seats" add constraint "usce_program_seats_check" CHECK ((((seats_held_soft + seats_held_hard) + seats_filled) <= seats_total)) not valid;
alter table "command_center"."usce_program_seats" validate constraint "usce_program_seats_check";
alter table "command_center"."usce_program_seats" add constraint "usce_program_seats_seats_filled_check" CHECK ((seats_filled >= 0)) not valid;
alter table "command_center"."usce_program_seats" validate constraint "usce_program_seats_seats_filled_check";
alter table "command_center"."usce_program_seats" add constraint "usce_program_seats_seats_held_hard_check" CHECK ((seats_held_hard >= 0)) not valid;
alter table "command_center"."usce_program_seats" validate constraint "usce_program_seats_seats_held_hard_check";
alter table "command_center"."usce_program_seats" add constraint "usce_program_seats_seats_held_soft_check" CHECK ((seats_held_soft >= 0)) not valid;
alter table "command_center"."usce_program_seats" validate constraint "usce_program_seats_seats_held_soft_check";
alter table "command_center"."usce_program_seats" add constraint "usce_program_seats_seats_total_check" CHECK ((seats_total >= 0)) not valid;
alter table "command_center"."usce_program_seats" validate constraint "usce_program_seats_seats_total_check";
alter table "command_center"."usce_requests" add constraint "usce_requests_applicant_email_check" CHECK ((applicant_email OPERATOR(public.~*) '^[^@\s]+@[^@\s]+\.[^@\s]+$'::public.citext)) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_applicant_email_check";
alter table "command_center"."usce_requests" add constraint "usce_requests_applicant_name_check" CHECK (((length(applicant_name) >= 2) AND (length(applicant_name) <= 200))) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_applicant_name_check";
alter table "command_center"."usce_requests" add constraint "usce_requests_applicant_phone_e164_check" CHECK (((applicant_phone_e164 IS NULL) OR (applicant_phone_e164 ~ '^\\+[1-9][0-9]{6,14}$'::text))) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_applicant_phone_e164_check";
alter table "command_center"."usce_requests" add constraint "usce_requests_assigned_coordinator_id_fkey" FOREIGN KEY (assigned_coordinator_id) REFERENCES auth.users(id) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_assigned_coordinator_id_fkey";
alter table "command_center"."usce_requests" add constraint "usce_requests_check" CHECK (((NOT (preference_rankings ? 'specialties'::text)) OR ((jsonb_typeof((preference_rankings -> 'specialties'::text)) = 'array'::text) AND (jsonb_array_length((preference_rankings -> 'specialties'::text)) = COALESCE(array_length(preferred_specialties, 1), 0))))) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_check";
alter table "command_center"."usce_requests" add constraint "usce_requests_check1" CHECK (((NOT (preference_rankings ? 'locations'::text)) OR ((jsonb_typeof((preference_rankings -> 'locations'::text)) = 'array'::text) AND (jsonb_array_length((preference_rankings -> 'locations'::text)) = COALESCE(array_length(preferred_locations, 1), 0))))) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_check1";
alter table "command_center"."usce_requests" add constraint "usce_requests_check2" CHECK (((NOT (preference_rankings ? 'months'::text)) OR ((jsonb_typeof((preference_rankings -> 'months'::text)) = 'array'::text) AND (jsonb_array_length((preference_rankings -> 'months'::text)) = COALESCE(array_length(preferred_months, 1), 0))))) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_check2";
alter table "command_center"."usce_requests" add constraint "usce_requests_preference_rankings_check" CHECK ((jsonb_typeof(preference_rankings) = 'object'::text)) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_preference_rankings_check";
alter table "command_center"."usce_requests" add constraint "usce_requests_preferred_locations_check" CHECK (((array_length(preferred_locations, 1) IS NULL) OR ((array_length(preferred_locations, 1) >= 1) AND (array_length(preferred_locations, 1) <= 3)))) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_preferred_locations_check";
alter table "command_center"."usce_requests" add constraint "usce_requests_preferred_locations_check1" CHECK (command_center.usce_text_array_is_unique(preferred_locations)) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_preferred_locations_check1";
alter table "command_center"."usce_requests" add constraint "usce_requests_preferred_months_check" CHECK (((array_length(preferred_months, 1) IS NULL) OR ((array_length(preferred_months, 1) >= 1) AND (array_length(preferred_months, 1) <= 3)))) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_preferred_months_check";
alter table "command_center"."usce_requests" add constraint "usce_requests_preferred_months_check1" CHECK (command_center.usce_date_array_is_unique(preferred_months)) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_preferred_months_check1";
alter table "command_center"."usce_requests" add constraint "usce_requests_preferred_months_check2" CHECK (command_center.usce_date_array_not_past(preferred_months)) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_preferred_months_check2";
alter table "command_center"."usce_requests" add constraint "usce_requests_preferred_specialties_check" CHECK (((array_length(preferred_specialties, 1) IS NULL) OR ((array_length(preferred_specialties, 1) >= 1) AND (array_length(preferred_specialties, 1) <= 3)))) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_preferred_specialties_check";
alter table "command_center"."usce_requests" add constraint "usce_requests_preferred_specialties_check1" CHECK (command_center.usce_text_array_is_unique(preferred_specialties)) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_preferred_specialties_check1";
alter table "command_center"."usce_requests" add constraint "usce_requests_program_seat_id_fkey" FOREIGN KEY (program_seat_id) REFERENCES command_center.usce_program_seats(id) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_program_seat_id_fkey";
alter table "command_center"."usce_requests" add constraint "usce_requests_sla_breach_reason_check" CHECK (((sla_breach_reason IS NULL) OR (sla_breach_reason = ANY (ARRAY['unclaimed'::text, 'no_offer_created'::text, 'admin_waived'::text])))) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_sla_breach_reason_check";
alter table "command_center"."usce_requests" add constraint "usce_requests_sla_status_check" CHECK ((sla_status = ANY (ARRAY['on_track'::text, 'at_risk'::text, 'breached'::text, 'met'::text, 'waived'::text]))) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_sla_status_check";
alter table "command_center"."usce_requests" add constraint "usce_requests_source_check" CHECK ((source = ANY (ARRAY['public_form'::text, 'manual_coordinator'::text, 'partner_referral'::text]))) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_source_check";
alter table "command_center"."usce_requests" add constraint "usce_requests_status_check" CHECK ((status = ANY (ARRAY['NEW'::text, 'IN_REVIEW'::text, 'OFFERED'::text, 'FULFILLED'::text, 'EXPIRED'::text, 'CANCELLED'::text, 'ARCHIVED'::text]))) not valid;
alter table "command_center"."usce_requests" validate constraint "usce_requests_status_check";
alter table "command_center"."usce_retention" add constraint "usce_retention_by_user_fkey" FOREIGN KEY (by_user) REFERENCES auth.users(id) not valid;
alter table "command_center"."usce_retention" validate constraint "usce_retention_by_user_fkey";
alter table "command_center"."usce_retention" add constraint "usce_retention_request_id_fkey" FOREIGN KEY (request_id) REFERENCES command_center.usce_requests(id) not valid;
alter table "command_center"."usce_retention" validate constraint "usce_retention_request_id_fkey";
alter table "public"."attempts" add constraint "attempts_duel_id_fkey" FOREIGN KEY (duel_id) REFERENCES public.duels(id) ON DELETE CASCADE not valid;
alter table "public"."attempts" validate constraint "attempts_duel_id_fkey";
alter table "public"."attempts" add constraint "attempts_duel_id_user_id_key" UNIQUE using index "attempts_duel_id_user_id_key";
alter table "public"."con_daily_diagnosis" add constraint "con_daily_diagnosis_report_date_key" UNIQUE using index "con_daily_diagnosis_report_date_key";
alter table "public"."con_daily_metrics" add constraint "con_daily_metrics_report_date_key" UNIQUE using index "con_daily_metrics_report_date_key";
alter table "public"."con_kpi_targets" add constraint "con_kpi_targets_metric_name_key" UNIQUE using index "con_kpi_targets_metric_name_key";
alter table "public"."duel_challenges" add constraint "duel_challenges_dataset_version_fk" FOREIGN KEY (dataset_version) REFERENCES public.dataset_registry(dataset_version) DEFERRABLE not valid;
alter table "public"."duel_challenges" validate constraint "duel_challenges_dataset_version_fk";
alter table "public"."missionmed_action_queue" add constraint "missionmed_action_queue_email_unique" UNIQUE using index "missionmed_action_queue_email_unique";
alter table "public"."missionmed_email_threads" add constraint "missionmed_email_threads_email_unique" UNIQUE using index "missionmed_email_threads_email_unique";
alter table "public"."missionmed_lead_scores" add constraint "missionmed_lead_scores_email_unique" UNIQUE using index "missionmed_lead_scores_email_unique";
alter table "public"."profiles" add constraint "profiles_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;
alter table "public"."profiles" validate constraint "profiles_auth_user_id_fkey";
alter table "public"."profiles" add constraint "profiles_email_key" UNIQUE using index "profiles_email_key";
alter table "public"."rank_lists" add constraint "rank_lists_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;
alter table "public"."rank_lists" validate constraint "rank_lists_profile_id_fkey";
alter table "public"."ranklist_submissions" add constraint "ranklist_submissions_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."ranklist_submissions" validate constraint "ranklist_submissions_auth_user_id_fkey";
alter table "public"."ranklist_versions" add constraint "ranklist_versions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."ranklist_versions" validate constraint "ranklist_versions_created_by_fkey";
alter table "public"."ranklist_versions" add constraint "ranklist_versions_ranklist_id_fkey" FOREIGN KEY (ranklist_id) REFERENCES public.ranklists(id) ON DELETE CASCADE not valid;
alter table "public"."ranklist_versions" validate constraint "ranklist_versions_ranklist_id_fkey";
alter table "public"."ranklists" add constraint "ranklists_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."ranklists" validate constraint "ranklists_user_id_fkey";
alter table "public"."ranklists" add constraint "ranklists_user_id_unique" UNIQUE using index "ranklists_user_id_unique";
alter table "public"."user_program_interviews" add constraint "user_program_interviews_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."user_program_interviews" validate constraint "user_program_interviews_user_id_fkey";
alter table "public"."duel_challenges" add constraint "duel_challenges_state_canonical_ck" CHECK ((state = ANY (ARRAY['pending'::text, 'active'::text, 'finalized'::text, 'void'::text, 'created'::text, 'accepted'::text, 'player1_complete'::text, 'player2_complete'::text, 'completed'::text, 'expired'::text, 'settled'::text]))) not valid;
alter table "public"."duel_challenges" validate constraint "duel_challenges_state_canonical_ck";
alter table "public"."match_attempts" add constraint "match_attempts_match_id_fkey" FOREIGN KEY (match_id) REFERENCES public.duels(id) not valid;
alter table "public"."match_attempts" validate constraint "match_attempts_match_id_fkey";
alter table "public"."question_attempts" add constraint "question_attempts_match_id_fkey" FOREIGN KEY (match_id) REFERENCES public.duels(id) not valid;
alter table "public"."question_attempts" validate constraint "question_attempts_match_id_fkey";
set check_function_bodies = off;
CREATE OR REPLACE FUNCTION command_center.audit_trigger_fn()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_actor_role text := 'system';
  v_actor_id uuid := auth.uid();
  v_mm_role text := COALESCE(auth.jwt() -> 'app_metadata' ->> 'mm_role', '');
  v_entity_id uuid;
  v_diff jsonb := '{}'::jsonb;
BEGIN
  IF v_mm_role IN ('coordinator', 'admin') THEN
    v_actor_role := v_mm_role;
  ELSIF v_actor_id IS NOT NULL THEN
    v_actor_role := 'anon';
  ELSIF COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    v_actor_role := 'system';
  ELSE
    v_actor_role := 'anon';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_entity_id := NEW.id;
    v_diff := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := NEW.id;
    v_diff := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE
    v_entity_id := OLD.id;
    v_diff := jsonb_build_object('old', to_jsonb(OLD));
  END IF;

  INSERT INTO command_center.usce_audit (entity_table, entity_id, action, actor_role, actor_id, diff)
  VALUES (TG_TABLE_NAME, v_entity_id, TG_OP, v_actor_role, v_actor_id, v_diff);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION command_center.enforce_amount_immutability()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
     AND OLD.status NOT IN ('DRAFT', 'PREVIEWED') THEN
    RAISE EXCEPTION 'AMOUNT_IMMUTABLE';
  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION command_center.enforce_offer_limit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_active_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_active_count
  FROM command_center.usce_offers o
  WHERE o.request_id = NEW.request_id
    AND o.status IN (
      'DRAFT',
      'PREVIEWED',
      'APPROVED',
      'SENT',
      'REMINDED',
      'ACCEPTED',
      'PENDING_PAYMENT',
      'FAILED_PAYMENT',
      'PAID'
    );

  IF v_active_count >= 3 THEN
    RAISE EXCEPTION 'OFFER_LIMIT_REACHED';
  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION command_center.enforce_portal_mutation_surface()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_portal_token text := current_setting('request.portal_token', true);
BEGIN
  IF v_portal_token IS NULL OR btrim(v_portal_token) = '' THEN
    RETURN NEW;
  END IF;

  IF NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
     OR NEW.subject IS DISTINCT FROM OLD.subject
     OR NEW.html_body IS DISTINCT FROM OLD.html_body
     OR NEW.text_body IS DISTINCT FROM OLD.text_body
     OR NEW.portal_token_hash IS DISTINCT FROM OLD.portal_token_hash
     OR NEW.portal_token_encrypted IS DISTINCT FROM OLD.portal_token_encrypted
     OR NEW.program_seat_id IS DISTINCT FROM OLD.program_seat_id THEN
    RAISE EXCEPTION 'PORTAL_MUTATION_FORBIDDEN';
  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION command_center.enforce_preview_before_approval()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'APPROVED' AND OLD.status IS DISTINCT FROM 'APPROVED' THEN
    IF OLD.status IS DISTINCT FROM 'PREVIEWED' THEN
      RAISE EXCEPTION 'PREVIEW_REQUIRED_FOR_APPROVAL';
    END IF;

    IF NEW.approved_subject_body_hash IS NULL
       OR NEW.preview_subject_body_hash IS NULL
       OR NEW.approved_subject_body_hash IS DISTINCT FROM NEW.preview_subject_body_hash THEN
      RAISE EXCEPTION 'APPROVAL_HASH_MISMATCH';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION command_center.sha256(p_input bytea)
 RETURNS bytea
 LANGUAGE sql
 IMMUTABLE STRICT
AS $function$
  SELECT digest(p_input, 'sha256');
$function$;
CREATE OR REPLACE FUNCTION command_center.usce_date_array_is_unique(p_values date[])
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT p_values IS NULL OR cardinality(p_values) = cardinality(ARRAY(SELECT DISTINCT v FROM unnest(p_values) AS v));
$function$;
CREATE OR REPLACE FUNCTION command_center.usce_date_array_not_past(p_values date[])
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  SELECT p_values IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(p_values) AS m WHERE m < current_date);
$function$;
CREATE OR REPLACE FUNCTION command_center.usce_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION command_center.usce_text_array_is_unique(p_values text[])
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT p_values IS NULL OR cardinality(p_values) = cardinality(ARRAY(SELECT DISTINCT v FROM unnest(p_values) AS v));
$function$;
CREATE OR REPLACE FUNCTION public._resolve_duel(p_duel_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a1 record;
  a2 record;
begin
  select * into a1 from public.attempts where duel_id = p_duel_id limit 1;
  select * into a2 from public.attempts where duel_id = p_duel_id offset 1 limit 1;
  if a1 is not null and a2 is not null then
    update public.duels
    set status = 'completed',
        winner_id =
          case
            when a1.correct_count > a2.correct_count then a1.user_id
            when a2.correct_count > a1.correct_count then a2.user_id
            when a1.total_time_ms < a2.total_time_ms then a1.user_id
            when a2.total_time_ms < a1.total_time_ms then a2.user_id
            else null
          end
    where id = p_duel_id;
  end if;
end;
$function$;
CREATE OR REPLACE FUNCTION public.accept_duel(p_duel_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.duels
  set status = 'active'
  where id = p_duel_id
    and opponent_id = auth.uid();
  return json_build_object('ok', true);
end;
$function$;
create or replace view "public"."admin_latest_ranklist_snapshots" as  WITH latest_versions AS (
         SELECT DISTINCT ON (rv.ranklist_id) rv.ranklist_id,
            rv.created_at,
            rv.snapshot
           FROM public.ranklist_versions rv
          ORDER BY rv.ranklist_id, rv.created_at DESC
        )
 SELECT r.id AS ranklist_id,
    p.first_name,
    p.last_name,
    p.email,
    lv.created_at AS latest_snapshot_time,
    length((lv.snapshot)::text) AS snapshot_size
   FROM ((latest_versions lv
     JOIN public.ranklists r ON ((r.id = lv.ranklist_id)))
     LEFT JOIN public.profiles p ON ((p.id = r.user_id)));
create or replace view "public"."admin_ranklist_overview" as  SELECT r.id AS ranklist_id,
    p.id AS user_uuid,
    p.first_name,
    p.last_name,
    p.email,
    r.title,
    r.specialty,
    r.cycle_year,
    r.updated_at
   FROM (public.ranklists r
     LEFT JOIN public.profiles p ON ((r.user_id = p.id)));
CREATE OR REPLACE FUNCTION public.check_ghost_eligibility(p_user_id uuid, p_match_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_eligible boolean := false;
  v_reason text := 'ghost_mode_not_available';
  v_match_exists boolean;
BEGIN
  -- --------------------------------------------------------
  -- 1. Validate match exists
  -- --------------------------------------------------------
  SELECT EXISTS(
    SELECT 1 FROM match_attempts
    WHERE match_id = p_match_id
      AND user_id = p_user_id
  ) INTO v_match_exists;

  -- --------------------------------------------------------
  -- 2. Beta: always return false
  --    Future extension points (uncomment when ready):
  --    - Check user ghost_opt_in setting
  --    - Check dataset_version compatibility
  --    - Check rate limits (max 3 ghost replays per parent_match_id per 24h)
  --    - Check block list (user_relationships)
  --    - Check visibility settings
  -- --------------------------------------------------------

  -- Future: ghost consent check
  -- SELECT ghost_opt_in INTO v_ghost_opted_in
  -- FROM user_settings WHERE user_id = p_user_id;
  -- IF NOT v_ghost_opted_in THEN
  --   v_reason := 'user_not_opted_in';
  -- END IF;

  -- Future: dataset version compatibility
  -- SELECT dataset_version INTO v_ds_version
  -- FROM match_attempts WHERE match_id = p_match_id AND user_id = p_user_id;
  -- IF v_ds_version != current_active_dataset_version() THEN
  --   v_reason := 'dataset_version_outdated';
  -- END IF;

  -- Future: rate limit check
  -- SELECT COUNT(*) INTO v_replay_count
  -- FROM match_attempts
  -- WHERE user_id = auth.uid()
  --   AND parent_match_id = p_match_id
  --   AND mode_type IN ('ghost_replay', 'self_replay')
  --   AND created_at > now() - interval '24 hours';
  -- IF v_replay_count >= 3 THEN
  --   v_reason := 'replay_rate_limit_exceeded';
  -- END IF;

  RETURN jsonb_build_object(
    'eligible', v_eligible,
    'reason', v_reason,
    'match_exists', v_match_exists,
    'phase', 'beta_placeholder'
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.create_bot_duel()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok',false,'error','unauthenticated');
  end if;

  insert into public.duels (created_by, opponent_id, is_bot, status, accepted_at)
  values (v_uid, null, true, 'accepted', now())
  returning id into v_id;

  return jsonb_build_object('ok',true,'data', jsonb_build_object(
    'duel_id', v_id,
    'status','accepted',
    'is_bot', true
  ));
end $function$;
CREATE OR REPLACE FUNCTION public.create_duel(p_opponent_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_duel public.duels;
begin
  insert into public.duels (creator_id, opponent_id, status)
  values (auth.uid(), p_opponent_id, 'pending')
  returning * into v_duel;
  return json_build_object('ok', true, 'data', json_build_object('duel', v_duel));
end;
$function$;
CREATE OR REPLACE FUNCTION public.create_duel(p_opponent_id uuid DEFAULT NULL::uuid, p_question_set jsonb DEFAULT NULL::jsonb, p_idempotency_key text DEFAULT NULL::text, p_is_bot_match boolean DEFAULT false, p_bot_profile_id uuid DEFAULT NULL::uuid, p_source text DEFAULT 'direct'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_duel public.duel_challenges%rowtype;
  v_existing public.duel_challenges%rowtype;
  v_question_set jsonb;
  v_bot_id uuid;
  v_bot_run jsonb;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency_key_required';
  end if;

  perform public.ensure_player_profile(v_actor);

  select * into v_existing
  from public.duel_challenges
  where challenger_id = v_actor
    and create_idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object('status', 'ok', 'idempotent', true, 'duel', to_jsonb(v_existing));
  end if;

  if p_question_set is null
    or jsonb_typeof(p_question_set) <> 'array'
    or jsonb_array_length(p_question_set) = 0
  then
    v_question_set := public.private_default_question_set(10);
  else
    v_question_set := p_question_set;
  end if;

  if p_is_bot_match then
    if p_bot_profile_id is null then
      select id into v_bot_id
      from public.bot_profiles
      where active = true
      order by
        case tier
          when 'resident' then 1
          when 'attending' then 2
          else 3
        end,
        created_at
      limit 1;
    else
      v_bot_id := p_bot_profile_id;
    end if;

    if v_bot_id is null then
      raise exception 'no_active_bot_profiles';
    end if;

    insert into public.duel_challenges (
      challenger_id,
      opponent_id,
      is_bot_match,
      bot_profile_id,
      is_ranked,
      source,
      question_set,
      state,
      create_idempotency_key,
      accepted_at,
      challenge_expires_at,
      match_expires_at
    )
    values (
      v_actor,
      null,
      true,
      v_bot_id,
      false,
      coalesce(nullif(btrim(p_source), ''), 'bot'),
      v_question_set,
      'accepted',
      p_idempotency_key,
      now(),
      now(),
      now() + interval '48 hours'
    )
    returning * into v_duel;

    perform public.private_append_duel_event(
      v_duel.id,
      'challenge_created',
      format('%s:create', p_idempotency_key),
      v_actor,
      null,
      null,
      null,
      null,
      jsonb_build_object('is_bot_match', true, 'bot_profile_id', v_bot_id)
    );

    perform public.private_append_duel_event(
      v_duel.id,
      'challenge_accepted',
      format('%s:accept', p_idempotency_key),
      null,
      v_bot_id,
      null,
      null,
      null,
      jsonb_build_object('auto_accept', true)
    );

    v_bot_run := public.private_generate_bot_attempt(v_duel.id, v_bot_id);

    return jsonb_build_object(
      'status', 'ok',
      'duel', to_jsonb(v_duel),
      'bot_run', v_bot_run
    );
  end if;

  if p_opponent_id is null then
    raise exception 'opponent_id_required_for_human_duel';
  end if;

  if p_opponent_id = v_actor then
    raise exception 'cannot_challenge_self';
  end if;

  perform public.ensure_player_profile(p_opponent_id);

  -- Block duplicate active challenges to same target.
  select * into v_existing
  from public.duel_challenges d
  where d.challenger_id = v_actor
    and d.opponent_id = p_opponent_id
    and d.state in ('created', 'pending', 'accepted', 'player1_complete', 'player2_complete')
  order by d.created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'status', 'exists',
      'duel', to_jsonb(v_existing),
      'message', 'active_duel_already_exists'
    );
  end if;

  insert into public.duel_challenges (
    challenger_id,
    opponent_id,
    is_bot_match,
    bot_profile_id,
    is_ranked,
    source,
    question_set,
    state,
    create_idempotency_key,
    challenge_expires_at
  )
  values (
    v_actor,
    p_opponent_id,
    false,
    null,
    true,
    coalesce(nullif(btrim(p_source), ''), 'direct'),
    v_question_set,
    'pending',
    p_idempotency_key,
    now() + interval '24 hours'
  )
  returning * into v_duel;

  perform public.private_append_duel_event(
    v_duel.id,
    'challenge_created',
    format('%s:create', p_idempotency_key),
    v_actor,
    null,
    null,
    null,
    null,
    jsonb_build_object('is_bot_match', false, 'opponent_id', p_opponent_id)
  );

  return jsonb_build_object('status', 'ok', 'duel', to_jsonb(v_duel));
end;
$function$;
CREATE OR REPLACE FUNCTION public.digest(p_data bytea, p_type text)
 RETURNS bytea
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
AS $function$ SELECT extensions.digest(p_data, p_type); $function$;
CREATE OR REPLACE FUNCTION public.digest(p_data text, p_type text)
 RETURNS bytea
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
AS $function$ SELECT extensions.digest(p_data, p_type); $function$;
CREATE OR REPLACE FUNCTION public.duel_replay_payload(p_match_id uuid, p_target_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid;
  v_target_id uuid;
  v_match_row jsonb;
  v_questions jsonb;
  v_terminal_count int;
  v_pack_question_count int;
  v_duplicate_seq_count int;
  v_hash_values text[];
  v_hash_distinct int;
  v_warnings jsonb := '[]'::jsonb;
  v_caller_match_row record;
BEGIN
  -- --------------------------------------------------------
  -- 1. Auth gate
  -- --------------------------------------------------------
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'auth_required',
      'message', 'Authentication required'
    );
  END IF;

  -- --------------------------------------------------------
  -- 2. Resolve target user (default = self)
  -- --------------------------------------------------------
  v_target_id := COALESCE(p_target_user_id, v_caller_id);

  -- --------------------------------------------------------
  -- 3. Ghost gate: block non-self replays (beta)
  -- --------------------------------------------------------
  IF v_target_id != v_caller_id THEN
    -- Future: check consent via check_ghost_eligibility()
    -- For beta: always block with structured error
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'ghost_consent_required',
      'message', 'Ghost replay requires target user opt-in consent. This feature is not yet available.'
    );
  END IF;

  -- --------------------------------------------------------
  -- 4. Fetch match_attempt row for the target user
  -- --------------------------------------------------------
  SELECT jsonb_build_object(
    'id',                   ma.id,
    'match_id',             ma.match_id,
    'user_id',              ma.user_id,
    'session_id',           ma.session_id,
    'mode_type',            ma.mode_type,
    'dataset_version',      ma.dataset_version,
    'content_hash',         ma.content_hash,
    'pack_question_count',  ma.pack_question_count,
    'result_state',         ma.result_state,
    'scoring_version',      ma.scoring_version,
    'score_raw',            ma.score_raw,
    'score_normalized',     ma.score_normalized,
    'created_at',           ma.created_at,
    'updated_at',           ma.updated_at
  ),
  ma.pack_question_count
  INTO v_match_row, v_pack_question_count
  FROM match_attempts ma
  WHERE ma.match_id = p_match_id
    AND ma.user_id = v_target_id;

  IF v_match_row IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'match_not_found',
      'message', 'No match_attempt found for the given match_id and target user'
    );
  END IF;

  -- --------------------------------------------------------
  -- 5. Ghost version compatibility check (for future use)
  --    When ghost mode is enabled, verify dataset_version
  --    and content_hash match between caller and target.
  -- --------------------------------------------------------
  IF v_target_id != v_caller_id THEN
    SELECT * INTO v_caller_match_row
    FROM match_attempts
    WHERE match_id = p_match_id
      AND user_id = v_caller_id;

    IF v_caller_match_row IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'replay_version_mismatch',
        'message', 'Caller has no match_attempt for this match_id'
      );
    END IF;

    IF v_caller_match_row.dataset_version != (v_match_row->>'dataset_version')
       OR v_caller_match_row.content_hash != (v_match_row->>'content_hash') THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'replay_version_mismatch',
        'message', 'dataset_version or content_hash mismatch between caller and target match'
      );
    END IF;
  END IF;

  -- --------------------------------------------------------
  -- 6. Fetch question_attempts ordered by server_sequence_index ASC
  -- --------------------------------------------------------
  SELECT jsonb_agg(
    jsonb_build_object(
      'question_id',                              qa.question_id,
      'server_sequence_index',                    qa.server_sequence_index,
      'displayed_choices_order',                  qa.displayed_choices_order,
      'computed_correct_index_after_permutation',  qa.computed_correct_index_after_permutation,
      'selected_index',                           qa.selected_index,
      'correct',                                  qa.correct,
      'result_state',                             qa.result_state,
      'question_started_at',                      qa.question_started_at,
      'question_answered_at',                     qa.question_answered_at,
      'time_to_first_answer_ms',                  qa.time_to_first_answer_ms,
      'total_time_on_question_ms',                qa.total_time_on_question_ms,
      'content_hash',                             qa.content_hash,
      'dataset_version',                          qa.dataset_version
    )
    ORDER BY qa.server_sequence_index ASC
  )
  INTO v_questions
  FROM question_attempts qa
  WHERE qa.match_id = p_match_id
    AND qa.user_id = v_target_id;

  IF v_questions IS NULL THEN
    v_questions := '[]'::jsonb;
  END IF;

  -- --------------------------------------------------------
  -- 7. Integrity checks (warn, do not block)
  -- --------------------------------------------------------

  -- 7a. terminal_count vs pack_question_count
  SELECT COUNT(*)
  INTO v_terminal_count
  FROM question_attempts qa
  WHERE qa.match_id = p_match_id
    AND qa.user_id = v_target_id
    AND qa.result_state NOT IN ('presented', 'pending');

  IF v_terminal_count != v_pack_question_count THEN
    v_warnings := v_warnings || jsonb_build_array(
      jsonb_build_object(
        'code', 'terminal_count_mismatch',
        'detail', format('terminal_count=%s but pack_question_count=%s', v_terminal_count, v_pack_question_count)
      )
    );
  END IF;

  -- 7b. Duplicate server_sequence_index values
  SELECT COUNT(*) - COUNT(DISTINCT qa.server_sequence_index)
  INTO v_duplicate_seq_count
  FROM question_attempts qa
  WHERE qa.match_id = p_match_id
    AND qa.user_id = v_target_id;

  IF v_duplicate_seq_count > 0 THEN
    v_warnings := v_warnings || jsonb_build_array(
      jsonb_build_object(
        'code', 'duplicate_sequence_index',
        'detail', format('%s duplicate server_sequence_index values detected', v_duplicate_seq_count)
      )
    );
  END IF;

  -- 7c. content_hash consistency across all question_attempt rows
  SELECT array_agg(DISTINCT qa.content_hash)
  INTO v_hash_values
  FROM question_attempts qa
  WHERE qa.match_id = p_match_id
    AND qa.user_id = v_target_id;

  v_hash_distinct := COALESCE(array_length(v_hash_values, 1), 0);

  IF v_hash_distinct > 1 THEN
    v_warnings := v_warnings || jsonb_build_array(
      jsonb_build_object(
        'code', 'content_hash_inconsistency',
        'detail', format('%s distinct content_hash values found across question_attempts', v_hash_distinct)
      )
    );
  END IF;

  -- --------------------------------------------------------
  -- 8. Return payload
  -- --------------------------------------------------------
  RETURN jsonb_build_object(
    'ok', true,
    'match_attempt', v_match_row,
    'question_attempts', v_questions,
    'question_count', jsonb_array_length(v_questions),
    'warnings', v_warnings
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.finalize_rank_list(p_match_cycle integer, p_rank_list_json jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Insert FINAL (unique index will enforce only one per cycle)
  insert into public.rank_lists (profile_id, match_cycle, is_final, rank_list_json)
  values (v_uid, p_match_cycle, true, coalesce(p_rank_list_json, '{}'::jsonb));

  -- Unlock Oracle in the unified profile (stored in extra_data)
  update public.profiles
  set extra_data = jsonb_set(
        coalesce(extra_data, '{}'::jsonb),
        '{oracle_unlocked}',
        'true'::jsonb,
        true
      ),
      updated_at = now()
  where id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'match_cycle', p_match_cycle,
    'oracle_unlocked', true
  );

exception
  when unique_violation then
    return jsonb_build_object(
      'ok', false,
      'error', 'FINAL_ALREADY_EXISTS',
      'message', 'Final submission already recorded for this match cycle.'
    );
end;
$function$;
CREATE OR REPLACE FUNCTION public.finalize_ranklist(p_ranklist_id uuid)
 RETURNS public.ranklists
 LANGUAGE plpgsql
AS $function$
declare
  v_row public.ranklists;
begin
  -- Must be your ranklist
  select *
    into v_row
  from public.ranklists rl
  where rl.id = p_ranklist_id
    and rl.user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Not allowed';
  end if;

  if v_row.is_final = true then
    raise exception 'Ranklist already finalized';
  end if;

  if coalesce(v_row.finalize_tokens_remaining, 0) <= 0 then
    raise exception 'No finalize tokens remaining';
  end if;

  update public.ranklists
  set
    is_final = true,
    finalized_at = now(),
    finalize_tokens_remaining = finalize_tokens_remaining - 1,
    updated_at = now()
  where id = p_ranklist_id
    and user_id = auth.uid()
  returning * into v_row;

  return v_row;
end;
$function$;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;
CREATE OR REPLACE FUNCTION public.submit_attempt(p_duel_id uuid, p_answers jsonb, p_total_time_ms integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_correct int;
begin
  v_correct := jsonb_array_length(p_answers);
  insert into public.attempts (duel_id, user_id, correct_count, total_time_ms, answers_json)
  values (p_duel_id, auth.uid(), v_correct, p_total_time_ms, p_answers)
  on conflict (duel_id, user_id) do nothing;
  perform public._resolve_duel(p_duel_id);
  return json_build_object('ok', true);
end;
$function$;
CREATE OR REPLACE FUNCTION public.trim_ranklist_drafts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  -- only apply to drafts
  if (new.is_final = false) then
    delete from public.rank_lists rl
    where rl.profile_id = new.profile_id
      and rl.match_cycle = new.match_cycle
      and rl.is_final = false
      and rl.id not in (
        select id
        from public.rank_lists
        where profile_id = new.profile_id
          and match_cycle = new.match_cycle
          and is_final = false
        order by submitted_at desc, created_at desc
        limit 3
      );
  end if;

  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.accept_duel(p_duel_id uuid, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_duel public.duel_challenges%rowtype;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency_key_required';
  end if;

  perform public.ensure_player_profile(v_actor);

  select * into v_duel
  from public.duel_challenges
  where id = p_duel_id
  for update;

  if not found then
    return jsonb_build_object('status', 'error', 'code', 'duel_not_found');
  end if;

  if v_duel.is_bot_match then
    return jsonb_build_object('status', 'error', 'code', 'bot_duel_auto_accepted');
  end if;

  if v_duel.opponent_id is distinct from v_actor then
    return jsonb_build_object('status', 'error', 'code', 'not_duel_opponent');
  end if;

  if exists (
    select 1
    from public.duel_events e
    where e.duel_id = p_duel_id
      and e.idempotency_key = p_idempotency_key
  ) then
    return jsonb_build_object('status', 'ok', 'idempotent', true, 'duel', to_jsonb(v_duel));
  end if;

  if v_duel.state in ('completed', 'expired', 'settled') then
    return jsonb_build_object('status', 'ok', 'duel', to_jsonb(v_duel), 'message', 'already_terminal');
  end if;

  if now() > v_duel.challenge_expires_at then
    return public.private_finalize_duel_core(p_duel_id, format('%s:expired', p_idempotency_key));
  end if;

  if v_duel.state in ('created', 'pending') then
    update public.duel_challenges
    set
      state = 'accepted',
      accepted_at = now(),
      match_expires_at = now() + interval '48 hours',
      updated_at = now()
    where id = p_duel_id
    returning * into v_duel;
  end if;

  perform public.private_append_duel_event(
    p_duel_id,
    'challenge_accepted',
    p_idempotency_key,
    v_actor,
    null,
    null,
    null,
    null,
    jsonb_build_object('accepted_at', now())
  );

  return jsonb_build_object('status', 'ok', 'duel', to_jsonb(v_duel));
end;
$function$;
CREATE OR REPLACE FUNCTION public.answer_map_for(p_question_ids text[], p_dataset_version text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
        select 1 from public.dataset_registry where dataset_version = p_dataset_version
    ) then
        raise exception 'dataset_version_unknown' using errcode = 'P0001';
    end if;

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
$function$;
CREATE OR REPLACE FUNCTION public.complete_match(p_match_id uuid, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid; v_target_user uuid; v_attempt record;
  v_total_count integer; v_correct_count integer; v_non_terminal_count integer;
  v_avg_time numeric; v_accuracy_pct numeric; v_difficulty_bonus numeric;
  v_speed_bonus numeric; v_score_raw integer; v_score_normalized numeric(7,4);
  v_updated record; c_speed_ceiling_ms constant integer := 30000;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'STAT_AUTH_REQUIRED: Authentication required' USING ERRCODE = 'P0001'; END IF;
  v_target_user := COALESCE(p_user_id, v_uid);
  IF v_target_user <> v_uid THEN RAISE EXCEPTION 'STAT_MATCH_FORBIDDEN: Cannot complete match for another user' USING ERRCODE = 'P0001'; END IF;
  SELECT id, match_id, user_id, result_state, score_raw, score_normalized, pack_question_count, scoring_version INTO v_attempt FROM public.match_attempts WHERE match_id = p_match_id AND user_id = v_target_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAT_MATCH_NOT_FOUND: No match_attempt for match % user %', p_match_id, v_target_user USING ERRCODE = 'P0001'; END IF;
  IF v_attempt.result_state = 'completed' THEN RETURN jsonb_build_object('status','already_completed','match_attempt',jsonb_build_object('id',v_attempt.id,'match_id',v_attempt.match_id,'user_id',v_attempt.user_id,'result_state',v_attempt.result_state,'score_raw',v_attempt.score_raw,'score_normalized',v_attempt.score_normalized)); END IF;
  SELECT COUNT(*), COUNT(*) FILTER (WHERE correct = true), COUNT(*) FILTER (WHERE result_state NOT IN ('correct','incorrect','abandoned','timeout','forfeited')) INTO v_total_count, v_correct_count, v_non_terminal_count FROM public.question_attempts WHERE match_id = p_match_id AND user_id = v_target_user;
  IF v_total_count = 0 THEN RAISE EXCEPTION 'STAT_MATCH_NO_QUESTIONS: No question_attempts found for match %', p_match_id USING ERRCODE = 'P0001'; END IF;
  IF v_non_terminal_count > 0 THEN RETURN jsonb_build_object('status','error','error_code','match_incomplete','message',format('%s of %s questions still non-terminal', v_non_terminal_count, v_total_count),'non_terminal_count',v_non_terminal_count,'total_count',v_total_count); END IF;
  SELECT COALESCE(AVG(time_to_first_answer_ms), c_speed_ceiling_ms) INTO v_avg_time FROM public.question_attempts WHERE match_id = p_match_id AND user_id = v_target_user AND time_to_first_answer_ms IS NOT NULL;
  v_accuracy_pct := (v_correct_count::numeric / v_total_count) * 100.0;
  v_difficulty_bonus := 50.0;
  v_speed_bonus := GREATEST(0.0, LEAST(100.0, ((c_speed_ceiling_ms - v_avg_time) / c_speed_ceiling_ms) * 100.0));
  v_score_raw := v_correct_count;
  v_score_normalized := ROUND((v_accuracy_pct * 0.60) + (v_difficulty_bonus * 0.25) + (v_speed_bonus * 0.15), 4);
  UPDATE public.match_attempts SET result_state = 'completed', score_raw = v_score_raw, score_normalized = v_score_normalized, updated_at = now() WHERE id = v_attempt.id RETURNING id, match_id, user_id, result_state, score_raw, score_normalized, scoring_version, pack_question_count, updated_at INTO v_updated;
  RETURN jsonb_build_object('status','completed','match_attempt',jsonb_build_object('id',v_updated.id,'match_id',v_updated.match_id,'user_id',v_updated.user_id,'result_state',v_updated.result_state,'score_raw',v_updated.score_raw,'score_normalized',v_updated.score_normalized,'scoring_version',v_updated.scoring_version,'pack_question_count',v_updated.pack_question_count,'updated_at',v_updated.updated_at),'scoring_detail',jsonb_build_object('accuracy_pct',ROUND(v_accuracy_pct,2),'difficulty_bonus',ROUND(v_difficulty_bonus,2),'speed_bonus',ROUND(v_speed_bonus,2),'avg_time_ms',ROUND(v_avg_time),'correct_count',v_correct_count,'total_count',v_total_count));
END; $function$;
CREATE OR REPLACE FUNCTION public.content_hash_compute(p_question_ids text[], p_choices_order jsonb, p_dataset_version text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.create_bot_duel(p_bot_profile_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text, p_dataset_version text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_result jsonb;
  v_duel_id uuid;
  v_duel public.duel_challenges%rowtype;
begin
  v_result := public.create_duel(
    null,
    null,
    p_idempotency_key,
    true,
    p_bot_profile_id,
    'bot',
    p_dataset_version
  );

  v_duel_id := nullif(v_result -> 'duel' ->> 'id', '')::uuid;

  if v_duel_id is not null then
    update public.duel_challenges
    set
      state = 'accepted',
      updated_at = now()
    where id = v_duel_id
      and is_bot_match = true
    returning * into v_duel;

    if found then
      v_result := jsonb_set(v_result, '{duel}', public.private_duel_envelope(v_duel));
    end if;
  end if;

  return v_result;
end;
$function$;
CREATE OR REPLACE FUNCTION public.create_duel(p_opponent_id uuid DEFAULT NULL::uuid, p_question_set jsonb DEFAULT NULL::jsonb, p_idempotency_key text DEFAULT NULL::text, p_is_bot_match boolean DEFAULT false, p_bot_profile_id uuid DEFAULT NULL::uuid, p_source text DEFAULT 'direct'::text, p_dataset_version text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor           uuid := auth.uid();
    v_duel            public.duel_challenges%rowtype;
    v_existing        public.duel_challenges%rowtype;
    v_dataset_version text;
    v_duel_id         uuid := gen_random_uuid();
    v_seed            text;
    v_question_ids    text[];
    v_choices_order   jsonb;
    v_answer_map      jsonb;
    v_content_hash    text;
    v_bot_id          uuid;
    v_bot_run         jsonb;
    v_pack_count      integer := 10;
begin
    if v_actor is null then
        raise exception 'auth_required';
    end if;

    if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
        raise exception 'idempotency_key_required';
    end if;

    -- Idempotent re-entry.
    select * into v_existing
    from public.duel_challenges
    where challenger_id = v_actor
      and create_idempotency_key = p_idempotency_key;

    if found then
        return jsonb_build_object(
            'status',     'ok',
            'idempotent', true,
            'duel',       public.private_duel_envelope(v_existing)
        );
    end if;

    perform public.ensure_player_profile(v_actor);

    v_dataset_version := coalesce(
        nullif(btrim(p_dataset_version), ''),
        public.dataset_registry_current()
    );
    if v_dataset_version is null then
        raise exception 'dataset_version_unknown';
    end if;

    -- ------------------------------------------------------------------ BOT
    if p_is_bot_match then
        if p_bot_profile_id is null then
            select id into v_bot_id
            from public.bot_profiles
            where active = true
            order by case tier
                         when 'resident'  then 1
                         when 'attending' then 2
                         else 3
                     end,
                     created_at
            limit 1;
        else
            v_bot_id := p_bot_profile_id;
        end if;

        if v_bot_id is null then
            raise exception 'no_active_bot_profiles';
        end if;

        v_seed          := encode(digest(v_duel_id::text || ':' || v_dataset_version, 'sha256'), 'hex');
        v_question_ids  := public.pick_questions_seeded(v_seed, v_pack_count, v_dataset_version);
        v_choices_order := public.shuffle_choices_seeded(v_seed, v_question_ids, v_dataset_version);
        v_answer_map    := public.answer_map_for(v_question_ids, v_dataset_version);
        v_content_hash  := public.content_hash_compute(v_question_ids, v_choices_order, v_dataset_version);

        insert into public.duel_challenges (
            id, challenger_id, opponent_id, is_bot_match, bot_profile_id,
            is_ranked, source, question_set, state, create_idempotency_key,
            accepted_at, challenge_expires_at, match_expires_at,
            dataset_version, question_ids, choices_order, answer_map,
            content_hash, sealed_at
        )
        values (
            v_duel_id, v_actor, null, true, v_bot_id,
            false, coalesce(nullif(btrim(p_source), ''), 'bot'),
            '[]'::jsonb, 'pending', p_idempotency_key,
            now(), now(), now() + interval '48 hours',
            v_dataset_version, v_question_ids, v_choices_order, v_answer_map,
            v_content_hash, now()
        )
        returning * into v_duel;

        update public.duel_challenges
        set state = 'active', updated_at = now()
        where id = v_duel_id
        returning * into v_duel;

        perform public.private_append_duel_event(
            v_duel.id, 'challenge_created',
            format('%s:create', p_idempotency_key),
            v_actor, null, null, null, null,
            jsonb_build_object(
                'is_bot_match',    true,
                'bot_profile_id',  v_bot_id,
                'dataset_version', v_dataset_version,
                'content_hash',    v_content_hash
            )
        );

        perform public.private_append_duel_event(
            v_duel.id, 'challenge_accepted',
            format('%s:accept', p_idempotency_key),
            null, v_bot_id, null, null, null,
            jsonb_build_object('auto_accept', true)
        );

        v_bot_run := public.private_generate_bot_attempt(v_duel.id, v_bot_id);

        return jsonb_build_object(
            'status',  'ok',
            'duel',    public.private_duel_envelope(v_duel),
            'bot_run', v_bot_run
        );
    end if;

    -- ------------------------------------------------------------------ HUMAN
    if p_opponent_id is null then
        raise exception 'opponent_id_required_for_human_duel';
    end if;
    if p_opponent_id = v_actor then
        raise exception 'cannot_challenge_self';
    end if;

    perform public.ensure_player_profile(p_opponent_id);

    v_seed          := encode(digest(v_duel_id::text || ':' || v_dataset_version, 'sha256'), 'hex');
    v_question_ids  := public.pick_questions_seeded(v_seed, v_pack_count, v_dataset_version);
    v_choices_order := public.shuffle_choices_seeded(v_seed, v_question_ids, v_dataset_version);
    v_answer_map    := public.answer_map_for(v_question_ids, v_dataset_version);
    v_content_hash  := public.content_hash_compute(v_question_ids, v_choices_order, v_dataset_version);

    insert into public.duel_challenges (
        id, challenger_id, opponent_id, is_bot_match, bot_profile_id,
        is_ranked, source, question_set, state, create_idempotency_key,
        challenge_expires_at,
        dataset_version, question_ids, choices_order, answer_map,
        content_hash, sealed_at
    )
    values (
        v_duel_id, v_actor, p_opponent_id, false, null,
        true, coalesce(nullif(btrim(p_source), ''), 'direct'),
        '[]'::jsonb, 'pending', p_idempotency_key,
        now() + interval '24 hours',
        v_dataset_version, v_question_ids, v_choices_order, v_answer_map,
        v_content_hash, now()
    )
    returning * into v_duel;

    perform public.private_append_duel_event(
        v_duel.id, 'challenge_created',
        format('%s:create', p_idempotency_key),
        v_actor, null, null, null, null,
        jsonb_build_object(
            'is_bot_match',    false,
            'opponent_id',     p_opponent_id,
            'dataset_version', v_dataset_version,
            'content_hash',    v_content_hash
        )
    );

    return jsonb_build_object(
        'status', 'ok',
        'duel',   public.private_duel_envelope(v_duel)
    );
end;
$function$;
CREATE OR REPLACE FUNCTION public.dataset_canonical_hash(p_dataset_version text)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
    SELECT encode(
        digest(
            string_agg(
                question_id || '|' || prompt || '|' || choice_a || '|' || choice_b
                    || '|' || choice_c || '|' || choice_d || '|' || answer,
                E'\n' ORDER BY question_id
            ),
            'sha256'
        ),
        'hex'
    )
    FROM public.dataset_questions
    WHERE dataset_version = p_dataset_version;
$function$;
CREATE OR REPLACE FUNCTION public.dataset_registry_current()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
    SELECT dataset_version
    FROM public.dataset_registry
    ORDER BY registered_at DESC
    LIMIT 1;
$function$;
CREATE OR REPLACE FUNCTION public.end_study_session(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_uid uuid; v_session record;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'STAT_AUTH_REQUIRED: Authentication required' USING ERRCODE = 'P0001'; END IF;
  SELECT id, user_id, started_at, ended_at, current_sequence, last_activity_at INTO v_session FROM public.study_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAT_SESSION_NOT_FOUND: Session % does not exist', p_session_id USING ERRCODE = 'P0001'; END IF;
  IF v_session.user_id <> v_uid THEN RAISE EXCEPTION 'STAT_SESSION_FORBIDDEN: You do not own session %', p_session_id USING ERRCODE = 'P0001'; END IF;
  IF v_session.ended_at IS NOT NULL THEN RETURN jsonb_build_object('status','already_ended','session',jsonb_build_object('id',v_session.id,'user_id',v_session.user_id,'started_at',v_session.started_at,'ended_at',v_session.ended_at,'current_sequence',v_session.current_sequence)); END IF;
  UPDATE public.study_sessions SET ended_at = now() WHERE id = p_session_id RETURNING id, user_id, started_at, ended_at, current_sequence INTO v_session;
  RETURN jsonb_build_object('status','ended','session',jsonb_build_object('id',v_session.id,'user_id',v_session.user_id,'started_at',v_session.started_at,'ended_at',v_session.ended_at,'current_sequence',v_session.current_sequence));
END; $function$;
CREATE OR REPLACE FUNCTION public.finalize_duel(p_duel_id uuid, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_duel public.duel_challenges%rowtype;
  v_final_key text;
begin
  select * into v_duel
  from public.duel_challenges
  where id = p_duel_id;

  if not found then
    return jsonb_build_object('status', 'error', 'code', 'duel_not_found');
  end if;

  -- Service role may call with null auth.uid(); users must be participants.
  if v_actor is not null then
    if v_duel.is_bot_match then
      if v_actor is distinct from v_duel.challenger_id then
        return jsonb_build_object('status', 'error', 'code', 'not_duel_participant');
      end if;
    else
      if v_actor is distinct from v_duel.challenger_id and v_actor is distinct from v_duel.opponent_id then
        return jsonb_build_object('status', 'error', 'code', 'not_duel_participant');
      end if;
    end if;
  end if;

  v_final_key := coalesce(
    nullif(btrim(p_idempotency_key), ''),
    format('manual:%s:%s', p_duel_id, coalesce(v_actor::text, 'service'))
  );

  return public.private_finalize_duel_core(p_duel_id, v_final_key);
end;
$function$;
CREATE OR REPLACE FUNCTION public.get_duel_pack(p_duel_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor   uuid := auth.uid();
    v_duel    public.duel_challenges%rowtype;
    v_prompts jsonb;
begin
    if v_actor is null then
        raise exception 'auth_required';
    end if;

    select * into v_duel
    from public.duel_challenges
    where id = p_duel_id
      and (challenger_id = v_actor or opponent_id = v_actor);

    if not found then
        raise exception 'duel_not_found';
    end if;

    if v_duel.content_hash is null or v_duel.sealed_at is null then
        raise exception 'duel_pack_unsealed';
    end if;

    select coalesce(
               jsonb_agg(
                   jsonb_build_object(
                       'question_id',   dq.question_id,
                       'prompt',        dq.prompt,
                       'choice_a',      dq.choice_a,
                       'choice_b',      dq.choice_b,
                       'choice_c',      dq.choice_c,
                       'choice_d',      dq.choice_d,
                       'display_order', v_duel.choices_order -> ((ord - 1)::int)
                   ) order by ord
               ),
               '[]'::jsonb
           )
      into v_prompts
    from unnest(v_duel.question_ids) with ordinality as u(qid, ord)
    join public.dataset_questions dq
      on dq.dataset_version = v_duel.dataset_version
     and dq.question_id     = u.qid;

    return jsonb_build_object(
        'status',    'ok',
        'duel',      public.private_duel_envelope(v_duel),
        'questions', v_prompts
    );
end;
$function$;
CREATE OR REPLACE FUNCTION public.get_duel_result(p_duel_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor            uuid := auth.uid();
    v_duel             public.duel_challenges%rowtype;
    v_challenger_att   public.duel_attempts%rowtype;
    v_opponent_att     public.duel_attempts%rowtype;
    v_challenger_score integer;
    v_opponent_score   integer;
    v_challenger_time  integer;
    v_opponent_time    integer;
    v_winner_user_id   uuid;
begin
    if v_actor is null then
        raise exception 'auth_required';
    end if;

    select * into v_duel
    from public.duel_challenges
    where id = p_duel_id
      and (challenger_id = v_actor or opponent_id = v_actor);

    if not found then
        raise exception 'duel_not_found';
    end if;

    if v_duel.state <> 'finalized' then
        raise exception 'duel_not_finalized';
    end if;

    select * into v_challenger_att
    from public.duel_attempts
    where duel_id = p_duel_id and player_id = v_duel.challenger_id
    order by submitted_at asc
    limit 1;

    if v_duel.is_bot_match then
        select * into v_opponent_att
        from public.duel_attempts
        where duel_id = p_duel_id and bot_profile_id = v_duel.bot_profile_id
        order by submitted_at asc
        limit 1;
    else
        select * into v_opponent_att
        from public.duel_attempts
        where duel_id = p_duel_id and player_id = v_duel.opponent_id
        order by submitted_at asc
        limit 1;
    end if;

    v_challenger_score := coalesce(v_challenger_att.correct_count, 0);
    v_opponent_score   := coalesce(v_opponent_att.correct_count, 0);
    v_challenger_time  := coalesce(v_challenger_att.total_time_ms, 0);
    v_opponent_time    := coalesce(v_opponent_att.total_time_ms, 0);

    if v_challenger_score > v_opponent_score then
        v_winner_user_id := v_duel.challenger_id;
    elsif v_opponent_score > v_challenger_score then
        v_winner_user_id := case when v_duel.is_bot_match then null else v_duel.opponent_id end;
    else
        if v_challenger_time < v_opponent_time then
            v_winner_user_id := v_duel.challenger_id;
        elsif v_opponent_time < v_challenger_time then
            v_winner_user_id := case when v_duel.is_bot_match then null else v_duel.opponent_id end;
        else
            v_winner_user_id := null;
        end if;
    end if;

    return jsonb_build_object(
        'status',             'ok',
        'duel',               public.private_duel_envelope(v_duel),
        'answer_map',         v_duel.answer_map,
        'challenger_attempt', case when v_challenger_att.id is null then null else to_jsonb(v_challenger_att) end,
        'opponent_attempt',   case when v_opponent_att.id   is null then null else to_jsonb(v_opponent_att)   end,
        'challenger_score',   v_challenger_score,
        'opponent_score',     v_opponent_score,
        'challenger_time_ms', v_challenger_time,
        'opponent_time_ms',   v_opponent_time,
        'winner_user_id',     v_winner_user_id
    );
end;
$function$;
CREATE OR REPLACE FUNCTION public.get_match_state(p_match_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_uid uuid; v_match_attempt record; v_questions jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'STAT_AUTH_REQUIRED: Authentication required' USING ERRCODE = 'P0001'; END IF;
  SELECT id, match_id, user_id, session_id, mode_type, dataset_version, content_hash, pack_question_count, result_state, scoring_version, score_raw, score_normalized, session_sequence_index, created_at, updated_at INTO v_match_attempt FROM public.match_attempts WHERE match_id = p_match_id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'STAT_MATCH_NOT_FOUND: No match_attempt for match % user %', p_match_id, v_uid USING ERRCODE = 'P0001'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',qa.id,'question_id',qa.question_id,'q_index',qa.q_index,'displayed_choices_order',qa.displayed_choices_order,'computed_correct_index',qa.computed_correct_index_after_permutation,'selected_index',qa.selected_index,'correct',qa.correct,'result_state',qa.result_state,'question_started_at',qa.question_started_at,'question_answered_at',qa.question_answered_at,'time_to_first_answer_ms',qa.time_to_first_answer_ms,'total_time_on_question_ms',qa.total_time_on_question_ms,'server_sequence_index',qa.server_sequence_index) ORDER BY qa.server_sequence_index ASC),'[]'::jsonb) INTO v_questions FROM public.question_attempts qa WHERE qa.match_id = p_match_id AND qa.user_id = v_uid;
  RETURN jsonb_build_object('match_attempt',jsonb_build_object('id',v_match_attempt.id,'match_id',v_match_attempt.match_id,'user_id',v_match_attempt.user_id,'session_id',v_match_attempt.session_id,'mode_type',v_match_attempt.mode_type,'dataset_version',v_match_attempt.dataset_version,'content_hash',v_match_attempt.content_hash,'pack_question_count',v_match_attempt.pack_question_count,'result_state',v_match_attempt.result_state,'scoring_version',v_match_attempt.scoring_version,'score_raw',v_match_attempt.score_raw,'score_normalized',v_match_attempt.score_normalized,'created_at',v_match_attempt.created_at,'updated_at',v_match_attempt.updated_at),'question_attempts',v_questions,'question_count',jsonb_array_length(v_questions));
END; $function$;
CREATE OR REPLACE FUNCTION public.log_question_answered(params jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid; v_match_id uuid; v_q_index integer; v_selected_index integer;
  v_client_event_id uuid; v_question_answered_at timestamptz; v_existing record;
  v_is_correct boolean; v_new_result_state text; v_time_to_first integer;
  v_total_time integer; v_updated record;
  v_question_id text; v_choices_order text[]; v_dataset_version text;
  v_content_hash text; v_session_id uuid; v_seq_index integer;
  v_computed_correct integer; v_new record;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'STAT_AUTH_REQUIRED: Authentication required' USING ERRCODE = 'P0001'; END IF;
  v_match_id := (params->>'match_id')::uuid; v_q_index := (params->>'q_index')::integer;
  v_selected_index := (params->>'selected_index')::integer; v_client_event_id := (params->>'client_event_id')::uuid;
  v_question_answered_at := (params->>'question_answered_at')::timestamptz;
  IF v_match_id IS NULL OR v_q_index IS NULL OR v_selected_index IS NULL OR v_client_event_id IS NULL THEN
    RAISE EXCEPTION 'STAT_INVALID_PARAMS: Missing required fields' USING ERRCODE = 'P0001';
  END IF;
  -- Client event dedup
  SELECT id, match_id, q_index, result_state, selected_index, correct INTO v_existing FROM public.question_attempts WHERE user_id = v_uid AND client_event_id = v_client_event_id;
  IF FOUND THEN RETURN jsonb_build_object('status','duplicate_event','question_attempt',jsonb_build_object('id',v_existing.id,'match_id',v_existing.match_id,'q_index',v_existing.q_index,'result_state',v_existing.result_state,'selected_index',v_existing.selected_index,'correct',v_existing.correct)); END IF;
  -- Look up existing presented row
  SELECT id, match_id, user_id, q_index, result_state, selected_index, correct, computed_correct_index_after_permutation, question_started_at, displayed_choices_order INTO v_existing FROM public.question_attempts WHERE match_id = v_match_id AND user_id = v_uid AND q_index = v_q_index;
  IF FOUND THEN
    IF v_existing.result_state IN ('correct','incorrect','abandoned','timeout','forfeited') THEN
      RETURN jsonb_build_object('status','already_terminal','question_attempt',jsonb_build_object('id',v_existing.id,'match_id',v_existing.match_id,'q_index',v_existing.q_index,'result_state',v_existing.result_state,'selected_index',v_existing.selected_index,'correct',v_existing.correct));
    END IF;
    IF v_existing.computed_correct_index_after_permutation IS NOT NULL THEN v_is_correct := (v_selected_index = v_existing.computed_correct_index_after_permutation); ELSE v_is_correct := NULL; END IF;
    v_new_result_state := CASE WHEN v_is_correct = true THEN 'correct' WHEN v_is_correct = false THEN 'incorrect' ELSE 'incorrect' END;
    IF v_existing.question_started_at IS NOT NULL AND v_question_answered_at IS NOT NULL THEN
      v_time_to_first := EXTRACT(EPOCH FROM (v_question_answered_at - v_existing.question_started_at))::integer * 1000;
      v_total_time := v_time_to_first;
    END IF;
    UPDATE public.question_attempts SET selected_index = v_selected_index, correct = v_is_correct, result_state = v_new_result_state, question_answered_at = v_question_answered_at, server_received_answered_at = now(), time_to_first_answer_ms = v_time_to_first, total_time_on_question_ms = v_total_time, client_event_id = v_client_event_id WHERE id = v_existing.id
    RETURNING id, match_id, user_id, q_index, result_state, selected_index, correct, time_to_first_answer_ms INTO v_updated;
    RETURN jsonb_build_object('status','answered','question_attempt',jsonb_build_object('id',v_updated.id,'match_id',v_updated.match_id,'q_index',v_updated.q_index,'result_state',v_updated.result_state,'selected_index',v_updated.selected_index,'correct',v_updated.correct,'time_to_first_answer_ms',v_updated.time_to_first_answer_ms));
  ELSE
    -- OUT-OF-ORDER
    v_question_id := params->>'question_id'; v_dataset_version := params->>'dataset_version'; v_content_hash := params->>'content_hash';
    IF v_question_id IS NULL OR v_dataset_version IS NULL OR v_content_hash IS NULL THEN RAISE EXCEPTION 'STAT_OUT_OF_ORDER_MISSING_FIELDS: Out-of-order answer requires question_id, dataset_version, content_hash' USING ERRCODE = 'P0001'; END IF;
    IF params ? 'displayed_choices_order' THEN SELECT ARRAY(SELECT jsonb_array_elements_text(params->'displayed_choices_order')) INTO v_choices_order;
    ELSE RAISE EXCEPTION 'STAT_OUT_OF_ORDER_MISSING_FIELDS: Out-of-order answer requires displayed_choices_order' USING ERRCODE = 'P0001'; END IF;
    SELECT id INTO v_session_id FROM public.study_sessions WHERE user_id = v_uid AND ended_at IS NULL LIMIT 1;
    -- Advisory lock for sequence assignment
    PERFORM pg_advisory_xact_lock(hashtext(v_match_id::text));
    SELECT COALESCE(MAX(server_sequence_index), -1) + 1 INTO v_seq_index FROM public.question_attempts WHERE match_id = v_match_id;
    BEGIN
      SELECT idx - 1 INTO v_computed_correct FROM (SELECT ordinality AS idx, val FROM unnest(v_choices_order) WITH ORDINALITY AS t(val, ordinality)) sub JOIN (SELECT (elem->>'answer')::text AS correct_key FROM jsonb_array_elements(answer_map_for(ARRAY[v_question_id], v_dataset_version)) AS elem WHERE elem->>'id' = v_question_id) ans ON sub.val = ans.correct_key LIMIT 1;
    EXCEPTION WHEN OTHERS THEN v_computed_correct := NULL; END;
    IF v_computed_correct IS NOT NULL THEN v_is_correct := (v_selected_index = v_computed_correct); ELSE v_is_correct := NULL; END IF;
    v_new_result_state := CASE WHEN v_is_correct = true THEN 'correct' WHEN v_is_correct = false THEN 'incorrect' ELSE 'incorrect' END;
    INSERT INTO public.question_attempts (match_id, user_id, session_id, question_id, q_index, displayed_choices_order, computed_correct_index_after_permutation, selected_index, correct, result_state, question_answered_at, server_received_answered_at, time_to_first_answer_ms, total_time_on_question_ms, dataset_version, content_hash, client_event_id, server_sequence_index)
    VALUES (v_match_id, v_uid, v_session_id, v_question_id, v_q_index, v_choices_order, v_computed_correct, v_selected_index, v_is_correct, v_new_result_state, v_question_answered_at, now(), NULL, NULL, v_dataset_version, v_content_hash, v_client_event_id, v_seq_index)
    RETURNING id, match_id, user_id, q_index, result_state, selected_index, correct, server_sequence_index INTO v_new;
    RETURN jsonb_build_object('status','out_of_order_merged','question_attempt',jsonb_build_object('id',v_new.id,'match_id',v_new.match_id,'q_index',v_new.q_index,'result_state',v_new.result_state,'selected_index',v_new.selected_index,'correct',v_new.correct,'server_sequence_index',v_new.server_sequence_index));
  END IF;
END; $function$;
CREATE OR REPLACE FUNCTION public.log_question_presented(params jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid; v_match_id uuid; v_question_id text; v_q_index integer;
  v_choices_order text[]; v_dataset_version text; v_content_hash text;
  v_client_event_id uuid; v_question_started_at timestamptz;
  v_session_id uuid; v_seq_index integer; v_existing record; v_new record;
  v_computed_correct integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'STAT_AUTH_REQUIRED: Authentication required' USING ERRCODE = 'P0001'; END IF;
  v_match_id := (params->>'match_id')::uuid; v_question_id := params->>'question_id';
  v_q_index := (params->>'q_index')::integer; v_dataset_version := params->>'dataset_version';
  v_content_hash := params->>'content_hash'; v_client_event_id := (params->>'client_event_id')::uuid;
  v_question_started_at := (params->>'question_started_at')::timestamptz;
  SELECT ARRAY(SELECT jsonb_array_elements_text(params->'displayed_choices_order')) INTO v_choices_order;
  IF v_match_id IS NULL OR v_question_id IS NULL OR v_q_index IS NULL OR v_choices_order IS NULL OR v_dataset_version IS NULL OR v_content_hash IS NULL OR v_client_event_id IS NULL THEN
    RAISE EXCEPTION 'STAT_INVALID_PARAMS: Missing required fields' USING ERRCODE = 'P0001';
  END IF;
  -- Idempotent check 1: client_event_id dedup
  SELECT id, match_id, user_id, q_index, result_state, server_sequence_index INTO v_existing FROM public.question_attempts WHERE user_id = v_uid AND client_event_id = v_client_event_id;
  IF FOUND THEN RETURN jsonb_build_object('status','duplicate_event','question_attempt',jsonb_build_object('id',v_existing.id,'match_id',v_existing.match_id,'q_index',v_existing.q_index,'result_state',v_existing.result_state,'server_sequence_index',v_existing.server_sequence_index)); END IF;
  -- Idempotent check 2: (match_id, user_id, q_index) re-present
  SELECT id, match_id, user_id, q_index, result_state, server_sequence_index INTO v_existing FROM public.question_attempts WHERE match_id = v_match_id AND user_id = v_uid AND q_index = v_q_index;
  IF FOUND THEN RETURN jsonb_build_object('status','re_presented','question_attempt',jsonb_build_object('id',v_existing.id,'match_id',v_existing.match_id,'q_index',v_existing.q_index,'result_state',v_existing.result_state,'server_sequence_index',v_existing.server_sequence_index)); END IF;
  -- Bind to active session
  SELECT id INTO v_session_id FROM public.study_sessions WHERE user_id = v_uid AND ended_at IS NULL LIMIT 1;
  -- Atomically assign server_sequence_index via advisory lock on match scope
  PERFORM pg_advisory_xact_lock(hashtext(v_match_id::text));
  SELECT COALESCE(MAX(server_sequence_index), -1) + 1 INTO v_seq_index FROM public.question_attempts WHERE match_id = v_match_id;
  -- Compute correct index
  BEGIN
    SELECT idx - 1 INTO v_computed_correct FROM (SELECT ordinality AS idx, val FROM unnest(v_choices_order) WITH ORDINALITY AS t(val, ordinality)) sub JOIN (SELECT (elem->>'answer')::text AS correct_key FROM jsonb_array_elements(answer_map_for(ARRAY[v_question_id], v_dataset_version)) AS elem WHERE elem->>'id' = v_question_id) ans ON sub.val = ans.correct_key LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_computed_correct := NULL;
  END;
  -- Insert
  INSERT INTO public.question_attempts (match_id, user_id, session_id, question_id, q_index, displayed_choices_order, computed_correct_index_after_permutation, result_state, question_started_at, server_received_presented_at, dataset_version, content_hash, client_event_id, server_sequence_index)
  VALUES (v_match_id, v_uid, v_session_id, v_question_id, v_q_index, v_choices_order, v_computed_correct, 'presented', v_question_started_at, now(), v_dataset_version, v_content_hash, v_client_event_id, v_seq_index)
  RETURNING id, match_id, user_id, q_index, result_state, server_sequence_index, computed_correct_index_after_permutation INTO v_new;
  RETURN jsonb_build_object('status','created','question_attempt',jsonb_build_object('id',v_new.id,'match_id',v_new.match_id,'q_index',v_new.q_index,'result_state',v_new.result_state,'server_sequence_index',v_new.server_sequence_index,'computed_correct_index',v_new.computed_correct_index_after_permutation));
END; $function$;
CREATE OR REPLACE FUNCTION public.pick_questions_seeded(p_seed text, p_count integer, p_dataset_version text)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

    if not exists (
        select 1 from public.dataset_registry where dataset_version = p_dataset_version
    ) then
        raise exception 'dataset_version_unknown' using errcode = 'P0001';
    end if;

    select array_agg(question_id order by question_id asc)
      into v_all
    from public.dataset_questions
    where dataset_version = p_dataset_version;

    v_n := coalesce(array_length(v_all, 1), 0);
    if v_n < p_count then
        raise exception 'insufficient_questions' using errcode = 'P0001';
    end if;

    -- Seed mulberry32 from first 32 bits (big-endian, unsigned) of sha256(p_seed).
    v_seed_bytes := digest(p_seed, 'sha256');
    v_state      := (get_byte(v_seed_bytes, 0)::bigint << 24)
                  | (get_byte(v_seed_bytes, 1)::bigint << 16)
                  | (get_byte(v_seed_bytes, 2)::bigint << 8)
                  |  get_byte(v_seed_bytes, 3)::bigint;

    v_i := 1;
    while v_i <= p_count loop
        v_state := (v_state + 1831565813) & 4294967295;  -- 0x6D2B79F5
        v_t     := v_state;

        v_inner := (v_t # (v_t >> 15)) & 4294967295;
        v_t     := mod((v_inner::numeric * (v_t | 1)::numeric), 4294967296)::bigint;

        v_inner := (v_t # (v_t >> 7)) & 4294967295;
        v_inner := mod((v_inner::numeric * (v_t | 61)::numeric), 4294967296)::bigint;
        v_t     := (v_t # ((v_t + v_inner) & 4294967295)) & 4294967295;

        v_rand := ((v_t # (v_t >> 14)) & 4294967295)::double precision / 4294967296.0;

        v_j := v_i + floor(v_rand * ((v_n - v_i + 1)::double precision))::integer;
        if v_j > v_n then v_j := v_n; end if;
        if v_j < v_i then v_j := v_i; end if;

        if v_j <> v_i then
            v_tmp      := v_all[v_i];
            v_all[v_i] := v_all[v_j];
            v_all[v_j] := v_tmp;
        end if;

        v_i := v_i + 1;
    end loop;

    return v_all[1:p_count];
end;
$function$;
CREATE OR REPLACE FUNCTION public.private_duel_envelope(p_duel public.duel_challenges)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT jsonb_build_object(
        'id',                    p_duel.id,
        'challenger_id',         p_duel.challenger_id,
        'opponent_id',           p_duel.opponent_id,
        'is_bot_match',          p_duel.is_bot_match,
        'bot_profile_id',        p_duel.bot_profile_id,
        'is_ranked',             p_duel.is_ranked,
        'source',                p_duel.source,
        'state',                 p_duel.state,
        'dataset_version',       p_duel.dataset_version,
        'question_ids',          to_jsonb(p_duel.question_ids),
        'choices_order',         p_duel.choices_order,
        'content_hash',          p_duel.content_hash,
        'sealed_at',             p_duel.sealed_at,
        'finalized_at',          coalesce(p_duel.finalized_at, p_duel.completed_at, p_duel.sealed_at),
        'challenge_expires_at',  p_duel.challenge_expires_at,
        'match_expires_at',      p_duel.match_expires_at,
        'accepted_at',           p_duel.accepted_at,
        'completed_at',          p_duel.completed_at,
        'created_at',            p_duel.created_at,
        'updated_at',            p_duel.updated_at
    );
$function$;
CREATE OR REPLACE FUNCTION public.shuffle_choices_seeded(p_seed text, p_question_ids text[], p_dataset_version text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
        select 1 from public.dataset_registry where dataset_version = p_dataset_version
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

        v_i := 1;
        while v_i <= 3 loop
            v_state := (v_state + 1831565813) & 4294967295;
            v_t     := v_state;

            v_inner := (v_t # (v_t >> 15)) & 4294967295;
            v_t     := mod((v_inner::numeric * (v_t | 1)::numeric), 4294967296)::bigint;

            v_inner := (v_t # (v_t >> 7)) & 4294967295;
            v_inner := mod((v_inner::numeric * (v_t | 61)::numeric), 4294967296)::bigint;
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
$function$;
CREATE OR REPLACE FUNCTION public.start_study_session()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_uid uuid; v_existing record; v_new record;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'STAT_AUTH_REQUIRED: Authentication required' USING ERRCODE = 'P0001'; END IF;
  SELECT id, user_id, started_at, current_sequence, last_activity_at INTO v_existing FROM public.study_sessions WHERE user_id = v_uid AND ended_at IS NULL;
  IF FOUND THEN RETURN jsonb_build_object('status','existing','session',jsonb_build_object('id',v_existing.id,'user_id',v_existing.user_id,'started_at',v_existing.started_at,'current_sequence',v_existing.current_sequence,'last_activity_at',v_existing.last_activity_at)); END IF;
  INSERT INTO public.study_sessions (user_id) VALUES (v_uid) RETURNING id, user_id, started_at, current_sequence, last_activity_at INTO v_new;
  RETURN jsonb_build_object('status','created','session',jsonb_build_object('id',v_new.id,'user_id',v_new.user_id,'started_at',v_new.started_at,'current_sequence',v_new.current_sequence,'last_activity_at',v_new.last_activity_at));
END; $function$;
CREATE OR REPLACE FUNCTION public.submit_attempt(p_duel_id uuid, p_answers jsonb, p_total_time_ms integer, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_duel public.duel_challenges%rowtype;
  v_existing_attempt public.duel_attempts%rowtype;
  v_other_attempt public.duel_attempts%rowtype;
  v_score jsonb;
  v_attempt public.duel_attempts%rowtype;
  v_answer jsonb;
  v_idx integer := 0;
  v_finalize_result jsonb;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency_key_required';
  end if;

  perform public.ensure_player_profile(v_actor);

  select * into v_duel
  from public.duel_challenges
  where id = p_duel_id
  for update;

  if not found then
    return jsonb_build_object('status', 'error', 'code', 'duel_not_found');
  end if;

  if v_duel.is_bot_match then
    if v_actor is distinct from v_duel.challenger_id then
      return jsonb_build_object('status', 'error', 'code', 'not_duel_participant');
    end if;
  else
    if v_actor is distinct from v_duel.challenger_id and v_actor is distinct from v_duel.opponent_id then
      return jsonb_build_object('status', 'error', 'code', 'not_duel_participant');
    end if;
  end if;

  -- Request-level idempotency.
  select * into v_existing_attempt
  from public.duel_attempts
  where duel_id = p_duel_id
    and player_id = v_actor
    and submit_idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object('status', 'ok', 'idempotent', true, 'attempt', to_jsonb(v_existing_attempt));
  end if;

  -- Participant has already submitted; return existing row (retry-safe).
  select * into v_existing_attempt
  from public.duel_attempts
  where duel_id = p_duel_id
    and player_id = v_actor;

  if found then
    return jsonb_build_object('status', 'ok', 'idempotent', true, 'attempt', to_jsonb(v_existing_attempt));
  end if;

  if v_duel.state in ('completed', 'expired', 'settled') then
    return jsonb_build_object('status', 'error', 'code', 'duel_terminal_state', 'state', v_duel.state);
  end if;

  if now() > coalesce(v_duel.match_expires_at, now() - interval '1 second')
    and v_duel.state in ('accepted', 'player1_complete', 'player2_complete')
  then
    return public.private_finalize_duel_core(p_duel_id, format('%s:match-expired', p_idempotency_key));
  end if;

  if v_duel.state not in ('accepted', 'player1_complete', 'player2_complete') then
    return jsonb_build_object('status', 'error', 'code', 'duel_not_ready_for_attempt', 'state', v_duel.state);
  end if;

  v_score := public.private_score_answers(v_duel.question_set, p_answers, p_total_time_ms);

  insert into public.duel_attempts (
    duel_id,
    player_id,
    is_bot_attempt,
    attempt_status,
    answers,
    total_questions,
    correct_count,
    total_time_ms,
    started_at,
    submitted_at,
    submit_idempotency_key
  )
  values (
    p_duel_id,
    v_actor,
    false,
    'submitted',
    v_score->'answers',
    (v_score->>'total_questions')::integer,
    (v_score->>'correct_count')::integer,
    (v_score->>'total_time_ms')::integer,
    now(),
    now(),
    p_idempotency_key
  )
  returning * into v_attempt;

  -- Per-question event writes (monotonic event_seq, idempotency-safe).
  for v_answer in
    select value from jsonb_array_elements(v_score->'answers') as a(value)
  loop
    v_idx := v_idx + 1;
    perform public.private_append_duel_event(
      p_duel_id,
      'question_answered',
      format('%s:q:%s', p_idempotency_key, v_idx),
      v_actor,
      null,
      v_idx,
      (v_answer->>'is_correct')::boolean,
      (v_answer->>'time_ms')::integer,
      jsonb_build_object('question_id', v_answer->>'question_id')
    );
  end loop;

  perform public.private_append_duel_event(
    p_duel_id,
    'attempt_submitted',
    format('%s:submitted', p_idempotency_key),
    v_actor,
    null,
    null,
    null,
    null,
    jsonb_build_object(
      'correct_count', v_attempt.correct_count,
      'total_questions', v_attempt.total_questions,
      'total_time_ms', v_attempt.total_time_ms
    )
  );

  if v_duel.is_bot_match then
    select * into v_other_attempt
    from public.duel_attempts
    where duel_id = p_duel_id
      and bot_profile_id = v_duel.bot_profile_id;
  else
    select * into v_other_attempt
    from public.duel_attempts
    where duel_id = p_duel_id
      and player_id = case
        when v_actor = v_duel.challenger_id then v_duel.opponent_id
        else v_duel.challenger_id
      end;
  end if;

  if v_other_attempt.id is not null then
    update public.duel_challenges
    set state = 'completed', updated_at = now()
    where id = p_duel_id;

    v_finalize_result := public.private_finalize_duel_core(
      p_duel_id,
      format('%s:auto-finalize', p_idempotency_key)
    );

    return jsonb_build_object(
      'status', 'ok',
      'attempt', to_jsonb(v_attempt),
      'finalized', true,
      'finalize', v_finalize_result
    );
  end if;

  update public.duel_challenges
  set
    state = case
      when v_actor = v_duel.challenger_id then 'player1_complete'
      else 'player2_complete'
    end,
    updated_at = now()
  where id = p_duel_id;

  return jsonb_build_object('status', 'ok', 'attempt', to_jsonb(v_attempt), 'finalized', false);
end;
$function$;
grant delete on table "public"."attempts" to "anon";
grant insert on table "public"."attempts" to "anon";
grant references on table "public"."attempts" to "anon";
grant select on table "public"."attempts" to "anon";
grant trigger on table "public"."attempts" to "anon";
grant truncate on table "public"."attempts" to "anon";
grant update on table "public"."attempts" to "anon";
grant delete on table "public"."attempts" to "authenticated";
grant insert on table "public"."attempts" to "authenticated";
grant references on table "public"."attempts" to "authenticated";
grant select on table "public"."attempts" to "authenticated";
grant trigger on table "public"."attempts" to "authenticated";
grant truncate on table "public"."attempts" to "authenticated";
grant update on table "public"."attempts" to "authenticated";
grant delete on table "public"."attempts" to "service_role";
grant insert on table "public"."attempts" to "service_role";
grant references on table "public"."attempts" to "service_role";
grant select on table "public"."attempts" to "service_role";
grant trigger on table "public"."attempts" to "service_role";
grant truncate on table "public"."attempts" to "service_role";
grant update on table "public"."attempts" to "service_role";
grant delete on table "public"."con_daily_diagnosis" to "anon";
grant insert on table "public"."con_daily_diagnosis" to "anon";
grant references on table "public"."con_daily_diagnosis" to "anon";
grant select on table "public"."con_daily_diagnosis" to "anon";
grant trigger on table "public"."con_daily_diagnosis" to "anon";
grant truncate on table "public"."con_daily_diagnosis" to "anon";
grant update on table "public"."con_daily_diagnosis" to "anon";
grant delete on table "public"."con_daily_diagnosis" to "authenticated";
grant insert on table "public"."con_daily_diagnosis" to "authenticated";
grant references on table "public"."con_daily_diagnosis" to "authenticated";
grant select on table "public"."con_daily_diagnosis" to "authenticated";
grant trigger on table "public"."con_daily_diagnosis" to "authenticated";
grant truncate on table "public"."con_daily_diagnosis" to "authenticated";
grant update on table "public"."con_daily_diagnosis" to "authenticated";
grant delete on table "public"."con_daily_diagnosis" to "service_role";
grant insert on table "public"."con_daily_diagnosis" to "service_role";
grant references on table "public"."con_daily_diagnosis" to "service_role";
grant select on table "public"."con_daily_diagnosis" to "service_role";
grant trigger on table "public"."con_daily_diagnosis" to "service_role";
grant truncate on table "public"."con_daily_diagnosis" to "service_role";
grant update on table "public"."con_daily_diagnosis" to "service_role";
grant delete on table "public"."con_daily_metrics" to "anon";
grant insert on table "public"."con_daily_metrics" to "anon";
grant references on table "public"."con_daily_metrics" to "anon";
grant select on table "public"."con_daily_metrics" to "anon";
grant trigger on table "public"."con_daily_metrics" to "anon";
grant truncate on table "public"."con_daily_metrics" to "anon";
grant update on table "public"."con_daily_metrics" to "anon";
grant delete on table "public"."con_daily_metrics" to "authenticated";
grant insert on table "public"."con_daily_metrics" to "authenticated";
grant references on table "public"."con_daily_metrics" to "authenticated";
grant select on table "public"."con_daily_metrics" to "authenticated";
grant trigger on table "public"."con_daily_metrics" to "authenticated";
grant truncate on table "public"."con_daily_metrics" to "authenticated";
grant update on table "public"."con_daily_metrics" to "authenticated";
grant delete on table "public"."con_daily_metrics" to "service_role";
grant insert on table "public"."con_daily_metrics" to "service_role";
grant references on table "public"."con_daily_metrics" to "service_role";
grant select on table "public"."con_daily_metrics" to "service_role";
grant trigger on table "public"."con_daily_metrics" to "service_role";
grant truncate on table "public"."con_daily_metrics" to "service_role";
grant update on table "public"."con_daily_metrics" to "service_role";
grant delete on table "public"."con_kpi_targets" to "anon";
grant insert on table "public"."con_kpi_targets" to "anon";
grant references on table "public"."con_kpi_targets" to "anon";
grant select on table "public"."con_kpi_targets" to "anon";
grant trigger on table "public"."con_kpi_targets" to "anon";
grant truncate on table "public"."con_kpi_targets" to "anon";
grant update on table "public"."con_kpi_targets" to "anon";
grant delete on table "public"."con_kpi_targets" to "authenticated";
grant insert on table "public"."con_kpi_targets" to "authenticated";
grant references on table "public"."con_kpi_targets" to "authenticated";
grant select on table "public"."con_kpi_targets" to "authenticated";
grant trigger on table "public"."con_kpi_targets" to "authenticated";
grant truncate on table "public"."con_kpi_targets" to "authenticated";
grant update on table "public"."con_kpi_targets" to "authenticated";
grant delete on table "public"."con_kpi_targets" to "service_role";
grant insert on table "public"."con_kpi_targets" to "service_role";
grant references on table "public"."con_kpi_targets" to "service_role";
grant select on table "public"."con_kpi_targets" to "service_role";
grant trigger on table "public"."con_kpi_targets" to "service_role";
grant truncate on table "public"."con_kpi_targets" to "service_role";
grant update on table "public"."con_kpi_targets" to "service_role";
grant delete on table "public"."duels" to "anon";
grant insert on table "public"."duels" to "anon";
grant references on table "public"."duels" to "anon";
grant select on table "public"."duels" to "anon";
grant trigger on table "public"."duels" to "anon";
grant truncate on table "public"."duels" to "anon";
grant update on table "public"."duels" to "anon";
grant delete on table "public"."duels" to "authenticated";
grant insert on table "public"."duels" to "authenticated";
grant references on table "public"."duels" to "authenticated";
grant select on table "public"."duels" to "authenticated";
grant trigger on table "public"."duels" to "authenticated";
grant truncate on table "public"."duels" to "authenticated";
grant update on table "public"."duels" to "authenticated";
grant delete on table "public"."duels" to "service_role";
grant insert on table "public"."duels" to "service_role";
grant references on table "public"."duels" to "service_role";
grant select on table "public"."duels" to "service_role";
grant trigger on table "public"."duels" to "service_role";
grant truncate on table "public"."duels" to "service_role";
grant update on table "public"."duels" to "service_role";
grant delete on table "public"."missionmed_action_queue" to "anon";
grant insert on table "public"."missionmed_action_queue" to "anon";
grant references on table "public"."missionmed_action_queue" to "anon";
grant select on table "public"."missionmed_action_queue" to "anon";
grant trigger on table "public"."missionmed_action_queue" to "anon";
grant truncate on table "public"."missionmed_action_queue" to "anon";
grant update on table "public"."missionmed_action_queue" to "anon";
grant delete on table "public"."missionmed_action_queue" to "authenticated";
grant insert on table "public"."missionmed_action_queue" to "authenticated";
grant references on table "public"."missionmed_action_queue" to "authenticated";
grant select on table "public"."missionmed_action_queue" to "authenticated";
grant trigger on table "public"."missionmed_action_queue" to "authenticated";
grant truncate on table "public"."missionmed_action_queue" to "authenticated";
grant update on table "public"."missionmed_action_queue" to "authenticated";
grant delete on table "public"."missionmed_action_queue" to "service_role";
grant insert on table "public"."missionmed_action_queue" to "service_role";
grant references on table "public"."missionmed_action_queue" to "service_role";
grant select on table "public"."missionmed_action_queue" to "service_role";
grant trigger on table "public"."missionmed_action_queue" to "service_role";
grant truncate on table "public"."missionmed_action_queue" to "service_role";
grant update on table "public"."missionmed_action_queue" to "service_role";
grant delete on table "public"."missionmed_email_threads" to "anon";
grant insert on table "public"."missionmed_email_threads" to "anon";
grant references on table "public"."missionmed_email_threads" to "anon";
grant select on table "public"."missionmed_email_threads" to "anon";
grant trigger on table "public"."missionmed_email_threads" to "anon";
grant truncate on table "public"."missionmed_email_threads" to "anon";
grant update on table "public"."missionmed_email_threads" to "anon";
grant delete on table "public"."missionmed_email_threads" to "authenticated";
grant insert on table "public"."missionmed_email_threads" to "authenticated";
grant references on table "public"."missionmed_email_threads" to "authenticated";
grant select on table "public"."missionmed_email_threads" to "authenticated";
grant trigger on table "public"."missionmed_email_threads" to "authenticated";
grant truncate on table "public"."missionmed_email_threads" to "authenticated";
grant update on table "public"."missionmed_email_threads" to "authenticated";
grant delete on table "public"."missionmed_email_threads" to "service_role";
grant insert on table "public"."missionmed_email_threads" to "service_role";
grant references on table "public"."missionmed_email_threads" to "service_role";
grant select on table "public"."missionmed_email_threads" to "service_role";
grant trigger on table "public"."missionmed_email_threads" to "service_role";
grant truncate on table "public"."missionmed_email_threads" to "service_role";
grant update on table "public"."missionmed_email_threads" to "service_role";
grant delete on table "public"."missionmed_lead_scores" to "anon";
grant insert on table "public"."missionmed_lead_scores" to "anon";
grant references on table "public"."missionmed_lead_scores" to "anon";
grant select on table "public"."missionmed_lead_scores" to "anon";
grant trigger on table "public"."missionmed_lead_scores" to "anon";
grant truncate on table "public"."missionmed_lead_scores" to "anon";
grant update on table "public"."missionmed_lead_scores" to "anon";
grant delete on table "public"."missionmed_lead_scores" to "authenticated";
grant insert on table "public"."missionmed_lead_scores" to "authenticated";
grant references on table "public"."missionmed_lead_scores" to "authenticated";
grant select on table "public"."missionmed_lead_scores" to "authenticated";
grant trigger on table "public"."missionmed_lead_scores" to "authenticated";
grant truncate on table "public"."missionmed_lead_scores" to "authenticated";
grant update on table "public"."missionmed_lead_scores" to "authenticated";
grant delete on table "public"."missionmed_lead_scores" to "service_role";
grant insert on table "public"."missionmed_lead_scores" to "service_role";
grant references on table "public"."missionmed_lead_scores" to "service_role";
grant select on table "public"."missionmed_lead_scores" to "service_role";
grant trigger on table "public"."missionmed_lead_scores" to "service_role";
grant truncate on table "public"."missionmed_lead_scores" to "service_role";
grant update on table "public"."missionmed_lead_scores" to "service_role";
grant delete on table "public"."missionmed_pipeline_events" to "anon";
grant insert on table "public"."missionmed_pipeline_events" to "anon";
grant references on table "public"."missionmed_pipeline_events" to "anon";
grant select on table "public"."missionmed_pipeline_events" to "anon";
grant trigger on table "public"."missionmed_pipeline_events" to "anon";
grant truncate on table "public"."missionmed_pipeline_events" to "anon";
grant update on table "public"."missionmed_pipeline_events" to "anon";
grant delete on table "public"."missionmed_pipeline_events" to "authenticated";
grant insert on table "public"."missionmed_pipeline_events" to "authenticated";
grant references on table "public"."missionmed_pipeline_events" to "authenticated";
grant select on table "public"."missionmed_pipeline_events" to "authenticated";
grant trigger on table "public"."missionmed_pipeline_events" to "authenticated";
grant truncate on table "public"."missionmed_pipeline_events" to "authenticated";
grant update on table "public"."missionmed_pipeline_events" to "authenticated";
grant delete on table "public"."missionmed_pipeline_events" to "service_role";
grant insert on table "public"."missionmed_pipeline_events" to "service_role";
grant references on table "public"."missionmed_pipeline_events" to "service_role";
grant select on table "public"."missionmed_pipeline_events" to "service_role";
grant trigger on table "public"."missionmed_pipeline_events" to "service_role";
grant truncate on table "public"."missionmed_pipeline_events" to "service_role";
grant update on table "public"."missionmed_pipeline_events" to "service_role";
grant delete on table "public"."profile_links" to "anon";
grant insert on table "public"."profile_links" to "anon";
grant references on table "public"."profile_links" to "anon";
grant select on table "public"."profile_links" to "anon";
grant trigger on table "public"."profile_links" to "anon";
grant truncate on table "public"."profile_links" to "anon";
grant update on table "public"."profile_links" to "anon";
grant delete on table "public"."profile_links" to "authenticated";
grant insert on table "public"."profile_links" to "authenticated";
grant references on table "public"."profile_links" to "authenticated";
grant select on table "public"."profile_links" to "authenticated";
grant trigger on table "public"."profile_links" to "authenticated";
grant truncate on table "public"."profile_links" to "authenticated";
grant update on table "public"."profile_links" to "authenticated";
grant delete on table "public"."profile_links" to "service_role";
grant insert on table "public"."profile_links" to "service_role";
grant references on table "public"."profile_links" to "service_role";
grant select on table "public"."profile_links" to "service_role";
grant trigger on table "public"."profile_links" to "service_role";
grant truncate on table "public"."profile_links" to "service_role";
grant update on table "public"."profile_links" to "service_role";
grant delete on table "public"."profiles" to "anon";
grant insert on table "public"."profiles" to "anon";
grant references on table "public"."profiles" to "anon";
grant select on table "public"."profiles" to "anon";
grant trigger on table "public"."profiles" to "anon";
grant truncate on table "public"."profiles" to "anon";
grant update on table "public"."profiles" to "anon";
grant delete on table "public"."profiles" to "authenticated";
grant insert on table "public"."profiles" to "authenticated";
grant references on table "public"."profiles" to "authenticated";
grant select on table "public"."profiles" to "authenticated";
grant trigger on table "public"."profiles" to "authenticated";
grant truncate on table "public"."profiles" to "authenticated";
grant update on table "public"."profiles" to "authenticated";
grant delete on table "public"."profiles" to "service_role";
grant insert on table "public"."profiles" to "service_role";
grant references on table "public"."profiles" to "service_role";
grant select on table "public"."profiles" to "service_role";
grant trigger on table "public"."profiles" to "service_role";
grant truncate on table "public"."profiles" to "service_role";
grant update on table "public"."profiles" to "service_role";
grant delete on table "public"."program_intel_aggregate" to "anon";
grant insert on table "public"."program_intel_aggregate" to "anon";
grant references on table "public"."program_intel_aggregate" to "anon";
grant select on table "public"."program_intel_aggregate" to "anon";
grant trigger on table "public"."program_intel_aggregate" to "anon";
grant truncate on table "public"."program_intel_aggregate" to "anon";
grant update on table "public"."program_intel_aggregate" to "anon";
grant delete on table "public"."program_intel_aggregate" to "authenticated";
grant insert on table "public"."program_intel_aggregate" to "authenticated";
grant references on table "public"."program_intel_aggregate" to "authenticated";
grant select on table "public"."program_intel_aggregate" to "authenticated";
grant trigger on table "public"."program_intel_aggregate" to "authenticated";
grant truncate on table "public"."program_intel_aggregate" to "authenticated";
grant update on table "public"."program_intel_aggregate" to "authenticated";
grant delete on table "public"."program_intel_aggregate" to "service_role";
grant insert on table "public"."program_intel_aggregate" to "service_role";
grant references on table "public"."program_intel_aggregate" to "service_role";
grant select on table "public"."program_intel_aggregate" to "service_role";
grant trigger on table "public"."program_intel_aggregate" to "service_role";
grant truncate on table "public"."program_intel_aggregate" to "service_role";
grant update on table "public"."program_intel_aggregate" to "service_role";
grant delete on table "public"."rank_lists" to "anon";
grant insert on table "public"."rank_lists" to "anon";
grant references on table "public"."rank_lists" to "anon";
grant select on table "public"."rank_lists" to "anon";
grant trigger on table "public"."rank_lists" to "anon";
grant truncate on table "public"."rank_lists" to "anon";
grant update on table "public"."rank_lists" to "anon";
grant delete on table "public"."rank_lists" to "authenticated";
grant insert on table "public"."rank_lists" to "authenticated";
grant references on table "public"."rank_lists" to "authenticated";
grant select on table "public"."rank_lists" to "authenticated";
grant trigger on table "public"."rank_lists" to "authenticated";
grant truncate on table "public"."rank_lists" to "authenticated";
grant update on table "public"."rank_lists" to "authenticated";
grant delete on table "public"."rank_lists" to "service_role";
grant insert on table "public"."rank_lists" to "service_role";
grant references on table "public"."rank_lists" to "service_role";
grant select on table "public"."rank_lists" to "service_role";
grant trigger on table "public"."rank_lists" to "service_role";
grant truncate on table "public"."rank_lists" to "service_role";
grant update on table "public"."rank_lists" to "service_role";
grant delete on table "public"."ranklist_submissions" to "anon";
grant insert on table "public"."ranklist_submissions" to "anon";
grant references on table "public"."ranklist_submissions" to "anon";
grant select on table "public"."ranklist_submissions" to "anon";
grant trigger on table "public"."ranklist_submissions" to "anon";
grant truncate on table "public"."ranklist_submissions" to "anon";
grant update on table "public"."ranklist_submissions" to "anon";
grant delete on table "public"."ranklist_submissions" to "authenticated";
grant insert on table "public"."ranklist_submissions" to "authenticated";
grant references on table "public"."ranklist_submissions" to "authenticated";
grant select on table "public"."ranklist_submissions" to "authenticated";
grant trigger on table "public"."ranklist_submissions" to "authenticated";
grant truncate on table "public"."ranklist_submissions" to "authenticated";
grant update on table "public"."ranklist_submissions" to "authenticated";
grant delete on table "public"."ranklist_submissions" to "service_role";
grant insert on table "public"."ranklist_submissions" to "service_role";
grant references on table "public"."ranklist_submissions" to "service_role";
grant select on table "public"."ranklist_submissions" to "service_role";
grant trigger on table "public"."ranklist_submissions" to "service_role";
grant truncate on table "public"."ranklist_submissions" to "service_role";
grant update on table "public"."ranklist_submissions" to "service_role";
grant delete on table "public"."ranklist_versions" to "anon";
grant insert on table "public"."ranklist_versions" to "anon";
grant references on table "public"."ranklist_versions" to "anon";
grant select on table "public"."ranklist_versions" to "anon";
grant trigger on table "public"."ranklist_versions" to "anon";
grant truncate on table "public"."ranklist_versions" to "anon";
grant update on table "public"."ranklist_versions" to "anon";
grant delete on table "public"."ranklist_versions" to "authenticated";
grant insert on table "public"."ranklist_versions" to "authenticated";
grant references on table "public"."ranklist_versions" to "authenticated";
grant select on table "public"."ranklist_versions" to "authenticated";
grant trigger on table "public"."ranklist_versions" to "authenticated";
grant truncate on table "public"."ranklist_versions" to "authenticated";
grant update on table "public"."ranklist_versions" to "authenticated";
grant delete on table "public"."ranklist_versions" to "service_role";
grant insert on table "public"."ranklist_versions" to "service_role";
grant references on table "public"."ranklist_versions" to "service_role";
grant select on table "public"."ranklist_versions" to "service_role";
grant trigger on table "public"."ranklist_versions" to "service_role";
grant truncate on table "public"."ranklist_versions" to "service_role";
grant update on table "public"."ranklist_versions" to "service_role";
grant delete on table "public"."ranklists" to "anon";
grant insert on table "public"."ranklists" to "anon";
grant references on table "public"."ranklists" to "anon";
grant select on table "public"."ranklists" to "anon";
grant trigger on table "public"."ranklists" to "anon";
grant truncate on table "public"."ranklists" to "anon";
grant update on table "public"."ranklists" to "anon";
grant delete on table "public"."ranklists" to "authenticated";
grant insert on table "public"."ranklists" to "authenticated";
grant references on table "public"."ranklists" to "authenticated";
grant select on table "public"."ranklists" to "authenticated";
grant trigger on table "public"."ranklists" to "authenticated";
grant truncate on table "public"."ranklists" to "authenticated";
grant update on table "public"."ranklists" to "authenticated";
grant delete on table "public"."ranklists" to "service_role";
grant insert on table "public"."ranklists" to "service_role";
grant references on table "public"."ranklists" to "service_role";
grant select on table "public"."ranklists" to "service_role";
grant trigger on table "public"."ranklists" to "service_role";
grant truncate on table "public"."ranklists" to "service_role";
grant update on table "public"."ranklists" to "service_role";
grant delete on table "public"."user_program_interviews" to "anon";
grant insert on table "public"."user_program_interviews" to "anon";
grant references on table "public"."user_program_interviews" to "anon";
grant select on table "public"."user_program_interviews" to "anon";
grant trigger on table "public"."user_program_interviews" to "anon";
grant truncate on table "public"."user_program_interviews" to "anon";
grant update on table "public"."user_program_interviews" to "anon";
grant delete on table "public"."user_program_interviews" to "authenticated";
grant insert on table "public"."user_program_interviews" to "authenticated";
grant references on table "public"."user_program_interviews" to "authenticated";
grant select on table "public"."user_program_interviews" to "authenticated";
grant trigger on table "public"."user_program_interviews" to "authenticated";
grant truncate on table "public"."user_program_interviews" to "authenticated";
grant update on table "public"."user_program_interviews" to "authenticated";
grant delete on table "public"."user_program_interviews" to "service_role";
grant insert on table "public"."user_program_interviews" to "service_role";
grant references on table "public"."user_program_interviews" to "service_role";
grant select on table "public"."user_program_interviews" to "service_role";
grant trigger on table "public"."user_program_interviews" to "service_role";
grant truncate on table "public"."user_program_interviews" to "service_role";
grant update on table "public"."user_program_interviews" to "service_role";
create policy "applicant_no_internal_notes"
  on "command_center"."usce_comms"
  as permissive
  for select
  to anon
using (((is_internal_note = false) AND (offer_id IN ( SELECT usce_offers.id
   FROM command_center.usce_offers
  WHERE ((usce_offers.portal_token_hash = encode(command_center.sha256((current_setting('request.portal_token'::text, true))::bytea), 'hex'::text)) AND (usce_offers.portal_token_expires_at > now()))))));
create policy "coord_full"
  on "command_center"."usce_comms"
  as permissive
  for all
  to authenticated
using ((((auth.jwt() -> 'app_metadata'::text) ->> 'mm_role'::text) = ANY (ARRAY['coordinator'::text, 'admin'::text])));
create policy "applicant_view_own"
  on "command_center"."usce_confirmations"
  as permissive
  for select
  to authenticated
using (((auth.uid() IS NOT NULL) AND (auth.uid() = applicant_user_id)));
create policy "coord_full"
  on "command_center"."usce_confirmations"
  as permissive
  for all
  to authenticated
using ((((auth.jwt() -> 'app_metadata'::text) ->> 'mm_role'::text) = ANY (ARRAY['coordinator'::text, 'admin'::text])));
create policy "applicant_mutate_own_offer_response"
  on "command_center"."usce_offers"
  as permissive
  for update
  to authenticated
using (((auth.uid() IS NOT NULL) AND (auth.uid() = applicant_user_id) AND (portal_token_hash = encode(command_center.sha256((current_setting('request.portal_token'::text, true))::bytea), 'hex'::text)) AND (portal_token_expires_at > now()) AND (status = ANY (ARRAY['SENT'::text, 'REMINDED'::text, 'FAILED_PAYMENT'::text]))))
with check (((auth.uid() IS NOT NULL) AND (auth.uid() = applicant_user_id) AND (status = ANY (ARRAY['ACCEPTED'::text, 'DECLINED'::text, 'PENDING_PAYMENT'::text]))));
create policy "applicant_view_own_offer"
  on "command_center"."usce_offers"
  as permissive
  for select
  to authenticated
using (((auth.uid() IS NOT NULL) AND (auth.uid() = applicant_user_id) AND (portal_token_hash = encode(command_center.sha256((current_setting('request.portal_token'::text, true))::bytea), 'hex'::text)) AND (portal_token_expires_at > now())));
create policy "coord_full"
  on "command_center"."usce_offers"
  as permissive
  for all
  to authenticated
using ((((auth.jwt() -> 'app_metadata'::text) ->> 'mm_role'::text) = ANY (ARRAY['coordinator'::text, 'admin'::text])));
create policy "applicant_self_via_portal_join"
  on "command_center"."usce_requests"
  as permissive
  for select
  to anon
using ((EXISTS ( SELECT 1
   FROM command_center.usce_offers o
  WHERE ((o.request_id = usce_requests.id) AND (o.portal_token_hash = encode(command_center.sha256((current_setting('request.portal_token'::text, true))::bytea), 'hex'::text)) AND (o.portal_token_expires_at > now())))));
create policy "coord_full"
  on "command_center"."usce_requests"
  as permissive
  for all
  to authenticated
using ((((auth.jwt() -> 'app_metadata'::text) ->> 'mm_role'::text) = ANY (ARRAY['coordinator'::text, 'admin'::text])));
create policy "Authenticated users can insert their own attempts"
  on "public"."attempts"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));
create policy "Users can read attempts for their duels"
  on "public"."attempts"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.duels d
  WHERE ((d.id = attempts.duel_id) AND ((d.creator_id = auth.uid()) OR (d.opponent_id = auth.uid()))))));
create policy "Allow anon read on con_daily_diagnosis"
  on "public"."con_daily_diagnosis"
  as permissive
  for select
  to anon
using (true);
create policy "Allow service write on con_daily_diagnosis"
  on "public"."con_daily_diagnosis"
  as permissive
  for all
  to service_role
using (true)
with check (true);
create policy "Allow anon read on con_daily_metrics"
  on "public"."con_daily_metrics"
  as permissive
  for select
  to anon
using (true);
create policy "Allow service write on con_daily_metrics"
  on "public"."con_daily_metrics"
  as permissive
  for all
  to service_role
using (true)
with check (true);
create policy "Allow anon read on con_kpi_targets"
  on "public"."con_kpi_targets"
  as permissive
  for select
  to anon
using (true);
create policy "Allow service write on con_kpi_targets"
  on "public"."con_kpi_targets"
  as permissive
  for all
  to service_role
using (true)
with check (true);
create policy "Authenticated users can insert duels"
  on "public"."duels"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = creator_id));
create policy "Participants can update their duels"
  on "public"."duels"
  as permissive
  for update
  to public
using (((auth.uid() = creator_id) OR (auth.uid() = opponent_id)));
create policy "Users can read their own duels"
  on "public"."duels"
  as permissive
  for select
  to public
using (((auth.uid() = creator_id) OR (auth.uid() = opponent_id)));
create policy "anon_insert_action_queue"
  on "public"."missionmed_action_queue"
  as permissive
  for insert
  to anon
with check (true);
create policy "anon_select_action_queue"
  on "public"."missionmed_action_queue"
  as permissive
  for select
  to anon
using (true);
create policy "anon_update_action_queue"
  on "public"."missionmed_action_queue"
  as permissive
  for update
  to anon
using (true)
with check (true);
create policy "anon_insert_email_threads"
  on "public"."missionmed_email_threads"
  as permissive
  for insert
  to anon
with check (true);
create policy "anon_select_email_threads"
  on "public"."missionmed_email_threads"
  as permissive
  for select
  to anon
using (true);
create policy "anon_update_email_threads"
  on "public"."missionmed_email_threads"
  as permissive
  for update
  to anon
using (true)
with check (true);
create policy "anon_insert_lead_scores"
  on "public"."missionmed_lead_scores"
  as permissive
  for insert
  to anon
with check (true);
create policy "anon_select_lead_scores"
  on "public"."missionmed_lead_scores"
  as permissive
  for select
  to anon
using (true);
create policy "anon_update_lead_scores"
  on "public"."missionmed_lead_scores"
  as permissive
  for update
  to anon
using (true)
with check (true);
create policy "anon_insert_pipeline_events"
  on "public"."missionmed_pipeline_events"
  as permissive
  for insert
  to anon
with check (true);
create policy "anon_select_pipeline_events"
  on "public"."missionmed_pipeline_events"
  as permissive
  for select
  to anon
using (true);
create policy "Users can insert their own profile"
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((auth.uid() = id));
create policy "Users can update their own profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = id));
create policy "Users can view their own profile"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((auth.uid() = id));
create policy "anon_select_profiles_for_lookup"
  on "public"."profiles"
  as permissive
  for select
  to anon
using (true);
create policy "profiles_insert_own"
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((id = auth.uid()));
create policy "profiles_select_own"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((id = auth.uid()));
create policy "ranklists_delete_own"
  on "public"."rank_lists"
  as permissive
  for delete
  to public
using ((profile_id = auth.uid()));
create policy "ranklists_insert_own"
  on "public"."rank_lists"
  as permissive
  for insert
  to public
with check ((profile_id = auth.uid()));
create policy "ranklists_select_own"
  on "public"."rank_lists"
  as permissive
  for select
  to public
using ((profile_id = auth.uid()));
create policy "ranklists_update_own"
  on "public"."rank_lists"
  as permissive
  for update
  to public
using ((profile_id = auth.uid()))
with check ((profile_id = auth.uid()));
create policy "insert own submissions"
  on "public"."ranklist_submissions"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = auth_user_id));
create policy "read own submissions"
  on "public"."ranklist_submissions"
  as permissive
  for select
  to authenticated
using ((auth.uid() = auth_user_id));
create policy "update own submissions"
  on "public"."ranklist_submissions"
  as permissive
  for update
  to authenticated
using ((auth.uid() = auth_user_id))
with check ((auth.uid() = auth_user_id));
create policy "ranklist_versions_delete_own"
  on "public"."ranklist_versions"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.ranklists rl
  WHERE ((rl.id = ranklist_versions.ranklist_id) AND (rl.user_id = auth.uid())))));
create policy "ranklist_versions_insert_own"
  on "public"."ranklist_versions"
  as permissive
  for insert
  to public
with check ((ranklist_id IN ( SELECT ranklists.id
   FROM public.ranklists
  WHERE (ranklists.user_id = auth.uid()))));
create policy "ranklist_versions_select_own"
  on "public"."ranklist_versions"
  as permissive
  for select
  to public
using ((ranklist_id IN ( SELECT ranklists.id
   FROM public.ranklists
  WHERE (ranklists.user_id = auth.uid()))));
create policy "Users can update own ranklists"
  on "public"."ranklists"
  as permissive
  for update
  to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));
create policy "ranklists_delete_own"
  on "public"."ranklists"
  as permissive
  for delete
  to authenticated
using (((user_id = auth.uid()) AND (is_final = false)));
create policy "ranklists_insert_own"
  on "public"."ranklists"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));
create policy "ranklists_select_own"
  on "public"."ranklists"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));
create policy "ranklists_update_own"
  on "public"."ranklists"
  as permissive
  for update
  to authenticated
using (((user_id = auth.uid()) AND (is_final = false)))
with check (((user_id = auth.uid()) AND (is_final = false) AND (finalized_at IS NULL)));
create policy "ranklists_update_own_not_final"
  on "public"."ranklists"
  as permissive
  for update
  to authenticated
using (((user_id = auth.uid()) AND (is_final = false)))
with check (((user_id = auth.uid()) AND (is_final = false) AND (finalized_at IS NULL)));
CREATE TRIGGER usce_confirmations_audit_trigger AFTER INSERT OR DELETE OR UPDATE ON command_center.usce_confirmations FOR EACH ROW EXECUTE FUNCTION command_center.audit_trigger_fn();
CREATE TRIGGER usce_confirmations_set_updated_at BEFORE UPDATE ON command_center.usce_confirmations FOR EACH ROW EXECUTE FUNCTION command_center.usce_set_updated_at();
CREATE TRIGGER usce_offers_audit_trigger AFTER INSERT OR DELETE OR UPDATE ON command_center.usce_offers FOR EACH ROW EXECUTE FUNCTION command_center.audit_trigger_fn();
CREATE TRIGGER usce_offers_enforce_amount_immutability BEFORE UPDATE ON command_center.usce_offers FOR EACH ROW EXECUTE FUNCTION command_center.enforce_amount_immutability();
CREATE TRIGGER usce_offers_enforce_offer_limit BEFORE INSERT ON command_center.usce_offers FOR EACH ROW EXECUTE FUNCTION command_center.enforce_offer_limit();
CREATE TRIGGER usce_offers_enforce_portal_mutation_surface BEFORE UPDATE ON command_center.usce_offers FOR EACH ROW EXECUTE FUNCTION command_center.enforce_portal_mutation_surface();
CREATE TRIGGER usce_offers_enforce_preview_before_approval BEFORE UPDATE ON command_center.usce_offers FOR EACH ROW EXECUTE FUNCTION command_center.enforce_preview_before_approval();
CREATE TRIGGER usce_offers_set_updated_at BEFORE UPDATE ON command_center.usce_offers FOR EACH ROW EXECUTE FUNCTION command_center.usce_set_updated_at();
CREATE TRIGGER usce_requests_audit_trigger AFTER INSERT OR DELETE OR UPDATE ON command_center.usce_requests FOR EACH ROW EXECUTE FUNCTION command_center.audit_trigger_fn();
CREATE TRIGGER usce_requests_set_updated_at BEFORE UPDATE ON command_center.usce_requests FOR EACH ROW EXECUTE FUNCTION command_center.usce_set_updated_at();
CREATE TRIGGER trg_updated_at_action_queue BEFORE UPDATE ON public.missionmed_action_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_email_threads BEFORE UPDATE ON public.missionmed_email_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_lead_scores BEFORE UPDATE ON public.missionmed_lead_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_trim_ranklist_drafts AFTER INSERT ON public.rank_lists FOR EACH ROW EXECUTE FUNCTION public.trim_ranklist_drafts();
CREATE TRIGGER trg_ranklists_updated_at BEFORE UPDATE ON public.ranklists FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
