// =============================================================================
// voir-metier.js — Aide à la validation des correspondances (outil, pas utilisé par l'appli)
// -----------------------------------------------------------------------------
// node scripts/voir-metier.js "Plongeur"
//     -> description du métier dans le rapport + définition et accès de chaque candidat ROME
// node scripts/voir-metier.js --chercher "second degre"
//     -> fiches ROME dont le nom contient ces mots (quand aucun candidat ne convient)
// =============================================================================

import { readFile, readdir } from 'node:fs/promises';
import { extractRapport } from '../src/lib/server/pdf.js';                    // étape 1 : lecture des PDF
import { mots, cle, formeMasculine } from '../src/lib/server/normaliser.js'; // même normalisation partout

// Toutes les fiches ROME : { "K2111": { libelle, appellations, definition, acces, ... }, ... }
const rome = JSON.parse(await readFile('data/knowledge/rome.json', 'utf-8'));

// process.argv = la ligne de commande découpée en mots :
// ["node", "scripts/voir-metier.js", "--chercher", "second degre"]
// slice(2) saute les 2 premiers -> option = "--chercher", valeur = "second degre"
const [option, valeur] = process.argv.slice(2);

// Coupe un long texte pour l'affichage.
// t vide/null -> "(aucun)" ; t plus long que n -> n premiers caractères + "..." ; sinon t tel quel
/** @param {string | null} t @param {number} n */
const court = (t, n = 300) => (!t ? '(aucun)' : t.length > n ? `${t.slice(0, n)}...` : t);

// Aucun argument : on rappelle comment utiliser l'outil, puis on s'arrête.
if (!option) {
    console.log('Usage : node scripts/voir-metier.js "Intitulé"   ou   --chercher "mots"');
    process.exit(1); // 1 = arrêt avec erreur
}

// --- Mode 1 : chercher une fiche ROME par mots ---------------------------------
if (option === '--chercher') {

    const cherches = mots(valeur ?? ''); // "second degré" -> ["second", "degre"]

    // On parcourt les ~1900 fiches ROME : [code, fiche] = ["K2107", {...}]
    for (const [code, fiche] of Object.entries(rome)) {

        // On cherche dans le libellé et les appellations ; on garde le 1er nom qui contient TOUS les mots.
        const nom = [fiche.libelle, ...fiche.appellations].find((n) => {

            const m = mots(formeMasculine(n));                // "Professeur / Professeure de lycée" -> ["professeur", "lycee"]
            return cherches.every((c) => m.includes(c)); // every = tous les mots doivent y être
        });

        // Trouvé : on affiche le code, le nom officiel, et le nom qui a correspondu.
        if (nom) console.log(`${code}  ${fiche.libelle}   (trouvé via : ${nom})`);
    }

    process.exit(0); // 0 = arrêt normal (le mode 2 ne s'exécute pas)
}

// --- Mode 2 : afficher un métier et ses candidats -------------------------------
const intitule = option; // ici, le 1er argument est l'intitulé, ex. "Plongeur"
const correspondances = JSON.parse(await readFile('data/knowledge/correspondances.json', 'utf-8'));
const entree = correspondances[cle(intitule)]; // même clé que dans propose-correspondances.js

// Intitulé absent : faute de frappe probable.
if (!entree) {
    console.log(`"${intitule}" n'est pas dans correspondances.json (vérifie l'orthographe).`);
    process.exit(1);
}

// 1) Description dans le 1er rapport qui contient ce métier
for (const f of (await readdir('data/rapports')).filter((x) => x.endsWith('.pdf'))) {
    const rapport = await extractRapport(await readFile(`data/rapports/${f}`), f);

    // Le métier est-il dans ce rapport ? (comparaison sur la clé normalisée)
    const metier = rapport.metiers.find((m) => cle(m.intitule) === cle(intitule));

    if (metier) {

        // En-tête : zone, fichier, page, nombre de rapports où il apparaît
        console.log(`\n=== ${metier.intitule}  (zone ${metier.zone}, ${f} p.${metier.page}, présent dans ${entree.nb_rapports} rapport(s))`);
        
        // Ce qui est actuellement écrit dans correspondances.json
        console.log(`statut actuel : ${entree.statut} / ${entree.methode} / code ${entree.code_rome ?? 'aucun'}`);
        
        // Le texte que le jeune a lu (600 caractères max)
        console.log(`\nDANS LE RAPPORT :\n${court(metier.description, 600)}`);
        
        break; // un seul rapport suffit
    }
}

// 2) Chaque candidat (et le code déjà choisi s'il n'est pas dans les candidats)
// [code choisi, code candidat 1, 2, 3] -> filter(Boolean) enlève les null -> new Set enlève les doublons
const codes = [...new Set([entree.code_rome, ...entree.candidats.map((/** @type {any} */ c) => c.code_rome)].filter(Boolean))];

for (const code of codes) {
    
    const fiche = rome[code];

    console.log(`\n--- ${code}  ${fiche.libelle}`);           // nom officiel (à recopier dans libelle_rome)
    console.log(`définition : ${court(fiche.definition)}`); // "c'est quoi concrètement ?"
    console.log(`accès      : ${court(fiche.acces)}`);      // "quel diplôme ?"
}
