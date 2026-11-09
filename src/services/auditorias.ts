import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ahoraISO, hoyISO, sumarDias } from '../lib/dates';
import { PLAZO_SEGUIMIENTO_DIAS } from '../lib/constants';
import { uid } from '../lib/utils';
import { COL, registrarBitacora } from './base';
import { codigoAuditoria, participantesDe, type AuditoriaForm } from '../domain/auditoriaReglas';
import type {
  AgendaItem,
  Aprobacion,
  Auditoria,
  ChecklistItem,
  EstadoAuditoria,
  InformeSnapshot,
  PuntoPlanAuditoria,
  RegistroMotivo,
  RevisionDoc,
  Usuario,
} from '../types';

const revision = (u: Usuario, tipo: RevisionDoc['tipo'], comentario: string, version: number | null = null): RevisionDoc => ({
  id: uid(),
  tipo,
  usuarioId: u.id,
  usuarioNombre: u.nombre,
  fecha: ahoraISO(),
  comentario,
  version,
});

const registro = (u: Usuario, motivo: string): RegistroMotivo => ({
  motivo,
  usuarioId: u.id,
  usuarioNombre: u.nombre,
  fecha: ahoraISO(),
});

/** RN-01: correlativo por año con transacción (nunca se repite). */
export async function crearAuditoria(u: Usuario, f: AuditoriaForm, motivoIndependencia: string | null, plan: PuntoPlanAuditoria[] = []) {
  const contadorRef = doc(db, COL.contadores, `auditorias_${f.anio}`);
  const audRef = doc(collection(db, COL.auditorias));
  await runTransaction(db, async (tx) => {
    const c = await tx.get(contadorRef);
    const numero = (c.exists() ? (c.data().ultimoNumero as number) : 0) + 1;
    tx.set(contadorRef, { ultimoNumero: numero, anio: f.anio });
    const now = ahoraISO();
    const data: Omit<Auditoria, 'id'> = {
      ...f,
      numero,
      codigo: codigoAuditoria(numero, f.anio),
      participantes: participantesDe(f.auditorLiderId, f.equipoIds),
      agenda: [],
      estado: 'planificada',
      notas: '',
      aprobaciones: [],
      contadorHallazgos: 0,
      informeVersion: 0,
      independenciaForzada: motivoIndependencia ? registro(u, motivoIndependencia) : null,
      anulacion: null,
      reaperturas: [],
      plan,
      creadoPor: u.id,
      creadoEn: now,
      actualizadoEn: now,
    };
    tx.set(audRef, data);
    registrarBitacora(tx, u, {
      entidad: 'auditoria',
      entidadId: audRef.id,
      auditoriaId: audRef.id,
      participantes: data.participantes,
      accion: 'crear',
      detalle: `Auditoría ${data.codigo} creada${motivoIndependencia ? ' (independencia forzada: ' + motivoIndependencia + ')' : ''}`,
    });
  });
  return audRef.id;
}

/** Edita la auditoría. Si cambia el equipo, sincroniza "participantes" en hallazgos y evidencias. */
export async function actualizarAuditoria(u: Usuario, a: Auditoria, f: AuditoriaForm, motivoIndependencia: string | null) {
  const participantes = participantesDe(f.auditorLiderId, f.equipoIds);
  const cambioEquipo = participantes.slice().sort().join() !== a.participantes.slice().sort().join();
  const batch = writeBatch(db);
  const { anio: _anio, ...resto } = f; // el año no cambia (define el correlativo)
  void _anio;
  batch.update(doc(db, COL.auditorias, a.id), {
    ...resto,
    participantes,
    independenciaForzada: motivoIndependencia ? registro(u, motivoIndependencia) : a.independenciaForzada,
    actualizadoEn: ahoraISO(),
  });
  if (cambioEquipo) {
    for (const col of [COL.hallazgos, COL.evidencias, COL.evidenciasDatos]) {
      const snap = await getDocs(query(collection(db, col), where('auditoriaId', '==', a.id)));
      snap.docs.forEach((d) => batch.update(d.ref, { participantes }));
    }
  }
  registrarBitacora(batch, u, {
    entidad: 'auditoria',
    entidadId: a.id,
    auditoriaId: a.id,
    participantes,
    accion: 'editar',
    detalle: `Datos generales actualizados${cambioEquipo ? ' (cambio de equipo)' : ''}`,
  });
  await batch.commit();
}

