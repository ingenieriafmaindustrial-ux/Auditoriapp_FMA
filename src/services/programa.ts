import { collection, deleteDoc, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ahoraISO } from '../lib/dates';
import { COL, registrarBitacora } from './base';
import type { ProgramaItem, TipoProgramado, Usuario } from '../types';

export type ProgramaForm = Pick<ProgramaItem, 'sucursalId' | 'areaId' | 'fecha' | 'auditorLiderId' | 'equipoIds' | 'notas'> & { tipo: TipoProgramado };

export function validarPrograma(f: ProgramaForm): string[] {
  const e: string[] = [];
  if (!f.sucursalId) e.push('Seleccione la sucursal.');
  if (!f.areaId) e.push('Seleccione el área.');
  if (!f.fecha) e.push('Indique la fecha.');
  if (!f.auditorLiderId) e.push('Seleccione el auditor líder.');
  return e;
}

export async function guardarPrograma(u: Usuario, f: ProgramaForm, existente?: ProgramaItem) {
  const ahora = ahoraISO();
  const datos = { ...f, anio: Number(f.fecha.slice(0, 4)), equipoIds: f.equipoIds.filter((x) => x && x !== f.auditorLiderId), notas: f.notas.trim() };
  if (existente) {
    await updateDoc(doc(db, COL.programa, existente.id), { ...datos, actualizadoEn: ahora });
    return existente.id;
  }
  const ref = doc(collection(db, COL.programa));
  const nuevo: Omit<ProgramaItem, 'id'> = { ...datos, auditoriaId: null, cancelado: false, realizadoEn: null, creadoPor: u.id, creadoEn: ahora, actualizadoEn: ahora };
  await setDoc(ref, nuevo);
  return ref.id;
}

export const cancelarPrograma = (p: ProgramaItem, cancelado: boolean) => updateDoc(doc(db, COL.programa, p.id), { cancelado, actualizadoEn: ahoraISO() });
export const eliminarPrograma = (p: ProgramaItem) => deleteDoc(doc(db, COL.programa, p.id));
export const marcarRealizado = (p: ProgramaItem, fecha: string | null) => updateDoc(doc(db, COL.programa, p.id), { realizadoEn: fecha, actualizadoEn: ahoraISO() });
export const vincularAuditoria = (p: ProgramaItem, auditoriaId: string) => updateDoc(doc(db, COL.programa, p.id), { auditoriaId, actualizadoEn: ahoraISO() });

/** Copia el programa de un año al siguiente (mismo día y mes; sin auditorías vinculadas). */
export async function copiarPrograma(u: Usuario, origen: ProgramaItem[], anioDestino: number) {
  const ahora = ahoraISO();
  const b = writeBatch(db);
  origen
    .filter((p) => !p.cancelado)
    .forEach((p) => {
      const fecha = `${anioDestino}${p.fecha.slice(4)}`.replace(/-02-29$/, '-02-28');
      const nuevo: Omit<ProgramaItem, 'id'> = { tipo: p.tipo ?? 'auditoria', realizadoEn: null, anio: anioDestino, sucursalId: p.sucursalId, areaId: p.areaId, fecha, auditorLiderId: p.auditorLiderId, equipoIds: p.equipoIds, notas: p.notas, auditoriaId: null, cancelado: false, creadoPor: u.id, creadoEn: ahora, actualizadoEn: ahora };
      b.set(doc(collection(db, COL.programa)), nuevo);
    });
  registrarBitacora(b, u, { entidad: 'sistema', entidadId: `programa_${anioDestino}`, auditoriaId: null, participantes: [], accion: 'crear', detalle: `Programa ${anioDestino} copiado del año anterior (${origen.length} auditorías)` });
  await b.commit();
}

/** Crea en lote las mediciones de eficacia propuestas (una por área). */
export async function crearEficaciaLote(
  u: Usuario,
  items: { areaId: string; sucursalId: string; fecha: string; liderId: string; notas: string }[],
) {
  const ahora = ahoraISO();
  for (let i = 0; i < items.length; i += 400) {
    const b = writeBatch(db);
    items.slice(i, i + 400).forEach((x) => {
      const nuevo: Omit<ProgramaItem, 'id'> = { tipo: 'eficacia', anio: Number(x.fecha.slice(0, 4)), sucursalId: x.sucursalId, areaId: x.areaId, fecha: x.fecha, auditorLiderId: x.liderId, equipoIds: [], notas: x.notas, auditoriaId: null, cancelado: false, realizadoEn: null, creadoPor: u.id, creadoEn: ahora, actualizadoEn: ahora };
      b.set(doc(collection(db, COL.programa)), nuevo);
    });
    if (i === 0) registrarBitacora(b, u, { entidad: 'sistema', entidadId: `eficacia_${items[0]?.fecha.slice(0, 4)}`, auditoriaId: null, participantes: [], accion: 'crear', detalle: `Programa de medición de eficacia generado (${items.length} revisiones, lunes y jueves)` });
    await b.commit();
  }
}
