/*
 * Vérificateur des exercices tortue.
 *  - géométrie : fusion des traits, comparaison de deux dessins
 *    (position libre, rotation / miroir / échelle selon les options)
 *  - analyse du code source : commandes définies, qui appelle qui
 *  - exécution des règles d'un exercice (voir data/serie03.js)
 * Dépend de : engine.js (PyEngine), turtle.js (TurtleRec)
 */
(function (global) {
  "use strict";

  var EPS_DIR = 0.01;   // tolérance de parallélisme (sinus de l'angle)
  var EPS_LINE = 0.75;  // tolérance d'alignement (pixels)
  var TOL = 2;          // tolérance de comparaison des extrémités (pixels)

  /* ------------------------------------------------------------------ */
  /* Géométrie                                                           */
  /* ------------------------------------------------------------------ */

  function len(s) { return Math.hypot(s.x2 - s.x1, s.y2 - s.y1); }

  /*
   * Fusionne les traits alignés qui se touchent ou se superposent :
   * un côté dessiné deux fois, ou en deux morceaux, ne compte qu'une fois.
   */
  function mergeSegments(segs, byColor) {
    var groups = [];
    segs.forEach(function (s) {
      var L = len(s);
      if (L < 1e-6) return;
      var ux = (s.x2 - s.x1) / L, uy = (s.y2 - s.y1) / L;
      var g = null;
      for (var i = 0; i < groups.length && !g; i++) {
        var G = groups[i];
        if (byColor && G.color !== s.color) continue;
        var parallel = Math.abs(G.ux * uy - G.uy * ux) < EPS_DIR;
        var collinear = Math.abs(G.ux * (s.y1 - G.y0) - G.uy * (s.x1 - G.x0)) < EPS_LINE;
        if (parallel && collinear) g = G;
      }
      if (!g) {
        g = { x0: s.x1, y0: s.y1, ux: ux, uy: uy, color: s.color, iv: [] };
        groups.push(g);
      }
      var t1 = (s.x1 - g.x0) * g.ux + (s.y1 - g.y0) * g.uy;
      var t2 = (s.x2 - g.x0) * g.ux + (s.y2 - g.y0) * g.uy;
      g.iv.push([Math.min(t1, t2), Math.max(t1, t2)]);
    });

    var out = [];
    groups.forEach(function (g) {
      g.iv.sort(function (a, b) { return a[0] - b[0]; });
      var cur = null;
      g.iv.forEach(function (iv) {
        if (cur && iv[0] <= cur[1] + EPS_LINE) {
          cur[1] = Math.max(cur[1], iv[1]);
        } else {
          if (cur) out.push(toSeg(g, cur));
          cur = [iv[0], iv[1]];
        }
      });
      if (cur) out.push(toSeg(g, cur));
    });
    return out;
  }

  function toSeg(g, iv) {
    return {
      x1: g.x0 + g.ux * iv[0], y1: g.y0 + g.uy * iv[0],
      x2: g.x0 + g.ux * iv[1], y2: g.y0 + g.uy * iv[1],
      color: g.color
    };
  }

  function transform(segs, mirror, theta, k) {
    var c = Math.cos(theta), s = Math.sin(theta);
    function p(x, y) {
      if (mirror) y = -y;
      return [k * (c * x - s * y), k * (s * x + c * y)];
    }
    return segs.map(function (g) {
      var a = p(g.x1, g.y1), b = p(g.x2, g.y2);
      return { x1: a[0], y1: a[1], x2: b[0], y2: b[1], color: g.color };
    });
  }

  function bboxMin(segs) {
    var mx = Infinity, my = Infinity;
    segs.forEach(function (s) {
      mx = Math.min(mx, s.x1, s.x2);
      my = Math.min(my, s.y1, s.y2);
    });
    return [mx, my];
  }

  function translate(segs, dx, dy) {
    return segs.map(function (s) {
      return { x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy, color: s.color };
    });
  }

  function near(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by) <= TOL; }

  /* Chaque trait de référence a-t-il un trait identique chez l'élève ? */
  function sameSet(A, B, byColor) {
    if (A.length !== B.length) return false;
    var used = new Array(B.length);
    for (var i = 0; i < A.length; i++) {
      var a = A[i], found = false;
      for (var j = 0; j < B.length && !found; j++) {
        if (used[j]) continue;
        var b = B[j];
        if (byColor && a.color !== b.color) continue;
        if ((near(a.x1, a.y1, b.x1, b.y1) && near(a.x2, a.y2, b.x2, b.y2)) ||
            (near(a.x1, a.y1, b.x2, b.y2) && near(a.x2, a.y2, b.x1, b.y1))) {
          used[j] = found = true;
        }
      }
      if (!found) return false;
    }
    return true;
  }

  /*
   * Compare le dessin de l'élève à celui de référence.
   * opts : rotate (orientation libre), mirror (symétrique accepté),
   *        scale (taille libre), color (couleurs vérifiées)
   * Résultat : { ok, reason } avec reason ∈ empty | count | size | shape
   */
  function compareDrawings(studentSegs, refSegs, opts) {
    opts = opts || {};
    var S = mergeSegments(studentSegs, opts.color);
    var R = mergeSegments(refSegs, opts.color);
    if (S.length === 0) return { ok: false, reason: "empty" };
    if (S.length !== R.length) {
      return { ok: false, reason: "count", student: S.length, expected: R.length };
    }

    var totalS = S.reduce(function (t, s) { return t + len(s); }, 0);
    var totalR = R.reduce(function (t, s) { return t + len(s); }, 0);

    // Trait de référence le plus long, à aligner successivement sur chaque trait de l'élève
    var r0 = R.reduce(function (a, b) { return len(b) > len(a) ? b : a; });
    var angR = Math.atan2(r0.y2 - r0.y1, r0.x2 - r0.x1);
    var rMin = bboxMin(R);
    var mirrors = opts.mirror ? [false, true] : [false];

    for (var m = 0; m < mirrors.length; m++) {
      var Sm = transform(S, mirrors[m], 0, 1);
      for (var j = 0; j < Sm.length; j++) {
        var s = Sm[j];
        var k = opts.scale ? len(r0) / len(s) : 1;
        if (!opts.scale && Math.abs(len(s) - len(r0)) > TOL) continue;
        var angS = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
        var thetas = opts.rotate ? [angR - angS, angR - angS + Math.PI] : [0];
        for (var t = 0; t < thetas.length; t++) {
          var T = transform(Sm, false, thetas[t], k);
          var tMin = bboxMin(T);
          T = translate(T, rMin[0] - tMin[0], rMin[1] - tMin[1]);
          if (sameSet(R, T, opts.color)) return { ok: true };
        }
      }
    }

    if (!opts.scale && Math.abs(totalS - totalR) / totalR > 0.05) {
      return { ok: false, reason: "size", bigger: totalS > totalR };
    }
    return { ok: false, reason: "shape" };
  }

  /* ------------------------------------------------------------------ */
  /* Analyse du code source                                              */
  /* ------------------------------------------------------------------ */

  function cleanLine(line) {
    return line
      .replace(/\t/g, "    ")
      .replace(/"[^"\n]*"|'[^'\n]*'/g, '""')
      .replace(/#.*$/, "")
      .replace(/\s+$/, "");
  }

  /* Découpe le code : corps de chaque def, et programme principal. */
  function analyzeSource(code) {
    var lines = code.split("\n").map(cleanLine);
    var defs = {};
    var params = {};
    var main = [];
    var current = null; // {name, indent}
    lines.forEach(function (line) {
      if (!line.trim()) return;
      var indent = line.length - line.replace(/^\s+/, "").length;
      if (current && indent <= current.indent) current = null;
      var m = line.match(/^(\s*)def\s+(\w+)\s*\(([^)]*)\)?/);
      if (m && !current) {
        current = { name: m[2], indent: indent };
        defs[m[2]] = defs[m[2]] || [];
        params[m[2]] = (m[3] || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean);
        return;
      }
      if (current) defs[current.name].push(line);
      else main.push(line);
    });
    var bodies = {};
    Object.keys(defs).forEach(function (k) { bodies[k] = defs[k].join("\n"); });
    return { defs: bodies, params: params, main: main.join("\n"), all: lines.join("\n") };
  }

  function callsIn(text, name) {
    var re = new RegExp("(^|[^\\w.])" + name + "\\s*\\(", "m");
    return re.test(text || "");
  }

  /*
   * caller : nom d'une commande, "<main>" (programme principal)
   * ou "<any>" (n'importe où sauf dans la commande elle-même)
   */
  function calls(src, caller, callee) {
    if (caller === "<main>") return callsIn(src.main, callee);
    if (caller === "<any>") {
      if (callsIn(src.main, callee)) return true;
      return Object.keys(src.defs).some(function (k) {
        return k !== callee && callsIn(src.defs[k], callee);
      });
    }
    return callsIn(src.defs[caller], callee);
  }

  /* ------------------------------------------------------------------ */
  /* Exécution des règles d'un exercice                                  */
  /* ------------------------------------------------------------------ */

  var refCache = {};

  /* Clé d'un dessin testé : la commande et ses valeurs, ex. "spirale(10,50)" */
  /*
   * Réponses données à input() pendant la vérification : celles de la règle (c.inputs),
   * sinon celles de l'exercice (ex.inputs), sinon aucune (input() demande à l'élève, comme avant).
   */
  function inputsOf(c, ex) { return (c && c.inputs) || ex.inputs || null; }
  function inputsKey(inputs) { return inputs ? JSON.stringify(inputs.map(String)) : ""; }
  function runOpts(inputs) { return inputs ? { inputs: inputs } : undefined; }

  function targetKey(c) {
    return c.target + (c.args ? "(" + c.args.join(",") + ")" : "") + (c.inputs ? "|" + inputsKey(c.inputs) : "");
  }

  /*
   * Jeux de réponses d'une règle « programme entier » (dessin ou couleurs) :
   * cases : [{ inputs }, …] teste plusieurs jeux (la règle réussit si tous réussissent) ; sinon un seul.
   */
  function casesOf(c, ex) {
    return c.cases ? c.cases.map(function (k) { return k.inputs || ex.inputs || null; }) : [inputsOf(c, ex)];
  }

  /* Commandes dessinées seules (pas le programme entier, traité à part) */
  function shapeTargets(ex) {
    var t = {};
    (ex.checks || []).forEach(function (c) { if (c.kind === "shape" && c.target !== "<program>") t[targetKey(c)] = c; });
    return Object.keys(t).map(function (k) { return t[k]; });
  }

  /* Couleurs écrites de la même façon : "#ff0000", "red", "rgb(255,0,0)" → "#ff0000" */
  var ctxCouleur = null;
  function normColor(c) {
    if (!global.document) return String(c);
    if (!ctxCouleur) ctxCouleur = global.document.createElement("canvas").getContext("2d");
    ctxCouleur.fillStyle = "#000000";
    ctxCouleur.fillStyle = String(c);
    return ctxCouleur.fillStyle;
  }
  /* Couleurs réellement utilisées par le dernier programme : traits dessinés et remplissages */
  function usedColors() {
    var T = global.TurtleRec, start = 0, pen = {}, fill = {};
    for (var i = T.path.length - 1; i >= 0; i--) { if (T.path[i].type === "clear") { start = i + 1; break; } }
    T.segments().forEach(function (s) { pen[normColor(s.color)] = true; });
    T.path.slice(start).forEach(function (m) { if (m.type === "fill") fill[normColor(m.color)] = true; });
    return { pen: Object.keys(pen).sort(), fill: Object.keys(fill).sort() };
  }
  function sameList(a, b) { return a.length === b.length && a.every(function (x, i) { return x === b[i]; }); }

  /* Exécution du programme entier avec des réponses données : dessin, couleurs, texte affiché */
  function runProgram(code, inputs) {
    return global.PyEngine.run(code, null, runOpts(inputs)).then(function (r) {
      return { run: r, segs: global.TurtleRec.segments(), colors: usedColors(), output: r.output, printed: r.printed };
    });
  }

  /* Règles qui portent sur le programme entier (dessin, couleurs, affichage) */
  function isProgramCheck(c) {
    return (c.kind === "shape" && c.target === "<program>") || c.kind === "colors" || c.kind === "output";
  }

  /* Clé d'un appel testé par une règle « call » : "call|moyenne|[12,15,9]" */
  function callKey(c, k) { return "call|" + c.name + "|" + JSON.stringify(k.args || []); }

  /* Dessins de référence, obtenus en exécutant la (ou les) solution(s). */
  function getReferences(ex) {
    if (refCache[ex.id]) return Promise.resolve(refCache[ex.id]);
    var targets = shapeTargets(ex);
    var refs = {};
    var progInputs = {}; // réponses distinctes utilisées par les règles « programme entier »
    targets.forEach(function (c) { refs[targetKey(c)] = []; });
    var appels = []; // règles « call » : un appel par jeu de valeurs
    (ex.checks || []).forEach(function (c) {
      if (c.kind !== "call") return;
      (c.cases || [{ args: c.args }]).forEach(function (k) {
        var cle = callKey(c, k);
        if (!refs[cle]) { refs[cle] = []; appels.push({ name: c.name, args: k.args || [], cle: cle }); }
      });
    });
    (ex.checks || []).forEach(function (c) {
      if (!isProgramCheck(c)) return;
      var liste = c.kind === "output" ? [inputsOf(c, ex)] : casesOf(c, ex);
      liste.forEach(function (inp) {
        var ik = inputsKey(inp);
        progInputs[ik] = inp;
        if (c.kind === "colors") refs["colors|" + ik] = [];
        if (c.kind === "shape") refs["dessin|" + ik] = [];
      });
    });
    var chain = Promise.resolve();
    (ex.solutions || []).forEach(function (sol) {
      chain = chain.then(function () {
        return global.PyEngine.run(sol, null, runOpts(ex.inputs)).then(function (r) {
          if (r.error) throw new Error("Solution de référence invalide (" + ex.id + ") : " + r.error.raw);
          var inner = Promise.resolve();
          targets.forEach(function (tc) {
            var t = tc.target, key = targetKey(tc);
            inner = inner.then(function () {
              return global.PyEngine.callFunction(r.module, t, tc.args).then(function (c) {
                if (c.error) throw new Error("Solution de référence invalide (" + ex.id + "/" + key + ") : " + c.error.raw);
                refs[key].push(global.TurtleRec.segments());
              });
            });
          });
          // Commandes testées par les règles « call » : valeur renvoyée et texte affiché
          appels.forEach(function (a) {
            inner = inner.then(function () {
              return global.PyEngine.callFunction(r.module, a.name, a.args).then(function (x) {
                if (x.error) throw new Error("Solution de référence invalide (" + ex.id + "/" + a.cle + ") : " + x.error.raw);
                refs[a.cle].push({ retour: x.retour, printed: x.printed || "" });
              });
            });
          });
          // Programme entier, une fois par jeu de réponses
          Object.keys(progInputs).forEach(function (ik) {
            inner = inner.then(function () {
              return runProgram(sol, progInputs[ik]).then(function (p) {
                if (p.run.error) throw new Error("Solution de référence invalide (" + ex.id + ", réponses " + ik + ") : " + p.run.error.raw);
                if (refs["dessin|" + ik]) refs["dessin|" + ik].push(p.segs);
                if (refs["colors|" + ik]) refs["colors|" + ik].push(p.colors);
              });
            });
          });
          return inner;
        });
      });
    });
    return chain.then(function () { refCache[ex.id] = refs; return refs; });
  }

  function reponsesTexte(inputs) {
    return inputs ? " (réponses données : " + inputs.join(", ") + ")" : "";
  }
  function colorsMessage(c, inputs, student, ref) {
    var parts = [];
    if (!sameList(student.pen, ref.pen)) parts.push("du trait");
    if (!sameList(student.fill, ref.fill)) parts.push("du remplissage");
    var debut = inputs ? "Avec les réponses " + inputs.join(", ") + ", la" : "La";
    return debut + (parts.length > 1 ? " couleur du trait et celle du remplissage ne sont pas les bonnes."
      : " couleur " + (parts[0] || "") + " n'est pas la bonne.") + (c.fail ? " " + c.fail : "");
  }

  /* Règle « call » : écriture Python des valeurs d'un appel, ex. moyenne(12, 15, "a", [1, 2]) */
  function enPython(v) {
    if (v === null || v === undefined) return "None";
    if (v === true) return "True";
    if (v === false) return "False";
    if (typeof v === "string") return v.indexOf("'") < 0 ? "'" + v + "'" : JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(enPython).join(", ") + "]";
    return String(v);
  }
  function appelTexte(c, k) { return c.name + "(" + (k.args || []).map(enPython).join(", ") + ")"; }
  /* Même valeur renvoyée ? Nombres : à 1e-9 près (4 et 4.0 sont égaux) ; sinon même écriture Python */
  function memeRetour(a, b) {
    if (!a || !b) return false;
    if (a.nombre != null && b.nombre != null) return Math.abs(a.nombre - b.nombre) <= 1e-9 * Math.max(1, Math.abs(a.nombre), Math.abs(b.nombre));
    return a.repr === b.repr;
  }
  /* returns (facultatif) : valeur imposée dans la règle, au lieu de celle de la solution */
  function retourImpose(v) {
    if (typeof v === "number") return { repr: String(v), nombre: v };
    if (typeof v === "string") return { repr: "'" + v + "'", nombre: null, texte: v };
    return { repr: enPython(v), nombre: null };
  }
  function memeTexteAffiche(a, b) {
    function norm(t) { return String(t || "").replace(/\r\n?/g, "\n").split("\n").map(function (l) { return l.replace(/\s+$/, ""); }).join("\n").replace(/\n+$/, ""); }
    return norm(a) === norm(b);
  }
  function court(t) { t = String(t); return t.length > 80 ? t.slice(0, 77) + "…" : t; }
  function afficheTexte(t) { return court(String(t || "").replace(/\s+$/, "").replace(/\n/g, " ⏎ ")); }

  /* Dessin comparé aux dessins des solutions : réussi si l'un d'eux correspond */
  function compareRefs(segs, refList, opts) {
    var res = null;
    for (var i = 0; i < refList.length; i++) {
      var r = compareDrawings(segs, refList[i], opts);
      if (r.ok) return r;
      if (!res) res = r; // on garde le diagnostic de la 1re référence
    }
    return res || { ok: false, reason: "shape" };
  }

  /* inputs : réponses utilisées pour ce dessin (affichées seulement si la règle en donne : c.inputs ou c.cases) */
  function shapeMessage(check, res, inputs) {
    var montrees = check.cases ? inputs : check.inputs;
    var appel = check.target + "(" + (check.args || []).join(", ") + ")";
    var who = check.target === "<program>" ? "Le dessin de votre programme" + reponsesTexte(montrees) : "Le dessin de " + appel;
    if (check.target === "<program>" && res.reason === "error") {
      return "Le programme provoque une erreur" + reponsesTexte(montrees) + " : " + res.error.message;
    }
    switch (res.reason) {
      case "empty":
        return check.target === "<program>"
          ? "La tortue n'a rien dessiné. Avez-vous bien appelé votre commande après l'avoir définie ?"
          : appel + " ne dessine rien.";
      case "count":
        return who + (res.student < res.expected
          ? " ne correspond pas à la figure attendue : il manque des traits."
          : " ne correspond pas à la figure attendue : il y a des traits en trop.");
      case "size":
        return who + " est trop " + (res.bigger ? "grand" : "petit") + " : vérifiez les longueurs.";
      case "function-missing":
        return "Impossible de tester : la commande " + check.target + "() n'est pas définie.";
      case "error":
        return appel + " provoque une erreur : " + res.error.message;
      default:
        return who + " ne correspond pas à la figure attendue.";
    }
  }

  /*
   * Indice ajouté au message d'échec d'un dessin, seulement quand il est pertinent.
   * hint : texte (formes et nombre de traits) ou { shape, count, size }.
   */
  function hintFor(check, res) {
    var h = check.hint;
    if (!h) return "";
    if (typeof h === "string") h = { shape: h, count: h };
    return h[res.reason] ? " " + h[res.reason] : "";
  }

  /*
   * Vérifie le code d'un élève pour un exercice.
   * Résout : { ok, error, results:[{id,label,ok,message}], programPath }
   */
  function checkExercise(ex, code) {
    var E = global.PyEngine, T = global.TurtleRec;
    return getReferences(ex).then(function (refs) {
      return E.run(code, null, runOpts(ex.inputs)).then(function (run) {
        var programPath = T.snapshot();
        if (run.error) {
          return { ok: false, error: run.error, results: [], programPath: programPath, output: run.output };
        }
        var programSegs = T.segments();
        // Programme entier avec d'autres réponses : exécuté une fois par jeu de réponses
        var progRuns = {};
        progRuns[inputsKey(ex.inputs)] = Promise.resolve({ run: run, segs: programSegs, colors: usedColors(), output: run.output, printed: run.printed });
        function programWith(inputs) {
          var k = inputsKey(inputs);
          if (!progRuns[k]) progRuns[k] = runProgram(code, inputs);
          return progRuns[k];
        }
        var src = analyzeSource(code);
        var results = [];
        var badParams = {}; // commandes dont les paramètres sont faux : inutile de les tester
        var chain = Promise.resolve();

        (ex.checks || []).forEach(function (c) {
          chain = chain.then(function () {
            if (c.kind === "defined") {
              var ok = !!E.getFunction(run.module, c.name);
              results.push({ id: c.id, label: c.label, ok: ok,
                message: ok ? null : (c.fail || "La commande " + c.name + "() n'est pas définie. Vérifiez son nom : def " + c.name + "():") });
              return;
            }
            if (c.kind === "params") {
              // def nom(p1, p2): avec le bon nombre de paramètres
              var ps = src.params[c.name];
              var okp = !!ps && ps.length === c.count;
              if (!okp) badParams[c.name] = true;
              results.push({ id: c.id, label: c.label, ok: okp,
                message: okp ? null : (!ps
                  ? "La commande " + c.name + "() n'est pas définie."
                  : c.name + "() doit avoir " + c.count + " paramètre" + (c.count > 1 ? "s" : "") +
                    " entre les parenthèses, et non " + ps.length + " : " + (c.example || "") ) });
              return;
            }
            if (c.kind === "source") {
              // règle sur le code (sans les commentaires ni les textes) : re = expression régulière
              var okr = new RegExp(c.re, "m").test(c.in ? (src.defs[c.in] || "") : src.all);
              results.push({ id: c.id, label: c.label, ok: okr, message: okr ? null : c.fail });
              return;
            }
            if (c.kind === "calls") {
              var ok2 = calls(src, c.caller, c.callee);
              var msg = null;
              if (!ok2) {
                var named = c.caller !== "<main>" && c.caller !== "<any>";
                if (named && !E.getFunction(run.module, c.caller)) {
                  msg = "La commande " + c.caller + "() n'est pas encore définie.";
                } else if (!E.getFunction(run.module, c.callee)) {
                  msg = "La commande " + c.callee + "() n'est pas encore définie.";
                } else {
                  msg = c.fail;
                }
              }
              results.push({ id: c.id, label: c.label, ok: ok2, message: msg });
              return;
            }
            if (c.kind === "output") {
              // texte affiché par print() (sans les questions et réponses de input()) : re = expression régulière
              // cases : [{ inputs, re }, …] teste plusieurs jeux de réponses ; sinon un seul (c.inputs, c.re)
              var cas = c.cases || [{ inputs: c.inputs, re: c.re }];
              var echec = null;
              var suite = Promise.resolve();
              cas.forEach(function (k) {
                suite = suite.then(function () {
                  if (echec) return;
                  var inO = (k.inputs) || ex.inputs || null;
                  return programWith(inO).then(function (p) {
                    if (p.run.error) {
                      echec = "Le programme provoque une erreur" + reponsesTexte(inO) + " : " + p.run.error.message;
                    } else if (!new RegExp(k.re, c.flags || "").test(p.printed != null ? p.printed : p.output)) {
                      // k.attendu (facultatif) : ce que le programme doit afficher avec ces réponses
                      echec = (c.cases ? "Avec les réponses " + (inO || []).join(", ") + ", l'affichage n'est pas le bon" +
                        (k.attendu ? " : le programme doit afficher « " + k.attendu + " »." : ".") + " " : "") + (c.fail || "");
                    }
                  });
                });
              });
              return suite.then(function () {
                results.push({ id: c.id, label: c.label, ok: !echec, message: echec });
              });
            }
            if (c.kind === "call") {
              // commande appelée avec des valeurs : valeur renvoyée et texte affiché, comparés à la solution
              if (badParams[c.name]) {
                results.push({ id: c.id, label: c.label, ok: false,
                  message: "Impossible de tester tant que " + c.name + "() n'a pas le bon nombre de paramètres." });
                return;
              }
              if (!E.getFunction(run.module, c.name)) {
                results.push({ id: c.id, label: c.label, ok: false,
                  message: "La commande " + c.name + "() n'est pas définie. Vérifiez son nom : def " + c.name + "(…):" });
                return;
              }
              var echecA = null, suiteA = Promise.resolve();
              (c.cases || [{ args: c.args, returns: c.returns }]).forEach(function (k) {
                suiteA = suiteA.then(function () {
                  if (echecA) return;
                  return E.callFunction(run.module, c.name, k.args || []).then(function (x) {
                    var appel = appelTexte(c, k);
                    if (x.error) { echecA = appel + " provoque une erreur : " + x.error.message; return; }
                    var sols = refs[callKey(c, k)] || [];
                    var voirRetour = c.retour !== false, voirAffichage = c.affichage !== false;
                    function retourOk(s) {
                      if (!voirRetour) return true;
                      if (k.hasOwnProperty("returns")) {
                        var imp = retourImpose(k.returns);
                        return imp.texte != null ? !!x.retour && (x.retour.repr === "'" + imp.texte + "'" || x.retour.repr === JSON.stringify(imp.texte)) : memeRetour(x.retour, imp);
                      }
                      // la solution ne renvoie rien (elle affiche) : seul l'affichage compte
                      if (!s.retour || s.retour.repr === "None") return true;
                      return memeRetour(x.retour, s.retour);
                    }
                    // l'affichage n'est comparé que si la solution affiche quelque chose (un print de contrôle en plus est accepté)
                    function affichageOk(s) { return !voirAffichage || !String(s.printed || "").trim() || memeTexteAffiche(x.printed, s.printed); }
                    if (!sols.length && k.hasOwnProperty("returns")) sols = [{ retour: null, printed: "" }];
                    if (sols.some(function (s) { return retourOk(s) && affichageOk(s); })) return;
                    var s0 = sols[0] || { retour: null, printed: "" };
                    if (!retourOk(s0)) {
                      var attendu = k.hasOwnProperty("returns") ? enPython(k.returns) : (s0.retour ? s0.retour.repr : "?");
                      var obtenu = x.retour ? x.retour.repr : "None";
                      if (obtenu === "None" && attendu !== "None") {
                        echecA = appel + " ne renvoie rien : il manque return" +
                          (String(x.printed || "").trim() ? " (print() affiche une valeur, mais ne la renvoie pas)." : ".");
                      } else {
                        echecA = appel + " renvoie " + court(obtenu) + " au lieu de " + court(attendu) + ".";
                      }
                    } else {
                      echecA = String(x.printed || "").trim()
                        ? appel + " affiche « " + afficheTexte(x.printed) + " » au lieu de « " + afficheTexte(s0.printed) + " »."
                        : appel + " n'affiche rien ; il doit afficher « " + afficheTexte(s0.printed) + " »" +
                          (x.retour && x.retour.repr !== "None" ? " avec print() (return renvoie la valeur sans l'afficher)." : ".");
                    }
                  });
                });
              });
              return suiteA.then(function () {
                if (echecA && c.fail) echecA += " " + c.fail;
                results.push({ id: c.id, label: c.label, ok: !echecA, message: echecA });
              });
            }
            if (c.kind === "colors") {
              // couleurs du trait et du remplissage, comparées à celles de la solution (un ou plusieurs jeux de réponses)
              var echecC = null, suiteC = Promise.resolve();
              casesOf(c, ex).forEach(function (inC) {
                suiteC = suiteC.then(function () {
                  if (echecC) return;
                  return programWith(inC).then(function (p) {
                    if (p.run.error) {
                      echecC = "Le programme provoque une erreur" + reponsesTexte(inC) + " : " + p.run.error.message;
                      return;
                    }
                    var list = refs["colors|" + inputsKey(inC)] || [];
                    var okC = list.some(function (r) { return sameList(p.colors.pen, r.pen) && sameList(p.colors.fill, r.fill); });
                    if (!okC) echecC = list.length ? colorsMessage(c, inC, p.colors, list[0]) : c.fail;
                  });
                });
              });
              return suiteC.then(function () {
                results.push({ id: c.id, label: c.label, ok: !echecC, message: echecC });
              });
            }
            if (c.kind === "shape") {
              var getSegs;
              if (c.target !== "<program>" && badParams[c.target]) {
                results.push({ id: c.id, label: c.label, ok: false,
                  message: "Impossible de tester tant que " + c.target + "() n'a pas le bon nombre de paramètres." });
                return;
              }
              if (c.target === "<program>") {
                // programme entier : un ou plusieurs jeux de réponses (cases), arrêt au premier dessin faux
                var echecD = null, suiteD = Promise.resolve();
                casesOf(c, ex).forEach(function (inD) {
                  suiteD = suiteD.then(function () {
                    if (echecD) return;
                    return programWith(inD).then(function (p) {
                      var resD;
                      if (p.run.error) resD = { ok: false, reason: "error", error: p.run.error };
                      else resD = compareRefs(p.segs, refs["dessin|" + inputsKey(inD)] || [], c.opts);
                      if (!resD.ok) echecD = shapeMessage(c, resD, inD) + hintFor(c, resD);
                    });
                  });
                });
                return suiteD.then(function () {
                  results.push({ id: c.id, label: c.label, ok: !echecD, message: echecD });
                });
              } else if (!E.getFunction(run.module, c.target)) {
                getSegs = Promise.resolve({ missing: true });
              } else {
                getSegs = E.callFunction(run.module, c.target, c.args).then(function (r) {
                  return r.error ? { error: r.error } : { segs: T.segments() };
                });
              }
              return getSegs.then(function (g) {
                var res;
                if (g.missing) res = { ok: false, reason: "function-missing" };
                else if (g.error) res = { ok: false, reason: "error", error: g.error };
                else res = compareRefs(g.segs, refs[targetKey(c)] || [], c.opts);
                results.push({ id: c.id, label: c.label, ok: res.ok,
                  message: res.ok ? null : shapeMessage(c, res) + hintFor(c, res) });
              });
            }
          });
        });

        return chain.then(function () {
          return {
            ok: results.length > 0 && results.every(function (r) { return r.ok; }),
            error: null, results: results, programPath: programPath, output: run.output
          };
        });
      });
    });
  }

  global.Checker = {
    mergeSegments: mergeSegments,
    compareDrawings: compareDrawings,
    analyzeSource: analyzeSource,
    calls: calls,
    getReferences: getReferences,
    checkExercise: checkExercise
  };
})(typeof window !== "undefined" ? window : globalThis);
