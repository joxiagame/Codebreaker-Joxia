# Codebreaker — Joxia

Jeu de réflexion et de décodage inspiré du Mastermind, intégré à l'écosystème **JOXIA Gaming Hub** (`joxiagame`).

## Stack
- HTML5 / Vanilla JS / CSS3 (aucune dépendance, aucun build)
- Design néon « terminal » responsive (Orbitron, Rajdhani, Space Mono)
- Web Audio API (sons synthétiques + bouton muet)
- LocalStorage (meilleur score par configuration + préférence son)

## Règles
- Découvre une séquence secrète de 3 à 6 couleurs (répétitions possibles).
- Choisis parmi 4 à 9 couleurs différentes.
- Après chaque essai :
  - points **verts** = bonne couleur, bien placée
  - points **jaunes** = bonne couleur, mal placée
- Gagne avant d'épuiser tes essais.

## Niveaux
- **Facile** : 4 cases · 6 couleurs · 10 essais
- **Moyen** : 5 cases · 7 couleurs · 9 essais
- **Expert** : 6 cases · 9 couleurs · 8 essais

## Contrôles
- Souris / tactile : tapote une couleur puis VALIDER (`⌫` pour corriger).
- Clavier : `1`–`9` choisir · `⌫` effacer · `Entrée` valider.

## Intégration hub
Le hub `Joxia-Games` ouvre `https://joxiagame.github.io/Codebreaker-Joxia/?player=<pseudo>` ; le pseudo est affiché en jeu.

## Déploiement
Public via GitHub Pages sur le dépôt `Codebreaker-Joxia`.
