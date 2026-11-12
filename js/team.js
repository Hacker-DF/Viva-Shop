/**
 * team.js — Gestion de l'équipe : attribution et retrait des rôles.
 * Réservé à l'administrateur principal. Chaque changement passe par la fonction serveur
 * set_user_role, qui vérifie le droit une seconde fois et journalise l'action.
 */
import { escapeHtml } from './ui.js';
import { supabase } from './supabase.js';
import { translateError, getRoleCodes } from './auth.js';
import { t } from './i18n.js';

/** Message à afficher après le rechargement de la page. */
let pending = null;

export async function render(container) {
  const note = pending;
  pending = null;

  if (!(await getRoleCodes()).includes('proprietaire')) {
    container.innerHTML = `<div class="admin-toolbar"><h1>${t('team.title')}</h1></div><div class="alert alert-info">${t('team.owner_only')}</div>`;
    return;
  }

  const [rolesRes, profilesRes, linksRes] = await Promise.all([
    supabase.from('roles').select('code, label').order('label'),
    supabase.from('profiles').select('id, username, first_name, last_name').order('username'),
    supabase.from('user_roles').select('user_id, role_code'),
  ]);
  const error = rolesRes.error || profilesRes.error || linksRes.error;
  if (error) throw error;

  const roles = rolesRes.data;
  const profiles = profilesRes.data;
  const rolesByUser = {};
  linksRes.data.forEach((l) => { (rolesByUser[l.user_id] ||= []).push(l.role_code); });
  const labelOf = Object.fromEntries(roles.map((r) => [r.code, r.label]));

  container.innerHTML = `
    <div class="admin-toolbar">
      <h1>${t('team.title')}</h1>
      <a class="btn btn-ghost btn-small" href="#/admin">${t('admin.products')}</a>
    </div>
    <div id="team-msg" class="alert" role="status" hidden></div>

    <form id="grant" class="card admin-form" novalidate>
      <h2>${t('team.grant_title')}</h2>
      <label>${t('common.username')}
        <input name="username" list="usernames" required autocomplete="off" maxlength="20">
      </label>
      <datalist id="usernames">
        ${profiles.map((p) => `<option value="${escapeHtml(p.username)}"></option>`).join('')}
      </datalist>
      <label>${t('team.role')}
        <select name="role">
          ${roles.map((r) => `<option value="${escapeHtml(r.code)}">${escapeHtml(r.label)}</option>`).join('')}
        </select>
      </label>
      <button class="btn btn-primary btn-block" type="submit">${t('team.grant')}</button>
    </form>

    <ul class="admin-list">
      ${profiles.map((p) => `
        <li class="admin-row">
          <div class="admin-row-main">
            <strong>${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</strong>
            <span class="product-code">@${escapeHtml(p.username)}</span>
          </div>
          <div class="admin-meta">
            ${(rolesByUser[p.id] || []).map((code) => `
              <span class="status-badge" style="--c: var(--electric)">
                ${escapeHtml(labelOf[code] || code)}
                <button type="button" class="chip-x" data-username="${escapeHtml(p.username)}"
                        data-role="${escapeHtml(code)}" aria-label="${t('team.remove_role')}">×</button>
              </span>`).join('') || `<span class="product-code">${t('team.client_account')}</span>`}
          </div>
        </li>`).join('')}
    </ul>`;

  const msg = container.querySelector('#team-msg');
  const say = (text, type) => { msg.className = `alert alert-${type}`; msg.textContent = text; msg.hidden = false; };
  if (note) say(note.text, note.type);

  // Appel de la fonction serveur ; en cas de succès, la page est rechargée avec un message
  async function change(username, role, grant, successText) {
    const { error: rpcError } = await supabase.rpc('set_user_role', {
      p_username: username, p_role: role, p_grant: grant,
    });
    if (rpcError) { say(translateError(rpcError), 'error'); return; }
    pending = { text: successText, type: 'success' };
    render(container);
  }

  container.querySelector('#grant').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const username = String(fd.get('username')).trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) { say(t('team.invalid_username'), 'error'); return; }
    change(username, String(fd.get('role')), true, `${t('team.granted')} @${username}.`);
  });

  container.querySelector('ul').addEventListener('click', (e) => {
    const btn = e.target.closest('button.chip-x');
    if (!btn) return;
    change(btn.dataset.username, btn.dataset.role, false, `${t('team.revoked')} @${btn.dataset.username}.`);
  });
}
