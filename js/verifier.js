/**
 * verifier.js — Page de vérification d'un pro forma (lien du code QR, sans connexion).
 * N'affiche que le numéro de commande, le produit et le statut.
 */
import { escapeHtml } from './ui.js';
import { supabase } from './supabase.js';
import { PAYMENT_STATUS } from './payments.js';

export async function render(container) {
  const token = window.location.hash.split('/')[2] || '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    container.innerHTML = '<div class="alert alert-warn">Lien de vérification invalide.</div>';
    return;
  }
  const { data, error } = await supabase.rpc('verify_declaration', { p_token: token });
  if (error) throw error;
  const row = data?.[0];
  if (!row) {
    container.innerHTML = '<div class="alert alert-warn">Aucun document ne correspond à ce lien.</div>';
    return;
  }
  const st = PAYMENT_STATUS[row.status] || { label: row.status, color: 'var(--grey-600)' };
  container.innerHTML = `
    <section class="card placeholder">
      <h1>Vérification du pro forma</h1>
      <p>Commande <strong>${escapeHtml(row.order_number)}</strong></p>
      <p>${escapeHtml(row.product_name)}</p>
      <span class="status-badge" style="--c: ${st.color}">${escapeHtml(st.label)}</span>
      ${row.verified_at ? `<p class="hint">Validé le ${escapeHtml(new Date(row.verified_at).toLocaleDateString('fr-FR'))}</p>` : ''}
      <p class="hint">Ce statut est fourni par Viva Shop. Aucune autre information personnelle n’est affichée.</p>
    </section>`;
}
