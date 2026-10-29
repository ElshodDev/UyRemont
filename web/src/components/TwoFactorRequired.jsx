import React from 'react';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';

export const isTwoFactorError = (error) => error?.data?.code === '2FA_REQUIRED';

/**
 * 2FA majburiy, lekin administrator uni hali yoqmagan
 */
export default function TwoFactorRequired() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
      <KeyRound className="w-10 h-10 text-amber-600 mx-auto mb-3" />
      <h3 className="font-bold text-slate-900 mb-1">Ikki bosqichli kirishni yoqing</h3>
      <p className="text-sm text-slate-600 mb-4 max-w-md mx-auto">
        Xavfsizlik uchun admin panelga faqat 2FA yoqilgan administratorlar kira oladi.
      </p>
      <Link to="/profile#xavfsizlik" className="btn btn-primary font-bold">
        Profil → Xavfsizlik
      </Link>
    </div>
  );
}
