// =============================================================================
// POST /api/chat — { id, question } -> { statut, reponse, sources, suggestions }
// -----------------------------------------------------------------------------
// 401 : pas de session   404 : métier inconnu   400 : question invalide
// 429 : une question de cette session est déjà en cours (le modèle tourne sur CPU)
// On ne logge JAMAIS la question ni le contenu du rapport.
// =============================================================================

import { json } from '@sveltejs/kit';
import { lireSession, COOKIE_SID } from '#lib/server/session.js';
import { validerId, validerQuestion } from '#lib/server/validation.js';
<<<<<<< HEAD:orientation-assistant/src/routes/api/chat/+server.js
import { chat } from '#lib/server/ollama.js';
=======
>>>>>>> origin/main:src/routes/api/chat/+server.js
import { repondre } from '#lib/server/rag.js';
import { chat } from '#lib/server/ollama.js';

const TAILLE_MAX_CORPS = 4 * 1024; // 4 Ko : largement assez pour une question de 500 caractères

// Sessions dont une question est en cours de traitement
/** @type {Set<string>} */
const enCours = (/** @type {any} */ (globalThis).__chatEnCours ??= new Set());

/** @param {number} status @param {string} reponse */
const erreur = (status, reponse) => json({ statut: 'erreur', reponse, sources: [], suggestions: [] }, { status });

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, cookies }) {

    const sid = cookies.get(COOKIE_SID);
    const rapport = lireSession(sid);
    if (!rapport || !sid) return erreur(401, 'Ta session a expiré. Réimporte ton rapport.');

    // Corps de la requête : taille limitée, JSON obligatoire
    const texte = await request.text();
    if (texte.length > TAILLE_MAX_CORPS) return erreur(400, 'Requête trop volumineuse.');

    let corps;
    try {
        corps = JSON.parse(texte);
    } catch {
        return erreur(400, 'Requête invalide.');
    }

    const metier = validerId(corps?.id) ? rapport.metiers.find((m) => m.id === corps.id) : undefined;
    if (!metier) return erreur(404, 'Métier introuvable dans ton rapport.');

    const question = validerQuestion(corps?.question);
    if (!question.ok) return erreur(400, question.message);

    if (enCours.has(sid)) return erreur(429, 'Une réponse est déjà en cours, patiente un instant.');

    enCours.add(sid);
    try {
<<<<<<< HEAD:orientation-assistant/src/routes/api/chat/+server.js
        // repondre construit les sources, appelle le modèle puis vérifie les citations
        const resultat = await repondre(
            { question: question.question, rapport, metierId: metier.id },
            (messages) => chat(messages, { timeoutMs: 90_000, options: { temperature: 0.2, num_predict: 250 } })
=======
        // rag.js construit les sources (rapport + ROME vérifié) et vérifie les [n] de la réponse.
        // On lui donne la fonction qui appelle le modèle : chat() de ollama.js (2 min max sur CPU).
        const resultat = await repondre(
            { question: question.question, rapport, metierId: metier.id },
            (messages) => chat(messages, { timeoutMs: 120_000, options: { temperature: 0.2 } })
>>>>>>> origin/main:src/routes/api/chat/+server.js
        );
        return json(resultat);
    } finally {
        enCours.delete(sid);
    }
}
