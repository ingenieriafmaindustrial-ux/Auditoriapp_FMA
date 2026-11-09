import { useContar, useListo } from './useAnimacion';

const R = 52;
const C = 2 * Math.PI * R;

/** Medidor circular de avance (0–100) con el valor al centro; pensado para fondos oscuros. */
export function Anillo({ valor, label, tamano = 140, color = 'var(--viz-good)' }: { valor: number; label: string; tamano?: number; color?: string }) {
  const listo = useListo();
  const n = useContar(valor);
  const largo = (Math.min(100, Math.max(0, valor)) / 100) * C;
  return (
    <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
      <svg viewBox="0 0 128 128" width={tamano} height={tamano} role="img" aria-label={`${label}: ${valor}%`}>
        <circle cx={64} cy={64} r={R} fill="none" stroke="rgb(255 255 255 / .12)" strokeWidth={12} />
        <circle
          className="viz-arco"
          cx={64}
          cy={64}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${listo ? largo : 0} ${C}`}
          transform="rotate(-90 64 64)"
          style={{ transitionDuration: '1.2s' }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="font-[family-name:var(--font-display)] text-3xl font-bold leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>{n}%</span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
      </div>
    </div>
  );
}
