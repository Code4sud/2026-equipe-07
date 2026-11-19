// =============================================================================
// validation.js — Le serveur re-valide TOUT ce qui vient du client
// -----------------------------------------------------------------------------
// Rien de ce qui arrive du navigateur n'est cru : type, taille, signature du PDF,
// question, identifiant de métier. Les messages sont lisibles par le jeune.
// =============================================================================

export const TAILLE_MAX_PDF = 10 * 1024 * 1024; // 10 Mo
export const LONGUEUR_MAX_QUESTION = 500;

// Un PDF commence par "%PDF" (on tolère quelques octets avant, comme la plupart des lecteurs)
const SIGNATURE_PDF = '%PDF';

/**
 * @typedef {{ ok: true, data: Uint8Array, nom: string } | { ok: false, code: 'TYPE_INVALIDE' | 'TROP_GROS', message: string }} ResultatPdf
 */

/**
 * Valide le fichier envoyé par le formulaire (champ `file`).
 * La taille est contrôlée AVANT de lire le contenu en mémoire.
 * @param {unknown} fichier valeur de formData.get('file')
 * @param {number} [tailleMax]
 * @returns {Promise<ResultatPdf>}
 */
export async function validerPdf(fichier, tailleMax = TAILLE_MAX_PDF) {

    if (!(fichier instanceof File) || fichier.size === 0) {
        return { ok: false, code: 'TYPE_INVALIDE', message: 'Choisis un fichier PDF.' };
    }

    if (fichier.size > tailleMax) {
        return {
            ok: false, code: 'TROP_GROS',
            message: `Ce fichier est trop gros (maximum ${Math.round(tailleMax / 1024 / 1024)} Mo).`
        };
    }

    const data = new Uint8Array(await fichier.arrayBuffer());

    // On regarde le CONTENU, pas l'extension ni le type annoncé par le navigateur
    const debut = new TextDecoder('latin1').decode(data.subarray(0, 1024));
    if (!debut.includes(SIGNATURE_PDF)) {
        return { ok: false, code: 'TYPE_INVALIDE', message: "Ce fichier n'est pas un PDF." };
    }

    return { ok: true, data, nom: nomSur(fichier.name) };
}

/** Nom de fichier affichable : sans dossier, sans caractères de contrôle, 100 caractères max */
/** @param {unknown} nom */
export function nomSur(nom) {
    const base = String(nom ?? '').split(/[\\/]/).pop() ?? '';
    // eslint-disable-next-line no-control-regex
    return base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100) || 'rapport.pdf';
}

/**
 * @param {unknown} question
 * @returns {{ ok: true, question: string } | { ok: false, message: string }}
 */
export function validerQuestion(question) {

    if (typeof question !== 'string') {
        return { ok: false, message: 'Pose ta question avec des mots.' };
    }

    // On retire les caractères de contrôle et on réduit les espaces
    // eslint-disable-next-line no-control-regex
    const propre = question.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

    if (!propre) {
        return { ok: false, message: "Ta question est vide." };
    }

    if (propre.length > LONGUEUR_MAX_QUESTION) {
        return { ok: false, message: `Ta question est trop longue (maximum ${LONGUEUR_MAX_QUESTION} caractères).` };
    }

    return { ok: true, question: propre };
}

/** Format des identifiants créés par pdf.js : « z2-m3 » */
/** @type {(id: unknown) => id is string} */
export const validerId = (id) => typeof id === 'string' && /^z[1-5]-m\d{1,2}$/.test(id);
