-- ==========================================================================
-- phase22-proforma.sql — Viva Shop — Date du paiement reçu, pour le pro forma
-- À exécuter après viva-shop-rattrapage.sql.
-- L'administrateur saisit la date de réception du paiement en confirmant.
-- ==========================================================================

alter table public.payment_declarations add column if not exists payment_date date;

drop function if exists public.set_payment_status(uuid, text, text);

create or replace function public.set_payment_status(p_id uuid, p_status text, p_note text default null, p_payment_date date default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.can_verify_payments() then
    raise exception 'Action réservée à l’équipe financière';
  end if;
  if p_status not in ('en_cours_verification', 'paiement_confirme', 'montant_incorrect',
                      'transaction_introuvable', 'declaration_rejetee', 'rembourse') then
    raise exception 'Statut inconnu';
  end if;

  update public.payment_declarations
     set status = p_status,
         verification_note = p_note,
         verified_at = case when p_status = 'paiement_confirme' then now() else verified_at end,
         payment_date = case when p_status = 'paiement_confirme' then coalesce(p_payment_date, current_date) else payment_date end
   where id = p_id;
  if not found then
    raise exception 'Déclaration introuvable';
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'paiement_' || p_status, 'payment_declarations', p_id::text,
          jsonb_build_object('note', p_note, 'date_paiement', p_payment_date));
end;
$$;

revoke execute on function public.set_payment_status(uuid, text, text, date) from public, anon;
grant execute on function public.set_payment_status(uuid, text, text, date) to authenticated;
