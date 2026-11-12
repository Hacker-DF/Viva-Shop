# Viva Shop — Frontend (PWA)

Votre passerelle entre la Chine et le Togo.

## Structure

```
index.html            Point d'entrée unique (SPA légère)
manifest.json         Installation PWA
service-worker.js     Cache statique + hors connexion
offline.html          Page hors connexion
assets/icons/         Icônes PWA
css/                  style.css (identité), components.css, responsive.css
js/config.js          Configuration (URL et clé anon Supabase)
js/app.js             Démarrage de l'application
js/router.js          Routes et navigation (5 menus)
js/ui.js              Utilitaires (échappement HTML, icônes, bannières)
js/supabase.js        Connexion Supabase + test de connexion
js/home.js            Page d'accueil
js/placeholder.js     Écrans des phases à venir
supabase/             Schéma SQL, politiques RLS, données de démo (phases 2 et 5)
```

## 1. Configurer Supabase

1. Créer un projet sur supabase.com.
2. Ouvrir **Settings → API**.
3. Copier **Project URL** et la clé **anon public** dans `js/config.js`.

⚠️ Ne jamais copier la clé `service_role` dans le frontend.

## 2. Tester sur téléphone (sans outils développeur)

1. Déployer le dossier sur Netlify (ou Vercel) : importer le dépôt GitHub ou glisser le dossier.
2. Ouvrir l'URL obtenue dans Chrome sur téléphone.
3. Vérifier :
   - l'en-tête et la navigation à 5 menus s'affichent ;
   - l'indicateur en haut à droite indique **En ligne** (ou **Démo** si la config n'est pas renseignée) ;
   - les 5 menus ouvrent chacun leur écran ;
   - le menu du navigateur propose **« Installer l'application »** ou **« Ajouter à l'écran d'accueil »**.
4. Après une mise à jour des fichiers statiques, incrémenter `CACHE_VERSION` dans `service-worker.js`.

## Phases

- **Phase 1 (en cours)** : fondations, identité visuelle, navigation, PWA, connexion Supabase.
- Phases 2 à 9 : voir le cahier des charges.
