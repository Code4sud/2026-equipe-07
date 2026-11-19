// pdfjs-dist -> { nom, pages, zones, metiers: [{ id, zone, intitule, description, page }], warnings }
export async function extraireRapport(buffer, nom) {}
function grouperParLigne(items) {} // regroupe par Y, trie par X
function detecterZones(lignes) {} // titre « nème ZONE DE MÉTIERS » (hauteur 22) + sous-titre « Métiers accessibles en… »
function extraireMetiers(lignes, zone) {} // intitulé (hauteur 15) + description (hauteur 11)
