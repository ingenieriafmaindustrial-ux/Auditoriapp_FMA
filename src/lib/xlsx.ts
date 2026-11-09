// Generador mínimo de planillas Excel (.xlsx) sin dependencias.
// Soporta: estilos, celdas combinadas, fórmulas, imagen (logo), anchos, filas fijas, autofiltro,
// hipervínculos internos entre hojas y configuración de impresión.

export interface Estilo {
  b?: boolean;
  i?: boolean;
  sz?: number;
  color?: string; // 'RRGGBB'
  fill?: string; // 'RRGGBB'
  borde?: 'fino' | 'inferior';
  h?: 'left' | 'center' | 'right';
  v?: 'top' | 'center' | 'bottom';
  wrap?: boolean;
  fmt?: 'entero' | 'pct' | 'fecha' | 'decimal';
  link?: boolean;
}

export type Valor = string | number | null | undefined;
export interface Celda {
  v?: Valor;
  /** Fórmula sin "=" (ej.: "IF(C7=0,0,D7/C7)"). */
  f?: string;
  /** Fecha ISO "yyyy-mm-dd": se guarda como fecha real de Excel. */
  fecha?: string | null;
  s?: Estilo;
  /** Hipervínculo interno: "'Hoja'!A1". */
  ir?: string;
}

