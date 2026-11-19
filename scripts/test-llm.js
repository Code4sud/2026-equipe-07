// Test rapide du LLM : node --env-file=.env scripts/test-llm.js
// Cloud (doc : https://docs.ollama.com/quickstart#2-send-a-request) :
//   OLLAMA_URL=https://ollama.com  LLM_MODEL=gemma4:31b  OLLAMA_API_KEY=...
// Local : OLLAMA_URL=http://localhost:11434  LLM_MODEL=qwen2.5:3b
import { chat } from '../src/lib/server/ollama.js';

const debut = Date.now();
try {
	const reponse = await chat([{ role: 'user', content: 'Say hello in one sentence.' }]);
	console.log(`OK (${Date.now() - debut} ms) [${process.env.LLM_MODEL}] :`, reponse);
} catch (e) {
	console.error(`ECHEC ${e.code || ''} : ${e.message}`);
	process.exit(1);
}
