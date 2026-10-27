import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Spinner({ className = 'w-5 h-5', label }) {
  return (
    <span className="inline-flex items-center gap-2 text-slate-500">
      <Loader2 className={`${className} animate-spin`} />
      {label && <span className="text-sm font-medium">{label}</span>}
    </span>
  );
}

export function PageLoader({ label = 'Yuklanmoqda...' }) {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner className="w-6 h-6 text-blue-600" label={label} />
    </div>
  );
}
