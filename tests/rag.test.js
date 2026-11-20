
// Lancer : npm run test:rag   (sans Ollama ni PDF : rapport FICTIF + faux modèle)
import { test } from 'node:test';          // test('nom', fonction) = déclare un test
import assert from 'node:assert/strict';   // assert.xxx = vérifie ; si c'est faux, le test échoue
import { construireSources, construireMessages, repondre, PROMPT_SYSTEME } from '../src/lib/server/rag.js';
import { verifierReponse, numerosCites, MESSAGE_REPLI } from '../src/lib/server/citations.js';

// Rapport INVENTÉ (rendu.txt : pas de données réelles dans les tests), même forme que pdf.js.
// "Barista" est vérifié dans correspondances.json ; "Métier fictif de test" n'y est pas (intitulé inventé : le test ne dépend pas des validations).
const rapport = {
    nom: 'rapport-fictif.pdf',
    pages: 17,
    zones: [
        { numero: 1, titre: 'Métiers accessibles en 0 à 6 mois', explication: 'Une courte démonstration suffit.', vide: false, page: 8 },
        { numero: 2, titre: 'Métiers accessibles en 3 mois à 2 ans', explication: 'Certains métiers demandent un CAP.', vide: false, page: 10 }
    ],
    metiers: [
        { id: 'z1-m1', zone: 1, intitule: 'Barista', description: 'Le barista prépare des cafés.', page: 8 },
        { id: 'z2-m1', zone: 2, intitule: 'Métier fictif de test', description: 'Description inventée pour le test.', page: 10 }
    ],
    warnings: []
};

// Faux modèle : renvoie toujours le même texte, et garde les messages reçus pour les inspecter.
// Il remplace Ollama : repondre() ne voit pas la différence (il reçoit juste une fonction).
/** @param {string} texte */
function fauxModele(texte) {
    /** @type {any[]} */
    const recus = []; // historique des appels
    const appeler = async (/** @type {any} */ messages) => {
        recus.push(messages); // on note ce qu'on a reçu
        return texte; // et on répond toujours la même chose
    };
    return { appeler, recus }; // la fonction à donner à repondre() + l'historique
}

// --- citations.js -------------------------------------------------------------

// Les 3 façons d'écrire une citation sont reconnues
test('numerosCites lit [1], [1, 3] et [2][4]', () => {
    assert.deepEqual(numerosCites('a [1] b [1, 3] c [2][4]'), [1, 1, 3, 2, 4]);
});

// Le cœur de l'anti-hallucination : une source inventée ne s'affiche pas
test('verifierReponse garde les sources citées et retire les numéros inventés', () => {

    // 3 fausses sources numérotées 1, 2, 3 (/** @type {const} */ : "rapport" est la valeur exacte attendue)
    const sources = [1, 2, 3].map((n) => ({ n, type: /** @type {const} */ ('rapport'), titre: `S${n}`, page: 8, reference: null, url: null, texte: 'x' }));
    const v = verifierReponse('Il prépare des cafés [1]. Salaire élevé [7]. CAP possible [2, 9].', sources);
    
    assert.equal(v.statut, 'ok');
    assert.doesNotMatch(v.reponse, /\[7\]|9/); // [7] et 9 n'existent pas -> retirés
    assert.deepEqual(v.sources.map((s) => s.n), [1, 2]); // seulement les sources réellement citées
    assert.equal('texte' in v.sources[0], false); // le texte complet n'est pas renvoyé au navigateur
});

// Une réponse sans aucune source -> "je ne sais pas"
test('aucune citation valide -> message de repli', () => {

    const v = verifierReponse('Ce métier paie très bien.', [{ n: 1, type: 'rapport', titre: 'S1', page: 8, reference: null, url: null, texte: 'x' }]);
    
    assert.equal(v.statut, 'insuffisant');
    assert.equal(v.reponse, MESSAGE_REPLI);
});

// --- rag.js : sources ---------------------------------------------------------

