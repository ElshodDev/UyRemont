import React, { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import Modal from './Modal';
import { calculatorServices, repairLevels } from '../data/catalog';
import { t } from '../i18n';

/**
 * Smart smeta kalkulyatori: taxminiy ish va material narxini hisoblaydi
 */
export default function CalculatorModal({ onClose, onPickService }) {
  const [form, setForm] = useState({ serviceType: 'santexnik', areaOrUnits: 30, repairLevel: 'standard' });

  const service = calculatorServices.find((s) => s.id === form.serviceType) || calculatorServices[0];

  const cost = useMemo(() => {
    const level = repairLevels.find((l) => l.id === form.repairLevel) || repairLevels[1];
    const workCost = Math.round(form.areaOrUnits * service.rate * level.multiplier);
    const materialCost = Math.round(workCost * 1.3); // Materiallar taxminan 1.3 barobar
    return { workCost, materialCost, totalCost: workCost + materialCost };
  }, [form, service]);

  const money = (n) => t('{sum} so\'m', { sum: n.toLocaleString('ru-RU') });

  return (
    <Modal onClose={onClose} size="lg">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 bg-amber-100 text-amber-700 rounded-2xl">
          <Calculator className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900">{t('Smart Smeta Kalkulyatori')}</h3>
          <p className="text-xs text-slate-500">{t('Ta\'mir va xizmat narxini oldindan hisoblang')}</p>
        </div>
      </div>

      <div className="space-y-4 my-5 text-xs sm:text-sm">
        <div>
          <label className="font-bold text-slate-700 block mb-1.5">{t('Xizmat turini tanlang:')}</label>
          <select
            className="input font-medium focus:border-amber-500 focus:ring-amber-500/20"
            aria-label={t('Xizmat turi')}
            value={form.serviceType}
            onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
          >
            {calculatorServices.map((s) => <option key={s.id} value={s.id}>{t(s.label)}</option>)}
          </select>
        </div>

        <div>
          <div className="flex justify-between font-bold text-slate-700 mb-1.5">
            <span>{t('Hajmi:')}</span>
            <span className="text-amber-700 font-extrabold">{form.areaOrUnits} {t(service.unit)}</span>
          </div>
          <input
            type="range"
            min="5"
            max="200"
            step="5"
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
            value={form.areaOrUnits}
            onChange={(e) => setForm({ ...form, areaOrUnits: Number(e.target.value) })}
          />
        </div>

        <div>
          <label className="font-bold text-slate-700 block mb-1.5">{t('Ta\'mir darajasi:')}</label>
          <div className="grid grid-cols-3 gap-2">
            {repairLevels.map((lvl) => (
              <button
                key={lvl.id}
                type="button"
                onClick={() => setForm({ ...form, repairLevel: lvl.id })}
                className={`p-2.5 rounded-xl border text-center transition ${
                  form.repairLevel === lvl.id
                    ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-bold">{t(lvl.label)}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{t(lvl.desc)}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-500/20 border border-amber-300 rounded-2xl space-y-2 mt-4">
          <div className="flex justify-between text-xs text-slate-600">
            <span>{t('Usta xizmat haqi:')}</span>
            <span className="font-bold text-slate-800">{money(cost.workCost)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-600">
            <span>{t('Qurilish materiallari (taxminiy):')}</span>
            <span className="font-bold text-slate-800">{money(cost.materialCost)}</span>
          </div>
          <div className="pt-2 border-t border-amber-200 flex justify-between items-center gap-2">
            <span className="font-bold text-slate-900 text-sm">{t('Jami kutilayotgan byudjet:')}</span>
            <span className="text-base sm:text-lg font-black text-amber-700">~{money(cost.totalCost)}</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => onPickService(service)}
        className="btn btn-dark w-full font-bold min-h-12"
      >
        {t('Ushbu xizmat bo\'yicha usta tanlash')}
      </button>
    </Modal>
  );
}
