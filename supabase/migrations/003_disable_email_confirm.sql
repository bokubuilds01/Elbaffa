-- ============================================================
-- El BAFFA - Auto-confirm new auth users so admin-created
-- employee accounts can sign in immediately without email
-- confirmation links.
-- ============================================================

create or replace function public.handle_new_user_autoconfirm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email_confirmed_at := now();
  new.confirmed_at := now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_autoconfirm on auth.users;
create trigger on_auth_user_autoconfirm
  before insert on auth.users
  for each row execute procedure public.handle_new_user_autoconfirm();