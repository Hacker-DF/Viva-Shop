/**
 * declare.js — Déclarer un paiement (route #/declarer?code=CODE).
 * Le client saisit les références lues sur son reçu. Rien n'est confirmé ici.
 */
import { escapeHtml, icon } from './ui.js';
import { supabase } from './supabase.js';
import { APP_CONFIG } from './config.js';
import { t } from './i18n.js';
import { getProductByCode, listTiers, unitPriceFor, formatFcfa } from './products.js';
import { getSession, translateError } from './auth.js';
import { METHODS, channelFor, createDeclaration } from './payments.js';

/** Étapes et codes par opérateur, avec un exemple de reçu (exemples uniquement). */
const METHOD_GUIDE = {
  mixx_by_yas: {
    ussd: '*145*1#', ussdHref: 'tel:*145*1%23',
    get steps() { return t('mg.mixx.steps'); },
    get receipt() { return t('mg.mixx.receipt'); },
  },
  flooz: {
    ussd: '*155*1*1#', ussdHref: 'tel:*155*1*1%23',
    get steps() { return t('mg.flooz.steps'); },
    get receipt() { return t('mg.flooz.receipt'); },
  },
};

export async function render(container) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const code = params.get('code') || '';

  if (!(await getSession())) {
    container.innerHTML = `<div class="alert alert-warn">${t('decl.login')}</div><a class="btn btn-primary" href="#/connexion">${t('auth.submit.login')}</a>`;
    return;
  }
  const p = code ? await getProductByCode(code) : null;
  if (!p) {
    container.innerHTML = `<div class="alert alert-warn">${t('decl.notfound')}</div>`;
    return;
  }
  if (p.status !== 'collecte_ouverte') {
    container.innerHTML = `<div class="alert alert-info">${t('decl.notopen')}</div>
      <a class="back" href="#/produit/${encodeURIComponent(p.code)}">${t('decl.backprod')}</a>`;
    return;
  }

  const tiers = await listTiers(p.id);
  const basePrice = p.promo_price ?? p.price_ht;
  const methodOptions = Object.entries(METHODS)
    .map(([key, m]) => `<option value="${key}">${escapeHtml(m.label)}</option>`).join('');

  container.innerHTML = `
    <a class="back" href="#/produit/${encodeURIComponent(p.code)}">${escapeHtml(t('decl.back'))}</a>
    <h1>${escapeHtml(t('decl.title'))}</h1>
    <p class="hint">${escapeHtml(t('decl.note'))}</p>

    <form id="declare" class="card admin-form" novalidate>
      <label>${t('decl.code')}<input value="${escapeHtml(p.code)}" readonly></label>
      <label>${escapeHtml(t('decl.product'))}<input value="${escapeHtml(p.name)}" readonly></label>
      <label>${escapeHtml(t('decl.variant'))}<input name="variant" maxlength="60"></label>
      <label>${escapeHtml(t('decl.qty'))}<input name="quantity" type="number" min="1" step="1" value="1" required></label>
      <p class="hint" id="expected"></p>
      <label>${escapeHtml(t('decl.payer'))}<input name="payer_name" required maxlength="100" placeholder="${t('ph.payer')}"></label>
      <label>${escapeHtml(t('decl.phone'))}<input name="payer_phone" type="tel" placeholder="${t('ph.phone')}"></label>
      <label>${escapeHtml(t('decl.amount'))}<input name="amount" type="number" min="1" step="1" required placeholder="${t('ph.amount')}"></label>
      <label>${escapeHtml(t('decl.method'))}
        <select name="method" required><option value="">${escapeHtml(t('decl.choose'))}</option>${methodOptions}</select>
      </label>
      <div id="instructions" class="alert alert-info" hidden></div>
      <label>${escapeHtml(t('decl.txn'))}<input name="txn" maxlength="60" placeholder="${t('ph.txn')}"></label>
      <p class="hint">${escapeHtml(t('decl.ref.hint'))}</p>
      <label>${escapeHtml(t('decl.proof'))}
        <input name="proof" type="file" accept="image/jpeg,image/png,image/webp">
      </label>
      <label>${escapeHtml(t('decl.notes'))}<textarea name="notes" rows="2" maxlength="500"></textarea></label>
      <div class="alert alert-info">${escapeHtml(t('decl.help'))}
        ${APP_CONFIG.whatsapp.assistants.map((a) => `<a class="btn btn-ghost btn-small" href="https://wa.me/${a.phone.replace(/\D/g, '')}" target="_blank" rel="noopener">${escapeHtml(a.name)}</a>`).join(' ')}
      </div>
      <div id="form-error" class="alert alert-error" role="alert" hidden></div>
      <button class="btn btn-primary btn-block" type="submit">${escapeHtml(t('decl.submit'))}</button>
    </form>`;

  const form = container.querySelector('#declare');
  const expected = container.querySelector('#expected');
  const instructions = container.querySelector('#instructions');
  const errorBox = container.querySelector('#form-error');
  const submit = form.querySelector('button[type="submit"]');
  const fail = (text) => { errorBox.textContent = text; errorBox.hidden = false; };

  // Le montant suit la quantité, tant que le client ne l'a pas modifié lui-même
  let amountTouched = false;
  const updateExpected = () => {
    const qty = Math.max(1, Number(form.quantity.value) || 1);
    const unit = unitPriceFor(tiers, qty, basePrice);
    expected.textContent = `${t('decl.expected')} : ${formatFcfa(unit * qty)} (${qty} × ${formatFcfa(unit)})`;
    if (!amountTouched) form.amount.value = unit * qty;
    showInstructions();
  };

  // Numéro officiel et instructions selon le moyen choisi
  const showInstructions = () => {
    const method = form.method.value;
    if (!method) { instructions.hidden = true; return; }
    const ch = channelFor(method);
    const g = METHOD_GUIDE[method];
    const amount = Number(form.amount.value) || 0;
    instructions.innerHTML = ch
      ? `<strong>${escapeHtml(METHODS[method].label)}</strong><br>
         ${escapeHtml(t('decl.send_amount'))} <strong>${escapeHtml(formatFcfa(amount))}</strong> ${escapeHtml(t('decl.official_number'))} <strong>${escapeHtml(ch.number)}</strong>.<br>
         ${escapeHtml(t('decl.beneficiary'))} : <strong>${escapeHtml(ch.beneficiary || t('decl.tbc'))}</strong><br>
         <button type="button" class="btn btn-ghost btn-small" id="copy-number">${escapeHtml(t('decl.copy'))}</button>
         <p>${escapeHtml(t('decl.transfer_note'))}</p>
         ${g ? `<p><a class="btn btn-gold btn-small" href="${g.ussdHref}">${escapeHtml(t('decl.dial'))} ${escapeHtml(g.ussd)}</a></p><p>${escapeHtml(g.steps)}</p><p class="hint">${escapeHtml(g.receipt)}</p>` : ''}`
      : `<strong>${escapeHtml(t('decl.bank'))}</strong><br>
         ${escapeHtml(t('decl.bank_note'))}`;
    instructions.hidden = false;
    const copyBtn = instructions.querySelector('#copy-number');
    copyBtn?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(ch.number); copyBtn.textContent = t('decl.copied'); }
      catch { copyBtn.textContent = t('decl.copy_fail'); }
    });
  };

  form.quantity.addEventListener('input', updateExpected);
  form.amount.addEventListener('input', () => { amountTouched = true; showInstructions(); });
  form.method.addEventListener('change', showInstructions);
  updateExpected();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    const fd = new FormData(form);
    const payerName = String(fd.get('payer_name')).trim();
    const quantity = Number(fd.get('quantity'));
    const amount = Number(fd.get('amount'));
    const ref = '';
    const txn = String(fd.get('txn')).trim();

    if (payerName.length < 2) return fail(t('decl.name_err'));
    if (!Number.isInteger(quantity) || quantity < 1) return fail(t('decl.qty_err'));
    if (!Number.isInteger(amount) || amount <= 0) return fail(t('decl.amount_err'));
    if (!fd.get('method')) return fail(t('decl.method_err'));
    if (!txn) return fail(t('decl.txn_err'));

    submit.disabled = true;
    try {
      // Capture d'écran : rangée dans un dossier privé à l'identifiant du client
      const proof = fd.get('proof');
      let proofPath = null;
      if (proof && proof.size > 0) {
        if (proof.size > 5 * 1024 * 1024) throw new Error(t('decl.proof_big'));
        const ext = (proof.name.split('.').pop() || 'jpg').toLowerCase();
        proofPath = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upError } = await supabase.storage.from('justificatifs')
          .upload(proofPath, proof, { contentType: proof.type, upsert: false });
        if (upError) throw upError;
      }
      const row = await createDeclaration({
        productId: p.id,
        variant: String(fd.get('variant')).trim(),
        quantity,
        payerName,
        payerPhone: String(fd.get('payer_phone')).trim(),
        amount,
        method: String(fd.get('method')),
        ref,
        txn,
        notes: String(fd.get('notes')).trim(),
        proofPath,
      });
      container.innerHTML = `
        <section class="card placeholder">
          <div class="placeholder-icon">${icon('check')}</div>
          <h1>${escapeHtml(t('decl.done_title'))}</h1>
          <p>${escapeHtml(t('decl.done_order'))} <strong>${escapeHtml(row.order_number)}</strong>.</p>
          <p>${escapeHtml(t('decl.done_check'))}</p>
          <a class="btn btn-primary" href="#/commandes">${escapeHtml(t('decl.done_link'))}</a>
        </section>`;
    } catch (err) {
      const text = err.message?.includes('row-level')
        ? t('decl.closed_err')
        : translateError(err);
      fail(text);
    } finally {
      submit.disabled = false;
    }
  });
}
