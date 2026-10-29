import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OfferModal from '../components/OfferModal';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { getCurrentPosition } from '../lib/geo';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const DispatchContext = createContext(null);

const LOCATION_INTERVAL_MS = 15000;
const MANUAL_LOCATION_KEY = 'uyremont_manual_location';

const readManualLocation = () => {
  try {
    const value = JSON.parse(localStorage.getItem(MANUAL_LOCATION_KEY));
    return value && Number.isFinite(value.lat) && Number.isFinite(value.lng) ? value : null;
  } catch {
    return null;
  }
};

/**
 * Usta ish rejimi: ishda/dam olish holati, joylashuvni yuborish va kelgan takliflar.
 * Faqat usta roli uchun ishlaydi, boshqalar uchun bo'sh qiymat qaytaradi.
 */
export function DispatchProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const isMaster = user?.role === 'master';

  const [state, setState] = useState(null);
  const [offer, setOffer] = useState(null);
  const [gps, setGps] = useState({ status: 'idle', position: null, error: '' });
  const [manualLocation, setManualLocationState] = useState(readManualLocation);
  const positionRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!isMaster) return null;
    try {
      const { data } = await api('/dispatch/me');
      setState(data);
      if (data.pending_offer) setOffer(data.pending_offer);
      return data;
    } catch {
      return null;
    }
  }, [isMaster]);

  useEffect(() => {
    setState(null);
    setOffer(null);
    if (isMaster) refresh();
  }, [isMaster, user?.id, refresh]);

  const isOnline = Boolean(state?.is_online);
  const hasActiveJob = Boolean(state?.active_job);
  const sharing = isMaster && (isOnline || hasActiveJob);

  // Joriy joylashuv: GPS yoki qo'lda belgilangan nuqta
  const currentLocation = gps.position || manualLocation;
  positionRef.current = currentLocation;

  // Socket hodisalari
  useEffect(() => {
    if (!isMaster) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;

    const onOffer = (payload) => setOffer(payload);
    const onClosed = (payload) => {
      setOffer((current) => {
        if (current && current.offer_id === payload.offer_id) {
          toast.error(payload.reason === 'cancelled' ? 'Mijoz buyurtmani bekor qildi' : 'Taklif vaqti tugadi');
          return null;
        }
        return current;
      });
      refresh();
    };
    const onOffline = (payload) => {
      toast.error(payload.reason);
      refresh();
    };
    const onOrderUpdated = () => refresh();

    socket.on('order_offer', onOffer);
    socket.on('offer_closed', onClosed);
    socket.on('dispatch_offline', onOffline);
    socket.on('order_updated', onOrderUpdated);
    return () => {
      socket.off('order_offer', onOffer);
      socket.off('offer_closed', onClosed);
      socket.off('dispatch_offline', onOffline);
      socket.off('order_updated', onOrderUpdated);
    };
  }, [isMaster, refresh, toast]);

  // GPS kuzatuvi ish rejimida yoki faol ish paytida
  useEffect(() => {
    if (!sharing || !navigator.geolocation) return undefined;
    setGps((g) => ({ ...g, status: 'locating' }));
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGps({ status: 'ok', position: { lat: pos.coords.latitude, lng: pos.coords.longitude }, error: '' }),
      (err) => setGps((g) => ({ ...g, status: 'error', error: err.code === 1 ? 'Joylashuvga ruxsat berilmagan' : 'GPS signal yo\'q' })),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [sharing]);

  // Joylashuvni serverga muntazam yuborish
  useEffect(() => {
    if (!sharing) return undefined;
    const send = () => {
      const position = positionRef.current;
      if (position) api('/dispatch/location', { method: 'PUT', body: position }).catch(() => {});
    };
    send();
    const timer = setInterval(send, LOCATION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [sharing, manualLocation]);

  const setManualLocation = useCallback((location) => {
    setManualLocationState(location);
    try {
      if (location) localStorage.setItem(MANUAL_LOCATION_KEY, JSON.stringify(location));
      else localStorage.removeItem(MANUAL_LOCATION_KEY);
    } catch {
      // saqlanmasa ham sessiya davomida ishlaydi
    }
  }, []);

  const goOnline = useCallback(async () => {
    let location = positionRef.current;
    if (!location) {
      try {
        location = await getCurrentPosition({ timeout: 8000 });
        setGps({ status: 'ok', position: { lat: location.lat, lng: location.lng }, error: '' });
      } catch (error) {
        toast.error(error.message);
        return false;
      }
    }
    try {
      const response = await api('/dispatch/online', { method: 'PUT', body: { online: true, lat: location.lat, lng: location.lng } });
      toast.success(response.message);
      await refresh();
      return true;
    } catch (error) {
      toast.error(error.message);
      return false;
    }
  }, [refresh, toast]);

  const goOffline = useCallback(async () => {
    try {
      const response = await api('/dispatch/online', { method: 'PUT', body: { online: false } });
      toast.success(response.message);
      setOffer(null);
      await refresh();
    } catch (error) {
      toast.error(error.message);
    }
  }, [refresh, toast]);

  const acceptOffer = async () => {
    if (!offer) return;
    try {
      const { data } = await api(`/dispatch/offers/${offer.offer_id}/accept`, { method: 'POST' });
      setOffer(null);
      toast.success('Buyurtma qabul qilindi. Mijoz manziliga yo\'l oling');
      await refresh();
      navigate(`/orders/${data.id}`);
    } catch (error) {
      toast.error(error.message);
      setOffer(null);
      refresh();
    }
  };

  const declineOffer = async () => {
    if (!offer) return;
    try {
      await api(`/dispatch/offers/${offer.offer_id}/decline`, { method: 'POST' });
    } catch {
      // taklif allaqachon yopilgan bo'lishi mumkin
    }
    setOffer(null);
    refresh();
  };

  const value = useMemo(() => ({
    enabled: isMaster,
    state,
    isOnline,
    gps,
    manualLocation,
    currentLocation,
    refresh,
    goOnline,
    goOffline,
    setManualLocation
  }), [isMaster, state, isOnline, gps, manualLocation, currentLocation, refresh, goOnline, goOffline, setManualLocation]);

  return (
    <DispatchContext.Provider value={value}>
      {children}
      {isMaster && offer && (
        <OfferModal key={offer.offer_id} offer={offer} onAccept={acceptOffer} onDecline={declineOffer} />
      )}
    </DispatchContext.Provider>
  );
}

export const useDispatch = () => useContext(DispatchContext);
