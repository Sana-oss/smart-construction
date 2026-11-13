'use client';

// The wizard's answers live in the browser (sessionStorage) until the last step creates the project in one go
// (decision 4 of 14 Nov 2026). They survive a page refresh, disappear when the tab is closed, and are deleted as
// soon as the project is created. Nothing here is trusted by the server: the final step re-validates everything.

import { useCallback, useEffect, useState } from 'react';
import type { WizardDraft } from '../application/create-first-project';
import { DEFAULT_CONTINGENCY_PCT } from '../domain/project-setup';

const KEY = 'rakeeza.first-project-draft.v1';

const initial: WizardDraft = { contingencyPct: DEFAULT_CONTINGENCY_PCT };

function read(): WizardDraft {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? { ...initial, ...(JSON.parse(raw) as WizardDraft) } : initial;
  } catch {
    return initial; // private mode or blocked storage: the wizard still works, just without refresh recovery
  }
}

export function useWizardDraft() {
  const [draft, setDraft] = useState<WizardDraft | null>(null); // null until loaded (avoids a server/client mismatch)

  useEffect(() => {
    setDraft(read());
  }, []);

  const update = useCallback((patch: Partial<WizardDraft>) => {
    setDraft((prev) => {
      const next = { ...(prev ?? initial), ...patch };
      try {
        window.sessionStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: keep it in memory only */
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    try {
      window.sessionStorage.removeItem(KEY);
    } catch {
      /* nothing to clear */
    }
  }, []);

  return { draft, update, clear };
}
