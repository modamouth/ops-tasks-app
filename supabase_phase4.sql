-- ============================================================
-- Phase 4: Health Score — extend checklist_submissions
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add building_id FK (backfill from name match)
alter table checklist_submissions
  add column if not exists building_id uuid references buildings(id) on delete set null;

update checklist_submissions cs
set    building_id = b.id
from   buildings b
where  cs.building = b.name
  and  cs.building_id is null;

create index if not exists idx_checklist_submissions_building_id
  on checklist_submissions(building_id);

-- 2. Add score (0–100 weighted condition rating) and result ('pass'|'fail'|'conditional'|'info')
alter table checklist_submissions
  add column if not exists score   numeric(5,2),
  add column if not exists result  text;

-- score/result for existing BCA rows will be populated on next client-side save or
-- computed inline from form_data by the health score hook.

-- 3. Index for efficient BCA lookups by building
create index if not exists idx_checklist_submissions_checklist_building
  on checklist_submissions(checklist_id, building);
