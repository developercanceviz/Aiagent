-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security (RLS) scaffolding — tenant isolation backstop.
-- Apply AFTER `prisma db push` creates the tables. Run in Supabase SQL editor.
--
-- Model: each dashboard user belongs to exactly one merchant (users.merchant_id).
-- A helper reads the caller's merchant from their user row; every tenant table
-- is then locked to that merchant. The service-role key bypasses RLS for
-- webhooks/jobs (lib/supabase/admin.ts), which derive the tenant themselves.
-- ─────────────────────────────────────────────────────────────────────────

-- Extensions used by the schema.
create extension if not exists vector;
create extension if not exists pgcrypto;

-- Returns the merchant_id for the currently authenticated Supabase user.
create or replace function public.current_merchant_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select "merchantId" from public.users where email = auth.jwt() ->> 'email' limit 1;
$$;

-- Helper: enable RLS + a single tenant policy on a table whose tenant column
-- is "merchantId". (announcements is global and intentionally excluded.)
do $$
declare
  t text;
  tenant_tables text[] := array[
    'merchants','users','agents','channels','conversations',
    'leads','knowledge_items','quick_replies','widget_configs',
    'conversation_events'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists tenant_isolation on public.%I;', t);
  end loop;
end $$;

-- merchants: a user can see only their own merchant row (id = current merchant).
create policy tenant_isolation on public.merchants
  using (id = public.current_merchant_id());

-- messages: scoped indirectly via its conversation's merchant.
alter table public.messages enable row level security;
drop policy if exists tenant_isolation on public.messages;
create policy tenant_isolation on public.messages
  using (
    exists (
      select 1 from public.conversations c
      where c.id = "conversationId"
        and c."merchantId" = public.current_merchant_id()
    )
  );

-- All other tenant tables: direct merchantId match.
do $$
declare
  t text;
  direct_tables text[] := array[
    'users','agents','channels','conversations',
    'leads','knowledge_items','quick_replies','widget_configs',
    'conversation_events'
  ];
begin
  foreach t in array direct_tables loop
    execute format(
      'create policy tenant_isolation on public.%I using ("merchantId" = public.current_merchant_id());',
      t
    );
  end loop;
end $$;

-- announcements: global, readable by any authenticated user.
alter table public.announcements enable row level security;
drop policy if exists read_all on public.announcements;
create policy read_all on public.announcements for select using (auth.role() = 'authenticated');
