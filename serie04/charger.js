/*
 * Chargement des fichiers communs, d'après les réglages de serie.js (SERIE_REGLAGES).
 * Ce fichier est le même pour toutes les séries : on ne le change pas.
 * Version légère : ce paquet ne contient pas de copie des fichiers communs,
 * ils sont toujours chargés depuis GitHub (Skulpt : script/v1/, Pyodide : script/pyodide/v1/).
 * Les fichiers sont chargés un par un, dans l'ordre, puis le fichier d'exercices
 * (toujours celui du paquet) et enfin l'application.
 */
(function () {
  "use strict";

  var R = window.SERIE_REGLAGES || {};
  var GITHUB = "https://scormcdg.github.io/python/script/";
  var SKULPT = R.python === "skulpt";
  // R.commun (facultatif) : autre adresse des fichiers communs (tests)
  window.COMMUN = R.commun || (SKULPT ? GITHUB + "v1/" : GITHUB + "pyodide/v1/");
  window.EXERCICES = R.exercices || "data/exercices.js";
  if (R.titre) document.title = R.titre;

  // Titre et lien du tutoriel dans l'en-tête
  function entete() {
    var h = document.getElementById("titre-serie");
    if (h && R.titre && !h.textContent) h.textContent = R.titre;
    var a = document.getElementById("lien-tutoriel");
    if (a && R.tutoriel && R.tutoriel.lien) {
      a.href = R.tutoriel.lien;
      a.textContent = R.tutoriel.texte || "Tutoriel";
      a.hidden = false;
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", entete); else entete();

  var STYLES = ["vendor/codemirror/codemirror.css", "css/style.css"];
  var SCRIPTS = (SKULPT ? ["vendor/skulpt/skulpt.min.js", "vendor/skulpt/skulpt-stdlib.js"] : []).concat([
    "vendor/codemirror/codemirror.js",
    "vendor/codemirror/python.js",
    "vendor/codemirror/matchbrackets.js",
    "js/couleurs.js",
    "js/turtle.js",
    "js/engine.js",
    "js/canvas.js",
    "js/checker.js",
    "js/scorm.js"
  ]);
  var APP = "js/app.js";
  var DELAI = 10000;

  var remote = (window.COMMUN || "").replace(/\/?$/, "/");
  var base = remote && remote !== "/" ? remote : "";
  window.SOURCE_COMMUN = base ? "github" : "paquet";

  // Styles
  STYLES.forEach(function (f) {
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = base + f;
    document.head.appendChild(l);
  });

  function load(src, ok, ko) {
    var s = document.createElement("script");
    var done = false;
    var timer = setTimeout(function () { if (!done) { done = true; ko(); } }, DELAI);
    s.src = src;
    s.async = false;
    s.onload = function () { if (!done) { done = true; clearTimeout(timer); ok(); } };
    s.onerror = function () { if (!done) { done = true; clearTimeout(timer); ko(); } };
    document.head.appendChild(s);
  }

  function fail(src) {
    console.error("Impossible de charger " + src);
    document.addEventListener("DOMContentLoaded", show);
    show();
    function show() {
      if (!document.body) return;
      document.body.innerHTML =
        "<p style=\"font:16px system-ui;padding:24px;color:#7c2419\">L'exercice n'a pas pu se charger : " +
        "le site qui contient les fichiers de l'exercice ne répond pas (" + src + "). " +
        "Vérifiez votre connexion et rechargez la page ; si le problème continue, prévenez votre enseignant·e.</p>";
    }
  }

  function chain(list, prefix, i, finish, onFirstFail) {
    if (i >= list.length) { finish(); return; }
    var src = prefix + list[i];
    load(src, function () { chain(list, prefix, i + 1, finish, onFirstFail); }, function () {
      if (i === 0 && onFirstFail) onFirstFail();
      else fail(src);
    });
  }

  function then() {
    load(window.EXERCICES, function () {
      // le titre et l'identifiant de serie.js remplacent ceux du fichier d'exercices
      if (window.SERIE) {
        if (R.titre) window.SERIE.titre = R.titre;
        if (R.id) window.SERIE.id = R.id;
      }
      load(prefix + APP, function () {}, function () { fail(prefix + APP); });
    }, function () { fail(window.EXERCICES); });
  }

  var prefix = base;
  if (!window.SERIE_REGLAGES) { fail("serie.js (réglages de la série)"); return; }
  chain(SCRIPTS, prefix, 0, then, null);
})();
