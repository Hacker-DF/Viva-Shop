/**
 * supabase.js — Connexion au backend Supabase
 *
 * Le client est chargé depuis un CDN avec une version FIXE (pas de « latest »).
 * Ce module n'est importé qu'au démarrage ; si le CDN est injoignable,
 * l'application affiche un message clair au lieu de rester bloquée.
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { APP_CONFIG, isConfigured } from './config.js';

/** Client Supabase (null tant que config.js n'est pas renseigné). */
export const supabase = isConfigured()
  ? createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey, {
      auth: {
        persistSession: true,      // session conservée dans le navigateur
        autoRefreshToken: true,    // renouvellement automatique du jeton
        detectSessionInUrl: true,  // retour des liens de connexion / réinitialisation
      },
    })
  : null;

/**
 * Teste réellement la joignabilité du service d'authentification Supabase.
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function checkConnection() {
  if (!supabase) return { ok: false, reason: 'not-configured' };
  try {
    const response = await fetch(`${APP_CONFIG.supabaseUrl}/auth/v1/health`, {
      headers: { apikey: APP_CONFIG.supabaseAnonKey },
    });
    return response.ok ? { ok: true } : { ok: false, reason: `http-${response.status}` };
  } catch (err) {
    return { ok: false, reason: 'network' };
  }
}
