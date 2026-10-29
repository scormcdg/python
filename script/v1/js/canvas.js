/*
 * Dessin d'un enregistrement de la tortue sur un canvas quadrillé.
 * L'animation rejoue les déplacements et les rotations à la vitesse choisie :
 * celle de speed() dans le programme, sinon celle du curseur (options.getSpeed).
 */
(function (global) {
  "use strict";

  // Vitesse n (1 à 10) → pas de tortue par seconde et degrés par seconde. 0 = instantané.
  function pxPerSec(n) { return n * 70; }
  function degPerSec(n) { return n * 140; }
  var MAX_STEPS_PER_FRAME = 20000;
  var FASTEST_MOVE = 0.01; // secondes par déplacement avec speed(0), comme le délai de Python

  function css(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function TurtleCanvas(canvas, options) {
    this.canvas = canvas;
    this.opts = options || {};
    this.frame = null;
    this.last = null;
  }

  TurtleCanvas.prototype.setup = function (path) {
    var c = this.canvas;
    var dpr = global.devicePixelRatio || 1;
    var w = c.clientWidth || c.width, h = c.clientHeight || c.height;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    var ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Cadrage : tout le tracé (et l'origine) doit être visible
    var minX = 0, maxX = 0, minY = 0, maxY = 0;
    function grow(x, y) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    (path || []).forEach(function (m) {
      if (m.turn || m.type === "bgcolor" || m.type === "clear") return;
      if (m.type === "fill") { m.points.forEach(function (p) { grow(p[0], p[1]); }); return; }
      if (m.type === "dot" || m.type === "write") { grow(m.x, m.y); return; }
      grow(m.x1, m.y1); grow(m.x2, m.y2);
    });
    var margin = this.opts.margin || 28;
    var fitW = (w - 2 * margin) / Math.max(maxX - minX, 1);
    var fitH = (h - 2 * margin) / Math.max(maxY - minY, 1);
    var k = this.opts.fit ? Math.min(fitW, fitH) : Math.min(1, fitW, fitH);
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    var zoom = this.opts.getZoom ? this.opts.getZoom() : 1;
    if (!this.opts.fit && k === 1 && zoom <= 1 &&
        Math.max(Math.abs(minX), Math.abs(maxX)) * 2 < w - 2 * margin &&
        Math.max(Math.abs(minY), Math.abs(maxY)) * 2 < h - 2 * margin) {
      cx = 0; cy = 0; // le dessin tient : l'origine reste au centre
    }
    // zoom choisi par l'élève (boutons + et −) ; en zoomant, la vue est centrée sur le dessin
    k *= zoom;
    this.ctx = ctx; this.w = w; this.h = h; this.k = k; this.dpr = dpr;
    this.tx = function (x) { return w / 2 + (x - cx) * k; };
    this.ty = function (y) { return h / 2 - (y - cy) * k; };

    // Calques hors écran : fond quadrillé, et encre des traits terminés
    this.bgColor = null;
    this.bg = this.layer();
    this.background(this.bg.getContext("2d"));
    this.ink = this.layer();
    if (this.opts.onEchelle) this.opts.onEchelle(this.unite, k);
  };

  TurtleCanvas.prototype.layer = function () {
    var l = document.createElement("canvas");
    l.width = this.canvas.width;
    l.height = this.canvas.height;
    l.getContext("2d").setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    return l;
  };

  TurtleCanvas.prototype.background = function (ctx) {
    var w = this.w, h = this.h;
    ctx.fillStyle = this.bgColor || css("--papier", "#fbfcfe");
    ctx.fillRect(0, 0, w, h);
    if (this.opts.grid === false) return;
    ctx.save();
    if (this.bgColor) ctx.globalAlpha = 0.35; // quadrillage discret sur un fond coloré
    // Quadrillage de cahier : un carreau = 10 pas de tortue. Quand les carreaux deviennent
    // trop petits ou trop grands, on passe à une autre valeur ronde (1, 2, 5, 10, 20, 50…)
    var UNITES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
    var unite = UNITES[UNITES.length - 1];
    for (var i = 0; i < UNITES.length; i++) {
      if (UNITES[i] * this.k >= 9) { unite = UNITES[i]; break; }
    }
    if (unite < 10 && 10 * this.k < 40) unite = 10; // on garde 10 tant que les carreaux restent lisibles
    this.unite = unite;
    var step = unite * this.k;
    var ox = this.tx(0), oy = this.ty(0);
    ctx.lineWidth = 1;
    ctx.strokeStyle = css("--carreau", "#dde6f3");
    for (var x = ((ox % step) + step) % step; x < w; x += step) {
      ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); ctx.stroke();
    }
    for (var y = ((oy % step) + step) % step; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); ctx.stroke();
    }
    if (this.opts.origin !== false) {
      ctx.strokeStyle = css("--carreau-fort", "#b9c9e2");
      ctx.beginPath(); ctx.moveTo(Math.round(ox) + 0.5, 0); ctx.lineTo(Math.round(ox) + 0.5, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, Math.round(oy) + 0.5); ctx.lineTo(w, Math.round(oy) + 0.5); ctx.stroke();
    }
    ctx.restore();
  };

  TurtleCanvas.prototype.inkColor = function (c) {
    return c === "black" ? css("--encre", "#1d2b53") : c;
  };

  /* Éléments autres que les traits : remplissage, point, texte, fond, effacement. */
  TurtleCanvas.prototype.extra = function (ctx, m, path, index) {
    var self = this;
    if (m.type === "fill") {
      ctx.fillStyle = this.inkColor(m.color);
      ctx.beginPath();
      m.points.forEach(function (p, i) {
        if (i === 0) ctx.moveTo(self.tx(p[0]), self.ty(p[1]));
        else ctx.lineTo(self.tx(p[0]), self.ty(p[1]));
      });
      ctx.closePath();
      ctx.fill();
      // comme dans Python, le contour reste visible par-dessus le remplissage
      for (var i = m.from; i < index; i++) this.segment(ctx, path[i], 1);
    } else if (m.type === "dot") {
      ctx.fillStyle = this.inkColor(m.color);
      ctx.beginPath();
      ctx.arc(this.tx(m.x), this.ty(m.y), Math.max(1, (m.size * this.k) / 2), 0, 2 * Math.PI);
      ctx.fill();
    } else if (m.type === "write") {
      var size = Math.max(6, m.font.size * this.k);
      var style = /bold/.test(m.font.style) ? "bold " : "";
      if (/italic/.test(m.font.style)) style = "italic " + style;
      ctx.font = style + size + "px " + JSON.stringify(m.font.family) + ", sans-serif";
      ctx.fillStyle = this.inkColor(m.color);
      ctx.textAlign = m.align;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(m.text, this.tx(m.x), this.ty(m.y));
    } else if (m.type === "bgcolor") {
      this.bgColor = m.color;
      var b = this.bg.getContext("2d");
      b.clearRect(0, 0, this.w, this.h);
      this.background(b);
    } else if (m.type === "clear") {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.ink.width, this.ink.height);
      ctx.restore();
    }
  };

  TurtleCanvas.prototype.segment = function (ctx, m, t) {
    if (m.turn || m.type || !m.pen) return;
    var x2 = m.x1 + (m.x2 - m.x1) * t, y2 = m.y1 + (m.y2 - m.y1) * t;
    ctx.strokeStyle = this.inkColor(m.color);
    ctx.lineWidth = Math.max(1.5, (m.width || 1) * 2 * Math.min(1, this.k + 0.3));
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(this.tx(m.x1), this.ty(m.y1));
    ctx.lineTo(this.tx(x2), this.ty(y2));
    ctx.stroke();
  };

  TurtleCanvas.prototype.turtle = function (x, y, heading) {
    var ctx = this.ctx;
    ctx.save();
    ctx.translate(this.tx(x), this.ty(y));
    ctx.rotate((-heading * Math.PI) / 180);
    ctx.fillStyle = css("--tortue", "#2f7d4f");
    ctx.strokeStyle = css("--papier", "#fbfcfe");
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(11, 0); ctx.lineTo(-7, 7); ctx.lineTo(-3, 0); ctx.lineTo(-7, -7); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  };

  TurtleCanvas.prototype.compose = function () {
    var ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.drawImage(this.ink, 0, 0);
    ctx.restore();
  };

  TurtleCanvas.prototype.animating = function () { return this.frame !== null; };

  TurtleCanvas.prototype.stop = function () {
    if (this.frame) global.cancelAnimationFrame(this.frame);
    this.frame = null;
  };

  /* Termine immédiatement l'animation en cours. */
  TurtleCanvas.prototype.finish = function () {
    if (this.frame && this.finishNow) this.finishNow();
  };

  /*
   * snap = { path, x, y, heading, visible } (voir TurtleRec.snapshot)
   * options.animate : rejouer le dessin ; options.onDone : appelé à la fin du dessin
   */
  TurtleCanvas.prototype.draw = function (snap, options) {
    options = options || {};
    this.stop();
    this.last = snap;
    var path = (snap && snap.path) || [];
    this.setup(path);
    var self = this;
    var inkCtx = this.ink.getContext("2d");
    var showTurtle = this.opts.turtle !== false;
    var getSpeed = this.opts.getSpeed || function () { return 0; };
    var idx = 0, t = 0, lastTime = null;

    function speedOf(e) { return e.speed === null || e.speed === undefined ? getSpeed() : e.speed; }
    function duration(e) {
      if (e.type) return 0;
      // speed(0) dans le programme : comme dans Python, plus d'animation de la tortue,
      // mais les traits apparaissent quand même l'un après l'autre (un toutes les 10 ms)
      if (e.speed === 0) return e.turn ? 0 : FASTEST_MOVE;
      var n = speedOf(e);
      if (!n) return 0;
      if (e.turn) return Math.abs(e.to - e.from) / degPerSec(n);
      return Math.hypot(e.x2 - e.x1, e.y2 - e.y1) / pxPerSec(n);
    }
    function complete(e, i) {
      if (e.type) self.extra(inkCtx, e, path, i);
      else self.segment(inkCtx, e, 1);
    }

    function end() {
      for (; idx < path.length; idx++) complete(path[idx], idx);
      self.frame = null;
      self.finishNow = null;
      self.compose();
      if (showTurtle && snap && snap.visible !== false) self.turtle(snap.x, snap.y, snap.heading);
      if (options.onDone) options.onDone();
    }
    this.finishNow = end;

    if (!options.animate || path.length === 0) { end(); return; }

    function tick(now) {
      var budget = lastTime === null ? 0 : Math.min(now - lastTime, 100) / 1000;
      lastTime = now;
      var steps = 0;
      while (idx < path.length && steps < MAX_STEPS_PER_FRAME) {
        var e = path[idx];
        var d = duration(e);
        if (d - t <= budget) {
          budget -= Math.max(0, d - t);
          complete(e, idx);
          idx++; t = 0; steps++;
        } else {
          t += budget;
          break;
        }
      }
      if (idx >= path.length) { end(); return; }

      // Mouvement en cours : trait partiel et tortue interpolée
      self.compose();
      var cur = path[idx], f = duration(cur) ? t / duration(cur) : 0;
      if (cur.type) {
        // élément instantané, traité à la prochaine image
      } else if (cur.turn) {
        if (showTurtle) self.turtle(cur.x, cur.y, cur.from + (cur.to - cur.from) * f);
      } else {
        self.segment(self.ctx, cur, f);
        if (showTurtle) {
          self.turtle(cur.x1 + (cur.x2 - cur.x1) * f, cur.y1 + (cur.y2 - cur.y1) * f, cur.h);
        }
      }
      self.frame = global.requestAnimationFrame(tick);
    }
    this.frame = global.requestAnimationFrame(tick);
  };

  global.TurtleCanvas = TurtleCanvas;
})(window);
