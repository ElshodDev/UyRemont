import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Navigation, MapPin, Clock, Wallet, Radar, CheckCircle, XCircle, Wrench, Car, Home, Star
} from 'lucide-react';
import MapView from './MapView';
import Modal from './Modal';
import Spinner from './Spinner';
import StarRating from './StarRating';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { navigationUrl } from '../lib/geo';
import { formatPrice } from '../lib/format';
import { useToast } from '../context/ToastContext';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const formatDuration = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};

const STAGES = [
  { id: 'searching', label: 'Qidiruv', icon: Radar },
  { id: 'accepted', label: 'Yo\'lda', icon: Car },
  { id: 'arrived', label: 'Yetib keldi', icon: Home },
  { id: 'in_progress', label: 'Ish', icon: Wrench },
  { id: 'completed', label: 'Yakun', icon: CheckCircle }
];

function CancelDialog({ reasons, warning, onConfirm, onClose }) {
  const [reason, setReason] = useState(reasons[0]);
  const [loading, setLoading] = useState(false);
  return (
    <Modal onClose={loading ? () => {} : onClose} size="sm">
      <h3 className="text-lg font-bold text-slate-900 mb-1">Bekor qilish sababi</h3>
      {warning && <p className="text-xs p-2.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 mb-3">{warning}</p>}
      <div className="space-y-2 mb-4">
        {reasons.map((r) => (
          <label key={r} className={`flex items-center gap-2 min-h-11 px-3 rounded-xl border cursor-pointer text-sm ${reason === r ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
            <input type="radio" className="accent-blue-600" checked={reason === r} onChange={() => setReason(r)} />
            {r}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onClose} disabled={loading} className="btn btn-secondary">Ortga</button>
        <button
          onClick={async () => {
            setLoading(true);
            try {
              await onConfirm(reason);
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          className="btn btn-danger font-bold"
        >
          {loading ? <Spinner className="w-4 h-4 text-white" /> : 'Bekor qilish'}
        </button>
      </div>
    </Modal>
  );
}

function CompleteDialog({ callFee, onConfirm, onClose }) {
  const [price, setPrice] = useState(String(Math.round(Number(callFee) || 0)));
  const [loading, setLoading] = useState(false);
  return (
    <Modal onClose={loading ? () => {} : onClose} size="sm">
      <h3 className="text-lg font-bold text-slate-900 mb-1">Ishni yakunlash</h3>
      <p className="text-xs text-slate-500 mb-3">Mijoz bilan kelishilgan yakuniy summani kiriting (chiqish narxi bilan birga).</p>
      <input
        type="number"
        min="0"
        step="1000"
        autoFocus
        className="input text-lg font-bold"
        aria-label="Yakuniy summa (so'm)"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <p className="text-[11px] text-slate-400 mt-1 mb-4">{formatPrice(price)}</p>
      <button
        onClick={async () => {
          setLoading(true);
          try {
            await onConfirm(Number(price));
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading || price === '' || Number(price) < 0}
        className="btn btn-success w-full min-h-12 font-bold"
      >
        {loading ? <Spinner className="w-4 h-4 text-white" /> : 'Yakunlash'}
      </button>
    </Modal>
  );
}

function RateClientForm({ orderId, onDone }) {
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [loading, setLoading] = useState(false);
  return (
    <div className="card-pad">
      <h3 className="font-bold text-slate-900 text-sm">Mijozni baholang</h3>
      <p className="text-xs text-slate-500 mb-2">Mijoz reytingi boshqa ustalarga taklifni qabul qilishda yordam beradi.</p>
      <div className="flex items-center gap-3">
        <StarRating value={rating} onChange={setRating} size="w-6 h-6" />
        <button
          onClick={async () => {
            setLoading(true);
            try {
              await api(`/dispatch/orders/${orderId}/rate-client`, { method: 'POST', body: { rating } });
              toast.success('Rahmat!');
              onDone();
            } catch (error) {
              toast.error(error.message);
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          className="btn bg-amber-500 text-white font-bold hover:bg-amber-600"
        >
          {loading ? <Spinner className="w-4 h-4 text-white" /> : 'Baholash'}
        </button>
      </div>
    </div>
  );
}

/**
 * Tezkor chaqiruv buyurtmasi: jonli holat, xarita va bosqich tugmalari
 */
export default function InstantOrderPanel({ order, user, reload }) {
  const toast = useToast();
  const navigate = useNavigate();
  const now = useNow();
  const [config, setConfig] = useState(null);
  const [masterPos, setMasterPos] = useState(
    order.master_lat ? { lat: order.master_lat, lng: order.master_lng } : null
  );
  const [eta, setEta] = useState(null);
  const [radius, setRadius] = useState(Number(order.search_radius_km) || null);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const isClient = order.client_id === user.id;
  const isMaster = order.master_id === user.id;

  useEffect(() => {
    api('/dispatch/config').then(({ data }) => setConfig(data)).catch(() => {});
  }, []);

  useEffect(() => {
    setRadius(Number(order.search_radius_km) || null);
    if (order.master_lat) setMasterPos({ lat: order.master_lat, lng: order.master_lng });
  }, [order.search_radius_km, order.master_lat, order.master_lng]);

  // Jonli hodisalar: holat, qidiruv radiusi, usta joylashuvi
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const onUpdated = (payload) => {
      if (payload.order_id !== order.id) return;
      if (payload.message) toast.success(payload.message);
      reload();
    };
    const onSearch = (payload) => {
      if (payload.order_id === order.id && payload.radius_km) setRadius(payload.radius_km);
    };
    const onLocation = (payload) => {
      if (payload.order_id !== order.id) return;
      setMasterPos({ lat: payload.lat, lng: payload.lng });
      setEta({ min: payload.eta_min, km: payload.distance_km });
    };
    socket.on('order_updated', onUpdated);
    socket.on('search_update', onSearch);
    socket.on('master_location', onLocation);
    return () => {
      socket.off('order_updated', onUpdated);
      socket.off('search_update', onSearch);
      socket.off('master_location', onLocation);
    };
  }, [order.id, reload, toast]);

  const setStatus = async (status, extra = {}) => {
    setBusy(true);
    try {
      await api(`/orders/${order.id}/status`, { method: 'PUT', body: { status, ...extra } });
      await reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (reason) => {
    try {
      const response = await api(`/dispatch/orders/${order.id}/cancel`, { method: 'POST', body: { reason } });
      toast.success(response.message);
      setDialog(null);
      if (isMaster) navigate('/master/work');
      else reload();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const retry = async () => {
    setBusy(true);
    try {
      const { data } = await api('/dispatch/orders', {
        method: 'POST',
        body: {
          specialization_id: order.specialization_id,
          lat: order.lat,
          lng: order.lng,
          address: order.address,
          district: order.district,
          description: order.description
        }
      });
      navigate(`/orders/${data.id}`);
    } catch (error) {
      if (error.data?.data?.order_id) navigate(`/orders/${error.data.data.order_id}`);
      else toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const stageIndex = STAGES.findIndex((s) => s.id === order.status);
  const freeCancelUntil = order.accepted_at && config
    ? new Date(order.accepted_at).getTime() + config.free_cancel_min * 60000
    : null;
  const lateCancelWarning = isClient && freeCancelUntil && now > freeCancelUntil
    ? `Bepul bekor qilish vaqti (${config.free_cancel_min} daqiqa) o'tdi. Bekor qilish "kech bekor qilish" sifatida qayd etiladi.`
    : null;

  const header = {
    searching: {
      tone: 'from-amber-500 to-orange-500',
      title: 'Usta qidirilmoqda...',
      text: `Yaqin atrofdagi bo'sh ustalarga navbat bilan taklif yuborilmoqda${radius ? ` · radius ${radius} km` : ''}`,
      extra: `Qidiruv: ${formatDuration(now - new Date(order.search_started_at || order.created_at))}`
    },
    accepted: {
      tone: 'from-blue-600 to-indigo-600',
      title: isMaster ? 'Mijoz manziliga yo\'l oling' : `${order.master_name || 'Usta'} yo'lda`,
      text: eta ? `~${eta.min} daqiqa · ${eta.km} km qoldi` : 'Usta manzilingizga yo\'lga chiqdi',
      extra: freeCancelUntil && isClient && now < freeCancelUntil
        ? `Bepul bekor qilish: ${formatDuration(freeCancelUntil - now)}`
        : null
    },
    arrived: {
      tone: 'from-violet-600 to-purple-600',
      title: isMaster ? 'Siz manzildasiz' : 'Usta yetib keldi!',
      text: isMaster ? 'Mijoz bilan ish narxini kelishib, ishni boshlang' : 'Usta bilan ish hajmi va narxini kelishib oling',
      extra: order.arrived_at ? `Kutish: ${formatDuration(now - new Date(order.arrived_at))}` : null
    },
    in_progress: {
      tone: 'from-indigo-600 to-blue-700',
      title: 'Ish bajarilmoqda',
      text: 'Ish tugagach usta yakuniy summani kiritadi',
      extra: order.started_at ? `Davomiyligi: ${formatDuration(now - new Date(order.started_at))}` : null
    },
    completed: {
      tone: 'from-emerald-600 to-teal-600',
      title: 'Ish yakunlandi',
      text: `Yakuniy summa: ${formatPrice(order.final_price)} — to'lov ustaga naqd yoki karta orqali`,
      extra: order.started_at && order.completed_at
        ? `Ish davomiyligi: ${formatDuration(new Date(order.completed_at) - new Date(order.started_at))}`
        : null
    },
    cancelled: {
      tone: 'from-slate-600 to-slate-700',
      title: 'Chaqiruv bekor qilindi',
      text: [
        order.cancelled_by === 'client' ? 'Mijoz bekor qildi' : order.cancelled_by === 'admin' ? 'Administrator bekor qildi' : 'Bekor qilindi',
        order.cancel_reason
      ].filter(Boolean).join(': '),
      extra: order.late_cancel ? 'Kech bekor qilish qayd etildi' : null
    },
    expired: {
      tone: 'from-slate-600 to-slate-700',
      title: 'Bo\'sh usta topilmadi',
      text: 'Hozircha yaqin atrofda bo\'sh usta yo\'q. Birozdan keyin qayta urinib ko\'ring yoki oddiy buyurtma qoldiring.',
      extra: null
    }
  }[order.status];

  const markers = [
    { id: 'client', lat: order.lat, lng: order.lng, type: 'client', label: order.address },
    ...(masterPos && ['accepted', 'arrived'].includes(order.status)
      ? [{ id: 'master', ...masterPos, type: 'master', label: order.master_name || 'Usta' }]
      : [])
  ];

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl bg-gradient-to-r ${header.tone} text-white p-5 sm:p-6 relative overflow-hidden`}>
        {order.status === 'searching' && (
          <span className="absolute -right-6 -top-6 w-32 h-32 rounded-full border-4 border-white/30 animate-ping" />
        )}
        <p className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-1">
          ⚡ Tezkor chaqiruv · {order.specialization_icon} {order.specialization_name}
        </p>
        <h1 className="text-2xl font-extrabold">{header.title}</h1>
        <p className="text-sm text-white/85 mt-1">{header.text}</p>
        {header.extra && <p className="text-xs font-bold mt-2 tabular-nums bg-white/15 inline-block px-2.5 py-1 rounded-lg">{header.extra}</p>}

        {stageIndex >= 0 && (
          <div className="flex items-center gap-1 mt-5">
            {STAGES.map((stage, i) => {
              const Icon = stage.icon;
              const done = i < stageIndex || order.status === 'completed';
              const active = i === stageIndex && order.status !== 'completed';
              return (
                <React.Fragment key={stage.id}>
                  <div className="flex flex-col items-center w-14">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      done ? 'bg-white text-emerald-600' : active ? 'bg-white text-slate-900 ring-4 ring-white/30' : 'bg-white/20 text-white/70'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="text-[10px] mt-1 font-semibold text-white/90">{stage.label}</span>
                  </div>
                  {i < STAGES.length - 1 && <div className={`flex-1 h-0.5 -mt-4 ${i < stageIndex ? 'bg-white' : 'bg-white/25'}`} />}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      <MapView
        center={{ lat: order.lat, lng: order.lng }}
        markers={markers}
        radiusKm={order.status === 'searching' ? radius : null}
        className="h-64 sm:h-80"
        zoom={order.status === 'searching' ? 12 : 14}
      />

      <div className="card p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
            <div><span className="text-[11px] text-slate-400 block">Manzil</span><span className="font-semibold text-slate-800">{[order.district, order.address].filter(Boolean).join(', ')}</span></div>
          </div>
          <div className="flex items-start gap-2">
            <Wallet className="w-4 h-4 text-slate-400 mt-0.5" />
            <div><span className="text-[11px] text-slate-400 block">Chiqish narxi</span><span className="font-semibold text-slate-800">{formatPrice(order.call_fee)}</span></div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <span className="text-[11px] text-slate-400 block">{order.final_price ? 'Yakuniy summa' : 'Ish narxi'}</span>
              <span className="font-semibold text-slate-800">{order.final_price ? formatPrice(order.final_price) : 'Joyida kelishiladi'}</span>
            </div>
          </div>
        </div>
        {order.description && <p className="text-sm text-slate-600 mt-3 pt-3 border-t border-slate-100">{order.description}</p>}
        {isMaster && order.client_rating && (
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
            Mijoz reytingi: <Star className="w-3.5 h-3.5 text-amber-500 fill-current" /> {Number(order.client_rating).toFixed(1)}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          {isMaster && ['accepted', 'arrived'].includes(order.status) && (
            <a
              href={navigationUrl(order.lat, order.lng)}
              target="_blank"
              rel="noreferrer"
              className="btn btn-dark font-bold"
            >
              <Navigation className="w-4 h-4" /> Navigator
            </a>
          )}
          {isMaster && order.status === 'accepted' && (
            <button disabled={busy} onClick={() => setStatus('arrived')} className="btn btn-primary font-bold">
              Yetib keldim
            </button>
          )}
          {isMaster && order.status === 'arrived' && (
            <button disabled={busy} onClick={() => setStatus('in_progress')} className="btn btn-primary font-bold">
              Ishni boshlash
            </button>
          )}
          {isMaster && order.status === 'in_progress' && (
            <button disabled={busy} onClick={() => setDialog('complete')} className="btn btn-success font-bold">
              Ishni yakunlash
            </button>
          )}
          {((isClient && ['searching', 'accepted', 'arrived'].includes(order.status))
            || (isMaster && ['accepted', 'arrived'].includes(order.status))) && config && (
            <button onClick={() => setDialog('cancel')} className="btn btn-secondary border-red-200 text-red-600 hover:bg-red-50 font-bold">
              <XCircle className="w-4 h-4" /> Bekor qilish
            </button>
          )}
          {isClient && order.status === 'expired' && (
            <>
              <button disabled={busy} onClick={retry} className="btn btn-accent">
                Qayta chaqirish
              </button>
              <Link to="/" className="btn btn-secondary">
                Katalogdan usta tanlash
              </Link>
            </>
          )}
        </div>
      </div>

      {isMaster && order.status === 'completed' && !order.client_rating_by_master && (
        <RateClientForm orderId={order.id} onDone={reload} />
      )}

      {dialog === 'cancel' && config && (
        <CancelDialog
          reasons={isMaster ? config.master_cancel_reasons : config.client_cancel_reasons}
          warning={isMaster
            ? 'Qabul qilingan buyurtmadan voz kechish statistikangizda qayd etiladi. Buyurtma boshqa ustaga beriladi.'
            : lateCancelWarning}
          onConfirm={cancel}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'complete' && (
        <CompleteDialog
          callFee={order.call_fee}
          onConfirm={async (price) => {
            await setStatus('completed', { final_price: price });
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
