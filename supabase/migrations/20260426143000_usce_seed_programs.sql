BEGIN;

INSERT INTO command_center.usce_program_seats (
  id,
  program_name,
  specialty,
  location,
  cohort_start_date,
  seats_total,
  active
)
VALUES
  ('8cb6b5e4-4d02-4ad7-8d2f-6f5d9f89e001', 'USCE Internal Medicine Core 2026-A', 'Internal Medicine', 'New York, NY', DATE '2026-08-03', 24, true),
  ('8cb6b5e4-4d02-4ad7-8d2f-6f5d9f89e002', 'USCE Family Medicine Core 2026-A', 'Family Medicine', 'Houston, TX', DATE '2026-08-10', 20, true),
  ('8cb6b5e4-4d02-4ad7-8d2f-6f5d9f89e003', 'USCE Pediatrics Core 2026-A', 'Pediatrics', 'Chicago, IL', DATE '2026-08-17', 18, true),
  ('8cb6b5e4-4d02-4ad7-8d2f-6f5d9f89e004', 'USCE Surgery Core 2026-A', 'General Surgery', 'Phoenix, AZ', DATE '2026-09-07', 16, true),
  ('8cb6b5e4-4d02-4ad7-8d2f-6f5d9f89e005', 'USCE Psychiatry Core 2026-A', 'Psychiatry', 'Miami, FL', DATE '2026-09-14', 14, true),
  ('8cb6b5e4-4d02-4ad7-8d2f-6f5d9f89e006', 'USCE Emergency Medicine Core 2026-A', 'Emergency Medicine', 'Los Angeles, CA', DATE '2026-09-21', 15, true);

COMMIT;
