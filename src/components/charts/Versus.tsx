export interface FilaVersus {
  label: string;
  a: number;
  b: number;
  sufijo?: string;
}

/**
 * Comparación cara a cara (gráfico mariposa): la sede A crece hacia la izquierda y la B hacia la derecha,
 * cada fila escalada a su propio máximo para comparar proporciones; el valor siempre va escrito.
 */
export function Versus({ nombreA, nombreB, colorA, colorB, filas }: { nombreA: string; nombreB: string; colorA: string; colorB: string; filas: FilaVersus[] }) {
  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs font-bold uppercase tracking-wider">
        <span className="flex items-center gap-2 text-zinc-800"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colorA }} /> {nombreA}</span>
        <span className="flex items-center justify-end gap-2 text-zinc-800">{nombreB} <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorB }} /></span>
      </div>
      <ul className="space-y-2.5">
        {filas.map((f, i) => {
          const max = Math.max(1, f.a, f.b);
          const gana = f.a === f.b ? null : f.a > f.b ? 'a' : 'b';
          return (
            <li key={f.label} className="grid items-center gap-2" style={{ gridTemplateColumns: '2.75rem minmax(0,1fr) 7.5rem minmax(0,1fr) 2.75rem' }}>
              <span className={'text-right text-sm ' + (gana === 'a' ? 'font-bold text-zinc-900' : 'text-zinc-600')} style={{ fontVariantNumeric: 'tabular-nums' }}>{f.a}{f.sufijo}</span>
              <span className="flex h-3 justify-end overflow-hidden rounded-l-full bg-zinc-100">
                <span key={f.a} className="viz-fila h-full rounded-l-full" style={{ width: `${(f.a / max) * 100}%`, background: colorA, transformOrigin: '100% 50%', animationDelay: `${i * 70}ms` }} />
              </span>
              <span className="text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{f.label}</span>
              <span className="flex h-3 overflow-hidden rounded-r-full bg-zinc-100">
                <span key={f.b} className="viz-fila h-full rounded-r-full" style={{ width: `${(f.b / max) * 100}%`, background: colorB, animationDelay: `${i * 70}ms` }} />
              </span>
              <span className={'text-sm ' + (gana === 'b' ? 'font-bold text-zinc-900' : 'text-zinc-600')} style={{ fontVariantNumeric: 'tabular-nums' }}>{f.b}{f.sufijo}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
