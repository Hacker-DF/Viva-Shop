/**
 * support.js — Réclamations.
 * Client : « Signaler un problème » et suivi de ses demandes (render).
 * Équipe : liste, prise en charge et réponse (renderStaff).
 */
import { escapeHtml, icon } from './ui.js';
import { t } from './i18n.js';
import { supabase } from './supabase.js';
import { getSession, getRoleCodes, translateError } from './auth.js';

const STATUS = {
  ouverte: {
    get label() { return t('st.sup.ouverte'); },
    color: 'var(--status-red)',
  },
  en_cours: {
    get label() { return t('st.sup.en_cours'); },
    color: 'var(--status-orange)',
  },
  resolue: {
    get label() { return t('st.sup.resolue'); },
    color: 'var(--status-green)',
  },
};
const STAFF_ROLES = ['administrateur_principal', 'support_client', 'responsable_commandes'];

let pending = null;

function ticketHtml(t, staff) {
  const st = STATUS[t.status] || STATUS.ouverte;
  const who = staff && t.profiles ? `<span class="product-code">${escapeHtml(t.profiles.first_name)} ${escapeHtml(t.profiles.last_name)} (@${escapeHtml(t.profiles.username)})</span>` : '';
  return `
    <li class="admin-row">
      <div class="admin-row-main">
        <strong>${escapeHtml(t.subject)}</strong>
        ${who}
        <p class="product-code">${escapeHtml(t.message)}</p>
        ${t.reply ? `<p><em>Réponse : ${escapeHtml(t.reply)}</em></p>` : ''}
        <span class="status-badge" style="--c: ${st.color}">${escapeHtml(st.label)}</span>
      </div>
      ${staff ? `<div class="admin-actions wrap">
        ${t.status === 'ouverte' ? `<button class="btn btn-ghost btn-small" type="button" data-id="${t.id}" data-action="take">Prendre en charge</button>` : ''}
        ${t.status !== 'resolue' ? `<button class="btn btn-primary btn-small" type="button" data-id="${t.id}" data-action="resolve">Répondre et résoudre</button>` : ''}
      </div>` : ''}
    </li>`;
}

/** Vue client : signaler un problème et suivre ses demandes. */
export async function render(container) {
  const note = pending;
  pending = null;

  const session = await getSession();
  if (!session) {
    container.innerHTML = `<div class="alert alert-warn">${escapeHtml(t('sup.guest'))}</div><a class="btn btn-primary" href="#/connexion">${escapeHtml(t('common.login'))}</a>`;
    return;
  }
  const { data, error } = await supabase.from('support_tickets')
    .select('id, subject, message, status, reply, created_at').order('created_at', { ascending: false });
  if (error) throw error;

  container.innerHTML = `
    <a class="back" href="#/compte">← Mon compte</a>
    <h1>${escapeHtml(t('sup.title'))}</h1>
    <div id="ticket-msg" class="alert" role="status" hidden></div>
    <form id="ticket" class="card admin-form" novalidate>
      <label>${escapeHtml(t('sup.subject'))}<input name="subject" maxlength="120" required></label>
      <label>${escapeHtml(t('sup.message'))}<textarea name="message" rows="5" maxlength="2000" required></textarea></label>
      <p class="hint">${escapeHtml(t('sup.hint'))}</p>
      <button class="btn btn-primary btn-block" type="submit">${escapeHtml(t('sup.send'))}</button>
    </form>
    <h2 class="section-title">${escapeHtml(t('sup.mine'))}</h2>
    <ul class="admin-list">${data.map((t) => ticketHtml(t, false)).join('') || `<li class="empty">${escapeHtml(t('sup.none'))}</li>`}</ul>`;

  const msg = container.querySelector('#ticket-msg');
  const say = (text, type) => { msg.className = `alert alert-${type}`; msg.textContent = text; msg.hidden = false; };
  if (note) say(note.text, note.type);

  container.querySelector('#ticket').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const subject = String(fd.get('subject')).trim();
    const message = String(fd.get('message')).trim();
    if (subject.length < 3 || message.length < 5) { say(t('sup.minlen'), 'error'); return; }
    const { error: insError } = await supabase.from('support_tickets').insert({ user_id: session.user.id, subject, message });
    if (insError) { say(translateError(insError), 'error'); return; }
    pending = { text: t('sup.sent'), type: 'success' };
    render(container);
  });
}

/** Vue équipe : prise en charge et réponse aux réclamations. */
export async function renderStaff(container) {
  const session = await getSession();
  if (!session) { container.innerHTML = '<div class="alert alert-warn">Connectez-vous.</div>'; return; }
  const codes = await getRoleCodes();
  if (!codes.some((c) => STAFF_ROLES.includes(c))) {
    container.innerHTML = '<div class="alert alert-error">Accès réservé à l’équipe support.</div>';
    return;
  }

  const { data, error } = await supabase.from('support_tickets')
    .select('id, subject, message, status, reply, created_at, profiles(first_name, last_name, username)')
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw error;

  container.innerHTML = `
    <div class="admin-toolbar"><h1>Réclamations</h1></div>
    <div id="sup-msg" class="alert" role="status" hidden></div>
    <ul class="admin-list" id="tickets">
      ${data.map((t) => ticketHtml(t, true)).join('') || '<li class="empty">Aucune réclamation.</li>'}
    </ul>`;

  const msg = container.querySelector('#sup-msg');
  const say = (text, type) => { msg.className = `alert alert-${type}`; msg.textContent = text; msg.hidden = false; };

  container.querySelector('#tickets').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    let update;
    if (btn.dataset.action === 'take') {
      update = { status: 'en_cours' };
    } else {
      const reply = window.prompt('Votre réponse au client (obligatoire) :');
      if (!reply || !reply.trim()) return;
      update = { status: 'resolue', reply: reply.trim() };
    }
    const { error: upError } = await supabase.from('support_tickets').update(update).eq('id', btn.dataset.id);
    if (upError) { say(translateError(upError), 'error'); return; }
    renderStaff(container);
  });
}
