import { useEffect, useRef, useState } from 'react';

export const sinMovimiento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Cuenta desde el valor anterior hasta el objetivo (ease-out). Respeta prefers-reduced-motion. */
export function useContar(objetivo: number, ms = 900) {
  const [v, setV] = useState(sinMovimiento() ? objetivo : 0);
  const previo = useRef(sinMovimiento() ? objetivo : 0);
  useEffect(() => {
    if (sinMovimiento()) {
      setV(objetivo);
      previo.current = objetivo;
      return;
    }
    const ini = previo.current;
    const t0 = performance.now();
    let raf = 0;
    const paso = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(ini + (objetivo - ini) * e));
      if (p < 1) raf = requestAnimationFrame(paso);
      else previo.current = objetivo;
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [objetivo, ms]);
  return v;
}

/** true un instante después de montar: dispara las transiciones de entrada (arcos, barras). */
export function useListo() {
  const [listo, setListo] = useState(sinMovimiento());
  useEffect(() => {
    const id = requestAnimationFrame(() => setListo(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return listo;
}
