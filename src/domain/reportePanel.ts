// Reporte Excel del panel de control (Inicio): portada + indicadores + comparativas + detalle.
// Respeta los filtros activos del panel. Sin dependencias: usa lib/xlsx.
import { crearXlsx, ref, type Celda, type Estilo, type Hoja, type Valor } from '../lib/xlsx';
import { plazoEfectivo, semaforoPlazo, ultimaVerificacion } from './hallazgoReglas';
import { resumenPlan, vincularPlan } from './plan';
import type { Area, Auditor, Auditoria, EstadoHallazgo, Hallazgo, Requisito, Sucursal, TipoHallazgo } from '../types';

export interface FiltrosReporte {
  anio: number | null;
  sucursalId: string;
  areaId: string;
  tipo: TipoHallazgo | '';
  estado: EstadoHallazgo | '';
}

export interface DatosReporte {
  auditorias: Auditoria[];
  hallazgos: Hallazgo[];
  sucursales: Sucursal[];
  areas: Area[];
  mapa: { areas: Record<string, Area>; sucursales: Record<string, Sucursal>; auditores: Record<string, Auditor>; requisitos: Record<string, Requisito> };
  filtros: FiltrosReporte;
  usuario: string;
  /** Momento de descarga. */
  fecha: Date;
  anioInicio: number;
}

// ---------- Paleta corporativa ----------
const AMARILLO = 'F5C400';
const OSCURO = '1F2937';
const GRIS = 'F3F4F6';
const GRIS_TXT = '6B7280';
const NC_COLOR = 'D95926';
const OM_COLOR = '2A78D6';

const S = {
  titulo: { b: true, sz: 16, color: OSCURO, v: 'center' } as Estilo,
  subtitulo: { sz: 11, color: GRIS_TXT, v: 'center' } as Estilo,
  meta: { sz: 9, color: GRIS_TXT, h: 'right', v: 'center' } as Estilo,
  filtros: { sz: 9, i: true, color: GRIS_TXT, v: 'center' } as Estilo,
  banda: { fill: AMARILLO } as Estilo,
  th: { b: true, color: 'FFFFFF', fill: OSCURO, borde: 'fino', h: 'center', v: 'center', wrap: true } as Estilo,
  td: { borde: 'fino', v: 'top', wrap: true } as Estilo,
  tdC: { borde: 'fino', h: 'center', v: 'top' } as Estilo,
  num: { borde: 'fino', h: 'center', v: 'top', fmt: 'entero' } as Estilo,
  pct: { borde: 'fino', h: 'center', v: 'top', fmt: 'pct' } as Estilo,
  tot: { b: true, borde: 'fino', fill: GRIS, v: 'center' } as Estilo,
  totN: { b: true, borde: 'fino', fill: GRIS, h: 'center', fmt: 'entero' } as Estilo,
  totP: { b: true, borde: 'fino', fill: GRIS, h: 'center', fmt: 'pct' } as Estilo,
  seccion: { b: true, sz: 12, color: OSCURO, borde: 'inferior' } as Estilo,
  texto: { wrap: true, v: 'top' } as Estilo,
  nota: { sz: 9, i: true, color: GRIS_TXT, wrap: true, v: 'top' } as Estilo,
};

const ESTADO: Record<EstadoHallazgo, string> = { no_tratada: 'No tratada', en_seguimiento: 'En seguimiento', tratada: 'Tratada' };
const ESTADO_AUD: Record<Auditoria['estado'], string> = { planificada: 'Planificada', en_ejecucion: 'En ejecución', en_revision: 'En revisión', cerrada: 'Cerrada', anulada: 'Anulada' };
const SEMAFORO = { vencido: 'Vencido', proximo: 'Por vencer', ok: 'En plazo', sin_fecha: 'Sin fecha', cerrado: 'Cerrado' } as const;
const NIVEL = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta' } as const;

