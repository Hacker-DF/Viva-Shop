/**
 * journal.js — Journal d'activité : qui a fait quoi, et quand.
 * Réservé à l'administrateur principal (politique audit_logs_admin_read côté base).
 */
import { escapeHtml } from './ui.js';
import { supabase } from './supabase.js';
import { translateError } from './auth.js';
import { t } from './i18n.js';

const LIMIT = 300;

export async function render(container) {
  container.innerHTML = `
    <div class="admin-toolbar"><h1>${t('jr.title')}</h1></div>
    <p class="hint">${t('jr.hint')}</p>
    <p id="jr-msg" class="alert" role="status" hidden></p>
    <div id="jr-body"><p class="product-code">${t('jr.loading')}</p></div>`;

  const { data, error } = await supabase.from('audit_logs')
    .select('id, actor_id, action, target_table, target_id, details, created_at')
    .order('created_at', { ascending: false }).limit(LIMIT);
  if (error) {
    const msg = container.querySelector('#jr-msg');
    msg.hidden = false;
    msg.textContent = translateError(error);
    return;
  }

  const ids = [...new Set(data.map((r) => r.actor_id).filter(Boolean))];
  const { data: profiles } = ids.length
    ? await supabase.from('profiles').select('id, username').in('id', ids)
    : { data: [] };
  const names = Object.fromEntries((profiles || []).map((p) => [p.id, p.username]));
  const actions = [...new Set(data.map((r) => r.action))].sort();

  container.querySelector('#jr-body').innerHTML = `
    <form id="jr-filter" class="two-cols">
      <label>${t('jr.person')}<select name="actor"><option value="">${t('jr.all')}</option>${ids.map((id) => `<option value="${id}">@${escapeHtml(names[id] || id.slice(0, 8))}</option>`).join('')}</select></label>
      <label>${t('jr.action')}<select name="action"><option value="">${t('jr.all')}</option>${actions.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('')}</select></label>
    </form>
    <ul class="admin-list" id="jr-list"></ul>`;

  const list = container.querySelector('#jr-list');
  const draw = () => {
    const f = new FormData(container.querySelector('#jr-filter'));
    const rows = data.filter((r) => (!f.get('actor') || r.actor_id === f.get('actor'))
      && (!f.get('action') || r.action === f.get('action')));
    list.innerHTML = rows.length ? rows.map((r) => {
      const who = r.actor_id ? `@${names[r.actor_id] || r.actor_id.slice(0, 8)}` : t('jr.system');
      const when = new Date(r.created_at).toLocaleString('fr-FR');
      const details = r.details && Object.keys(r.details).length ? JSON.stringify(r.details).slice(0, 160) : '';
      return `<li class="admin-row"><div class="admin-row-main">
        <strong>${escapeHtml(r.action.replace(/_/g, ' '))}</strong>
        <span class="product-code">${escapeHtml(when)} · ${escapeHtml(who)}</span>
        ${r.target_table ? `<span class="product-code">${escapeHtml(r.target_table)} ${escapeHtml(r.target_id || '')}</span>` : ''}
        ${details ? `<span class="product-code">${escapeHtml(details)}</span>` : ''}
      </div></li>`;
    }).join('') : `<li class="empty">${t('jr.none')}</li>`;
  };
  container.querySelector('#jr-filter').addEventListener('change', draw);
  draw();
}
