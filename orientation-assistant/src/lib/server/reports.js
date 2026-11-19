import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const directory = resolve('data/rapports');

/** @param {unknown} report */
export async function saveReport(report) {
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.json`;
  await writeFile(join(directory, filename), JSON.stringify(report, null, 2), {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600
  });
  return `/rapports/${filename}`;
}

/** @param {string} filename */
export async function readReport(filename) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/.test(filename)) {
    return null;
  }
  try {
    return await readFile(join(directory, filename), 'utf8');
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') return null;
    throw error;
  }
}