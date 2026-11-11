/**
 * addresses.js — Adresses de livraison du client, affichées dans Mon compte.
 * Chaque adresse ne concerne que son propriétaire (règle appliquée par la base).
 */
import { escapeHtml } from './ui.js';
import { supabase } from './supabase.js';
import { getSession, translateError } from './auth.js';

export async function renderAddresses(slot) {
  if (!slot) return;
  const session = await getSession();
  if (!session) { slot.innerHTML = ''; return; }

  const { data, error } = await supabase.from('addresses')
    .select('id, label, address, city, is_default')
    .order('is_default', { ascending: false }).order('created_at');
  if (error) { slot.innerHTML = `<div class="alert alert-error">${escapeHtml(translateError(error))}</div>`; return; }

  slot.innerHTML = `
    <h2 class="section-title">Mes adresses de livraison</h2>
    <div id="addr-msg" class="alert" role="status" hidden></div>
    <ul class="admin-list">
      ${data.map((a) => `
        <li class="admin-row">
          <div class="admin-row-main">
            <strong>${escapeHtml(a.label)}${a.is_default ? ' · <span class="status-badge" style="--c: var(--status-green)">Par défaut</span>' : ''}</strong>
            <span class="product-code">${escapeHtml(a.address)}${a.city ? ', ' + escapeHtml(a.city) : ''}</span>
          </div>
          <div class="admin-actions wrap">
            ${a.is_default ? '' : `<button class="btn btn-ghost btn-small" type="button" data-default="${a.id}">Par défaut</button>`}
            <button class="btn btn-ghost btn-small" type="button" data-del="${a.id}">Supprimer</button>
          </div>
        </li>`).join('') || '<li class="empty">Aucune adresse enregistrée.</li>'}
    </ul>
    <form id="addr-form" class="card admin-form" novalidate>
      <label>Nom de l’adresse (ex. Maison, Bureau)<input name="label" maxlength="40" required></label>
      <label>Adresse (quartier, repère)<textarea name="address" rows="2" maxlength="300" required></textarea></label>
      <label>Ville (facultatif)<input name="city" maxlength="80"></label>
      <button class="btn btn-primary btn-block" type="submit">Ajouter l’adresse</button>
    </form>`;

  const msg = slot.querySelector('#addr-msg');
  const say = (text, type) => { msg.className = `alert alert-${type}`; msg.textContent = text; msg.hidden = false; };
  const again = () => renderAddresses(slot);

  slot.querySelector('#addr-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const label = String(fd.get('label')).trim();
    const address = String(fd.get('address')).trim();
    if (label.length < 2 || address.length < 5) { say('Nom (2 caractères) et adresse (5 caractères) requis.', 'error'); return; }
    const { error: insError } = await supabase.from('addresses').insert({
      user_id: session.user.id,
      label,
      address,
      city: String(fd.get('city')).trim() || null,
      is_default: data.length === 0,
    });
    if (insError) { say(translateError(insError), 'error'); return; }
    again();
  });

  slot.querySelector('ul.admin-list').addEventListener('click', async (e) => {
    const del = e.target.closest('button[data-del]');
    const def = e.target.closest('button[data-default]');
    if (del) {
      const { error: delError } = await supabase.from('addresses').delete().eq('id', del.dataset.del);
      if (delError) { say(translateError(delError), 'error'); return; }
      again();
    } else if (def) {
      // Retire l'ancienne adresse par défaut, puis désigne la nouvelle
      const { error: offError } = await supabase.from('addresses').update({ is_default: false }).eq('is_default', true);
      if (offError) { say(translateError(offError), 'error'); return; }
      const { error: onError } = await supabase.from('addresses').update({ is_default: true }).eq('id', def.dataset.default);
      if (onError) { say(translateError(onError), 'error'); return; }
      again();
    }
  });
}
