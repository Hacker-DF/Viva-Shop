/**
 * payments-admin.js — Vérification des paiements par l'équipe financière.
 * Chaque changement de statut passe par la fonction serveur set_payment_status (droit vérifié et journalisé).
 */
import { escapeHtml } from './ui.js';
import { supabase } from './supabase.js';
import { getSession, getRoleCodes, translateError } from './auth.js';
import { PAYMENT_STATUS, METHODS } from './payments.js';
import { formatFcfa } from './products.js';
import { t } from './i18n.js';

const FINANCE_ROLES = ['administrateur_principal', 'agent_financier'];

/** Actions proposées selon le statut. needsNote : une raison écrite est obligatoire. */
const ACTIONS = [
  { status: 'en_cours_verification', get label() { return t('pay.act.start'); }, cls: 'btn-ghost' },
  { status: 'paiement_confirme', get label() { return t('pay.act.confirm'); }, cls: 'btn-primary' },
  { status: 'montant_incorrect', get label() { return t('pay.act.amount_wrong'); }, cls: 'btn-ghost', needsNote: true },
  { status: 'transaction_introuvable', get label() { return t('pay.act.not_found'); }, cls: 'btn-ghost', needsNote: true },
  { status: 'declaration_rejetee', get label() { return t('pay.act.reject'); }, cls: 'btn-ghost', needsNote: true },
  { status: 'rembourse', get label() { return t('pay.act.refund'); }, cls: 'btn-ghost', needsNote: true, onlyIfConfirmed: true },
];

/** Message à afficher après le rechargement de la page. */
let pending = null;

export async function render(container) {
  const note = pending;
  pending = null;

  const session = await getSession();
  if (!session) {
    container.innerHTML = `<div class="alert alert-warn">${t('common.login_required')}</div>`;
    return;
  }
  const codes = await getRoleCodes();
  if (!codes.some((c) => FINANCE_ROLES.includes(c))) {
    container.innerHTML = `<div class="alert alert-error">${t('pay.restricted')}</div>`;
    return;
  }

  const { data, error } = await supabase.from('payment_declarations')
    .select('id, order_number, amount, payer_name, payer_phone, payment_method, ref_code, txn_id, status, verification_note, proof_path, products(code, name), profiles(first_name, last_name, username, phone, city)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  container.innerHTML = `
    <div class="admin-toolbar">
      <h1>${t('pay.title')}</h1>
    </div>
    <p class="alert alert-info">${t('pay.intro')}</p>
    <div id="pay-msg" class="alert" role="status" hidden></div>
    <ul class="admin-list" id="pay-list">
      ${data.map(card).join('') || `<li class="empty">${t('pay.empty')}</li>`}
    </ul>`;

  const msg = container.querySelector('#pay-msg');
  const say = (text, type) => { msg.className = `alert alert-${type}`; msg.textContent = text; msg.hidden = false; };
  if (note) say(note.text, note.type);

  container.querySelector('#pay-list').addEventListener('click', async (e) => {
    const proofBtn = e.target.closest('button[data-proof]');
    if (proofBtn) {
      const { data: signed, error: signError } = await supabase.storage.from('justificatifs')
        .createSignedUrl(proofBtn.dataset.proof, 300);
      if (signError) { say(translateError(signError), 'error'); return; }
      window.open(signed.signedUrl, '_blank', 'noopener');
      return;
    }
    const btn = e.target.closest('button[data-status]');
    if (!btn) return;

    let reason = null;
    if (btn.dataset.needsNote === '1') {
      reason = window.prompt(t('pay.reason_prompt'));
      if (!reason || !reason.trim()) return;
    }

    let paymentDate = null;
    if (btn.dataset.status === 'paiement_confirme') {
      const typed = window.prompt(t('pay.date_prompt'), new Date().toLocaleDateString('fr-FR'));
      if (!typed) return;
      const m = typed.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!m) { say(t('pay.date_format'), 'error'); return; }
      paymentDate = `${m[3]}-${m[2]}-${m[1]}`;
    }

    const { error: rpcError } = await supabase.rpc('set_payment_status', {
      p_id: btn.dataset.id, p_status: btn.dataset.status, p_note: reason ? reason.trim() : null, p_payment_date: paymentDate,
    });
    if (rpcError) { say(translateError(rpcError), 'error'); return; }

    pending = { text: t('pay.updated'), type: 'success' };
    render(container);
  });
}

function card(d) {
  const st = PAYMENT_STATUS[d.status] || PAYMENT_STATUS.en_attente_verification;
  const author = d.profiles
    ? `${d.profiles.first_name} ${d.profiles.last_name} (@${d.profiles.username})${d.profiles.phone ? ' · ' + d.profiles.phone : ''}${d.profiles.city ? ' · ' + d.profiles.city : ''}`
    : t('author.missing');
  const actions = ACTIONS.filter((a) => a.status !== d.status && (!a.onlyIfConfirmed || d.status === 'paiement_confirme')).map((a) => `
    <button class="btn ${a.cls} btn-small" type="button" data-id="${d.id}" data-status="${a.status}"
            ${a.needsNote ? 'data-needs-note="1"' : ''}>${escapeHtml(a.label)}</button>`).join('');

  return `
    <li class="admin-row">
      <div class="admin-row-main">
        <strong>${escapeHtml(d.order_number)} · ${escapeHtml(d.products?.name || '')}</strong>
        <span class="author-line"><strong>${escapeHtml(t('author.label'))} :</strong> ${escapeHtml(author)}</span>
        <span class="product-code">${t('pay.payer')} : ${escapeHtml(d.payer_name)}${d.payer_phone ? ' · ' + escapeHtml(d.payer_phone) : ''}</span>
        <span class="product-code">${escapeHtml(formatFcfa(d.amount))} · ${escapeHtml(METHODS[d.payment_method]?.label || '')}</span>
        <span class="product-code">REF : ${escapeHtml(d.ref_code || '-')} · TXN : ${escapeHtml(d.txn_id || '-')}</span>
        <span class="status-badge" style="--c: ${st.color}">${escapeHtml(st.label)}</span>
        ${d.verification_note ? `<span class="product-code">${t('pay.note')} : ${escapeHtml(d.verification_note)}</span>` : ''}
      </div>
      <div class="admin-actions wrap">${d.proof_path ? `<button class="btn btn-ghost btn-small" type="button" data-proof="${escapeHtml(d.proof_path)}">${t('pay.see_proof')}</button>` : `<span class="product-code">${t('pay.no_proof')}</span>`}${actions}</div>
    </li>`;
}
