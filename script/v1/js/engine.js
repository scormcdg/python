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

  function run(code, onOutput) {
    var Sk = global.Sk;
    var output = "";
    if (global.TurtleRec) global.TurtleRec.reset(); // la tortue est facultative
    var dup = findIndentProblem(code) || findForbiddenImport(code) || findDuplicateDef(code);
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

  /*
   * Règle de la classe : 4 espaces par niveau d'indentation, partout.
   * Python accepterait 2 ou 3 espaces s'ils sont réguliers ; ici on refuse,
   * et on désigne la ligne fautive (celle qui n'a pas le bon nombre d'espaces).
   */
  var INDENT = 4;

  function findIndentProblem(code) {
    var lines = hideTripleQuotes(code || "").split("\n");
    var prev = null; // dernière ligne de code : {indent, text}
    for (var i = 0; i < lines.length; i++) {
      var n = i + 1;
      var t = lines[i].replace(/\t/g, "    ").replace(STRING_RE, '""').replace(/#.*$/, "").replace(/\s+$/, "");
      if (!t.trim()) continue;
      var indent = t.length - t.replace(/^\s+/, "").length;
      var afterHeader = prev && /:$/.test(prev.text);
      var expected = null;
      if (afterHeader && indent > prev.indent && indent !== prev.indent + INDENT) {
        expected = prev.indent + INDENT;
      } else if (indent % INDENT !== 0) {
        expected = prev && Math.abs(indent - prev.indent) < INDENT ? prev.indent : Math.round(indent / INDENT) * INDENT;
      }
      if (expected !== null) {
        return {
          line: n,
          raw: "IndentationRule",
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
    if ((name === "Turtle" || name === "Screen") && global.TURTLE_MODULE_SRC) {
      return name + "() n'est pas utilisé dans ce cours" + where + " : il n'y a qu'une seule tortue. " +
        "Écrivez directement les commandes, par exemple forward(100) ou left(90), sans « t. » devant.";
    }
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

  /* Nom d'un type Python pour un élève, en gardant le nom Python entre parenthèses. */
  function typeName(t) {
    var names = {
      int: "un nombre entier (int)", float: "un nombre à virgule (float)", str: "un texte (str)",
      bool: "un booléen (bool)", list: "une liste (list)", tuple: "un tuple (tuple)", dict: "un dictionnaire (dict)",
      NoneType: "None (aucune valeur)", "function": "une commande (function)"
    };
    return names[t] || "une valeur de type " + t;
  }

  function typeHint(a, b) {
    var types = [a, b];
    var hasStr = types.indexOf("str") >= 0;
    var hasNum = types.indexOf("int") >= 0 || types.indexOf("float") >= 0;
    if (types.indexOf("NoneType") >= 0) {
      return " Une des valeurs vaut None : peut-être le résultat d'une commande qui ne renvoie rien (sans return) ?";
    }
    if (hasStr && hasNum) {
      return " Transformez le nombre en texte avec str(…), ou le texte en nombre avec int(…)." +
        " Attention : input() donne toujours un texte (str).";
    }
    return "";
  }

  /* Erreurs fréquentes (types, appels, conversions…) traduites en français ; null si inconnue. */
  function translateCommon(raw, where) {
    var m;
    // --- Erreurs de type ---
    if ((m = raw.match(/unsupported operand type\(s\) for ([^:]+): '(\w+)' and '(\w+)'/))) {
      return "Erreur de type" + where + " : on ne peut pas utiliser " + m[1].trim() + " entre " + typeName(m[2]) +
        " et " + typeName(m[3]) + "." + typeHint(m[2], m[3]);
    }
    if ((m = raw.match(/cannot concatenate '(\w+)' and '(\w+)' objects/))) {
      return "Erreur de type" + where + " : on ne peut pas utiliser + entre " + typeName(m[1]) + " et " + typeName(m[2]) +
        "." + typeHint(m[1], m[2]);
    }
    if ((m = raw.match(/can't multiply sequence by non-int of type '(\w+)'/))) {
      return "Erreur de type" + where + " : un texte (str) ou une liste ne peut être multiplié que par un nombre entier (int), pas par " +
        typeName(m[1]) + ".";
    }
    if ((m = raw.match(/'([^']+)' not supported between instances of '(\w+)' and '(\w+)'/))) {
      return "Erreur de type" + where + " : on ne peut pas comparer avec " + m[1] + " " + typeName(m[2]) + " et " +
        typeName(m[3]) + "." + typeHint(m[2], m[3]);
    }
    if ((m = raw.match(/object of type '(\w+)' has no len\(\)/))) {
      return "Erreur de type" + where + " : len() ne s'applique pas à " + typeName(m[1]) +
        ", seulement à un texte (str) ou à une liste (list).";
    }
    if ((m = raw.match(/'(\w+)' object cannot be interpreted as an integer/))) {
      return "Erreur de type" + where + " : il faut ici un nombre entier (int), pas " + typeName(m[1]) + "." +
        (m[1] === "str" ? " Si la valeur vient de input(), transformez-la avec int(…)." : "");
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
        " Vérifiez la valeur, par exemple la réponse tapée à input().";
    }
    if ((m = raw.match(/could not convert string to float: '(.*)'/))) {
      return "Conversion impossible" + where + " : float() ne peut pas transformer « " + m[1] + " » en nombre à virgule (float)." +
        (/,/.test(m[1]) ? " En Python, les nombres à virgule s'écrivent avec un point : 3.5." : "");
    }
    if ((m = raw.match(/(list|string|tuple) index out of range/))) {
      return "Position en dehors " + (m[1] === "string" ? "du texte" : "de la liste") + where +
        " : il n'y a pas d'élément à cette position. Les positions commencent à 0 et vont jusqu'à len(…) - 1.";
    }
    return null;
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
    var msg, common;

    if (/TimeLimitError/.test(raw)) {
      msg = "Le programme met trop de temps à s'exécuter : y a-t-il une boucle qui ne s'arrête jamais ?";
    } else if (/La tortue|attend un nombre|Couleur invalide|entre les parenthèses/.test(raw)) {
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
    } else if ((common = translateCommon(raw, where))) {
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
      var kinds = { TypeError: "Erreur de type", ValueError: "Valeur incorrecte", IndexError: "Position incorrecte",
        KeyError: "Clé introuvable", AttributeError: "Attribut inconnu", RecursionError: "Trop d'appels imbriqués",
        OverflowError: "Nombre trop grand", ZeroDivisionError: "Division par zéro" };
      var kind = (detail.match(/^(\w+Error):\s*/) || [])[1];
      msg = (kinds[kind] || "Erreur") + where + " : " + detail.replace(/^\w+(Error|Exception):\s*/, "");
    }
    return { message: msg, raw: raw, line: line };
  }

  global.PyEngine = { run: run, callFunction: callFunction, getFunction: getFunction, translateError: translateError };
})(typeof window !== "undefined" ? window : globalThis);
