import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import { thmanyah } from './fonts';
import './globals.css';

export const metadata = { title: 'ركيزة' };

// Phones first (owners use the system on site): fit the screen, respect notches.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#3f3f3f',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={thmanyah.variable}>
      <body>{children}</body>
    </html>
  );
}
