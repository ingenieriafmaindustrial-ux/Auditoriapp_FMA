import { useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';

/** Selector segmentado en píldora (una opción activa): ocupa poco y se lee de un vistazo. */
export function Segmentado<T extends string | number | null>({ valor, opciones, onChange, etiqueta }: { valor: T; opciones: { v: T; label: ReactNode }[]; onChange: (v: T) => void; etiqueta: string }) {
  return (
    <div role="group" aria-label={etiqueta} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 p-1">
      {opciones.map((o) => {
        const act = o.v === valor;
        return (
          <button
            key={String(o.v)}
            type="button"
            aria-pressed={act}
            onClick={() => onChange(o.v)}
            className={'flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors duration-200 ' + (act ? 'bg-panel text-brand shadow-sm' : 'text-zinc-600 hover:text-zinc-900')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Selector compacto en píldora (desplegable nativo, accesible). */
export function SelectPildora({ valor, onChange, etiqueta, opciones, ancho = 'min-w-[9.5rem]' }: { valor: string; onChange: (v: string) => void; etiqueta: string; opciones: { v: string; label: string }[]; ancho?: string }) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      aria-label={etiqueta}
      className={'h-9 cursor-pointer rounded-full border bg-surface pl-3.5 pr-8 text-xs font-semibold text-zinc-700 transition-colors duration-200 hover:border-zinc-500 ' + ancho + ' ' + (valor ? 'border-brand text-zinc-900' : 'border-zinc-300')}
    >
      {opciones.map((o) => (
        <option key={o.v} value={o.v}>{o.label}</option>
      ))}
    </select>
  );
}


/**
 * Barra de filtros en una línea (escritorio). En el teléfono se pliega tras un botón "Filtros (n)"
 * para no empujar el contenido hacia abajo.
 */
export function BarraFiltros({ children, activos, extra }: { children: ReactNode; activos: number; extra?: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <section className="card px-4 py-3" aria-label="Filtros">
      <div className="flex items-center gap-3 md:hidden">
        <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} className="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-zinc-300 px-4 text-sm font-semibold text-zinc-800">
          <SlidersHorizontal className="h-4 w-4" /> Filtros{activos ? ` (${activos})` : ''}
        </button>
        <span className="flex-1" />
        {extra}
      </div>
      <div className={(abierto ? 'mt-3 flex' : 'hidden') + ' flex-wrap items-center gap-x-3 gap-y-2.5 md:mt-0 md:flex'}>
        <span className="mr-1 hidden items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 md:flex"><SlidersHorizontal className="h-4 w-4" /> Filtros</span>
        {children}
        {extra && <span className="ml-auto hidden md:block">{extra}</span>}
      </div>
    </section>
  );
}
