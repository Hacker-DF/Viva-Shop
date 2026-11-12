/**
 * commandes.js — Mes paiements (déclarations, pro forma, envoi WhatsApp) et mes réservations.
 */
import { escapeHtml, icon } from './ui.js';
import { listMyReservations, formatFcfa } from './products.js';
import { listMyDeclarations, markWhatsappSent, PAYMENT_STATUS, METHODS } from './payments.js';
import { getSession, getProfile, translateError } from './auth.js';
import { supabase } from './supabase.js';
import { downloadProForma } from './pdf.js';
import { myShipmentsHtml } from './logistics-admin.js';
import { APP_CONFIG } from './config.js';
import { t } from './i18n.js';

const waLink = (phone, text) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

/** Message pré-rempli selon le format du cahier des charges. */
/** Nom affiché d'un client : « Prénom Nom (@identifiant) ». */
function ownerName(o) {
  return o ? `${o.first_name || ''} ${o.last_name || ''} (@${o.username || ''})` : t('author.missing');
}

function whatsappText(d, owner) {
  return [
    'Bonjour, je vous transmets mon document concernant ma commande sur Viva Shop.',
    `Client : ${ownerName(owner)}.`,
    `Numéro de commande : ${d.order_number}.`,
    `Code produit : ${d.products?.code || ''}.`,
    `Montant déclaré : ${formatFcfa(d.amount)}.`,
    'Veuillez vérifier ma déclaration, s\'il vous plaît.',
  ].join('\n');
}

