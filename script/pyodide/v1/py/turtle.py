# Tortue instrumentée (version Pyodide).
#
# Au lieu de dessiner directement, la tortue enregistre chaque déplacement dans _path.
# Le dessin (animé) et la vérification se font ensuite dans la page, à partir de cet
# enregistrement, exactement comme avec la version Skulpt (script/v1/js/turtle.js) :
# mêmes commandes, mêmes messages d'erreur, même nombre de pas pour circle().
#
# Chaque entrée de _path est soit un déplacement :
#   { x1, y1, x2, y2, pen, color, width, h (orientation), speed }
# soit une rotation sur place :
#   { turn: True, x, y, from, to, speed }
# soit un autre élément de dessin, repéré par "type" :
#   { type: "fill", points, color, from }, { type: "dot", x, y, size, color },
#   { type: "write", x, y, text, align, font, color }, { type: "bgcolor", color }, { type: "clear" }

import math as _math
import json as _json

MAX_MOVES = 40000

try:
    import js as _js
    _TABLE = _json.loads(_js.JSON.stringify(_js.TURTLE_COLORS))
except Exception:
    _js = None
    _TABLE = {}

_path = []
_s = {}


def _reset_state():
    _s.update(x=0.0, y=0.0, heading=0.0, pen=True, color="black", fillColor="black", width=1,
              visible=True, speed=None, filling=False, fillPts=None, fillFrom=0)


def _reset():
    """Appelé avant chaque exécution."""
    del _path[:]
    _reset_state()


def _snapshot():
    return _json.dumps({"path": _path, "x": _s["x"], "y": _s["y"], "heading": _s["heading"],
                        "visible": _s["visible"]})


def _record(entry):
    if len(_path) >= MAX_MOVES:
        raise RuntimeError("La tortue a fait plus de " + str(MAX_MOVES) +
                           " mouvements : y a-t-il une boucle infinie ?")
    _path.append(entry)


def _move_to(nx, ny):
    _record({"x1": _s["x"], "y1": _s["y"], "x2": nx, "y2": ny, "pen": _s["pen"], "color": _s["color"],
             "width": _s["width"], "h": _s["heading"], "speed": _s["speed"]})
    _s["x"] = nx
    _s["y"] = ny
    if _s["filling"]:
        _s["fillPts"].append([nx, ny])


def _forward(d):
    a = _s["heading"] * _math.pi / 180
    _move_to(_s["x"] + d * _math.cos(a), _s["y"] + d * _math.sin(a))


def _turn(deg):
    if deg == 0:
        return
    _record({"turn": True, "x": _s["x"], "y": _s["y"], "from": _s["heading"], "to": _s["heading"] + deg,
             "speed": _s["speed"]})
    _s["heading"] = (_s["heading"] + deg) % 360


def _set_heading(a):
    d = ((a - _s["heading"]) % 360 + 540) % 360 - 180  # plus court chemin
    _turn(d)
    _s["heading"] = a % 360


def _js_round(v):
    return int(_math.floor(v + 0.5))


# ---- Vérification des valeurs ----

def _is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v == v


def _num(v, fname):
    if not _is_num(v):
        if fname.endswith("2"):  # goto(x, y) : deux nombres
            fname = fname[:-1]
            raise TypeError(fname + "() attend deux nombres, par exemple " + fname + "(100, 50)")
        if fname in ("left", "right", "lt", "rt", "setheading", "seth"):
            ex = 90
        elif fname in ("width", "pensize"):
            ex = 3
        else:
            ex = 100
        raise TypeError(fname + "() attend un nombre, par exemple " + fname + "(" + str(ex) + ")")
    return float(v) if isinstance(v, float) else v


def _valid_color(c):
    if _js is None:
        return True
    try:
        return bool(_js.validerCouleur(c))
    except Exception:
        return True


def _rgb(v):
    if not all(_is_num(c) and c >= 0 for c in v):
        return None
    s = 255 if all(c <= 1 for c in v) else 1
    return "rgb(" + ",".join(str(_js_round(min(255, c * s))) for c in v) + ")"


def _rgb_or_text(v, fname):
    import re
    if any(isinstance(c, str) and re.match(r"^\s*-?\d+(\.\d*)?\s*$", c) for c in v):
        raise TypeError("Dans " + fname + "(), les trois composantes de la couleur doivent être des nombres, pas des textes : "
                        "transformez les réponses de input() avec int(), par exemple r = int(input(\"Rouge ? \"))")
    return _rgb(v)


