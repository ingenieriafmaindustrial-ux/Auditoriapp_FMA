import {
  collection,
  doc,
  type DocumentData,
  type DocumentSnapshot,
  type QuerySnapshot,
  type WriteBatch,
  type Transaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ahoraISO } from '../lib/dates';
import type { BitacoraEntry, Usuario } from '../types';

export const COL = {
  config: 'config',
  usuarios: 'usuarios',
  sucursales: 'sucursales',
  areas: 'areas',
  auditores: 'auditores',
  requisitos: 'requisitos',
  contadores: 'contadores',
  auditorias: 'auditorias',
  hallazgos: 'hallazgos',
  evidencias: 'evidencias',
  evidenciasDatos: 'evidenciasDatos',
  bitacora: 'bitacora',
  aprendizaje: 'aprendizaje',
  presencia: 'presencia',
  programa: 'programa',
} as const;

export const colRef = (name: string) => collection(db, name);
export const docRef = (name: string, id: string) => doc(db, name, id);
export const nuevoId = (name: string) => doc(collection(db, name)).id;

export function conId<T>(snap: DocumentSnapshot<DocumentData>): T | null {
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null;
}

export function listaConId<T>(snap: QuerySnapshot<DocumentData>): T[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

/** Quita el campo id antes de guardar. */
export function sinId<T extends { id?: string }>(obj: T): Omit<T, 'id'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _omit, ...rest } = obj;
  return rest;
}

type Escritor = WriteBatch | Transaction;

/** RN-12: agrega un registro de bitácora dentro de la misma escritura atómica. */
export function registrarBitacora(
  w: Escritor,
  usuario: Usuario,
  e: Omit<BitacoraEntry, 'id' | 'usuarioId' | 'usuarioNombre' | 'fecha'>,
) {
  const ref = doc(collection(db, COL.bitacora));
  const data: Omit<BitacoraEntry, 'id'> = {
    ...e,
    usuarioId: usuario.id,
    usuarioNombre: usuario.nombre,
    fecha: ahoraISO(),
  };
  (w as WriteBatch).set(ref, data);
}
