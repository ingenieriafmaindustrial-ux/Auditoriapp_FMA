// Informe anual del programa de auditorías internas (insumo para la revisión por la dirección, ISO 9.3).
// 1) datosInformeAnual: cálculo puro a partir de los datos de la app.
// 2) construirInformeAnualPdf: PDF A4 con logo, secciones, gráficos y firmas (sin dependencias).
import { envolver, PdfDoc, type ImagenJpeg } from '../lib/pdf';
import { diasHasta, fmtFecha } from '../lib/dates';
import { plazoEfectivo, semaforoPlazo } from './hallazgoReglas';
import { construirEventos } from './programa';
import type { Area, Auditor, Auditoria, Hallazgo, ProgramaItem, Sucursal } from '../types';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export interface DatosInformeAnual {
  anio: number;
  alcance: string;
  emitido: string;
  elaboradoPor: string;
  aprobadoPor: string;
  conclusiones: string;
  resumen: string;
  kpi: { auditorias: number; cerradas: number; hallazgos: number; nc: number; om: number; pctTratados: number; ncAbiertas: number; ncVencidas: number; cobertura: number; areasAuditadas: number; areasActivas: number; eficaces: number; noEficaces: number };
  programa: { tipo: string; total: number; realizadas: number; pendientes: number; atrasadas: number; canceladas: number }[];
  porMes: { mes: string; nc: number; om: number }[];
  estados: { label: string; v: number; color: string }[];
  porNorma: { label: string; v: number }[];
  porNivel: { label: string; v: number; color: string }[];
  porArea: { area: string; sucursal: string; nc: number; om: number; abiertos: number }[];
  comparativo: { anio: number; nc: number; om: number }[];
  recurrencia: { area: string; sucursal: string; anios: number[] }[];
  vencidas: { ref: string; area: string; plazo: string; dias: number }[];
}

