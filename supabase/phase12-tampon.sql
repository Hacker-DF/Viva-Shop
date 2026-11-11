-- ==========================================================================
-- phase12-tampon.sql — Viva Shop — Date de validation pour le tampon du pro forma
-- À exécuter après phase11c-supprimer-colis.sql.
-- ==========================================================================

alter table public.payment_declarations add column if not exists verified_at timestamptz;

create or replace function public.set_payment_status(p_id uuid, p_status text, p_note text default null)
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
         verified_at = case when p_status = 'paiement_confirme' then now() else verified_at end
   where id = p_id;
  if not found then
    raise exception 'Déclaration introuvable';
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'paiement_' || p_status, 'payment_declarations', p_id::text,
          jsonb_build_object('note', p_note));
end;
$$;
