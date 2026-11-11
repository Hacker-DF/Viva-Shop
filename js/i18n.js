/**
 * i18n.js — Langues de l'interface : français, anglais, ewe.
 * Une clé absente d'une langue retombe sur le français : aucun écran n'est vide.
 * ⚠️ La traduction ewe est partielle et doit être relue par un locuteur natif.
 */
const STRINGS = {
  fr: {
    'app.slogan': 'Votre passerelle entre la Chine et le Togo',
    'nav.home': 'Accueil', 'nav.shop': 'Boutique', 'nav.orders': 'Commandes',
    'nav.favorites': 'Favoris', 'nav.account': 'Mon compte',
    'lang.label': 'Langue', 'theme.toggle': 'Changer le thème',
    'status.online': 'En ligne', 'status.demo': 'Démo', 'status.offline': 'Hors ligne', 'status.checking': 'Vérification…',
    // Accueil visiteur
    'home.hero.title': 'Commandez en Chine, recevez au Togo',
    'home.hero.text': 'Produits sélectionnés, prix clairs et suivi de bout en bout.',
    'home.btn.shop': 'Découvrir la boutique', 'home.btn.signup': 'Créer mon compte',
    'home.how.title': 'Comment commander',
    'home.step1.t': 'Créez votre compte', 'home.step1.x': 'Inscription rapide avec votre téléphone et votre nom.',
    'home.step2.t': 'Choisissez un produit', 'home.step2.x': 'Consultez la boutique et réservez le produit de votre choix.',
    'home.step3.t': 'Payez pendant la collecte', 'home.step3.x': 'Lorsque la campagne est ouverte, réglez via Mobile Money ou virement.',
    'home.step4.t': 'Déclarez votre paiement', 'home.step4.x': 'Envoyez votre référence : notre équipe la vérifie avant confirmation.',
    'home.step5.t': 'Suivez votre commande', 'home.step5.x': 'De l’achat en Chine à la livraison à votre domicile.',
    'home.adv.title': 'Nos avantages',
    'home.adv1.t': 'Intermédiaire de confiance', 'home.adv1.x': 'Nous gérons les fournisseurs, les paiements et le suivi de vos commandes.',
    'home.adv2.t': 'Tarifs dégressifs', 'home.adv2.x': 'Plus vous commandez, plus le prix unitaire baisse.',
    'home.adv3.t': 'Suivi logistique', 'home.adv3.x': 'Suivez chaque étape : de la Chine jusqu’à votre livraison au Togo.',
    'home.adv4.t': 'Assistance humaine', 'home.adv4.x': 'Deux assistants réels pour répondre à vos questions.',
    // Accueil membre
    'home.hello': 'Bonjour {name}', 'home.what': 'Que souhaitez-vous faire ?',
    'home.tile.shop': 'Boutique', 'home.tile.pay': 'Mes paiements', 'home.tile.fav': 'Favoris', 'home.tile.guide': 'Guide',
    'home.open': 'Collectes ouvertes', 'home.open.empty': 'Aucune collecte n’est ouverte pour le moment.',
    'home.lastpay': 'Vos derniers paiements', 'home.lastpay.empty': 'Aucun paiement déclaré pour le moment.',
    'home.seeall': 'Voir tous mes paiements',
    // Aide et pied de page
    'help.title': 'Besoin d’aide ?', 'help.text': 'Écrivez directement à l’un de nos assistants sur WhatsApp.',
    'footer.channel': 'Chaîne WhatsApp', 'footer.community': 'Communauté WhatsApp',
    'footer.guide': 'Guide', 'footer.privacy': 'Confidentialité', 'footer.terms': 'Conditions',
  },
  en: {
    'app.slogan': 'Your gateway between China and Togo',
    'nav.home': 'Home', 'nav.shop': 'Shop', 'nav.orders': 'Orders',
    'nav.favorites': 'Favorites', 'nav.account': 'My account',
    'lang.label': 'Language', 'theme.toggle': 'Change theme',
    'status.online': 'Online', 'status.demo': 'Demo', 'status.offline': 'Offline', 'status.checking': 'Checking…',
    'home.hero.title': 'Order from China, receive in Togo',
    'home.hero.text': 'Selected products, clear prices and tracking from start to finish.',
    'home.btn.shop': 'Discover the shop', 'home.btn.signup': 'Create my account',
    'home.how.title': 'How to order',
    'home.step1.t': 'Create your account', 'home.step1.x': 'Quick sign-up with your phone number and name.',
    'home.step2.t': 'Choose a product', 'home.step2.x': 'Browse the shop and reserve the product you want.',
    'home.step3.t': 'Pay during the collection', 'home.step3.x': 'When the campaign is open, pay by Mobile Money or bank transfer.',
    'home.step4.t': 'Declare your payment', 'home.step4.x': 'Send your reference: our team checks it before confirming.',
    'home.step5.t': 'Track your order', 'home.step5.x': 'From the purchase in China to delivery at your door.',
    'home.adv.title': 'Our advantages',
    'home.adv1.t': 'Trusted intermediary', 'home.adv1.x': 'We manage suppliers, payments and the tracking of your orders.',
    'home.adv2.t': 'Volume pricing', 'home.adv2.x': 'The more you order, the lower the unit price.',
    'home.adv3.t': 'Logistics tracking', 'home.adv3.x': 'Follow every step, from China to your delivery in Togo.',
    'home.adv4.t': 'Human support', 'home.adv4.x': 'Two real assistants to answer your questions.',
    'home.hello': 'Hello {name}', 'home.what': 'What would you like to do?',
    'home.tile.shop': 'Shop', 'home.tile.pay': 'My payments', 'home.tile.fav': 'Favorites', 'home.tile.guide': 'Guide',
    'home.open': 'Open collections', 'home.open.empty': 'No collection is open at the moment.',
    'home.lastpay': 'Your latest payments', 'home.lastpay.empty': 'No payment declared yet.',
    'home.seeall': 'See all my payments',
    'help.title': 'Need help?', 'help.text': 'Write directly to one of our assistants on WhatsApp.',
    'footer.channel': 'WhatsApp channel', 'footer.community': 'WhatsApp community',
    'footer.guide': 'Guide', 'footer.privacy': 'Privacy', 'footer.terms': 'Terms',
  },
  ewe: {
    // ⚠️ Partielle, à relire par un locuteur ewe natif. Le reste reprend le français.
    'app.slogan': 'Wò ƒe agbalẽnyatsɔ ɖe Chine kple Togo dome',
    'nav.home': 'Aƒe', 'nav.shop': 'Asi', 'nav.orders': 'Ɖoɖowo',
    'nav.favorites': 'Nu nyuiwo', 'nav.account': 'Nye ŋkɔ',
    'lang.label': 'Gbe', 'theme.toggle': 'Trɔ mɔ̃',
  },
};

