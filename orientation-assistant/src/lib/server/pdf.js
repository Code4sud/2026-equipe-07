// =============================================================================
// pdf.js — Extraction d'un "Rapport des Possibles" (PDF) en JSON
// -----------------------------------------------------------------------------
// Entrée  : le contenu binaire d'un PDF + son nom de fichier
// Sortie  : { nom, pages, zones: [...], metiers: [...], warnings: [...] }
//
// Principe : on n'utilise PAS d'IA ici. Les 18 rapports ont tous la même mise
// en page, donc on reconnaît chaque élément grâce à la TAILLE de son texte :
//   - titre de zone  ("1ère ZONE DE MÉTIERS")        -> hauteur 22
//   - intitulé métier ("Barista")                    -> hauteur 14.8
//   - texte courant (descriptions, explications)     -> hauteur 11
//   - numéro de page ("8/17") et exposant "ère/ème"  -> hauteur 13 (ignorés)
//
// Ce fichier est dans src/lib/server/ : SvelteKit interdit de l'importer côté
// navigateur, il tourne uniquement sur le serveur Node.
// =============================================================================

// "legacy" = version de pdfjs prévue pour Node.js (la version standard vise le navigateur).
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// --- Seuils de hauteur de texte (mesurés sur les 18 rapports) ----------------

// Tout texte de hauteur >= 20 qui contient "ZONE DE MÉTIERS" est un titre de zone (hauteur réelle : 22).
const HAUTEUR_TITRE_ZONE = 20;

// Un intitulé de métier fait 14.8 : on accepte une fourchette 14 -> 16 par sécurité.
const HAUTEUR_METIER_MIN = 14;
const HAUTEUR_METIER_MAX = 16;

// Le texte courant fait 11 : on accepte 10 -> 12.
// Au-dessus de 12, on tombe sur le numéro de page et l'exposant "ère"/"ème" (hauteur 13), qu'on ignore.
const HAUTEUR_TEXTE_MIN = 10;
const HAUTEUR_TEXTE_MAX = 12;

// Deux morceaux de texte dont la position verticale (Y) diffère de 2 points au plus sont sur la même ligne.
const TOLERANCE_LIGNE = 2;

// --- Types (commentaires JSDoc) ----------------------------------------------
// Ils n'exécutent rien : ils décrivent la forme des objets pour que VS Code
// vérifie le code et propose l'autocomplétion. Ils servent aussi de documentation
// du JSON produit, utilisé par les autres fichiers (rag.js, routes...).

/**
 * Un morceau de texte sorti de pdfjs, simplifié.
 * @typedef {{ texte: string, x: number, y: number, hauteur: number }} Morceau
 */

/**
 * Une ligne reconstituée (plusieurs morceaux à la même hauteur sur la page).
 * @typedef {{ page: number, hauteur: number, texte: string }} Ligne
 */

/**
 * Une zone de métiers du rapport (1 à 5).
 * @typedef {object} Zone
 * @property {number} numero 1 à 5
 * @property {string | null} titre ex. "Métiers accessibles en 0 à 6 mois" (null si introuvable)
 * @property {string} explication paragraphe sous le titre (durée, diplômes)
 * @property {boolean} vide true si le rapport écrit "Aucun métier trouvé pour cette zone"
 * @property {number} page page du PDF où commence la zone
 */

/**
 * Un métier proposé dans le rapport.
 * @typedef {object} Metier
 * @property {string} id ex. "z2-m3" (3e métier de la zone 2)
 * @property {number} zone numéro de la zone
 * @property {string} intitule ex. "Barista"
 * @property {string} description paragraphe du rapport
 * @property {number} page page du PDF (citée comme source)
 */

/**
 * Le résultat complet de l'extraction.
 * @typedef {object} Rapport
 * @property {string} nom nom du fichier PDF
 * @property {number} pages nombre de pages
 * @property {Zone[]} zones
 * @property {Metier[]} metiers
 * @property {string[]} warnings problèmes détectés (vide si tout va bien)
 */

// --- Erreur personnalisée ----------------------------------------------------

// On ajoute un "code" à l'erreur pour que la route serveur puisse répondre
// un message clair au jeune (ex. code 'PDF_ILLISIBLE' -> "Ce fichier n'est pas un PDF lisible").
export class PdfError extends Error {
	/**
	 * @param {string} code ex. 'PDF_ILLISIBLE'
	 * @param {string} message texte lisible par le jeune
	 */
	constructor(code, message) {
		super(message);
		this.code = code;
	}
}

