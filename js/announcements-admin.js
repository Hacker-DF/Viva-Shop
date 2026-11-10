/**
 * announcements-admin.js — Annonces de l'accueil : publication, activation, suppression.
 * Réservé au gestionnaire produits et à l'administrateur principal (vérifié par la base).
 */
import { escapeHtml } from './ui.js';
import { supabase } from './supabase.js';
import { getSession, getRoleCodes, translateError } from './auth.js';

const ROLES = ['administrateur_principal', 'gestionnaire_produits', 'responsable_logistique'];
const NOT_ALLOWED = 'Action refusée : cette annonce ne vous appartient pas, ou vos droits ne sont pas encore à jour. Si le problème persiste, demandez à l’administrateur principal de vérifier votre rôle.';
let pending = null;

function annHtml(a) {
  return `
    <li class="admin-row">
      <div class="admin-row-main">
        <strong>${escapeHtml(a.title)}</strong>
        ${a.body ? `<p class="product-code">${escapeHtml(a.body)}</p>` : ''}
        <span class="product-code">${a.ends_at ? 'Jusqu’au ' + escapeHtml(new Date(a.ends_at).toLocaleDateString('fr-FR')) : 'Sans date de fin'}</span>
        <span class="status-badge" style="--c: ${a.is_active ? 'var(--status-green)' : 'var(--status-grey)'}">${a.is_active ? 'Active' : 'Masquée'}</span>
      </div>
      <div class="admin-actions wrap">
        <button class="btn btn-ghost btn-small" type="button" data-toggle="${a.id}" data-active="${a.is_active ? '1' : '0'}">${a.is_active ? 'Masquer' : 'Activer'}</button>
        <button class="btn btn-ghost btn-small" type="button" data-del="${a.id}">Supprimer</button>
      </div>
    </li>`;
}

export async function render(container) {
  const note = pending;
  pending = null;

  const session = await getSession();
  if (!session) { container.innerHTML = '<div class="alert alert-warn">Connectez-vous pour accéder à cette page.</div>'; return; }
  const codes = await getRoleCodes();
  if (!codes.some((c) => ROLES.includes(c))) { container.innerHTML = '<div class="alert alert-error">Accès réservé à l’équipe catalogue.</div>'; return; }

  const { data, error } = await supabase.from('announcements')
    .select('id, title, body, is_active, ends_at, created_at').order('created_at', { ascending: false }).limit(50);
  if (error) throw error;

  container.innerHTML = `
    <div class="admin-toolbar"><h1>Annonces</h1><a class="btn btn-ghost btn-small" href="#/admin">Produits</a></div>
    <div id="ann-msg" class="alert" role="status" hidden></div>
    <form id="new-ann" class="card admin-form" novalidate>
      <h2>Nouvelle annonce</h2>
      <label>Titre<input name="title" maxlength="120" required></label>
      <label>Texte (facultatif)<textarea name="body" rows="3" maxlength="1000"></textarea></label>
      <label>Affichée jusqu’au (facultatif)<input name="ends" type="date"></label>
      <button class="btn btn-primary btn-block" type="submit">Publier l’annonce</button>
    </form>
    <ul class="admin-list" id="ann-list">${data.map(annHtml).join('') || '<li class="empty">Aucune annonce pour le moment.</li>'}</ul>`;

  const msg = container.querySelector('#ann-msg');
  const say = (text, type) => { msg.className = `alert alert-${type}`; msg.textContent = text; msg.hidden = false; };
  if (note) say(note.text, note.type);
  const done = (text) => { pending = { text, type: 'success' }; render(container); };

  container.querySelector('#new-ann').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get('title')).trim();
    const body = String(fd.get('body')).trim();
    const ends = String(fd.get('ends'));
    if (title.length < 3) { say('Le titre doit comporter au moins 3 caractères.', 'error'); return; }
    const { error: insError } = await supabase.from('announcements').insert({
      title, body: body || null, ends_at: ends ? new Date(`${ends}T23:59:59`).toISOString() : null,
    });
    if (insError) { say(translateError(insError), 'error'); return; }
    done('Annonce publiée.');
  });

  container.querySelector('#ann-list').addEventListener('click', async (e) => {
    const toggle = e.target.closest('button[data-toggle]');
    const del = e.target.closest('button[data-del]');
    if (toggle) {
      const { data: changed, error: upError } = await supabase.from('announcements')
        .update({ is_active: toggle.dataset.active !== '1' }).eq('id', toggle.dataset.toggle).select('id');
      if (upError) { say(translateError(upError), 'error'); return; }
      if (!changed?.length) { say(NOT_ALLOWED, 'error'); return; }
      done('Annonce mise à jour.');
    } else if (del) {
      if (!window.confirm('Supprimer cette annonce ?')) return;
      const { data: removed, error: delError } = await supabase.from('announcements')
        .delete().eq('id', del.dataset.del).select('id');
      if (delError) { say(translateError(delError), 'error'); return; }
      if (!removed?.length) { say(NOT_ALLOWED, 'error'); return; }
      done('Annonce supprimée.');
    }
  });
}
