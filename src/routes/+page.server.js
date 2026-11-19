import { fail, redirect } from '@sveltejs/kit';
import { extractRapport } from '#lib/server/pdf.js';
import { creerSession, COOKIE_SID, DUREE_SESSION_MS } from '#lib/server/session.js';

// Taille maximale acceptée : 10 Mo (un rapport fait environ 1 Mo)
const TAILLE_MAX = 10 * 1024 * 1024;

/**
 * @type {import('./$types').Actions}
 */
export const actions = {
    importReport: async ({ request, cookies, url }) => {
        const formData = await request.formData();
        const pdf = formData.get('rapport-pdf'); // nom du champ <input name="rapport-pdf">

        // Aucun fichier, ou fichier vide
        if (!(pdf instanceof File) || pdf.size === 0) {
            return fail(400, { error: 'Aucun fichier PDF téléchargé' });
        }

        // Trop gros : on refuse avant de le lire
        if (pdf.size > TAILLE_MAX) {
            return fail(413, { error: 'Fichier trop volumineux (10 Mo maximum)' });
        }

        // Type annoncé par le navigateur (facile à falsifier : on revérifie juste après)
        if (pdf.type !== 'application/pdf') {
            return fail(400, { error: 'Type de fichier invalide' });
        }

        const buffer = new Uint8Array(await pdf.arrayBuffer());

        // Vrai type : un PDF commence toujours par les 5 caractères "%PDF-"
        if (new TextDecoder().decode(buffer.slice(0, 5)) !== '%PDF-') {
            return fail(400, { error: "Ce fichier n'est pas un PDF" });
        }

        let sid;
        try {
            const rapport = await extractRapport(buffer, pdf.name);
            sid = creerSession(rapport); // en mémoire, 1 h (session.js)
        } catch (error) {
            // Message court dans le terminal : pas le contenu du rapport
            console.error('Impossible de lire le rapport PDF :', /** @type {Error} */ (error).message);
            return fail(422, { error: "Le PDF n'a pas pu être analysé" });
        }

        // Le sid voyage dans un cookie httpOnly : le JavaScript de la page ne peut pas le lire
        cookies.set(COOKIE_SID, sid, {
            path: '/',                              // envoyé sur toutes les pages (rapport, métier, chat)
            httpOnly: true,                         // invisible pour le JavaScript du navigateur
            sameSite: 'lax',                        // pas envoyé depuis un autre site
            secure: url.protocol === 'https:',      // "secure" seulement en HTTPS (sinon le cookie serait refusé en http)
            maxAge: DUREE_SESSION_MS / 1000         // en secondes : 3600 = 1 h, comme la session
        });

        // Succès : on envoie le jeune sur la page de SON rapport.
        // redirect() est en dehors du try/catch (il fonctionne en "lançant" une exception).
        // redirect(303, '/rapport');
    }
};