// =============================================================================
// FONCTION PRINCIPALE (la seule exportée, avec PdfError)
// =============================================================================

/**
 * Extrait les zones et les métiers d'un Rapport des Possibles.
 * @param {Uint8Array} data contenu du PDF (lu en mémoire, pas d'écriture sur disque)
 * @param {string} nom nom du fichier, gardé pour citer la source dans les réponses
 * @returns {Promise<Rapport>}
 */
export async function extractRapport(data, nom) {
	// 1) Ouverture du PDF.
	//    pdfjs "prend possession" du buffer qu'on lui donne (il peut le vider) :
	//    on lui passe donc une copie pour ne pas abîmer les données de l'appelant.
	//    getDocument() ne renvoie pas encore le PDF : il lance le chargement et renvoie
	//    une "tâche de chargement" (on la garde pour pouvoir la détruire à la fin).
	//    verbosity: 0 = pdfjs n'affiche que les erreurs dans la console
	//    (1 = erreurs + avertissements, 5 = tout). Sans ça, on aurait des dizaines de
	//    "Warning: Mismatch between font type..." à chaque rapport.
	const chargement = getDocument({ data: new Uint8Array(data), verbosity: 0 });
	let doc;

	try {
		// chargement.promise = une promesse qui se résout quand le PDF est entièrement analysé.
		// "await" attend ce moment ; doc contient alors le document (nombre de pages, getPage()...).
		// Si le fichier n'est pas un PDF valide, la promesse échoue et on passe dans le catch.
		doc = await chargement.promise;
	} catch {

		// Le fichier n'est pas un PDF valide (ou il est corrompu) :
		// on libère la mémoire puis on renvoie une erreur avec un code connu.
		await chargement.destroy();
		throw new PdfError('PDF_ILLISIBLE', 'Le fichier ne peut pas être lu comme un PDF.');
	}

	try {
		// 2) On lit toutes les pages, et on transforme chacune en une liste de lignes
		//    { page, hauteur, texte }, dans l'ordre de lecture (de haut en bas).
		const lignes = [];
		for (let numero = 1; numero <= doc.numPages; numero++) {
			const page = await doc.getPage(numero);

			// getTextContent() renvoie des "items" : des petits morceaux de texte
			// (parfois un seul mot) avec leur position et leur taille.
			const contenu = await page.getTextContent();

			lignes.push(...regrouperEnLignes(contenu.items, numero));
		}

		// 3) On parcourt les lignes pour reconnaître zones, métiers et descriptions.
		return construireRapport(lignes, nom, doc.numPages);

	} finally {

		// "finally" s'exécute même en cas d'erreur : on libère toujours la mémoire de pdfjs.
		await chargement.destroy();
	}
}

// =============================================================================
// ÉTAPE A : reconstituer les lignes d'une page
// =============================================================================

// Problème : pdfjs ne rend pas les morceaux dans l'ordre de lecture
// (ex. le sous-titre "Métiers accessibles en 0 à 6 mois" arrive APRÈS les métiers de la zone).
// Solution : on regroupe les morceaux qui ont la même position verticale (Y) et la même taille,
// puis on trie les lignes de haut en bas et les morceaux de gauche à droite.
/**
 * @param {any[]} items éléments renvoyés par page.getTextContent() ("any" : forme définie par pdfjs)
 * @param {number} page numéro de la page
 * @returns {Ligne[]}
 */
