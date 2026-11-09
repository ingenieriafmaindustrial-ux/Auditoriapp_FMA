import { Moon, Sun } from 'lucide-react';
import { AnimatedButton } from '../ui/animated-button';
import { useTheme } from '../../context/ThemeContext';

/** Botón de tema con la misma gráfica shimmer del menú. */
export function ThemeToggle({ className }: { className?: string }) {
  const { tema, alternar } = useTheme();
  const oscuro = tema === 'dark';
  return (
    <AnimatedButton
      onClick={alternar}
      size="sm"
      glow
      uppercase
      rounded="custom"
      borderRadius="100px"
      shimmerColor={oscuro ? '#38bdf8' : '#f5c400'}
      shimmerSize="0.12em"
      shimmerDuration="3s"
      background="var(--color-band-pill)"
      aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={oscuro ? 'Modo claro' : 'Modo oscuro'}
      className={className}
      style={{ color: oscuro ? '#7dd3fc' : '#f5c400' }}
    >
      {oscuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{oscuro ? 'Claro' : 'Oscuro'}</span>
    </AnimatedButton>
  );
}
