import { fail } from "@sveltejs/kit";
import { extractRapport } from "#lib/server/pdf.js";
import { saveReport } from "#lib/server/reports.js";

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

    let parsedReport;
    try {
      parsedReport = await extractRapport(buffer, pdf.name);
    } catch (error) {
      console.error("Impossible de parser le rapport PDF", error);
      return fail(422, { error: "Le PDF n'a pas pu être analysé" });
    }

    try {
      return { path: await saveReport(parsedReport) };
    } catch (error) {
      console.error("Impossible d'enregistrer le rapport JSON", error);
      return fail(500, { error: "Le rapport n'a pas pu être enregistré" });
    }
  },
};
