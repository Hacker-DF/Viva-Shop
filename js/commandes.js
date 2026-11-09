/**
 * commandes.js — Mes paiements (déclarations, pro forma, envoi WhatsApp) et mes réservations.
 */
import { escapeHtml, icon } from './ui.js';
import { listMyReservations, formatFcfa } from './products.js';
import { listMyDeclarations, markWhatsappSent, PAYMENT_STATUS, METHODS } from './payments.js';
import { getSession, getProfile, translateError } from './auth.js';
import { downloadProForma } from './pdf.js';
import { APP_CONFIG } from './config.js';

const waLink = (phone, text) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

/** Message pré-rempli selon le format du cahier des charges. */
function whatsappText(d) {
  return [
    'Bonjour, je vous transmets mon document concernant ma commande sur Viva Shop.',
    `Numéro de commande : ${d.order_number}.`,
    `Code produit : ${d.products?.code || ''}.`,
    `Montant déclaré : ${formatFcfa(d.amount)}.`,
    'Veuillez vérifier ma déclaration, s\'il vous plaît.',
  ].join('\n');
}

export async function render(container) {
  if (!(await getSession())) {
    container.innerHTML = `
      <section class="card placeholder">
        <div class="placeholder-icon">${icon('package')}</div>
        <h1>Mes commandes</h1>
        <p>Connectez-vous pour consulter vos paiements et vos réservations.</p>
        <a class="btn btn-primary" href="#/connexion">Se connecter</a>
      </section>`;
    return;
  }

  const [payments, reservations, profile] = await Promise.all([
    listMyDeclarations(), listMyReservations(), getProfile(),
  ]);
  const byId = Object.fromEntries(payments.map((d) => [d.id, d]));

  container.innerHTML = `
    <h1>Mes paiements</h1>
    <p class="hint">Une déclaration n’est confirmée qu’après vérification par notre équipe.</p>
    <div id="pay-msg" class="alert" role="status" hidden></div>
    ${payments.length ? `
      <ul class="admin-list" id="payments">
        ${payments.map((d) => {
          const st = PAYMENT_STATUS[d.status] || PAYMENT_STATUS.en_attente_verification;
          return `
          <li class="admin-row">
            <div class="admin-row-main">
              <strong>${escapeHtml(d.products?.name || 'Produit')}</strong>
              <span class="product-code">${escapeHtml(d.order_number)} · ${escapeHtml(d.products?.code || '')} · ${escapeHtml(formatFcfa(d.amount))} · ${escapeHtml(METHODS[d.payment_method]?.label || '')}</span>
              <span class="status-badge" style="--c: ${st.color}">${escapeHtml(st.label)}</span>
              ${d.whatsapp_sent_at ? '<span class="product-code">Document transmis à un agent</span>' : ''}
            </div>
            <div class="admin-actions wrap">
              <button class="btn btn-ghost btn-small" type="button" data-action="proforma" data-id="${d.id}">Pro forma PDF</button>
              ${APP_CONFIG.whatsapp.assistants.map((a) => `
                <a class="btn btn-primary btn-small" href="${waLink(a.phone, whatsappText(d))}" target="_blank" rel="noopener">${escapeHtml(a.name)} (WhatsApp)</a>`).join('')}
              ${d.whatsapp_sent_at ? '' : `<button class="btn btn-ghost btn-small" type="button" data-action="sent" data-id="${d.id}">J’ai envoyé mon document</button>`}
            </div>
          </li>`;
        }).join('')}
      </ul>
      <p class="hint">Pour envoyer le PDF : téléchargez le pro forma, ouvrez WhatsApp avec le bouton de l’assistant, puis joignez le PDF manuellement. WhatsApp ne peut pas joindre le fichier automatiquement.</p>`
      : '<p class="empty">Aucun paiement déclaré pour le moment.</p>'}

    <h2 class="section-title">Mes réservations</h2>
    <p class="hint">Une réservation n’est pas un paiement.</p>
    ${reservations.length ? `
      <ul class="admin-list">
        ${reservations.map((r) => `
          <li class="admin-row">
            <div class="admin-row-main">
              <strong>${escapeHtml(r.products?.name || 'Produit')}</strong>
              <span class="product-code">Code ${escapeHtml(r.products?.code || '')} · Quantité ${r.quantity}${r.variant ? ' · ' + escapeHtml(r.variant) : ''}</span>
            </div>
            <span class="status-badge" style="--c: var(--electric)">${r.status === 'annulee' ? 'Annulée' : 'Enregistrée'}</span>
          </li>`).join('')}
      </ul>` : '<p class="empty">Vous n’avez encore aucune réservation.</p>'}`;

  const msg = container.querySelector('#pay-msg');
  const say = (text, type) => { msg.className = `alert alert-${type}`; msg.textContent = text; msg.hidden = false; };

  container.querySelector('#payments')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const decl = byId[btn.dataset.id];
    try {
      if (btn.dataset.action === 'proforma') {
        say('Préparation du document…', 'info');
        await downloadProForma(decl, profile);
        say('Pro forma téléchargé.', 'success');
      } else if (btn.dataset.action === 'sent') {
        await markWhatsappSent(decl.id);
        render(container);
      }
    } catch (err) {
      say(translateError(err), 'error');
    }
  });
}
