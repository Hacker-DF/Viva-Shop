/**
 * pdf.js — Facture pro forma Viva Shop.
 * Mise en page inspirée des factures commerciales : en-tête, tableau des désignations,
 * total, montant en lettres, moyen de paiement, puis signature et tampon de validation.
 * Aucun texte en bas de page.
 */
import { APP_CONFIG } from './config.js';
import { formatFcfa } from './products.js';
import { METHODS } from './payments.js';

const NAVY = [11, 37, 69];
const ELECTRIC = [30, 111, 217];
const GOLD = [242, 183, 5];
const GREY = [242, 244, 247];
const DARK = [20, 33, 61];
const MUTED = [91, 101, 115];
const RED = [214, 40, 40];

/** Numéros affichés sur l'en-tête et le tampon : les deux assistants et le dépôt Mixx (Abdoul Fawad). */
const CONTACTS = [...APP_CONFIG.whatsapp.assistants.map((a) => a.phone), '+22892061192'];

let jsPdfPromise = null;
function loadJsPdf() {
  if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
  jsPdfPromise ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    script.onload = () => resolve(window.jspdf.jsPDF);
    script.onerror = () => reject(new Error('Impossible de charger le générateur PDF (connexion requise).'));
    document.head.appendChild(script);
  });
  return jsPdfPromise;
}

let qrPromise = null;
function loadQrLib() {
  if (window.QRCode) return Promise.resolve(window.QRCode);
  qrPromise ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
    script.onload = () => resolve(window.QRCode);
    script.onerror = () => reject(new Error('QR indisponible'));
    document.head.appendChild(script);
  });
  return qrPromise;
}

