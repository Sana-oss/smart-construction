// Numbers typed by owners on Arabic keyboards: Arabic-Indic (٠-٩) and Persian (۰-۹) digits, the Arabic
// thousands separator (٬) and decimal separator (٫), and Latin commas like "450,000".

/** Arabic-Indic and Persian digits -> ASCII digits. Everything else is left as is. */
export function toAsciiDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * A typed decimal number -> its canonical string ("450,000" -> "450000", "٢٤٠٫٥" -> "240.5"), or null if it is
 * not a plain non-negative number. Returns a STRING on purpose: money must never become a JS number
 * (CLAUDE.md data rules); pass the result to money() from this kernel.
 */
export function parseDecimalInput(input: string | null | undefined): string | null {
  const value = toAsciiDigits(input ?? '')
    .trim()
    .replace(/[\s,٬]/g, '') // spaces, Latin comma and Arabic thousands separator
    .replace(/٫/g, '.'); // Arabic decimal separator
  return /^\d+(\.\d+)?$/.test(value) ? value.replace(/^0+(?=\d)/, '') : null;
}
