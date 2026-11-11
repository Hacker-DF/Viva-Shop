/**
 * home.js — Page d'accueil.
 * Visiteur : présentation, inscription et « Comment commander ».
 * Membre connecté : tableau de bord (raccourcis, collectes ouvertes, derniers paiements).
 */
import { escapeHtml, icon } from './ui.js';
import { APP_CONFIG } from './config.js';
import { getProfile } from './auth.js';
import { supabase } from './supabase.js';
import { productCardHtml } from './shop.js';
import { listMyDeclarations, PAYMENT_STATUS } from './payments.js';
import { formatFcfa, listProductImages } from './products.js';
import { t } from './i18n.js';

const ADVANTAGES = () => [
  { icon: 'shield', title: t('home.adv1.t'), text: t('home.adv1.x') },
  { icon: 'tag', title: t('home.adv2.t'), text: t('home.adv2.x') },
  { icon: 'truck', title: t('home.adv3.t'), text: t('home.adv3.x') },
  { icon: 'support', title: t('home.adv4.t'), text: t('home.adv4.x') },
];

const STEPS = () => [
  { title: t('home.step1.t'), text: t('home.step1.x') },
  { title: t('home.step2.t'), text: t('home.step2.x') },
  { title: t('home.step3.t'), text: t('home.step3.x') },
  { title: t('home.step4.t'), text: t('home.step4.x') },
  { title: t('home.step5.t'), text: t('home.step5.x') },
];

const TILES = () => [
  { href: '#/boutique', icon: 'store', label: t('home.tile.shop') },
  { href: '#/commandes', icon: 'credit-card', label: t('home.tile.pay') },
  { href: '#/favoris', icon: 'heart', label: t('home.tile.fav') },
  { href: '#/guide', icon: 'file-text', label: t('home.tile.guide') },
];

/** Lien WhatsApp direct vers un assistant (numéro sans le signe +). */
const waLink = (phone) => `https://wa.me/${phone.replace(/\D/g, '')}`;

function helpSection() {
  return `
    <section class="section" aria-labelledby="help-title">
      <h2 class="section-title" id="help-title">${escapeHtml(t('help.title'))}</h2>
      <div class="card">
        <p>${escapeHtml(t('help.text'))}</p>
        <div class="hero-actions-dark">
          ${APP_CONFIG.whatsapp.assistants.map((a) => `
            <a class="btn btn-primary" href="${waLink(a.phone)}" target="_blank" rel="noopener">${icon('message')} ${escapeHtml(a.name)}</a>`).join('')}
        </div>
      </div>
    </section>`;
}

function footer() {
  return `
    <footer class="site-footer">
      © ${new Date().getFullYear()} ${escapeHtml(APP_CONFIG.name)} · ${escapeHtml(APP_CONFIG.slogan)}
      <div class="footer-links">
        <a href="${escapeHtml(APP_CONFIG.whatsapp.channelUrl)}" target="_blank" rel="noopener">${escapeHtml(t('footer.channel'))}</a> ·
        <a href="${escapeHtml(APP_CONFIG.whatsapp.communityUrl)}" target="_blank" rel="noopener">${escapeHtml(t('footer.community'))}</a>
      </div>
      <div class="footer-links">
        <a href="#/guide">${escapeHtml(t('footer.guide'))}</a> · <a href="#/confidentialite">${escapeHtml(t('footer.privacy'))}</a> · <a href="#/conditions">${escapeHtml(t('footer.terms'))}</a>
      </div>
    </footer>`;
}

/* ---------- Visiteur ---------- */
function guestPage() {
  return `
    <section class="hero" aria-labelledby="hero-title">
      <h1 id="hero-title">${t('home.hero.title')}</h1>
      <p>${escapeHtml(APP_CONFIG.slogan)}. ${escapeHtml(t('home.hero.text'))}</p>
      <div class="hero-actions">
        <a class="btn btn-gold" href="#/boutique">${icon('store')} ${escapeHtml(t('home.btn.shop'))}</a>
        <a class="btn btn-ghost" href="#/inscription">${icon('user')} ${escapeHtml(t('home.btn.signup'))}</a>
      </div>
    </section>

    <section class="section" aria-labelledby="how-title">
      <h2 class="section-title" id="how-title">${escapeHtml(t('home.how.title'))}</h2>
      <ol class="steps">
        ${STEPS().map((s) => `<li><strong>${escapeHtml(s.title)}</strong>${escapeHtml(s.text)}</li>`).join('')}
      </ol>
    </section>

    <section class="section" aria-labelledby="adv-title">
      <h2 class="section-title" id="adv-title">${escapeHtml(t('home.adv.title'))}</h2>
      <div class="grid grid-2">
        ${ADVANTAGES().map((a) => `
          <article class="card">
            <div class="card-icon">${icon(a.icon)}</div>
            <h3>${escapeHtml(a.title)}</h3>
            <p>${escapeHtml(a.text)}</p>
          </article>`).join('')}
      </div>
    </section>
    ${helpSection()}
    ${footer()}`;
}

