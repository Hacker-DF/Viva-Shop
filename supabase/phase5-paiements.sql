-- ==========================================================================
-- phase5-paiements.sql — Viva Shop — Phase 5 : déclaration de paiement et vérification
-- À exécuter après phase4b-campagnes.sql. Une déclaration n'est PAS une confirmation de paiement.
-- Seul un agent financier peut confirmer ou rejeter une déclaration.
-- ==========================================================================

create sequence if not exists public.order_number_seq;

create table if not exists public.payment_declarations (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique
    default ('CMD-' || lpad(nextval('public.order_number_seq')::text, 6, '0')),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant text check (char_length(variant) <= 60),
  quantity int not null check (quantity between 1 and 10000),
  payer_name text not null check (char_length(payer_name) between 2 and 100),
  payer_phone text check (payer_phone is null or payer_phone ~ '^\+?[0-9 ]{8,20}$'),
  amount integer not null check (amount > 0),
  payment_method text not null check (payment_method in ('mixx_by_yas', 'flooz', 'virement')),
  ref_code text check (ref_code is null or char_length(ref_code) between 4 and 60),
  txn_id text check (txn_id is null or char_length(txn_id) between 4 and 60),
  notes text check (char_length(notes) <= 500),
  status text not null default 'en_attente_verification'
    check (status in ('en_attente_verification', 'en_cours_verification', 'paiement_confirme',
                      'montant_incorrect', 'transaction_introuvable', 'declaration_rejetee', 'rembourse')),
  verification_note text,
  whatsapp_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Au moins une vraie référence est exigée
  constraint payment_has_reference check (ref_code is not null or txn_id is not null)
);
create index if not exists payment_declarations_user_idx on public.payment_declarations(user_id, created_at desc);

drop trigger if exists payment_declarations_touch on public.payment_declarations;
create trigger payment_declarations_touch
  before update on public.payment_declarations
  for each row execute function public.touch_updated_at();

-- Droit de vérification : agent financier ou administrateur principal
create or replace function public.can_verify_payments()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('agent_financier') or public.has_role('administrateur_principal');
$$;

-- Seule fonction autorisée à changer un statut de paiement (vérifie le droit et journalise)
create or replace function public.set_payment_status(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_verify_payments() then
    raise exception 'Action réservée à l''équipe financière';
  end if;
  if p_status not in ('en_cours_verification', 'paiement_confirme', 'montant_incorrect',
                      'transaction_introuvable', 'declaration_rejetee', 'rembourse') then
    raise exception 'Statut inconnu';
  end if;

  update public.payment_declarations
     set status = p_status, verification_note = p_note
   where id = p_id;
  if not found then
    raise exception 'Déclaration introuvable';
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'paiement_' || p_status, 'payment_declarations', p_id::text,
          jsonb_build_object('note', p_note));
end;
$$;

revoke execute on function public.set_payment_status(uuid, text, text) from public, anon;
grant execute on function public.set_payment_status(uuid, text, text) to authenticated;

-- Droits
alter table public.payment_declarations enable row level security;

-- Déclarer : seulement pour soi, et seulement si la collecte du produit est ouverte
drop policy if exists payments_insert_own on public.payment_declarations;
create policy payments_insert_own on public.payment_declarations
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'en_attente_verification'
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'collecte_ouverte' and not p.is_archived
    )
  );

-- Lecture : ses propres déclarations, ou l'équipe financière
drop policy if exists payments_select on public.payment_declarations;
create policy payments_select on public.payment_declarations
  for select to authenticated
  using (user_id = auth.uid() or public.can_verify_payments());

-- Mise à jour : seul le champ « transmis à un agent » est modifiable par le client
drop policy if exists payments_update_own on public.payment_declarations;
create policy payments_update_own on public.payment_declarations
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.payment_declarations from authenticated;
grant update (whatsapp_sent_at) on public.payment_declarations to authenticated;