export async function cambiarEstadoAuditoria(u: Usuario, a: Auditoria, hacia: EstadoAuditoria, motivo?: string) {
  const batch = writeBatch(db);
  const cambios: Partial<Auditoria> = { estado: hacia, actualizadoEn: ahoraISO() };
  if (hacia === 'anulada') cambios.anulacion = registro(u, motivo ?? '');
  if (a.estado === 'cerrada' && hacia === 'en_revision') cambios.reaperturas = [...(a.reaperturas ?? []), registro(u, motivo ?? '')];
  if (a.estado === 'cerrada' && hacia === 'en_revision') cambios.revisiones = [...(a.revisiones ?? []), revision(u, 'reapertura', motivo ?? '')];
  if (hacia === 'en_ejecucion' && !a.fechaRealizacion) cambios.fechaRealizacion = ahoraISO().slice(0, 10);
  batch.update(doc(db, COL.auditorias, a.id), cambios);
  registrarBitacora(batch, u, {
    entidad: 'auditoria',
    entidadId: a.id,
    auditoriaId: a.id,
    participantes: a.participantes,
    accion: hacia === 'anulada' ? 'anular' : a.estado === 'cerrada' ? 'reabrir' : 'cambio_estado',
    detalle: `${a.estado} → ${hacia}${motivo ? ` · Motivo: ${motivo}` : ''}`,
  });
  await batch.commit();
}

export async function guardarAgenda(a: Auditoria, agenda: AgendaItem[]) {
  await updateDoc(doc(db, COL.auditorias, a.id), { agenda, actualizadoEn: ahoraISO() });
}

/** Otro auditor guardó las notas mientras este usuario escribía. */
export class ConflictoNotas extends Error {
  constructor(readonly actual: string, readonly porUid: string | null) {
    super('Otro integrante del equipo guardó cambios en las notas mientras escribías.');
  }
}

/**
 * Guarda las notas del informe. `base` = texto que había cuando el usuario empezó a escribir:
 * si en la base de datos cambió desde entonces (otro auditor), no se pisa y se lanza ConflictoNotas.
 */
export async function guardarNotas(u: Usuario, a: Auditoria, notas: string, base: string | null) {
  const ref = doc(db, COL.auditorias, a.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const actual = (snap.data()?.notas as string | undefined) ?? '';
    if (base !== null && actual !== base && actual !== notas) throw new ConflictoNotas(actual, (snap.data()?.notasActualizadasPor as string | undefined) ?? null);
    const now = ahoraISO();
    tx.update(ref, { notas, notasActualizadasPor: u.id, notasActualizadasEn: now, actualizadoEn: now });
    registrarBitacora(tx, u, { entidad: 'auditoria', entidadId: a.id, auditoriaId: a.id, participantes: a.participantes, accion: 'editar', detalle: `Notas del informe actualizadas (${notas.trim().length} caracteres)` });
  });
}

export async function guardarAprobaciones(a: Auditoria, aprobaciones: Aprobacion[]) {
  await updateDoc(doc(db, COL.auditorias, a.id), { aprobaciones, actualizadoEn: ahoraISO() });
}

// ---------------- Checklist ----------------
const checklistCol = (auditoriaId: string) => collection(db, COL.auditorias, auditoriaId, 'checklist');

