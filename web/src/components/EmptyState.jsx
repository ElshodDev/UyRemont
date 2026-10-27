import React from 'react';

export default function EmptyState({ icon = '🔍', title, description, action }) {
  return (
    <div className="bg-white rounded-2xl p-10 sm:p-12 text-center border border-slate-200">
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
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-blue-700"
        >
          Qayta urinish
        </button>
      )}
    />
  );
}
