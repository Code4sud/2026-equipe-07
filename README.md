# Équipe 07 — Hackathon Azuréen #3

Projet réalisé à Nice les 18, 19 et 20 novembre 2026, sur le thème **« L'orientation et l'employabilité grâce à l'IA »**, organisé par [Code4Sud](https://code4sud.fr).

## Le projet

__Sujet__: L'assistant d'exploration des métiers

**OrienTi** aide le jeune qui sort du Centre des Possibles avec son Rapport des Possibles : une vingtaine de métiers, souvent inconnus, répartis en cinq zones de durée de formation. Il importe son rapport PDF, choisit un métier et pose ses questions (« c'est quoi ? », « quel diplôme ? », « sans le bac ? ») à un assistant IA open weight (Qwen 2.5 via Ollama, en local). Les réponses s'appuient sur son rapport et sur les fiches ROME 4.0 de France Travail, reliées aux métiers du rapport par une correspondance vérifiée à la main (171 intitulés).

### Comment ça marche

| Étape | Fichier |
|---|---|
| Extraction du PDF (zones, métiers, descriptions, pages), en mémoire | `src/lib/server/pdf.js` |
| Session d'une heure maximum, bouton « Supprimer mes données » | `src/lib/server/session.js` |
| Fiches ROME / ONISEP (open data) et correspondances vérifiées | `data/knowledge/`, `src/lib/server/knowledge.js` |
| Sources numérotées, contrôle des citations, réponse « je ne sais pas » | `src/lib/server/rag.js`, `citations.js`, route `/api/chat` |
| Appel au modèle (Ollama local) | `src/lib/server/ollama.js` |
| Chat de la page d'accueil | `src/lib/components/Chat.svelte`, route `/api/ollama` (mode dev uniquement) |

## Lancer le projet

Application SvelteKit + Node.js, à la racine du dépôt. Prérequis : Node.js 22.13 ou plus, et [Ollama](https://ollama.com) installé et lancé.

```bash
npm install
cp .env.example .env
ollama pull qwen2.5:3b
npm run dev
```

Ouvrir http://localhost:5173 et importer un Rapport des Possibles (PDF). Le chat utilise `npm run dev` : sa route `/api/ollama` renvoie 404 en production (`npm start`).

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

Pas de démo en ligne : OrienTi a besoin d'un serveur Node et d'Ollama, ce que GitHub Pages ne fournit pas. La démonstration se fait en local (`npm run dev`), le champ `demo` de `projet.json` reste vide. L'adresse `https://code4sud.github.io/2026-equipe-07/` n'affiche que la page statique du hackathon.

## Licence

MIT — voir `LICENSE`.
