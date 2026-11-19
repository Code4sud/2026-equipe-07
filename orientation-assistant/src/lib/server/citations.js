// =============================================================================
// citations.js — Anti-hallucination EN CODE (pas seulement dans le prompt)
// -----------------------------------------------------------------------------
// Le modèle n'est pas une source de vérité. Après génération on vérifie :
//   - chaque [n] cité existe dans le contexte réellement fourni
//   - les [n] inventés sont retirés du texte
//   - les sources affichées sont reconstruites PAR LE SERVEUR depuis le contexte
//     (jamais recopiées depuis ce que dit le modèle)
//   - aucune citation valide  ->  message de repli exact
// =============================================================================

export const MESSAGE_REPLI =
    "Je ne dispose pas d'informations suffisamment fiables dans les sources disponibles pour répondre à cette question.";

/**
 * Une entrée du contexte numéroté (construite par rag.js).
 * @typedef {{ n: number, type: 'rapport' | 'ROME' | 'ONISEP', titre: string, texte: string, page: number | null, url: string | null }} SourceContexte
 */

/**
 * Une source affichée au jeune (contrat de POST /api/chat).
 * @typedef {{ n: number, type: string, titre: string, page: number | null, url: string | null }} SourceAffichee
 */

// Les petits modèles écrivent parfois "[1, 2]" ou "[1;2]" : on les éclate en "[1][2]"
const GROUPE = /\[(\d+(?:\s*[,;]\s*\d+)*)\]/g;

/**
 * @param {string | null | undefined} texte réponse brute du modèle
 * @param {SourceContexte[]} contexte contexte réellement fourni au modèle
 * @returns {{ statut: 'ok' | 'insuffisant', reponse: string, sources: SourceAffichee[], invalides: number }}
 */
export function verifierCitations(texte, contexte) {

    const brut = typeof texte === 'string' ? texte.trim() : '';

    if (!brut) return repli(0);

    // numéro -> entrée du contexte (seuls ces numéros sont valides)
    const disponibles = new Map(contexte.map((s) => [s.n, s]));

    const eclate = brut.replace(GROUPE, (_, liste) =>
        liste.split(/[,;]/).map((n) => `[${n.trim()}]`).join('')
    );

    const citees = new Set();
    let invalides = 0;

    const nettoye = eclate
        .replace(/\[(\d+)\]/g, (marque, n) => {
            const numero = Number(n);
            if (disponibles.has(numero)) {
                citees.add(numero);
                return marque;
            }
            invalides++; // [7] alors que le contexte n'a que [1]-[4] : on le retire
            return '';
        })
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/ +([.,;:!?])/g, '$1')
        .trim();

    // Aucune citation valide => on ne montre PAS le texte du modèle
    if (citees.size === 0) return repli(invalides);

    const sources = [...citees]
        .sort((a, b) => a - b)
        .map((n) => {
            const s = disponibles.get(n);
            return { n, type: s.type, titre: s.titre, page: s.page ?? null, url: s.url ?? null };
        });

    return { statut: 'ok', reponse: nettoye, sources, invalides };
}

function repli(invalides) {
    return { statut: 'insuffisant', reponse: MESSAGE_REPLI, sources: [], invalides };
}
