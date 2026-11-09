import { useState } from 'react';

/** Barras horizontales ordenadas (una serie): etiqueta · barra (≤14px, extremo redondeado) · valor en la punta. */
export function BarrasHorizontales({ datos, color = 'var(--viz-om)', maxItems = 8, onSelect, seleccionado }: {
  datos: { id: string; label: string; valor: number }[];
  color?: string;
  maxItems?: number;
  onSelect?: (id: string) => void;
  seleccionado?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const orden = [...datos].filter((d) => d.valor > 0).sort((a, b) => b.valor - a.valor);
  const top = orden.slice(0, maxItems);
  const resto = orden.slice(maxItems).reduce((a, d) => a + d.valor, 0);
  const filas = resto > 0 ? [...top, { id: '__otros', label: 'Otras áreas', valor: resto }] : top;
  const max = Math.max(1, ...filas.map((f) => f.valor));
  const total = orden.reduce((a, d) => a + d.valor, 0);

  if (!filas.length) return <p className="py-8 text-center text-sm text-zinc-500">Sin datos para los filtros seleccionados.</p>;

  return (
    <ul className="space-y-1.5">
      {filas.map((f) => {
        const activo = seleccionado === f.id;
        const atenuado = (hover && hover !== f.id) || (seleccionado && !activo);
        return (
          <li key={f.id}>
            <button
              type="button"
              disabled={!onSelect || f.id === '__otros'}
              onClick={() => onSelect?.(f.id)}
              onMouseEnter={() => setHover(f.id)}
              onMouseLeave={() => setHover(null)}
              title={`${f.label}: ${f.valor} (${Math.round((f.valor / total) * 100)}%)`}
              className="grid w-full grid-cols-[minmax(90px,38%)_1fr_2.5rem] items-center gap-2 rounded-md px-1 py-1 text-left text-xs transition hover:bg-zinc-50 disabled:cursor-default"
              style={{ opacity: atenuado ? 0.5 : 1 }}
            >
              <span className={'truncate ' + (activo ? 'font-bold text-zinc-900' : 'text-zinc-600')}>{f.label}</span>
              <span className="h-3.5 w-full">
                <span className="block h-full rounded-r-[4px]" style={{ width: `${Math.max(2, (f.valor / max) * 100)}%`, background: f.id === '__otros' ? 'var(--viz-axis)' : color, transition: 'width .4s ease' }} />
              </span>
              <b className="text-right text-zinc-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{f.valor}</b>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
