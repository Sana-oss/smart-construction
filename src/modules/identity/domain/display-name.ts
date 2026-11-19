// The owner's first name for greetings (design S07.1: «مرحبًا محمد»). Pure.

/** The first word of the full name, or null when there is no name. "  محمد  علي " -> "محمد". */
export function firstName(fullName: string | null | undefined): string | null {
  const first = (fullName ?? '').trim().split(/\s+/)[0];
  return first ? first : null;
}
