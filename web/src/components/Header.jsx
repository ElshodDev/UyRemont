import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Calculator, PlusCircle, LogIn, ChevronDown, ClipboardList,
  User, Wrench, LayoutDashboard, LogOut, Zap, Power, BookOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDispatch } from '../context/DispatchContext';
import { useToast } from '../context/ToastContext';
import { ROLE_LABELS } from '../lib/format';

export default function Header({ onOpenCalculator }) {
  const { user, logout, requireAuth } = useAuth();
  const dispatch = useDispatch();
  const toast = useToast();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const becomeMaster = () => {
    requireAuth((current) => {
      navigate(current.role === 'master' ? '/master/profile' : '/master/setup');
    });
  };

  const callMaster = () => {
    requireAuth((current) => {
      if (current.role === 'client') navigate('/call');
      else toast.error(current.role === 'master'
        ? 'Usta chaqirish uchun profilingizda mijoz rejimiga o\'ting'
        : 'Administrator hisobidan usta chaqirib bo\'lmaydi');
    });
  };

  const menuLink = 'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-md shadow-blue-500/20 flex-shrink-0">
            🛠️
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-slate-900">
                Usta<span className="text-blue-600">24</span>
              </span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-bold rounded-full border border-blue-200 hidden sm:inline-block">
                SuperApp
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium hidden md:block">
              Uy, Avto va Texnika ustalari yagona platformada
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCalculator}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 text-amber-900 hover:bg-amber-100 font-bold text-xs sm:text-sm border border-amber-200/80 transition"
            title="Smeta hisoblash"
          >
            <Calculator className="w-4 h-4 text-amber-600" />
            <span className="hidden lg:inline">Smeta hisoblash</span>
          </button>

          {(!user || user.role === 'client') && (
            <button
              onClick={callMaster}
              className="hidden md:inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 font-bold text-xs sm:text-sm shadow-sm shadow-orange-500/30 transition"
            >
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Usta chaqirish</span>
            </button>
          )}

          {user?.role === 'master' && (
            <Link
              to="/master/work"
              className={`hidden md:inline-flex items-center gap-2 px-3 py-2.5 rounded-xl font-bold text-xs sm:text-sm border transition ${
                dispatch?.isOnline
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${dispatch?.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span className="hidden sm:inline">{dispatch?.isOnline ? 'Liniyada' : 'Oflayn'}</span>
              <Power className="w-4 h-4 sm:hidden" />
            </Link>
          )}

          {(!user || user.role === 'client') && (
            <button
              onClick={becomeMaster}
              className="hidden lg:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-semibold text-sm shadow-sm transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Usta bo'lib qo'shilish</span>
            </button>
          )}

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition"
                aria-expanded={menuOpen}
              >
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold">
                  {(user.name || '?').charAt(0).toUpperCase()}
                </span>
                <span className="hidden md:block text-left">
                  <span className="block text-xs font-bold text-slate-800 max-w-[120px] truncate">{user.name}</span>
                  <span className="block text-[10px] text-slate-500">{ROLE_LABELS[user.role]}</span>
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-50"
                  onClick={() => setMenuOpen(false)}
                >
                  <NavLink to="/orders" className={menuLink}>
                    <ClipboardList className="w-4 h-4 text-slate-400" /> Buyurtmalarim
                  </NavLink>
                  {user.role === 'master' && (
                    <NavLink to="/master/work" className={menuLink}>
                      <Power className="w-4 h-4 text-slate-400" /> Ish rejimi
                    </NavLink>
                  )}
                  {user.role === 'master' && (
                    <NavLink to="/master/profile" className={menuLink}>
                      <Wrench className="w-4 h-4 text-slate-400" /> Usta profilim
                    </NavLink>
                  )}
                  {user.role === 'client' && (
                    <NavLink to="/master/setup" className={`${menuLink} lg:hidden`}>
                      <PlusCircle className="w-4 h-4 text-slate-400" /> Usta bo'lish
                    </NavLink>
                  )}
                  <NavLink to="/profile" className={menuLink}>
                    <User className="w-4 h-4 text-slate-400" /> Profil
                  </NavLink>
                  {user.role === 'admin' && (
                    <NavLink to="/admin" className={menuLink}>
                      <LayoutDashboard className="w-4 h-4 text-slate-400" /> Admin panel
                    </NavLink>
                  )}
                  <NavLink to="/rules" className={menuLink}>
                    <BookOpen className="w-4 h-4 text-slate-400" /> Ishlash qoidalari
                  </NavLink>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    onClick={() => {
                      logout();
                      navigate('/');
                    }}
                    className={`${menuLink} w-full text-red-600 hover:bg-red-50`}
                  >
                    <LogOut className="w-4 h-4" /> Chiqish
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => requireAuth()}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 hover:bg-slate-50 font-semibold text-xs sm:text-sm transition"
            >
              <LogIn className="w-4 h-4" />
              <span>Kirish</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
