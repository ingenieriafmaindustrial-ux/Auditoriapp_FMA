import { useState } from 'react';
import { KeyRound, Pencil, Save, UserPlus } from 'lucide-react';
import { Alerta, Badge, Button, ErrorList, Field, Input, Modal, PageHeader, Select } from '../../components/ui';
import { useData } from '../../context/DataContext';
import { useUsuario } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ROLES } from '../../lib/constants';
import { errorMensaje } from '../../lib/utils';
import { actualizarUsuario, crearUsuario, enviarReset, vincularUsuarioExistente } from '../../services/usuarios';
import { guardarItemCatalogo } from '../../services/catalogos';
import { Link } from 'react-router-dom';
import type { Rol, Usuario } from '../../types';

interface Form { id?: string; nombre: string; email: string; rol: Rol; auditorId: string | null; passwordTemporal: string; activo: boolean; existente: boolean; uid: string }

const NUEVO = '__nuevo__';

export default function UsuariosPage() {
  const admin = useUsuario();
  const notify = useToast();
  const { usuarios, auditores, mapa } = useData();
  const [f, setF] = useState<Form | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const rolOpts = (Object.keys(ROLES) as Rol[]).map((r) => ({ value: r, label: ROLES[r] }));

  async function guardar() {
    if (!f) return;
    const e: string[] = [];
    if (f.nombre.trim().length < 3) e.push('Indique el nombre.');
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.push('Correo inválido.');
    if (!f.id && !f.existente && f.passwordTemporal.length < 8) e.push('La contraseña temporal debe tener al menos 8 caracteres.');
    if (!f.id && f.existente && !/^[A-Za-z0-9]{20,40}$/.test(f.uid.trim())) e.push('UID inválido: cópialo desde Authentication → Usuarios.');
    if (!f.id && f.existente && usuarios.some((x) => x.id === f.uid.trim())) e.push('Ese UID ya tiene perfil en la app.');
    if (f.rol !== 'auditor_lider' && !f.auditorId) e.push('Vincule el usuario a un auditor del catálogo (define qué auditorías ve).');
    if (f.auditorId && f.auditorId !== NUEVO && usuarios.some((x) => x.auditorId === f.auditorId && x.id !== f.id)) e.push('Ese auditor ya está vinculado a otra cuenta.');
    if (f.id === admin.id && (f.rol !== 'auditor_lider' || !f.activo)) e.push('No puedes quitarte el rol de auditor líder ni desactivarte.');
    setErrores(e);
    if (e.length) return;
    setLoading(true);
    try {
      if (f.auditorId === NUEVO) {
        // Crea el auditor en el catálogo con el nombre del usuario y lo vincula
        const nuevoId = await guardarItemCatalogo(admin, 'auditores', null, { nombre: f.nombre.trim(), cargo: '', sucursalId: null, areaOrigenId: null, activo: true });
        f.auditorId = nuevoId;
      }
      if (f.id) {
        await actualizarUsuario(admin, f.id, { nombre: f.nombre.trim(), rol: f.rol, auditorId: f.auditorId, activo: f.activo });
        notify('Usuario actualizado');
      } else if (f.existente) {
        await vincularUsuarioExistente(admin, f.uid, { nombre: f.nombre, email: f.email, rol: f.rol, auditorId: f.auditorId });
        notify('Cuenta existente vinculada');
      } else {
        await crearUsuario(admin, { nombre: f.nombre, email: f.email, rol: f.rol, auditorId: f.auditorId, passwordTemporal: f.passwordTemporal });
        notify('Usuario creado. Comparte la contraseña temporal por un canal seguro.');
      }
      setF(null);
    } catch (err) {
      setErrores([errorMensaje(err)]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle="Solo los auditores con cuenta pueden ingresar"
        actions={<Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => { setErrores([]); setF({ nombre: '', email: '', rol: 'auditor', auditorId: null, passwordTemporal: '', activo: true, existente: true, uid: '' }); }}>Nuevo usuario</Button>}
      />
      <div className="table-wrap">
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Auditor vinculado</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {usuarios.map((x: Usuario) => (
              <tr key={x.id} className={x.activo ? '' : 'opacity-50'}>
                <td className="font-medium">{x.nombre}</td>
                <td>{x.email}</td>
                <td><Badge className={x.rol === 'auditor_lider' ? 'bg-panel text-brand' : x.rol === 'auditor_sistema' ? 'bg-zinc-200 text-zinc-800' : 'bg-zinc-100 text-zinc-600'}>{ROLES[x.rol]}</Badge></td>
                <td>{x.auditorId ? mapa.auditores[x.auditorId]?.nombre ?? '—' : '—'}</td>
                <td>{x.activo ? 'Activo' : 'Inactivo'}</td>
                <td className="whitespace-nowrap text-right">
                  <button aria-label="Enviar restablecimiento" title="Enviar correo para restablecer contraseña" className="p-1.5 text-zinc-500 hover:text-zinc-900" onClick={() => enviarReset(x.email).then(() => notify(`Correo enviado a ${x.email}`)).catch((e) => notify(errorMensaje(e), 'error'))}><KeyRound className="h-4 w-4" /></button>
                  <button aria-label="Editar" className="p-1.5 text-zinc-500 hover:text-zinc-900" onClick={() => { setErrores([]); setF({ id: x.id, nombre: x.nombre, email: x.email, rol: x.rol, auditorId: x.auditorId, passwordTemporal: '', activo: x.activo, existente: false, uid: x.id }); }}><Pencil className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!f} onClose={() => setF(null)} title={f?.id ? 'Editar usuario' : 'Nuevo usuario'} footer={<><Button onClick={() => setF(null)}>Cancelar</Button><Button variant="primary" icon={<Save className="h-4 w-4" />} loading={loading} onClick={guardar}>Guardar</Button></>}>
        {f && (
          <div className="space-y-3">
            <Field label="Nombre"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Field>
            <Field label="Correo"><Input type="email" value={f.email} disabled={!!f.id} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            {!f.id && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-panel" checked={f.existente} onChange={(e) => setF({ ...f, existente: e.target.checked })} /> La cuenta ya existe en Firebase Authentication
              </label>
            )}
            {!f.id && f.existente && <Field label="UID de usuario" hint="Consola Firebase → Authentication → Usuarios → columna «UID de usuario»."><Input value={f.uid} onChange={(e) => setF({ ...f, uid: e.target.value })} placeholder="p. ej. 8fK2m…" /></Field>}
            {!f.id && !f.existente && <Field label="Contraseña temporal" hint="Pídele que la cambie en «Mi perfil» al ingresar."><Input type="text" value={f.passwordTemporal} onChange={(e) => setF({ ...f, passwordTemporal: e.target.value })} /></Field>}
            <Field label="Rol"><Select value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value as Rol })} options={rolOpts} /></Field>
            <Field label="Auditor del catálogo" hint="Un auditor solo ve las auditorías donde es líder o integra el equipo.">
              <Select
                value={f.auditorId ?? ''}
                onChange={(e) => setF({ ...f, auditorId: e.target.value || null })}
                placeholder="— Seleccione —"
                options={[
                  ...auditores.filter((a) => a.activo && (!usuarios.some((x) => x.auditorId === a.id) || a.id === f.auditorId)).map((a) => ({ value: a.id, label: a.nombre })),
                  ...(f.nombre.trim().length >= 3 ? [{ value: NUEVO, label: `+ Agregar «${f.nombre.trim()}» al catálogo` }] : []),
                ]}
              />
            </Field>
            {auditores.length === 0 && (
              <Alerta tipo="warn">
                El catálogo de auditores está vacío. Ve a <Link to="/catalogos" className="font-semibold underline">Catálogos → Cargar datos iniciales</Link>, o usa la opción «+ Agregar al catálogo» (primero escribe el nombre).
              </Alerta>
            )}
            {f.id && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-panel" checked={f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} /> Cuenta activa
              </label>
            )}
            {!f.id && <Alerta tipo="info">Firebase no permite borrar cuentas desde la app: para quitar acceso, desactívala.</Alerta>}
            <ErrorList errores={errores} />
          </div>
        )}
      </Modal>
    </div>
  );
}
