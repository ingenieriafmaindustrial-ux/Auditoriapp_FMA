// Plan de auditoría en PDF (mismo formato que los planes FMA): encabezado, datos generales, tabla de puntos y cierre.
import { A4, envolver, PdfDoc, type ImagenJpeg } from '../lib/pdf';
import { fmtFecha } from '../lib/dates';
import { NORMA_VERSION } from '../lib/constants';
import type { DatosPlanDoc } from './informeDocx';

export interface DatosPlanPdf extends Omit<DatosPlanDoc, 'fechaPlanificada' | 'equipo' | 'auditorLider'> {
  /** Fecha en que se realizará la auditoría (elegida al descargar). */
  fecha: string;
  /** Equipo auditor a cargo (uno o más; puede ser solo el auditor líder). */
  equipoAuditor: string[];
  /** Quién descarga y cuándo (pie de página). */
  generadoPor?: string;
}

const M = 50; // margen
const ANCHO = A4.w - M * 2;
const SIZE = 9.5;
const LH = 12.5;
const PAD = 5;
const GRIS = '#e4e4e7';
const BORDE = '#3f3f46';
const BAJO = A4.h - 62;

export function construirPlanPdf(p: DatosPlanPdf, logo: ImagenJpeg | null): Uint8Array {
  const pdf = new PdfDoc(p.codigo ? `Plan de auditoría ${p.codigo}` : `Plan de auditoría ${p.area}`);
  const titulo = p.codigo ? `Plan de auditoría ${p.codigo}` : `Plan de auditoría ${p.area}`;

  const cabecera = (): number => {
    const h = 62;
    pdf.rect(M, 40, ANCHO, h, { stroke: BORDE });
    pdf.linea(M + 80, 40, M + 80, 40 + h, BORDE);
    pdf.linea(M + ANCHO - 120, 40, M + ANCHO - 120, 40 + h, BORDE);
    if (logo) {
      const alto = 48; const ancho = Math.min(70, (alto * logo.ancho) / logo.alto);
      pdf.imagen(logo, M + (80 - ancho) / 2, 47, ancho, alto);
    } else pdf.texto('FMA', M + 24, 76, 16, { bold: true });
    pdf.texto('PLAN DE AUDITORÍA INTERNO', M + 80, 76, 14, { bold: true, centro: ANCHO - 200 });
    pdf.texto(p.codigo ? `Auditoría ${p.codigo}` : `Año ${p.anio}`, M + ANCHO - 120, 74, 9.5, { centro: 120 });
    return 40 + h + 14;
  };
  let y = cabecera();
  const salto = () => { pdf.nuevaPagina(); y = cabecera(); };

  // ---- Datos generales (clave | valor) ----
  const ANCHO_K = 150;
  const meta: [string, string][] = [
    ['Año', String(p.anio)],
    ...(p.codigo ? ([['Auditoría N°', p.codigo]] as [string, string][]) : []),
    ['Objetivo', p.objetivos],
    ['Alcance', p.alcance],
    ['Lugar de realización', `${p.area} · ${p.sucursal}`],
    ['Fecha de la auditoría', fmtFecha(p.fecha)],
    ['Equipo auditor', p.equipoAuditor.map((n, i) => (p.equipoAuditor.length === 1 ? `Auditor: ${n}` : i === 0 ? `Auditor líder: ${n}` : `Auditor: ${n}`)).join('\n')],
    ['Normas de referencia', p.normas.map((n) => NORMA_VERSION[n as keyof typeof NORMA_VERSION] ?? n).join(' · ')],
    ['Auditado (jefe / encargado)', p.auditados || '—'],
  ];
  for (const [k, v] of meta) {
    const lv = envolver(v || '—', ANCHO - ANCHO_K - PAD * 2, SIZE);
    const lk = envolver(k, ANCHO_K - PAD * 2, SIZE, true);
    const h = Math.max(lv.length, lk.length, 1) * LH + PAD * 2;
    if (y + h > BAJO) salto();
    pdf.rect(M, y, ANCHO_K, h, { fill: GRIS, stroke: BORDE });
    pdf.rect(M + ANCHO_K, y, ANCHO - ANCHO_K, h, { stroke: BORDE });
    lk.forEach((l, i) => pdf.texto(l, M + PAD, y + PAD + 9 + i * LH, SIZE, { bold: true }));
    lv.forEach((l, i) => pdf.texto(l, M + ANCHO_K + PAD, y + PAD + 9 + i * LH, SIZE));
    y += h;
  }
  y += 14;

  // ---- Tabla de puntos: Proceso | Requisitos | Auditores ----
  const cols = [105, ANCHO - 105 - 120, 120];
  const xs = [M, M + cols[0], M + cols[0] + cols[1]];
  const cabTabla = () => {
    const h = 20;
    ['Proceso a auditar', 'Requisitos a auditar', 'Auditor(es)'].forEach((t, i) => {
      pdf.rect(xs[i], y, cols[i], h, { fill: GRIS, stroke: BORDE });
      pdf.texto(t, xs[i] + PAD, y + 13.5, SIZE, { bold: true });
    });
    y += h;
  };
  if (y + 60 > BAJO) salto();
  cabTabla();
  const lineasProc = envolver(p.area.toUpperCase(), cols[0] - PAD * 2, SIZE, true);
  const lineasAud = p.equipoAuditor.flatMap((n) => envolver(n, cols[2] - PAD * 2, SIZE));
  const lineasReq: { t: string; primera: boolean }[] = [];
  if (!p.puntos.length) lineasReq.push({ t: '—', primera: true });
  p.puntos.forEach((pt, i) => envolver(`${i + 1}. ${pt.titulo}`, cols[1] - PAD * 2 - 4, SIZE).forEach((l, j) => lineasReq.push({ t: j ? `    ${l}` : l, primera: j === 0 })));
  // La fila de contenido puede cruzar páginas: se reparte por líneas
  let desde = 0;
  let primeraParte = true;
  while (desde < lineasReq.length || primeraParte) {
    const libre = Math.floor((BAJO - y - PAD * 2) / LH);
    if (libre < 3 && desde < lineasReq.length) { salto(); cabTabla(); continue; }
    const cuantas = Math.max(1, Math.min(lineasReq.length - desde, libre));
    const trozo = lineasReq.slice(desde, desde + cuantas);
    const h = Math.max(trozo.length, primeraParte ? Math.max(lineasProc.length, lineasAud.length) : 0) * LH + PAD * 2;
    cols.forEach((c, i) => pdf.rect(xs[i], y, c, h, { stroke: BORDE }));
    if (primeraParte) {
      lineasProc.forEach((l, i) => pdf.texto(l, xs[0] + PAD, y + PAD + 9 + i * LH, SIZE, { bold: true }));
      lineasAud.forEach((l, i) => pdf.texto(l, xs[2] + PAD, y + PAD + 9 + i * LH, SIZE));
    }
    trozo.forEach((l, i) => pdf.texto(l.t, xs[1] + PAD, y + PAD + 9 + i * LH, SIZE));
    y += h;
    desde += cuantas;
    primeraParte = false;
    if (desde < lineasReq.length) { salto(); cabTabla(); }
  }
  for (const t of ['Trabajo de auditores', 'Reunión de cierre parcial de auditoría']) {
    if (y + 24 > BAJO) { salto(); }
    pdf.rect(M, y, ANCHO, 24, { fill: GRIS, stroke: BORDE });
    pdf.texto(t, M + PAD, y + 16, SIZE, { bold: true });
    y += 24;
  }

  const hoy = fmtFecha(new Date().toISOString().slice(0, 10));
  pdf.enCadaPagina((n, total) => {
    pdf.linea(M, A4.h - 44, M + ANCHO, A4.h - 44, '#a1a1aa', 0.5);
    pdf.texto(`${titulo} · FMA Industrial Chile · Descargado el ${hoy}${p.generadoPor ? ` por ${p.generadoPor}` : ''}`, M, A4.h - 31, 7.5, { color: '#52525b' });
    pdf.texto(`Página ${n} de ${total}`, M, A4.h - 31, 7.5, { color: '#52525b', derecha: ANCHO });
  });
  return pdf.finalizar();
}
