import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { animatedButtonStyle } from '../ui/animated-button';

/**
 * Menú "por hojas" (estilo pestañas de planilla): una fila compacta,
 * con desplazamiento horizontal en móvil en vez de un menú lateral que colapsa la pantalla.
 */
export interface Hoja {
  key: string;
  label: string;
  icon?: ReactNode;
  badge?: number | string;
  to?: string; // si existe, navega por ruta
}

const base =
  'relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-lg border border-b-0 px-3.5 py-2 text-sm transition';
const on = 'z-10 -mb-px border-zinc-300 bg-surface font-semibold text-zinc-900';
const off = 'border-transparent text-zinc-500 hover:bg-surface/60 hover:text-zinc-800';

function Contenido({ h }: { h: Hoja }) {
  return (
    <>
      {h.icon}
      <span>{h.label}</span>
      {h.badge !== undefined && h.badge !== 0 && (
        <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold leading-4 text-ink">{h.badge}</span>
      )}
    </>
  );
}

/** Menú principal: botones con brillo animado (AnimatedButton). Solo la hoja activa anima. */
export function HojasRuta({ hojas }: { hojas: Hoja[] }) {
  return (
    <nav className="hojas-scroll flex gap-2 overflow-x-auto px-3 py-3 sm:px-4" aria-label="Menú principal">
      {hojas.map((h) => (
        <NavLink key={h.key} to={h.to!} end={h.to === '/'}>
          {({ isActive }) => {
            const s = animatedButtonStyle({ size: 'sm', glow: isActive, uppercase: true, hideAnimations: !isActive, shimmerColor: '#f5c400', shimmerSize: '0.12em', shimmerDuration: '3s', borderRadius: '100px', background: 'var(--color-band-pill)' });
            return (
              <span className={s.className} style={{ ...s.style, ...(isActive ? { color: '#f5c400' } : {}) }} aria-current={isActive ? 'page' : undefined}>
                <span className="ab-label flex items-center gap-1.5">
                  <Contenido h={h} />
                </span>
              </span>
            );
          }}
        </NavLink>
      ))}
    </nav>
  );
}

/** Hojas internas de una página (estado local / query string). */
export function Hojas({ hojas, activa, onChange, className }: { hojas: Hoja[]; activa: string; onChange: (k: string) => void; className?: string }) {
  return (
    <div role="tablist" className={cn('hojas-scroll flex gap-1 overflow-x-auto border-b border-zinc-300', className)}>
      {hojas.map((h) => (
        <button key={h.key} role="tab" aria-selected={activa === h.key} onClick={() => onChange(h.key)} className={cn(base, activa === h.key ? on : off)}>
          <Contenido h={h} />
        </button>
      ))}
    </div>
  );
}
