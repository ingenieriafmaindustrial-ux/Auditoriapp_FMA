/** Barras horizontales con entrada animada (ej. nivel de impacto): etiqueta, barra proporcional y cantidad. */
export function BarrasProgreso({ filas }: { filas: { key: string; label: string; valor: number; color: string }[] }) {
  const max = Math.max(1, ...filas.map((f) => f.valor));
  const total = filas.reduce((a, f) => a + f.valor, 0);
  return (
    <ul className="space-y-3">
      {filas.map((f, i) => (
        <li key={f.key}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="text-zinc-700">{f.label}</span>
            <span>
              <b className="text-zinc-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{f.valor}</b>
              <span className="ml-1.5 text-xs text-zinc-500">{total ? Math.round((f.valor / total) * 100) : 0}%</span>
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div key={f.valor} className="viz-fila h-full rounded-full" style={{ width: `${(f.valor / max) * 100}%`, background: f.color, animationDelay: `${i * 90}ms` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
