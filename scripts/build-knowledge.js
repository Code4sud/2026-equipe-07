// =============================================================================
// build-knowledge.js — Transforme l'open data ROME + ONISEP en 2 fichiers JSON
// -----------------------------------------------------------------------------
// Usage (depuis orientation-assistant/) : node scripts/build-knowledge.js
// Entrée  : data/open-data/rome/*.csv     (zip ROME 4.0 décompressé)
//           data/open-data/onisep.csv     (Idéo-Métiers ONISEP)
// Sortie  : data/knowledge/rome.json      { "K2111": { libelle, appellations, definition, acces, url, version } }
//           data/knowledge/onisep.json    [ { libelle, url, codes_rome } ]
// Lancé une seule fois, à la main : l'appli ne lit que les JSON (pas d'API pendant la démo!!).
// =============================================================================

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const DOSSIER_ROME = 'data/open-data/rome';
const FICHIER_ONISEP = 'data/open-data/onisep.csv';
const DOSSIER_SORTIE = 'data/knowledge';

// Les noms des fichiers ROME contiennent le numéro de version ("v462")
// À changer ici si on télécharge une version plus récente!!
const SUFFIXE_ROME = 'v462_utf8.csv';

// Un code ROME complet = 1 lettre + 4 chiffres (ex. K2111)
// Le CSV ONISEP contient parfois des codes incomplets ("A15") => on les écarte
const CODE_ROME = /^[A-N]\d{4}$/;

// =============================================================================
// LECTURE CSV (sans dépendance npm)
// =============================================================================

/**
 * Découpe un texte CSV en lignes de colonnes
 * Gère les valeurs entre guillemets, qui peuvent contenir le séparateur ou des "" (= un guillemet)
 * @param {string} texte contenu du fichier
 * @param {string} separateur ',' pour ROME, ';' pour ONISEP
 * @returns {string[][]}
 */
function lireCsv(texte, separateur) {

    const lignes = [];
    let ligne = [];  // colonnes de la ligne en cours
    let valeur = ''; // colonne en cours
    let entreGuillemets = false;

    // On enlève le BOM (caractère invisible au début du fichier ONISEP)
    texte = texte.replace(/^\uFEFF/, '');

    for (let i = 0; i < texte.length; i++) {

        const c = texte[i];  // c=> caractère

        if (entreGuillemets) {

            if (c === '"' && texte[i + 1] === '"') {

                    valeur += '"'; // "" dans une valeur = un vrai guillemet
                    i++;           // on saute le 2e guillemet
            } else if (c === '"') {

                    entreGuillemets = false; // fin de la valeur entre guillemets

            } else {
                    valeur += c; // tout le reste est du texte, même le séparateur
            }

        } else if (c === '"') {
            entreGuillemets = true; // début d'une valeur entre guillemets

        } else if (c === separateur) {

            ligne.push(valeur); // fin de colonne
            valeur = '';

        } else if (c === '\n') {  //retour à la ligne => Fin de ligne sous Linux et Mac

            ligne.push(valeur); // fin de ligne
            lignes.push(ligne);
            ligne = [];
            valeur = '';

        } else if (c !== '\r') { // retour chariot => Sous Windows, chaque fin de ligne est \r\n => les deux à la suite
                valeur += c;   // \r ignoré (fins de ligne Windows)
        }
    }

    // Dernière ligne si le fichier ne finit pas par un retour à la ligne
    if (valeur || ligne.length) {
        ligne.push(valeur);
        lignes.push(ligne);
    }

    return lignes;
}

/**
 * Lit un CSV et renvoie un objet par ligne : { nomColonne: valeur }
 * @param {string} chemin
 * @param {string} separateur
 * @returns {Promise<Record<string, string>[]>} // renvoie une promesse  qui donnera un tableau d'objets!
 */
async function lireCsvObjets(chemin, separateur) {

    const [entetes, ...lignes] = lireCsv(await readFile(chemin, 'utf-8'), separateur);

    return lignes
        .filter((l) => l.length > 1) // ignore les lignes vides
        .map((l) => Object.fromEntries(entetes.map((nom, i) => [nom, l[i] ?? ''])));
}

// Le CSV ROME double les apostrophes ("d''emploi") =>  on les remet simples
/** @param {string} texte */
const apostrophes = (texte) => texte.replace(/''/g, "'").trim();

// =============================================================================
// ONISEP
// =============================================================================

/**
 * Le CSV ONISEP a une ligne par PUBLICATION : un même métier peut apparaître plusieurs fois.
 * On regroupe par libellé, et on garde à part le lien "fiche ROME" de chaque code.
 */
async function construireOnisep() {

    const lignes = await lireCsvObjets(FICHIER_ONISEP, ';'); //=> await, car c'est une promesse

    /** @type {Map<string, { libelle: string, url: string, codes_rome: string[] }>} */
    const metiers = new Map(); // libellé -> métier (sans doublon)

    /** @type {Map<string, string>} */
    const liensRome = new Map(); // code ROME -> lien fiche France Travail (fourni par ONISEP)

    for (const l of lignes) {

        const libelle = l['libellé métier'].trim();
        if (!libelle) continue;

        // "K1301 | K1302" -> ["K1301", "K1302"] ; on garde seulement les codes complets
        const codes = l['code ROME'].split('|').map((c) => c.trim()).filter((c) => CODE_ROME.test(c));

        // Les liens ROME sont aussi séparés par "|" ; le code est à la fin de l'URL
        for (const lien of l['lien ROME'].split('|').map((u) => u.trim())) {

            const code = lien.match(/\/([A-N]\d{4})$/)?.[1];
            if (code && !liensRome.has(code)) liensRome.set(code, lien);
        }

        const existant = metiers.get(libelle);

        if (existant) {

            // Déjà vu : on ajoute seulement les codes manquants.
            for (const c of codes) {
                if (!existant.codes_rome.includes(c)) {
                    existant.codes_rome.push(c);
                }
            }
        } else {

            metiers.set(libelle, { libelle, url: l['lien site onisep.fr'].trim(), codes_rome: codes });
        }
    }

    return { onisep: [...metiers.values()], liensRome };
}


