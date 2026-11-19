// =============================================================================
// pages.js — Prépare dist/ pour GitHub Pages (lancé automatiquement après "npm run build")
// -----------------------------------------------------------------------------
// Le workflow du hackathon (.github/workflows/pages.yml) lance "npm run build" puis publie dist/.
// Notre appli est un serveur Node (sortie build/) : elle ne peut pas tourner sur GitHub Pages.
// On publie donc dans dist/ la page statique du dépôt (index.html avec le bandeau, captures/),
// comme avant que l'appli soit à la racine.
// =============================================================================

import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

await rm('dist', { recursive: true, force: true }); // repart d'un dossier propre
await mkdir('dist', { recursive: true });

// Fichiers et dossiers de la page statique du hackathon (copiés s'ils existent)
for (const element of ['index.html', 'test.html', 'captures']) {
    if (existsSync(element)) await cp(element, `dist/${element}`, { recursive: true });
}

console.log('dist/ prêt pour GitHub Pages');