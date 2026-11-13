import { getPhaseTemplate, ReviewStep } from '@/modules/projects';

export const metadata = { title: 'مشروعك جاهز · ركيزة' };

// Wizard step 4, the last one (design S02.5): review, then create the project in one transaction.
export default async function ReviewPage() {
  return <ReviewStep template={await getPhaseTemplate()} />;
}
