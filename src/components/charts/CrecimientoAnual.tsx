import { useState } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { maxLimpio, useAncho } from './useAncho';
import { Segmentado } from '../shared/Filtros';

export interface MesComparado {
  label: string;
  /** null = mes aún no transcurrido en el año en curso (la línea se corta). */
  actual: number | null;
  previo: number;
}
export interface IndicadorComparado {
  label: string;
  actual: number;
  previo: number;
  /** Cómo leer un aumento: 'malo' (rojo), 'bueno' (verde) o 'neutro'. */
  sentido?: 'malo' | 'bueno' | 'neutro';
  decimales?: number;
}
export interface AreaComparada {
  id: string;
  label: string;
  sub?: string;
  actual: number;
  previo: number;
}

const C_ACT = 'var(--viz-y3)';
const C_PREV = 'var(--viz-muted)';

function Delta({ actual, previo, sentido = 'neutro', decimales = 0 }: { actual: number; previo: number; sentido?: IndicadorComparado['sentido']; decimales?: number }) {
  const d = actual - previo;
  const pct = previo ? Math.round((d / previo) * 100) : null;
  const sube = d > 0.0001;
  const baja = d < -0.0001;
  const color = !sube && !baja ? 'var(--viz-muted)' : sentido === 'neutro' ? 'var(--color-zinc-700)' : (sube === (sentido === 'malo')) ? 'var(--viz-critical)' : 'var(--viz-good)';
  const Icono = sube ? TrendingUp : baja ? TrendingDown : Minus;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color }}>
      <Icono className="h-3.5 w-3.5" />
      {!sube && !baja ? 'Igual' : `${sube ? '+' : ''}${d.toFixed(decimales)}${pct !== null ? ` · ${pct > 0 ? '+' : ''}${pct}%` : ''}`}
    </span>
  );
}

/**
 * Comparativo año actual vs año anterior:
 * indicadores con variación (a la misma fecha, para comparar parejo) + gráfico Acumulado (líneas) o Por mes (columnas pareadas).
 */
