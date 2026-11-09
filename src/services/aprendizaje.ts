// Autoaprendizaje compartido del asistente: cada hallazgo guardado (por cualquier auditor) enseña al motor.
// Privacidad: se guardan solo raíces de palabras y cláusulas elegidas, nunca el texto del hallazgo.
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ahoraISO } from '../lib/dates';
import { COL } from './base';
import { terminosParaAprender } from '../domain/asistente/texto';
import type { DocAprendido } from '../domain/asistente/motor';
import type { Area, Hallazgo, Requisito, Sucursal, Usuario } from '../types';

export interface DatosAprendizaje {
  hallazgoId: string;
  auditoriaId: string;
  descripcion: string;
  tipo: 'NC' | 'OM';
  requisitoIds: string[];
  anio: number;
  area: string;
  sucursal: string;
  /** Cláusulas que el asistente mostró con confianza media/alta al guardar. */
  sugeridas: string[];
}

const claveReq = (r: Requisito) => `${r.norma}|${r.clausula}`;

function construir(u: Usuario, d: DatosAprendizaje, req: Record<string, Requisito>) {
  const clausulas = d.requisitoIds.map((id) => req[id]).filter(Boolean).map(claveReq);
  return {
    terminos: terminosParaAprender(d.descripcion),
    clausulas,
    rechazadas: d.sugeridas.filter((c) => !clausulas.includes(c)).slice(0, 10),
    tipo: d.tipo,
    area: d.area,
    sucursal: d.sucursal,
    anio: d.anio,
    auditoriaId: d.auditoriaId,
    anulado: false,
    autorId: u.id,
    actualizadoEn: ahoraISO(),
  };
}

/** Se llama al guardar un hallazgo. No bloquea: si falla, el hallazgo igual queda guardado. */
export async function registrarAprendizaje(u: Usuario, d: DatosAprendizaje, req: Record<string, Requisito>) {
  const data = construir(u, d, req);
  if (data.terminos.length < 2) return;
  await setDoc(doc(db, COL.aprendizaje, d.hallazgoId), data);
}

export async function marcarAprendizajeAnulado(u: Usuario, hallazgoId: string) {
  await updateDoc(doc(db, COL.aprendizaje, hallazgoId), { anulado: true, autorId: u.id, actualizadoEn: ahoraISO() });
}

/** Entrena con los hallazgos ya existentes en la app (una vez, o cuando se quiera). */
export async function reentrenarAsistente(
  u: Usuario,
  hallazgos: Hallazgo[],
  mapas: { areas: Record<string, Area>; sucursales: Record<string, Sucursal>; requisitos: Record<string, Requisito> },
) {
  const validos = hallazgos.filter((h) => !h.anulado && h.descripcion?.trim());
  let n = 0;
  for (let i = 0; i < validos.length; i += 400) {
    const b = writeBatch(db);
    validos.slice(i, i + 400).forEach((h) => {
      const data = construir(
        u,
        {
          hallazgoId: h.id, auditoriaId: h.auditoriaId, descripcion: h.descripcion, tipo: h.tipo, requisitoIds: h.requisitoIds, anio: h.anio,
          area: mapas.areas[h.areaId]?.nombre ?? '', sucursal: mapas.sucursales[h.sucursalId]?.nombre ?? '', sugeridas: [],
        },
        mapas.requisitos,
      );
      if (data.terminos.length < 2) return;
      b.set(doc(db, COL.aprendizaje, h.id), data);
      n++;
    });
    await b.commit();
  }
  return n;
}

// ── Suscripción compartida (una sola escucha aunque haya varios editores abiertos) ──
let cache: DocAprendido[] = [];
let oyentes = new Set<(d: DocAprendido[]) => void>();
let cancelar: (() => void) | null = null;

export function useAprendizaje(): DocAprendido[] {
  const [datos, setDatos] = useState<DocAprendido[]>(cache);
  useEffect(() => {
    oyentes.add(setDatos);
    if (!cancelar) {
      cancelar = onSnapshot(
        collection(db, COL.aprendizaje),
        (snap) => {
          cache = snap.docs.map((x) => ({ id: x.id, ...(x.data() as Omit<DocAprendido, 'id'>) }));
          oyentes.forEach((f) => f(cache));
        },
        (err) => console.warn('[aprendizaje]', err.message),
      );
    }
    return () => {
      oyentes.delete(setDatos);
      if (!oyentes.size && cancelar) {
        cancelar();
        cancelar = null;
        oyentes = new Set();
      }
    };
  }, []);
  return datos;
}
