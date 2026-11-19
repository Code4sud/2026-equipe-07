import { fail } from "@sveltejs/kit";
import { extractRapport } from "#lib/server/pdf.js";

/**
 * @type {import('./$types').Actions}
 */
export const actions = {
  importReport: async ({ request }) => {
    const formData = await request.formData();
    const pdf = formData.get("rapport-pdf");

    if (!(pdf instanceof File) || pdf.size === 0) {
      return fail(400, {
        error: "Aucun fichier PDF téléchargé",
      });
    }

    if (pdf.type !== "application/pdf") {
      return fail(400, {
        error: "Type de fichier invalide",
      });
    }

    const buffer = new Uint8Array(await pdf.arrayBuffer());

    try {
      const parsedReport = await extractRapport(buffer, pdf.name);
      console.log("Rapport PDF analysé avec succès", parsedReport);
      return {
        text: JSON.stringify(parsedReport, null, 4),
      };

    } catch (error) {
      console.error("Impossible de parser le rapport PDF", error);
      return fail(422, { error: "Le PDF n'a pas pu être analysé" });
    }
  },
};
