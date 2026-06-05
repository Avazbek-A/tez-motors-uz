-- Phase AW (Leap 1) — add a 'converted' enrollment status.
--
-- When an enrolled contact converts (reserves/buys), their active enrollments
-- exit as 'converted' (distinct from 'exited' for unsubscribe/pause) so
-- per-journey conversion rate is a simple count.

alter table public.journey_enrollments drop constraint if exists journey_enrollments_status_check;
alter table public.journey_enrollments
  add constraint journey_enrollments_status_check
  check (status in ('active','completed','exited','converted'));
