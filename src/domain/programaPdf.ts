// Programa anual de auditorías en PDF (A4 horizontal): encabezado con logo, presentación justificada,
// calendario área × mes con tipo de actividad y equipo, leyenda, detalle y firmas.
import { envolver, PdfDoc, type ImagenJpeg } from '../lib/pdf';

export interface CeldaPrograma { dia: string; letra: string; equipo: string }
export interface DatosProgramaPdf {
  anio: number;
  titulo: string;
  presentacion: string;
  alcanceTxt: string; // "Todas las sucursales" / "Santiago"
  meses: number[]; // índices 0–11
  grupos: { sucursal: string; areas: { nombre: string; celdas: Record<number, CeldaPrograma[]> }[] }[];
  detalle: { fecha: string; tipo: string; area: string; sucursal: string; lider: string; equipo: string }[];
  siglas: { sigla: string; nombre: string }[];
  tipos: { letra: string; label: string }[];
  normas: string;
  elaboradoPor: string;
  aprobadoPor: string;
  emitido: string; // dd-mm-aaaa
  incluirDetalle: boolean;
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const M = 36;
const BORDE = '#3f3f46';
const GRIS = '#e4e4e7';
const SUAVE = '#f4f4f5';
const MARCA = '#fdf3c4';
const TEXTO = '#18181b';
const TENUE = '#52525b';

export function construirProgramaPdf(p: DatosProgramaPdf, logo: ImagenJpeg | null): Uint8Array {
  const pdf = new PdfDoc(`${p.titulo}`, { horizontal: true });
  const W = pdf.ancho;
  const H = pdf.alto;
  const ANCHO = W - M * 2;
  const BAJO = H - 46;

  const cabecera = (): number => {
    const h = 58;
    const y0 = 28;
    pdf.rect(M, y0, ANCHO, h, { stroke: BORDE });
    pdf.linea(M + 100, y0, M + 100, y0 + h, BORDE);
    pdf.linea(M + ANCHO - 150, y0, M + ANCHO - 150, y0 + h, BORDE);
    if (logo) {
      const alto = 44;
      const ancho = Math.min(84, (alto * logo.ancho) / logo.alto);
      pdf.imagen(logo, M + (100 - ancho) / 2, y0 + 7, ancho, alto);
    } else pdf.texto('FMA', M + 32, y0 + 36, 18, { bold: true });
    pdf.texto(p.titulo.toUpperCase(), M + 100, y0 + 26, 13, { bold: true, centro: ANCHO - 250 });
    pdf.texto(`Sistema de Gestión Integrado · ${p.normas}`, M + 100, y0 + 43, 8.5, { centro: ANCHO - 250, color: TENUE });
    pdf.texto(`Año ${p.anio}`, M + ANCHO - 150, y0 + 24, 11, { bold: true, centro: 150 });
    pdf.texto(`Emitido: ${p.emitido}`, M + ANCHO - 150, y0 + 40, 8.5, { centro: 150, color: TENUE });
    return y0 + h + 18;
  };

  let y = cabecera();
  const nueva = () => {
    pdf.nuevaPagina();
    y = cabecera();
    return y;
  };
  const tituloSeccion = (t: string) => {
    if (y + 40 > BAJO) nueva();
    pdf.rect(M, y, 4, 14, { fill: '#f5c400' });
    pdf.texto(t.toUpperCase(), M + 10, y + 11, 10.5, { bold: true, color: TEXTO });
    y += 24;
  };

  // ---- Presentación (justificada) ----
  tituloSeccion('Presentación');
  y = pdf.parrafos(p.presentacion, M, y, ANCHO, 10, 14.5, { color: TEXTO, limite: BAJO, alSaltar: nueva });
  y += 6;

  // ---- Calendario área × mes ----
  tituloSeccion(`Calendario de actividades ${p.anio} · ${p.alcanceTxt}`);
  const COL_AREA = 150;
  const colMes = (ANCHO - COL_AREA) / p.meses.length;
  const SZ = 7.4;
  const LH = 9.2;
  const encabezadoTabla = () => {
    pdf.rect(M, y, ANCHO, 18, { fill: '#27272a', stroke: BORDE });
    pdf.texto('Área', M + 6, y + 12.5, 8.5, { bold: true, color: '#ffffff' });
    p.meses.forEach((m, i) => pdf.texto(MESES[m].slice(0, colMes < 60 ? 3 : 10), M + COL_AREA + colMes * i, y + 12.5, 8.5, { bold: true, color: '#ffffff', centro: colMes }));
    y += 18;
  };
  encabezadoTabla();
  for (const g of p.grupos) {
    if (y + 18 + 22 > BAJO) { nueva(); encabezadoTabla(); }
    pdf.rect(M, y, ANCHO, 16, { fill: MARCA, stroke: BORDE });
    pdf.texto(g.sucursal.toUpperCase(), M + 6, y + 11.5, 8.5, { bold: true, color: TEXTO });
    y += 16;
    g.areas.forEach((a, k) => {
      const lineasArea = envolver(a.nombre, COL_AREA - 10, 8.5, true);
      const lineasCelda = p.meses.map((m) => (a.celdas[m] ?? []).flatMap((c) => envolver(`${c.dia} ${c.letra} · ${c.equipo}`, colMes - 6, SZ)));
      const alto = Math.max(22, lineasArea.length * 10.5 + 8, ...lineasCelda.map((l) => l.length * LH + 8));
      if (y + alto > BAJO) { nueva(); encabezadoTabla(); }
      pdf.rect(M, y, ANCHO, alto, { fill: k % 2 ? SUAVE : '#ffffff', stroke: GRIS });
      lineasArea.forEach((l, i) => pdf.texto(l, M + 6, y + 13 + i * 10.5, 8.5, { bold: true, color: TEXTO }));
      p.meses.forEach((m, i) => {
        const x = M + COL_AREA + colMes * i;
        pdf.linea(x, y, x, y + alto, GRIS, 0.5);
        const evs = a.celdas[m] ?? [];
        let yy = y + 11;
        evs.forEach((c) => {
          envolver(`${c.dia} ${c.letra} · ${c.equipo}`, colMes - 6, SZ).forEach((l, j) => {
            pdf.texto(l, x + 3, yy, SZ, { bold: j === 0, color: TEXTO });
            yy += LH;
          });
        });
      });
      y += alto;
    });
  }
  pdf.rect(M, y - 0.01, ANCHO, 0.01, { stroke: BORDE });
  y += 10;

  // ---- Leyenda ----
  const ley1 = `Tipo de actividad: ${p.tipos.map((t) => `${t.letra} = ${t.label}`).join('   ·   ')}.   Formato de cada celda: día · tipo · auditor líder / equipo.`;
  const ley2 = `Equipo auditor: ${p.siglas.map((s) => `${s.sigla} = ${s.nombre}`).join('   ·   ')}.`;
  for (const t of [ley1, ley2]) {
    for (const l of envolver(t, ANCHO, 8)) {
      if (y + 11 > BAJO) nueva();
      pdf.texto(l, M, y + 8, 8, { color: TENUE });
      y += 11;
    }
  }
  y += 8;

  // ---- Detalle ----
  if (p.incluirDetalle && p.detalle.length) {
    tituloSeccion('Detalle del programa');
    const cols = [70, 105, 165, 85, 140, ANCHO - 70 - 105 - 165 - 85 - 140];
    const titulos = ['Fecha', 'Actividad', 'Área', 'Sucursal', 'Auditor líder', 'Equipo auditor'];
    const cabDet = () => {
      pdf.rect(M, y, ANCHO, 16, { fill: '#27272a' });
      let x = M;
      titulos.forEach((t, i) => { pdf.texto(t, x + 5, y + 11, 8.5, { bold: true, color: '#ffffff' }); x += cols[i]; });
      y += 16;
    };
    cabDet();
    p.detalle.forEach((d, k) => {
      const celdas = [d.fecha, d.tipo, d.area, d.sucursal, d.lider, d.equipo || '—'].map((v, i) => envolver(v, cols[i] - 10, 8.5));
      const alto = Math.max(...celdas.map((c) => c.length)) * 11 + 7;
      if (y + alto > BAJO) { nueva(); cabDet(); }
      pdf.rect(M, y, ANCHO, alto, { fill: k % 2 ? SUAVE : '#ffffff', stroke: GRIS });
      let x = M;
      celdas.forEach((ls, i) => { ls.forEach((l, j) => pdf.texto(l, x + 5, y + 12 + j * 11, 8.5, { color: TEXTO, bold: i === 0 })); x += cols[i]; });
      y += alto;
    });
    y += 16;
  }

  // ---- Firmas ----
  if (y + 80 > BAJO) nueva();
  y += 24;
  const anchoF = 220;
  [[M + 60, 'Elaborado por', p.elaboradoPor], [M + ANCHO - 60 - anchoF, 'Aprobado por', p.aprobadoPor]].forEach(([x, rol, nombre]) => {
    const xx = x as number;
    pdf.linea(xx, y + 34, xx + anchoF, y + 34, BORDE, 0.7);
    pdf.texto(String(nombre || ' '), xx, y + 28, 9.5, { bold: true, centro: anchoF, color: TEXTO });
    pdf.texto(String(rol), xx, y + 47, 8.5, { centro: anchoF, color: TENUE });
  });

  pdf.enCadaPagina((n, total) => {
    pdf.linea(M, H - 30, M + ANCHO, H - 30, GRIS, 0.5);
    pdf.texto(`FMA Industrial · ${p.titulo} ${p.anio}`, M, H - 18, 7.5, { color: TENUE });
    pdf.texto(`Página ${n} de ${total}`, M, H - 18, 7.5, { derecha: ANCHO, color: TENUE });
  });
  return pdf.finalizar();
}
