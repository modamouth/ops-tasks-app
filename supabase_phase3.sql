-- ============================================================
-- Phase 3: Buildings Portfolio, Inspections, Documents, Tenants
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. buildings — master entity for each property
create table if not exists buildings (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  address        text,
  region         text,
  status         text default 'operational', -- 'operational' | 'at_risk' | 'critical' | 'inactive'
  health_score   numeric(5,2),               -- 0–100; TODO: auto-computed on task/inspection writes
  created_at     timestamptz default now()
);

-- Seed from MASTER_PROPERTIES (17 buildings)
insert into buildings (name) values
  ('269 Independence'),
  ('44 On Post'),
  ('Arandis Convenience Centre'),
  ('Forum Building'),
  ('Katutura Shopping Centre'),
  ('Keetmanshoop Shopping Centre'),
  ('Kenya House'),
  ('Maerua Lifestyle Shopping Centre'),
  ('Mediva House'),
  ('Mutual Tower'),
  ('Ondangwa'),
  ('Oshakati Shopping Centre'),
  ('Oshikango Shopping Centre'),
  ('Otjivanda Shopping Centre'),
  ('Rehoboth Shopping Centre'),
  ('Schuster House'),
  ('Windhoek Sanlam Centre')
on conflict (name) do nothing;

-- 2. Extend existing assets table with building_id FK
alter table assets add column if not exists building_id uuid references buildings(id) on delete set null;

-- Backfill from property_name (best-effort; only matches where names are identical)
update assets a
set    building_id = b.id
from   buildings b
where  a.property_name = b.name
  and  a.building_id is null;

create index if not exists idx_assets_building on assets(building_id);

-- 3. Extend pm_schedules with building_id FK
alter table pm_schedules add column if not exists building_id uuid references buildings(id) on delete set null;

update pm_schedules ps
set    building_id = b.id
from   buildings b
where  ps.property_name = b.name
  and  ps.building_id is null;

-- 4. inspections
create table if not exists inspections (
  id             uuid primary key default gen_random_uuid(),
  building_id    uuid references buildings(id) on delete cascade,
  asset_id       uuid references assets(id) on delete set null,
  type           text not null,
  scheduled_date date,
  completed_date date,
  status         text default 'scheduled', -- 'scheduled' | 'in_progress' | 'completed' | 'overdue'
  overall_result text,                     -- 'pass' | 'fail' | 'conditional'
  inspector      text,
  notes          text,
  created_at     timestamptz default now()
);

create index if not exists idx_inspections_building on inspections(building_id);

-- 5. inspection_templates — reusable checklist items per inspection type
create table if not exists inspection_templates (
  id         uuid primary key default gen_random_uuid(),
  type       text not null,
  item_label text not null,
  sort_order integer default 0
);

-- 6. inspection_items — per-inspection findings
create table if not exists inspection_items (
  id               uuid primary key default gen_random_uuid(),
  inspection_id    uuid references inspections(id) on delete cascade,
  template_item_id uuid references inspection_templates(id) on delete set null,
  label            text not null,
  result           text,      -- 'pass' | 'fail' | 'n/a'
  notes            text,
  photo_url        text
);

create index if not exists idx_inspection_items_inspection on inspection_items(inspection_id);

-- 7. documents
create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  building_id uuid references buildings(id) on delete cascade,
  asset_id    uuid references assets(id) on delete set null,
  name        text not null,
  kind        text not null, -- 'building_plan' | 'compliance_cert' | 'warranty' | 'lease' | 'inspection_report' | 'quote' | 'other'
  file_url    text,
  uploaded_at timestamptz default now()
);

create index if not exists idx_documents_building on documents(building_id);

-- 8. tenants
create table if not exists tenants (
  id          uuid primary key default gen_random_uuid(),
  building_id uuid references buildings(id) on delete cascade,
  unit        text,
  name        text not null,
  contact     text,
  lease_start date,
  lease_end   date,
  created_at  timestamptz default now()
);

create index if not exists idx_tenants_building on tenants(building_id);

-- 9. RLS — open anon (same pattern as all existing tables)
alter table buildings          enable row level security;
alter table inspections        enable row level security;
alter table inspection_templates enable row level security;
alter table inspection_items   enable row level security;
alter table documents          enable row level security;
alter table tenants            enable row level security;

create policy "anon_all_buildings"             on buildings             for all using (true) with check (true);
create policy "anon_all_inspections"           on inspections           for all using (true) with check (true);
create policy "anon_all_inspection_templates"  on inspection_templates  for all using (true) with check (true);
create policy "anon_all_inspection_items"      on inspection_items      for all using (true) with check (true);
create policy "anon_all_documents"             on documents             for all using (true) with check (true);
create policy "anon_all_tenants"               on tenants               for all using (true) with check (true);

-- ============================================================
-- TODO: health_score auto-computation
-- Suggested trigger logic (to implement in next pass):
--   On task status → 'Done':   recalculate weighted score for building
--   On inspection completed:   recalculate weighted score for building
--   Components (suggested weights):
--     - % assets with status = 'operational'          → 30%
--     - % inspections completed on time (last 12 mo)  → 30%
--     - count of open inspection_items with fail       → 20%
--     - vacancy trend (% units occupied)              → 20%
-- ============================================================
