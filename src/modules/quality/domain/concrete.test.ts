import { describe, expect, it } from 'vitest';
import { dueReminders, pourTotals, validatePour } from './concrete';

const TODAY = '2026-11-20';
const PHASE = '7f1c0d2e-5b8a-4c3d-9e6f-1a2b3c4d5e6f';
const OP = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const known = (id: string) => id === PHASE;

describe('validatePour (FR-QLT-04, design S27.2)', () => {
  it('accepts the design fields, with the engineer dates for curing and formwork', () => {
    const r = validatePour(
      {
        element: ' سقف  الدور الأرضي ',
        pouredOn: '2026-11-12',
        supplier: 'الخرسانة الحديثة',
        qtyM3: '٣٠٫٥',
        cubeSamples: '6',
        mixRef: 'حسب مستند المشروع',
        deliveryRef: 'DN-024',
        phaseId: PHASE,
        curingUntil: '2026-11-19',
        formworkOn: '2026-12-03',
        clientOpId: OP,
      },
      TODAY,
      known,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ element: 'سقف الدور الأرضي', supplier: 'الخرسانة الحديثة', cubeSamples: 6, deliveryRef: 'DN-024', formworkOn: '2026-12-03' });
    expect(r.value.qtyM3.toString()).toBe('30.5');
  });

  it('needs a date, a supplier and a quantity (the requirement), and an element', () => {
    const r = validatePour({ clientOpId: OP }, TODAY, known);
    expect(r.ok ? [] : r.errors.map((e) => `${e.field}:${e.code}`)).toEqual(['element:required', 'pouredOn:required', 'supplier:required', 'qtyM3:required']);
  });

  it('refuses a future pour, reminder dates before the pour, and bad numbers', () => {
    const r = validatePour(
      { element: 'قواعد', pouredOn: '2026-11-21', supplier: 'مورد', qtyM3: '0', cubeSamples: '2.5', clientOpId: OP },
      TODAY,
      known,
    );
    expect(r.ok ? [] : r.errors.map((e) => `${e.field}:${e.code}`)).toEqual(['pouredOn:date_in_future', 'qtyM3:must_be_positive', 'cubeSamples:must_be_whole']);
    const early = validatePour(
      { element: 'قواعد', pouredOn: '2026-11-10', supplier: 'مورد', qtyM3: '12', curingUntil: '2026-11-09', formworkOn: '2026-11-01', phaseId: 'x', clientOpId: '' },
      TODAY,
      known,
    );
    expect(early.ok ? [] : early.errors.map((e) => `${e.field}:${e.code}`)).toEqual([
      'phaseId:invalid_reference',
      'curingUntil:before_pour',
      'formworkOn:before_pour',
      'clientOpId:required',
    ]);
  });
});

describe('dueReminders (FR-QLT-05)', () => {
  const pour = (over: object) => ({ id: 'p1', element: 'سقف الدور الأرضي', curingUntil: null, curingDone: false, formworkOn: null, formworkDone: false, ...over });

  it('shows a reminder from two days before its date, and keeps a late one until done', () => {
    const r = dueReminders(
      [
        pour({ id: 'a', element: 'أعمدة', curingUntil: '2026-11-22', formworkOn: '2026-11-23' }),
        pour({ id: 'b', element: 'قواعد', formworkOn: '2026-11-18' }),
        pour({ id: 'c', element: 'سقف', curingUntil: '2026-11-20', curingDone: true }),
      ],
      TODAY,
    );
    expect(r.map((x) => `${x.element}:${x.kind}:${x.days}`)).toEqual(['قواعد:formwork:-2', 'أعمدة:curing:2']);
  });

  it('shows nothing without a date', () => {
    expect(dueReminders([pour({})], TODAY)).toEqual([]);
  });
});

describe('pourTotals (design S27.1)', () => {
  it('adds the quantities exactly', () => {
    const t = pourTotals([{ qtyM3: '18.000' }, { qtyM3: '30.100' }, { qtyM3: '0.200' }]);
    expect([t.totalM3.toString(), t.count]).toEqual(['48.3', 3]);
  });
});
