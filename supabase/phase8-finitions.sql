-- ==========================================================================
-- phase8-finitions.sql — Viva Shop — Suspension de compte et réclamations
-- À exécuter après phase7b-arrivee.sql.
-- ==========================================================================

-- ---------- Suspension de compte ----------
alter table public.profiles add column if not exists is_suspended boolean not null default false;
alter table public.profiles add column if not exists suspension_reason text;

create or replace function public.is_account_active()
returns boolean
language sql stable security definer set search_path = public
as $$
  select not coalesce((select is_suspended from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.set_account_suspended(p_user uuid, p_suspended boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role('administrateur_principal') then
    raise exception 'Action réservée à l’administrateur principal';
  end if;
  if p_user = auth.uid() then
    raise exception 'Vous ne pouvez pas suspendre votre propre compte';
  end if;

  update public.profiles
     set is_suspended = p_suspended,
         suspension_reason = case when p_suspended then nullif(trim(coalesce(p_reason, '')), '') else null end
   where id = p_user;
  if not found then raise exception 'Utilisateur introuvable'; end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), case when p_suspended then 'compte_suspendu' else 'compte_reactive' end,
          'profiles', p_user::text, jsonb_build_object('raison', p_reason));
end;
$$;

revoke execute on function public.set_account_suspended(uuid, boolean, text) from public, anon;
grant execute on function public.set_account_suspended(uuid, boolean, text) to authenticated;

-- Un compte suspendu ne peut plus réserver ni déclarer de paiement
drop policy if exists reservations_insert_own on public.reservations;
create policy reservations_insert_own on public.reservations
  for insert to authenticated
  with check (
    user_id = auth.uid() and public.is_account_active()
    and exists (select 1 from public.products p
                where p.id = product_id and p.status = 'en_attente' and not p.is_archived)
  );

drop policy if exists payments_insert_own on public.payment_declarations;
create policy payments_insert_own on public.payment_declarations
  for insert to authenticated
  with check (
    user_id = auth.uid() and public.is_account_active()
    and status = 'en_attente_verification'
    and exists (select 1 from public.products p
                where p.id = product_id and p.status = 'collecte_ouverte' and not p.is_archived)
  );

-- ---------- Réclamations ----------
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 5 and 2000),
  status text not null default 'ouverte' check (status in ('ouverte', 'en_cours', 'resolue')),
  reply text check (reply is null or char_length(reply) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists support_tickets_touch on public.support_tickets;
create trigger support_tickets_touch before update on public.support_tickets
  for each row execute function public.touch_updated_at();

create or replace function public.can_handle_tickets()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_role('administrateur_principal') or public.has_role('support_client')
      or public.has_role('responsable_commandes');
$$;

alter table public.support_tickets enable row level security;

drop policy if exists tickets_insert_own on public.support_tickets;
create policy tickets_insert_own on public.support_tickets
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_account_active());

drop policy if exists tickets_select on public.support_tickets;
create policy tickets_select on public.support_tickets
  for select to authenticated
  using (user_id = auth.uid() or public.can_handle_tickets());

drop policy if exists tickets_update_staff on public.support_tickets;
create policy tickets_update_staff on public.support_tickets
  for update to authenticated
  using (public.can_handle_tickets()) with check (public.can_handle_tickets());

-- Le personnel ne modifie que le statut et la réponse
revoke update on public.support_tickets from authenticated;
grant update (status, reply) on public.support_tickets to authenticated;

-- Le personnel de support voit le nom des clients
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or public.has_role('administrateur_principal')
    or public.can_verify_payments()
    or public.is_logistics_staff()
    or public.can_handle_tickets()
  );
