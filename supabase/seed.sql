-- ==========================================================================
-- seed.sql — Données de référence (sans données fictives de clients)
-- ==========================================================================

insert into public.roles (code, label, description) values
  ('administrateur_principal', 'Administrateur principal', 'Tous les droits de gestion ; attribue les rôles'),
  ('gestionnaire_produits',    'Gestionnaire produits',    'Gère le catalogue, les prix et les campagnes'),
  ('responsable_commandes',    'Responsable commandes',    'Traite les réservations et les commandes'),
  ('agent_financier',          'Agent financier',          'Vérifie les paiements et les justificatifs'),
  ('agent_chine',              'Agent en Chine',           'Achète et réceptionne les colis en Chine'),
  ('responsable_logistique',   'Responsable logistique',   'Suit les expéditions et l''arrivée au Togo'),
  ('agent_livraison',          'Agent de livraison',       'Livre les clients au Togo'),
  ('support_client',           'Support client',           'Répond aux demandes d''assistance')
on conflict (code) do nothing;
