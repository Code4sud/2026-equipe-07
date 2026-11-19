// Lancer : npm run test:knowledge   (n'a pas besoin des PDF : utilise data/knowledge/, versionné)
import { test } from 'node:test';           // test('nom', fonction) = déclare un test
import assert from 'node:assert/strict';    // assert.xxx = vérifie ; si c'est faux, le test échoue
import { readFileSync } from 'node:fs';
import { ficheMetier } from '../src/lib/server/knowledge.js'; // la fonction qu'on teste

// On lit le vrai fichier pour choisir des exemples qui existent (il évolue avec les validations)
// Object.values : { "barista": {...}, ... } -> [ {...}, {...}, ... ]
const correspondances = Object.values(JSON.parse(readFileSync('data/knowledge/correspondances.json', 'utf-8')));

// Cas normal : correspondance exacte -> on obtient la fiche ROME complète
test('un métier vérifié renvoie sa fiche ROME (Barista -> G1809)', () => {

    const r = ficheMetier('Barista');

    assert.equal(r.statut, 'verifie');                     // equal(a, b) : a doit valoir b
    assert.equal(r.code_rome, 'G1809');
    assert.ok(r.rome?.definition, 'définition présente'); // ok(x) : x doit exister (pas null/vide)
    assert.ok(r.rome?.acces, 'accès présent');
    assert.match(r.rome?.version ?? '', /^ROME 4\.0/); // la version sert à citer la source
});

// La clé normalisée rend la recherche insensible à la casse et aux accents.
test("la recherche ignore majuscules et accents ('BARISTA', 'barista')", () => {

    assert.equal(ficheMetier('BARISTA').code_rome, 'G1809');
    assert.equal(ficheMetier('barista').code_rome, 'G1809');
});

// Règle de fiabilité : pas "verifie" -> pas de fiche ROME, même si un candidat existe.
test('un métier non vérifié ne renvoie AUCUNE fiche ROME', () => {

    const exemple = correspondances.find((c) => c.statut !== 'verifie'); // 1er "a_verifier" ou "aucun"
    
    if (!exemple) return; // tout est validé : rien à tester

    const r = ficheMetier(exemple.intitule);

    assert.notEqual(r.statut, 'verifie'); // notEqual : ne doit PAS valoir 'verifie'
    assert.equal(r.rome, null); // règle de fiabilité
    assert.equal(r.code_rome, null);
});

// Métier absent de correspondances.json : on ne devine pas.
test('un intitulé inconnu renvoie statut "inconnu"', () => {

    const r = ficheMetier('Dompteur de licornes'); // n'existe dans aucun rapport

    assert.equal(r.statut, 'inconnu');
    assert.equal(r.rome, null);
});

// Contrôle de la saisie manuelle : chaque code "verifie" existe vraiment dans rome.json.
test('chaque correspondance "verifie" pointe vers une fiche ROME existante', () => {

    // Attrape une faute de frappe dans un code saisi à la main (ex. "G16O5" au lieu de "G1605").
    for (const c of correspondances.filter((c) => c.statut === 'verifie')) {
        // Message d'erreur : nomme le métier et le code fautif
        assert.ok(ficheMetier(c.intitule).rome, `${c.intitule} -> ${c.code_rome} introuvable dans rome.json`);
    }
});
