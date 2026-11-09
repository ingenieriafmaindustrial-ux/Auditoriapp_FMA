import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Building2, CalendarDays, ClipboardList, Home, LogOut, SearchCheck, Settings, UserCircle, Users } from 'lucide-react';
import { usePendientes } from '../../hooks/usePendientes';
import { useAuth, useUsuario } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { ROLES } from '../../lib/constants';
import { esAdminTI, esGestor } from '../../domain/permisos';
import { Recordatorios } from '../shared/Recordatorios';
import { semaforoPlazo } from '../../domain/hallazgoReglas';
import { HojasRuta, type Hoja } from './SheetTabs';
import { MotionGrid } from '../ui/motion-grid';
import { ThemeToggle } from '../shared/ThemeToggle';
import { useTheme } from '../../context/ThemeContext';

export function AppLayout() {
  const u = useUsuario();
  const { logout } = useAuth();
  const { hallazgos } = useData();
  const [menu, setMenu] = useState(false);
  const { tema } = useTheme();

  const { agenda } = usePendientes();
  const vencidos = hallazgos.filter((h) => h.tipo === 'NC' && semaforoPlazo(h) === 'vencido').length;
  const ic = 'h-4 w-4';
  const hojas: Hoja[] = [
    { key: 'inicio', label: 'Inicio', to: '/', icon: <Home className={ic} /> },
    { key: 'calendario', label: 'Calendario', to: '/calendario', icon: <CalendarDays className={ic} />, badge: agenda.length || undefined },
    { key: 'auditorias', label: 'Auditorías', to: '/auditorias', icon: <ClipboardList className={ic} /> },
    { key: 'hallazgos', label: 'Hallazgos / Seguimiento', to: '/hallazgos', icon: <SearchCheck className={ic} />, badge: vencidos || undefined },
    ...(esGestor(u.rol) ? [{ key: 'catalogos', label: 'Sucursales', to: '/catalogos', icon: <Building2 className={ic} /> }] : []),
    ...(esAdminTI(u) ? [{ key: 'usuarios', label: 'Usuarios', to: '/usuarios', icon: <Users className={ic} /> }] : []),
  ];

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky z-40 no-print" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <MotionGrid speed="3s" enableGlow lineColor={tema === 'dark' ? '56, 189, 248' : '245, 196, 0'} opacity={tema === 'dark' ? 0.1 : 0.15} cellSize={32} className="bg-band text-white" style={{ overflow: 'visible' }}>
      <header style={{ zIndex: 20 }}>
        <div className="flex items-center gap-3 px-3 py-2 sm:px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-app.png" alt="FMA AuditoriAPP" className="h-12 w-auto drop-shadow-[0_4px_10px_rgba(0,0,0,.45)] sm:h-14" />
          </Link>
          <div className="flex-1" />
          <Recordatorios />
          <ThemeToggle />
          <img src="/logo-fma.png" alt="FMA Industrial" className="hidden h-12 w-12 rounded-md sm:block" />
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/10" aria-haspopup="menu" aria-expanded={menu}>
              <UserCircle className="h-6 w-6 text-brand" />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-semibold">{u.nombre}</span>
                <span className="block text-[11px] text-zinc-400">{ROLES[u.rol]}</span>
              </span>
            </button>
            {menu && (
              <div role="menu" className="absolute right-0 mt-1 w-48 overflow-hidden rounded-lg bg-surface py-1 text-sm text-zinc-800 shadow-xl" onMouseLeave={() => setMenu(false)}>
                <Link to="/perfil" onClick={() => setMenu(false)} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-100">
                  <Settings className="h-4 w-4" /> Mi perfil
                </Link>
                <button onClick={logout} className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-zinc-100">
                  <LogOut className="h-4 w-4" /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <HojasRuta hojas={hojas} />
      <div className="h-1 bg-brand dark:bg-linear-to-r dark:from-brand dark:via-sky-400 dark:to-brand" />
      </MotionGrid>
      </div>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}>
        <Outlet />
      </main>
    </div>
  );
}
