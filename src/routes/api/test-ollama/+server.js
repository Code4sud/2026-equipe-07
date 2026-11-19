// =============================================================================
// /api/test-ollama — outil de test, UNIQUEMENT en mode dev (404 en production)
//   GET  -> état de la connexion : Ollama joignable ? le modèle est-il installé ?
//   POST -> { messages: [{ role, content }] } -> { reponse, ms }
// Rien n'est enregistré ni loggé (ni questions, ni réponses).
// =============================================================================

import { json, error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { chat, OllamaError } from '#lib/server/ollama.js';

const url = () => (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
const modele = () => process.env.LLM_MODEL || 'qwen2.5:3b';

const MAX_MESSAGES = 20;
const MAX_LONGUEUR = 1000;

/** @type {import('./$types').RequestHandler} */
export async function GET() {

    if (!dev) error(404, 'Not found');

    const base = { url: url(), modele: modele() };

    try {
        const res = await fetch(`${url()}/api/tags`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) return json({ ...base, connecte: false, detail: `Ollama a répondu ${res.status}.` });

        const { models = [] } = await res.json();
        const noms = models.map((m) => m.name);
        // "qwen2.5:3b" ou "qwen2.5:3b-instruct..." : on compare le nom exact puis le préfixe
        const installe = noms.some((n) => n === modele() || n.startsWith(`${modele()}-`));

        return json({ ...base, connecte: true, modeleInstalle: installe, modeles: noms });
    } catch {
        return json({ ...base, connecte: false, detail: "Ollama est injoignable. Est-il lancé (« ollama serve ») ?" });
    }
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {

    if (!dev) error(404, 'Not found');

    let corps;
    try {
        corps = await request.json();
    } catch {
        return json({ erreur: 'Requête invalide.' }, { status: 400 });
    }

    const messages = corps?.messages;
    const valide =
        Array.isArray(messages) &&
        messages.length > 0 &&
        messages.length <= MAX_MESSAGES &&
        messages.every(
            (m) =>
                (m?.role === 'user' || m?.role === 'assistant') &&
                typeof m.content === 'string' &&
                m.content.length > 0 &&
                m.content.length <= MAX_LONGUEUR
        );

    if (!valide) return json({ erreur: `Messages invalides (max ${MAX_MESSAGES}, ${MAX_LONGUEUR} caractères).` }, { status: 400 });

    const debut = Date.now();
    try {
        // On ne retransmet que role + content (rien d'autre venant du client)
        const reponse = await chat(messages.map(({ role, content }) => ({ role, content })), { timeoutMs: 120_000 });
        return json({ reponse, ms: Date.now() - debut });
    } catch (e) {
        const code = e instanceof OllamaError ? e.code : 'INCONNUE';
        return json({ erreur: e instanceof OllamaError ? e.message : 'Erreur inattendue.', code, ms: Date.now() - debut }, { status: 502 });
    }
}
