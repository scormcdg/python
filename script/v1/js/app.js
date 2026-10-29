/*
 * Application élève : onglets, éditeur, exécution, vérification, suivi SCORM.
 */
(function () {
  "use strict";

  var SERIE = window.SERIE;
  var $ = function (id) { return document.getElementById(id); };

  var state = null;          // { v, code:{}, valide:{}, essais:{}, courant }
  var current = null;        // exercice affiché
  var docs = {};             // documents CodeMirror (un par exercice : l'historique d'annulation est conservé)
  var editor = null;
  var busy = false;
  var dirty = false;
  var saveTimer = null;
  var errorLine = null;
  var drawing = null, figure = null;
  var figureCache = {};

  var graded = SERIE.exercices.filter(function (e) { return e.note; });

  /* ------------------------------------------------------------------ */
  /* État et SCORM                                                        */
  /* ------------------------------------------------------------------ */

  function score() {
    var n = graded.filter(function (e) { return state.valide[e.id]; }).length;
    return { n: n, total: graded.length, pct: Math.round((100 * n) / graded.length) };
  }

  function saveNow() {
    clearTimeout(saveTimer);
    Scorm.save(state, state.courant);
  }

  function saveSoon() {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 1000);
  }

  function updateResult() {
    if (!graded.length) {
      // bac à sable : pas de note, l'activité est simplement terminée
      Scorm.setCompleted();
      $("progression").textContent = "";
      return;
    }
    var s = score();
    Scorm.setResult(s.pct, s.n === s.total);
    $("progression").innerHTML = s.n === s.total
      ? "<strong>Tous les exercices sont validés.</strong>"
      : "Exercices validés : <strong>" + s.n + " sur " + s.total + "</strong>";
  }

  /* ------------------------------------------------------------------ */
  /* Onglets                                                              */
  /* ------------------------------------------------------------------ */

  function buildTabs() {
    var nav = $("onglets");
    nav.innerHTML = "";
    nav.setAttribute("role", "tablist");
    SERIE.exercices.forEach(function (ex) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "onglet";
      b.id = "onglet-" + ex.id;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", ex.id === state.courant ? "true" : "false");
      b.textContent = ex.titre.replace(/^Exercice /, "");
      b.title = ex.titre;
      if (state.valide[ex.id]) {
        var c = document.createElement("span");
        c.className = "coche";
        c.textContent = "✓";
        c.setAttribute("aria-label", "validé");
        b.appendChild(c);
      }
      b.addEventListener("click", function () { if (!busy) show(ex.id); });
      nav.appendChild(b);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Affichage d'un exercice                                              */
  /* ------------------------------------------------------------------ */

  function show(id) {
    current = SERIE.exercices.find(function (e) { return e.id === id; }) || SERIE.exercices[0];
    state.courant = current.id;
    buildTabs();

    $("titre-exercice").textContent = current.titre;
    $("texte-enonce").innerHTML = current.enonce;

    if (!docs[current.id]) {
      var code = state.code[current.id] != null ? state.code[current.id] : current.code;
      docs[current.id] = CodeMirror.Doc(code, "python");
    }
    editor.swapDoc(docs[current.id]);
    clearError();
    editor.focus();

    $("btn-verifier").hidden = !current.note;
    hideConsole();
    drawing.draw({ path: [], x: 0, y: 0, heading: 0 });
    $("btn-finir").hidden = true;
    renderCriteria(null);
    showFigure();
    saveSoon();
  }

  function showFigure() {
    var box = $("figure-attendue");
    if (!current.figure || !current.solutions.length) { box.hidden = true; return; }
    box.hidden = false;
    var ex = current;
    var paint = function (snap) {
      if (current === ex) figure.draw(snap);
    };
    if (figureCache[ex.id]) { paint(figureCache[ex.id]); return; }
    figure.draw({ path: [] });
    exclusive(function () {
      return PyEngine.run(ex.solutions[0]).then(function () {
        figureCache[ex.id] = TurtleRec.snapshot();
        paint(figureCache[ex.id]);
      });
    });
  }

  function renderCriteria(result) {
    var box = $("criteres"), list = $("liste-criteres"), bilan = $("bilan");
    if (!current.note) { box.hidden = true; return; }
    box.hidden = false;
    list.innerHTML = "";

    if (!result) {
      bilan.hidden = !state.valide[current.id];
      bilan.className = "bilan juste";
      bilan.textContent = "Exercice déjà validé. Vous pouvez encore modifier votre programme et le vérifier.";
    } else if (result.error) {
      bilan.hidden = false;
      bilan.className = "bilan faux";
      bilan.textContent = "Le programme s'arrête sur une erreur : corrigez-la, puis vérifiez à nouveau.";
    } else {
      bilan.hidden = false;
      bilan.className = "bilan " + (result.ok ? "juste" : "faux");
      var nOk = result.results.filter(function (r) { return r.ok; }).length;
      bilan.textContent = result.ok
        ? "Bravo, exercice validé !"
        : nOk + " critère(s) rempli(s) sur " + result.results.length + ". Lisez les indications ci-dessous.";
    }

    current.checks.forEach(function (c) {
      var r = result && !result.error ? result.results.find(function (x) { return x.id === c.id; }) : null;
      var li = document.createElement("li");
      li.className = "critere " + (r ? (r.ok ? "ok" : "ko") : "attente");
      var mark = document.createElement("span");
      mark.className = "marque";
      mark.textContent = r ? (r.ok ? "✓" : "✗") : "○";
      mark.setAttribute("aria-label", r ? (r.ok ? "réussi" : "pas encore") : "à vérifier");
      var label = document.createElement("span");
      label.className = "libelle";
      label.textContent = c.label;
      li.appendChild(mark);
      li.appendChild(label);
      if (r && !r.ok && r.message) {
        var ex = document.createElement("span");
        ex.className = "explication";
        ex.textContent = r.message;
        li.appendChild(ex);
      }
      list.appendChild(li);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Console et erreurs                                                   */
  /* ------------------------------------------------------------------ */

  var CONSOLE_ATTENTE = "Ce que votre programme affiche avec print() et les messages d'erreur apparaissent ici.";
  var CONSOLE_RIEN = "Le programme s'est exécuté sans rien afficher. Utilisez print() pour écrire ici.";

  function hideConsole() {
    var c = $("console");
    c.className = "console vide";
    c.textContent = CONSOLE_ATTENTE;
  }

  function showOutput(text) {
    var c = $("console");
    if (!text) {
      c.className = "console vide";
      c.textContent = CONSOLE_RIEN;
      return;
    }
    c.className = "console";
    c.textContent = text;
    c.scrollTop = c.scrollHeight;
  }

  function showError(err) {
    var c = $("console");
    c.className = "console erreur";
    c.textContent = err.message;
    if (err.line && err.line <= editor.lineCount()) {
      errorLine = err.line - 1;
      editor.addLineClass(errorLine, "background", "ligne-erreur");
    }
  }

  function clearError() {
    if (errorLine !== null) {
      editor.removeLineClass(errorLine, "background", "ligne-erreur");
      errorLine = null;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Exécution et vérification                                            */
  /* ------------------------------------------------------------------ */

  // Une seule exécution Python à la fois
  var queue = Promise.resolve();
  function exclusive(task) {
    queue = queue.then(function () {
      setBusy(true);
      return task();
    }).catch(function (e) {
      console.error(e);
      showError({ message: "Erreur interne : " + e.message });
    }).then(function () { setBusy(false); });
    return queue;
  }

  function setBusy(b) {
    busy = b;
    ["btn-executer", "btn-verifier", "btn-recommencer"].forEach(function (id) { $(id).disabled = b; });
  }

  /* Curseur : positions 1 à 10 = speed(1) à speed(10), position 11 = instantané (speed(0)). */
  function sliderSpeed() {
    var v = +$("vitesse").value;
    return v >= 11 ? 0 : v;
  }

  function showSpeed() {
    var v = +$("vitesse").value;
    $("vitesse-valeur").textContent = v >= 11 ? "instantanée" : v + (v === 1 ? " (la plus lente)" : v === 10 ? " (rapide)" : "");
  }

  function animate(snap) {
    $("btn-finir").hidden = false;
    drawing.draw(snap, { animate: true, onDone: function () { $("btn-finir").hidden = true; } });
  }

  /*
   * Bouton dans le coin de la feuille : met le dessin seul en plein écran.
   * Caché si le navigateur ou Moodle ne permet pas le plein écran.
   */
  /* ---------- Fichiers .py : ouvrir et enregistrer (bac à sable) ---------- */

  function boutonsFichiers() {
    var actions = document.querySelector(".actions");
    if (!actions) return;
    var nom = "programme.py";

    var entree = document.createElement("input");
    entree.type = "file";
    entree.accept = ".py,text/x-python,text/plain";
    entree.hidden = true;

    var ouvrir = document.createElement("button");
    ouvrir.type = "button";
    ouvrir.id = "btn-ouvrir";
    ouvrir.className = "bouton secondaire";
    ouvrir.textContent = "Ouvrir un .py";

    var enregistrer = document.createElement("button");
    enregistrer.type = "button";
    enregistrer.id = "btn-enregistrer";
    enregistrer.className = "bouton secondaire";
    enregistrer.textContent = "Enregistrer en .py";

    var ref = $("btn-recommencer");
    actions.insertBefore(entree, ref);
    actions.insertBefore(ouvrir, ref);
    actions.insertBefore(enregistrer, ref);

    ouvrir.addEventListener("click", function () { if (!busy) entree.click(); });
    entree.addEventListener("change", function () {
      var f = entree.files && entree.files[0];
      entree.value = "";
      if (!f) return;
      if (f.size > 500000) {
        showError({ message: "Ce fichier est trop grand (" + Math.round(f.size / 1000) + " ko) pour un programme Python." });
        return;
      }
      var lecteur = new FileReader();
      lecteur.onload = function () {
        nom = f.name;
        // setValue garde l'historique : Ctrl+Z revient au programme précédent
        editor.setValue(String(lecteur.result).replace(/\r\n?/g, "\n"));
        hideConsole();
        var c = $("console");
        c.className = "console vide";
        c.textContent = "Fichier « " + nom + " » ouvert. Ctrl+Z (ou Cmd+Z) pour revenir au programme précédent.";
      };
      lecteur.onerror = function () { showError({ message: "Impossible de lire le fichier « " + f.name + " »." }); };
      lecteur.readAsText(f, "utf-8");
    });

    enregistrer.addEventListener("click", function () {
      var texte = editor.getValue();
      if (!/\n$/.test(texte)) texte += "\n";
      var blob = new Blob([texte], { type: "text/x-python;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = /\.py$/i.test(nom) ? nom : nom + ".py";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    });
  }

  /* ---------- Bac à sable : l'éditeur et le dessin prennent toute la hauteur ---------- */

  function ajusterHauteurs() {
    var bas = $("pied") ? $("pied").offsetHeight : 0;
    var h = window.innerHeight;
    // éditeur : on laisse la place des boutons et de la console (à sa taille maximale)
    var cm = editor.getWrapperElement();
    var haut = cm.getBoundingClientRect().top + window.scrollY;
    var actions = document.querySelector(".actions");
    var reserve = (actions ? actions.offsetHeight + 24 : 80) + 30 + 180 + bas + 16;
    editor.setSize(null, Math.max(260, h - haut - reserve));
    // dessin : jusqu'en bas de l'écran, sous la feuille il reste le réglage de la vitesse
    var feuille = $("canvas-tortue").parentNode;
    var hautF = feuille.getBoundingClientRect().top + window.scrollY;
    var vitesse = document.querySelector(".vitesse");
    var reserveF = (vitesse ? vitesse.offsetHeight + 12 : 60) + bas + 24;
    feuille.style.setProperty("--hauteur-feuille", Math.max(300, h - hautF - reserveF) + "px");
    redessiner();
  }

  function modeBacASable() {
    document.body.classList.add("bac-a-sable");
    var t = null;
    function plusTard() { clearTimeout(t); t = setTimeout(ajusterHauteurs, 120); }
    window.addEventListener("resize", plusTard);
    document.addEventListener("fullscreenchange", plusTard);
    document.addEventListener("webkitfullscreenchange", plusTard);
    ajusterHauteurs();
  }

  /* ---------- Outils du dessin : zoom (− +), échelle, plein écran ---------- */

  var ZOOMS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];

  function redessiner() {
    if (!drawing || !drawing.last) return;
    if (drawing.animating()) animate(drawing.last);
    else drawing.draw(drawing.last);
  }

  function nombre(x) {
    var r = Math.round(x * 10) / 10;
    return String(r).replace(".", ",");
  }

  function afficherEchelle(unite, k) {
    var e = $("echelle");
    if (!e) return;
    var px = unite * k;
    e.textContent = "1 carreau = forward(" + unite + ") = " + nombre(px) + " pixel" + (px >= 2 ? "s" : "");
    e.title = "Zoom " + Math.round((state.zoom || 1) * 100) + " %";

  }

  function outilsDessin() {
    var feuille = $("canvas-tortue").parentNode;
    var barre = document.createElement("div");
    barre.className = "outils-dessin";
    feuille.appendChild(barre);
    var echelle = document.createElement("p");
    echelle.id = "echelle";
    echelle.className = "echelle";
    echelle.setAttribute("aria-live", "polite");
    feuille.appendChild(echelle);

    function boutonZoom(texte, titre, sens) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "outil-dessin";
      b.textContent = texte;
      b.title = titre;
      b.setAttribute("aria-label", titre);
      b.addEventListener("click", function () {
        var z = state.zoom || 1;
        var i = ZOOMS.indexOf(z);
        if (i < 0) i = ZOOMS.indexOf(1);
        i = Math.max(0, Math.min(ZOOMS.length - 1, i + sens));
        state.zoom = ZOOMS[i];
        majBoutons();
        redessiner();
        saveSoon();
      });
      barre.appendChild(b);
      return b;
    }
    var moins = boutonZoom("−", "Dézoomer", -1);
    var plus = boutonZoom("+", "Zoomer", +1);
    function majBoutons() {
      var z = state.zoom || 1;
      moins.disabled = z <= ZOOMS[0];
      plus.disabled = z >= ZOOMS[ZOOMS.length - 1];
    }
    majBoutons();
    boutonDessinPleinEcran(barre);
  }

  function boutonDessinPleinEcran(barre) {
    var feuille = $("canvas-tortue").parentNode;
    var demander = feuille.requestFullscreen || feuille.webkitRequestFullscreen;
    var permis = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    if (!demander || !permis) return;
    var AGRANDIR = "M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9";
    var REDUIRE = "M5 1v4H1M13 5H9V1M9 13V9h4M1 9h4v4";
    var b = document.createElement("button");
    b.type = "button";
    b.className = "outil-dessin dessin-plein-ecran";
    b.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d=""/></svg>';
    var icone = b.querySelector("path");
    barre.appendChild(b);
    function actuel() { return (document.fullscreenElement || document.webkitFullscreenElement) === feuille; }
    function maj() {
      var on = actuel();
      b.title = on ? "Quitter le plein écran" : "Dessin en plein écran";
      b.setAttribute("aria-label", b.title);
      icone.setAttribute("d", on ? REDUIRE : AGRANDIR);
      // la feuille change de taille : on redessine (en reprenant l'animation si elle tournait)
      setTimeout(redessiner, 80);
    }
    b.addEventListener("click", function () {
      if (actuel()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else demander.call(feuille);
    });
    document.addEventListener("fullscreenchange", maj);
    document.addEventListener("webkitfullscreenchange", maj);
    b.title = "Dessin en plein écran";
    b.setAttribute("aria-label", b.title);
    icone.setAttribute("d", AGRANDIR);
  }

  function execute() {
    if (busy) return;
    var code = editor.getValue();
    clearError();
    hideConsole();
    exclusive(function () {
      return PyEngine.run(code).then(function (r) {
        animate(TurtleRec.snapshot());
        if (r.error) showError(r.error);
        else showOutput(r.output);
      });
    });
  }

  function verify() {
    if (busy || !current.note) return;
    var ex = current;
    var code = editor.getValue();
    clearError();
    hideConsole();
    exclusive(function () {
      return Checker.checkExercise(ex, code).then(function (r) {
        animate(r.programPath);
        if (r.error) showError(r.error);
        else showOutput(r.output);

        state.essais[ex.id] = (state.essais[ex.id] || 0) + 1;
        if (r.ok && !state.valide[ex.id]) state.valide[ex.id] = true;

        Scorm.recordInteraction({
          id: ex.id,
          description: ex.titre + " – essai " + state.essais[ex.id],
          response: code,
          correct: r.ok
        });
        renderCriteria(r);
        buildTabs();
        updateResult();
        saveNow();
        Scorm.commit();
        dirty = false;
      });
    });
  }

  function resetCode() {
    if (busy) return;
    if (!window.confirm("Remplacer votre programme par le code de départ ? Votre travail sur cet exercice sera effacé.")) return;
    editor.setValue(current.code);
    hideConsole();
    drawing.draw({ path: [], x: 0, y: 0, heading: 0 });
    $("btn-finir").hidden = true;
    renderCriteria(null);
  }

  /* ------------------------------------------------------------------ */
  /* Démarrage                                                            */
  /* ------------------------------------------------------------------ */

  /* Petit bouton en bas à droite ; caché si le navigateur ou Moodle ne permet pas le plein écran. */
  function boutonPleinEcran() {
    var root = document.documentElement;
    var demander = root.requestFullscreen || root.webkitRequestFullscreen;
    var permis = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    if (!demander || !permis) return;
    var AGRANDIR = "M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9";
    var REDUIRE = "M5 1v4H1M13 5H9V1M9 13V9h4M1 9h4v4";
    var b = document.createElement("button");
    b.type = "button";
    b.id = "btn-plein-ecran";
    b.className = "plein-ecran";
    b.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d=""/></svg>';
    var icone = b.querySelector("path");
    document.body.appendChild(b);
    function actuel() { return document.fullscreenElement || document.webkitFullscreenElement; }
    function maj() {
      var on = !!actuel();
      b.title = on ? "Quitter le plein écran" : "Plein écran";
      b.setAttribute("aria-label", b.title);
      icone.setAttribute("d", on ? REDUIRE : AGRANDIR);
      document.body.classList.toggle("en-plein-ecran", on);
      if (editor) setTimeout(function () { editor.refresh(); }, 50);
    }
    b.addEventListener("click", function () {
      if (actuel()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else demander.call(root);
    });
    document.addEventListener("fullscreenchange", maj);
    document.addEventListener("webkitfullscreenchange", maj);
    maj();
  }

  function init() {
    state = Scorm.start(SERIE.id) || {};
    state.v = 1;
    state.code = state.code || {};
    state.valide = state.valide || {};
    state.essais = state.essais || {};
    if (!SERIE.exercices.some(function (e) { return e.id === state.courant; })) {
      state.courant = SERIE.exercices[0].id;
    }

    document.title = SERIE.titre;
    $("titre-serie").textContent = SERIE.titre;
    $("pied").textContent = Scorm.connected()
      ? "Votre travail est enregistré automatiquement dans Moodle."
      : "Mode test hors Moodle : votre travail est enregistré dans ce navigateur uniquement.";

    if (!(state.zoom > 0)) state.zoom = 1;
    drawing = new TurtleCanvas($("canvas-tortue"), {
      margin: 28, getSpeed: sliderSpeed,
      getZoom: function () { return state.zoom || 1; },
      onEchelle: afficherEchelle
    });
    outilsDessin();

    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!(state.vitesse >= 1 && state.vitesse <= 11)) state.vitesse = reduceMotion ? 11 : 6;
    $("vitesse").value = state.vitesse;
    showSpeed();
    $("vitesse").addEventListener("input", function () {
      state.vitesse = +$("vitesse").value;
      showSpeed();
      saveSoon();
    });
    $("btn-finir").addEventListener("click", function () { drawing.finish(); });
    figure = new TurtleCanvas($("canvas-figure"), { fit: true, turtle: false, origin: false, margin: 14 });
    boutonPleinEcran();

    editor = CodeMirror($("editeur"), {
      value: "",
      mode: "python",
      lineNumbers: true,
      indentUnit: 4,
      tabSize: 4,
      matchBrackets: true,
      extraKeys: {
        "Tab": function (cm) {
          if (cm.somethingSelected()) cm.indentSelection("add");
          else cm.replaceSelection("    ", "end");
        },
        "Shift-Tab": function (cm) { cm.indentSelection("subtract"); },
        "Ctrl-Enter": execute,
        "Cmd-Enter": execute
      }
    });
    editor.on("change", function () {
      if (!current) return;
      state.code[current.id] = editor.getValue();
      clearError();
      saveSoon();
    });

    $("btn-executer").addEventListener("click", execute);
    $("btn-verifier").addEventListener("click", verify);
    $("btn-recommencer").addEventListener("click", resetCode);

    // Enregistrement régulier dans Moodle, et à la fermeture
    setInterval(function () {
      if (dirty) { saveNow(); Scorm.commit(); dirty = false; }
    }, 30000);
    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      saveNow();
      Scorm.finish();
    }
    window.addEventListener("pagehide", close);
    window.addEventListener("beforeunload", close);

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (!busy && drawing.last && !drawing.animating()) drawing.draw(drawing.last);
        if (figure.last && !$("figure-attendue").hidden) figure.draw(figure.last);
      }, 150);
    });

    if (SERIE.fichiers) boutonsFichiers();
    if (SERIE.exercices.length === 1) $("onglets").hidden = true;

    updateResult();
    show(state.courant);
    if (SERIE.fichiers || (!graded.length && SERIE.exercices.length === 1)) modeBacASable();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
