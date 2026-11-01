import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Calculator, PlusCircle, LogIn, ChevronDown, ClipboardList,
  User, Wrench, LayoutDashboard, LogOut, Zap, Power, BookOpen, Tag, Sun, Moon, Heart
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDispatch } from '../context/DispatchContext';
import { ROLE_LABELS } from '../lib/format';
import { ThemeToggleButton } from './ThemeSwitch';
import LanguageSwitch from './LanguageSwitch';
import { useTheme } from '../lib/theme';
import { useCallMaster } from '../lib/useCallMaster';
import { t } from '../i18n';

export default function Header({ onOpenCalculator }) {
  const { user, logout, requireAuth } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const theme = useTheme();
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const callMaster = useCallMaster();

  const menuLink = 'flex items-center gap-2.5 px-3 min-h-11 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50';

  return (
    <header className="print:hidden sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between gap-2 sm:gap-3">
        <Link to="/" className="flex items-center gap-2 sm:gap-3 min-w-0" aria-label={t('Usta24 — bosh sahifa')}>
          <div className="w-9 h-9 sm:w-11 sm:h-11 bg-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white text-xl sm:text-2xl shadow-md shadow-blue-500/20 flex-shrink-0" aria-hidden="true">
            🛠️
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                Usta<span className="text-blue-600">24</span>
              </span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-bold rounded-full border border-blue-200 hidden sm:inline-block">
                SuperApp
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium hidden md:block">
              {t('Uy, Avto va Texnika ustalari yagona platformada')}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <LanguageSwitch size="sm" />
          <ThemeToggleButton className="hidden sm:inline-flex" />
          <button
            onClick={onOpenCalculator}
            className="icon-btn border border-slate-200 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
            title={t('Smeta hisoblash')}
            aria-label={t('Smeta hisoblash')}
          >
            <Calculator className="w-5 h-5" />
          </button>

          {(!user || user.role === 'client') && (
            <button
              onClick={() => callMaster()}
              className="hidden md:inline-flex btn btn-accent"
            >
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">{t('Usta chaqirish')}</span>
            </button>
          )}

          {user?.role === 'master' && (
            <Link
              to="/master/work"
              className={`hidden md:inline-flex btn font-bold border ${
                dispatch?.isOnline
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${dispatch?.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span className="hidden sm:inline">{dispatch?.isOnline ? t('Ishdaman') : t('Dam olyapman')}</span>
              <Power className="w-4 h-4 sm:hidden" />
            </Link>
          )}

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="inline-flex items-center gap-2 pl-1.5 pr-2.5 min-h-11 rounded-xl border border-slate-200 hover:bg-slate-50 transition"
                aria-expanded={menuOpen}
                aria-label={t('Hisob menyusi')}
              >
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold">
                  {(user.name || '?').charAt(0).toUpperCase()}
                </span>
                <span className="hidden lg:block text-left">
                  <span className="block text-xs font-bold text-slate-800 max-w-[120px] truncate">{user.name}</span>
                  <span className="block text-[10px] text-slate-500">{t(ROLE_LABELS[user.role])}</span>
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-60 card shadow-xl p-2 z-50"
                  onClick={() => setMenuOpen(false)}
                >
                  <NavLink to="/orders" className={menuLink}>
                    <ClipboardList className="w-4 h-4 text-slate-400" /> {t('Buyurtmalarim')}
                  </NavLink>
                  {user.role === 'client' && (
                    <NavLink to="/favorites" className={menuLink}>
                      <Heart className="w-4 h-4 text-slate-400" /> {t('Sevimli ustalar')}
                    </NavLink>
                  )}
                  {user.role === 'master' && (
                    <NavLink to="/master/work" className={menuLink}>
                      <Power className="w-4 h-4 text-slate-400" /> {t('Ish rejimi')}
                    </NavLink>
                  )}
                  {user.role === 'master' && (
                    <NavLink to="/master/profile" className={menuLink}>
                      <Wrench className="w-4 h-4 text-slate-400" /> {t('Usta profilim')}
                    </NavLink>
                  )}
                  {user.role === 'client' && (
                    <NavLink to="/master/setup" className={menuLink}>
                      <PlusCircle className="w-4 h-4 text-slate-400" /> {t('Usta bo\'lish')}
                    </NavLink>
                  )}
                  <NavLink to="/profile" className={menuLink}>
                    <User className="w-4 h-4 text-slate-400" /> {t('Profil')}
                  </NavLink>
                  {user.role === 'admin' && (
                    <NavLink to="/admin" className={menuLink}>
                      <LayoutDashboard className="w-4 h-4 text-slate-400" /> {t('Admin panel')}
                    </NavLink>
                  )}
                  <NavLink to="/prices" className={menuLink}>
                    <Tag className="w-4 h-4 text-slate-400" /> {t('Narxlar')}
                  </NavLink>
                  <NavLink to="/rules" className={menuLink}>
                    <BookOpen className="w-4 h-4 text-slate-400" /> {t('Ishlash qoidalari')}
                  </NavLink>
                  <button
                    onClick={() => theme.setPreference(theme.resolved === 'dark' ? 'light' : 'dark')}
                    className={`${menuLink} w-full sm:hidden`}
                  >
                    {theme.resolved === 'dark'
                      ? <><Sun className="w-4 h-4 text-slate-400" /> {t('Yorug\' rejim')}</>
                      : <><Moon className="w-4 h-4 text-slate-400" /> {t('Qorong\'i rejim')}</>}
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    onClick={() => {
                      logout();
                      navigate('/');
                    }}
                    className={`${menuLink} w-full text-red-600 hover:bg-red-50`}
                  >
                    <LogOut className="w-4 h-4" /> {t('Chiqish')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => requireAuth()}
              className="btn btn-secondary px-3 sm:px-3.5"
            >
              {/* Tor telefonda (360px) til almashtirgichga joy qolishi uchun ikonka yashiriladi */}
              <LogIn className="w-4 h-4 hidden min-[400px]:block" />
              <span>{t('Kirish')}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
