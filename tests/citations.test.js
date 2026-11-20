// Lancer : node --test tests/citations.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGE_REPLI, verifierCitations } from '../src/lib/server/citations.js';

const contexte = [
    { n: 1, type: 'rapport', titre: 'Rapport : Barista', texte: '…', page: 9, url: null },
    { n: 2, type: 'rapport', titre: 'Zone 2', texte: '…', page: 9, url: null },
    { n: 4, type: 'ROME', titre: 'ROME G1809 : accès', texte: '…', page: null, url: 'https://rome/G1809' }
];

test('citations valides : texte gardé, sources reconstruites depuis le contexte', () => {
    const r = verifierCitations('Tu prépares ça en 2 ans [2]. Diplômes dans ROME [4].', contexte);
    assert.equal(r.statut, 'ok');
    assert.deepEqual(r.sources.map((s) => s.n), [2, 4]);
    assert.equal(r.sources[1].url, 'https://rome/G1809');
    assert.equal(r.sources[0].page, 9);
});

test('seules les sources citées sont renvoyées', () => {
    const r = verifierCitations('Une seule info [1].', contexte);
    assert.deepEqual(r.sources.map((s) => s.n), [1]);
});

test('[n] inventé : retiré du texte, la citation valide reste', () => {
    const r = verifierCitations('Info vraie [1]. Info inventée [7].', contexte);
    assert.equal(r.statut, 'ok');
    assert.equal(r.invalides, 1);
    assert.ok(!r.reponse.includes('[7]'));
    assert.deepEqual(r.sources.map((s) => s.n), [1]);
});

test('[3] absent du contexte (pas de ROME vérifié) => traité comme invalide', () => {
    const r = verifierCitations('Définition ROME [3].', contexte);
    assert.equal(r.statut, 'insuffisant');
    assert.equal(r.reponse, MESSAGE_REPLI);
});

test('aucune citation => message de repli exact, aucune source', () => {
    const r = verifierCitations('Ce métier est très bien payé.', contexte);
    assert.equal(r.statut, 'insuffisant');
    assert.equal(r.reponse, MESSAGE_REPLI);
    assert.deepEqual(r.sources, []);
});

test('texte vide ou non texte => repli', () => {
    assert.equal(verifierCitations('', contexte).statut, 'insuffisant');
    assert.equal(verifierCitations(null, contexte).statut, 'insuffisant');
    assert.equal(verifierCitations(undefined, contexte).statut, 'insuffisant');
});

test('citations groupées [1, 2] éclatées en [1][2]', () => {
    const r = verifierCitations('Voir rapport [1, 2].', contexte);
    assert.equal(r.statut, 'ok');
    assert.deepEqual(r.sources.map((s) => s.n), [1, 2]);
});
