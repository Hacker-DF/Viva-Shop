/**
 * category-guess.js — Suggestion automatique de la catégorie d'après le nom du produit.
 * La suggestion est affichée et modifiable : l'administrateur garde le dernier mot.
 */

/** Mots-clés par catégorie (slug). Le plus long mot trouvé dans le nom l'emporte. */
const KEYWORDS = {
  'informatique-accessoires': ['ordinateur', 'laptop', 'portable', 'pc', 'macbook', 'clavier', 'souris', 'ecran', 'moniteur',
    'disque dur', 'ssd', 'cle usb', 'imprimante', 'routeur', 'webcam', 'carte memoire', 'processeur', 'dell', 'lenovo', 'asus', 'hp', 'chargeur pc'],
  'telephones-tablettes': ['telephone', 'smartphone', 'iphone', 'samsung', 'tablette', 'tablet', 'ipad', 'xiaomi', 'huawei',
    'redmi', 'infinix', 'tecno', 'coque', 'etui', 'protection ecran', 'film de protection'],
  'electronique': ['ecouteurs', 'casque audio', 'enceinte', 'haut parleur', 'montre connectee', 'lampe led', 'camera', 'drone',
    'television', 'tv', 'radio', 'bluetooth', 'appareil photo', 'projecteur', 'powerbank', 'power bank'],
  'mode-vetements': ['vetement', 'chemise', 'robe', 'pantalon', 't-shirt', 'tshirt', 'jean', 'veste', 'chaussure', 'basket',
    'sac a main', 'sac', 'pagne', 'boubou', 'chapeau', 'lunettes', 'bijou', 'collier', 'bracelet', 'bague', 'ceinture', 'sandale', 'montre'],
  'beaute': ['maquillage', 'parfum', 'creme', 'soin', 'cheveux', 'lissant', 'perruque', 'rouge a levres', 'mascara', 'savon',
    'shampoing', 'brosse a cheveux', 'rasoir', 'epilateur'],
  'maison-decoration': ['decoration', 'tapis', 'rideau', 'coussin', 'vase', 'lampe de chevet', 'cadre', 'horloge', 'drap',
    'couverture', 'meuble', 'chaise', 'table basse', 'miroir', 'bougie', 'aspirateur'],
  'cuisine': ['cuisine', 'casserole', 'poele', 'couteau', 'mixeur', 'blender', 'batteur', 'bouilloire', 'cafetiere', 'grille pain',
    'marmite', 'assiette', 'bol', 'verre', 'ustensile', 'four', 'micro ondes', 'cocotte', 'thermos'],
  'automobile-moto': ['voiture', 'auto', 'moto', 'pneu', 'huile moteur', 'retroviseur', 'batterie voiture', 'casque moto',
    'gps voiture', 'phare', 'essuie glace', 'tapis de voiture', 'camion'],
  'sport': ['sport', 'fitness', 'haltere', 'tapis de yoga', 'yoga', 'ballon', 'velo', 'raquette', 'gourde', 'corde a sauter', 'running'],
  'enfants-jouets': ['jouet', 'enfant', 'bebe', 'poupee', 'peluche', 'lego', 'puzzle', 'puericulture', 'biberon', 'landau',
    'trottinette', 'voiture telecommandee', 'jeu de societe'],
  'materiel-professionnel': ['outil', 'perceuse', 'meuleuse', 'visseuse', 'scie', 'marteau', 'tournevis', 'echelle', 'compresseur',
    'soudure', 'multimetre', 'generateur', 'panneau solaire', 'atelier', 'chantier', 'pince'],
};

/** Minuscules, sans accents ni ponctuation superflue. */
function normalize(text) {
  return String(text || '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Identifiant de la catégorie suggérée pour ce nom (ou « Autres produits » à défaut). */
export function guessCategoryId(name, categories) {
  const text = ` ${normalize(name)} `;
  let best = null;
  let bestLen = 0;
  for (const [slug, words] of Object.entries(KEYWORDS)) {
    for (const word of words) {
      if (word.length > bestLen && text.includes(word)) {
        best = slug;
        bestLen = word.length;
      }
    }
  }
  const slug = best || 'autres';
  return categories.find((c) => c.slug === slug)?.id || null;
}

/**
 * Relie le champ « Nom » à la liste des catégories : la catégorie change au fil de la saisie,
 * tant que l'administrateur n'a pas choisi lui-même une catégorie.
 */
export function bindCategoryGuess(form, categories) {
  const nameInput = form.querySelector('input[name="name"]');
  const select = form.querySelector('select[name="category"]');
  if (!nameInput || !select) return;

  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.setAttribute('aria-live', 'polite');
  select.closest('label').after(hint);

  let manual = false;
  const label = (id) => categories.find((c) => c.id === id)?.name || '';

  nameInput.addEventListener('input', () => {
    if (manual) return;
    const id = guessCategoryId(nameInput.value, categories);
    if (!id) { hint.textContent = ''; return; }
    select.value = id;
    hint.textContent = nameInput.value.trim()
      ? `Catégorie suggérée : ${label(id)}. Vous pouvez la changer.`
      : '';
  });

  select.addEventListener('change', () => {
    manual = true;
    hint.textContent = select.value ? `Catégorie choisie : ${label(select.value)}.` : '';
  });
}
