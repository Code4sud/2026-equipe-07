// Passe les questions de tests/questions.md au VRAI modèle et calcule le taux de réussite.
//   npm run test:questions            -> les 16 questions
//   npm run test:questions -- 2 5 11  -> seulement les questions n° 2, 5, 11
// Prérequis : Ollama lancé, PDF dans data/rapports/ (ils ne sont pas dans git).
// Code de sortie : 0 si au moins 80 % de réussite, sinon 1.
import { readFileSync, readdirSync } from 'node:fs';
import { extractRapport } from '../src/lib/server/pdf.js';
import { repondre, MESSAGE_HORS_SUJET } from '../src/lib/server/rag.js';
import { MESSAGE_REPLI } from '../src/lib/server/citations.js';
import { chat } from '../src/lib/server/ollama.js';

const SEUIL = 0.8;
const DOSSIER = 'data/rapports';
const modele = process.env.LLM_MODEL || 'qwen2.5:3b';

// --- 1) Lire le tableau de questions.md --------------------------------------

/** "Diplôme d’État" -> "diplome d'etat" : minuscules, sans accents, apostrophes droites */
const norm = (t) =>
	String(t ?? '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[’‘`]/g, "'")
		.replace(/\s+/g, ' ')
		.trim();

const liste = (cellule) => cellule.split(/[;,]/).map((s) => s.trim()).filter(Boolean);

const demandees = new Set(process.argv.slice(2).map(Number));

const questions = readFileSync('tests/questions.md', 'utf-8')
	.split('\n')
	.filter((l) => /^\|\s*\d+\s*\|/.test(l)) // lignes du tableau dont la 1re cellule est un numéro
	.map((l) => {
		const c = l.split('|').slice(1, -1).map((x) => x.trim());
		return { numero: Number(c[0]), metier: c[1], question: c[2], attendu: c[3], sources: liste(c[4] ?? ''), mots: liste(c[5] ?? '') };
	})
	.filter((q) => demandees.size === 0 || demandees.has(q.numero));

if (questions.length === 0) {
	console.error('Aucune question trouvée dans tests/questions.md');
	process.exit(1);
}

// --- 2) Retrouver chaque métier dans un des PDF -----------------------------

const recherches = new Set(questions.map((q) => q.metier));
const trouves = new Map(); // intitulé -> { rapport, metier }

for (const nom of readdirSync(DOSSIER).filter((n) => n.endsWith('.pdf')).sort()) {
	if (trouves.size === recherches.size) break;
	const rapport = await extractRapport(new Uint8Array(readFileSync(`${DOSSIER}/${nom}`)), nom);
	for (const metier of rapport.metiers) {
		if (recherches.has(metier.intitule) && !trouves.has(metier.intitule)) trouves.set(metier.intitule, { rapport, metier });
	}
}

// --- 3) Juger une réponse -----------------------------------------------------

/** @returns {string[]} les problèmes trouvés (vide = réussi) */
function juger(q, r, zone) {
	const problemes = [];
	const texte = norm(r.reponse);
	const types = r.sources.map((s) => s.type);

	// Règles communes à toutes les réponses
	if (/€|euros?\b/.test(texte)) problemes.push('salaire inventé (€ / euros)');
	if (/hors_sujet|\{\{|sources numerotees|cerf-volant|voilerie|<numero|<le diplome|<ce que/.test(texte)) problemes.push('fuite du prompt');

	// Toute durée « X à Y mois/ans » citée doit être celle de la zone du métier (sinon : durée recopiée ou inventée)
	const titreZone = norm(zone?.titre ?? '');
	for (const duree of texte.match(/\d+\s*(?:mois|ans)?\s*a\s*\d+\s*(?:mois|ans)/g) ?? []) {
		if (!titreZone.includes(duree)) problemes.push(`durée « ${duree} » absente de la zone du rapport (« ${zone?.titre ?? '?'} »)`);
	}

	if (q.attendu === 'repli') {
		if (r.reponse !== MESSAGE_REPLI) problemes.push('message de repli exact attendu');
		if (r.sources.length > 0) problemes.push('aucune source attendue');
	} else if (q.attendu === 'hors-sujet') {
		if (r.reponse !== MESSAGE_HORS_SUJET && r.reponse !== MESSAGE_REPLI) problemes.push('refus poli ou repli attendu');
		if (r.sources.length > 0) problemes.push('aucune source attendue');
	} else {
		// ok / ok-rapport
		if (r.statut !== 'ok') problemes.push(`réponse sourcée attendue (statut ${r.statut})`);
		if (q.attendu === 'ok-rapport' && types.includes('ROME')) problemes.push('source ROME interdite (métier non relié)');
		if (q.sources.length && !types.some((t) => q.sources.some((s) => norm(s) === norm(t)))) {
			problemes.push(`source attendue : ${q.sources.join(' ou ')} (obtenu : ${types.join(', ') || 'aucune'})`);
		}
		if (q.mots.length && !q.mots.some((m) => texte.includes(norm(m)))) problemes.push(`aucun des mots attendus : ${q.mots.join('; ')}`);
	}
	return problemes;
}

// --- 4) Exécuter -----------------------------------------------------------

console.log(`Modèle : ${modele} — ${questions.length} questions\n`);

const appeler = (messages) => chat(messages, { timeoutMs: 120_000, options: { temperature: 0.2, num_predict: 250 } });
let reussies = 0;
let dureeTotale = 0;

for (const q of questions) {
	const trouve = trouves.get(q.metier);
	if (!trouve) {
		console.log(`#${q.numero} ⚠️  métier « ${q.metier} » introuvable dans data/rapports/ (ignoré)\n`);
		continue;
	}

	const debut = Date.now();
	const r = await repondre({ question: q.question, rapport: trouve.rapport, metierId: trouve.metier.id }, appeler);
	const ms = Date.now() - debut;
	dureeTotale += ms;

	const zone = trouve.rapport.zones.find((z) => z.numero === trouve.metier.zone);
	const problemes = juger(q, r, zone);
	if (problemes.length === 0) reussies++;

	const sources = r.sources.map((s) => `[${s.n}] ${s.type}`).join(', ') || '—';
	console.log(`#${q.numero} ${problemes.length === 0 ? '✅' : '❌'} ${q.metier} — ${q.question} (${(ms / 1000).toFixed(1)} s)`);
	console.log(`   attendu : ${q.attendu} | statut : ${r.statut} | sources : ${sources}`);
	console.log(`   réponse : ${r.reponse.replace(/\s+/g, ' ').slice(0, 220)}`);
	for (const p of problemes) console.log(`   → ${p}`);
	console.log();
}

const total = questions.filter((q) => trouves.has(q.metier)).length;
const taux = total ? reussies / total : 0;
console.log(`Résultat : ${reussies}/${total} (${Math.round(taux * 100)} %) — objectif ${SEUIL * 100} % — temps moyen ${(dureeTotale / Math.max(total, 1) / 1000).toFixed(1)} s`);
process.exit(taux >= SEUIL ? 0 : 1);
