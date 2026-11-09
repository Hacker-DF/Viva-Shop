/**
 * payments.js — Déclarations de paiement : moyens, statuts, enregistrement et suivi.
 * Une déclaration n'est jamais un paiement confirmé : seule l'équipe financière confirme.
 */
import { supabase } from './supabase.js';
import { getSession } from './auth.js';
import { APP_CONFIG } from './config.js';

/** Moyens de paiement. channelIndex renvoie vers APP_CONFIG.paymentChannels (jamais de numéro inventé). */
export const METHODS = {
  mixx_by_yas: { label: 'Mixx by Yas (TMoney)', channelIndex: 0 },
  flooz: { label: 'Moov Money (Flooz)', channelIndex: 1 },
  virement: { label: 'Virement bancaire', channelIndex: null },
};

export const PAYMENT_STATUS = {
  en_attente_verification: { label: 'En attente de vérification', color: 'var(--status-red)' },
  en_cours_verification: { label: 'En cours de vérification', color: 'var(--electric)' },
  paiement_confirme: { label: 'Paiement confirmé', color: 'var(--status-green)' },
  montant_incorrect: { label: 'Montant incorrect', color: 'var(--status-orange)' },
  transaction_introuvable: { label: 'Transaction introuvable', color: 'var(--status-orange)' },
  declaration_rejetee: { label: 'Déclaration rejetée', color: 'var(--status-red)' },
  rembourse: { label: 'Remboursé', color: 'var(--status-grey)' },
};

/** Numéro officiel et bénéficiaire d'un moyen de paiement, ou null (virement). */
export function channelFor(method) {
  const idx = METHODS[method]?.channelIndex;
  return idx == null ? null : APP_CONFIG.paymentChannels[idx];
}

/** Enregistre une déclaration. Retourne le numéro de commande généré par la base. */
export async function createDeclaration(d) {
  const session = await getSession();
  if (!session) throw new Error('Connectez-vous pour déclarer un paiement.');
  const { data, error } = await supabase.from('payment_declarations').insert({
    user_id: session.user.id,
    product_id: d.productId,
    variant: d.variant || null,
    quantity: d.quantity,
    payer_name: d.payerName,
    payer_phone: d.payerPhone || null,
    amount: d.amount,
    payment_method: d.method,
    ref_code: d.ref || null,
    txn_id: d.txn || null,
    notes: d.notes || null,
  }).select('id, order_number').single();
  if (error) throw error;
  return data;
}

/** Déclarations de l'utilisateur connecté, les plus récentes d'abord. */
export async function listMyDeclarations() {
  const { data, error } = await supabase.from('payment_declarations')
    .select('id, order_number, quantity, variant, amount, payment_method, ref_code, txn_id, status, whatsapp_sent_at, created_at, products(code, name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Indique que le document a été transmis à un agent. */
export async function markWhatsappSent(id) {
  const { error } = await supabase.from('payment_declarations')
    .update({ whatsapp_sent_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}
