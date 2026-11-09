# Python Pyodide v1 — fichiers communs des séries SCORM (version « vrai Python »)

Chargés par les paquets SCORM depuis `https://scormcdg.github.io/python/script/pyodide/v1/`.
Les anciennes séries (Skulpt) utilisent toujours `script/v1/` et ne changent pas.

La page est exactement la même que celle de `script/v1/` : seul le moteur Python change.
Python est Pyodide 0.29.5 (le vrai Python 3.13). Il est chargé d'abord depuis jsDelivr (adresse officielle
de Pyodide) ; si jsDelivr ne répond pas en 6 secondes, depuis la copie de `vendor/pyodide/` (fichiers officiels
du paquet npm `pyodide@0.29.5`, licence MPL-2.0).
Environ 12 Mo la première fois, gardés ensuite par le navigateur. Python tourne dans un « worker », à part de la page.

- `js/canvas.js`, `js/checker.js`, `js/couleurs.js`, `js/scorm.js`, `vendor/codemirror/`, `vendor/fonts/` :
  copies identiques de `script/v1/` (même dessin, même vérification)
- `js/app.js`, `css/style.css` : comme dans `script/v1/`, avec en plus, sous le message d'erreur en français,
  « Message de Python (en anglais) » à déplier (le message du vrai Python)
- `js/engine.js` : même interface et mêmes messages d'erreur que `script/v1/js/engine.js` ;
  exécution dans le worker, limite de 5 s (Python est alors arrêté puis rechargé), `input()` dans la console
- `js/worker.js` : charge Pyodide, `py/moteur.py` et `py/turtle.py`
- `py/moteur.py` : exécution des programmes, `input()` (JSPI), description des erreurs
- `py/turtle.py` : la tortue, écrite en Python ; elle enregistre les déplacements comme `script/v1/js/turtle.js`
- `vendor/pyodide/` : Pyodide (seulement le cœur : pas de numpy ni pandas, inutiles pour la tortue)
- `py/robi.py` : les commandes du jeu Robi, en Python (mêmes règles et mêmes messages que `script/v1/js/jeu.js`)
- `js/jeu.js` : le jeu Robi (lance une partie, renvoie les événements) ; `js/jeu-app.js`, `js/jeu-dessin.js` :
  copies identiques de `script/v1/` (même page de jeu, même animation)
- `js/turtle.js` : reçoit l'enregistrement de la tortue (`TurtleRec`) pour le dessin et la vérification

`input()` met le programme en pause pendant que l'élève répond (JSPI). Il faut un navigateur récent :
Chrome ou Edge 137, Firefox 153, Safari 27 (ou plus récents). Sinon, seul `input()` ne marche pas,
avec un message clair.

Pour faire passer une série à cette version, dans le paquet :
- `index.html` : `var COMMUN = "https://scormcdg.github.io/python/script/pyodide/v1/";`
- `charger.js` : enlever les deux lignes `vendor/skulpt/…` de la liste SCRIPTS.

C'est pareil pour Robi l'explorateur (paquet avec `APP = "js/jeu-app.js"`).

Différence visible avec Skulpt : `print(heading())`, `print(xcor())`, `print(pos())` affichent
des nombres à virgule (`30.0`, `(10.0, 0.0)`), comme le vrai Python.
