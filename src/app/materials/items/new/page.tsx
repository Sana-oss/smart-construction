import { redirect } from 'next/navigation';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { ItemForm, MATERIALS_PATH, qtyTextAr } from '@/modules/materials';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';

export const metadata = { title: `${qtyTextAr.itemForm.pageTitle} · ركيزة` };

// Add a line to the quantity table (FR-MAT-01). No bottom navigation: a form keeps its save button at the bottom.
export default async function NewItemPage() {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  return <ItemForm phases={project.phases.map((p) => ({ id: p.id, name: p.name }))} backHref={MATERIALS_PATH} />;
}
