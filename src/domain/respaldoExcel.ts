// Respaldo en Excel: una hoja por entidad, con portada e índice enlazado. Pensado para lectura y auditoría externa;
// el JSON es el respaldo íntegro (restaurable).
import { crearXlsx, type Celda, type Estilo, type Hoja, type Valor } from '../lib/xlsx';
import { plazoEfectivo } from './hallazgoReglas';
import type { Accion, AnalisisCausa, Hallazgo, Verificacion } from '../types';
import type { Doc, Respaldo } from '../services/respaldo';

const AMARILLO = 'F5C400';
const OSCURO = '1F2937';
const GRIS_TXT = '6B7280';

const S = {
  titulo: { b: true, sz: 15, color: OSCURO, v: 'center' } as Estilo,
  sub: { sz: 9, color: GRIS_TXT, v: 'center' } as Estilo,
  banda: { fill: AMARILLO } as Estilo,
  th: { b: true, color: 'FFFFFF', fill: OSCURO, borde: 'fino', h: 'center', v: 'center', wrap: true } as Estilo,
  td: { borde: 'fino', v: 'top', wrap: true } as Estilo,
  tdC: { borde: 'fino', h: 'center', v: 'top' } as Estilo,
  num: { borde: 'fino', h: 'center', v: 'top', fmt: 'entero' } as Estilo,
  link: { borde: 'fino', v: 'top', link: true } as Estilo,
};

type Col = { t: string; w: number; tipo?: 'txt' | 'c' | 'num' | 'fecha' };
type V = string | number | boolean | null | undefined;

const dd = (n: number) => String(n).padStart(2, '0');
const fechaHora = (iso: string) => {
  const d = new Date(iso);
  return `${dd(d.getDate())}-${dd(d.getMonth() + 1)}-${d.getFullYear()} ${dd(d.getHours())}:${dd(d.getMinutes())}`;
};
const EST_H: Record<string, string> = { no_tratada: 'No tratada', en_seguimiento: 'En seguimiento', tratada: 'Tratada' };
const EST_A: Record<string, string> = { planificada: 'Planificada', en_ejecucion: 'En ejecución', en_revision: 'En revisión', cerrada: 'Cerrada', anulada: 'Anulada' };
const NIVEL: Record<string, string> = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta' };
const ROL: Record<string, string> = { auditor_lider: 'Auditor líder', auditor_sistema: 'Auditor de sistema', auditor: 'Auditor' };
const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const si = (b: unknown) => (b ? 'Sí' : 'No');

function hojaTabla(nombre: string, titulo: string, r: Respaldo, cols: Col[], datos: V[][], tabColor?: string): Hoja {
  const ult = cols.length - 1;
  const filas: (Celda | Valor)[][] = [
    [null, { v: titulo, s: S.titulo }],
    [null, { v: `FMA Industrial Chile · Respaldo generado el ${fechaHora(r.generado)} por ${r.generadoPor.nombre} · ${datos.length} registro(s)`, s: S.sub }],
    Array.from({ length: cols.length }, () => ({ s: S.banda })),
    [],
    cols.map((c) => ({ v: c.t, s: S.th })),
    ...datos.map((fila) =>
      fila.map((v, i): Celda => {
        const t = cols[i].tipo ?? 'txt';
        if (t === 'fecha') return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? { fecha: v.slice(0, 10), s: S.tdC } : { v: '—', s: S.tdC };
        if (t === 'num') return { v: typeof v === 'number' ? v : v === null || v === undefined || v === '' ? null : Number(v), s: S.num };
        return { v: typeof v === 'boolean' ? si(v) : (v as Valor), s: t === 'c' ? S.tdC : S.td };
      }),
    ),
  ];
  return {
    nombre,
    columnas: cols.map((c) => c.w),
    filas,
    altos: { 0: 30, 1: 18, 2: 4, 4: 30 },
    combinar: ult >= 1 ? [[0, 1, 0, ult], [1, 1, 1, ult]] : [],
    fijarFilas: 5,
    autofiltro: datos.length ? [4, 0, 4 + datos.length, ult] : undefined,
    imagen: { fila: 0, col: 0, anchoPx: 44, altoPx: 45, offX: 6, offY: 2 },
    horizontal: true,
    ocultarCuadricula: true,
    tabColor,
    pieImpresion: '&L&8FMA Industrial Chile · Respaldo · Uso interno&C&8&A&R&8Página &P de &N',
  };
}

