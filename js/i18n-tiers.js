/**
 * i18n-tiers.js — Tarifs par quantité et suppression de campagnes. Fusionnés dans i18n.js.
 */
export const TIERS_I18N = {
  fr: {
    'adm.tiers_title': 'Tarifs par quantité',
    'adm.tiers_hint': 'Prix unitaire selon la quantité commandée. Laissez « Maximum » vide pour « et plus ».',
    'adm.tier_min': 'Quantité minimum', 'adm.tier_max': 'Quantité maximum', 'adm.tier_plus': 'et plus',
    'adm.tier_price': 'Prix unitaire (FCFA HT)', 'adm.tier_add': 'Ajouter un palier', 'adm.tier_remove': 'Retirer ce palier',
    'adm.tier_err': 'Chaque palier doit avoir une quantité minimum (1 ou plus) et un prix (0 ou plus).',
    'adm.tier_order': 'Les paliers ne doivent pas se chevaucher et doivent suivre l’ordre des quantités.',
    'cp.delete_confirm': 'Supprimer définitivement cette campagne ? Les produits restent dans la boutique.',
    'cp.deleted': 'Campagne supprimée.',
  },
  en: {
    'adm.tiers_title': 'Quantity pricing',
    'adm.tiers_hint': 'Unit price depending on the quantity ordered. Leave "Maximum" empty for "and up".',
    'adm.tier_min': 'Minimum quantity', 'adm.tier_max': 'Maximum quantity', 'adm.tier_plus': 'and up',
    'adm.tier_price': 'Unit price (FCFA excl. tax)', 'adm.tier_add': 'Add a tier', 'adm.tier_remove': 'Remove this tier',
    'adm.tier_err': 'Each tier needs a minimum quantity (1 or more) and a price (0 or more).',
    'adm.tier_order': 'Tiers must not overlap and must follow the quantity order.',
    'cp.delete_confirm': 'Permanently delete this campaign? The products stay in the shop.',
    'cp.deleted': 'Campaign deleted.',
  },
};