def _color_from_args(args, fname):
    c = None
    if len(args) == 1:
        v = args[0]
        if isinstance(v, str):
            c = v.strip().lower()
            nom = "".join(c.split())
            if nom in _TABLE:
                c = _TABLE[nom]
        elif isinstance(v, (list, tuple)) and len(v) == 3:
            c = _rgb_or_text(list(v), fname)
    elif len(args) == 3:
        c = _rgb_or_text(list(args), fname)
    if c is None or not _valid_color(c):
        raise TypeError("Couleur invalide dans " + fname + "() : utilisez par exemple " + fname +
                        "(\"red\") ou " + fname + "(\"#ff8800\")")
    return c


def _point(x, y, fname):
    if y is None:
        if not isinstance(x, (list, tuple)) or len(x) != 2:
            raise TypeError(fname + "() attend deux nombres, par exemple " + fname + "(100, 50)")
        x, y = x[0], x[1]
    return [_num(x, fname + "2"), _num(y, fname + "2")]


# ---- Définition des commandes ----
# Comme dans la version Skulpt : un nombre maximum de valeurs entre les parenthèses,
# et pas de forme nom=valeur (sauf pour write).

__all__ = []


def _cmd(names, limit=None, keywords=False):
    def deco(fn):
        nom = names[0]
        lim = fn.__code__.co_argcount if limit is None else limit

        def commande(*args, **kwargs):
            if kwargs and not keywords:
                raise TypeError(nom + "() takes no keyword arguments")
            if len(args) > lim:
                n = len(args)
                if lim == 0:
                    raise TypeError(nom + "() s'écrit sans rien entre les parenthèses, mais a reçu " + str(n) +
                                    " valeur" + ("s" if n > 1 else ""))
                raise TypeError(nom + "() accepte au maximum " + str(lim) + " valeur" + ("s" if lim > 1 else "") +
                                " entre les parenthèses, mais en a reçu " + str(n))
            return fn(*args, **kwargs)

        commande.__name__ = nom
        commande.__qualname__ = nom
        for n in names:
            globals()[n] = commande
            __all__.append(n)
        return commande
    return deco


# ---- Déplacements ----

@_cmd(["forward", "fd"])
def _(d=None):
    _forward(_num(d, "forward"))


@_cmd(["backward", "back", "bk"])
def _(d=None):
    _forward(-_num(d, "backward"))


@_cmd(["right", "rt"])
def _(a=None):
    _turn(-_num(a, "right"))


@_cmd(["left", "lt"])
def _(a=None):
    _turn(_num(a, "left"))


@_cmd(["goto", "setpos", "setposition"])
def _(x=None, y=None):
    p = _point(x, y, "goto")
    _move_to(p[0], p[1])


@_cmd(["setx"])
def _(x=None):
    _move_to(_num(x, "setx"), _s["y"])


@_cmd(["sety"])
def _(y=None):
    _move_to(_s["x"], _num(y, "sety"))


@_cmd(["setheading", "seth"])
def _(a=None):
    _set_heading(_num(a, "setheading"))


@_cmd(["home"])
def _():
    _move_to(0, 0)
    _set_heading(0)


# circle(rayon) ou circle(rayon, angle) ou circle(rayon, angle, nombre_de_pas)
@_cmd(["circle"])
def _(radius=None, extent=None, steps=None):
    r = _num(radius, "circle")
    ext = 360 if extent is None else _num(extent, "circle")
    frac = abs(ext) / 360
    if steps is None:
        n = 1 + int(_math.floor(min(11 + abs(r) / 6, 59) * frac))
    else:
        n = max(1, _js_round(_num(steps, "circle")))
    w = ext / n
    w2 = w / 2
    l = 2 * r * _math.sin(w * _math.pi / 360)
    if r < 0:
        l, w, w2 = -l, -w, -w2
    _turn(w2)
    for _i in range(n):
        _forward(l)
        _turn(w)
    _turn(-w2)


# ---- Stylo ----

@_cmd(["penup", "pu", "up"])
def _():
    _s["pen"] = False


@_cmd(["pendown", "pd", "down"])
def _():
    _s["pen"] = True


@_cmd(["isdown"])
def _():
    return _s["pen"]


# Vitesse comme dans le module turtle de Python : 1 (lent) à 10 (rapide), 0 = instantané
@_cmd(["speed"])
def _(s=None):
    if s is None:
        return 3 if _s["speed"] is None else _s["speed"]
    names = {"fastest": 0, "fast": 10, "normal": 6, "slow": 3, "slowest": 1}
    if isinstance(s, str):
        if s not in names:
            raise TypeError("speed() attend un nombre entre 0 et 10, par exemple speed(5)")
        v = names[s]
    elif not _is_num(s):
        raise TypeError("speed() attend un nombre entre 0 et 10, par exemple speed(5)")
    else:
        v = 0 if (s > 10 or s < 0.5) else _js_round(s)
    _s["speed"] = v


