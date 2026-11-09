import { AlertCircle, CheckCircle2, Clock3 } from 'lucide-react';
import type { ReactNode } from 'react';

export interface SegmentoEstado {
  key: string;
  label: string;
  valor: number;
  color: string;
  icon: ReactNode;
}

export const iconosEstado = {
  no_tratada: <AlertCircle className="h-3.5 w-3.5" style={{ color: 'var(--viz-critical)' }} />,
  en_seguimiento: <Clock3 className="h-3.5 w-3.5" style={{ color: 'var(--viz-warning)' }} />,
  tratada: <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--viz-good)' }} />,
};

/** Barra 100% de estados (colores de estado reservados + ícono + etiqueta: nunca solo color). */
export function BarraEstado({ segmentos, onSelect, seleccionado }: { segmentos: SegmentoEstado[]; onSelect?: (k: string) => void; seleccionado?: string }) {
  const total = segmentos.reduce((a, s) => a + s.valor, 0);
  const visibles = segmentos.filter((s) => s.valor > 0);
  return (
    <div>
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-[4px] bg-zinc-100">
        {total > 0 &&
          visibles.map((s) => (
            <div
              key={s.key}
              title={`${s.label}: ${s.valor}`}
              style={{ width: `${(s.valor / total) * 100}%`, background: s.color, opacity: seleccionado && seleccionado !== s.key ? 0.35 : 1, transition: 'width .4s ease, opacity .2s' }}
            />
          ))}
      </div>
      <ul className="mt-3 space-y-1">
        {segmentos.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => onSelect?.(s.key)}
              className={'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-zinc-50 ' + (seleccionado === s.key ? 'bg-zinc-50 ring-1 ring-zinc-300' : '')}
            >
              {s.icon}
              <span className="flex-1 text-zinc-700">{s.label}</span>
              <b className="text-zinc-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{s.valor}</b>
              <span className="w-10 text-right text-xs text-zinc-500">{total ? Math.round((s.valor / total) * 100) : 0}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
