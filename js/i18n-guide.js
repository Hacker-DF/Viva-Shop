/**
 * i18n-guide.js — Textes du guide d'utilisation (titre, introduction, 14 étapes).
 * Fusionnés dans i18n.js. Les étapes sont lues par leur numéro (guide.s0 … guide.s13).
 */
const STEPS_FR = [
  ['Créer votre compte', 'Inscrivez-vous avec un nom d’utilisateur, votre nom, votre téléphone WhatsApp et votre email. L’email sert à vous connecter.'],
  ['Consulter la boutique', 'Parcourez les catégories, ou cherchez un produit par son nom ou son code.'],
  ['Comprendre les codes produits', 'Chaque produit a un code unique : 2 chiffres suivis de 6 lettres (exemple : 24ABCDEF). Copiez-le depuis la fiche. Il sert à retrouver le produit dans votre déclaration de paiement et dans vos demandes d’assistance.'],
  ['Ajouter aux favoris', 'Depuis la fiche d’un produit, ajoutez-le à vos favoris pour le retrouver dans l’onglet Favoris.'],
  ['Réserver un produit', 'La réservation n’est possible que pour un produit « En attente ». Une réservation n’est pas un paiement.'],
  ['Participer à une campagne', 'Lorsque la collecte est ouverte, le statut du produit passe à « Collecte ouverte » et la date limite de paiement s’affiche.'],
  ['Payer et déclarer', 'Quand la collecte est ouverte, payez par Mixx by Yas ou Flooz vers le numéro officiel affiché, puis déclarez votre paiement avec la référence de la transaction (TXN, Txn ID ou Ref).'],
  ['Document pro forma', 'Téléchargez le PDF pro forma depuis Mes commandes. Une fois votre paiement validé, il porte le tampon de l’administration et la date de validation.'],
  ['Contacter un assistant', 'Depuis le menu, écrivez à l’un des deux assistants sur WhatsApp. Ils ont les mêmes fonctions.'],
  ['Suivre votre colis', 'Dans Commandes, « Mes colis » affiche la couleur, l’étape en cours, la date d’arrivée prévue et l’historique. Retrouvez-le avec votre numéro de commande.'],
  ['Notifications', 'La cloche en haut de l’écran vous prévient de chaque changement : paiement, réservation, étape du colis, ouverture d’une collecte.'],
  ['Demande spéciale', 'Vous ne trouvez pas un produit ? Décrivez-le, ajoutez une photo si vous en avez une. Notre équipe vous envoie un devis.'],
  ['Signaler un problème', 'Dans Mon compte, « Signaler un problème » envoie votre demande à l’équipe support. La réponse apparaît dans Mes demandes.'],
  ['Gérer votre profil', 'Dans Mon compte, modifiez vos informations de contact. Le nom d’utilisateur ne peut pas être modifié.'],
];

const STEPS_EN = [
  ['Create your account', 'Sign up with a username, your name, your WhatsApp phone number and your email. The email is used to log in.'],
  ['Browse the shop', 'Browse the categories, or search for a product by name or code.'],
  ['Understand product codes', 'Each product has a unique code: 2 digits followed by 6 letters (example: 24ABCDEF). Copy it from the product page. It helps find the product in your payment declaration and in support requests.'],
  ['Add to favorites', 'From a product page, add it to your favorites to find it in the Favorites tab.'],
  ['Reserve a product', 'Reservations are only possible for a product marked "Pending". A reservation is not a payment.'],
  ['Join a campaign', 'When the collection is open, the product status changes to "Collection open" and the payment deadline is shown.'],
  ['Pay and declare', 'When the collection is open, pay with Mixx by Yas or Flooz to the official number shown, then declare your payment with the transaction reference (TXN, Txn ID or Ref).'],
  ['Pro forma document', 'Download the pro forma PDF from My orders. Once your payment is validated, it carries the administration stamp and the validation date.'],
  ['Contact an assistant', 'From the menu, write to one of the two assistants on WhatsApp. They have the same role.'],
  ['Track your parcel', 'In Orders, "My parcels" shows the colour, the current step, the expected arrival date and the history. Find it with your order number.'],
  ['Notifications', 'The bell at the top of the screen tells you about every change: payment, reservation, parcel step, collection opening.'],
  ['Special request', 'Can’t find a product? Describe it and add a photo if you have one. Our team will send you a quote.'],
  ['Report a problem', 'In My account, "Report a problem" sends your request to the support team. The reply appears in My requests.'],
  ['Manage your profile', 'In My account, edit your contact details. The username cannot be changed.'],
];

export const GUIDE_I18N = {
  fr: {
    'guide.title': 'Guide d’utilisation',
    'guide.intro': 'Bienvenue sur Viva Shop. Ce guide explique, étape par étape, comment commander des produits de Chine.',
    ...Object.fromEntries(STEPS_FR.flatMap(([title, text], i) => [[`guide.s${i}.t`, title], [`guide.s${i}.x`, text]])),
  },
  en: {
    'guide.title': 'User guide',
    'guide.intro': 'Welcome to Viva Shop. This guide explains, step by step, how to order products from China.',
    ...Object.fromEntries(STEPS_EN.flatMap(([title, text], i) => [[`guide.s${i}.t`, title], [`guide.s${i}.x`, text]])),
  },
};
