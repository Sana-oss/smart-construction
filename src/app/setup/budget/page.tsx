import { BudgetStep } from '@/modules/projects';

export const metadata = { title: 'ميزانية المشروع · ركيزة' };

// Wizard step 3 (design S02.3).
export default function BudgetPage() {
  return <BudgetStep />;
}
