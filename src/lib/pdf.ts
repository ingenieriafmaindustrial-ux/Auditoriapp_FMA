// Generador mínimo de PDF (sin dependencias): A4, Helvetica (estándar, sin incrustar), logo JPEG, texto con ajuste de línea.
// Suficiente para documentos tipo formulario (plan de auditoría). Coordenadas en pt con origen arriba-izquierda.

export const A4 = { w: 595.28, h: 841.89 };

/** Texto → bytes WinAnsi (cp1252). Lo que no existe en la fuente estándar se reemplaza. */
function winAnsi(s: string): number[] {
  const esp: Record<string, number> = { '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99 };
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c === 0x0a || c === 0x0d) continue;
    if (c >= 32 && c < 127) out.push(c);
    else if (c >= 0xa0 && c <= 0xff) out.push(c);
    else if (esp[ch]) out.push(esp[ch]);
    else if (c === 0x2713 || c === 0x2714) out.push(0x2a); // ✓ → *
    else out.push(0x3f);
  }
  return out;
}

let ctx: CanvasRenderingContext2D | null | undefined;
function medidor(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx;
  try { ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null; } catch { ctx = null; }
  return ctx;
}

export function medirTexto(t: string, size: number, bold = false): number {
  const c = medidor();
  if (c) {
    c.font = `${bold ? 'bold ' : ''}${size}px Helvetica, Arial, sans-serif`;
    return c.measureText(t).width;
  }
  return t.length * size * (bold ? 0.56 : 0.52);
}

export function envolver(texto: string, ancho: number, size: number, bold = false): string[] {
  const lineas: string[] = [];
  for (const parrafo of String(texto ?? '').split('\n')) {
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    if (!palabras.length) { lineas.push(''); continue; }
    let actual = '';
    for (const p of palabras) {
      const prueba = actual ? `${actual} ${p}` : p;
      if (!actual || medirTexto(prueba, size, bold) <= ancho) actual = prueba;
      else { lineas.push(actual); actual = p; }
      // palabra más larga que la línea: se corta
      while (medirTexto(actual, size, bold) > ancho && actual.length > 1) {
        let n = actual.length - 1;
        while (n > 1 && medirTexto(actual.slice(0, n), size, bold) > ancho) n--;
        lineas.push(actual.slice(0, n));
        actual = actual.slice(n);
      }
    }
    lineas.push(actual);
  }
  return lineas;
}

export interface ImagenJpeg { datos: Uint8Array; ancho: number; alto: number }

/** Convierte una imagen (PNG, etc.) en JPEG sobre fondo blanco usando el navegador. */
export async function imagenAJpeg(url: string): Promise<ImagenJpeg | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const cv = document.createElement('canvas');
    cv.width = bmp.width; cv.height = bmp.height;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(bmp, 0, 0);
    const b64 = cv.toDataURL('image/jpeg', 0.92).split(',')[1];
    const bin = atob(b64);
    const datos = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) datos[i] = bin.charCodeAt(i);
    return { datos, ancho: cv.width, alto: cv.height };
  } catch { return null; }
}

const n2 = (n: number) => (Math.round(n * 100) / 100).toString();
const hex = (c: string) => {
  const v = c.replace('#', '');
  return [0, 2, 4].map((i) => n2(parseInt(v.slice(i, i + 2), 16) / 255)).join(' ');
};

export class PdfDoc {
  private paginas: string[][] = [];
  private cur: string[] = [];
  private imagenes: ImagenJpeg[] = [];
  readonly titulo: string;
  /** Tamaño de página en pt (A4 vertical u horizontal). */
  readonly ancho: number;
  readonly alto: number;
  constructor(titulo: string, o: { horizontal?: boolean } = {}) {
    this.titulo = titulo;
    this.ancho = o.horizontal ? A4.h : A4.w;
    this.alto = o.horizontal ? A4.w : A4.h;
    this.nuevaPagina();
  }

  nuevaPagina() { this.cur = []; this.paginas.push(this.cur); }
  get numPaginas() { return this.paginas.length; }
  /** Ejecuta `fn` sobre cada página ya creada (p. ej. para el pie "Página n de m"). */
  enCadaPagina(fn: (n: number, total: number) => void) {
    const total = this.paginas.length; const guardada = this.cur;
    this.paginas.forEach((p, i) => { this.cur = p; fn(i + 1, total); });
    this.cur = guardada;
  }

