import { notFound, redirect } from 'next/navigation';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { calcTextAr, GEOMETRIC_FIELDS, GeometricCalculator, isGeometricKind, runGeometricCalculator } from '@/modules/materials';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../../_shell/BottomNav';

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  return { title: `${isGeometricKind(kind) ? calcTextAr.geometric[kind].title : calcTextAr.others.pageTitle} · ركيزة` };
}

// One geometric calculator (design S23.2 «حجم الخرسانة», and the finish area and tile count). GET form: nothing is saved.
export default async function GeometricCalculatorPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<Params>;
}) {
  const { kind } = await params;
  if (!isGeometricKind(kind)) notFound();
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  if (!(await getMyProject())) redirect(SETUP_DETAILS_PATH);

  const query = await searchParams;
  const values: Record<string, string> = {};
  for (const f of GEOMETRIC_FIELDS[kind]) if (one(query[f]) !== '') values[f] = one(query[f]);
  const calculation = Object.keys(values).length > 0 ? runGeometricCalculator(kind, values) : null;
  return (
    <>
      <GeometricCalculator kind={kind} values={values} calculation={calculation} />
      <BottomNav active="materials" />
    </>
  );
}
