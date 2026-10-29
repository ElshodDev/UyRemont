import React from 'react';

export default function EmptyState({ icon = '🔍', title, description, action }) {
  return (
    <div className="card p-10 sm:p-12 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-lg font-bold text-slate-800 mb-1">{title}</h3>
      {description && (
        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <EmptyState
      icon="⚠️"
      title="Ma'lumotlarni yuklab bo'lmadi"
      description={message}
      action={onRetry && (
        <button
          onClick={onRetry}
          className="btn btn-primary"
        >
          Qayta urinish
        </button>
      )}
    />
  );
}
