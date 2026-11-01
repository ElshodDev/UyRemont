import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import Modal from './Modal';
import Spinner from './Spinner';
import { api } from '../lib/api';
import { complaintCategoriesFor } from '../lib/support';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { t } from '../i18n';

/**
 * Usta profilidan shikoyat (buyurtmasiz). Usta kim shikoyat qilganini bilmaydi;
 * administrator ko'rib chiqadi, natija "Yordam" sahifasida va Telegram'da keladi
 */
export default function ComplaintDialog({ master, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const reasons = complaintCategoriesFor(user.role);
  const [reason, setReason] = useState(reasons[0]?.id || 'other');
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const needsComment = reason === 'other';

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const { message } = await api('/support', {
        method: 'POST',
        body: { category: reason, target_user_id: master.id, message: comment.trim() || undefined }
      });
      toast.success(message);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal onClose={sending ? () => {} : onClose} size="md" labelledBy="complaint-title" portal>
      <div className="flex items-center gap-3 mb-4 pr-8">
        <span className="w-11 h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
          <Flag className="w-5 h-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 id="complaint-title" className="text-lg font-bold text-slate-900">{t('Shikoyat qilish')}</h3>
          <p className="text-xs text-slate-500 truncate">{master.name || t('Usta')}</p>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="label">{t('Sababi')}</legend>
          <div className="space-y-2">
            {reasons.map((r) => (
              <label key={r.id} className={`flex items-center gap-2 min-h-11 px-3 rounded-xl border cursor-pointer text-sm ${reason === r.id ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}>
                <input type="radio" name="complaint-reason" className="accent-red-600" checked={reason === r.id} onChange={() => setReason(r.id)} />
                {t(r.label)}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="complaint-comment">
            {needsComment ? t('Nima bo\'ldi?') : t('Izoh (ixtiyoriy)')}
          </label>
          <textarea
            id="complaint-comment"
            className="input"
            rows={3}
            maxLength={2000}
            required={needsComment}
            minLength={needsComment ? 10 : undefined}
            placeholder={t('Qisqacha yozing: nima bo\'ldi, qachon')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
        <p className="hint">{t('Shikoyat maxfiy: usta kim yuborganini bilmaydi. Administrator ko\'rib chiqadi, natijani «Yordam» sahifasida ko\'rasiz.')}</p>
        <button
          type="submit"
          disabled={sending || (needsComment && comment.trim().length < 10)}
          className="btn btn-danger w-full min-h-12 font-bold"
        >
          {sending ? <Spinner className="w-4 h-4 text-white" /> : t('Shikoyat yuborish')}
        </button>
      </form>
    </Modal>
  );
}
