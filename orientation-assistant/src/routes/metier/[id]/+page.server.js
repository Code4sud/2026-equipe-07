// =============================================================================
// Fiche métier — métier [id] de la session + fiche ROME / ONISEP (si vérifiée)
// =============================================================================

import { error, redirect } from '@sveltejs/kit';
import { lireSession, COOKIE_SID } from '#lib/server/session.js';
import { validerId } from '#lib/server/validation.js';
import { ficheMetier } from '#lib/server/knowledge.js';
import { SUGGESTIONS } from '#lib/server/rag.js';

/** @type {import('./$types').PageServerLoad} */
export function load({ params, cookies }) {

    const rapport = lireSession(cookies.get(COOKIE_SID));

    // Pas de session (expirée, supprimée) : retour à l'accueil pour réimporter
    if (!rapport) redirect(303, '/');

    const metier = validerId(params.id) ? rapport.metiers.find((m) => m.id === params.id) : undefined;
    if (!metier) error(404, 'Métier introuvable dans ton rapport.');

    const zone = rapport.zones.find((z) => z.numero === metier.zone);
    const fiche = ficheMetier(metier.intitule);

    return {
        metier,
        zone: zone ?? null,
        // On n'envoie au navigateur que ce qui s'affiche (pas les appellations)
        fiche: {
            statut: fiche.statut,
            code_rome: fiche.code_rome,
            rome: fiche.rome
                ? {
                    libelle: fiche.rome.libelle,
                    definition: fiche.rome.definition,
                    acces: fiche.rome.acces,
                    url: fiche.rome.url,
                    version: fiche.rome.version
                }
                : null,
            onisep_url: fiche.onisep_url
        },
        suggestions: SUGGESTIONS
    };
}