/* ---------- Membre connecté : tableau de bord ---------- */
async function loadMemberData() {
  const [openRes, declarations] = await Promise.all([
    supabase.from('products')
      .select('id, code, name, price_ht, promo_price, main_image_url, status')
      .eq('status', 'collecte_ouverte').eq('is_archived', false)
      .order('created_at', { ascending: false }).limit(6),
    listMyDeclarations().catch(() => []),
  ]);
  const open = openRes.data || [];
  const images = await listProductImages(open.map((p) => p.id)).catch(() => ({}));
  return { open, images, declarations: declarations.slice(0, 3) };
}

function memberPage(profile, data) {
  return `
    <section class="member-hero" aria-labelledby="hello">
      <p class="member-hello">${escapeHtml(t('home.hello', { name: profile.first_name }))}</p>
      <h1 id="hello">${escapeHtml(t('home.what'))}</h1>
    </section>

    <nav class="tiles" aria-label="Raccourcis">
      ${TILES().map((t) => `
        <a class="tile" href="${t.href}">
          <span class="tile-icon">${icon(t.icon)}</span>
          <span>${escapeHtml(t.label)}</span>
        </a>`).join('')}
    </nav>

    <section class="section" aria-labelledby="open-title">
      <h2 class="section-title" id="open-title">${escapeHtml(t('home.open'))}</h2>
      ${data.open.length
        ? `<div class="product-grid">${data.open.map((p) => productCardHtml(p, data.images[p.id] || [])).join('')}</div>`
        : `<p class="empty">${escapeHtml(t('home.open.empty'))}</p>`}
    </section>

    <section class="section" aria-labelledby="pay-title">
      <h2 class="section-title" id="pay-title">${escapeHtml(t('home.lastpay'))}</h2>
      ${data.declarations.length
        ? `<ul class="admin-list">
            ${data.declarations.map((d) => {
              const st = PAYMENT_STATUS[d.status] || PAYMENT_STATUS.en_attente_verification;
              return `
              <li class="admin-row">
                <div class="admin-row-main">
                  <strong>${escapeHtml(d.products?.name || 'Produit')}</strong>
                  <span class="product-code">${escapeHtml(d.order_number)} · ${escapeHtml(formatFcfa(d.amount))}</span>
                </div>
                <span class="status-badge" style="--c: ${st.color}">${escapeHtml(st.label)}</span>
              </li>`;
            }).join('')}
          </ul>
          <p><a href="#/commandes">${escapeHtml(t('home.seeall'))}</a></p>`
        : `<p class="empty">${escapeHtml(t('home.lastpay.empty'))}</p>`}
    </section>

    ${helpSection()}
    ${footer()}`;
}

export async function render(container) {
  // Annonces actives (la base ne renvoie que celles de la période)
  let news = [];
  try {
    const { data } = await supabase.from('announcements').select('id, title, body').order('starts_at', { ascending: false }).limit(3);
    news = data || [];
  } catch { news = []; }
  const newsHtml = news.length
    ? `<section class="announcements">${news.map((a) => `<article class="announcement"><strong>${escapeHtml(a.title)}</strong>${a.body ? `<p>${escapeHtml(a.body)}</p>` : ''}</article>`).join('')}</section>`
    : '';
  // Profil absent (Supabase non configuré, hors connexion) : version visiteur
  let profile = null;
  try { profile = await getProfile(); } catch { profile = null; }

  if (!profile) {
    container.innerHTML = newsHtml + guestPage();
    return;
  }

  let data = { open: [], images: {}, declarations: [] };
  try { data = await loadMemberData(); } catch { /* le tableau de bord reste affiché sans ces données */ }
  container.innerHTML = newsHtml + memberPage(profile, data);
}
