/**
 * legal.js — Guide d'utilisation, politique de confidentialité et conditions générales.
 * Accessibles depuis « Mon compte » et le pied de page. Textes traduits via i18n.
 * ⚠️ La politique de confidentialité et les conditions sont des modèles : à faire valider avant publication.
 */
import { escapeHtml, icon } from './ui.js';
import { t } from './i18n.js';

/** Illustration SVG d'en-tête : globe, colis et trajectoire Chine → Togo. */
const HERO = `
  <svg class="legal-hero" viewBox="0 0 320 120" role="img" aria-label="Illustration Viva Shop">
    <rect width="320" height="120" rx="16" fill="#0B2545"/>
    <circle cx="262" cy="34" r="54" fill="none" stroke="#F2B705" stroke-width="2" opacity=".6"/>
    <circle cx="92" cy="60" r="36" fill="none" stroke="#1E6FD9" stroke-width="2"/>
    <path d="M56 60h72M92 24v72M64 36q28 12 56 0M64 84q28-12 56 0" fill="none" stroke="#1E6FD9" stroke-width="1.4" opacity=".6"/>
    <path d="M150 74 L190 60 L230 74" fill="none" stroke="#F2B705" stroke-width="2.5" stroke-dasharray="4 5" stroke-linecap="round"/>
    <rect x="236" y="66" width="46" height="36" rx="4" fill="#F2B705"/>
    <path d="M236 82h46" stroke="#0B2545" stroke-width="2"/>
  </svg>`;

const p = (text) => `<p>${escapeHtml(text)}</p>`;
const h2 = (text) => `<h2>${escapeHtml(text)}</h2>`;
const draftNotice = () => '<p class="alert alert-warn">Texte provisoire : à faire valider avant la mise en ligne définitive.</p>';

const GUIDE_STEPS = [
  { icon: 'user-plus', title: 'Créer votre compte', text: 'Inscrivez-vous avec un nom d’utilisateur, votre nom, votre téléphone WhatsApp et votre email. L’email sert à vous connecter.' },
  { icon: 'store', title: 'Consulter la boutique', text: 'Parcourez les catégories, ou cherchez un produit par son nom ou son code.' },
  { icon: 'tag', title: 'Comprendre les codes produits', text: 'Chaque produit a un code unique : 2 chiffres suivis de 6 lettres (exemple : 24ABCDEF). Copiez-le depuis la fiche. Il sert à retrouver le produit dans votre déclaration de paiement et dans vos demandes d’assistance.' },
  { icon: 'heart', title: 'Ajouter aux favoris', text: 'Depuis la fiche d’un produit, ajoutez-le à vos favoris pour le retrouver dans l’onglet Favoris.' },
  { icon: 'package', title: 'Réserver un produit', text: 'La réservation n’est possible que pour un produit « En attente ». Une réservation n’est pas un paiement.' },
  { icon: 'clock', title: 'Participer à une campagne', text: 'Lorsque la collecte est ouverte, le statut du produit passe à « Collecte ouverte » et la date limite de paiement s’affiche.' },
  { icon: 'credit-card', title: 'Payer et déclarer', text: 'Quand la collecte est ouverte, payez par Mixx by Yas ou Flooz vers le numéro officiel affiché, puis déclarez votre paiement avec votre référence REF ou TXN.' },
  { icon: 'file-text', title: 'Document pro forma', text: 'Téléchargez le PDF pro forma depuis Mes commandes. Une fois votre paiement validé, il porte le tampon de l’administration et la date de validation.' },
  { icon: 'message', title: 'Contacter un assistant', text: 'Depuis le menu, écrivez à l’un des deux assistants sur WhatsApp. Ils ont les mêmes fonctions.' },
  { icon: 'truck', title: 'Suivre votre colis', text: 'Dans Commandes, « Mes colis » affiche la couleur, l’étape en cours, la date d’arrivée prévue et l’historique. Retrouvez-le avec votre numéro de commande.' },
  { icon: 'bell', title: 'Notifications', text: 'La cloche en haut de l’écran vous prévient de chaque changement : paiement, réservation, étape du colis, ouverture d’une collecte.' },
  { icon: 'package', title: 'Demande spéciale', text: 'Vous ne trouvez pas un produit ? Décrivez-le, ajoutez une photo si vous en avez une. Notre équipe vous envoie un devis.' },
  { icon: 'message', title: 'Signaler un problème', text: 'Dans Mon compte, « Signaler un problème » envoie votre demande à l’équipe support. La réponse apparaît dans Mes demandes.' },
  { icon: 'user', title: 'Gérer votre profil', text: 'Dans Mon compte, modifiez vos informations de contact. Le nom d’utilisateur ne peut pas être modifié.' },
];

/** Étapes du guide dans la langue active (icône et ordre conservés). */
function guideSteps() {
  return GUIDE_STEPS.map((step, i) => ({
    icon: step.icon,
    title: t(`guide.s${i}.t`),
    text: t(`guide.s${i}.x`),
  }));
}

const DOCS = {
  guide: {
    get title() { return t('guide.title'); },
    html: () => `
      ${p(t('guide.intro'))}
      <ol class="guide-steps">
        ${guideSteps().map((s, i) => `
          <li class="guide-step">
            <span class="guide-icon">${icon(s.icon)}</span>
            <div><strong>${i + 1}. ${escapeHtml(s.title)}</strong><p>${escapeHtml(s.text)}</p></div>
          </li>`).join('')}
      </ol>`,
  },

  privacy: {
    get title() { return t('priv.title'); },
    html: () => `
      ${h2(t('priv.h1'))}
      ${p(t('priv.p1'))}
      ${h2(t('priv.h2'))}
      ${p(t('priv.p2'))}
      ${h2(t('priv.h3'))}
      ${p(t('priv.p3'))}
      ${h2(t('priv.h4'))}
      ${p(t('priv.p4'))}
      ${h2(t('priv.h5'))}
      ${p(t('priv.p5'))}
      ${h2(t('priv.h6'))}
      ${p(t('priv.p6'))}
      ${h2(t('priv.h7'))}
      ${p(t('priv.p7a'))}
      ${p(t('priv.p7b'))}
      ${p(t('priv.p7c'))}`,
  },

  terms: {
    get title() { return t('terms.title'); },
    html: () => `
      ${h2(t('terms.h_obj'))}
      ${p(t('terms.p_obj'))}
      ${h2(t('terms.h_pay'))}
      ${p(t('terms.p_pay'))}
      ${h2(t('terms.h_price'))}
      ${p(t('terms.p_price'))}
      ${h2(t('terms.h_refund'))}
      ${p(t('terms.p_refund'))}
      ${p(t('terms.p_refund2'))}
      ${h2(t('terms.h_deliv'))}
      ${p(t('terms.p_deliv'))}
      ${p(t('terms.p_deliv2'))}
      ${h2(t('terms.h_liab'))}
      ${p(t('terms.p_liab'))}
      ${h2(t('terms.h_disp'))}
      ${p(t('terms.p_disp'))}
      ${p(t('terms.p_disp2'))}`,
  },
};

export function render(container, { route }) {
  const doc = DOCS[route.view];
  if (!doc) {
    container.innerHTML = `<div class="alert alert-error">${t('legal.notfound')}</div>`;
    return;
  }
  container.innerHTML = `
    <a class="back" href="#/compte">${t('pf.back')}</a>
    <article class="legal card">
      ${HERO}
      <h1>${escapeHtml(doc.title)}</h1>
      ${doc.html()}
    </article>`;
}
