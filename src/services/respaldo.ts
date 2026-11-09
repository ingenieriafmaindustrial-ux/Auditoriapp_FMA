// Respaldo completo de la base de datos: JSON (restaurable / auditable) y Excel estructurado (lectura humana).
// Lee directo de Firestore (no del estado en pantalla) para no omitir colecciones ni subcolecciones.
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COL } from './base';
import { descargarBlob } from './informeExport';
import type { Usuario } from '../types';

export type Doc = { id: string } & Record<string, unknown>;
export interface Respaldo {
  app: 'FMA AuditoriAPP';
  formato: 1;
  generado: string;
  generadoPor: { nombre: string; email: string };
  incluyeFotos: boolean;
  colecciones: Record<string, Doc[]>;
  /** Subcolecciones por auditoría: auditorias/{id}/checklist e informes. */
  subcolecciones: Record<string, Doc[]>;
  /** Colecciones que no se pudieron leer (permisos, red). */
  errores: Record<string, string>;
}

const COLECCIONES = [COL.config, COL.usuarios, COL.sucursales, COL.areas, COL.auditores, COL.requisitos, COL.contadores, COL.auditorias, COL.hallazgos, COL.programa, COL.evidencias, COL.aprendizaje, COL.bitacora];

async function leer(ruta: string): Promise<Doc[]> {
  // config solo permite leer su documento 'app' (no listar la colección)
  if (ruta === COL.config) {
    const d = await getDoc(doc(db, COL.config, 'app'));
    return d.exists() ? [{ id: d.id, ...d.data() }] : [];
  }
  const snap = await getDocs(collection(db, ruta));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function leerRespaldo(u: Usuario, incluirFotos: boolean, progreso: (t: string) => void): Promise<Respaldo> {
  const r: Respaldo = { app: 'FMA AuditoriAPP', formato: 1, generado: new Date().toISOString(), generadoPor: { nombre: u.nombre, email: u.email }, incluyeFotos: incluirFotos, colecciones: {}, subcolecciones: {}, errores: {} };
  const lista = incluirFotos ? [...COLECCIONES, COL.evidenciasDatos] : COLECCIONES;
  for (const c of lista) {
    progreso(`Leyendo ${c}…`);
    try {
      r.colecciones[c] = await leer(c);
    } catch (e) {
      r.colecciones[c] = [];
      r.errores[c] = e instanceof Error ? e.message : String(e);
    }
  }
  const auds = r.colecciones[COL.auditorias] ?? [];
  for (let i = 0; i < auds.length; i++) {
    progreso(`Leyendo checklist e informes (${i + 1}/${auds.length})…`);
    for (const sub of ['checklist', 'informes']) {
      const ruta = `${COL.auditorias}/${auds[i].id}/${sub}`;
      try {
        const docs = await leer(ruta);
        if (docs.length) r.subcolecciones[ruta] = docs;
      } catch (e) {
        r.errores[ruta] = e instanceof Error ? e.message : String(e);
      }
    }
  }
  return r;
}

const sello = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;

export function descargarRespaldoJson(r: Respaldo) {
  const blob = new Blob([JSON.stringify(r, null, 1)], { type: 'application/json' });
  descargarBlob(blob, `Respaldo FMA AuditoriAPP ${sello(new Date(r.generado))}.json`);
}

export async function descargarRespaldoExcel(r: Respaldo) {
  const { construirRespaldoExcel } = await import('../domain/respaldoExcel');
  let logo: Uint8Array | null = null;
  try {
    const res = await fetch('/logo-fma.png');
    if (res.ok) logo = new Uint8Array(await res.arrayBuffer());
  } catch {
    logo = null;
  }
  const bytes = construirRespaldoExcel(r, logo);
  descargarBlob(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Respaldo FMA AuditoriAPP ${sello(new Date(r.generado))}.xlsx`);
}
