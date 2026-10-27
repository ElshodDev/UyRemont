import React, { useState } from 'react';
import StarRating from './StarRating';
import Spinner from './Spinner';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';

export default function ReviewForm({ orderId, onCreated }) {
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api('/reviews', { method: 'POST', body: { order_id: orderId, rating, comment } });
      toast.success('Rahmat! Sharhingiz qabul qilindi');
      onCreated();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-amber-200 p-5 space-y-3">
      <div>
        <h3 className="font-bold text-slate-900">Ustani baholang</h3>
        <p className="text-xs text-slate-500">Sharhingiz boshqa mijozlarga to'g'ri usta tanlashga yordam beradi.</p>
      </div>
      <StarRating value={rating} onChange={setRating} size="w-7 h-7" />
      <textarea
        rows="3"
        maxLength={1000}
        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm"
        placeholder="Ish sifati, o'z vaqtida kelgani, narxi haqida..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <button
        type="submit"
        disabled={submitting}
        className="px-5 py-2.5 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 disabled:opacity-70 inline-flex items-center gap-2"
      >
        {submitting ? <Spinner className="w-4 h-4 text-white" /> : 'Sharh qoldirish'}
      </button>
    </form>
  );
}
