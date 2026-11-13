import localFont from 'next/font/local';

// Thmanyah Sans, the brand font (Design/Guidelines): Bold for titles and key numbers, Light for text.
// Served from our own build (next/font), not a third-party CDN. Licence: to be confirmed (change register).
export const thmanyah = localFont({
  src: [
    { path: '../../Design/Fonts/thmanyahsans-Light.otf', weight: '300', style: 'normal' },
    { path: '../../Design/Fonts/thmanyahsans-Bold.otf', weight: '700', style: 'normal' },
  ],
  variable: '--font-thmanyah',
  display: 'swap',
});
