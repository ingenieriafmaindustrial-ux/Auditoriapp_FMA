import type { Auditoria, Rol, Usuario } from '../types';
import { ADMIN_TI_EMAIL } from '../lib/constants';

export const esGestor = (rol: Rol | undefined) => rol === 'auditor_lider' || rol === 'auditor_sistema';
export const esLider = (rol: Rol | undefined) => rol === 'auditor_lider';

/** Puede emitir informe: líder siempre; sistema solo si es líder de esa auditoría (P7). */
export function puedeEmitirInforme(u: Usuario, a: Auditoria): boolean {
  if (u.rol === 'auditor_lider') return true;
  return u.rol === 'auditor_sistema' && !!u.auditorId && u.auditorId === a.auditorLiderId;
}

export const puedeEditarAuditoria = (u: Usuario) => esGestor(u.rol);
export const puedeTrabajarAuditoria = (u: Usuario, a: Auditoria) =>
  esGestor(u.rol) || (!!u.auditorId && a.participantes.includes(u.auditorId));

/** Solo el administrador TI (auditor líder con el correo configurado) gestiona usuarios. */
export const esAdminTI = (u: Pick<Usuario, 'email' | 'rol'>) => u.rol === 'auditor_lider' && u.email.trim().toLowerCase() === ADMIN_TI_EMAIL;
