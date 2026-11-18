import { redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { PhotoForm, photosTextAr } from '@/modules/documents';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { currentPhaseOf, getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';

export const metadata = { title: `${photosTextAr.form.pageTitle} · ركيزة` };

// Add a site photo and a note (FR-DOC-02, design S31.2). The form starts on the current phase and today's date.
export default async function NewPhotoPage() {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const current = currentPhaseOf(project.phases);
  return (
    <PhotoForm phases={project.phases.map((p) => ({ id: p.id, name: p.name, current: p.id === current?.id }))} today={todayInTripoli()} />
  );
}
