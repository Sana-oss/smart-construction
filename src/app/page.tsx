import { budgetSummary } from '@/modules/finance';

export default function Home() {
  const s = budgetSummary('100000', '25000', '10');
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>نظام ذكي لإدارة ومتابعة مشاريع البناء السكنية</h1>
      <p>الهيكل جاهز. المتبقي من الميزانية (مثال): {s.remaining.toFixed(3)} د.ل</p>
    </main>
  );
}
