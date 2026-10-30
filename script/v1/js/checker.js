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
  function targetKey(c) { return c.target + (c.args ? "(" + c.args.join(",") + ")" : ""); }

  function shapeTargets(ex) {
    var t = {};
    (ex.checks || []).forEach(function (c) { if (c.kind === "shape") t[targetKey(c)] = c; });
    return Object.keys(t).map(function (k) { return t[k]; });
  }

  /* Dessins de référence, obtenus en exécutant la (ou les) solution(s). */
  function getReferences(ex) {
    if (refCache[ex.id]) return Promise.resolve(refCache[ex.id]);
    var targets = shapeTargets(ex);
    var refs = {};
    targets.forEach(function (c) { refs[targetKey(c)] = []; });
    var chain = Promise.resolve();
    (ex.solutions || []).forEach(function (sol) {
      chain = chain.then(function () {
        return global.PyEngine.run(sol).then(function (r) {
          if (r.error) throw new Error("Solution de référence invalide (" + ex.id + ") : " + r.error.raw);
          var programSegs = global.TurtleRec.segments();
          var inner = Promise.resolve();
          targets.forEach(function (tc) {
            var t = tc.target, key = targetKey(tc);
            if (t === "<program>") { refs[key].push(programSegs); return; }
            inner = inner.then(function () {
              return global.PyEngine.callFunction(r.module, t, tc.args).then(function (c) {
                if (c.error) throw new Error("Solution de référence invalide (" + ex.id + "/" + key + ") : " + c.error.raw);
                refs[key].push(global.TurtleRec.segments());
              });
            });
          });
          return inner;
        });
      });
    });
    return chain.then(function () { refCache[ex.id] = refs; return refs; });
  }

  function shapeMessage(check, res) {
    var appel = check.target + "(" + (check.args || []).join(", ") + ")";
    var who = check.target === "<program>" ? "Le dessin de votre programme" : "Le dessin de " + appel;
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
      return E.run(code).then(function (run) {
        var programPath = T.snapshot();
        if (run.error) {
          return { ok: false, error: run.error, results: [], programPath: programPath, output: run.output };
        }
        var programSegs = T.segments();
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
            if (c.kind === "shape") {
              var getSegs;
              if (c.target !== "<program>" && badParams[c.target]) {
                results.push({ id: c.id, label: c.label, ok: false,
                  message: "Impossible de tester tant que " + c.target + "() n'a pas le bon nombre de paramètres." });
                return;
              }
              if (c.target === "<program>") {
                getSegs = Promise.resolve({ segs: programSegs });
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
                else {
                  res = null;
                  var refList = refs[targetKey(c)] || [];
                  for (var i = 0; i < refList.length; i++) {
                    var r = compareDrawings(g.segs, refList[i], c.opts);
                    if (r.ok) { res = r; break; }
                    if (!res) res = r; // on garde le diagnostic de la 1re référence
                  }
                }
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
