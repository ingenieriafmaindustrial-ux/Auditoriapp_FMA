import { collection, doc, runTransaction, type Transaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ahoraISO } from '../lib/dates';
import { uid } from '../lib/utils';
import { COL, registrarBitacora } from './base';
import { calcularEstado } from '../domain/hallazgoReglas';
import { marcarAprendizajeAnulado } from './aprendizaje';
import type {
  Accion,
  AnalisisCausa,
  Auditoria,
  Hallazgo,
  Nivel,
  Norma,
  PuntoPlanAuditoria,
  Requisito,
  TipoHallazgo,
  Usuario,
  Verificacion,
} from '../types';

export interface HallazgoForm {
  tipo: TipoHallazgo;
  requisitoIds: string[];
  descripcion: string;
  nivel: Nivel;
  fechaDeteccion: string;
  fechaLimite: string | null;
  auditorResponsableId: string | null;
  checklistItemId: string | null;
  planPuntoId?: string | null;
}

const normasDe = (ids: string[], req: Record<string, Requisito>): Norma[] =>
  Array.from(new Set(ids.map((i) => req[i]?.norma).filter((n): n is Norma => Boolean(n))));

/** Crea hallazgo con correlativo dentro de la auditoría y lo vincula al ítem de checklist. */
export async function crearHallazgo(u: Usuario, a: Auditoria, f: HallazgoForm, req: Record<string, Requisito>) {
  const audRef = doc(db, COL.auditorias, a.id);
  const hRef = doc(collection(db, COL.hallazgos));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(audRef);
    const correlativo = ((snap.data()?.contadorHallazgos as number) ?? 0) + 1;
    const now = ahoraISO();
    const base = {
      acciones: [] as Accion[],
      verificaciones: [] as Verificacion[],
      cierreSinAccion: null,
      tipo: f.tipo,
    };
    const data: Omit<Hallazgo, 'id'> = {
      ...f,
      ...base,
      auditoriaId: a.id,
      correlativo,
      anio: a.anio,
      sucursalId: a.sucursalId,
      areaId: a.areaId,
      participantes: a.participantes,
      planPuntoId: f.planPuntoId ?? null,
      normas: normasDe(f.requisitoIds, req),
      correccion: '',
      analisisCausa: { metodo: 'otro', porques: [], causaRaiz: '' },
      estado: calcularEstado(base),
      anulado: false,
      anulacion: null,
      creadoPor: u.id,
      creadoEn: now,
      actualizadoEn: now,
    };
    // Match con el plan: el punto desde el que se levantó queda "con hallazgo"
    const plan = (snap.data()?.plan as PuntoPlanAuditoria[] | undefined) ?? [];
    const planActualizado = f.planPuntoId
      ? plan.map((p) => (p.id === f.planPuntoId ? { ...p, estado: 'hallazgo' as const, hallazgoIds: [...new Set([...p.hallazgoIds, hRef.id])], revisadoPor: u.id } : p))
      : null;
    tx.update(audRef, { contadorHallazgos: correlativo, ...(planActualizado ? { plan: planActualizado } : {}), actualizadoEn: now });
    tx.set(hRef, data);
    if (f.checklistItemId) {
      tx.update(doc(db, COL.auditorias, a.id, 'checklist', f.checklistItemId), { hallazgoId: hRef.id, actualizadoEn: now });
    }
    registrarBitacora(tx, u, {
      entidad: 'hallazgo',
      entidadId: hRef.id,
      auditoriaId: a.id,
      participantes: a.participantes,
      accion: 'crear',
      detalle: `Hallazgo #${correlativo} (${f.tipo}, ${f.nivel}) creado`,
    });
  });
  return hRef.id;
}

/**
 * Lee-modifica-escribe en transacción: evita pisar cambios de otro auditor
 * y recalcula el estado derivado en la misma escritura.
 */
