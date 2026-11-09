import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ISODate } from '../types';

export const hoyISO = (): ISODate => format(new Date(), 'yyyy-MM-dd');
export const ahoraISO = (): string => new Date().toISOString();
export const anioActual = (): number => new Date().getFullYear();

/** Primer año con auditorías registradas en la app. */
export const ANIO_INICIO = 2024;

/** Años disponibles para seleccionar: desde 2024 hasta el próximo año (descendente). */
export function aniosDisponibles(extra: number[] = []): number[] {
  const hasta = Math.max(anioActual() + 1, ...extra);
  const lista: number[] = [];
  for (let y = hasta; y >= ANIO_INICIO; y--) lista.push(y);
  return lista;
}

export function fmtFecha(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return format(parseISO(d), 'dd-MM-yyyy', { locale: es });
  } catch {
    return d;
  }
}

export function fmtFechaHora(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return format(parseISO(d), "dd-MM-yyyy HH:mm", { locale: es });
  } catch {
    return d;
  }
}

/** Días desde hoy hasta la fecha (negativo = vencida). */
export function diasHasta(d: ISODate): number {
  return differenceInCalendarDays(parseISO(d), new Date());
}

/** Suma días a una fecha ISO (YYYY-MM-DD) sin problemas de zona horaria. */
export function sumarDias(d: ISODate, dias: number): ISODate {
  const [y, m, dd] = d.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, dd + dias));
  return f.toISOString().slice(0, 10);
}
