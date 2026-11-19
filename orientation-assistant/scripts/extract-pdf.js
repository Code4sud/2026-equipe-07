// Usage : node scripts/extract-pdf.js data/rapports/rapport-des-possibles-2187.pdf
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { extractRapport } from '../src/lib/server/pdf.js';

const chemin = process.argv[2];
if (!chemin) {
	console.error('Usage : node scripts/extract-pdf.js <fichier.pdf>');
	process.exit(1);
}

try {
	const rapport = await extractRapport(await readFile(chemin), basename(chemin));
	console.log(JSON.stringify(rapport, null, 2));
	console.error(`\n${rapport.zones.length} zones, ${rapport.metiers.length} métiers, ${rapport.warnings.length} avertissement(s)`);
} catch (err) {
	console.error(`Erreur ${err.code ?? ''} : ${err.message}`);
	process.exit(1);
}
