// Is each installment due? (FR-FIN-09) Composed here because it needs two other modules: projects (the phase's status) and
// documents (the phase's photos), and finance may import neither (rule R2). The rule itself is finance's paymentDue.

import { getProjectPhotos } from '@/modules/documents';
import { paymentDue, type DueState } from '@/modules/finance';

export async function dueByPayment(
  project: { id: string; phases: { id: string; status: string }[] },
  payments: { id: string; phaseId: string | null }[],
): Promise<Record<string, DueState>> {
  const photoCount = new Map<string, number>();
  // Photos are only read when some installment is tied to a phase.
  if (payments.some((p) => p.phaseId !== null)) {
    for (const photo of await getProjectPhotos(project.id)) {
      if (photo.phaseId) photoCount.set(photo.phaseId, (photoCount.get(photo.phaseId) ?? 0) + 1);
    }
  }
  const status = new Map(project.phases.map((ph) => [ph.id, ph.status]));
  return Object.fromEntries(
    payments.map((p) => [
      p.id,
      paymentDue({ phaseId: p.phaseId, phaseStatus: p.phaseId ? (status.get(p.phaseId) ?? null) : null, phasePhotoCount: p.phaseId ? (photoCount.get(p.phaseId) ?? 0) : 0 }),
    ]),
  );
}
