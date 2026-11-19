// Lancer : node --test tests/validation.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validerPdf, validerQuestion, validerId, nomSur, LONGUEUR_MAX_QUESTION } from '../src/lib/server/validation.js';

const fichier = (contenu, nom = 'rapport.pdf') => new File([contenu], nom, { type: 'application/pdf' });

test('un vrai PDF (%PDF) est accepté', async () => {
    const r = await validerPdf(fichier('%PDF-1.7\n…'));
    assert.equal(r.ok, true);
    assert.equal(r.nom, 'rapport.pdf');
    assert.ok(r.data instanceof Uint8Array);
});

test('un faux PDF (extension .pdf, contenu texte) est refusé', async () => {
    const r = await validerPdf(fichier('<html>pas un pdf</html>', 'faux.pdf'));
    assert.deepEqual([r.ok, r.code], [false, 'TYPE_INVALIDE']);
});

test('un fichier trop gros est refusé avant lecture', async () => {
    const r = await validerPdf(fichier('%PDF-' + 'x'.repeat(2000)), 1000);
    assert.deepEqual([r.ok, r.code], [false, 'TROP_GROS']);
});

test('fichier absent, vide ou pas un File => TYPE_INVALIDE', async () => {
    for (const v of [null, undefined, 'texte', fichier('')]) {
        const r = await validerPdf(v);
        assert.deepEqual([r.ok, r.code], [false, 'TYPE_INVALIDE']);
    }
});

test('nom de fichier : sans dossier ni caractères de contrôle', () => {
    assert.equal(nomSur('../../etc/passwd'), 'passwd');
    assert.equal(nomSur('a\u0000b.pdf'), 'ab.pdf');
    assert.equal(nomSur(''), 'rapport.pdf');
    assert.equal(nomSur('x'.repeat(300)).length, 100);
});

test('question : valide, nettoyée, vide, trop longue, pas du texte', () => {
    assert.deepEqual(validerQuestion('  Quel   diplôme ?  '), { ok: true, question: 'Quel diplôme ?' });
    assert.equal(validerQuestion('   ').ok, false);
    assert.equal(validerQuestion('a'.repeat(LONGUEUR_MAX_QUESTION + 1)).ok, false);
    assert.equal(validerQuestion('a'.repeat(LONGUEUR_MAX_QUESTION)).ok, true);
    assert.equal(validerQuestion({ toString: () => 'x' }).ok, false);
    assert.equal(validerQuestion(null).ok, false);
});

test('id de métier : format z[1-5]-m[n] uniquement', () => {
    assert.equal(validerId('z1-m1'), true);
    assert.equal(validerId('z5-m5'), true);
    for (const v of ['z6-m1', 'z1-m', '../x', 'z1-m1; drop', '', null, 12]) {
        assert.equal(validerId(v), false, String(v));
    }
});
