import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff, X } from 'lucide-react';
import { fetchObjectUrl } from '../lib/api';

/**
 * Token bilan yuklanadigan rasm (buyurtma rasmlarining ochiq havolasi yo'q)
 */
function useOrderPhoto(orderId, photoId) {
  const [state, setState] = useState({ url: null, failed: false });
  useEffect(() => {
    const controller = new AbortController();
    let url = null;
    fetchObjectUrl(`/orders/${orderId}/photos/${photoId}`, { signal: controller.signal })
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
  }, [orderId, photoId]);
  return state;
}

function Thumb({ orderId, photoId, index, onOpen, className }) {
  const { url, failed } = useOrderPhoto(orderId, photoId);
  return (
    <button
      type="button"
      onClick={() => url && onOpen(index)}
      className={`relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 ${className}`}
      aria-label={`Muammo rasmi ${index + 1}ni kattalashtirish`}
    >
      {url && <img src={url} alt="" className="w-full h-full object-cover" />}
      {!url && !failed && <span className="absolute inset-0 animate-pulse bg-slate-200" />}
      {failed && <ImageOff className="absolute inset-0 m-auto w-5 h-5 text-slate-400" />}
    </button>
  );
}

function Lightbox({ orderId, photoIds, index, onClose, onChange }) {
  const { url } = useOrderPhoto(orderId, photoIds[index]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onChange((index + 1) % photoIds.length);
      if (e.key === 'ArrowLeft') onChange((index - 1 + photoIds.length) % photoIds.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, photoIds.length, onClose, onChange]);

  return (
    <div className="fixed inset-0 z-[70] bg-ink/95 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Muammo rasmi" onClick={onClose}>
      {url && <img src={url} alt={`Muammo rasmi ${index + 1}`} className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />}
      <button type="button" onClick={onClose} className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-3 w-11 h-11 rounded-full bg-snow/10 text-white flex items-center justify-center" aria-label="Yopish">
        <X className="w-6 h-6" />
      </button>
      {photoIds.length > 1 && (
        <>
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange((index - 1 + photoIds.length) % photoIds.length); }} className="absolute left-3 w-11 h-11 rounded-full bg-snow/10 text-white flex items-center justify-center" aria-label="Oldingi rasm">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange((index + 1) % photoIds.length); }} className="absolute right-3 w-11 h-11 rounded-full bg-snow/10 text-white flex items-center justify-center" aria-label="Keyingi rasm">
            <ChevronRight className="w-6 h-6" />
          </button>
          <span className="absolute bottom-[calc(env(safe-area-inset-bottom)+1rem)] text-white/80 text-sm font-semibold">{index + 1} / {photoIds.length}</span>
        </>
      )}
    </div>
  );
}

/**
 * Buyurtmaga biriktirilgan muammo rasmlari
 */
export default function OrderPhotos({ orderId, photoIds = [], thumbClassName = 'w-20 h-20' }) {
  const [open, setOpen] = useState(null);
  if (!photoIds.length) return null;
  return (
    <>
      <div className="flex gap-2 flex-wrap">
        {photoIds.map((id, index) => (
          <Thumb key={id} orderId={orderId} photoId={id} index={index} onOpen={setOpen} className={thumbClassName} />
        ))}
      </div>
      {open !== null && (
        <Lightbox orderId={orderId} photoIds={photoIds} index={open} onClose={() => setOpen(null)} onChange={setOpen} />
      )}
    </>
  );
}
