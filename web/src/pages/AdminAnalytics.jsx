import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import ColumnChart from '../components/charts/ColumnChart';
import { ErrorState } from '../components/EmptyState';
import Spinner from '../components/Spinner';
import { api } from '../lib/api';
import { formatPrice } from '../lib/format';

const PERIODS = [7, 14, 30, 90];

const duration = (seconds) => {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} daq ${seconds % 60} s` : `${Math.floor(minutes / 60)} soat ${minutes % 60} daq`;
};

const shortDate = (day) => {
  const d = new Date(day);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function Tile({ label, value, hint, warn }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="text-xl font-black text-slate-900 mt-1">{value}</p>
      {hint && (
        <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${warn ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
          {warn && <AlertTriangle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />}
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * MVP o'lchovlari: usta topilish darajasi, kutish vaqti, kunlik va soatlik talab, sohalar bo'yicha talab/taklif
 */
export default function AdminAnalytics() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = (period = days) => {
    setLoading(true);
    setError(null);
    api('/admin/analytics', { params: { days: period } })
      .then(({ data: result }) => setData(result))
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(() => load(days), [days]);

  if (error && !data) return <ErrorState message={error.message} onRetry={() => load()} />;
  if (!data) return <div className="card p-8 flex justify-center"><Spinner className="w-5 h-5" label="Statistika yuklanmoqda..." /></div>;

  const { kpi } = data;
  const daily = data.daily.map((d) => ({
    label: shortDate(d.day),
    title: new Date(d.day).toLocaleDateString('ru-RU'),
    values: { instant: d.instant, catalog: d.catalog },
    note: d.instant ? `usta topildi: ${d.instant_found} / ${d.instant}` : undefined
  }));
  const hourly = data.hourly.map((h) => ({ label: String(h.hour), title: `${String(h.hour).padStart(2, '0')}:00–${String(h.hour).padStart(2, '0')}:59`, values: { orders: h.orders } }));
  const maxSpecOrders = Math.max(1, ...data.by_specialization.map((s) => s.total));

  return (
    <section className="space-y-4" aria-labelledby="analytics-title">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 id="analytics-title" className="font-bold text-slate-900">MVP ko'rsatkichlari</h3>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100" role="radiogroup" aria-label="Davr">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={days === p}
              onClick={() => setDays(p)}
              className={`min-h-9 px-3 rounded-lg text-xs font-bold ${days === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {p} kun
            </button>
          ))}
        </div>
      </div>

      <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile
            label="Usta topildi"
            value={kpi.found_rate === null ? '—' : `${kpi.found_rate}%`}
            hint={`${kpi.instant_found} / ${kpi.instant_total} tezkor chaqiruv`}
            warn={kpi.found_rate !== null && kpi.found_rate < 70}
          />
          <Tile label="Usta topilish vaqti (mediana)" value={duration(kpi.median_wait_sec)} hint="chaqiruvdan qabulgacha" />
          <Tile label="Yetib kelish vaqti (mediana)" value={duration(kpi.median_arrival_sec)} hint="qabuldan yetib kelguncha" />
          <Tile label="Yakunlangan ishlar" value={kpi.completed} hint={`o'rtacha baho ${kpi.avg_rating.toFixed(1)}`} />
          <Tile label="Aylanma" value={formatPrice(kpi.revenue)} hint={`komissiya ${kpi.commission_percent}%: ${formatPrice(kpi.commission)}`} />
          <Tile label="Qayta buyurtma bergan mijozlar" value={`${kpi.repeat_clients} / ${kpi.paying_clients}`} hint="kamida 2 ta yakunlangan buyurtma" />
          <Tile
            label="Bekor qilishlar"
            value={kpi.cancelled_by_client + kpi.cancelled_by_master}
            hint={`mijoz ${kpi.cancelled_by_client} · usta ${kpi.cancelled_by_master} · kech ${kpi.late_cancels}`}
          />
          <Tile
            label="Ochiq murojaatlar"
            value={kpi.open_tickets}
            hint={`davr ichida ${kpi.tickets_in_period} ta`}
            warn={kpi.open_tickets > 0}
          />
        </div>

        <div className="card p-5">
          <ColumnChart
            caption={`Kunlik buyurtmalar (${data.days} kun)`}
            data={daily}
            series={[
              { key: 'instant', label: 'Tezkor', color: 'var(--chart-1)' },
              { key: 'catalog', label: 'Oddiy', color: 'var(--chart-2)' }
            ]}
            labelEvery={data.days > 14 ? 7 : data.days > 7 ? 2 : 1}
            labelAnchor="end"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <ColumnChart
              caption="Tezkor chaqiruvlar soatlar bo'yicha (Toshkent vaqti)"
              data={hourly}
              series={[{ key: 'orders', label: 'Chaqiruvlar', color: 'var(--chart-1)' }]}
              labelEvery={3}
              height={120}
            />
            <p className="hint mt-2">Eng ko'p talab bo'lgan soatlarda ustalarni ishga chiqishga undang.</p>
          </div>

          <div className="card p-5">
            <h4 className="text-sm font-bold text-slate-900 mb-3">Sohalar: talab va ustalar</h4>
            {data.by_specialization.length === 0 ? (
              <p className="text-sm text-slate-400">Bu davrda buyurtma yo'q</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-slate-500 text-left">
                  <tr>
                    <th className="pb-2 font-semibold">Soha</th>
                    <th className="pb-2 font-semibold">Buyurtmalar</th>
                    <th className="pb-2 font-semibold text-right">Usta topildi</th>
                    <th className="pb-2 font-semibold text-right">Ustalar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.by_specialization.map((s) => {
                    const rate = s.instant ? Math.round((s.found / s.instant) * 100) : null;
                    const fewMasters = s.verified_masters < 3;
                    return (
                      <tr key={s.id}>
                        <td className="py-2 pr-2 text-slate-800 font-semibold">{s.icon} {s.name_uz}</td>
                        <td className="py-2 pr-2 w-1/3">
                          <div className="flex items-center gap-2">
                            <span className="h-2 rounded-r" style={{ width: `${(s.total / maxSpecOrders) * 100}%`, minWidth: 2, background: 'var(--chart-1)' }} aria-hidden="true" />
                            <span className="text-slate-700 tabular-nums">{s.total}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums text-slate-700">{rate === null ? '—' : `${rate}%`}</td>
                        <td className="py-2 text-right tabular-nums">
                          <span className={fewMasters ? 'inline-flex items-center gap-1 text-amber-700 font-semibold' : 'text-slate-700'}>
                            {fewMasters && <AlertTriangle className="w-3 h-3" aria-label="Usta kam" />}
                            {s.verified_masters}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p className="hint mt-2">⚠ — tasdiqlangan ustalar 3 tadan kam: shu sohaga usta jalb qilish kerak.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
