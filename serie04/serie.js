/*
 * Réglages de la série, version site web (sans Moodle).
 * Hors Moodle, le travail est enregistré dans le navigateur de l'élève.
 * Pas d'envoi des résultats : aucune base Neon ni clé ici, ce dossier est public.
 */
var SERIE_REGLAGES = {
  // Titre affiché en haut de la page et dans l'onglet du navigateur
  titre: "Série 04 – Faire évoluer les paramètres",

  // Identifiant de la série : sert à retrouver le travail dans le navigateur
  id: "serie04",

  // Fichier d'exercices
  exercices: "data/serie04.js",

  // Python utilisé : "pyodide" (le vrai Python) ou "skulpt" (l'ancienne version)
  python: "pyodide",

  // Pas de bouton « Envoyer mes résultats » sur le site public
  neon: null,

  // Lien en haut de la page (mettre null pour ne pas en afficher)
  tutoriel: null
};
