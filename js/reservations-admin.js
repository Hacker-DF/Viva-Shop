/**
 * reservations-admin.js — Toutes les réservations, avec suppression définitive par sélection.
 * Réservé à l'administrateur principal (et au propriétaire).
 */
import { escapeHtml } from './ui.js';
import { supabase } from './supabase.js';
import { translateError } from './auth.js';
import { t } from './i18n.js';

export async function render(container) {
  container.innerHTML = `
    <div class="admin-toolbar"><h1>${t('res.admin_title')}</h1>
      <button id="del-res-admin" class="btn btn-ghost btn-small" type="button">${t('del.delete_selected')}</button></div>
    <p id="rv-msg" class="alert" role="status" hidden></p>
    <div id="rv-body"><p class="product-code">${t('jr.loading')}</p></div>`;

  const show = (text, type = 'error') => {
    const m = container.querySelector('#rv-msg');
    m.className = `alert alert-${type}`;
    m.textContent = text;
    m.hidden = false;
  };

  const { data, error } = await supabase.from('reservations')
    .select('id, quantity, variant, status, created_at, products(code, name, status), profiles(username, first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) return show(translateError(error));

  container.querySelector('#rv-body').innerHTML = data.length
    ? `<ul class="admin-list">${data.map((r) => `
        <li class="admin-row">
          <label class="check-line sel"><input type="checkbox" data-del-admin="${r.id}"> ${escapeHtml(t('del.select'))}</label>
          <div class="admin-row-main">
            <strong>${escapeHtml(r.products?.name || t('orders.product'))}</strong>
            <span class="product-code">${escapeHtml(r.products?.code || '')} · ${escapeHtml(t('orders.qty'))} ${r.quantity}${r.variant ? ' · ' + escapeHtml(r.variant) : ''}</span>
            <span class="author-line"><strong>${escapeHtml(t('author.label'))} :</strong> ${escapeHtml(r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name} (@${r.profiles.username})` : t('author.missing'))}</span>
            <span class="product-code">${escapeHtml(r.status === 'annulee' ? t('res.status_cancelled') : t('res.status_active'))}</span>
          </div>
        </li>`).join('')}</ul>`
    : `<p class="empty">${escapeHtml(t('res.none'))}</p>`;

  container.querySelector('#del-res-admin').addEventListener('click', async () => {
    const boxes = [...container.querySelectorAll('input[data-del-admin]:checked')];
    if (!boxes.length) return show(t('del.none'));
    if (!window.confirm(t('del.delete_confirm'))) return;
    const { error: delError } = await supabase.rpc('delete_reservations_admin', { p_ids: boxes.map((b) => b.dataset.delAdmin) });
    if (delError) return show(translateError(delError));
    boxes.forEach((b) => b.closest('li')?.remove());
    show(t('del.deleted'), 'success');
  });
}
