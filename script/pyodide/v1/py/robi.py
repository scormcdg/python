# Jeu « Robi » (version Pyodide) : les commandes de Robi, en Python.
#
# Mêmes règles et mêmes messages que la version Skulpt (script/v1/js/jeu.js).
# Chaque commande est enregistrée comme un événement ; l'animation et la vérification
# se font ensuite dans la page (js/jeu.js, js/jeu-app.js, js/jeu-dessin.js) à partir de cet enregistrement.
#
# Le terrain est une suite de colonnes vues de côté :
#   sol[x]       hauteur du sol (en marches) de la colonne x
#   objets[x]    "cle" ou "coffre"
#   caisses[x]   nombre de caisses empilées sur la colonne x (elles bloquent le passage)
#   panneaux[x]  valeur affichée par un panneau (nombre ou mot), lue avec lire_nombre() / lire_mot()
# Les commandes sont ajoutées aux fonctions de base de Python (pas besoin d'import).

import builtins
import math

MAX_ACTIONS = 3000

_partie = None


def _nouvelle_partie(monde, autorisees):
    """Appelé par moteur.py avant chaque exécution d'un programme Robi."""
    global _partie
    _partie = {
        "sol": list(monde["sol"]),
        # les clés JSON sont des textes : on les remet en nombres (numéros de colonne)
        "objets": {int(k): v for k, v in (monde.get("objets") or {}).items()},
        "caisses": {int(k): v for k, v in (monde.get("caisses") or {}).items()},
        "panneaux": {int(k): v for k, v in (monde.get("panneaux") or {}).items()},
        "x": monde.get("depart") or 0,
        "dir": monde.get("dir") or 1,
        "cle": False,
        "ouvert": False,
        "evenements": [],
        "actions": 0,
        "autorisees": autorisees,
    }


def _etat():
    """Événements et état final, renvoyés à la page."""
    p = _partie
    if p is None:
        return None
    return {"evenements": p["evenements"],
            "final": {"x": p["x"], "dir": p["dir"], "cle": p["cle"], "ouvert": p["ouvert"]}}


def _echec(message):
    # Erreur du jeu : arrête le programme avec un message pour l'élève
    return RuntimeError("Robi " + message)


def _noter(ev):
    _partie["actions"] += 1
    if _partie["actions"] > MAX_ACTIONS:
        raise _echec("a fait plus de " + str(MAX_ACTIONS) + " actions : y a-t-il une boucle qui ne s'arrête jamais ?")
    _partie["evenements"].append(ev)


def _devant():
    return _partie["x"] + _partie["dir"]


def _dans_terrain(x):
    return 0 <= x < len(_partie["sol"])


def _caisses(x):
    return _partie["caisses"].get(x, 0)


def _arrivee(x):
    if _partie["objets"].get(x) == "cle" and not _partie["cle"]:
        _partie["cle"] = True
        del _partie["objets"][x]
        _noter({"t": "cle", "x": x})


def _echouer(ev, message):
    e = {"t": "echec", "x": _partie["x"], "message": "Robi " + message}
    e.update(ev or {})
    _noter(e)
    raise _echec(message)


# ---------------- Commandes ----------------

def _avancer():
    sol, x, nx = _partie["sol"], _partie["x"], _devant()
    if not _dans_terrain(nx):
        _echouer({"type": "bord"}, "est au bord du terrain : il ne peut pas avancer plus loin")
    if _caisses(nx) > 0:
        _echouer({"type": "caisse"}, "est bloqué par une caisse")
    dh = sol[nx] - sol[x]
    if dh > 0:
        _echouer({"type": "mur", "hauteur": dh}, "est bloqué : il y a une marche de " + str(dh) + " devant lui")
    _noter({"t": "avancer", "de": x, "vers": nx, "chute": -dh})
    _partie["x"] = nx
    _arrivee(nx)


def _sauter(n):
    sol, x, nx = _partie["sol"], _partie["x"], _devant()
    if not _dans_terrain(nx):
        _echouer({"type": "bord"}, "est au bord du terrain : il ne peut pas sauter plus loin")
    if _caisses(nx) > 0:
        _echouer({"type": "caisse"}, "s'est cogné contre une caisse")
    dh = sol[nx] - sol[x]
    # sauter() sert uniquement à monter
    if dh <= 0:
        _echouer({"type": "rien", "saut": n}, "n'a pas de marche à sauter devant lui : la case suivante " +
                 ("est à la même hauteur" if dh == 0 else "est plus basse") + ", utilisez avancer()")
    if n < dh:
        _echouer({"type": "court", "hauteur": dh, "saut": n},
                 "a sauté trop bas : la marche fait " + str(dh) + " et il n'a sauté que " + _nombre(n))
    if n > dh:
        _echouer({"type": "haut", "hauteur": dh, "saut": n},
                 "a sauté trop haut et s'est cogné : la marche ne fait que " + str(dh))
    _noter({"t": "sauter", "de": x, "vers": nx, "hauteur": n})
    _partie["x"] = nx
    _arrivee(nx)


