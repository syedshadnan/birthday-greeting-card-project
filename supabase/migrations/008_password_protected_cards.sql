alter table public.cards
  add column if not exists password_salt text,
  add column if not exists password_hash text,
  add column if not exists password_hint text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cards_password_hash_pair_check'
      and conrelid = 'public.cards'::regclass
  ) then
    alter table public.cards
      add constraint cards_password_hash_pair_check
      check ((password_salt is null) = (password_hash is null));
  end if;
end;
$$;
