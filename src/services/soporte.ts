import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ahoraISO } from '../lib/dates';
import { dispositivo, erroresRecientes, rutaGenerica, ultimaAccionUsuario, VERSION_APP } from '../lib/errores';
import type { Usuario } from '../types';
import { COL } from './base';

/** "Reportar problema": el auditor describe qué pasó y se adjunta el contexto técnico automáticamente. */
export async function enviarReporte(u: Usuario, descripcion: string, accionPrevia = ultimaAccionUsuario()) {
  const d = descripcion.trim();
  if (d.length < 5) throw new Error('Cuenta brevemente qué pasó (mínimo 5 caracteres).');
  await addDoc(collection(db, COL.reportes), {
    usuarioId: u.id,
    usuarioNombre: u.nombre,
    fecha: ahoraISO(),
    descripcion: d.slice(0, 2000),
    ruta: rutaGenerica(),
    accion: accionPrevia.slice(0, 120),
    errores: erroresRecientes().slice(0, 5).map((e) => ({ id: e.id, mensaje: e.mensaje.slice(0, 300) })),
    version: VERSION_APP,
    dispositivo: dispositivo(),
    estado: 'nuevo',
  });
}

export const marcarErrorRevisado = (id: string, revisado: boolean) => updateDoc(doc(db, COL.errores, id), { revisado, revisadoEn: ahoraISO() });
export const eliminarError = (id: string) => deleteDoc(doc(db, COL.errores, id));
export const marcarReporteRevisado = (id: string, revisado: boolean) => updateDoc(doc(db, COL.reportes, id), { estado: revisado ? 'revisado' : 'nuevo', revisadoEn: ahoraISO() });
export const eliminarReporte = (id: string) => deleteDoc(doc(db, COL.reportes, id));
