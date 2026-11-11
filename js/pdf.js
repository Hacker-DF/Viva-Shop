/**
 * pdf.js — Document PDF pro forma, avec le logo en filigrane.
 * La bibliothèque jsPDF est chargée à la demande, en version fixe.
 * Le document porte la mention « ne constitue pas une preuve de paiement confirmé ».
 */
import { APP_CONFIG } from './config.js';
import { formatFcfa } from './products.js';
import { METHODS, PAYMENT_STATUS } from './payments.js';

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

/** Bibliothèque QR chargée à la demande, en version fixe. */
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

/** Logo du site transformé en URL de données (pour l'intégrer au PDF). */
async function fetchDataUrl(path) {
  const response = await fetch(path);
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

/**
 * Génère et télécharge le pro forma d'une déclaration.
 * @param {object} decl  ligne de payment_declarations (avec products)
 * @param {object} profile  profil du client
 */
export async function downloadProForma(decl, profile) {
  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const logo = await fetchDataUrl('assets/logo-transparent.png');
  const watermark = await fetchDataUrl('assets/logo-watermark.png');

  // Code QR de vérification : le PDF reste valable sans lui
  let qr = null;
  if (decl.verify_token) {
    try {
      const QRLib = await loadQrLib();
      qr = await QRLib.toDataURL(`${window.location.origin}${window.location.pathname}#/verifier/${decl.verify_token}`, { margin: 1, width: 300 });
    } catch { qr = null; }
  }

  // Filigrane : logo très discret au centre de la page
  doc.addImage(watermark, 'PNG', 40, 85, 130, 130);

  // En-tête
  doc.addImage(logo, 'PNG', 15, 12, 22, 22);
  if (qr) {
    doc.addImage(qr, 'PNG', 170, 12, 25, 25);
    doc.setFontSize(7);
    doc.setTextColor(91, 101, 115);
    doc.text('Vérifier le statut', 182.5, 40, { align: 'center' });
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(11, 37, 69);
  doc.text('Viva Shop', 42, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(91, 101, 115);
  doc.text(APP_CONFIG.slogan, 42, 28);

  // Titre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(11, 37, 69);
  doc.text('DOCUMENT PRO FORMA', 15, 46);
  // Mention tant que le paiement n'est pas validé
  const validated = decl.status === 'paiement_confirme';
  if (!validated) {
    doc.setFontSize(9);
    doc.setTextColor(214, 40, 40);
    doc.setFont('helvetica', 'bold');
    doc.text('NE CONSTITUE PAS UNE PREUVE DE PAIEMENT CONFIRME.', 15, 52);
  }

  // Détails
  const rows = [
    ['Numéro du document', `PF-${decl.order_number}`],
    ['Date d\'émission', new Date(decl.created_at).toLocaleDateString('fr-FR')],
    ['Client', `${profile.first_name} ${profile.last_name} (@${profile.username})`],
    ['Numéro de commande', decl.order_number],
    ['Code produit', decl.products?.code || ''],
    ['Produit', decl.products?.name || ''],
    ['Variante', decl.variant || '-'],
    ['Quantité', String(decl.quantity)],
    ['Montant déclaré', formatFcfa(decl.amount)],
    ['Moyen de paiement', METHODS[decl.payment_method]?.label || decl.payment_method],
    ['Référence REF', decl.ref_code || '-'],
    ['Identifiant TXN', decl.txn_id || '-'],
    ['Statut', PAYMENT_STATUS[decl.status]?.label || decl.status],
  ];
  let y = 64;
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(11, 37, 69);
    doc.text(label, 15, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 33, 61);
    doc.text(String(value), 75, y);
    doc.setDrawColor(227, 231, 237);
    doc.line(15, y + 2, 195, y + 2);
    y += 9;
  });

  // Tampon de validation : signé par l'administration, avec la date de validation
  if (validated) {
    const day = new Date(decl.verified_at || Date.now()).toLocaleDateString('fr-FR');
    const cx = 150, cy = 232, r = 24;
    doc.setDrawColor(11, 37, 69);
    doc.setLineWidth(0.8);
    doc.circle(cx, cy, r, 'S');
    doc.setLineWidth(0.3);
    doc.circle(cx, cy, r - 2.5, 'S');
    doc.setTextColor(11, 37, 69);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('VIVA SHOP', cx, cy - 8, { align: 'center' });
    doc.text('ADMINISTRATION', cx, cy - 4, { align: 'center' });
    doc.setFontSize(7);
    doc.text('VALIDE LE', cx, cy + 1, { align: 'center' });
    doc.setFontSize(8);
    doc.text(day, cx, cy + 5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Signature :', 105, cy + 22, { align: 'right' });
    doc.setDrawColor(91, 101, 115);
    doc.line(108, cy + 22, 190, cy + 22);
    doc.setTextColor(91, 101, 115);
    doc.setFontSize(7);
    doc.text('Administration Viva Shop', 149, cy + 27, { align: 'center' });
  }

  doc.save(`pro-forma-${decl.order_number}.pdf`);
}
