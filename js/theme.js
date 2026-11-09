/**
 * theme.js — Thème clair ou sombre. Par défaut : celui du téléphone ou de l'ordinateur.
 * Le choix est mémorisé dans le navigateur.
 */
const STORAGE_KEY = 'cct-theme';

export function currentTheme() {
  return document.documentElement.dataset.theme || 'light';
}

function apply(theme) {
  document.documentElement.dataset.theme = theme;
}

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  apply(saved || system);
}

export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  localStorage.setItem(STORAGE_KEY, next);
  apply(next);
  return next;
}