// =============================================================================
// ROME
// =============================================================================

// reconstruit le nom complet du fichier!
/** @param {string} nom ex. 'referentiel_code_rome' */
const fichierRome = (nom) => `${DOSSIER_ROME}/unix_${nom}_${SUFFIXE_ROME}`;

/**
 * @param {Map<string, string>} liensRome liens fiche ROME trouvés dans le CSV ONISEP
 */
async function construireRome(liensRome) {

    // version.txt contient "Numero de version : 62" et "Date de publication : 19/10/2026"
    const versionTxt = await readFile(`${DOSSIER_ROME}/version.txt`, 'utf-8');

    // (\S+) => 1 ou plusieurs caractères qui ne sont pas des espaces!
    // /i => ignore majuscule et minuscule
    // si match a trouvé quelque chose => prend la case [1], le groupe capturé
    // si le résultat = undefined => '?'
    const numero = versionTxt.match(/version\s*:\s*(\S+)/i)?.[1] ?? '?';
    const date = versionTxt.match(/publication\s*:\s*(\S+)/i)?.[1] ?? '?';
    const version = `ROME 4.0 v${numero} du ${date}`;

    /** @type {Record<string, { libelle: string, appellations: string[], definition: string | null, acces: string | null, url: string | null, version: string }>} */
    const rome = {};

    // 1) Les fiches : un code ROME = une fiche avec son libellé
    for (const l of await lireCsvObjets(fichierRome('referentiel_code_rome'), ',')) {
        rome[l.code_rome] = {
                libelle: apostrophes(l.libelle_rome),
                appellations: [],
                definition: null, // rempli à l'étape 3
                acces: null,      // rempli à l'étape 3
                url: liensRome.get(l.code_rome) ?? null, // lien seulement s'il vient des données
                version
        };
    }

    // 2) Les appellations : les autres noms du métier (ex. "Barista" -> code ROME du service en café)
    for (const l of await lireCsvObjets(fichierRome('referentiel_appellation'), ',')) {

        // dans le fichier: unix_referentiel_appellation_v46 │ "code_ogr","libelle_appellation_long","libelle_appellation_co 2_utf8.csv
        rome[l.code_rome]?.appellations.push(apostrophes(l.libelle_appellation_long));
    }

    // 3) Les textes : "definition" et "acces_metier", découpés en phrases numérotées
    /** @type {Record<string, { definition: [number, string][], acces: [number, string][] }>} */
    const phrases = {};

    for (const l of await lireCsvObjets(fichierRome('texte'), ',')) {
        const type = l.libelle_type_texte === 'definition' ? 'definition' : l.libelle_type_texte === 'acces_metier' ? 'acces' : null;
        
        if (!type || !rome[l.code_rome]) continue;

        phrases[l.code_rome] ??= { definition: [], acces: [] };
        phrases[l.code_rome][type].push([Number(l.position_phrase), apostrophes(l.libelle_texte)]);
    }

    // On remet les phrases dans l'ordre (position_phrase) et on les colle en un paragraphe
    // Object.entries(phrases) transforme l'objet en liste de paires [clé, valeur] : [["K2111", {...}]
    // const [code, p] découpe chaque paire : code = "K2111", et p = { definition: [...], acces: [...] }
    // dans le fichier: unix_texte_v462_utf8.csv
    for (const [code, p] of Object.entries(phrases)) {

        const coller = (/** @type {[number, string][]} */ liste) =>

            // sort((a, b) => a[0] - b[0]) => trie par numéro de phrase => [[2,"B"],[1,"A"]] → [[1,"A"],[2,"B"]]
            // .map(([, t]) => t) => Garde seulement le texte => → ["A", "B"]
            // join => "A B"
            liste.length
                ? liste
                      .sort((a, b) => a[0] - b[0])                      // phrases dans l'ordre (position_phrase)
                      .map(([, t]) => (/[.!?]$/.test(t) ? t : `${t}.`)) // ajoute un point si la phrase n'en a pas
                      .join(' ')                                        // colle avec un espace
                : null;                                                 // pas de phrase -> null (on n'invente rien)
        
        rome[code].definition = coller(p.definition);
        rome[code].acces = coller(p.acces);
    }

    return rome;
}

// =============================================================================
// PROGRAMME
// =============================================================================

const { onisep, liensRome } = await construireOnisep();
const rome = await construireRome(liensRome);

await mkdir(DOSSIER_SORTIE, { recursive: true });

// JSON indenté (2 espaces) => lisible et relisible dans git
await writeFile(`${DOSSIER_SORTIE}/rome.json`, JSON.stringify(rome, null, 2));
await writeFile(`${DOSSIER_SORTIE}/onisep.json`, JSON.stringify(onisep, null, 2));

// Petit bilan pour vérifier que tout s'est bien passé
const fiches = Object.values(rome);

console.log(`rome.json   : ${fiches.length} fiches (${fiches[0]?.version})`);
console.log(`  - avec définition : ${fiches.filter((f) => f.definition).length}`);
console.log(`  - avec accès      : ${fiches.filter((f) => f.acces).length}`);
console.log(`  - avec lien       : ${fiches.filter((f) => f.url).length}`);

console.log(`onisep.json : ${onisep.length} métiers (${onisep.filter((m) => m.codes_rome.length).length} avec code ROME)`);