// Dump x, y, taille, texte des items pdfjs d'une page : node scripts/dump-pdf.mjs fichier.pdf [page]
import fs from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const [fichier, pageArg] = process.argv.slice(2);
const data = new Uint8Array(fs.readFileSync(fichier));
const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
console.log('pages:', doc.numPages);
const num = Number(pageArg || 8);
const page = await doc.getPage(num);
const contenu = await page.getTextContent();
for (const i of contenu.items) {
	if (!i.str.trim()) continue;
	console.log(Math.round(i.transform[4]), Math.round(i.transform[5]), Math.round(i.height), JSON.stringify(i.str));
}
