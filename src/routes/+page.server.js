import { fail } from '@sveltejs/kit';
import { extractRapport } from '#lib/server/pdf.js';
import { creerSession, lireSession, supprimerSession, COOKIE_SID, DUREE_SESSION_MS } from '#lib/server/session.js';

// Taille maximale acceptée : 10 Mo (un rapport fait environ 1 Mo)
const TAILLE_MAX = 10 * 1024 * 1024;

/**
 * À chaque affichage de l'accueil : le rapport du jeune s'il en a importé un (session + cookie).
 * On n'envoie au navigateur que le RÉSUMÉ affiché (pas les descriptions : rag.js les relit côté serveur).
 * @type {import('./$types').PageServerLoad}
 */
/**
 * À chaque affichage de l'accueil : le rapport du jeune s'il en a importé un (session + cookie).
 * On n'envoie au navigateur que le RÉSUMÉ affiché (pas les descriptions : rag.js les relit côté serveur).
 * @type {import('./$types').PageServerLoad}
 */
export const load = async ({ cookies }) => {

    const rapport = lireSession(cookies.get(COOKIE_SID));
    if (!rapport) return { rapport: null }; // pas de rapport (jamais importé, expiré, supprimé)

    return {
        rapport: {
            nom: rapport.nom,
            // zones : numéro, titre, et leurs métiers (id = ce que le chat envoie à /api/chat)
            zones: rapport.zones.map((zone) => ({
                numero: zone.numero,
                titre: zone.titre,
                metiers: rapport.metiers
                    .filter((m) => m.zone === zone.numero)            // les métiers de cette zone
                    .map((m) => ({ id: m.id, intitule: m.intitule })) // seulement ce qui s'affiche
            })),
            nbMetiers: rapport.metiers.length
        }
    };
};

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
            // à récuperer pour ollama!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            const rapport = await extractRapport(buffer, pdf.name); // PDF -> objet JSON (zones, métiers)
            sid = creerSession(rapport); // en mémoire, 1 h (session.js)
        } catch (error) {
            // Message court dans le terminal : pas le contenu du rapport
            console.error('Impossible de lire le rapport PDF :', /** @type {Error} */ (error).message);
            return fail(422, { error: "Le PDF n'a pas pu être analysé" });
        }

        // Le sid voyage dans un cookie httpOnly : le JavaScript de la page ne peut pas le lire
        cookies.set(COOKIE_SID, sid, {
            path: '/',                              // envoyé sur toutes les pages (accueil, chat)
            httpOnly: true,                         // invisible pour le JavaScript du navigateur
            sameSite: 'lax',                        // pas envoyé depuis un autre site
            secure: url.protocol === 'https:',      // "secure" seulement en HTTPS (sinon le cookie serait refusé en http)
            maxAge: DUREE_SESSION_MS / 1000         // en secondes : 3600 = 1 h, comme la session
        });

        // Succès : on reste sur l'accueil. use:enhance relance load() juste après,
        // donc la liste des métiers s'affiche sans changer de page.
        return { succes: true };
    },

    // Bouton "Supprimer mes données" : efface la session ET le cookie
    supprimer: async ({ cookies }) => {
        supprimerSession(cookies.get(COOKIE_SID));
        cookies.delete(COOKIE_SID, { path: '/' });
        return { supprime: true }; // load() relancé -> rapport: null -> la liste disparaît
    }
};