def _nombre(n):
    # comme JavaScript : 2.0 s'écrit 2
    return str(int(n)) if isinstance(n, float) and n == int(n) else str(n)


def _demi_tour():
    _partie["dir"] = -_partie["dir"]
    _noter({"t": "tourner", "dir": _partie["dir"]})


def _frapper():
    nx = _devant()
    if not _dans_terrain(nx) or not _caisses(nx) > 0:
        _echouer({"type": "vide"}, "a frappé dans le vide : il n'y a pas de caisse devant lui")
    _partie["caisses"][nx] = _caisses(nx) - 1
    _noter({"t": "frapper", "x": nx, "reste": _partie["caisses"][nx]})


def _ouvrir():
    x = _partie["x"]
    if _partie["objets"].get(x) != "coffre":
        _echouer({"type": "pas-coffre"}, "n'est pas sur le coffre")
    if not _partie["cle"]:
        _echouer({"type": "ferme"}, "ne peut pas ouvrir le coffre : il n'a pas encore la clé")
    _partie["ouvert"] = True
    _noter({"t": "ouvrir", "x": x})


def _lire_nombre():
    v = _partie["panneaux"].get(_partie["x"])
    if v is None:
        _echouer({"type": "pas-panneau"}, "n'est pas sur un panneau")
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        _echouer({"type": "mot"}, "lit un mot sur ce panneau, pas un nombre : utilisez lire_mot()")
    _noter({"t": "lire", "x": _partie["x"], "valeur": v})
    return v


def _lire_mot():
    v = _partie["panneaux"].get(_partie["x"])
    if v is None:
        _echouer({"type": "pas-panneau"}, "n'est pas sur un panneau")
    if not isinstance(v, str):
        _echouer({"type": "nombre"}, "lit un nombre sur ce panneau, pas un mot : utilisez lire_nombre()")
    _noter({"t": "lire", "x": _partie["x"], "valeur": v})
    return v


def _hauteur_devant():
    nx = _devant()
    if not _dans_terrain(nx):
        _echouer({"type": "bord"}, "regarde au-delà du bord du terrain")
    d = _partie["sol"][nx] - _partie["sol"][_partie["x"]]
    _noter({"t": "regarder", "x": _partie["x"], "valeur": d})
    return d


def _sur_coffre():
    b = _partie["objets"].get(_partie["x"]) == "coffre"
    _noter({"t": "regarder", "x": _partie["x"], "valeur": "True" if b else "False"})
    return b


def _obstacle_devant():
    nx = _devant()
    b = _dans_terrain(nx) and _caisses(nx) > 0
    _noter({"t": "regarder", "x": _partie["x"], "valeur": "True" if b else "False"})
    return b


_COMMANDES = {
    "avancer": (_avancer, 0), "sauter": (_sauter, 1), "demi_tour": (_demi_tour, 0), "frapper": (_frapper, 0),
    "ouvrir": (_ouvrir, 0), "lire_nombre": (_lire_nombre, 0), "lire_mot": (_lire_mot, 0),
    "hauteur_devant": (_hauteur_devant, 0), "sur_coffre": (_sur_coffre, 0), "obstacle_devant": (_obstacle_devant, 0),
}


def _commande(nom, fn, maxi):
    def commande(*args, **kwargs):
        if kwargs:
            raise TypeError(nom + "() takes no keyword arguments")
        if len(args) > maxi:
            n = len(args)
            if maxi == 0:
                raise TypeError(nom + "() s'écrit sans rien entre les parenthèses, mais a reçu " + str(n) +
                                " valeur" + ("s" if n > 1 else ""))
            raise TypeError(nom + "() accepte au maximum " + str(maxi) +
                            " valeur entre les parenthèses, mais en a reçu " + str(n))
        if _partie is None:
            raise RuntimeError("Robi n'est pas encore sur le terrain")
        if _partie["autorisees"] is not None and nom not in _partie["autorisees"]:
            raise RuntimeError("Robi ne connaît pas la commande « " + nom +
                               " » dans ce niveau : utilisez seulement les commandes de la liste")
        if nom == "sauter":
            n = args[0] if args else 1
            if isinstance(n, bool) or not isinstance(n, (int, float)) or n != n or n != math.floor(n):
                raise TypeError("sauter() attend un nombre entier, par exemple sauter(2)")
            return fn(n)
        return fn()
    commande.__name__ = nom
    commande.__qualname__ = nom
    return commande


def _installer():
    """Ajoute les commandes aux fonctions de base de Python (appelé une fois par moteur.py)."""
    for nom, (fn, maxi) in _COMMANDES.items():
        setattr(builtins, nom, _commande(nom, fn, maxi))