function regrouperEnLignes(items, page) {
	/** @type {Morceau[]} */
	const morceaux = items

		// On ignore les morceaux vides (espaces, retours à la ligne).
		.filter((it) => it.str.trim() !== '')

		// On garde seulement ce qui nous sert.
		// it.transform est une matrice PDF : [4] = position X, [5] = position Y.
		// Attention : en PDF, Y = 0 est en BAS de la page (plus Y est grand, plus le texte est haut).
		.map((it) => ({
			texte: it.str,
			x: it.transform[4],
			y: it.transform[5],
			hauteur: Math.round(it.height * 10) / 10 // arrondi à 1 décimale (14.83 -> 14.8)
		}))

		// Tri : de haut en bas (Y décroissant), puis de gauche à droite (X croissant).
		.sort((a, b) => b.y - a.y || a.x - b.x);

	// Regroupement : chaque morceau rejoint une ligne existante proche (même Y à 2 points près,
	// même hauteur de texte), sinon il démarre une nouvelle ligne.
	/** @type {{ y: number, hauteur: number, page: number, morceaux: Morceau[] }[]} */
	const lignes = []; // lignes déjà créées pour cette page

	// On traite chaque morceau de texte, du haut vers le bas de la page.
	for (const m of morceaux) {

		// On cherche une ligne existante qui "accueille" ce morceau :
		const ligne = lignes.find(
			(l) =>
				Math.abs(l.y - m.y) <= TOLERANCE_LIGNE && // même hauteur sur la page (écart <= 2 points)
				Math.abs(l.hauteur - m.hauteur) < 1 // même taille de texte (un titre ne se mélange pas au texte)
		);
		// find() renvoie la 1re ligne qui convient, ou undefined si aucune.

		if (ligne) {

			// Ligne trouvée : le morceau est sur cette ligne, on l'ajoute.
			ligne.morceaux.push(m);
		} else {

			// Aucune ligne ne convient : ce morceau commence une nouvelle ligne.
			// On mémorise son Y et sa hauteur pour comparer les morceaux suivants.
			lignes.push({ y: m.y, hauteur: m.hauteur, page, morceaux: [m] });
		}
	}

	// Pour chaque ligne : on remet les morceaux de gauche à droite, on les colle avec un espace,
	// et on nettoie le texte. Les lignes sont renvoyées de haut en bas.
	return lignes
		.sort((a, b) => b.y - a.y)
		.map((l) => ({
			page: l.page,
			hauteur: l.hauteur,
			texte: nettoyer(
				l.morceaux
					.sort((a, b) => a.x - b.x)
					.map((m) => m.texte)
					.join(' ')
			)
		}));
}

// =============================================================================
// ÉTAPE B : reconnaître les zones et les métiers
// =============================================================================

// On lit les lignes une par une, comme un humain qui lit le rapport.
// On se souvient de la zone en cours et du métier en cours :
//   - un titre de zone       -> nouvelle zone (et plus de métier en cours)
//   - un intitulé de métier  -> nouveau métier dans la zone en cours
//   - du texte courant       -> il complète le métier en cours, sinon l'explication de la zone
/**
 * @param {Ligne[]} lignes toutes les lignes du PDF, dans l'ordre de lecture
 * @param {string} nom nom du fichier
 * @param {number} pages nombre de pages
 * @returns {Rapport}
 */