  rect(x: number, y: number, w: number, h: number, o: { fill?: string; stroke?: string; lw?: number } = {}) {
    const ops: string[] = [];
    if (o.fill) ops.push(`${hex(o.fill)} rg`);
    if (o.stroke) ops.push(`${hex(o.stroke)} RG ${n2(o.lw ?? 0.6)} w`);
    ops.push(`${n2(x)} ${n2(this.alto - y - h)} ${n2(w)} ${n2(h)} re ${o.fill && o.stroke ? 'B' : o.fill ? 'f' : 'S'}`);
    this.cur.push(ops.join(' '));
  }
  linea(x1: number, y1: number, x2: number, y2: number, color = '#000000', lw = 0.6) {
    this.cur.push(`${hex(color)} RG ${n2(lw)} w ${n2(x1)} ${n2(this.alto - y1)} m ${n2(x2)} ${n2(this.alto - y2)} l S`);
  }
  /** Una línea de texto con su línea base en `y`. */
  texto(t: string, x: number, y: number, size = 10, o: { bold?: boolean; color?: string; centro?: number; derecha?: number; /** espacio extra entre palabras (justificado) */ tw?: number } = {}) {
    if (!t) return;
    let px = x;
    if (o.centro !== undefined) px = x + (o.centro - medirTexto(t, size, o.bold)) / 2;
    if (o.derecha !== undefined) px = x + o.derecha - medirTexto(t, size, o.bold);
    const bytes = winAnsi(t).map((b) => (b === 0x28 || b === 0x29 || b === 0x5c ? `\\${String.fromCharCode(b)}` : b < 32 || b > 126 ? `\\${b.toString(8).padStart(3, '0')}` : String.fromCharCode(b))).join('');
    this.cur.push(`BT /${o.bold ? 'F2' : 'F1'} ${n2(size)} Tf ${n2(o.tw ?? 0)} Tw ${hex(o.color ?? '#000000')} rg ${n2(px)} ${n2(this.alto - y)} Td (${bytes}) Tj ET`);
  }
  /**
   * Párrafos justificados (la última línea de cada párrafo queda alineada a la izquierda).
   * Devuelve la `y` siguiente. `alSaltar` se llama cuando no cabe en la página (debe crear página y devolver la nueva `y`).
   */
  parrafos(texto: string, x: number, y: number, ancho: number, size: number, lh: number, o: { color?: string; limite?: number; alSaltar?: () => number; separacion?: number } = {}): number {
    for (const parrafo of String(texto ?? '').split(/\n+/).map((p) => p.trim()).filter(Boolean)) {
      const lineas = envolver(parrafo, ancho, size);
      lineas.forEach((l, i) => {
        if (o.limite && o.alSaltar && y + lh > o.limite) y = o.alSaltar();
        const ultima = i === lineas.length - 1;
        const espacios = (l.match(/ /g) ?? []).length;
        const tw = !ultima && espacios ? (ancho - medirTexto(l, size)) / espacios : 0;
        this.texto(l, x, y + size, size, { color: o.color, tw: tw > 0 && tw < size * 1.5 ? tw : 0 });
        y += lh;
      });
      y += o.separacion ?? lh * 0.6;
    }
    return y;
  }
  /**
   * Sector de anillo (gráfico de dona) con centro (cx, cy). Ángulos en radianes: 0 = arriba, sentido horario.
   * rInt = 0 dibuja un sector de torta.
   */
  sector(cx: number, cy: number, rExt: number, rInt: number, a0: number, a1: number, fill: string) {
    if (a1 - a0 <= 0.0001) return;
    const P = (r: number, a: number): [number, number] => [cx + r * Math.sin(a), this.alto - (cy - r * Math.cos(a))];
    const arco = (r: number, desde: number, hasta: number) => {
      const ops: string[] = [];
      const n = Math.max(1, Math.ceil(Math.abs(hasta - desde) / (Math.PI / 2)));
      const paso = (hasta - desde) / n;
      for (let i = 0; i < n; i++) {
        const a = desde + paso * i;
        const b = a + paso;
        const k = (4 / 3) * Math.tan(paso / 4) * r;
        const [x0, y0] = P(r, a);
        const [x3, y3] = P(r, b);
        // tangente en coords PDF (y hacia arriba): d/da (r·sin a, r·cos a) = (cos a, −sin a)
        const c1 = [x0 + k * Math.cos(a), y0 - k * Math.sin(a)];
        const c2 = [x3 - k * Math.cos(b), y3 + k * Math.sin(b)];
        ops.push(`${n2(c1[0])} ${n2(c1[1])} ${n2(c2[0])} ${n2(c2[1])} ${n2(x3)} ${n2(y3)} c`);
      }
      return ops.join(' ');
    };
    const [sx, sy] = P(rExt, a0);
    const partes = [`${hex(fill)} rg ${n2(sx)} ${n2(sy)} m`, arco(rExt, a0, a1)];
    if (rInt > 0) {
      const [ix, iy] = P(rInt, a1);
      partes.push(`${n2(ix)} ${n2(iy)} l`, arco(rInt, a1, a0));
    } else {
      const [ox, oy] = P(0, 0);
      partes.push(`${n2(ox)} ${n2(oy)} l`);
    }
    partes.push('h f');
    this.cur.push(partes.join(' '));
  }
  imagen(img: ImagenJpeg, x: number, y: number, w: number, h: number) {
    let i = this.imagenes.indexOf(img);
    if (i < 0) { this.imagenes.push(img); i = this.imagenes.length - 1; }
    this.cur.push(`q ${n2(w)} 0 0 ${n2(h)} ${n2(x)} ${n2(this.alto - y - h)} cm /Im${i} Do Q`);
  }

