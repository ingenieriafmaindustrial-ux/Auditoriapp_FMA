import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { auth, db, withSecondaryApp } from '../lib/firebase';
import { ahoraISO } from '../lib/dates';
import { COL, registrarBitacora } from './base';
import type { Rol, Usuario } from '../types';

/** Primer arranque: crea el perfil auditor_lider del usuario autenticado y marca el sistema como inicializado. */
export async function inicializarSistema(uid: string, email: string, nombre: string) {
  const batch = writeBatch(db);
  const perfil: Omit<Usuario, 'id'> = { nombre, email, rol: 'auditor_lider', auditorId: null, activo: true };
  batch.set(doc(db, COL.usuarios, uid), { ...perfil, creadoEn: ahoraISO(), actualizadoEn: ahoraISO() });
  batch.set(doc(db, COL.config, 'app'), { inicializado: true, inicializadoPor: uid, fecha: ahoraISO() });
  await batch.commit();
}

export interface NuevoUsuario {
  nombre: string;
  email: string;
  rol: Rol;
  auditorId: string | null;
  passwordTemporal: string;
}

/** Crea la cuenta en Auth (app secundaria) y su perfil. Solo auditor_lider. */
export async function crearUsuario(admin: Usuario, n: NuevoUsuario) {
  const uid = await withSecondaryApp(async (secondary) => {
    const secAuth = getAuth(secondary);
    const cred = await createUserWithEmailAndPassword(secAuth, n.email.trim(), n.passwordTemporal);
    await signOut(secAuth);
    return cred.user.uid;
  });
  const batch = writeBatch(db);
  batch.set(doc(db, COL.usuarios, uid), {
    nombre: n.nombre.trim(),
    email: n.email.trim().toLowerCase(),
    rol: n.rol,
    auditorId: n.auditorId,
    activo: true,
    creadoEn: ahoraISO(),
    actualizadoEn: ahoraISO(),
  });
  registrarBitacora(batch, admin, {
    entidad: 'usuario',
    entidadId: uid,
    auditoriaId: null,
    participantes: [],
    accion: 'crear',
    detalle: `Usuario ${n.email} con rol ${n.rol}`,
  });
  await batch.commit();
  return uid;
}

export async function actualizarUsuario(admin: Usuario, uid: string, cambios: Partial<Pick<Usuario, 'nombre' | 'rol' | 'auditorId' | 'activo'>>) {
  const batch = writeBatch(db);
  batch.update(doc(db, COL.usuarios, uid), { ...cambios, actualizadoEn: ahoraISO() });
  registrarBitacora(batch, admin, {
    entidad: 'usuario',
    entidadId: uid,
    auditoriaId: null,
    participantes: [],
    accion: 'editar',
    detalle: `Cambios: ${Object.keys(cambios).join(', ')}`,
  });
  await batch.commit();
}

export async function actualizarMiNombre(uid: string, nombre: string) {
  await updateDoc(doc(db, COL.usuarios, uid), { nombre: nombre.trim(), actualizadoEn: ahoraISO() });
}

export const enviarReset = (email: string) => sendPasswordResetEmail(auth, email);

/**
 * Vincula una cuenta que YA existe en Firebase Authentication (creada desde la consola).
 * El UID se copia desde Consola Firebase → Authentication → Usuarios → columna "UID de usuario".
 */
export async function vincularUsuarioExistente(admin: Usuario, uid: string, n: Omit<NuevoUsuario, 'passwordTemporal'>) {
  const batch = writeBatch(db);
  batch.set(doc(db, COL.usuarios, uid.trim()), {
    nombre: n.nombre.trim(),
    email: n.email.trim().toLowerCase(),
    rol: n.rol,
    auditorId: n.auditorId,
    activo: true,
    creadoEn: ahoraISO(),
    actualizadoEn: ahoraISO(),
  });
  registrarBitacora(batch, admin, {
    entidad: 'usuario',
    entidadId: uid.trim(),
    auditoriaId: null,
    participantes: [],
    accion: 'crear',
    detalle: `Cuenta existente ${n.email} vinculada con rol ${n.rol}`,
  });
  await batch.commit();
}
