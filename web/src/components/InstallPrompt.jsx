import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

const DISMISS_KEY = 'usta24_install_dismissed';

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

const wasDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * Telefonda "ilovani o'rnatish" taklifi. Android: brauzerning o'rnatish oynasi; iPhone: qo'lda ko'rsatma
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(() => isStandalone() || wasDismissed());

  useEffect(() => {
    if (hidden) return undefined;
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    if (isIos()) setShowIosHint(true);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [hidden]);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // saqlanmasa keyingi safar yana ko'rsatiladi
    }
  };

  if (hidden || (!deferred && !showIosHint)) return null;

  const install = async () => {
    deferred.prompt();
    await deferred.userChoice.catch(() => null);
    setDeferred(null);
    dismiss();
  };

  return (
    <div className="md:hidden fixed inset-x-3 z-40 bottom-[calc(5rem+env(safe-area-inset-bottom))] bg-slate-900 text-white rounded-2xl shadow-xl p-3.5 flex items-center gap-3 animate-toast-in">
      <img src="/icons/icon-192.png" alt="" className="w-10 h-10 rounded-xl flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">Usta24 ilovasini o'rnating</p>
        {deferred ? (
          <p className="text-[11px] text-slate-300">Bosh ekrandan bir bosishda oching</p>
        ) : (
          <p className="text-[11px] text-slate-300 flex items-center gap-1 flex-wrap">
            <Share className="w-3 h-3" /> Ulashish → «Bosh ekranga qo'shish»
          </p>
        )}
      </div>
      {deferred && (
        <button onClick={install} className="px-3 py-2 rounded-xl bg-blue-600 text-xs font-bold inline-flex items-center gap-1">
          <Download className="w-3.5 h-3.5" /> O'rnatish
        </button>
      )}
      <button onClick={dismiss} className="p-1.5 text-slate-400 hover:text-white" aria-label="Yopish">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
