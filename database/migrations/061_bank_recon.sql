-- 061: المطابقة البنكية (كشف + ربط بالفواتير)
create table if not exists public.bank_statements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  stmt_date date not null,
  amount numeric not null,
  reference text not null default '',
  status text not null default 'unmatched' check (status in ('unmatched', 'matched')),
  matched_invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists bank_statements_tenant on public.bank_statements(tenant_id, status, stmt_date desc);
