import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { animatedButtonStyle } from '../ui/animated-button';

/** Botón "volver" con la misma gráfica animada del menú: flecha en círculo que se desplaza hacia atrás. */
export function BotonVolver({ to, destino }: { to: string; destino: string }) {
  const s = animatedButtonStyle({ glow: true, shimmerColor: '#f5c400', shimmerSize: '0.12em', shimmerDuration: '3.5s', borderRadius: '999px', background: 'var(--color-band-pill)' });
  return (
    <Link to={to} className={`${s.className} volver no-print mb-3`} style={s.style} aria-label={`Volver a ${destino}`}>
      <span className="ab-label volver-label">
        <span className="volver-flecha"><ArrowLeft className="h-4 w-4" /></span>
        <span className="flex flex-col leading-tight">
          <span className="volver-kicker">Volver</span>
          <span className="volver-destino">{destino}</span>
        </span>
      </span>
    </Link>
  );
}