export interface Hoja {
  nombre: string;
  columnas: number[]; // anchos en caracteres
  filas: (Celda | Valor)[][];
  altos?: Record<number, number>; // fila (0-based) → alto en puntos
  combinar?: [number, number, number, number][]; // fila1, col1, fila2, col2 (0-based)
  fijarFilas?: number; // n° de filas fijas arriba
  autofiltro?: [number, number, number, number];
  imagen?: { fila: number; col: number; anchoPx: number; altoPx: number; offX?: number; offY?: number };
  horizontal?: boolean;
  encabezadoImpresion?: string;
  pieImpresion?: string;
  tabColor?: string;
  ocultarCuadricula?: boolean;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

export function colLetra(c: number): string {
  let s = '';
  let n = c + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
export const ref = (f: number, c: number) => `${colLetra(c)}${f + 1}`;

function serialFecha(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000);
}

// ---------------- Estilos ----------------
class Estilos {
  fonts: string[] = ['<font><sz val="10"/><name val="Arial"/><family val="2"/></font>'];
  fills: string[] = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  borders: string[] = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  xfs: string[] = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  private cache = new Map<string, number>();
  private idx(lista: string[], xml: string) {
    const i = lista.indexOf(xml);
    if (i >= 0) return i;
    lista.push(xml);
    return lista.length - 1;
  }
  id(s: Estilo | undefined): number {
    if (!s) return 0;
    const clave = JSON.stringify(s);
    const c = this.cache.get(clave);
    if (c !== undefined) return c;
    const color = s.link ? '1F4E9E' : s.color;
    const font = this.idx(this.fonts, `<font>${s.b ? '<b/>' : ''}${s.i ? '<i/>' : ''}${s.link ? '<u/>' : ''}<sz val="${s.sz ?? 10}"/>${color ? `<color rgb="FF${color}"/>` : ''}<name val="Arial"/><family val="2"/></font>`);
    const fill = s.fill ? this.idx(this.fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${s.fill}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const lado = (t: string) => `<${t} style="thin"><color rgb="FFBFBFBF"/></${t}>`;
    const border =
      s.borde === 'fino' ? this.idx(this.borders, `<border>${lado('left')}${lado('right')}${lado('top')}${lado('bottom')}<diagonal/></border>`)
      : s.borde === 'inferior' ? this.idx(this.borders, `<border><left/><right/><top/><bottom style="medium"><color rgb="FFF5C400"/></bottom><diagonal/></border>`)
      : 0;
    const numFmt = s.fmt ? { entero: 3, pct: 9, fecha: 164, decimal: 4 }[s.fmt] : 0;
    const align = s.h || s.v || s.wrap ? `<alignment${s.h ? ` horizontal="${s.h}"` : ''} vertical="${s.v ?? 'center'}"${s.wrap ? ' wrapText="1"' : ''}/>` : '';
    const xml = `<xf numFmtId="${numFmt}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0"${numFmt ? ' applyNumberFormat="1"' : ''} applyFont="1"${fill ? ' applyFill="1"' : ''}${border ? ' applyBorder="1"' : ''}${align ? ' applyAlignment="1">' + align + '</xf>' : '/>'}`;
    const id = this.idx(this.xfs, xml);
    this.cache.set(clave, id);
    return id;
  }
  xml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd\\-mm\\-yyyy"/></numFmts><fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts><fills count="${this.fills.length}">${this.fills.join('')}</fills><borders count="${this.borders.length}">${this.borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }
}

// ---------------- Hoja ----------------
function hojaXml(h: Hoja, est: Estilos, conImagen: boolean) {
  const links: string[] = [];
  const maxCol = Math.max(h.columnas.length, ...h.filas.map((f) => f.length)) - 1;
  const filasXml = h.filas
    .map((fila, r) => {
      const celdas = fila
        .map((raw, c) => {
          const cel: Celda = raw !== null && typeof raw === 'object' ? raw : { v: raw };
          if (cel.ir) links.push(`<hyperlink ref="${ref(r, c)}" location="${esc(cel.ir)}" display="${esc(String(cel.v ?? ''))}"/>`);
          const s = est.id(cel.fecha ? { ...cel.s, fmt: 'fecha' } : cel.s);
          const sa = s ? ` s="${s}"` : '';
          const rr = ref(r, c);
          if (cel.f) return `<c r="${rr}"${sa}><f>${esc(cel.f)}</f></c>`;
          if (cel.fecha) {
            const n = serialFecha(cel.fecha);
            return n === null ? `<c r="${rr}"${sa}/>` : `<c r="${rr}"${sa}><v>${n}</v></c>`;
          }
          if (typeof cel.v === 'number' && Number.isFinite(cel.v)) return `<c r="${rr}"${sa}><v>${cel.v}</v></c>`;
          if (cel.v === null || cel.v === undefined || cel.v === '') return sa ? `<c r="${rr}"${sa}/>` : '';
          return `<c r="${rr}"${sa} t="inlineStr"><is><t xml:space="preserve">${esc(String(cel.v))}</t></is></c>`;
        })
        .join('');
      const alto = h.altos?.[r];
      return `<row r="${r + 1}"${alto ? ` ht="${alto}" customHeight="1"` : ''}>${celdas}</row>`;
    })
    .join('');
  const fijo = h.fijarFilas
    ? `<pane ySplit="${h.fijarFilas}" topLeftCell="A${h.fijarFilas + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${h.fijarFilas + 1}" sqref="A${h.fijarFilas + 1}"/>`
    : '';
  const cols = h.columnas.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const merges = h.combinar?.length ? `<mergeCells count="${h.combinar.length}">${h.combinar.map(([a, b, c, d]) => `<mergeCell ref="${ref(a, b)}:${ref(c, d)}"/>`).join('')}</mergeCells>` : '';
  const af = h.autofiltro ? `<autoFilter ref="${ref(h.autofiltro[0], h.autofiltro[1])}:${ref(h.autofiltro[2], h.autofiltro[3])}"/>` : '';
  const hf = h.encabezadoImpresion || h.pieImpresion ? `<headerFooter>${h.encabezadoImpresion ? `<oddHeader>${esc(h.encabezadoImpresion)}</oddHeader>` : ''}${h.pieImpresion ? `<oddFooter>${esc(h.pieImpresion)}</oddFooter>` : ''}</headerFooter>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr>${h.tabColor ? `<tabColor rgb="FF${h.tabColor}"/>` : ''}<pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${ref(Math.max(0, h.filas.length - 1), Math.max(0, maxCol))}"/><sheetViews><sheetView workbookViewId="0"${h.ocultarCuadricula ? ' showGridLines="0"' : ''}>${fijo}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${filasXml}</sheetData>${af}${merges}${links.length ? `<hyperlinks>${links.join('')}</hyperlinks>` : ''}<printOptions horizontalCentered="1"/><pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${h.horizontal ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/>${hf}${conImagen ? '<drawing r:id="rId1"/>' : ''}</worksheet>`;
}

function dibujoXml(img: NonNullable<Hoja['imagen']>) {
  const emu = (px: number) => Math.round(px * 9525);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:from><xdr:col>${img.col}</xdr:col><xdr:colOff>${emu(img.offX ?? 4)}</xdr:colOff><xdr:row>${img.fila}</xdr:row><xdr:rowOff>${emu(img.offY ?? 4)}</xdr:rowOff></xdr:from><xdr:ext cx="${emu(img.anchoPx)}" cy="${emu(img.altoPx)}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(img.anchoPx)}" cy="${emu(img.altoPx)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`;
}

// ---------------- ZIP (sin compresión) ----------------
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(d: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zip(archivos: { nombre: string; datos: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let off = 0;
  for (const a of archivos) {
    const nombre = enc.encode(a.nombre);
    const crc = crc32(a.datos);
    const loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true); loc.setUint16(8, 0, true);
    loc.setUint16(10, 0, true); loc.setUint16(12, 0x21, true); loc.setUint32(14, crc, true);
    loc.setUint32(18, a.datos.length, true); loc.setUint32(22, a.datos.length, true); loc.setUint16(26, nombre.length, true); loc.setUint16(28, 0, true);
    partes.push(new Uint8Array(loc.buffer), nombre, a.datos);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true);
    cen.setUint16(12, 0, true); cen.setUint16(14, 0x21, true); cen.setUint32(16, crc, true); cen.setUint32(20, a.datos.length, true); cen.setUint32(24, a.datos.length, true);
    cen.setUint16(28, nombre.length, true); cen.setUint32(42, off, true);
    central.push(new Uint8Array(cen.buffer), nombre);
    off += 30 + nombre.length + a.datos.length;
  }
  const tamCentral = central.reduce((n, p) => n + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, off, true);
  const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
  const out = new Uint8Array(todo.reduce((n, p) => n + p.length, 0));
  let p = 0;
  for (const t of todo) { out.set(t, p); p += t.length; }
  return out;
}

/** Nombre de hoja válido para Excel (máx. 31, sin : \ / ? * [ ]). */
export const nombreHoja = (s: string) => s.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31);

export function crearXlsx(p: { hojas: Hoja[]; logoPng?: Uint8Array | null; titulo?: string; autor?: string }): Uint8Array {
  const enc = new TextEncoder();
  const est = new Estilos();
  const archivos: { nombre: string; datos: Uint8Array }[] = [];
  const add = (nombre: string, texto: string) => archivos.push({ nombre, datos: enc.encode(texto) });
  const conLogo = !!p.logoPng;
  const hojasXml = p.hojas.map((h) => hojaXml(h, est, conLogo && !!h.imagen));
  const dibujos = p.hojas.map((h) => conLogo && !!h.imagen);

  add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${p.hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}${dibujos.map((d, i) => (d ? `<Override PartName="/xl/drawings/drawing${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>` : '')).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
  add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
  const ahora = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  add('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(p.titulo ?? '')}</dc:title><dc:creator>${esc(p.autor ?? 'FMA AuditoriAPP')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${ahora}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${ahora}</dcterms:modified></cp:coreProperties>`);
  add('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>FMA AuditoriAPP</Application></Properties>`);
  add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${p.hojas.map((h, i) => `<sheet name="${esc(nombreHoja(h.nombre))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`);
  add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${p.hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${p.hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  hojasXml.forEach((x, i) => {
    add(`xl/worksheets/sheet${i + 1}.xml`, x);
    if (dibujos[i]) {
      add(`xl/worksheets/_rels/sheet${i + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${i + 1}.xml"/></Relationships>`);
      add(`xl/drawings/drawing${i + 1}.xml`, dibujoXml(p.hojas[i].imagen!));
      add(`xl/drawings/_rels/drawing${i + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.png"/></Relationships>`);
    }
  });
  add('xl/styles.xml', est.xml());
  if (conLogo) archivos.push({ nombre: 'xl/media/logo.png', datos: p.logoPng! });
  return zip(archivos);
}