export function datosInformeAnual(p: {
  anio: number;
  sucursalId: string;
  hallazgos: Hallazgo[];
  auditorias: Auditoria[];
  programa: ProgramaItem[];
  areas: Area[];
  mapa: { sucursales: Record<string, Sucursal>; areas: Record<string, Area>; auditorias: Record<string, Auditoria>; auditores: Record<string, Auditor> };
  textos: { conclusiones: string; elaboradoPor: string; aprobadoPor: string; emitido: string };
}): DatosInformeAnual {
  const { anio, sucursalId, mapa } = p;
  const sucDe = (h: Hallazgo) => mapa.areas[h.areaId]?.sucursalId ?? h.sucursalId;
  const enSuc = (h: Hallazgo) => !sucursalId || sucDe(h) === sucursalId;
  const nomArea = (id: string) => mapa.areas[id]?.nombre ?? '—';
  const nomSuc = (id: string | null | undefined) => (id ? mapa.sucursales[id]?.nombre ?? '' : '');
  const todos = p.hallazgos.filter((h) => !h.anulado && enSuc(h));
  const hs = todos.filter((h) => h.anio === anio);
  const auds = p.auditorias.filter((a) => a.anio === anio && a.estado !== 'anulada' && (!sucursalId || a.sucursalId === sucursalId));
  const nc = hs.filter((h) => h.tipo === 'NC');
  const om = hs.filter((h) => h.tipo === 'OM');
  const tratados = hs.filter((h) => h.estado === 'tratada').length;
  const ncAbiertas = nc.filter((h) => h.estado !== 'tratada');
  const vencidas = ncAbiertas.filter((h) => semaforoPlazo(h) === 'vencido');
  const areasActivas = p.areas.filter((a) => a.activo && (!sucursalId || a.sucursalId === sucursalId));
  const auditadas = new Set(auds.map((a) => a.areaId));
  const verifs = hs.flatMap((h) => h.verificaciones.filter((v) => v.fecha.startsWith(String(anio))));
  const eficaces = verifs.filter((v) => v.resultado === 'eficaz').length;

  // Programa (auditorías, seguimientos y eficacia) del año
  const eventos = construirEventos(p.programa, p.auditorias).filter((e) => e.anio === anio && (!sucursalId || e.sucursalId === sucursalId));
  const programa = (['auditoria', 'seguimiento', 'eficacia'] as const).map((t) => {
    const ev = eventos.filter((e) => e.tipo === t);
    return {
      tipo: { auditoria: 'Auditorías', seguimiento: 'Seguimientos', eficacia: 'Mediciones de eficacia' }[t],
      total: ev.filter((e) => e.estado !== 'cancelada').length,
      realizadas: ev.filter((e) => e.estado === 'realizada').length,
      pendientes: ev.filter((e) => ['programada', 'proxima', 'en_curso'].includes(e.estado)).length,
      atrasadas: ev.filter((e) => e.estado === 'atrasada').length,
      canceladas: ev.filter((e) => e.estado === 'cancelada').length,
    };
  });

  const porMes = MESES.slice(2).map((mes, i) => {
    const m = String(i + 3).padStart(2, '0');
    const delMes = hs.filter((h) => h.fechaDeteccion?.slice(5, 7) === m);
    return { mes, nc: delMes.filter((h) => h.tipo === 'NC').length, om: delMes.filter((h) => h.tipo === 'OM').length };
  });

  const areaIds = [...new Set(hs.map((h) => h.areaId))];
  const porArea = areaIds
    .map((id) => {
      const l = hs.filter((h) => h.areaId === id);
      return { area: nomArea(id), sucursal: nomSuc(mapa.areas[id]?.sucursalId), nc: l.filter((h) => h.tipo === 'NC').length, om: l.filter((h) => h.tipo === 'OM').length, abiertos: l.filter((h) => h.estado !== 'tratada').length };
    })
    .sort((a, b) => b.nc + b.om - (a.nc + a.om) || b.nc - a.nc);

  const anios = [anio - 2, anio - 1, anio];
  const comparativo = anios.map((y) => ({ anio: y, nc: todos.filter((h) => h.anio === y && h.tipo === 'NC').length, om: todos.filter((h) => h.anio === y && h.tipo === 'OM').length }));
  const recurrencia = [...new Set(todos.filter((h) => h.tipo === 'NC' && anios.includes(h.anio)).map((h) => h.areaId))]
    .map((id) => ({ area: nomArea(id), sucursal: nomSuc(mapa.areas[id]?.sucursalId), anios: anios.map((y) => todos.filter((h) => h.areaId === id && h.anio === y && h.tipo === 'NC').length) }))
    .filter((r) => r.anios.filter((n) => n > 0).length >= 2)
    .sort((a, b) => b.anios[2] - a.anios[2] || b.anios.reduce((x, y) => x + y, 0) - a.anios.reduce((x, y) => x + y, 0));

  const alcance = sucursalId ? nomSuc(sucursalId) : 'Todas las sucursales';
  const kpi = {
    auditorias: auds.length,
    cerradas: auds.filter((a) => a.estado === 'cerrada').length,
    hallazgos: hs.length,
    nc: nc.length,
    om: om.length,
    pctTratados: pct(tratados, hs.length),
    ncAbiertas: ncAbiertas.length,
    ncVencidas: vencidas.length,
    cobertura: pct(auditadas.size, areasActivas.length),
    areasAuditadas: auditadas.size,
    areasActivas: areasActivas.length,
    eficaces,
    noEficaces: verifs.length - eficaces,
  };
  const prev = comparativo[1];
  const variacion = prev.nc + prev.om ? Math.round(((hs.length - (prev.nc + prev.om)) / (prev.nc + prev.om)) * 100) : null;
  const top = porArea.slice(0, 3).map((a) => `${a.area}${sucursalId ? '' : ` (${a.sucursal})`}`);
  const resumen = [
    `Durante ${anio} se ejecutaron ${kpi.auditorias} auditorías internas en ${kpi.areasAuditadas} de ${kpi.areasActivas} áreas activas (${kpi.cobertura}% de cobertura), alcance ${alcance.toLowerCase() === 'todas las sucursales' ? 'todas las sucursales' : alcance}. Se registraron ${kpi.hallazgos} hallazgos: ${kpi.nc} no conformidades y ${kpi.om} oportunidades de mejora${variacion === null ? '' : `, lo que representa una variación de ${variacion > 0 ? '+' : ''}${variacion}% respecto de ${anio - 1}`}.`,
    `Al ${p.textos.emitido}, el ${kpi.pctTratados}% de los hallazgos cuenta con tratamiento cerrado y verificado. Permanecen ${kpi.ncAbiertas} no conformidades abiertas${kpi.ncVencidas ? `, de las cuales ${kpi.ncVencidas} superaron el plazo de seguimiento de 3 semanas` : ''}. ${verifs.length ? `Se realizaron ${verifs.length} verificaciones de eficacia (${eficaces} eficaces y ${verifs.length - eficaces} no eficaces).` : 'Aún no se registran verificaciones de eficacia en el año.'}`,
    top.length ? `Las áreas con mayor número de hallazgos fueron ${top.join(', ')}.${recurrencia.length ? ` Se identifican ${recurrencia.length} área(s) con no conformidades recurrentes en al menos dos de los últimos tres años, que requieren atención en la revisión por la dirección.` : ''}` : '',
  ].filter(Boolean).join('\n');

  return {
    anio,
    alcance,
    emitido: p.textos.emitido,
    elaboradoPor: p.textos.elaboradoPor,
    aprobadoPor: p.textos.aprobadoPor,
    conclusiones: p.textos.conclusiones,
    resumen,
    kpi,
    programa,
    porMes,
    estados: [
      { label: 'No tratada', v: hs.filter((h) => h.estado === 'no_tratada').length, color: '#d03b3b' },
      { label: 'En seguimiento', v: hs.filter((h) => h.estado === 'en_seguimiento').length, color: '#fab219' },
      { label: 'Tratada', v: tratados, color: '#0ca30c' },
    ],
    porNorma: (['ISO 9001', 'ISO 14001', 'ISO 45001'] as const).map((n) => ({ label: n, v: hs.filter((h) => h.normas?.includes(n)).length })),
    porNivel: [
      { label: 'Alta', v: hs.filter((h) => h.nivel === 'ALTA').length, color: '#184f95' },
      { label: 'Media', v: hs.filter((h) => h.nivel === 'MEDIA').length, color: '#2a78d6' },
      { label: 'Baja', v: hs.filter((h) => h.nivel === 'BAJA').length, color: '#86b6ef' },
    ],
    porArea,
    comparativo,
    recurrencia,
    vencidas: vencidas
      .map((h) => ({ ref: `${mapa.auditorias[h.auditoriaId]?.codigo ?? '—'} #${h.correlativo}`, area: `${nomArea(h.areaId)}${sucursalId ? '' : ` · ${nomSuc(sucDe(h))}`}`, plazo: fmtFecha(plazoEfectivo(h)), dias: Math.abs(diasHasta(plazoEfectivo(h)!)) }))
      .sort((a, b) => b.dias - a.dias),
  };
}

