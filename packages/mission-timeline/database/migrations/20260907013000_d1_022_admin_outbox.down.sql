begin;
-- Restore previous policy behavior without deleting any canonical, audit or outbox row.
drop policy outbox_admin_scope_022 on timeline.outbox_events;
drop policy outbox_admin_insert_022 on timeline.outbox_events;
drop function timeline.admin_outbox_matches_022(text,text,text,text,jsonb,integer,timestamptz,timestamptz);
drop policy exports_admin_insert_022 on timeline.export_jobs;
drop policy approvals_admin_insert_022 on timeline.approval_events;
drop policy comments_admin_insert_022 on timeline.comments;
drop policy reviews_admin_update_022 on timeline.review_requests;
drop policy reviews_admin_insert_022 on timeline.review_requests;
commit;
