import { useEffect, useRef, useState } from 'react';
import { api } from './api';

let configCache = null;

/**
 * Kirish usullari: Telegram bot yoqilganmi, SMS ishlaydimi (bir marta yuklanadi)
 */
export function useLoginMethods() {
  const [config, setConfig] = useState(configCache);
  useEffect(() => {
    if (configCache) return undefined;
    let active = true;
    api('/auth/telegram/config')
      .then(({ data }) => {
        configCache = data;
        if (active) setConfig(data);
      })
      .catch(() => active && setConfig({ enabled: false, sms_enabled: true }));
    return () => {
      active = false;
    };
  }, []);
  return config;
}

/**
 * Faol bo'lganda fn ni har intervalMs da chaqirish (fn true qaytarsa to'xtaydi)
 */
export function usePolling(fn, intervalMs, active, maxMs = 10 * 60 * 1000) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (!active) return undefined;
    let stopped = false;
    const startedAt = Date.now();
    let timer;
    const run = async () => {
      if (stopped || Date.now() - startedAt > maxMs) return;
      let done = false;
      try {
        done = await fnRef.current();
      } catch {
        // tarmoq xatosi bo'lsa keyingi urinishda qayta so'raladi
      }
      if (!done && !stopped) timer = setTimeout(run, intervalMs);
    };
    timer = setTimeout(run, intervalMs);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [active, intervalMs, maxMs]);
}

export const TELEGRAM_BUTTON = 'btn w-full min-h-12 font-bold text-white bg-[#229ED9] hover:bg-[#1c8cc2] shadow-md shadow-sky-500/20';
