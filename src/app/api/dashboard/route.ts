import { getSnapshot, SourceError } from '@/lib/sheets';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'no-store' };
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (
    [...params.keys()].some((key) => key !== 'refresh') ||
    (params.has('refresh') && params.get('refresh') !== '1')
  )
    return Response.json({ error: 'Unsupported request parameters.' }, { status: 400, headers });
  try {
    return Response.json(await getSnapshot(params.get('refresh') === '1'), { headers });
  } catch (error) {
    const known = error instanceof SourceError;
    return Response.json(
      {
        code: known ? error.code : 'temporary',
        error: known ? error.message : 'Unable to refresh data.',
      },
      { status: 503, headers },
    );
  }
}
