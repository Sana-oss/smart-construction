import { z } from 'zod';

// Public configuration (safe for the browser). Read each NEXT_PUBLIC_* variable by its literal name:
// Next.js only inlines them into the browser bundle when written out in full like this.
const publicSchema = z.object({
  supabaseUrl: z.url(),
  supabaseKey: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicSchema>;

export function publicEnv(): PublicEnv {
  const parsed = publicSchema.safeParse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    // Fail loudly at startup instead of sending requests to an undefined URL.
    throw new Error('Missing or invalid NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).');
  }
  return parsed.data;
}
