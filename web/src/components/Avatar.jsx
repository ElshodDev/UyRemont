import React, { useState } from 'react';
import { assetUrl } from '../lib/api';

/**
 * Profil rasmi; rasm bo'lmasa yoki yuklanmasa ism bosh harfi ko'rsatiladi
 */
export default function Avatar({ src, name, className = 'w-16 h-16 rounded-2xl text-2xl' }) {
  const [failed, setFailed] = useState(false);
  const url = assetUrl(src);

  if (!url || failed) {
    return (
      <div className={`${className} bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black flex items-center justify-center border-2 border-slate-100`}>
        {(name || '?').trim().charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${className} object-cover border-2 border-slate-100`}
    />
  );
}
