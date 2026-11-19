// Lucide icon used by the materials screens (brand guideline: one icon set, Lucide). Inlined so no icon library
// is added as a dependency. Same icon as in the projects screens; modules on different levels do not share
// UI files.

/** "Back" in an RTL interface: Lucide chevron-left turned around, as in the design. */
export function BackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      style={{ transform: 'rotate(180deg)' }}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
