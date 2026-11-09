import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * MotionGrid — fondo de cuadrícula en movimiento con brillo opcional.
 * Solo CSS (sin dependencias). Compatible con las props de ScrollX UI.
 * lineColor en formato "R, G, B".
 */
export function MotionGrid({
  speed = '3s',
  opacity = 0.15,
  enableGlow = true,
  lineColor = '245, 196, 0',
  cellSize = 40,
  className,
  style,
  children,
}: {
  speed?: string;
  opacity?: number;
  enableGlow?: boolean;
  lineColor?: string;
  cellSize?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const vars = {
    '--mg-speed': speed,
    '--mg-opacity': String(opacity),
    '--mg-color': lineColor,
    '--mg-cell': `${cellSize}px`,
  } as CSSProperties;
  return (
    <div className={cn('mg', enableGlow && 'mg-glow', className)} style={{ ...vars, ...style }}>
      <div className="mg-lines" aria-hidden="true" />
      {children}
    </div>
  );
}
