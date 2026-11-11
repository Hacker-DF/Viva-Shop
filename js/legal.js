/**
 * legal.js — Guide d'utilisation, politique de confidentialité et conditions générales.
 * Accessibles depuis « Mon compte » et le pied de page. Textes en français.
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
    title: 'Politique de confidentialité',
    html: () => `
      ${h2('Données collectées')}
      ${p('Nom, prénom, nom d’utilisateur, téléphone, email, ville (facultative), photo de profil (facultative), adresses de livraison, préférences de notification, favoris, réservations, déclarations de paiement, captures d’écran de paiement, demandes spéciales et réclamations. Les photos et captures ne sont fournies que si vous les envoyez volontairement.')}
      ${h2('Pourquoi ces données')}
      ${p('Créer et gérer votre compte, traiter vos réservations et commandes, vous contacter par WhatsApp ou email, vérifier vos paiements, prévenir les fraudes.')}
      ${h2('Qui y accède')}
      ${p('Seule l’équipe Viva Shop, selon son rôle, accède à vos données. Vos données ne sont pas vendues à des tiers.')}
      ${h2('Où elles sont stockées')}
      ${p('Les données sont hébergées chez Supabase, dans la région Europe (Francfort). Les préférences de langue et de thème sont stockées sur votre appareil.')}
      ${h2('Durée de conservation')}
      ${p('Vos données sont conservées tant que votre compte est actif. Les données de commande et de paiement sont conservées 5 ans après la dernière opération, pour nos obligations comptables. Les autres données sont supprimées à la fermeture du compte.')}
      ${h2('Vos droits')}
      ${p('Vous pouvez demander l’accès à vos données, leur correction ou leur suppression, en écrivant à l’un des assistants sur WhatsApp.')}
      ${h2('Sécurité')}
      ${p('Vos données sont chiffrées pendant leur transmission (connexion HTTPS) et protégées pendant leur conservation sur les serveurs de notre hébergeur.')}
      ${p('L’accès est limité par rôle : chaque personne ne voit que ce que sa fonction permet, et les actions sensibles sont journalisées.')}
      ${p('Aucun système n’est totalement à l’abri d’un incident. En cas de risque pour vos données, nous vous en informerons dans les délais prévus par la loi.')}`,
  },

  terms: {
    title: 'Conditions générales',
    html: () => `
      ${h2('Objet')}
      ${p('Viva Shop est un intermédiaire entre des clients au Togo et des fournisseurs en Chine. Les produits sont choisis et mis à jour par l’équipe Viva Shop.')}
      ${h2('Réservation et paiement')}
      ${p('Une réservation n’est pas un paiement. Le paiement n’est demandé que lorsque la collecte est ouverte, et il n’est confirmé qu’après vérification par un agent.')}
      ${h2('Prix')}
      ${p('Les prix sont indiqués hors taxes en FCFA. Les tarifs dégressifs s’appliquent selon la quantité. Des frais peuvent s’ajouter, et ils sont indiqués avant votre engagement.')}
      ${h2('Remboursement')}
      ${p('Vous êtes remboursé lorsque la collecte est annulée ou que le produit n’est pas disponible, lorsqu’une commande n’est pas livrée par notre faute, ou lorsqu’un paiement a été effectué par erreur. Le remboursement est versé par le même moyen de paiement (Mixx by Yas ou Flooz) dans un délai de 14 jours après acceptation de la demande par notre équipe. Les frais de transfert restent à votre charge, sauf faute de notre part.')}
      ${p('Une commande déjà passée auprès du fournisseur en Chine ne peut être annulée, sauf accord écrit de l’équipe.')}
      ${h2('Livraison')}
      ${p('La livraison est assurée jusqu’à l’adresse indiquée, au Togo, par nos partenaires transporteurs. Les délais sont indicatifs : ils dépendent des fournisseurs et des transporteurs. La date d’arrivée prévue est communiquée sur chaque colis, et vous êtes prévenu de chaque étape par notification.')}
      ${p('Un colis non retiré dans les 30 jours après son arrivée au Togo est conservé selon les conditions de notre partenaire, puis retourné ou restitué à l’équipe. Le risque du colis est transféré au client à sa remise.')}
      ${h2('Responsabilité')}
      ${p('Viva Shop s’engage à traiter vos commandes avec soin. Les délais donnés sont indicatifs, car ils dépendent des fournisseurs et des transporteurs.')}
      ${h2('Litiges')}
      ${p('Avant toute procédure, les parties cherchent à résoudre le litige à l’amiable : le client écrit d’abord à notre support depuis « Signaler un problème », puis à un assistant si nécessaire.')}
      ${p('À défaut d’accord, le litige relève du droit togolais et des tribunaux compétents de Lomé.')}`,
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
