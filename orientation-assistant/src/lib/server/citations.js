// =============================================================================

// citations.js — Vérifie les citations [n] d'une réponse du modèle
// -----------------------------------------------------------------------------
// Anti-hallucination EN CODE (pas seulement dans le prompt) :
//   - on garde seulement les [n] qui correspondent à une source réellement fournie ;
//   - on renvoie seulement les sources citées ;
//   - aucune citation valide -> message de repli ("je ne sais pas").
// =============================================================================

// Message exact demandé par l'équipe (prompt_message_2) quand on ne peut pas répondre.
// Entre guillemets doubles "..." car le texte contient une apostrophe (d'informations).

export const MESSAGE_REPLI =
    "Je ne dispose pas d'informations suffisamment fiables dans les sources disponibles pour répondre à cette question.";

/**
 * Une source envoyée au modèle (construite par rag.js)
 * @typedef {object} Source
 * @property {number} n numéro cité dans la réponse : [1], [2]...
 * @property {'rapport' | 'ROME'} type
 * @property {string} titre ex. "Rapport des Possibles — Barista"
 * @property {number | null} page page du PDF (sources "rapport")
 * @property {string | null} reference ex. "ROME 4.0 v62 du 19/10/2026 — G1809"
 * @property {string | null} url lien officiel, seulement s'il vient des données
 * @property {string} texte contenu donné au modèle
 */

/**
 * Résultat de la vérification.
 * Omit<Source, 'texte'> = une Source SANS sa propriété "texte".
 * @typedef {{ statut: 'ok' | 'insuffisant', reponse: string, sources: Omit<Source, 'texte'>[] }} Verification
 */

/**
 * Trouve les numéros cités : "[1]", "[1, 3]", "[2][4]" -> [1, 3, 2, 4]
 * @param {string} texte
 * @returns {number[]}
 */
export function numerosCites(texte) {

    const numeros = []; // liste remplie au fur et à mesure

    // Regex : \[ ... \] = des crochets ; (\d+(?:\s*,\s*\d+)*) = groupe capturé : un nombre,
    // puis éventuellement ", nombre" répété. Ex. elle trouve "[1]" et "[1, 3]", pas "[a]".
    // matchAll renvoie TOUS les blocs trouvés ; bloc[0] = "[1, 3]", bloc[1] = "1, 3" (le groupe).
    for (const bloc of texte.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) {

        // "1, 3".split(',') -> ["1", " 3"] ; trim() enlève l'espace ; Number("3") -> 3
        for (const n of bloc[1].split(',')) numeros.push(Number(n.trim()));
    }
    return numeros; // ex. [1, 3]
}

/**
 * Vérifie une réponse du modèle par rapport aux sources fournies
 * @param {string} reponse texte renvoyé par le modèle
 * @param {Source[]} sources sources réellement envoyées dans le contexte
 * @returns {Verification}
 */
export function verifierReponse(reponse, sources) {

    const texte = reponse.trim(); // enlève les espaces / retours à la ligne au début et à la fin

    // Les numéros qui existent vraiment. Set = liste sans doublon => avec .has() rapide
    const valides = new Set(sources.map((s) => s.n)); // ex. {1, 2, 3, 4}

    // Le modèle a lui-même dit qu'il ne savait pas -> on renvoie le message exact
    // (!texte = réponse vide)
    if (!texte || texte.includes('Je ne dispose pas d')) {
        return { statut: 'insuffisant', reponse: MESSAGE_REPLI, sources: [] };
    }

    // On retire les citations inventées : [7] alors qu'il n'y a que 4 sources !!
    // replace(regex, fonction) : pour CHAQUE bloc [ ... ] trouvé, la fonction décide par quoi le remplacer
    // bloc  = le texte trouvé, ex. "[2, 9]"
    // liste = le groupe entre parenthèses de la regex, ex. "2, 9"
    const nettoye = texte.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (/** @type {string} */ bloc, /** @type {string} */ liste) => {

        // "2, 9" -> [2, 9] -> on garde ceux qui existent -> [2]
        const gardes = liste.split(',').map((n) => Number(n.trim())).filter((n) => valides.has(n));

        // Au moins un bon numéro -> "[2]" ; aucun -> "" (le bloc disparaît du texte)
        return gardes.length ? `[${gardes.join(', ')}]` : ''; // bloc entièrement faux -> supprimé
    });

    // Numéros valides réellement cités (sans doublon, dans l'ordre des sources)
    // On relit le texte NETTOYÉ => il ne reste que des numéros valides
    const cites = new Set(numerosCites(nettoye));

    // Aucune citation valide => la réponse ne s'appuie sur rien de vérifiable -> repli
    if (cites.size === 0) {
        return { statut: 'insuffisant', reponse: MESSAGE_REPLI, sources: [] };
    }

    return {
        
        statut: 'ok',

        // [ \t]{2,} = 2 espaces (ou tabulations) ou plus -> remplacés par 1 espace
        reponse: nettoye.replace(/[ \t]{2,}/g, ' '), // espaces doubles laissés par les [n] supprimés

        // Sources affichées = celles citées, SANS le texte complet (le navigateur n'en a pas besoin).
        // filter : garde les sources citées ; map : copie chaque source sans "texte"
        // ({ texte: _texte, ...reste }) => met "texte" de côté, "reste" = toutes les autres propriétés
        sources: sources.filter((s) => cites.has(s.n)).map(({ texte: _texte, ...reste }) => reste)
    };
}
