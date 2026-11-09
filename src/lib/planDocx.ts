// Lector de los "Planes de auditoría" FMA en Word (.docx), sin dependencias:
// descomprime el .docx (zip) con DecompressionStream y lee la columna "PLAN DE AUDITORÍA INTERNA".

export interface PlanLeido {
  /** Texto de la columna "Proceso(s) a auditar" (ej.: "POST - VENTAS"). */
  proceso: string;
  /** Puntos textuales, en el orden del documento. */
  puntos: string[];
}

async function inflarRaw(datos: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([datos as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Extrae un archivo de un zip leyendo el directorio central (tamaños confiables). */
async function leerDelZip(buf: ArrayBuffer, nombre: string): Promise<string | null> {
  const v = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('El archivo no es un Word (.docx) válido');
  const total = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  for (let n = 0; n < total; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const metodo = v.getUint16(p + 10, true);
    const comprimido = v.getUint32(p + 20, true);
    const largoNombre = v.getUint16(p + 28, true);
    const largoExtra = v.getUint16(p + 30, true);
    const largoComent = v.getUint16(p + 32, true);
    const offLocal = v.getUint32(p + 42, true);
    const archivo = dec.decode(u8.subarray(p + 46, p + 46 + largoNombre));
    if (archivo === nombre) {
      const ini = offLocal + 30 + v.getUint16(offLocal + 26, true) + v.getUint16(offLocal + 28, true);
      const datos = u8.subarray(ini, ini + comprimido);
      const bytes = metodo === 0 ? datos : await inflarRaw(datos);
      return dec.decode(bytes);
    }
    p += 46 + largoNombre + largoExtra + largoComent;
  }
  return null;
}

const ent = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const textoParrafo = (xml: string) => ent([...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(''));
const parrafos = (xml: string) => [...xml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)].map((m) => textoParrafo(m[0]));

/** Elementos <tag> de primer nivel (respeta tablas anidadas dentro de celdas). */
function hijos(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?=[\\s>/])[^>]*?(/?)>|</${tag}>`, 'g');
  const out: string[] = [];
  let depth = 0;
  let ini = 0;
  for (const m of xml.matchAll(re)) {
    if (m[0].startsWith('</')) {
      depth--;
      if (depth === 0) out.push(xml.slice(ini, m.index! + m[0].length));
    } else if (m[1] !== '/') {
      if (depth === 0) ini = m.index!;
      depth++;
    }
  }
  return out;
}

interface Celda { col: number; parrafos: string[]; texto: string }
/** Filas de todas las tablas de primer nivel; los párrafos de una celda incluyen sus tablas anidadas, en orden. */
function filas(xml: string): Celda[][] {
  return hijos(xml, 'w:tbl').flatMap((tbl) =>
    hijos(tbl, 'w:tr').map((tr) => {
      let col = 0;
      return hijos(tr, 'w:tc').map((tc) => {
        const span = Number(/<w:gridSpan w:val="(\d+)"/.exec(tc)?.[1] ?? 1);
        const ps = parrafos(tc);
        const c = { col, parrafos: ps, texto: ps.join(' ').replace(/\s+/g, ' ').trim() };
        col += span;
        return c;
      });
    }),
  );
}

/** Une líneas cortadas por el ancho de la celda ("Planificación de" + "trabajo en terreno"). */
export function limpiarPuntos(lineas: string[]): string[] {
  const out: string[] = [];
  for (const bruta of lineas) {
    const t = bruta.replace(/^[\s•▪■◦·\-–*]+/, '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const previo = out[out.length - 1];
    if (previo && (/\b(de|del|y|e|o|la|los|las|el|en|a|para|con)$/i.test(previo) || /^[a-záéíóúñ]/.test(t))) out[out.length - 1] = `${previo} ${t}`;
    else out.push(t);
  }
  return out.map((t) => t.replace(/\s*\.$/, '').trim()).filter(Boolean);
}

const NO_PUNTO = /^(elija un auditor|todos los involucrados\.?)$/i;

/**
 * Lee un plan FMA: en la tabla "Proceso(s) a auditar | Requisitos a auditar | Auditor(es)"
 * toma la lista de puntos de la columna central (encabezado "PLAN DE AUDITORÍA INTERNA", "REUNIÓN DE INICIO"…).
 */
export async function leerPlanDocx(buf: ArrayBuffer): Promise<PlanLeido> {
  const xml = await leerDelZip(buf, 'word/document.xml');
  if (!xml) throw new Error('No se encontró el contenido del documento Word');
  const fs = filas(xml);
  const i = fs.findIndex((f) => f.some((c) => /proceso\(?s?\)? a auditar/i.test(c.texto)));
  if (i >= 0) {
    const cabecera = fs[i];
    const proc = cabecera.find((c) => /proceso\(?s?\)? a auditar/i.test(c.texto))!;
    const colLista = (cabecera.find((c) => c.col > proc.col && !/involucrad|auditor\(es\)/i.test(c.texto)) ?? { col: proc.col + 1 }).col;
    for (let j = i + 1; j < fs.length; j++) {
      const txt = fs[j].map((c) => c.texto).join(' ');
      if (/trabajo (de )?auditores|reuni[oó]n de cierre/i.test(txt)) break;
      const celda = fs[j].find((c) => c.col === colLista) ?? fs[j].find((c) => c.col > proc.col && c.parrafos.filter(Boolean).length >= 3);
      const puntos = limpiarPuntos((celda?.parrafos ?? []).filter((p) => !NO_PUNTO.test(p.trim())));
      if (puntos.length) return { proceso: fs[j].find((c) => c.col <= proc.col && c.texto)?.texto ?? '', puntos };
    }
  }
  throw new Error('No se encontró la lista de "Requisitos a auditar" en el documento');
}

/** Pegar lista: una línea por punto (acepta viñetas). */
export const puntosDesdeTexto = (texto: string) => limpiarPuntos(texto.split(/\r?\n/));
