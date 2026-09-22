import { connectionState } from '@/lib/sanity';
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json(connectionState(), { headers: { 'Cache-Control': 'no-store' } });
}
