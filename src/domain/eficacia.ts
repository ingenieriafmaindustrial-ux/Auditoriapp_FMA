// Regla de programación de la medición de eficacia (cierre del ciclo anual de hallazgos).
//  · Ventana: noviembre y diciembre del año de la auditoría.
//  · Días: solo lunes y jueves (máximo 2 revisiones por semana).
//  · Nunca más de una revisión por día (y el día no puede tener otra actividad del programa).
//  · Se omiten los feriados fijos de la ventana.
// Funciones puras: se prueban sin Firebase.
import { tipoDe } from './programa';
import type { Area, Auditoria, Hallazgo, ISODate, ProgramaItem } from '../types';

export const MES_INICIO_EFICACIA = 11; // noviembre (1-12)
export const DIAS_EFICACIA = [1, 4] as const; // lunes, jueves
export const MAX_EFICACIA_SEMANA = 2;
/** Feriados fijos de Chile dentro de la ventana (MM-DD). */
export const FERIADOS_VENTANA = ['11-01', '12-08', '12-25'];

const dia = (f: ISODate) => new Date(`${f.slice(0, 10)}T12:00:00`).getDay();
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Lunes de la semana de una fecha (clave de semana). */
export function lunesDe(f: ISODate): ISODate {
  const d = new Date(`${f.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}

export const ventanaEficacia = (anio: number) => ({ desde: `${anio}-${String(MES_INICIO_EFICACIA).padStart(2, '0')}-01`, hasta: `${anio}-12-31` });
export const enVentana = (f: ISODate) => {
  const v = ventanaEficacia(Number(f.slice(0, 4)));
  return f >= v.desde && f <= v.hasta;
};
export const esFeriado = (f: ISODate) => FERIADOS_VENTANA.includes(f.slice(5, 10));
export const esDiaEficacia = (f: ISODate) => (DIAS_EFICACIA as readonly number[]).includes(dia(f)) && !esFeriado(f);

const vigentes = (programa: ProgramaItem[], excluirId?: string) => programa.filter((p) => !p.cancelado && p.id !== excluirId);

/** Bloqueos (errores) y advertencias de una medición de eficacia en una fecha. */
export function reglaEficacia(fecha: ISODate, programa: ProgramaItem[], excluirId?: string): { errores: string[]; avisos: string[] } {
  const errores: string[] = [];
  const avisos: string[] = [];
  if (!fecha) return { errores, avisos };
  const otros = vigentes(programa, excluirId);
  const mismoDia = otros.filter((p) => p.fecha === fecha);
  if (mismoDia.some((p) => tipoDe(p) === 'eficacia')) errores.push('Ese día ya tiene una medición de eficacia: máximo una revisión por día.');
  else if (mismoDia.length) avisos.push('Ese día ya tiene otra actividad del programa.');
  const semana = lunesDe(fecha);
  const enSemana = otros.filter((p) => tipoDe(p) === 'eficacia' && lunesDe(p.fecha) === semana).length;
  if (enSemana >= MAX_EFICACIA_SEMANA) errores.push(`Esa semana ya tiene ${enSemana} mediciones de eficacia: máximo ${MAX_EFICACIA_SEMANA} por semana.`);
  if (!enVentana(fecha)) avisos.push('La medición de eficacia se programa en noviembre o diciembre.');
  if (esFeriado(fecha)) avisos.push('La fecha es feriado.');
  else if (!(DIAS_EFICACIA as readonly number[]).includes(dia(fecha))) avisos.push('La regla es revisar los lunes y jueves.');
  return { errores, avisos };
}

/** Lunes y jueves libres de la ventana, desde `desde` (incluido), respetando 1 por día y 2 por semana. */
export function cuposEficacia(anio: number, programa: ProgramaItem[], desde: ISODate): ISODate[] {
  const v = ventanaEficacia(anio);
  const inicio = desde > v.desde ? desde : v.desde;
  const otros = vigentes(programa);
  const ocupados = new Set(otros.map((p) => p.fecha));
  const porSemana = new Map<string, number>();
  otros.filter((p) => tipoDe(p) === 'eficacia').forEach((p) => porSemana.set(lunesDe(p.fecha), (porSemana.get(lunesDe(p.fecha)) ?? 0) + 1));
  const out: ISODate[] = [];
  const d = new Date(`${inicio}T12:00:00`);
  while (iso(d) <= v.hasta) {
    const f = iso(d);
    const s = lunesDe(f);
    if (esDiaEficacia(f) && !ocupados.has(f) && (porSemana.get(s) ?? 0) < MAX_EFICACIA_SEMANA) {
      out.push(f);
      porSemana.set(s, (porSemana.get(s) ?? 0) + 1);
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export interface PropuestaEficacia {
  areaId: string;
  sucursalId: string;
  fecha: ISODate | null;
  liderId: string;
  hallazgos: Hallazgo[];
  nc: number;
  om: number;
}

/** Hallazgos del año que todavía esperan la medición de eficacia. */
export const pendientesEficacia = (hallazgos: Hallazgo[], anio: number) => hallazgos.filter((h) => h.anio === anio && !h.anulado && h.estado !== 'tratada');

/**
 * Una revisión por área (cubre todos sus hallazgos pendientes del año), en los cupos lunes/jueves.
 * Omite áreas que ya tienen su medición de eficacia programada. Agrupa por sucursal para ordenar los traslados.
 */
export function proponerEficacia(p: { anio: number; hallazgos: Hallazgo[]; auditorias: Auditoria[]; programa: ProgramaItem[]; areas: Record<string, Area>; nombreSucursal: (id: string) => string; desde: ISODate }): PropuestaEficacia[] {
  const yaProgramadas = new Set(vigentes(p.programa).filter((x) => tipoDe(x) === 'eficacia' && x.anio === p.anio).map((x) => x.areaId));
  const grupos = new Map<string, Hallazgo[]>();
  pendientesEficacia(p.hallazgos, p.anio)
    .filter((h) => !yaProgramadas.has(h.areaId))
    .forEach((h) => grupos.set(h.areaId, [...(grupos.get(h.areaId) ?? []), h]));
  const lista = [...grupos.entries()].map(([areaId, hs]) => {
    const auds = p.auditorias.filter((a) => a.areaId === areaId && a.anio === p.anio && a.estado !== 'anulada').sort((a, b) => b.numero - a.numero);
    return {
      areaId,
      sucursalId: p.areas[areaId]?.sucursalId ?? auds[0]?.sucursalId ?? '',
      fecha: null as ISODate | null,
      liderId: auds[0]?.auditorLiderId ?? '',
      hallazgos: [...hs].sort((a, b) => a.correlativo - b.correlativo),
      nc: hs.filter((h) => h.tipo === 'NC').length,
      om: hs.filter((h) => h.tipo === 'OM').length,
    };
  });
  lista.sort((a, b) => p.nombreSucursal(a.sucursalId).localeCompare(p.nombreSucursal(b.sucursalId), 'es') || b.nc - a.nc || b.hallazgos.length - a.hallazgos.length);
  const cupos = cuposEficacia(p.anio, p.programa, p.desde);
  lista.forEach((x, i) => (x.fecha = cupos[i] ?? null));
  return lista;
}
