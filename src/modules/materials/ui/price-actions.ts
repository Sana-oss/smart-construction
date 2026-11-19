'use server';

// Server Actions for the price log (design S24.3, and deleting from S24.2). Run on the server as the signed-in user,
// under RLS. The project comes from the session, never from the form; the use case checks every value.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { getMyProject } from '@/modules/projects';
import { createServerSupabase } from '@/platform/supabase/server';
import { addPrice, removePrice } from '../application/prices';
import type { PriceField } from '../domain/price';
import { supabasePriceStore } from '../infra/supabase-price-store';
import { priceErrorsAr, priceFailedAr } from './messages.ar';
import { PRICES_PATH, priceHistoryPath } from './routes';

const FIELDS = ['material', 'unit', 'price', 'kind', 'supplier', 'recordedOn', 'expiresOn', 'transport', 'note'] as const;
type Field = (typeof FIELDS)[number];

export interface PriceFormState {
  fieldErrors?: Partial<Record<PriceField, string>>;
  formError?: string;
  /** What the owner typed, sent back after an error (React resets the form). */
  values?: Partial<Record<Field, string>>;
}

export async function addPriceAction(_prev: PriceFormState, form: FormData): Promise<PriceFormState> {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? '')])) as Record<Field, string>;
  const project = await getMyProject();
  if (!project) return { formError: priceFailedAr.no_project, values };

  const result = await addPrice(supabasePriceStore(await createServerSupabase()), { ...values, projectId: project.id }, todayInTripoli());
  if (!result.ok) {
    if (result.kind === 'failed') return { formError: priceFailedAr[result.reason], values };
    const fieldErrors: PriceFormState['fieldErrors'] = {};
    for (const e of result.errors) fieldErrors[e.field] ??= priceErrorsAr[e.code];
    return { fieldErrors, values };
  }
  revalidatePath(PRICES_PATH, 'layout');
  redirect(`${priceHistoryPath(result.material, result.unit)}&done=added`);
}

/** Bound to one row. Goes back to the same history (or the log when it was the last price). */
export async function deletePriceAction(id: string, material: string, unit: string): Promise<void> {
  const project = await getMyProject();
  if (!project) redirect(PRICES_PATH);
  const result = await removePrice(supabasePriceStore(await createServerSupabase()), { projectId: project.id, id });
  revalidatePath(PRICES_PATH, 'layout');
  redirect(result.ok ? `${priceHistoryPath(material, unit)}&done=deleted` : priceHistoryPath(material, unit));
}
