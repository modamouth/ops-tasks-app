-- ============================================================
-- Phase 1 Migration (adapted for property-name-based architecture)
-- Run in Supabase SQL Editor
-- ============================================================

-- Assets table
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  property_name text not null,
  name text not null,
  asset_type text not null,
  manufacturer text,
  model text,
  serial_number text,
  install_date date,
  warranty_expiry date,
  service_contract_vendor text,
  service_contract_expiry date,
  status text default 'operational',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_assets_property on assets(property_name);
create index if not exists idx_assets_type on assets(asset_type);

-- Compliance certificates
create table if not exists compliance_certificates (
  id uuid primary key default gen_random_uuid(),
  property_name text not null,
  asset_id uuid references assets(id) on delete set null,
  cert_type text not null,
  cert_number text,
  issued_by text,
  issue_date date,
  expiry_date date not null,
  document_url text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_certs_expiry on compliance_certificates(expiry_date);
create index if not exists idx_certs_property on compliance_certificates(property_name);

-- Open read/write for anon key (same pattern as checklist_submissions)
alter table assets enable row level security;
alter table compliance_certificates enable row level security;

create policy "anon_all_assets" on assets for all using (true) with check (true);
create policy "anon_all_certs" on compliance_certificates for all using (true) with check (true);

-- Expiry view (useful for n8n alerts)
create or replace view v_certificates_expiring_soon as
select
  cc.id,
  cc.property_name,
  a.name as asset_name,
  cc.cert_type,
  cc.cert_number,
  cc.expiry_date,
  (cc.expiry_date - current_date) as days_remaining,
  case
    when cc.expiry_date < current_date then 'expired'
    when cc.expiry_date < current_date + interval '30 days' then 'expiring_soon'
    else 'valid'
  end as status
from compliance_certificates cc
left join assets a on a.id = cc.asset_id
order by cc.expiry_date asc;