export async function agregarItemsChecklist(
  a: Auditoria,
  items: Pick<ChecklistItem, 'pregunta' | 'requisitoIds'>[],
  ordenInicial: number,
) {
  const batch = writeBatch(db);
  items.forEach((it, i) => {
    const data: Omit<ChecklistItem, 'id'> = {
      ...it,
      orden: ordenInicial + i,
      resultado: 'pendiente',
      evidenciaObservada: '',
      auditorId: null,
      hallazgoId: null,
      actualizadoEn: ahoraISO(),
    };
    batch.set(doc(checklistCol(a.id)), data);
  });
  await batch.commit();
}

export async function actualizarItemChecklist(auditoriaId: string, itemId: string, cambios: Partial<Omit<ChecklistItem, 'id'>>) {
  await updateDoc(doc(checklistCol(auditoriaId), itemId), { ...cambios, actualizadoEn: ahoraISO() });
}

export async function eliminarItemChecklist(auditoriaId: string, itemId: string) {
  await deleteDoc(doc(checklistCol(auditoriaId), itemId));
}

// ---------------- Informe ----------------
/** RN-10: emitir congela un snapshot inmutable. La primera emisión cierra la auditoría. */
export async function emitirInforme(u: Usuario, a: Auditoria, snapshot: InformeSnapshot, comentario: string) {
  const audRef = doc(db, COL.auditorias, a.id);
  const version = await runTransaction(db, async (tx) => {
    const fresh = await tx.get(audRef);
    if (!fresh.exists()) throw new Error('La auditoría no existe.');
    const actual = fresh.data() as Omit<Auditoria, 'id'>;
    const version = (actual.informeVersion ?? 0) + 1;
    const infRef = doc(db, COL.auditorias, a.id, 'informes', `v${version}`);
    tx.set(infRef, {
      version,
      snapshot: { ...snapshot, version, revisiones: [...(actual.revisiones ?? []), revision(u, 'emision', comentario || 'Informe aprobado y emitido', version)] },
      emitidoPor: u.id,
      emitidoPorNombre: u.nombre,
      emitidoEn: ahoraISO(),
      comentario,
    });
    const estado: EstadoAuditoria = actual.estado === 'en_revision' ? 'cerrada' : actual.estado;
    const revs = [...(actual.revisiones ?? []), revision(u, 'emision', comentario || 'Informe aprobado y emitido', version)];
    tx.update(audRef, { informeVersion: version, estado, revisiones: revs, actualizadoEn: ahoraISO() });
    registrarBitacora(tx, u, {
      entidad: 'auditoria',
      entidadId: a.id,
      auditoriaId: a.id,
      participantes: a.participantes,
      accion: 'emitir_informe',
      detalle: `Informe versión ${version} emitido${estado === 'cerrada' && actual.estado !== 'cerrada' ? ' · auditoría cerrada' : ''}${comentario ? ' · ' + comentario : ''}`,
    });
    return version;
  });
  // Primera emisión: deja registrado el plazo (auditoría + 3 semanas) en las NC que aún no lo tienen
  if (version === 1) await fijarPlazoSeguimiento(u, a, true).catch((e) => console.warn('[plazo]', e));
  return version;
}

/**
 * Fija fecha límite = fecha de la auditoría (detección) + PLAZO_SEGUIMIENTO_DIAS a las NC vigentes de la auditoría.
 * soloSinFecha: no pisa plazos ya definidos a mano.
 */
export async function fijarPlazoSeguimiento(u: Usuario, a: Auditoria, soloSinFecha: boolean) {
  const base = (a.fechaRealizacion ?? a.fechaPlanificada).slice(0, 10);
  const snap = await getDocs(query(collection(db, COL.hallazgos), where('auditoriaId', '==', a.id)));
  const ncs = snap.docs.filter((d) => d.data().tipo === 'NC' && !d.data().anulado && (!soloSinFecha || !d.data().fechaLimite));
  if (!ncs.length) return 0;
  const b = writeBatch(db);
  ncs.forEach((d) => b.update(d.ref, { fechaLimite: sumarDias(((d.data().fechaDeteccion as string | undefined) ?? base).slice(0, 10), PLAZO_SEGUIMIENTO_DIAS), actualizadoEn: ahoraISO() }));
  registrarBitacora(b, u, { entidad: 'auditoria', entidadId: a.id, auditoriaId: a.id, participantes: a.participantes, accion: 'editar', detalle: `Plazo de seguimiento fijado (auditoría + ${PLAZO_SEGUIMIENTO_DIAS} días) para ${ncs.length} NC` });
  await b.commit();
  return ncs.length;
}

