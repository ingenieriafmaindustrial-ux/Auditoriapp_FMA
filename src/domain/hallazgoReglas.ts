// Reglas de negocio de hallazgos (RN-03 a RN-07). Funciones puras: fáciles de probar.
import { DIAS_ALERTA_VENCIMIENTO, PLAZO_SEGUIMIENTO_DIAS } from '../lib/constants';
import { diasHasta, sumarDias } from '../lib/dates';
import { MARCA_PENDIENTE } from './asistente/redaccion';
import type { Accion, EstadoHallazgo, Hallazgo, ISODate, Verificacion } from '../types';

export function ultimaVerificacion(h: Pick<Hallazgo, 'verificaciones'>): Verificacion | null {
  if (!h.verificaciones.length) return null;
  return [...h.verificaciones].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1))[0];
}

/** Estado derivado: nunca se elige a mano (RN, sección 5.2). */
export function calcularEstado(
  h: Pick<Hallazgo, 'acciones' | 'verificaciones' | 'cierreSinAccion' | 'tipo'> & { historico?: boolean },
): EstadoHallazgo {
  if (h.historico) return 'tratada'; // histórico importado: sin seguimiento, fuera de alertas
  if (h.tipo === 'OM' && h.cierreSinAccion) return 'tratada';
  const ult = ultimaVerificacion(h);
  if (ult?.resultado === 'eficaz') return 'tratada';
  if (h.acciones.length === 0) return 'no_tratada';
  return 'en_seguimiento';
}

export type SemaforoPlazo = 'vencido' | 'proximo' | 'ok' | 'sin_fecha' | 'cerrado';

type ConPlazo = Pick<Hallazgo, 'fechaLimite' | 'estado' | 'anulado'> & { tipo?: Hallazgo['tipo']; fechaDeteccion?: ISODate };

/**
 * Regla de seguimiento: el área tiene PLAZO_SEGUIMIENTO_DIAS (3 semanas) desde la auditoría
 * (fecha de detección) para dar cumplimiento a sus NC. Si la NC tiene fecha límite explícita, manda esa.
 */
export function plazoEfectivo(h: ConPlazo): ISODate | null {
  if (h.tipo === 'OM') return null;
  if (h.fechaLimite) return h.fechaLimite;
  return h.fechaDeteccion ? sumarDias(h.fechaDeteccion.slice(0, 10), PLAZO_SEGUIMIENTO_DIAS) : null;
}

export function semaforoPlazo(h: ConPlazo): SemaforoPlazo {
  if (h.anulado || h.estado === 'tratada') return 'cerrado';
  if (h.tipo === 'OM') return 'sin_fecha'; // las OM no tienen plazo: las define el área
  const limite = plazoEfectivo(h);
  if (!limite) return 'sin_fecha';
  const d = diasHasta(limite);
  if (d < 0) return 'vencido';
  if (d <= DIAS_ALERTA_VENCIMIENTO) return 'proximo';
  return 'ok';
}

/** RN-03: datos mínimos del hallazgo. */
export function validarHallazgoBase(h: {
  tipo: 'NC' | 'OM';
  requisitoIds: string[];
  descripcion: string;
  nivel: string;
  fechaDeteccion: string;
  fechaLimite: string | null;
}): string[] {
  const e: string[] = [];
  if (h.tipo === 'NC' && !h.requisitoIds.length) e.push('Una No Conformidad debe indicar al menos un requisito de norma.');
  if (h.descripcion.trim().length < 10) e.push('La descripción debe tener al menos 10 caracteres.');
  if (MARCA_PENDIENTE.test(h.descripcion)) e.push('Completa los campos entre [corchetes] de la redacción propuesta antes de guardar.');
  if (!h.nivel) e.push('Debe indicar el nivel.');
  if (!h.fechaDeteccion) e.push('Debe indicar la fecha de detección.');
  if (h.fechaLimite && h.fechaDeteccion && h.fechaLimite < h.fechaDeteccion)
    e.push('La fecha límite no puede ser anterior a la fecha de detección.');
  return e;
}

/**
 * RN-04 (flexibilizada): el análisis de causa es responsabilidad del área.
 * No bloquea el registro de acciones; solo advierte si falta en una NC (ISO 10.2).
 */
export function requisitosParaAccion(_h: Pick<Hallazgo, 'tipo' | 'correccion' | 'analisisCausa'>): string[] {
  void _h;
  return [];
}

export function advertenciasTratamiento(h: Pick<Hallazgo, 'tipo' | 'correccion' | 'analisisCausa'>): string[] {
  if (h.tipo === 'OM') return [];
  const w: string[] = [];
  if (!h.correccion.trim()) w.push('corrección inmediata');
  if (!h.analisisCausa?.causaRaiz?.trim()) w.push('causa raíz informada por el área');
  return w;
}

export function validarAccion(a: Pick<Accion, 'descripcion' | 'responsable' | 'fechaCompromiso' | 'implementada' | 'fechaImplementacion'>): string[] {
  const e: string[] = [];
  if (a.descripcion.trim().length < 5) e.push('Describa la acción.');
  if (!a.responsable.trim()) e.push('Indique el responsable.');
  if (!a.fechaCompromiso) e.push('Indique la fecha de compromiso.');
  if (a.implementada && !a.fechaImplementacion) e.push('Indique la fecha de implementación.');
  return e;
}

/** RN-06: condiciones para verificar eficacia. */
export function validarVerificacion(
  h: Pick<Hallazgo, 'acciones' | 'tipo'>,
  v: { fecha: ISODate; analisis: string },
): string[] {
  const e: string[] = [];
  if (h.acciones.length === 0) e.push('No hay acciones registradas para verificar.');
  // Las acciones son compromiso del área: no se aprueban ni bloquean la verificación.
  const ultimaImpl = h.acciones
    .map((a) => a.fechaImplementacion)
    .filter((f): f is string => Boolean(f))
    .sort()
    .pop();
  if (!v.fecha) e.push('Indique la fecha de verificación.');
  else if (ultimaImpl && v.fecha < ultimaImpl)
    e.push('La verificación no puede ser anterior a la última implementación.');
  if (v.analisis.trim().length < 10) e.push('Describa el análisis de eficacia (mín. 10 caracteres).');
  return e;
}

/** RN-07: tras una verificación no eficaz se exige una acción nueva. */
export function requiereNuevaAccion(h: Pick<Hallazgo, 'acciones' | 'verificaciones'>): boolean {
  const ult = ultimaVerificacion(h);
  if (!ult || ult.resultado !== 'no_eficaz') return false;
  return !h.acciones.some((a) => a.creadoEn > ult.creadoEn);
}