function construireRapport(lignes, nom, pages) {

	/** @type {Zone[]} */
	const zones = [];
	/** @type {Metier[]} */
	const metiers = [];
	/** @type {string[]} */
	const warnings = []; // problèmes détectés, affichés au lieu d'inventer du contenu
	/** @type {Zone | null} */
	let zone = null;     // zone en cours
	/** @type {Metier | null} */
	let metier = null;   // métier en cours

	for (const ligne of lignes) {

		const { texte, hauteur, page } = ligne;

		// --- Cas 1 : titre de zone, ex. "1 ZONE DE MÉTIERS" ---------------------
		// (l'exposant "ère" est sur une autre ligne car il a une autre hauteur)
		// On exige les MAJUSCULES : la page 7 contient "... par zone de métiers" en minuscules,
		// en gros caractères, et ce n'est pas une zone.
		if (hauteur >= HAUTEUR_TITRE_ZONE && /ZONE DE MÉTIERS/.test(texte)) {

			// Le numéro de zone est le premier chiffre de la ligne ("1", "2"...).
			const numero = Number(texte.match(/^(\d)/)?.[1]);

			if (!numero) warnings.push(`Page ${page} : numéro de zone introuvable.`);

			zone = {
				numero: numero || zones.length + 1, // repli : position de la zone dans le rapport
				titre: null,     // "Métiers accessibles en ..." (rempli plus bas)
				explication: '', // paragraphe sous le titre (diplômes, durée)
				vide: false,     // true si le rapport écrit "Aucun métier trouvé pour cette zone"
				page
			};

			zones.push(zone);
			metier = null; // un métier ne continue pas d'une zone à l'autre
			continue;      // ligne traitée, on passe à la suivante
		}

		// Tant qu'on n'a pas rencontré la 1re zone, on est dans les pages 1 à 7
		// (présentation, RIASEC, aptitudes...) : hors MVP, on ignore.
		if (!zone) continue;

		// Numéro de page en bas, ex. "8/17" : on l'ignore.
		if (/^\d+\s*\/\s*\d+$/.test(texte)) continue;

		// --- Cas 2 : intitulé de métier, ex. "Barista" ---------------------------
		if (hauteur >= HAUTEUR_METIER_MIN && hauteur <= HAUTEUR_METIER_MAX) {

			// Un intitulé trop long continue sur une 2e ligne de même taille.
			// On le reconnaît : le métier en cours n'a encore aucune description et il est sur la même page.
			// Dans ce cas on recolle la ligne à l'intitulé au lieu de créer un faux métier.
			if (metier && !metier.description && metier.page === page) {
				metier.intitule = joindre(metier.intitule, texte);
				continue;
			}

			// Identifiant stable : "z2-m3" = 3e métier de la zone 2.
			// Les rapports n'ont pas de code ROME : cet id sert dans l'URL /metier/[id].
			// On copie le numéro dans une constante : dans la fonction passée à filter(),
			// TypeScript ne sait plus que "zone" n'est pas null (variable "let" modifiable).
			const numeroZone = zone.numero;
			const rang = metiers.filter((m) => m.zone === numeroZone).length + 1;
			metier = {
				id: `z${zone.numero}-m${rang}`,
				zone: zone.numero,
				intitule: texte,
				description: '',
				page // page citée comme source dans les réponses
			};
			metiers.push(metier);
			continue;
		}

		// Tout ce qui n'est pas du texte courant (hauteur 10 à 12) est ignoré à partir d'ici :
		// numéro de page, exposant "ème" du titre de la zone suivante, petites mentions...
		if (hauteur < HAUTEUR_TEXTE_MIN || hauteur > HAUTEUR_TEXTE_MAX) continue;

		// --- Cas 3 : texte courant ------------------------------------------------
		if (/^Aucun métier trouvé/i.test(texte)) {

			// Le rapport indique lui-même que la zone est vide : on le note, sans l'ajouter au texte.
			zone.vide = true;

		} else if (!metier && zone.titre === null && /^Métiers accessibles/i.test(texte)) {

			// 1re ligne de la zone : le sous-titre de durée ("Métiers accessibles en 0 à 6 mois").
			zone.titre = texte;

		} else if (metier) {

			// Un métier est en cours : la ligne fait partie de sa description.
			metier.description = joindre(metier.description, texte);
			
		} else {

			// Pas encore de métier dans la zone : c'est l'explication de la zone.
			zone.explication = joindre(zone.explication, texte);
		}
	}

	// --- Contrôles finaux ---------------------------------------------------------
	// On n'invente rien : si quelque chose manque, on l'écrit dans "warnings".
	// tests/pdf.test.js vérifie qu'il n'y a aucun warning sur les 18 rapports.
	if (zones.length !== 5) warnings.push(`${zones.length} zone(s) trouvée(s) au lieu de 5.`);

	for (const z of zones) {

		if (!z.titre) warnings.push(`Zone ${z.numero} : sous-titre de durée introuvable.`);

		const aDesMetiers = metiers.some((m) => m.zone === z.numero);

		// Zone sans métier alors que le rapport ne dit pas "Aucun métier trouvé" : extraction ratée.
		if (!aDesMetiers && !z.vide) warnings.push(`Zone ${z.numero} : aucun métier détecté.`);
		
		// Incohérence inverse : la zone est dite vide mais on y a trouvé des métiers.
		if (aDesMetiers && z.vide) warnings.push(`Zone ${z.numero} : marquée vide mais contient des métiers.`);
	}

	for (const m of metiers) {
		if (!m.description) warnings.push(`${m.id} « ${m.intitule} » : description vide.`);
	}

	return { nom, pages, zones, metiers, warnings };
}

// =============================================================================
// PETITES FONCTIONS UTILITAIRES
// =============================================================================

// Ajoute une ligne à un texte existant.
// Si le texte se termine par un tiret, un mot a été coupé en fin de ligne
// ("week-" + "ends") : on recolle sans espace -> "week-ends".
/**
 * @param {string} texte texte déjà accumulé (peut être vide)
 * @param {string} ligne ligne à ajouter
 * @returns {string}
 */
function joindre(texte, ligne) {

	if (!texte) return ligne;
	
	return texte.endsWith('-') ? texte + ligne : `${texte} ${ligne}`;
}

// Normalise le texte :
//  - apostrophes typographiques (’ ‘) -> apostrophe simple ('), pour faciliter les recherches
//  - plusieurs espaces ou retours à la ligne -> un seul espace
//  - espaces au début et à la fin supprimés
/**
 * @param {string} texte
 * @returns {string}
 */
function nettoyer(texte) {
	return texte.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
}
