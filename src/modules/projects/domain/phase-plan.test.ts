import { describe, expect, it } from 'vitest';
import { planInitialPhases } from './phase-plan';

// Same shape as the template seeded in migration 0006 (names from design S02.2).
const template = [
  { position: 3, name: 'المباني والتأسيسات' },
  { position: 1, name: 'الحفر والأساسات' },
  { position: 4, name: 'التشطيب والتسليم' },
  { position: 2, name: 'الهيكل الخرساني' },
];

describe('planInitialPhases', () => {
  it('marks earlier phases done, the chosen one in progress, later ones not started', () => {
    const r = planInitialPhases(template, 2);
    expect(r).toEqual({
      ok: true,
      value: [
        { position: 1, name: 'الحفر والأساسات', status: 'done' },
        { position: 2, name: 'الهيكل الخرساني', status: 'in_progress' },
        { position: 3, name: 'المباني والتأسيسات', status: 'not_started' },
        { position: 4, name: 'التشطيب والتسليم', status: 'not_started' },
      ],
    });
  });

  it('first phase current: nothing is done', () => {
    const r = planInitialPhases(template, 1);
    expect(r.ok && r.value.map((p) => p.status)).toEqual(['in_progress', 'not_started', 'not_started', 'not_started']);
  });

  it('requires a current phase that exists in the template', () => {
    expect(planInitialPhases(template, null)).toEqual({ ok: false, error: 'current_phase_required' });
    expect(planInitialPhases(template, 9)).toEqual({ ok: false, error: 'current_phase_unknown' });
    expect(planInitialPhases([], 1)).toEqual({ ok: false, error: 'template_empty' });
  });
});
