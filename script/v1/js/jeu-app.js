/*
 * Page du jeu « Robi » : niveaux, guide, mémo, exécution animée, vérification, suivi SCORM.
 * Dépend de : CodeMirror, engine.js, scorm.js, jeu.js, jeu-dessin.js, data/…js (window.SERIE)
 *
 * Format d'un niveau (data) :
 *   { id, titre, objectif (HTML), maxLignes, commandes: ["avancer", …], indice (HTML),
 *     aleatoire: true/false, code (départ), monde: function (hasard) { return { sol, objets, caisses, panneaux, depart, dir } } }
 */
(function () {
  "use strict";

  var SERIE = window.SERIE;
  var NIVEAUX = SERIE.niveaux;
  var $ = function (id) { return document.getElementById(id); };
  var TIRAGES = 6;

  var DESCRIPTIONS = {
    avancer: "avancer() : Robi avance d'une case (il peut descendre une marche, pas en monter)",
    sauter: "sauter(n) : Robi saute sur la case suivante, qui doit être exactement n marches plus haut ; sauter() = sauter(1), qui marche aussi sur du plat",
    demi_tour: "demi_tour() : Robi se retourne",
    frapper: "frapper() : Robi casse une caisse juste devant lui",
    ouvrir: "ouvrir() : Robi ouvre le coffre quand il est dessus : il faut d'abord aller sur la case du coffre (avec avancer(), il lui faut aussi la clé)",
    lire_nombre: "lire_nombre() : donne le nombre écrit sur le panneau où se trouve Robi",
    lire_mot: "lire_mot() : donne le mot écrit sur le panneau où se trouve Robi",
    hauteur_devant: "hauteur_devant() : donne la hauteur de la marche devant Robi (0 si c'est plat, négatif si ça descend)",
    obstacle_devant: "obstacle_devant() : donne True s'il y a une caisse devant Robi, sinon False"
  };

  var state = null, current = null, docs = {}, editor = null, dessin = null;
  var mondeAffiche = null, busy = false, dirty = false, saveTimer = null, errorLine = null;

  /* ---------------- État et SCORM ---------------- */

  function score() {
    var n = NIVEAUX.filter(function (l) { return state.valide[l.id]; }).length;
    return { n: n, total: NIVEAUX.length, pct: Math.round((100 * n) / NIVEAUX.length) };
  }
  function saveNow() { clearTimeout(saveTimer); Scorm.save(state, state.courant); }
  function saveSoon() { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 1000); }
  function updateResult() {
    var s = score();
    Scorm.setResult(s.pct, s.n === s.total);
    $("progression").innerHTML = s.n === s.total
      ? "<strong>Tous les niveaux sont réussis !</strong>"
      : "Niveaux réussis : <strong>" + s.n + " sur " + s.total + "</strong>";
  }

  /* ---------------- Onglets des niveaux ---------------- */

  function buildTabs() {
    var nav = $("onglets");
    nav.innerHTML = "";
    nav.setAttribute("role", "tablist");
    NIVEAUX.forEach(function (l, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "onglet";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", l.id === state.courant ? "true" : "false");
      b.textContent = "Niveau " + (i + 1);
      b.title = l.titre;
      if (state.valide[l.id]) {
        var c = document.createElement("span");
        c.className = "coche"; c.textContent = "✓"; c.setAttribute("aria-label", "réussi");
        b.appendChild(c);
      }
      b.addEventListener("click", function () { if (!busy) show(l.id); });
      nav.appendChild(b);
    });
  }

  /* ---------------- Affichage d'un niveau ---------------- */

  function graine() { return Math.floor(Math.random() * 1e9) + 1; }

  function nouveauTerrain() {
    mondeAffiche = current.monde(Jeu.hasard(graine()));
    dessin.afficher(mondeAffiche);
  }

  function show(id) {
    current = NIVEAUX.find(function (l) { return l.id === id; }) || NIVEAUX[0];
    state.courant = current.id;
    var num = NIVEAUX.indexOf(current) + 1;
    buildTabs();
    $("titre-niveau").textContent = "Niveau " + num + " – " + current.titre;
    $("objectif").innerHTML = current.objectif;
    $("contrainte").textContent = "Contrainte : votre programme doit tenir en " + current.maxLignes +
      " lignes au maximum (les lignes vides et les commentaires ne comptent pas).";
    var ul = $("commandes");
    ul.innerHTML = "";
    (current.commandes || []).forEach(function (c) {
      var li = document.createElement("li");
      var parts = DESCRIPTIONS[c].split(" : ");
      var code = document.createElement("code");
      code.textContent = parts[0];
      li.appendChild(code);
      li.appendChild(document.createTextNode(" : " + parts.slice(1).join(" : ")));
      ul.appendChild(li);
    });
    $("indice").hidden = true;
    $("indice").innerHTML = current.indice || "";
    $("btn-indice").hidden = !current.indice;
    $("btn-terrain").hidden = !current.aleatoire;

    if (!docs[current.id]) {
      var code = state.code[current.id] != null ? state.code[current.id] : (current.code || "");
      docs[current.id] = CodeMirror.Doc(code, "python");
    }
    editor.swapDoc(docs[current.id]);
    clearError();
    hideConsole();
    renderCriteria(null);
    nouveauTerrain();
    editor.focus();
    saveSoon();
  }

  /* ---------------- Console ---------------- */

  function hideConsole() {
    var c = $("console");
    c.className = "console vide";
    c.textContent = "Ce que votre programme affiche avec print(), les messages de Robi et les erreurs apparaissent ici.";
  }
  function showText(text, classe) {
    var c = $("console");
    c.className = "console" + (classe ? " " + classe : "");
    c.textContent = text;
    c.scrollTop = c.scrollHeight;
  }
  function showError(err) {
    showText(err.message, "erreur");
    if (err.line && err.line <= editor.lineCount()) {
      errorLine = err.line - 1;
      editor.addLineClass(errorLine, "background", "ligne-erreur");
    }
  }
  function clearError() {
    if (errorLine !== null) { editor.removeLineClass(errorLine, "background", "ligne-erreur"); errorLine = null; }
  }

  /* ---------------- Exécution ---------------- */

  var queue = Promise.resolve();
  function exclusive(task) {
    queue = queue.then(function () { setBusy(true); return task(); })
      .catch(function (e) { console.error(e); showText("Erreur interne : " + e.message, "erreur"); })
      .then(function () { setBusy(false); });
    return queue;
  }
  function setBusy(b) {
    busy = b;
    ["btn-executer", "btn-verifier", "btn-recommencer", "btn-terrain"].forEach(function (id) { if ($(id)) $(id).disabled = b; });
  }

  function vitesse() { var v = +$("vitesse").value; return v >= 11 ? 0 : v; }
  function showSpeed() {
    var v = +$("vitesse").value;
    $("vitesse-valeur").textContent = v >= 11 ? "instantanée" : v + (v === 1 ? " (la plus lente)" : v === 10 ? " (rapide)" : "");
  }

  function animer(r, apres) {
    $("btn-finir").hidden = false;
    dessin.rejouer(r.monde, r.evenements, { onDone: function () { $("btn-finir").hidden = true; if (apres) apres(); } });
  }

  function bilanPartie(r) {
    if (r.erreur) return { texte: r.erreur.message, classe: "erreur" };
    if (r.final.ouvert) return { texte: "Bravo, Robi a ouvert le coffre ! Cliquez sur « Vérifier » pour valider le niveau.", classe: "succes" };
    return {
      texte: "Le programme est terminé, mais le coffre n'est pas ouvert." +
        (r.final.cle ? " Robi a pourtant la clé." : " Robi n'a pas encore pris la clé."),
      classe: "erreur"
    };
  }

  function executer() {
    if (busy) return;
    var code = editor.getValue(), monde = mondeAffiche;
    clearError();
    hideConsole();
    exclusive(function () {
      return Jeu.jouer(code, monde).then(function (r) {
        var b = bilanPartie(r);
        var texte = (r.output ? r.output + (r.output.slice(-1) === "\n" ? "" : "\n") : "") + b.texte;
        animer(r, function () {
          showText(texte, b.classe === "erreur" ? "erreur" : "");
          if (r.erreur) showError({ message: texte, line: r.erreur.line });
        });
        if (!vitesse()) return;
        showText((r.output || "") + "Robi est en route…", "");
      });
    });
  }

  /* ---------------- Vérification ---------------- */

  function renderCriteria(res) {
    var list = $("liste-criteres"), bilan = $("bilan");
    list.innerHTML = "";
    if (!res) {
      bilan.hidden = !state.valide[current.id];
      bilan.className = "bilan juste";
      bilan.textContent = "Niveau déjà réussi. Vous pouvez encore améliorer votre programme et le vérifier.";
    } else {
      bilan.hidden = false;
      bilan.className = "bilan " + (res.ok ? "juste" : "faux");
      bilan.textContent = res.ok ? "Bravo, niveau réussi !" : "Pas encore : lisez les indications ci-dessous.";
    }
    var criteres = [
      { id: "coffre", label: current.aleatoire ? "Robi ouvre le coffre, quel que soit le terrain" : "Robi ouvre le coffre" },
      { id: "lignes", label: "Le programme tient en " + current.maxLignes + " lignes au maximum" }
    ];
    criteres.forEach(function (c) {
      var r = res ? res.resultats[c.id] : null;
      var li = document.createElement("li");
      li.className = "critere " + (r ? (r.ok ? "ok" : "ko") : "attente");
      var mark = document.createElement("span");
      mark.className = "marque";
      mark.textContent = r ? (r.ok ? "✓" : "✗") : "○";
      var label = document.createElement("span");
      label.className = "libelle";
      label.textContent = c.label;
      li.appendChild(mark); li.appendChild(label);
      if (r && !r.ok && r.message) {
        var ex = document.createElement("span");
        ex.className = "explication"; ex.textContent = r.message;
        li.appendChild(ex);
      }
      list.appendChild(li);
    });
  }

  function verifier() {
    if (busy) return;
    var niveau = current, code = editor.getValue();
    clearError();
    hideConsole();
    exclusive(function () {
      var n = niveau.aleatoire ? TIRAGES : 1;
      var mondes = [];
      // terrains tous différents (tant que c'est possible) : pas de « coup de chance » avec un programme écrit par cœur
      var cle = function (m) { return niveau.variante ? String(niveau.variante(m)) : JSON.stringify(m); };
      var vus = {};
      vus[cle(mondeAffiche)] = true;
      mondes.push(mondeAffiche);
      while (mondes.length < n) {
        var m = null;
        for (var essai = 0; essai < 200; essai++) {
          m = niveau.monde(Jeu.hasard(graine()));
          if (!vus[cle(m)]) break;
        }
        vus[cle(m)] = true;
        mondes.push(m);
      }
      var res = { resultats: {}, ok: false }, echec = null, derniere = null;
      var chain = Promise.resolve();
      mondes.forEach(function (m, k) {
        chain = chain.then(function () {
          if (echec) return;
          return Jeu.jouer(code, m).then(function (r) {
            derniere = r;
            if (!r.ok) echec = { r: r, k: k };
          });
        });
      });
      return chain.then(function () {
        var lignes = Jeu.compterLignes(code);
        res.resultats.lignes = { ok: lignes <= niveau.maxLignes,
          message: "Votre programme fait " + lignes + " lignes : il faut trouver une façon plus courte de l'écrire." };
        if (echec) {
          var b = bilanPartie(echec.r);
          res.resultats.coffre = { ok: false, message: (n > 1 && echec.k > 0 ? "Sur un autre terrain (tirage " + (echec.k + 1) + ") : " : "") + b.texte };
        } else {
          res.resultats.coffre = { ok: true };
        }
        res.ok = res.resultats.coffre.ok && res.resultats.lignes.ok;
        var montrer = echec ? echec.r : derniere;
        if (echec && echec.k > 0) { mondeAffiche = montrer.monde; }
        animer(montrer, function () {
          var b2 = bilanPartie(montrer);
          showText((montrer.output || "") + (res.ok ? "Niveau réussi !" : b2.texte), res.ok ? "" : (b2.classe === "erreur" ? "erreur" : ""));
          if (montrer.erreur) showError({ message: (montrer.output || "") + montrer.erreur.message, line: montrer.erreur.line });
        });
        state.essais[niveau.id] = (state.essais[niveau.id] || 0) + 1;
        if (res.ok && !state.valide[niveau.id]) state.valide[niveau.id] = true;
        Scorm.recordInteraction({
          id: niveau.id, description: "Niveau " + (NIVEAUX.indexOf(niveau) + 1) + " – essai " + state.essais[niveau.id],
          response: code, correct: res.ok
        });
        renderCriteria(res);
        buildTabs();
        updateResult();
        saveNow();
        Scorm.commit();
        dirty = false;
      });
    });
  }

  function recommencer() {
    if (busy) return;
    editor.setValue(current.code || "");
    clearError();
    hideConsole();
    showText("Code de départ remis. Ctrl+Z (ou Cmd+Z) pour revenir en arrière.", "vide");
    renderCriteria(null);
    nouveauTerrain();
  }

  /* ---------------- Fenêtres Guide et Mémo ---------------- */

  function fenetre(titre, html) {
    var fond = document.createElement("div");
    fond.className = "fenetre-fond";
    var f = document.createElement("div");
    f.className = "fenetre";
    f.setAttribute("role", "dialog");
    f.setAttribute("aria-modal", "true");
    f.setAttribute("aria-label", titre);
    var h = document.createElement("h2"); h.textContent = titre;
    var fermer = document.createElement("button");
    fermer.type = "button"; fermer.className = "bouton secondaire fermer"; fermer.textContent = "Fermer";
    var corps = document.createElement("div"); corps.className = "fenetre-corps"; corps.innerHTML = html;
    f.appendChild(fermer); f.appendChild(h); f.appendChild(corps);
    fond.appendChild(f);
    document.body.appendChild(fond);
    function close() { fond.remove(); document.removeEventListener("keydown", esc); editor.focus(); }
    function esc(e) { if (e.key === "Escape") close(); }
    fermer.addEventListener("click", close);
    fond.addEventListener("click", function (e) { if (e.target === fond) close(); });
    document.addEventListener("keydown", esc);
    fermer.focus();
  }

  /* ---------------- Plein écran (page) ---------------- */

  function boutonPleinEcran() {
    var root = document.documentElement;
    var demander = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!demander || !(document.fullscreenEnabled || document.webkitFullscreenEnabled)) return;
    var b = document.createElement("button");
    b.type = "button"; b.className = "plein-ecran";
    b.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d=""/></svg>';
    var icone = b.querySelector("path");
    document.body.appendChild(b);
    function actuel() { return document.fullscreenElement || document.webkitFullscreenElement; }
    function maj() {
      var on = !!actuel();
      b.title = on ? "Quitter le plein écran" : "Plein écran";
      b.setAttribute("aria-label", b.title);
      icone.setAttribute("d", on ? "M5 1v4H1M13 5H9V1M9 13V9h4M1 9h4v4" : "M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9");
      setTimeout(redessiner, 80);
    }
    b.addEventListener("click", function () {
      if (actuel()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else demander.call(root);
    });
    document.addEventListener("fullscreenchange", maj);
    document.addEventListener("webkitfullscreenchange", maj);
    maj();
  }

  function boutonScene() {
    var feuille = $("canvas-jeu").parentNode;
    var demander = feuille.requestFullscreen || feuille.webkitRequestFullscreen;
    if (!demander) return;
    var barre = document.createElement("div");
    barre.className = "outils-dessin";
    var b = document.createElement("button");
    b.type = "button"; b.className = "outil-dessin";
    b.title = "Agrandir la scène"; b.setAttribute("aria-label", b.title);
    b.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9"/></svg>';
    b.addEventListener("click", function () {
      var actuel = document.fullscreenElement || document.webkitFullscreenElement;
      if (actuel) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else demander.call(feuille);
    });
    barre.appendChild(b);
    feuille.appendChild(barre);
  }

  function redessiner() {
    if (!dessin || busy || dessin.animating()) return;
    if (dessin.evenements && dessin.evenements.length) dessin.rejouer(dessin.monde, dessin.evenements, {});
    else if (dessin.monde) dessin.afficher(dessin.monde);
  }

  /* ---------------- Démarrage ---------------- */

  function init() {
    state = Scorm.start(SERIE.id) || {};
    state.v = 1;
    state.code = state.code || {};
    state.valide = state.valide || {};
    state.essais = state.essais || {};
    if (!NIVEAUX.some(function (l) { return l.id === state.courant; })) state.courant = NIVEAUX[0].id;

    document.title = SERIE.titre;
    $("titre-serie").textContent = SERIE.titre;
    $("pied").textContent = Scorm.connected()
      ? "Votre progression est enregistrée automatiquement dans Moodle."
      : "Mode test hors Moodle : votre progression est enregistrée dans ce navigateur uniquement.";

    dessin = new DessinJeu($("canvas-jeu"), { getSpeed: vitesse });
    if (!(state.vitesse >= 1 && state.vitesse <= 11)) state.vitesse = 6;
    $("vitesse").value = state.vitesse;
    showSpeed();
    $("vitesse").addEventListener("input", function () { state.vitesse = +$("vitesse").value; showSpeed(); saveSoon(); });
    $("btn-finir").addEventListener("click", function () { dessin.finish(); });

    editor = CodeMirror($("editeur"), {
      value: "", mode: "python", lineNumbers: true, indentUnit: 4, tabSize: 4, matchBrackets: true,
      extraKeys: {
        "Tab": function (cm) { if (cm.somethingSelected()) cm.indentSelection("add"); else cm.replaceSelection("    ", "end"); },
        "Shift-Tab": function (cm) { cm.indentSelection("subtract"); },
        "Ctrl-Enter": executer, "Cmd-Enter": executer
      }
    });
    editor.on("change", function () {
      if (!current) return;
      state.code[current.id] = editor.getValue();
      clearError();
      saveSoon();
    });

    $("btn-executer").addEventListener("click", executer);
    $("btn-verifier").addEventListener("click", verifier);
    $("btn-recommencer").addEventListener("click", recommencer);
    $("btn-terrain").addEventListener("click", function () { if (!busy) { nouveauTerrain(); hideConsole(); } });
    $("btn-indice").addEventListener("click", function () { $("indice").hidden = !$("indice").hidden; });
    $("btn-guide").addEventListener("click", function () { fenetre("Guide de démarrage", SERIE.guide); });
    $("btn-memo").addEventListener("click", function () { fenetre("Mémo de programmation", SERIE.memo); });
    boutonPleinEcran();
    boutonScene();

    setInterval(function () { if (dirty) { saveNow(); Scorm.commit(); dirty = false; } }, 30000);
    var closed = false;
    function close() { if (closed) return; closed = true; saveNow(); Scorm.finish(); }
    window.addEventListener("pagehide", close);
    window.addEventListener("beforeunload", close);
    var t = null;
    window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(redessiner, 150); });

    updateResult();
    show(state.courant);
    // première visite : le guide s'ouvre tout seul
    if (!state.guideVu) { state.guideVu = true; fenetre("Guide de démarrage", SERIE.guide); saveSoon(); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
