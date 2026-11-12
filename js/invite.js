/**
 * invite.js — Inviter un ami : WhatsApp, Facebook, X, Instagram, TikTok, autre moyen, ou copier le lien.
 * Instagram et TikTok n'acceptent pas de lien direct depuis un site : le lien est copié,
 * et le menu de partage du téléphone est proposé si disponible.
 */
import { escapeHtml } from './ui.js';
import { t } from './i18n.js';

export function renderInvite(container, head) {
  const url = `${window.location.origin}/`;
  container.innerHTML = `${head}
    <section class="card">
      <p class="hint">${escapeHtml(t('inv.hint'))}</p>
      <p class="field-line"><strong id="inv-url">${escapeHtml(url)}</strong></p>
      <div class="invite-grid">
        <button type="button" class="invite-btn" data-share="whatsapp">WhatsApp</button>
        <button type="button" class="invite-btn" data-share="facebook">Facebook</button>
        <button type="button" class="invite-btn" data-share="twitter">X (Twitter)</button>
        <button type="button" class="invite-btn" data-share="instagram">Instagram</button>
        <button type="button" class="invite-btn" data-share="tiktok">TikTok</button>
        <button type="button" class="invite-btn" data-share="other">${escapeHtml(t('inv.other'))}</button>
      </div>
      <button id="inv-copy" class="btn btn-ghost btn-block" type="button">${escapeHtml(t('inv.copy'))}</button>
      <p id="inv-msg" class="alert" role="status" hidden></p>
    </section>`;

  // Un seul écouteur par zone : il lit toujours l'adresse et le texte à jour
  if (container.dataset.inviteBound) return;
  container.dataset.inviteBound = '1';

  const show = (text, type = 'success') => {
    const m = container.querySelector('#inv-msg');
    m.className = `alert alert-${type}`;
    m.textContent = text;
    m.hidden = false;
  };

  const copyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = url;
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    }
  };

  const nativeShare = async (data) => {
    if (!navigator.share) return false;
    try { await navigator.share(data); return true; } catch { return false; }
  };

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-share], #inv-copy');
    if (!btn) return;
    const url = `${window.location.origin}/`;
    const text = t('inv.text');
    const kind = btn.dataset.share;

    if (btn.id === 'inv-copy') {
      const ok = await copyLink(url);
      return show(ok ? t('inv.copied') : t('inv.copy_fail'), ok ? 'success' : 'error');
    }
    if (kind === 'instagram' || kind === 'tiktok') {
      const ok = await copyLink(url);
      show(ok ? t('inv.social_hint') : t('inv.copy_fail'), ok ? 'success' : 'error');
      await nativeShare({ title: 'Viva Shop', text, url });
      return;
    }
    if (kind === 'other') {
      if (await nativeShare({ title: 'Viva Shop', text, url })) return;
      const ok = await copyLink(url);
      return show(ok ? t('inv.copied') : t('inv.copy_fail'), ok ? 'success' : 'error');
    }
    const links = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    };
    window.open(links[kind], '_blank', 'noopener');
  });
}
