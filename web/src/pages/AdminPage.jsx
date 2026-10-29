import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, Users, ClipboardList, Search, ShieldCheck, Ban, CheckCircle,
  UserCheck, Wrench, Star, TrendingUp, Zap, Radar, Power
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner, { PageLoader } from '../components/Spinner';
import { ErrorState } from '../components/EmptyState';
import OrdersPage from './OrdersPage';
import { api } from '../lib/api';
import { formatDate, formatPhone, formatPrice, formatRating, ROLE_LABELS } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const TABS = [
  { id: 'stats', label: 'Statistika', icon: LayoutDashboard },
  { id: 'users', label: 'Foydalanuvchilar', icon: Users },
  { id: 'orders', label: 'Buyurtmalar', icon: ClipboardList }
];

function StatCard({ icon: Icon, label, value, hint, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600'
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <span className={`p-2 rounded-xl ${tones[tone]}`}><Icon className="w-4 h-4" /></span>
      </div>
      <p className="text-2xl font-black text-slate-900 mt-2">{value}</p>
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function StatsTab() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api('/admin/stats').then(({ data }) => setStats(data)).catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!stats) return <PageLoader />;

  const { users, orders, reviews } = stats;
  const statusRows = [
    ['Kutilmoqda / qidirilmoqda', orders.pending],
    ['Qabul qilingan', orders.accepted],
    ['Bajarilmoqda', orders.in_progress],
    ['Yakunlangan', orders.completed],
    ['Bekor qilingan', orders.cancelled]
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Foydalanuvchilar" value={users.total} hint={`+${users.new_this_week} shu hafta`} />
        <StatCard icon={Wrench} label="Ustalar" value={users.masters} hint={`${stats.unverified_masters} ta tasdiqlanmagan`} tone="amber" />
        <StatCard icon={ClipboardList} label="Buyurtmalar" value={orders.total} hint={`${orders.completed} ta yakunlangan`} tone="emerald" />
        <StatCard icon={Star} label="O'rtacha reyting" value={formatRating(reviews.average)} hint={`${reviews.total} ta sharh`} tone="slate" />
      </div>

      {stats.live && (
        <div>
          <h3 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2"><Zap className="w-4 h-4 text-orange-500" /> Tezkor chaqiruv — jonli</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={Power} label="Liniyadagi ustalar" value={stats.live.online_masters} tone="emerald" />
            <StatCard icon={Radar} label="Usta qidirilmoqda" value={stats.live.searching} tone="amber" />
            <StatCard icon={Wrench} label="Faol ishlar" value={stats.live.active_jobs} />
            <StatCard
              icon={TrendingUp}
              label="Bugungi aylanma"
              value={formatPrice(stats.live.instant_revenue_today)}
              hint={`${stats.live.expired_today} ta chaqiruvga usta topilmadi`}
              tone="slate"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-900 text-sm mb-3">Buyurtmalar holati</h3>
          <table className="w-full text-sm">
            <tbody>
              {statusRows.map(([label, value]) => (
                <tr key={label} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 text-slate-600">{label}</td>
                  <td className="py-2 text-right font-bold text-slate-900 tabular-nums">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-400 mt-3">
            Yakunlangan buyurtmalar byudjeti: <strong className="text-slate-600">{formatPrice(orders.completed_budget)}</strong>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" /> Oxirgi 7 kun
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-slate-400 text-left">
                <th className="font-semibold pb-1">Sana</th>
                <th className="font-semibold pb-1 text-right">Yangi buyurtmalar</th>
              </tr>
            </thead>
            <tbody>
              {stats.orders_last_7_days.map((row) => (
                <tr key={row.day} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 text-slate-600">{formatDate(row.day, false)}</td>
                  <td className="py-1.5 text-right font-bold text-slate-900 tabular-nums">{row.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={UserCheck} label="Mijozlar" value={users.clients} tone="slate" />
        <StatCard icon={ShieldCheck} label="Adminlar" value={users.admins} tone="slate" />
        <StatCard icon={Ban} label="Bloklangan" value={users.blocked} tone="slate" />
      </div>
    </div>
  );
}

function UsersTab() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async (page = 1) => {
    setState(page === 1 ? 'loading' : 'more');
    try {
      const response = await api('/admin/users', { params: { q: query, role, status, page } });
      setUsers((list) => (page === 1 ? response.data : [...list, ...response.data]));
      setPagination(response.pagination);
      setState('ready');
    } catch (err) {
      setError(err.message);
      setState('error');
    }
  }, [query, role, status]);

  useEffect(() => {
    const timer = setTimeout(() => load(1), 300);
    return () => clearTimeout(timer);
  }, [load]);

  const patch = async (target, body, successMessage) => {
    setBusyId(target.id);
    try {
      const { data } = await api(`/admin/users/${target.id}`, { method: 'PATCH', body });
      setUsers((list) => list.map((u) => (u.id === target.id ? { ...u, ...data } : u)));
      toast.success(successMessage);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  };

  const selectClass = 'px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none';

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="flex items-center px-3 bg-white border border-slate-200 rounded-xl flex-1">
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <input
            className="w-full py-2 text-sm outline-none bg-transparent"
            placeholder="Ism yoki telefon raqam..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className={selectClass} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Barcha rollar</option>
          {Object.entries(ROLE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Barcha holatlar</option>
          <option value="active">Faol</option>
          <option value="blocked">Bloklangan</option>
        </select>
      </div>

      {state === 'loading' && <PageLoader />}
      {state === 'error' && <ErrorState message={error} onRetry={() => load(1)} />}

      {(state === 'ready' || state === 'more') && (
        <>
          <p className="text-xs text-slate-500 mb-2">Jami: {pagination?.total ?? 0}</p>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-left font-semibold px-4 py-3">Foydalanuvchi</th>
                    <th className="text-left font-semibold px-4 py-3">Rol</th>
                    <th className="text-left font-semibold px-4 py-3">Buyurtmalar</th>
                    <th className="text-left font-semibold px-4 py-3">Ro'yxatdan o'tgan</th>
                    <th className="text-right font-semibold px-4 py-3">Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isMe = u.id === me.id;
                    const busy = busyId === u.id;
                    return (
                      <tr key={u.id} className={`border-t border-slate-100 ${u.is_active ? '' : 'bg-red-50/40'}`}>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1">
                            {u.name || 'Ism yo\'q'}
                            {u.is_verified && <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />}
                            {isMe && <span className="text-[10px] text-blue-600 font-semibold">(siz)</span>}
                          </div>
                          <div className="text-xs text-slate-500">{formatPhone(u.phone)}</div>
                          {!u.is_active && <span className="text-[10px] font-bold text-red-600">Bloklangan</span>}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            className="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white disabled:opacity-50"
                            value={u.role}
                            disabled={isMe || busy}
                            onChange={(e) => {
                              const nextRole = e.target.value;
                              // Administrator huquqini berish/olish alohida tasdiqlanadi
                              if (nextRole === 'admin' || u.role === 'admin') setConfirm({ user: u, role: nextRole });
                              else patch(u, { role: nextRole }, 'Rol o\'zgartirildi');
                            }}
                          >
                            {Object.entries(ROLE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                          </select>
                          {u.role === 'master' && u.rating !== null && (
                            <div className="text-[11px] text-slate-400 mt-1">★ {formatRating(u.rating)} · {u.reviews_count} sharh</div>
                          )}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-700">{u.orders_count}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDate(u.created_at, false)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            {busy && <Spinner className="w-4 h-4" />}
                            {u.role === 'master' && (
                              <button
                                disabled={busy}
                                onClick={() => patch(u, { is_verified: !u.is_verified }, u.is_verified ? 'Tasdiq bekor qilindi' : 'Usta tasdiqlandi')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                                  u.is_verified ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100'
                                }`}
                              >
                                {u.is_verified ? 'Tasdiqni olish' : 'Tasdiqlash'}
                              </button>
                            )}
                            {!isMe && (
                              u.is_active ? (
                                <button
                                  disabled={busy}
                                  onClick={() => setConfirm({ user: u })}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 inline-flex items-center gap-1"
                                >
                                  <Ban className="w-3.5 h-3.5" /> Bloklash
                                </button>
                              ) : (
                                <button
                                  disabled={busy}
                                  onClick={() => patch(u, { is_active: true }, 'Foydalanuvchi faollashtirildi')}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-emerald-200 text-emerald-700 hover:bg-emerald-50 inline-flex items-center gap-1"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" /> Faollashtirish
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {users.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">Foydalanuvchilar topilmadi</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {pagination && pagination.page < pagination.totalPages && (
            <div className="text-center pt-4">
              <button
                onClick={() => load(pagination.page + 1)}
                disabled={state === 'more'}
                className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2"
              >
                {state === 'more' ? <Spinner className="w-4 h-4" /> : 'Ko\'proq ko\'rsatish'}
              </button>
            </div>
          )}
        </>
      )}

      {confirm && (
        confirm.role ? (
          <ConfirmDialog
            title={`Rolni "${ROLE_LABELS[confirm.role]}" ga o'zgartirasizmi?`}
            description={confirm.role === 'admin'
              ? 'Administrator barcha foydalanuvchilar va buyurtmalarni boshqara oladi.'
              : 'Foydalanuvchi administrator huquqlaridan mahrum bo\'ladi.'}
            confirmLabel="O'zgartirish"
            tone="primary"
            loading={busyId === confirm.user.id}
            onConfirm={() => patch(confirm.user, { role: confirm.role }, 'Rol o\'zgartirildi')}
            onClose={() => setConfirm(null)}
          />
        ) : (
          <ConfirmDialog
            title={`${confirm.user.name || formatPhone(confirm.user.phone)} bloklansinmi?`}
            description="Foydalanuvchi tizimga kira olmaydi, usta bo'lsa katalogdan yashiriladi. Keyin qayta faollashtirish mumkin."
            confirmLabel="Bloklash"
            loading={busyId === confirm.user.id}
            onConfirm={() => patch(confirm.user, { is_active: false }, 'Foydalanuvchi bloklandi')}
            onClose={() => setConfirm(null)}
          />
        )
      )}
    </div>
  );
}

export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === searchParams.get('section')) ? searchParams.get('section') : 'stats';

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-slate-900 text-white"><ShieldCheck className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Admin panel</h1>
            <p className="text-xs text-slate-500">Platforma statistikasi, foydalanuvchilar va buyurtmalar</p>
          </div>
        </div>
        <Link to="/" className="text-sm font-semibold text-blue-600 hover:text-blue-700">Katalogga qaytish →</Link>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 border-b border-slate-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSearchParams(id === 'stats' ? {} : { section: id }, { replace: true })}
            className={`px-4 py-2.5 text-sm font-bold whitespace-nowrap inline-flex items-center gap-2 border-b-2 -mb-px transition ${
              tab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'stats' && <StatsTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'orders' && <OrdersPage embedded />}
    </main>
  );
}
