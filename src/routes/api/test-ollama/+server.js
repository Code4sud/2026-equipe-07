// =============================================================================
// /api/test-ollama — outil de test, UNIQUEMENT en mode dev (404 en production)
//   GET  -> état de la connexion : Ollama joignable ? le modèle est-il installé ?
//   POST -> { messages: [{ role, content }] } -> { reponse, ms }
// Rien n'est enregistré ni loggé (ni questions, ni réponses).
// =============================================================================

import { json, error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { chat, OllamaError } from '#lib/server/ollama.js';
import { extractRapport } from '#lib/server/pdf.js';
import { creerSession, lireSession, supprimerSession, COOKIE_SID, DUREE_SESSION_MS } from '#lib/server/session.js';
import { construireSources, PROMPT_SYSTEME } from '#lib/server/rag.js';
import { ficheMetier, metiersProches } from '#lib/server/knowledge.js';

const TAILLE_MAX_PDF = 10 * 1024 * 1024;

/** Résumé du rapport pour l'affichage */
const resume = (r) => ({ fichier: r.fichier ?? null, zones: r.zones?.length ?? 0, metiers: r.metiers.map((m) => m.intitule) });

/** Contexte texte : tous les métiers du rapport + zones + fiches ROME vérifiées */
function contexteRapport(rapport) {
    const blocs = rapport.metiers.map((m) => {
        const { sources } = construireSources(rapport, m);
        const txt = sources.map((s) => `- (${s.type}) ${s.titre} : ${s.texte}`).join('\n');

        // correspondances.json (statut "verifie" uniquement) -> rome.json : appellations du métier
        const fiche = ficheMetier(m.intitule);
        const appellations =
            fiche.statut === 'verifie' && fiche.rome?.appellations?.length
                ? `\n- (ROME ${fiche.code_rome}) Appellations du métier : ${fiche.rome.appellations.slice(0, 25).join(' ; ')}`
                : `\n- Aucune fiche ROME fiable pour ce métier : ne donne pas de détails officiels (diplômes, appellations).`;

        return `### ${m.intitule}\n${txt}${appellations}`;
    });
    return blocs.join('\n\n').slice(0, 12000);
}

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
        const rapport = await extractRapport(buffer, pdf.name);
        const sid = creerSession(rapport);
        cookies.set(COOKIE_SID, sid, { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: DUREE_SESSION_MS / 1000 });
        return json({ rapport: resume(rapport) });
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
        const propres = messages.map(({ role, content }) => ({ role, content }));
        const rapport = lireSession(cookies.get(COOKIE_SID));

        // Sources JSON d'abord : métiers proches de la dernière question (appellations de rome.json)
        const derniere = [...propres].reverse().find((m) => m.role === 'user')?.content ?? '';
        const proches = metiersProches(derniere);
        const blocProches = proches.length
            ? `\n\nMÉTIERS PROCHES TROUVÉS DANS ROME (liste officielle, ${proches[0].version}) :\n` +
            proches.map((p) => `### ${p.libelle} (${p.code})\n${p.appellations.map((a) => `- ${a}`).join('\n')}`).join('\n\n') +
            '\nQuand on demande les métiers autour d\'un métier, donne cette liste complète telle quelle, puis ajoute une courte phrase variée et personnalisée.'
            : '';

        const avecRapport = rapport || proches.length
            ? [
                {
                    role: 'system',
                    content:
                        `${PROMPT_SYSTEME}\nPersonnalise ta réponse avec le rapport du jeune quand il existe, et cite les appellations ROME (métiers proches). Ne t'appuie que sur les sources ci-dessous.` +
                        (rapport ? `\n\nRAPPORT DU JEUNE ET FICHES ROME (sources) :\n${contexteRapport(rapport)}` : '') +
                        blocProches
                },
                ...propres
            ]
            : propres;
        const reponse = await chat(avecRapport, { timeoutMs: 120_000 });
        return json({ reponse, ms: Date.now() - debut });
    } catch (e) {
        const code = e instanceof OllamaError ? e.code : 'INCONNUE';
        return json({ erreur: e instanceof OllamaError ? e.message : 'Erreur inattendue.', code, ms: Date.now() - debut }, { status: 502 });
    }
}
