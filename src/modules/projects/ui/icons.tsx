// Lucide icons used by the projects screens (brand guideline: one icon set, Lucide, 1.5–2 px strokes).
// Inlined so no icon library is added as a dependency.

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

/** "Back" in an RTL interface: Lucide chevron-left turned around, as in the design. */
export function BackIcon() {
  return (
    <svg {...base} style={{ transform: 'rotate(180deg)' }}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

/** Lucide "coins": the icon the design uses on phase rows (S02.2). */
export function CoinsIcon() {
  return (
    <svg {...base}>
      <path d="M13.744 17.736a6 6 0 1 1-7.48-7.48" />
      <path d="M15 6h1v4" />
      <path d="m6.134 14.768.866-.5 2 3.464" />
      <circle cx="16" cy="8" r="6" />
    </svg>
  );
}

/** Lucide "layers": phases (brand guideline). */
export function LayersIcon() {
  return (
    <svg {...base}>
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
      <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
      <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
    </svg>
  );
}

/** Lucide "wallet": budget (brand guideline). */
export function WalletIcon() {
  return (
    <svg {...base}>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}

/** Lucide "users": project team. */
export function UsersIcon() {
  return (
    <svg {...base}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
