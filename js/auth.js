/**
 * auth.js — Authentification Supabase : inscription, connexion, session, profil.
 * Ce module ne décide pas des accès : la sécurité réelle est appliquée par Supabase (RLS).
 */
import { supabase } from './supabase.js';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const PHONE_RE = /^\+?[0-9 ]{8,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

let profileCache = null;

function client() {
  if (!supabase) throw new Error('Service non configuré (voir js/config.js).');
  return supabase;
}

/** Traduit les erreurs Supabase courantes en français. */
export function translateError(error) {
  const msg = error?.message || '';
  if (/Invalid login credentials/i.test(msg)) return 'Email ou mot de passe incorrect.';
  if (/already registered/i.test(msg)) return 'Un compte existe déjà avec cet email.';
  if (/Email not confirmed/i.test(msg)) return 'Confirmez votre email avant de vous connecter.';
  if (/Database error saving new user/i.test(msg)) {
    return 'Création impossible : ce nom d’utilisateur ou ce téléphone est peut-être déjà utilisé.';
  }
  return msg || 'Une erreur est survenue.';
}

/** Valide le formulaire d'inscription. Retourne un objet { champ: message } (vide si valide). */
export function validateRegistration(d) {
  const errors = {};
  if (!USERNAME_RE.test(d.username || '')) errors.username = '3 à 20 caractères : minuscules, chiffres ou _';
  if ((d.first_name || '').trim().length < 2) errors.first_name = 'Au moins 2 caractères';
  if ((d.last_name || '').trim().length < 2) errors.last_name = 'Au moins 2 caractères';
  if (!PHONE_RE.test((d.phone || '').trim())) errors.phone = 'Numéro invalide, ex. +228 90 00 00 00';
  if (!EMAIL_RE.test((d.email || '').trim())) errors.email = 'Email invalide';
  if (!PASSWORD_RE.test(d.password || '')) errors.password = '8 caractères minimum, avec une majuscule, une minuscule et un symbole';
  return errors;
}

/** Crée le compte. Le profil est créé automatiquement par la base (trigger). */
export async function signUp(d) {
  const { data, error } = await client().auth.signUp({
    email: d.email.trim(),
    password: d.password,
    options: {
      data: {
        username: d.username.trim().toLowerCase(),
        first_name: d.first_name.trim(),
        last_name: d.last_name.trim(),
        phone: d.phone.trim(),
        city: (d.city || '').trim(),
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error;
  profileCache = null;
  return data;
}

export async function signOut() {
  await client().auth.signOut();
  profileCache = null;
}

export async function getSession() {
  const { data } = await client().auth.getSession();
  return data.session;
}

/** Profil de l'utilisateur connecté (null si déconnecté). Mis en cache pendant la session. */
export async function getProfile() {
  if (profileCache) return profileCache;
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await client()
    .from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (error) throw error;
  profileCache = data;
  return data;
}

/** Modifie son propre profil (la base refuse toute autre colonne ou tout autre utilisateur). */
export async function updateProfile(changes) {
  const session = await getSession();
  const { data, error } = await client()
    .from('profiles').update(changes).eq('id', session.user.id).select().single();
  if (error) throw error;
  profileCache = data;
  return data;
}

/** Libellés des rôles attribués à l'utilisateur connecté (lecture autorisée par RLS). */
export async function getRoleLabels() {
  const session = await getSession();
  if (!session) return [];
  const { data, error } = await client()
    .from('user_roles').select('role_code, roles(label)').eq('user_id', session.user.id);
  if (error) throw error;
  return data.map((r) => r.roles?.label || r.role_code);
}

/** Codes des rôles de l'utilisateur connecté (ex. 'gestionnaire_produits'). */
export async function getRoleCodes() {
  const session = await getSession();
  if (!session) return [];
  const { data, error } = await client()
    .from('user_roles').select('role_code').eq('user_id', session.user.id);
  if (error) throw error;
  return data.map((r) => r.role_code);
}
