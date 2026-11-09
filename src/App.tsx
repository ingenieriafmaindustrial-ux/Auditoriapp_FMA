import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { AppLayout } from './components/layout/AppLayout';
import { Spinner } from './components/ui';
import { firebaseConfigurado } from './lib/firebase';
import { esAdminTI, esGestor } from './domain/permisos';
import LoginPage from './pages/auth/LoginPage';
import { SetupPage, SinAccesoPage, SinConfigPage } from './pages/auth/EstadosSesion';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AuditoriasPage = lazy(() => import('./pages/auditorias/AuditoriasPage'));
const AuditoriaDetailPage = lazy(() => import('./pages/auditorias/AuditoriaDetailPage'));
const HallazgosPage = lazy(() => import('./pages/hallazgos/HallazgosPage'));
const HallazgoDetailPage = lazy(() => import('./pages/hallazgos/HallazgoDetailPage'));
const CatalogosPage = lazy(() => import('./pages/catalogos/CatalogosPage'));
const UsuariosPage = lazy(() => import('./pages/usuarios/UsuariosPage'));
const PerfilPage = lazy(() => import('./pages/PerfilPage'));
const CalendarioPage = lazy(() => import('./pages/calendario/CalendarioPage'));

function Solo({ permitido, children }: { permitido: boolean; children: ReactNode }) {
  return permitido ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  const { estado, usuario } = useAuth();

  if (!firebaseConfigurado) return <SinConfigPage />;
  if (estado === 'cargando') return <Spinner label="Iniciando…" />;
  if (estado === 'anonimo') return <LoginPage />;
  if (estado === 'setup') return <SetupPage />;
  if (estado === 'sin_perfil' || estado === 'inactivo' || !usuario) return <SinAccesoPage inactivo={estado === 'inactivo'} />;

  return (
    <DataProvider>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="auditorias" element={<AuditoriasPage />} />
            <Route path="auditorias/:id" element={<AuditoriaDetailPage />} />
            <Route path="calendario" element={<CalendarioPage />} />
            <Route path="hallazgos" element={<HallazgosPage />} />
            <Route path="hallazgos/:id" element={<HallazgoDetailPage />} />
            <Route path="catalogos" element={<Solo permitido={esGestor(usuario.rol)}><CatalogosPage /></Solo>} />
            <Route path="usuarios" element={<Solo permitido={esAdminTI(usuario)}><UsuariosPage /></Solo>} />
            <Route path="perfil" element={<PerfilPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </DataProvider>
  );
}
