import React from 'react';
import { ORDER_STATUSES } from '../lib/format';
import { t } from '../i18n';

export default function StatusBadge({ status }) {
  const config = ORDER_STATUSES[status] || ORDER_STATUSES.pending;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[11px] font-bold whitespace-nowrap ${config.className}`}>
      {t(config.label)}
    </span>
  );
}
