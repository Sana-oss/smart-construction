import { redirect } from 'next/navigation';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { calcTextAr, getRebarCalculatorView, REBAR_PARAMS, RebarCalculator } from '@/modules/materials';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../_shell/BottomNav';

export const metadata = { title: `${calcTextAr.rebar.pageTitle} · ركيزة` };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

// Rebar calculator (design S22.1 form, S22.2 result; FR-MAT-04). The form is sent with GET: nothing is saved.
export default async function RebarPage({ searchParams }: { searchParams: Promise<Params> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  if (!(await getMyProject())) redirect(SETUP_DETAILS_PATH);

  const params = await searchParams;
  const values: Record<string, string> = {};
  for (const p of Object.values(REBAR_PARAMS)) if (one(params[p]) !== '') values[p] = one(params[p]);
  const submitted = Object.keys(values).length > 0;
  const view = await getRebarCalculatorView(
    submitted ? { diameterMm: values.d, lengthM: values.l, count: values.n, wastePct: values.w, priceLydPerTon: values.p } : null,
  );
  return (
    <>
      <RebarCalculator view={view} values={values} editing={one(params.edit) === '1'} />
      <BottomNav active="materials" />
    </>
  );
}
