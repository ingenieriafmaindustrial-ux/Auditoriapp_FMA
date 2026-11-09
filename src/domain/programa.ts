// Programa anual de auditorías: estados derivados, eventos de calendario e indicadores. Funciones puras.
import { diasHasta, hoyISO } from '../lib/dates';
import type { Auditoria, ProgramaItem, TipoProgramado, Usuario } from '../types';

export type EstadoProgramado = 'programada' | 'proxima' | 'atrasada' | 'en_curso' | 'realizada' | 'cancelada';

export const ESTADO_PROGRAMA: Record<EstadoProgramado, { label: string; color: string; fondo: string }> = {
  programada: { label: 'Programada', color: 'var(--viz-om)', fondo: 'color-mix(in srgb, var(--viz-om) 14%, transparent)' },
  proxima: { label: 'Próxima', color: 'var(--color-brand-dark)', fondo: 'color-mix(in srgb, var(--color-brand) 22%, transparent)' },
  atrasada: { label: 'Atrasada', color: 'var(--viz-critical)', fondo: 'color-mix(in srgb, var(--viz-critical) 14%, transparent)' },
  en_curso: { label: 'En curso', color: 'var(--viz-warning)', fondo: 'color-mix(in srgb, var(--viz-warning) 18%, transparent)' },
  realizada: { label: 'Realizada', color: 'var(--viz-good)', fondo: 'color-mix(in srgb, var(--viz-good) 14%, transparent)' },
  cancelada: { label: 'Cancelada', color: 'var(--viz-muted)', fondo: 'color-mix(in srgb, var(--viz-muted) 12%, transparent)' },
};

export const TIPO_PROGRAMA: Record<TipoProgramado, { label: string; corto: string; letra: string; descripcion: string }> = {
  auditoria: { label: 'Auditoría', corto: 'Auditoría', letra: 'A', descripcion: 'Auditoría interna del área según su plan.' },
  seguimiento: { label: 'Seguimiento', corto: 'Seguimiento', letra: 'S', descripcion: 'Revisión del avance de las acciones comprometidas por el área.' },
  eficacia: { label: 'Medición de eficacia', corto: 'Eficacia', letra: 'E', descripcion: 'Verificación de que las acciones correctivas eliminaron la causa.' },
};
export const tipoDe = (p: Pick<ProgramaItem, 'tipo'> | null | undefined): TipoProgramado => p?.tipo ?? 'auditoria';

/** Días de anticipación con que una auditoría programada pasa a "Próxima" y avisa en la campana. */
export const DIAS_AVISO_PROGRAMA = 14;

export function estadoProgramado(p: ProgramaItem, aud: Auditoria | undefined): EstadoProgramado {
  if (p.cancelado) return 'cancelada';
  if (p.realizadoEn) return 'realizada';
  if (aud && aud.estado !== 'anulada') return aud.estado === 'cerrada' ? 'realizada' : 'en_curso';
  const d = diasHasta(p.fecha);
  if (d < 0) return 'atrasada';
  if (d <= DIAS_AVISO_PROGRAMA) return 'proxima';
  return 'programada';
}

/** Evento del calendario: una auditoría programada, o una auditoría registrada sin programación previa. */
export interface EventoAuditoria {
  id: string;
  tipo: TipoProgramado;
  fecha: string;
  anio: number;
  sucursalId: string;
  areaId: string;
  liderId: string;
  equipoIds: string[];
  estado: EstadoProgramado;
  programa: ProgramaItem | null;
  auditoria: Auditoria | null;
}

export function construirEventos(programa: ProgramaItem[], auditorias: Auditoria[]): EventoAuditoria[] {
  const porId = Object.fromEntries(auditorias.map((a) => [a.id, a]));
  const vinculadas = new Set(programa.map((p) => p.auditoriaId).filter(Boolean));
  const ev: EventoAuditoria[] = programa.map((p) => {
    const aud = p.auditoriaId ? porId[p.auditoriaId] : undefined;
    return { id: `p-${p.id}`, tipo: tipoDe(p), fecha: p.fecha, anio: p.anio, sucursalId: p.sucursalId, areaId: p.areaId, liderId: aud?.auditorLiderId ?? p.auditorLiderId, equipoIds: aud?.equipoIds ?? p.equipoIds, estado: estadoProgramado(p, aud), programa: p, auditoria: aud ?? null };
  });
  auditorias
    .filter((a) => !vinculadas.has(a.id) && a.estado !== 'anulada')
    .forEach((a) => {
      const fecha = a.fechaRealizacion ?? a.fechaPlanificada;
      if (!fecha) return;
      const estado: EstadoProgramado = a.estado === 'cerrada' ? 'realizada' : a.estado === 'planificada' ? (diasHasta(fecha) < 0 ? 'atrasada' : diasHasta(fecha) <= DIAS_AVISO_PROGRAMA ? 'proxima' : 'programada') : 'en_curso';
      ev.push({ id: `a-${a.id}`, tipo: 'auditoria', fecha, anio: Number(fecha.slice(0, 4)), sucursalId: a.sucursalId, areaId: a.areaId, liderId: a.auditorLiderId, equipoIds: a.equipoIds, estado, programa: null, auditoria: a });
    });
  return ev.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** ¿El usuario participa (líder o equipo) en el evento? */
export const asignadoA = (e: Pick<EventoAuditoria, 'liderId' | 'equipoIds'>, u: Pick<Usuario, 'auditorId'>) =>
  !!u.auditorId && (e.liderId === u.auditorId || e.equipoIds.includes(u.auditorId));

export function indicadoresPrograma(eventos: EventoAuditoria[], areasActivas: number) {
  const vigentes = eventos.filter((e) => e.estado !== 'cancelada');
  const hoy = hoyISO();
  const en30 = vigentes.filter((e) => (e.estado === 'programada' || e.estado === 'proxima') && e.fecha >= hoy && diasHasta(e.fecha) <= 30).length;
  const areasCubiertas = new Set(vigentes.map((e) => e.areaId)).size;
  const realizadas = vigentes.filter((e) => e.estado === 'realizada').length;
  return {
    total: vigentes.length,
    realizadas,
    enCurso: vigentes.filter((e) => e.estado === 'en_curso').length,
    proximas30: en30,
    atrasadas: vigentes.filter((e) => e.estado === 'atrasada').length,
    avance: vigentes.length ? Math.round((realizadas / vigentes.length) * 100) : 0,
    cobertura: areasActivas ? Math.round((Math.min(areasCubiertas, areasActivas) / areasActivas) * 100) : 0,
  };
}

export const iniciales = (nombre: string | undefined) =>
  (nombre ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
