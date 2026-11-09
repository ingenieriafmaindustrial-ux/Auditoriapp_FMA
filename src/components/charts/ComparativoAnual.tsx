import { useState } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Leyenda } from './Leyenda';

const RAMPA = ['var(--viz-y1)', 'var(--viz-y2)', 'var(--viz-y3)', 'var(--viz-y4)'];

export interface FilaComparativa {
  id: string;
  label: string;
  sub?: string;
  valores: Record<number, number>;
}

/**
 * Comparativo año a año por área: barras horizontales agrupadas (rampa ordinal azul, el año más reciente es el más intenso)
 * + variación contra el año anterior con ícono (no depende solo del color).
 */
export function ComparativoAnual({ filas, anios, maxFilas = 8 }: { filas: FilaComparativa[]; anios: number[]; maxFilas?: number }) {
  const [todas, setTodas] = useState(false);
  const colores = RAMPA.slice(RAMPA.length - anios.length);
  const ultimo = anios[anios.length - 1];
  const previo = anios[anios.length - 2];
  const orden = [...filas]
    .filter((f) => anios.some((y) => (f.valores[y] ?? 0) > 0))
    .sort((a, b) => (b.valores[ultimo] ?? 0) - (a.valores[ultimo] ?? 0) || b.label.localeCompare(a.label));
  const visibles = todas ? orden : orden.slice(0, maxFilas);
  const max = Math.max(1, ...orden.flatMap((f) => anios.map((y) => f.valores[y] ?? 0)));

  if (!orden.length) return <p className="py-10 text-center text-sm text-zinc-500">Sin hallazgos registrados para comparar.</p>;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Leyenda items={anios.map((y, i) => ({ label: String(y), color: colores[i] }))} />
        {previo && <span className="text-xs text-zinc-500">Variación {ultimo} vs {previo}</span>}
      </div>
      <ul className="divide-y divide-zinc-100">
        {visibles.map((f) => {
          const act = f.valores[ultimo] ?? 0;
          const ant = previo ? f.valores[previo] ?? 0 : 0;
          const delta = act - ant;
          return (
            <li key={f.id} className="grid grid-cols-[minmax(110px,30%)_1fr_4.5rem] items-center gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-800" title={f.label}>{f.label}</p>
                {f.sub && <p className="truncate text-[11px] text-zinc-500">{f.sub}</p>}
              </div>
              <div className="space-y-[2px]">
                {anios.map((y, i) => {
                  const v = f.valores[y] ?? 0;
                  return (
                    <div key={y} className="flex items-center gap-2" title={`${f.label} · ${y}: ${v}`}>
                      <span className="viz-fila h-2 rounded-r-[4px]" style={{ width: `${v ? Math.max(1.5, (v / max) * 88) : 0}%`, background: colores[i], animationDelay: `${i * 80}ms` }} />
                      <span className="text-[11px] text-zinc-500" style={{ fontVariantNumeric: 'tabular-nums' }}>{v || ''}</span>
                    </div>
                  );
                })}
              </div>
              {previo ? (
                <span className="flex items-center justify-end gap-1 text-xs font-semibold text-zinc-700" title={delta > 0 ? 'Aumentó' : delta < 0 ? 'Disminuyó' : 'Sin cambio'}>
                  {delta > 0 ? <TrendingUp className="h-4 w-4" style={{ color: 'var(--viz-critical)' }} /> : delta < 0 ? <TrendingDown className="h-4 w-4" style={{ color: 'var(--viz-good)' }} /> : <Minus className="h-4 w-4 text-zinc-400" />}
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              ) : (
                <span />
              )}
            </li>
          );
        })}
      </ul>
      {orden.length > maxFilas && (
        <button type="button" onClick={() => setTodas((v) => !v)} className="mt-2 text-xs font-semibold text-zinc-600 underline-offset-4 hover:underline">
          {todas ? 'Ver menos' : `Ver las ${orden.length} áreas`}
        </button>
      )}
    </div>
  );
}