// ======================= PDF =======================
const M = 40;
const NC = '#eb6834';
const OM = '#2a78d6';
const TEXTO = '#18181b';
const TENUE = '#52525b';
const GRID = '#e4e4e7';
const BORDE = '#3f3f46';
const AMARILLO = '#f5c400';

export function construirInformeAnualPdf(d: DatosInformeAnual, logo: ImagenJpeg | null): Uint8Array {
  const titulo = 'Informe anual de auditorías internas';
  const pdf = new PdfDoc(`${titulo} ${d.anio}`);
  const W = pdf.ancho;
  const ANCHO = W - M * 2;
  const BAJO = pdf.alto - 50;

  const cabecera = () => {
    const y0 = 30;
    const h = 56;
    pdf.rect(M, y0, ANCHO, h, { stroke: BORDE });
    pdf.linea(M + 92, y0, M + 92, y0 + h, BORDE);
    pdf.linea(M + ANCHO - 120, y0, M + ANCHO - 120, y0 + h, BORDE);
    if (logo) {
      const alto = 40;
      const ancho = Math.min(78, (alto * logo.ancho) / logo.alto);
      pdf.imagen(logo, M + (92 - ancho) / 2, y0 + 8, ancho, alto);
    } else pdf.texto('FMA', M + 28, y0 + 34, 18, { bold: true });
    pdf.texto(titulo.toUpperCase(), M + 92, y0 + 24, 12, { bold: true, centro: ANCHO - 212 });
    pdf.texto('Revisión por la dirección · ISO 9001 · ISO 14001 · ISO 45001 (cl. 9.3)', M + 92, y0 + 40, 8, { centro: ANCHO - 212, color: TENUE });
    pdf.texto(`Año ${d.anio}`, M + ANCHO - 120, y0 + 23, 11, { bold: true, centro: 120 });
    pdf.texto(`Emitido: ${d.emitido}`, M + ANCHO - 120, y0 + 39, 8, { centro: 120, color: TENUE });
    return y0 + h + 20;
  };
  let y = cabecera();
  const nueva = () => {
    pdf.nuevaPagina();
    y = cabecera();
    return y;
  };
  const asegurar = (alto: number) => {
    if (y + alto > BAJO) nueva();
  };
  let nSec = 0;
  const seccion = (t: string, altoMin = 60) => {
    asegurar(altoMin + 26);
    nSec += 1;
    pdf.rect(M, y, 4, 14, { fill: AMARILLO });
    pdf.texto(`${nSec}. ${t.toUpperCase()}`, M + 10, y + 11, 10.5, { bold: true, color: TEXTO });
    y += 24;
  };
  const subtitulo = (t: string, x: number, yy: number, ancho: number) => {
    pdf.texto(t, x, yy, 9, { bold: true, color: TEXTO });
    pdf.linea(x, yy + 4, x + ancho, yy + 4, GRID, 0.6);
  };

  // ---------- Gráficos ----------
  const columnas = (x: number, y0: number, w: number, h: number, cats: string[], series: { color: string; valores: number[] }[]) => {
    const tot = cats.map((_, i) => series.reduce((s, se) => s + se.valores[i], 0));
    const max = Math.max(1, ...tot);
    const paso = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : 20;
    const tope = Math.ceil(max / paso) * paso;
    const ejeX = x + 22;
    const ancho = w - 22;
    const altoG = h - 16;
    for (let v = 0; v <= tope; v += paso) {
      const yy = y0 + altoG - (v / tope) * altoG;
      pdf.linea(ejeX, yy, ejeX + ancho, yy, GRID, 0.5);
      pdf.texto(String(v), x, yy + 2.5, 6.5, { color: TENUE, derecha: 18 });
    }
    const col = ancho / cats.length;
    const bw = Math.min(26, col * 0.6);
    cats.forEach((c, i) => {
      let base = y0 + altoG;
      const cx = ejeX + col * i + (col - bw) / 2;
      series.forEach((se) => {
        const v = se.valores[i];
        if (!v) return;
        const hh = (v / tope) * altoG;
        pdf.rect(cx, base - hh, bw, hh, { fill: se.color });
        if (hh >= 9) pdf.texto(String(v), cx, base - hh / 2 + 2.5, 6.5, { bold: true, color: '#ffffff', centro: bw });
        base -= hh;
      });
      if (tot[i]) pdf.texto(String(tot[i]), cx, base - 3, 7, { bold: true, color: TEXTO, centro: bw });
      pdf.texto(c, ejeX + col * i, y0 + altoG + 11, 7, { color: TENUE, centro: col });
    });
  };
  const dona = (cx: number, cy: number, r: number, items: { label: string; v: number; color: string }[], centro: string, sub: string, xLeyenda: number) => {
    const total = items.reduce((s, i) => s + i.v, 0);
    let a = 0;
    if (!total) pdf.sector(cx, cy, r, r * 0.62, 0, Math.PI * 2 - 0.0002, GRID);
    items.forEach((it) => {
      const b = a + (it.v / Math.max(1, total)) * Math.PI * 2;
      pdf.sector(cx, cy, r, r * 0.62, a, Math.min(b, Math.PI * 2 - 0.0002), it.color);
      a = b;
    });
    pdf.texto(centro, cx - r, cy + 3, 13, { bold: true, color: TEXTO, centro: r * 2 });
    pdf.texto(sub, cx - r, cy + 13, 6.5, { color: TENUE, centro: r * 2 });
    items.forEach((it, i) => {
      const yy = cy - (items.length * 15) / 2 + i * 15 + 8;
      pdf.rect(xLeyenda, yy - 7, 8, 8, { fill: it.color });
      pdf.texto(it.label, xLeyenda + 12, yy, 8, { color: TEXTO });
      pdf.texto(`${it.v} · ${pct(it.v, total)}%`, xLeyenda + 12, yy, 8, { bold: true, color: TEXTO, derecha: 108 });
    });
  };
  const barrasH = (x: number, y0: number, w: number, items: { label: string; v: number; color: string }[], max?: number) => {
    const tope = Math.max(1, max ?? Math.max(...items.map((i) => i.v)));
    const etq = 70;
    items.forEach((it, i) => {
      const yy = y0 + i * 17;
      pdf.texto(it.label, x, yy + 9, 8, { color: TEXTO });
      pdf.rect(x + etq, yy + 2, w - etq - 30, 9, { fill: '#f4f4f5' });
      if (it.v) pdf.rect(x + etq, yy + 2, ((w - etq - 30) * it.v) / tope, 9, { fill: it.color });
      pdf.texto(String(it.v), x + w - 26, yy + 9.5, 8, { bold: true, color: TEXTO });
    });
    return y0 + items.length * 17;
  };
  const leyendaNcOm = (x: number, yy: number) => {
    pdf.rect(x, yy - 7, 8, 8, { fill: NC });
    pdf.texto('No conformidad', x + 11, yy, 7.5, { color: TEXTO });
    pdf.rect(x + 82, yy - 7, 8, 8, { fill: OM });
    pdf.texto('Oportunidad de mejora', x + 93, yy, 7.5, { color: TEXTO });
  };
  const tabla = (cols: { t: string; w: number; der?: boolean }[], filas: string[][], sz = 8) => {
    const fila = (celdas: string[], head: boolean, k: number) => {
      const lineas = celdas.map((c, i) => envolver(c, cols[i].w - 8, sz, head));
      const alto = Math.max(16, Math.max(...lineas.map((l) => l.length)) * (sz + 2.5) + 7);
      if (y + alto > BAJO) {
        nueva();
        if (!head) fila(cols.map((c) => c.t), true, 0);
      }
      pdf.rect(M, y, ANCHO, alto, { fill: head ? '#27272a' : k % 2 ? '#f4f4f5' : '#ffffff', stroke: head ? '#27272a' : GRID });
      let x = M;
      lineas.forEach((ls, i) => {
        ls.forEach((l, j) => pdf.texto(l, x + 4, y + sz + 4 + j * (sz + 2.5), sz, { bold: head, color: head ? '#ffffff' : TEXTO, ...(cols[i].der ? { derecha: cols[i].w - 8 } : {}) }));
        x += cols[i].w;
      });
      y += alto;
    };
    fila(cols.map((c) => c.t), true, 0);
    filas.forEach((f, k) => fila(f, false, k));
    y += 10;
  };

  // ---------- 1. Resumen ejecutivo ----------
  pdf.texto(`Alcance: ${d.alcance}`, M, y, 9, { color: TENUE });
  y += 14;
  seccion('Resumen ejecutivo', 120);
  const k = d.kpi;
  const tarjetas = [
    { t: 'Auditorías', v: String(k.auditorias), s: `${k.cerradas} cerradas` },
    { t: 'Cobertura de áreas', v: `${k.cobertura}%`, s: `${k.areasAuditadas} de ${k.areasActivas} áreas` },
    { t: 'Hallazgos', v: String(k.hallazgos), s: `${k.nc} NC · ${k.om} OM` },
    { t: 'Tratados', v: `${k.pctTratados}%`, s: 'con eficacia verificada' },
    { t: 'NC abiertas', v: String(k.ncAbiertas), s: `${k.ncVencidas} con plazo vencido`, alerta: k.ncVencidas > 0 },
  ];
  const tw = (ANCHO - 4 * 8) / 5;
  tarjetas.forEach((c, i) => {
    const x = M + i * (tw + 8);
    pdf.rect(x, y, tw, 54, { fill: '#fafafa', stroke: GRID });
    pdf.rect(x, y, tw, 3, { fill: c.alerta ? '#d03b3b' : AMARILLO });
    pdf.texto(c.t.toUpperCase(), x + 8, y + 16, 6.8, { bold: true, color: TENUE });
    pdf.texto(c.v, x + 8, y + 36, 18, { bold: true, color: c.alerta ? '#d03b3b' : TEXTO });
    pdf.texto(c.s, x + 8, y + 48, 7, { color: TENUE });
  });
  y += 68;
  y = pdf.parrafos(d.resumen, M, y, ANCHO, 9.5, 13.5, { color: TEXTO, limite: BAJO, alSaltar: nueva });

  // ---------- 2. Cumplimiento del programa ----------
  seccion('Cumplimiento del programa anual', 110);
  tabla(
    [{ t: 'Actividad', w: 175 }, { t: 'Programadas', w: 72, der: true }, { t: 'Realizadas', w: 70, der: true }, { t: 'Pendientes', w: 70, der: true }, { t: 'Atrasadas', w: 64, der: true }, { t: 'Avance', w: ANCHO - 451, der: true }],
    d.programa.map((r) => [r.tipo, String(r.total), String(r.realizadas), String(r.pendientes), String(r.atrasadas), r.total ? `${pct(r.realizadas, r.total)}%` : '—']),
  );

  // ---------- 3. Hallazgos del año ----------
  seccion('Hallazgos del año', 200);
  const mitad = (ANCHO - 20) / 2;
  subtitulo('Hallazgos por mes (marzo a diciembre)', M, y, ANCHO);
  y += 14;
  columnas(M, y, ANCHO, 130, d.porMes.map((m) => m.mes), [
    { color: NC, valores: d.porMes.map((m) => m.nc) },
    { color: OM, valores: d.porMes.map((m) => m.om) },
  ]);
  y += 136;
  leyendaNcOm(M + 22, y + 4);
  y += 22;

  asegurar(130);
  subtitulo('Estado de tratamiento', M, y, mitad);
  subtitulo('Tipo de hallazgo', M + mitad + 20, y, mitad);
  y += 16;
  dona(M + 48, y + 46, 42, d.estados, `${k.pctTratados}%`, 'TRATADOS', M + 104);
  dona(M + mitad + 20 + 48, y + 46, 42, [{ label: 'No conformidad', v: k.nc, color: NC }, { label: 'Oport. de mejora', v: k.om, color: OM }], String(k.hallazgos), 'HALLAZGOS', M + mitad + 20 + 104);
  y += 104;

  asegurar(90);
  subtitulo('Hallazgos por norma ISO', M, y, mitad);
  subtitulo('Nivel de impacto', M + mitad + 20, y, mitad);
  y += 12;
  const maxNorma = Math.max(...d.porNorma.map((n) => n.v));
  const y1 = barrasH(M, y, mitad, d.porNorma.map((n) => ({ ...n, color: '#3f3f46' })), maxNorma);
  const y2 = barrasH(M + mitad + 20, y, mitad, d.porNivel);
  y = Math.max(y1, y2) + 4;
  pdf.texto('Un hallazgo puede afectar a más de una norma.', M, y + 6, 6.5, { color: TENUE });
  y += 18;

  // ---------- 4. Hallazgos por área ----------
  seccion('Hallazgos por área', 80);
  const maxArea = Math.max(1, ...d.porArea.map((a) => a.nc + a.om));
  const etq = 170;
  const largo = ANCHO - etq - 70;
  leyendaNcOm(M + etq, y);
  y += 10;
  d.porArea.forEach((a) => {
    asegurar(18);
    const nombre = envolver(`${a.area}${d.alcance === 'Todas las sucursales' ? ` · ${a.sucursal}` : ''}`, etq - 8, 7.8)[0];
    pdf.texto(nombre, M, y + 10, 7.8, { color: TEXTO });
    const wNc = (largo * a.nc) / maxArea;
    const wOm = (largo * a.om) / maxArea;
    if (a.nc) pdf.rect(M + etq, y + 3, wNc, 10, { fill: NC });
    if (a.om) pdf.rect(M + etq + wNc, y + 3, wOm, 10, { fill: OM });
    pdf.texto(`${a.nc + a.om}`, M + etq + wNc + wOm + 5, y + 11, 7.8, { bold: true, color: TEXTO });
    pdf.texto(`${a.abiertos} abiertos`, M, y + 11, 7, { color: TENUE, derecha: ANCHO });
    y += 17;
  });
  y += 10;

  // ---------- 5. Evolución anual ----------
  seccion('Evolución de los últimos tres años', 170);
  subtitulo('Hallazgos por año (NC + OM)', M, y, mitad);
  subtitulo('Áreas con NC recurrentes (2 o más años)', M + mitad + 20, y, mitad);
  y += 14;
  const yEvo = y;
  columnas(M, y, mitad, 120, d.comparativo.map((c) => String(c.anio)), [
    { color: NC, valores: d.comparativo.map((c) => c.nc) },
    { color: OM, valores: d.comparativo.map((c) => c.om) },
  ]);
  leyendaNcOm(M + 22, y + 134);
  // tabla compacta de recurrencia al lado
  const xR = M + mitad + 20;
  let yR = yEvo;
  const cw = [mitad - 96, 32, 32, 32];
  const cab = ['Área', ...d.comparativo.map((c) => String(c.anio))];
  pdf.rect(xR, yR, mitad, 15, { fill: '#27272a' });
  let xx = xR;
  cab.forEach((t, i) => {
    pdf.texto(t, xx + 4, yR + 10.5, 7.5, { bold: true, color: '#ffffff', ...(i ? { derecha: cw[i] - 8 } : {}) });
    xx += cw[i];
  });
  yR += 15;
  if (!d.recurrencia.length) {
    pdf.texto('Sin áreas con NC recurrentes.', xR + 4, yR + 12, 7.5, { color: TENUE });
    yR += 18;
  }
  d.recurrencia.slice(0, 8).forEach((r, i) => {
    pdf.rect(xR, yR, mitad, 15, { fill: i % 2 ? '#f4f4f5' : '#ffffff', stroke: GRID });
    pdf.texto(envolver(`${r.area}${d.alcance === 'Todas las sucursales' ? ` · ${r.sucursal}` : ''}`, cw[0] - 8, 7.3)[0], xR + 4, yR + 10.5, 7.3, { color: TEXTO });
    let x2 = xR + cw[0];
    r.anios.forEach((n, j) => {
      pdf.texto(n ? String(n) : '—', x2 + 4, yR + 10.5, 7.5, { bold: j === 2 && n > 0, color: j === 2 && n > 0 ? '#d03b3b' : TEXTO, derecha: cw[j + 1] - 8 });
      x2 += cw[j + 1];
    });
    yR += 15;
  });
  if (d.recurrencia.length > 8) {
    pdf.texto(`y ${d.recurrencia.length - 8} área(s) más.`, xR + 4, yR + 10, 7, { color: TENUE });
    yR += 14;
  }
  y = Math.max(yEvo + 146, yR) + 12;

  // ---------- 6. NC con plazo vencido ----------
  seccion('No conformidades con plazo de seguimiento vencido', 60);
  pdf.texto('Plazo: 3 semanas desde la auditoría para dar cumplimiento (corrección, causa raíz y acciones del área).', M, y, 8, { color: TENUE });
  y += 10;
  if (!d.vencidas.length) {
    pdf.texto('No hay NC con plazo vencido.', M, y + 10, 9, { color: TEXTO });
    y += 24;
  } else {
    tabla([{ t: 'Hallazgo', w: 90 }, { t: 'Área', w: ANCHO - 260 }, { t: 'Plazo', w: 80 }, { t: 'Días vencido', w: 90, der: true }], d.vencidas.map((v) => [v.ref, v.area, v.plazo, String(v.dias)]));
  }

  // ---------- 7. Eficacia ----------
  seccion('Medición de eficacia', 50);
  y = pdf.parrafos(
    k.eficaces + k.noEficaces
      ? `En el año se registraron ${k.eficaces + k.noEficaces} verificaciones de eficacia: ${k.eficaces} eficaces (${pct(k.eficaces, k.eficaces + k.noEficaces)}%) y ${k.noEficaces} no eficaces. Las mediciones se programan en noviembre y diciembre, los lunes y jueves (máximo dos por semana y una por día).`
      : 'Aún no se registran verificaciones de eficacia en el año. Las mediciones se programan en noviembre y diciembre, los lunes y jueves (máximo dos por semana y una por día).',
    M, y, ANCHO, 9.5, 13.5, { color: TEXTO, limite: BAJO, alSaltar: nueva },
  );

  // ---------- 8. Conclusiones ----------
  if (d.conclusiones.trim()) {
    seccion('Conclusiones y recomendaciones para la dirección', 60);
    y = pdf.parrafos(d.conclusiones, M, y, ANCHO, 9.5, 13.5, { color: TEXTO, limite: BAJO, alSaltar: nueva });
  }

  // ---------- Firmas ----------
  asegurar(80);
  y = Math.max(y + 30, Math.min(BAJO - 50, y + 40));
  const fw = (ANCHO - 60) / 2;
  [
    ['Elaborado por', d.elaboradoPor],
    ['Aprobado por', d.aprobadoPor],
  ].forEach(([t, n], i) => {
    const x = M + i * (fw + 60);
    pdf.linea(x, y, x + fw, y, BORDE, 0.8);
    pdf.texto(n || ' ', x, y + 13, 9, { bold: true, color: TEXTO, centro: fw });
    pdf.texto(t, x, y + 25, 8, { color: TENUE, centro: fw });
  });

  pdf.enCadaPagina((n, total) => {
    pdf.linea(M, pdf.alto - 34, M + ANCHO, pdf.alto - 34, GRID, 0.6);
    pdf.texto(`FMA Industrial · ${titulo} ${d.anio}`, M, pdf.alto - 22, 7.5, { color: TENUE });
    pdf.texto(`Página ${n} de ${total}`, M, pdf.alto - 22, 7.5, { color: TENUE, derecha: ANCHO });
  });
  return pdf.finalizar();
}
