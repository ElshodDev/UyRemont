import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="hidden md:block bg-slate-900 text-slate-400 py-10 mt-auto border-t border-slate-800 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <span className="text-xl">🛠️</span>
          <span className="font-bold text-white text-base">Usta24</span>
          <span>— Uy, Avto va Texnika ustalari SuperApp platformasi</span>
        </div>
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <Link to="/rules" className="text-slate-300 hover:text-white font-semibold">Ishlash qoidalari</Link>
          <span>© {new Date().getFullYear()} Usta24 Marketplace. Barcha huquqlar himoyalangan.</span>
        </div>
      </div>
    </footer>
  );
}
