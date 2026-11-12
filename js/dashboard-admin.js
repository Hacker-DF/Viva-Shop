/**
 * dashboard-admin.js — Tableau de bord de l'administrateur principal :
 * chiffres clés, répartition des paiements, réclamations, journal, clients et fiche client
 * (suspension incluse). Les droits sont vérifiés par la base.
 */
import { escapeHtml } from './ui.js';
import { supabase } from './supabase.js';
import { getSession, getRoleCodes, translateError } from './auth.js';
import { PAYMENT_STATUS } from './payments.js';
import { formatFcfa } from './products.js';
import { SHIP_STATUS } from './logistics-admin.js';
import { t } from './i18n.js';

/** Nombre de lignes d'une table, avec un filtre optionnel. */
async function countRows(table, filter = (q) => q) {
  const { count, error } = await filter(supabase.from(table).select('*', { count: 'exact', head: true }));
  if (error) throw error;
  return count || 0;
}

const kpi = (label, value) =>
  `<div class="kpi"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;

export async function render(container) {
  const session = await getSession();
  if (!session) {
    container.innerHTML = `<div class="alert alert-warn">${t('common.login_required')}</div>`;
    return;
  }
  const codes = await getRoleCodes();
  if (!codes.includes('administrateur_principal')) {
    container.innerHTML = `<div class="alert alert-error">${t('adm.principal_only')}</div>`;
    return;
  }

  // Adresse #/admin/tableau/ID : fiche d'un client
  const clientId = window.location.hash.split('/')[3];
  if (clientId) return renderClient(container, clientId);

  // Chiffres comptés depuis la dernière réinitialisation (les données ne sont pas supprimées)
  const { data: sinceData, error: sinceError } = await supabase.rpc('dashboard_since');
  if (sinceError) throw sinceError;
  const since = sinceData || '1970-01-01T00:00:00Z';

  const [clients, products, reservations, toVerify, confirmed, inTransit, delivered, openTickets,
    amounts, statuses, profiles, audit] = await Promise.all([
    countRows('profiles'),
    countRows('products', (q) => q.eq('is_archived', false)),
    countRows('reservations', (q) => q.gte('created_at', since)),
    countRows('payment_declarations', (q) => q.in('status', ['en_attente_verification', 'en_cours_verification']).gte('created_at', since)),
    countRows('payment_declarations', (q) => q.eq('status', 'paiement_confirme').gte('created_at', since)),
    countRows('shipments', (q) => q.neq('status', 'livre').gte('created_at', since)),
    countRows('shipments', (q) => q.eq('status', 'livre').gte('created_at', since)),
    countRows('support_tickets', (q) => q.neq('status', 'resolue').gte('created_at', since)),
    supabase.from('payment_declarations').select('amount, verified_at').eq('status', 'paiement_confirme').gte('created_at', since),
    supabase.from('payment_declarations').select('status').gte('created_at', since),
    supabase.from('profiles').select('id, username, first_name, last_name, phone, city, created_at, is_suspended')
      .order('created_at', { ascending: false }).limit(200),
    supabase.from('audit_logs').select('action, created_at').order('created_at', { ascending: false }).limit(15),
  ]);
  const shipStatuses = await supabase.from('shipments').select('status').gte('created_at', since);
  for (const r of [amounts, statuses, profiles, audit, shipStatuses]) if (r.error) throw r.error;

  const revenue = amounts.data.reduce((sum, r) => sum + r.amount, 0);
  const byStatus = {};
  statuses.data.forEach((r) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
  const maxCount = Math.max(1, ...Object.values(byStatus));

  // Données des graphiques
  const statusKeys = Object.keys(PAYMENT_STATUS);
  const statusLabels = statusKeys.map((k) => PAYMENT_STATUS[k].label);
  const statusCounts = statusKeys.map((k) => byStatus[k] || 0);
  const statusColors = statusKeys.map((k) => COLOR[PAYMENT_STATUS[k].color] || '#1E6FD9');

  const revenueByDay = {};
  amounts.data.forEach((r) => { if (r.verified_at) { const k = r.verified_at.slice(0, 10); revenueByDay[k] = (revenueByDay[k] || 0) + r.amount; } });
  const days = [];
  const revenueSeries = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
    revenueSeries.push(revenueByDay[d.toISOString().slice(0, 10)] || 0);
  }

  const shipByStatus = {};
  shipStatuses.data.forEach((r) => { shipByStatus[r.status] = (shipByStatus[r.status] || 0) + 1; });
  const shipKeys = Object.keys(SHIP_STATUS);
  const shipLabels = shipKeys.map((k) => SHIP_STATUS[k].label);
  const shipCounts = shipKeys.map((k) => shipByStatus[k] || 0);
  const shipColors = shipKeys.map((k) => COLOR[SHIP_STATUS[k].color] || '#1E6FD9');
  const chartData = { statusLabels, statusCounts, statusColors, days, revenue: revenueSeries, shipLabels, shipCounts, shipColors };

  container.innerHTML = `
    <div class="admin-toolbar"><h1>${t('pf.staff.dash')}</h1>
      <button id="reset-dash" class="btn btn-ghost btn-small" type="button">${t('db.reset_btn')}</button></div>
    <p class="hint">${t('db.since')} ${escapeHtml(new Date(since).toLocaleDateString('fr-FR'))}</p>

    <div class="kpis">
      ${kpi(t('db.clients'), clients)}
      ${kpi(t('db.products'), products)}
      ${kpi(t('db.reservations'), reservations)}
      ${kpi(t('db.to_verify'), toVerify)}
      ${kpi(t('db.confirmed'), confirmed)}
      ${kpi(t('db.revenue'), formatFcfa(revenue))}
      ${kpi(t('db.in_transit'), inTransit)}
      ${kpi(t('db.delivered'), delivered)}
      ${kpi(t('db.tickets'), openTickets)}
    </div>

    <section class="card">
      <h2>${t('db.chart_status')}</h2>
      <div class="chart-box"><canvas id="chart-status" aria-label="${t('db.chart_status')}"></canvas></div>
    </section>

    <section class="card">
      <h2>${t('db.chart_revenue')}</h2>
      <div class="chart-box"><canvas id="chart-revenue" aria-label="${t('db.revenue_aria')}"></canvas></div>
    </section>

    <section class="card">
      <h2>${t('db.chart_ship')}</h2>
      <div class="chart-box"><canvas id="chart-shipments" aria-label="${t('db.chart_ship')}"></canvas></div>
    </section>

    <section class="card">
      <h2>${t('db.actions')}</h2>
      <ul class="timeline">
        ${audit.data.map((a) => `<li><span>${escapeHtml(a.action.replace(/_/g, ' '))}</span>
          <small>${escapeHtml(new Date(a.created_at).toLocaleString('fr-FR'))}</small></li>`).join('')
          || `<li>${t('db.no_actions')}</li>`}
      </ul>
    </section>

    <section class="section">
      <h2 class="section-title">${t('db.clients')}</h2>
      <input id="client-search" class="search-input" type="search" placeholder="${t('db.search')}">
      <ul class="admin-list" id="client-list">
        ${profiles.data.map(clientRowHtml).join('') || `<li class="empty">${t('db.no_clients')}</li>`}
      </ul>
    </section>`;

  drawCharts(chartData);
  const search = container.querySelector('#client-search');
  search.addEventListener('input', () => {
    const term = search.value.trim().toLowerCase();
    container.querySelectorAll('#client-list .admin-row').forEach((row) => {
      row.hidden = term !== '' && !row.dataset.search.includes(term);
    });
  });
}

function clientRowHtml(p) {
  const name = `${p.first_name} ${p.last_name}`;
  return `
    <li class="admin-row" data-search="${escapeHtml(`${name} ${p.username}`.toLowerCase())}">
      <div class="admin-row-main">
        <strong>${escapeHtml(name)}${p.is_suspended ? ' · <span class="status-badge" style="--c: var(--status-red)">' + t('db.suspended') + '</span>' : ''}</strong>
        <span class="product-code">@${escapeHtml(p.username)} · ${escapeHtml(p.phone || '')}${p.city ? ' · ' + escapeHtml(p.city) : ''}</span>
        <span class="product-code">${t('db.registered')} ${escapeHtml(new Date(p.created_at).toLocaleDateString('fr-FR'))}</span>
      </div>
      <div class="admin-actions">
        <a class="btn btn-ghost btn-small" href="#/admin/tableau/${p.id}">${t('db.view')}</a>
      </div>
    </li>`;
}

/** Fiche client : déclarations, activité et suspension du compte. */
async function renderClient(container, id) {
  const { data: p, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!p) {
    container.innerHTML = `<div class="alert alert-warn">${t('db.not_found')}</div><a href="#/admin/tableau">${t('db.back')}</a>`;
    return;
  }

  const [decls, reservationCount, shipmentCount, ticketCount] = await Promise.all([
    supabase.from('payment_declarations')
      .select('order_number, amount, status, created_at, products(name)')
      .eq('user_id', id).order('created_at', { ascending: false }).limit(30),
    countRows('reservations', (q) => q.eq('user_id', id)),
    countRows('shipments', (q) => q.eq('user_id', id)),
    countRows('support_tickets', (q) => q.eq('user_id', id)),
  ]);
  if (decls.error) throw decls.error;

  container.innerHTML = `
    <a class="back" href="#/admin/tableau">${t('db.back')}</a>
    <div class="admin-toolbar"><h1>${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</h1></div>
    ${p.is_suspended ? `<div class="alert alert-error">${t('db.suspended_acc')}${p.suspension_reason ? ' : ' + escapeHtml(p.suspension_reason) : ''}. ${t('db.suspended_note')}</div>` : ''}
    <div id="client-msg" class="alert" role="status" hidden></div>

    <section class="card">
      <p>@${escapeHtml(p.username)} · ${escapeHtml(p.phone || '')}${p.city ? ' · ' + escapeHtml(p.city) : ''}</p>
      <div class="kpis">
        ${kpi('Réservations', reservationCount)}
        ${kpi('Colis', shipmentCount)}
        ${kpi('Demandes', ticketCount)}
      </div>
      <button id="suspend" class="btn ${p.is_suspended ? 'btn-primary' : 'btn-ghost'} btn-block" type="button">
        ${p.is_suspended ? t('db.reactivate') : t('db.suspend')}
      </button>
    </section>

    <section class="card">
      <h2>${t('db.write')}</h2>
      <p class="hint">${t('db.write_hint')}</p>
      <form id="send-msg" class="admin-form" novalidate>
        <label>${t('ann.title_label')}<input name="title" maxlength="120" required></label>
        <label>${t('db.message_label')}<textarea name="body" rows="3" maxlength="500"></textarea></label>
        <button class="btn btn-primary btn-block" type="submit">${t('db.send')}</button>
      </form>
    </section>

    <h2 class="section-title">${t('db.decls')}</h2>
    <ul class="admin-list">
      ${decls.data.map((d) => `
        <li class="admin-row">
          <div class="admin-row-main">
            <strong>${escapeHtml(d.order_number)} · ${escapeHtml(d.products?.name || '')}</strong>
            <span class="product-code">${escapeHtml(formatFcfa(d.amount))} · ${escapeHtml(PAYMENT_STATUS[d.status]?.label || d.status)}</span>
          </div>
        </li>`).join('') || `<li class="empty">${t('db.no_decls')}</li>`}
    </ul>`;

  container.querySelector('#send-msg').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget; // capturé avant l'attente : currentTarget devient nul après
    const fd = new FormData(form);
    const feedback = container.querySelector('#client-msg');
    const { error: sendError } = await supabase.rpc('send_user_message', {
      p_user: id, p_title: String(fd.get('title')).trim(), p_body: String(fd.get('body')).trim(),
    });
    feedback.className = sendError ? 'alert alert-error' : 'alert alert-success';
    feedback.textContent = sendError ? translateError(sendError) : t('db.sent');
    feedback.hidden = false;
    if (!sendError) form.reset();
  });

  const msg = container.querySelector('#client-msg');
  container.querySelector('#suspend').addEventListener('click', async () => {
    const suspend = !p.is_suspended;
    let reason = null;
    if (suspend) {
      reason = window.prompt(t('db.reason_prompt'));
      if (!reason || !reason.trim()) return;
    }
    const { error: rpcError } = await supabase.rpc('set_account_suspended', {
      p_user: id, p_suspended: suspend, p_reason: reason ? reason.trim() : null,
    });
    if (rpcError) {
      msg.className = 'alert alert-error';
      msg.textContent = translateError(rpcError);
      msg.hidden = false;
      return;
    }
    renderClient(container, id);
  });
}


/** Couleurs des variables CSS, traduites en couleurs lisibles par les graphiques. */
const COLOR = {
  'var(--status-red)': '#D62828', 'var(--status-green)': '#2A9D55', 'var(--status-grey)': '#6B7280',
  'var(--status-orange)': '#F77F00', 'var(--electric)': '#1E6FD9', 'var(--grey-600)': '#5B6573',
};

let chartLib = null;
function loadChartJs() {
  if (window.Chart) return Promise.resolve(window.Chart);
  chartLib ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js';
    script.onload = () => resolve(window.Chart);
    script.onerror = () => reject(new Error(t('db.chart_err')));
    document.head.appendChild(script);
  });
  return chartLib;
}

/** Dessine les trois graphiques du tableau de bord. */
async function drawCharts(d) {
  let Chart;
  try {
    Chart = await loadChartJs();
  } catch (err) {
    document.querySelectorAll('.chart-box').forEach((box) => { box.innerHTML = `<p class="hint">${escapeHtml(err.message)}</p>`; });
    return;
  }
  new Chart(document.getElementById('chart-status'), {
    type: 'bar',
    data: { labels: d.statusLabels, datasets: [{ data: d.statusCounts, backgroundColor: d.statusColors }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
  });
  new Chart(document.getElementById('chart-revenue'), {
    type: 'line',
    data: { labels: d.days, datasets: [{ label: 'FCFA', data: d.revenue, borderColor: '#1E6FD9', backgroundColor: 'rgba(30,111,217,.15)', fill: true, tension: 0.3 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  });
  new Chart(document.getElementById('chart-shipments'), {
    type: 'doughnut',
    data: { labels: d.shipLabels, datasets: [{ data: d.shipCounts, backgroundColor: d.shipColors }] },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
  });
}

/** Réinitialisation des statistiques : confirmation écrite, puis remise à zéro à partir de maintenant. */
document.addEventListener('click', async (e) => {
  if (e.target.id !== 'reset-dash') return;
  const typed = window.prompt(t('db.reset_prompt'));
  if (typed !== 'REINITIALISER') return;
  const { error } = await supabase.rpc('reset_dashboard');
  if (error) { window.alert(translateError(error)); return; }
  window.alert(t('db.reset_done'));
  window.location.reload();
});
