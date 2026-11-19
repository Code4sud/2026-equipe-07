// Appel HTTP Ollama /api/chat (local ou cloud https://ollama.com), timeout, erreurs propres
// Variables : OLLAMA_URL, LLM_MODEL, OLLAMA_API_KEY (nécessaire seulement pour le cloud)
// Réf. : https://docs.ollama.com/quickstart#2-send-a-request

export class OllamaError extends Error {
	constructor(code, message) {
		super(message);
		this.code = code; // OLLAMA_INDISPONIBLE | TIMEOUT | OLLAMA_HTTP | REPONSE_INVALIDE
	}
}

export async function chat(messages, { timeoutMs = 60000, model, options } = {}) {
	const url = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
	const apiKey = process.env.OLLAMA_API_KEY;
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
		if (e.name === 'TimeoutError') throw new OllamaError('TIMEOUT', 'Le modèle a mis trop de temps à répondre.');
		throw new OllamaError('OLLAMA_INDISPONIBLE', 'Ollama est injoignable.');
	}

	if (!res.ok) throw new OllamaError('OLLAMA_HTTP', `Ollama a répondu avec le statut ${res.status}.`);

	const json = await res.json().catch(() => null);
	const texte = json?.message?.content;
	if (typeof texte !== 'string') throw new OllamaError('REPONSE_INVALIDE', 'Réponse Ollama inattendue.');
	return texte;

}