import { EXTRA } from './i18n-extra.js';

for (const lang of Object.keys(EXTRA)) Object.assign(STRINGS[lang], EXTRA[lang]);
import { PAY } from './i18n-pay.js';
for (const lang of Object.keys(PAY)) Object.assign(STRINGS[lang], PAY[lang]);

const LANG_NAMES = { fr: 'Français', en: 'English' };
const STORAGE_KEY = 'cct-lang';
const listeners = [];

function detectLang() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && LANG_NAMES[saved]) return saved;
  return (navigator.language || 'fr').slice(0, 2) === 'en' ? 'en' : 'fr';
}

let current = detectLang();

/** Traduction d'une clé dans la langue active, avec repli sur le français. Les {marqueurs} sont remplacés par t(key, { name }). */
export function t(key, vars = {}) {
  const text = (STRINGS[current] && STRINGS[current][key]) || STRINGS.fr[key] || key;
  return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), text);
}

export function getLang() {
  return current;
}

/** Change la langue, mémorise le choix et prévient les écrans pour qu'ils se redessinent. */
export function setLang(lang) {
  if (!STRINGS[lang] || lang === current) return;
  current = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang === 'ewe' ? 'ee' : lang;
  listeners.forEach((fn) => fn(lang));
}

export function onLangChange(fn) {
  listeners.push(fn);
}

export const LANGUAGES = Object.entries(LANG_NAMES).map(([code, name]) => ({ code, name }));
