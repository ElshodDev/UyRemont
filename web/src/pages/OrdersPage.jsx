import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardList, Inbox, Search } from 'lucide-react';
import OrderListItem, { OrderListSkeleton } from '../components/OrderListItem';
import EmptyState, { ErrorState } from '../components/EmptyState';
import Spinner from '../components/Spinner';
import { api } from '../lib/api';
import { ORDER_STATUSES } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const STATUS_FILTERS = [{ id: '', label: 'Barchasi' }, ...Object.entries(ORDER_STATUSES).map(([id, s]) => ({ id, label: s.label }))];

export default function OrdersPage({ embedded = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMaster = user.role === 'master';
  const isAdmin = user.role === 'admin';
  const tab = isMaster && searchParams.get('tab') === 'open' ? 'open' : 'mine';
  const statusFilter = searchParams.get('status') || '';

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [claiming, setClaiming] = useState(null);

  const load = useCallback(async (page = 1) => {
    setState(page === 1 ? 'loading' : 'more');
    try {
      if (tab === 'open') {
        const { data } = await api('/orders/open');
        setOrders(data);
        setPagination(null);
      } else {
        const response = await api('/orders', { params: { status: statusFilter, page, q: isAdmin ? query : undefined } });
        setOrders((list) => (page === 1 ? response.data : [...list, ...response.data]));
        setPagination(response.pagination);
      }
      setState('ready');
    } catch (err) {
      setError(err.message);
      setState('error');
    }
  }, [tab, statusFilter, isAdmin, query]);

  useEffect(() => {
    const timer = setTimeout(() => load(1), isAdmin ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, isAdmin]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key === 'tab') next.delete('status');
    setSearchParams(next, { replace: true });
  };

  const claim = async (order) => {
    setClaiming(order.id);
    try {
      await api(`/orders/${order.id}/status`, { method: 'PUT', body: { status: 'accepted' } });
      toast.success('Buyurtma sizga biriktirildi');
      setOrders((list) => list.filter((o) => o.id !== order.id));
    } catch (err) {
      toast.error(err.message);
      if (err.status === 409 || err.status === 403) load(1);
    } finally {
      setClaiming(null);
    }
  };

  const title = isAdmin ? 'Barcha buyurtmalar' : isMaster ? 'Buyurtmalar' : 'Mening buyurtmalarim';

  return (
    <Wrapper embedded={embedded}>
      {!embedded && <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600"><ClipboardList className="w-6 h-6" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-500">
            {isMaster ? 'Sizga kelgan va hududingizdagi ochiq buyurtmalar' : 'Buyurtmalar holati va usta bilan yozishmalar'}
          </p>
        </div>
      </div>}

      {isMaster && (
        <div className="inline-flex p-1 bg-slate-100 rounded-xl mb-4">
          {[{ id: 'mine', label: 'Mening buyurtmalarim' }, { id: 'open', label: 'Ochiq buyurtmalar' }].map((t) => (
            <button
              key={t.id}
              onClick={() => setParam('tab', t.id === 'mine' ? '' : t.id)}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition ${
                tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'mine' && (
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.id}
                onClick={() => setParam('status', s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition ${
                  statusFilter === s.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {isAdmin && (
            <div className="flex items-center px-3 bg-white border border-slate-200 rounded-xl sm:w-64">
              <Search className="w-4 h-4 text-slate-400 mr-2" />
              <input
                className="w-full py-2 text-sm outline-none bg-transparent"
                placeholder="Sarlavha yoki ism..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {state === 'loading' && <OrderListSkeleton />}
      {state === 'error' && <ErrorState message={error} onRetry={() => load(1)} />}

      {(state === 'ready' || state === 'more') && orders.length === 0 && (
        tab === 'open' ? (
          <EmptyState
            icon={<Inbox className="w-10 h-10 mx-auto text-slate-300" />}
            title="Hozircha ochiq buyurtmalar yo'q"
            description="Mutaxassisligingizga mos yangi buyurtma paydo bo'lganda shu yerda ko'rinadi."
          />
        ) : (
          <EmptyState
            icon="📋"
            title="Buyurtmalar topilmadi"
            description={user.role === 'client' ? 'Ustalar ro\'yxatidan kerakli ustani tanlab, birinchi buyurtmangizni bering.' : 'Bu bo\'limda hali buyurtmalar yo\'q.'}
            action={user.role === 'client' && (
              <Link to="/" className="btn btn-primary px-4">
                Usta topish
              </Link>
            )}
          />
        )
      )}

      {orders.length > 0 && state !== 'loading' && state !== 'error' && (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderListItem
              key={order.id}
              order={order}
              viewerRole={user.role}
              action={tab === 'open' && (
                <button
                  onClick={() => claim(order)}
                  disabled={claiming === order.id}
                  className="btn btn-primary w-full sm:w-auto px-4 font-bold"
                >
                  {claiming === order.id ? <Spinner className="w-4 h-4 text-white" /> : 'Buyurtmani olish'}
                </button>
              )}
            />
          ))}
          {pagination && pagination.page < pagination.totalPages && (
            <div className="text-center pt-3">
              <button
                onClick={() => load(pagination.page + 1)}
                disabled={state === 'more'}
                className="btn btn-secondary px-6"
              >
                {state === 'more' ? <Spinner className="w-4 h-4" /> : 'Ko\'proq ko\'rsatish'}
              </button>
            </div>
          )}
        </div>
      )}
    </Wrapper>
  );
}

function Wrapper({ embedded, children }) {
  return embedded
    ? <div>{children}</div>
    : <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full flex-1">{children}</main>;
}