async function mutarHallazgo(
  u: Usuario,
  hallazgoId: string,
  detalle: string,
  mutar: (h: Hallazgo, tx: Transaction) => Partial<Hallazgo>,
  accionBitacora: 'editar' | 'cambio_estado' | 'anular' = 'editar',
) {
  const ref = doc(db, COL.hallazgos, hallazgoId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('El hallazgo no existe.');
    const h = { id: snap.id, ...snap.data() } as Hallazgo;
    const cambios = mutar(h, tx);
    const merged = { ...h, ...cambios };
    const estado = calcularEstado(merged);
    tx.update(ref, { ...cambios, estado, actualizadoEn: ahoraISO(), actualizadoPor: u.id });
    registrarBitacora(tx, u, {
      entidad: 'hallazgo',
      entidadId: h.id,
      auditoriaId: h.auditoriaId,
      participantes: h.participantes,
      accion: estado !== h.estado ? 'cambio_estado' : accionBitacora,
      detalle: `#${h.correlativo}: ${detalle}${estado !== h.estado ? ` · estado ${h.estado} → ${estado}` : ''}`,
    });
  });
}

/** Cambios guardados por otro integrante mientras este usuario editaba el mismo hallazgo. */
export class ConflictoHallazgo extends Error {}

/** `base` = actualizadoEn que tenía el hallazgo al abrir el editor: si cambió, no se pisa el trabajo del otro auditor. */
export function actualizarDatosHallazgo(u: Usuario, id: string, f: Omit<HallazgoForm, 'checklistItemId'>, req: Record<string, Requisito>, base?: string) {
  return mutarHallazgo(u, id, 'datos del hallazgo actualizados', (h) => {
    if (base && h.actualizadoEn !== base)
      throw new ConflictoHallazgo(`Otro integrante del equipo guardó cambios en el hallazgo #${h.correlativo} mientras lo editabas. Copia tu texto, cancela para ver su versión y vuelve a aplicar tus cambios.`);
    return {
    ...f,
    normas: normasDe(f.requisitoIds, req),
    };
  });
}

export function guardarTratamiento(u: Usuario, id: string, correccion: string, analisisCausa: AnalisisCausa) {
  return mutarHallazgo(u, id, 'corrección / análisis de causa actualizados', () => ({ correccion, analisisCausa }));
}

export function guardarAccion(u: Usuario, id: string, accion: Omit<Accion, 'id' | 'creadoEn' | 'creadoPor'> & { id?: string }) {
  return mutarHallazgo(u, id, accion.id ? 'acción actualizada' : 'acción agregada', (h) => {
    if (accion.id) {
      return {
        acciones: h.acciones.map((a) => (a.id === accion.id ? { ...a, ...accion, id: a.id } : a)),
      };
    }
    const nueva: Accion = { ...accion, id: uid(), creadoEn: ahoraISO(), creadoPor: u.id };
    return { acciones: [...h.acciones, nueva] };
  });
}

export function eliminarAccion(u: Usuario, id: string, accionId: string) {
  return mutarHallazgo(u, id, 'acción eliminada', (h) => {
    if (h.verificaciones.length) throw new Error('No se pueden eliminar acciones de un hallazgo ya verificado.');
    return { acciones: h.acciones.filter((a) => a.id !== accionId) };
  });
}

export function agregarVerificacion(u: Usuario, id: string, v: Omit<Verificacion, 'id' | 'creadoEn' | 'creadoPor'>) {
  return mutarHallazgo(u, id, `verificación de eficacia: ${v.resultado === 'eficaz' ? 'EFICAZ' : 'NO EFICAZ'}`, (h) => ({
    verificaciones: [...h.verificaciones, { ...v, id: uid(), creadoEn: ahoraISO(), creadoPor: u.id }],
  }));
}

/** P2: OM puede cerrarse sin acción, con justificación. */
export function cerrarOMSinAccion(u: Usuario, id: string, motivo: string) {
  return mutarHallazgo(u, id, `OM cerrada sin acción · ${motivo}`, (h) => {
    if (h.tipo !== 'OM') throw new Error('Solo las OM pueden cerrarse sin acción.');
    return { cierreSinAccion: { motivo, usuarioId: u.id, usuarioNombre: u.nombre, fecha: ahoraISO() } };
  });
}

export function reabrirOM(u: Usuario, id: string) {
  return mutarHallazgo(u, id, 'OM reabierta', () => ({ cierreSinAccion: null }));
}

