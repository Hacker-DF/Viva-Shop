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

/** Logo du site transformé en URL de données (pour l'intégrer au PDF). */
async function logoDataUrl() {
  const response = await fetch('assets/logo.jpg');
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
  const logo = await logoDataUrl();

  // Filigrane : logo très discret au centre de la page
  doc.setGState(new doc.GState({ opacity: 0.08 }));
  doc.addImage(logo, 'JPEG', 40, 85, 130, 130);
  doc.setGState(new doc.GState({ opacity: 1 }));

  // En-tête
  doc.addImage(logo, 'JPEG', 15, 12, 22, 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(11, 37, 69);
  doc.text('Viva Shop', 42, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(91, 101, 115);
  doc.text(APP_CONFIG.slogan, 42, 28);

  // Titre et mention obligatoire
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(11, 37, 69);
  doc.text('DOCUMENT PRO FORMA', 15, 46);
  doc.setFontSize(9);
  doc.setTextColor(214, 40, 40);
  doc.text('NE CONSTITUE PAS UNE PREUVE DE PAIEMENT CONFIRME.', 15, 52);

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

  // Pied de page
  doc.setFontSize(8);
  doc.setTextColor(91, 101, 115);
  doc.text(
    'Ce document est une demande de paiement établie à partir de votre déclaration. Il sera confirmé après vérification par un agent Viva Shop.',
    15, 280, { maxWidth: 180 },
  );

  doc.save(`pro-forma-${decl.order_number}.pdf`);
}
