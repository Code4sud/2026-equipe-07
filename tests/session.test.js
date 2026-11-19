// Lancer : node --test tests/session.test.js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    creerSession, lireSession, supprimerSession, viderSessions, nombreSessions, DUREE_SESSION_MS
} from '../src/lib/server/session.js';

beforeEach(() => viderSessions());

const rapport = { nom: 'x.pdf', zones: [], metiers: [] };

test('créer puis lire une session', () => {
    const sid = creerSession(rapport);
    assert.match(sid, /^[a-f0-9]{64}$/);
    assert.deepEqual(lireSession(sid), rapport);
});

test('deux sessions ont deux sid différents', () => {
    assert.notEqual(creerSession(rapport), creerSession(rapport));
});

test('session expirée après 1 h => null et supprimée', () => {
    const t0 = 1_000_000;
    const sid = creerSession(rapport, t0);
    assert.deepEqual(lireSession(sid, t0 + DUREE_SESSION_MS - 1), rapport);
    assert.equal(lireSession(sid, t0 + DUREE_SESSION_MS), null);
    assert.equal(nombreSessions(), 0);
});

test('supprimerSession efface les données', () => {
    const sid = creerSession(rapport);
    supprimerSession(sid);
    assert.equal(lireSession(sid), null);
});

test('sid absent, inventé ou mal formé => null', () => {
    assert.equal(lireSession(undefined), null);
    assert.equal(lireSession('abc'), null);
    assert.equal(lireSession('0'.repeat(64)), null);
    assert.equal(lireSession({ toString: () => 'x' }), null);
});

test('limite de sessions : la plus ancienne est retirée', () => {
    const premier = creerSession(rapport);
    for (let i = 0; i < 200; i++) creerSession(rapport);
    assert.equal(nombreSessions(), 200);
    assert.equal(lireSession(premier), null);
});
