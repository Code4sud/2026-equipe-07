// load : rapport de la session ; actions « importer » et « supprimer »
export function load({ cookies }) {
	return { rapport: null };
}

export const actions = {
	importer: async ({ request, cookies }) => {},
	supprimer: async ({ cookies }) => {}
};
