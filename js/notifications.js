/**
 * notifications.js — Notifications de l'application : cloche avec compteur et liste.
 * Les notifications sont créées par la base ; ce module ne fait que les lire.
 */
import { escapeHtml, icon } from './ui.js';
import { t } from './i18n.js';
import { supabase } from './supabase.js';
import { getSession } from './auth.js';

/** Met à jour le compteur de la cloche de l'en-tête. */
export async function refreshBell() {
  const badge = document.getElementById('bell-count');
  if (!badge) return;
  const session = await getSession().catch(() => null);
  if (!session) { badge.hidden = true; return; }
  const { count } = await supabase.from('notifications')
    .select('*', { count: 'exact', head: true }).eq('is_read', false);
  badge.textContent = count > 9 ? '9+' : String(count || '');
  badge.hidden = !count;
}

/** Démarre la cloche : icône, compteur au chargement, puis rafraîchi régulièrement. */
export function startBell() {
  const bell = document.getElementById('bell');
  if (bell) bell.innerHTML = icon('bell');
  refreshBell();
  setInterval(refreshBell, 60000);
  window.addEventListener('hashchange', refreshBell);
}

/** Page « Notifications » (route #/notifications). */
export async function render(container) {
  const session = await getSession();
  if (!session) {
    container.innerHTML = `<div class="alert alert-warn">${escapeHtml(t('notif.guest'))}</div><a class="btn btn-primary" href="#/connexion">${escapeHtml(t('common.login'))}</a>`;
    return;
  }
  const { data, error } = await supabase.from('notifications')
    .select('id, title, body, link, is_read, created_at')
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  const hasUnread = data.some((n) => !n.is_read);

  container.innerHTML = `
    <div class="admin-toolbar">
      <h1>${escapeHtml(t('notif.title'))}</h1>
      ${hasUnread ? `<button id="read-all" class="btn btn-ghost btn-small" type="button">${escapeHtml(t('notif.readall'))}</button>` : ''}
    </div>
    <ul class="admin-list">
      ${data.map((n) => `
        <li class="admin-row ${n.is_read ? '' : 'unread'}">
          <a class="notif-link" href="${escapeHtml(n.link || '#/accueil')}">
            <strong>${escapeHtml(n.title)}</strong>
            ${n.body ? `<span class="product-code">${escapeHtml(n.body)}</span>` : ''}
            <small>${escapeHtml(new Date(n.created_at).toLocaleString('fr-FR'))}</small>
          </a>
        </li>`).join('') || `<li class="empty">${escapeHtml(t('notif.none'))}</li>`}
    </ul>`;

  container.querySelector('#read-all')?.addEventListener('click', async () => {
    const { error: upError } = await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    if (upError) return;
    await refreshBell();
    render(container);
  });

  // Ouvrir la page marque la lecture de l'ensemble
  if (hasUnread) {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    await refreshBell();
  }
}
