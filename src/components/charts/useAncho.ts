import { useEffect, useRef, useState } from 'react';

/**
 * Mide el ancho real del contenedor para dibujar SVG a escala 1:1 (textos nítidos).
 * El SVG se dibuja con viewBox + width:100%, así que siempre llena el contenedor aunque la ventana
 * cambie de tamaño o de pantalla antes de que se actualice la medida.
 */
export function useAncho<T extends HTMLElement>(inicial = 600) {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setAncho(Math.max(160, Math.floor(el.getBoundingClientRect().width)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    window.addEventListener('resize', medir);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', medir);
    };
  }, []);
  return { ref, ancho };
}

export function maxLimpio(v: number): number {
  if (v <= 4) return 4;
  const pasos = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  return pasos.find((p) => p >= v) ?? Math.ceil(v / 1000) * 1000;
}
