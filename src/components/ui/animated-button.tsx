import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * AnimatedButton — borde con brillo giratorio (shimmer) + glow.
 * Reimplementación liviana (solo CSS, sin dependencias) compatible con las props de ScrollX UI.
 * Respeta "prefers-reduced-motion": sin animación para quien la desactiva en su sistema.
 */
export interface AnimatedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  glow?: boolean;
  textEffect?: 'normal' | 'shimmer';
  uppercase?: boolean;
  rounded?: 'none' | 'md' | 'full' | 'custom';
  hideAnimations?: boolean;
  shimmerColor?: string;
  shimmerSize?: string;
  shimmerDuration?: string;
  borderRadius?: string;
  background?: string;
  children?: ReactNode;
}

/** Clases + variables CSS reutilizables (p. ej. para aplicar el efecto a un <NavLink>). */
export function animatedButtonStyle(p: Omit<AnimatedButtonProps, 'children'> & { active?: boolean }) {
  const {
    size = 'default',
    glow = false,
    textEffect = 'normal',
    uppercase = false,
    rounded = 'custom',
    hideAnimations = false,
    shimmerColor = '#f5c400',
    shimmerSize = '0.1em',
    shimmerDuration = '3s',
    borderRadius = '100px',
    background = 'rgba(0, 0, 0, 1)',
    variant = 'default',
  } = p;
  const radius = { none: '0px', md: '8px', full: '9999px', custom: borderRadius }[rounded];
  const style = {
    '--ab-shimmer': shimmerColor,
    '--ab-cut': shimmerSize,
    '--ab-speed': shimmerDuration,
    '--ab-radius': radius,
    '--ab-bg': variant === 'ghost' ? 'transparent' : background,
  } as CSSProperties;
  const className = cn(
    'ab',
    size === 'sm' && 'ab-sm',
    size === 'lg' && 'ab-lg',
    variant === 'outline' && 'ab-outline',
    glow && 'ab-glow',
    uppercase && 'ab-upper',
    textEffect === 'shimmer' && 'ab-text-shimmer',
    hideAnimations && 'ab-static',
  );
  return { className, style };
}

export function AnimatedButton({
  className,
  style,
  children,
  variant,
  size,
  glow,
  textEffect,
  uppercase,
  rounded,
  hideAnimations,
  shimmerColor,
  shimmerSize,
  shimmerDuration,
  borderRadius,
  background,
  type = 'button',
  ...rest
}: AnimatedButtonProps) {
  const s = animatedButtonStyle({ variant, size, glow, textEffect, uppercase, rounded, hideAnimations, shimmerColor, shimmerSize, shimmerDuration, borderRadius, background });
  return (
    <button type={type} {...rest} className={cn(s.className, className)} style={{ ...s.style, ...style }}>
      <span className="ab-label">{children}</span>
    </button>
  );
}
