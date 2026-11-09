// Construcción del snapshot del informe (datos congelados al emitir — RN-10).
import { ahoraISO } from '../lib/dates';
import { ultimaVerificacion } from './hallazgoReglas';
import { vincularPlan } from './plan';
import type { Area, Auditor, Auditoria, Evidencia, Hallazgo, InformeSnapshot, Requisito, Sucursal } from '../types';

export function construirSnapshot(
  a: Auditoria,
  hallazgos: Hallazgo[],
  evidencias: Evidencia[],
  m: { sucursales: Record<string, Sucursal>; areas: Record<string, Area>; auditores: Record<string, Auditor>; requisitos: Record<string, Requisito> },
): InformeSnapshot {
  const hs = hallazgos.filter((h) => h.auditoriaId === a.id && !h.anulado).sort((x, y) => x.correlativo - y.correlativo);
  const correlativoPorId = Object.fromEntries(hs.map((h) => [h.id, h.correlativo]));
  const correlativoPorItem = Object.fromEntries(hs.filter((h) => h.checklistItemId).map((h) => [h.checklistItemId!, h.correlativo]));

  return {
    codigo: a.codigo,
    sucursal: m.sucursales[a.sucursalId]?.nombre ?? '',
    objetivos: a.objetivos,
    alcance: a.alcance,
    normas: a.normas,
    auditorLider: m.auditores[a.auditorLiderId]?.nombre ?? '',
    equipo: a.equipoIds.map((id) => m.auditores[id]?.nombre).filter((x): x is string => Boolean(x)),
    area: m.areas[a.areaId]?.nombre ?? '',
    auditados: a.auditadosTexto,
    fechaRealizacion: a.fechaRealizacion,
    totalNC: hs.filter((h) => h.tipo === 'NC').length,
    totalOM: hs.filter((h) => h.tipo === 'OM').length,
    notas: a.notas,
    hallazgos: hs.map((h) => {
      const v = ultimaVerificacion(h);
      return {
        correlativo: h.correlativo,
        tipo: h.tipo,
        requisitos: h.requisitoIds.map((id) => m.requisitos[id]).filter(Boolean).map((r) => `${r.norma} ${r.clausula}`),
        descripcion: h.descripcion,
        correccion: h.correccion,
        causaRaiz: h.analisisCausa?.causaRaiz ?? '',
        acciones: h.cierreSinAccion ? [`Cerrada sin acción: ${h.cierreSinAccion.motivo}`] : h.acciones.map((ac) => `${ac.descripcion} (Resp.: ${ac.responsable}; ${ac.implementada ? 'implementada' : 'compromiso ' + ac.fechaCompromiso})`),
        nivel: h.nivel,
        estado: h.estado,
        verificacionFecha: v?.fecha ?? null,
        verificacionResultado: v?.resultado ?? null,
        verificacionAnalisis: v?.analisis ?? '',
      };
    }),
    evidencias: evidencias
      .filter((e) => e.auditoriaId === a.id)
      .map((e) => ({
        id: e.id,
        descripcion: e.descripcion,
        hallazgoCorrelativo: (e.hallazgoId && correlativoPorId[e.hallazgoId]) || (e.checklistItemId && correlativoPorItem[e.checklistItemId]) || null,
      })),
    aprobaciones: a.aprobaciones ?? [],
    revisiones: a.revisiones ?? [],
    plan: (() => {
      const vinc = vincularPlan(a.plan ?? [], hs, m.requisitos);
      return (a.plan ?? []).map((p) => ({
        titulo: p.titulo,
        estado: vinc.get(p.id)?.estado ?? p.estado,
        origen: p.origen,
        requisitos: p.requisitos.map((k) => k.replace('|', ' ')),
        hallazgos: [...(vinc.get(p.id)?.explicitos ?? []), ...(vinc.get(p.id)?.relacionados ?? [])].map((h) => h.correlativo).sort((x, y) => x - y),
      }));
    })(),
    version: a.informeVersion,
    generadoEn: ahoraISO(),
  };
}
