// Propuesta de redacción de hallazgo (sin IA): ordena lo que escribió el auditor en el formato FMA
// (Criterio · Condición · Evidencia · Incumplimiento/Recomendación), corrige tildes frecuentes y
// deja entre [corchetes] lo que falta. Nunca inventa evidencia: solo reorganiza y señala vacíos.

import { exigenciaClausula } from '../../data/resumenClausulas';
import type { Norma } from '../../types';

export interface FaltanteRedaccion {
  clave: 'requisito' | 'evidencia' | 'lugar' | 'efecto' | 'recomendacion';
  etiqueta: string;
}

export interface PropuestaRedaccion {
  texto: string;
  faltantes: FaltanteRedaccion[];
  calidad: number; // 0–100 del texto ORIGINAL
  yaEstructurado: boolean;
}

export const MARCA_PENDIENTE = /\[(indicar|describir|propuesta|completar|precisar)[^\]]*\]/i;

const ANIO_NORMA: Record<string, string> = { 'ISO 9001': '2015', 'ISO 14001': '2026', 'ISO 45001': '2018' };

/** Correcciones de escritura frecuentes en terreno (tildes y palabras separadas). */
type Reemplazo = string | ((m: string, ...g: string[]) => string);
const CORRECCIONES: [RegExp, Reemplazo][] = [
  [/\bretro\s+alimentaci[oó]n/gi, 'retroalimentación'],
  [/\bpost\s+venta\b/gi, 'postventa'],
  [/\bcheck\s+list\b/gi, 'checklist'],
  [/\b(\w{3,})cion\b/gi, '$1ción'],
  [/\b(\w{3,})sion\b/gi, '$1sión'],
  [/\bareas?\b/gi, (m) => (m.length > 4 ? 'áreas' : 'área')],
  [/\bauditoria(s?)\b/gi, 'auditoría$1'],
  [/\bsegun\b/gi, 'según'],
  [/\btambien\b/gi, 'también'],
  [/\bademas\b/gi, 'además'],
  [/\btecnic([oa]s?)\b/gi, 'técnic$1'],
  [/\belectric([oa]s?)\b/gi, 'eléctric$1'],
  [/\bmetodo(s?)\b/gi, 'método$1'],
  [/\bultim([oa]s?)\b/gi, 'últim$1'],
  [/\bperiodo(s?)\b/gi, 'período$1'],
  [/\bnumero(s?)\b/gi, 'número$1'],
  [/\bvehiculo(s?)\b/gi, 'vehículo$1'],
  [/\bde como\b/gi, 'de cómo'],
  [/\bdebil(es)?\b/gi, 'débil$1'],
  [/\bpolitica(s?)\b/gi, 'política$1'],
  [/\bmatriz iper\b/gi, 'matriz IPER'],
  [/\bse[ñn]aletica\b/gi, 'señalética'],
  [/\bsujecion\b/gi, 'sujeción'],
  [/\b(ot|oc|hds|hcr|epp|pgi|isgi)\b/gi, (m) => m.toUpperCase()],
  [/\s+,/g, ','],
  [/\s{2,}/g, ' '],
];

function corregir(t: string): string {
  let r = t;
  for (const [re, rep] of CORRECCIONES) r = typeof rep === 'string' ? r.replace(re, rep) : r.replace(re, rep);
  return r.trim();
}

