/**
 * i18n-status.js — Libellés des statuts (paiements, colis, produits, demandes, réclamations).
 * Fusionnés dans i18n.js.
 */
export const STATUS_I18N = {
  fr: {
    'st.pay.en_attente_verification': 'En attente de vérification', 'st.pay.en_cours_verification': 'En cours de vérification',
    'st.pay.paiement_confirme': 'Paiement confirmé', 'st.pay.montant_incorrect': 'Montant incorrect',
    'st.pay.transaction_introuvable': 'Transaction introuvable', 'st.pay.declaration_rejetee': 'Déclaration rejetée',
    'st.pay.rembourse': 'Remboursé',
    'st.ship.transmise_chine': 'Transmise à l’agent en Chine', 'st.ship.achat_effectue': 'Achat effectué',
    'st.ship.recu_chine': 'Reçu en Chine', 'st.ship.expedie': 'Expédié vers le Togo', 'st.ship.arrive_togo': 'Arrivé au Togo',
    'st.ship.en_livraison': 'En cours de livraison', 'st.ship.livre': 'Livré',
    'st.prod.en_attente': 'En attente', 'st.prod.collecte_ouverte': 'Collecte ouverte',
    'st.prod.commande_cloturee': 'Commande clôturée', 'st.prod.situation_particuliere': 'Situation particulière',
    'st.sp.recue': 'Reçue', 'st.sp.etude': 'En étude', 'st.sp.devis_envoye': 'Devis envoyé',
    'st.sp.acceptee': 'Acceptée', 'st.sp.refusee': 'Refusée', 'st.sp.annulee': 'Annulée',
    'st.sup.ouverte': 'Ouverte', 'st.sup.en_cours': 'En cours de traitement', 'st.sup.resolue': 'Résolue',
  },
  en: {
    'st.pay.en_attente_verification': 'Awaiting verification', 'st.pay.en_cours_verification': 'Being verified',
    'st.pay.paiement_confirme': 'Payment confirmed', 'st.pay.montant_incorrect': 'Incorrect amount',
    'st.pay.transaction_introuvable': 'Transaction not found', 'st.pay.declaration_rejetee': 'Declaration rejected',
    'st.pay.rembourse': 'Refunded',
    'st.ship.transmise_chine': 'Handed to the agent in China', 'st.ship.achat_effectue': 'Purchase made',
    'st.ship.recu_chine': 'Received in China', 'st.ship.expedie': 'Shipped to Togo', 'st.ship.arrive_togo': 'Arrived in Togo',
    'st.ship.en_livraison': 'Out for delivery', 'st.ship.livre': 'Delivered',
    'st.prod.en_attente': 'Pending', 'st.prod.collecte_ouverte': 'Collection open',
    'st.prod.commande_cloturee': 'Order closed', 'st.prod.situation_particuliere': 'Special situation',
    'st.sp.recue': 'Received', 'st.sp.etude': 'Under review', 'st.sp.devis_envoye': 'Quote sent',
    'st.sp.acceptee': 'Accepted', 'st.sp.refusee': 'Declined', 'st.sp.annulee': 'Cancelled',
    'st.sup.ouverte': 'Open', 'st.sup.en_cours': 'In progress', 'st.sup.resolue': 'Resolved',
  },
};

/** Construit un objet de statuts dont les libellés se traduisent à chaque lecture. */
function objectBlock(name, prefix, entries) {
  const lines = Object.entries(entries).map(([key, color]) =>
    `  ${key}: {\n    get label() { return t('st.${prefix}.${key}'); },\n    color: '${color}',\n  },`);
  return `export const ${name} = {\n${lines.join('\n')}\n};`;
}

export const STATUS_BLOCKS = {
  payments: objectBlock('PAYMENT_STATUS', 'pay', {
    en_attente_verification: 'var(--status-red)', en_cours_verification: 'var(--electric)',
    paiement_confirme: 'var(--status-green)', montant_incorrect: 'var(--status-orange)',
    transaction_introuvable: 'var(--status-orange)', declaration_rejetee: 'var(--status-red)',
    rembourse: 'var(--status-grey)',
  }),
  shipments: objectBlock('SHIP_STATUS', 'ship', {
    transmise_chine: 'var(--status-red)', achat_effectue: 'var(--electric)', recu_chine: 'var(--electric)',
    expedie: 'var(--status-orange)', arrive_togo: 'var(--status-orange)', en_livraison: 'var(--status-green)',
    livre: 'var(--status-grey)',
  }),
  products: objectBlock('STATUS_LABELS', 'prod', {
    en_attente: 'var(--status-red)', collecte_ouverte: 'var(--status-green)',
    commande_cloturee: 'var(--status-grey)', situation_particuliere: 'var(--status-orange)',
  }),
};
