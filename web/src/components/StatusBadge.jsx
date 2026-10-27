import React from 'react';
import { ORDER_STATUSES } from '../lib/format';

export default function StatusBadge({ status }) {
  const config = ORDER_STATUSES[status] || ORDER_STATUSES.pending;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[11px] font-bold whitespace-nowrap ${config.className}`}>
      {config.label}
    </span>
  );
}
