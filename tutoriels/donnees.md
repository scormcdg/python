---
title: Python pour les données – les fonctions des exemples
---

# Python pour les données

Ce tutoriel explique les fonctions utilisées par les boutons **« Exemple »** et **« Exemple stats »** du bac à sable *Python – données*. Chaque exemple peut être copié dans le bac à sable et exécuté : les fichiers `cantons.csv` et `mesures.csv` y sont déjà.

On utilise deux bibliothèques :

- **pandas** (`pd`) pour lire et calculer sur des tableaux ;
- **matplotlib** (`plt`) pour les graphiques.

## Sommaire

1. [Lire un fichier CSV](#lire)
2. [Regarder le tableau](#regarder)
3. [Choisir des colonnes et des lignes](#choisir)
4. [Statistiques d'une colonne](#statistiques)
5. [Calculer par groupe](#groupes)
6. [Graphiques](#graphiques)
7. [Corrélation](#correlation)
8. [Droite de régression](#regression)
9. [Valeurs manquantes](#manquantes)
10. [Poser une question avec input()](#input)
11. [Aide-mémoire](#aide-memoire)

<a id="lire"></a>

## 1. Lire un fichier CSV

Un fichier CSV est un tableau écrit en texte : une ligne par ligne du tableau, les valeurs séparées par des virgules. La première ligne donne le nom des colonnes.

```
code,nom,chef_lieu,langues,superficie_km2,population,entree_confederation
AG,Argovie,Aarau,allemand,1404,715000,1803
AI,Appenzell Rhodes-Intérieures,Appenzell,allemand,173,16500,1513
```

`pd.read_csv()` lit le fichier et donne un **DataFrame**, un tableau qu'on appelle d'habitude `df`.

```python
import pandas as pd

df = pd.read_csv("cantons.csv")
print(df.head(3))
```

Dans la console :

```text
  code                           nom  chef_lieu   langues  superficie_km2  population  entree_confederation
0   AG                       Argovie      Aarau  allemand            1404      715000                  1803
1   AI  Appenzell Rhodes-Intérieures  Appenzell  allemand             173       16500                  1513
2   AR  Appenzell Rhodes-Extérieures    Herisau  allemand             243       56000                  1513
```

Un fichier enregistré depuis Excel utilise souvent le point-virgule et la virgule décimale (`3,5`). On le précise :

```python
df = pd.read_csv("fichier.csv", sep=";", decimal=",")
```

Le bouton **« Insérer la lecture »** écrit cette ligne pour le fichier choisi, avec les bonnes options.

<a id="regarder"></a>

## 2. Regarder le tableau

| Instruction | Donne |
|---|---|
| `df.head()` | les 5 premières lignes (`df.head(10)` : les 10 premières) |
| `df.tail()` | les 5 dernières lignes |
| `df.columns` | le nom des colonnes |
| `df.shape` | (nombre de lignes, nombre de colonnes) |
| `len(df)` | le nombre de lignes |
| `df.describe()` | un résumé de chaque colonne de nombres |

```python
import pandas as pd

df = pd.read_csv("mesures.csv")
print(df.shape)
print(df.describe())
```

Dans la console :

```text
(30, 6)
       taille_cm  envergure_cm  pointure  heures_sommeil
count         30            30        30              30
mean    165.5333      166.1333     40.15          7.9667
std       8.2827         9.081    2.0643          0.7535
min          152           144        36             6.5
25%        158.5        160.25        39             7.5
50%        165.5           165        40               8
75%       171.75           173    41.375             8.5
max          180           182        45             9.5
```

`describe()` donne pour chaque colonne de nombres : le nombre de valeurs (`count`), la moyenne (`mean`), l'écart-type (`std`), le minimum, les quartiles (`25%`, `50%` = médiane, `75%`) et le maximum.

<a id="choisir"></a>

## 3. Choisir des colonnes et des lignes

**Une colonne** s'écrit avec son nom entre crochets et guillemets. Le résultat est une **série** (une seule colonne) :

```python
df["population"]
```

**Plusieurs colonnes** : une liste de noms, donc deux paires de crochets :

```python
df[["nom", "population"]]
```

**Les lignes qui vérifient une condition** :

```python
import pandas as pd

df = pd.read_csv("cantons.csv")
grands = df[df["population"] > 1000000]
print(grands[["nom", "population"]])
```

Dans la console :

```text
       nom  population
3    Berne     1060000
25  Zurich     1600000
```

Les comparaisons possibles : `==`, `!=`, `<`, `<=`, `>`, `>=`. Pour un texte : `df[df["langues"] == "français"]`.

**Trier** avec `sort_values()` ; `ascending=False` trie du plus grand au plus petit :

```python
import pandas as pd

df = pd.read_csv("cantons.csv")
tri = df.sort_values("population", ascending=False)
print(tri[["nom", "population"]].head(3))
```

Dans la console :

```text
       nom  population
25  Zurich     1600000
3    Berne     1060000
22    Vaud      830000
```

<a id="statistiques"></a>

## 4. Statistiques d'une colonne

Ces fonctions s'appliquent à une colonne : `y = df["taille_cm"]`, puis `y.mean()`, etc.

| Fonction | Calcule |
|---|---|
| `y.count()` | le nombre de valeurs (sans les cases vides) |
| `y.sum()` | la somme |
| `y.mean()` | la moyenne |
| `y.median()` | la médiane |
| `y.min()`, `y.max()` | le minimum, le maximum |
| `y.max() - y.min()` | l'étendue |
| `y.quantile(0.25)`, `y.quantile(0.75)` | le premier et le troisième quartile |
| `y.std(ddof=0)` | l'écart-type, en divisant par n |
| `y.std()` | l'écart-type, en divisant par n − 1 |

```python
import pandas as pd

df = pd.read_csv("mesures.csv")
y = df["taille_cm"]
print("moyenne :", round(y.mean(), 2))
print("médiane :", y.median())
print("étendue :", y.max() - y.min())
print("Q1 =", y.quantile(0.25), "  Q3 =", y.quantile(0.75))
print("écart-type :", round(y.std(ddof=0), 2))
```

Dans la console :

```text
moyenne : 165.53
médiane : 165.5
étendue : 28
Q1 = 158.5   Q3 = 171.75
écart-type : 8.14
```

`round(nombre, 2)` arrondit à 2 chiffres après la virgule.

> **Quartiles.** `quantile()` calcule les quartiles par interpolation (il peut tomber entre deux valeurs). Le résultat peut différer un peu de la méthode du cours, qui prend toujours une valeur du tableau.

> **Écart-type.** En cours, on divise en général par n : c'est `std(ddof=0)`. Sans rien, `std()` divise par n − 1 (l'écart-type « d'échantillon »). Avec 30 valeurs, la différence est petite.

<a id="groupes"></a>

## 5. Calculer par groupe

`groupby()` regroupe les lignes qui ont la même valeur dans une colonne, puis calcule sur chaque groupe :

```python
import pandas as pd

df = pd.read_csv("mesures.csv")
moyennes = df.groupby("classe")["taille_cm"].mean()
print(moyennes)
```

Dans la console :

```text
classe
1A   164.9333
1B   166.1333
Name: taille_cm, dtype: float64
```

On lit : « grouper par classe, prendre la colonne taille_cm, faire la moyenne ». On peut remplacer `mean()` par `sum()`, `median()`, `count()`, `max()`…

Le résultat a deux parties, utiles pour un graphique : `moyennes.index` (les groupes : 1A, 1B) et `moyennes.values` (les moyennes).

<a id="graphiques"></a>

## 6. Graphiques

Un graphique se construit en plusieurs lignes, puis **`plt.show()`** l'affiche dans le cadre « Graphiques ». Chaque `plt.show()` ajoute un nouveau graphique ; les flèches ◀ ▶ passent de l'un à l'autre.

| Fonction | Dessine |
|---|---|
| `plt.bar(x, hauteurs)` | des barres |
| `plt.hist(valeurs, bins=10)` | un histogramme (la répartition des valeurs en 10 classes) |
| `plt.boxplot(valeurs)` | une boîte à moustaches |
| `plt.scatter(x, y)` | un nuage de points |
| `plt.plot(x, y)` | des points reliés par des segments (une courbe, une droite) |
| `plt.pie(valeurs, labels=noms)` | un camembert |

Et pour habiller le graphique :

| Fonction | Rôle |
|---|---|
| `plt.title("…")` | le titre |
| `plt.xlabel("…")`, `plt.ylabel("…")` | le nom des axes |
| `plt.xticks(rotation=60)` | penche les étiquettes de l'axe x (quand elles se chevauchent) |
| `plt.legend()` | la légende (les textes donnés avec `label=`) |
| `plt.annotate("texte", (x, y))` | écrit un texte à côté du point (x, y) |

### Barres

```python
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv("cantons.csv")
plt.bar(df["code"], df["population"])
plt.title("Population des cantons")
plt.xlabel("canton")
plt.ylabel("habitants")
plt.xticks(rotation=60)
plt.show()
```

### Histogramme

```python
df = pd.read_csv("mesures.csv")
plt.hist(df["taille_cm"], bins=10)
plt.title("Répartition des tailles")
plt.xlabel("taille (cm)")
plt.ylabel("nombre d'élèves")
plt.show()
```

### Boîte à moustaches

La boîte va du premier au troisième quartile, et le trait dans la boîte est la médiane. Les « moustaches » vont jusqu'à la plus petite et la plus grande valeur. Une valeur très éloignée des autres (à plus d'une fois et demie la hauteur de la boîte) est dessinée à part, par un petit rond : la moustache s'arrête alors avant elle.

```python
plt.boxplot(df["taille_cm"])
plt.title("Boîte à moustaches des tailles")
plt.ylabel("taille (cm)")
plt.show()
```

### Nuage de points avec des noms

`zip()` parcourt plusieurs colonnes en même temps : à chaque tour, `nom`, `xi` et `yi` sont les valeurs d'une même ligne.

```python
df = pd.read_csv("cantons.csv")
x = df["superficie_km2"]
y = df["population"]
plt.scatter(x, y)
for nom, xi, yi in zip(df["code"], x, y):
    plt.annotate(nom, (xi, yi), fontsize=8)
plt.xlabel("superficie (km²)")
plt.ylabel("population")
plt.show()
```

<a id="correlation"></a>

## 7. Corrélation

Le **coefficient de corrélation** `r` mesure si deux colonnes varient ensemble **en ligne droite**. Il est toujours entre −1 et 1 :

| r | Lien |
|---|---|
| proche de 1 | fort, et les deux augmentent ensemble |
| proche de −1 | fort, et quand l'une augmente, l'autre diminue |
| proche de 0 | pas de lien linéaire |

On prend souvent : |r| ≥ 0,8 lien fort, entre 0,5 et 0,8 lien moyen, en dessous lien faible.

```python
import pandas as pd

df = pd.read_csv("mesures.csv")
x = df["taille_cm"]
y = df["envergure_cm"]
print("r =", round(x.corr(y), 3))
print("taille et sommeil : r =", round(x.corr(df["heures_sommeil"]), 3))
```

Dans la console :

```text
r = 0.937
taille et sommeil : r = -0.08
```

`df.corr(numeric_only=True)` calcule toutes les corrélations entre les colonnes de nombres d'un coup (`numeric_only=True` laisse de côté les colonnes de texte) :

```python
import pandas as pd

df = pd.read_csv("mesures.csv")
print(df.corr(numeric_only=True).round(2))
```

Dans la console :

```text
                taille_cm  envergure_cm  pointure  heures_sommeil
taille_cm               1          0.94      0.87           -0.08
envergure_cm         0.94             1      0.81           -0.04
pointure             0.87          0.81         1           -0.13
heures_sommeil      -0.08         -0.04     -0.13               1
```

La diagonale vaut toujours 1 : une colonne est parfaitement liée à elle-même.

> Une corrélation forte ne veut pas dire que l'une **cause** l'autre : les deux peuvent dépendre d'une troisième chose (ici, la croissance).

<a id="regression"></a>

## 8. Droite de régression

La **droite de régression** `y = a·x + b` est la droite qui passe au plus près des points (méthode des moindres carrés). On la calcule avec deux formules :

- la pente : `a = covariance(x, y) / variance(x)` ;
- la droite passe par le **point moyen** (moyenne de x, moyenne de y), donc `b = moyenne(y) − a · moyenne(x)`.

| Fonction | Calcule |
|---|---|
| `x.cov(y)` | la covariance de x et y |
| `x.var()` | la variance de x |

`cov()` et `var()` divisent toutes les deux par n − 1 : dans le quotient, cela se simplifie, et `a` est juste.

```python
import pandas as pd

df = pd.read_csv("mesures.csv")
x = df["taille_cm"]
y = df["envergure_cm"]

a = x.cov(y) / x.var()
b = y.mean() - a * x.mean()
print(f"y = {a:.3f}·x {b:+.3f}")

r = x.corr(y)
print("r² =", round(r ** 2, 3))

x0 = 170
print(f"Pour une taille de {x0} cm, la droite prévoit une envergure de {a * x0 + b:.1f} cm")
```

Dans la console :

```text
y = 1.028·x -4.010
r² = 0.879
Pour une taille de 170 cm, la droite prévoit une envergure de 170.7 cm
```

**Les f-strings.** Dans `f"…"`, ce qui est entre accolades est remplacé par sa valeur :

| Écriture | Résultat pour 1.02785 | Résultat pour −4.0096 |
|---|---|---|
| `{a}` | `1.02785` (tous les chiffres) | `-4.0096` |
| `{a:.3f}` | `1.028` (3 chiffres après la virgule) | `-4.010` |
| `{a:+.3f}` | `+1.028` (toujours avec son signe) | `-4.010` |

**r²** (le carré de r) dit quelle part des variations de y la droite explique : 0,879 veut dire environ 88 %.

**Prévoir** : on remplace x par une valeur dans l'équation. La prévision est fiable près des données ; loin d'elles (une taille de 250 cm…), elle ne veut plus rien dire.

**Tracer la droite** : une droite se trace avec ses deux extrémités, de la plus petite à la plus grande valeur de x :

```python
import matplotlib.pyplot as plt

plt.scatter(x, y, label="données")
x1, x2 = x.min(), x.max()
plt.plot([x1, x2], [a * x1 + b, a * x2 + b], color="red", label=f"y = {a:.2f}x {b:+.2f}")
plt.xlabel("taille (cm)")
plt.ylabel("envergure (cm)")
plt.title(f"Envergure selon la taille (r = {r:.2f})")
plt.legend()
plt.show()
```

`plt.plot([x1, x2], [y1, y2])` relie le point (x1, y1) au point (x2, y2). `color="red"` choisit la couleur, `label=` le texte de la légende.

<a id="manquantes"></a>

## 9. Valeurs manquantes

Une case vide dans le CSV devient `NaN` (« pas un nombre »). `mean()`, `median()`, `corr()`… l'ignorent tout seuls. Pour enlever les lignes incomplètes (ici, pour un fichier qui aurait des colonnes `altitude` et `temperature`) :

```python
df = df.dropna(subset=["altitude", "temperature"])
```

Cela garde seulement les lignes où `altitude` **et** `temperature` sont remplies. Sans `subset`, `df.dropna()` enlève toute ligne qui a au moins une case vide.

<a id="input"></a>

## 10. Poser une question avec input()

`input()` pose une question dans la console : on tape la réponse, puis Entrée. La réponse est toujours du **texte** : pour un nombre, on l'entoure de `int()` (nombre entier) ou `float()` (nombre à virgule).

```python
import pandas as pd

df = pd.read_csv("cantons.csv")
code = input("Code du canton ? ")
canton = df[df["code"] == code]
print(canton[["nom", "population"]])

seuil = int(input("Population minimale ? "))
print(df[df["population"] >= seuil]["nom"])
```

`input()` demande un navigateur récent : Chrome ou Edge 137, Firefox 153, Safari 27, ou plus récent.

<a id="aide-memoire"></a>

## 11. Aide-mémoire

```python
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv("mesures.csv")         # lire
df.head()  df.columns  df.describe()    # regarder
df["taille_cm"]                         # une colonne
df[df["classe"] == "1A"]                # les lignes qui vérifient une condition
df.sort_values("taille_cm", ascending=False)
df.groupby("classe")["taille_cm"].mean()

x = df["taille_cm"]
x.mean()  x.median()  x.min()  x.max()  x.quantile(0.25)  x.std(ddof=0)

y = df["envergure_cm"]
r = x.corr(y)                           # corrélation
a = x.cov(y) / x.var()                  # pente de la droite de régression
b = y.mean() - a * x.mean()             # ordonnée à l'origine

plt.bar(...)  plt.hist(...)  plt.boxplot(...)  plt.scatter(...)  plt.plot(...)
plt.title("…")  plt.xlabel("…")  plt.ylabel("…")  plt.legend()
plt.show()
```
