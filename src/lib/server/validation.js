// Contrôles serveur : vrai PDF (%PDF), taille max, question non vide / longueur max, id valide
export const TAILLE_MAX_PDF = 10 * 1024 * 1024;
export const LONGUEUR_MAX_QUESTION = 500;
export function validerPdf(buffer, tailleMax = TAILLE_MAX_PDF) {}
export function validerQuestion(question) {}
export function validerId(id) {}
