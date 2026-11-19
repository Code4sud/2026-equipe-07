// =============================================================================
// Accueil — import du PDF, rapport de la session, suppression des données
// -----------------------------------------------------------------------------
// Le PDF est lu EN MÉMOIRE : jamais écrit sur disque, jamais envoyé à un tiers.
// On ne logge rien du contenu du rapport.
// =============================================================================

import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { extractRapport, PdfError } from '$lib/server/pdf.js';
import { validerPdf } from '$lib/server/validation.js';
import { ficheMetier } from '$lib/server/knowledge.js';
import { creerSession, lireSession, supprimerSession, COOKIE_SID, DUREE_SESSION_MS } from '$lib/server/session.js';

/** @type {import('./$types').PageServerLoad} */
export function load({ cookies }) {

    const sid = cookies.get(COOKIE_SID);
    const rapport = lireSession(sid);

    // Cookie présent mais session expirée / supprimée : on le nettoie
    if (sid && !rapport) cookies.delete(COOKIE_SID, { path: '/' });

    if (!rapport) return { rapport: null, statuts: {} };

    // Statut de correspondance ROME de chaque métier (vérifié / à vérifier / aucun / inconnu)
    const statuts = Object.fromEntries(rapport.metiers.map((m) => [m.id, ficheMetier(m.intitule).statut]));

    return { rapport, statuts };
}

/** @type {import('./$types').Actions} */
export const actions = {

    importer: async ({ request, cookies }) => {

        let formData;
        try {
            formData = await request.formData();
        } catch {
            return fail(400, { code: 'TYPE_INVALIDE', message: 'Envoi invalide : choisis un fichier PDF.' });
        }

        const pdf = await validerPdf(formData.get('file'));
        if (!pdf.ok) return fail(400, { code: pdf.code, message: pdf.message });

        let rapport;
        try {
            rapport = await extractRapport(pdf.data, pdf.nom);
        } catch (e) {
            if (!(e instanceof PdfError)) console.error('[importer] erreur inattendue :', e?.name);
            return fail(400, { code: 'PDF_ILLISIBLE', message: 'Ce PDF ne peut pas être lu.' });
        }

        // Un PDF valide mais qui n'est pas un rapport : on ne fabrique rien
        if (rapport.zones.length === 0) {
            return fail(400, {
                code: 'PDF_ILLISIBLE',
                message: "Ce PDF ne ressemble pas à un « Rapport des Possibles » : aucune zone de métiers trouvée."
            });
        }

        // Un nouvel import remplace l'éventuelle session précédente
        supprimerSession(cookies.get(COOKIE_SID));

        const sid = creerSession(rapport);
        cookies.set(COOKIE_SID, sid, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: !dev,
            maxAge: DUREE_SESSION_MS / 1000
        });

        redirect(303, '/');
    },

    supprimer: async ({ cookies }) => {
        supprimerSession(cookies.get(COOKIE_SID));
        cookies.delete(COOKIE_SID, { path: '/' });
        return { supprime: true };
    }
};
