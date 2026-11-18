import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export type ParsedZone = {
	zone: string;
	jobs: string[];
};

const normalize = (value: string) =>
	value
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase();

const getZoneName = (text: string) => {
	const match = normalize(text).match(/(\d+)\s*(?:(?:ere|er|eme|e)\s*)?zone\s+de\s+metiers/);

	if (!match) return undefined;

	const number = Number(match[1]);
	return `${number}${number === 1 ? 'ère' : 'ème'} ZONE DE MÉTIERS`;
};

export async function parseReport(data: Uint8Array): Promise<ParsedZone[]> {
	const loadingTask = getDocument({ data });
	const zones: ParsedZone[] = [];
	let currentZone: ParsedZone | undefined;

	try {
		const document = await loadingTask.promise;

		for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
			const page = await document.getPage(pageNumber);
			const content = await page.getTextContent();
			const text = content.items
				.filter((item) => 'str' in item)
				.map((item) => ('str' in item ? item.str : ''))
				.join(' ');
			const zoneName = getZoneName(text);

			if (zoneName) {
				currentZone = { zone: zoneName, jobs: [] };
				zones.push(currentZone);
			}

			if (!currentZone) continue;

			for (const item of content.items) {
				if (!('str' in item)) continue;

				const value = item.str.trim();
				const normalizedValue = normalize(value);

				if (
					!value ||
					item.height < 14 ||
					item.height >= 30 ||
					/^\d+$/.test(value) ||
					normalizedValue === 'zone de metiers'
				) {
					continue;
				}

				currentZone.jobs.push(value);
			}
		}

		return zones;
	} finally {
		await loadingTask.destroy();
	}
}
