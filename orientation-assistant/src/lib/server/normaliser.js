// =============================================================================
// normaliser.js — Normalisation des intitulés de métiers
// -----------------------------------------------------------------------------
// Partagé par scripts/propose-correspondances.js (préparation) et knowledge.js (appli) :
// les deux doivent calculer EXACTEMENT la même clé pour un même intitulé.
// =============================================================================

// Petits mots qui n'aident pas à comparer deux intitulés
const MOTS_VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'en', 'et', 'a', 'au', 'aux', 'un', 'une', 'pour', 'dans', 'sur', 'ou']);

/**
 * Transforme un intitulé en liste de mots comparables
 * "Agent d'Accueil" -> ["agent", "accueil"]
 * @param {string} texte
 * @returns {string[]}
 */
export function mots(texte) {
    return texte
        .toLowerCase()                          // "Agent" -> "agent"
        .normalize('NFD')                       // "é" devient "e" + accent séparé...
        .replace(/[\u0300-\u036f]/g, '')        // ...et on supprime l'accent
        .replace(/œ/g, 'oe')                    // "manœuvre" -> "manoeuvre"
        .replace(/[^a-z0-9]+/g, ' ')            // ponctuation, apostrophes, "/" -> espace
        .split(' ')                             // texte -> liste de mots
        .filter((m) => m && !MOTS_VIDES.has(m)) // mot pas vide et n'est pas dans la liste des mots vides => enlève les vides et les petits mots
        .map((m) => (m.length > 3 ? m.replace(/[sx]$/, '') : m)); // pluriel simple : "agents" -> "agent"
}

/**
 * Clé de comparaison : les mots normalisés, collés
 * "Agent d'Accueil" -> "agent accueil"
 * @param {string} texte
 */
export const cle = (texte) => mots(texte).join(' ');

/**
 * ROME et ONISEP écrivent "Masculin / Féminin complément" :
 * "Agent / Agente d'accueil" -> "Agent d'accueil"
 * On reconstruit la forme masculine pour la comparer aux intitulés des rapports
 * « Agent / Agente d'accueil » donnerait les mots « agent agente accueil » et ne correspondrait jamais à « Agent d'accueil » du rapport!!
 * @param {string} libelle
 * @returns {string}
 */
export function formeMasculine(libelle) {

    const parties = libelle.split(' / ');

    if (parties.length !== 2) return libelle;      // pas de forme "X / Y" : on garde tel quel

    const masculin = parties[0].trim().split(' '); // ex. ["Agent"]
    const feminin = parties[1].trim().split(' ');  // ex. ["Agente", "d'accueil"]

    // Le complément = ce qui suit le féminin (autant de mots que le masculin)
   
    const complement = feminin.slice(masculin.length).join(' '); // ex. "d'accueil"

    // "Agent" + " " + "d'accueil" => "Agent d'accueil"
    return `${masculin.join(' ')} ${complement}`.trim();         // ex. "Agent d'accueil"
}