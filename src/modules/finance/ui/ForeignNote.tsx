// «1,000 USD بسعر 7.25»: what was paid in a foreign currency (3.18). Each number sits in its own <bdi dir="ltr">, so
// the Arabic word between them keeps its place in a right-to-left line.

import { formatAmount } from '@/shared-kernel';
import type { ForeignRecord } from '../domain/currency';
import { currencyTextAr } from './messages.ar';

export function ForeignNote({ foreign }: { foreign: ForeignRecord }) {
  return (
    <>
      <bdi dir="ltr">
        {formatAmount(foreign.originalAmount)} {foreign.currency}
      </bdi>{' '}
      {currencyTextAr.at} <bdi dir="ltr">{foreign.rateLydPerUnit.replace(/\.?0+$/, '')}</bdi>
    </>
  );
}
