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
    steps: 'Composez le code, faites continuer, puis choisissez « Ajouter les frais ».',
    receipt: 'Exemple de reçu : « Ref: 20502637277 ». Recopiez la référence après « Ref: ».',
  },
  flooz: {
    ussd: '*155*1*1#', ussdHref: 'tel:*155*1*1%23',
    steps: 'Composez le code, puis faites continuer.',
    receipt: 'Exemple de reçu : « Txn ID: 040928984627 ». Recopiez l’identifiant après « Txn ID: ».',
  },
};

export async function render(container) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const code = params.get('code') || '';

  if (!(await getSession())) {
    container.innerHTML = '<div class="alert alert-warn">Connectez-vous pour déclarer un paiement.</div><a class="btn btn-primary" href="#/connexion">Se connecter</a>';
    return;
  }
  const p = code ? await getProductByCode(code) : null;
  if (!p) {
    container.innerHTML = '<div class="alert alert-warn">Produit introuvable. Ouvrez la fiche du produit puis « Payer et déclarer ».</div>';
    return;
  }
  if (p.status !== 'collecte_ouverte') {
    container.innerHTML = `<div class="alert alert-info">La collecte de ce produit n’est pas ouverte : le paiement n’est pas possible pour le moment.</div>
      <a class="back" href="#/produit/${encodeURIComponent(p.code)}">← Retour au produit</a>`;
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
      <label>Code produit<input value="${escapeHtml(p.code)}" readonly></label>
      <label>${escapeHtml(t('decl.product'))}<input value="${escapeHtml(p.name)}" readonly></label>
      <label>${escapeHtml(t('decl.variant'))}<input name="variant" maxlength="60"></label>
      <label>${escapeHtml(t('decl.qty'))}<input name="quantity" type="number" min="1" step="1" value="1" required></label>
      <p class="hint" id="expected"></p>
      <label>${escapeHtml(t('decl.payer'))}<input name="payer_name" required maxlength="100" placeholder="Exemple : KOFFI Jean"></label>
      <label>${escapeHtml(t('decl.phone'))}<input name="payer_phone" type="tel" placeholder="Exemple : +228 90 00 00 00"></label>
      <label>${escapeHtml(t('decl.amount'))}<input name="amount" type="number" min="1" step="1" required placeholder="Exemple : 25000"></label>
      <label>${escapeHtml(t('decl.method'))}
        <select name="method" required><option value="">${escapeHtml(t('decl.choose'))}</option>${methodOptions}</select>
      </label>
      <div id="instructions" class="alert alert-info" hidden></div>
      <label>${escapeHtml(t('decl.txn'))}<input name="txn" maxlength="60" placeholder="Exemple : 040928984627"></label>
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
    expected.textContent = `Montant attendu : ${formatFcfa(unit * qty)} (${qty} × ${formatFcfa(unit)})`;
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
         Envoyez <strong>${escapeHtml(formatFcfa(amount))}</strong> au numéro officiel <strong>${escapeHtml(ch.number)}</strong>.<br>
         Bénéficiaire : <strong>${escapeHtml(ch.beneficiary || 'à confirmer')}</strong><br>
         <button type="button" class="btn btn-ghost btn-small" id="copy-number">Copier le numéro</button>
         <p>Faites le transfert depuis votre application Mobile Money, puis revenez ici pour le déclarer.</p>
         ${g ? `<p><a class="btn btn-gold btn-small" href="${g.ussdHref}">Composer ${escapeHtml(g.ussd)}</a></p><p>${escapeHtml(g.steps)}</p><p class="hint">${escapeHtml(g.receipt)}</p>` : ''}`
      : `<strong>Virement bancaire</strong><br>
         Demandez les coordonnées bancaires à un assistant sur WhatsApp. Elles ne sont pas publiées ici.`;
    instructions.hidden = false;
    const copyBtn = instructions.querySelector('#copy-number');
    copyBtn?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(ch.number); copyBtn.textContent = 'Numéro copié ✓'; }
      catch { copyBtn.textContent = 'Copie impossible : notez le numéro'; }
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

    if (payerName.length < 2) return fail('Indiquez le nom du payeur.');
    if (!Number.isInteger(quantity) || quantity < 1) return fail('Quantité invalide.');
    if (!Number.isInteger(amount) || amount <= 0) return fail('Montant invalide.');
    if (!fd.get('method')) return fail('Choisissez un moyen de paiement.');
    if (!txn) return fail('Renseignez la référence de la transaction.');

    submit.disabled = true;
    try {
      // Capture d'écran : rangée dans un dossier privé à l'identifiant du client
      const proof = fd.get('proof');
      let proofPath = null;
      if (proof && proof.size > 0) {
        if (proof.size > 5 * 1024 * 1024) throw new Error('Capture trop lourde (5 Mo maximum).');
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
          <h1>Déclaration enregistrée</h1>
          <p>Votre numéro de commande est <strong>${escapeHtml(row.order_number)}</strong>.</p>
          <p>Notre équipe vérifie votre paiement. Il n’est confirmé qu’après cette vérification.</p>
          <a class="btn btn-primary" href="#/commandes">Voir mes paiements</a>
        </section>`;
    } catch (err) {
      const text = err.message?.includes('row-level')
        ? 'Déclaration impossible : la collecte de ce produit n’est plus ouverte.'
        : translateError(err);
      fail(text);
    } finally {
      submit.disabled = false;
    }
  });
}
