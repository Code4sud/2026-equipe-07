// Essai réel de repondre() avec le vrai modèle : node --env-file=../.env scripts/essai-rag.js
// (nécessite Ollama lancé ; utilise un métier vérifié et un rapport factice)
import { repondre } from '../src/lib/server/rag.js';
import { ficheMetier } from '../src/lib/server/knowledge.js';

const zone = {
	numero: 2,
	titre: 'Métiers accessibles en 3 mois à 2 ans',
	explication: 'Un apprentissage de 3 à 6 mois est nécessaire. Certains métiers peuvent nécessiter un diplôme de niveau CAP, BEP et BAC.',
	page: 9
};
const metier = {
	id: 'z2-m1', zone: 2, intitule: 'Barista', page: 9,
	description: 'Le Barista prépare et sert des cafés et boissons chaudes dans un bar ou un café.'
};
const fiche = ficheMetier(metier.intitule);

const questions = process.argv.slice(2);
if (questions.length === 0) {
	questions.push('Je peux le faire sans le bac ?', "C'est quoi concrètement ?", 'Quel est le salaire à Nice ?');
}

for (const q of questions) {
	const debut = Date.now();
	const r = await repondre(metier, zone, fiche, q);
	const sources = r.sources.map((s) => `[${s.n}] ${s.type}${s.page ? ` p.${s.page}` : ''}`).join(', ') || '—';
	console.log(`\n>>> ${q} (${Date.now() - debut} ms)\n[${r.statut}] ${r.reponse}\nsources : ${sources}`);
}
