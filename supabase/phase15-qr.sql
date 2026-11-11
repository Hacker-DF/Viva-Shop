-- ==========================================================================
-- phase15-qr.sql — Viva Shop — Code QR de vérification du pro forma
-- À exécuter après viva-shop-couleurs.sql.
-- La vérification ne renvoie que le numéro de commande, le produit et le statut : aucune donnée personnelle.
-- ==========================================================================

alter table public.payment_declarations
  add column if not exists verify_token uuid not null default gen_random_uuid();

create unique index if not exists payment_declarations_verify_token_idx
  on public.payment_declarations(verify_token);

create or replace function public.verify_declaration(p_token uuid)
returns table(order_number text, status text, product_name text, verified_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select d.order_number, d.status, p.name, d.verified_at
  from public.payment_declarations d
  join public.products p on p.id = d.product_id
  where d.verify_token = p_token;
$$;

grant execute on function public.verify_declaration(uuid) to anon, authenticated;