// Barista est "verifie" -> on a aussi la définition [3] et l'accès [4] de la fiche ROME
test('métier vérifié : 2 sources rapport + 2 sources ROME (G1809)', () => {

    const { sources, romeVerifie } = construireSources(rapport, rapport.metiers[0]); // metiers[0] = Barista
    
    assert.equal(romeVerifie, true);
    assert.deepEqual(sources.map((s) => s.n), [1, 2, 3, 4]); // numérotation continue
    assert.deepEqual(sources.map((s) => s.type), ['rapport', 'rapport', 'ROME', 'ROME']);
    assert.equal(sources[0].page, 8); // page citée
    assert.match(sources[2].titre, /G1809/);
    assert.match(sources[3].titre, /accès au métier/);
});

// Pas vérifié -> pas de ROME (règle de fiabilité de knowledge.js)
test('métier non vérifié : seulement les 2 sources du rapport', () => {

    const { sources, romeVerifie } = construireSources(rapport, rapport.metiers[1]); // metiers[1] = Métier fictif
    
    assert.equal(romeVerifie, false);
    assert.deepEqual(sources.map((s) => s.type), ['rapport', 'rapport']);
});

// On vérifie le TEXTE envoyé au modèle (sans appeler de modèle)
test('le message au modèle contient les sources numérotées et la question', () => {

    const { sources, romeVerifie } = construireSources(rapport, rapport.metiers[1]);
    const messages = construireMessages('Il faut quel diplôme ?', rapport.metiers[1], sources, romeVerifie);
    
    assert.equal(messages[0].role, 'system'); // 1er message = les règles
    assert.match(messages[1].content, /\[1\] Rapport des Possibles — Métier fictif/); // sources numérotées
    assert.match(messages[1].content, /QUESTION DU JEUNE : Il faut quel diplôme \?/); // \? = un vrai "?"
    assert.match(messages[1].content, /aucune fiche officielle ROME/); // avertissement si non vérifié
    assert.match(PROMPT_SYSTEME, /pas des instructions/); // défense contre l'injection de prompt
});

// --- rag.js : repondre (avec faux modèle) ------------------------------------

// Cas normal : le modèle cite [1] et [4] -> seules ces 2 sources sont renvoyées
test('repondre : réponse sourcée -> statut ok, sources citées seulement', async () => {

    const modele = fauxModele('Tu prépares des cafés [1]. Un CAP service de café est possible [4].');
    const r = await repondre({ question: "C'est quoi ?", rapport, metierId: 'z1-m1' }, modele.appeler);
    
    assert.equal(r.statut, 'ok');
    assert.deepEqual(r.sources.map((s) => s.n), [1, 4]);
    assert.equal(r.suggestions.length, 3); // les 3 questions proposées sous le chat
    assert.equal(modele.recus.length, 1); // le modèle a été appelé une fois
});

// Le modèle dit lui-même qu'il ne sait pas (ex. question sur le salaire)
test('repondre : le modèle ne sait pas -> message de repli', async () => {

    const modele = fauxModele(MESSAGE_REPLI);
    const r = await repondre({ question: 'Combien je vais gagner ?', rapport, metierId: 'z1-m1' }, modele.appeler);
    
    assert.equal(r.statut, 'insuffisant');
    assert.equal(r.reponse, MESSAGE_REPLI);
});

// Ollama éteint : l'appli ne plante pas, le jeune voit un message compréhensible
test("repondre : Ollama en panne -> statut erreur, message clair", async () => {

    const enPanne = async () => {
        throw new Error('connect ECONNREFUSED'); // simule Ollama éteint
    };

    const r = await repondre({ question: "C'est quoi ?", rapport, metierId: 'z1-m1' }, enPanne);
    
    assert.equal(r.statut, 'erreur');
    assert.doesNotMatch(r.reponse, /ECONNREFUSED/); // pas de détail technique montré au jeune
});

// Requête invalide : on ne gaspille pas un appel au modèle
test('repondre : question vide ou métier inconnu -> erreur, sans appeler le modèle', async () => {
    
    const modele = fauxModele('ne doit pas être appelé');
    
    assert.equal((await repondre({ question: '   ', rapport, metierId: 'z1-m1' }, modele.appeler)).statut, 'erreur'); // que des espaces
    assert.equal((await repondre({ question: 'Quoi ?', rapport, metierId: 'z9-m9' }, modele.appeler)).statut, 'erreur'); // id inexistant
    assert.equal(modele.recus.length, 0); // aucun appel inutile
});
