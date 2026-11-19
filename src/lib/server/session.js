// =============================================================================
// session.js — Sessions EN MÉMOIRE : Map { sid -> rapport extrait }
// -----------------------------------------------------------------------------
// - ni base de données, ni fichier : tout disparaît au redémarrage du serveur
// - expiration 1 h après la création (le PDF lui-même n'est jamais conservé)
// - le sid est aléatoire (32 octets) et voyage dans un cookie httpOnly
// =============================================================================

import { randomBytes } from 'node:crypto';

export const DUREE_SESSION_MS = 60 * 60 * 1000; // 1 h
export const COOKIE_SID = 'sid';
const MAX_SESSIONS = 200;                       // garde-fou mémoire
const PURGE_TOUTES_LES_MS = 5 * 60 * 1000;

/** @typedef {import('./pdf.js').Rapport} Rapport */
/** @typedef {{ rapport: Rapport, expire: number }} Entree */

// globalThis : en dev, Vite recharge les modules ; sans ça les sessions seraient perdues
// (any : on range nos propres variables dans l'objet global, VS Code ne les connaît pas)
const global = /** @type {any} */ (globalThis);

/** @type {Map<string, Entree>} */
const sessions = (global.__sessionsOrientation ??= new Map());

// Un seul minuteur de purge, même après rechargement à chaud. unref() => n'empêche pas l'arrêt de Node
if (!global.__purgeSessionsOrientation) {
    global.__purgeSessionsOrientation = setInterval(() => purger(), PURGE_TOUTES_LES_MS);
    global.__purgeSessionsOrientation.unref();
}

/** Un sid valide = 64 caractères hexadécimaux (ce que génère creerSession) */
/** @type {(sid: unknown) => sid is string} */
export const sidValide = (sid) => typeof sid === 'string' && /^[a-f0-9]{64}$/.test(sid);

/**
 * @param {Rapport} rapport rapport extrait (sortie de pdf.js)
 * @param {number} [maintenant] injectable pour les tests
 * @returns {string} sid à mettre dans le cookie
 */
export function creerSession(rapport, maintenant = Date.now()) {

    purger(maintenant);

    // Trop de sessions : on retire la plus ancienne (la Map garde l'ordre d'insertion)
    while (sessions.size >= MAX_SESSIONS) {
        const plusAncien = sessions.keys().next().value; // 1re clé = la plus ancienne
        if (plusAncien) sessions.delete(plusAncien);
    }

    const sid = randomBytes(32).toString('hex');
    sessions.set(sid, { rapport, expire: maintenant + DUREE_SESSION_MS });
    return sid;
}

/**
 * @param {string | undefined} sid
 * @param {number} [maintenant]
 * @returns {Rapport | null} le rapport, ou null (sid absent, inconnu ou expiré)
 */
export function lireSession(sid, maintenant = Date.now()) {

    if (!sidValide(sid)) return null;

    const entree = sessions.get(sid);
    if (!entree) return null;

    if (entree.expire <= maintenant) {
        sessions.delete(sid); // expirée : on la supprime tout de suite
        return null;
    }

    return entree.rapport;
}

/**
 * Bouton « supprimer mes données »
 * @param {string | undefined} sid
 */
export function supprimerSession(sid) {
    if (typeof sid === 'string') sessions.delete(sid);
}

/** Supprime toutes les sessions expirées */
export function purger(maintenant = Date.now()) {
    for (const [sid, entree] of sessions) {
        if (entree.expire <= maintenant) sessions.delete(sid);
    }
}

/** Pour les tests */
export function viderSessions() {
    sessions.clear();
}

export const nombreSessions = () => sessions.size;
