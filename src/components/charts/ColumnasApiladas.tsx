import { useState } from 'react';
import { maxLimpio, useAncho } from './useAncho';
import { Leyenda } from './Leyenda';

export interface Serie {
  key: string;
  label: string;
  color: string;
}

/**
 * Columnas apiladas (≤24px, extremo redondeado 4px, 2px de separación entre segmentos),
 * un solo eje, total en el tope de cada columna y tooltip por columna.
 */
/** Parte una etiqueta larga en ≤2 líneas que quepan en el ancho de la columna. */
function lineas(txt: string, maxChars: number): string[] {
  if (txt.length <= maxChars) return [txt];
  const out: string[] = [];
  let actual = '';
  for (const w of txt.split(/\s+/)) {
    if (!actual) actual = w;
    else if ((actual + ' ' + w).length <= maxChars) actual += ' ' + w;
    else { out.push(actual); actual = w; }
  }
  if (actual) out.push(actual);
  const res = out.slice(0, 2).map((l) => (l.length > maxChars ? l.slice(0, Math.max(3, maxChars - 1)) + '…' : l));
  if (out.length > 2) res[1] = res[1].replace(/…?$/, '…');
  return res;
}

export function ColumnasApiladas({ datos, series, alto = 220, leyenda = true, etiquetasLargas = false, onSelect, seleccionado }: {
  datos: { label: string; valores: Record<string, number>; titulo?: string }[];
  series: Serie[];
  alto?: number;
  leyenda?: boolean;
  /** Nombres largos (áreas): se parten en 2 líneas bajo cada columna. */
  etiquetasLargas?: boolean;
  onSelect?: (i: number) => void;
  seleccionado?: number | null;
}) {
  const { ref, ancho } = useAncho<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const m = { t: 18, r: 8, b: etiquetasLargas ? 40 : 26, l: 30 };
  const w = ancho - m.l - m.r;
  const h = alto - m.t - m.b;
  const totales = datos.map((d) => series.reduce((acc, s) => acc + (d.valores[s.key] ?? 0), 0));
  const max = maxLimpio(Math.max(0, ...totales));
  const banda = datos.length ? w / datos.length : w;
  const barW = Math.max(6, Math.min(24, banda * 0.55));
  const y = (v: number) => (v / max) * h;
  const ticks = [0, max / 2, max];

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <svg viewBox={`0 0 ${ancho} ${alto}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Gráfico de columnas apiladas">
        <g transform={`translate(${m.l},${m.t})`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={w} y1={h - y(t)} y2={h - y(t)} stroke={t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} strokeWidth={1} />
              <text x={-8} y={h - y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--viz-muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {Number.isInteger(t) ? t : t.toFixed(1)}
              </text>
            </g>
          ))}
          {datos.map((d, i) => {
            const cx = banda * i + banda / 2;
            let acumulado = 0;
            const visibles = series.filter((s) => (d.valores[s.key] ?? 0) > 0);
            return (
              <g key={d.label + i + ':' + totales[i]} opacity={(hover === null || hover === i) && (seleccionado == null || seleccionado === i) ? 1 : 0.4} style={{ transition: 'opacity .15s' }}>
                {visibles.map((s, si) => {
                  const v = d.valores[s.key] ?? 0;
                  const alto0 = y(acumulado);
                  const hSeg = Math.max(0, y(v) - (si > 0 ? 2 : 0));
                  acumulado += v;
                  const top = h - alto0 - (si > 0 ? 2 : 0) - hSeg;
                  const esTope = si === visibles.length - 1;
                  const r = esTope ? Math.min(4, hSeg, barW / 2) : 0;
                  const x = cx - barW / 2;
                  const path = `M${x},${top + hSeg} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + hSeg} Z`;
                  return <path key={s.key} d={path} fill={s.color} className="viz-col" style={{ animationDelay: `${i * 45 + si * 120}ms` }} />;
                })}
                {totales[i] > 0 && (
                  <text x={cx} y={h - y(totales[i]) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-zinc-700)">
                    {totales[i]}
                  </text>
                )}
                <text x={cx} y={h + 16} textAnchor="middle" fontSize={etiquetasLargas ? 10 : 11} fill={seleccionado === i ? 'var(--color-zinc-900)' : 'var(--viz-muted)'} fontWeight={seleccionado === i ? 700 : 400}>
                  {etiquetasLargas
                    ? lineas(d.label, Math.max(5, Math.floor(banda / 5.6))).map((l, k) => <tspan key={k} x={cx} dy={k ? 12 : 0}>{l}</tspan>)
                    : d.label}
                </text>
                <rect
                  x={banda * i}
                  y={0}
                  width={banda}
                  height={h + m.b}
                  fill="transparent"
                  style={{ cursor: onSelect ? 'pointer' : undefined }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={onSelect ? () => onSelect(i) : undefined}
                />
              </g>
            );
          })}
        </g>
      </svg>
      {hover !== null && datos[hover] && (
        <div className="viz-tip" style={{ left: m.l + banda * hover + banda / 2, top: m.t + h - y(totales[hover]) }}>
          <p className="mb-1 font-semibold">{datos[hover].titulo ?? datos[hover].label}</p>
          {series.filter((s) => leyenda || (datos[hover].valores[s.key] ?? 0) > 0).map((s) => (
            <p key={s.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-zinc-600">
                <span className="chip-dot" style={{ background: s.color }} /> {s.label}
              </span>
              <b>{datos[hover].valores[s.key] ?? 0}</b>
            </p>
          ))}
          <p className="mt-1 flex justify-between border-t border-zinc-200 pt-1 text-zinc-600">
            Total <b className="text-zinc-900">{totales[hover]}</b>
          </p>
        </div>
      )}
      {leyenda && series.length > 1 && (
        <div className="mt-1">
          <Leyenda items={series.map((s) => ({ label: s.label, color: s.color }))} />
        </div>
      )}
    </div>
  );
}
