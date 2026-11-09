// Asistente de normas: sugiere hallazgos tipo según el texto que escribe el auditor.
// Función pura, sin red ni IA: coincidencia de raíces de palabras con puntaje.
import { HALLAZGOS_TIPO, type HallazgoTipo } from '../data/hallazgosTipo';

export interface Sugerencia {
  tipo: HallazgoTipo;
  puntaje: number;
  coincidencias: string[];
}

const PESO_CLAVE = 3;
const PESO_CONTEXTO = 1;
const UMBRAL = 3; // una clave fuerte basta; solo contexto no

const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

type Patron = { raiz: string; re: RegExp };

/** Raíces de ≤4 letras exigen palabra completa (hds, epp, ot); las largas aceptan prefijo (cilindro → cilindros). */
function compilar(raices: string[]): Patron[] {
  return raices
    .map((r) => normalizar(r))
    .filter(Boolean)
    .map((raiz) => {
      const esc = raiz.replace(/ /g, '\\s+');
      const corta = raiz.replace(/ /g, '').length <= 4;
      return { raiz, re: new RegExp(`(?:^|\\s)${esc}${corta ? '(?=\\s|$)' : ''}`) };
    });
}

/** Quita raíces contenidas en otra coincidencia (plano ⊂ planos modificados) para no puntuar dos veces. */
const unicos = (hits: string[]) => hits.filter((h, i) => !hits.some((o, j) => j !== i && o.length > h.length && o.includes(h)));

const INDICE = HALLAZGOS_TIPO.map((t) => ({ tipo: t, claves: compilar(t.claves), contexto: compilar(t.contexto) }));

export function sugerirNormas(texto: string, max = 3): Sugerencia[] {
  const n = normalizar(texto);
  if (n.length < 6) return [];
  const res: Sugerencia[] = [];
  for (const { tipo, claves, contexto } of INDICE) {
    const hitsClave = unicos(claves.filter((p) => p.re.test(n)).map((p) => p.raiz));
    const hitsCtx = unicos(contexto.filter((p) => p.re.test(n)).map((p) => p.raiz)).filter((c) => !hitsClave.some((k) => k.includes(c)));
    // Contexto solo suma si hay al menos una clave (evita ruido con palabras genéricas)
    const puntaje = hitsClave.length ? hitsClave.length * PESO_CLAVE + hitsCtx.length * PESO_CONTEXTO : 0;
    if (puntaje >= UMBRAL) res.push({ tipo, puntaje, coincidencias: [...hitsClave, ...hitsCtx] });
  }
  return res.sort((x, y) => y.puntaje - x.puntaje || y.tipo.veces - x.tipo.veces).slice(0, max);
}
