import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, CalendarClock, CalendarX, ClipboardCheck, MessageSquareWarning } from 'lucide-react';
import { usePendientes, type Pendiente } from '../../hooks/usePendientes';
import { cn } from '../../lib/utils';

const CLAVE = 'fma-recordatorios-vistos';

function leerVistos(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? '[]') as string[];
  } catch {
    return [];
  }
}

const icono = (t: Pendiente['tipo']) =>
  t === 'revision' ? <ClipboardCheck className="h-4 w-4 text-brand" />
  : t === 'observacion' ? <MessageSquareWarning className="h-4 w-4 text-sky-400" />
  : t === 'agenda' ? <CalendarClock className="h-4 w-4 text-brand" />
  : t === 'atrasada' ? <CalendarX className="h-4 w-4 text-red-400" />
  : <AlertTriangle className="h-4 w-4 text-red-400" />;

/** Campana de recordatorios del encabezado: parpadea mientras haya pendientes nuevos no vistos. */
export function Recordatorios() {
  const { items } = usePendientes();
  const [abierto, setAbierto] = useState(false);
  const [vistos, setVistos] = useState<string[]>(leerVistos);
  const ref = useRef<HTMLDivElement>(null);
  const nuevos = items.filter((i) => !vistos.includes(i.id));
  const urgentes = items.filter((i) => i.tipo !== 'vencido').length;

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAbierto(false);
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [abierto]);

  function abrir() {
    setAbierto((v) => !v);
    const ids = items.map((i) => i.id);
    setVistos(ids);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(ids));
    } catch {
      /* sin almacenamiento: volverá a parpadear en la próxima visita */
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={abrir}
        aria-label={`Recordatorios: ${items.length}`}
        title="Recordatorios"
        className={cn('campana', items.length ? 'campana--pendientes' : 'campana--al-dia', nuevos.length > 0 && 'campana--nuevos')}
      >
        <span className="campana-icono"><Bell className="h-5 w-5" /></span>
        <span className="campana-texto">{items.length ? 'Alertas' : 'Al día'}</span>
        {items.length > 0 && <span className={cn('campana-badge', urgentes ? 'bg-red-600 text-white' : 'bg-panel text-brand')}>{items.length}</span>}
      </button>

      {abierto && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-white/10 bg-[#0d1628] text-sm text-zinc-100 shadow-2xl">
          <p className="border-b border-white/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">Recordatorios</p>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-zinc-400">Sin pendientes. Todo al día.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((i) => (
                <li key={i.id}>
                  <Link to={i.to} onClick={() => setAbierto(false)} className="flex gap-3 px-4 py-3 hover:bg-white/5">
                    <span className="mt-0.5">{icono(i.tipo)}</span>
                    <span className="min-w-0">
                      <b className="block font-semibold text-white">{i.titulo}</b>
                      <span className="line-clamp-2 text-xs text-zinc-400">{i.detalle}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
