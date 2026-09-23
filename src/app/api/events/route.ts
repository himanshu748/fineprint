import { eventCatalog } from '@/lib/events';
import { loadRulePack } from '@/lib/sanity';

export const runtime = 'nodejs';
export async function GET() {
  const results = await Promise.allSettled(eventCatalog.map((event) => loadRulePack(event.id)));
  return Response.json(
    {
      checkedAt: new Date().toISOString(),
      events: results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
      unavailable: results.flatMap((result, index) =>
        result.status === 'rejected' ? [eventCatalog[index].id] : [],
      ),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
