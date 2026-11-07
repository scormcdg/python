/*
 * Tortue instrumentée (version Pyodide).
 * Le module turtle (py/turtle.py) tourne dans Python et enregistre chaque déplacement.
 * À la fin de chaque exécution, engine.js copie cet enregistrement dans TurtleRec.path
 * (TurtleRec.charger) : le dessin (animé) et la vérification se font à partir de lui,
 * exactement comme dans la version Skulpt.
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
        throw new Error("La tortue a fait plus de " + MAX_MOVES + " mouvements : y a-t-il une boucle infinie ?");
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
    /* Enregistrement fait par py/turtle.py : { path, x, y, heading, visible } */
    charger: function (snap) {
      this.resetState();
      if (!snap) { this.path = []; return; }
      this.path = snap.path || [];
      this.x = snap.x; this.y = snap.y; this.heading = snap.heading; this.visible = snap.visible;
    },
    snapshot: function () {
      return { path: this.path.slice(), x: this.x, y: this.y, heading: this.heading, visible: this.visible };
    }
  };
  TurtleRec.reset();
  global.TurtleRec = TurtleRec;

  /* Une couleur est-elle reconnue par le navigateur ? */
  global.TurtleRec.validColor = function (c) {
    if (global.CSS && global.CSS.supports) return global.CSS.supports("color", c);
    return true;
  };

  /* La tortue est disponible dans cette série (engine.js en tient compte : import, messages) */
  global.TURTLE_MODULE_SRC = "py/turtle.py";
})(typeof window !== "undefined" ? window : globalThis);
