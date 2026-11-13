/* Choix du thème clair ou sombre, avant l'affichage (fichier séparé pour la sécurité du site). */
try{document.documentElement.dataset.theme=localStorage.getItem("cct-theme")||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){}