export function construirRespaldoExcel(r: Respaldo, logoPng: Uint8Array | null): Uint8Array {
  const c = (n: string) => (r.colecciones[n] ?? []) as Doc[];
  const porId = (n: string) => Object.fromEntries(c(n).map((d) => [d.id, d]));
  const suc = porId('sucursales');
  const areas = porId('areas');
  const auditores = porId('auditores');
  const auds = porId('auditorias');
  const reqs = porId('requisitos');
  const nom = (m: Record<string, Doc>, id: unknown) => (id ? s(m[String(id)]?.nombre) || '—' : '—');
  const hallazgos = c('hallazgos') as unknown as Hallazgo[];
  const refH = (h: Hallazgo) => `${s(auds[h.auditoriaId]?.codigo) || '—'} #${h.correlativo}`;
  const sucDeArea = (areaId: string) => nom(suc, areas[areaId]?.sucursalId);

  const hojas: Hoja[] = [];

  // ---------- Auditorías ----------
  const audList = c('auditorias').sort((a, b) => Number(b.anio) - Number(a.anio) || Number(a.numero) - Number(b.numero));
  hojas.push(
    hojaTabla('Auditorías', 'Auditorías internas', r, [
      { t: 'Código', w: 12, tipo: 'c' }, { t: 'Año', w: 7, tipo: 'c' }, { t: 'Sucursal', w: 14 }, { t: 'Área', w: 26 }, { t: 'Estado', w: 13, tipo: 'c' },
      { t: 'F. planificada', w: 12, tipo: 'fecha' }, { t: 'F. realización', w: 12, tipo: 'fecha' }, { t: 'Auditor líder', w: 22 }, { t: 'Equipo', w: 28 }, { t: 'Normas', w: 22 },
      { t: 'Hallazgos', w: 10, tipo: 'num' }, { t: 'NC', w: 7, tipo: 'num' }, { t: 'OM', w: 7, tipo: 'num' }, { t: 'Informe (versión)', w: 10, tipo: 'num' }, { t: 'Importada', w: 10, tipo: 'c' }, { t: 'N° original', w: 12, tipo: 'c' }, { t: 'ID', w: 24 },
    ], audList.map((a) => {
      const hs = hallazgos.filter((h) => h.auditoriaId === a.id && !h.anulado);
      return [s(a.codigo), Number(a.anio), nom(suc, a.sucursalId), nom(areas, a.areaId), EST_A[s(a.estado)] ?? s(a.estado), s(a.fechaPlanificada), s(a.fechaRealizacion), nom(auditores, a.auditorLiderId), ((a.equipoIds as string[]) ?? []).map((id) => nom(auditores, id)).join(', '), ((a.normas as string[]) ?? []).join(', '), hs.length, hs.filter((h) => h.tipo === 'NC').length, hs.filter((h) => h.tipo === 'OM').length, Number(a.informeVersion ?? 0), Boolean(a.importada), s(a.codigoOriginal), a.id];
    }), '1F2937'),
  );

  // ---------- Hallazgos ----------
  const hsOrden = [...hallazgos].sort((a, b) => b.anio - a.anio || refH(a).localeCompare(refH(b), 'es', { numeric: true }));
  hojas.push(
    hojaTabla('Hallazgos', 'Hallazgos (NC y OM)', r, [
      { t: 'Hallazgo', w: 13, tipo: 'c' }, { t: 'Año', w: 7, tipo: 'c' }, { t: 'Sucursal', w: 14 }, { t: 'Área', w: 24 }, { t: 'Tipo', w: 7, tipo: 'c' }, { t: 'Nivel', w: 9, tipo: 'c' },
      { t: 'Normas', w: 18 }, { t: 'Requisitos', w: 30 }, { t: 'Descripción', w: 70 }, { t: 'F. detección', w: 12, tipo: 'fecha' }, { t: 'Plazo seguimiento', w: 12, tipo: 'fecha' },
      { t: 'Estado', w: 14, tipo: 'c' }, { t: 'Corrección', w: 40 }, { t: 'Causa raíz', w: 40 }, { t: 'Acciones (impl./total)', w: 12, tipo: 'c' }, { t: 'Última verificación', w: 12, tipo: 'fecha' }, { t: 'Resultado', w: 12, tipo: 'c' }, { t: 'Anulado', w: 9, tipo: 'c' }, { t: 'Histórico', w: 9, tipo: 'c' }, { t: 'ID', w: 24 },
    ], hsOrden.map((h) => {
      const ver = [...(h.verificaciones ?? [])].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];
      const acc = h.acciones ?? [];
      return [refH(h), h.anio, sucDeArea(h.areaId), nom(areas, h.areaId), h.tipo, NIVEL[h.nivel] ?? h.nivel, (h.normas ?? []).join(', '), (h.requisitoIds ?? []).map((id) => (reqs[id] ? `${s(reqs[id].norma).replace('ISO ', '')} ${s(reqs[id].clausula)}` : id)).join('; '), h.descripcion, h.fechaDeteccion, plazoEfectivo(h), EST_H[h.estado] ?? h.estado, h.correccion, (h.analisisCausa as AnalisisCausa | undefined)?.causaRaiz ?? '', `${acc.filter((a) => a.implementada).length}/${acc.length}`, ver?.fecha ?? null, ver ? (ver.resultado === 'eficaz' ? 'Eficaz' : 'No eficaz') : '', Boolean(h.anulado), Boolean((h as { historico?: boolean }).historico), h.id];
    }), 'D95926'),
  );

  // ---------- Acciones ----------
  const acciones = hsOrden.flatMap((h) => (h.acciones ?? []).map((a: Accion) => ({ h, a })));
  hojas.push(
    hojaTabla('Acciones', 'Acciones correctivas y de mejora', r, [
      { t: 'Hallazgo', w: 13, tipo: 'c' }, { t: 'Área', w: 24 }, { t: 'Tipo', w: 12, tipo: 'c' }, { t: 'Descripción', w: 60 }, { t: 'Responsable', w: 24 }, { t: 'F. compromiso', w: 12, tipo: 'fecha' }, { t: 'Implementada', w: 12, tipo: 'c' }, { t: 'F. implementación', w: 13, tipo: 'fecha' },
    ], acciones.map(({ h, a }) => [refH(h), nom(areas, h.areaId), a.tipo === 'correctiva' ? 'Correctiva' : 'Mejora', a.descripcion, a.responsable, a.fechaCompromiso, a.implementada, a.fechaImplementacion])),
  );

  // ---------- Verificaciones ----------
  const verifs = hsOrden.flatMap((h) => (h.verificaciones ?? []).map((v: Verificacion) => ({ h, v })));
  hojas.push(
    hojaTabla('Verificaciones', 'Verificaciones de eficacia', r, [
      { t: 'Hallazgo', w: 13, tipo: 'c' }, { t: 'Área', w: 24 }, { t: 'Fecha', w: 12, tipo: 'fecha' }, { t: 'Resultado', w: 12, tipo: 'c' }, { t: 'Análisis', w: 70 }, { t: 'Auditor', w: 22 }, { t: 'Verificado en', w: 13, tipo: 'c' },
    ], verifs.map(({ h, v }) => [refH(h), nom(areas, h.areaId), v.fecha, v.resultado === 'eficaz' ? 'Eficaz' : 'No eficaz', v.analisis, nom(auditores, v.auditorId), v.auditoriaId ? s(auds[v.auditoriaId]?.codigo) : '—']), '0CA30C'),
  );

  // ---------- Programa ----------
  const TIPO: Record<string, string> = { auditoria: 'Auditoría', seguimiento: 'Seguimiento', eficacia: 'Medición de eficacia' };
  hojas.push(
    hojaTabla('Programa', 'Programa anual de actividades', r, [
      { t: 'Fecha', w: 12, tipo: 'fecha' }, { t: 'Año', w: 7, tipo: 'c' }, { t: 'Actividad', w: 20 }, { t: 'Sucursal', w: 14 }, { t: 'Área', w: 26 }, { t: 'Auditor líder', w: 22 }, { t: 'Equipo', w: 28 }, { t: 'Estado', w: 14, tipo: 'c' }, { t: 'Auditoría vinculada', w: 13, tipo: 'c' }, { t: 'Notas', w: 50 },
    ], c('programa').sort((a, b) => s(a.fecha).localeCompare(s(b.fecha))).map((p) => [s(p.fecha), Number(p.anio), TIPO[s(p.tipo) || 'auditoria'], nom(suc, p.sucursalId), nom(areas, p.areaId), nom(auditores, p.auditorLiderId), ((p.equipoIds as string[]) ?? []).map((id) => nom(auditores, id)).join(', '), p.cancelado ? 'Cancelada' : p.realizadoEn ? 'Realizada' : 'Programada', p.auditoriaId ? s(auds[String(p.auditoriaId)]?.codigo) : '—', s(p.notas)]), 'F5C400'),
  );

  // ---------- Catálogos ----------
  hojas.push(
    hojaTabla('Áreas', 'Áreas por sucursal', r, [
      { t: 'Sucursal', w: 16 }, { t: 'Área', w: 30 }, { t: 'Encargado', w: 26 }, { t: 'Cargo', w: 22 }, { t: 'Puntos del plan', w: 10, tipo: 'num' }, { t: 'Activa', w: 9, tipo: 'c' }, { t: 'ID', w: 24 },
    ], c('areas').sort((a, b) => nom(suc, a.sucursalId).localeCompare(nom(suc, b.sucursalId)) || s(a.nombre).localeCompare(s(b.nombre))).map((a) => [nom(suc, a.sucursalId), s(a.nombre), s(a.encargado) || '—', s(a.cargoEncargado), ((a.plan as unknown[]) ?? []).length, Boolean(a.activo), a.id])),
    hojaTabla('Auditores', 'Equipo auditor', r, [
      { t: 'Nombre', w: 28 }, { t: 'Cargo', w: 24 }, { t: 'Sucursal', w: 14 }, { t: 'Área de origen', w: 26 }, { t: 'Activo', w: 9, tipo: 'c' }, { t: 'ID', w: 24 },
    ], c('auditores').sort((a, b) => s(a.nombre).localeCompare(s(b.nombre))).map((a) => [s(a.nombre), s(a.cargo), nom(suc, a.sucursalId), nom(areas, a.areaOrigenId), Boolean(a.activo), a.id])),
    hojaTabla('Usuarios', 'Usuarios de la app', r, [
      { t: 'Nombre', w: 28 }, { t: 'Correo', w: 30 }, { t: 'Rol', w: 18, tipo: 'c' }, { t: 'Auditor vinculado', w: 26 }, { t: 'Activo', w: 9, tipo: 'c' },
    ], c('usuarios').sort((a, b) => s(a.nombre).localeCompare(s(b.nombre))).map((x) => [s(x.nombre), s(x.email), ROL[s(x.rol)] ?? s(x.rol), nom(auditores, x.auditorId), Boolean(x.activo)])),
    hojaTabla('Requisitos', 'Requisitos ISO', r, [
      { t: 'Norma', w: 12, tipo: 'c' }, { t: 'Cláusula', w: 10, tipo: 'c' }, { t: 'Título', w: 60 }, { t: 'Activo', w: 9, tipo: 'c' },
    ], c('requisitos').sort((a, b) => Number(a.orden) - Number(b.orden)).map((q) => [s(q.norma), s(q.clausula), s(q.titulo), q.activo !== false])),
    hojaTabla('Bitácora', 'Bitácora de cambios', r, [
      { t: 'Fecha', w: 17, tipo: 'c' }, { t: 'Usuario', w: 24 }, { t: 'Entidad', w: 12, tipo: 'c' }, { t: 'Acción', w: 16, tipo: 'c' }, { t: 'Auditoría', w: 12, tipo: 'c' }, { t: 'Detalle', w: 80 },
    ], c('bitacora').sort((a, b) => (s(a.fecha) < s(b.fecha) ? 1 : -1)).map((b) => [b.fecha ? fechaHora(s(b.fecha)) : '', s(b.usuarioNombre), s(b.entidad), s(b.accion), b.auditoriaId ? s(auds[String(b.auditoriaId)]?.codigo) || '—' : '—', s(b.detalle)])),
  );

  // ---------- Portada (primera hoja) ----------
  const errores = Object.entries(r.errores);
  const info = (k: string, v: string): (Celda | Valor)[] => [null, { v: k, s: { b: true, v: 'top' } }, { v, s: { wrap: true, v: 'top' } }];
  const filasP: (Celda | Valor)[][] = [
    [null, { v: 'Respaldo de datos · FMA AuditoriAPP', s: S.titulo }],
    [null, { v: 'Sistema de Gestión Integrado · ISO 9001 · ISO 14001 · ISO 45001', s: S.sub }],
    Array.from({ length: 4 }, () => ({ s: S.banda })),
    [],
    info('Generado', fechaHora(r.generado)),
    info('Por', `${r.generadoPor.nombre} (${r.generadoPor.email})`),
    info('Fotos de evidencia', r.incluyeFotos ? 'Incluidas en el respaldo JSON' : 'No incluidas (solo metadatos)'),
    info('Uso', 'Lectura y auditoría. El respaldo íntegro y restaurable es el archivo JSON generado en la misma fecha.'),
    [],
    [null, { v: 'Hoja', s: S.th }, { v: 'Registros', s: S.th }],
    ...hojas.map((h): (Celda | Valor)[] => [null, { v: h.nombre, s: S.link, ir: `'${h.nombre}'!A1` }, { v: Math.max(0, h.filas.length - 5), s: S.num }]),
  ];
  if (errores.length) {
    filasP.push([], [null, { v: 'Colecciones no leídas', s: { b: true, color: 'C0392B' } }]);
    errores.forEach(([k, e]) => filasP.push([null, { v: k, s: S.td }, { v: e, s: S.td }]));
  }
  const portada: Hoja = {
    nombre: 'Portada',
    columnas: [9, 26, 70],
    filas: filasP,
    altos: { 0: 34, 1: 18, 2: 4, 7: 30 },
    combinar: [[0, 1, 0, 2], [1, 1, 1, 2]],
    imagen: { fila: 0, col: 0, anchoPx: 46, altoPx: 47, offX: 6, offY: 2 },
    ocultarCuadricula: true,
    tabColor: 'F5C400',
  };
  return crearXlsx({ hojas: [portada, ...hojas], logoPng, titulo: 'Respaldo FMA AuditoriAPP', autor: r.generadoPor.nombre });
}
