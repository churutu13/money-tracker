-- Seed opzionale e idempotente.
-- Non contiene dati finanziari o personali: ogni utente parte da zero.

create or replace function public.seed_user_data()
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles(id, display_name)
  values(uid, null)
  on conflict (id) do nothing;

  if (select seeded_at is not null from public.profiles where id = uid) then
    return false;
  end if;

  update public.profiles set seeded_at = now() where id = uid;
  return true;
end;
$$;

grant execute on function public.seed_user_data() to authenticated;
