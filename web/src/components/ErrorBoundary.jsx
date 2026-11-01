import React from 'react';
import { reportError } from '../lib/errorReporter';
import { t } from '../i18n';

/**
 * Kutilmagan xatoda butun sayt oq ekranga aylanmasligi uchun: tushunarli xabar + xato serverga yuboriladi
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    reportError(error, { componentStack: info?.componentStack });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="max-w-md mx-auto px-6 py-20 text-center flex-1" role="alert">
        <div className="text-5xl mb-4" aria-hidden="true">🛠️</div>
        <h1 className="text-xl font-extrabold text-slate-900 mb-2">{t('Nimadir noto\'g\'ri ketdi')}</h1>
        <p className="text-sm text-slate-500 mb-6">{t('Xato haqida xabar avtomatik yuborildi. Sahifani yangilab ko\'ring.')}</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>{t('Sahifani yangilash')}</button>
          <a href="/" className="btn btn-secondary">{t('Bosh sahifa')}</a>
        </div>
      </main>
    );
  }
}
