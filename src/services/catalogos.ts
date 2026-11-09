import { doc, collection, writeBatch, updateDoc, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SEED } from '../lib/constants';
import { ahoraISO } from '../lib/dates';
import { REQUISITOS_SEED } from '../data/requisitosSeed';
import { COL, registrarBitacora } from './base';
import { normalizar } from '../lib/utils';
import type { Requisito, Usuario } from '../types';

export type CatalogoSimple = 'sucursales' | 'areas';

export async function guardarItemCatalogo(
  usuario: Usuario,
  coleccion: 'sucursales' | 'areas' | 'auditores' | 'requisitos',
  id: string | null,
  data: Record<string, unknown>,
) {
  const batch = writeBatch(db);
  const ref = id ? doc(db, coleccion, id) : doc(collection(db, coleccion));
  batch.set(ref, { ...data, actualizadoEn: ahoraISO() }, { merge: true });
  registrarBitacora(batch, usuario, {
    entidad: 'catalogo',
    entidadId: ref.id,
    auditoriaId: null,
    participantes: [],
    accion: id ? 'editar' : 'crear',
    detalle: `${coleccion}: ${String(data.nombre ?? data.titulo ?? ref.id)}`,
  });
  await batch.commit();
  return ref.id;
}

export async function cambiarActivo(coleccion: string, id: string, activo: boolean) {
  await updateDoc(doc(db, coleccion, id), { activo, actualizadoEn: ahoraISO() });
}

export async function catalogosVacios(): Promise<boolean> {
  const snap = await getDocs(query(collection(db, COL.areas), limit(1)));
  return snap.empty;
}

/**
 * Carga inicial de sucursales, áreas, auditores y requisitos (plantilla v10 + normas).
 * Si el usuario que la ejecuta aún no está vinculado a un auditor y su nombre coincide
 * con uno del catálogo, lo vincula automáticamente.
 */
export async function cargarDatosIniciales(usuario: Usuario): Promise<{ auditorIdUsuario: string | null }> {
  const batch = writeBatch(db);
  const now = ahoraISO();
  SEED.sucursales.forEach((nombre) =>
    batch.set(doc(collection(db, COL.sucursales)), { nombre, activo: true, actualizadoEn: now }),
  );
  SEED.areas.forEach((nombre) =>
    batch.set(doc(collection(db, COL.areas)), { nombre, encargado: '', cargoEncargado: '', activo: true, actualizadoEn: now }),
  );
  let auditorIdUsuario: string | null = usuario.auditorId;
  const nombreUsuario = normalizar(usuario.nombre);
  SEED.auditores.forEach((nombre) => {
    const ref = doc(collection(db, COL.auditores));
    batch.set(ref, { nombre, cargo: '', sucursalId: null, areaOrigenId: null, activo: true, actualizadoEn: now });
    const n = normalizar(nombre);
    if (!auditorIdUsuario && (nombreUsuario === n || nombreUsuario.startsWith(n + ' '))) auditorIdUsuario = ref.id;
  });
  REQUISITOS_SEED.forEach((r, orden) =>
    batch.set(doc(collection(db, COL.requisitos)), { ...r, orden, activo: true, actualizadoEn: now }),
  );
  if (auditorIdUsuario && auditorIdUsuario !== usuario.auditorId) {
    batch.update(doc(db, COL.usuarios, usuario.id), { auditorId: auditorIdUsuario, actualizadoEn: now });
  }
  registrarBitacora(batch, usuario, {
    entidad: 'sistema',
    entidadId: 'seed',
    auditoriaId: null,
    participantes: [],
    accion: 'crear',
    detalle: 'Carga de datos iniciales (sucursales, áreas, auditores, requisitos)',
  });
  await batch.commit(); // ~195 escrituras (< 500 por lote)
  return { auditorIdUsuario };
}

/** Elimina registros de catálogo (solo los que no tienen uso; la validación se hace antes en la UI). */
export async function eliminarItemsCatalogo(
  usuario: Usuario,
  coleccion: 'sucursales' | 'areas' | 'auditores' | 'requisitos',
  items: { id: string; etiqueta: string }[],
) {
  for (let i = 0; i < items.length; i += 200) {
    const batch = writeBatch(db);
    items.slice(i, i + 200).forEach((it) => {
      batch.delete(doc(db, coleccion, it.id));
      registrarBitacora(batch, usuario, {
        entidad: 'catalogo',
        entidadId: it.id,
        auditoriaId: null,
        participantes: [],
        accion: 'eliminar',
        detalle: `${coleccion}: ${it.etiqueta} eliminado`,
      });
    });
    await batch.commit();
  }
}

export async function desactivarItemsCatalogo(coleccion: string, ids: string[]) {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.update(doc(db, coleccion, id), { activo: false, actualizadoEn: ahoraISO() }));
  await batch.commit();
}


/** ¿Los requisitos de ISO 14001 cargados corresponden a la versión 2026? (6.1.5 es una cláusula nueva) */
export const requisitos14001Vigentes = (reqs: Requisito[]) => !reqs.some((r) => r.norma === 'ISO 14001') || reqs.some((r) => r.norma === 'ISO 14001' && r.clausula === '6.1.5');

/**
 * Deja vigente ISO 14001:2026: actualiza títulos, agrega cláusulas nuevas y desactiva las que ya no existen
 * (sin borrarlas, para no romper hallazgos históricos que las citan).
 */
export async function actualizarRequisitos14001(usuario: Usuario, actuales: Requisito[]) {
  const nuevos = REQUISITOS_SEED.map((r, orden) => ({ ...r, orden })).filter((r) => r.norma === 'ISO 14001');
  const claves = new Set(nuevos.map((r) => r.clausula));
  const previos = actuales.filter((r) => r.norma === 'ISO 14001');
  const now = ahoraISO();
  const batch = writeBatch(db);
  let agregados = 0, actualizados = 0, retirados = 0;
  nuevos.forEach((n) => {
    const ya = previos.find((p) => p.clausula === n.clausula);
    if (ya) {
      if (ya.titulo !== n.titulo || ya.activo === false) { batch.update(doc(db, COL.requisitos, ya.id), { titulo: n.titulo, activo: true, actualizadoEn: now }); actualizados++; }
    } else {
      batch.set(doc(collection(db, COL.requisitos)), { ...n, activo: true, actualizadoEn: now });
      agregados++;
    }
  });
  previos.filter((p) => !claves.has(p.clausula) && p.activo !== false).forEach((p) => {
    batch.update(doc(db, COL.requisitos, p.id), { activo: false, actualizadoEn: now });
    retirados++;
  });
  registrarBitacora(batch, usuario, {
    entidad: 'sistema', entidadId: 'iso14001-2026', auditoriaId: null, participantes: [], accion: 'editar',
    detalle: `ISO 14001 actualizada a la versión 2026: ${agregados} cláusula(s) nueva(s), ${actualizados} actualizada(s), ${retirados} retirada(s)`,
  });
  await batch.commit();
  return { agregados, actualizados, retirados };
}
