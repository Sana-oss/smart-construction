import { redirect } from 'next/navigation';
import { SETUP_DETAILS_PATH } from '@/modules/projects';

export default function SetupIndex() {
  redirect(SETUP_DETAILS_PATH);
}
