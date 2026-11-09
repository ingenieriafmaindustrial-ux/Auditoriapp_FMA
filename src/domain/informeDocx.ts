// Genera el informe Word con la estructura de la plantilla "Informe auditoria interno versión N°10 2024".
// Función pura (sin navegador) para poder probarla en Node.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import type { InformeSnapshot } from '../types';

export interface ImagenInforme {
  data: Uint8Array;
  ancho: number;
  alto: number;
}

const CONTENT = 8504; // A4 con márgenes de la plantilla (1701 twips)
const FONT = 'Calibri';
const GRIS = 'D9D9D9';
const borde = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
const bordes = { top: borde, bottom: borde, left: borde, right: borde };
const ESTADO: Record<string, string> = { no_tratada: 'No tratada', en_seguimiento: 'En seguimiento', tratada: 'Tratada' };
const NORMA_TXT: Record<string, string> = { 'ISO 9001': 'ISO 9001:2015', 'ISO 14001': 'ISO 14001:2026', 'ISO 45001': 'ISO 45001:2018' };

const REV: Record<string, string> = { envio: 'Enviada a revisión', observacion: 'Devuelta con observaciones', aprobacion: 'Aprobada', emision: 'Aprobada y emitida', reapertura: 'Reabierta' };


const fecha = (d: string | null) => (d ? d.split('-').reverse().join('-') : '—');

function parrafos(texto: string, opts: { bold?: boolean; size?: number; italics?: boolean } = {}): Paragraph[] {
  const lineas = (texto || '—').split(/\r?\n/);
  return lineas.map((l) => new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: l, font: FONT, size: opts.size ?? 20, bold: opts.bold, italics: opts.italics })] }));
}

function celda(contenido: string | Paragraph[], ancho: number, o: { header?: boolean; bold?: boolean } = {}) {
  const children = typeof contenido === 'string' ? parrafos(contenido, { bold: o.header || o.bold }) : contenido;
  return new TableCell({
    borders: bordes,
    width: { size: ancho, type: WidthType.DXA },
    shading: o.header ? { fill: GRIS, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children,
  });
}

function tabla(columnas: { titulo: string; ancho: number }[], filas: (string | Paragraph[])[][]) {
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: columnas.map((c) => c.ancho),
    rows: [
      new TableRow({ tableHeader: true, children: columnas.map((c) => celda(c.titulo, c.ancho, { header: true })) }),
      ...(filas.length ? filas : [columnas.map(() => '—')]).map((f) => new TableRow({ cantSplit: true, children: f.map((v, i) => celda(v, columnas[i].ancho)) })),
    ],
  });
}

const h1 = (text: string, saltoPagina = false) =>
  new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: saltoPagina, spacing: { before: 240, after: 160 }, children: [new TextRun({ text, font: FONT, bold: true, size: 26 })] });

