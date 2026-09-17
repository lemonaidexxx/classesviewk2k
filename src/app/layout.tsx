import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'K2K · Executive Class Overview',
  description: 'A clear view of K2K training delivery.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
