// Lancer : npm run test:pdf   (les PDF reels doivent etre dans data/rapports/, hors git)
import { test } from 'node:test';           // test('nom', fonction) = déclare un test
import assert from 'node:assert/strict';    // assert.xxx = vérifie ; si c'est faux, le test échoue
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extractRapport } from '../src/lib/server/pdf.js'; // la fonction qu'on teste

const DOSSIER = 'data/rapports';

// Liste des PDF du dossier ; dossier absent (coéquipier sans les rapports) -> liste vide
const fichiers = existsSync(DOSSIER) ? (await readdir(DOSSIER)).filter((f) => f.endsWith('.pdf')) : [];

// Échoue avec un message clair si on a oublié de copier les PDF
test('des rapports sont presents dans data/rapports', () => {
	assert.ok(fichiers.length > 0, 'Copier les PDF dans data/rapports/'); // ok(x) : x doit être vrai
});

// Un test par rapport : 18 rapports -> 18 tests (chacun porte le nom du fichier)
for (const fichier of fichiers) {
	test(fichier, async () => {

		const r = await extractRapport(await readFile(`${DOSSIER}/${fichier}`), fichier);

		// --- Zones ---
		assert.equal(r.zones.length, 5, '5 zones attendues');                  // equal(a, b) : a doit valoir b
		assert.deepEqual(r.zones.map((z) => z.numero), [1, 2, 3, 4, 5]);      // deepEqual : compare le contenu des listes
		
		for (const z of r.zones) {

			// Sous-titre de durée, ex. "Métiers accessibles en 0 à 6 mois"
			assert.match(z.titre ?? '', /^Métiers accessibles en/, `zone ${z.numero} : sous-titre`);
			
			// Explication présente (plus de 30 caractères)
			assert.ok(z.explication.length > 30, `zone ${z.numero} : explication`);
			
			// Pas de texte parasite collé (bugs corrigés : "Aucun métier trouvé", exposant "ème"/"ère")
			assert.doesNotMatch(z.explication, /Aucun métier|\bème\b|\bère\b/, `zone ${z.numero} : explication polluée`);
			
			// Cohérence : zone "vide" = 0 métier, zone normale = au moins 1 métier
			const nb = r.metiers.filter((m) => m.zone === z.numero).length;
			assert.ok(z.vide ? nb === 0 : nb > 0, `zone ${z.numero} : vide=${z.vide} mais ${nb} métier(s)`);
		}

		// pdf.js n'a signalé aucun problème
		assert.deepEqual(r.warnings, [], 'aucun avertissement');

		// --- Métiers ---
		assert.ok(r.metiers.length > 0, 'au moins un métier');

		for (const m of r.metiers) {

			assert.ok(m.intitule.length > 2, `${m.id} : intitulé`);                 // intitulé non vide
			assert.ok(m.description.length > 50, `${m.id} : description`);          // vraie description
			assert.ok(m.page >= 1 && m.page <= r.pages, `${m.id} : page`);          // page qui existe (citée comme source)
		}
		assert.ok(r.metiers.length <= 25, 'au plus 5 métiers par zone');            // 5 zones x 5 métiers max
	});
}

// Un faux fichier doit être refusé proprement (pas de plantage), avec le bon code d'erreur.
test('un faux PDF est refusé avec le code PDF_ILLISIBLE', async () => {
	
	await assert.rejects(                                                     // rejects : la promesse DOIT échouer
		extractRapport(new TextEncoder().encode('pas un pdf'), 'faux.pdf'),   // du texte transformé en octets
		(/** @type {any} */ err) => err.code === 'PDF_ILLISIBLE'              // ...et avec ce code-là
	);
});
