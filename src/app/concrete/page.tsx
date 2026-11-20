import { redirect } from 'next/navigation';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, phasePath, PROJECT_HOME_PATH, SETUP_DETAILS_PATH } from '@/modules/projects';
import { ConcreteLog, concreteTextAr, getConcreteLogView } from '@/modules/quality';
import { BottomNav } from '../_shell/BottomNav';

export const metadata = { title: `${concreteTextAr.log.pageTitle} · ركيزة` };

// The concrete log (design S27.1), of the project or of one phase (?phase=).
export default async function ConcretePage({ searchParams }: { searchParams: Promise<{ phase?: string; done?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { phase: phaseId, done } = await searchParams;
  const phase = project.phases.find((p) => p.id === phaseId) ?? null;
  const log = await getConcreteLogView(project.id, phase?.id ?? null);
  return (
    <>
      <ConcreteLog
        log={log}
        phase={phase ? { id: phase.id, name: phase.name } : null}
        backHref={phase ? phasePath(phase.id) : PROJECT_HOME_PATH}
        notice={done === 'deleted' ? 'deleted' : null}
      />
      <BottomNav active={phase ? 'phases' : 'home'} />
    </>
  );
}