export function CrecimientoAnual({ anio, previo, meses, indicadores, areas = [], nota, onArea }: { anio: number; previo: number; meses: MesComparado[]; indicadores: IndicadorComparado[]; areas?: AreaComparada[]; nota?: string; onArea?: (id: string) => void }) {
  const [modo, setModo] = useState<'acum' | 'mes' | 'area'>('acum');
  const [todas, setTodas] = useState(false);
  const { ref, ancho } = useAncho<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  // Series según modo
  let sa = 0;
  let sp = 0;
  const serie = meses.map((m) => {
    sp += m.previo;
    if (m.actual !== null) sa += m.actual;
    return modo === 'acum' ? { a: m.actual === null ? null : sa, p: sp } : { a: m.actual, p: m.previo };
  });

  const alto = 230;
  const mg = { t: 22, r: 14, b: 26, l: 32 };
  const w = ancho - mg.l - mg.r;
  const h = alto - mg.t - mg.b;
  const max = maxLimpio(Math.max(1, ...serie.flatMap((s) => [s.a ?? 0, s.p])));
  const banda = meses.length ? w / meses.length : w;
  const x = (i: number) => banda * i + banda / 2;
  const y = (v: number) => h - (v / max) * h;
  const ticks = [0, max / 2, max];

  const linea = (pts: [number, number][]) => pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const ptsP = serie.map((s, i) => [x(i), y(s.p)] as [number, number]);
  const ptsA = serie.flatMap((s, i) => (s.a === null ? [] : [[x(i), y(s.a)] as [number, number]]));
  const areaA = ptsA.length ? `${linea(ptsA)} L${ptsA[ptsA.length - 1][0].toFixed(1)},${h} L${ptsA[0][0].toFixed(1)},${h} Z` : '';
  const barW = Math.max(5, Math.min(18, banda * 0.3));

  return (
    <div className="space-y-4">
      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {indicadores.map((k, i) => (
          <div key={k.label} className="viz-entra rounded-xl border border-zinc-200 p-3" style={{ animationDelay: `${i * 70}ms` }}>
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{k.label}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-[family-name:var(--font-display)] text-3xl font-bold leading-none text-zinc-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{k.actual.toFixed(k.decimales ?? 0)}</span>
              <span className="text-xs text-zinc-500" style={{ fontVariantNumeric: 'tabular-nums' }}>vs {k.previo.toFixed(k.decimales ?? 0)}</span>
            </div>
            <div className="mt-1.5"><Delta {...k} /></div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
          <li className="flex items-center gap-1.5"><span className="inline-block h-[3px] w-5 rounded" style={{ background: C_ACT }} /> <b className="text-zinc-900">{anio}</b></li>
          <li className="flex items-center gap-1.5"><span className="inline-block h-0 w-5 border-t-2 border-dashed" style={{ borderColor: C_PREV }} /> {previo}</li>
        </ul>
        <Segmentado etiqueta="Vista del comparativo" valor={modo} onChange={setModo} opciones={[{ v: 'acum', label: 'Acumulado' }, { v: 'mes', label: 'Por mes' }, { v: 'area', label: 'Por área' }]} />
      </div>

      {modo === 'area' && <TablaAreas anio={anio} previo={previo} areas={areas} todas={todas} setTodas={setTodas} onArea={onArea} />}
      <div ref={ref} className={'relative w-full min-w-0 ' + (modo === 'area' ? 'hidden' : '')} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${ancho} ${alto}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={`Hallazgos ${anio} comparados con ${previo}, ${modo === 'acum' ? 'acumulado' : 'por mes'}`}>
          <g transform={`translate(${mg.l},${mg.t})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={w} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} strokeWidth={1} />
                <text x={-8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--viz-muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>{Number.isInteger(t) ? t : t.toFixed(1)}</text>
              </g>
            ))}
            {hover !== null && <rect x={banda * hover} y={0} width={banda} height={h} fill="var(--viz-grid)" opacity={0.5} />}
            {meses.map((m, i) => (
              <text key={m.label} x={x(i)} y={h + 17} textAnchor="middle" fontSize={11} fill={hover === i ? 'var(--color-zinc-900)' : 'var(--viz-muted)'} fontWeight={hover === i ? 700 : 400}>{m.label}</text>
            ))}

            {modo === 'acum' ? (
              <g key="acum">
                {areaA && <path d={areaA} fill={C_ACT} opacity={0.1} />}
                <path d={linea(ptsP)} fill="none" stroke={C_PREV} strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" />
                {ptsA.length > 0 && <path d={linea(ptsA)} fill="none" stroke={C_ACT} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />}
                {ptsP.map(([px, py], i) => <circle key={'p' + i} cx={px} cy={py} r={hover === i ? 4 : 2.5} fill="var(--color-surface)" stroke={C_PREV} strokeWidth={1.5} />)}
                {ptsA.map(([px, py], i) => <circle key={'a' + i} cx={px} cy={py} r={hover === i ? 5 : 3.5} fill={C_ACT} stroke="var(--color-surface)" strokeWidth={1.5} />)}
                {/* Etiquetas finales */}
                {ptsP.length > 0 && <text x={ptsP[ptsP.length - 1][0]} y={ptsP[ptsP.length - 1][1] - 9} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--viz-muted)">{sp}</text>}
                {ptsA.length > 0 && <text x={ptsA[ptsA.length - 1][0]} y={ptsA[ptsA.length - 1][1] - 10} textAnchor="middle" fontSize={13} fontWeight={700} fill={C_ACT}>{sa}</text>}
              </g>
            ) : (
              <g key="mes">
                {serie.map((s, i) => (
                  <g key={i}>
                    {s.p > 0 && <rect className="viz-col" x={x(i) - barW - 1} y={y(s.p)} width={barW} height={h - y(s.p)} rx={3} fill={C_PREV} opacity={0.55} />}
                    {(s.a ?? 0) > 0 && <rect className="viz-col" x={x(i) + 1} y={y(s.a!)} width={barW} height={h - y(s.a!)} rx={3} fill={C_ACT} style={{ animationDelay: '80ms' }} />}
                    {(s.a ?? 0) > 0 && <text x={x(i) + 1 + barW / 2} y={y(s.a!) - 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--color-zinc-800)">{s.a}</text>}
                  </g>
                ))}
              </g>
            )}

            {meses.map((_, i) => (
              <rect key={'hit' + i} x={banda * i} y={0} width={banda} height={h + 22} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
            ))}
          </g>
        </svg>
        {hover !== null && (
          <div className="viz-tip" style={{ left: `${((mg.l + x(hover)) / ancho) * 100}%`, top: mg.t + Math.min(y(serie[hover].a ?? 0), y(serie[hover].p)) }}>
            <p className="mb-1 font-semibold">{meses[hover].label} · {modo === 'acum' ? 'acumulado' : 'del mes'}</p>
            <p className="flex justify-between gap-4"><span style={{ color: C_ACT }}>● {anio}</span><b>{serie[hover].a ?? '—'}</b></p>
            <p className="flex justify-between gap-4"><span className="text-zinc-500">● {previo}</span><b>{serie[hover].p}</b></p>
          </div>
        )}
      </div>
      {nota && <p className="text-xs text-zinc-500">{nota}</p>}
    </div>
  );
}

/** Vista por área: barras pareadas (año actual intenso, anterior gris) + variación con ícono. */
function TablaAreas({ anio, previo, areas, todas, setTodas, onArea, max: maxFilas = 10 }: { anio: number; previo: number; areas: AreaComparada[]; todas: boolean; setTodas: (v: boolean) => void; onArea?: (id: string) => void; max?: number }) {
  const orden = areas
    .filter((a) => a.actual + a.previo > 0)
    .sort((a, b) => b.actual - a.actual || b.previo - a.previo || a.label.localeCompare(b.label));
  if (!orden.length) return <p className="py-10 text-center text-sm text-zinc-500">Sin hallazgos en {anio} ni en {previo} para los filtros seleccionados.</p>;
  const visibles = todas ? orden : orden.slice(0, maxFilas);
  const max = Math.max(1, ...orden.flatMap((a) => [a.actual, a.previo]));
  const suben = orden.filter((a) => a.actual > a.previo).length;
  const bajan = orden.filter((a) => a.actual < a.previo).length;
  return (
    <div>
      <p className="mb-2 text-xs text-zinc-500">
        {orden.length} área(s) con hallazgos · <b style={{ color: 'var(--viz-critical)' }}>{suben} suben</b> · <b style={{ color: 'var(--viz-good)' }}>{bajan} bajan</b> · {orden.length - suben - bajan} sin cambio
      </p>
      <ul className="divide-y divide-zinc-100">
        {visibles.map((a) => {
          const d = a.actual - a.previo;
          const Icono = d > 0 ? TrendingUp : d < 0 ? TrendingDown : Minus;
          const color = d > 0 ? 'var(--viz-critical)' : d < 0 ? 'var(--viz-good)' : 'var(--viz-muted)';
          return (
            <li key={a.id}>
              <button
                type="button"
                disabled={!onArea}
                onClick={() => onArea?.(a.id)}
                className="grid w-full cursor-pointer grid-cols-[minmax(100px,32%)_1fr_4.5rem] items-center gap-3 rounded-md px-1 py-2 text-left transition-colors hover:bg-zinc-50 disabled:cursor-default"
                title={`${a.label}: ${anio} = ${a.actual} · ${previo} = ${a.previo}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-800">{a.label}</span>
                  {a.sub && <span className="block truncate text-[11px] text-zinc-500">{a.sub}</span>}
                </span>
                <span className="space-y-[3px]">
                  {[
                    { v: a.actual, c: C_ACT, o: 1 },
                    { v: a.previo, c: C_PREV, o: 0.55 },
                  ].map((b, i) => (
                    <span key={i} className="flex items-center gap-2">
                      <span className="viz-fila h-2.5 rounded-r-[4px]" style={{ width: `${b.v ? Math.max(1.5, (b.v / max) * 88) : 0}%`, background: b.c, opacity: b.o, animationDelay: `${i * 80}ms` }} />
                      <span className={'text-[11px] ' + (i === 0 ? 'font-bold text-zinc-800' : 'text-zinc-500')} style={{ fontVariantNumeric: 'tabular-nums' }}>{b.v}</span>
                    </span>
                  ))}
                </span>
                <span className="flex items-center justify-end gap-1 text-xs font-bold" style={{ color }}>
                  <Icono className="h-4 w-4" />
                  {d > 0 ? `+${d}` : d === 0 ? '=' : d}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {orden.length > maxFilas && (
        <button type="button" onClick={() => setTodas(!todas)} className="mt-2 text-xs font-semibold text-zinc-600 underline-offset-4 hover:underline">
          {todas ? 'Ver menos' : `Ver las ${orden.length} áreas`}
        </button>
      )}
    </div>
  );
}
