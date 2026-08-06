-- ============================================================
-- Phase 2 Migration: Preventive Maintenance Schedules
-- Adapted for property-name architecture (no properties table)
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. PM Schedules — the recurring templates
create table if not exists pm_schedules (
  id uuid primary key default gen_random_uuid(),
  property_name text not null,
  asset_id uuid references assets(id) on delete set null,
  title text not null,
  description text,
  priority text default 'medium',
  assigned_to text,                          -- assignee name, not a UUID
  frequency_value integer not null,          -- e.g. 3
  frequency_unit text not null,              -- 'days' | 'weeks' | 'months' | 'years'
  lead_time_days integer default 0,          -- generate task N days before due
  last_generated_at date,
  next_due_date date not null,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_pm_schedules_next_due on pm_schedules(next_due_date) where active = true;
create index if not exists idx_pm_schedules_property on pm_schedules(property_name);

-- 2. PM Task Log — written by n8n when it generates tasks
--    and updated when tasks are completed, enabling compliance views
create table if not exists pm_task_log (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references pm_schedules(id) on delete cascade,
  property_name text not null,
  due_date date not null,
  generated_at date not null default current_date,
  completed_at timestamptz,
  task_ref text,                             -- task ID in the app (e.g. "OTJ-003")
  created_at timestamptz default now()
);

create index if not exists idx_pm_task_log_schedule on pm_task_log(schedule_id);
create index if not exists idx_pm_task_log_due on pm_task_log(due_date);

-- 3. Function — advance next_due_date after a task is generated
create or replace function advance_pm_schedule(schedule_id uuid)
returns void as $$
declare
  s pm_schedules%rowtype;
begin
  select * into s from pm_schedules where id = schedule_id;
  update pm_schedules
  set
    last_generated_at = current_date,
    next_due_date = s.next_due_date + (s.frequency_value || ' ' || s.frequency_unit)::interval,
    updated_at = now()
  where id = schedule_id;
end;
$$ language plpgsql;

-- 4. View — schedules ready for task generation (n8n queries this daily)
create or replace view v_pm_due_for_generation as
select
  ps.*,
  a.name as asset_name,
  a.asset_type
from pm_schedules ps
left join assets a on a.id = ps.asset_id
where ps.active = true
  and (ps.next_due_date - (ps.lead_time_days || ' days')::interval)::date <= current_date
  and (ps.last_generated_at is null or ps.last_generated_at < ps.next_due_date);

-- 5. View — PM compliance by property
create or replace view v_pm_compliance_by_property as
select
  ps.property_name,
  count(pl.id) as total_pm_tasks,
  count(pl.id) filter (where pl.completed_at is not null and pl.completed_at::date <= pl.due_date) as completed_on_time,
  count(pl.id) filter (where pl.completed_at is not null and pl.completed_at::date > pl.due_date) as completed_late,
  count(pl.id) filter (where pl.completed_at is null and pl.due_date < current_date) as overdue_open,
  round(
    100.0 * count(pl.id) filter (where pl.completed_at is not null and pl.completed_at::date <= pl.due_date)
    / nullif(count(pl.id), 0), 1
  ) as pct_on_time
from pm_schedules ps
left join pm_task_log pl on pl.schedule_id = ps.id
group by ps.property_name
order by pct_on_time asc nulls last;

-- 6. View — PM compliance by asset (drill-down: which lift/generator keeps slipping)
create or replace view v_pm_compliance_by_asset as
select
  a.id as asset_id,
  a.name as asset_name,
  a.asset_type,
  ps.property_name,
  count(pl.id) as total_pm_tasks,
  count(pl.id) filter (where pl.completed_at is not null and pl.completed_at::date <= pl.due_date) as completed_on_time,
  count(pl.id) filter (where pl.completed_at is null and pl.due_date < current_date) as overdue_open,
  round(
    100.0 * count(pl.id) filter (where pl.completed_at is not null and pl.completed_at::date <= pl.due_date)
    / nullif(count(pl.id), 0), 1
  ) as pct_on_time
from pm_schedules ps
join assets a on a.id = ps.asset_id
left join pm_task_log pl on pl.schedule_id = ps.id
group by a.id, a.name, a.asset_type, ps.property_name
order by pct_on_time asc nulls last;

-- 7. RLS — open anon (same pattern as Phase 1)
alter table pm_schedules enable row level security;
alter table pm_task_log enable row level security;

create policy "anon_all_pm_schedules" on pm_schedules for all using (true) with check (true);
create policy "anon_all_pm_task_log" on pm_task_log for all using (true) with check (true);

-- ============================================================
-- n8n daily cron flow (reference):
--
--  1. Trigger: Schedule node — 06:00 daily
--  2. Supabase node: SELECT * FROM v_pm_due_for_generation
--  3. IF no rows → stop
--  4. Loop over rows:
--     a. Google Sheets node: append row to task sheet
--        (Task ID auto-generated, title, property, assignee, due_date, priority)
--     b. Supabase node: INSERT INTO pm_task_log
--        (schedule_id, property_name, due_date, task_ref = generated task ID)
--     c. Supabase RPC: advance_pm_schedule(schedule_id)
--     d. Optional: WhatsApp/email to assigned_to about new task
-- ============================================================
