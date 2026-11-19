
import { fail, redirect } from '@sveltejs/kit';
import { extractRapport } from '#lib/server/pdf.js';
import { saveReport } from '#lib/server/reports.js';

// Taille maximale acceptée : 10 Mo (un rapport fait environ 1 Mo)
const TAILLE_MAX = 10 * 1024 * 1024;

/**
 * @type {import('./$types').Actions}
 */
export const actions = {
  importReport: async ({ request }) => {

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

    let id;

    try {

      const rapport = await extractRapport(buffer, pdf.name);
      id = saveReport(rapport); // en mémoire, 1 h
    } catch (error) {
      
      // Message court dans le terminal : pas le contenu du rapport
      console.error('Impossible de lire le rapport PDF :', /** @type {Error} */ (error).message);
      return fail(422, { error: "Le PDF n'a pas pu être analysé" });
    }

    // Succès : on envoie le jeune sur la page de SON rapport.
    // redirect() est en dehors du try/catch (il fonctionne en "lançant" une exception).
    redirect(303, `/rapport/${id}`);
  }
};
