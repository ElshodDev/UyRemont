import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ClipboardList, Zap, User, BookOpen, Power, Wrench, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDispatch } from '../context/DispatchContext';

/**
 * Telefon uchun pastki navigatsiya (md dan kichik ekranlarda), o'rtadagi asosiy tugma rolga bog'liq
 */
export default function BottomNav() {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const role = user?.role || 'guest';

  const center = {
    master: {
      to: '/master/work',
      label: dispatch?.isOnline ? 'Liniyada' : 'Ish rejimi',
      icon: Power,
      className: dispatch?.isOnline ? 'from-emerald-500 to-teal-600 shadow-emerald-500/40' : 'from-slate-600 to-slate-800 shadow-slate-500/40'
    },
    admin: { to: '/admin', label: 'Admin', icon: ShieldCheck, className: 'from-slate-800 to-slate-900 shadow-slate-500/40' }
  }[role] || { to: '/call', label: 'Chaqirish', icon: Zap, className: 'from-amber-400 to-orange-500 shadow-orange-500/40' };

  const side = role === 'master'
    ? [{ to: '/master/profile', label: 'Profilim', icon: Wrench }, { to: '/profile', label: 'Hisob', icon: User }]
    : [{ to: '/rules', label: 'Qoidalar', icon: BookOpen }, { to: '/profile', label: 'Profil', icon: User }];

  const items = [
    { to: '/', label: 'Asosiy', icon: Home, end: true },
    { to: '/orders', label: 'Buyurtmalar', icon: ClipboardList },
    { ...center, center: true },
    ...side
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 safe-bottom" aria-label="Asosiy menyu">
      <div className="grid grid-cols-5 h-16">
        {items.map(({ to, label, icon: Icon, end, center: isCenter, className }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
              isActive && !isCenter ? 'text-blue-600' : 'text-slate-500'
            }`}
          >
            {isCenter ? (
              <>
                <span className={`-mt-6 w-14 h-14 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center shadow-lg border-4 border-white ${className}`}>
                  <Icon className="w-6 h-6" />
                </span>
                <span className="text-slate-700">{label}</span>
              </>
            ) : (
              <>
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
