import React from 'react';
import { Link } from 'react-router-dom';
import { t } from '../i18n';

export default function Footer() {
  return (
    <footer className="hidden md:block print:!hidden bg-ink text-white/60 py-10 mt-auto border-t border-white/10 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <span className="text-xl">🛠️</span>
          <span className="font-bold text-white text-base">Usta24</span>
          <span>— {t('Uy, Avto va Texnika ustalari SuperApp platformasi')}</span>
        </div>
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <Link to="/prices" className="text-white/80 hover:text-white font-semibold">{t('Narxlar')}</Link>
          <Link to="/rules" className="text-white/80 hover:text-white font-semibold">{t('Ishlash qoidalari')}</Link>
          <Link to="/ustalar" className="text-white/80 hover:text-white font-semibold">{t('Ustalar uchun')}</Link>
          <Link to="/support" className="text-white/80 hover:text-white font-semibold">{t('Yordam')}</Link>
          <Link to="/terms" className="text-white/80 hover:text-white">{t('Shartlar')}</Link>
          <Link to="/privacy" className="text-white/80 hover:text-white">{t('Maxfiylik')}</Link>
          <span>© {new Date().getFullYear()} Usta24 Marketplace. {t('Barcha huquqlar himoyalangan.')}</span>
        </div>
      </div>
    </footer>
  );
}
