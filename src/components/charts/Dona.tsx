import { useState, type ReactNode } from 'react';
import { useListo } from './useAnimacion';

export interface SegmentoDona {
  key: string;
  label: string;
  valor: number;
  color: string;
  icon?: ReactNode;
}

const R = 70;
const C = 2 * Math.PI * R;

/**
 * Gráfico de torta tipo dona: arcos que se dibujan al entrar, total (o el segmento bajo el cursor) en el centro
 * y leyenda clicable con cantidad y porcentaje (nunca solo color: cada fila lleva texto).
 */
export function Dona({ segmentos, centroLabel, centroValor, onSelect, seleccionado, tamano = 190, aria, vertical = false }: {
  segmentos: SegmentoDona[];
  centroLabel: string;
  centroValor?: string | number;
  onSelect?: (k: string) => void;
  seleccionado?: string;
  tamano?: number;
  aria?: string;
  /** Dona arriba y leyenda abajo (columnas angostas). */
  vertical?: boolean;
}) {
  const listo = useListo();
  const [hover, setHover] = useState<string | null>(null);
  const total = segmentos.reduce((a, s) => a + s.valor, 0);
  const activo = hover ?? seleccionado ?? null;
  const seg = activo ? segmentos.find((s) => s.key === activo) : null;
  let acum = 0;

  return (
    <div className={'flex w-full min-w-0 flex-col items-center gap-4 ' + (vertical ? '' : 'sm:flex-row sm:items-center lg:flex-col xl:flex-row')}>
      <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
        <svg viewBox="0 0 200 200" width={tamano} height={tamano} role="img" aria-label={aria ?? centroLabel}>
          <circle cx={100} cy={100} r={R} fill="none" stroke="var(--viz-grid)" strokeWidth={24} />
          {total > 0 &&
            segmentos
              .filter((s) => s.valor > 0)
              .map((s) => {
                const largo = (s.valor / total) * C;
                const hueco = segmentos.filter((x) => x.valor > 0).length > 1 ? 3 : 0;
                const dash = Math.max(0, largo - hueco);
                const off = -acum;
                acum += largo;
                const sel = activo === s.key;
                return (
                  <circle
                    key={s.key}
                    className="viz-arco"
                    cx={100}
                    cy={100}
                    r={R}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={sel ? 30 : 24}
                    strokeDasharray={`${listo ? dash : 0} ${C}`}
                    strokeDashoffset={off}
                    transform="rotate(-90 100 100)"
                    opacity={activo && !sel ? 0.35 : 1}
                    style={{ cursor: onSelect ? 'pointer' : undefined }}
                    onMouseEnter={() => setHover(s.key)}
                    onMouseLeave={() => setHover(null)}
                    onClick={onSelect ? () => onSelect(s.key) : undefined}
                  />
                );
              })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-[family-name:var(--font-display)] text-4xl font-bold leading-none text-zinc-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {seg ? seg.valor : centroValor ?? total}
          </span>
          <span className="mt-1 max-w-[7rem] truncate text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{seg ? seg.label : centroLabel}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1">
        {segmentos.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => onSelect?.(s.key)}
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover(null)}
              className={'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-zinc-50 ' + (seleccionado === s.key ? 'bg-zinc-50 ring-1 ring-zinc-300' : '')}
            >
              {s.icon ?? <span className="chip-dot" style={{ background: s.color }} />}
              <span className="min-w-0 flex-1 truncate text-zinc-700">{s.label}</span>
              <b className="text-zinc-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{s.valor}</b>
              <span className="w-10 text-right text-xs text-zinc-500">{total ? Math.round((s.valor / total) * 100) : 0}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
