create or replace function public.get_session_user(p_token_hash text)
returns table (
  openid text,
  expires_at timestamptz,
  display_name text,
  organizations text[],
  role text,
  dismissed boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
as $$
  select
    s.openid,
    s.expires_at,
    u.display_name,
    u.organizations,
    u.role,
    u.dismissed,
    u.created_at,
    u.updated_at
  from public.mini_sessions s
  join public.users u on u.openid = s.openid
  where s.token_hash = p_token_hash
  limit 1;
$$;

create index if not exists inventory_item_org_updated_idx
  on public.inventory (item_id, organization, updated_at desc);

create index if not exists inventory_item_updated_idx
  on public.inventory (item_id, updated_at desc);
