# Équipe 07 — Hackathon Azuréen #3

Projet réalisé à Nice les 18, 19 et 20 novembre 2026, sur le thème **« L'orientation et l'employabilité grâce à l'IA »**, organisé par [Code4Sud](https://code4sud.fr).

## Le projet

__Sujet__: L'assistant d'exploration des métiers

_Deux ou trois phrases : le problème, la solution, pour qui._

## Lancer le projet

Application SvelteKit + Node.js, à la racine du dépôt. Prérequis : Node.js 22.13 ou plus, et [Ollama](https://ollama.com) lancé en local.

```bash
npm install
cp .env.example .env
npm run dev
```

GitHub Pages : le workflow du dépôt lance `npm run build` puis publie `dist/`. Notre application est un serveur Node (adapter-node, sortie `build/`) qui ne peut pas tourner sur GitHub Pages : après le build, `scripts/pages.js` copie dans `dist/` la page statique du hackathon (`index.html`, `captures/`).

Les Rapports des Possibles ne sont pas dans le dépôt (`data/rapports/` est ignoré par git) : les copier à la main pour les tests (`npm run test:pdf`).

## Travailler sur le projet (équipe)

### Récupérer le projet

```bash
git checkout main
git pull
npm install
npm run test:knowledge   # doit afficher : pass 5 (fonctionne sans les PDF)
```

Pour travailler : créer sa branche à partir de `main` à jour (`git checkout -b prenom-tache`), puis ouvrir une pull request vers `main`.

### Ce qui est dans git, ce qui ne l'est pas

| Contenu | Dans git ? | Que faire |
|---|---|---|
| Code (`src/`, `scripts/`, `tests/`, `package.json`) | Oui | Rien : `git pull` suffit |
| Fiches ROME et ONISEP (`data/knowledge/rome.json`, `onisep.json`) | Oui | Rien : déjà générées, **ne pas relancer** `build-knowledge.js` |
| Correspondances métiers -> ROME (`data/knowledge/correspondances.json`) | Oui | Rien, sauf la personne qui les vérifie (voir plus bas) |
| `node_modules/` | Non | `npm install` (tout le monde) |
| Les 18 rapports PDF (`data/rapports/`) | Non (données réelles) | Les copier à la main si besoin (voir tableau suivant) |
| Open data brut (`data/open-data/`) | Non | Rien : utile seulement pour une nouvelle version de ROME |
| `.env` | Non (config locale) | Copier `.env.example` en `.env` sur le PC qui fait tourner Ollama |

### Qui a besoin des PDF ?

| Tâche | PDF dans `data/rapports/` ? |
|---|---|
| Front, avec des données d'exemple | Non |
| `npm run test:knowledge`, `npm run test:rag` | Non |
| `npm run test:pdf` et `npm test` (tous les tests) | Oui |
| Vérifier les correspondances (`voir-metier.js`, `propose-correspondances.js`) | Oui |
| Tester l'import d'un rapport dans l'appli | Oui |

### Précautions

- **Ne pas relancer `scripts/build-knowledge.js`** sans raison : il demande de retélécharger l'open data et n'apporte rien tant que ROME / ONISEP ne changent pas.
- **Une seule personne à la fois** modifie `correspondances.json` ou relance `scripts/propose-correspondances.js` (le script garde les choix `"manuelle"` mais réécrit le fichier : deux personnes en même temps = conflit git). À deux, se partager les intitulés (A-L / M-Z) et commiter souvent.
- **Aucun Rapport des Possibles, aucune clé, aucun `.env` dans un commit** : vérifier `git status` avant chaque `git commit`.

### Commandes utiles (depuis la racine du dépôt)

| Commande | Rôle |
|---|---|
| `npm run dev` | Lance l'appli en local |
| `npm test` | Tous les tests (PDF nécessaires) |
| `npm run test:pdf` / `test:knowledge` / `test:rag` | Un groupe de tests |
| `npm run extract -- data/rapports/xxx.pdf` | Affiche le JSON extrait d'un rapport |
| `node scripts/voir-metier.js "Intitulé"` | Aide à vérifier une correspondance (`--chercher "mots"` pour chercher une fiche ROME) |
| `npm run correspondances` | Recalcule les correspondances (garde les choix `"manuelle"`) |

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
