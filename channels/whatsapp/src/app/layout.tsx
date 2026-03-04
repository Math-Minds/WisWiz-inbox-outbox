import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WisWiz Influencer CRM',
  description: 'Influencer management, deal tracking, en communicatie',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
