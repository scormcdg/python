/*
 * Dessin et animation du jeu « Robi ».
 * new DessinJeu(canvas, { getSpeed }) ; .afficher(monde) ; .rejouer(monde, evenements, { onDone, final })
 * Vitesse : 1 (lent) à 10 (rapide), 0 = instantané.
 */
(function (global) {
  "use strict";

  var COULEURS = {
    ciel1: "#dff0fb", ciel2: "#f6fbff",
    herbe: "#6fb04a", terre: "#b98552", terreFonce: "#9c6c3e",
    caisse: "#c98d4b", caisseBord: "#8a5a2b",
    cle: "#e8b923", coffre: "#8b5a2b", coffreBord: "#5c3a19", or: "#f5d142",
    robot: "#2a9d8f", robotFonce: "#1f7268", oeil: "#ffffff", pupille: "#1d2b53",
    panneau: "#d7b98c", poteau: "#7a5634", texte: "#1d2b53",
    echec: "#b63a2b", bulle: "#ffffff"
  };

  // durée (en secondes) d'une action à la vitesse 6
  var DUREES = { avancer: 0.32, sauter: 0.5, tourner: 0.22, frapper: 0.3, cle: 0.2, ouvrir: 0.6, lire: 0.7, regarder: 0.18, echec: 0.9 };

  function DessinJeu(canvas, options) {
    this.canvas = canvas;
    this.opts = options || {};
    this.frame = null;
    this.etat = null;
  }

  DessinJeu.prototype.stop = function () {
    if (this.frame) global.cancelAnimationFrame(this.frame);
    this.frame = null;
  };

  DessinJeu.prototype.animating = function () { return this.frame !== null; };

  DessinJeu.prototype.finish = function () { if (this.frame && this.finir) this.finir(); };

  /* Prépare l'échelle : tout le terrain visible, cases carrées. */
  DessinJeu.prototype.preparer = function (monde) {
    var c = this.canvas, dpr = global.devicePixelRatio || 1;
    var w = c.clientWidth || c.width, h = c.clientHeight || c.height;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    var ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = monde.sol.length;
    var haut = 0;
    for (var i = 0; i < n; i++) haut = Math.max(haut, monde.sol[i] + (monde.caisses[i] || 0));
    var lignes = haut + 3.2;
    var cote = Math.min((w - 16) / n, (h - 12) / lignes);
    this.ctx = ctx; this.w = w; this.h = h; this.cote = cote;
    this.ox = (w - cote * n) / 2;
    this.sol0 = h - 6; // bas du terrain
  };

  DessinJeu.prototype.px = function (x) { return this.ox + (x + 0.5) * this.cote; };       // centre de la colonne
  DessinJeu.prototype.py = function (y) { return this.sol0 - y * this.cote; };              // haut d'une hauteur y

  /* État affiché, recalculé en rejouant les événements */
  function etatInitial(monde) {
    return {
      objets: Object.assign({}, monde.objets),
      caisses: Object.assign({}, monde.caisses),
      lus: {},
      x: monde.depart, y: monde.sol[monde.depart], dir: monde.dir,
      cle: false, ouvert: false, echec: null, bulle: null
    };
  }

  function appliquer(e, s, monde) {
    switch (e.t) {
      case "avancer": case "sauter": s.x = e.vers; s.y = monde.sol[e.vers]; break;
      case "tourner": s.dir = e.dir; break;
      case "frapper": s.caisses[e.x] = e.reste; break;
      case "cle": s.cle = true; delete s.objets[e.x]; break;
      case "ouvrir": s.ouvert = true; break;
      case "lire": s.lus[e.x] = true; break;
      case "echec": s.echec = e; break;
    }
  }

  /* ---------------- Dessin ---------------- */

  DessinJeu.prototype.fond = function (monde, s) {
    var ctx = this.ctx, c = this.cote, k;
    var g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, COULEURS.ciel1); g.addColorStop(1, COULEURS.ciel2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    for (var x = 0; x < monde.sol.length; x++) {
      var hx = monde.sol[x], left = this.ox + x * c;
      // colonne de terre, marches visibles
      for (k = 0; k < hx; k++) {
        ctx.fillStyle = (k + x) % 2 ? COULEURS.terre : COULEURS.terreFonce;
        ctx.fillRect(left, this.py(k + 1), c + 0.5, c + 0.5);
      }
      // bande d'herbe
      ctx.fillStyle = COULEURS.herbe;
      ctx.fillRect(left, this.py(hx) - Math.max(3, c * 0.12), c + 0.5, Math.max(3, c * 0.12));
      // repère de hauteur discret
      ctx.fillStyle = "rgba(29,43,83,0.08)";
      ctx.fillRect(left, this.py(hx), 1, hx * c);
    }
    this.objets(monde, s);
  };

  DessinJeu.prototype.objets = function (monde, s) {
    var ctx = this.ctx, c = this.cote;
    for (var x = 0; x < monde.sol.length; x++) {
      var base = this.py(monde.sol[x]), cx = this.px(x);
      // panneau
      if (monde.panneaux[x] !== undefined) {
        ctx.fillStyle = COULEURS.poteau;
        ctx.fillRect(cx - c * 0.36, base - c * 0.95, c * 0.06, c * 0.95);
        ctx.fillStyle = COULEURS.panneau;
        ctx.strokeStyle = COULEURS.poteau; ctx.lineWidth = 1.5;
        roundRect(ctx, cx - c * 0.48, base - c * 1.3, c * 0.5, c * 0.42, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = COULEURS.texte;
        ctx.font = "700 " + Math.max(9, c * 0.24) + "px sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        var v = monde.panneaux[x];
        var txt = s.lus[x] ? String(v) : "?";
        if (txt.length > 4) ctx.font = "700 " + Math.max(8, c * 0.16) + "px sans-serif";
        ctx.fillText(txt, cx - c * 0.23, base - c * 1.09);
      }
      // caisses empilées
      var n = s.caisses[x] || 0;
      for (var k = 0; k < n; k++) {
        var top = base - (k + 1) * c * 0.9;
        ctx.fillStyle = COULEURS.caisse; ctx.strokeStyle = COULEURS.caisseBord; ctx.lineWidth = 2;
        ctx.fillRect(cx - c * 0.42, top, c * 0.84, c * 0.86);
        ctx.strokeRect(cx - c * 0.42, top, c * 0.84, c * 0.86);
        ctx.beginPath();
        ctx.moveTo(cx - c * 0.42, top); ctx.lineTo(cx + c * 0.42, top + c * 0.86);
        ctx.moveTo(cx + c * 0.42, top); ctx.lineTo(cx - c * 0.42, top + c * 0.86);
        ctx.stroke();
      }
      if (s.objets[x] === "cle") this.dessinerCle(cx, base - c * 0.5, c * 0.5);
      if (s.objets[x] === "coffre" || monde.objets[x] === "coffre") this.dessinerCoffre(cx, base, c, s.ouvert);
    }
  };

  DessinJeu.prototype.dessinerCle = function (cx, cy, t) {
    var ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = COULEURS.cle; ctx.strokeStyle = "#a9840f"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx - t * 0.3, cy, t * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff8d6";
    ctx.beginPath(); ctx.arc(cx - t * 0.3, cy, t * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COULEURS.cle;
    ctx.fillRect(cx - t * 0.05, cy - t * 0.07, t * 0.7, t * 0.14);
    ctx.fillRect(cx + t * 0.42, cy, t * 0.1, t * 0.22);
    ctx.fillRect(cx + t * 0.22, cy, t * 0.1, t * 0.16);
    ctx.restore();
  };

  DessinJeu.prototype.dessinerCoffre = function (cx, base, c, ouvert) {
    var ctx = this.ctx, w = c * 0.78, h = c * 0.5;
    ctx.save();
    ctx.fillStyle = COULEURS.coffre; ctx.strokeStyle = COULEURS.coffreBord; ctx.lineWidth = 2;
    ctx.fillRect(cx - w / 2, base - h, w, h); ctx.strokeRect(cx - w / 2, base - h, w, h);
    if (ouvert) {
      ctx.fillStyle = COULEURS.or;
      ctx.beginPath(); ctx.ellipse(cx, base - h, w * 0.4, h * 0.25, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = COULEURS.coffre;
      ctx.save(); ctx.translate(cx - w / 2, base - h); ctx.rotate(-0.9);
      ctx.fillRect(0, -h * 0.5, w, h * 0.5); ctx.strokeRect(0, -h * 0.5, w, h * 0.5);
      ctx.restore();
    } else {
      ctx.fillRect(cx - w / 2, base - h - h * 0.45, w, h * 0.45); ctx.strokeRect(cx - w / 2, base - h - h * 0.45, w, h * 0.45);
      ctx.fillStyle = COULEURS.or;
      ctx.fillRect(cx - w * 0.07, base - h - h * 0.12, w * 0.14, h * 0.3);
    }
    ctx.restore();
  };

  /* Robi : robot original (corps arrondi, antenne, grand œil, chenilles). */
  DessinJeu.prototype.dessinerRobot = function (x, y, dir, opts) {
    var ctx = this.ctx, c = this.cote;
    var cx = this.ox + (x + 0.5) * c, base = this.py(y);
    opts = opts || {};
    ctx.save();
    ctx.translate(cx + (opts.decalage || 0) * c, base);
    ctx.scale(dir, 1);
    var t = c * 0.8;
    // chenilles
    ctx.fillStyle = "#33415c";
    roundRect(ctx, -t * 0.42, -t * 0.18, t * 0.84, t * 0.18, t * 0.09); ctx.fill();
    ctx.fillStyle = "#8d99ae";
    for (var i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * t * 0.16, -t * 0.09, t * 0.045, 0, Math.PI * 2); ctx.fill(); }
    // corps
    ctx.fillStyle = opts.echec ? COULEURS.echec : COULEURS.robot;
    roundRect(ctx, -t * 0.34, -t * 0.72, t * 0.68, t * 0.56, t * 0.14); ctx.fill();
    ctx.fillStyle = COULEURS.robotFonce;
    roundRect(ctx, -t * 0.22, -t * 0.44, t * 0.36, t * 0.16, t * 0.05); ctx.fill();
    // antenne
    ctx.strokeStyle = COULEURS.robotFonce; ctx.lineWidth = Math.max(1.5, t * 0.04);
    ctx.beginPath(); ctx.moveTo(-t * 0.05, -t * 0.72); ctx.lineTo(-t * 0.1, -t * 0.92); ctx.stroke();
    ctx.fillStyle = opts.cle ? COULEURS.cle : "#f2b705";
    ctx.beginPath(); ctx.arc(-t * 0.1, -t * 0.95, t * 0.06, 0, Math.PI * 2); ctx.fill();
    // œil (regarde dans le sens de la marche)
    ctx.fillStyle = COULEURS.oeil;
    ctx.beginPath(); ctx.arc(t * 0.1, -t * 0.56, t * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COULEURS.pupille;
    ctx.beginPath(); ctx.arc(t * 0.15, -t * 0.56, t * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // clé portée
    if (opts.cle) this.dessinerCle(cx - dir * c * 0.05, base - c * 0.95, c * 0.32);
  };

  DessinJeu.prototype.bulle = function (x, y, texte, couleur) {
    var ctx = this.ctx, c = this.cote;
    var cx = this.px(x), top = this.py(y) - c * 1.25;
    ctx.save();
    ctx.font = "700 " + Math.max(11, c * 0.3) + "px sans-serif";
    var w = Math.max(c * 0.7, ctx.measureText(texte).width + 14), h = Math.max(18, c * 0.46);
    var left = Math.max(4, Math.min(this.w - w - 4, cx - w / 2));
    ctx.fillStyle = COULEURS.bulle; ctx.strokeStyle = couleur || COULEURS.texte; ctx.lineWidth = 1.5;
    roundRect(ctx, left, top - h, w, h, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = couleur || COULEURS.texte; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(texte, left + w / 2, top - h / 2);
    ctx.restore();
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* Image fixe d'un état */
  DessinJeu.prototype.image = function (monde, s, robot) {
    this.fond(monde, s);
    var r = robot || { x: s.x, y: s.y, dir: s.dir };
    this.dessinerRobot(r.x, r.y, r.dir, { cle: s.cle, echec: !!s.echec, decalage: r.decalage });
    if (s.ouvert) this.bulle(s.x, s.y, "Coffre ouvert !", "#2f7d4f");
    if (s.echec) this.bulle(s.x, s.y, "Aïe !", COULEURS.echec);
  };

  DessinJeu.prototype.afficher = function (monde) {
    this.stop();
    this.monde = monde;
    this.evenements = [];
    this.preparer(monde);
    this.image(monde, etatInitial(monde));
  };

  /* Rejoue les événements ; options.onDone à la fin. */
  DessinJeu.prototype.rejouer = function (monde, evenements, options) {
    options = options || {};
    var self = this;
    this.stop();
    this.monde = monde;
    this.evenements = evenements;
    this.preparer(monde);
    var s = etatInitial(monde), i = 0, t = 0, last = null;
    var vitesse = function () { var v = self.opts.getSpeed ? self.opts.getSpeed() : 6; return v; };
    function duree(e) { var v = vitesse(); return v ? (DUREES[e.t] || 0.2) * 6 / v : 0; }

    function finir() {
      for (; i < evenements.length; i++) appliquer(evenements[i], s, monde);
      self.frame = null; self.finir = null;
      self.image(monde, s);
      if (options.onDone) options.onDone();
    }
    this.finir = finir;
    if (!evenements.length || !vitesse()) { finir(); return; }

    function tick(now) {
      var dt = last === null ? 0 : Math.min(now - last, 100) / 1000;
      last = now;
      t += dt;
      while (i < evenements.length && t >= duree(evenements[i])) {
        t -= duree(evenements[i]);
        appliquer(evenements[i], s, monde);
        i++;
      }
      if (i >= evenements.length) { finir(); return; }
      var e = evenements[i], f = Math.min(1, t / Math.max(duree(e), 1e-6));
      self.imageEnCours(monde, s, e, f);
      self.frame = global.requestAnimationFrame(tick);
    }
    this.frame = global.requestAnimationFrame(tick);
  };

  /* Image pendant un événement (f de 0 à 1) */
  DessinJeu.prototype.imageEnCours = function (monde, s, e, f) {
    var r = { x: s.x, y: s.y, dir: s.dir };
    if (e.t === "avancer") {
      r.x = e.de + (e.vers - e.de) * f;
      var y0 = monde.sol[e.de], y1 = monde.sol[e.vers];
      r.y = y1 < y0 && f > 0.5 ? y0 + (y1 - y0) * Math.min(1, (f - 0.5) * 2) * Math.min(1, (f - 0.5) * 2) : y0;
    } else if (e.t === "sauter") {
      var a = monde.sol[e.de], b = monde.sol[e.vers];
      r.x = e.de + (e.vers - e.de) * f;
      r.y = a + (b - a) * Math.sin(f * Math.PI / 2) + 0.6 * Math.sin(f * Math.PI);
    } else if (e.t === "tourner") {
      r.dir = f < 0.5 ? -e.dir : e.dir;
    } else if (e.t === "frapper") {
      r.decalage = s.dir * 0.18 * Math.sin(f * Math.PI);
    } else if (e.t === "echec") {
      r.decalage = 0.06 * Math.sin(f * Math.PI * 8);
    }
    this.fond(monde, s);
    this.dessinerRobot(r.x, r.y, r.dir, { cle: s.cle, echec: e.t === "echec", decalage: r.decalage });
    if (e.t === "lire") this.bulle(s.x, s.y, String(e.valeur));
    if (e.t === "regarder") this.bulle(s.x, s.y, String(e.valeur), "#56607a");
    if (e.t === "ouvrir" && f > 0.4) { s.ouvert = true; this.fond(monde, s); this.dessinerRobot(r.x, r.y, r.dir, { cle: s.cle }); s.ouvert = false; }
    if (e.t === "echec") this.bulle(s.x, s.y, "Aïe !", COULEURS.echec);
  };

  global.DessinJeu = DessinJeu;
})(window);