  /** Arma el archivo. */
  finalizar(): Uint8Array {
    const partes: Uint8Array[] = [];
    let largo = 0;
    const offs: number[] = [];
    const enc = (s: string) => Uint8Array.from(Array.from(s, (c) => c.charCodeAt(0) & 0xff));
    const push = (b: Uint8Array) => { partes.push(b); largo += b.length; };
    const obj = (id: number, cuerpo: Uint8Array | string) => {
      offs[id] = largo;
      push(enc(`${id} 0 obj\n`));
      push(typeof cuerpo === 'string' ? enc(cuerpo) : cuerpo);
      push(enc('\nendobj\n'));
    };
    push(enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
    const nImg = this.imagenes.length;
    const base = 5 + nImg; // primer id de página
    const idPag = (i: number) => base + i * 2;
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Count ${this.paginas.length} /Kids [${this.paginas.map((_, i) => `${idPag(i)} 0 R`).join(' ')}] >>`);
    obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    this.imagenes.forEach((im, i) => {
      const cab = enc(`<< /Type /XObject /Subtype /Image /Width ${im.ancho} /Height ${im.alto} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.datos.length} >>\nstream\n`);
      const todo = new Uint8Array(cab.length + im.datos.length + 10);
      todo.set(cab, 0); todo.set(im.datos, cab.length); todo.set(enc('\nendstream'), cab.length + im.datos.length);
      obj(5 + i, todo.slice(0, cab.length + im.datos.length + 10));
    });
    const xobj = this.imagenes.map((_, i) => `/Im${i} ${5 + i} 0 R`).join(' ');
    this.paginas.forEach((ops, i) => {
      const contenido = enc(ops.join('\n'));
      const stream = new Uint8Array(contenido.length + 40);
      const cab = enc(`<< /Length ${contenido.length} >>\nstream\n`);
      const pie = enc('\nendstream');
      const total = new Uint8Array(cab.length + contenido.length + pie.length);
      total.set(cab, 0); total.set(contenido, cab.length); total.set(pie, cab.length + contenido.length);
      void stream;
      obj(idPag(i) + 1, total);
      obj(idPag(i), `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n2(this.ancho)} ${n2(this.alto)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xobj} >> >> /Contents ${idPag(i) + 1} 0 R >>`);
    });
    const total = base + this.paginas.length * 2;
    const info = total; // objeto Info
    obj(info, `<< /Title (${this.titulo.replace(/[()\\]/g, '')}) /Producer (FMA AuditoriAPP) >>`);
    const xref = largo;
    let tabla = `xref\n0 ${info + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= info; id++) tabla += `${String(offs[id]).padStart(10, '0')} 00000 n \n`;
    tabla += `trailer\n<< /Size ${info + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    push(enc(tabla));
    const out = new Uint8Array(largo);
    let o = 0;
    for (const p of partes) { out.set(p, o); o += p.length; }
    return out;
  }
}
