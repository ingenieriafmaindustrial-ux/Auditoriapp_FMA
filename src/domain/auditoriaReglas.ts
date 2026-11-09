// Reglas de negocio de auditorías (RN-01, RN-02, RN-08, RN-09) y transiciones de estado.
import type { Auditor, Auditoria, ChecklistItem, EstadoAuditoria, Norma, Rol } from '../types';
import { pad2 } from '../lib/utils';

export const codigoAuditoria = (numero: number, anio: number) => `${pad2(numero)}/${anio}`;

export interface AuditoriaForm {
  anio: number;
  sucursalId: string;
  areaId: string;
  objetivos: string;
  alcance: string;
  normas: Norma[];
  auditorLiderId: string;
  equipoIds: string[];
  auditadosTexto: string;
  fechaPlanificada: string;
  fechaRealizacion: string | null;
  auditoriaAnteriorId: string | null;
}

export function validarAuditoria(f: AuditoriaForm): string[] {
  const e: string[] = [];
  if (!f.sucursalId) e.push('Seleccione la sucursal.');
  if (!f.areaId) e.push('Seleccione el área auditada.');
  if (!f.normas.length) e.push('Seleccione al menos una norma de referencia.');
  if (!f.auditorLiderId) e.push('Seleccione el auditor líder.');
  if (!f.fechaPlanificada) e.push('Indique la fecha planificada.');
  if (!f.objetivos.trim()) e.push('Indique los objetivos.');
  if (!f.alcance.trim()) e.push('Indique el alcance.');
  return e;
}

/**
 * RN-02: auditores que auditarían su propia área de origen.
 * Solo cuenta el equipo que audita en terreno: el líder que solo revisa (no está en equipoIds) no genera conflicto.
 */
export function conflictosIndependencia(f: Pick<AuditoriaForm, 'areaId' | 'auditorLiderId' | 'equipoIds'>, auditores: Record<string, Auditor>): Auditor[] {
  if (!f.areaId) return [];
  const ids = Array.from(new Set(f.equipoIds.filter(Boolean)));
  return ids.map((id) => auditores[id]).filter((a): a is Auditor => Boolean(a && a.areaOrigenId === f.areaId));
}

export const participantesDe = (liderId: string, equipoIds: string[]) =>
  Array.from(new Set([liderId, ...equipoIds].filter(Boolean)));

export interface Transicion {
  hacia: EstadoAuditoria;
  etiqueta: string;
  requiereMotivo?: boolean;
  soloLider?: boolean;
  variante?: 'primary' | 'secondary' | 'danger';
}

export function transicionesDisponibles(estado: EstadoAuditoria, rol: Rol): Transicion[] {
  if (rol === 'auditor') return [];
  const t: Transicion[] = [];
  switch (estado) {
    // El avance normal (comenzar, enviar a revisión, aprobar/devolver) se hace con los botones de la hoja.
    case 'planificada':
    case 'en_ejecucion':
      t.push({ hacia: 'anulada', etiqueta: 'Anular', requiereMotivo: true, soloLider: true, variante: 'danger' });
      break;
    case 'cerrada':
      t.push({ hacia: 'en_revision', etiqueta: 'Reabrir', requiereMotivo: true, soloLider: true, variante: 'danger' });
      break;
  }
  return t.filter((x) => !x.soloLider || rol === 'auditor_lider');
}

/** Enviar a revisión: debe existir al menos un registro de resultado (hallazgos o nota de conformidad). */
export function validarEnvioRevisionSimple(hallazgosActivos: number, notas: string): string[] {
  return hallazgosActivos === 0 && !notas.trim()
    ? ['Registra al menos un hallazgo, o escribe en Notas que la auditoría no presentó hallazgos.']
    : [];
}

/** RN-08 (checklist, en desuso en la vista simplificada). */
export function validarEnvioRevision(items: ChecklistItem[]): string[] {
  const e: string[] = [];
  if (!items.length) e.push('El checklist está vacío.');
  const pend = items.filter((i) => i.resultado === 'pendiente').length;
  if (pend) e.push(`Quedan ${pend} ítem(s) del checklist pendientes.`);
  const sinHallazgo = items.filter((i) => (i.resultado === 'NC' || i.resultado === 'OM') && !i.hallazgoId).length;
  if (sinHallazgo) e.push(`Hay ${sinHallazgo} ítem(s) NC/OM sin hallazgo creado.`);
  return e;
}

/** RN-09 */
export const checklistEditable = (estado: EstadoAuditoria) => estado === 'planificada' || estado === 'en_ejecucion';
export const hallazgoDescripcionEditable = (estado: EstadoAuditoria) =>
  estado === 'planificada' || estado === 'en_ejecucion' || estado === 'en_revision';
export const seguimientoEditable = (estado: EstadoAuditoria) => estado !== 'anulada';

export function progresoChecklist(items: ChecklistItem[]) {
  const total = items.length;
  const hechos = items.filter((i) => i.resultado !== 'pendiente').length;
  return { total, hechos, pct: total ? Math.round((hechos / total) * 100) : 0 };
}

export const esParticipante = (a: Pick<Auditoria, 'participantes'>, auditorId: string | null) =>
  Boolean(auditorId && a.participantes.includes(auditorId));
