import { redirect } from '@sveltejs/kit';
import { lireSession, supprimerSession, COOKIE_SID } from '#lib/server/session.js';

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ cookies }) => {
    // Le rapport du jeune, retrouvé grâce au cookie (session en mémoire, 1 h)
    const rapport = lireSession(cookies.get(COOKIE_SID));

    // Pas de session (jamais importé, expirée, supprimée) : retour à l'accueil pour importer
    if (!rapport) redirect(303, '/');

    return { rapport };
};

/** @type {import('./$types').Actions} */
export const actions = {
    // Bouton "Supprimer mes données" : efface la session ET le cookie
    supprimer: async ({ cookies }) => {
        supprimerSession(cookies.get(COOKIE_SID));
        cookies.delete(COOKIE_SID, { path: '/' });
        redirect(303, '/'); // retour à l'accueil
    }
};
