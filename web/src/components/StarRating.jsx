import React from 'react';
import { Star } from 'lucide-react';

/**
 * Yulduzli reyting: onChange berilsa tanlash mumkin
 */
export default function StarRating({ value = 0, onChange, size = 'w-5 h-5' }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(value);
        const icon = <Star className={`${size} ${filled ? 'text-amber-500 fill-current' : 'text-slate-300'}`} />;
        return onChange ? (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-0.5 hover:scale-110 transition"
            aria-label={`${star} yulduz`}
          >
            {icon}
          </button>
        ) : (
          <span key={star}>{icon}</span>
        );
      })}
    </div>
  );
}
