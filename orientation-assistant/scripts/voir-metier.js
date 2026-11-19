// =============================================================================
// voir-metier.js — Aide à la validation des correspondances (outil, pas utilisé par l'appli)
// -----------------------------------------------------------------------------
// node scripts/voir-metier.js "Plongeur"
//     -> description du métier dans le rapport + définition et accès de chaque candidat ROME
// node scripts/voir-metier.js --chercher "second degre"
//     -> fiches ROME dont le nom contient ces mots (quand aucun candidat ne convient)
// =============================================================================

import { readFile, readdir } from 'node:fs/promises';
import { extractRapport } from '../src/lib/server/pdf.js';
import { mots, cle, formeMasculine } from '../src/lib/server/normaliser.js';

const rome = JSON.parse(await readFile('data/knowledge/rome.json', 'utf-8'));
const [option, valeur] = process.argv.slice(2); // arguments après "node scripts/voir-metier.js"

// Coupe un long texte pour l'affichage.
/** @param {string | null} t @param {number} n */
const court = (t, n = 300) => (!t ? '(aucun)' : t.length > n ? `${t.slice(0, n)}...` : t);

if (!option) {
    console.log('Usage : node scripts/voir-metier.js "Intitulé"   ou   --chercher "mots"');
    process.exit(1);
}

// --- Mode 1 : chercher une fiche ROME par mots ---------------------------------
if (option === '--chercher') {
    const cherches = mots(valeur ?? ''); // "second degré" -> ["second", "degre"]
    for (const [code, fiche] of Object.entries(rome)) {
        // On cherche dans le libellé et les appellations ; on garde le 1er nom qui contient TOUS les mots.
        const nom = [fiche.libelle, ...fiche.appellations].find((n) => {
                const m = mots(formeMasculine(n));
                return cherches.every((c) => m.includes(c)); // every = tous les mots doivent y être
        });
        if (nom) console.log(`${code}  ${fiche.libelle}   (trouvé via : ${nom})`);
    }
    process.exit(0);
}

// --- Mode 2 : afficher un métier et ses candidats -------------------------------
const intitule = option;
const correspondances = JSON.parse(await readFile('data/knowledge/correspondances.json', 'utf-8'));
const entree = correspondances[cle(intitule)]; // même clé que dans propose-correspondance.js
if (!entree) {
    console.log(`"${intitule}" n'est pas dans correspondances.json (vérifie l'orthographe).`);
    process.exit(1);
}

// 1) Description dans le 1er rapport qui contient ce métier.
for (const f of (await readdir('data/rapports')).filter((x) => x.endsWith('.pdf'))) {
    const rapport = await extractRapport(await readFile(`data/rapports/${f}`), f);
    const metier = rapport.metiers.find((m) => cle(m.intitule) === cle(intitule));
    if (metier) {
        console.log(`\n=== ${metier.intitule}  (zone ${metier.zone}, ${f} p.${metier.page}, présent dans ${entree.nb_rapports} rapport(s))`);
        console.log(`statut actuel : ${entree.statut} / ${entree.methode} / code ${entree.code_rome ?? 'aucun'}`);
        console.log(`\nDANS LE RAPPORT :\n${court(metier.description, 600)}`);
        break; // un seul rapport suffit
    }
}

// 2) Chaque candidat (et le code déjà choisi s'il n'est pas dans les candidats).
const codes = [...new Set([entree.code_rome, ...entree.candidats.map((/** @type {any} */ c) => c.code_rome)].filter(Boolean))];
for (const code of codes) {
    const fiche = rome[code];
    console.log(`\n--- ${code}  ${fiche.libelle}`);
    console.log(`définition : ${court(fiche.definition)}`);
    console.log(`accès      : ${court(fiche.acces)}`);
}