/**
 * legal.js — Guide d'utilisation, politique de confidentialité et conditions générales.
 * Accessibles depuis « Mon compte » et le pied de page. Textes en français.
 * ⚠️ La politique de confidentialité et les conditions sont des modèles : à faire valider avant publication.
 */
import { escapeHtml, icon } from './ui.js';

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
  { icon: 'credit-card', title: 'Payer et déclarer', text: 'Bientôt disponible. Vous paierez par Mixx by Yas ou Flooz vers les numéros officiels, puis vous déclarerez votre paiement avec votre référence.' },
  { icon: 'file-text', title: 'Document pro forma', text: 'Bientôt disponible. Après votre déclaration, vous pourrez télécharger un PDF pro forma. Ce document n’est pas une preuve de paiement.' },
  { icon: 'message', title: 'Contacter un assistant', text: 'Depuis le menu, écrivez à l’un des deux assistants sur WhatsApp. Ils ont les mêmes fonctions.' },
  { icon: 'truck', title: 'Suivre votre commande', text: 'Dans Commandes, retrouvez l’état de chaque étape, de l’achat en Chine à la livraison à votre domicile.' },
  { icon: 'user', title: 'Gérer votre profil', text: 'Dans Mon compte, modifiez vos informations de contact. Le nom d’utilisateur ne peut pas être modifié.' },
];

const ADMIN_ITEMS = [
  'Produits : ajoutez-les depuis Administration des produits (nom, catégorie, prix, promotion, statut, image en https). Le code est généré automatiquement.',
  'Campagnes : créez une campagne, ajoutez-y des produits, puis ouvrez la collecte. Les statuts des produits suivent automatiquement.',
  'Équipe (administrateur principal uniquement) : attribuez ou retirez les rôles. Chaque changement est journalisé.',
];

const DOCS = {
  guide: {
    title: 'Guide d’utilisation',
    html: () => `
      ${p('Bienvenue sur Viva Shop. Ce guide explique, étape par étape, comment commander des produits de Chine.')}
      <ol class="guide-steps">
        ${GUIDE_STEPS.map((s, i) => `
          <li class="guide-step">
            <span class="guide-icon">${icon(s.icon)}</span>
            <div><strong>${i + 1}. ${escapeHtml(s.title)}</strong><p>${escapeHtml(s.text)}</p></div>
          </li>`).join('')}
      </ol>
      ${h2('Pour les administrateurs et les agents')}
      <ul class="guide-list">${ADMIN_ITEMS.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`,
  },

  privacy: {
    title: 'Politique de confidentialité',
    html: () => `
      ${draftNotice()}
      ${h2('Données collectées')}
      ${p('Nom, prénom, nom d’utilisateur, téléphone, email, ville (facultative), préférences de notification, favoris, réservations. Plus tard : déclarations de paiement et justificatifs, que vous fournissez volontairement.')}
      ${h2('Pourquoi ces données')}
      ${p('Créer et gérer votre compte, traiter vos réservations et commandes, vous contacter par WhatsApp ou email, vérifier vos paiements, prévenir les fraudes.')}
      ${h2('Qui y accède')}
      ${p('Seule l’équipe Viva Shop, selon son rôle, accède à vos données. Vos données ne sont pas vendues à des tiers.')}
      ${h2('Où elles sont stockées')}
      ${p('Les données sont hébergées chez Supabase, dans la région Europe (Francfort). Les préférences de langue et de thème sont stockées sur votre appareil.')}
      ${h2('Durée de conservation')}
      ${p('Vos données sont conservées tant que votre compte est actif. [Durée après suppression du compte : à définir.]')}
      ${h2('Vos droits')}
      ${p('Vous pouvez demander l’accès à vos données, leur correction ou leur suppression, en écrivant à l’un des assistants sur WhatsApp.')}
      ${h2('Sécurité')}
      ${p('Chaque utilisateur ne voit que ses propres données. Les actions sensibles sont journalisées.')}`,
  },

  terms: {
    title: 'Conditions générales',
    html: () => `
      ${draftNotice()}
      ${h2('Objet')}
      ${p('Viva Shop est un intermédiaire entre des clients au Togo et des fournisseurs en Chine. Les produits sont choisis et mis à jour par l’équipe Viva Shop.')}
      ${h2('Réservation et paiement')}
      ${p('Une réservation n’est pas un paiement. Le paiement n’est demandé que lorsque la collecte est ouverte, et il n’est confirmé qu’après vérification par un agent.')}
      ${h2('Prix')}
      ${p('Les prix sont indiqués hors taxes en FCFA. Les tarifs dégressifs s’appliquent selon la quantité. Des frais peuvent s’ajouter, et ils sont indiqués avant votre engagement.')}
      ${h2('Remboursement')}
      ${p('[Conditions et délais de remboursement : à définir.]')}
      ${h2('Livraison')}
      ${p('[Délais indicatifs et conditions de livraison au Togo : à définir.]')}
      ${h2('Responsabilité')}
      ${p('Viva Shop s’engage à traiter vos commandes avec soin. Les délais donnés sont indicatifs, car ils dépendent des fournisseurs et des transporteurs.')}
      ${h2('Litiges')}
      ${p('[Droit applicable et juridiction compétente : à définir.]')}`,
  },
};

export function render(container, { route }) {
  const doc = DOCS[route.view];
  if (!doc) {
    container.innerHTML = '<div class="alert alert-error">Document introuvable.</div>';
    return;
  }
  container.innerHTML = `
    <a class="back" href="#/compte">← Mon compte</a>
    <article class="legal card">
      ${HERO}
      <h1>${escapeHtml(doc.title)}</h1>
      ${doc.html()}
    </article>`;
}
