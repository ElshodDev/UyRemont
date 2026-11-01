import React, { useEffect, useMemo, useRef, useState } from 'react';

const niceMax = (value) => {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s * 4 >= value) || magnitude * 10;
  return Math.ceil(value / step) * step;
};

// X o'qidagi yozuvlar orasidagi eng kam masofa (px): "01.11" kabi yozuv qirqilmasligi uchun
const MIN_LABEL_GAP = 36;

const compact = (n) => (n >= 10000 ? `${Math.round(n / 1000)}K` : n.toLocaleString('ru-RU'));

/**
 * Ustunli grafik (bitta yoki ustma-ust bir nechta qator).
 * Ustunlar 24px gacha, yuqori uchi 4px yumaloq, segmentlar orasida 2px bo'shliq;
 * har bir ustun - hover/fokus maydoni (tooltip), "Jadval" ko'rinishi ham bor.
 * @param {{ data: { label: string, title?: string, values: Record<string, number>, note?: string }[],
 *           series: { key: string, label: string, color: string }[], height?: number, labelEvery?: number,
 *           labelAnchor?: 'start' | 'end',
 *           caption: string }} props
 */
export default function ColumnChart({ data, series, height = 160, labelEvery = 1, labelAnchor = 'start', caption, formatValue = compact }) {
  const [active, setActive] = useState(null);
  const [tableView, setTableView] = useState(false);
  const [plotWidth, setPlotWidth] = useState(0);
  const plotRef = useRef(null);
  const totals = useMemo(() => data.map((d) => series.reduce((sum, s) => sum + (d.values[s.key] || 0), 0)), [data, series]);
  const max = niceMax(Math.max(1, ...totals));
  const ticks = [0, max / 2, max];

  // Tor ekranda yozuvlar siyraklashadi (ustun kengligiga qarab)
  useEffect(() => {
    const node = plotRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setPlotWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, [tableView]);
  const columnWidth = plotWidth / Math.max(1, data.length);
  const step = columnWidth ? Math.max(labelEvery, Math.ceil(MIN_LABEL_GAP / columnWidth)) : labelEvery;
  const lastIndex = data.length - 1;
  // labelAnchor="end": oxirgi ustun (masalan, bugun) doim yozuvli, qolganlari undan orqaga sanaladi
  const showLabel = labelAnchor === 'end'
    ? (i) => (lastIndex - i) % step === 0
    : (i) => i % step === 0 || (i === lastIndex && (lastIndex % step) * columnWidth >= MIN_LABEL_GAP);

  return (
    <figure className="m-0">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <figcaption className="text-sm font-bold text-slate-900">{caption}</figcaption>
        <div className="flex items-center gap-3">
          {series.length > 1 && (
            <ul className="flex items-center gap-3 text-xs text-slate-600" aria-label="Belgilar">
              {series.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
                  {s.label}
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setTableView((v) => !v)} className="btn btn-sm btn-ghost min-h-9" aria-pressed={tableView}>
            {tableView ? 'Grafik' : 'Jadval'}
          </button>
        </div>
      </div>

      {tableView ? (
        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-xs tabular-nums">
            <thead className="text-slate-500 text-left">
              <tr>
                <th className="py-1.5 pr-3 font-semibold">Sana</th>
                {series.map((s) => <th key={s.key} className="py-1.5 pr-3 font-semibold text-right">{s.label}</th>)}
                {data.some((d) => d.note) && <th className="py-1.5 font-semibold text-right">Izoh</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {data.map((d) => (
                <tr key={d.label}>
                  <td className="py-1.5 pr-3">{d.title || d.label}</td>
                  {series.map((s) => <td key={s.key} className="py-1.5 pr-3 text-right">{formatValue(d.values[s.key] || 0)}</td>)}
                  {data.some((x) => x.note) && <td className="py-1.5 text-right text-slate-500">{d.note}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2">
          {/* Y o'qi */}
          <div className="relative w-8 flex-shrink-0 text-[10px] text-slate-400 tabular-nums" style={{ height }} aria-hidden="true">
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (t / max) * 100}%` }}>{compact(t)}</span>
            ))}
          </div>
          <div ref={plotRef} className="relative flex-1 min-w-0">
            {/* Gorizontal chiziqlar */}
            <div className="absolute inset-x-0 top-0" style={{ height }} aria-hidden="true">
              {ticks.map((t) => (
                <div key={t} className={`absolute inset-x-0 border-t ${t === 0 ? 'border-slate-300' : 'border-slate-100'}`} style={{ top: `${100 - (t / max) * 100}%` }} />
              ))}
            </div>
            <div className="relative flex items-end" style={{ height }} role="list" aria-label={caption}>
              {data.map((d, i) => {
                const total = totals[i];
                const label = `${d.title || d.label}: ${series.map((s) => `${s.label} ${formatValue(d.values[s.key] || 0)}`).join(', ')}${d.note ? `, ${d.note}` : ''}`;
                return (
                  <div key={d.label} role="listitem" className="relative flex-1 h-full flex items-end justify-center">
                    <button
                      type="button"
                      className="absolute inset-0 w-full rounded-md hover:bg-slate-100/60 focus-visible:bg-slate-100/60"
                      onPointerEnter={() => setActive(i)}
                      onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive((a) => (a === i ? null : a))}
                      aria-label={label}
                    />
                    <div className="relative flex flex-col-reverse gap-[2px] pointer-events-none" style={{ width: 'min(24px, 70%)', height: `${(total / max) * 100}%` }}>
                      {series.map((s, si) => {
                        const v = d.values[s.key] || 0;
                        if (!v) return null;
                        const isTop = series.slice(si + 1).every((next) => !(d.values[next.key] || 0));
                        return (
                          <div
                            key={s.key}
                            className={isTop ? 'rounded-t' : ''}
                            style={{ background: s.color, flexGrow: v, flexBasis: 0, minHeight: 2, opacity: active === null || active === i ? 1 : 0.55 }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* X o'qi */}
            <div className="relative h-4 mt-1.5 text-[10px] text-slate-400" aria-hidden="true">
              {data.map((d, i) => showLabel(i) && (
                <span key={d.label} className="absolute top-0 -translate-x-1/2 whitespace-nowrap" style={{ left: `${((i + 0.5) / data.length) * 100}%` }}>{d.label}</span>
              ))}
            </div>
            {active !== null && (
              <div
                className="absolute -top-2 z-10 pointer-events-none card shadow-lg px-3 py-2 text-xs whitespace-nowrap"
                style={{
                  left: `${((active + 0.5) / data.length) * 100}%`,
                  transform: `translate(${active / data.length > 0.66 ? '-100%' : active / data.length < 0.33 ? '0' : '-50%'}, -100%)`
                }}
                role="status"
              >
                <p className="text-slate-500 mb-1">{data[active].title || data[active].label}</p>
                {series.map((s) => (
                  <p key={s.key} className="flex items-center gap-2">
                    <span className="w-3 h-0.5 rounded" style={{ background: s.color }} aria-hidden="true" />
                    <strong className="text-slate-900 tabular-nums">{formatValue(data[active].values[s.key] || 0)}</strong>
                    <span className="text-slate-500">{s.label}</span>
                  </p>
                ))}
                {data[active].note && <p className="text-slate-500 mt-1">{data[active].note}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </figure>
  );
}
