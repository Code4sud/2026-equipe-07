# Équipe 07 — Hackathon Azuréen #3

Projet réalisé à Nice les 18, 19 et 20 novembre 2026, sur le thème **« L'orientation et l'employabilité grâce à l'IA »**, organisé par [Code4Sud](https://code4sud.fr).

## Le projet

__Sujet__: L'assistant d'exploration des métiers

_Deux ou trois phrases : le problème, la solution, pour qui._

## Lancer le projet

L'application (SvelteKit + Node.js) est dans le sous-dossier `orientation-assistant/` : toutes les commandes se lancent depuis ce dossier. Prérequis : Node.js 22.13 ou plus, et [Ollama](https://ollama.com) lancé en local.

```bash
cd orientation-assistant
npm install
npm run dev
```

Pourquoi un sous-dossier : le workflow GitHub Pages du dépôt lance `npm run build` s'il trouve un `package.json` à la racine et publie `dist/`. Notre application est un serveur Node (adapter-node, sortie `build/`), qui ne peut pas tourner sur GitHub Pages. La racine garde donc `index.html`, `projet.json` et `captures/` pour la fiche du hackathon.

Les Rapports des Possibles ne sont pas dans le dépôt (`orientation-assistant/data/rapports/` est ignoré par git) : les copier à la main pour les tests (`npm run test:pdf`).

## Publier sur le site du hackathon

1. Complétez `projet.json` (nom, pitch, description, écoles, technologies, liens).
2. Ajoutez vos captures dans `captures/` et listez-les dans `projet.json`.
3. Poussez sur `main` : votre fiche apparaît sur https://orientation.code4sud.fr/projets/equipe-07 en moins d'une minute.

Toute la doc : https://orientation.code4sud.fr/doc/

## Démo en ligne

Si votre projet est un site sans serveur, il est publié automatiquement sur GitHub Pages à chaque push :
`https://code4sud.github.io/2026-equipe-07/`. Reportez cette adresse dans le champ `demo` de `projet.json`.

## Licence

MIT — voir `LICENSE`.
