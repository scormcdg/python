# Python v1 — fichiers communs des séries SCORM

Chargés par les paquets SCORM depuis `https://scormcdg.github.io/python/script/v1/`.
Chaque paquet garde une copie de secours, utilisée si GitHub ne répond pas.

- `vendor/skulpt/` : interpréteur Python (Skulpt)
- `vendor/codemirror/` : éditeur de code
- `vendor/fonts/` : polices Atkinson Hyperlegible et JetBrains Mono
- `js/engine.js` : exécution, limite de temps, `input()` dans la console, messages d'erreur en français
- `js/turtle.js`, `js/couleurs.js`, `js/canvas.js` : tortue (facultative), couleurs, dessin animé
- `js/checker.js` : vérification des exercices de tortue
- `js/scorm.js` : enregistrement dans Moodle
- `js/app.js`, `css/style.css` : page des séries avec tortue

Petite correction (message, couleur) : la faire ici, elle s'applique à toutes les séries.
Gros changement : créer `script/v2/`, tester, puis faire passer les séries une à une.
