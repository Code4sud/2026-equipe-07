import { readdir, readFile } from 'node:fs/promises';
import { resolve, parse } from 'node:path';

const reportsDirectory = resolve('data/rapports');

/** @type {import('./$types').LayoutServerLoad} */
export const load = async () => {
    let files;

    try {
        files = await readdir(reportsDirectory, { withFileTypes: true });
    } catch (error) {
        if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') {
            return { reportList: [] };
        }
        throw error;
    }

    const reportList = await Promise.all(
        files
            .filter(
                (file) =>
                    file.isFile() &&
                    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/.test(file.name)
            )
            .map(async (file) => {
                const report = JSON.parse(await readFile(resolve(reportsDirectory, file.name), 'utf8'));

                return {
                    name: report.nom,
                    uuid: parse(file.name).name
                };
            })
    );

    return { reportList };
};
