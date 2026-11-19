// =============================================================================
// propose-correspondances.js — Relie les métiers des rapports aux fiches ROME / ONISEP
// -----------------------------------------------------------------------------
// Usage (depuis orientation-assistant/) : node scripts/propose-correspondances.js
// Entrée  : data/rapports/*.pdf, data/knowledge/rome.json, data/knowledge/onisep.json
// Sortie  : data/knowledge/correspondances.json
//
// Pour chaque intitulé trouvé dans les rapports :
//   - même nom qu'une fiche ROME ou ONISEP -> code proposé, statut "verifie" (methode "exacte")
//   - sinon -> 3 candidats classés par score, statut "a_verifier" (un humain choisit)
// Relançable : les lignes avec methode "manuelle" (choisies par une personne) sont conservées
// =============================================================================

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extractRapport } from '../src/lib/server/pdf.js';
import { mots, cle, formeMasculine } from '../src/lib/server/normaliser.js';

const DOSSIER_RAPPORTS = 'data/rapports';
const FICHIER_ROME = 'data/knowledge/rome.json';
const FICHIER_ONISEP = 'data/knowledge/onisep.json';
const FICHIER_SORTIE = 'data/knowledge/correspondances.json';

const NB_CANDIDATS = 3; // nombre de propositions quand il n'y a pas de correspondance exacte


// =============================================================================
// INDEX DES FICHES (pour chercher vite)
// =============================================================================

/**
 * Construit la liste de tous les noms connus, chacun relié à son code ROME
 * Record<clé, valeur> => un objet utilisé comme dictionnaire => clé: code ROME, valeur: objet
 * @param {Record<string, { libelle: string, appellations: string[] }>} rome
 * @param {{ libelle: string, url: string, codes_rome: string[] }[]} onisep  // objets avec 3 propriétés et à la fin une liste de ces objets!
 */
function construireIndex(rome, onisep) {

    /** @type {{ cle: string, mots: string[], code_rome: string | null, libelle: string, via: string, onisep_url: string | null }[]} */
    const noms = [];

    // Object.entries(phrases) transforme l'objet en liste de paires [clé, valeur] : [["K2111", {...}]
    // const [code, p] découpe chaque paire : code = "K2111", et fiche
    for (const [code, fiche] of Object.entries(rome)) {

        // Le libellé de la fiche + toutes ses appellations (autres noms du même métier).
        for (const nom of [fiche.libelle, ...fiche.appellations]) {

            const masc = formeMasculine(nom); // "Agent / Agente d'accueil" -> "Agent d'accueil"
            
            noms.push({ cle: cle(masc), mots: mots(masc), code_rome: code, libelle: nom, via: 'ROME', onisep_url: null });
            // exemple: noms.push({
            //         cle: 'agent accueil',          // résultat de cle(masc)
            //         mots: ['agent', 'accueil'],    // résultat de mots(masc)
            //         code_rome: 'M1601',
            //         libelle: "Agent / Agente d'accueil",
            //         via: 'ROME',
            //         onisep_url: null
            // });
        }
    }

    for (const m of onisep) {

        const masc = formeMasculine(m.libelle);

        // Un métier ONISEP peut avoir 0, 1 ou plusieurs codes ROME => on ne garde le code que s'il est unique
        const code = m.codes_rome.length === 1 ? m.codes_rome[0] : null;

        noms.push({ cle: cle(masc), mots: mots(masc), code_rome: code, libelle: m.libelle, via: 'ONISEP', onisep_url: m.url });
    }

    return noms;
}

/**
 * Score de ressemblance entre deux listes de mots (0 = rien en commun, 1 = identiques)
 * Coefficient de Dice : 2 x mots communs / (total des deux listes)
 * Ex. ["agent","entretien"] et ["agent","entretien","batiment"] -> 2x2 / (2+3) = 0.8
 * @param {string[]} a
 * @param {string[]} b
 */
function score(a, b) {

    if (!a.length || !b.length) return 0;

    const communs = a.filter((m) => b.includes(m)).length; // mots présents dans les deux

    return (2 * communs) / (a.length + b.length);
}


// =============================================================================
// RAPPROCHEMENT D'UN INTITULÉ
// =============================================================================

/**
 * @param {string} intitule intitulé du rapport, ex. "Agent d'accueil"
 * @param {ReturnType<typeof construireIndex>} index
 * @param {Record<string, { libelle: string }>} rome
 */
