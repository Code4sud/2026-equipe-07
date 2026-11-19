// Résumé du contenu de data/knowledge/ : node scripts/voir-knowledge.js [CODE_ROME]
import { readFileSync } from 'node:fs';

const lire = (nom) => JSON.parse(readFileSync(`data/knowledge/${nom}.json`, 'utf-8'));
const rome = lire('rome');
const onisep = lire('onisep');
const corr = Object.values(lire('correspondances'));

const code = process.argv[2];
if (code) {
	console.log(JSON.stringify(rome[code], null, 2));
	process.exit(0);
}

const compte = (liste, f) => liste.reduce((a, x) => ((a[f(x)] = (a[f(x)] || 0) + 1), a), {});
console.log(`rome.json            : ${Object.keys(rome).length} fiches`);
console.log(`  avec définition    : ${Object.values(rome).filter((f) => f.definition).length}`);
console.log(`  avec accès métier  : ${Object.values(rome).filter((f) => f.acces).length}`);
console.log(`  avec lien ROME     : ${Object.values(rome).filter((f) => f.url).length}`);
console.log(`onisep.json          : ${onisep.length} fiches (${onisep.filter((o) => o.url).length} avec lien)`);
console.log(`correspondances.json : ${corr.length} intitulés`, compte(corr, (c) => c.statut));
const v = corr.filter((c) => c.statut === 'verifie');
console.log(`  vérifiés           : ${v.length} (ROME ${v.filter((c) => c.code_rome).length}, ONISEP ${v.filter((c) => c.onisep_url).length})`);
const k = Object.values(rome)[0];
console.log('\nUne fiche ROME :', Object.keys(k).join(', '), '|', k.version);
