// Lancer : node --test tests/citations.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGE_REPLI, verifierReponse, numerosCites } from '../src/lib/server/citations.js';

const sources = [
    { n: 1, type: 'rapport', titre: 'Rapport : Barista', page: 9, reference: null, url: null, texte: '…' },
    { n: 2, type: 'rapport', titre: 'Zone 2', page: 9, reference: null, url: null, texte: '…' },
    { n: 4, type: 'ROME', titre: 'ROME G1809 : accès', page: null, reference: 'ROME 4.0', url: 'https://rome/G1809', texte: '…' }
];

test('citations valides : texte gardé, sources sans le champ texte', () => {
    const r = verifierReponse('Tu prépares ça en 2 ans [2]. Diplômes dans ROME [4].', sources);
    assert.equal(r.statut, 'ok');
    assert.deepEqual(r.sources.map((s) => s.n), [2, 4]);
    assert.equal(r.sources[1].url, 'https://rome/G1809');
    assert.equal('texte' in r.sources[0], false);
});

test('seules les sources citées sont renvoyées', () => {
    const r = verifierReponse('Une seule info [1].', sources);
    assert.deepEqual(r.sources.map((s) => s.n), [1]);
});

test('[n] inventé : retiré du texte, la citation valide reste', () => {
    const r = verifierReponse('Info vraie [1]. Info inventée [7].', sources);
    assert.equal(r.statut, 'ok');
    assert.ok(!r.reponse.includes('[7]'));
    assert.deepEqual(r.sources.map((s) => s.n), [1]);
});

test('[3] absent des sources (pas de ROME vérifié) => repli', () => {
    const r = verifierReponse('Définition ROME [3].', sources);
    assert.equal(r.statut, 'insuffisant');
    assert.equal(r.reponse, MESSAGE_REPLI);
});

test('aucune citation => message de repli exact, aucune source', () => {
    const r = verifierReponse('Ce métier est très bien payé.', sources);
    assert.equal(r.statut, 'insuffisant');
    assert.equal(r.reponse, MESSAGE_REPLI);
    assert.deepEqual(r.sources, []);
});

test('réponse vide, ou le modèle dit lui-même ne pas savoir => repli', () => {
    assert.equal(verifierReponse('   ', sources).statut, 'insuffisant');
    assert.equal(verifierReponse(`${MESSAGE_REPLI} [1]`, sources).statut, 'insuffisant');
});

test('citations groupées [1, 2] reconnues', () => {
    assert.deepEqual(numerosCites('Voir [1, 2] puis [4].'), [1, 2, 4]);
    const r = verifierReponse('Voir rapport [1, 2].', sources);
    assert.deepEqual(r.sources.map((s) => s.n), [1, 2]);
});
