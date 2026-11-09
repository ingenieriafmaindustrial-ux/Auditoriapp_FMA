// Plan de auditoría: plantilla por área → foto en la auditoría → match con hallazgos → cobertura.
import type { Area, Auditoria, EstadoPunto, GrupoPlan, Hallazgo, PuntoPlan, PuntoPlanAuditoria, Requisito } from '../types';

export const GRUPOS_PLAN: Record<GrupoPlan, string> = {
  sistema: 'Sistema de gestión',
  operacion: 'Procedimientos y operación',
  sst_ambiente: 'Seguridad, salud y medio ambiente',
  seguimiento: 'Seguimiento y mejora',
};

export const ESTADOS_PUNTO: Record<EstadoPunto, string> = {
  pendiente: 'Pendiente',
  conforme: 'Conforme',
  hallazgo: 'Con hallazgo',
  no_aplica: 'No aplica',
};

export const ORIGEN_PUNTO: Record<PuntoPlanAuditoria['origen'], string> = {
  plan: 'Plan del área',
  nc_anterior: 'NC anterior',
  recurrente: 'Tema recurrente',
  manual: 'Agregado',
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const claveRequisito = (r: Pick<Requisito, 'norma' | 'clausula'>) => `${r.norma}|${r.clausula}`;
export const nuevoIdPunto = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/**
 * Construye el plan de una auditoría nueva:
 *  1) puntos de la plantilla del área,
 *  2) al final, NC abiertas de auditorías anteriores del área (verificar eficacia).
 *  Los puntos del plan se copian textuales y en el mismo orden del documento del área.
 */
export function construirPlanAuditoria(p: {
  area: Area | undefined;
  hallazgosArea: Hallazgo[];
  codigos: Record<string, string>;
  requisitos: Record<string, Requisito>;
}): PuntoPlanAuditoria[] {
  const base = (x: PuntoPlan, origen: PuntoPlanAuditoria['origen']): PuntoPlanAuditoria => ({ ...x, origen, estado: 'pendiente', hallazgoIds: [], hallazgoOrigenId: null, revisadoPor: null });
  const plan: PuntoPlanAuditoria[] = (p.area?.plan ?? []).map((x) => base(x, 'plan'));

  p.hallazgosArea
    .filter((h) => h.tipo === 'NC' && !h.anulado && h.estado !== 'tratada')
    .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))
    .slice(0, 8)
    .forEach((h) => {
      plan.push({
        ...base(
          {
            id: `nc-${h.id}`,
            titulo: `Verificar eficacia NC ${p.codigos[h.auditoriaId] ?? ''} #${h.correlativo}: ${h.descripcion.replace(/\s+/g, ' ').slice(0, 90)}${h.descripcion.length > 90 ? '…' : ''}`,
            grupo: 'seguimiento',
            requisitos: h.requisitoIds.map((id) => p.requisitos[id]).filter(Boolean).map(claveRequisito),
            referencia: null,
          },
          'nc_anterior',
        ),
        hallazgoOrigenId: h.id,
      });
    });

  return plan;
}

export interface VinculoPunto {
  explicitos: Hallazgo[];
  relacionados: Hallazgo[];
  estado: EstadoPunto;
}

/** Match plan ↔ hallazgos: explícito (creado desde el punto) o relacionado (misma cláusula o mismo PGI citado). */
export function vincularPlan(plan: PuntoPlanAuditoria[], hallazgos: Hallazgo[], requisitos: Record<string, Requisito>): Map<string, VinculoPunto> {
  const activos = hallazgos.filter((h) => !h.anulado);
  const clavesH = new Map(activos.map((h) => [h.id, new Set(h.requisitoIds.map((id) => requisitos[id]).filter(Boolean).map(claveRequisito))]));
  const textoH = new Map(activos.map((h) => [h.id, norm(h.descripcion)]));
  const mapa = new Map<string, VinculoPunto>();
  for (const p of plan) {
    const explicitos = activos.filter((h) => h.planPuntoId === p.id || p.hallazgoIds.includes(h.id));
    // Referencias "PGI-21, PGI-15" → variantes "pgi 21" / "pgi 021"… buscadas como palabra completa en el hallazgo
    const refs = (p.referencia ?? '').split(/[,;]/).map((r) => norm(r)).filter(Boolean).flatMap((r) => [r, r.replace(/ 0(\d)$/, ' $1')]);
    const relacionados = activos.filter((h) => {
      if (explicitos.includes(h) || h.planPuntoId) return false;
      const texto = ` ${textoH.get(h.id)!} `;
      const porRef = refs.some((r) => texto.includes(` ${r} `));
      // Los puntos de seguimiento genérico (10.2 / 10.3) no se relacionan por cláusula: calzarían con todo
      const generico = p.grupo === 'seguimiento' && p.origen === 'plan';
      const porClausula = !generico && p.requisitos.some((k) => clavesH.get(h.id)!.has(k));
      return porRef || porClausula;
    });
    const estado: EstadoPunto = p.estado !== 'pendiente' ? p.estado : explicitos.length ? 'hallazgo' : 'pendiente';
    mapa.set(p.id, { explicitos, relacionados, estado });
  }
  return mapa;
}

export function resumenPlan(plan: PuntoPlanAuditoria[], vinculos: Map<string, VinculoPunto>) {
  const estados = plan.map((p) => vinculos.get(p.id)?.estado ?? p.estado);
  const total = plan.length;
  const noAplica = estados.filter((e) => e === 'no_aplica').length;
  const conforme = estados.filter((e) => e === 'conforme').length;
  const hallazgo = estados.filter((e) => e === 'hallazgo').length;
  const pendiente = estados.filter((e) => e === 'pendiente').length;
  const revisados = total - pendiente;
  return { total, conforme, hallazgo, noAplica, pendiente, revisados, pct: total ? Math.round((revisados / total) * 100) : 0 };
}

