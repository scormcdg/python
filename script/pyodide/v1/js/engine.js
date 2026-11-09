/*
 * Moteur d'exécution Python (Pyodide : le vrai Python) + traduction des erreurs en français.
 * Même interface que la version Skulpt (script/v1/js/engine.js) :
 *   PyEngine.run(code, onOutput, options), callFunction(module, nom, args), getFunction(module, nom), translateError(err, code)
 * Python tourne dans un worker (js/worker.js, py/moteur.py) : la page reste utilisable, et un programme
 * qui dure plus de 5 secondes est arrêté. input() met le programme en pause (JSPI) pendant que l'élève répond.
 * Dépend de : turtle.js (facultatif) ; Pyodide 0.29.5 vient de jsDelivr, ou de la copie dans vendor/pyodide/
 * si jsDelivr ne répond pas (voir PYODIDE_URLS).
 */
(function (global) {
  "use strict";

  var TIME_LIMIT_MS = 5000;
  var MSG_CHARGEMENT = "Chargement de Python… (la première fois, cela peut prendre quelques secondes)";

  /* Dossier des fichiers communs (celui qui contient js/engine.js) */
  var BASE = (function () {
    var s = global.document && global.document.currentScript;
    var src = s && s.src ? s.src : "";
    if (!src && global.document) {
      var all = global.document.getElementsByTagName("script");
      for (var i = 0; i < all.length; i++) if (/js\/engine\.js/.test(all[i].src)) src = all[i].src;
    }
    return src.replace(/js\/engine\.js(?:[?#].*)?$/, "");
  })();
  /*
   * Pyodide 0.29.5 : d'abord jsDelivr (adresse officielle de Pyodide), puis, s'il ne répond pas en quelques secondes,
   * la copie sur GitHub, avec les fichiers communs (vendor/pyodide/). Les deux copies sont identiques.
   * var PYODIDE_URL = "…/" dans index.html remplace cette liste (une seule adresse).
   */
  var PYODIDE_URLS = global.PYODIDE_URL ? [global.PYODIDE_URL]
    : ["https://cdn.jsdelivr.net/pyodide/v0.29.5/full/", BASE + "vendor/pyodide/"];

  /*
   * input() : la question s'affiche dans la console, et l'élève tape sa réponse
   * juste après, dans la console (comme dans Thonny). Validation avec Entrée.
   */
  function askInConsole(prompt, out, getOutput) {
    var question = prompt == null ? "" : String(prompt);
    out(question);
    var box = global.document && global.document.getElementById("console");
    if (!box) {
      var r = global.prompt(question);
      out((r || "") + "\n");
      return Promise.resolve(r || "");
    }
    return new Promise(function (resolve) {
      box.className = "console";
      box.textContent = getOutput();
      var field = global.document.createElement("input");
      field.type = "text";
      field.className = "saisie";
      field.setAttribute("aria-label", question || "Réponse");
      field.autocomplete = "off";
      field.spellcheck = false;
      box.appendChild(field);
      box.scrollTop = box.scrollHeight;
      field.focus();
      field.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        var rep = field.value;
        out(rep + "\n");
        box.textContent = getOutput();
        resolve(rep); // le temps d'attente ne compte pas dans la limite de 5 s
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Worker Python                                                        */
  /* ------------------------------------------------------------------ */

  var worker = null, pret = null, estPret = false, echec = false, ecouteur = null;
  var DELAI_BLOCAGE = 15000; // chargement de Pyodide sans aucun progrès pendant ce temps : adresse suivante

  function demarrer() {
    estPret = false;
    echec = false;
    pret = new Promise(function (resolve, reject) { lancerWorker(PYODIDE_URLS, resolve, reject); });
    pret.catch(function () { echec = true; });
  }

  /*
   * Un worker qui charge Pyodide depuis urls (dans l'ordre). Pendant le chargement depuis une adresse qui n'est pas
   * la dernière, on surveille la progression : si rien n'arrive pendant DELAI_BLOCAGE, ce worker est arrêté et
   * un nouveau recommence avec les adresses suivantes (un téléchargement bloqué ne donne jamais d'erreur).
   */
  function lancerWorker(urls, resolve, reject) {
    var url = BASE + "js/worker.js";
    // Un worker doit venir du même site que la page : un petit worker « blob » charge worker.js (GitHub ou paquet)
    var adresse = URL.createObjectURL(new Blob(["importScripts(" + JSON.stringify(url) + ");"], { type: "text/javascript" }));
    var w = new Worker(adresse);
    worker = w;
    var enCours = null, dernierProgres = Date.now();
    var surveillance = setInterval(function () {
      if (w !== worker || estPret) { clearInterval(surveillance); return; }
      if (!enCours || enCours.dernier || Date.now() - dernierProgres < DELAI_BLOCAGE) return;
      clearInterval(surveillance);
      if (global.console) global.console.warn("Python (Pyodide) : le chargement depuis " + enCours.url + " est bloqué, on passe à l'adresse suivante");
      w.terminate();
      URL.revokeObjectURL(adresse);
      lancerWorker(urls.slice(urls.indexOf(enCours.url) + 1), resolve, reject);
    }, 1000);
    w.onmessage = function (ev) {
      var m = ev.data;
      if (w !== worker) return;
      if (m.type === "progres") { dernierProgres = Date.now(); return; }
      if (m.type === "essai") { enCours = m; dernierProgres = Date.now(); return; }
      if (m.type === "pret") { clearInterval(surveillance); URL.revokeObjectURL(adresse); estPret = true; resolve(); return; }
      if (m.type === "echec") { clearInterval(surveillance); reject(new Error(m.texte)); return; }
      if (m.type === "source") { if (global.console) global.console.info("Python (Pyodide) chargé depuis " + m.url); return; }
      if (ecouteur) ecouteur(m);
    };
    w.onerror = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      if (w !== worker) return;
      clearInterval(surveillance);
      reject(new Error((e && e.message) || "worker"));
    };
    w.postMessage({ type: "init", base: BASE, pyodide: urls, tortue: !!global.TURTLE_MODULE_SRC });
  }

  /* Pendant le premier chargement : un message dans la console, retiré quand Python est prêt */
  function messageChargement() {
    var box = global.document && global.document.getElementById("console");
    if (!box || estPret) return;
    var avant = { classe: box.className, texte: box.textContent };
    box.className = "console vide";
    box.textContent = MSG_CHARGEMENT;
    pret.then(retablir, retablir);
    function retablir() {
      if (box.textContent === MSG_CHARGEMENT) { box.className = avant.classe; box.textContent = avant.texte; }
    }
  }

  var file = Promise.resolve();
  /* Un seul programme à la fois. h = { out(texte, echo), input(question) → Promise(réponse) } */
  function lancer(job, h) {
    var p = file.then(function () { return executerJob(job, h); });
    file = p.catch(function () {});
    return p;
  }

  function executerJob(job, h) {
    if (!worker || echec) demarrer();
    messageChargement();
    return pret.then(function () {
      return new Promise(function (resolve) {
        var timer = null;
        function armer() { clearTimeout(timer); timer = setTimeout(tropLong, TIME_LIMIT_MS); }
        function tropLong() {
          // boucle sans fin : on arrête Python et on le recharge (depuis le cache du navigateur)
          ecouteur = null;
          worker.terminate();
          worker = null;
          demarrer();
          resolve({ temps: true });
        }
        ecouteur = function (m) {
          if (m.type === "out") h.out(m.texte, m.echo);
          else if (m.type === "input") {
            clearTimeout(timer);
            h.input(m.invite).then(function (rep) {
              armer();
              if (worker) worker.postMessage({ type: "reponse", texte: String(rep) });
            });
          } else if (m.type === "fin") {
            clearTimeout(timer);
            ecouteur = null;
            resolve(m.resultat);
          }
        };
        armer();
        worker.postMessage({ type: "job", job: job });
      });
    }, function (e) {
      return { chargement: String((e && e.message) || e) };
    });
  }

  /* Erreur Python (py/moteur.py) → même forme que les erreurs Skulpt, que translateError sait traduire */
  function erreurPython(e) {
    var msg = String(e.msg || ""), m;
    if (e.type === "UnboundLocalError" && (m = msg.match(/cannot access local variable '(\w+)'/))) {
      msg = "local variable '" + m[1] + "' referenced before assignment";
    }
    if (e.type === "RecursionError") msg = "maximum recursion depth exceeded";
    if ((m = msg.match(/^can only concatenate str \(not "(\w+)"\) to str/))) msg = "cannot concatenate 'str' and '" + m[1] + "' objects";
    if (/^cannot assign to literal/.test(msg)) msg = "can't assign to literal";
    if (/doesn't define __round__ method/.test(msg)) msg = "a float is required";
    var type = e.type === "TabError" ? "IndentationError" : e.type; // TabError est une sorte d'IndentationError
    var raw = type + ": " + msg + (e.ligne ? " on line " + e.ligne : "");
    return { toString: function () { return raw; }, traceback: e.ligne ? [{ lineno: e.ligne }] : [] };
  }
  /* Message du vrai Python, tel qu'il l'écrit (affiché sous le message en français, à la demande) */
  function messageOriginal(e) {
    return (e.ligne ? 'File "<programme>", line ' + e.ligne + "\n" : "") + e.type + (e.msg ? ": " + e.msg : "");
  }
  function avecOriginal(err, e) {
    // pas pour les erreurs de notre tortue : leur message est déjà en français
    var francais = /attend (un|deux) nombres?|Couleur invalide|entre les parenthèses|composantes de la couleur|La tortue a fait/.test(e.msg || "");
    if (e.type !== "Interne" && e.type !== "InputIndisponible" && !francais) err.original = messageOriginal(e);
    return err;
  }
  function erreurSpeciale(r, code) {
    if (r.chargement) {
      return { line: null, raw: "LoadError: " + r.chargement,
        message: "Python n'a pas pu se charger : vérifiez la connexion internet, puis rechargez la page. (" + r.chargement + ")" };
    }
    if (r.temps) return translateError({ toString: function () { return "TimeLimitError: Program exceeded run time limit."; } }, code);
    return null;
  }

  /*
   * Une même commande définie deux fois : Python ne dit rien et garde la dernière,
   * ce qui trompe souvent les élèves. On le signale comme une erreur.
   * Seules comptent les définitions au même niveau (même commande englobante).
   */
  function findDuplicateDef(code) {
    var lines = hideTripleQuotes(code || "").split("\n");
    var seen = {};
    var stack = []; // commandes englobantes : {name, indent}
    for (var i = 0; i < lines.length; i++) {
      var text = lines[i].replace(/\t/g, "    ").replace(STRING_RE, '""').replace(/#.*$/, "");
      if (!text.trim()) continue;
      var indent = text.length - text.replace(/^\s+/, "").length;
      while (stack.length && indent <= stack[stack.length - 1].indent) stack.pop();
      var m = text.match(/^\s*def\s+([A-Za-z_À-ɏ][\wÀ-ɏ]*)\s*\(/);
      if (!m) continue;
      var key = stack.map(function (s) { return s.name; }).join("/") + "/" + m[1];
      if (seen[key]) {
        return {
          line: i + 1,
          raw: "DuplicateDefinition: " + m[1],
          message: "La commande « " + m[1] + " » est définie deux fois : ligne " + seen[key] + " et ligne " + (i + 1) +
            ". Le programme ne peut pas s'exécuter : gardez une seule définition (supprimez ou renommez l'autre)."
        };
      }
      seen[key] = i + 1;
      stack.push({ name: m[1], indent: indent });
    }
    return null;
  }

  /*
   * Nom d'une commande prédéfinie réutilisé comme variable, paramètre ou commande (color = "red", def circle():…).
   * Python l'accepte, mais la commande ne marche plus ensuite : on le signale avant d'exécuter.
   */
  var NOMS_PYTHON = ["print", "input", "range", "int", "float", "str", "len", "abs", "round", "min", "max", "list", "sum", "type"];
  var NOMS_TORTUE = ["forward", "backward", "left", "right", "goto", "penup", "pendown", "color", "pencolor", "fillcolor",
    "width", "pensize", "circle", "dot", "write", "speed", "begin_fill", "end_fill", "shape", "done", "setheading", "home",
    "bgcolor", "hideturtle", "showturtle"];

  function findShadowedName(code) {
    var src = hideTripleQuotes(code || "");
    var tortue = /^\s*from\s+turtle\s+import\b/m.test(src);
    function origine(nom) {
      if (NOMS_PYTHON.indexOf(nom) >= 0) return "de Python";
      if (tortue && NOMS_TORTUE.indexOf(nom) >= 0) return "de la tortue";
      if ((global.EXTRA_KNOWN_NAMES || []).indexOf(nom) >= 0) return "de Robi";
      return null;
    }
    var lines = src.split("\n");
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].replace(STRING_RE, '""').replace(/#.*$/, "");
      var n = i + 1, m, o;
      if ((m = /^\s*def\s+(\w+)\s*\(([^)]*)\)?/.exec(t))) {
        if ((o = origine(m[1]))) {
          return { line: n, raw: "ShadowRule: " + m[1], message: "Ligne " + n + " : « " + m[1] + " » est déjà une commande " + o +
            ". Donnez un autre nom à votre commande, sinon la commande " + o + " ne marche plus." };
        }
        var params = (m[2] || "").split(",").map(function (x) { return x.replace(/=.*$/, "").trim(); });
        for (var k = 0; k < params.length; k++) {
          if ((o = origine(params[k]))) {
            return { line: n, raw: "ShadowRule: " + params[k], message: "Ligne " + n + " : le paramètre « " + params[k] +
              " » porte le nom d'une commande " + o + " (" + params[k] + "(…)). Choisissez un autre nom, sinon la commande ne marche plus dans « " + m[1] + " »." };
          }
        }
        continue;
      }
      m = /^\s*(\w+)\s*(?:[-+*\/%]|\/\/|\*\*)?=(?!=)/.exec(t) || /^\s*for\s+(\w+)\s+in\b/.exec(t);
      if (m && (o = origine(m[1]))) {
        return { line: n, raw: "ShadowRule: " + m[1], message: "Ligne " + n + " : « " + m[1] + " » est le nom d'une commande " + o +
          " (" + m[1] + "(…)). Ne l'utilisez pas comme nom de variable, sinon la commande ne marche plus : choisissez un autre nom." };
      }
    }
    return null;
  }

  /* Une seule tortue, commandes écrites directement : seul « from turtle import * » est accepté. */
  function findForbiddenImport(code) {
    if (!global.TURTLE_MODULE_SRC) return null;
    var lines = hideTripleQuotes(code || "").split("\n");
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].replace(STRING_RE, '""').replace(/#.*$/, "").trim();
      if (/^import\s+(.*,\s*)?turtle\b/.test(t)) {
        return {
          line: i + 1,
          raw: "ImportRule",
          message: "Ligne " + (i + 1) + " : dans ce cours, on écrit « from turtle import * » et on utilise les commandes " +
            "directement, par exemple forward(100), sans « turtle. » ni « t. » devant."
        };
      }
    }
    return null;
  }

  /*
   * Le vrai Python accepte les accents dans les noms (année = 2024), Skulpt les refusait.
   * Le cours les refuse toujours, avec le même message qu'avant.
   */
  function findAccentName(code) {
    var lines = hideTripleQuotes(code || "").split("\n");
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].replace(STRING_RE, '""').replace(/#.*$/, "");
      var m = t.match(/[A-Za-z_\d]*[À-ÖØ-öø-ÿ][\wÀ-ÖØ-öø-ÿ]*/);
      if (m) {
        return { line: i + 1, raw: "SyntaxError: accent",
          message: "Les noms ne peuvent pas contenir d'accent ici (ligne " + (i + 1) + ") : écrivez « " + sansAccent(m[0]) +
            " » au lieu de « " + m[0] + " »." };
      }
    }
    return null;
  }

  var compteur = 0, dernieresReponses = null;

  /*
   * options.inputs (facultatif) : réponses données à input(), dans l'ordre (vérification).
   * options.robi (facultatif) : { monde, autorisees } pour le jeu Robi ; le résultat contient alors
   * robi = { evenements, final } (ou null si Python a été arrêté).
   */
  function run(code, onOutput, options) {
    var output = "";
    var printed = ""; // seulement ce qu'affiche print() (sans les questions et réponses de input())
    var inputs = options && options.inputs;
    dernieresReponses = inputs || null;
    if (global.TurtleRec) global.TurtleRec.reset(); // la tortue est facultative
    var dup = findIndentProblem(code) || findForbiddenImport(code) || findDuplicateDef(code) || findShadowedName(code) || findAccentName(code);
    if (dup) {
      dup = { line: dup.line, raw: dup.raw, message: avecType(dup.message, dup.raw) };
      return Promise.resolve({ module: null, error: dup, output: "" });
    }
    function out(t) { output += t; printed += t; if (onOutput) onOutput(t); }
    function echo(t) { output += t; if (onOutput) onOutput(t); }
    var id = ++compteur;
    var job = { type: "run", id: id, code: code, inputs: inputs ? inputs.map(String) : null };
    if (options && options.robi) job.robi = options.robi;
    return lancer(job, {
      out: function (t, e) { if (e) echo(t); else out(t); },
      input: function (q) { return askInConsole(q, out, function () { return output; }); }
    }).then(function (r) {
      var res = resultat(r);
      res.robi = r.robi || null;
      return res;
    });
    function resultat(r) {
      var sp = erreurSpeciale(r, code);
      if (sp) return { module: null, error: sp, output: output };
      if (global.TurtleRec) global.TurtleRec.charger(r.tortue);
      if (r.trop) {
        var n = inputs.length;
        return { module: null, output: output, error: { line: null, raw: "TooManyInputs",
          message: "Le programme pose trop de questions avec input() : il doit en poser " + n + " (" +
            (n > 1 ? "une pour chaque réponse demandée dans l'énoncé" : "une seule") + ")." } };
      }
      if (r.erreur) return { module: null, error: avecOriginal(translateError(erreurPython(r.erreur), code), r.erreur), output: output };
      return { module: { id: id, fonctions: r.fonctions || [] }, error: null, output: output, printed: printed };
    }
  }

  /* Appelle une commande définie par l'élève ; args (facultatif) : valeurs JS (nombres, textes). Tortue remise à zéro. */
  function callFunction(mod, name, args) {
    if (global.TurtleRec) global.TurtleRec.reset(); // la tortue est facultative
    if (!mod) {
      return Promise.resolve({ error: translateError(erreurPython({ type: "NameError", msg: "name '" + name + "' is not defined" })) });
    }
    var output = "";
    var inputs = dernieresReponses;
    var job = { type: "call", module: mod.id, name: name, args: args || [], inputs: inputs ? inputs.map(String) : null };
    return lancer(job, {
      out: function (t) { output += t; },
      input: function (q) { return askInConsole(q, function (t) { output += t; }, function () { return output; }); }
    }).then(function (r) {
      var sp = erreurSpeciale(r);
      if (sp) return { error: sp };
      if (global.TurtleRec) global.TurtleRec.charger(r.tortue);
      if (r.trop) return { error: { line: null, raw: "TooManyInputs", message: "Le programme pose trop de questions avec input()." } };
      if (r.erreur) return { error: avecOriginal(translateError(erreurPython(r.erreur)), r.erreur) };
      return { error: null };
    });
  }

  /* La commande existe-t-elle dans le programme exécuté ? (objet non nul si oui) */
  function getFunction(mod, name) {
    if (!mod || !mod.fonctions || mod.fonctions.indexOf(name) < 0) return null;
    return { module: mod.id, nom: name };
  }

  /*
   * (Hérité de la version Skulpt, qui signalait presque toutes les fautes de frappe comme une simple
   * « SyntaxError: bad input ». On analyse le code pour être plus précis.
   */
  var STRING_RE = /(?:[rRbBfFuU]{1,2})?(?:"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')/g;
  var TOKEN_RE = /(?:[rRbBfFuU]{1,2})?(?:"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\d+(?:\.\d+)?|[A-Za-z_À-ɏ][\wÀ-ɏ]*|\S/g;
  var KEYWORDS = /^(and|or|not|in|is|if|elif|else|for|while|def|return|import|from|as|with|lambda|pass|break|continue|global|nonlocal|try|except|finally|raise|class|del|assert|yield|await|async)$/;

  function isValueToken(tok) {
    if (/^(?:[rRbBfFuU]{1,2})?["']/.test(tok)) return true;          // texte
    if (/^\d/.test(tok)) return true;                                  // nombre
    return /^[A-Za-z_À-ɏ]/.test(tok) && !KEYWORDS.test(tok); // nom
  }

  /* Remplace les textes sur plusieurs lignes (triples guillemets) en gardant la numérotation des lignes. */
  function hideTripleQuotes(code) {
    return code.replace(/("""|''')[\s\S]*?\1/g, function (m) {
      return '""' + m.replace(/[^\n]/g, "");
    });
  }

  /* Noms du programme (variables, commandes définies) et commandes connues (Python, tortue, Robi). */
  function nomsConnus(code) {
    var src = String(code || "").replace(STRING_RE, '""').replace(/#.*$/gm, "");
    var noms = [], defs = [], m;
    var re1 = /^\s*([A-Za-z_]\w*)\s*(?:[-+*\/%]|\/\/|\*\*)?=(?!=)/gm, re2 = /^\s*def\s+([A-Za-z_]\w*)\s*\(([^)]*)/gm, re3 = /^\s*for\s+([A-Za-z_]\w*)\s+in\b/gm;
    while ((m = re1.exec(src))) noms.push(m[1]);
    while ((m = re3.exec(src))) noms.push(m[1]);
    while ((m = re2.exec(src))) {
      defs.push(m[1]); noms.push(m[1]);
      m[2].split(",").forEach(function (p) { p = p.replace(/=.*$/, "").trim(); if (p) noms.push(p); });
    }
    var commandes = KNOWN_NAMES.concat(global.EXTRA_KNOWN_NAMES || [], defs).filter(function (x) { return !/^(True|False|None)$/.test(x); });
    return { noms: noms.concat(KNOWN_NAMES, global.EXTRA_KNOWN_NAMES || []), commandes: commandes,
      espaces: /^ +\S/m.test(String(code || "")) };
  }

  function sansAccent(m) { return m.normalize ? m.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : m; }

  /*
   * Erreurs de syntaxe reconnues sur une ligne (t : ligne sans textes ni commentaires, brut : ligne d'origine).
   * Renvoie { message } ou null.
   */
  function problemePrecis(t, brut, n, indent, premier, dernierA, connus) {
    var m, L = " (ligne " + n + ")";
    function r(msg, extra) { var o = { message: msg }; if (extra) o.sansDeuxPoints = true; return o; }
    // caractères copiés d'un traitement de texte
    if (/[\u00a0\u2009\u200b\u202f\ufeff]/.test(t))
      return r("La ligne " + n + " contient un espace spécial invisible (souvent après un copier-coller) : effacez les espaces de cette ligne et retapez-les.");
    if ((m = t.match(/[“”‘’«»„]/)))
      return r("Les guillemets « " + m[0] + " »" + L + " viennent d'un traitement de texte et ne sont pas acceptés : utilisez \" ou ' (touches du clavier).");
    if (/°/.test(t)) return r("Le signe « ° » n'est pas accepté" + L + " : écrivez seulement le nombre, par exemple left(90).");
    if ((m = t.match(/[A-Za-z_\d]*[À-ÖØ-öø-ÿ][\wÀ-ÖØ-öø-ÿ]*/)))
      return r("Les noms ne peuvent pas contenir d'accent ici" + L + " : écrivez « " + sansAccent(m[0]) + " » au lieu de « " + m[0] + " ».");
    if ((m = t.match(/[^\x00-\x7F]/))) return r("Le caractère « " + m[0] + " » n'est pas accepté en Python" + L + ".");
    var lead = (brut.match(/^[ \t]*/) || [""])[0];
    if (/\t/.test(lead) && (/ /.test(lead) || connus.espaces)) return r("La ligne " + n + " mélange tabulations et espaces au début : effacez le décalage et remettez-le avec la touche Tab.");
    // noms de variables impossibles
    if ((m = t.match(/^([A-Za-z_]\w*)\s*(?:[-+*\/%]|\/\/|\*\*)?=(?!=)/)) && KEYWORDS.test(m[1]))
      return r("« " + m[1] + " » est un mot réservé de Python" + L + " : il ne peut pas servir de nom de variable. Choisissez un autre nom.");
    if (/^def\s+[A-Za-z_]\w*\s*:/.test(t)) return r("Il manque les parenthèses après le nom de la commande" + L + " : " + t.replace(/\s*:\s*$/, "") + "():");
    if ((m = t.match(/^def\s+([A-Za-z_]\w*(?:\s+[A-Za-z_]\w*)+)\s*\(/)))
      return r("Un nom de commande ne peut pas contenir d'espace" + L + " : écrivez « " + m[1].split(/\s+/).join("_") + " ».");
    if ((m = t.match(/^([A-Za-z_]\w*(?:\s+[A-Za-z_]\w*)+)\s*=(?!=)/)) && !m[1].split(/\s+/).some(function (w) { return KEYWORDS.test(w); }))
      return r("Un nom de variable ne peut pas contenir d'espace" + L + " : écrivez « " + m[1].split(/\s+/).join("_") + " ».");
    if ((m = t.match(/^([A-Za-z_]\w*(?:-[A-Za-z_]\w*)+)\s*=(?!=)/)))
      return r("Le tiret « - » est un moins : il ne peut pas être dans un nom" + L + ". Écrivez « " + m[1].replace(/-/g, "_") + " ».");
    if ((m = t.match(/(^|[^\w.])(\d+)([A-Za-z_]\w*)/)) && !/^(e\d*|j|x[0-9a-f]+|o[0-7]+|b[01]+)$/i.test(m[3])) {
      if (m[1] === "" && /^\d+[A-Za-z_]\w*\s*=(?!=)/.test(t)) return r("Un nom de variable ne peut pas commencer par un chiffre" + L + ".");
      return r("Pour multiplier, il faut écrire le signe *" + L + " : " + m[2] + "*" + m[3] + ".");
    }
    // opérateurs et comparaisons
    if ((m = t.match(/([A-Za-z_]\w*)\s*(\+\+|--)\s*$/)))
      return r("Python n'a pas « " + m[2] + " »" + L + " : écrivez " + m[1] + (m[2] === "++" ? " += 1." : " -= 1."));
    if (/(^|[^=!<>])=\s*$/.test(t)) return r("Il manque une valeur après « = » à la ligne " + n + ".");
    if (/^else\s+if\b/.test(t)) return r("En Python, « else if » s'écrit « elif »" + L + ".");
    if (/^(if|elif|while)\b/.test(t) && /[^=!<>]=[^=]/.test(t.replace(/\([^()]*\)/g, "()")))
      return r("Pour comparer, on écrit « == » (deux signes égal)" + L + " : un seul « = » sert à donner une valeur à une variable.");
    if ((m = t.match(/\b(and|or)\s*(<=|>=|==|!=|<|>)/))) {
      var v = (t.match(/^(?:if|elif|while)\s+(?:not\s+)?([A-Za-z_]\w*)/) || [])[1];
      return r("Après « " + m[1] + " », il faut répéter ce qu'on compare" + L + (v ? " : écrivez « " + m[1] + " " + v + " " + m[2] + " … »." : "."));
    }
    if (/\([^)]*;/.test(t)) return r("Entre les parenthèses, les valeurs se séparent par une virgule, pas par un point-virgule" + L + ".");
    // else / elif mal placés
    if (premier === "elif" || premier === "else") {
      var avant = dernierA[indent];
      if (avant === "else") return r("« " + premier + " » ne peut pas venir après un « else »" + L + " : le « else » doit toujours être en dernier.");
      var ok = premier === "elif" ? /^(if|elif)$/.test(avant || "") : /^(if|elif|for|while|try|except)$/.test(avant || "");
      if (!ok) return r("« " + premier + " » doit suivre un « if », avec le même décalage" + L + ".");
    }
    // deux-points en trop
    if (/:\s*$/.test(t) && !/^(def|for|while|if|elif|else|try|except|finally|with|class|lambda)\b/.test(t) && !motCleProche(premier, t))
      return r("Les deux-points « : » sont en trop à la fin de la ligne " + n + " : on ne les met qu'après if, elif, else, for, while et def.", true);
    return null;
  }

  function findSyntaxProblems(code) {
    var problems = [];
    var lines = hideTripleQuotes(code).split("\n");
    var prev = null; // {indent, text, n}
    var dernierA = {};  // décalage → premier mot de la dernière ligne à ce décalage (pour else / elif)
    var connus = nomsConnus(code);
    var blockHeader = /^(def|for|while|if|elif|else|try|except|finally|with|class)\b/;
    for (var i = 0; i < lines.length; i++) {
      var n = i + 1;
      var raw = lines[i].replace(/\t/g, "    ");
      // les textes d'abord (un « # » dans "#ff8800" n'est pas un commentaire), puis les commentaires
      var noStr = raw.replace(STRING_RE, '""');
      if (/["']/.test(noStr.replace(/#.*$/, "").replace(/""/g, ""))) {
        problems.push({ line: n, message: "Un guillemet n'est pas fermé à la ligne " + n +
          " : un texte doit commencer et finir par le même guillemet, par exemple \"Bonjour\"." });
        continue;
      }
      var code1 = noStr.replace(/#.*$/, "").trimEnd();
      if (!code1.trim()) continue;
      var indent = code1.length - code1.trimStart().length;
      var t = code1.trim();
      var premier = (t.match(/^[A-Za-z_]\w*/) || [""])[0];

      // ---- erreurs précises, reconnues sur la ligne elle-même ----
      var precis = problemePrecis(t, lines[i], n, indent, premier, dernierA, connus);
      if (precis) {
        problems.push({ line: n, message: precis.message });
        if (precis.sansDeuxPoints) code1 = code1.replace(/:\s*$/, "");
      }
      Object.keys(dernierA).forEach(function (k) { if (+k > indent) delete dernierA[k]; });
      dernierA[indent] = /^else\s+if\b/.test(t) ? "elif" : premier;

      // deux valeurs côte à côte : virgule (ou opérateur) oubliée
      var toks = raw.match(TOKEN_RE) || [];
      var cut = toks.indexOf("#");
      if (cut >= 0) toks = toks.slice(0, cut);
      var premierMot = toks.length > 1 && /^[A-Za-z_]\w*$/.test(toks[0]) && !KEYWORDS.test(toks[0]) && toks[0] !== "print";
      var motInconnu = premierMot && (isValueToken(toks[1]) || (toks[1] === ":" && motCleProche(toks[0], t)));
      if (precis) {
        // déjà expliqué plus précisément
      } else if (connus.commandes.indexOf(toks[0]) >= 0 && toks.length > 1 && isValueToken(toks[1])) {
        // « forward 100 », « print "Bonjour" » : parenthèses oubliées
        problems.push({ line: n, message: toks[0] + " s'écrit avec des parenthèses (ligne " + n + ") : " +
          toks[0] + "(" + toks.slice(1).join(" ").replace(/ ([,)])/g, "$1") + ")." });
      } else if (motInconnu) {
        // « ilif a == … », « fro turtle import * », « fore i in … », « esle: » : premier mot mal écrit
        var mot = motCleProche(toks[0], t);
        problems.push({ line: n, message: mot
          ? "« " + toks[0] + " » n'est pas un mot de Python (ligne " + n + "). Vouliez-vous écrire « " + mot + " » ?"
          : "Python ne comprend pas le début de la ligne " + n + " : « " + toks[0] + " " + toks[1] + " ». Vérifiez l'orthographe de « " + toks[0] + " »." });
      } else if (toks[0] === "print" && toks.length > 1 && toks[1] !== "(") {
        problems.push({ line: n, message: "print s'écrit avec des parenthèses (ligne " + n + ") : par exemple print(\"Bonjour\")." });
      } else {
        for (var k = 0; k + 1 < toks.length; k++) {
          var endsValue = isValueToken(toks[k]) || /^[)\]}]$/.test(toks[k]);
          var isStr = function (x) { return /^(?:[rRbBfFuU]{1,2})?["']/.test(x); };
          var nomNu = function (x) { return /^[A-Za-z_]\w*$/.test(x) && !KEYWORDS.test(x); };
          if (isStr(toks[k]) && isStr(toks[k + 1])) continue; // "a" "b" est valide en Python
          if (endsValue && isValueToken(toks[k + 1])) {
            if (toks[k + 2] === "=" ) {
              // « x = 5 y = 6 »
              problems.push({ line: n, message: "Il y a deux instructions sur la ligne " + n + " : écrivez-les sur deux lignes." });
            } else if (nomNu(toks[k]) && nomNu(toks[k + 1]) && connus.noms.indexOf(toks[k]) < 0 && connus.noms.indexOf(toks[k + 1]) < 0) {
              // « print(Bonjour tout le monde) » : un texte sans guillemets
              var mots = [];
              for (var q = k; q < toks.length && nomNu(toks[q]); q++) mots.push(toks[q]);
              while (k > 0 && nomNu(toks[k - 1]) && connus.noms.indexOf(toks[k - 1]) < 0 && toks[k - 1] !== toks[0]) { k--; mots.unshift(toks[k]); }
              problems.push({ line: n, message: "Si « " + mots.join(" ") + " » est un texte, il doit être entre guillemets (ligne " + n +
                ") : \"" + mots.join(" ") + "\"." });
            } else {
              problems.push({ line: n, message: "Il manque une virgule (ou un opérateur comme +) entre « " + toks[k] +
                " » et « " + toks[k + 1] + " » à la ligne " + n + "." });
            }
            break;
          }
        }
      }

      [["(", ")", "Une parenthèse ouverte", "une parenthèse fermante"], ["[", "]", "Un crochet ouvert", "un crochet fermant"],
       ["{", "}", "Une accolade ouverte", "une accolade fermante"]].forEach(function (b) {
        var o = t.split(b[0]).length - 1, f = t.split(b[1]).length - 1;
        if (o > f) problems.push({ line: n, message: b[2] + " « " + b[0] + " » n'est pas " + (b[0] === "(" ? "fermée" : "fermé") + " à la ligne " + n + "." });
        else if (f > o) problems.push({ line: n, message: "Il y a " + b[3] + " « " + b[1] + " » en trop à la ligne " + n + "." });
      });
      if (blockHeader.test(t) && !/:\s*$/.test(t)) {
        problems.push({ line: n, message: "Erreur de syntaxe (ligne " + n + ") : il manque les deux-points « : » à la fin de la ligne." });
      }
      if (prev && /:\s*$/.test(prev.text) && indent <= prev.indent) {
        var seulementCommentaires = lines.slice(prev.n, n - 1).some(function (l) { return /^\s*#/.test(l); });
        problems.push({ line: n, message: "Le bloc de « " + prev.text.trim() + " » (ligne " + prev.n + ") est vide : la ligne " + n +
          " n'est pas décalée, donc elle n'en fait pas partie. Décalez de 4 espaces les instructions qui vont dans « " + prev.text.trim() +
          " » (s'il n'y en a pas encore, écrivez pass)." +
          (seulementCommentaires ? " Un commentaire ne compte pas comme instruction." : "") });
      } else if (prev && !/:\s*$/.test(prev.text) && indent > prev.indent) {
        problems.push({ line: n, message: "Indentation inattendue (ligne " + n + ") : cette ligne est décalée vers la droite alors qu'elle ne devrait pas l'être." });
      } else if (!prev && indent > 0) {
        problems.push({ line: n, message: "Indentation inattendue (ligne " + n + ") : la première instruction ne doit pas être décalée." });
      }
      prev = { indent: indent, text: code1, n: n };
    }
    // le programme se termine par « def f(): », « for … : », « if … : » sans rien en dessous
    if (prev && /:\s*$/.test(prev.text)) {
      problems.push({ line: prev.n, message: "La ligne " + prev.n + " se termine par « : », mais il n'y a rien en dessous : " +
        "écrivez les instructions de « " + prev.text.trim() + " » sur les lignes suivantes, décalées de 4 espaces (au moins une instruction, par exemple pass)." });
    }
    return problems;
  }

  /*
   * Règle de la classe : 4 espaces par niveau d'indentation, partout.
   * Python accepterait 2 ou 3 espaces s'ils sont réguliers ; ici on refuse,
   * et on désigne la ligne fautive (celle qui n'a pas le bon nombre d'espaces).
   */
  var INDENT = 4;

  function findIndentProblem(code) {
    var lines = hideTripleQuotes(code || "").split("\n");
    var prev = null; // dernière ligne de code : {indent, text}
    var ouverts = 0;  // parenthèses / crochets / accolades encore ouverts : la ligne suivante continue la même instruction
    var pile = [0];   // niveaux d'indentation ouverts, comme les compte Python
    for (var i = 0; i < lines.length; i++) {
      var n = i + 1;
      var t = lines[i].replace(/\t/g, "    ").replace(STRING_RE, '""').replace(/#.*$/, "").replace(/\s+$/, "");
      if (!t.trim()) continue;
      var suite = ouverts > 0;
      ouverts = Math.max(0, ouverts + (t.match(/[([{]/g) || []).length - (t.match(/[)\]}]/g) || []).length);
      if (suite) continue;          // ligne de continuation : décalage libre
      var indent = t.length - t.replace(/^\s+/, "").length;
      var afterHeader = prev && /:$/.test(prev.text);
      // Le vrai Python refuserait-il aussi cette ligne ? (alors c'est une erreur d'indentation, pas seulement la règle du cours)
      var haut = pile[pile.length - 1], refusParPython = false;
      if (afterHeader) {
        if (indent > haut) pile.push(indent); else refusParPython = true;
      } else if (indent > haut) {
        refusParPython = true;
      } else {
        while (pile.length > 1 && pile[pile.length - 1] > indent) pile.pop();
        if (pile[pile.length - 1] !== indent) refusParPython = true;
      }
      var expected = null;
      if (afterHeader && indent > prev.indent && indent !== prev.indent + INDENT) {
        expected = prev.indent + INDENT;
      } else if (indent % INDENT !== 0) {
        expected = prev && Math.abs(indent - prev.indent) < INDENT ? prev.indent : Math.round(indent / INDENT) * INDENT;
      }
      if (expected !== null) {
        return {
          line: n,
          raw: refusParPython ? "IndentationError: règle des 4 espaces" : "IndentationRule",
          message: "La ligne " + n + " est décalée de " + indent + " espace" + (indent > 1 ? "s" : "") +
            " : il en faut " + expected + ". Utilisez toujours 4 espaces par niveau (la touche Tab les met pour vous)."
        };
      }
      prev = { indent: indent, text: t.trim() };
    }
    return null;
  }

  /* Le problème trouvé sur la ligne signalée par Python, sinon le premier trouvé. */
  function diagnoseSyntax(code, reportedLine) {
    if (!code) return null;
    var problems = findSyntaxProblems(code);
    if (!problems.length) return null;
    for (var i = 0; i < problems.length; i++) {
      if (problems[i].line === reportedLine) return problems[i];
    }
    return problems[0];
  }

  /* Mot-clé de Python proche d'un mot mal écrit (une lettre de plus, de moins, changée, ou deux lettres inversées). */
  var MOTS_CLES = ["if", "elif", "else", "for", "while", "def", "from", "import", "return", "in", "not", "and", "or", "pass", "break", "continue"];
  function motCleProche(m, ligne) {
    var bas = m.toLowerCase();
    if (MOTS_CLES.indexOf(bas) >= 0) return bas;                 // « If », « For » : majuscule en trop
    function dist(a, b) {
      var d = [];
      for (var i = 0; i <= a.length; i++) { d[i] = [i]; }
      for (var j = 0; j <= b.length; j++) { d[0][j] = j; }
      for (i = 1; i <= a.length; i++) {
        for (j = 1; j <= b.length; j++) {
          var c = a[i - 1] === b[j - 1] ? 0 : 1;
          d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
          if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
      return d[a.length][b.length];
    }
    var proches = MOTS_CLES.filter(function (w) { return w.length >= 3 && bas.length >= 3 && dist(bas, w) === 1; });
    if (proches.length < 2) return proches[0] || null;
    // plusieurs possibilités (« fro » : for ou from) : on regarde le reste de la ligne
    ligne = " " + (ligne || "") + " ";
    var prefere = /\simport\s/.test(ligne) ? "from" : /\sin\s/.test(ligne) ? "for" : null;
    return prefere && proches.indexOf(prefere) >= 0 ? prefere : proches[0];
  }

  /* Noms connus des élèves, pour proposer une correction (« Forward » → « forward »). */
  var KNOWN_NAMES = [
    "print", "input", "range", "int", "float", "str", "len", "abs", "round", "min", "max", "list", "True", "False", "None",
    "forward", "fd", "backward", "back", "bk", "right", "rt", "left", "lt", "goto", "setpos", "setx", "sety",
    "setheading", "seth", "home", "circle", "penup", "pu", "up", "pendown", "pd", "down", "speed", "color",
    "pencolor", "fillcolor", "width", "pensize", "begin_fill", "end_fill", "dot", "write", "bgcolor", "clear",
    "reset", "hideturtle", "ht", "showturtle", "st", "position", "pos", "xcor", "ycor", "heading", "distance", "done"
  ];

  function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    var d = [];
    for (var i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (var j = 0; j <= b.length; j++) { d[0][j] = j; }
    for (i = 1; i <= a.length; i++) {
      for (j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[a.length][b.length];
  }

  /* Nom proche (majuscules ou une lettre de différence) parmi ceux du programme et de Python. */
  function similarName(name, code) {
    var own = (code || "").replace(STRING_RE, '""').replace(/#.*$/gm, "").match(/[A-Za-z_\u00C0-\u024F][\w\u00C0-\u024F]*/g) || [];
    var pool = KNOWN_NAMES.concat(global.EXTRA_KNOWN_NAMES || [], own).filter(function (x, i, arr) { return x !== name && arr.indexOf(x) === i && !KEYWORDS.test(x); });
    for (var i = 0; i < pool.length; i++) {
      if (pool[i].toLowerCase() === name.toLowerCase()) return pool[i];
    }
    if (name.length < 4) return null;
    for (i = 0; i < pool.length; i++) {
      if (pool[i].length >= 4 && editDistance(pool[i].toLowerCase(), name.toLowerCase()) === 1) return pool[i];
    }
    return null;
  }

  /* Message pour « name 'x' is not defined » : variable ou commande, définie plus loin, faute de frappe ? */
  function nameErrorMessage(name, line, code) {
    var lines = (code || "").split("\n");
    var where = line ? " (ligne " + line + ")" : "";
    if ((name === "Turtle" || name === "Screen") && global.TURTLE_MODULE_SRC) {
      return name + "() n'est pas utilisé dans ce cours" + where + " : il n'y a qu'une seule tortue. " +
        "Écrivez directement les commandes, par exemple forward(100) ou left(90), sans « t. » devant.";
    }
    var lineText = line && lines[line - 1] ? lines[line - 1].replace(STRING_RE, '""') : "";
    var isCall = new RegExp("(^|[^\\w.])" + name + "\\s*\\(").test(lineText);
    var src = (code || "").replace(STRING_RE, '""');
    var tortueImportee = /^\s*from\s+turtle\s+import\b/m.test(src);
    var COMMANDES_TORTUE = KNOWN_NAMES.slice(KNOWN_NAMES.indexOf("forward"));

    // commande de la tortue sans « from turtle import * »
    if (isCall && COMMANDES_TORTUE.indexOf(name) >= 0 && !tortueImportee) {
      return global.TURTLE_MODULE_SRC
        ? name + "() est une commande de la tortue" + where + " : ajoutez « from turtle import * » au début du programme."
        : name + "() est une commande de la tortue, qui n'est pas disponible dans cet exercice" + where + ".";
    }
    // « t.forward(10) » sans Turtle()
    var pt = new RegExp("(^|[^\\w.])" + name + "\\.([A-Za-z_]\\w*)\\s*\\(").exec(lineText);
    if (pt && global.TURTLE_MODULE_SRC && COMMANDES_TORTUE.indexOf(pt[2]) >= 0) {
      return "Dans ce cours, on écrit les commandes directement, sans « " + name + ". » devant" + where + " : écrivez " + pt[2] + "(…).";
    }
    var jamaisDefini = !new RegExp("^\\s*(" + name + "\\s*=(?!=)|def\\s+" + name + "\\b|for\\s+" + name + "\\s+in\\b)", "m").test(src);
    // couleur sans guillemets : color(red)
    var coul = new RegExp("\\b(color|pencolor|fillcolor|bgcolor|dot)\\s*\\([^)]*\\b" + name + "\\b").exec(lineText);
    if (coul && jamaisDefini) {
      return "Pour une couleur, il faut des guillemets" + where + " : " + coul[1] + "(\"" + name + "\").";
    }
    // texte sans guillemets : print(Bonjour)
    var txt = new RegExp("\\b(print|write)\\s*\\([^)]*\\b" + name + "\\b").test(lineText);
    var texteSansGuillemets = txt && jamaisDefini && !similarName(name, code) && name.length >= 4 &&
      ["math", "random", "time", "turtle"].indexOf(name) < 0;

    // Défini plus bas dans le programme ?
    var defLine = 0, setLine = 0;
    var defRe = new RegExp("^\\s*def\\s+" + name + "\\s*\\(");
    // seule une vraie affectation (x = …) ou un for donne une valeur ; « x += 1 » suppose que x existe déjà
    var setRe = new RegExp("^\\s*(" + name + "\\s*=(?!=)|for\\s+" + name + "\\s+in\\b)");
    var modifRe = new RegExp("^\\s*" + name + "\\s*(?:[-+*/%]|//|\\*\\*)=");
    for (var i = (line || 0); i < lines.length; i++) {
      if (!defLine && defRe.test(lines[i])) defLine = i + 1;
      if (!setLine && setRe.test(lines[i])) setLine = i + 1;
    }

    // commande définie seulement à l'intérieur d'une autre commande
    if (isCall && !new RegExp("^def\\s+" + name + "\\s*\\(", "m").test(src)) {
      for (var j = 0; j < lines.length; j++) {
        var dm = new RegExp("^(\\s+)def\\s+" + name + "\\s*\\(").exec(lines[j].replace(/\t/g, "    "));
        if (!dm) continue;
        for (var k = j - 1; k >= 0; k--) {
          var em = /^(\s*)def\s+([A-Za-z_]\w*)\s*\(/.exec(lines[k].replace(/\t/g, "    "));
          if (em && em[1].length < dm[1].length) {
            return "La commande « " + name + " »" + (line ? ", utilisée ligne " + line + "," : "") + " est définie à l'intérieur de « " + em[2] +
              " » (ligne " + (j + 1) + ") : elle ne peut être utilisée que dans « " + em[2] + " ». Si elle doit servir ailleurs, enlevez le décalage de son def.";
          }
        }
      }
    }
    var guess = similarName(name, code);
    var tip = guess ? " Vouliez-vous écrire « " + guess + " » ?" : "";

    if (isCall) {
      if (defLine) {
        return "La commande « " + name + " » est utilisée" + where + " avant d'être définie : son def est plus bas, ligne " +
          defLine + ". Déplacez l'appel après la définition.";
      }
      return "La commande « " + name + " » n'existe pas" + where + "." + (tip ||
        " Vérifiez l'orthographe et les majuscules, et qu'elle est bien définie avec def avant d'être utilisée.");
    }
    if (setLine) {
      return "La variable « " + name + " » est utilisée" + where + " avant de recevoir sa valeur : elle ne la reçoit que plus bas, ligne " +
        setLine + ".";
    }
    if (texteSansGuillemets) {
      return "La variable « " + name + " » n'existe pas" + where + ". Si c'est un texte, mettez-le entre guillemets : \"" + name + "\".";
    }
    if (lines.some(function (l) { return modifRe.test(l); })) {
      return "La variable « " + name + " » est utilisée" + where + " avant d'avoir été définie : donnez-lui d'abord une valeur avec =.";
    }
    return "La variable « " + name + " » n'existe pas" + where + " : elle n'a reçu aucune valeur." + (tip ||
      " Donnez-lui d'abord une valeur avec =, et vérifiez l'orthographe et les majuscules.");
  }

  /* Nom d'un type Python pour un élève, en gardant le nom Python entre parenthèses. */
  function typeName(t) {
    var names = {
      int: "un nombre entier (int)", float: "un nombre à virgule (float)", str: "un texte (str)",
      bool: "un booléen (bool)", list: "une liste (list)", tuple: "un tuple (tuple)", dict: "un dictionnaire (dict)",
      NoneType: "None (aucune valeur)", "function": "une commande (function)"
    };
    return names[t] || "une valeur de type " + t;
  }

  function typeHint(a, b, code) {
    var types = [a, b];
    var hasStr = types.indexOf("str") >= 0;
    var hasNum = types.indexOf("int") >= 0 || types.indexOf("float") >= 0;
    if (hasStr && hasNum) {
      return " Transformez le nombre en texte avec str(…), ou le texte en nombre avec int(…).";
    }
    return "";
  }

  /* Erreurs fréquentes (types, appels, conversions…) traduites en français ; null si inconnue. */
  function translateCommon(raw, where, code) {
    var m;
    if ((m = raw.match(/'(\w+)' object is not iterable/))) {
      return "Erreur de type" + where + " : on ne peut pas parcourir " + typeName(m[1]) + " avec for. " +
        "Pour répéter plusieurs fois, écrivez par exemple for i in range(5):";
    }
    if ((m = raw.match(/module '(\w+)' has no attribute '(\w+)'/))) {
      return "« " + m[2] + " » n'existe pas dans le module " + m[1] + where + ". Vérifiez l'orthographe.";
    }
    if ((m = raw.match(/'(\w+)' object has no attribute '(\w+)'/))) {
      if (m[1] === "NoneType") return "La valeur vaut None (aucune valeur)" + where + " : on ne peut pas utiliser « ." + m[2] + " » dessus.";
      return "« ." + m[2] + " » n'existe pas pour " + typeName(m[1]) + where + ". Vérifiez l'orthographe.";
    }
    if (/can only concatenate tuple/.test(raw)) {
      return "Erreur de type" + where + " : une des valeurs contient plusieurs nombres séparés par une virgule (un tuple). " +
        "Attention : les nombres à virgule s'écrivent avec un point, par exemple 3.5 et non 3,5.";
    }
    if ((m = raw.match(/'(\w+)' (?:object )?does not support item assignment/))) {
      return "Erreur de type" + where + " : on ne peut pas modifier un élément d" + (m[1] === "str" ? "'un texte (str) : un texte ne se modifie pas, il faut en créer un nouveau." : "e " + typeName(m[1]) + ".");
    }
    if ((m = raw.match(/(int|float)\(\) argument must be [^']*'(\w+)'/))) {
      return "Erreur de type" + where + " : " + m[1] + "() ne peut pas transformer " + typeName(m[2]) + " en nombre.";
    }
    if (/a float is required/.test(raw)) {
      return "Erreur de type" + where + " : il faut ici un nombre, et non un texte ou une autre valeur.";
    }
    if ((m = raw.match(/(list|string|tuple) indices must be integers(?: or slices)?, not (\w+)/))) {
      return "Erreur de type" + where + " : la position dans " + (m[1] === "string" ? "un texte" : "une liste") +
        " doit être un nombre entier (int), et non " + typeName(m[2]) + ".";
    }
    if (/takes no keyword arguments/.test(raw)) {
      var ln = (raw.match(/on line (\d+)/) || [])[1], txt = ln ? String(code || "").split("\n")[ln - 1] || "" : "";
      var k = txt.match(/([A-Za-z_]\w*)\s*\([^)]*?\b([A-Za-z_]\w*)\s*=(?!=)/);
      return (k ? k[1] + "() n'accepte pas la forme « " + k[2] + "=… » ici" : "Cette commande n'accepte pas la forme « nom=valeur » ici") +
        where + " : écrivez seulement les valeurs, dans l'ordre.";
    }
    if ((m = raw.match(/^KeyError: (.*?)(?: on line \d+)?$/))) {
      return "Clé introuvable" + where + " : la clé « " + m[1].replace(/^'(.*)'$/, "$1") + " » n'existe pas dans ce dictionnaire.";
    }
    // --- Erreurs de type ---
    if ((m = raw.match(/unsupported operand type\(s\) for ([^:]+): '(\w+)' and '(\w+)'/))) {
      return "Erreur de type" + where + " : on ne peut pas utiliser " + m[1].trim() + " entre " + typeName(m[2]) +
        " et " + typeName(m[3]) + "." + typeHint(m[2], m[3], code);
    }
    if ((m = raw.match(/cannot concatenate '(\w+)' and '(\w+)' objects/))) {
      return "Erreur de type" + where + " : on ne peut pas utiliser + entre " + typeName(m[1]) + " et " + typeName(m[2]) +
        "." + typeHint(m[1], m[2], code);
    }
    if ((m = raw.match(/can't multiply sequence by non-int of type '(\w+)'/))) {
      return "Erreur de type" + where + " : un texte (str) ou une liste ne peut être multiplié que par un nombre entier (int), pas par " +
        typeName(m[1]) + ".";
    }
    if ((m = raw.match(/'([^']+)' not supported between instances of '(\w+)' and '(\w+)'/))) {
      return "Erreur de type" + where + " : on ne peut pas comparer avec " + m[1] + " " + typeName(m[2]) + " et " +
        typeName(m[3]) + "." + typeHint(m[2], m[3], code);
    }
    if ((m = raw.match(/object of type '(\w+)' has no len\(\)/))) {
      return "Erreur de type" + where + " : len() ne s'applique pas à " + typeName(m[1]) +
        ", seulement à un texte (str) ou à une liste (list).";
    }
    if ((m = raw.match(/'(\w+)' object cannot be interpreted as an integer/))) {
      return "Erreur de type" + where + " : il faut ici un nombre entier (int), pas " + typeName(m[1]) + "." +
        "";
    }
    if ((m = raw.match(/'(\w+)' object is not callable/))) {
      return "Erreur de type" + where + " : vous utilisez comme une commande, avec des parenthèses, " + typeName(m[1]) +
        ". Vérifiez qu'une variable ne porte pas le même nom qu'une commande.";
    }
    // --- Erreurs d'appel de commande ---
    if ((m = raw.match(/(\w+)\(\) missing (\d+) required (?:positional )?arguments?: (.+?)(?: on line \d+)?$/))) {
      var params = m[3].replace(/'/g, "").split(/\s*,\s*|\s+and\s+/).filter(Boolean);
      var plural = params.length > 1;
      var list = plural ? params.slice(0, -1).join(", ") + " et " + params[params.length - 1] : params[0];
      return "La commande " + m[1] + "() attend " + (plural ? "des valeurs pour " : "une valeur pour ") + list +
        ", mais " + (plural ? "elles manquent" : "il n'y en a pas") + " dans l'appel" + where + ". Ajoutez-" +
        (plural ? "les" : "la") + ", par exemple " + m[1] + "(" + params.map(function () { return "…"; }).join(", ") +
        "), ou enlevez " + list + " de la définition si la commande n'en a pas besoin.";
    }
    if ((m = raw.match(/(\w+)\(\) takes (\d+) positional arguments?\s+but (\d+) (?:was|were)\s+given/))) {
      if (+m[2] === 0) {
        return "La commande " + m[1] + "() ne prend aucune valeur entre parenthèses, mais elle en a reçu " + m[3] + where +
          ". Écrivez simplement " + m[1] + "(), ou ajoutez un paramètre à sa définition.";
      }
      return "La commande " + m[1] + "() attend " + m[2] + " valeur" + (+m[2] > 1 ? "s" : "") +
        " entre parenthèses, mais elle en a reçu " + m[3] + where + ".";
    }
    // --- Autres erreurs fréquentes ---
    if (/ZeroDivisionError/.test(raw)) {
      return "Division par zéro" + where + " : on ne peut pas diviser par 0.";
    }
    if ((m = raw.match(/invalid literal for int\(\) with base \d+: '(.*)'/))) {
      return "Conversion impossible" + where + " : int() ne peut pas transformer « " + m[1] + " » en nombre entier (int)." +
        "";
    }
    if ((m = raw.match(/could not convert string to float: '(.*)'/))) {
      return "Conversion impossible" + where + " : float() ne peut pas transformer « " + m[1] + " » en nombre à virgule (float)." +
        (/,/.test(m[1]) ? " En Python, les nombres à virgule s'écrivent avec un point : 3.5." : "");
    }
    if ((m = raw.match(/(list|string|tuple) index out of range/))) {
      return "Erreur d'indice" + where + " : cette position est en dehors " + (m[1] === "string" ? "du texte" : "de la liste") +
        ", il n'y a pas d'élément à cette position. Les positions commencent à 0 et vont jusqu'à len(…) - 1.";
    }
    return null;
  }

  /*
   * « UnboundLocalError » : dans une commande (def), un nom est modifié (x = …, x += …),
   * donc Python le considère comme une variable de la commande, utilisée avant d'avoir reçu une valeur.
   * On montre la ligne où le nom est modifié, c'est là qu'est l'erreur.
   */
  function unboundMessage(name, line, code) {
    var lines = String(code || "").split("\n");
    var re = new RegExp("^\\s*" + name + "\\s*([-+*/%]|//|\\*\\*)?=(?!=)");
    var at = null, op = "=";
    for (var i = 0; i < lines.length; i++) {
      var mm = re.exec(lines[i].replace(/#.*$/, ""));
      if (mm && /^\s/.test(lines[i])) { at = i + 1; op = (mm[1] || "") + "="; break; } // dans une commande (ligne décalée)
    }
    var ici = at ? " (ligne " + at + ")" : "";
    var cmd = KNOWN_NAMES.indexOf(name) >= 0 || (global.EXTRA_KNOWN_NAMES || []).indexOf(name) >= 0;
    if (cmd) {
      return { line: at || line, message: "« " + name + " " + op + " … »" + ici + " : " + name +
        " est une commande, pas une variable, on ne peut pas la modifier." };
    }
    return { line: at || line, message: "La variable « " + name + " » est utilisée" + (line ? " ligne " + line : "") +
      " avant d'avoir reçu une valeur dans la commande" + (at ? " (elle est modifiée ligne " + at + ")" : "") + ". " +
      "Donnez-lui une valeur dans la commande avant de l'utiliser, ou passez-la en paramètre." };
  }

  /* Transforme une erreur Python (forme « TypeError: … on line 3 ») en message compréhensible par un élève. */
  function translateError(err, code) {
    var raw = err && err.toString ? err.toString() : String(err);
    var line = null;
    if (err && err.traceback && err.traceback.length) {
      line = err.traceback[0].lineno;
    }
    var m = raw.match(/on line (\d+)/);
    if (!line && m) line = +m[1];
    var where = line ? " (ligne " + line + ")" : "";
    var detail = raw.replace(/\s*on line \d+\.?\s*$/, "");
    var msg, common;

    if (/can't assign to literal/.test(raw)) {
      msg = "À gauche du « = », il faut un nom de variable" + where + " : par exemple x = 5, et non 5 = x.";
    } else if (/'return' outside function/.test(raw)) {
      msg = "« return » ne peut être utilisé que dans une commande (def)" + where + ".";
    } else if (/RecursionError|Maximum call stack/.test(raw)) {
      msg = "Erreur de récursion" + where + " : trop d'appels imbriqués, une commande s'appelle elle-même sans jamais s'arrêter.";
    } else if (/TimeLimitError/.test(raw)) {
      msg = "Le programme met trop de temps à s'exécuter : y a-t-il une boucle qui ne s'arrête jamais ?";
    } else if (/composantes de la couleur/.test(raw)) {
      var cc = detail.replace(/^\w+Error:\s*/, ""), k = cc.indexOf(" : ");
      msg = cc.slice(0, k) + where + cc.slice(k) + ".";
    } else if (/^InputIndisponible/.test(raw)) {
      msg = "Navigateur trop ancien" + where + " : input() a besoin d'un navigateur récent (Chrome ou Edge 137, Firefox 153, Safari 27, " +
        "ou plus récent). Mettez votre navigateur à jour, ou écrivez la valeur directement dans le programme, par exemple n = 5.";
    } else if (/La tortue|attend un nombre|attend deux nombres|Couleur invalide|entre les parenthèses/.test(raw) ||
               (global.Jeu && /^RuntimeError: Robi /.test(raw))) { // messages du jeu Robi (seulement si jeu.js est chargé)
      msg = detail.replace(/^\w+Error:\s*/, "") + where + ".";
    } else if ((m = raw.match(/NameError: name '(\w+)' is not defined/))) {
      msg = nameErrorMessage(m[1], line, code);
    } else if ((m = raw.match(/UnboundLocalError: local variable '(\w+)' referenced before assignment/))) {
      var u = unboundMessage(m[1], line, code);
      line = u.line;
      msg = u.message;
    } else if (/SyntaxError|IndentationError/.test(raw)) {
      var d = diagnoseSyntax(code, line);
      if (d) {
        line = d.line;
        msg = d.message;
      } else {
        msg = "Erreur de syntaxe" + where + " : Python ne comprend pas cette ligne. " +
              "Vérifiez les virgules, les parenthèses, les guillemets et les opérateurs (+, -, =…).";
      }
    } else if ((common = translateCommon(raw, where, code))) {
      msg = common;
    } else if (/ImportError|ModuleNotFoundError/.test(raw)) {
      var mod = (raw.match(/No module named '?([\w.]+)'?/) || [])[1] || "";
      if (mod === "turtle") {
        msg = "La tortue n'est pas disponible dans cet exercice" + where + " : enlevez la ligne « from turtle import * ».";
      } else {
        msg = "Le module « " + (mod || "?") + " » n'existe pas ou n'est pas disponible ici" + where +
              ". Vérifiez son nom" + (global.TURTLE_MODULE_SRC ? " (pour la tortue : « from turtle import * »)." : ".");
      }
    } else {
      // erreur non prévue : le type d'erreur en français, sans le nom anglais
      var kinds = { TypeError: "Erreur de type", ValueError: "Erreur de valeur", IndexError: "Erreur d'indice",
        KeyError: "Erreur de clé", AttributeError: "Erreur d'attribut", RecursionError: "Erreur de récursion",
        OverflowError: "Erreur de dépassement", ZeroDivisionError: "Erreur de division par zéro" };
      var kind = (detail.match(/^(\w+Error):\s*/) || [])[1];
      msg = (kinds[kind] || "Erreur") + where + " : " + detail.replace(/^\w+(Error|Exception):\s*/, "");
    }
    return { message: avecType(msg, raw), raw: raw, line: line };
  }

  /*
   * Chaque message commence par le type d'erreur : « Erreur de syntaxe : … », « Erreur de type (ligne 3) : … »,
   * comme l'erreur du vrai Python (raw). Ce que Python accepte mais que le cours refuse commence par « Règle du cours ».
   */
  function typeErreur(raw, msg) {
    if (/^(TooManyInputs|InputIndisponible|LoadError)/.test(raw) || /^RuntimeError: Robi /.test(raw)) return null; // vérification, jeu Robi
    // Ce que le vrai Python accepte, mais que le cours refuse
    if (/^(IndentationRule|ImportRule|DuplicateDefinition|ShadowRule)/.test(raw) ||
        /^Les noms ne peuvent pas contenir d'accent/.test(msg) || /n'est pas utilisé dans ce cours/.test(msg)) return "Règle du cours";
    if (/^(IndentationRule|IndentationError)/.test(raw)) return "Erreur d'indentation";
    if (/^SyntaxError/.test(raw)) {
      return /^(Le bloc de|La ligne \d+ se termine par « : »|Indentation inattendue|La ligne \d+ mélange|Il manque une indentation)/.test(msg)
        ? "Erreur d'indentation" : "Erreur de syntaxe";
    }
    if (/^(ImportRule|ImportError|ModuleNotFoundError)/.test(raw)) return "Erreur d'import";
    if (/^DuplicateDefinition/.test(raw)) return "Erreur de définition";
    if (/^(ShadowRule|NameError|UnboundLocalError)/.test(raw)) return "Erreur de nom";
    if (/^TypeError/.test(raw)) return "Erreur de type";
    if (/^ValueError/.test(raw)) return "Erreur de valeur";
    if (/^ZeroDivisionError/.test(raw)) return "Erreur de division par zéro";
    if (/^IndexError/.test(raw)) return "Erreur d'indice";
    if (/^KeyError/.test(raw)) return "Erreur de clé";
    if (/^AttributeError/.test(raw)) return "Erreur d'attribut";
    if (/RecursionError|Maximum call stack/.test(raw)) return "Erreur de récursion";
    if (/TimeLimitError/.test(raw)) return "Temps dépassé";
    if (/^OverflowError/.test(raw)) return "Erreur de dépassement";
    if (/^RuntimeError/.test(raw)) return "Erreur d'exécution";
    return "Erreur";
  }
  var ANCIENS_LIBELLES = /^(Division par zéro|Conversion impossible|Clé introuvable|Indentation inattendue|Erreur(?: d[e'][^(:]*?)?)( \(ligne \d+\))? : /;
  function minuscule(t) {
    var m = t.match(/^([A-ZÀ-Ý][a-zà-ÿ'’]*)(.?)/);
    if (!m || m[2] === "(" || /^(Python|Robi|Tab|True|False|None)$/.test(m[1])) return t;
    return t.charAt(0).toLowerCase() + t.slice(1);
  }
  function avecType(msg, raw) {
    var type = typeErreur(String(raw || ""), msg);
    if (!type || !msg) return msg;
    var m;
    if ((m = msg.match(ANCIENS_LIBELLES))) return type + (m[2] || "") + " : " + msg.slice(m[0].length);
    if ((m = msg.match(/^Ligne (\d+) : /))) msg = msg.slice(m[0].length);
    if (type === "Règle du cours") msg = msg.replace(/^dans ce cours, /i, "");
    if (m) return type + " (ligne " + m[1] + ") : " + msg;
    return type + " : " + minuscule(msg);
  }

  // Python se charge dès l'ouverture de la page, pendant que l'élève lit l'énoncé
  if (global.document && global.Worker) demarrer();

  global.PyEngine = { run: run, callFunction: callFunction, getFunction: getFunction, translateError: translateError };
})(typeof window !== "undefined" ? window : globalThis);
