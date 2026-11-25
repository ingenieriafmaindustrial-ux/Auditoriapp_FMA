// Firmas digitalizadas de los auditores. Se guardan en Firestore (colección "firmas", un documento por usuario)
// y solo las pueden leer usuarios activos con sesión iniciada: la imagen no viaja dentro del código público de la app.
// DataContext mantiene esta caché al día; los generadores de Word/PDF la leen de forma síncrona con firmaDe().
import { imagenAJpeg, type ImagenJpeg } from './pdf';

export interface Firma { dataUrl: string; ancho: number; alto: number }
export interface FirmaDoc extends Firma { id: string; nombre: string; actualizadoEn: string }

const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

let cache = new Map<string, Firma>();

/** Reemplaza la caché con las firmas leídas de Firestore. */
export function fijarFirmas(lista: FirmaDoc[]) {
  cache = new Map(lista.filter((f) => f.dataUrl && f.nombre).map((f) => [normalizar(f.nombre), { dataUrl: f.dataUrl, ancho: f.ancho, alto: f.alto }]));
}

/** Firma de una persona por nombre (ignora tildes, mayúsculas y espacios). null si no tiene firma registrada. */
export function firmaDe(nombre: string | null | undefined): Firma | null {
  if (!nombre) return null;
  return cache.get(normalizar(nombre)) ?? null;
}

/** Bytes PNG de la firma (para Word). */
export function firmaBytes(f: Firma): Uint8Array {
  const bin = atob(f.dataUrl.split(',')[1] ?? '');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Firmas en JPEG (fondo blanco) para los PDF, indexadas por el nombre tal como se escribió. */
export async function firmasPdf(nombres: (string | null | undefined)[]): Promise<Record<string, ImagenJpeg>> {
  const out: Record<string, ImagenJpeg> = {};
  for (const n of nombres) {
    const f = firmaDe(n);
    if (n && f && !out[n]) {
      const j = await imagenAJpeg(f.dataUrl);
      if (j) out[n] = j;
    }
  }
  return out;
}

/**
 * Prepara una imagen de firma subida por el usuario (PNG/JPG, escaneada o fotografiada):
 * vuelve transparente el fondo claro, recorta márgenes, la deja de 360 px de ancho y la exporta como PNG liviano.
 */
export async function procesarFirma(file: File): Promise<Firma> {
  if (!file.type.startsWith('image/')) throw new Error('La firma debe ser una imagen (PNG o JPG).');
  const bmp = await createImageBitmap(file);
  const cv = document.createElement('canvas');
  cv.width = bmp.width;
  cv.height = bmp.height;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(bmp, 0, 0);
  const img = g.getImageData(0, 0, cv.width, cv.height);
  const d = img.data;
  let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
  for (let y = 0; y < cv.height; y++) {
    for (let x = 0; x < cv.width; x++) {
      const i = (y * cv.width + x) * 4;
      // Tinta = oscuridad del píxel; el papel claro queda transparente
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const tinta = Math.max(0, Math.min(1, (225 - lum) / 120));
      const a = Math.round((d[i + 3] / 255) * tinta * 255);
      d[i + 3] = a;
      if (a > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) throw new Error('No se detectó la firma en la imagen. Usa una imagen con trazo oscuro sobre fondo claro o transparente.');
  g.putImageData(img, 0, 0);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const ancho = Math.min(360, w);
  const alto = Math.round((h * ancho) / w);
  const out = document.createElement('canvas');
  out.width = ancho;
  out.height = alto;
  const og = out.getContext('2d')!;
  og.imageSmoothingQuality = 'high';
  og.drawImage(cv, x0, y0, w, h, 0, 0, ancho, alto);
  const dataUrl = out.toDataURL('image/png');
  if (dataUrl.length > 120_000) throw new Error('La firma quedó muy pesada. Usa una imagen más simple (solo el trazo, sin fondo ni sombras).');
  return { dataUrl, ancho, alto };
}