/** Hallazgos del área que no están asociados a ningún punto del plan (posibles temas fuera del plan). */
export function hallazgosFueraDelPlan(plan: PuntoPlanAuditoria[], vinculos: Map<string, VinculoPunto>, hallazgos: Hallazgo[]) {
  const asociados = new Set([...vinculos.values()].flatMap((v) => [...v.explicitos, ...v.relacionados].map((h) => h.id)));
  return plan.length ? hallazgos.filter((h) => !h.anulado && !asociados.has(h.id)) : [];
}

/** Cobertura del año: por área, capítulos ISO (4–10) con puntos revisados. */
export function coberturaAnual(auditorias: Auditoria[], hallazgos: Hallazgo[], requisitos: Record<string, Requisito>) {
  const filas = new Map<string, { areaId: string; puntos: number; revisados: number; capitulos: Record<string, number> }>();
  for (const a of auditorias) {
    if (!a.plan?.length || a.estado === 'anulada') continue;
    const vinc = vincularPlan(a.plan, hallazgos.filter((h) => h.auditoriaId === a.id), requisitos);
    const f = filas.get(a.areaId) ?? { areaId: a.areaId, puntos: 0, revisados: 0, capitulos: {} };
    for (const p of a.plan) {
      const e = vinc.get(p.id)?.estado ?? p.estado;
      f.puntos++;
      if (e === 'conforme' || e === 'hallazgo') {
        f.revisados++;
        new Set(p.requisitos.map((k) => k.split('|')[1]?.split('.')[0])).forEach((cap) => cap && (f.capitulos[cap] = (f.capitulos[cap] ?? 0) + 1));
      }
    }
    filas.set(a.areaId, f);
  }
  return [...filas.values()];
}

/**
 * Actualiza el plan de una auditoría con la plantilla vigente del área, conservando lo ya revisado:
 * los puntos con el mismo texto mantienen estado y hallazgos; los agregados a mano y las NC anteriores se conservan.
 */
export function actualizarPlanDesdeArea(actual: PuntoPlanAuditoria[], nuevo: PuntoPlanAuditoria[]): PuntoPlanAuditoria[] {
  const previo = new Map(actual.filter((p) => p.origen === 'plan').map((p) => [norm(p.titulo), p]));
  const idsUsados = new Set(actual.map((p) => p.id));
  const titulosNuevos = new Set(nuevo.filter((p) => p.origen === 'plan').map((p) => norm(p.titulo)));
  const base = nuevo.filter((p) => p.origen === 'plan').map((p) => {
    const x = previo.get(norm(p.titulo));
    if (x) return { ...p, id: x.id, estado: x.estado, hallazgoIds: x.hallazgoIds, revisadoPor: x.revisadoPor };
    // Id nuevo si choca con uno anterior (los hallazgos guardan planPuntoId)
    return idsUsados.has(p.id) ? { ...p, id: nuevoIdPunto() } : p;
  });
  const conservar = actual.filter((p) => p.origen !== 'plan' && p.origen !== 'recurrente');
  const ncNuevas = nuevo.filter((p) => p.origen === 'nc_anterior' && !conservar.some((c) => c.id === p.id));
  // Puntos del plan antiguo con avance que ya no están en la plantilla: se mantienen como "Agregado" para no perder registro
  const huerfanos = actual
    .filter((p) => p.origen === 'plan' && !titulosNuevos.has(norm(p.titulo)) && (p.estado !== 'pendiente' || p.hallazgoIds.length))
    .map((p) => ({ ...p, origen: 'manual' as const }));
  return [...base, ...huerfanos, ...conservar, ...ncNuevas];
}

const clave = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Puntos del plan que quedaron SIN evaluar en la auditoría anterior del mismo área (solo para los auditores,
 * no se muestra en informes ni en el plan que se envía al área). Indica además cuáles ya se cubrieron en la auditoría actual.
 */
export function pendientesAnteriores(actual: Auditoria, auditorias: Auditoria[], hallazgos: Hallazgo[], requisitos: Record<string, Requisito>) {
  const previas = auditorias
    .filter((x) => x.id !== actual.id && x.areaId === actual.areaId && x.estado !== 'anulada' && (x.estado === 'en_revision' || x.estado === 'cerrada') && x.plan?.length && x.fechaPlanificada <= actual.fechaPlanificada && x.anio <= actual.anio)
    .sort((a, b) => (b.fechaPlanificada || '').localeCompare(a.fechaPlanificada || ''));
  const previa = previas[0];
  if (!previa) return null;
  const vinc = vincularPlan(previa.plan!, hallazgos.filter((h) => h.auditoriaId === previa.id), requisitos);
  const propios = previa.plan!.filter((p) => p.origen === 'plan' || p.origen === 'manual');
  const faltantes = propios.filter((p) => (vinc.get(p.id)?.estado ?? p.estado) === 'pendiente');
  if (!faltantes.length) return null;
  const hechos = new Set((actual.plan ?? []).filter((p) => p.estado !== 'pendiente').map((p) => clave(p.titulo)));
  return {
    previa,
    total: propios.length,
    puntos: faltantes.map((p) => ({ id: p.id, titulo: p.titulo, requisitos: p.requisitos, cubierto: hechos.has(clave(p.titulo)) })),
  };
}