export async function anularHallazgo(u: Usuario, id: string, motivo: string) {
  const r = await mutarHallazgo(
    u,
    id,
    `anulado · ${motivo}`,
    () => ({ anulado: true, anulacion: { motivo, usuarioId: u.id, usuarioNombre: u.nombre, fecha: ahoraISO() } }),
    'anular',
  );
  // El asistente deja de aprender de un hallazgo anulado
  marcarAprendizajeAnulado(u, id).catch(() => undefined);
  return r;
}

/**
 * Elimina un hallazgo (duplicado o levantado por error) mientras la auditoría esté abierta y sin informe emitido.
 * Borra sus evidencias y el aprendizaje del asistente, lo quita del plan y renumera los hallazgos siguientes.
 * Con informe emitido no se elimina: se anula (queda la trazabilidad).
 */
export async function eliminarHallazgo(u: Usuario, h: Hallazgo, evidenciaIds: string[], hermanos: Hallazgo[]) {
  const audRef = doc(db, COL.auditorias, h.auditoriaId);
  await runTransaction(db, async (tx) => {
    const aSnap = await tx.get(audRef);
    if (!aSnap.exists()) throw new Error('La auditoría no existe.');
    const a = { id: aSnap.id, ...aSnap.data() } as Auditoria;
    if ((a.informeVersion ?? 0) > 0) throw new Error('La auditoría ya tiene informe emitido: el hallazgo no se elimina, se anula.');
    if (!['planificada', 'en_ejecucion', 'en_revision'].includes(a.estado)) throw new Error('La auditoría no está abierta: el hallazgo no se puede eliminar.');
    const hSnap = await tx.get(doc(db, COL.hallazgos, h.id));
    if (!hSnap.exists()) throw new Error('El hallazgo ya no existe.');
    // Hallazgos posteriores de la misma auditoría: se renumeran para no dejar saltos (#1, #2, #3…)
    const posteriores = (
      await Promise.all(hermanos.filter((x) => x.id !== h.id && x.auditoriaId === h.auditoriaId).map((x) => tx.get(doc(db, COL.hallazgos, x.id))))
    ).filter((d) => d.exists() && (d.data().correlativo as number) > h.correlativo);
    const now = ahoraISO();
    const plan = (a.plan ?? []).map((p) =>
      p.hallazgoIds.includes(h.id) || h.planPuntoId === p.id
        ? { ...p, hallazgoIds: p.hallazgoIds.filter((x) => x !== h.id), estado: p.estado === 'hallazgo' && p.hallazgoIds.filter((x) => x !== h.id).length === 0 ? ('pendiente' as const) : p.estado }
        : p,
    );
    tx.delete(doc(db, COL.hallazgos, h.id));
    evidenciaIds.forEach((id) => {
      tx.delete(doc(db, COL.evidencias, id));
      tx.delete(doc(db, COL.evidenciasDatos, id));
    });
    tx.delete(doc(db, COL.aprendizaje, h.id));
    if (h.checklistItemId) tx.update(doc(db, COL.auditorias, a.id, 'checklist', h.checklistItemId), { hallazgoId: null, actualizadoEn: now });
    posteriores.forEach((d) => tx.update(d.ref, { correlativo: (d.data()?.correlativo as number) - 1, actualizadoEn: now }));
    tx.update(audRef, { plan, contadorHallazgos: Math.max(0, (a.contadorHallazgos ?? 0) - 1), actualizadoEn: now });
    registrarBitacora(tx, u, {
      entidad: 'hallazgo',
      entidadId: h.id,
      auditoriaId: a.id,
      participantes: a.participantes,
      accion: 'eliminar',
      detalle: `Hallazgo #${h.correlativo} (${h.tipo}) eliminado: «${h.descripcion.replace(/\s+/g, ' ').slice(0, 80)}»`,
    });
  });
}

/** Hallazgo histórico importado: vuelve al seguimiento normal (el estado se recalcula y entra en alertas). */
export function reactivarSeguimiento(u: Usuario, h: Hallazgo) {
  return mutarHallazgo(u, h.id, 'seguimiento reactivado (hallazgo histórico)', () => ({ historico: false }));
}
