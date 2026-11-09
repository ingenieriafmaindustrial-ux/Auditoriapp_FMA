import { useState } from 'react';
import { Save } from 'lucide-react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { Button, Card, ErrorList, Field, Input, PageHeader } from '../components/ui';
import { useAuth, useUsuario } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { ROLES } from '../lib/constants';
import { errorMensaje } from '../lib/utils';
import { actualizarMiNombre } from '../services/usuarios';
import { esGestor } from '../domain/permisos';
import { RespaldoCard } from '../components/shared/RespaldoCard';

export default function PerfilPage() {
  const u = useUsuario();
  const { firebaseUser } = useAuth();
  const { mapa } = useData();
  const notify = useToast();
  const [nombre, setNombre] = useState(u.nombre);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [errores, setErrores] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function cambiarPassword() {
    const e: string[] = [];
    if (nueva.length < 8) e.push('La nueva contraseña debe tener al menos 8 caracteres.');
    if (nueva !== repetir) e.push('Las contraseñas no coinciden.');
    setErrores(e);
    if (e.length || !firebaseUser?.email) return;
    setLoading(true);
    try {
      await reauthenticateWithCredential(firebaseUser, EmailAuthProvider.credential(firebaseUser.email, actual));
      await updatePassword(firebaseUser, nueva);
      setActual(''); setNueva(''); setRepetir('');
      notify('Contraseña actualizada');
    } catch (err) {
      setErrores([errorMensaje(err)]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Mi perfil" subtitle={`${u.email} · ${ROLES[u.rol]}${u.auditorId ? ' · ' + (mapa.auditores[u.auditorId]?.nombre ?? '') : ''}`} />
      <Card title="Datos" actions={nombre.trim() !== u.nombre && <Button size="sm" variant="primary" icon={<Save className="h-3.5 w-3.5" />} onClick={() => actualizarMiNombre(u.id, nombre).then(() => notify('Nombre actualizado')).catch((e) => notify(errorMensaje(e), 'error'))}>Guardar</Button>}>
        <Field label="Nombre"><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
      </Card>
      <Card title="Cambiar contraseña">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Actual"><Input type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} /></Field>
          <Field label="Nueva"><Input type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} /></Field>
          <Field label="Repetir"><Input type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} /></Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <ErrorList errores={errores} />
          <Button variant="primary" className="ml-auto" loading={loading} disabled={!actual || !nueva} onClick={cambiarPassword}>Cambiar contraseña</Button>
        </div>
      </Card>
      {esGestor(u.rol) && <RespaldoCard />}
    </div>
  );
}
