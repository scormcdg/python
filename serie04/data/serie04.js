/*
 * Série 04 – Faire évoluer les paramètres (exemple + exercices 1 à 11)
 *
 * Même format que la série 03 (voir data/serie03.js), avec en plus :
 *   { kind: "shape", target, args: [10, 50], … }   la commande est testée avec ces valeurs
 *   { kind: "params", name, count, example }        def name(...) a count paramètres
 *   { kind: "source", re, label, fail }             le code (sans commentaires ni textes) contient re
 */
(function (global) {
  "use strict";

  var RAPPEL_OPERATEURS =
    "<div class=\"encadre\"><p><strong>Modifier une variable</strong></p>" +
    "<table style=\"border-collapse:collapse;margin:0 0 6px\">" +
    "<tr><td style=\"padding:2px 2.5em 2px 0\"><code>x += 5</code></td><td>augmente x de 5</td></tr>" +
    "<tr><td style=\"padding:2px 2.5em 2px 0\"><code>x -= 5</code></td><td>diminue x de 5</td></tr>" +
    "<tr><td style=\"padding:2px 2.5em 2px 0\"><code>x *= 2</code></td><td>multiplie x par 2</td></tr>" +
    "<tr><td style=\"padding:2px 2.5em 2px 0\"><code>x /= 2</code></td><td>divise x par 2</td></tr></table></div>";

  var OPTS = { rotate: true, mirror: true };

  // Exercice 11 : même indication quelle que soit l'erreur (taille, forme ou nombre de traits)
  var HINT_SIGNE = "Dans signe(), répétez 3 fois : triangle(cote) (avec le paramètre cote), puis left(120).";
  var HINT_SPIRALE = "Dans spirale(), répétez nombre fois : signe(cote) (avec la variable cote, pas un nombre fixe), " +
    "puis left(8) et cote += 15. Le programme appelle spirale(30, 6).";
  // Exercice 9
  var HINT_TRIANGLES = "Dans triangles(), répétez nombre fois : triangle(cote) (avec la variable cote), " +
    "puis forward(cote / 2), left(60) et cote /= 2.";

  global.SERIE = {
    id: "serie04",
    titre: "Série 04 – Faire évoluer les paramètres",
    exercices: [
      {
        id: "exemple",
        titre: "Exemple",
        note: false,
        figure: false,
        enonce:
          "<p>On aimerait dessiner une <strong>spirale</strong> : la tortue dessine chaque segment un peu plus long que le précédent.</p>" +
          "<p>Sans boucle, il faudrait écrire <code>forward(cote)</code>, <code>left(90)</code>, <code>forward(cote + 5)</code>, " +
          "<code>left(90)</code>, <code>forward(cote + 10)</code>… soit environ 100 lignes pour 50 segments. " +
          "Le programme répète toujours les deux mêmes commandes : seule la valeur de <code>cote</code> change.</p>" +
          "<p>On utilise donc une boucle, et on augmente <code>cote</code> à chaque tour avec l'instruction <code>cote += 5</code>. " +
          "Exécutez le programme ci-dessous et observez le résultat.</p>" +
          RAPPEL_OPERATEURS,
        code:
          "from turtle import *\n\n" +
          "def spirale(cote):\n    for i in range(50):\n        forward(cote)\n        left(90)\n        cote += 5\n\n" +
          "spirale(10)\n\ndone()\n",
        solutions: [],
        checks: []
      },
      {
        id: "ex1",
        titre: "Exercice 1",
        note: true,
        figure: true,
        enonce:
          "<p>Modifiez le programme de l'exemple pour qu'il dessine une spirale avec les propriétés suivantes :</p>" +
          "<ul><li>le premier côté mesure <strong>6</strong> ;</li>" +
          "<li>chaque côté est <strong>plus long de 2</strong> que le précédent ;</li>" +
          "<li>la spirale possède en tout <strong>36 côtés</strong>.</li></ul>" + RAPPEL_OPERATEURS,
        code:
          "from turtle import *\n\n" +
          "def spirale(cote):\n    for i in range(50):\n        forward(cote)\n        left(90)\n        cote += 5\n\n" +
          "spirale(10)\n\ndone()\n",
        solutions: [
          "from turtle import *\n\ndef spirale(cote):\n    for i in range(36):\n        forward(cote)\n        left(90)\n        cote += 2\n\nspirale(6)\n"
        ],
        checks: [
          { id: "boucle", kind: "source", re: "\\b(for|while)\\b",
            label: "Le programme utilise une boucle",
            fail: "Utilisez une boucle for plutôt que d'écrire chaque côté à la main." },
          { id: "dessin", kind: "shape", target: "<program>", opts: OPTS,
            label: "Le programme dessine la spirale demandée",
            hint: { count: "La spirale doit avoir 36 côtés : vérifiez le nombre de tours de la boucle.",
                    size: "Vérifiez la longueur du premier côté et de combien elle augmente à chaque tour." } }
        ]
      },
      {
        id: "ex2",
        titre: "Exercice 2",
        note: true,
        figure: true,
        enonce:
          "<p>Écrivez un programme qui dessine une spirale partant de l'<strong>extérieur</strong> vers l'<strong>intérieur</strong> :</p>" +
          "<ul><li>le premier côté mesure <strong>200</strong> ;</li>" +
          "<li>chaque côté est <strong>plus court de 3</strong> que le précédent ;</li>" +
          "<li>la spirale possède en tout <strong>50 côtés</strong>.</li></ul>" + RAPPEL_OPERATEURS,
        code: "from turtle import *\n\n\n\ndone()\n",
        solutions: [
          "from turtle import *\n\ndef spirale(cote):\n    for i in range(50):\n        forward(cote)\n        left(90)\n        cote -= 3\n\nspirale(200)\n"
        ],
        checks: [
          { id: "boucle", kind: "source", re: "\\b(for|while)\\b",
            label: "Le programme utilise une boucle",
            fail: "Utilisez une boucle for plutôt que d'écrire chaque côté à la main." },
          { id: "dessin", kind: "shape", target: "<program>", opts: OPTS,
            label: "Le programme dessine la spirale demandée",
            hint: { count: "La spirale doit avoir 50 côtés : vérifiez le nombre de tours de la boucle.",
                    size: "Le premier côté mesure 200, puis chaque côté est plus court de 3 : cote -= 3." } }
        ]
      },
      {
        id: "ex3",
        titre: "Exercice 3",
        note: true,
        figure: true,
        enonce:
          "<p>Modifiez le programme de l'exemple pour qu'il dessine une <strong>spirale hexagonale</strong> :</p>" +
          "<ul><li>le premier côté mesure <strong>10</strong> ;</li>" +
          "<li>à chaque nouveau segment, la longueur du côté précédent est <strong>multipliée par 1.2</strong> ;</li>" +
          "<li>la boucle est répétée <strong>18 fois</strong>.</li></ul>" +
          "<p>Pour un hexagone, de combien de degrés la tortue doit-elle tourner à chaque coin ?</p>" + RAPPEL_OPERATEURS,
        code:
          "from turtle import *\n\n" +
          "def spirale(cote):\n    for i in range(50):\n        forward(cote)\n        left(90)\n        cote += 5\n\n" +
          "spirale(10)\n\ndone()\n",
        solutions: [
          "from turtle import *\n\ndef spirale(cote):\n    for i in range(18):\n        forward(cote)\n        left(60)\n        cote *= 1.2\n\nspirale(10)\n"
        ],
        checks: [
          { id: "fois", kind: "source", re: "\\*=|\\*\\s*1\\.2|1\\.2\\s*\\*",
            label: "La longueur est multipliée par 1.2 à chaque tour",
            fail: "À chaque tour, multipliez la longueur par 1.2 avec cote *= 1.2." },
          { id: "dessin", kind: "shape", target: "<program>", opts: OPTS,
            label: "Le programme dessine la spirale hexagonale demandée",
            hint: { shape: "Un hexagone a 6 coins : la tortue tourne de 360 / 6 = 60° à chaque coin.",
                    count: "La boucle doit être répétée 18 fois." } }
        ]
      },
      {
        id: "ex4",
        titre: "Exercice 4",
        note: true,
        figure: true,
        enonce:
          "<p>Écrivez une nouvelle commande <code>spirale_hex(cote, nombre)</code> qui dessine une spirale hexagonale. " +
          "Elle prend <strong>deux paramètres</strong> :</p>" +
          "<ul><li><code>cote</code> : la longueur du premier segment ;</li>" +
          "<li><code>nombre</code> : le nombre de segments de la spirale.</li></ul>" +
          "<p>Pendant que la spirale est dessinée, la longueur du segment est à chaque fois <strong>augmentée de 3</strong>.</p>" +
          "<p>Testez avec un côté de <strong>10</strong> et <strong>50</strong> segments : <code>spirale_hex(10, 50)</code>.</p>",
        code: "from turtle import *\n\n# Définissez ici la commande spirale_hex(cote, nombre)\n\n\n\ndone()\n",
        solutions: [
          "from turtle import *\n\ndef spirale_hex(cote, nombre):\n    for i in range(nombre):\n        forward(cote)\n        left(60)\n        cote += 3\n\nspirale_hex(10, 50)\n"
        ],
        checks: [
          { id: "def", kind: "params", name: "spirale_hex", count: 2,
            label: "La commande spirale_hex(cote, nombre) est définie avec 2 paramètres",
            example: "def spirale_hex(cote, nombre):" },
          { id: "forme", kind: "shape", target: "spirale_hex", args: [10, 50], opts: OPTS,
            label: "spirale_hex(10, 50) dessine la spirale demandée",
            hint: { shape: "Pour une spirale hexagonale, la tortue tourne de 60° à chaque coin.",
                    count: "Le nombre de segments doit être donné par le paramètre nombre : for i in range(nombre):",
                    size: "La longueur augmente de 3 à chaque segment : cote += 3." } },
          { id: "autre", kind: "shape", target: "spirale_hex", args: [20, 12], opts: OPTS,
            label: "spirale_hex() marche aussi avec d'autres valeurs, par exemple spirale_hex(20, 12)",
            hint: "Utilisez bien les paramètres cote et nombre dans la commande, au lieu d'écrire 10 et 50 directement." },
          { id: "appel", kind: "calls", caller: "<main>", callee: "spirale_hex",
            label: "Le programme utilise spirale_hex()",
            fail: "Ajoutez spirale_hex(10, 50) après la définition pour tester votre commande." }
        ]
      },
      {
        id: "ex5",
        titre: "Exercice 5",
        note: true,
        figure: true,
        enonce:
          "<p>Écrivez une commande <code>demi_coeur(angle)</code> qui fait dessiner un demi-cœur à la tortue, comme sur la figure :</p>" +
          "<ul><li>la tortue avance d'abord de <strong>10 pas verticalement vers le haut</strong></li>" +
          "<li>elle tourne de <strong>30°</strong> vers la gauche et avance à nouveau de 10 pas</li>" +
          "<li>elle tourne de <strong>28°</strong> vers la gauche et avance de 10 pas</li>" +
          "<li>elle tourne de <strong>26°</strong> vers la gauche et avance de 10 pas, etc.</li></ul>" +
          "<p>Au total, la tortue dessine <strong>16 segments</strong>.</p>" +
          "<p><em>Indication :</em> utilisez un paramètre <code>angle</code> qui vaut 30 au départ.</p>",
        code: "from turtle import *\n\n# Définissez ici la commande demi_coeur(angle)\n\n\n\ndone()\n",
        solutions: [
          "from turtle import *\n\ndef demi_coeur(angle):\n    left(90)\n    forward(10)\n" +
          "    for i in range(15):\n        left(angle)\n        forward(10)\n        angle -= 2\n\ndemi_coeur(30)\n"
        ],
        checks: [
          { id: "def", kind: "params", name: "demi_coeur", count: 1,
            label: "La commande demi_coeur(angle) a un paramètre",
            example: "def demi_coeur(angle):" },
          { id: "moins", kind: "source", re: "-=|=\\s*angle\\s*-",
            label: "L'angle diminue de 2° à chaque tour (angle -= 2)",
            fail: "Dans la boucle, diminuez l'angle avec angle -= 2 au lieu d'écrire chaque angle à la main." },
          { id: "forme", kind: "shape", target: "demi_coeur", args: [30], opts: OPTS,
            label: "demi_coeur(30) dessine le demi-cœur",
            hint: { count: "Il faut 16 segments en tout : un premier segment vers le haut, puis 15 segments après chaque virage.",
                    shape: "Les angles sont 30°, 28°, 26°… : la tortue tourne avant chaque nouveau segment, puis l'angle diminue de 2." } },
          { id: "appel", kind: "calls", caller: "<main>", callee: "demi_coeur",
            label: "Le programme utilise demi_coeur()",
            fail: "Ajoutez demi_coeur(30) après la définition pour dessiner le demi-cœur." }
        ]
      },
      {
        id: "ex6",
        titre: "Exercice 6",
        note: true,
        figure: true,
        enonce:
          "<p>Modifiez le programme de l'exercice 5 afin de pouvoir passer aussi en paramètre la <strong>taille</strong> du demi-cœur : " +
          "<code>demi_coeur(angle, taille)</code>, où <code>taille</code> est la longueur de chaque segment (10 dans l'exercice 5).</p>" +
          "<p>Par exemple, <code>demi_coeur(30, 20)</code> dessine un demi-cœur deux fois plus grand que <code>demi_coeur(30, 10)</code>.</p>",
        code: "from turtle import *\n\n# Recopiez votre demi_coeur(angle) et ajoutez le paramètre taille\n\n\n\ndone()\n",
        solutions: [
          "from turtle import *\n\ndef demi_coeur(angle, taille):\n    left(90)\n    forward(taille)\n" +
          "    for i in range(15):\n        left(angle)\n        forward(taille)\n        angle -= 2\n\ndemi_coeur(30, 20)\n"
        ],
        checks: [
          { id: "def", kind: "params", name: "demi_coeur", count: 2,
            label: "La commande demi_coeur(angle, taille) a deux paramètres",
            example: "def demi_coeur(angle, taille):" },
          { id: "petit", kind: "shape", target: "demi_coeur", args: [30, 10], opts: OPTS,
            label: "demi_coeur(30, 10) dessine le demi-cœur de l'exercice 5",
            hint: { shape: "Les paramètres sont dans l'ordre : d'abord angle, puis taille." } },
          { id: "grand", kind: "shape", target: "demi_coeur", args: [30, 25], opts: OPTS,
            label: "demi_coeur(30, 25) dessine un demi-cœur plus grand",
            hint: { size: "Utilisez le paramètre taille dans forward(…) au lieu de 10.",
                    shape: "Utilisez le paramètre taille dans forward(…) au lieu de 10." } },
          { id: "appel", kind: "calls", caller: "<main>", callee: "demi_coeur",
            label: "Le programme utilise demi_coeur()",
            fail: "Ajoutez par exemple demi_coeur(30, 20) après la définition." }
        ]
      },
      {
        id: "ex7",
        titre: "Exercice 7",
        note: true,
        figure: true,
        enonce:
          "<p>Écrivez une commande <code>carres(nombre, cote)</code> qui dessine la figure ci-contre : des carrés qui partent " +
          "tous du même coin, et dont les côtés sont chaque fois <strong>plus grands de 10</strong>.</p>" +
          "<ul><li><code>nombre</code> : le nombre de carrés ;</li>" +
          "<li><code>cote</code> : la taille du plus petit carré.</li></ul>" +
          "<p>La figure ci-contre est dessinée avec <code>carres(5, 20)</code>.</p>",
        code: "from turtle import *\n\n# Définissez ici la commande carres(nombre, cote)\n\n\n\ndone()\n",
        solutions: [
          "from turtle import *\n\ndef carres(nombre, cote):\n    for i in range(nombre):\n        for j in range(4):\n" +
          "            forward(cote)\n            left(90)\n        cote += 10\n\ncarres(5, 20)\n"
        ],
        checks: [
          { id: "def", kind: "params", name: "carres", count: 2,
            label: "La commande carres(nombre, cote) est définie avec 2 paramètres",
            example: "def carres(nombre, cote):" },
          { id: "forme", kind: "shape", target: "carres", args: [5, 20], opts: OPTS,
            label: "carres(5, 20) dessine la figure",
            hint: { count: "Vérifiez le nombre de carrés : il est donné par le paramètre nombre.",
                    size: "Chaque carré est plus grand de 10 que le précédent : cote += 10." } },
          { id: "autre", kind: "shape", target: "carres", args: [3, 50], opts: OPTS,
            label: "carres() marche aussi avec d'autres valeurs, par exemple carres(3, 50)",
            hint: "Utilisez bien les paramètres nombre et cote dans la commande." },
          { id: "appel", kind: "calls", caller: "<main>", callee: "carres",
            label: "Le programme utilise carres()",
            fail: "Ajoutez par exemple carres(5, 20) après la définition." }
        ]
      },
      {
        id: "ex8",
        titre: "Exercice 8",
        note: true,
        figure: true,
        enonce:
          "<p>Écrivez une commande <code>rectangles(longueur, largeur, nombre)</code> avec <strong>3 paramètres</strong> " +
          "qui dessine des rectangles imbriqués, comme sur la figure :</p>" +
          "<ul><li><code>longueur</code> et <code>largeur</code> : les deux côtés du plus petit rectangle ;</li>" +
          "<li><code>nombre</code> : le nombre de rectangles.</li></ul>" +
          "<p>Chaque rectangle est <strong>1.1 fois plus grand</strong> que le précédent (ses deux côtés sont multipliés par 1.1). " +
          "La figure ci-contre est dessinée avec <code>rectangles(100, 40, 5)</code>.</p>" + RAPPEL_OPERATEURS,
        code: "from turtle import *\n\n# Définissez ici la commande rectangles(longueur, largeur, nombre)\n\n\n\ndone()\n",
        solutions: [
          "from turtle import *\n\ndef rectangles(longueur, largeur, nombre):\n    for i in range(nombre):\n        for j in range(2):\n" +
          "            forward(longueur)\n            left(90)\n            forward(largeur)\n            left(90)\n" +
          "        longueur *= 1.1\n        largeur *= 1.1\n\nrectangles(100, 40, 5)\n"
        ],
        checks: [
          { id: "def", kind: "params", name: "rectangles", count: 3,
            label: "La commande rectangles(longueur, largeur, nombre) est définie avec 3 paramètres",
            example: "def rectangles(longueur, largeur, nombre):" },
          { id: "forme", kind: "shape", target: "rectangles", args: [100, 40, 5], opts: OPTS,
            label: "rectangles(100, 40, 5) dessine la figure",
            hint: { size: "Les deux côtés sont multipliés par 1.1 à chaque rectangle : longueur *= 1.1 et largeur *= 1.1.",
                    shape: "Les deux côtés sont multipliés par 1.1 à chaque rectangle : longueur *= 1.1 et largeur *= 1.1.",
                    count: "Vérifiez le nombre de rectangles : il est donné par le paramètre nombre." } },
          { id: "autre", kind: "shape", target: "rectangles", args: [60, 30, 3], opts: OPTS,
            label: "rectangles() marche aussi avec d'autres valeurs, par exemple rectangles(60, 30, 3)",
            hint: "Utilisez bien les trois paramètres dans la commande, dans l'ordre longueur, largeur, nombre." },
          { id: "appel", kind: "calls", caller: "<main>", callee: "rectangles",
            label: "Le programme utilise rectangles()",
            fail: "Ajoutez par exemple rectangles(100, 40, 5) après la définition." }
        ]
      },
      {
        id: "ex9",
        titre: "Exercice 9",
        note: true,
        figure: true,
        enonce:
          "<p>Dessinez le motif de triangles ci-contre :</p>" +
          "<ul><li>le plus grand triangle (équilatéral) a un côté de <strong>256</strong> ;</li>" +
          "<li>chaque triangle suivant relie les <strong>milieux des côtés</strong> du précédent : " +
          "la longueur de ses côtés est donc <strong>divisée par deux</strong> ;</li>" +
          "<li>il y a en tout <strong>6 triangles</strong> (le plus petit a un côté de 8).</li></ul>" +
          "<ul><li>Écrivez d'abord une commande <code>triangle(cote)</code> qui dessine un triangle équilatéral de côté <code>cote</code> ;</li>" +
          "<li>puis une commande <code>triangles(cote, nombre)</code> qui dessine le motif en appelant <code>triangle()</code> : " +
          "<code>nombre</code> triangles, le plus grand de côté <code>cote</code>.</li></ul>" +
          "<p>Le motif ci-contre est dessiné avec <code>triangles(256, 6)</code>.</p>" +
          "<p><em>Indication :</em> après avoir dessiné un triangle, la tortue avance jusqu'au milieu du côté sur lequel elle se trouve, " +
          "puis tourne pour dessiner le triangle suivant.</p>" + RAPPEL_OPERATEURS,
        code: "from turtle import *\n\n# Définissez ici la commande triangle(cote)\n\n\n# puis la commande triangles(cote, nombre)\n\n\n\ndone()\n",
        solutions: [
          "from turtle import *\n\ndef triangle(cote):\n    for i in range(3):\n        forward(cote)\n        left(120)\n\n" +
          "def triangles(cote, nombre):\n    for i in range(nombre):\n        triangle(cote)\n        forward(cote / 2)\n        left(60)\n        cote /= 2\n\n" +
          "triangles(256, 6)\n"
        ],
        checks: [
          { id: "def", kind: "params", name: "triangle", count: 1,
            label: "La commande triangle(cote) est définie avec un paramètre",
            example: "def triangle(cote):" },
          { id: "triangle", kind: "shape", target: "triangle", args: [70], opts: OPTS,
            label: "triangle(70) dessine un triangle équilatéral de côté 70",
            hint: { size: "Utilisez le paramètre cote dans forward(…).",
                    shape: "Un triangle équilatéral : 3 côtés, et la tortue tourne de 120° à chaque coin.",
                    count: "Un triangle a 3 côtés : for i in range(3):" } },
          { id: "def-triangles", kind: "params", name: "triangles", count: 2,
            label: "La commande triangles(cote, nombre) est définie avec deux paramètres",
            example: "def triangles(cote, nombre):" },
          { id: "appel-triangle", kind: "calls", caller: "triangles", callee: "triangle",
            label: "triangles() appelle triangle()",
            fail: "Dans triangles(), dessinez chaque triangle avec votre commande, par exemple triangle(cote), au lieu de répéter les forward(…)." },
          { id: "boucle", kind: "source", re: "\\b(for|while)\\b", in: "triangles",
            label: "triangles() utilise une boucle",
            fail: "Dans triangles(), utilisez une boucle : les triangles se dessinent de la même façon, seule la taille change." },
          { id: "triangles", kind: "shape", target: "triangles", args: [160, 4], opts: OPTS,
            label: "triangles(160, 4) marche aussi avec d'autres valeurs (triangle() reçoit le bon côté)",
            hint: { size: HINT_TRIANGLES, shape: HINT_TRIANGLES, count: HINT_TRIANGLES } },
          { id: "appel", kind: "calls", caller: "<main>", callee: "triangles",
            label: "Le programme utilise triangles()",
            fail: "Ajoutez triangles(256, 6) après les définitions." },
          { id: "dessin", kind: "shape", target: "<program>", opts: OPTS,
            label: "Le programme dessine le motif de triangles",
            hint: { count: "Il faut 6 triangles en tout, du côté 256 au côté 8 : triangles(256, 6).",
                    shape: "Après un triangle de côté c, la tortue avance de c / 2 (milieu du côté), tourne de 60° vers l'intérieur, " +
                           "puis dessine le triangle suivant de côté c / 2.",
                    size: "Chaque triangle a un côté deux fois plus petit que le précédent : triangle(cote), puis cote /= 2." } }
        ]
      },
      {
        id: "ex10",
        titre: "Exercice 10",
        note: true,
        figure: true,
        enonce:
          "<p>Reprenez votre commande <code>triangle(cote)</code> de l'exercice 9, et écrivez une commande " +
          "<code>spirale_triangles(cote, nombre)</code> qui dessine <code>nombre</code> triangles en appelant <code>triangle()</code> :</p>" +
          "<ul><li>le premier triangle a un côté de <code>cote</code> ;</li>" +
          "<li>après chaque triangle, la tortue tourne de <strong>20°</strong> à gauche ;</li>" +
          "<li>chaque triangle a un côté <strong>plus grand de 5</strong> que le précédent.</li></ul>" +
          "<p>La figure ci-contre est dessinée avec <code>spirale_triangles(20, 18)</code>.</p>" + RAPPEL_OPERATEURS,
        code: "from turtle import *\n\n# Recopiez ici votre commande triangle(cote)\n\n\n# puis la commande spirale_triangles(cote, nombre)\n\n\n\ndone()\n",
        solutions: [
          "from turtle import *\n\ndef triangle(cote):\n    for i in range(3):\n        forward(cote)\n        left(120)\n\n" +
          "def spirale_triangles(cote, nombre):\n    for i in range(nombre):\n        triangle(cote)\n        left(20)\n        cote += 5\n\n" +
          "spirale_triangles(20, 18)\n"
        ],
        checks: [
          { id: "def-triangle", kind: "params", name: "triangle", count: 1,
            label: "La commande triangle(cote) est définie avec un paramètre",
            example: "def triangle(cote):" },
          { id: "def-spirale", kind: "params", name: "spirale_triangles", count: 2,
            label: "La commande spirale_triangles(cote, nombre) est définie avec deux paramètres",
            example: "def spirale_triangles(cote, nombre):" },
          { id: "triangle", kind: "shape", target: "triangle", args: [60], opts: OPTS,
            label: "triangle(60) dessine un triangle équilatéral de côté 60",
            hint: { size: "Utilisez le paramètre cote dans forward(…).",
                    shape: "Un triangle équilatéral : 3 côtés, et la tortue tourne de 120° à chaque coin." } },
          { id: "appel-triangle", kind: "calls", caller: "spirale_triangles", callee: "triangle",
            label: "spirale_triangles() appelle triangle()",
            fail: "Dans spirale_triangles(), dessinez chaque triangle avec triangle(cote), au lieu de répéter les forward(…)." },
          { id: "spirale", kind: "shape", target: "spirale_triangles", args: [30, 6], opts: OPTS,
            label: "spirale_triangles(30, 6) marche aussi avec d'autres valeurs (triangle() reçoit le bon côté)",
            hint: { size: "Le premier triangle a le côté donné par le paramètre cote, puis chaque triangle est plus grand de 5 : " +
                          "triangle(cote), puis cote += 5.",
                    count: "Le nombre de triangles est donné par le paramètre nombre : for i in range(nombre):",
                    shape: "Après chaque triangle, la tortue tourne de 20° à gauche ; le triangle suivant a un côté plus grand de 5." } },
          { id: "appel", kind: "calls", caller: "<main>", callee: "spirale_triangles",
            label: "Le programme utilise spirale_triangles()",
            fail: "Ajoutez spirale_triangles(20, 18) après les définitions." },
          { id: "dessin", kind: "shape", target: "<program>", opts: OPTS,
            label: "Le programme dessine la spirale de la figure" }
        ]
      },
      {
        id: "ex11",
        titre: "Exercice 11",
        note: true,
        figure: true,
        enonce:
          "<p>Trois triangles équilatéraux qui partent du même point, avec un tiers de tour (120°) entre chacun, " +
          "dessinent le <strong>signe nucléaire</strong>.</p>" +
          "<ul><li>Reprenez votre commande <code>triangle(cote)</code> des exercices 9 et 10 ;</li>" +
          "<li>écrivez une commande <code>signe(cote)</code> qui dessine le signe en appelant 3 fois <code>triangle()</code>, " +
          "avec un <code>left(120)</code> après chaque triangle ;</li>" +
          "<li>écrivez enfin une commande <code>spirale(cote, nombre)</code> qui fait <strong>tourner</strong> le signe en appelant " +
          "<code>signe()</code> : <code>nombre</code> signes, le premier de côté <code>cote</code> ; après chaque signe, " +
          "la tortue tourne de <strong>8°</strong> à gauche et le côté augmente de <strong>15</strong>.</li></ul>" +
          "<p>La spirale ci-contre est dessinée avec <code>spirale(30, 6)</code>.</p>" + RAPPEL_OPERATEURS,
        code: "from turtle import *\n\n# Recopiez ici votre commande triangle(cote)\n\n\n# puis la commande signe(cote)\n\n\n# puis la commande spirale(cote, nombre)\n\n\n\ndone()\n",
        solutions: [
          "from turtle import *\n\ndef triangle(cote):\n    for i in range(3):\n        forward(cote)\n        left(120)\n\n" +
          "def signe(cote):\n    for i in range(3):\n        triangle(cote)\n        left(120)\n\n" +
          "def spirale(cote, nombre):\n    for i in range(nombre):\n        signe(cote)\n        left(8)\n        cote += 15\n\n" +
          "spirale(30, 6)\n"
        ],
        checks: [
          { id: "def-triangle", kind: "params", name: "triangle", count: 1,
            label: "La commande triangle(cote) est définie avec un paramètre",
            example: "def triangle(cote):" },
          { id: "def-signe", kind: "params", name: "signe", count: 1,
            label: "La commande signe(cote) est définie avec un paramètre",
            example: "def signe(cote):" },
          { id: "triangle", kind: "shape", target: "triangle", args: [70], opts: OPTS,
            label: "triangle(70) dessine un triangle équilatéral de côté 70",
            hint: { size: "Utilisez le paramètre cote dans forward(…).",
                    shape: "Un triangle équilatéral : 3 côtés, et la tortue tourne de 120° à chaque coin." } },
          { id: "appel-triangle", kind: "calls", caller: "signe", callee: "triangle",
            label: "signe() appelle triangle()",
            fail: "Dans signe(), dessinez chaque triangle avec triangle(cote), au lieu de répéter les forward(…)." },
          { id: "signe", kind: "shape", target: "signe", args: [60], opts: OPTS,
            label: "signe(60) dessine le signe avec trois triangles de côté 60 (triangle() reçoit le bon côté)",
            hint: { size: HINT_SIGNE, shape: HINT_SIGNE, count: HINT_SIGNE } },
          { id: "def-spirale", kind: "params", name: "spirale", count: 2,
            label: "La commande spirale(cote, nombre) est définie avec deux paramètres",
            example: "def spirale(cote, nombre):" },
          { id: "appel-signe", kind: "calls", caller: "spirale", callee: "signe",
            label: "spirale() appelle signe()",
            fail: "Dans spirale(), dessinez chaque signe avec signe(cote)." },
          { id: "spirale", kind: "shape", target: "spirale", args: [20, 4], opts: OPTS,
            label: "spirale(20, 4) marche aussi avec d'autres valeurs (signe() reçoit le bon côté)",
            hint: { size: HINT_SPIRALE, shape: HINT_SPIRALE, count: HINT_SPIRALE } },
          { id: "appel", kind: "calls", caller: "<main>", callee: "spirale",
            label: "Le programme utilise spirale()",
            fail: "Ajoutez spirale(30, 6) après les définitions." },
          { id: "dessin", kind: "shape", target: "<program>", opts: OPTS,
            label: "Le programme dessine la spirale de la figure",
            hint: { size: HINT_SPIRALE, shape: HINT_SPIRALE, count: HINT_SPIRALE } }
        ]
      }
    ]
  };
})(typeof window !== "undefined" ? window : globalThis);
