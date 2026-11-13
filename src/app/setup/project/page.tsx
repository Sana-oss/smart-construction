import { DetailsStep } from '@/modules/projects';

export const metadata = { title: 'بيانات المشروع · ركيزة' };

// Wizard step 1 (design S02.1). Thin route: the screen lives in the projects module.
export default function ProjectDetailsPage() {
  return <DetailsStep />;
}