// ---------------- Flujo de revisión ----------------
/** Comenzar la auditoría (planificada → en curso). */
export async function comenzarAuditoria(u: Usuario, a: Auditoria) {
  const batch = writeBatch(db);
  batch.update(doc(db, COL.auditorias, a.id), { estado: 'en_ejecucion', fechaRealizacion: a.fechaRealizacion ?? hoyISO(), actualizadoEn: ahoraISO() });
  registrarBitacora(batch, u, { entidad: 'auditoria', entidadId: a.id, auditoriaId: a.id, participantes: a.participantes, accion: 'cambio_estado', detalle: 'Auditoría comenzada' });
  await batch.commit();
}

/** Guardar y enviar al auditor líder para revisión. */
export async function enviarARevision(u: Usuario, a: Auditoria, comentario: string) {
  const batch = writeBatch(db);
  batch.update(doc(db, COL.auditorias, a.id), {
    estado: 'en_revision',
    fechaRealizacion: a.fechaRealizacion ?? hoyISO(),
    revisiones: [...(a.revisiones ?? []), revision(u, 'envio', comentario || 'Enviada al auditor líder para revisión')],
    actualizadoEn: ahoraISO(),
  });
  registrarBitacora(batch, u, { entidad: 'auditoria', entidadId: a.id, auditoriaId: a.id, participantes: a.participantes, accion: 'cambio_estado', detalle: `Enviada a revisión del auditor líder${comentario ? ' · ' + comentario : ''}` });
  await batch.commit();
}

/** El líder devuelve la auditoría con observaciones (en revisión → en curso). */
export async function devolverConObservaciones(u: Usuario, a: Auditoria, observaciones: string) {
  const batch = writeBatch(db);
  batch.update(doc(db, COL.auditorias, a.id), {
    estado: 'en_ejecucion',
    revisiones: [...(a.revisiones ?? []), revision(u, 'observacion', observaciones)],
    actualizadoEn: ahoraISO(),
  });
  registrarBitacora(batch, u, { entidad: 'auditoria', entidadId: a.id, auditoriaId: a.id, participantes: a.participantes, accion: 'cambio_estado', detalle: `Devuelta con observaciones · ${observaciones}` });
  await batch.commit();
}

/**
 * Eliminar auditoría (solo auditor líder y solo si no tiene informe emitido).
 * Borra hallazgos, evidencias y checklist asociados. Con informe emitido corresponde ANULAR (trazabilidad ISO 7.5).
 */
export async function eliminarAuditoria(u: Usuario, a: Auditoria) {
  const refs: ReturnType<typeof doc>[] = [];
  for (const col of [COL.hallazgos, COL.evidencias, COL.evidenciasDatos, COL.aprendizaje]) {
    const snap = await getDocs(query(collection(db, col), where('auditoriaId', '==', a.id)));
    snap.docs.forEach((d) => refs.push(d.ref));
  }
  for (const sub of ['checklist', 'informes']) {
    const s = await getDocs(collection(db, COL.auditorias, a.id, sub));
    s.docs.forEach((d) => refs.push(d.ref));
  }
  for (let i = 0; i < refs.length; i += 400) {
    const b = writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => b.delete(r));
    await b.commit();
  }
  const batch = writeBatch(db);
  batch.delete(doc(db, COL.auditorias, a.id));
  registrarBitacora(batch, u, { entidad: 'auditoria', entidadId: a.id, auditoriaId: null, participantes: [], accion: 'eliminar', detalle: `Auditoría ${a.codigo} eliminada (estado ${a.estado}, informe v${a.informeVersion}, ${refs.length} registros asociados)` });
  await batch.commit();
}
