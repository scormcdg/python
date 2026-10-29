/*
 * Tortue instrumentée.
 * Remplace le module `turtle` de Skulpt : au lieu de dessiner directement,
 * elle enregistre chaque déplacement dans TurtleRec.path. Le dessin (animé)
 * et la vérification se font ensuite à partir de cet enregistrement.
 */
(function (global) {
  "use strict";

  var MAX_MOVES = 40000;

  /*
   * Chaque entrée de path est soit un déplacement :
   *   { x1, y1, x2, y2, pen, color, width, h (orientation), speed }
   * soit une rotation sur place :
   *   { turn: true, x, y, from, to, speed }
   * soit un autre élément de dessin, repéré par `type` :
   *   { type: "fill", points: [[x, y], …], color, from }   remplissage (from = indice de begin_fill)
   *   { type: "dot", x, y, size, color }                    point
   *   { type: "write", x, y, text, align, font, color }     texte
   *   { type: "bgcolor", color }                            couleur de fond
   *   { type: "clear" }                                     efface les dessins
   * speed vaut null tant que le programme n'a pas appelé speed() :
   * c'est alors le curseur de vitesse qui décide.
   * La vérification ne tient compte que des traits (déplacements stylo baissé).
   */
  var TurtleRec = {
    path: [],
    reset: function () {
      this.path = [];
      this.resetState();
    },
    resetState: function () {
      this.x = 0;
      this.y = 0;
      this.heading = 0; // degrés, 0 = est, sens trigonométrique
      this.pen = true;
      this.color = "black";
      this.fillColor = "black";
      this.width = 1;
      this.visible = true;
      this.speed = null;
      this.filling = false;
      this.fillPts = null;
      this.fillFrom = 0;
    },
    record: function (entry) {
      if (this.path.length >= MAX_MOVES) {
        throw new global.Sk.builtin.RuntimeError(
          "La tortue a fait plus de " + MAX_MOVES + " mouvements : y a-t-il une boucle infinie ?"
        );
      }
      this.path.push(entry);
    },
    moveTo: function (nx, ny) {
      this.record({
        x1: this.x, y1: this.y, x2: nx, y2: ny,
        pen: this.pen, color: this.color, width: this.width,
        h: this.heading, speed: this.speed
      });
      this.x = nx;
      this.y = ny;
      if (this.filling) this.fillPts.push([nx, ny]);
    },
    forward: function (d) {
      var a = (this.heading * Math.PI) / 180;
      this.moveTo(this.x + d * Math.cos(a), this.y + d * Math.sin(a));
    },
    turn: function (deg) {
      if (deg === 0) return;
      this.record({ turn: true, x: this.x, y: this.y, from: this.heading, to: this.heading + deg, speed: this.speed });
      this.heading = (((this.heading + deg) % 360) + 360) % 360;
    },
    setHeading: function (a) {
      var d = ((((a - this.heading) % 360) + 540) % 360) - 180; // plus court chemin
      this.turn(d);
      this.heading = ((a % 360) + 360) % 360;
    },
    beginFill: function () {
      this.filling = true;
      this.fillPts = [[this.x, this.y]];
      this.fillFrom = this.path.length;
    },
    endFill: function () {
      if (this.filling && this.fillPts.length >= 3) {
        this.record({ type: "fill", points: this.fillPts, color: this.fillColor, from: this.fillFrom });
      }
      this.filling = false;
      this.fillPts = null;
    },
    // Traits réellement dessinés (stylo baissé, longueur non nulle), après le dernier clear()
    segments: function () {
      var start = 0;
      for (var i = this.path.length - 1; i >= 0; i--) {
        if (this.path[i].type === "clear") { start = i + 1; break; }
      }
      return this.path.slice(start).filter(function (m) {
        return !m.type && !m.turn && m.pen && Math.hypot(m.x2 - m.x1, m.y2 - m.y1) > 1e-9;
      });
    },
    snapshot: function () {
      return { path: this.path.slice(), x: this.x, y: this.y, heading: this.heading, visible: this.visible };
    }
  };
  TurtleRec.reset();
  global.TurtleRec = TurtleRec;

  /* Une couleur est-elle reconnue par le navigateur ? (noms, "#ff8800", "#f80", "rgb(…)") */
  global.TurtleRec.validColor = function (c) {
    if (global.CSS && global.CSS.supports) return global.CSS.supports("color", c);
    return true;
  };

  /*
   * Module Skulpt. Cette fonction est transformée en texte puis évaluée par
   * Skulpt : elle ne peut donc utiliser que des variables globales
   * (Sk, TurtleRec), pas de variables de ce fichier.
   */
  function turtleBuiltinModule(name) {
    var mod = {};
    var R = TurtleRec;
    var none = Sk.builtin.none.none$;

    function js(v) { return Sk.ffi.remapToJs(v); }
    function py(v) { return Sk.ffi.remapToPy(v); }
    function absent(v) { return v === undefined || v === none; }
    function num(v, fname) {
      var n = js(v);
      if (typeof n !== "number" || isNaN(n)) {
        var ex = /^(left|right|lt|rt|setheading|seth)$/.test(fname) ? 90 : 100;
        throw new Sk.builtin.TypeError(fname + "() attend un nombre, par exemple " + fname + "(" + ex + ")");
      }
      return n;
    }
    /* max : nombre de valeurs acceptées entre parenthèses (par défaut, celui de fn) ; Infinity = sans limite */
    function def(names, fn, max) {
      var limit = max === undefined ? fn.length : max;
      var f = new Sk.builtin.func(function () {
        if (arguments.length > limit) {
          var nom = names[0] + "()";
          throw new Sk.builtin.TypeError(limit === 0
            ? nom + " s'écrit sans rien entre les parenthèses, mais a reçu " + arguments.length + " valeur" + (arguments.length > 1 ? "s" : "")
            : nom + " accepte au maximum " + limit + " valeur" + (limit > 1 ? "s" : "") + " entre les parenthèses, mais en a reçu " +
              arguments.length);
        }
        return fn.apply(null, arguments);
      });
      names.forEach(function (n) { mod[n] = f; });
    }
    function colorFromArgs(args, fname) {
      var c = null;
      if (args.length === 1) {
        var v = js(args[0]);
        if (typeof v === "string") {
          c = v.trim().toLowerCase();
          var nom = c.replace(/\s+/g, "");
          var table = (typeof window !== "undefined" && window.TURTLE_COLORS) || {};
          if (table[nom]) c = table[nom];
        }
        else if (Array.isArray(v) && v.length === 3) c = rgb(v, fname);
      } else if (args.length === 3) {
        c = rgb(args.map(js), fname);
      }
      if (c === null || !R.validColor(c)) {
        throw new Sk.builtin.TypeError(
          "Couleur invalide dans " + fname + "() : utilisez par exemple " + fname + "(\"red\") ou " + fname + "(\"#ff8800\")"
        );
      }
      return c;
    }
    function rgb(v, fname) {
      if (!v.every(function (c) { return typeof c === "number" && c >= 0; })) return null;
      var s = v.every(function (c) { return c <= 1; }) ? 255 : 1;
      return "rgb(" + v.map(function (c) { return Math.round(Math.min(255, c * s)); }).join(",") + ")";
    }
    function tuple(a, b) {
      return new Sk.builtin.tuple([py(a), py(b)]);
    }
    function point(x, y, fname) {
      if (absent(y)) {
        var p = js(x);
        if (!Array.isArray(p) || p.length !== 2) {
          throw new Sk.builtin.TypeError(fname + "() attend deux nombres, par exemple " + fname + "(100, 50)");
        }
        return [p[0], p[1]];
      }
      return [num(x, fname), num(y, fname)];
    }

    // ---- Déplacements ----
    def(["forward", "fd"], function (d) { R.forward(num(d, "forward")); return none; });
    def(["backward", "back", "bk"], function (d) { R.forward(-num(d, "backward")); return none; });
    def(["right", "rt"], function (a) { R.turn(-num(a, "right")); return none; });
    def(["left", "lt"], function (a) { R.turn(num(a, "left")); return none; });
    // « goto » est un mot réservé en JavaScript : Skulpt le cherche sous le nom « goto_$rw$ »
    def(["goto", "goto_$rw$", "setpos", "setposition"], function (x, y) {
      var p = point(x, y, "goto");
      R.moveTo(p[0], p[1]);
      return none;
    });
    def(["setx"], function (x) { R.moveTo(num(x, "setx"), R.y); return none; });
    def(["sety"], function (y) { R.moveTo(R.x, num(y, "sety")); return none; });
    def(["setheading", "seth"], function (a) { R.setHeading(num(a, "setheading")); return none; });
    def(["home"], function () { R.moveTo(0, 0); R.setHeading(0); return none; });
    // circle(rayon) ou circle(rayon, angle) ou circle(rayon, angle, nombre_de_pas)
    def(["circle"], function (radius, extent, steps) {
      var r = num(radius, "circle");
      var ext = absent(extent) ? 360 : num(extent, "circle");
      var frac = Math.abs(ext) / 360;
      var n = absent(steps)
        ? 1 + Math.floor(Math.min(11 + Math.abs(r) / 6, 59) * frac)
        : Math.max(1, Math.round(num(steps, "circle")));
      var w = ext / n, w2 = w / 2;
      var l = 2 * r * Math.sin((w * Math.PI) / 360);
      if (r < 0) { l = -l; w = -w; w2 = -w2; }
      R.turn(w2);
      for (var i = 0; i < n; i++) { R.forward(l); R.turn(w); }
      R.turn(-w2);
      return none;
    });

    // ---- Stylo ----
    def(["penup", "pu", "up"], function () { R.pen = false; return none; });
    def(["pendown", "pd", "down"], function () { R.pen = true; return none; });
    def(["isdown"], function () { return R.pen ? Sk.builtin.bool.true$ : Sk.builtin.bool.false$; });
    // Vitesse comme dans le module turtle de Python : 1 (lent) à 10 (rapide), 0 = instantané
    def(["speed"], function (s) {
      if (absent(s)) return py(R.speed === null ? 3 : R.speed);
      var v = js(s);
      var names = { fastest: 0, fast: 10, normal: 6, slow: 3, slowest: 1 };
      if (typeof v === "string") {
        if (!(v in names)) {
          throw new Sk.builtin.TypeError("speed() attend un nombre entre 0 et 10, par exemple speed(5)");
        }
        v = names[v];
      } else if (typeof v !== "number" || isNaN(v)) {
        throw new Sk.builtin.TypeError("speed() attend un nombre entre 0 et 10, par exemple speed(5)");
      } else {
        v = v > 10 || v < 0.5 ? 0 : Math.round(v);
      }
      R.speed = v;
      return none;
    });
    // color("red") : stylo et remplissage ; color("red", "yellow") : stylo, puis remplissage
    def(["color"], function () {
      var args = Array.prototype.slice.call(arguments);
      if (args.length === 0) return tuple(R.color, R.fillColor);
      if (args.length === 2) {
        R.color = colorFromArgs([args[0]], "color");
        R.fillColor = colorFromArgs([args[1]], "color");
      } else {
        R.color = R.fillColor = colorFromArgs(args, "color");
      }
      return none;
    }, 3);
    def(["pencolor"], function () {
      var args = Array.prototype.slice.call(arguments);
      if (args.length === 0) return py(R.color);
      R.color = colorFromArgs(args, "pencolor");
      return none;
    }, 3);
    def(["fillcolor"], function () {
      var args = Array.prototype.slice.call(arguments);
      if (args.length === 0) return py(R.fillColor);
      R.fillColor = colorFromArgs(args, "fillcolor");
      return none;
    }, 3);
    def(["width", "pensize"], function (w) {
      if (absent(w)) return py(R.width);
      R.width = num(w, "width");
      return none;
    });

    // ---- Remplissage ----
    def(["begin_fill"], function () { R.beginFill(); return none; });
    def(["end_fill"], function () { R.endFill(); return none; });
    def(["filling"], function () { return R.filling ? Sk.builtin.bool.true$ : Sk.builtin.bool.false$; });

    // ---- Points, texte, fond ----
    // dot() ou dot(taille) ou dot(taille, "couleur")
    def(["dot"], function (size) {
      var rest = Array.prototype.slice.call(arguments, 1);
      var s = absent(size) ? Math.max(R.width + 4, 2 * R.width) : num(size, "dot");
      var c = rest.length ? colorFromArgs(rest, "dot") : R.color;
      R.record({ type: "dot", x: R.x, y: R.y, size: s, color: c });
      return none;
    }, 4);
    // write("texte"), write("texte", align="center"), write("texte", font=("Arial", 16, "bold"))
    var writeImpl = function (arg, move, align, font) {
      var text = absent(arg) ? "" : new Sk.builtin.str(arg).v;
      var al = absent(align) ? "left" : String(js(align));
      if (["left", "center", "right"].indexOf(al) < 0) al = "left";
      var f = absent(font) ? ["Arial", 8, "normal"] : js(font);
      if (!Array.isArray(f)) f = [String(f), 8, "normal"];
      R.record({
        type: "write", x: R.x, y: R.y, text: text, align: al, color: R.color,
        font: { family: String(f[0] || "Arial"), size: +f[1] || 8, style: String(f[2] || "normal") }
      });
      return none;
    };
    // arguments nommés comme dans Python : align=…, font=…, move=…
    writeImpl.co_varnames = ["arg", "move", "align", "font"];
    writeImpl.$defaults = [Sk.builtin.bool.false$, new Sk.builtin.str("left"),
      new Sk.builtin.tuple([new Sk.builtin.str("Arial"), py(8), new Sk.builtin.str("normal")])];
    mod.write = new Sk.builtin.func(writeImpl);
    def(["bgcolor"], function () {
      var args = Array.prototype.slice.call(arguments);
      if (args.length === 0) return none;
      R.record({ type: "bgcolor", color: colorFromArgs(args, "bgcolor") });
      return none;
    }, 3);
    def(["clear"], function () { R.record({ type: "clear" }); return none; });
    def(["reset"], function () {
      R.record({ type: "clear" });
      var speed = R.speed;
      R.resetState();
      R.speed = speed;
      return none;
    });

    // ---- Tortue et position ----
    def(["hideturtle", "ht"], function () { R.visible = false; return none; });
    def(["showturtle", "st"], function () { R.visible = true; return none; });
    def(["isvisible"], function () { return R.visible ? Sk.builtin.bool.true$ : Sk.builtin.bool.false$; });
    def(["position", "pos"], function () { return tuple(R.x, R.y); });
    def(["xcor"], function () { return py(R.x); });
    def(["ycor"], function () { return py(R.y); });
    def(["heading"], function () { return py(R.heading); });
    def(["distance"], function (x, y) {
      var p = point(x, y, "distance");
      return py(Math.hypot(R.x - p[0], R.y - p[1]));
    });

    // Commandes acceptées mais sans effet sur le dessin
    def(["done", "mainloop", "exitonclick", "shape", "tracer", "update",
         "title", "delay", "setup", "shapesize", "stamp"],
        function () { return none; }, Infinity);
    return mod;
  }

  global.TURTLE_MODULE_SRC = "var $builtinmodule = " + turtleBuiltinModule.toString() + ";";
})(typeof window !== "undefined" ? window : globalThis);
