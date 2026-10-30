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
 * Les commandes sont ajoutées aux fonctions de base de Python (pas besoin d'import).
 * Chaque commande est enregistrée comme un événement ; l'animation et la vérification
 * se font ensuite à partir de cet enregistrement (comme pour la tortue).
 *
 * Dépend de : skulpt, engine.js
 */
(function (global) {
  "use strict";

  var MAX_ACTIONS = 3000;

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

  /* Partie en cours (une seule à la fois) */
  var partie = null;

  function nouvellePartie(monde) {
    var m = copierMonde(monde);
    partie = {
      monde: m,
      x: m.depart,
      dir: m.dir,
      cle: false,
      ouvert: false,
      evenements: [],
      actions: 0
    };
    return partie;
  }

  function Echec(message) {
    // Erreur du jeu : arrête le programme avec un message pour l'élève
    var e = new global.Sk.builtin.RuntimeError("Robi " + message);
    e.$jeu = true;
    return e;
  }

  function noter(ev) {
    partie.actions++;
    if (partie.actions > MAX_ACTIONS) {
      throw Echec("a fait plus de " + MAX_ACTIONS + " actions : y a-t-il une boucle qui ne s'arrête jamais ?");
    }
    partie.evenements.push(ev);
  }

  function devant() { return partie.x + partie.dir; }

  function dansTerrain(x) { return x >= 0 && x < partie.monde.sol.length; }

  function arrivee(x) {
    var m = partie.monde;
    if (m.objets[x] === "cle" && !partie.cle) {
      partie.cle = true;
      delete m.objets[x];
      noter({ t: "cle", x: x });
    }
  }

  function echouer(ev, message) {
    noter(Object.assign({ t: "echec", x: partie.x, message: "Robi " + message }, ev || {}));
    throw Echec(message);
  }

  /* ---------------- Commandes ---------------- */

  var commandes = {
    avancer: function () {
      var m = partie.monde, x = partie.x, nx = devant();
      if (!dansTerrain(nx)) echouer({ type: "bord" }, "est au bord du terrain : il ne peut pas avancer plus loin");
      if (m.caisses[nx] > 0) echouer({ type: "caisse" }, "est bloqué par une caisse");
      var dh = m.sol[nx] - m.sol[x];
      if (dh > 0) echouer({ type: "mur", hauteur: dh }, "est bloqué : il y a une marche de " + dh + " devant lui");
      noter({ t: "avancer", de: x, vers: nx, chute: -dh });
      partie.x = nx;
      arrivee(nx);
    },
    sauter: function (n) {
      var m = partie.monde, x = partie.x, nx = devant();
      if (!dansTerrain(nx)) echouer({ type: "bord" }, "est au bord du terrain : il ne peut pas sauter plus loin");
      if (m.caisses[nx] > 0) echouer({ type: "caisse" }, "s'est cogné contre une caisse");
      var dh = m.sol[nx] - m.sol[x];
      // sauter() sert uniquement à monter
      if (dh <= 0) echouer({ type: "rien", saut: n }, "n'a pas de marche à sauter devant lui : la case suivante " +
        (dh === 0 ? "est à la même hauteur" : "est plus basse") + ", utilisez avancer()");
      if (n < dh) echouer({ type: "court", hauteur: dh, saut: n }, "a sauté trop bas : la marche fait " + dh + " et il n'a sauté que " + n);
      if (n > dh) echouer({ type: "haut", hauteur: dh, saut: n }, "a sauté trop haut et s'est cogné : la marche ne fait que " + dh);
      noter({ t: "sauter", de: x, vers: nx, hauteur: n });
      partie.x = nx;
      arrivee(nx);
    },
    demi_tour: function () {
      partie.dir = -partie.dir;
      noter({ t: "tourner", dir: partie.dir });
    },
    frapper: function () {
      var m = partie.monde, nx = devant();
      if (!dansTerrain(nx) || !(m.caisses[nx] > 0)) echouer({ type: "vide" }, "a frappé dans le vide : il n'y a pas de caisse devant lui");
      m.caisses[nx]--;
      noter({ t: "frapper", x: nx, reste: m.caisses[nx] });
    },
    ouvrir: function () {
      var m = partie.monde, x = partie.x;
      if (m.objets[x] !== "coffre") echouer({ type: "pas-coffre" }, "n'est pas sur le coffre");
      if (!partie.cle) echouer({ type: "ferme" }, "ne peut pas ouvrir le coffre : il n'a pas encore la clé");
      partie.ouvert = true;
      noter({ t: "ouvrir", x: x });
    },
    lire_nombre: function () {
      var v = partie.monde.panneaux[partie.x];
      if (v === undefined) echouer({ type: "pas-panneau" }, "n'est pas sur un panneau");
      if (typeof v !== "number") echouer({ type: "mot" }, "lit un mot sur ce panneau, pas un nombre : utilisez lire_mot()");
      noter({ t: "lire", x: partie.x, valeur: v });
      return v;
    },
    lire_mot: function () {
      var v = partie.monde.panneaux[partie.x];
      if (v === undefined) echouer({ type: "pas-panneau" }, "n'est pas sur un panneau");
      if (typeof v !== "string") echouer({ type: "nombre" }, "lit un nombre sur ce panneau, pas un mot : utilisez lire_nombre()");
      noter({ t: "lire", x: partie.x, valeur: v });
      return v;
    },
    hauteur_devant: function () {
      var nx = devant();
      if (!dansTerrain(nx)) echouer({ type: "bord" }, "regarde au-delà du bord du terrain");
      var d = partie.monde.sol[nx] - partie.monde.sol[partie.x];
      noter({ t: "regarder", x: partie.x, valeur: d });
      return d;
    },
    sur_coffre: function () {
      var b = partie.monde.objets[partie.x] === "coffre";
      noter({ t: "regarder", x: partie.x, valeur: b ? "True" : "False" });
      return b;
    },
    obstacle_devant: function () {
      var nx = devant();
      var b = dansTerrain(nx) && partie.monde.caisses[nx] > 0;
      noter({ t: "regarder", x: partie.x, valeur: b ? "True" : "False" });
      return b;
    }
  };

  var ARITE = { avancer: 0, sauter: 1, demi_tour: 0, frapper: 0, ouvrir: 0, lire_nombre: 0, lire_mot: 0, hauteur_devant: 0, obstacle_devant: 0, sur_coffre: 0 };
  var NOMS = Object.keys(commandes);

  /* Ajoute les commandes aux fonctions de base de Skulpt (une fois). */
  var installe = false;
  function installer() {
    if (installe) return;
    var Sk = global.Sk;
    var none = Sk.builtin.none.none$;
    NOMS.forEach(function (nom) {
      var max = ARITE[nom];
      Sk.builtins[nom] = new Sk.builtin.func(function () {
        var args = Array.prototype.slice.call(arguments);
        if (args.length > max) {
          throw new Sk.builtin.TypeError(nom + "() " + (max === 0
            ? "s'écrit sans rien entre les parenthèses, mais a reçu " + args.length + " valeur" + (args.length > 1 ? "s" : "")
            : "accepte au maximum " + max + " valeur entre les parenthèses, mais en a reçu " + args.length));
        }
        if (!partie) throw new Sk.builtin.RuntimeError("Robi n'est pas encore sur le terrain");
        var res;
        if (nom === "sauter") {
          var n = args.length ? Sk.ffi.remapToJs(args[0]) : 1;
          if (typeof n !== "number" || n !== Math.floor(n)) {
            throw new Sk.builtin.TypeError("sauter() attend un nombre entier, par exemple sauter(2)");
          }
          res = commandes.sauter(n);
        } else {
          res = commandes[nom]();
        }
        if (res === undefined) return none;
        if (typeof res === "boolean") return res ? Sk.builtin.bool.true$ : Sk.builtin.bool.false$;
        return Sk.ffi.remapToPy(res);
      });
    });
    installe = true;
  }

  /*
   * Exécute un programme sur un terrain.
   * Résout { ok, erreur, output, evenements, monde (départ), final: { x, dir, cle, ouvert } }.
   */
  function jouer(code, monde) {
    installer();
    var depart = copierMonde(monde);
    // « avancer » seul sur une ligne : Python ne dit rien, mais Robi ne fait rien non plus
    var lignes = String(code || "").split("\n");
    for (var i = 0; i < lignes.length; i++) {
      var m = /^\s*([a-z_]+)\s*(#.*)?$/.exec(lignes[i]);
      if (m && NOMS.indexOf(m[1]) >= 0) {
        return Promise.resolve({
          ok: false,
          erreur: { message: "Il manque les parenthèses : écrivez « " + m[1] + "() » et pas « " + m[1] + " » (ligne " + (i + 1) + ").", line: i + 1 },
          output: "", evenements: [], monde: depart,
          final: { x: depart.depart, dir: depart.dir, cle: false, ouvert: false }
        });
      }
    }
    nouvellePartie(monde);
    return global.PyEngine.run(code).then(function (r) {
      var p = partie;
      partie = null;
      return {
        ok: !r.error && p.ouvert,
        erreur: r.error,
        output: r.output,
        evenements: p.evenements,
        monde: depart,
        final: { x: p.x, dir: p.dir, cle: p.cle, ouvert: p.ouvert }
      };
    });
  }

  /* Lignes de code réelles (sans lignes vides ni commentaires). */
  function compterLignes(code) {
    return String(code || "").split("\n").filter(function (l) {
      var t = l.replace(/#.*$/, "").trim();
      return t.length > 0;
    }).length;
  }

  global.Jeu = { jouer: jouer, hasard: hasard, compterLignes: compterLignes, commandes: NOMS, copierMonde: copierMonde };
  global.EXTRA_KNOWN_NAMES = (global.EXTRA_KNOWN_NAMES || []).concat(NOMS);
})(typeof window !== "undefined" ? window : globalThis);
