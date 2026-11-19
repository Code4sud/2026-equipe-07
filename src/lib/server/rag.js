// Métier + question -> contexte numéroté [1..5] -> prompt -> Ollama
export function construireContexte(metier, zone, fiche) {}
export function construirePrompt(contexte, question) {}
export async function repondre(metier, zone, fiche, question) {} // -> { statut, reponse, sources, suggestions }
