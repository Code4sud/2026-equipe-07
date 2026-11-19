// =============================================================================
// reports.js — Garde les rapports importés EN MÉMOIRE pendant 1 heure
// -----------------------------------------------------------------------------
// Rien n'est écrit sur le disque : le rapport d'un jeune disparaît après 1 h,
// quand il clique sur "Supprimer mes données", ou quand le serveur redémarre.
// L'identifiant (UUID aléatoire) est dans l'adresse /rapport/<id> : impossible à deviner.
// =============================================================================

import { randomUUID } from 'node:crypto';

/** @typedef {import('./pdf.js').Rapport} Rapport */

// Durée de conservation : 1 h en millisecondes (60 min x 60 s x 1000 ms)
const DUREE_MS = 60 * 60 * 1000;

// Format exact d'un UUID v4 : on refuse tout autre texte dans l'adresse
const FORMAT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Map = dictionnaire en mémoire : id -> { rapport, expire (date limite en ms) }
/** @type {Map<string, { rapport: Rapport, expire: number }>} */
const rapports = new Map();

// Supprime les rapports dont la date limite est dépassée
function supprimerExpires() {

  const maintenant = Date.now();

  for (const [id, entree] of rapports) {

    if (entree.expire <= maintenant) rapports.delete(id);
  }
}

/**
 * Garde un rapport en mémoire et renvoie son identifiant
 * @param {Rapport} rapport
 * @returns {string} ex. "4d54acce-fd09-490f-8241-f986ac077038"
 */
export function saveReport(rapport) {

  supprimerExpires(); // on profite de chaque import pour faire le ménage
  
  const id = randomUUID();
  
  rapports.set(id, { rapport, expire: Date.now() + DUREE_MS });
  return id;
}

/**
 * Renvoie le rapport, ou null s'il n'existe pas, a expiré, ou si l'id est invalide
 * @param {string} id
 * @returns {Rapport | null}
 */
export function readReport(id) {

  if (!FORMAT_ID.test(id)) return null; // adresse bricolée -> refusée

  supprimerExpires();

  return rapports.get(id)?.rapport ?? null; // ?. : pas d'erreur si l'id est absent
}

/**
 * Supprime un rapport ("Supprimer mes données")
 * @param {string} id
 */
export function deleteReport(id) {
  rapports.delete(id);
}