import type { Status } from '@/lib/model';
export const statusLabels: Record<Status, string> = {
  supported: 'Supported',
  blocked: 'Blocked',
  missing: 'Missing fact',
  unclear: 'Rules unclear',
  'not-applicable': 'Not applicable',
};
export function StatusTag({ status }: { status: Status }) {
  return <span className={`status-tag ${status}`}>{statusLabels[status]}</span>;
}
