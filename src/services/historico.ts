import { collection, doc, getDocs, query, runTransaction, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ahoraISO } from '../lib/dates';
import { normalizar, uid } from '../lib/utils';
import { COL, registrarBitacora } from './base';
import { claveAreaPlan } from '../data/planesSeed';
import { codigoAuditoria, participantesDe } from '../domain/auditoriaReglas';
import { calcularEstado } from '../domain/hallazgoReglas';
import type { Accion, Area, Auditor, Auditoria, Hallazgo, Nivel, Norma, Requisito, Sucursal, TipoHallazgo, Usuario } from '../types';

// ---------- Formato del archivo (historico_2024_2026.json) ----------
export interface HallazgoHist {
  n: number;
  tipo: TipoHallazgo;
  tipoInferido: boolean;
  descripcion: string;
  clausulas: string[]; // "ISO 9001|7.5.1"
  correccion: string;
  accion: string;
  nivel: Nivel;
}
export interface AuditoriaHist {
  clave: string; // anio|sucursal|area
  anio: number;
  sucursal: string;
  area: string;
  fechaRealizacion: string | null;
  codigoOriginal: string;
  lider: string;
  equipo: string[];
  objetivos: string;
  alcance: string;
  archivoOrigen: string;
  hallazgos: HallazgoHist[];
}
export interface DatosHistorico {
  formato: 'fma-historico';
  version: number;
  generado: string;
  auditorias: AuditoriaHist[];
}

