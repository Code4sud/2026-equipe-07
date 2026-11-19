import { error } from '@sveltejs/kit';
import { readReport } from '#lib/server/reports.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
  const report = await readReport(params.filename);
  if (report === null) error(404, 'Rapport introuvable');
  return new Response(report, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
