/*
 * Jeu « Robi » : un robot explorateur programmé en Python.
 *
 * Le terrain est une suite de colonnes vues de côté :
 *   sol[x]       hauteur du sol (en marches) de la colonne x
 *   objets[x]    "cle" ou "coffre"
 *   caisses[x]   nombre de caisses empilées sur la colonne x (elles bloquent le passage)
 *   panneaux[x]  valeur affichée par un panneau (nombre ou mot), lue avec lire_nombre() / lire_mot()
 * Robi part de la colonne depart, tourné vers la droite (dir = 1) ou la gauche (dir = -1).
 * But : prendre la clé (en passant dessus) puis ouvrir le coffre avec ouvrir().
 *
 * Version Pyodide : les commandes de Robi sont écrites en Python (py/robi.py), avec les mêmes règles
 * et les mêmes messages que la version Skulpt. Elles sont ajoutées aux fonctions de base de Python
 * (pas besoin d'import). Chaque commande est enregistrée comme un événement ; l'animation et la
 * vérification se font ensuite dans la page à partir de cet enregistrement (comme pour la tortue).
 *
 * Dépend de : engine.js (version Pyodide)
 */
(function (global) {
  "use strict";

  /* Générateur pseudo-aléatoire reproductible (pour tirer des terrains) */
  function hasard(graine) {
    var a = (graine >>> 0) || 1;
    var f = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.entier = function (min, max) { return min + Math.floor(f() * (max - min + 1)); };
    f.choix = function (liste) { return liste[Math.floor(f() * liste.length)]; };
    return f;
  }

  function copierMonde(m) {
    return {
      sol: m.sol.slice(),
      objets: Object.assign({}, m.objets || {}),
      caisses: Object.assign({}, m.caisses || {}),
      panneaux: Object.assign({}, m.panneaux || {}),
      depart: m.depart || 0,
      dir: m.dir || 1
    };
  }

  /* Commandes de Robi (définies dans py/robi.py) */
  var NOMS = ["avancer", "sauter", "demi_tour", "frapper", "ouvrir", "lire_nombre", "lire_mot",
    "hauteur_devant", "sur_coffre", "obstacle_devant"];

  /*
   * Exécute un programme sur un terrain.
   * Résout { ok, erreur, output, evenements, monde (départ), final: { x, dir, cle, ouvert } }.
   */
  function jouer(code, monde, autorisees) {
    var depart = copierMonde(monde);
    // « avancer » sans parenthèses : vérifié par engine.js (findMissingParens), comme dans les séries
    // autorisees : commandes permises dans ce niveau (null = toutes)
    return global.PyEngine.run(code, null, { robi: { monde: depart, autorisees: autorisees || null } }).then(function (r) {
      // r.robi est null si Python a été arrêté (temps dépassé) : Robi n'a alors rien fait
      var p = r.robi || { evenements: [], final: { x: depart.depart, dir: depart.dir, cle: false, ouvert: false } };
      return {
        ok: !r.error && p.final.ouvert,
        erreur: r.error,
        output: r.output,
        evenements: p.evenements,
        monde: depart,
        final: p.final
      };
    });
  }

  /* Lignes de code réelles (sans lignes vides ni commentaires). */
  function compterLignes(code) {
    var n = 0;
    String(code || "").split("\n").forEach(function (l) {
      var t = l.replace(/"[^"]*"|'[^']*'/g, '""').replace(/#.*$/, "").trim();
      if (!t) return;
      n++;
      // « if x: avancer() » sur une seule ligne compte comme 2 lignes (comme s'il était écrit normalement)
      if (/^(if|elif|else|for|while|def)\b[^:]*:\s*\S/.test(t)) n++;
      // plusieurs instructions séparées par « ; » : une ligne par instruction
      n += (t.replace(/;\s*$/, "").match(/;/g) || []).length;
    });
    return n;
  }

  global.Jeu = { jouer: jouer, hasard: hasard, compterLignes: compterLignes, commandes: NOMS, copierMonde: copierMonde };
  global.EXTRA_KNOWN_NAMES = (global.EXTRA_KNOWN_NAMES || []).concat(NOMS);
})(typeof window !== "undefined" ? window : globalThis);
