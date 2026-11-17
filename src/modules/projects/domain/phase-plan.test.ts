import { describe, expect, it } from 'vitest';
import { currentPhaseOf, planInitialPhases } from './phase-plan';

// Same shape as the template seeded in migration 0006 (names from design S02.2).
const template = [
  { position: 3, name: 'المباني والتأسيسات' },
  { position: 1, name: 'الحفر والأساسات' },
  { position: 4, name: 'التشطيب والتسليم' },
  { position: 2, name: 'الهيكل الخرساني' },
];
const statuses = (r: ReturnType<typeof planInitialPhases>) => (r.ok ? r.value.map((p) => p.status) : null);

describe('planInitialPhases', () => {
  it('by default marks earlier phases done, the chosen one in progress, later ones not started', () => {
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

  it('keeps an earlier phase in progress when the owner says it is not finished (solution B)', () => {
    expect(statuses(planInitialPhases(template, 3, [1]))).toEqual(['in_progress', 'done', 'in_progress', 'not_started']);
    expect(statuses(planInitialPhases(template, 3, [1, 2]))).toEqual(['in_progress', 'in_progress', 'in_progress', 'not_started']);
  });

  it('ignores "not finished" answers for the current phase and later ones', () => {
    // Left over when the owner moves the current phase back after unticking: they cannot mean anything.
    expect(statuses(planInitialPhases(template, 2, [2, 3, 4, 9]))).toEqual(['done', 'in_progress', 'not_started', 'not_started']);
  });

  it('first phase current: nothing is done', () => {
    expect(statuses(planInitialPhases(template, 1))).toEqual(['in_progress', 'not_started', 'not_started', 'not_started']);
  });

  it('requires a current phase that exists in the template', () => {
    expect(planInitialPhases(template, null)).toEqual({ ok: false, error: 'current_phase_required' });
    expect(planInitialPhases(template, 9)).toEqual({ ok: false, error: 'current_phase_unknown' });
    expect(planInitialPhases([], 1)).toEqual({ ok: false, error: 'template_empty' });
  });
});

describe('currentPhaseOf', () => {
  const phase = (position: number, status: 'done' | 'in_progress' | 'not_started') => ({ position, status });

  it('is the furthest phase in progress, not the first one', () => {
    expect(currentPhaseOf([phase(1, 'in_progress'), phase(2, 'done'), phase(3, 'in_progress'), phase(4, 'not_started')])).toEqual(
      phase(3, 'in_progress'),
    );
  });

  it('does not depend on the order of the list', () => {
    expect(currentPhaseOf([phase(3, 'in_progress'), phase(1, 'in_progress')])).toEqual(phase(3, 'in_progress'));
  });

  it('is null when no phase is in progress', () => {
    expect(currentPhaseOf([phase(1, 'done'), phase(2, 'not_started')])).toBeNull();
    expect(currentPhaseOf([])).toBeNull();
  });
});
