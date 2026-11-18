import { fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { parseReport } from "#lib/server/parse.ts";


export const actions: Actions = {
    importReport: async ({ request }) => {
        const formData = await request.formData();
        const pdf = formData.get("pdf");

        if (!(pdf instanceof File) || pdf.size === 0) {
            return fail(400, {
                error: "Aucun fichier PDF téléchargé"
            });
        }

        if (pdf.type !== "application/pdf") {
            return fail(400, {
                error: "Type de fichier invalide"
            });
        }

        const buffer = new Uint8Array(await pdf.arrayBuffer());

        try {
            const parsedReport = await parseReport(buffer);
            return {
                text: JSON.stringify(parsedReport, null, 4)
            };
            


        } catch (error) {
            console.error("Impossible de parser le rapport PDF", error);
            return fail(422, { error: "Le PDF n'a pas pu être analysé" });
        } 
    }
};
