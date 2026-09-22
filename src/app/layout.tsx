import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'FinePrint — eligibility, explained',
  description:
    'Understand which competition requirements apply to your project, with sources and explicit uncertainty.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
