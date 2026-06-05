-- Phase AW — lead scoring. Score every inbound lead so the dealer can work the
-- hottest first and the system can fire an instant alert on a hot one.
alter table public.inquiries add column if not exists lead_score integer;
create index if not exists inquiries_lead_score_idx on public.inquiries (lead_score desc nulls last);
