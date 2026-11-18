import { redirect } from 'next/navigation';
import { getProjectPhotos, PhotoGallery, photosTextAr } from '@/modules/documents';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, PROJECT_HOME_PATH, SETUP_DETAILS_PATH } from '@/modules/projects';

export const metadata = { title: `${photosTextAr.gallery.pageTitle} · ركيزة` };

// Site photos (FR-DOC-02, design S31.1). Thin route: the screen lives in the documents module; the phases come from
// the projects module (documents never reads the phases table).
export default async function PhotosPage() {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const photos = await getProjectPhotos(project.id);
  return <PhotoGallery photos={photos} phases={project.phases} homeHref={PROJECT_HOME_PATH} />;
}
