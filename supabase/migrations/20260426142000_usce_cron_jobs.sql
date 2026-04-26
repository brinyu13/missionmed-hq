BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'usce_sla_hourly') THEN
    PERFORM cron.schedule(
      'usce_sla_hourly',
      '0 * * * *',
      'SELECT command_center.usce_run_sla();'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'usce_payment_timeout') THEN
    PERFORM cron.schedule(
      'usce_payment_timeout',
      '*/5 * * * *',
      'SELECT command_center.usce_run_payment_timeout();'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'usce_archive_terminal') THEN
    PERFORM cron.schedule(
      'usce_archive_terminal',
      '0 3 * * *',
      'SELECT command_center.usce_archive_terminal_after_90d();'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'usce_sla_coordinator') THEN
    PERFORM cron.schedule(
      'usce_sla_coordinator',
      '*/15 * * * *',
      'SELECT command_center.usce_run_coordinator_sla();'
    );
  END IF;
END
$$;

COMMIT;