# color("red") : stylo et remplissage ; color("red", "yellow") : stylo, puis remplissage
@_cmd(["color"], 3)
def _(*args):
    if len(args) == 0:
        return (_s["color"], _s["fillColor"])
    if len(args) == 2:
        _s["color"] = _color_from_args([args[0]], "color")
        _s["fillColor"] = _color_from_args([args[1]], "color")
    else:
        _s["color"] = _s["fillColor"] = _color_from_args(list(args), "color")


@_cmd(["pencolor"], 3)
def _(*args):
    if len(args) == 0:
        return _s["color"]
    _s["color"] = _color_from_args(list(args), "pencolor")


@_cmd(["fillcolor"], 3)
def _(*args):
    if len(args) == 0:
        return _s["fillColor"]
    _s["fillColor"] = _color_from_args(list(args), "fillcolor")


@_cmd(["width"])
def _(w=None):
    if w is None:
        return _s["width"]
    _s["width"] = _num(w, "width")


@_cmd(["pensize"])
def _(w=None):
    if w is None:
        return _s["width"]
    _s["width"] = _num(w, "pensize")


# ---- Remplissage ----

@_cmd(["begin_fill"])
def _():
    _s["filling"] = True
    _s["fillPts"] = [[_s["x"], _s["y"]]]
    _s["fillFrom"] = len(_path)


@_cmd(["end_fill"])
def _():
    if _s["filling"] and len(_s["fillPts"]) >= 3:
        _record({"type": "fill", "points": _s["fillPts"], "color": _s["fillColor"], "from": _s["fillFrom"]})
    _s["filling"] = False
    _s["fillPts"] = None


@_cmd(["filling"])
def _():
    return _s["filling"]


# ---- Points, texte, fond ----

# dot() ou dot(taille) ou dot(taille, "couleur")
@_cmd(["dot"], 4)
def _(size=None, *rest):
    s = max(_s["width"] + 4, 2 * _s["width"]) if size is None else _num(size, "dot")
    c = _color_from_args(list(rest), "dot") if rest else _s["color"]
    _record({"type": "dot", "x": _s["x"], "y": _s["y"], "size": s, "color": c})


def _nombre_ou(v, defaut):
    try:
        n = float(v)
        return n if n == n and n != 0 else defaut
    except Exception:
        return defaut


# write("texte"), write("texte", align="center"), write("texte", font=("Arial", 16, "bold"))
@_cmd(["write"], 4, keywords=True)
def _(arg=None, move=False, align="left", font=("Arial", 8, "normal")):
    text = "" if arg is None else str(arg)
    al = "left" if align is None else str(align)
    if al not in ("left", "center", "right"):
        al = "left"
    f = ("Arial", 8, "normal") if font is None else font
    if not isinstance(f, (list, tuple)):
        f = [str(f), 8, "normal"]
    f = list(f) + [None, None, None]
    _record({"type": "write", "x": _s["x"], "y": _s["y"], "text": text, "align": al, "color": _s["color"],
             "font": {"family": str(f[0] or "Arial"), "size": _nombre_ou(f[1], 8), "style": str(f[2] or "normal")}})


@_cmd(["bgcolor"], 3)
def _(*args):
    if len(args) == 0:
        return None
    _record({"type": "bgcolor", "color": _color_from_args(list(args), "bgcolor")})


@_cmd(["clear"])
def _():
    _record({"type": "clear"})


@_cmd(["reset"])
def _():
    _record({"type": "clear"})
    speed = _s["speed"]
    _reset_state()
    _s["speed"] = speed


# ---- Tortue et position ----

@_cmd(["hideturtle", "ht"])
def _():
    _s["visible"] = False


@_cmd(["showturtle", "st"])
def _():
    _s["visible"] = True


@_cmd(["isvisible"])
def _():
    return _s["visible"]


@_cmd(["position", "pos"])
def _():
    return (_s["x"], _s["y"])


@_cmd(["xcor"])
def _():
    return _s["x"]


@_cmd(["ycor"])
def _():
    return _s["y"]


@_cmd(["heading"])
def _():
    return _s["heading"]


@_cmd(["distance"])
def _(x=None, y=None):
    p = _point(x, y, "distance")
    return _math.hypot(_s["x"] - p[0], _s["y"] - p[1])


# Commandes acceptées mais sans effet sur le dessin
def _sans_effet(nom):
    def commande(*args, **kwargs):
        return None
    commande.__name__ = nom
    return commande


for _n in ["done", "mainloop", "exitonclick", "shape", "tracer", "update",
           "title", "delay", "setup", "shapesize", "stamp"]:
    globals()[_n] = _sans_effet(_n)
    __all__.append(_n)

del _, _n
_reset_state()
