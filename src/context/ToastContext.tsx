import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';

type Tipo = 'ok' | 'error';
interface Toast {
  id: number;
  tipo: Tipo;
  mensaje: string;
}

const ToastContext = createContext<(mensaje: string, tipo?: Tipo) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const cerrar = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));
  const notify = useCallback((mensaje: string, tipo: Tipo = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tipo, mensaje }]);
    setTimeout(() => cerrar(id), tipo === 'error' ? 7000 : 3500);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-lg px-4 py-3 text-sm shadow-lg',
              t.tipo === 'ok' ? 'bg-panel text-white' : 'bg-red-600 text-white',
            )}
          >
            {t.tipo === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="flex-1">{t.mensaje}</span>
            <button onClick={() => cerrar(t.id)} aria-label="Cerrar" className="opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
