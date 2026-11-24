/*
 * Robi l'explorateur : 13 niveaux pour apprendre les bases de Python.
 * Chaque niveau : un objectif, une contrainte (nombre de lignes maximum) et un terrain.
 * Les terrains « aleatoire: true » changent à chaque essai : « Vérifier » teste le programme
 * sur plusieurs terrains tirés au hasard, pour qu'un programme écrit « par cœur » ne passe pas.
 *
 * Terrain : sol = hauteurs des colonnes, objets = { x: "coffre" },
 *           caisses = { x: nombre }, panneaux = { x: nombre ou mot }, depart, dir (1 = vers la droite).
 */
window.SERIE = {
  id: "robi-explorateur-v1",
  titre: "Robi l'explorateur",

  guide:
    "<p>Robi est un petit robot explorateur. À chaque niveau, il doit <strong>ouvrir le coffre</strong> : " +
    "il va d'abord sur la case du coffre (avec <code>avancer()</code>), puis il l'ouvre avec <code>ouvrir()</code>.</p>" +
    "<p>Vous ne le dirigez pas avec la souris : vous écrivez un <strong>programme en Python</strong>, " +
    "une liste d'instructions que Robi exécute dans l'ordre, de haut en bas.</p>" +
    "<h3>Comment jouer</h3>" +
    "<ol>" +
    "<li>Lisez l'<strong>objectif</strong> et la <strong>contrainte</strong> du niveau, et la liste des commandes disponibles.</li>" +
    "<li>Écrivez votre programme dans l'éditeur, puis cliquez sur <strong>Exécuter</strong> (ou Ctrl+Entrée) pour voir Robi bouger.</li>" +
    "<li>Si Robi se trompe, un message en français dans la console explique ce qui s'est passé et à quelle ligne.</li>" +
    "<li>Quand Robi ouvre le coffre, cliquez sur <strong>Vérifier</strong> pour valider le niveau.</li>" +
    "</ol>" +
    "<h3>Bon à savoir</h3>" +
    "<p>Chaque commande s'écrit avec des parenthèses : <code>avancer()</code>, pas <code>avancer</code>. Une commande par ligne.</p>" +
    "<p>Robi <strong>descend</strong> une marche en avançant, mais pour <strong>monter</strong> il doit sauter. " +
    "Les caisses bloquent le passage : il faut les casser.</p>" +
    "<p>Certains terrains changent à chaque essai (bouton <strong>Autre terrain</strong>) : votre programme doit marcher sur tous. " +
    "La <strong>contrainte</strong> limite le nombre de lignes : il faudra trouver des façons plus courtes d'écrire vos programmes. " +
    "Le <strong>Mémo de programmation</strong> explique tout ce dont vous aurez besoin.</p>" +
    "<p>Le curseur <strong>Vitesse</strong> règle l'animation, et le bouton en haut à droite de la scène l'agrandit. " +
    "Votre code et vos niveaux réussis sont enregistrés automatiquement.</p>",

  memo:
    "<h3>1. Les instructions</h3>" +
    "<p>Un programme est une suite d'instructions exécutées dans l'ordre, une par ligne :</p>" +
    "<pre>avancer()\nsauter()\nouvrir()</pre>" +
    "<p>Certaines commandes prennent une valeur entre les parenthèses : <code>sauter(3)</code> fait sauter Robi sur une marche de 3.</p>" +
    "<p>Une ligne qui commence par <code>#</code> est un <strong>commentaire</strong> : Python l'ignore.</p>" +

    "<h3>2. Répéter : la boucle for</h3>" +
    "<p>Pour répéter des instructions un certain nombre de fois :</p>" +
    "<pre>for i in range(5):\n    avancer()\n    avancer()\nouvrir()</pre>" +
    "<p>Les lignes <strong>décalées de 4 espaces</strong> (touche Tab) sous le <code>for</code> sont répétées, ici 5 fois. " +
    "N'oubliez pas les <strong>deux-points</strong> à la fin de la ligne du <code>for</code>. " +
    "La ligne <code>ouvrir()</code> n'est pas décalée : elle s'exécute une seule fois, après la boucle.</p>" +

    "<h3>3. Les variables</h3>" +
    "<p>Une variable est un nom qui garde une valeur en mémoire. On la crée avec <code>=</code> :</p>" +
    "<pre>n = 4\nn = n + 1      # n vaut maintenant 5\nn += 1         # pareil, en plus court : n vaut 6\nfor i in range(n):\n    avancer()</pre>" +
    "<p>Une commande peut <strong>donner une valeur</strong> qu'on range dans une variable : <code>n = lire_nombre()</code> met dans " +
    "<code>n</code> le nombre écrit sur le panneau. <code>n</code> le garde jusqu'à la fin du programme, même quand Robi s'est éloigné du panneau.</p>" +
    "<p>Pour compter, on part de 0 (<code>compteur = 0</code>) et on ajoute 1 à chaque fois (<code>compteur += 1</code>).</p>" +
    "<p>On peut calculer avec : <code>+</code>, <code>-</code>, <code>*</code> (fois), <code>/</code> (divisé), <code>//</code> (division entière).</p>" +

    "<h3>4. Le compteur de la boucle</h3>" +
    "<p>Dans <code>for i in range(...)</code>, la variable <code>i</code> change à chaque tour :</p>" +
    "<table><tr><th>Écriture</th><th>Valeurs de i</th></tr>" +
    "<tr><td><code>range(4)</code></td><td>0, 1, 2, 3</td></tr>" +
    "<tr><td><code>range(1, 5)</code></td><td>1, 2, 3, 4 (le 5 n'est pas compris)</td></tr>" +
    "<tr><td><code>range(2, 9, 2)</code></td><td>2, 4, 6, 8 (de 2 en 2)</td></tr></table>" +
    "<pre>for i in range(1, 4):\n    print(i)       # affiche 1, puis 2, puis 3</pre>" +
    "<p>On peut utiliser <code>i</code> dans un calcul : <code>sauter(i)</code>, <code>sauter(2 * i)</code>…</p>" +

    "<h3>5. Les conditions : if, elif, else</h3>" +
    "<p>Pour faire quelque chose seulement si une condition est vraie :</p>" +
    "<pre>mot = lire_mot()\nif mot == \"sauter\":\n    sauter()\nelif mot == \"frapper\":\n    frapper()\nelse:\n    avancer()</pre>" +
    "<p><code>elif</code> (« sinon si ») teste une autre condition, <code>else</code> (« sinon ») s'applique quand aucune condition n'est vraie. " +
    "Attention : <code>==</code> (deux signes égal) <strong>compare</strong>, alors que <code>=</code> range une valeur dans une variable. " +
    "Un mot s'écrit entre guillemets : <code>\"sauter\"</code>.</p>" +
    "<table><tr><th>Comparaison</th><th>Signification</th></tr>" +
    "<tr><td><code>a == b</code></td><td>a est égal à b</td></tr>" +
    "<tr><td><code>a != b</code></td><td>a est différent de b</td></tr>" +
    "<tr><td><code>a &lt; b</code>, <code>a &gt; b</code></td><td>plus petit, plus grand</td></tr>" +
    "<tr><td><code>a &lt;= b</code>, <code>a &gt;= b</code></td><td>plus petit ou égal, plus grand ou égal</td></tr></table>" +
    "<p>Une commande peut donner <code>True</code> (vrai) ou <code>False</code> (faux) : on l'écrit directement après <code>if</code> :</p>" +
    "<pre>if obstacle_devant():\n    frapper()</pre>" +
    "<p><code>not</code> inverse une condition : <code>if not obstacle_devant():</code></p>" +

    "<h3>6. Répéter tant que : la boucle while</h3>" +
    "<p>Quand on ne sait pas à l'avance combien de fois il faut répéter :</p>" +
    "<pre>while obstacle_devant():\n    frapper()</pre>" +
    "<p>Robi frappe <strong>tant que</strong> la condition est vraie, puis le programme passe à la suite. " +
    "Si la condition ne devient jamais fausse, la boucle ne s'arrête jamais : Robi s'arrête de lui-même après 300 actions.</p>" +

    "<h3>7. Afficher des valeurs : print</h3>" +
    "<p>Pour comprendre ce que fait votre programme, affichez une variable dans la console :</p>" +
    "<pre>n = lire_nombre()\nprint(\"le panneau indique\", n)</pre>",

  niveaux: [
    {
      id: "n1",
      titre: "Premiers pas",
      objectif:
        "<p>Robi doit monter sur la marche, casser la caisse qui bloque le chemin et ouvrir le coffre.</p>" +
        "<p>Pour ouvrir le coffre, Robi doit d'abord <strong>aller sur la case du coffre</strong> (avec <code>avancer()</code>), puis écrire <code>ouvrir()</code>.</p>" +
        "<p>Écrivez une commande par ligne, dans l'ordre où Robi doit les faire.</p>",
      maxLignes: 10,
      commandes: ["avancer", "sauter", "frapper", "ouvrir"],
      indice: "<p>Comptez les cases une par une sur le dessin. Pour monter sur la marche, il faut <code>sauter()</code> au lieu d'<code>avancer()</code>. " +
        "Après avoir cassé la caisse, Robi est toujours à la même place : il doit encore avancer.</p>",
      aleatoire: false,
      code: "# Écrivez une commande par ligne\navancer()\n",
      monde: function () {
        return { sol: [0, 0, 0, 1, 1, 1, 1], objets: { 6: "coffre" }, caisses: { 5: 1 }, panneaux: {}, depart: 0, dir: 1 };
      }
    },
    {
      id: "n2",
      titre: "Le long couloir",
      objectif:
        "<p>Le coffre est tout au bout d'un long couloir.</p>" +
        "<p>Écrire quinze fois la même ligne, c'est long… et la contrainte ne le permet pas.</p>",
      maxLignes: 4,
      commandes: ["avancer", "ouvrir"],
      indice: "<p>Regardez la partie « Répéter : la boucle for » du mémo. Combien de cases Robi doit-il parcourir ?</p>",
      aleatoire: false,
      code: "",
      monde: function () {
        var sol = []; for (var i = 0; i < 16; i++) sol.push(0);
        return { sol: sol, objets: { 15: "coffre" }, caisses: {}, panneaux: {}, depart: 0, dir: 1 };
      }
    },
    {
      id: "n3",
      titre: "Le grand escalier",
      objectif:
        "<p>Robi doit grimper tout l'escalier pour atteindre le coffre. Chaque marche est suivie d'un petit palier.</p>" +
        "<p>Cherchez ce qui se répète dans le trajet.</p>",
      maxLignes: 4,
      commandes: ["avancer", "sauter", "ouvrir"],
      indice: "<p>Une boucle peut répéter <strong>plusieurs</strong> instructions : toutes les lignes décalées sous le <code>for</code> sont répétées ensemble.</p>",
      aleatoire: false,
      code: "",
      monde: function () {
        return { sol: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5], objets: { 10: "coffre" }, caisses: {}, panneaux: {}, depart: 0, dir: 1 };
      }
    },
    {
      id: "n4",
      titre: "Le panneau",
      objectif:
        "<p>Robi est sur un panneau. Le nombre écrit dessus indique de combien de cases Robi doit avancer pour arriver sur le coffre.</p>" +
        "<p>Ce nombre change à chaque terrain (essayez « Autre terrain ») : votre programme doit fonctionner à tous les coups.</p>",
      maxLignes: 5,
      commandes: ["avancer", "ouvrir", "lire_nombre"],
      indice: "<p>Le panneau affiche « ? » tant que Robi ne l'a pas lu. Rangez ce que donne <code>lire_nombre()</code> dans une variable (mémo, partie 3), " +
        "puis utilisez cette variable dans votre boucle.</p>",
      aleatoire: true,
      variante: function (m) { return m.panneaux[0]; }, // Vérifier essaie des nombres différents
      code: "",
      monde: function (h) {
        var n = h.entier(3, 10);
        var sol = []; for (var i = 0; i < 12; i++) sol.push(0);
        var objets = {}; objets[n] = "coffre";
        return { sol: sol, objets: objets, caisses: {}, panneaux: { 0: n }, depart: 0, dir: 1 };
      }
    },
    {
      id: "n12",
      titre: "Le message du départ",
      objectif:
        "<p>Le panneau du départ indique la hauteur du grand mur qui se trouve tout au bout du chemin. Le coffre est en haut de ce mur.</p>" +
        "<p>Attention : une fois parti, Robi ne peut plus relire le panneau. La hauteur du mur change à chaque terrain.</p>",
      maxLignes: 5,
      commandes: ["avancer", "sauter", "ouvrir", "lire_nombre"],
      indice: "<p>Robi doit lire le panneau au départ et <strong>garder</strong> ce nombre en mémoire jusqu'au bout du chemin : " +
        "c'est le rôle d'une variable (mémo, partie 3).</p>",
      aleatoire: true,
      variante: function (m) { return m.panneaux[0]; },
      code: "",
      monde: function (h) {
        var haut = h.entier(2, 6), sol = [0, 0, 0, 0, 0, 0, 0, haut];
        var objets = {}; objets[7] = "coffre";
        return { sol: sol, objets: objets, caisses: {}, panneaux: { 0: haut }, depart: 0, dir: 1 };
      }
    },
    {
      id: "n9",
      titre: "Les murs en escalier",
      objectif:
        "<p>Cinq murs de plus en plus hauts : 1, puis 2, puis 3, puis 4, puis 5. Après chaque mur, Robi redescend au sol.</p>" +
        "<p>Le coffre est après le dernier mur.</p>",
      maxLignes: 4,
      commandes: ["avancer", "sauter", "ouvrir"],
      indice: "<p><code>sauter(n)</code> fait sauter Robi sur une marche de hauteur n. " +
        "Regardez la partie « Le compteur de la boucle » du mémo : quelles valeurs prend <code>i</code> avec <code>range(1, 6)</code> ?</p>",
      aleatoire: false,
      code: "",
      monde: function () {
        return { sol: [0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0], objets: { 10: "coffre" }, caisses: {}, panneaux: {}, depart: 0, dir: 1 };
      }
    },
    {
      id: "n5",
      titre: "Les marches qui grandissent",
      objectif:
        "<p>Chaque mur est plus haut que le précédent : 1, puis 2, puis 3… et après chaque mur Robi redescend au sol.</p>" +
        "<p>Le panneau de départ indique combien il y a de murs. Il y en a un nombre différent à chaque terrain.</p>",
      maxLignes: 5,
      commandes: ["avancer", "sauter", "ouvrir", "lire_nombre"],
      indice: "<p>C'est comme au niveau précédent, mais le nombre de murs est écrit sur le panneau. " +
        "Attention : <code>range(1, n)</code> s'arrête à n - 1.</p>",
      aleatoire: true,
      variante: function (m) { return m.panneaux[0]; }, // Vérifier essaie des nombres différents
      code: "",
      monde: function (h) {
        var n = h.entier(3, 6), sol = [0];
        for (var i = 1; i <= n; i++) { sol.push(i); sol.push(0); }
        var objets = {}; objets[2 * n] = "coffre";
        return { sol: sol, objets: objets, caisses: {}, panneaux: { 0: n }, depart: 0, dir: 1 };
      }
    },
    {
      id: "n10",
      titre: "Les caisses égarées",
      objectif:
        "<p>Des caisses traînent sur le chemin, mais pas sur toutes les cases. " +
        "Robi doit casser celles qu'il rencontre, et seulement celles-là.</p>" +
        "<p>Le coffre est sur la dernière case, à 12 cases du départ. Les caisses changent de place à chaque terrain.</p>",
      maxLignes: 5,
      commandes: ["avancer", "frapper", "ouvrir", "obstacle_devant"],
      indice: "<p><code>obstacle_devant()</code> donne <code>True</code> s'il y a une caisse devant Robi. " +
        "Regardez la partie « Les conditions » du mémo : un <code>if</code> sans <code>else</code> suffit.</p>",
      aleatoire: true,
      code: "",
      monde: function (h) {
        var sol = [], caisses = {}, nb = 0;
        for (var i = 0; i < 13; i++) sol.push(0);
        for (var x = 1; x <= 11; x++) if (h() < 0.4) { caisses[x] = 1; nb++; }
        if (nb < 2) { caisses[h.entier(1, 5)] = 1; caisses[h.entier(6, 11)] = 1; }
        var objets = {}; objets[12] = "coffre";
        return { sol: sol, objets: objets, caisses: caisses, panneaux: {}, depart: 0, dir: 1 };
      }
    },
    {
      id: "n13",
      titre: "Le compteur de caisses",
      objectif:
        "<p>Des caisses sont posées sur le chemin. Au bout, le mur est exactement aussi haut que le <strong>nombre de caisses</strong> " +
        "que Robi a cassées. Le coffre est en haut du mur.</p>" +
        "<p>Le nombre de caisses et leurs places changent à chaque terrain.</p>",
      maxLignes: 8,
      commandes: ["avancer", "frapper", "sauter", "ouvrir", "obstacle_devant"],
      indice: "<p>Utilisez une variable qui compte : elle vaut 0 au départ, et on lui ajoute 1 à chaque caisse cassée " +
        "avec <code>+=</code> (mémo, partie 3). À la fin, elle donne la hauteur du saut.</p>",
      aleatoire: true,
      variante: function (m) { return Object.keys(m.caisses).length; },
      code: "",
      monde: function (h) {
        var n = h.entier(1, 5), cases = [];
        for (var x = 1; x <= 10; x++) cases.push(x);
        var caisses = {};
        for (var k = 0; k < n; k++) { var i = h.entier(0, cases.length - 1); caisses[cases[i]] = 1; cases.splice(i, 1); }
        var sol = []; for (var y = 0; y < 11; y++) sol.push(0); sol.push(n);
        var objets = {}; objets[11] = "coffre";
        return { sol: sol, objets: objets, caisses: caisses, panneaux: {}, depart: 0, dir: 1 };
      }
    },
    {
      id: "n7",
      titre: "Le terrain inconnu",
      objectif:
        "<p>Pas de panneaux : Robi doit observer lui-même ce qu'il y a devant lui. " +
        "Il y a parfois une marche à monter, parfois un trou à descendre, parfois une caisse.</p>" +
        "<p>Le coffre est sur la dernière case, à 13 cases du départ. Le terrain change à chaque essai.</p>",
      maxLignes: 9,
      commandes: ["avancer", "sauter", "frapper", "ouvrir", "hauteur_devant", "obstacle_devant"],
      indice: "<p><code>hauteur_devant()</code> donne un nombre : plus grand que 0 s'il faut monter. " +
        "<code>obstacle_devant()</code> donne <code>True</code> ou <code>False</code>. " +
        "Une caisse se trouve toujours sur une case de même hauteur, et toutes les marches à monter font 1.</p>",
      aleatoire: true,
      code: "",
      monde: function (h) {
        var sol = [0], caisses = {};
        for (var i = 1; i <= 13; i++) {
          var t = h.choix(["plat", "monte", "monte", "descend", "caisse", "caisse"]);
          var y = sol[i - 1];
          if (t === "monte") y += 1;
          else if (t === "descend") y = Math.max(0, y - h.entier(1, 2));
          else if (t === "caisse" && i < 13) caisses[i] = 1;
          sol.push(y);
        }
        var objets = {}; objets[13] = "coffre";
        return { sol: sol, objets: objets, caisses: caisses, panneaux: {}, depart: 0, dir: 1 };
      }
    },
    {
      id: "n6",
      titre: "Les consignes",
      objectif:
        "<p>Sur chacune des dix premières cases, un panneau indique un mot : ce que Robi doit faire pour passer à la case suivante " +
        "(<code>\"avancer\"</code>, <code>\"sauter\"</code> ou <code>\"frapper\"</code> une caisse, puis avancer).</p>" +
        "<p>Ensuite, le coffre est juste après. Les mots changent à chaque terrain.</p>",
      maxLignes: 13,
      commandes: ["avancer", "sauter", "frapper", "ouvrir", "lire_mot"],
      indice: "<p>À chaque tour de boucle : lire le mot, puis choisir quoi faire selon ce mot (mémo, partie 5). " +
        "Pensez qu'après <code>frapper()</code> Robi doit encore avancer.</p>",
      aleatoire: true,
      code: "",
      monde: function (h) {
        var sol = [0], caisses = {}, panneaux = {};
        for (var i = 0; i < 10; i++) {
          var mot = h.choix(["avancer", "sauter", "frapper"]);
          panneaux[i] = mot;
          sol.push(sol[i] + (mot === "sauter" ? 1 : 0));
          if (mot === "frapper") caisses[i + 1] = 1;
        }
        sol.push(sol[10]);
        return { sol: sol, objets: { 11: "coffre" }, caisses: caisses, panneaux: panneaux, depart: 0, dir: 1 };
      }
    },
    {
      id: "n11",
      titre: "Le chemin sans fin",
      objectif:
        "<p>Le coffre est quelque part au bout du chemin, mais personne ne sait à combien de cases : " +
        "la longueur du chemin change à chaque terrain, et il n'y a pas de panneau.</p>" +
        "<p>Robi doit avancer jusqu'à ce qu'il soit sur le coffre.</p>",
      maxLignes: 3,
      commandes: ["avancer", "ouvrir", "sur_coffre"],
      indice: "<p>Une boucle <code>for</code> a besoin de savoir combien de tours faire. " +
        "Regardez la partie « Répéter tant que » du mémo, et l'utilisation de <code>not</code> dans « Les conditions ».</p>",
      aleatoire: true,
      variante: function (m) { return m.sol.length; }, // Vérifier essaie des longueurs différentes
      code: "",
      monde: function (h) {
        var n = h.entier(5, 15), sol = [];
        for (var i = 0; i <= n; i++) sol.push(0);
        var objets = {}; objets[n] = "coffre";
        return { sol: sol, objets: objets, caisses: {}, panneaux: {}, depart: 0, dir: 1 };
      }
    },
    {
      id: "n8",
      titre: "Les piles de caisses",
      objectif:
        "<p>Le chemin est encombré de piles de caisses, de hauteurs différentes. " +
        "Robi ne casse qu'une caisse à la fois.</p>" +
        "<p>Le coffre est sur la dernière case, à 11 cases du départ. Les piles changent à chaque essai.</p>",
      maxLignes: 5,
      commandes: ["avancer", "frapper", "ouvrir", "obstacle_devant"],
      indice: "<p>On ne sait pas combien de fois il faut frapper : regardez la partie « Répéter tant que » du mémo. " +
        "Une boucle peut se trouver à l'intérieur d'une autre boucle.</p>",
      aleatoire: true,
      code: "",
      monde: function (h) {
        var sol = [], caisses = {};
        for (var i = 0; i < 12; i++) sol.push(0);
        var nb = 0;
        for (var x = 1; x <= 10; x++) if (h() < 0.55) { caisses[x] = h.entier(1, 4); nb++; }
        if (!nb) caisses[h.entier(1, 10)] = h.entier(2, 4);
        return { sol: sol, objets: { 11: "coffre" }, caisses: caisses, panneaux: {}, depart: 0, dir: 1 };
      }
    }
  ]
};
