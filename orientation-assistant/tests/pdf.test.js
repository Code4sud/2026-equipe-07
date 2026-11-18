// Lancer : npm run test:pdf   (les PDF reels doivent etre dans data/rapports/, hors git)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extractRapport } from '../src/lib/server/pdf.js';

const DOSSIER = 'data/rapports';
const fichiers = existsSync(DOSSIER) ? (await readdir(DOSSIER)).filter((f) => f.endsWith('.pdf')) : [];

test('des rapports sont presents dans data/rapports', () => {
	assert.ok(fichiers.length > 0, 'Copier les PDF dans data/rapports/');
});

for (const fichier of fichiers) {
	test(fichier, async () => {
		const r = await extractRapport(await readFile(`${DOSSIER}/${fichier}`), fichier);

		assert.equal(r.zones.length, 5, '5 zones attendues');
		assert.deepEqual(r.zones.map((z) => z.numero), [1, 2, 3, 4, 5]);
		for (const z of r.zones) {
			assert.match(z.titre ?? '', /^Métiers accessibles en/, `zone ${z.numero} : sous-titre`);
			assert.ok(z.explication.length > 30, `zone ${z.numero} : explication`);
			assert.doesNotMatch(z.explication, /Aucun métier|\bème\b|\bère\b/, `zone ${z.numero} : explication polluée`);
			const nb = r.metiers.filter((m) => m.zone === z.numero).length;
			assert.ok(z.vide ? nb === 0 : nb > 0, `zone ${z.numero} : vide=${z.vide} mais ${nb} métier(s)`);
		}
		assert.deepEqual(r.warnings, [], 'aucun avertissement');

		assert.ok(r.metiers.length > 0, 'au moins un métier');
		for (const m of r.metiers) {
			assert.ok(m.intitule.length > 2, `${m.id} : intitulé`);
			assert.ok(m.description.length > 50, `${m.id} : description`);
			assert.ok(m.page >= 1 && m.page <= r.pages, `${m.id} : page`);
		}
		assert.ok(r.metiers.length <= 25, 'au plus 5 métiers par zone');
	});
}

test('un faux PDF est refusé avec le code PDF_ILLISIBLE', async () => {
	await assert.rejects(
		extractRapport(new TextEncoder().encode('pas un pdf'), 'faux.pdf'),
		(err) => err.code === 'PDF_ILLISIBLE'
	);
});
