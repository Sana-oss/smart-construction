import type { NextRequest } from 'next/server';
import { refreshSession } from '@/platform/supabase/session';

// Next.js 16 "proxy" (formerly middleware): runs before every matched request.
// Its only job here is keeping the Supabase session fresh. It does NOT protect pages:
// authorization is enforced by RLS in the database and by checking the user in each page/action.
export async function proxy(request: NextRequest) {
  return refreshSession(request);
}

export const config = {
  // Everything except Next internals and static images.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
