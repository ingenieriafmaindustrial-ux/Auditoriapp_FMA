// Persistencia del plan de auditoría (plantilla por área y plan de cada auditoría).
import { doc, runTransaction, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ahoraISO } from '../lib/dates';
import { COL, registrarBitacora } from './base';
import { planSeedParaArea } from '../data/planesSeed';
import type { Area, Auditoria, PuntoPlan, PuntoPlanAuditoria, Usuario } from '../types';

/**
 * Cambia el plan de una auditoría leyendo la versión vigente en una transacción:
 * dos auditores pueden marcar puntos distintos al mismo tiempo sin pisarse. Queda en la bitácora.
 */
export async function mutarPlanAuditoria(u: Usuario, a: Auditoria, cambiar: (actual: PuntoPlanAuditoria[]) => PuntoPlanAuditoria[], detalle: string) {
  const ref = doc(db, COL.auditorias, a.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('La auditoría no existe.');
    const actual = (snap.data().plan as PuntoPlanAuditoria[] | undefined) ?? [];
    tx.update(ref, { plan: cambiar(actual), actualizadoEn: ahoraISO() });
    registrarBitacora(tx, u, { entidad: 'auditoria', entidadId: a.id, auditoriaId: a.id, participantes: a.participantes, accion: 'editar', detalle: `Plan: ${detalle}` });
  });
}

export async function guardarPlanArea(areaId: string, plan: PuntoPlan[]) {
  await updateDoc(doc(db, COL.areas, areaId), { plan });
}

/** Carga (o reemplaza, si reemplazar = true) la plantilla de cada área con los puntos textuales de los planes FMA 2026. */
export async function cargarPlanesFMA(u: Usuario, areas: Area[], reemplazar = false) {
  const b = writeBatch(db);
  const cargadas: string[] = [];
  areas.forEach((a) => {
    if (a.plan?.length && !reemplazar) return;
    const plan = planSeedParaArea(a.nombre);
    if (!plan) return;
    b.update(doc(db, COL.areas, a.id), { plan });
    cargadas.push(a.nombre);
  });
  if (!cargadas.length) return cargadas;
  registrarBitacora(b, u, { entidad: 'catalogo', entidadId: 'planes', auditoriaId: null, participantes: [], accion: 'editar', detalle: `Planes de auditoría FMA 2026 cargados en: ${cargadas.join(', ')}` });
  await b.commit();
  return cargadas;
}

/** Deja en la bitácora quién descargó el plan en PDF, con qué equipo y fecha. */
export async function registrarDescargaPlanPdf(u: Usuario, a: Auditoria, equipo: string[], fecha: string) {
  const b = writeBatch(db);
  registrarBitacora(b, u, { entidad: 'auditoria', entidadId: a.id, auditoriaId: a.id, participantes: a.participantes, accion: 'editar', detalle: `Plan (PDF) descargado · equipo: ${equipo.join(', ')} · fecha: ${fecha}` });
  await b.commit();
}