function rapprocher(intitule, index, rome) {

    const k = cle(intitule);  // ex. "agent accueil"
    const m = mots(intitule); // ex. ["agent", "accueil"]

    // 1) Correspondance exacte : même clé normalisée
    // filter => renvoie tous les éléments qui conviennent en forme liste
    // find => renvoie le premier seulement <=> undefined
    const exacts = index.filter((n) => n.cle === k);  //n => nom
    const exactRome = exacts.find((n) => n.via === 'ROME');
    const exactOnisep = exacts.find((n) => n.via === 'ONISEP');

    // Code ROME : d'abord celui de ROME, sinon celui donné par ONISEP
    // sans ?. => lis la propriété si l'objet existe, sinon renvoie undefined sans planter
    const code = exactRome?.code_rome ?? exactOnisep?.code_rome ?? null;

    // 2) Candidats : les meilleurs scores, un seul par code ROME
    /** @type {Map<string, { code_rome: string, libelle: string, via: string, score: number }>} */
    const parCode = new Map();

    for (const n of index) {

        if (!n.code_rome) continue; // nom sans code ROME : inutilisable comme candidat

        const s = score(m, n.mots);

        if (s === 0) continue; // aucun mot en commun

        const actuel = parCode.get(n.code_rome);

        // Pour un même code, on garde le nom qui ressemble le plus
        if (!actuel || s > actuel.score) {
            parCode.set(n.code_rome, { code_rome: n.code_rome, libelle: n.libelle, via: n.via, score: Math.round(s * 100) / 100 });
        }
    }

    // On garde les 3 meilleurs :
    // [...parCode.values()]            Map -> liste des candidats (un par code ROME)
    // .sort((a, b) => b.score - a.score)  tri du plus grand score au plus petit
    // .slice(0, NB_CANDIDATS)          on garde les cases 0, 1 et 2
    const candidats = [...parCode.values()].sort((a, b) => b.score - a.score).slice(0, NB_CANDIDATS);

    return {
        intitule,
        code_rome: code,
        libelle_rome: code ? rome[code].libelle : null, // pour relire sans ouvrir rome.json
        onisep_url: exactOnisep?.onisep_url ?? null,    // lien seulement si ONISEP a le même nom
        candidats,
        methode: code ? 'exacte' : 'candidat',
        statut: code ? 'verifie' : 'a_verifier'
    };
}

// =============================================================================
// PROGRAMME
// =============================================================================

// 0) Chargement des données préparées par build-knowledge.js
// readFile lit le fichier en texte, JSON.parse le transforme en objet JavaScript
const rome = JSON.parse(await readFile(FICHIER_ROME, 'utf-8'));     // { "K2111": {...}, ... }
const onisep = JSON.parse(await readFile(FICHIER_ONISEP, 'utf-8')); // [ {...}, ... ]
const index = construireIndex(rome, onisep);                        // tous les noms connus (~15 000)

// 1) Tous les intitulés des rapports (sans doublon), avec le nombre de rapports où ils apparaissent
// Map = dictionnaire : clé normalisée -> { intitule, nb_rapports }
/** @type {Map<string, { intitule: string, nb_rapports: number }>} */
const intitules = new Map();

// readdir liste le dossier => on garde seulement les fichiers .pdf
const fichiers = (await readdir(DOSSIER_RAPPORTS)).filter((f) => f.endsWith('.pdf'));

for (const f of fichiers) {

    // On extrait le rapport avec pdf.js (étape 1) : zones + métiers
    const rapport = await extractRapport(await readFile(`${DOSSIER_RAPPORTS}/${f}`), f);

    for (const metier of rapport.metiers) {
        const k = cle(metier.intitule);   // ex. "Barista" -> "barista"
        const deja = intitules.get(k);    // déjà rencontré ? (undefined sinon)

        if (deja) {
            deja.nb_rapports++;     // oui : déjà vu dans un autre rapport, on compte +1
        } else {
            intitules.set(k, { intitule: metier.intitule, nb_rapports: 1 }); // non : 1re fois
        }
    }
}

// 2) Correspondances déjà validées à la main : on ne les écrase pas
// Si correspondances.json existe déjà (script déjà lancé), on le relit ; sinon objet vide {}
/** @type {Record<string, any>} */
const anciennes = existsSync(FICHIER_SORTIE) ? JSON.parse(await readFile(FICHIER_SORTIE, 'utf-8')) : {};

/** @type {Record<string, any>} */
const correspondances = {}; // le nouveau contenu du fichier

// [...intitules] : Map -> liste de paires [clé, valeur] ; .sort() : ordre alphabétique des clés
// (fichier trié = plus facile à relire)
for (const [k, { intitule, nb_rapports }] of [...intitules].sort()) {

    const ancienne = anciennes[k]; // ce qu'il y avait avant pour cet intitulé (ou undefined)

    // "manuelle" = une personne a choisi =>  on garde son choix tel quel
    if (ancienne && ancienne.methode === 'manuelle') {

        // ...ancienne = on recopie tous ses champs, et on met à jour nb_rapports
        correspondances[k] = { ...ancienne, nb_rapports };

    } else {

        // Sinon on (re)calcule => correspondance exacte ou 3 candidats
        correspondances[k] = { ...rapprocher(intitule, index, rome), nb_rapports };
    }
}

// Écriture du fichier ; null, 2 = JSON indenté de 2 espaces (lisible dans VS Code et dans git)
await writeFile(FICHIER_SORTIE, JSON.stringify(correspondances, null, 2));

// 3) Bilan
const liste = Object.values(correspondances); // objet -> liste des correspondances

// Petite fonction : combien de correspondances ont ce statut ?
const compter = (/** @type {string} */ statut) => liste.filter((c) => c.statut === statut).length;

// Affichage dans le terminal
console.log(`${fichiers.length} rapports, ${liste.length} intitulés uniques`);
console.log(`  verifie    : ${compter('verifie')}`);
console.log(`  a_verifier : ${compter('a_verifier')}`);
console.log(`  aucun      : ${compter('aucun')}`);