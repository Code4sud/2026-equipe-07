// =============================================================================
// /api/ollama — chat de l'assistant
//   GET    -> état de la connexion Ollama (dev uniquement)
//   POST   -> { messages, metierId? } -> { statut, reponse, sources, suggestions }
//             la question est ANALYSÉE par rag.js (validation, garde-fou, sources) avant le modèle,
//             puis la réponse est vérifiée par citations.js.
//   PUT    -> import d'un PDF + JSON généré (dev uniquement)
//   DELETE -> retire le rapport de la session (dev uniquement)
// Rien n'est enregistré ni loggé (ni questions, ni réponses).
// =============================================================================

import { json, error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { chat } from '#lib/server/ollama.js';
import { extractRapport } from '#lib/server/pdf.js';
import { creerSession, lireSession, supprimerSession, COOKIE_SID, DUREE_SESSION_MS } from '#lib/server/session.js';
import { repondreQuestion, SUGGESTIONS } from '#lib/server/rag.js';
import { nomSur } from '#lib/server/validation.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// JSON générés à partir des PDF (dev uniquement). Données personnelles : à ne pas commiter.
const DOSSIER_JSON = resolve('data/rapports/json');

const TAILLE_MAX_PDF = 10 * 1024 * 1024;

/** Résumé du rapport pour l'affichage */
const resume = (r) => ({ fichier: r.nom ?? null, zones: r.zones?.length ?? 0, metiers: r.metiers.map((m) => m.intitule) });

// Sessions dont une question est en cours (le modèle tourne sur CPU : une réponse à la fois)
/** @type {Set<string>} */
const enCours = (/** @type {any} */ (globalThis).__ollamaEnCours ??= new Set());

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

/** Upload d'un rapport PDF (champ "rapport-pdf") -> session + résumé */
/** @type {import('./$types').RequestHandler} */
export async function PUT({ request, cookies, url }) {
    if (!dev) error(404, 'Not found');

    const pdf = (await request.formData()).get('rapport-pdf');
    if (!(pdf instanceof File) || pdf.size === 0) return json({ erreur: 'Aucun fichier PDF.' }, { status: 400 });
    if (pdf.size > TAILLE_MAX_PDF) return json({ erreur: 'Fichier trop volumineux (10 Mo max).' }, { status: 413 });

    const buffer = new Uint8Array(await pdf.arrayBuffer());
    if (new TextDecoder().decode(buffer.slice(0, 5)) !== '%PDF-') return json({ erreur: "Ce fichier n'est pas un PDF." }, { status: 400 });

    try {
        const rapport = await extractRapport(buffer, nomSur(pdf.name));
        const sid = creerSession(rapport);

        // Fichier JSON exploitable généré à partir du PDF : data/rapports/json/<nom>.json
        mkdirSync(DOSSIER_JSON, { recursive: true });
        const fichierJson = `${rapport.nom.replace(/\.pdf$/i, '').replace(/[^\w.-]+/g, '_')}.json`;
        writeFileSync(resolve(DOSSIER_JSON, fichierJson), JSON.stringify(rapport, null, 2), 'utf-8');

        cookies.set(COOKIE_SID, sid, { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: DUREE_SESSION_MS / 1000 });
        return json({ rapport: { ...resume(rapport), json: `data/rapports/json/${fichierJson}`, warnings: rapport.warnings } });
    } catch {
        return json({ erreur: "Le PDF n'a pas pu être analysé." }, { status: 422 });
    }
}

/** Retire le rapport de la session */
/** @type {import('./$types').RequestHandler} */
export async function DELETE({ cookies }) {
    if (!dev) error(404, 'Not found');
    supprimerSession(cookies.get(COOKIE_SID));
    cookies.delete(COOKIE_SID, { path: '/' });
    return json({ ok: true });
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, cookies }) {

    let corps;
    try {
        corps = await request.json();
    } catch {
        return json({ statut: 'erreur', reponse: 'Requête invalide.', sources: [], suggestions: SUGGESTIONS }, { status: 400 });
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

    if (!valide) {
        return json({ statut: 'erreur', reponse: 'Messages invalides.', sources: [], suggestions: SUGGESTIONS }, { status: 400 });
    }

    // Clé d'attente : la session si elle existe, sinon une clé commune aux visiteurs sans rapport
    const sid = cookies.get(COOKIE_SID);
    const cle = sid ?? 'anonyme';
    if (enCours.has(cle)) {
        return json({ statut: 'erreur', reponse: 'Une réponse est déjà en cours, patiente un instant.', sources: [], suggestions: SUGGESTIONS }, { status: 429 });
    }

    enCours.add(cle);
    const debut = Date.now();
    try {
        const resultat = await repondreQuestion(
            {
                // On ne retransmet que role + content (rien d'autre venant du client)
                messages: messages.map(({ role, content }) => ({ role, content })),
                rapport: lireSession(sid),
                metierId: corps?.metierId
            },
            (msgs) => chat(msgs, { timeoutMs: 120_000, options: { temperature: 0.2 } })
        );
        return json({ ...resultat, reponse: resultat.reponse, ms: Date.now() - debut });
    } finally {
        enCours.delete(cle);
    }
}