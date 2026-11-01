import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { fetchObjectUrl } from '../lib/api';
import { t } from '../i18n';

/**
 * Faqat token bilan beriladigan rasm (hujjatlar va h.k.). Bosilganda yangi oynada to'liq ochiladi.
 */
export default function ProtectedImage({ path, alt, className = 'w-24 h-24' }) {
  const [state, setState] = useState({ url: null, failed: false });

  useEffect(() => {
    const controller = new AbortController();
    let url = null;
    fetchObjectUrl(path, { signal: controller.signal })
      .then((objectUrl) => {
        url = objectUrl;
        setState({ url, failed: false });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ url: null, failed: true });
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  return (
    <a
      href={state.url || undefined}
      target="_blank"
      rel="noreferrer"
      className={`relative block rounded-xl overflow-hidden border border-slate-200 bg-slate-100 ${className}`}
      aria-label={t('{alt}: to\'liq ochish', { alt })}
    >
      {state.url && <img src={state.url} alt={alt} className="w-full h-full object-cover" />}
      {!state.url && !state.failed && <span className="absolute inset-0 animate-pulse bg-slate-200" />}
      {state.failed && <ImageOff className="absolute inset-0 m-auto w-5 h-5 text-slate-400" />}
    </a>
  );
}
