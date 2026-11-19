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
import { cle } from './normaliser.js';

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
 * Pour les tests => forcer une relecture des fichiers au prochain appel
 */
export function viderCache() {
    donnees = null;
}