// Liste les métiers d'un rapport PDF avec leur statut ROME : node scripts/voir-rapport.js [chemin.pdf]
// Sans argument : agrège les rapports de data/rapports/ et liste les métiers les plus fréquents.
import { readFileSync, readdirSync } from 'node:fs';
import { extractRapport } from '../src/lib/server/pdf.js';
import { ficheMetier } from '../src/lib/server/knowledge.js';

const lire = (chemin) => extractRapport(new Uint8Array(readFileSync(chemin)), chemin.split('/').pop());

if (process.argv[2]) {
	const rapport = await lire(process.argv[2]);
	console.log(`${rapport.nom} : ${rapport.pages} pages, ${rapport.zones.length} zones, ${rapport.metiers.length} métiers`);
	for (const m of rapport.metiers) {
		const f = ficheMetier(m.intitule);
		console.log(`${m.id.padEnd(6)} z${m.zone} p.${m.page} ${m.intitule} — ${f.statut}${f.code_rome ? ` (${f.code_rome})` : ''}${f.onisep_url ? ' +ONISEP' : ''}`);
	}
	if (rapport.warnings.length) console.log('warnings :', rapport.warnings);
} else {
	const dossier = 'data/rapports';
	const nombre = new Map(); // intitulé -> { fichiers, zone, fiche }
	for (const nom of readdirSync(dossier).filter((n) => n.endsWith('.pdf'))) {
		const rapport = await lire(`${dossier}/${nom}`);
		for (const m of rapport.metiers) {
			const e = nombre.get(m.intitule) ?? { fichiers: new Set(), zone: m.zone, fiche: ficheMetier(m.intitule) };
			e.fichiers.add(nom);
			nombre.set(m.intitule, e);
		}
	}
	const lignes = [...nombre.entries()].sort((a, b) => b[1].fichiers.size - a[1].fichiers.size);
	console.log('Métiers les plus fréquents (intitulé | zone | nb rapports | statut) :');
	for (const [intitule, e] of lignes.slice(0, 30)) {
		console.log(`${intitule} | z${e.zone} | ${e.fichiers.size} | ${e.fiche.statut}${e.fiche.code_rome ? ` ${e.fiche.code_rome}` : ''}${e.fiche.onisep_url ? ' +ONISEP' : ''}`);
	}
}
