/*
 * Moteur d'exécution Python (Skulpt) + traduction des erreurs en français.
 * Dépend de : skulpt.min.js, skulpt-stdlib.js, turtle.js
 */
(function (global) {
  "use strict";

  var TIME_LIMIT_MS = 5000;

  /*
   * input() : la question s'affiche dans la console, et l'élève tape sa réponse
   * juste après, dans la console (comme dans Thonny). Validation avec Entrée.
   */
  function askInConsole(prompt, out, getOutput) {
    var Sk = global.Sk;
    var question = prompt == null ? "" : String(prompt);
    out(question);
    var box = global.document && global.document.getElementById("console");
    if (!box) {
      var r = global.prompt(question);
      out((r || "") + "\n");
      return r || "";
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
        Sk.execStart = Date.now(); // le temps d'attente ne compte pas dans la limite de 5 s
        resolve(rep);
      });
    });
  }

  function configure(output, getOutput) {
    var Sk = global.Sk;
    var out = output || function () {};
    Sk.configure({
      output: out,
      inputfunTakesPrompt: true,
      inputfun: function (prompt) { return askInConsole(prompt, out, getOutput || function () { return ""; }); },
      read: function (path) {
        if (/^src\/lib\/turtle(\.js|\.py|\/)/.test(path)) {
          if (global.TURTLE_MODULE_SRC && path === "src/lib/turtle.js") return global.TURTLE_MODULE_SRC;
          throw "Fichier introuvable : " + path;
        }
        var files = Sk.builtinFiles && Sk.builtinFiles.files;
        if (!files || files[path] === undefined) throw "Fichier introuvable : " + path;
        return files[path];
      },
      __future__: Sk.python3,
      execLimit: TIME_LIMIT_MS,
      yieldLimit: 200,
      killableWhile: true,
      killableFor: true
    });
    // Le module turtle ne doit pas rester en cache d'une exécution à l'autre
    if (Sk.sysmodules && Sk.sysmodules.mp$ass_subscript) {
      try { Sk.sysmodules.mp$del_subscript(new Sk.builtin.str("turtle")); } catch (e) { /* absent */ }
    }
  }

  /* Exécute le programme de l'élève. Résout {module, error, output}. */
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

  function run(code, onOutput) {
    var Sk = global.Sk;
    var output = "";
    if (global.TurtleRec) global.TurtleRec.reset(); // la tortue est facultative
    var dup = findDuplicateDef(code);
    if (dup) return Promise.resolve({ module: null, error: dup, output: "" });
    configure(function (t) { output += t; if (onOutput) onOutput(t); }, function () { return output; });
    Sk.execStart = Date.now();
    return Sk.misceval
      .asyncToPromise(function () {
        return Sk.importMainWithBody("<stdin>", false, code, true);
      })
      .then(function (mod) { return { module: mod, error: null, output: output }; })
      .catch(function (err) { return { module: null, error: translateError(err, code), output: output }; });
  }

  /* Appelle une commande (sans argument) définie par l'élève, tortue remise à zéro. */
  function callFunction(mod, name) {
    var Sk = global.Sk;
    var fn = getFunction(mod, name);
    if (global.TurtleRec) global.TurtleRec.reset(); // la tortue est facultative
    Sk.execStart = Date.now();
    return Sk.misceval
      .asyncToPromise(function () { return Sk.misceval.callsimOrSuspendArray(fn, []); })
      .then(function () { return { error: null }; })
      .catch(function (err) { return { error: translateError(err) }; });
  }

  function getFunction(mod, name) {
    if (!mod || !mod.$d) return null;
    var f = mod.$d[name];
    if (!f || !(f instanceof global.Sk.builtin.func)) return null;
    return f;
  }

  /*
   * Skulpt signale presque toutes les fautes de frappe comme une simple
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

  function findSyntaxProblems(code) {
    var problems = [];
    var lines = hideTripleQuotes(code).split("\n");
    var prev = null; // {indent, text, n}
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

      // deux valeurs côte à côte : virgule (ou opérateur) oubliée
      var toks = raw.match(TOKEN_RE) || [];
      var cut = toks.indexOf("#");
      if (cut >= 0) toks = toks.slice(0, cut);
      if (toks[0] === "print" && toks.length > 1 && toks[1] !== "(") {
        problems.push({ line: n, message: "print s'écrit avec des parenthèses (ligne " + n + ") : par exemple print(\"Bonjour\")." });
      } else {
        for (var k = 0; k + 1 < toks.length; k++) {
          var endsValue = isValueToken(toks[k]) || /^[)\]}]$/.test(toks[k]);
          var isStr = function (x) { return /^(?:[rRbBfFuU]{1,2})?["']/.test(x); };
          if (isStr(toks[k]) && isStr(toks[k + 1])) continue; // "a" "b" est valide en Python
          if (endsValue && isValueToken(toks[k + 1])) {
            problems.push({ line: n, message: "Il manque une virgule (ou un opérateur comme +) entre « " + toks[k] +
              " » et « " + toks[k + 1] + " » à la ligne " + n + "." });
            break;
          }
        }
      }

      var opened = (t.match(/\(/g) || []).length, closed = (t.match(/\)/g) || []).length;
      if (opened > closed) {
        problems.push({ line: n, message: "Une parenthèse ouverte n'est pas fermée à la ligne " + n + "." });
      } else if (closed > opened) {
        problems.push({ line: n, message: "Il y a une parenthèse fermante en trop à la ligne " + n + "." });
      }
      if (blockHeader.test(t) && !/:\s*$/.test(t)) {
        problems.push({ line: n, message: "Il manque les deux-points « : » à la fin de la ligne " + n + "." });
      }
      if (prev && /:\s*$/.test(prev.text) && indent <= prev.indent) {
        problems.push({ line: n, message: "Il manque une indentation (ligne " + n + ") : les instructions à l'intérieur de « " +
          prev.text.trim() + " » doivent être décalées vers la droite." });
      } else if (prev && !/:\s*$/.test(prev.text) && indent > prev.indent) {
        problems.push({ line: n, message: "Indentation inattendue (ligne " + n + ") : cette ligne est décalée vers la droite alors qu'elle ne devrait pas l'être." });
      } else if (!prev && indent > 0) {
        problems.push({ line: n, message: "Indentation inattendue (ligne " + n + ") : la première instruction ne doit pas être décalée." });
      }
      prev = { indent: indent, text: code1, n: n };
    }
    return problems;
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
    var pool = KNOWN_NAMES.concat(own).filter(function (x, i, arr) { return x !== name && arr.indexOf(x) === i && !KEYWORDS.test(x); });
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
    var lineText = line && lines[line - 1] ? lines[line - 1].replace(STRING_RE, '""') : "";
    var isCall = new RegExp("(^|[^\\w.])" + name + "\\s*\\(").test(lineText);

    // Défini plus bas dans le programme ?
    var defLine = 0, setLine = 0;
    var defRe = new RegExp("^\\s*def\\s+" + name + "\\s*\\(");
    var setRe = new RegExp("^\\s*(" + name + "\\s*=(?!=)|" + name + "\\s*[-+*/]=|for\\s+" + name + "\\s+in\\b)");
    for (var i = (line || 0); i < lines.length; i++) {
      if (!defLine && defRe.test(lines[i])) defLine = i + 1;
      if (!setLine && setRe.test(lines[i])) setLine = i + 1;
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
    return "La variable « " + name + " » n'existe pas" + where + " : elle n'a reçu aucune valeur." + (tip ||
      " Donnez-lui d'abord une valeur, par exemple " + name + " = 0, et vérifiez l'orthographe et les majuscules.");
  }

  /* Transforme une erreur Skulpt en message compréhensible par un élève. */
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
    var msg;

    if (/TimeLimitError/.test(raw)) {
      msg = "Le programme met trop de temps à s'exécuter : y a-t-il une boucle qui ne s'arrête jamais ?";
    } else if (/La tortue|attend un nombre|Couleur invalide/.test(raw)) {
      msg = detail.replace(/^\w+Error:\s*/, "") + where + ".";
    } else if ((m = raw.match(/NameError: name '(\w+)' is not defined/))) {
      msg = nameErrorMessage(m[1], line, code);
    } else if (/SyntaxError|IndentationError/.test(raw)) {
      var d = diagnoseSyntax(code, line);
      if (d) {
        line = d.line;
        msg = d.message;
      } else {
        msg = "Erreur de syntaxe" + where + " : Python ne comprend pas cette ligne. " +
              "Vérifiez les virgules, les parenthèses, les guillemets et les opérateurs (+, -, =…).";
      }
    } else if ((m = raw.match(/TypeError: (\w+)\(\) takes (\d+) positional arguments?\s+but (\d+) (?:was|were)\s+given/))) {
      msg = "La commande " + m[1] + "() a reçu " + m[3] + " valeur(s) entre parenthèses alors qu'elle en attend " + m[2] + where + ".";
    } else if (/TypeError: '(\w+)' object is not callable/.test(raw)) {
      msg = "Vous essayez d'utiliser comme une commande quelque chose qui n'en est pas une" + where + ".";
    } else if (/ImportError|ModuleNotFoundError/.test(raw)) {
      var mod = (raw.match(/No module named '?([\w.]+)'?/) || [])[1] || "";
      if (mod === "turtle") {
        msg = "La tortue n'est pas disponible dans cet exercice" + where + " : enlevez la ligne « from turtle import * ».";
      } else {
        msg = "Le module « " + (mod || "?") + " » n'existe pas ou n'est pas disponible ici" + where +
              ". Vérifiez son nom" + (global.TURTLE_MODULE_SRC ? " (pour la tortue : « from turtle import * »)." : ".");
      }
    } else {
      msg = "Erreur" + where + " : " + detail;
    }
    return { message: msg, raw: raw, line: line };
  }

  global.PyEngine = { run: run, callFunction: callFunction, getFunction: getFunction, translateError: translateError };
})(typeof window !== "undefined" ? window : globalThis);
