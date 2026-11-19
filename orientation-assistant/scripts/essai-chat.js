// =============================================================================
// essai-chat.js — Poser une vraie question à Ollama sur un vrai rapport (test manuel)
// -----------------------------------------------------------------------------
// node scripts/essai-chat.js data/rapports/rapport-des-possibles-2187.pdf z1-m3 "Il faut quel diplôme ?"
// Sans 3e argument : affiche la liste des métiers du rapport (pour trouver l'id).
// Config : variables OLLAMA_URL et LLM_MODEL (sinon valeurs par défaut ci-dessous).
// Avec "npm run chat -- ...", ces variables sont lues dans le fichier .env (option --env-file).
// =============================================================================

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';                       // "data/rapports/x.pdf" -> "x.pdf"
import { extractRapport } from '../src/lib/server/pdf.js';  // étape 1 : lire le PDF
import { repondre } from '../src/lib/server/rag.js';        // étape 5 : sources + vérification
import { chat } from '../src/lib/server/ollama.js';         // l'appel réel au modèle

// process.argv = ["node", "scripts/essai-chat.js", "<pdf>", "<id>", "<question>"]
// slice(2) saute les 2 premiers ; un argument absent vaut undefined
const [chemin, metierId, question] = process.argv.slice(2); // les 3 arguments de la commande

// Pas de PDF donné : on rappelle l'usage et on s'arrête (1 = erreur)
if (!chemin) {
    console.log('Usage : node scripts/essai-chat.js <rapport.pdf> [id-metier] ["question"]');
    process.exit(1);
}

// Lecture du rapport, exactement comme le fera l'appli à l'import
const rapport = await extractRapport(await readFile(chemin), basename(chemin));

// Pas de question : on liste les métiers pour choisir un id.
if (!question) {
    for (const m of rapport.metiers) {
        console.log(`${m.id}  ${m.intitule}`); // ex. "z1-m3  Barista"
    }
    process.exit(0); // 0 = arrêt normal
}

// Adresse et modèle d'Ollama ; ?? = valeur par défaut si la variable n'existe pas
const config = {
    url: process.env.OLLAMA_URL ?? 'http://localhost:11434',
    modele: process.env.LLM_MODEL ?? 'qwen2.5:3b' // même valeur par défaut que ollama.js
};

// || : si le nom du modèle est vide, on affiche un rappel à la place
console.log(`Modèle : ${config.modele || '(LLM_MODEL non défini)'} sur ${config.url}\n`);

const debut = Date.now(); // pour mesurer le temps de réponse (en millisecondes)

// On donne à repondre() une fonction qui appelle le VRAI Ollama (dans les tests : un faux modèle)
const r = await repondre({ question, rapport, metierId }, (messages) => chat(messages, { timeoutMs: 120_000, options: { temperature: 0.2 } }));

// Statut (ok / insuffisant / erreur) et durée en secondes, avec 1 décimale
console.log(`[${r.statut}] en ${((Date.now() - debut) / 1000).toFixed(1)} s\n`);
console.log(r.reponse); // la réponse vérifiée (ou le message de repli)
console.log('\nSources :');

// Seulement les sources réellement citées ; page et lien affichés s'ils existent
for (const s of r.sources) {
    console.log(`  [${s.n}] ${s.titre}${s.page ? ` (p. ${s.page})` : ''}${s.url ? ` ${s.url}` : ''}`);
}