const dd = (n: number) => String(n).padStart(2, '0');
const fechaHora = (d: Date) => `${dd(d.getDate())}-${dd(d.getMonth() + 1)}-${d.getFullYear()} ${dd(d.getHours())}:${dd(d.getMinutes())}`;
const iso = (d: Date) => `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000);

/** Hoja en construcción con encabezado corporativo. */
class Lienzo {
  filas: (Celda | Valor)[][] = [];
  combinar: [number, number, number, number][] = [];
  altos: Record<number, number> = {};
  constructor(readonly ncols: number) {}
  get n() { return this.filas.length; }
  fila(celdas: (Celda | Valor)[], alto?: number) {
    this.filas.push(celdas);
    if (alto) this.altos[this.filas.length - 1] = alto;
    return this.filas.length - 1;
  }
  vacia(alto?: number) { return this.fila([], alto); }
  /** Texto que ocupa todo el ancho. */
  ancho(v: Valor, s: Estilo, alto?: number, desde = 0) {
    const r = this.fila([...Array(desde).fill(null), { v, s }], alto);
    this.combinar.push([r, desde, r, this.ncols - 1]);
    return r;
  }
}

function encabezado(l: Lienzo, titulo: string, d: DatosReporte, filtrosTxt: string) {
  const ult = l.ncols - 1;
  const r0 = l.fila([null, { v: 'REPORTE DE GESTIÓN DE AUDITORÍAS INTERNAS', s: S.titulo }], 26);
  const r1 = l.fila([null, { v: `${titulo} · FMA Industrial Chile · Sistema de Gestión Integrado`, s: S.subtitulo }], 18);
  const r2 = l.fila([null, { v: `Descargado: ${fechaHora(d.fecha)} · Por: ${d.usuario}  |  Filtros: ${filtrosTxt}`, s: { ...S.filtros, wrap: true } }], ult < 6 ? 30 : 18);
  l.combinar.push([r0, 1, r0, ult], [r1, 1, r1, ult], [r2, 1, r2, ult]);
  l.fila(Array.from({ length: l.ncols }, () => ({ s: S.banda })), 4);
  l.vacia(6);
}

function hoja(nombre: string, l: Lienzo, columnas: number[], extra: Partial<Hoja> = {}): Hoja {
  return {
    nombre,
    columnas,
    filas: l.filas,
    combinar: l.combinar.filter(([a, b, c, e]) => a !== c || b !== e),
    altos: l.altos,
    imagen: { fila: 0, col: 0, anchoPx: 58, altoPx: 60, offX: 8, offY: 2 },
    horizontal: true,
    ocultarCuadricula: true,
    pieImpresion: '&L&8FMA Industrial Chile · Uso interno&C&8&A&R&8Página &P de &N',
    ...extra,
  };
}

/** Encabezados de tabla + filas + total (con fórmulas SUM/porcentajes). */
function tabla(
  l: Lienzo,
  cols: { t: string; tipo?: 'txt' | 'num' | 'pct' | 'c'; total?: 'sum' | { pct: [number, number] } | string }[],
  datos: (Valor | Celda)[][],
  opts: { pct?: Record<number, [number, number]>; conTotal?: boolean } = {},
) {
  const rh = l.fila(cols.map((c) => ({ v: c.t, s: S.th })), 40);
  const ini = l.n;
  datos.forEach((fila) => {
    const r = l.n;
    l.fila(
      fila.map((v, c) => {
        const p = opts.pct?.[c];
        if (p) return { f: `IF(${ref(r, p[1])}=0,0,${ref(r, p[0])}/${ref(r, p[1])})`, s: S.pct };
        if (v !== null && typeof v === 'object') return { ...v, s: v.s ?? S.td };
        const t = cols[c]?.tipo;
        return { v, s: t === 'num' ? S.num : t === 'c' ? S.tdC : S.td };
      }),
    );
  });
  const fin = l.n - 1;
  let rt: number | null = null;
  if (opts.conTotal && datos.length) {
    rt = l.n;
    l.fila(
      cols.map((c, i) => {
        if (i === 0) return { v: 'TOTAL', s: S.tot };
        const p = opts.pct?.[i];
        if (p) return { f: `IF(${ref(rt!, p[1])}=0,0,${ref(rt!, p[0])}/${ref(rt!, p[1])})`, s: S.totP };
        if (c.tipo === 'num') return { f: `SUM(${ref(ini, i)}:${ref(fin, i)})`, s: S.totN };
        return { v: '', s: S.tot };
      }),
      18,
    );
  }
  if (!datos.length) l.ancho('Sin datos para los filtros seleccionados.', S.nota);
  return { rh, ini, fin, rt };
}

export function construirReportePanel(d: DatosReporte, logoPng: Uint8Array | null): Uint8Array {
  const { mapa, filtros: f } = d;
  const hoy = iso(d.fecha);
  const sucDe = (h: Hallazgo) => mapa.areas[h.areaId]?.sucursalId ?? h.sucursalId;
  const nomArea = (id: string) => mapa.areas[id]?.nombre ?? 'Área sin catálogo';
  const nomSuc = (id: string | null | undefined) => (id ? mapa.sucursales[id]?.nombre ?? '—' : '—');
  const codigo = new Map(d.auditorias.map((a) => [a.id, a]));

  // ----- Filtros (idénticos al panel) -----
  const baseSinAnio = d.hallazgos.filter(
    (h) => !h.anulado && (!f.sucursalId || sucDe(h) === f.sucursalId) && (!f.areaId || h.areaId === f.areaId) && (!f.tipo || h.tipo === f.tipo) && (!f.estado || h.estado === f.estado),
  );
  const hs = baseSinAnio.filter((h) => f.anio === null || h.anio === f.anio);
  const audsSinAnio = d.auditorias.filter((a) => a.estado !== 'anulada' && (!f.sucursalId || a.sucursalId === f.sucursalId) && (!f.areaId || a.areaId === f.areaId));
  const auds = audsSinAnio.filter((a) => f.anio === null || a.anio === f.anio);

  const filtrosTxt = [
    `Periodo: ${f.anio ?? 'Todos los años'}`,
    `Sucursal: ${f.sucursalId ? nomSuc(f.sucursalId) : 'Todas'}`,
    `Área: ${f.areaId ? nomArea(f.areaId) : 'Todas'}`,
    `Tipo: ${f.tipo === 'NC' ? 'No conformidad' : f.tipo === 'OM' ? 'Oportunidad de mejora' : 'Todos'}`,
    `Tratamiento: ${f.estado ? ESTADO[f.estado] : 'Todos'}`,
  ].join(' · ');

  const nc = (l: Hallazgo[]) => l.filter((h) => h.tipo === 'NC');
  const om = (l: Hallazgo[]) => l.filter((h) => h.tipo === 'OM');
  const abiertos = (l: Hallazgo[]) => l.filter((h) => h.estado !== 'tratada');
  const vencidas = (l: Hallazgo[]) => l.filter((h) => semaforoPlazo(h) === 'vencido');
  const res = (l: Hallazgo[], r: 'eficaz' | 'no_eficaz') => l.filter((h) => ultimaVerificacion(h)?.resultado === r);

  const hojas: Hoja[] = [];
  const NOMBRES = {
    inicio: 'Inicio',
    resumen: 'Resumen',
    anual: 'Comparativa anual',
    area: 'Por área',
    sucursal: 'Por sucursal',
    clausula: 'Por cláusula',
    plan: 'Cobertura plan',
    detalle: 'Detalle hallazgos',
  };
  const ir = (n: string) => `'${n}'!A1`;

  // ================= INICIO (portada) =================
  {
    const l = new Lienzo(8);
    l.vacia(18);
    const t = l.fila([null, null, { v: 'REPORTE DE GESTIÓN DE AUDITORÍAS INTERNAS', s: { b: true, sz: 16, color: OSCURO, v: 'center' } }], 34);
    l.combinar.push([t, 2, t, 7]);
    const st = l.fila([null, null, { v: 'Sistema de Gestión Integrado · ISO 9001:2015 · ISO 14001:2026 · ISO 45001:2018', s: { sz: 11, color: GRIS_TXT, v: 'center' } }], 20);
    l.combinar.push([st, 2, st, 7]);
    const em = l.fila([null, null, { v: 'FMA Industrial Chile', s: { b: true, sz: 11, color: OSCURO, v: 'center' } }], 20);
    l.combinar.push([em, 2, em, 7]);
    l.vacia(8);
    l.fila([null, ...Array.from({ length: 7 }, () => ({ s: S.banda }))], 5);
    l.vacia(10);

    const dato = (k: string, v: string) => {
      const r = l.fila([null, { v: k, s: { b: true, fill: GRIS, borde: 'fino' } }, null, { v, s: { borde: 'fino', wrap: true } }], 18);
      l.combinar.push([r, 1, r, 2], [r, 3, r, 7]);
    };
    dato('Fecha de descarga', fechaHora(d.fecha));
    dato('Descargado por', d.usuario);
    dato('Periodo', f.anio === null ? `Todos los años (${d.anioInicio}–${d.fecha.getFullYear()})` : String(f.anio));
    dato('Sucursal', f.sucursalId ? nomSuc(f.sucursalId) : 'Todas las sucursales');
    dato('Área', f.areaId ? nomArea(f.areaId) : 'Todas las áreas');
    dato('Tipo de hallazgo', f.tipo === 'NC' ? 'No conformidad' : f.tipo === 'OM' ? 'Oportunidad de mejora' : 'Todos');
    dato('Tratamiento', f.estado ? ESTADO[f.estado] : 'Todos');
    l.vacia(12);

    const seccion = (txt: string) => {
      const r = l.fila([null, { v: txt, s: S.seccion }, ...Array.from({ length: 6 }, () => ({ s: S.seccion }))], 22);
      l.combinar.push([r, 1, r, 7]);
    };
    const parrafo = (txt: string, alto: number) => {
      const r = l.fila([null, { v: txt, s: { ...S.texto, h: 'left' } }], alto);
      l.combinar.push([r, 1, r, 7]);
    };
    seccion('1. Objetivo');
    parrafo(
      'El presente documento tiene como objetivo entregar una visión consolidada del desempeño del programa de auditorías internas del Sistema de Gestión Integrado de FMA Industrial Chile, a partir de las no conformidades (NC) y oportunidades de mejora (OM) registradas en FMA AuditoriAPP. Su finalidad es apoyar el seguimiento de las acciones comprometidas por las áreas, identificar tendencias y requisitos con mayor incumplimiento, y servir como insumo para la revisión por la dirección (cláusula 9.3 de ISO 9001, ISO 14001 e ISO 45001).',
      84,
    );
    l.vacia(8);
    seccion('2. Alcance');
    parrafo(
      'Considera las auditorías internas y hallazgos registrados en la aplicación que cumplen con los filtros indicados en este documento. Se excluyen las auditorías y hallazgos anulados. La información refleja el estado de la aplicación en la fecha y hora de descarga; cambios posteriores no se incluyen.',
      56,
    );
    l.vacia(8);
    seccion('3. Contenido');
    const indice: [string, string][] = [
      [NOMBRES.resumen, 'Indicadores clave del periodo: auditorías, NC, OM, tratamiento, vencimientos y eficacia.'],
      [NOMBRES.anual, 'Evolución por año y comparativa de hallazgos por área en los últimos años.'],
      [NOMBRES.area, 'Desempeño de cada área: hallazgos, abiertos, vencidos y eficacia.'],
      [NOMBRES.sucursal, 'Comparación entre sucursales con los mismos indicadores.'],
      [NOMBRES.clausula, 'Requisitos ISO con más hallazgos (foco de mejora y capacitación).'],
      [NOMBRES.plan, 'Porcentaje de puntos del plan de auditoría revisados por auditoría.'],
      [NOMBRES.detalle, 'Listado completo de hallazgos con estado, plazos, acciones y eficacia.'],
    ];
    indice.forEach(([n, desc]) => {
      const r = l.fila([null, { v: n, ir: ir(n), s: { link: true, b: true, v: 'top' } }, null, { v: desc, s: { ...S.texto } }], 28);
      l.combinar.push([r, 1, r, 2], [r, 3, r, 7]);
    });
    l.vacia(8);
    seccion('4. Definiciones');
    const defs: [string, string][] = [
      ['No conformidad (NC)', 'Incumplimiento de un requisito de la norma, legal o interno.'],
      ['Oportunidad de mejora (OM)', 'Situación que cumple, pero que puede mejorarse para prevenir incumplimientos futuros.'],
      ['No tratada', 'Hallazgo sin corrección ni acciones registradas.'],
      ['En seguimiento', 'Hallazgo con acciones comprometidas por el área, pendiente de verificar su eficacia.'],
      ['Tratada', 'Hallazgo con acciones implementadas y eficacia verificada (u OM cerrada con motivo).'],
      ['Vencida', 'NC abierta cuya fecha límite ya pasó. El área dispone de 3 semanas desde la emisión del informe para su seguimiento.'],
      ['Eficacia', 'Resultado de la última verificación: eficaz / no eficaz.'],
    ];
    defs.forEach(([k, v]) => {
      const r = l.fila([null, { v: k, s: { b: true, v: 'top', wrap: true } }, null, { v, s: S.texto }], 28);
      l.combinar.push([r, 1, r, 2], [r, 3, r, 7]);
    });
    l.vacia(14);
    const pie = l.fila([null, { v: 'Documento generado automáticamente por FMA AuditoriAPP. Uso interno. Las fórmulas se recalculan al abrir el archivo.', s: S.nota }], 18);
    l.combinar.push([pie, 1, pie, 7]);
    hojas.push({
      ...hoja(NOMBRES.inicio, l, [3, 16, 16, 14, 14, 14, 14, 14], { horizontal: false }),
      imagen: { fila: 1, col: 1, anchoPx: 88, altoPx: 90, offX: 10, offY: 0 },
      altos: { ...l.altos, 1: 34, 2: 20, 3: 20 },
      tabColor: AMARILLO,
    });
  }

  // ================= RESUMEN =================
  {
    const l = new Lienzo(4);
    encabezado(l, 'Resumen de indicadores', d, filtrosTxt);
    const tratados = hs.filter((h) => h.estado === 'tratada').length;
    const verif = hs.filter((h) => ultimaVerificacion(h));
    const conPlan = auds.filter((a) => a.plan?.length);
    const plan = conPlan.reduce(
      (acc, a) => {
        const r = resumenPlan(a.plan!, vincularPlan(a.plan!, d.hallazgos.filter((h) => h.auditoriaId === a.id), mapa.requisitos));
        return { total: acc.total + r.total, rev: acc.rev + r.revisados };
      },
      { total: 0, rev: 0 },
    );
    const filas: [string, number | Celda, string][] = [
      ['Auditorías del periodo', auds.length, `${auds.filter((a) => a.estado === 'cerrada').length} cerradas · ${auds.filter((a) => a.estado === 'en_ejecucion' || a.estado === 'en_revision').length} en curso · ${auds.filter((a) => a.estado === 'planificada').length} planificadas`],
      ['Hallazgos totales', hs.length, 'No conformidades + oportunidades de mejora'],
      ['No conformidades (NC)', nc(hs).length, `${abiertos(nc(hs)).length} abiertas`],
      ['Oportunidades de mejora (OM)', om(hs).length, `${abiertos(om(hs)).length} abiertas`],
      ['NC vencidas', vencidas(hs).length, 'NC abiertas con fecha límite cumplida'],
      ['Hallazgos de importancia alta', hs.filter((h) => h.nivel === 'ALTA').length, 'Nivel de importancia ALTA'],
      ['Hallazgos tratados', tratados, 'Con eficacia verificada o cerrados'],
      ['Hallazgos con verificación de eficacia', verif.length, `${res(hs, 'eficaz').length} eficaces · ${res(hs, 'no_eficaz').length} no eficaces`],
      ['Hallazgos eficaces', res(hs, 'eficaz').length, 'Última verificación: eficaz'],
      ['Puntos del plan de auditoría', plan.total, `${conPlan.length} auditoría(s) con plan`],
      ['Puntos del plan revisados', plan.rev, 'Conformes + con hallazgo + no aplica'],
    ];
    const { ini } = tabla(
      l,
      [{ t: 'Indicador' }, { t: 'Valor', tipo: 'num' }, { t: 'Detalle' }, { t: '' }],
      filas.map(([k, v, det]) => [{ v: k, s: { ...S.td, b: true } }, v, det, null]),
    );
    filas.forEach((_, i) => l.combinar.push([ini + i, 2, ini + i, 3]));
    l.combinar.push([ini - 1, 2, ini - 1, 3]);
    l.vacia(10);
    // Porcentajes con fórmula sobre la tabla anterior
    const r = (i: number) => ref(ini + i, 1);
    tabla(
      l,
      [{ t: 'Porcentaje' }, { t: 'Valor', tipo: 'pct' }, { t: 'Cálculo' }, { t: '' }],
      [
        [{ v: '% de hallazgos tratados', s: { ...S.td, b: true } }, { f: `IF(${r(1)}=0,0,${r(6)}/${r(1)})`, s: S.pct }, 'Tratados / hallazgos totales', null],
        [{ v: '% de NC vencidas', s: { ...S.td, b: true } }, { f: `IF(${r(2)}=0,0,${r(4)}/${r(2)})`, s: S.pct }, 'NC vencidas / NC totales', null],
        [{ v: '% de eficacia', s: { ...S.td, b: true } }, { f: `IF(${r(7)}=0,0,${r(8)}/${r(7)})`, s: S.pct }, 'Eficaces / hallazgos verificados', null],
        [{ v: '% de cobertura del plan', s: { ...S.td, b: true } }, { f: `IF(${r(9)}=0,0,${r(10)}/${r(9)})`, s: S.pct }, 'Puntos revisados / puntos del plan', null],
      ],
    );
    const fin = l.n - 4;
    for (let i = 0; i < 4; i++) l.combinar.push([fin + i, 2, fin + i, 3]);
    l.combinar.push([fin - 1, 2, fin - 1, 3]);
    l.vacia(10);
    const iniEst = l.n + 1;
    tabla(
      l,
      [{ t: 'Estado de tratamiento' }, { t: 'NC', tipo: 'num' }, { t: 'OM', tipo: 'num' }, { t: 'Total', tipo: 'num' }],
      (['no_tratada', 'en_seguimiento', 'tratada'] as EstadoHallazgo[]).map((e, i) => {
        const del = hs.filter((h) => h.estado === e);
        const row = iniEst + i;
        return [ESTADO[e], nc(del).length, om(del).length, { f: `SUM(${ref(row, 1)}:${ref(row, 2)})`, s: S.num }];
      }),
      { conTotal: true },
    );
    hojas.push(hoja(NOMBRES.resumen, l, [38, 14, 38, 30], { horizontal: false }));
  }

  // ================= COMPARATIVA ANUAL =================
  {
    const anioFin = Math.max(d.fecha.getFullYear(), ...baseSinAnio.map((h) => h.anio));
    const anioIni = Math.min(d.anioInicio, ...baseSinAnio.map((h) => h.anio), ...audsSinAnio.map((a) => a.anio));
    const anios = Array.from({ length: anioFin - anioIni + 1 }, (_, i) => anioIni + i);
    const ncols = Math.max(9, anios.length + 3);
    const l = new Lienzo(ncols);
    encabezado(l, 'Comparativa anual', d, filtrosTxt.replace(/Periodo: [^·]+· /, 'Periodo: todos los años (comparativa) · '));
    l.ancho('Evolución por año', S.seccion, 22);
    const cols = [
      { t: 'Año', tipo: 'c' as const },
      { t: 'Auditorías', tipo: 'num' as const },
      { t: 'NC', tipo: 'num' as const },
      { t: 'OM', tipo: 'num' as const },
      { t: 'Total hallazgos', tipo: 'num' as const },
      { t: 'NC tratadas', tipo: 'num' as const },
      { t: '% NC tratadas', tipo: 'pct' as const },
      { t: 'Variación NC vs año anterior', tipo: 'pct' as const },
      { t: 'Variación total vs año anterior', tipo: 'pct' as const },
    ];
    const ini0 = l.n + 1;
    tabla(
      l,
      cols,
      anios.map((y, i) => {
        const del = baseSinAnio.filter((h) => h.anio === y);
        const r = ini0 + i;
        const variacion = (c: number): Celda =>
          i === 0 ? { v: '—', s: S.tdC } : { f: `IF(${ref(r - 1, c)}=0,"—",(${ref(r, c)}-${ref(r - 1, c)})/${ref(r - 1, c)})`, s: S.pct };
        return [
          String(y),
          audsSinAnio.filter((a) => a.anio === y).length,
          nc(del).length,
          om(del).length,
          { f: `SUM(${ref(r, 2)}:${ref(r, 3)})`, s: S.num },
          nc(del).filter((h) => h.estado === 'tratada').length,
          null,
          variacion(2),
          variacion(4),
        ];
      }),
      { pct: { 6: [5, 2] }, conTotal: true },
    );
    // la fila TOTAL no lleva variación
    const tot = l.n - 1;
    l.filas[tot][7] = { v: '', s: S.tot };
    l.filas[tot][8] = { v: '', s: S.tot };
    l.vacia(12);

    const ultimos = anios.slice(-4);
    l.ancho(`Hallazgos por área (${ultimos[0]}–${ultimos[ultimos.length - 1]})`, S.seccion, 22);
    const areasVis = d.areas
      .filter((a) => (!f.sucursalId || a.sucursalId === f.sucursalId) && (!f.areaId || a.id === f.areaId))
      .sort((a, b) => nomSuc(a.sucursalId).localeCompare(nomSuc(b.sucursalId)) || a.nombre.localeCompare(b.nombre));
    const ini1 = l.n + 1;
    const cUlt = 2 + ultimos.length - 1;
    tabla(
      l,
      [{ t: 'Área' }, { t: 'Sucursal' }, ...ultimos.map((y) => ({ t: String(y), tipo: 'num' as const })), { t: `Tendencia (${ultimos[ultimos.length - 1]} vs ${ultimos[ultimos.length - 2] ?? '—'})` }],
      areasVis.map((a, i) => {
        const r = ini1 + i;
        return [
          a.nombre,
          nomSuc(a.sucursalId),
          ...ultimos.map((y) => baseSinAnio.filter((h) => h.areaId === a.id && h.anio === y).length),
          ultimos.length > 1
            ? { f: `IF(${ref(r, cUlt)}<${ref(r, cUlt - 1)},"▼ Mejora",IF(${ref(r, cUlt)}>${ref(r, cUlt - 1)},"▲ Aumenta","= Igual"))`, s: S.tdC }
            : { v: '—', s: S.tdC },
        ];
      }),
      { conTotal: true },
    );
    l.ancho('Tendencia: menos hallazgos que el año anterior se interpreta como mejora; revisar junto con la cobertura del plan (menos puntos auditados también reduce hallazgos).', S.nota, 30);
    const anchos = [26, 16, ...Array(Math.max(7, ultimos.length + 1)).fill(13)];
    anchos[0] = 26;
    hojas.push(hoja(NOMBRES.anual, l, anchos, { fijarFilas: 5 }));
  }

  // ================= POR ÁREA / POR SUCURSAL =================
  const colsDesempeno = [
    { t: 'Auditorías', tipo: 'num' as const },
    { t: 'NC', tipo: 'num' as const },
    { t: 'OM', tipo: 'num' as const },
    { t: 'Total', tipo: 'num' as const },
    { t: 'Abiertos', tipo: 'num' as const },
    { t: 'NC vencidas', tipo: 'num' as const },
    { t: 'Tratados', tipo: 'num' as const },
    { t: '% tratados', tipo: 'pct' as const },
    { t: 'Eficaces', tipo: 'num' as const },
    { t: 'No eficaces', tipo: 'num' as const },
    { t: 'Importancia alta', tipo: 'num' as const },
  ];
  const desempeno = (del: Hallazgo[], nAud: number, r: number, off: number): (Valor | Celda)[] => [
    nAud,
    nc(del).length,
    om(del).length,
    { f: `SUM(${ref(r, off + 1)}:${ref(r, off + 2)})`, s: S.num },
    abiertos(del).length,
    vencidas(del).length,
    del.filter((h) => h.estado === 'tratada').length,
    null,
    res(del, 'eficaz').length,
    res(del, 'no_eficaz').length,
    del.filter((h) => h.nivel === 'ALTA').length,
  ];
  {
    const l = new Lienzo(13);
    encabezado(l, 'Desempeño por área', d, filtrosTxt);
    const areasIds = [...new Set([...hs.map((h) => h.areaId), ...auds.map((a) => a.areaId)])];
    const filas = areasIds
      .map((id) => ({ id, del: hs.filter((h) => h.areaId === id), nAud: auds.filter((a) => a.areaId === id).length }))
      .sort((a, b) => b.del.length - a.del.length || nomArea(a.id).localeCompare(nomArea(b.id)));
    const ini = l.n + 1;
    tabla(
      l,
      [{ t: 'Área' }, { t: 'Sucursal' }, ...colsDesempeno],
      filas.map((x, i) => [nomArea(x.id), nomSuc(mapa.areas[x.id]?.sucursalId), ...desempeno(x.del, x.nAud, ini + i, 2)]),
      { pct: { 9: [8, 5] }, conTotal: true },
    );
    l.ancho('Ordenado de mayor a menor cantidad de hallazgos. "Abiertos" = no tratados + en seguimiento.', S.nota, 20);
    hojas.push(hoja(NOMBRES.area, l, [28, 14, 11, 8, 8, 9, 10, 11, 10, 11, 10, 11, 12], { fijarFilas: 6, autofiltro: filas.length ? [5, 0, 5 + filas.length, 12] : undefined }));
  }
  {
    const l = new Lienzo(12);
    encabezado(l, 'Comparación por sucursal', d, filtrosTxt);
    const sucs = d.sucursales.filter((s) => !f.sucursalId || s.id === f.sucursalId);
    const ini = l.n + 1;
    tabla(
      l,
      [{ t: 'Sucursal' }, ...colsDesempeno],
      sucs.map((s, i) => [s.nombre, ...desempeno(hs.filter((h) => sucDe(h) === s.id), auds.filter((a) => a.sucursalId === s.id).length, ini + i, 1)]),
      { pct: { 8: [7, 4] }, conTotal: true },
    );
    hojas.push(hoja(NOMBRES.sucursal, l, [26, 11, 8, 8, 9, 10, 11, 10, 11, 10, 11, 12], { fijarFilas: 6 }));
  }

  // ================= POR CLÁUSULA =================
  {
    const l = new Lienzo(7);
    encabezado(l, 'Requisitos con más hallazgos', d, filtrosTxt);
    const cuenta = new Map<string, { req: Requisito; nc: number; om: number }>();
    hs.forEach((h) =>
      new Set(h.requisitoIds).forEach((id) => {
        const req = mapa.requisitos[id];
        if (!req) return;
        const x = cuenta.get(id) ?? { req, nc: 0, om: 0 };
        if (h.tipo === 'NC') x.nc++;
        else x.om++;
        cuenta.set(id, x);
      }),
    );
    const filas = [...cuenta.values()].sort((a, b) => b.nc + b.om - (a.nc + a.om) || b.nc - a.nc);
    const ini = l.n + 1;
    const fin = ini + filas.length - 1;
    tabla(
      l,
      [{ t: 'Norma' }, { t: 'Cláusula', tipo: 'c' }, { t: 'Requisito' }, { t: 'NC', tipo: 'num' }, { t: 'OM', tipo: 'num' }, { t: 'Total', tipo: 'num' }, { t: '% del total', tipo: 'pct' }],
      filas.map((x, i) => {
        const r = ini + i;
        return [x.req.norma, x.req.clausula, x.req.titulo, x.nc, x.om, { f: `SUM(${ref(r, 3)}:${ref(r, 4)})`, s: S.num }, { f: `IF(SUM($F$${ini + 1}:$F$${fin + 1})=0,0,${ref(r, 5)}/SUM($F$${ini + 1}:$F$${fin + 1}))`, s: S.pct }];
      }),
      { conTotal: true },
    );
    if (filas.length) l.filas[l.n - 1][6] = { v: '', s: S.tot };
    l.ancho('Un hallazgo asociado a varias cláusulas se cuenta en cada una de ellas.', S.nota, 20);
    hojas.push(hoja(NOMBRES.clausula, l, [14, 11, 50, 9, 9, 10, 12], { fijarFilas: 6, autofiltro: filas.length ? [5, 0, 5 + filas.length, 6] : undefined }));
  }

  // ================= COBERTURA DEL PLAN =================
  {
    const l = new Lienzo(11);
    encabezado(l, 'Cobertura del plan de auditoría', d, filtrosTxt);
    const lista = auds.filter((a) => a.plan?.length).sort((a, b) => b.anio - a.anio || a.numero - b.numero);
    const ini = l.n + 1;
    tabla(
      l,
      [{ t: 'Auditoría', tipo: 'c' }, { t: 'Año', tipo: 'c' }, { t: 'Sucursal' }, { t: 'Área' }, { t: 'Estado' }, { t: 'Puntos', tipo: 'num' }, { t: 'Conformes', tipo: 'num' }, { t: 'Con hallazgo', tipo: 'num' }, { t: 'No aplica', tipo: 'num' }, { t: 'Pendientes', tipo: 'num' }, { t: '% revisado', tipo: 'pct' }],
      lista.map((a, i) => {
        const r = resumenPlan(a.plan!, vincularPlan(a.plan!, d.hallazgos.filter((h) => h.auditoriaId === a.id), mapa.requisitos));
        const row = ini + i;
        return [a.codigo, String(a.anio), nomSuc(a.sucursalId), nomArea(a.areaId), ESTADO_AUD[a.estado], r.total, r.conforme, r.hallazgo, r.noAplica, r.pendiente, { f: `IF(${ref(row, 5)}=0,0,(${ref(row, 5)}-${ref(row, 9)})/${ref(row, 5)})`, s: S.pct }];
      }),
      { conTotal: true },
    );
    if (lista.length) {
      const rt = l.n - 1;
      l.filas[rt][10] = { f: `IF(${ref(rt, 5)}=0,0,(${ref(rt, 5)}-${ref(rt, 9)})/${ref(rt, 5)})`, s: S.totP };
    }
    l.ancho('Solo auditorías con plan cargado. % revisado = (puntos − pendientes) / puntos.', S.nota, 20);
    hojas.push(hoja(NOMBRES.plan, l, [12, 8, 14, 28, 14, 9, 11, 12, 10, 11, 12], { fijarFilas: 6 }));
  }

  // ================= DETALLE =================
  {
    const l = new Lienzo(19);
    encabezado(l, 'Detalle de hallazgos', d, filtrosTxt);
    const lista = [...hs].sort((a, b) => b.anio - a.anio || (codigo.get(a.auditoriaId)?.numero ?? 0) - (codigo.get(b.auditoriaId)?.numero ?? 0) || a.correlativo - b.correlativo);
    tabla(
      l,
      [
        { t: 'Auditoría', tipo: 'c' }, { t: 'Año', tipo: 'c' }, { t: 'Sucursal' }, { t: 'Área' }, { t: 'N°', tipo: 'num' }, { t: 'Tipo', tipo: 'c' }, { t: 'Importancia', tipo: 'c' },
        { t: 'Cláusulas' }, { t: 'Descripción del hallazgo' }, { t: 'Fecha detección', tipo: 'c' }, { t: 'Fecha límite', tipo: 'c' }, { t: 'Días de atraso', tipo: 'num' },
        { t: 'Tratamiento', tipo: 'c' }, { t: 'Plazo', tipo: 'c' }, { t: 'Acciones (impl./total)', tipo: 'c' }, { t: 'Responsable(s)' }, { t: 'Última verificación', tipo: 'c' }, { t: 'Eficacia', tipo: 'c' }, { t: 'Auditor responsable' },
      ],
      lista.map((h) => {
        const sem = semaforoPlazo(h);
        const v = ultimaVerificacion(h);
        const cls = h.requisitoIds.map((id) => mapa.requisitos[id]).filter(Boolean).map((r) => `${r.norma.replace('ISO ', '')} ${r.clausula}`).join('\n');
        const color = h.tipo === 'NC' ? NC_COLOR : OM_COLOR;
        return [
          codigo.get(h.auditoriaId)?.codigo ?? '—',
          String(h.anio),
          nomSuc(sucDe(h)),
          nomArea(h.areaId),
          h.correlativo,
          { v: h.tipo, s: { ...S.tdC, b: true, color } },
          NIVEL[h.nivel],
          cls || '—',
          h.descripcion.replace(/\r/g, ''),
          { fecha: h.fechaDeteccion, s: S.tdC },
          plazoEfectivo(h) ? { fecha: plazoEfectivo(h), s: S.tdC } : { v: h.tipo === 'OM' ? 'No aplica' : '—', s: S.tdC },
          sem === 'vencido' && plazoEfectivo(h) ? diasEntre(plazoEfectivo(h)!, hoy) : null,
          ESTADO[h.estado],
          { v: SEMAFORO[sem], s: { ...S.tdC, b: sem === 'vencido', color: sem === 'vencido' ? 'C0392B' : sem === 'proximo' ? 'B7791F' : undefined } },
          `${h.acciones.filter((a) => a.implementada).length}/${h.acciones.length}`,
          [...new Set(h.acciones.map((a) => a.responsable).filter(Boolean))].join(', ') || '—',
          v ? { fecha: v.fecha, s: S.tdC } : { v: '—', s: S.tdC },
          v ? (v.resultado === 'eficaz' ? 'Eficaz' : 'No eficaz') : 'Por verificar',
          h.auditorResponsableId ? mapa.auditores[h.auditorResponsableId]?.nombre ?? '—' : '—',
        ];
      }),
    );
    hojas.push(
      hoja(NOMBRES.detalle, l, [11, 7, 13, 22, 6, 7, 11, 13, 60, 12, 12, 10, 14, 11, 12, 22, 13, 12, 20], {
        fijarFilas: 6,
        autofiltro: lista.length ? [5, 0, 5 + lista.length, 18] : undefined,
      }),
    );
  }

  return crearXlsx({ hojas, logoPng, titulo: 'Reporte de gestión de auditorías internas', autor: d.usuario });
}

export const nombreArchivoReporte = (d: Date, anio: number | null) =>
  `Reporte auditorias internas FMA ${anio ?? 'todos los años'} (${iso(d)}).xlsx`;
