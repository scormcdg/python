/*
 * Réglages du jeu Robi, version site web (sans Moodle).
 * Hors Moodle, la progression est enregistrée dans le navigateur de l'élève.
 * Pas d'envoi des résultats : aucune base Neon ni clé ici, ce dossier est public.
 */
var SERIE_REGLAGES = {
  // Titre affiché en haut de la page et dans l'onglet du navigateur
  titre: "Robi l'explorateur",

  // Identifiant : sert à retrouver les niveaux réussis dans le navigateur
  id: "robi-explorateur-v1",

  // Fichier des niveaux
  exercices: "data/robi.js",

  // Python utilisé : "pyodide" (le vrai Python) ou "skulpt" (l'ancienne version)
  python: "pyodide",

  // Pas de bouton « Envoyer mes résultats » sur le site public
  neon: null
};