const minus = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const mayus = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const punto = (s: string) => (/[.!?…]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

/** Una afirmación del auditor redactada en tercera persona ("se evidencia que…"), sin punto final. */
function redactarHecho(t: string): string {
  let x = t.trim().replace(/[.;,]\s*$/, '').replace(/\b(no|tampoco) hay\b/gi, '$1 existe');
  const inicio = /^(durante|se evidencia|se observa|se constata|se detecta|se revis|se verific|se entrevist|se inspeccion|en la revisi|en entrevista|al revisar)/i;
  if (inicio.test(x)) return minus(x);
  const faltaDe = x.match(/^faltan?\s+(de\s+)?(.*)$/i);
  const conVerbo = /\b(se|es|son|est[aá]n?|tienen?|cuentan?|hay|existen?|no|fue|fueron|ha|han|realizan?|usan?|utilizan?|guardan?|mantienen?|presentan?)\b/i.test(x);
  x = faltaDe ? `se evidencia falta de ${faltaDe[2]}` : conVerbo ? `se evidencia que ${minus(x)}` : `se evidencian ${minus(x)}`;
  return x;
}

/** Separa las notas de terreno en hechos (oraciones, punto y coma o "…, no existe / sin / tampoco…"). */
function separarHechos(t: string): string[] {
  return t
    .replace(/,\s*(no existe|no hay|no se|sin |tampoco|además)/gi, ';$1')
    .split(/(?<=[.])\s+(?=[A-ZÁÉÍÓÚÑ])|\s*;\s*/)
    .map((x) => x.trim().replace(/[.;,]\s*$/, ''))
    .filter((x) => x.length > 3);
}

/**
 * Condición argumentada: contexto de la auditoría, hechos observados (enumerados si son varios),
 * contraste con lo que exige el requisito y, si falta, un espacio para precisar el alcance.
 * No inventa evidencia: solo ordena lo escrito y agrega el fundamento del requisito.
 */
function condicion(texto: string, area: string, cl: { norma: string; clausula: string }[]): string {
  const t = corregir(texto).replace(/\s*\n+\s*/g, ' ');
  const hechos = separarHechos(t);
  const intro = /^(durante|en la revisi|en entrevista|al revisar)/i.test(t) ? '' : `Durante la auditoría${area ? ` al área de ${area}` : ''}, `;
  let r: string;
  if (hechos.length <= 1) {
    const h = redactarHecho(hechos[0] ?? t);
    r = punto(intro ? `${intro}${h}` : mayus(h));
  } else {
    const lista = hechos.map((h, i) => `(${i + 1}) ${redactarHecho(h).replace(/^se evidencian? (que )?/i, '')}`).join('; ');
    r = punto(`${intro || 'Durante la auditoría, '}se evidencian las siguientes situaciones: ${lista}`);
  }
  const c = cl.find((x) => exigenciaClausula(x.norma as Norma, x.clausula));
  if (c) {
    const exige = exigenciaClausula(c.norma as Norma, c.clausula)!.split(/(?<=\.)\s/)[0].replace(/\.$/, '');
    r += ` Esta situación se contrapone a lo que exige ${c.norma} ${c.clausula}, que establece que ${minus(exige)}.`;
  }
  if (!/\d/.test(t)) r += ' [Precisar el alcance: cuántos casos, registros o equipos se revisaron y en cuántos se repite la situación].';
  return r;
}

export function evaluarRedaccion(texto: string, tipo: 'NC' | 'OM', tieneRequisito: boolean): FaltanteRedaccion[] {
  const t = texto.toLowerCase();
  const f: FaltanteRedaccion[] = [];
  if (tipo === 'NC' && !tieneRequisito && !/iso\s*\d{4}|cl[aá]usula|pgi|isgi|procedimiento|decreto|ley\b/.test(t)) f.push({ clave: 'requisito', etiqueta: 'Requisito incumplido' });
  if (!/\b(ot|oc|registro|documento|formulario|planilla|foto|fotograf|entrevista|muestra|n°|nº|n\.º|folio|certificado|informe|correo|acta)\b|\d{2,}|\d+\/\d+/.test(t)) f.push({ clave: 'evidencia', etiqueta: 'Evidencia objetiva (registro, OT, fecha, muestra)' });
  if (!/\b(nave|bodega|oficina|planta|terreno|taller|patio|puesto|línea|linea|sucursal|área|area|proceso|cliente|proveedor)\b/.test(t)) f.push({ clave: 'lugar', etiqueta: 'Dónde o en qué proceso' });
  if (tipo === 'NC' && !/(riesgo|podr[ií]a|puede generar|afecta|impacto|consecuencia|provoca|genera|impide)/.test(t)) f.push({ clave: 'efecto', etiqueta: 'Efecto o riesgo' });
  if (tipo === 'OM' && !/(se recomienda|se sugiere|recomend|sugier|mejorar|fortalecer|implementar)/.test(t)) f.push({ clave: 'recomendacion', etiqueta: 'Recomendación' });
  return f;
}

export function proponerRedaccion(p: {
  texto: string;
  tipo: 'NC' | 'OM';
  area: string;
  clausulas: { norma: string; clausula: string; titulo: string }[];
  referenciasInternas: string[];
}): PropuestaRedaccion {
  const original = p.texto.trim();
  const yaEstructurado = /^(no conformidad|oportunidad de mejora)\s*[–-]/i.test(original) || /\bcriterio\s*:/i.test(original);
  const faltantes = evaluarRedaccion(original, p.tipo, p.clausulas.length > 0);
  const calidad = Math.max(0, 100 - faltantes.length * 20);
  if (yaEstructurado || original.length < 15) return { texto: original, faltantes, calidad, yaEstructurado };

  // Separar la recomendación que el auditor ya haya escrito
  const partes = original.split(/(?=\bse (?:recomienda|sugiere)\b)/i);
  const hecho = partes[0].trim().replace(/[.;,]\s*$/, '');
  const recomendacion = partes.slice(1).join(' ').trim();

  const cl = p.clausulas.slice(0, 3);
  const titulo = cl[0]?.titulo ?? (p.tipo === 'NC' ? 'Incumplimiento detectado' : 'Mejora del proceso');
  const criterio = [
    ...cl.map((c) => `${c.norma}:${ANIO_NORMA[c.norma] ?? ''}, cláusula ${c.clausula} (${c.titulo})`),
    ...p.referenciasInternas.filter((r) => /^(PGI|ISGI)/i.test(r)).slice(0, 2).map((r) => `Procedimiento interno ${r}`),
  ];
  const lineas: string[] = [];
  lineas.push(`${p.tipo === 'NC' ? 'No Conformidad' : 'Oportunidad de Mejora'} – ${titulo}`);
  lineas.push(`Criterio: ${criterio.length ? criterio.join('; ') : '[indicar requisito de la norma o procedimiento interno]'}.`);
  lineas.push(`${p.tipo === 'NC' ? 'Condición' : 'Observación'}: ${condicion(hecho, p.area, p.tipo === 'NC' ? cl : [])}`);
  if (faltantes.some((f) => f.clave === 'evidencia')) lineas.push('Evidencia: [indicar registro, OT, fecha, lugar o cargo de la persona entrevistada].');
  if (p.tipo === 'NC') {
    const cortas = cl.map((c) => `${c.norma} ${c.clausula}`).join(', ');
    lineas.push(`Incumplimiento: lo anterior no cumple con lo requerido en ${cortas || '[indicar requisito]'}${criterio.some((c) => c.startsWith('Procedimiento')) ? ' y lo establecido en el procedimiento interno' : ''}.`);
    if (faltantes.some((f) => f.clave === 'efecto')) lineas.push('Efecto: [describir el riesgo o consecuencia para el cliente, la calidad, la seguridad o el ambiente].');
  } else {
    lineas.push(`Recomendación: ${recomendacion ? punto(mayus(corregir(recomendacion))) : '[propuesta de mejora concreta para el área].'}`);
  }
  return { texto: lineas.join('\n'), faltantes, calidad, yaEstructurado };
}
