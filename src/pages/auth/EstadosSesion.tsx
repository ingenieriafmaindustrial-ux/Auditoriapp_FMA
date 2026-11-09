import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { Alerta, Button, Field, Input, Select } from '../../components/ui';
import { AuthShell } from '../../components/layout/AuthShell';
import { useAuth } from '../../context/AuthContext';
import { inicializarSistema } from '../../services/usuarios';
import { cargarDatosIniciales } from '../../services/catalogos';
import { SEED } from '../../lib/constants';
import { errorMensaje } from '../../lib/utils';

function SesionActiva() {
  const { firebaseUser, logout } = useAuth();
  return (
    <div className="auth-session mt-5">
      <UserRound className="h-8 w-8 shrink-0 rounded-full bg-panel p-1.5 text-brand" />
      <div className="min-w-0 flex-1">
        <b className="truncate">{firebaseUser?.email}</b>
        <small>Sesión iniciada con tu cuenta de Firebase</small>
      </div>
      <button onClick={logout} title="Cerrar sesión" className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

export function SinConfigPage() {
  return (
    <AuthShell>
      <h1>Falta configurar Firebase</h1>
      <p className="sub">
        No se encontró el archivo <code>.env.local</code>. Créalo en la raíz del proyecto con las variables <code>VITE_FIREBASE_*</code> y reinicia <code>npm run dev</code>.
      </p>
    </AuthShell>
  );
}

/**
 * Primer arranque (una sola vez): perfil del auditor líder + carga de datos maestros.
 */
export function SetupPage() {
  const { firebaseUser } = useAuth();
  const [paso, setPaso] = useState(1);
  const [auditorSeed, setAuditorSeed] = useState('');
  const [nombre, setNombre] = useState('');
  const [cargarSeed, setCargarSeed] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const nombreFinal = (auditorSeed || nombre).trim();

  async function finalizar() {
    if (!firebaseUser) return;
    setLoading(true);
    setError('');
    try {
      await inicializarSistema(firebaseUser.uid, firebaseUser.email ?? '', nombreFinal);
      if (cargarSeed) {
        await cargarDatosIniciales({ id: firebaseUser.uid, nombre: nombreFinal, email: firebaseUser.email ?? '', rol: 'auditor_lider', auditorId: null, activo: true });
      }
      // AuthContext detecta el perfil y abre la app automáticamente.
    } catch (e) {
      setError(errorMensaje(e));
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Configuración inicial · paso {paso} de 2</p>
      <h1 className="mt-1">{paso === 1 ? '¿Quién eres?' : 'Datos maestros'}</h1>
      <p className="sub">
        {paso === 1
          ? 'Eres el primer usuario: tu cuenta quedará como Auditor líder, con acceso total. Esto se hace una sola vez.'
          : 'Carga las sucursales, áreas y auditores de la plantilla del informe v10 y las cláusulas de las normas.'}
      </p>
      <div className="auth-steps">
        <i className={paso === 1 ? 'cur' : 'on'} />
        <i className={paso === 2 ? 'cur' : ''} />
      </div>

      <SesionActiva />

      {paso === 1 && (
        <div className="mt-5 space-y-4">
          <Field label="Selecciónate en la lista de auditores">
            <Select value={auditorSeed} onChange={(e) => setAuditorSeed(e.target.value)} placeholder="— No estoy en la lista —" options={SEED.auditores.map((n) => ({ value: n, label: n }))} className="py-2.5 text-base" />
          </Field>
          {!auditorSeed && (
            <Field label="Tu nombre completo">
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" className="py-2.5 text-base" />
            </Field>
          )}
          <Button variant="dark" className="w-full py-3 text-base" disabled={nombreFinal.length < 3} onClick={() => setPaso(2)}>
            Continuar <ArrowRight className="h-4 w-4 text-brand" />
          </Button>
        </div>
      )}

      {paso === 2 && (
        <div className="mt-5 space-y-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 bg-surface p-3">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-panel" checked={cargarSeed} onChange={(e) => setCargarSeed(e.target.checked)} />
            <span className="text-sm">
              <b className="block text-zinc-900">Cargar datos iniciales (recomendado)</b>
              <span className="text-zinc-600">2 sucursales · 10 áreas · 12 auditores · 168 cláusulas ISO 9001, 14001 y 45001</span>
            </span>
          </label>
          <div className="rounded-lg bg-panel p-3 text-sm text-zinc-200">
            <p className="flex items-center gap-2 font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-brand" /> Resumen
            </p>
            <p className="mt-1">
              <b className="text-brand">{nombreFinal}</b> quedará como Auditor líder.
            </p>
          </div>
          {error && <Alerta tipo="error">{error}</Alerta>}
          <div className="flex gap-2">
            <Button onClick={() => setPaso(1)} disabled={loading} className="py-3">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button variant="primary" className="flex-1 py-3 text-base" loading={loading} onClick={finalizar}>
              <Check className="h-4 w-4" /> Inicializar sistema
            </Button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}

export function SinAccesoPage({ inactivo }: { inactivo: boolean }) {
  return (
    <AuthShell>
      <h1>{inactivo ? 'Cuenta desactivada' : 'Sin acceso'}</h1>
      <p className="sub">
        {inactivo
          ? 'Tu cuenta fue desactivada. Si crees que es un error, contacta al auditor líder.'
          : 'Tu cuenta existe en Firebase, pero aún no tiene un perfil en FMA AuditoriAPP. Pide al auditor líder que te agregue en Usuarios.'}
      </p>
      <SesionActiva />
    </AuthShell>
  );
}
