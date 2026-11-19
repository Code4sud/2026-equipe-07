// =============================================================================
// knowledge.js — Accès aux données ROME / ONISEP préparées par les scripts
// -----------------------------------------------------------------------------
// Lit data/knowledge/rome.json et correspondances.json UNE fois (au 1er appel),
// puis répond à : "pour ce métier du rapport, quelle fiche ROME peut-on citer ?"
//
// Règle de fiabilité : on ne renvoie une fiche ROME que si la correspondance
// a le statut "verifie". Sinon -> fiche: null, et l'assistant le dira au jeune.
// =============================================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cle, formeMasculine } from './normaliser.js';

// Chemin depuis le dossier où l'appli est lancée => orientation-assistant/ !!
const DOSSIER = resolve('data/knowledge');

/**
 * Fiche ROME telle que construite par scripts/build-knowledge.js => environ ligne 190
 * @typedef {{ libelle: string, appellations: string[], definition: string | null, acces: string | null, url: string | null, version: string }} FicheRome
 */

/**
 * Une ligne de correspondances.json.
 * @typedef {{ intitule: string, code_rome: string | null, libelle_rome: string | null, onisep_url: string | null, methode: string, statut: 'verifie' | 'a_verifier' | 'aucun' }} Correspondance
*/

/**
 * Ce que renvoie ficheMetier()
 * @typedef {object} ResultatFiche  // création un objet  d'un type "ResultatFiche"
 * @property {'verifie' | 'a_verifier' | 'aucun' | 'inconnu'} statut "inconnu" = intitulé absent de correspondances.json
 * @property {string | null} code_rome
 * @property {FicheRome | null} rome fiche ROME, seulement si statut = "verifie"
 * @property {string | null} onisep_url lien onisep.fr, seulement si statut = "verifie"
 */

// Cache : null tant que les fichiers ne sont pas lus
/** @type {{ rome: Record<string, FicheRome>, correspondances: Record<string, Correspondance> } | null} */
let donnees = null;

// Lit les fichiers au 1er appel seulement (rome.json fait ~3 Mo => on évite de le relire à chaque question)
function charger() {

    if (!donnees) {

        donnees = {
            rome: JSON.parse(readFileSync(`${DOSSIER}/rome.json`, 'utf-8')),
            correspondances: JSON.parse(readFileSync(`${DOSSIER}/correspondances.json`, 'utf-8'))
        };
    }
    
    return donnees; // les appels suivants réutilisent le cache
}

/**
 * Cherche la fiche ROME d'un métier du rapport
 * @param {string} intitule intitulé tel qu'extrait du PDF, ex. "Barista"
 * @returns {ResultatFiche}     => ficheMetier() renvoie un objet de cette forme
 */
export function ficheMetier(intitule) {

    const { rome, correspondances } = charger();

    // Même clé que dans propose-correspondances.js (normaliser.js partagé)
    const c = correspondances[cle(intitule)];

    // Intitulé jamais vu (nouveau rapport ?) =>  on ne devine pas!!
    if (!c) {
        return { statut: 'inconnu', code_rome: null, rome: null, onisep_url: null };
    }

    // La fiche ROME du code choisi => undefined si pas de code, ou code absent de rome.json
    const fiche = c.code_rome ? rome[c.code_rome] : undefined;

    // Pas vérifié, ou code absent de rome.json => on ne cite pas ROME
    if (c.statut !== 'verifie' || !fiche) {

        return { statut: c.statut, code_rome: null, rome: null, onisep_url: null };
    }

    // Vérifié => on renvoie tout ce que rag.js pourra citer
    return { statut: 'verifie', code_rome: c.code_rome, rome: fiche, onisep_url: c.onisep_url };
}

/**
 * Cherche dans rome.json les fiches dont un intitulé (libellé ou appellation) apparaît dans la question,
 * ou contient le terme entre guillemets. Renvoie leurs appellations (métiers proches).
 * @param {string} question
 * @param {number} [max] nombre maximum de fiches
 * @returns {{ code: string, libelle: string, appellations: string[], version: string }[]}
 */
export function metiersProches(question, max = 3) {
    const { rome } = charger();
    const q = cle(question);
    const citation = question.match(/["«“]([^"»”]{3,80})["»”]/)?.[1];
    const terme = citation ? cle(citation) : '';
    if (!q) return [];

    const trouves = [];
    for (const [code, fiche] of Object.entries(rome)) {
        let score = 0;
        for (const nom of [fiche.libelle, ...(fiche.appellations ?? [])]) {
            const c = cle(formeMasculine(nom));
            if (c.length < 4) continue;
            if (` ${q} `.includes(` ${c} `)) score += 2 + c.split(' ').length; // l'intitulé est dans la question
            else if (terme && ` ${c} `.includes(` ${terme} `)) score += 1;  // la question est dans l'intitulé
        }
        if (score) trouves.push({ score, code, libelle: fiche.libelle, appellations: fiche.appellations ?? [], version: fiche.version });
    }
    return trouves.sort((a, b) => b.score - a.score).slice(0, max);
}

/**
 * Pour les tests => forcer une relecture des fichiers au prochain appel
 */
export function viderCache() {
    donnees = null;
}