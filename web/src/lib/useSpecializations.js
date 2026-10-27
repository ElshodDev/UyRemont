import { useEffect, useState } from 'react';
import { api } from './api';

let cache = null;
let inflight = null;

const load = () => {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api('/masters/specializations')
      .then(({ data }) => {
        cache = data;
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
};

/**
 * Mutaxassisliklar katalogi (bir marta yuklanib, keshlanadi)
 */
export function useSpecializations() {
  const [specializations, setSpecializations] = useState(cache || []);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    load()
      .then((data) => active && setSpecializations(data))
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, []);

  return { specializations, error };
}
