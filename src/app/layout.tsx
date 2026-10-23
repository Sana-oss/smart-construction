import type { ReactNode } from 'react';
import './globals.css';

export const metadata = { title: 'مدير مشاريع البناء السكنية' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
