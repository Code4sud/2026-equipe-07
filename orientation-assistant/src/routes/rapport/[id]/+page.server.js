import { error, redirect } from '@sveltejs/kit';
import { readReport, deleteReport } from '#lib/server/reports.js';

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ params }) => {
    // Lecture directe en mémoire (pas de fetch : data/ n'est pas servi en production)
    const rapport = readReport(params.id);

    // Id inconnu, invalide, ou rapport expiré (1 h) -> page 404 avec un message clair
    if (!rapport) error(404, 'Rapport introuvable ou expiré : importe-le à nouveau.');

    return { id: params.id, rapport };
};

/** @type {import('./$types').Actions} */
export const actions = {
    // Bouton "Supprimer mes données"
    supprimer: async ({ params }) => {
        deleteReport(params.id);
        redirect(303, '/'); // retour à l'accueil
    }
};