# Python Pyodide v1 — fichiers communs des séries SCORM (version « vrai Python »)

Chargés par les paquets SCORM depuis `https://scormcdg.github.io/python/script/pyodide/v1/`.
Les anciennes séries (Skulpt) utilisent toujours `script/v1/` et ne changent pas.

La page est exactement la même que celle de `script/v1/` : seul le moteur Python change.
Python est Pyodide 0.29.5 (le vrai Python 3.13), chargé depuis jsDelivr (environ 12 Mo la
première fois, gardés ensuite par le navigateur). Il tourne dans un « worker », à part de la page.

- `js/app.js`, `js/canvas.js`, `js/checker.js`, `js/couleurs.js`, `js/scorm.js`, `css/`, `vendor/` :
  copies identiques de `script/v1/` (même page, même dessin, même vérification)
- `js/engine.js` : même interface et mêmes messages d'erreur que `script/v1/js/engine.js` ;
  exécution dans le worker, limite de 5 s (Python est alors arrêté puis rechargé), `input()` dans la console
- `js/worker.js` : charge Pyodide, `py/moteur.py` et `py/turtle.py`
- `py/moteur.py` : exécution des programmes, `input()` (JSPI), description des erreurs
- `py/turtle.py` : la tortue, écrite en Python ; elle enregistre les déplacements comme `script/v1/js/turtle.js`
- `js/turtle.js` : reçoit l'enregistrement de la tortue (`TurtleRec`) pour le dessin et la vérification

`input()` met le programme en pause pendant que l'élève répond (JSPI). Il faut un navigateur récent :
Chrome ou Edge 137, Firefox 153, Safari 27 (ou plus récents). Sinon, seul `input()` ne marche pas,
avec un message clair.

Pour faire passer une série à cette version, dans le paquet :
- `index.html` : `var COMMUN = "https://scormcdg.github.io/python/script/pyodide/v1/";`
- `charger.js` : enlever les deux lignes `vendor/skulpt/…` de la liste SCRIPTS.

Différence visible avec Skulpt : `print(heading())`, `print(xcor())`, `print(pos())` affichent
des nombres à virgule (`30.0`, `(10.0, 0.0)`), comme le vrai Python.
