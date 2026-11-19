// Appel HTTP Ollama /api/chat (local ou cloud https://ollama.com), timeout, erreurs propres
// Variables : OLLAMA_URL, LLM_MODEL, OLLAMA_API_KEY (nécessaire seulement pour le cloud)
// Réf. : https://docs.ollama.com/quickstart#2-send-a-request

export class OllamaError extends Error {
	/**
	 * @param {'OLLAMA_INDISPONIBLE' | 'TIMEOUT' | 'OLLAMA_HTTP' | 'REPONSE_INVALIDE'} code
	 * @param {string} message
	 */
	constructor(code, message) {
		super(message);
		this.code = code; // OLLAMA_INDISPONIBLE | TIMEOUT | OLLAMA_HTTP | REPONSE_INVALIDE
	}
}

/**
 * @param {{ role: string, content: string }[]} messages
 * @param {{ timeoutMs?: number, model?: string, options?: object }} [reglages] options? : ex. { temperature: 0.2 }
 * @returns {Promise<string>} le texte de la réponse
 */
export async function chat(messages, { timeoutMs = 60000, model, options } = {}) {
	const url = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
	const apiKey = process.env.OLLAMA_API_KEY;
	/** @type {Record<string, string>} */
	const headers = { 'Content-Type': 'application/json' };
	if (apiKey && apiKey !== 'OLLAMA_API_KEY') headers.Authorization = `Bearer ${apiKey}`;

	let res;
	try {
		res = await fetch(`${url}/api/chat`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				model: model || process.env.LLM_MODEL || 'qwen2.5:3b',
				messages,
				stream: false,
				options
			}),
			signal: AbortSignal.timeout(timeoutMs)
		});
	} catch (e) {
<<<<<<< HEAD:orientation-assistant/src/lib/server/ollama.js
		const errorName = e instanceof Error ? e.name : '';
		if (errorName === 'TimeoutError') throw new OllamaError('TIMEOUT', 'Le modèle a mis trop de temps à répondre.');
=======
		if (/** @type {Error} */ (e).name === 'TimeoutError') throw new OllamaError('TIMEOUT', 'Le modèle a mis trop de temps à répondre.');
>>>>>>> origin/main:src/lib/server/ollama.js
		throw new OllamaError('OLLAMA_INDISPONIBLE', 'Ollama est injoignable.');
	}

	if (!res.ok) throw new OllamaError('OLLAMA_HTTP', `Ollama a répondu avec le statut ${res.status}.`);

	const json = await res.json().catch(() => null);
	const texte = json?.message?.content;
	if (typeof texte !== 'string') throw new OllamaError('REPONSE_INVALIDE', 'Réponse Ollama inattendue.');
	return texte;

}
