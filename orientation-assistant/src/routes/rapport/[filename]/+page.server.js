/** @type {import('./$types').PageServerLoad} */
export const load = async ({ fetch, params }) => {
    const rapport = await fetch(`/data/rapports/${params.filename}.json`);
    const rapportData = await rapport.json();
    console.log("rapportData", rapportData);
    return {
        rapport: rapportData,
    };
}