export async function render(container) {
  window.__ordersView = container;
  const session = await getSession();
  if (!session) {
    container.innerHTML = `
      <section class="card placeholder">
        <div class="placeholder-icon">${icon('package')}</div>
        <h1>${escapeHtml(t('orders.title'))}</h1>
        <p>${escapeHtml(t('orders.guest'))}</p>
        <a class="btn btn-primary" href="#/connexion">${escapeHtml(t('auth.submit.login'))}</a>
      </section>`;
    return;
  }

  const [payments, reservations, profile] = await Promise.all([
    listMyDeclarations(), listMyReservations(), getProfile(),
  ]);
  const byId = Object.fromEntries(payments.map((d) => [d.id, d]));
  const shipmentsHtml = await myShipmentsHtml();

  container.innerHTML = `
    <h1>${escapeHtml(t('pay.title'))}</h1>
    <p class="hint">${escapeHtml(t('pay.note'))}</p>
    <div id="pay-msg" class="alert" role="status" hidden></div>
    ${payments.some((x) => x.user_id !== session.user.id) ? `<div class="admin-toolbar"><button id="hide-selected-pay" class="btn btn-ghost btn-small" type="button">${escapeHtml(t('del.hide_selected'))}</button></div>` : ''}
    ${payments.length ? `
      <ul class="admin-list" id="payments">
        ${payments.map((d) => {
          const st = PAYMENT_STATUS[d.status] || PAYMENT_STATUS.en_attente_verification;
          const owner = d.profiles || profile;
          // Vue équipe : dès qu'on voit les commandes d'autres clients, chaque ligne affiche le client
          const staffView = payments.some((x) => x.user_id !== session.user.id);
          return `
          <li class="admin-row">
            ${(d.status === 'declaration_rejetee' && payments.some((x) => x.user_id !== session.user.id)) ? `<label class="check-line sel"><input type="checkbox" data-hide-id="${d.id}"> ${escapeHtml(t('del.select'))}</label>` : ''}
            <div class="admin-row-main">
              <strong>${escapeHtml(d.products?.name || t('orders.product'))}</strong>
              <span class="product-code">${escapeHtml(d.order_number)} · ${escapeHtml(d.products?.code || '')} · ${escapeHtml(formatFcfa(d.amount))} · ${escapeHtml(METHODS[d.payment_method]?.label || '')}</span>
              <span class="status-badge" style="--c: ${st.color}">${escapeHtml(st.label)}</span>
              ${staffView ? `<span class="author-line"><strong>${escapeHtml(t('author.label'))} :</strong> ${escapeHtml(ownerName(d.profiles))}</span>` : ''}
              ${d.whatsapp_sent_at ? `<span class="product-code">${escapeHtml(t('pay.sent.badge'))}</span>` : ''}
            </div>
            <div class="admin-actions wrap">
              <button class="btn btn-ghost btn-small" type="button" data-action="proforma" data-id="${d.id}">${escapeHtml(t('pay.proforma'))}</button>
              ${APP_CONFIG.whatsapp.assistants.map((a) => `
                <a class="btn btn-primary btn-small" href="${waLink(a.phone, whatsappText(d, owner))}" target="_blank" rel="noopener">${escapeHtml(a.name)} (WhatsApp)</a>`).join('')}
              ${d.whatsapp_sent_at ? '' : `<button class="btn btn-ghost btn-small" type="button" data-action="sent" data-id="${d.id}">${escapeHtml(t('pay.sent'))}</button>`}
            </div>
          </li>`;
        }).join('')}
      </ul>
      <p class="hint">${escapeHtml(t('orders.send_hint'))}</p>`
      : `<p class="empty">${escapeHtml(t('pay.none'))}</p>`}

    ${shipmentsHtml}
    <h2 class="section-title">${escapeHtml(t('res.title'))}</h2>
    <p class="hint">${escapeHtml(t('res.note'))}</p>
    ${reservations.length ? `
      <div class="admin-toolbar"><button id="delete-selected-res" class="btn btn-ghost btn-small" type="button">${escapeHtml(t('del.delete_selected'))}</button></div>
      <ul class="admin-list" id="reservations">
        ${reservations.map((r) => `
          <li class="admin-row">
            ${(r.status === 'annulee' || r.products?.status === 'commande_cloturee') ? `<label class="check-line sel"><input type="checkbox" data-del-res="${r.id}"> ${escapeHtml(t('del.select'))}</label>` : ''}
            <div class="admin-row-main">
              <strong>${escapeHtml(r.products?.name || t('orders.product'))}</strong>
              <span class="product-code">${escapeHtml(t('orders.code'))} ${escapeHtml(r.products?.code || '')} · ${escapeHtml(t('orders.qty'))} ${r.quantity}${r.variant ? ' · ' + escapeHtml(r.variant) : ''}</span>
            </div>
            <span class="status-badge" style="--c: ${r.status === 'annulee' ? 'var(--status-grey)' : 'var(--electric)'}">${escapeHtml(r.status === 'annulee' ? t('res.status_cancelled') : t('res.status_active'))}</span>
            ${r.status === 'enregistree' ? `<button class="btn btn-ghost btn-small" type="button" data-cancel="${r.id}">${escapeHtml(t('res.cancel'))}</button>` : ''}
            ${(r.status === 'annulee' || r.products?.status === 'commande_cloturee') ? `<button class="btn btn-ghost btn-small" type="button" data-hide="${r.id}">${escapeHtml(t('res.hide'))}</button>` : ''}
          </li>`).join('')}
      </ul>` : `<p class="empty">${escapeHtml(t('res.none'))}</p>`}`;

  const msg = container.querySelector('#pay-msg');
  const say = (text, type) => { msg.className = `alert alert-${type}`; msg.textContent = text; msg.hidden = false; };

  container.querySelector('#reservations')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-cancel]');
    if (!btn) return;
    if (!window.confirm(t('res.cancel_confirm'))) return;
    btn.disabled = true;
    const { error: cancelError } = await supabase.rpc('cancel_reservation', { p_id: btn.dataset.cancel });
    if (cancelError) { btn.disabled = false; say(translateError(cancelError), 'error'); return; }
    const row = btn.closest('li');
    const badge = row.querySelector('.status-badge');
    badge.textContent = t('res.status_cancelled');
    badge.style.setProperty('--c', 'var(--status-grey)');
    btn.remove();
    say(t('res.cancelled'), 'success');
  });

  container.querySelector('#reservations')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-hide]');
    if (!btn) return;
    if (!window.confirm(t('res.hide_confirm'))) return;
    btn.disabled = true;
    const { error: hideError } = await supabase.rpc('hide_reservation', { p_id: btn.dataset.hide });
    if (hideError) { btn.disabled = false; say(translateError(hideError), 'error'); return; }
    btn.closest('li').remove();
    say(t('res.hidden'), 'success');
  });

  container.querySelector('#hide-selected-pay')?.addEventListener('click', async () => {
    const boxes = [...container.querySelectorAll('input[data-hide-id]:checked')];
    if (!boxes.length) return say(t('del.none'), 'error');
    if (!window.confirm(t('del.hide_confirm'))) return;
    const { error: hideError } = await supabase.rpc('hide_rejected_payments', { p_ids: boxes.map((b) => b.dataset.hideId) });
    if (hideError) return say(translateError(hideError), 'error');
    boxes.forEach((b) => b.closest('li')?.remove());
    say(t('del.deleted'), 'success');
  });

  container.querySelector('#delete-selected-res')?.addEventListener('click', async () => {
    const boxes = [...container.querySelectorAll('input[data-del-res]:checked')];
    if (!boxes.length) return say(t('del.none'), 'error');
    if (!window.confirm(t('del.delete_confirm'))) return;
    const { error: delError } = await supabase.rpc('delete_my_reservations', { p_ids: boxes.map((b) => b.dataset.delRes) });
    if (delError) return say(translateError(delError), 'error');
    boxes.forEach((b) => b.closest('li')?.remove());
    say(t('res.deleted'), 'success');
  });

  container.querySelector('#payments')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const decl = byId[btn.dataset.id];
    try {
      if (btn.dataset.action === 'proforma') {
        say(t('orders.prep'), 'info');
        await downloadProForma(decl, decl.profiles || profile);
        say(t('orders.proforma_done'), 'success');
      } else if (btn.dataset.action === 'sent') {
        await markWhatsappSent(decl.id);
        render(container);
      }
    } catch (err) {
      say(translateError(err), 'error');
    }
  });
}

// Rafraîchissement : les changements de statut apparaissent sans recharger la page
window.__ordersView = window.__ordersView || null;
if (!window.__ordersTimer) {
  window.__ordersTimer = setInterval(() => {
    const view = window.__ordersView;
    if (!view || !view.isConnected || document.visibilityState !== 'visible') return;
    if (!location.hash.startsWith('#/commandes')) return;
    render(view);
  }, 60000);
  document.addEventListener('visibilitychange', () => {
    const view = window.__ordersView;
    if (document.visibilityState === 'visible' && view && view.isConnected && location.hash.startsWith('#/commandes')) render(view);
  });
}
