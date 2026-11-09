/**
 * declare.js — Déclarer un paiement (route #/declarer?code=CODE).
 * Le client saisit les références lues sur son reçu. Rien n'est confirmé ici.
 */
import { escapeHtml, icon } from './ui.js';
import { getProductByCode, listTiers, unitPriceFor, formatFcfa } from './products.js';
import { getSession, translateError } from './auth.js';
import { METHODS, channelFor, createDeclaration } from './payments.js';

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
    <a class="back" href="#/produit/${encodeURIComponent(p.code)}">← Produit</a>
    <h1>Déclarer un paiement</h1>
    <p class="hint">Déclarer un paiement ne le confirme pas : notre équipe vérifie chaque transaction avant validation.</p>

    <form id="declare" class="card admin-form" novalidate>
      <label>Code produit<input value="${escapeHtml(p.code)}" readonly></label>
      <label>Produit<input value="${escapeHtml(p.name)}" readonly></label>
      <label>Variante ou capacité (facultatif)<input name="variant" maxlength="60"></label>
      <label>Quantité<input name="quantity" type="number" min="1" step="1" value="1" required></label>
      <p class="hint" id="expected"></p>
      <label>Nom du payeur<input name="payer_name" required maxlength="100" placeholder="Exemple : KOFFI Jean"></label>
      <label>Téléphone utilisé (facultatif)<input name="payer_phone" type="tel" placeholder="Exemple : +228 90 00 00 00"></label>
      <label>Montant envoyé (FCFA)<input name="amount" type="number" min="1" step="1" required placeholder="Exemple : 25000"></label>
      <label>Moyen de paiement
        <select name="method" required><option value="">Choisir…</option>${methodOptions}</select>
      </label>
      <div id="instructions" class="alert alert-info" hidden></div>
      <label>Référence REF (sur le reçu)<input name="ref" maxlength="60" placeholder="Exemple : REF-123456789"></label>
      <label>Identifiant TXN (sur le reçu)<input name="txn" maxlength="60" placeholder="Exemple : TXN-987654321"></label>
      <p class="hint">Renseignez au moins une référence, sans inventer celle que vous n’avez pas. Le justificatif (capture du reçu) sera ajouté dans une prochaine mise à jour.</p>
      <label>Informations complémentaires (facultatif)<textarea name="notes" rows="2" maxlength="500"></textarea></label>
      <div id="form-error" class="alert alert-error" role="alert" hidden></div>
      <button class="btn btn-primary btn-block" type="submit">Envoyer ma déclaration</button>
    </form>`;

  const form = container.querySelector('#declare');
  const expected = container.querySelector('#expected');
  const instructions = container.querySelector('#instructions');
  const errorBox = container.querySelector('#form-error');
  const submit = form.querySelector('button[type="submit"]');
  const fail = (text) => { errorBox.textContent = text; errorBox.hidden = false; };

  // Montant attendu selon la quantité et les tarifs dégressifs
  const updateExpected = () => {
    const qty = Math.max(1, Number(form.quantity.value) || 1);
    const unit = unitPriceFor(tiers, qty, basePrice);
    expected.textContent = `Montant attendu : ${formatFcfa(unit * qty)} (${qty} × ${formatFcfa(unit)})`;
    if (!form.amount.value) form.amount.value = unit * qty;
    showInstructions();
  };

  // Numéro officiel et instructions selon le moyen choisi
  const showInstructions = () => {
    const method = form.method.value;
    if (!method) { instructions.hidden = true; return; }
    const ch = channelFor(method);
    const amount = Number(form.amount.value) || 0;
    instructions.innerHTML = ch
      ? `<strong>${escapeHtml(METHODS[method].label)}</strong><br>
         Envoyez <strong>${escapeHtml(formatFcfa(amount))}</strong> au numéro officiel <strong>${escapeHtml(ch.number)}</strong>.<br>
         Bénéficiaire : <strong>${escapeHtml(ch.beneficiary || 'à confirmer')}</strong><br>
         <button type="button" class="btn btn-ghost btn-small" id="copy-number">Copier le numéro</button>
         <p>Faites le transfert depuis votre application Mobile Money, puis revenez ici pour le déclarer.</p>`
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
  form.amount.addEventListener('input', showInstructions);
  form.method.addEventListener('change', showInstructions);
  updateExpected();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    const fd = new FormData(form);
    const payerName = String(fd.get('payer_name')).trim();
    const quantity = Number(fd.get('quantity'));
    const amount = Number(fd.get('amount'));
    const ref = String(fd.get('ref')).trim();
    const txn = String(fd.get('txn')).trim();

    if (payerName.length < 2) return fail('Indiquez le nom du payeur.');
    if (!Number.isInteger(quantity) || quantity < 1) return fail('Quantité invalide.');
    if (!Number.isInteger(amount) || amount <= 0) return fail('Montant invalide.');
    if (!fd.get('method')) return fail('Choisissez un moyen de paiement.');
    if (!ref && !txn) return fail('Renseignez au moins une référence : REF ou TXN.');

    submit.disabled = true;
    try {
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
