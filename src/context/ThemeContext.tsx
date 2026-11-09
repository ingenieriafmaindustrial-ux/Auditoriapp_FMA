import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type Tema = 'light' | 'dark';
const CLAVE = 'fma-tema';

function temaInicial(): Tema {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) return 'dark';
  return 'light';
}

const ThemeContext = createContext<{ tema: Tema; alternar: () => void }>({ tema: 'light', alternar: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', tema === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'dark' ? '#070d1a' : '#0a0a0a');
    try {
      localStorage.setItem(CLAVE, tema);
    } catch {
      /* navegador sin almacenamiento: el tema no se recuerda, pero funciona */
    }
  }, [tema]);

  const alternar = useCallback(() => {
    const root = document.documentElement;
    root.classList.add('tema-transicion');
    setTema((t) => (t === 'dark' ? 'light' : 'dark'));
    window.setTimeout(() => root.classList.remove('tema-transicion'), 350);
  }, []);

  return <ThemeContext.Provider value={{ tema, alternar }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
