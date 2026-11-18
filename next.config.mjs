// Security headers sent with every response (NFR-SEC). Each one closes a well-known browser risk:
//   X-Frame-Options / frame-ancestors: no other site may show our pages inside a frame (clickjacking:
//     tricking an owner into pressing "confirm" on a hidden page).
//   X-Content-Type-Options: the browser must not guess a file's type (an uploaded "image" run as a script).
//   Referrer-Policy: other sites learn only our address, not the page the owner came from.
//   Permissions-Policy: the app asks for the camera (receipt and site photos) and nothing else.
// A full Content-Security-Policy for scripts is not set here: Next.js needs a per-request nonce for it,
// which is a separate, larger change.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Do not tell visitors which framework serves the site.
  poweredByHeader: false,
  // The development badge sits in the bottom-left corner, on top of the bottom navigation's «المزيد» tab, and
  // catches its taps. Development only; production never shows it.
  devIndicators: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
export default nextConfig;
