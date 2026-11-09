import { useState } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

export interface ConteoTipo {
  nc: number;
  om: number;
}
export interface FilaEvolucion {
  id: string;
  label: string;
  sub?: string;
  porAnio: Record<number, ConteoTipo>;
}

const totalDe = (c: ConteoTipo | undefined, tipo: '' | 'NC' | 'OM') => (!c ? 0 : tipo === 'NC' ? c.nc : tipo === 'OM' ? c.om : c.nc + c.om);

function Variacion({ actual, previo, compacta = false }: { actual: number; previo: number; compacta?: boolean }) {
  const delta = actual - previo;
  const pct = previo ? Math.round((delta / previo) * 100) : null;
  const icono = delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : delta < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />;
  const color = delta > 0 ? 'var(--viz-critical)' : delta < 0 ? 'var(--viz-good)' : 'var(--viz-muted)';
  const texto = delta === 0 ? 'Sin cambio' : `${delta > 0 ? '+' : ''}${delta}${pct !== null && !compacta ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}`;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color }} title={delta > 0 ? 'Más hallazgos que el año anterior' : delta < 0 ? 'Menos hallazgos que el año anterior' : 'Igual que el año anterior'}>
      {icono} {texto}
    </span>
  );
}

/**
 * Avance anual: (1) resumen por año con NC y OM separados y la variación contra el año anterior;
 * (2) matriz área × año, donde cada celda muestra el total y su desglose NC/OM (intensidad = cantidad).
 */
export function EvolucionAnual({ anios, resumen, filas, tipo, maxFilas = 8 }: { anios: number[]; resumen: Record<number, ConteoTipo>; filas: FilaEvolucion[]; tipo: '' | 'NC' | 'OM'; maxFilas?: number }) {
  const [todas, setTodas] = useState(false);
  const ultimo = anios[anios.length - 1];
  const previo = anios[anios.length - 2];
  const orden = filas
    .filter((f) => anios.some((y) => totalDe(f.porAnio[y], tipo) > 0))
    .sort((a, b) => totalDe(b.porAnio[ultimo], tipo) - totalDe(a.porAnio[ultimo], tipo) || a.label.localeCompare(b.label));
  const visibles = todas ? orden : orden.slice(0, maxFilas);
  const maxCelda = Math.max(1, ...orden.flatMap((f) => anios.map((y) => totalDe(f.porAnio[y], tipo))));
  const maxAnio = Math.max(1, ...anios.map((y) => resumen[y].nc + resumen[y].om));
  const que = tipo === 'NC' ? 'no conformidades' : tipo === 'OM' ? 'oportunidades de mejora' : 'hallazgos (NC + OM)';

  return (
    <div className="space-y-5">
      <p className="text-sm text-zinc-500">Cantidad de {que} detectados cada año. Una baja respecto del año anterior se marca en verde.</p>

      {/* Resumen por año */}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${anios.length}, minmax(0, 1fr))` }}>
        {anios.map((y, i) => {
          const r = resumen[y];
          const tot = totalDe(r, tipo);
          const totAnt = i > 0 ? totalDe(resumen[anios[i - 1]], tipo) : null;
          return (
            <div key={y} className={'viz-entra rounded-xl border p-4 ' + (y === ultimo ? 'border-brand/70 bg-zinc-50' : 'border-zinc-200')} style={{ animationDelay: `${i * 90}ms` }}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{y}</span>
                {totAnt !== null && <Variacion actual={tot} previo={totAnt} />}
              </div>
              <p className="mt-1 font-[family-name:var(--font-display)] text-4xl font-bold leading-none text-zinc-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{tot}</p>
              <div className="mt-3 flex h-2 gap-[2px] overflow-hidden rounded-full bg-zinc-100" style={{ width: `${Math.max(8, ((r.nc + r.om) / maxAnio) * 100)}%` }}>
                {tipo !== 'OM' && r.nc > 0 && <span key={'nc' + r.nc} className="viz-fila h-full" style={{ width: `${(r.nc / (r.nc + r.om || 1)) * 100}%`, background: 'var(--viz-nc)' }} />}
                {tipo !== 'NC' && r.om > 0 && <span key={'om' + r.om} className="viz-fila h-full" style={{ width: `${(r.om / (r.nc + r.om || 1)) * 100}%`, background: 'var(--viz-om)' }} />}
              </div>
              <p className="mt-2 flex gap-3 text-xs text-zinc-600">
                {tipo !== 'OM' && <span className="flex items-center gap-1"><span className="chip-dot" style={{ background: 'var(--viz-nc)' }} /> {r.nc} NC</span>}
                {tipo !== 'NC' && <span className="flex items-center gap-1"><span className="chip-dot" style={{ background: 'var(--viz-om)' }} /> {r.om} OM</span>}
              </p>
            </div>
          );
        })}
      </div>

      {/* Matriz área × año */}
      {orden.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">Sin hallazgos registrados para comparar.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-separate border-spacing-y-1 text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-2 py-1 text-left font-semibold">Área</th>
                {anios.map((y) => (
                  <th key={y} className="px-2 py-1 text-center font-semibold">{y}</th>
                ))}
                {previo && <th className="px-2 py-1 text-right font-semibold">{ultimo} vs {previo}</th>}
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.id}>
                  <td className="max-w-[14rem] px-2 py-1.5">
                    <p className="truncate font-medium text-zinc-800" title={f.label}>{f.label}</p>
                    {f.sub && <p className="truncate text-[11px] text-zinc-500">{f.sub}</p>}
                  </td>
                  {anios.map((y) => {
                    const c = f.porAnio[y] ?? { nc: 0, om: 0 };
                    const t = totalDe(c, tipo);
                    const intensidad = t ? 10 + Math.round((t / maxCelda) * 40) : 0;
                    return (
                      <td key={y} className="px-1 py-0.5">
                        <div className="rounded-lg px-2 py-1.5 text-center" style={{ background: t ? `color-mix(in srgb, var(--viz-om) ${intensidad}%, transparent)` : 'transparent' }} title={`${f.label} · ${y}: ${c.nc} NC, ${c.om} OM`}>
                          <b className={'block text-base leading-tight ' + (t ? 'text-zinc-900' : 'text-zinc-400')} style={{ fontVariantNumeric: 'tabular-nums' }}>{t || '—'}</b>
                          {t > 0 && !tipo && <span className="block text-[10px] text-zinc-600">{c.nc} NC · {c.om} OM</span>}
                        </div>
                      </td>
                    );
                  })}
                  {previo && (
                    <td className="px-2 py-1.5 text-right">
                      <Variacion actual={totalDe(f.porAnio[ultimo], tipo)} previo={totalDe(f.porAnio[previo], tipo)} compacta />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {orden.length > maxFilas && (
            <button type="button" onClick={() => setTodas((v) => !v)} className="mt-2 cursor-pointer text-xs font-semibold text-zinc-600 underline-offset-4 hover:underline">
              {todas ? 'Ver menos' : `Ver las ${orden.length} áreas`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