export function leerHistorico(texto: string): DatosHistorico {
  let d: unknown;
  try {
    d = JSON.parse(texto);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const x = d as Partial<DatosHistorico>;
  if (!x || x.formato !== 'fma-historico' || !Array.isArray(x.auditorias)) throw new Error('El archivo no tiene el formato del histórico FMA (historico_2024_2026.json).');
  for (const a of x.auditorias) {
    if (!a.clave || !a.anio || !a.sucursal || !a.area || !Array.isArray(a.hallazgos)) throw new Error(`Auditoría con datos incompletos: ${a.clave ?? '?'}`);
    for (const h of a.hallazgos) if (!h.descripcion || (h.tipo !== 'NC' && h.tipo !== 'OM')) throw new Error(`Hallazgo inválido en ${a.clave} #${h.n}`);
  }
  return x as DatosHistorico;
}

// ---------- Planificación (sin escribir nada) ----------
export interface Catalogos {
  sucursales: Sucursal[];
  areas: Area[];
  auditores: Auditor[];
  requisitos: Requisito[];
}

export interface FilaPlan {
  a: AuditoriaHist;
  existente: Auditoria | null; // ya importada (completa)
  incompleta: Auditoria | null; // importación interrumpida: se rehace
  nc: number;
  om: number;
  inferidos: number;
  sinRequisito: string[]; // claves de cláusula que no están en el catálogo
}

export interface PlanImportacion {
  filas: FilaPlan[];
  sucursalesNuevas: string[];
  areasNuevas: { nombre: string; sucursal: string }[];
  auditoresNuevos: string[];
}

const claveReq = (r: Pick<Requisito, 'norma' | 'clausula'>) => `${r.norma}|${r.clausula}`;

function buscarSucursal(nombre: string, c: Catalogos) {
  return c.sucursales.find((s) => normalizar(s.nombre) === normalizar(nombre)) ?? null;
}
function buscarArea(nombre: string, sucursalId: string | null, c: Catalogos) {
  const n = normalizar(nombre);
  const k = claveAreaPlan(nombre);
  const cands = c.areas.filter((a) => normalizar(a.nombre) === n || (k && claveAreaPlan(a.nombre) === k));
  // Solo áreas de la misma sucursal (o sin sucursal): nunca se asigna un área de otra sede
  return cands.find((a) => a.sucursalId && a.sucursalId === sucursalId) ?? cands.find((a) => !a.sucursalId) ?? null;
}
function buscarAuditor(nombre: string, c: Catalogos) {
  const n = normalizar(nombre);
  return c.auditores.find((a) => normalizar(a.nombre) === n) ?? c.auditores.find((a) => normalizar(a.nombre).startsWith(n + ' ') || n.startsWith(normalizar(a.nombre) + ' ')) ?? null;
}

export function planificar(datos: DatosHistorico, c: Catalogos, auditoriasApp: Auditoria[]): PlanImportacion {
  const reqs = new Set(c.requisitos.map(claveReq));
  const sNuevas = new Set<string>();
  const aNuevas = new Map<string, string>();
  const auNuevos = new Set<string>();
  const filas: FilaPlan[] = datos.auditorias.map((a) => {
    const prev = auditoriasApp.filter((x) => x.importadaClave === a.clave);
    const existente = prev.find((x) => x.estado === 'cerrada') ?? null;
    const incompleta = existente ? null : prev[0] ?? null;
    if (!buscarSucursal(a.sucursal, c)) sNuevas.add(a.sucursal);
    const suc = buscarSucursal(a.sucursal, c);
    if (!buscarArea(a.area, suc?.id ?? null, c)) aNuevas.set(`${normalizar(a.sucursal)}|${normalizar(a.area)}`, JSON.stringify({ nombre: a.area, sucursal: a.sucursal }));
    [a.lider, ...a.equipo].forEach((n) => {
      if (n && !buscarAuditor(n, c)) auNuevos.add(n);
    });
    const sinReq = new Set<string>();
    a.hallazgos.forEach((h) => h.clausulas.forEach((k) => !reqs.has(k) && sinReq.add(k)));
    return {
      a,
      existente,
      incompleta,
      nc: a.hallazgos.filter((h) => h.tipo === 'NC').length,
      om: a.hallazgos.filter((h) => h.tipo === 'OM').length,
      inferidos: a.hallazgos.filter((h) => h.tipoInferido).length,
      sinRequisito: [...sinReq],
    };
  });
  return { filas, sucursalesNuevas: [...sNuevas], areasNuevas: [...aNuevas.values()].map((x) => JSON.parse(x) as { nombre: string; sucursal: string }), auditoresNuevos: [...auNuevos] };
}

// ---------- Ejecución ----------
export interface Progreso {
  hechas: number;
  total: number;
  mensaje: string;
}

const FECHA_FALLBACK = (a: AuditoriaHist) => a.fechaRealizacion ?? `${a.anio}-06-30`;

/**
 * Importa las auditorías pendientes del plan. Cada una se escribe en tres pasos (la regla de
 * seguridad exige que la auditoría esté abierta para crear hallazgos): crear con número correlativo,
 * cargar hallazgos y cerrar. Se puede repetir sin duplicar: lo ya importado se omite y lo interrumpido se rehace.
 */
export async function importarHistorico(u: Usuario, plan: PlanImportacion, catalogos: Catalogos, onProgreso: (p: Progreso) => void) {
  const pendientes = plan.filas.filter((f) => !f.existente);
  if (!pendientes.length) return { auditorias: 0, hallazgos: 0 };
  const ahora = ahoraISO();

  // 1) Catálogos faltantes
  const c: Catalogos = { ...catalogos, sucursales: [...catalogos.sucursales], areas: [...catalogos.areas], auditores: [...catalogos.auditores] };
  const bc = writeBatch(db);
  for (const nombre of plan.sucursalesNuevas) {
    const ref = doc(collection(db, COL.sucursales));
    bc.set(ref, { nombre, activo: true, actualizadoEn: ahora });
    c.sucursales.push({ id: ref.id, nombre, activo: true });
  }
  for (const { nombre, sucursal } of plan.areasNuevas) {
    const ref = doc(collection(db, COL.areas));
    const sucursalId = buscarSucursal(sucursal, c)?.id ?? null;
    bc.set(ref, { nombre, sucursalId, encargado: '', cargoEncargado: '', activo: true, actualizadoEn: ahora });
    c.areas.push({ id: ref.id, nombre, sucursalId, encargado: '', cargoEncargado: '', activo: true });
  }
  for (const nombre of plan.auditoresNuevos) {
    const ref = doc(collection(db, COL.auditores));
    // inactivo: aparece en los informes históricos pero no se ofrece para auditorías nuevas
    bc.set(ref, { nombre, cargo: 'Auditor (histórico)', sucursalId: null, areaOrigenId: null, activo: false, actualizadoEn: ahora });
    c.auditores.push({ id: ref.id, nombre, cargo: 'Auditor (histórico)', sucursalId: null, areaOrigenId: null, activo: false });
  }
  if (plan.sucursalesNuevas.length || plan.areasNuevas.length || plan.auditoresNuevos.length) await bc.commit();

  const reqPorClave: Record<string, Requisito> = {};
  c.requisitos.forEach((r) => (reqPorClave[claveReq(r)] = r));

  // 2) Auditorías en orden cronológico (los números correlativos siguen la fecha)
  const orden = [...pendientes].sort((x, y) => x.a.anio - y.a.anio || FECHA_FALLBACK(x.a).localeCompare(FECHA_FALLBACK(y.a)));
  const idPorClave: Record<string, string> = {};
  plan.filas.forEach((f) => f.existente && (idPorClave[f.a.clave] = f.existente.id));
  let hechas = 0;
  let totalH = 0;

  for (const fila of orden) {
    const a = fila.a;
    onProgreso({ hechas, total: orden.length, mensaje: `${a.anio} · ${a.sucursal} · ${a.area}` });
    const suc = buscarSucursal(a.sucursal, c)!;
    const area = buscarArea(a.area, suc.id, c)!;
    const lider = buscarAuditor(a.lider, c)!;
    const equipoIds = a.equipo.map((n) => buscarAuditor(n, c)?.id).filter((x): x is string => Boolean(x) && x !== lider.id);
    const participantes = participantesDe(lider.id, equipoIds);
    const fecha = FECHA_FALLBACK(a);
    const normas: Norma[] = ['ISO 9001', 'ISO 14001', 'ISO 45001'];

    let audId: string;
    if (fila.incompleta) {
      // importación previa interrumpida: se limpian sus hallazgos y se vuelve a cargar
      audId = fila.incompleta.id;
      const viejos = await getDocs(query(collection(db, COL.hallazgos), where('auditoriaId', '==', audId)));
      const bd = writeBatch(db);
      viejos.docs.forEach((d) => bd.delete(d.ref));
      if (!viejos.empty) await bd.commit();
    } else {
      const contadorRef = doc(db, COL.contadores, `auditorias_${a.anio}`);
      const audRef = doc(collection(db, COL.auditorias));
      audId = audRef.id;
      await runTransaction(db, async (tx) => {
        const cs = await tx.get(contadorRef);
        const numero = (cs.exists() ? (cs.data().ultimoNumero as number) : 0) + 1;
        tx.set(contadorRef, { ultimoNumero: numero, anio: a.anio });
        const data: Omit<Auditoria, 'id'> = {
          numero,
          anio: a.anio,
          codigo: codigoAuditoria(numero, a.anio),
          sucursalId: suc.id,
          areaId: area.id,
          objetivos: a.objetivos,
          alcance: a.alcance,
          normas,
          auditorLiderId: lider.id,
          equipoIds,
          participantes,
          auditadosTexto: '',
          fechaPlanificada: fecha,
          fechaRealizacion: fecha,
          agenda: [],
          estado: 'en_ejecucion', // temporal: se cierra al final de la carga
          notas: `Auditoría histórica importada del informe original (${a.codigoOriginal || 's/n'}). Fuente: ${a.archivoOrigen}.`,
          aprobaciones: [],
          auditoriaAnteriorId: null,
          contadorHallazgos: 0,
          informeVersion: 0,
          independenciaForzada: null,
          anulacion: null,
          reaperturas: [],
          plan: [],
          importada: true,
          codigoOriginal: a.codigoOriginal,
          origenArchivo: a.archivoOrigen,
          importadaClave: a.clave,
          creadoPor: u.id,
          creadoEn: ahora,
          actualizadoEn: ahora,
        };
        tx.set(audRef, data);
      });
    }

    // hallazgos + contador + bitácora
    const b = writeBatch(db);
    a.hallazgos.forEach((h, i) => {
      const reqIds = h.clausulas.map((k) => reqPorClave[k]?.id).filter((x): x is string => Boolean(x));
      const normasH = [...new Set(h.clausulas.map((k) => k.split('|')[0] as Norma))].filter((n) => reqIds.some((id) => c.requisitos.find((r) => r.id === id)?.norma === n));
      const acciones: Accion[] = h.accion
        ? [{ id: uid(), tipo: h.tipo === 'NC' ? 'correctiva' : 'mejora', descripcion: h.accion, responsable: 'Área auditada (histórico)', fechaCompromiso: fecha, fechaImplementacion: fecha, implementada: true, creadoEn: ahora, creadoPor: u.id }]
        : [];
      const data: Omit<Hallazgo, 'id'> = {
        auditoriaId: audId,
        correlativo: i + 1,
        anio: a.anio,
        sucursalId: suc.id,
        areaId: area.id,
        participantes,
        tipo: h.tipo,
        requisitoIds: reqIds,
        normas: normasH,
        descripcion: h.descripcion,
        nivel: h.nivel,
        fechaDeteccion: fecha,
        fechaLimite: null,
        auditorResponsableId: lider.id,
        checklistItemId: null,
        planPuntoId: null,
        correccion: h.correccion,
        analisisCausa: { metodo: 'otro', porques: [], causaRaiz: '' },
        acciones,
        verificaciones: [],
        cierreSinAccion: null,
        estado: 'tratada',
        historico: true,
        tipoInferido: h.tipoInferido,
        anulado: false,
        anulacion: null,
        creadoPor: u.id,
        creadoEn: ahora,
        actualizadoEn: ahora,
      };
      b.set(doc(collection(db, COL.hallazgos)), data);
    });
    b.update(doc(db, COL.auditorias, audId), { contadorHallazgos: a.hallazgos.length, actualizadoEn: ahora });
    await b.commit();
    totalH += a.hallazgos.length;
    idPorClave[a.clave] = audId;

    // cierre + vínculo con la auditoría anterior del mismo proceso
    const prevClave = [a.anio - 1, a.anio - 2].map((y) => `${y}|${a.sucursal}|${a.area}`).find((k) => idPorClave[k]);
    const bf = writeBatch(db);
    bf.update(doc(db, COL.auditorias, audId), { estado: 'cerrada', auditoriaAnteriorId: prevClave ? idPorClave[prevClave] : null, actualizadoEn: ahoraISO() });
    registrarBitacora(bf, u, {
      entidad: 'auditoria',
      entidadId: audId,
      auditoriaId: audId,
      participantes,
      accion: 'crear',
      detalle: `Auditoría histórica importada (${a.codigoOriginal || 's/n'} original) con ${a.hallazgos.length} hallazgo(s)`,
    });
    await bf.commit();
    hechas++;
  }
  onProgreso({ hechas, total: orden.length, mensaje: 'Listo' });
  return { auditorias: hechas, hallazgos: totalH };
}

// ---------- Corrección: auditorías importadas asignadas a un área de otra sucursal ----------
export function auditoriasConAreaCruzada(auditorias: Auditoria[], areas: Area[]): Auditoria[] {
  const porId = Object.fromEntries(areas.map((a) => [a.id, a]));
  return auditorias.filter((a) => a.importada && porId[a.areaId]?.sucursalId && porId[a.areaId].sucursalId !== a.sucursalId);
}

/**
 * Mueve cada auditoría importada (y sus hallazgos) al área homónima de su propia sucursal,
 * creando el área en esa sucursal si no existe. No cambia números, fechas ni contenido.
 */
export async function repararAreasCruzadas(u: Usuario, auditorias: Auditoria[], areas: Area[]) {
  const malas = auditoriasConAreaCruzada(auditorias, areas);
  const porId = Object.fromEntries(areas.map((a) => [a.id, a]));
  const lista = [...areas];
  const ahora = ahoraISO();
  let hallazgosMovidos = 0;
  for (const a of malas) {
    const vieja = porId[a.areaId];
    let destino = lista.find((x) => x.sucursalId === a.sucursalId && normalizar(x.nombre) === normalizar(vieja.nombre));
    const b = writeBatch(db);
    if (!destino) {
      const ref = doc(collection(db, COL.areas));
      destino = { id: ref.id, nombre: vieja.nombre, sucursalId: a.sucursalId, encargado: '', cargoEncargado: '', activo: true };
      b.set(ref, { nombre: destino.nombre, sucursalId: destino.sucursalId, encargado: '', cargoEncargado: '', activo: true, actualizadoEn: ahora });
      lista.push(destino);
    }
    const hs = await getDocs(query(collection(db, COL.hallazgos), where('auditoriaId', '==', a.id)));
    hs.docs.forEach((d) => b.update(d.ref, { areaId: destino!.id, actualizadoEn: ahora }));
    hallazgosMovidos += hs.size;
    b.update(doc(db, COL.auditorias, a.id), { areaId: destino.id, actualizadoEn: ahora });
    registrarBitacora(b, u, {
      entidad: 'auditoria',
      entidadId: a.id,
      auditoriaId: a.id,
      participantes: a.participantes,
      accion: 'editar',
      detalle: `Área corregida a la de su sucursal (${destino.nombre}); ${hs.size} hallazgo(s) actualizados`,
    });
    await b.commit();
  }
  return { auditorias: malas.length, hallazgos: hallazgosMovidos };
}

// ---------- Reactivar seguimiento de hallazgos históricos (por año) ----------
/**
 * Saca del histórico los hallazgos importados de un año para que vuelvan al seguimiento normal
 * (tratamiento, plazos y medición de eficacia). La auditoría sigue cerrada: el seguimiento continúa igual (RN-09).
 */
export async function reactivarHistoricoPorAnio(u: Usuario, hallazgos: Hallazgo[], anio: number, incluirOM: boolean) {
  const objetivo = hallazgos.filter((h) => h.historico && !h.anulado && h.anio === anio && (incluirOM || h.tipo === 'NC'));
  const ahora = ahoraISO();
  for (let i = 0; i < objetivo.length; i += 400) {
    const b = writeBatch(db);
    objetivo.slice(i, i + 400).forEach((h) => {
      const estado = calcularEstado({ ...h, historico: false });
      b.update(doc(db, COL.hallazgos, h.id), { historico: false, estado, actualizadoEn: ahora, actualizadoPor: u.id });
    });
    if (i === 0)
      registrarBitacora(b, u, {
        entidad: 'sistema',
        entidadId: `historico_${anio}`,
        auditoriaId: null,
        participantes: [],
        accion: 'cambio_estado',
        detalle: `Seguimiento reactivado para ${objetivo.length} hallazgo(s) históricos de ${anio}${incluirOM ? '' : ' (solo NC)'}`,
      });
    await b.commit();
  }
  return objetivo.length;
}