export function construirDocumentoInforme(s: InformeSnapshot, logo: Uint8Array | null, imagenes: Record<string, ImagenInforme>): Document {
  // ---------- Encabezado ----------
  const header = new Header({
    children: [
      new Table({
        width: { size: CONTENT, type: WidthType.DXA },
        columnWidths: [1600, 4904, 2000],
        rows: [
          new TableRow({
            children: [
              new TableCell({ borders: bordes, width: { size: 1600, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: logo ? [new ImageRun({ type: 'png', data: logo, transformation: { width: 60, height: 60 } })] : [new TextRun({ text: 'FMA', bold: true, font: FONT })] })] }),
              new TableCell({ borders: bordes, width: { size: 4904, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'INFORME DE AUDITORÍA INTERNA', bold: true, font: FONT, size: 26 })] })] }),
              new TableCell({
                borders: bordes,
                width: { size: 2000, type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Versión 11/2026', font: FONT, size: 18 })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Informe', font: FONT, size: 16, color: '555555' })] }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ font: FONT, size: 16, children: ['Auditoría ', s.codigo, ' · Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES] })],
      }),
    ],
  });

  // ---------- Portada / metadata ----------
  const meta: [string, string | Paragraph[]][] = [
    ['Auditoría Nº', s.codigo],
    ['Sucursal', s.sucursal],
    ['Objetivos de la Auditoría', s.objetivos],
    ['Alcance', s.alcance],
    ['Normas de Referencia', s.normas.map((n) => NORMA_TXT[n] ?? n).join('\n')],
    ['Auditor Líder', s.auditorLider],
    ['Equipo Auditor', s.equipo.length ? s.equipo.map((e) => `- ${e}`).join('\n') : '—'],
    ['Área auditada', s.area],
    ['Fecha de Realización', fecha(s.fechaRealizacion)],
    ['N° de No Conformidades', String(s.totalNC)],
    ['N° de Oportunidades de mejora', String(s.totalOM)],
  ];
  const tablaMeta = new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [2800, 5704],
    rows: meta.map(([k, v]) => new TableRow({ cantSplit: true, children: [celda(k, 2800, { header: true }), celda(v, 5704)] })),
  });

  const apLider = s.aprobaciones.find((x) => x.rol === 'auditor_lider');
  const apEquipo = s.aprobaciones.filter((x) => x.rol === 'equipo');
  const apJefe = s.aprobaciones.find((x) => x.rol === 'jefe_area');
  const firma = (titulo: string, nombre: string, fechaAp?: string) => [
    new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: '______________________', font: FONT })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: titulo, bold: true, font: FONT, size: 18 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: nombre || ' ', font: FONT, size: 18 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: fechaAp ? `Aprobado en app: ${fecha(fechaAp.slice(0, 10))}` : ' ', font: FONT, size: 14, color: '555555' })] }),
  ];
  const tablaFirmas = new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [2835, 2835, 2834],
    rows: [
      new TableRow({ children: [new TableCell({ columnSpan: 3, borders: bordes, shading: { fill: GRIS, type: ShadingType.CLEAR, color: 'auto' }, children: parrafos('Aprobación del documento', { bold: true }) })] }),
      new TableRow({
        children: [
          new TableCell({ borders: bordes, width: { size: 2835, type: WidthType.DXA }, children: firma('Auditor Líder', apLider?.nombre ?? s.auditorLider, apLider?.fecha) }),
          new TableCell({ borders: bordes, width: { size: 2835, type: WidthType.DXA }, children: firma('Equipo auditor', apEquipo.map((x) => x.nombre).join(', ') || s.equipo.join(', '), apEquipo[0]?.fecha) }),
          new TableCell({ borders: bordes, width: { size: 2834, type: WidthType.DXA }, children: firma('Jefe de área / Encargado de área', apJefe?.nombre ?? s.auditados, apJefe?.fecha) }),
        ],
      }),
    ],
  });

  // ---------- Secciones ----------
  const resultados = tabla(
    [{ titulo: 'Id', ancho: 600 }, { titulo: 'NC / O.M.', ancho: 1000 }, { titulo: 'Requisito / Norma', ancho: 1800 }, { titulo: 'Descripción del Hallazgo', ancho: 5104 }],
    s.hallazgos.map((h) => [String(h.correlativo), h.tipo, h.requisitos.join('\n') || '—', h.descripcion]),
  );

  const seguimiento = tabla(
    [{ titulo: 'Id', ancho: 600 }, { titulo: 'NC / O.M.', ancho: 1000 }, { titulo: 'Corrección del hallazgo (Cómo solucionó la evidencia)', ancho: 3200 }, { titulo: 'Acción correctiva (Qué acción se implementará de forma definitiva)', ancho: 3704 }],
    s.hallazgos.map((h) => [
      String(h.correlativo),
      h.tipo,
      h.correccion || '—',
      [
        ...(h.causaRaiz ? parrafos(`Causa raíz: ${h.causaRaiz}`, { italics: true, size: 18 }) : []),
        ...(h.acciones.length ? h.acciones.flatMap((a) => parrafos(`• ${a}`)) : parrafos('—')),
      ],
    ]),
  );

  const eficacia = tabla(
    [{ titulo: 'Id', ancho: 600 }, { titulo: 'NC / O.M.', ancho: 1000 }, { titulo: 'Fecha de realización', ancho: 1400 }, { titulo: 'Nivel de importancia', ancho: 1300 }, { titulo: 'Análisis de eficacia (Qué impacto han tenido las acciones correctivas)', ancho: 4204 }],
    s.hallazgos.map((h) => [
      String(h.correlativo),
      h.tipo,
      fecha(h.verificacionFecha),
      h.nivel,
      h.verificacionResultado
        ? [...parrafos(h.verificacionResultado === 'eficaz' ? 'EFICAZ' : 'NO EFICAZ', { bold: true }), ...parrafos(h.verificacionAnalisis), ...parrafos(`Estado: ${ESTADO[h.estado] ?? h.estado}`, { size: 16, italics: true })]
        : parrafos(`Eficacia por verificar · Estado: ${ESTADO[h.estado] ?? h.estado}`, { italics: true }),
    ]),
  );

  const fotos = s.evidencias.filter((e) => imagenes[e.id]);
  const evidencia = fotos.length
    ? new Table({
        width: { size: CONTENT, type: WidthType.DXA },
        columnWidths: [4252, 4252],
        rows: fotos.map((e) => {
          const img = imagenes[e.id];
          const maxW = 260;
          const w = img.ancho ? Math.min(maxW, img.ancho) : maxW;
          const hgt = img.ancho && img.alto ? Math.round((w * img.alto) / img.ancho) : Math.round(maxW * 0.75);
          return new TableRow({
            cantSplit: true,
            children: [
              new TableCell({ borders: bordes, width: { size: 4252, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'jpg', data: img.data, transformation: { width: w, height: Math.min(hgt, 340) } })] })] }),
              celda([...(e.hallazgoCorrelativo ? parrafos(`Hallazgo Id ${e.hallazgoCorrelativo}`, { bold: true }) : []), ...parrafos(e.descripcion || 'Sin descripción')], 4252),
            ],
          });
        }),
      })
    : new Paragraph({ children: [new TextRun({ text: 'Sin evidencia fotográfica registrada.', font: FONT, italics: true, size: 20 })] });

  return new Document({
    creator: 'FMA AuditoriAPP',
    title: `Informe de auditoría interna ${s.codigo}`,
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: FONT, size: 20 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true, color: '000000' }, paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1701, bottom: 1417, left: 1701, header: 708, footer: 708 } } },
        headers: { default: header },
        footers: { default: footer },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: 'INFORME DE AUDITORÍA INTERNA FMA', bold: true, font: FONT, size: 28 })] }),
          tablaMeta,
          new Paragraph({ text: '' }),
          tablaFirmas,
          new Paragraph({ children: [new PageBreak()] }),
          new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: 'Índice', bold: true, font: FONT, size: 28 })] }),
          new TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-1' }),
          h1('RESULTADOS DE LA AUDITORÍA', true),
          resultados,
          h1('NOTAS'),
          ...parrafos(s.notas || 'Sin notas.'),
          h1('RESULTADOS DEL SEGUIMIENTO DE AUDITORÍA', true),
          seguimiento,
          h1('VERIFICACIÓN DE EFICACIA', true),
          eficacia,
          h1('CONTROL DE REVISIONES', true),
          tabla(
            [{ titulo: 'N°', ancho: 500 }, { titulo: 'Fecha', ancho: 1400 }, { titulo: 'Revisión', ancho: 1900 }, { titulo: 'Responsable', ancho: 1800 }, { titulo: 'Comentario', ancho: 2904 }],
            (s.revisiones ?? []).map((r, i) => [String(i + 1), r.fecha.slice(0, 10).split('-').reverse().join('-'), `${REV[r.tipo] ?? r.tipo}${r.version ? ` v${r.version}` : ''}`, r.usuarioNombre, r.comentario || '—']),
          ),
          h1('EVIDENCIA FOTOGRÁFICA', true),
          evidencia,
        ],
      },
    ],
  });
}

