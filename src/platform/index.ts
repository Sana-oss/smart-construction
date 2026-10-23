// Platform: configuration and feature flags. Depends only on shared-kernel.
export const MODULE_NAMES = [
  'identity', 'projects', 'finance', 'materials', 'quality', 'documents',
  'knowledge', 'decisions', 'trades', 'dashboard', 'notifications',
] as const;
export type ModuleName = (typeof MODULE_NAMES)[number];
