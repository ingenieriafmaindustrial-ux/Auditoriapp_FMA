// Restauración desde un respaldo JSON (solo administrador TI).
// Nunca borra datos: crea lo que falta y, si se elige, sobrescribe lo existente con la versión del respaldo.
// Antes de escribir descarga automáticamente un respaldo del estado actual (para poder deshacer a mano).
// Las reglas de Firestore solo permiten estas escrituras mientras config/restauracion tenga una ventana vigente.
import { deleteDoc, doc, setDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COL, registrarBitacora } from './base';
import { descargarRespaldoJson, leerRespaldo, type Doc, type Respaldo } from './respaldo';
import type { Usuario } from '../types';

/** Colecciones que no se restauran: configuración interna y estado efímero. */
const EXCLUIDAS = new Set<string>([COL.config, COL.presencia, COL.errores, COL.reportes]);

export type ModoRestauracion = 'faltantes' | 'todo';

export interface FilaAnalisis { ruta: string; enRespaldo: number; faltan: number; existentes: number }
export interface Analisis {
  respaldo: Respaldo;
  filas: FilaAnalisis[];
  totalFaltan: number;
  totalExistentes: number;
  /** IDs actuales por ruta (para decidir qué crear). */
  actuales: Record<string, Set<string>>;
}

/** Lee y valida un archivo de respaldo .json generado por la app. */
export async function leerArchivoRespaldo(file: File): Promise<Respaldo> {
  let r: Respaldo;
  try {
    r = JSON.parse(await file.text()) as Respaldo;
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  if (r?.app !== 'FMA AuditoriAPP' || r.formato !== 1 || typeof r.colecciones !== 'object') throw new Error('El archivo no es un respaldo de FMA AuditoriAPP.');
  return r;
}

/** Compara el respaldo con la base actual (sin escribir nada). */
export async function analizarRestauracion(u: Usuario, r: Respaldo, progreso: (t: string) => void): Promise<Analisis> {
  const actual = await leerRespaldo(u, !!r.colecciones[COL.evidenciasDatos]?.length, progreso);
  const ids = (l: Doc[] | undefined) => new Set((l ?? []).map((d) => d.id));
  const actuales: Record<string, Set<string>> = {};
  const filas: FilaAnalisis[] = [];
  const rutas = [
    ...Object.keys(r.colecciones).filter((c) => !EXCLUIDAS.has(c)).map((c) => [c, r.colecciones[c], actual.colecciones[c]] as const),
    ...Object.keys(r.subcolecciones).map((s) => [s, r.subcolecciones[s], actual.subcolecciones[s]] as const),
  ];
  for (const [ruta, docs, act] of rutas) {
    const a = ids(act);
    actuales[ruta] = a;
    const faltan = docs.filter((d) => !a.has(d.id)).length;
    filas.push({ ruta, enRespaldo: docs.length, faltan, existentes: docs.length - faltan });
  }
  // Agrupa subcolecciones para el resumen (checklist / informes)
  const agrupadas = new Map<string, FilaAnalisis>();
  for (const f of filas) {
    const clave = f.ruta.includes('/') ? `auditorias/*/${f.ruta.split('/').pop()}` : f.ruta;
    const g = agrupadas.get(clave) ?? { ruta: clave, enRespaldo: 0, faltan: 0, existentes: 0 };
    g.enRespaldo += f.enRespaldo; g.faltan += f.faltan; g.existentes += f.existentes;
    agrupadas.set(clave, g);
  }
  const resumen = [...agrupadas.values()].filter((f) => f.enRespaldo > 0);
  return {
    respaldo: r,
    filas: resumen,
    totalFaltan: resumen.reduce((a, f) => a + f.faltan, 0),
    totalExistentes: resumen.reduce((a, f) => a + f.existentes, 0),
    actuales,
  };
}

/** Ejecuta la restauración. Devuelve la cantidad de documentos escritos. */
export async function ejecutarRestauracion(u: Usuario, an: Analisis, modo: ModoRestauracion, progreso: (t: string) => void): Promise<number> {
  const r = an.respaldo;
  // 1) Respaldo de seguridad del estado actual
  progreso('Descargando respaldo de seguridad del estado actual…');
  descargarRespaldoJson(await leerRespaldo(u, !!r.colecciones[COL.evidenciasDatos]?.length, progreso));

  // 2) Lista de escrituras
  const escrituras: { ruta: string; id: string; data: Record<string, unknown> }[] = [];
  const agregar = (ruta: string, docs: Doc[]) => {
    const act = an.actuales[ruta] ?? new Set<string>();
    for (const { id, ...data } of docs) if (modo === 'todo' || !act.has(id)) escrituras.push({ ruta, id, data });
  };
  for (const c of Object.keys(r.colecciones)) if (!EXCLUIDAS.has(c)) agregar(c, r.colecciones[c]);
  for (const s of Object.keys(r.subcolecciones)) agregar(s, r.subcolecciones[s]);
  if (!escrituras.length) return 0;

  // 3) Ventana de restauración (las reglas la exigen) → escrituras por lotes → cierre de ventana
  const ventana = doc(db, COL.config, 'restauracion');
  await setDoc(ventana, { hasta: Timestamp.fromMillis(Date.now() + 20 * 60_000), usuarioId: u.id });
  try {
    // Documento por documento (8 en paralelo): las reglas de seguridad limitan las lecturas por lote,
    // así una restauración grande no choca con ese límite.
    let hechos = 0;
    for (let i = 0; i < escrituras.length; i += 8) {
      await Promise.all(escrituras.slice(i, i + 8).map((w) => setDoc(doc(db, w.ruta, w.id), w.data)));
      hechos = Math.min(i + 8, escrituras.length);
      progreso(`Restaurando ${hechos} de ${escrituras.length}…`);
    }
    const b = writeBatch(db);
    registrarBitacora(b, u, {
      entidad: 'sistema',
      entidadId: 'restauracion',
      auditoriaId: null,
      participantes: [],
      accion: 'editar',
      detalle: `Restauración desde respaldo del ${r.generado.slice(0, 16).replace('T', ' ')} (${modo === 'todo' ? 'sobrescribir todo' : 'solo faltantes'}): ${escrituras.length} documento(s) escritos.`,
    });
    await b.commit();
  } finally {
    await deleteDoc(ventana).catch(() => undefined);
  }
  return escrituras.length;
}
