// Instalación de la app (PWA): captura el aviso del navegador y lo expone a la interfaz.
// Se importa en main.tsx para no perder el evento si llega antes de que React monte.
import { useSyncExternalStore } from 'react';

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let aviso: EventoInstalar | null = null;
let instalada = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // se muestra con nuestro botón
    aviso = e as EventoInstalar;
    avisar();
  });
  window.addEventListener('appinstalled', () => {
    aviso = null;
    instalada = true;
    avisar();
  });
  // Solo en producción: en desarrollo el service worker interfiere con la recarga de Vite
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('[pwa]', err)));
  }
}

const esIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

export type EstadoInstalacion = 'instalada' | 'disponible' | 'ios' | 'no_disponible';
const estado = (): EstadoInstalacion => (instalada ? 'instalada' : aviso ? 'disponible' : esIOS() ? 'ios' : 'no_disponible');

export function useInstalacion() {
  const e = useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    estado,
    () => 'no_disponible' as EstadoInstalacion,
  );
  const instalar = async () => {
    if (!aviso) return false;
    await aviso.prompt();
    const { outcome } = await aviso.userChoice;
    aviso = null;
    avisar();
    return outcome === 'accepted';
  };
  return { estado: e, instalar };
}