async function fetchDataUrl(path) {
  const response = await fetch(path);
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

/** 25 000 → « 25 000 » (espaces fines) pour le tableau. */
const fmtNum = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** +22892061192 → « +228 92 06 11 92 ». */
function fmtPhone(p) {
  const digits = p.replace(/\D/g, '');
  const local = digits.startsWith('228') ? digits.slice(3) : digits;
  return `+228 ${local.replace(/(\d{2})(?=\d)/g, '$1 ').trim()}`;
}

const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

function below100(n) {
  if (n < 20) return UNITS[n];
  if (n < 70) {
    const t = TENS[Math.floor(n / 10)];
    const u = n % 10;
    if (u === 0) return t;
    return u === 1 ? `${t} et un` : `${t}-${UNITS[u]}`;
  }
  if (n < 80) return n === 70 ? 'soixante-dix' : n === 71 ? 'soixante et onze' : `soixante-${UNITS[n - 60]}`;
  if (n === 80) return 'quatre-vingts';
  return `quatre-vingt-${UNITS[n - 80]}`;
}

function below1000(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let words = '';
  if (h === 1) words = 'cent';
  else if (h > 1) words = `${UNITS[h]} cent${r === 0 ? 's' : ''}`;
  if (r) words = words ? `${words} ${below100(r)}` : below100(r);
  return words;
}

/** Montant en lettres, en français : 250000 → « deux cent cinquante mille ». */
function amountInWords(n) {
  n = Math.round(Number(n) || 0);
  if (n === 0) return 'zéro';
  const parts = [];
  const millions = Math.floor(n / 1000000);
  const thousands = Math.floor((n % 1000000) / 1000);
  const rest = n % 1000;
  if (millions) parts.push(millions === 1 ? 'un million' : `${below1000(millions)} millions`);
  if (thousands) parts.push(thousands === 1 ? 'mille' : `${below1000(thousands)} mille`);
  if (rest) parts.push(below1000(rest));
  const text = parts.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Génère et télécharge la facture pro forma d'une déclaration.
 * @param {object} decl     ligne de payment_declarations (avec products)
 * @param {object} profile  profil du client
 */
export async function downloadProForma(decl, profile) {
  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const logo = await fetchDataUrl('assets/logo-transparent.png');
  const sealImg = await fetchDataUrl('assets/sceau-viva-shop.png');
  const signatureImg = await fetchDataUrl('assets/signature-admin.png');

  let qr = null;
  if (decl.verify_token) {
    try {
      const QRLib = await loadQrLib();
      qr = await QRLib.toDataURL(`${window.location.origin}${window.location.pathname}#/verifier/${decl.verify_token}`, { margin: 1, width: 300 });
    } catch { qr = null; }
  }

  const validated = decl.status === 'paiement_confirme';
  const docDate = decl.payment_date ? new Date(`${decl.payment_date}T00:00:00`) : new Date(decl.created_at);
  const validationDate = decl.verified_at ? new Date(decl.verified_at) : new Date();
  const dateText = (d) => d.toLocaleDateString('fr-FR');
  const unit = decl.quantity ? Math.round(decl.amount / decl.quantity) : decl.amount;

  // ---- En-tête : logo à gauche, coordonnées à droite ----
  doc.addImage(logo, 'PNG', 15, 12, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text('VIVA SHOP', 195, 20, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(APP_CONFIG.slogan, 195, 25, { align: 'right' });
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text('Djagble, à gauche du lycée Djagble', 195, 31, { align: 'right' });
  doc.text(CONTACTS.map(fmtPhone).join('   ·   '), 195, 36, { align: 'right' });

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.2);
  doc.line(15, 46, 195, 46);

  // ---- Titre, date, client ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text(`FACTURE PROFORMA N° VS-${decl.order_number.replace('CMD-', '')}`, 105, 56, { align: 'center' });
  if (!validated) {
    doc.setFontSize(8.5);
    doc.setTextColor(...RED);
    doc.text('EN ATTENTE DE VALIDATION', 105, 61, { align: 'center' });
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(`Date : ${dateText(docDate)}`, 195, 70, { align: 'right' });
  doc.text(`Client : ${profile.last_name.toUpperCase()} ${profile.first_name}`, 15, 70);

  // ---- Tableau des désignations ----
  const top = 80;
  const rowH = 24;
  doc.setFillColor(...NAVY);
  doc.rect(15, top, 180, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('DÉSIGNATIONS', 18, top + 6);
  doc.text('QTE', 132, top + 6, { align: 'center' });
  doc.text('P.U', 169, top + 6, { align: 'right' });
  doc.text('P.T', 192, top + 6, { align: 'right' });

  const rowTop = top + 9;
  doc.setDrawColor(200, 208, 220);
  doc.setLineWidth(0.3);
  doc.rect(15, rowTop, 180, rowH);
  doc.line(120, rowTop, 120, rowTop + rowH);
  doc.line(144, rowTop, 144, rowTop + rowH);
  doc.line(172, rowTop, 172, rowTop + rowH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(doc.splitTextToSize(decl.products?.name || 'Produit', 98), 18, rowTop + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  if (decl.variant) doc.text(`Variante : ${decl.variant}`, 18, rowTop + 15);
  doc.text(`Référence produit : ${decl.products?.code || ''}`, 18, rowTop + 20);

  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(String(decl.quantity), 132, rowTop + 12, { align: 'center' });
  doc.text(fmtNum(unit), 169, rowTop + 12, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text(fmtNum(decl.amount), 192, rowTop + 12, { align: 'right' });

  // Total
  const totalTop = rowTop + rowH;
  doc.setFillColor(...GREY);
  doc.rect(144, totalTop, 28, 10, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(172, totalTop, 23, 10, 'F');
  doc.rect(15, totalTop, 180, 10);
  doc.line(144, totalTop, 144, totalTop + 10);
  doc.line(172, totalTop, 172, totalTop + 10);
  doc.setTextColor(...NAVY);
  doc.setFontSize(9.5);
  doc.text('TOTAL', 148, totalTop + 6.5);
  doc.text(fmtNum(decl.amount), 192, totalTop + 6.5, { align: 'right' });

  // Montant en lettres
  const wordsY = totalTop + 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  const words = `Arrêtée la présente facture pro-forma à la somme de ${amountInWords(decl.amount)} francs CFA.`;
  doc.text(doc.splitTextToSize(words, 180), 15, wordsY);

  // Moyen de paiement et référence
  const payY = wordsY + 16;
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(`Moyen de paiement : ${METHODS[decl.payment_method]?.label || decl.payment_method}`, 15, payY);
  doc.text(`Référence de transaction : ${decl.txn_id || decl.ref_code || '-'}`, 15, payY + 6);

  // ---- Signature et tampon ----
  if (qr) doc.addImage(qr, 'PNG', 15, 210, 26, 26);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text('Pour Viva Shop', 150, 208, { align: 'center' });

  const cx = 150;
  const cy = 232;
  const r = 24;
  if (validated) {
    // Sceau officiel de l'administration
    const sealW = 40;
    const sealH = sealW * 0.968;
    doc.addImage(sealImg, 'PNG', cx - sealW / 2, cy - sealH / 2, sealW, sealH);

    // Date de validation, puis signature de l'administration
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...ELECTRIC);
    doc.text(`Validé le ${dateText(validationDate)}`, cx, cy + sealH / 2 + 4, { align: 'center' });
    const sigW = 30;
    const sigH = sigW * 0.799;
    doc.addImage(signatureImg, 'PNG', cx - sigW / 2, cy + sealH / 2 + 6, sigW, sigH);
  } else {
    doc.setDrawColor(...MUTED);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.circle(cx, cy, r, 'S');
    doc.setLineDashPattern([], 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text('Cachet après', cx, cy - 1, { align: 'center' });
    doc.text('validation', cx, cy + 3, { align: 'center' });
  }

  doc.save(`proforma-VS-${decl.order_number.replace('CMD-', '')}.pdf`);
}