// ---------- Plan de auditoría (para enviar al área antes de auditar) ----------
export interface DatosPlanDoc {
  codigo: string;
  anio: number;
  objetivos: string;
  alcance: string;
  sucursal: string;
  area: string;
  fechaPlanificada: string | null;
  auditorLider: string;
  equipo: string[];
  auditados: string;
  normas: string[];
  puntos: { titulo: string; grupo: string; requisitos: string[]; referencia: string | null }[];
}

export function construirDocumentoPlan(p: DatosPlanDoc, logo: Uint8Array | null): Document {
  const header = new Header({
    children: [
      new Table({
        width: { size: CONTENT, type: WidthType.DXA },
        columnWidths: [1600, 4904, 2000],
        rows: [
          new TableRow({
            children: [
              new TableCell({ borders: bordes, width: { size: 1600, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: logo ? [new ImageRun({ type: 'png', data: logo, transformation: { width: 60, height: 60 } })] : [new TextRun({ text: 'FMA', bold: true, font: FONT })] })] }),
              new TableCell({ borders: bordes, width: { size: 4904, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'PLAN DE AUDITORÍA INTERNO', bold: true, font: FONT, size: 26 })] })] }),
              new TableCell({ borders: bordes, width: { size: 2000, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Auditoría ${p.codigo}`, font: FONT, size: 18 })] })] }),
            ],
          }),
        ],
      }),
    ],
  });
  const meta: [string, string][] = [
    ['Año', String(p.anio)],
    ['Auditoría N°', p.codigo],
    ['Objetivo', p.objetivos],
    ['Alcance', p.alcance],
    ['Lugar de realización', `${p.area} · ${p.sucursal}`],
    ['Fecha planificada', fecha(p.fechaPlanificada)],
    ['Normas de referencia', p.normas.map((n) => NORMA_TXT[n] ?? n).join(' · ')],
    ['Equipo auditor', [`Auditor líder: ${p.auditorLider}`, ...p.equipo.filter((e) => e !== p.auditorLider).map((e) => `Auditor: ${e}`)].join('\n')],
    ['Auditado (jefe / encargado)', p.auditados || '—'],
  ];
  const tablaMeta = new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [2600, 5904],
    rows: meta.map(([k, v]) => new TableRow({ cantSplit: true, children: [celda(k, 2600, { header: true }), celda(v, 5904)] })),
  });
  // Mismo formato que los planes FMA: puntos en el orden del documento del área
  const requisitosCelda = p.puntos.flatMap((x) => parrafos(x.titulo, { size: 18 }));
  const plan = new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [1800, 4904, 1800],
    rows: [
      new TableRow({ tableHeader: true, children: [celda('Proceso a auditar', 1800, { header: true }), celda('Requisitos a auditar', 4904, { header: true }), celda('Auditor(es)', 1800, { header: true })] }),
      new TableRow({ children: [celda(p.area.toUpperCase(), 1800, { bold: true }), celda(requisitosCelda.length ? requisitosCelda : parrafos('—'), 4904), celda([p.auditorLider, ...p.equipo.filter((e) => e !== p.auditorLider)].join('\n'), 1800)] }),
      new TableRow({ children: [new TableCell({ columnSpan: 3, borders: bordes, shading: { fill: GRIS, type: ShadingType.CLEAR, color: 'auto' }, children: parrafos('Trabajo de auditores', { bold: true }) })] }),
      new TableRow({ children: [new TableCell({ columnSpan: 3, borders: bordes, shading: { fill: GRIS, type: ShadingType.CLEAR, color: 'auto' }, children: parrafos('Reunión de cierre parcial de auditoría', { bold: true }) })] }),
    ],
  });
  return new Document({
    creator: 'FMA AuditoriAPP',
    title: `Plan de auditoría ${p.codigo}`,
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1701, bottom: 1417, left: 1701, header: 708, footer: 708 } } },
        headers: { default: header },
        children: [tablaMeta, new Paragraph({ text: '' }), plan],
      },
    ],
  });
}
