# Exécution des programmes des élèves dans Pyodide (appelé par js/worker.js).
#
# _lancer(json) exécute un programme ou appelle une commande et renvoie un texte JSON :
#   { "erreur": {type, msg, ligne} ou null, "trop": bool, "tortue": instantané ou null,
#     "fonctions": [noms des commandes définies], "robi": événements et état final (jeu Robi) ou null }
# Jeu Robi : si le job contient "robi": { monde, autorisees }, le programme joue sur ce terrain (py/robi.py).
#
# input() : sans réponses prévues, le programme est mis en pause (JSPI, run_sync de Pyodide)
# jusqu'à la réponse tapée dans la console. Avec réponses prévues (vérification), elles sont
# données une à une ; s'il y a plus de questions que de réponses, l'exécution s'arrête.

import sys
import json
import types
import builtins
import importlib.abc
import importlib.machinery

import js

sys.setrecursionlimit(500)

_tortue_src = None
_tortue_active = True
_modules = {}           # programmes déjà exécutés, pour appeler leurs commandes (vérification)
_ordre = []
_MAX_MODULES = 40


class InputIndisponible(Exception):
    pass


class _TropDeQuestions(BaseException):
    pass


_reponses = None
_pos = 0


def _input(invite="", *args, **kwargs):
    global _pos
    q = "" if invite is None else str(invite)
    sys.stdout.flush()
    if _reponses is not None:
        js.ecrire(q, True)
        if _pos >= len(_reponses):
            raise _TropDeQuestions()
        rep = str(_reponses[_pos])
        _pos += 1
        js.ecrire(rep + "\n", True)
        return rep
    try:
        from pyodide.ffi import run_sync, can_run_sync
        possible = can_run_sync()
    except ImportError:
        possible = False
    if not possible:
        raise InputIndisponible("input")
    return str(run_sync(js.demanderEntree(q)))


builtins.input = _input


# ---- Module turtle : le nôtre (ou aucun si la série n'a pas de tortue) ----

class _Chercheur(importlib.abc.MetaPathFinder):
    def find_spec(self, nom, path=None, target=None):
        if nom == "turtle":
            if not _tortue_active:
                raise ModuleNotFoundError("No module named 'turtle'", name="turtle")
            return importlib.machinery.ModuleSpec("turtle", _Chargeur())
        if nom in ("tkinter", "_tkinter"):
            raise ModuleNotFoundError("No module named '" + nom + "'", name=nom)
        return None


class _Chargeur(importlib.abc.Loader):
    def create_module(self, spec):
        return None

    def exec_module(self, module):
        module.__file__ = "<turtle>"
        exec(compile(_tortue_src, "<turtle>", "exec"), module.__dict__)


sys.meta_path.insert(0, _Chercheur())


def _installer(src, active):
    global _tortue_src, _tortue_active
    _tortue_src = src
    _tortue_active = bool(active)
    sys.modules.pop("turtle", None)


def _installer_robi(src):
    """Charge py/robi.py (les commandes de Robi) ; elles ne deviennent disponibles qu'au premier programme Robi."""
    module = types.ModuleType("_robi")
    module.__file__ = "<robi>"
    exec(compile(src, "<robi>", "exec"), module.__dict__)
    module._installe = False
    sys.modules["_robi"] = module


def _tortue():
    t = sys.modules.get("turtle")
    return t if t is not None and hasattr(t, "_reset") else None


# ---- Erreurs ----

def _decrire(e):
    ligne = None
    if isinstance(e, SyntaxError) and getattr(e, "filename", None) == "<programme>":
        ligne = e.lineno
    tb = e.__traceback__
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == "<programme>":
            ligne = tb.tb_lineno
        tb = tb.tb_next
    if isinstance(e, SyntaxError):
        msg = e.msg
    elif isinstance(e, KeyError) and len(e.args) == 1:
        msg = repr(e.args[0])
    else:
        msg = str(e)
    return {"type": type(e).__name__, "msg": msg, "ligne": ligne}


def _fonctions(ns):
    return [k for k, v in ns.items() if isinstance(v, types.FunctionType)]


def _garder(id_, ns):
    _modules[id_] = ns
    _ordre.append(id_)
    while len(_ordre) > _MAX_MODULES:
        _modules.pop(_ordre.pop(0), None)


def _lancer(texte):
    global _reponses, _pos
    job = json.loads(texte)
    _reponses = job.get("inputs")
    _pos = 0
    t = _tortue()
    if t:
        t._reset()
    robi = sys.modules.get("_robi") if job.get("robi") else None
    if robi is not None:
        if not robi._installe:
            robi._installer()
            robi._installe = True
        robi._nouvelle_partie(job["robi"]["monde"], job["robi"].get("autorisees"))
    res = {"erreur": None, "trop": False, "fonctions": []}
    ns = None
    try:
        if job["type"] == "run":
            ns = {"__name__": "__main__", "__builtins__": builtins}
            _garder(job["id"], ns)
            code = compile(job["code"], "<programme>", "exec")
            exec(code, ns)
        else:
            ns = _modules.get(job["module"])
            f = ns.get(job["name"]) if ns is not None else None
            if not callable(f):
                raise NameError("name '" + str(job["name"]) + "' is not defined")
            f(*job.get("args", []))
    except _TropDeQuestions:
        res["trop"] = True
    except SystemExit:
        pass
    except BaseException as e:
        res["erreur"] = _decrire(e)
    finally:
        _reponses = None
        try:
            sys.stdout.flush()
        except Exception:
            pass
    if ns is not None:
        res["fonctions"] = _fonctions(ns)
    if robi is not None:
        res["robi"] = robi._etat()
        robi._partie = None
    texte = json.dumps(res)
    t = _tortue()
    if t:
        # le tracé est déjà en JSON (t._snapshot()) : on le glisse tel quel, sans le déballer
        texte = texte[:-1] + ', "tortue": ' + t._snapshot() + "}"
    return texte
