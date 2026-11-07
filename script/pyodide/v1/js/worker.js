/*
 * Python (Pyodide) exécuté à part de la page, dans un « worker » : une boucle infinie ne bloque pas la page,
 * et engine.js peut l'arrêter au bout de 5 secondes.
 * Ce fichier est chargé par engine.js (importScripts depuis un petit worker « blob »,
 * ce qui marche aussi quand les fichiers communs sont sur GitHub et le paquet dans Moodle).
 *
 * Messages reçus : { type: "init", base, pyodide (liste d'adresses, essayées dans l'ordre), tortue }, { type: "job", job } (job : voir py/moteur.py),
 *                  { type: "reponse", texte } (réponse à input())
 * Messages envoyés : { type: "pret" }, { type: "source", url } (adresse d'où Pyodide a été chargé), { type: "echec", texte }, { type: "out", texte, echo },
 *                    { type: "input", invite }, { type: "fin", resultat }
 */
/* global loadPyodide */
"use strict";

self.window = self; // couleurs.js écrit dans window.TURTLE_COLORS
var pyodide = null;
var file = Promise.resolve();
var decodeur = new TextDecoder();

/* Texte affiché par le programme (echo = question et réponse prévues de input(), hors print) */
self.ecrire = function (texte, echo) {
  self.postMessage({ type: "out", texte: String(texte), echo: !!echo });
};

/* input() : la réponse arrive par un message « reponse », traité tout de suite */
var attenteEntree = null;
self.demanderEntree = function (invite) {
  return new Promise(function (resolve) {
    attenteEntree = resolve;
    self.postMessage({ type: "input", invite: String(invite) });
  });
};

/* Couleur reconnue par le navigateur ? (comme CSS.supports dans la page) */
var ctxCouleur = null;
self.validerCouleur = function (c) {
  try {
    if (!ctxCouleur) ctxCouleur = new OffscreenCanvas(1, 1).getContext("2d");
  } catch (e) { return true; }
  if (!ctxCouleur) return true;
  ctxCouleur.fillStyle = "#010203";
  ctxCouleur.fillStyle = String(c);
  if (ctxCouleur.fillStyle !== "#010203") return true;
  ctxCouleur.fillStyle = "#040506";
  ctxCouleur.fillStyle = String(c);
  return ctxCouleur.fillStyle !== "#040506";
};

function texteDe(url) {
  return fetch(url).then(function (r) {
    if (!r.ok) throw new Error(url + " : " + r.status);
    return r.text();
  });
}

/*
 * Pyodide : on essaie les adresses dans l'ordre (jsDelivr, puis la copie sur GitHub).
 * Une adresse qui ne répond pas en DELAI_SONDE ms, ou dont le chargement échoue, est abandonnée pour la suivante.
 */
var DELAI_SONDE = 6000;
function sonder(url) {
  var ac = typeof AbortController === "function" ? new AbortController() : null;
  var minuterie = setTimeout(function () { if (ac) ac.abort(); }, DELAI_SONDE);
  return Promise.race([
    fetch(url + "pyodide.js", ac ? { signal: ac.signal } : {}),
    new Promise(function (_, refuser) { setTimeout(function () { refuser(new Error("pas de réponse")); }, DELAI_SONDE + 100); })
  ]).then(function (r) {
    clearTimeout(minuterie);
    if (!r.ok) throw new Error("erreur " + r.status);
  }, function (e) { clearTimeout(minuterie); throw e; });
}
function chargerPyodide(urls, i, erreurs) {
  var url = urls[i];
  return sonder(url).then(function () {
    if (typeof loadPyodide !== "function") importScripts(url + "pyodide.js");
    return loadPyodide({ indexURL: url });
  }).then(function (py) {
    self.postMessage({ type: "source", url: url });
    return py;
  }, function (e) {
    erreurs.push(url + " : " + String((e && e.message) || e));
    if (i + 1 < urls.length) return chargerPyodide(urls, i + 1, erreurs);
    throw new Error(erreurs.join(" ; "));
  });
}

function demarrer(m) {
  importScripts(m.base + "js/couleurs.js");
  var urls = [].concat(m.pyodide);
  return Promise.all([
    chargerPyodide(urls, 0, []),
    texteDe(m.base + "py/moteur.py"),
    texteDe(m.base + "py/turtle.py")
  ]).then(function (r) {
    pyodide = r[0];
    var ecrireSortie = function (buf) { self.ecrire(decodeur.decode(buf, { stream: true }), false); return buf.length; };
    pyodide.setStdout({ write: ecrireSortie });
    pyodide.setStderr({ write: ecrireSortie });
    pyodide.runPython(r[1], { filename: "<moteur>" });
    pyodide.globals.get("_installer")(r[2], !!m.tortue);
    // premier import de la tortue tout de suite, pour que la première exécution soit rapide
    if (m.tortue) pyodide.runPython("import turtle as _t\ndel _t");
    self.postMessage({ type: "pret" });
  });
}

function executer(job) {
  pyodide.globals.set("_job_texte", JSON.stringify(job));
  return pyodide.runPythonAsync("_lancer(_job_texte)").then(function (texte) {
    self.postMessage({ type: "fin", resultat: JSON.parse(texte) });
  });
}

self.onmessage = function (ev) {
  var m = ev.data;
  if (m.type === "reponse") {
    if (attenteEntree) { var r = attenteEntree; attenteEntree = null; r(String(m.texte)); }
    return;
  }
  file = file.then(function () {
    if (m.type === "init") return demarrer(m);
    if (m.type === "job") return executer(m.job);
  }).catch(function (e) {
    var texte = String(e && e.message || e);
    if (m.type === "init") self.postMessage({ type: "echec", texte: texte });
    else self.postMessage({ type: "fin", resultat: { erreur: { type: "Interne", msg: texte, ligne: null }, trop: false, tortue: null, fonctions: [] } });
  });
};
