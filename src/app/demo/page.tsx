import type { Metadata } from 'next';
import { GuidedDemo } from '@/components/guided-demo';

export const metadata: Metadata = {
  title: 'Try FinePrint | Guided demo',
  description:
    'Follow a real rule revision from its sources to a typed check, then inspect a recorded Sanity Context retrieval.',
};

export default function Page() {
  return <GuidedDemo />;
}
