import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type, message) => {
    const id = ++idRef.current;
    setToasts((list) => [...list.slice(-3), { id, type, message }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const toast = useMemo(() => ({
    success: (message) => push('success', message),
    error: (message) => push('error', message)
  }), [push]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Telefonda yuqorida: pastki panel va taklif oynasi tugmalarini yopmasligi uchun */}
      <div className="fixed top-[calc(env(safe-area-inset-top)+0.75rem)] md:top-auto md:bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 sm:w-96" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-toast-in flex items-start gap-3 p-3.5 rounded-2xl shadow-lg border bg-white text-sm ${
              t.type === 'success' ? 'border-emerald-200' : 'border-red-200'
            }`}
          >
            {t.type === 'success'
              ? <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              : <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
            <p className="flex-1 text-slate-700 font-medium">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-600" aria-label="Yopish">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
