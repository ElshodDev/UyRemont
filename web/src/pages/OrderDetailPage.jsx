import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Wallet, Calendar, Clock, Phone, User, Check, Camera } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import StarRating from '../components/StarRating';
import OrderChat from '../components/OrderChat';
import ReviewForm from '../components/ReviewForm';
import InstantOrderPanel from '../components/InstantOrderPanel';
import OrderPhotos from '../components/OrderPhotos';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner, { PageLoader } from '../components/Spinner';
import { ErrorState } from '../components/EmptyState';
import { api } from '../lib/api';
import { formatDate, formatPhone, formatPrice, getOrderActions } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const STEPS = [
  { id: 'pending', label: 'Yuborildi' },
  { id: 'accepted', label: 'Qabul qilindi' },
  { id: 'in_progress', label: 'Bajarilmoqda' },
  { id: 'completed', label: 'Yakunlandi' }
];

const TONES = {
  primary: 'btn-primary',
  success: 'btn-success',
  danger: 'btn-secondary border-red-200 text-red-600 hover:bg-red-50'
};

function ContactCard({ label, name, phone }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <span className="text-[11px] text-slate-400 block">{label}</span>
        <span className="text-sm font-bold text-slate-800 flex items-center gap-1 truncate"><User className="w-3.5 h-3.5 text-slate-400" />{name || '—'}</span>
        {phone && <span className="text-xs text-slate-600">{formatPhone(phone)}</span>}
      </div>
      {phone && (
        <a href={`tel:${phone}`} className="w-11 h-11 rounded-xl bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center justify-center flex-shrink-0" aria-label={`${name || ''} raqamiga qo'ng'iroq qilish`}>
          <Phone className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api(`/orders/${id}`);
      setOrder(data);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    setOrder(null);
    load();
  }, [load]);

  const changeStatus = async (action) => {
    setUpdating(true);
    try {
      await api(`/orders/${id}/status`, { method: 'PUT', body: { status: action.status } });
      toast.success('Buyurtma holati yangilandi');
      setPendingAction(null);
      await load();
    } catch (err) {
      toast.error(err.message);
      setPendingAction(null);
      load();
    } finally {
      setUpdating(false);
    }
  };

  if (error && !order) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10 w-full flex-1">
        <ErrorState message={error} onRetry={load} />
      </main>
    );
  }
  if (!order) return <PageLoader />;

  const actions = getOrderActions(order, user);
  const isParticipant = order.client_id === user.id || order.master_id === user.id || user.role === 'admin';
  const canReview = order.client_id === user.id && order.status === 'completed' && !order.review_rating && order.master_id;
  const stepIndex = STEPS.findIndex((s) => s.id === order.status);
  const isInstant = order.mode === 'instant';
  const showChat = isParticipant && (!isInstant || Boolean(order.master_id));

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full flex-1">
      <Link to="/orders" className="inline-flex items-center gap-1 min-h-11 text-sm font-semibold text-slate-500 hover:text-slate-800 mb-2">
        <ArrowLeft className="w-4 h-4" /> Buyurtmalar
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          {isInstant ? (
            <InstantOrderPanel order={order} user={user} reload={load} />
          ) : (
          <div className="card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                {order.specialization_name && (
                  <span className="text-xs font-semibold text-blue-600">{order.specialization_icon} {order.specialization_name}</span>
                )}
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 break-words">{order.title}</h1>
              </div>
              <StatusBadge status={order.status} />
            </div>

            {order.description && <p className="text-sm text-slate-600 whitespace-pre-wrap mb-4">{order.description}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-600"><MapPin className="w-4 h-4 text-slate-400" />{[order.district, order.address].filter(Boolean).join(', ')}</div>
              <div className="flex items-center gap-2 text-slate-600"><Wallet className="w-4 h-4 text-slate-400" />{formatPrice(order.budget)}</div>
              <div className="flex items-center gap-2 text-slate-600"><Calendar className="w-4 h-4 text-slate-400" />Yaratilgan: {formatDate(order.created_at)}</div>
              {order.scheduled_at && (
                <div className="flex items-center gap-2 text-slate-600"><Clock className="w-4 h-4 text-slate-400" />Qulay vaqt: {formatDate(order.scheduled_at)}</div>
              )}
            </div>

            {/* Holat bosqichlari */}
            {order.status !== 'cancelled' ? (
              <div className="mt-6 flex items-center">
                {STEPS.map((step, i) => {
                  const done = i < stepIndex || order.status === 'completed';
                  return (
                  <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center text-center w-16 sm:w-20">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        i <= stepIndex ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {done ? <Check className="w-4 h-4" /> : i + 1}
                      </div>
                      <span className={`text-[10px] sm:text-[11px] mt-1 font-semibold ${i <= stepIndex ? 'text-slate-800' : 'text-slate-400'}`}>
                        {step.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 -mt-4 ${i < stepIndex ? 'bg-blue-600' : 'bg-slate-200'}`} />
                    )}
                  </React.Fragment>
                  );
                })}
              </div>
            ) : (
              <p className="mt-5 p-3 rounded-xl bg-slate-100 text-slate-600 text-xs font-medium">Bu buyurtma bekor qilingan.</p>
            )}

            {actions.length > 0 && (
              <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap gap-2">
                {actions.map((action) => (
                  <button
                    key={action.status}
                    disabled={updating}
                    onClick={() => (action.confirm ? setPendingAction(action) : changeStatus(action))}
                    className={`btn font-bold ${TONES[action.tone]}`}
                  >
                    {updating && !action.confirm ? <Spinner className="w-4 h-4" /> : action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          )}

          {order.photos?.length > 0 && (
            <div className="card-pad">
              <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-600" /> Muammo rasmlari
              </h3>
              <OrderPhotos orderId={order.id} photoIds={order.photos} thumbClassName="w-24 h-24 sm:w-28 sm:h-28" />
            </div>
          )}

          {(!isInstant || order.master_id) && (
          <div className="card-pad space-y-2">
            <h3 className="font-bold text-slate-900 text-sm mb-1">Ishtirokchilar</h3>
            <ContactCard label="Mijoz" name={order.client_name} phone={order.client_phone} />
            <ContactCard label="Usta" name={order.master_name || 'Hali biriktirilmagan'} phone={order.master_phone} />
            {!order.master_phone && isParticipant && order.master_id && (
              <p className="text-[11px] text-slate-400">Telefon raqamlar usta buyurtmani qabul qilgandan keyin ko'rinadi.</p>
            )}
          </div>
          )}

          {canReview && <ReviewForm orderId={order.id} onCreated={load} />}

          {order.review_rating && (
            <div className="card-pad">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Mijoz sharhi</h3>
              <StarRating value={order.review_rating} />
              {order.review_comment && <p className="text-sm text-slate-600 mt-2">{order.review_comment}</p>}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {showChat ? (
            <OrderChat
              orderId={order.id}
              initialMessages={order.messages}
              disabled={order.status === 'cancelled'}
              onOrderUpdated={load}
            />
          ) : (
            <div className="card p-6 text-center text-sm text-slate-500">
              {isInstant ? 'Usta topilgach u bilan shu yerda yozishishingiz mumkin.' : 'Chat buyurtmani qabul qilgandan keyin ochiladi.'}
            </div>
          )}
        </div>
      </div>

      {pendingAction && (
        <ConfirmDialog
          title={pendingAction.status === 'completed' ? 'Ish yakunlandimi?' : 'Buyurtmani bekor qilasizmi?'}
          description={pendingAction.status === 'completed'
            ? 'Buyurtma yakunlangan deb belgilanadi va mijoz sharh qoldira oladi.'
            : 'Bu amalni qaytarib bo\'lmaydi.'}
          confirmLabel={pendingAction.label}
          tone={pendingAction.tone === 'success' ? 'success' : 'danger'}
          loading={updating}
          onConfirm={() => changeStatus(pendingAction)}
          onClose={() => setPendingAction(null)}
        />
      )}
    </main>
  );
}
