import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import Spinner from './Spinner';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { t } from '../i18n';

// "aa1234567" -> "AA 1234567": 2 ta lotin harfi va 7 ta raqam
export const formatPassport = (value) => {
  const clean = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const letters = clean.slice(0, 2).replace(/[^A-Z]/g, '');
  const digits = clean.slice(letters.length).replace(/\D/g, '').slice(0, 7);
  return digits ? `${letters} ${digits}` : letters;
};
export const isPassportValid = (value) => /^[A-Z]{2}\d{7}$/.test(String(value || '').replace(/\s/g, ''));

const splitName = (name) => {
  const [first = '', ...rest] = String(name || '').trim().split(/\s+/);
  return { first, last: rest.join(' ') };
};

/**
 * Ism, familiya va pasport (ID karta) seriya-raqami. Pasport shifrlanadi va faqat administratorga ko'rinadi.
 * @param {{ defaultName?: string, submitLabel: string, canSubmit?: boolean, children?: React.ReactNode,
 *           onSaved: (identity: object) => (void|Promise<void>) }} props
 */
export default function IdentityForm({ defaultName, submitLabel, canSubmit = true, children, onSaved }) {
  const toast = useToast();
  const initial = splitName(defaultName);
  const [firstName, setFirstName] = useState(initial.first);
  const [lastName, setLastName] = useState(initial.last);
  const [passport, setPassport] = useState('');
  const [saving, setSaving] = useState(false);

  const ready = firstName.trim().length >= 2 && lastName.trim().length >= 2 && isPassportValid(passport) && canSubmit;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api('/masters/me/identity', {
        method: 'PUT',
        body: { first_name: firstName.trim(), last_name: lastName.trim(), passport: passport.replace(/\s/g, '') }
      });
      await onSaved(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="identity-first">{t('Ism')}</label>
          <input
            id="identity-first"
            className="input text-base"
            autoComplete="given-name"
            maxLength={60}
            placeholder={t('Masalan: Alisher')}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="identity-last">{t('Familiya')}</label>
          <input
            id="identity-last"
            className="input text-base"
            autoComplete="family-name"
            maxLength={60}
            placeholder={t('Masalan: Valiyev')}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="identity-passport">{t('Pasport (ID karta) seriyasi va raqami')}</label>
        <input
          id="identity-passport"
          className="input text-lg font-bold tracking-widest uppercase"
          autoComplete="off"
          inputMode="text"
          placeholder="AA 1234567"
          value={passport}
          onChange={(e) => setPassport(formatPassport(e.target.value))}
          aria-describedby="identity-passport-hint"
        />
        <p id="identity-passport-hint" className="hint mt-1 flex items-center gap-1">
          <Lock className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {t('Shifrlangan holda saqlanadi va faqat administratorga ko\'rinadi. Mijozlar ko\'rmaydi.')}
        </p>
      </div>
      {children}
      <button type="submit" disabled={!ready || saving} className="btn btn-primary btn-lg w-full">
        {saving ? <Spinner className="w-5 h-5 text-white" /> : submitLabel}
      </button>
    </form>
  );
}
