// Procesamiento de texto en español para el asistente (sin librerías ni red).
import { GLOSARIO } from '../../data/indiceNormas';

export const normalizar = (t: string) =>
  ` ${t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

const STOP = new Set(
  (
    'a al algo algun alguna algunas alguno algunos ante antes aqui asi aun bajo bien cada casi como con contra cual cuales cuando de del desde donde dos el ella ellas ellos ' +
    'en entre era es esa esas ese eso esos esta estan estas este esto estos fue fueron ha han hasta hay la las le les lo los mas me mi mientras mismo muy ni no nos o otra ' +
    'otras otro otros para pero poco por porque que quien se ser si sido sin sobre solo son su sus tal tambien tanto te tiene tienen todo todos tras tu un una unas uno unos ' +
    'y ya yo ' +
    // palabras frecuentes en informes que no aportan tema
    'se evidencia evidencio observa observo constata constato detecta detecto durante auditoria auditado auditada area areas personal existe realiza realizan realizado ' +
    'respecto indica indico puede pueden forma parte fma caso casos actualmente situacion lo cual dicho dicha asimismo embargo ademas manera modo tipo vez veces ' +
    'debe deben deberia hacer hace hecho visto ver consultado consulta entrevista proceso procesos organizacion empresa'
  ).split(' '),
);

const SUFIJOS = [
  'aciones', 'acion', 'amientos', 'imientos', 'amiento', 'imiento', 'mente', 'idades', 'idad', 'ciones', 'cion', 'siones', 'sion', 'ables', 'able', 'ibles', 'ible',
  'adores', 'adoras', 'ador', 'adora', 'antes', 'ante', 'ivos', 'ivas', 'ivo', 'iva', 'ados', 'adas', 'ado', 'ada', 'idos', 'idas', 'ido', 'ida',
  'ando', 'iendo', 'aron', 'ieron', 'aba', 'ar', 'er', 'ir', 'es', 's', 'a', 'o', 'e',
];

/** Raíz liviana: comunicación/comunicar/comunica → "comunic"; clientes → "client". */
export function raiz(p: string): string {
  if (p.length <= 4 || /\d/.test(p)) return p;
  let r = p;
  for (let pasada = 0; pasada < 2; pasada++) {
    const s = SUFIJOS.find((x) => r.endsWith(x) && r.length - x.length >= 4);
    if (!s) break;
    r = r.slice(0, -s.length);
  }
  return r;
}

/** Agrega las formas estándar del glosario FMA (retro alimentación → retroalimentación, OT → orden de trabajo…). */
export function expandir(n: string): string {
  let r = n;
  // Se inserta la forma estándar junto a la original (mantiene la cercanía entre palabras)
  for (const [de, a] of GLOSARIO) {
    const d = ` ${de} `;
    if (r.includes(d)) r = r.split(d).join(` ${de} ${normalizar(a).trim()} `);
  }
  return r;
}

export const palabras = (n: string) => n.trim().split(/\s+/).filter(Boolean);

/** Raíces significativas de un texto (sin palabras vacías). */
export function raices(texto: string, yaNormalizado = false): string[] {
  const n = yaNormalizado ? texto : expandir(normalizar(texto));
  return palabras(n)
    .filter((w) => !STOP.has(w) && w.length > 1)
    .map(raiz);
}

/** Término (palabra o frase) → conjunto de raíces que deben aparecer (en cualquier orden). */
export function raicesTermino(t: string): string[] {
  const r = palabras(normalizar(t))
    .filter((w) => !STOP.has(w))
    .map(raiz);
  return r.length ? [...new Set(r)] : palabras(normalizar(t)).map(raiz);
}

export const contieneFrase = (n: string, frase: string) => n.includes(normalizar(frase));

/** Raíces a guardar como aprendizaje (sin texto legible, sin palabras vacías, máx. 80). */
export function terminosParaAprender(texto: string): string[] {
  return [...new Set(raices(texto))].filter((r) => r.length >= 3 && !/^\d+$/.test(r)).slice(0, 80);
}
