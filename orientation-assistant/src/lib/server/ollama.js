// =============================================================================
// ollama.js — Appel du modèle open weight via l'API HTTP d'Ollama
// -----------------------------------------------------------------------------
// Ollama tourne en local (http://localhost:11434 par défaut).
// La config (adresse, modèle) est passée par l'appelant : la route SvelteKit
// la lit dans .env ; les tests n'appellent pas Ollama.
// =============================================================================

/**
 * Un message de conversation, au format attendu par Ollama.
 * role "system" = les règles, "user" = le jeune (ou nous), "assistant" = le modèle
 * @typedef {{ role: 'system' | 'user' | 'assistant', content: string }} Message
 */

/**
 * Réglages de connexion. delaiMs? : le "?" veut dire "facultatif".
 * @typedef {{ url: string, modele: string, delaiMs?: number }} ConfigOllama
 */

/**
 * Envoie les messages au modèle et renvoie le texte de sa réponse.
 * @param {Message[]} messages prompt système + question avec le contexte
 * @param {ConfigOllama} config
 * @returns {Promise<string>}
 */
// { url, modele, delaiMs = 120_000 } : on déballe la config ; si delaiMs manque -> 120 000 ms = 2 min
export async function discuter(messages, { url, modele, delaiMs = 120_000 }) {

    // Sans nom de modèle, Ollama ne sait pas quoi lancer : on s'arrête tout de suite avec un message clair
    if (!modele) throw new Error('LLM_MODEL manquant dans .env');

    // fetch = requête HTTP (intégré à Node 22, pas de paquet à installer)
    // url.replace(/\/$/, '') enlève un "/" final : "http://x:11434/" -> "http://x:11434"
    const reponse = await fetch(`${url.replace(/\/$/, '')}/api/chat`, {
        method: 'POST',                                    // on ENVOIE des données
        headers: { 'Content-Type': 'application/json' },   // ...au format JSON
        body: JSON.stringify({                             // objet JavaScript -> texte JSON
                model: modele,                             // ex. le nom du modèle choisi dans .env
                messages,                                  // = messages: messages
                stream: false, // une seule réponse complète (plus simple qu'un flux)
                options: { temperature: 0.2 } // peu de "créativité" : on veut coller aux sources
        }),
        // Abandonne si le modèle met trop longtemps (PC lent, modèle trop gros).
        signal: AbortSignal.timeout(delaiMs)
    });

    // reponse.ok = vrai si le code HTTP est 200-299 (succès)
    if (!reponse.ok) {
        // Ex. 404 = modèle pas téléchargé (faire : ollama pull <modèle>)
        throw new Error(`Ollama a répondu ${reponse.status} : ${await reponse.text()}`);
    }

    const donnees = await reponse.json(); // texte JSON -> objet JavaScript

    // Format Ollama /api/chat (sans flux) : { message: { role, content }, ... }
    // ?. : pas d'erreur si "message" manque ; ?? '' : texte vide dans ce cas
    return donnees?.message?.content ?? '';
}
