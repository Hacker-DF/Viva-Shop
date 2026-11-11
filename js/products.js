/**
 * products.js — Couche d'accès aux données de la boutique (catégories, produits, favoris).
 * Toute la sécurité est appliquée par Supabase (RLS) ; ce module ne fait que demander.
 */
import { supabase } from './supabase.js';
import { getSession } from './auth.js';

const PRODUCT_COLUMNS = 'id, code, name, description, price_ht, promo_price, main_image_url, status, created_at';

/** Statuts commerciaux (section 7 du cahier des charges). */
export const STATUS_LABELS = {
  en_attente: { label: 'En attente', color: 'var(--status-red)' },
  collecte_ouverte: { label: 'Collecte ouverte', color: 'var(--status-green)' },
  commande_cloturee: { label: 'Commande clôturée', color: 'var(--status-grey)' },
  situation_particuliere: { label: 'Situation particulière', color: 'var(--status-orange)' },
};

function client() {
  if (!supabase) throw new Error('Service non configuré (voir js/config.js).');
  return supabase;
}

/** Montant en FCFA, format français (ex. 12 500 FCFA). */
export function formatFcfa(amount) {
  return `${new Intl.NumberFormat('fr-FR').format(amount)} FCFA`;
}

export async function listCategories() {
  const { data, error } = await client()
    .from('categories').select('id, slug, name').eq('is_active', true).order('position');
  if (error) throw error;
  return data;
}

/** Liste paginée et filtrée du catalogue. */
export async function listProducts({ q = '', categoryId = '', sort = 'newest', offset = 0, limit = 24 } = {}) {
  let query = client().from('products').select(PRODUCT_COLUMNS).eq('is_archived', false);

  // Retire les caractères qui casseraient le filtre PostgREST
  const term = q.replace(/[,()*%]/g, '').trim();
  if (term) query = query.or(`name.ilike.%${term}%,code.ilike.%${term}%`);
  if (categoryId) query = query.eq('category_id', categoryId);

  if (sort === 'price_asc') query = query.order('price_ht', { ascending: true });
  else if (sort === 'price_desc') query = query.order('price_ht', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

/** Fiche produit par code (ex. 24ABCDEF). Retourne null si introuvable ou archivé. */
export async function getProductByCode(code) {
  const { data, error } = await client()
    .from('products').select(PRODUCT_COLUMNS).eq('code', code).eq('is_archived', false).maybeSingle();
  if (error) throw error;
  return data;
}

/** Identifiants parmi `productIds` que l'utilisateur connecté a mis en favori. */
export async function favoriteIdsAmong(productIds) {
  const session = await getSession();
  if (!session || productIds.length === 0) return [];
  const { data, error } = await client()
    .from('favorites').select('product_id').eq('user_id', session.user.id).in('product_id', productIds);
  if (error) throw error;
  return data.map((r) => r.product_id);
}

/** Ajoute ou retire un favori. */
export async function setFavorite(productId, isFavorite) {
  const session = await getSession();
  if (!session) throw new Error('Connectez-vous pour gérer vos favoris.');
  const table = client().from('favorites');
  const { error } = isFavorite
    ? await table.delete().eq('user_id', session.user.id).eq('product_id', productId)
    : await table.insert({ user_id: session.user.id, product_id: productId });
  if (error) throw error;
}

/** Liste des produits favoris de l'utilisateur connecté (archivés exclus). */
export async function listFavorites() {
  const { data, error } = await client()
    .from('favorites')
    .select('created_at, products(id, code, name, price_ht, promo_price, main_image_url, status, is_archived)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((r) => r.products).filter((p) => p && !p.is_archived);
}

/** Tarifs dégressifs d'un produit, triés par quantité minimale. */
export async function listTiers(productId) {
  const { data, error } = await client()
    .from('price_tiers').select('min_qty, max_qty, unit_price_ht')
    .eq('product_id', productId).order('min_qty');
  if (error) throw error;
  return data;
}

/** Prix unitaire applicable à une quantité ; à défaut de palier, le prix de référence. */
export function unitPriceFor(tiers, qty, fallback) {
  const tier = tiers.find((t) => qty >= t.min_qty && (t.max_qty == null || qty <= t.max_qty));
  return tier ? tier.unit_price_ht : fallback;
}

/** Enregistre une réservation (ce n'est pas un paiement). */
export async function createReservation({ productId, quantity, variant, capacity, notes }) {
  const session = await getSession();
  if (!session) throw new Error('Connectez-vous pour réserver.');
  const { error } = await client().from('reservations').insert({
    user_id: session.user.id,
    product_id: productId,
    quantity,
    variant: variant || null,
    capacity: capacity || null,
    notes: notes || null,
  });
  if (error) throw error;
}

/** Réservations de l'utilisateur connecté. */
export async function listMyReservations() {
  const { data, error } = await client()
    .from('reservations')
    .select('id, quantity, variant, capacity, status, created_at, products(code, name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Photos supplémentaires, par produit : { [productId]: [url, ...] }. */
export async function listProductImages(ids) {
  if (!ids.length) return {};
  const { data, error } = await client()
    .from('product_images').select('product_id, url, position').in('product_id', ids).order('position');
  if (error) throw error;
  const map = {};
  data.forEach((r) => { (map[r.product_id] ||= []).push(r.url); });
  return map;
}

/** Toutes les photos d'un produit : la principale d'abord, sans doublon. */
export function allImages(p, extra = []) {
  return [...new Set([p.main_image_url, ...extra].filter(Boolean))];
}
