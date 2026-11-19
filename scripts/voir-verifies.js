// Liste des métiers vérifiés (avec accès ROME) et non vérifiés : node scripts/voir-verifies.js
import { readFileSync } from 'node:fs';

const c = Object.values(JSON.parse(readFileSync('data/knowledge/correspondances.json', 'utf-8')));
const r = JSON.parse(readFileSync('data/knowledge/rome.json', 'utf-8'));

const verifies = c
	.filter((x) => x.statut === 'verifie' && x.code_rome && r[x.code_rome]?.acces)
	.sort((a, b) => (b.nb_rapports || 0) - (a.nb_rapports || 0))
	.slice(0, 10);

console.log('VÉRIFIÉS :');
for (const x of verifies) {
	console.log(`- ${x.intitule} | ${x.code_rome} | onisep:${Boolean(x.onisep_url)}\n    accès : ${r[x.code_rome].acces.replace(/\s+/g, ' ').slice(0, 200)}`);
}

console.log('\nNON VÉRIFIÉS :');
for (const x of c.filter((y) => y.statut !== 'verifie').slice(0, 4)) console.log(`- ${x.intitule} | ${x.statut}`);
