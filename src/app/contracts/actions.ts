'use server';

// Server Actions: add a contract (FR-FIN-08) and edit one (3.16 deepening). It lives in the app layer because the contract copy is a document, and
// finance may not import documents (rule R2): this is where the two modules are composed. The project comes from the
// session, never from the form; the copy must be one of THIS project's documents of type «عقد».

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getProjectDocuments } from '@/modules/documents';
import {
  changeContract,
  CONTRACT_FORM_FIELDS,
  contractErrorsAr,
  contractFailedAr,
  contractPath,
  saveContract,
  type ContractFormState,
} from '@/modules/finance';
import { getMyProject } from '@/modules/projects';

export async function addContractAction(_prev: ContractFormState, form: FormData): Promise<ContractFormState> {
  const values = Object.fromEntries(CONTRACT_FORM_FIELDS.map((k) => [k, String(form.get(k) ?? '')])) as Record<(typeof CONTRACT_FORM_FIELDS)[number], string>;
  const project = await getMyProject();
  if (!project) return { formError: contractFailedAr.no_project, values };

  if (values.documentId.trim() !== '') {
    const wanted = values.documentId.trim().toLowerCase();
    const documents = await getProjectDocuments(project.id);
    if (!documents.some((d) => d.id === wanted && d.kind === 'contract')) {
      return { fieldErrors: { documentId: contractErrorsAr.invalid_id }, values };
    }
  }

  const result = await saveContract({ ...values, projectId: project.id });
  if (!result.ok) {
    if (result.kind === 'failed') return { formError: contractFailedAr[result.reason], values };
    const fieldErrors: ContractFormState['fieldErrors'] = {};
    for (const e of result.errors) fieldErrors[e.field] ??= contractErrorsAr[e.code];
    return { fieldErrors, values };
  }
  revalidatePath('/', 'layout');
  redirect(`${contractPath(result.id)}?done=added`);
}

/** Bound to one contract: edit it after saving (3.16 deepening). The contract copy is checked the same way as when adding. */
export async function updateContractAction(contractId: string, _prev: ContractFormState, form: FormData): Promise<ContractFormState> {
  const values = Object.fromEntries(CONTRACT_FORM_FIELDS.map((k) => [k, String(form.get(k) ?? '')])) as Record<(typeof CONTRACT_FORM_FIELDS)[number], string>;
  const project = await getMyProject();
  if (!project) return { formError: contractFailedAr.no_project, values };

  if (values.documentId.trim() !== '') {
    const wanted = values.documentId.trim().toLowerCase();
    const documents = await getProjectDocuments(project.id);
    if (!documents.some((d) => d.id === wanted && d.kind === 'contract')) {
      return { fieldErrors: { documentId: contractErrorsAr.invalid_id }, values };
    }
  }

  const result = await changeContract({ ...values, projectId: project.id, id: contractId });
  if (!result.ok) {
    if (result.kind === 'failed') return { formError: contractFailedAr[result.reason], values };
    const fieldErrors: ContractFormState['fieldErrors'] = {};
    for (const e of result.errors) fieldErrors[e.field] ??= contractErrorsAr[e.code];
    return { fieldErrors, values };
  }
  revalidatePath('/', 'layout');
  redirect(`${contractPath(contractId)}?done=updated`);
}
